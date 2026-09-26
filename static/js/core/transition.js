import { animateTransition, polarTransition } from "./animation.js";
import { GLOBE, PROJECTIONS, getProjection } from "../data/projections.js";
import { applyRecenter, rotationFor } from "./recenter.js";
import { makeProjection } from "./projection.js";
import { renderMap, updateGlobeBackground } from "./render.js";
import { resetCamera } from "./camera.js";
import { TIMING } from "../config.js";
import { emit, getState, setState } from "../state.js";
import { runExclusive } from "./busy.js";

// ============================================================
// TRANSITION — morph source → target
// ============================================================
// Defaults to the orthographic globe — the "space view" reads better as a
// first impression than a flat map, per UX feedback. This module is the
// only writer of projectionId.
setState({ projectionId: GLOBE.id });

function transitionTo(newProjId) {
  return runExclusive(() => morphTo(newProjId));
}

async function morphTo(newProjId) {
  emit("view:changing");

  // Reset the free camera (pan/zoom on zoomLayer, see CAMERA PAN & ZOOM)
  // to the default centered view before starting the morph, so every
  // projection switch lands on that projection's own standard framing
  // instead of carrying over whatever pan/zoom the user left it at.
  await resetCamera();

  const fromDef = getProjection(getState().projectionId);
  const toDef   = getProjection(newProjId);

  if (fromDef.polarRotation || toDef.polarRotation) {
    await polarTransition(fromDef, toDef);
  } else {
    await animateTransition(fromDef, toDef, TIMING.projectionMorph);
  }

  // Final render with the true target projection (native clipping rules)
  renderMap(makeProjection(toDef, rotationFor(toDef)));

  setState({ projectionId: newProjId });
  updateGlobeBackground();
  emit("view:changed");
}

// ============================================================
// SWITCH PROJECTION
// ============================================================
export async function switchProjection(newProjId) {
  if (getState().busy || newProjId === getState().projectionId) return;
  if (!PROJECTIONS.some((p) => p.id === newProjId)) return;
  // Right away, not after the ~1.4-2.3s morph: the sidebar highlights the
  // pick, and on mobile the drawer closes to reveal the map.
  emit("projection:requested", newProjId);
  // The active view carries over to any compatible projection (transitionTo
  // morphs with its rotation). Albers/polar can't be recentred, so ease back
  // to Europe first — otherwise the morph would end on a snapped rotation.
  if (!getProjection(newProjId).recenterable && (getState().recenter.rotate || getState().recenter.flip)) {
    await applyRecenter("world");
  }
  transitionTo(newProjId);
}
