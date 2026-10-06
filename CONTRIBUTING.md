# Contributing to Map Projektor

Thanks for your interest. This is a small project: a FastAPI server that serves one page, and a D3 frontend written as plain ES modules (no framework, no bundler, no npm).

## Setup

You need Python 3.10+, [Poetry](https://python-poetry.org/) and Node.js (only to run the JS unit tests).

```bash
poetry install
poetry run playwright install chromium   # once, for the browser checks
poetry run uvicorn app.main:app --reload
```

Open [http://localhost:8000](http://localhost:8000). The page reloads the JS and CSS on every refresh, so there is no build step.

## Where things live

```
app/
  main.py               FastAPI app: the page, the two GeoJSON files, static files
  data/                 world.geojson, terrain.geojson (generated, committed)
static/
  css/style.css         Theme (CSS variables in :root) and layout
  i18n/en.json          Every user-visible string
  js/
    main.js             Entry point: imports the modules, then init()
    config.js           Durations and other tunable numbers
    state.js            Store and events shared by all modules
    i18n.js             t("key") and the data-i18n attributes
    data/               Projection registry, recenter views, GeoJSON loader
    core/               Scene, rendering, animation, camera, selection
    ui/                 Sidebar, cards, welcome modal, tour, theme
    tools/              Distortion grid, reference lines
templates/index.html    Page structure
scripts/                Data pipeline and the Playwright checks
tests/                  pytest, JS unit tests (tests/js/), golden files
```

Modules import downwards only: `data` < `core` < `ui` and `tools` < `main.js`. Core never imports `ui/` or `tools/`: it writes the store and emits events, and they subscribe. A test enforces this, and another checks that every module has its `<link rel="modulepreload">` in `index.html`.

## Adding a projection

Two files change, nothing else.

1. Add one object to the `PROJECTIONS` array in `static/js/data/projections.js`:

   ```js
   {
     id: "myProjection",
     family: "Cylindrical",   // an existing family, or a new one (see below)
     year: 1900,
     description: "What it does and why it matters.",
     d3fn: () => d3.geoMyProjection(),
   }
   ```

   Behaviour that differs between projections is declared on the object (`globe`, `clipAngle`, `fit`, `polarRotation`, `recenterable`, `tilted`), never tested by id elsewhere in the code. The defaults and what each field means are in `PROJECTION_DEFAULTS`, at the top of the same file.

2. Add its texts to `static/i18n/en.json`:

   ```json
   "projection.myProjection.name": "My Projection",
   "projection.myProjection.preserves": "...",
   "projection.myProjection.distorts": "...",
   "projection.myProjection.bestFor": "..."
   ```

   A new family also needs its label: `"family.<lowercase name>": "..."`.

`poetry run pytest` fails if a key is missing, and the JS tests check the registry (unique ids, family labels). A new projection changes two golden files on purpose: regenerate them with `scripts/ui_text_snapshot.py --write` and `scripts/render_fingerprint.py --write`, and commit them with the projection.

## Texts

No user-visible string is written in the JS modules or in `index.html`. Add a key to `static/i18n/en.json`, then read it with `t("key")` in JS or with a `data-i18n="key"` attribute in the markup. English is the source language and the only one for now.

## Checks

Before opening a pull request:

```bash
scripts/check_all.sh
```

It runs everything below in order and stops at the first failure:

| Check | Command |
|---|---|
| Server routes, i18n key coverage | `poetry run pytest -v` |
| JS unit tests | `node --test 'tests/js/*.test.mjs'` |
| Every visible string in 13 UI states | `poetry run python scripts/ui_text_snapshot.py --check` |
| Drawn paths for each projection and view | `poetry run python scripts/render_fingerprint.py --check` |
| Main user paths, no page error | `poetry run python scripts/e2e_smoke.py` |
| Transition frame times against a baseline | `poetry run python scripts/perf_transitions.py` |

GitHub Actions runs the first two on every pull request (`.github/workflows/tests.yml`); the browser checks and the perf harness only run on your machine.

Keep the quotes around the JS test glob. The perf numbers come from headless Chromium and vary between machines: if it fails on a change that does not touch rendering or animation, run it again on `main` before suspecting your change.

If your change is visible in the UI, regenerate the README images with `poetry run python scripts/capture_readme_assets.py` (the GIF needs `ffmpeg`).

## Pull requests

- One topic per branch, small commits that each do one thing
- Code, comments and documentation in English; comments explain why, not what
- Add an entry to `CHANGELOG.md`
