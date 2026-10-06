# PR 1 — Safety net (item 8)

Purpose: give every later PR the same objective yardstick. No production behaviour changes.
Branch: `test/refactor-safety-net`. Size: medium, ~1–2 days.

## Subtasks

1. **`window.__app` debug hook in `map.js`** (classic script, before the split)
   - Exposes read access: `PROJECTIONS`, `RECENTER_PRESETS`, getters for `currentProjectionId`,
     `currentRecenterRotate`, `currentRecenterFlip`, `isAnimating`, plus `mapGroup`/`terrainGroup`
     for the perf harness. Read-only getters, no setters.
   - Done when: `page.evaluate(() => __app.PROJECTIONS.length)` returns 17.
2. **Point the perf harness at `__app`** (`scripts/perf_transitions.py` uses `PROJECTIONS`,
   `currentProjectionId`, `RECENTER_PRESETS` bare globals today).
   - Done when: harness output is unchanged and it still passes.
3. **Commit the UI text snapshot tool** — promote the throw-away script used for the i18n extraction to
   `scripts/ui_text_snapshot.py` with a golden `tests/ui_text_snapshot.json`; `--check` diffs, `--write` updates.
   - Captures text nodes, `aria-label`, `title`, `placeholder`, `data-tooltip`, document title, in the states:
     launch (modal open), info card, compare card + country search, each of 3 projections, all 17 sidebar
     labels, 5 view labels, compare-select options. Whitespace-normalised.
   - Done when: `--check` passes on `main`, and fails after editing one string in `en.json`.
4. **Render fingerprint** — `scripts/render_fingerprint.py` (Playwright) proves the *drawing* is unchanged, which
   texts and behaviour checks cannot: for each of the 17 projections × 2 views (Europe-centered, China-centered),
   switch, wait for the transition to settle, then hash the `d` attributes of all country and terrain paths
   in document order (SHA-256, deterministic — no timing involved). Golden file `tests/render_fingerprint.json`,
   `--check` / `--write` like the text snapshot.
   - Also records `makeProjection(def)([lon, lat])` for 5 fixed points per projection (numeric, 6 decimals), so a
     change to `fitProjection` is visible even when it happens not to alter a hash.
   - Done when: `--check` passes twice in a row on `main` (proves determinism), and changing `POLE_LIMIT` or a
     projection scale makes it fail.
5. **Commit an end-to-end smoke test** — `scripts/e2e_smoke.py` (Playwright, same pattern as the perf harness),
   fails on any `pageerror` or `[i18n] missing key` console message. Scenarios:
   - welcome modal opens on every launch; closes via ✕, Esc, backdrop
   - projection switch keeps the active view (China, upside-down) — asserts China's centre x stays within 3 px
     across the morph; Albers and polar views ease back to Europe first
   - Africa-centered view shifts Nigeria left of its Europe-centered x
   - polar route (fold → spin → unfold) ends on the polar view; recenter flip ends with the mirror transform
   - camera: wheel zoom, drag pan, reset button returns to identity; globe drag rotates on orthographic only
   - distortion-grid toggle draws/clears Tissot paths; info card and compare card open/close, only one at a time
   - mobile viewport 390 px: sidebar drawer opens and closes
   - Done when: all scenarios pass on `main` in < 90 s.
6. **JS unit tests with Node's built-in runner** (`node --test tests/js/`, Node 24 here, zero npm dependencies)
   - Only pure logic that can load without a DOM: `t()` (missing key, `{var}` interpolation),
     `thinRing`/`thinPolygon`/`buildLightGeometry` (sub-degree island dropped, country made only of specks keeps
     one polygon, ring closure preserved, WeakMap twin lookup falls back to original).
   - Needs the functions importable: for the classic script, tests load them via a tiny `vm` harness that
     evaluates the relevant function source; after PR 2 they become plain imports (the harness is then deleted).
   - Done when: `node --test tests/js/` passes and a deliberately broken `thinRing` makes it fail.
7. **Wire the gate**: `scripts/check_all.sh` runs the six checks (pytest, node tests, text snapshot, render fingerprint, e2e smoke, perf harness) in order and stops at the first failure;
   documented in `CLAUDE.md`.
   - Done when: one command gives a green/red verdict.
8. **Docs + changelog.**

## Verification / rollback

- Each new check must be shown failing once (mutation) before it is trusted — same rule used for `test_i18n.py`.
- Rollback: revert the PR; nothing else depends on it yet.

## Open points

- Should `e2e_smoke.py` join `pytest` (marked `e2e`, skipped by default)? Proposal: no — it drives a real
  browser like the perf harness, so it stays a deliberately-run script (project convention).
