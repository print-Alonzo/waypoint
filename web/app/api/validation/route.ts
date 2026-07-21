import { validateSubmission } from '@/lib/validation/validate'
import { getCollection } from '@/lib/validation/mongo'
import type { Milestone } from '@/lib/validation/track'

// Capture endpoint for the willingness-to-pay validation funnel. Upserts one
// MongoDB document per visitor (keyed by session id), so a visitor who drops off
// mid-funnel still leaves a partial row — persona + whichever milestone
// timestamps they reached — which is the funnel drop-off signal the study wants.
//
// Runs on the default Node runtime (NOT edge — the MongoDB driver needs Node).
// This is a real production endpoint, unlike app/admin/create/route.ts's
// local-only tool: it only talks to Atlas over the network, so Vercel's
// read-only filesystem doesn't apply here.

const MILESTONE_FIELD: Record<Milestone, string> = {
  quiz_completed: 'quizCompletedAt',
  tried_app: 'triedAppAt',
  feedback_opened: 'feedbackOpenedAt',
  submitted: 'submittedAt',
}

export async function POST(request: Request) {
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

  try {
    const collection = await getCollection()
    const now = Date.now()
    await collection.updateOne(
      { sid },
      {
        $setOnInsert: { sid, startedAt: now },
        $set: { ...doc, [MILESTONE_FIELD[doc.milestone]]: now },
      },
      { upsert: true },
    )
  } catch (e) {
    return Response.json(
      { ok: false, error: 'Failed to record submission: ' + (e as Error).message },
      { status: 500 },
    )
  }

  return Response.json({ ok: true })
}
