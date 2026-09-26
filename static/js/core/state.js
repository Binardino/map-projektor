// ============================================================
// SHARED STATE — the app's mutable variables that more than one module
// writes. ES module imports are read-only bindings, so a `let` another
// module reassigns can't stay a plain export; they live on this one
// object instead (state.x = … works from anywhere). Temporary: PR 4
// replaces it with a proper store and events.
// ============================================================
import { RECENTER_PRESETS } from "../data/views.js";

export const state = {
  // Defaults to the orthographic globe — the "space view" reads better as a
  // first impression than a flat map, per UX feedback.
  currentProjectionId: "orthographic",
  isAnimating: false,
  worldData: null,
  terrainData: null,
  currentRecenterRotate: null,
  currentRecenterTilt: RECENTER_PRESETS[0].tilt,
  currentRecenterFlip: false,
};
