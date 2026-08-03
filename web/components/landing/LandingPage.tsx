import Link from 'next/link'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { CITY_LABEL } from '@/lib/poi/data'
import Reveal from '@/components/landing/Reveal'
import SmoothAnchorNav from '@/components/landing/SmoothAnchorNav'
import WaitlistForm from '@/components/landing/WaitlistForm'
import ChannelCapture from '@/components/landing/ChannelCapture'
import type { Channel } from '@/lib/validation/channels'

export const landingMetadata: Metadata = {
  title: 'Waypoint — join the waitlist for a Metro Manila day planner you can trust',
  description:
    'Waypoint sequences the order of your day across Metro Manila and shows its work — flagging anything closed or out of reach instead of quietly dropping it. Join the waitlist for early access.',
}

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

// Planned-not-yet-built features. Kept separate from FEATURES above (which are
// shipping today) so the "Coming soon" framing is never ambiguous.
const ROADMAP = [
  {
    title: 'Google Maps & Calendar',
    body: 'Open your finished itinerary as turn-by-turn directions in Google Maps, or add every stop straight to Google Calendar with its time and place.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={iconClass} aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="8" y1="3" x2="8" y2="7" />
        <line x1="16" y1="3" x2="16" y2="7" />
        <path d="M8 14l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: 'Verified partner data',
    body: 'Hours, prices, and closures confirmed directly with venues and local partners — replacing today’s placeholder demo data with the real thing.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={iconClass} aria-hidden="true">
        <path d="M12 3l7 3v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V6l7-3z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: 'Multi-city trips',
    body: 'Plan a route across more than one city, with Waypoint sequencing each day and the trip in between.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={iconClass} aria-hidden="true">
        <circle cx="7" cy="8" r="3" />
        <circle cx="18" cy="16" r="3" />
        <line x1="9.5" y1="9.5" x2="15.5" y2="14.5" strokeDasharray="3 3" />
      </svg>
    ),
  },
  {
    title: 'Group trip voting',
    body: 'Invite your travel companions to vote 👍 on stops before Waypoint builds the day everyone agreed to.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={iconClass} aria-hidden="true">
        <circle cx="8" cy="9" r="3" />
        <path d="M2 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
        <circle cx="17" cy="8" r="2.5" />
        <path d="M15 14.5c2.8.3 5 2.7 5 5.5" />
      </svg>
    ),
  },
  {
    title: 'Real-time transit & traffic',
    body: 'Live traffic and transit conditions adjust arrival times as your day unfolds, not just at planning time.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={iconClass} aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </svg>
    ),
  },
]

// Verbatim quotes from the first usability round (docs/venture/Waypoint Usability
// Test Participant Tracker.xlsx — Task Notes + Debrief sheets, participants P2 and
// P3; P1's task notes carried no standalone quote suited to a pull-quote). Only
// three participants have been run so far — the subhead below says so rather than
// implying a bigger sample.
const TESTIMONIALS = [
  {
    quote:
      'I think it’s the proximity of the locations from each other, and how you’ll be able to maximize your day.',
    attribution: 'Usability participant · Meticulous Router',
  },
  {
    quote:
      'I would trust the whys kung nagamit ko na yung app before, but since it’s my first time I would double check lang just to make sure.',
    attribution: 'Usability participant · Meticulous Router',
  },
  {
    quote: 'I would use this plan. It’s a nice thing actually.',
    attribution: 'Usability participant · Meticulous Router',
  },
]

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 py-1 text-xs font-semibold text-[var(--color-text-muted)]">
      {children}
    </span>
  )
}

export default function LandingPage({ channel = null }: { channel?: Channel | null }) {
  return (
    <div>
      <ChannelCapture channel={channel} />
      <SmoothAnchorNav />

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
          <a href="#waitlist" className={primaryCta}>
            Join the waitlist →
          </a>
          <a href="#how-it-works" className={secondaryCta}>
            See how it works
          </a>
        </div>

        {/* Route motif — echoes the result-page map (pin 3 amber = "check hours"). */}
        <Reveal className="mx-auto mt-14 w-full max-w-sm">
          <svg
            viewBox="0 0 360 60"
            className="block w-full"
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
        </Reveal>
      </section>

      {/* How it works — the numbered-dot + dashed-line motif echoes the hero's route
          graphic, so the page reads as one system rather than a stock feature grid. */}
      <section id="how-it-works" className="scroll-mt-24 border-y border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
        <Reveal as="div" className="mx-auto max-w-4xl px-5 py-14">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-[1.75rem]">
            How it works
          </h2>
          <div className="relative mt-12">
            {/* No z-index: the dashed line behind it is `absolute` and comes first in
                the DOM, so plain paint order already puts the numbered dots on top —
                an explicit z-index here would escalate into the root stacking context
                and fight the header's own `z-10` (SiteHeader.tsx) while scrolling. */}
            <span
              aria-hidden="true"
              className="absolute left-[16%] right-[16%] top-[18px] hidden border-t-2 border-dashed border-[var(--color-primary)]/30 sm:block"
            />
            <ol className="relative grid gap-8 sm:grid-cols-3 sm:gap-6">
              {STEPS.map((step, i) => (
                <li key={step.title} className="text-center">
                  <span className="relative mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 font-bold">{step.title}</h3>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </Reveal>
      </section>

      {/* Why it's different — bordered cards with an icon badge, so the trust pitch
          reads as a distinct, scannable module rather than a plain list. */}
      <Reveal as="section" id="features" className="mx-auto max-w-4xl scroll-mt-24 px-5 py-14">
        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-[1.75rem]">
          Built on trust, not a black box
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-[var(--color-text-muted)]">
          Most planners decide everything for you and hide the rest. Waypoint optimizes only the
          order and shows all its work, so you stay in control.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="flex flex-col gap-4 rounded-xl border border-[var(--color-border)] bg-white p-7 shadow-sm"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-bg-subtle)] text-[var(--color-primary)]">
                {f.icon}
              </div>
              <div>
                <h3 className="font-bold">{f.title}</h3>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </Reveal>

      {/* Roadmap — planned-not-yet-built features, framed honestly as "coming soon"
          rather than blended in with what ships today. */}
      <section id="roadmap" className="scroll-mt-24 border-y border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
        <Reveal as="div" className="mx-auto max-w-4xl px-5 py-14">
          <p className="text-center text-sm font-semibold uppercase tracking-wider text-[var(--color-primary)]">
            What&apos;s next
          </p>
          <h2 className="mt-2 text-center text-2xl font-bold tracking-tight sm:text-[1.75rem]">
            Where Waypoint is headed
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-[var(--color-text-muted)]">
            The core planner works today. Here&apos;s what we&apos;re building next to make it
            more accurate, more connected, and more useful for a whole group.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {ROADMAP.map((item, i) => (
              <Reveal
                key={item.title}
                delayMs={i * 90}
                className="flex flex-col gap-2.5 rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  {item.icon}
                  <Chip>Coming soon</Chip>
                </div>
                <h3 className="font-bold">{item.title}</h3>
                <p className="text-sm text-[var(--color-text-muted)]">{item.body}</p>
              </Reveal>
            ))}
            <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--color-border)] p-5 text-center">
              <p className="text-sm font-bold">Have an idea?</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                Join the waitlist and tell us what would make your day easier to plan.
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Early feedback — real usability-round quotes, not marketing copy. */}
      <Reveal as="section" id="feedback" className="mx-auto max-w-4xl scroll-mt-24 px-5 py-14">
        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-[1.75rem]">
          What early testers are saying
        </h2>
        <p className="mx-auto mt-2.5 max-w-md text-center text-sm text-[var(--color-text-muted)]">
          Verbatim notes from our first usability round — three participants, July 2026.
        </p>
        <div className="mt-9 grid gap-5 sm:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <Reveal
              key={t.quote}
              delayMs={i * 90}
              className="rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm"
            >
              <p className="text-sm leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
              <p className="mt-3.5 text-xs font-semibold text-[var(--color-text-muted)]">
                {t.attribution}
              </p>
            </Reveal>
          ))}
        </div>
      </Reveal>

      {/* Waitlist */}
      <section id="waitlist" className="scroll-mt-24 border-t border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
        <Reveal as="div" className="mx-auto max-w-xl px-5 py-14 text-center">
          <WaitlistForm />
        </Reveal>
      </section>

      {/* Footer */}
      <Reveal as="footer" className="mx-auto max-w-4xl px-5 py-10 text-center text-sm text-[var(--color-text-muted)]">
        <p className="text-base font-bold text-[var(--color-primary)]">Waypoint</p>
        <p className="mt-2.5">
          Transit times are estimates — verify opening hours before you go. {CITY_LABEL} · a
          student project exploring trust through transparency. Metro Manila POI data shown today
          is placeholder/demo data.
        </p>
        <p className="mt-2">
          <Link href="/credits" className="underline underline-offset-2 hover:text-[var(--color-text)]">
            Photo credits
          </Link>
        </p>
      </Reveal>
    </div>
  )
}
