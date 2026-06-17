export type POI = {
  id: string
  name: string
  category: string
  lat: number
  lng: number
  open_time: string
  close_time: string
  closed_days: string[]
  recommended_duration_minutes: number
  notes: string | null
}

export type TransitMatrix = {
  [originId: string]: {
    [destId: string]: {
      walk: number
      jeepney: number
      grab: number
      _note?: string
    }
  }
}

export type TransportMode = 'walk' | 'jeepney' | 'grab'

export type ScheduledStop = {
  poi: POI
  arrivalTime: number
  departureTime: number
  transitFromPrev: number
  yellowFlag: boolean
  redFlag: boolean
}

export function parseTime(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function formatTime(minutes: number): string {
  const clamped = Math.min(minutes, 1439)
  const suffix = minutes > 1439 ? '+' : ''
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}${suffix}`
}

const SPEED_KMH: Record<TransportMode, number> = { walk: 4, jeepney: 12, grab: 20 }

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
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

function getTransitTime(
  matrix: TransitMatrix,
  fromId: string,
  toId: string,
  mode: TransportMode,
  fromCoords: { lat: number; lng: number },
  toCoords: { lat: number; lng: number },
): number {
  const entry = matrix[fromId]?.[toId]
  if (entry) return entry[mode]

  console.warn('Missing transit matrix entry', { from: fromId, to: toId, mode })
  const distKm = haversineKm(fromCoords.lat, fromCoords.lng, toCoords.lat, toCoords.lng)
  return Math.ceil((distKm / SPEED_KMH[mode]) * 60)
}

function selectNext(
  candidates: Array<{ poi: POI; transit: number }>,
): { poi: POI; transit: number } {
  const minTransit = Math.min(...candidates.map((c) => c.transit))
  const tieGroup = candidates.filter((c) => c.transit - minTransit < 5)

  return tieGroup.reduce((best, curr) =>
    parseTime(curr.poi.close_time) < parseTime(best.poi.close_time) ? curr : best,
  )
}

export function scheduleItinerary(
  selectedPOIs: POI[],
  transitMatrix: TransitMatrix,
  startLocationId: string,
  startLocationCoords: { lat: number; lng: number },
  startTime: string,
  transportMode: TransportMode,
  dayOfWeek: string,
): ScheduledStop[] {
  if (selectedPOIs.length === 0) return []

  const startMinutes = parseTime(startTime)

  // Step 0: find first stop (nearest from start location)
  const step0Candidates = selectedPOIs.map((poi) => ({
    poi,
    transit: getTransitTime(
      transitMatrix,
      startLocationId,
      poi.id,
      transportMode,
      startLocationCoords,
      poi,
    ),
  }))

  const first = selectNext(step0Candidates)
  const unvisited = new Set(selectedPOIs.map((p) => p.id))
  unvisited.delete(first.poi.id)

  const result: ScheduledStop[] = []

  const firstArrival = startMinutes + first.transit
  const firstDeparture = firstArrival + Math.max(first.poi.recommended_duration_minutes, 1)
  result.push({
    poi: first.poi,
    arrivalTime: firstArrival,
    departureTime: firstDeparture,
    transitFromPrev: first.transit,
    yellowFlag: firstArrival > parseTime(first.poi.close_time),
    redFlag: first.poi.closed_days.includes(dayOfWeek),
  })

  let prevPoi = first.poi
  let currentTime = firstDeparture

  while (unvisited.size > 0) {
    const candidates = selectedPOIs
      .filter((p) => unvisited.has(p.id))
      .map((poi) => ({
        poi,
        transit: getTransitTime(
          transitMatrix,
          prevPoi.id,
          poi.id,
          transportMode,
          prevPoi,
          poi,
        ),
      }))

    const next = selectNext(candidates)
    unvisited.delete(next.poi.id)

    const arrival = currentTime + next.transit
    const departure = arrival + Math.max(next.poi.recommended_duration_minutes, 1)
    result.push({
      poi: next.poi,
      arrivalTime: arrival,
      departureTime: departure,
      transitFromPrev: next.transit,
      yellowFlag: arrival > parseTime(next.poi.close_time),
      redFlag: next.poi.closed_days.includes(dayOfWeek),
    })

    prevPoi = next.poi
    currentTime = departure
  }

  return result
}
