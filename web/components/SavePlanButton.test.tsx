// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import SavePlanButton from './SavePlanButton'
import { listSavedPlans } from '@/lib/saved-plans'

// next/link renders a plain anchor for assertion (no router context needed).
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === 'string' ? href : '#'} {...rest}>
      {children}
    </a>
  ),
}))

beforeEach(() => {
  localStorage.clear()
})

describe('SavePlanButton', () => {
  it('opens an inline field pre-filled with the default name', () => {
    render(<SavePlanButton query="poi_ids=a" defaultName="Saturday · 3 stops · Grab" />)
    fireEvent.click(screen.getByRole('button', { name: /save this plan/i }))
    expect(screen.getByRole('textbox')).toHaveValue('Saturday · 3 stops · Grab')
  })

  it('saves under a custom name when confirmed', () => {
    render(<SavePlanButton query="poi_ids=a" defaultName="Saturday · 3 stops · Grab" />)
    fireEvent.click(screen.getByRole('button', { name: /save this plan/i }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Rainy day plan' } })
    fireEvent.click(screen.getByRole('button', { name: /confirm plan name/i }))

    expect(listSavedPlans().map((p) => p.name)).toEqual(['Rainy day plan'])
    expect(screen.getByText('Saved ✓')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /compare/i })).toHaveAttribute('href', '/compare')
  })

  it('submits on Enter', () => {
    render(<SavePlanButton query="poi_ids=a" defaultName="Saturday · 3 stops · Grab" />)
    fireEvent.click(screen.getByRole('button', { name: /save this plan/i }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Ambitious plan' } })
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })

    expect(listSavedPlans().map((p) => p.name)).toEqual(['Ambitious plan'])
  })

  it('cancels without saving and returns to idle', () => {
    render(<SavePlanButton query="poi_ids=a" defaultName="Saturday · 3 stops · Grab" />)
    fireEvent.click(screen.getByRole('button', { name: /save this plan/i }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Discarded name' } })
    fireEvent.click(screen.getByRole('button', { name: /cancel saving/i }))

    expect(listSavedPlans()).toHaveLength(0)
    expect(screen.getByRole('button', { name: /save this plan/i })).toBeInTheDocument()
  })

  it('cancels on Escape', () => {
    render(<SavePlanButton query="poi_ids=a" defaultName="Saturday · 3 stops · Grab" />)
    fireEvent.click(screen.getByRole('button', { name: /save this plan/i }))
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' })

    expect(listSavedPlans()).toHaveLength(0)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('falls back to the default name when the field is cleared', () => {
    render(<SavePlanButton query="poi_ids=a" defaultName="Saturday · 3 stops · Grab" />)
    fireEvent.click(screen.getByRole('button', { name: /save this plan/i }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: /confirm plan name/i }))

    expect(listSavedPlans().map((p) => p.name)).toEqual(['Saturday · 3 stops · Grab'])
  })
})
