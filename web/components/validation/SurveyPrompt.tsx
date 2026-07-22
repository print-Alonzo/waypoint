'use client'

import { useEffect, useRef } from 'react'

type SurveyPromptProps = {
  onAnswer: () => void
  onDismiss: () => void
}

// Honest, dismissible-but-persistent nudge toward the /feedback survey. Shown
// after a validation-funnel visitor has dwelt on a generated itinerary (see the
// trigger in ResultView). No fake urgency — it just names what the survey is for
// and lets the visitor say "not now."
export default function SurveyPrompt({ onAnswer, onDismiss }: SurveyPromptProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const answerButtonRef = useRef<HTMLButtonElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null
    answerButtonRef.current?.focus()
    return () => {
      previouslyFocused.current?.focus()
    }
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onDismiss()
        return
      }
      if (e.key !== 'Tab') return
      const dialog = dialogRef.current
      if (!dialog) return
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onDismiss])

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onDismiss}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="survey-prompt-title"
        aria-describedby="survey-prompt-body"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5 shadow-lg"
      >
        <h2 id="survey-prompt-title" className="text-base font-semibold text-[var(--color-text)]">
          Enjoying your plan?
        </h2>
        <p id="survey-prompt-body" className="mt-2 text-sm text-[var(--color-text-muted)]">
          You&apos;re trying an early version of Waypoint — a ~2-minute survey is how we decide
          what to build next. Mind sharing your thoughts?
        </p>
        <div className="mt-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onDismiss}
            className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            Maybe later
          </button>
          <button
            ref={answerButtonRef}
            type="button"
            onClick={onAnswer}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--color-primary-hover)]"
          >
            Answer the survey
          </button>
        </div>
      </div>
    </div>
  )
}
