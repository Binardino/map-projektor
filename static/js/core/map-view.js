import { fitProjection } from "./projection.js";
import { renderMap } from "./render.js";
import { MAIN_ZOOM_SCALE_EXTENT } from "../config.js";

// ============================================================
// MAP VIEW — one drawable map: its SVG, layers, zoom and projection
//
// The main map is one view; a secondary map (a comparison panel) is
// another. Rendering, camera and tools are written once against a view
// instead of reaching for module-level SVG groups, so they work in any
// of them.
//
//   createMapView({ svgEl, width, height, layers, zoomExtent })
//   → { svg, width, height, world, layers: { sphere, countries, … }, zoom,
//       projectionDef, rotation, transform,
//       makeProjection(def, rotation), setProjection(def, rotation),
//       projection(), render(), resize(width, height), destroy() }
//
// Per-view state lives on the view: projectionDef and rotation are what it
// shows at rest (an animation draws its in-between frames straight into
// the layers and settles with setProjection + render), transform is its
// pan/zoom.
// Each view builds its own d3.zoom: a zoom behaviour is bound to one
// <svg>, and sharing it would make two maps pan together.
//
// The sphere outline and the countries are the map itself: every view has
// them. The other layers are overlays a view asks for by name.
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

const BASE_LAYERS = ["sphere", "countries"];

const LAYER_CLASS = {
  countries: "countries",
  terrain: "terrain-layer",
  tissot: "tissot-layer",
  reference: "reference-layer",
  flight: "flightpath-layer",
  truesize: "truesize-layer",
  highlight: "compare-highlight-layer",
};

// A view names the overlays it wants in any order and gets its layers back
// in paint order, base layers included. An unknown name throws: a typo
// would otherwise give a view that silently lacks a layer.
export function resolveLayers(names = LAYER_ORDER) {
  const unknown = names.filter((name) => !LAYER_ORDER.includes(name));
  if (unknown.length > 0) {
    throw new Error(`Unknown map layer: ${unknown.join(", ")}`);
  }
  return LAYER_ORDER.filter((name) => BASE_LAYERS.includes(name) || names.includes(name));
}

// Every live view, so an overlay tool can redraw itself wherever its layer
// exists instead of knowing which maps are on screen.
const views = new Set();

export function allViews() {
  return [...views];
}

export function createMapView({ svgEl, width, height, layers, zoomExtent = MAIN_ZOOM_SCALE_EXTENT }) {
  const svg = d3
    .select(svgEl)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  // Ocean background: outside the zoom layer so it always fills the
  // viewport, whatever the pan/zoom.
  const ocean = svg.append("rect").attr("class", "ocean").attr("width", width).attr("height", height);

  // Receives the pan/zoom transform; everything that moves with the map
  // lives inside it.
  const viewport = svg.append("g").attr("class", "viewport");

  // One wrapper for every world-space layer, so the upside-down flip (see
  // animateRecenterFlip) animates a single transform and the layers cannot
  // drift apart.
  const world = viewport.append("g").attr("class", "world");

  const view = { svg, width, height, world, layers: {}, projectionDef: null, rotation: null, transform: d3.zoomIdentity };

  for (const name of resolveLayers(layers)) {
    if (name === "sphere") {
      // A real shape, not just the background rect, so the globe's edge
      // shows against the void backdrop.
      view.layers.sphere = world.append("path").attr("class", "globe-sphere");
      // Its twin, visible only while a clip-angle blend crossfades the two
      // endpoint outlines (see animateBlend).
      view.sphereFade = world.append("path").attr("class", "globe-sphere").style("opacity", 0);
    } else {
      view.layers[name] = world.append("g").attr("class", LAYER_CLASS[name]);
    }
  }

  view.zoom = d3.zoom()
    .scaleExtent(zoomExtent)
    .on("zoom", (event) => {
      view.transform = event.transform;
      viewport.attr("transform", event.transform);
    });
  svg.call(view.zoom);

  // Fitted to this view's size; `rotation` recentres the sphere first.
  view.makeProjection = (projDef, rotation = null) => {
    const projection = projDef.d3fn();
    if (rotation) projection.rotate(rotation);
    return fitProjection(projDef, projection, view.width, view.height);
  };

  view.setProjection = (projDef, rotation = null) => {
    view.projectionDef = projDef;
    view.rotation = rotation;
    return view;
  };

  // The projection the view shows at rest.
  view.projection = () => view.makeProjection(view.projectionDef, view.rotation);

  view.render = () => {
    renderMap(view, view.projection());
    // The outline's stroke only shows on the globe, the one projection
    // whose disc needs an edge against the void (see .globe-sphere.active).
    view.layers.sphere.classed("active", view.projectionDef.globe);
  };

  // The caller redraws. The camera goes back to the default framing: a pan
  // or zoom chosen for the old shape would frame something else in the new one.
  view.resize = (newWidth, newHeight) => {
    view.width = newWidth;
    view.height = newHeight;
    svg.attr("viewBox", `0 0 ${newWidth} ${newHeight}`);
    ocean.attr("width", newWidth).attr("height", newHeight);
    svg.interrupt().call(view.zoom.transform, d3.zoomIdentity);
  };

  view.destroy = () => {
    views.delete(view);
    svg.on(".zoom", null);
    ocean.remove();
    viewport.remove();
  };

  views.add(view);
  return view;
}
