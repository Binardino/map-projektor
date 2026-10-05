"""Regenerates the images the README shows, from the running app.

The README's visuals are captured rather than hand-made so they can be redone
after any UI change instead of slowly drifting from what the app looks like.

Usage:
    poetry run python scripts/capture_readme_assets.py
"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

from perf_transitions import BASE_URL, skip_tour, start_server, stop_server
from render_fingerprint import apply_view, wait_until_settled

ROOT_DIR = pathlib.Path(__file__).parent.parent
ASSETS_DIR = ROOT_DIR / "docs" / "assets"

# 16:10 keeps the sidebar and the whole map in frame at GitHub's README width.
VIEWPORT = {"width": 1280, "height": 800}

# The hero spans the README's full width, so it gets the 2x density that keeps
# coastlines sharp on high-density screens; the gallery images are shown at
# half width, where 1x is already enough and three times lighter in git.
HERO_SCALE = 2
GALLERY_SCALE = 1

HERO = ("hero", "orthographic", "africa")

# (file name, projection id, view id). Albers can't take a recenter, so its
# view is whatever the app falls back to.
GALLERY = [
    ("south-up", "robinson", "southAmericaFlipped"),
    ("conic", "albers", "world"),
]


def open_app(page):
    skip_tour(page)
    page.goto(BASE_URL)
    page.wait_for_selector("path.country")
    page.keyboard.press("Escape")  # welcome modal
    wait_until_settled(page)


def show(page, proj_id, view_id):
    if page.evaluate("() => __app.currentProjectionId") != proj_id:
        page.click(f'.proj-btn[data-proj-id="{proj_id}"]')
        wait_until_settled(page)
    apply_view(page, view_id)


def shoot(page, name):
    # Park the pointer off the map so no hover state ends up in the picture.
    page.mouse.move(0, 0)
    page.wait_for_timeout(300)
    path = ASSETS_DIR / f"{name}.png"
    page.screenshot(path=path)
    print(f"Written {path.relative_to(ROOT_DIR)}")


def capture_hero(browser):
    page = browser.new_page(viewport=VIEWPORT, device_scale_factor=HERO_SCALE)
    open_app(page)
    name, proj_id, view_id = HERO
    show(page, proj_id, view_id)
    shoot(page, name)
    page.close()


def capture_gallery(browser):
    page = browser.new_page(viewport=VIEWPORT, device_scale_factor=GALLERY_SCALE)
    open_app(page)
    for name, proj_id, view_id in GALLERY:
        show(page, proj_id, view_id)
        shoot(page, name)

    show(page, "mercator", "world")
    page.click("#grid-toggle-btn")
    wait_until_settled(page)
    shoot(page, "tissot")
    page.click("#grid-toggle-btn")

    # Last: the theme stays switched for the rest of the page's life.
    page.click("#theme-toggle-btn")
    show(page, "orthographic", "world")
    shoot(page, "dark")
    page.close()


def main():
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    server = start_server()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            capture_hero(browser)
            capture_gallery(browser)
            browser.close()
    finally:
        stop_server(server)
    return 0


if __name__ == "__main__":
    sys.exit(main())
