import { PROJECTIONS } from "../data/projections.js";
import { state } from "../core/state.js";
import { makeProjection } from "../core/projection.js";
import { rotationFor } from "../core/recenter.js";
import { truesizeGroup } from "../core/scene.js";

// ============================================================
// TRUE SIZE COMPARE
//
// Lets the user add several countries as freely draggable silhouettes
// spawned at their true geographic position under the current projection
// (like thetruesizeof.com, generalized to all 17 projections here).
// Independent from the main country search (Feature 1) since that one is
// single-select/highlight-only. Colors cycle through a fixed palette in
// add order. Scoped to the main view only (like the terrain overlay and
// globe drag) — the shapes live in truesizeGroup, inside the main map's
// svg, which is already hidden while comparing (see mapContainerEl.hidden
// above), so nothing extra is needed to keep it out of compare mode.
//
// Drag only moves a shape on screen (a transform layered on top of its
// true-position `d`); switching projection snaps every shape back to its
// true geographic position under the new projection instead of trying to
// carry the drag offset over — the offsets are cleared, not preserved.
// ============================================================
const TRUESIZE_PALETTE = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6", "#1abc9c", "#e67e22", "#95a5a6"];

const trueSizeToggleBtn = document.getElementById("truesize-toggle");
const trueSizePanel     = document.getElementById("truesize-panel");
const trueSizeInput     = document.getElementById("truesize-search-input");
const trueSizeResults   = document.getElementById("truesize-search-results");
const trueSizeListEl    = document.getElementById("truesize-selected-list");

let trueSizeOrder = []; // country names, in the order they were added
const trueSizeColors  = new Map(); // name -> color, assigned once at add time
const trueSizeOffsets = new Map(); // name -> {x, y} drag offset, on top of the true position
let trueSizeNextColorIndex = 0;

// See the compareToggleBtn note above — same guard, same reason.
if (trueSizeToggleBtn) {
  trueSizeToggleBtn.addEventListener("click", () => {
    trueSizePanel.hidden = !trueSizePanel.hidden;
    trueSizeToggleBtn.classList.toggle("active", !trueSizePanel.hidden);
    if (!trueSizePanel.hidden) trueSizeInput.focus();
  });
}

function hideTrueSizeResults() {
  trueSizeResults.hidden = true;
  trueSizeResults.innerHTML = "";
}

function addTrueSizeCountry(name) {
  if (trueSizeOrder.includes(name)) return;
  trueSizeOrder.push(name);
  trueSizeColors.set(name, TRUESIZE_PALETTE[trueSizeNextColorIndex % TRUESIZE_PALETTE.length]);
  trueSizeNextColorIndex++;
  renderTrueSizeList();
  renderTrueSizeShapes();
}

function removeTrueSizeCountry(name) {
  trueSizeOrder = trueSizeOrder.filter((n) => n !== name);
  trueSizeColors.delete(name);
  trueSizeOffsets.delete(name);
  renderTrueSizeList();
  renderTrueSizeShapes();
}

function renderTrueSizeList() {
  trueSizeListEl.innerHTML = "";
  trueSizeOrder.forEach((name) => {
    const li = document.createElement("li");

    const swatch = document.createElement("span");
    swatch.className = "truesize-swatch";
    swatch.style.background = trueSizeColors.get(name);

    const label = document.createElement("span");
    label.textContent = name;

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "✕";
    removeBtn.title = "Remove";
    removeBtn.addEventListener("click", () => removeTrueSizeCountry(name));

    li.append(swatch, label, removeBtn);
    trueSizeListEl.appendChild(li);
  });
}

const trueSizeDrag = d3.drag().on("drag", function (event, feature) {
  const name = feature.properties.name;
  const offset = trueSizeOffsets.get(name) || { x: 0, y: 0 };
  offset.x += event.dx;
  offset.y += event.dy;
  trueSizeOffsets.set(name, offset);
  d3.select(this).attr("transform", `translate(${offset.x},${offset.y})`);
});

// Redraws every selected shape at its true geographic position under the
// current projection, preserving each shape's drag offset (add/remove and
// other refresh call sites use this — only a projection switch clears
// offsets, see resetTrueSizeOnProjectionSwitch).
function renderTrueSizeShapes() {
  const projDef    = PROJECTIONS.find((p) => p.id === state.currentProjectionId);
  const projection = makeProjection(projDef, rotationFor(projDef));
  const pathFn     = d3.geoPath().projection(projection);

  const features = trueSizeOrder
    .map((name) => state.worldData.features.find((f) => f.properties.name === name))
    .filter(Boolean);

  const shapes = truesizeGroup
    .selectAll("path.truesize-shape")
    .data(features, (d) => d.properties.name);

  shapes.exit().remove();

  shapes
    .enter()
    .append("path")
    .attr("class", "truesize-shape")
    .call(trueSizeDrag)
    .merge(shapes)
    .attr("d", pathFn)
    .attr("fill", (d) => trueSizeColors.get(d.properties.name))
    .attr("stroke", (d) => trueSizeColors.get(d.properties.name))
    .attr("transform", (d) => {
      const offset = trueSizeOffsets.get(d.properties.name) || { x: 0, y: 0 };
      return `translate(${offset.x},${offset.y})`;
    });
}

export function resetTrueSizeOnProjectionSwitch() {
  if (trueSizeOrder.length === 0) return;
  trueSizeOffsets.clear();
  renderTrueSizeShapes();
}

// See the compareToggleBtn note above — same guard, same reason.
if (trueSizeInput) {
  trueSizeInput.addEventListener("input", () => {
    const query = trueSizeInput.value.trim().toLowerCase();
    if (!query || !state.worldData) {
      hideTrueSizeResults();
      return;
    }
    const matches = state.worldData.features
      .filter((f) => !trueSizeOrder.includes(f.properties.name))
      .filter((f) => f.properties.name.toLowerCase().includes(query))
      .sort((a, b) => {
        const nameA = a.properties.name.toLowerCase();
        const nameB = b.properties.name.toLowerCase();
        return nameA.indexOf(query) - nameB.indexOf(query);
      })
      .slice(0, 8);

    trueSizeResults.innerHTML = "";
    matches.forEach((feature) => {
      const li = document.createElement("li");
      li.textContent = feature.properties.name;
      li.addEventListener("click", () => {
        addTrueSizeCountry(feature.properties.name);
        trueSizeInput.value = "";
        hideTrueSizeResults();
      });
      trueSizeResults.appendChild(li);
    });
    trueSizeResults.hidden = matches.length === 0;
  });

  trueSizeInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideTrueSizeResults();
  });
}
