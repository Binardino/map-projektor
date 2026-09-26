import { HEIGHT, WIDTH } from "./scene.js";
import { t } from "../i18n.js";

// ============================================================
// PROJECTION FACTORY
// fitSize scales and centres the projection to fill the viewport.
// rotationOverride (optional [lambda, phi, gamma]) recenters the sphere
// before fitting — used by the recenter presets below. Overrides any
// rotate() the projection's own d3fn already set (e.g. the polar views),
// which is why presets are disabled for those (see recenterable in data/projections.js).
//
// Mercator is a special case: its y-coordinate diverges near the poles,
// so even bounded at the sphere's outline its natural fitted aspect ratio
// is close to square — much taller relative to its width than this app's
// wide map viewport. fitSize would then fit to the viewport's height and
// leave large empty margins on the sides (reported as "Mercator looks too
// small"/"whitespace on both sides"). Real-world Mercator world maps fit
// to width instead, so we do the same: fit to width and vertically center
// the initial framing, rather than shrinking the whole map to fit the
// height too. Deliberately not clipped to the viewport — the polar regions
// (Greenland, northern Russia, Antarctica) extend past the initial frame
// but stay reachable by panning the free camera (see CAMERA PAN & ZOOM)
// instead of being permanently cropped away. Shared by makeProjection
// below and by the comparison panels, which fit independently to their
// own size.
// ============================================================
export function fitProjection(projDef, projection, width, height) {
  if (projDef.fit === "width") {
    projection.fitWidth(width, { type: "Sphere" });
    const [[, y0], [, y1]] = d3.geoPath().projection(projection).bounds({ type: "Sphere" });
    const verticalOverflow = (y1 - y0) - height;
    const [tx, ty] = projection.translate();
    projection.translate([tx, ty - verticalOverflow / 2]);
    return projection;
  }
  return projection.fitSize([width, height], { type: "Sphere" });
}

export function makeProjection(projDef, rotationOverride = null) {
  const projection = projDef.d3fn();
  if (rotationOverride) projection.rotate(rotationOverride);
  return fitProjection(projDef, projection, WIDTH, HEIGHT);
}

// ============================================================
// ANIMATION — projection blending
//
// Interpolating SVG path strings breaks whenever clipping changes
// the vertex count between two projections (Antarctica cut at the
// pole in Mercator, the giant arc in Albers, the hidden hemisphere
// in Orthographic) — countries froze then snapped. Instead we build
// a hybrid projection whose output is the linear blend of the two
// fitted projections, and reproject every country on every frame.
// Each frame is then a real projection, so D3's clipping stays
// geometrically correct throughout the morph.
// ============================================================
export const DEGREES = 180 / Math.PI;

// Mercator sends the poles to y = ±Infinity, which poisons the blend for
// every t (0.05 · ∞ is still ∞, and 0 · ∞ is NaN at the endpoints).
// Clamping latitude a hair away from the poles keeps every blended
// coordinate finite; the clamped point lands ~1500px offscreen, so the
// visible map is unchanged.
const POLE_LIMIT = 89.99 / DEGREES;

// `rotation` (optional) is for blending two projections that share the same
// rotate(): pass them UNROTATED and let the wrapper rotate instead — this
// keeps clipAngle circles centred on the shared centre (e.g. a pole).
export function blendProjection(projFrom, projTo, rotation = null) {
  const mutate = d3.geoProjectionMutator((t) => (lambda, phi) => {
    phi = Math.max(-POLE_LIMIT, Math.min(POLE_LIMIT, phi));
    // Raw functions receive radians; the fitted projections expect degrees
    const [xa, ya] = projFrom([lambda * DEGREES, phi * DEGREES]);
    const [xb, yb] = projTo([lambda * DEGREES, phi * DEGREES]);
    // The wrapper flips y (geographic y-up → screen y-down); pre-negating it
    // here means the blend passes the endpoints' screen coordinates through.
    return [(1 - t) * xa + t * xb, -((1 - t) * ya + t * yb)];
  });
  // D3's translate means "where (0°,0°) lands on screen", not an offset —
  // so with scale 1 the wrapper becomes an exact identity over the blended
  // output only if we pin (0°,0°) to its own blended screen position.
  const centerFrom = projFrom([0, 0]);
  const centerTo   = projTo([0, 0]);
  const projection = Object.assign(mutate(0), {
    alpha(t) {
      mutate(t);
      return projection.translate([
        (1 - t) * centerFrom[0] + t * centerTo[0],
        (1 - t) * centerFrom[1] + t * centerTo[1],
      ]);
    },
  });
  if (rotation) projection.rotate(rotation);
  // No planar clipExtent on purpose: D3's rectangle clip decides whether the
  // viewport lies *inside* a polygon from its winding, and mid-blend folds of
  // Antarctica flipped that test — filling the whole screen. The SVG viewport
  // already crops offscreen geometry visually, so planar clipping adds nothing.
  // Coarser than D3's 0.5px default: resampling is a big share of per-frame
  // cost and 2px is invisible on shapes that are moving. Every blend is
  // followed by a native full-precision render.
  return projection.scale(1).precision(2).alpha(0);
}

