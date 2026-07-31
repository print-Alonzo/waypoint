// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useReorderFlip } from '@/lib/hooks/use-reorder-flip'

const originalRAF = global.requestAnimationFrame
const originalCAF = global.cancelAnimationFrame

function elementAt(top: number): HTMLDivElement {
  const el = document.createElement('div')
  Object.defineProperty(el, 'offsetTop', { value: top, configurable: true })
  return el
}

// jsdom has no layout engine, so a real requestAnimationFrame never fires inside
// a synchronous test. Running the callback immediately lets the "next frame"
// transition step happen inside the same act() the rerender is wrapped in.
function installSyncRAF() {
  global.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    cb(0)
    return 1
  }) as unknown as typeof requestAnimationFrame
  global.cancelAnimationFrame = (() => {}) as unknown as typeof cancelAnimationFrame
}

afterEach(() => {
  global.requestAnimationFrame = originalRAF
  global.cancelAnimationFrame = originalCAF
})

describe('useReorderFlip', () => {
  it('does not animate on mount', () => {
    installSyncRAF()
    const el = elementAt(0)
    const ref = { current: el as HTMLElement | null }

    renderHook(() => useReorderFlip(ref, 0, { duration: 220, easing: 'linear', disabled: false }))

    expect(el.style.transform).toBe('')
    expect(el.style.transition).toBe('')
  })

  it('FLIPs from the node\'s previous position when the index changes', () => {
    installSyncRAF()
    const el = elementAt(0)
    const ref = { current: el as HTMLElement | null }

    const { rerender } = renderHook(
      ({ index }) =>
        useReorderFlip(ref, index, { duration: 220, easing: 'linear', disabled: false }),
      { initialProps: { index: 0 } },
    )

    // Simulate the DOM reorder: the node is now laid out 100px lower, and its
    // position in the list changed too.
    Object.defineProperty(el, 'offsetTop', { value: 100, configurable: true })
    rerender({ index: 1 })

    // The sync rAF stub already ran the "clear transform, apply transition" step
    // by the time rerender returns, so this asserts the settled end state: the
    // jump is gone and the transition that carried it away is in place.
    expect(el.style.transform).toBe('')
    expect(el.style.transition).toBe('transform 220ms linear')
  })

  it('does not animate when the index is unchanged', () => {
    installSyncRAF()
    const el = elementAt(0)
    const ref = { current: el as HTMLElement | null }

    const { rerender } = renderHook(
      ({ index }) =>
        useReorderFlip(ref, index, { duration: 220, easing: 'linear', disabled: false }),
      { initialProps: { index: 0 } },
    )

    Object.defineProperty(el, 'offsetTop', { value: 999, configurable: true })
    rerender({ index: 0 })

    expect(el.style.transform).toBe('')
    expect(el.style.transition).toBe('')
  })

  it('does not animate when disabled (reduced motion, or mid-drag)', () => {
    installSyncRAF()
    const el = elementAt(0)
    const ref = { current: el as HTMLElement | null }

    const { rerender } = renderHook(
      ({ index }) => useReorderFlip(ref, index, { duration: 220, easing: 'linear', disabled: true }),
      { initialProps: { index: 0 } },
    )

    Object.defineProperty(el, 'offsetTop', { value: 100, configurable: true })
    rerender({ index: 1 })

    expect(el.style.transform).toBe('')
    expect(el.style.transition).toBe('')
  })

  it('does not replay the drop as a FLIP — dnd-kit already carried the card there live', () => {
    installSyncRAF()
    const el = elementAt(0)
    const ref = { current: el as HTMLElement | null }

    const { rerender } = renderHook(
      ({ index, disabled }) =>
        useReorderFlip(ref, index, { duration: 220, easing: 'linear', disabled }),
      { initialProps: { index: 0, disabled: false } },
    )

    // Drag starts: dnd-kit takes over (disabled), index doesn't change yet — the
    // DOM doesn't actually reorder until the drop commits.
    rerender({ index: 0, disabled: true })
    expect(el.style.transform).toBe('')

    // Drop: index updates to its final value AND disabled clears in the same
    // commit. The layout position also changes here (the real DOM reorder), but
    // the card already visually arrived there via the drag — this must NOT jump
    // it back and glide it forward again.
    Object.defineProperty(el, 'offsetTop', { value: 100, configurable: true })
    rerender({ index: 1, disabled: false })

    expect(el.style.transform).toBe('')
    expect(el.style.transition).toBe('')

    // A later, ordinary index change (↑ ↓) still animates normally — the
    // suppression is scoped to the one disabled→enabled commit, not sticky.
    Object.defineProperty(el, 'offsetTop', { value: 250, configurable: true })
    rerender({ index: 2, disabled: false })

    expect(el.style.transition).toBe('transform 220ms linear')
  })

  it('cancels a still-settling FLIP and cleans up inline styles on unmount', () => {
    // A manual (never auto-invoked) rAF stub, so the mid-flight state — jump
    // applied, transition not yet swapped in — is observable before cleanup runs.
    global.requestAnimationFrame = (() => 1) as unknown as typeof requestAnimationFrame
    global.cancelAnimationFrame = vi.fn()

    const el = elementAt(0)
    const ref = { current: el as HTMLElement | null }

    const { rerender, unmount } = renderHook(
      ({ index }) =>
        useReorderFlip(ref, index, { duration: 220, easing: 'linear', disabled: false }),
      { initialProps: { index: 0 } },
    )

    Object.defineProperty(el, 'offsetTop', { value: 100, configurable: true })
    rerender({ index: 1 })

    // Mid-flight: the inverse jump is applied, no transition yet.
    expect(el.style.transform).toBe('translate3d(0, -100px, 0)')
    expect(el.style.transition).toBe('none')

    unmount()

    expect(global.cancelAnimationFrame).toHaveBeenCalled()
    expect(el.style.transform).toBe('')
    expect(el.style.transition).toBe('')
  })

  it('cancels a still-settling FLIP when superseded by another index change, computing the new delta from the last CONFIRMED position rather than the abandoned target', () => {
    global.requestAnimationFrame = (() => 1) as unknown as typeof requestAnimationFrame
    global.cancelAnimationFrame = vi.fn()

    const el = elementAt(0)
    const ref = { current: el as HTMLElement | null }

    const { rerender } = renderHook(
      ({ index }) =>
        useReorderFlip(ref, index, { duration: 220, easing: 'linear', disabled: false }),
      { initialProps: { index: 0 } },
    )

    Object.defineProperty(el, 'offsetTop', { value: 100, configurable: true })
    rerender({ index: 1 })
    expect(el.style.transform).toBe('translate3d(0, -100px, 0)')

    // A second, rapid change before the first FLIP ever reached transitionend:
    // the baseline never advanced past mount (top 0), so the new delta is
    // measured all the way from there to the node's current position — NOT from
    // the interrupted glide's abandoned target. See use-reorder-flip.ts's
    // cleanup comment for why advancing early would silently drop animations.
    Object.defineProperty(el, 'offsetTop', { value: 40, configurable: true })
    rerender({ index: 2 })

    expect(global.cancelAnimationFrame).toHaveBeenCalled()
    expect(el.style.transform).toBe('translate3d(0, -40px, 0)')
  })

  it('resumes an interrupted glide instead of silently dropping it — the exact regression this hook exists to fix', () => {
    // A real reorder can produce two React commits with the SAME final index in
    // quick succession (ResultView's optimistic order commit, immediately
    // followed by the router-confirmed one) — re-running this effect before the
    // first glide ever reaches transitionend. If the baseline advanced on every
    // run rather than only on genuine completion, the second run would see
    // "prevIndex === index" and conclude nothing needs to happen, and the card
    // would silently never animate. `duration` changing is a stand-in for
    // whatever unrelated dep forces the second commit's re-run in the app —
    // what matters for this hook's contract is that `index` does NOT change
    // between the two runs.
    let raf: FrameRequestCallback | null = null
    global.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      raf = cb
      return 1
    }) as unknown as typeof requestAnimationFrame
    global.cancelAnimationFrame = (() => {}) as unknown as typeof cancelAnimationFrame

    const el = elementAt(0)
    const ref = { current: el as HTMLElement | null }

    const { rerender } = renderHook(
      ({ index, duration }) =>
        useReorderFlip(ref, index, { duration, easing: 'linear', disabled: false }),
      { initialProps: { index: 0, duration: 220 } },
    )

    Object.defineProperty(el, 'offsetTop', { value: 100, configurable: true })
    rerender({ index: 1, duration: 220 })
    expect(el.style.transform).toBe('translate3d(0, -100px, 0)')
    raf = null

    // Re-run before `raf` ever fired, index unchanged.
    rerender({ index: 1, duration: 221 })

    // The glide restarted from the SAME (never-confirmed) baseline rather than
    // being treated as a no-op.
    expect(el.style.transform).toBe('translate3d(0, -100px, 0)')
    expect(raf).not.toBeNull()

    const event = new Event('transitionend', { bubbles: false })
    Object.defineProperty(event, 'propertyName', { value: 'transform' })
    el.dispatchEvent(event)
    expect(el.style.transition).toBe('')

    // NOW the baseline has genuinely advanced: a later run with the same index
    // correctly does nothing further, even though the node's layout moved for
    // an unrelated reason.
    Object.defineProperty(el, 'offsetTop', { value: 999, configurable: true })
    rerender({ index: 1, duration: 222 })
    expect(el.style.transform).toBe('')
  })
})
