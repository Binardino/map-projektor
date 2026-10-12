import { clearSelection } from "../core/selection.js";
import { allViews } from "../core/map-view.js";
import { mainView } from "../core/scene.js";
import { resetRecenter } from "../core/recenter.js";
import { getState, on, setState } from "../state.js";

// ============================================================
// FLIGHT PATH / GREAT CIRCLE
//
// Click two points anywhere on the map to draw the great-circle
// route between them, with its real-world distance. Switching
// projection re-renders the same route, showing how its curvature
// changes — this is what makes "shortest path" distortion visible
// (e.g. why transpolar flights curve near the pole on a globe but
// look wrong on a flat Mercator map).
//
// Endpoints are stored as [lon, lat] — projection-independent, like
// the Tissot grid points — so refreshFlightPath() can re-project and
// redraw them after any projection switch, the same pattern as
// refreshTissot(). One shared A/B pair for the whole app: every view with
// a flight layer reprojects it with its own projection. Mutually exclusive with country selection and
// recenter presets (same convention those two already use with each
// other): turning flight-path mode on clears both; selecting a
// country or a recenter preset turns flight-path mode off.
// ============================================================
const flightPathToggleBtn  = document.getElementById("flightpath-toggle");
const flightPathDistanceEl = document.getElementById("flightpath-distance");

const EARTH_RADIUS_KM = 6371;

// flightPathMode is a store slice (the camera reads it) written only here
setState({ flightPathMode: false });
let flightPathA = null; // [lon, lat] or null
let flightPathB = null; // [lon, lat] or null

// Full clear-and-redraw rather than a D3 data join: at most one path and
// two markers, redrawn only on discrete events (click, projection switch),
// never per animation frame — a join would add complexity for no benefit.
function renderFlightPath(group, projection) {
  group.selectAll("*").remove();
  if (!flightPathA) return;

  const pathFn = d3.geoPath().projection(projection);

  if (flightPathB) {
    const arc = d3.geoInterpolate(flightPathA, flightPathB);
    const coordinates = d3.range(0, 1.0001, 1 / 100).map(arc);
    const line = pathFn({ type: "LineString", coordinates });
    if (line) group.append("path").attr("class", "flightpath-path").attr("d", line);
  }

  const points = flightPathB ? [flightPathA, flightPathB] : [flightPathA];
  points.forEach((d) => {
    const screen = projection(d);
    if (!screen) return; // point fell outside the visible hemisphere after a projection switch
    group
      .append("circle")
      .attr("class", "flightpath-marker")
      .attr("r", 4)
      .attr("cx", screen[0])
      .attr("cy", screen[1]);
  });
}

function updateFlightPathDistanceLabel() {
  if (!flightPathDistanceEl) return; // no sidebar UI right now, see remove(ui) commit
  if (flightPathA && flightPathB) {
    const km = Math.round(d3.geoDistance(flightPathA, flightPathB) * EARTH_RADIUS_KM);
    flightPathDistanceEl.textContent = `Distance: ${km.toLocaleString()} km`;
    flightPathDistanceEl.hidden = false;
  } else {
    flightPathDistanceEl.hidden = true;
  }
}

// Re-renders the route in every view — called after any projection change.
export function refreshFlightPath() {
  for (const view of allViews()) {
    if (view.layers.flight) renderFlightPath(view.layers.flight, view.projection());
  }

  updateFlightPathDistanceLabel();
}

export function setFlightPathMode(active) {
  setState({ flightPathMode: active });
  flightPathToggleBtn.classList.toggle("active", active);
  flightPathA = null;
  flightPathB = null;
  refreshFlightPath();
}

// See the compareToggleBtn note above — same guard, same reason.
if (flightPathToggleBtn) {
  flightPathToggleBtn.addEventListener("click", () => {
    if (getState().busy) return;
    if (!getState().flightPathMode) {
      clearSelection();
      resetRecenter();
    }
    setFlightPathMode(!getState().flightPathMode);
  });
}

// 1st click places A, 2nd places B and draws the route, 3rd starts over.
// The click is inverted with the clicked view's own pan/zoom and projection.
function handleFlightPathClick(event, view) {
  if (!getState().flightPathMode || getState().busy) return;

  // Undo the free camera pan/zoom (see CAMERA PAN & ZOOM) to get back to the
  // coordinate space the projection itself draws in before inverting.
  const [sx, sy] = d3.pointer(event, view.svg.node());
  const [x, y] = view.transform.invert([sx, sy]);
  const coords = view.projection().invert([x, y]);
  if (!coords) return; // click landed outside the rendered sphere

  if (!flightPathA) {
    flightPathA = coords;
  } else if (!flightPathB) {
    flightPathB = coords;
  } else {
    flightPathA = coords;
    flightPathB = null;
  }
  refreshFlightPath();
}

// Named listener: attaching again to the same <svg> (a comparison panel
// rebuilt on re-entry) replaces it instead of stacking a second one.
export function attachFlightPath(view) {
  view.svg.on("click.flightpath", (event) => handleFlightPathClick(event, view));
}
attachFlightPath(mainView);

on("view:changed", refreshFlightPath);
// A recenter or a country selection takes the pointer back
on("pointer:reset", () => {
  if (getState().flightPathMode) setFlightPathMode(false);
});
