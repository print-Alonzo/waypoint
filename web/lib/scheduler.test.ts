import { describe, it, expect, vi, afterEach } from 'vitest'
import { scheduleItinerary, parseTime, formatTime } from './scheduler'
import type { POI, TransitMatrix, ScheduledStop } from './scheduler'

const START_COORDS = { lat: 14.5831, lng: 120.9794 }
const START_ID = 'rizal-park'

function makePOI(overrides: Partial<POI> & { id: string }): POI {
  return {
    name: `POI ${overrides.id}`,
    category: 'heritage',
    lat: 14.59,
    lng: 120.98,
    open_time: '09:00',
    close_time: '17:00',
    closed_days: [],
    recommended_duration_minutes: 60,
    notes: null,
    ...overrides,
  }
}

function makeMatrix(startId: string, pois: POI[]): TransitMatrix {
  const matrix: TransitMatrix = { [startId]: {} }
  pois.forEach((p, i) => {
    matrix[startId][p.id] = { walk: (i + 1) * 10, jeepney: (i + 1) * 6, grab: (i + 1) * 4 }
    matrix[p.id] = {}
    pois.forEach((other) => {
      if (other.id !== p.id) {
        matrix[p.id][other.id] = { walk: 15, jeepney: 9, grab: 6 }
      }
    })
  })
  return matrix
}

afterEach(() => {
  vi.restoreAllMocks()
})

// (a) Happy path: 4 POIs, no conflicts
describe('happy path', () => {
  it('schedules 4 POIs in nearest-neighbor order with no flags', () => {
    const pois = [
      makePOI({ id: 'a', lat: 14.59 }),
      makePOI({ id: 'b', lat: 14.60 }),
      makePOI({ id: 'c', lat: 14.61 }),
      makePOI({ id: 'd', lat: 14.62 }),
    ]
    const matrix = makeMatrix(START_ID, pois)
    const result = scheduleItinerary(pois, matrix, START_ID, START_COORDS, '09:00', 'walk', 'Tuesday')

    expect(result).toHaveLength(4)
    expect(result.every((s) => !s.yellowFlag && !s.redFlag)).toBe(true)
    // Stop 1 is nearest (10 min walk) → poi 'a'
    expect(result[0].poi.id).toBe('a')
    expect(result[0].arrivalTime).toBe(parseTime('09:00') + 10)
  })
})

// (b) All POIs closed (all red-flagged, none dropped)
describe('all POIs closed (red flag)', () => {
  it('returns all stops with redFlag=true when all are closed on selected day', () => {
    const pois = [
      makePOI({ id: 'a', closed_days: ['Monday'] }),
      makePOI({ id: 'b', closed_days: ['Monday'] }),
      makePOI({ id: 'c', closed_days: ['Monday'] }),
    ]
    const matrix = makeMatrix(START_ID, pois)
    const result = scheduleItinerary(pois, matrix, START_ID, START_COORDS, '09:00', 'walk', 'Monday')

    expect(result).toHaveLength(3)
    expect(result.every((s) => s.redFlag)).toBe(true)
  })
})

// (c) Start time too late (all yellow-flagged, schedule shown as-is)
describe('start time too late', () => {
  it('flags all POIs yellow when start time leaves no reachable windows', () => {
    const pois = [
      makePOI({ id: 'a', close_time: '09:00' }),
      makePOI({ id: 'b', close_time: '09:30' }),
    ]
    const matrix = makeMatrix(START_ID, pois)
    // Walk transit to 'a' = 10 min → arrival 09:10 > 09:00
    // Walk transit to 'b' = 20 min → arrival 09:20 < 09:30, but 'a' is first (nearest)
    const result = scheduleItinerary(pois, matrix, START_ID, START_COORDS, '09:00', 'walk', 'Tuesday')

    expect(result).toHaveLength(2)
    expect(result[0].yellowFlag).toBe(true) // arrival 09:10 > close 09:00
  })
})

// (d) Single POI selected
describe('single POI', () => {
  it('returns one-stop schedule with no transit between stops', () => {
    const pois = [makePOI({ id: 'solo' })]
    const matrix: TransitMatrix = {
      [START_ID]: { solo: { walk: 8, jeepney: 5, grab: 3 } },
    }
    const result = scheduleItinerary(pois, matrix, START_ID, START_COORDS, '10:00', 'jeepney', 'Wednesday')

    expect(result).toHaveLength(1)
    expect(result[0].poi.id).toBe('solo')
    expect(result[0].arrivalTime).toBe(parseTime('10:00') + 5)
    expect(result[0].transitFromPrev).toBe(5)
  })
})

// (e) Duration = 0 clamped to 1
describe('zero duration clamped', () => {
  it('clamps duration=0 to 1 so departure_time differs from arrival_time', () => {
    const poi = makePOI({ id: 'zero', recommended_duration_minutes: 0 })
    const matrix: TransitMatrix = {
      [START_ID]: { zero: { walk: 10, jeepney: 6, grab: 4 } },
    }
    const result = scheduleItinerary([poi], matrix, START_ID, START_COORDS, '09:00', 'walk', 'Tuesday')

    expect(result[0].departureTime - result[0].arrivalTime).toBeGreaterThanOrEqual(1)
  })
})

// (f) Tie-break: transit delta < 5 → earlier close_time wins; delta == 5 → nearest wins
describe('tie-break logic', () => {
  it('breaks tie with <5 min delta by earlier close_time', () => {
    const poiA = makePOI({ id: 'a', close_time: '18:00' })
    const poiB = makePOI({ id: 'b', close_time: '12:00' })
    const matrix: TransitMatrix = {
      [START_ID]: {
        a: { walk: 10, jeepney: 6, grab: 4 },
        b: { walk: 13, jeepney: 8, grab: 5 }, // delta = 3 min < 5 → close_time breaks tie
      },
      a: { b: { walk: 15, jeepney: 9, grab: 6 } },
      b: { a: { walk: 15, jeepney: 9, grab: 6 } },
    }
    const result = scheduleItinerary([poiA, poiB], matrix, START_ID, START_COORDS, '09:00', 'walk', 'Tuesday')

    // poiB has earlier close_time (12:00) and is within 5 min of nearest → wins
    expect(result[0].poi.id).toBe('b')
  })

  it('picks nearest when transit delta is exactly 5 min', () => {
    const poiA = makePOI({ id: 'a', close_time: '12:00' })
    const poiB = makePOI({ id: 'b', close_time: '18:00' })
    const matrix: TransitMatrix = {
      [START_ID]: {
        a: { walk: 10, jeepney: 6, grab: 4 },
        b: { walk: 15, jeepney: 9, grab: 5 }, // delta = 5 min exactly → nearest wins
      },
      a: { b: { walk: 15, jeepney: 9, grab: 6 } },
      b: { a: { walk: 15, jeepney: 9, grab: 6 } },
    }
    const result = scheduleItinerary([poiA, poiB], matrix, START_ID, START_COORDS, '09:00', 'walk', 'Tuesday')

    // delta == 5 → nearest wins (poiA at 10 min)
    expect(result[0].poi.id).toBe('a')
  })
})

// (g) Haversine fallback: missing matrix entry → result computed, console.warn called
describe('Haversine fallback', () => {
  it('uses Haversine when matrix entry is missing and emits console.warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const poiA = makePOI({ id: 'a', lat: 14.59, lng: 120.98 })
    const poiB = makePOI({ id: 'b', lat: 14.60, lng: 120.99 })
    // Only provide start→a; a→b and start→b are missing
    const matrix: TransitMatrix = {
      [START_ID]: { a: { walk: 10, jeepney: 6, grab: 4 } },
    }

    expect(() =>
      scheduleItinerary([poiA, poiB], matrix, START_ID, START_COORDS, '09:00', 'walk', 'Tuesday'),
    ).not.toThrow()

    expect(warnSpy).toHaveBeenCalledWith(
      'Missing transit matrix entry',
      expect.objectContaining({ from: 'a', to: 'b', mode: 'walk' }),
    )
  })
})

// (h) Mixed flags: some red + some yellow + some clear rows
describe('mixed flag state', () => {
  it('assigns correct flags per row without all-red banner condition triggering', () => {
    const pois = [
      makePOI({ id: 'a', closed_days: ['Monday'] }), // red
      makePOI({ id: 'b', close_time: '09:00' }), // yellow (arrival > close)
      makePOI({ id: 'c' }), // clear
    ]
    const matrix = makeMatrix(START_ID, pois)
    const result = scheduleItinerary(pois, matrix, START_ID, START_COORDS, '09:00', 'walk', 'Monday')

    const byId = Object.fromEntries(result.map((s) => [s.poi.id, s]))
    expect(byId['a'].redFlag).toBe(true)
    expect(byId['a'].yellowFlag).toBe(false)
    expect(byId['c'].redFlag).toBe(false)
    expect(byId['c'].yellowFlag).toBe(false)
    expect(result.every((s) => s.redFlag)).toBe(false)
  })
})

// (i) Yellow boundary: arrival_time == close_time → no yellow flag
describe('yellow flag boundary', () => {
  it('does not fire yellow flag when arrival_time exactly equals close_time', () => {
    // Walk transit to solo = 10 min → arrival = 09:10 = 550 min
    // close_time = 09:10 → close_time_minutes = 550
    // 550 > 550 is false → no yellow flag
    const poi = makePOI({ id: 'solo', close_time: '09:10' })
    const matrix: TransitMatrix = {
      [START_ID]: { solo: { walk: 10, jeepney: 6, grab: 4 } },
    }
    const result = scheduleItinerary([poi], matrix, START_ID, START_COORDS, '09:00', 'walk', 'Tuesday')

    expect(result[0].arrivalTime).toBe(550)
    expect(result[0].yellowFlag).toBe(false)
  })
})

// (j) Reason data ("Why this order") — emitted by the selection step itself.
describe('reason data', () => {
  it('first stop: distance reason when it is the sole nearest', () => {
    const poi = makePOI({ id: 'solo' })
    const matrix: TransitMatrix = { [START_ID]: { solo: { walk: 8, jeepney: 5, grab: 3 } } }
    const result = scheduleItinerary([poi], matrix, START_ID, START_COORDS, '09:00', 'walk', 'Tuesday')

    expect(result[0].reason).toMatchObject({
      prevName: null,
      tieGroupSize: 1,
      minTransit: 8,
      maxTransit: 8,
      decidedByClose: false,
    })
  })

  it('tie-break: reason faithfully reports the close_time that decided it (delta < 5)', () => {
    const poiA = makePOI({ id: 'a', close_time: '18:00' })
    const poiB = makePOI({ id: 'b', close_time: '12:00' })
    const matrix: TransitMatrix = {
      [START_ID]: {
        a: { walk: 10, jeepney: 6, grab: 4 },
        b: { walk: 13, jeepney: 8, grab: 5 }, // delta 3 < 5 → both in tie group; b closes earlier → wins
      },
      a: { b: { walk: 15, jeepney: 9, grab: 6 } },
      b: { a: { walk: 15, jeepney: 9, grab: 6 } },
    }
    const result = scheduleItinerary([poiA, poiB], matrix, START_ID, START_COORDS, '09:00', 'walk', 'Tuesday')

    expect(result[0].poi.id).toBe('b')
    expect(result[0].reason).toMatchObject({
      tieGroupSize: 2,
      minTransit: 10, // nearest (a) — the range's lower bound, NOT the winner's transit
      maxTransit: 13,
      decidedByClose: true,
      closeTime: '12:00',
    })
  })

  it('tie-break: does NOT claim close decided it when the earliest close_time is shared', () => {
    const poiA = makePOI({ id: 'a', close_time: '12:00' })
    const poiB = makePOI({ id: 'b', close_time: '12:00' })
    const matrix: TransitMatrix = {
      [START_ID]: {
        a: { walk: 10, jeepney: 6, grab: 4 },
        b: { walk: 12, jeepney: 8, grab: 5 }, // delta 2 < 5 → both in tie group; same close → array order wins
      },
      a: { b: { walk: 15, jeepney: 9, grab: 6 } },
      b: { a: { walk: 15, jeepney: 9, grab: 6 } },
    }
    const result = scheduleItinerary([poiA, poiB], matrix, START_ID, START_COORDS, '09:00', 'walk', 'Tuesday')

    expect(result[0].poi.id).toBe('a')
    expect(result[0].reason.tieGroupSize).toBe(2)
    expect(result[0].reason.decidedByClose).toBe(false)
  })

  it('delta of exactly 5 min is not a tie group → distance reason', () => {
    const poiA = makePOI({ id: 'a', close_time: '12:00' })
    const poiB = makePOI({ id: 'b', close_time: '18:00' })
    const matrix: TransitMatrix = {
      [START_ID]: {
        a: { walk: 10, jeepney: 6, grab: 4 },
        b: { walk: 15, jeepney: 9, grab: 5 }, // delta 5 → NOT < 5 → b excluded from tie group
      },
      a: { b: { walk: 15, jeepney: 9, grab: 6 } },
      b: { a: { walk: 15, jeepney: 9, grab: 6 } },
    }
    const result = scheduleItinerary([poiA, poiB], matrix, START_ID, START_COORDS, '09:00', 'walk', 'Tuesday')

    expect(result[0].poi.id).toBe('a')
    expect(result[0].reason.tieGroupSize).toBe(1)
    expect(result[0].reason.decidedByClose).toBe(false)
  })

  it('subsequent stop: reason names the previous stop', () => {
    const pois = [makePOI({ id: 'a', name: 'Alpha' }), makePOI({ id: 'b', name: 'Bravo' })]
    const matrix = makeMatrix(START_ID, pois)
    const result = scheduleItinerary(pois, matrix, START_ID, START_COORDS, '09:00', 'walk', 'Tuesday')

    expect(result[1].reason.prevName).toBe(result[0].poi.name)
  })

  it('maxTransit reflects the tie group, not the global candidate max', () => {
    const poiA = makePOI({ id: 'a', close_time: '18:00' })
    const poiB = makePOI({ id: 'b', close_time: '12:00' }) // earliest close → wins, lands first
    const poiC = makePOI({ id: 'c', close_time: '18:00' })
    const matrix: TransitMatrix = {
      [START_ID]: {
        a: { walk: 10, jeepney: 6, grab: 4 }, // nearest
        b: { walk: 13, jeepney: 8, grab: 5 }, // in tie group (delta 3 < 5)
        c: { walk: 30, jeepney: 18, grab: 12 }, // OUTSIDE the 5-min window (delta 20)
      },
      a: { b: { walk: 15, jeepney: 9, grab: 6 }, c: { walk: 15, jeepney: 9, grab: 6 } },
      b: { a: { walk: 15, jeepney: 9, grab: 6 }, c: { walk: 15, jeepney: 9, grab: 6 } },
      c: { a: { walk: 15, jeepney: 9, grab: 6 }, b: { walk: 15, jeepney: 9, grab: 6 } },
    }
    const result = scheduleItinerary([poiA, poiB, poiC], matrix, START_ID, START_COORDS, '09:00', 'walk', 'Tuesday')

    expect(result[0].poi.id).toBe('b')
    expect(result[0].reason).toMatchObject({ tieGroupSize: 2, minTransit: 10, maxTransit: 13 })
    expect(result[0].reason.maxTransit).not.toBe(30) // not the far candidate outside the tie window
  })

  it('3-member tie group: neutral (decidedByClose=false) when the earliest close is shared', () => {
    const poiA = makePOI({ id: 'a', close_time: '12:00' })
    const poiB = makePOI({ id: 'b', close_time: '12:00' }) // shares the earliest close with a
    const poiC = makePOI({ id: 'c', close_time: '18:00' })
    const matrix: TransitMatrix = {
      [START_ID]: {
        a: { walk: 10, jeepney: 6, grab: 4 },
        b: { walk: 12, jeepney: 7, grab: 5 },
        c: { walk: 13, jeepney: 8, grab: 5 }, // all within 5 min of min → tie group of 3
      },
      a: { b: { walk: 15, jeepney: 9, grab: 6 }, c: { walk: 15, jeepney: 9, grab: 6 } },
      b: { a: { walk: 15, jeepney: 9, grab: 6 }, c: { walk: 15, jeepney: 9, grab: 6 } },
      c: { a: { walk: 15, jeepney: 9, grab: 6 }, b: { walk: 15, jeepney: 9, grab: 6 } },
    }
    const result = scheduleItinerary([poiA, poiB, poiC], matrix, START_ID, START_COORDS, '09:00', 'walk', 'Tuesday')

    expect(result[0].reason.tieGroupSize).toBe(3)
    expect(result[0].reason.decidedByClose).toBe(false)
  })

  it('3-member tie group: decidedByClose=true only when the winner is strictly earliest of all', () => {
    const poiA = makePOI({ id: 'a', close_time: '11:00' }) // strictly earliest of the three
    const poiB = makePOI({ id: 'b', close_time: '14:00' })
    const poiC = makePOI({ id: 'c', close_time: '18:00' })
    const matrix: TransitMatrix = {
      [START_ID]: {
        a: { walk: 10, jeepney: 6, grab: 4 },
        b: { walk: 12, jeepney: 7, grab: 5 },
        c: { walk: 13, jeepney: 8, grab: 5 },
      },
      a: { b: { walk: 15, jeepney: 9, grab: 6 }, c: { walk: 15, jeepney: 9, grab: 6 } },
      b: { a: { walk: 15, jeepney: 9, grab: 6 }, c: { walk: 15, jeepney: 9, grab: 6 } },
      c: { a: { walk: 15, jeepney: 9, grab: 6 }, b: { walk: 15, jeepney: 9, grab: 6 } },
    }
    const result = scheduleItinerary([poiA, poiB, poiC], matrix, START_ID, START_COORDS, '09:00', 'walk', 'Tuesday')

    expect(result[0].poi.id).toBe('a')
    expect(result[0].reason.tieGroupSize).toBe(3)
    expect(result[0].reason.decidedByClose).toBe(true)
  })

  it('shared earliest close: the array-first candidate wins even when it is the farther one', () => {
    const poiFar = makePOI({ id: 'far', close_time: '12:00' }) // first in array, farther
    const poiNear = makePOI({ id: 'near', close_time: '12:00' }) // nearer, same close
    const matrix: TransitMatrix = {
      [START_ID]: {
        far: { walk: 13, jeepney: 8, grab: 5 },
        near: { walk: 10, jeepney: 6, grab: 4 }, // delta 3 < 5 → both in tie group
      },
      far: { near: { walk: 15, jeepney: 9, grab: 6 } },
      near: { far: { walk: 15, jeepney: 9, grab: 6 } },
    }
    const result = scheduleItinerary([poiFar, poiNear], matrix, START_ID, START_COORDS, '09:00', 'walk', 'Tuesday')

    // Equal close_time → strict `<` keeps the array-first member, regardless of distance.
    expect(result[0].poi.id).toBe('far')
    expect(result[0].reason.tieGroupSize).toBe(2)
    expect(result[0].reason.decidedByClose).toBe(false)
  })
})

// formatTime utility
describe('formatTime', () => {
  it('formats minutes to HH:MM', () => {
    expect(formatTime(540)).toBe('09:00')
    expect(formatTime(1020)).toBe('17:00')
  })

  it('clamps past midnight to 23:59+', () => {
    expect(formatTime(1500)).toBe('23:59+')
  })
})
