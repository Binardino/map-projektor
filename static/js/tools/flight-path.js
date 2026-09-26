import { getProjection } from "../data/projections.js";
import { clearSelection } from "../core/selection.js";
import { compareMode, comparePanels } from "./side-by-side.js";
import { state } from "../core/state.js";
import { currentZoomTransform } from "../core/camera.js";
import { fitProjection, makeProjection } from "../core/projection.js";
import { flightPathGroup, svg } from "../core/scene.js";
import { resetRecenter, rotationFor } from "../core/recenter.js";

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
// refreshTissot(). Also mirrored onto both compare-mode panels the same
// way Tissot is: one shared A/B pair, each panel just reprojects it with
// its own projection. Mutually exclusive with country selection and
// recenter presets (same convention those two already use with each
// other): turning flight-path mode on clears both; selecting a
// country or a recenter preset turns flight-path mode off.
// ============================================================
const flightPathToggleBtn  = document.getElementById("flightpath-toggle");
const flightPathDistanceEl = document.getElementById("flightpath-distance");

const EARTH_RADIUS_KM = 6371;

export let flightPathMode = false;
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

// Re-renders the route on the single map and, if active, on both
// comparison panels — called after any projection change.
export function refreshFlightPath() {
  const currentDef = getProjection(state.currentProjectionId);
  renderFlightPath(flightPathGroup, makeProjection(currentDef, rotationFor(currentDef)));

  if (compareMode && comparePanels) {
    comparePanels.forEach((panel) => {
      const projDef = getProjection(panel.projId);
      renderFlightPath(panel.flightPathGroup, fitProjection(projDef, projDef.d3fn(), panel.width, panel.height));
    });
  }

  updateFlightPathDistanceLabel();
}

export function setFlightPathMode(active) {
  flightPathMode = active;
  flightPathToggleBtn.classList.toggle("active", flightPathMode);
  flightPathA = null;
  flightPathB = null;
  refreshFlightPath();
}

// See the compareToggleBtn note above — same guard, same reason.
if (flightPathToggleBtn) {
  flightPathToggleBtn.addEventListener("click", () => {
    if (state.isAnimating) return;
    if (!flightPathMode) {
      clearSelection();
      resetRecenter();
    }
    setFlightPathMode(!flightPathMode);
  });
}

// 1st click places A, 2nd places B and draws the route, 3rd starts over.
// Shared by the main view and each compare-mode panel (see buildComparePanel),
// each passing its own svg node / zoom transform / projection to invert the click.
export function handleFlightPathClick(event, svgNode = svg.node(), zoomTransform = currentZoomTransform, projection = makeProjection(
  getProjection(state.currentProjectionId),
  rotationFor(getProjection(state.currentProjectionId))
)) {
  if (!flightPathMode || state.isAnimating) return;

  // Undo the free camera pan/zoom (see CAMERA PAN & ZOOM) to get back to the
  // coordinate space the projection itself draws in before inverting.
  const [sx, sy] = d3.pointer(event, svgNode);
  const [x, y] = zoomTransform.invert([sx, sy]);
  const coords = projection.invert([x, y]);
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
svg.node().addEventListener("click", (event) => handleFlightPathClick(event));
