import { PROJECTIONS } from "../data/projections.js";
import { RECENTER_PRESETS } from "../data/views.js";
import { subscribe } from "../state.js";

// The shareable link: the main map's projection and view in the URL hash
// (#p=robinson&v=africa). A hash rather than a query string because the
// site is static (GitHub Pages): the server never sees it, so any link
// still serves the same index.html.

// Anything not in the registries is dropped rather than trusted: a link
// may be old (a renamed id) or typed by hand, and the app must still open.
export function parseLink(hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const p = params.get("p");
  const v = params.get("v");
  return {
    projectionId: PROJECTIONS.some((proj) => proj.id === p) ? p : null,
    preset: RECENTER_PRESETS.some((view) => view.id === v) ? v : null,
  };
}

// A dragged globe matches no preset (preset null), so its link only keeps
// the projection: the exact rotation is not worth a longer URL.
export function formatLink({ projectionId, recenter }) {
  const params = new URLSearchParams({ p: projectionId });
  if (recenter.preset) params.set("v", recenter.preset);
  return `#${params}`;
}

// The address bar always holds the link to the map on screen. replaceState,
// not pushState: Back still leaves the app instead of stepping through every
// projection tried. It follows the two slices, not view:changed, which a
// resize also emits. Written only when the link changes, because a globe
// drag rewrites recenter on every pointer move and the browser throttles a
// page that rewrites its URL that often.
export function keepLinkInStep() {
  subscribe(["projectionId", "recenter"], (state) => {
    const link = formatLink(state);
    if (location.hash !== link) history.replaceState(null, "", link);
  });
}
