'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import {
  getSavedPlansSnapshot,
  removePlan,
  subscribeSavedPlans,
  type SavedPlan,
} from '@/lib/storage/saved-plans'
import { decodeParams } from '@/lib/plan/params'
import { summarizePlan } from '@/lib/plan/summary'
import { modeLabel } from '@/lib/constants'

const EMPTY_PLANS: SavedPlan[] = []

export default function SavedPlansView() {
  // localStorage is client-only — useSyncExternalStore reads it correctly on the
  // first client render (server snapshot is the stable empty array) with no
  // separate mount effect.
  const plans = useSyncExternalStore(subscribeSavedPlans, getSavedPlansSnapshot, () => EMPTY_PLANS)

  if (plans.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-10">
        <h1 className="text-2xl font-bold tracking-tight">Saved plans</h1>
        <p className="mt-3 text-[var(--color-text-muted)]">
          You haven’t saved any plans yet. Open a plan and tap{' '}
          <span className="font-semibold text-[var(--color-text)]">Save plan</span> on the result
          page, then come back here to see it.
        </p>
        <Link
          href="/plan"
          className="mt-6 inline-flex rounded-lg bg-[var(--color-primary)] px-5 py-3 font-bold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
        >
          Plan a day →
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Saved plans</h1>
        {/* Shown even with only 1 plan so it's discoverable — Compare's own
            "comparing a plan with itself" message covers that case. */}
        <Link
          href="/compare"
          className="font-semibold text-[var(--color-primary)] underline-offset-2 hover:underline"
        >
          Compare plans →
        </Link>
      </div>

      <ul className="mt-6 space-y-3">
        {plans.map((p) => {
          const params = decodeParams(new URLSearchParams(p.query))
          const summary = params ? summarizePlan(params) : null
          return (
            <li
              key={p.id}
              className="rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-sm"
            >
              <p className="font-semibold">{p.name}</p>
              <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
                {params
                  ? `${params.day_of_week} · ${modeLabel(params.transport_mode)}${
                      summary ? ` · ${summary.stopCount} stops · ~${summary.hours}h` : ''
                    }`
                  : 'This plan can no longer be read.'}
              </p>
              <div className="mt-3 flex items-center gap-4 text-sm">
                <Link
                  href={`/result?${p.query}`}
                  className="font-semibold text-[var(--color-primary)] underline-offset-2 hover:underline"
                >
                  Open
                </Link>
                <button
                  type="button"
                  onClick={() => removePlan(p.id)}
                  className="text-[var(--color-text-muted)] underline-offset-2 hover:underline"
                >
                  Forget
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <p className="mt-8 text-sm">
        <Link href="/plan" className="underline underline-offset-2 hover:text-[var(--color-text)]">
          ← Plan another day
        </Link>
      </p>
    </div>
  )
}
