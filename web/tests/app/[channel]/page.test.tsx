// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CHANNELS, isChannel } from '@/lib/validation/channels'

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

// LandingPage stays real (so this covers the integration), but ChannelCapture
// renders null — record its prop to prove the slug is threaded down rather
// than a hardcoded null.
const captured = vi.hoisted(() => ({ channels: [] as (string | null)[] }))
vi.mock('@/components/landing/ChannelCapture', () => ({
  default: ({ channel }: { channel: string | null }) => {
    captured.channels.push(channel)
    return null
  },
}))

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
)
vi.mock('next/navigation', () => ({ notFound }))

import ChannelPage, { generateStaticParams, metadata, dynamicParams } from '@/app/[channel]/page'

beforeEach(() => {
  captured.channels.length = 0
  notFound.mockClear()
})

describe('generateStaticParams', () => {
  it('generates one static param per allowlisted channel', () => {
    const params = generateStaticParams()
    expect(params).toEqual(CHANNELS.map((channel) => ({ channel })))
  })

  // Adding a channel to channels.ts must be the only edit needed. Asserting a
  // length here would be a tautology (the impl is a .map over CHANNELS) — the
  // meaningful check is that every generated slug actually survives the
  // route's own runtime guard.
  it('generates only slugs the route guard will accept', () => {
    for (const { channel } of generateStaticParams()) {
      expect(isChannel(channel)).toBe(true)
    }
  })
})

describe('route config', () => {
  it('404s params outside generateStaticParams rather than rendering them', () => {
    expect(dynamicParams).toBe(false)
  })

  // These render the same content as '/', so indexing them would be a
  // duplicate-content hit — and a silent one, since nothing user-visible breaks.
  it('keeps channel links out of the search index', () => {
    expect(metadata.robots).toEqual({ index: false, follow: true })
  })

  it('otherwise reuses the shared landing metadata', () => {
    expect(metadata.title).toMatch(/waypoint/i)
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

  it('threads its own slug down to ChannelCapture, not a hardcoded null', async () => {
    const jsx = await ChannelPage({ params: Promise.resolve({ channel: 'reddit' }) })
    render(jsx)

    expect(captured.channels).toEqual(['reddit'])
  })

  it('threads each allowlisted slug independently', async () => {
    const jsx = await ChannelPage({ params: Promise.resolve({ channel: 'promo' }) })
    render(jsx)

    expect(captured.channels).toEqual(['promo'])
  })

  it('calls notFound() for an unlisted slug', async () => {
    await expect(ChannelPage({ params: Promise.resolve({ channel: 'bogus' }) })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    )
    expect(notFound).toHaveBeenCalled()
  })

  // dynamicParams=false 404s unknown slugs in production, but under `next dev`
  // the prerender manifest is empty and they fall through and render.
  it('guards in code, not only via dynamicParams, so dev matches prod', async () => {
    await expect(ChannelPage({ params: Promise.resolve({ channel: 'ads' }) })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    )
    expect(captured.channels).toEqual([])
  })
})
