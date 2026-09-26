import { test } from "node:test";
import assert from "node:assert/strict";
import { thinRing, thinPolygon, buildLightGeometry, lightOf } from "../../static/js/core/geometry.js";
import { LIGHT_SPECK_DEG } from "../../static/js/config.js";

// d3 is a page global loaded from the CDN; thinPolygon only needs geoArea,
// which each test sets to the area it wants the check to see.
function withGeoArea(geoArea = () => 0) {
  globalThis.d3 = { geoArea };
}

// A closed square ring of side `size` degrees at (x, y), with `perSide`
// points per side lying on straight runs (all removable by Douglas-Peucker).
function square(x, y, size, perSide = 10) {
  const ring = [];
  const corners = [[x, y], [x + size, y], [x + size, y + size], [x, y + size]];
  corners.forEach((a, i) => {
    const b = corners[(i + 1) % 4];
    for (let k = 0; k < perSide; k++) {
      ring.push([a[0] + ((b[0] - a[0]) * k) / perSide, a[1] + ((b[1] - a[1]) * k) / perSide]);
    }
  });
  ring.push([x, y]);
  return ring;
}

function country(...polygons) {
  return { type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates: polygons } };
}

test("thinRing drops the points lying on straight runs", () => {
  withGeoArea();
  const thinned = thinRing(square(0, 0, 10));
  assert.ok(thinned.length < 10, `kept ${thinned.length} points`);
  assert.ok(thinned.length >= 4);
});

test("thinRing keeps the ring closed", () => {
  withGeoArea();
  const thinned = thinRing(square(0, 0, 10));
  assert.deepEqual(thinned[0], thinned[thinned.length - 1]);
});

test("thinRing returns null for a sub-degree island", () => {
  withGeoArea();
  assert.equal(thinRing(square(0, 0, LIGHT_SPECK_DEG / 2)), null);
});

test("thinPolygon keeps an inside-out result's original rings", () => {
  // More than a hemisphere of area means the thinned ring wound the wrong way.
  withGeoArea(() => 3 * Math.PI);
  const rings = [square(0, 0, 10)];
  assert.equal(thinPolygon(rings), rings);
});

test("buildLightGeometry drops specks but keeps a country's large polygon", () => {
  withGeoArea();
  const feature = country([square(0, 0, 10)], [square(30, 30, 0.2)]);
  buildLightGeometry([feature]);
  assert.equal(lightOf(feature).geometry.coordinates.length, 1);
});

test("a country made only of specks keeps its first polygon whole", () => {
  withGeoArea();
  const first = [square(14, 35, 0.2)];
  const feature = country(first, [square(15, 36, 0.1)]);
  buildLightGeometry([feature]);
  assert.deepEqual(lightOf(feature).geometry.coordinates, [first]);
});

test("lightOf falls back to the original feature it has no twin for", () => {
  withGeoArea();
  const line = { type: "Feature", geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] } };
  assert.equal(lightOf(line), line);
});
