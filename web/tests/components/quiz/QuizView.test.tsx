// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QuizView from '@/components/quiz/QuizView'
import { PERSONA_QUESTIONS, PERSONA_PITCH } from '@/lib/validation/persona'
import { getSession, patchSession } from '@/lib/validation/session'

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

  // The result screen's whole job is handing the visitor to the landing page
  // with a reason to care — the pitch is the handoff, so it can't go missing.
  it('pitches Waypoint to the revealed persona and sends them to the landing page', async () => {
    const user = userEvent.setup()
    render(<QuizView />)

    for (let i = 0; i < PERSONA_QUESTIONS.length; i++) {
      await user.click(screen.getByRole('button', { name: PERSONA_QUESTIONS[i].options[0].label }))
    }

    expect(await screen.findByText(PERSONA_PITCH['time-poor'])).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /show me waypoint/i }))
    expect(push).toHaveBeenCalledWith('/')
  })

  // A channel link is a saved Reddit post or a QR code — people re-open it.
  // Replaying five questions to reach a result they already have is a chore.
  it('skips straight to the stored result when the visitor already has a persona', async () => {
    patchSession({ persona: 'meticulous', quizCompletedAt: Date.now() })
    render(<QuizView />)

    expect(
      await screen.findByRole('heading', { name: 'Meticulous router' }),
    ).toBeInTheDocument()
    expect(screen.queryByText(`Question 1 of ${PERSONA_QUESTIONS.length}`)).not.toBeInTheDocument()
  })

  it('restarts the quiz from question 1 when the stored result is retaken', async () => {
    patchSession({ persona: 'meticulous', quizCompletedAt: Date.now() })
    const user = userEvent.setup()
    render(<QuizView />)

    await user.click(await screen.findByRole('button', { name: /retake the quiz/i }))

    expect(screen.getByText(`Question 1 of ${PERSONA_QUESTIONS.length}`)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Meticulous router' })).not.toBeInTheDocument()
  })

  // Channel links open this page cold, so it has to say what Waypoint is and
  // what it's about to ask for.
  it('introduces Waypoint and the quiz length before the first question', () => {
    render(<QuizView />)

    expect(screen.getByText(/Metro Manila day planner/i)).toBeInTheDocument()
    expect(screen.getByText(/Answer 5 quick questions/i)).toBeInTheDocument()
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
