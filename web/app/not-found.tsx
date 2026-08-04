import Link from 'next/link'
import type { Metadata } from 'next'

// The channel short links (/reddit, /promo, ...) get typed by hand off a QR
// code, a poster, or an IG bio, so near-misses like /redit are expected
// traffic rather than an edge case. Next's built-in 404 renders in its own
// font stack underneath Waypoint's header — an off-design dead end with no
// route back. This keeps a mistyped link convertible.
export const metadata: Metadata = {
  title: 'Page not found — Waypoint',
  robots: { index: false, follow: false },
}

const primaryCta =
  'inline-flex items-center justify-center rounded-lg bg-[var(--color-primary)] px-6 py-3.5 ' +
  'text-base font-bold text-white transition-colors hover:bg-[var(--color-primary-hover)]'
const secondaryCta =
  'inline-flex items-center justify-center rounded-lg border border-[var(--color-border)] px-6 py-3.5 ' +
  'text-base font-semibold transition-colors hover:bg-[var(--color-bg-subtle)]'

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-5 py-24 text-center sm:py-32">
      <p className="text-sm font-semibold uppercase tracking-wider text-[var(--color-primary)]">
        404
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
        We couldn&apos;t find that page.
      </h1>
      <p className="mx-auto mt-4 max-w-md text-[var(--color-text-muted)]">
        The link may be mistyped or out of date. Waypoint is still here — plan a day in Metro
        Manila, or sign up to be one of the earliest users.
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link href="/#early-access" className={primaryCta}>
          Get early access →
        </Link>
        <Link href="/plan" className={secondaryCta}>
          Try the planner
        </Link>
      </div>
    </div>
  )
}
