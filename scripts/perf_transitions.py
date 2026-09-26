"""Frame-timing regression check for every projection/recenter transition.

Drives the app in headless Chromium (Playwright), records requestAnimationFrame
timestamps during each transition, and compares avg/dropped-frame numbers
against a committed baseline (tests/perf_baseline.json).

Usage:
    poetry run python scripts/perf_transitions.py                # compare to baseline
    poetry run python scripts/perf_transitions.py --write-baseline # (re)write baseline
    poetry run python scripts/perf_transitions.py --headed        # watch it run
"""
import argparse
import json
import pathlib
import subprocess
import sys
import time

import httpx
from playwright.sync_api import sync_playwright

ROOT_DIR = pathlib.Path(__file__).parent.parent
BASELINE_PATH = ROOT_DIR / "tests" / "perf_baseline.json"
PORT = 8793
BASE_URL = f"http://127.0.0.1:{PORT}"

# Long enough to cover the slowest transition (the polar route: fold 800ms +
# spin 700ms + unfold 800ms = 2300ms), with margin.
WAIT_AFTER_CLICK_MS = 2800
# A frame later than this reads as a visible stutter (worse than 30fps).
DROPPED_FRAME_THRESHOLD_MS = 33
# How far a run may regress past the baseline before failing — generous
# because headless CI timing is noisy: back-to-back runs of identical code
# were observed to vary by ~6 dropped frames on the same transition.
REGRESSION_FACTOR = 1.15
# Hard ceiling independent of the baseline, so a slow baseline can't quietly
# become the norm (the old baseline sat at ~25ms without anyone noticing).
# Headless Chromium rasterises in software, so ~16.9ms (one 60Hz vsync, the
# floor measured on a pure-CSS transition) is the best case and the map's
# transitions land around 19-23ms; 24 catches real regressions without
# failing on that rendering overhead. On a real GPU expect well under 16.7.
MAX_AVG_FRAME_MS = 24


def dropped_frame_margin(baseline_dropped):
    return max(8, round(baseline_dropped * 0.3))


def start_server():
    proc = subprocess.Popen(
        ["poetry", "run", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(PORT)],
        cwd=ROOT_DIR, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    for _ in range(50):
        try:
            httpx.get(BASE_URL, timeout=1).raise_for_status()
            return proc
        except (httpx.HTTPError, httpx.ConnectError):
            time.sleep(0.2)
    proc.terminate()
    raise RuntimeError("server did not start in time")


def stop_server(proc):
    proc.terminate()
    try:
        proc.wait(timeout=10)
    except subprocess.TimeoutExpired:
        proc.kill()


def measure_transition(page, action_fn, wait_ms=WAIT_AFTER_CLICK_MS):
    page.evaluate(
        """() => {
            window.__frames = [];
            window.__recording = true;
            window.__zoomScales = [];
            const loop = (ts) => {
                if (!window.__recording) return;
                window.__frames.push(ts);
                window.__zoomScales.push(window.__app.currentZoomTransform.k);
                requestAnimationFrame(loop);
            };
            requestAnimationFrame(loop);
        }"""
    )
    action_fn()
    page.wait_for_timeout(wait_ms)
    page.evaluate("() => { window.__recording = false; }")
    frames = page.evaluate("() => window.__frames")
    scales = page.evaluate("() => window.__zoomScales")

    deltas = [b - a for a, b in zip(frames, frames[1:])]
    if not deltas:
        return {"frame_count": len(frames), "avg_frame_ms": 0, "max_frame_ms": 0, "dropped_frames": 0}

    result = {
        "frame_count": len(frames),
        "avg_frame_ms": round(sum(deltas) / len(deltas), 2),
        "max_frame_ms": round(max(deltas), 2),
        "dropped_frames": sum(1 for d in deltas if d > DROPPED_FRAME_THRESHOLD_MS),
    }
    # Smooth frames aren't enough for a zoom to look smooth: if the scale
    # jumps by a big step in one frame, it reads as choppy at any frame rate.
    zoom_steps = [abs(b / a - 1) for a, b in zip(scales, scales[1:]) if a and b != a]
    if zoom_steps:
        result["max_zoom_step_pct"] = round(max(zoom_steps) * 100, 1)
    return result


# One mouse-wheel notch as Chrome reports it on Windows/Linux (deltaMode 0,
# 100px); a trackpad sends many small deltas instead, which already look smooth.
WHEEL_NOTCH_PX = 100


def wheel_notches(page, count, direction, interval_ms=80):
    page.mouse.move(640, 450)
    for _ in range(count):
        page.mouse.wheel(0, direction * WHEEL_NOTCH_PX)
        page.wait_for_timeout(interval_ms)


def run_suite(page):
    """Every projection reached in sequence, then every recenter preset
    entered from and exited back to World View (mercator, the initial
    projection, is recenter-compatible — see RECENTER_INCOMPATIBLE)."""
    results = {}

    proj_ids = page.evaluate("() => __app.PROJECTIONS.map((p) => p.id)")
    current = page.evaluate("() => __app.currentProjectionId")
    chain = [pid for pid in proj_ids if pid != current] + [proj_ids[0]]
    for next_id in chain:
        label = f"projection: {current} -> {next_id}"
        results[label] = measure_transition(
            page, lambda nid=next_id: page.click(f'.proj-btn[data-proj-id="{nid}"]')
        )
        current = next_id
        page.wait_for_timeout(100)  # settle before the next recording starts

    preset_ids = page.evaluate("() => __app.RECENTER_PRESETS.map((p) => p.id)")
    for preset_id in [p for p in preset_ids if p != "world"]:
        results[f"recenter: world -> {preset_id}"] = measure_transition(
            page, lambda pid=preset_id: page.click(f'.recenter-btn[data-preset-id="{pid}"]')
        )
        page.wait_for_timeout(100)
        results[f"recenter: {preset_id} -> world"] = measure_transition(
            page, lambda: page.click('.recenter-btn[data-preset-id="world"]')
        )
        page.wait_for_timeout(100)

    # A recentre view now survives projection switches (the morph carries its
    # rotation), so that path needs its own coverage — it blends a rotated
    # projection pair, unlike every transition above.
    page.click('.recenter-btn[data-preset-id="china"]')
    page.wait_for_timeout(1200)
    current = page.evaluate("() => __app.currentProjectionId")
    for next_id in ["robinson", "orthographic", "mercator"]:
        results[f"view china: {current} -> {next_id}"] = measure_transition(
            page, lambda nid=next_id: page.click(f'.proj-btn[data-proj-id="{nid}"]')
        )
        current = next_id
        page.wait_for_timeout(100)

    # Camera zoom (the colleague's "zoom is a bit choppy" report): a burst of
    # wheel notches in then out, and the +/- buttons, on a flat projection.
    page.click('.recenter-btn[data-preset-id="world"]')
    page.click('.proj-btn[data-proj-id="robinson"]')
    page.wait_for_timeout(WAIT_AFTER_CLICK_MS)
    # The 100ms pauses let the previous recording's rAF loop see
    # __recording = false and stop, or two loops would double-count frames.
    results["zoom: wheel in"] = measure_transition(page, lambda: wheel_notches(page, 8, -1), wait_ms=600)
    page.wait_for_timeout(100)
    results["zoom: wheel out"] = measure_transition(page, lambda: wheel_notches(page, 8, 1), wait_ms=600)
    page.wait_for_timeout(100)
    results["zoom: buttons in"] = measure_transition(
        page, lambda: [page.click("#zoom-in-btn") or page.wait_for_timeout(250) for _ in range(4)], wait_ms=400
    )

    return results


def compare_to_baseline(results, baseline):
    regressions = []
    for label, current in results.items():
        if current["avg_frame_ms"] > MAX_AVG_FRAME_MS:
            regressions.append(f"{label}: avg frame {current['avg_frame_ms']}ms exceeds the {MAX_AVG_FRAME_MS}ms ceiling")
        base = baseline.get(label)
        if base is None:
            continue  # new transition, nothing to compare against yet
        if current["avg_frame_ms"] > base["avg_frame_ms"] * REGRESSION_FACTOR:
            regressions.append(
                f"{label}: avg frame {current['avg_frame_ms']}ms "
                f"vs baseline {base['avg_frame_ms']}ms (>{REGRESSION_FACTOR}x)"
            )
        margin = dropped_frame_margin(base["dropped_frames"])
        if current["dropped_frames"] > base["dropped_frames"] + margin:
            regressions.append(
                f"{label}: {current['dropped_frames']} dropped frames "
                f"vs baseline {base['dropped_frames']} (+{margin} margin)"
            )
    return regressions


def print_report(results):
    for label, m in results.items():
        print(f"  {label:55s} avg={m['avg_frame_ms']:>6.2f}ms  max={m['max_frame_ms']:>7.2f}ms  "
              f"dropped={m['dropped_frames']:>2d}  frames={m['frame_count']:>3d}"
              + (f"  max zoom step={m['max_zoom_step_pct']}%" if "max_zoom_step_pct" in m else ""))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write-baseline", action="store_true", help="record current results as the new baseline")
    parser.add_argument("--headed", action="store_true", help="run with a visible browser window")
    args = parser.parse_args()

    server = start_server()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=not args.headed)
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            page.goto(BASE_URL)
            page.wait_for_selector("path.country")
            # The welcome modal opens on every launch and overlays the whole page,
            # which would intercept every click in the suite.
            page.click("#help-modal-close")
            page.wait_for_timeout(300)  # let the initial render settle

            print("Running transition suite...")
            results = run_suite(page)
            browser.close()
    finally:
        stop_server(server)

    print_report(results)

    if args.write_baseline:
        BASELINE_PATH.write_text(json.dumps(results, indent=2, sort_keys=True) + "\n")
        print(f"\nBaseline written to {BASELINE_PATH}")
        return 0

    if not BASELINE_PATH.exists():
        print(f"\nNo baseline at {BASELINE_PATH} yet — run with --write-baseline first.")
        return 1

    baseline = json.loads(BASELINE_PATH.read_text())
    regressions = compare_to_baseline(results, baseline)
    if regressions:
        print("\nPERFORMANCE REGRESSIONS:")
        for r in regressions:
            print(f"  - {r}")
        return 1

    print("\nNo regressions vs baseline.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
