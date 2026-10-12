import { getProjection } from "../data/projections.js";
import { mainView } from "../core/scene.js";
import { rotationFor } from "../core/recenter.js";
import { moveGeo } from "../core/sphere-move.js";
import { t } from "../i18n.js";
import { COMPARE_MAX } from "../config.js";
import { readPalette } from "../core/palette.js";
import { worldData } from "../data/geodata.js";
import { getState, on } from "../state.js";

// ============================================================
// COMPARE CARD
//
// Pick up to five countries (searchable, alphabetical): each is redrawn
// on top of the map as a coloured shape that can be dragged anywhere.
// The shape is moved on the sphere, not on the screen, and projected
// again at every step, so it grows, shrinks and bends exactly as the
// map's projection does at the place it is dragged to.
// ============================================================
const compareCardToggleBtn    = document.getElementById("compare-toggle-btn");
const compareCardCloseBtn     = document.getElementById("compare-card-close");
const compareCardEl           = document.getElementById("compare-card");
const compareCountryInput     = document.getElementById("compare-country-input");
const compareCountryResults   = document.getElementById("compare-country-results");
const compareCountryList      = document.getElementById("compare-country-list");

let compareCardVisible     = false;
let compareCountryNames    = null; // populated lazily once worldData is ready — full alphabetical list

// Countries being compared, in pick order. Each entry:
// { name, color, visible, shape: what is drawn, home: the point of the
//   country it is held by, target: where the user has dragged that point
//   ([lon, lat], so it survives a projection or view change) }.
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
    .map((name) => worldData.features.find((f) => f.properties.name === name))
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

// The map's projection at rest, kept for the drag: a pointer position is
// turned back into a longitude and latitude with its invert().
let compareProjection = null;

// Projects the country at the place it was dragged to. Hidden parts (the
// globe's far side) are clipped by the projection; a shape entirely out
// of sight has no path at all.
function drawCompareOverlay(overlay, entry) {
  const d = d3.geoPath().projection(compareProjection)(moveGeo(entry.shape, entry.home, entry.target));
  overlay.selectAll("path").attr("d", d || "");
}

// Redraws (or clears) every visible compared country under the map's
// projection and active view, each at the place it was dragged to.
// Lives in the main view's highlight layer, so it pans/zooms together with it.
export function refreshCompareHighlight() {
  mainView.layers.highlight.selectAll("*").remove();
  mainView.layers.highlight.style("display", null);
  if (!worldData) return;

  const mapDef = getProjection(getState().projectionId);
  compareProjection = mainView.makeProjection(mapDef, rotationFor(mapDef));

  compareCountries.filter((entry) => entry.visible).forEach((entry) => {
    const overlay = mainView.layers.highlight.append("g")
      .datum(entry)
      .attr("class", "compare-overlay")
      .call(compareDrag);
    overlay.append("path").attr("class", "compare-hit");
    overlay.append("path").attr("class", "compare-highlight")
      .style("fill", entry.color)
      .style("stroke", entry.color);
    drawCompareOverlay(overlay, entry);
  });
}

// The place on Earth under a point of the map, or null off the map:
// outside its outline a projection's invert() answers NaN or a place
// that is drawn somewhere else, so the answer is projected back to check.
function placeUnder(x, y) {
  const place = compareProjection.invert([x, y]);
  if (!place || !place.every(Number.isFinite)) return null;
  const [px, py] = compareProjection(place);
  return Math.hypot(px - x, py - y) < 1 ? place : null;
}

// Grabbing the overlay moves it; d3.drag stops the pointer-down from
// reaching d3.zoom and globeDrag, so a drag anywhere else still pans the
// map (or turns the globe), and the wheel still zooms over it. The drag's
// coordinates are those of the overlay's parent, which already undo the
// camera zoom and the upside-down flip. The subject is where the country
// is held, so it follows the pointer from where it was grabbed instead of
// jumping under it.
// Each country moves on its own; the one being dragged is raised so it
// passes over the others.
const compareDrag = d3.drag()
  .subject((event, entry) => {
    const [x, y] = compareProjection(entry.target);
    return { x, y };
  })
  .on("start", function () { d3.select(this).classed("dragging", true).raise(); })
  .on("drag", function (event, entry) {
    const place = placeUnder(event.x, event.y);
    if (!place) return; // pointer off the map: the country waits at the edge
    entry.target = place;
    drawCompareOverlay(d3.select(this), entry);
  })
  .on("end", function () { d3.select(this).classed("dragging", false); });

// The overlay is drawn with the map's projection, so it's stale for the
// whole morph or spin — hidden until the matching refresh at the end,
// which puts each country back at the place it was dragged to.
export function hideCompareHighlight() {
  mainView.layers.highlight.style("display", "none");
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
  const feature = worldData.features.find((f) => f.properties.name === name);
  const home = compareAnchor(feature);
  compareCountries.push({ name, color, visible: true, shape: compareShape(feature), home, target: home });
  renderCompareList();
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

function resetCompareSelection() {
  compareCountries.length = 0;
  compareCountryInput.value = "";
  renderCompareList();
  hideCompareCountryResults();
  refreshCompareHighlight();
}

function closeCompareCard() {
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
  if (worldData && !compareCountryNames) {
    compareCountryNames = [...new Set(worldData.features.map((f) => f.properties.name))].sort();
  }
}

compareCardToggleBtn.addEventListener("click", () => {
  if (compareCardVisible) closeCompareCard();
  else openCompareCard();
});

compareCardCloseBtn.addEventListener("click", closeCompareCard);

// The overlay is pinned to the map's projection: hidden while it morphs or
// spins, put back on the country once the view settles.
on("view:changing", hideCompareHighlight);
on("view:changed", refreshCompareHighlight);

on("language:changed", renderCompareList);
