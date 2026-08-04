'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { isChannelPath } from '@/lib/validation/channels'
import { isEnabled } from '@/lib/features'

// The landing page carries its own anchor nav + early-access CTA; every other
// route keeps the app's plain wordmark + city pill header. Both live in one
// component (rather than a header-per-layout split) so there's a single sticky
// <header> element and no layout shift when navigating between '/' and the app.
const LANDING_NAV = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#features', label: 'Features' },
  { href: '#roadmap', label: 'Roadmap' },
  { href: '#feedback', label: 'Early feedback' },
]

export default function SiteHeader() {
  const pathname = usePathname()
  // "Is this route showing LandingPage?" — derived from the same flag
  // app/[channel]/page.tsx branches on, so the two can't disagree.
  //
  // Flag on: channel links (/reddit, /facebook, ...) render the quiz, so the
  // nav's four anchors and its CTA would point at sections that aren't on the
  // page. Flag off (study over): the same routes fall back to LandingPage, and
  // without this they'd serve the full landing under a header with no nav and
  // no signup CTA — silently, since nothing errors.
  const isLanding = pathname === '/' || (isChannelPath(pathname) && !isEnabled('validation'))

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-5 bg-[var(--color-bg)] border-b border-[var(--color-border)] px-5 py-4">
      <Link href="/" className="shrink-0 text-xl font-bold tracking-tight text-[var(--color-primary)]">
        Waypoint
      </Link>

      {isLanding ? (
        <>
          <nav className="no-print hidden flex-1 items-center justify-center gap-7 overflow-x-auto sm:flex">
            {LANDING_NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="shrink-0 text-sm font-semibold text-[var(--color-text)]"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <a
            href="#early-access"
            className="no-print shrink-0 inline-flex items-center justify-center rounded-lg bg-[var(--color-primary)] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
          >
            Get early access
          </a>
        </>
      ) : (
        <span className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs font-semibold text-[var(--color-text-muted)]">
          Metro Manila
        </span>
      )}
    </header>
  )
}
