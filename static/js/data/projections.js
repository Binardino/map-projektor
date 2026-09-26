import { t } from "../i18n.js";

// ============================================================
// PROJECTIONS REGISTRY
//
// Each object describes one projection. The sidebar, switching
// logic, and animation all read from this array — nothing else
// needs to change when adding a projection.
//
// d3fn must return a D3 projection instance (not yet fitted to
// the viewport — that happens in makeProjection()).
//
// Optional capabilities (defaults in PROJECTION_DEFAULTS below), so no
// code elsewhere has to test for a projection by its id:
//   globe          the one projection that is the 3D globe: void backdrop,
//                  drag-to-rotate, hub of the polar route
//   clipAngle      clip circle in degrees; 90 keeps only the visible hemisphere
//   fit            "sphere" fits the whole sphere; "width" fits the width and
//                  lets the rest overflow (see fitProjection)
//   polarRotation  set on pole-centred views: the transition routes through
//                  the globe (see POLAR ROUTE) instead of blending directly
//   recenterable   false where the projection's own rotate() is load-bearing
//                  (polar views) or tuned to one region (Albers)
//   tilted         takes a view's full tilt, not just its longitude: tipping
//                  a flat map turns it oblique, which reads as a broken map
// ============================================================
// name and tradeoffs live in static/i18n/<lang>.json under projection.<id>.*;
// `family` is a grouping identifier whose label is family.<lowercase family>.
export const projectionName = (proj) => t(`projection.${proj.id}.name`);

const PROJECTION_DEFAULTS = {
  globe: false,
  clipAngle: 179.9,
  fit: "sphere",
  polarRotation: null,
  recenterable: true,
  tilted: false,
};

export const PROJECTIONS = [
  {
    id: "mercator",
    family: "Cylindrical",
    year: 1569,
    description:
      "Preserves angles (conformal). Severely distorts area near the poles. " +
      "The standard for maritime navigation for centuries.",
    d3fn: () => d3.geoMercator(),
    fit: "width",
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
    globe: true,
    clipAngle: 90,
    tilted: true,
  },
  {
    id: "azimuthalEqualArea",
    family: "Azimuthal",
    year: 1772,
    description:
      "Preserves area accurately across the entire map from a central anchor point. " +
      "Unlike Mercator, Greenland and Africa appear at their true relative sizes.",
    d3fn: () => d3.geoAzimuthalEqualArea(),
    tilted: true,
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
    polarRotation: [0, -90],
    recenterable: false,
  },
  {
    id: "polarSouth",
    family: "Azimuthal",
    year: 1000,
    description:
      "Azimuthal equidistant centred on the South Pole. Antarctica sits at the " +
      "centre, surrounded by the Southern Ocean and every other continent.",
    d3fn: () => d3.geoAzimuthalEquidistant().rotate([0, 90]).clipAngle(179),
    polarRotation: [0, 90],
    recenterable: false,
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
    recenterable: false,
  },
].map((projDef) => ({ ...PROJECTION_DEFAULTS, ...projDef }));

// The globe (exactly one, see tests/js/projections.test.mjs).
export const GLOBE = PROJECTIONS.find((p) => p.globe);

// Fails loudly on an unknown id instead of handing back undefined to be
// dereferenced somewhere further down.
export function getProjection(id) {
  const projDef = PROJECTIONS.find((p) => p.id === id);
  if (!projDef) throw new Error(`Unknown projection id: ${id}`);
  return projDef;
}
