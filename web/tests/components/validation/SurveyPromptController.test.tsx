// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import SurveyPromptController from '@/components/validation/SurveyPromptController'

const pathname = vi.hoisted(() => ({ current: '/result' }))
vi.mock('next/navigation', () => ({
  usePathname: () => pathname.current,
  useRouter: () => ({ push: vi.fn() }),
}))

const flag = vi.hoisted(() => ({ validation: true }))
vi.mock('@/lib/features', () => ({
  isEnabled: (f: string) => flag[f as keyof typeof flag],
}))

vi.mock('@/lib/validation/session', () => ({
  hasSession: () => true,
  getSession: () => ({ submittedAt: null, surveyPromptCount: 0 }),
  patchSession: vi.fn(),
}))

vi.mock('@/components/validation/SurveyPrompt', () => ({
  default: () => <div>SurveyPrompt placeholder</div>,
}))

const SURVEY_PROMPT_DWELL_MS = 120_000

beforeEach(() => {
  vi.useFakeTimers()
  pathname.current = '/result'
  flag.validation = true
})

afterEach(() => {
  vi.useRealTimers()
})

describe('SurveyPromptController', () => {
  it('opens the prompt after enough dwell time on an eligible page', () => {
    render(<SurveyPromptController />)
    act(() => {
      vi.advanceTimersByTime(SURVEY_PROMPT_DWELL_MS)
    })

    expect(screen.getByText('SurveyPrompt placeholder')).toBeInTheDocument()
  })

  // Without this, a visitor reading the marketing page via a /reddit,
  // /facebook, ... link — exactly the pages the channel test measures —
  // gets a modal thrown over the waitlist form, which the EXCLUDED_PATHS
  // comment already forbids for '/' itself.
  it('never opens the prompt on a channel attribution link, however long the dwell', () => {
    pathname.current = '/reddit'
    render(<SurveyPromptController />)
    act(() => {
      vi.advanceTimersByTime(SURVEY_PROMPT_DWELL_MS * 2)
    })

    expect(screen.queryByText('SurveyPrompt placeholder')).not.toBeInTheDocument()
  })

  it('does not open on an unlisted single-segment path either, once excluded', () => {
    pathname.current = '/promo'
    render(<SurveyPromptController />)
    act(() => {
      vi.advanceTimersByTime(SURVEY_PROMPT_DWELL_MS)
    })

    expect(screen.queryByText('SurveyPrompt placeholder')).not.toBeInTheDocument()
  })
})
