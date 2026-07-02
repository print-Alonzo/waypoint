import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { POI, TransitMatrix } from '@/lib/scheduler'
import { estimateTransitMinutes } from '@/lib/scheduler'
import { START_LOCATIONS } from '@/lib/constants'
import { validatePoi } from '@/lib/poi-validate'

// Local-only content tool: appends a validated place to the committed dataset and
// regenerates the transit matrix. It writes to the repo on disk, so it MUST NOT run
// on Vercel (read-only filesystem) — the guard below refuses there. Author locally,
// review the git diff, commit, and redeploy to publish.

const CITY = process.env.NEXT_PUBLIC_CITY ?? 'metro-manila'

// process.cwd() is the `web/` package dir under `npm run dev` / `npm run start`.
function dataPath(file: string): string {
  return join(process.cwd(), 'data', CITY, file)
}

// Recompute the whole matrix from POI coordinates using the scheduler's own
// straight-line estimate — the identical math the generator script and the
// scheduler's missing-entry fallback use, so cached values never drift. Rows are
// one-directional (landmark→POI, POI→POI only), matching scripts/generate-matrix.mjs.
function pairTimes(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): { walk: number; jeepney: number; grab: number } {
  return {
    walk: estimateTransitMinutes(from, to, 'walk'),
    jeepney: estimateTransitMinutes(from, to, 'jeepney'),
    grab: estimateTransitMinutes(from, to, 'grab'),
  }
}

function buildMatrix(pois: POI[]): TransitMatrix {
  const matrix: TransitMatrix = {}
  for (const landmark of START_LOCATIONS) {
    matrix[landmark.id] = {}
    for (const poi of pois) matrix[landmark.id][poi.id] = pairTimes(landmark, poi)
  }
  for (const from of pois) {
    matrix[from.id] = {}
    for (const to of pois) {
      if (from.id === to.id) continue
      matrix[from.id][to.id] = pairTimes(from, to)
    }
  }
  return matrix
}

export async function POST(request: Request) {
  if (process.env.VERCEL) {
    return Response.json(
      {
        ok: false,
        error:
          'The admin tool only runs locally — the deployed filesystem is read-only. Run Waypoint on your machine to add places.',
      },
      { status: 403 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  let pois: POI[]
  try {
    pois = JSON.parse(readFileSync(dataPath('pois.json'), 'utf8')) as POI[]
  } catch {
    return Response.json(
      { ok: false, error: `Could not read data/${CITY}/pois.json on the server.` },
      { status: 500 },
    )
  }

  const existingIds = new Set(pois.map((p) => p.id))
  const { errors, poi } = validatePoi(body as Record<string, unknown>, existingIds)
  if (!poi) {
    return Response.json({ ok: false, errors }, { status: 422 })
  }

  const nextPois = [...pois, poi]
  try {
    // Match each file's existing on-disk convention: pois.json has no trailing
    // newline; the generator writes the matrix with one.
    writeFileSync(dataPath('pois.json'), JSON.stringify(nextPois, null, 2))
    writeFileSync(dataPath('transit-matrix.json'), JSON.stringify(buildMatrix(nextPois), null, 2) + '\n')
  } catch (e) {
    return Response.json(
      { ok: false, error: 'Failed to write data files: ' + (e as Error).message },
      { status: 500 },
    )
  }

  return Response.json({ ok: true, poi, total: nextPois.length })
}
