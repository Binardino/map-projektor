import { test } from "node:test";
import assert from "node:assert/strict";
import { getProjection } from "../../static/js/data/projections.js";

test("getProjection returns the entry with that id", () => {
  assert.equal(getProjection("mercator").id, "mercator");
});

test("getProjection throws on an unknown id", () => {
  assert.throws(() => getProjection("nope"), /Unknown projection id: nope/);
});
