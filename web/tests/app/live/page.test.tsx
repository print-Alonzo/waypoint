// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const flag = vi.hoisted(() => ({ liveMode: true }))
vi.mock('@/lib/features', () => ({
  isEnabled: (f: string) => flag[f as keyof typeof flag],
}))

const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
)
vi.mock('next/navigation', () => ({ redirect }))

vi.mock('@/components/live/LiveView', () => ({
  default: () => <div>LiveView placeholder</div>,
}))

import LivePage from '@/app/live/page'

afterEach(() => {
  redirect.mockClear()
  flag.liveMode = true
})

describe('app/live/page', () => {
  it('renders LiveView when the liveMode flag is on', async () => {
    render(<LivePage />)
    expect(await screen.findByText('LiveView placeholder')).toBeInTheDocument()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('redirects home instead of rendering when the liveMode flag is off', () => {
    flag.liveMode = false
    expect(() => render(<LivePage />)).toThrow('NEXT_REDIRECT:/')
    expect(redirect).toHaveBeenCalledWith('/')
  })
})
