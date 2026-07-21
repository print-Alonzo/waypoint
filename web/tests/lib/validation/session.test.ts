// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getSession, patchSession, hasSession } from '@/lib/validation/session'

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
})
