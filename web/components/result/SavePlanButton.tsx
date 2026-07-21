'use client'

import { useState } from 'react'
import Link from 'next/link'
import { savePlan } from '@/lib/storage/saved-plans'

// Saves the current plan to this device (localStorage) so it can be compared with
// another. Tapping "Save plan" opens an inline name field (pre-filled with an
// auto-generated name) so plans stay distinguishable later in Compare; the page
// then offers a Compare link.
export default function SavePlanButton({
  query,
  defaultName,
}: {
  query: string
  defaultName: string
}) {
  const [mode, setMode] = useState<'idle' | 'naming' | 'saved'>('idle')
  const [name, setName] = useState(defaultName)

  function handleConfirm() {
    savePlan(name.trim() || defaultName, query, Date.now())
    setMode('saved')
  }

  function handleCancel() {
    setName(defaultName)
    setMode('idle')
  }

  if (mode === 'naming') {
    return (
      <span className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="save-plan-name">
          Plan name
        </label>
        <input
          id="save-plan-name"
          type="text"
          value={name}
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleConfirm()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              handleCancel()
            }
          }}
          className="w-44 rounded-md border border-[var(--color-border)] bg-white px-2 py-1 text-sm focus:outline-none focus:border-[var(--color-text)] focus:ring-1 focus:ring-[var(--color-text)]"
        />
        <button
          type="button"
          onClick={handleConfirm}
          aria-label="Confirm plan name and save"
          className="font-semibold underline-offset-2 hover:underline"
        >
          Save
        </button>
        <button
          type="button"
          onClick={handleCancel}
          aria-label="Cancel saving this plan"
          className="text-[var(--color-text-muted)] underline-offset-2 hover:underline"
        >
          Cancel
        </button>
      </span>
    )
  }

  return (
    <span className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => setMode('naming')}
        aria-label={mode === 'saved' ? 'Plan saved' : 'Save this plan to compare later'}
        className="flex min-h-[44px] items-center justify-center rounded-lg border border-[var(--color-border)] bg-white px-4 text-sm font-semibold transition hover:bg-[var(--color-bg-subtle)]"
      >
        {mode === 'saved' ? 'Saved ✓' : 'Save plan'}
      </button>
      {mode === 'saved' && (
        <Link
          href="/compare"
          className="font-semibold text-[var(--color-primary)] underline-offset-2 hover:underline"
        >
          Compare
        </Link>
      )}
      <span aria-live="polite" className="sr-only">
        {mode === 'saved' ? 'Plan saved — Compare is now available.' : ''}
      </span>
    </span>
  )
}
