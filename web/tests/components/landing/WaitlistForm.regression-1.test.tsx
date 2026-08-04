// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WaitlistForm from '@/components/landing/WaitlistForm'

// Regression: ISSUE-001 — a valid email with the consent box unticked left
// "Sign me up" disabled with no hint, no aria-describedby and no error, so the
// visitor had no way to know what was blocking them. The consent box renders
// *below* the button, so reading order never reaches it on its own.
// Found by /qa on 2026-08-04
// Report: .gstack/qa-reports/qa-report-localhost-2026-08-04.md

const flag = vi.hoisted(() => ({ validation: true }))
vi.mock('@/lib/features', () => ({
  isEnabled: (f: string) => flag[f as keyof typeof flag],
}))

beforeEach(() => {
  localStorage.clear()
})

const HINT = /tick the box below to continue/i

describe('WaitlistForm consent hint (ISSUE-001)', () => {
  it('names the blocker once the email is valid but consent is missing', async () => {
    const user = userEvent.setup()
    render(<WaitlistForm />)

    await user.type(screen.getByLabelText(/^email$/i), 'traveler@example.com')

    const hint = screen.getByText(HINT)
    const submit = screen.getByRole('button', { name: /sign me up/i })

    expect(submit).toBeDisabled()
    // The button is the thing that looks broken, so the explanation has to be
    // programmatically attached to it, not merely nearby.
    expect(submit).toHaveAttribute('aria-describedby', hint.id)
    // `disabled` removes the button from the tab order, so a screen-reader user
    // never lands on it to hear aria-describedby — the hint must announce itself.
    expect(hint).toHaveAttribute('role', 'status')
  })

  it('stays quiet while the email is still being typed', async () => {
    const user = userEvent.setup()
    render(<WaitlistForm />)

    // Nothing entered yet: nagging before there's a real blocker is its own bug.
    expect(screen.queryByText(HINT)).not.toBeInTheDocument()

    await user.type(screen.getByLabelText(/^email$/i), 'traveler@')
    expect(screen.queryByText(HINT)).not.toBeInTheDocument()

    await user.type(screen.getByLabelText(/^email$/i), 'example.com')
    expect(screen.getByText(HINT)).toBeInTheDocument()
  })

  it('clears the hint and the description once consent is given', async () => {
    const user = userEvent.setup()
    render(<WaitlistForm />)

    await user.type(screen.getByLabelText(/^email$/i), 'traveler@example.com')
    expect(screen.getByText(HINT)).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox'))

    const submit = screen.getByRole('button', { name: /sign me up/i })
    expect(screen.queryByText(HINT)).not.toBeInTheDocument()
    expect(submit).toBeEnabled()
    expect(submit).not.toHaveAttribute('aria-describedby')
  })

  it('does not point at consent when the email itself is the problem', async () => {
    const user = userEvent.setup()
    render(<WaitlistForm />)

    // Consent given, email malformed: the hint would be actively misleading here.
    await user.click(screen.getByRole('checkbox'))
    await user.type(screen.getByLabelText(/^email$/i), 'not-an-email')

    expect(screen.queryByText(HINT)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign me up/i })).toBeDisabled()
  })
})
