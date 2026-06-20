import { Suspense } from 'react'
import type { Metadata } from 'next'
import Selector from '@/components/Selector'

export const metadata: Metadata = {
  title: 'Plan your day — Waypoint',
}

export default function PlanPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-2xl px-5 py-8">Loading…</div>}>
      <Selector />
    </Suspense>
  )
}
