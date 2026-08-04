import { describe, it, expect } from 'vitest'
import { trueRank, MILESTONE_RANK } from '../../../scripts/validation-rerank.mjs'

// trueRank decides what --apply writes to furthestMilestoneRank on every row in
// the live study collection. Mongo writes that field with $max, so a wrong
// answer only ever moves up and cannot be corrected by re-running — it has to
// be re-derived from timestamps. These are the five cases the function
// distinguishes.
describe('trueRank', () => {
  it('takes the furthest milestone when several timestamps are set', () => {
    const rank = trueRank({
      landedAt: 1000,
      quizCompletedAt: 2000,
      waitlistAt: 3000,
    })
    expect(rank).toBe(MILESTONE_RANK.waitlist)
  })

  it('returns 0 rather than falling through when only landedAt is set', () => {
    // The falsy-zero trap the script warns about twice: `landed` is rank 0, so
    // any `!highest` or `!rank` check would treat a real answer as "no answer"
    // and fall back to lastMilestone (or skip the row entirely).
    expect(trueRank({ landedAt: 1000 })).toBe(0)
    expect(trueRank({ landedAt: 1000 })).not.toBeUndefined()
  })

  it('ignores timestamp order and uses funnel rank, not recency', () => {
    // A stray later beacon (e.g. tried_app after submitted) must not drag the
    // row backwards — rank is the ordering, not the clock.
    const rank = trueRank({
      landedAt: 9999,
      submittedAt: 1,
      triedAppAt: 5000,
    })
    expect(rank).toBe(MILESTONE_RANK.submitted)
  })

  it('falls back to lastMilestone for rows written before the timestamp fields', () => {
    expect(trueRank({ lastMilestone: 'tried_app' })).toBe(MILESTONE_RANK.tried_app)
    // Including when the fallback itself is the falsy rank.
    expect(trueRank({ lastMilestone: 'landed' })).toBe(0)
  })

  it('returns undefined for an unusable row so the caller skips instead of guessing', () => {
    expect(trueRank({})).toBeUndefined()
    expect(trueRank({ lastMilestone: 'not_a_milestone' })).toBeUndefined()
  })

  it('treats an explicitly null timestamp as absent, not as reached', () => {
    // Sessions are seeded with null milestone fields, so a null must not count
    // as "this visitor got here" — that would rank every fresh row at submitted.
    expect(trueRank({ landedAt: 1000, submittedAt: null, waitlistAt: undefined })).toBe(0)
  })
})
