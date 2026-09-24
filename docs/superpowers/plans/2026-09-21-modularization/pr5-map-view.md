# PR 5 — MapView abstraction (item 6)

Purpose: one "map view" object (SVG, layers, zoom, projection, camera) used by the main map and by any secondary
map, so tools and rendering are written once. Today `buildComparePanel` (~140 lines) re-implements rendering, zoom
and overlays around `panel.svg` / `panel.zoom` / `panel.projId`, and the main view uses module-level globals.
Branch: `refactor/map-view`. Size: large, ~2–3 days.

## Design

`core/map-view.js`:

```js
createMapView({ svgEl, width, height, layers, zoomExtent })
// → { svg, layers: { sphere, countries, terrain, tissot, flight, truesize, highlight },
//     zoom, projectionId, rotation, transform,
//     setProjection(def, rotation), render(), destroy() }
```

- `layers` is a list, so the main view asks for all seven and a secondary view only for the ones it needs;
  z-order is defined once (sphere → countries → terrain → tissot → flight → truesize → highlight).
- Per-view state (`projectionId`, `rotation`, `transform`) lives on the view. The main view is registered in the
  global store from PR 4 (`views.main`), so UI keeps reading `getState()`.
- Tools and render/animation/camera functions take a `view` argument; nothing reaches for module-level `svg` again.
- Animations run on a view, which makes independent per-panel morphs possible later (backlog Feature 2 note) —
  not implemented here.

## Subtasks

1. **API doc + pure-part tests**: write the interface above in the module header; unit-test the layer-order table
   and option validation (unknown layer name throws).
2. **Extract the main view**: replace module-level `svg`, `zoomLayer`, `worldGroup`, `globeSphere*`, `mapGroup`,
   `terrainGroup`, `tissotGroup`, `flightPathGroup`, `truesizeGroup`, `compareHighlightGroup`, `oceanRect`, `zoom`
   with `mainView.*`. Done when: gate green with no behaviour change.
3. **Render and animation take a view**: `renderMap(view, projection)`, `animateBlend(view, …)`,
   `animateRotation(view, …)`; the per-frame `frame` event (PR 4) carries the view.
4. **Camera per view**: zoom filter, `resetCamera(view)`, focus-on-country and globe drag use the view's own
   zoom and transform (the flight-path click already needs "this view's transform" — that special case disappears).
5. **Tools take a view**: Tissot, flight path and true size initialise against a view instead of the main map.
   Tissot then works unchanged in any view, ending the "mirror onto both panels" duplication.
6. **Rebuild side-by-side on MapView** (still isolated and disabled): `buildComparePanel` shrinks to creating two
   views and a dropdown each; `applySelectionToPanel` and the duplicated fit/zoom code are deleted.
   Done when: enabling the tool flag in a scratch build shows two working panels (manual check; it stays off).
7. **New compare card highlight** uses `mainView.layers.highlight` (no ad-hoc group creation).
8. **Verification**: render fingerprint identical for all 17 projections × 2 views; e2e smoke; perf harness
   within 1.15× of PR 4. The line count of `tools/side-by-side.js` before/after goes in the PR description.
9. **Docs**: architecture diagram (`views → layers → tools`) in `CLAUDE.md`; changelog.

## Risks

- Highest-churn PR: nearly every core function gains a parameter. Mitigated by doing it commit-by-commit with the
  fingerprint check after each, and by keeping `mainView` as a module singleton until subtask 8 passes.
- SVG layer creation order changes z-order silently — the layer-order table plus the fingerprint (which hashes
  document order of `path` elements) catch it.
- Zoom behaviours are per `svg`; sharing a `d3.zoom` instance between views would cross-talk. Each view builds its own.
