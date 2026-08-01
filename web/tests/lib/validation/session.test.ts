// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getSession,
  patchSession,
  hasSession,
  resetSession,
  bindEmail,
  resetParticipant,
  rotateSessionIfNewEmail,
} from '@/lib/validation/session'
import { savePlan, listSavedPlans } from '@/lib/storage/saved-plans'

beforeEach(() => {
  localStorage.clear()
})

describe('validation session', () => {
  it('has no session until getSession() is first called', () => {
    expect(hasSession()).toBe(false)
    getSession()
    expect(hasSession()).toBe(true)
  })

  it('mints a sid on first call and reuses it on subsequent calls', () => {
    const first = getSession()
    expect(first.sid).toBeTruthy()
    const second = getSession()
    expect(second.sid).toBe(first.sid)
  })

  it('starts with null milestones', () => {
    const session = getSession()
    expect(session.quizCompletedAt).toBeNull()
    expect(session.triedAppAt).toBeNull()
    expect(session.feedbackOpenedAt).toBeNull()
    expect(session.submittedAt).toBeNull()
  })

  it('patchSession merges fields and persists the sid', () => {
    const original = getSession()
    const patched = patchSession({ persona: 'time-poor', quizCompletedAt: 1234 })
    expect(patched.sid).toBe(original.sid)
    expect(patched.persona).toBe('time-poor')
    expect(patched.quizCompletedAt).toBe(1234)

    const reread = getSession()
    expect(reread.persona).toBe('time-poor')
    expect(reread.quizCompletedAt).toBe(1234)
  })

  it('degrades to a fresh in-memory session without throwing when storage throws', () => {
    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota exceeded')
      })
    expect(() => getSession()).not.toThrow()
    expect(() => patchSession({ persona: 'meticulous' })).not.toThrow()
    spy.mockRestore()
  })

  it('starts with a null boundEmail', () => {
    expect(getSession().boundEmail).toBeNull()
  })

  it('bindEmail records the email without changing the sid', () => {
    const original = getSession()
    const bound = bindEmail('traveler@example.com')
    expect(bound.sid).toBe(original.sid)
    expect(bound.boundEmail).toBe('traveler@example.com')
  })

  describe('resetSession', () => {
    it('mints a different sid and does not carry over prior state', () => {
      const original = patchSession({ persona: 'time-poor', quizCompletedAt: 1234 })
      bindEmail('a@example.com')

      const next = resetSession()

      expect(next.sid).not.toBe(original.sid)
      expect(next.persona).toBeNull()
      expect(next.quizCompletedAt).toBeNull()
      expect(next.boundEmail).toBeNull()
    })

    it('persists the new session so a later getSession() reuses it', () => {
      const next = resetSession()
      expect(getSession().sid).toBe(next.sid)
    })
  })

  describe('resetParticipant', () => {
    it('resets the validation session and clears saved plans', () => {
      const original = getSession()
      savePlan('My trip', 'a=1', Date.now())
      expect(listSavedPlans()).toHaveLength(1)

      resetParticipant()

      expect(getSession().sid).not.toBe(original.sid)
      expect(listSavedPlans()).toHaveLength(0)
    })
  })

  describe('rotateSessionIfNewEmail', () => {
    it('rotates the sid when a bound email differs from the new one', () => {
      const original = getSession()
      bindEmail('first@example.com')

      rotateSessionIfNewEmail('second@example.com')

      expect(getSession().sid).not.toBe(original.sid)
    })

    it('does not rotate when the email matches the bound one', () => {
      const original = getSession()
      bindEmail('same@example.com')

      rotateSessionIfNewEmail('same@example.com')

      expect(getSession().sid).toBe(original.sid)
    })

    it('does not rotate when no email is bound yet', () => {
      const original = getSession()

      rotateSessionIfNewEmail('first-ever@example.com')

      expect(getSession().sid).toBe(original.sid)
    })
  })
})
