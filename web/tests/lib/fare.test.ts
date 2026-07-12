import { describe, it, expect } from 'vitest'
import { legFare, dayFare, formatFare } from '@/lib/fare'
import type { ScheduledStop } from '@/lib/scheduler'

function stop(transitFromPrev: number): ScheduledStop {
  return {
    poi: { id: 'x' } as ScheduledStop['poi'],
    arrivalTime: 0,
    departureTime: 0,
    dwellMinutes: 0,
    transitFromPrev,
    yellowFlag: false,
    redFlag: false,
    reason: {
      prevName: null,
      minTransit: transitFromPrev,
      maxTransit: transitFromPrev,
      tieGroupSize: 1,
      decidedByClose: false,
      closeTime: '17:00',
    },
  }
}

describe('legFare', () => {
  it('walking is always free', () => {
    expect(legFare(30, 'walk')).toEqual({ low: 0, high: 0 })
  })

  it('a zero-minute leg costs nothing for any mode', () => {
    expect(legFare(0, 'grab')).toEqual({ low: 0, high: 0 })
  })

  it('jeepney never dips below the ₱13 minimum and stays a valid range', () => {
    const f = legFare(8, 'jeepney')
    expect(f.low).toBeGreaterThanOrEqual(13)
    expect(f.high).toBeGreaterThanOrEqual(f.low)
  })

  it('a longer jeepney leg costs more (transfer territory)', () => {
    expect(legFare(60, 'jeepney').low).toBeGreaterThan(legFare(15, 'jeepney').low)
  })

  it('grab gives a low<high surge band', () => {
    const f = legFare(20, 'grab')
    expect(f.high).toBeGreaterThan(f.low)
    expect(f.low).toBeGreaterThan(45) // above flagdown
  })

  // Pin exact values so a wrong rate constant (e.g. flagdown ₱45→₱60) is caught,
  // not just an ordering change.
  it('pins a grab leg to its rate model', () => {
    expect(legFare(2, 'grab')).toEqual({ low: 60, high: 90 })
  })

  it('pins the jeepney transfer (>6 km) branch: high adds a second minimum fare', () => {
    // 60 min → 12 km. oneRide = 13 + (12-4)*1.8 = 27.4 → low 27; high = round(27.4)+13 = 40.
    expect(legFare(60, 'jeepney')).toEqual({ low: 27, high: 40 })
  })
})

describe('dayFare', () => {
  it('sums the per-leg fares across stops', () => {
    const stops = [stop(2), stop(10), stop(5)]
    const total = dayFare(stops, 'grab')
    const sum = [2, 10, 5]
      .map((m) => legFare(m, 'grab'))
      .reduce((a, b) => ({ low: a.low + b.low, high: a.high + b.high }), { low: 0, high: 0 })
    expect(total).toEqual(sum)
  })

  it('a walking day is free', () => {
    expect(dayFare([stop(10), stop(20)], 'walk')).toEqual({ low: 0, high: 0 })
  })

  it('an empty day costs nothing', () => {
    expect(dayFare([], 'grab')).toEqual({ low: 0, high: 0 })
  })
})

describe('formatFare', () => {
  it('renders Free, a single value, and a range', () => {
    expect(formatFare({ low: 0, high: 0 })).toBe('Free')
    expect(formatFare({ low: 60, high: 60 })).toBe('₱60')
    expect(formatFare({ low: 60, high: 90 })).toBe('₱60–90')
  })

  it('treats a non-positive high as Free (guards against negatives)', () => {
    expect(formatFare({ low: 0, high: -5 })).toBe('Free')
  })
})
