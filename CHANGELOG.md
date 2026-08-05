# Changelog

All notable changes to this project are documented here, grouped by sprint/session. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## 2026-08-05 — Mobile layout, Tissot fix & persistent country zoom

### Added
- Responsive layout: off-canvas sidebar drawer (hamburger toggle + backdrop) under 768px; comparison mode stacks its two panels vertically instead of side by side
- Graticule (meridian/parallel) lines under the Tissot indicatrix overlay, so the distortion grid reads visually as a grid instead of isolated circles
- Selecting a country and switching projection now dezooms to the world view, runs the transition, then rezooms on the same country — instead of dropping the selection outright
- Mouse wheel zooms in/out on the selected country (centred on its bounding-box centre, clamped to 1×–6× past the default framing)

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
