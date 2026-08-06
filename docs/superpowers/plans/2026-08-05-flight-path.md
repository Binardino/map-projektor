# Flight Path / Great Circle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user click two points anywhere on the map to draw the great-circle route between them, showing its real distance and how its curvature changes across the 17 projections, in both the single map view and side-by-side comparison mode.

**Architecture:** A toggleable interaction mode (`flightPathMode`), parallel to the existing Tissot overlay and recenter-preset patterns already in `static/js/map.js`. Endpoints are stored as `[lon, lat]` — projection-independent — and re-projected into a `LineString` via `d3.geoInterpolate` + `d3.geoPath` on every projection switch (`refreshFlightPath()`, mirroring `refreshTissot()`). Mutually exclusive with country selection and recenter presets, following the same convention those two already established with each other.

**Tech Stack:** Vanilla JS + D3 v7 (`d3-geo` core: `geoInterpolate`, `geoDistance`, `geoPath`, `pointer`), same as the rest of the frontend. No new dependencies, no backend changes.

**Verified during planning:** All 17 projections in `PROJECTIONS` support reliable `.invert()` round-tripping (tested empirically: project → invert → compare, <0.5° tolerance, for 10 sample points per projection). The one apparent failure (Orthographic, 6/10) is expected and harmless: `.invert()` correctly returns `null` for points outside the visible hemisphere, which a click can never actually land on since nothing is rendered there. **No per-projection incompatibility list is needed** — just a `null` guard on the click handler's result, unlike the `RECENTER_INCOMPATIBLE` mechanism this risk was originally expected to require.

---

## File Structure

- Modify: `templates/index.html` — new toggle button + distance label in the sidebar
- Modify: `static/css/style.css` — button styles, distance label, overlay layer/path/marker styles
- Modify: `static/js/map.js` — new "FLIGHT PATH / GREAT CIRCLE" section (state, rendering, click handling), plus small hooks into five existing places: `renderMap`'s per-country click handler, `selectCountry`, `applyRecenter`, `transitionTo`, `init`, `buildComparePanel`, and the `compareToggleBtn` handler
- Modify: `README.md`, `CHANGELOG.md` — document the shipped feature

No new files — this codebase keeps one JS file per concern-area already (`map.js` for all frontend logic), and the plan follows that existing pattern rather than splitting it up.

---

### Task 0: Create the feature branch

**Files:** none

- [ ] **Step 1: Create and switch to the feature branch**

```bash
git checkout main
git pull
git checkout -b feature/flight-path
```

- [ ] **Step 2: Verify branch**

```bash
git branch --show-current
```

Expected: `feature/flight-path`

---

### Task 1: Sidebar UI scaffolding (HTML + CSS only)

**Files:**
- Modify: `templates/index.html:28` (after the `#tissot-toggle` button)
- Modify: `static/css/style.css` (two insertion points, see steps below)

- [ ] **Step 1: Add the toggle button and distance label to the sidebar**

In `templates/index.html`, find:

```html
      <button id="tissot-toggle">Show Distortion Grid</button>
      <div id="recenter-panel">
```

Replace with:

```html
      <button id="tissot-toggle">Show Distortion Grid</button>
      <button id="flightpath-toggle">Draw Flight Path</button>
      <p id="flightpath-distance" hidden></p>
      <div id="recenter-panel">
```

- [ ] **Step 2: Add button styling**

In `static/css/style.css`, find the shared hover/active rule for the other toggle buttons:

```css
#compare-toggle:hover,
#compare-toggle.active,
#tissot-toggle:hover,
#tissot-toggle.active {
  background: var(--active-bg);
  border-color: var(--active-border);
  color: var(--text-primary);
}
```

Replace with (adds `#flightpath-toggle` to the shared selector):

```css
#compare-toggle:hover,
#compare-toggle.active,
#tissot-toggle:hover,
#tissot-toggle.active,
#flightpath-toggle:hover,
#flightpath-toggle.active {
  background: var(--active-bg);
  border-color: var(--active-border);
  color: var(--text-primary);
}
```

Then, immediately after the `#tissot-toggle { ... }` block (which ends right before `#projection-list.disabled-list`), insert:

```css
#flightpath-toggle {
  display: block;
  width: calc(100% - 24px);
  margin: 0 12px 4px;
  padding: 7px 10px;
  font-family: var(--font-family);
  font-size: 11px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  background: none;
  border: 1px solid var(--border);
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 2px;
  transition: background 0.15s, color 0.15s;
}

#flightpath-distance {
  padding: 0 12px 10px;
  font-size: 11px;
  color: var(--text-muted);
}
```

- [ ] **Step 3: Add overlay layer/path/marker styles**

In `static/css/style.css`, find the Tissot overlay block:

```css
.tissot-graticule {
  fill: none;
  stroke: var(--accent);
  stroke-width: 0.5px;
  stroke-opacity: 0.45;
}
```

Immediately after it, insert:

```css

/* Flight path overlay — pointer-events off so it never blocks the
   click-to-place-point handler on the layers underneath it. */
.flightpath-layer {
  pointer-events: none;
}

.flightpath-path {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2px;
}

.flightpath-marker {
  fill: var(--accent);
  stroke: var(--bg-app);
  stroke-width: 1.5px;
}
```

- [ ] **Step 4: Manually verify the page still loads with no console errors**

```bash
lsof -ti:8000 | xargs kill 2>/dev/null; sleep 1
(poetry run uvicorn app.main:app --reload > /tmp/uvicorn.log 2>&1 &)
sleep 2
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/
```

Expected: `200`. Open http://localhost:8000 in a browser (or via Playwright screenshot) and confirm the "Draw Flight Path" button renders in the sidebar between "Show Distortion Grid" and "Recenter View", with no JS console errors (the button has no click handler yet — that's Task 2).

- [ ] **Step 5: Commit**

```bash
git add templates/index.html static/css/style.css
git commit -m "feat(flightpath): add toggle button, distance label, and overlay styles

No JS logic yet — matches the pattern used for the Tissot overlay
feature (UI/styles committed separately from behavior)."
```

---

### Task 2: Great-circle drawing on the single map view

**Files:**
- Modify: `static/js/map.js` (five insertion points, see steps below)

- [ ] **Step 1: Add the flight-path SVG layer group**

Find, in the `SVG SETUP` section:

```js
// Tissot's indicatrix overlay — appended after mapGroup so it paints on top
const tissotGroup = svg.append("g").attr("class", "tissot-layer");
```

Replace with:

```js
// Tissot's indicatrix overlay — appended after mapGroup so it paints on top
const tissotGroup = svg.append("g").attr("class", "tissot-layer");

// Flight path overlay — appended after tissotGroup so the arc paints on top
const flightPathGroup = svg.append("g").attr("class", "flightpath-layer");
```

- [ ] **Step 2: Gate the existing per-country click handler on flight-path mode**

Find, in `renderMap`:

```js
  paths
    .enter()
    .append("path")
    .attr("class", "country")
    .attr("d", path)
    .on("click", (event, d) => selectCountry(d));
```

Replace the `.on("click", ...)` line with:

```js
    .on("click", (event, d) => {
      if (!flightPathMode) selectCountry(d);
    });
```

- [ ] **Step 3: Add the flight-path module**

Find the end of the `TISSOT'S INDICATRIX OVERLAY` section — the `tissotToggleBtn.addEventListener("click", ...)` block, which ends right before:

```js
// ============================================================
// INIT — fetch GeoJSON then render
// ============================================================
```

Immediately before that `INIT` header, insert the whole new section:

```js
// ============================================================
// FLIGHT PATH / GREAT CIRCLE
//
// Click two points anywhere on the map to draw the great-circle
// route between them, with its real-world distance. Switching
// projection re-renders the same route, showing how its curvature
// changes — this is what makes "shortest path" distortion visible
// (e.g. why transpolar flights curve near the pole on a globe but
// look wrong on a flat Mercator map).
//
// Endpoints are stored as [lon, lat] — projection-independent, like
// the Tissot grid points — so refreshFlightPath() can re-project and
// redraw them after any projection switch, the same pattern as
// refreshTissot(). Mutually exclusive with country selection and
// recenter presets (same convention those two already use with each
// other): turning flight-path mode on clears both; selecting a
// country or a recenter preset turns flight-path mode off.
// ============================================================
const flightPathToggleBtn  = document.getElementById("flightpath-toggle");
const flightPathDistanceEl = document.getElementById("flightpath-distance");

const EARTH_RADIUS_KM = 6371;

let flightPathMode = false;
let flightPathA = null; // [lon, lat] or null
let flightPathB = null; // [lon, lat] or null

// Full clear-and-redraw rather than a D3 data join: at most one path and
// two markers, redrawn only on discrete events (click, projection switch),
// never per animation frame — a join would add complexity for no benefit.
function renderFlightPath(group, projection) {
  group.selectAll("*").remove();
  if (!flightPathA) return;

  const pathFn = d3.geoPath().projection(projection);

  if (flightPathB) {
    const arc = d3.geoInterpolate(flightPathA, flightPathB);
    const coordinates = d3.range(0, 1.0001, 1 / 100).map(arc);
    const line = pathFn({ type: "LineString", coordinates });
    if (line) group.append("path").attr("class", "flightpath-path").attr("d", line);
  }

  const points = flightPathB ? [flightPathA, flightPathB] : [flightPathA];
  points.forEach((d) => {
    const screen = projection(d);
    if (!screen) return; // point fell outside the visible hemisphere after a projection switch
    group
      .append("circle")
      .attr("class", "flightpath-marker")
      .attr("r", 4)
      .attr("cx", screen[0])
      .attr("cy", screen[1]);
  });
}

function updateFlightPathDistanceLabel() {
  if (flightPathA && flightPathB) {
    const km = Math.round(d3.geoDistance(flightPathA, flightPathB) * EARTH_RADIUS_KM);
    flightPathDistanceEl.textContent = `Distance: ${km.toLocaleString()} km`;
    flightPathDistanceEl.hidden = false;
  } else {
    flightPathDistanceEl.hidden = true;
  }
}

// Re-renders the route on the single map and, if active, on both
// comparison panels — called after any projection change.
function refreshFlightPath() {
  const currentDef = PROJECTIONS.find((p) => p.id === currentProjectionId);
  renderFlightPath(flightPathGroup, makeProjection(currentDef, currentRecenterRotate));

  if (compareMode && comparePanels) {
    comparePanels.forEach((panel) => {
      const projDef = PROJECTIONS.find((p) => p.id === panel.projId);
      renderFlightPath(panel.flightPathGroup, projDef.d3fn().fitSize([panel.width, panel.height], { type: "Sphere" }));
    });
  }

  updateFlightPathDistanceLabel();
}

function setFlightPathMode(active) {
  flightPathMode = active;
  flightPathToggleBtn.classList.toggle("active", flightPathMode);
  flightPathA = null;
  flightPathB = null;
  refreshFlightPath();
}

flightPathToggleBtn.addEventListener("click", () => {
  if (isAnimating) return;
  if (!flightPathMode) {
    clearSelection();
    resetRecenter();
  }
  setFlightPathMode(!flightPathMode);
});

// 1st click places A, 2nd places B and draws the route, 3rd starts over.
function handleFlightPathClick(event) {
  if (!flightPathMode || isAnimating) return;

  const currentDef = PROJECTIONS.find((p) => p.id === currentProjectionId);
  const projection = makeProjection(currentDef, currentRecenterRotate);
  const [x, y] = d3.pointer(event, svg.node());
  const coords = projection.invert([x, y]);
  if (!coords) return; // click landed outside the rendered sphere

  if (!flightPathA) {
    flightPathA = coords;
  } else if (!flightPathB) {
    flightPathB = coords;
  } else {
    flightPathA = coords;
    flightPathB = null;
  }
  refreshFlightPath();
}
svg.node().addEventListener("click", handleFlightPathClick);

```

- [ ] **Step 4: Clear flight-path mode from `selectCountry` and `applyRecenter`**

Find, in `selectCountry`:

```js
function selectCountry(feature) {
  if (!feature) return;

  // Mutually exclusive with recenter presets (see RECENTER PRESETS note):
```

Replace with:

```js
function selectCountry(feature) {
  if (!feature) return;

  if (flightPathMode) setFlightPathMode(false); // mutually exclusive, see FLIGHT PATH note

  // Mutually exclusive with recenter presets (see RECENTER PRESETS note):
```

Find, in `applyRecenter`:

```js
function applyRecenter(presetId) {
  if (isAnimating || RECENTER_INCOMPATIBLE.has(currentProjectionId)) return;

  const preset = RECENTER_PRESETS.find((p) => p.id === presetId);
```

Replace with:

```js
function applyRecenter(presetId) {
  if (isAnimating || RECENTER_INCOMPATIBLE.has(currentProjectionId)) return;

  if (flightPathMode) setFlightPathMode(false); // mutually exclusive, see FLIGHT PATH note

  const preset = RECENTER_PRESETS.find((p) => p.id === presetId);
```

- [ ] **Step 5: Wire `refreshFlightPath()` into projection switching and init**

Find, in `transitionTo`:

```js
  refreshTissot();
  refreshRecenterAvailability();
```

Replace with:

```js
  refreshTissot();
  refreshRecenterAvailability();
  refreshFlightPath();
```

Find, in `init`:

```js
  refreshTissot();
  refreshRecenterAvailability();
}
```

Replace with:

```js
  refreshTissot();
  refreshRecenterAvailability();
  refreshFlightPath();
}
```

- [ ] **Step 6: Manual verification — single map view**

```bash
lsof -ti:8000 | xargs kill 2>/dev/null; sleep 1
(poetry run uvicorn app.main:app --reload > /tmp/uvicorn.log 2>&1 &)
sleep 2
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/
```

Expected: `200`. Then run this Playwright script (adjust the scratch path to your environment's temp/scratch directory):

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1400, "height": 900})
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))

    page.goto("http://localhost:8000")
    page.wait_for_selector("#map-svg path.country")

    # Activate flight-path mode
    page.click("#flightpath-toggle")
    page.wait_for_timeout(200)
    print("mode active:", "active" in page.get_attribute("#flightpath-toggle", "class"))

    # Click two points on the map (Mercator default) — screen coords, not geo
    page.click("#map-svg", position={"x": 400, "y": 300})
    page.wait_for_timeout(100)
    print("path count after 1 click:", page.locator("path.flightpath-path").count())

    page.click("#map-svg", position={"x": 900, "y": 250})
    page.wait_for_timeout(100)
    print("path count after 2 clicks:", page.locator("path.flightpath-path").count())
    print("marker count:", page.locator("circle.flightpath-marker").count())
    print("distance label:", page.inner_text("#flightpath-distance"))
    print("distance label hidden:", page.get_attribute("#flightpath-distance", "hidden"))

    # Third click starts a new route: path should clear, one marker remains
    page.click("#map-svg", position={"x": 600, "y": 400})
    page.wait_for_timeout(100)
    print("path count after 3rd click (should be 0):", page.locator("path.flightpath-path").count())
    print("marker count after 3rd click (should be 1):", page.locator("circle.flightpath-marker").count())

    # Switching projection preserves the in-progress point and re-renders on completion
    page.click("#flightpath-toggle")  # turn off, clears the in-progress route
    page.wait_for_timeout(100)
    print("path count after deactivating (should be 0):", page.locator("path.flightpath-path").count())

    # Full route survives a projection switch
    page.click("#flightpath-toggle")
    page.click("#map-svg", position={"x": 400, "y": 300})
    page.click("#map-svg", position={"x": 900, "y": 250})
    page.wait_for_timeout(200)
    page.click("#btn-orthographic")
    page.wait_for_timeout(4000)
    print("path count after projection switch (should be 1 or 0 if endpoints fell off-globe):",
          page.locator("path.flightpath-path").count())

    # Mutual exclusion: selecting a country turns flight-path mode off
    page.click("#flightpath-toggle")
    page.click("#map-svg", position={"x": 400, "y": 300})
    page.fill("#country-search-input", "brazil")
    page.wait_for_selector("#country-search-results li")
    page.locator("#country-search-results li").first.click()
    page.wait_for_timeout(500)
    print("flightpath mode active after selecting a country (should be False):",
          "active" in page.get_attribute("#flightpath-toggle", "class"))
    print("flightpath path count after selecting a country (should be 0):",
          page.locator("path.flightpath-path").count())

    browser.close()

print("Console/page errors:", errors)
```

Expected output: mode toggles correctly; 1 click → 0 paths, 1 marker; 2 clicks → 1 path, 2 markers, a non-empty distance label like `Distance: 1,234 km`; 3rd click clears the path and leaves 1 marker; deactivating clears everything; the route persists (re-rendered, not dropped) across a projection switch; selecting a country turns flight-path mode off and clears the route; zero console errors.

- [ ] **Step 7: Fix any issues found, then commit**

```bash
git add static/js/map.js
git commit -m "feat(flightpath): draw great-circle routes on the single map view

Click two points to draw the route between them with its real
distance (d3.geoInterpolate + d3.geoDistance). Endpoints are stored
as [lon, lat] and re-projected on every projection switch, the same
pattern as the Tissot overlay. Mutually exclusive with country
selection and recenter presets in both directions."
```

---

### Task 3: Mirror the route onto comparison panels

**Files:**
- Modify: `static/js/map.js` (three insertion points in the `SIDE-BY-SIDE COMPARISON MODE` section)

- [ ] **Step 1: Add a `flightPathGroup` to each comparison panel**

Find, in `buildComparePanel`:

```js
  svg.append("rect").attr("class", "ocean").attr("width", width).attr("height", height);
  const panel = {
    projId: initialProjId,
    mapGroup: svg.append("g").attr("class", "countries"),
    tissotGroup: svg.append("g").attr("class", "tissot-layer"),
    width,
    height,
  };
```

Replace with:

```js
  svg.append("rect").attr("class", "ocean").attr("width", width).attr("height", height);
  const panel = {
    projId: initialProjId,
    mapGroup: svg.append("g").attr("class", "countries"),
    tissotGroup: svg.append("g").attr("class", "tissot-layer"),
    flightPathGroup: svg.append("g").attr("class", "flightpath-layer"),
    width,
    height,
  };
```

- [ ] **Step 2: Refresh the flight path when a panel's projection changes**

Find, in `buildComparePanel`:

```js
  select.addEventListener("change", () => {
    panel.projId = select.value;
    panel.render();
    applySelectionToPanel(panel);
    refreshTissot();
  });
```

Replace with:

```js
  select.addEventListener("change", () => {
    panel.projId = select.value;
    panel.render();
    applySelectionToPanel(panel);
    refreshTissot();
    refreshFlightPath();
  });
```

- [ ] **Step 3: Refresh the flight path when entering/rebuilding compare mode**

Find, in the `compareToggleBtn` click handler:

```js
  comparePanels.forEach(applySelectionToPanel);
  refreshTissot();
});
```

Replace with:

```js
  comparePanels.forEach(applySelectionToPanel);
  refreshTissot();
  refreshFlightPath();
});
```

- [ ] **Step 4: Manual verification — comparison mode mirroring**

```bash
lsof -ti:8000 | xargs kill 2>/dev/null; sleep 1
(poetry run uvicorn app.main:app --reload > /tmp/uvicorn.log 2>&1 &)
sleep 2
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/
```

Expected: `200`. Then run:

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1400, "height": 900})
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))

    page.goto("http://localhost:8000")
    page.wait_for_selector("#map-svg path.country")

    # Draw a route on the single map first
    page.click("#flightpath-toggle")
    page.click("#map-svg", position={"x": 400, "y": 300})
    page.click("#map-svg", position={"x": 900, "y": 250})
    page.wait_for_timeout(200)

    # Enter compare mode — the route should mirror onto both panels
    page.click("#compare-toggle")
    page.wait_for_timeout(400)
    left_paths = page.locator(".compare-panel:nth-child(1) path.flightpath-path").count()
    right_paths = page.locator(".compare-panel:nth-child(2) path.flightpath-path").count()
    print("left panel flight path count:", left_paths, "| right panel:", right_paths)

    # Switch the right panel's projection — its route should re-render, left stays put
    page.select_option(".compare-panel:nth-child(2) .compare-select", "orthographic")
    page.wait_for_timeout(300)
    print("right panel flight path count after switch:",
          page.locator(".compare-panel:nth-child(2) path.flightpath-path").count())

    # Clicking inside a panel must NOT place a new point (read-only mirror)
    page.click(".compare-panel:nth-child(1) svg", position={"x": 100, "y": 100})
    page.wait_for_timeout(200)
    print("left panel flight path count after clicking the panel (should be unchanged, 1):",
          page.locator(".compare-panel:nth-child(1) path.flightpath-path").count())

    browser.close()

print("Console/page errors:", errors)
```

Expected output: both panels show the route (1 path each) after entering compare mode; the right panel's path persists after switching its projection; clicking directly on a comparison panel does not add or remove anything (still 1 path); zero console errors.

- [ ] **Step 5: Fix any issues found, then commit**

```bash
git add static/js/map.js
git commit -m "feat(flightpath): mirror the flight path onto comparison panels

Each panel gets its own flightpath-layer group. Point placement
stays single-map-view only — panels are a read-only mirror, the
same convention already used for country selection."
```

---

### Task 4: Full regression pass

**Files:** none (verification only)

- [ ] **Step 1: Run the existing pytest suite**

```bash
poetry run pytest -v
```

Expected: `6 passed` (this feature is frontend-only; it must not break the existing FastAPI route tests).

- [ ] **Step 2: Run a broader manual Playwright pass covering interactions from the spec's testing checklist not yet exercised above**

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1400, "height": 900})
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))

    page.goto("http://localhost:8000")
    page.wait_for_selector("#map-svg path.country")

    # Recenter preset turns flight-path mode off
    page.click("#flightpath-toggle")
    page.click("#map-svg", position={"x": 400, "y": 300})
    page.click("button.recenter-btn:has-text('China-centered')")
    page.wait_for_timeout(300)
    print("flightpath mode active after picking a recenter preset (should be False):",
          "active" in page.get_attribute("#flightpath-toggle", "class"))

    # Verify invert() works sanely on a representative spread of projections,
    # including both polar routes (fold/spin/unfold)
    for proj_id in ["mercator", "robinson", "orthographic", "albers", "polarNorth", "polarSouth", "winkelTripel"]:
        page.click(f"#btn-{proj_id}")
        page.wait_for_timeout(4000)
        page.click("#flightpath-toggle")
        page.click("#map-svg", position={"x": 500, "y": 350})
        page.click("#map-svg", position={"x": 800, "y": 300})
        page.wait_for_timeout(150)
        count = page.locator("path.flightpath-path").count()
        dist = page.inner_text("#flightpath-distance")
        print(f"{proj_id}: path_count={count} distance='{dist}'")
        page.click("#flightpath-toggle")  # reset for next projection

    browser.close()

print("Console/page errors:", errors)
```

Expected: recenter preset turns flight-path mode off; every projection in the loop produces a rendered path and a plausible non-zero distance string, with zero console errors across the whole run.

- [ ] **Step 3: Clean up any scratch/test files created during manual verification**

```bash
rm -f /tmp/uvicorn.log
lsof -ti:8000 | xargs kill 2>/dev/null
```

(No scratch files are created under the project directory by this plan — Playwright scripts above are meant to be run from your scratch/temp directory per your environment's convention.)

---

### Task 5: Update documentation

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add the feature to the README feature list**

In `README.md`, find:

```markdown
- **Recenter View presets** — China-centered, USA/Pacific-centered, and South America upside-down, curated examples showing that the default Europe-centered map is itself a convention, not a neutral baseline
```

Replace with:

```markdown
- **Recenter View presets** — China-centered, USA/Pacific-centered, and South America upside-down, curated examples showing that the default Europe-centered map is itself a convention, not a neutral baseline
- **Flight path / great circle** — click two points on the map to draw the shortest route between them with its real distance; switching projection shows how differently that same route curves depending on the projection
```

- [ ] **Step 2: Add a CHANGELOG entry**

In `CHANGELOG.md`, add a new dated section at the top (below the `# Changelog` header and its intro line), following the existing format:

```markdown
## 2026-08-05 — Flight path / great circle

### Added
- Click two points on the map to draw the great-circle route between them, with its real distance in km. Recomputed on every projection switch and mirrored onto both comparison panels when active.
```

(If a `## 2026-08-05` section already exists from the same day's earlier work, append this feature's bullet to its `### Added` list instead of creating a new section — see [[feedback_changelog_maintenance]] convention: append to the current day's entry within the same session.)

- [ ] **Step 3: Commit**

```bash
git add README.md CHANGELOG.md
git commit -m "docs: update README and changelog for flight path feature"
```

---

### Task 6: Push, open PR, and merge

**Files:** none

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feature/flight-path
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "feat: flight path / great circle route" --body "$(cat <<'EOF'
## Summary
- Click two points on the map to draw the great-circle route between them, with its real distance in km (d3.geoInterpolate + d3.geoDistance)
- Recomputed on every projection switch (same pattern as the Tissot overlay), showing how the same route's curvature changes across projections
- Mutually exclusive with country selection and recenter presets, in both directions
- Mirrored (read-only) onto both comparison-mode panels

## Test plan
- [x] `poetry run pytest -v` — 6 passed
- [x] Manual browser test via Playwright: point placement (1st/2nd/3rd click cycle), distance label, mutual exclusion with country selection and recenter presets (both directions), route persistence across a projection switch, comparison-panel mirroring with independent per-panel projection switching, panels are click-inert — no console errors
- [x] Verified `.invert()` reliability empirically across all 17 projections before implementation (see plan doc) — no incompatibility list needed
EOF
)"
```

- [ ] **Step 3: Ask the user to confirm before merging**

Per this project's established workflow, do not merge without explicit confirmation — ask the user "PR et merge sur main ?" the same way every previous feature in this project was confirmed before merging.

- [ ] **Step 4: Merge (only after confirmation) and clean up**

```bash
gh pr merge --merge --delete-branch
git checkout main
git pull
```

---

## Self-Review Notes

- **Spec coverage:** every section of `docs/superpowers/specs/2026-08-05-flight-path-design.md` maps to a task above — interaction/toggle (Task 2), coordinate capture via invert (Task 2, with the empirical finding replacing the anticipated incompatibility mechanism), route rendering + distance (Task 2), recompute on projection change (Task 2 step 5), comparison mode (Task 3), explicitly-out-of-scope items are simply not implemented (no dashed comparison line, no curated city list, no reload persistence).
- **Placeholder scan:** no TBD/TODO; every step has complete, real code.
- **Type/name consistency:** `flightPathMode`, `flightPathA`, `flightPathB`, `flightPathGroup`, `flightPathToggleBtn`, `flightPathDistanceEl`, `renderFlightPath`, `refreshFlightPath`, `setFlightPathMode`, `handleFlightPathClick` are used identically across every task; DOM ids/classes (`flightpath-toggle`, `flightpath-distance`, `.flightpath-layer`, `.flightpath-path`, `.flightpath-marker`) consistently use the all-lowercase hyphenated form matching the existing `tissot-toggle`/`tissot-layer` convention.
