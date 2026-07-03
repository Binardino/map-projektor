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

// ============================================================
// APPLICATION STATE
// ============================================================
let currentProjectionId = "mercator";
let isAnimating = false;
let worldData = null;

// ============================================================
// PROJECTION FACTORY
// fitSize scales and centres the projection to fill the viewport.
// ============================================================
function makeProjection(projDef) {
  return projDef.d3fn().fitSize([WIDTH, HEIGHT], { type: "Sphere" });
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
    .attr("d", path);

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

function blendProjection(projFrom, projTo) {
  const mutate = d3.geoProjectionMutator((t) => (lambda, phi) => {
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
  return projection
    .scale(1)
    .clipExtent([[0, 0], [WIDTH, HEIGHT]])
    .alpha(0);
}

// Orthographic clips to the visible hemisphere (90°); everything else
// clips at the antimeridian, which a near-180° circle approximates.
// Animating between the two makes back-hemisphere countries shrink
// smoothly into the horizon instead of snapping in or out.
function clipAngleOf(projDef) {
  return projDef.id === "orthographic" ? 90 : 179.9;
}

function animateTransition(fromDef, toDef, duration) {
  const projection = blendProjection(makeProjection(fromDef), makeProjection(toDef));
  const clipFrom = clipAngleOf(fromDef);
  const clipTo   = clipAngleOf(toDef);
  // Only azimuthal-hemisphere transitions need the circle clip; other
  // pairs keep D3's default antimeridian clipping untouched.
  const morphClip = clipFrom !== clipTo;

  const pathFn    = d3.geoPath().projection(projection);
  const countries = mapGroup.selectAll("path.country");

  return new Promise((resolve) => {
    const timer = d3.timer((elapsed) => {
      const t = d3.easeCubicInOut(Math.min(1, elapsed / duration));
      projection.alpha(t);
      if (morphClip) projection.clipAngle(clipFrom + (clipTo - clipFrom) * t);
      countries.attr("d", (d) => pathFn(d) || "");
      if (elapsed >= duration) {
        timer.stop();
        resolve();
      }
    });
  });
}

// ============================================================
// TRANSITION — direct morph source → target
// ============================================================
async function transitionTo(newProjId) {
  isAnimating = true;

  const fromDef = PROJECTIONS.find((p) => p.id === currentProjectionId);
  const toDef   = PROJECTIONS.find((p) => p.id === newProjId);

  await animateTransition(fromDef, toDef, 1400);

  // Final render with the true target projection (native clipping rules)
  renderMap(makeProjection(toDef));

  currentProjectionId = newProjId;
  setActiveButton(newProjId);
  updateInfo(toDef);
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
// SWITCH PROJECTION
// ============================================================
function switchProjection(newProjId) {
  if (isAnimating || newProjId === currentProjectionId) return;
  if (!PROJECTIONS.find((p) => p.id === newProjId)) return;
  transitionTo(newProjId);
}

// ============================================================
// INIT — fetch GeoJSON then render
// ============================================================
async function init() {
  const response = await fetch("/data/world.geojson");
  worldData = await response.json();

  const initialProj = PROJECTIONS.find((p) => p.id === currentProjectionId);
  buildSidebar();
  renderMap(makeProjection(initialProj));
  updateInfo(initialProj);
}

init();

// ============================================================
// THEME SWITCHER
// ============================================================
document.querySelectorAll(".theme-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.body.setAttribute("data-theme", btn.dataset.theme);
    document.querySelectorAll(".theme-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  });
});
