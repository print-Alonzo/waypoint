// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import SessionResetOnParam from '@/components/validation/SessionResetOnParam'

const resetParticipant = vi.hoisted(() => vi.fn())
vi.mock('@/lib/validation/session', () => ({ resetParticipant }))

const flag = vi.hoisted(() => ({ validation: true }))
vi.mock('@/lib/features', () => ({
  isEnabled: (f: string) => flag[f as keyof typeof flag],
}))

beforeEach(() => {
  resetParticipant.mockClear()
})

afterEach(() => {
  flag.validation = true
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

  // Adversarial review: without this gate, ?new=1 stays a live, destructive,
  // unauthenticated action on every URL of the site even after the study
  // ends — it wipes saved trip plans for any visitor who lands on such a
  // link, not just facilitators.
  it('does not reset, and does not strip the param, when the validation flag is off', () => {
    flag.validation = false
    window.history.pushState({}, '', '/plan?new=1&foo=bar')

    render(<SessionResetOnParam />)

    expect(resetParticipant).not.toHaveBeenCalled()
    expect(window.location.search).toContain('new=1')
  })

  it('renders nothing', () => {
    window.history.pushState({}, '', '/')
    const { container } = render(<SessionResetOnParam />)
    expect(container).toBeEmptyDOMElement()
  })
})
