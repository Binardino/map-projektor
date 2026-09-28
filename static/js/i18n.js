import { I18N_BASE_URL } from "./config.js";
import { emit, setState } from "./state.js";

// ============================================================
// I18N — every user-visible string lives in static/i18n/<lang>.json
//
// Flat key → string dictionaries (e.g. "projection.mercator.name"), English
// being the source of truth. init() awaits setLanguage() before the first
// render, so every t() call already has its strings.
// ============================================================
let messages = {};

// A missing key returns the key itself (visible in the UI, so it gets
// noticed) and warns once in the console rather than crashing the render.
export function t(key, vars = {}) {
  const template = messages[key];
  if (template === undefined) {
    console.warn(`[i18n] missing key: ${key}`);
    return key;
  }
  return template.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? `{${name}}`);
}

// Static markup opts in with attributes instead of being rebuilt in JS:
//   data-i18n="key"                     → textContent
//   data-i18n-html="key"                → innerHTML (our own trusted files only,
//                                         for the few strings with inline <strong>)
//   data-i18n-attr="aria-label:key;…"   → any attribute
function applyStaticTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  document.querySelectorAll("[data-i18n-attr]").forEach((el) => {
    el.dataset.i18nAttr.split(";").forEach((pair) => {
      const [attr, key] = pair.split(":");
      el.setAttribute(attr, t(key));
    });
  });
  document.title = t("app.title");
}

// Loads a language and re-renders every text: the static markup here, the
// built UI through its "language:changed" subscribers. Also how the app
// starts (init), so the first build and a later switch take the same path.
export async function setLanguage(lang) {
  const response = await fetch(`${I18N_BASE_URL}${lang}.json`);
  messages = await response.json();
  document.documentElement.lang = lang;
  applyStaticTranslations();
  setState({ language: lang });
  emit("language:changed");
}
