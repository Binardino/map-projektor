# PR 3 — Projection capabilities, TIMING, config, tokens (items 3, 4, 7)

Purpose: make "adding a projection = one object" true again, and put every tunable number and colour in
one named place. Behaviour identical (render fingerprint from PR 1 proves it). Branch: `refactor/registry-config`.
Size: medium, ~1–2 days.

## Subtasks

1. **`getProjection(id)`** in `data/projections.js`; replace the ~20 `PROJECTIONS.find((p) => p.id === …)`.
   Throws on an unknown id (fail loudly) instead of returning `undefined` to be dereferenced later.
   Done when: no `.find((p) => p.id ===` left; unit test covers known/unknown id.
2. **Capability fields on each projection object**, replacing id checks scattered in the code:

   | Field | Default | Replaces |
   |-------|---------|----------|
   | `clipAngle` | `179.9` | `clipAngleOf()` (`orthographic` → `90`) |
   | `polarRotation` | none | `POLAR_ROTATION` map (`polarNorth: [0,-90]`, `polarSouth: [0,90]`) |
   | `recenterable` | `true` | `RECENTER_INCOMPATIBLE` set (`false` for albers, polarNorth, polarSouth) |
   | `fit` | `"sphere"` | `projDef.id === "mercator"` in `fitProjection` (`"width"`) |
   | `globe` | `false` | 5 × `=== "orthographic"` (background, drag-rotate, zoom filter, panel background, polar route hub) |

   - `polarTransition`'s hub projection becomes `PROJECTIONS.find((p) => p.globe)`; the polar route's "is polar"
     test becomes `!!proj.polarRotation`.
   - The compare panels' default right-hand projection (`gallPeters` fallback logic) moves to
     `config.DEFAULT_COMPARISON_PROJECTION`.
   - Done when: `grep -nE '"(orthographic|mercator|polarNorth|polarSouth|albers)"' static/js` only hits `data/` and
     `tests/`; render fingerprint and e2e unchanged.
3. **Registry invariants test** (`tests/js/projections.test.js`): every entry has `id`, `family`, `d3fn` (function),
   unique ids; exactly one `globe`; every `polarRotation` projection has `recenterable: false`; every family has a
   `family.*` key in `en.json`.
   Done when: adding a malformed projection makes the test fail with a readable message.
4. **`TIMING` object in `config.js`** replacing inline durations:

   | Key | Value | Used by |
   |-----|-------|---------|
   | `projectionMorph` | 1400 | regular blend |
   | `polarFold` / `polarUnfold` | 800 / 800 | polar route legs |
   | `polarSpin` | 700 | globe spin between poles |
   | `recenterRotation` | 900 | view rotation |
   | `recenterFlipHalf` | 300 | fold, then unfold |
   | `recenterFlip` | 600 | `animateRecenterFlip` default |
   | `cameraReset` | 500 | `resetCamera` |
   | `zoomButton` | 200 | ± buttons |
   | `countryFocus` | 600 | selection pan/zoom (main + panel) |

   - The perf harness's `WAIT_AFTER_CLICK_MS` is derived from the polar total so it can never drift from the code.
   - Done when: no numeric duration literal remains in `core/` and `ui/`; perf harness unchanged.
5. **Other constants into `config.js`**: `LIGHT_MIN_SPACING_DEG`, `POLE_LIMIT`, zoom extents/step,
   `CAMERA_IDENTITY_EPSILON`, `GLOBE_DRAG_SENSITIVITY`, Tissot step/radius, `EARTH_RADIUS_KM`, storage keys,
   data URLs (`/data/world.geojson`, `/data/terrain.geojson`, `/static/i18n/`), `MOBILE_MAX_WIDTH`.
   Each keeps its explanatory comment.
6. **Colours into CSS tokens** (item 7):
   - Audit first: list every hex/`rgb(a)` outside `:root` in `style.css`, and the JS palette.
   - `TRUESIZE_PALETTE` → `--truesize-1 … --truesize-8` in `:root`, read once with `getComputedStyle` by the tool;
     compare highlight (`#fa6048`) and terrain kind colours become tokens too. Dark theme gets its own values
     where contrast needs it.
   - Done when: `grep -nE '#[0-9a-fA-F]{3,8}' static/js` is empty and the only hex left in CSS is inside the two
     theme blocks; screenshots at launch in both themes unchanged.
7. **Single source for the mobile breakpoint**: `MOBILE_MAX_WIDTH = 768` in `config.js`, used via `matchMedia`;
   CSS media queries cannot read variables, so `tests/test_breakpoint.py` asserts the CSS literal equals the config
   value (fails if they drift).
8. **Docs**: "Adding a Projection" lists the capability fields with their defaults; changelog.

## Risks

- `fit: "width"` must reproduce the exact Mercator framing; the render fingerprint covers all 17 projections.
- Renaming the `family` label is out of scope (grouping identifier stays).
