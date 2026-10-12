import { test } from "node:test";
import assert from "node:assert/strict";
import { sphereMover, moveGeo } from "../../static/js/core/sphere-move.js";

const RADIANS = Math.PI / 180;

// Great-circle angle between two [lon, lat] points, in degrees.
function distance([l1, p1], [l2, p2]) {
  const a = Math.sin(p1 * RADIANS) * Math.sin(p2 * RADIANS)
    + Math.cos(p1 * RADIANS) * Math.cos(p2 * RADIANS) * Math.cos((l2 - l1) * RADIANS);
  return Math.acos(Math.max(-1, Math.min(1, a))) / RADIANS;
}

function near(actual, expected, tolerance, message) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);
}

// Rough outline of Greenland, enough to have a shape with some extent.
const SHAPE = [[-45, 60], [-20, 70], [-25, 82], [-60, 82], [-70, 76], [-52, 66], [-45, 60]];
const HOME = [-42, 72];

test("the anchor lands on the target", () => {
  const [lon, lat] = sphereMover(HOME, [25, -3])(HOME);
  near(lon, 25, 1e-9, "longitude");
  near(lat, -3, 1e-9, "latitude");
});

test("moving to where it already is changes nothing", () => {
  const move = sphereMover(HOME, HOME);
  SHAPE.forEach((point) => {
    const [lon, lat] = move(point);
    near(lon, point[0], 1e-9, "longitude");
    near(lat, point[1], 1e-9, "latitude");
  });
});

test("every distance inside the shape is kept (true size)", () => {
  for (const target of [[25, -3], [170, 40], [-100, -60], [0, 89]]) {
    const moved = SHAPE.map(sphereMover(HOME, target));
    for (let i = 0; i < SHAPE.length; i++) {
      for (let j = i + 1; j < SHAPE.length; j++) {
        near(distance(moved[i], moved[j]), distance(SHAPE[i], SHAPE[j]), 1e-9, `pair ${i}-${j} to ${target}`);
      }
    }
  }
});

test("the shape stays upright: north of the anchor stays north of the target", () => {
  const [lon, lat] = sphereMover(HOME, [120, 10])([HOME[0], HOME[1] + 5]);
  near(lon, 120, 1e-9, "longitude");
  near(lat, 15, 1e-9, "latitude");
});

test("a move onto a pole or across the antimeridian gives finite coordinates in range", () => {
  for (const target of [[0, 90], [0, -90], [180, 0], [-179.5, 45]]) {
    SHAPE.map(sphereMover(HOME, target)).forEach(([lon, lat]) => {
      assert.ok(Number.isFinite(lon) && Number.isFinite(lat), `finite at ${target}`);
      assert.ok(lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90, `in range at ${target}`);
    });
  }
});

test("moveGeo moves features, collections and geometries without touching the input", () => {
  const polygon = { type: "Polygon", coordinates: [SHAPE] };
  const multi = { type: "MultiPolygon", coordinates: [[SHAPE], [SHAPE]] };
  const feature = { type: "Feature", properties: { name: "x" }, geometry: multi };
  const collection = { type: "FeatureCollection", features: [feature, { type: "Feature", properties: {}, geometry: polygon }] };
  const before = JSON.stringify(collection);
  const expected = SHAPE.map(sphereMover(HOME, [10, 10]));

  const moved = moveGeo(collection, HOME, [10, 10]);

  assert.equal(JSON.stringify(collection), before);
  assert.deepEqual(moved.features[0].properties, { name: "x" });
  assert.deepEqual(moved.features[0].geometry.coordinates, [[expected], [expected]]);
  assert.deepEqual(moved.features[1].geometry.coordinates, [expected]);
  assert.deepEqual(moveGeo(polygon, HOME, [10, 10]).coordinates, [expected]);
});
