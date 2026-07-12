'use client'

import { useMemo, useState } from 'react'
import type { POI } from '@/lib/scheduling/scheduler'
import { CATEGORIES, DAYS_OF_WEEK } from '@/lib/constants'
import { hoursLabel } from '@/lib/poi/format'
import { validatePoi, slugify, type PoiErrors } from '@/lib/poi/validate'
import { CategoryGlyph } from './CategoryGlyph'

// Local content tool for adding places to the Waypoint catalog. Posts to
// /admin/create, which writes the validated place into data/<city>/pois.json and
// regenerates the transit matrix. The dataset is the source of truth: after adding
// here, review the git diff, commit, and redeploy to publish.

const CITY = process.env.NEXT_PUBLIC_CITY ?? 'metro-manila'
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

type FormState = {
  name: string
  id: string
  category: string
  lat: string
  lng: string
  open_time: string
  close_time: string
  recommended_duration_minutes: string
  notes: string
  image: string
  image_credit_author: string
  image_credit_license: string
  image_credit_license_url: string
  image_credit_source_url: string
  closed_days: string[]
}

const EMPTY: FormState = {
  name: '',
  id: '',
  category: CATEGORIES[0].key,
  lat: '',
  lng: '',
  open_time: '09:00',
  close_time: '17:00',
  recommended_duration_minutes: '60',
  notes: '',
  image: '',
  image_credit_author: '',
  image_credit_license: '',
  image_credit_license_url: '',
  image_credit_source_url: '',
  closed_days: [],
}

function categoryLabel(key: string): string {
  return CATEGORIES.find((c) => c.key === key)?.label ?? key
}

const inputClass =
  'w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2.5 text-base ' +
  'focus:outline-none focus:border-[var(--color-text)] focus:ring-1 focus:ring-[var(--color-text)]'

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string
  htmlFor?: string
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs font-medium text-[var(--color-flag-error-text)]">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">{hint}</p>
      ) : null}
    </div>
  )
}

export default function AdminDashboard({ initialPois }: { initialPois: POI[] }) {
  const [places, setPlaces] = useState<POI[]>(initialPois)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [idEdited, setIdEdited] = useState(false)
  const [errors, setErrors] = useState<PoiErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<
    | { kind: 'success'; message: string }
    | { kind: 'error'; message: string }
    | null
  >(null)

  const existingIds = useMemo(() => new Set(places.map((p) => p.id)), [places])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: '' }))
  }

  function onNameChange(value: string) {
    setForm((f) => ({ ...f, name: value, id: idEdited ? f.id : slugify(value) }))
    setErrors((e) => ({ ...e, name: '', id: '' }))
  }

  function pasteCoords(value: string) {
    const m = value.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/)
    if (m) setForm((f) => ({ ...f, lat: m[1], lng: m[2] }))
    setErrors((e) => ({ ...e, lat: '', lng: '' }))
  }

  function toggleDay(day: string) {
    setForm((f) => ({
      ...f,
      closed_days: f.closed_days.includes(day)
        ? f.closed_days.filter((d) => d !== day)
        : [...f.closed_days, day],
    }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setResult(null)
    const local = validatePoi(form, existingIds)
    if (!local.poi) {
      setErrors(local.errors)
      setResult({ kind: 'error', message: 'Fix the highlighted fields and try again.' })
      return
    }
    setErrors({})
    setSubmitting(true)
    try {
      const res = await fetch('/admin/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (res.ok && json.ok) {
        setPlaces((prev) => [...prev, json.poi as POI])
        setForm(EMPTY)
        setIdEdited(false)
        setResult({
          kind: 'success',
          message: `Added “${json.poi.name}”. Written to data/${CITY}/pois.json (${json.total} places). Commit the change and redeploy to publish it.`,
        })
      } else if (json.errors) {
        setErrors(json.errors as PoiErrors)
        setResult({ kind: 'error', message: 'The server rejected some fields — see the highlights.' })
      } else {
        setResult({ kind: 'error', message: json.error ?? 'Something went wrong writing the place.' })
      }
    } catch {
      setResult({
        kind: 'error',
        message: 'Could not reach the server. Is Waypoint running locally?',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const previewHours =
    TIME_RE.test(form.open_time) && TIME_RE.test(form.close_time)
      ? hoursLabel({
          open_time: form.open_time,
          close_time: form.close_time,
          closed_days: form.closed_days,
        } as POI)
      : 'Set opening hours'

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <header className="mb-8">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Places</h1>
          <span className="rounded-full bg-[var(--color-bg-subtle)] px-2.5 py-0.5 text-sm font-semibold text-[var(--color-text-muted)]">
            {places.length}
          </span>
        </div>
        <p className="mt-2 text-[var(--color-text-muted)]">
          Add a place to the Waypoint catalog. Saved to{' '}
          <code className="rounded bg-[var(--color-bg-subtle)] px-1 py-0.5 text-sm">
            data/{CITY}/pois.json
          </code>{' '}
          on this machine — commit and redeploy to publish.
        </p>
      </header>

      {result && (
        <div
          role="status"
          className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
            result.kind === 'success'
              ? 'border-[var(--color-primary)] bg-[var(--color-bg-subtle)] text-[var(--color-text)]'
              : 'border-[var(--color-flag-error-border)] bg-white text-[var(--color-flag-error-text)]'
          }`}
        >
          {result.message}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-5">
        {/* Add form */}
        <form onSubmit={onSubmit} className="lg:col-span-3">
          <div className="space-y-5">
            <Field label="Name" htmlFor="f-name" error={errors.name}>
              <input
                id="f-name"
                className={inputClass}
                value={form.name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="National Museum of Natural History"
              />
            </Field>

            <Field
              label="ID"
              htmlFor="f-id"
              error={errors.id}
              hint="Used in URLs and the dataset. Auto-filled from the name; edit if needed."
            >
              <input
                id="f-id"
                className={`${inputClass} font-mono text-sm`}
                value={form.id}
                onChange={(e) => {
                  setIdEdited(true)
                  set('id', e.target.value)
                }}
                placeholder="national-museum-natural-history"
              />
            </Field>

            <Field label="Category" htmlFor="f-category" error={errors.category}>
              <select
                id="f-category"
                className={inputClass}
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Coordinates"
              error={errors.lat || errors.lng}
              hint="From Google Maps: right-click a spot → click the “lat, lng” to copy, then paste below."
            >
              <input
                className={`${inputClass} mb-2`}
                onChange={(e) => pasteCoords(e.target.value)}
                placeholder="Paste “14.5869, 120.9800” to fill both"
                aria-label="Paste coordinates"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  className={inputClass}
                  value={form.lat}
                  inputMode="decimal"
                  onChange={(e) => set('lat', e.target.value)}
                  placeholder="Latitude"
                  aria-label="Latitude"
                />
                <input
                  className={inputClass}
                  value={form.lng}
                  inputMode="decimal"
                  onChange={(e) => set('lng', e.target.value)}
                  placeholder="Longitude"
                  aria-label="Longitude"
                />
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Opens" htmlFor="f-open" error={errors.open_time}>
                <input
                  id="f-open"
                  type="time"
                  className={inputClass}
                  value={form.open_time}
                  onChange={(e) => set('open_time', e.target.value)}
                />
              </Field>
              <Field label="Closes" htmlFor="f-close" error={errors.close_time}>
                <input
                  id="f-close"
                  type="time"
                  className={inputClass}
                  value={form.close_time}
                  onChange={(e) => set('close_time', e.target.value)}
                />
              </Field>
            </div>

            <Field
              label="Typical visit (minutes)"
              htmlFor="f-duration"
              error={errors.recommended_duration_minutes}
            >
              <input
                id="f-duration"
                type="number"
                min={1}
                className={inputClass}
                value={form.recommended_duration_minutes}
                onChange={(e) => set('recommended_duration_minutes', e.target.value)}
              />
            </Field>

            <Field label="Closed days" hint="Leave all off if open every day.">
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day) => {
                  const on = form.closed_days.includes(day)
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      aria-pressed={on}
                      className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                        on
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                          : 'border-[var(--color-border)] bg-white text-[var(--color-text-muted)] hover:border-[var(--color-text)]'
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  )
                })}
              </div>
            </Field>

            <Field label="Notes" htmlFor="f-notes" hint="Optional. Shown under the place on cards.">
              <textarea
                id="f-notes"
                className={`${inputClass} min-h-20 resize-y`}
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="Last entry 17:30. Entrance fee required."
              />
            </Field>

            <details className="rounded-lg border border-[var(--color-border)] px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold">
                Photo &amp; credit (optional)
              </summary>
              <div className="mt-4 space-y-4">
                <Field
                  label="Image path or URL"
                  htmlFor="f-image"
                  error={errors.image}
                  hint="e.g. /images/poi/your-place.jpg or a full https:// URL."
                >
                  <input
                    id="f-image"
                    className={inputClass}
                    value={form.image}
                    onChange={(e) => set('image', e.target.value)}
                    placeholder="/images/poi/national-museum.jpg"
                  />
                </Field>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Credit author" htmlFor="f-cred-author" error={errors.image_credit_author}>
                    <input
                      id="f-cred-author"
                      className={inputClass}
                      value={form.image_credit_author}
                      onChange={(e) => set('image_credit_author', e.target.value)}
                    />
                  </Field>
                  <Field label="License" htmlFor="f-cred-license" error={errors.image_credit_license}>
                    <input
                      id="f-cred-license"
                      className={inputClass}
                      value={form.image_credit_license}
                      onChange={(e) => set('image_credit_license', e.target.value)}
                      placeholder="CC BY 4.0"
                    />
                  </Field>
                  <Field
                    label="License URL"
                    htmlFor="f-cred-license-url"
                    error={errors.image_credit_license_url}
                  >
                    <input
                      id="f-cred-license-url"
                      className={inputClass}
                      value={form.image_credit_license_url}
                      onChange={(e) => set('image_credit_license_url', e.target.value)}
                    />
                  </Field>
                  <Field
                    label="Source URL"
                    htmlFor="f-cred-source-url"
                    error={errors.image_credit_source_url}
                  >
                    <input
                      id="f-cred-source-url"
                      className={inputClass}
                      value={form.image_credit_source_url}
                      onChange={(e) => set('image_credit_source_url', e.target.value)}
                    />
                  </Field>
                </div>
              </div>
            </details>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-[var(--color-primary)] px-5 py-3.5 text-base font-bold text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Adding…' : 'Add place'}
            </button>
          </div>
        </form>

        {/* Live preview */}
        <aside className="lg:col-span-2">
          <div className="lg:sticky lg:top-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Preview
            </p>
            <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-sm">
              <div className="flex aspect-[4/3] items-center justify-center bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]">
                <CategoryGlyph category={form.category} className="h-12 w-12" />
              </div>
              <div className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
                  {categoryLabel(form.category)}
                </p>
                <h3 className="mt-1 text-lg font-bold leading-tight">
                  {form.name || 'New place'}
                </h3>
                <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{previewHours}</p>
                {form.notes ? (
                  <p className="mt-1.5 line-clamp-2 text-sm italic text-[var(--color-text-muted)]">
                    {form.notes}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Existing places */}
      <section className="mt-12">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          All places ({places.length})
        </h2>
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <table className="w-full min-w-[500px] text-left text-sm">
            <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Name</th>
                <th className="px-4 py-2.5 font-semibold">Category</th>
                <th className="px-4 py-2.5 font-semibold">Hours</th>
                <th className="px-4 py-2.5 font-semibold">ID</th>
              </tr>
            </thead>
            <tbody>
              {places.map((p) => (
                <tr key={p.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-4 py-2.5 font-medium">{p.name}</td>
                  <td className="px-4 py-2.5 text-[var(--color-text-muted)]">
                    {categoryLabel(p.category)}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{hoursLabel(p)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-[var(--color-text-muted)]">
                    {p.id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
