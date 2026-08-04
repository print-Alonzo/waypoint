'use client'

import { useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { track } from '@/lib/validation/track'
import { rotateSessionIfNewEmail, bindEmail, getSession, hasSession } from '@/lib/validation/session'
import { PERSONA_SIGNUP_LINE } from '@/lib/validation/persona'
import type { Persona } from '@/lib/validation/persona'
import { isEnabled } from '@/lib/features'

// The funnel's email ask, and the last step before the app. Deliberately never
// says "waitlist": the word reads as "get in line and pay later" to the people
// we're recruiting, which is the opposite of what this is. Every free/no-payment
// promise here is scoped to *signing up* — never to the product, which is still
// being priced (see the survey at /feedback).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// The persona is written by the quiz, one page earlier, and can't change while
// this card is on screen — so there's nothing to subscribe to.
const noSubscribe = () => () => {}

// hasSession() rather than getSession(): a direct visitor who never took the
// quiz must not have a sid minted just by scrolling to the signup card.
function readPersona(): Persona | null {
  return hasSession() ? getSession().persona : null
}

const primaryCta =
  'inline-flex items-center justify-center rounded-lg bg-[var(--color-primary)] px-6 py-3 ' +
  'text-base font-bold text-white transition-colors hover:bg-[var(--color-primary-hover)]'

export default function WaitlistForm() {
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error' | 'success'>('idle')
  const [returning, setReturning] = useState(false)
  // Visitors arriving from the quiz get their own words back at the email ask,
  // so the two screens read as one thread. The server snapshot is null on
  // purpose: this card is prerendered, and reading localStorage during the
  // first client render would make it disagree with the server's HTML.
  const persona = useSyncExternalStore(noSubscribe, readPersona, () => null)

  const emailValid = EMAIL_RE.test(email.trim())
  const canSubmit = emailValid && consent && status !== 'submitting'
  // The consent box sits below the button, so someone who types their email and
  // reaches straight for "Sign me up" gets a dead control and no reason for it —
  // and this is the conversion the whole study measures, so a silent block reads
  // in the data as disinterest. Name the blocker only once the email is valid:
  // that's the exact stuck state, and saying it while they're still typing nags.
  const consentBlocking = emailValid && !consent && status !== 'submitting'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setStatus('submitting')

    const trimmed = email.trim()
    // A different email than this device last submitted means a new
    // participant is at the keyboard — rotate the sid before tracking so
    // their answers don't overwrite the previous person's row.
    rotateSessionIfNewEmail(trimmed)

    const { ok, returning: isReturning } = await track('waitlist', { email: trimmed, consent: true })
    if (ok) {
      bindEmail(trimmed)
      setReturning(Boolean(isReturning))
      setStatus('success')
    } else {
      setStatus('error')
    }
  }

  // With the study ended (flag off), track() no-ops — showing the email form
  // would collect addresses that are never recorded. Send everyone straight
  // to the live planner instead.
  if (!isEnabled('validation')) {
    return (
      <>
        <h2 className="text-2xl font-bold tracking-tight sm:text-[1.75rem]">Try Waypoint</h2>
        <p className="mx-auto mt-2 max-w-md text-[var(--color-text-muted)]">
          The core flow works today — feel free to try it.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/plan" className={primaryCta}>
            Try the live planner →
          </Link>
        </div>
      </>
    )
  }

  if (status === 'success' && returning) {
    return (
      <>
        <h2 className="text-2xl font-bold tracking-tight sm:text-[1.75rem]">
          You&apos;re already in
        </h2>
        <p className="mx-auto mt-2 max-w-md text-[var(--color-text-muted)]">
          We already have {email.trim()}{' '}
          on the early-access list — we&apos;ll email you at launch. Want to keep exploring in the
          meantime?
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/plan" className={primaryCta}>
            Try the live planner →
          </Link>
        </div>
      </>
    )
  }

  if (status === 'success') {
    return (
      <>
        <h2 className="text-2xl font-bold tracking-tight sm:text-[1.75rem]">You&apos;re in 🎉</h2>
        <p className="mx-auto mt-2 max-w-md text-[var(--color-text-muted)]">
          We&apos;ll email {email.trim()}{' '}
          the moment Waypoint goes live — you&apos;re one of its earliest users. The planner already
          works today, so go ahead and build your day.
        </p>
        {/* Straight to the planner: the quiz is upstream of this now. No
            `?from=quiz` needed — anyone who got here has a session, which is
            what ResultView's tried_app guard actually keys on. */}
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/plan" className={primaryCta}>
            Try the planner →
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <h2 className="text-2xl font-bold tracking-tight sm:text-[1.75rem]">
        Be one of the earliest users
      </h2>
      <p className="mx-auto mt-2 max-w-md text-[var(--color-text-muted)]">
        {persona ? (
          <>
            {/* The {' '} on this and the two success states above is load-bearing:
                Next's SWC transform drops a plain space between an expression and
                the text after it, rendering "…everything.Leave your email". Vitest's
                esbuild transform keeps it, so no unit test catches this — it only
                shows up in the browser. Don't "clean up" these. */}
            {PERSONA_SIGNUP_LINE[persona]}{' '}
            Leave your email and we&apos;ll write to you the day Waypoint goes live — signing up is
            free, no payment details.
          </>
        ) : (
          <>
            Leave your email and we&apos;ll send you one note the day Waypoint goes live. Signing up
            is free — no payment details, no spam.
          </>
        )}
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
            aria-describedby={consentBlocking ? 'waitlist-consent-hint' : undefined}
            className={
              canSubmit
                ? 'rounded-lg bg-[var(--color-primary)] px-5 py-3 text-base font-bold text-white transition-colors hover:bg-[var(--color-primary-hover)]'
                : 'cursor-not-allowed rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-5 py-3 text-base font-semibold text-[var(--color-text-muted)]'
            }
          >
            {status === 'submitting' ? 'Signing up…' : 'Sign me up'}
          </button>
        </div>
        {/* role="status" so the hint is announced when it appears: `disabled`
            drops the button out of the tab order, so a screen-reader user never
            lands on it to hear its aria-describedby. */}
        {consentBlocking && (
          <p
            id="waitlist-consent-hint"
            role="status"
            className="mt-3 text-sm font-semibold text-[var(--color-text)]"
          >
            Almost there — tick the box below to continue.
          </p>
        )}
        <label className="mx-auto mt-3 flex max-w-xs items-start gap-2 text-left text-sm text-[var(--color-text-muted)] sm:max-w-none sm:justify-center">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
          />
          <span>
            We&apos;ll only email you when Waypoint goes live — no spam, and signing up never asks
            for payment details.
          </span>
        </label>
        {status === 'error' && (
          <p className="mt-3 text-sm font-semibold text-[var(--color-flag-error-text)]" role="alert">
            Something went wrong saving your email. Please try again.
          </p>
        )}
      </form>
    </>
  )
}
