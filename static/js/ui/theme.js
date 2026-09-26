// ============================================================
// THEME SWITCHER
// Persists the chosen theme in localStorage so it survives page
// reloads and stays constant across projection switches. The
// toolbar's icon (see map-tools) is the only control for this now —
// the sidebar used to have its own checkbox too, dropped as a
// duplicate once the toolbar icon existed.
// ============================================================
const THEME_STORAGE_KEY = "mapProjektorTheme";

const themeToggleBtn = document.getElementById("theme-toggle-btn");

// Unlike the grid/compare/info tool icons, this one is a plain on/off
// switch, never shown as "selected" (no .active class) — see the Figma
// spec's note that light/dark has no selected state, just two positions.
function applyTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  themeToggleBtn.setAttribute("aria-pressed", String(theme === "dark"));
}

const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
if (savedTheme !== null) {
  applyTheme(savedTheme);
}

themeToggleBtn.addEventListener("click", () => {
  const theme = document.body.getAttribute("data-theme") === "dark" ? "" : "dark";
  applyTheme(theme);
  localStorage.setItem(THEME_STORAGE_KEY, theme);
});
