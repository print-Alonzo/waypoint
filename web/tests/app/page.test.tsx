// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// next/link renders a plain anchor for assertion (no router context needed).
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === 'string' ? href : '#'} {...rest}>
      {children}
    </a>
  ),
}))

// The landing page now mounts ChannelCapture, whose effect writes a real
// localStorage session and POSTs a `landed` beacon. track() swallows the
// failure, so an unstubbed network call would go unnoticed in what is meant
// to be a pure markup test. Covered properly in LandingPage.test.tsx.
vi.mock('@/components/landing/ChannelCapture', () => ({ default: () => null }))

import Home from '@/app/page'

describe('landing page', () => {
  it('leads with the thesis headline and a "how it works" section', () => {
    render(<Home />)
    expect(
      screen.getByRole('heading', { level: 1, name: /your day, in the right order/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /how it works/i })).toBeInTheDocument()
  })

  it('leads with a waitlist CTA rather than a straight-to-app one', () => {
    render(<Home />)
    const heroCta = screen.getByRole('link', { name: /join the waitlist/i })
    expect(heroCta).toHaveAttribute('href', '#waitlist')
  })

  it('exposes an anchor target for every section the header nav links to', () => {
    const { container } = render(<Home />)
    ;['#how-it-works', '#features', '#roadmap', '#feedback', '#waitlist'].forEach((id) => {
      expect(container.querySelector(id)).not.toBeNull()
    })
  })

  it('explains the steps and the trust differentiators', () => {
    render(<Home />)
    expect(screen.getByRole('heading', { name: /pick your places/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /we order your day/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /see the why/i })).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: /nothing gets hidden/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /every stop, explained/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /see the route/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /take it anywhere/i })).toBeInTheDocument()
  })

  it('lays out a roadmap of not-yet-built features, each marked "Coming soon"', () => {
    render(<Home />)
    expect(screen.getByRole('heading', { name: /where waypoint is headed/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /google maps & calendar/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /verified partner data/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /multi-city trips/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /group trip voting/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /real-time transit/i })).toBeInTheDocument()
    expect(screen.getAllByText(/coming soon/i)).toHaveLength(5)
  })

  it('shows real usability-round quotes rather than placeholder testimonials', () => {
    render(<Home />)
    expect(
      screen.getByRole('heading', { name: /what early testers are saying/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/three participants, july 2026/i)).toBeInTheDocument()
    expect(screen.getByText(/proximity of the locations/i)).toBeInTheDocument()
    expect(screen.getByText(/double check lang just to make sure/i)).toBeInTheDocument()
    expect(screen.getByText(/it.s a nice thing actually/i)).toBeInTheDocument()
    expect(screen.getAllByText(/meticulous router/i)).toHaveLength(3)
  })

  it('offers the waitlist form and, in the footer, the required photo credits link', () => {
    render(<Home />)
    expect(screen.getByRole('heading', { name: /get early access/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /photo credits/i })).toHaveAttribute(
      'href',
      '/credits',
    )
  })
})
