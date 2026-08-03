// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CHANNELS } from '@/lib/validation/channels'

// next/link renders a plain anchor for assertion (no router context needed) —
// mirrors tests/app/page.test.tsx's setup, since ChannelPage renders the same
// LandingPage.
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === 'string' ? href : '#'} {...rest}>
      {children}
    </a>
  ),
}))

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
)
vi.mock('next/navigation', () => ({ notFound }))

import ChannelPage, { generateStaticParams } from '@/app/[channel]/page'

describe('generateStaticParams', () => {
  it('generates one static param per allowlisted channel', () => {
    const params = generateStaticParams()
    expect(params).toEqual(CHANNELS.map((channel) => ({ channel })))
  })
})

describe('app/[channel]/page', () => {
  it('renders the landing page for an allowlisted channel', async () => {
    const jsx = await ChannelPage({ params: Promise.resolve({ channel: 'reddit' }) })
    render(jsx)

    expect(
      screen.getByRole('heading', { level: 1, name: /your day, in the right order/i }),
    ).toBeInTheDocument()
    expect(notFound).not.toHaveBeenCalled()
  })

  it('calls notFound() for an unlisted slug', async () => {
    await expect(
      ChannelPage({ params: Promise.resolve({ channel: 'bogus' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
  })
})
