'use client'

import { useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { decodeParams, encodeParams } from '@/lib/params'
import { scheduleItinerary, parseTime, formatTime } from '@/lib/scheduler'
import type { POI, ScheduledStop } from '@/lib/scheduler'
import { POI_MAP, TRANSIT_MATRIX, CITY_LABEL } from '@/lib/data'
import { START_LOCATION_MAP, TRANSPORT_MODES } from '@/lib/constants'

function modeLabel(value: string): string {
  return TRANSPORT_MODES.find((m) => m.value === value)?.label ?? value
}

function statusText(stop: ScheduledStop): string {
  if (stop.redFlag) return 'Closed today'
  if (stop.yellowFlag) return 'Check hours before visiting'
  return `open until ${stop.poi.close_time}`
}

function cardClass(stop: ScheduledStop): string {
  const base = 'rounded-xl border p-4 shadow-sm'
  if (stop.redFlag)
    return `${base} border-[var(--color-flag-error-border)] bg-[var(--color-flag-error-bg)] text-[var(--color-flag-error-text)]`
  if (stop.yellowFlag)
    return `${base} border-[var(--color-flag-warning-border)] bg-[var(--color-flag-warning-bg)] text-[var(--color-flag-warning-text)]`
  return `${base} border-[var(--color-border)] bg-white`
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

  // Guard: invalid/missing params (or unknown POIs) → bounce back to selector.
  useEffect(() => {
    if (!computed) router.replace('/')
  }, [computed, router])

  if (!computed || !params) return null

  const { startLocation, stops } = computed
  const flaggedCount = stops.filter((s) => s.yellowFlag || s.redFlag).length
  const allRed = stops.length > 0 && stops.every((s) => s.redFlag)
  const spanMinutes =
    stops[stops.length - 1].departureTime - parseTime(params.start_time)
  const approxHours = Math.max(1, Math.round(spanMinutes / 60))

  function handleEdit() {
    if (!params) return
    router.push('/?' + encodeParams(params).toString())
  }

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
      <div className="no-print mt-4 flex items-center justify-between border-y border-[var(--color-border)] py-2 text-sm text-[var(--color-text-muted)]">
        <button
          type="button"
          onClick={handleEdit}
          className="font-semibold underline-offset-2 hover:underline"
        >
          ← Edit this list
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="font-semibold underline-offset-2 hover:underline"
        >
          Print itinerary
        </button>
      </div>

      {allRed && (
        <div className="mt-5 rounded-xl border border-[var(--color-flag-error-border)] bg-[var(--color-flag-error-bg)] p-4 font-semibold text-[var(--color-flag-error-text)]">
          All selected places are closed on this day.
        </div>
      )}

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
                <span className="font-semibold">{formatTime(stop.arrivalTime)}</span>
                <span className="font-semibold">{stop.poi.name}</span>
              </div>
              <div className="mt-1 text-sm">
                ~{stop.poi.recommended_duration_minutes} min · {statusText(stop)}
              </div>
              {stop.poi.notes && (
                <div className="print-hide mt-1 text-sm italic text-[var(--color-text-muted)]">
                  {stop.poi.notes}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
