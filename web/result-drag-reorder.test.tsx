// @vitest-environment jsdom
//
// Covers the OPTIMISTIC ORDER that drag-and-drop rests on: the list must reorder in
// the same commit as the user's action, because dnd-kit sorts against the `items`
// array we hand it. If the order only landed after the router round-tripped, a drop
// would visibly snap back to the old arrangement for a frame.
//
// The drag GESTURE itself isn't simulated here. dnd-kit needs live pointer events and
// non-zero getBoundingClientRects, neither of which jsdom provides; mocking both
// produces a test that verifies the mock. The gesture is verified in a real browser —
// what's testable is the consequence of a drop, which is arrayMove + applyOrder, and
// that's exactly the path a ↑/↓ press takes below.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import ResultView from '@/components/ResultView'
import { REORDER_MS } from '@/components/SortableStop'
import { encodeParams } from '@/lib/params'
import type { ScheduleParams } from '@/lib/params'
import { POI_MAP } from '@/lib/data'

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

// Geographically spread (Intramuros / Quiapo / BGC), matching result-reorder.test.tsx:
// a tightly-clustered set would make every permutation equally optimal.
const BASE: ScheduleParams = {
  poi_ids: ['fort-santiago', 'quiapo-market', 'the-mind-museum'],
  start_time: '09:00',
  transport_mode: 'grab',
  start_location: 'rizal-park',
  day_of_week: 'Saturday',
}

// Visual order, read from the per-stop "Move … later" controls (DOM order).
function renderedNames(): string[] {
  return screen
    .getAllByRole('button', { name: /^Move .* later$/ })
    .map((b) => b.getAttribute('aria-label')!.replace(/^Move /, '').replace(/ later$/, ''))
}

function queryFrom(call: string): URLSearchParams {
  return new URLSearchParams(call.split('?')[1] ?? '')
}

beforeEach(() => {
  nav.push.mockClear()
  nav.replace.mockClear()
  nav.search = encodeParams(BASE).toString()
})

describe('optimistic order (the foundation drag-and-drop sorts against)', () => {
  it('reorders the list in the SAME commit as the click, before the URL catches up', () => {
    render(<ResultView />)
    const before = renderedNames()

    fireEvent.click(screen.getByRole('button', { name: `Move ${before[0]} later` }))

    // nav.search is untouched — the mocked router never writes back. The list must
    // ALREADY show the new order anyway. Without the optimistic order this is still
    // [0, 1, 2] and a real drop would flicker.
    expect(renderedNames()).toEqual([before[1], before[0], before[2]])
    expect(nav.replace).toHaveBeenCalledTimes(1)
  })

  it('holds the order steady when the URL lands on the same arrangement (no flicker back)', () => {
    const { rerender } = render(<ResultView />)
    const before = renderedNames()

    fireEvent.click(screen.getByRole('button', { name: `Move ${before[0]} later` }))
    const after = renderedNames()

    // Apply the URL the router was actually handed — the pending order retires here,
    // and the URL must resolve to exactly what was already on screen.
    nav.search = (nav.replace.mock.calls[0][0] as string).split('?')[1]
    rerender(<ResultView />)

    expect(renderedNames()).toEqual(after)
  })

  it('drops a stale pending order rather than misapplying it to a changed POI set', () => {
    const { rerender } = render(<ResultView />)
    const before = renderedNames()

    fireEvent.click(screen.getByRole('button', { name: `Move ${before[0]} later` }))
    expect(renderedNames()).toHaveLength(3)

    // The POI set changes under the pending order (as "Edit places" would do). The
    // pending order names three stops that no longer all exist — the URL must win.
    nav.search = encodeParams({
      ...BASE,
      poi_ids: ['fort-santiago', 'quiapo-market'],
    }).toString()
    rerender(<ResultView />)

    expect(renderedNames()).toEqual(['Fort Santiago', 'Quiapo Market'])
  })

  it('lets a later browser-back override the order the user optimistically applied', () => {
    const { rerender } = render(<ResultView />)
    const before = renderedNames()

    fireEvent.click(screen.getByRole('button', { name: `Move ${before[0]} later` }))
    expect(renderedNames()).toEqual([before[1], before[0], before[2]])

    // Back button: a different URL arrives that the user did NOT just write. The
    // pending order is tagged to the previous query string, so it must not survive.
    const reversed = [...BASE.poi_ids].reverse()
    nav.search = encodeParams({ ...BASE, order: reversed }).toString()
    rerender(<ResultView />)

    expect(renderedNames().map((n) => NAME_TO_ID[n])).toEqual(reversed)
  })

  it('Reset to auto still clears both order and locked through the optimistic path', () => {
    const ids = BASE.poi_ids
    nav.search = encodeParams({ ...BASE, order: [...ids].reverse(), locked: [ids[0]] }).toString()
    render(<ResultView />)

    fireEvent.click(screen.getByRole('button', { name: /Reset to auto/ }))

    const sp = queryFrom(nav.replace.mock.calls[0][0] as string)
    expect(sp.has('order')).toBe(false)
    expect(sp.has('locked')).toBe(false)
  })
})

describe('prefers-reduced-motion', () => {
  // The browser can't be driven into reduced-motion mode from the QA harness (CDP
  // media emulation is blocked), so the contract is pinned here instead: motion is
  // decoration, the reorder itself must still happen.
  function setReducedMotion(reduce: boolean) {
    window.matchMedia = ((query: string) => ({
      matches: reduce && query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia
  }

  it('reorders with no transition, no leg crossfade and no landed ring', () => {
    setReducedMotion(true)
    const { container } = render(<ResultView />)
    const before = renderedNames()

    fireEvent.click(screen.getByRole('button', { name: `Move ${before[0]} later` }))

    // The reorder still lands — that's the part that is NOT decoration.
    expect(renderedNames()).toEqual([before[1], before[0], before[2]])

    // ...but nothing animates. Note dnd-kit expresses "no animation" as an explicit
    // `transform 0ms linear`, not as an absent transition — so assert on the reorder
    // duration being absent rather than on the property being empty.
    const cards = [...container.querySelectorAll('.wp-stop')] as HTMLElement[]
    expect(cards).toHaveLength(3)
    expect(cards.every((c) => !c.style.transition.includes(`${REORDER_MS}ms`))).toBe(true)
    expect(container.querySelectorAll('.wp-stop[data-landed]')).toHaveLength(0)
    expect(container.querySelector('ol')!.hasAttribute('data-reordering')).toBe(false)
  })

  it('animates when motion is welcome (the control for the test above)', () => {
    setReducedMotion(false)
    const { container } = render(<ResultView />)
    const before = renderedNames()

    fireEvent.click(screen.getByRole('button', { name: `Move ${before[0]} later` }))

    expect(container.querySelector('ol')!.hasAttribute('data-reordering')).toBe(true)
    expect(container.querySelectorAll('.wp-stop[data-landed]')).toHaveLength(1)
  })
})

describe('drag handle accessibility', () => {
  it('stays out of the a11y tree, leaving ↑ ↓ and pin as the exposed controls', () => {
    render(<ResultView />)
    const names = renderedNames()

    // The grip is aria-hidden + tabIndex=-1: a pointer-only affordance. Exposing it
    // would put a third, redundant reorder control in the tab order.
    const focusable = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('tabindex') !== '-1')
    expect(focusable.every((b) => b.getAttribute('aria-hidden') !== 'true')).toBe(true)

    // The keyboard path is untouched.
    for (const name of names) {
      expect(screen.getByRole('button', { name: `Move ${name} earlier` })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: `Move ${name} later` })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: `Pin ${name} in place` })).toBeInTheDocument()
    }
  })
})
