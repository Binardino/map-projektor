# Changelog

All notable changes to this project are documented here, grouped by sprint/session. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## 2026-09-26 — Projection capabilities, config and colour tokens (on `refactor/registry-config`)

No change to what the app shows or does (render fingerprint, UI text snapshot and e2e unchanged; 15 of 17 screenshots byte-identical, the other two within anti-aliasing noise).

### Changed
- Projections declare their behaviour with capability fields (`globe`, `clipAngle`, `fit`, `polarRotation`, `recenterable`, `tilted`) instead of id checks spread over the code; adding a projection is one object again
- `getProjection(id)` replaces the repeated `PROJECTIONS.find(...)` and throws on an unknown id
- Every animation duration is named in `TIMING` (`static/js/config.js`), with the other tunable values (zoom range, drag sensitivity, geometry tolerances, Tissot spacing, compare limit, data URLs); the perf harness reads the polar-route timings from it
- Every colour is a CSS token in `:root`, including the compare and true-size palettes, which the JS reads once

### Added
- `tests/js/projections.test.mjs`: `getProjection` and registry invariants

## 2026-09-26 — ES-module split (on `refactor/es-module-split`)

No change to what the app shows or does: the UI text snapshot, the render fingerprint and the e2e smoke test are identical before and after every commit, and every top-level statement of the old `map.js` reappears verbatim in the modules.

### Changed
- `static/js/map.js` (2 347 lines) is split into 24 ES modules under `data/`, `core/`, `ui/` and `tools/` (largest: 300 lines), loaded from `main.js`. Code was moved, not rewritten; `i18n.js` is a module too
- The seven variables that code in other sections reassigns (current projection, animation flag, world/terrain data, recenter rotation/tilt/flip) live on one `state` object (`core/state.js`), since imported bindings are read-only
- Core reaches the tools only through `tools/index.js`. Side-by-side comparison, flight path and true size, unreachable since the redesign, are no longer loaded; `tools/index.js` gives core inert stand-ins for them
- Every module is `<link rel="modulepreload">`ed: loading them level by level cost ~160ms of cold load at 40ms latency; with the preload, cold load matches the single `map.js` within noise

### Added
- `tests/js/layering.test.mjs`: layers import downwards only (`data` < `core` < `ui`/`tools` < `main`/`debug`); the core → ui calls that PR 4 turns into events are listed as temporary exceptions
- `tests/js/modulepreload.test.mjs`: the preload list in `index.html` equals the static import graph
- The JS unit tests import the modules directly; the `vm` harness is gone

## 2026-09-26 — Refactor safety net (on `test/refactor-safety-net`)

No change to what the app shows or does; these checks give the upcoming modularization of `map.js` an objective yardstick.

### Added
- Read-only `window.__app` debug hook in `map.js` (projections, views, current state, `makeProjection`); the perf harness reads app state through it instead of bare globals
- `scripts/ui_text_snapshot.py`: golden snapshot of every user-visible string across 9 UI states (`tests/ui_text_snapshot.json`)
- `scripts/render_fingerprint.py`: SHA-256 of every drawn country and terrain path for the 17 projections under the Europe- and China-centered views, plus 5 projected control points per projection (`tests/render_fingerprint.json`)
- `scripts/e2e_smoke.py`: 7 scenarios through the main user paths (welcome modal, view kept across projection switches, polar route, camera, distortion grid, cards, mobile drawer), failing on any page error or missing i18n key
- `tests/js/`: Node built-in test runner unit tests for `t()` and the light geometry used by transitions, no npm dependency
- `scripts/check_all.sh`: runs all of the above plus pytest and the perf harness, stopping at the first failure

## 2026-09-26 — Colleague test feedback (on `feature/colleague-feedback`)

### Fixed
- The info and compare cards are docked top-right, beside the toolbar, instead of bottom-right over it. The compare card's country list no longer runs off the bottom of the screen
- The map can no longer be dragged out of the window: panning stops when the map's edge reaches the window's edge (`zoom.translateExtent` on the projected sphere). Mercator's poles stay reachable
- The compare overlay now sits on the same country in the map on screen. Each projection places a country at its own position, so France drawn under Equirectangular used to land on Chad in a Gall-Peters map. It is re-drawn after every projection or view change (it used to stay frozen), and hidden when the country is on the far side of the globe
- Mouse-wheel zoom eases each notch over 150ms instead of jumping ~15% in one frame. The largest per-frame zoom step went from 14.9% to 4.4% (`scripts/perf_transitions.py`, new zoom scenarios)

### Added
- The compare overlay can be dragged across the map: grabbing it moves it, while dragging anywhere else still pans. A wide invisible grab area keeps tiny countries (Luxembourg) grabbable. A projection or view change puts it back on the country
- Compare up to five countries at once under one shared compare projection, each in its own colour, listed with a show/hide checkbox and a remove button. The search field locks once five are picked
- France's comparison includes its overseas collectivities and TAAF (French Polynesia, New Caledonia, Wallis and Futuna, St-Pierre-et-Miquelon, St-Martin, St-Barthélemy)
- Oceania-centered view (150°E)

### Changed
- On the orthographic and azimuthal equal-area views, the recenter presets also tilt the globe so their region sits in the middle of the disc. Flat maps keep a longitude-only rotation (tilting them turns them oblique)
- "USA / Pacific-centered" becomes "America-centered" (90°W), with the whole of the Americas facing the viewer on the globe

## 2026-09-25 — Comparison mode label typo (on `fix/comparison-mode-typo`)

### Fixed
- The comparison tool's tooltip and screen-reader label read "Comparation mode"; it now reads "Comparison mode"

## 2026-09-25 — Smoother coastlines during transitions (on `perf/douglas-peucker-light-geometry`)

### Changed
- The simplified geometry that transitions redraw each frame used to drop any vertex within 1° of the last kept one, which flattened Italy, Greece and Norway into crude polygons during every morph. It now uses Douglas-Peucker at 0.3°, which keeps the points that shape a coastline. 0.2° looked slightly smoother but tripled the dropped frames in the headless perf run. 0.3° costs the same per frame as the old rule (`scripts/perf_transitions.py`: no regression vs baseline)

## 2026-09-25 — Reference lines (on `feature/reference-lines`)

### Added
- New toolbar button (globe icon, between the distortion grid and the theme toggle) that shows/hides the equator, both tropics (±23.44°), both polar circles (±66.56°) and a meridian every 15° (one per hour of Earth's rotation). The equator and Greenwich are drawn heavier, and the named parallels dashed, in an atlas red (`--reference-line` theme token) so they read as distinct from the navy Tissot grid when both are on
- The lines live in `worldGroup`, so they follow recentred views and the upside-down flip. They are re-projected wherever the view settles and on every animation frame (blend, polar spin, recenter rotation, and the coin flip's edge-on swap)
- Parallels are densified (a vertex every 2°) so they follow their latitude instead of bowing along great arcs; meridians go through the equator because pole-to-pole is antipodal
- Cost: ~0.4–0.7ms per animation frame when on (Tissot is ~5–7ms); no change when off. No labels, main view only (compare panels are isolated for now)

## 2026-09-25 — Land-coloured globe flash on the polar route (on `fix/ortho-blend-cut-at-90`)

### Fixed
- Regression from the pink-bands fix below: at exactly 90° (the last frame of a fold onto the globe, or the first of an unfold), the antimeridian cut combined with the clip circle turned countries inside out, so the whole globe was painted land colour. Ordinary switches replace that frame with the final render before it is shown, but the polar route (e.g. Mercator → North Polar) leaves it on screen between the fold and the spin, as a one-frame flash. The cut is now only added once the circle is wider than a hemisphere; below that, the circle already hides the back seam
- Driving the real transition loop, including the exact start and end frames: inside-out countries at the orthographic end went from present in every ortho transition to none, and the bands stay fixed (0 oversized shapes)

## 2026-09-25 — Pink bands during orthographic transitions (on `fix/ortho-blend-pink-bands`)

### Fixed
- Switching between the orthographic globe and any flat projection in a recentred view (South America, USA/Pacific, China, Africa) drew wide horizontal land-coloured bands across the map for most of the morph. These blends animate a clip circle from 90° to 179.9°, but a near-180° circle only punches a tiny hole at the antipode and never cuts along the back meridian, so countries straddling it (Canada and Peru in the China view, China and India in the Pacific one) kept vertices on both edges of the map. `animateBlend` now applies the antimeridian cut before the clip circle
- Real blend loop, 5 flat projections × 5 views × both directions: country shapes drawn more than 4× their normal area went from 721 to 0. Cost: about +1.3ms per frame of path generation, on orthographic blends only

## 2026-09-24 — Full-width sidebar rows (on `fix/sidebar-full-width-rows`)

### Fixed
- Every projection and view button in the left sidebar now spans the full row (minus its 12px side margins), so the hover and selected highlights are all the same width. A `<button>` shrinks to its label even with `display: block`, so each highlight used to be as wide as its text (68px for "Aitoff", 215px for "South America (upside-down)")

## 2026-09-24 — Pink ocean during transitions (on `fix/light-geometry-inverted-rings`)

### Fixed
- During projection morphs and recenter spins the ocean was often painted over in land colour. Thinning three small concave islands (Gotland, Sumbawa, Unalaska) down to a triangle reversed their winding, and on a sphere a reversed ring means "the whole globe minus the island". `thinPolygon` now keeps a polygon unthinned when its thinned version covers more than a hemisphere; only those three islands are affected, so the light geometry's speed-up is unchanged
- Replaying the user's recorded sequence: frames with no visible ocean went from 269/401 to 0 caused by this bug (the remaining ones come from the old upside-down flip, fixed separately in PR #31)

## 2026-09-24 — Coin flip for the upside-down view (on `fix/recenter-coin-flip`)

### Fixed
- Entering or leaving "South America (upside down)" turns the map over like a coin about the equator: it thins towards the equator, goes edge-on, then widens back mirrored. It used to fold towards the top of the screen, vanish for several frames, then slide back in diagonally, because the fold scaled about the SVG's top edge instead of the equator
- One eased 0→180° turn (900ms, `scaleY = cos(angle)`) replaces the two 300ms folds; the sphere rotation is swapped at the edge-on midpoint, where it can't be seen. The resting mirrored state is unchanged

## 2026-09-21 — String extraction (i18n groundwork)

### Changed
- Every user-visible string moved out of `map.js` and `index.html` into `static/i18n/en.json` (flat key → string, ~110 keys), read via `t()` and `data-i18n*` attributes (`static/js/i18n.js`). No visible change: a before/after dump of every text, tooltip, aria-label and placeholder (96 strings at launch, all 17 projections, all 5 views) is identical
- `PROJECTIONS` and `RECENTER_PRESETS` keep only ids, geometry and grouping; names, tradeoffs and view labels come from the dictionary
- The compare card's projection list is built in `init()` after the language loads (it used to be filled at script load, which showed raw keys)

### Added
- `tests/test_i18n.py`: fails when markup or code asks for a key missing from `en.json`, or a projection/view lacks one of its texts

### Not extracted
- Each projection's `description` field (no longer displayed since the Figma redesign) and the flight-path / true-size strings (no visible UI): left as they are rather than translated for nothing

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
