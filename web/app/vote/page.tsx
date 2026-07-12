import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import VoteView from '@/components/vote/VoteView'
import { isEnabled } from '@/lib/features'

export const metadata: Metadata = {
  title: 'Vote on places — Waypoint',
}

export default function VotePage() {
  // Off by default (single-device only) — see lib/features.ts.
  if (!isEnabled('groupVote')) redirect('/')
  return <VoteView />
}
