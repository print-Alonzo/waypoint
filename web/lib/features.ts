// Central feature-flag registry for Waypoint's "power features".
//
// HOW TO TURN A FEATURE OFF: flip its flag to `false` here. Every feature checks
// its flag at the one place it enters the UI, so a `false` removes the entry point
// and the feature's code tree-shakes out of that view — no other edits needed.
//
// These are compile-time constants on purpose: simplest possible kill switch, no
// env plumbing, statically analyzable, and consistent between server and client
// render (no hydration mismatch). V2 could layer NEXT_PUBLIC_FF_* overrides on top
// without changing any call site, since everything goes through `isEnabled`.
export const FEATURES = {
  // Landing-page one-tap starter itineraries (encoded /result URLs).
  presets: true,
  // Result-page time-budget slider: greys out (never deletes) over-budget stops.
  fitToHours: true,
  // Per-leg + per-day fare ranges on the result page.
  fareEstimator: true,
  // "What if" drawer: compare Walk / Jeepney / Grab and start time side by side.
  whatIf: true,
  // Reserve a midday lunch window and shift stops around it.
  lunchBreak: true,
  // Per-stop "Time here" stepper: override how long you spend at a place (the POI's
  // authored duration stays on screen as the suggestion).
  customDuration: true,
  // Service worker so a saved plan keeps working offline (e.g. in an MRT tunnel).
  offline: true,
  // /live — device-clock companion ("leaving in ~N min", "I'm running late").
  liveMode: true,
  // Save plans locally and compare two side by side.
  comparePlans: true,
  // Group vote on candidate places. OFF by default: this is a SINGLE-DEVICE tally
  // (everyone votes on one phone). True multi-device voting needs a shared backend,
  // which Waypoint deliberately doesn't have — see web/README.md.
  groupVote: false,
  // Willingness-to-pay validation funnel: landing → persona quiz → app trial →
  // survey → waitlist email, capturing data to MongoDB Atlas. Set to `false` to
  // end the study — the landing CTA and every funnel entry point (`/quiz`,
  // `/feedback`, `/thanks`) revert/redirect home and the code tree-shakes out.
  validation: true,
} as const

export type FeatureFlag = keyof typeof FEATURES

export function isEnabled(flag: FeatureFlag): boolean {
  return FEATURES[flag]
}
