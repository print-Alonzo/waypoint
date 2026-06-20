import type { ScheduledStop } from './scheduler'
import { parseTime } from './scheduler'
import type { ScheduleParams } from './params'
import { modeLabel } from './constants'
import { reasonText } from './reason'

// Share / export of a planned itinerary as copyable plain text and an RFC 5545
// (.ics) calendar file. Kept PURE (no DOM, no ambient Date) so it is unit-testable
// and the wording/encoding is locked by tests — exactly like lib/reason.ts. The
// caller (ResultView) owns the side effects (clipboard, Blob download) and injects
// `now` into buildIcs.
//
// Faithfulness is the whole point of Waypoint: the export MUST carry the same
// closed / check-hours flags the result page shows. Dropping or contradicting a
// flag here would be the single worst failure mode, so the status/tag helpers
// below are the ONE source of truth shared by the page, the map, and both exports.

export type ExportInput = {
  stops: ScheduledStop[]
  params: ScheduleParams
  startLocationName: string
  cityLabel: string
  shareUrl: string
}

// --- shared status + flag tags (single source of truth: UI + map + exports) ---

// Per-stop status line. redFlag short-circuits: a stop can be BOTH closed-day
// (red) AND past-close (yellow); closed wins, identical to the result page.
export function stopStatusLine(stop: ScheduledStop): string {
  if (stop.redFlag) return 'Closed today'
  if (stop.yellowFlag) return 'Check hours before visiting'
  return `open until ${stop.poi.close_time}`
}

// Canonical bracket tag, identical in BOTH text and .ics (no "[CLOSED]" vs
// "[CLOSED TODAY]" drift). Empty for a clear stop. Same red-wins precedence.
export function stopTag(stop: ScheduledStop): string {
  if (stop.redFlag) return '[CLOSED]'
  if (stop.yellowFlag) return '[CHECK HOURS]'
  return ''
}

// --- time helpers ---------------------------------------------------------

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

// True wall-clock for minutes-from-midnight, WITHOUT scheduler.formatTime's 1439
// clamp (which would render 01:00-next-day as "23:59+"). This keeps the text
// export's arrival time in agreement with the .ics date roll for past-midnight
// stops. A "(+Nd)" suffix marks days carried over.
export function wallClock(minutes: number): string {
  const mins = ((minutes % 1440) + 1440) % 1440
  const dayOffset = Math.floor(minutes / 1440)
  const hhmm = `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`
  return dayOffset > 0 ? `${hhmm} (+${dayOffset}d)` : hhmm
}

// Civil (timezone-free) calendar date; m is 1-12.
export type CivilDate = { y: number; m: number; d: number }

// Pure, UTC-based date arithmetic — no ambient timezone, handles month/year
// rollover. (Date.UTC with explicit fields is deterministic, unlike Date.now.)
function addDaysCivil(c: CivilDate, days: number): CivilDate {
  const dt = new Date(Date.UTC(c.y, c.m - 1, c.d + days))
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() }
}

// Day-name → JS getDay() index (Sunday = 0). NOTE: this is Sunday-first, unlike
// constants.DAYS_OF_WEEK (Monday-first) — do not derive the index from that list
// or every event lands one day early.
const JS_DAY: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
}

// Today's civil date + weekday IN ASIA/MANILA, derived from `now`. A traveler
// whose laptop is still on their home timezone would otherwise anchor the trip to
// the wrong calendar day; reading `now` through Asia/Manila fixes that while
// staying pure (Intl.formatToParts is deterministic for a given Date).
function manilaToday(now: Date): CivilDate & { wd: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return {
    y: Number(get('year')),
    m: Number(get('month')),
    d: Number(get('day')),
    wd: JS_DAY[get('weekday')] ?? 0,
  }
}

// Civil date (Asia/Manila) of the next occurrence of dayOfWeek, counting TODAY
// when it matches (offset 0). Offset 0 supports same-day replanning; it can place
// an event earlier today if the start_time has already passed — intentional.
export function nextTripDate(now: Date, dayOfWeek: string): CivilDate {
  const today = manilaToday(now)
  const target = JS_DAY[dayOfWeek]
  if (target === undefined) return { y: today.y, m: today.m, d: today.d }
  const offset = (target - today.wd + 7) % 7
  return addDaysCivil(today, offset)
}

// Floating local time stamp "YYYYMMDDTHHMMSS" (no Z, no TZID): the wall clock the
// tourist follows on the ground. Rolls the date for minutes >= 1440 (past
// midnight), so DTEND stays after DTSTART across midnight.
function floatingStamp(date: CivilDate, minutes: number): string {
  const dayOffset = Math.floor(minutes / 1440)
  const mins = ((minutes % 1440) + 1440) % 1440
  const d = addDaysCivil(date, dayOffset)
  return `${d.y}${pad(d.m)}${pad(d.d)}T${pad(Math.floor(mins / 60))}${pad(mins % 60)}00`
}

// UTC stamp with trailing Z — the one field that must be absolute (DTSTAMP).
function utcStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

// --- RFC 5545 encoding ----------------------------------------------------

// Escape a TEXT value (RFC 5545 §3.3.11). Backslash FIRST to avoid double-escape;
// ':' is intentionally NOT escaped (legal in TEXT, e.g. "Last entry 17:30").
function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

// Fold one content line to <= 75 OCTETS (RFC 5545 §3.1) with CRLF + a single
// leading space; the space counts as 1 of the 75. Splits only on UTF-8 codepoint
// boundaries (iterating `line` yields whole codepoints). Run over EVERY assembled
// line (UID/GEO/URL too), so a long value can never emit an over-length line.
function foldLine(line: string): string {
  const enc = new TextEncoder()
  let out = ''
  let bytes = 0
  for (const ch of line) {
    const chBytes = enc.encode(ch).length
    if (bytes + chBytes > 75) {
      out += '\r\n '
      bytes = 1 // the continuation's leading space
    }
    out += ch
    bytes += chBytes
  }
  return out
}

function allClosed(stops: ScheduledStop[]): boolean {
  return stops.length > 0 && stops.every((s) => s.redFlag)
}

export function buildIcs(input: ExportInput, now: Date): string {
  const { stops, params, startLocationName, cityLabel, shareUrl } = input
  const trip = nextTripDate(now, params.day_of_week)
  const tripStamp = `${trip.y}${pad(trip.m)}${pad(trip.d)}`
  const stamp = utcStamp(now)
  const mode = modeLabel(params.transport_mode)

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Waypoint//Itinerary//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(`Waypoint — ${cityLabel} (${params.day_of_week})`)}`,
  ]
  if (allClosed(stops)) {
    lines.push(
      `X-WR-CALDESC:${escapeText(
        `All selected places are closed on ${params.day_of_week}. Verify before traveling.`,
      )}`,
    )
  }

  stops.forEach((stop, i) => {
    const from = stop.reason.prevName ?? startLocationName
    const descParts = [
      stopStatusLine(stop),
      `From ${from}: ${stop.transitFromPrev} min by ${mode}`,
      `Why this stop: ${reasonText(stop.reason, params.transport_mode)}`,
    ]
    if (stop.poi.notes) descParts.push(stop.poi.notes)
    descParts.push('Estimated — verify with Google Maps.')

    const tag = stopTag(stop)
    const summary = `${tag ? tag + ' ' : ''}${i + 1}. ${stop.poi.name}`
    // DTEND must be strictly after DTSTART so every stop is a visible block, even
    // if a future POI ever has a zero recommended duration.
    const endMin =
      stop.departureTime > stop.arrivalTime ? stop.departureTime : stop.arrivalTime + 1

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${tripStamp}-${i + 1}-${stop.poi.id}@waypoint.app`)
    lines.push(`DTSTAMP:${stamp}`)
    lines.push(`DTSTART:${floatingStamp(trip, stop.arrivalTime)}`)
    lines.push(`DTEND:${floatingStamp(trip, endMin)}`)
    lines.push(`SUMMARY:${escapeText(summary)}`)
    lines.push(`DESCRIPTION:${escapeText(descParts.join('\n'))}`)
    lines.push(`LOCATION:${escapeText(stop.poi.name)}`)
    lines.push(`GEO:${stop.poi.lat};${stop.poi.lng}`)
    lines.push(`URL:${shareUrl}`) // URI value type — not TEXT-escaped (RFC 5545 §3.8.4.6)
    if (stop.redFlag) {
      // Keep closed stops VISIBLE (never hide a stop) but mark them not-busy; the
      // [CLOSED] SUMMARY prefix survives time-grid/notification truncation. We
      // deliberately avoid STATUS:CANCELLED — some importers drop cancelled
      // events, which would hide the stop and break the transparency guarantee.
      lines.push('TRANSP:TRANSPARENT')
    } else if (stop.yellowFlag) {
      lines.push('STATUS:TENTATIVE')
    } else {
      lines.push('STATUS:CONFIRMED')
    }
    lines.push('END:VEVENT')
  })

  lines.push('END:VCALENDAR')

  // Fold every assembled line, then CRLF-join with a trailing CRLF.
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

export function buildItineraryText(input: ExportInput): string {
  const { stops, params, startLocationName, cityLabel, shareUrl } = input
  const mode = modeLabel(params.transport_mode)
  const flagged = stops.filter((s) => s.yellowFlag || s.redFlag).length

  // Mirror the result page's span/hours figure so header numbers agree.
  const spanMinutes =
    stops.length > 0
      ? stops[stops.length - 1].departureTime - parseTime(params.start_time)
      : 0
  const approxHours = Math.max(1, Math.round(spanMinutes / 60))

  const out: string[] = [
    `${cityLabel} itinerary — ${params.day_of_week}`,
    `Starting from ${startLocationName} · ${mode}`,
    `${stops.length} ${stops.length === 1 ? 'stop' : 'stops'} · ~${approxHours}h · ${flagged} flagged`,
  ]
  if (allClosed(stops)) {
    out.push(`Heads up: every selected place is closed on ${params.day_of_week}.`)
  }
  out.push('')

  stops.forEach((stop, i) => {
    if (i > 0) out.push(`   ↓ ${stop.transitFromPrev} min by ${mode}`)
    const tag = stopTag(stop)
    out.push(`${i + 1}. ${wallClock(stop.arrivalTime)}  ${stop.poi.name}${tag ? '  ' + tag : ''}`)
    out.push(`   ~${stop.poi.recommended_duration_minutes} min · ${stopStatusLine(stop)}`)
    out.push(`   Why this stop: ${reasonText(stop.reason, params.transport_mode)}`)
    if (stop.poi.notes) out.push(`   ${stop.poi.notes}`)
  })

  out.push('', `Plan: ${shareUrl}`, 'Times are estimates — verify with Google Maps.')
  return out.join('\n')
}

// --- download filename ----------------------------------------------------

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function icsFilename(cityLabel: string, dayOfWeek: string): string {
  return `waypoint-${slugify(cityLabel)}-${slugify(dayOfWeek)}.ics`
}
