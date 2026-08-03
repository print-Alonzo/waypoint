import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// Social preview card. Lives at the app root so every route inherits it —
// including the /[channel] attribution links, which is the point: those get
// pasted into Reddit, Facebook, Instagram and TikTok, and each platform
// degrades differently when og:image is missing (bare text row vs. small
// card vs. no preview). Without one, how a link LOOKS becomes an
// uncontrolled variable across the very channels the study compares.
//
// Design tokens are inlined rather than read from globals.css — Satori has no
// CSS-variable support and resolves no stylesheets. These MUST stay in sync
// with app/globals.css by hand; each one names the token it mirrors.

export const alt = 'Waypoint — your day, in the right order.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const PRIMARY = '#ff385c' // --color-primary
const TEXT = '#222222' // --color-text
const MUTED = '#717171' // --color-text-muted
const AMBER = '#e7a33e' // --color-flag-warning-border (the map's flag amber)
const RULE = '#dddddd' // --color-border

// Satori embeds only the fonts handed to it — it has no system-font fallback
// and no access to next/font's output (which is woff2, a format Satori can't
// read). So the same typeface the site loads via next/font is committed as
// TTF under assets/fonts/ and read here at build time. Without this the card
// silently renders in Satori's default Noto Sans, which is legible but is not
// the brand.
async function loadFonts() {
  const dir = join(process.cwd(), 'assets', 'fonts')
  const [regular, bold] = await Promise.all([
    readFile(join(dir, 'PlusJakartaSans-Regular.ttf')),
    readFile(join(dir, 'PlusJakartaSans-Bold.ttf')),
  ])
  return [
    { name: 'Plus Jakarta Sans', data: regular, style: 'normal' as const, weight: 400 as const },
    { name: 'Plus Jakarta Sans', data: bold, style: 'normal' as const, weight: 700 as const },
  ]
}

export default async function OpengraphImage() {
  const fonts = await loadFonts()

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          backgroundColor: '#ffffff',
          padding: '80px 88px',
          fontFamily: 'Plus Jakarta Sans',
        }}
      >
        <div style={{ display: 'flex', fontSize: 36, fontWeight: 700, color: PRIMARY }}>
          Waypoint
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 28,
            fontSize: 78,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: TEXT,
          }}
        >
          Your day, in the right order.
        </div>

        <div style={{ display: 'flex', marginTop: 26, fontSize: 32, color: MUTED, maxWidth: 900 }}>
          You pick the places. Waypoint sequences your day and shows its work — flagging
          anything closed or out of reach instead of quietly dropping it.
        </div>

        {/* The route motif from the hero: four stops, the third flagged amber. */}
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 54 }}>
          {[PRIMARY, PRIMARY, AMBER, PRIMARY].map((fill, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
              {i > 0 && <div style={{ width: 104, height: 3, backgroundColor: RULE }} />}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: fill,
                  color: '#ffffff',
                  fontSize: 26,
                  fontWeight: 700,
                }}
              >
                {i + 1}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size, fonts },
  )
}
