// Module entry point: imports every module in the order their code used
// to run in the single map.js, then starts the app (init).
import "./data/projections.js";
import "./core/scene.js";
import "./core/state.js";
import "./core/render.js";
import "./core/projection.js";
import "./core/geometry.js";
import "./core/animation.js";
import "./core/transition.js";
import "./ui/info-card.js";
import "./ui/compare-card.js";
import "./ui/sidebar.js";
import "./data/views.js";
import "./core/recenter.js";
import "./core/camera.js";
import "./core/selection.js";
import "./ui/mobile-sidebar.js";
import "./tools/tissot.js";
import "./tools/reference-lines.js";
import "./ui/welcome-modal.js";
import "./ui/theme.js";
import "./debug.js";
import { getProjection } from "./data/projections.js";
import { buildCompareProjectionOptions } from "./ui/compare-card.js";
import { buildLightGeometry } from "./core/geometry.js";
import { buildRecenterPanel, buildSidebar } from "./ui/sidebar.js";
import { state } from "./core/state.js";
import { loadLanguage } from "./i18n.js";
import { makeProjection } from "./core/projection.js";
import { openHelpModal } from "./ui/welcome-modal.js";
import { refreshFlightPath, refreshTissot } from "./tools/index.js";
import { refreshRecenterAvailability, rotationFor } from "./core/recenter.js";
import { renderMap, updateGlobeBackground } from "./core/render.js";
import { updateInfo } from "./ui/info-card.js";
import { TERRAIN_GEOJSON_URL, WORLD_GEOJSON_URL } from "./config.js";

// ============================================================
// INIT — fetch GeoJSON then render
// ============================================================
async function init() {
  // Before anything renders: sidebar buttons, info card and view labels all
  // read their text through t().
  await loadLanguage("en");
  openHelpModal(); // after the language loads, or the modal would flash empty

  const [worldResponse, terrainResponse] = await Promise.all([
    fetch(WORLD_GEOJSON_URL),
    fetch(TERRAIN_GEOJSON_URL),
  ]);
  state.worldData = await worldResponse.json();
  state.terrainData = await terrainResponse.json();
  buildLightGeometry(state.worldData.features);
  buildLightGeometry(state.terrainData.features);

  const initialProj = getProjection(state.currentProjectionId);
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
