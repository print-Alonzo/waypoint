import type { ScheduledStop, TransportMode } from './scheduler'
import { SPEED_KMH } from './scheduler'

// Rough fare estimator for Metro Manila transport. Like every number in Waypoint
// these are ESTIMATES and are always shown as a labeled RANGE — never a precise
// figure that would imply more certainty than we have. We only know each leg's
// transit minutes, so distance is backed out via the scheduler's own speed model
// (SPEED_KMH) to keep this consistent with the times shown on the page.
//
// Rate assumptions (2024-era, deliberately conservative bands):
//   walk    — free.
//   jeepney — ~₱13 minimum (first 4 km) + ~₱1.80/km after; a longer leg often needs
//             a transfer, so the high end allows for two rides.
//   grab    — ~₱45 flagdown + ~₱15/km + ~₱2/min; the high end allows for surge.

export type FareRange = { low: number; high: number } // pesos

function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step
}

export function legFare(minutes: number, mode: TransportMode): FareRange {
  if (mode === 'walk' || minutes <= 0) return { low: 0, high: 0 }
  const km = (minutes / 60) * SPEED_KMH[mode]

  if (mode === 'jeepney') {
    const oneRide = 13 + Math.max(0, km - 4) * 1.8
    const low = Math.max(13, Math.round(oneRide))
    // Legs beyond ~6 km usually mean a transfer (≈ a second minimum fare).
    const high = km > 6 ? Math.round(oneRide + 13) : Math.round(oneRide * 1.3)
    return { low, high: Math.max(high, low) }
  }

  // grab
  const base = 45 + km * 15 + minutes * 2
  return { low: roundTo(base, 5), high: roundTo(base * 1.5, 5) }
}

export function dayFare(stops: ScheduledStop[], mode: TransportMode): FareRange {
  return stops.reduce<FareRange>(
    (acc, s) => {
      // The first stop's transitFromPrev is the leg from the start location.
      const leg = legFare(s.transitFromPrev, mode)
      return { low: acc.low + leg.low, high: acc.high + leg.high }
    },
    { low: 0, high: 0 },
  )
}

// Display a range as "₱low–high" (or "₱n" when collapsed, "Free" when zero).
export function formatFare(r: FareRange): string {
  if (r.high <= 0) return 'Free'
  if (r.low === r.high) return `₱${r.low}`
  return `₱${r.low}–${r.high}`
}
