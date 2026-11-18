import { DEGREES, blendProjection } from "./projection.js";
import { GLOBE } from "../data/projections.js";
import { lightOf } from "./geometry.js";
import { buildNet } from "./polyhedral-unfold.js";
import { terrainData, worldData } from "../data/geodata.js";
import { renderGlobeSphere, updateTerrainPaths } from "./render.js";
import { rotationFor } from "./recenter.js";
import { t } from "../i18n.js";
import { TIMING } from "../config.js";
import { emit } from "../state.js";

// Drives one blend from alpha 0 → 1, optionally morphing the clip circle.
//
// fromSphereProj/toSphereProj (only passed for clip-angle-animated blends,
// which always pair orthographic with something else — see clipAngle in data/projections.js)
// are each endpoint's own plain, unblended projection. They're there
// because tracing the special {type: "Sphere"} whole-globe marker THROUGH
// the live blended+clip-animating projection collapses to a degenerate
// sliver at some intermediate t — a d3 clip-circle edge case specific to
// blending orthographic's raw function (only valid within 90° of center)
// against one that isn't. Countries and terrain render fine through the
// same blend; only this synthetic outline breaks. Sidestepped entirely by
// crossfading between the two endpoints' own (always well-behaved) static
// sphere shapes instead of animating one continuously-blended shape.
function animateBlend(view, projection, duration, clipFrom = null, clipTo = null, fromSphereProj = null, toSphereProj = null, rotationAt = null, antimeridian = true) {
  const pathFn    = d3.geoPath().projection(projection);
  const countries = view.layers.countries.selectAll("path.country");

  const crossfade = clipFrom !== null && fromSphereProj && toSphereProj;
  if (crossfade) {
    const spherePath = d3.geoPath();
    view.layers.sphere.attr("d", spherePath.projection(fromSphereProj)({ type: "Sphere" })).style("opacity", 1);
    view.sphereFade.attr("d", spherePath.projection(toSphereProj)({ type: "Sphere" })).style("opacity", 0);
  }

  return new Promise((resolve) => {
    const timer = d3.timer((elapsed) => {
      const t = d3.easeCubicInOut(Math.min(1, elapsed / duration));
      projection.alpha(t);
      if (rotationAt) projection.rotate(rotationAt(t));
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
        projection.preclip(radius > Math.PI / 2 && antimeridian
          ? (stream) => d3.geoClipAntimeridian(d3.geoClipCircle(radius)(stream))
          : d3.geoClipCircle(radius));
      }
      countries.attr("d", (d) => pathFn(lightOf(d)) || "");
      if (crossfade) {
        view.layers.sphere.style("opacity", 1 - t);
        view.sphereFade.style("opacity", t);
      } else {
        renderGlobeSphere(view, projection);
      }
      if (view.layers.terrain) updateTerrainPaths(view.layers.terrain, projection);
      emit("frame", { view, projection });
      if (elapsed >= duration) {
        timer.stop();
        if (crossfade) view.layers.sphere.style("opacity", null);
        resolve();
      }
    });
  });
}

function lerpRotation(from, to, t) {
  const a = from || [0, 0, 0];
  const b = to || [0, 0, 0];
  return [0, 1, 2].map((i) => (a[i] || 0) + ((b[i] || 0) - (a[i] || 0)) * t);
}

// Both endpoints take the active recenter view (see rotationFor): they're
// built unrotated and the blend wrapper carries the rotation, so clip
// circles stay centred on the view (see blendProjection) and the morph keeps
// the user's framing instead of snapping back to Europe. Between the tilted
// globe and a flat map the two rotations differ, so the wrapper eases from
// one to the other along with the shape.
export function animateTransition(view, fromDef, toDef, duration) {
  const rotFrom    = rotationFor(fromDef);
  const rotTo      = rotationFor(toDef);
  const projection = blendProjection(view.makeProjection(fromDef), view.makeProjection(toDef), rotFrom);
  const rotationAt = rotFrom === rotTo ? null : (t) => lerpRotation(rotFrom, rotTo, t);
  // The crossfade outlines are static endpoint shapes, so they carry the rotation themselves
  const fromProjection = view.makeProjection(fromDef, rotFrom);
  const toProjection   = view.makeProjection(toDef, rotTo);
  // The globe clips to the visible hemisphere (90°); everything else clips
  // at the antimeridian, which animateBlend adds on top of the circle.
  // Animating between the two makes back-hemisphere countries shrink
  // smoothly into the horizon instead of snapping in or out.
  const clipFrom = fromDef.clipAngle;
  const clipTo   = toDef.clipAngle;
  // Only azimuthal-hemisphere transitions need the circle clip; other
  // pairs keep D3's default antimeridian clipping untouched.
  if (clipFrom !== clipTo) return animateBlend(view, projection, duration, clipFrom, clipTo, fromProjection, toProjection, rotationAt);
  return animateBlend(view, projection, duration, null, null, null, null, rotationAt);
}

// ============================================================
// ASPECT ROUTE — via the orthographic globe
//
// A projection with its own aspect (a polar view) is drawn at a
// rotation far from every other projection's. Blending directly
// would drag Antarctica's ring across the whole map (a disc cannot
// become an annulus that encircles everything without sweeping
// over it), and the blend clips at the geographic antimeridian,
// not where the rotated projection cuts the world. Instead: fold
// the map onto the globe, spin the globe to/from the aspect (a
// true projection every frame — always clean), then unfold into
// the target in its own rotated frame.
// ============================================================
// Spins a real orthographic globe between two orientations.
function animateRotation(view, fromRot, toRot, duration) {
  const projection = d3.geoOrthographic().fitSize([view.width, view.height], { type: "Sphere" });
  const pathFn    = d3.geoPath().projection(projection);
  const countries = view.layers.countries.selectAll("path.country");

  return new Promise((resolve) => {
    const timer = d3.timer((elapsed) => {
      const t = d3.easeCubicInOut(Math.min(1, elapsed / duration));
      // All three angles: an aspect may roll the map as well as tip it
      projection.rotate([
        fromRot[0] + (toRot[0] - fromRot[0]) * t,
        fromRot[1] + (toRot[1] - fromRot[1]) * t,
        (fromRot[2] || 0) + ((toRot[2] || 0) - (fromRot[2] || 0)) * t,
      ]);
      countries.attr("d", (d) => pathFn(lightOf(d)) || "");
      renderGlobeSphere(view, projection);
      if (view.layers.terrain) updateTerrainPaths(view.layers.terrain, projection);
      emit("frame", { view, projection });
      if (elapsed >= duration) {
        timer.stop();
        resolve();
      }
    });
  });
}

// Morphs between the orthographic globe and an aspect projection, both at
// its aspect. Endpoints are built unrotated and the blend wrapper carries
// the rotation, so the hemisphere clip stays centred on the aspect while it
// opens (90° → the target's clip) or closes, and the blend cuts the world
// where the target does.
function animateAspectUnfold(view, def, foldToGlobe, duration) {
  const rotation = def.aspect;
  const globe = d3.geoOrthographic().fitSize([view.width, view.height], { type: "Sphere" });
  const flat  = def.d3fn().rotate([0, 0, 0]).fitSize([view.width, view.height], { type: "Sphere" });
  const projection = foldToGlobe
    ? blendProjection(flat, globe, rotation)
    : blendProjection(globe, flat, rotation);

  // Rotated clones purely for animateBlend's crossfade sphere shapes (see
  // its comment) — globe/flat above are deliberately built unrotated
  // (blendProjection's wrapper carries the rotation instead), but the
  // crossfade needs each endpoint's shape as it actually appears on
  // screen, rotation included.
  const globeAtRotation = d3.geoOrthographic().rotate(rotation).fitSize([view.width, view.height], { type: "Sphere" });
  const flatAtRotation  = def.d3fn().fitSize([view.width, view.height], { type: "Sphere" });

  // Cut the way the target does: a projection drawn with a clip circle (the
  // polar views, Peirce) has no seam at the antimeridian, and one there left
  // a stray edge across Peirce's corner until the final render.
  // (d3 reads an antimeridian cut back as clipAngle() 0.)
  const antimeridian = !flatAtRotation.clipAngle();
  return foldToGlobe
    ? animateBlend(view, projection, duration, def.clipAngle, 90, flatAtRotation, globeAtRotation, null, antimeridian)
    : animateBlend(view, projection, duration, 90, def.clipAngle, globeAtRotation, flatAtRotation, null, antimeridian);
}

export async function aspectTransition(view, fromDef, toDef) {
  const orthoDef = GLOBE;
  const fromRot  = fromDef.aspect;
  const toRot    = toDef.aspect;

  // Fold: reach an orthographic globe at the starting orientation
  if (fromRot) {
    await animateAspectUnfold(view, fromDef, true, TIMING.polarFold);
  } else if (!fromDef.globe) {
    await animateTransition(view, fromDef, orthoDef, TIMING.polarFold);
  }

  // Spin between orientations (north↔south rolls through the equator); a
  // non-polar end sits on the globe at the active view's tilt.
  const globeRot = rotationFor(orthoDef) || [0, 0];
  const spinFrom = fromRot || globeRot, spinTo = toRot || globeRot;
  // Nothing to spin when neither end has an aspect (the polyhedral route
  // only goes to or from the globe through here)
  if (spinFrom.some((v, i) => v !== spinTo[i])) await animateRotation(view, spinFrom, spinTo, TIMING.polarSpin);

  // Unfold: from the globe to the target
  if (toRot) {
    await animateAspectUnfold(view, toDef, false, TIMING.polarUnfold);
  } else if (!toDef.globe) {
    await animateTransition(view, orthoDef, toDef, TIMING.polarUnfold);
  }
}

// ============================================================
// POLYHEDRAL ROUTE — via the globe, folding into the polyhedron
//
// No blend can tear a map along twenty triangle edges, and drawing
// Dymaxion takes ~250ms, far over a frame. So the map is painted once
// into an image and cut into its faces; the faces are then moved in 3D
// (see core/polyhedral-unfold.js). Towards Dymaxion: the map folds onto
// the globe as on the aspect route, the globe gives way to the closed
// icosahedron sitting exactly on it, which turns to face the viewer and
// opens hinge by hinge, from the root out, into the flat map. The real
// map is then drawn underneath the last frame, which is identical to it.
// Away from Dymaxion, the same film runs backwards.
// ============================================================
const NET_SEAM = 0.6; // px each face's cut-out grows by, or anti-aliasing leaves a hairline between faces

// The map as it would be drawn, in the colours the stylesheet gives it on
// screen right now (theme included), painted once into an image.
function paintMap(view, projection) {
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const canvas = Object.assign(document.createElement("canvas"), { width: view.width * ratio, height: view.height * ratio });
  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);
  const path = d3.geoPath(projection, ctx);
  const style = (node) => node && getComputedStyle(node);

  ctx.fillStyle = style(view.layers.sphere.node()).fill;
  ctx.beginPath(); path({ type: "Sphere" }); ctx.fill();

  const country = style(view.layers.countries.select("path.country").node());
  ctx.fillStyle = country.fill;
  ctx.strokeStyle = country.stroke;
  ctx.lineWidth = parseFloat(country.strokeWidth) || 1;
  for (const feature of worldData.features) {
    ctx.beginPath(); path(lightOf(feature)); ctx.fill(); ctx.stroke();
  }
  if (view.layers.terrain) {
    for (const feature of terrainData.features) {
      const patch = style(view.layers.terrain.select(`path.terrain-${feature.properties.kind}`).node());
      if (!patch) continue;
      ctx.globalAlpha = parseFloat(patch.fillOpacity);
      ctx.fillStyle = patch.fill;
      ctx.beginPath(); path(lightOf(feature)); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  return canvas.toDataURL();
}

// The faces as pieces of that one image, each cut to its triangle, over the
// map in the same viewport (same camera). show(turn, open) places them.
function mountNet(view, net, href) {
  const group = d3.select(view.world.node().parentNode).append("g")
    .attr("class", "polyhedral-net")
    .style("pointer-events", "none");
  const defs = group.append("defs");
  const pieces = new Map();
  for (const face of net.faces) {
    const [cx, cy] = face.flatMiddle;
    const grown = face.flat.map(([x, y]) => {
      const d = Math.hypot(x - cx, y - cy) || 1;
      return [x + ((x - cx) / d) * NET_SEAM, y + ((y - cy) / d) * NET_SEAM];
    });
    defs.append("clipPath").attr("id", `net-face-${face.id}`)
      .append("polygon").attr("points", grown.map((p) => p.join(",")).join(" "));
    const piece = group.append("g");
    piece.append("image").attr("href", href).attr("width", view.width).attr("height", view.height)
      .attr("clip-path", `url(#net-face-${face.id})`);
    pieces.set(face, piece.node());
  }
  return {
    group,
    show(turn, open) {
      for (const { face, matrix } of net.frame(turn, open)) {
        const piece = pieces.get(face);
        piece.setAttribute("transform", `matrix(${matrix.join(",")})`);
        group.node().appendChild(piece); // farthest first: the nearer faces cover them
      }
    },
  };
}

// The map image, ready to be drawn from: a canvas needs the pixels decoded
// before the first frame, or that frame is blank.
async function loadImage(href) {
  const image = new Image();
  image.src = href;
  await image.decode();
  return image;
}

// The affine map taking the three points `from` onto the three points `to`,
// as canvas' setTransform wants it: x' = a·x + c·y + e, y' = b·x + d·y + f.
function affineBetween([p0, p1, p2], [q0, q1, q2]) {
  const det = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1]);
  const solve = (v0, v1, v2) => {
    const dx = ((v1 - v0) * (p2[1] - p0[1]) - (v2 - v0) * (p1[1] - p0[1])) / det;
    const dy = ((v2 - v0) * (p1[0] - p0[0]) - (v1 - v0) * (p2[0] - p0[0])) / det;
    return [dx, dy, v0 - dx * p0[0] - dy * p0[1]];
  };
  const [a, c, e] = solve(q0[0], q1[0], q2[0]);
  const [b, d, f] = solve(q0[1], q1[1], q2[1]);
  return [a, b, c, d, e, f];
}

// The globe becoming the closed solid, on a canvas over the map in the same
// viewport (same camera). A canvas, not SVG: hundreds of facets move every
// frame, which is a per-frame redraw rather than a retained scene. The
// surface is convex, so hiding the facets that turn their back to the viewer
// is all the depth handling it needs. show(u) places them, u 0 = globe, 1 = solid.
async function mountFacets(view, net, href) {
  const image = await loadImage(href);
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const group = d3.select(view.world.node().parentNode).append("g")
    .attr("class", "polyhedral-facets")
    .style("pointer-events", "none");
  const canvas = group.append("foreignObject").attr("width", view.width).attr("height", view.height)
    .append("xhtml:canvas")
    .attr("width", view.width * ratio).attr("height", view.height * ratio)
    .style("width", `${view.width}px`).style("height", `${view.height}px`)
    .node();
  const ctx = canvas.getContext("2d");

  return {
    group,
    show(u) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const frames = net.facetFrame(u);
      // The solid's middle, to tell a facet's outside from its inside
      const all = frames.flatMap((f) => f.points);
      const middle = [0, 1, 2].map((i) => all.reduce((sum, p) => sum + p[i], 0) / all.length);
      for (const { texture, triangles, points } of frames) {
        for (const triangle of triangles) {
          const [p0, p1, p2] = triangle.map((i) => points[i]);
          const normal = [
            (p1[1] - p0[1]) * (p2[2] - p0[2]) - (p1[2] - p0[2]) * (p2[1] - p0[1]),
            (p1[2] - p0[2]) * (p2[0] - p0[0]) - (p1[0] - p0[0]) * (p2[2] - p0[2]),
            (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]),
          ];
          const outward = [0, 1, 2].reduce((sum, i) => sum + normal[i] * ((p0[i] + p1[i] + p2[i]) / 3 - middle[i]), 0);
          // +z points away from the viewer: an outward normal with z < 0 faces us
          if (normal[2] * Math.sign(outward) >= 0) continue;

          const screen = [p0, p1, p2].map((p) => [p[0], p[1]]);
          const [cx, cy] = [0, 1].map((i) => (screen[0][i] + screen[1][i] + screen[2][i]) / 3);
          ctx.save();
          ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
          ctx.beginPath();
          screen.forEach(([x, y], i) => {
            const d = Math.hypot(x - cx, y - cy) || 1;
            const gx = x + ((x - cx) / d) * NET_SEAM, gy = y + ((y - cy) / d) * NET_SEAM;
            if (i === 0) ctx.moveTo(gx, gy); else ctx.lineTo(gx, gy);
          });
          ctx.closePath();
          ctx.clip();
          ctx.transform(...affineBetween(triangle.map((i) => texture[i]), screen));
          // Only the part of the image under this facet: the whole map per facet would cost hundreds of full draws
          const t = triangle.map((i) => texture[i]);
          const x0 = Math.floor(Math.min(...t.map((q) => q[0]))) - 1, y0 = Math.floor(Math.min(...t.map((q) => q[1]))) - 1;
          const x1 = Math.ceil(Math.max(...t.map((q) => q[0]))) + 1, y1 = Math.ceil(Math.max(...t.map((q) => q[1]))) + 1;
          ctx.drawImage(image, x0 * ratio, y0 * ratio, (x1 - x0) * ratio, (y1 - y0) * ratio, x0, y0, x1 - x0, y1 - y0);
          ctx.restore();
        }
      }
    },
  };
}

function animateFacets(layer, from, to, duration) {
  return new Promise((resolve) => {
    const timer = d3.timer((elapsed) => {
      const p = Math.min(1, elapsed / duration);
      layer.show(from + (to - from) * d3.easeCubicInOut(p));
      if (p >= 1) {
        timer.stop();
        resolve();
      }
    });
  });
}

// Plays the net from folded (0) to flat (1), or back: the solid turns for the
// first 30% of the time, then its hinges open.
function animateNet(layer, from, to, duration) {
  return new Promise((resolve) => {
    const timer = d3.timer((elapsed) => {
      const p = Math.min(1, elapsed / duration);
      const s = from + (to - from) * p;
      layer.show(d3.easeCubicInOut(Math.min(1, s / 0.3)), Math.max(0, (s - 0.3) / 0.7));
      if (p >= 1) {
        timer.stop();
        resolve();
      }
    });
  });
}

// The true globe and the facet globe look alike but are not the same picture:
// the facets carry Dymaxion's own rendering of each face, a few pixels off
// the orthographic coastlines and a touch softer. A cut between them would
// show, so these two meet in a short crossfade, and only these two.
function crossfade(out, into, duration) {
  return new Promise((resolve) => {
    const timer = d3.timer((elapsed) => {
      const t = Math.min(1, elapsed / duration);
      out.style("opacity", 1 - t);
      into.style("opacity", t);
      if (t >= 1) {
        timer.stop();
        resolve();
      }
    });
  });
}

// Draws the target itself when it is the polyhedral map; the caller draws
// any other target, as after the other routes.
export async function polyhedralTransition(view, fromDef, toDef) {
  const globeRotation = rotationFor(GLOBE) || [0, 0];
  const globe = view.makeProjection(GLOBE, globeRotation);

  if (toDef.transition === "unfold") {
    if (!fromDef.globe) await aspectTransition(view, fromDef, GLOBE);
    view.setProjection(GLOBE, globeRotation).render(); // the true globe, not the blend's last frame
    const map = view.makeProjection(toDef);
    const net = buildNet(map, globe);
    const href = paintMap(view, map);
    // Mounted before it is needed, hidden: the net's images get decoded while the globe facets
    const layer = mountNet(view, net, href);
    layer.show(0, 0);
    layer.group.style("opacity", 0);
    const facets = await mountFacets(view, net, href);
    facets.show(0);
    facets.group.style("opacity", 0);
    await crossfade(view.world, facets.group, TIMING.polyhedralSwap); // the facet globe stands in for the true one
    await animateFacets(facets, 0, 1, TIMING.polyhedralFacet);
    layer.group.style("opacity", null); // the closed solid, to the pixel what the facets ended on
    facets.group.remove();
    await animateNet(layer, 0, 1, TIMING.polyhedralUnfold);
    view.setProjection(toDef, rotationFor(toDef)).render(); // hidden by the identical last frame
    view.world.style("opacity", null);
    layer.group.remove();
    return;
  }

  const map = view.projection();
  const net = buildNet(map, globe);
  const href = paintMap(view, map);
  const layer = mountNet(view, net, href);
  layer.show(1, 1); // the map itself, to the pixel
  view.world.style("opacity", 0);
  const facets = await mountFacets(view, net, href);
  facets.group.style("opacity", 0);
  await animateNet(layer, 1, 0, TIMING.polyhedralUnfold);
  facets.show(1);
  facets.group.style("opacity", null);
  layer.group.remove();
  await animateFacets(facets, 1, 0, TIMING.polyhedralFacet);
  view.setProjection(GLOBE, globeRotation).render(); // under the facets, still hidden
  await crossfade(facets.group, view.world, TIMING.polyhedralSwap);
  view.world.style("opacity", null);
  facets.group.remove();
  if (!toDef.globe) await aspectTransition(view, GLOBE, toDef);
}
