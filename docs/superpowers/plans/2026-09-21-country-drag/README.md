# Feature 32 — Drag a country across the map (design)

Goal, from the user (2026-09-21): select a country, then drag it with the mouse and watch it deform as it
moves, like "The True Size Of…". Replaces the toolbar's current "Comparison mode", which only redraws the
selected country under a second projection and "does not work as intended".
Gesture decision (user, 2026-09-21): **the selected country is grabbed directly; dragging anywhere else pans the
map** — plus an explicit "move" mode as a fallback. Plan and subtasks: [plan.md](plan.md).

## What exists today (checked in the code, 2026-09-21)

| Piece | Behaviour | Consequence |
|-------|-----------|-------------|
| Compare card (`refreshCompareHighlight`) | Draws the country once under a chosen second projection | Nothing moves; to be replaced |
| True Size drag (Feature 25, unreachable) | `d3.drag` sets an SVG `transform: translate()` on the already-projected path | Shape is **translated, never re-projected**, so it does not deform |
| `d3.zoom` on the SVG | Drag pans the camera; the filter only ignores orthographic drags | A drag that starts on a country pans the map |
| Feature 21 click | Clicking a country selects it and zooms (max 3×) | Must not zoom while dragging is the goal |

## Two problems, two solutions

### 1. Deformation = re-project on every pointer move
Keep the country's true shape on the sphere and move it there; the projection then does the deforming.

- Pointer → screen point → undo camera zoom and (for the upside-down view) the CSS flip → `projection.invert` →
  target `[lon, lat]` (same recentred projection as the map, so it works in every view).
- Move the country's vertices by a **rigid rotation of the sphere** that takes its centroid to the target
  (distances between its points are preserved — that is what "true size" means), then `geoPath` as usual.
- Pure vector maths in `core/sphere-move.js` (no D3 dependency, ~40 lines): lon/lat ↔ unit vectors, rotation taking
  vector *a* to vector *b*, optional roll. It runs in Node, so it gets real unit tests.
- **Orientation choice (open — spike decides):** a plain great-circle move makes the country slowly rotate
  relative to the parallels as it travels. The alternative adds a roll after the move so the country's own "north"
  keeps pointing at local north (it stays upright, which is what people expect from The True Size Of…).
  Proposal: implement both behind one option, compare visually on Africa, Russia, Chile, then keep one.
- Cost: one country per pointer move (a few hundred vertices, fewer with the light geometry) — far cheaper than
  the map-wide morph, no perf risk expected; measured in the plan.

### 2. Gesture conflict (drag = pan vs drag = move)
- **Default (a)** — the selected country is a separate overlay `<path>` above the map, identical to the country at
  rest. `d3.drag` on it stops the mousedown from reaching `d3.zoom`, so:
  - pointer over the selected country → cursor `grab`, drag moves it;
  - anywhere else → pans; wheel and pinch still zoom everywhere (wheel is not stopped).
  This is the mechanism Feature 25 already proved to work around zoom capture.
- **Small countries** (Luxembourg, Singapore) are impossible to grab at world scale: the overlay gets an invisible
  stroke (about 14 px, `vector-effect: non-scaling-stroke`) as a fat hit area, and the halo shows on hover.
- **Fallback (c)** — a "Move country" switch in the card: while ON, a drag *anywhere* moves the country (pan is
  suspended, wheel still zooms). Needed for tiny countries on touch and for anyone who prefers it explicit.
- **Touch:** one finger on the country moves it, elsewhere pans, two fingers always pan/zoom.
- Keyboard: `Esc` puts the country back at home; arrow keys nudge (accessibility, stretch).

## UX spec

1. Open the toolbar compare button → card opens (as today), country search field focused.
2. Pick a country (search or click on the map). **No auto-zoom** in this mode, so the whole map stays available to
   drag across. The country keeps its place on the map (dimmed outline "ghost") and the overlay sits on it.
3. Drag: the overlay follows the cursor, deforming live; the ghost stays at home for reference.
4. Card shows the name, a **"Back to place"** button, the "Move country" switch and (stretch) a readout such as
   "appears 3.2× larger than at home" (projected area ratio, computed from `geoPath.area`).
5. Switching projection or view keeps the geographic position and re-projects it (unlike Feature 25's snap-back).
   During the morph the overlay fades out and back in (cheap); animating it is a later option.
6. Closing the card removes the overlay and the ghost.

## Decisions still open (need the user)

| # | Question | Default if not answered |
|---|----------|-------------------------|
| D1 | Remove the card's second-projection dropdown? (deformation now happens on the live map) | Remove it |
| D2 | Several countries at once, True-Size style? | v1 one country, data model already an array |
| D3 | Upright vs great-circle orientation | Decided by the visual spike |
| D4 | Does the area-ratio readout ship in v1? | Yes if the spike shows it is cheap |
| D5 | Animate the overlay through projection morphs? | No (fade) |

## Where it lives (after the modularization plan)

`tools/country-drag.js` on the `MapView` from PR 5 of the modularization plan, drawing in the view's `highlight`
layer, with state slice `drag: { country, target }` from PR 4. The pure maths is independent and can be built
and tested first, before the modularization, if the user wants an earlier start.
