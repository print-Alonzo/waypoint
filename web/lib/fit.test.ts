import { describe, it, expect } from 'vitest'
import { fitToBudget } from './fit'
import type { ScheduledStop } from './scheduler'

const START = { lat: 14.58, lng: 120.98 }

// Coords default to START so the return-leg estimate is 0 — keeps makesItBack a
// clean function of departure vs budget. Override coords to exercise the return leg.
function stop(arrivalTime: number, departureTime: number, coords = START): ScheduledStop {
  return {
    poi: { id: 'x', lat: coords.lat, lng: coords.lng } as ScheduledStop['poi'],
    arrivalTime,
    departureTime,
    dwellMinutes: departureTime - arrivalTime,
    transitFromPrev: 0,
    yellowFlag: false,
    redFlag: false,
    reason: {
      prevName: null,
      minTransit: 0,
      maxTransit: 0,
      tieGroupSize: 1,
      decidedByClose: false,
      closeTime: '17:00',
    },
  }
}

describe('fitToBudget', () => {
  it('marks stops past the budget end without removing them', () => {
    // start 09:00 (540), budget 8h → ends 17:00 (1020).
    const stops = [stop(600, 660), stop(700, 760), stop(1100, 1160)]
    const fit = fitToBudget(stops, '09:00', 8, START, 'grab')
    expect(fit.endsAt).toBe(540 + 8 * 60)
    expect(fit.fits).toEqual([true, true, false])
    expect(fit.overflowCount).toBe(1)
    expect(fit.lastFitIndex).toBe(1)
  })

  it('reports makesItBack=false when the return leg overruns the budget', () => {
    // ends 10:00 (600). last in-budget stop departs 595; a far return pushes past 600.
    const far = { lat: 14.7, lng: 121.1 } // ~20 km away → minutes > 5 even by grab
    const stops = [stop(560, 595, far)]
    const fit = fitToBudget(stops, '09:00', 1, START, 'grab')
    expect(fit.lastFitIndex).toBe(0)
    expect(fit.returnMinutes).toBeGreaterThan(5)
    expect(fit.makesItBack).toBe(false)
  })

  it('makesItBack=true when everything fits with the return leg included', () => {
    const stops = [stop(600, 660), stop(700, 760)] // depart 760, return 0 (same coords)
    const fit = fitToBudget(stops, '09:00', 8, START, 'grab')
    expect(fit.overflowCount).toBe(0)
    expect(fit.returnMinutes).toBe(0)
    expect(fit.makesItBack).toBe(true)
  })

  it('makesItBack is true at the exact boundary (departure + return === endsAt)', () => {
    // ends 10:00 (600); stop departs 600, return 0 → 600 <= 600 must hold (locks the <=).
    const stops = [stop(560, 600)]
    const fit = fitToBudget(stops, '09:00', 1, START, 'grab')
    expect(fit.endsAt).toBe(600)
    expect(fit.returnMinutes).toBe(0)
    expect(fit.makesItBack).toBe(true)
  })

  it('handles a budget too small for any stop', () => {
    const stops = [stop(700, 760), stop(800, 860)]
    const fit = fitToBudget(stops, '09:00', 1, START, 'grab') // ends 600, both arrive later
    expect(fit.fits).toEqual([false, false])
    expect(fit.lastFitIndex).toBe(-1)
    expect(fit.makesItBack).toBe(false)
  })

  // Regression: a stop reached in time but lingered at (a long, possibly
  // user-edited dwell) past the budget's end must be flagged itself — not just
  // whichever later stop happens to inherit the delay.
  it('flags a stop whose arrival is in budget but whose long dwell overruns it', () => {
    // start 09:00 (540), budget 4h → ends 13:00 (780).
    // Arrives 10:00 (600, well within budget) but a 4h dwell departs at 14:00 (840).
    const stops = [stop(600, 840)]
    const fit = fitToBudget(stops, '09:00', 4, START, 'grab')
    expect(fit.fits).toEqual([false])
    expect(fit.overflowCount).toBe(1)
    expect(fit.lastFitIndex).toBe(-1)
    expect(fit.makesItBack).toBe(false)
  })

  it('once one stop overruns the budget via a long dwell, every later stop does too', () => {
    // start 09:00 (540), budget 5h → ends 14:00 (840).
    // Stop 1 arrives in budget (600) but a huge dwell departs well past it (900).
    // Stop 2 necessarily arrives even later, so it can't fit either.
    const stops = [stop(600, 900), stop(910, 940)]
    const fit = fitToBudget(stops, '09:00', 5, START, 'grab')
    expect(fit.fits).toEqual([false, false])
    expect(fit.overflowCount).toBe(2)
    expect(fit.lastFitIndex).toBe(-1)
  })
})
