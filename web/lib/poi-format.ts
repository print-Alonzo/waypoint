import type { POI } from './scheduler'

// Short "open–close · closed days" label shown under a POI's name on cards and in
// the swipe deck. Kept here (pure, no JSX) so the grid card and the deck agree.
export function hoursLabel(poi: POI): string {
  const hours = `${poi.open_time}–${poi.close_time}`
  if (poi.closed_days.length === 0) return hours
  if (poi.closed_days.length > 3) return `${hours} · select days only`
  return `${hours} · closed ${poi.closed_days.join(', ')}`
}
