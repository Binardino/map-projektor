import { PROJECTIONS } from "./data/projections.js";
import { RECENTER_PRESETS } from "./data/views.js";
import { buildCompareProjectionOptions } from "./ui/compare-card.js";
import { buildLightGeometry } from "./core/geometry.js";
import { buildRecenterPanel, buildSidebar } from "./ui/sidebar.js";
import { clearSelection } from "./core/selection.js";
import { compareMode, comparePanels } from "./tools/side-by-side.js";
import { state } from "./core/state.js";
import { currentZoomTransform } from "./core/camera.js";
import { fitProjection, makeProjection } from "./core/projection.js";
import { flightPathGroup, mapGroup, svg, terrainGroup, truesizeGroup } from "./core/scene.js";
import { loadLanguage } from "./i18n.js";
import { openHelpModal } from "./ui/welcome-modal.js";
import { refreshRecenterAvailability, resetRecenter, rotationFor } from "./core/recenter.js";
import { refreshTissot } from "./tools/tissot.js";
import { renderMap, updateGlobeBackground } from "./core/render.js";
import { updateInfo } from "./ui/info-card.js";

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
// refreshTissot(). Also mirrored onto both compare-mode panels the same
// way Tissot is: one shared A/B pair, each panel just reprojects it with
// its own projection. Mutually exclusive with country selection and
// recenter presets (same convention those two already use with each
// other): turning flight-path mode on clears both; selecting a
// country or a recenter preset turns flight-path mode off.
// ============================================================
const flightPathToggleBtn  = document.getElementById("flightpath-toggle");
const flightPathDistanceEl = document.getElementById("flightpath-distance");

const EARTH_RADIUS_KM = 6371;

export let flightPathMode = false;
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
  if (!flightPathDistanceEl) return; // no sidebar UI right now, see remove(ui) commit
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
export function refreshFlightPath() {
  const currentDef = PROJECTIONS.find((p) => p.id === state.currentProjectionId);
  renderFlightPath(flightPathGroup, makeProjection(currentDef, rotationFor(currentDef)));

  if (compareMode && comparePanels) {
    comparePanels.forEach((panel) => {
      const projDef = PROJECTIONS.find((p) => p.id === panel.projId);
      renderFlightPath(panel.flightPathGroup, fitProjection(projDef, projDef.d3fn(), panel.width, panel.height));
    });
  }

  updateFlightPathDistanceLabel();
}

export function setFlightPathMode(active) {
  flightPathMode = active;
  flightPathToggleBtn.classList.toggle("active", flightPathMode);
  flightPathA = null;
  flightPathB = null;
  refreshFlightPath();
}

// See the compareToggleBtn note above — same guard, same reason.
if (flightPathToggleBtn) {
  flightPathToggleBtn.addEventListener("click", () => {
    if (state.isAnimating) return;
    if (!flightPathMode) {
      clearSelection();
      resetRecenter();
    }
    setFlightPathMode(!flightPathMode);
  });
}

// 1st click places A, 2nd places B and draws the route, 3rd starts over.
// Shared by the main view and each compare-mode panel (see buildComparePanel),
// each passing its own svg node / zoom transform / projection to invert the click.
export function handleFlightPathClick(event, svgNode = svg.node(), zoomTransform = currentZoomTransform, projection = makeProjection(
  PROJECTIONS.find((p) => p.id === state.currentProjectionId),
  rotationFor(PROJECTIONS.find((p) => p.id === state.currentProjectionId))
)) {
  if (!flightPathMode || state.isAnimating) return;

  // Undo the free camera pan/zoom (see CAMERA PAN & ZOOM) to get back to the
  // coordinate space the projection itself draws in before inverting.
  const [sx, sy] = d3.pointer(event, svgNode);
  const [x, y] = zoomTransform.invert([sx, sy]);
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
svg.node().addEventListener("click", (event) => handleFlightPathClick(event));

// ============================================================
// TRUE SIZE COMPARE
//
// Lets the user add several countries as freely draggable silhouettes
// spawned at their true geographic position under the current projection
// (like thetruesizeof.com, generalized to all 17 projections here).
// Independent from the main country search (Feature 1) since that one is
// single-select/highlight-only. Colors cycle through a fixed palette in
// add order. Scoped to the main view only (like the terrain overlay and
// globe drag) — the shapes live in truesizeGroup, inside the main map's
// svg, which is already hidden while comparing (see mapContainerEl.hidden
// above), so nothing extra is needed to keep it out of compare mode.
//
// Drag only moves a shape on screen (a transform layered on top of its
// true-position `d`); switching projection snaps every shape back to its
// true geographic position under the new projection instead of trying to
// carry the drag offset over — the offsets are cleared, not preserved.
// ============================================================
const TRUESIZE_PALETTE = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6", "#1abc9c", "#e67e22", "#95a5a6"];

const trueSizeToggleBtn = document.getElementById("truesize-toggle");
const trueSizePanel     = document.getElementById("truesize-panel");
const trueSizeInput     = document.getElementById("truesize-search-input");
const trueSizeResults   = document.getElementById("truesize-search-results");
const trueSizeListEl    = document.getElementById("truesize-selected-list");

let trueSizeOrder = []; // country names, in the order they were added
const trueSizeColors  = new Map(); // name -> color, assigned once at add time
const trueSizeOffsets = new Map(); // name -> {x, y} drag offset, on top of the true position
let trueSizeNextColorIndex = 0;

// See the compareToggleBtn note above — same guard, same reason.
if (trueSizeToggleBtn) {
  trueSizeToggleBtn.addEventListener("click", () => {
    trueSizePanel.hidden = !trueSizePanel.hidden;
    trueSizeToggleBtn.classList.toggle("active", !trueSizePanel.hidden);
    if (!trueSizePanel.hidden) trueSizeInput.focus();
  });
}

function hideTrueSizeResults() {
  trueSizeResults.hidden = true;
  trueSizeResults.innerHTML = "";
}

function addTrueSizeCountry(name) {
  if (trueSizeOrder.includes(name)) return;
  trueSizeOrder.push(name);
  trueSizeColors.set(name, TRUESIZE_PALETTE[trueSizeNextColorIndex % TRUESIZE_PALETTE.length]);
  trueSizeNextColorIndex++;
  renderTrueSizeList();
  renderTrueSizeShapes();
}

function removeTrueSizeCountry(name) {
  trueSizeOrder = trueSizeOrder.filter((n) => n !== name);
  trueSizeColors.delete(name);
  trueSizeOffsets.delete(name);
  renderTrueSizeList();
  renderTrueSizeShapes();
}

function renderTrueSizeList() {
  trueSizeListEl.innerHTML = "";
  trueSizeOrder.forEach((name) => {
    const li = document.createElement("li");

    const swatch = document.createElement("span");
    swatch.className = "truesize-swatch";
    swatch.style.background = trueSizeColors.get(name);

    const label = document.createElement("span");
    label.textContent = name;

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "✕";
    removeBtn.title = "Remove";
    removeBtn.addEventListener("click", () => removeTrueSizeCountry(name));

    li.append(swatch, label, removeBtn);
    trueSizeListEl.appendChild(li);
  });
}

const trueSizeDrag = d3.drag().on("drag", function (event, feature) {
  const name = feature.properties.name;
  const offset = trueSizeOffsets.get(name) || { x: 0, y: 0 };
  offset.x += event.dx;
  offset.y += event.dy;
  trueSizeOffsets.set(name, offset);
  d3.select(this).attr("transform", `translate(${offset.x},${offset.y})`);
});

// Redraws every selected shape at its true geographic position under the
// current projection, preserving each shape's drag offset (add/remove and
// other refresh call sites use this — only a projection switch clears
// offsets, see resetTrueSizeOnProjectionSwitch).
function renderTrueSizeShapes() {
  const projDef    = PROJECTIONS.find((p) => p.id === state.currentProjectionId);
  const projection = makeProjection(projDef, rotationFor(projDef));
  const pathFn     = d3.geoPath().projection(projection);

  const features = trueSizeOrder
    .map((name) => state.worldData.features.find((f) => f.properties.name === name))
    .filter(Boolean);

  const shapes = truesizeGroup
    .selectAll("path.truesize-shape")
    .data(features, (d) => d.properties.name);

  shapes.exit().remove();

  shapes
    .enter()
    .append("path")
    .attr("class", "truesize-shape")
    .call(trueSizeDrag)
    .merge(shapes)
    .attr("d", pathFn)
    .attr("fill", (d) => trueSizeColors.get(d.properties.name))
    .attr("stroke", (d) => trueSizeColors.get(d.properties.name))
    .attr("transform", (d) => {
      const offset = trueSizeOffsets.get(d.properties.name) || { x: 0, y: 0 };
      return `translate(${offset.x},${offset.y})`;
    });
}

export function resetTrueSizeOnProjectionSwitch() {
  if (trueSizeOrder.length === 0) return;
  trueSizeOffsets.clear();
  renderTrueSizeShapes();
}

// See the compareToggleBtn note above — same guard, same reason.
if (trueSizeInput) {
  trueSizeInput.addEventListener("input", () => {
    const query = trueSizeInput.value.trim().toLowerCase();
    if (!query || !state.worldData) {
      hideTrueSizeResults();
      return;
    }
    const matches = state.worldData.features
      .filter((f) => !trueSizeOrder.includes(f.properties.name))
      .filter((f) => f.properties.name.toLowerCase().includes(query))
      .sort((a, b) => {
        const nameA = a.properties.name.toLowerCase();
        const nameB = b.properties.name.toLowerCase();
        return nameA.indexOf(query) - nameB.indexOf(query);
      })
      .slice(0, 8);

    trueSizeResults.innerHTML = "";
    matches.forEach((feature) => {
      const li = document.createElement("li");
      li.textContent = feature.properties.name;
      li.addEventListener("click", () => {
        addTrueSizeCountry(feature.properties.name);
        trueSizeInput.value = "";
        hideTrueSizeResults();
      });
      trueSizeResults.appendChild(li);
    });
    trueSizeResults.hidden = matches.length === 0;
  });

  trueSizeInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideTrueSizeResults();
  });
}

// ============================================================
// INIT — fetch GeoJSON then render
// ============================================================
async function init() {
  // Before anything renders: sidebar buttons, info card and view labels all
  // read their text through t().
  await loadLanguage("en");
  openHelpModal(); // after the language loads, or the modal would flash empty

  const [worldResponse, terrainResponse] = await Promise.all([
    fetch("/data/world.geojson"),
    fetch("/data/terrain.geojson"),
  ]);
  state.worldData = await worldResponse.json();
  state.terrainData = await terrainResponse.json();
  buildLightGeometry(state.worldData.features);
  buildLightGeometry(state.terrainData.features);

  const initialProj = PROJECTIONS.find((p) => p.id === state.currentProjectionId);
  buildSidebar();
  buildRecenterPanel();
  buildCompareProjectionOptions();
  renderMap(makeProjection(initialProj, rotationFor(initialProj)));
  updateInfo(initialProj);
  updateGlobeBackground();
  refreshTissot();
  refreshRecenterAvailability();
  refreshFlightPath();
}

init();

// ============================================================
// DEBUG HOOK
// Test scripts (perf harness, e2e smoke, render fingerprint) read app
// state through this single object instead of bare globals, so the
// upcoming ES-module split — which removes those globals — only has to
// keep this hook alive. Getters only: tests observe, they never steer.
// ============================================================
window.__app = {
  PROJECTIONS,
  RECENTER_PRESETS,
  mapGroup,
  terrainGroup,
  // Pure function of a projection definition, so exposing it lets the render
  // fingerprint pin fitProjection's numbers without steering the app.
  makeProjection,
  get currentProjectionId() { return state.currentProjectionId; },
  get currentRecenterRotate() { return state.currentRecenterRotate; },
  get currentRecenterFlip() { return state.currentRecenterFlip; },
  get isAnimating() { return state.isAnimating; },
  get currentZoomTransform() { return currentZoomTransform; },
};
