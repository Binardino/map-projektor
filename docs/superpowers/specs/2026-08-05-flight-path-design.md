# Flight Path / Great Circle — Design Spec

Date: 2026-08-05

## Goal

Let the user click two points anywhere on the map and see the great-circle route between them, with its real-world distance. Switching projection re-renders the same route, showing how its curvature changes — Mercator and similar projections badly distort what "shortest path" looks like, and this makes that distortion tangible (e.g. why transpolar flights curve near the pole on a globe but not on a flat Mercator map).

## Context

The app (FastAPI + D3.js) already renders 17 cartographic projections with animated transitions, and has three existing overlay/interaction patterns this feature follows closely:

- **Tissot's indicatrix** (`static/js/map.js`) — a toggleable overlay layer, recomputed on every projection switch, mirrored onto both comparison-mode panels.
- **Recenter presets** — a toggleable mode that changes what map interaction means, mutually exclusive with country selection.
- **Country search/selection** (`applySelectionToPanel`) — state placed by interacting with the single map view, mirrored read-only onto the two comparison panels.

Flight path reuses all three patterns rather than inventing a new one.

## Data available

`app/data/world.geojson` is country-level polygon data (Natural Earth 110m). There is no city/point dataset, so endpoints are arbitrary geographic coordinates picked by clicking the map — not a curated list, not country centroids.

## Interaction

A new sidebar button, **"Draw Flight Path"**, in the same family as Compare/Tissot/Recenter toggles (`#flightpath-toggle`).

- **Inactive** (default): clicking the map behaves as today (country selection).
- **Active**: clicking anywhere on the map (country or ocean) places a point.
  - 1st click → point A
  - 2nd click → point B, draws the arc, shows the distance
  - 3rd click → starts over: clears the previous route, places a new point A
- Deactivating the button clears any in-progress or completed route.

Mutually exclusive with country search/selection and recenter presets, matching the existing convention: activating flight-path mode clears whichever of those is active, and vice versa. Compatible with the Tissot overlay (no conflict — Tissot doesn't intercept clicks).

## Technical approach

### Coordinate capture

A single click listener on `#map-svg` (not per-`path.country`) fires when flight-path mode is active, reads the click's screen coordinates, and converts them to `[lon, lat]` via `projection.invert([x, y])`. The existing per-country click handler (which calls `selectCountry`) must no-op while flight-path mode is active, so a click on a country places a route point instead of also triggering country selection.

**Known risk:** `.invert()` support varies across the 17 projections — D3 core projections implement it reliably; some `d3-geo-projection` extensions may not, or may be numerically unstable near projection edges/singularities. This must be verified empirically per projection during implementation. Where a projection's invert is unreliable, follow the existing `RECENTER_INCOMPATIBLE` pattern: disable the flight-path button (with an explanatory `title`) rather than allowing a broken interaction.

### Route rendering

- Points A and B are stored as `[lon, lat]` pairs — projection-independent, like the Tissot grid points.
- The arc: `d3.geoInterpolate(A, B)` sampled at regular intervals (~100 points) into a `LineString`, projected with the current projection's `d3.geoPath()`, same mechanism as the Tissot circles.
- Rendered in a dedicated SVG group (`flightpath-layer`), appended after the country/Tissot layers so it paints on top; `pointer-events: none` on the path itself so it doesn't block subsequent point-placement clicks.
- Two small circle markers at A and B.
- Distance: `d3.geoDistance(A, B) * EARTH_RADIUS_KM` (6371), displayed as plain text (e.g. "New York → Tokyo: 10,850 km") near the toggle button.

### Recompute on projection change

A `refreshFlightPath()` function (parallel to `refreshTissot()`) re-projects and redraws the stored A/B points whenever the active projection changes — called from the same call sites as `refreshTissot()` (`init()`, end of `transitionTo()`).

### Comparison mode

The same A/B points are mirrored onto both comparison panels (read-only — clicking a panel does not place points; only the single map view does). Each panel gets its own `flightpathGroup`, populated the same way `tissotGroup` is mirrored today via `applySelectionToPanel`-style logic. If no route exists, both panels simply show nothing.

## Explicitly out of scope (v1)

- No dashed straight-line comparison overlay (real curve + distance number only)
- No curated city list — free-click endpoints only
- No persistence of a drawn route across a full page reload (resets on reload, same as other transient UI state)

## Testing

Manual verification via Playwright (matching the pattern used for every prior feature this session):

- Click two points on Mercator, verify an arc renders and distance is a plausible number
- Switch projection with a route drawn, verify the arc re-renders correctly (no stale/frozen path)
- Verify `.invert()` behaves sanely across a representative spread of projections (cylindrical, pseudocylindrical, azimuthal, conic, both polar routes) — document any that need to go on an incompatibility list
- Verify mutual exclusion with country selection and recenter presets in both directions
- Verify the route mirrors onto both comparison panels and that clicking a panel does not place a point
- Verify deactivating the toggle clears the route
- No console errors in any of the above
