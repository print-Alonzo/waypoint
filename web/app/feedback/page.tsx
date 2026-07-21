import { Suspense } from 'react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import FeedbackView from '@/components/feedback/FeedbackView'
import { isEnabled } from '@/lib/features'

export const metadata: Metadata = {
  title: 'Tell us what you think — Waypoint',
}

export default function FeedbackPage() {
  if (!isEnabled('validation')) redirect('/')
  return (
    <Suspense fallback={<div className="mx-auto max-w-2xl px-5 py-8">Loading…</div>}>
      <FeedbackView />
    </Suspense>
  )
}
