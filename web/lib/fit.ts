import type { ScheduledStop, TransportMode } from './scheduler'
import { parseTime, estimateTransitMinutes } from './scheduler'

// "Fit my day to N hours" — a faithful time-budget overlay. It NEVER drops a stop:
// it marks which stops fall outside the budget and whether you'd make it back to
// your start in time. The list still shows every stop you picked (greyed when
// out of budget), extending Waypoint's transparency thesis from closed/unreachable
// to time. Pure (no DOM) so the wording in ResultView is driven by tested data.

export type FitResult = {
  budgetMinutes: number
  endsAt: number // start + budget, in minutes from midnight
  // Per stop (index-aligned with the input): does its arrival land within budget?
  fits: boolean[]
  lastFitIndex: number // last in-budget stop, or -1 if none fit
  overflowCount: number // how many stops fall outside the budget
  returnMinutes: number // estimated transit from the last in-budget stop back to start
  // Could you finish the last in-budget stop AND get back to start within budget?
  makesItBack: boolean
}

// `stops` must be the already-scheduled list (lunch shifts included). `startCoords`
// is the trip's start location; the return leg is estimated straight-line because
// the matrix has no POI→start row.
export function fitToBudget(
  stops: ScheduledStop[],
  startTime: string,
  budgetHours: number,
  startCoords: { lat: number; lng: number },
  mode: TransportMode,
): FitResult {
  const start = parseTime(startTime)
  const budgetMinutes = Math.max(0, Math.round(budgetHours * 60))
  const endsAt = start + budgetMinutes

  // A stop "fits" when you'd arrive at or before your budget runs out.
  const fits = stops.map((s) => s.arrivalTime <= endsAt)
  let lastFitIndex = -1
  for (let i = 0; i < fits.length; i++) if (fits[i]) lastFitIndex = i
  const overflowCount = fits.filter((f) => !f).length

  if (lastFitIndex === -1) {
    return { budgetMinutes, endsAt, fits, lastFitIndex, overflowCount, returnMinutes: 0, makesItBack: false }
  }

  const last = stops[lastFitIndex]
  const returnMinutes = estimateTransitMinutes(
    { lat: last.poi.lat, lng: last.poi.lng },
    startCoords,
    mode,
  )
  const makesItBack = last.departureTime + returnMinutes <= endsAt

  return { budgetMinutes, endsAt, fits, lastFitIndex, overflowCount, returnMinutes, makesItBack }
}
