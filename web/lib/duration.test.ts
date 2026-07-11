import { describe, it, expect } from 'vitest'
import {
  clampDuration,
  encodeDurations,
  parseDurations,
  pruneDurations,
  DURATION_MIN,
  DURATION_MAX,
} from './duration'
import type { POI } from './scheduler'

function makePOI(overrides: Partial<POI> & { id: string }): POI {
  return {
    name: `POI ${overrides.id}`,
    category: 'heritage',
    lat: 14.59,
    lng: 120.98,
    open_time: '09:00',
    close_time: '17:00',
    closed_days: [],
    recommended_duration_minutes: 60,
    notes: null,
    ...overrides,
  }
}

describe('clampDuration', () => {
  it('floors below DURATION_MIN', () => {
    expect(clampDuration(0)).toBe(DURATION_MIN)
    expect(clampDuration(-50)).toBe(DURATION_MIN)
  })

  it('caps above DURATION_MAX', () => {
    expect(clampDuration(9999)).toBe(DURATION_MAX)
  })

  it('rounds to a whole minute', () => {
    expect(clampDuration(45.6)).toBe(46)
  })

  it('passes through an in-range whole number unchanged', () => {
    expect(clampDuration(90)).toBe(90)
  })
})

describe('parseDurations', () => {
  it('drops malformed entries without throwing', () => {
    expect(parseDurations('abc')).toEqual({})
    expect(parseDurations('id:')).toEqual({})
    expect(parseDurations('id:xyz')).toEqual({})
    expect(parseDurations('id:-30')).toEqual({})
    expect(parseDurations('id:0')).toEqual({})
    expect(parseDurations('')).toEqual({})
  })

  it('clamps in-range numerics', () => {
    expect(parseDurations('fort-santiago:90')).toEqual({ 'fort-santiago': 90 })
    expect(parseDurations('fort-santiago:5')).toEqual({ 'fort-santiago': DURATION_MIN })
    expect(parseDurations('fort-santiago:9999')).toEqual({ 'fort-santiago': DURATION_MAX })
  })

  it('parses multiple valid entries and skips malformed ones in the same string', () => {
    expect(parseDurations('a:30,garbage,b:120')).toEqual({ a: 30, b: 120 })
  })
})

describe('encodeDurations / parseDurations round-trip', () => {
  it('round-trips a multi-entry map', () => {
    const d = { 'quiapo-market': 30, 'fort-santiago': 120 }
    expect(parseDurations(encodeDurations(d))).toEqual(d)
  })

  it('produces stable (sorted) key order regardless of insertion order', () => {
    const a = { b: 30, a: 60 }
    const b = { a: 60, b: 30 }
    expect(encodeDurations(a)).toBe(encodeDurations(b))
    expect(encodeDurations(a)).toBe('a:60,b:30')
  })

  it('empty map encodes to an empty string', () => {
    expect(encodeDurations({})).toBe('')
  })
})

describe('pruneDurations', () => {
  it('drops ids not present in the given POI list', () => {
    const pois = [makePOI({ id: 'fort-santiago', recommended_duration_minutes: 90 })]
    expect(pruneDurations({ 'fort-santiago': 120, unknown: 60 }, pois)).toEqual({
      'fort-santiago': 120,
    })
  })

  it('drops a value equal to the POI recommendation (not a real override)', () => {
    const pois = [makePOI({ id: 'fort-santiago', recommended_duration_minutes: 90 })]
    expect(pruneDurations({ 'fort-santiago': 90 }, pois)).toEqual({})
  })

  it('keeps a value that differs from the recommendation', () => {
    const pois = [makePOI({ id: 'fort-santiago', recommended_duration_minutes: 90 })]
    expect(pruneDurations({ 'fort-santiago': 120 }, pois)).toEqual({ 'fort-santiago': 120 })
  })
})
