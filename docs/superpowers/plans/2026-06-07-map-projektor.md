# Map Projektor Universal Converter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interactive world map web app displaying 12 cartographic projections with animated transitions between them.

**Architecture:** FastAPI serves a Jinja2 HTML page and a pre-processed GeoJSON file. All map rendering, projection math, and animation logic run in the browser via D3.js and flubber.js. A one-shot Python script fetches and simplifies Natural Earth data into a compact GeoJSON file stored locally.

**Tech Stack:** FastAPI, uvicorn, Jinja2, Python 3.10+, requests, shapely, pytest, httpx, D3.js v7, d3-geo-projection v4, flubber.js 0.4.2

---

## File Map

| File | Responsibility |
|---|---|
| `app/main.py` | FastAPI app: 3 routes (index, GeoJSON, static files) |
| `app/data/world.geojson` | Simplified world data (generated, gitignored) |
| `templates/index.html` | HTML structure: sidebar + SVG container |
| `static/css/style.css` | CSS variables (theme) + full layout |
| `static/js/map.js` | PROJECTIONS registry, D3 rendering, animation |
| `scripts/fetch_geodata.py` | One-shot: fetch + simplify Natural Earth GeoJSON |
| `tests/test_main.py` | FastAPI route tests |
| `pyproject.toml` | Runtime + dev dependencies |

---

## Task 1: Project Setup — Dependencies and Directory Structure

**Files:**
- Modify: `pyproject.toml`
- Create: `app/__init__.py`
- Create: `app/data/.gitkeep`
- Create: `static/css/style.css` (empty)
- Create: `static/js/map.js` (empty)
- Create: `templates/index.html` (empty)
- Create: `tests/__init__.py`
- Create: `tests/test_main.py` (empty)

- [ ] **Step 1: Update pyproject.toml**

Replace the `dependencies` section and add dev + pytest config:

```toml
[project]
name = "map-projektor-universal-converter"
version = "0.1.0"
description = "Interactive world map with animated projection transitions"
authors = [
    {name = "Binardino", email = "46687351+Binardino@users.noreply.github.com"}
]
requires-python = ">=3.10"
dependencies = [
    "fastapi>=0.110.0",
    "uvicorn[standard]>=0.29.0",
    "jinja2>=3.1.0",
    "requests>=2.31.0",
    "shapely>=2.0.0",
]

[build-system]
requires = ["poetry-core>=2.0.0,<3.0.0"]
build-backend = "poetry.core.masonry.api"

[tool.pytest.ini_options]
testpaths = ["tests"]

[tool.poetry.group.dev.dependencies]
pytest = ">=8.0.0"
httpx = ">=0.27.0"
```

- [ ] **Step 2: Install dependencies**

```bash
poetry install
```

Expected: all packages resolve and install without errors.

- [ ] **Step 3: Create directory structure**

```bash
mkdir -p app/data static/css static/js templates tests scripts
touch app/__init__.py app/data/.gitkeep tests/__init__.py
touch static/css/style.css static/js/map.js templates/index.html
```

- [ ] **Step 4: Verify structure**

```bash
find . -not -path './.venv/*' -not -path './.git/*' -not -path './.superpowers/*' -type f | sort
```

Expected to include:
```
./app/__init__.py
./app/data/.gitkeep
./static/css/style.css
./static/js/map.js
./templates/index.html
./tests/__init__.py
./pyproject.toml
```

- [ ] **Step 5: Commit**

```bash
git add pyproject.toml app/ static/ templates/ tests/ scripts/
git commit -m "chore: project structure and dependencies"
```

---

## Task 2: Minimal FastAPI Server

**Files:**
- Create: `app/main.py`
- Modify: `templates/index.html`
- Create: `tests/test_main.py`

- [ ] **Step 1: Write the failing tests**

`tests/test_main.py`:

```python
"""Tests for FastAPI route availability."""

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_index_returns_200():
    """Root route must serve the HTML page."""
    response = client.get("/")
    assert response.status_code == 200


def test_index_returns_html():
    """Root route must return HTML content type."""
    response = client.get("/")
    assert "text/html" in response.headers["content-type"]


def test_static_css_served():
    """CSS static file must be accessible."""
    response = client.get("/static/css/style.css")
    assert response.status_code == 200


def test_static_js_served():
    """JS static file must be accessible."""
    response = client.get("/static/js/map.js")
    assert response.status_code == 200
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
poetry run pytest tests/test_main.py -v
```

Expected: `ImportError` — `app.main` does not exist yet.

- [ ] **Step 3: Write `app/main.py`**

```python
"""
Map Projektor Universal Converter — FastAPI application.

Routes:
  GET /                    — serves the main HTML page
  GET /data/world.geojson  — serves the pre-processed world GeoJSON
  /static/*                — serves CSS, JS, and other static assets
"""

import pathlib

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

# Resolve paths relative to this file so the app works from any working directory
BASE_DIR = pathlib.Path(__file__).parent
ROOT_DIR = BASE_DIR.parent

app = FastAPI(title="Map Projektor Universal Converter")

# Mount the static directory to serve CSS and JS files at /static/*
app.mount("/static", StaticFiles(directory=ROOT_DIR / "static"), name="static")

templates = Jinja2Templates(directory=ROOT_DIR / "templates")


@app.get("/")
async def index(request: Request):
    """Serve the main application page."""
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/data/world.geojson")
async def world_geojson():
    """
    Serve the pre-processed world GeoJSON file.

    This file is generated once by scripts/fetch_geodata.py.
    It contains simplified country geometries with NAME and CONTINENT properties.
    """
    geojson_path = BASE_DIR / "data" / "world.geojson"
    return FileResponse(geojson_path, media_type="application/json")
```

- [ ] **Step 4: Write minimal `templates/index.html`** (enough to pass tests)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Map Projektor</title>
  <link rel="stylesheet" href="/static/css/style.css" />
</head>
<body>
  <p>Map Projektor — coming soon</p>
  <script src="/static/js/map.js"></script>
</body>
</html>
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
poetry run pytest tests/test_main.py -v
```

Expected: 4 PASS.

- [ ] **Step 6: Verify the server starts and serves the page**

```bash
poetry run uvicorn app.main:app --reload
```

Open http://localhost:8000 — you should see "Map Projektor — coming soon".
Stop with Ctrl+C.

- [ ] **Step 7: Commit**

```bash
git add app/main.py templates/index.html tests/test_main.py
git commit -m "feat: minimal FastAPI server with index, GeoJSON, and static routes"
```

---

## Task 3: Data Pipeline — fetch_geodata.py

**Files:**
- Create: `scripts/fetch_geodata.py`
- Modify: `tests/test_main.py` (add GeoJSON endpoint tests)

- [ ] **Step 1: Add GeoJSON endpoint tests to `tests/test_main.py`**

Append to the file:

```python
import json
import pathlib
import pytest


def test_geojson_endpoint_returns_200():
    """GeoJSON endpoint must return 200 once data file has been generated."""
    geojson_path = pathlib.Path("app/data/world.geojson")
    if not geojson_path.exists():
        pytest.skip("world.geojson not yet generated — run scripts/fetch_geodata.py first")
    response = client.get("/data/world.geojson")
    assert response.status_code == 200


def test_geojson_is_valid_feature_collection():
    """Generated GeoJSON must be a FeatureCollection with name and continent properties."""
    geojson_path = pathlib.Path("app/data/world.geojson")
    if not geojson_path.exists():
        pytest.skip("world.geojson not yet generated — run scripts/fetch_geodata.py first")
    data = json.loads(geojson_path.read_text())
    assert data["type"] == "FeatureCollection"
    assert len(data["features"]) > 100  # Natural Earth 110m has ~177 countries
    first = data["features"][0]
    assert "name" in first["properties"]
    assert "continent" in first["properties"]
```

- [ ] **Step 2: Run tests — GeoJSON tests should be skipped**

```bash
poetry run pytest tests/test_main.py -v
```

Expected: 4 PASS, 2 SKIP.

- [ ] **Step 3: Write `scripts/fetch_geodata.py`**

```python
"""
One-shot data preparation script for Map Projektor.

Fetches Natural Earth 110m country boundaries from GitHub, simplifies
geometries with the Douglas-Peucker algorithm (via Shapely), truncates
coordinate precision to 4 decimal places, and saves the result to
app/data/world.geojson.

Usage:
    python scripts/fetch_geodata.py

Output:
    app/data/world.geojson  — compact GeoJSON (~80–120 KB, gitignored)
"""

import json
import pathlib

import requests
from shapely.geometry import mapping, shape

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SOURCE_URL = (
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/"
    "master/geojson/ne_110m_admin_0_countries.geojson"
)

OUTPUT_PATH = pathlib.Path(__file__).parent.parent / "app" / "data" / "world.geojson"

# Douglas-Peucker tolerance in degrees (~55 km at the equator).
# Higher value = fewer points = smaller file, but coarser outlines.
SIMPLIFY_TOLERANCE = 0.5

# Decimal places for coordinates. 4 = ~11m precision, sufficient for web maps.
COORDINATE_PRECISION = 4


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def round_coordinates(geometry: dict, precision: int) -> dict:
    """
    Recursively round all coordinate values in a GeoJSON geometry dict.

    Works for any geometry type (Point, Polygon, MultiPolygon, etc.)
    because GeoJSON coordinates are always nested lists of numbers.
    """

    def _round(value):
        if isinstance(value, (int, float)):
            return round(value, precision)
        return [_round(v) for v in value]

    result = dict(geometry)
    result["coordinates"] = _round(geometry["coordinates"])
    return result


def simplify_feature(feature: dict, tolerance: float) -> dict | None:
    """
    Simplify a single GeoJSON feature geometry with Douglas-Peucker via Shapely.

    Returns a cleaned feature retaining only NAME and CONTINENT properties,
    or None if the geometry becomes empty after simplification (e.g. tiny islands).
    """
    try:
        geom = shape(feature["geometry"])
        simplified = geom.simplify(tolerance, preserve_topology=True)

        if simplified.is_empty:
            name = feature["properties"].get("NAME", "?")
            print(f"  Skipped (empty after simplification): {name}")
            return None

        return {
            "type": "Feature",
            "properties": {
                "name": feature["properties"].get("NAME", "Unknown"),
                "continent": feature["properties"].get("CONTINENT", "Unknown"),
            },
            "geometry": round_coordinates(mapping(simplified), COORDINATE_PRECISION),
        }

    except Exception as exc:
        name = feature["properties"].get("NAME", "?")
        print(f"  Warning — could not process {name}: {exc}")
        return None


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> None:
    print(f"Fetching Natural Earth 110m countries…\n  {SOURCE_URL}")
    response = requests.get(SOURCE_URL, timeout=30)
    response.raise_for_status()
    raw = response.json()
    total = len(raw["features"])
    print(f"  → {total} features downloaded")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    simplified_features = []
    for feature in raw["features"]:
        result = simplify_feature(feature, SIMPLIFY_TOLERANCE)
        if result:
            simplified_features.append(result)

    output = {
        "type": "FeatureCollection",
        "features": simplified_features,
    }

    # Compact JSON (no extra whitespace) to minimise file size
    OUTPUT_PATH.write_text(json.dumps(output, separators=(",", ":")))

    kept = len(simplified_features)
    size_kb = OUTPUT_PATH.stat().st_size / 1024
    print(f"  → {kept}/{total} features saved to {OUTPUT_PATH}")
    print(f"  → File size: {size_kb:.1f} KB")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run the script**

```bash
poetry run python scripts/fetch_geodata.py
```

Expected output:
```
Fetching Natural Earth 110m countries…
  → 177 features downloaded
  → 177/177 features saved to app/data/world.geojson
  → File size: ~90.0 KB
```

- [ ] **Step 5: Run tests — GeoJSON tests should now pass**

```bash
poetry run pytest tests/test_main.py -v
```

Expected: 6 PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/fetch_geodata.py tests/test_main.py
git commit -m "feat: one-shot GeoJSON data pipeline with Douglas-Peucker simplification"
```

---

## Task 4: D3 World Map with Mercator Default + Dynamic Sidebar

Replaces the placeholder HTML with the full page structure. Renders the world map in Mercator projection and builds the sidebar dynamically from the PROJECTIONS array.

**Files:**
- Modify: `templates/index.html`
- Modify: `static/css/style.css`
- Modify: `static/js/map.js`

- [ ] **Step 1: Write `templates/index.html`** (full structure)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Map Projektor</title>
  <link rel="stylesheet" href="/static/css/style.css" />
</head>
<body>
  <div id="app">

    <!-- ── Left Sidebar ─────────────────────────────────────── -->
    <aside id="sidebar">
      <div id="sidebar-header">
        <h1>Map<br/>Projektor</h1>
        <p class="tagline">Universal Converter</p>
      </div>
      <nav id="projection-list">
        <!-- Populated dynamically by map.js from the PROJECTIONS array -->
      </nav>
    </aside>

    <!-- ── Main Area ─────────────────────────────────────────── -->
    <main id="main">
      <div id="map-container">
        <svg id="map-svg"></svg>
      </div>
      <div id="projection-info">
        <span id="info-name"></span>
        <span id="info-family"></span>
        <p id="info-description"></p>
      </div>
    </main>

  </div>

  <!-- Libraries loaded from CDN — order matters -->
  <script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/d3-geo-projection@4/dist/d3-geo-projection.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/flubber@0.4.2/build/flubber.min.js"></script>

  <!-- Application logic -->
  <script src="/static/js/map.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `static/css/style.css`** (CSS variables + full layout)

```css
/* ============================================================
   CSS VARIABLES — Theme: Vintage Colorful
   To switch themes, edit only this :root block.
   ============================================================ */
:root {
  /* Backgrounds */
  --bg-app:     #f2ead8;   /* light parchment — page background */
  --bg-sidebar: #e8dfc8;   /* slightly darker parchment — sidebar */
  --bg-ocean:   #c8d8e0;   /* soft muted blue — ocean fill */

  /* Continent fill colors (used in JS via getComputedStyle) */
  --color-africa:        #e8c84a;
  --color-europe:        #7cb87a;
  --color-asia:          #d4a84a;
  --color-north-america: #88c47a;
  --color-south-america: #a8c870;
  --color-oceania:       #c4a050;
  --color-antarctica:    #ddd3be;

  /* UI chrome */
  --text-primary:  #3d2b0a;
  --text-muted:    #8b6f47;
  --accent:        #8b6f47;
  --border:        #c8b890;
  --active-bg:     #d8ccb0;
  --active-border: #8b6f47;

  /* Typography */
  --font-family:    'Georgia', 'Times New Roman', serif;
  --font-size-base: 14px;

  /* Layout */
  --sidebar-width: 220px;
}

/* ============================================================
   RESET & BASE
   ============================================================ */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-family);
  font-size: var(--font-size-base);
  background: var(--bg-app);
  color: var(--text-primary);
  height: 100vh;
  overflow: hidden;
}

/* ============================================================
   LAYOUT — sidebar left + main right
   ============================================================ */
#app {
  display: flex;
  height: 100vh;
}

#sidebar {
  width: var(--sidebar-width);
  min-width: var(--sidebar-width);
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

#sidebar-header {
  padding: 20px 16px 14px;
  border-bottom: 1px solid var(--border);
}

#sidebar-header h1 {
  font-size: 18px;
  font-weight: bold;
  letter-spacing: 1px;
  line-height: 1.2;
  color: var(--text-primary);
}

#sidebar-header .tagline {
  font-size: 10px;
  letter-spacing: 2px;
  color: var(--text-muted);
  text-transform: uppercase;
  margin-top: 4px;
}

#projection-list {
  overflow-y: auto;
  flex: 1;
  padding: 8px 0;
}

/* Individual projection button */
.proj-btn {
  display: block;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  border-left: 3px solid transparent;
  padding: 8px 14px;
  cursor: pointer;
  color: var(--text-muted);
  font-family: var(--font-family);
  font-size: 13px;
  transition: background 0.15s, color 0.15s;
}

.proj-btn:hover {
  background: var(--active-bg);
  color: var(--text-primary);
}

.proj-btn.active {
  background: var(--active-bg);
  border-left-color: var(--active-border);
  color: var(--text-primary);
  font-weight: bold;
}

.proj-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.proj-btn .proj-family {
  display: block;
  font-size: 9px;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-top: 2px;
}

/* ============================================================
   MAIN — map canvas + info panel
   ============================================================ */
#main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

#map-container {
  flex: 1;
  position: relative;
  overflow: hidden;
}

#map-svg {
  width: 100%;
  height: 100%;
}

/* Ocean rectangle rendered by D3 */
.ocean {
  fill: var(--bg-ocean);
}

/* Country paths */
.country {
  stroke: var(--bg-sidebar);
  stroke-width: 0.5px;
  vector-effect: non-scaling-stroke; /* border stays 0.5px regardless of SVG scale */
}

/* Info panel below the map */
#projection-info {
  padding: 12px 20px;
  border-top: 1px solid var(--border);
  background: var(--bg-sidebar);
  min-height: 64px;
}

#info-name {
  font-size: 16px;
  font-weight: bold;
  margin-right: 10px;
}

#info-family {
  font-size: 10px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--text-muted);
}

#info-description {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
  line-height: 1.5;
}
```

- [ ] **Step 3: Write `static/js/map.js`** — PROJECTIONS registry + rendering + sidebar

```js
// ============================================================
// PROJECTIONS REGISTRY
//
// To add a new projection, append one object to this array.
// The sidebar, switching logic, and animation all read from here —
// nothing else needs to change.
//
// d3fn must return a configured D3 projection instance (not fitted).
// Fitting to the viewport happens in makeProjection().
//
// Projections marked "d3-geo-projection" require the
// d3-geo-projection CDN script loaded before this file.
// ============================================================
const PROJECTIONS = [
  {
    id: "mercator",
    name: "Mercator",
    family: "Cylindrical",
    year: 1569,
    description:
      "Preserves angles (conformal). Severely distorts area near the poles. " +
      "The standard for maritime navigation for centuries.",
    d3fn: () => d3.geoMercator(),
  },
  {
    id: "equirectangular",
    name: "Equirectangular",
    family: "Cylindrical",
    year: 100,
    description:
      "Maps longitude and latitude directly to x and y. Simple but distorts " +
      "both shape and area away from the equator.",
    d3fn: () => d3.geoEquirectangular(),
  },
  {
    id: "robinson",
    name: "Robinson",
    family: "Pseudocylindrical",
    year: 1963,
    description:
      "Visual compromise: neither conformal nor equal-area, but aesthetically " +
      "pleasing. Used by National Geographic from 1988 to 1998.",
    d3fn: () => d3.geoRobinson(), // d3-geo-projection
  },
  {
    id: "mollweide",
    name: "Mollweide",
    family: "Pseudocylindrical",
    year: 1805,
    description:
      "Equal-area projection. Shapes are distorted near the edges but all " +
      "regions are represented at their true relative size.",
    d3fn: () => d3.geoMollweide(), // d3-geo-projection
  },
  {
    id: "naturalEarth",
    name: "Natural Earth",
    family: "Pseudocylindrical",
    year: 2012,
    description:
      "Designed by Tom Patterson for attractive world maps. A smooth compromise " +
      "between conformal and equal-area with gently rounded poles.",
    d3fn: () => d3.geoNaturalEarth1(),
  },
  {
    id: "sinusoidal",
    name: "Sinusoidal",
    family: "Pseudocylindrical",
    year: 1570,
    description:
      "One of the oldest pseudocylindrical projections. Equal-area, but strong " +
      "shearing distortion appears near the edges.",
    d3fn: () => d3.geoSinusoidal(), // d3-geo-projection
  },
  {
    id: "orthographic",
    name: "Orthographic",
    family: "Azimuthal",
    year: 200,
    description:
      "Simulates viewing Earth from infinite distance — the 'space view'. " +
      "Only one hemisphere is visible at a time.",
    d3fn: () => d3.geoOrthographic(),
  },
  {
    id: "azimuthalEqualArea",
    name: "Azimuthal Equal Area",
    family: "Azimuthal",
    year: 1772,
    description:
      "Projects from the centre of the sphere. Preserves area accurately, " +
      "making it useful for comparing continent sizes.",
    d3fn: () => d3.geoAzimuthalEqualArea(),
  },
  {
    id: "albers",
    name: "Albers",
    family: "Conic",
    year: 1805,
    description:
      "Conic equal-area projection with two standard parallels. Best for " +
      "mid-latitude regions. Official projection for US Census maps.",
    // Recentred and rescaled for a world view instead of the USA default
    d3fn: () => d3.geoAlbers().rotate([0, 0]).parallels([20, 50]).scale(153),
  },
  {
    id: "winkelTripel",
    name: "Winkel Tripel",
    family: "Pseudoazimuthal",
    year: 1921,
    description:
      "Minimises the combined distortion of area, angles, and distances. " +
      "Adopted by the National Geographic Society in 1998.",
    d3fn: () => d3.geoWinkel3(), // d3-geo-projection
  },
  {
    id: "aitoff",
    name: "Aitoff",
    family: "Pseudoazimuthal",
    year: 1889,
    description:
      "Modified azimuthal projection with an elliptical boundary. " +
      "Reduces polar distortion compared to cylindrical projections.",
    d3fn: () => d3.geoAitoff(), // d3-geo-projection
  },
  {
    id: "hammer",
    name: "Hammer",
    family: "Pseudoazimuthal",
    year: 1892,
    description:
      "Equal-area modification of the Aitoff projection. Widely used in " +
      "astronomy to map the entire celestial sphere.",
    d3fn: () => d3.geoHammer(), // d3-geo-projection
  },
];

// ============================================================
// CONTINENT → CSS VARIABLE MAPPING
// Keys must exactly match the 'continent' values in world.geojson.
// ============================================================
const CONTINENT_COLOR_VAR = {
  "Africa":         "--color-africa",
  "Europe":         "--color-europe",
  "Asia":           "--color-asia",
  "North America":  "--color-north-america",
  "South America":  "--color-south-america",
  "Oceania":        "--color-oceania",
  "Antarctica":     "--color-antarctica",
};

/** Returns the CSS var() expression for a continent, with a fallback. */
function continentColor(continent) {
  const varName = CONTINENT_COLOR_VAR[continent];
  return varName ? `var(${varName})` : "var(--color-africa)";
}

// ============================================================
// SVG SETUP
// ============================================================
const container = document.getElementById("map-container");
const WIDTH  = container.clientWidth;
const HEIGHT = container.clientHeight;

const svg = d3
  .select("#map-svg")
  .attr("viewBox", `0 0 ${WIDTH} ${HEIGHT}`)
  .attr("preserveAspectRatio", "xMidYMid meet");

// Full-rectangle ocean background
svg
  .append("rect")
  .attr("class", "ocean")
  .attr("width", WIDTH)
  .attr("height", HEIGHT);

// Group containing all country <path> elements
const mapGroup = svg.append("g").attr("class", "countries");

// ============================================================
// APPLICATION STATE
// ============================================================
let currentProjectionId = "mercator";
let isAnimating = false;
let worldData = null; // set in init() after GeoJSON fetch

// ============================================================
// PROJECTION FACTORY
// Fits the projection to the SVG viewport using the full sphere as reference.
// ============================================================
function makeProjection(projDef) {
  return projDef.d3fn().fitSize([WIDTH, HEIGHT], { type: "Sphere" });
}

// ============================================================
// RENDER — draw (or update) country paths for a given projection
// ============================================================
function renderMap(projection) {
  const path = d3.geoPath().projection(projection);

  // Key by country name so D3 can match enter/update/exit sets correctly
  const paths = mapGroup
    .selectAll("path.country")
    .data(worldData.features, (d) => d.properties.name);

  // First render: create one <path> per country
  paths
    .enter()
    .append("path")
    .attr("class", "country")
    .attr("fill", (d) => continentColor(d.properties.continent))
    .attr("d", path);

  // Subsequent renders (instant, no animation): update path geometry
  paths.attr("d", path);
}

// ============================================================
// INFO PANEL — update the description strip below the map
// ============================================================
function updateInfo(projDef) {
  document.getElementById("info-name").textContent = projDef.name;
  document.getElementById("info-family").textContent = projDef.family;
  document.getElementById("info-description").textContent = projDef.description;
}

// ============================================================
// SIDEBAR — build buttons from the PROJECTIONS array
// ============================================================
function buildSidebar() {
  const nav = document.getElementById("projection-list");

  PROJECTIONS.forEach((proj) => {
    const btn = document.createElement("button");
    btn.className = "proj-btn";
    btn.id = `btn-${proj.id}`;
    btn.dataset.projId = proj.id;
    btn.innerHTML = `
      ${proj.name}
      <span class="proj-family">${proj.family}</span>
    `;
    btn.addEventListener("click", () => switchProjection(proj.id));
    nav.appendChild(btn);
  });

  setActiveButton(currentProjectionId);
}

function setActiveButton(projId) {
  document.querySelectorAll(".proj-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.projId === projId);
  });
}

// ============================================================
// SWITCH PROJECTION (instant — animation added in Task 6)
// ============================================================
function switchProjection(newProjId) {
  if (isAnimating || newProjId === currentProjectionId) return;

  const projDef = PROJECTIONS.find((p) => p.id === newProjId);
  if (!projDef) return;

  currentProjectionId = newProjId;
  setActiveButton(newProjId);
  updateInfo(projDef);
  renderMap(makeProjection(projDef));
}

// ============================================================
// INIT — fetch GeoJSON, then render the default projection
// ============================================================
async function init() {
  const response = await fetch("/data/world.geojson");
  worldData = await response.json();

  const initialProj = PROJECTIONS.find((p) => p.id === currentProjectionId);

  buildSidebar();
  renderMap(makeProjection(initialProj));
  updateInfo(initialProj);
}

init();
```

- [ ] **Step 4: Start the server and verify in the browser**

```bash
poetry run uvicorn app.main:app --reload
```

Open http://localhost:8000. Verify:
- Parchment background, sidebar on the left
- World map in Mercator with continent colours
- 12 projection names listed in the sidebar
- "Mercator" button is highlighted (active)
- Description visible below the map
- Clicking any projection re-renders the map instantly

Check the browser DevTools console for errors. Stop with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add templates/index.html static/css/style.css static/js/map.js
git commit -m "feat: full D3 world map with dynamic sidebar and instant projection switching"
```

---

## Task 5: Manual QA — All 12 Projections

Verify every projection renders correctly before adding animation. Fixes here are cheaper than chasing rendering bugs through animation code.

**Files:**
- Modify: `static/js/map.js` (only if bugs found)

- [ ] **Step 1: Test all projections in the browser**

```bash
poetry run uvicorn app.main:app --reload
```

Click each of the 12 projections. For each, check:
- Map renders without console errors ✓
- Shape is recognisable (not blank, not a single dot) ✓
- Active button is highlighted ✓
- Description updates ✓

Known edge cases:
- **Orthographic** shows only one hemisphere — this is correct
- **Albers** should show a full world view (not USA-only) thanks to `.rotate([0,0]).parallels([20,50])`
- **Mercator** clicking again when already active should do nothing

- [ ] **Step 2: Fix any rendering issues**

Common causes:
- `d3.geoRobinson is not a function` → check that `d3-geo-projection` CDN tag loads *before* `map.js` in `index.html`
- Blank map → open Network tab in DevTools and confirm `/data/world.geojson` returns 200

- [ ] **Step 3: Commit fixes if any**

```bash
git add static/js/map.js
git commit -m "fix: projection rendering issues found in manual QA"
```

---

## Task 6: Animated Transition — Morph + Globe

Replaces instant switching with a 3-step animation: morph to globe → rotate globe → morph to target.

**Files:**
- Modify: `static/js/map.js`

- [ ] **Step 1: Add helper functions to `map.js`**

Insert the following block *after* the `renderMap()` function and *before* `updateInfo()`:

```js
// ============================================================
// ANIMATION HELPERS
// ============================================================

/**
 * Compute the SVG path string for every country under a given projection.
 * Returns a Map<countryName, pathString> for O(1) lookup during animation.
 *
 * @param {Object} projection - A fitted D3 projection instance
 * @returns {Map<string, string>}
 */
function computePaths(projection) {
  const pathGen = d3.geoPath().projection(projection);
  const map = new Map();
  worldData.features.forEach((feature) => {
    map.set(feature.properties.name, pathGen(feature) || "");
  });
  return map;
}

/**
 * Tween all country paths from one set of SVG path strings to another
 * using flubber for smooth shape morphing.
 *
 * @param {Map<string, string>} fromPaths - Starting path strings per country
 * @param {Map<string, string>} toPaths   - Target path strings per country
 * @param {number} duration               - Transition duration in milliseconds
 * @returns {Promise<void>}               - Resolves when the transition ends
 */
function morphPaths(fromPaths, toPaths, duration) {
  return new Promise((resolve) => {
    const transition = d3.transition().duration(duration).ease(d3.easeCubicInOut);

    mapGroup
      .selectAll("path.country")
      .transition(transition)
      .attrTween("d", function (d) {
        const name = d.properties.name;
        const from = fromPaths.get(name) || "";
        const to   = toPaths.get(name)   || "";
        try {
          // flubber interpolates between arbitrary SVG path shapes
          return flubber.interpolate(from, to, { maxSegmentLength: 4 });
        } catch {
          // Fallback: snap to target without interpolation (e.g. empty paths)
          return () => to;
        }
      });

    setTimeout(resolve, duration);
  });
}

/**
 * Animate the orthographic globe rotating by `degrees` longitude over `duration` ms.
 * Re-renders all country paths on each animation frame.
 *
 * @param {Object} globeProjection - The orthographic projection instance (mutated in place)
 * @param {number} degrees         - Longitude degrees to rotate by
 * @param {number} duration        - Duration in milliseconds
 * @returns {Promise<void>}
 */
function rotateGlobe(globeProjection, degrees, duration) {
  return new Promise((resolve) => {
    const pathGen       = d3.geoPath().projection(globeProjection);
    const startRotation = globeProjection.rotate()[0];
    const endRotation   = startRotation + degrees;

    d3.transition()
      .duration(duration)
      .ease(d3.easeLinear)
      .tween("globe-rotate", () => {
        const interp = d3.interpolateNumber(startRotation, endRotation);
        return (t) => {
          globeProjection.rotate([interp(t), 0]);
          mapGroup.selectAll("path.country").attr("d", (d) => pathGen(d));
        };
      })
      .on("end", resolve);
  });
}

/**
 * Three-step animated transition between the current projection and a new one.
 *
 * Sequence:
 *   1. 500ms — morph current projection → orthographic globe
 *   2. 400ms — rotate globe 30° on the longitude axis
 *   3. 500ms — morph rotated globe → target projection
 *
 * Sidebar buttons are disabled for the full duration to prevent cascading clicks.
 *
 * @param {string} newProjId - ID of the target projection from PROJECTIONS
 */
async function transitionTo(newProjId) {
  const projDef = PROJECTIONS.find((p) => p.id === newProjId);
  if (!projDef) return;

  // Lock sidebar during animation
  isAnimating = true;
  document.querySelectorAll(".proj-btn").forEach((b) => (b.disabled = true));

  // Pre-compute path sets for all three states
  const currentProjDef = PROJECTIONS.find((p) => p.id === currentProjectionId);
  const currentProj    = makeProjection(currentProjDef);
  const fromPaths      = computePaths(currentProj);

  const globeProj  = d3.geoOrthographic().fitSize([WIDTH, HEIGHT], { type: "Sphere" });
  const globePaths = computePaths(globeProj);

  const targetProj  = makeProjection(projDef);
  const targetPaths = computePaths(targetProj);

  // Step 1: morph to globe
  await morphPaths(fromPaths, globePaths, 500);

  // Step 2: rotate globe
  await rotateGlobe(globeProj, 30, 400);

  // Step 3: morph from rotated globe to target
  // (recompute after rotation since paths have changed)
  const rotatedGlobePaths = computePaths(globeProj);
  await morphPaths(rotatedGlobePaths, targetPaths, 500);

  // Update state and unlock
  currentProjectionId = newProjId;
  setActiveButton(newProjId);
  updateInfo(projDef);

  isAnimating = false;
  document.querySelectorAll(".proj-btn").forEach((b) => (b.disabled = false));
}
```

- [ ] **Step 2: Replace `switchProjection()` to call `transitionTo()`**

Replace the existing `switchProjection` function with:

```js
function switchProjection(newProjId) {
  if (isAnimating || newProjId === currentProjectionId) return;
  transitionTo(newProjId);
}
```

- [ ] **Step 3: Start the server and test the animation**

```bash
poetry run uvicorn app.main:app --reload
```

Open http://localhost:8000. Click a projection and verify the 3-step sequence:
1. Map morphs toward a globe shape (500ms)
2. Globe rotates slightly (400ms)
3. Globe morphs into the target projection (500ms)

Also verify:
- Buttons are greyed out and unclickable during animation
- Rapid clicks are ignored
- Active button and description update *after* the animation completes
- All 12 projections animate correctly

- [ ] **Step 4: Commit**

```bash
git add static/js/map.js
git commit -m "feat: animated projection transition — morph to globe then morph to target"
```

---

## Task 7: Final Visual QA and Cleanup

- [ ] **Step 1: Verify .gitignore coverage**

```bash
git status
```

Confirm `app/data/world.geojson` is listed as untracked but **not staged** (gitignored).
If it appears staged, check the `.gitignore` entry `app/data/world.geojson`.

- [ ] **Step 2: Full browser visual checklist**

Open http://localhost:8000 and verify:

- [ ] Parchment background (`--bg-app`) covers the page
- [ ] Ocean fill uses muted blue (`--bg-ocean`)
- [ ] Africa = yellow, Europe = green, Asia = gold, Americas = light green, Oceania = brown, Antarctica = pale
- [ ] Active projection button shows left border accent
- [ ] Country borders (strokes) are thin (0.5px) and do not overwhelm fill colours
- [ ] Description text is readable in the info panel
- [ ] No horizontal/vertical scrollbars on the map canvas
- [ ] Animation runs smoothly (no jank or blank frames)

- [ ] **Step 3: Apply any CSS tweaks found during QA**

Edit `static/css/style.css` only for issues found above.

- [ ] **Step 4: Final commit**

```bash
git add static/css/style.css
git commit -m "chore: visual QA pass — CSS tweaks and layout verification"
```

---

## Running the Project

```bash
# Install dependencies (once)
poetry install

# Generate GeoJSON data (once, requires internet)
poetry run python scripts/fetch_geodata.py

# Start the development server
poetry run uvicorn app.main:app --reload
# → open http://localhost:8000

# Run tests
poetry run pytest -v
```
