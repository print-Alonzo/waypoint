// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QuizView from '@/components/quiz/QuizView'
import { PERSONA_QUESTIONS } from '@/lib/validation/persona'
import { getSession } from '@/lib/validation/session'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

beforeEach(() => {
  push.mockClear()
  localStorage.clear()
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }),
  )
})

describe('QuizView', () => {
  it('walks through every question and reveals a persona', async () => {
    const user = userEvent.setup()
    render(<QuizView />)

    expect(screen.getByText(`Question 1 of ${PERSONA_QUESTIONS.length}`)).toBeInTheDocument()

    // Always choose the first (time-poor-leaning) option.
    for (let i = 0; i < PERSONA_QUESTIONS.length; i++) {
      const option = PERSONA_QUESTIONS[i].options[0]
      await user.click(screen.getByRole('button', { name: option.label }))
    }

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Time-poor professional' })).toBeInTheDocument(),
    )
  })

  it('records the persona on the local session and posts quiz_completed', async () => {
    const user = userEvent.setup()
    render(<QuizView />)

    for (let i = 0; i < PERSONA_QUESTIONS.length; i++) {
      await user.click(screen.getByRole('button', { name: PERSONA_QUESTIONS[i].options[0].label }))
    }

    await waitFor(() => expect(getSession().persona).toBe('time-poor'))
    expect(fetch).toHaveBeenCalledWith(
      '/api/validation',
      expect.objectContaining({ method: 'POST' }),
    )
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body.milestone).toBe('quiz_completed')
    expect(body.persona).toBe('time-poor')
  })

  it('navigates to /plan?from=quiz when the reveal CTA is clicked', async () => {
    const user = userEvent.setup()
    render(<QuizView />)

    for (let i = 0; i < PERSONA_QUESTIONS.length; i++) {
      await user.click(screen.getByRole('button', { name: PERSONA_QUESTIONS[i].options[0].label }))
    }

    await user.click(await screen.findByRole('button', { name: /try waypoint/i }))
    expect(push).toHaveBeenCalledWith('/plan?from=quiz')
  })

  it('lets the visitor go back to re-answer the previous question', async () => {
    const user = userEvent.setup()
    render(<QuizView />)

    await user.click(screen.getByRole('button', { name: PERSONA_QUESTIONS[0].options[0].label }))
    expect(screen.getByText(`Question 2 of ${PERSONA_QUESTIONS.length}`)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '← Back' }))
    expect(screen.getByText(`Question 1 of ${PERSONA_QUESTIONS.length}`)).toBeInTheDocument()
  })
})
