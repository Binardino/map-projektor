import { PROJECTIONS, getProjection, projectionName } from "../data/projections.js";
import { RECENTER_PRESETS } from "../data/views.js";
import { applyRecenter } from "../core/recenter.js";
import { switchProjection } from "../core/transition.js";
import { t } from "../i18n.js";
import { getState, on, subscribe } from "../state.js";

// ============================================================
// SIDEBAR — built dynamically from PROJECTIONS
// ============================================================
export function buildSidebar() {
  const nav = document.getElementById("projection-list");
  // Rebuilt on a language change: drop what a previous build generated,
  // keeping the static section title the markup puts in the same <nav>.
  nav.querySelectorAll(".proj-family-header, .proj-btn").forEach((el) => el.remove());
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

  setActiveButton(getState().projectionId);
}

export function setActiveButton(projId) {
  document.querySelectorAll(".proj-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.projId === projId);
  });
}

export function buildRecenterPanel() {
  const nav = document.getElementById("recenter-list");
  nav.replaceChildren(); // rebuilt on a language change
  RECENTER_PRESETS.forEach((preset) => {
    const btn = document.createElement("button");
    btn.className = "sidebar-btn recenter-btn";
    btn.dataset.presetId = preset.id;
    btn.title = t(`view.${preset.id}.description`);
    btn.textContent = t(`view.${preset.id}.name`);
    btn.addEventListener("click", () => applyRecenter(preset.id));
    nav.appendChild(btn);
  });
  renderViewState(getState());
}

// Which view is lit, and whether views apply at all: presets are disabled
// on projections that can't be recentred (Albers, the polar views).
function renderViewState(state) {
  document.querySelectorAll(".recenter-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.presetId === state.recenter.preset);
  });
  const recenterable = getProjection(state.projectionId).recenterable;
  document.getElementById("recenter-list").classList.toggle("disabled-list", !recenterable);
}
subscribe(["recenter", "projectionId"], renderViewState);

on("projection:requested", setActiveButton);

on("language:changed", () => {
  buildSidebar();
  buildRecenterPanel();
});
