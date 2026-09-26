// index.html preloads every module main.js reaches through static imports:
// without it, each level of imports is only discovered once the one above
// has arrived, which cost ~160ms of cold load at 40ms latency. This keeps
// the hand-written list in step with the code.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = new URL("../../static/js/", import.meta.url).pathname;
const INDEX_HTML = new URL("../../templates/index.html", import.meta.url);

function staticGraph(entry = "main.js") {
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = readFileSync(path.join(ROOT, file), "utf8");
    for (const [, spec] of source.matchAll(/^import (?:[^"]* from )?"([^"]+)";$/gm)) {
      visit(path.normalize(path.join(path.dirname(file), spec)));
    }
  };
  visit(entry);
  return [...seen].sort();
}

test("index.html preloads exactly the modules main.js imports", () => {
  const html = readFileSync(INDEX_HTML, "utf8");
  const preloaded = [...html.matchAll(/<link rel="modulepreload" href="\/static\/js\/([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(preloaded, staticGraph());
});
