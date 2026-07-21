# Waypoint — Design System

The implementer's reference for building Waypoint screens. Keep new screens consistent with this.

**Language:** Airbnb-inspired — coral primary, rounded cards, soft shadows, generous whitespace.
This **supersedes** the original teal/slate design-review tokens (see the dated pivot note in
[`../docs/designs/waypoint-mvp.md`](../docs/designs/waypoint-mvp.md)).

Tokens are CSS variables defined in [`app/globals.css`](app/globals.css) and consumed via Tailwind
arbitrary values, e.g. `text-[var(--color-primary)]`, `bg-[var(--color-bg-subtle)]`. Always use the
tokens — never hardcode hex in components.

## Color tokens

| Token | Value | Use |
|-------|-------|-----|
| `--color-primary` | `#FF385C` | Airbnb "Rausch". Wordmark, primary CTA, category legends, accents |
| `--color-primary-hover` | `#E31C5F` | CTA hover |
| `--color-text` | `#222222` | Body text |
| `--color-text-muted` | `#717171` | Secondary text, hints, transit connectors |
| `--color-border` | `#DDDDDD` | Card/input/row borders, dividers |
| `--color-bg` | `#FFFFFF` | Page background |
| `--color-bg-subtle` | `#F7F7F7` | Row hover, disabled CTA fill |

### Flag (semantic) tints

The **card background is the primary signal** — never rely on color alone (WCAG). Each flag also
carries an icon (⚠ / ✕) and a text label.

| State | bg | border | text |
|-------|----|--------|------|
| Warning (arrival after close) | `--color-flag-warning-bg` `#FFF7E6` | `--color-flag-warning-border` `#E7A33E` | `--color-flag-warning-text` `#8A5A00` |
| Error (closed that day) | `--color-flag-error-bg` `#FFF0F1` | `--color-flag-error-border` `#FF385C` | `--color-flag-error-text` `#A3001B` |

## Typography

**Font:** Plus Jakarta Sans (weights 400 / 600 / 700), loaded in
[`app/layout.tsx`](app/layout.tsx) via `next/font/google`. It is a license-safe stand-in for
Airbnb's proprietary **Cereal** typeface.

| Role | Tailwind | Notes |
|------|----------|-------|
| Page heading (selector) | `text-3xl font-bold tracking-tight` | "Where do you want to go?" |
| Page heading (result) | `text-2xl font-bold tracking-tight` | "Here's your day — …" |
| Wordmark | `text-xl font-bold tracking-tight` | coral |
| Category legend | `text-xs font-semibold uppercase tracking-wider` | coral |
| Body | `text-base` (16px) | default |
| Secondary / hint | `text-sm text-[var(--color-text-muted)]` | hours, status lines |
| Fine print | `text-xs text-[var(--color-text-muted)]` | "Estimated — verify…" |

## Layout & spacing

- **Container:** `mx-auto max-w-2xl px-5 py-8`. Single centered column, mobile-first.
- Section rhythm: `mt-7`–`mt-9` between major blocks; `gap-4` inside the form grid.
- Form inputs: `grid grid-cols-1 sm:grid-cols-2 gap-4` (single column on mobile, 2×2 on ≥640px).
- Leave bottom padding (`pb-28`) on the selector so the sticky CTA never covers content.

## Shape & elevation

- **Cards:** `rounded-xl` (12px) + `border border-[var(--color-border)]`. Result stop cards add
  `shadow-sm`. (For new interactive cards, `hover:shadow-md` + a slight lift is the intended feel.)
- **Inputs / selects:** `rounded-lg border border-[var(--color-border)] px-3 py-2.5`, focus:
  `focus:border-[var(--color-text)] focus:ring-1 focus:ring-[var(--color-text)]`, no default outline.
- **Buttons / CTA:** `rounded-lg`, bold. Primary = `bg-[var(--color-primary)] text-white
  hover:bg-[var(--color-primary-hover)]`. Disabled = `bg-[var(--color-bg-subtle)]
  text-[var(--color-text-muted)] cursor-not-allowed`.
- Dividers/separators: `h-px bg-[var(--color-border)]`.

## Motion

Motion in Waypoint is for **continuity, not decoration**: it exists so the eye can follow a thing that
moved. The only place it carries real weight today is reordering the itinerary.

- **Tokens** (`app/globals.css`): `--wp-motion-reorder` (220ms) and `--wp-ease-reorder`
  (`cubic-bezier(0.2, 0, 0, 1)` — quick departure, gentle settle). dnd-kit builds its transition
  string in JS, so `REORDER_MS` / `REORDER_EASING` in [`components/result/SortableStop.tsx`](components/result/SortableStop.tsx)
  mirror these as raw values. **Change both or neither.**
- **Every order change animates, by any route** — `↑ ↓`, drag, Re-optimize, Reset order, browser
  back. `useSortable` is given `animateLayoutChanges: () => defaultAnimateLayoutChanges({...args,
  wasDragging: true })`, which makes dnd-kit FLIP on any index change rather than only after a drag.
  There is no hand-rolled FLIP anywhere in the app, and there shouldn't be a second one.
- **The card is the animated unit, not the `<li>`.** The `<li>` also carries the transit leg, which
  stop 1 doesn't have — so `<li>` heights are structurally uneven and a FLIP measured on them jerks
  any card entering or leaving position 1 by the leg's height. Card-to-card spacing *is* uniform
  (exactly one leg row between every pair). The legs re-render in place and crossfade instead
  (`.wp-leg` + `[data-reordering]` on the `<ol>`), which also masks their minutes recomputing.
- **`prefers-reduced-motion: reduce`** collapses the duration to 1ms and drops the leg crossfade and
  the landed ring. Reordering still *happens*, it just happens at once — and drag still works, since
  dragging tracks the finger rather than playing an animation. Any new motion must honour this.
- **Print** (`@media print`): `.wp-stop` force-resets `transform` / `transition` / `animation` /
  `box-shadow`. A reorder interrupted by Cmd-P must never commit a half-applied transform to paper.

## Component patterns

- **Header** ([`app/layout.tsx`](app/layout.tsx)): sticky, white, thin bottom border; coral
  "Waypoint" wordmark (a `<Link>` home) on the left, a muted "Metro Manila" pill on the right.
- **Landing page** ([`app/page.tsx`](app/page.tsx)): the `/` route — a static server component that
  sells the trust/order-only thesis. Centered hero (eyebrow + bold headline + thesis subhead + a
  coral "Plan my day →" primary CTA and an outline "See a sample day" secondary CTA that deep-links a
  prefilled `/result`), a route motif echoing the map (numbered pins, one amber to hint flags), a
  3-step "How it works" band on `--color-bg-subtle`, a 2×2 trust/feature grid (inline line-icons in
  a coral-tinted square), a final CTA band, and a footer carrying the estimates caveat. The selector
  lives at `/plan`; the result page's "Edit this list" returns there.
- **Featured place cards** (landing "Popular places to start with"): Airbnb-style photo cards in a
  responsive grid (`sm:grid-cols-2 lg:grid-cols-3`) — a `4/3` `next/image` (`fill` + `object-cover`,
  subtle hover zoom) over a category eyebrow, name, and hours. Each card links to `/plan` with that
  POI pre-selected. Photos are **CC-licensed** (sourced from Wikimedia Commons), stored in
  `public/images/poi/` and carried on the POI as optional `image` + `image_credit`
  (`author`/`license`/`license_url`/`source_url`). Attribution (required for CC BY / BY-SA) lives on
  a dedicated **`/credits`** page rendered by [`components/credits/PhotoCredits.tsx`](components/credits/PhotoCredits.tsx);
  the landing and selector each carry only a small muted "Photo credits" footer link to it, so the
  attribution stays compliant without cluttering the page. Only curated landmarks have a photo.
- **POI picker — responsive two-mode** ([`components/plan/Selector.tsx`](components/plan/Selector.tsx)): the
  selector renders **both** views and lets **CSS** pick (no `matchMedia`/JS gate — that read stale
  under device emulation and risked a hydration mismatch; CSS `@media` is reliable and flash-free).
  The **trip day** is surfaced in a compact bar above the picker (not only in "Trip details" below
  it), bound to the same `dayOfWeek` state, so it's set before a place is chosen rather than
  discovered as a below-the-fold surprise. Any place closed on that day gets a prominent warning pill
  (bg + ⚠ + text — never color alone) on its card in **both** modes, beyond the small muted hours
  line — a usability test found the hours line alone went unnoticed. A heads-up also sits above the
  sticky CTA when the current selection includes a place closed on the chosen day.
  - **Tablet/desktop (≥ sm): image-forward card grid** (`hidden sm:block`; `grid-cols-2
    sm:grid-cols-3`, grouped by category `<fieldset>`/`<legend>`) — each card is a `4/3` `next/image`
    (category line-icon placeholder for the ~5 POIs without a photo) above the name + muted hours. The
    whole card is the tap target wrapping a visually-hidden (but focusable) checkbox; selected = coral
    border + ring and a coral check badge top-right. Mirrors the landing's featured cards.
  - **Phone (< sm): swipe deck** ([`components/plan/PoiSwipeDeck.tsx`](components/plan/PoiSwipeDeck.tsx),
    `sm:hidden`) — a Tinder-style stack of one place at a time (two cards peeking behind for depth)
    so the traveler *looks before deciding*. A big `next/image` fills the card; category eyebrow,
    name, hours, and a 2-line note sit below. **Swipe right / tap ✓ = add, swipe left / tap ✕ = skip**;
    pointer-drag follows the finger with rotation and a fading **Add**/**Skip** stamp, commits past an
    80px threshold (else springs back), and **axis-locks** so vertical drags still scroll the page
    (`touch-action: pan-y`). Buttons (✕ / ↶ undo / ✓) are the accessible + non-swipe path; ←/→ arrow
    keys also work. A header shows `N of total` + `N added`; an end card summarizes and offers
    *Undo* / *Start over*. A **category filter chip row** above the deck (`All / Heritage / Museums /
    …`) narrows the active slice to one category — tapping a chip restarts the cursor for that slice,
    but selections persist across filters, and a card you've already added shows a persistent "Added"
    badge if you revisit it via a different filter. Both modes share one selection `Set` (via
    `setSelectedOne(id, value)`), so the sticky CTA count and the result are identical however you
    pick. `hoursLabel`
    ([`lib/poi/format.ts`](lib/poi/format.ts)) and `CategoryGlyph`
    ([`components/shared/CategoryGlyph.tsx`](components/shared/CategoryGlyph.tsx)) are shared by both so the card
    copy can't drift.
- **Sticky CTA bar:** fixed to the viewport bottom, top border, centered to the container width.
- **Stop card** ([`components/result/ResultView.tsx`](components/result/ResultView.tsx)): icon (⚠/✕ when flagged) +
  stop number (muted) + an arrival–departure time range (semibold, e.g. "09:05–10:35" — so the
  expected end time doesn't need mental math from the duration line) + name (semibold) on line 1;
  `~N min · status` on line 2 (the effective, possibly user-overridden, duration — see **Duration
  stepper** below);
  a screen-only **"Time here" stepper** (flag: `customDuration`); optional italic muted notes; a
  **"Why this stop:" reason line** (top hairline divider, `text-xs`) explaining the scheduler's
  ordering choice. Background = flag tint per state. The reason line **prints** with the list (it's
  the faithful record); on clear cards it is `text-[var(--color-text-muted)]`, on flagged cards it
  inherits the card's flag text colour at full opacity to keep WCAG AA contrast on the tint. Copy
  comes from `reasonLine` ([`lib/scheduling/reason.ts`](lib/scheduling/reason.ts)) — the **single source of truth** the page
  and both exports share. For an `optimized` stop it renders the scheduler's structured `reason` data,
  so it can never claim something the algorithm didn't do (e.g. it only says "closes earliest" when
  closing time *strictly* decided a tie); for a **pinned** stop it says "Pinned by you — the rest of
  the day was optimized around it," and for a **hand-arranged** stop "You placed this stop here." A
  user-placed stop never shows an algorithmic claim, on the page or in the copied text / `.ics`.
- **Duration stepper** ([`components/result/ResultView.tsx`](components/result/ResultView.tsx), flag:
  `customDuration`): a screen-only (`no-print`) `− / value / +` row under the status line that lets
  you override how long you spend at a stop. The POI's authored `recommended_duration_minutes` stays
  visible as "Suggested N min" — the guide for getting the most out of the stop — even once
  overridden, with a text **Reset** link back to it. Both buttons reuse the 44px `ctrlBtn` token and
  `aria-disabled` (not `disabled`) at the `DURATION_MIN`/`DURATION_MAX` bounds, for the same reason the
  reorder buttons do (see below). Every change announces via the shared `aria-live` region. If the
  chosen duration would run past the stop's `close_time`, a local warning-tint hint appears (icon +
  text, never color alone) — this does **not** flip the stop's flag state (yellow stays
  arrival-based), so the map, exports, and Live mode are unaffected by the hint itself, only by the
  resulting later times. State is the single source of truth in the **URL** (`dur` param via
  [`lib/plan/params.ts`](lib/plan/params.ts) / [`lib/scheduling/duration.ts`](lib/scheduling/duration.ts)), written the same way
  reorder/pin/budget/lunch are — so an edited plan stays shareable + refresh-safe, and the result page,
  map, Compare, Live, and both exports never disagree on times.
- **Reorder & pin (lock)** ([`components/result/ResultView.tsx`](components/result/ResultView.tsx)): the day is
  yours to arrange — the optimizer only sequences what you haven't pinned. Each stop card carries
  screen-only `↑ ↓` move controls, a **drag handle**, a **pin** toggle (an inline lock glyph,
  coral-filled when pinned), and a **✕ remove** control (`removeStop`, disabled with a title hint on
  the day's only remaining stop) — dropping a stop is an explicit traveler action, not the algorithm
  silently dropping it, so it doesn't compromise the faithfulness thesis. Removing prunes that id out
  of `order`/`locked`/`durations` the same way `handleEdit`'s round-trip does
  (`pruneOrderAndLocked`, [`lib/plan/params.ts`](lib/plan/params.ts)). A controls bar reads "Reorder with ↑ ↓…" by default and switches to
  "Your order · N pinned" with **Re-optimize unpinned** (reflows the free stops by nearest-neighbor
  while pinned stops hold their slot) and **Reset order** once customized. State is the single
  source of truth in the **URL** (`order` + `locked` params via [`lib/plan/params.ts`](lib/plan/params.ts)),
  written with `router.replace` (`scroll:false`) so every arrangement stays shareable + refresh-safe
  without piling up history. Placement is computed faithfully: a stop is labelled `optimized` only
  when the working order equals `optimizeOrder(order, locked)` (what the algorithm would produce given
  the pins); otherwise the unpinned stops are `manual`. Map, list, and exports all re-derive from the
  chosen order, so they never disagree.
  - **Drag** ([`components/result/SortableStop.tsx`](components/result/SortableStop.tsx), dnd-kit): a grip handle on
    the card's leading edge, restricted to the vertical axis. It is **pointer-only on purpose** —
    `aria-hidden` + `tabIndex={-1}`, with dnd-kit's `attributes` deliberately NOT spread onto the card
    (they would make every card a focusable `role="button"`, and their `aria-describedby` breaks
    hydration). No `KeyboardSensor`, and dnd-kit's announcements are silenced: the `↑ ↓` buttons are
    already the keyboard + screen-reader path and already announce through the shared `aria-live`
    region, so a second mechanism would only double-speak. `touch-action: none` is scoped to the
    handle's 44px, so dragging anywhere else on the card still scrolls the page.
  - **Optimistic order:** the order lives in the URL, which the router commits asynchronously — so a
    drop would visibly snap back to the old arrangement for a frame. `ResultView` holds the chosen
    order in `pending`, tagged with the query string it was written against; it applies over the URL's
    order until `searchParams` changes, at which point the tag stops matching and the URL wins again.
    Expiry is a pure derivation in the `model` memo — no effect writing state back. This is what makes
    browser-back still able to override an order the user just applied.
- **Transit connector:** centered, muted — `↓ N min by {mode}` + a fine-print "Estimated — verify
  with Google Maps" line.
- **Banner** (all-stops-closed): full-width error-tint card above the list.
- **Route map** ([`components/result/MapView.tsx`](components/result/MapView.tsx)): Leaflet + OpenStreetMap on the
  result page, above the list. A hollow coral **Start** dot, then a circular **numbered pin** per
  stop whose fill echoes the list's flag state — `--color-primary` (open), `--color-flag-warning-border`
  (check hours), `--color-flag-error-text` (closed) — plus a dashed `--color-primary` route line in
  visit order. Pins are 28px, white-bordered, with a soft shadow; styles live in `app/globals.css`
  (`.wp-pin`, `.wp-pin--warning`, `.wp-pin--error`, `.wp-start`). The map is a **supplementary
  visual** — `no-print`, with the text list remaining the accessible + print source of truth.
- **Utility bar** ([`components/result/ResultView.tsx`](components/result/ResultView.tsx)): `no-print`, `flex
  flex-wrap justify-between` — `← Edit this list` on the left; `Live mode`, **Save plan**, **Saved
  plans** (→ `/saved`), `Copy text`, `Download .ics`, `Print` grouped on the right (each a text button
  with `underline-offset-2 hover:underline`, except **Save plan** — see Save + saved plans below).
  `Copy text`
  swaps its label to `Copied!` / `Copy failed` for ~2.5s (`aria-live="polite"`); the timer is cleared
  on unmount and on re-click. `← Edit this list` carries order/locked/budget/lunch/durations back to
  the Selector (`handleEdit`) so returning there and submitting again doesn't discard a result-page
  customization; the Selector prunes any of it that references a since-deselected place
  (`pruneOrderAndLocked`, [`lib/plan/params.ts`](lib/plan/params.ts)).
- **Share / export** ([`lib/plan/export.ts`](lib/plan/export.ts)): pure builders for a copyable text
  itinerary and an RFC 5545 `.ics` file (side effects — clipboard, Blob download — stay in
  ResultView, which injects `now`). Both **carry the same flags the page shows**: a `[CLOSED]` /
  `[CHECK HOURS]` tag (red wins, never both) and the all-closed heads-up, sourced from the shared
  `stopStatusLine` / `stopTag` helpers that the list, the map popups, and the exports all import — one
  source of truth so wording can't drift. `.ics` times are **floating local** (a 09:00 stop reads
  09:00 once the traveler's phone is on Asia/Manila; off-Manila planning views intentionally show
  local wall-clock — never adopt `TZID` without a full `VTIMEZONE`); the trip date is the next
  occurrence of the chosen day anchored to Asia/Manila; closed stops stay **visible** but
  `TRANSP:TRANSPARENT` (we avoid `STATUS:CANCELLED`, which some clients drop — hiding a stop would
  break the transparency guarantee).

## Power features (feature-flagged)

All of the below are gated by [`lib/features.ts`](lib/features.ts) — one boolean each; setting it
`false` removes the entry point and tree-shakes the code out. They preserve the transparency thesis:
nothing is dropped, and every estimate is shown as a labelled range.

- **"Adjust your day" panel** ([`components/result/ResultView.tsx`](components/result/ResultView.tsx)): a bordered,
  subtly-tinted `no-print` `<details>` grouping the result-page options — a **Trip details** grid
  (day of trip, start time, starting point, transport mode) so those can be changed without leaving
  for the Selector, reorder/pin status, a **lunch break** checkbox (reserves `LUNCH_WINDOW` 12:00–13:30; later arrivals shift, with a centered
  "🍴 Lunch …" pill in the list), a **"Fit my day to a time limit"** checkbox + range slider
  (`fitToHours`), and a **"Compare walk / jeepney / Grab"** disclosure (`aria-expanded`). **Open by
  default** (a usability test found the panel went unnoticed while collapsed, hiding features
  entirely) — the summary names its contents even before anything is customized, and stays user-
  collapsible via the native `<details>` toggle.
- **Fit to hours** ([`lib/scheduling/fit.ts`](lib/scheduling/fit.ts)): over-budget stops are **greyed (`opacity-60`) with a
  "Beyond your Nh" pill — never removed** — plus an honest summary line ("N stops fall beyond your Nh
  budget…", or "getting back to {start} would run past your Nh budget"). `budget` lives in the URL.
  Set via a **− / value / + stepper** (the `DurationStepper` pattern, exact hour counts without
  fiddling a drag) above a range slider with `{BUDGET_MIN}h`/`{BUDGET_MAX}h` endpoint labels for
  coarse adjustment.
- **Fare estimator** ([`lib/scheduling/fare.ts`](lib/scheduling/fare.ts)): a `~₱low–high` range in the header and on each
  transit connector (walking is "Free"); ranges only, never false precision. Speeds match the scheduler.
- **What-if drawer** ([`components/result/WhatIfDrawer.tsx`](components/result/WhatIfDrawer.tsx)): a small table
  comparing the same places **re-optimized per mode** (ends / length / flagged / fare), with a "Use {mode}"
  action; figures are recomputed by the real scheduler, labelled estimates.
- **Live mode** ([`components/live/LiveView.tsx`](components/live/LiveView.tsx), `/live`): device-clock companion —
  a coral "right now" card (at / on the way to / done), countdowns, an **"I'm running late (+15 min)"**
  shift, and a dimmed/✓ timeline. Clock read in an effect (no hydration drift).
- **Save + saved plans** ([`components/result/SavePlanButton.tsx`](components/result/SavePlanButton.tsx),
  [`components/saved/SavedPlansView.tsx`](components/saved/SavedPlansView.tsx), `/saved`): plans are saved to
  `localStorage` ([`lib/storage/saved-plans.ts`](lib/storage/saved-plans.ts)) via a bordered **Save plan**
  button (≥44px tap target) on the result page, which prompts for a name inline so plans stay
  distinguishable later. `/saved` lists **every** saved plan (not just two) — name, day, mode, quick
  figures via `summarizePlan` ([`lib/plan/summary.ts`](lib/plan/summary.ts)), with **Open** and **Forget**
  per plan, plus a **"Compare plans →"** link into `/compare`. Three entry points all lead here
  (never straight to `/compare`): the result page's persistent **"Saved plans"** utility-bar link (not
  gated behind having saved anything first — a usability test found the prior direct-to-Compare path
  went undiscovered), `SavePlanButton`'s post-save **"View saved plans"** link, and the landing page's
  **"View saved plans"** link.
- **Compare plans** ([`components/compare/CompareView.tsx`](components/compare/CompareView.tsx), `/compare`): two
  saved plans side by side; fewer hours / fewer flags / cheaper fare are highlighted. Reachable only
  from `/saved`'s "Compare plans →" link (or a direct URL) — with zero saved plans it redirects to
  `/saved` client-side (`useEffect` + `useRouter`, since plans are localStorage-only and unknown at
  the server); with exactly one it shows a "comparing a plan with itself" notice rather than
  redirecting, since that's still a legitimate state to land in.
- **Presets** ([`lib/plan/presets.ts`](lib/plan/presets.ts)): landing-page cards that deep-link to a ready-made
  `/result` URL — no special-casing, fully editable on arrival.
- **Offline** ([`public/sw.js`](public/sw.js)): a service worker (network-first pages, stale-while-
  revalidate assets; cross-origin tiles/fonts untouched), registered only in production and only when
  the flag is on — and **unregistered when the flag is off**.
- **Group vote** ([`components/vote/VoteView.tsx`](components/vote/VoteView.tsx), `/vote`): **off by default** —
  a single-device thumbs-up tally that plans the winners. Multi-device voting would need a backend,
  which Waypoint deliberately omits; the flag and route make this explicit.

## Accessibility

- Category groups use `<fieldset>` + `<legend>` so screen readers announce POIs by category.
- Flag meaning is conveyed by **background + icon + text**, never color alone.
- Inputs have associated `<label htmlFor>`; checkbox rows are wrapped `<label>`s.
- Maintain ≥44px tap targets on interactive rows.

## Print

Defined in [`app/globals.css`](app/globals.css):
- `.no-print` — hides nav/utility chrome (edit bar, etc.).
- `.print-hide` — hides noise (e.g. notes) in print only.
- `print-color-adjust: exact` (+ `-webkit-`) preserves flag tints; `@page { size: portrait }`.
