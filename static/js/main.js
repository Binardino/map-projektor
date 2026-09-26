// Module entry point: imports every extracted module in the order their
// code used to run in the single map.js, then map.js itself.
import "./data/projections.js";
import "./map.js";
import "./core/geometry.js";
import "./data/views.js";
