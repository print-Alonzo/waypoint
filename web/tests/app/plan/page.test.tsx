// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/components/plan/Selector', () => ({
  default: () => <div>Selector placeholder</div>,
}))

import PlanPage from '@/app/plan/page'

describe('app/plan/page', () => {
  it('renders the Selector inside a Suspense boundary', async () => {
    render(<PlanPage />)
    expect(await screen.findByText('Selector placeholder')).toBeInTheDocument()
  })
})
