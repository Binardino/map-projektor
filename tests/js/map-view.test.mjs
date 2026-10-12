import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LAYER_ORDER, resolveLayers } from "../../static/js/core/map-view.js";

test("resolveLayers returns every layer by default", () => {
  assert.deepEqual(resolveLayers(), [...LAYER_ORDER]);
});

test("resolveLayers puts the requested layers in paint order", () => {
  assert.deepEqual(resolveLayers(["highlight", "countries", "sphere"]), ["sphere", "countries", "highlight"]);
});

test("resolveLayers ignores a layer asked twice", () => {
  assert.deepEqual(resolveLayers(["tissot", "tissot"]), ["tissot"]);
});

test("resolveLayers throws on an unknown layer", () => {
  assert.throws(() => resolveLayers(["countries", "clouds"]), /Unknown map layer: clouds/);
});

// Until the main map is built from the table, scene.js still creates its
// groups by hand: this keeps the table's order equal to the order the
// page really paints in.
test("LAYER_ORDER matches the order scene.js creates its groups in", () => {
  const scene = readFileSync(new URL("../../static/js/core/scene.js", import.meta.url), "utf8");
  const GROUPS = {
    sphere: "globeSphere", countries: "mapGroup", terrain: "terrainGroup", tissot: "tissotGroup",
    reference: "referenceGroup", flight: "flightPathGroup", truesize: "truesizeGroup", highlight: "compareHighlightGroup",
  };
  const positions = LAYER_ORDER.map((name) => scene.indexOf(`export const ${GROUPS[name]} `));
  assert.ok(positions.every((at) => at >= 0), "every layer has its group in scene.js");
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
});
