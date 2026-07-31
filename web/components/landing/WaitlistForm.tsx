'use client'

import { useState } from 'react'
import Link from 'next/link'
import { track } from '@/lib/validation/track'
import { isEnabled } from '@/lib/features'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const primaryCta =
  'inline-flex items-center justify-center rounded-lg bg-[var(--color-primary)] px-6 py-3 ' +
  'text-base font-bold text-white transition-colors hover:bg-[var(--color-primary-hover)]'

export default function WaitlistForm() {
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error' | 'success'>('idle')

  const emailValid = EMAIL_RE.test(email.trim())
  const canSubmit = emailValid && consent && status !== 'submitting'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setStatus('submitting')
    const { ok } = await track('waitlist', { email: email.trim(), consent: true })
    setStatus(ok ? 'success' : 'error')
  }

  if (status === 'success') {
    return (
      <>
        <h2 className="text-2xl font-bold tracking-tight sm:text-[1.75rem]">
          You&apos;re on the list 🎉
        </h2>
        <p className="mx-auto mt-2 max-w-md text-[var(--color-text-muted)]">
          {isEnabled('validation') ? (
            <>
              We&apos;ll email {email.trim()} when it&apos;s your turn. Help shape the Waypoint
              you&apos;ll actually use — take our 2-minute traveler quiz, and your answers help us
              build the experience, starting with yours.
            </>
          ) : (
            <>
              We&apos;ll email {email.trim()} when it&apos;s your turn. In the meantime, the core
              flow works today — feel free to try it.
            </>
          )}
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {isEnabled('validation') ? (
            <Link href="/quiz" className={primaryCta}>
              Take the 2-minute quiz →
            </Link>
          ) : (
            <Link href="/plan" className={primaryCta}>
              Try the live planner →
            </Link>
          )}
        </div>
      </>
    )
  }

  return (
    <>
      <h2 className="text-2xl font-bold tracking-tight sm:text-[1.75rem]">Get early access</h2>
      <p className="mx-auto mt-2 max-w-md text-[var(--color-text-muted)]">
        Join the waitlist to hear when Waypoint opens up, plus a first look at what&apos;s on the
        roadmap.
      </p>
      <form onSubmit={handleSubmit} className="mt-6">
        <div className="flex flex-wrap justify-center gap-2.5">
          <label htmlFor="waitlist-email" className="sr-only">
            Email
          </label>
          <input
            id="waitlist-email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full max-w-xs flex-1 rounded-lg border border-[var(--color-border)] bg-white px-4 py-3 text-base focus:outline-none focus:border-[var(--color-text)] focus:ring-1 focus:ring-[var(--color-text)]"
          />
          <button
            type="submit"
            disabled={!canSubmit}
            className={
              canSubmit
                ? 'rounded-lg bg-[var(--color-primary)] px-5 py-3 text-base font-bold text-white transition-colors hover:bg-[var(--color-primary-hover)]'
                : 'cursor-not-allowed rounded-lg bg-[var(--color-bg-subtle)] px-5 py-3 text-base font-semibold text-[var(--color-text-muted)]'
            }
          >
            {status === 'submitting' ? 'Joining…' : 'Join waitlist'}
          </button>
        </div>
        <label className="mx-auto mt-3 flex max-w-xs items-start gap-2 text-left text-sm text-[var(--color-text-muted)] sm:max-w-none sm:justify-center">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
          />
          <span>We&apos;ll only email you when Waypoint launches — no spam.</span>
        </label>
        {status === 'error' && (
          <p className="mt-3 text-sm font-semibold text-[var(--color-flag-error-text)]" role="alert">
            Something went wrong joining the waitlist. Please try again.
          </p>
        )}
      </form>
    </>
  )
}
