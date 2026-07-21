// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FeedbackView from '@/components/feedback/FeedbackView'

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

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Definitely' }))
  await user.click(screen.getByRole('button', { name: 'Yes' }))
  await user.type(screen.getByLabelText('Too cheap'), '50')
  await user.type(screen.getByLabelText('A bargain'), '150')
  await user.type(screen.getByLabelText('Getting pricey'), '300')
  await user.type(screen.getByLabelText('Too expensive'), '500')
  await user.selectOptions(screen.getByLabelText(/pricing model/i), 'monthly')
  await user.type(screen.getByLabelText('Email'), 'traveler@example.com')
  await user.click(screen.getByRole('checkbox'))
}

describe('FeedbackView', () => {
  it('posts feedback_opened on mount', async () => {
    render(<FeedbackView />)
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/validation',
        expect.objectContaining({ method: 'POST' }),
      ),
    )
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body.milestone).toBe('feedback_opened')
  })

  it('disables submit until every required field is filled', async () => {
    const user = userEvent.setup()
    render(<FeedbackView />)
    const submit = screen.getByRole('button', { name: /submit/i })
    expect(submit).toBeDisabled()

    await fillValidForm(user)
    await waitFor(() => expect(submit).toBeEnabled())
  })

  it('rejects a malformed email by keeping submit disabled', async () => {
    const user = userEvent.setup()
    render(<FeedbackView />)
    await fillValidForm(user)
    await user.clear(screen.getByLabelText('Email'))
    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled()
  })

  it('submits the full payload and navigates to /thanks on success', async () => {
    const user = userEvent.setup()
    render(<FeedbackView />)
    await fillValidForm(user)

    await user.click(screen.getByRole('button', { name: /^submit$/i }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/thanks'))
    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls
    const submitCall = calls.find((c) => JSON.parse(c[1].body).milestone === 'submitted')
    expect(submitCall).toBeTruthy()
    const body = JSON.parse(submitCall![1].body)
    expect(body.email).toBe('traveler@example.com')
    expect(body.vanWestendorp).toEqual({
      tooCheap: 50,
      goodValue: 150,
      gettingExpensive: 300,
      tooExpensive: 500,
    })
  })

  it('shows an inline error and keeps entered data when the submit fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ ok: false }) }),
    )
    const user = userEvent.setup()
    render(<FeedbackView />)
    await fillValidForm(user)

    await user.click(screen.getByRole('button', { name: /^submit$/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(push).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Email')).toHaveValue('traveler@example.com')
  })
})
