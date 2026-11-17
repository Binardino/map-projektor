// ============================================================
// SPILHAUS WORLD OCEAN MAP IN A SQUARE
//
// Not in d3-geo-projection or d3-geo-polygon. Adapted from Torben
// Jansen's notebook (https://observablehq.com/@toja/spilhaus-world-ocean-map-in-a-square)
// as packaged in riatelab/bertin, src/projections/spilhaus.js — MIT License,
// Copyright (c) Nicolas Lambert and contributors.
//
// The raw function is Adams' conformal "world in a square II"; Spilhaus'
// map is that square turned so its cut runs through the continents and
// the oceans stay in one piece. Uses the global d3, like the registry.
// ============================================================

// The rotation that puts the oceans in the middle of the square. It is the
// projection's own aspect (see `aspect` in projections.js).
export const SPILHAUS_ASPECT = [-66.94970198, 49.56371678, 40.17823482];

// Incomplete elliptic integral of the first kind, by the arithmetic-geometric mean.
function ellipticF(phi, m) {
  const { abs, atan, log, PI: pi, sin, sqrt } = Math;
  const C1 = 10e-4,
    C2 = 10e-10,
    TOL = 10e-6;
  const sp = sin(phi);

  let k = sqrt(1 - m),
    h = sp * sp;

  // "complete" elliptic integral
  if (h >= 1 || abs(phi) === pi / 2) {
    if (k <= TOL) return sp < 0 ? -Infinity : Infinity;
    (m = 1), (h = m), (m += k);
    while (abs(h - k) > C1 * m) {
      k = sqrt(h * k);
      (m /= 2), (h = m), (m += k);
    }
    return sp < 0 ? -pi / m : pi / m;
  }
  // "incomplete" elliptic integral
  if (k <= TOL) return log((1 + sp) / (1 - sp)) / 2;
  let g, n, p, r, y;
  (m = 1), (n = 0), (g = m), (p = m * k), (m += k);
  y = sqrt((1 - h) / h);
  if (abs((y -= p / y)) <= 0) y = C2 * sqrt(p);
  while (abs(g - k) > C1 * g) {
    (k = 2 * sqrt(p)), (n += n);
    if (y < 0) n += 1;
    (p = m * k), (g = m), (m += k);
    if (abs((y -= p / y)) <= 0) y = C2 * sqrt(p);
  }
  if (y < 0) n += 1;
  r = (atan(m / y) + pi * n) / m;
  return sp < 0 ? -r : r;
}

function ellipticFactory(a, b, sm, sn) {
  let m = Math.asin(Math.sqrt(1 + Math.min(0, Math.cos(a + b))));
  if (sm) m = -m;

  let n = Math.asin(Math.sqrt(Math.abs(1 - Math.max(0, Math.cos(a - b)))));
  if (sn) n = -n;

  return [ellipticF(m, 0.5), ellipticF(n, 0.5)];
}

function adamsWorldSquareIIRaw(lambda, phi) {
  const { sin, cos, asin, acos, tan } = Math;
  const sp = tan(0.5 * phi);
  let a = cos(asin(sp)) * sin(0.5 * lambda);
  const sm = sp + a < 0;
  const sn = sp - a < 0;
  const b = acos(sp);
  a = acos(a);
  return ellipticFactory(a, b, sm, sn);
}

export function geoSpilhaus() {
  return d3.geoProjection(adamsWorldSquareIIRaw).rotate(SPILHAUS_ASPECT);
}
