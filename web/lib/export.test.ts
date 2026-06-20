import { describe, it, expect } from 'vitest'

import {
  buildIcs,
  buildItineraryText,
  nextTripDate,
  icsFilename,
  slugify,
  wallClock,
  type ExportInput,
} from './export'
import type { POI, ScheduledStop } from './scheduler'
import type { ScheduleParams } from './params'

// --- fixtures -------------------------------------------------------------

function poi(over: Partial<POI> = {}): POI {
  return {
    id: 'fort-santiago',
    name: 'Fort Santiago',
    category: 'heritage',
    lat: 14.5942,
    lng: 120.9707,
    open_time: '08:00',
    close_time: '17:00',
    closed_days: [],
    recommended_duration_minutes: 60,
    notes: null,
    ...over,
  }
}

function stop(over: Partial<ScheduledStop> = {}): ScheduledStop {
  return {
    poi: poi(over.poi),
    arrivalTime: 540, // 09:00
    departureTime: 600, // 10:00
    transitFromPrev: 6,
    yellowFlag: false,
    redFlag: false,
    reason: {
      prevName: null,
      minTransit: 6,
      maxTransit: 6,
      tieGroupSize: 1,
      decidedByClose: false,
      closeTime: '17:00',
    },
    ...over,
  }
}

const PARAMS: ScheduleParams = {
  poi_ids: ['fort-santiago'],
  start_time: '09:00',
  transport_mode: 'grab',
  start_location: 'rizal-park',
  day_of_week: 'Tuesday',
}

function input(stops: ScheduledStop[], over: Partial<ExportInput> = {}): ExportInput {
  return {
    stops,
    params: PARAMS,
    startLocationName: 'Rizal Park',
    cityLabel: 'Metro Manila',
    shareUrl: 'http://localhost/result?poi_ids=fort-santiago',
    ...over,
  }
}

// 2026-06-20T04:00:00Z == 2026-06-20 12:00 in Asia/Manila, a Saturday.
// → the next Tuesday is 2026-06-23.
const NOW = new Date('2026-06-20T04:00:00Z')

// --- ICS helpers ----------------------------------------------------------

const enc = new TextEncoder()
const byteLen = (s: string) => enc.encode(s).length
// Unfold per RFC 5545: a CRLF immediately followed by a single space is a fold.
const unfold = (ics: string) => ics.replace(/\r\n /g, '')
const logicalLines = (ics: string) => unfold(ics).split('\r\n')
const physicalLines = (ics: string) => ics.split('\r\n')

// --- structure ------------------------------------------------------------

describe('buildIcs — structure', () => {
  it('wraps events in a conformant VCALENDAR', () => {
    const ics = buildIcs(input([stop()]), NOW)
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('VERSION:2.0')
    expect(ics).toContain('PRODID:-//Waypoint//Itinerary//EN')
    expect(ics).toContain('CALSCALE:GREGORIAN')
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
  })

  it('emits exactly one VEVENT per stop', () => {
    const ics = buildIcs(input([stop(), stop({ poi: poi({ id: 'b', name: 'B' }) })]), NOW)
    expect(physicalLines(ics).filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(2)
    expect(physicalLines(ics).filter((l) => l === 'END:VEVENT')).toHaveLength(2)
  })

  it('ends with a trailing CRLF', () => {
    expect(buildIcs(input([stop()]), NOW).endsWith('\r\n')).toBe(true)
  })
})

// --- times ----------------------------------------------------------------

describe('buildIcs — times', () => {
  it('anchors DTSTART/DTEND to the next occurrence of the trip day', () => {
    const u = unfold(buildIcs(input([stop()]), NOW))
    expect(u).toContain('DTSTART:20260623T090000') // next Tue, 09:00
    expect(u).toContain('DTEND:20260623T100000') // 10:00
  })

  it('stamps DTSTAMP from the injected now in UTC', () => {
    expect(buildIcs(input([stop()]), NOW)).toContain('DTSTAMP:20260620T040000Z')
  })

  it('rolls the date for past-midnight arrival/departure', () => {
    const u = unfold(buildIcs(input([stop({ arrivalTime: 1500, departureTime: 1560 })]), NOW))
    expect(u).toContain('DTSTART:20260624T010000') // +1 day, 01:00
    expect(u).toContain('DTEND:20260624T020000') // +1 day, 02:00
  })

  it('keeps DTSTART/DTEND floating — no Z and no TZID', () => {
    const u = unfold(buildIcs(input([stop()]), NOW))
    for (const l of u.split('\r\n')) {
      if (l.startsWith('DTSTART') || l.startsWith('DTEND')) {
        expect(l).not.toContain('Z')
        expect(l).not.toContain('TZID')
      }
    }
  })

  it('forces DTEND strictly after DTSTART for a zero-duration stop', () => {
    const u = unfold(buildIcs(input([stop({ arrivalTime: 540, departureTime: 540 })]), NOW))
    expect(u).toContain('DTSTART:20260623T090000')
    expect(u).toContain('DTEND:20260623T090100') // arrival + 1 min
  })
})

// --- faithfulness / flags -------------------------------------------------

describe('buildIcs — flags mirror the result page', () => {
  it('a closed+late stop shows only [CLOSED] (red wins), never [CHECK HOURS]', () => {
    const u = unfold(buildIcs(input([stop({ redFlag: true, yellowFlag: true })]), NOW))
    const summary = u.split('\r\n').find((l) => l.startsWith('SUMMARY'))!
    expect(summary).toContain('[CLOSED]')
    expect(summary).not.toContain('[CHECK HOURS]')
    expect(u).toContain('DESCRIPTION:Closed today')
    // Kept visible (no STATUS:CANCELLED) but marked not-busy.
    expect(u).toContain('TRANSP:TRANSPARENT')
    expect(u).not.toContain('STATUS:CANCELLED')
  })

  it('a yellow stop is [CHECK HOURS] + STATUS:TENTATIVE', () => {
    const u = unfold(buildIcs(input([stop({ yellowFlag: true })]), NOW))
    expect(u.split('\r\n').find((l) => l.startsWith('SUMMARY'))).toContain('[CHECK HOURS]')
    expect(u).toContain('STATUS:TENTATIVE')
  })

  it('a clear stop has no bracket tag and STATUS:CONFIRMED', () => {
    const u = unfold(buildIcs(input([stop()]), NOW))
    const summary = u.split('\r\n').find((l) => l.startsWith('SUMMARY'))!
    expect(summary).toBe('SUMMARY:1. Fort Santiago')
    expect(u).toContain('STATUS:CONFIRMED')
  })

  it('surfaces the all-closed warning in X-WR-CALDESC', () => {
    const u = unfold(buildIcs(input([stop({ redFlag: true }), stop({ poi: poi({ id: 'b', name: 'B' }), redFlag: true })]), NOW))
    expect(u).toContain('X-WR-CALDESC:All selected places are closed on Tuesday.')
  })

  it('carries the reason, notes and the estimate caveat into DESCRIPTION', () => {
    const u = unfold(buildIcs(input([stop({ poi: poi({ notes: 'Last entry 16:30' }) })]), NOW))
    const desc = u.split('\r\n').find((l) => l.startsWith('DESCRIPTION'))!
    expect(desc).toContain('Why this stop: Closest to your start')
    expect(desc).toContain('Last entry 16:30')
    expect(desc).toContain('Estimated — verify with Google Maps.')
    expect(desc).toContain('From Rizal Park: 6 min by Grab')
  })
})

// --- encoding -------------------------------------------------------------

describe('buildIcs — RFC 5545 encoding', () => {
  it('escapes backslash, semicolon and comma in TEXT values', () => {
    const u = unfold(buildIcs(input([stop({ poi: poi({ name: 'A, B; C\\D' }) })]), NOW))
    const summary = u.split('\r\n').find((l) => l.startsWith('SUMMARY'))!
    expect(summary).toContain('A\\, B\\; C\\\\D')
  })

  it('escapes newlines in DESCRIPTION as literal \\n with no raw break', () => {
    const u = unfold(buildIcs(input([stop({ poi: poi({ notes: 'line1\nline2' }) })]), NOW))
    const desc = u.split('\r\n').find((l) => l.startsWith('DESCRIPTION'))!
    expect(desc).toContain('line1\\nline2')
  })

  it('escapes bare CR/LF inside a value so only structural CRLFs remain', () => {
    // notes carries all three break forms; escapeText must collapse each to \n.
    const ics = buildIcs(input([stop({ poi: poi({ notes: 'a\rb\nc\r\nd' }) })]), NOW)
    const stripped = ics.replace(/\r\n/g, '')
    expect(stripped).not.toContain('\n')
    expect(stripped).not.toContain('\r')
    const desc = unfold(ics)
      .split('\r\n')
      .find((l) => l.startsWith('DESCRIPTION'))!
    expect(desc).toContain('a\\nb\\nc\\nd')
  })

  it('folds every physical line to <= 75 octets, continuations led by a space', () => {
    const ics = buildIcs(input([stop({ poi: poi({ notes: 'x'.repeat(300) }) })]), NOW)
    const phys = physicalLines(ics).filter((l) => l.length > 0)
    for (const l of phys) expect(byteLen(l)).toBeLessThanOrEqual(75)
    // The long DESCRIPTION must have produced at least one continuation line.
    expect(phys.some((l) => l.startsWith(' '))).toBe(true)
  })

  it('folds multi-byte UTF-8 by OCTET (not char) and never splits a codepoint', () => {
    // € is 3 bytes; a char-counting fold would emit > 75-octet lines.
    const ics = buildIcs(input([stop({ poi: poi({ notes: '€'.repeat(120) }) })]), NOW)
    const phys = physicalLines(ics).filter((l) => l.length > 0)
    for (const l of phys) expect(byteLen(l)).toBeLessThanOrEqual(75)
    // Proof real multi-byte content was packed by octet: some line has more bytes
    // than chars yet stays within budget (a char-counter could never produce this).
    expect(phys.some((l) => l.length < 75 && byteLen(l) > l.length)).toBe(true)
    // No codepoint was sliced mid-byte (a slice would surface as U+FFFD on unfold).
    expect(unfold(ics)).not.toContain('�')
  })

  it('emits URL as an unescaped URI that round-trips through folding', () => {
    const shareUrl =
      'http://localhost/result?poi_ids=fort-santiago,casa-manila,manila-cathedral,quiapo-market&start_time=09:00'
    const ics = buildIcs(input([stop()], { shareUrl }), NOW)
    // Long enough to fold.
    expect(byteLen('URL:' + shareUrl)).toBeGreaterThan(75)
    const urlLine = logicalLines(ics).find((l) => l.startsWith('URL:'))!
    expect(urlLine).toBe('URL:' + shareUrl) // no backslashes inserted
  })

  it('folds a long UID and round-trips it', () => {
    const longId = 'p'.repeat(80)
    const ics = buildIcs(input([stop({ poi: poi({ id: longId }) })]), NOW)
    expect(physicalLines(ics).every((l) => byteLen(l) <= 75)).toBe(true)
    expect(logicalLines(ics)).toContain(`UID:20260623-1-${longId}@waypoint.app`)
  })

  it('emits GEO as lat;lng', () => {
    expect(unfold(buildIcs(input([stop()]), NOW))).toContain('GEO:14.5942;120.9707')
  })
})

// --- date math ------------------------------------------------------------

describe('nextTripDate (anchored to Asia/Manila)', () => {
  it('returns today when the trip day is today', () => {
    expect(nextTripDate(NOW, 'Saturday')).toEqual({ y: 2026, m: 6, d: 20 })
  })
  it('returns tomorrow for the next day', () => {
    expect(nextTripDate(NOW, 'Sunday')).toEqual({ y: 2026, m: 6, d: 21 })
  })
  it('wraps to the following week', () => {
    expect(nextTripDate(NOW, 'Friday')).toEqual({ y: 2026, m: 6, d: 26 })
  })
  it('falls back to today for an unknown day name', () => {
    expect(nextTripDate(NOW, 'Funday')).toEqual({ y: 2026, m: 6, d: 20 })
  })
  it('wraps across month/year boundaries via UTC date math', () => {
    // 2026-12-31T04:00:00Z = 2026-12-31 12:00 Manila (Thursday) → next Friday = 2027-01-01.
    expect(nextTripDate(new Date('2026-12-31T04:00:00Z'), 'Friday')).toEqual({ y: 2027, m: 1, d: 1 })
    // 2026-06-30 (Tuesday in Manila) → next Wednesday = 2026-07-01.
    expect(nextTripDate(new Date('2026-06-30T04:00:00Z'), 'Wednesday')).toEqual({ y: 2026, m: 7, d: 1 })
  })
})

// --- text export ----------------------------------------------------------

describe('buildItineraryText', () => {
  it('renders the header with city, day, start, mode and summary counts', () => {
    const text = buildItineraryText(input([stop()]))
    expect(text).toContain('Metro Manila itinerary — Tuesday')
    expect(text).toContain('Starting from Rizal Park · Grab')
    expect(text).toContain('1 stop · ~1h · 0 flagged')
  })

  it('preserves stop order and shows the flag marker + transit connector', () => {
    const text = buildItineraryText(
      input([
        stop(),
        stop({
          poi: poi({ id: 'b', name: 'Casa Manila' }),
          redFlag: true,
          transitFromPrev: 8,
          reason: {
            prevName: 'Fort Santiago',
            minTransit: 8,
            maxTransit: 8,
            tieGroupSize: 1,
            decidedByClose: false,
            closeTime: '18:00',
          },
        }),
      ]),
    )
    expect(text.indexOf('Fort Santiago')).toBeLessThan(text.indexOf('Casa Manila'))
    expect(text).toContain('[CLOSED]')
    expect(text).toContain('↓ 8 min by Grab')
    expect(text).toContain('Why this stop:')
  })

  it('includes the share link and the estimate caveat', () => {
    const text = buildItineraryText(input([stop()]))
    expect(text).toContain('Plan: http://localhost/result?poi_ids=fort-santiago')
    expect(text).toContain('Times are estimates — verify with Google Maps.')
  })

  it('shows the all-closed heads-up when every stop is closed', () => {
    const text = buildItineraryText(input([stop({ redFlag: true })]))
    expect(text).toContain('Heads up: every selected place is closed on Tuesday.')
  })

  it('applies red-over-yellow precedence (closed wins, never both tags)', () => {
    const text = buildItineraryText(input([stop({ redFlag: true, yellowFlag: true })]))
    expect(text).toContain('[CLOSED]')
    expect(text).toContain('Closed today')
    expect(text).not.toContain('[CHECK HOURS]')
    expect(text).not.toContain('Check hours before visiting')
  })

  it('renders past-midnight arrival as true wall clock with a day marker', () => {
    const text = buildItineraryText(input([stop({ arrivalTime: 1500, departureTime: 1560 })]))
    expect(text).toContain('01:00 (+1d)')
  })
})

// --- wallClock + filename -------------------------------------------------

describe('wallClock', () => {
  it('formats within-day minutes', () => {
    expect(wallClock(540)).toBe('09:00')
    expect(wallClock(1439)).toBe('23:59')
  })
  it('does NOT clamp past midnight (unlike scheduler.formatTime)', () => {
    expect(wallClock(1440)).toBe('00:00 (+1d)')
    expect(wallClock(1500)).toBe('01:00 (+1d)')
  })
  it('marks multi-day carryover', () => {
    expect(wallClock(2940)).toBe('01:00 (+2d)')
  })
})

describe('icsFilename / slugify', () => {
  it('produces a safe, lowercase, hyphenated filename', () => {
    expect(icsFilename('Metro Manila', 'Monday')).toBe('waypoint-metro-manila-monday.ics')
  })
  it('slugify collapses non-alphanumerics and trims edges', () => {
    expect(slugify('  Metro  Manila! ')).toBe('metro-manila')
  })
})

// --- the cross-artifact invariant the audit flagged ----------------------

describe('all-closed warning fires across both artifacts (every, not some)', () => {
  it('appears in BOTH text and .ics for an all-closed plan', () => {
    const i = input([
      stop({ redFlag: true }),
      stop({ poi: poi({ id: 'b', name: 'B' }), redFlag: true }),
    ])
    expect(buildItineraryText(i)).toContain(
      'Heads up: every selected place is closed on Tuesday.',
    )
    expect(unfold(buildIcs(i, NOW))).toContain(
      'X-WR-CALDESC:All selected places are closed on Tuesday.',
    )
  })

  it('appears in NEITHER when only some stops are closed', () => {
    const mixed = input([
      stop({ redFlag: true }),
      stop({ poi: poi({ id: 'b', name: 'B' }) }),
    ])
    expect(buildItineraryText(mixed)).not.toContain('Heads up:')
    expect(unfold(buildIcs(mixed, NOW))).not.toContain('X-WR-CALDESC:All selected')
  })
})

describe('text and .ics agree on a past-midnight stop', () => {
  it('both render the same wall clock, incl. the +1d marker and the DTEND roll', () => {
    const i = input([stop({ arrivalTime: 1500, departureTime: 1560 })])
    const ics = unfold(buildIcs(i, NOW)).split('\r\n')
    // Text keeps the day marker (not just the bare hour).
    expect(buildItineraryText(i)).toContain('01:00 (+1d)')
    // Both arrival (DTSTART) and departure (DTEND) roll to the next civil date.
    expect(ics.find((l) => l.startsWith('DTSTART'))).toBe('DTSTART:20260624T010000')
    expect(ics.find((l) => l.startsWith('DTEND'))).toBe('DTEND:20260624T020000')
  })
})
