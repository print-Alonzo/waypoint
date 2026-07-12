import type { TransportMode, DurationOverrides } from '@/lib/scheduling/scheduler'
import { encodeDurations, parseDurations } from '@/lib/scheduling/duration'

export type ScheduleParams = {
  poi_ids: string[]
  start_time: string
  transport_mode: TransportMode
  start_location: string
  day_of_week: string
  // Result-page customization (optional; absent ⇒ the auto-optimized order).
  // `order` is the explicit visit sequence; `locked` is the subset pinned in place.
  order?: string[]
  locked?: string[]
  // Power-feature view state (optional; absent ⇒ feature inactive for this plan):
  // `budget` is the "fit my day to N hours" limit in whole hours; `lunch` reserves
  // a midday break. Kept in the URL so a budgeted/lunch plan is shareable + refresh-safe.
  budget?: number
  lunch?: boolean
  // Per-stop "Time here" overrides (minutes), keyed by POI id. Absent id ⇒ the POI's
  // authored recommended_duration_minutes. Kept in the URL for the same shareable /
  // refresh-safe reason as order/locked/budget/lunch.
  durations?: DurationOverrides
}

const TIME_RE = /^\d{2}:\d{2}$/

export function encodeParams(params: ScheduleParams): URLSearchParams {
  const sp = new URLSearchParams()
  sp.set('poi_ids', params.poi_ids.join(','))
  sp.set('start_time', params.start_time)
  sp.set('transport_mode', params.transport_mode)
  sp.set('start_location', params.start_location)
  sp.set('day_of_week', params.day_of_week)
  // Only emit the customization params when present, so a default plan keeps its
  // clean URL and the params.test base round-trip is unaffected.
  if (params.order && params.order.length) sp.set('order', params.order.join(','))
  if (params.locked && params.locked.length) sp.set('locked', params.locked.join(','))
  if (typeof params.budget === 'number' && params.budget > 0)
    sp.set('budget', String(params.budget))
  if (params.lunch) sp.set('lunch', '1')
  if (params.durations && Object.keys(params.durations).length)
    sp.set('dur', encodeDurations(params.durations))
  return sp
}

export function decodeParams(sp: URLSearchParams): ScheduleParams | null {
  const poi_ids_raw = sp.get('poi_ids')
  const start_time = sp.get('start_time')
  const transport_mode = sp.get('transport_mode')
  const start_location = sp.get('start_location')
  const day_of_week = sp.get('day_of_week')

  if (!poi_ids_raw || !start_time || !transport_mode || !start_location || !day_of_week) return null
  if (!TIME_RE.test(start_time)) return null

  const poi_ids = poi_ids_raw.split(',').filter(Boolean)
  if (poi_ids.length === 0) return null

  const params: ScheduleParams = {
    poi_ids,
    start_time,
    transport_mode: transport_mode as TransportMode,
    start_location,
    day_of_week,
  }

  const order = sp.get('order')?.split(',').filter(Boolean)
  if (order && order.length) params.order = order
  const locked = sp.get('locked')?.split(',').filter(Boolean)
  if (locked && locked.length) params.locked = locked

  // budget: a positive whole-hour limit; anything else (0, NaN, negative) is ignored.
  const budgetRaw = sp.get('budget')
  if (budgetRaw !== null) {
    const budget = Number(budgetRaw)
    if (Number.isFinite(budget) && budget > 0) params.budget = Math.floor(budget)
  }
  if (sp.get('lunch') === '1') params.lunch = true

  const durRaw = sp.get('dur')
  if (durRaw) {
    const durations = parseDurations(durRaw)
    if (Object.keys(durations).length) params.durations = durations
  }

  return params
}
