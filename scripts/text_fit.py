"""Checks that every text fits its box, in every language.

Translations run longer or taller than the English they replace, so this walks
the languages on a desktop and a phone window: no text may overflow its button,
and the cards and tour bubbles must stay inside the window. A text box that
scrolls is allowed (nothing is cut off) but listed, so it can be looked at.

Usage:
    poetry run python scripts/text_fit.py
"""
import re
import sys

from playwright.sync_api import sync_playwright

from perf_transitions import BASE_URL, ROOT_DIR, skip_tour, start_server, stop_server

VIEWPORTS = {"desktop": {"width": 1280, "height": 800}, "phone": {"width": 390, "height": 740}}
LANGUAGES = re.findall(r'\{ code: "([\w-]+)", name:', (ROOT_DIR / "static" / "js" / "i18n.js").read_text(encoding="utf-8"))

# Runs in the page. The tour's steps and the projection cards are filled
# directly: playing them for real means a morph per step, per language.
MEASURE_JS = """async () => {
  const hard = [], scrolls = [];
  const box = (el) => el.getBoundingClientRect();
  const inWindow = (r) => r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
  const messages = await (await fetch(`/static/i18n/${document.documentElement.lang}.json`)).json()
    .catch(() => ({}));
  const text = (key, fallback) => messages[key] ?? fallback;

  const modal = document.getElementById("help-modal");
  if (!inWindow(box(modal))) hard.push("welcome modal outside the window");
  if (modal.scrollHeight > modal.clientHeight + 1) scrolls.push("welcome modal");
  document.getElementById("help-modal-close").click();

  document.querySelectorAll(".proj-btn, .recenter-btn").forEach((el) => {
    if (el.scrollWidth > el.clientWidth + 1) hard.push(`button text too wide: ${el.textContent.trim()}`);
  });

  document.getElementById("language-toggle-btn").click();
  const languageCard = document.getElementById("language-card");
  if (!inWindow(box(languageCard))) hard.push("language card outside the window");
  document.querySelectorAll(".language-option").forEach((el) => {
    if (el.scrollWidth > el.clientWidth + 1) hard.push(`language name too wide: ${el.textContent}`);
  });
  document.getElementById("language-card-close").click();

  document.getElementById("info-toggle-btn").click();
  const info = document.getElementById("projection-info");
  const fields = ["origin", "preserves", "distorts", "bestFor"];
  for (const id of window.__app.PROJECTIONS.map((p) => p.id)) {
    const cells = info.querySelectorAll("dd");
    fields.forEach((field, i) => { cells[i].textContent = text(`projection.${id}.${field}`, cells[i].textContent); });
    if (!inWindow(box(info))) hard.push(`info card outside the window: ${id}`);
    if (info.scrollHeight > info.clientHeight + 1) scrolls.push(`info card: ${id}`);
  }
  document.getElementById("info-close-btn").click();

  const tour = document.getElementById("tour");
  const bubble = document.getElementById("tour-bubble");
  tour.hidden = false;
  for (const step of ["mercator", "equalEarth", "views", "tools", "language", "navigation"]) {
    document.getElementById("tour-title").textContent = text(`tour.step.${step}.title`, "");
    document.getElementById("tour-text").textContent = text(`tour.step.${step}.text`, "");
    if (bubble.offsetHeight > innerHeight - 24) hard.push(`tour bubble taller than the window: ${step}`);
  }
  tour.hidden = true;
  return { hard, scrolls };
}"""


def main():
    failures = []
    server = start_server()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            for lang in LANGUAGES:
                for name, viewport in VIEWPORTS.items():
                    page = browser.new_page(viewport=viewport)
                    skip_tour(page)
                    page.add_init_script(f"localStorage.setItem('mapProjektorLanguage', '{lang}')")
                    page.goto(BASE_URL)
                    page.wait_for_selector("path.country")
                    page.evaluate("() => document.fonts.ready")
                    result = page.evaluate(MEASURE_JS)
                    status = "ok" if not result["hard"] else "FAIL"
                    note = f"  scrolls: {', '.join(result['scrolls'])}" if result["scrolls"] else ""
                    print(f"  {status:5s} {lang:3s} {name}{note}")
                    failures += [f"{lang} {name}: {problem}" for problem in result["hard"]]
                    page.close()
            browser.close()
    finally:
        stop_server(server)

    if failures:
        print("\nTEXTS THAT DO NOT FIT:")
        for failure in failures:
            print(f"  - {failure}")
        return 1
    print(f"\nEvery text fits, in {len(LANGUAGES)} languages.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
