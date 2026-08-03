import type { ValidationSession } from '@/lib/validation/session'

// Single source of truth for the funnel milestone shape — was previously
// duplicated (and drifting) between app/api/validation/route.ts and
// lib/validation/track.ts.

export type Milestone =
  | 'landed'
  | 'quiz_completed'
  | 'tried_app'
  | 'feedback_opened'
  | 'submitted'
  | 'waitlist'

// Which session/doc field a milestone's first-touch timestamp is stored under.
export const MILESTONE_FIELD: Record<Milestone, keyof ValidationSession> = {
  landed: 'landedAt',
  quiz_completed: 'quizCompletedAt',
  tried_app: 'triedAppAt',
  feedback_opened: 'feedbackOpenedAt',
  submitted: 'submittedAt',
  waitlist: 'waitlistAt',
}

// Chronological funnel order (landing -> waitlist -> quiz -> app trial ->
// survey open -> survey submit — see every track() call site), used with
// $max so a later beacon (e.g. a stray tried_app after submitted) can never
// move a row backwards. Must NOT be the Milestone union's declaration order
// — waitlist is not the visitor's last action.
//
// `landed` is rank 0 — deliberately falsy. Any consumer checking
// "is this milestone recognized?" must test `=== undefined`, not truthiness
// (see the falsy-zero fix in scripts/validation-migrate.mjs).
export const MILESTONE_RANK: Record<Milestone, number> = {
  landed: 0,
  waitlist: 1,
  quiz_completed: 2,
  tried_app: 3,
  feedback_opened: 4,
  submitted: 5,
}
