import type { ScheduleParams } from '@/lib/params'
import { parseTime } from '@/lib/scheduler'
import type { FareRange } from '@/lib/fare'
import { dayFare } from '@/lib/fare'
import { wallClock } from '@/lib/export'
import { resolvePlan } from '@/lib/plan-model'

// A compact, faithful summary of a plan for the compare view — built from the same
// resolved stops the result page and Live mode use, so the figures can't drift.

export type PlanSummary = {
  startName: string
  stopCount: number
  hours: number
  flagged: number
  endLabel: string
  fare: FareRange
  orderNames: string[]
}

export function summarizePlan(params: ScheduleParams): PlanSummary | null {
  const resolved = resolvePlan(params)
  if (!resolved) return null
  const { stops, startName } = resolved

  const span = stops[stops.length - 1].departureTime - parseTime(params.start_time)
  return {
    startName,
    stopCount: stops.length,
    hours: Math.max(1, Math.round(span / 60)),
    flagged: stops.filter((s) => s.yellowFlag || s.redFlag).length,
    endLabel: wallClock(stops[stops.length - 1].departureTime),
    fare: dayFare(stops, params.transport_mode),
    orderNames: stops.map((s) => s.poi.name),
  }
}
