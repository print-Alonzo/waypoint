import { describe, it, expect } from 'vitest'
import { isEnabled } from '@/lib/features'

describe('isEnabled', () => {
  // Hardcoded against literal booleans (not FEATURES itself) so this test can
  // actually fail if isEnabled stops being a pure passthrough of the registry.
  it('reflects the shipped default for every registered flag', () => {
    expect(isEnabled('presets')).toBe(true)
    expect(isEnabled('fitToHours')).toBe(true)
    expect(isEnabled('fareEstimator')).toBe(true)
    expect(isEnabled('whatIf')).toBe(true)
    expect(isEnabled('lunchBreak')).toBe(true)
    expect(isEnabled('customDuration')).toBe(true)
    expect(isEnabled('offline')).toBe(true)
    expect(isEnabled('liveMode')).toBe(true)
    expect(isEnabled('comparePlans')).toBe(true)
    expect(isEnabled('groupVote')).toBe(false)
  })

  it('groupVote is off by default (single-device tally, not enabled by default)', () => {
    expect(isEnabled('groupVote')).toBe(false)
  })
})
