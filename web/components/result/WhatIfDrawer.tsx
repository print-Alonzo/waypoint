'use client'

import { useMemo } from 'react'
import type { POI, TransportMode, LunchWindow, DurationOverrides } from '@/lib/scheduling/scheduler'
import { modeLabel } from '@/lib/constants'
import { computeWhatIfVariants } from '@/lib/plan/whatif'
import type { ScheduleParams } from '@/lib/plan/params'

// "What if" comparison: the same set of places, re-optimized under each transport
// mode, shown side by side so the speed-vs-cost trade-off is visible. Every figure
// is recomputed by the real scheduler (lib/whatif). Each row is the AUTO-optimized
// order for that mode, so the active-mode row is labelled "your mode" — NOT "your
// exact plan" — since a hand-arranged/pinned plan can differ from the auto order.

export default function WhatIfDrawer({
  pois,
  params,
  coords,
  lunch,
  durations,
  currentMode,
  onChoose,
}: {
  pois: POI[]
  params: ScheduleParams
  coords: { lat: number; lng: number }
  lunch: LunchWindow | null
  durations: DurationOverrides
  currentMode: TransportMode
  onChoose: (mode: TransportMode) => void
}) {
  const variants = useMemo(
    () => computeWhatIfVariants(pois, params, coords, lunch, durations),
    [pois, params, coords, lunch, durations],
  )

  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--color-border)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
            <th className="px-3 py-2 font-semibold" scope="col">
              Option
            </th>
            <th className="px-3 py-2 font-semibold" scope="col">
              Ends
            </th>
            <th className="px-3 py-2 font-semibold" scope="col">
              Length
            </th>
            <th className="px-3 py-2 font-semibold" scope="col">
              Flagged
            </th>
            <th className="px-3 py-2 font-semibold" scope="col">
              Fare
            </th>
            <th className="px-3 py-2" scope="col">
              <span className="sr-only">Action</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {variants.map((v) => {
            const isCurrent = v.mode === currentMode
            return (
              <tr
                key={v.mode}
                className={`border-b border-[var(--color-border)] last:border-0 ${
                  isCurrent ? 'bg-[var(--color-bg-subtle)]' : ''
                }`}
              >
                <td className="px-3 py-2 font-semibold">
                  {modeLabel(v.mode)}
                  {isCurrent && (
                    <span className="ml-1 text-xs font-normal text-[var(--color-text-muted)]">
                      (your mode)
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">{v.endLabel}</td>
                <td className="px-3 py-2">~{v.spanHours}h</td>
                <td className="px-3 py-2">{v.flagged}</td>
                <td className="px-3 py-2">{v.fare}</td>
                <td className="px-3 py-2 text-right">
                  {isCurrent ? (
                    <span className="text-xs text-[var(--color-text-muted)]">—</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onChoose(v.mode)}
                      className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-semibold transition hover:bg-[var(--color-bg-subtle)]"
                    >
                      Use {modeLabel(v.mode)}
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
        Every option (including yours) is re-optimized for that mode, so these figures may differ
        from a plan you’ve hand-arranged above. Times and fares are estimates — verify before you go.
      </p>
    </div>
  )
}
