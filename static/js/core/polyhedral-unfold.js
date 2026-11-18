// ============================================================
// POLYHEDRAL UNFOLD — the maths of folding a polyhedral map's net
//
// Dymaxion is the Earth on an icosahedron, flattened along a net of
// triangles. Each triangle's content is flat, so the finished map can be
// drawn once and cut into its faces; animating it is then only moving 24
// flat pieces in 3D, which an affine transform per face renders exactly.
//
// Everything lives in the finished map's own coordinates (screen pixels,
// z = 0 is the map's plane, +z points away from the viewer). A face turns
// about the edge it shares with its parent in the net (d3-geo-polygon's
// tree); folded, the net closes into the icosahedron, which is then placed
// on the globe the app was showing, vertex on vertex.
//
// Pure maths on the projections handed in: no DOM. Uses the global d3.
// ============================================================

// Facets per face edge: a facet spans ~10° of the globe, so the silhouette of
// the facetted globe strays from the true circle by about a pixel.
const FACET_CUTS = 6;

// 4x4 matrices, row-major, acting on column vectors [x, y, z, 1].
export const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

export function multiply(a, b) {
  const r = new Array(16).fill(0);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++)
      for (let k = 0; k < 4; k++) r[i * 4 + j] += a[i * 4 + k] * b[k * 4 + j];
  return r;
}

export function apply(m, [x, y, z]) {
  return [0, 1, 2].map((i) => m[i * 4] * x + m[i * 4 + 1] * y + m[i * 4 + 2] * z + m[i * 4 + 3]);
}

const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalise = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };
const mean3 = (points) => [0, 1, 2].map((i) => points.reduce((s, p) => s + p[i], 0) / points.length);

// Rotation by `angle` about the line through a and b, both in the map's plane.
export function rotationAbout(a, b, angle) {
  const [x, y, z] = normalise([b[0] - a[0], b[1] - a[1], 0]);
  const c = Math.cos(angle), s = Math.sin(angle), C = 1 - c;
  const R = [
    x * x * C + c, x * y * C - z * s, x * z * C + y * s, 0,
    y * x * C + z * s, y * y * C + c, y * z * C - x * s, 0,
    z * x * C - y * s, z * y * C + x * s, z * z * C + c, 0,
    0, 0, 0, 1,
  ];
  const to = [1, 0, 0, a[0], 0, 1, 0, a[1], 0, 0, 1, 0, 0, 0, 0, 1];
  const back = [1, 0, 0, -a[0], 0, 1, 0, -a[1], 0, 0, 1, 0, 0, 0, 0, 1];
  return multiply(to, multiply(R, back));
}

// Unit quaternion [w, x, y, z] of a 3x3 rotation matrix.
export function quaternionOf(m) {
  const trace = m[0][0] + m[1][1] + m[2][2];
  let w, x, y, z;
  if (trace > 0) {
    const S = Math.sqrt(trace + 1) * 2;
    [w, x, y, z] = [S / 4, (m[2][1] - m[1][2]) / S, (m[0][2] - m[2][0]) / S, (m[1][0] - m[0][1]) / S];
  } else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) {
    const S = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2;
    [w, x, y, z] = [(m[2][1] - m[1][2]) / S, S / 4, (m[0][1] + m[1][0]) / S, (m[0][2] + m[2][0]) / S];
  } else if (m[1][1] > m[2][2]) {
    const S = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2;
    [w, x, y, z] = [(m[0][2] - m[2][0]) / S, (m[0][1] + m[1][0]) / S, S / 4, (m[1][2] + m[2][1]) / S];
  } else {
    const S = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2;
    [w, x, y, z] = [(m[1][0] - m[0][1]) / S, (m[0][2] + m[2][0]) / S, (m[1][2] + m[2][1]) / S, S / 4];
  }
  return normalise([w, x, y, z]);
}

// The rotation `u` of the way from q to no rotation at all (slerp), as a 3x3 matrix.
export function towardsIdentity(q, u) {
  let [w, x, y, z] = q[0] < 0 ? q.map((v) => -v) : q;
  const theta = Math.acos(Math.min(1, w)), s = Math.sin(theta);
  const a = s < 1e-9 ? 1 - u : Math.sin((1 - u) * theta) / s;
  const b = s < 1e-9 ? u : Math.sin(u * theta) / s;
  [w, x, y, z] = normalise([a * w + b, a * x, a * y, a * z]);
  return [
    [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
    [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
    [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
  ];
}

// A triangle cut into n × n facets, as barycentric weights of its three
// corners: the same grid serves every face, whatever the face's shape. Facets
// keep the parent's winding so a back-face test on the screen can tell the
// side of the solid facing the viewer.
export function subdivideTriangle(n) {
  const vertices = [], index = [];
  for (let i = 0; i <= n; i++) {
    index.push([]);
    for (let j = 0; j <= n - i; j++) {
      index[i].push(vertices.length);
      vertices.push([(n - i - j) / n, j / n, i / n]);
    }
  }
  const triangles = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n - i; j++) {
      triangles.push([index[i][j], index[i][j + 1], index[i + 1][j]]);
      if (j < n - i - 1) triangles.push([index[i][j + 1], index[i + 1][j + 1], index[i + 1][j]]);
    }
  }
  return { vertices, triangles };
}

const cartesian = ([lon, lat]) => {
  const l = (lon * Math.PI) / 180, p = (lat * Math.PI) / 180;
  return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
};

// Where a corner of the net lands on the finished map. A corner is shared by
// several faces, maybe far apart in the net: nudged a hair into the face, it
// is projected through that face and no other (d3-geo-polygon's own trick).
function onMap(projection, toGeographic, corner, centroid) {
  return projection(toGeographic(d3.geoInterpolate(corner, centroid)(1e-6)));
}

// The similarity (scale, rotation, translation) that maps the three points
// `from` onto `to`, as a scale, a 3x3 rotation and a translation.
function similarity(from, to) {
  const frame = ([p0, p1, p2]) => {
    const e1 = normalise(sub(p1, p0)), e3 = normalise(cross(sub(p1, p0), sub(p2, p0)));
    return [e1, cross(e3, e1), e3];
  };
  const f = frame(from), t = frame(to);
  const rotation = [0, 1, 2].map((r) => [0, 1, 2].map((c) => t[0][r] * f[0][c] + t[1][r] * f[1][c] + t[2][r] * f[2][c]));
  const scale = Math.hypot(...sub(to[1], to[0])) / Math.hypot(...sub(from[1], from[0]));
  return { scale, rotation };
}

// `map` is the fitted polyhedral projection (d3-geo-polygon, with tree());
// `globe` the fitted orthographic projection the folded net must sit on.
// Returns the faces (their corners on the finished map), frame(turn,
// open): turn and open run 0 → 1, the closed solid turning from the globe to
// face the viewer, then its hinges opening from the root out; and
// facetFrame(u): the globe itself becoming that closed solid, u 0 → 1.
export function buildNet(map, globe) {
  const toGeographic = d3.geoRotation(map.rotate()).invert;

  const faces = [];
  (function walk(node, parent, depth) {
    const corners = node.face;
    const centroid = d3.geoCentroid({ type: "MultiPoint", coordinates: corners });
    const face = {
      id: faces.length,
      parent,
      depth,
      corners,
      centroid,
      flat: corners.map((c) => onMap(map, toGeographic, c, centroid)),
      // The icosahedron face it is, or a piece of: d3-geo-polygon keeps the
      // whole face's centre on the pieces of the faces it splits.
      normal: cartesian(corners.centroid),
    };
    if (parent) {
      face.hinge = node.shared.map((c) => onMap(map, toGeographic, c, centroid));
      face.fold = Math.acos(Math.max(-1, Math.min(1, dot(face.normal, parent.normal))));
    }
    faces.push(face);
    (node.children || []).forEach((child) => walk(child, face, depth + 1));
  })(map.tree(), null, 0);

  const maxDepth = Math.max(...faces.map((f) => f.depth));
  const middle = (points) => [points.reduce((s, p) => s + p[0], 0) / points.length, points.reduce((s, p) => s + p[1], 0) / points.length];
  for (const face of faces) {
    face.flatMiddle = middle(face.flat);
    if (!face.parent) continue;
    // Every hinge folds away from the viewer, so the net closes behind the root face
    const test = apply(rotationAbout(face.hinge[0], face.hinge[1], face.fold), [...face.flatMiddle, 0]);
    face.sign = test[2] >= 0 ? 1 : -1;
  }

  // Each face's place in 3D, from the hinges' openings (0 folded, 1 flat)
  function placements(openingOf) {
    const placed = new Map();
    for (const face of faces) {
      placed.set(face, face.parent
        ? multiply(placed.get(face.parent), rotationAbout(face.hinge[0], face.hinge[1], face.sign * face.fold * (1 - openingOf(face))))
        : identity());
    }
    return placed;
  }

  // Sit the closed solid on the globe: the icosahedron's 12 vertices (the
  // corners at ±90° or ±atan(1/2) latitude) on the same points of the globe.
  const folded = placements(() => 0);
  const vertexLatitudes = [90, (Math.atan(0.5) * 180) / Math.PI];
  const [tx, ty] = globe.translate(), k = globe.scale(), turnGlobe = d3.geoRotation(globe.rotate());
  const onGlobe = (geo) => {
    const [l, p] = turnGlobe(geo).map((v) => (v * Math.PI) / 180);
    return [tx + k * Math.cos(p) * Math.sin(l), ty - k * Math.sin(p), -k * Math.cos(p) * Math.cos(l)];
  };
  const vertices = new Map();
  for (const face of faces) face.corners.forEach((c, i) => {
    if (!vertexLatitudes.some((lat) => Math.abs(Math.abs(c[1]) - lat) < 1e-9)) return;
    const key = c.map((v) => v.toFixed(6)).join();
    if (!vertices.has(key)) vertices.set(key, { net: apply(folded.get(face), [...face.flat[i], 0]), globe: onGlobe(toGeographic(c)) });
  });
  const pairs = [...vertices.values()];
  let best = null;
  for (let a = 0; a < pairs.length; a++)
    for (let b = a + 1; b < pairs.length; b++)
      for (let c = b + 1; c < pairs.length; c++) {
        const area = Math.hypot(...cross(sub(pairs[b].net, pairs[a].net), sub(pairs[c].net, pairs[a].net)));
        if (!best || area > best.area) best = { area, three: [pairs[a], pairs[b], pairs[c]] };
      }
  const fit = similarity(best.three.map((p) => p.net), best.three.map((p) => p.globe));
  const turnQuaternion = quaternionOf(fit.rotation);
  const globeCentre = [tx, ty];
  const mapMiddle = middle(faces.flatMap((f) => f.flat));

  // Where the whole net stands on screen for a turn and an opening: the
  // matrix taking a placed face's 3D points to the screen.
  function viewAt(turn, open, placed) {
    // From the globe's size and turn to the map's own frame; the content's
    // middle travels in a straight line from the globe's centre to the map's
    const progress = (turn + open) / 2;
    const R = towardsIdentity(turnQuaternion, turn);
    const sc = fit.scale + (1 - fit.scale) * progress;
    const view = [
      sc * R[0][0], sc * R[0][1], sc * R[0][2], 0,
      sc * R[1][0], sc * R[1][1], sc * R[1][2], 0,
      sc * R[2][0], sc * R[2][1], sc * R[2][2], 0,
      0, 0, 0, 1,
    ];
    const now = mean3(faces.flatMap((f) => f.flat.map((p) => apply(multiply(view, placed.get(f)), [...p, 0]))));
    view[3] = globeCentre[0] + (mapMiddle[0] - globeCentre[0]) * progress - now[0];
    view[7] = globeCentre[1] + (mapMiddle[1] - globeCentre[1]) * progress - now[1];
    return view;
  }

  function frame(turn, open) {
    // Hinges open from the root out, each level starting before the last ends
    const placed = placements((face) => {
      const start = ((face.depth - 1) / maxDepth) * 0.64;
      return d3.easeCubicInOut(Math.max(0, Math.min(1, (open - start) / 0.36)));
    });
    const view = viewAt(turn, open, placed);

    return faces
      .map((face) => {
        const m = multiply(view, placed.get(face));
        return { face, matrix: [m[0], m[4], m[1], m[5], m[3], m[7]], depth: apply(m, [...face.flatMiddle, 0])[2] };
      })
      .sort((a, b) => b.depth - a.depth); // farthest first, so nearer faces paint over them
  }

  // The globe becoming the closed solid: every face cut into facets, each
  // vertex a point of the sphere that travels in a straight line to its place
  // on the solid. The texture point is where that vertex sits on the finished
  // map, so the facets carry the map's own picture along. At u = 1 the
  // vertices are exactly where frame(0, 0) puts the closed net, so the
  // hand-over to it cannot jump.
  const grid = subdivideTriangle(FACET_CUTS);
  const closed = viewAt(0, 0, folded);
  const toLonLat = (v) => {
    const [x, y, z] = normalise(v);
    return [(Math.atan2(y, x) * 180) / Math.PI, (Math.asin(z) * 180) / Math.PI];
  };
  const facets = faces.map((face) => {
    const corners3 = face.corners.map(cartesian);
    // The facet grid sits on the sphere, not on the chord triangle: normalised mix of the corners
    const geographic = grid.vertices.map((w) => toLonLat([0, 1, 2].map((i) => w[0] * corners3[0][i] + w[1] * corners3[1][i] + w[2] * corners3[2][i])));
    const texture = geographic.map((g) => onMap(map, toGeographic, g, face.centroid));
    return {
      face,
      texture,
      sphere: geographic.map((g) => onGlobe(toGeographic(g))),
      solid: texture.map((t) => apply(multiply(closed, folded.get(face)), [...t, 0])),
    };
  });

  function facetFrame(u) {
    return facets.map(({ face, texture, sphere, solid }) => ({
      face,
      texture,
      triangles: grid.triangles,
      points: sphere.map((s, i) => s.map((v, axis) => v + (solid[i][axis] - v) * u)),
    }));
  }

  return { faces, frame, facetFrame };
}
