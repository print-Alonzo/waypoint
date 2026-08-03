// Single source of truth for the marketing-channel attribution test — the
// short links (waypoint.app/reddit, /facebook, ...) that each get their own
// route, feed the funnel's `channel` field, and roll up in
// scripts/validation-channels.mjs. Add a channel by adding one entry here;
// the route (generateStaticParams), the validator's allowlist, the landing
// header/survey-prompt exclusions, and the report all pick it up automatically.
// A new channel's route only exists after a redeploy, since
// generateStaticParams runs at build time.
//
// A slug must never collide with a real route folder under app/ — a future
// app/<slug>/page.tsx would win over app/[channel]/page.tsx silently, and the
// channel link would stop attributing (it'd just render that other page).
export const CHANNELS = ['reddit', 'facebook', 'promo', 'instagram', 'tiktok', 'dlsu'] as const

export type Channel = (typeof CHANNELS)[number]

export function isChannel(value: unknown): value is Channel {
  return typeof value === 'string' && (CHANNELS as readonly string[]).includes(value)
}
