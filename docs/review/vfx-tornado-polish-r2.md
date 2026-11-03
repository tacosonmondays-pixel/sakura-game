# Review: tornado polish, round r2 (`feature/vfx-tornado-polish`)

- **Reviewed head:** `81265de1` (boards), with the code, tests and docs in `aa7f094c`. Delta reviewed: `git diff aa7f094c^ 81265de1` (`aa7f094c^` = `d7a6bd1b`, the r1 head).
- **Scope:** only this delta, against the r1 review (`docs/review/vfx-tornado-polish-r1.md` on `review/vfx-tornado-polish-r1`): MEDIUM 1, LOW 1 and NIT 2. NIT 1 (patch-note draft) is out of scope for this round.
- **Reviewer:** independent; I did not build this branch. Every figure below is my own measurement; I did not rely on the commit messages.

## Verdict: OK

MEDIUM 1 is fixed. On the portrait (phone) camera, high under Reduce Motion now reads as one small funnel, the same shape as on the landscape camera, where before it was two walls over a bowl. The landscape camera, normal play and medium are the same pixels as before. What stands behind the column keeps at least medium's documented floor on both cameras. The code is correct on every camera the game uses. The new test fails under every mutation I tried. The sim id is unchanged. The two findings below are LOW and NIT and do not block.

## Findings

### LOW 1: on the phone, high under Reduce Motion now hides more of what stands near the column than medium does on the same camera (documented in figures, not in words)

- On the portrait camera, before this delta, the far arc was gone. So high under Reduce Motion showed nearly everything behind it: 0.85 / 0.92 / 0.97, centre 0.59 (my lab, all stand-in pixels).
- Now the phone sees the landscape camera's funnel, so it keeps what the landscape camera keeps:

  | camera | config | 0.9 tiles | 1.2–1.6 | 2.0–2.4 | centre |
  |---|---|---|---|---|---|
  | landscape | high RM | 0.16 | 0.27 | 1.00 | 0.27 |
  | portrait | high RM | 0.18 | 0.27 | 1.00 | 0.26 |
  | portrait | medium RM | 0.27 | 0.42 | 0.62 | 0.57 |

  These are in-column medians, t = 2.4 and 2.8 s.
- That is still at or above medium's documented floor from the landscape lab (0.11 / 0.27 / 0.56, centre 0.15). By the r1 rule it passes.
- But the `RM_COVER` comment says a fully-up column "must stay at least as readable as on medium". On the phone, high is below medium at 0.9 tiles and in the centre (0.18 vs 0.27, 0.26 vs 0.57).
- The builder's own figures in `docs/VFX.md` show this too (portrait 0.12 / 0.42 / 0.98, centre 0.29, against medium 0.22 / 0.46 / 0.65, centre 0.44). The text explains it: medium on the phone still uses the world's front, so it sees the column from the side. But the text never says plainly that high under Reduce Motion is below medium on the phone.
- The trade is reasonable: a real funnel instead of two streaks, and the deferred world-front round will move medium's phone numbers anyway.
- **Fix (docs only, can ride with the next round):**
  - Add one sentence to "What stands behind": on the portrait camera, high under Reduce Motion keeps less than medium at 0.9 tiles and in the centre, because medium there is still seen from the side.
  - Qualify the `RM_COVER` comment to "at least medium's floor on the landscape camera".
  - I did not re-measure the builder's alternatives (a) arc-weighted erosion and (b) `all` at 0.11. They are recorded as hiding more on the landscape camera. That claim is the builder's and is unverified here.

### NIT 1: the "court cast" rows of both boards mostly show the boss HP bar

- In `vfx-tornado-rm-board.jpg` row 2 and `vfx-tornado-polish-board.jpg` row 1, the crop puts the top of the column under the boss bar. The cells add little.
- The phone rows and the "court fire" rows carry the change honestly, so this is cosmetic.
- **Fix:** shift the crop down next time the boards are shot.

### Carried from r1

- **r1 LOW 1 (yellow-green on `#8fbf62`): improved on the phone, unchanged on landscape, still an owner call.** Figures are below. Not worse anywhere; I accept it as the documented residual.
- **r1 NIT 2: fixed.** The rm board is 238 KB and the polish board is 208 KB.

## Checks

### 1. MEDIUM 1: one funnel on the phone, landscape unchanged

Two setups, each run on `d7a6bd1b` (extracted with `git archive`) and on `81265de1`:

- **In game:** `tools/vfx/capture.mjs --reduce-motion --events tornado-fire@120` on Sakura Court. The phone is 390x844 at dpr 3; the PC is 1280x720.
- **Lab:** a temporary copy of `previews/attacks.html` with Reduce Motion from the query string. Akane focus, a fire column of size 1.2, stepped at 1/60 s. The copy was not committed and has been deleted.
  - The column mask is where the tornado mesh changes the frame (mesh on vs off, ΔRGB > 24).
  - "Pieces" counts the connected parts holding more than 2 % of the mask.

| camera, high RM | t (s) | before: largest piece / pieces | after: largest piece / pieces | right/left |
|---|---|---|---|---|
| portrait | 1.6 | 0.75 / 3 | 0.92 / 2 | 1.27 → 0.87 |
| portrait | 2.4 | 0.66 / 4 | 0.98 / 1 | 1.24 → 0.83 |
| portrait | 2.8 | 0.68 / 4 | 0.98 / 1 | 1.28 → 0.82 |
| portrait | 3.2 | 0.68 / 5 | 0.95 / 2 | 1.28 → 0.82 |
| landscape | 2.4–3.2 | 0.96–0.98 / 1 | identical | 0.79–0.82 |

- **Portrait, after:** the shape metrics now match the landscape camera's (largest piece 0.98, right/left 0.82 vs 0.81). It is the same funnel.
  - In game (`portrait-390.jpg`, row 2 vs row 1), the check-mark of two walls is gone. The column reads as one small, slightly lopsided funnel from t = 1.0 s, exactly like the landscape cells.
  - Medium under Reduce Motion (row 3) is still larger. The size gap is r1's documented cost, not part of this delta.
- **Landscape unchanged:** in the lab, the frame hashes at all six times are identical before and after, and `uYaw` is 0.
  - In game (`landscape-1280.jpg`, rows 1 and 2), the tornado region (480–780 × 330–590) has 0 differing pixels at every shot. The only differing pixels are in the HUD, outside the column.
- **Normal play unchanged on the phone:** the high, normal-play lab hashes on 390x844 are identical before and after at all six times. The shader gates the yaw on `uRm.x > 0`.
  - Medium shows `uRm` (0, 0), so the shader ignores `uYaw` there too.

### 2. What stands behind

See LOW 1 for the table.

- The stand-ins are dark boxes 0.3 × 0.9 × 0.3 tiles at 0.9, 1.4 and 2.2 tiles behind the centre (away from the camera) and ±0.35 tiles to the side, plus one in the centre, at t = 2.4 and 2.8.
- The "contrast kept" is the box's contrast with the column on, divided by its contrast with the column off. It is taken over the box pixels where the column is drawn.
- Landscape, before and after: 0.16 / 0.27 / 1.00, centre 0.27. Portrait, after: 0.18 / 0.27 / 1.00, centre 0.26.
- Both are at or above medium's documented floor (0.11 / 0.27 / 0.56, centre 0.15), and well above high without the erosion (0.01 / 0.19 / 0.37). They agree with `docs/VFX.md`'s new figures to within the method's spread.

### 3. LOW 1: yellow-green on `#8fbf62`

- **Method:** an unlit `#8fbf62` plane under the column. The figure is the share of column pixels (ΔRGB > 40 vs mesh off) with hue 66–95°, saturation > 0.2 and value > 0.25.

| camera | config | t = 1.2 | fully up (2.8) |
|---|---|---|---|
| landscape | high RM, before = after | 0.19 (upper half 0.23) | 0.12 |
| landscape | high normal | 0.13 | 0.12 |
| portrait | high RM, before | 0.36 (upper half 0.50) | 0.25 |
| portrait | high RM, after | 0.24 (upper half 0.33) | 0.14 |
| portrait | high normal | 0.08 | 0.08 |
| portrait | medium RM | 0.00 | 0.00 |

- The phone improved by about a third and landscape is unchanged. Fully up, Reduce Motion on landscape now equals normal play.
- The rising column on the phone (0.24 vs normal 0.08) is still the worst cell. These figures match the builder's (0.19 / 0.12 landscape, 0.24 / 0.14 portrait).
- It stays an owner call for the lake and shrine maps by day. On Sakura Court's own grass, the in-game frames show no lime cast on either camera.

### 4. Code: `uYaw`

- **The formula.** `uYaw = (atan2(uView.y, uView.x) − π/2) / 2π`, and the noise angle is `u = atan(z, x)/2π + vRnd − uYaw`.
  - Landscape camera (yaw 0, camera at +z): `uView` = (0, 1), so `uYaw` = 0. Same pixels.
  - Portrait camera (`CameraRig` yaw π/2, camera at +x): `uView` = (1, 0), so `uYaw` = −0.25. The camera-facing point (angle 0) reads noise u = 0.25 + vRnd, the same value as the landscape camera's facing point (angle π/2). A rotation keeps left and right, so the same tongues land in the same places on screen. Confirmed by the pictures and the metrics above.
  - The other rotation (camera at −x, only reachable through `forceYaw`) gives +0.25, and the test pins it.
  - The `atan` seam stays seamless for any offset, because the jump of one turn times the whole-number `vF.x` (and 2·`vF.x` in the second sample) is still a whole number.
- **Straight down.** No camera in the game looks straight down: `PITCH` is a constant 48° in `src/render/camera.js`. Even so, a straight-down camera keeps the last `uView` and `uYaw` (guard `l > 1e-4`), and the test pins this.
- **Set every render.** `uYaw` is set in `onBeforeRender` together with `uView`, from the camera that draws the mesh, so a second camera or the composer's pass is also correct. The tornado mesh does not cast shadows, so no shadow camera calls it.
- **No allocation.** `_dir` is reused, and the scalar `Math.atan2` allocates nothing.
- **No `Math.random`.** `git grep Math.random -- src/render` finds only a comment.
- **Visual clock and Reduce Motion.** The delta adds no time source. The yaw takes effect only under Reduce Motion on high (`uRm.x > 0`), where the noise scroll is already stopped.
- **0 draw calls when idle.** A wrapped `onBeforeRender` counted 0 renders over 60 frames after the column had gone, on every lab config (renderer totals: 43 on high, 22 on medium).
- **Flash guard unaffected.** No sprite, flash or `screenFlash` change; the delta touches only the ring shader and its uniform.

### 5. Tests

- `npx vitest run --maxWorkers=2 tests/render`: 55 files, **633 passed** (r1: 632, plus the new test).
- **Mutation checks** on `src/render/vfx/tornado.js`, restored afterwards. Each one fails the new test (1 failed, 16 passed):
  - the yaw term removed from the shader;
  - `uYaw` never set;
  - the sign of the yaw flipped in the shader;
  - the `uRm.x > 0` gate removed (yaw applied in normal play too).
- **Limit:** the shader-side checks are regexes on the GLSL source, so they pin the text rather than the behaviour. The JS-side numbers (0, −0.25, +0.25, straight-down keeps the last value) are behavioural. That is the usual level for this layer, and the frames above cover the behaviour.

### 6. Boards

- `docs/art/previews/vfx-tornado-rm-board.jpg` (238 KB, 1440x1066) and `vfx-tornado-polish-board.jpg` (208 KB, 1200x1126) are both under 250 KB.
- **They are honest.**
  - The phone rows show r1's two streaks next to the new single funnel.
  - The landscape cells marked "same pixels" match my pixel-identical result.
  - Medium and high in normal play are shown unchanged next to them.
- The labels name the commits.
- See NIT 1 for the crops.

### 7. Display only

- `node -e "import('./tools/simId.mjs').then(m=>console.log(m.simId().id))"` prints `e4001588f40b`, unchanged, so no `COOP_PROTOCOL` bump is needed.
- The delta touches only `src/render/vfx/tornado.js`, `tests/render/vfx-tornado.test.js`, `docs/VFX.md` and the two preview JPGs.

## Evidence

- `docs/review/vfx-tornado-polish-r2/portrait-390.jpg`: Sakura Court at 390x844, dpr 3, Reduce Motion, t = 0.5 / 1.0 / 1.6 / 2.3 s. Rows: before high, after high, after medium.
- `docs/review/vfx-tornado-polish-r2/landscape-1280.jpg`: the same layout at 1280x720. Before and after are pixel-identical on the column.
