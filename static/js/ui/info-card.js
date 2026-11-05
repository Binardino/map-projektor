import { INFO_PANEL_STORAGE_KEY } from "../config.js";
import { getProjection, projectionName } from "../data/projections.js";
import { t } from "../i18n.js";
import { getState, on, subscribe } from "../state.js";

// ============================================================
// INFO PANEL
// ============================================================
const infoTradeoffsContent = document.getElementById("info-tradeoffs-content");

// Prototype switch: two bottom-panel layouts are being tried against the
// floating card, chosen from the URL so they can be compared side by side
// (?info=sheet: collapsible panel, ?info=band: always-open panel).
const INFO_LAYOUTS = ["sheet", "band"];
const requestedLayout = new URLSearchParams(location.search).get("info");
export const infoLayout = INFO_LAYOUTS.includes(requestedLayout) ? requestedLayout : "card";
document.body.dataset.infoLayout = infoLayout;

// Always fully shown now (no expand/collapse) — matches the Figma card,
// which has no toggle, just the terms laid out directly.
function renderTradeoffs(projDef, list) {
  list.innerHTML = "";
  ["origin", "preserves", "distorts", "bestFor"].forEach((field) => {
    const dt = document.createElement("dt");
    dt.textContent = t(`info.${field}`);
    const dd = document.createElement("dd");
    dd.textContent = t(`projection.${projDef.id}.${field}`);
    list.append(dt, dd);
  });
}

const bottomPanelEl    = document.getElementById("info-panel");
const infoPanelSummary = document.getElementById("info-panel-summary");
const infoPanelToggle  = document.getElementById("info-panel-toggle");

// The folded sheet still has to say something worth unfolding: what the
// projection preserves is the one line that tells it apart from the others.
function renderPanel(projDef) {
  document.getElementById("info-panel-name").textContent = projectionName(projDef);
  const label = document.createElement("span");
  label.className = "info-panel-summary-label";
  label.textContent = t("info.preserves");
  const text = document.createElement("span");
  text.textContent = t(`projection.${projDef.id}.preserves`);
  infoPanelSummary.replaceChildren(label, " ", text);
  renderTradeoffs(projDef, document.getElementById("info-panel-content"));
}

export function updateInfo(projDef) {
  document.getElementById("info-name").textContent = projectionName(projDef);
  renderTradeoffs(projDef, infoTradeoffsContent);
  if (infoLayout !== "card") renderPanel(projDef);
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

// Bottom panel. "Open" means unfolded for the sheet (its bar never leaves)
// and shown at all for the band, which has nothing to fold.
const panelStorageKey = `${INFO_PANEL_STORAGE_KEY}.${infoLayout}`;
const savedPanel = localStorage.getItem(panelStorageKey);
let panelOpen = savedPanel === null ? infoLayout === "band" : savedPanel === "1";

function applyPanel() {
  bottomPanelEl.hidden = infoLayout === "band" && !panelOpen;
  bottomPanelEl.classList.toggle("expanded", panelOpen);
  infoPanelToggle.setAttribute("aria-expanded", String(panelOpen));
  // Set here rather than through data-i18n-attr, which would reset it to
  // "show" on every language change whatever the panel's state.
  const label = t(panelOpen ? "info.hideDetails" : "info.showDetails");
  infoPanelToggle.setAttribute("aria-label", label);
  infoPanelToggle.dataset.tooltip = label;
  infoToggleBtn.classList.toggle("active", panelOpen);
  infoToggleBtn.setAttribute("aria-pressed", String(panelOpen));
}

function setPanelOpen(open) {
  panelOpen = open;
  localStorage.setItem(panelStorageKey, open ? "1" : "0");
  applyPanel();
}

if (infoLayout === "card") {
  infoToggleBtn.addEventListener("click", () => setInfoVisible(!infoVisible));
  infoCloseBtn.addEventListener("click", () => setInfoVisible(false));
} else {
  infoToggleBtn.addEventListener("click", () => setPanelOpen(!panelOpen));
  infoPanelToggle.addEventListener("click", () => setPanelOpen(!panelOpen));
  document.getElementById("info-panel-close").addEventListener("click", () => setPanelOpen(false));
  bottomPanelEl.hidden = false;
  applyPanel();
  on("language:changed", applyPanel);
}

// The card always describes the projection on screen.
subscribe(["projectionId"], (state) => updateInfo(getProjection(state.projectionId)));

on("language:changed", () => updateInfo(getProjection(getState().projectionId)));
