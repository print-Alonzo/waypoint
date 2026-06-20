'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { POIS } from '@/lib/data'
import { CATEGORIES } from '@/lib/constants'
import { hoursLabel } from '@/lib/poi-format'
import { encodeParams } from '@/lib/params'
import { CategoryGlyph } from './CategoryGlyph'

// Single-device group vote: pass one phone around, everyone taps a thumb on the
// places they want, then plan the winners. This is intentionally device-local —
// real-time multi-device voting would need a shared backend, which Waypoint
// deliberately doesn't have (see web/README.md). Flag OFF by default.

const KEY = 'waypoint:votes'

type Votes = Record<string, number>

function readVotes(): Votes {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}
function writeVotes(v: Votes): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(v))
  } catch {
    /* storage unavailable — votes stay in memory for this session */
  }
}

export default function VoteView() {
  const router = useRouter()
  const [votes, setVotes] = useState<Votes>({})

  useEffect(() => {
    setVotes(readVotes())
  }, [])

  function bump(id: string, delta: number) {
    setVotes((prev) => {
      const next = { ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }
      if (next[id] === 0) delete next[id]
      writeVotes(next)
      return next
    })
  }

  function reset() {
    setVotes({})
    writeVotes({})
  }

  const grouped = useMemo(
    () =>
      CATEGORIES.map((c) => ({ ...c, pois: POIS.filter((p) => p.category === c.key) })).filter(
        (g) => g.pois.length > 0,
      ),
    [],
  )

  const winners = useMemo(
    () =>
      Object.entries(votes)
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => id),
    [votes],
  )
  const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0)

  function planWinners() {
    if (winners.length === 0) return
    const qs = encodeParams({
      poi_ids: winners.slice(0, 10),
      start_time: '09:00',
      transport_mode: 'grab',
      start_location: 'rizal-park',
      day_of_week: 'Saturday',
    }).toString()
    router.push('/plan?' + qs)
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 pb-28">
      <h1 className="text-2xl font-bold tracking-tight">Vote on places</h1>
      <p className="mt-2 text-[var(--color-text-muted)]">
        Pass the phone around — everyone taps a thumb on the places they want. When you’re done,
        plan the winners together.
      </p>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
        Votes are kept on this device only.
      </p>

      {grouped.map((group) => (
        <section key={group.key} className="mt-7">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
            {group.label}
          </h2>
          <ul className="space-y-2">
            {group.pois.map((poi) => {
              const count = votes[poi.id] ?? 0
              return (
                <li
                  key={poi.id}
                  className={`flex items-center gap-3 rounded-lg border p-3 ${
                    count > 0
                      ? 'border-[var(--color-primary)] bg-white'
                      : 'border-[var(--color-border)] bg-white'
                  }`}
                >
                  <span className="text-[var(--color-text-muted)]">
                    <CategoryGlyph category={poi.category} className="h-6 w-6" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold leading-tight">{poi.name}</span>
                    <span className="block text-xs text-[var(--color-text-muted)]">
                      {hoursLabel(poi)}
                    </span>
                  </span>
                  {/* Always rendered (aria-disabled at 0, not unmounted) so keyboard
                      focus isn't dropped when the count returns to zero. */}
                  <button
                    type="button"
                    onClick={() => bump(poi.id, -1)}
                    aria-disabled={count === 0}
                    aria-label={`Remove a vote from ${poi.name}`}
                    className={`flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg-subtle)]${
                      count === 0 ? ' cursor-not-allowed opacity-40' : ''
                    }`}
                  >
                    −
                  </button>
                  <span
                    aria-live="polite"
                    aria-label={`${count} ${count === 1 ? 'vote' : 'votes'} for ${poi.name}`}
                    className="w-6 text-center text-sm font-bold tabular-nums"
                  >
                    {count}
                  </span>
                  <button
                    type="button"
                    onClick={() => bump(poi.id, 1)}
                    aria-label={`Vote for ${poi.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-primary)] bg-[var(--color-primary)] text-white transition hover:bg-[var(--color-primary-hover)]"
                  >
                    👍
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      <p className="mt-8 text-sm">
        <Link href="/plan" className="underline underline-offset-2 hover:text-[var(--color-text)]">
          Skip voting — just plan a day →
        </Link>
        {totalVotes > 0 && (
          <button
            type="button"
            onClick={reset}
            className="ml-4 text-[var(--color-text-muted)] underline underline-offset-2 hover:text-[var(--color-text)]"
          >
            Reset votes
          </button>
        )}
      </p>

      {/* Sticky tally + CTA */}
      <div className="fixed inset-x-0 bottom-0 border-t border-[var(--color-border)] bg-[var(--color-bg)] px-5 py-4">
        <div className="mx-auto flex max-w-2xl items-center gap-4">
          <span className="text-sm text-[var(--color-text-muted)]">
            {winners.length} {winners.length === 1 ? 'place' : 'places'} · {totalVotes}{' '}
            {totalVotes === 1 ? 'vote' : 'votes'}
          </span>
          <button
            type="button"
            onClick={planWinners}
            disabled={winners.length === 0}
            className={
              winners.length === 0
                ? 'ml-auto cursor-not-allowed rounded-lg bg-[var(--color-bg-subtle)] px-5 py-3 text-sm font-semibold text-[var(--color-text-muted)]'
                : 'ml-auto rounded-lg bg-[var(--color-primary)] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[var(--color-primary-hover)]'
            }
          >
            Plan the winners →
          </button>
        </div>
      </div>
    </div>
  )
}
