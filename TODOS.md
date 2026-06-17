# TODOS — Waypoint

Deferred items from /plan-ceo-review (2026-06-17). V2 work for post-MVP test cycle.

---

## V2 Items

### T1: Shareable URL
**Priority:** P2  
**Effort:** S (human: ~4h / CC: ~30min)  
**Depends on:** V1 complete + first test cycle confirms behavioral intent to share

**What:** Encode POI list + start time + transport mode + day-of-week as URL query params.
Sharing the URL regenerates the exact same itinerary on any device without sessionStorage.

**Why:** sessionStorage is session-local — testers can't share results or reopen on another
device without regenerating. Shared URLs are a clear behavioral evidence signal (social proof).
Also eliminates the multi-tab clobber issue.

**Where to start:** Replace sessionStorage write on form submit with URL construction.
`?pois=fort-santiago,intramuros&start=09:00&mode=grab&day=Saturday&from=rizal-park`
On result page mount: read from URL params instead of router state.

---

### T2: Map view
**Priority:** P3  
**Effort:** M (human: ~8h / CC: ~1h)  
**Depends on:** V1 complete + at least 1 tester requests 'can I see this on a map?'

**What:** Show the ordered itinerary as numbered pins on an interactive map (Leaflet + OSM or
Google Maps JS API). Pins labeled 1, 2, 3... in visit order. Lines connecting them.

**Why:** Working-professional testers frequently verify routes visually in Google Maps. A map
view with numbered pins is a stronger trust signal than a text list — it shows the route makes
geographic sense.

**Where to start:** Leaflet + OpenStreetMap is the zero-cost option (no API key). Add
`data/metro-manila/` lat/lng from pois.json as markers. Google Maps JS API adds billing complexity.

---

### T3: Mode-specific confidence labels
**Priority:** P2  
**Effort:** XS (human: ~1h / CC: ~10min)  
**Depends on:** Week 5 spot-check complete (need actual error margin data per mode)

**What:** Replace uniform "Estimated — verify with Google Maps" label with mode-specific
accuracy ranges derived from spot-check data. Example:
- Walk: "±5 min estimate"
- Jeepney: "±15 min estimate (traffic varies)"  
- Grab: "±10 min estimate"

**Why:** The uniform label treats all modes as equally inaccurate. Jeepney has much higher
variance in Metro Manila than Grab or walking. Mode-specific labels are more honest and calibrate
tester expectations more accurately, especially for the least accurate mode (jeepney).

**Where to start:** After Week 5 spot-check, calculate actual error margins per mode from the
comparison data. Update the confidence label component with mode-aware text.

---

## V3+ Items

- **Multi-day scheduling** — single-day is the narrowest viable wedge; multi-day adds
  state complexity without adding trust-model value for MVP.
- **Live POI data (API-driven)** — replace static JSON with live data from Google Places or
  a local tourism API. Unblocks real-time hours + new POI discovery. Adds API dependency.
- **Budget tracking** — per-stop cost estimates. Requires a new data field in pois.json.
- **Group itinerary branching** — split the group at a POI, rejoin later. Complex state model.
- **Booking integration** — link to venue ticketing. Requires partnership/API access.
