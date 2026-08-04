import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import LandingPage, { landingMetadata } from '@/components/landing/LandingPage'
import ChannelCapture from '@/components/landing/ChannelCapture'
import QuizView from '@/components/quiz/QuizView'
import { CHANNELS, isChannel } from '@/lib/validation/channels'
import { isEnabled } from '@/lib/features'

// Short attribution links for the marketing-channel test (waypoint.app/reddit,
// /facebook, ...), with the channel stamped onto the visitor's session by
// ChannelCapture. See lib/validation/channels.ts to add a channel.
//
// These open the persona quiz, not the landing page: recruited visitors were
// bouncing off an email ask they had no reason to say yes to yet. The quiz
// costs them nothing, and its result screen hands them to the landing already
// knowing why Waypoint is for them. '/' keeps the landing for direct traffic.
export const dynamicParams = false

export function generateStaticParams() {
  return CHANNELS.map((channel) => ({ channel }))
}

export const metadata: Metadata = {
  ...landingMetadata,
  // Not a duplicate of '/' worth indexing — it's an attribution link.
  robots: { index: false, follow: true },
}

export default async function ChannelPage({ params }: { params: Promise<{ channel: string }> }) {
  const { channel } = await params
  // dynamicParams = false 404s an unknown slug in production, but under
  // `next dev` the (empty) prerender manifest lets unknown slugs fall
  // through and render — see Next's own docs for this exact guard pattern.
  if (!isChannel(channel)) notFound()

  // Study over (flag off): the quiz is gone and /quiz redirects, so these
  // links fall back to the plain landing. Its own ChannelCapture no-ops.
  if (!isEnabled('validation')) return <LandingPage channel={channel} />

  // Mounted here rather than inside QuizView so the capture stays a property of
  // the channel route, not the quiz — /quiz itself must never stamp a channel.
  return (
    <>
      <ChannelCapture channel={channel} />
      <Suspense fallback={<div className="mx-auto max-w-2xl px-5 py-8">Loading…</div>}>
        <QuizView />
      </Suspense>
    </>
  )
}
