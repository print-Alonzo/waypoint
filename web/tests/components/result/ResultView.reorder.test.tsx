// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import ResultView from '@/components/result/ResultView'
import { encodeParams } from '@/lib/plan/params'
import type { ScheduleParams } from '@/lib/plan/params'
import { optimizeOrder } from '@/lib/scheduling/scheduler'
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

// Geographically spread (Intramuros / Quiapo / BGC) so transit times exceed the
// 5-min tie window and the optimizer has a STRICT order — a tightly-clustered set
// would make every permutation equally optimal (so 'manual' could never trigger).
const BASE: ScheduleParams = {
  poi_ids: ['fort-santiago', 'quiapo-market', 'the-mind-museum'],
  start_time: '09:00',
  transport_mode: 'grab',
  start_location: 'rizal-park',
  day_of_week: 'Saturday',
}

function sameArr(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

function optimizeIds(orderIds: string[], locked: Set<string>): string[] {
  const sl = START_LOCATION_MAP[BASE.start_location]
  return optimizeOrder(
    orderIds.map((id) => POI_MAP[id]),
    locked,
    TRANSIT_MATRIX,
    BASE.start_location,
    { lat: sl.lat, lng: sl.lng },
    BASE.transport_mode,
  ).order.map((x) => x.id)
}

function permute<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr]
  return arr.flatMap((x, i) =>
    permute([...arr.slice(0, i), ...arr.slice(i + 1)]).map((rest) => [x, ...rest]),
  )
}

// A visit order the greedy optimizer would NOT reproduce — guarantees ResultView
// labels it 'manual' (Intramuros POIs cluster, so most orders ARE greedy-stable;
// we deterministically find one that isn't rather than assuming reverse works).
function nonOptimalOrder(): string[] {
  for (const perm of permute(BASE.poi_ids)) {
    if (!sameArr(optimizeIds(perm, new Set()), perm)) return perm
  }
  throw new Error('all permutations are greedy-stable for this data')
}

function queryFrom(call: string): URLSearchParams {
  return new URLSearchParams(call.split('?')[1] ?? '')
}

// Visual order, read from the per-stop "Move … later" controls (DOM order).
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

describe('ResultView reorder + lock', () => {
  it('Move later swaps two stops in the URL order param', () => {
    render(<ResultView />)
    const before = renderedNames()
    expect(before).toHaveLength(3)

    fireEvent.click(screen.getByRole('button', { name: `Move ${before[0]} later` }))

    expect(nav.replace).toHaveBeenCalledTimes(1)
    const order = queryFrom(nav.replace.mock.calls[0][0] as string).get('order')!.split(',')
    const ids = before.map((n) => NAME_TO_ID[n])
    // First two swapped, third unchanged.
    expect(order).toEqual([ids[1], ids[0], ids[2]])
  })

  it('Pin writes a locked param (no order, since nothing moved) and labels the stop pinned', () => {
    const { rerender } = render(<ResultView />)
    const names = renderedNames()

    fireEvent.click(screen.getByRole('button', { name: `Pin ${names[0]} in place` }))
    const url = nav.replace.mock.calls[0][0] as string
    const sp = queryFrom(url)
    expect(sp.get('locked')).toBe(NAME_TO_ID[names[0]])
    expect(sp.has('order')).toBe(false) // pinning in place doesn't change the order

    // Apply the new URL → the pinned stop reads "Pinned by you", others stay optimized.
    nav.search = url.split('?')[1]
    rerender(<ResultView />)
    expect(screen.getByText(/Pinned by you/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `Unpin ${names[0]}` })).toBeInTheDocument()
  })

  it('a hand-arranged order shows "You placed this stop here" and never an algorithmic claim', () => {
    nav.search = encodeParams({ ...BASE, order: nonOptimalOrder() }).toString()
    render(<ResultView />)

    // Every stop is user-arranged → no nearest-neighbor reasoning anywhere.
    expect(screen.getAllByText(/You placed this stop here/i).length).toBeGreaterThanOrEqual(2)
    expect(screen.queryByText(/Closest|Among the nearest/i)).toBeNull()
  })

  it('the COPIED text stays faithful for a hand-arranged order (no false reason)', async () => {
    nav.search = encodeParams({ ...BASE, order: nonOptimalOrder() }).toString()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

    render(<ResultView />)
    fireEvent.click(screen.getByRole('button', { name: /Copy itinerary as text/ }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    const text = writeText.mock.calls[0][0] as string
    expect(text).toContain('You placed this stop here')
    expect(text).not.toMatch(/Closest|Among the nearest/)
  })

  it('Reset order clears both order and locked params', () => {
    const ids = BASE.poi_ids
    nav.search = encodeParams({ ...BASE, order: [...ids].reverse(), locked: [ids[0]] }).toString()
    render(<ResultView />)

    fireEvent.click(screen.getByRole('button', { name: /Reset order/ }))
    const sp = queryFrom(nav.replace.mock.calls[0][0] as string)
    expect(sp.has('order')).toBe(false)
    expect(sp.has('locked')).toBe(false)
  })

  it('dedupes duplicate ids in poi_ids instead of crashing the route', () => {
    nav.search = encodeParams({
      ...BASE,
      poi_ids: ['fort-santiago', 'fort-santiago', 'quiapo-market'],
    }).toString()
    render(<ResultView />) // would throw to the error boundary before the fix
    expect(renderedNames()).toEqual(['Fort Santiago', 'Quiapo Market'])
  })

  it('dedupes duplicate ids in the order param instead of crashing the route', () => {
    nav.search = encodeParams({
      ...BASE,
      order: ['fort-santiago', 'fort-santiago', 'quiapo-market', 'the-mind-museum'],
    }).toString()
    render(<ResultView />)
    expect(renderedNames()).toHaveLength(3) // 3 unique POIs, no duplicate row
  })

  it('Re-optimize keeps the pinned stop fixed and rewrites the order', () => {
    const reversed = [...BASE.poi_ids].reverse()
    // Pin whatever is first in the (reversed) custom order, then re-optimize.
    nav.search = encodeParams({ ...BASE, order: reversed, locked: [reversed[0]] }).toString()
    render(<ResultView />)

    fireEvent.click(screen.getByRole('button', { name: /Re-optimize unpinned/ }))
    const sp = queryFrom(nav.replace.mock.calls[0][0] as string)
    expect(sp.get('locked')).toBe(reversed[0]) // pin preserved
    const order = sp.get('order')!.split(',')
    expect(order[0]).toBe(reversed[0]) // pinned stop stayed at its index
    expect(order).toHaveLength(3)
  })
})
