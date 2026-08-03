// Read-only report for the marketing-channel attribution test: aggregates
// validation_submissions by channel into visits / signups / conversion, so
// you can see which channel (reddit, facebook, ...) actually brought people
// in. See lib/validation/channels.ts for the allowlist and
// components/landing/ChannelCapture.tsx for how `channel` gets onto a doc.
//
// "Visits" = unique first-touch browsers, not page views: channel is set once
// per sid and never overwritten by a later visit to a different channel link
// (see rotateSessionIfNewEmail() in lib/validation/session.ts for the one
// case it's carried across a session reset instead of dropped). A visit is
// counted as any submissions doc bearing that channel — not just docs with
// landedAt set — so a rotated-session carry-over still lands in the
// denominator and conversion can never exceed 100%.
//
// Deliberately does not hardcode the channel list: a .mjs script can't import
// TS (see validation-migrate.mjs's duplicated MILESTONE_RANK), and
// hardcoding it here would mean adding a channel is no longer a one-line
// edit to channels.ts. Instead this discovers channels from the data itself.
//
// Run with:
//   node scripts/validation-channels.mjs

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

function pct(n, of) {
  return of > 0 ? `${((n / of) * 100).toFixed(1)}%` : '—'
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

  console.log(`Connected to database "${dbName}"\n`)
  console.log('visits = unique first-touch browsers (sids), not page views.\n')

  const rows = await submissions
    .aggregate([
      {
        $group: {
          _id: { $ifNull: ['$channel', '(direct)'] },
          visits: { $sum: 1 },
          waitlist: { $sum: { $cond: [{ $gt: ['$waitlistAt', null] }, 1, 0] } },
          quiz: { $sum: { $cond: [{ $gt: ['$quizCompletedAt', null] }, 1, 0] } },
          tried: { $sum: { $cond: [{ $gt: ['$triedAppAt', null] }, 1, 0] } },
          submitted: { $sum: { $cond: [{ $gt: ['$submittedAt', null] }, 1, 0] } },
        },
      },
      { $sort: { visits: -1 } },
    ])
    .toArray()

  await client.close()

  if (rows.length === 0) {
    console.log('No submissions found.')
    return
  }

  const header = ['channel', 'visits', 'waitlist', 'conv%', 'quiz', 'tried', 'submitted']
  const widths = [16, 8, 10, 8, 6, 6, 10]
  console.log(header.map((h, i) => h.padEnd(widths[i])).join(''))
  console.log(widths.map((w) => '-'.repeat(w - 1)).join(' '))

  for (const row of rows) {
    const cells = [
      String(row._id),
      String(row.visits),
      String(row.waitlist),
      pct(row.waitlist, row.visits),
      String(row.quiz),
      String(row.tried),
      String(row.submitted),
    ]
    console.log(cells.map((c, i) => c.padEnd(widths[i])).join(''))
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
