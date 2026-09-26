// Loads functions out of map.js so node:test can call
// them without a browser or npm packages. The source is read from the real
// files (never copied), so the tests exercise exactly what the page runs.
// Temporary: once the frontend becomes ES modules these become plain imports.
import { readFileSync } from "node:fs";
import vm from "node:vm";

const STATIC_JS = new URL("../../static/js/", import.meta.url);

function source(file) {
  return readFileSync(new URL(file, STATIC_JS), "utf8");
}

// Runs `code` in a fresh context holding `globals`, and returns the listed
// top-level names (const/let/function bindings aren't context properties,
// so they're handed back by a trailing expression instead).
function evaluate(code, names, globals) {
  const context = vm.createContext({ console, ...globals });
  return vm.runInContext(`${code}\n;({ ${names.join(", ")} })`, context);
}

// The LIGHT GEOMETRY block of map.js, from its first constant to lightOf.
// `geoArea` stands in for d3.geoArea, the block's only outside dependency.
export function loadLightGeometry(geoArea = () => 0) {
  const code = source("map.js");
  const start = code.indexOf("const LIGHT_TOLERANCE_DEG");
  const endMarker = "function lightOf(feature) {";
  const end = code.indexOf("\n}\n", code.indexOf(endMarker)) + 3;
  if (start === -1 || end < start) throw new Error("LIGHT GEOMETRY block not found in map.js");
  return evaluate(
    code.slice(start, end),
    ["thinRing", "thinPolygon", "buildLightGeometry", "lightOf", "LIGHT_SPECK_DEG"],
    { d3: { geoArea } },
  );
}
