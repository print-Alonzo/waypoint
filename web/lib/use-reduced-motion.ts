'use client'

import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia(QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

// useSyncExternalStore rather than useEffect + useState: the value is correct on
// the very first client paint (no frame of animation before we learn the user
// didn't want any), and the server snapshot is explicit rather than accidental.
//
// The server snapshot is `false` — matchMedia doesn't exist during prerender and
// the OS preference isn't knowable there. Both sides render the motion-enabled
// markup, so hydration matches; the subscription corrects it immediately after.
/** True when the OS asks for reduced motion. Always false during SSR/prerender. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  )
}
