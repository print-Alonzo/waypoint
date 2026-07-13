// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { usePrefersReducedMotion } from '@/lib/hooks/use-reduced-motion'

const originalMatchMedia = window.matchMedia

// A matchMedia stub that actually tracks listeners, so a simulated OS-level
// preference change can be dispatched through it.
function installMatchMedia(initialMatches: boolean) {
  let matches = initialMatches
  const listeners = new Set<() => void>()
  window.matchMedia = ((query: string) => ({
    get matches() {
      return matches
    },
    media: query,
    onchange: null,
    addEventListener(_event: string, cb: () => void) {
      listeners.add(cb)
    },
    removeEventListener(_event: string, cb: () => void) {
      listeners.delete(cb)
    },
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia

  return {
    set(next: boolean) {
      matches = next
      listeners.forEach((cb) => cb())
    },
  }
}

afterEach(() => {
  window.matchMedia = originalMatchMedia
})

describe('usePrefersReducedMotion', () => {
  it('reflects the initial matchMedia value on first render', () => {
    installMatchMedia(true)
    const { result } = renderHook(() => usePrefersReducedMotion())
    expect(result.current).toBe(true)
  })

  it('defaults to false when the OS has no preference', () => {
    installMatchMedia(false)
    const { result } = renderHook(() => usePrefersReducedMotion())
    expect(result.current).toBe(false)
  })

  it('updates when the media query change event fires', () => {
    const media = installMatchMedia(false)
    const { result } = renderHook(() => usePrefersReducedMotion())
    expect(result.current).toBe(false)

    act(() => {
      media.set(true)
    })

    expect(result.current).toBe(true)
  })
})
