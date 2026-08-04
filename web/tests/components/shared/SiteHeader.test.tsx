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
  it('shows the landing nav and early-access CTA on /', () => {
    pathname.current = '/'
    render(<SiteHeader />)

    expect(screen.getByRole('link', { name: /get early access/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /how it works/i })).toBeInTheDocument()
  })

  // Channel links render the quiz now, not the landing. The nav's four anchors
  // and the CTA all point at landing sections, so showing them here would put
  // five links on the page that scroll nowhere.
  it('shows the app pill, not the landing nav, on a channel attribution link', () => {
    pathname.current = '/reddit'
    render(<SiteHeader />)

    expect(screen.queryByRole('link', { name: /get early access/i })).not.toBeInTheDocument()
    expect(screen.getByText('Metro Manila')).toBeInTheDocument()
  })

  it('shows the app pill, not the landing nav, on a non-landing route', () => {
    pathname.current = '/plan'
    render(<SiteHeader />)

    expect(screen.queryByRole('link', { name: /get early access/i })).not.toBeInTheDocument()
    expect(screen.getByText('Metro Manila')).toBeInTheDocument()
  })

  it('shows the app pill for an unlisted single-segment path', () => {
    pathname.current = '/bogus'
    render(<SiteHeader />)

    expect(screen.queryByRole('link', { name: /get early access/i })).not.toBeInTheDocument()
  })
})
