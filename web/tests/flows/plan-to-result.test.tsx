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

// Selector renders next/image thumbnails; use a plain <img> in tests.
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

// Selector links to /credits via next/link; render a plain anchor.
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === 'string' ? href : '#'} {...rest}>
      {children}
    </a>
  ),
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

  it('shows a photo thumbnail for places that have one, a placeholder otherwise', () => {
    render(<Selector />)
    const fortRow = screen.getByRole('checkbox', { name: /Fort Santiago/ }).closest('label')!
    const fortImg = fortRow.querySelector('img')
    expect(fortImg).toBeTruthy()
    expect(fortImg).toHaveAttribute('src', '/images/poi/fort-santiago.jpg')
    // Ayala Museum has no curated photo → placeholder tile, no <img>.
    const ayalaRow = screen.getByRole('checkbox', { name: /Ayala Museum/ }).closest('label')!
    expect(ayalaRow.querySelector('img')).toBeNull()
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

// (5) Reason line: a faithful "Why this stop" line renders per stop without
// breaking the document-order invariant relied on by test (2).
describe('result view reason line', () => {
  const params: ScheduleParams = {
    poi_ids: ['fort-santiago', 'manila-cathedral', 'quiapo-market'],
    start_time: '09:00',
    transport_mode: 'walk',
    start_location: 'rizal-park',
    day_of_week: 'Tuesday',
  }

  it('shows a "Why this stop" line for every stop and an opener for the first', () => {
    nav.search = encodeParams(params).toString()
    const { container } = render(<ResultView />)

    const text = container.textContent ?? ''
    const occurrences = text.split('Why this stop:').length - 1
    expect(occurrences).toBe(params.poi_ids.length)
    expect(text).toContain('Closest to your start')
  })

  it('no later stop name leaks into an earlier card reason line', () => {
    nav.search = encodeParams(params).toString()

    const selected = params.poi_ids.map((id) => POI_MAP[id]).filter(Boolean) as POI[]
    const start = START_LOCATION_MAP[params.start_location]
    const ordered = scheduleItinerary(
      selected,
      TRANSIT_MATRIX,
      params.start_location,
      { lat: start.lat, lng: start.lng },
      params.start_time,
      params.transport_mode,
      params.day_of_week,
    ).map((s) => s.poi.name)

    const { container } = render(<ResultView />)
    // Per-card reason text (the single <p> inside each <li>), so the assertion is
    // sensitive to WHERE a name lands — not just global first-occurrence order.
    const reasonLines = [...container.querySelectorAll('ol > li')].map(
      (li) => li.querySelector('p')?.textContent ?? '',
    )
    expect(reasonLines).toHaveLength(ordered.length)
    // A reason may name the PREVIOUS stop (earlier) but must never name a LATER one.
    reasonLines.forEach((line, i) => {
      ordered.slice(i + 1).forEach((laterName) => {
        expect(line).not.toContain(laterName)
      })
    })
  })

  it('keeps flag status in the existing status layer alongside the reason line', () => {
    nav.search = encodeParams({
      poi_ids: ['casa-manila'], // closed on Monday
      start_time: '09:00',
      transport_mode: 'grab',
      start_location: 'rizal-park',
      day_of_week: 'Monday',
    }).toString()

    const { container } = render(<ResultView />)
    const text = container.textContent ?? ''
    expect(text).toContain('Closed today') // flag still surfaced by statusText
    expect(text).toContain('Why this stop:') // reason still present on a flagged card
  })
})

// (4) "Edit this list" navigates to /plan with prefilling params.
describe('edit back-link', () => {
  it('pushes /plan with the current params so the selector pre-fills', () => {
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
    expect(url.startsWith('/plan?')).toBe(true)
    const sp = queryFrom(url)
    expect(sp.get('poi_ids')).toBe('fort-santiago,manila-cathedral')
    expect(sp.get('start_time')).toBe('10:00')
    expect(sp.get('transport_mode')).toBe('jeepney')
    expect(sp.get('start_location')).toBe('intramuros-gate')
    expect(sp.get('day_of_week')).toBe('Wednesday')
  })
})

// (6) Share / export: copy-to-clipboard text and .ics download wiring.
describe('result view share/export', () => {
  const params: ScheduleParams = {
    poi_ids: ['fort-santiago', 'manila-cathedral'],
    start_time: '09:00',
    transport_mode: 'grab',
    start_location: 'rizal-park',
    day_of_week: 'Tuesday',
  }

  // Typed (_blob: Blob) so mock.calls[0][0] is a Blob — lets us read the produced
  // .ics content AND keeps `tsc --noEmit` green (an arg-less vi.fn infers an empty
  // tuple, so indexing mock.calls[0][0] would be a type error).
  function stubObjectUrl() {
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:mock')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true })
    return { createObjectURL, revokeObjectURL }
  }

  it('copies a plain-text itinerary to the clipboard and announces success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    nav.search = encodeParams(params).toString()

    render(<ResultView />)
    fireEvent.click(screen.getByRole('button', { name: /Copy itinerary as text/ }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    const text = writeText.mock.calls[0][0] as string
    expect(text).toContain('Metro Manila itinerary — Tuesday')
    expect(text).toContain('Fort Santiago')
    expect(text).toContain('Plan: ')
    // Success announced via a dedicated live region (button name stays stable).
    // Queried by name: the drag-and-drop DndContext renders a role=status region of
    // its own, so the copy region has to be named to stay unambiguous.
    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Copy status' })).toHaveTextContent(
        'Itinerary copied to clipboard',
      ),
    )
  })

  it('announces "Copy failed" when the clipboard API is unavailable (insecure origin)', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    nav.search = encodeParams(params).toString()

    render(<ResultView />)
    fireEvent.click(screen.getByRole('button', { name: /Copy itinerary as text/ }))
    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Copy status' })).toHaveTextContent('Copy failed'),
    )
  })

  it('builds a valid .ics blob and downloads it with a safe filename', async () => {
    const { createObjectURL, revokeObjectURL } = stubObjectUrl()
    const downloads: string[] = []
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloads.push(this.download)
      })
    nav.search = encodeParams(params).toString()

    render(<ResultView />)
    fireEvent.click(screen.getByRole('button', { name: /Download \.ics/ }))

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(downloads).toEqual(['waypoint-metro-manila-tuesday.ics'])
    expect(revokeObjectURL).toHaveBeenCalledTimes(1)
    const ics = await createObjectURL.mock.calls[0][0].text()
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('SUMMARY:1. Fort Santiago')
    clickSpy.mockRestore()
  })

  it("the downloaded .ics carries the page's closed flag (real scheduler → component)", async () => {
    const { createObjectURL } = stubObjectUrl()
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    nav.search = encodeParams({
      poi_ids: ['casa-manila'], // closed on Monday in the dataset
      start_time: '09:00',
      transport_mode: 'grab',
      start_location: 'rizal-park',
      day_of_week: 'Monday',
    }).toString()

    render(<ResultView />)
    fireEvent.click(screen.getByRole('button', { name: /Download \.ics/ }))

    const ics = await createObjectURL.mock.calls[0][0].text()
    expect(ics).toContain('[CLOSED]')
    expect(ics).toContain('TRANSP:TRANSPARENT')
    expect(ics).not.toContain('STATUS:CANCELLED')
    clickSpy.mockRestore()
  })
})
