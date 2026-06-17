import type { TransportMode } from './scheduler'

export type ScheduleParams = {
  poi_ids: string[]
  start_time: string
  transport_mode: TransportMode
  start_location: string
  day_of_week: string
}

const TIME_RE = /^\d{2}:\d{2}$/

export function encodeParams(params: ScheduleParams): URLSearchParams {
  const sp = new URLSearchParams()
  sp.set('poi_ids', params.poi_ids.join(','))
  sp.set('start_time', params.start_time)
  sp.set('transport_mode', params.transport_mode)
  sp.set('start_location', params.start_location)
  sp.set('day_of_week', params.day_of_week)
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

  return {
    poi_ids,
    start_time,
    transport_mode: transport_mode as TransportMode,
    start_location,
    day_of_week,
  }
}
