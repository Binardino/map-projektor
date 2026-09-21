# Modularization plan — index

Goal: make the frontend modular and future-proof so that (1) adding a projection stays "one object",
(2) adding a language / tool / view does not touch the core, (3) every layer is testable.
Decided with the user on 2026-09-21. Nothing here changes what the user sees.

## Starting point (measured 2026-09-21)

- `static/js/map.js`: 1 911 lines, 93 top-level constants/variables, 66 functions, one classic script.
- ~450 lines unreachable from the UI (Figma redesign removed their buttons): side-by-side compare
  (~160 lines), flight path (~130), true size (~170). Kept on purpose — the user will decide later.
- Projection-specific behaviour is hard-wired by id: `"orthographic"` in 5 places, `"mercator"` in
  `fitProjection`, plus `POLAR_ROTATION`, `RECENTER_INCOMPATIBLE`, `clipAngleOf`.
- `PROJECTIONS.find((p) => p.id === …)` repeated 20 times; animation durations (200 … 1400 ms) inline.
- Global mutable state (`currentProjectionId`, `isAnimating`, `currentRecenterRotate`, …) written from
  everywhere; UI builders (`buildSidebar`, `buildRecenterPanel`) append instead of replace, so they
  cannot re-run (blocks live language switching).
- Tests: pytest (backend + i18n keys) and the perf harness. No JS unit tests, no committed UI regression.

## Order of work — one PR each, atomic commits inside (see `feedback_atomic_commits`)

| # | PR | Covers | Depends on |
|---|----|--------|------------|
| 0 | Merge PR #28 (i18n extraction) | prerequisite: it edits `map.js` | — |
| 1 | [Safety net](pr1-safety-net.md) | item 8 tests, `__app` debug hook | 0 |
| 2 | [ES-module split](pr2-module-split.md) | items 2 + 1 (tools isolated) | 1 |
| 3 | [Registry, config, tokens](pr3-registry-config.md) | items 3, 4, 7 | 2 |
| 4 | [State + events](pr4-state-events.md) | item 5, idempotent UI builders | 3 |
| 5 | [MapView abstraction](pr5-map-view.md) | item 6 | 4 |
| — | Language picker (backlog Feature 31, subtask 2) | consumes PR 4 | 4 |
| — | Perf harness warm-up run | independent, small | any |

Why this order: the safety net comes first so every later step is checked against the same yardstick;
the mechanical split comes before any logic change so a bug is either "a moved line" or "a changed line",
never both; config/registry before state because it shrinks what state has to carry.

## Rules for every PR

1. Branch from an up-to-date `main`; one topic per branch (`feedback_git_workflow`).
2. Gate before opening the PR — all must be green:
   - `poetry run pytest -q`
   - `node --test tests/js/` (from PR 1 on)
   - `poetry run python scripts/ui_text_snapshot.py --check` — visible texts identical (from PR 1 on)
   - `poetry run python scripts/render_fingerprint.py --check` — drawn shapes identical (from PR 1 on)
   - `poetry run python scripts/e2e_smoke.py` — behaviour walkthrough, zero console errors/warnings (PR 1 on)
   - `poetry run python scripts/perf_transitions.py` — no regression vs `tests/perf_baseline.json`
3. No behaviour change unless the PR says so. If a bug is found on the way, fix it in its own commit.
4. Update `CHANGELOG.md` and `CLAUDE.md` (Key Files table, "Adding a Projection") in the same PR.
5. Comments explain the *why* (project rule). PR bodies carry no AI-attribution trailer (user rule).

## Risks that span several PRs

| Risk | Mitigation |
|------|------------|
| Circular imports once the file is split | Layering rule (below) + events instead of direct calls (PR 4) |
| ~25 small module requests slow the first load | `<link rel="modulepreload">` for the entry graph; measure in PR 2; a bundler stays out of scope |
| Harness/scripts read globals (`PROJECTIONS`, `currentProjectionId`) | PR 1 switches them to `window.__app` *before* the split |
| Behaviour drift during the move | PR 2 is checked by a script proving each old function body reappears verbatim |
| Language work collides with the refactor | Language picker starts only after PR 4 |

## Layering rule (enforced by a test from PR 2 on)

```
config, data/*        → import nothing from the app
core/*                → may import config, data, other core
ui/*, tools/*         → may import config, data, core, state
main.js, debug.js     → may import anything
core never imports ui/ or tools/ — it emits events; ui/tools subscribe (PR 4).
Until PR 4 one exception is allowed and tracked in the test: core → tools/index.js (direct calls).
```
