'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PERSONA_QUESTIONS, PERSONA_LABEL, scorePersona } from '@/lib/validation/persona'
import type { Persona } from '@/lib/validation/persona'
import { patchSession } from '@/lib/validation/session'
import { track } from '@/lib/validation/track'
import { usePrefersReducedMotion } from '@/lib/hooks/use-reduced-motion'

// One-question-at-a-time quiz: adapted from PoiSwipeDeck's cursor-through-a-deck
// shape (index state, one card visible at a time, a progress readout) but without
// swipe gesture handling — a quiz answer is a deliberate tap, not a discard.

const PERSONA_BLURB: Record<Persona, string> = {
  'time-poor':
    "You want a day that's already sorted — pick your places, and let the order take care of itself.",
  meticulous:
    'You like knowing exactly why each stop is where it is — Waypoint shows its work so you can fine-tune anything.',
  explorer:
    "You're open to however the day unfolds — a solid starting order you're free to make your own.",
}

const TOTAL = PERSONA_QUESTIONS.length

export default function QuizView() {
  const router = useRouter()
  const reduceMotion = usePrefersReducedMotion()
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [persona, setPersona] = useState<Persona | null>(null)

  const question = PERSONA_QUESTIONS[index]

  function choose(optionIndex: number) {
    const next = [...answers]
    next[index] = optionIndex
    setAnswers(next)

    if (index + 1 < TOTAL) {
      setIndex(index + 1)
      return
    }

    const { persona: scored, scores } = scorePersona(next)
    const quizAnswers = PERSONA_QUESTIONS.map((q, i) => q.options[next[i]]?.label ?? '')
    patchSession({ persona: scored, personaScores: scores, quizAnswers })
    void track('quiz_completed', { persona: scored, personaScores: scores, quizAnswers })
    setPersona(scored)
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
        <button
          type="button"
          onClick={() => router.push('/plan?from=quiz')}
          className="mt-8 inline-flex items-center justify-center rounded-lg bg-[var(--color-primary)] px-6 py-3.5 text-base font-bold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
        >
          Try Waypoint →
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
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
