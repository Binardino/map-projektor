import { PROJECTIONS } from "./data/projections.js";
import { buildCompareProjectionOptions } from "./ui/compare-card.js";
import { buildLightGeometry } from "./core/geometry.js";
import { buildRecenterPanel, buildSidebar } from "./ui/sidebar.js";
import { state } from "./core/state.js";
import { loadLanguage } from "./i18n.js";
import { makeProjection } from "./core/projection.js";
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
