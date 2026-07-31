'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { ScheduledStop } from '@/lib/scheduling/scheduler'
import { stopStatusLine, wallClock } from '@/lib/plan/export'

type StartPoint = { name: string; lat: number; lng: number }

// Index-aligned with `stops`: entry i is the road route from the previous point
// (start, or stops[i-1]) to stops[i]. `null`/absent legs fall back to a dashed
// straight segment (no route resolved yet, or road routing isn't configured).
type LegGeometry = ([number, number][] | null)[]

type MapViewProps = {
  stops: ScheduledStop[]
  start: StartPoint
  legGeometry?: LegGeometry
}

// Visit-order map: a Start dot, one numbered pin per stop (coloured by flag
// state to echo the itinerary list), and a route line connecting them in order —
// solid where a real road route resolved, dashed straight where it hasn't (or
// couldn't). Loaded client-only via next/dynamic({ ssr: false }) — Leaflet needs
// `window`. The text list remains the accessible + print source of truth; this is
// a supplementary visual that lets testers verify the route makes geographic sense.

function pinState(stop: ScheduledStop): 'normal' | 'warning' | 'error' {
  if (stop.redFlag) return 'error'
  if (stop.yellowFlag) return 'warning'
  return 'normal'
}

function popupHtml(n: number, stop: ScheduledStop): string {
  const status = stopStatusLine(stop) // shared source of truth with the list + exports
  // Escape the name defensively — POI data is static today, but div HTML is raw.
  const name = stop.poi.name.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<strong>${n}. ${name}</strong><br/>Arrive ${wallClock(stop.arrivalTime)} · ${status}`
}

export default function MapView({ stops, start, legGeometry }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerGroupRef = useRef<L.LayerGroup | null>(null)
  // The geographic signature fitBounds last ran for — starts null on every fresh
  // map instance (reset in the init effect below), so a content-only change
  // (duration edit, flag change) can skip re-fitting without also skipping the
  // one fitBounds call a freshly created map actually needs.
  const lastGeoSignatureRef = useRef<string | null>(null)

  // Reordering, editing a duration or toggling a flag all produce a NEW `stops` /
  // `legGeometry` array reference even when the underlying values are unchanged,
  // which would otherwise re-run the content effect below on every unrelated
  // model recompute. Derive stable primitive signatures instead, so the effect is
  // keyed on what's actually different, not on array identity.
  const contentSignature = useMemo(
    () =>
      JSON.stringify({
        start,
        stops: stops.map((s) => ({
          id: s.poi.id,
          lat: s.poi.lat,
          lng: s.poi.lng,
          flag: pinState(s),
          arrival: s.arrivalTime,
          status: stopStatusLine(s),
        })),
        legGeometry,
      }),
    [start, stops, legGeometry],
  )
  // Only the parts of the above that affect WHERE the map should fit — a duration
  // edit changes arrival times (content) but not a single coordinate (geography).
  const geoSignature = useMemo(
    () =>
      JSON.stringify({
        start: [start.lat, start.lng],
        coords: stops.map((s) => [s.poi.id, s.poi.lat, s.poi.lng]),
        legGeometry,
      }),
    [start, stops, legGeometry],
  )

  // Init/teardown only — creates the map + tile layer once, so ordinary edits
  // don't tear down and refetch tiles. Declared before the content effect so its
  // refs are populated in the same commit the content effect first runs in.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const map = L.map(el, {
      scrollWheelZoom: false, // don't hijack page scroll; zoom via +/- or pinch
      attributionControl: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)

    const layerGroup = L.layerGroup().addTo(map)

    mapRef.current = map
    layerGroupRef.current = layerGroup
    lastGeoSignatureRef.current = null

    return () => {
      mapRef.current = null
      layerGroupRef.current = null
      map.remove()
    }
  }, [])

  // Content — repopulates the Start dot, numbered pins and per-leg polylines on a
  // persistent layer group (cheap: no tile refetch, no re-init). fitBounds only
  // runs when the geography actually moved, so a duration edit's fresh popup text
  // doesn't also re-zoom the map out from under the traveler.
  useEffect(() => {
    const map = mapRef.current
    const layerGroup = layerGroupRef.current
    if (!map || !layerGroup) return

    layerGroup.clearLayers()

    const lineColor =
      getComputedStyle(document.documentElement)
        .getPropertyValue('--color-primary')
        .trim() || '#ff385c'

    const points: L.LatLngExpression[] = [[start.lat, start.lng]]
    // Points to fit the view to: markers + any resolved road geometry, so a route
    // that bulges away from the straight line between two stops stays on-screen.
    const boundsPoints: L.LatLngExpression[] = [[start.lat, start.lng]]

    // Start marker — small hollow coral dot, distinct from numbered stops.
    L.marker([start.lat, start.lng], {
      icon: L.divIcon({
        className: 'wp-pin-wrap',
        html: '<div class="wp-start"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
    })
      .addTo(layerGroup)
      .bindPopup(`<strong>Start</strong><br/>${start.name}`)

    stops.forEach((stop, i) => {
      const latlng: L.LatLngExpression = [stop.poi.lat, stop.poi.lng]
      points.push(latlng)
      boundsPoints.push(latlng)
      L.marker(latlng, {
        icon: L.divIcon({
          className: 'wp-pin-wrap',
          html: `<div class="wp-pin wp-pin--${pinState(stop)}">${i + 1}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          popupAnchor: [0, -14],
        }),
        zIndexOffset: i, // later stops draw above earlier ones on overlap
      })
        .addTo(layerGroup)
        .bindPopup(popupHtml(i + 1, stop))
    })

    // Route line through start → every stop, in visit order — one leg at a time so
    // each can independently be a resolved road route (solid) or the straight-line
    // fallback (dashed), rather than one line drawn with a single style.
    points.slice(1).forEach((point, i) => {
      const from = points[i]
      const geometry = legGeometry?.[i]
      if (geometry && geometry.length > 1) {
        L.polyline(geometry, { color: lineColor, weight: 3, opacity: 0.75 }).addTo(layerGroup)
        boundsPoints.push(...geometry)
      } else {
        L.polyline([from, point], {
          color: lineColor,
          weight: 3,
          opacity: 0.75,
          dashArray: '6 8',
        }).addTo(layerGroup)
      }
    })

    if (geoSignature !== lastGeoSignatureRef.current) {
      lastGeoSignatureRef.current = geoSignature
      map.fitBounds(L.latLngBounds(boundsPoints), { padding: [32, 32], maxZoom: 16 })
    }

    // Container is laid out with a fixed height, but recalc once after paint to
    // be safe (avoids occasional grey-tile / wrong-center on first render).
    const raf = requestAnimationFrame(() => map.invalidateSize())
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- signatures ARE the deps
  }, [contentSignature, geoSignature])

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={`Map of your ${stops.length}-stop route starting from ${start.name}`}
      className="relative z-0 h-72 w-full overflow-hidden rounded-xl border border-[var(--color-border)]"
    />
  )
}
