'use client'

import { useEffect } from 'react'
import { resetParticipant } from '@/lib/validation/session'

// Handing the browser to a new usability-test participant: visiting any URL
// with ?new=1 mints a fresh validation session (new sid) and clears saved
// plans, so the next person doesn't inherit the previous participant's data.
// Reads window.location.search directly rather than useSearchParams() — that
// hook forces a Suspense boundary and would de-opt static rendering app-wide
// for a param only a facilitator ever sets. The param is stripped via
// history.replaceState so a later refresh doesn't reset again. Renders
// nothing; see web/README.md for the moderated-session procedure.
export default function SessionResetOnParam() {
  useEffect(() => {
    const url = new URL(window.location.href)
    if (!url.searchParams.has('new')) return

    resetParticipant()

    url.searchParams.delete('new')
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  }, [])

  return null
}
