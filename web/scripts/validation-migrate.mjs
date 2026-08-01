// Non-destructive migration for the validation funnel's Mongo schema change:
// backfills lastMilestone/furthestMilestoneRank onto existing
// validation_submissions docs, and creates the indexes the new upsert /
// returning-email lookup rely on (none existed before this change).
//
// Dry-run by default — reports what it would do without writing anything.
// Refuses to touch the database at all (no backfill, no indexes) if any sid
// has duplicate documents: that needs a manual merge/archive decision, not an
// automatic one, since two docs for one sid likely means two different
// participants' answers landed on the same row before this fix shipped.
//
// Run with:
//   node scripts/validation-migrate.mjs           # report only
//   node scripts/validation-migrate.mjs --apply

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

// Mirrors lib/validation/milestones.ts's MILESTONE_RANK — this script runs
// standalone via plain `node`, outside Next's module resolution, so the map
// is duplicated here rather than imported.
const MILESTONE_RANK = {
  quiz_completed: 1,
  tried_app: 2,
  feedback_opened: 3,
  submitted: 4,
  waitlist: 5,
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
  const events = db.collection('validation_events')

  console.log(`Connected to database "${dbName}" (${APPLY ? 'APPLY' : 'DRY RUN'})`)

  // 1. Duplicate sid check — must be clean before the unique index can exist.
  const duplicates = await submissions
    .aggregate([
      { $group: { _id: '$sid', count: { $sum: 1 }, ids: { $push: '$_id' } } },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray()

  if (duplicates.length > 0) {
    console.error(`\nFound ${duplicates.length} sid(s) with duplicate documents:`)
    for (const d of duplicates) {
      console.error(`  sid=${d._id}  count=${d.count}  _ids=${d.ids.join(', ')}`)
    }
    console.error(
      '\nRefusing to create the unique sid index or run the backfill while duplicates exist.' +
        ' Resolve these manually (merge or archive the extra docs), then re-run.',
    )
    await client.close()
    process.exit(1)
  }
  console.log('No duplicate sids found.')

  // 2. Backfill lastMilestone / furthestMilestoneRank on pre-existing docs.
  const needsBackfill = await submissions.countDocuments({
    furthestMilestoneRank: { $exists: false },
  })
  console.log(`${needsBackfill} document(s) need lastMilestone/furthestMilestoneRank backfilled.`)

  if (APPLY && needsBackfill > 0) {
    const legacy = await submissions.find({ furthestMilestoneRank: { $exists: false } }).toArray()
    let backfilled = 0
    for (const doc of legacy) {
      const rank = MILESTONE_RANK[doc.milestone]
      if (!rank) {
        console.warn(`  skipping _id=${doc._id}: unrecognized milestone "${doc.milestone}"`)
        continue
      }
      await submissions.updateOne(
        { _id: doc._id },
        { $set: { lastMilestone: doc.milestone, furthestMilestoneRank: rank } },
      )
      backfilled += 1
    }
    console.log(`Backfilled ${backfilled} document(s).`)
  }

  // 3-5. Indexes: unique on sid (submissions), non-unique on email
  // (submissions, backs the returning-visitor lookup), and sid+at (events).
  console.log('\nIndexes:')
  console.log('  validation_submissions: { sid: 1 } unique')
  console.log('  validation_submissions: { email: 1 }')
  console.log('  validation_events:      { sid: 1, at: -1 }')

  if (APPLY) {
    await submissions.createIndex({ sid: 1 }, { unique: true })
    await submissions.createIndex({ email: 1 })
    await events.createIndex({ sid: 1, at: -1 })
    console.log('Indexes created.')
  } else {
    console.log('(dry run — pass --apply to create them)')
  }

  await client.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
