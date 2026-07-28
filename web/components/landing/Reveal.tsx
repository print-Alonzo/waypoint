'use client'

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react'
import { usePrefersReducedMotion } from '@/lib/hooks/use-reduced-motion'

const REVEAL_THRESHOLD = 0.15
// An element whose top starts past 85% of the viewport height on mount hasn't
// been seen yet, so it's safe to animate in. Anything above that line is
// already visible (or about to be) — hiding it would risk a flash of
// invisible content if the observer is slow to fire.
const BELOW_FOLD_RATIO = 0.85

type RevealProps = {
  as?: 'div' | 'section' | 'footer'
  delayMs?: number
  className?: string
  id?: string
  children: ReactNode
}

// Fades + rises landing sections into view on scroll — the one place on the
// site with decorative motion (everywhere else, motion is functional only; see
// DESIGN.md § Motion). Deliberately fails open: renders fully visible with no
// inline style at all until an effect proves animating is both safe and
// worthwhile, so a slow/disabled JS environment never leaves content hidden.
export default function Reveal({ as = 'div', delayMs = 0, className, id, children }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null)
  const [hidden, setHidden] = useState(false)
  const [armed, setArmed] = useState(false)
  const prefersReducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion || typeof IntersectionObserver === 'undefined') return
    if (el.getBoundingClientRect().top <= window.innerHeight * BELOW_FOLD_RATIO) return

    // Snap to hidden first (armed stays false, so this transition is instant —
    // the element is off-screen, so there's nothing to see snap), then arm
    // transitions on the next frame so the later reveal actually glides.
    setHidden(true)
    const raf = requestAnimationFrame(() => setArmed(true))

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setHidden(false)
        observer.disconnect()
      },
      { threshold: REVEAL_THRESHOLD },
    )
    observer.observe(el)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
    // Intentionally mount-only: the fold check only means something once, before the visitor has scrolled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const Tag = as as ElementType

  return (
    <Tag
      ref={ref}
      id={id}
      className={className}
      style={{
        opacity: hidden ? 0 : 1,
        transform: hidden ? 'translateY(28px)' : 'none',
        transitionProperty: 'opacity, transform',
        transitionDuration: armed ? 'calc(var(--motion-base) * 3)' : '0s',
        transitionTimingFunction: 'var(--ease-standard)',
        transitionDelay: `${delayMs}ms`,
      }}
    >
      {children}
    </Tag>
  )
}
