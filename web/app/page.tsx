import { Suspense } from 'react'
import Selector from '@/components/Selector'

export default function Home() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-2xl px-5 py-8">Loading…</div>}>
      <Selector />
    </Suspense>
  )
}
