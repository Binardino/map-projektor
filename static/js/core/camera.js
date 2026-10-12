import { getProjection } from "../data/projections.js";
import { rotationFor, setViewRotation } from "./recenter.js";
import { mainView } from "./scene.js";
import { CAMERA_IDENTITY_EPSILON, GLOBE_DRAG_SENSITIVITY, MAIN_ZOOM_SCALE_EXTENT, TIMING, ZOOM_STEP } from "../config.js";
import { emit, getState } from "../state.js";

// ============================================================
// CAMERA PAN & ZOOM
//
// Free pan (drag) and zoom (wheel/pinch) through each view's own d3.zoom,
// independent of any country selection — the camera stays wherever
// the user leaves it across projection switches, recenter presets,
// and compare-mode panel changes. Replaces the old model where zoom
// was only possible while a country was selected and locked to it.
// ============================================================

// Everything below resetCamera wires the main map's controls (wheel, zoom
// buttons, globe drag); a secondary view keeps d3.zoom's plain behaviour.
const { svg, zoom } = mainView;

// On the orthographic globe, drag/touch-pan is handed off to globeDrag
// below instead (see GLOBE ROTATION). The wheel is handled by the smooth
// wheel zoom further down, not by d3.zoom.
zoom.filter((event) => {
  if (event.type === "wheel") return false;
  if (getProjection(getState().projectionId).globe) return false;
  return !event.ctrlKey && !event.button;
});

function isCameraAtIdentity({ transform }) {
  return (
    Math.abs(transform.k - 1) < CAMERA_IDENTITY_EPSILON &&
    Math.abs(transform.x) < CAMERA_IDENTITY_EPSILON &&
    Math.abs(transform.y) < CAMERA_IDENTITY_EPSILON
  );
}

// Animates the camera back to the default centered view. Returns a promise
// so callers (e.g. transitionTo) can await it before proceeding; resolves
// immediately if the camera is already at rest.
export function resetCamera(view, duration = TIMING.cameraReset) {
  if (isCameraAtIdentity(view)) return Promise.resolve();
  return view.svg.transition().duration(duration).call(view.zoom.transform, d3.zoomIdentity).end();
}

// d3.zoom applies each wheel notch in a single frame: a mouse wheel's
// notch is a ~15% scale jump, which read as a choppy zoom (measured in
// scripts/perf_transitions.py). Each notch instead eases towards a target
// scale; notches that arrive mid-ease add to that target, so spinning the
// wheel fast still zooms as far as before, and the point under the cursor
// stays put. Trackpad pinches arrive as ctrl+wheel and take the same path.
// Ignored during morphs: interrupting resetCamera's transition would
// reject the promise transitionTo awaits.
let wheelTargetScale = null;
let wheelZoomId = 0;

svg.on("wheel.smooth", (event) => {
  event.preventDefault();
  if (getState().busy) return;
  // Same notch-to-scale rate as d3.zoom's default wheelDelta.
  const delta = -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002) * (event.ctrlKey ? 10 : 1);
  const [kMin, kMax] = MAIN_ZOOM_SCALE_EXTENT;
  wheelTargetScale = Math.max(kMin, Math.min(kMax, (wheelTargetScale ?? mainView.transform.k) * 2 ** delta));
  const id = ++wheelZoomId;
  svg.transition()
    .duration(TIMING.wheelZoom)
    .ease(d3.easeCubicOut)
    .call(zoom.scaleTo, wheelTargetScale, d3.pointer(event, svg.node()))
    // A newer notch interrupting this one keeps the target it built on;
    // anything else (end, zoom buttons, camera reset) starts afresh.
    .on("end interrupt", () => { if (id === wheelZoomId) wheelTargetScale = null; });
}, { passive: false });

const zoomInBtn  = document.getElementById("zoom-in-btn");
const zoomOutBtn = document.getElementById("zoom-out-btn");

zoomInBtn.addEventListener("click", () => {
  svg.transition().duration(TIMING.zoomButton).call(zoom.scaleBy, ZOOM_STEP);
});

zoomOutBtn.addEventListener("click", () => {
  svg.transition().duration(TIMING.zoomButton).call(zoom.scaleBy, 1 / ZOOM_STEP);
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

const globeDrag = d3.drag()
  .filter((event) => getProjection(getState().projectionId).globe && !getState().busy && !getState().flightPathMode)
  .on("start", () => {
    setViewRotation(getState().recenter.rotate, getState().recenter.tilt); // detaches the preset button
  })
  .on("drag", (event) => {
    const projDef = getProjection(getState().projectionId);
    const [lambda, phi] = rotationFor(projDef) || [0, 0, 0];
    const newLambda = lambda + event.dx * GLOBE_DRAG_SENSITIVITY;
    const tilt = [newLambda, Math.max(-90, Math.min(90, phi - event.dy * GLOBE_DRAG_SENSITIVITY)), 0];
    // Flat maps keep the dragged longitude but never the tilt (see tilted in data/projections.js)
    setViewRotation([newLambda, 0, 0], tilt);
    mainView.setProjection(projDef, rotationFor(projDef)).render();
    emit("view:changed");
  });

svg.call(globeDrag);
