import { DEGREES, blendProjection } from "./projection.js";
import { GLOBE } from "../data/projections.js";
import { lightOf } from "./geometry.js";
import { renderGlobeSphere, updateTerrainPaths } from "./render.js";
import { rotationFor } from "./recenter.js";
import { t } from "../i18n.js";
import { TIMING } from "../config.js";
import { emit } from "../state.js";

// Drives one blend from alpha 0 → 1, optionally morphing the clip circle.
//
// fromSphereProj/toSphereProj (only passed for clip-angle-animated blends,
// which always pair orthographic with something else — see clipAngle in data/projections.js)
// are each endpoint's own plain, unblended projection. They're there
// because tracing the special {type: "Sphere"} whole-globe marker THROUGH
// the live blended+clip-animating projection collapses to a degenerate
// sliver at some intermediate t — a d3 clip-circle edge case specific to
// blending orthographic's raw function (only valid within 90° of center)
// against one that isn't. Countries and terrain render fine through the
// same blend; only this synthetic outline breaks. Sidestepped entirely by
// crossfading between the two endpoints' own (always well-behaved) static
// sphere shapes instead of animating one continuously-blended shape.
function animateBlend(view, projection, duration, clipFrom = null, clipTo = null, fromSphereProj = null, toSphereProj = null, rotationAt = null) {
  const pathFn    = d3.geoPath().projection(projection);
  const countries = view.layers.countries.selectAll("path.country");

  const crossfade = clipFrom !== null && fromSphereProj && toSphereProj;
  if (crossfade) {
    const spherePath = d3.geoPath();
    view.layers.sphere.attr("d", spherePath.projection(fromSphereProj)({ type: "Sphere" })).style("opacity", 1);
    view.sphereFade.attr("d", spherePath.projection(toSphereProj)({ type: "Sphere" })).style("opacity", 0);
  }

  return new Promise((resolve) => {
    const timer = d3.timer((elapsed) => {
      const t = d3.easeCubicInOut(Math.min(1, elapsed / duration));
      projection.alpha(t);
      if (rotationAt) projection.rotate(rotationAt(t));
      if (clipFrom !== null) {
        // A near-180° clip circle only punches a tiny hole at the antipode;
        // it never cuts along the back meridian, so a country straddling it
        // (Canada in the China view, India in the Pacific one) kept its
        // vertices on both edges of the flat map and drew a band across it.
        // Cutting at the antimeridian first restores the flat maps' seam.
        // Only past 90°: up to the hemisphere the circle hides the back seam
        // anyway, and at exactly 90° the two clips combined turn every
        // country inside out (the whole globe flashed land colour on the
        // one frame the polar route leaves on screen between fold and spin).
        const radius = (clipFrom + (clipTo - clipFrom) * t) / DEGREES;
        projection.preclip(radius > Math.PI / 2
          ? (stream) => d3.geoClipAntimeridian(d3.geoClipCircle(radius)(stream))
          : d3.geoClipCircle(radius));
      }
      countries.attr("d", (d) => pathFn(lightOf(d)) || "");
      if (crossfade) {
        view.layers.sphere.style("opacity", 1 - t);
        view.sphereFade.style("opacity", t);
      } else {
        renderGlobeSphere(view, projection);
      }
      if (view.layers.terrain) updateTerrainPaths(view.layers.terrain, projection);
      emit("frame", { view, projection });
      if (elapsed >= duration) {
        timer.stop();
        if (crossfade) view.layers.sphere.style("opacity", null);
        resolve();
      }
    });
  });
}

function lerpRotation(from, to, t) {
  const a = from || [0, 0, 0];
  const b = to || [0, 0, 0];
  return [0, 1, 2].map((i) => (a[i] || 0) + ((b[i] || 0) - (a[i] || 0)) * t);
}

// Both endpoints take the active recenter view (see rotationFor): they're
// built unrotated and the blend wrapper carries the rotation, so clip
// circles stay centred on the view (see blendProjection) and the morph keeps
// the user's framing instead of snapping back to Europe. Between the tilted
// globe and a flat map the two rotations differ, so the wrapper eases from
// one to the other along with the shape.
export function animateTransition(view, fromDef, toDef, duration) {
  const rotFrom    = rotationFor(fromDef);
  const rotTo      = rotationFor(toDef);
  const projection = blendProjection(view.makeProjection(fromDef), view.makeProjection(toDef), rotFrom);
  const rotationAt = rotFrom === rotTo ? null : (t) => lerpRotation(rotFrom, rotTo, t);
  // The crossfade outlines are static endpoint shapes, so they carry the rotation themselves
  const fromProjection = view.makeProjection(fromDef, rotFrom);
  const toProjection   = view.makeProjection(toDef, rotTo);
  // The globe clips to the visible hemisphere (90°); everything else clips
  // at the antimeridian, which animateBlend adds on top of the circle.
  // Animating between the two makes back-hemisphere countries shrink
  // smoothly into the horizon instead of snapping in or out.
  const clipFrom = fromDef.clipAngle;
  const clipTo   = toDef.clipAngle;
  // Only azimuthal-hemisphere transitions need the circle clip; other
  // pairs keep D3's default antimeridian clipping untouched.
  if (clipFrom !== clipTo) return animateBlend(view, projection, duration, clipFrom, clipTo, fromProjection, toProjection, rotationAt);
  return animateBlend(view, projection, duration, null, null, null, null, rotationAt);
}

// ============================================================
// POLAR ROUTE — via the orthographic globe
//
// A polar view sits 90° of rotation away from every other
// projection. Blending directly would drag Antarctica's ring
// across the whole map (a disc cannot become an annulus that
// encircles everything without sweeping over it). Instead:
// fold the map onto the globe, spin the globe to/from the pole
// (a true projection every frame — always clean), then unfold
// into the polar azimuthal view.
// ============================================================
// Spins a real orthographic globe between two orientations.
function animateRotation(view, fromRot, toRot, duration) {
  const projection = d3.geoOrthographic().fitSize([view.width, view.height], { type: "Sphere" });
  const pathFn    = d3.geoPath().projection(projection);
  const countries = view.layers.countries.selectAll("path.country");

  return new Promise((resolve) => {
    const timer = d3.timer((elapsed) => {
      const t = d3.easeCubicInOut(Math.min(1, elapsed / duration));
      projection.rotate([
        fromRot[0] + (toRot[0] - fromRot[0]) * t,
        fromRot[1] + (toRot[1] - fromRot[1]) * t,
      ]);
      countries.attr("d", (d) => pathFn(lightOf(d)) || "");
      renderGlobeSphere(view, projection);
      if (view.layers.terrain) updateTerrainPaths(view.layers.terrain, projection);
      emit("frame", { view, projection });
      if (elapsed >= duration) {
        timer.stop();
        resolve();
      }
    });
  });
}

// Morphs between the orthographic globe and the flat azimuthal equidistant
// disc, both centred on the same pole. Endpoints are built unrotated and the
// blend wrapper carries the rotation, so the hemisphere clip stays centred
// on the pole while it opens (90° → 179°) or closes (179° → 90°).
function animatePolarUnfold(view, rotation, foldToGlobe, duration) {
  const globe = d3.geoOrthographic().fitSize([view.width, view.height], { type: "Sphere" });
  const disc  = d3.geoAzimuthalEquidistant().clipAngle(179)
    .fitSize([view.width, view.height], { type: "Sphere" });
  const projection = foldToGlobe
    ? blendProjection(disc, globe, rotation)
    : blendProjection(globe, disc, rotation);

  // Rotated clones purely for animateBlend's crossfade sphere shapes (see
  // its comment) — globe/disc above are deliberately built unrotated
  // (blendProjection's wrapper carries the rotation instead), but the
  // crossfade needs each endpoint's shape as it actually appears on
  // screen, rotation included.
  const globeAtRotation = d3.geoOrthographic().rotate(rotation).fitSize([view.width, view.height], { type: "Sphere" });
  const discAtRotation  = d3.geoAzimuthalEquidistant().clipAngle(179).rotate(rotation)
    .fitSize([view.width, view.height], { type: "Sphere" });

  return foldToGlobe
    ? animateBlend(view, projection, duration, 179, 90, discAtRotation, globeAtRotation)
    : animateBlend(view, projection, duration, 90, 179, globeAtRotation, discAtRotation);
}

export async function polarTransition(view, fromDef, toDef) {
  const orthoDef = GLOBE;
  const fromRot  = fromDef.polarRotation;
  const toRot    = toDef.polarRotation;

  // Fold: reach an orthographic globe at the starting orientation
  if (fromRot) {
    await animatePolarUnfold(view, fromRot, true, TIMING.polarFold);
  } else if (!fromDef.globe) {
    await animateTransition(view, fromDef, orthoDef, TIMING.polarFold);
  }

  // Spin between orientations (north↔south rolls through the equator); a
  // non-polar end sits on the globe at the active view's tilt.
  const globeRot = rotationFor(orthoDef) || [0, 0];
  await animateRotation(view, fromRot || globeRot, toRot || globeRot, TIMING.polarSpin);

  // Unfold: from the globe to the target
  if (toRot) {
    await animatePolarUnfold(view, toRot, false, TIMING.polarUnfold);
  } else if (!toDef.globe) {
    await animateTransition(view, orthoDef, toDef, TIMING.polarUnfold);
  }
}
