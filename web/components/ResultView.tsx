'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  DndContext,
  PointerSensor,
  MeasuringStrategy,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { Announcements, DragEndEvent, Modifier } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import SortableStop from '@/components/SortableStop'
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion'
import { decodeParams, encodeParams } from '@/lib/params'
import { optimizeOrder, scheduleAlong, parseTime, formatTime, dwellFor } from '@/lib/scheduler'
import type { POI, ScheduledStop, StopReason, TransportMode, DurationOverrides } from '@/lib/scheduler'
import { POI_MAP, TRANSIT_MATRIX, CITY_LABEL } from '@/lib/data'
import { START_LOCATION_MAP, modeLabel, LUNCH_WINDOW } from '@/lib/constants'
import { reasonLine } from '@/lib/reason'
import { fitToBudget } from '@/lib/fit'
import { dayFare, legFare, formatFare } from '@/lib/fare'
import { isEnabled } from '@/lib/features'
import { clampDuration, pruneDurations, DURATION_MIN, DURATION_MAX, DURATION_STEP } from '@/lib/duration'
import { fetchRoadOverlay, mergeTransitMatrix, isRoadRoutingConfigured } from '@/lib/routing'
import type { RouteLeg, RoadOverlay } from '@/lib/routing'
import WhatIfDrawer from '@/components/WhatIfDrawer'
import SavePlanButton from '@/components/SavePlanButton'
import {
  buildItineraryText,
  buildIcs,
  icsFilename,
  stopStatusLine,
  stopDurationLine,
  wallClock,
} from '@/lib/export'

// Bounds for the "fit my day to N hours" slider.
const BUDGET_MIN = 2
const BUDGET_MAX = 12

// Leaflet needs `window`, so load the map client-only (no SSR/prerender).
const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 w-full items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-sm text-[var(--color-text-muted)]">
      Loading map…
    </div>
  ),
})

function cardClass(stop: ScheduledStop): string {
  const base = 'rounded-xl border p-4 shadow-sm'
  if (stop.redFlag)
    return `${base} border-[var(--color-flag-error-border)] bg-[var(--color-flag-error-bg)] text-[var(--color-flag-error-text)]`
  if (stop.yellowFlag)
    return `${base} border-[var(--color-flag-warning-border)] bg-[var(--color-flag-warning-bg)] text-[var(--color-flag-warning-text)]`
  return `${base} border-[var(--color-border)] bg-white`
}

function reasonClass(stop: ScheduledStop): string {
  const base = 'mt-2 border-t border-[var(--color-border)] pt-2 text-xs'
  // Clear cards: muted grey on white. Flagged cards: inherit the flag text colour
  // set by cardClass (full opacity) so the line keeps WCAG AA contrast on the tint.
  return stop.redFlag || stop.yellowFlag
    ? base
    : `${base} text-[var(--color-text-muted)]`
}

function sameOrder(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

// Identifies which (start, mode, order) combination a fetched road overlay was
// computed for, so a response that arrives after the user has since changed the
// order/mode/start is recognized as stale and ignored rather than misapplied.
function routeSignature(order: string[], mode: TransportMode, startId: string): string {
  return `${startId}|${mode}|${order.join(',')}`
}

// A neutral reason for stops the optimizer didn't place this run (pinned / hand-
// arranged). `reasonLine` won't show its nearest-neighbor text — but `prevName`
// still feeds the export's "From X" line, so it must be the ACTUAL predecessor.
function neutralReason(prevName: string | null, transit: number, poi: POI): StopReason {
  return {
    prevName,
    minTransit: transit,
    maxTransit: transit,
    tieGroupSize: 1,
    decidedByClose: false,
    closeTime: poi.close_time,
  }
}

// The itinerary is a single column, so a drag has no meaningful horizontal
// component — lock it to the Y axis. (Four lines, rather than a dependency on
// @dnd-kit/modifiers for this one function.)
const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 })

// DndContext insists on rendering a live region; returning undefined from every
// announcement keeps it empty. See the accessibility prop on DndContext below.
const SILENT_ANNOUNCEMENTS: Announcements = {
  onDragStart: () => undefined,
  onDragMove: () => undefined,
  onDragOver: () => undefined,
  onDragEnd: () => undefined,
  onDragCancel: () => undefined,
}

// How long the "the day is re-timing" affordances hold after an order change:
// the transit legs' crossfade and the moved card's ring. Comfortably longer than
// the card glide (REORDER_MS) so the legs settle AFTER the cards land.
const SETTLE_MS = 400

function GripIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="9" cy="6" r="1.6" />
      <circle cx="15" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" />
      <circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" />
      <circle cx="15" cy="18" r="1.6" />
    </svg>
  )
}

function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4.5" y="11" width="15" height="9" rx="2" />
      {locked ? <path d="M8 11V8a4 4 0 0 1 8 0v3" /> : <path d="M8 11V8a4 4 0 0 1 7.5-1.5" />}
    </svg>
  )
}

const ctrlBtn =
  'flex h-11 w-11 items-center justify-center rounded-md border border-[var(--color-border)] ' +
  'bg-white text-[var(--color-text)] transition hover:bg-[var(--color-bg-subtle)] ' +
  'disabled:cursor-not-allowed disabled:opacity-40'

// Compact at-a-glance summary pill. `warning` tone reuses the flag tokens so a
// "N flagged" chip carries the same caution signal as the cards it summarizes.
function Chip({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'warning' }) {
  const toneClass =
    tone === 'warning'
      ? 'border-[var(--color-flag-warning-border)] bg-[var(--color-flag-warning-bg)] text-[var(--color-flag-warning-text)]'
      : 'border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]'
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm ${toneClass}`}>
      {children}
    </span>
  )
}

// Inline "Time here" stepper: lets the traveler override how long they spend at a
// stop. The POI's authored value stays visible as the suggestion (the guide for
// getting the most out of the stop) even after it's overridden. Screen-only
// (no-print) — the effective minutes are already shown in the printed line above
// via stopDurationLine. Overstay is a LOCAL hint only: yellowFlag stays
// arrival-based so the map, exports, and Live keep their existing flag semantics.
function DurationStepper({
  stop,
  onSet,
  onReset,
  atBudgetCap,
}: {
  stop: ScheduledStop
  onSet: (id: string, minutes: number) => void
  onReset: (id: string) => void
  // True when a further increase would push some stop's departure past an active
  // time-budget — a second, independent ceiling on top of DURATION_MAX.
  atBudgetCap: boolean
}) {
  const rec = stop.poi.recommended_duration_minutes
  const edited = stop.dwellMinutes !== rec
  const overstay = stop.departureTime > parseTime(stop.poi.close_time)
  const atMax = stop.dwellMinutes >= DURATION_MAX
  const plusDisabled = atMax || atBudgetCap

  return (
    <div className="no-print mt-2">
      <div className="flex items-center gap-3">
        <span className="text-sm text-[var(--color-text-muted)]">Time here</span>
        <button
          type="button"
          onClick={() => onSet(stop.poi.id, stop.dwellMinutes - DURATION_STEP)}
          aria-disabled={stop.dwellMinutes <= DURATION_MIN}
          aria-label={`Spend less time at ${stop.poi.name}`}
          className={`${ctrlBtn}${
            stop.dwellMinutes <= DURATION_MIN ? ' cursor-not-allowed opacity-40' : ''
          }`}
        >
          −
        </button>
        <span className="w-20 text-center font-semibold">{stop.dwellMinutes} min</span>
        <button
          type="button"
          onClick={() => onSet(stop.poi.id, stop.dwellMinutes + DURATION_STEP)}
          aria-disabled={plusDisabled}
          aria-label={`Spend more time at ${stop.poi.name}`}
          className={`${ctrlBtn}${plusDisabled ? ' cursor-not-allowed opacity-40' : ''}`}
        >
          +
        </button>
      </div>
      {overstay && (
        <p className="mt-1.5 flex items-start gap-1 text-xs text-[var(--color-flag-warning-text)]">
          <span aria-hidden>⚠</span>
          <span>
            {stop.poi.name} closes at {stop.poi.close_time} — your stay runs to{' '}
            {wallClock(stop.departureTime)}.
          </span>
        </p>
      )}
      <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">
        Suggested {rec} min
        {edited && (
          <>
            {' · '}
            <button
              type="button"
              onClick={() => onReset(stop.poi.id)}
              className="font-semibold underline-offset-2 hover:underline"
            >
              Reset
            </button>
          </>
        )}
        {/* Only mention the budget ceiling when IT (not the 600-min hard cap) is
            the binding constraint, so the message always matches the reason
            the button is actually disabled. */}
        {atBudgetCap && !atMax && ' · Limited by your time budget'}
      </p>
    </div>
  )
}

// Dropdown that tucks the share/export actions behind one trigger, keeping the
// utility bar to a single primary action. Uncontrolled <details> for free
// keyboard + disclosure semantics; a doc listener adds the close-on-outside-click
// /Escape behavior native <details> lacks. Items don't auto-close so transient
// feedback ("Copied!") stays visible until the user clicks away.
function ExportMenu({
  copyLabel,
  onCopy,
  onDownload,
  onPrint,
}: {
  copyLabel: string
  onCopy: () => void
  onDownload: () => void
  onPrint: () => void
}) {
  const ref = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) ref.current.open = false
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && ref.current) ref.current.open = false
    }
    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])
  const item = 'rounded-md px-3 py-2 text-left hover:bg-[var(--color-bg-subtle)]'
  return (
    <details ref={ref} className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-1 font-semibold underline-offset-2 hover:underline [&::-webkit-details-marker]:hidden">
        Share &amp; export <span aria-hidden>▾</span>
      </summary>
      <div className="absolute right-0 z-20 mt-2 flex w-44 flex-col gap-0.5 rounded-lg border border-[var(--color-border)] bg-white p-1 text-[var(--color-text)] shadow-md">
        <button type="button" onClick={onCopy} aria-label="Copy itinerary as text" className={item}>
          {copyLabel}
        </button>
        <button type="button" onClick={onDownload} className={item}>
          Download .ics
        </button>
        <button type="button" onClick={onPrint} className={item}>
          Print
        </button>
      </div>
    </details>
  )
}

export default function ResultView() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const params = useMemo(
    () => decodeParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  )

  // Road routes fetched at runtime (Mapbox Directions), layered over the static
  // haversine matrix once resolved. `signature` records which (start, mode, order)
  // the fetch was for, so a response for a since-superseded combination is
  // recognized as stale in the `model` memo below and simply ignored.
  const [roadOverlay, setRoadOverlay] = useState<({ signature: string } & RoadOverlay) | null>(
    null,
  )
  const routeRequestId = useRef(0)

  // An order the user just chose that the router hasn't yet committed to the URL,
  // tagged with the query string it was written against. The URL remains the single
  // source of truth — this only bridges the async gap, so the list (and the `items`
  // array dnd-kit sorts against) reorders in the SAME commit as the drop/click
  // instead of one router tick later. Without it, a drop visibly snaps back to the
  // old arrangement for a frame while the router catches up.
  //
  // `forSearch` is what retires it: the instant the query string changes — the
  // router landed, or the user hit Back — the tag no longer matches and the URL
  // wins again. That makes expiry a pure derivation in the memo below, with no
  // effect writing state back on every commit.
  const [pending, setPending] = useState<{ order: string[]; forSearch: string } | null>(null)
  const searchKey = searchParams.toString()

  const reduceMotion = usePrefersReducedMotion()

  // A small distance threshold so a tap that turns into a page scroll doesn't start
  // a drag. The grip handle sets `touch-action: none` on its own 44px, so a single
  // PointerSensor covers mouse, pen and touch — no separate TouchSensor needed, and
  // scrolling by dragging anywhere ELSE on the card keeps working.
  //
  // No KeyboardSensor, deliberately: the ↑ ↓ buttons on every card are already the
  // keyboard reorder path and already announce through the aria-live region below.
  // Adding dnd-kit's would give screen-reader users two competing ways to reorder
  // the same list, and a second, duplicate announcement channel.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const model = useMemo(() => {
    if (!params) return null
    try {
      const startLocation = START_LOCATION_MAP[params.start_location]
      if (!startLocation) return null
      const coords = { lat: startLocation.lat, lng: startLocation.lng }

      // Dedupe + drop unknown ids in one pass. A shared/edited URL can repeat an
      // id; a duplicate would later starve optimizeOrder's candidate set (more
      // positions than free POIs) and throw mid-render — so we never let one in.
      const validIds = new Set<string>()
      const setPOIs: POI[] = []
      for (const id of params.poi_ids) {
        const p = POI_MAP[id]
        if (p && !validIds.has(id)) {
          validIds.add(id)
          setPOIs.push(p)
        }
      }
      if (setPOIs.length === 0) return null

      // The auto-optimized order (no locks) — the baseline + the "Reset to auto" target.
      const defaultOrder = optimizeOrder(
        setPOIs,
        new Set(),
        TRANSIT_MATRIX,
        params.start_location,
        coords,
        params.transport_mode,
      ).order.map((p) => p.id)

      // Working order: the URL's explicit order (deduped + sanitized to the selected
      // set, with any missing-from-URL stops appended) or the auto order if none.
      let urlOrder: string[]
      if (params.order && params.order.length) {
        const fromUrl = [...new Set(params.order.filter((id) => validIds.has(id)))]
        urlOrder = [...fromUrl, ...defaultOrder.filter((id) => !fromUrl.includes(id))]
      } else {
        urlOrder = defaultOrder
      }

      // Layer the not-yet-committed order over the URL's — but only while the URL it
      // was written against is still the current one, and only while it's still a
      // permutation of the SELECTED set. A pending order the POI set has changed
      // under is stale and gets dropped rather than misapplied, the same discipline
      // the road overlay's signature check applies.
      const pendingUsable =
        pending !== null &&
        pending.forSearch === searchKey &&
        pending.order.length === validIds.size &&
        pending.order.every((id) => validIds.has(id))
      const order = pendingUsable ? pending!.order : urlOrder

      const orderPOIs = order.map((id) => POI_MAP[id])
      const locked = new Set((params.locked ?? []).filter((id) => order.includes(id)))

      // What the optimizer WOULD do given the current pins. If the working order
      // already equals it, the unpinned stops genuinely sit where the algorithm put
      // them, so they may carry the nearest-neighbor reason; otherwise the user has
      // hand-arranged and those stops are 'manual' (no algorithmic claim).
      const opt = optimizeOrder(
        orderPOIs,
        locked,
        TRANSIT_MATRIX,
        params.start_location,
        coords,
        params.transport_mode,
      )
      const isOptimal = sameOrder(order, opt.order.map((p) => p.id))

      // Lunch break (feature-gated): a reserved midday window threaded into the
      // schedule, shifting later arrivals. Times stay faithful — exports inherit them.
      const lunchOn = isEnabled('lunchBreak') && !!params.lunch
      const lunch = lunchOn ? LUNCH_WINDOW : null

      // Per-stop "Time here" overrides (feature-gated): pruned to the selected POIs
      // and to entries that actually differ from the authored recommendation.
      const durations = isEnabled('customDuration')
        ? pruneDurations(params.durations ?? {}, setPOIs)
        : {}

      // Road routing only ever *refines the schedule's transit times/map line* for
      // this exact (start, mode, order); it never feeds back into ordering (see
      // routing effect below) — a stale/mismatched fetch is ignored, falling back
      // to the static haversine matrix exactly as before routing existed.
      const signature = routeSignature(order, params.transport_mode, params.start_location)
      const roadReady = roadOverlay?.signature === signature
      const matrix = roadReady
        ? mergeTransitMatrix(TRANSIT_MATRIX, roadOverlay!.overlayMatrix)
        : TRANSIT_MATRIX
      const legGeometry = roadReady ? roadOverlay!.legGeometry : null

      const stops = scheduleAlong(
        orderPOIs,
        matrix,
        params.start_location,
        coords,
        params.start_time,
        params.transport_mode,
        params.day_of_week,
        (poi, _i, prevName, transit) => {
          if (locked.has(poi.id))
            return { placement: 'locked', reason: neutralReason(prevName, transit, poi) }
          if (isOptimal) return { placement: 'optimized', reason: opt.reasonById[poi.id] }
          return { placement: 'manual', reason: neutralReason(prevName, transit, poi) }
        },
        lunch,
        durations,
      )

      // Time-budget overlay (feature-gated): marks over-budget stops without ever
      // dropping them, and whether you'd make it back to the start in time.
      const budget = isEnabled('fitToHours') && params.budget ? params.budget : null
      const fit = budget
        ? fitToBudget(stops, params.start_time, budget, coords, params.transport_mode)
        : null

      const isCustom = !sameOrder(order, defaultOrder) || locked.size > 0
      return {
        startLocation,
        coords,
        order,
        locked,
        stops,
        legGeometry,
        isCustom,
        defaultOrder,
        freeCount: order.length - locked.size,
        lunchOn,
        budget,
        fit,
        durations,
        matrix,
      }
    } catch {
      // Any malformed shared/edited URL that slips past validation → null → the
      // guard effect bounces to the selector instead of crashing the route.
      return null
    }
  }, [params, roadOverlay, pending, searchKey])

  // Fetch real road routes for the current (start, mode, order) once it's known,
  // then layer them into `model` via `roadOverlay` above. Deliberately depends on
  // primitives derived from `model`/`params` rather than the objects themselves:
  // `model` is recreated by the memo above whenever `roadOverlay` changes, so
  // depending on `model` directly would refire this effect on its own result and
  // loop. `routeRequestId` discards a response if a newer request has since
  // superseded it (fast reorders/mode switches), regardless of arrival order.
  const modelOrderKey = model?.order.join(',')
  const modelCoordsLat = model?.coords.lat
  const modelCoordsLng = model?.coords.lng
  const routeMode = params?.transport_mode
  const routeStartId = params?.start_location
  useEffect(() => {
    if (!model || !params) return
    const orderPOIs = model.order.map((id) => POI_MAP[id])
    const legs: RouteLeg[] = orderPOIs.map((poi, i) => {
      const prev = i === 0 ? null : orderPOIs[i - 1]
      return {
        fromId: prev ? prev.id : params.start_location,
        toId: poi.id,
        from: prev ? { lat: prev.lat, lng: prev.lng } : model.coords,
        to: { lat: poi.lat, lng: poi.lng },
      }
    })
    const signature = routeSignature(model.order, params.transport_mode, params.start_location)
    const requestId = ++routeRequestId.current

    fetchRoadOverlay(legs, params.transport_mode).then((result) => {
      if (requestId !== routeRequestId.current) return // superseded by a newer request
      setRoadOverlay({ signature, ...result })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelOrderKey, modelCoordsLat, modelCoordsLng, routeMode, routeStartId])

  // Transient feedback for the "Copy text" button.
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mounted = useRef(true)

  // The settle window after an order change: `settling` crossfades the transit legs
  // (whose minutes just recomputed) and `landedId` rings the card that moved, so the
  // eye can follow it. Both are decoration — the reorder itself is already committed.
  const [settling, setSettling] = useState(false)
  const [landedId, setLandedId] = useState<string | null>(null)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Set true in the BODY (not just at ref init): React StrictMode in dev mounts →
    // unmounts → remounts, and the unmount cleanup sets false; without re-setting
    // here the flag would stay false and silently kill copy feedback after remount.
    mounted.current = true
    return () => {
      // The reset timer is scheduled only after the async clipboard write resolves,
      // so the unmount guard must also stop a post-unmount state update + timer.
      mounted.current = false
      if (copyTimer.current) clearTimeout(copyTimer.current)
      if (settleTimer.current) clearTimeout(settleTimer.current)
    }
  }, [])

  // SR announcement for reorder / pin / re-optimize actions.
  const [liveMsg, setLiveMsg] = useState('')
  // What-if comparison drawer (lazy: only computes when open).
  const [whatIfOpen, setWhatIfOpen] = useState(false)
  // "Adjust your day" disclosure: collapsed by default to lead with the itinerary,
  // but opened on first paint when the shared URL already carries adjustments so an
  // active limit/lunch/arrangement (and its summary) isn't hidden from the viewer.
  const [adjustOpen, setAdjustOpen] = useState(
    () =>
      searchParams.get('lunch') === '1' ||
      Number(searchParams.get('budget')) > 0 ||
      !!searchParams.get('order') ||
      !!searchParams.get('locked'),
  )
  // Stable POI array for the what-if drawer so its internal memo isn't busted on
  // every ResultView render (which happens often: copy/live-message state, etc.).
  const whatIfPois = useMemo(
    () => (model ? model.order.map((id) => POI_MAP[id]) : []),
    [model],
  )

  // Guard: invalid/missing params (or unknown POIs) → bounce back to selector.
  useEffect(() => {
    if (!model) router.replace('/')
  }, [model, router])

  if (!model || !params) return null

  const { startLocation, stops, legGeometry } = model
  // params is non-null past the guard above; capture it so the export closures
  // keep the narrowed (non-null) type.
  const safeParams = params
  const flaggedCount = stops.filter((s) => s.yellowFlag || s.redFlag).length
  const allRed = stops.length > 0 && stops.every((s) => s.redFlag)
  const spanMinutes =
    stops[stops.length - 1].departureTime - parseTime(params.start_time)
  const approxHours = Math.max(1, Math.round(spanMinutes / 60))

  // Fare estimate (feature-gated; walking is free so we omit it). Always a range.
  const fareEnabled = isEnabled('fareEstimator') && params.transport_mode !== 'walk'
  const totalFare = fareEnabled ? dayFare(stops, params.transport_mode) : null
  const fit = model.fit
  // Lunch was requested but no break could be slotted (a stop spans the whole
  // window) — say so rather than silently doing nothing with the toggle.
  const lunchAbsorbed = model.lunchOn && !stops.some((s) => s.lunchBefore)

  // Honest one-line summary of the time-budget overlay (never hides a stop).
  let budgetSummary: string | null = null
  if (fit && model.budget != null) {
    const endsLabel = wallClock(fit.endsAt)
    if (fit.overflowCount > 0) {
      budgetSummary = `${fit.overflowCount} ${
        fit.overflowCount === 1 ? 'stop falls' : 'stops fall'
      } beyond your ${model.budget}h budget (after ${endsLabel}) — greyed below, not removed.`
    } else if (!fit.makesItBack) {
      budgetSummary = `Your stops fit, but getting back to ${startLocation.name} may run past your ${model.budget}h budget (rough return estimate).`
    } else {
      budgetSummary = `Your whole day fits within ${model.budget}h, with time to head back to ${startLocation.name}.`
    }
  }

  // The exact query for the current plan (incl. order/locked/budget/lunch) — used by
  // "Save plan" and the Live mode link so they open this same plan.
  const currentQuery = encodeParams({
    poi_ids: safeParams.poi_ids,
    start_time: safeParams.start_time,
    transport_mode: safeParams.transport_mode,
    start_location: safeParams.start_location,
    day_of_week: safeParams.day_of_week,
    order: sameOrder(model.order, model.defaultOrder) ? undefined : model.order,
    locked: model.locked.size ? [...model.locked] : undefined,
    budget: model.budget ?? undefined,
    lunch: model.lunchOn || undefined,
    durations: Object.keys(model.durations).length ? model.durations : undefined,
  }).toString()
  const planName = `${params.day_of_week} · ${stops.length} ${
    stops.length === 1 ? 'stop' : 'stops'
  } · ${modeLabel(params.transport_mode)}`

  // Summary shown beside the collapsed "Adjust your day" header so active tweaks
  // stay visible without expanding the panel.
  const adjustments: string[] = []
  if (model.isCustom) adjustments.push('your order')
  if (model.lunchOn) adjustments.push('lunch break')
  if (model.budget != null) adjustments.push(`${model.budget}h limit`)
  const adjustHint = adjustments.join(' · ')

  // Single writer for the result URL (the source of truth → shareable + refresh-
  // safe). Every view tweak — reorder, pin, budget, lunch — merges over the CURRENT
  // arrangement so one never clobbers another. `replace` (not push) keeps history
  // clean; scroll:false keeps the user's place in the list.
  function writeUrl(patch: {
    order?: string[]
    locked?: string[]
    budget?: number | null
    lunch?: boolean
    durations?: DurationOverrides
  }) {
    const m = model!
    const nextOrder = patch.order ?? m.order
    const nextLocked = patch.locked ?? [...m.locked]
    const nextBudget = patch.budget !== undefined ? patch.budget : m.budget
    const nextLunch = patch.lunch !== undefined ? patch.lunch : m.lunchOn
    const nextDurations = patch.durations ?? m.durations
    const sp = encodeParams({
      poi_ids: safeParams.poi_ids,
      start_time: safeParams.start_time,
      transport_mode: safeParams.transport_mode,
      start_location: safeParams.start_location,
      day_of_week: safeParams.day_of_week,
      order: sameOrder(nextOrder, m.defaultOrder) ? undefined : nextOrder,
      locked: nextLocked.length ? nextLocked : undefined,
      budget: nextBudget ?? undefined,
      lunch: nextLunch || undefined,
      durations: Object.keys(nextDurations).length ? nextDurations : undefined,
    })
    router.replace('/result?' + sp.toString(), { scroll: false })
  }

  function writeArrangement(nextOrder: string[], nextLocked: string[]) {
    writeUrl({ order: nextOrder, locked: nextLocked })
  }

  // The single entry point for every order change — ↑/↓, drag, Re-optimize, Reset.
  // Applies the new order optimistically (so the list and dnd-kit's `items` reorder
  // in this commit, not after the router round-trips), opens the settle window that
  // drives the leg crossfade + landed ring, then writes the URL as the real store.
  function applyOrder(nextOrder: string[], nextLocked: string[], movedId?: string) {
    setPending({ order: nextOrder, forSearch: searchKey })
    if (!reduceMotion) {
      setSettling(true)
      setLandedId(movedId ?? null)
      if (settleTimer.current) clearTimeout(settleTimer.current)
      settleTimer.current = setTimeout(() => {
        if (!mounted.current) return
        setSettling(false)
        setLandedId(null)
      }, SETTLE_MS)
    }
    writeArrangement(nextOrder, nextLocked)
  }

  function toggleLunch() {
    const next = !model!.lunchOn
    setLiveMsg(next ? 'Added a lunch break from 12:00 to 13:30.' : 'Removed the lunch break.')
    writeUrl({ lunch: next })
  }

  function enableBudget() {
    const def = Math.min(BUDGET_MAX, Math.max(BUDGET_MIN, approxHours))
    setLiveMsg(`Limiting the day to about ${def} hours.`)
    writeUrl({ budget: def })
  }

  function disableBudget() {
    setLiveMsg('Removed the time limit.')
    writeUrl({ budget: null })
  }

  function setBudget(hours: number) {
    writeUrl({ budget: hours })
  }

  // Switch transport mode from the what-if comparison: re-optimize for that mode
  // (drop the custom order/pins, which were chosen for the old mode) but keep the
  // budget + lunch overlays. push (not replace) so the user can go back.
  function chooseMode(mode: TransportMode) {
    // The new URL carries no `order`, so the optimistic one must go too — otherwise
    // it could survive the mode switch and silently reinstate an arrangement that
    // was chosen for the OLD mode, defeating the drop this function exists to do.
    setPending(null)
    const sp = encodeParams({
      poi_ids: safeParams.poi_ids,
      start_time: safeParams.start_time,
      transport_mode: mode,
      start_location: safeParams.start_location,
      day_of_week: safeParams.day_of_week,
      budget: model!.budget ?? undefined,
      lunch: model!.lunchOn || undefined,
      durations: Object.keys(model!.durations).length ? model!.durations : undefined,
    })
    router.push('/result?' + sp.toString())
  }

  function moveStop(index: number, dir: -1 | 1) {
    const j = index + dir
    if (j < 0 || j >= model!.order.length) return
    const next = [...model!.order]
    ;[next[index], next[j]] = [next[j], next[index]]
    const movedId = next[j]
    const name = POI_MAP[movedId]?.name ?? 'Stop'
    setLiveMsg(`Moved ${name} to position ${j + 1}.`)
    applyOrder(next, [...model!.locked], movedId)
  }

  // Drop: dnd-kit gives us the dragged stop and the one it landed on. Everything
  // downstream (announcement, URL, re-timing) is the same path a ↑/↓ press takes —
  // drag is an input method, not a second way to mutate the day.
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const activeId = String(active.id)
    const from = model!.order.indexOf(activeId)
    const to = model!.order.indexOf(String(over.id))
    if (from < 0 || to < 0) return

    const next = arrayMove(model!.order, from, to)
    const name = POI_MAP[activeId]?.name ?? 'Stop'
    setLiveMsg(`Moved ${name} to position ${to + 1}.`)
    applyOrder(next, [...model!.locked], activeId)
  }

  function toggleLock(id: string) {
    const next = new Set(model!.locked)
    const name = POI_MAP[id]?.name ?? 'Stop'
    if (next.has(id)) {
      next.delete(id)
      setLiveMsg(`Unpinned ${name}.`)
    } else {
      next.add(id)
      setLiveMsg(`Pinned ${name} in place.`)
    }
    writeArrangement(model!.order, [...next])
  }

  function reOptimize() {
    const orderPOIs = model!.order.map((id) => POI_MAP[id])
    const opt = optimizeOrder(
      orderPOIs,
      model!.locked,
      TRANSIT_MATRIX,
      safeParams.start_location,
      model!.coords,
      safeParams.transport_mode,
    )
    setLiveMsg('Re-optimized the unpinned stops.')
    applyOrder(opt.order.map((p) => p.id), [...model!.locked])
  }

  function resetAuto() {
    setLiveMsg('Reset to the automatic order.')
    applyOrder(model!.defaultOrder, [])
  }

  // Would giving `id` this candidate duration push ANY stop's departure (this
  // one's or a later one's — lengthening a dwell ripples forward) past an active
  // time-budget? Recomputes the full schedule rather than checking `id` alone,
  // since a stop well within budget can still tip a LATER stop over. No-op when
  // no budget is active.
  function wouldOverflowBudget(id: string, minutes: number): boolean {
    if (model!.budget == null) return false
    const orderPOIs = model!.order.map((oid) => POI_MAP[oid])
    const candidateDurations = pruneDurations({ ...model!.durations, [id]: minutes }, orderPOIs)
    const candidateStops = scheduleAlong(
      orderPOIs,
      model!.matrix,
      safeParams.start_location,
      model!.coords,
      safeParams.start_time,
      safeParams.transport_mode,
      safeParams.day_of_week,
      undefined,
      model!.lunchOn ? LUNCH_WINDOW : null,
      candidateDurations,
    )
    return (
      fitToBudget(
        candidateStops,
        safeParams.start_time,
        model!.budget,
        model!.coords,
        safeParams.transport_mode,
      ).overflowCount > 0
    )
  }

  function setDuration(id: string, minutes: number) {
    const poi = POI_MAP[id]
    const current = dwellFor(poi, model!.durations)
    const val = clampDuration(minutes)
    if (val === current) return // no-op at the stepper bounds
    // Only increases can bust a budget; shortening a stop never needs the guard.
    if (val > current && wouldOverflowBudget(id, val)) return
    const next = { ...model!.durations }
    if (val === poi.recommended_duration_minutes) delete next[id]
    else next[id] = val
    setLiveMsg(`${poi.name}: ${val} minutes.`)
    writeUrl({ durations: next })
  }

  function resetDuration(id: string) {
    const poi = POI_MAP[id]
    const next = { ...model!.durations }
    delete next[id]
    setLiveMsg(`Reset ${poi.name} to the suggested ${poi.recommended_duration_minutes} minutes.`)
    writeUrl({ durations: next })
  }

  function handleEdit() {
    // Drop result-only customization (order/locked/budget/lunch) when returning to
    // the selector, but carry durations along — the user's tuning of a place is a
    // property of the place, not of this particular arrangement.
    router.push(
      '/plan?' +
        encodeParams({
          poi_ids: safeParams.poi_ids,
          start_time: safeParams.start_time,
          transport_mode: safeParams.transport_mode,
          start_location: safeParams.start_location,
          day_of_week: safeParams.day_of_week,
          durations: Object.keys(model!.durations).length ? model!.durations : undefined,
        }).toString(),
    )
  }

  function exportInput() {
    return {
      stops,
      params: safeParams,
      startLocationName: startLocation.name,
      cityLabel: CITY_LABEL,
      shareUrl: window.location.href,
    }
  }

  async function handleCopy() {
    if (copyTimer.current) clearTimeout(copyTimer.current)
    let next: 'copied' | 'error'
    try {
      // navigator.clipboard is undefined on insecure (http) origins — a property
      // access that throws synchronously, so it must be inside the try.
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(buildItineraryText(exportInput()))
      next = 'copied'
    } catch {
      next = 'error'
    }
    if (!mounted.current) return // unmounted during the await — don't schedule a timer
    setCopyState(next)
    copyTimer.current = setTimeout(() => setCopyState('idle'), 2500)
  }

  function handleDownloadIcs() {
    const ics = buildIcs(exportInput(), new Date())
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = icsFilename(CITY_LABEL, safeParams.day_of_week)
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const copyLabel =
    copyState === 'copied' ? 'Copied!' : copyState === 'error' ? 'Copy failed' : 'Copy text'
  const copyStatusMessage =
    copyState === 'copied'
      ? 'Itinerary copied to clipboard'
      : copyState === 'error'
        ? 'Copy failed'
        : ''

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <h1 className="text-2xl font-bold tracking-tight">
        Here&apos;s your day — {CITY_LABEL}
      </h1>
      <p className="mt-1 text-[var(--color-text-muted)]">
        {params.day_of_week} · From {startLocation.name} · {modeLabel(params.transport_mode)}
      </p>
      {/* At-a-glance summary — scannable chips in place of a long dotted line. */}
      <div className="mt-3 flex flex-wrap gap-2">
        <Chip>
          {stops.length} {stops.length === 1 ? 'stop' : 'stops'}
        </Chip>
        <Chip>~{approxHours}h</Chip>
        {flaggedCount > 0 ? (
          <Chip tone="warning">{flaggedCount} flagged</Chip>
        ) : (
          <Chip>All open</Chip>
        )}
        {fit && fit.overflowCount > 0 && (
          <Chip tone="warning">
            {fit.overflowCount} beyond budget
          </Chip>
        )}
        {totalFare && <Chip>~{formatFare(totalFare)} fare</Chip>}
        {model.isCustom && <Chip>Your order</Chip>}
      </div>

      {/* Utility bar */}
      <div className="no-print mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-y border-[var(--color-border)] py-2 text-sm text-[var(--color-text-muted)]">
        <button
          type="button"
          onClick={handleEdit}
          className="font-semibold underline-offset-2 hover:underline"
        >
          ← Edit this list
        </button>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {isEnabled('liveMode') && (
            <Link
              href={`/live?${currentQuery}`}
              className="font-semibold underline-offset-2 hover:underline"
            >
              Live mode
            </Link>
          )}
          {isEnabled('comparePlans') && (
            // key on the query so the "Saved ✓" state re-arms whenever the plan
            // changes (reorder/pin/budget/lunch) — otherwise it would falsely claim
            // an edited arrangement is already saved.
            <SavePlanButton key={currentQuery} query={currentQuery} defaultName={planName} />
          )}
          {/* Copy / Download / Print tucked behind one trigger to keep the bar calm. */}
          <ExportMenu
            copyLabel={copyLabel}
            onCopy={handleCopy}
            onDownload={handleDownloadIcs}
            onPrint={() => window.print()}
          />
        </div>
        {/* Stable button name above + a dedicated live region here = reliable SR
            announcement (a live region on the button's own changing label is not).
            Named, because DndContext renders a role=status region of its own — the
            name is what keeps the two tellable apart, for AT and for tests. */}
        <span role="status" aria-live="polite" aria-label="Copy status" className="sr-only">
          {copyStatusMessage}
        </span>
      </div>

      {allRed && (
        <div className="mt-5 rounded-xl border border-[var(--color-flag-error-border)] bg-[var(--color-flag-error-bg)] p-4 font-semibold text-[var(--color-flag-error-text)]">
          All selected places are closed on this day.
        </div>
      )}

      {/* Visual route map — supplementary to the list (which stays the
          accessible + print artifact), so hidden from print. */}
      <div className="no-print mt-5">
        <MapView stops={stops} start={startLocation} legGeometry={legGeometry ?? undefined} />
        {isRoadRoutingConfigured() && !legGeometry && (
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            Refining with road distances…
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)]">
          <span>Numbered pins show your visit order.</span>
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--color-primary)]"
            />
            open
          </span>
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--color-flag-warning-border)]"
            />
            check hours
          </span>
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--color-flag-error-text)]"
            />
            closed
          </span>
        </div>
      </div>

      {/* Adjust your day — arrangement + (feature-flagged) lunch / budget / what-if,
          collapsed by default so the page leads with the itinerary, not the controls. */}
      <details
        open={adjustOpen}
        onToggle={(e) => setAdjustOpen(e.currentTarget.open)}
        className="no-print mt-5 rounded-xl border border-[var(--color-border)] text-sm"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 font-semibold [&::-webkit-details-marker]:hidden">
          <span>
            Adjust your day
            {adjustHint && (
              <span className="font-normal text-[var(--color-text-muted)]"> · {adjustHint}</span>
            )}
          </span>
          <span
            aria-hidden
            className={`text-[var(--color-text-muted)] transition-transform ${
              adjustOpen ? 'rotate-180' : ''
            }`}
          >
            ⌄
          </span>
        </summary>

        <div className="border-t border-[var(--color-border)]">
          {/* Arrangement: reorder/pin status + reset controls. The day is yours to
              arrange; the optimizer only touches what you haven't pinned. */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-4">
            <span className="text-[var(--color-text-muted)]">
              {model.isCustom ? (
                <>
                  <span className="font-semibold text-[var(--color-text)]">Your order</span>
                  {model.locked.size > 0 && ` · ${model.locked.size} pinned`}
                </>
              ) : (
                'Reorder with ↑ ↓, or pin a stop to keep it put.'
              )}
            </span>
            {model.isCustom && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {model.freeCount >= 2 && (
                  <button
                    type="button"
                    onClick={reOptimize}
                    className="font-semibold underline-offset-2 hover:underline"
                  >
                    Re-optimize unpinned
                  </button>
                )}
                <button
                  type="button"
                  onClick={resetAuto}
                  className="font-semibold underline-offset-2 hover:underline"
                >
                  Reset to auto
                </button>
              </div>
            )}
          </div>

          {/* Plan options: lunch break, time budget, and the what-if comparison. Each
              is independently feature-flagged; this block is omitted if all are off. */}
          {(isEnabled('lunchBreak') || isEnabled('fitToHours') || isEnabled('whatIf')) && (
            <div className="space-y-4 border-t border-[var(--color-border)] p-4">
            {isEnabled('lunchBreak') && (
              <div>
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={model.lunchOn}
                    onChange={toggleLunch}
                    className="h-4 w-4 accent-[var(--color-primary)]"
                  />
                  <span>
                    Reserve a lunch break{' '}
                    <span className="text-[var(--color-text-muted)]">(12:00–13:30)</span>
                  </span>
                </label>
                {lunchAbsorbed && (
                  <p className="mt-1 pl-7 text-xs text-[var(--color-text-muted)]">
                    You’ll be at a stop through midday, so no separate lunch break was added.
                  </p>
                )}
              </div>
            )}

            {isEnabled('fitToHours') && (
              <div>
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={model.budget != null}
                    onChange={(e) => (e.target.checked ? enableBudget() : disableBudget())}
                    className="h-4 w-4 accent-[var(--color-primary)]"
                  />
                  <span>Fit my day to a time limit</span>
                </label>
                {model.budget != null && (
                  <div className="mt-3 pl-7">
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={BUDGET_MIN}
                        max={BUDGET_MAX}
                        step={1}
                        value={model.budget}
                        onChange={(e) => setBudget(Number(e.target.value))}
                        aria-label="Hours available for the day"
                        aria-valuetext={`${model.budget} hours`}
                        className="w-full accent-[var(--color-primary)]"
                      />
                      <span className="w-12 shrink-0 text-right font-semibold">{model.budget}h</span>
                    </div>
                    {/* aria-live so screen-reader / keyboard users hear the recomputed
                        consequence as they adjust the slider (the feature's payload). */}
                    {budgetSummary && (
                      <p className="mt-2 text-[var(--color-text-muted)]" aria-live="polite">
                        {budgetSummary}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {isEnabled('whatIf') && (
              <div>
                <button
                  type="button"
                  onClick={() => setWhatIfOpen((o) => !o)}
                  aria-expanded={whatIfOpen}
                  className="font-semibold text-[var(--color-primary)] underline-offset-2 hover:underline"
                >
                  {whatIfOpen ? 'Hide transport comparison' : 'Compare walk / jeepney / Grab →'}
                </button>
                {whatIfOpen && (
                  <WhatIfDrawer
                    pois={whatIfPois}
                    params={safeParams}
                    coords={model.coords}
                    lunch={model.lunchOn ? LUNCH_WINDOW : null}
                    durations={model.durations}
                    currentMode={params.transport_mode}
                    onChoose={chooseMode}
                  />
                )}
              </div>
            )}
          </div>
          )}
        </div>
      </details>

      {/* aria-live only (no role=status) so it stays distinct from the copy status
          region above. Kept outside <details> so it still announces when collapsed. */}
      <span aria-live="polite" className="no-print sr-only">
        {liveMsg}
      </span>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        // Cards change height as the day re-times (flag tints appear, the "Beyond
        // your Nh" pill comes and goes, the reason line rewrites). Measuring only at
        // drag-start would leave dnd-kit sorting against stale rects, so re-measure.
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragEnd={handleDragEnd}
        // Silence dnd-kit's own announcements. Every drop already announces through
        // the shared aria-live region below (the same sentence a ↑/↓ press produces),
        // so leaving these on would speak each reorder twice, in two different voices.
        accessibility={{ announcements: SILENT_ANNOUNCEMENTS }}
      >
        <SortableContext items={model.order} strategy={verticalListSortingStrategy}>
          <ol className="mt-5" data-reordering={settling || undefined}>
            {stops.map((stop, i) => {
              const locked = stop.placement === 'locked'
              const outOfBudget = fit ? !fit.fits[i] : false
              // Is the "+" stepper already at its budget-imposed ceiling? Checked against
              // the NEXT step, not the current value, so the button disables itself right
              // as it would otherwise push some stop over the active time limit.
              const atBudgetCap =
                model.budget != null &&
                wouldOverflowBudget(stop.poi.id, clampDuration(stop.dwellMinutes + DURATION_STEP))
              const leg =
                fareEnabled && stop.transitFromPrev > 0
                  ? legFare(stop.transitFromPrev, params.transport_mode)
                  : null
              return (
                <SortableStop
                  key={stop.poi.id}
                  id={stop.poi.id}
                  cardClassName={`${cardClass(stop)}${outOfBudget ? ' opacity-60' : ''}`}
                  reduceMotion={reduceMotion}
                  landed={landedId === stop.poi.id}
                  // The lunch pill and transit leg sit ABOVE the card, inside the <li>
                  // but outside the sortable node — they belong to the gap between two
                  // stops, not to the card that glides. `wp-leg` crossfades them while
                  // their minutes recompute (app/globals.css).
                  lead={
                    <>
                      {stop.lunchBefore && (
                        <div className="wp-leg py-2 text-center">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 py-1 text-sm font-semibold">
                            <span aria-hidden>🍴</span> Lunch {wallClock(stop.lunchBefore.start)}–
                            {wallClock(stop.lunchBefore.end)}
                          </span>
                        </div>
                      )}
                      {i > 0 && (
                        <div className="wp-leg py-2 text-center text-sm text-[var(--color-text-muted)]">
                          <div>
                            ↓ {stop.transitFromPrev} min{leg ? ` · ~${formatFare(leg)}` : ''} by{' '}
                            {modeLabel(params.transport_mode)}
                          </div>
                          <div className="no-print text-xs">
                            Estimated — verify with Google Maps
                          </div>
                        </div>
                      )}
                    </>
                  }
                >
                  {({ listeners, isDragging }) => (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        {/* Drag handle. Pointer-only on purpose: the ↑ ↓ buttons in this same
                            card are the keyboard + screen-reader path, so exposing a third
                            focusable control here would only add noise to the tab order and
                            the a11y tree. touch-action:none is scoped to these 44px, so the
                            rest of the card still scrolls the page on touch. */}
                        <button
                          type="button"
                          {...listeners}
                          aria-hidden="true"
                          tabIndex={-1}
                          className={`no-print -ml-1 flex h-11 w-11 shrink-0 touch-none items-center justify-center rounded-md text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg-subtle)] ${
                            isDragging ? 'cursor-grabbing' : 'cursor-grab'
                          }`}
                        >
                          <GripIcon />
                        </button>
                        <div className="flex flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          {stop.redFlag && <span aria-hidden>✕</span>}
                          {!stop.redFlag && stop.yellowFlag && <span aria-hidden>⚠</span>}
                          <span className="text-sm text-[var(--color-text-muted)]">{i + 1}</span>
                          <span className="font-semibold">{wallClock(stop.arrivalTime)}</span>
                          <h2 className="font-semibold">{stop.poi.name}</h2>
                          {outOfBudget && (
                            <span className="rounded-full bg-[var(--color-bg-subtle)] px-2 py-0.5 text-xs font-semibold text-[var(--color-text-muted)]">
                              Beyond your {model.budget}h
                            </span>
                          )}
                        </div>
                        {/* Per-stop reorder/pin controls (screen-only). */}
                        <div className="no-print flex shrink-0 items-center gap-1">
                          {/* aria-disabled (not `disabled`) at the list edges: a real
                              `disabled` attr makes the browser blur the focused button the
                              instant a moved stop reaches an end, dropping keyboard focus to
                              <body>. moveStop already no-ops out of bounds. */}
                          <button
                            type="button"
                            onClick={() => moveStop(i, -1)}
                            aria-disabled={i === 0}
                            aria-label={`Move ${stop.poi.name} earlier`}
                            className={`${ctrlBtn}${i === 0 ? ' cursor-not-allowed opacity-40' : ''}`}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveStop(i, 1)}
                            aria-disabled={i === stops.length - 1}
                            aria-label={`Move ${stop.poi.name} later`}
                            className={`${ctrlBtn}${
                              i === stops.length - 1 ? ' cursor-not-allowed opacity-40' : ''
                            }`}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleLock(stop.poi.id)}
                            aria-pressed={locked}
                            aria-label={locked ? `Unpin ${stop.poi.name}` : `Pin ${stop.poi.name} in place`}
                            className={
                              locked
                                ? 'flex h-11 w-11 items-center justify-center rounded-md border border-[var(--color-primary)] bg-[var(--color-primary)] text-white transition'
                                : ctrlBtn
                            }
                          >
                            <LockIcon locked={locked} />
                          </button>
                        </div>
                      </div>
                      <div className="mt-1 text-sm">
                        {stopDurationLine(stop)} · {stopStatusLine(stop)}
                      </div>
                      {/* The return trip has no stop card of its own, so a budget overrun
                          caused ONLY by getting home (not by this stop's own visit — that
                          case is already covered by outOfBudget above) is easy to miss as a
                          one-line summary buried in the collapsed panel. Surface it right on
                          the last stop, where the traveler is actually looking. */}
                      {fit && !outOfBudget && i === stops.length - 1 && !fit.makesItBack && (
                        <p className="mt-1.5 flex items-start gap-1 text-xs text-[var(--color-flag-warning-text)]">
                          <span aria-hidden>⚠</span>
                          <span>
                            Getting back to {startLocation.name} from here may run past your{' '}
                            {model.budget}h limit (~{fit.returnMinutes} min estimated return).
                          </span>
                        </p>
                      )}
                      {isEnabled('customDuration') && (
                        <DurationStepper
                          stop={stop}
                          onSet={setDuration}
                          onReset={resetDuration}
                          atBudgetCap={atBudgetCap}
                        />
                      )}
                      {stop.poi.notes && (
                        <div className="print-hide mt-1 text-sm italic text-[var(--color-text-muted)]">
                          {stop.poi.notes}
                        </div>
                      )}
                      <p className={reasonClass(stop)}>
                        <span className="font-semibold">Why this stop: </span>
                        {reasonLine(stop, params.transport_mode)}
                      </p>
                    </>
                  )}
                </SortableStop>
              )
            })}
          </ol>
        </SortableContext>
      </DndContext>
    </div>
  )
}
