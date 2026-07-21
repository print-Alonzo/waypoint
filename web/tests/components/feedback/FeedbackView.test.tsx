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
  await user.click(screen.getByRole('button', { name: 'Google Maps and winging it' }))
  await user.click(screen.getByRole('button', { name: 'Yes — under ₱500' }))
  await user.click(screen.getByRole('button', { name: 'Under an hour' }))
  await user.click(screen.getByRole('button', { name: 'Definitely' }))
  await user.click(screen.getByRole('button', { name: 'Yes' }))
  await user.selectOptions(screen.getByLabelText(/pricing structure/i), 'monthly')
  await user.type(screen.getByLabelText('Too cheap'), '50')
  await user.type(screen.getByLabelText('A bargain'), '150')
  await user.type(screen.getByLabelText('Getting pricey'), '300')
  await user.type(screen.getByLabelText('Too expensive'), '500')
  await user.click(screen.getByRole('button', { name: 'My own money' }))
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
    expect(body.currentPlanning).toBe('maps-winging')
    expect(body.pastSpending).toBe('under-500')
    expect(body.timeLost).toBe('under-1h')
    expect(body.budgetSource).toBe('personal')
    expect(body.priceUnit).toBe('per-month')
    expect(body).not.toHaveProperty('worthPaying')
  })

  it('disables price fields until a pricing structure is chosen and shows the unit', async () => {
    const user = userEvent.setup()
    render(<FeedbackView />)
    expect(screen.getByLabelText('Too cheap')).toBeDisabled()

    await user.selectOptions(screen.getByLabelText(/pricing structure/i), 'monthly')

    expect(screen.getByLabelText('Too cheap')).toBeEnabled()
    expect(screen.getAllByText('per month').length).toBeGreaterThan(0)
  })

  it('keeps submit disabled when a new required field is skipped', async () => {
    const user = userEvent.setup()
    render(<FeedbackView />)
    // Fill everything except budgetSource (the last new required pill group).
    await user.click(screen.getByRole('button', { name: 'Google Maps and winging it' }))
    await user.click(screen.getByRole('button', { name: 'Yes — under ₱500' }))
    await user.click(screen.getByRole('button', { name: 'Under an hour' }))
    await user.click(screen.getByRole('button', { name: 'Definitely' }))
    await user.click(screen.getByRole('button', { name: 'Yes' }))
    await user.selectOptions(screen.getByLabelText(/pricing structure/i), 'monthly')
    await user.type(screen.getByLabelText('Too cheap'), '50')
    await user.type(screen.getByLabelText('A bargain'), '150')
    await user.type(screen.getByLabelText('Getting pricey'), '300')
    await user.type(screen.getByLabelText('Too expensive'), '500')
    await user.type(screen.getByLabelText('Email'), 'traveler@example.com')
    await user.click(screen.getByRole('checkbox'))

    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled()
  })

  it('includes a trimmed worthPaying in the payload when filled', async () => {
    const user = userEvent.setup()
    render(<FeedbackView />)
    await fillValidForm(user)
    await user.type(screen.getByLabelText(/worth paying for/i), '  faster planning  ')

    await user.click(screen.getByRole('button', { name: /^submit$/i }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/thanks'))
    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls
    const submitCall = calls.find((c) => JSON.parse(c[1].body).milestone === 'submitted')
    const body = JSON.parse(submitCall![1].body)
    expect(body.worthPaying).toBe('faster planning')
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
