// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

import LiveView from '@/components/live/LiveView'
import type { ResolvedPlan } from '@/lib/plan/model'

// FINDING-003: once the whole day is already complete, "I'm running late (+15 min)"
// stayed clickable and produced contradictory copy — "Your day is complete" next to
// "Running 15 min behind — times below are shifted." The control has nothing left to
// shift once the last stop is behind you, so it should disappear once the day is done.

const nav = vi.hoisted(() => ({
  search: 'poi_ids=only-stop&start_time=09:00&transport_mode=walk&start_location=start&day_of_week=Saturday',
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(nav.search),
}))

const plan = vi.hoisted(() => ({ value: null as ResolvedPlan | null }))
vi.mock('@/lib/plan/model', () => ({
  resolvePlan: () => plan.value,
}))

function setSinglePlan() {
  plan.value = {
    startName: 'Start',
    coords: { lat: 0, lng: 0 },
    stops: [
      {
        poi: { name: 'Only Stop', close_time: '18:00' } as ResolvedPlan['stops'][number]['poi'],
        arrivalTime: 540, // 09:00
        departureTime: 585, // 09:45
        dwellMinutes: 45,
        transitFromPrev: 0,
        yellowFlag: false,
        redFlag: false,
        reason: {} as ResolvedPlan['stops'][number]['reason'],
      },
    ],
  }
}

describe('LiveView: running-late control after day completion', () => {
  beforeEach(setSinglePlan)
  afterEach(() => vi.useRealTimers())

  it('hides the running-late shift once the day is already complete', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2024, 0, 1, 21, 0)) // long after the only stop ended
    render(<LiveView />)
    expect(screen.getByText('Your day is complete 🎉')).toBeInTheDocument()
    expect(screen.queryByText(/running late/i)).not.toBeInTheDocument()
  })

  it('keeps the running-late shift available while the day is still in progress', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2024, 0, 1, 9, 10)) // mid-visit
    render(<LiveView />)
    expect(screen.getByText(/running late/i)).toBeInTheDocument()
  })
})
