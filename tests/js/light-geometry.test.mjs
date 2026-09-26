import { test } from "node:test";
import assert from "node:assert/strict";
import { loadLightGeometry } from "./harness.mjs";

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

// Arrays built inside the vm context have that context's Array prototype,
// which deepStrictEqual rejects; compare their plain JSON shape instead.
const plain = (value) => JSON.parse(JSON.stringify(value));

function country(...polygons) {
  return { type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates: polygons } };
}

test("thinRing drops the points lying on straight runs", () => {
  const { thinRing } = loadLightGeometry();
  const thinned = thinRing(square(0, 0, 10));
  assert.ok(thinned.length < 10, `kept ${thinned.length} points`);
  assert.ok(thinned.length >= 4);
});

test("thinRing keeps the ring closed", () => {
  const { thinRing } = loadLightGeometry();
  const thinned = thinRing(square(0, 0, 10));
  assert.deepEqual(plain(thinned[0]), plain(thinned[thinned.length - 1]));
});

test("thinRing returns null for a sub-degree island", () => {
  const { thinRing, LIGHT_SPECK_DEG } = loadLightGeometry();
  assert.equal(thinRing(square(0, 0, LIGHT_SPECK_DEG / 2)), null);
});

test("thinPolygon keeps an inside-out result's original rings", () => {
  // More than a hemisphere of area means the thinned ring wound the wrong way.
  const { thinPolygon } = loadLightGeometry(() => 3 * Math.PI);
  const rings = [square(0, 0, 10)];
  assert.equal(thinPolygon(rings), rings);
});

test("buildLightGeometry drops specks but keeps a country's large polygon", () => {
  const { buildLightGeometry, lightOf } = loadLightGeometry();
  const feature = country([square(0, 0, 10)], [square(30, 30, 0.2)]);
  buildLightGeometry([feature]);
  assert.equal(lightOf(feature).geometry.coordinates.length, 1);
});

test("a country made only of specks keeps its first polygon whole", () => {
  const { buildLightGeometry, lightOf } = loadLightGeometry();
  const first = [square(14, 35, 0.2)];
  const feature = country(first, [square(15, 36, 0.1)]);
  buildLightGeometry([feature]);
  assert.deepEqual(plain(lightOf(feature).geometry.coordinates), [first]);
});

test("lightOf falls back to the original feature it has no twin for", () => {
  const { lightOf } = loadLightGeometry();
  const line = { type: "Feature", geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] } };
  assert.equal(lightOf(line), line);
});
