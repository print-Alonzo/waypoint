import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import CompareView from '@/components/CompareView'
import { isEnabled } from '@/lib/features'

export const metadata: Metadata = {
  title: 'Compare plans — Waypoint',
}

export default function ComparePage() {
  // Feature flag off ⇒ the route effectively doesn't exist.
  if (!isEnabled('comparePlans')) redirect('/')
  return <CompareView />
}
