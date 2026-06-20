'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { listSavedPlans, removePlan, type SavedPlan } from '@/lib/saved-plans'
import { decodeParams } from '@/lib/params'
import { summarizePlan, type PlanSummary } from '@/lib/plan-summary'
import { CITY_LABEL } from '@/lib/data'
import { modeLabel } from '@/lib/constants'
import { formatFare } from '@/lib/fare'

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
  const [plans, setPlans] = useState<SavedPlan[]>([])
  const [aId, setAId] = useState<string>('')
  const [bId, setBId] = useState<string>('')

  // localStorage is client-only — load after mount.
  useEffect(() => {
    const saved = listSavedPlans()
    setPlans(saved)
    setAId((prev) => prev || saved[0]?.id || '')
    setBId((prev) => prev || saved[1]?.id || saved[0]?.id || '')
  }, [])

  const planA = plans.find((p) => p.id === aId)
  const planB = plans.find((p) => p.id === bId)
  const sumA = useMemo(() => summaryFor(planA), [planA])
  const sumB = useMemo(() => summaryFor(planB), [planB])

  function forget(id: string) {
    removePlan(id)
    const next = listSavedPlans()
    setPlans(next)
    // Re-point any selection that pointed at the removed plan, so the controlled
    // <select>s and the comparison never reference a now-deleted id.
    setAId((prev) => (prev === id ? next[0]?.id ?? '' : prev))
    setBId((prev) => (prev === id ? next[1]?.id ?? next[0]?.id ?? '' : prev))
  }

  if (plans.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-10">
        <h1 className="text-2xl font-bold tracking-tight">Compare plans</h1>
        <p className="mt-3 text-[var(--color-text-muted)]">
          You haven’t saved any plans yet. Open a plan and tap{' '}
          <span className="font-semibold text-[var(--color-text)]">Save plan</span> on the result
          page, then come back here to compare two side by side.
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
          <select className={selectClass} value={aId} onChange={(e) => setAId(e.target.value)}>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold">Plan B</span>
          <select className={selectClass} value={bId} onChange={(e) => setBId(e.target.value)}>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {aId === bId && (
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
