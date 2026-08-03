// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import SiteHeader from '@/components/shared/SiteHeader'

const pathname = vi.hoisted(() => ({ current: '/' }))
vi.mock('next/navigation', () => ({
  usePathname: () => pathname.current,
}))

// Reset so a test added later can't silently inherit the previous one's route
// and pass for the wrong reason.
beforeEach(() => {
  pathname.current = '/'
})

describe('SiteHeader', () => {
  it('shows the landing nav and waitlist CTA on /', () => {
    pathname.current = '/'
    render(<SiteHeader />)

    expect(screen.getByRole('link', { name: /join waitlist/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /how it works/i })).toBeInTheDocument()
  })

  // Without this, a channel visitor lands on a page missing the primary
  // above-the-fold conversion element (the "Join waitlist" CTA) — exactly
  // the pages the channel test is trying to measure.
  it('shows the landing nav and waitlist CTA on a channel attribution link', () => {
    pathname.current = '/reddit'
    render(<SiteHeader />)

    expect(screen.getByRole('link', { name: /join waitlist/i })).toBeInTheDocument()
  })

  it('shows the app pill, not the landing nav, on a non-landing route', () => {
    pathname.current = '/plan'
    render(<SiteHeader />)

    expect(screen.queryByRole('link', { name: /join waitlist/i })).not.toBeInTheDocument()
    expect(screen.getByText('Metro Manila')).toBeInTheDocument()
  })

  it('shows the app pill for an unlisted single-segment path', () => {
    pathname.current = '/bogus'
    render(<SiteHeader />)

    expect(screen.queryByRole('link', { name: /join waitlist/i })).not.toBeInTheDocument()
  })
})
