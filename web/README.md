# Waypoint — web app

Waypoint is a single-city trip-itinerary optimizer. You pick the places you want to visit;
the algorithm optimizes only the **order** of your day and shows all its work — flagging stops
that are closed or hard to reach in time instead of silently dropping them. The trust comes from
transparency: you choose *what*, Waypoint sequences *when*.

This is the Next.js front-end. The product spec lives at
[`../docs/designs/waypoint-mvp.md`](../docs/designs/waypoint-mvp.md), and deferred work is in
[`../TODOS.md`](../TODOS.md). The app lives in this `web/` subdirectory to keep planning docs and
source separated; all spec paths are relative to `web/`.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4**
- **Vitest** for unit + component tests
- No backend — scheduling runs client-side over static JSON data; deploys to Vercel.

## Getting started

```bash
npm install
npm run dev            # http://localhost:3000
```

The selector page (`/`) lets you pick POIs and trip details, then routes to `/result` with the
itinerary encoded in the URL (shareable, bookmarkable, refresh-safe).

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
  page.tsx            Selector (Suspense → components/Selector)
  result/page.tsx     Result view (ErrorBoundary → Suspense → components/ResultView)
  layout.tsx          Root layout: font + persistent header
  globals.css         Design tokens + print rules
components/            Client components (Selector, ResultView, ErrorBoundary)
lib/
  scheduler.ts        Pure nearest-neighbor scheduler (data passed in as args)
  params.ts           URL-param encode/decode (selector ⇄ result handoff)
  constants.ts        Start landmarks, categories, days, transport modes
  data.ts             Loads POIs + transit matrix by NEXT_PUBLIC_CITY
data/<city>/          pois.json + transit-matrix.json
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

## Design language

The UI follows an **Airbnb-inspired** design language (coral `#FF385C` primary, rounded cards,
soft shadows, generous whitespace), using **Plus Jakarta Sans** as a license-safe stand-in for
Airbnb's proprietary Cereal typeface. Full token + component reference: [`DESIGN.md`](DESIGN.md).
Tokens live in `app/globals.css`; the design pivot is recorded in the spec.
