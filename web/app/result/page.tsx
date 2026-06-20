import { Suspense } from 'react'
import ErrorBoundary from '@/components/ErrorBoundary'
import ResultView from '@/components/ResultView'

export default function ResultPage() {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={<div className="mx-auto max-w-2xl px-5 py-8">Loading…</div>}
      >
        <ResultView />
      </Suspense>
    </ErrorBoundary>
  )
}
