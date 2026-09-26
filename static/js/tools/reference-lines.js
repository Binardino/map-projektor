import { PROJECTIONS } from "../data/projections.js";
import { state } from "../core/state.js";
import { makeProjection } from "../core/projection.js";
import { referenceGroup } from "../core/scene.js";
import { rotationFor } from "../core/recenter.js";

// ============================================================
// REFERENCE LINES
//
// The named parallels (equator, tropics, polar circles) plus a
// meridian every 15° — one per hour of Earth's rotation, the usual
// atlas spacing — with the equator and Greenwich drawn heavier as
// the two origins. Main view only, like the other overlays that
// live in worldGroup (so they follow recentring and the flip).
// ============================================================
const TROPIC_LAT       = 23.44; // Earth's axial tilt
const POLAR_CIRCLE_LAT = 90 - TROPIC_LAT;
const MERIDIAN_STEP    = 15;

// A parallel is a small circle, not a great circle: two far-apart
// vertices would be joined by the shortest arc between them, which
// bows towards the pole. Dense vertices make the line follow the
// latitude instead.
function parallel(lat) {
  return d3.range(-180, 180 + 1, 2).map((lon) => [lon, lat]);
}

// Through the equator rather than pole to pole in one segment: the two
// poles are antipodal, so the great arc between them is undefined.
function meridian(lon) {
  return [[lon, -90], [lon, 0], [lon, 90]];
}

const REFERENCE_LINES = [
  { kind: "major", coordinates: [parallel(0), meridian(0)] },
  { kind: "parallel", coordinates: [TROPIC_LAT, -TROPIC_LAT, POLAR_CIRCLE_LAT, -POLAR_CIRCLE_LAT].map(parallel) },
  {
    kind: "meridian",
    coordinates: d3.range(-180 + MERIDIAN_STEP, 180, MERIDIAN_STEP).filter((lon) => lon !== 0).map(meridian),
  },
].map(({ kind, coordinates }) => ({ kind, geometry: { type: "MultiLineString", coordinates } }));

function renderReferenceLines(group, projection) {
  const path = d3.geoPath().projection(projection);
  group
    .selectAll("path.reference-line")
    .data(REFERENCE_LINES)
    .join("path")
    .attr("class", (d) => `reference-line reference-${d.kind}`)
    .attr("d", (d) => path(d.geometry));
}

// Per-frame variant for the animations: re-paths without the data join.
export function updateReferencePaths(group, projection) {
  const path = d3.geoPath().projection(projection);
  group.selectAll("path.reference-line").attr("d", (d) => path(d.geometry));
}

export let referenceVisible = false;
const referenceToggleBtn = document.getElementById("reference-toggle-btn");

// Called wherever the main view's projection or rotation settles, next to
// refreshTissot — the lines must be re-projected, not just re-shown.
export function refreshReferenceLines() {
  if (!referenceVisible) {
    referenceGroup.selectAll("path.reference-line").remove();
    return;
  }
  const currentDef = PROJECTIONS.find((p) => p.id === state.currentProjectionId);
  renderReferenceLines(referenceGroup, makeProjection(currentDef, rotationFor(currentDef)));
}

referenceToggleBtn.addEventListener("click", () => {
  referenceVisible = !referenceVisible;
  referenceToggleBtn.classList.toggle("active", referenceVisible);
  referenceToggleBtn.setAttribute("aria-pressed", String(referenceVisible));
  refreshReferenceLines();
});
