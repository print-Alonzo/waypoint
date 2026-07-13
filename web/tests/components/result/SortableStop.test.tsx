// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import SortableStop, { REORDER_MS } from '@/components/result/SortableStop'

function renderStop(props: Partial<React.ComponentProps<typeof SortableStop>> = {}) {
  return render(
    <DndContext>
      <SortableContext items={['a', 'b']} strategy={verticalListSortingStrategy}>
        <ul>
          <SortableStop
            id="a"
            cardClassName="wp-flag-yellow"
            reduceMotion={false}
            lead={<span>Lead content</span>}
            {...props}
          >
            {(drag) => (
              <div>
                <span>Card a</span>
                <button {...(drag.listeners as Record<string, never>)}>grip</button>
                <span data-testid="is-dragging">{String(drag.isDragging)}</span>
              </div>
            )}
          </SortableStop>
        </ul>
      </SortableContext>
    </DndContext>,
  )
}

describe('SortableStop', () => {
  it('exports the shared reorder animation duration', () => {
    expect(REORDER_MS).toBe(220)
  })

  it('renders the lead content above the card and the card children', () => {
    renderStop()
    expect(screen.getByText('Lead content')).toBeInTheDocument()
    expect(screen.getByText('Card a')).toBeInTheDocument()
  })

  it('passes drag listeners and isDragging down to children', () => {
    renderStop()
    expect(screen.getByRole('button', { name: 'grip' })).toBeInTheDocument()
    expect(screen.getByTestId('is-dragging')).toHaveTextContent('false')
  })

  it('applies the given cardClassName to the sortable node', () => {
    const { container } = renderStop({ cardClassName: 'wp-flag-red' })
    expect(container.querySelector('.wp-flag-red')).not.toBeNull()
  })

  it('marks the card data-landed when landed is true and not dragging', () => {
    const { container } = renderStop({ landed: true })
    expect(container.querySelector('[data-landed]')).not.toBeNull()
  })

  it('omits data-landed when landed is false', () => {
    const { container } = renderStop({ landed: false })
    expect(container.querySelector('[data-landed]')).toBeNull()
  })
})
