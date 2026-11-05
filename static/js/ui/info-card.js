import { INFO_PANEL_STORAGE_KEY } from "../config.js";
import { getProjection, projectionName } from "../data/projections.js";
import { t } from "../i18n.js";
import { getState, on, subscribe } from "../state.js";

// ============================================================
// INFO PANEL
// Along the bottom of the map rather than a floating card: the facts about
// a projection are half of what the app has to say, and a card behind an
// icon went unnoticed. It sits in #main's column under the map, which
// shrinks to make room (core/resize.js follows the container).
// ============================================================
const panelEl   = document.getElementById("info-panel");
const summaryEl = document.getElementById("info-panel-summary");
const toggleBtn = document.getElementById("info-panel-toggle");
const infoBtn   = document.getElementById("info-toggle-btn");

function renderTradeoffs(projDef) {
  const list = document.getElementById("info-panel-content");
  list.innerHTML = "";
  ["origin", "preserves", "distorts", "bestFor"].forEach((field) => {
    const dt = document.createElement("dt");
    dt.textContent = t(`info.${field}`);
    const dd = document.createElement("dd");
    dd.textContent = t(`projection.${projDef.id}.${field}`);
    list.append(dt, dd);
  });
}

// The folded bar still has to say something worth unfolding: what the
// projection preserves is the one line that tells it apart from the others.
function updateInfo(projDef) {
  document.getElementById("info-panel-name").textContent = projectionName(projDef);
  const label = document.createElement("span");
  label.className = "info-panel-summary-label";
  label.textContent = t("info.preserves");
  const text = document.createElement("span");
  text.textContent = t(`projection.${projDef.id}.preserves`);
  summaryEl.replaceChildren(label, " ", text);
  renderTradeoffs(projDef);
}

// Three states: "hidden" (the map takes the whole height), "folded" (the
// one-line bar, the default) and "open" (the four columns).
const PANEL_STATES = ["hidden", "folded", "open"];
const savedState = localStorage.getItem(INFO_PANEL_STORAGE_KEY);
let panelState = PANEL_STATES.includes(savedState) ? savedState : "folded";

function applyPanel() {
  const open = panelState === "open";
  panelEl.hidden = panelState === "hidden";
  panelEl.classList.toggle("expanded", open);
  toggleBtn.setAttribute("aria-expanded", String(open));
  // Set here rather than through data-i18n-attr, which would reset it to
  // "show" on every language change whatever the panel's state.
  const label = t(open ? "info.hideDetails" : "info.showDetails");
  toggleBtn.setAttribute("aria-label", label);
  toggleBtn.dataset.tooltip = label;
  infoBtn.classList.toggle("active", !panelEl.hidden);
  infoBtn.setAttribute("aria-pressed", String(!panelEl.hidden));
}

function setPanelState(state) {
  panelState = state;
  localStorage.setItem(INFO_PANEL_STORAGE_KEY, state);
  applyPanel();
}

export function hideInfoPanel() {
  setPanelState("hidden");
}

// The onboarding tour points at the folded bar and makes it bounce, so
// that its moving up and down is shown rather than described. A hidden bar
// comes back for it: the tour must have something to point at.
export function nudgeInfoPanel() {
  if (panelState === "hidden") setPanelState("folded");
  panelEl.classList.remove("nudge");
  void panelEl.offsetWidth; // restarts the animation on a replayed tour
  panelEl.classList.add("nudge");
}

// The "i" button shows or hides the panel as a whole; the chevron moves it
// between the bar and the columns.
infoBtn.addEventListener("click", () => setPanelState(panelState === "hidden" ? "folded" : "hidden"));
toggleBtn.addEventListener("click", () => setPanelState(panelState === "open" ? "folded" : "open"));
document.getElementById("info-panel-close").addEventListener("click", hideInfoPanel);
panelEl.addEventListener("animationend", () => panelEl.classList.remove("nudge"));

// The panel always describes the projection on screen.
subscribe(["projectionId"], (state) => updateInfo(getProjection(state.projectionId)));

// Also its first showing: init() always loads a language before the map,
// and the toggle's label is read through t(), so an earlier panel would
// flash empty.
on("language:changed", () => {
  updateInfo(getProjection(getState().projectionId));
  applyPanel();
});
