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

vi.mock('@/components/saved/SavedPlansView', () => ({
  default: () => <div>SavedPlansView placeholder</div>,
}))

import SavedPage from '@/app/saved/page'

afterEach(() => {
  redirect.mockClear()
  flag.comparePlans = true
})

describe('app/saved/page', () => {
  it('renders SavedPlansView when the comparePlans flag is on', () => {
    render(<SavedPage />)
    expect(screen.getByText('SavedPlansView placeholder')).toBeInTheDocument()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('redirects home instead of rendering when the comparePlans flag is off', () => {
    flag.comparePlans = false
    expect(() => render(<SavedPage />)).toThrow('NEXT_REDIRECT:/')
    expect(redirect).toHaveBeenCalledWith('/')
  })
})
