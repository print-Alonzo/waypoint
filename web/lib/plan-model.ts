import type { ScheduleParams } from './params'
import type { ScheduledStop } from './scheduler'
import { optimizeOrder, scheduleAlong } from './scheduler'
import { POI_MAP, TRANSIT_MATRIX } from './data'
import { START_LOCATION_MAP, LUNCH_WINDOW } from './constants'
import { isEnabled } from './features'

// Resolve a plan's params into a concrete scheduled list — the SAME order + lunch
// resolution the result page uses, minus the placement/reason decoration the page
// needs for its "Why this stop" lines. Shared by the compare view and Live mode so
// they can never disagree with the result page on times. Pure; null on bad input.

export type ResolvedPlan = {
  startName: string
  coords: { lat: number; lng: number }
  stops: ScheduledStop[]
}

export function resolvePlan(params: ScheduleParams): ResolvedPlan | null {
  const start = START_LOCATION_MAP[params.start_location]
  if (!start) return null
  const coords = { lat: start.lat, lng: start.lng }

  const validIds = new Set<string>()
  const pois = []
  for (const id of params.poi_ids) {
    const p = POI_MAP[id]
    if (p && !validIds.has(id)) {
      validIds.add(id)
      pois.push(p)
    }
  }
  if (pois.length === 0) return null

  const defaultOrder = optimizeOrder(
    pois,
    new Set(),
    TRANSIT_MATRIX,
    params.start_location,
    coords,
    params.transport_mode,
  ).order.map((p) => p.id)

  let order: string[]
  if (params.order && params.order.length) {
    const fromUrl = [...new Set(params.order.filter((id) => validIds.has(id)))]
    order = [...fromUrl, ...defaultOrder.filter((id) => !fromUrl.includes(id))]
  } else {
    order = defaultOrder
  }

  // Honor the lunchBreak flag here too (the result page does), so Live mode and
  // Compare never apply a break the result page would ignore — the views stay in
  // agreement under every flag state, even for a preset/URL that carries lunch=1.
  const lunch =
    isEnabled('lunchBreak') && params.lunch
      ? { start: LUNCH_WINDOW.start, end: LUNCH_WINDOW.end }
      : null
  const stops = scheduleAlong(
    order.map((id) => POI_MAP[id]),
    TRANSIT_MATRIX,
    params.start_location,
    coords,
    params.start_time,
    params.transport_mode,
    params.day_of_week,
    undefined,
    lunch,
  )

  return { startName: start.name, coords, stops }
}
