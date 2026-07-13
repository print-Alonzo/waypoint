import { describe, it, expect } from 'vitest'
import { resolvePlan } from '@/lib/plan/model'
import { POI_MAP } from '@/lib/poi/data'
import { START_LOCATION_MAP, LUNCH_WINDOW } from '@/lib/constants'
import type { ScheduleParams } from '@/lib/plan/params'

const PARAMS: ScheduleParams = {
  poi_ids: ['fort-santiago', 'casa-manila', 'manila-cathedral'],
  start_time: '09:00',
  transport_mode: 'walk',
  start_location: 'rizal-park',
  day_of_week: 'Saturday',
}

describe('resolvePlan', () => {
  it('returns null for an unknown start location', () => {
    expect(resolvePlan({ ...PARAMS, start_location: 'nowhere' })).toBeNull()
  })

  it('returns null when no poi_ids resolve to real POIs', () => {
    expect(resolvePlan({ ...PARAMS, poi_ids: ['does-not-exist'] })).toBeNull()
  })

  it('drops unknown ids and dedupes repeats while keeping known ones', () => {
    const plan = resolvePlan({
      ...PARAMS,
      poi_ids: ['fort-santiago', 'fort-santiago', 'ghost-poi', 'casa-manila'],
    })
    expect(plan).not.toBeNull()
    const ids = plan!.stops.map((s) => s.poi.id)
    expect(ids).toHaveLength(2)
    expect(new Set(ids)).toEqual(new Set(['fort-santiago', 'casa-manila']))
  })

  it('resolves the start name and coords from start_location', () => {
    const plan = resolvePlan(PARAMS)
    const sl = START_LOCATION_MAP[PARAMS.start_location]
    expect(plan!.startName).toBe(sl.name)
    expect(plan!.coords).toEqual({ lat: sl.lat, lng: sl.lng })
  })

  it('falls back to the optimized order when no order/locked is supplied', () => {
    const plan = resolvePlan(PARAMS)
    // Every requested id should appear exactly once, in whatever order the optimizer picked.
    expect(new Set(plan!.stops.map((s) => s.poi.id))).toEqual(new Set(PARAMS.poi_ids))
  })

  it('honors an explicit order param, appending any ids left out of it', () => {
    const explicit = [...PARAMS.poi_ids].reverse()
    const plan = resolvePlan({ ...PARAMS, order: explicit })
    expect(plan!.stops.map((s) => s.poi.id)).toEqual(explicit)
  })

  it('ignores order ids that are not part of the resolved poi set', () => {
    const plan = resolvePlan({ ...PARAMS, order: ['not-a-real-id', 'casa-manila'] })
    expect(plan!.stops[0].poi.id).toBe('casa-manila')
    expect(new Set(plan!.stops.map((s) => s.poi.id))).toEqual(new Set(PARAMS.poi_ids))
  })

  it('reserves the lunch window when lunch=true, matching LUNCH_WINDOW', () => {
    const lateParams = { ...PARAMS, start_time: '11:00' }
    const withoutLunch = resolvePlan(lateParams)!
    const withLunch = resolvePlan({ ...lateParams, lunch: true })!
    const spanWithout =
      withoutLunch.stops[withoutLunch.stops.length - 1].departureTime -
      withoutLunch.stops[0].arrivalTime
    const spanWith =
      withLunch.stops[withLunch.stops.length - 1].departureTime - withLunch.stops[0].arrivalTime
    expect(spanWith).toBeGreaterThan(spanWithout)
    expect(withLunch.stops.some((s) => s.lunchBefore)).toBe(true)
    expect(LUNCH_WINDOW.start).toBeLessThan(LUNCH_WINDOW.end)
  })

  it('does not reserve lunch when the lunchBreak flag path is off (lunch omitted)', () => {
    const plan = resolvePlan(PARAMS)!
    expect(plan.stops.some((s) => s.lunchBefore)).toBe(false)
  })

  it('applies custom per-stop durations from params.durations', () => {
    const target = POI_MAP['fort-santiago']
    const overrideMinutes = target.recommended_duration_minutes + 60
    const plan = resolvePlan({
      ...PARAMS,
      durations: { 'fort-santiago': overrideMinutes },
    })!
    const stop = plan.stops.find((s) => s.poi.id === 'fort-santiago')!
    expect(stop.dwellMinutes).toBe(overrideMinutes)
  })
})
