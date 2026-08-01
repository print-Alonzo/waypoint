import { describe, it, expect, beforeEach, vi } from 'vitest'

const connectMock = vi.hoisted(() => vi.fn())
const dbMock = vi.hoisted(() => vi.fn())
vi.mock('mongodb', () => ({
  // Must be a real constructor (arrow functions can't be called with `new`) —
  // `new MongoClient(...)` in mongo.ts requires this to work with `new`.
  MongoClient: vi.fn().mockImplementation(function MockMongoClient() {
    return { connect: connectMock, db: dbMock }
  }),
}))

beforeEach(() => {
  vi.resetModules()
  delete (globalThis as Record<string, unknown>)._waypointMongoClientPromise
  vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017/test')
  connectMock.mockReset()
  dbMock.mockReset()
})

describe('mongo client caching', () => {
  it('throws when MONGODB_URI is not set', async () => {
    vi.stubEnv('MONGODB_URI', '')
    const { getCollection } = await import('@/lib/validation/mongo')
    await expect(getCollection()).rejects.toThrow('MONGODB_URI is not set.')
  })

  it('clears the cached promise on a failed connect so the next call retries', async () => {
    connectMock.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    const { getCollection } = await import('@/lib/validation/mongo')
    await expect(getCollection()).rejects.toThrow('ECONNREFUSED')

    // Real driver behavior: client.connect() resolves to the client itself
    // (which has .db()) — mirror that shape here.
    const collection = { name: 'validation_submissions' }
    dbMock.mockReturnValue({ collection: () => collection })
    connectMock.mockResolvedValueOnce({ db: dbMock })
    await expect(getCollection()).resolves.toBe(collection)

    expect(connectMock).toHaveBeenCalledTimes(2)
  })

  it('reuses the same client for both getCollection and getEventsCollection', async () => {
    dbMock.mockReturnValue({ collection: (name: string) => ({ name }) })
    connectMock.mockResolvedValue({ db: dbMock })
    const { getCollection, getEventsCollection } = await import('@/lib/validation/mongo')

    await getCollection()
    await getEventsCollection()

    expect(connectMock).toHaveBeenCalledTimes(1)
  })
})
