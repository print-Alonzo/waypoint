import type { POI, TransitMatrix } from '@/lib/scheduling/scheduler'

import metroManilaPois from '@/data/metro-manila/pois.json'
import metroManilaMatrix from '@/data/metro-manila/transit-matrix.json'

// Static dataset registry. Keyed by city slug; selected at build time via
// NEXT_PUBLIC_CITY. V2 multi-city = add another entry here, nothing else changes.
const DATASETS = {
  'metro-manila': {
    label: 'Metro Manila',
    pois: metroManilaPois as POI[],
    matrix: metroManilaMatrix as TransitMatrix,
  },
} as const

type CitySlug = keyof typeof DATASETS

const CITY = (process.env.NEXT_PUBLIC_CITY ?? 'metro-manila') as CitySlug
const dataset = DATASETS[CITY] ?? DATASETS['metro-manila']

export const CITY_LABEL: string = dataset.label
export const POIS: POI[] = dataset.pois
export const TRANSIT_MATRIX: TransitMatrix = dataset.matrix

export const POI_MAP: Record<string, POI> = Object.fromEntries(
  POIS.map((p) => [p.id, p]),
)
