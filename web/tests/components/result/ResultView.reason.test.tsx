// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

import ResultView from '@/components/result/ResultView'
import { encodeParams } from '@/lib/plan/params'
import { POI_MAP } from '@/lib/poi/data'
import type { ScheduledStop } from '@/lib/scheduling/scheduler'

// next/navigation mock — a fixed valid search string.
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

// Stub the schedule so we exercise the formatter-to-component seam for the
// tie-group reason copy WITHOUT depending on (placeholder) dataset specifics.
// ResultView now schedules via scheduleAlong, so that's the seam to stub;
// optimizeOrder (used to derive the order) and parseTime/types stay real.
const stubbed = vi.hoisted(() => ({ stops: [] as ScheduledStop[] }))
vi.mock('@/lib/scheduling/scheduler', async (importActual) => {
  const actual = (await importActual()) as typeof import('@/lib/scheduling/scheduler')
  return { ...actual, scheduleAlong: () => stubbed.stops }
})

describe('ResultView renders tie-group reason copy', () => {
  it('renders both the decided-by-close and the neutral shared-close sentences', () => {
    const a = POI_MAP['fort-santiago']
    const b = POI_MAP['casa-manila']

    stubbed.stops = [
      {
        poi: a,
        arrivalTime: 540,
        departureTime: 600,
        dwellMinutes: 60,
        transitFromPrev: 4,
        yellowFlag: false,
        redFlag: false,
        reason: {
          prevName: null,
          minTransit: 2,
          maxTransit: 5,
          tieGroupSize: 2,
          decidedByClose: true,
          closeTime: '17:00',
        },
      },
      {
        poi: b,
        arrivalTime: 640,
        departureTime: 700,
        dwellMinutes: 60,
        transitFromPrev: 6,
        yellowFlag: false,
        redFlag: false,
        reason: {
          prevName: a.name,
          minTransit: 1,
          maxTransit: 3,
          tieGroupSize: 2,
          decidedByClose: false,
          closeTime: '18:00',
        },
      },
    ]

    nav.search = encodeParams({
      poi_ids: ['fort-santiago', 'casa-manila'],
      start_time: '09:00',
      transport_mode: 'grab',
      start_location: 'rizal-park',
      day_of_week: 'Tuesday',
    }).toString()

    const { container } = render(<ResultView />)
    const text = container.textContent ?? ''

    expect(text).toContain('picked because it closes earliest, at 17:00.')
    expect(text).toContain('among the earliest-closing of these.')
  })
})

// The page must show the SAME wall clock the exports use for a past-midnight stop
// (true 01:00 (+1d)), not scheduler.formatTime's clamped "23:59+" — otherwise the
// visible page contradicts the copied text / .ics the user shares.
describe('ResultView renders past-midnight arrival as wall clock', () => {
  it('shows 01:00 (+1d) and never the clamped 23:59+', () => {
    const a = POI_MAP['fort-santiago']
    stubbed.stops = [
      {
        poi: a,
        arrivalTime: 1500, // 01:00 next day
        departureTime: 1560,
        dwellMinutes: 60,
        transitFromPrev: 6,
        yellowFlag: false,
        redFlag: false,
        reason: {
          prevName: null,
          minTransit: 6,
          maxTransit: 6,
          tieGroupSize: 1,
          decidedByClose: false,
          closeTime: '17:00',
        },
      },
    ]

    nav.search = encodeParams({
      poi_ids: ['fort-santiago'],
      start_time: '23:00',
      transport_mode: 'grab',
      start_location: 'rizal-park',
      day_of_week: 'Tuesday',
    }).toString()

    const { container } = render(<ResultView />)
    const text = container.textContent ?? ''
    expect(text).toContain('01:00 (+1d)')
    expect(text).not.toContain('23:59+')
  })
})
