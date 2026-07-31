'use client'

import type { ReactNode } from 'react'
import { useMemo, useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useReorderFlip } from '@/lib/hooks/use-reorder-flip'

// Kept in sync with --wp-motion-reorder / --wp-ease-reorder in app/globals.css.
// useReorderFlip builds its transition string in JS, so it needs the raw values
// rather than the CSS variables the rest of the app's motion reads from.
export const REORDER_MS = 220
export const REORDER_EASING = 'cubic-bezier(0.2, 0, 0, 1)'

// dnd-kit hands the drag gesture back to the caller so it can hang the listeners
// on its own grip handle — keeping them OFF the card body, where they'd otherwise
// fight the ↑ ↓ / pin / duration controls and the page's touch-scroll.
export type DragBinding = {
  listeners: Record<string, unknown> | undefined
  isDragging: boolean
}

type Props = {
  /** POI id. Must match the ids in SortableContext's `items`. */
  id: string
  /** Current position in the list — drives the hand-rolled FLIP below. */
  index: number
  /** The stop card's own classes (flag tint, budget dimming) — see cardClass(). */
  cardClassName: string
  reduceMotion: boolean
  /** Ring this card briefly: it's the one that just moved. */
  landed?: boolean
  /** Rendered inside the <li> ABOVE the card: the lunch pill + transit leg. */
  lead?: ReactNode
  children: (drag: DragBinding) => ReactNode
}

export default function SortableStop({
  id,
  index,
  cardClassName,
  reduceMotion,
  landed,
  lead,
  children,
}: Props) {
  // `attributes` is deliberately NOT spread onto the card. dnd-kit's sortable
  // attributes would make every stop card role="button" tabIndex=0 — a focusable
  // control wrapping the whole card, announced as "sortable button" — which is both
  // wrong (the ↑ ↓ buttons inside it are the real controls) and a tab-order trap.
  // Its aria-describedby is also generated from a module counter rather than
  // React's useId, so it differs between the server render and hydration.
  // We take only the pointer `listeners`, and hang them on the grip handle.
  //
  // `animateLayoutChanges` is forced off: dnd-kit's own layout-change FLIP (even
  // at its default, "only after a drag in this session") compares the card's
  // CURRENT index against `previous.current.newIndex` — a value dnd-kit only
  // updates while actively dragging, so for a card that's never been dragged it
  // stays frozen at that card's index AT MOUNT. A card that reorders back to its
  // mount position — an ordinary thing to happen after two moves — then looks
  // "unchanged" to dnd-kit and gets a defined-but-inert transition, which read as
  // non-empty and wrongly suppressed useReorderFlip below when this component
  // gated on it. useReorderFlip owns every discrete settle instead — button
  // moves, Re-optimize, Reset order, remove-stop, browser back — by measuring
  // the card's own `offsetTop`, which has no such cache to go stale.
  //
  // dnd-kit's `transition` config is still passed through and still drives the
  // LIVE drag itself (isSorting): a real pointer drag needs every other card to
  // slide out of the way in real time, which is dnd-kit's job, not a discrete
  // index-change FLIP. That live tracking is ALSO why useReorderFlip does NOT
  // replay its own jump-then-glide right after a drop, unlike every other
  // settle: the card's on-screen position already arrived smoothly via the
  // drag gesture, while its real DOM layout (what useReorderFlip measures) sat
  // frozen at its pre-drag slot the whole time — animating from there once
  // `isSorting` clears would visibly repeat the motion the drag just played.
  // useReorderFlip detects the disabled→enabled edge and skips that one run;
  // see its own comment for the mechanics.
  const { listeners, setNodeRef, transform, transition, isDragging, isSorting } = useSortable({
    id,
    animateLayoutChanges: () => false,
    transition: reduceMotion ? null : { duration: REORDER_MS, easing: REORDER_EASING },
  })

  const cardRef = useRef<HTMLDivElement | null>(null)
  useReorderFlip(cardRef, index, {
    duration: REORDER_MS,
    easing: REORDER_EASING,
    disabled: reduceMotion || isSorting,
  })

  // dnd-kit's own useCombinedRefs only accepts callback refs, not RefObjects — it
  // calls each one as a function, so a plain useRef object would throw. Merge by
  // hand instead, memoized on setNodeRef so the merged callback stays stable
  // across renders where dnd-kit's own ref hasn't changed.
  const setRefs = useMemo(
    () => (node: HTMLDivElement | null) => {
      cardRef.current = node
      setNodeRef(node)
    },
    [setNodeRef],
  )

  return (
    <li>
      {lead}
      <div
        ref={setRefs}
        // The CARD is the sortable node, deliberately — NOT the <li>. The <li> also
        // carries the transit leg, which stop 1 doesn't have, so li heights are
        // structurally uneven and a FLIP measured on them would jerk any card
        // entering or leaving position 1 by the leg's height. Card-to-card spacing
        // is NOT otherwise uniform either — a lunch pill adds a second row above
        // one particular leg — which is exactly why useReorderFlip measures the
        // card's own offsetTop rather than assuming a fixed row height. The legs
        // re-render in place and crossfade instead.
        className={`wp-stop relative ${cardClassName}${isDragging ? ' z-10 shadow-lg' : ''}`}
        style={{
          // Translate, not Transform: a card must never scale, only slide.
          transform: CSS.Translate.toString(transform),
          transition: transition ?? undefined,
        }}
        data-dragging={isDragging || undefined}
        data-landed={landed && !isDragging ? '' : undefined}
      >
        {children({ listeners, isDragging })}
      </div>
    </li>
  )
}
