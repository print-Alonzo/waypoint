'use client'

import { useEffect } from 'react'
import { usePrefersReducedMotion } from '@/lib/hooks/use-reduced-motion'

// Powers the landing page's in-page jumps (header nav, hero "See how it works",
// footer CTAs) with a smooth scroll. This used to be `html { scroll-behavior:
// smooth }` in globals.css, but that property also governs the browser's own
// scroll-position restoration on back/forward navigation — so pressing Back
// after clicking through to /plan made the landing page slowly re-scroll to
// where you'd been instead of snapping back instantly, reading as if Back
// hadn't worked at all. scrollIntoView's own `behavior` option animates only
// clicks on same-page anchors, leaving history navigation alone.
export default function SmoothAnchorNav() {
  const prefersReducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return
      const anchor = (e.target as HTMLElement).closest('a[href^="#"]')
      if (!anchor) return
      const id = anchor.getAttribute('href')?.slice(1)
      if (!id) return
      const el = document.getElementById(id)
      if (!el) return
      e.preventDefault()
      el.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' })
      history.pushState(null, '', `#${id}`)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [prefersReducedMotion])

  return null
}
