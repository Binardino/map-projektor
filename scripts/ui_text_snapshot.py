"""Golden snapshot of every user-visible string, state by state.

Drives the app in headless Chromium and records the visible text plus the
text-bearing attributes (aria-label, title, placeholder, data-tooltip) in a
fixed list of UI states. Refactors must leave this snapshot byte-identical:
it catches a string that went missing, changed, or moved to another state,
which the i18n key test (tests/test_i18n.py) cannot see.

Usage:
    poetry run python scripts/ui_text_snapshot.py --check   # diff against tests/ui_text_snapshot.json
    poetry run python scripts/ui_text_snapshot.py --write   # (re)write the golden file
"""
import argparse
import difflib
import json
import pathlib
import sys

from playwright.sync_api import sync_playwright

# Same server lifecycle as the perf harness — one place to fix if it changes.
from perf_transitions import BASE_URL, start_server, stop_server

ROOT_DIR = pathlib.Path(__file__).parent.parent
SNAPSHOT_PATH = ROOT_DIR / "tests" / "ui_text_snapshot.json"

# Three projections from different families, so the info card's per-projection
# texts and a polar view's sidebar state are both covered without the whole list.
SNAPSHOT_PROJECTIONS = ["mercator", "robinson", "polarNorth"]
COUNTRY_QUERY = "fra"

# Visibility-filtered on purpose: the snapshot records what the user sees in a
# given state, so a string shown in the wrong state shows up as a diff.
# <option> elements are never "visible" while the select is closed, so the
# compare select's options are collected separately below.
COLLECT_JS = """() => {
    const norm = (s) => s.replace(/\\s+/g, " ").trim();
    const out = [`[document.title] ${norm(document.title)}`];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = norm(node.textContent);
        const parent = node.parentElement;
        if (!text || parent.closest("script, style, option")) continue;
        if (!parent.checkVisibility()) continue;
        out.push(text);
    }
    for (const el of document.body.querySelectorAll("*")) {
        if (!el.checkVisibility()) continue;
        for (const attr of ["aria-label", "title", "placeholder", "data-tooltip"]) {
            const value = el.getAttribute(attr);
            if (value) out.push(`[${attr}] ${norm(value)}`);
        }
    }
    for (const option of document.querySelectorAll("#compare-projection-select option")) {
        out.push(`[option] ${norm(option.textContent)}`);
    }
    return out;
}"""


def wait_until_settled(page):
    page.wait_for_function("() => !window.__app.isAnimating")
    page.wait_for_timeout(100)


def capture_states(page):
    states = {}
    page.goto(BASE_URL)
    page.wait_for_selector("path.country")
    states["launch (welcome modal open)"] = page.evaluate(COLLECT_JS)

    page.keyboard.press("Escape")
    states["map, no card open"] = page.evaluate(COLLECT_JS)

    page.click("#info-toggle-btn")
    states["info card (initial projection)"] = page.evaluate(COLLECT_JS)

    for proj_id in SNAPSHOT_PROJECTIONS:
        page.click(f'.proj-btn[data-proj-id="{proj_id}"]')
        wait_until_settled(page)
        states[f"info card ({proj_id})"] = page.evaluate(COLLECT_JS)

    # Opening the compare card closes the info card (one popover at a time).
    page.click("#compare-toggle-btn")
    states["compare card"] = page.evaluate(COLLECT_JS)

    page.fill("#compare-country-input", COUNTRY_QUERY)
    states[f"compare card, country search '{COUNTRY_QUERY}'"] = page.evaluate(COLLECT_JS)
    return states


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true", help="fail if the UI text differs from the golden file")
    mode.add_argument("--write", action="store_true", help="record the current UI text as the golden file")
    args = parser.parse_args()

    server = start_server()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            states = capture_states(page)
            browser.close()
    finally:
        stop_server(server)

    current = json.dumps(states, indent=2, ensure_ascii=False) + "\n"

    if args.write:
        SNAPSHOT_PATH.write_text(current, encoding="utf-8")
        print(f"Snapshot written to {SNAPSHOT_PATH} ({len(states)} states)")
        return 0

    if not SNAPSHOT_PATH.exists():
        print(f"No snapshot at {SNAPSHOT_PATH} yet — run with --write first.")
        return 1

    golden = SNAPSHOT_PATH.read_text(encoding="utf-8")
    if current == golden:
        print(f"UI text unchanged ({len(states)} states).")
        return 0

    print("UI TEXT CHANGED:")
    sys.stdout.writelines(difflib.unified_diff(
        golden.splitlines(keepends=True), current.splitlines(keepends=True),
        fromfile="golden", tofile="current",
    ))
    return 1


if __name__ == "__main__":
    sys.exit(main())
