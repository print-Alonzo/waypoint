// Waypoint service worker — keeps a visited plan working without a connection
// (e.g. in an MRT tunnel). Deliberately conservative:
//   • Navigations  → network-first (online users always get fresh pages),
//                     falling back to the cached page, then the cached home page.
//   • Same-origin assets/data → stale-while-revalidate (instant, refreshed in bg).
//   • Cross-origin (OSM map tiles, Google Fonts) → left untouched / network only.
// Registered only in production and only when the `offline` feature flag is on
// (see components/shared/ServiceWorkerRegister.tsx).
const CACHE = 'waypoint-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // don't intercept tiles/fonts

  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req)
          const cache = await caches.open(CACHE)
          cache.put(req, res.clone())
          return res
        } catch {
          return (
            (await caches.match(req)) ||
            (await caches.match('/')) ||
            new Response('You are offline and this page was not cached yet.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' },
            })
          )
        }
      })(),
    )
    return
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(req)
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            caches.open(CACHE).then((cache) => cache.put(req, res.clone()))
          }
          return res
        })
        .catch(() => cached)
      return cached || network
    })(),
  )
})
