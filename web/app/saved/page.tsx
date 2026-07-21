import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import SavedPlansView from '@/components/saved/SavedPlansView'
import { isEnabled } from '@/lib/features'

export const metadata: Metadata = {
  title: 'Saved plans — Waypoint',
}

export default function SavedPage() {
  // Feature flag off ⇒ the route effectively doesn't exist.
  if (!isEnabled('comparePlans')) redirect('/')
  return <SavedPlansView />
}
