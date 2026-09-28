import { test } from "node:test";
import assert from "node:assert/strict";
import { getState } from "../../static/js/state.js";
import { runExclusive } from "../../static/js/core/busy.js";

test("busy is set while the task runs and cleared after", async () => {
  let during;
  await runExclusive(async () => { during = getState().busy; });
  assert.equal(during, true);
  assert.equal(getState().busy, false);
});

test("a throwing task still clears busy", async () => {
  await assert.rejects(runExclusive(async () => { throw new Error("boom"); }), /boom/);
  assert.equal(getState().busy, false);
});

test("a second task is refused while one runs", async () => {
  let release;
  const first = runExclusive(() => new Promise((resolve) => { release = resolve; }));
  assert.equal(await runExclusive(async () => {}), false);
  release();
  assert.equal(await first, true);
});
