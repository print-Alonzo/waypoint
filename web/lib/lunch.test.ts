import { describe, it, expect } from 'vitest'
import { scheduleAlong, estimateTransitMinutes } from './scheduler'
import type { POI, TransitMatrix } from './scheduler'

function poi(id: string): POI {
  return {
    id,
    name: id.toUpperCase(),
    category: 'heritage',
    lat: 0,
    lng: 0,
    open_time: '00:00',
    close_time: '23:59',
    closed_days: [],
    recommended_duration_minutes: 120,
    notes: null,
  }
}

const A = poi('a')
const B = poi('b')
const START = 'start'
const COORDS = { lat: 0, lng: 0 }
// Fixed 10-min legs for every hop, every mode.
const leg = { walk: 10, jeepney: 10, grab: 10 }
const MATRIX: TransitMatrix = {
  start: { a: leg, b: leg },
  a: { b: leg, start: leg },
  b: { a: leg, start: leg },
}

describe('scheduleAlong lunch window', () => {
  it('reserves lunch before the first stop reached at/after the window, shifting later arrivals', () => {
    const base = scheduleAlong([A, B], MATRIX, START, COORDS, '10:00', 'grab', 'Monday')
    // 10:00 + 10 = 10:10 (A), depart 12:10; B arrives 12:20.
    expect(base[1].arrivalTime).toBe(12 * 60 + 20)
    expect(base[0].lunchBefore).toBeUndefined()
    expect(base[1].lunchBefore).toBeUndefined()

    const lunched = scheduleAlong([A, B], MATRIX, START, COORDS, '10:00', 'grab', 'Monday', undefined, {
      start: 12 * 60,
      end: 13 * 60 + 30,
    })
    // A still 10:10 (before noon). B now waits out lunch → 13:30 + 10 = 13:40.
    // The block START is clamped to when the traveler is actually free (A departs
    // 12:10), not the bare 12:00 window edge — so we never claim a lunch began
    // while they were still at the previous stop.
    expect(lunched[0].arrivalTime).toBe(10 * 60 + 10)
    expect(lunched[0].lunchBefore).toBeUndefined()
    expect(lunched[1].lunchBefore).toEqual({ start: 12 * 60 + 10, end: 13 * 60 + 30 })
    expect(lunched[1].arrivalTime).toBe(13 * 60 + 40)
  })

  it('clamps the block start to the trip start when the day begins inside the window', () => {
    // Start 12:30 (already inside 12:00–13:30): the break is 12:30–13:30, never 12:00.
    const stops = scheduleAlong([A], MATRIX, START, COORDS, '12:30', 'grab', 'Monday', undefined, {
      start: 12 * 60,
      end: 13 * 60 + 30,
    })
    expect(stops[0].lunchBefore).toEqual({ start: 12 * 60 + 30, end: 13 * 60 + 30 })
    expect(stops[0].arrivalTime).toBe(13 * 60 + 40) // 13:30 + 10 transit
  })

  it('takes no break when the whole trip is after the window (afternoon start)', () => {
    // Start 14:00: first arrival 14:10 ≥ 12:00 but it's already past 13:30, so the
    // window is marked done with no block and no time shift.
    const stops = scheduleAlong([A, B], MATRIX, START, COORDS, '14:00', 'grab', 'Monday', undefined, {
      start: 12 * 60,
      end: 13 * 60 + 30,
    })
    expect(stops[0].lunchBefore).toBeUndefined()
    expect(stops[1].lunchBefore).toBeUndefined()
    expect(stops[0].arrivalTime).toBe(14 * 60 + 10)
  })

  it('does not insert lunch when the whole day ends before the window', () => {
    // Short day: start 08:00, one 120-min stop → ends 10:10, never reaches noon.
    const stops = scheduleAlong([A], MATRIX, START, COORDS, '08:00', 'grab', 'Monday', undefined, {
      start: 12 * 60,
      end: 13 * 60 + 30,
    })
    expect(stops[0].lunchBefore).toBeUndefined()
    expect(stops[0].arrivalTime).toBe(8 * 60 + 10)
  })

  it('null/omitted lunch leaves the schedule unchanged', () => {
    const a = scheduleAlong([A, B], MATRIX, START, COORDS, '10:00', 'grab', 'Monday')
    const b = scheduleAlong([A, B], MATRIX, START, COORDS, '10:00', 'grab', 'Monday', undefined, null)
    expect(b.map((s) => s.arrivalTime)).toEqual(a.map((s) => s.arrivalTime))
  })
})

describe('estimateTransitMinutes', () => {
  it('is zero for the same point and grows with distance', () => {
    expect(estimateTransitMinutes(COORDS, COORDS, 'grab')).toBe(0)
    const near = estimateTransitMinutes({ lat: 14.58, lng: 120.98 }, { lat: 14.59, lng: 120.99 }, 'grab')
    const far = estimateTransitMinutes({ lat: 14.58, lng: 120.98 }, { lat: 14.8, lng: 121.2 }, 'grab')
    expect(far).toBeGreaterThan(near)
  })

  it('walking is slower (more minutes) than grab for the same distance', () => {
    const from = { lat: 14.58, lng: 120.98 }
    const to = { lat: 14.62, lng: 121.02 }
    expect(estimateTransitMinutes(from, to, 'walk')).toBeGreaterThan(
      estimateTransitMinutes(from, to, 'grab'),
    )
  })
})
