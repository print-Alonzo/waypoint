import type { POI, TransportMode, LunchWindow, DurationOverrides } from '@/lib/scheduler'
import { optimizeOrder, scheduleAlong, parseTime } from '@/lib/scheduler'
import { TRANSIT_MATRIX } from '@/lib/data'
import { TRANSPORT_MODES } from '@/lib/constants'
import { dayFare, formatFare } from '@/lib/fare'
import { wallClock } from '@/lib/export'
import type { ScheduleParams } from '@/lib/params'

// "What if I travelled differently?" — the same set of places, re-optimized under
// each transport mode, distilled to comparable figures. Every number is recomputed
// by the real scheduler (never invented). Pure, so it's unit-testable and the
// component stays a thin renderer. NOTE: each variant is the AUTO-optimized order
// for that mode (locks/hand-arrangement are intentionally not applied), so the
// caller must NOT present any row as "your exact current plan".

export type WhatIfVariant = {
  mode: TransportMode
  endLabel: string
  spanHours: number
  flagged: number
  fare: string
}

export function computeWhatIfVariants(
  pois: POI[],
  params: ScheduleParams,
  coords: { lat: number; lng: number },
  lunch: LunchWindow | null,
  durations: DurationOverrides,
): WhatIfVariant[] {
  return TRANSPORT_MODES.map(({ value }) => {
    const mode = value as TransportMode
    const { order } = optimizeOrder(
      pois,
      new Set(),
      TRANSIT_MATRIX,
      params.start_location,
      coords,
      mode,
    )
    const stops = scheduleAlong(
      order,
      TRANSIT_MATRIX,
      params.start_location,
      coords,
      params.start_time,
      mode,
      params.day_of_week,
      undefined,
      lunch,
      durations,
    )
    const span = stops.length
      ? stops[stops.length - 1].departureTime - parseTime(params.start_time)
      : 0
    return {
      mode,
      endLabel: stops.length ? wallClock(stops[stops.length - 1].departureTime) : '—',
      spanHours: Math.max(1, Math.round(span / 60)),
      flagged: stops.filter((s) => s.yellowFlag || s.redFlag).length,
      fare: formatFare(dayFare(stops, mode)),
    }
  })
}
