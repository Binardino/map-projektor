"""End-to-end smoke test: walks the main user paths in headless Chromium.

Complements the golden files (UI text, render fingerprint), which only
compare end states: this checks that things *happen* — modals close, views
survive a projection switch, the camera moves and resets — and fails on
any page error or missing translation key logged along the way.

Deliberately a script, not part of pytest: like the perf harness it drives
a real browser and takes about a minute.

Usage:
    poetry run python scripts/e2e_smoke.py
"""
import sys
import time

from playwright.sync_api import sync_playwright

from perf_transitions import BASE_URL, start_server, stop_server

VIEWPORT = {"width": 1280, "height": 900}
MOBILE_VIEWPORT = {"width": 390, "height": 844}

# Screen-space centre of a country's drawn shape, in the map's world group
# (before the camera transform, which every projection switch resets).
COUNTRY_X_JS = """(name) => {
    const path = [...document.querySelectorAll("path.country")].find((p) => p.__data__.properties.name === name);
    const box = path.getBBox();
    return box.x + box.width / 2;
}"""

CAMERA_JS = "() => document.querySelector('g.viewport').getAttribute('transform') || ''"


def settle(page):
    page.wait_for_function("() => !window.__app.isAnimating")
    page.wait_for_timeout(150)


def open_app(page):
    page.goto(BASE_URL)
    page.wait_for_selector("path.country")
    settle(page)


def modal_open(page):
    return page.is_visible("#help-modal")


def switch(page, proj_id):
    page.click(f'.proj-btn[data-proj-id="{proj_id}"]')
    settle(page)


def view(page, preset_id):
    page.click(f'.recenter-btn[data-preset-id="{preset_id}"]')
    settle(page)


def active_view(page):
    return page.evaluate("() => document.querySelector('.recenter-btn.active')?.dataset.presetId")


# ---------------------------------------------------------------- scenarios
# Each takes a page on a freshly loaded app (welcome modal open) and asserts.

def welcome_modal(page):
    assert modal_open(page), "welcome modal should open on launch"
    page.click("#help-modal-close")
    assert not modal_open(page), "✕ should close the modal"
    open_app(page)
    page.keyboard.press("Escape")
    assert not modal_open(page), "Esc should close the modal"
    open_app(page)
    page.mouse.click(5, 5)  # the backdrop, outside the dialog
    assert not modal_open(page), "a backdrop click should close the modal"


def view_survives_switch(page):
    page.keyboard.press("Escape")
    # China's box centre shifts ~15px between projections because its shape
    # changes, so the check is "still near the middle", not "didn't move": a
    # view lost in the morph puts it a few hundred pixels off-centre.
    middle = page.evaluate("() => document.getElementById('map-svg').viewBox.baseVal.width / 2")
    view(page, "china")
    before = page.evaluate(COUNTRY_X_JS, "China")
    switch(page, "robinson")
    after = page.evaluate(COUNTRY_X_JS, "China")
    assert active_view(page) == "china", f"view should survive the switch, got {active_view(page)}"
    for label, x in (("before", before), ("after", after)):
        assert abs(x - middle) < 40, f"China {label} the switch is {x - middle:.0f}px off the middle"

    view(page, "southAmericaFlipped")
    switch(page, "mollweide")
    assert active_view(page) == "southAmericaFlipped", "upside-down view should survive the switch"

    view(page, "china")
    switch(page, "albers")
    assert active_view(page) == "world", "Albers should ease back to Europe-centered"


def africa_view(page):
    page.keyboard.press("Escape")
    europe_x = page.evaluate(COUNTRY_X_JS, "Nigeria")
    view(page, "africa")
    africa_x = page.evaluate(COUNTRY_X_JS, "Nigeria")
    assert africa_x < europe_x, f"Nigeria should move left ({europe_x:.0f} → {africa_x:.0f})"


def polar_route_and_flip(page):
    page.keyboard.press("Escape")
    switch(page, "mercator")
    switch(page, "polarNorth")
    assert page.evaluate("() => __app.currentProjectionId") == "polarNorth"
    switch(page, "mercator")
    view(page, "southAmericaFlipped")
    transform = page.evaluate("() => __app.mapGroup.node().closest('g.world').style.transform")
    assert "scale(1, -1)" in transform, f"flip should end mirrored, got {transform!r}"


def camera(page):
    page.keyboard.press("Escape")
    switch(page, "mercator")
    page.mouse.move(640, 450)
    page.mouse.wheel(0, -300)
    page.wait_for_timeout(600)
    zoomed = page.evaluate(CAMERA_JS)
    assert "scale(1)" not in zoomed and zoomed, f"wheel should zoom, got {zoomed!r}"

    page.mouse.move(640, 450)
    page.mouse.down()
    page.mouse.move(540, 400, steps=5)
    page.mouse.up()
    assert page.evaluate(CAMERA_JS) != zoomed, "drag should pan"

    # The reset button went with the redesign; a projection switch is what
    # brings the camera back to the default framing now.
    switch(page, "orthographic")
    assert page.evaluate(CAMERA_JS) in ("", "translate(0,0) scale(1)"), "a switch should reset the camera"

    rot = page.evaluate("() => JSON.stringify(__app.currentRecenterRotate)")
    page.mouse.move(640, 450)
    page.mouse.down()
    page.mouse.move(740, 450, steps=5)
    page.mouse.up()
    assert page.evaluate("() => JSON.stringify(__app.currentRecenterRotate)") != rot, "globe drag should rotate"
    assert page.evaluate(CAMERA_JS) in ("", "translate(0,0) scale(1)"), "globe drag should not pan"


def tools_and_cards(page):
    page.keyboard.press("Escape")
    page.click("#grid-toggle-btn")
    assert page.locator("path.tissot").count() > 0, "grid toggle should draw Tissot circles"
    page.click("#grid-toggle-btn")
    assert page.locator("path.tissot").count() == 0, "grid toggle should clear Tissot circles"

    page.click("#info-toggle-btn")
    assert page.is_visible("#projection-info")
    page.click("#compare-toggle-btn")
    assert page.is_visible("#compare-card") and not page.is_visible("#projection-info"), "one card at a time"
    page.click("#compare-card-close")
    assert not page.is_visible("#compare-card")


def mobile_drawer(page):
    page.set_viewport_size(MOBILE_VIEWPORT)
    open_app(page)
    page.keyboard.press("Escape")
    page.click("#sidebar-toggle")
    assert page.evaluate("() => document.getElementById('sidebar').classList.contains('open')"), "drawer should open"
    page.click("#sidebar-toggle")
    assert not page.evaluate("() => document.getElementById('sidebar').classList.contains('open')"), "drawer should close"


SCENARIOS = [welcome_modal, view_survives_switch, africa_view, polar_route_and_flip, camera, tools_and_cards, mobile_drawer]


def main():
    failures = []
    started = time.monotonic()
    server = start_server()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            for scenario in SCENARIOS:
                page = browser.new_page(viewport=VIEWPORT)
                problems = []
                page.on("pageerror", lambda err, problems=problems: problems.append(f"page error: {err}"))
                page.on("console", lambda msg, problems=problems: problems.append(f"console: {msg.text}")
                        if msg.type in ("error", "warning") or "[i18n] missing key" in msg.text else None)
                try:
                    open_app(page)
                    scenario(page)
                except AssertionError as err:
                    problems.append(str(err))
                except Exception as err:  # a missing element or timeout fails this scenario, not the run
                    problems.append(f"{type(err).__name__}: {str(err).splitlines()[0]}")
                page.close()
                status = "ok" if not problems else "FAIL"
                print(f"  {status:4}  {scenario.__name__}")
                failures += [f"{scenario.__name__}: {p}" for p in problems]
            browser.close()
    finally:
        stop_server(server)

    print(f"\n{len(SCENARIOS)} scenarios in {time.monotonic() - started:.0f}s")
    if failures:
        print("FAILURES:")
        for failure in failures:
            print(f"  - {failure}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
