// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QuizView from '@/components/quiz/QuizView'
import { PERSONA_QUESTIONS } from '@/lib/validation/persona'

// Regression: ISSUE-002 — answering a question unmounted the focused option
// button, so focus fell back to <body>. A keyboard user had to tab from the top
// of the document again for each of the five questions, and a screen reader was
// told nothing about the change. The funnel inversion made the quiz the front
// door, so this was a recruited keyboard user's first experience of Waypoint.
// Found by /qa on 2026-08-04
// Report: .gstack/qa-reports/qa-report-localhost-2026-08-04.md

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

beforeEach(() => {
  push.mockClear()
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }))
})

async function answer(user: ReturnType<typeof userEvent.setup>, questionIndex: number) {
  const option = PERSONA_QUESTIONS[questionIndex].options[0]
  await user.click(screen.getByRole('button', { name: option.label }))
}

describe('QuizView focus management (ISSUE-002)', () => {
  it('moves focus to the next question instead of dropping it to the body', async () => {
    const user = userEvent.setup()
    render(<QuizView />)

    await answer(user, 0)

    const heading = screen.getByRole('heading', { name: PERSONA_QUESTIONS[1].prompt })
    expect(document.activeElement).toBe(heading)
    expect(document.activeElement).not.toBe(document.body)
  })

  it('leaves focus alone on first render so the intro is not skipped', () => {
    render(<QuizView />)

    // A cold visitor from a channel link needs to read the intro above Q1;
    // focusing the heading on mount would scroll them straight past it.
    expect(document.activeElement).toBe(document.body)
  })

  it('moves focus when stepping back to the previous question', async () => {
    const user = userEvent.setup()
    render(<QuizView />)

    await answer(user, 0)
    await user.click(screen.getByRole('button', { name: /back/i }))

    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: PERSONA_QUESTIONS[0].prompt }),
    )
  })

  it('moves focus to the result heading on the final answer', async () => {
    const user = userEvent.setup()
    render(<QuizView />)

    // Completion swaps in the result screen without changing `index`, so this
    // is the transition a naive [index]-only effect would miss.
    for (let i = 0; i < PERSONA_QUESTIONS.length; i++) await answer(user, i)

    await waitFor(() => {
      const result = screen.getByRole('heading', { name: 'Time-poor professional' })
      expect(document.activeElement).toBe(result)
    })
  })

  it('moves focus back to question one on retake', async () => {
    const user = userEvent.setup()
    render(<QuizView />)

    for (let i = 0; i < PERSONA_QUESTIONS.length; i++) await answer(user, i)
    await waitFor(() => screen.getByRole('button', { name: /retake the quiz/i }))
    await user.click(screen.getByRole('button', { name: /retake the quiz/i }))

    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: PERSONA_QUESTIONS[0].prompt }),
    )
  })
})
