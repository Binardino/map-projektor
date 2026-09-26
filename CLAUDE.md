# Map Projektor Universal Converter — CLAUDE.md

## Project Summary

Interactive world map web app displaying 17 cartographic projections with animated transitions. Built as a FastAPI learning project.

**Stack:** FastAPI + uvicorn + Jinja2 (Python server) · D3.js + d3-geo-projection v4 (frontend) · shapely + requests (data pipeline)

**Run:** `poetry run uvicorn app.main:app --reload` → http://localhost:8000

**Generate data (once):** `poetry run python scripts/fetch_geodata.py`

**Tests:** `poetry run pytest -v`

**Perf regression check (transitions):** `poetry run python scripts/perf_transitions.py` — drives every projection switch and recenter preset in headless Chromium and compares frame-drop/avg-frame-time against `tests/perf_baseline.json`. Re-run with `--write-baseline` after a deliberate, verified perf improvement to update the reference numbers. Requires `poetry run playwright install chromium` once (not run automatically, not part of `pytest`).

**Refactor safety net** (Playwright scripts, same Chromium requirement, not part of `pytest`):
- `poetry run python scripts/ui_text_snapshot.py --check` — every user-visible string in 9 UI states vs `tests/ui_text_snapshot.json`
- `poetry run python scripts/render_fingerprint.py --check` — hashes of the drawn paths for 17 projections × 2 views, plus 5 projected control points, vs `tests/render_fingerprint.json`
- `poetry run python scripts/e2e_smoke.py` — walks the main user paths, fails on any page error or missing i18n key (~30 s)
- `node --test 'tests/js/*.test.mjs'` — JS unit tests (Node's built-in runner, no npm). Keep the quoted glob: Node 24 does not accept `node --test tests/js/`

The golden files take `--write` after a deliberate change. **Before a PR:** `scripts/check_all.sh` runs pytest, the JS tests, the three scripts above and the perf harness, stopping at the first failure.

---

## Key Files

| File | Role |
|---|---|
| `app/main.py` | FastAPI: 3 routes (index, GeoJSON, static) |
| `app/data/world.geojson` | Simplified Natural Earth data (gitignored, generated) |
| `static/js/map.js` | PROJECTIONS registry + D3 rendering + animation |
| `static/css/style.css` | CSS variables (theme) + layout |
| `templates/index.html` | HTML structure: sidebar + SVG |
| `scripts/fetch_geodata.py` | One-shot data fetch + Douglas-Peucker simplification |
| `scripts/check_all.sh` | Runs every check below in order, stops at the first failure |
| `scripts/perf_transitions.py`, `ui_text_snapshot.py`, `render_fingerprint.py`, `e2e_smoke.py` | Playwright checks; read app state through the read-only `window.__app` hook in `map.js` |
| `tests/*.py` | pytest: FastAPI routes, i18n key coverage |
| `tests/*.json` | Golden files and perf baseline for the scripts above |
| `tests/js/` | node:test unit tests; `harness.mjs` loads `map.js`/`i18n.js` functions in a `vm` context |

---

## Adding a Projection

Add one object to the `PROJECTIONS` array in `static/js/map.js`, plus its texts in `static/i18n/en.json`. Nothing else changes.

```js
{
  id: "myProjection",
  family: "Family Name",   // grouping identifier, label comes from family.<lowercase> in en.json
  year: 1900,
  description: "What it does and why it matters.",
  d3fn: () => d3.geoMyProjection(), // from d3-geo-projection if not in D3 core
}
```

```json
"projection.myProjection.name": "My Projection",
"projection.myProjection.preserves": "...",
"projection.myProjection.distorts": "...",
"projection.myProjection.bestFor": "..."
```

`tests/test_i18n.py` fails if a projection or view is missing any of its keys.

**Texts:** no user-visible string is written in `map.js` or `index.html` — they live in `static/i18n/<lang>.json` (English is the source) and are read through `t("key")` in JS or `data-i18n` attributes in the markup (see `static/js/i18n.js`).

Projections requiring `d3-geo-projection` (CDN loaded in index.html): Robinson, Mollweide, Sinusoidal, Winkel Tripel, Aitoff, Hammer, Gall-Peters, Eckert IV.

Transitions morph a blended projection frame by frame, reprojecting a thinned copy of the geometry (`buildLightGeometry`) for speed; the active recenter view carries over between projections; pairs involving a polar view route through the orthographic globe (fold → spin → unfold) — see the POLAR ROUTE section in `static/js/map.js`.

---

## Changing the Theme

Edit only the `:root` block in `static/css/style.css`. All colors are CSS variables — one change propagates everywhere.

---

## Coding Rules

- All code and documentation in **English**
- Comments must explain the *why*, never the *what*
- No features beyond what was asked; no speculative abstractions
- User is learning FastAPI/Python — explain before writing

---

## Design Spec & Implementation Plan

- Spec: `docs/superpowers/specs/2026-06-07-map-projektor-design.md`
- Plan: `docs/superpowers/plans/2026-06-07-map-projektor.md`
