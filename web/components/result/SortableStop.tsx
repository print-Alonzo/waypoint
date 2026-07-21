'use client'

import type { ReactNode } from 'react'
import type { AnimateLayoutChanges } from '@dnd-kit/sortable'
import { useSortable, defaultAnimateLayoutChanges } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Kept in sync with --wp-motion-reorder / --wp-ease-reorder in app/globals.css.
// dnd-kit builds its transition string in JS, so it needs the raw values rather
// than the CSS variables the rest of the app's motion reads from.
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
  cardClassName,
  reduceMotion,
  landed,
  lead,
  children,
}: Props) {
  // dnd-kit only animates layout changes that FOLLOW a drag by default. Forcing
  // `wasDragging` makes it FLIP on ANY index change, so the ↑ ↓ buttons,
  // Re-optimize, Reset order and browser-back all animate through this one path
  // — no hand-rolled FLIP anywhere else in the app.
  const animateLayoutChanges: AnimateLayoutChanges = (args) =>
    reduceMotion ? false : defaultAnimateLayoutChanges({ ...args, wasDragging: true })

  // `attributes` is deliberately NOT spread onto the card. dnd-kit's sortable
  // attributes would make every stop card role="button" tabIndex=0 — a focusable
  // control wrapping the whole card, announced as "sortable button" — which is both
  // wrong (the ↑ ↓ buttons inside it are the real controls) and a tab-order trap.
  // Its aria-describedby is also generated from a module counter rather than
  // React's useId, so it differs between the server render and hydration.
  // We take only the pointer `listeners`, and hang them on the grip handle.
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    animateLayoutChanges,
    transition: reduceMotion ? null : { duration: REORDER_MS, easing: REORDER_EASING },
  })

  return (
    <li>
      {lead}
      <div
        ref={setNodeRef}
        // The CARD is the sortable node, deliberately — NOT the <li>. The <li> also
        // carries the transit leg, which stop 1 doesn't have, so li heights are
        // structurally uneven and a FLIP measured on them would jerk any card
        // entering or leaving position 1 by the leg's height. Card-to-card spacing
        // IS uniform (exactly one leg row between every pair), so measuring cards
        // gives a clean glide. The legs re-render in place and crossfade instead.
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
