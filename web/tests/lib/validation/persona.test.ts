import { describe, it, expect } from 'vitest'
import {
  PERSONA_QUESTIONS,
  PERSONA_LABEL,
  PERSONA_BLURB,
  PERSONA_PITCH,
  PERSONA_SIGNUP_LINE,
  scorePersona,
} from '@/lib/validation/persona'

describe('scorePersona', () => {
  it('scores all time-poor answers (index 0 on every question) as time-poor', () => {
    const answers = PERSONA_QUESTIONS.map(() => 0)
    const { persona, scores } = scorePersona(answers)
    expect(persona).toBe('time-poor')
    expect(scores.timePoor).toBeGreaterThan(scores.meticulous)
  })

  it('scores all meticulous answers (index 2 on every question) as meticulous', () => {
    const answers = PERSONA_QUESTIONS.map(() => 2)
    const { persona, scores } = scorePersona(answers)
    expect(persona).toBe('meticulous')
    expect(scores.meticulous).toBeGreaterThan(scores.timePoor)
  })

  it('scores all middle answers (a tie) as explorer', () => {
    const answers = PERSONA_QUESTIONS.map(() => 1)
    const { persona, scores } = scorePersona(answers)
    expect(persona).toBe('explorer')
    expect(scores.timePoor).toBe(scores.meticulous)
  })

  it('treats missing answers as contributing no weight', () => {
    const { persona, scores } = scorePersona([])
    expect(persona).toBe('explorer')
    expect(scores).toEqual({ timePoor: 0, meticulous: 0 })
  })

  it('ignores an out-of-range answer index rather than throwing', () => {
    const answers = [99, 99, 99, 99, 99]
    expect(() => scorePersona(answers)).not.toThrow()
    expect(scorePersona(answers).scores).toEqual({ timePoor: 0, meticulous: 0 })
  })

  it('breaks a near-tie toward whichever side has one more point', () => {
    const answers = PERSONA_QUESTIONS.map(() => 1)
    answers[0] = 0 // one extra time-poor point
    expect(scorePersona(answers).persona).toBe('time-poor')
  })
})

describe('persona copy', () => {
  // The quiz result screen and the landing signup card both index these by
  // persona at runtime. A missing key renders as an empty paragraph rather
  // than an error, so a persona added without its copy would ship silently.
  it('covers every persona in each copy record', () => {
    const personas = Object.keys(PERSONA_LABEL).sort()
    for (const record of [PERSONA_BLURB, PERSONA_PITCH, PERSONA_SIGNUP_LINE]) {
      expect(Object.keys(record).sort()).toEqual(personas)
      expect(Object.values(record).every((line) => line.trim().length > 0)).toBe(true)
    }
  })
})
