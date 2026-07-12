import type { TransitMatrix, TransportMode } from '@/lib/scheduling/scheduler'
import { estimateTransitMinutes, SPEED_KMH } from '@/lib/scheduling/scheduler'

// Runtime road-routing: fetches real road geometry + distance from the Mapbox
// Directions API (client-side, CORS-enabled) so the map can draw an actual route
// instead of a straight line, and travel time can be driven by how long that route
// is. Every function here degrades to `null` on any failure (missing token, network
// error, no route found) — callers fall back to the existing haversine model, so
// the app works exactly as before when routing is unavailable.

type Coords = { lat: number; lng: number }

type LegRoute = {
  // Leaflet-ready [lat, lng] pairs, in travel order.
  geometry: [number, number][]
  distanceKm: number
}

const MAPBOX_PROFILE: Record<TransportMode, 'walking' | 'driving'> = {
  walk: 'walking',
  jeepney: 'driving',
  grab: 'driving',
}

export function modeToProfile(mode: TransportMode): 'walking' | 'driving' {
  return MAPBOX_PROFILE[mode]
}

function mapboxToken(): string | null {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  return token ? token : null
}

// Whether road routing can run at all in this build (a token is configured). Lets
// the UI skip showing a "refining routes…" message when routing was never possible.
export function isRoadRoutingConfigured(): boolean {
  return mapboxToken() !== null
}

// Layers road-derived entries over the static matrix: an overlay pair replaces the
// static one; everything the overlay doesn't cover falls through unchanged.
export function mergeTransitMatrix(base: TransitMatrix, overlay: TransitMatrix): TransitMatrix {
  const merged: TransitMatrix = { ...base }
  for (const fromId of Object.keys(overlay)) {
    merged[fromId] = { ...merged[fromId], ...overlay[fromId] }
  }
  return merged
}

export function roadTransitMinutes(distanceKm: number, mode: TransportMode): number {
  return Math.ceil((distanceKm / SPEED_KMH[mode]) * 60)
}

const FETCH_TIMEOUT_MS = 6000

// Only successful lookups are cached — a transient failure shouldn't permanently
// pin a leg to the straight-line fallback for the rest of the session.
const routeCache = new Map<string, LegRoute>()

function cacheKey(from: Coords, to: Coords, profile: string): string {
  return `${profile}:${from.lat},${from.lng}|${to.lat},${to.lng}`
}

export async function fetchLegRoute(
  from: Coords,
  to: Coords,
  mode: TransportMode,
): Promise<LegRoute | null> {
  const token = mapboxToken()
  if (!token) return null

  const profile = modeToProfile(mode)
  const key = cacheKey(from, to, profile)
  const cached = routeCache.get(key)
  if (cached) return cached

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}` +
      `?geometries=geojson&overview=full&access_token=${token}`
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return null

    const data = await res.json()
    const route = data?.routes?.[0]
    const coordinates: [number, number][] | undefined = route?.geometry?.coordinates
    if (!route || !Array.isArray(coordinates) || coordinates.length < 2) return null

    // Mapbox emits [lng, lat]; Leaflet wants [lat, lng].
    const geometry: [number, number][] = coordinates.map(([lng, lat]) => [lat, lng])
    const result: LegRoute = { geometry, distanceKm: route.distance / 1000 }
    routeCache.set(key, result)
    return result
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// One leg of the visit-order sequence (previous stop/start -> this stop), carrying
// the ids the schedule overlay is keyed by alongside the coords the router needs.
export type RouteLeg = {
  fromId: string
  toId: string
  from: Coords
  to: Coords
}

export type RoadOverlay = {
  // Layer over TRANSIT_MATRIX: only entries for legs that resolved to a real route.
  overlayMatrix: TransitMatrix
  // Index-aligned with `legs`: leg i's road geometry, or null when it fell back.
  legGeometry: (LegRoute['geometry'] | null)[]
}

// Fetches a road route for every leg (in parallel) and assembles both the schedule
// overlay (road distance -> minutes for the active mode) and the geometry the map
// draws. Legs with no resolvable route are simply absent from the overlay / null in
// legGeometry — getTransitTime and MapView already know how to fall back per-leg.
export async function fetchRoadOverlay(
  legs: RouteLeg[],
  mode: TransportMode,
): Promise<RoadOverlay> {
  const routes = await Promise.all(legs.map((leg) => fetchLegRoute(leg.from, leg.to, mode)))

  const overlayMatrix: TransitMatrix = {}
  const legGeometry: (LegRoute['geometry'] | null)[] = []

  routes.forEach((route, i) => {
    const { fromId, toId, from, to } = legs[i]
    legGeometry.push(route?.geometry ?? null)
    if (!route) return

    const minutes = roadTransitMinutes(route.distanceKm, mode)
    // Only `mode` reflects the fetched road distance; the other two modes never get
    // read for this render (schedule + overlay are rebuilt whenever mode changes),
    // but honest haversine values keep the matrix entry itself truthful.
    const entry = {
      walk: mode === 'walk' ? minutes : estimateTransitMinutes(from, to, 'walk'),
      jeepney: mode === 'jeepney' ? minutes : estimateTransitMinutes(from, to, 'jeepney'),
      grab: mode === 'grab' ? minutes : estimateTransitMinutes(from, to, 'grab'),
    }
    if (!overlayMatrix[fromId]) overlayMatrix[fromId] = {}
    overlayMatrix[fromId][toId] = entry
  })

  return { overlayMatrix, legGeometry }
}
