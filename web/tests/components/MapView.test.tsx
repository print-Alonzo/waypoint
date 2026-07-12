// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import MapView from '@/components/MapView'
import type { ScheduledStop } from '@/lib/scheduler'

const START = { name: 'Rizal Park', lat: 14.5831, lng: 120.9794 }

function makeStop(id: string, lat: number, lng: number): ScheduledStop {
  return {
    poi: {
      id,
      name: id,
      category: 'heritage',
      lat,
      lng,
      open_time: '09:00',
      close_time: '17:00',
      closed_days: [],
      recommended_duration_minutes: 60,
      notes: null,
    },
    arrivalTime: 540,
    departureTime: 600,
    dwellMinutes: 60,
    transitFromPrev: 10,
    yellowFlag: false,
    redFlag: false,
    reason: {
      prevName: null,
      minTransit: 10,
      maxTransit: 10,
      tieGroupSize: 1,
      decidedByClose: false,
      closeTime: '17:00',
    },
  }
}

// Leaflet draws each leg as an SVG <path>; a dashed (straight-line fallback) leg
// carries a `stroke-dasharray` attribute, a resolved road leg doesn't.
function routePaths(container: HTMLElement): SVGPathElement[] {
  return Array.from(container.querySelectorAll('path.leaflet-interactive'))
}

describe('MapView route line', () => {
  it('draws every leg dashed when no road geometry has resolved (legGeometry omitted)', () => {
    const stops = [makeStop('a', 14.59, 120.98), makeStop('b', 14.6, 120.99)]
    const { container } = render(<MapView stops={stops} start={START} />)

    const paths = routePaths(container)
    expect(paths).toHaveLength(2) // one path per leg: start->a, a->b
    paths.forEach((path) => expect(path.getAttribute('stroke-dasharray')).toBeTruthy())
  })

  it('draws a resolved leg solid and an unresolved leg dashed', () => {
    const stops = [makeStop('a', 14.59, 120.98), makeStop('b', 14.6, 120.99)]
    const legGeometry = [
      [
        [14.5831, 120.9794],
        [14.585, 120.985],
        [14.59, 120.98],
      ] as [number, number][],
      null, // leg 2 (a -> b) never resolved -> falls back to straight/dashed
    ]
    const { container } = render(
      <MapView stops={stops} start={START} legGeometry={legGeometry} />,
    )

    const paths = routePaths(container)
    expect(paths).toHaveLength(2)
    // Leg 1: resolved road route -> solid (no dash array).
    expect(paths[0].getAttribute('stroke-dasharray')).toBeFalsy()
    // Leg 2: no route -> straight-line fallback -> dashed.
    expect(paths[1].getAttribute('stroke-dasharray')).toBeTruthy()
  })

  it('re-renders the line when legGeometry updates for the same stops', () => {
    const stops = [makeStop('a', 14.59, 120.98)]
    const { container, rerender } = render(<MapView stops={stops} start={START} />)
    expect(routePaths(container)[0].getAttribute('stroke-dasharray')).toBeTruthy()

    const legGeometry = [
      [
        [14.5831, 120.9794],
        [14.59, 120.98],
      ] as [number, number][],
    ]
    rerender(<MapView stops={stops} start={START} legGeometry={legGeometry} />)
    expect(routePaths(container)[0].getAttribute('stroke-dasharray')).toBeFalsy()
  })
})
