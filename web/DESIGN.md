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

## Component patterns

- **Header** ([`app/layout.tsx`](app/layout.tsx)): sticky, white, thin bottom border; coral
  "Waypoint" wordmark, bold.
- **POI checkbox row** ([`components/Selector.tsx`](components/Selector.tsx)): full-row `<label>`
  (≥44px tap target), `accent-[#ff385c]` checkbox, name (medium) + muted hours line; rows live inside
  a `rounded-xl` bordered container with `divide-y`; group hover `hover:bg-[var(--color-bg-subtle)]`.
- **Sticky CTA bar:** fixed to the viewport bottom, top border, centered to the container width.
- **Stop card** ([`components/ResultView.tsx`](components/ResultView.tsx)): icon (⚠/✕ when flagged) +
  stop number (muted) + arrival time (semibold) + name (semibold) on line 1; `~N min · status` on
  line 2; optional italic muted notes on line 3; a **"Why this stop:" reason line** on line 4 (top
  hairline divider, `text-xs`) explaining the scheduler's ordering choice. Background = flag tint per
  state. The reason line **prints** with the list (it's the faithful record); on clear cards it is
  `text-[var(--color-text-muted)]`, on flagged cards it inherits the card's flag text colour at full
  opacity to keep WCAG AA contrast on the tint. Copy comes from [`lib/reason.ts`](lib/reason.ts) and
  is built from the scheduler's structured `reason` data, so it can never claim something the
  algorithm didn't do (e.g. it only says "closes earliest" when closing time *strictly* decided a tie).
- **Transit connector:** centered, muted — `↓ N min by {mode}` + a fine-print "Estimated — verify
  with Google Maps" line.
- **Banner** (all-stops-closed): full-width error-tint card above the list.
- **Route map** ([`components/MapView.tsx`](components/MapView.tsx)): Leaflet + OpenStreetMap on the
  result page, above the list. A hollow coral **Start** dot, then a circular **numbered pin** per
  stop whose fill echoes the list's flag state — `--color-primary` (open), `--color-flag-warning-border`
  (check hours), `--color-flag-error-text` (closed) — plus a dashed `--color-primary` route line in
  visit order. Pins are 28px, white-bordered, with a soft shadow; styles live in `app/globals.css`
  (`.wp-pin`, `.wp-pin--warning`, `.wp-pin--error`, `.wp-start`). The map is a **supplementary
  visual** — `no-print`, with the text list remaining the accessible + print source of truth.
- **Utility bar** ([`components/ResultView.tsx`](components/ResultView.tsx)): `no-print`, `flex
  flex-wrap justify-between` — `← Edit this list` on the left; `Copy text`, `Download .ics`, `Print`
  grouped on the right (each a text button with `underline-offset-2 hover:underline`). `Copy text`
  swaps its label to `Copied!` / `Copy failed` for ~2.5s (`aria-live="polite"`); the timer is cleared
  on unmount and on re-click.
- **Share / export** ([`lib/export.ts`](lib/export.ts)): pure builders for a copyable text
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
