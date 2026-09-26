import { state } from "./state.js";
import { globeSphere, globeSphereFade, mapGroup, terrainGroup } from "./scene.js";
import { lightOf } from "./geometry.js";
import { updatePanExtent } from "./camera.js";
import { getProjection } from "../data/projections.js";

// The sphere-outline stroke only shows in orthographic — it's the only
// projection where the disc needs a visible edge separating it from the
// void background (see .globe-sphere.active); every other projection's
// {type: "Sphere"} outline already reaches the void's own dark color at
// its non-rectangular corners, so no border is needed there.
export function updateGlobeBackground() {
  const isGlobe = getProjection(state.currentProjectionId).globe;
  globeSphere.classed("active", isGlobe);
}
// ============================================================
// RENDER — draw or update country paths for a given projection
// ============================================================
// Draws the sphere's own boundary as a real shape (ocean-colored, with a
// stroke) rather than relying on the background rect, so the globe's edge
// reads clearly against the void backdrop in orthographic view.
export function renderGlobeSphere(pathEl, projection) {
  const path = d3.geoPath().projection(projection);
  pathEl.attr("d", path({ type: "Sphere" }));
  // Keep the crossfade companion shape inert outside of animateBlend's
  // crossfade branch, so it never lingers visible after a normal render.
  if (pathEl === globeSphere) globeSphereFade.style("opacity", 0).attr("d", null);
}

export function renderMap(projection) {
  const path = d3.geoPath().projection(projection);

  renderGlobeSphere(globeSphere, projection);

  // D3 data join keyed by country name — handles enter/update/exit
  const paths = mapGroup
    .selectAll("path.country")
    .data(state.worldData.features, (d) => d.properties.name);

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

  const patches = group.selectAll("path.terrain-patch").data(state.terrainData.features);

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
export function updateTerrainPaths(group, projection) {
  const path = d3.geoPath().projection(projection);
  group.selectAll("path.terrain-patch").attr("d", (d) => path(lightOf(d)));
}
