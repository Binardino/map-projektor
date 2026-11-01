import { refreshFlip } from "./recenter.js";
import { mainView } from "./scene.js";
import { emit, getState, subscribe } from "../state.js";

// ============================================================
// RESIZE — the main map follows its container
//
// A phone turning sideways or a resized window. Watching the container and
// not the window also catches the sidebar turning into a drawer. A morph
// draws from sizes it read when it started, so a change during one waits
// for "busy" to clear.
// ============================================================
const container = document.getElementById("map-container");

function fitToContainer() {
  const { clientWidth: width, clientHeight: height } = container;
  if (getState().busy || !width || !height) return;
  if (width === mainView.width && height === mainView.height) return;
  mainView.resize(width, height);
  refreshFlip(mainView);
  if (!mainView.projectionDef) return; // the data is still loading: init draws at the new size
  mainView.render();
  emit("view:changed");
}

new ResizeObserver(fitToContainer).observe(container);
subscribe(["busy"], fitToContainer);
