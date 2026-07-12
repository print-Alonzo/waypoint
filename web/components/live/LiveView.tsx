'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { decodeParams } from '@/lib/plan/params'
import { resolvePlan } from '@/lib/plan/model'
import { parseTime } from '@/lib/scheduling/scheduler'
import { wallClock } from '@/lib/plan/export'
import { modeLabel } from '@/lib/constants'

// Device-clock companion for the day. Reads the same plan URL, then — against this
// device's wall clock — shows where you are now, what's next, and how long until
// you should move on. "Running late" shifts the rest of the day so the countdowns
// stay honest. No invented data: all stop times come from resolvePlan.

function countdown(min: number): string {
  if (min <= 0) return 'now'
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)}h ${min % 60}m`
}

export default function LiveView() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const params = useMemo(
    () => decodeParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  )
  const model = useMemo(() => (params ? resolvePlan(params) : null), [params])

  // Device clock (minutes from midnight). null until mounted to avoid hydration drift.
  const [nowMin, setNowMin] = useState<number | null>(null)
  // Minutes the user reports running late; shifts every upcoming time.
  const [delay, setDelay] = useState(0)

  useEffect(() => {
    const tick = () => {
      const d = new Date()
      setNowMin(d.getHours() * 60 + d.getMinutes())
    }
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!model || !params) router.replace('/')
  }, [model, params, router])

  if (!model || !params) return null

  const eff = model.stops.map((s) => {
    const a = s.arrivalTime + delay
    return {
      name: s.poi.name,
      redFlag: s.redFlag, // closed-all-day: unaffected by running late
      // Re-derive the past-close flag against the DELAYED arrival — otherwise a
      // "running late" shift could push you past closing while we still showed the
      // stop as open, contradicting the time we display.
      yellowFlag: s.yellowFlag || (!s.redFlag && a > parseTime(s.poi.close_time)),
      a,
      d: s.departureTime + delay,
    }
  })

  // "Right now" status, computed only once the clock is known.
  let now: {
    kind: 'before' | 'at' | 'transit' | 'done'
    index: number
    minutes: number
    name?: string
  } | null = null
  if (nowMin !== null) {
    const current = eff.findIndex((s) => nowMin >= s.a && nowMin < s.d)
    const next = eff.findIndex((s) => s.a > nowMin)
    if (current >= 0) {
      now = { kind: 'at', index: current, minutes: eff[current].d - nowMin, name: eff[current].name }
    } else if (next === 0) {
      now = { kind: 'before', index: 0, minutes: eff[0].a - nowMin, name: eff[0].name }
    } else if (next > 0) {
      now = { kind: 'transit', index: next, minutes: eff[next].a - nowMin, name: eff[next].name }
    } else {
      now = { kind: 'done', index: eff.length - 1, minutes: 0 }
    }
  }

  const headline = (() => {
    if (!now) return 'Loading your day…'
    if (now.kind === 'done') return 'Your day is complete 🎉'
    if (now.kind === 'at') return `You're at ${now.name}`
    if (now.kind === 'before') return `First stop: ${now.name}`
    return `On your way to ${now.name}`
  })()

  const subline = (() => {
    if (!now || now.kind === 'done') return null
    if (now.kind === 'at')
      return `Leave in ${countdown(now.minutes)} (by ${wallClock(eff[now.index].d)})`
    return `Arrive in ${countdown(now.minutes)} (around ${wallClock(eff[now.index].a)})`
  })()

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Live mode</h1>
        <span className="font-mono text-lg font-semibold tabular-nums">
          {nowMin === null ? '—:—' : wallClock(nowMin)}
        </span>
      </div>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        {params.day_of_week} · {modeLabel(params.transport_mode)} · using this device’s clock
      </p>

      {/* Right-now card. aria-live so SR users hear the status change on the 30s
          tick, on stop transitions, and when "running late" shifts the day. */}
      <div
        aria-live="polite"
        className="mt-5 rounded-xl border border-[var(--color-primary)] bg-[var(--color-flag-error-bg)] p-5"
      >
        <p className="text-lg font-bold">{headline}</p>
        {subline && <p className="mt-1 text-[var(--color-text)]">{subline}</p>}
        {delay > 0 && (
          <p className="mt-2 text-sm font-semibold text-[var(--color-flag-error-text)]">
            Running {delay} min behind — times below are shifted.
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {now?.kind !== 'done' && (
            <button
              type="button"
              onClick={() => setDelay((d) => d + 15)}
              className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm font-semibold transition hover:bg-[var(--color-bg-subtle)]"
            >
              I’m running late (+15 min)
            </button>
          )}
          {delay > 0 && (
            <button
              type="button"
              onClick={() => setDelay(0)}
              className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm font-semibold transition hover:bg-[var(--color-bg-subtle)]"
            >
              Back on schedule
            </button>
          )}
        </div>
      </div>

      {/* Full timeline */}
      <ol className="mt-6 space-y-2">
        {eff.map((s, i) => {
          const isNow = now?.index === i && (now.kind === 'at' || now.kind === 'transit' || now.kind === 'before')
          const isPast = nowMin !== null && nowMin >= s.d
          return (
            <li
              key={i}
              className={`flex items-center gap-3 rounded-lg border p-3 ${
                isNow
                  ? 'border-[var(--color-primary)] bg-white shadow-sm'
                  : 'border-[var(--color-border)] bg-white'
              } ${isPast ? 'opacity-50' : ''}`}
            >
              <span className="w-14 shrink-0 font-mono text-sm font-semibold tabular-nums">
                {wallClock(s.a)}
              </span>
              <span className="flex-1">
                <span className="font-semibold">{s.name}</span>
                {s.redFlag && <span className="ml-2 text-sm text-[var(--color-flag-error-text)]">✕ closed</span>}
                {!s.redFlag && s.yellowFlag && (
                  <span className="ml-2 text-sm text-[var(--color-flag-warning-text)]">⚠ check hours</span>
                )}
              </span>
              {isPast && <span aria-hidden className="text-[var(--color-text-muted)]">✓</span>}
              {isNow && (
                <span className="rounded-full bg-[var(--color-primary)] px-2 py-0.5 text-xs font-semibold text-white">
                  now
                </span>
              )}
            </li>
          )
        })}
      </ol>

      <p className="mt-8 flex gap-4 text-sm">
        <Link
          href={`/result?${searchParams.toString()}`}
          className="underline underline-offset-2 hover:text-[var(--color-text)]"
        >
          ← Back to the plan
        </Link>
      </p>
    </div>
  )
}
