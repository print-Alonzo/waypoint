// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import SavedPlansView from '@/components/saved/SavedPlansView'
import { savePlan } from '@/lib/storage/saved-plans'
import { encodeParams, type ScheduleParams } from '@/lib/plan/params'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === 'string' ? href : '#'} {...rest}>
      {children}
    </a>
  ),
}))

const SHORT: ScheduleParams = {
  poi_ids: ['fort-santiago'],
  start_time: '09:00',
  transport_mode: 'walk',
  start_location: 'rizal-park',
  day_of_week: 'Saturday',
}
const LONG: ScheduleParams = {
  poi_ids: ['fort-santiago', 'casa-manila', 'manila-cathedral'],
  start_time: '09:00',
  transport_mode: 'grab',
  start_location: 'rizal-park',
  day_of_week: 'Saturday',
}
const THIRD: ScheduleParams = {
  poi_ids: ['quiapo-market'],
  start_time: '10:00',
  transport_mode: 'jeepney',
  start_location: 'manila-hotel',
  day_of_week: 'Sunday',
}

beforeEach(() => {
  localStorage.clear()
})

describe('SavedPlansView', () => {
  it('shows an empty state with a link to /plan when nothing is saved, and no Compare link', () => {
    render(<SavedPlansView />)
    expect(screen.getByText(/haven.t saved any plans yet/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /plan a day/i })).toHaveAttribute('href', '/plan')
    expect(screen.queryByRole('link', { name: /compare plans/i })).not.toBeInTheDocument()
  })

  it('lists every saved plan, not just the first two', () => {
    savePlan('Short day', encodeParams(SHORT).toString(), 1000)
    savePlan('Long day', encodeParams(LONG).toString(), 2000)
    savePlan('Third day', encodeParams(THIRD).toString(), 3000)
    render(<SavedPlansView />)

    expect(screen.getByText('Short day')).toBeInTheDocument()
    expect(screen.getByText('Long day')).toBeInTheDocument()
    expect(screen.getByText('Third day')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /^open$/i })).toHaveLength(3)
  })

  it('shows the Compare plans link even with only one saved plan', () => {
    savePlan('Only plan', encodeParams(SHORT).toString(), 1000)
    render(<SavedPlansView />)
    expect(screen.getByRole('link', { name: /compare plans/i })).toHaveAttribute(
      'href',
      '/compare',
    )
  })

  it('links each plan\'s "Open" to /result with that plan\'s query', () => {
    const query = encodeParams(SHORT).toString()
    savePlan('Short day', query, 1000)
    render(<SavedPlansView />)
    expect(screen.getByRole('link', { name: /^open$/i })).toHaveAttribute(
      'href',
      `/result?${query}`,
    )
  })

  it('removes only the forgotten plan', () => {
    savePlan('Short day', encodeParams(SHORT).toString(), 1000)
    savePlan('Long day', encodeParams(LONG).toString(), 2000)
    render(<SavedPlansView />)

    const forgetButtons = screen.getAllByRole('button', { name: /forget/i })
    expect(forgetButtons).toHaveLength(2)
    fireEvent.click(forgetButtons[0])

    expect(screen.queryByText('Long day')).not.toBeInTheDocument()
    expect(screen.getByText('Short day')).toBeInTheDocument()
  })

  it('shows a fallback line instead of crashing when a saved query can no longer be decoded', () => {
    savePlan('Good day', encodeParams(SHORT).toString(), 1000)
    savePlan('Broken day', 'poi_ids=fort-santiago', 2000)
    render(<SavedPlansView />)

    expect(screen.getByText('Broken day')).toBeInTheDocument()
    expect(screen.getByText(/can no longer be read/i)).toBeInTheDocument()
  })
})
