import { describe, it, expect } from 'vitest'
import { validatePoi, slugify, CATEGORY_KEYS } from '@/lib/poi/validate'

const VALID: Record<string, unknown> = {
  name: 'Rizal Park',
  category: CATEGORY_KEYS[0],
  lat: 14.5831,
  lng: 120.9794,
  open_time: '08:00',
  close_time: '18:00',
  recommended_duration_minutes: 90,
  closed_days: [],
  notes: '',
}

describe('slugify', () => {
  it('lowercases, spaces to dashes, strips punctuation', () => {
    expect(slugify('Rizal Park')).toBe('rizal-park')
    expect(slugify("St. Paul's Church!")).toBe('st-paul-s-church')
  })

  it('trims leading/trailing dashes', () => {
    expect(slugify('  --Fort Santiago--  ')).toBe('fort-santiago')
  })
})

describe('validatePoi', () => {
  it('accepts a fully valid payload and builds the POI', () => {
    const { errors, poi } = validatePoi(VALID, new Set())
    expect(errors).toEqual({})
    expect(poi).not.toBeNull()
    expect(poi!.id).toBe('rizal-park')
    expect(poi!.name).toBe('Rizal Park')
  })

  it('derives id from name via slugify when id is omitted', () => {
    const { poi } = validatePoi(VALID, new Set())
    expect(poi!.id).toBe('rizal-park')
  })

  it('requires a name', () => {
    const { errors, poi } = validatePoi({ ...VALID, name: '  ' }, new Set())
    expect(errors.name).toBeTruthy()
    expect(poi).toBeNull()
  })

  it('rejects an id with uppercase or invalid characters', () => {
    const { errors } = validatePoi({ ...VALID, id: 'Rizal Park!' }, new Set())
    expect(errors.id).toBeTruthy()
  })

  it('rejects an id that already exists', () => {
    const { errors } = validatePoi({ ...VALID, id: 'rizal-park' }, new Set(['rizal-park']))
    expect(errors.id).toMatch(/already exists/)
  })

  it('rejects an unknown category', () => {
    const { errors } = validatePoi({ ...VALID, category: 'nightlife' }, new Set())
    expect(errors.category).toBeTruthy()
  })

  it('rejects out-of-range latitude and longitude', () => {
    const { errors: latErrors } = validatePoi({ ...VALID, lat: 91 }, new Set())
    expect(latErrors.lat).toBeTruthy()
    const { errors: lngErrors } = validatePoi({ ...VALID, lng: -181 }, new Set())
    expect(lngErrors.lng).toBeTruthy()
  })

  it('rejects malformed open/close times', () => {
    const { errors } = validatePoi({ ...VALID, open_time: '9am', close_time: '25:00' }, new Set())
    expect(errors.open_time).toBeTruthy()
    expect(errors.close_time).toBeTruthy()
  })

  it('rejects a close time not after the open time', () => {
    const { errors } = validatePoi({ ...VALID, open_time: '18:00', close_time: '08:00' }, new Set())
    expect(errors.close_time).toMatch(/after opening/)
  })

  it('rejects a non-positive or non-integer duration', () => {
    expect(validatePoi({ ...VALID, recommended_duration_minutes: 0 }, new Set()).errors
      .recommended_duration_minutes).toBeTruthy()
    expect(validatePoi({ ...VALID, recommended_duration_minutes: 45.5 }, new Set()).errors
      .recommended_duration_minutes).toBeTruthy()
  })

  it('rejects a duration over the 600-minute cap', () => {
    const { errors } = validatePoi({ ...VALID, recommended_duration_minutes: 601 }, new Set())
    expect(errors.recommended_duration_minutes).toBeTruthy()
  })

  it('filters closed_days to only recognized day names', () => {
    const { poi } = validatePoi(
      { ...VALID, closed_days: ['Monday', 'Someday', 42] },
      new Set(),
    )
    expect(poi!.closed_days).toEqual(['Monday'])
  })

  it('rejects an image path that is not "/"-rooted or http(s)', () => {
    const { errors } = validatePoi({ ...VALID, image: 'ftp://example.com/x.jpg' }, new Set())
    expect(errors.image).toBeTruthy()
  })

  it('accepts a "/"-rooted or https image path', () => {
    expect(validatePoi({ ...VALID, image: '/images/poi/x.jpg' }, new Set()).errors.image).toBeUndefined()
    expect(
      validatePoi({ ...VALID, image: 'https://example.com/x.jpg' }, new Set()).errors.image,
    ).toBeUndefined()
  })

  it('requires an image when any photo credit field is provided', () => {
    const { errors } = validatePoi({ ...VALID, image_credit_author: 'Jane Doe' }, new Set())
    expect(errors.image).toMatch(/Add an image path/)
  })

  it('requires all credit fields once any credit field is provided', () => {
    const { errors } = validatePoi(
      { ...VALID, image: '/images/poi/x.jpg', image_credit_author: 'Jane Doe' },
      new Set(),
    )
    expect(errors.image_credit_license).toBeTruthy()
    expect(errors.image_credit_license_url).toBeTruthy()
    expect(errors.image_credit_source_url).toBeTruthy()
  })

  it('builds image_credit only when the full credit is present and valid', () => {
    const { errors, poi } = validatePoi(
      {
        ...VALID,
        image: '/images/poi/x.jpg',
        image_credit_author: 'Jane Doe',
        image_credit_license: 'CC BY 2.0',
        image_credit_license_url: 'https://creativecommons.org/licenses/by/2.0/',
        image_credit_source_url: 'https://example.com/photo',
      },
      new Set(),
    )
    expect(errors).toEqual({})
    expect(poi!.image_credit).toEqual({
      author: 'Jane Doe',
      license: 'CC BY 2.0',
      license_url: 'https://creativecommons.org/licenses/by/2.0/',
      source_url: 'https://example.com/photo',
    })
  })

  it('omits image and image_credit from the built POI when absent', () => {
    const { poi } = validatePoi(VALID, new Set())
    expect(poi).not.toHaveProperty('image')
    expect(poi).not.toHaveProperty('image_credit')
  })
})
