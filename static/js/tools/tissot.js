import { getProjection } from "../data/projections.js";
import { compareMode, comparePanels } from "./index.js";
import { state } from "../core/state.js";
import { fitProjection, makeProjection } from "../core/projection.js";
import { rotationFor } from "../core/recenter.js";
import { tissotGroup } from "../core/scene.js";
import { TISSOT_RADIUS, TISSOT_STEP } from "../config.js";

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

  const currentDef = getProjection(state.currentProjectionId);
  renderTissot(tissotGroup, makeProjection(currentDef, rotationFor(currentDef)));

  if (compareMode && comparePanels) {
    comparePanels.forEach((panel) => {
      const projDef = getProjection(panel.projId);
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
