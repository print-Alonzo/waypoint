import type { Persona, PersonaScores } from '@/lib/validation/persona'
import type { Milestone } from '@/lib/validation/track'

// Isomorphic validation for a /api/validation submission — hand-rolled, mirroring
// lib/poi/validate.ts (no validation dependency in this project). Shared shape so
// the route handler and its tests agree on exactly what's accepted; unknown keys
// are stripped rather than passed through to the database.

export type Interest = 'definitely' | 'maybe' | 'no'
export type WillingToPay = 'yes' | 'maybe' | 'no'
export type PricingModel = 'one-time' | 'monthly' | 'per-trip' | 'freemium' | 'free-ads'

export type VanWestendorp = {
  tooCheap: number
  goodValue: number
  gettingExpensive: number
  tooExpensive: number
}

export type ValidationDoc = {
  milestone: Milestone
  persona?: Persona
  personaScores?: PersonaScores
  quizAnswers?: string[]
  interest?: Interest
  willingToPay?: WillingToPay
  vanWestendorp?: VanWestendorp
  pricingModel?: PricingModel
  email?: string
  consent?: boolean
}

export type ValidationErrors = Record<string, string>

const MILESTONES: ReadonlySet<Milestone> = new Set([
  'quiz_completed',
  'tried_app',
  'feedback_opened',
  'submitted',
])
const PERSONAS: ReadonlySet<Persona> = new Set(['time-poor', 'meticulous', 'explorer'])
const INTERESTS: ReadonlySet<Interest> = new Set(['definitely', 'maybe', 'no'])
const WTP: ReadonlySet<WillingToPay> = new Set(['yes', 'maybe', 'no'])
const PRICING_MODELS: ReadonlySet<PricingModel> = new Set([
  'one-time',
  'monthly',
  'per-trip',
  'freemium',
  'free-ads',
])

const SID_RE = /^[a-zA-Z0-9-]{1,100}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_ANSWERS = 20
const MAX_ANSWER_LEN = 200
const MAX_EMAIL_LEN = 254

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function asFiniteNumber(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export function validateSubmission(
  raw: unknown,
): { errors: ValidationErrors; sid: string | null; doc: ValidationDoc | null } {
  const errors: ValidationErrors = {}
  const body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}

  const sid = asString(body.sid)
  if (!sid || !SID_RE.test(sid)) errors.sid = 'A valid session id is required.'

  const milestone = asString(body.milestone) as Milestone
  if (!milestone || !MILESTONES.has(milestone)) errors.milestone = 'Unknown milestone.'

  if (Object.keys(errors).length > 0) return { errors, sid: null, doc: null }

  const doc: ValidationDoc = { milestone }

  if (body.persona !== undefined) {
    const persona = asString(body.persona) as Persona
    if (!PERSONAS.has(persona)) errors.persona = 'Unknown persona.'
    else doc.persona = persona
  }

  if (body.personaScores !== undefined) {
    const scores = body.personaScores as Record<string, unknown>
    const timePoor = asFiniteNumber(scores?.timePoor)
    const meticulous = asFiniteNumber(scores?.meticulous)
    if (timePoor === null || meticulous === null) {
      errors.personaScores = 'Persona scores must be numbers.'
    } else {
      doc.personaScores = { timePoor, meticulous }
    }
  }

  if (body.quizAnswers !== undefined) {
    const answers = Array.isArray(body.quizAnswers) ? body.quizAnswers : null
    if (!answers || answers.length > MAX_ANSWERS || answers.some((a) => typeof a !== 'string')) {
      errors.quizAnswers = 'Quiz answers must be a list of strings.'
    } else {
      doc.quizAnswers = answers.map((a) => (a as string).slice(0, MAX_ANSWER_LEN))
    }
  }

  if (milestone === 'submitted') {
    const interest = asString(body.interest) as Interest
    if (!INTERESTS.has(interest)) errors.interest = 'Pick whether you would use Waypoint.'
    else doc.interest = interest

    const willingToPay = asString(body.willingToPay) as WillingToPay
    if (!WTP.has(willingToPay)) errors.willingToPay = 'Pick whether you would pay.'
    else doc.willingToPay = willingToPay

    const vw = body.vanWestendorp as Record<string, unknown> | undefined
    const tooCheap = asFiniteNumber(vw?.tooCheap)
    const goodValue = asFiniteNumber(vw?.goodValue)
    const gettingExpensive = asFiniteNumber(vw?.gettingExpensive)
    const tooExpensive = asFiniteNumber(vw?.tooExpensive)
    if (
      tooCheap === null ||
      goodValue === null ||
      gettingExpensive === null ||
      tooExpensive === null ||
      tooCheap < 0 ||
      goodValue < 0 ||
      gettingExpensive < 0 ||
      tooExpensive < 0
    ) {
      errors.vanWestendorp = 'All four prices must be non-negative numbers.'
    } else {
      doc.vanWestendorp = { tooCheap, goodValue, gettingExpensive, tooExpensive }
    }

    const pricingModel = asString(body.pricingModel) as PricingModel
    if (!PRICING_MODELS.has(pricingModel)) errors.pricingModel = 'Pick a pricing model.'
    else doc.pricingModel = pricingModel

    const email = asString(body.email)
    if (!email || email.length > MAX_EMAIL_LEN || !EMAIL_RE.test(email)) {
      errors.email = 'Enter a valid email address.'
    } else {
      doc.email = email
    }

    if (body.consent !== true) errors.consent = 'Consent is required to join the waitlist.'
    else doc.consent = true
  }

  if (Object.keys(errors).length > 0) return { errors, sid: null, doc: null }
  return { errors, sid, doc }
}
