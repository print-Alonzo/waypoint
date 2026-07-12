// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import Credits from '@/app/credits/page'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === 'string' ? href : '#'} {...rest}>
      {children}
    </a>
  ),
}))

describe('credits page', () => {
  it('lists CC attribution for the landmark photos and links back home', () => {
    render(<Credits />)
    expect(screen.getByRole('heading', { name: /photo credits/i })).toBeInTheDocument()
    // One source link per photographed POI (we curated 23).
    expect(screen.getAllByRole('link', { name: /wikimedia commons/i }).length).toBeGreaterThanOrEqual(20)
    expect(screen.getByText(/fort santiago/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/')
  })
})
