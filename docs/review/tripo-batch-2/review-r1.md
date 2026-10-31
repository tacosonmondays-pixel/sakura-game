# Review r1: feature/tripo-batch-2 @ 7fcd93eb (one commit on main eb0b1ab9, v0.1.67)

Fresh clone, independent reviewer. Scope: content, repo hygiene, runtime (lazy load, fallback, landmarks, memory,
perf), animation quality, sim id, tests. The precedent is `review/tripo-batch-1-r1` and `-r2`.

**Verdict: OK to merge.** Content and hygiene are clean, and the sim is untouched. Fallbacks work with every new GLB
blocked, and all suites pass. There is one Medium (M1: the swapped landmarks also hide their glow, which the doc and
the code comment say stays), best fixed before the merge because it is a one-line change. The rest is Low or Info.

## Findings

| # | Sev | Where | Finding | Fix |
|---|---|---|---|---|
| M1 | Medium | `src/render/tripoLandmarks.js:48`, `:51`, `:71` (+ `src/render/terrain.js:687`) | `swapLandmark` takes **every** mesh child of the group as "procedural". That includes the glow mesh terrain.js adds (`mats.glow`). So (a) the glow is hidden once the model arrives, and (b) the glow's bounds are part of the fit box. My probe on 1-6 found 5 hidden meshes in the 2 swapped groups, including a `MeshBasicMaterial` (the glow). Six of the ten types have glow geometry: clockTower 108 verts, doorieStatue 36, greatWillow 90, spindle 432, finishGantry 36, ticketGates 144. This contradicts `docs/art/tripo/batch-2.md:110` ("glows and emitters stay, a blackout still dims its glow") and the file header. The new blackout `dimk` clone in terrain.js:687 is therefore dead work. You see it at night and in blackout stages (spindle and willow glows gone); daytime looks fine. | Hide and measure only the non-glow meshes. For example, tag the glow mesh in terrain.js (`mesh.userData.glow = true`, or compare `mesh.material === mats.glow`). Then in `swapLandmark` use `group.children.filter((c) => c.isMesh && !c.userData.glow)`. Add a unit test: after `swapLandmark`, a group with a glow child keeps it visible. |
| L1 | Low | `public/models/props/seiran_dragon_tail.glb` | Shipped (43,800 B, deployed to Pages) but referenced nowhere: not in `TRIPO_PROPS`, any test or the doc table. The doc says the tail stays procedural. | Delete it from `public/` (keep it outside git, or under `tools/` if it is wanted for a re-roll). |
| L2 | Low | `src/render/rosterFx.js:599`, `src/render/staffFx.js:28` | Neither new swap (the sky-dragon head; Hold the Line → `norika_hold_line`) is exercised by any test or e2e. `tests/models/tripo.test.js` only checks the files. The Tripo head is about 0.63 × 0.52 × 0.50; the procedural head is about 0.45 × 0.40 × 0.55. Its forward axis (+Z, snout) is not verified in-game. The Hold the Line instance matrices were tuned for `lineGeometry()`. I did not see either one rendered. | Add one e2e battle with Seiran (dragon on board: `rosterProbe().heads > 0` and a `tripo:seiran_dragon_head` mesh) and one with Norika's Hold the Line (`tripo:norika_hold_line` mesh). Take a zoomed shot of each to check facing and stretch. |
| L3 | Low | perf (see the table below) | On a busy 1-6 wave (28–32 enemies: 2× each family rep plus 4 bosses) triangles are **+39 %** (669k vs 474k–491k). Draw calls drop (124 vs 132–144). On SwiftShader the median frame is about 1.0 s vs 0.75 s. SwiftShader scales with vertex count, so it is not a phone number, but it points the same way. Common enemies are now 5k-triangle textured meshes on every stage that has them, and bosses and titans are 12k–20k. | Before the next batch, measure on a real phone at medium quality (still open from batch-1 r1 I2). If it is tight, add a ~2k-triangle `.lod.glb` for the 12 family reps (the heroes already ship one) and pick it at medium and low quality. |
| L4 | Low | `tools/blender/items/sources/tripo/*.glb` (14 files, 1,675,611 B) | Icon sources only: not served, not baked yet. They are in git for good. Each file is under 160 KB and there is a precedent (`tools/art/src/meshy-oct20/`), so this is acceptable. But they are only needed until the item-art session bakes them. | Acceptable as is. Otherwise keep them outside the repo (the owner's download set) and commit only the baked icons. |
| L5 | Low | `src/data/patchNotes.js` | No patch note on the branch. Batch 1 got its note at release time, so this only matters if the branch is merged straight to `main`. | Whoever merges it to `main` adds the v0.1.N entry. For players, that is new 3D looks for Luna, Nami, Kanna and Yoriko, one enemy per family, and the bosses and story landmarks. |
| I1 | Info | memory | JS heap after GC on returning to the lobby is flat over 3 stage cycles (branch 142.8 → 143.5 → 144.0 MB; main 142.0 → 142.7 → 143.2; blocked 143.5 → 144.2 → 144.7). There is no JS leak, and `clearTripoProps` and the landmark `dispose()` work. The GL objects never deleted across battles grow on **both** refs: textures +55/cycle on the branch vs +41 on main, buffers +105 vs +180. Each battle makes a new `WebGLRenderer`, and `renderer.dispose()` does not `forceContextLoss()`. This is the same pattern as main, scaled by more textures per battle. | Optional and not this branch's job: call `renderer.forceContextLoss()` after `renderer.dispose()` in BattleRenderer (`:1592`) so a dropped context frees its GPU memory at once. |
| I2 | Info | `docs/art/tripo/batch-2.md` | The doc says the heroes "follow the body rigidly" for hair and coats, and that dragons hover with no wing flaps. That matches what I saw. | None. |

## 1. Content

* **Boards** (all three) and **my screenshots**:
  * The four heroes are chibi and fully clothed: Luna in a long gown, Nami in a captain coat and trousers, Kanna in a
    club jacket and trousers, Yoriko in a long coat.
  * None of the heroes is posed or framed around the body.
  * The fae sprite is a small chibi fairy in a dress.
  * There is no gore: deaths topple, flatten or float.
* **Text and logos.** No text or logos. The lock gate's hazard stripes and the clock face are not text. The finish
  gantry banner is a check pattern. The scoreboard (HOME / GUEST) is rejected and not shipped.
* **Excluded library figures.**
  * There is no GLB in the repo with "girl", "leotard", "bodysuit", "fox", "wolf g" or "cat g" in its node,
    mesh, material, image or texture names, or in its glTF JSON.
  * All 47 new or changed GLBs carry only rig bone names, `<id>`, `<id>_rig`, `tripo_mat_<uuid>`, `base` and the clip
    names. Each has one WebP image.
  * `git ls-files` has no such file name. The repo's "girl" hits are all pre-existing UI files.
  * Luna's source is titled "anime fox girl", but she is the long-gown figure on the board, not one of the excluded
    leotard and bodysuit figures.
* **Other games' and anime names.** None in the added text: code, doc, tests, tools, e2e. The capitalised words are
  Tripo, Blender, Claude in Chrome, Playwright, WebP and the game's own names.

## 2. Repo hygiene

* `git rev-list --objects origin/main..origin/feature/tripo-batch-2`: **no blob over 1 MB**. The largest is
  `fp_hyakki_daimyo.glb` at 926,356 B. There are no PNG, WebP or zip files and no refs or raw downloads; the boards
  are 3 JPEGs (709 KB together). Total new blob bytes: 16.4 MB, counting the new tree and manifest versions.
* No keys, tokens or secrets in the added text, and none in GLB strings.
* **Bytes added** (new size minus old):

| group | Δ bytes | served? | loads |
|---|---|---|---|
| heroes (4 × full + lod) | +1,871,439 (4.56 MB total) | yes | lazily, per battle with that hero (full ~0.70–0.77 MB, was 0.42–0.46) |
| enemies (18 + manifest) | +6,961,636 | yes | lazily, per stage, through `enemyModelKeys(def)`, only for enemy ids on the stage |
| landmarks (10) | +1,990,556 | yes | lazily, per battle, only for the pieces on the map |
| props (hold line, head, unused tail) | +243,204 | yes | lazily, when the kind is on the board (the tail: never, see L1) |
| gear icon sources (14) | +1,675,611 | no (tools/) | never |
| boards (3 JPEG) | +708,960 | no | never |
| code, docs, tests, tools | +47,653 | JS only | initial bundle: a few KB (tripoLandmarks.js plus small diffs) |

**Initial load: about +0 GLB bytes. Lazy: about 11.07 MB more under `public/`.**

## 3. Runtime

The probe is my own Playwright script, not committed. It uses SwiftShader at 844×390, stage 1-6 (normal) with hero
Luna and Aoi. It spawns 2× each of the 12 family reps plus 4 bosses (Ash Wyvern, Gloom Regent, Iron Colossus and
Hyakki Daimyo), runs 3 stage cycles (battle → lobby → battle), and forces GC before each heap read. I ran it on the
branch, on main (worktree) and on the branch with GLBs blocked.

| | main | branch | branch, blocked |
|---|---|---|---|
| Tripo enemy models drawn | 0 | 16 / 16 ids | 0 (12 family meshes) |
| landmarks drawn as Tripo | n/a | 2 (clock tower, ticket gates) | 0 (procedural, 5 meshes visible) |
| hero | GLB | GLB (Tripo) | procedural fallback (no stand-in) |
| draw calls | 132 / 136 / 144 | **124** / 124 / 124 | 148 |
| triangles | 481k / 477k / 491k | **669k** | 474k |
| frame median (SwiftShader) | 717–800 ms | 917–1033 ms | 800–900 ms |
| console errors | 0 | 0 | 0 (19 blocked URLs → 23 "unavailable, using … fallback" warnings, as designed) |
| heap after leaving (3 cycles) | 142.0 / 142.7 / 143.2 MB | 142.8 / 143.5 / 144.0 MB | 143.5 / 144.2 / 144.7 MB |

* **Lazy loading and fallback.** I blocked `models/enemies/tripo/`, `models/props/landmarks/`, the hold line and the
  dragon head, and `characters/{luna,nami,kanna,yoriko}`. No errors or page errors. Enemies wear their family meshes,
  landmarks stay procedural and Luna is the procedural figure. See
  `shots/busy-wave-1-6-main-branch-blocked-844x390.jpg`: main, then the branch, then the blocked branch zoomed in.
* **Landmarks.**
  * Placement, paths and hitboxes are sim-side. No `src/sim` or `src/online` file changed, and the sim id is
    unchanged. Nothing raycasts the terrain group.
  * The swap is display only: it fits by height, with the footprint capped at 1.1×. On 1-6, 1-9 and 1-10 the models
    sit in the procedural spot (`shots/landmarks-1-10-1-9-844x390.jpg`).
  * One defect: the glow is hidden too (M1).
* **Node builds are identical.** `landmarkKey` returns null without `window` and `fetch`, so node keeps the merged
  path. `tests/render/terrainGolden.test.js` (the golden fingerprints of every shipped terrain) and the per-theme
  fingerprint tests pass unchanged.
* **Dispose and cache.**
  * The JS heap is flat across 3 cycles.
  * Landmark loads that arrive after dispose are ignored (`live = false`).
  * The shared Tripo geometry is skipped in the rosterFx and staffFx disposers and freed by `clearTripoProps()`.
  * GL counters: see I1.
* **Perf.** See L3.

## 4. Animation quality

I took my own shots at 844×390 and 390×844 on 1-1. Each is three frames about 0.9 s apart after the wave starts,
zoomed in on the hero:

* Nami with goblin, orc, ghoul, oni and lizard
* Kanna with the Daimyo, Colossus and Titan
* Yoriko with slime, sprout, fairy and wolf
* Luna with ghost, cogling and wyvern

The files are `shots/anim-*.jpg`, as horizontal strips of the three frames.

* **Heroes.** No candy-wrapper joints or detached limbs in idle, attack or walk. The arms are short and move little,
  as the doc says. Nami's trident stays in hand, Yoriko's doll follows `hand_L`, and Kanna's twin tails do not follow
  her arms.
* **Humanoid enemies** (goblin, orc, ghoul, oni, lizard, Daimyo, Colossus, Titan): they walk cleanly, with no
  stretched or collapsed limbs at game zoom. The orange silhouette in Kanna's first frame is the Daimyo's hit flash.
* **Rigid and blob enemies.** They hover, hop and squash as designed. The slime looked big next to the sprout, so I
  checked it: both are normalised to `0.6 × def.size` tall (slime 0.7, sprout 0.6), and the slime's width is the same
  as the family slime's, so this is not a regression.

## 5. Sim

`import { simId } from 'tools/simId.mjs'` → **`0fe7c5c04aec`** (unchanged). No file under `src/sim`, `src/core`,
`src/data` or `src/online/coop` changed. The new modules (`tripoLandmarks.js`, `tripoProps.js`) are render-side and
imported only by `src/render/*`.

## 6. Tests

| suite | result |
|---|---|
| `npx vitest run tests/models` | 13 files, **234 passed** |
| `npm test` | 427 files passed, 2 skipped; **6759 passed, 11 skipped** (783 s) |
| `node e2e/tripo-batch2.mjs` | **18 ok, 0 fail** ("all ok") |
| `node e2e/tripo-batch1.mjs` | **15 ok, 0 fail** ("all ok") |
| `node e2e/smoke.mjs` | **676 ok, 2 fail**: the 2 known "drag (touch)" failures |
