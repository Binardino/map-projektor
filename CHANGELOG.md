# Changelog

All notable changes to this project are documented here, grouped by sprint/session. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## 2026-09-21 — Welcome modal

### Changed
- The help modal is now a welcome modal: it opens on every launch (no more `mapProjektorHelpSeen` flag) with a "Welcome to Map Projektor!" title, a short plain-spoken pitch on why flat maps have to compromise, then a "How it works" list
- Its copy was rewritten in a plainer voice and now names the controls that actually exist — the old text still described the "Show Distortion Grid", "Draw Flight Path" and "Compare True Size" buttons the Figma redesign removed
- `scripts/perf_transitions.py` closes the modal after loading instead of pre-setting the old localStorage flag

## 2026-09-21 — Transition perf + view persistence (on `perf/light-geometry-transitions`)

### Changed
- Transitions reproject a thinned copy of the country/terrain geometry (`buildLightGeometry`: vertices closer than 1° dropped, sub-degree islands skipped) instead of the full 21k-vertex world; path generation per frame drops from ~46ms to ~14ms. The final render still uses the full data, so the resting map is unchanged (specks under ~4px only reappear once the morph ends)
- Blended projections resample at 2px precision (was D3's 0.5px default) — invisible while moving, ~1ms/frame saved
- Switching projection now keeps the active view (China, USA/Pacific, Africa, upside-down) — the morph carries its rotation instead of snapping back to Europe. Albers and the polar views can't be recentred, so they ease back to Europe-centered first
- "World View" renamed "Europe-centered" (id `world` unchanged)
- Perf harness: hard 24ms average-frame ceiling and 1.15x baseline tolerance (was 1.5x, which let a ~25ms baseline pass unnoticed); new `view china: …` cases cover view-preserving transitions

### Added
- "Africa-centered" view (centred near 20°E)

### Measured (headless Chromium, software raster)
- Average frame ~27ms → ~20ms on standard transitions, polar route ~43ms → ~22ms (twice as many frames rendered). Floor in this environment is ~16.9ms (pure-CSS flip), so remaining cost is mostly rasterisation, not JS

## 2026-09-20 — South America flip fix + transition perf harness (on `feature/figma-redesign`)

### Fixed
- South America (upside-down) recenter: entering/leaving it no longer runs a visible longitude-rotation sweep before the mirror flip — the sphere now folds edge-on, swaps rotation while invisible, then unfolds mirrored, reading as one clean paper-flip instead of a distorted diagonal spin
- Terrain and Tissot overlays no longer re-run their full D3 enter/exit data join on every animation frame (`renderTerrain`/`renderTissot` → new `updateTerrainPaths`/`updateTissotPaths` for per-frame repaints) — same patch count every frame, only the `d` attribute needs updating mid-animation

### Added
- `scripts/perf_transitions.py`: headless-Chromium (Playwright) perf regression check for every projection switch and recenter preset, comparing avg-frame-time / dropped-frames against a committed baseline (`tests/perf_baseline.json`). Run via `poetry run python scripts/perf_transitions.py`; `--write-baseline` to update the reference after a verified improvement. Not wired into `pytest` — kept as a separate, deliberately-run command since it drives a real browser and takes ~1-2 minutes

### Known limitation
- Per-frame reprojection of ~170 country paths (the documented core of the projection-blend animation, avoiding path-string interpolation bugs) remains the dominant cost on most transitions (~20-24ms avg frame, noticeable dropped frames in headless measurement) — not addressed here; would need a larger rendering change (e.g. Canvas/WebGL) to fix. South America's flip is exempt since it's now pure CSS transform (GPU-composited, 0 dropped frames measured)

## 2026-09-12 — Onboarding help modal

### Added
- Help modal explaining the app's core principle (no projection can preserve shape, area, distance and direction all at once) plus a short pointer to each control — opens automatically on first visit (`localStorage` flag) and reopenable at any time via a new "?" button in the sidebar header

## 2026-09-12 — Per-projection tradeoffs panel

### Added
- `#projection-info` now has a collapsible "Preserves & distorts" section for the active projection, listing what it preserves, what it distorts, and what it's best suited for — collapses automatically on every projection switch

## 2026-09-12 — Terrain overlay cleanup

### Fixed
- Removed "Plateau" from the mountain terrain classification — it was grouping large elevated-but-flat regions (Brazilian Highlands, Mexican Altiplano, Australia's Western Plateau) with real mountain ranges, making Spain, Portugal, Mexico, and Brazil render as almost entirely "mountain". Verified against country geometries: Spain 18%, Portugal 0%, Mexico 44%, Brazil 6%, Australia 10% mountain coverage, down from near 100%
- Dissolved overlapping same-kind terrain polygons (`shapely.unary_union`) into one shape per kind before export — adjacent/overlapping named sub-ranges no longer stack their semi-transparent fill into visibly darker blotches
- Australia's East coast mountain band (Great Dividing Range) remains visually broad — a real limitation of Natural Earth's generalization at this data resolution, not a classification bug

## 2026-09-12 — Globe sphere outline

### Fixed
- The Orthographic (globe) view now draws the sphere's own edge as a real shape (ocean-colored, with a stroke), instead of relying on the flat background rect — previously the globe disc and the void behind it were painted the same color, so the globe's boundary was invisible
- Also added to both comparison panels when either shows Orthographic

## 2026-09-12 — "Compare its true size" shortcut from country search

### Added
- New "Compare its true size" button, shown whenever a country is selected via the main search (or a direct map click) — adds it straight to the True Size Of... draggable list without having to search for it again in that tool's own panel

## 2026-09-11 — "True Size Of..." country comparison

### Added
- New "Compare True Size" tool in the sidebar (dedicated search + checklist, independent from the main country search): pick several countries, each spawns as a draggable, colored silhouette at its true geographic position under the current projection
- Shapes can be dragged freely anywhere on the map to compare apparent sizes; switching projection snaps every shape back to its true geographic position under the new projection rather than keeping the dragged offset
- Colors cycle through a fixed palette in the order countries are added; unchecking a country (✕ in the list) removes its shape
- Scoped to the main view only, same precedent as the terrain overlay and globe-drag rotation — not available in comparison mode

## 2026-09-11 — Flight path in comparison mode

### Fixed
- The flight-path tool now works in comparison mode: each panel gets its own `flightPathGroup` and click handler (using that panel's own projection/zoom), instead of the click handler being wired only to the (hidden-in-compare) main map — previously nothing happened when clicking a panel with the tool active
- Removed the compare↔flight-path mutual exclusion, no longer needed now that both can render together; the A/B endpoints remain a single shared pair mirrored onto both panels, same convention as the Tissot overlay

## 2026-09-09 — Camera reset on projection switch

### Changed
- Switching projection now dezooms/re-centers the free camera back to the standard view before running the morph, instead of carrying over whatever pan/zoom the user left it at — fixes inconsistent framing when switching in/out of Mercator (or any projection) while zoomed in
- New reset-view button (bottom-right corner of the map) resets the camera to the standard view at any time

## 2026-09-09 — Collapsible country search

### Changed
- Country search is now hidden behind a search icon button instead of a top-level input, per UX designer feedback; selecting a country (via search or a direct map click) still reopens the panel so its "Reset view" control stays reachable

## 2026-09-09 — Terrain overlay: mountains, deserts, forest basins

### Added
- Terrain patches rendered decoratively on the main map, sourced from Natural Earth's physical regions dataset: mountain ranges/plateaus in brown (Alps, Andes, Himalayas, Rockies...), deserts in sandy tan (Sahara, Gobi, Kalahari, Atacama...), and the Amazon/Congo basins in green as a rough proxy for tropical rainforest extent — Natural Earth has no dedicated forest layer, so this is an approximation, not real canopy data
- New `/data/terrain.geojson` route and pipeline step in `scripts/fetch_geodata.py`

## 2026-09-09 — Animated distortion grid

### Changed
- The Tissot's Indicatrix distortion grid now redraws on every frame of a projection transition (both regular blends and the polar fold/spin/unfold route) instead of only refreshing once the transition finishes

## 2026-09-08 — UX feedback pass: colors, camera, Mercator, default view

### Changed
- Softened the default theme's ocean color and country border color (less saturated blue, less red in the borders)
- Replaced the zoom-locked-to-selection model with a free camera: clicking a country or a search result gently centers/zooms on it, but pan (drag) and zoom (wheel/pinch) are always free afterward, independently in each comparison panel too
- App now defaults to the Orthographic (globe) view on load instead of Mercator, with a dedicated darker background for the space outside the sphere disc
- Dragging on the Orthographic globe now rotates the sphere itself (reveals the far side), instead of panning the screen — wheel/pinch still zoom as on every other projection

### Fixed
- Mercator no longer renders with large empty margins on both sides — it was fitting to the viewport's height (its bounded aspect ratio is close to square) instead of its width; now fits to width, like standard Mercator world maps
- Mercator's polar regions (Greenland's north, northern Russia, Antarctica) are no longer permanently cropped away — they extend past the initial frame and are reachable by panning the free camera up/down

## 2026-09-07 — Docker containerization

### Added
- `Dockerfile`: multi-stage build (Poetry install → slim runtime image, non-root user), generates `app/data/world.geojson` at build time so the container is standalone at runtime, binds to `$PORT` (defaults to 8000)
- `.dockerignore` to keep the build context small
- `docker-compose.yml` for a one-command local run
- README section documenting `docker build` / `docker run` / `docker compose up`

## 2026-09-06 — Sidebar UX reorg

### Changed
- Promoted the projection list and theme switcher to sit right after country search, since switching projections is the app's primary interaction
- Regrouped Compare Projections, Show Distortion Grid, and Draw Flight Path under a de-emphasized "Tools" panel further down the sidebar (reduced font-size/opacity vs. the primary list)

## 2026-08-05 — Mobile layout, Tissot fix, persistent zoom & recentered projections

### Added
- Responsive layout: off-canvas sidebar drawer (hamburger toggle + backdrop) under 768px; comparison mode stacks its two panels vertically instead of side by side
- Graticule (meridian/parallel) lines under the Tissot indicatrix overlay, so the distortion grid reads visually as a grid instead of isolated circles
- Selecting a country and switching projection now dezooms to the world view, runs the transition, then rezooms on the same country — instead of dropping the selection outright
- Mouse wheel zooms in/out on the selected country (centred on its bounding-box centre, clamped to 1×–6× past the default framing)
- Recenter View presets: China-centered, USA/Pacific-centered, and South America upside-down — curated examples showing that the default Europe-centered map is itself a cartographic convention, not a neutral baseline. Disabled on projections where it wouldn't compose meaningfully (Albers, both polar views).

### Fixed
- Sidebar hamburger button only opened the drawer, never closed it on a second click

## 2026-08-04 — Tissot's Indicatrix

### Added
- Distortion grid overlay ("Show Distortion Grid"): a 30° grid of geographic circles that render as ellipses under projection, revealing local distortion — the standard cartography tool for comparing projections objectively
- Overlay mirrors onto both panels when comparison mode is active

## 2026-08-03 — Country search & side-by-side comparison

### Added
- Country search and click-to-zoom: search or click a country to pan/zoom and highlight it, for comparing its apparent size across projections
- Side-by-side comparison mode: two independently selectable projections rendered at once, with synced country search/selection across both panels
- Theme selection now persists across page reloads via `localStorage`
- `README.md` with setup, project structure, and extension instructions

## 2026-07-04 — Polar projections

### Added
- North Polar and South Polar azimuthal equidistant projections
- Dedicated polar transition route: fold onto the orthographic globe → spin to the target pole → unfold, avoiding the visual sweep of a direct blend between a flat projection and a polar disc

## 2026-07-03 — Animation & theme simplification

### Changed
- Simplified the transition animation pipeline
- Switched the default UI theme to Blue

## 2026-06-09 — Sprint 7: visual polish

### Added
- Gall-Peters projection
- Dark Mode theme and runtime theme switcher

### Fixed
- Natural Earth 50m data, antimeridian clipping, and Orthographic transition rendering
- Coordinate-count mismatches during projection transitions guarded against

## 2026-06-08 — Core app: map, projections, animation

### Added
- FastAPI server (index, GeoJSON, static routes)
- One-shot GeoJSON data pipeline (Natural Earth fetch + Douglas-Peucker simplification via Shapely)
- Full D3 world map with a dynamically built sidebar and instant projection switching
- Animated projection transitions via `d3.interpolateString` morphing

## 2026-06-07 — Project setup

### Added
- Initial project scaffolding: dependencies, `CLAUDE.md`, `.gitignore`
- Design spec and implementation plan
