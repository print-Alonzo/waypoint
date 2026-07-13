// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import WhatIfDrawer from '@/components/result/WhatIfDrawer'
import { POI_MAP } from '@/lib/poi/data'
import { START_LOCATION_MAP } from '@/lib/constants'
import type { ScheduleParams } from '@/lib/plan/params'

const PARAMS: ScheduleParams = {
  poi_ids: ['fort-santiago', 'casa-manila', 'manila-cathedral'],
  start_time: '09:00',
  transport_mode: 'grab',
  start_location: 'rizal-park',
  day_of_week: 'Saturday',
}
const SL = START_LOCATION_MAP[PARAMS.start_location]
const COORDS = { lat: SL.lat, lng: SL.lng }
const POIS = PARAMS.poi_ids.map((id) => POI_MAP[id])

describe('WhatIfDrawer', () => {
  it('renders one row per transport mode with a labelled "your mode" for the current one', () => {
    render(
      <WhatIfDrawer
        pois={POIS}
        params={PARAMS}
        coords={COORDS}
        lunch={null}
        durations={{}}
        currentMode="grab"
        onChoose={vi.fn()}
      />,
    )
    expect(screen.getByText('Walk')).toBeInTheDocument()
    expect(screen.getByText('Jeepney')).toBeInTheDocument()
    expect(screen.getByText('(your mode)').closest('td')).toHaveTextContent('Grab')
  })

  it('shows a "Use <mode>" button for every mode except the current one', () => {
    render(
      <WhatIfDrawer
        pois={POIS}
        params={PARAMS}
        coords={COORDS}
        lunch={null}
        durations={{}}
        currentMode="grab"
        onChoose={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Use Walk' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Use Jeepney' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Use Grab' })).not.toBeInTheDocument()
  })

  it('calls onChoose with the selected mode when a "Use <mode>" button is clicked', () => {
    const onChoose = vi.fn()
    render(
      <WhatIfDrawer
        pois={POIS}
        params={PARAMS}
        coords={COORDS}
        lunch={null}
        durations={{}}
        currentMode="grab"
        onChoose={onChoose}
      />,
    )
    screen.getByRole('button', { name: 'Use Walk' }).click()
    expect(onChoose).toHaveBeenCalledWith('walk')
  })

  it('shows a free fare for the walk row', () => {
    render(
      <WhatIfDrawer
        pois={POIS}
        params={PARAMS}
        coords={COORDS}
        lunch={null}
        durations={{}}
        currentMode="grab"
        onChoose={vi.fn()}
      />,
    )
    const walkRow = screen.getByText('Walk').closest('tr')!
    expect(walkRow).toHaveTextContent('Free')
  })
})
