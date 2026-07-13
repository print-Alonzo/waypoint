// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const flag = vi.hoisted(() => ({ comparePlans: true }))
vi.mock('@/lib/features', () => ({
  isEnabled: (f: string) => flag[f as keyof typeof flag],
}))

const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
)
vi.mock('next/navigation', () => ({ redirect }))

vi.mock('@/components/compare/CompareView', () => ({
  default: () => <div>CompareView placeholder</div>,
}))

import ComparePage from '@/app/compare/page'

afterEach(() => {
  redirect.mockClear()
  flag.comparePlans = true
})

describe('app/compare/page', () => {
  it('renders CompareView when the comparePlans flag is on', () => {
    render(<ComparePage />)
    expect(screen.getByText('CompareView placeholder')).toBeInTheDocument()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('redirects home instead of rendering when the comparePlans flag is off', () => {
    flag.comparePlans = false
    expect(() => render(<ComparePage />)).toThrow('NEXT_REDIRECT:/')
    expect(redirect).toHaveBeenCalledWith('/')
  })
})
