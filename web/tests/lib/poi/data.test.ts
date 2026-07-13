import { describe, it, expect } from 'vitest'
import { POIS, POI_MAP, TRANSIT_MATRIX, CITY_LABEL } from '@/lib/poi/data'

describe('poi/data', () => {
  it('exposes a non-empty POI list and a matching label', () => {
    expect(POIS.length).toBeGreaterThan(0)
    expect(CITY_LABEL.length).toBeGreaterThan(0)
  })

  it('POI_MAP has exactly one entry per POI, keyed by id', () => {
    expect(Object.keys(POI_MAP)).toHaveLength(POIS.length)
    for (const p of POIS) {
      expect(POI_MAP[p.id]).toEqual(p)
    }
  })

  it('POI ids are unique', () => {
    const ids = POIS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('the transit matrix has an entry for every POI-to-POI pair (all three modes)', () => {
    for (const a of POIS) {
      expect(TRANSIT_MATRIX[a.id]).toBeDefined()
      for (const b of POIS) {
        if (a.id === b.id) continue
        const leg = TRANSIT_MATRIX[a.id][b.id]
        expect(leg, `missing leg ${a.id} -> ${b.id}`).toBeDefined()
        expect(leg.walk).toBeGreaterThan(0)
        expect(leg.jeepney).toBeGreaterThan(0)
        expect(leg.grab).toBeGreaterThan(0)
      }
    }
  })
})
