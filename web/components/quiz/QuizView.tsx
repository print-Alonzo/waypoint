'use client'

import { useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import {
  PERSONA_QUESTIONS,
  PERSONA_LABEL,
  PERSONA_BLURB,
  PERSONA_PITCH,
  scorePersona,
} from '@/lib/validation/persona'
import type { Persona } from '@/lib/validation/persona'
import { getSession, hasSession, patchSession } from '@/lib/validation/session'
import { track } from '@/lib/validation/track'
import { usePrefersReducedMotion } from '@/lib/hooks/use-reduced-motion'

// One-question-at-a-time quiz: adapted from PoiSwipeDeck's cursor-through-a-deck
// shape (index state, one card visible at a time, a progress readout) but without
// swipe gesture handling — a quiz answer is a deliberate tap, not a discard.
//
// This is the funnel's front door: the /[channel] short links render it directly,
// so most visitors meet Waypoint here with no prior context. Hence the intro
// framing above question 1, and the pitch on the result screen — the result is
// what has to earn the trip to the landing page.

const TOTAL = PERSONA_QUESTIONS.length

// Nothing to subscribe to: the only writer is this component's own choose(),
// which sets React state in the same breath.
const noSubscribe = () => () => {}

// A persona from an earlier visit on this device. hasSession() rather than
// getSession() so simply opening the quiz doesn't mint a sid — ChannelCapture
// owns that. quizCompletedAt guards against a half-written session.
function readCompletedPersona(): Persona | null {
  if (!hasSession()) return null
  const session = getSession()
  return session.quizCompletedAt ? session.persona : null
}

export default function QuizView() {
  const router = useRouter()
  const reduceMotion = usePrefersReducedMotion()
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [scored, setScored] = useState<Persona | null>(null)
  const [retaking, setRetaking] = useState(false)

  const question = PERSONA_QUESTIONS[index]

  // Someone re-opening their channel link (a saved Reddit post, a QR code)
  // already has a persona — replaying five questions to reach the same screen
  // is a chore, so show their result straight away. The server snapshot is
  // null because this page is prerendered: reading localStorage during the
  // first client render would disagree with the server's HTML.
  const storedPersona = useSyncExternalStore(noSubscribe, readCompletedPersona, () => null)

  // A just-scored persona wins (it's newer than the stored one, and it's what
  // a completed retake produces); `retaking` is what hides the stored result
  // in between, since the session still holds the old answer until then.
  const persona = scored ?? (retaking ? null : storedPersona)

  function retake() {
    setRetaking(true)
    setScored(null)
    setAnswers([])
    setIndex(0)
  }

  function choose(optionIndex: number) {
    const next = [...answers]
    next[index] = optionIndex
    setAnswers(next)

    if (index + 1 < TOTAL) {
      setIndex(index + 1)
      return
    }

    const { persona: result, scores } = scorePersona(next)
    const quizAnswers = PERSONA_QUESTIONS.map((q, i) => q.options[next[i]]?.label ?? '')
    patchSession({ persona: result, personaScores: scores, quizAnswers })
    void track('quiz_completed', { persona: result, personaScores: scores, quizAnswers })
    setScored(result)
  }

  function back() {
    if (index === 0) return
    setIndex(index - 1)
  }

  if (persona) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-[var(--color-primary)]">
          You&apos;re a
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{PERSONA_LABEL[persona]}</h1>
        <p className="mx-auto mt-4 max-w-md text-[var(--color-text-muted)]">
          {PERSONA_BLURB[persona]}
        </p>
        <p className="mx-auto mt-4 max-w-lg text-[var(--color-text-muted)]">
          {PERSONA_PITCH[persona]}
        </p>
        {/* To '/' rather than '/#early-access': the landing's hero and
            how-it-works are what make the case, and dropping someone straight
            onto an email field reads as a grab. The signup card greets them
            with their persona when they get there. */}
        <button
          type="button"
          onClick={() => router.push('/')}
          className="mt-8 inline-flex items-center justify-center rounded-lg bg-[var(--color-primary)] px-6 py-3.5 text-base font-bold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
        >
          Show me Waypoint →
        </button>
        <div>
          <button
            type="button"
            onClick={retake}
            className="mt-5 text-sm font-semibold text-[var(--color-text-muted)] underline-offset-2 hover:underline"
          >
            Retake the quiz
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      {/* Most visitors land here cold from a channel link, with no idea what
          Waypoint is or why they're being asked anything. */}
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-[var(--color-primary)]">
          Metro Manila day planner
        </p>
        <p className="mt-2 text-[var(--color-text-muted)]">
          Answer 5 quick questions to see your travel style — and how Waypoint fits it. Takes about
          a minute.
        </p>
      </div>

      <div className="mb-6">
        <p className="text-sm font-semibold text-[var(--color-text-muted)]">
          Question {index + 1} of {TOTAL}
        </p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
          <div
            className={`h-full rounded-full bg-[var(--color-primary)] ${
              reduceMotion ? '' : 'transition-all duration-300'
            }`}
            style={{ width: `${((index + 1) / TOTAL) * 100}%` }}
          />
        </div>
      </div>

      <h1 className="text-2xl font-bold tracking-tight">{question.prompt}</h1>

      <div className="mt-6 flex flex-col gap-3" role="group" aria-label={question.prompt}>
        {question.options.map((option, i) => (
          <button
            key={option.label}
            type="button"
            onClick={() => choose(i)}
            className="rounded-xl border border-[var(--color-border)] bg-white px-5 py-4 text-left text-base font-semibold shadow-sm transition hover:border-[var(--color-primary)] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            {option.label}
          </button>
        ))}
      </div>

      {index > 0 && (
        <button
          type="button"
          onClick={back}
          className="mt-6 text-sm font-semibold text-[var(--color-text-muted)] underline-offset-2 hover:underline"
        >
          ← Back
        </button>
      )}
    </div>
  )
}
