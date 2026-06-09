# Map Projektor Universal Converter — CLAUDE.md

## Project Summary

Interactive world map web app displaying 13 cartographic projections with animated transitions. Built as a FastAPI learning project.

**Stack:** FastAPI + uvicorn + Jinja2 (Python server) · D3.js + d3-geo-projection v4 (frontend) · shapely + requests (data pipeline)

**Run:** `poetry run uvicorn app.main:app --reload` → http://localhost:8000

**Generate data (once):** `poetry run python scripts/fetch_geodata.py`

**Tests:** `poetry run pytest -v`

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

---

## Adding a Projection

Add one object to the `PROJECTIONS` array in `static/js/map.js`. Nothing else changes.

```js
{
  id: "myProjection",
  name: "My Projection",
  family: "Family Name",
  year: 1900,
  description: "What it does and why it matters.",
  d3fn: () => d3.geoMyProjection(), // from d3-geo-projection if not in D3 core
}
```

Projections requiring `d3-geo-projection` (CDN loaded in index.html): Robinson, Mollweide, Sinusoidal, Winkel Tripel, Aitoff, Hammer, Gall-Peters.

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
