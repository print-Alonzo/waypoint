import type { ReactNode } from 'react'

// Simple line-icon per category for the placeholder tile (no icon dependency).
// Used by both the selector grid and the swipe deck when a POI has no photo.
const CATEGORY_ICON: Record<string, ReactNode> = {
  heritage: <path d="M3 21h18M5 21V8l7-4 7 4v13M9 21v-6h6v6" />,
  museum: <path d="M3 21h18M4 10h16M5 10 12 4l7 6M6 10v8M10 10v8M14 10v8M18 10v8" />,
  park: <path d="M12 22v-5M7 13a5 5 0 0 1 10 0 4 4 0 0 1-1 8H8a4 4 0 0 1-1-8Z" />,
  market: <path d="M6 8h12l-1 12H7L6 8ZM9 8a3 3 0 0 1 6 0" />,
  church: <path d="M12 2v6M9 5h6M5 22V10l7-3 7 3v12M9 22v-5a3 3 0 0 1 6 0v5" />,
}

export function CategoryGlyph({
  category,
  className = 'h-9 w-9',
}: {
  category: string
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {CATEGORY_ICON[category] ?? <circle cx="12" cy="12" r="8" />}
    </svg>
  )
}
