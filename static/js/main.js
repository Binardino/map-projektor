// Module entry point: imports every module in the order their code used
// to run in the single map.js, then starts the app (init).
import "./data/projections.js";
import "./core/scene.js";
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
import "./tools/index.js";
import "./ui/welcome-modal.js";
import "./ui/onboarding.js";
import "./ui/theme.js";
import "./debug.js";
import { getProjection } from "./data/projections.js";
import { buildLightGeometry } from "./core/geometry.js";
import { setLanguage } from "./i18n.js";
import { makeProjection } from "./core/projection.js";
import { openHelpModal } from "./ui/welcome-modal.js";
import { rotationFor } from "./core/recenter.js";
import { renderMap, updateGlobeBackground } from "./core/render.js";
import { loadGeodata, terrainData, worldData } from "./data/geodata.js";
import { emit, getState } from "./state.js";

// ============================================================
// INIT — fetch GeoJSON then render
// ============================================================
async function init() {
  // Before anything renders: loading the language also builds the sidebar,
  // view list, compare options and info card (their "language:changed"
  // subscribers), which all read their text through t().
  await setLanguage("en");
  openHelpModal(); // after the language loads, or the modal would flash empty

  await loadGeodata();
  buildLightGeometry(worldData.features);
  buildLightGeometry(terrainData.features);

  const initialProj = getProjection(getState().projectionId);
  renderMap(makeProjection(initialProj, rotationFor(initialProj)));
  updateGlobeBackground();
  emit("view:changed"); // first draw of the overlays that follow the view
}

init();
