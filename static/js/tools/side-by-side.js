import { LIGHT_ZOOM_MAX_SCALE, MAIN_ZOOM_SCALE_EXTENT } from "../core/camera.js";
import { PROJECTIONS, getProjection, projectionName } from "../data/projections.js";
import { state } from "../core/state.js";
import { fitProjection } from "../core/projection.js";
import { flightPathGroup, globeSphere, mapGroup, oceanRect, svg, tissotGroup, zoomLayer } from "../core/scene.js";
import { handleFlightPathClick } from "./flight-path.js";
import { infoVisible, setInfoVisible } from "../ui/info-card.js";
import { refreshTissot } from "./tissot.js";
import { renderGlobeSphere } from "../core/render.js";
import { selectedCountryName } from "../core/selection.js";

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
    const projDef = getProjection(panel.projId);
    const projection = fitProjection(projDef, projDef.d3fn(), panel.width, panel.height);
    handleFlightPathClick(event, svg.node(), panel.zoomTransform, projection);
  });

  panel.render = () => {
    const projDef     = getProjection(panel.projId);
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
  const projDef = getProjection(panel.projId);
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
