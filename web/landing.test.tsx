// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import Home from '@/app/page'

// next/link renders a plain anchor for assertion (no router context needed).
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === 'string' ? href : '#'} {...rest}>
      {children}
    </a>
  ),
}))

// next/image → plain img so `alt`/`src` are assertable without the optimizer.
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

describe('landing page', () => {
  it('leads with the thesis headline and a "how it works" section', () => {
    render(<Home />)
    expect(
      screen.getByRole('heading', { level: 1, name: /your day, in the right order/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /how it works/i })).toBeInTheDocument()
  })

  it('routes every "Plan my day" CTA to /plan', () => {
    render(<Home />)
    const planLinks = screen.getAllByRole('link', { name: /plan my day/i })
    expect(planLinks.length).toBeGreaterThanOrEqual(1)
    planLinks.forEach((l) => expect(l).toHaveAttribute('href', '/plan'))
  })

  it('offers a sample itinerary that deep-links into /result', () => {
    render(<Home />)
    const sample = screen.getByRole('link', { name: /sample day/i })
    expect(sample.getAttribute('href')).toMatch(/^\/result\?/)
  })

  it('explains the steps and the trust differentiators', () => {
    render(<Home />)
    // Scope to headings — "Pick your places" also appears in the final-CTA copy.
    expect(screen.getByRole('heading', { name: /pick your places/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /we order your day/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /nothing gets hidden/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /every stop, explained/i })).toBeInTheDocument()
  })

  it('shows featured place photos that deep-link into /plan, with photo credits', () => {
    render(<Home />)
    expect(screen.getByRole('heading', { name: /popular places to start/i })).toBeInTheDocument()
    // Featured cards render a photo and link to a prefilled /plan.
    const fort = screen.getByRole('img', { name: /fort santiago/i })
    expect(fort).toHaveAttribute('src', '/images/poi/fort-santiago.jpg')
    const card = fort.closest('a')
    expect(card?.getAttribute('href')).toMatch(/^\/plan\?.*poi_ids=fort-santiago/)
    // Attribution now lives on a dedicated page; the landing only links to it.
    expect(screen.getByRole('link', { name: /photo credits/i })).toHaveAttribute('href', '/credits')
  })
})
