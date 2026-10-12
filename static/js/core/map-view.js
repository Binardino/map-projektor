// ============================================================
// MAP VIEW — one drawable map: its SVG, layers, zoom and projection
//
// The main map is one view; a secondary map (a comparison panel) is
// another. Rendering, camera and tools are written once against a view
// instead of reaching for module-level SVG groups, so they work in any
// of them.
//
//   createMapView({ svgEl, width, height, layers, zoomExtent })
//   → { svg, layers: { sphere, countries, … }, zoom,
//       projectionId, rotation, transform,
//       setProjection(def, rotation), render(), destroy() }
//
// Per-view state (projectionId, rotation, transform) lives on the view.
// Each view builds its own d3.zoom: a zoom behaviour is bound to one
// <svg>, and sharing it would make two maps pan together.
//
// Only the layer table exists so far; the factory comes next (see
// docs/design/plans/2026-09-21-modularization/pr5-map-view.md).
// ============================================================

// Bottom to top: SVG has no z-index, a layer paints over the ones created
// before it. Declared once here so a secondary view can never stack its
// layers differently from the main map.
export const LAYER_ORDER = Object.freeze([
  "sphere",     // globe outline, under the countries
  "countries",
  "terrain",    // decorative, over the flat country fill
  "tissot",
  "reference",  // above Tissot so the named lines stay readable
  "flight",
  "truesize",   // dragged shapes, over every overlay
  "highlight",  // compare card highlight, always on top
]);

// A view asks for the layers it needs in any order and gets them back in
// paint order. An unknown name throws: a typo would otherwise give a view
// that silently lacks a layer.
export function resolveLayers(names = LAYER_ORDER) {
  const unknown = names.filter((name) => !LAYER_ORDER.includes(name));
  if (unknown.length > 0) {
    throw new Error(`Unknown map layer: ${unknown.join(", ")}`);
  }
  return LAYER_ORDER.filter((name) => names.includes(name));
}
