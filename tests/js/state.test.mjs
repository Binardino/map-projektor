import { test } from "node:test";
import assert from "node:assert/strict";
import { getState, setState, subscribe, on, emit } from "../../static/js/state.js";

// The store is a module singleton: each test uses its own slice names.

test("a subscriber hears each patch once, with the changed keys", () => {
  const calls = [];
  const off = subscribe(["a1", "b1"], (state, previous, changed) => calls.push(changed));
  setState({ a1: 1, b1: 2 });
  off();
  assert.deepEqual(calls, [["a1", "b1"]]);
});

test("no notification when nothing changed", () => {
  setState({ a2: 1 });
  let calls = 0;
  const off = subscribe(["a2"], () => calls++);
  setState({ a2: 1 });
  off();
  assert.equal(calls, 0);
});

test("unsubscribe stops notifications", () => {
  let calls = 0;
  const off = subscribe(["a3"], () => calls++);
  setState({ a3: 1 });
  off();
  setState({ a3: 2 });
  assert.equal(calls, 1);
});

test("a throwing subscriber does not stop the others", (context) => {
  context.mock.method(console, "error", () => {});
  let reached = false;
  const offA = subscribe(["a4"], () => { throw new Error("boom"); });
  const offB = subscribe(["a4"], () => { reached = true; });
  setState({ a4: 1 });
  offA(); offB();
  assert.equal(reached, true);
});

test("a wildcard subscriber hears every change", () => {
  const seen = [];
  const off = subscribe("*", (state, previous, changed) => seen.push(...changed));
  setState({ a5: 1 });
  setState({ b5: 1 });
  off();
  assert.deepEqual(seen, ["a5", "b5"]);
});

test("a patch set from inside a notification is applied after the current one", () => {
  const order = [];
  const offA = subscribe(["a6"], (state) => { order.push(`a6=${state.a6}`); setState({ b6: state.a6 * 10 }); });
  const offB = subscribe(["b6"], (state) => order.push(`b6=${state.b6}`));
  const offC = subscribe(["a6"], () => order.push("a6 second subscriber"));
  setState({ a6: 1 });
  offA(); offB(); offC();
  assert.deepEqual(order, ["a6=1", "a6 second subscriber", "b6=10"]);
});

test("a snapshot cannot be mutated", () => {
  setState({ a7: { rotation: [1, 2, 3] } });
  const snapshot = getState();
  assert.throws(() => { snapshot.a7 = null; }, TypeError);
  assert.throws(() => { snapshot.a7.rotation[0] = 9; }, TypeError);
  assert.deepEqual(getState().a7.rotation, [1, 2, 3]);
});

test("events reach their listeners with the payload", () => {
  const got = [];
  const off = on("test:event", (payload) => got.push(payload));
  emit("test:event", 42);
  off();
  emit("test:event", 43);
  assert.deepEqual(got, [42]);
});
