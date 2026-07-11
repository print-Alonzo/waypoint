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
- **Vitest** for unit + component tests
- No backend — scheduling runs client-side over static JSON data; deploys to Vercel.

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
| `comparePlans` | **Save plans** (this device) and compare two side by side | Result page → `/compare` |
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

## Scripts

| Script | What it does |
|--------|--------------|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run test` | Run all unit + component tests once |
| `npm run test:watch` | Tests in watch mode |
| `npm run gen:matrix` | Regenerate `transit-matrix.json` from `pois.json` (Haversine × per-mode speed) |
| `npm run lint` | ESLint |

## Project layout

```
app/                  App Router routes
  page.tsx            Landing page (product pitch; CTAs → /plan + sample /result; presets section)
  plan/page.tsx       Selector (Suspense → components/Selector)
  credits/page.tsx    Photo attribution (CC) — linked from page footers
  result/page.tsx     Result view (ErrorBoundary → Suspense → components/ResultView)
  live/page.tsx       Live mode (flag: liveMode; redirects home if off)
  compare/page.tsx    Compare two saved plans (flag: comparePlans; redirects home if off)
  vote/page.tsx       Single-device group vote (flag: groupVote; redirects home if off)
  admin/page.tsx      Local-only content tool (→ components/AdminDashboard); hidden on Vercel
  admin/create/route.ts  POST handler that writes a validated place into data/<city>/ (local only)
  layout.tsx          Root layout: font + header + ServiceWorkerRegister + manifest
  globals.css         Design tokens + print rules
components/            Client components
  Selector.tsx        Picker: card grid (≥sm) + PoiSwipeDeck (<sm), chosen by CSS; shared state
  PoiSwipeDeck.tsx    Phone-only Tinder-style swipe stack (swipe/tap to add or skip; category filter chips; undo)
  CategoryGlyph.tsx   Inline line-icon per category (placeholder when a POI has no photo)
  MapView.tsx         Leaflet route map (numbered pins + line); loaded client-only (ssr:false)
  WhatIfDrawer.tsx    Walk/Jeepney/Grab comparison table (re-optimized per mode)
  SavePlanButton.tsx  Save the current plan to this device (→ /compare)
  CompareView.tsx     Side-by-side comparison of two saved plans
  LiveView.tsx        Device-clock companion (now/next, countdowns, running-late reflow)
  VoteView.tsx        Single-device thumbs-up tally → plan the winners
  AdminDashboard.tsx  Local-only form for adding a place to the dataset (→ admin/create/route.ts)
  ServiceWorkerRegister.tsx  Registers /sw.js in prod when `offline` is on (unregisters when off)
lib/
  features.ts         Central feature-flag registry (one boolean per power feature)
  scheduler.ts        Nearest-neighbor optimizer + scheduleAlong (+ lunch window) + estimateTransitMinutes
  reason.ts           reasonLine: placement-aware "Why this stop" (optimized / pinned / hand-arranged)
  fit.ts              fitToBudget: faithful time-budget overlay (greys out, never drops)
  fare.ts             Per-leg + per-day fare ranges (estimate; consistent with scheduler speeds)
  presets.ts          Curated starter itineraries (landing page)
  plan-model.ts       resolvePlan: shared order/lunch resolution → scheduled stops
  plan-summary.ts     summarizePlan: compact figures for the compare view
  saved-plans.ts      localStorage CRUD for saved plans (guarded; this-device only)
  poi-format.ts       Shared hoursLabel() used by the grid card + swipe deck
  poi-validate.ts     validatePoi: shared by AdminDashboard's form and admin/create/route.ts
  export.ts           Builds the copyable text + RFC 5545 .ics export (pure; shared flag helpers)
  params.ts           URL-param encode/decode (incl. order/locked/budget/lunch)
  constants.ts        Start landmarks, categories, days, transport modes, modeLabel, LUNCH_WINDOW
  data.ts             Loads POIs + transit matrix by NEXT_PUBLIC_CITY
  routing.ts          Runtime road routes (Mapbox Directions) layered over the static matrix
data/<city>/          pois.json + transit-matrix.json
public/
  sw.js               Service worker (network-first pages, stale-while-revalidate assets)
  manifest.webmanifest  PWA manifest
  images/poi/         Featured landmark photos (CC-licensed; credited on the landing)
scripts/
  generate-matrix.mjs Transit-matrix generator (keep math in sync with scheduler.ts)
```

## Data / cities

The active city is chosen at build time via `NEXT_PUBLIC_CITY` (see `.env.local`,
default `metro-manila`). Data lives under `data/<city>/`. Adding a city = drop in a new
`data/<slug>/` folder, register it in `lib/data.ts`, and set the env var — no other code changes.

> **Note:** the current `data/metro-manila/` POIs are **placeholder** data for build and demo.
> Real POI curation is owned by the venture lead (spec open question #1), and transit-matrix
> values are computed estimates pending the spot-check pass (spec Weeks 4–5).

## Road routing (optional)

By default the map draws a straight line between stops and travel time is haversine distance ÷ a
fixed per-mode speed (see `lib/scheduler.ts`). Set `NEXT_PUBLIC_MAPBOX_TOKEN` (see `.env.example`)
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
[`lib/poi-validate.ts`](lib/poi-validate.ts) (the same validation the form uses client-side, so
errors surface before you submit) → appended to `data/<city>/pois.json` → the transit matrix is
regenerated in place (same math as `npm run gen:matrix`) → review the resulting git diff → commit →
redeploy to publish.

## Design language

The UI follows an **Airbnb-inspired** design language (coral `#FF385C` primary, rounded cards,
soft shadows, generous whitespace), using **Plus Jakarta Sans** as a license-safe stand-in for
Airbnb's proprietary Cereal typeface. Full token + component reference: [`DESIGN.md`](DESIGN.md).
Tokens live in `app/globals.css`; the design pivot is recorded in the spec.
