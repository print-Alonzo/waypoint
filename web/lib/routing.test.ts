import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  modeToProfile,
  roadTransitMinutes,
  isRoadRoutingConfigured,
  mergeTransitMatrix,
  fetchLegRoute,
  fetchRoadOverlay,
} from './routing'
import { estimateTransitMinutes } from './scheduler'
import type { TransitMatrix } from './scheduler'

const ORIGINAL_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

function mockFetchOnce(body: unknown, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(body),
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function mapboxResponse(distanceMeters: number, coords: [number, number][]) {
  return { routes: [{ distance: distanceMeters, geometry: { coordinates: coords } }] }
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN = 'test-token'
})

afterEach(() => {
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN = ORIGINAL_TOKEN
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('modeToProfile', () => {
  it('maps walk to walking, jeepney/grab to driving', () => {
    expect(modeToProfile('walk')).toBe('walking')
    expect(modeToProfile('jeepney')).toBe('driving')
    expect(modeToProfile('grab')).toBe('driving')
  })
})

describe('roadTransitMinutes', () => {
  it('matches the scheduler speed model (distance / speed, ceil to minutes)', () => {
    // 4 km/h walk speed -> 1 km takes exactly 15 min, so nudge past it to exercise ceil.
    expect(roadTransitMinutes(1.01, 'walk')).toBe(Math.ceil((1.01 / 4) * 60))
    expect(roadTransitMinutes(5, 'grab')).toBe(Math.ceil((5 / 20) * 60))
  })
})

describe('isRoadRoutingConfigured', () => {
  it('is true when a token is set, false otherwise', () => {
    expect(isRoadRoutingConfigured()).toBe(true)
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = ''
    expect(isRoadRoutingConfigured()).toBe(false)
    delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    expect(isRoadRoutingConfigured()).toBe(false)
  })
})

describe('mergeTransitMatrix', () => {
  it('overlays entries on top of the base, falling through where absent', () => {
    const base: TransitMatrix = {
      a: { b: { walk: 10, jeepney: 6, grab: 4 }, c: { walk: 20, jeepney: 12, grab: 8 } },
    }
    const overlay: TransitMatrix = { a: { b: { walk: 9, jeepney: 9, grab: 9 } } }
    const merged = mergeTransitMatrix(base, overlay)
    expect(merged.a.b).toEqual({ walk: 9, jeepney: 9, grab: 9 }) // overlay wins
    expect(merged.a.c).toEqual({ walk: 20, jeepney: 12, grab: 8 }) // untouched pair falls through
  })

  it('does not mutate the base matrix', () => {
    const base: TransitMatrix = { a: { b: { walk: 10, jeepney: 6, grab: 4 } } }
    const overlay: TransitMatrix = { a: { b: { walk: 1, jeepney: 1, grab: 1 } } }
    mergeTransitMatrix(base, overlay)
    expect(base.a.b).toEqual({ walk: 10, jeepney: 6, grab: 4 })
  })
})

describe('fetchLegRoute', () => {
  const from = { lat: 14.58, lng: 120.97 }

  it('returns null when no token is configured (and never calls fetch)', async () => {
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = ''
    const fetchMock = mockFetchOnce(mapboxResponse(1000, [[120.97, 14.58], [120.98, 14.59]]))
    const result = await fetchLegRoute(from, { lat: 14.581, lng: 120.971 }, 'walk')
    expect(result).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns null on a non-ok response', async () => {
    mockFetchOnce({}, false)
    const result = await fetchLegRoute(from, { lat: 14.582, lng: 120.972 }, 'walk')
    expect(result).toBeNull()
  })

  it('returns null when the response has no usable route', async () => {
    mockFetchOnce({ routes: [] })
    const result = await fetchLegRoute(from, { lat: 14.583, lng: 120.973 }, 'walk')
    expect(result).toBeNull()
  })

  it('parses a valid route: flips [lng,lat] to [lat,lng] and converts meters to km', async () => {
    mockFetchOnce(mapboxResponse(2500, [[120.97, 14.58], [120.975, 14.585], [120.98, 14.59]]))
    const result = await fetchLegRoute(from, { lat: 14.59, lng: 120.98 }, 'walk')
    expect(result).not.toBeNull()
    expect(result!.distanceKm).toBe(2.5)
    expect(result!.geometry).toEqual([
      [14.58, 120.97],
      [14.585, 120.975],
      [14.59, 120.98],
    ])
  })

  it('caches a resolved route: a second identical call does not refetch', async () => {
    const fetchMock = mockFetchOnce(mapboxResponse(1000, [[120.97, 14.58], [120.99, 14.6]]))
    const to = { lat: 14.6, lng: 120.99 }
    const first = await fetchLegRoute(from, to, 'walk')
    const second = await fetchLegRoute(from, to, 'walk')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(second).toEqual(first)
  })
})

describe('fetchRoadOverlay', () => {
  it('builds an overlay matrix (active mode from road distance, others from haversine) and geometry array', async () => {
    const start = { lat: 14.5831, lng: 120.9794 }
    const poiA = { lat: 14.59, lng: 120.98 }
    const poiB = { lat: 14.6, lng: 120.99 }

    const fetchMock = vi
      .fn()
      // leg 1: start -> a
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mapboxResponse(1000, [[120.9794, 14.5831], [120.98, 14.59]])),
      })
      // leg 2: a -> b (fails, e.g. no route found)
      .mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({}) })
    vi.stubGlobal('fetch', fetchMock)

    const legs = [
      { fromId: 'start', toId: 'a', from: start, to: poiA },
      { fromId: 'a', toId: 'b', from: poiA, to: poiB },
    ]
    const { overlayMatrix, legGeometry } = await fetchRoadOverlay(legs, 'grab')

    // Leg 1 resolved: overlay entry present, grab = road-derived, others = haversine.
    expect(overlayMatrix.start.a.grab).toBe(roadTransitMinutes(1, 'grab'))
    expect(overlayMatrix.start.a.walk).toBe(estimateTransitMinutes(start, poiA, 'walk'))
    expect(overlayMatrix.start.a.jeepney).toBe(estimateTransitMinutes(start, poiA, 'jeepney'))
    expect(legGeometry[0]).toEqual([
      [14.5831, 120.9794],
      [14.59, 120.98],
    ])

    // Leg 2 failed: absent from the overlay, null in geometry — caller falls back.
    expect(overlayMatrix.a).toBeUndefined()
    expect(legGeometry[1]).toBeNull()
  })
})
