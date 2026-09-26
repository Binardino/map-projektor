// ============================================================
// SVG SETUP
// ============================================================
const container = document.getElementById("map-container");
export const WIDTH  = container.clientWidth;
export const HEIGHT = container.clientHeight;

export const svg = d3
  .select("#map-svg")
  .attr("viewBox", `0 0 ${WIDTH} ${HEIGHT}`)
  .attr("preserveAspectRatio", "xMidYMid meet");

// Ocean background rectangle — stays outside the zoom layer so it always
// fills the viewport regardless of the current pan/zoom transform, and
// swaps to the globe backdrop color (see updateGlobeBackground) whenever
// the orthographic view is active.
export const oceanRect = svg.append("rect").attr("class", "ocean").attr("width", WIDTH).attr("height", HEIGHT);

// Zoom layer — receives the free pan/zoom transform (see CAMERA PAN & ZOOM
// below). Everything that pans/zooms with the map lives inside it.
export const zoomLayer = svg.append("g").attr("class", "viewport");

// Single wrapper for every world-space layer, so the South America
// (upside-down) mirror flip (see animateRecenterFlip) animates ONE
// group's transform instead of seven separate transitions — cheaper to
// run, and guarantees every layer stays perfectly in sync.
export const worldGroup = zoomLayer.append("g").attr("class", "world");

// Sphere outline — a distinct shape (not just the background rect) so the
// globe's edge is visible against the void backdrop in orthographic view.
// Appended before mapGroup so countries paint on top of it.
export const globeSphere = worldGroup.append("path").attr("class", "globe-sphere");

// Second sphere shape, used only to crossfade during clip-angle-animated
// blends (see animateBlend's `crossfade` branch) — kept empty/transparent
// otherwise.
export const globeSphereFade = worldGroup.append("path").attr("class", "globe-sphere").style("opacity", 0);

// Group that holds all country <path> elements
export const mapGroup = worldGroup.append("g").attr("class", "countries");

// Mountain range/plateau terrain patches — appended after mapGroup so they
// paint over the flat country fill, purely decorative (pointer-events:none
// in CSS so clicks still reach the country underneath).
export const terrainGroup = worldGroup.append("g").attr("class", "terrain-layer");

// Tissot's indicatrix overlay — appended after mapGroup so it paints on top
export const tissotGroup = worldGroup.append("g").attr("class", "tissot-layer");

// Reference lines (equator, tropics, polar circles, meridians) — above
// Tissot so the named lines stay readable when both overlays are on.
export const referenceGroup = worldGroup.append("g").attr("class", "reference-layer");

// Flight path overlay — appended after tissotGroup so the arc paints on top
export const flightPathGroup = worldGroup.append("g").attr("class", "flightpath-layer");

// True-size country shapes — appended last so dragged shapes paint on top
// of everything else. Main view only (not mirrored to compare panels).
export const truesizeGroup = worldGroup.append("g").attr("class", "truesize-layer");

// Compare-mode country highlight — appended last of all so it always
// paints on top. See COMPARE CARD below.
export const compareHighlightGroup = worldGroup.append("g").attr("class", "compare-highlight-layer");
