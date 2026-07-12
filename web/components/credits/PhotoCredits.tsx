import type { POI } from '@/lib/scheduling/scheduler'

// CC attribution list for the landmark photos. Plain (no hooks / no 'use client')
// so any route can render it. Lives on the dedicated /credits page; the main pages
// only carry a small footer link to it. Required wherever CC BY / BY-SA images appear.
export default function PhotoCredits({ pois }: { pois: POI[] }) {
  const credited = pois.filter((p) => p.image_credit)
  if (credited.length === 0) return null

  return (
    <ul className="space-y-2 text-sm text-[var(--color-text-muted)]">
      {credited.map((poi) => {
        const c = poi.image_credit!
        return (
          <li key={poi.id}>
            <span className="font-medium text-[var(--color-text)]">{poi.name}</span> — photo by{' '}
            {c.author},{' '}
            {c.license_url ? (
              <a
                href={c.license_url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                {c.license}
              </a>
            ) : (
              c.license
            )}
            , via{' '}
            <a
              href={c.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              Wikimedia Commons
            </a>
          </li>
        )
      })}
    </ul>
  )
}
