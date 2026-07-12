import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// @dnd-kit/core measures droppables with ResizeObserver, which jsdom doesn't
// implement — without this stub every ResultView suite throws on render.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

// lib/hooks/use-reduced-motion.ts reads matchMedia; jsdom's support is partial. The
// stub reports "motion is fine", so tests exercise the animated code path.
// Guarded on `window`: this setup file also runs for the node-env lib suites.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

afterEach(() => {
  cleanup()
})
