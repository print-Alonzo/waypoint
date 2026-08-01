import type { ValidationSession } from '@/lib/validation/session'

// Single source of truth for the funnel milestone shape — was previously
// duplicated (and drifting) between app/api/validation/route.ts and
// lib/validation/track.ts.

export type Milestone = 'quiz_completed' | 'tried_app' | 'feedback_opened' | 'submitted' | 'waitlist'

// Which session/doc field a milestone's first-touch timestamp is stored under.
export const MILESTONE_FIELD: Record<Milestone, keyof ValidationSession> = {
  quiz_completed: 'quizCompletedAt',
  tried_app: 'triedAppAt',
  feedback_opened: 'feedbackOpenedAt',
  submitted: 'submittedAt',
  waitlist: 'waitlistAt',
}

// Declaration order of the Milestone union, used with $max so a later beacon
// (e.g. a stray tried_app after submitted) can never move a row backwards.
export const MILESTONE_RANK: Record<Milestone, number> = {
  quiz_completed: 1,
  tried_app: 2,
  feedback_opened: 3,
  submitted: 4,
  waitlist: 5,
}
