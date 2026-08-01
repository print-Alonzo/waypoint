import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mongoMock = vi.hoisted(() => ({
  updateOne: vi.fn(),
  findOne: vi.fn(),
}))
const eventsMock = vi.hoisted(() => ({
  insertOne: vi.fn(),
}))
vi.mock('@/lib/validation/mongo', () => ({
  getCollection: vi.fn().mockResolvedValue(mongoMock),
  getEventsCollection: vi.fn().mockResolvedValue(eventsMock),
}))

import { POST } from '@/app/api/validation/route'

function postWith(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/validation', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

beforeEach(() => {
  mongoMock.updateOne.mockReset()
  mongoMock.updateOne.mockResolvedValue({})
  mongoMock.findOne.mockReset()
  mongoMock.findOne.mockResolvedValue(null)
  eventsMock.insertOne.mockReset()
  eventsMock.insertOne.mockResolvedValue({})
  vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017/test')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('POST /api/validation', () => {
  it('rejects an invalid JSON body', async () => {
    const res = await POST(postWith('not json'))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.ok).toBe(false)
  })

  it('returns 422 with field errors for an invalid body', async () => {
    const res = await POST(postWith({ milestone: 'tried_app' })) // missing sid
    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.errors.sid).toBeTruthy()
    expect(mongoMock.updateOne).not.toHaveBeenCalled()
  })

  it('returns 503 when MONGODB_URI is not configured', async () => {
    vi.stubEnv('MONGODB_URI', '')
    const res = await POST(postWith({ sid: 'abc-123', milestone: 'tried_app' }))
    expect(res.status).toBe(503)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(mongoMock.updateOne).not.toHaveBeenCalled()
  })

  it('rejects a cross-origin POST', async () => {
    const res = await POST(
      postWith({ sid: 'abc-123', milestone: 'tried_app' }, { Origin: 'http://evil.example' }),
    )
    expect(res.status).toBe(403)
    expect(mongoMock.updateOne).not.toHaveBeenCalled()
  })

  it('allows a same-origin POST', async () => {
    const res = await POST(
      postWith({ sid: 'abc-123', milestone: 'tried_app' }, { Origin: 'http://localhost' }),
    )
    expect(res.status).toBe(200)
  })

  it('rejects a POST with a malformed Origin header', async () => {
    const res = await POST(
      postWith({ sid: 'abc-123', milestone: 'tried_app' }, { Origin: 'not-a-valid-url' }),
    )
    expect(res.status).toBe(403)
    expect(mongoMock.updateOne).not.toHaveBeenCalled()
  })

  it('upserts by sid on a valid lightweight-milestone submission, using $min/$max (not $set) for timestamps/rank', async () => {
    const res = await POST(postWith({ sid: 'abc-123', milestone: 'tried_app' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.returning).toBe(false)

    expect(mongoMock.updateOne).toHaveBeenCalledTimes(1)
    const [filter, update, options] = mongoMock.updateOne.mock.calls[0]
    expect(filter).toEqual({ sid: 'abc-123' })
    expect(update.$setOnInsert.sid).toBe('abc-123')
    expect(typeof update.$setOnInsert.startedAt).toBe('number')
    expect(typeof update.$min.triedAppAt).toBe('number')
    expect(update.$max.furthestMilestoneRank).toBe(2)
    expect(update.$set.lastMilestone).toBe('tried_app')
    expect(update.$set.milestone).toBeUndefined()
    expect(typeof update.$set.lastSeenAt).toBe('number')
    expect(options).toEqual({ upsert: true })
  })

  it('inserts one validation_events document per POST', async () => {
    await POST(postWith({ sid: 'abc-123', milestone: 'tried_app' }))
    expect(eventsMock.insertOne).toHaveBeenCalledTimes(1)
    const [event] = eventsMock.insertOne.mock.calls[0]
    expect(event.sid).toBe('abc-123')
    expect(event.milestone).toBe('tried_app')
    expect(typeof event.at).toBe('number')
  })

  it('does not look up email for a non-waitlist milestone', async () => {
    await POST(postWith({ sid: 'abc-123', milestone: 'tried_app' }))
    expect(mongoMock.findOne).not.toHaveBeenCalled()
  })

  it('accepts and upserts a full submitted payload', async () => {
    const res = await POST(
      postWith({
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
      }),
    )
    expect(res.status).toBe(200)
    const [, update] = mongoMock.updateOne.mock.calls[0]
    expect(update.$set.email).toBe('traveler@example.com')
    expect(update.$set.priceUnit).toBe('per-month')
    expect(update.$set.lastMilestone).toBe('submitted')
    expect(typeof update.$min.submittedAt).toBe('number')
  })

  describe('waitlist milestone', () => {
    it('looks up the email before upserting and reports returning:false for a new email', async () => {
      mongoMock.findOne.mockResolvedValueOnce(null)
      const res = await POST(
        postWith({ sid: 'abc-123', milestone: 'waitlist', email: 'new@example.com', consent: true }),
      )
      const json = await res.json()
      expect(json.returning).toBe(false)

      expect(mongoMock.findOne).toHaveBeenCalledWith(
        { email: 'new@example.com' },
        { projection: { _id: 1 } },
      )
      const findOneOrder = mongoMock.findOne.mock.invocationCallOrder[0]
      const updateOneOrder = mongoMock.updateOne.mock.invocationCallOrder[0]
      expect(findOneOrder).toBeLessThan(updateOneOrder)
    })

    it('reports returning:true when the email already exists on any sid', async () => {
      mongoMock.findOne.mockResolvedValueOnce({ _id: 'some-other-doc' })
      const res = await POST(
        postWith({
          sid: 'new-sid',
          milestone: 'waitlist',
          email: 'existing@example.com',
          consent: true,
        }),
      )
      const json = await res.json()
      expect(json.returning).toBe(true)
    })

    // Pins current behavior (case-sensitive) so a future change to normalize
    // email casing is a deliberate decision, not an accidental regression.
    it('matches the email lookup case-sensitively', async () => {
      mongoMock.findOne.mockResolvedValueOnce(null)
      await POST(
        postWith({
          sid: 'abc-123',
          milestone: 'waitlist',
          email: 'Traveler@Example.com',
          consent: true,
        }),
      )
      expect(mongoMock.findOne).toHaveBeenCalledWith(
        { email: 'Traveler@Example.com' },
        { projection: { _id: 1 } },
      )
    })

    it('returns 500 when the returning-email lookup fails', async () => {
      mongoMock.findOne.mockRejectedValueOnce(new Error('read failed'))
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const res = await POST(
        postWith({ sid: 'abc-123', milestone: 'waitlist', email: 'a@example.com', consent: true }),
      )
      expect(res.status).toBe(500)
      consoleError.mockRestore()
    })
  })

  it('returns 500 when the events insert fails, even though the submission upsert already succeeded', async () => {
    eventsMock.insertOne.mockRejectedValueOnce(new Error('insert failed'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await POST(postWith({ sid: 'abc-123', milestone: 'tried_app' }))
    expect(res.status).toBe(500)
    expect(mongoMock.updateOne).toHaveBeenCalledTimes(1)
    consoleError.mockRestore()
  })

  it('returns a generic 500 (no driver detail) when the database write fails', async () => {
    mongoMock.updateOne.mockRejectedValueOnce(
      new Error('connection refused: mongodb+srv://secret@cluster'),
    )
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await POST(postWith({ sid: 'abc-123', milestone: 'tried_app' }))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toMatch(/failed to record/i)
    expect(json.error).not.toMatch(/connection refused/i)
    expect(json.error).not.toMatch(/mongodb\+srv/i)
    consoleError.mockRestore()
  })
})
