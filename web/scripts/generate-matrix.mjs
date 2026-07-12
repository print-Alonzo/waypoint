// Generates data/<city>/transit-matrix.json from pois.json by computing Haversine
// distance between every origin/destination pair and dividing by a per-mode speed.
//
// This MUST stay consistent with the scheduler's fallback math in lib/scheduling/scheduler.ts
// (haversineKm + Math.ceil((distKm / speed) * 60), speeds walk 4 / jeepney 12 / grab 20),
// so generated values agree with what the scheduler would compute for a missing pair.
//
// Rows emitted (one-directional, per spec):
//   - landmark -> every POI
//   - POI      -> every other POI
// POI -> landmark rows are NOT emitted (a route ends at the last POI, never a landmark).
//
// Run with: npm run gen:matrix

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CITY = process.env.NEXT_PUBLIC_CITY ?? 'metro-manila'
const DATA_DIR = join(__dirname, '..', 'data', CITY)

// Keep in sync with START_LOCATIONS in lib/constants.ts (origin landmarks).
const START_LOCATIONS = [
  { id: 'rizal-park', lat: 14.5831, lng: 120.9794 },
  { id: 'manila-hotel', lat: 14.5867, lng: 120.9758 },
  { id: 'sm-mall-of-asia', lat: 14.5352, lng: 120.9822 },
  { id: 'intramuros-gate', lat: 14.5896, lng: 120.9789 },
  { id: 'naia-terminal-3', lat: 14.5086, lng: 121.0197 },
]

// Keep in sync with SPEED_KMH in lib/scheduling/scheduler.ts.
const SPEED_KMH = { walk: 4, jeepney: 12, grab: 20 }

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function transitTimes(from, to) {
  const distKm = haversineKm(from.lat, from.lng, to.lat, to.lng)
  const times = {}
  for (const mode of Object.keys(SPEED_KMH)) {
    times[mode] = Math.ceil((distKm / SPEED_KMH[mode]) * 60)
  }
  return times
}

const pois = JSON.parse(readFileSync(join(DATA_DIR, 'pois.json'), 'utf8'))

const matrix = {}

// Landmark -> every POI
for (const landmark of START_LOCATIONS) {
  matrix[landmark.id] = {}
  for (const poi of pois) {
    matrix[landmark.id][poi.id] = transitTimes(landmark, poi)
  }
}

// POI -> every other POI
for (const from of pois) {
  matrix[from.id] = {}
  for (const to of pois) {
    if (from.id === to.id) continue
    matrix[from.id][to.id] = transitTimes(from, to)
  }
}

const outPath = join(DATA_DIR, 'transit-matrix.json')
writeFileSync(outPath, JSON.stringify(matrix, null, 2) + '\n')

const originCount = Object.keys(matrix).length
const pairCount = Object.values(matrix).reduce((n, row) => n + Object.keys(row).length, 0)
console.log(
  `Wrote ${outPath}\n  ${originCount} origins (${START_LOCATIONS.length} landmarks + ${pois.length} POIs), ${pairCount} pairs`,
)
