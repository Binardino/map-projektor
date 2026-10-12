import { TOUR_STORAGE_KEY } from "../config.js";
import { t } from "../i18n.js";
import { getState, on, subscribe } from "../state.js";
import { switchProjection } from "../core/transition.js";
import { closeSidebar, openSidebar } from "./mobile-sidebar.js";

// ============================================================
// ONBOARDING TOUR
// A few bubbles, each next to the control it explains, shown once after
// the welcome modal closes (a localStorage flag remembers it) and again
// on demand from the toolbar's "?" button.
// It opens on a demonstration: the tour itself switches the globe to
// Mercator, then to Equal Earth, so the map deforms in front of someone
// who has not touched anything yet — the idea of the app before its controls.
//
// Adding a step: one entry here plus tour.step.<id>.title / .text in
// en.json. `side` is where the bubble goes relative to the target;
// `drawer` marks targets that sit in the sidebar, which is an off-canvas
// drawer on mobile and has to be opened for the step; `show` is a
// projection the step switches the map to (its drawer then stays closed,
// the map being what there is to look at).
// ============================================================
const STEPS = [
  { id: "mercator", target: '.proj-btn[data-proj-id="mercator"]', side: "right", show: "mercator" },
  { id: "equalEarth", target: '.proj-btn[data-proj-id="equalEarth"]', side: "right", show: "equalEarth" },
  { id: "views", target: "#recenter-panel", side: "right", drawer: true },
  { id: "tools", target: "#map-tools", side: "left" },
  { id: "navigation", target: "#zoom-controls", side: "left" },
];

const SPOTLIGHT_PADDING = 4; // px of breathing room around the highlighted control
const BUBBLE_GAP = 14;       // px between the target and the bubble (room for the arrow)
const VIEWPORT_MARGIN = 12;  // px the bubble keeps from the window edges
const ARROW_INSET = 18;      // px the arrow keeps from the bubble's corners

const tourEl = document.getElementById("tour");
const spotlightEl = document.getElementById("tour-spotlight");
const bubbleEl = document.getElementById("tour-bubble");
const progressEl = document.getElementById("tour-progress");
const titleEl = document.getElementById("tour-title");
const textEl = document.getElementById("tour-text");
const nextBtn = document.getElementById("tour-next");
const skipBtn = document.getElementById("tour-skip");
const replayBtn = document.getElementById("tour-replay-btn");

let stepIndex = 0;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function positionStep() {
  const step = STEPS[stepIndex];
  const targetEl = document.querySelector(step.target);
  targetEl.scrollIntoView({ block: "nearest" }); // the projection list scrolls
  const target = targetEl.getBoundingClientRect();
  // A target inside the closed mobile drawer: nothing to point at.
  const offScreen = target.right <= 0;
  spotlightEl.hidden = offScreen;
  spotlightEl.style.left = `${target.left - SPOTLIGHT_PADDING}px`;
  spotlightEl.style.top = `${target.top - SPOTLIGHT_PADDING}px`;
  spotlightEl.style.width = `${target.width + 2 * SPOTLIGHT_PADDING}px`;
  spotlightEl.style.height = `${target.height + 2 * SPOTLIGHT_PADDING}px`;

  const { offsetWidth: width, offsetHeight: height } = bubbleEl;
  const { innerWidth, innerHeight } = window;
  // Middle of the part of the target that is on screen: the projection
  // list can be taller than the window.
  const targetMiddle = (Math.max(target.top, 0) + Math.min(target.bottom, innerHeight)) / 2;
  let side = step.side;
  let left = side === "right" ? target.right + BUBBLE_GAP : target.left - BUBBLE_GAP - width;
  let top = clamp(targetMiddle - height / 2, VIEWPORT_MARGIN, innerHeight - height - VIEWPORT_MARGIN);

  if (offScreen || left < VIEWPORT_MARGIN || left + width > innerWidth - VIEWPORT_MARGIN) {
    // No room beside the target (the mobile drawer takes most of the
    // width): centre the bubble over the half of the screen the target's
    // middle is not in, without an arrow. With no target on screen it goes
    // to the bottom, off the map.
    side = "none";
    left = (innerWidth - width) / 2;
    top = !offScreen && targetMiddle > innerHeight / 2 ? VIEWPORT_MARGIN : innerHeight - height - VIEWPORT_MARGIN;
  }

  bubbleEl.dataset.side = side;
  bubbleEl.style.left = `${left}px`;
  bubbleEl.style.top = `${top}px`;
  bubbleEl.style.setProperty("--tour-arrow-top", `${clamp(targetMiddle - top, ARROW_INSET, height - ARROW_INSET)}px`);
}

function renderStep() {
  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  progressEl.textContent = t("tour.progress", { current: stepIndex + 1, total: STEPS.length });
  titleEl.textContent = t(`tour.step.${step.id}.title`);
  textEl.textContent = t(`tour.step.${step.id}.text`);
  nextBtn.textContent = isLast ? t("tour.done") : t("tour.next");
  skipBtn.hidden = isLast; // nothing left to skip: "Done" is the only way out

  if (step.drawer) openSidebar();
  else closeSidebar();
  // No dimming on a demonstration step: the map is the thing to watch.
  tourEl.classList.toggle("demo", Boolean(step.show));
  if (step.show) switchProjection(step.show);
  showMorph();
  positionStep();
  nextBtn.focus();
}

// While the map morphs, the bubble steps aside (and its buttons with it)
// so nothing competes with the demonstration; it comes back with the text
// that explains what was just seen.
function showMorph() {
  tourEl.classList.toggle("morphing", getState().busy);
  if (!getState().busy && !tourEl.hidden) nextBtn.focus();
}
subscribe(["busy"], showMorph);

function startTour() {
  stepIndex = 0;
  tourEl.hidden = false;
  renderStep();
}

// Finishing and skipping both count as "seen": the tour never comes back
// on its own, only through the "?" button.
function endTour() {
  tourEl.hidden = true;
  closeSidebar();
  localStorage.setItem(TOUR_STORAGE_KEY, "1");
}

nextBtn.addEventListener("click", () => {
  if (stepIndex === STEPS.length - 1) return endTour();
  stepIndex += 1;
  renderStep();
});

skipBtn.addEventListener("click", endTour);
// Not during a morph: the first step could not start its own.
replayBtn.addEventListener("click", () => {
  if (!getState().busy) startTour();
});

// Capture phase, so this runs before the welcome modal's own Escape
// handler: otherwise the Escape that closes the modal (which starts the
// tour) would reach this listener next and skip the tour it just opened.
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !tourEl.hidden) endTour();
}, { capture: true });

// The drawer slides in over 250ms and the window can be resized mid-tour:
// both move the target after the bubble was placed.
window.addEventListener("resize", () => {
  if (!tourEl.hidden) positionStep();
});
document.addEventListener("transitionend", () => {
  if (!tourEl.hidden) positionStep();
});

on("welcome:closed", () => {
  if (localStorage.getItem(TOUR_STORAGE_KEY) === null) startTour();
});

on("language:changed", () => {
  if (!tourEl.hidden) renderStep();
});
