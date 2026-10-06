# PR 4 — State module with subscriptions + idempotent UI (item 5)

Purpose: replace scattered globals with one observable store and a small event bus, so the UI can re-render
itself (language switch) and tools stop being called directly from the core. Branch: `refactor/state-events`.
Size: large, ~2 days.

## Design

`static/js/state.js` (~60 lines, pure, unit-tested):

```js
getState()                       // read-only snapshot
setState(patch)                  // merges, emits ONCE per patch, only for keys whose value changed
subscribe(keys | "*", fn)        // returns an unsubscribe function
emit(event, payload) / on(event, fn)   // non-state signals
```

State slices and their single writer (others only read/subscribe):

| Slice | Writer |
|-------|--------|
| `projectionId`, `busy` | `core/transition.js` (via `runExclusive`) |
| `recenter: { rotation, flip }` | `core/recenter.js` |
| `camera: { transform }` | `core/camera.js` |
| `selectedCountry` | `core/selection.js` |
| `language` | `i18n.js` |
| tool flags (`tissotVisible`, …) | each tool |

Events: `frame` (payload: the live projection, emitted by every animation loop), `transition:end`,
`projection:changed`, `language:changed`.

Geodata (`worldData`, `terrainData`) is not state: it moves to `data/geodata.js` (`loadGeodata()` once, then read-only).

## Subtasks

1. **`state.js` + `tests/js/state.test.js`**: subscribe/unsubscribe, one emit per patch, no emit when nothing
   changed, a throwing subscriber does not stop the others, wildcard subscription.
   Done when: tests pass and mutating a returned snapshot does not change the store.
2. **Retire `core/legacy-state.js` (from PR 2) slice by slice**, one commit per slice, in the order
   projection/busy → recenter → camera → selection → geodata. Done when: the file is deleted and the gate is green.
3. **`runExclusive(fn)`**: one place that sets `busy`, runs the async work and clears it in `finally`.
   Replaces three hand-written `isAnimating = true … false` pairs (`transitionTo`, `applyRecenter`,
   `animateRecenterFlip` paths). Fixes a latent bug: an exception mid-animation currently leaves `isAnimating`
   stuck at `true` and the whole UI locked.
   Done when: a unit test with a throwing task shows `busy` returns to `false`.
4. **Decouple core from tools with events**: the per-frame `updateTissotPaths` call becomes a `frame` subscriber
   registered by the Tissot tool; `refreshTissot`, `refreshFlightPath`, `resetTrueSizeOnProjectionSwitch`
   become `transition:end` / `projection:changed` subscribers. The core no longer imports `tools/`.
   Done when: `tests/js/layering.test.js` (PR 2) still passes and `core/` has zero imports from `tools/`.
   Perf guard: `frame` listeners are plain callbacks in an array (no DOM events); harness must stay within
   1.15× of the PR 3 numbers.
5. **Idempotent UI builders**: `buildSidebar`, `buildRecenterPanel`, `buildCompareProjectionOptions`,
   `renderTradeoffs` and `updateInfo` each *replace* their container's children and derive the "active" state
   from `getState()` instead of imperative `setActiveButton` calls. UI modules subscribe to
   `language:changed` / `projectionId` / `recenter` and re-render themselves.
   Done when: `__app.rebuildUI()` called twice leaves the text snapshot identical and the DOM node count stable.
6. **`language:changed` plumbing without the picker**: `setLanguage(lang)` in `i18n.js` reloads messages, updates
   state, emits the event. The picker UI itself is the next backlog item (Feature 31, subtask 2).
   Done when: `__app.setLanguage("en")` is a no-op re-render and the e2e smoke test exercises it.
7. **Docs**: state ownership table into `CLAUDE.md`; changelog.

## Risks

- Re-entrancy: a subscriber calling `setState` inside a notification. Rule: notifications are queued and flushed
  after the current patch (documented in `state.js`, covered by a test).
- Render loops must not subscribe to state per frame; they read `getState()` once at start.
- Ordering bugs at boot (subscriber registered after the first `setState`): `main.js` registers subscribers first,
  then loads geodata and sets the initial state; recorded in the PR description.
