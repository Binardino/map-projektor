import { test } from "node:test";
import assert from "node:assert/strict";
import { formatLink, parseLink } from "../../static/js/core/share-link.js";

test("a valid link gives its projection and view", () => {
  assert.deepEqual(parseLink("#p=robinson&v=africa"), { projectionId: "robinson", preset: "africa" });
});

test("an unknown projection or view is dropped, the other part kept", () => {
  assert.deepEqual(parseLink("#p=nope&v=africa"), { projectionId: null, preset: "africa" });
  assert.deepEqual(parseLink("#p=robinson&v=nope"), { projectionId: "robinson", preset: null });
});

test("an empty or malformed hash gives nothing", () => {
  const none = { projectionId: null, preset: null };
  assert.deepEqual(parseLink(""), none);
  assert.deepEqual(parseLink("#"), none);
  assert.deepEqual(parseLink("#garbage&&=="), none);
});

test("formatLink writes the projection and the view", () => {
  const link = formatLink({ projectionId: "mercator", recenter: { preset: "southAmericaFlipped" } });
  assert.equal(link, "#p=mercator&v=southAmericaFlipped");
});

test("a dragged globe (no preset) keeps only the projection", () => {
  assert.equal(formatLink({ projectionId: "orthographic", recenter: { preset: null } }), "#p=orthographic");
});

test("a formatted link parses back to the same state", () => {
  const state = { projectionId: "winkelTripel", recenter: { preset: "china" } };
  assert.deepEqual(parseLink(formatLink(state)), { projectionId: "winkelTripel", preset: "china" });
});
