import { on } from "../state.js";

// ============================================================
// MOBILE SIDEBAR TOGGLE
// The sidebar becomes an off-canvas drawer under the mobile
// breakpoint (see the media query in style.css); this button and
// backdrop only have a visual effect there — desktop layout is
// untouched since #sidebar-toggle stays display:none above 768px.
// ============================================================
const sidebarToggleBtn = document.getElementById("sidebar-toggle");
const sidebarBackdrop  = document.getElementById("sidebar-backdrop");
const sidebarEl        = document.getElementById("sidebar");

// The drawer only exists where the toggle button shows (under the mobile
// breakpoint); on desktop this would only dim the page with the backdrop.
export function openSidebar() {
  if (getComputedStyle(sidebarToggleBtn).display === "none") return;
  sidebarEl.classList.add("open");
  sidebarBackdrop.hidden = false;
}

export function closeSidebar() {
  sidebarEl.classList.remove("open");
  sidebarBackdrop.hidden = true;
}

sidebarToggleBtn.addEventListener("click", () => {
  const willOpen = !sidebarEl.classList.contains("open");
  sidebarEl.classList.toggle("open", willOpen);
  sidebarBackdrop.hidden = !willOpen;
});

sidebarBackdrop.addEventListener("click", closeSidebar);

// No-op on desktop; on mobile, picking a projection reveals the map.
on("projection:requested", closeSidebar);
