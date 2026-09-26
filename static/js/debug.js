import { PROJECTIONS } from "./data/projections.js";
import { RECENTER_PRESETS } from "./data/views.js";
import { currentZoomTransform } from "./core/camera.js";
import { makeProjection } from "./core/projection.js";
import { mapGroup, terrainGroup } from "./core/scene.js";
import { emit, getState } from "./state.js";

// ============================================================
// DEBUG HOOK
// Test scripts (perf harness, e2e smoke, render fingerprint) read app
// state through this single object instead of bare globals, so the
// upcoming ES-module split — which removes those globals — only has to
// keep this hook alive. Getters, plus rebuildUI (a pure re-render):
// tests observe, they never steer.
// ============================================================
window.__app = {
  PROJECTIONS,
  RECENTER_PRESETS,
  mapGroup,
  terrainGroup,
  // Pure function of a projection definition, so exposing it lets the render
  // fingerprint pin fitProjection's numbers without steering the app.
  makeProjection,
  get currentProjectionId() { return getState().projectionId; },
  get currentRecenterRotate() { return getState().recenter.rotate; },
  get currentRecenterFlip() { return getState().recenter.flip; },
  get isAnimating() { return getState().busy; },
  get currentZoomTransform() { return currentZoomTransform; },
  // Re-renders every text-bearing UI part as a language change would, so a
  // test can check the builders are idempotent.
  rebuildUI() { emit("language:changed"); },
};
