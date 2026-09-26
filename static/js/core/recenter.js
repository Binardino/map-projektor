import { HEIGHT, WIDTH, globeSphere, mapGroup, referenceGroup, terrainGroup, tissotGroup, worldGroup } from "./scene.js";
import { PROJECTIONS } from "../data/projections.js";
import { RECENTER_INCOMPATIBLE, RECENTER_PRESETS, TILTED_PROJECTIONS } from "../data/views.js";
import { clearSelection } from "./selection.js";
import { state } from "./state.js";
import { fitProjection, makeProjection } from "./projection.js";
import { flightPathMode, setFlightPathMode } from "../map.js";
import { hideCompareHighlight, refreshCompareHighlight } from "../ui/compare-card.js";
import { lightOf } from "./geometry.js";
import { referenceVisible, refreshReferenceLines, updateReferencePaths } from "../tools/reference-lines.js";
import { refreshTissot, tissotVisible, updateTissotPaths } from "../tools/tissot.js";
import { renderGlobeSphere, renderMap, updateTerrainPaths } from "./render.js";
import { t } from "../i18n.js";

// The rotation the active view gives projDef — every render of the main
// map goes through this so the globe and the flat maps agree on the view.
export function rotationFor(projDef) {
  if (TILTED_PROJECTIONS.has(projDef.id)) return state.currentRecenterTilt || state.currentRecenterRotate;
  return state.currentRecenterRotate;
}

// Turns the map over like a coin about the equator: scaleY follows
// cos(angle) as the angle eases 0 → 180°, so the map thins towards the
// equator, goes edge-on, then widens back mirrored — no slide, no blank
// frames. Scaling about the axis (rather than about the SVG origin, which
// the previous fold did) is what keeps the equator pinned in place:
// y' = axis + s·(y − axis) = s·y + axis·(1 − s).
//
// The axis is HEIGHT / 2 because every recentrable view keeps the globe
// untilted (rotate[1] = 0) and fitProjection centres the sphere
// vertically, so the equator sits on the viewport's centreline for all
// of them (checked for every projection × preset). A tilted preset would
// need projection([lon, 0])[1] here instead. At s = -1 this is exactly
// translate(0, HEIGHT) scale(1, -1), the resting mirrored state.
//
// onEdgeOn runs once when the map is edge-on (invisible), which is where
// the caller swaps the sphere rotation so the jump never shows.
//
// Every world-space layer (terrain/tissot/flight-path/true-size/the
// compare highlight, not just countries) needs to flip together, or
// they'd end up floating over the wrong regions of the now-flipped map.
// They're all children of worldGroup (see its declaration) specifically
// so ONE transition here moves everything at once, instead of seven
// separate D3 transitions each interpolating and writing the same value.
//
// .style() (CSS transform property) rather than .attr() (SVG transform
// attribute): browsers can promote a CSS-transform animation to its own
// GPU compositing layer and interpolate it there for free, whereas an
// attribute-driven transform forces a full repaint of everything inside
// the group on the main thread every frame. With ~170 country paths (each
// using vector-effect:non-scaling-stroke, which itself isn't cheap to
// recompute) plus terrain, that repaint cost was the actual source of
// the dropped frames during this flip.
function animateRecenterFlip(flip, onEdgeOn, duration = 900) {
  const axis = HEIGHT / 2;
  const sign = flip ? 1 : -1; // start upright when flipping in, mirrored when flipping out
  let swapped = false;

  return new Promise((resolve) => {
    const timer = d3.timer((elapsed) => {
      const t = d3.easeCubicInOut(Math.min(1, elapsed / duration));
      const s = sign * Math.cos(Math.PI * t);
      if (!swapped && t >= 0.5) {
        swapped = true;
        onEdgeOn();
      }
      worldGroup.style("transform", `translate(0px, ${axis * (1 - s)}px) scale(1, ${s})`);
      if (elapsed >= duration) {
        timer.stop();
        resolve();
      }
    });
  });
}

// Spins the current projection's own sphere from the active rotation to the
// preset's, so recentering reads as a camera pan instead of a hard cut.
// Mirrors animateRotation's per-frame rotate() + repath loop, but against
// the live projection type instead of a fixed orthographic globe.
function animateRecenterRotation(projDef, fromRot, toRot, duration) {
  const from = fromRot || [0, 0, 0];
  const to   = toRot || [0, 0, 0];
  const projection = fitProjection(projDef, projDef.d3fn(), WIDTH, HEIGHT);
  const pathFn      = d3.geoPath().projection(projection);
  const countries   = mapGroup.selectAll("path.country");

  return new Promise((resolve) => {
    const timer = d3.timer((elapsed) => {
      const t = d3.easeCubicInOut(Math.min(1, elapsed / duration));
      projection.rotate([
        from[0] + (to[0] - from[0]) * t,
        from[1] + (to[1] - from[1]) * t,
        (from[2] || 0) + ((to[2] || 0) - (from[2] || 0)) * t,
      ]);
      countries.attr("d", (d) => pathFn(lightOf(d)) || "");
      // Same per-frame refresh as animateBlend/animateRotation — terrain
      // (and the sphere outline/grid, if visible) used to only repaint at
      // the very end of a recenter, so they sat frozen throughout the
      // rotation while countries alone animated.
      renderGlobeSphere(globeSphere, projection);
      updateTerrainPaths(terrainGroup, projection);
      if (tissotVisible) updateTissotPaths(tissotGroup, projection);
      if (referenceVisible) updateReferencePaths(referenceGroup, projection);
      if (elapsed >= duration) {
        timer.stop();
        resolve();
      }
    });
  });
}

export async function applyRecenter(presetId) {
  if (state.isAnimating || RECENTER_INCOMPATIBLE.has(state.currentProjectionId)) return;

  if (flightPathMode) setFlightPathMode(false); // mutually exclusive, see FLIGHT PATH note

  const preset = RECENTER_PRESETS.find((p) => p.id === presetId);
  const currentDefForRot = PROJECTIONS.find((p) => p.id === state.currentProjectionId);
  const fromRot = rotationFor(currentDefForRot);

  document.querySelectorAll(".recenter-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.presetId === presetId);
  });

  clearSelection(); // mutually exclusive with the country-zoom selection, see note above

  state.isAnimating = true;
  hideCompareHighlight();
  const currentDef = PROJECTIONS.find((p) => p.id === state.currentProjectionId);
  const wantsFlip = !!preset.flipVertical;

  if (wantsFlip !== state.currentRecenterFlip) {
    // Entering or leaving the South America (upside-down) mirror: doing the
    // usual longitude rotation sweep here would spin the sphere WHILE also
    // flipping it, reading as a distorted diagonal spin rather than a clean
    // mirror. Instead turn the map over about the equator and swap the
    // rotation instantly at the edge-on midpoint, where it's invisible.
    await animateRecenterFlip(wantsFlip, () => {
      state.currentRecenterRotate = preset.rotate;
      state.currentRecenterTilt = preset.tilt || null;
      renderMap(makeProjection(currentDef, rotationFor(currentDef)));
      refreshReferenceLines();
    });
  } else {
    const toRot = TILTED_PROJECTIONS.has(currentDef.id) ? preset.tilt || preset.rotate : preset.rotate;
    await animateRecenterRotation(currentDef, fromRot, toRot, 900);
    state.currentRecenterRotate = preset.rotate;
    state.currentRecenterTilt = preset.tilt || null;
    renderMap(makeProjection(currentDef, rotationFor(currentDef))); // final render with native clipping
  }
  state.currentRecenterFlip = wantsFlip;

  state.isAnimating = false;
  refreshTissot();
  refreshReferenceLines();
  refreshCompareHighlight();
}

export function resetRecenter() {
  state.currentRecenterRotate = null;
  state.currentRecenterTilt = RECENTER_PRESETS[0].tilt;
  state.currentRecenterFlip = false;
  // Cleared synchronously (no transition): if a projection switch is about
  // to run, the morph must not inherit a leftover flip transform on the
  // group it repaints into.
  worldGroup.style("transform", null);
  document.querySelectorAll(".recenter-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.presetId === "world");
  });
}

export function refreshRecenterAvailability() {
  document.getElementById("recenter-list").classList.toggle("disabled-list", RECENTER_INCOMPATIBLE.has(state.currentProjectionId));
}
