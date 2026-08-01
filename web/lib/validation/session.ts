import type { Persona, PersonaScores } from '@/lib/validation/persona'
import { clearAll as clearSavedPlans } from '@/lib/storage/saved-plans'

// Local (this-device) session for the willingness-to-pay validation funnel. No
// backend read here — this just threads one sid through quiz → app trial → survey
// so /api/validation can upsert a single document per visitor. All access is
// guarded: storage can throw (Safari private mode, quota) and must never crash
// the page — a lost session just means duplicate milestone writes, not a crash.
//
// A sid is permanent once minted (getSession() never replaces it) — see
// resetSession() for the explicit, intentional exception: handing the browser
// to a new participant.

export type ValidationSession = {
  sid: string
  persona: Persona | null
  personaScores: PersonaScores | null
  quizAnswers: string[] | null
  startedAt: number
  quizCompletedAt: number | null
  triedAppAt: number | null
  feedbackOpenedAt: number | null
  submittedAt: number | null
  waitlistAt: number | null
  surveyPromptCount: number
  surveyPromptLastAt: number | null
  // Email this sid last submitted (waitlist or feedback). Lets a call site
  // detect "a different person is now typing" and rotate the sid instead of
  // overwriting the first person's row.
  boundEmail: string | null
}

const KEY = 'waypoint:validation'

function freshSession(now: number): ValidationSession {
  return {
    sid: crypto.randomUUID(),
    persona: null,
    personaScores: null,
    quizAnswers: null,
    startedAt: now,
    quizCompletedAt: null,
    triedAppAt: null,
    feedbackOpenedAt: null,
    submittedAt: null,
    waitlistAt: null,
    surveyPromptCount: 0,
    surveyPromptLastAt: null,
    boundEmail: null,
  }
}

function read(): ValidationSession | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed.sid === 'string' ? (parsed as ValidationSession) : null
  } catch {
    return null
  }
}

function write(session: ValidationSession): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(session))
  } catch {
    // Ignore: storage unavailable/full — the funnel degrades, the page survives.
  }
}

// Non-creating check: true only if a session already exists on this device (e.g.
// the visitor completed the quiz earlier). Unlike getSession(), never mints one.
export function hasSession(): boolean {
  return read() !== null
}

// Returns the current session, minting one (with a fresh sid) on first call.
export function getSession(): ValidationSession {
  const existing = read()
  if (existing) return existing
  const session = freshSession(Date.now())
  write(session)
  return session
}

export function patchSession(partial: Partial<ValidationSession>): ValidationSession {
  const next = { ...getSession(), ...partial }
  write(next)
  return next
}

// Records which email this sid last submitted, so a later submission can tell
// whether it's the same person (keep the sid) or someone new (rotate it).
export function bindEmail(email: string): ValidationSession {
  return patchSession({ boundEmail: email })
}

// Mints and stores a brand-new session — deliberately does NOT merge the old
// one, unlike getSession()/patchSession(). Use when a new participant is known
// to be starting (a different email was just entered, or ?new=1 was used).
export function resetSession(): ValidationSession {
  const session = freshSession(Date.now())
  write(session)
  return session
}

// Full handoff to a new participant: fresh validation session plus clearing
// this device's saved plans, so the next person doesn't inherit the previous
// participant's itineraries.
export function resetParticipant(): void {
  resetSession()
  clearSavedPlans()
}
