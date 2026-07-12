import { describe, it, expect } from 'vitest'
import {
  optimizeOrder,
  scheduleAlong,
  scheduleItinerary,
  parseTime,
} from '@/lib/scheduler'
import type { POI, TransitMatrix } from '@/lib/scheduler'

const START_ID = 'start'
const START_COORDS = { lat: 14.58, lng: 120.98 }

function makePOI(over: Partial<POI> & { id: string }): POI {
  return {
    name: `POI ${over.id}`,
    category: 'heritage',
    lat: 14.59,
    lng: 120.98,
    open_time: '09:00',
    close_time: '17:00',
    closed_days: [],
    recommended_duration_minutes: 60,
    notes: null,
    ...over,
  }
}

const A = makePOI({ id: 'a' })
const B = makePOI({ id: 'b' })
const C = makePOI({ id: 'c' })
const D = makePOI({ id: 'd' })
const POIS = [A, B, C, D]

// Hand-built so the greedy order is unambiguous (one strict nearest at each step,
// no <5-min ties). grab is the mode under test.
const M: TransitMatrix = {
  [START_ID]: {
    a: { walk: 10, jeepney: 10, grab: 10 },
    b: { walk: 15, jeepney: 15, grab: 15 },
    c: { walk: 50, jeepney: 50, grab: 50 },
    d: { walk: 55, jeepney: 55, grab: 55 },
  },
  a: {
    b: { walk: 10, jeepney: 10, grab: 10 },
    c: { walk: 50, jeepney: 50, grab: 50 },
    d: { walk: 55, jeepney: 55, grab: 55 },
  },
  b: {
    a: { walk: 10, jeepney: 10, grab: 10 },
    c: { walk: 12, jeepney: 12, grab: 12 },
    d: { walk: 40, jeepney: 40, grab: 40 },
  },
  c: {
    a: { walk: 50, jeepney: 50, grab: 50 },
    b: { walk: 12, jeepney: 12, grab: 12 },
    d: { walk: 8, jeepney: 8, grab: 8 },
  },
  d: {
    a: { walk: 55, jeepney: 55, grab: 55 },
    b: { walk: 40, jeepney: 40, grab: 40 },
    c: { walk: 8, jeepney: 8, grab: 8 },
  },
}

const ids = (pois: POI[]) => pois.map((p) => p.id)

describe('optimizeOrder', () => {
  it('with no locks reproduces scheduleItinerary order AND reasons', () => {
    const opt = optimizeOrder(POIS, new Set(), M, START_ID, START_COORDS, 'grab')
    const scheduled = scheduleItinerary(POIS, M, START_ID, START_COORDS, '09:00', 'grab', 'Tuesday')

    // Same greedy order (a → b → c → d for this matrix).
    expect(ids(opt.order)).toEqual(['a', 'b', 'c', 'd'])
    expect(ids(opt.order)).toEqual(scheduled.map((s) => s.poi.id))

    // Same per-stop reason data (it's the SAME implementation under the hood).
    scheduled.forEach((s) => {
      expect(opt.reasonById[s.poi.id]).toEqual(s.reason)
    })
  })

  it('keeps a locked POI at its index and reflows the rest around it', () => {
    // Pin 'd' at the front; the free stops must be nearest-next FROM d.
    const order = [D, A, B, C] // d locked at index 0
    const opt = optimizeOrder(order, new Set(['d']), M, START_ID, START_COORDS, 'grab')

    // d (8→c), c (12→b), b (10→a) ⇒ d, c, b, a
    expect(ids(opt.order)).toEqual(['d', 'c', 'b', 'a'])
    // Locked stop carries no algorithmic reason; free stops do.
    expect(opt.reasonById['d']).toBeUndefined()
    expect(opt.reasonById['c']).toBeDefined()
    expect(opt.reasonById['c'].prevName).toBe('POI d') // measured from the pinned predecessor
  })

  it('throws a clear error on duplicate ids instead of a raw reduce crash', () => {
    // Callers (ResultView) dedupe before calling; this is the defensive backstop.
    expect(() =>
      optimizeOrder([A, A], new Set(), M, START_ID, START_COORDS, 'grab'),
    ).toThrow(/candidate/i)
  })

  it('respects two locks at fixed positions', () => {
    // a pinned at 0, d pinned at 3; b,c fill 1,2 nearest-next from a.
    const order = [A, B, C, D]
    const opt = optimizeOrder(order, new Set(['a', 'd']), M, START_ID, START_COORDS, 'grab')
    expect(ids(opt.order)).toEqual(['a', 'b', 'c', 'd'])
    expect(opt.reasonById['a']).toBeUndefined()
    expect(opt.reasonById['d']).toBeUndefined()
  })
})

describe('scheduleAlong', () => {
  it('computes arrival/transit along a FIXED order (no reordering)', () => {
    const stops = scheduleAlong([B, A], M, START_ID, START_COORDS, '09:00', 'grab', 'Tuesday')
    expect(stops.map((s) => s.poi.id)).toEqual(['b', 'a']) // order preserved as given
    expect(stops[0].transitFromPrev).toBe(15) // start → b
    expect(stops[0].arrivalTime).toBe(parseTime('09:00') + 15)
    expect(stops[1].transitFromPrev).toBe(10) // b → a
    expect(stops[1].arrivalTime).toBe(stops[0].departureTime + 10)
  })

  it('defaults placement to optimized; flags closed days + late arrival', () => {
    const stops = scheduleAlong([A], M, START_ID, START_COORDS, '09:00', 'grab', 'Tuesday')
    expect(stops[0].placement).toBe('optimized')

    const closed = scheduleAlong(
      [makePOI({ id: 'a', closed_days: ['Tuesday'] })],
      M,
      START_ID,
      START_COORDS,
      '09:00',
      'grab',
      'Tuesday',
    )
    expect(closed[0].redFlag).toBe(true)
  })

  it('honors the decorate callback for placement + reason', () => {
    const stops = scheduleAlong(
      [A, B],
      M,
      START_ID,
      START_COORDS,
      '09:00',
      'grab',
      'Tuesday',
      (poi, _i, prevName, transit) => ({
        placement: 'manual',
        reason: {
          prevName,
          minTransit: transit,
          maxTransit: transit,
          tieGroupSize: 1,
          decidedByClose: false,
          closeTime: poi.close_time,
        },
      }),
    )
    expect(stops.every((s) => s.placement === 'manual')).toBe(true)
    expect(stops[1].reason.prevName).toBe('POI a')
  })
})
