// ============================================================
// TOOLS — which optional tools the app loads (main.js imports this).
//
// Each tool wires itself to the core through the store and events
// ("frame", "view:changed", …), so loading it is all it takes. The
// distortion grid and the reference lines have toolbar buttons. Side-by-
// side comparison, flight path and true size lost theirs in the redesign:
// they are kept (isolated, not deleted) but not loaded. To bring one back,
// give it a button and import it here.
// ============================================================
import "./tissot.js";
import "./reference-lines.js";
