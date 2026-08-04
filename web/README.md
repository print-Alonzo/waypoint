# Waypoint — web app

Waypoint is a single-city trip-itinerary optimizer. You pick the places you want to visit;
the algorithm optimizes the **order** of your day and shows all its work — flagging stops
that are closed or hard to reach in time instead of silently dropping them. The trust comes from
transparency: you choose *what*, Waypoint sequences *when* — and every part of that sequence stays
editable (reorder, pin, and set the time you spend at each stop), with the schedule re-timing around
your edits.

This is the Next.js front-end. The product spec lives at
[`../docs/designs/waypoint-mvp.md`](../docs/designs/waypoint-mvp.md), and deferred work is in
[`../TODOS.md`](../TODOS.md). The app lives in this `web/` subdirectory to keep planning docs and
source separated; all spec paths are relative to `web/`.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4**
- **Leaflet + OpenStreetMap** for the result-page route map (no API key)
- **dnd-kit** for drag-to-reorder on the result page (it also drives the reorder animation for the
  `↑ ↓` buttons — see DESIGN.md § Motion)
- **Vitest** for unit + component tests
- No backend **for the planner** — scheduling runs client-side over static JSON data; deploys to
  Vercel. The only server-side code that ships is the validation funnel's
  `app/api/validation/route.ts` (MongoDB Atlas), which the planner itself never calls — see
  "Validation funnel" below. (`app/admin/create/route.ts` is server-side too, but refuses to run
  anywhere but your machine — see "Adding places locally".)

## Getting started

```bash
npm install
npm run dev            # http://localhost:3000
```

The landing page (`/`) explains how Waypoint works and links to the selector (`/plan`), where you
pick POIs and trip details — a **swipeable card deck on phones** (swipe/tap to add or skip, with a
category filter chip row to narrow the deck to one category at a time) and a **card grid on larger
screens**. Submitting routes to `/result` with the itinerary encoded in the
URL (shareable, bookmarkable, refresh-safe). On `/result` you can **reorder** stops, **pin** ones you
want kept in place, and **re-optimize** the rest around them — the order/pins live in the URL too, and
the "Why this stop" line always tells the truth about who placed each stop (the algorithm or you).

## Power features & feature flags

On top of the core flow, the result page and a few extra routes add optional "power features".
**Every one is gated by a single boolean in [`lib/features.ts`](lib/features.ts)** — flip a flag to
`false` and that feature's entry point disappears and its code tree-shakes out of the affected view.
No other edits needed; that's the kill switch.

| Flag | What it adds | Where |
|------|--------------|-------|
| `presets` | One-tap curated starter itineraries (encoded `/result` URLs) | Landing page |
| `fitToHours` | Time-budget slider that **greys out** (never deletes) over-budget stops + an honest "wouldn't make it back" line | Result page |
| `fareEstimator` | Per-leg + per-day **fare ranges** (jeepney/Grab; walking is free) | Result page |
| `whatIf` | Compare **Walk / Jeepney / Grab** side by side (re-optimized per mode) | Result page |
| `lunchBreak` | Reserve a midday **lunch window** (12:00–13:30); later stops shift around it | Result page |
| `customDuration` | Per-stop **"Time here" stepper** — override how long you spend at a place; the POI's authored duration stays on screen as the suggestion | Result page |
| `offline` | **Service worker** so a visited plan keeps working without a connection | Whole app (prod only) |
| `liveMode` | `/live` — device-clock companion: now / next, "leave in ~N min", "I'm running late" reflow | `/live` |
| `comparePlans` | **Save plans** (this device); browse and compare two side by side | Result page → `/saved` → `/compare` |
| `groupVote` | `/vote` — single-device thumbs-up tally, then plan the winners. **Off by default** | `/vote` |

Faithfulness still holds across all of them: nothing is ever silently dropped (over-budget stops are
greyed, not removed), every estimate is shown as a labelled range, and the lunch shift keeps the page
and exports in agreement on times.

> **`groupVote` is off by default on purpose.** It is a *single-device* tally (everyone votes on one
> phone). True multi-device, real-time voting needs a shared backend, which Waypoint deliberately does
> not have. The single-device version is a useful demo; enable the flag to try it.

Budget, lunch, and per-stop duration overrides are part of the result URL (`&budget=6`, `&lunch=1`,
`&dur=fort-santiago:120`), so a budgeted / lunch-inclusive / time-tuned plan stays shareable and
refresh-safe like everything else.

## Validation funnel

`validation` (`lib/features.ts`) gates a willingness-to-pay study: channel link → persona quiz →
landing → early-access email → app trial → survey, capturing milestones to MongoDB Atlas
(`app/api/validation/route.ts`) in two collections — `validation_submissions` (one upserted rollup
row per visitor: persona + furthest milestone reached) and `validation_events` (append-only; every
milestone POST, never updated, so no individual answer is lost even if a rollup row is ever
overwritten). Identity is a per-browser `sid`
in `localStorage` — there's no login — so running this as a moderated usability test, where several
participants share one browser/tab, needs an explicit reset between people or the next participant's
answers land on the previous one's row. Two ways that happens:

- **Automatic**: submitting a different email than the one already bound to this browser's session
  (signup form or the feedback survey) rotates to a fresh session first.
- **Manual — `?new=1`**: append `?new=1` to any URL (e.g. `https://.../?new=1`) to force a fresh
  session and clear this device's saved plans before the next participant starts. There's no visible
  button for this — it's meant for the facilitator between sessions, not a website visitor. Gated
  behind the `validation` flag like every other funnel entry point, so it stops working once the flag
  is off — don't rely on it for a moderated session run after the study ends.

The quiz comes **before** the email ask, not after: recruited visitors were bouncing off a "join the
waitlist" CTA they had no reason to say yes to yet, and read the word as "get in line and pay
later". The quiz costs them nothing, and its result screen hands them to the landing page already
knowing why Waypoint is for them — where the signup card greets them by persona
(`PERSONA_SIGNUP_LINE` in `lib/validation/persona.ts`, which owns every persona-facing string). No
user-visible copy anywhere says "waitlist"; the internal milestone, DB field, and component are
still named that. A returning email (already in the database) is told so and offered the planner.

### Channel attribution

Marketing-channel links (`/reddit`, `/facebook`, `/promo`, ...; see `lib/validation/channels.ts` for
the allowlist) render the **persona quiz** via `app/[channel]/page.tsx` — `/` keeps the landing page
for direct traffic, which reaches the quiz from the hero's secondary CTA. Both mount
`components/landing/ChannelCapture.tsx`, which stamps a first-touch `channel` onto the visitor's
session. With the flag off, the channel routes fall back to the landing page (the quiz redirects).
Every milestone POST after that — including a `landed` beacon fired on arrival, so direct traffic
(`/`) has a visit count to compute a conversion rate against — carries the channel through
`track()`'s one choke point. Attribution is first-touch only: visiting a second channel link never
overwrites the first, and `?new=1` (see above) intentionally drops it, since that means a new
participant. Aggregate results with:

```bash
node scripts/validation-channels.mjs
```

Because these links get pasted into Reddit, Facebook, Instagram and TikTok, every route ships a
social preview card (`app/opengraph-image.tsx`, re-exported by `app/[channel]/opengraph-image.tsx`
because a dynamic segment does not inherit the root one). Resolving `og:image` to an absolute URL
needs an origin: set **`NEXT_PUBLIC_SITE_URL`** (see `.env.example`) once a real domain is attached —
it falls back to `VERCEL_PROJECT_PRODUCTION_URL` on Vercel and `http://localhost:3000` locally. A
mistyped short link (`/redit`) lands on `app/not-found.tsx`, an on-brand 404 with an early-access
CTA rather than a dead end.

The card renders through Satori, which embeds **only** the fonts handed to it — it has no system
fallback and cannot read `next/font`'s woff2 output. So Plus Jakarta Sans is committed as TTF under
[`assets/fonts/`](assets/fonts/) (OFL-1.1, license alongside) and read at build time. Delete those
files and the card silently falls back to Noto Sans — it still renders, just off-brand. Same reason
the color tokens are inlined as hex there: Satori resolves no stylesheets and no CSS variables, so
those values are hand-synced with `app/globals.css` and each names the token it mirrors.

After changing the Mongo schema, run the one-time migration (dry-run by default; see
`scripts/validation-migrate.mjs` and `.env.example`):

```bash
node scripts/validation-migrate.mjs           # report only
node scripts/validation-migrate.mjs --apply   # backfill + create indexes
```

The funnel inversion swapped the ranks of `quiz_completed` (now 1) and `waitlist` (now 2), so rows
written before it carry the old numbers. Recompute them from each row's milestone timestamps —
lossless and idempotent, and only needed once:

```bash
node scripts/validation-rerank.mjs            # report only
node scripts/validation-rerank.mjs --apply
```

## Scripts

| Script | What it does |
|--------|--------------|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run test` | Run all unit + component tests once |
| `npm run test:watch` | Tests in watch mode |
| `npm run gen:matrix` | Regenerate `transit-matrix.json` from `pois.json` (Haversine × per-mode speed) |
| `npm run lint` | ESLint |
| `node scripts/validation-migrate.mjs` | One-time migration for the validation funnel's Mongo schema (see above) |
| `node scripts/validation-channels.mjs` | Per-channel visits/signups/conversion report (see "Channel attribution" above) |
| `node scripts/validation-rerank.mjs` | One-time recompute of `furthestMilestoneRank` after the funnel inversion (see above) |

## Project layout

`components/` is grouped by the route that owns it, so `app/<route>/` → `components/<route>/` with no
exceptions. `lib/` is grouped by domain. Tests mirror the source tree under `tests/`.

```
app/                  App Router routes
  page.tsx            Landing page — a thin shim over components/landing/LandingPage
  [channel]/page.tsx  Channel-attribution short links (/reddit, /facebook, ...) — render the quiz
  [channel]/opengraph-image.tsx  Re-exports the root OG card (dynamic segments don't inherit it)
  plan/page.tsx       Selector (Suspense → components/plan/Selector)
  credits/page.tsx    Photo attribution (CC) — linked from page footers
  result/page.tsx     Result view (ErrorBoundary → Suspense → components/result/ResultView)
  live/page.tsx       Live mode (flag: liveMode; redirects home if off)
  saved/page.tsx      List of saved plans (flag: comparePlans; redirects home if off)
  compare/page.tsx    Compare two saved plans (flag: comparePlans; redirects home if off)
  vote/page.tsx       Single-device group vote (flag: groupVote; redirects home if off)
  admin/page.tsx      Local-only content tool (→ components/admin/AdminDashboard); hidden on Vercel
  admin/create/route.ts  POST handler that writes a validated place into data/<city>/ (local only)
  api/validation/route.ts  Milestone upsert for the validation funnel (MongoDB Atlas; same-origin)
  layout.tsx          Root layout: font + header + ServiceWorkerRegister + manifest + metadataBase
  not-found.tsx       On-brand 404 (mistyped channel links land here) with an early-access CTA
  opengraph-image.tsx Social preview card (og:image), inherited by every static route
  globals.css         Design tokens + print rules
components/            Client components, grouped by owning route
  landing/            → / (and /[channel] with the validation flag off)
    LandingPage.tsx   Shared landing markup for both routes (takes an optional channel prop)
    ChannelCapture.tsx  Stamps first-touch channel attribution + fires the `landed` beacon
    WaitlistForm.tsx  Early-access email + consent → a `waitlist` milestone (flag: validation)
    Reveal.tsx        Scroll-in reveal wrapper for below-the-fold sections (see DESIGN.md § Motion)
    SmoothAnchorNav.tsx  Smooth scroll for same-page anchor jumps (leaves Back/Forward alone)
  plan/               → /plan
    Selector.tsx      Picker: card grid (≥sm) + PoiSwipeDeck (<sm), chosen by CSS; shared state
    PoiSwipeDeck.tsx  Phone-only Tinder-style swipe stack (swipe/tap to add or skip; category filter chips; undo)
  result/             → /result
    ResultView.tsx    The scheduled day: stop cards, reasons, reorder/pin, utility bar
    SortableStop.tsx  dnd-kit drag wrapper for a stop card (exports REORDER_MS)
    MapView.tsx       Leaflet route map (numbered pins + line); loaded client-only (ssr:false)
    WhatIfDrawer.tsx  Walk/Jeepney/Grab comparison table (re-optimized per mode)
    SavePlanButton.tsx  Save the current plan to this device, prompting for a name (→ /saved)
  live/LiveView.tsx   Device-clock companion (now/next, countdowns, running-late reflow)
  saved/SavedPlansView.tsx  List of every saved plan, with Open/Forget and a link to /compare
  compare/CompareView.tsx  Side-by-side comparison of two saved plans
  vote/VoteView.tsx   Single-device thumbs-up tally → plan the winners
  admin/AdminDashboard.tsx  Local-only form for adding a place (→ admin/create/route.ts)
  credits/PhotoCredits.tsx  CC attribution for the POI photos
  shared/             Used by 2+ routes, or route-agnostic infra
    CategoryGlyph.tsx Inline line-icon per category (placeholder when a POI has no photo)
    ErrorBoundary.tsx Generic render-error fallback (no domain knowledge)
    ServiceWorkerRegister.tsx  Registers /sw.js in prod when `offline` is on (unregisters when off)
lib/
  constants.ts        Start landmarks, categories, days, transport modes, modeLabel, LUNCH_WINDOW
  features.ts         Central feature-flag registry (one boolean per power feature)
                      ^ these two are the layer-0 kernel: imported by everything, so they stay flat
  scheduling/         When and how long — the leg/time engine
    scheduler.ts      Nearest-neighbor optimizer + scheduleAlong (+ lunch window) + estimateTransitMinutes
    routing.ts        Runtime road routes (Mapbox Directions) layered over the static matrix
    fare.ts           Per-leg + per-day fare ranges (estimate; consistent with scheduler speeds)
    duration.ts       Per-stop dwell overrides (clamp, prune, encode)
    fit.ts            fitToBudget: faithful time-budget overlay (greys out, never drops)
    reason.ts         reasonLine: placement-aware "Why this stop" (optimized / pinned / hand-arranged)
  plan/               A whole day: encode it, resolve it, summarize it, export it
    params.ts         URL-param encode/decode (incl. order/locked/budget/lunch)
    presets.ts        Curated starter itineraries (landing page)
    export.ts         Builds the copyable text + RFC 5545 .ics export (pure; shared flag helpers)
    whatif.ts         Re-optimizes the day per transport mode (drives the What-if drawer)
    model.ts          resolvePlan: shared order/lunch resolution → scheduled stops
    summary.ts        summarizePlan: compact figures for the compare view
  poi/                The places themselves
    data.ts           Loads POIs + transit matrix by NEXT_PUBLIC_CITY
    format.ts         Shared hoursLabel() used by the grid card + swipe deck
    validate.ts       validatePoi: shared by AdminDashboard's form and admin/create/route.ts
  validation/         The willingness-to-pay study (see "Validation funnel" above)
    channels.ts       Marketing-channel allowlist + isChannel/isChannelPath — add a channel here
    milestones.ts     Milestone union + MILESTONE_FIELD/MILESTONE_RANK (shared client + API)
    track.ts          The one choke point every milestone POST passes through (adds `channel`)
    session.ts        Per-browser `sid` session in localStorage (+ rotation, reset, memory fallback)
    validate.ts       Isomorphic validation for an /api/validation submission
    persona.ts        Quiz scoring → persona, plus every persona-facing string
    mongo.ts          Cached MongoDB Atlas client (server-only)
  storage/saved-plans.ts  localStorage CRUD for saved plans (guarded; this-device only)
  hooks/use-reduced-motion.ts  usePrefersReducedMotion
tests/                Mirrors the source tree; no tests live beside source
  app/  components/  lib/
  flows/              Cross-component tests (e.g. the /plan → URL → /result round-trip)
data/<city>/          pois.json + transit-matrix.json
assets/fonts/         Plus Jakarta Sans TTF (OFL-1.1) — build-time only, for the Satori OG card.
                      NOT served to browsers; the site itself loads the font via next/font.
public/
  sw.js               Service worker (network-first pages, stale-while-revalidate assets)
  manifest.webmanifest  PWA manifest
  images/poi/         Featured landmark photos (CC-licensed; credited on the landing)
scripts/
  generate-matrix.mjs Transit-matrix generator (keep math in sync with scheduling/scheduler.ts)
  validation-migrate.mjs  One-time Mongo migration for the validation funnel's schema (see "Validation funnel" above)
  validation-channels.mjs  Per-channel visits/signups/conversion report (see "Channel attribution" above)
  validation-rerank.mjs  Recomputes furthestMilestoneRank after the funnel inversion (see "Validation funnel" above)
```

> Untested today (the mirrored `tests/` tree makes the gaps easy to see): `app/layout.tsx` — thin
> root-layout wiring (font, header, manifest, `ServiceWorkerRegister`, which is itself covered under
> `components/shared/`). `components/plan/Selector.tsx` and `components/credits/PhotoCredits.tsx`
> have no dedicated test file but are exercised indirectly, in real (non-mocked) renders, by
> `tests/flows/plan-to-result.test.tsx` and `tests/app/credits/page.test.tsx` respectively.

## Data / cities

The active city is chosen at build time via `NEXT_PUBLIC_CITY` (see `.env.local`,
default `metro-manila`). Data lives under `data/<city>/`. Adding a city = drop in a new
`data/<slug>/` folder, register it in `lib/poi/data.ts`, and set the env var — no other code changes.

> **Note:** the current `data/metro-manila/` POIs are **placeholder** data for build and demo.
> Real POI curation is owned by the venture lead (spec open question #1), and transit-matrix
> values are computed estimates pending the spot-check pass (spec Weeks 4–5).

## Road routing (optional)

By default the map draws a straight line between stops and travel time is haversine distance ÷ a
fixed per-mode speed (see `lib/scheduling/scheduler.ts`). Set `NEXT_PUBLIC_MAPBOX_TOKEN` (see `.env.example`)
to a [Mapbox](https://www.mapbox.com/) public access token and the result page fetches real road
routes at runtime instead: `walk` gets a pedestrian route, `jeepney`/`grab` share a driving route,
and each leg's travel time is `road distance ÷ that mode's speed`. This is entirely client-side —
routing is per-browser, not baked into the static data — and any leg that fails to resolve (no
token, offline, no route found) falls straight back to the straight-line/haversine estimate, so the
app works the same with or without a token. The token is a public, client-side Mapbox token by
design; restrict it by URL in the Mapbox dashboard before shipping one.

## Adding places locally

`/admin` is a **local-only** content tool for adding a place to the dataset without hand-editing
JSON. It only works when Waypoint is running on your machine — the write API refuses to run on
Vercel (`403`, since the deployed filesystem is read-only), and the page itself shows a "run this
locally" notice there instead of the form.

Workflow: fill out the form at `/admin` → it `POST`s to
[`app/admin/create/route.ts`](app/admin/create/route.ts) → validated by
[`lib/poi/validate.ts`](lib/poi/validate.ts) (the same validation the form uses client-side, so
errors surface before you submit) → appended to `data/<city>/pois.json` → the transit matrix is
regenerated in place (same math as `npm run gen:matrix`) → review the resulting git diff → commit →
redeploy to publish.

## Design language

The UI follows an **Airbnb-inspired** design language (coral `#FF385C` primary, rounded cards,
soft shadows, generous whitespace), using **Plus Jakarta Sans** as a license-safe stand-in for
Airbnb's proprietary Cereal typeface. Full token + component reference: [`DESIGN.md`](DESIGN.md).
Tokens live in `app/globals.css`; the design pivot is recorded in the spec.
