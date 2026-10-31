import { LANGUAGE_STORAGE_KEY } from "../config.js";
import { LANGUAGES, setLanguage } from "../i18n.js";
import { getState, on } from "../state.js";

// ============================================================
// LANGUAGE PICKER
//
// Two ways to the same choice: the toolbar's card, and a dropdown in the
// welcome modal, because someone who cannot read the page has to find their
// language before anything else. The choice is remembered; without one the
// app starts from the browser's languages (preferredLanguage in i18n.js).
// ============================================================
const toggleBtn = document.getElementById("language-toggle-btn");
const closeBtn = document.getElementById("language-card-close");
const cardEl = document.getElementById("language-card");
const listEl = document.getElementById("language-list");
const welcomeSelect = document.getElementById("welcome-language-select");

function chooseLanguage(code) {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
  setLanguage(code);
}

function setCardVisible(visible) {
  cardEl.hidden = !visible;
  toggleBtn.classList.toggle("active", visible);
  toggleBtn.setAttribute("aria-pressed", String(visible));
}

// Rebuilt on every language change, which also moves the highlight.
function renderChoices() {
  const current = getState().language;
  listEl.replaceChildren(...LANGUAGES.map(({ code, name }) => {
    const btn = document.createElement("button");
    btn.className = "language-option";
    btn.classList.toggle("active", code === current);
    btn.dataset.lang = code;
    btn.lang = code; // so each name is drawn with the right font for its script
    btn.textContent = name;
    btn.addEventListener("click", () => chooseLanguage(code));
    return btn;
  }));
  welcomeSelect.replaceChildren(...LANGUAGES.map(({ code, name }) => new Option(name, code, false, code === current)));
}

toggleBtn.addEventListener("click", () => setCardVisible(cardEl.hidden));
closeBtn.addEventListener("click", () => setCardVisible(false));
welcomeSelect.addEventListener("change", () => chooseLanguage(welcomeSelect.value));

on("language:changed", renderChoices);
