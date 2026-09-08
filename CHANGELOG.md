# Changelog

All notable changes to this project are documented here, grouped by sprint/session. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## 2026-09-08 — UX feedback pass: colors, camera, Mercator, default view

### Changed
- Softened the default theme's ocean color and country border color (less saturated blue, less red in the borders)
- Replaced the zoom-locked-to-selection model with a free camera: clicking a country or a search result gently centers/zooms on it, but pan (drag) and zoom (wheel/pinch) are always free afterward, independently in each comparison panel too
- App now defaults to the Orthographic (globe) view on load instead of Mercator, with a dedicated darker background for the space outside the sphere disc

### Fixed
- Mercator no longer renders with large empty margins on both sides — it was fitting to the viewport's height (its bounded aspect ratio is close to square) instead of its width; now fits to width and crops the poles, like standard Mercator world maps

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
