'use client'

import { useEffect } from 'react'
import { getSession, patchSession } from '@/lib/validation/session'
import { track } from '@/lib/validation/track'
import { isEnabled } from '@/lib/features'
import type { Channel } from '@/lib/validation/channels'

// Stamps first-touch marketing-channel attribution onto the visitor's
// session and fires a `landed` beacon, so every subsequent milestone
// (waitlist, quiz, ...) carries the channel via track()'s one choke point.
// Mounted by LandingPage for both '/' (channel=null, buckets as "direct" in
// the report) and '/[channel]' (channel=<slug>) — see
// scripts/validation-channels.mjs for why '/' needs a beacon too: without
// it, direct traffic would have no denominator to compute a conversion rate
// against.
//
// Modelled on components/validation/SessionResetOnParam.tsx: reads
// window.location directly rather than useSearchParams(), which forces a
// Suspense boundary and would de-opt static rendering app-wide.
//
// fired guards against React Strict Mode's double-invoked effect in dev —
// without it, a fresh session sees landedAt === null on both passes and
// POSTs twice.
let fired = false

export default function ChannelCapture({ channel }: { channel: Channel | null }) {
  useEffect(() => {
    if (!isEnabled('validation')) return
    if (fired) return

    // A facilitator handing the browser to a new participant via ?new=1 is
    // about to wipe the session (SessionResetOnParam, mounted after <main>
    // so its effect runs later in tree order). Stamping the channel here
    // first would attribute a phantom visit to the outgoing participant's
    // sid and then lose it — bail and let the fresh session pick up the
    // channel on the next real navigation instead.
    if (new URL(window.location.href).searchParams.has('new')) return

    fired = true

    const session = getSession()
    if (channel && !session.channel) {
      patchSession({ channel })
    }
    if (!session.landedAt) {
      void track('landed')
    }
  }, [channel])

  return null
}
