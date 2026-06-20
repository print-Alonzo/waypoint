import { Suspense } from 'react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import LiveView from '@/components/LiveView'
import { isEnabled } from '@/lib/features'

export const metadata: Metadata = {
  title: 'Live mode — Waypoint',
}

export default function LivePage() {
  if (!isEnabled('liveMode')) redirect('/')
  return (
    <Suspense fallback={<div className="mx-auto max-w-2xl px-5 py-8">Loading…</div>}>
      <LiveView />
    </Suspense>
  )
}
