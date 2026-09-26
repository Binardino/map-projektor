// ============================================================
// CONFIG — tunable values in one named place. Imports nothing from the
// app, so every layer can read it.
// ============================================================

// The comparison panels' right-hand default when side-by-side mode opens
// (the left one shows the current projection): Gall-Peters, the equal-area
// counterpoint to Mercator.
export const DEFAULT_COMPARISON_PROJECTION = "gallPeters";

// Animation durations in ms. The perf harness reads the polar-route legs
// from this block to size its recording window, so keep one key per line.
export const TIMING = {
  projectionMorph: 1400, // regular blend between two projections
  polarFold: 800,        // polar route: flat map → globe
  polarSpin: 700,        // polar route: globe turns to/from the pole
  polarUnfold: 800,      // polar route: globe → polar view
  recenterRotation: 900, // a view preset's rotation
  recenterFlip: 900,     // the upside-down view's coin flip
  cameraReset: 500,      // camera back to the default framing
  zoomButton: 200,       // one ± button press
  wheelZoom: 150,        // easing of one mouse-wheel notch
  countryFocus: 600,     // pan/zoom onto a selected country
};
