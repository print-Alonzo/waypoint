// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import { getSession, patchSession } from '@/lib/validation/session'

const track = vi.hoisted(() => vi.fn().mockResolvedValue({ ok: true }))
vi.mock('@/lib/validation/track', () => ({ track }))

const flag = vi.hoisted(() => ({ validation: true }))
vi.mock('@/lib/features', () => ({
  isEnabled: (f: string) => flag[f as keyof typeof flag],
}))

beforeEach(() => {
  localStorage.clear()
  // mockReset (not mockClear) so a test that installs its own implementation
  // can't leak it into the next one.
  track.mockReset()
  track.mockResolvedValue({ ok: true })
  window.history.pushState({}, '', '/')
  // ChannelCapture guards React Strict Mode's double-invoked effect with a
  // module-scope `fired` flag. That flag would otherwise stay `true` across
  // every test in this file after the first render — reset the module
  // registry so each test imports (and effect-runs) a fresh instance.
  vi.resetModules()
})

afterEach(() => {
  flag.validation = true
})

async function renderCapture(channel: string | null) {
  const { default: ChannelCapture } = await import('@/components/landing/ChannelCapture')
  return render(<ChannelCapture channel={channel as never} />)
}

describe('ChannelCapture', () => {
  it('stamps the channel on the session and fires a landed beacon', async () => {
    await renderCapture('reddit')

    expect(getSession().channel).toBe('reddit')
    expect(track).toHaveBeenCalledWith('landed')
  })

  it('fires a landed beacon for direct traffic (channel null) too', async () => {
    await renderCapture(null)

    expect(getSession().channel).toBeNull()
    expect(track).toHaveBeenCalledWith('landed')
  })

  it('does not overwrite an already-set channel (first touch only)', async () => {
    patchSession({ channel: 'reddit' })

    await renderCapture('facebook')

    expect(getSession().channel).toBe('reddit')
  })

  it('does not fire again once landedAt is already set', async () => {
    patchSession({ landedAt: Date.now() })

    await renderCapture('reddit')

    expect(track).not.toHaveBeenCalled()
  })

  // The stamp and the beacon are INDEPENDENT branches, and this is the case
  // that proves it: someone who browsed '/' first (landedAt set) and later
  // clicks a /reddit link must still be attributed to reddit. Nesting the
  // stamp inside the !landedAt guard would pass every other test here while
  // silently dropping the exact conversion this feature exists to measure.
  it('still stamps the channel for a returning visitor whose landedAt is already set', async () => {
    patchSession({ landedAt: Date.now() })

    await renderCapture('reddit')

    expect(getSession().channel).toBe('reddit')
    expect(track).not.toHaveBeenCalled()
  })

  it('bails out entirely when ?new is present, leaving the channel unset', async () => {
    window.history.pushState({}, '', '/reddit?new=1')

    await renderCapture('reddit')

    expect(getSession().channel).toBeNull()
    expect(track).not.toHaveBeenCalled()
  })

  it('does nothing when the validation flag is off', async () => {
    flag.validation = false

    await renderCapture('reddit')

    expect(getSession().channel).toBeNull()
    expect(track).not.toHaveBeenCalled()
  })

  it('renders nothing', async () => {
    const { container } = await renderCapture('reddit')
    expect(container).toBeEmptyDOMElement()
  })

  // The `fired` module-scope guard, exercised in both directions. Every other
  // test in this file calls vi.resetModules() to get a fresh guard, so without
  // these two the guard is never actually run.
  describe('the one-shot `fired` guard', () => {
    it('does not re-stamp on a second mount within the same page load', async () => {
      // No resetModules between the two renders — same module instance, so
      // the same `fired` the browser would see on a soft navigation.
      await renderCapture(null)
      expect(track).toHaveBeenCalledTimes(1)

      await renderCapture('reddit')

      expect(track).toHaveBeenCalledTimes(1)
      expect(getSession().channel).toBeNull()
    })

    // Ordering lock: the ?new bail at ChannelCapture.tsx must happen BEFORE
    // `fired = true`. Consuming the guard on a page view that deliberately did
    // nothing would suppress the stamp for the rest of the document's life.
    // Moving `fired = true` above the bail keeps the plain ?new test green —
    // only this one catches it.
    it('leaves the guard unconsumed when it bails on ?new', async () => {
      window.history.pushState({}, '', '/reddit?new=1')
      await renderCapture('reddit')
      expect(track).not.toHaveBeenCalled()

      // Facilitator's reset done; a normal visit follows in the same page load.
      window.history.pushState({}, '', '/reddit')
      await renderCapture('reddit')

      expect(getSession().channel).toBe('reddit')
      expect(track).toHaveBeenCalledWith('landed')
    })
  })

  // Ordering lock: patchSession must run BEFORE track, or the landed beacon
  // itself carries no channel and the first row of every channel's funnel is
  // misattributed to (direct).
  it('stamps the channel before firing the beacon, so landed carries it', async () => {
    let channelWhenTracked: string | null | undefined
    track.mockImplementation(async () => {
      channelWhenTracked = getSession().channel
      return { ok: true }
    })

    await renderCapture('reddit')

    expect(channelWhenTracked).toBe('reddit')
  })
})
