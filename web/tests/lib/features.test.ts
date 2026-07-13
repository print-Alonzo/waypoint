import { describe, it, expect } from 'vitest'
import { FEATURES, isEnabled } from '@/lib/features'

describe('isEnabled', () => {
  it('matches the FEATURES registry for every flag', () => {
    for (const flag of Object.keys(FEATURES) as (keyof typeof FEATURES)[]) {
      expect(isEnabled(flag)).toBe(FEATURES[flag])
    }
  })

  it('groupVote is off by default (single-device tally, not enabled by default)', () => {
    expect(isEnabled('groupVote')).toBe(false)
  })
})
