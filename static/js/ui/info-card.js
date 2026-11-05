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

// Bottom panel, in one of three states: "hidden" (the map takes the whole
// height), "folded" (the one-line bar) and "open" (the four columns). The
// band has nothing to fold, so it only goes between hidden and open.
const PANEL_STATES = infoLayout === "band" ? ["hidden", "open"] : ["hidden", "folded", "open"];
const panelStorageKey = `${INFO_PANEL_STORAGE_KEY}.${infoLayout}`;
const savedPanel = localStorage.getItem(panelStorageKey);
let panelState = PANEL_STATES.includes(savedPanel) ? savedPanel : infoLayout === "band" ? "open" : "folded";

function applyPanel() {
  const open = panelState === "open";
  bottomPanelEl.hidden = panelState === "hidden";
  bottomPanelEl.classList.toggle("expanded", open);
  infoPanelToggle.setAttribute("aria-expanded", String(open));
  // Set here rather than through data-i18n-attr, which would reset it to
  // "show" on every language change whatever the panel's state.
  const label = t(open ? "info.hideDetails" : "info.showDetails");
  infoPanelToggle.setAttribute("aria-label", label);
  infoPanelToggle.dataset.tooltip = label;
  infoToggleBtn.classList.toggle("active", !bottomPanelEl.hidden);
  infoToggleBtn.setAttribute("aria-pressed", String(!bottomPanelEl.hidden));
}

function setPanelState(state) {
  panelState = state;
  localStorage.setItem(panelStorageKey, state);
  applyPanel();
}

// The onboarding tour points at the folded bar and makes it bounce, so
// that its moving up and down is shown rather than described. A hidden bar
// comes back for it: the tour must have something to point at.
export function nudgeInfoPanel() {
  if (panelState === "hidden") setPanelState("folded");
  bottomPanelEl.classList.remove("nudge");
  void bottomPanelEl.offsetWidth; // restarts the animation on a replayed tour
  bottomPanelEl.classList.add("nudge");
}

if (infoLayout === "card") {
  infoToggleBtn.addEventListener("click", () => setInfoVisible(!infoVisible));
  infoCloseBtn.addEventListener("click", () => setInfoVisible(false));
} else {
  // The "i" button shows or hides the panel as a whole; the chevron moves
  // it between the bar and the columns.
  const shownState = infoLayout === "band" ? "open" : "folded";
  infoToggleBtn.addEventListener("click", () => setPanelState(panelState === "hidden" ? shownState : "hidden"));
  infoPanelToggle.addEventListener("click", () => setPanelState(panelState === "open" ? "folded" : "open"));
  document.getElementById("info-panel-close").addEventListener("click", () => setPanelState("hidden"));
  bottomPanelEl.addEventListener("animationend", () => bottomPanelEl.classList.remove("nudge"));
  // First shown once the language has loaded (init() always emits it): the
  // toggle's label is read through t(), and an empty panel would flash.
  on("language:changed", applyPanel);
}

// The card always describes the projection on screen.
subscribe(["projectionId"], (state) => updateInfo(getProjection(state.projectionId)));

on("language:changed", () => updateInfo(getProjection(getState().projectionId)));
