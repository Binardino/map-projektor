// Module entry point: imports every extracted module in the order their
// code used to run in the single map.js, then map.js itself.
import "./data/projections.js";
import "./core/scene.js";
import "./core/state.js";
import "./core/render.js";
import "./core/projection.js";
import "./core/geometry.js";
import "./core/animation.js";
import "./core/transition.js";
import "./map.js";
import "./data/views.js";
import "./core/recenter.js";
import "./core/camera.js";
import "./core/selection.js";
