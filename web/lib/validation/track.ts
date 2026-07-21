import { getSession, patchSession } from '@/lib/validation/session'
import type { ValidationSession } from '@/lib/validation/session'

// Records one funnel milestone: stamps the local session so a re-visit doesn't
// re-fire the same event, then POSTs { sid, milestone, ...extra } to
// /api/validation, which upserts by sid into MongoDB Atlas. Network failure is
// swallowed (never blocks navigation) — the caller gets `{ ok }` back to decide
// whether that matters (e.g. the feedback form's final submit does; a lightweight
// "tried the app" beacon does not).

export type Milestone = 'quiz_completed' | 'tried_app' | 'feedback_opened' | 'submitted'

const MILESTONE_FIELD: Record<Milestone, keyof ValidationSession> = {
  quiz_completed: 'quizCompletedAt',
  tried_app: 'triedAppAt',
  feedback_opened: 'feedbackOpenedAt',
  submitted: 'submittedAt',
}

export async function track(
  milestone: Milestone,
  extra: Record<string, unknown> = {},
): Promise<{ ok: boolean }> {
  patchSession({ [MILESTONE_FIELD[milestone]]: Date.now() } as Partial<ValidationSession>)
  const { sid } = getSession()
  try {
    const res = await fetch('/api/validation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sid, milestone, ...extra }),
    })
    return { ok: res.ok }
  } catch {
    return { ok: false }
  }
}
