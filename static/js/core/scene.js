import { createMapView } from "./map-view.js";

// ============================================================
// SCENE — the main map
//
// The one view the sidebar, the toolbar and the store's projectionId and
// recenter slices drive. Sized from its container at load, then kept in
// step with it by core/resize.js.
// ============================================================
const container = document.getElementById("map-container");

export const mainView = createMapView({
  svgEl: document.getElementById("map-svg"),
  width: container.clientWidth,
  height: container.clientHeight,
});
