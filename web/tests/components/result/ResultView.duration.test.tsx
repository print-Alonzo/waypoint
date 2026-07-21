// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import ResultView from '@/components/result/ResultView'
import { encodeParams } from '@/lib/plan/params'
import type { ScheduleParams } from '@/lib/plan/params'
import { optimizeOrder, scheduleAlong } from '@/lib/scheduling/scheduler'
import { wallClock } from '@/lib/plan/export'
import { DURATION_STEP } from '@/lib/scheduling/duration'
import { POI_MAP, TRANSIT_MATRIX } from '@/lib/poi/data'
import { START_LOCATION_MAP } from '@/lib/constants'

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

const NAME_TO_ID: Record<string, string> = Object.fromEntries(
  Object.values(POI_MAP).map((p) => [p.name, p.id]),
)

// Geographically spread (Intramuros / Quiapo / BGC), same set result-reorder.test.tsx
// uses, so the optimizer produces a strict, deterministic order.
const BASE: ScheduleParams = {
  poi_ids: ['fort-santiago', 'quiapo-market', 'the-mind-museum'],
  start_time: '09:00',
  transport_mode: 'grab',
  start_location: 'rizal-park',
  day_of_week: 'Saturday',
}

const START_COORDS = (() => {
  const sl = START_LOCATION_MAP[BASE.start_location]
  return { lat: sl.lat, lng: sl.lng }
})()

function defaultOrderIds(): string[] {
  return optimizeOrder(
    BASE.poi_ids.map((id) => POI_MAP[id]),
    new Set(),
    TRANSIT_MATRIX,
    BASE.start_location,
    START_COORDS,
    BASE.transport_mode,
  ).order.map((p) => p.id)
}

// Predicts stop[1]'s arrival/departure wall clocks for a given duration override
// on stop[0], using the real scheduler — so the DOM assertions below aren't
// guessing numbers.
function secondStopTimes(durations?: Record<string, number>): { arrivalTime: number; departureTime: number } {
  const order = defaultOrderIds().map((id) => POI_MAP[id])
  const stops = scheduleAlong(
    order,
    TRANSIT_MATRIX,
    BASE.start_location,
    START_COORDS,
    BASE.start_time,
    BASE.transport_mode,
    BASE.day_of_week,
    undefined,
    null,
    durations,
  )
  return stops[1]
}

function queryFrom(call: string): URLSearchParams {
  return new URLSearchParams(call.split('?')[1] ?? '')
}

function renderedNames(): string[] {
  return screen
    .getAllByRole('button', { name: /^Move .* later$/ })
    .map((b) => b.getAttribute('aria-label')!.replace(/^Move /, '').replace(/ later$/, ''))
}

beforeEach(() => {
  nav.push.mockClear()
  nav.replace.mockClear()
  nav.search = encodeParams(BASE).toString()
})

describe('ResultView duration stepper', () => {
  it('Spend more time writes dur=<id>:<rec + step> to the URL', () => {
    render(<ResultView />)
    const [first] = renderedNames()
    const id = NAME_TO_ID[first]
    const rec = POI_MAP[id].recommended_duration_minutes

    fireEvent.click(screen.getByRole('button', { name: `Spend more time at ${first}` }))

    expect(nav.replace).toHaveBeenCalledTimes(1)
    const dur = queryFrom(nav.replace.mock.calls[0][0] as string).get('dur')
    expect(dur).toBe(`${id}:${rec + DURATION_STEP}`)
  })

  it('re-rendering with an edited duration shows "(you set this)" and a Reset control', () => {
    const order = defaultOrderIds()
    const id = order[0]
    const rec = POI_MAP[id].recommended_duration_minutes
    const edited = rec + DURATION_STEP

    nav.search = encodeParams({ ...BASE, durations: { [id]: edited } }).toString()
    render(<ResultView />)

    expect(screen.getByText(new RegExp(`~${edited} min \\(you set this\\)`))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument()
  })

  it('Reset writes a URL with no dur key', () => {
    const order = defaultOrderIds()
    const id = order[0]
    const rec = POI_MAP[id].recommended_duration_minutes
    nav.search = encodeParams({ ...BASE, durations: { [id]: rec + DURATION_STEP } }).toString()

    render(<ResultView />)
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))

    const sp = queryFrom(nav.replace.mock.calls[0][0] as string)
    expect(sp.has('dur')).toBe(false)
  })

  it('the copied text stays faithful: edited minutes carry into the clipboard payload', async () => {
    const order = defaultOrderIds()
    const id = order[0]
    const rec = POI_MAP[id].recommended_duration_minutes
    const edited = rec + DURATION_STEP
    nav.search = encodeParams({ ...BASE, durations: { [id]: edited } }).toString()

    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

    render(<ResultView />)
    fireEvent.click(screen.getByRole('button', { name: /Copy itinerary as text/ }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    const text = writeText.mock.calls[0][0] as string
    expect(text).toContain(`~${edited} min (you set this)`)
  })

  it('a duration long enough to overrun close_time renders the overstay hint', () => {
    const order = defaultOrderIds()
    const id = order[0]
    // Large enough (DURATION_MAX) that arrival + dwell runs past any of this
    // trio's close_time regardless of which POI ends up first.
    nav.search = encodeParams({ ...BASE, durations: { [id]: 600 } }).toString()

    render(<ResultView />)
    // The huge override on stop 1 can cascade and overrun stop 2's closing as well
    // (its own arrival is now much later), so assert at least one hint rendered.
    expect(screen.getAllByText(/closes at .* — your stay runs to/).length).toBeGreaterThanOrEqual(1)
  })

  it('a dur override on stop 1 shifts stop 2s rendered arrival–departure range later', () => {
    const order = defaultOrderIds()
    const id = order[0]
    const rec = POI_MAP[id].recommended_duration_minutes
    const bumped = rec + 180

    const base = secondStopTimes(undefined)
    const later = secondStopTimes({ [id]: bumped })
    const baseRange = `${wallClock(base.arrivalTime)}–${wallClock(base.departureTime)}`
    const laterRange = `${wallClock(later.arrivalTime)}–${wallClock(later.departureTime)}`
    expect(laterRange).not.toBe(baseRange)

    nav.search = encodeParams({ ...BASE, durations: { [id]: bumped } }).toString()
    render(<ResultView />)
    expect(screen.getByText(laterRange)).toBeInTheDocument()
    expect(screen.queryByText(baseRange)).toBeNull()
  })
})

// With this exact 3-stop trip (start 09:00, grab), the real schedule is:
//   fort-santiago   arrival 09:05 (545)  departure 10:35 (635)  dwell 90
//   quiapo-market   arrival 10:40 (640)  departure 11:40 (700)  dwell 60
//   the-mind-museum arrival 12:08 (728)  departure 14:38 (878)  dwell 150
// At a 6h budget (endsAt 900/15:00), the-mind-museum's default departure (878)
// fits; bumping its dwell one step to 165 still fits (departure 893); but the
// NEXT step to 180 would depart at 908 — over budget. This gives a precise,
// non-flaky boundary to assert the stepper's budget cap against.
describe('ResultView duration stepper: capped by an active time budget', () => {
  it('disables "+" once the next step would push a stop past the budget, and no-ops on click', () => {
    nav.search = encodeParams({
      ...BASE,
      budget: 6,
      durations: { 'the-mind-museum': 165 },
    }).toString()
    render(<ResultView />)

    const plusBtn = screen.getByRole('button', { name: 'Spend more time at The Mind Museum' })
    expect(plusBtn).toHaveAttribute('aria-disabled', 'true')
    // Other stops may show the same hint too — lengthening ANY of them ripples
    // forward and would also push the Mind Museum over budget — so assert
    // presence, not a single match.
    expect(screen.getAllByText(/Limited by your time budget/).length).toBeGreaterThanOrEqual(1)

    fireEvent.click(plusBtn)
    expect(nav.replace).not.toHaveBeenCalled()
    expect(screen.getByText(/~165 min \(you set this\)/)).toBeInTheDocument()
  })

  it('leaves "+" enabled while the next step still fits the budget', () => {
    nav.search = encodeParams({ ...BASE, budget: 6 }).toString() // default 150 min dwell
    render(<ResultView />)

    const plusBtn = screen.getByRole('button', { name: 'Spend more time at The Mind Museum' })
    expect(plusBtn).not.toHaveAttribute('aria-disabled', 'true')

    fireEvent.click(plusBtn)
    const dur = queryFrom(nav.replace.mock.calls[0][0] as string).get('dur')
    expect(dur).toBe('the-mind-museum:165')
  })

  it('without an active budget, "+" is only capped by the 600-min max, not by time', () => {
    nav.search = encodeParams({ ...BASE, durations: { 'the-mind-museum': 165 } }).toString()
    render(<ResultView />)

    const plusBtn = screen.getByRole('button', { name: 'Spend more time at The Mind Museum' })
    expect(plusBtn).not.toHaveAttribute('aria-disabled', 'true')
    expect(screen.queryByText(/Limited by your time budget/)).toBeNull()
  })
})
