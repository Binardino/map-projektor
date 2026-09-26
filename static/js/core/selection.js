import { HEIGHT, WIDTH, mapGroup, svg } from "./scene.js";
import { zoom } from "./camera.js";
import { getProjection } from "../data/projections.js";
import { applySelectionToPanel, compareMode, comparePanels, flightPathMode, refreshReferenceLines, refreshTissot, setFlightPathMode } from "../tools/index.js";
import { state } from "./state.js";
import { makeProjection } from "./projection.js";
import { renderMap } from "./render.js";
import { resetRecenter, rotationFor } from "./recenter.js";
import { LIGHT_ZOOM_MAX_SCALE, TIMING } from "../config.js";

// ============================================================
// COUNTRY SELECTION
//
// Selecting a country (via a click on the map) highlights it and
// gently centers/zooms the camera on it — the user can then
// pan/zoom away freely, the selection doesn't lock the camera.
// ============================================================
export let selectedCountryName = null;

// Bounding-box fit for `feature` under `projDef`, capped to a gentle zoom
// level rather than tightly filling the viewport — recomputed fresh since
// it depends on whichever projection is currently on screen.
function computeCountryFit(feature, projDef) {
  const pathFn = d3.geoPath().projection(makeProjection(projDef, rotationFor(projDef)));
  const [[x0, y0], [x1, y1]] = pathFn.bounds(feature);
  const PADDING = 60;
  const scale = Math.min(
    (WIDTH - PADDING) / Math.max(x1 - x0, 1),
    (HEIGHT - PADDING) / Math.max(y1 - y0, 1),
    LIGHT_ZOOM_MAX_SCALE
  );
  return { scale, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

function selectCountry(feature) {
  if (!feature) return;

  if (flightPathMode) setFlightPathMode(false); // mutually exclusive, see FLIGHT PATH note

  // Mutually exclusive with recenter presets (see RECENTER PRESETS note):
  // the map must be re-rendered unrotated before we compute the bounds to
  // center on, since computeCountryFit's bbox math assumes the default
  // orientation.
  if (state.currentRecenterRotate) {
    resetRecenter();
    const projDef = getProjection(state.currentProjectionId);
    renderMap(makeProjection(projDef, rotationFor(projDef)));
    refreshTissot();
    refreshReferenceLines();
  }

  selectedCountryName = feature.properties.name;

  mapGroup
    .selectAll("path.country")
    .classed("selected", (d) => d.properties.name === selectedCountryName);

  const projDef = getProjection(state.currentProjectionId);
  const fit     = computeCountryFit(feature, projDef);
  const transform = d3.zoomIdentity
    .translate(WIDTH / 2, HEIGHT / 2)
    .scale(fit.scale)
    .translate(-fit.cx, -fit.cy);
  svg.transition().duration(TIMING.countryFocus).call(zoom.transform, transform);

  if (compareMode) comparePanels.forEach(applySelectionToPanel);
}

// Clears the highlight only — the camera stays exactly where the user left
// it, since pan/zoom is no longer tied to a selection.
export function clearSelection() {
  if (!selectedCountryName) return;
  selectedCountryName = null;

  mapGroup.selectAll("path.country").classed("selected", false);

  if (compareMode) comparePanels.forEach(applySelectionToPanel);
}
