// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

import ResultView from '@/components/ResultView'
import { encodeParams } from '@/lib/plan/params'
import { POI_MAP } from '@/lib/poi/data'
import { estimateTransitMinutes } from '@/lib/scheduling/scheduler'
import { START_LOCATION_MAP } from '@/lib/constants'
import type { ScheduledStop } from '@/lib/scheduling/scheduler'

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

// Stub the schedule so the arrival/departure that decide "fits" are exact and
// controllable, without depending on (or being flaked by) the async road-routing
// overlay. optimizeOrder/estimateTransitMinutes/types stay real.
const stubbed = vi.hoisted(() => ({ stops: [] as ScheduledStop[] }))
vi.mock('@/lib/scheduling/scheduler', async (importActual) => {
  const actual = (await importActual()) as typeof import('@/lib/scheduling/scheduler')
  return { ...actual, scheduleAlong: () => stubbed.stops }
})

beforeEach(() => {
  nav.push.mockClear()
  nav.replace.mockClear()
})

describe('ResultView budget: return-trip overrun on the last stop', () => {
  it('flags the last stop when its own visit fits the budget but getting home would not', () => {
    // The Mind Museum (BGC) is far enough from Rizal Park that the straight-line
    // return leg alone eats a meaningful chunk of the budget.
    const mm = POI_MAP['the-mind-museum']
    const sl = START_LOCATION_MAP['rizal-park']
    const returnMinutes = estimateTransitMinutes(
      { lat: mm.lat, lng: mm.lng },
      { lat: sl.lat, lng: sl.lng },
      'grab',
    )
    expect(returnMinutes).toBeGreaterThan(20) // sanity: this scenario needs a real return leg

    // start 09:00 (540); budget 6h -> endsAt 900. Arrive 728 (12:08), dwell 150 ->
    // departs 878 (14:38) — within budget — but 878 + returnMinutes overruns 900.
    stubbed.stops = [
      {
        poi: mm,
        arrivalTime: 728,
        departureTime: 878,
        dwellMinutes: 150,
        transitFromPrev: 30,
        yellowFlag: false,
        redFlag: false,
        reason: {
          prevName: null,
          minTransit: 30,
          maxTransit: 30,
          tieGroupSize: 1,
          decidedByClose: false,
          closeTime: mm.close_time,
        },
      },
    ]

    nav.search = encodeParams({
      poi_ids: ['the-mind-museum'],
      start_time: '09:00',
      transport_mode: 'grab',
      start_location: 'rizal-park',
      day_of_week: 'Saturday',
      budget: 6,
    }).toString()

    render(<ResultView />)

    expect(
      screen.getByText(/Getting back to Rizal Park from here may run past your 6h limit/),
    ).toBeInTheDocument()
    // The stop's own visit DOES fit — it should not also get the "beyond budget"
    // grey/badge treatment, which means something different (the visit itself
    // overruns, not just the trip home).
    expect(screen.queryByText('Beyond your 6h')).toBeNull()
  })

  it('does not show the return-trip hint when the day comfortably makes it back', () => {
    const mm = POI_MAP['the-mind-museum']
    stubbed.stops = [
      {
        poi: mm,
        arrivalTime: 600,
        departureTime: 630, // short visit, plenty of budget left for the trip home
        dwellMinutes: 30,
        transitFromPrev: 30,
        yellowFlag: false,
        redFlag: false,
        reason: {
          prevName: null,
          minTransit: 30,
          maxTransit: 30,
          tieGroupSize: 1,
          decidedByClose: false,
          closeTime: mm.close_time,
        },
      },
    ]

    nav.search = encodeParams({
      poi_ids: ['the-mind-museum'],
      start_time: '09:00',
      transport_mode: 'grab',
      start_location: 'rizal-park',
      day_of_week: 'Saturday',
      budget: 6,
    }).toString()

    render(<ResultView />)
    expect(screen.queryByText(/may run past your 6h limit/)).toBeNull()
  })
})
