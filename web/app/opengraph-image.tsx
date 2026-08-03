import { ImageResponse } from 'next/og'

// Social preview card. Lives at the app root so every route inherits it —
// including the /[channel] attribution links, which is the point: those get
// pasted into Reddit, Facebook, Instagram and TikTok, and each platform
// degrades differently when og:image is missing (bare text row vs. small
// card vs. no preview). Without one, how a link LOOKS becomes an
// uncontrolled variable across the very channels the study compares.
//
// Design tokens are inlined rather than read from globals.css — Satori has no
// CSS-variable support and resolves no stylesheets.

export const alt = 'Waypoint — your day, in the right order.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const PRIMARY = '#ff385c'
const TEXT = '#222222'
const MUTED = '#717171'
const AMBER = '#ffb400'

export default function OpengraphImage() {
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
        }}
      >
        <div style={{ display: 'flex', fontSize: 36, fontWeight: 700, color: PRIMARY }}>
          Waypoint
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 28,
            fontSize: 82,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: TEXT,
          }}
        >
          Your day, in the right order.
        </div>

        <div style={{ display: 'flex', marginTop: 26, fontSize: 33, color: MUTED, maxWidth: 900 }}>
          You pick the places. Waypoint sequences your day and shows its work — flagging
          anything closed or out of reach instead of quietly dropping it.
        </div>

        {/* The route motif from the hero: four stops, the third flagged amber. */}
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 54 }}>
          {[PRIMARY, PRIMARY, AMBER, PRIMARY].map((fill, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
              {i > 0 && <div style={{ width: 104, height: 3, backgroundColor: '#e5e5e5' }} />}
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
    size,
  )
}
