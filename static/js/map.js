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
// CONTINENT → CSS VARIABLE
// Keys must match the 'continent' values in world.geojson exactly.
// ============================================================
const CONTINENT_COLOR_VAR = {
  "Africa":         "--color-africa",
  "Europe":         "--color-europe",
  "Asia":           "--color-asia",
  "North America":  "--color-north-america",
  "South America":  "--color-south-america",
  "Oceania":        "--color-oceania",
  "Antarctica":     "--color-antarctica",
};

function continentColor(continent) {
  const varName = CONTINENT_COLOR_VAR[continent];
  return varName ? `var(${varName})` : "var(--color-africa)";
}

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
    .attr("fill", (d) => continentColor(d.properties.continent))
    .attr("d", path);

  paths.attr("d", path);
}

// ============================================================
// ANIMATION HELPERS
// ============================================================

// Returns a Map<countryName, svgPathString> for every country at the given
// projection. Used as "from" or "to" snapshots by morphPaths().
// precision(Infinity) disables D3's adaptive resampling so both paths have
// identical point counts (straight from GeoJSON) — required for
// d3.interpolateString to match coordinates correctly and avoid diagonal spikes.
function computePaths(projection) {
  projection.precision(Infinity);
  const pathFn = d3.geoPath().projection(projection);
  const result = new Map();
  worldData.features.forEach((f) => {
    result.set(f.properties.name, pathFn(f) || "");
  });
  return result;
}

// Tweens all country <path d="…"> attributes from fromPaths → toPaths.
// Uses d3.interpolateString rather than flubber: we're morphing the SAME
// GeoJSON feature between two projections, so both paths share the same
// structure — only the screen coordinates differ. String interpolation is
// sufficient and avoids the NaN/self-intersection artifacts flubber produces
// on multi-polygon islands and overseas territories.
// Returns a Promise that resolves when done.
function morphPaths(fromPaths, toPaths, duration) {
  const transition = mapGroup
    .selectAll("path.country")
    .transition()
    .duration(duration)
    .ease(d3.easeCubicInOut)
    .attrTween("d", function (d) {
      const name = d.properties.name;
      const from = fromPaths.get(name) || "";
      const to   = toPaths.get(name)   || "";
      // Both empty — nothing to do
      if (!from && !to) return () => "";
      // Country newly appears (e.g. leaving Orthographic): snap to final position
      if (!from) return () => to;
      // Country disappears (e.g. entering Orthographic hidden hemisphere): hold
      // until the very last frame so it doesn't freeze mid-animation
      if (!to) return (t) => (t < 1 ? from : "");
      return d3.interpolateString(from, to);
    });
  // transition.end() resolves when all elements finish; catch silences
  // "transition cancelled" errors from rapid successive clicks.
  return transition.end().catch(() => {});
}

// ============================================================
// TRANSITION — direct morph source → target
// ============================================================
async function transitionTo(newProjId) {
  isAnimating = true;

  const fromDef = PROJECTIONS.find((p) => p.id === currentProjectionId);
  const toDef   = PROJECTIONS.find((p) => p.id === newProjId);

  const fromPaths = computePaths(makeProjection(fromDef));
  const toPaths   = computePaths(makeProjection(toDef));
  await morphPaths(fromPaths, toPaths, 1400);

  // Restore full-precision paths (with adaptive resampling) for the final rendered state.
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
// DEBUG — call debugTransitions() from the browser console to
// identify which projection pairs produce path structure mismatches.
//
// A mismatch means a country has N subpaths (M commands) in the
// "from" projection but a different count in the "to" projection —
// this is the root cause of the diagonal spike artifacts.
// ============================================================
function debugTransitions() {
  if (!worldData) { console.warn("worldData not loaded yet — wait for init()"); return; }

  const results = [];

  for (const from of PROJECTIONS) {
    for (const to of PROJECTIONS) {
      if (from.id === to.id) continue;

      const fromPaths = computePaths(makeProjection(from));
      const toPaths   = computePaths(makeProjection(to));

      const mismatched = [];
      for (const feature of worldData.features) {
        const name  = feature.properties.name;
        const f     = fromPaths.get(name) || "";
        const t     = toPaths.get(name)   || "";
        const fromM = (f.match(/M/g) || []).length;
        const toM   = (t.match(/M/g) || []).length;
        if (fromM !== toM) mismatched.push(`${name} (${fromM}→${toM})`);
      }

      if (mismatched.length > 0) {
        results.push({
          from:      from.id,
          to:        to.id,
          countries: mismatched.length,
          examples:  mismatched.slice(0, 4).join(" | ") + (mismatched.length > 4 ? " …" : ""),
        });
      }
    }
  }

  if (results.length === 0) {
    console.log("✅ No path structure mismatches found across all projection pairs.");
  } else {
    console.warn(`⚠️ ${results.length} transition pairs with path structure mismatches:`);
    console.table(results);
  }
  return results;
}

// ============================================================
// THEME SWITCHER (temporary — remove once theme is chosen)
// ============================================================
document.querySelectorAll(".theme-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.body.setAttribute("data-theme", btn.dataset.theme);
    document.querySelectorAll(".theme-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  });
});
