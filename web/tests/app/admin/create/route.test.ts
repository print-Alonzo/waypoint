import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const fsMock = vi.hoisted(() => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}))
vi.mock('node:fs', () => fsMock)

import { POST } from '@/app/admin/create/route'

const VALID_BODY = {
  name: 'Rizal Park',
  category: 'park',
  lat: '14.5831',
  lng: '120.9794',
  open_time: '08:00',
  close_time: '18:00',
  recommended_duration_minutes: '90',
  closed_days: [],
  notes: '',
}

function postWith(body: unknown): Request {
  return new Request('http://localhost/admin/create', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const EXISTING_POI = {
  id: 'existing-poi',
  name: 'Existing Place',
  category: 'heritage',
  lat: 14.5,
  lng: 121.0,
  open_time: '08:00',
  close_time: '18:00',
  closed_days: [],
  recommended_duration_minutes: 60,
  notes: null,
}

beforeEach(() => {
  fsMock.readFileSync.mockReset()
  fsMock.writeFileSync.mockReset()
  fsMock.readFileSync.mockReturnValue(JSON.stringify([EXISTING_POI]))
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('POST /admin/create', () => {
  it('refuses to run when deployed to Vercel', async () => {
    vi.stubEnv('VERCEL', '1')
    const res = await POST(postWith(VALID_BODY))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(fsMock.writeFileSync).not.toHaveBeenCalled()
  })

  it('rejects an invalid JSON body', async () => {
    const res = await POST(postWith('not json'))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.ok).toBe(false)
  })

  it('returns 500 when the dataset cannot be read', async () => {
    fsMock.readFileSync.mockImplementation(() => {
      throw new Error('ENOENT')
    })
    const res = await POST(postWith(VALID_BODY))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toMatch(/could not read/i)
  })

  it('returns 422 with field errors for an invalid place', async () => {
    const res = await POST(postWith({ ...VALID_BODY, name: '' }))
    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.errors.name).toBeTruthy()
    expect(fsMock.writeFileSync).not.toHaveBeenCalled()
  })

  it('rejects an id that collides with an existing place', async () => {
    const res = await POST(postWith({ ...VALID_BODY, id: 'existing-poi' }))
    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.errors.id).toMatch(/already exists/)
  })

  it('appends the new place and regenerates both data files on success', async () => {
    const res = await POST(postWith(VALID_BODY))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.poi.id).toBe('rizal-park')
    expect(json.total).toBe(2)

    expect(fsMock.writeFileSync).toHaveBeenCalledTimes(2)
    const [poisCall, matrixCall] = fsMock.writeFileSync.mock.calls
    expect(poisCall[0]).toMatch(/pois\.json$/)
    const writtenPois = JSON.parse(poisCall[1] as string)
    expect(writtenPois).toHaveLength(2)
    expect(writtenPois[1].id).toBe('rizal-park')

    expect(matrixCall[0]).toMatch(/transit-matrix\.json$/)
    const writtenMatrix = JSON.parse(matrixCall[1] as string)
    expect(writtenMatrix['existing-poi']['rizal-park']).toBeDefined()
    expect(writtenMatrix['rizal-park']['existing-poi']).toBeDefined()
  })

  it('returns 500 when writing the data files fails', async () => {
    fsMock.writeFileSync.mockImplementation(() => {
      throw new Error('disk full')
    })
    const res = await POST(postWith(VALID_BODY))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toMatch(/failed to write/i)
  })
})
