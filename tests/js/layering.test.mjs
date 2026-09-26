// Enforces the layering rule of the modularization plan
// (docs/superpowers/plans/2026-09-21-modularization/README.md): lower layers
// never import higher ones, so a module can be understood and tested with
// only what sits below it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = new URL("../../static/js/", import.meta.url).pathname;

// What each layer may import, besides itself. i18n.js is shared
// infrastructure (t() is called from every layer).
const ALLOWED = {
  data: ["i18n.js"],
  core: ["data", "i18n.js"],
  ui: ["data", "core", "i18n.js"],
  tools: ["data", "core", "i18n.js"],
};

// Direct calls that PR 4 turns into events; each is removed from this list
// then. Listed file by file so a new upward import still fails.
const TEMPORARY_EXCEPTIONS = new Set([
  "core/*.js -> tools/index.js",
  "core/camera.js -> ui/compare-card.js",
  "core/recenter.js -> ui/compare-card.js",
  "core/transition.js -> ui/compare-card.js",
  "core/transition.js -> ui/info-card.js",
  "core/transition.js -> ui/mobile-sidebar.js",
  "core/transition.js -> ui/sidebar.js",
  // A disabled tool (not loaded, see tools/index.js) closing the info card
  "tools/side-by-side.js -> ui/info-card.js",
]);

function modules(dir = ROOT) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return modules(full);
    return entry.name.endsWith(".js") ? [path.relative(ROOT, full)] : [];
  });
}

function importsOf(file) {
  const source = readFileSync(path.join(ROOT, file), "utf8");
  return [...source.matchAll(/^import (?:[^"]* from )?"([^"]+)";$/gm)]
    .map((match) => path.normalize(path.join(path.dirname(file), match[1])));
}

const layerOf = (file) => (file.includes("/") ? file.split("/")[0] : file);

test("each layer imports only the layers below it", () => {
  const violations = [];
  for (const file of modules()) {
    const layer = layerOf(file);
    if (!(layer in ALLOWED)) continue; // main.js, debug.js: the top, may import anything
    for (const target of importsOf(file)) {
      const targetLayer = layerOf(target);
      if (targetLayer === layer || ALLOWED[layer].includes(targetLayer)) continue;
      const edge = `${file} -> ${target}`;
      const wildcard = `${layer}/*.js -> ${target}`;
      if (TEMPORARY_EXCEPTIONS.has(edge) || TEMPORARY_EXCEPTIONS.has(wildcard)) continue;
      violations.push(edge);
    }
  }
  assert.deepEqual(violations, []);
});

test("core reaches tools only through tools/index.js", () => {
  const direct = modules()
    .filter((file) => layerOf(file) === "core")
    .flatMap((file) => importsOf(file).filter((t) => t.startsWith("tools/") && t !== "tools/index.js").map((t) => `${file} -> ${t}`));
  assert.deepEqual(direct, []);
});

test("nothing imports the entry point or the debug hook", () => {
  const importers = modules()
    .filter((file) => file !== "main.js")
    .flatMap((file) => importsOf(file).filter((t) => t === "main.js" || t === "debug.js").map((t) => `${file} -> ${t}`));
  assert.deepEqual(importers, []);
});
