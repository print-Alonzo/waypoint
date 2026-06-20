export type POI = {
  id: string
  name: string
  category: string
  lat: number
  lng: number
  open_time: string
  close_time: string
  closed_days: string[]
  recommended_duration_minutes: number
  notes: string | null
  // Optional featured photo (only curated landmarks have one). CC-licensed; the
  // credit must be displayed wherever the image is shown.
  image?: string
  image_credit?: {
    author: string
    license: string
    license_url: string
    source_url: string
  }
}

export type TransitMatrix = {
  [originId: string]: {
    [destId: string]: {
      walk: number
      jeepney: number
      grab: number
      _note?: string
    }
  }
}

export type TransportMode = 'walk' | 'jeepney' | 'grab'

// Faithful, structured account of WHY this stop landed in this position — emitted
// by the algorithm's own selection step (not re-derived), so it can never drift
// from the actual decision. Presentation/wording lives in lib/reason.ts.
export type StopReason = {
  prevName: string | null // null → measured from the start location
  minTransit: number // nearest candidate's transit (minutes)
  maxTransit: number // farthest transit within the 5-min tie group
  tieGroupSize: number // candidates within the 5-min tie window (1 = decided by distance)
  decidedByClose: boolean // true only when the winner closes STRICTLY earlier than every tie member
  closeTime: string // winner's close_time (for the "closes earliest" clause)
}

// Who decided this stop's position. Drives the faithful "Why this stop" line:
// only an 'optimized' stop may show the algorithm's nearest-neighbor reasoning.
//   optimized → placed by the nearest-neighbor optimizer (carries a real reason)
//   locked    → pinned to this position by the user; the optimizer worked around it
//   manual    → the user hand-arranged this order (no algorithmic claim)
// Optional so existing ScheduledStop literals (test factories) stay valid;
// `undefined` is treated as 'optimized'.
export type Placement = 'optimized' | 'locked' | 'manual'

export type ScheduledStop = {
  poi: POI
  arrivalTime: number
  departureTime: number
  transitFromPrev: number
  yellowFlag: boolean
  redFlag: boolean
  reason: StopReason
  placement?: Placement
  // When a reserved lunch window was taken immediately before this stop, the block
  // (minutes from midnight) so the UI/exports can show it. Absent ⇒ no lunch here.
  lunchBefore?: { start: number; end: number }
}

// A fixed reserved break (minutes from midnight) threaded into scheduleAlong.
export type LunchWindow = { start: number; end: number }

export function parseTime(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function formatTime(minutes: number): string {
  const clamped = Math.min(minutes, 1439)
  const suffix = minutes > 1439 ? '+' : ''
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}${suffix}`
}

export const SPEED_KMH: Record<TransportMode, number> = { walk: 4, jeepney: 12, grab: 20 }

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Straight-line transit estimate (minutes) between two points for a mode. This is
// the SAME haversine + speed model getTransitTime falls back to and the matrix
// generator uses, exported so the return-leg estimate (fit.ts) can't drift from it.
// The matrix is one-directional (start→POI, POI→POI only), so the trip *home* has
// no matrix row — this is the honest estimate for it.
export function estimateTransitMinutes(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  mode: TransportMode,
): number {
  const distKm = haversineKm(from.lat, from.lng, to.lat, to.lng)
  return Math.ceil((distKm / SPEED_KMH[mode]) * 60)
}

function getTransitTime(
  matrix: TransitMatrix,
  fromId: string,
  toId: string,
  mode: TransportMode,
  fromCoords: { lat: number; lng: number },
  toCoords: { lat: number; lng: number },
): number {
  const entry = matrix[fromId]?.[toId]
  if (entry) return entry[mode]

  console.warn('Missing transit matrix entry', { from: fromId, to: toId, mode })
  return estimateTransitMinutes(fromCoords, toCoords, mode)
}

type Selection = {
  poi: POI
  transit: number
  minTransit: number
  maxTransit: number
  tieGroupSize: number
  decidedByClose: boolean
}

function selectNext(candidates: Array<{ poi: POI; transit: number }>): Selection {
  // Defensive: an empty list would make Math.min(...[]) = Infinity and
  // [].reduce(...) throw a raw "Reduce of empty array". optimizeOrder only ever
  // hits this with duplicate POI ids (free Set < positions); callers dedupe their
  // input, and ResultView additionally catches this to redirect gracefully.
  if (candidates.length === 0) {
    throw new Error('selectNext: no candidates (duplicate or empty POI input)')
  }
  const minTransit = Math.min(...candidates.map((c) => c.transit))
  const tieGroup = candidates.filter((c) => c.transit - minTransit < 5)
  const maxTransit = Math.max(...tieGroup.map((c) => c.transit))

  // Winner = earliest close_time within the tie group. Strict `<` means when two
  // members share the earliest close_time the first (array order) wins — IDENTICAL
  // to the original behaviour, so existing selection-winner tests are unaffected.
  const winner = tieGroup.reduce((best, curr) =>
    parseTime(curr.poi.close_time) < parseTime(best.poi.close_time) ? curr : best,
  )

  // True only when close_time STRICTLY decided it: the winner closes earlier than
  // every other tie-group member. If the earliest close is shared, array order
  // (not closing time) broke the tie — so the explanation must not claim
  // "closes earliest" in that case.
  const winnerClose = parseTime(winner.poi.close_time)
  const decidedByClose =
    tieGroup.length > 1 &&
    tieGroup.every(
      (c) => c.poi.id === winner.poi.id || winnerClose < parseTime(c.poi.close_time),
    )

  return {
    poi: winner.poi,
    transit: winner.transit,
    minTransit,
    maxTransit,
    tieGroupSize: tieGroup.length,
    decidedByClose,
  }
}

// Greedy nearest-neighbor that fills the visit order, keeping any `lockedIds` POI
// fixed at its index in `orderedPOIs` and slotting the rest nearest-next around
// them. Pure. With an EMPTY lock set it reproduces scheduleItinerary's order and
// per-stop reasons exactly (locked in by an equivalence test) — they share
// `selectNext`, and candidates are filtered in `orderedPOIs` order so the
// array-order tie-break is identical. Returns the resolved POI order plus, for
// each optimizer-PLACED (free) stop, its faithful StopReason (locked stops are
// pinned by the user, so they get no algorithmic reason).
export function optimizeOrder(
  orderedPOIs: POI[],
  lockedIds: Set<string>,
  transitMatrix: TransitMatrix,
  startLocationId: string,
  startLocationCoords: { lat: number; lng: number },
  transportMode: TransportMode,
): { order: POI[]; reasonById: Record<string, StopReason> } {
  const lockedAt = new Map<number, POI>()
  orderedPOIs.forEach((p, i) => {
    if (lockedIds.has(p.id)) lockedAt.set(i, p)
  })
  const free = new Set(orderedPOIs.filter((p) => !lockedIds.has(p.id)).map((p) => p.id))

  const order: POI[] = []
  const reasonById: Record<string, StopReason> = {}
  let prevId = startLocationId
  let prevCoords: { lat: number; lng: number } = startLocationCoords
  let prevName: string | null = null

  for (let pos = 0; pos < orderedPOIs.length; pos++) {
    const locked = lockedAt.get(pos)
    if (locked) {
      order.push(locked)
      prevId = locked.id
      prevCoords = { lat: locked.lat, lng: locked.lng }
      prevName = locked.name
      continue
    }

    const candidates = orderedPOIs
      .filter((p) => free.has(p.id))
      .map((poi) => ({
        poi,
        transit: getTransitTime(transitMatrix, prevId, poi.id, transportMode, prevCoords, poi),
      }))

    const sel = selectNext(candidates)
    free.delete(sel.poi.id)
    order.push(sel.poi)
    reasonById[sel.poi.id] = {
      prevName,
      minTransit: sel.minTransit,
      maxTransit: sel.maxTransit,
      tieGroupSize: sel.tieGroupSize,
      decidedByClose: sel.decidedByClose,
      closeTime: sel.poi.close_time,
    }
    prevId = sel.poi.id
    prevCoords = { lat: sel.poi.lat, lng: sel.poi.lng }
    prevName = sel.poi.name
  }

  return { order, reasonById }
}

// Compute arrival/departure/transit/flags for a FIXED visit order (no reordering).
// `decorate` supplies each stop's placement + reason from the caller's context
// (who placed it); omitted ⇒ 'optimized' with a distance-only reason. Pure.
export function scheduleAlong(
  orderedPOIs: POI[],
  transitMatrix: TransitMatrix,
  startLocationId: string,
  startLocationCoords: { lat: number; lng: number },
  startTime: string,
  transportMode: TransportMode,
  dayOfWeek: string,
  decorate?: (
    poi: POI,
    index: number,
    prevName: string | null,
    transit: number,
  ) => { placement: Placement; reason: StopReason },
  // Optional reserved lunch window. The break is taken once, immediately before the
  // first stop you'd otherwise reach at/after `start`; subsequent arrivals shift
  // later by the time it consumes. Pure: same inputs ⇒ same schedule.
  lunch?: LunchWindow | null,
): ScheduledStop[] {
  let prevId = startLocationId
  let prevCoords: { lat: number; lng: number } = startLocationCoords
  let prevName: string | null = null
  let currentTime = parseTime(startTime)
  let lunchTaken = false

  return orderedPOIs.map((poi, i) => {
    const transit = getTransitTime(transitMatrix, prevId, poi.id, transportMode, prevCoords, poi)
    let arrival = currentTime + transit

    // Reserve the lunch window before the first stop that would land at/after it.
    // If lunchtime has already passed by the time we get here, mark it done without
    // inserting a block (no point reserving a window in the past).
    let lunchBefore: LunchWindow | undefined
    if (lunch && !lunchTaken && arrival >= lunch.start) {
      lunchTaken = true
      if (currentTime < lunch.end) {
        // Display the break from when the traveler is ACTUALLY free (just finished
        // the prior stop / the day's start) — never earlier than that, so we don't
        // claim a lunch that began before the trip or during the previous visit.
        lunchBefore = { start: Math.max(lunch.start, currentTime), end: lunch.end }
        currentTime = lunch.end
        arrival = currentTime + transit
      }
    }

    const departure = arrival + Math.max(poi.recommended_duration_minutes, 1)
    const decorated = decorate?.(poi, i, prevName, transit) ?? {
      placement: 'optimized' as Placement,
      reason: {
        prevName,
        minTransit: transit,
        maxTransit: transit,
        tieGroupSize: 1,
        decidedByClose: false,
        closeTime: poi.close_time,
      },
    }
    const stop: ScheduledStop = {
      poi,
      arrivalTime: arrival,
      departureTime: departure,
      transitFromPrev: transit,
      yellowFlag: arrival > parseTime(poi.close_time),
      redFlag: poi.closed_days.includes(dayOfWeek),
      reason: decorated.reason,
      placement: decorated.placement,
      ...(lunchBefore ? { lunchBefore } : {}),
    }
    prevId = poi.id
    prevCoords = { lat: poi.lat, lng: poi.lng }
    prevName = poi.name
    currentTime = departure
    return stop
  })
}

// Full optimize + schedule (the default, no locks). Thin wrapper over
// optimizeOrder + scheduleAlong so there is ONE nearest-neighbor implementation.
export function scheduleItinerary(
  selectedPOIs: POI[],
  transitMatrix: TransitMatrix,
  startLocationId: string,
  startLocationCoords: { lat: number; lng: number },
  startTime: string,
  transportMode: TransportMode,
  dayOfWeek: string,
): ScheduledStop[] {
  if (selectedPOIs.length === 0) return []

  const { order, reasonById } = optimizeOrder(
    selectedPOIs,
    new Set(),
    transitMatrix,
    startLocationId,
    startLocationCoords,
    transportMode,
  )

  return scheduleAlong(
    order,
    transitMatrix,
    startLocationId,
    startLocationCoords,
    startTime,
    transportMode,
    dayOfWeek,
    (poi) => ({ placement: 'optimized', reason: reasonById[poi.id] }),
  )
}
