import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PROJECTIONS, getProjection } from "../../static/js/data/projections.js";

test("getProjection returns the entry with that id", () => {
  assert.equal(getProjection("mercator").id, "mercator");
});

test("getProjection throws on an unknown id", () => {
  assert.throws(() => getProjection("nope"), /Unknown projection id: nope/);
});

// Registry invariants: a malformed entry fails here with its id in the
// message, not later as a blank sidebar button or a broken morph.
const EN = JSON.parse(readFileSync(new URL("../../static/i18n/en.json", import.meta.url), "utf8"));

test("every projection has an id, a family and a d3fn", () => {
  const broken = PROJECTIONS.filter((p) => !p.id || !p.family || typeof p.d3fn !== "function");
  assert.deepEqual(broken.map((p) => p.id ?? "(no id)"), []);
});

test("projection ids are unique", () => {
  const ids = PROJECTIONS.map((p) => p.id);
  assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), []);
});

test("exactly one projection is the globe", () => {
  assert.deepEqual(PROJECTIONS.filter((p) => p.globe).length, 1, "the polar route needs a single globe hub");
});

test("pole-centred projections cannot be recentred", () => {
  const recentrable = PROJECTIONS.filter((p) => p.polarRotation && p.recenterable).map((p) => p.id);
  assert.deepEqual(recentrable, [], "a polarRotation projection must set recenterable: false");
});

test("fit is either sphere or width", () => {
  assert.deepEqual(PROJECTIONS.filter((p) => !["sphere", "width"].includes(p.fit)).map((p) => `${p.id}: ${p.fit}`), []);
});

test("every family has its label in en.json", () => {
  const missing = [...new Set(PROJECTIONS.map((p) => `family.${p.family.toLowerCase()}`))].filter((key) => !(key in EN));
  assert.deepEqual(missing, []);
});
