import { describe, it, expect } from 'vitest'
import { reasonText, reasonLine } from '@/lib/reason'
import type { ScheduledStop, StopReason } from '@/lib/scheduler'

function makeReason(overrides: Partial<StopReason>): StopReason {
  return {
    prevName: null,
    minTransit: 10,
    maxTransit: 10,
    tieGroupSize: 1,
    decidedByClose: false,
    closeTime: '17:00',
    ...overrides,
  }
}

describe('reasonText', () => {
  it('first stop chosen by distance', () => {
    expect(reasonText(makeReason({ prevName: null, tieGroupSize: 1, minTransit: 8 }), 'walk')).toBe(
      'Closest to your start — 8 min by Walk.',
    )
  })

  it('subsequent stop chosen by distance names the previous stop', () => {
    expect(
      reasonText(
        makeReason({ prevName: 'Fort Santiago', tieGroupSize: 1, minTransit: 15 }),
        'grab',
      ),
    ).toBe('Closest from Fort Santiago — 15 min by Grab.')
  })

  it('tie-break decided by a strictly-earlier close reports that close_time as the reason', () => {
    expect(
      reasonText(
        makeReason({
          prevName: null,
          tieGroupSize: 2,
          minTransit: 10,
          maxTransit: 13,
          decidedByClose: true,
          closeTime: '12:00',
        }),
        'walk',
      ),
    ).toBe(
      'Among the nearest from your start (10–13 min by Walk); picked because it closes earliest, at 12:00.',
    )
  })

  it('tie with a SHARED earliest close uses neutral phrasing — no false causation', () => {
    expect(
      reasonText(
        makeReason({
          prevName: 'Casa Manila',
          tieGroupSize: 2,
          minTransit: 10,
          maxTransit: 12,
          decidedByClose: false,
          closeTime: '12:00',
        }),
        'jeepney',
      ),
    ).toBe(
      'Among the nearest from Casa Manila (10–12 min by Jeepney); among the earliest-closing of these.',
    )
  })

  it('collapses the range to one number when min equals max', () => {
    expect(
      reasonText(
        makeReason({ tieGroupSize: 2, minTransit: 10, maxTransit: 10, decidedByClose: true, closeTime: '11:00' }),
        'grab',
      ),
    ).toContain('(10 min by Grab)')
  })
})

describe('reasonLine (placement-aware, single source of truth for page + exports)', () => {
  function makeStop(over: Partial<ScheduledStop>): ScheduledStop {
    return {
      poi: { id: 'x' } as ScheduledStop['poi'],
      arrivalTime: 540,
      departureTime: 600,
      dwellMinutes: 60,
      transitFromPrev: 8,
      yellowFlag: false,
      redFlag: false,
      reason: makeReason({ prevName: 'Fort Santiago', tieGroupSize: 1, minTransit: 8 }),
      ...over,
    }
  }

  it('optimized (and undefined) placement shows the nearest-neighbor reason', () => {
    expect(reasonLine(makeStop({ placement: 'optimized' }), 'grab')).toBe(
      'Closest from Fort Santiago — 8 min by Grab.',
    )
    // undefined placement is treated as optimized
    expect(reasonLine(makeStop({}), 'grab')).toBe('Closest from Fort Santiago — 8 min by Grab.')
  })

  it('a pinned stop never claims an algorithmic reason', () => {
    const line = reasonLine(makeStop({ placement: 'locked' }), 'grab')
    expect(line).toMatch(/pinned by you/i)
    expect(line).not.toMatch(/closest|nearest/i)
  })

  it('a hand-arranged stop says the user placed it', () => {
    const line = reasonLine(makeStop({ placement: 'manual' }), 'grab')
    expect(line).toMatch(/you placed this stop/i)
    expect(line).not.toMatch(/closest|nearest/i)
  })
})
