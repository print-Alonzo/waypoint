import { describe, it, expect } from 'vitest'
import { PRESETS, presetHref } from './presets'
import { decodeParams } from './params'
import { summarizePlan } from './plan-summary'
import { POI_MAP } from './data'
import { START_LOCATION_MAP, DAYS_OF_WEEK, TRANSPORT_MODES } from './constants'

describe('curated presets', () => {
  it('has unique ids', () => {
    const ids = PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  // The whole value of presets is that they "just work" — guard against a typo'd
  // POI id, start location, mode, or day silently shipping a broken starter day.
  PRESETS.forEach((preset) => {
    describe(preset.id, () => {
      it('references only real POI ids', () => {
        preset.params.poi_ids.forEach((id) => expect(POI_MAP[id], id).toBeTruthy())
      })
      it('uses a valid start location, mode and day', () => {
        expect(START_LOCATION_MAP[preset.params.start_location]).toBeTruthy()
        expect(TRANSPORT_MODES.map((m) => m.value)).toContain(preset.params.transport_mode)
        expect(DAYS_OF_WEEK).toContain(preset.params.day_of_week)
      })
      it('produces a result URL that decodes back to its params', () => {
        const href = presetHref(preset)
        expect(href.startsWith('/result?')).toBe(true)
        const decoded = decodeParams(new URLSearchParams(href.split('?')[1]))
        expect(decoded).toEqual(preset.params)
      })
      it('schedules into a non-empty plan with no closed/late flags on its chosen day', () => {
        const summary = summarizePlan(preset.params)
        expect(summary).not.toBeNull()
        expect(summary!.stopCount).toBe(preset.params.poi_ids.length)
        // The whole promise of a curated day: nothing closed or arrived-too-late on
        // the day it picks. (This is what the "avoid Monday closures" choice buys.)
        expect(summary!.flagged).toBe(0)
      })
    })
  })
})
