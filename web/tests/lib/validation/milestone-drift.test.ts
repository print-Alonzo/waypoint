import { describe, it, expect } from 'vitest'
import { MILESTONE_RANK, MILESTONE_FIELD } from '@/lib/validation/milestones'
import { MILESTONE_RANK as MIGRATE_RANK } from '../../../scripts/validation-migrate.mjs'
import {
  MILESTONE_RANK as RERANK_RANK,
  MILESTONE_FIELD as RERANK_FIELD,
} from '../../../scripts/validation-rerank.mjs'

// The .mjs report/migration scripts run standalone under plain `node`, outside
// Next's module resolution, so they can't import the TS source of truth and
// keep their own copies of these maps. That's tolerable. The copies silently
// disagreeing is not: furthestMilestoneRank is written with Mongo $max, so a
// wrong rank only ever moves up and can't be walked back without re-deriving
// every row from its timestamps.
//
// This has already bitten once — see the milestone-rank-must-be-chronological
// learning — and the funnel inversion had to hand-edit the same swap in two
// files. These tests are what make the next such edit fail loudly instead.
describe('milestone map drift between milestones.ts and the .mjs scripts', () => {
  it('keeps validation-migrate.mjs MILESTONE_RANK equal to the TS source', () => {
    expect(MIGRATE_RANK).toEqual(MILESTONE_RANK)
  })

  it('keeps validation-rerank.mjs MILESTONE_RANK equal to the TS source', () => {
    expect(RERANK_RANK).toEqual(MILESTONE_RANK)
  })

  it('keeps validation-rerank.mjs MILESTONE_FIELD equal to the TS source', () => {
    expect(RERANK_FIELD).toEqual(MILESTONE_FIELD)
  })

  it('ranks the funnel chronologically, quiz before signup', () => {
    // Guards the inversion itself: channel links open the quiz, and its result
    // screen hands the visitor to the landing page's email ask. If these ever
    // swap back without the data being reranked, pre- and post-inversion
    // cohorts stop being comparable.
    expect(MILESTONE_RANK.landed).toBeLessThan(MILESTONE_RANK.quiz_completed)
    expect(MILESTONE_RANK.quiz_completed).toBeLessThan(MILESTONE_RANK.waitlist)
    expect(MILESTONE_RANK.waitlist).toBeLessThan(MILESTONE_RANK.tried_app)
    expect(MILESTONE_RANK.tried_app).toBeLessThan(MILESTONE_RANK.feedback_opened)
    expect(MILESTONE_RANK.feedback_opened).toBeLessThan(MILESTONE_RANK.submitted)
  })

  it('keeps landed at rank 0 so falsy-zero checks stay a real hazard to guard', () => {
    // Every consumer must test `=== undefined`, never `!rank`. Pinning this
    // here means a future renumbering that makes landed truthy is a decision
    // someone takes deliberately, not one they trip into.
    expect(MILESTONE_RANK.landed).toBe(0)
  })
})
