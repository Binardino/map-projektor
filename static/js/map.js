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
    tradeoffs: {
      preserves: "Angles and shapes locally (conformal) — a straight line on the map is a constant compass bearing.",
      distorts: "Area, dramatically, away from the equator — Greenland appears larger than Africa despite being 14x smaller.",
      bestFor: "Nautical and aviation navigation, web maps at street-level zoom.",
    },
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
    tradeoffs: {
      preserves: "Nothing exactly, but distances along meridians and the equator are true to scale.",
      distorts: "Both shape and area, worsening toward the poles — a 1:1 lon/lat grid is not a neutral choice.",
      bestFor: "Simplicity and raw geographic data (it's just the coordinates), not display accuracy.",
    },
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
    tradeoffs: {
      preserves: "Area exactly — every landmass is shown at its true relative size.",
      distorts: "Shape severely near the equator and poles — continents look visibly stretched vertically.",
      bestFor: "Thematic maps where relative size matters more than recognizable shape (population, resources).",
    },
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
    tradeoffs: {
      preserves: "Nothing exactly — it's a table-based compromise, tuned by eye rather than a strict formula.",
      distorts: "Everything a little (area, shape, distance) rather than any one thing a lot.",
      bestFor: "General-purpose reference world maps where no single property needs to be exact.",
    },
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
    tradeoffs: {
      preserves: "Area exactly, within an elliptical world outline.",
      distorts: "Shape strongly near the outer edge of the ellipse, especially at high latitudes.",
      bestFor: "Global thematic maps (e.g. star charts, world distributions) where area is what matters.",
    },
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
    tradeoffs: {
      preserves: "Nothing exactly — another eyeballed compromise, tuned specifically to look natural at a glance.",
      distorts: "Area and shape both, mildly, worst at high latitudes near the rounded poles.",
      bestFor: "Wall maps and general reference where visual appeal matters more than any measurable property.",
    },
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
    tradeoffs: {
      preserves: "Area exactly, while keeping shapes visibly less stretched than Gall-Peters.",
      distorts: "Shape moderately near the poles, though far less severely than older equal-area projections.",
      bestFor: "Modern replacement for Gall-Peters — true-size thematic maps that still look natural.",
    },
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
    tradeoffs: {
      preserves: "Area exactly, with a rounded outline that reads comfortably at world scale.",
      distorts: "Shape at high latitudes, where landmasses compress toward the half-length pole lines.",
      bestFor: "Thematic climate/population maps — the same equal-area guarantee as Mollweide, gentler shape.",
    },
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
    tradeoffs: {
      preserves: "Area exactly, and distance is true along the equator and every meridian.",
      distorts: "Shape severely at the outer edges — a strong diagonal shear near high longitudes at high latitudes.",
      bestFor: "Historical interest and equal-area work that specifically needs true meridian distances.",
    },
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
    tradeoffs: {
      preserves: "The visual perspective of a globe seen from space — the only projection here that looks like a sphere.",
      distorts: "Area and shape increasingly toward the visible edge (the limb), where the surface is nearly edge-on.",
      bestFor: "Intuitive 'globe' views and showing a single hemisphere or region in spatial context.",
    },
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
    tradeoffs: {
      preserves: "Area exactly from its center point outward, and direction from that same center.",
      distorts: "Shape more and more with distance from the center — regions near the antipode get squeezed into the outer rim.",
      bestFor: "Maps centered on one point of interest where true area from that point matters (e.g. flight-range studies).",
    },
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
    tradeoffs: {
      preserves: "Distance from the North Pole to anywhere else — that's the one property equidistant guarantees.",
      distorts: "Area and shape severely near the outer edge, where Antarctica is stretched into a ring around the map.",
      bestFor: "Polar-region maps and anything where 'distance from this one point' is the property that matters.",
    },
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
    tradeoffs: {
      preserves: "Distance from the South Pole to anywhere else, same guarantee as the North Polar view mirrored.",
      distorts: "Area and shape severely near the outer edge, where the Arctic is stretched into the outer ring instead.",
      bestFor: "Southern-hemisphere and Antarctic-focused maps — a viewpoint almost never seen on a default world map.",
    },
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
    tradeoffs: {
      preserves: "Area exactly, and shape stays accurate between its two standard parallels (here 20°N and 50°N).",
      distorts: "Shape more and more the further a region sits from those two parallels — poor for global/equatorial use.",
      bestFor: "Mid-latitude regional maps of a single country or continent (its original purpose: the continental US).",
    },
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
    tradeoffs: {
      preserves: "Nothing exactly, but keeps area, angle, and distance distortion all simultaneously low.",
      distorts: "A little of everything by design — the explicit tradeoff its name promises (a 'tripel' compromise).",
      bestFor: "General-purpose world reference maps — National Geographic's current standard for this reason.",
    },
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
    tradeoffs: {
      preserves: "Nothing exactly — neither conformal nor equal-area, a geometric compromise built for a pleasing outline.",
      distorts: "Both shape and area, moderately, worst near the outer edge of the ellipse.",
      bestFor: "Historical/reference use — mostly superseded today by its equal-area descendant, Hammer.",
    },
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
    tradeoffs: {
      preserves: "Area exactly, inheriting Aitoff's pleasing elliptical outline.",
      distorts: "Shape near the outer edge of the ellipse, though less severely than Aitoff or Mollweide.",
      bestFor: "Whole-sky/whole-world equal-area maps — astronomy's default for all-sky projections.",
    },
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

// Ocean background rectangle — stays outside the zoom layer so it always
// fills the viewport regardless of the current pan/zoom transform, and
// swaps to the globe backdrop color (see updateGlobeBackground) whenever
// the orthographic view is active.
const oceanRect = svg.append("rect").attr("class", "ocean").attr("width", WIDTH).attr("height", HEIGHT);

// Zoom layer — receives the free pan/zoom transform (see CAMERA PAN & ZOOM
// below). Everything that pans/zooms with the map lives inside it.
const zoomLayer = svg.append("g").attr("class", "viewport");

// Sphere outline — a distinct shape (not just the background rect) so the
// globe's edge is visible against the void backdrop in orthographic view.
// Appended before mapGroup so countries paint on top of it.
const globeSphere = zoomLayer.append("path").attr("class", "globe-sphere");

// Group that holds all country <path> elements
const mapGroup = zoomLayer.append("g").attr("class", "countries");

// Mountain range/plateau terrain patches — appended after mapGroup so they
// paint over the flat country fill, purely decorative (pointer-events:none
// in CSS so clicks still reach the country underneath).
const terrainGroup = zoomLayer.append("g").attr("class", "terrain-layer");

// Tissot's indicatrix overlay — appended after mapGroup so it paints on top
const tissotGroup = zoomLayer.append("g").attr("class", "tissot-layer");

// Flight path overlay — appended after tissotGroup so the arc paints on top
const flightPathGroup = zoomLayer.append("g").attr("class", "flightpath-layer");

// True-size country shapes — appended last so dragged shapes paint on top
// of everything else. Main view only (not mirrored to compare panels).
const truesizeGroup = zoomLayer.append("g").attr("class", "truesize-layer");

// ============================================================
// APPLICATION STATE
// ============================================================
// Defaults to the orthographic globe — the "space view" reads better as a
// first impression than a flat map, per UX feedback.
let currentProjectionId = "orthographic";
let isAnimating = false;

// The globe view needs its own darker backdrop instead of the flat-map
// ocean color for the space outside the sphere disc.
function updateGlobeBackground() {
  const isGlobe = currentProjectionId === "orthographic";
  oceanRect.classed("globe-bg", isGlobe);
  globeSphere.classed("active", isGlobe);
}
let worldData = null;
let terrainData = null;

// ============================================================
// PROJECTION FACTORY
// fitSize scales and centres the projection to fill the viewport.
// rotationOverride (optional [lambda, phi, gamma]) recenters the sphere
// before fitting — used by the recenter presets below. Overrides any
// rotate() the projection's own d3fn already set (e.g. the polar views),
// which is why presets are disabled for those (see RECENTER_INCOMPATIBLE).
//
// Mercator is a special case: its y-coordinate diverges near the poles,
// so even bounded at the sphere's outline its natural fitted aspect ratio
// is close to square — much taller relative to its width than this app's
// wide map viewport. fitSize would then fit to the viewport's height and
// leave large empty margins on the sides (reported as "Mercator looks too
// small"/"whitespace on both sides"). Real-world Mercator world maps fit
// to width instead, so we do the same: fit to width and vertically center
// the initial framing, rather than shrinking the whole map to fit the
// height too. Deliberately not clipped to the viewport — the polar regions
// (Greenland, northern Russia, Antarctica) extend past the initial frame
// but stay reachable by panning the free camera (see CAMERA PAN & ZOOM)
// instead of being permanently cropped away. Shared by makeProjection
// below and by the comparison panels, which fit independently to their
// own size.
// ============================================================
function fitProjection(projDef, projection, width, height) {
  if (projDef.id === "mercator") {
    projection.fitWidth(width, { type: "Sphere" });
    const [[, y0], [, y1]] = d3.geoPath().projection(projection).bounds({ type: "Sphere" });
    const verticalOverflow = (y1 - y0) - height;
    const [tx, ty] = projection.translate();
    projection.translate([tx, ty - verticalOverflow / 2]);
    return projection;
  }
  return projection.fitSize([width, height], { type: "Sphere" });
}

function makeProjection(projDef, rotationOverride = null) {
  const projection = projDef.d3fn();
  if (rotationOverride) projection.rotate(rotationOverride);
  return fitProjection(projDef, projection, WIDTH, HEIGHT);
}

// ============================================================
// RENDER — draw or update country paths for a given projection
// ============================================================
// Draws the sphere's own boundary as a real shape (ocean-colored, with a
// stroke) rather than relying on the background rect, so the globe's edge
// reads clearly against the void backdrop in orthographic view.
function renderGlobeSphere(pathEl, projection) {
  const path = d3.geoPath().projection(projection);
  pathEl.attr("d", path({ type: "Sphere" }));
}

function renderMap(projection) {
  const path = d3.geoPath().projection(projection);

  renderGlobeSphere(globeSphere, projection);

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

  renderTerrain(terrainGroup, projection);
}

// Draws the terrain patches (mountains, deserts, forest-basin proxies —
// see fetch_geodata.py's "kind" property). Positional (unkeyed) join like
// the Tissot circles — terrainData is a fixed array loaded once, and some
// Natural Earth features share the same name (e.g. two "Transantarctic
// Mountains" entries), which breaks a name-keyed join. Always on (no
// toggle — purely decorative terrain texture).
function renderTerrain(group, projection) {
  const path = d3.geoPath().projection(projection);

  const patches = group.selectAll("path.terrain-patch").data(terrainData.features);

  patches
    .enter()
    .append("path")
    .attr("class", (d) => `terrain-patch terrain-${d.properties.kind}`)
    .merge(patches)
    .attr("d", path);
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
      renderGlobeSphere(globeSphere, projection);
      renderTerrain(terrainGroup, projection);
      if (tissotVisible) renderTissot(tissotGroup, projection);
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
      renderGlobeSphere(globeSphere, projection);
      renderTerrain(terrainGroup, projection);
      if (tissotVisible) renderTissot(tissotGroup, projection);
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

  // Reset the free camera (pan/zoom on zoomLayer, see CAMERA PAN & ZOOM)
  // to the default centered view before starting the morph, so every
  // projection switch lands on that projection's own standard framing
  // instead of carrying over whatever pan/zoom the user left it at.
  await resetCamera();

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
  updateGlobeBackground();
  refreshTissot();
  refreshRecenterAvailability();
  refreshFlightPath();
  resetTrueSizeOnProjectionSwitch();

  isAnimating = false;
}

// ============================================================
// INFO PANEL
// ============================================================
const infoTradeoffsToggle  = document.getElementById("info-tradeoffs-toggle");
const infoTradeoffsContent = document.getElementById("info-tradeoffs-content");

function renderTradeoffs(tradeoffs) {
  infoTradeoffsContent.innerHTML = "";
  [
    ["Preserves", tradeoffs.preserves],
    ["Distorts", tradeoffs.distorts],
    ["Best for", tradeoffs.bestFor],
  ].forEach(([term, definition]) => {
    const dt = document.createElement("dt");
    dt.textContent = term;
    const dd = document.createElement("dd");
    dd.textContent = definition;
    infoTradeoffsContent.append(dt, dd);
  });
}

infoTradeoffsToggle.addEventListener("click", () => {
  const expanded = infoTradeoffsToggle.getAttribute("aria-expanded") === "true";
  infoTradeoffsToggle.setAttribute("aria-expanded", String(!expanded));
  infoTradeoffsContent.hidden = expanded;
});

function updateInfo(projDef) {
  document.getElementById("info-name").textContent        = projDef.name;
  document.getElementById("info-family").textContent      = projDef.family;
  document.getElementById("info-description").textContent = projDef.description;

  renderTradeoffs(projDef.tradeoffs);
  // Collapse on every projection change — the tradeoffs shown are only
  // ever for the projection currently active, so an expanded state
  // shouldn't silently carry over to the next one.
  infoTradeoffsToggle.setAttribute("aria-expanded", "false");
  infoTradeoffsContent.hidden = true;
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
// it, or eases back to identity otherwise. D3's "transform" attribute
// interpolator decomposes both strings into translate/scale components, so
// animating between them sweeps scaleY through 0 — the map visibly folds
// flat then unfolds mirrored, reading as a top-down flip rather than a snap.
function animateRecenterFlip(flip, duration = 600) {
  const flipTransform = flip ? `translate(0, ${HEIGHT}) scale(1, -1)` : "translate(0, 0) scale(1, 1)";
  return new Promise((resolve) => {
    mapGroup.transition().duration(duration).attr("transform", flipTransform);
    tissotGroup.transition().duration(duration).attr("transform", flipTransform).on("end", resolve);
  });
}

// Spins the current projection's own sphere from the active rotation to the
// preset's, so recentering reads as a camera pan instead of a hard cut.
// Mirrors animateRotation's per-frame rotate() + repath loop, but against
// the live projection type instead of a fixed orthographic globe.
function animateRecenterRotation(projDef, fromRot, toRot, duration) {
  const from = fromRot || [0, 0, 0];
  const to   = toRot || [0, 0, 0];
  const projection = fitProjection(projDef, projDef.d3fn(), WIDTH, HEIGHT);
  const pathFn      = d3.geoPath().projection(projection);
  const countries   = mapGroup.selectAll("path.country");

  return new Promise((resolve) => {
    const timer = d3.timer((elapsed) => {
      const t = d3.easeCubicInOut(Math.min(1, elapsed / duration));
      projection.rotate([
        from[0] + (to[0] - from[0]) * t,
        from[1] + (to[1] - from[1]) * t,
        (from[2] || 0) + ((to[2] || 0) - (from[2] || 0)) * t,
      ]);
      countries.attr("d", (d) => pathFn(d) || "");
      if (elapsed >= duration) {
        timer.stop();
        resolve();
      }
    });
  });
}

async function applyRecenter(presetId) {
  if (isAnimating || RECENTER_INCOMPATIBLE.has(currentProjectionId)) return;

  if (flightPathMode) setFlightPathMode(false); // mutually exclusive, see FLIGHT PATH note

  const preset = RECENTER_PRESETS.find((p) => p.id === presetId);
  const fromRot = currentRecenterRotate;

  document.querySelectorAll(".recenter-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.presetId === presetId);
  });

  clearSelection(); // mutually exclusive with the country-zoom selection, see note above

  isAnimating = true;
  const currentDef = PROJECTIONS.find((p) => p.id === currentProjectionId);
  await animateRecenterRotation(currentDef, fromRot, preset.rotate, 900);

  currentRecenterRotate = preset.rotate;
  renderMap(makeProjection(currentDef, currentRecenterRotate)); // final render with native clipping

  const wantsFlip = !!preset.flipVertical;
  if (wantsFlip !== currentRecenterFlip) await animateRecenterFlip(wantsFlip);
  currentRecenterFlip = wantsFlip;

  isAnimating = false;
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
// CAMERA PAN & ZOOM
//
// Free pan (drag) and zoom (wheel/pinch) on zoomLayer via d3.zoom,
// independent of any country selection — the camera stays wherever
// the user leaves it across projection switches, recenter presets,
// and compare-mode panel changes. Replaces the old model where zoom
// was only possible while a country was selected and locked to it.
// ============================================================
const MAIN_ZOOM_SCALE_EXTENT = [1, 40];
const LIGHT_ZOOM_MAX_SCALE   = 3; // gentle zoom-in cap when centering on a clicked/searched country

let currentZoomTransform = d3.zoomIdentity;

const zoom = d3.zoom()
  .scaleExtent(MAIN_ZOOM_SCALE_EXTENT)
  // On the orthographic globe, drag/touch-pan is handed off to globeDrag
  // below instead (see GLOBE ROTATION) — wheel/pinch still zoom as usual.
  .filter((event) => {
    if (currentProjectionId === "orthographic" && event.type !== "wheel") return false;
    return (!event.ctrlKey || event.type === "wheel") && !event.button;
  })
  .on("zoom", (event) => {
    currentZoomTransform = event.transform;
    zoomLayer.attr("transform", currentZoomTransform);
  });

svg.call(zoom);

const CAMERA_IDENTITY_EPSILON = 0.001;

function isCameraAtIdentity() {
  return (
    Math.abs(currentZoomTransform.k - 1) < CAMERA_IDENTITY_EPSILON &&
    Math.abs(currentZoomTransform.x) < CAMERA_IDENTITY_EPSILON &&
    Math.abs(currentZoomTransform.y) < CAMERA_IDENTITY_EPSILON
  );
}

// Animates the camera back to the default centered view. Returns a promise
// so callers (e.g. transitionTo) can await it before proceeding; resolves
// immediately if the camera is already at rest.
function resetCamera(duration = 500) {
  if (isCameraAtIdentity()) return Promise.resolve();
  return svg.transition().duration(duration).call(zoom.transform, d3.zoomIdentity).end();
}

const cameraResetBtn = document.getElementById("camera-reset-btn");
cameraResetBtn.addEventListener("click", () => resetCamera());

const zoomInBtn  = document.getElementById("zoom-in-btn");
const zoomOutBtn = document.getElementById("zoom-out-btn");
const ZOOM_STEP  = 1.3; // multiplicative factor per click, same feel as one mouse-wheel notch

zoomInBtn.addEventListener("click", () => {
  svg.transition().duration(200).call(zoom.scaleBy, ZOOM_STEP);
});

zoomOutBtn.addEventListener("click", () => {
  svg.transition().duration(200).call(zoom.scaleBy, 1 / ZOOM_STEP);
});

// ============================================================
// GLOBE ROTATION (orthographic only)
//
// A screen-space pan wouldn't reveal the far side of the sphere, so on the
// orthographic globe, dragging instead rotates it — reusing the same
// currentRecenterRotate state the recenter presets use (see RECENTER
// PRESETS below), so a preset and a manual drag compose the same way and
// both reset together on a projection switch. zoom.filter above excludes
// drag/touch-pan on this projection so the two behaviors don't fight over
// the pointer.
// ============================================================
const GLOBE_DRAG_SENSITIVITY = 0.35; // degrees rotated per pixel dragged

const globeDrag = d3.drag()
  .filter((event) => currentProjectionId === "orthographic" && !isAnimating && !flightPathMode)
  .on("start", () => {
    document.querySelectorAll(".recenter-btn").forEach((b) => b.classList.remove("active"));
  })
  .on("drag", (event) => {
    const [lambda, phi] = currentRecenterRotate || [0, 0, 0];
    currentRecenterRotate = [
      lambda + event.dx * GLOBE_DRAG_SENSITIVITY,
      Math.max(-90, Math.min(90, phi - event.dy * GLOBE_DRAG_SENSITIVITY)),
      0,
    ];
    const projDef = PROJECTIONS.find((p) => p.id === currentProjectionId);
    renderMap(makeProjection(projDef, currentRecenterRotate));
    refreshTissot();
    refreshFlightPath();
  });

svg.call(globeDrag);

// ============================================================
// COUNTRY SELECTION
//
// Selecting a country (via a click on the map) highlights it and
// gently centers/zooms the camera on it — the user can then
// pan/zoom away freely, the selection doesn't lock the camera.
// ============================================================
let selectedCountryName = null;

// Bounding-box fit for `feature` under `projDef`, capped to a gentle zoom
// level rather than tightly filling the viewport — recomputed fresh since
// it depends on whichever projection is currently on screen.
function computeCountryFit(feature, projDef) {
  const pathFn = d3.geoPath().projection(makeProjection(projDef));
  const [[x0, y0], [x1, y1]] = pathFn.bounds(feature);
  const PADDING = 60;
  const scale = Math.min(
    (WIDTH - PADDING) / Math.max(x1 - x0, 1),
    (HEIGHT - PADDING) / Math.max(y1 - y0, 1),
    LIGHT_ZOOM_MAX_SCALE
  );
  return { scale, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

function selectCountry(feature) {
  if (!feature) return;

  if (flightPathMode) setFlightPathMode(false); // mutually exclusive, see FLIGHT PATH note

  // Mutually exclusive with recenter presets (see RECENTER PRESETS note):
  // the map must be re-rendered unrotated before we compute the bounds to
  // center on, since computeCountryFit's bbox math assumes the default
  // orientation.
  if (currentRecenterRotate) {
    resetRecenter();
    renderMap(makeProjection(PROJECTIONS.find((p) => p.id === currentProjectionId)));
    refreshTissot();
  }

  selectedCountryName = feature.properties.name;

  mapGroup
    .selectAll("path.country")
    .classed("selected", (d) => d.properties.name === selectedCountryName);

  const projDef = PROJECTIONS.find((p) => p.id === currentProjectionId);
  const fit     = computeCountryFit(feature, projDef);
  const transform = d3.zoomIdentity
    .translate(WIDTH / 2, HEIGHT / 2)
    .scale(fit.scale)
    .translate(-fit.cx, -fit.cy);
  svg.transition().duration(600).call(zoom.transform, transform);

  if (compareMode) comparePanels.forEach(applySelectionToPanel);
}

// Clears the highlight only — the camera stays exactly where the user left
// it, since pan/zoom is no longer tied to a selection.
function clearSelection() {
  if (!selectedCountryName) return;
  selectedCountryName = null;

  mapGroup.selectAll("path.country").classed("selected", false);

  if (compareMode) comparePanels.forEach(applySelectionToPanel);
}

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

  const panelOceanRect = svg.append("rect").attr("class", "ocean").attr("width", width).attr("height", height);
  const zoomLayer = svg.append("g").attr("class", "viewport");
  const panelGlobeSphere = zoomLayer.append("path").attr("class", "globe-sphere");
  const panel = {
    projId: initialProjId,
    oceanRect: panelOceanRect,
    globeSphere: panelGlobeSphere,
    mapGroup: zoomLayer.append("g").attr("class", "countries"),
    tissotGroup: zoomLayer.append("g").attr("class", "tissot-layer"),
    flightPathGroup: zoomLayer.append("g").attr("class", "flightpath-layer"),
    svg,
    width,
    height,
    zoomTransform: d3.zoomIdentity,
  };

  // Same free pan/zoom as the main view, independent per panel.
  panel.zoom = d3.zoom()
    .scaleExtent(MAIN_ZOOM_SCALE_EXTENT)
    .on("zoom", (event) => {
      panel.zoomTransform = event.transform;
      zoomLayer.attr("transform", event.transform);
    });
  svg.call(panel.zoom);

  // Same click-to-place-A/B as the main view (see FLIGHT PATH), using this
  // panel's own projection and zoom transform to invert the click.
  svg.node().addEventListener("click", (event) => {
    const projDef = PROJECTIONS.find((p) => p.id === panel.projId);
    const projection = fitProjection(projDef, projDef.d3fn(), panel.width, panel.height);
    handleFlightPathClick(event, svg.node(), panel.zoomTransform, projection);
  });

  panel.render = () => {
    const projDef     = PROJECTIONS.find((p) => p.id === panel.projId);
    const projection  = fitProjection(projDef, projDef.d3fn(), panel.width, panel.height);
    const pathFn       = d3.geoPath().projection(projection);
    const paths = panel.mapGroup
      .selectAll("path.country")
      .data(worldData.features, (d) => d.properties.name);
    paths.enter().append("path").attr("class", "country").attr("d", pathFn);
    paths.attr("d", pathFn);
    const isGlobe = panel.projId === "orthographic";
    panel.oceanRect.classed("globe-bg", isGlobe);
    renderGlobeSphere(panel.globeSphere, projection);
    panel.globeSphere.classed("active", isGlobe);
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

// Mirrors the shared search selection (highlight + gentle centering zoom)
// onto one panel. The panel's own camera stays free afterward, same as the
// main view — clearing the selection only removes the highlight.
function applySelectionToPanel(panel) {
  panel.mapGroup
    .selectAll("path.country")
    .classed("selected", (d) => d.properties.name === selectedCountryName);

  if (!selectedCountryName) return;

  const feature = worldData.features.find((f) => f.properties.name === selectedCountryName);
  const projDef = PROJECTIONS.find((p) => p.id === panel.projId);
  const pathFn  = d3.geoPath().projection(fitProjection(projDef, projDef.d3fn(), panel.width, panel.height));
  const [[x0, y0], [x1, y1]] = pathFn.bounds(feature);

  const PADDING = 40;
  const scale = Math.min(
    (panel.width - PADDING) / Math.max(x1 - x0, 1),
    (panel.height - PADDING) / Math.max(y1 - y0, 1),
    LIGHT_ZOOM_MAX_SCALE
  );
  const transform = d3.zoomIdentity
    .translate(panel.width / 2, panel.height / 2)
    .scale(scale)
    .translate(-(x0 + x1) / 2, -(y0 + y1) / 2);

  panel.svg.transition().duration(600).call(panel.zoom.transform, transform);
}

// compareToggleBtn currently has no sidebar UI (see remove(ui) commit) — the
// listener is guarded so the rest of the script still loads; wire a new
// trigger to it whenever the tools UI is rebuilt.
if (compareToggleBtn) {
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
}

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
const tissotToggleBtn = document.getElementById("grid-toggle-btn");

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
      renderTissot(panel.tissotGroup, fitProjection(projDef, projDef.d3fn(), panel.width, panel.height));
    });
  }
}

// Now wired to the right-side toolbar's grid icon (see map-tools in
// index.html) instead of the removed sidebar tools panel.
if (tissotToggleBtn) {
  tissotToggleBtn.addEventListener("click", () => {
    tissotVisible = !tissotVisible;
    tissotToggleBtn.classList.toggle("active", tissotVisible);
    tissotToggleBtn.setAttribute("aria-pressed", String(tissotVisible));
    refreshTissot();
  });
}

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
function refreshFlightPath() {
  const currentDef = PROJECTIONS.find((p) => p.id === currentProjectionId);
  renderFlightPath(flightPathGroup, makeProjection(currentDef, currentRecenterRotate));

  if (compareMode && comparePanels) {
    comparePanels.forEach((panel) => {
      const projDef = PROJECTIONS.find((p) => p.id === panel.projId);
      renderFlightPath(panel.flightPathGroup, fitProjection(projDef, projDef.d3fn(), panel.width, panel.height));
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

// See the compareToggleBtn note above — same guard, same reason.
if (flightPathToggleBtn) {
  flightPathToggleBtn.addEventListener("click", () => {
    if (isAnimating) return;
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
function handleFlightPathClick(event, svgNode = svg.node(), zoomTransform = currentZoomTransform, projection = makeProjection(
  PROJECTIONS.find((p) => p.id === currentProjectionId),
  currentRecenterRotate
)) {
  if (!flightPathMode || isAnimating) return;

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

// ============================================================
// TRUE SIZE COMPARE
//
// Lets the user add several countries as freely draggable silhouettes
// spawned at their true geographic position under the current projection
// (like thetruesizeof.com, generalized to all 17 projections here).
// Independent from the main country search (Feature 1) since that one is
// single-select/highlight-only. Colors cycle through a fixed palette in
// add order. Scoped to the main view only (like the terrain overlay and
// globe drag) — the shapes live in truesizeGroup, inside the main map's
// svg, which is already hidden while comparing (see mapContainerEl.hidden
// above), so nothing extra is needed to keep it out of compare mode.
//
// Drag only moves a shape on screen (a transform layered on top of its
// true-position `d`); switching projection snaps every shape back to its
// true geographic position under the new projection instead of trying to
// carry the drag offset over — the offsets are cleared, not preserved.
// ============================================================
const TRUESIZE_PALETTE = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6", "#1abc9c", "#e67e22", "#95a5a6"];

const trueSizeToggleBtn = document.getElementById("truesize-toggle");
const trueSizePanel     = document.getElementById("truesize-panel");
const trueSizeInput     = document.getElementById("truesize-search-input");
const trueSizeResults   = document.getElementById("truesize-search-results");
const trueSizeListEl    = document.getElementById("truesize-selected-list");

let trueSizeOrder = []; // country names, in the order they were added
const trueSizeColors  = new Map(); // name -> color, assigned once at add time
const trueSizeOffsets = new Map(); // name -> {x, y} drag offset, on top of the true position
let trueSizeNextColorIndex = 0;

// See the compareToggleBtn note above — same guard, same reason.
if (trueSizeToggleBtn) {
  trueSizeToggleBtn.addEventListener("click", () => {
    trueSizePanel.hidden = !trueSizePanel.hidden;
    trueSizeToggleBtn.classList.toggle("active", !trueSizePanel.hidden);
    if (!trueSizePanel.hidden) trueSizeInput.focus();
  });
}

function hideTrueSizeResults() {
  trueSizeResults.hidden = true;
  trueSizeResults.innerHTML = "";
}

function addTrueSizeCountry(name) {
  if (trueSizeOrder.includes(name)) return;
  trueSizeOrder.push(name);
  trueSizeColors.set(name, TRUESIZE_PALETTE[trueSizeNextColorIndex % TRUESIZE_PALETTE.length]);
  trueSizeNextColorIndex++;
  renderTrueSizeList();
  renderTrueSizeShapes();
}

function removeTrueSizeCountry(name) {
  trueSizeOrder = trueSizeOrder.filter((n) => n !== name);
  trueSizeColors.delete(name);
  trueSizeOffsets.delete(name);
  renderTrueSizeList();
  renderTrueSizeShapes();
}

function renderTrueSizeList() {
  trueSizeListEl.innerHTML = "";
  trueSizeOrder.forEach((name) => {
    const li = document.createElement("li");

    const swatch = document.createElement("span");
    swatch.className = "truesize-swatch";
    swatch.style.background = trueSizeColors.get(name);

    const label = document.createElement("span");
    label.textContent = name;

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "✕";
    removeBtn.title = "Remove";
    removeBtn.addEventListener("click", () => removeTrueSizeCountry(name));

    li.append(swatch, label, removeBtn);
    trueSizeListEl.appendChild(li);
  });
}

const trueSizeDrag = d3.drag().on("drag", function (event, feature) {
  const name = feature.properties.name;
  const offset = trueSizeOffsets.get(name) || { x: 0, y: 0 };
  offset.x += event.dx;
  offset.y += event.dy;
  trueSizeOffsets.set(name, offset);
  d3.select(this).attr("transform", `translate(${offset.x},${offset.y})`);
});

// Redraws every selected shape at its true geographic position under the
// current projection, preserving each shape's drag offset (add/remove and
// other refresh call sites use this — only a projection switch clears
// offsets, see resetTrueSizeOnProjectionSwitch).
function renderTrueSizeShapes() {
  const projDef    = PROJECTIONS.find((p) => p.id === currentProjectionId);
  const projection = makeProjection(projDef, currentRecenterRotate);
  const pathFn     = d3.geoPath().projection(projection);

  const features = trueSizeOrder
    .map((name) => worldData.features.find((f) => f.properties.name === name))
    .filter(Boolean);

  const shapes = truesizeGroup
    .selectAll("path.truesize-shape")
    .data(features, (d) => d.properties.name);

  shapes.exit().remove();

  shapes
    .enter()
    .append("path")
    .attr("class", "truesize-shape")
    .call(trueSizeDrag)
    .merge(shapes)
    .attr("d", pathFn)
    .attr("fill", (d) => trueSizeColors.get(d.properties.name))
    .attr("stroke", (d) => trueSizeColors.get(d.properties.name))
    .attr("transform", (d) => {
      const offset = trueSizeOffsets.get(d.properties.name) || { x: 0, y: 0 };
      return `translate(${offset.x},${offset.y})`;
    });
}

function resetTrueSizeOnProjectionSwitch() {
  if (trueSizeOrder.length === 0) return;
  trueSizeOffsets.clear();
  renderTrueSizeShapes();
}

// See the compareToggleBtn note above — same guard, same reason.
if (trueSizeInput) {
  trueSizeInput.addEventListener("input", () => {
    const query = trueSizeInput.value.trim().toLowerCase();
    if (!query || !worldData) {
      hideTrueSizeResults();
      return;
    }
    const matches = worldData.features
      .filter((f) => !trueSizeOrder.includes(f.properties.name))
      .filter((f) => f.properties.name.toLowerCase().includes(query))
      .sort((a, b) => {
        const nameA = a.properties.name.toLowerCase();
        const nameB = b.properties.name.toLowerCase();
        return nameA.indexOf(query) - nameB.indexOf(query);
      })
      .slice(0, 8);

    trueSizeResults.innerHTML = "";
    matches.forEach((feature) => {
      const li = document.createElement("li");
      li.textContent = feature.properties.name;
      li.addEventListener("click", () => {
        addTrueSizeCountry(feature.properties.name);
        trueSizeInput.value = "";
        hideTrueSizeResults();
      });
      trueSizeResults.appendChild(li);
    });
    trueSizeResults.hidden = matches.length === 0;
  });

  trueSizeInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideTrueSizeResults();
  });
}

// ============================================================
// HELP MODAL
//
// Onboarding / "how it works" — one reusable modal, opened
// automatically on the very first visit (localStorage flag) and
// reopenable at any time via the "?" trigger in the sidebar header.
// ============================================================
const HELP_SEEN_KEY = "mapProjektorHelpSeen";

// Static onboarding copy — the core idea the whole app demonstrates,
// plus a short pointer to each control, in the order they appear in
// the sidebar.
const HELP_MODAL_CONTENT = `
  <p>The Earth is a sphere. Every flat map is a projection of that sphere
  onto a plane — and no projection can preserve shape, area, distance, and
  direction all at once. Each one picks a different tradeoff.</p>
  <p>This app lets you compare 17 of them side by side, morph between
  them, and see exactly how each one bends the world to make its own
  compromise.</p>
  <p><strong>Projection list</strong> — click any name to morph into it.
  <strong>Compare Projections</strong> shows two side by side.
  <strong>Recenter View</strong> shifts which region sits at the center —
  the usual Europe-centered map is a convention, not a neutral default.</p>
  <p><strong>Show Distortion Grid</strong> draws Tissot's indicatrix, a
  grid of equal-size circles that reveals exactly where and how much each
  projection stretches things. <strong>Draw Flight Path</strong> lets you
  click two points to see the real shortest route between them and how
  its curve changes per projection. <strong>Compare True Size</strong>
  spawns draggable country silhouettes so you can hold them up against
  each other at their true relative size.</p>
`;

const helpTriggerBtn    = document.getElementById("help-trigger");
const helpModalBackdrop = document.getElementById("help-modal-backdrop");
const helpModalCloseBtn = document.getElementById("help-modal-close");
document.getElementById("help-modal-body").innerHTML = HELP_MODAL_CONTENT;

function openHelpModal() {
  helpModalBackdrop.hidden = false;
  localStorage.setItem(HELP_SEEN_KEY, "1");
}

function closeHelpModal() {
  helpModalBackdrop.hidden = true;
}

helpTriggerBtn.addEventListener("click", openHelpModal);
helpModalCloseBtn.addEventListener("click", closeHelpModal);

helpModalBackdrop.addEventListener("click", (event) => {
  if (event.target === helpModalBackdrop) closeHelpModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !helpModalBackdrop.hidden) closeHelpModal();
});

if (!localStorage.getItem(HELP_SEEN_KEY)) openHelpModal();

// ============================================================
// INIT — fetch GeoJSON then render
// ============================================================
async function init() {
  const [worldResponse, terrainResponse] = await Promise.all([
    fetch("/data/world.geojson"),
    fetch("/data/terrain.geojson"),
  ]);
  worldData = await worldResponse.json();
  terrainData = await terrainResponse.json();

  const initialProj = PROJECTIONS.find((p) => p.id === currentProjectionId);
  buildSidebar();
  buildRecenterPanel();
  renderMap(makeProjection(initialProj));
  updateInfo(initialProj);
  updateGlobeBackground();
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

const themeToggle = document.getElementById("theme-toggle");

function applyTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  themeToggle.checked = theme === "dark";
}

const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
if (savedTheme !== null) {
  applyTheme(savedTheme);
}

themeToggle.addEventListener("change", () => {
  const theme = themeToggle.checked ? "dark" : "";
  applyTheme(theme);
  localStorage.setItem(THEME_STORAGE_KEY, theme);
});
