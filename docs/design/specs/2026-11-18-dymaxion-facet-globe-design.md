# Dymaxion: the globe facets into the icosahedron — Design Spec

Date: 2026-11-18

## Goal

Going to Dymaxion, the round globe currently *crossfades* (300 ms, `TIMING.polyhedralFade`) into the closed icosahedron, which then turns and unfolds. The fade has no in-between shape: nothing visibly turns round into hexagonal. Replace it with a real deformation: the sphere gradually becomes the solid, then the existing turn + unfold plays unchanged. The way back plays the same film in reverse.

## Non-goals

- The turn and unfold (`animateNet`, `frame(turn, open)`) are not touched.
- No change to the aspect route, the polar route or any other projection pair.
- No new setting, no user control over the duration beyond one `TIMING` entry.

## Approaches considered

- **A. Facet the globe in 3D (chosen).** Each of the 24 faces is cut into small triangles. Every vertex travels from its place on the sphere to its place on the closed solid; the map's own image is the texture, so the content follows the shape.
- **B. Morph only the outline** (circle → hexagon) with a fade for the content. Cheap, but it reads as a shrinking mask and the content still jumps. Rejected.

## Design

1. **Facets (pure maths, `core/polyhedral-unfold.js`).** `buildNet` additionally returns the facets: each face's own spherical triangle split n × n (n = 6, so a facet spans ~10° and the silhouette's deviation from a circle stays under ~1.5 px). For each facet vertex we keep
   - its **texture point** on the finished map (projected through its own face, nudged into it exactly as `onMap` already does for corners),
   - its **sphere position** (the globe's `onGlobe`, a 3D point),
   - its **solid position** (the face's placement in `frame(0, 0)`, 3D).
   `facetsAt(u)` lerps sphere → solid, `u` 0 → 1. At `u = 1` every facet vertex is exactly where `frame(0, 0)` puts it, so the hand-over to the existing net is pixel-identical.
2. **Drawing (`core/animation.js`).** One `<canvas>` inside a `<foreignObject>` in the viewport (so it shares the camera, like the net group). Per frame: skip back-facing facets (the surface stays convex, so culling is exact and no depth sort is needed), then draw each facet as the map image clipped to its triangle under an affine transform. Same seam trick as `NET_SEAM` (clip grown by ~0.6 px) against hairlines.
3. **Sequence, towards Dymaxion.** true globe (SVG) → canvas at `u = 0` replaces it → `u` 0 → 1 (new `TIMING.polyhedralFacet`, ~700 ms, ease in-out) → canvas removed, net shown at `frame(0, 0)` → `animateNet(0 → 1)` as today. Away from Dymaxion: `animateNet(1 → 0)`, then the facets run `u` 1 → 0, then the true globe replaces the canvas.
4. **`polyhedralFade` goes away**: its only job (the crossfade) is replaced. The two `crossfade` calls in `polyhedralTransition` go with it; the function stays if still used elsewhere.

## Assumptions to check first (spike while implementing)

- The 24 pieces are all triangles (3 `corners`). If a split face's piece is not, facets are built from its polygon fan instead.
- At `u = 0` the facet globe must be visually indistinguishable from the real orthographic globe (affine texture per ~10° facet is close but not exact). If a seam or jump shows at the swap, add a ~100 ms crossfade at that one point only.
- `<canvas>` in `<foreignObject>` under the viewport's zoom transform: verified in Chromium (the only browser the test scripts drive). Not verified in Safari. Fallback if it misbehaves: SVG `<image>` per facet (heavier).

## Verification

- `node --test`: the facet triangulation (counts, every vertex on the face, `u = 1` equals `frame(0, 0)`), and the culling rule, as pure functions.
- `scripts/e2e_smoke.py`: the `polyhedral_route` check also waits for the canvas mid-route and asserts nothing is left behind afterwards (canvas gone, `g.world` opacity cleared), both ways.
- Frame captures at `u` = 0, 0.25, 0.5, 0.75, 1 to look at the result.
- `perf_transitions.py`: the two Dymaxion pairs get longer, so the baseline for them is rewritten with `--write-baseline` (it is a deliberate change).
- `ui_text_snapshot` and `render_fingerprint` should stay green: the rest state is unchanged.
