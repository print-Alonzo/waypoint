// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { CategoryGlyph } from '@/components/shared/CategoryGlyph'
import { CATEGORIES } from '@/lib/constants'

describe('CategoryGlyph', () => {
  it('renders a distinct path for every known category', () => {
    const paths = CATEGORIES.map((c) => {
      const { container } = render(<CategoryGlyph category={c.key} />)
      return container.querySelector('svg')!.innerHTML
    })
    expect(new Set(paths).size).toBe(CATEGORIES.length)
  })

  it('falls back to a plain circle for an unknown category', () => {
    const { container } = render(<CategoryGlyph category="nightlife" />)
    expect(container.querySelector('circle')).not.toBeNull()
    expect(container.querySelector('path')).toBeNull()
  })

  it('applies the className prop and hides from the accessibility tree', () => {
    const { container } = render(<CategoryGlyph category="park" className="h-4 w-4" />)
    const svg = container.querySelector('svg')!
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg.getAttribute('class')).toBe('h-4 w-4')
  })
})
