import { POLAR_ROTATION, animateTransition, polarTransition } from "./animation.js";
import { PROJECTIONS } from "../data/projections.js";
import { RECENTER_INCOMPATIBLE } from "../data/views.js";
import { applyRecenter, refreshRecenterAvailability, rotationFor } from "./recenter.js";
import { closeSidebar } from "../ui/mobile-sidebar.js";
import { state } from "./state.js";
import { hideCompareHighlight, refreshCompareHighlight } from "../ui/compare-card.js";
import { makeProjection } from "./projection.js";
import { refreshFlightPath } from "../tools/flight-path.js";
import { refreshReferenceLines } from "../tools/reference-lines.js";
import { refreshTissot } from "../tools/tissot.js";
import { renderMap, updateGlobeBackground } from "./render.js";
import { resetCamera } from "./camera.js";
import { resetTrueSizeOnProjectionSwitch } from "../map.js";
import { setActiveButton } from "../ui/sidebar.js";
import { updateInfo } from "../ui/info-card.js";

// ============================================================
// TRANSITION — morph source → target
// ============================================================
async function transitionTo(newProjId) {
  state.isAnimating = true;
  hideCompareHighlight();

  // Reset the free camera (pan/zoom on zoomLayer, see CAMERA PAN & ZOOM)
  // to the default centered view before starting the morph, so every
  // projection switch lands on that projection's own standard framing
  // instead of carrying over whatever pan/zoom the user left it at.
  await resetCamera();

  const fromDef = PROJECTIONS.find((p) => p.id === state.currentProjectionId);
  const toDef   = PROJECTIONS.find((p) => p.id === newProjId);

  if (POLAR_ROTATION[fromDef.id] || POLAR_ROTATION[toDef.id]) {
    await polarTransition(fromDef, toDef);
  } else {
    await animateTransition(fromDef, toDef, 1400);
  }

  // Final render with the true target projection (native clipping rules)
  renderMap(makeProjection(toDef, rotationFor(toDef)));

  state.currentProjectionId = newProjId;
  updateInfo(toDef);
  updateGlobeBackground();
  refreshTissot();
  refreshReferenceLines();
  refreshRecenterAvailability();
  refreshFlightPath();
  resetTrueSizeOnProjectionSwitch();
  refreshCompareHighlight();

  state.isAnimating = false;
}

// ============================================================
// SWITCH PROJECTION
// ============================================================
export async function switchProjection(newProjId) {
  if (state.isAnimating || newProjId === state.currentProjectionId) return;
  if (!PROJECTIONS.find((p) => p.id === newProjId)) return;
  closeSidebar(); // no-op on desktop; on mobile, reveals the map after picking
  setActiveButton(newProjId); // highlight immediately — don't wait for the ~1.4-2.3s morph to finish
  // The active view carries over to any compatible projection (transitionTo
  // morphs with its rotation). Albers/polar can't be recentred, so ease back
  // to Europe first — otherwise the morph would end on a snapped rotation.
  if (RECENTER_INCOMPATIBLE.has(newProjId) && (state.currentRecenterRotate || state.currentRecenterFlip)) {
    await applyRecenter("world");
  }
  transitionTo(newProjId);
}
