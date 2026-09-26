import { PROJECTIONS } from "./data/projections.js";
import { RECENTER_PRESETS } from "./data/views.js";
import { buildCompareProjectionOptions } from "./ui/compare-card.js";
import { buildLightGeometry } from "./core/geometry.js";
import { buildRecenterPanel, buildSidebar } from "./ui/sidebar.js";
import { state } from "./core/state.js";
import { currentZoomTransform } from "./core/camera.js";
import { loadLanguage } from "./i18n.js";
import { makeProjection } from "./core/projection.js";
import { mapGroup, terrainGroup } from "./core/scene.js";
import { openHelpModal } from "./ui/welcome-modal.js";
import { refreshFlightPath } from "./tools/flight-path.js";
import { refreshRecenterAvailability, rotationFor } from "./core/recenter.js";
import { refreshTissot } from "./tools/tissot.js";
import { renderMap, updateGlobeBackground } from "./core/render.js";
import { updateInfo } from "./ui/info-card.js";

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
