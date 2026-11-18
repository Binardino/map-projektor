# Dymaxion facet globe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 300 ms crossfade between the round globe and the closed icosahedron with a real deformation: the sphere facets into the solid, then the existing turn + unfold plays unchanged (and the reverse on the way out).

**Architecture:** `core/polyhedral-unfold.js` gains pure facet maths (a triangle subdivision, and per-vertex sphere / solid positions that meet exactly at `frame(0, 0)`). `core/animation.js` draws the facets on a canvas mounted like the net group and runs `u` 0 → 1 before the net, 1 → 0 after it on the way back.

**Tech Stack:** vanilla ES modules, global `d3` (CDN), `node:test`, Playwright scripts.

**Spec:** `docs/design/specs/2026-11-18-dymaxion-facet-globe-design.md`

## Global Constraints

- Code, comments and docs in English; comments explain the *why*.
- No user-visible string is added (none needed). Layering: `core` imports nothing from `ui/` or `tools/`.
- Facets: n = 6 per face edge; `TIMING.polyhedralFacet` ≈ 700 ms, ease in-out; seam growth ≈ 0.6 px (reuse `NET_SEAM`).
- `TIMING.polyhedralFade` and the `crossfade` helper are removed once unused.
- Rest state and `animateNet` / `frame(turn, open)` behaviour must not change (`render_fingerprint --check`, `ui_text_snapshot --check` stay green).
- `tests/perf_baseline.json` is rewritten only for the two Dymaxion pairs, after a verified run.

## Review Focus

- Zoomed or panned camera when the route starts: the canvas must follow it (same viewport group), no offset.
- Clicking another projection mid-route: still ignored (`busy`), and no canvas is left behind after the route.
- A face seen edge-on or just behind the limb at `u ≈ 0`: no hairline gaps, no facet painted over a nearer one.
- Dark vs light theme: the painted map takes the colours on screen right now (as `paintMap` does).
- Reduced motion / the way back from Dymaxion to the globe itself (`toDef.globe`): ends on the true globe with no flash.

---

## Task 1: Facet subdivision (pure)

**Files:**
- Modify: `static/js/core/polyhedral-unfold.js`
- Test: `tests/js/polyhedral-unfold.test.mjs`

**Interfaces:**
- Produces: `export function subdivideTriangle(n: number): { vertices: [number, number, number][], triangles: [number, number, number][] }` — barycentric weights `[a, b, c]` (sum 1) for the (n+1)(n+2)/2 grid vertices, and n² triangles indexing them, all with the same winding as the parent.

- [ ] **Step 1: Write failing tests** — `subdivideTriangle(6)`: 28 vertices, 36 triangles; every weight triple sums to 1 and has no negative entry; the three corners `[1,0,0]`, `[0,1,0]`, `[0,0,1]` are present; total triangle area (in barycentric space, via the 2D cross product of two edges) equals the parent's; `subdivideTriangle(1)` is the parent triangle itself (3 vertices, 1 triangle).
- [ ] **Step 2: Run** `node --test 'tests/js/polyhedral-unfold.test.mjs'` → FAIL (`subdivideTriangle` not exported).
- [ ] **Step 3: Implement** `subdivideTriangle` in `polyhedral-unfold.js`: row `i` of the grid holds `n - i + 1` vertices with weights `[(n-i-j)/n, j/n, i/n]`; each cell gives an upward triangle and, but for the last in its row, a downward one, wound like the parent.
- [ ] **Step 4: Run** the same command → PASS.
- [ ] **Step 5: Commit** `feat(animation): subdivide a net face into facets`

## Task 2: Facet positions that meet the net at `u = 1`

**Files:**
- Modify: `static/js/core/polyhedral-unfold.js` (`buildNet`)
- Test: `scripts/e2e_smoke.py` (new check `facet_globe_matches_net`)

**Interfaces:**
- Consumes: `subdivideTriangle` (Task 1); `buildNet`'s existing `placements`, `onGlobe`, `fit`, `turnQuaternion`, `towardsIdentity`.
- Produces: `buildNet(map, globe)` additionally returns `facets: { face, texture: [x, y][], triangles: [i, j, k][] }[]` (one per face; `texture` is the finished map's pixel of each facet vertex, projected through its own face the way `onMap` does) and `facetFrame(u: number): { face, points: [x, y, z][], triangles }[]` — screen-space 3D vertices lerped from the sphere (`onGlobe` of the vertex's geographic point, taken as the normalised barycentric mix of the face's three corners) to the solid placed exactly as `frame(0, 0)` places it. `frame` is refactored so both share the same `view` matrix builder.

- [ ] **Step 1: Write the failing check** — in a page, for a fitted Dymaxion and globe: (a) for every face, `facetFrame(1)` vertices equal `frame(0, 0)`'s affine transform applied to the vertex's `texture` point (within 1e-6 px); (b) `facetFrame(0)` vertices lie on the globe: `hypot(x − tx, y − ty, z) ≈ globe.scale()`; (c) facet triangles total 24 × 36.
- [ ] **Step 2: Run** `scripts/e2e_smoke.py` check alone → FAIL (`facetFrame` undefined).
- [ ] **Step 3: Implement** in `buildNet`: extract the `view` computation of `frame` into an inner `viewAt(turn, open, placed)`; build `facets` once; implement `facetFrame(u)` with ease-free linear lerp (easing is applied by the caller). Drawing order is not this function's concern.
- [ ] **Step 4: Run** the check → PASS; run `node --test 'tests/js/*.test.mjs'` → still green.
- [ ] **Step 5: Commit** `feat(animation): facet positions from the sphere to the closed solid`

## Task 3: Canvas facet layer and the new sequence

**Files:**
- Modify: `static/js/core/animation.js` (`polyhedralTransition`, new `mountFacets`, `animateFacets`; delete `crossfade`), `static/js/config.js`

**Interfaces:**
- Consumes: `buildNet(...).facetFrame`, `paintMap(view, projection)`.
- Produces: `mountFacets(view, net, href): { group, show(u) }` — a `<foreignObject>` + `<canvas>` appended after `view.world` in the viewport group, `pointer-events: none`, sized to the view; `show(u)` clears and draws each facet whose projected triangle faces the viewer (cross product of two screen edges has the parent's sign) as the map image clipped to the triangle under the affine transform that maps its three `texture` points to its three screen points, clip grown by `NET_SEAM`. `animateFacets(layer, from, to, duration): Promise<void>` runs `show` over `d3.easeCubicInOut`. `TIMING.polyhedralFacet = 700` replaces `polyhedralFade`.

- [ ] **Step 1: Failing check** — extend `polyhedral_route` in `scripts/e2e_smoke.py`: after clicking Dymaxion, wait for `.polyhedral-facets canvas` (class on the foreignObject group); then wait for `.polyhedral-net g`; at the end assert both are gone and `g.world` opacity is `""`; same assertions on the way back (Dymaxion → Mercator, and Dymaxion → orthographic, the `toDef.globe` case). A second click mid-route is still ignored.
- [ ] **Step 2: Run** `scripts/e2e_smoke.py` → FAIL (no canvas ever appears).
- [ ] **Step 3: Implement** the layer and rewire `polyhedralTransition`: towards Dymaxion → true globe → `mountFacets` at `u = 0` hides `view.world` (opacity 0) → `animateFacets(0 → 1)` → mount the net at `show(0, 0)`, remove the facet group → `animateNet(0 → 1)` → draw the real map, clean up as today. Away: mirror it, ending with the true globe drawn before the facet group is removed. Remove `crossfade` and `polyhedralFade` (grep shows no other user). If a seam or jump is visible at the `u = 0` swap, add a 100 ms opacity crossfade at that point only (spec, assumption 2).
- [ ] **Step 4: Run** `scripts/e2e_smoke.py` → PASS.
- [ ] **Step 5: Look at it** — a throwaway script (not committed, in `/tmp`) captures frames at `u` = 0, 0.25, 0.5, 0.75, 1 on the way in and out, light and dark theme, and with a zoomed camera; read them and fix what looks wrong before moving on.
- [ ] **Step 6: Commit** `feat(animation): the globe facets into the icosahedron instead of fading`

## Task 4: Perf baseline, docs, full check

**Files:**
- Modify: `tests/perf_baseline.json` (the two Dymaxion pairs only), `CHANGELOG.md`, `CLAUDE.md` (POLYHEDRAL ROUTE mention), `README.md` only if its Dymaxion sentence is now wrong

- [ ] **Step 1: Run** `scripts/perf_transitions.py`; expect the two Dymaxion pairs to differ (longer route). Judge them on dropped frames, not just duration.
- [ ] **Step 2: Rewrite** their baseline with `--write-baseline` once the numbers are acceptable; check the diff touches only those two keys.
- [ ] **Step 3: Docs** — changelog entry (dated 2026-11-18, branch name), CLAUDE.md sentence on the facet stage, in English.
- [ ] **Step 4: Run** `scripts/check_all.sh` → `ALL CHECKS PASSED`.
- [ ] **Step 5: Commit** `docs: changelog and notes for the faceted globe`, then `chore(perf): new Dymaxion numbers with the facet stage`.

## Self-review

- Spec coverage: facets (T1–2), canvas + sequence both ways + `polyhedralFade` removal (T3), swap-point fallback (T3 step 3), tests/captures/perf/docs (T3–4). Assumption 1 (all triangles) is already checked: 24 of 24 faces have 3 corners.
- Names consistent: `subdivideTriangle`, `facetFrame`, `mountFacets`, `animateFacets`, `TIMING.polyhedralFacet`.
- Not covered by the plan, deliberately: Safari (spec marks it unverified).
