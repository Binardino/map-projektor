import { test } from "node:test";
import assert from "node:assert/strict";
import { LAYER_ORDER, resolveLayers } from "../../static/js/core/map-view.js";

test("resolveLayers returns every layer by default", () => {
  assert.deepEqual(resolveLayers(), [...LAYER_ORDER]);
});

test("resolveLayers puts the requested overlays in paint order, after the base layers", () => {
  assert.deepEqual(resolveLayers(["highlight", "tissot"]), ["sphere", "countries", "tissot", "highlight"]);
});

test("resolveLayers always includes the sphere and the countries", () => {
  assert.deepEqual(resolveLayers([]), ["sphere", "countries"]);
});

test("resolveLayers ignores a layer asked twice", () => {
  assert.deepEqual(resolveLayers(["tissot", "tissot"]), ["sphere", "countries", "tissot"]);
});

test("resolveLayers throws on an unknown layer", () => {
  assert.throws(() => resolveLayers(["tissot", "clouds"]), /Unknown map layer: clouds/);
});
