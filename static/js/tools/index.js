// ============================================================
// TOOLS — the one module core/ and main.js reach the optional tools through.
//
// The distortion grid and the reference lines have toolbar buttons, so they
// load with the app. Side-by-side comparison, flight path and true size lost
// their buttons in the redesign: they are kept (isolated, not deleted) but
// not loaded at all, and core gets inert stand-ins under the same names —
// the values their real state can never leave while no button turns them on.
// To bring one back: give it a button, then replace its stand-ins below with
// `export { … } from "./<tool>.js";`.
// Temporary shape: PR 4 replaces these direct calls with events.
// ============================================================
export { tissotVisible, refreshTissot, updateTissotPaths } from "./tissot.js";
export { referenceVisible, refreshReferenceLines, updateReferencePaths } from "./reference-lines.js";

// side-by-side.js — compare mode is never on
export const compareMode = false;
export const comparePanels = null;
export function applySelectionToPanel() {}

// flight-path.js — flight path mode is never on, so there is no route to redraw
export const flightPathMode = false;
export function setFlightPathMode() {}
export function refreshFlightPath() {}

// true-size.js — no shape was ever added, so there is nothing to snap back
export function resetTrueSizeOnProjectionSwitch() {}
