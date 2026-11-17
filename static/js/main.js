// Module entry point: imports every module in the order their code used
// to run in the single map.js, then starts the app (init).
import "./data/projections.js";
import "./core/scene.js";
import "./core/render.js";
import "./core/projection.js";
import "./core/geometry.js";
import "./core/animation.js";
import "./core/transition.js";
import "./core/share-link.js";
import "./ui/info-card.js";
import "./ui/compare-card.js";
import "./ui/sidebar.js";
import "./data/views.js";
import "./core/recenter.js";
import "./core/camera.js";
import "./core/resize.js";
import "./core/selection.js";
import "./ui/mobile-sidebar.js";
import "./tools/index.js";
import "./ui/welcome-modal.js";
import "./ui/language-picker.js";
import "./ui/onboarding.js";
import "./ui/theme.js";
import "./debug.js";
import { getProjection } from "./data/projections.js";
import { buildLightGeometry } from "./core/geometry.js";
import { preferredLanguage, setLanguage } from "./i18n.js";
import { openHelpModal } from "./ui/welcome-modal.js";
import { refreshFlip, rotationFor, startOnView } from "./core/recenter.js";
import { startOnProjection } from "./core/transition.js";
import { parseLink } from "./core/share-link.js";
import { mainView } from "./core/scene.js";
import { loadGeodata, terrainData, worldData } from "./data/geodata.js";
import { emit, getState } from "./state.js";

// ============================================================
// INIT — fetch GeoJSON then render
// ============================================================
async function init() {
  // First of all: the sidebar and the info card, built just below, show
  // whichever projection the store holds.
  const link = parseLink(location.hash);
  if (link.projectionId) startOnProjection(link.projectionId);
  if (link.preset) startOnView(link.preset);

  // Before anything renders: loading the language also builds the sidebar,
  // view list, compare options and info card (their "language:changed"
  // subscribers), which all read their text through t().
  await setLanguage(preferredLanguage());
  // Someone opening a shared link came to see that map: the welcome pitch
  // would cover it, and the tour it leads to would morph it away. The tour
  // stays one click away on the toolbar's ? button.
  // After the language loads, or the modal would flash empty.
  if (!link.projectionId && !link.preset) openHelpModal();

  await loadGeodata();
  buildLightGeometry(worldData.features);
  buildLightGeometry(terrainData.features);

  const initialProj = getProjection(getState().projectionId);
  mainView.setProjection(initialProj, rotationFor(initialProj)).render();
  refreshFlip(mainView);
  emit("view:changed"); // first draw of the overlays that follow the view
}

init();
