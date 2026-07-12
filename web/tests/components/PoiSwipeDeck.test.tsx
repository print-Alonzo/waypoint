// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import PoiSwipeDeck from '@/components/PoiSwipeDeck'
import type { POI } from '@/lib/scheduling/scheduler'

// next/image -> plain img so the deck renders in jsdom.
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

function poi(id: string, name: string): POI {
  return {
    id,
    name,
    category: 'heritage',
    lat: 0,
    lng: 0,
    open_time: '09:00',
    close_time: '17:00',
    closed_days: [],
    recommended_duration_minutes: 60,
    notes: null,
  } as POI
}

const POIS = [poi('a', 'Alpha'), poi('b', 'Bravo'), poi('c', 'Charlie')]

// Harness that owns selection state, mirroring how Selector wires the deck.
function Harness() {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  return (
    <>
      <div data-testid="selected">{[...selected].sort().join(',')}</div>
      <PoiSwipeDeck
        pois={POIS}
        isSelected={(id) => selected.has(id)}
        setSelected={(id, value) =>
          setSelected((prev) => {
            const next = new Set(prev)
            if (value) next.add(id)
            else next.delete(id)
            return next
          })
        }
        categoryLabel={() => 'Heritage'}
      />
    </>
  )
}

describe('PoiSwipeDeck', () => {
  it('adds with ✓, skips with ✕, and advances the deck', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    expect(screen.getByText('1 of 3')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Alpha' })).toBeInTheDocument()

    // Add Alpha
    await user.click(screen.getByRole('button', { name: /add alpha to plan/i }))
    await waitFor(() => expect(screen.getByTestId('selected')).toHaveTextContent('a'))
    await waitFor(() => expect(screen.getByText('2 of 3')).toBeInTheDocument())
    expect(screen.getByText('1 added')).toBeInTheDocument()

    // Skip Bravo — should not be added
    await user.click(screen.getByRole('button', { name: /skip bravo/i }))
    await waitFor(() => expect(screen.getByText('3 of 3')).toBeInTheDocument())
    expect(screen.getByTestId('selected')).toHaveTextContent('a')
    expect(screen.getByText('1 added')).toBeInTheDocument()
  })

  it('undo reverts the last decision and steps back', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: /add alpha to plan/i }))
    await waitFor(() => expect(screen.getByText('2 of 3')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /undo last decision/i }))
    await waitFor(() => expect(screen.getByText('1 of 3')).toBeInTheDocument())
    expect(screen.getByTestId('selected')).toHaveTextContent('')
    expect(screen.getByText('0 added')).toBeInTheDocument()
  })

  it('shows an end state after the last card', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: /skip alpha/i }))
    await waitFor(() => expect(screen.getByText('2 of 3')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /skip bravo/i }))
    await waitFor(() => expect(screen.getByText('3 of 3')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /skip charlie/i }))

    await waitFor(() => expect(screen.getByText(/you.?ve seen every place/i)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /start over/i })).toBeInTheDocument()
  })
})
