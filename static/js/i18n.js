// ============================================================
// I18N — every user-visible string lives in static/i18n/<lang>.json
//
// Flat key → string dictionaries (e.g. "projection.mercator.name"), English
// being the source of truth. Loaded before map.js so its render code can
// call t() from the very first frame.
// ============================================================
let messages = {};

// A missing key returns the key itself (visible in the UI, so it gets
// noticed) and warns once in the console rather than crashing the render.
function t(key, vars = {}) {
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

async function loadLanguage(lang) {
  const response = await fetch(`/static/i18n/${lang}.json`);
  messages = await response.json();
  document.documentElement.lang = lang;
  applyStaticTranslations();
}
