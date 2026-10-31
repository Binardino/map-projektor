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

from perf_transitions import BASE_URL, skip_tour, start_server, stop_server

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


def tour_open(page):
    return page.is_visible("#tour")


def tour_seen(page):
    return page.evaluate("() => localStorage.getItem('mapProjektorTourSeen')") == "1"


def spotlight_covers(page, selector):
    """The spotlight frames the step's control: same box, give or take its padding."""
    target = page.locator(selector).bounding_box()
    spot = page.locator("#tour-spotlight").bounding_box()
    return all(abs(spot[k] - target[k]) <= 12 for k in ("x", "y", "width", "height"))


def bubble_on_screen(page):
    box = page.locator("#tour-bubble").bounding_box()
    size = page.viewport_size
    return box["x"] >= 0 and box["y"] >= 0 and box["x"] + box["width"] <= size["width"] and box["y"] + box["height"] <= size["height"]


TOUR_TARGETS = ['.proj-btn[data-proj-id="mercator"]', '.proj-btn[data-proj-id="equalEarth"]',
                "#recenter-panel", "#map-tools", "#language-toggle-btn", "#zoom-controls"]
# The tour opens on a demonstration: its first steps switch the projection themselves.
TOUR_SHOWS = ["mercator", "equalEarth"]
PROJECTION_JS = "() => window.__app.currentProjectionId"


# ---------------------------------------------------------------- scenarios
# Each takes a page on a freshly loaded app (welcome modal open) and asserts.
# Every scenario but the onboarding ones starts with the tour marked as seen
# (see main), so closing the modal leaves the app free to click.

def welcome_modal(page):
    assert modal_open(page), "welcome modal should open on launch"
    page.click("#help-modal-close")
    assert not modal_open(page), "✕ should close the modal"
    open_app(page)
    page.click("#help-modal-cta")
    assert not modal_open(page), "Got it should close the modal"
    open_app(page)
    page.keyboard.press("Escape")
    assert not modal_open(page), "Esc should close the modal"
    open_app(page)
    page.mouse.click(5, 5)  # the backdrop, outside the dialog
    assert not modal_open(page), "a backdrop click should close the modal"


def onboarding_tour(page):
    assert not tour_open(page), "the tour should wait for the welcome modal to close"
    page.click("#help-modal-cta")
    for index, selector in enumerate(TOUR_TARGETS):
        assert tour_open(page), f"step {index + 1} should be showing"
        if index < len(TOUR_SHOWS):
            assert not page.is_visible("#tour-bubble"), f"step {index + 1}: the bubble should step aside during the morph"
            settle(page)
            assert page.evaluate(PROJECTION_JS) == TOUR_SHOWS[index], f"step {index + 1} should show {TOUR_SHOWS[index]}"
        assert page.is_visible("#tour-bubble"), f"step {index + 1}: the bubble should show once the map is still"
        assert page.inner_text("#tour-progress") == f"{index + 1} / {len(TOUR_TARGETS)}"
        assert spotlight_covers(page, selector), f"step {index + 1} should highlight {selector}"
        assert bubble_on_screen(page), f"step {index + 1}: the bubble should fit in the window"
        last = index == len(TOUR_TARGETS) - 1
        assert page.is_visible("#tour-skip") != last, "Skip shows on every step but the last"
        page.click("#tour-next")
    assert not tour_open(page), "Done should close the tour"
    assert tour_seen(page), "a finished tour should be remembered"

    open_app(page)
    page.click("#help-modal-cta")
    assert not tour_open(page), "a seen tour should not start again by itself"
    assert page.evaluate(PROJECTION_JS) == "orthographic", "without the tour, the app stays on the globe"
    page.click("#tour-replay-btn")
    assert tour_open(page), "the ? button should replay the tour"
    page.click("#tour-skip")
    assert not tour_open(page), "Skip tutorial should close the tour"
    assert page.evaluate(PROJECTION_JS) == "mercator", "a skipped tour leaves the map where the demonstration put it"
    switch(page, "robinson")  # the app is clickable again


def onboarding_skip_and_escape(page):
    # The Escape that closes the modal must not also skip the tour it starts
    page.keyboard.press("Escape")
    assert not modal_open(page) and tour_open(page), "Esc on the modal should leave the tour open"
    assert not tour_seen(page)
    page.keyboard.press("Escape")
    assert not tour_open(page), "Esc should skip the tour"
    assert tour_seen(page), "a skipped tour should be remembered"

    page.evaluate("() => localStorage.clear()")
    open_app(page)
    page.click("#help-modal-close")
    page.click("#tour-skip")
    assert not tour_open(page) and tour_seen(page), "Skip tutorial on the first step should end the tour"


def onboarding_mobile(page):
    page.set_viewport_size(MOBILE_VIEWPORT)
    open_app(page)
    page.click("#help-modal-cta")
    drawer_open = "() => document.getElementById('sidebar').classList.contains('open')"
    for index, selector in enumerate(TOUR_TARGETS):
        settle(page)
        page.wait_for_timeout(350)  # the drawer's slide, after which the bubble is placed again
        assert page.evaluate(drawer_open) == (index == 2), f"step {index + 1}: drawer open only for the views step"
        if index < len(TOUR_SHOWS):
            # The projection buttons are in the closed drawer: the map is shown instead
            assert page.evaluate(PROJECTION_JS) == TOUR_SHOWS[index], f"step {index + 1} should show {TOUR_SHOWS[index]}"
            assert not page.is_visible("#tour-spotlight"), f"step {index + 1}: nothing to highlight with the drawer closed"
            assert page.evaluate("() => window.scrollX") == 0, f"step {index + 1} should not scroll the page sideways"
        else:
            assert spotlight_covers(page, selector), f"step {index + 1} should highlight {selector}"
        assert bubble_on_screen(page), f"step {index + 1}: the bubble should fit in the window"
        page.click("#tour-next")
    assert not tour_open(page) and not page.evaluate(drawer_open)


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

    page.click("#compare-toggle-btn")
    page.fill("#compare-country-input", "fra")
    page.click("#compare-country-results li")
    page.click("#info-toggle-btn")
    assert page.is_visible("#compare-card") and page.is_visible("#projection-info"), "both cards open together"
    assert page.locator("#compare-country-list li").count() == 1, "opening info must keep the compared countries"
    compare_box = page.locator("#compare-card").bounding_box()
    info_box = page.locator("#projection-info").bounding_box()
    assert info_box["y"] >= compare_box["y"] + compare_box["height"], "info card should sit below the compare card"
    page.click("#compare-card-close")
    assert not page.is_visible("#compare-card") and page.is_visible("#projection-info")
    page.click("#info-close-btn")
    assert not page.is_visible("#projection-info")


# Screen centre of a country as the map draws it.
COUNTRY_BOX_JS = """(name) => {
    const path = [...document.querySelectorAll("path.country")].find((p) => p.__data__.properties.name === name);
    const box = path.getBoundingClientRect();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}"""

# Screen box of the first compared country: centre and size.
COMPARE_BOX_JS = """() => {
    const box = document.querySelector(".compare-highlight").getBoundingClientRect();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2, width: box.width, height: box.height };
}"""


def country_drag(page):
    """A compared country is moved on the sphere, not on the screen: dragged
    from the Arctic to the equator of a Mercator map it shrinks. It stays at
    that place on Earth through a view change and goes back home when the
    projection changes."""
    page.keyboard.press("Escape")
    switch(page, "mercator")
    page.click("#compare-toggle-btn")
    page.click("#compare-country-input")
    assert page.is_visible("#compare-country-results"), "focusing the field should list the countries"
    page.mouse.click(640, 450)
    assert not page.is_visible("#compare-country-results"), "a click outside the picker should close the list"
    page.fill("#compare-country-input", "greenl")
    page.click("#compare-country-results li")
    home = page.evaluate(COMPARE_BOX_JS)
    svg = page.locator("#map-svg").bounding_box()
    middle = (svg["x"] + svg["width"] / 2, svg["y"] + svg["height"] / 2)

    page.mouse.move(home["x"], home["y"])
    page.mouse.down()
    page.mouse.move(*middle, steps=10)
    page.mouse.up()
    moved = page.evaluate(COMPARE_BOX_JS)
    assert abs(moved["x"] - middle[0]) < 60 and abs(moved["y"] - middle[1]) < 60, "the country should follow the pointer"
    assert moved["height"] < home["height"] / 2, (
        f"Greenland should shrink towards the equator on Mercator: {home['height']:.0f}px -> {moved['height']:.0f}px")
    assert page.evaluate(CAMERA_JS) in ("", "translate(0,0) scale(1)"), "dragging a country should not pan the map"

    # Drawn under another projection than the map's, it changes shape but
    # stays where it was dragged to.
    page.select_option("#compare-projection-select", "gallPeters")
    other = page.evaluate(COMPARE_BOX_JS)
    assert abs(other["height"] - moved["height"]) > 5, "the chosen projection should redraw the country"
    assert abs(other["x"] - middle[0]) < 60 and abs(other["y"] - middle[1]) < 60, "the redrawn country should stay in place"
    page.select_option("#compare-projection-select", "")
    assert page.evaluate(COMPARE_BOX_JS) == moved, "back to the map's projection, the country is drawn as before"

    view(page, "africa")
    kept = page.evaluate(COMPARE_BOX_JS)
    assert kept["height"] < home["height"] / 2, "the country should keep its place on Earth through a view change"

    switch(page, "robinson")
    back = page.evaluate(COMPARE_BOX_JS)
    greenland = page.evaluate(COUNTRY_BOX_JS, "Greenland")
    assert abs(back["x"] - greenland["x"]) < 2 and abs(back["y"] - greenland["y"]) < 2, (
        "a projection switch should send the country back home")


def ui_rebuild(page):
    """The UI builders are idempotent: re-rendering for a language change
    leaves the same text, the same number of nodes and the same active
    buttons, with a non-default view and a compared country in place."""
    page.keyboard.press("Escape")
    view(page, "china")
    page.click("#compare-toggle-btn")
    page.fill("#compare-country-input", "fra")
    page.click("#compare-country-results li")
    snapshot = """() => [document.body.innerText, document.body.getElementsByTagName("*").length,
        [...document.querySelectorAll(".active")].map((el) => el.id || el.dataset.presetId || el.dataset.projId).join(","),
        document.getElementById("compare-projection-select").value]"""
    before = page.evaluate(snapshot)
    page.evaluate("() => { window.__app.rebuildUI(); window.__app.rebuildUI(); }")
    after = page.evaluate(snapshot)
    for label, a, b in zip(("text", "node count", "active buttons", "compare projection"), before, after):
        assert a == b, f"{label} changed after rebuildUI: {a!r} -> {b!r}"
    # Switching to the language already shown is the same no-op re-render
    page.evaluate("() => window.__app.setLanguage('en')")
    after = page.evaluate(snapshot)
    for label, a, b in zip(("text", "node count", "active buttons", "compare projection"), before, after):
        assert a == b, f"{label} changed after setLanguage('en'): {a!r} -> {b!r}"


def projection_title_pinned(page):
    """The list's title stays in view however far down the list is scrolled."""
    page.keyboard.press("Escape")
    title = "#projection-list > .section-title"
    before = page.locator(title).bounding_box()
    page.evaluate("() => { const list = document.getElementById('projection-list'); list.scrollTop = list.scrollHeight; }")
    after = page.locator(title).bounding_box()
    assert page.evaluate("() => document.getElementById('projection-list').scrollTop") > 0, "the list should scroll at this size"
    assert abs(before["y"] - after["y"]) < 2, f"the title moved: {before['y']} -> {after['y']}"


def language_choice(page):
    """The toolbar card and the welcome dropdown change every text, country
    names included, and the choice survives a reload."""
    assert page.input_value("#welcome-language-select") == "en"
    page.select_option("#welcome-language-select", "fr")
    page.wait_for_function("() => document.documentElement.lang === 'fr'")
    assert page.inner_text("#help-modal-title") == "Bienvenue sur Map Projektor !"
    page.keyboard.press("Escape")
    page.click("#compare-toggle-btn")
    page.fill("#compare-country-input", "allem")
    assert page.inner_text("#compare-country-results li") == "Allemagne", "search by the translated name"
    page.fill("#compare-country-input", "germany")
    assert page.inner_text("#compare-country-results li") == "Allemagne", "search by the English name too"
    page.click("#compare-country-results li")
    assert page.inner_text(".compare-country-name") == "Allemagne"
    page.click("#language-toggle-btn")
    page.click('.language-option[data-lang="en"]')
    page.wait_for_function("() => document.documentElement.lang === 'en'")
    assert page.inner_text(".compare-country-name") == "Germany", "a picked country follows the language"
    page.click('.language-option[data-lang="fr"]')
    page.wait_for_function("() => document.documentElement.lang === 'fr'")
    open_app(page)
    assert page.input_value("#welcome-language-select") == "fr", "the choice should survive a reload"
    assert page.inner_text("#help-modal-cta") == "C'est parti !"
    page.select_option("#welcome-language-select", "ar")
    page.wait_for_function("() => document.documentElement.lang === 'ar'")
    directions = page.evaluate("""() => ["help-modal", "sidebar", "map-tools"].map((id) => getComputedStyle(document.getElementById(id)).direction)""")
    assert directions == ["rtl", "rtl", "ltr"], f"text right to left, the page's layout kept: {directions}"
    assert page.locator("#sidebar").bounding_box()["x"] == 0, "the sidebar stays on the left"
    page.evaluate("() => localStorage.removeItem('mapProjektorLanguage')")


def mobile_drawer(page):
    page.set_viewport_size(MOBILE_VIEWPORT)
    open_app(page)
    page.keyboard.press("Escape")
    page.click("#sidebar-toggle")
    assert page.evaluate("() => document.getElementById('sidebar').classList.contains('open')"), "drawer should open"
    page.click("#sidebar-toggle")
    assert not page.evaluate("() => document.getElementById('sidebar').classList.contains('open')"), "drawer should close"


ONBOARDING_SCENARIOS = [onboarding_tour, onboarding_skip_and_escape, onboarding_mobile]
SCENARIOS = [welcome_modal, *ONBOARDING_SCENARIOS, view_survives_switch, africa_view, polar_route_and_flip, camera, tools_and_cards, country_drag, ui_rebuild, projection_title_pinned, language_choice, mobile_drawer]


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
                    if scenario not in ONBOARDING_SCENARIOS:
                        skip_tour(page)
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
