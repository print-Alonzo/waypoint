import { describe, it, expect } from 'vitest'
import {
  START_LOCATIONS,
  START_LOCATION_MAP,
  CATEGORIES,
  DAYS_OF_WEEK,
  TRANSPORT_MODES,
  LUNCH_WINDOW,
  modeLabel,
} from '@/lib/constants'

describe('modeLabel', () => {
  it('returns the human label for each known transport mode', () => {
    for (const m of TRANSPORT_MODES) {
      expect(modeLabel(m.value)).toBe(m.label)
    }
  })

  it('falls back to the raw value for an unknown mode', () => {
    expect(modeLabel('teleport')).toBe('teleport')
  })
})

describe('START_LOCATION_MAP', () => {
  it('has one entry per START_LOCATIONS item, keyed by id', () => {
    expect(Object.keys(START_LOCATION_MAP)).toHaveLength(START_LOCATIONS.length)
    for (const loc of START_LOCATIONS) {
      expect(START_LOCATION_MAP[loc.id]).toEqual(loc)
    }
  })
})

describe('static registries', () => {
  it('CATEGORIES entries have non-empty key and label', () => {
    for (const c of CATEGORIES) {
      expect(c.key.length).toBeGreaterThan(0)
      expect(c.label.length).toBeGreaterThan(0)
    }
  })

  it('DAYS_OF_WEEK has exactly the 7 canonical day names in order', () => {
    expect(DAYS_OF_WEEK).toEqual([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ])
  })

  it('LUNCH_WINDOW starts before it ends', () => {
    expect(LUNCH_WINDOW.start).toBeLessThan(LUNCH_WINDOW.end)
  })
})
