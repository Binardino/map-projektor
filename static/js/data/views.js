// ============================================================
// RECENTER PRESETS
//
// Every default map (Europe/Atlantic-centred) is itself a cartographic
// convention, not a neutral fact — these presets recentre the current
// projection the way other cultures' atlases customarily do. Applied as
// an instant re-render (no morph), single-map view only.
//
// Scope kept deliberately small: a preset overrides any rotate() the
// active projection's own d3fn already sets, so it's disabled on
// projections where that rotate is load-bearing (the two polar views)
// or tuned for one hemisphere (Albers, calibrated for the US). Presets
// and the country-zoom selection are mutually exclusive for now — each
// clears the other — since composing "zoomed on a country" with "the
// whole sphere rotated" isn't handled by the zoom math yet. Switching
// projection keeps the active view (the morph carries its rotation, see
// animateTransition); only Albers/polar, which can't be recentred, ease
// back to Europe-centered first (see switchProjection).
//
// The "upside-down" preset is a true vertical mirror (flipVertical),
// not a 180° rotate() — d3's rotate() performs a rigid rotation of the
// sphere, which has no fixed axis at the equator: a 180° roll there
// flips both north/south AND east/west (point symmetry), not the
// clean south-up-only mirror real upside-down maps use. Reflection
// isn't expressible as a sphere rotation, so it's applied as a 2D SVG
// transform on top of the (longitude-only) rotated render instead.
// ============================================================
// Labels live in static/i18n/<lang>.json under view.<id>.name / .description.
// id stays "world" (state checks and the perf harness key on it) although it is shown as Europe-centered.
// `rotate` is the longitude-only rotation flat maps use; `tilt` (optional)
// is the globe's full rotation, which also tips the view's region to the
// middle of the disc — on the globe a longitude turn alone left Europe
// near the top edge and barely told Europe- and Africa-centered apart.
export const RECENTER_PRESETS = [
  { id: "world", rotate: null, tilt: [-15, -50, 0] },
  { id: "africa", rotate: [-20, 0, 0] },
  { id: "china", rotate: [-105, 0, 0], tilt: [-100, -35, 0] },
  { id: "america", rotate: [90, 0, 0], tilt: [90, -20, 0] },
  { id: "oceania", rotate: [-150, 0, 0], tilt: [-150, -10, 0] },
  { id: "southAmericaFlipped", rotate: [60, 0, 0], flipVertical: true },
];


