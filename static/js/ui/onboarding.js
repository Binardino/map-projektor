import { TOUR_STORAGE_KEY } from "../config.js";
import { t } from "../i18n.js";
import { on } from "../state.js";
import { closeSidebar, openSidebar } from "./mobile-sidebar.js";

// ============================================================
// ONBOARDING TOUR
// A few bubbles, each next to the control it explains, shown once after
// the welcome modal closes (a localStorage flag remembers it) and again
// on demand from the toolbar's "?" button.
//
// Adding a step: one entry here plus tour.step.<id>.title / .text in
// en.json. `side` is where the bubble goes relative to the target;
// `drawer` marks targets that sit in the sidebar, which is an off-canvas
// drawer on mobile and has to be opened for the step.
// ============================================================
const STEPS = [
  { id: "projections", target: "#projection-list", side: "right", drawer: true },
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
  const target = document.querySelector(step.target).getBoundingClientRect();
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

  if (left < VIEWPORT_MARGIN || left + width > innerWidth - VIEWPORT_MARGIN) {
    // No room beside the target (the mobile drawer takes most of the
    // width): centre the bubble over the half of the screen the target's
    // middle is not in, without an arrow.
    side = "none";
    left = (innerWidth - width) / 2;
    top = targetMiddle > innerHeight / 2 ? VIEWPORT_MARGIN : innerHeight - height - VIEWPORT_MARGIN;
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
  positionStep();
  nextBtn.focus();
}

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
replayBtn.addEventListener("click", startTour);

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
