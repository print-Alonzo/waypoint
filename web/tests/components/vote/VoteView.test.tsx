// @vitest-environment jsdom
import type { ComponentType } from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { POIS } from '@/lib/poi/data'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === 'string' ? href : '#'} {...rest}>
      {children}
    </a>
  ),
}))

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

// VoteView keeps its votes store as module-private state (cached alongside
// useSyncExternalStore, not re-read from localStorage on every render), so each
// test needs a genuinely fresh module instance rather than just a cleared
// localStorage — otherwise votes cast in one test leak into the next.
let VoteView: ComponentType

beforeEach(async () => {
  push.mockClear()
  localStorage.clear()
  vi.resetModules()
  ;({ default: VoteView } = await import('@/components/vote/VoteView'))
})

const firstPoi = POIS[0]

describe('VoteView', () => {
  it('renders every POI grouped by category, starting at zero votes', () => {
    render(<VoteView />)
    expect(screen.getByRole('heading', { name: 'Vote on places' })).toBeInTheDocument()
    const voteRow = screen.getByText(firstPoi.name).closest('li')!
    expect(voteRow).toHaveTextContent('0')
  })

  it('disables "Plan the winners" until at least one vote is cast', () => {
    render(<VoteView />)
    expect(screen.getByRole('button', { name: /plan the winners/i })).toBeDisabled()
  })

  it('casts a vote and updates the tally + count badge', () => {
    render(<VoteView />)
    fireEvent.click(screen.getByRole('button', { name: `Vote for ${firstPoi.name}` }))
    expect(screen.getByLabelText(`1 vote for ${firstPoi.name}`)).toBeInTheDocument()
    expect(screen.getByText('1 place · 1 vote')).toBeInTheDocument()
  })

  it('never takes the vote count below zero', () => {
    render(<VoteView />)
    fireEvent.click(screen.getByRole('button', { name: `Remove a vote from ${firstPoi.name}` }))
    expect(screen.getByLabelText(`0 votes for ${firstPoi.name}`)).toBeInTheDocument()
  })

  it('enables "Plan the winners" once a vote is cast, and navigates with the winner encoded', () => {
    render(<VoteView />)
    fireEvent.click(screen.getByRole('button', { name: `Vote for ${firstPoi.name}` }))
    const cta = screen.getByRole('button', { name: /plan the winners/i })
    expect(cta).not.toBeDisabled()
    fireEvent.click(cta)
    expect(push).toHaveBeenCalledTimes(1)
    const url = push.mock.calls[0][0] as string
    expect(url.startsWith('/plan?')).toBe(true)
    expect(new URLSearchParams(url.split('?')[1]).get('poi_ids')).toBe(firstPoi.id)
  })

  it('shows "Reset votes" only once at least one vote exists, and clears the tally when clicked', () => {
    render(<VoteView />)
    expect(screen.queryByRole('button', { name: /reset votes/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: `Vote for ${firstPoi.name}` }))
    fireEvent.click(screen.getByRole('button', { name: /reset votes/i }))

    expect(screen.getByText('0 places · 0 votes')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reset votes/i })).not.toBeInTheDocument()
  })

  it('has a "skip voting" link straight to /plan', () => {
    render(<VoteView />)
    expect(screen.getByRole('link', { name: /skip voting/i })).toHaveAttribute('href', '/plan')
  })

  it('renders with zero votes instead of crashing when localStorage holds corrupted JSON', () => {
    localStorage.setItem('waypoint:votes', 'not json')
    render(<VoteView />)
    const voteRow = screen.getByText(firstPoi.name).closest('li')!
    expect(voteRow).toHaveTextContent('0')
  })
})
