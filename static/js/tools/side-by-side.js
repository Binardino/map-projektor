import { PROJECTIONS, getProjection, projectionName } from "../data/projections.js";
import { createMapView } from "../core/map-view.js";
import { applySelection } from "../core/selection.js";
import { attachFlightPath } from "./flight-path.js";
import { infoVisible, setInfoVisible } from "../ui/info-card.js";
import { DEFAULT_COMPARISON_PROJECTION } from "../config.js";
import { emit, getState, on } from "../state.js";

// ============================================================
// SIDE-BY-SIDE COMPARISON MODE
//
// Two independent panels, each a map view of its own (see map-view.js)
// with a projection dropdown. Switching a panel's
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
let comparePanels = null; // two views, alive only while the mode is on
let panelProjectionIds = null; // what each panel showed when the mode was last left

function buildComparePanel(panelEl, projId) {
  const select = panelEl.querySelector(".compare-select");
  select.replaceChildren(...PROJECTIONS.map((proj) => new Option(projectionName(proj), proj.id)));
  select.value = projId;

  const svgEl = panelEl.querySelector(".compare-svg");
  const view = createMapView({
    svgEl,
    width: panelEl.clientWidth,
    height: svgEl.clientHeight,
    layers: ["tissot", "flight"],
  });
  attachFlightPath(view);
  view.setProjection(getProjection(projId)).render();

  // A property, not addEventListener: the panel is rebuilt on every entry
  // and must not keep the listener of the view it replaced.
  select.onchange = () => {
    view.setProjection(getProjection(select.value)).render();
    applySelection(view);
    emit("view:changed"); // the overlay tools redraw in this view
  };

  return view;
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

    if (!compareMode) {
      // Destroyed rather than left hidden: every overlay tool redraws in
      // each live view, and two invisible maps would double that work.
      panelProjectionIds = comparePanels.map((view) => view.projectionDef.id);
      comparePanels.forEach((view) => view.destroy());
      comparePanels = null;
      return;
    }

    const rightDefaultId = PROJECTIONS.some((p) => p.id === DEFAULT_COMPARISON_PROJECTION) ? DEFAULT_COMPARISON_PROJECTION : PROJECTIONS[1].id;
    const ids = panelProjectionIds || [getState().projectionId, rightDefaultId];
    // Built after the container is shown: a hidden panel measures 0 × 0.
    comparePanels = [...document.querySelectorAll(".compare-panel")].map((panelEl, i) => buildComparePanel(panelEl, ids[i]));
    comparePanels.forEach(applySelection);
    emit("view:changed");
  });
}

on("selection:changed", () => {
  if (compareMode) comparePanels.forEach(applySelection);
});
