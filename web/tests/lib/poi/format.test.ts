import { describe, it, expect } from 'vitest'
import { hoursLabel } from '@/lib/poi/format'
import type { POI } from '@/lib/scheduling/scheduler'

function poi(overrides: Partial<POI>): POI {
  return {
    id: 'x',
    name: 'X',
    category: 'heritage',
    lat: 0,
    lng: 0,
    open_time: '08:00',
    close_time: '18:00',
    closed_days: [],
    recommended_duration_minutes: 60,
    notes: null,
    ...overrides,
  }
}

describe('hoursLabel', () => {
  it('shows just the hours when open every day', () => {
    expect(hoursLabel(poi({}))).toBe('08:00–18:00')
  })

  it('lists closed days (1–3 of them)', () => {
    expect(hoursLabel(poi({ closed_days: ['Monday'] }))).toBe('08:00–18:00 · closed Monday')
    expect(hoursLabel(poi({ closed_days: ['Monday', 'Tuesday'] }))).toBe(
      '08:00–18:00 · closed Monday, Tuesday',
    )
  })

  it('collapses to "select days only" when closed more than 3 days', () => {
    expect(
      hoursLabel(poi({ closed_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'] })),
    ).toBe('08:00–18:00 · select days only')
  })
})
