'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { isEnabled } from '@/lib/features'
import { hasSession, getSession, patchSession } from '@/lib/validation/session'
import SurveyPrompt from '@/components/validation/SurveyPrompt'

// How long a funnel visitor must actively dwell — foreground tab, summed across
// every non-excluded page they visit, not reset by navigating between them —
// before the survey modal offers itself. Re-shown on later visits up to
// SURVEY_PROMPT_MAX_SHOWS, suppressed for good once they've submitted the
// survey (see lib/validation/session.ts).
const SURVEY_PROMPT_DWELL_MS = 120_000
const SURVEY_PROMPT_MAX_SHOWS = 3
const SURVEY_PROMPT_TICK_MS = 1_000

// Pages where the prompt would be redundant or intrusive: the marketing landing
// page (no itinerary yet to react to), the quiz, the survey itself, and the
// post-submit thank-you page. Dwell time doesn't accumulate on these — it just
// pauses and resumes once the visitor is back on an eligible page.
const EXCLUDED_PATHS = new Set(['/', '/quiz', '/feedback', '/thanks'])

// Mounted once in the root layout (which persists across client-side
// navigation in the App Router), so this tracks dwell across the whole app
// rather than restarting on every page — unlike a per-page effect would.
export default function SurveyPromptController() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const dwelledMs = useRef(0)

  useEffect(() => {
    if (!isEnabled('validation') || open) return
    const interval = setInterval(() => {
      if (EXCLUDED_PATHS.has(pathname)) return
      if (document.hidden) return
      if (!hasSession()) return
      dwelledMs.current += SURVEY_PROMPT_TICK_MS
      if (dwelledMs.current < SURVEY_PROMPT_DWELL_MS) return

      const session = getSession()
      if (session.submittedAt) return
      if ((session.surveyPromptCount ?? 0) >= SURVEY_PROMPT_MAX_SHOWS) return
      dwelledMs.current = 0
      patchSession({
        surveyPromptCount: (session.surveyPromptCount ?? 0) + 1,
        surveyPromptLastAt: Date.now(),
      })
      setOpen(true)
    }, SURVEY_PROMPT_TICK_MS)
    return () => clearInterval(interval)
  }, [pathname, open])

  if (!open) return null

  return (
    <SurveyPrompt
      onAnswer={() => {
        setOpen(false)
        router.push('/feedback')
      }}
      onDismiss={() => setOpen(false)}
    />
  )
}
