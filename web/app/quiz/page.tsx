import { Suspense } from 'react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import QuizView from '@/components/quiz/QuizView'
import { isEnabled } from '@/lib/features'

export const metadata: Metadata = {
  title: 'Find your travel style — Waypoint',
}

export default function QuizPage() {
  if (!isEnabled('validation')) redirect('/')
  return (
    <Suspense fallback={<div className="mx-auto max-w-2xl px-5 py-8">Loading…</div>}>
      <QuizView />
    </Suspense>
  )
}
