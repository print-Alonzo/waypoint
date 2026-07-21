import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { isEnabled } from '@/lib/features'

export const metadata: Metadata = {
  title: 'Thanks — Waypoint',
}

export default function ThanksPage() {
  if (!isEnabled('validation')) redirect('/')
  return (
    <div className="mx-auto max-w-2xl px-5 py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-[var(--color-primary)]">
        Thank you
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">You&apos;re on the waitlist.</h1>
      <p className="mx-auto mt-4 max-w-md text-[var(--color-text-muted)]">
        We&apos;ll email you when Waypoint launches. In the meantime, feel free to keep exploring
        the app.
      </p>
      <div className="mt-8">
        <Link
          href="/plan"
          className="inline-flex items-center justify-center rounded-lg bg-[var(--color-primary)] px-6 py-3.5 text-base font-bold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
        >
          Keep exploring →
        </Link>
      </div>
    </div>
  )
}
