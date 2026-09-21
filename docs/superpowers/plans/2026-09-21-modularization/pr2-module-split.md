# PR 2 — ES-module split + tool isolation (items 2 and 1)

Purpose: turn `map.js` into modules by *moving code only*. Zero logic change; renames limited to
adding `export`/`import`. Branch: `refactor/es-modules`. Size: large, ~2–3 days, many small commits.

## Target layout

Line ranges below are indicative: measured on `map.js` as of PR #28 (i18n extraction, 1 911 lines). Re-derive them
from the declaration list at the start of the PR, since the file will have moved.

```
static/js/
  main.js                 entry: init(), wiring (replaces init() + top-level wiring)
  debug.js                window.__app hook (moved from map.js)
  i18n.js                 unchanged (becomes a module)
  config.js               constants (created empty here, filled in PR 3)
  data/projections.js     PROJECTIONS, projectionName            (map.js 13–177)
  data/views.js           RECENTER_PRESETS, RECENTER_INCOMPATIBLE (923–934)
  core/scene.js           svg + layer groups                     (179–240)
  core/projection.js      fitProjection, makeProjection, blendProjection, clipAngleOf (279–306, 429–495)
  core/geometry.js        light geometry                         (308–351)
  core/render.js          renderMap, renderGlobeSphere, terrain  (353–427)
  core/animation.js       blend / rotation / polar / transition  (497–670)
  core/recenter.js        applyRecenter, flip, switchProjection  (972–1095)
  core/camera.js          zoom, reset, globe drag                (1097–1186)
  core/selection.js       country selection                      (1187–1257)
  ui/sidebar.js           buildSidebar, setActiveButton, recenter panel (860–921, 936–970)
  ui/info-card.js         (673–722)      ui/compare-card.js (724–857)
  ui/welcome-modal.js     (1828–1851)    ui/theme.js (1890–end)    ui/mobile-sidebar.js (1412–1437)
  tools/index.js          registry: { id, enabled, init } list, single switch per tool
  tools/tissot.js         (1439–1535)  — ENABLED, reachable from the toolbar grid button
  tools/side-by-side.js   (1258–1411)  — isolated, disabled
  tools/flight-path.js    (1537–1666)  — isolated, disabled
  tools/true-size.js      (1668–1826)  — isolated, disabled
```

Shared mutable state (`currentProjectionId`, `isAnimating`, `worldData`, …) moves *as it is* into a temporary
`core/legacy-state.js` exporting a single mutable object; PR 4 replaces it. This keeps the split mechanical.

## Subtasks

1. **Skeleton**: `<script type="module" src="/static/js/main.js">` next to the CDN scripts (deferred, so `d3`
   is defined); `main.js` initially imports a copy of `map.js` unchanged.
   Done when: app boots identically, `.js` served with a module-compatible MIME type (checked via Playwright).
2. **Leaf modules first**: `data/*`, `core/geometry.js`, `config.js`.
   Done when: gate green after each commit.
3. **Core modules**: scene → projection → render → animation → recenter → camera → selection.
4. **UI modules**: info card, compare card, sidebar, welcome modal, theme, mobile sidebar.
5. **Tools isolation**: move the four tool blocks into `tools/*.js`, each exporting `init()`; `tools/index.js`
   lists them with an `enabled` flag (`tissot: true`, the other three `false`). Disabled tools are not
   imported at boot (dynamic `import()` when enabled) so they cost nothing.
   Core → tool calls that exist today (`refreshTissot`, `refreshFlightPath`, `resetTrueSizeOnProjectionSwitch`,
   per-frame `updateTissotPaths`) stay as direct calls through `tools/index.js` in this PR; PR 4 turns them into events.
6. **Ratchet tests**:
   - `tests/js/layering.test.js` enforces the layering rule from the index (parses imports). One documented,
     temporary exception: `core/*` may import `tools/index.js` (the direct calls listed in subtask 5); the exception
     is deleted in PR 4 and the test then forbids it.
   - `scripts/check_split.py` (one-off, not committed): every top-level function of the old `map.js` appears in
     the new modules with an identical body once `export` is stripped.
7. **Replace the classic `vm` unit-test harness** from PR 1 with plain imports.
8. **Load-time check**: measure cold and warm load before/after; add `<link rel="modulepreload">` for the
   entry graph if cold load regresses more than ~100 ms.
9. **Docs**: `CLAUDE.md` Key Files table, changelog, "Adding a Projection" unchanged.

## Risks

- **Import cycles** (`animation` ↔ `render`, `recenter` ↔ `sidebar`): resolve by moving the shared function down
  a layer, never by a lazy import trick. If a cycle remains after the split, that pair is merged instead.
- **Top-level side effects** in `map.js` (event listeners, DOM lookups at load) — each module exports
  `init()` and `main.js` calls them in the original order; the order is recorded in the PR description.
- **`this`/hoisting differences**: function declarations were hoisted across the whole file; in modules they
  are not. The check script flags any use-before-definition at load.

## Done when (whole PR)

Full gate green; `map.js` deleted; no module over ~350 lines; `check_split.py` reports zero diffs.
