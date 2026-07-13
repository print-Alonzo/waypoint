// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/components/admin/AdminDashboard', () => ({
  default: ({ initialPois }: { initialPois: { id: string }[] }) => (
    <div>AdminDashboard placeholder ({initialPois.length} places)</div>
  ),
}))

import AdminPage from '@/app/admin/page'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('app/admin/page', () => {
  it('renders the AdminDashboard with the full POI catalog when running locally', () => {
    render(<AdminPage />)
    expect(screen.getByText(/AdminDashboard placeholder/)).toBeInTheDocument()
  })

  it('shows a "runs locally" notice instead of the dashboard when deployed to Vercel', () => {
    vi.stubEnv('VERCEL', '1')
    render(<AdminPage />)
    expect(screen.getByText(/admin runs locally/i)).toBeInTheDocument()
    expect(screen.queryByText(/AdminDashboard placeholder/)).not.toBeInTheDocument()
  })
})
