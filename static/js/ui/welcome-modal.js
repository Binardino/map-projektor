// ============================================================
// WELCOME MODAL
//
// One modal, two parts: a short pitch (why flat maps lie), then a
// "how it works" pointer to each control. Opens on every launch —
// there is no "seen" flag and no manual re-open trigger.
// ============================================================

const helpModalBackdrop = document.getElementById("help-modal-backdrop");
const helpModalCloseBtn = document.getElementById("help-modal-close");

export function openHelpModal() {
  helpModalBackdrop.hidden = false;
}

function closeHelpModal() {
  helpModalBackdrop.hidden = true;
}

helpModalCloseBtn.addEventListener("click", closeHelpModal);

helpModalBackdrop.addEventListener("click", (event) => {
  if (event.target === helpModalBackdrop) closeHelpModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !helpModalBackdrop.hidden) closeHelpModal();
});
