# Review r2: feature/tripo-batch-2 @ 19c69bf8 (delta 7fcd93eb → 19c69bf8)

Fresh clone, independent reviewer. Scope: the r1 follow-up commit (M1, L1–L4, I1), with the risk focus the
coordinator asked for: I1 context loss across screen cycles, M1 visuals at night and in a blackout, L3 LOD selection,
the L2 head, and the sim. Round 1 is `docs/review/tripo-batch-2/review-r1.md` on `review/tripo-batch-2-r1`.

**Verdict: OK to merge.** Every r1 item is fixed as claimed, and I1 is a real improvement with no regressions I could
find: on 7fcd93eb the battle contexts hit Chrome's 16-context cap within 3 cycles, and on the branch only one stays
live. The sim id is unchanged, and all suites pass in a clean run. There are two Lows:

* **L1-r2:** the new landmark test has no timeout margin. It timed out once while a Playwright probe was competing
  for CPU, and `npm test` gates the deploy. The fix is one line, worth making with the merge.
* **L2-r2:** after a medium or low battle the bestiary shows the LOD enemies.

The rest is Info.

## Findings

| # | Sev | Where | Finding | Fix |
|---|---|---|---|---|
| L1-r2 | Low | `tests/render/tripoLandmarks.test.js:41` (closing `});` at `:74`) | One `it` builds 7 stages × 2 looks (14 full map builds plus the swaps) under vitest's default **5 s** timeout. Alone it takes 2.3 s; with four CPU hogs, 3.9 s. In my first full `npm test` (parallel workers, with a Playwright probe also running) it **timed out at 5.66 s**: 1 failed, 6762 passed. A clean rerun passed (6763 passed), so it is a margin problem, not a defect. `.github/workflows/deploy.yml:33` runs `npm test` before every deploy, so a slow runner turns this into a flaky deploy gate. | Give it a timeout as the repo already does: `}, 60000); // 14 map builds: past vitest's 5 s default on a loaded machine` (precedent: `tests/render/heldFx.test.js:68`). Or split it per stage with `it.each(STAGE_IDS)`. |
| L2-r2 | Low | `src/models/glbEnemy.js:80-91` (module-global `enemyDetail`), set only at `src/ui/battle/controller.js:288` | The enemy detail level is set when a battle starts and is never reset, so it leaks into the **bestiary** (`src/ui/screens/bestiary.js:269` preload, `:68` thumbnails, `:334` close-up built at `quality: 'high'`). In my probe: a medium battle, then Settings → High, then the bestiary. `getEnemyDetail()` is still `'lod'`, and the bestiary requested only the boss files: the 12 family enemies are shown with their cached 2k-triangle, 256² LOD. Preload and build still agree (no double download), so this is cosmetic. But the close-up viewer, which asks for "high", shows the light file after any medium or low battle. | In `bestiary.js` `render()` (before the preload at `:269`), call `setEnemyDetail(detailFor(store.profile.settings?.quality \|\| 'high'))`. Or use `'full'`, since it is a close-up viewer. Either way, preload and build keep asking for the same file. |
| I1-r2 | Info | `src/models/viewer.js:229` (student page 3D view; pre-existing) | Now that BattleRenderer loses its context, the only detached WebGL contexts that stay live are the student page's 3D viewers: one per visit, three after my three cycles. `createModelViewer`'s `dispose()` calls `renderer.dispose()` but not `forceContextLoss()`. This is not this branch's change. | Optional: the same `try { renderer.forceContextLoss(); } catch {}` after `renderer.dispose()` in `viewer.js`, as the lobby engine, BattleRenderer, `bossArt.js` and `bestiary.js` do. |
| I2-r2 | Info | `docs/art/tripo/batch-2.md` (table row 21) | The row still gives the head as "159,740 B, 3,000 tris". The rebuilt file is 159,668 B. | Update the byte count when convenient. |
| I3-r2 | Info | `src/render/terrain.js:681-693` | "Only four types have glow" holds for the story placements, not for the props in general. `buildProp` gives **doorieStatue** 36 glow verts on the city theme but none on vesper (its only story stage, 6-8). **finishGantry** has 36 glow verts but no story stage places it. The fix is generic (`userData.glow` on any glow mesh in a landmark group), so both are covered if they ever appear. | None. |
| I4-r2 | Info | `src/render/BattleRenderer.js:1585-1597` | The coordinator's summary says the shared-cache clears were "moved before dispose". In 7fcd93eb they were already before `renderer.dispose()`. This commit only adds the `forceContextLoss()` try/catch (the commit message itself does not claim a move). The order is right. | None. |

## 1. I1: `forceContextLoss()` after `renderer.dispose()` (the riskiest change)

**Code.** Each battle owns its `WebGLRenderer` and canvas (`BattleRenderer.js:157-170`). The canvas is removed right
after the context loss and never reused. Nothing else listens for `webglcontextlost` on it: the lobby engine listens
only on its own canvas (`src/ui/lobby/live/engine.js:346`). The shared prop caches are cleared before the dispose
(`liveRenderers === 0`). When two renderers overlap (restart, co-op rebuild) the caches survive, and the new renderer
uploads its own copies. A three.js object disposed later on a lost context is a no-op. This is the same pattern
`engine.js:494`, `bossArt.js:66` and `bestiary.js:60` already use.

**Probe** (my own Playwright script, not committed; SwiftShader, 844×390). It wraps `getContext` and
`create*/delete*` on every WebGL context to count live objects per context, decodes each canvas from a screenshot
for mean and spread, and records every console error and WebGL warning. Each cycle is ×3:

battle 1-6 → lobby (Marumi's live 3D scene) → battle 1-10 → recruit (a 1× pull, cinematic skipped) → student page
3D view → battle 1-1 → **two quick restarts** (`ui.restart()`, the Retry/Restart path) → **sandbox** run
(peaks_ridge, hard) → lobby.

I ran the same script on 7fcd93eb (worktree) for comparison.

| after | branch 19c69bf8: live contexts (attached) | base 7fcd93eb: live contexts (attached) |
|---|---|---|
| cycle 1, lobby | 2 (1) | 8 (1) |
| cycle 2, lobby | 3 (1) | 15 (1) |
| cycle 3, after 2 restarts | 4 (1) | **16 (1)**, Chrome's cap |
| cycle 3, lobby | 4 (1) | 16 (1) |
| "Too many active WebGL contexts. Oldest context will be lost." | **0** | **6** |
| console errors / page errors | 0 | 0 |
| battle / restart / sandbox opens that drew | 18 / 18 | 18 / 18 |

* **On the branch** only the battle on screen holds a live context. Every disposed battle context reports
  `isContextLost()`. The extra live contexts are the student viewers (I1-r2).
* **On the base** the detached battle contexts stay live and hit Chrome's 16-context cap within 3 cycles. Chrome then
  evicts the oldest, which can be the lobby's or the page's current one. So I1 removes a real failure mode.
* **The lobby live scene** comes back after every battle (`state: 'live'`; its stats show created − disposed = 1).
* **No black canvas.** Every battle and sandbox canvas had a spread of at least 51 (mean 87–177). One sample at 2.5 s
  read dark: a load-in fade, and the screenshot taken just after it is normal.
* **GL objects** in the live battle context are the same each cycle (26 textures, 194 buffers on 1-6). Objects
  "left" in lost contexts are freed with the context.
* **Co-op rejoin:** `e2e/coop-rejoin.mjs` (see §6) covers the rebuild in place.

Screenshot: `shots/i1-cycles-844x390.jpg`. It shows the third cycle: the battle, the lobby live scene, the battle after
two restarts, and the sandbox.

## 2. M1: landmark glow meshes

* **Structure, in-game** (night forced through `scenery.night`, and `look.blackout` set on each stage, render-side
  only):
  * **ticketGates, clockTower** (1-6), **greatWillow** ×2 (5-10) and **spindle** ×2 (6-10): every glow mesh is
    visible over a visible Tripo mesh. Every solid piece is hidden.
  * **lockGate, dryFountain, oldLamp, schoolBlock** ×15 and **doorieStatue** (6-8): no glow mesh, solids hidden.
* **Blackout.** I recompiled the glow material once to reach its `uDim` uniform and set it to 0.15 (the blackout
  level). The landmark glows dim with the rest: the spindle ring, the clock face, the willow and ticket-gate lights.
  So the `dimk` clone is live now, not dead work.
* **Sprites.** The old lamp's halo still lights the base of the Tripo lamp at night. The dry fountain shows no glow
  sprite even as the procedural piece (I blocked `models/props/landmarks/` for the "before" column), so nothing was
  lost there.
* **Fit unchanged.** Taking the glow out of the fit box leaves clockTower, greatWillow and spindle the same size to
  the hundredth. ticketGates moves by about 3 % (scale 0.322 → 0.311).

Screenshot: `shots/m1-glow-landmarks-procedural-tripo-blackout.jpg`. Each row is a landmark; the columns are
procedural at night, Tripo at night, and Tripo at blackout 0.15. Crops are at 2× DPR.

## 3. L3: enemy LODs

* **Files.**
  * Each of the 12 `.lod.glb` files has 1,998–2,000 triangles, one 256×256 WebP, the same skin and the same clip
    names as the full file, and `extras.lod: true`.
  * Sizes are 87–147 KB, 1,380,160 B together, against 2,715,744 B for the full files. Most of what is left is the
    animation data.
  * The manifest's `lodSize` matches each file.
* **Selection** (network log in the browser, 1-6 with all 12 family enemies spawned):

| quality | preload | after spawning | files drawn | both full and LOD fetched for one id | duplicate requests |
|---|---|---|---|---|---|
| high | 2 × `.glb` | 12 × `.glb` | 12 full | none | none |
| medium | 2 × `.lod.glb` | 12 × `.lod.glb` | 12 LOD | none | none |
| low | 2 × `.lod.glb` | 12 × `.lod.glb` | 12 LOD | none | none |

* **Mid-session switches.**
  * **Medium → High in battle** (`save` + `renderer.setQuality`, as the pause menu does): no new requests. New
    spawns keep the LOD, the same as the hero figures, whose detail is also fixed per battle. That is sensible.
  * **Next battle at High:** the 12 full files load, and only those.
  * **After the battle:** the setting leaks into the bestiary (L2-r2).
* **Animations and outlines.**
  * At medium, each LOD enemy has its skinned body plus an outline mesh (`material.userData.outline`). Its bones move
    between two samples 0.9 s apart, so the clips play. The same holds at high with the full files.
  * At low there is no outline, by design for every enemy (`glbEnemy.js:506`).
* **The e2e numbers reproduce exactly:** enemy triangles 599,920 → 239,910 and frame triangles 648,036 → 288,026,
  at 140 calls either way.

Screenshot: `shots/l3-busy-wave-full-vs-lod-medium.jpg`.

## 4. L2: Norika's Hold the Line and Seiran's head

* **e2e.**
  * `tripo-batch2` fires both ultimates. The 2 barriers are the `tripo:norika_hold_line` mesh (2 drawn).
  * One sky dragon in flight draws one `tripo:seiran_dragon_head`. It moved (-0.67, -0.03) while facing (-1.00,
    -0.03): dot **1.00**.
* **Zoomed (2× DPR, four frames 0.15 s apart).**
  * The head leads the procedural body, snout first, with gold horns up. At 0.45 tall it sits in proportion to the
    body beads: a little taller than the neck, as a head should be, and no longer the ~1.4× of r1.
  * The textured head is a softer teal than the flat-shaded body. That is a style difference, not a defect.
* **Hold the Line.** The barriers stand on the road at the instance matrices tuned for `lineGeometry()`, without
  stretching.

Screenshots: `shots/l2-seiran-head-4-frames-dpr2.jpg`, `shots/l2-norika-hold-line-zoom.jpg`.

## 5. Sim

* `import { simId } from 'tools/simId.mjs'` → **`0fe7c5c04aec`** (unchanged).
* No file in the sim closure changed. None of `glbEnemy.js`, `tripoLandmarks.js`, `terrain.js`, `BattleRenderer.js`,
  `rosterFx.js` or `controller.js` is in `simId`'s file list. Nothing under `src/sim` or `src/online` imports a
  render or model module.

## 6. Tests

| suite | result |
|---|---|
| `npx vitest run tests/models` | 13 files, **237 passed** |
| `npx vitest run tests/render/tripoLandmarks.test.js` | 1 passed (2.3 s alone; 3.9 s with 4 CPU hogs) |
| `npm test` (run 1, with a Playwright probe running alongside) | 427 files passed, 1 failed, 2 skipped; **6762 passed, 1 failed** (the L1-r2 timeout), 11 skipped |
| `npm test` (run 2, alone) | 428 files passed, 2 skipped; **6763 passed, 0 failed, 11 skipped** (541 s) |
| `node e2e/tripo-batch2.mjs` | **34 ok, 0 fail** ("all ok") |
| `node e2e/tripo-batch1.mjs` | **15 ok, 0 fail** ("all ok") |
| `node e2e/coop-rejoin.mjs` | **21 ok, 0 fail** ("all checks ok", 233 s) |
| `node e2e/smoke.mjs` | **676 ok, 2 fail**: the 2 known "drag (touch)" failures |

## 7. Content and hygiene

* There are no other games' or anime names in the commit, doc, test or tool text.
* No new reference images were added. The 12 `.lod.glb` files are the game's own Tripo models, decimated.
* There are no keys.
* `seiran_dragon_tail.glb` is gone, and nothing references `dragon_tail`.
* No patch note on the branch, as in r1 L5: whoever merges it to `main` adds it.
