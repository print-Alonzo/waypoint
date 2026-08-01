import { getSession, patchSession } from '@/lib/validation/session'
import type { ValidationSession } from '@/lib/validation/session'
import { MILESTONE_FIELD } from '@/lib/validation/milestones'
import type { Milestone } from '@/lib/validation/milestones'
import { isEnabled } from '@/lib/features'

export type { Milestone }

// Records one funnel milestone: POSTs { sid, milestone, ...extra } to
// /api/validation, which upserts by sid into MongoDB Atlas, then stamps the
// local session's first-touch timestamp — only once the write is confirmed, so
// a failed POST leaves the milestone unstamped and eligible for a later retry
// rather than lying about what was actually recorded. Network failure is
// swallowed (never blocks navigation) — the caller gets `{ ok }` back to decide
// whether that matters (e.g. the feedback form's final submit does; a lightweight
// "tried the app" beacon does not).
//
// No-ops when the `validation` feature flag is off — this is the one choke
// point every milestone call passes through, so flipping the flag actually
// stops all writes rather than just hiding the UI that triggers them.

export async function track(
  milestone: Milestone,
  extra: Record<string, unknown> = {},
): Promise<{ ok: boolean; returning?: boolean }> {
  if (!isEnabled('validation')) return { ok: false }

  const { sid } = getSession()
  try {
    const res = await fetch('/api/validation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sid, milestone, ...extra }),
    })
    if (!res.ok) return { ok: false }

    patchSession({ [MILESTONE_FIELD[milestone]]: Date.now() } as Partial<ValidationSession>)

    let returning: boolean | undefined
    try {
      const body = await res.json()
      returning = typeof body?.returning === 'boolean' ? body.returning : undefined
    } catch {
      // Malformed/empty body — the write still succeeded, just without the
      // returning-visitor signal.
    }
    return { ok: true, returning }
  } catch {
    return { ok: false }
  }
}
