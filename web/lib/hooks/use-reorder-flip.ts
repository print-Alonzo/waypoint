'use client'

import { useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'

type Options = {
  duration: number
  easing: string
  disabled: boolean
}

// FLIP for the itinerary cards, hand-rolled instead of leaning on dnd-kit's own
// layout-change animation (see components/result/SortableStop.tsx for why: it FLIPs
// from a droppable rect cache that only refreshes around drags, so a button-driven
// reorder either doesn't animate — new index vs. the card's index at MOUNT, not its
// last position — or glides in from a stale cached position).
//
// This measures the node's OWN previous `offsetTop` (layout position, unaffected by
// any in-flight `transform`) every time `index` changes, so there's no cache to go
// stale. Classic invert-play FLIP: on the render that already shows the new layout,
// jump the node back to where it used to be with no transition, force a reflow, then
// clear the jump with a transition next frame.
//
// Deliberately writes `transform`/`transition` on the DOM node directly rather than
// through React state: the card's own `style` prop never sets these two properties
// while at rest (see SortableStop.tsx), so React's props diff sees no change on
// re-render and leaves our imperative values alone — no fight over ownership, no
// extra render.
export function useReorderFlip(
  ref: RefObject<HTMLElement | null>,
  index: number,
  { duration, easing, disabled }: Options,
) {
  const prevIndexRef = useRef(index)
  const prevTopRef = useRef<number | null>(null)
  const wasDisabledRef = useRef(disabled)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    // `disabled` covers a live drag (see SortableStop.tsx — dnd-kit owns the
    // card's position while it's actively being dragged, tracking the pointer
    // in real time). The layout position we'd measure never moves during that
    // window — dnd-kit repositions the card purely via `transform`, not real
    // DOM order, until the drop commits — so the FIRST run after `disabled`
    // clears sees a card that just visually arrived at its new spot via the
    // drag itself. Replaying our own jump-then-glide on top of that would look
    // like the animation firing twice. Treat that one run as a silent sync
    // instead; normal FLIPs resume on the next genuine change.
    const justEnabled = wasDisabledRef.current && !disabled
    wasDisabledRef.current = disabled

    const prevIndex = prevIndexRef.current
    const prevTop = prevTopRef.current
    const currentTop = el.offsetTop

    // Nothing to animate this run — safe to advance the baseline right away.
    if (disabled || justEnabled || prevIndex === index || prevTop === null) {
      prevIndexRef.current = index
      prevTopRef.current = currentTop
      return
    }

    const delta = prevTop - currentTop
    if (delta === 0) {
      prevIndexRef.current = index
      prevTopRef.current = currentTop
      return
    }

    el.style.transition = 'none'
    el.style.transform = `translate3d(0, ${delta}px, 0)`
    // Force a reflow so the browser commits the jump before the transition below —
    // without this the two style writes coalesce and nothing animates.
    void el.offsetHeight

    const raf = requestAnimationFrame(() => {
      el.style.transition = `transform ${duration}ms ${easing}`
      el.style.transform = ''
    })

    function onTransitionEnd(e: TransitionEvent) {
      if (e.target === el && e.propertyName === 'transform') {
        el!.style.transition = ''
        // Only once the glide has genuinely finished does the FLIP consider
        // itself settled at the new position — see the cleanup below for why.
        prevIndexRef.current = index
        prevTopRef.current = currentTop
      }
    }
    el.addEventListener('transitionend', onTransitionEnd)

    // Runs before the next index change's effect body, or on unmount — cancels a
    // still-settling FLIP so rapid `↑ ↑ ↑` presses don't stack, and leaves the node
    // clean rather than mid-transform.
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('transitionend', onTransitionEnd)
      el.style.transition = ''
      el.style.transform = ''
      // Deliberately do NOT advance prevIndexRef/prevTopRef here. A single user
      // action can produce more than one commit with the SAME final index — an
      // optimistic order update immediately followed by the router-confirmed one
      // (see applyOrder in ResultView.tsx) — which re-runs this effect before the
      // glide above ever reaches transitionend. If the baseline had already
      // advanced, that second run would see "prevIndex === index" and conclude
      // there's nothing to do, silently dropping the animation the first run
      // started. Leaving the baseline at its pre-jump value instead means the
      // next run recomputes the SAME delta and restarts the glide cleanly — and
      // if index has genuinely moved again since (rapid presses), it correctly
      // computes the delta from the last real position, not a discarded one.
    }
  }, [index, disabled, duration, easing, ref])
}
