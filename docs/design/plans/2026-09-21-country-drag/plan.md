# Feature 32 — Plan (subtasks, checks, risks)

Design and open decisions: [README.md](README.md). Branch: `feature/country-drag`, split into two PRs.
Estimate: PR A ~1.5 days, PR B ~3 days. Gate before each PR: the checks listed in the modularization plan's
index (pytest, node tests, text snapshot, render fingerprint, e2e smoke, perf harness).

## PR A — foundations (independent of the modularization, can start any time)

1. **Inverse-projection audit.** Playwright script: for each of the 17 projections (Europe- and China-centred),
   take a 40×20 grid of screen points inside the sphere outline, check `project(invert(p)) ≈ p` (< 0.5 px) and
   that `invert` never returns `null`/`NaN` inside the outline.
   - Done when: a table lists pass/fail per projection. Failing ones get a fallback decision: a numeric inverse
     (nearest grid point + Newton refinement) or "drag unavailable, tooltip explains why".
2. **`static/js/core/sphere-move.js`** — pure maths, no D3, no DOM:
   `lonLatToVec`, `vecToLonLat`, `rotationBetween(a, b)` (axis–angle, handles a = b and a = −b),
   `moveRing(ring, fromCentroid, toTarget, { upright })`, `moveFeature(feature, …)` for Polygon/MultiPolygon.
   - Tests (`tests/js/sphere-move.test.js`, Node's runner):
     - centroid lands on the target within 1e-9°; identity when target = home;
     - **isometry**: pairwise great-circle distances between 50 random vertices unchanged (this is "true size");
     - moving across the antimeridian and over a pole gives finite coordinates and a closed ring;
     - `upright`: after the move, the bearing from centroid to the original north-most vertex is unchanged
       relative to local north (tolerance 0.5°); without it, the bearing drifts on a long move.
   - Done when: tests pass and breaking the rotation formula makes them fail.
3. **Visual spike (scratch page, not committed)**: drag Africa, Russia, Chile and Greenland along a meridian
   and along a parallel with `upright` on/off, under Mercator, Robinson and Orthographic.
   - Done when: D3 (orientation) is decided with screenshots, recorded in the README.
4. **Per-move cost measurement**: time `moveFeature` + `geoPath` for Russia, Canada, Antarctica with full and
   light geometry over 200 moves. Budget: < 4 ms per move at the 95th percentile.
   - Done when: numbers are in the README; if over budget, the drag uses the light geometry while moving and the
     full geometry on release.

## PR B — the feature (after modularization PR 2, better after PR 5)

5. **Pointer → geographic pipeline** (`core/pointer-geo.js`): `event → screen point → undo camera zoom transform →
   undo the upside-down CSS flip → projection.invert (same recentred projection as the map)`.
   - Done when: an e2e test drags a country by a known pixel offset in five setups — default, zoomed 3×, panned,
     China-centred, upside-down — and the overlay's centroid ends within 3 px of the cursor each time.
   - Risk: whether `getScreenCTM` includes the CSS flip; the test decides, otherwise the flip is applied by hand.
6. **Overlay + ghost + drag (gesture a).** New `country-drag` tool: ghost outline of the selected country at home,
   overlay `<path>` in the view's highlight layer, `d3.drag` on it. Orthographic: dragging over the country moves
   it, elsewhere still rotates the globe (`globeDrag`); the target is clamped at the horizon.
   - Done when: e2e — dragging from the country moves it; dragging from empty ocean still pans; wheel zoom works
     with the pointer over the country; `zoom.filter` untouched.
7. **Hit area for small countries**: invisible ~14 px non-scaling stroke on the overlay, hover halo, `grab` /
   `grabbing` cursors. Done when: Luxembourg and Singapore can be grabbed at the default zoom (e2e).
8. **Compare card rework** (D1): remove the second-projection dropdown, add "Back to place" and the "Move
   country" switch (gesture c: while ON, a drag anywhere moves the country and pan is suspended, wheel still zooms).
   Selecting a country in this mode does **not** auto-zoom (Feature 21's click-zoom stays for the closed card).
   - Every new string goes through `t()` / `data-i18n` with keys in `en.json` (`compare.moveCountry`,
     `compare.backToPlace`, …); `tests/test_i18n.py` and the text snapshot are updated in the same commit.
   - Done when: e2e covers select → drag → back to place → close card (overlay and ghost removed).
9. **Persistence and edge cases**: keep the target `[lon, lat]` across projection and view changes (re-project,
   overlay fades out during a morph and back in); clamp latitude to ±85° on Mercator; `Esc` resets;
   the tool listens to `projection:changed` / `transition:end` events (modularization PR 4).
   - Done when: e2e — displace a country, switch Mercator → Robinson → globe → China view, position stays.
10. **Touch**: one finger on the country moves it, elsewhere pans, two fingers pan/zoom; small-country grabbing
    on a 390 px viewport works via gesture (c). Done when: Playwright touch emulation passes both cases.
11. **Stretch — area readout** (D4): "appears N× larger than at home" from projected `geoPath.area` ratio, shown in
    the card and formatted with the active locale. Done when: dragging Africa from the equator to 60°N on Mercator
    reports a ratio matching the analytic value 1/cos²φ within 5 %.
12. **Regression and perf**: displaced country during a projection morph must not break the perf harness (< 1.15×
    of baseline); run the whole gate; `CLAUDE.md` and changelog. Decide what happens to the unreachable True Size
    tool: its multi-country list can be rebuilt on this base (D2) — left for a follow-up.

## Risks

| Risk | Handling |
|------|----------|
| Some projections lack a usable `invert` | Subtask 1 finds them early; numeric inverse or disabled with a tooltip |
| Country crossing the antimeridian or a pole draws a fill covering the sphere | Subtask 2 tests + a d3-geo winding check in e2e on Russia / Fiji / Antarctica |
| Drag/pan/globe-rotate conflicts on the orthographic view | Handled in subtask 6; explicit e2e case |
| Feels wrong on touch | Subtask 10 with real gesture emulation, then a manual pass on a phone |
| Scope creep toward a full True Size clone | D2 (one country in v1); multi-country is a separate PR |

## Order relative to other work

Modularization PR 1–5 first (or at least PR 2 and the pure-maths PR A, which does not depend on it), then PR B.
Language picker and this feature are independent; new strings here follow the i18n rules from day one.
