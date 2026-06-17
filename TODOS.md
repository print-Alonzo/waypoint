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
| Scheduler algorithm | `lib/scheduler.ts` |
| URL params module | `lib/params.ts` |
| Unit tests (18/18 pass) | `lib/scheduler.test.ts`, `lib/params.test.ts` |
| Placeholder data | `data/metro-manila/pois.json`, `data/metro-manila/transit-matrix.json` |

**Next: Phase 2 (Week 2)** — POI selector component, day-of-week dropdown, full 25-30 POI curation, transit matrix generation script.

---

---

## V2 Items

### ~~T1: Shareable URL~~ — PROMOTED TO V1 (eng review 2026-06-17)

**Decision:** During /plan-eng-review (D8), URL params were promoted from V2 to V1. URL params replace sessionStorage as the primary selector→result handoff, eliminating the hard-refresh failure, multi-tab clobber, and mobile tab-kill UX issues.

**Now in V1 scope:** `/lib/params.ts` (encodeParams/decodeParams) with tests in `/lib/params.test.ts`. See "Added by Eng review" in `docs/designs/waypoint-mvp.md` for full spec.

This item is no longer deferred.

---

### T2: Map view
**Priority:** P3  
**Effort:** M (human: ~8h / CC: ~1h)  
**Depends on:** V1 complete + at least 1 tester requests 'can I see this on a map?'

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

### T4: Create DESIGN.md
**Priority:** P3
**Effort:** XS (human: ~30min / CC: ~20min)
**Depends on:** V1 complete and shipped

**What:** Run `/design-consultation` to generate a `DESIGN.md` from the font, color, and token decisions made in the `/plan-design-review` session.

**Why:** Design tokens (Plus Jakarta Sans, teal-600, type scale) currently live in `docs/designs/waypoint-mvp.md`. A `DESIGN.md` is the implementer's reference when building new V2 screens — without it, new screens risk diverging from V1 style. Especially relevant when adding map view (T2) or multi-city support.

**Where to start:** `/design-consultation` brief includes: Plus Jakarta Sans 400/600, teal-600 (#0D9488) primary, white bg, slate-900 body text, Tailwind CSS framework.

---

### T5: ARIA landmarks on selector page
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

## V3+ Items

- **Multi-day scheduling** — single-day is the narrowest viable wedge; multi-day adds
  state complexity without adding trust-model value for MVP.
- **Live POI data (API-driven)** — replace static JSON with live data from Google Places or
  a local tourism API. Unblocks real-time hours + new POI discovery. Adds API dependency.
- **Budget tracking** — per-stop cost estimates. Requires a new data field in pois.json.
- **Group itinerary branching** — split the group at a POI, rejoin later. Complex state model.
- **Booking integration** — link to venue ticketing. Requires partnership/API access.
