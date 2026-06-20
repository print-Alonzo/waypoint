import { describe, it, expect } from 'vitest'
import { encodeParams, decodeParams } from './params'
import type { ScheduleParams } from './params'

const BASE: ScheduleParams = {
  poi_ids: ['fort-santiago', 'rizal-shrine', 'national-museum'],
  start_time: '09:00',
  transport_mode: 'jeepney',
  start_location: 'rizal-park',
  day_of_week: 'Saturday',
}

// (1) Round-trip: encodeParams → decodeParams returns same ScheduleParams
it('round-trips ScheduleParams through encode/decode', () => {
  const decoded = decodeParams(encodeParams(BASE))
  expect(decoded).toEqual(BASE)
})

// (2) Empty URLSearchParams → null
it('returns null for empty URLSearchParams', () => {
  expect(decodeParams(new URLSearchParams())).toBeNull()
})

// (3) Missing poi_ids field → null
it('returns null when poi_ids is missing', () => {
  const sp = encodeParams(BASE)
  sp.delete('poi_ids')
  expect(decodeParams(sp)).toBeNull()
})

// (4) Missing start_time field → null
it('returns null when start_time is missing', () => {
  const sp = encodeParams(BASE)
  sp.delete('start_time')
  expect(decodeParams(sp)).toBeNull()
})

// (5) Empty poi_ids array → null
it('returns null when poi_ids encodes to an empty array', () => {
  const sp = encodeParams({ ...BASE, poi_ids: [] })
  // encodeParams sets poi_ids='' for empty array; decodeParams should return null
  expect(decodeParams(sp)).toBeNull()
})

// (6) Invalid start_time format → null
it('returns null for malformed start_time', () => {
  const sp = encodeParams(BASE)
  sp.set('start_time', '9am')
  expect(decodeParams(sp)).toBeNull()
})

// (7) Result-page order/locked round-trip when present
it('round-trips optional order + locked when present', () => {
  const customized = {
    ...BASE,
    order: ['rizal-shrine', 'fort-santiago', 'national-museum'],
    locked: ['rizal-shrine'],
  }
  const decoded = decodeParams(encodeParams(customized))
  expect(decoded).toEqual(customized)
})

// (8) Base URL (no order/locked) decodes WITHOUT those keys (keeps clean URLs)
it('omits order/locked entirely when absent', () => {
  const sp = encodeParams(BASE)
  expect(sp.has('order')).toBe(false)
  expect(sp.has('locked')).toBe(false)
  const decoded = decodeParams(sp)!
  expect('order' in decoded).toBe(false)
  expect('locked' in decoded).toBe(false)
})
