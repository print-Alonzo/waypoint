'use client'

import { useEffect } from 'react'
import { getSession, patchSession } from '@/lib/validation/session'
import { track } from '@/lib/validation/track'
import { isEnabled } from '@/lib/features'
import type { Channel } from '@/lib/validation/channels'

// Stamps first-touch marketing-channel attribution onto the visitor's
// session and fires a `landed` beacon, so every subsequent milestone
// (quiz, signup, ...) carries the channel via track()'s one choke point.
// Two mount points: app/[channel]/page.tsx (channel=<slug>), which renders the
// quiz, and LandingPage on '/' (channel=null, buckets as "direct" in the
// report) — see scripts/validation-channels.mjs for why '/' needs a beacon
// too: without it, direct traffic would have no denominator to compute a
// conversion rate against.
//
// Modelled on components/validation/SessionResetOnParam.tsx: reads
// window.location directly rather than useSearchParams(), which forces a
// Suspense boundary and would de-opt static rendering app-wide.
//
// One-shot per page load. Two jobs: it stops React Strict Mode's
// double-invoked effect from POSTing twice in dev (a fresh session sees
// landedAt === null on both passes), and it makes the channel stamp
// once-per-document rather than once-per-mount.
//
// It resets only on a full page load, never on a soft navigation. That's fine
// while channel URLs are only ever entered from outside (a Reddit post, an IG
// bio, a QR code) — always a hard load. If an in-app <Link> to a channel slug
// is ever added, a visitor who hits '/' first would soft-navigate to it with
// `fired` already true and silently record no channel. Don't add one.
let fired = false

export default function ChannelCapture({ channel }: { channel: Channel | null }) {
  useEffect(() => {
    if (!isEnabled('validation')) return
    if (fired) return

    // A facilitator handing the browser to a new participant via ?new=1 is
    // about to wipe the session (SessionResetOnParam, mounted after <main>
    // so its effect runs later in tree order). Stamping the channel here
    // first would attribute a phantom visit to the outgoing participant's
    // sid and then lose it.
    //
    // Attribution is deliberately forfeited for this one page view: the
    // param is stripped with history.replaceState, which is not a navigation
    // and does not re-run this effect, so recovery needs a reload. That's
    // the right trade — ?new=1 is a facilitator URL for moderated sessions,
    // not a link any real channel visitor follows.
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
