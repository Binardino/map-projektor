// Enforces the layering rule of the modularization plan
// (docs/design/plans/2026-09-21-modularization/README.md): lower layers
// never import higher ones, so a module can be understood and tested with
// only what sits below it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = new URL("../../static/js/", import.meta.url).pathname;

// What each layer may import, besides itself. config.js (imports nothing),
// state.js (the store, imports nothing) and i18n.js (t() is called
// everywhere) are shared by every layer.
const SHARED = ["config.js", "state.js", "i18n.js"];
const ALLOWED = {
  "config.js": [],
  "state.js": [],
  data: [...SHARED],
  core: [...SHARED, "data"],
  ui: [...SHARED, "data", "core"],
  tools: [...SHARED, "data", "core"],
};

// A disabled tool (not loaded, see tools/index.js) closing the info card.
// Listed file by file so a new upward import still fails.
const EXCEPTIONS = new Set([
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
      if (!EXCEPTIONS.has(edge)) violations.push(edge);
    }
  }
  assert.deepEqual(violations, []);
});

test("core reaches tools and ui only through the store and events", () => {
  const upward = modules()
    .filter((file) => layerOf(file) === "core")
    .flatMap((file) => importsOf(file).filter((t) => ["tools", "ui"].includes(layerOf(t))).map((t) => `${file} -> ${t}`));
  assert.deepEqual(upward, []);
});

test("nothing imports the entry point or the debug hook", () => {
  const importers = modules()
    .filter((file) => file !== "main.js")
    .flatMap((file) => importsOf(file).filter((t) => t === "main.js" || t === "debug.js").map((t) => `${file} -> ${t}`));
  assert.deepEqual(importers, []);
});
