import { CHANNELS } from '@/lib/validation/channels'

// A root-level app/opengraph-image.tsx is NOT inherited by this dynamic
// segment (static routes like / and /plan pick it up; /[channel] does not),
// so the channel links — the ones actually pasted into Reddit, Facebook,
// Instagram and TikTok — would ship with no preview card at all. Re-export
// the root image rather than duplicating it, so there stays exactly one
// definition of what a Waypoint link looks like.
export { default, alt, size, contentType } from '../opengraph-image'

// Prerender one image per channel. Without this the route is server-rendered
// on demand, so every crawler hit costs a function invocation and races that
// platform's preview-fetch timeout — on exactly the links whose preview is
// the thing being measured.
export function generateStaticParams() {
  return CHANNELS.map((channel) => ({ channel }))
}
