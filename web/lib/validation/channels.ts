// Single source of truth for the marketing-channel attribution test — the
// short links (waypoint.app/reddit, /facebook, ...) that each get their own
// route, feed the funnel's `channel` field, and roll up in
// scripts/validation-channels.mjs. Add a channel by adding one entry here;
// the route (generateStaticParams), the validator's allowlist, the landing
// header/survey-prompt exclusions, and the report all pick it up automatically.
// A new channel's route only exists after a redeploy, since
// generateStaticParams runs at build time.
//
// Two constraints on a new slug:
//  1. It must never collide with a real route folder under app/ — a future
//     app/<slug>/page.tsx would win over app/[channel]/page.tsx silently, and
//     the channel link would stop attributing (it'd just render that page).
//  2. Avoid words generic ad-filter lists target in a URL path — `ads` is the
//     reason the paid-Facebook slug is `promo`. A blocked landing records
//     nothing, so the channel just looks like it converts terribly.
export const CHANNELS = ['reddit', 'facebook', 'promo', 'instagram', 'tiktok', 'dlsu'] as const

export type Channel = (typeof CHANNELS)[number]

export function isChannel(value: unknown): value is Channel {
  return typeof value === 'string' && (CHANNELS as readonly string[]).includes(value)
}

// Is this pathname one of the channel landing routes? Lives here, next to the
// allowlist, so the URL shape (a bare top-level slug) is defined once — call
// sites in SiteHeader and SurveyPromptController must not re-derive it, or a
// future change to the link shape has to be found in several files.
export function isChannelPath(pathname: string): boolean {
  return isChannel(pathname.slice(1))
}
