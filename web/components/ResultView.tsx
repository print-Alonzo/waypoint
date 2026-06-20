'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { decodeParams, encodeParams } from '@/lib/params'
import { optimizeOrder, scheduleAlong, parseTime } from '@/lib/scheduler'
import type { POI, ScheduledStop, StopReason } from '@/lib/scheduler'
import { POI_MAP, TRANSIT_MATRIX, CITY_LABEL } from '@/lib/data'
import { START_LOCATION_MAP, modeLabel } from '@/lib/constants'
import { reasonLine } from '@/lib/reason'
import {
  buildItineraryText,
  buildIcs,
  icsFilename,
  stopStatusLine,
  wallClock,
} from '@/lib/export'

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
  'flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-border)] ' +
  'bg-white text-[var(--color-text)] transition hover:bg-[var(--color-bg-subtle)] ' +
  'disabled:cursor-not-allowed disabled:opacity-40'

export default function ResultView() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const params = useMemo(
    () => decodeParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  )

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
      let order: string[]
      if (params.order && params.order.length) {
        const fromUrl = [...new Set(params.order.filter((id) => validIds.has(id)))]
        order = [...fromUrl, ...defaultOrder.filter((id) => !fromUrl.includes(id))]
      } else {
        order = defaultOrder
      }
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

      const stops = scheduleAlong(
        orderPOIs,
        TRANSIT_MATRIX,
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
      )

      const isCustom = !sameOrder(order, defaultOrder) || locked.size > 0
      return {
        startLocation,
        coords,
        order,
        locked,
        stops,
        isCustom,
        defaultOrder,
        freeCount: order.length - locked.size,
      }
    } catch {
      // Any malformed shared/edited URL that slips past validation → null → the
      // guard effect bounces to the selector instead of crashing the route.
      return null
    }
  }, [params])

  // Transient feedback for the "Copy text" button.
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mounted = useRef(true)
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
    }
  }, [])

  // SR announcement for reorder / pin / re-optimize actions.
  const [liveMsg, setLiveMsg] = useState('')

  // Guard: invalid/missing params (or unknown POIs) → bounce back to selector.
  useEffect(() => {
    if (!model) router.replace('/')
  }, [model, router])

  if (!model || !params) return null

  const { startLocation, stops } = model
  // params is non-null past the guard above; capture it so the export closures
  // keep the narrowed (non-null) type.
  const safeParams = params
  const flaggedCount = stops.filter((s) => s.yellowFlag || s.redFlag).length
  const allRed = stops.length > 0 && stops.every((s) => s.redFlag)
  const spanMinutes =
    stops[stops.length - 1].departureTime - parseTime(params.start_time)
  const approxHours = Math.max(1, Math.round(spanMinutes / 60))

  // Write a new arrangement into the URL (source of truth → shareable + refresh-
  // safe). `replace` (not push) so each tweak doesn't pile up history entries;
  // scroll:false keeps the user's place in the list.
  function writeArrangement(nextOrder: string[], nextLocked: string[]) {
    const sp = encodeParams({
      poi_ids: safeParams.poi_ids,
      start_time: safeParams.start_time,
      transport_mode: safeParams.transport_mode,
      start_location: safeParams.start_location,
      day_of_week: safeParams.day_of_week,
      order: sameOrder(nextOrder, model!.defaultOrder) ? undefined : nextOrder,
      locked: nextLocked.length ? nextLocked : undefined,
    })
    router.replace('/result?' + sp.toString(), { scroll: false })
  }

  function moveStop(index: number, dir: -1 | 1) {
    const j = index + dir
    if (j < 0 || j >= model!.order.length) return
    const next = [...model!.order]
    ;[next[index], next[j]] = [next[j], next[index]]
    const name = POI_MAP[next[j]]?.name ?? 'Stop'
    setLiveMsg(`Moved ${name} to position ${j + 1}.`)
    writeArrangement(next, [...model!.locked])
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
    writeArrangement(opt.order.map((p) => p.id), [...model!.locked])
  }

  function resetAuto() {
    setLiveMsg('Reset to the automatic order.')
    writeArrangement(model!.defaultOrder, [])
  }

  function handleEdit() {
    // Drop result-only customization when returning to the selector.
    router.push(
      '/plan?' +
        encodeParams({
          poi_ids: safeParams.poi_ids,
          start_time: safeParams.start_time,
          transport_mode: safeParams.transport_mode,
          start_location: safeParams.start_location,
          day_of_week: safeParams.day_of_week,
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
        {params.day_of_week} · Starting from {startLocation.name} ·{' '}
        {modeLabel(params.transport_mode)}
      </p>
      <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
        {stops.length} {stops.length === 1 ? 'stop' : 'stops'} · ~{approxHours}h ·{' '}
        {flaggedCount} flagged
        {model.isCustom && (
          <>
            {' · '}
            <span className="font-semibold text-[var(--color-text)]">your order</span>
          </>
        )}
      </p>

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
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy itinerary as text"
            className="font-semibold underline-offset-2 hover:underline"
          >
            {copyLabel}
          </button>
          <button
            type="button"
            onClick={handleDownloadIcs}
            className="font-semibold underline-offset-2 hover:underline"
          >
            Download .ics
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="font-semibold underline-offset-2 hover:underline"
          >
            Print
          </button>
        </div>
        {/* Stable button name above + a dedicated live region here = reliable SR
            announcement (a live region on the button's own changing label is not). */}
        <span role="status" aria-live="polite" className="sr-only">
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
        <MapView stops={stops} start={startLocation} />
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

      {/* Reorder/pin help + controls. The day is yours to arrange; the optimizer
          only touches what you haven't pinned. */}
      <div className="no-print mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-3 text-sm">
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
        {/* aria-live only (no role=status) so it stays distinct from the copy
            status region above for assistive tech and tests. */}
        <span aria-live="polite" className="sr-only">
          {liveMsg}
        </span>
      </div>

      <ol className="mt-5">
        {stops.map((stop, i) => {
          const locked = stop.placement === 'locked'
          return (
            <li key={stop.poi.id}>
              {i > 0 && (
                <div className="py-2 text-center text-sm text-[var(--color-text-muted)]">
                  <div>
                    ↓ {stop.transitFromPrev} min by {modeLabel(params.transport_mode)}
                  </div>
                  <div className="no-print text-xs">
                    Estimated — verify with Google Maps
                  </div>
                </div>
              )}
              <div className={cardClass(stop)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    {stop.redFlag && <span aria-hidden>✕</span>}
                    {!stop.redFlag && stop.yellowFlag && <span aria-hidden>⚠</span>}
                    <span className="text-sm text-[var(--color-text-muted)]">{i + 1}</span>
                    <span className="font-semibold">{wallClock(stop.arrivalTime)}</span>
                    <span className="font-semibold">{stop.poi.name}</span>
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
                          ? 'flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-primary)] bg-[var(--color-primary)] text-white transition'
                          : ctrlBtn
                      }
                    >
                      <LockIcon locked={locked} />
                    </button>
                  </div>
                </div>
                <div className="mt-1 text-sm">
                  ~{stop.poi.recommended_duration_minutes} min · {stopStatusLine(stop)}
                </div>
                {stop.poi.notes && (
                  <div className="print-hide mt-1 text-sm italic text-[var(--color-text-muted)]">
                    {stop.poi.notes}
                  </div>
                )}
                <p className={reasonClass(stop)}>
                  <span className="font-semibold">Why this stop: </span>
                  {reasonLine(stop, params.transport_mode)}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
