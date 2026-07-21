import type { Persona, PersonaScores } from '@/lib/validation/persona'

// Local (this-device) session for the willingness-to-pay validation funnel. No
// backend read here — this just threads one sid through quiz → app trial → survey
// so /api/validation can upsert a single document per visitor. All access is
// guarded: storage can throw (Safari private mode, quota) and must never crash
// the page — a lost session just means duplicate milestone writes, not a crash.

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
