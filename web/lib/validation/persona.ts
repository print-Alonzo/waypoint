// Pure scoring for the persona quiz (validation funnel). Each question nudges the
// visitor toward one of two customer personas the venture is validating —
// time-poor professional vs meticulous router — via a per-option weight; a tie
// falls back to a third "explorer" bucket rather than forcing a guess. Kept
// dependency-free and pure so it's trivially unit-testable and reusable from
// both QuizView and (if ever needed) a server-side check.

export type Persona = 'time-poor' | 'meticulous' | 'explorer'

export type PersonaScores = {
  timePoor: number
  meticulous: number
}

export type QuizOption = {
  label: string
  weight: PersonaScores
}

export type QuizQuestion = {
  id: string
  prompt: string
  options: QuizOption[]
}

export const PERSONA_QUESTIONS: QuizQuestion[] = [
  {
    id: 'planning-style',
    prompt: 'When planning a trip, I usually…',
    options: [
      { label: 'Wing it — I just want it decided fast', weight: { timePoor: 2, meticulous: 0 } },
      { label: 'Sketch a rough plan and stay flexible', weight: { timePoor: 1, meticulous: 1 } },
      { label: 'Research every detail before I go', weight: { timePoor: 0, meticulous: 2 } },
    ],
  },
  {
    id: 'ideal-day',
    prompt: 'My ideal day out is…',
    options: [
      { label: 'Hit the highlights, efficiently', weight: { timePoor: 2, meticulous: 0 } },
      { label: 'A mix of highlights and a few surprises', weight: { timePoor: 1, meticulous: 1 } },
      { label: "Don't miss a single hidden gem", weight: { timePoor: 0, meticulous: 2 } },
    ],
  },
  {
    id: 'route-ownership',
    prompt: 'Arranging the route myself is…',
    options: [
      { label: "A chore — I'd rather an app handle it", weight: { timePoor: 2, meticulous: 0 } },
      { label: 'Fine either way', weight: { timePoor: 1, meticulous: 1 } },
      { label: 'Part of the fun — I like being hands-on', weight: { timePoor: 0, meticulous: 2 } },
    ],
  },
  {
    id: 'travel-frequency',
    prompt: 'How often do you travel for leisure?',
    options: [
      { label: 'Rarely — trips are precious, I want them to count', weight: { timePoor: 0, meticulous: 2 } },
      { label: 'A few times a year', weight: { timePoor: 1, meticulous: 1 } },
      { label: 'Often — sometimes for work, sometimes for fun', weight: { timePoor: 2, meticulous: 0 } },
    ],
  },
  {
    id: 'biggest-frustration',
    prompt: 'My biggest trip frustration is…',
    options: [
      { label: 'Wasted time — traffic, backtracking, dead time', weight: { timePoor: 2, meticulous: 0 } },
      { label: 'A bit of both', weight: { timePoor: 1, meticulous: 1 } },
      { label: 'Missing something worth seeing', weight: { timePoor: 0, meticulous: 2 } },
    ],
  },
]

// `answers[i]` is the chosen option index for `PERSONA_QUESTIONS[i]`. Indices
// outside an option's range (or missing) contribute no weight, so a partial
// answer set still scores rather than throwing.
export function scorePersona(answers: number[]): { persona: Persona; scores: PersonaScores } {
  const scores: PersonaScores = { timePoor: 0, meticulous: 0 }
  PERSONA_QUESTIONS.forEach((question, i) => {
    const option = question.options[answers[i]]
    if (!option) return
    scores.timePoor += option.weight.timePoor
    scores.meticulous += option.weight.meticulous
  })

  let persona: Persona = 'explorer'
  if (scores.timePoor > scores.meticulous) persona = 'time-poor'
  else if (scores.meticulous > scores.timePoor) persona = 'meticulous'

  return { persona, scores }
}

export const PERSONA_LABEL: Record<Persona, string> = {
  'time-poor': 'Time-poor professional',
  meticulous: 'Meticulous router',
  explorer: 'Open-minded explorer',
}
