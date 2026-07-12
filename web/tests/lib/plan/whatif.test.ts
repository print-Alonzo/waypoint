import { describe, it, expect } from 'vitest'
import { computeWhatIfVariants } from '@/lib/plan/whatif'
import { POI_MAP } from '@/lib/poi/data'
import { START_LOCATION_MAP, LUNCH_WINDOW } from '@/lib/constants'
import type { ScheduleParams } from '@/lib/plan/params'

const PARAMS: ScheduleParams = {
  poi_ids: ['fort-santiago', 'casa-manila', 'manila-cathedral'],
  start_time: '09:00',
  transport_mode: 'grab',
  start_location: 'rizal-park',
  day_of_week: 'Saturday',
}
const SL = START_LOCATION_MAP[PARAMS.start_location]
const COORDS = { lat: SL.lat, lng: SL.lng }
const POIS = PARAMS.poi_ids.map((id) => POI_MAP[id])

describe('computeWhatIfVariants', () => {
  it('returns one variant per transport mode with sane figures', () => {
    const v = computeWhatIfVariants(POIS, PARAMS, COORDS, null, {})
    expect(v.map((x) => x.mode)).toEqual(['walk', 'jeepney', 'grab'])
    v.forEach((x) => {
      expect(x.spanHours).toBeGreaterThanOrEqual(1)
      expect(typeof x.flagged).toBe('number')
      expect(x.endLabel).toMatch(/^\d{2}:\d{2}/)
    })
  })

  it('walking is free, grab is not', () => {
    const v = computeWhatIfVariants(POIS, PARAMS, COORDS, null, {})
    expect(v.find((x) => x.mode === 'walk')!.fare).toBe('Free')
    expect(v.find((x) => x.mode === 'grab')!.fare).not.toBe('Free')
  })

  it('a lunch window lengthens spans for a day that crosses noon', () => {
    const lateParams = { ...PARAMS, start_time: '11:00' }
    const latePois = lateParams.poi_ids.map((id) => POI_MAP[id])
    const without = computeWhatIfVariants(latePois, lateParams, COORDS, null, {})
    const withLunch = computeWhatIfVariants(
      latePois,
      lateParams,
      COORDS,
      { start: LUNCH_WINDOW.start, end: LUNCH_WINDOW.end },
      {},
    )
    const grabBefore = without.find((x) => x.mode === 'grab')!.spanHours
    const grabAfter = withLunch.find((x) => x.mode === 'grab')!.spanHours
    expect(grabAfter).toBeGreaterThan(grabBefore)
  })
})
