import { describe, it, expect } from 'vitest'
import { CHANNELS, isChannel } from '@/lib/validation/channels'

describe('channels', () => {
  it('accepts every listed channel', () => {
    for (const channel of CHANNELS) {
      expect(isChannel(channel)).toBe(true)
    }
  })

  it('rejects an unknown slug', () => {
    expect(isChannel('bogus')).toBe(false)
  })

  it('rejects non-string values', () => {
    expect(isChannel(undefined)).toBe(false)
    expect(isChannel(null)).toBe(false)
    expect(isChannel(42)).toBe(false)
  })

  it('does not include the ad-blocker-unsafe "ads" slug', () => {
    expect(isChannel('ads')).toBe(false)
  })
})
