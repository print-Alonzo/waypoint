import { describe, it, expect } from 'vitest'
import { validateSubmission } from '@/lib/validation/validate'

const VALID_SUBMITTED = {
  sid: 'abc-123',
  milestone: 'submitted',
  currentPlanning: 'maps-winging',
  pastSpending: '500-2000',
  timeLost: '1-2h',
  interest: 'definitely',
  willingToPay: 'yes',
  vanWestendorp: { tooCheap: 50, goodValue: 150, gettingExpensive: 300, tooExpensive: 500 },
  pricingModel: 'monthly',
  priceUnit: 'per-month',
  budgetSource: 'personal',
  email: 'traveler@example.com',
  consent: true,
}

describe('validateSubmission', () => {
  it('rejects a missing sid', () => {
    const { errors, sid, doc } = validateSubmission({ milestone: 'tried_app' })
    expect(errors.sid).toBeTruthy()
    expect(sid).toBeNull()
    expect(doc).toBeNull()
  })

  it('rejects an unknown milestone', () => {
    const { errors } = validateSubmission({ sid: 'abc', milestone: 'bogus' })
    expect(errors.milestone).toBeTruthy()
  })

  it('accepts a lightweight milestone with no extra fields', () => {
    const { errors, sid, doc } = validateSubmission({ sid: 'abc-123', milestone: 'tried_app' })
    expect(errors).toEqual({})
    expect(sid).toBe('abc-123')
    expect(doc).toEqual({ milestone: 'tried_app' })
  })

  it('accepts a valid quiz_completed submission with persona fields', () => {
    const { errors, doc } = validateSubmission({
      sid: 'abc-123',
      milestone: 'quiz_completed',
      persona: 'time-poor',
      personaScores: { timePoor: 8, meticulous: 2 },
      quizAnswers: ['Wing it', 'Hit the highlights'],
    })
    expect(errors).toEqual({})
    expect(doc?.persona).toBe('time-poor')
    expect(doc?.personaScores).toEqual({ timePoor: 8, meticulous: 2 })
    expect(doc?.quizAnswers).toEqual(['Wing it', 'Hit the highlights'])
  })

  it('accepts a fully valid submitted payload', () => {
    const { errors, sid, doc } = validateSubmission(VALID_SUBMITTED)
    expect(errors).toEqual({})
    expect(sid).toBe('abc-123')
    expect(doc?.email).toBe('traveler@example.com')
    expect(doc?.vanWestendorp).toEqual({
      tooCheap: 50,
      goodValue: 150,
      gettingExpensive: 300,
      tooExpensive: 500,
    })
  })

  it('rejects a malformed email', () => {
    const { errors } = validateSubmission({ ...VALID_SUBMITTED, email: 'not-an-email' })
    expect(errors.email).toBeTruthy()
  })

  it('rejects a negative price', () => {
    const { errors } = validateSubmission({
      ...VALID_SUBMITTED,
      vanWestendorp: { ...VALID_SUBMITTED.vanWestendorp, tooCheap: -10 },
    })
    expect(errors.vanWestendorp).toBeTruthy()
  })

  it('rejects an unknown pricing model', () => {
    const { errors } = validateSubmission({ ...VALID_SUBMITTED, pricingModel: 'lifetime' })
    expect(errors.pricingModel).toBeTruthy()
  })

  it('requires consent for a submitted payload', () => {
    const { errors } = validateSubmission({ ...VALID_SUBMITTED, consent: false })
    expect(errors.consent).toBeTruthy()
  })

  it('strips unknown keys from the built doc', () => {
    const { doc } = validateSubmission({ ...VALID_SUBMITTED, evil: '$where: 1' })
    expect(doc).not.toHaveProperty('evil')
  })

  it('rejects a missing currentPlanning', () => {
    const { errors } = validateSubmission({ ...VALID_SUBMITTED, currentPlanning: undefined })
    expect(errors.currentPlanning).toBeTruthy()
  })

  it('rejects an unknown pastSpending', () => {
    const { errors } = validateSubmission({ ...VALID_SUBMITTED, pastSpending: 'a-lot' })
    expect(errors.pastSpending).toBeTruthy()
  })

  it('rejects an unknown timeLost', () => {
    const { errors } = validateSubmission({ ...VALID_SUBMITTED, timeLost: 'forever' })
    expect(errors.timeLost).toBeTruthy()
  })

  it('rejects a missing budgetSource', () => {
    const { errors } = validateSubmission({ ...VALID_SUBMITTED, budgetSource: undefined })
    expect(errors.budgetSource).toBeTruthy()
  })

  it('rejects a priceUnit that does not match the pricing model', () => {
    const { errors } = validateSubmission({ ...VALID_SUBMITTED, priceUnit: 'per-trip' })
    expect(errors.priceUnit).toBeTruthy()
  })

  it('rejects an unknown priceUnit', () => {
    const { errors } = validateSubmission({ ...VALID_SUBMITTED, priceUnit: 'weekly' })
    expect(errors.priceUnit).toBeTruthy()
  })

  it('rejects a missing priceUnit', () => {
    const { errors } = validateSubmission({ ...VALID_SUBMITTED, priceUnit: undefined })
    expect(errors.priceUnit).toBeTruthy()
  })

  it('allows worthPaying to be omitted', () => {
    const { errors, doc } = validateSubmission({ ...VALID_SUBMITTED, worthPaying: undefined })
    expect(errors).toEqual({})
    expect(doc?.worthPaying).toBeUndefined()
  })

  it('truncates a too-long worthPaying to 500 characters', () => {
    const { errors, doc } = validateSubmission({ ...VALID_SUBMITTED, worthPaying: 'a'.repeat(600) })
    expect(errors).toEqual({})
    expect(doc?.worthPaying).toHaveLength(500)
  })

  it('rejects a non-string worthPaying', () => {
    const { errors } = validateSubmission({ ...VALID_SUBMITTED, worthPaying: 42 })
    expect(errors.worthPaying).toBeTruthy()
  })

  describe('landed milestone', () => {
    it('accepts a lightweight landed submission with no extra fields', () => {
      const { errors, doc } = validateSubmission({ sid: 'abc-123', milestone: 'landed' })
      expect(errors).toEqual({})
      expect(doc).toEqual({ milestone: 'landed' })
    })
  })

  describe('channel attribution', () => {
    it('accepts an allowlisted channel', () => {
      const { errors, doc } = validateSubmission({
        sid: 'abc-123',
        milestone: 'landed',
        channel: 'reddit',
      })
      expect(errors).toEqual({})
      expect(doc?.channel).toBe('reddit')
    })

    // Attribution metadata must never 422 a real signup — a spoofed or
    // stale channel value is silently dropped, not rejected.
    it('silently drops an unknown channel rather than erroring', () => {
      const { errors, doc } = validateSubmission({
        sid: 'abc-123',
        milestone: 'waitlist',
        email: 'traveler@example.com',
        consent: true,
        channel: 'bogus',
      })
      expect(errors).toEqual({})
      expect(doc).not.toHaveProperty('channel')
    })

    it('omits channel from the doc when not sent at all', () => {
      const { doc } = validateSubmission({ sid: 'abc-123', milestone: 'tried_app' })
      expect(doc).not.toHaveProperty('channel')
    })
  })

  describe('waitlist milestone', () => {
    const VALID_WAITLIST = {
      sid: 'abc-123',
      milestone: 'waitlist',
      email: 'traveler@example.com',
      consent: true,
    }

    it('accepts a valid email and consent', () => {
      const { errors, sid, doc } = validateSubmission(VALID_WAITLIST)
      expect(errors).toEqual({})
      expect(sid).toBe('abc-123')
      expect(doc).toEqual({ milestone: 'waitlist', email: 'traveler@example.com', consent: true })
    })

    it('rejects a malformed email', () => {
      const { errors } = validateSubmission({ ...VALID_WAITLIST, email: 'not-an-email' })
      expect(errors.email).toBeTruthy()
    })

    it('rejects a missing email', () => {
      const { errors } = validateSubmission({ ...VALID_WAITLIST, email: undefined })
      expect(errors.email).toBeTruthy()
    })

    it('requires consent', () => {
      const { errors } = validateSubmission({ ...VALID_WAITLIST, consent: false })
      expect(errors.consent).toBeTruthy()
    })
  })
})
