// Local (this-device) storage for saved plans, powering "compare two plans". No
// backend — plans live in localStorage, keyed by the full result query string so a
// saved plan re-opens exactly as it was. All access is guarded: storage can throw
// (Safari private mode, quota) and must never crash the page.

export type SavedPlan = {
  id: string
  name: string
  query: string // the result-page query string (without the leading '?')
  savedAt: number
}

const KEY = 'waypoint:saved-plans'
const MAX = 12

// Small deterministic string hash (djb2-ish) so an id is unique per (time, query)
// — two different plans saved in the same millisecond still get distinct ids.
function hashStr(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

function read(): SavedPlan[] {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function write(plans: SavedPlan[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(plans))
  } catch {
    // Ignore: storage unavailable/full — the feature degrades, the page survives.
  }
}

export function listSavedPlans(): SavedPlan[] {
  return read().sort((a, b) => b.savedAt - a.savedAt)
}

// Save (or refresh) a plan. De-dupes by query so saving the same plan twice keeps
// one entry (with the newer name/time). Caller supplies `now` so this stays testable.
export function savePlan(name: string, query: string, now: number): SavedPlan {
  const plan: SavedPlan = {
    id: `${now}-${hashStr(query)}`,
    name: name.trim() || 'Untitled plan',
    query,
    savedAt: now,
  }
  const next = [plan, ...read().filter((p) => p.query !== query)].slice(0, MAX)
  write(next)
  return plan
}

export function removePlan(id: string): void {
  write(read().filter((p) => p.id !== id))
}
