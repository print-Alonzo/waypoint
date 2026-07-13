// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const shouldThrow = vi.hoisted(() => ({ value: false }))
vi.mock('@/components/result/ResultView', () => ({
  default: () => {
    if (shouldThrow.value) throw new Error('boom')
    return <div>ResultView placeholder</div>
  },
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === 'string' ? href : '#'} {...rest}>
      {children}
    </a>
  ),
}))

import ResultPage from '@/app/result/page'

describe('app/result/page', () => {
  it('renders ResultView inside Suspense + ErrorBoundary', async () => {
    shouldThrow.value = false
    render(<ResultPage />)
    expect(await screen.findByText('ResultView placeholder')).toBeInTheDocument()
  })

  it('falls back to the error boundary UI when ResultView throws', () => {
    shouldThrow.value = true
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ResultPage />)
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    spy.mockRestore()
    shouldThrow.value = false
  })
})
