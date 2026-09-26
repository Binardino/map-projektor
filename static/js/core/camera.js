import { PROJECTIONS } from "../data/projections.js";
import { state } from "./state.js";
import { flightPathMode, refreshCompareHighlight, refreshFlightPath, refreshReferenceLines, refreshTissot } from "../map.js";
import { makeProjection } from "./projection.js";
import { renderMap } from "./render.js";
import { rotationFor } from "./recenter.js";
import { svg, zoomLayer } from "./scene.js";

// ============================================================
// CAMERA PAN & ZOOM
//
// Free pan (drag) and zoom (wheel/pinch) on zoomLayer via d3.zoom,
// independent of any country selection — the camera stays wherever
// the user leaves it across projection switches, recenter presets,
// and compare-mode panel changes. Replaces the old model where zoom
// was only possible while a country was selected and locked to it.
// ============================================================
export const MAIN_ZOOM_SCALE_EXTENT = [1, 40];
export const LIGHT_ZOOM_MAX_SCALE   = 3; // gentle zoom-in cap when centering on a clicked/searched country

export let currentZoomTransform = d3.zoomIdentity;

export const zoom = d3.zoom()
  .scaleExtent(MAIN_ZOOM_SCALE_EXTENT)
  // On the orthographic globe, drag/touch-pan is handed off to globeDrag
  // below instead (see GLOBE ROTATION). The wheel is handled by the smooth
  // wheel zoom further down, not by d3.zoom.
  .filter((event) => {
    if (event.type === "wheel") return false;
    if (state.currentProjectionId === "orthographic") return false;
    return !event.ctrlKey && !event.button;
  })
  .on("zoom", (event) => {
    currentZoomTransform = event.transform;
    zoomLayer.attr("transform", currentZoomTransform);
  });

svg.call(zoom);

// Panning stops once the map's edge reaches the window's edge, so the map
// can never be dragged off-screen. The limit is the projected sphere itself:
// on an axis where the zoomed map is smaller than the window, d3.zoom keeps
// it centred instead, and on Mercator the poles (which overflow the initial
// frame on purpose, see fitProjection) stay reachable. Set on every
// renderMap since the outline depends on the projection; the recenter
// rotation and the upside-down flip (a mirror about the viewport's centre)
// don't change its bounding box.
export function updatePanExtent(projection) {
  zoom.translateExtent(d3.geoPath().projection(projection).bounds({ type: "Sphere" }));
}

const CAMERA_IDENTITY_EPSILON = 0.001;

function isCameraAtIdentity() {
  return (
    Math.abs(currentZoomTransform.k - 1) < CAMERA_IDENTITY_EPSILON &&
    Math.abs(currentZoomTransform.x) < CAMERA_IDENTITY_EPSILON &&
    Math.abs(currentZoomTransform.y) < CAMERA_IDENTITY_EPSILON
  );
}

// Animates the camera back to the default centered view. Returns a promise
// so callers (e.g. transitionTo) can await it before proceeding; resolves
// immediately if the camera is already at rest.
export function resetCamera(duration = 500) {
  if (isCameraAtIdentity()) return Promise.resolve();
  return svg.transition().duration(duration).call(zoom.transform, d3.zoomIdentity).end();
}

// d3.zoom applies each wheel notch in a single frame: a mouse wheel's
// notch is a ~15% scale jump, which read as a choppy zoom (measured in
// scripts/perf_transitions.py). Each notch instead eases towards a target
// scale; notches that arrive mid-ease add to that target, so spinning the
// wheel fast still zooms as far as before, and the point under the cursor
// stays put. Trackpad pinches arrive as ctrl+wheel and take the same path.
// Ignored during morphs: interrupting resetCamera's transition would
// reject the promise transitionTo awaits.
const WHEEL_ZOOM_MS = 150;
let wheelTargetScale = null;
let wheelZoomId = 0;

svg.on("wheel.smooth", (event) => {
  event.preventDefault();
  if (state.isAnimating) return;
  // Same notch-to-scale rate as d3.zoom's default wheelDelta.
  const delta = -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002) * (event.ctrlKey ? 10 : 1);
  const [kMin, kMax] = MAIN_ZOOM_SCALE_EXTENT;
  wheelTargetScale = Math.max(kMin, Math.min(kMax, (wheelTargetScale ?? currentZoomTransform.k) * 2 ** delta));
  const id = ++wheelZoomId;
  svg.transition()
    .duration(WHEEL_ZOOM_MS)
    .ease(d3.easeCubicOut)
    .call(zoom.scaleTo, wheelTargetScale, d3.pointer(event, svg.node()))
    // A newer notch interrupting this one keeps the target it built on;
    // anything else (end, zoom buttons, camera reset) starts afresh.
    .on("end interrupt", () => { if (id === wheelZoomId) wheelTargetScale = null; });
}, { passive: false });

const zoomInBtn  = document.getElementById("zoom-in-btn");
const zoomOutBtn = document.getElementById("zoom-out-btn");
const ZOOM_STEP  = 1.3; // multiplicative factor per click, same feel as one mouse-wheel notch

zoomInBtn.addEventListener("click", () => {
  svg.transition().duration(200).call(zoom.scaleBy, ZOOM_STEP);
});

zoomOutBtn.addEventListener("click", () => {
  svg.transition().duration(200).call(zoom.scaleBy, 1 / ZOOM_STEP);
});

// ============================================================
// GLOBE ROTATION (orthographic only)
//
// A screen-space pan wouldn't reveal the far side of the sphere, so on the
// orthographic globe, dragging instead rotates it — reusing the same
// currentRecenterRotate state the recenter presets use (see RECENTER
// PRESETS below), so a preset and a manual drag compose the same way and
// both reset together on a projection switch. zoom.filter above excludes
// drag/touch-pan on this projection so the two behaviors don't fight over
// the pointer.
// ============================================================
const GLOBE_DRAG_SENSITIVITY = 0.35; // degrees rotated per pixel dragged

const globeDrag = d3.drag()
  .filter((event) => state.currentProjectionId === "orthographic" && !state.isAnimating && !flightPathMode)
  .on("start", () => {
    document.querySelectorAll(".recenter-btn").forEach((b) => b.classList.remove("active"));
  })
  .on("drag", (event) => {
    const projDef = PROJECTIONS.find((p) => p.id === state.currentProjectionId);
    const [lambda, phi] = rotationFor(projDef) || [0, 0, 0];
    const newLambda = lambda + event.dx * GLOBE_DRAG_SENSITIVITY;
    state.currentRecenterTilt = [newLambda, Math.max(-90, Math.min(90, phi - event.dy * GLOBE_DRAG_SENSITIVITY)), 0];
    // Flat maps keep the dragged longitude but never the tilt (see TILTED_PROJECTIONS)
    state.currentRecenterRotate = [newLambda, 0, 0];
    renderMap(makeProjection(projDef, rotationFor(projDef)));
    refreshTissot();
    refreshReferenceLines();
    refreshFlightPath();
    refreshCompareHighlight();
  });

svg.call(globeDrag);
