"""Golden fingerprint of what the map draws, projection by projection.

The UI text snapshot and the e2e smoke test can't see a shape that moved:
this script hashes the `d` attribute of every country and terrain path once
each projection has settled, under the Europe- and China-centered views, and
records where a few fixed points land under each projection's fit. A refactor
must leave it identical; a deliberate drawing change rewrites it.

Usage:
    poetry run python scripts/render_fingerprint.py --check   # diff against tests/render_fingerprint.json
    poetry run python scripts/render_fingerprint.py --write   # (re)write the golden file
"""
import argparse
import difflib
import hashlib
import json
import pathlib
import sys

from playwright.sync_api import sync_playwright

from perf_transitions import BASE_URL, start_server, stop_server

ROOT_DIR = pathlib.Path(__file__).parent.parent
FINGERPRINT_PATH = ROOT_DIR / "tests" / "render_fingerprint.json"

VIEWS = ["world", "china"]

# Spread over both hemispheres, near a pole and near the antimeridian, so a
# change to the fit or the clipping moves at least one of them.
CONTROL_POINTS = [[0, 0], [2.35, 48.85], [-70, -33], [139.7, 35.7], [-179, 80]]

# In document order: the positional terrain join and the country order are
# part of what's drawn, so a reordering is a change too.
PATHS_JS = """() => [
    ...document.querySelectorAll("path.country"),
    ...__app.terrainGroup.node().querySelectorAll("path"),
].map((p) => p.getAttribute("d") || "")"""

POINTS_JS = """(points) => Object.fromEntries(__app.PROJECTIONS.map((def) => {
    const projection = __app.makeProjection(def);
    return [def.id, points.map((pt) => {
        const xy = projection(pt);
        return xy ? xy.map((v) => Number(v.toFixed(6))) : null;
    })];
}))"""


def wait_until_settled(page):
    page.wait_for_function("() => !window.__app.isAnimating")
    page.wait_for_timeout(100)


def path_hash(page):
    digest = hashlib.sha256()
    for d in page.evaluate(PATHS_JS):
        digest.update(d.encode())
        digest.update(b"\n")
    return digest.hexdigest()


def apply_view(page, view_id):
    """Re-applies the view after a switch that may have dropped it: Albers and
    the polar views can't take a recenter and ease back to Europe."""
    if page.evaluate("() => document.getElementById('recenter-list').classList.contains('disabled-list')"):
        return
    if page.evaluate("() => document.querySelector('.recenter-btn.active')?.dataset.presetId") == view_id:
        return
    page.click(f'.recenter-btn[data-preset-id="{view_id}"]')
    wait_until_settled(page)


def capture(page):
    page.goto(BASE_URL)
    page.wait_for_selector("path.country")
    page.keyboard.press("Escape")  # welcome modal
    wait_until_settled(page)

    proj_ids = page.evaluate("() => __app.PROJECTIONS.map((p) => p.id)")
    hashes = {}
    for view_id in VIEWS:
        for proj_id in proj_ids:
            if page.evaluate("() => __app.currentProjectionId") != proj_id:
                page.click(f'.proj-btn[data-proj-id="{proj_id}"]')
                wait_until_settled(page)
            apply_view(page, view_id)
            active = page.evaluate("() => document.querySelector('.recenter-btn.active')?.dataset.presetId")
            hashes[f"{view_id} / {proj_id}"] = {"view shown": active, "paths": path_hash(page)}

    return {"paths": hashes, "control points": page.evaluate(POINTS_JS, CONTROL_POINTS)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true", help="fail if the drawing differs from the golden file")
    mode.add_argument("--write", action="store_true", help="record the current drawing as the golden file")
    args = parser.parse_args()

    server = start_server()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            result = capture(page)
            browser.close()
    finally:
        stop_server(server)

    current = json.dumps(result, indent=2) + "\n"

    if args.write:
        FINGERPRINT_PATH.write_text(current, encoding="utf-8")
        print(f"Fingerprint written to {FINGERPRINT_PATH} ({len(result['paths'])} renders)")
        return 0

    if not FINGERPRINT_PATH.exists():
        print(f"No fingerprint at {FINGERPRINT_PATH} yet — run with --write first.")
        return 1

    golden = FINGERPRINT_PATH.read_text(encoding="utf-8")
    if current == golden:
        print(f"Drawing unchanged ({len(result['paths'])} renders).")
        return 0

    print("DRAWING CHANGED:")
    sys.stdout.writelines(difflib.unified_diff(
        golden.splitlines(keepends=True), current.splitlines(keepends=True),
        fromfile="golden", tofile="current",
    ))
    return 1


if __name__ == "__main__":
    sys.exit(main())
