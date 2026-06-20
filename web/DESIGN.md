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
  a dedicated **`/credits`** page rendered by [`components/PhotoCredits.tsx`](components/PhotoCredits.tsx);
  the landing and selector each carry only a small muted "Photo credits" footer link to it, so the
  attribution stays compliant without cluttering the page. Only curated landmarks have a photo.
- **POI picker — responsive two-mode** ([`components/Selector.tsx`](components/Selector.tsx)): the
  selector renders **both** views and lets **CSS** pick (no `matchMedia`/JS gate — that read stale
  under device emulation and risked a hydration mismatch; CSS `@media` is reliable and flash-free):
  - **Tablet/desktop (≥ sm): image-forward card grid** (`hidden sm:block`; `grid-cols-2
    sm:grid-cols-3`, grouped by category `<fieldset>`/`<legend>`) — each card is a `4/3` `next/image`
    (category line-icon placeholder for the ~5 POIs without a photo) above the name + muted hours. The
    whole card is the tap target wrapping a visually-hidden (but focusable) checkbox; selected = coral
    border + ring and a coral check badge top-right. Mirrors the landing's featured cards.
  - **Phone (< sm): swipe deck** ([`components/PoiSwipeDeck.tsx`](components/PoiSwipeDeck.tsx),
    `sm:hidden`) — a Tinder-style stack of one place at a time (two cards peeking behind for depth)
    so the traveler *looks before deciding*. A big `next/image` fills the card; category eyebrow,
    name, hours, and a 2-line note sit below. **Swipe right / tap ✓ = add, swipe left / tap ✕ = skip**;
    pointer-drag follows the finger with rotation and a fading **Add**/**Skip** stamp, commits past an
    80px threshold (else springs back), and **axis-locks** so vertical drags still scroll the page
    (`touch-action: pan-y`). Buttons (✕ / ↶ undo / ✓) are the accessible + non-swipe path; ←/→ arrow
    keys also work. A header shows `N of total` + `N added`; an end card summarizes and offers
    *Undo* / *Start over*. Both modes share one selection `Set` (via `setSelectedOne(id, value)`), so
    the sticky CTA count and the result are identical however you pick. `hoursLabel`
    ([`lib/poi-format.ts`](lib/poi-format.ts)) and `CategoryGlyph`
    ([`components/CategoryGlyph.tsx`](components/CategoryGlyph.tsx)) are shared by both so the card
    copy can't drift.
- **Sticky CTA bar:** fixed to the viewport bottom, top border, centered to the container width.
- **Stop card** ([`components/ResultView.tsx`](components/ResultView.tsx)): icon (⚠/✕ when flagged) +
  stop number (muted) + arrival time (semibold) + name (semibold) on line 1; `~N min · status` on
  line 2; optional italic muted notes on line 3; a **"Why this stop:" reason line** on line 4 (top
  hairline divider, `text-xs`) explaining the scheduler's ordering choice. Background = flag tint per
  state. The reason line **prints** with the list (it's the faithful record); on clear cards it is
  `text-[var(--color-text-muted)]`, on flagged cards it inherits the card's flag text colour at full
  opacity to keep WCAG AA contrast on the tint. Copy comes from `reasonLine`
  ([`lib/reason.ts`](lib/reason.ts)) — the **single source of truth** the page and both exports share.
  For an `optimized` stop it renders the scheduler's structured `reason` data, so it can never claim
  something the algorithm didn't do (e.g. it only says "closes earliest" when closing time *strictly*
  decided a tie); for a **pinned** stop it says "Pinned by you — the rest of the day was optimized
  around it," and for a **hand-arranged** stop "You placed this stop here." A user-placed stop never
  shows an algorithmic claim, on the page or in the copied text / `.ics`.
- **Reorder & pin (lock)** ([`components/ResultView.tsx`](components/ResultView.tsx)): the day is
  yours to arrange — the optimizer only sequences what you haven't pinned. Each stop card carries
  screen-only `↑ ↓` move controls and a **pin** toggle (an inline lock glyph, coral-filled when
  pinned). A controls bar reads "Reorder with ↑ ↓…" by default and switches to "Your order · N pinned"
  with **Re-optimize unpinned** (reflows the free stops by nearest-neighbor while pinned stops hold
  their slot) and **Reset to auto** once customized. State is the single source of truth in the **URL**
  (`order` + `locked` params via [`lib/params.ts`](lib/params.ts)), written with `router.replace`
  (`scroll:false`) so every arrangement stays shareable + refresh-safe without piling up history.
  Placement is computed faithfully: a stop is labelled `optimized` only when the working order equals
  `optimizeOrder(order, locked)` (what the algorithm would produce given the pins); otherwise the
  unpinned stops are `manual`. Map, list, and exports all re-derive from the chosen order, so they
  never disagree.
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
