// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const flag = vi.hoisted(() => ({ groupVote: false }))
vi.mock('@/lib/features', () => ({
  isEnabled: (f: string) => flag[f as keyof typeof flag],
}))

const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
)
vi.mock('next/navigation', () => ({ redirect }))

vi.mock('@/components/vote/VoteView', () => ({
  default: () => <div>VoteView placeholder</div>,
}))

import VotePage from '@/app/vote/page'

afterEach(() => {
  redirect.mockClear()
  flag.groupVote = false
})

describe('app/vote/page', () => {
  it('redirects home when groupVote is off (the shipped default)', () => {
    expect(() => render(<VotePage />)).toThrow('NEXT_REDIRECT:/')
    expect(redirect).toHaveBeenCalledWith('/')
  })

  it('renders VoteView when the groupVote flag is explicitly on', () => {
    flag.groupVote = true
    render(<VotePage />)
    expect(screen.getByText('VoteView placeholder')).toBeInTheDocument()
    expect(redirect).not.toHaveBeenCalled()
  })
})
