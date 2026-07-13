// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import CompareView from '@/components/compare/CompareView'
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

beforeEach(() => {
  localStorage.clear()
})

describe('CompareView', () => {
  it('shows an empty state with a link to /plan when nothing is saved', () => {
    render(<CompareView />)
    expect(screen.getByText(/haven.t saved any plans yet/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /plan a day/i })).toHaveAttribute('href', '/plan')
  })

  it('defaults to comparing the two most recently saved plans', () => {
    savePlan('Short day', encodeParams(SHORT).toString(), 1000)
    savePlan('Long day', encodeParams(LONG).toString(), 2000)
    render(<CompareView />)
    expect(screen.getAllByRole('option', { name: 'Short day' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('option', { name: 'Long day' }).length).toBeGreaterThan(0)
    // Table headers show both plan names.
    expect(screen.getAllByText('Short day').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Long day').length).toBeGreaterThan(0)
  })

  it('renders a metrics row for stop count reflecting each plan', () => {
    savePlan('Short day', encodeParams(SHORT).toString(), 1000)
    savePlan('Long day', encodeParams(LONG).toString(), 2000)
    render(<CompareView />)
    const stopsRow = screen.getByText('Stops').closest('tr')!
    expect(stopsRow).toHaveTextContent('1')
    expect(stopsRow).toHaveTextContent('3')
  })

  it('shows a self-comparison notice when only one plan is saved', () => {
    savePlan('Only plan', encodeParams(SHORT).toString(), 1000)
    render(<CompareView />)
    expect(screen.getByText(/comparing a plan with itself/i)).toBeInTheDocument()
    expect(screen.getByText(/save another plan/i)).toBeInTheDocument()
  })

  it('removes a plan and updates the list when "Forget" is clicked', () => {
    savePlan('Short day', encodeParams(SHORT).toString(), 1000)
    savePlan('Long day', encodeParams(LONG).toString(), 2000)
    render(<CompareView />)
    const forgetButtons = screen.getAllByRole('button', { name: /forget/i })
    fireEvent.click(forgetButtons[0])
    // Only one plan remains, so the "comparing with itself" hint shows.
    expect(screen.getByText(/comparing a plan with itself/i)).toBeInTheDocument()
  })

  it('links each panel\'s "Open" to /result with that plan\'s query', () => {
    const query = encodeParams(SHORT).toString()
    savePlan('Short day', query, 1000)
    render(<CompareView />)
    const openLinks = screen.getAllByRole('link', { name: /^open$/i })
    expect(openLinks[0]).toHaveAttribute('href', `/result?${query}`)
  })
})
