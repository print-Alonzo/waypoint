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

  // When localStorage is unreachable entirely (Safari private mode, site data
  // disabled), getSession() used to mint a brand-new sid on every call. One
  // page load then POSTed under several sids, and the channel stamped by
  // ChannelCapture never reached track() — filing that visit under (direct)
  // and making every real channel look worse than it is.
  describe('when localStorage is completely unreachable', () => {
    function breakStorage() {
      const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('storage disabled')
      })
      const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('storage disabled')
      })
      return () => {
        get.mockRestore()
        set.mockRestore()
      }
    }

    it('keeps one stable sid across repeated getSession() calls', () => {
      const restore = breakStorage()
      try {
        expect(getSession().sid).toBe(getSession().sid)
      } finally {
        restore()
      }
    })

    it('keeps a patched channel readable by the next getSession()', () => {
      const restore = breakStorage()
      try {
        const original = getSession()
        patchSession({ channel: 'reddit' })

        const next = getSession()
        expect(next.sid).toBe(original.sid)
        expect(next.channel).toBe('reddit')
      } finally {
        restore()
      }
    })

    it('does not leak the in-memory session once storage works again', () => {
      const restore = breakStorage()
      getSession()
      restore()

      expect(hasSession()).toBe(false)
    })
  })

  it('starts with a null boundEmail', () => {
    expect(getSession().boundEmail).toBeNull()
  })

  it('starts with a null channel and landedAt', () => {
    const session = getSession()
    expect(session.channel).toBeNull()
    expect(session.landedAt).toBeNull()
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

    it('does not rotate when the email matches case-insensitively', () => {
      const original = getSession()
      bindEmail('Same@Example.com')

      rotateSessionIfNewEmail('same@example.com')

      expect(getSession().sid).toBe(original.sid)
    })

    it('clears saved plans too, same as resetParticipant', () => {
      savePlan('My trip', 'a=1', Date.now())
      bindEmail('first@example.com')
      expect(listSavedPlans()).toHaveLength(1)

      rotateSessionIfNewEmail('second@example.com')

      expect(listSavedPlans()).toHaveLength(0)
    })

    // A second person typing a different email on a shared device would
    // otherwise wipe attribution right before the waitlist POST fires — a
    // real /reddit signup would silently land in the (direct) bucket.
    it('carries the channel forward across a rotation', () => {
      patchSession({ channel: 'reddit' })
      bindEmail('first@example.com')

      rotateSessionIfNewEmail('second@example.com')

      expect(getSession().channel).toBe('reddit')
    })

    it('does not carry landedAt forward across a rotation', () => {
      patchSession({ channel: 'reddit', landedAt: Date.now() })
      bindEmail('first@example.com')

      rotateSessionIfNewEmail('second@example.com')

      expect(getSession().landedAt).toBeNull()
    })

    it('leaves channel null across a rotation when none was set', () => {
      bindEmail('first@example.com')

      rotateSessionIfNewEmail('second@example.com')

      expect(getSession().channel).toBeNull()
    })
  })
})
