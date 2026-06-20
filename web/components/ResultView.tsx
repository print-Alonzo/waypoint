'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { decodeParams, encodeParams } from '@/lib/params'
import { scheduleItinerary, parseTime } from '@/lib/scheduler'
import type { POI, ScheduledStop } from '@/lib/scheduler'
import { POI_MAP, TRANSIT_MATRIX, CITY_LABEL } from '@/lib/data'
import { START_LOCATION_MAP, modeLabel } from '@/lib/constants'
import { reasonText } from '@/lib/reason'
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

export default function ResultView() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const params = useMemo(
    () => decodeParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  )

  const computed = useMemo(() => {
    if (!params) return null
    const startLocation = START_LOCATION_MAP[params.start_location]
    if (!startLocation) return null
    const selectedPOIs = params.poi_ids
      .map((id) => POI_MAP[id])
      .filter((p): p is POI => Boolean(p))
    if (selectedPOIs.length === 0) return null
    const stops = scheduleItinerary(
      selectedPOIs,
      TRANSIT_MATRIX,
      params.start_location,
      { lat: startLocation.lat, lng: startLocation.lng },
      params.start_time,
      params.transport_mode,
      params.day_of_week,
    )
    return { startLocation, stops }
  }, [params])

  // Transient feedback for the "Copy text" button.
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mounted = useRef(true)
  useEffect(() => () => {
    // The reset timer is scheduled only after the async clipboard write resolves,
    // so the unmount guard must also stop a post-unmount state update + timer.
    mounted.current = false
    if (copyTimer.current) clearTimeout(copyTimer.current)
  }, [])

  // Guard: invalid/missing params (or unknown POIs) → bounce back to selector.
  useEffect(() => {
    if (!computed) router.replace('/')
  }, [computed, router])

  if (!computed || !params) return null

  const { startLocation, stops } = computed
  // params is non-null past the guard above; capture it so the export closures
  // keep the narrowed (non-null) type.
  const safeParams = params
  const flaggedCount = stops.filter((s) => s.yellowFlag || s.redFlag).length
  const allRed = stops.length > 0 && stops.every((s) => s.redFlag)
  const spanMinutes =
    stops[stops.length - 1].departureTime - parseTime(params.start_time)
  const approxHours = Math.max(1, Math.round(spanMinutes / 60))

  function handleEdit() {
    if (!params) return
    router.push('/?' + encodeParams(params).toString())
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

      <ol className="mt-5">
        {stops.map((stop, i) => (
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
              <div className="flex items-baseline gap-2">
                {stop.redFlag && <span aria-hidden>✕</span>}
                {!stop.redFlag && stop.yellowFlag && <span aria-hidden>⚠</span>}
                <span className="text-sm text-[var(--color-text-muted)]">
                  {i + 1}
                </span>
                <span className="font-semibold">{wallClock(stop.arrivalTime)}</span>
                <span className="font-semibold">{stop.poi.name}</span>
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
                {reasonText(stop.reason, params.transport_mode)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
