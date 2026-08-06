// ============================================================
// PROJECTIONS REGISTRY
//
// Each object describes one projection. The sidebar, switching
// logic, and animation all read from this array — nothing else
// needs to change when adding a projection.
//
// d3fn must return a D3 projection instance (not yet fitted to
// the viewport — that happens in makeProjection()).
// ============================================================
const PROJECTIONS = [
  {
    id: "mercator",
    name: "Mercator",
    family: "Cylindrical",
    year: 1569,
    description:
      "Preserves angles (conformal). Severely distorts area near the poles. " +
      "The standard for maritime navigation for centuries.",
    d3fn: () => d3.geoMercator(),
  },
  {
    id: "equirectangular",
    name: "Equirectangular",
    family: "Cylindrical",
    year: 100,
    description:
      "Maps longitude and latitude directly to x and y. Simple but distorts " +
      "both shape and area away from the equator.",
    d3fn: () => d3.geoEquirectangular(),
  },
  {
    id: "gallPeters",
    name: "Gall-Peters",
    family: "Cylindrical",
    year: 1855,
    description:
      "Equal-area cylindrical: every country is shown at its true relative size. " +
      "A direct political response to Mercator — Africa appears far larger than Europe.",
    // parallel(45) is the standard that makes this equal-area (James Gall, 1855;
    // re-popularised by Arno Peters in 1973, sparking the "Peters controversy")
    d3fn: () => d3.geoCylindricalEqualArea().parallel(45),
  },
  {
    id: "robinson",
    name: "Robinson",
    family: "Pseudocylindrical",
    year: 1963,
    description:
      "Visual compromise: neither conformal nor equal-area, but aesthetically " +
      "pleasing. Used by National Geographic from 1988 to 1998.",
    d3fn: () => d3.geoRobinson(),
  },
  {
    id: "mollweide",
    name: "Mollweide",
    family: "Pseudocylindrical",
    year: 1805,
    description:
      "Equal-area projection. Shapes are distorted near the edges but all " +
      "regions are represented at their true relative size.",
    d3fn: () => d3.geoMollweide(),
  },
  {
    id: "naturalEarth",
    name: "Natural Earth",
    family: "Pseudocylindrical",
    year: 2012,
    description:
      "Designed by Tom Patterson for attractive world maps. A smooth compromise " +
      "between conformal and equal-area with gently rounded poles.",
    d3fn: () => d3.geoNaturalEarth1(),
  },
  {
    id: "equalEarth",
    name: "Equal Earth",
    family: "Pseudocylindrical",
    year: 2018,
    description:
      "Modern equal-area projection inspired by Robinson's aesthetics. " +
      "Designed as an answer to Gall-Peters: true sizes without the stretching.",
    d3fn: () => d3.geoEqualEarth(),
  },
  {
    id: "eckert4",
    name: "Eckert IV",
    family: "Pseudocylindrical",
    year: 1906,
    description:
      "Equal-area projection with poles drawn as lines half the equator's length. " +
      "A favourite for thematic world maps of climate and population.",
    d3fn: () => d3.geoEckert4(),
  },
  {
    id: "sinusoidal",
    name: "Sinusoidal",
    family: "Pseudocylindrical",
    year: 1570,
    description:
      "One of the oldest pseudocylindrical projections. Equal-area, but strong " +
      "shearing distortion appears near the edges.",
    d3fn: () => d3.geoSinusoidal(),
  },
  {
    id: "orthographic",
    name: "Orthographic",
    family: "Azimuthal",
    year: 200,
    description:
      "Simulates viewing Earth from infinite distance — the 'space view'. " +
      "Only one hemisphere is visible at a time.",
    d3fn: () => d3.geoOrthographic(),
  },
  {
    id: "azimuthalEqualArea",
    name: "Azimuthal Equal Area",
    family: "Azimuthal",
    year: 1772,
    description:
      "Preserves area accurately across the entire map from a central anchor point. " +
      "Unlike Mercator, Greenland and Africa appear at their true relative sizes.",
    d3fn: () => d3.geoAzimuthalEqualArea(),
  },
  {
    id: "polarNorth",
    name: "North Polar",
    family: "Azimuthal",
    year: 1946,
    description:
      "Azimuthal equidistant centred on the North Pole — the view on the United " +
      "Nations emblem. Distances measured from the pole are true to scale.",
    // clipAngle(179) trims a 1° cap around the antipode (the South Pole),
    // where this projection is singular — Antarctica renders as the outer ring
    d3fn: () => d3.geoAzimuthalEquidistant().rotate([0, -90]).clipAngle(179),
  },
  {
    id: "polarSouth",
    name: "South Polar",
    family: "Azimuthal",
    year: 1000,
    description:
      "Azimuthal equidistant centred on the South Pole. Antarctica sits at the " +
      "centre, surrounded by the Southern Ocean and every other continent.",
    d3fn: () => d3.geoAzimuthalEquidistant().rotate([0, 90]).clipAngle(179),
  },
  {
    id: "albers",
    name: "Albers",
    family: "Conic",
    year: 1805,
    description:
      "Conic equal-area projection with two standard parallels. Best for " +
      "mid-latitude regions. Official projection for US Census maps.",
    // Recentred for a world view — default is tuned for the USA
    d3fn: () => d3.geoAlbers().rotate([0, 0]).parallels([20, 50]).scale(153),
  },
  {
    id: "winkelTripel",
    name: "Winkel Tripel",
    family: "Pseudoazimuthal",
    year: 1921,
    description:
      "Minimises the combined distortion of area, angles, and distances. " +
      "Adopted by the National Geographic Society in 1998.",
    d3fn: () => d3.geoWinkel3(),
  },
  {
    id: "aitoff",
    name: "Aitoff",
    family: "Pseudoazimuthal",
    year: 1889,
    description:
      "Modified azimuthal projection with an elliptical boundary. " +
      "Reduces polar distortion compared to cylindrical projections.",
    d3fn: () => d3.geoAitoff(),
  },
  {
    id: "hammer",
    name: "Hammer",
    family: "Pseudoazimuthal",
    year: 1892,
    description:
      "Equal-area modification of the Aitoff projection. Widely used in " +
      "astronomy to map the entire celestial sphere.",
    d3fn: () => d3.geoHammer(),
  },
];

// ============================================================
// SVG SETUP
// ============================================================
const container = document.getElementById("map-container");
const WIDTH  = container.clientWidth;
const HEIGHT = container.clientHeight;

const svg = d3
  .select("#map-svg")
  .attr("viewBox", `0 0 ${WIDTH} ${HEIGHT}`)
  .attr("preserveAspectRatio", "xMidYMid meet");

// Ocean background rectangle
svg.append("rect").attr("class", "ocean").attr("width", WIDTH).attr("height", HEIGHT);

// Group that holds all country <path> elements
const mapGroup = svg.append("g").attr("class", "countries");

// Tissot's indicatrix overlay — appended after mapGroup so it paints on top
const tissotGroup = svg.append("g").attr("class", "tissot-layer");

// Flight path overlay — appended after tissotGroup so the arc paints on top
const flightPathGroup = svg.append("g").attr("class", "flightpath-layer");

// ============================================================
// APPLICATION STATE
// ============================================================
let currentProjectionId = "mercator";
let isAnimating = false;
let worldData = null;

// ============================================================
// PROJECTION FACTORY
// fitSize scales and centres the projection to fill the viewport.
// rotationOverride (optional [lambda, phi, gamma]) recenters the sphere
// before fitting — used by the recenter presets below. Overrides any
// rotate() the projection's own d3fn already set (e.g. the polar views),
// which is why presets are disabled for those (see RECENTER_INCOMPATIBLE).
// ============================================================
function makeProjection(projDef, rotationOverride = null) {
  const projection = projDef.d3fn();
  if (rotationOverride) projection.rotate(rotationOverride);
  return projection.fitSize([WIDTH, HEIGHT], { type: "Sphere" });
}

// ============================================================
// RENDER — draw or update country paths for a given projection
// ============================================================
function renderMap(projection) {
  const path = d3.geoPath().projection(projection);

  // D3 data join keyed by country name — handles enter/update/exit
  const paths = mapGroup
    .selectAll("path.country")
    .data(worldData.features, (d) => d.properties.name);

  paths
    .enter()
    .append("path")
    .attr("class", "country")
    .attr("d", path)
    .on("click", (event, d) => {
      if (!flightPathMode) selectCountry(d);
    });

  paths.attr("d", path);
}

// ============================================================
// ANIMATION — projection blending
//
// Interpolating SVG path strings breaks whenever clipping changes
// the vertex count between two projections (Antarctica cut at the
// pole in Mercator, the giant arc in Albers, the hidden hemisphere
// in Orthographic) — countries froze then snapped. Instead we build
// a hybrid projection whose output is the linear blend of the two
// fitted projections, and reproject every country on every frame.
// Each frame is then a real projection, so D3's clipping stays
// geometrically correct throughout the morph.
// ============================================================
const DEGREES = 180 / Math.PI;

// Mercator sends the poles to y = ±Infinity, which poisons the blend for
// every t (0.05 · ∞ is still ∞, and 0 · ∞ is NaN at the endpoints).
// Clamping latitude a hair away from the poles keeps every blended
// coordinate finite; the clamped point lands ~1500px offscreen, so the
// visible map is unchanged.
const POLE_LIMIT = 89.99 / DEGREES;

// `rotation` (optional) is for blending two projections that share the same
// rotate(): pass them UNROTATED and let the wrapper rotate instead — this
// keeps clipAngle circles centred on the shared centre (e.g. a pole).
function blendProjection(projFrom, projTo, rotation = null) {
  const mutate = d3.geoProjectionMutator((t) => (lambda, phi) => {
    phi = Math.max(-POLE_LIMIT, Math.min(POLE_LIMIT, phi));
    // Raw functions receive radians; the fitted projections expect degrees
    const [xa, ya] = projFrom([lambda * DEGREES, phi * DEGREES]);
    const [xb, yb] = projTo([lambda * DEGREES, phi * DEGREES]);
    // The wrapper flips y (geographic y-up → screen y-down); pre-negating it
    // here means the blend passes the endpoints' screen coordinates through.
    return [(1 - t) * xa + t * xb, -((1 - t) * ya + t * yb)];
  });
  // D3's translate means "where (0°,0°) lands on screen", not an offset —
  // so with scale 1 the wrapper becomes an exact identity over the blended
  // output only if we pin (0°,0°) to its own blended screen position.
  const centerFrom = projFrom([0, 0]);
  const centerTo   = projTo([0, 0]);
  const projection = Object.assign(mutate(0), {
    alpha(t) {
      mutate(t);
      return projection.translate([
        (1 - t) * centerFrom[0] + t * centerTo[0],
        (1 - t) * centerFrom[1] + t * centerTo[1],
      ]);
    },
  });
  if (rotation) projection.rotate(rotation);
  // No planar clipExtent on purpose: D3's rectangle clip decides whether the
  // viewport lies *inside* a polygon from its winding, and mid-blend folds of
  // Antarctica flipped that test — filling the whole screen. The SVG viewport
  // already crops offscreen geometry visually, so planar clipping adds nothing.
  return projection.scale(1).alpha(0);
}

// Orthographic clips to the visible hemisphere (90°); everything else
// clips at the antimeridian, which a near-180° circle approximates.
// Animating between the two makes back-hemisphere countries shrink
// smoothly into the horizon instead of snapping in or out.
function clipAngleOf(projDef) {
  return projDef.id === "orthographic" ? 90 : 179.9;
}

// Drives one blend from alpha 0 → 1, optionally morphing the clip circle.
function animateBlend(projection, duration, clipFrom = null, clipTo = null) {
  const pathFn    = d3.geoPath().projection(projection);
  const countries = mapGroup.selectAll("path.country");

  return new Promise((resolve) => {
    const timer = d3.timer((elapsed) => {
      const t = d3.easeCubicInOut(Math.min(1, elapsed / duration));
      projection.alpha(t);
      if (clipFrom !== null) projection.clipAngle(clipFrom + (clipTo - clipFrom) * t);
      countries.attr("d", (d) => pathFn(d) || "");
      if (elapsed >= duration) {
        timer.stop();
        resolve();
      }
    });
  });
}

function animateTransition(fromDef, toDef, duration) {
  const projection = blendProjection(makeProjection(fromDef), makeProjection(toDef));
  const clipFrom = clipAngleOf(fromDef);
  const clipTo   = clipAngleOf(toDef);
  // Only azimuthal-hemisphere transitions need the circle clip; other
  // pairs keep D3's default antimeridian clipping untouched.
  if (clipFrom !== clipTo) return animateBlend(projection, duration, clipFrom, clipTo);
  return animateBlend(projection, duration);
}

// ============================================================
// POLAR ROUTE — via the orthographic globe
//
// A polar view sits 90° of rotation away from every other
// projection. Blending directly would drag Antarctica's ring
// across the whole map (a disc cannot become an annulus that
// encircles everything without sweeping over it). Instead:
// fold the map onto the globe, spin the globe to/from the pole
// (a true projection every frame — always clean), then unfold
// into the polar azimuthal view.
// ============================================================
const POLAR_ROTATION = { polarNorth: [0, -90], polarSouth: [0, 90] };

// Spins a real orthographic globe between two orientations.
function animateRotation(fromRot, toRot, duration) {
  const projection = d3.geoOrthographic().fitSize([WIDTH, HEIGHT], { type: "Sphere" });
  const pathFn    = d3.geoPath().projection(projection);
  const countries = mapGroup.selectAll("path.country");

  return new Promise((resolve) => {
    const timer = d3.timer((elapsed) => {
      const t = d3.easeCubicInOut(Math.min(1, elapsed / duration));
      projection.rotate([
        fromRot[0] + (toRot[0] - fromRot[0]) * t,
        fromRot[1] + (toRot[1] - fromRot[1]) * t,
      ]);
      countries.attr("d", (d) => pathFn(d) || "");
      if (elapsed >= duration) {
        timer.stop();
        resolve();
      }
    });
  });
}

// Morphs between the orthographic globe and the flat azimuthal equidistant
// disc, both centred on the same pole. Endpoints are built unrotated and the
// blend wrapper carries the rotation, so the hemisphere clip stays centred
// on the pole while it opens (90° → 179°) or closes (179° → 90°).
function animatePolarUnfold(rotation, foldToGlobe, duration) {
  const globe = d3.geoOrthographic().fitSize([WIDTH, HEIGHT], { type: "Sphere" });
  const disc  = d3.geoAzimuthalEquidistant().clipAngle(179)
    .fitSize([WIDTH, HEIGHT], { type: "Sphere" });
  const projection = foldToGlobe
    ? blendProjection(disc, globe, rotation)
    : blendProjection(globe, disc, rotation);
  return foldToGlobe
    ? animateBlend(projection, duration, 179, 90)
    : animateBlend(projection, duration, 90, 179);
}

async function polarTransition(fromDef, toDef) {
  const orthoDef = PROJECTIONS.find((p) => p.id === "orthographic");
  const fromRot  = POLAR_ROTATION[fromDef.id];
  const toRot    = POLAR_ROTATION[toDef.id];

  // Fold: reach an orthographic globe at the starting orientation
  if (fromRot) {
    await animatePolarUnfold(fromRot, true, 800);
  } else if (fromDef.id !== "orthographic") {
    await animateTransition(fromDef, orthoDef, 800);
  }

  // Spin between orientations (north↔south rolls through the equator)
  await animateRotation(fromRot || [0, 0], toRot || [0, 0], 700);

  // Unfold: from the globe to the target
  if (toRot) {
    await animatePolarUnfold(toRot, false, 800);
  } else if (toDef.id !== "orthographic") {
    await animateTransition(orthoDef, toDef, 800);
  }
}

// ============================================================
// TRANSITION — morph source → target
// ============================================================
async function transitionTo(newProjId) {
  isAnimating = true;

  // If a country is selected, dezoom to the world view *before* the morph
  // starts. The zoom is a static transform, not recomputed per animation
  // frame — staying zoomed in while the projection morphs would drift the
  // country out of the viewport mid-animation (bounds only hold for the
  // projection they were computed from), then snap once rezoomed at the
  // end. Returning to the world view first avoids that glitch entirely;
  // the morph itself is unaffected by any zoom state.
  if (selectedCountryName) {
    await new Promise((resolve) => {
      mapGroup.transition().duration(400).attr("transform", null).on("end", resolve);
    });
  }

  const fromDef = PROJECTIONS.find((p) => p.id === currentProjectionId);
  const toDef   = PROJECTIONS.find((p) => p.id === newProjId);

  if (POLAR_ROTATION[fromDef.id] || POLAR_ROTATION[toDef.id]) {
    await polarTransition(fromDef, toDef);
  } else {
    await animateTransition(fromDef, toDef, 1400);
  }

  // Final render with the true target projection (native clipping rules)
  renderMap(makeProjection(toDef));

  currentProjectionId = newProjId;
  setActiveButton(newProjId);
  updateInfo(toDef);
  refreshTissot();
  refreshRecenterAvailability();
  refreshFlightPath();

  // Rezoom on the same country in the new projection, at the same
  // zoomFactor (selectCountry/handleMapWheel already keep it projection-
  // independent — see the COUNTRY SEARCH & SELECTION comment above).
  if (selectedCountryName) {
    applyCountryZoom();
  }

  isAnimating = false;
}

// ============================================================
// INFO PANEL
// ============================================================
function updateInfo(projDef) {
  document.getElementById("info-name").textContent        = projDef.name;
  document.getElementById("info-family").textContent      = projDef.family;
  document.getElementById("info-description").textContent = projDef.description;
}

// ============================================================
// SIDEBAR — built dynamically from PROJECTIONS
// ============================================================
function buildSidebar() {
  const nav = document.getElementById("projection-list");

  PROJECTIONS.forEach((proj) => {
    const btn = document.createElement("button");
    btn.className      = "proj-btn";
    btn.id             = `btn-${proj.id}`;
    btn.dataset.projId = proj.id;
    btn.innerHTML      = `${proj.name}<span class="proj-family">${proj.family}</span>`;
    btn.addEventListener("click", () => switchProjection(proj.id));
    nav.appendChild(btn);
  });

  setActiveButton(currentProjectionId);
}

function setActiveButton(projId) {
  document.querySelectorAll(".proj-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.projId === projId);
  });
}

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
// projection always resets to World View, so the animated morph never
// has to deal with a rotation override either.
//
// The "upside-down" preset is a true vertical mirror (flipVertical),
// not a 180° rotate() — d3's rotate() performs a rigid rotation of the
// sphere, which has no fixed axis at the equator: a 180° roll there
// flips both north/south AND east/west (point symmetry), not the
// clean south-up-only mirror real upside-down maps use. Reflection
// isn't expressible as a sphere rotation, so it's applied as a 2D SVG
// transform on top of the (longitude-only) rotated render instead.
// ============================================================
const RECENTER_PRESETS = [
  { id: "world", name: "World View", rotate: null,
    description: "Default centering." },
  { id: "china", name: "China-centered", rotate: [-105, 0, 0],
    description: "Common convention in Chinese school atlases — centred near 105°E, splitting the world along the Atlantic instead of the Pacific." },
  { id: "usaPacific", name: "USA / Pacific-centered", rotate: [98, 0, 0],
    description: "Common convention in American atlases — centred near 98°W, splitting the world through Europe and Africa." },
  { id: "southAmericaFlipped", name: "South America (upside-down)", rotate: [60, 0, 0], flipVertical: true,
    description: "South-up orientation, inspired by McArthur's Universal Corrective Map (1979) — a deliberate challenge to the assumption that \"north = up\"." },
];

const RECENTER_INCOMPATIBLE = new Set(["albers", "polarNorth", "polarSouth"]);

let currentRecenterRotate = null;
let currentRecenterFlip = false;

function buildRecenterPanel() {
  const nav = document.getElementById("recenter-list");
  RECENTER_PRESETS.forEach((preset) => {
    const btn = document.createElement("button");
    btn.className = "recenter-btn" + (preset.id === "world" ? " active" : "");
    btn.dataset.presetId = preset.id;
    btn.title = preset.description;
    btn.textContent = preset.name;
    btn.addEventListener("click", () => applyRecenter(preset.id));
    nav.appendChild(btn);
  });
}

// Mirrors mapGroup/tissotGroup vertically about the viewport's horizontal
// centreline (translate(0,H) scale(1,-1)) when the active preset asks for
// it, or clears the transform otherwise.
function applyRecenterFlip() {
  const flipTransform = currentRecenterFlip ? `translate(0, ${HEIGHT}) scale(1, -1)` : null;
  mapGroup.attr("transform", flipTransform);
  tissotGroup.attr("transform", flipTransform);
}

function applyRecenter(presetId) {
  if (isAnimating || RECENTER_INCOMPATIBLE.has(currentProjectionId)) return;

  if (flightPathMode) setFlightPathMode(false); // mutually exclusive, see FLIGHT PATH note

  const preset = RECENTER_PRESETS.find((p) => p.id === presetId);
  currentRecenterRotate = preset.rotate;
  currentRecenterFlip = !!preset.flipVertical;

  document.querySelectorAll(".recenter-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.presetId === presetId);
  });

  clearSelection(); // mutually exclusive with the country-zoom selection, see note above

  const currentDef = PROJECTIONS.find((p) => p.id === currentProjectionId);
  renderMap(makeProjection(currentDef, currentRecenterRotate));
  applyRecenterFlip();
  refreshTissot();
}

function resetRecenter() {
  currentRecenterRotate = null;
  currentRecenterFlip = false;
  // Cleared synchronously (no transition): if a projection switch is about
  // to run, the morph must not inherit a leftover flip transform on the
  // group it repaints into.
  mapGroup.attr("transform", null);
  tissotGroup.attr("transform", null);
  document.querySelectorAll(".recenter-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.presetId === "world");
  });
}

function refreshRecenterAvailability() {
  document.getElementById("recenter-list").classList.toggle("disabled-list", RECENTER_INCOMPATIBLE.has(currentProjectionId));
}

// ============================================================
// SWITCH PROJECTION
// ============================================================
function switchProjection(newProjId) {
  if (isAnimating || newProjId === currentProjectionId) return;
  if (!PROJECTIONS.find((p) => p.id === newProjId)) return;
  closeSidebar(); // no-op on desktop; on mobile, reveals the map after picking
  resetRecenter(); // presets don't survive a projection change, see RECENTER PRESETS note
  transitionTo(newProjId);
}

// ============================================================
// COUNTRY SEARCH & SELECTION
//
// Selecting a country (via search or a click on the map) pans/
// zooms the SVG country group to its bounding box and highlights
// it. This is a plain transform on top of the existing rendered
// paths — no projection recalculation — so it behaves identically
// across all 17 projections.
//
// Zoom is tracked as `zoomFactor`, a multiplier on top of the
// country's default auto-fit scale for whatever projection is
// currently active — not an absolute SVG scale. A fitted scale
// number is projection-specific (each projection's fitSize picks a
// different base scale to fill the same viewport), so "zoomed in
// 3x past the default framing" is the only notion of zoom that
// stays meaningful across a projection switch (see transitionTo,
// which dezooms before the morph and rezooms after at the same
// zoomFactor).
// ============================================================
const searchInput   = document.getElementById("country-search-input");
const searchResults = document.getElementById("country-search-results");
const clearBtn       = document.getElementById("country-search-clear");

const BASE_MAX_SCALE = 8;  // default auto-fit cap, as a fraction of the viewport
const MAX_ZOOM_FACTOR = 6; // ceiling for manual wheel zoom past the default framing

let selectedCountryName = null;
let zoomFactor = 1;

// Bounding-box fit for `feature` under `projDef`, in that projection's own
// fitted coordinate space — recomputed fresh since it depends on whichever
// projection is currently on screen.
function computeCountryFit(feature, projDef) {
  const pathFn = d3.geoPath().projection(makeProjection(projDef));
  const [[x0, y0], [x1, y1]] = pathFn.bounds(feature);
  const PADDING = 60;
  const scale = Math.min(
    (WIDTH - PADDING) / Math.max(x1 - x0, 1),
    (HEIGHT - PADDING) / Math.max(y1 - y0, 1),
    BASE_MAX_SCALE
  );
  return { scale, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

// Applies the current selection + zoomFactor as a transform on mapGroup.
// duration=0 skips the transition for per-frame wheel updates.
function applyCountryZoom(duration = 600) {
  const feature = worldData.features.find((f) => f.properties.name === selectedCountryName);
  const projDef = PROJECTIONS.find((p) => p.id === currentProjectionId);
  const fit     = computeCountryFit(feature, projDef);
  const scale   = fit.scale * zoomFactor;
  const translateX = WIDTH / 2 - scale * fit.cx;
  const translateY = HEIGHT / 2 - scale * fit.cy;
  const transformStr = `translate(${translateX},${translateY}) scale(${scale})`;

  if (duration > 0) {
    mapGroup.transition().duration(duration).attr("transform", transformStr);
  } else {
    mapGroup.attr("transform", transformStr);
  }
}

function selectCountry(feature) {
  if (!feature) return;

  if (flightPathMode) setFlightPathMode(false); // mutually exclusive, see FLIGHT PATH note

  // Mutually exclusive with recenter presets (see RECENTER PRESETS note):
  // the map must be re-rendered unrotated before we compute/zoom to bounds,
  // since applyCountryZoom's bbox math assumes the default orientation.
  if (currentRecenterRotate) {
    resetRecenter();
    renderMap(makeProjection(PROJECTIONS.find((p) => p.id === currentProjectionId)));
    refreshTissot();
  }

  selectedCountryName = feature.properties.name;
  zoomFactor = 1;

  mapGroup
    .selectAll("path.country")
    .classed("selected", (d) => d.properties.name === selectedCountryName);

  applyCountryZoom();

  searchInput.value = selectedCountryName;
  clearBtn.hidden = false;
  hideResults();

  if (compareMode) comparePanels.forEach(applySelectionToPanel);
}

// Wheel-to-zoom, centred on the selected country's bounding-box centre.
// Only active while a country is selected and no transition is running.
function handleMapWheel(event) {
  if (!selectedCountryName || isAnimating) return;
  event.preventDefault();
  const factor = Math.exp(-event.deltaY * 0.0015);
  zoomFactor = Math.min(MAX_ZOOM_FACTOR, Math.max(1, zoomFactor * factor));
  applyCountryZoom(0);
}
svg.node().addEventListener("wheel", handleMapWheel, { passive: false });

function clearSelection() {
  if (!selectedCountryName) return;
  selectedCountryName = null;
  zoomFactor = 1;

  mapGroup.selectAll("path.country").classed("selected", false);
  mapGroup.transition().duration(400).attr("transform", null);

  searchInput.value = "";
  clearBtn.hidden = true;

  if (compareMode) comparePanels.forEach(applySelectionToPanel);
}

function hideResults() {
  searchResults.hidden = true;
  searchResults.innerHTML = "";
}

function showResults(matches) {
  searchResults.innerHTML = "";
  matches.forEach((feature) => {
    const li = document.createElement("li");
    li.textContent = feature.properties.name;
    li.addEventListener("click", () => selectCountry(feature));
    searchResults.appendChild(li);
  });
  searchResults.hidden = matches.length === 0;
}

searchInput.addEventListener("input", () => {
  const query = searchInput.value.trim().toLowerCase();
  if (!query || !worldData) {
    hideResults();
    return;
  }
  const matches = worldData.features
    .filter((f) => f.properties.name.toLowerCase().includes(query))
    .sort((a, b) => {
      const nameA = a.properties.name.toLowerCase();
      const nameB = b.properties.name.toLowerCase();
      return nameA.indexOf(query) - nameB.indexOf(query);
    })
    .slice(0, 8);
  showResults(matches);
});

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    const query = searchInput.value.trim().toLowerCase();
    const match = worldData?.features.find((f) => f.properties.name.toLowerCase().includes(query));
    if (match) selectCountry(match);
  } else if (event.key === "Escape") {
    clearSelection();
  }
});

clearBtn.addEventListener("click", clearSelection);

// ============================================================
// SIDE-BY-SIDE COMPARISON MODE
//
// Two independent panels, each with its own projection dropdown
// and its own D3 projection/render pipeline. Switching a panel's
// projection is instant — no morph animation — to keep two
// independent animation timelines out of scope for now. Country
// selection (the search UI above) is shared and applies to both
// panels at once, since comparing one country's distortion across
// two projections is the point of this mode.
// ============================================================
const compareToggleBtn = document.getElementById("compare-toggle");
const mapContainerEl   = document.getElementById("map-container");
const infoEl           = document.getElementById("projection-info");
const compareContainer = document.getElementById("compare-container");
const projectionListEl = document.getElementById("projection-list");

let compareMode = false;
let comparePanels = null; // built lazily on first toggle-on, once panel sizes are known

function buildComparePanel(panelEl, initialProjId) {
  const select = panelEl.querySelector(".compare-select");
  PROJECTIONS.forEach((proj) => {
    const option = document.createElement("option");
    option.value = proj.id;
    option.textContent = proj.name;
    select.appendChild(option);
  });
  select.value = initialProjId;

  const width  = panelEl.clientWidth;
  const height = panelEl.querySelector(".compare-svg").clientHeight;

  const svg = d3
    .select(panelEl.querySelector(".compare-svg"))
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  svg.append("rect").attr("class", "ocean").attr("width", width).attr("height", height);
  const panel = {
    projId: initialProjId,
    mapGroup: svg.append("g").attr("class", "countries"),
    tissotGroup: svg.append("g").attr("class", "tissot-layer"),
    width,
    height,
  };

  panel.render = () => {
    const projDef     = PROJECTIONS.find((p) => p.id === panel.projId);
    const projection  = projDef.d3fn().fitSize([panel.width, panel.height], { type: "Sphere" });
    const pathFn       = d3.geoPath().projection(projection);
    const paths = panel.mapGroup
      .selectAll("path.country")
      .data(worldData.features, (d) => d.properties.name);
    paths.enter().append("path").attr("class", "country").attr("d", pathFn);
    paths.attr("d", pathFn);
  };
  panel.render();

  select.addEventListener("change", () => {
    panel.projId = select.value;
    panel.render();
    applySelectionToPanel(panel);
    refreshTissot();
  });

  return panel;
}

// Mirrors the shared search selection (highlight + zoom) onto one panel.
function applySelectionToPanel(panel) {
  panel.mapGroup
    .selectAll("path.country")
    .classed("selected", (d) => d.properties.name === selectedCountryName);

  if (!selectedCountryName) {
    panel.mapGroup.transition().duration(400).attr("transform", null);
    return;
  }

  const feature = worldData.features.find((f) => f.properties.name === selectedCountryName);
  const projDef = PROJECTIONS.find((p) => p.id === panel.projId);
  const pathFn  = d3.geoPath().projection(projDef.d3fn().fitSize([panel.width, panel.height], { type: "Sphere" }));
  const [[x0, y0], [x1, y1]] = pathFn.bounds(feature);

  const PADDING   = 40;
  const MAX_SCALE = 8;
  const scale = Math.min(
    (panel.width - PADDING) / Math.max(x1 - x0, 1),
    (panel.height - PADDING) / Math.max(y1 - y0, 1),
    MAX_SCALE
  );
  const translateX = panel.width / 2 - scale * ((x0 + x1) / 2);
  const translateY = panel.height / 2 - scale * ((y0 + y1) / 2);

  panel.mapGroup
    .transition()
    .duration(600)
    .attr("transform", `translate(${translateX},${translateY}) scale(${scale})`);
}

compareToggleBtn.addEventListener("click", () => {
  compareMode = !compareMode;
  compareToggleBtn.classList.toggle("active", compareMode);
  projectionListEl.classList.toggle("disabled-list", compareMode);
  document.getElementById("recenter-list").classList.toggle("disabled-list", compareMode);
  mapContainerEl.hidden   = compareMode;
  infoEl.hidden           = compareMode;
  compareContainer.hidden = !compareMode;

  if (!compareMode) return;

  if (!comparePanels) {
    const panelEls = document.querySelectorAll(".compare-panel");
    const rightDefaultId = PROJECTIONS.some((p) => p.id === "gallPeters") ? "gallPeters" : PROJECTIONS[1].id;
    comparePanels = [
      buildComparePanel(panelEls[0], currentProjectionId),
      buildComparePanel(panelEls[1], rightDefaultId),
    ];
  } else {
    comparePanels.forEach((p) => p.render());
  }
  comparePanels.forEach(applySelectionToPanel);
  refreshTissot();
});

// ============================================================
// MOBILE SIDEBAR TOGGLE
// The sidebar becomes an off-canvas drawer under the mobile
// breakpoint (see the media query in style.css); this button and
// backdrop only have a visual effect there — desktop layout is
// untouched since #sidebar-toggle stays display:none above 768px.
// ============================================================
const sidebarToggleBtn = document.getElementById("sidebar-toggle");
const sidebarBackdrop  = document.getElementById("sidebar-backdrop");
const sidebarEl        = document.getElementById("sidebar");

function closeSidebar() {
  sidebarEl.classList.remove("open");
  sidebarBackdrop.hidden = true;
}

sidebarToggleBtn.addEventListener("click", () => {
  const willOpen = !sidebarEl.classList.contains("open");
  sidebarEl.classList.toggle("open", willOpen);
  sidebarBackdrop.hidden = !willOpen;
});

sidebarBackdrop.addEventListener("click", closeSidebar);

// ============================================================
// TISSOT'S INDICATRIX OVERLAY
//
// A grid of identically-sized geographic circles, projected like
// any other geometry. Each circle becomes an ellipse whose shape
// and size reveal the projection's local distortion — the
// standard cartography tool for comparing projections objectively.
// Toggled on demand; recomputed on projection switch and (if
// active) mirrored onto both comparison panels.
// ============================================================
const tissotToggleBtn = document.getElementById("tissot-toggle");

const TISSOT_STEP   = 30; // degrees between grid points
const TISSOT_RADIUS = 4;  // degrees — the geographic circle radius

const tissotPoints = [];
for (let lat = -90 + TISSOT_STEP; lat <= 90 - TISSOT_STEP; lat += TISSOT_STEP) {
  for (let lon = -180; lon < 180; lon += TISSOT_STEP) {
    tissotPoints.push([lon, lat]);
  }
}

let tissotVisible = false;

// Isolated ellipses don't read as "a grid" on their own — the graticule
// (meridian/parallel lines, same 30° step as the circle spacing) gives
// the eye a reference frame, same as any textbook Tissot illustration.
const tissotGraticule = d3.geoGraticule().step([TISSOT_STEP, TISSOT_STEP]);

function renderTissot(group, projection) {
  const pathFn = d3.geoPath().projection(projection);

  const grid = group.selectAll("path.tissot-graticule").data([tissotGraticule()]);
  grid.enter().append("path").attr("class", "tissot-graticule").merge(grid).attr("d", pathFn);

  const circles = group.selectAll("path.tissot").data(tissotPoints);
  circles
    .enter()
    .append("path")
    .attr("class", "tissot")
    .merge(circles)
    .attr("d", (d) => pathFn(d3.geoCircle().center(d).radius(TISSOT_RADIUS)()));
  circles.exit().remove();
}

function clearTissot(group) {
  group.selectAll("path.tissot, path.tissot-graticule").remove();
}

// Re-renders (or clears) the overlay on the single map and, if active,
// on both comparison panels — called after any projection change.
function refreshTissot() {
  if (!tissotVisible) {
    clearTissot(tissotGroup);
    if (compareMode && comparePanels) comparePanels.forEach((p) => clearTissot(p.tissotGroup));
    return;
  }

  const currentDef = PROJECTIONS.find((p) => p.id === currentProjectionId);
  renderTissot(tissotGroup, makeProjection(currentDef, currentRecenterRotate));

  if (compareMode && comparePanels) {
    comparePanels.forEach((panel) => {
      const projDef = PROJECTIONS.find((p) => p.id === panel.projId);
      renderTissot(panel.tissotGroup, projDef.d3fn().fitSize([panel.width, panel.height], { type: "Sphere" }));
    });
  }
}

tissotToggleBtn.addEventListener("click", () => {
  tissotVisible = !tissotVisible;
  tissotToggleBtn.classList.toggle("active", tissotVisible);
  refreshTissot();
});

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
// refreshTissot(). Mutually exclusive with country selection and
// recenter presets (same convention those two already use with each
// other): turning flight-path mode on clears both; selecting a
// country or a recenter preset turns flight-path mode off.
// ============================================================
const flightPathToggleBtn  = document.getElementById("flightpath-toggle");
const flightPathDistanceEl = document.getElementById("flightpath-distance");

const EARTH_RADIUS_KM = 6371;

let flightPathMode = false;
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
function refreshFlightPath() {
  const currentDef = PROJECTIONS.find((p) => p.id === currentProjectionId);
  renderFlightPath(flightPathGroup, makeProjection(currentDef, currentRecenterRotate));

  if (compareMode && comparePanels) {
    comparePanels.forEach((panel) => {
      const projDef = PROJECTIONS.find((p) => p.id === panel.projId);
      renderFlightPath(panel.flightPathGroup, projDef.d3fn().fitSize([panel.width, panel.height], { type: "Sphere" }));
    });
  }

  updateFlightPathDistanceLabel();
}

function setFlightPathMode(active) {
  flightPathMode = active;
  flightPathToggleBtn.classList.toggle("active", flightPathMode);
  flightPathA = null;
  flightPathB = null;
  refreshFlightPath();
}

flightPathToggleBtn.addEventListener("click", () => {
  if (isAnimating) return;
  if (!flightPathMode) {
    clearSelection();
    resetRecenter();
  }
  setFlightPathMode(!flightPathMode);
});

// 1st click places A, 2nd places B and draws the route, 3rd starts over.
function handleFlightPathClick(event) {
  if (!flightPathMode || isAnimating) return;

  const currentDef = PROJECTIONS.find((p) => p.id === currentProjectionId);
  const projection = makeProjection(currentDef, currentRecenterRotate);
  const [x, y] = d3.pointer(event, svg.node());
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
svg.node().addEventListener("click", handleFlightPathClick);

// ============================================================
// INIT — fetch GeoJSON then render
// ============================================================
async function init() {
  const response = await fetch("/data/world.geojson");
  worldData = await response.json();

  const initialProj = PROJECTIONS.find((p) => p.id === currentProjectionId);
  buildSidebar();
  buildRecenterPanel();
  renderMap(makeProjection(initialProj));
  updateInfo(initialProj);
  refreshTissot();
  refreshRecenterAvailability();
  refreshFlightPath();
}

init();

// ============================================================
// THEME SWITCHER
// Persists the chosen theme in localStorage so it survives page
// reloads and stays constant across projection switches.
// ============================================================
const THEME_STORAGE_KEY = "mapProjektorTheme";

function applyTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  document.querySelectorAll(".theme-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.theme === theme);
  });
}

const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
if (savedTheme !== null) {
  applyTheme(savedTheme);
}

document.querySelectorAll(".theme-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    applyTheme(btn.dataset.theme);
    localStorage.setItem(THEME_STORAGE_KEY, btn.dataset.theme);
  });
});
