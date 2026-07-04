import type { POI } from './scheduler'
import { CATEGORIES, DAYS_OF_WEEK } from './constants'

// Isomorphic POI validation shared by the admin form (live field errors) and the
// /admin/create route handler (authoritative check before writing to disk). Keep
// it free of `fs`/DOM so both sides can import it.

export const CATEGORY_KEYS: string[] = CATEGORIES.map((c) => c.key)
const DAY_SET: ReadonlySet<string> = new Set(DAYS_OF_WEEK)

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// Errors are keyed by form field name so the UI can show them inline.
export type PoiErrors = Record<string, string>

// Turn a place name into a URL-safe id ("Rizal Park" → "rizal-park").
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

// Validate a raw payload (form values or POSTed JSON). Numbers may arrive as
// strings; they're coerced here. Returns the built POI only when there are no
// errors, so callers can branch on `poi`.
export function validatePoi(
  raw: Record<string, unknown>,
  existingIds: Set<string>,
): { errors: PoiErrors; poi: POI | null } {
  const errors: PoiErrors = {}

  const name = asString(raw.name)
  if (!name) errors.name = 'Name is required.'

  const id = asString(raw.id) || slugify(name)
  if (!id) errors.id = 'ID is required.'
  else if (!ID_RE.test(id)) errors.id = 'ID must be lowercase letters, numbers, and dashes only.'
  else if (existingIds.has(id)) errors.id = `A place with the ID “${id}” already exists.`

  const category = asString(raw.category)
  if (!category) errors.category = 'Pick a category.'
  else if (!CATEGORY_KEYS.includes(category)) errors.category = 'Unknown category.'

  const lat = Number(raw.lat)
  if (raw.lat === '' || raw.lat == null || Number.isNaN(lat)) errors.lat = 'Latitude is required.'
  else if (lat < -90 || lat > 90) errors.lat = 'Latitude must be between −90 and 90.'

  const lng = Number(raw.lng)
  if (raw.lng === '' || raw.lng == null || Number.isNaN(lng)) errors.lng = 'Longitude is required.'
  else if (lng < -180 || lng > 180) errors.lng = 'Longitude must be between −180 and 180.'

  const openTime = asString(raw.open_time)
  if (!TIME_RE.test(openTime)) errors.open_time = 'Use 24-hour HH:MM.'
  const closeTime = asString(raw.close_time)
  if (!TIME_RE.test(closeTime)) errors.close_time = 'Use 24-hour HH:MM.'
  if (!errors.open_time && !errors.close_time && openTime >= closeTime)
    errors.close_time = 'Closing time must be after opening time.'

  const durRaw = raw.recommended_duration_minutes
  const dur = Number(durRaw)
  if (durRaw === '' || durRaw == null || Number.isNaN(dur))
    errors.recommended_duration_minutes = 'Visit duration is required.'
  else if (!Number.isInteger(dur) || dur <= 0)
    errors.recommended_duration_minutes = 'Duration must be a whole number of minutes above 0.'
  else if (dur > 600) errors.recommended_duration_minutes = 'That seems too long — keep it under 600 minutes.'

  const closedDaysRaw = Array.isArray(raw.closed_days) ? raw.closed_days : []
  const closed_days = closedDaysRaw.filter(
    (d): d is string => typeof d === 'string' && DAY_SET.has(d),
  )

  const notes = asString(raw.notes) || null

  const image = asString(raw.image)
  if (image && !/^(\/|https?:\/\/)/.test(image))
    errors.image = 'Image must be a path starting with “/” or a full http(s) URL.'

  // Photo credit is optional, but a credit without an image, or a partial credit,
  // is a mistake worth catching — a displayed CC image legally needs full credit.
  const author = asString(raw.image_credit_author)
  const license = asString(raw.image_credit_license)
  const licenseUrl = asString(raw.image_credit_license_url)
  const sourceUrl = asString(raw.image_credit_source_url)
  const anyCredit = author || license || licenseUrl || sourceUrl
  let image_credit: POI['image_credit'] | undefined
  if (anyCredit) {
    if (!image) errors.image = 'Add an image path when providing a photo credit.'
    if (!author) errors.image_credit_author = 'Credit author is required.'
    if (!license) errors.image_credit_license = 'License is required.'
    if (!licenseUrl) errors.image_credit_license_url = 'License URL is required.'
    if (!sourceUrl) errors.image_credit_source_url = 'Source URL is required.'
    image_credit = { author, license, license_url: licenseUrl, source_url: sourceUrl }
  }

  if (Object.keys(errors).length > 0) return { errors, poi: null }

  const poi: POI = {
    id,
    name,
    category,
    lat,
    lng,
    open_time: openTime,
    close_time: closeTime,
    closed_days,
    recommended_duration_minutes: dur,
    notes,
    ...(image ? { image } : {}),
    ...(image_credit ? { image_credit } : {}),
  }
  return { errors, poi }
}
