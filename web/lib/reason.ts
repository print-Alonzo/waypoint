import type { ScheduledStop, StopReason, TransportMode } from './scheduler'
import { modeLabel } from './constants'

// Turns the scheduler's structured StopReason into a faithful one-line explanation.
// Kept pure (no React) so it is unit-testable and the wording is locked by tests.
//
// Faithfulness rules (the scheduler picks the nearest stop; within a 5-min tie
// window it picks the earliest-closing one, array order breaking exact close ties):
//   - tieGroupSize === 1        → distance alone decided it ("Closest …").
//   - tie group, strictly earliest close → close_time decided it ("… closes earliest").
//   - tie group, shared earliest close   → neutral phrasing, NO false causal claim.
// The range is minTransit–maxTransit (the band of tied candidates), never the
// winner's own transit — the winner is often the farther, earlier-closing stop.
export function reasonText(reason: StopReason, mode: TransportMode): string {
  const m = modeLabel(mode)

  if (reason.tieGroupSize <= 1) {
    return reason.prevName === null
      ? `Closest to your start — ${reason.minTransit} min by ${m}.`
      : `Closest from ${reason.prevName} — ${reason.minTransit} min by ${m}.`
  }

  const range =
    reason.minTransit === reason.maxTransit
      ? `${reason.minTransit} min`
      : `${reason.minTransit}–${reason.maxTransit} min`
  const from = reason.prevName === null ? 'from your start' : `from ${reason.prevName}`
  const lead = `Among the nearest ${from} (${range} by ${m})`

  return reason.decidedByClose
    ? `${lead}; picked because it closes earliest, at ${reason.closeTime}.`
    : `${lead}; among the earliest-closing of these.`
}

// Faithful "Why this stop" line for ANY stop — the single source of truth shared
// by the result page and both exports. Only an optimizer-placed stop may show the
// nearest-neighbor reasoning; a user-pinned or hand-arranged stop says so plainly
// so the explanation can never claim a decision the algorithm didn't make.
// `placement` is optional on ScheduledStop; undefined ⇒ optimized.
export function reasonLine(stop: ScheduledStop, mode: TransportMode): string {
  if (stop.placement === 'locked')
    return 'Pinned by you — the rest of the day was optimized around it.'
  if (stop.placement === 'manual')
    return 'You placed this stop here — arrival time updated to match.'
  return reasonText(stop.reason, mode)
}
