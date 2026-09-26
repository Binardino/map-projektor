import { PROJECTIONS, getProjection, projectionName } from "../data/projections.js";
import { compareHighlightGroup } from "../core/scene.js";
import { state } from "../core/state.js";
import { infoVisible, setInfoVisible } from "./info-card.js";
import { makeProjection } from "../core/projection.js";
import { rotationFor } from "../core/recenter.js";
import { t } from "../i18n.js";
import { COMPARE_MAX } from "../config.js";
import { readPalette } from "../core/palette.js";

// ============================================================
// COMPARE CARD
//
// Pick a country (searchable, alphabetical) and it's redrawn on top of
// the map as a red highlight, under its own projection — independent of
// whatever projection the main map/sidebar has active. Lets you see how
// the same country's shape/size changes between two projections at a
// glance: the base map (unchanged) vs. the highlighted overlay.
// ============================================================
const compareCardToggleBtn    = document.getElementById("compare-toggle-btn");
const compareCardCloseBtn     = document.getElementById("compare-card-close");
const compareCardEl           = document.getElementById("compare-card");
const compareProjectionSelect = document.getElementById("compare-projection-select");
const compareCountryInput     = document.getElementById("compare-country-input");
const compareCountryResults   = document.getElementById("compare-country-results");
const compareCountryList      = document.getElementById("compare-country-list");

// Called from init() once the language is loaded (names come from t()); it
// keeps the HTML placeholder option (empty value) and replaces the rest, so a
// language switch can call it again.
export function buildCompareProjectionOptions() {
  compareProjectionSelect.querySelectorAll("option[value]:not([value=''])").forEach((o) => o.remove());
  PROJECTIONS.forEach((proj) => {
    const option = document.createElement("option");
    option.value = proj.id;
    option.textContent = projectionName(proj);
    compareProjectionSelect.appendChild(option);
  });
}

let compareCardVisible     = false;
let compareCountryNames    = null; // populated lazily once worldData is ready — full alphabetical list
let compareProjectionId    = null; // null until a country is picked, then defaults to currentProjectionId

// Countries being compared, in pick order. Each entry:
// { name, color, visible, shift: pins its anchor on the map's copy of the
//   country, offset: how far the user has dragged it from there }.
const compareCountries = [];
// Saturated hues that stay apart from each other and from the map's own
// colours in both themes: land (pink / navy), ocean (light / mid blue),
// terrain (tan, sage), the reference lines (atlas red).
const COMPARE_COLORS = readPalette("compare", COMPARE_MAX); // one per country slot, --compare-* in style.css

// Overseas territories that Natural Earth keeps as separate features but
// that belong in the country's comparison. France's overseas departments
// (Guiana, Réunion, the Antilles, Mayotte) are already part of "France";
// these are its collectivities and TAAF. Other countries' territories
// (Greenland, Puerto Rico, the Falklands) stay separate, pickable on their own.
const COMPARE_TERRITORIES = {
  France: [
    "Fr. Polynesia", "New Caledonia", "Fr. S. Antarctic Lands", "Wallis and Futuna Is.",
    "St. Pierre and Miquelon", "St-Martin", "St-Barthélemy",
  ],
};

// The shape drawn for a compared country: the feature plus its territories.
function compareShape(feature) {
  const territories = (COMPARE_TERRITORIES[feature.properties.name] || [])
    .map((name) => state.worldData.features.find((f) => f.properties.name === name))
    .filter(Boolean);
  if (!territories.length) return feature;
  return { type: "FeatureCollection", features: [feature, ...territories] };
}

// The point of the country the overlay is pinned on: the centre of its
// largest polygon, not of the whole feature — overseas parts (French
// Guiana for France, Alaska for the USA) would otherwise drag the anchor
// off the mainland people are actually comparing.
function compareAnchor(feature) {
  if (feature.geometry.type !== "MultiPolygon") return d3.geoCentroid(feature);
  const largest = d3.greatest(feature.geometry.coordinates, (rings) => d3.geoArea({ type: "Polygon", coordinates: rings }));
  return d3.geoCentroid({ type: "Polygon", coordinates: largest });
}

// Redraws (or clears) every visible compared country under compareProjectionId,
// each shifted so its anchor sits on the same country in the map on screen:
// each projection places a country at its own screen position, so drawn
// as-is, France under Equirectangular landed on Chad in a Gall-Peters map.
// Uses the active view's rotation so both shapes share an orientation.
// Shares the main map's zoomLayer, so it pans/zooms together with it.
export function refreshCompareHighlight() {
  compareHighlightGroup.selectAll("*").remove();
  compareHighlightGroup.style("display", null);
  if (!state.worldData) return;

  const mapDef      = getProjection(state.currentProjectionId);
  const compareDef  = compareProjectionId ? getProjection(compareProjectionId) : mapDef;
  const mapProj     = makeProjection(mapDef, rotationFor(mapDef));
  const compareProj = makeProjection(compareDef, rotationFor(compareDef));
  const comparePath = d3.geoPath().projection(compareProj);
  const [rl, rp]    = mapProj.rotate();

  compareCountries.filter((entry) => entry.visible).forEach((entry) => {
    const feature = state.worldData.features.find((f) => f.properties.name === entry.name);
    if (!feature) return;
    const anchor = compareAnchor(feature);
    // A projection returns a point even for the globe's far side, which
    // would pin the overlay on a country the user can't see.
    if (getProjection(state.currentProjectionId).globe && d3.geoDistance(anchor, [-rl, -rp]) > Math.PI / 2) return;
    const [mx, my] = mapProj(anchor);
    const [cx, cy] = compareProj(anchor);
    entry.shift = [mx - cx, my - cy];

    const d = comparePath(compareShape(feature));
    const overlay = compareHighlightGroup.append("g")
      .datum(entry)
      .attr("class", "compare-overlay")
      .attr("transform", compareOverlayTransform(entry))
      .call(compareDrag);
    overlay.append("path").attr("class", "compare-hit").attr("d", d);
    overlay.append("path").attr("class", "compare-highlight").attr("d", d)
      .style("fill", entry.color)
      .style("stroke", entry.color);
  });
}

function compareOverlayTransform(entry) {
  return `translate(${entry.shift[0] + entry.offset[0]},${entry.shift[1] + entry.offset[1]})`;
}

function resetCompareOffsets() {
  compareCountries.forEach((entry) => { entry.offset = [0, 0]; });
}

// Grabbing the overlay moves it; d3.drag stops the pointer-down from
// reaching d3.zoom and globeDrag, so a drag anywhere else still pans the
// map (or turns the globe), and the wheel still zooms over it. dx/dy come
// in the overlay's parent coordinates, which already undo the camera zoom
// and the upside-down flip, so the shape stays under the cursor.
// Each country moves on its own; the one being dragged is raised so it
// passes over the others.
const compareDrag = d3.drag()
  .on("start", function () { d3.select(this).classed("dragging", true).raise(); })
  .on("drag", function (event, entry) {
    entry.offset = [entry.offset[0] + event.dx, entry.offset[1] + event.dy];
    d3.select(this).attr("transform", compareOverlayTransform(entry));
  })
  .on("end", function () { d3.select(this).classed("dragging", false); });

// The overlay is pinned to the map's projection, so it's stale for the
// whole morph or spin — hidden until the matching refresh at the end.
// A drag only holds until the next projection or view change, which puts
// the overlay back on the country (the anchor is what's being compared).
export function hideCompareHighlight() {
  compareHighlightGroup.style("display", "none");
  resetCompareOffsets();
}

// Rebuilds the picked-country rows and locks the search field once the
// list is full, saying why in its placeholder.
function renderCompareList() {
  compareCountryList.innerHTML = "";
  compareCountries.forEach((entry) => {
    const li = document.createElement("li");
    li.classList.toggle("hidden-country", !entry.visible);

    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = entry.visible;
    checkbox.setAttribute("aria-label", t("compare.showCountry", { name: entry.name }));
    checkbox.addEventListener("change", () => {
      entry.visible = checkbox.checked;
      renderCompareList();
      refreshCompareHighlight();
    });
    const swatch = document.createElement("span");
    swatch.className = "compare-swatch";
    swatch.style.background = entry.color;
    const name = document.createElement("span");
    name.className = "compare-country-name";
    name.textContent = entry.name;
    label.append(checkbox, swatch, name);

    const removeBtn = document.createElement("button");
    removeBtn.className = "floating-card-close";
    removeBtn.textContent = "✕";
    removeBtn.setAttribute("aria-label", t("compare.removeCountry", { name: entry.name }));
    removeBtn.addEventListener("click", () => {
      compareCountries.splice(compareCountries.indexOf(entry), 1);
      renderCompareList();
      refreshCompareHighlight();
    });

    li.append(label, removeBtn);
    compareCountryList.appendChild(li);
  });
  compareCountryList.hidden = compareCountries.length === 0;

  const full = compareCountries.length >= COMPARE_MAX;
  compareCountryInput.disabled = full;
  compareCountryInput.placeholder = t(full ? "compare.limitReached" : "compare.countryPlaceholder");
}

function hideCompareCountryResults() {
  compareCountryResults.hidden = true;
  compareCountryResults.innerHTML = "";
}

function showCompareCountryResults(names) {
  compareCountryResults.innerHTML = "";
  names.forEach((name) => {
    const li = document.createElement("li");
    li.textContent = name;
    li.addEventListener("click", () => selectCompareCountry(name));
    compareCountryResults.appendChild(li);
  });
  compareCountryResults.hidden = names.length === 0;
}

function selectCompareCountry(name) {
  compareCountryInput.value = "";
  hideCompareCountryResults();
  if (compareCountries.length >= COMPARE_MAX || compareCountries.some((entry) => entry.name === name)) return;
  // First colour no listed country is using, so removing one frees its colour
  const color = COMPARE_COLORS.find((c) => !compareCountries.some((entry) => entry.color === c));
  compareCountries.push({ name, color, visible: true, shift: [0, 0], offset: [0, 0] });
  renderCompareList();

  // First pick since the card opened (or since it was last cleared):
  // default the projection to whatever the main map is currently showing.
  if (compareProjectionId === null) {
    compareProjectionId = state.currentProjectionId;
    compareProjectionSelect.value = state.currentProjectionId;
  }
  refreshCompareHighlight();
}

compareCountryInput.addEventListener("input", () => {
  const query = compareCountryInput.value.trim().toLowerCase();
  if (!compareCountryNames) return;
  const matches = query
    ? compareCountryNames.filter((name) => name.toLowerCase().includes(query))
    : compareCountryNames;
  showCompareCountryResults(matches.slice(0, 8));
});

compareCountryInput.addEventListener("focus", () => {
  if (compareCountryNames) showCompareCountryResults(compareCountryNames.slice(0, 8));
});

compareCountryInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideCompareCountryResults();
});

compareProjectionSelect.addEventListener("change", () => {
  compareProjectionId = compareProjectionSelect.value;
  resetCompareOffsets();
  refreshCompareHighlight();
});

function resetCompareSelection() {
  compareCountries.length = 0;
  compareProjectionId = null;
  compareCountryInput.value = "";
  compareProjectionSelect.value = "";
  renderCompareList();
  hideCompareCountryResults();
  refreshCompareHighlight();
}

export function closeCompareCard() {
  compareCardVisible = false;
  compareCardEl.hidden = true;
  compareCardToggleBtn.classList.remove("active");
  compareCardToggleBtn.setAttribute("aria-pressed", "false");
  resetCompareSelection();
}

function openCompareCard() {
  compareCardVisible = true;
  compareCardEl.hidden = false;
  compareCardToggleBtn.classList.add("active");
  compareCardToggleBtn.setAttribute("aria-pressed", "true");

  // Country names depend on the geodata fetch in init() — populate the
  // alphabetical list once it's available instead of duplicating it here.
  if (state.worldData && !compareCountryNames) {
    compareCountryNames = [...new Set(state.worldData.features.map((f) => f.properties.name))].sort();
  }

  // Only one toolbar popover at a time — mirrors the info-card guard above.
  if (infoVisible) setInfoVisible(false);
}

compareCardToggleBtn.addEventListener("click", () => {
  if (compareCardVisible) closeCompareCard();
  else openCompareCard();
});

compareCardCloseBtn.addEventListener("click", closeCompareCard);
