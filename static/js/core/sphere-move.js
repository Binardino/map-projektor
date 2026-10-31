// ============================================================
// SPHERE MOVE
//
// Moves a shape across the globe without changing it: a rigid rotation
// of the sphere, so every distance inside the shape is kept. Redrawn by
// a projection at its new place, the shape then shows what that
// projection does there — that is the whole point of dragging a country.
// Pure maths (no D3, no DOM), so it runs under Node for the unit tests.
// ============================================================
const RADIANS = Math.PI / 180;

// The local frame at a point of the unit sphere: east, north and up.
// Written from the longitude and latitude, so it is defined at the poles
// too (where "east" has no meaning, the longitude still picks one).
function frameAt([lon, lat]) {
  const l = lon * RADIANS, p = lat * RADIANS;
  const cl = Math.cos(l), sl = Math.sin(l), cp = Math.cos(p), sp = Math.sin(p);
  return [
    [-sl, cl, 0],
    [-sp * cl, -sp * sl, cp],
    [cp * cl, cp * sl, sp],
  ];
}

// Returns the function moving a [lon, lat] point by the rotation that
// takes `from` to `to` and local north at `from` to local north at `to`:
// the shape stays upright as it travels instead of slowly turning, which
// a plain great-circle rotation would do.
export function sphereMover(from, to) {
  const [e1, n1, u1] = frameAt(from);
  const [e2, n2, u2] = frameAt(to);
  return ([lon, lat]) => {
    const l = lon * RADIANS, p = lat * RADIANS, cp = Math.cos(p);
    const v = [cp * Math.cos(l), cp * Math.sin(l), Math.sin(p)];
    // Coordinates of the point in the frame it leaves…
    const e = v[0] * e1[0] + v[1] * e1[1] + v[2] * e1[2];
    const n = v[0] * n1[0] + v[1] * n1[1] + v[2] * n1[2];
    const u = v[0] * u1[0] + v[1] * u1[1] + v[2] * u1[2];
    // …rebuilt in the frame it arrives in.
    const x = e * e2[0] + n * n2[0] + u * u2[0];
    const y = e * e2[1] + n * n2[1] + u * u2[1];
    const z = e * e2[2] + n * n2[2] + u * u2[2];
    return [Math.atan2(y, x) / RADIANS, Math.asin(Math.max(-1, Math.min(1, z))) / RADIANS];
  };
}

function moveCoordinates(coordinates, move) {
  return typeof coordinates[0] === "number" ? move(coordinates) : coordinates.map((c) => moveCoordinates(c, move));
}

// A copy of a GeoJSON feature, feature collection or geometry, moved so
// that `from` lands on `to`. The input is left untouched.
export function moveGeo(geo, from, to) {
  const move = sphereMover(from, to);
  const moved = (object) => {
    if (object.type === "FeatureCollection") return { ...object, features: object.features.map(moved) };
    if (object.type === "Feature") return { ...object, geometry: moved(object.geometry) };
    return { ...object, coordinates: moveCoordinates(object.coordinates, move) };
  };
  return moved(geo);
}
