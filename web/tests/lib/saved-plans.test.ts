// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { savePlan, listSavedPlans, removePlan } from '@/lib/saved-plans'

beforeEach(() => {
  localStorage.clear()
})

describe('saved-plans storage', () => {
  it('saves and lists a plan', () => {
    savePlan('Day one', 'poi_ids=a', 1000)
    const all = listSavedPlans()
    expect(all).toHaveLength(1)
    expect(all[0].name).toBe('Day one')
    expect(all[0].query).toBe('poi_ids=a')
  })

  it('lists newest first', () => {
    savePlan('older', 'poi_ids=a', 1000)
    savePlan('newer', 'poi_ids=b', 2000)
    expect(listSavedPlans().map((p) => p.name)).toEqual(['newer', 'older'])
  })

  it('de-dupes by query (re-saving keeps one, updated entry)', () => {
    savePlan('first', 'poi_ids=a', 1000)
    savePlan('second', 'poi_ids=a', 2000)
    const all = listSavedPlans()
    expect(all).toHaveLength(1)
    expect(all[0].name).toBe('second')
  })

  it('falls back to a name for blank input', () => {
    savePlan('   ', 'poi_ids=a', 1000)
    expect(listSavedPlans()[0].name).toBe('Untitled plan')
  })

  it('caps the number of saved plans at exactly 12', () => {
    for (let i = 0; i < 20; i++) savePlan(`plan ${i}`, `poi_ids=${i}`, 1000 + i)
    expect(listSavedPlans().length).toBe(12)
  })

  it('removes a plan by id', () => {
    const a = savePlan('a', 'poi_ids=a', 1000)
    savePlan('b', 'poi_ids=b', 2000)
    removePlan(a.id)
    expect(listSavedPlans().map((p) => p.name)).toEqual(['b'])
  })

  it('gives distinct ids to distinct plans saved in the same millisecond', () => {
    const a = savePlan('a', 'poi_ids=a', 5000)
    const b = savePlan('b', 'poi_ids=b', 5000)
    expect(a.id).not.toBe(b.id)
    removePlan(a.id)
    // Removing one same-ms plan must not remove the other.
    expect(listSavedPlans().map((p) => p.name)).toEqual(['b'])
  })
})
