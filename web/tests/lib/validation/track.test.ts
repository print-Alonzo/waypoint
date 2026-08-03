// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { track } from '@/lib/validation/track'
import { getSession, patchSession } from '@/lib/validation/session'

const flag = vi.hoisted(() => ({ validation: true }))
vi.mock('@/lib/features', () => ({
  isEnabled: (f: string) => flag[f as keyof typeof flag],
}))

beforeEach(() => {
  localStorage.clear()
  flag.validation = true
})

describe('track', () => {
  it('does not fetch and returns { ok: false } when the validation flag is off', async () => {
    flag.validation = false
    vi.stubGlobal('fetch', vi.fn())

    const result = await track('tried_app')

    expect(result).toEqual({ ok: false })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('stamps the session milestone only after a successful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, returning: false }) }),
    )

    expect(getSession().triedAppAt).toBeNull()
    const result = await track('tried_app')

    expect(result.ok).toBe(true)
    expect(getSession().triedAppAt).not.toBeNull()
  })

  it('leaves the milestone unstamped when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ ok: false }) }))

    const result = await track('tried_app')

    expect(result).toEqual({ ok: false })
    expect(getSession().triedAppAt).toBeNull()
  })

  it('leaves the milestone unstamped when fetch rejects (network failure)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    const result = await track('tried_app')

    expect(result).toEqual({ ok: false })
    expect(getSession().triedAppAt).toBeNull()
  })

  it('passes returning through from the response body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, returning: true }) }),
    )

    const result = await track('waitlist', { email: 'a@example.com', consent: true })

    expect(result).toEqual({ ok: true, returning: true })
  })

  it('degrades to ok:true with returning:undefined when the response body is malformed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error('not json')
      },
    }))

    const result = await track('tried_app')

    expect(result.ok).toBe(true)
    expect(result.returning).toBeUndefined()
  })

  it('sends the session sid and milestone in the POST body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, returning: false }) }),
    )

    await track('quiz_completed', { persona: 'time-poor' })

    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('/api/validation')
    const body = JSON.parse(init.body)
    expect(body.sid).toBe(getSession().sid)
    expect(body.milestone).toBe('quiz_completed')
    expect(body.persona).toBe('time-poor')
  })

  it('includes the session channel in the POST body when set', async () => {
    patchSession({ channel: 'reddit' })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }),
    )

    await track('waitlist', { email: 'a@example.com', consent: true })

    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const body = JSON.parse(init.body)
    expect(body.channel).toBe('reddit')
  })

  it('omits channel from the POST body when unset', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }),
    )

    await track('tried_app')

    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const body = JSON.parse(init.body)
    expect(body).not.toHaveProperty('channel')
  })
})
