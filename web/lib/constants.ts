export const START_LOCATIONS = [
  { id: 'rizal-park', name: 'Rizal Park', lat: 14.5831, lng: 120.9794 },
  { id: 'manila-hotel', name: 'Manila Hotel', lat: 14.5867, lng: 120.9758 },
  { id: 'sm-mall-of-asia', name: 'SM Mall of Asia', lat: 14.5352, lng: 120.9822 },
  { id: 'intramuros-gate', name: 'Intramuros Gate', lat: 14.5896, lng: 120.9789 },
  { id: 'naia-terminal-3', name: 'NAIA Terminal 3', lat: 14.5086, lng: 121.0197 },
] as const

export type StartLocation = (typeof START_LOCATIONS)[number]

export const START_LOCATION_MAP: Record<string, StartLocation> = Object.fromEntries(
  START_LOCATIONS.map((l) => [l.id, l]),
)

// POI categories in display order. `key` matches POI.category (singular, lowercase);
// `label` is the human-facing group title used for the <fieldset>/<legend>.
export const CATEGORIES = [
  { key: 'heritage', label: 'Heritage' },
  { key: 'museum', label: 'Museums' },
  { key: 'park', label: 'Parks' },
  { key: 'market', label: 'Markets' },
  { key: 'church', label: 'Churches' },
] as const

// Must match the strings used in POI.closed_days so red-flag comparison works.
export const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const

export const TRANSPORT_MODES = [
  { value: 'walk', label: 'Walk' },
  { value: 'jeepney', label: 'Jeepney' },
  { value: 'grab', label: 'Grab' },
] as const
