// ============================================================
// WELCOME MODAL
//
// A short pitch (why flat maps lie); the controls are left to a
// progressive onboarding later. Opens on every launch —
// there is no "seen" flag and no manual re-open trigger.
// ============================================================

const helpModalBackdrop = document.getElementById("help-modal-backdrop");
const helpModalCloseBtn = document.getElementById("help-modal-close");
const helpModalCtaBtn = document.getElementById("help-modal-cta");

export function openHelpModal() {
  helpModalBackdrop.hidden = false;
}

function closeHelpModal() {
  helpModalBackdrop.hidden = true;
}

helpModalCloseBtn.addEventListener("click", closeHelpModal);
helpModalCtaBtn.addEventListener("click", closeHelpModal);

helpModalBackdrop.addEventListener("click", (event) => {
  if (event.target === helpModalBackdrop) closeHelpModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !helpModalBackdrop.hidden) closeHelpModal();
});
