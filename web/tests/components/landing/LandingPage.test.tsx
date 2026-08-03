// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import LandingPage, { landingMetadata } from '@/components/landing/LandingPage'

// next/link renders a plain anchor for assertion (no router context needed).
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === 'string' ? href : '#'} {...rest}>
      {children}
    </a>
  ),
}))

// ChannelCapture renders null, so nothing in the DOM proves it was mounted —
// record the prop it receives instead.
const captured = vi.hoisted(() => ({ channels: [] as (string | null)[] }))
vi.mock('@/components/landing/ChannelCapture', () => ({
  default: ({ channel }: { channel: string | null }) => {
    captured.channels.push(channel)
    return null
  },
}))

beforeEach(() => {
  captured.channels.length = 0
})

describe('LandingPage', () => {
  // The whole channel test's denominator hangs off this one line. Because
  // ChannelCapture renders null, deleting it from LandingPage broke nothing
  // in the suite before this test existed.
  it('mounts ChannelCapture so every landing view is counted', () => {
    render(<LandingPage />)
    expect(captured.channels).toHaveLength(1)
  })

  it('defaults to a null channel, which the report buckets as direct traffic', () => {
    render(<LandingPage />)
    expect(captured.channels).toEqual([null])
  })

  it('passes an explicit channel straight through', () => {
    render(<LandingPage channel="reddit" />)
    expect(captured.channels).toEqual(['reddit'])
  })

  it('renders the same landing content regardless of channel', () => {
    render(<LandingPage channel="facebook" />)
    expect(
      screen.getByRole('heading', { level: 1, name: /your day, in the right order/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /join the waitlist/i })).toHaveAttribute(
      'href',
      '#waitlist',
    )
  })

  it('exports the shared metadata both routes reuse', () => {
    expect(landingMetadata.title).toMatch(/waypoint/i)
    expect(landingMetadata.description).toBeTruthy()
  })
})
