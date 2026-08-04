// Pure scoring for the persona quiz (validation funnel). Each question nudges the
// visitor toward one of two customer personas the venture is validating —
// time-poor professional vs meticulous router — via a per-option weight; a tie
// falls back to a third "explorer" bucket rather than forcing a guess. Kept
// dependency-free and pure so it's trivially unit-testable and reusable from
// both QuizView and (if ever needed) a server-side check.
//
// This file also owns every persona-facing string. The quiz result screen and
// the landing signup card both speak to the visitor's persona, and the funnel
// only reads as one continuous thread if they're worded from one source —
// PERSONA_BLURB used to live in QuizView, which made that impossible to keep true.

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

// One line naming what the visitor just told us about themselves — no product
// pitch yet. Shown directly under the label on the quiz result screen.
export const PERSONA_BLURB: Record<Persona, string> = {
  'time-poor':
    "You want a day that's already sorted — pick your places, and let the order take care of itself.",
  meticulous:
    'You like knowing exactly why each stop is where it is — Waypoint shows its work so you can fine-tune anything.',
  explorer:
    "You're open to however the day unfolds — a solid starting order you're free to make your own.",
}

// The bridge from "here's who you are" to "here's why this app is for you" —
// the quiz result screen's whole job is making the hop to the landing page feel
// earned rather than like a redirect. Each one answers the persona's own
// complaint in Waypoint's terms.
export const PERSONA_PITCH: Record<Persona, string> = {
  'time-poor':
    'Waypoint was built for exactly this. Pick the places you care about and your day arrives already sorted — a sensible order, arrival times, less time planning and less time on the road. Anything closed or out of reach is flagged up front, so nothing quietly eats your day.',
  meticulous:
    "Waypoint doesn't hide the routing from you. Every stop shows the reason it landed where it did, and you can reorder anything — one tool that shows its work so you can fine-tune every detail. If a stop is closed or too far, it's flagged in plain sight, never silently dropped.",
  explorer:
    'Waypoint gives you a solid starting order, then gets out of the way. Rearrange stops, swap places, follow a detour — the plan is yours to bend. It just keeps the times, map, and flags honest while you do.',
}

// A single persona-aware sentence for the landing signup card, so a visitor who
// arrived via the quiz sees their own words again at the email ask. Deliberately
// short: it prefixes the generic subhead rather than replacing the section.
export const PERSONA_SIGNUP_LINE: Record<Persona, string> = {
  'time-poor': 'For a time-poor professional like you: your day already sorted, less time planning.',
  meticulous:
    'For a meticulous router like you: one tool that shows its work, so you can fine-tune everything.',
  explorer: "For an open-minded explorer like you: a solid starting plan that's yours to bend.",
}
