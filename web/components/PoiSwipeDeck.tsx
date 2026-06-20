'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import type { POI } from '@/lib/scheduler'
import { hoursLabel } from '@/lib/poi-format'
import { CategoryGlyph } from './CategoryGlyph'

// Tinder-style stacked card picker for phones. The traveler swipes (or taps the
// buttons) through one place at a time so they actually look at each before
// deciding. Swipe right / ✓ = add to the plan, swipe left / ✕ = skip. Selection
// state lives in the parent (shared with the desktop grid), so this component just
// drives a cursor through the deck and reports add/skip via `setSelected`.

const SWIPE_THRESHOLD = 80 // px of horizontal travel needed to commit a decision
const FLY_OUT = 520 // px the card flies past the edge on commit
const FLY_MS = 240 // commit / spring animation duration

type Decision = { id: string; prev: boolean }

function DeckCard({
  poi,
  categoryLabel,
  style,
  className = '',
  interactive,
  drag,
  ...rest
}: {
  poi: POI
  categoryLabel: string
  style?: React.CSSProperties
  className?: string
  interactive?: boolean
  drag?: number
} & React.HTMLAttributes<HTMLDivElement>) {
  const addOpacity = drag ? Math.min(1, Math.max(0, drag / SWIPE_THRESHOLD)) : 0
  const skipOpacity = drag ? Math.min(1, Math.max(0, -drag / SWIPE_THRESHOLD)) : 0
  return (
    <div
      style={style}
      className={`absolute inset-0 flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-md ${
        interactive ? 'cursor-grab touch-pan-y select-none active:cursor-grabbing' : ''
      } ${className}`}
      {...rest}
    >
      <div className="relative flex-1 overflow-hidden bg-[var(--color-bg-subtle)]">
        {poi.image ? (
          <Image
            src={poi.image}
            alt=""
            fill
            sizes="100vw"
            draggable={false}
            className="object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[var(--color-text-muted)]">
            <CategoryGlyph category={poi.category} className="h-16 w-16" />
          </span>
        )}
        {/* Decision hints that fade in as you drag */}
        {interactive && (
          <>
            <span
              style={{ opacity: addOpacity }}
              className="pointer-events-none absolute left-4 top-4 rotate-[-12deg] rounded-md border-2 border-[var(--color-flag-warning-border)] bg-white/80 px-3 py-1 text-lg font-extrabold uppercase tracking-wide text-[var(--color-flag-warning-text)]"
            >
              Add
            </span>
            <span
              style={{ opacity: skipOpacity }}
              className="pointer-events-none absolute right-4 top-4 rotate-[12deg] rounded-md border-2 border-[var(--color-flag-error-border)] bg-white/80 px-3 py-1 text-lg font-extrabold uppercase tracking-wide text-[var(--color-flag-error-text)]"
            >
              Skip
            </span>
          </>
        )}
      </div>
      <div className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
          {categoryLabel}
        </p>
        <h3 className="mt-1 text-lg font-bold leading-tight">{poi.name}</h3>
        <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{hoursLabel(poi)}</p>
        {poi.notes ? (
          <p className="mt-1.5 line-clamp-2 text-sm italic text-[var(--color-text-muted)]">
            {poi.notes}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export default function PoiSwipeDeck({
  pois,
  isSelected,
  setSelected,
  categoryLabel,
}: {
  pois: POI[]
  isSelected: (id: string) => boolean
  setSelected: (id: string, value: boolean) => void
  categoryLabel: (key: string) => string
}) {
  const [index, setIndex] = useState(0)
  const [history, setHistory] = useState<Decision[]>([])
  const [drag, setDrag] = useState(0) // live horizontal offset of the top card
  const [fly, setFly] = useState<0 | 1 | -1>(0) // commit direction during fly-out
  const startX = useRef(0)
  const startY = useRef(0)
  const axis = useRef<'none' | 'x' | 'y'>('none')
  const animating = useRef(false)

  const total = pois.length
  const current = pois[index]
  const addedCount = pois.reduce((n, p) => (isSelected(p.id) ? n + 1 : n), 0)
  const done = index >= total

  function commit(dir: 1 | -1) {
    if (animating.current || !current) return
    animating.current = true
    const id = current.id
    const prev = isSelected(id)
    setSelected(id, dir === 1) // right = add, left = remove
    setFly(dir)
    window.setTimeout(() => {
      setHistory((h) => [...h, { id, prev }])
      setIndex((i) => i + 1)
      setDrag(0)
      setFly(0)
      animating.current = false
    }, FLY_MS)
  }

  function undo() {
    if (animating.current || history.length === 0) return
    const last = history[history.length - 1]
    setHistory((h) => h.slice(0, -1))
    setSelected(last.id, last.prev)
    setIndex((i) => Math.max(0, i - 1))
    setDrag(0)
  }

  function onPointerDown(e: React.PointerEvent) {
    if (animating.current) return
    startX.current = e.clientX
    startY.current = e.clientY
    axis.current = 'none'
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent) {
    if (animating.current || axis.current === 'y') return
    const dx = e.clientX - startX.current
    const dy = e.clientY - startY.current
    if (axis.current === 'none') {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
      // Lock to the dominant axis: horizontal = swipe, vertical = let the page scroll.
      axis.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (axis.current === 'y') return
    }
    setDrag(dx)
  }
  function endPointer(e: React.PointerEvent) {
    if (animating.current) return
    const dx = e.clientX - startX.current
    if (axis.current === 'x' && Math.abs(dx) > SWIPE_THRESHOLD) {
      commit(dx > 0 ? 1 : -1)
    } else {
      setDrag(0) // spring back
    }
    axis.current = 'none'
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      commit(1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      commit(-1)
    }
  }

  // Offset/rotation of the top card: follows the finger, or flies off on commit.
  const offset = fly !== 0 ? fly * FLY_OUT : drag
  const dragging = axis.current === 'x' && fly === 0 && drag !== 0
  const topStyle: React.CSSProperties = {
    transform: `translateX(${offset}px) rotate(${offset * 0.05}deg)`,
    transition: dragging ? 'none' : `transform ${FLY_MS}ms ease-out`,
    zIndex: 3,
  }

  return (
    <section
      aria-label="Swipe through places to add or skip"
      className="sm:hidden"
    >
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="text-[var(--color-text-muted)]">
          {done ? `${total} of ${total}` : `${index + 1} of ${total}`}
        </span>
        <span className="font-semibold">
          {addedCount} added
        </span>
      </div>

      <div
        className="relative mx-auto h-[62vh] min-h-[420px] w-full max-w-sm"
        tabIndex={done ? -1 : 0}
        onKeyDown={onKeyDown}
        role="group"
        aria-roledescription="card deck"
      >
        {done ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-6 text-center">
            <p className="text-lg font-bold">You&rsquo;ve seen every place.</p>
            <p className="mt-1 text-[var(--color-text-muted)]">
              {addedCount} added to your plan.
            </p>
            <div className="mt-5 flex gap-3">
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={undo}
                  className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-semibold hover:bg-white"
                >
                  ↶ Undo last
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIndex(0)
                  setHistory([])
                }}
                className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-semibold hover:bg-white"
              >
                Start over
              </button>
            </div>
            <p className="mt-6 text-sm text-[var(--color-text-muted)]">
              Scroll down to set your trip details and plan your day.
            </p>
          </div>
        ) : (
          <>
            {/* Up to two cards peeking behind for depth */}
            {pois[index + 2] && (
              <DeckCard
                key={pois[index + 2].id}
                poi={pois[index + 2]}
                categoryLabel={categoryLabel(pois[index + 2].category)}
                aria-hidden
                style={{
                  transform: 'translateY(16px) scale(0.92)',
                  zIndex: 1,
                  opacity: 0.6,
                }}
              />
            )}
            {pois[index + 1] && (
              <DeckCard
                key={pois[index + 1].id}
                poi={pois[index + 1]}
                categoryLabel={categoryLabel(pois[index + 1].category)}
                aria-hidden
                style={{
                  transform: 'translateY(8px) scale(0.96)',
                  zIndex: 2,
                  opacity: 0.85,
                }}
              />
            )}
            <DeckCard
              key={current.id}
              poi={current}
              categoryLabel={categoryLabel(current.category)}
              interactive
              drag={offset}
              style={topStyle}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endPointer}
              onPointerCancel={endPointer}
            />
          </>
        )}
      </div>

      {/* Action buttons — the accessible / non-swipe path */}
      {!done && (
        <div className="mt-5 flex items-center justify-center gap-6">
          <button
            type="button"
            onClick={() => commit(-1)}
            aria-label={`Skip ${current?.name ?? 'this place'}`}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--color-border)] bg-white text-xl text-[var(--color-flag-error-text)] shadow-sm transition hover:scale-105 hover:border-[var(--color-flag-error-border)]"
          >
            ✕
          </button>
          <button
            type="button"
            onClick={undo}
            disabled={history.length === 0}
            aria-label="Undo last decision"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border)] bg-white text-base text-[var(--color-text-muted)] shadow-sm transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ↶
          </button>
          <button
            type="button"
            onClick={() => commit(1)}
            aria-label={`Add ${current?.name ?? 'this place'} to plan`}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary)] text-xl text-white shadow-sm transition hover:scale-105 hover:bg-[var(--color-primary-hover)]"
          >
            ✓
          </button>
        </div>
      )}

      <p className="mt-3 text-center text-xs text-[var(--color-text-muted)]">
        Swipe right or tap ✓ to add · swipe left or tap ✕ to skip
      </p>
    </section>
  )
}
