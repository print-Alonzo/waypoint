import { describe, it, expect } from 'vitest'
import { MILESTONE_FIELD, MILESTONE_RANK } from '@/lib/validation/milestones'
import type { Milestone } from '@/lib/validation/milestones'

describe('MILESTONE_RANK', () => {
  // Regression guard, twice over. MILESTONE_RANK must follow the visitor's
  // real chronology, not the Milestone union's declaration order — ranks are
  // written with Mongo $max, so putting a first-touch milestone high silently
  // pins furthestMilestoneRank at its ceiling on the visitor's first action
  // and destroys the drop-off signal.
  it('ranks milestones in true funnel order, landing first', () => {
    expect(MILESTONE_RANK.landed).toBe(0)
    expect(MILESTONE_RANK.quiz_completed).toBe(1)
    expect(MILESTONE_RANK.waitlist).toBe(2)
    expect(MILESTONE_RANK.tried_app).toBe(3)
    expect(MILESTONE_RANK.feedback_opened).toBe(4)
    expect(MILESTONE_RANK.submitted).toBe(5)
  })

  it('is strictly ascending in chronological order', () => {
    // Quiz before signup: channel links open the quiz, and its result screen
    // is what sends the visitor to the landing page's email ask.
    const chronological: Milestone[] = [
      'landed',
      'quiz_completed',
      'waitlist',
      'tried_app',
      'feedback_opened',
      'submitted',
    ]
    const ranks = chronological.map((m) => MILESTONE_RANK[m])
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    expect(new Set(ranks).size).toBe(ranks.length)
  })

  // `landed` is rank 0, which is falsy. Any consumer written as `if (!rank)`
  // silently drops every landing — that exact bug lived in
  // scripts/validation-migrate.mjs until it became `rank === undefined`.
  it('assigns landed a falsy-but-defined rank, so consumers must test === undefined', () => {
    expect(MILESTONE_RANK.landed).toBeFalsy()
    expect(MILESTONE_RANK.landed).toBeDefined()
    expect(MILESTONE_RANK['nope' as Milestone]).toBeUndefined()
  })
})

describe('MILESTONE_FIELD', () => {
  it('maps every milestone to its session timestamp field', () => {
    expect(MILESTONE_FIELD).toEqual({
      landed: 'landedAt',
      waitlist: 'waitlistAt',
      quiz_completed: 'quizCompletedAt',
      tried_app: 'triedAppAt',
      feedback_opened: 'feedbackOpenedAt',
      submitted: 'submittedAt',
    })
  })

  it('covers exactly the milestones MILESTONE_RANK knows about', () => {
    expect(Object.keys(MILESTONE_FIELD).sort()).toEqual(Object.keys(MILESTONE_RANK).sort())
  })
})
