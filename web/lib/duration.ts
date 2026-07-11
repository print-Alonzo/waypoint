import type { POI, DurationOverrides } from './scheduler'

// Bounds for the per-stop "Time here" stepper. MAX matches the dataset-authoring cap in
// lib/poi-validate.ts (600) so the trip editor and the admin form can never disagree.
export const DURATION_MIN = 15
export const DURATION_MAX = 600
export const DURATION_STEP = 15

export function clampDuration(mins: number): number {
  return Math.min(DURATION_MAX, Math.max(DURATION_MIN, Math.round(mins)))
}

// "fort-santiago:120,quiapo-market:30" — stable (sorted) key order so the same plan
// always produces the same URL (saved-plan dedupe + tests depend on this).
export function encodeDurations(d: DurationOverrides): string {
  return Object.keys(d)
    .sort()
    .map((id) => `${id}:${d[id]}`)
    .join(',')
}

// Defensive, mirrors decodeParams' style: split on ',', then ':'. Drops any entry that
// is malformed, non-finite, or <= 0. Clamps valid numbers into range. Never throws.
export function parseDurations(raw: string): DurationOverrides {
  const out: DurationOverrides = {}
  for (const pair of raw.split(',')) {
    const idx = pair.indexOf(':')
    if (idx <= 0) continue
    const id = pair.slice(0, idx)
    const mins = Number(pair.slice(idx + 1))
    if (!id || !Number.isFinite(mins) || mins <= 0) continue
    out[id] = clampDuration(mins)
  }
  return out
}

// Drop ids not in `pois`, and drop any value equal to that POI's
// recommended_duration_minutes (an override that matches the default is not an
// override — keeps the URL clean and makes the "edited?" check a simple key lookup).
export function pruneDurations(d: DurationOverrides, pois: POI[]): DurationOverrides {
  const poiById = new Map(pois.map((p) => [p.id, p]))
  const out: DurationOverrides = {}
  for (const [id, mins] of Object.entries(d)) {
    const poi = poiById.get(id)
    if (poi && mins !== poi.recommended_duration_minutes) out[id] = mins
  }
  return out
}
