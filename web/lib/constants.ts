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
