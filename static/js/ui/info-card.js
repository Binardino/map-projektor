import { closeCompareCard } from "./compare-card.js";
import { projectionName } from "../data/projections.js";
import { t } from "../i18n.js";

// ============================================================
// INFO PANEL
// ============================================================
const infoTradeoffsContent = document.getElementById("info-tradeoffs-content");

// Always fully shown now (no expand/collapse) — matches the Figma card,
// which has no toggle, just the three terms laid out directly.
function renderTradeoffs(projDef) {
  infoTradeoffsContent.innerHTML = "";
  ["preserves", "distorts", "bestFor"].forEach((field) => {
    const dt = document.createElement("dt");
    dt.textContent = t(`info.${field}`);
    const dd = document.createElement("dd");
    dd.textContent = t(`projection.${projDef.id}.${field}`);
    infoTradeoffsContent.append(dt, dd);
  });
}

export function updateInfo(projDef) {
  document.getElementById("info-name").textContent = projectionName(projDef);
  renderTradeoffs(projDef);
}

// The info card is opt-in now (see the toolbar's "i" icon in
// map-container) instead of an always-visible strip under the map.
const infoToggleBtn = document.getElementById("info-toggle-btn");
const infoCloseBtn  = document.getElementById("info-close-btn");
const infoPanelEl   = document.getElementById("projection-info");
export let infoVisible = false;

export function setInfoVisible(visible) {
  infoVisible = visible;
  infoPanelEl.hidden = !infoVisible;
  infoToggleBtn.classList.toggle("active", infoVisible);
  infoToggleBtn.setAttribute("aria-pressed", String(infoVisible));
}

infoToggleBtn.addEventListener("click", () => {
  setInfoVisible(!infoVisible);
  // Only one toolbar popover at a time — see closeCompareCard below.
  if (infoVisible) closeCompareCard();
});

infoCloseBtn.addEventListener("click", () => setInfoVisible(false));
