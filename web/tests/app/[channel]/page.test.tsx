// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CHANNELS, isChannel } from '@/lib/validation/channels'

// next/link renders a plain anchor for assertion (no router context needed) —
// mirrors tests/app/page.test.tsx's setup, since the flag-off branch renders
// the same LandingPage.
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === 'string' ? href : '#'} {...rest}>
      {children}
    </a>
  ),
}))

// ChannelCapture renders null — record its prop to prove the slug is threaded
// down rather than a hardcoded null.
const captured = vi.hoisted(() => ({ channels: [] as (string | null)[] }))
vi.mock('@/components/landing/ChannelCapture', () => ({
  default: ({ channel }: { channel: string | null }) => {
    captured.channels.push(channel)
    return null
  },
}))

// Stubbed: QuizView is covered by its own test, and it needs router context
// this route-level test has no reason to stand up.
vi.mock('@/components/quiz/QuizView', () => ({
  default: () => <div data-testid="quiz-view" />,
}))

const flag = vi.hoisted(() => ({ validation: true }))
vi.mock('@/lib/features', () => ({
  isEnabled: (f: string) => flag[f as keyof typeof flag],
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

afterEach(() => {
  flag.validation = true
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

  // Attribution links, not destinations worth indexing — and the flag-off
  // branch does render the same content as '/', a duplicate-content hit.
  it('keeps channel links out of the search index', () => {
    expect(metadata.robots).toEqual({ index: false, follow: true })
  })

  it('otherwise reuses the shared landing metadata', () => {
    expect(metadata.title).toMatch(/waypoint/i)
  })
})

describe('app/[channel]/page', () => {
  // The inversion itself: recruited visitors meet the quiz, not an email ask
  // they have no reason to say yes to yet.
  it('renders the quiz, not the landing page, for an allowlisted channel', async () => {
    const jsx = await ChannelPage({ params: Promise.resolve({ channel: 'reddit' }) })
    render(jsx)

    expect(screen.getByTestId('quiz-view')).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { level: 1, name: /your day, in the right order/i }),
    ).not.toBeInTheDocument()
    expect(notFound).not.toHaveBeenCalled()
  })

  // Study over: /quiz redirects to '/', so these links must not lead there.
  it('falls back to the landing page when the validation flag is off', async () => {
    flag.validation = false
    const jsx = await ChannelPage({ params: Promise.resolve({ channel: 'reddit' }) })
    render(jsx)

    expect(
      screen.getByRole('heading', { level: 1, name: /your day, in the right order/i }),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('quiz-view')).not.toBeInTheDocument()
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
