import { describe, it, expect } from 'vitest'
import { summarizePlan } from '@/lib/plan/summary'
import type { ScheduleParams } from '@/lib/plan/params'

const BASE: ScheduleParams = {
  poi_ids: ['fort-santiago', 'casa-manila', 'manila-cathedral'],
  start_time: '09:00',
  transport_mode: 'grab',
  start_location: 'rizal-park',
  day_of_week: 'Saturday',
}

describe('summarizePlan', () => {
  it('summarizes a valid plan', () => {
    const s = summarizePlan(BASE)!
    expect(s).not.toBeNull()
    expect(s.stopCount).toBe(3)
    expect(s.orderNames).toHaveLength(3)
    expect(s.hours).toBeGreaterThanOrEqual(1)
    expect(s.fare.high).toBeGreaterThanOrEqual(s.fare.low)
  })

  it('returns null for an unknown start location', () => {
    expect(summarizePlan({ ...BASE, start_location: 'nope' })).toBeNull()
  })

  it('returns null when no poi_ids are real', () => {
    expect(summarizePlan({ ...BASE, poi_ids: ['ghost-1', 'ghost-2'] })).toBeNull()
  })

  it('dedupes duplicate poi_ids', () => {
    const s = summarizePlan({ ...BASE, poi_ids: ['fort-santiago', 'fort-santiago', 'casa-manila'] })!
    expect(s.stopCount).toBe(2)
  })

  it('lunch genuinely lengthens a plan whose stops cross noon', () => {
    // 11:00 start so a stop arrives at/after the 12:00 window and lunch is inserted —
    // otherwise the assertion would be vacuous (a morning-only day never crosses noon).
    const base = { ...BASE, start_time: '11:00' }
    const withLunch = summarizePlan({ ...base, lunch: true })!
    const without = summarizePlan(base)!
    expect(withLunch.hours).toBeGreaterThan(without.hours)
  })

  it('lunch makes no difference to a short morning-only day', () => {
    const withLunch = summarizePlan({ ...BASE, lunch: true })! // 09:00, finishes before noon
    const without = summarizePlan(BASE)!
    expect(withLunch.hours).toBe(without.hours)
  })

  it('walking is free, grab is not', () => {
    expect(summarizePlan({ ...BASE, transport_mode: 'walk' })!.fare).toEqual({ low: 0, high: 0 })
    expect(summarizePlan(BASE)!.fare.high).toBeGreaterThan(0)
  })
})
