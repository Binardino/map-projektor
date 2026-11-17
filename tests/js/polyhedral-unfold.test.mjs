import { test } from "node:test";
import assert from "node:assert/strict";
import { apply, identity, multiply, quaternionOf, rotationAbout, towardsIdentity } from "../../static/js/core/polyhedral-unfold.js";

const close = (a, b, eps = 1e-9) => a.every((v, i) => Math.abs(v - b[i]) < eps);

test("a rotation about a hinge leaves the hinge where it is", () => {
  const r = rotationAbout([10, 20], [40, 60], 0.7);
  assert.ok(close(apply(r, [10, 20, 0]), [10, 20, 0]));
  assert.ok(close(apply(r, [40, 60, 0]), [40, 60, 0]));
});

test("a quarter turn about a hinge in the plane lifts a point straight out of it", () => {
  // Hinge along the x axis; a point 5 units off it ends 5 units off the plane
  const p = apply(rotationAbout([0, 0], [1, 0], Math.PI / 2), [3, 5, 0]);
  assert.ok(close(p, [3, 0, 5]) || close(p, [3, 0, -5]), `got ${p}`);
});

test("turning back by the same angle undoes a fold", () => {
  const there = rotationAbout([2, 3], [7, -1], 0.73), back = rotationAbout([2, 3], [7, -1], -0.73);
  assert.ok(close(multiply(back, there), identity()));
});

test("a rotation survives the trip through its quaternion", () => {
  const r = rotationAbout([0, 0], [3, 4], 1.1);
  const m = [[r[0], r[1], r[2]], [r[4], r[5], r[6]], [r[8], r[9], r[10]]];
  assert.deepEqual(towardsIdentity(quaternionOf(m), 0).flat().map((v) => +v.toFixed(9)), m.flat().map((v) => +v.toFixed(9)));
});

test("the turn back ends on no rotation at all", () => {
  const q = quaternionOf([[0, -1, 0], [1, 0, 0], [0, 0, 1]]); // a quarter turn about z
  assert.ok(close(towardsIdentity(q, 1).flat(), [1, 0, 0, 0, 1, 0, 0, 0, 1]));
  const half = towardsIdentity(q, 0.5); // an eighth of a turn
  assert.ok(Math.abs(half[0][0] - Math.cos(Math.PI / 4)) < 1e-9);
});
