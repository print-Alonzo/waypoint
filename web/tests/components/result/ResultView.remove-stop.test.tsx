// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import ResultView from '@/components/result/ResultView'
import { encodeParams } from '@/lib/plan/params'
import type { ScheduleParams } from '@/lib/plan/params'
import { POI_MAP } from '@/lib/poi/data'

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

const BASE: ScheduleParams = {
  poi_ids: ['fort-santiago', 'quiapo-market', 'the-mind-museum'],
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

describe('ResultView remove stop', () => {
  it('removes a stop from the day and drops it from poi_ids in the URL', () => {
    render(<ResultView />)
    const removeButtons = screen.getAllByRole('button', { name: /^Remove / })
    expect(removeButtons).toHaveLength(3)
    const targetName = removeButtons[0].getAttribute('aria-label')!.replace(/^Remove /, '')
    const targetId = NAME_TO_ID[targetName]

    fireEvent.click(removeButtons[0])

    expect(nav.replace).toHaveBeenCalledTimes(1)
    const sp = queryFrom(nav.replace.mock.calls[0][0] as string)
    const poiIds = sp.get('poi_ids')!.split(',')
    expect(poiIds).not.toContain(targetId)
    expect(poiIds).toHaveLength(2)
  })

  it('prunes the removed stop out of order/locked/durations params', () => {
    nav.search = encodeParams({
      ...BASE,
      order: [...BASE.poi_ids].reverse(),
      locked: ['quiapo-market'],
      durations: { 'quiapo-market': 90 },
    }).toString()
    render(<ResultView />)

    fireEvent.click(screen.getByRole('button', { name: 'Remove Quiapo Market' }))

    expect(nav.replace).toHaveBeenCalledTimes(1)
    const sp = queryFrom(nav.replace.mock.calls[0][0] as string)
    expect(sp.get('poi_ids')!.split(',')).not.toContain('quiapo-market')
    expect(sp.get('order')?.split(',') ?? []).not.toContain('quiapo-market')
    // The only pinned stop was the one removed, so `locked` drops out entirely.
    expect(sp.get('locked')).toBeNull()
    expect(sp.get('dur') ?? '').not.toContain('quiapo-market')
  })

  it("disables Remove on the day's only remaining stop and does not write the URL", () => {
    nav.search = encodeParams({ ...BASE, poi_ids: ['fort-santiago'] }).toString()
    render(<ResultView />)

    const removeButton = screen.getByRole('button', { name: /^Remove / })
    expect(removeButton).toHaveAttribute('aria-disabled', 'true')

    fireEvent.click(removeButton)
    expect(nav.replace).not.toHaveBeenCalled()
  })
})
