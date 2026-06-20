'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { POIS } from '@/lib/data'
import {
  CATEGORIES,
  DAYS_OF_WEEK,
  TRANSPORT_MODES,
  START_LOCATIONS,
} from '@/lib/constants'
import { encodeParams, decodeParams } from '@/lib/params'
import type { ScheduleParams } from '@/lib/params'
import type { POI, TransportMode } from '@/lib/scheduler'

function hoursLabel(poi: POI): string {
  const hours = `${poi.open_time}–${poi.close_time}`
  if (poi.closed_days.length === 0) return hours
  if (poi.closed_days.length > 3) return `${hours} · select days only`
  return `${hours} · closed ${poi.closed_days.join(', ')}`
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
  const [dayOfWeek, setDayOfWeek] = useState(prefill?.day_of_week ?? 'Saturday')

  const grouped = useMemo(
    () =>
      CATEGORIES.map((c) => ({
        ...c,
        pois: POIS.filter((p) => p.category === c.key),
      })).filter((g) => g.pois.length > 0),
    [],
  )

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
    const params: ScheduleParams = {
      // Keep dataset order; the scheduler reorders anyway.
      poi_ids: POIS.filter((p) => selected.has(p.id)).map((p) => p.id),
      start_time: startTime,
      transport_mode: transportMode,
      start_location: startLocation,
      day_of_week: dayOfWeek,
    }
    router.push('/result?' + encodeParams(params).toString())
  }

  const count = selected.size

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl px-5 py-8 pb-28">
      <h1 className="text-3xl font-bold tracking-tight">Where do you want to go?</h1>
      <p className="mt-2 text-[var(--color-text-muted)]">
        Select the places you want to visit, then plan your day.
      </p>

      {grouped.map((group) => (
        <fieldset key={group.key} className="mt-7">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
            {group.label}
          </legend>
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
            {group.pois.map((poi) => (
              <label
                key={poi.id}
                className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--color-bg-subtle)]"
              >
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded accent-[#ff385c]"
                  checked={selected.has(poi.id)}
                  onChange={() => toggle(poi.id)}
                />
                <span className="flex-1">
                  <span className="block font-medium">{poi.name}</span>
                  <span className="block text-sm text-[var(--color-text-muted)]">
                    {hoursLabel(poi)}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}

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

      {/* Sticky CTA bar (Airbnb-style) */}
      <div className="fixed inset-x-0 bottom-0 border-t border-[var(--color-border)] bg-[var(--color-bg)] px-5 py-4">
        <div className="mx-auto max-w-2xl">
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
