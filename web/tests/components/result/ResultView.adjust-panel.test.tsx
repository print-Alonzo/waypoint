// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import ResultView from '@/components/result/ResultView'
import { encodeParams } from '@/lib/plan/params'
import type { ScheduleParams } from '@/lib/plan/params'

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

const BASE: ScheduleParams = {
  poi_ids: ['fort-santiago', 'quiapo-market'],
  start_time: '09:00',
  transport_mode: 'grab',
  start_location: 'rizal-park',
  day_of_week: 'Saturday',
}

function queryFrom(call: string): URLSearchParams {
  return new URLSearchParams(call.split('?')[1] ?? '')
}

beforeEach(() => {
  nav.push.mockClear()
  nav.replace.mockClear()
  nav.search = encodeParams(BASE).toString()
})

describe('ResultView "Adjust your day" panel', () => {
  // The page has a second, unrelated <details> (the "Share & export" menu in the
  // utility bar) — scope to the one whose summary says "Adjust your day".
  function adjustDetails(): HTMLDetailsElement {
    return screen.getByText('Adjust your day').closest('details') as HTMLDetailsElement
  }

  it('is open by default so the controls are visible without expanding it', () => {
    render(<ResultView />)
    expect(adjustDetails().open).toBe(true)
  })

  it("names what's inside the panel before anything is customized", () => {
    render(<ResultView />)
    const summary = screen.getByText('Adjust your day').closest('summary')!
    expect(summary).toHaveTextContent(/reorder & pin/)
    expect(summary).toHaveTextContent(/lunch break/)
    expect(summary).toHaveTextContent(/time limit/)
    expect(summary).toHaveTextContent(/compare transport/)
  })
})

describe('ResultView trip-detail editing', () => {
  it('changing the day preserves the working order/pins/budget/lunch', () => {
    nav.search = encodeParams({
      ...BASE,
      order: [...BASE.poi_ids].reverse(),
      locked: [BASE.poi_ids[0]],
      budget: 6,
      lunch: true,
    }).toString()
    render(<ResultView />)

    fireEvent.change(screen.getByLabelText('Day of trip'), { target: { value: 'Sunday' } })

    expect(nav.replace).toHaveBeenCalledTimes(1)
    const sp = queryFrom(nav.replace.mock.calls[0][0] as string)
    expect(sp.get('day_of_week')).toBe('Sunday')
    expect(sp.get('order')?.split(',')).toEqual([...BASE.poi_ids].reverse())
    expect(sp.get('locked')).toBe(BASE.poi_ids[0])
    expect(sp.get('budget')).toBe('6')
    expect(sp.get('lunch')).toBe('1')
  })

  it('changing the start time preserves the working order/pins', () => {
    nav.search = encodeParams({
      ...BASE,
      order: [...BASE.poi_ids].reverse(),
      locked: [BASE.poi_ids[0]],
    }).toString()
    render(<ResultView />)

    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '11:30' } })

    expect(nav.replace).toHaveBeenCalledTimes(1)
    const sp = queryFrom(nav.replace.mock.calls[0][0] as string)
    expect(sp.get('start_time')).toBe('11:30')
    expect(sp.get('order')?.split(',')).toEqual([...BASE.poi_ids].reverse())
    expect(sp.get('locked')).toBe(BASE.poi_ids[0])
  })

  it('changing the starting point preserves the working order/pins', () => {
    nav.search = encodeParams({
      ...BASE,
      order: [...BASE.poi_ids].reverse(),
      locked: [BASE.poi_ids[0]],
    }).toString()
    render(<ResultView />)

    fireEvent.change(screen.getByLabelText('Starting from'), {
      target: { value: 'manila-hotel' },
    })

    expect(nav.replace).toHaveBeenCalledTimes(1)
    const sp = queryFrom(nav.replace.mock.calls[0][0] as string)
    expect(sp.get('start_location')).toBe('manila-hotel')
    expect(sp.get('order')?.split(',')).toEqual([...BASE.poi_ids].reverse())
    expect(sp.get('locked')).toBe(BASE.poi_ids[0])
  })
})
