import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import LandingPage, { landingMetadata } from '@/components/landing/LandingPage'
import { CHANNELS, isChannel } from '@/lib/validation/channels'

// Short attribution links for the marketing-channel test (waypoint.app/reddit,
// /facebook, ...) — same landing page as '/', with the channel stamped onto
// the visitor's session by LandingPage's ChannelCapture. See
// lib/validation/channels.ts to add a channel.
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

  return <LandingPage channel={channel} />
}
