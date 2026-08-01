import { validateSubmission } from '@/lib/validation/validate'
import { getCollection, getEventsCollection } from '@/lib/validation/mongo'
import { MILESTONE_FIELD, MILESTONE_RANK } from '@/lib/validation/milestones'

// Runs on the default Node runtime (NOT edge — the MongoDB driver needs Node).
// This is a real production endpoint, unlike app/admin/create/route.ts's
// local-only tool: it only talks to Atlas over the network, so Vercel's
// read-only filesystem doesn't apply here.
export const runtime = 'nodejs'

// Capture endpoint for the willingness-to-pay validation funnel.
//
// Writes two things per POST:
// - validation_submissions: one rollup document per visitor (keyed by sid), so
//   a visitor who drops off mid-funnel still leaves a partial row — persona +
//   whichever milestone timestamps they reached — which is the funnel
//   drop-off signal the study wants. Uses $min/$max instead of $set so a
//   later/duplicate beacon can never lose a first-touch timestamp or make
//   funnel progress look like it went backwards.
// - validation_events: append-only, never updated. The durable record of
//   truth — even if a rollup row is ever overwritten (e.g. sid reuse), no
//   individual answer is lost here.
export async function POST(request: Request) {
  // Cheap same-origin check: reject only when an Origin header is present and
  // doesn't match this deployment's host. Absent Origin (curl, some non-browser
  // clients) is allowed through — this narrows the obvious cross-site-POST case
  // without acting as a full CSRF defense. The endpoint remains unauthenticated
  // and unthrottled; SID_RE (lib/validation/validate.ts) still accepts any
  // client-chosen sid. Flagged, not solved here.
  const origin = request.headers.get('origin')
  if (origin) {
    let originHost: string
    try {
      originHost = new URL(origin).host
    } catch {
      return Response.json({ ok: false, error: 'Invalid request.' }, { status: 403 })
    }
    if (originHost !== new URL(request.url).host) {
      return Response.json({ ok: false, error: 'Invalid request.' }, { status: 403 })
    }
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { errors, sid, doc } = validateSubmission(body)
  if (!sid || !doc) {
    return Response.json({ ok: false, errors }, { status: 422 })
  }

  if (!process.env.MONGODB_URI) {
    return Response.json(
      { ok: false, error: 'Validation capture is not configured on this deployment.' },
      { status: 503 },
    )
  }

  const { milestone, ...answers } = doc
  const now = Date.now()

  try {
    const collection = await getCollection()

    // Must read BEFORE the upsert below, or the write we're about to do makes
    // every email look returning. Scoped to `waitlist` so every other
    // milestone's write stays a single round trip. Not unique — the same
    // email can legitimately appear under several sids (returning visitor on
    // a new device/browser) — so this is a plain existence check, not a
    // dedupe key.
    let returning = false
    if (milestone === 'waitlist' && doc.email) {
      const existing = await collection.findOne({ email: doc.email }, { projection: { _id: 1 } })
      returning = existing !== null
    }

    await collection.updateOne(
      { sid },
      {
        $setOnInsert: { sid, startedAt: now },
        // First touch wins — a re-fired milestone can't clobber an earlier
        // timestamp for the same field.
        $min: { [MILESTONE_FIELD[milestone]]: now },
        // Furthest progress reached, never regresses even if a stale beacon
        // for an earlier milestone arrives after a later one.
        $max: { furthestMilestoneRank: MILESTONE_RANK[milestone] },
        $set: { ...answers, lastMilestone: milestone, lastSeenAt: now },
      },
      { upsert: true },
    )

    const events = await getEventsCollection()
    await events.insertOne({ sid, milestone, at: now, doc: answers })

    return Response.json({ ok: true, returning })
  } catch (e) {
    console.error('Validation submission failed:', e)
    return Response.json({ ok: false, error: 'Failed to record submission.' }, { status: 500 })
  }
}
