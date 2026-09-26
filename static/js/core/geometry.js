import { LIGHT_SPECK_DEG, LIGHT_TOLERANCE_DEG } from "../config.js";

// ============================================================
// LIGHT GEOMETRY — animation-only copy of the country/terrain shapes
//
// Every animation frame reprojects every vertex through TWO projections
// (source + target blend) plus D3's adaptive resampling, so frame cost
// scales with vertex count: the full 21k-vertex world took ~40ms/frame,
// well past the 16ms budget for 60fps. Simplifying each ring with
// Douglas-Peucker (LIGHT_TOLERANCE_DEG) and skipping sub-degree islands
// cuts that to ~11ms, and the loss is barely visible
// while shapes are moving. The final render always uses the full data,
// so the resting map is unchanged.
// ============================================================

// Keyed by the original feature object, so animation loops can look up a
// bound datum's light twin without a name lookup (terrain has duplicate names).
const lightGeometry = new WeakMap();

// Distance from p to the line through a and b, in degrees (planar lon/lat
// is accurate enough at this tolerance).
function distanceToLine(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = Math.hypot(dx, dy);
  if (length === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / length;
}

// Returns null when the ring is a speck. Douglas-Peucker needs a chord, and
// a closed ring's first and last points coincide, so the ring is split at
// its farthest point from the start and each half simplified. Iterative
// (explicit stack) because some rings have thousands of points.
export function thinRing(ring) {
  const first = ring[0];
  let far = 0;
  let farDistance = 0;
  ring.forEach((p, i) => {
    const d = Math.hypot(p[0] - first[0], p[1] - first[1]);
    if (d > farDistance) { farDistance = d; far = i; }
  });
  if (farDistance < LIGHT_SPECK_DEG) return null;

  const keep = new Uint8Array(ring.length);
  keep[0] = keep[far] = keep[ring.length - 1] = 1;
  const stack = [[0, far], [far, ring.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop();
    let worst = -1;
    let worstDistance = LIGHT_TOLERANCE_DEG;
    for (let i = start + 1; i < end; i++) {
      const d = distanceToLine(ring[i], ring[start], ring[end]);
      if (d > worstDistance) { worstDistance = d; worst = i; }
    }
    if (worst !== -1) {
      keep[worst] = 1;
      stack.push([start, worst], [worst, end]);
    }
  }
  const kept = ring.filter((_, i) => keep[i]);
  return kept.length >= 4 ? kept : null;
}

// Sub-degree islands are ~80% of all rings (1300 of 1600) but only ~30% of
// the vertices: their cost is per-ring overhead (clipping + resampling
// setup), not vertex count, so thinning can't help — they have to be
// skipped while animating. A few px specks reappear on the final render.
//
// Simplifying a small concave island down to a triangle can pick three points
// that wind the wrong way (Gotland, Sumbawa, Unalaska did). On a sphere a
// ring's winding decides which side is "inside", so D3 then reads the
// island as the whole globe minus the island and paints land colour over
// every ocean mid-morph. More than a hemisphere of area gives that away;
// such rings are tiny, so keeping them unthinned costs nothing.
export function thinPolygon(rings) {
  const exterior = thinRing(rings[0]);
  if (!exterior) return null;
  const thinned = [exterior, ...rings.slice(1).map(thinRing).filter(Boolean)];
  return d3.geoArea({ type: "Polygon", coordinates: thinned }) > 2 * Math.PI ? rings : thinned;
}

export function buildLightGeometry(features) {
  features.forEach((feature) => {
    const g = feature.geometry;
    if (!g || (g.type !== "Polygon" && g.type !== "MultiPolygon")) return;
    const polygons = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    let thinned = polygons.map(thinPolygon).filter(Boolean);
    // A country made only of specks (Malta, Singapore…) must not vanish
    // during the morph: keep its first polygon whole, it's cheap anyway.
    if (!thinned.length) thinned = [polygons[0]];
    lightGeometry.set(feature, { ...feature, geometry: { type: "MultiPolygon", coordinates: thinned } });
  });
}

// Falls back to the full feature for geometry types buildLightGeometry skips.
export function lightOf(feature) {
  return lightGeometry.get(feature) || feature;
}
