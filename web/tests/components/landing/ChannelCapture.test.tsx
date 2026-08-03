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
  track.mockClear()
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
})
