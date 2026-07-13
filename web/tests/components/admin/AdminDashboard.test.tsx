// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AdminDashboard from '@/components/admin/AdminDashboard'
import type { POI } from '@/lib/scheduling/scheduler'

const INITIAL_POIS: POI[] = [
  {
    id: 'existing-poi',
    name: 'Existing Place',
    category: 'heritage',
    lat: 14.5,
    lng: 121.0,
    open_time: '08:00',
    close_time: '18:00',
    closed_days: [],
    recommended_duration_minutes: 60,
    notes: null,
  },
]

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

function fillMinimumValidFields() {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Rizal Park' } })
  fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '14.5831' } })
  fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: '120.9794' } })
}

describe('AdminDashboard', () => {
  it('lists the initial places and their count', () => {
    render(<AdminDashboard initialPois={INITIAL_POIS} />)
    expect(screen.getByText('All places (1)')).toBeInTheDocument()
    expect(screen.getByText('Existing Place')).toBeInTheDocument()
  })

  it('auto-fills the ID from the name via slugify until the ID is hand-edited', () => {
    render(<AdminDashboard initialPois={INITIAL_POIS} />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Fort Santiago' } })
    expect(screen.getByLabelText('ID')).toHaveValue('fort-santiago')

    fireEvent.change(screen.getByLabelText('ID'), { target: { value: 'custom-id' } })
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Fort Santiago II' } })
    expect(screen.getByLabelText('ID')).toHaveValue('custom-id')
  })

  it('fills both coordinate fields from a pasted "lat, lng" string', () => {
    render(<AdminDashboard initialPois={INITIAL_POIS} />)
    fireEvent.change(screen.getByLabelText('Paste coordinates'), {
      target: { value: 'Some text 14.5869, 120.9800 more text' },
    })
    expect(screen.getByLabelText('Latitude')).toHaveValue('14.5869')
    expect(screen.getByLabelText('Longitude')).toHaveValue('120.9800')
  })

  it('toggles a closed day chip and reflects it in aria-pressed', () => {
    render(<AdminDashboard initialPois={INITIAL_POIS} />)
    const mon = screen.getByRole('button', { name: 'Mon' })
    expect(mon).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(mon)
    expect(mon).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(mon)
    expect(mon).toHaveAttribute('aria-pressed', 'false')
  })

  it('blocks submission client-side and shows field errors when required fields are missing', async () => {
    render(<AdminDashboard initialPois={INITIAL_POIS} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add place' }))
    expect(await screen.findByText('Fix the highlighted fields and try again.')).toBeInTheDocument()
    expect(screen.getByText('Latitude is required.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('submits the validated place, adds it to the table, and resets the form on success', async () => {
    const newPoi = { ...INITIAL_POIS[0], id: 'rizal-park', name: 'Rizal Park' }
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, poi: newPoi, total: 2 }),
    })
    render(<AdminDashboard initialPois={INITIAL_POIS} />)
    fillMinimumValidFields()
    fireEvent.click(screen.getByRole('button', { name: 'Add place' }))

    expect(await screen.findByRole('status')).toHaveTextContent(/Added .Rizal Park./)
    expect(screen.getByText('All places (2)')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('')
  })

  it('surfaces server-side field errors returned from the API', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false, errors: { id: 'A place with that ID already exists.' } }),
    })
    render(<AdminDashboard initialPois={INITIAL_POIS} />)
    fillMinimumValidFields()
    fireEvent.click(screen.getByRole('button', { name: 'Add place' }))

    expect(
      await screen.findByText('The server rejected some fields — see the highlights.'),
    ).toBeInTheDocument()
    expect(screen.getByText('A place with that ID already exists.')).toBeInTheDocument()
  })

  it('shows the server-provided generic error message when the response is not ok and has no field errors', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false, error: 'disk full' }),
    })
    render(<AdminDashboard initialPois={INITIAL_POIS} />)
    fillMinimumValidFields()
    fireEvent.click(screen.getByRole('button', { name: 'Add place' }))

    expect(await screen.findByText('disk full')).toBeInTheDocument()
  })

  it('shows a network-failure message when the request cannot reach the server', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    render(<AdminDashboard initialPois={INITIAL_POIS} />)
    fillMinimumValidFields()
    fireEvent.click(screen.getByRole('button', { name: 'Add place' }))

    expect(
      await screen.findByText('Could not reach the server. Is Waypoint running locally?'),
    ).toBeInTheDocument()
  })

  it('re-enables the submit button after the request settles', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, poi: { ...INITIAL_POIS[0], id: 'rizal-park' }, total: 2 }),
    })
    render(<AdminDashboard initialPois={INITIAL_POIS} />)
    fillMinimumValidFields()
    fireEvent.click(screen.getByRole('button', { name: 'Add place' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add place' })).not.toBeDisabled())
  })
})
