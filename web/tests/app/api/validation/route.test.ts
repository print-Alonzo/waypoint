import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mongoMock = vi.hoisted(() => ({
  updateOne: vi.fn(),
}))
vi.mock('@/lib/validation/mongo', () => ({
  getCollection: vi.fn().mockResolvedValue(mongoMock),
}))

import { POST } from '@/app/api/validation/route'

function postWith(body: unknown): Request {
  return new Request('http://localhost/api/validation', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

beforeEach(() => {
  mongoMock.updateOne.mockReset()
  mongoMock.updateOne.mockResolvedValue({})
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

  it('upserts by sid on a valid lightweight-milestone submission', async () => {
    const res = await POST(postWith({ sid: 'abc-123', milestone: 'tried_app' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)

    expect(mongoMock.updateOne).toHaveBeenCalledTimes(1)
    const [filter, update, options] = mongoMock.updateOne.mock.calls[0]
    expect(filter).toEqual({ sid: 'abc-123' })
    expect(update.$setOnInsert.sid).toBe('abc-123')
    expect(typeof update.$setOnInsert.startedAt).toBe('number')
    expect(typeof update.$set.triedAppAt).toBe('number')
    expect(options).toEqual({ upsert: true })
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
    expect(typeof update.$set.submittedAt).toBe('number')
  })

  it('returns 500 when the database write fails', async () => {
    mongoMock.updateOne.mockRejectedValueOnce(new Error('connection refused'))
    const res = await POST(postWith({ sid: 'abc-123', milestone: 'tried_app' }))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toMatch(/failed to record/i)
  })
})
