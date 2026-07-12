// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import ResultView from '@/components/ResultView'
import { encodeParams } from '@/lib/plan/params'
import type { ScheduleParams } from '@/lib/plan/params'
import { scheduleAlong } from '@/lib/scheduling/scheduler'
import { POI_MAP, TRANSIT_MATRIX } from '@/lib/poi/data'
import { START_LOCATION_MAP } from '@/lib/constants'
import { wallClock } from '@/lib/plan/export'
import { mergeTransitMatrix, roadTransitMinutes } from '@/lib/scheduling/routing'
import type { TransitMatrix } from '@/lib/scheduling/scheduler'

// next/navigation mock — mirrors scheduler-integration.test.tsx's setup.
const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), search: '' }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: nav.push,
    replace: nav.replace,
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(nav.search),
  usePathname: () => '/',
}))

const ORIGINAL_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

function mapboxResponse(distanceMeters: number) {
  return {
    routes: [
      {
        distance: distanceMeters,
        geometry: {
          coordinates: [
            [120.9794, 14.5831],
            [120.9718, 14.5944],
          ],
        },
      },
    ],
  }
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN = 'test-token'
  nav.push.mockClear()
  nav.replace.mockClear()
})

afterEach(() => {
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN = ORIGINAL_TOKEN
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// Single POI ⇒ exactly one leg (start -> fort-santiago), so the visit order is
// unambiguous and the overlay we hand-build can't drift from what optimizeOrder
// would actually pick.
const params: ScheduleParams = {
  poi_ids: ['fort-santiago'],
  start_time: '09:00',
  transport_mode: 'walk',
  start_location: 'rizal-park',
  day_of_week: 'Tuesday',
}

describe('result view road routing', () => {
  it('recomputes the arrival time from the resolved road distance', async () => {
    nav.search = encodeParams(params).toString()

    // A fixed 3km road distance — deterministically different from the static
    // (haversine-precomputed) matrix entry the page would otherwise use.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mapboxResponse(3000)),
    })
    vi.stubGlobal('fetch', fetchMock)

    const start = START_LOCATION_MAP[params.start_location]
    const fortSantiago = POI_MAP['fort-santiago']
    const roadMinutes = roadTransitMinutes(3, 'walk')
    const overlay: TransitMatrix = {
      [params.start_location]: {
        'fort-santiago': { walk: roadMinutes, jeepney: roadMinutes, grab: roadMinutes },
      },
    }
    const merged = mergeTransitMatrix(TRANSIT_MATRIX, overlay)
    const [expectedStop] = scheduleAlong(
      [fortSantiago],
      merged,
      params.start_location,
      { lat: start.lat, lng: start.lng },
      params.start_time,
      params.transport_mode,
      params.day_of_week,
    )
    // Sanity check the fixture actually exercises a different time than the
    // static matrix would — otherwise this test would pass even if the overlay
    // were silently ignored.
    const [staticStop] = scheduleAlong(
      [fortSantiago],
      TRANSIT_MATRIX,
      params.start_location,
      { lat: start.lat, lng: start.lng },
      params.start_time,
      params.transport_mode,
      params.day_of_week,
    )
    expect(expectedStop.arrivalTime).not.toBe(staticStop.arrivalTime)

    const { container } = render(<ResultView />)

    await waitFor(() => {
      expect(container.textContent ?? '').toContain(wallClock(expectedStop.arrivalTime))
    })

    // The effect must not refetch once its own result is applied — `model` is
    // recreated when roadOverlay updates, and a naive effect keyed on that
    // object would loop (fetch -> setState -> new model -> refetch -> ...).
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to the static matrix time when every leg fails to resolve', async () => {
    // A different POI (own leg = own cache key) so this test's failing fetch
    // isn't short-circuited by the previous test's cached successful route.
    const failParams: ScheduleParams = { ...params, poi_ids: ['casa-manila'] }
    nav.search = encodeParams(failParams).toString()
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) })
    vi.stubGlobal('fetch', fetchMock)

    const start = START_LOCATION_MAP[failParams.start_location]
    const [staticStop] = scheduleAlong(
      [POI_MAP['casa-manila']],
      TRANSIT_MATRIX,
      failParams.start_location,
      { lat: start.lat, lng: start.lng },
      failParams.start_time,
      failParams.transport_mode,
      failParams.day_of_week,
    )

    const { container } = render(<ResultView />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(container.textContent ?? '').toContain(wallClock(staticStop.arrivalTime))
  })
})
