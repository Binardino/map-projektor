import { mainView } from "./scene.js";
import { getProjection } from "../data/projections.js";
import { resetRecenter, rotationFor } from "./recenter.js";
import { LIGHT_ZOOM_MAX_SCALE, TIMING } from "../config.js";
import { worldData } from "../data/geodata.js";
import { emit, getState } from "../state.js";

// ============================================================
// COUNTRY SELECTION
//
// Selecting a country (via a click on the map) highlights it and
// gently centers/zooms the camera on it — the user can then
// pan/zoom away freely, the selection doesn't lock the camera.
// One selection for the whole app: a secondary view mirrors it with
// applySelection.
// ============================================================
export let selectedCountryName = null;

// Bounding-box fit for `feature` in `view`, capped to a gentle zoom level
// rather than tightly filling the viewport — recomputed fresh since it
// depends on whichever projection the view currently shows.
function computeCountryFit(view, feature) {
  const pathFn = d3.geoPath().projection(view.projection());
  const [[x0, y0], [x1, y1]] = pathFn.bounds(feature);
  const PADDING = 60;
  const scale = Math.min(
    (view.width - PADDING) / Math.max(x1 - x0, 1),
    (view.height - PADDING) / Math.max(y1 - y0, 1),
    LIGHT_ZOOM_MAX_SCALE
  );
  return { scale, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

// Shows the current selection in `view`: the highlight, and a gentle
// pan/zoom onto the country. The view's camera stays free afterwards.
export function applySelection(view) {
  view.layers.countries
    .selectAll("path.country")
    .classed("selected", (d) => d.properties.name === selectedCountryName);

  if (!selectedCountryName) return;

  const feature = worldData.features.find((f) => f.properties.name === selectedCountryName);
  const fit     = computeCountryFit(view, feature);
  const transform = d3.zoomIdentity
    .translate(view.width / 2, view.height / 2)
    .scale(fit.scale)
    .translate(-fit.cx, -fit.cy);
  view.svg.transition().duration(TIMING.countryFocus).call(view.zoom.transform, transform);
}

function selectCountry(feature) {
  if (!feature) return;

  emit("pointer:reset"); // a selection ends any pointer mode (flight path)

  // Mutually exclusive with recenter presets (see RECENTER PRESETS note):
  // the map must be re-rendered unrotated before we compute the bounds to
  // center on, since computeCountryFit's bbox math assumes the default
  // orientation.
  if (getState().recenter.rotate) {
    resetRecenter();
    const projDef = getProjection(getState().projectionId);
    mainView.setProjection(projDef, rotationFor(projDef)).render();
    emit("view:changed");
  }

  selectedCountryName = feature.properties.name;
  applySelection(mainView);

  emit("selection:changed");
}

// Clears the highlight only — the camera stays exactly where the user left
// it, since pan/zoom is no longer tied to a selection.
export function clearSelection() {
  if (!selectedCountryName) return;
  selectedCountryName = null;

  mainView.layers.countries.selectAll("path.country").classed("selected", false);

  emit("selection:changed");
}
