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
// name and tradeoffs live in static/i18n/<lang>.json under projection.<id>.*;
// `family` is a grouping identifier whose label is family.<lowercase family>.
const projectionName = (proj) => t(`projection.${proj.id}.name`);

const PROJECTIONS = [
  {
    id: "mercator",
    family: "Cylindrical",
    year: 1569,
    description:
      "Preserves angles (conformal). Severely distorts area near the poles. " +
      "The standard for maritime navigation for centuries.",
    d3fn: () => d3.geoMercator(),
  },
  {
    id: "equirectangular",
    family: "Cylindrical",
    year: 100,
    description:
      "Maps longitude and latitude directly to x and y. Simple but distorts " +
      "both shape and area away from the equator.",
    d3fn: () => d3.geoEquirectangular(),
  },
  {
    id: "gallPeters",
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
    family: "Pseudocylindrical",
    year: 1963,
    description:
      "Visual compromise: neither conformal nor equal-area, but aesthetically " +
      "pleasing. Used by National Geographic from 1988 to 1998.",
    d3fn: () => d3.geoRobinson(),
  },
  {
    id: "mollweide",
    family: "Pseudocylindrical",
    year: 1805,
    description:
      "Equal-area projection. Shapes are distorted near the edges but all " +
      "regions are represented at their true relative size.",
    d3fn: () => d3.geoMollweide(),
  },
  {
    id: "naturalEarth",
    family: "Pseudocylindrical",
    year: 2012,
    description:
      "Designed by Tom Patterson for attractive world maps. A smooth compromise " +
      "between conformal and equal-area with gently rounded poles.",
    d3fn: () => d3.geoNaturalEarth1(),
  },
  {
    id: "equalEarth",
    family: "Pseudocylindrical",
    year: 2018,
    description:
      "Modern equal-area projection inspired by Robinson's aesthetics. " +
      "Designed as an answer to Gall-Peters: true sizes without the stretching.",
    d3fn: () => d3.geoEqualEarth(),
  },
  {
    id: "eckert4",
    family: "Pseudocylindrical",
    year: 1906,
    description:
      "Equal-area projection with poles drawn as lines half the equator's length. " +
      "A favourite for thematic world maps of climate and population.",
    d3fn: () => d3.geoEckert4(),
  },
  {
    id: "sinusoidal",
    family: "Pseudocylindrical",
    year: 1570,
    description:
      "One of the oldest pseudocylindrical projections. Equal-area, but strong " +
      "shearing distortion appears near the edges.",
    d3fn: () => d3.geoSinusoidal(),
  },
  {
    id: "orthographic",
    family: "Azimuthal",
    year: 200,
    description:
      "Simulates viewing Earth from infinite distance — the 'space view'. " +
      "Only one hemisphere is visible at a time.",
    d3fn: () => d3.geoOrthographic(),
  },
  {
    id: "azimuthalEqualArea",
    family: "Azimuthal",
    year: 1772,
    description:
      "Preserves area accurately across the entire map from a central anchor point. " +
      "Unlike Mercator, Greenland and Africa appear at their true relative sizes.",
    d3fn: () => d3.geoAzimuthalEqualArea(),
  },
  {
    id: "polarNorth",
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
    family: "Azimuthal",
    year: 1000,
    description:
      "Azimuthal equidistant centred on the South Pole. Antarctica sits at the " +
      "centre, surrounded by the Southern Ocean and every other continent.",
    d3fn: () => d3.geoAzimuthalEquidistant().rotate([0, 90]).clipAngle(179),
  },
  {
    id: "winkelTripel",
    family: "Pseudoazimuthal",
    year: 1921,
    description:
      "Minimises the combined distortion of area, angles, and distances. " +
      "Adopted by the National Geographic Society in 1998.",
    d3fn: () => d3.geoWinkel3(),
  },
  {
    id: "aitoff",
    family: "Pseudoazimuthal",
    year: 1889,
    description:
      "Modified azimuthal projection with an elliptical boundary. " +
      "Reduces polar distortion compared to cylindrical projections.",
    d3fn: () => d3.geoAitoff(),
  },
  {
    id: "hammer",
    family: "Pseudoazimuthal",
    year: 1892,
    description:
      "Equal-area modification of the Aitoff projection. Widely used in " +
      "astronomy to map the entire celestial sphere.",
    d3fn: () => d3.geoHammer(),
  },
  {
    id: "albers",
    family: "Conic",
    year: 1805,
    description:
      "Conic equal-area projection with two standard parallels. Best for " +
      "mid-latitude regions. Official projection for US Census maps.",
    // Recentred for a world view — default is tuned for the USA
    d3fn: () => d3.geoAlbers().rotate([0, 0]).parallels([20, 50]).scale(153),
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

// Single wrapper for every world-space layer, so the South America
// (upside-down) mirror flip (see animateRecenterFlip) animates ONE
// group's transform instead of seven separate transitions — cheaper to
// run, and guarantees every layer stays perfectly in sync.
const worldGroup = zoomLayer.append("g").attr("class", "world");

// Sphere outline — a distinct shape (not just the background rect) so the
// globe's edge is visible against the void backdrop in orthographic view.
// Appended before mapGroup so countries paint on top of it.
const globeSphere = worldGroup.append("path").attr("class", "globe-sphere");

// Second sphere shape, used only to crossfade during clip-angle-animated
// blends (see animateBlend's `crossfade` branch) — kept empty/transparent
// otherwise.
const globeSphereFade = worldGroup.append("path").attr("class", "globe-sphere").style("opacity", 0);

// Group that holds all country <path> elements
const mapGroup = worldGroup.append("g").attr("class", "countries");

// Mountain range/plateau terrain patches — appended after mapGroup so they
// paint over the flat country fill, purely decorative (pointer-events:none
// in CSS so clicks still reach the country underneath).
const terrainGroup = worldGroup.append("g").attr("class", "terrain-layer");

// Tissot's indicatrix overlay — appended after mapGroup so it paints on top
const tissotGroup = worldGroup.append("g").attr("class", "tissot-layer");

// Reference lines (equator, tropics, polar circles, meridians) — above
// Tissot so the named lines stay readable when both overlays are on.
const referenceGroup = worldGroup.append("g").attr("class", "reference-layer");

// Flight path overlay — appended after tissotGroup so the arc paints on top
const flightPathGroup = worldGroup.append("g").attr("class", "flightpath-layer");

// True-size country shapes — appended last so dragged shapes paint on top
// of everything else. Main view only (not mirrored to compare panels).
const truesizeGroup = worldGroup.append("g").attr("class", "truesize-layer");

// Compare-mode country highlight — appended last of all so it always
// paints on top. See COMPARE CARD below.
const compareHighlightGroup = worldGroup.append("g").attr("class", "compare-highlight-layer");

// ============================================================
// APPLICATION STATE
// ============================================================
// Defaults to the orthographic globe — the "space view" reads better as a
// first impression than a flat map, per UX feedback.
let currentProjectionId = "orthographic";
let isAnimating = false;

// The sphere-outline stroke only shows in orthographic — it's the only
// projection where the disc needs a visible edge separating it from the
// void background (see .globe-sphere.active); every other projection's
// {type: "Sphere"} outline already reaches the void's own dark color at
// its non-rectangular corners, so no border is needed there.
function updateGlobeBackground() {
  const isGlobe = currentProjectionId === "orthographic";
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
// LIGHT GEOMETRY — animation-only copy of the country/terrain shapes
//
// Every animation frame reprojects every vertex through TWO projections
// (source + target blend) plus D3's adaptive resampling, so frame cost
// scales with vertex count: the full 21k-vertex world took ~40ms/frame,
// well past the 16ms budget for 60fps. Simplifying each ring with
// Douglas-Peucker (LIGHT_TOLERANCE_DEG) and skipping sub-degree islands
// cuts that to ~11ms, and the loss is barely visible
// while shapes are moving. The final render always uses the full data,
// so the resting map is unchanged.
// ============================================================

// Douglas-Peucker keeps the points that shape a coastline (capes, gulfs,
// peninsulas) and drops the ones lying on a straight run. At 0.3° it
// costs the same per frame as the plain spacing rule it replaced (drop
// any point within 1° of the last kept one), which flattened Italy,
// Greece and Norway into crude polygons. 0.2° looks slightly smoother but
// tripled the dropped frames in the headless perf run.
const LIGHT_TOLERANCE_DEG = 0.3;

// Rings whose points all sit within this of their first point are islands
// too small to matter mid-morph (see thinPolygon for why they're skipped).
const LIGHT_SPECK_DEG = 1;

// Keyed by the original feature object, so animation loops can look up a
// bound datum's light twin without a name lookup (terrain has duplicate names).
const lightGeometry = new WeakMap();

// Distance from p to the line through a and b, in degrees (planar lon/lat
// is accurate enough at this tolerance).
function distanceToLine(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = Math.hypot(dx, dy);
  if (length === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / length;
}

// Returns null when the ring is a speck. Douglas-Peucker needs a chord, and
// a closed ring's first and last points coincide, so the ring is split at
// its farthest point from the start and each half simplified. Iterative
// (explicit stack) because some rings have thousands of points.
function thinRing(ring) {
  const first = ring[0];
  let far = 0;
  let farDistance = 0;
  ring.forEach((p, i) => {
    const d = Math.hypot(p[0] - first[0], p[1] - first[1]);
    if (d > farDistance) { farDistance = d; far = i; }
  });
  if (farDistance < LIGHT_SPECK_DEG) return null;

  const keep = new Uint8Array(ring.length);
  keep[0] = keep[far] = keep[ring.length - 1] = 1;
  const stack = [[0, far], [far, ring.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop();
    let worst = -1;
    let worstDistance = LIGHT_TOLERANCE_DEG;
    for (let i = start + 1; i < end; i++) {
      const d = distanceToLine(ring[i], ring[start], ring[end]);
      if (d > worstDistance) { worstDistance = d; worst = i; }
    }
    if (worst !== -1) {
      keep[worst] = 1;
      stack.push([start, worst], [worst, end]);
    }
  }
  const kept = ring.filter((_, i) => keep[i]);
  return kept.length >= 4 ? kept : null;
}

// Sub-degree islands are ~80% of all rings (1300 of 1600) but only ~30% of
// the vertices: their cost is per-ring overhead (clipping + resampling
// setup), not vertex count, so thinning can't help — they have to be
// skipped while animating. A few px specks reappear on the final render.
//
// Simplifying a small concave island down to a triangle can pick three points
// that wind the wrong way (Gotland, Sumbawa, Unalaska did). On a sphere a
// ring's winding decides which side is "inside", so D3 then reads the
// island as the whole globe minus the island and paints land colour over
// every ocean mid-morph. More than a hemisphere of area gives that away;
// such rings are tiny, so keeping them unthinned costs nothing.
function thinPolygon(rings) {
  const exterior = thinRing(rings[0]);
  if (!exterior) return null;
  const thinned = [exterior, ...rings.slice(1).map(thinRing).filter(Boolean)];
  return d3.geoArea({ type: "Polygon", coordinates: thinned }) > 2 * Math.PI ? rings : thinned;
}

function buildLightGeometry(features) {
  features.forEach((feature) => {
    const g = feature.geometry;
    if (!g || (g.type !== "Polygon" && g.type !== "MultiPolygon")) return;
    const polygons = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    let thinned = polygons.map(thinPolygon).filter(Boolean);
    // A country made only of specks (Malta, Singapore…) must not vanish
    // during the morph: keep its first polygon whole, it's cheap anyway.
    if (!thinned.length) thinned = [polygons[0]];
    lightGeometry.set(feature, { ...feature, geometry: { type: "MultiPolygon", coordinates: thinned } });
  });
}

// Falls back to the full feature for geometry types buildLightGeometry skips.
function lightOf(feature) {
  return lightGeometry.get(feature) || feature;
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
  // Keep the crossfade companion shape inert outside of animateBlend's
  // crossfade branch, so it never lingers visible after a normal render.
  if (pathEl === globeSphere) globeSphereFade.style("opacity", 0).attr("d", null);
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
    .attr("d", path);

  paths.attr("d", path);

  renderTerrain(terrainGroup, projection);
  updatePanExtent(projection);
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

// Re-paths the already-mounted terrain patches without re-running the
// enter/exit data join — the patch count/DOM never changes mid-animation,
// only their shape, so redoing the full join on every animation frame (as
// renderTerrain does) was pure overhead. Used by the per-frame animation
// loops below; renderTerrain (which also mounts new elements) stays in
// charge of the initial/static render.
function updateTerrainPaths(group, projection) {
  const path = d3.geoPath().projection(projection);
  group.selectAll("path.terrain-patch").attr("d", (d) => path(lightOf(d)));
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
  // Coarser than D3's 0.5px default: resampling is a big share of per-frame
  // cost and 2px is invisible on shapes that are moving. Every blend is
  // followed by a native full-precision render.
  return projection.scale(1).precision(2).alpha(0);
}

// Orthographic clips to the visible hemisphere (90°); everything else
// clips at the antimeridian, which animateBlend adds on top of the circle.
// Animating between the two makes back-hemisphere countries shrink
// smoothly into the horizon instead of snapping in or out.
function clipAngleOf(projDef) {
  return projDef.id === "orthographic" ? 90 : 179.9;
}

// Drives one blend from alpha 0 → 1, optionally morphing the clip circle.
//
// fromSphereProj/toSphereProj (only passed for clip-angle-animated blends,
// which always pair orthographic with something else — see clipAngleOf)
// are each endpoint's own plain, unblended projection. They're there
// because tracing the special {type: "Sphere"} whole-globe marker THROUGH
// the live blended+clip-animating projection collapses to a degenerate
// sliver at some intermediate t — a d3 clip-circle edge case specific to
// blending orthographic's raw function (only valid within 90° of center)
// against one that isn't. Countries and terrain render fine through the
// same blend; only this synthetic outline breaks. Sidestepped entirely by
// crossfading between the two endpoints' own (always well-behaved) static
// sphere shapes instead of animating one continuously-blended shape.
function animateBlend(projection, duration, clipFrom = null, clipTo = null, fromSphereProj = null, toSphereProj = null) {
  const pathFn    = d3.geoPath().projection(projection);
  const countries = mapGroup.selectAll("path.country");

  const crossfade = clipFrom !== null && fromSphereProj && toSphereProj;
  if (crossfade) {
    const spherePath = d3.geoPath();
    globeSphere.attr("d", spherePath.projection(fromSphereProj)({ type: "Sphere" })).style("opacity", 1);
    globeSphereFade.attr("d", spherePath.projection(toSphereProj)({ type: "Sphere" })).style("opacity", 0);
  }

  return new Promise((resolve) => {
    const timer = d3.timer((elapsed) => {
      const t = d3.easeCubicInOut(Math.min(1, elapsed / duration));
      projection.alpha(t);
      if (clipFrom !== null) {
        // A near-180° clip circle only punches a tiny hole at the antipode;
        // it never cuts along the back meridian, so a country straddling it
        // (Canada in the China view, India in the Pacific one) kept its
        // vertices on both edges of the flat map and drew a band across it.
        // Cutting at the antimeridian first restores the flat maps' seam.
        // Only past 90°: up to the hemisphere the circle hides the back seam
        // anyway, and at exactly 90° the two clips combined turn every
        // country inside out (the whole globe flashed land colour on the
        // one frame the polar route leaves on screen between fold and spin).
        const radius = (clipFrom + (clipTo - clipFrom) * t) / DEGREES;
        projection.preclip(radius > Math.PI / 2
          ? (stream) => d3.geoClipAntimeridian(d3.geoClipCircle(radius)(stream))
          : d3.geoClipCircle(radius));
      }
      countries.attr("d", (d) => pathFn(lightOf(d)) || "");
      if (crossfade) {
        globeSphere.style("opacity", 1 - t);
        globeSphereFade.style("opacity", t);
      } else {
        renderGlobeSphere(globeSphere, projection);
      }
      updateTerrainPaths(terrainGroup, projection);
      if (tissotVisible) updateTissotPaths(tissotGroup, projection);
      if (referenceVisible) updateReferencePaths(referenceGroup, projection);
      if (elapsed >= duration) {
        timer.stop();
        if (crossfade) globeSphere.style("opacity", null);
        resolve();
      }
    });
  });
}

// `rotation` is the active recenter view (null = Europe-centered): endpoints are
// built unrotated and the blend wrapper carries it, so clip circles stay
// centred on the view (see blendProjection) and the morph keeps the user's
// framing instead of snapping back to Europe.
function animateTransition(fromDef, toDef, duration, rotation = null) {
  const projection = blendProjection(makeProjection(fromDef), makeProjection(toDef), rotation);
  // The crossfade outlines are static endpoint shapes, so they carry the rotation themselves
  const fromProjection = makeProjection(fromDef, rotation);
  const toProjection   = makeProjection(toDef, rotation);
  const clipFrom = clipAngleOf(fromDef);
  const clipTo   = clipAngleOf(toDef);
  // Only azimuthal-hemisphere transitions need the circle clip; other
  // pairs keep D3's default antimeridian clipping untouched.
  if (clipFrom !== clipTo) return animateBlend(projection, duration, clipFrom, clipTo, fromProjection, toProjection);
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
      countries.attr("d", (d) => pathFn(lightOf(d)) || "");
      renderGlobeSphere(globeSphere, projection);
      updateTerrainPaths(terrainGroup, projection);
      if (tissotVisible) updateTissotPaths(tissotGroup, projection);
      if (referenceVisible) updateReferencePaths(referenceGroup, projection);
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

  // Rotated clones purely for animateBlend's crossfade sphere shapes (see
  // its comment) — globe/disc above are deliberately built unrotated
  // (blendProjection's wrapper carries the rotation instead), but the
  // crossfade needs each endpoint's shape as it actually appears on
  // screen, rotation included.
  const globeAtRotation = d3.geoOrthographic().rotate(rotation).fitSize([WIDTH, HEIGHT], { type: "Sphere" });
  const discAtRotation  = d3.geoAzimuthalEquidistant().clipAngle(179).rotate(rotation)
    .fitSize([WIDTH, HEIGHT], { type: "Sphere" });

  return foldToGlobe
    ? animateBlend(projection, duration, 179, 90, discAtRotation, globeAtRotation)
    : animateBlend(projection, duration, 90, 179, globeAtRotation, discAtRotation);
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
    await animateTransition(fromDef, toDef, 1400, currentRecenterRotate);
  }

  // Final render with the true target projection (native clipping rules)
  renderMap(makeProjection(toDef, currentRecenterRotate));

  currentProjectionId = newProjId;
  updateInfo(toDef);
  updateGlobeBackground();
  refreshTissot();
  refreshReferenceLines();
  refreshRecenterAvailability();
  refreshFlightPath();
  resetTrueSizeOnProjectionSwitch();

  isAnimating = false;
}

// ============================================================
// INFO PANEL
// ============================================================
const infoTradeoffsContent = document.getElementById("info-tradeoffs-content");

// Always fully shown now (no expand/collapse) — matches the Figma card,
// which has no toggle, just the three terms laid out directly.
function renderTradeoffs(projDef) {
  infoTradeoffsContent.innerHTML = "";
  ["preserves", "distorts", "bestFor"].forEach((field) => {
    const dt = document.createElement("dt");
    dt.textContent = t(`info.${field}`);
    const dd = document.createElement("dd");
    dd.textContent = t(`projection.${projDef.id}.${field}`);
    infoTradeoffsContent.append(dt, dd);
  });
}

function updateInfo(projDef) {
  document.getElementById("info-name").textContent = projectionName(projDef);
  renderTradeoffs(projDef);
}

// The info card is opt-in now (see the toolbar's "i" icon in
// map-container) instead of an always-visible strip under the map.
const infoToggleBtn = document.getElementById("info-toggle-btn");
const infoCloseBtn  = document.getElementById("info-close-btn");
const infoPanelEl   = document.getElementById("projection-info");
let infoVisible = false;

function setInfoVisible(visible) {
  infoVisible = visible;
  infoPanelEl.hidden = !infoVisible;
  infoToggleBtn.classList.toggle("active", infoVisible);
  infoToggleBtn.setAttribute("aria-pressed", String(infoVisible));
}

infoToggleBtn.addEventListener("click", () => {
  setInfoVisible(!infoVisible);
  // Only one toolbar popover at a time — see closeCompareCard below.
  if (infoVisible) closeCompareCard();
});

infoCloseBtn.addEventListener("click", () => setInfoVisible(false));

// ============================================================
// COMPARE CARD
//
// Pick a country (searchable, alphabetical) and it's redrawn on top of
// the map as a red highlight, under its own projection — independent of
// whatever projection the main map/sidebar has active. Lets you see how
// the same country's shape/size changes between two projections at a
// glance: the base map (unchanged) vs. the highlighted overlay.
// ============================================================
const compareCardToggleBtn    = document.getElementById("compare-toggle-btn");
const compareCardCloseBtn     = document.getElementById("compare-card-close");
const compareCardEl           = document.getElementById("compare-card");
const compareProjectionSelect = document.getElementById("compare-projection-select");
const compareCountryInput     = document.getElementById("compare-country-input");
const compareCountryResults   = document.getElementById("compare-country-results");

// Called from init() once the language is loaded (names come from t()); it
// keeps the HTML placeholder option (empty value) and replaces the rest, so a
// language switch can call it again.
function buildCompareProjectionOptions() {
  compareProjectionSelect.querySelectorAll("option[value]:not([value=''])").forEach((o) => o.remove());
  PROJECTIONS.forEach((proj) => {
    const option = document.createElement("option");
    option.value = proj.id;
    option.textContent = projectionName(proj);
    compareProjectionSelect.appendChild(option);
  });
}

let compareCardVisible     = false;
let compareCountryNames    = null; // populated lazily once worldData is ready — full alphabetical list
let compareSelectedCountry = null;
let compareProjectionId    = null; // null until a country is picked, then defaults to currentProjectionId

// Redraws (or clears) the highlighted country under compareProjectionId.
// Shares the main map's zoomLayer, so it pans/zooms together with it —
// the point is comparing two projections' shapes side by side on the
// same canvas, not tracking a separate camera.
function refreshCompareHighlight() {
  compareHighlightGroup.selectAll("*").remove();
  if (!compareSelectedCountry || !worldData) return;

  const feature = worldData.features.find((f) => f.properties.name === compareSelectedCountry);
  if (!feature) return;

  const projDef = PROJECTIONS.find((p) => p.id === compareProjectionId) || PROJECTIONS.find((p) => p.id === currentProjectionId);
  const pathFn  = d3.geoPath().projection(makeProjection(projDef));
  compareHighlightGroup.append("path").attr("class", "compare-highlight").attr("d", pathFn(feature));
}

function hideCompareCountryResults() {
  compareCountryResults.hidden = true;
  compareCountryResults.innerHTML = "";
}

function showCompareCountryResults(names) {
  compareCountryResults.innerHTML = "";
  names.forEach((name) => {
    const li = document.createElement("li");
    li.textContent = name;
    li.addEventListener("click", () => selectCompareCountry(name));
    compareCountryResults.appendChild(li);
  });
  compareCountryResults.hidden = names.length === 0;
}

function selectCompareCountry(name) {
  compareSelectedCountry = name;
  compareCountryInput.value = name;
  hideCompareCountryResults();

  // First pick since the card opened (or since it was last cleared):
  // default the projection to whatever the main map is currently showing.
  if (compareProjectionId === null) {
    compareProjectionId = currentProjectionId;
    compareProjectionSelect.value = currentProjectionId;
  }
  refreshCompareHighlight();
}

compareCountryInput.addEventListener("input", () => {
  const query = compareCountryInput.value.trim().toLowerCase();
  if (!compareCountryNames) return;
  const matches = query
    ? compareCountryNames.filter((name) => name.toLowerCase().includes(query))
    : compareCountryNames;
  showCompareCountryResults(matches.slice(0, 8));
});

compareCountryInput.addEventListener("focus", () => {
  if (compareCountryNames) showCompareCountryResults(compareCountryNames.slice(0, 8));
});

compareCountryInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideCompareCountryResults();
});

compareProjectionSelect.addEventListener("change", () => {
  compareProjectionId = compareProjectionSelect.value;
  refreshCompareHighlight();
});

function resetCompareSelection() {
  compareSelectedCountry = null;
  compareProjectionId = null;
  compareCountryInput.value = "";
  compareProjectionSelect.value = "";
  hideCompareCountryResults();
  refreshCompareHighlight();
}

function closeCompareCard() {
  compareCardVisible = false;
  compareCardEl.hidden = true;
  compareCardToggleBtn.classList.remove("active");
  compareCardToggleBtn.setAttribute("aria-pressed", "false");
  resetCompareSelection();
}

function openCompareCard() {
  compareCardVisible = true;
  compareCardEl.hidden = false;
  compareCardToggleBtn.classList.add("active");
  compareCardToggleBtn.setAttribute("aria-pressed", "true");

  // Country names depend on the geodata fetch in init() — populate the
  // alphabetical list once it's available instead of duplicating it here.
  if (worldData && !compareCountryNames) {
    compareCountryNames = [...new Set(worldData.features.map((f) => f.properties.name))].sort();
  }

  // Only one toolbar popover at a time — mirrors the info-card guard above.
  if (infoVisible) setInfoVisible(false);
}

compareCardToggleBtn.addEventListener("click", () => {
  if (compareCardVisible) closeCompareCard();
  else openCompareCard();
});

compareCardCloseBtn.addEventListener("click", closeCompareCard);

// ============================================================
// SIDEBAR — built dynamically from PROJECTIONS
// ============================================================
function buildSidebar() {
  const nav = document.getElementById("projection-list");
  let lastFamily = null;

  PROJECTIONS.forEach((proj) => {
    // PROJECTIONS is grouped contiguously by family (see its reorder
    // commit) — a family header goes up front, once per group, instead
    // of repeating the family as a caption on every single button.
    if (proj.family !== lastFamily) {
      const header = document.createElement("p");
      header.className = "proj-family-header";
      header.textContent = t(`family.${proj.family.toLowerCase()}`);
      nav.appendChild(header);
      lastFamily = proj.family;
    }

    const btn = document.createElement("button");
    btn.className      = "sidebar-btn proj-btn";
    btn.id             = `btn-${proj.id}`;
    btn.dataset.projId = proj.id;
    btn.textContent    = projectionName(proj);
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
const RECENTER_PRESETS = [
  { id: "world", rotate: null },
  { id: "africa", rotate: [-20, 0, 0] },
  { id: "china", rotate: [-105, 0, 0] },
  { id: "usaPacific", rotate: [98, 0, 0] },
  { id: "southAmericaFlipped", rotate: [60, 0, 0], flipVertical: true },
];

const RECENTER_INCOMPATIBLE = new Set(["albers", "polarNorth", "polarSouth"]);

let currentRecenterRotate = null;
let currentRecenterFlip = false;

function buildRecenterPanel() {
  const nav = document.getElementById("recenter-list");
  RECENTER_PRESETS.forEach((preset) => {
    const btn = document.createElement("button");
    btn.className = "sidebar-btn recenter-btn" + (preset.id === "world" ? " active" : "");
    btn.dataset.presetId = preset.id;
    btn.title = t(`view.${preset.id}.description`);
    btn.textContent = t(`view.${preset.id}.name`);
    btn.addEventListener("click", () => applyRecenter(preset.id));
    nav.appendChild(btn);
  });
}

// Turns the map over like a coin about the equator: scaleY follows
// cos(angle) as the angle eases 0 → 180°, so the map thins towards the
// equator, goes edge-on, then widens back mirrored — no slide, no blank
// frames. Scaling about the axis (rather than about the SVG origin, which
// the previous fold did) is what keeps the equator pinned in place:
// y' = axis + s·(y − axis) = s·y + axis·(1 − s).
//
// The axis is HEIGHT / 2 because every recentrable view keeps the globe
// untilted (rotate[1] = 0) and fitProjection centres the sphere
// vertically, so the equator sits on the viewport's centreline for all
// of them (checked for every projection × preset). A tilted preset would
// need projection([lon, 0])[1] here instead. At s = -1 this is exactly
// translate(0, HEIGHT) scale(1, -1), the resting mirrored state.
//
// onEdgeOn runs once when the map is edge-on (invisible), which is where
// the caller swaps the sphere rotation so the jump never shows.
//
// Every world-space layer (terrain/tissot/flight-path/true-size/the
// compare highlight, not just countries) needs to flip together, or
// they'd end up floating over the wrong regions of the now-flipped map.
// They're all children of worldGroup (see its declaration) specifically
// so ONE transition here moves everything at once, instead of seven
// separate D3 transitions each interpolating and writing the same value.
//
// .style() (CSS transform property) rather than .attr() (SVG transform
// attribute): browsers can promote a CSS-transform animation to its own
// GPU compositing layer and interpolate it there for free, whereas an
// attribute-driven transform forces a full repaint of everything inside
// the group on the main thread every frame. With ~170 country paths (each
// using vector-effect:non-scaling-stroke, which itself isn't cheap to
// recompute) plus terrain, that repaint cost was the actual source of
// the dropped frames during this flip.
function animateRecenterFlip(flip, onEdgeOn, duration = 900) {
  const axis = HEIGHT / 2;
  const sign = flip ? 1 : -1; // start upright when flipping in, mirrored when flipping out
  let swapped = false;

  return new Promise((resolve) => {
    const timer = d3.timer((elapsed) => {
      const t = d3.easeCubicInOut(Math.min(1, elapsed / duration));
      const s = sign * Math.cos(Math.PI * t);
      if (!swapped && t >= 0.5) {
        swapped = true;
        onEdgeOn();
      }
      worldGroup.style("transform", `translate(0px, ${axis * (1 - s)}px) scale(1, ${s})`);
      if (elapsed >= duration) {
        timer.stop();
        resolve();
      }
    });
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
      countries.attr("d", (d) => pathFn(lightOf(d)) || "");
      // Same per-frame refresh as animateBlend/animateRotation — terrain
      // (and the sphere outline/grid, if visible) used to only repaint at
      // the very end of a recenter, so they sat frozen throughout the
      // rotation while countries alone animated.
      renderGlobeSphere(globeSphere, projection);
      updateTerrainPaths(terrainGroup, projection);
      if (tissotVisible) updateTissotPaths(tissotGroup, projection);
      if (referenceVisible) updateReferencePaths(referenceGroup, projection);
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
  const wantsFlip = !!preset.flipVertical;

  if (wantsFlip !== currentRecenterFlip) {
    // Entering or leaving the South America (upside-down) mirror: doing the
    // usual longitude rotation sweep here would spin the sphere WHILE also
    // flipping it, reading as a distorted diagonal spin rather than a clean
    // mirror. Instead turn the map over about the equator and swap the
    // rotation instantly at the edge-on midpoint, where it's invisible.
    await animateRecenterFlip(wantsFlip, () => {
      currentRecenterRotate = preset.rotate;
      renderMap(makeProjection(currentDef, currentRecenterRotate));
      refreshReferenceLines();
    });
  } else {
    await animateRecenterRotation(currentDef, fromRot, preset.rotate, 900);
    currentRecenterRotate = preset.rotate;
    renderMap(makeProjection(currentDef, currentRecenterRotate)); // final render with native clipping
  }
  currentRecenterFlip = wantsFlip;

  isAnimating = false;
  refreshTissot();
  refreshReferenceLines();
}

function resetRecenter() {
  currentRecenterRotate = null;
  currentRecenterFlip = false;
  // Cleared synchronously (no transition): if a projection switch is about
  // to run, the morph must not inherit a leftover flip transform on the
  // group it repaints into.
  worldGroup.style("transform", null);
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
async function switchProjection(newProjId) {
  if (isAnimating || newProjId === currentProjectionId) return;
  if (!PROJECTIONS.find((p) => p.id === newProjId)) return;
  closeSidebar(); // no-op on desktop; on mobile, reveals the map after picking
  setActiveButton(newProjId); // highlight immediately — don't wait for the ~1.4-2.3s morph to finish
  // The active view carries over to any compatible projection (transitionTo
  // morphs with its rotation). Albers/polar can't be recentred, so ease back
  // to Europe first — otherwise the morph would end on a snapped rotation.
  if (RECENTER_INCOMPATIBLE.has(newProjId) && (currentRecenterRotate || currentRecenterFlip)) {
    await applyRecenter("world");
  }
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
  // below instead (see GLOBE ROTATION). The wheel is handled by the smooth
  // wheel zoom further down, not by d3.zoom.
  .filter((event) => {
    if (event.type === "wheel") return false;
    if (currentProjectionId === "orthographic") return false;
    return !event.ctrlKey && !event.button;
  })
  .on("zoom", (event) => {
    currentZoomTransform = event.transform;
    zoomLayer.attr("transform", currentZoomTransform);
  });

svg.call(zoom);

// Panning stops once the map's edge reaches the window's edge, so the map
// can never be dragged off-screen. The limit is the projected sphere itself:
// on an axis where the zoomed map is smaller than the window, d3.zoom keeps
// it centred instead, and on Mercator the poles (which overflow the initial
// frame on purpose, see fitProjection) stay reachable. Set on every
// renderMap since the outline depends on the projection; the recenter
// rotation and the upside-down flip (a mirror about the viewport's centre)
// don't change its bounding box.
function updatePanExtent(projection) {
  zoom.translateExtent(d3.geoPath().projection(projection).bounds({ type: "Sphere" }));
}

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

// d3.zoom applies each wheel notch in a single frame: a mouse wheel's
// notch is a ~15% scale jump, which read as a choppy zoom (measured in
// scripts/perf_transitions.py). Each notch instead eases towards a target
// scale; notches that arrive mid-ease add to that target, so spinning the
// wheel fast still zooms as far as before, and the point under the cursor
// stays put. Trackpad pinches arrive as ctrl+wheel and take the same path.
// Ignored during morphs: interrupting resetCamera's transition would
// reject the promise transitionTo awaits.
const WHEEL_ZOOM_MS = 150;
let wheelTargetScale = null;
let wheelZoomId = 0;

svg.on("wheel.smooth", (event) => {
  event.preventDefault();
  if (isAnimating) return;
  // Same notch-to-scale rate as d3.zoom's default wheelDelta.
  const delta = -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002) * (event.ctrlKey ? 10 : 1);
  const [kMin, kMax] = MAIN_ZOOM_SCALE_EXTENT;
  wheelTargetScale = Math.max(kMin, Math.min(kMax, (wheelTargetScale ?? currentZoomTransform.k) * 2 ** delta));
  const id = ++wheelZoomId;
  svg.transition()
    .duration(WHEEL_ZOOM_MS)
    .ease(d3.easeCubicOut)
    .call(zoom.scaleTo, wheelTargetScale, d3.pointer(event, svg.node()))
    // A newer notch interrupting this one keeps the target it built on;
    // anything else (end, zoom buttons, camera reset) starts afresh.
    .on("end interrupt", () => { if (id === wheelZoomId) wheelTargetScale = null; });
}, { passive: false });

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
    refreshReferenceLines();
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
    refreshReferenceLines();
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
const compareContainer = document.getElementById("compare-container");
const projectionListEl = document.getElementById("projection-list");

let compareMode = false;
let comparePanels = null; // built lazily on first toggle-on, once panel sizes are known

function buildComparePanel(panelEl, initialProjId) {
  const select = panelEl.querySelector(".compare-select");
  PROJECTIONS.forEach((proj) => {
    const option = document.createElement("option");
    option.value = proj.id;
    option.textContent = projectionName(proj);
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
    compareContainer.hidden = !compareMode;

    // The info card takes real estate the two compare panels need — force
    // it closed on entering compare mode; leaving compare mode doesn't
    // reopen it, same as any other time the "i" icon hasn't been clicked.
    if (compareMode && infoVisible) setInfoVisible(false);

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

// Same idea as updateTerrainPaths: re-paths the already-mounted graticule
// and circles without re-running renderTissot's data join every frame.
function updateTissotPaths(group, projection) {
  const path = d3.geoPath().projection(projection);
  group.selectAll("path.tissot-graticule").attr("d", path);
  group.selectAll("path.tissot").attr("d", (d) => path(d3.geoCircle().center(d).radius(TISSOT_RADIUS)()));
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
function updateReferencePaths(group, projection) {
  const path = d3.geoPath().projection(projection);
  group.selectAll("path.reference-line").attr("d", (d) => path(d.geometry));
}

let referenceVisible = false;
const referenceToggleBtn = document.getElementById("reference-toggle-btn");

// Called wherever the main view's projection or rotation settles, next to
// refreshTissot — the lines must be re-projected, not just re-shown.
function refreshReferenceLines() {
  if (!referenceVisible) {
    referenceGroup.selectAll("path.reference-line").remove();
    return;
  }
  const currentDef = PROJECTIONS.find((p) => p.id === currentProjectionId);
  renderReferenceLines(referenceGroup, makeProjection(currentDef, currentRecenterRotate));
}

referenceToggleBtn.addEventListener("click", () => {
  referenceVisible = !referenceVisible;
  referenceToggleBtn.classList.toggle("active", referenceVisible);
  referenceToggleBtn.setAttribute("aria-pressed", String(referenceVisible));
  refreshReferenceLines();
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
// WELCOME MODAL
//
// One modal, two parts: a short pitch (why flat maps lie), then a
// "how it works" pointer to each control. Opens on every launch —
// there is no "seen" flag and no manual re-open trigger.
// ============================================================

const helpModalBackdrop = document.getElementById("help-modal-backdrop");
const helpModalCloseBtn = document.getElementById("help-modal-close");

function openHelpModal() {
  helpModalBackdrop.hidden = false;
}

function closeHelpModal() {
  helpModalBackdrop.hidden = true;
}

helpModalCloseBtn.addEventListener("click", closeHelpModal);

helpModalBackdrop.addEventListener("click", (event) => {
  if (event.target === helpModalBackdrop) closeHelpModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !helpModalBackdrop.hidden) closeHelpModal();
});


// ============================================================
// INIT — fetch GeoJSON then render
// ============================================================
async function init() {
  // Before anything renders: sidebar buttons, info card and view labels all
  // read their text through t().
  await loadLanguage("en");
  openHelpModal(); // after the language loads, or the modal would flash empty

  const [worldResponse, terrainResponse] = await Promise.all([
    fetch("/data/world.geojson"),
    fetch("/data/terrain.geojson"),
  ]);
  worldData = await worldResponse.json();
  terrainData = await terrainResponse.json();
  buildLightGeometry(worldData.features);
  buildLightGeometry(terrainData.features);

  const initialProj = PROJECTIONS.find((p) => p.id === currentProjectionId);
  buildSidebar();
  buildRecenterPanel();
  buildCompareProjectionOptions();
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
// reloads and stays constant across projection switches. The
// toolbar's icon (see map-tools) is the only control for this now —
// the sidebar used to have its own checkbox too, dropped as a
// duplicate once the toolbar icon existed.
// ============================================================
const THEME_STORAGE_KEY = "mapProjektorTheme";

const themeToggleBtn = document.getElementById("theme-toggle-btn");

// Unlike the grid/compare/info tool icons, this one is a plain on/off
// switch, never shown as "selected" (no .active class) — see the Figma
// spec's note that light/dark has no selected state, just two positions.
function applyTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  themeToggleBtn.setAttribute("aria-pressed", String(theme === "dark"));
}

const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
if (savedTheme !== null) {
  applyTheme(savedTheme);
}

themeToggleBtn.addEventListener("click", () => {
  const theme = document.body.getAttribute("data-theme") === "dark" ? "" : "dark";
  applyTheme(theme);
  localStorage.setItem(THEME_STORAGE_KEY, theme);
});
