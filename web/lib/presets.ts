import type { ScheduleParams } from '@/lib/params'
import { encodeParams } from '@/lib/params'

// Curated starter itineraries to kill cold-start paralysis on the landing page.
// Each is just an encoded /result URL built from real POI ids — no special-casing
// anywhere else; tapping one lands on the normal result page, fully editable.
// Days are chosen to avoid the Monday closures most museums/heritage sites carry.

export type Preset = {
  id: string
  title: string
  blurb: string
  emoji: string
  params: ScheduleParams
}

export const PRESETS: Preset[] = [
  {
    id: 'intramuros-heritage',
    title: 'Intramuros in half a day',
    blurb: 'The walled city’s essentials — forts, the cathedral, and Casa Manila.',
    emoji: '🏛️',
    params: {
      poi_ids: ['fort-santiago', 'san-agustin-church', 'casa-manila', 'manila-cathedral', 'baluarte-de-san-diego'],
      start_time: '09:00',
      transport_mode: 'walk',
      start_location: 'intramuros-gate',
      day_of_week: 'Saturday',
    },
  },
  {
    id: 'museum-mile',
    title: 'Museum mile',
    blurb: 'The National Museum complex, back to back — art, nature, and anthropology.',
    emoji: '🖼️',
    params: {
      poi_ids: [
        'national-museum-fine-arts',
        'national-museum-natural-history',
        'national-museum-anthropology',
        'metropolitan-museum-manila',
      ],
      start_time: '09:00',
      transport_mode: 'grab',
      start_location: 'rizal-park',
      day_of_week: 'Saturday',
    },
  },
  {
    id: 'markets-and-churches',
    title: 'Markets & old churches',
    blurb: 'Quiapo and Binondo by jeepney — markets, street food, and historic churches.',
    emoji: '⛪',
    params: {
      poi_ids: ['quiapo-church', 'quiapo-market', 'binondo-church', 'divisoria-168-mall'],
      start_time: '09:00',
      transport_mode: 'jeepney',
      start_location: 'rizal-park',
      day_of_week: 'Saturday',
    },
  },
  {
    id: 'slow-green-morning',
    // Carries lunch:true so it showcases the lunch break when that feature is on,
    // but the blurb doesn't promise it (the lunchBreak flag may be off).
    title: 'A slow, green morning',
    blurb: 'Parks and gardens at a walking pace — slow and unhurried.',
    emoji: '🌳',
    params: {
      poi_ids: ['arroceros-forest-park', 'mehan-garden', 'liwasang-bonifacio', 'paco-park'],
      start_time: '08:00',
      transport_mode: 'walk',
      start_location: 'rizal-park',
      day_of_week: 'Saturday',
      lunch: true,
    },
  },
  {
    id: 'family-day',
    title: 'Family day out',
    blurb: 'Hands-on museums and the ocean park — easy wins with kids.',
    emoji: '🐠',
    params: {
      poi_ids: ['manila-ocean-park', 'the-mind-museum', 'ayala-museum'],
      start_time: '10:00',
      transport_mode: 'grab',
      start_location: 'sm-mall-of-asia',
      day_of_week: 'Saturday',
    },
  },
]

export function presetHref(preset: Preset): string {
  return '/result?' + encodeParams(preset.params).toString()
}
