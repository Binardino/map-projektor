import { LIGHT_ZOOM_MAX_SCALE, MAIN_ZOOM_SCALE_EXTENT, currentZoomTransform } from "./core/camera.js";
import { PROJECTIONS, projectionName } from "./data/projections.js";
import { RECENTER_PRESETS } from "./data/views.js";
import { applyRecenter, refreshRecenterAvailability, resetRecenter, rotationFor } from "./core/recenter.js";
import { buildLightGeometry } from "./core/geometry.js";
import { clearSelection, selectedCountryName } from "./core/selection.js";
import { compareHighlightGroup, flightPathGroup, globeSphere, mapGroup, oceanRect, referenceGroup, svg, terrainGroup, tissotGroup, truesizeGroup, zoomLayer } from "./core/scene.js";
import { state } from "./core/state.js";
import { fitProjection, makeProjection } from "./core/projection.js";
import { infoVisible, setInfoVisible, updateInfo } from "./ui/info-card.js";
import { loadLanguage, t } from "./i18n.js";
import { renderGlobeSphere, renderMap, updateGlobeBackground } from "./core/render.js";
import { switchProjection } from "./core/transition.js";

// ============================================================
// COMPARE CARD
//
// Pick a country (searchable, alphabetical) and it's redrawn on top of
// the map as a red highlight, under its own projection — independent of
// whatever projection the main map/sidebar has active. Lets you see how
// the same country's shape/size changes between two projections at a
// glance: the base map (unchanged) vs. the highlighted overlay.
// ============================================================
const compareCardToggleBtn    = document.getElementById("compare-toggle-btn");
const compareCardCloseBtn     = document.getElementById("compare-card-close");
const compareCardEl           = document.getElementById("compare-card");
const compareProjectionSelect = document.getElementById("compare-projection-select");
const compareCountryInput     = document.getElementById("compare-country-input");
const compareCountryResults   = document.getElementById("compare-country-results");
const compareCountryList      = document.getElementById("compare-country-list");

// Called from init() once the language is loaded (names come from t()); it
// keeps the HTML placeholder option (empty value) and replaces the rest, so a
// language switch can call it again.
function buildCompareProjectionOptions() {
  compareProjectionSelect.querySelectorAll("option[value]:not([value=''])").forEach((o) => o.remove());
  PROJECTIONS.forEach((proj) => {
    const option = document.createElement("option");
    option.value = proj.id;
    option.textContent = projectionName(proj);
    compareProjectionSelect.appendChild(option);
  });
}

let compareCardVisible     = false;
let compareCountryNames    = null; // populated lazily once worldData is ready — full alphabetical list
let compareProjectionId    = null; // null until a country is picked, then defaults to currentProjectionId

// Countries being compared, in pick order. Each entry:
// { name, color, visible, shift: pins its anchor on the map's copy of the
//   country, offset: how far the user has dragged it from there }.
const compareCountries = [];
const COMPARE_MAX = 5;
// Saturated hues that stay apart from each other and from the map's own
// colours in both themes: land (pink / navy), ocean (light / mid blue),
// terrain (tan, sage), the reference lines (atlas red).
const COMPARE_COLORS = ["#fa6048", "#8e44ad", "#1fa35c", "#f2b705", "#00a6a6"];

// Overseas territories that Natural Earth keeps as separate features but
// that belong in the country's comparison. France's overseas departments
// (Guiana, Réunion, the Antilles, Mayotte) are already part of "France";
// these are its collectivities and TAAF. Other countries' territories
// (Greenland, Puerto Rico, the Falklands) stay separate, pickable on their own.
const COMPARE_TERRITORIES = {
  France: [
    "Fr. Polynesia", "New Caledonia", "Fr. S. Antarctic Lands", "Wallis and Futuna Is.",
    "St. Pierre and Miquelon", "St-Martin", "St-Barthélemy",
  ],
};

// The shape drawn for a compared country: the feature plus its territories.
function compareShape(feature) {
  const territories = (COMPARE_TERRITORIES[feature.properties.name] || [])
    .map((name) => state.worldData.features.find((f) => f.properties.name === name))
    .filter(Boolean);
  if (!territories.length) return feature;
  return { type: "FeatureCollection", features: [feature, ...territories] };
}

// The point of the country the overlay is pinned on: the centre of its
// largest polygon, not of the whole feature — overseas parts (French
// Guiana for France, Alaska for the USA) would otherwise drag the anchor
// off the mainland people are actually comparing.
function compareAnchor(feature) {
  if (feature.geometry.type !== "MultiPolygon") return d3.geoCentroid(feature);
  const largest = d3.greatest(feature.geometry.coordinates, (rings) => d3.geoArea({ type: "Polygon", coordinates: rings }));
  return d3.geoCentroid({ type: "Polygon", coordinates: largest });
}

// Redraws (or clears) every visible compared country under compareProjectionId,
// each shifted so its anchor sits on the same country in the map on screen:
// each projection places a country at its own screen position, so drawn
// as-is, France under Equirectangular landed on Chad in a Gall-Peters map.
// Uses the active view's rotation so both shapes share an orientation.
// Shares the main map's zoomLayer, so it pans/zooms together with it.
export function refreshCompareHighlight() {
  compareHighlightGroup.selectAll("*").remove();
  compareHighlightGroup.style("display", null);
  if (!state.worldData) return;

  const mapDef      = PROJECTIONS.find((p) => p.id === state.currentProjectionId);
  const compareDef  = PROJECTIONS.find((p) => p.id === compareProjectionId) || mapDef;
  const mapProj     = makeProjection(mapDef, rotationFor(mapDef));
  const compareProj = makeProjection(compareDef, rotationFor(compareDef));
  const comparePath = d3.geoPath().projection(compareProj);
  const [rl, rp]    = mapProj.rotate();

  compareCountries.filter((entry) => entry.visible).forEach((entry) => {
    const feature = state.worldData.features.find((f) => f.properties.name === entry.name);
    if (!feature) return;
    const anchor = compareAnchor(feature);
    // A projection returns a point even for the globe's far side, which
    // would pin the overlay on a country the user can't see.
    if (state.currentProjectionId === "orthographic" && d3.geoDistance(anchor, [-rl, -rp]) > Math.PI / 2) return;
    const [mx, my] = mapProj(anchor);
    const [cx, cy] = compareProj(anchor);
    entry.shift = [mx - cx, my - cy];

    const d = comparePath(compareShape(feature));
    const overlay = compareHighlightGroup.append("g")
      .datum(entry)
      .attr("class", "compare-overlay")
      .attr("transform", compareOverlayTransform(entry))
      .call(compareDrag);
    overlay.append("path").attr("class", "compare-hit").attr("d", d);
    overlay.append("path").attr("class", "compare-highlight").attr("d", d)
      .style("fill", entry.color)
      .style("stroke", entry.color);
  });
}

function compareOverlayTransform(entry) {
  return `translate(${entry.shift[0] + entry.offset[0]},${entry.shift[1] + entry.offset[1]})`;
}

function resetCompareOffsets() {
  compareCountries.forEach((entry) => { entry.offset = [0, 0]; });
}

// Grabbing the overlay moves it; d3.drag stops the pointer-down from
// reaching d3.zoom and globeDrag, so a drag anywhere else still pans the
// map (or turns the globe), and the wheel still zooms over it. dx/dy come
// in the overlay's parent coordinates, which already undo the camera zoom
// and the upside-down flip, so the shape stays under the cursor.
// Each country moves on its own; the one being dragged is raised so it
// passes over the others.
const compareDrag = d3.drag()
  .on("start", function () { d3.select(this).classed("dragging", true).raise(); })
  .on("drag", function (event, entry) {
    entry.offset = [entry.offset[0] + event.dx, entry.offset[1] + event.dy];
    d3.select(this).attr("transform", compareOverlayTransform(entry));
  })
  .on("end", function () { d3.select(this).classed("dragging", false); });

// The overlay is pinned to the map's projection, so it's stale for the
// whole morph or spin — hidden until the matching refresh at the end.
// A drag only holds until the next projection or view change, which puts
// the overlay back on the country (the anchor is what's being compared).
export function hideCompareHighlight() {
  compareHighlightGroup.style("display", "none");
  resetCompareOffsets();
}

// Rebuilds the picked-country rows and locks the search field once the
// list is full, saying why in its placeholder.
function renderCompareList() {
  compareCountryList.innerHTML = "";
  compareCountries.forEach((entry) => {
    const li = document.createElement("li");
    li.classList.toggle("hidden-country", !entry.visible);

    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = entry.visible;
    checkbox.setAttribute("aria-label", t("compare.showCountry", { name: entry.name }));
    checkbox.addEventListener("change", () => {
      entry.visible = checkbox.checked;
      renderCompareList();
      refreshCompareHighlight();
    });
    const swatch = document.createElement("span");
    swatch.className = "compare-swatch";
    swatch.style.background = entry.color;
    const name = document.createElement("span");
    name.className = "compare-country-name";
    name.textContent = entry.name;
    label.append(checkbox, swatch, name);

    const removeBtn = document.createElement("button");
    removeBtn.className = "floating-card-close";
    removeBtn.textContent = "✕";
    removeBtn.setAttribute("aria-label", t("compare.removeCountry", { name: entry.name }));
    removeBtn.addEventListener("click", () => {
      compareCountries.splice(compareCountries.indexOf(entry), 1);
      renderCompareList();
      refreshCompareHighlight();
    });

    li.append(label, removeBtn);
    compareCountryList.appendChild(li);
  });
  compareCountryList.hidden = compareCountries.length === 0;

  const full = compareCountries.length >= COMPARE_MAX;
  compareCountryInput.disabled = full;
  compareCountryInput.placeholder = t(full ? "compare.limitReached" : "compare.countryPlaceholder");
}

function hideCompareCountryResults() {
  compareCountryResults.hidden = true;
  compareCountryResults.innerHTML = "";
}

function showCompareCountryResults(names) {
  compareCountryResults.innerHTML = "";
  names.forEach((name) => {
    const li = document.createElement("li");
    li.textContent = name;
    li.addEventListener("click", () => selectCompareCountry(name));
    compareCountryResults.appendChild(li);
  });
  compareCountryResults.hidden = names.length === 0;
}

function selectCompareCountry(name) {
  compareCountryInput.value = "";
  hideCompareCountryResults();
  if (compareCountries.length >= COMPARE_MAX || compareCountries.some((entry) => entry.name === name)) return;
  // First colour no listed country is using, so removing one frees its colour
  const color = COMPARE_COLORS.find((c) => !compareCountries.some((entry) => entry.color === c));
  compareCountries.push({ name, color, visible: true, shift: [0, 0], offset: [0, 0] });
  renderCompareList();

  // First pick since the card opened (or since it was last cleared):
  // default the projection to whatever the main map is currently showing.
  if (compareProjectionId === null) {
    compareProjectionId = state.currentProjectionId;
    compareProjectionSelect.value = state.currentProjectionId;
  }
  refreshCompareHighlight();
}

compareCountryInput.addEventListener("input", () => {
  const query = compareCountryInput.value.trim().toLowerCase();
  if (!compareCountryNames) return;
  const matches = query
    ? compareCountryNames.filter((name) => name.toLowerCase().includes(query))
    : compareCountryNames;
  showCompareCountryResults(matches.slice(0, 8));
});

compareCountryInput.addEventListener("focus", () => {
  if (compareCountryNames) showCompareCountryResults(compareCountryNames.slice(0, 8));
});

compareCountryInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideCompareCountryResults();
});

compareProjectionSelect.addEventListener("change", () => {
  compareProjectionId = compareProjectionSelect.value;
  resetCompareOffsets();
  refreshCompareHighlight();
});

function resetCompareSelection() {
  compareCountries.length = 0;
  compareProjectionId = null;
  compareCountryInput.value = "";
  compareProjectionSelect.value = "";
  renderCompareList();
  hideCompareCountryResults();
  refreshCompareHighlight();
}

export function closeCompareCard() {
  compareCardVisible = false;
  compareCardEl.hidden = true;
  compareCardToggleBtn.classList.remove("active");
  compareCardToggleBtn.setAttribute("aria-pressed", "false");
  resetCompareSelection();
}

function openCompareCard() {
  compareCardVisible = true;
  compareCardEl.hidden = false;
  compareCardToggleBtn.classList.add("active");
  compareCardToggleBtn.setAttribute("aria-pressed", "true");

  // Country names depend on the geodata fetch in init() — populate the
  // alphabetical list once it's available instead of duplicating it here.
  if (state.worldData && !compareCountryNames) {
    compareCountryNames = [...new Set(state.worldData.features.map((f) => f.properties.name))].sort();
  }

  // Only one toolbar popover at a time — mirrors the info-card guard above.
  if (infoVisible) setInfoVisible(false);
}

compareCardToggleBtn.addEventListener("click", () => {
  if (compareCardVisible) closeCompareCard();
  else openCompareCard();
});

compareCardCloseBtn.addEventListener("click", closeCompareCard);

// ============================================================
// SIDEBAR — built dynamically from PROJECTIONS
// ============================================================
function buildSidebar() {
  const nav = document.getElementById("projection-list");
  let lastFamily = null;

  PROJECTIONS.forEach((proj) => {
    // PROJECTIONS is grouped contiguously by family (see its reorder
    // commit) — a family header goes up front, once per group, instead
    // of repeating the family as a caption on every single button.
    if (proj.family !== lastFamily) {
      const header = document.createElement("p");
      header.className = "proj-family-header";
      header.textContent = t(`family.${proj.family.toLowerCase()}`);
      nav.appendChild(header);
      lastFamily = proj.family;
    }

    const btn = document.createElement("button");
    btn.className      = "sidebar-btn proj-btn";
    btn.id             = `btn-${proj.id}`;
    btn.dataset.projId = proj.id;
    btn.textContent    = projectionName(proj);
    btn.addEventListener("click", () => switchProjection(proj.id));
    nav.appendChild(btn);
  });

  setActiveButton(state.currentProjectionId);
}

export function setActiveButton(projId) {
  document.querySelectorAll(".proj-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.projId === projId);
  });
}

function buildRecenterPanel() {
  const nav = document.getElementById("recenter-list");
  RECENTER_PRESETS.forEach((preset) => {
    const btn = document.createElement("button");
    btn.className = "sidebar-btn recenter-btn" + (preset.id === "world" ? " active" : "");
    btn.dataset.presetId = preset.id;
    btn.title = t(`view.${preset.id}.description`);
    btn.textContent = t(`view.${preset.id}.name`);
    btn.addEventListener("click", () => applyRecenter(preset.id));
    nav.appendChild(btn);
  });
}

// ============================================================
// SIDE-BY-SIDE COMPARISON MODE
//
// Two independent panels, each with its own projection dropdown
// and its own D3 projection/render pipeline. Switching a panel's
// projection is instant — no morph animation — to keep two
// independent animation timelines out of scope for now. Country
// selection (the search UI above) is shared and applies to both
// panels at once, since comparing one country's distortion across
// two projections is the point of this mode.
// ============================================================
const compareToggleBtn = document.getElementById("compare-toggle");
const mapContainerEl   = document.getElementById("map-container");
const compareContainer = document.getElementById("compare-container");
const projectionListEl = document.getElementById("projection-list");

export let compareMode = false;
export let comparePanels = null; // built lazily on first toggle-on, once panel sizes are known

function buildComparePanel(panelEl, initialProjId) {
  const select = panelEl.querySelector(".compare-select");
  PROJECTIONS.forEach((proj) => {
    const option = document.createElement("option");
    option.value = proj.id;
    option.textContent = projectionName(proj);
    select.appendChild(option);
  });
  select.value = initialProjId;

  const width  = panelEl.clientWidth;
  const height = panelEl.querySelector(".compare-svg").clientHeight;

  const svg = d3
    .select(panelEl.querySelector(".compare-svg"))
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const panelOceanRect = svg.append("rect").attr("class", "ocean").attr("width", width).attr("height", height);
  const zoomLayer = svg.append("g").attr("class", "viewport");
  const panelGlobeSphere = zoomLayer.append("path").attr("class", "globe-sphere");
  const panel = {
    projId: initialProjId,
    oceanRect: panelOceanRect,
    globeSphere: panelGlobeSphere,
    mapGroup: zoomLayer.append("g").attr("class", "countries"),
    tissotGroup: zoomLayer.append("g").attr("class", "tissot-layer"),
    flightPathGroup: zoomLayer.append("g").attr("class", "flightpath-layer"),
    svg,
    width,
    height,
    zoomTransform: d3.zoomIdentity,
  };

  // Same free pan/zoom as the main view, independent per panel.
  panel.zoom = d3.zoom()
    .scaleExtent(MAIN_ZOOM_SCALE_EXTENT)
    .on("zoom", (event) => {
      panel.zoomTransform = event.transform;
      zoomLayer.attr("transform", event.transform);
    });
  svg.call(panel.zoom);

  // Same click-to-place-A/B as the main view (see FLIGHT PATH), using this
  // panel's own projection and zoom transform to invert the click.
  svg.node().addEventListener("click", (event) => {
    const projDef = PROJECTIONS.find((p) => p.id === panel.projId);
    const projection = fitProjection(projDef, projDef.d3fn(), panel.width, panel.height);
    handleFlightPathClick(event, svg.node(), panel.zoomTransform, projection);
  });

  panel.render = () => {
    const projDef     = PROJECTIONS.find((p) => p.id === panel.projId);
    const projection  = fitProjection(projDef, projDef.d3fn(), panel.width, panel.height);
    const pathFn       = d3.geoPath().projection(projection);
    const paths = panel.mapGroup
      .selectAll("path.country")
      .data(state.worldData.features, (d) => d.properties.name);
    paths.enter().append("path").attr("class", "country").attr("d", pathFn);
    paths.attr("d", pathFn);
    const isGlobe = panel.projId === "orthographic";
    renderGlobeSphere(panel.globeSphere, projection);
    panel.globeSphere.classed("active", isGlobe);
  };
  panel.render();

  select.addEventListener("change", () => {
    panel.projId = select.value;
    panel.render();
    applySelectionToPanel(panel);
    refreshTissot();
  });

  return panel;
}

// Mirrors the shared search selection (highlight + gentle centering zoom)
// onto one panel. The panel's own camera stays free afterward, same as the
// main view — clearing the selection only removes the highlight.
export function applySelectionToPanel(panel) {
  panel.mapGroup
    .selectAll("path.country")
    .classed("selected", (d) => d.properties.name === selectedCountryName);

  if (!selectedCountryName) return;

  const feature = state.worldData.features.find((f) => f.properties.name === selectedCountryName);
  const projDef = PROJECTIONS.find((p) => p.id === panel.projId);
  const pathFn  = d3.geoPath().projection(fitProjection(projDef, projDef.d3fn(), panel.width, panel.height));
  const [[x0, y0], [x1, y1]] = pathFn.bounds(feature);

  const PADDING = 40;
  const scale = Math.min(
    (panel.width - PADDING) / Math.max(x1 - x0, 1),
    (panel.height - PADDING) / Math.max(y1 - y0, 1),
    LIGHT_ZOOM_MAX_SCALE
  );
  const transform = d3.zoomIdentity
    .translate(panel.width / 2, panel.height / 2)
    .scale(scale)
    .translate(-(x0 + x1) / 2, -(y0 + y1) / 2);

  panel.svg.transition().duration(600).call(panel.zoom.transform, transform);
}

// compareToggleBtn currently has no sidebar UI (see remove(ui) commit) — the
// listener is guarded so the rest of the script still loads; wire a new
// trigger to it whenever the tools UI is rebuilt.
if (compareToggleBtn) {
  compareToggleBtn.addEventListener("click", () => {
    compareMode = !compareMode;
    compareToggleBtn.classList.toggle("active", compareMode);
    projectionListEl.classList.toggle("disabled-list", compareMode);
    document.getElementById("recenter-list").classList.toggle("disabled-list", compareMode);
    mapContainerEl.hidden   = compareMode;
    compareContainer.hidden = !compareMode;

    // The info card takes real estate the two compare panels need — force
    // it closed on entering compare mode; leaving compare mode doesn't
    // reopen it, same as any other time the "i" icon hasn't been clicked.
    if (compareMode && infoVisible) setInfoVisible(false);

    if (!compareMode) return;

    if (!comparePanels) {
      const panelEls = document.querySelectorAll(".compare-panel");
      const rightDefaultId = PROJECTIONS.some((p) => p.id === "gallPeters") ? "gallPeters" : PROJECTIONS[1].id;
      comparePanels = [
        buildComparePanel(panelEls[0], state.currentProjectionId),
        buildComparePanel(panelEls[1], rightDefaultId),
      ];
    } else {
      comparePanels.forEach((p) => p.render());
    }
    comparePanels.forEach(applySelectionToPanel);
    refreshTissot();
  });
}

// ============================================================
// MOBILE SIDEBAR TOGGLE
// The sidebar becomes an off-canvas drawer under the mobile
// breakpoint (see the media query in style.css); this button and
// backdrop only have a visual effect there — desktop layout is
// untouched since #sidebar-toggle stays display:none above 768px.
// ============================================================
const sidebarToggleBtn = document.getElementById("sidebar-toggle");
const sidebarBackdrop  = document.getElementById("sidebar-backdrop");
const sidebarEl        = document.getElementById("sidebar");

export function closeSidebar() {
  sidebarEl.classList.remove("open");
  sidebarBackdrop.hidden = true;
}

sidebarToggleBtn.addEventListener("click", () => {
  const willOpen = !sidebarEl.classList.contains("open");
  sidebarEl.classList.toggle("open", willOpen);
  sidebarBackdrop.hidden = !willOpen;
});

sidebarBackdrop.addEventListener("click", closeSidebar);

// ============================================================
// TISSOT'S INDICATRIX OVERLAY
//
// A grid of identically-sized geographic circles, projected like
// any other geometry. Each circle becomes an ellipse whose shape
// and size reveal the projection's local distortion — the
// standard cartography tool for comparing projections objectively.
// Toggled on demand; recomputed on projection switch and (if
// active) mirrored onto both comparison panels.
// ============================================================
const tissotToggleBtn = document.getElementById("grid-toggle-btn");

const TISSOT_STEP   = 30; // degrees between grid points
const TISSOT_RADIUS = 4;  // degrees — the geographic circle radius

const tissotPoints = [];
for (let lat = -90 + TISSOT_STEP; lat <= 90 - TISSOT_STEP; lat += TISSOT_STEP) {
  for (let lon = -180; lon < 180; lon += TISSOT_STEP) {
    tissotPoints.push([lon, lat]);
  }
}

export let tissotVisible = false;

// Isolated ellipses don't read as "a grid" on their own — the graticule
// (meridian/parallel lines, same 30° step as the circle spacing) gives
// the eye a reference frame, same as any textbook Tissot illustration.
const tissotGraticule = d3.geoGraticule().step([TISSOT_STEP, TISSOT_STEP]);

function renderTissot(group, projection) {
  const pathFn = d3.geoPath().projection(projection);

  const grid = group.selectAll("path.tissot-graticule").data([tissotGraticule()]);
  grid.enter().append("path").attr("class", "tissot-graticule").merge(grid).attr("d", pathFn);

  const circles = group.selectAll("path.tissot").data(tissotPoints);
  circles
    .enter()
    .append("path")
    .attr("class", "tissot")
    .merge(circles)
    .attr("d", (d) => pathFn(d3.geoCircle().center(d).radius(TISSOT_RADIUS)()));
  circles.exit().remove();
}

// Same idea as updateTerrainPaths: re-paths the already-mounted graticule
// and circles without re-running renderTissot's data join every frame.
export function updateTissotPaths(group, projection) {
  const path = d3.geoPath().projection(projection);
  group.selectAll("path.tissot-graticule").attr("d", path);
  group.selectAll("path.tissot").attr("d", (d) => path(d3.geoCircle().center(d).radius(TISSOT_RADIUS)()));
}

function clearTissot(group) {
  group.selectAll("path.tissot, path.tissot-graticule").remove();
}

// Re-renders (or clears) the overlay on the single map and, if active,
// on both comparison panels — called after any projection change.
export function refreshTissot() {
  if (!tissotVisible) {
    clearTissot(tissotGroup);
    if (compareMode && comparePanels) comparePanels.forEach((p) => clearTissot(p.tissotGroup));
    return;
  }

  const currentDef = PROJECTIONS.find((p) => p.id === state.currentProjectionId);
  renderTissot(tissotGroup, makeProjection(currentDef, rotationFor(currentDef)));

  if (compareMode && comparePanels) {
    comparePanels.forEach((panel) => {
      const projDef = PROJECTIONS.find((p) => p.id === panel.projId);
      renderTissot(panel.tissotGroup, fitProjection(projDef, projDef.d3fn(), panel.width, panel.height));
    });
  }
}

// Now wired to the right-side toolbar's grid icon (see map-tools in
// index.html) instead of the removed sidebar tools panel.
if (tissotToggleBtn) {
  tissotToggleBtn.addEventListener("click", () => {
    tissotVisible = !tissotVisible;
    tissotToggleBtn.classList.toggle("active", tissotVisible);
    tissotToggleBtn.setAttribute("aria-pressed", String(tissotVisible));
    refreshTissot();
  });
}

// ============================================================
// REFERENCE LINES
//
// The named parallels (equator, tropics, polar circles) plus a
// meridian every 15° — one per hour of Earth's rotation, the usual
// atlas spacing — with the equator and Greenwich drawn heavier as
// the two origins. Main view only, like the other overlays that
// live in worldGroup (so they follow recentring and the flip).
// ============================================================
const TROPIC_LAT       = 23.44; // Earth's axial tilt
const POLAR_CIRCLE_LAT = 90 - TROPIC_LAT;
const MERIDIAN_STEP    = 15;

// A parallel is a small circle, not a great circle: two far-apart
// vertices would be joined by the shortest arc between them, which
// bows towards the pole. Dense vertices make the line follow the
// latitude instead.
function parallel(lat) {
  return d3.range(-180, 180 + 1, 2).map((lon) => [lon, lat]);
}

// Through the equator rather than pole to pole in one segment: the two
// poles are antipodal, so the great arc between them is undefined.
function meridian(lon) {
  return [[lon, -90], [lon, 0], [lon, 90]];
}

const REFERENCE_LINES = [
  { kind: "major", coordinates: [parallel(0), meridian(0)] },
  { kind: "parallel", coordinates: [TROPIC_LAT, -TROPIC_LAT, POLAR_CIRCLE_LAT, -POLAR_CIRCLE_LAT].map(parallel) },
  {
    kind: "meridian",
    coordinates: d3.range(-180 + MERIDIAN_STEP, 180, MERIDIAN_STEP).filter((lon) => lon !== 0).map(meridian),
  },
].map(({ kind, coordinates }) => ({ kind, geometry: { type: "MultiLineString", coordinates } }));

function renderReferenceLines(group, projection) {
  const path = d3.geoPath().projection(projection);
  group
    .selectAll("path.reference-line")
    .data(REFERENCE_LINES)
    .join("path")
    .attr("class", (d) => `reference-line reference-${d.kind}`)
    .attr("d", (d) => path(d.geometry));
}

// Per-frame variant for the animations: re-paths without the data join.
export function updateReferencePaths(group, projection) {
  const path = d3.geoPath().projection(projection);
  group.selectAll("path.reference-line").attr("d", (d) => path(d.geometry));
}

export let referenceVisible = false;
const referenceToggleBtn = document.getElementById("reference-toggle-btn");

// Called wherever the main view's projection or rotation settles, next to
// refreshTissot — the lines must be re-projected, not just re-shown.
export function refreshReferenceLines() {
  if (!referenceVisible) {
    referenceGroup.selectAll("path.reference-line").remove();
    return;
  }
  const currentDef = PROJECTIONS.find((p) => p.id === state.currentProjectionId);
  renderReferenceLines(referenceGroup, makeProjection(currentDef, rotationFor(currentDef)));
}

referenceToggleBtn.addEventListener("click", () => {
  referenceVisible = !referenceVisible;
  referenceToggleBtn.classList.toggle("active", referenceVisible);
  referenceToggleBtn.setAttribute("aria-pressed", String(referenceVisible));
  refreshReferenceLines();
});

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
function handleFlightPathClick(event, svgNode = svg.node(), zoomTransform = currentZoomTransform, projection = makeProjection(
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
// WELCOME MODAL
//
// One modal, two parts: a short pitch (why flat maps lie), then a
// "how it works" pointer to each control. Opens on every launch —
// there is no "seen" flag and no manual re-open trigger.
// ============================================================

const helpModalBackdrop = document.getElementById("help-modal-backdrop");
const helpModalCloseBtn = document.getElementById("help-modal-close");

function openHelpModal() {
  helpModalBackdrop.hidden = false;
}

function closeHelpModal() {
  helpModalBackdrop.hidden = true;
}

helpModalCloseBtn.addEventListener("click", closeHelpModal);

helpModalBackdrop.addEventListener("click", (event) => {
  if (event.target === helpModalBackdrop) closeHelpModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !helpModalBackdrop.hidden) closeHelpModal();
});


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
// THEME SWITCHER
// Persists the chosen theme in localStorage so it survives page
// reloads and stays constant across projection switches. The
// toolbar's icon (see map-tools) is the only control for this now —
// the sidebar used to have its own checkbox too, dropped as a
// duplicate once the toolbar icon existed.
// ============================================================
const THEME_STORAGE_KEY = "mapProjektorTheme";

const themeToggleBtn = document.getElementById("theme-toggle-btn");

// Unlike the grid/compare/info tool icons, this one is a plain on/off
// switch, never shown as "selected" (no .active class) — see the Figma
// spec's note that light/dark has no selected state, just two positions.
function applyTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  themeToggleBtn.setAttribute("aria-pressed", String(theme === "dark"));
}

const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
if (savedTheme !== null) {
  applyTheme(savedTheme);
}

themeToggleBtn.addEventListener("click", () => {
  const theme = document.body.getAttribute("data-theme") === "dark" ? "" : "dark";
  applyTheme(theme);
  localStorage.setItem(THEME_STORAGE_KEY, theme);
});

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
