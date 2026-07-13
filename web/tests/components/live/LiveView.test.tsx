// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import LiveView from '@/components/live/LiveView'
import type { ResolvedPlan } from '@/lib/plan/model'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === 'string' ? href : '#'} {...rest}>
      {children}
    </a>
  ),
}))

const nav = vi.hoisted(() => ({
  search: 'poi_ids=a,b,c&start_time=09:00&transport_mode=walk&start_location=start&day_of_week=Saturday',
  replace: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace }),
  useSearchParams: () => new URLSearchParams(nav.search),
}))

const plan = vi.hoisted(() => ({ value: null as ResolvedPlan | null }))
vi.mock('@/lib/plan/model', () => ({
  resolvePlan: () => plan.value,
}))

type Stop = ResolvedPlan['stops'][number]

function stop(overrides: Partial<Stop> & { name: string }): Stop {
  return {
    poi: { name: overrides.name, close_time: '18:00' } as Stop['poi'],
    arrivalTime: 0,
    departureTime: 0,
    dwellMinutes: 0,
    transitFromPrev: 0,
    yellowFlag: false,
    redFlag: false,
    reason: {} as Stop['reason'],
    ...overrides,
  }
}

function setThreeStopPlan() {
  plan.value = {
    startName: 'Start',
    coords: { lat: 0, lng: 0 },
    stops: [
      stop({ name: 'Fort Santiago', arrivalTime: 540, departureTime: 585 }), // 09:00-09:45
      stop({ name: 'Casa Manila', arrivalTime: 600, departureTime: 660 }), // 10:00-11:00
      stop({ name: 'Manila Cathedral', arrivalTime: 700, departureTime: 760 }), // 11:40-12:40
    ],
  }
}

function setTime(h: number, m: number) {
  vi.setSystemTime(new Date(2024, 0, 1, h, m))
}

const DEFAULT_SEARCH =
  'poi_ids=a,b,c&start_time=09:00&transport_mode=walk&start_location=start&day_of_week=Saturday'

beforeEach(() => {
  nav.replace.mockClear()
  nav.search = DEFAULT_SEARCH
  setThreeStopPlan()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('LiveView', () => {
  it('redirects home when the URL has no valid plan params', () => {
    nav.search = ''
    render(<LiveView />)
    expect(nav.replace).toHaveBeenCalledWith('/')
  })

  it('redirects home when resolvePlan cannot resolve a plan', () => {
    plan.value = null
    render(<LiveView />)
    expect(nav.replace).toHaveBeenCalledWith('/')
  })

  it('shows "First stop" before the day starts', () => {
    vi.useFakeTimers()
    setTime(8, 20)
    render(<LiveView />)
    expect(screen.getByText('First stop: Fort Santiago')).toBeInTheDocument()
    expect(screen.getByText(/Arrive in.*around 09:00/)).toBeInTheDocument()
  })

  it('shows "You\'re at" during a stop, with a leave-by time', () => {
    vi.useFakeTimers()
    setTime(9, 10)
    render(<LiveView />)
    expect(screen.getByText("You're at Fort Santiago")).toBeInTheDocument()
    expect(screen.getByText(/Leave in.*by 09:45/)).toBeInTheDocument()
  })

  it('shows "On your way to" during a transit gap between stops', () => {
    vi.useFakeTimers()
    setTime(9, 50)
    render(<LiveView />)
    expect(screen.getByText('On your way to Casa Manila')).toBeInTheDocument()
  })

  it('shows the day-complete headline after the last stop ends', () => {
    vi.useFakeTimers()
    setTime(21, 0)
    render(<LiveView />)
    expect(screen.getByText('Your day is complete 🎉')).toBeInTheDocument()
  })

  it('shifts every remaining time when "running late" is clicked, and shows the delay banner', () => {
    vi.useFakeTimers()
    setTime(9, 30) // still inside stop 1's window even after the +15 shift below
    render(<LiveView />)
    fireEvent.click(screen.getByRole('button', { name: /running late/i }))
    expect(screen.getByText(/Running 15 min behind/)).toBeInTheDocument()
    expect(screen.getByText(/Leave in.*by 10:00/)).toBeInTheDocument()
  })

  it('clears the delay when "Back on schedule" is clicked', () => {
    vi.useFakeTimers()
    setTime(9, 30)
    render(<LiveView />)
    fireEvent.click(screen.getByRole('button', { name: /running late/i }))
    fireEvent.click(screen.getByRole('button', { name: /back on schedule/i }))
    expect(screen.queryByText(/Running \d+ min behind/)).not.toBeInTheDocument()
    expect(screen.getByText(/Leave in.*by 09:45/)).toBeInTheDocument()
  })

  it('flags a stop as closed when redFlag is set, independent of delay', () => {
    plan.value!.stops[0] = stop({
      name: 'Fort Santiago',
      arrivalTime: 540,
      departureTime: 585,
      redFlag: true,
    })
    vi.useFakeTimers()
    setTime(9, 10)
    render(<LiveView />)
    expect(screen.getByText('✕ closed')).toBeInTheDocument()
  })

  it('re-derives the past-close warning against a delayed arrival time', () => {
    // Stop closes at 09:10; the 09:00 arrival is fine as scheduled (no yellow flag).
    plan.value!.stops[0] = stop({
      name: 'Fort Santiago',
      arrivalTime: 540,
      departureTime: 585,
    })
    plan.value!.stops[0].poi = { name: 'Fort Santiago', close_time: '09:10' } as Stop['poi']
    vi.useFakeTimers()
    setTime(9, 30)
    render(<LiveView />)
    expect(screen.queryByText('⚠ check hours')).not.toBeInTheDocument()

    // Running 15 min behind pushes the arrival (09:15) past the 09:10 close — should now warn.
    fireEvent.click(screen.getByRole('button', { name: /running late/i }))
    expect(screen.getByText('⚠ check hours')).toBeInTheDocument()
  })

  it('links back to /result with the same query string', () => {
    vi.useFakeTimers()
    setTime(9, 10)
    render(<LiveView />)
    expect(screen.getByRole('link', { name: /back to the plan/i })).toHaveAttribute(
      'href',
      `/result?${new URLSearchParams(nav.search).toString()}`,
    )
  })
})
