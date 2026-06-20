// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import Selector from '@/components/Selector'
import ResultView from '@/components/ResultView'
import { encodeParams } from '@/lib/params'
import type { ScheduleParams } from '@/lib/params'
import { scheduleItinerary } from '@/lib/scheduler'
import type { POI } from '@/lib/scheduler'
import { POI_MAP, TRANSIT_MATRIX } from '@/lib/data'
import { START_LOCATION_MAP } from '@/lib/constants'

// next/navigation mock — spies + a mutable search string controlled per test.
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

function queryFrom(call: string): URLSearchParams {
  return new URLSearchParams(call.split('?')[1] ?? '')
}

beforeEach(() => {
  nav.push.mockClear()
  nav.replace.mockClear()
  nav.search = ''
})

// (1) Selector submit encodes the selection into the pushed URL.
describe('selector submit', () => {
  it('pushes /result with correctly encoded params for 2 selected POIs', () => {
    render(<Selector />)

    fireEvent.click(screen.getByRole('checkbox', { name: /Fort Santiago/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Casa Manila/ }))
    fireEvent.click(screen.getByRole('button', { name: /Plan my day/ }))

    expect(nav.push).toHaveBeenCalledTimes(1)
    const url = nav.push.mock.calls[0][0] as string
    expect(url.startsWith('/result?')).toBe(true)

    const sp = queryFrom(url)
    // Dataset order is preserved: fort-santiago precedes casa-manila.
    expect(sp.get('poi_ids')).toBe('fort-santiago,casa-manila')
    expect(sp.get('start_time')).toBe('09:00')
    expect(sp.get('transport_mode')).toBe('grab')
    expect(sp.get('start_location')).toBe('rizal-park')
    expect(sp.get('day_of_week')).toBe('Saturday')
  })

  it('keeps the CTA disabled until at least one POI is selected', () => {
    render(<Selector />)
    const cta = screen.getByRole('button', { name: /Select places to plan your day/ })
    expect(cta).toBeDisabled()
  })
})

// (2) Result view renders the scheduled stops, in order, for a valid URL.
describe('result view (valid URL)', () => {
  it('renders itinerary rows in scheduled order and does not redirect', () => {
    const params: ScheduleParams = {
      poi_ids: ['fort-santiago', 'manila-cathedral', 'quiapo-market'],
      start_time: '09:00',
      transport_mode: 'walk',
      start_location: 'rizal-park',
      day_of_week: 'Tuesday',
    }
    nav.search = encodeParams(params).toString()

    // Expected order from the real scheduler.
    const selected = params.poi_ids.map((id) => POI_MAP[id]).filter(Boolean) as POI[]
    const start = START_LOCATION_MAP[params.start_location]
    const expected = scheduleItinerary(
      selected,
      TRANSIT_MATRIX,
      params.start_location,
      { lat: start.lat, lng: start.lng },
      params.start_time,
      params.transport_mode,
      params.day_of_week,
    ).map((s) => s.poi.name)

    const { container } = render(<ResultView />)

    expect(nav.replace).not.toHaveBeenCalled()
    const text = container.textContent ?? ''
    expected.forEach((name) => expect(text).toContain(name))
    // Document order matches scheduled order.
    const positions = expected.map((name) => text.indexOf(name))
    const sorted = [...positions].sort((a, b) => a - b)
    expect(positions).toEqual(sorted)
  })
})

// (3) Invalid/empty URL redirects back to the selector.
describe('result view (invalid URL)', () => {
  it('calls router.replace("/") when params are missing', async () => {
    nav.search = ''
    render(<ResultView />)
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/'))
  })
})

// (4) "Edit this list" navigates to / with prefilling params.
describe('edit back-link', () => {
  it('pushes / with the current params so the selector pre-fills', () => {
    const params: ScheduleParams = {
      poi_ids: ['fort-santiago', 'manila-cathedral'],
      start_time: '10:00',
      transport_mode: 'jeepney',
      start_location: 'intramuros-gate',
      day_of_week: 'Wednesday',
    }
    nav.search = encodeParams(params).toString()

    render(<ResultView />)
    fireEvent.click(screen.getByRole('button', { name: /Edit this list/ }))

    expect(nav.push).toHaveBeenCalledTimes(1)
    const url = nav.push.mock.calls[0][0] as string
    expect(url.startsWith('/?')).toBe(true)
    const sp = queryFrom(url)
    expect(sp.get('poi_ids')).toBe('fort-santiago,manila-cathedral')
    expect(sp.get('start_time')).toBe('10:00')
    expect(sp.get('transport_mode')).toBe('jeepney')
    expect(sp.get('start_location')).toBe('intramuros-gate')
    expect(sp.get('day_of_week')).toBe('Wednesday')
  })
})
