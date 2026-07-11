import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { CITY_LABEL, POI_MAP } from '@/lib/data'
import type { POI } from '@/lib/scheduler'
import { CATEGORIES, modeLabel, START_LOCATION_MAP } from '@/lib/constants'
import { encodeParams } from '@/lib/params'
import { PRESETS, presetHref } from '@/lib/presets'
import { isEnabled } from '@/lib/features'

// A hand-picked, photogenic subset for the landing hero cards (most POIs now have
// a photo, so we curate the few shown here rather than dumping the whole dataset).
const FEATURED_IDS = [
  'fort-santiago',
  'casa-manila',
  'national-museum-fine-arts',
  'paco-park',
  'manila-cathedral',
  'san-agustin-church',
]
const FEATURED: POI[] = FEATURED_IDS.map((id) => POI_MAP[id]).filter(
  (p): p is POI => Boolean(p && p.image),
)

function categoryLabel(key: string): string {
  return CATEGORIES.find((c) => c.key === key)?.label ?? key
}

// Tapping a featured place starts a plan with it pre-selected (all five params are
// required for the selector to pre-fill, so we pass sensible defaults).
function planHref(poiId: string): string {
  const qs = encodeParams({
    poi_ids: [poiId],
    start_time: '09:00',
    transport_mode: 'grab',
    start_location: 'rizal-park',
    day_of_week: 'Saturday',
  }).toString()
  return `/plan?${qs}`
}

export const metadata: Metadata = {
  title: 'Waypoint — plan a day in Metro Manila you can trust',
  description:
    'You pick the places; Waypoint optimizes the order of your day and shows its work — flagging anything closed or out of reach instead of quietly dropping it.',
}

// A ready-made example so visitors can see the output before committing.
const SAMPLE_ITINERARY =
  '/result?poi_ids=fort-santiago,casa-manila,manila-cathedral&start_time=09:00' +
  '&transport_mode=grab&start_location=rizal-park&day_of_week=Saturday'

const primaryCta =
  'inline-flex items-center justify-center rounded-lg bg-[var(--color-primary)] px-6 py-3.5 ' +
  'text-base font-bold text-white transition-colors hover:bg-[var(--color-primary-hover)]'
const secondaryCta =
  'inline-flex items-center justify-center rounded-lg border border-[var(--color-border)] px-6 py-3.5 ' +
  'text-base font-semibold transition-colors hover:bg-[var(--color-bg-subtle)]'

const STEPS = [
  {
    title: 'Pick your places',
    body: 'Browse Metro Manila’s heritage sites, museums, parks, markets, and churches, and check the ones you want to see.',
  },
  {
    title: 'We order your day',
    body: 'Waypoint arranges your picks into a sensible route — nearest-next, mindful of closing times. It only changes the order, never your choices.',
  },
  {
    title: 'See the why',
    body: 'Every stop shows your arrival time, a plain-language reason it landed there, and a clear flag if it’s closed that day or you’d arrive too late.',
  },
]

// Inline line-icons (no icon dependency, per the design system).
const iconClass = 'h-6 w-6'
const FEATURES = [
  {
    title: 'Nothing gets hidden',
    body: 'Closed or unreachable stops are flagged in plain sight — never silently removed or swapped for something else.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={iconClass} aria-hidden="true">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    title: 'Every stop, explained',
    body: 'A one-line reason for each stop’s position, drawn straight from the scheduler’s own decision — so it can’t claim something the algorithm didn’t do.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={iconClass} aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2Z" />
        <path d="M8 9h8M8 13h5" />
      </svg>
    ),
  },
  {
    title: 'See the route',
    body: 'Your stops appear as numbered pins on a live map, connected in visit order, so you can sanity-check that the day makes geographic sense.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={iconClass} aria-hidden="true">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
  {
    title: 'Take it anywhere',
    body: 'Copy your itinerary as text, download it as a calendar (.ics) file, or print it — flags and all. Every link is shareable.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={iconClass} aria-hidden="true">
        <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
        <path d="M16 6l-4-4-4 4M12 2v13" />
      </svg>
    ),
  },
]

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-3xl px-5 py-16 text-center sm:py-20">
        <p className="text-sm font-semibold uppercase tracking-wider text-[var(--color-primary)]">
          {CITY_LABEL} day planner
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          Your day, in the right order.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-[var(--color-text-muted)]">
          You choose the places. Waypoint sequences your day for less time on the road — and shows
          its work, flagging anything closed or out of reach instead of quietly dropping it.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/plan" className={primaryCta}>
            Plan my day →
          </Link>
          <Link href={SAMPLE_ITINERARY} className={secondaryCta}>
            See a sample day
          </Link>
        </div>

        {(isEnabled('groupVote') || isEnabled('comparePlans')) && (
          <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm">
            {isEnabled('groupVote') && (
              <Link
                href="/vote"
                className="font-semibold text-[var(--color-primary)] underline-offset-2 hover:underline"
              >
                Vote with friends
              </Link>
            )}
            {isEnabled('comparePlans') && (
              <Link
                href="/compare"
                className="font-semibold text-[var(--color-primary)] underline-offset-2 hover:underline"
              >
                Compare saved plans
              </Link>
            )}
          </div>
        )}

        {/* Route motif — echoes the result-page map (pin 3 amber = "check hours"). */}
        <svg
          viewBox="0 0 360 60"
          className="mx-auto mt-14 w-full max-w-sm"
          role="img"
          aria-label="A route connecting four numbered stops, with one flagged"
        >
          <line
            x1="24" y1="30" x2="336" y2="30"
            className="stroke-[var(--color-primary)]"
            strokeWidth={2.5}
            strokeDasharray="6 9"
            opacity={0.5}
          />
          {[
            { cx: 24, n: 1, cls: 'fill-[var(--color-primary)]' },
            { cx: 128, n: 2, cls: 'fill-[var(--color-primary)]' },
            { cx: 232, n: 3, cls: 'fill-[var(--color-flag-warning-border)]' },
            { cx: 336, n: 4, cls: 'fill-[var(--color-primary)]' },
          ].map((p) => (
            <g key={p.n}>
              <circle cx={p.cx} cy={30} r={15} className={`${p.cls} stroke-white`} strokeWidth={2.5} />
              <text
                x={p.cx} y={35} textAnchor="middle"
                className="fill-white" style={{ fontSize: 14, fontWeight: 700 }}
              >
                {p.n}
              </text>
            </g>
          ))}
        </svg>
      </section>

      {/* How it works — the numbered-dot + dashed-line motif echoes the hero's route
          graphic, so the page reads as one system rather than a stock feature grid. */}
      <section className="border-y border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
        <div className="mx-auto max-w-4xl px-5 py-14">
          <h2 className="text-center text-2xl font-bold tracking-tight">How it works</h2>
          <div className="relative mt-12">
            <span
              aria-hidden="true"
              className="absolute left-[16%] right-[16%] top-[18px] hidden border-t-2 border-dashed border-[var(--color-primary)]/30 sm:block"
            />
            <ol className="relative grid gap-8 sm:grid-cols-3 sm:gap-6">
              {STEPS.map((step, i) => (
                <li key={step.title}>
                  <span className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 font-bold">{step.title}</h3>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Why it's different — a plain two-column list (icon as a small inline glyph,
          not a colored badge) rather than a bordered feature-card grid. */}
      <section className="mx-auto max-w-4xl px-5 py-14">
        <h2 className="text-center text-2xl font-bold tracking-tight">
          Built on trust, not a black box
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-[var(--color-text-muted)]">
          Most planners decide everything for you and hide the rest. Waypoint optimizes only the
          order and shows all its work, so you stay in control.
        </p>
        <div className="mt-10 grid gap-x-8 gap-y-7 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex gap-3">
              <div className="mt-0.5 shrink-0 text-[var(--color-primary)]">{f.icon}</div>
              <div>
                <h3 className="font-bold">{f.title}</h3>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Featured places (Airbnb-style photo cards) */}
      <section className="mx-auto max-w-5xl px-5 pb-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight">Popular places to start with</h2>
          <p className="mx-auto mt-3 max-w-xl text-[var(--color-text-muted)]">
            Tap a place to begin a plan with it added — then pick as many more as you like.
          </p>
        </div>
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURED.map((poi) => (
            <li key={poi.id}>
              <Link
                href={planHref(poi.id)}
                className="group block overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--color-bg-subtle)]">
                  <Image
                    src={poi.image!}
                    alt={poi.name}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
                    {categoryLabel(poi.category)}
                  </p>
                  <h3 className="mt-1 font-bold">{poi.name}</h3>
                  <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
                    Open {poi.open_time}–{poi.close_time}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Ready-made days (presets) — one tap to a full, editable itinerary. */}
      {isEnabled('presets') && (
        <section className="mx-auto max-w-5xl px-5 py-12">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight">Or start from a ready-made day</h2>
            <p className="mx-auto mt-3 max-w-xl text-[var(--color-text-muted)]">
              Tap a themed day to see it laid out instantly — then tweak the order, pins, and
              details to make it yours.
            </p>
          </div>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PRESETS.map((preset) => {
              const start = START_LOCATION_MAP[preset.params.start_location]
              return (
                <li key={preset.id}>
                  <Link
                    href={presetHref(preset)}
                    className="group flex h-full flex-col rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <span aria-hidden className="text-2xl">
                      {preset.emoji}
                    </span>
                    <h3 className="mt-3 font-bold group-hover:text-[var(--color-primary)]">
                      {preset.title}
                    </h3>
                    <p className="mt-1 flex-1 text-sm text-[var(--color-text-muted)]">
                      {preset.blurb}
                    </p>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                      {preset.params.poi_ids.length} stops · {preset.params.day_of_week} ·{' '}
                      {modeLabel(preset.params.transport_mode)}
                      {start ? ` from ${start.name}` : ''}
                    </p>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* Final CTA */}
      <section className="border-t border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
        <div className="mx-auto max-w-3xl px-5 py-14 text-center">
          <h2 className="text-2xl font-bold tracking-tight">Ready to plan your day?</h2>
          <p className="mx-auto mt-2 max-w-md text-[var(--color-text-muted)]">
            Pick your places and get an ordered, fully-explained itinerary in seconds.
          </p>
          <div className="mt-6">
            <Link href="/plan" className={primaryCta}>
              Plan my day →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto max-w-4xl px-5 py-10 text-center text-sm text-[var(--color-text-muted)]">
        <p>
          Transit times are estimates — verify opening hours before you go. {CITY_LABEL} · a
          student project exploring trust through transparency.
        </p>
        <p className="mt-2">
          <Link href="/credits" className="underline underline-offset-2 hover:text-[var(--color-text)]">
            Photo credits
          </Link>
        </p>
      </footer>
    </div>
  )
}
