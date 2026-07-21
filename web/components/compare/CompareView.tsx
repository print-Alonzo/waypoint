'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  getSavedPlansSnapshot,
  removePlan,
  subscribeSavedPlans,
  type SavedPlan,
} from '@/lib/storage/saved-plans'
import { decodeParams } from '@/lib/plan/params'
import { summarizePlan, type PlanSummary } from '@/lib/plan/summary'
import { CITY_LABEL } from '@/lib/poi/data'
import { modeLabel } from '@/lib/constants'
import { formatFare } from '@/lib/scheduling/fare'

const EMPTY_PLANS: SavedPlan[] = []

function summaryFor(plan: SavedPlan | undefined): PlanSummary | null {
  if (!plan) return null
  const params = decodeParams(new URLSearchParams(plan.query))
  return params ? summarizePlan(params) : null
}

// One metric row, with an optional "better" highlight when the two plans differ.
function Row({
  label,
  a,
  b,
  betterA,
  betterB,
}: {
  label: string
  a: string
  b: string
  betterA?: boolean
  betterB?: boolean
}) {
  const cell = (v: string, better?: boolean) =>
    `px-3 py-2 ${better ? 'font-semibold text-[var(--color-primary)]' : ''}`
  return (
    <tr className="border-b border-[var(--color-border)] last:border-0">
      <th scope="row" className="px-3 py-2 text-left font-medium text-[var(--color-text-muted)]">
        {label}
      </th>
      <td className={cell(a, betterA)}>{a}</td>
      <td className={cell(b, betterB)}>{b}</td>
    </tr>
  )
}

export default function CompareView() {
  // localStorage is client-only — useSyncExternalStore reads it correctly on the
  // first client render (server snapshot is the stable empty array) with no
  // separate mount effect.
  const plans = useSyncExternalStore(subscribeSavedPlans, getSavedPlansSnapshot, () => EMPTY_PLANS)
  const router = useRouter()
  const [aId, setAId] = useState<string>('')
  const [bId, setBId] = useState<string>('')

  // Compare is a pure 2-plan tool; with nothing saved there's nothing to compare,
  // and /saved already owns the "you haven't saved anything" message — so redirect
  // there instead of duplicating that copy here. This has to be a client-side
  // effect (not a server check in app/compare/page.tsx) since plans are
  // localStorage-only, unknown until the first client render.
  useEffect(() => {
    if (plans.length === 0) router.replace('/saved')
  }, [plans.length, router])

  // Default to the first two plans until the traveler picks explicitly.
  const effectiveAId = aId || plans[0]?.id || ''
  const effectiveBId = bId || plans[1]?.id || plans[0]?.id || ''

  const planA = plans.find((p) => p.id === effectiveAId)
  const planB = plans.find((p) => p.id === effectiveBId)
  const sumA = useMemo(() => summaryFor(planA), [planA])
  const sumB = useMemo(() => summaryFor(planB), [planB])

  function forget(id: string) {
    removePlan(id)
    // Re-point any selection that pointed at the removed plan, so the controlled
    // <select>s and the comparison never reference a now-deleted id.
    setAId((prev) => (prev === id ? '' : prev))
    setBId((prev) => (prev === id ? '' : prev))
  }

  // The redirect effect above fires, but only after this first render — return
  // nothing rather than flashing dropdowns/table with no plans to populate them.
  if (plans.length === 0) return null

  const selectClass =
    'w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm ' +
    'focus:outline-none focus:border-[var(--color-text)] focus:ring-1 focus:ring-[var(--color-text)]'

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Compare plans — {CITY_LABEL}</h1>
      <p className="mt-1 text-[var(--color-text-muted)]">
        Two saved plans, side by side. Every figure is recomputed by the same scheduler — fewer
        hours and fewer flags are highlighted.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-semibold">Plan A</span>
          <select
            className={selectClass}
            value={effectiveAId}
            onChange={(e) => setAId(e.target.value)}
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold">Plan B</span>
          <select
            className={selectClass}
            value={effectiveBId}
            onChange={(e) => setBId(e.target.value)}
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {effectiveAId === effectiveBId && (
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">
          You’re comparing a plan with itself.{' '}
          {plans.length < 2
            ? 'Save another plan from the result page to compare two side by side.'
            : 'Pick a different plan in one of the columns.'}
        </p>
      )}

      {sumA && sumB ? (
        <div className="mt-6 overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-left">
                <th className="px-3 py-2" scope="col">
                  <span className="sr-only">Metric</span>
                </th>
                <th className="px-3 py-2 font-semibold" scope="col">
                  {planA?.name}
                </th>
                <th className="px-3 py-2 font-semibold" scope="col">
                  {planB?.name}
                </th>
              </tr>
            </thead>
            <tbody>
              <Row label="Stops" a={String(sumA.stopCount)} b={String(sumB.stopCount)} />
              <Row
                label="Day length"
                a={`~${sumA.hours}h`}
                b={`~${sumB.hours}h`}
                betterA={sumA.hours < sumB.hours}
                betterB={sumB.hours < sumA.hours}
              />
              <Row label="Ends" a={sumA.endLabel} b={sumB.endLabel} />
              <Row
                label="Flagged"
                a={String(sumA.flagged)}
                b={String(sumB.flagged)}
                betterA={sumA.flagged < sumB.flagged}
                betterB={sumB.flagged < sumA.flagged}
              />
              <Row
                label="Est. fare"
                a={formatFare(sumA.fare)}
                b={formatFare(sumB.fare)}
                betterA={sumA.fare.high < sumB.fare.high}
                betterB={sumB.fare.high < sumA.fare.high}
              />
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-6 text-[var(--color-text-muted)]">
          One of these plans can no longer be read (its places may have changed). Remove it and save
          a fresh one.
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        {[planA, planB].map((p, i) => (
          <div key={i} className="rounded-lg border border-[var(--color-border)] p-3">
            <p className="font-semibold">{p?.name}</p>
            {p && (
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                {decodeParams(new URLSearchParams(p.query))?.day_of_week} ·{' '}
                {modeLabel(decodeParams(new URLSearchParams(p.query))?.transport_mode ?? 'grab')}
              </p>
            )}
            <div className="mt-2 flex items-center gap-4">
              {p && (
                <Link
                  href={`/result?${p.query}`}
                  className="font-semibold text-[var(--color-primary)] underline-offset-2 hover:underline"
                >
                  Open
                </Link>
              )}
              {p && (
                <button
                  type="button"
                  onClick={() => forget(p.id)}
                  className="text-[var(--color-text-muted)] underline-offset-2 hover:underline"
                >
                  Forget
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-8 text-sm">
        <Link href="/plan" className="underline underline-offset-2 hover:text-[var(--color-text)]">
          ← Plan another day
        </Link>
      </p>
    </div>
  )
}
