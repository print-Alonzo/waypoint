// Recomputes furthestMilestoneRank on validation_submissions after the funnel
// inversion swapped the ranks of quiz_completed (now 1) and waitlist (now 2).
// Rows written before the swap carry the old numbers, so a mixed collection
// would quietly answer "how far did visitors get?" wrong for anyone who did
// exactly one of the two.
//
// Lossless and idempotent: each doc already stores a first-touch timestamp per
// milestone, so the true furthest milestone is derivable from the data rather
// than assumed. Docs predating those fields fall back to lastMilestone.
//
// Dry-run by default — reports what it would change without writing anything.
//
// Run with:
//   node scripts/validation-rerank.mjs           # report only
//   node scripts/validation-rerank.mjs --apply

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { MongoClient } from 'mongodb'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Minimal .env.local loader (no dependency) — only fills vars not already set
// in the environment, so `MONGODB_URI=... node scripts/...` still wins.
function loadEnvLocal() {
  const envPath = join(__dirname, '..', '.env.local')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*?)\s*$/)
    if (!match) continue
    const [, key, rawValue] = match
    if (process.env[key] !== undefined) continue
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '')
  }
}

loadEnvLocal()

const APPLY = process.argv.includes('--apply')

// Mirrors lib/validation/milestones.ts's MILESTONE_RANK and MILESTONE_FIELD —
// this script runs standalone via plain `node`, outside Next's module
// resolution, so the maps are duplicated here rather than imported. `landed`
// is rank 0 (falsy) — every check below tests `=== undefined`, not `!rank`.
const MILESTONE_RANK = {
  landed: 0,
  quiz_completed: 1,
  waitlist: 2,
  tried_app: 3,
  feedback_opened: 4,
  submitted: 5,
}

const MILESTONE_FIELD = {
  landed: 'landedAt',
  quiz_completed: 'quizCompletedAt',
  waitlist: 'waitlistAt',
  tried_app: 'triedAppAt',
  feedback_opened: 'feedbackOpenedAt',
  submitted: 'submittedAt',
}

// The furthest milestone this visitor actually reached, from the timestamps
// rather than the stored rank. Returns undefined when the doc carries neither
// timestamps nor a recognizable lastMilestone — a caller should skip it rather
// than write a guess.
function trueRank(doc) {
  let highest
  for (const [milestone, field] of Object.entries(MILESTONE_FIELD)) {
    if (doc[field] == null) continue
    const rank = MILESTONE_RANK[milestone]
    if (highest === undefined || rank > highest) highest = rank
  }
  if (highest !== undefined) return highest
  return MILESTONE_RANK[doc.lastMilestone]
}

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('MONGODB_URI is not set (checked the environment and web/.env.local).')
    process.exit(1)
  }
  const dbName = process.env.MONGODB_DB ?? 'waypoint_validation'

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)
  const submissions = db.collection('validation_submissions')

  console.log(`Connected to database "${dbName}" (${APPLY ? 'APPLY' : 'DRY RUN'})`)

  const docs = await submissions.find({}).toArray()
  console.log(`${docs.length} submission document(s) to check.`)

  let changed = 0
  let unchanged = 0
  let skipped = 0

  for (const doc of docs) {
    const rank = trueRank(doc)
    if (rank === undefined) {
      console.warn(`  skipping _id=${doc._id}: no milestone timestamps and no known lastMilestone`)
      skipped += 1
      continue
    }
    if (doc.furthestMilestoneRank === rank) {
      unchanged += 1
      continue
    }
    console.log(`  sid=${doc.sid}  ${doc.furthestMilestoneRank} -> ${rank}`)
    if (APPLY) await submissions.updateOne({ _id: doc._id }, { $set: { furthestMilestoneRank: rank } })
    changed += 1
  }

  console.log(`\n${changed} to change, ${unchanged} already correct, ${skipped} skipped.`)
  if (!APPLY && changed > 0) console.log('(dry run — pass --apply to write them)')

  await client.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
