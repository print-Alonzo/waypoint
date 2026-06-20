'use client'

import { useState } from 'react'
import Link from 'next/link'
import { savePlan } from '@/lib/saved-plans'

// Saves the current plan to this device (localStorage) so it can be compared with
// another. One tap saves with an auto name; the page then offers a Compare link.
export default function SavePlanButton({
  query,
  defaultName,
}: {
  query: string
  defaultName: string
}) {
  const [saved, setSaved] = useState(false)

  function handleSave() {
    savePlan(defaultName, query, Date.now())
    setSaved(true)
  }

  return (
    <span className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleSave}
        aria-label={saved ? 'Plan saved' : 'Save this plan to compare later'}
        className="font-semibold underline-offset-2 hover:underline"
      >
        {saved ? 'Saved ✓' : 'Save plan'}
      </button>
      {saved && (
        <Link
          href="/compare"
          className="font-semibold text-[var(--color-primary)] underline-offset-2 hover:underline"
        >
          Compare
        </Link>
      )}
      <span aria-live="polite" className="sr-only">
        {saved ? 'Plan saved — Compare is now available.' : ''}
      </span>
    </span>
  )
}
