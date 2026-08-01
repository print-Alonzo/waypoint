// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import SessionResetOnParam from '@/components/validation/SessionResetOnParam'

const resetParticipant = vi.hoisted(() => vi.fn())
vi.mock('@/lib/validation/session', () => ({ resetParticipant }))

beforeEach(() => {
  resetParticipant.mockClear()
})

describe('SessionResetOnParam', () => {
  it('resets the participant and strips ?new=1 when present', () => {
    window.history.pushState({}, '', '/plan?new=1&foo=bar')

    render(<SessionResetOnParam />)

    expect(resetParticipant).toHaveBeenCalledTimes(1)
    expect(window.location.search).not.toContain('new=1')
    expect(window.location.search).toContain('foo=bar')
    expect(window.location.pathname).toBe('/plan')
  })

  it('does not reset when ?new is absent', () => {
    window.history.pushState({}, '', '/plan?foo=bar')

    render(<SessionResetOnParam />)

    expect(resetParticipant).not.toHaveBeenCalled()
    expect(window.location.search).toBe('?foo=bar')
  })

  it('renders nothing', () => {
    window.history.pushState({}, '', '/')
    const { container } = render(<SessionResetOnParam />)
    expect(container).toBeEmptyDOMElement()
  })
})
