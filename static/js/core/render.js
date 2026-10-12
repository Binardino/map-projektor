import { lightOf } from "./geometry.js";
import { terrainData, worldData } from "../data/geodata.js";

// ============================================================
// RENDER — draw or update country paths for a given projection
// ============================================================
// Draws the sphere's own boundary as a real shape (ocean-colored, with a
// stroke) rather than relying on the background rect, so the globe's edge
// reads clearly against the void backdrop in orthographic view.
export function renderGlobeSphere(view, projection) {
  const path = d3.geoPath().projection(projection);
  view.layers.sphere.attr("d", path({ type: "Sphere" }));
  // Keep the crossfade companion shape inert outside of animateBlend's
  // crossfade branch, so it never lingers visible after a normal render.
  view.sphereFade.style("opacity", 0).attr("d", null);
}

export function renderMap(view, projection) {
  const path = d3.geoPath().projection(projection);

  renderGlobeSphere(view, projection);

  // D3 data join keyed by country name — handles enter/update/exit
  const paths = view.layers.countries
    .selectAll("path.country")
    .data(worldData.features, (d) => d.properties.name);

  paths
    .enter()
    .append("path")
    .attr("class", "country")
    .attr("d", path);

  paths.attr("d", path);

  if (view.layers.terrain) renderTerrain(view.layers.terrain, projection);

  // Panning stops once the map's edge reaches the window's edge, so the map
  // can never be dragged off-screen. The limit is the projected sphere itself:
  // on an axis where the zoomed map is smaller than the window, d3.zoom keeps
  // it centred instead, and on Mercator the poles (which overflow the initial
  // frame on purpose, see fitProjection) stay reachable. Set on every render
  // since the outline depends on the projection; the recenter rotation and
  // the upside-down flip (a mirror about the viewport's centre) don't change
  // its bounding box.
  view.zoom.translateExtent(path.bounds({ type: "Sphere" }));
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
export function updateTerrainPaths(group, projection) {
  const path = d3.geoPath().projection(projection);
  group.selectAll("path.terrain-patch").attr("d", (d) => path(lightOf(d)));
}
