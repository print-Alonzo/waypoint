// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WaitlistForm from '@/components/landing/WaitlistForm'
import { getSession, bindEmail, patchSession } from '@/lib/validation/session'

const flag = vi.hoisted(() => ({ validation: true }))
vi.mock('@/lib/features', () => ({
  isEnabled: (f: string) => flag[f as keyof typeof flag],
}))

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  flag.validation = true
})

async function fillAndConsent(user: ReturnType<typeof userEvent.setup>, email: string) {
  await user.type(screen.getByLabelText(/^email$/i), email)
  await user.click(screen.getByRole('checkbox'))
}

describe('WaitlistForm', () => {
  it('keeps the submit button disabled until an email is entered and consent is given', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, returning: false }) }),
    )
    render(<WaitlistForm />)

    const submit = screen.getByRole('button', { name: /join waitlist/i })
    expect(submit).toBeDisabled()

    await user.type(screen.getByLabelText(/^email$/i), 'traveler@example.com')
    expect(submit).toBeDisabled() // email alone isn't enough — consent is required too

    await user.click(screen.getByRole('checkbox'))
    expect(submit).toBeEnabled()

    expect(fetch).not.toHaveBeenCalled()
  })

  it('submits the email and shows the success state for a new email', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, returning: false }) }),
    )
    render(<WaitlistForm />)

    await fillAndConsent(user, 'traveler@example.com')
    await user.click(screen.getByRole('button', { name: /join waitlist/i }))

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /you.re on the list/i })).toBeInTheDocument(),
    )
    expect(screen.getByText(/traveler@example.com/)).toBeInTheDocument()
    expect(screen.getByText(/take our 2-minute traveler quiz/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /take the 2-minute quiz/i })).toHaveAttribute(
      'href',
      '/quiz',
    )
    expect(screen.queryByRole('link', { name: /try the live planner/i })).not.toBeInTheDocument()

    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body.milestone).toBe('waitlist')
    expect(body.email).toBe('traveler@example.com')
    expect(body.consent).toBe(true)
  })

  it('includes the session channel in the waitlist POST body', async () => {
    patchSession({ channel: 'reddit' })
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, returning: false }) }),
    )
    render(<WaitlistForm />)

    await fillAndConsent(user, 'traveler@example.com')
    await user.click(screen.getByRole('button', { name: /join waitlist/i }))

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /you.re on the list/i })).toBeInTheDocument(),
    )
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body.channel).toBe('reddit')
  })

  it('shows the already-on-the-waitlist state when the server reports a returning email', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, returning: true }) }),
    )
    render(<WaitlistForm />)

    await fillAndConsent(user, 'traveler@example.com')
    await user.click(screen.getByRole('button', { name: /join waitlist/i }))

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /already on the waitlist/i })).toBeInTheDocument(),
    )
    expect(screen.getByRole('link', { name: /try the live planner/i })).toHaveAttribute(
      'href',
      '/plan',
    )
    expect(screen.queryByRole('link', { name: /take the 2-minute quiz/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /you.re on the list/i })).not.toBeInTheDocument()
  })

  it('rotates the session when a different email is submitted than the one already bound', async () => {
    bindEmail('first@example.com')
    const originalSid = getSession().sid

    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, returning: false }) }),
    )
    render(<WaitlistForm />)

    await fillAndConsent(user, 'second@example.com')
    await user.click(screen.getByRole('button', { name: /join waitlist/i }))

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /you.re on the list/i })).toBeInTheDocument(),
    )

    expect(getSession().sid).not.toBe(originalSid)
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body.sid).toBe(getSession().sid)
  })

  it('does not rotate the session when the same email is submitted again', async () => {
    bindEmail('same@example.com')
    const originalSid = getSession().sid

    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, returning: true }) }),
    )
    render(<WaitlistForm />)

    await fillAndConsent(user, 'same@example.com')
    await user.click(screen.getByRole('button', { name: /join waitlist/i }))

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /already on the waitlist/i })).toBeInTheDocument(),
    )

    expect(getSession().sid).toBe(originalSid)
  })

  it('shows only the explore-the-app CTA when the validation flag is off — no email field', () => {
    flag.validation = false
    render(<WaitlistForm />)

    expect(screen.getByRole('heading', { name: /try waypoint/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /try the live planner/i })).toHaveAttribute(
      'href',
      '/plan',
    )
    expect(screen.queryByLabelText(/^email$/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /join waitlist/i })).not.toBeInTheDocument()
  })

  it('shows an error state when the request fails, rather than a false success', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ ok: false }) }))
    render(<WaitlistForm />)

    await fillAndConsent(user, 'traveler@example.com')
    await user.click(screen.getByRole('button', { name: /join waitlist/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.queryByRole('heading', { name: /you.re on the list/i })).not.toBeInTheDocument()
  })
})
