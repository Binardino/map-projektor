import { PROJECTIONS, projectionName } from "../data/projections.js";
import { RECENTER_PRESETS } from "../data/views.js";
import { applyRecenter } from "../core/recenter.js";
import { state } from "../core/state.js";
import { switchProjection } from "../core/transition.js";
import { t } from "../i18n.js";

// ============================================================
// SIDEBAR — built dynamically from PROJECTIONS
// ============================================================
export function buildSidebar() {
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

  setActiveButton(state.currentProjectionId);
}

export function setActiveButton(projId) {
  document.querySelectorAll(".proj-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.projId === projId);
  });
}

export function buildRecenterPanel() {
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
