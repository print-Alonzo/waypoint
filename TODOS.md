# TODOS — Waypoint

Deferred items from /plan-ceo-review (2026-06-17). V2 work for post-MVP test cycle.

---

## Phase 1 — Shipped (2026-06-17)

Week 1 deliverables are complete. All paths relative to `web/`.

| Item | File(s) |
|------|---------|
| Next.js 16 scaffold | `web/` |
| Vitest config | `vitest.config.ts` |
| Env var | `.env.local` (`NEXT_PUBLIC_CITY=metro-manila`) |
| Design tokens + font | `app/globals.css`, `app/layout.tsx` |
| Landmark constants | `lib/constants.ts` |
| Scheduler algorithm | `lib/scheduling/scheduler.ts` |
| URL params module | `lib/plan/params.ts` |
| Unit tests (18/18 pass) | `tests/lib/scheduling/scheduler.test.ts`, `tests/lib/plan/params.test.ts` |
| Placeholder data | `data/metro-manila/pois.json`, `data/metro-manila/transit-matrix.json` |

**Next: Phase 2 (Week 2)** — POI selector component, day-of-week dropdown, full 25-30 POI curation, transit matrix generation script.

---

---

## V2 Items

### ~~T1: Shareable URL~~ — PROMOTED TO V1 (eng review 2026-06-17)

**Decision:** During /plan-eng-review (D8), URL params were promoted from V2 to V1. URL params replace sessionStorage as the primary selector→result handoff, eliminating the hard-refresh failure, multi-tab clobber, and mobile tab-kill UX issues.

**Now in V1 scope:** `lib/plan/params.ts` (encodeParams/decodeParams) with tests in `tests/lib/plan/params.test.ts`. See "Added by Eng review" in `docs/designs/waypoint-mvp.md` for full spec.

This item is no longer deferred.

---

### ~~T2: Map view~~ — DONE (2026-06-20)
**Priority:** P3  
**Effort:** M (human: ~8h / CC: ~1h)  
**Depends on:** V1 complete + at least 1 tester requests 'can I see this on a map?'

**Status:** Done. `web/components/result/MapView.tsx` renders the ordered itinerary on a Leaflet +
OpenStreetMap map (no API key): a Start dot, one numbered pin per stop coloured by flag state
(coral open / amber check-hours / red closed) so the map echoes the list, and a dashed route line
through the stops in visit order. Loaded client-only via `next/dynamic({ ssr: false })` (Leaflet
needs `window`); shown on `/result` above the list and hidden from print — the text list stays the
print + accessible artifact. Pin styles are token-driven in `app/globals.css` (`.wp-pin*`).

**What:** Show the ordered itinerary as numbered pins on an interactive map (Leaflet + OSM or
Google Maps JS API). Pins labeled 1, 2, 3... in visit order. Lines connecting them.

**Why:** Working-professional testers frequently verify routes visually in Google Maps. A map
view with numbered pins is a stronger trust signal than a text list — it shows the route makes
geographic sense.

**Where to start:** Leaflet + OpenStreetMap is the zero-cost option (no API key). Add
`data/metro-manila/` lat/lng from pois.json as markers. Google Maps JS API adds billing complexity.

---

### T3: Mode-specific confidence labels
**Priority:** P2  
**Effort:** XS (human: ~1h / CC: ~10min)  
**Depends on:** Week 5 spot-check complete (need actual error margin data per mode)

**What:** Replace uniform "Estimated — verify with Google Maps" label with mode-specific
accuracy ranges derived from spot-check data. Example:
- Walk: "±5 min estimate"
- Jeepney: "±15 min estimate (traffic varies)"  
- Grab: "±10 min estimate"

**Why:** The uniform label treats all modes as equally inaccurate. Jeepney has much higher
variance in Metro Manila than Grab or walking. Mode-specific labels are more honest and calibrate
tester expectations more accurately, especially for the least accurate mode (jeepney).

**Where to start:** After Week 5 spot-check, calculate actual error margins per mode from the
comparison data. Update the confidence label component with mode-aware text.

---

---

### ~~T4: Create DESIGN.md~~ — DONE (2026-06-20)
**Priority:** P3
**Effort:** XS (human: ~30min / CC: ~20min)
**Depends on:** V1 complete and shipped

**Status:** Done. `web/DESIGN.md` captures the Airbnb design tokens (coral `#FF385C`, type scale,
card/shadow/input rules), component patterns, accessibility, and print rules — sourced from the
implemented `app/globals.css` + components, not a separate consultation. Linked from `web/README.md`.

**What:** Run `/design-consultation` to generate a `DESIGN.md` from the font, color, and token decisions made in the `/plan-design-review` session.

**Why:** Design tokens (Plus Jakarta Sans, teal-600, type scale) currently live in `docs/designs/waypoint-mvp.md`. A `DESIGN.md` is the implementer's reference when building new V2 screens — without it, new screens risk diverging from V1 style. Especially relevant when adding map view (T2) or multi-city support.

**Where to start:** `/design-consultation` brief includes: Plus Jakarta Sans 400/600, teal-600 (#0D9488) primary, white bg, slate-900 body text, Tailwind CSS framework.

---

### ~~T5: ARIA landmarks on selector page~~ — Fixed by /qa on main, 2026-07-11

**Status:** Already implemented — verified during /qa. `/plan` renders 5 `<fieldset>/<legend>`
groups (Heritage, Museums, Parks, Markets, Churches) around the POI checkbox list.

**Priority:** P2
**Effort:** XS (human: ~30min / CC: ~5min)
**Depends on:** Selector page component (`app/page.tsx`) built

**What:** Add `<fieldset>`/`<legend>` for each POI category group in the checkbox list. Each category (Heritage, Museums, Parks, Markets, Churches) becomes a `<fieldset>` containing its checkboxes, with a `<legend>` matching the category name.

**Why:** Without this, screen readers announce the checkbox list as a generic form — users cannot navigate by category. With `fieldset/legend`, the correct announcement is "Heritage group: Fort Santiago, unchecked." Addresses WCAG 2.0 Level A (1.3.1 Info and Relationships).

**Where to start:** In `app/page.tsx`, wrap each category's checkbox block:
```html
<fieldset>
  <legend class="text-xs font-semibold uppercase tracking-wider text-teal-600">
    Heritage
  </legend>
  <!-- checkboxes here -->
</fieldset>
```

---

## Deferred from /design-review (2026-07-11)

- **Image `sizes` tuning** — Next.js dev warns that `casa-manila.jpg` / `fort-santiago.jpg`
  render with `fill` + `sizes="100vw"` but aren't full-viewport width on `/plan` and `/result`
  (LCP + oversized-download warnings). Needs `sizes` tuned to actual rendered card width in
  `Selector.tsx` / `PoiSwipeDeck.tsx`. Low priority, dev-console-only signal.
- **`prefers-reduced-motion` audit** — partly done. The itinerary reorder path now honors it
  (`--wp-motion-reorder` + `lib/hooks/use-reduced-motion.ts`, see DESIGN.md § Motion), and `app/globals.css`
  has the `@media (prefers-reduced-motion: reduce)` block to extend. Still unaudited: the swipe deck's
  `FLY_MS` transitions (`PoiSwipeDeck.tsx`) and the ad-hoc `transition`/`hover:` states scattered
  across components — neither consults the hook.

Full report: `~/.gstack/projects/print-Alonzo-waypoint/designs/design-audit-20260711/design-audit-waypoint.md`

---

## Deferred from /qa (2026-07-11)

- **5 of 28 POIs have no curated photo** — `bahay-tsinoy`, `intramuros-walls-walk`,
  `ayala-museum`, `the-mind-museum`, `salcedo-saturday-market` have no `image` field in
  `data/metro-manila/pois.json`; UI correctly falls back to a generic icon (not a broken
  image), but it's a content gap. Needs real CC/public-domain photos matching the pattern
  used for the other 23 POIs (see `/credits`). Not fixable from source code.

Full report: `.gstack/qa-reports/qa-report-localhost-2026-07-11.md`

---

## Deferred from usability test (2026-07-21)

3-participant moderated test (P1 Time-Poor Professional, P2/P3 Meticulous Router; see
`docs/venture/Waypoint Usability Test Participant Tracker.xlsx`). The discoverability/edit-flow
findings from this test were fixed directly (see `web/DESIGN.md`); the feature requests below are
new capabilities, out of scope for that fix pass, and deferred here:

- **Multi-modal transit (Grab + Walk in one plan)** — P1: "Is there an option to do both Grab and
  walk?" Currently one transport mode applies to the whole day. Would need per-leg mode assignment
  in the scheduler, not just a day-level `transport_mode` param.
- **Food / restaurant recommendations** — P1 and P2 both asked for nearby-restaurant suggestions
  (P2: "you could also input like restaurants around the area"); P2 also floated an "experience"
  filter (e.g. "bar hopping"). Needs a new POI category/dataset dimension and probably a stronger
  data source than the current static `pois.json`.
- **Richer POI info (ticket prices, "what to do there")** — P1: would pay more "if it had more
  information on POIs (what to do there, ticket prices, other POIs such as restaurants)". New
  authored fields on the POI dataset.
- **"Be back by X PM" end-time constraint** — P1: "I wish I could put a time na I want to be back
  in my hotel by [time]." Distinct from the existing `fitToHours` budget (an hours-elapsed cap, not
  a wall-clock return-by target) — would need new scheduling logic.
- **Export to Google Maps / Waze** — P3 debrief: expected a file/link to navigate the plan in Maps
  or Waze. Current export is copy-text, `.ics`, and print only (`lib/plan/export.ts`).
- **Per-leg distance in km** — P1 wanted to gauge walkability ("maybe it's walkable"). Distance is
  computed internally (`haversineKm`, `lib/scheduling/scheduler.ts`) but never surfaced; only
  travel time/fare are shown. Low effort if picked up — mostly a display change.

---

## Deferred from landing-page redesign (2026-07-28)

Implemented the Claude Design landing page (`Waypoint Landing Page.dc.html`): a waitlist-first hero,
a new "Where Waypoint is headed" roadmap section, and real usability-round quotes replacing invented
testimonial copy. Full detail in `web/DESIGN.md`'s "Landing page" component-pattern entry.

- **`presets` flag now gates nothing.** "Or start from a ready-made day" (`PRESETS` / `presetHref`,
  `lib/plan/presets.ts`) was cut from the landing to match the design section-for-section — it was
  the feature's only UI entry point. The module and its own tests (`tests/lib/plan/presets.test.ts`)
  still work, they're just unreachable now. Either give it a new home (e.g. a link from `/plan`) or
  remove the flag/module/tests — removing working code is a separate call from this redesign.

---

## Deferred from fix/validation-funnel-data-loss (2026-08-01)

Fixed the funnel overwriting one participant's answers with the next's (session rotation on a new
email, `?new=1` moderated-session reset, rank-guarded milestone writes — see `web/README.md`
"Validation funnel"). One hardening gap was flagged rather than fixed in the same pass:

- **`/api/validation` has no auth or rate limiting; `sid` is still client-chosen.** This fix added a
  same-origin check (`app/api/validation/route.ts`), which blocks the obvious cross-site-POST case,
  but a script running on an allowed origin can still spoof arbitrary `sid`/`milestone` values, and
  nothing throttles request volume. Low risk while the study is small (the endpoint is
  unauthenticated by design — no login), but worth hardening — e.g. a per-IP/per-sid rate limit —
  before pointing a larger audience at the funnel. See the route's "Flagged, not solved here" comment.

---

## Deferred from the funnel inversion (2026-08-04)

Flipped the funnel so the persona quiz comes first and the email ask last, and purged "waitlist"
from every user-visible string — the team's read is that participants hear "waitlist" as "get in
line and pay later" (see `web/README.md` "Validation funnel"). Two things were left alone:

- **`furthestMilestoneRank` comparisons across the inversion need the rerank migration.**
  `quiz_completed` and `waitlist` swapped ranks (1 ↔ 2), so rows written before the change carry the
  old numbers. `web/scripts/validation-rerank.mjs` recomputes them from each row's milestone
  timestamps — run it once (`--apply`) before comparing pre- and post-inversion drop-off, or the two
  cohorts aren't measuring the same thing. Nothing in the app reads the rank, so this is a
  reporting concern only.
- **No pre/post A/B — this is a sequential change.** The old funnel is gone rather than split-tested,
  so a lift in signups is confounded with anything else that changed in the same window (recruiting
  copy, timing, audience). Compare cautiously; the channel report (`validation-channels.mjs`) is
  still the cleaner signal since attribution is unaffected.
- **A returning signed-up visitor sees the empty signup form again.** (ISSUE-003, Low, found by
  `/qa` on `feat/funnel-inversion`, 2026-08-04.) A session already carrying `boundEmail` and
  `waitlistAt` still gets the full "Be one of the earliest users" card with an empty email field on
  the next visit, rather than the "You're already in" state `WaitlistForm` can already render —
  `returning` is only set by a duplicate response during a submit, never seeded from the stored
  session on mount. It self-heals (resubmitting the same address shows "You're already in"), so this
  is a small credibility cost, not a broken flow. Deferred because the fix requires deciding what a
  returning participant *should* see — whether to prefill, greet, or send them to the planner — and
  that is a product call. Repro: complete the funnel, then reload `/`.
  See `.gstack/qa-reports/qa-report-localhost-2026-08-04.md`.

---

## V3+ Items

- **Multi-day scheduling** — single-day is the narrowest viable wedge; multi-day adds
  state complexity without adding trust-model value for MVP.
- **Live POI data (API-driven)** — replace static JSON with live data from Google Places or
  a local tourism API. Unblocks real-time hours + new POI discovery. Adds API dependency.
- **Budget tracking** — per-stop cost estimates. Requires a new data field in pois.json.
- **Group itinerary branching** — split the group at a POI, rejoin later. Complex state model.
- **Booking integration** — link to venue ticketing. Requires partnership/API access.
