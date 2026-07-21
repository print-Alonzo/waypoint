'use client'

import { useCallback, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { POIS } from '@/lib/poi/data'
import {
  CATEGORIES,
  DAYS_OF_WEEK,
  TRANSPORT_MODES,
  START_LOCATIONS,
} from '@/lib/constants'
import { encodeParams, decodeParams, pruneOrderAndLocked } from '@/lib/plan/params'
import type { ScheduleParams } from '@/lib/plan/params'
import type { POI, TransportMode } from '@/lib/scheduling/scheduler'
import { hoursLabel } from '@/lib/poi/format'
import { CategoryGlyph } from '@/components/shared/CategoryGlyph'
import PoiSwipeDeck from './PoiSwipeDeck'

function categoryLabel(key: string): string {
  return CATEGORIES.find((c) => c.key === key)?.label ?? key
}

// A prominent warning pill for a place closed on the currently-selected trip day —
// bg + icon + text, never color alone (DESIGN.md flag tints). A usability tester
// added a place without noticing the small muted hours line already said it was
// closed that day; this makes the SELECTED day's closure impossible to miss.
function ClosedOnDayPill({ day }: { day: string }) {
  return (
    <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full border border-[var(--color-flag-warning-border)] bg-[var(--color-flag-warning-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--color-flag-warning-text)]">
      <span aria-hidden>⚠</span> Closed on {day}
    </span>
  )
}

// An image-forward, tappable place card (Airbnb-style). The whole card toggles a
// visually-hidden (but focusable) checkbox; selection shows a coral ring + check.
function PoiCard({
  poi,
  selected,
  dayOfWeek,
  onToggle,
}: {
  poi: POI
  selected: boolean
  dayOfWeek: string
  onToggle: () => void
}) {
  return (
    <label
      className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition focus-within:ring-2 focus-within:ring-[var(--color-text)] ${
        selected
          ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]'
          : 'border-[var(--color-border)] hover:shadow-md'
      }`}
    >
      <input type="checkbox" className="sr-only" checked={selected} onChange={onToggle} />
      <span className="relative block aspect-[4/3] w-full overflow-hidden bg-[var(--color-bg-subtle)]">
        {poi.image ? (
          // alt="" — decorative; the name below is the accessible label.
          <Image
            src={poi.image}
            alt=""
            fill
            sizes="(max-width: 640px) 50vw, 220px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[var(--color-text-muted)]">
            <CategoryGlyph category={poi.category} />
          </span>
        )}
        <span
          aria-hidden
          className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ring-2 ring-white transition ${
            selected ? 'bg-[var(--color-primary)] text-white' : 'bg-white/85 text-transparent'
          }`}
        >
          ✓
        </span>
      </span>
      <span className="flex flex-1 flex-col p-3">
        <span className="text-sm font-semibold leading-tight">{poi.name}</span>
        <span className="mt-0.5 text-xs text-[var(--color-text-muted)]">{hoursLabel(poi)}</span>
        {poi.closed_days.includes(dayOfWeek) && <ClosedOnDayPill day={dayOfWeek} />}
      </span>
    </label>
  )
}

const inputClass =
  'w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2.5 text-base ' +
  'focus:outline-none focus:border-[var(--color-text)] focus:ring-1 focus:ring-[var(--color-text)]'

export default function Selector() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Pre-fill from URL params (powers the result page's "Edit this list" back-link).
  const prefill = useMemo(
    () => decodeParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  )

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(prefill?.poi_ids ?? []),
  )
  const [startTime, setStartTime] = useState(prefill?.start_time ?? '09:00')
  const [transportMode, setTransportMode] = useState<TransportMode>(
    prefill?.transport_mode ?? 'grab',
  )
  const [startLocation, setStartLocation] = useState(
    prefill?.start_location ?? START_LOCATIONS[0].id,
  )
  const [dayOfWeek, setDayOfWeek] = useState(prefill?.day_of_week ?? 'Monday')
  // Result-page customization carried over from a result-page edit (see
  // ResultView's handleEdit). No UI here for any of these — they're only ever
  // edited on /result — this just prevents "Edit places" from silently discarding
  // them. order/locked are pruned to the surviving selection on submit below;
  // budget/lunch aren't POI-specific so they need no pruning.
  const [durations] = useState(() => prefill?.durations ?? {})
  const [carriedOrder] = useState(() => prefill?.order)
  const [carriedLocked] = useState(() => prefill?.locked)
  const [carriedBudget] = useState(() => prefill?.budget)
  const [carriedLunch] = useState(() => prefill?.lunch)

  const grouped = useMemo(
    () =>
      CATEGORIES.map((c) => ({
        ...c,
        pois: POIS.filter((p) => p.category === c.key),
      })).filter((g) => g.pois.length > 0),
    [],
  )

  // Flattened in category order so the deck walks heritage → museums → … like the grid.
  const flatPois = useMemo(() => grouped.flatMap((g) => g.pois), [grouped])

  const setSelectedOne = useCallback((id: string, value: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (value) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (selected.size === 0) return
    // Forward only the entries whose POI is still selected, so removing a place
    // also drops its now-meaningless override.
    const carriedDurations = Object.fromEntries(
      Object.entries(durations).filter(([id]) => selected.has(id)),
    )
    const { order: carriedOrderPruned, locked: carriedLockedPruned } = pruneOrderAndLocked(
      carriedOrder,
      carriedLocked,
      selected,
    )
    const params: ScheduleParams = {
      // Keep dataset order; the scheduler reorders anyway.
      poi_ids: POIS.filter((p) => selected.has(p.id)).map((p) => p.id),
      start_time: startTime,
      transport_mode: transportMode,
      start_location: startLocation,
      day_of_week: dayOfWeek,
      ...(carriedOrderPruned ? { order: carriedOrderPruned } : {}),
      ...(carriedLockedPruned ? { locked: carriedLockedPruned } : {}),
      ...(carriedBudget ? { budget: carriedBudget } : {}),
      ...(carriedLunch ? { lunch: carriedLunch } : {}),
      ...(Object.keys(carriedDurations).length ? { durations: carriedDurations } : {}),
    }
    router.push('/result?' + encodeParams(params).toString())
  }

  const count = selected.size
  // Heads-up near the CTA when the current selection includes a place that's
  // closed on the chosen day — a usability tester picked a place without
  // noticing it was closed that day (the hours line alone wasn't enough).
  const closedSelectedCount = POIS.filter(
    (p) => selected.has(p.id) && p.closed_days.includes(dayOfWeek),
  ).length

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl px-5 py-8 pb-28">
      <h1 className="text-3xl font-bold tracking-tight">Where do you want to go?</h1>
      <p className="mt-2 text-[var(--color-text-muted)]">
        Select the places you want to visit, then plan your day. Pick in any order — Waypoint
        arranges the best route for you.
      </p>

      {/* Trip day, surfaced above the picker (not just in "Trip details" below) so
          it's set before — not after — a place is chosen, and so a place closed on
          it is flagged live as you pick. */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-4 py-3 text-sm">
        <label htmlFor="day-of-week-top" className="font-semibold">
          Day of trip:
        </label>
        <select
          id="day-of-week-top"
          value={dayOfWeek}
          onChange={(e) => setDayOfWeek(e.target.value)}
          className="rounded-md border border-[var(--color-border)] bg-white px-2 py-1 font-semibold focus:outline-none focus:border-[var(--color-text)] focus:ring-1 focus:ring-[var(--color-text)]"
        >
          {DAYS_OF_WEEK.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <span className="text-[var(--color-text-muted)]">
          Places closed that day are flagged below.
        </span>
      </div>

      {/* Phones: swipe deck (CSS-hidden ≥sm). Tablet/desktop: category grid
          (CSS-hidden <sm). Both render; visibility is pure CSS so there's no
          hydration mismatch or matchMedia timing to depend on. */}
      <div className="mt-8 sm:hidden">
        <PoiSwipeDeck
          pois={flatPois}
          isSelected={(id) => selected.has(id)}
          setSelected={setSelectedOne}
          categoryLabel={categoryLabel}
          dayOfWeek={dayOfWeek}
        />
      </div>

      <div className="hidden sm:block">
        {grouped.map((group) => (
          <fieldset key={group.key} className="mt-8">
            <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
              {group.label}
            </legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              {group.pois.map((poi) => (
                <PoiCard
                  key={poi.id}
                  poi={poi}
                  selected={selected.has(poi.id)}
                  dayOfWeek={dayOfWeek}
                  onToggle={() => toggle(poi.id)}
                />
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="mt-9 mb-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-[var(--color-border)]" />
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Trip details
        </span>
        <span className="h-px flex-1 bg-[var(--color-border)]" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="start-time" className="mb-1.5 block text-sm font-semibold">
            Start time
          </label>
          <input
            id="start-time"
            type="time"
            className={inputClass}
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="transport-mode" className="mb-1.5 block text-sm font-semibold">
            Getting around
          </label>
          <select
            id="transport-mode"
            className={inputClass}
            value={transportMode}
            onChange={(e) => setTransportMode(e.target.value as TransportMode)}
          >
            {TRANSPORT_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="start-location" className="mb-1.5 block text-sm font-semibold">
            Starting from
          </label>
          <select
            id="start-location"
            className={inputClass}
            value={startLocation}
            onChange={(e) => setStartLocation(e.target.value)}
          >
            {START_LOCATIONS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="day-of-week" className="mb-1.5 block text-sm font-semibold">
            Day of trip
          </label>
          <select
            id="day-of-week"
            className={inputClass}
            value={dayOfWeek}
            onChange={(e) => setDayOfWeek(e.target.value)}
          >
            {DAYS_OF_WEEK.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="mt-8 text-sm text-[var(--color-text-muted)]">
        <Link href="/credits" className="underline underline-offset-2 hover:text-[var(--color-text)]">
          Photo credits
        </Link>
      </p>

      {/* Sticky CTA bar (Airbnb-style) */}
      <div className="fixed inset-x-0 bottom-0 border-t border-[var(--color-border)] bg-[var(--color-bg)] px-5 py-4">
        <div className="mx-auto max-w-2xl">
          {closedSelectedCount > 0 && (
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-flag-warning-text)]">
              <span aria-hidden>⚠</span>
              {closedSelectedCount === 1
                ? `1 selected place is closed on ${dayOfWeek}.`
                : `${closedSelectedCount} selected places are closed on ${dayOfWeek}.`}
            </p>
          )}
          <button
            type="submit"
            disabled={count === 0}
            className={
              count === 0
                ? 'w-full cursor-not-allowed rounded-lg bg-[var(--color-bg-subtle)] px-5 py-3.5 text-base font-semibold text-[var(--color-text-muted)]'
                : 'w-full rounded-lg bg-[var(--color-primary)] px-5 py-3.5 text-base font-bold text-white transition-colors hover:bg-[var(--color-primary-hover)]'
            }
          >
            {count === 0
              ? 'Select places to plan your day'
              : `Plan my day (${count} selected) →`}
          </button>
        </div>
      </div>
    </form>
  )
}
