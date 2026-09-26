import { PROJECTIONS } from "./data/projections.js";
import { RECENTER_PRESETS } from "./data/views.js";
import { state } from "./core/state.js";
import { currentZoomTransform } from "./core/camera.js";
import { makeProjection } from "./core/projection.js";
import { mapGroup, terrainGroup } from "./core/scene.js";

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
