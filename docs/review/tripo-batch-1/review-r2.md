# Review r2: feature/tripo-batch-1 @ e7f6479c (delta from r1's OK target 781a9e20)

Independent delta review, Oct 31 2026. Fresh clone; `npm ci`; Chromium via SwiftShader (no GPU). Round 1 is
`review-r1.md` beside this file.

Commits since round 1:

* `e1ca6cfe`: a docs-only hand-off with reference PNGs.
* `2dcb1261`: a revert of `e1ca6cfe`.
* `5762c7f8`: a merge of `origin/release/v0.1.66`.
* `e7f6479c`: the r1 follow-ups (M1, L1–L5).

**Verdict: NOT OK as it would ship today. The code is OK.**

The follow-ups are correct, and I found no new leak or race. The blocker is history, not code. The reverted
reference PNGs are gone from the tree, but they are still in the branch's history: 7.9 MB of blobs. The ship step
in HANDOFF (`git merge --no-ff`) would carry them into `main` permanently, and history cannot be rewritten later.
Land the same tree through a clean branch (see N1) and this becomes OK. No code change is needed.

## 1. The revert and file sizes

* `git diff e1ca6cfe~1 2dcb1261` is empty, so the revert is exact.
* The tip has no `docs/art/tripo/refs/` and no `chrome-batch-1.md`.
* `git diff 781a9e20 e7f6479c --stat`: 21 files, +351/−95.
  * The 13 follow-up files (144 lines).
  * The release files the merge brought in: `limit-break.mjs`, gear UI, `items.js`, BALANCE and HANDOFF. 781a9e20
    was built on release `9fa15be0`, not on the tip.
* **Tree:** these files that `main` does not have are over 1 MB:

  | file | size | note |
  |---|---|---|
  | `docs/art/tripo/batch-1-board.png` | 1,921,406 B | already in 781a9e20 (N2) |
  | `docs/review/attack-shapes/attack-shapes-reel.mp4` | 1,406,381 B | from release, not this branch |

  Every GLB is under 1 MB. The largest is `kogane.glb` at 604,972 B.
* **History:** these blobs are reachable from the branch, not from release, and not from the tip:

  | blob | size |
  |---|---|
  | `refs/nami-full.png` | 1,606,446 B |
  | `refs/luna-full.png` | 1,508,521 B |
  | `refs/seiran-full.png` | 1,398,408 B |
  | `refs/kanna-full.png` | 1,162,669 B |
  | `refs/yoriko-full.png` | 1,045,657 B |
  | `refs/chibi-style-turnaround.png` | 862,721 B |
  | `chrome-batch-1.md` | 32,047 B |
  | **total** | **7,871,731 B** (with the pre-follow-up versions of 8 source files) |

  The PNGs look like the game's own art, and the chrome doc's prompts are clean. The only problem is their weight
  in a history that cannot be rewritten (N1).

## 2. The merge

* The merge is `5762c7f8`; its parents are `2dcb1261` and `26dd6ab6`. `26dd6ab6` is the **release tip**, so the
  branch is **not behind** (`git rev-list feature..release` = 0).
* `git diff origin/release/v0.1.66 origin/feature/tripo-batch-1 -- src/sim src/online tests/sim` is **empty**.
* `simId()` (imported from `tools/simId.mjs`) gives `5ba58b3fc229` with 91 files, on both the branch and a release
  worktree. No `COOP_PROTOCOL` bump is needed.

## 3. The follow-ups

| item | verdict | evidence |
|---|---|---|
| **M1** e2e | correct, and meaningful | See §4. It steps the sim with the battle paused until an armed bell exists, then asserts `bells > 0` and `drawn === bells` in each battle. |
| **L1** lazy props | correct | `staffFx.js:337-341` sets `need.{bars,walkers,bells}` from the sim; `_swapTripo` loads a file only for a needed kind (`:298`). Probe requests: a Kogane battle fetched only `big_yellow` + `suzu_bell`; the e2e Norika battle drew only the barricade. |
| **L2** clear | correct | `clearTripoProps()` (`tripoProps.js:51`) disposes geometry, map and material, then clears `loaded` and `pending`. It runs beside `clearPropCache()` (`BattleRenderer.js:1592`). A load that lands after a clear sees `pending.get(id) !== p` (`:76`), disposes its own clone and returns `null`. A failed stale load does not write `null` into a fresh cache either. The loaded scene's own geometry is disposed after cloning, which is safe because `propFromScene` clones it. |
| **L3** preloads | correct | `enemyModelKeys(def)` (`glbEnemy.js:70`) is used in `controller.js` `stageFamilies`, `freeplay.js` `familiesOf`, `bestiary.js`, `sandboxPanel.js` and `bossArt.js`. The family-only expressions left in `src` are `models/enemies.js`, `enemiesProcedural.js` and `costumes.js`; those pick a mesh and do not preload. Freeplay's `homeFamilies` now holds the `tripo/` keys too, so its filter still works. |
| **L4** wording | correct | A `tripo/` key now warns "using the construct family mesh fallback". |
| **L5** prompts | correct | 11 prompts, each with its task id and face_limit. Each one matches the `docs/asset-wishlist` `ASSET_WISHLIST.md` row exactly (checked by substring). The negative prompt is in the Credits section's "Settings". |

### Races and leaks (Playwright probe, not committed; it hooks `window.__glr` through a Vite transform)

* **A prop load in flight at clear.** I held `suzu_bell.glb` for 8 s, entered a battle, waited until the bell had
  been requested, and left.
  * The cache was empty after the clear.
  * A quick re-entry made a new request, and both props loaded.
  * No duplicates in the cache, no warnings, no errors.
* **A renderer recreated quickly after the clear.** The same run covers it: the re-entry came while the old request
  was still held. The stale result is dropped by the `pending` identity check.
* **Double dispose of shared textures.** There are no per-battle clones: every `InstancedMesh` shares one
  geometry and material per file. `StaffFx.dispose` skips `tripo:` geometry and does not dispose materials, so
  only `clearTripoProps` disposes the map, once. `InstancedMesh.dispose()` frees only its instance buffers.
* **3 stage cycles** (1-1, Kogane + Suzu, the five Brigade enemies, one bell, then exit to home):

  | | release 26dd6ab6 | branch e7f6479c |
  |---|---|---|
  | `renderer.info.memory` at the battle peak, cycles 1/2/3 | geo 89/51/51, tex 37/37/37 | geo 90/52/52, tex 49/49/49 |
  | Tripo prop cache after each exit | n/a | empty (all 3 `-`) |
  | GL textures not deleted, after exits 1/2/3 | 17/34/51 (+17 per cycle) | 31/62/93 (+31 per cycle) |
  | GL buffers not deleted, after exits 1/2/3 | 272/392/512 (+120) | 220/288/356 (+68) |
  | JS heap after GC (KB) | 67,361 / 68,494 / 69,295 | 67,782 / 68,703 / 69,546 |

  * Each battle makes a fresh `WebGLRenderer`, so `info.memory` does not grow across cycles on either ref.
  * The "not deleted" GL objects belong to the dropped battle context and go with it. Release does the same.
  * The branch's extra 14 textures per cycle are the Tripo enemy, hero and prop textures that this battle uploads.
  * JS heap growth per cycle is the same on both refs.
  * See I1 for why the prop textures are not deleted through three.

## 4. Is M1 meaningful?

I broke bell drawing locally twice. Neither break was committed, and `git status` was clean afterwards.

| local break | result |
|---|---|
| `_swapTripo` skips the `bells` key (no bell mesh) | **FAILED (2)**: Kogane "Suzu laid bells (0)", Norika "Suzu's 1 bells are 3D bells (0 drawn)" |
| `_drawBells` never runs (mesh exists, count 0) | **FAILED (2)**: the same two lines |

The test catches both breaks. In the Kogane battle, though, it fails with the wrong message. When the 30 s wait
times out, the bell has already rung and gone, so the probe sees 0 bells, not "1 bell, 0 drawn" (N3).

## 5. Prompts

* All eleven prompts in batch-1.md are the game's own descriptions plus generic style words.
* No other game's or anime's name appears in them, or in the reverted chrome doc.
* The heroes are "adult academy staff member … professional outfit, modest, fully clothed". The negative prompt
  excludes revealing clothes, swimsuits, short skirts, cleavage, bare midriffs, gore and blood.
* The enemies say "no gore, no blood".
* Nothing is sexualised.

## 6. Tests

| run | result |
|---|---|
| `vitest run tests/models` | 13 files, **201 passed** |
| `npm test` | **4 failed / 6650 passed / 11 skipped** (424 files). The 4 are the known ones: the `itemArtRuntime` KNOWN[14] sim-id pin and 3 `engines.test.js` checkpoint replays. |
| `e2e/tripo-batch1.mjs` | **all ok**, both battles, 1 bell stepped / 1 drawn each, no console errors |
| `e2e/smoke.mjs` | **676 ok, 2 FAIL**: the known "drag (touch)" pair (aoi drop lands ~0.4–0.5 tiles off), same as r1 |

## Findings

| # | sev | where | finding | fix |
|---|---|---|---|---|
| N1 | **Medium (blocks)** | history: `e1ca6cfe` + `2dcb1261`; ship step `docs/HANDOFF.md:157` (`merge --no-ff`) | The reverted reference PNGs (6 files, 7.9 MB, the largest 1.6 MB) are reachable from the branch. A `--no-ff` merge puts them into `main`'s history for good, and the no-rewrite rule means they can never be removed. | Without force-pushing: make `feature/tripo-batch-1b` from `origin/release/v0.1.66`, run `git merge --squash origin/feature/tripo-batch-1` (or cherry-pick `781a9e20` and `e7f6479c`), commit, and ship that branch. Check it with `git rev-list --objects release..b \| grep refs/`, which should be empty. Its tree equals e7f6479c, so this review holds for it. |
| N2 | Low | `docs/art/tripo/batch-1-board.png` (1,921,406 B) | This is a docs PNG over 1 MB that `main` would gain. It is not a GLB or WebP. It was already in the r1 target. | Re-encode as WebP (the r1 shots are ~35–45 KB at 844 px) and update the link in batch-1.md. Do it on the clean branch from N1, so the PNG never enters history. |
| N3 | Low | `e2e/tripo-batch1.mjs:147`, `:154`, `:157` | The battle is unpaused for the 30 s wait. If drawing is broken, the bell rings and is consumed before the probe, so the failure reads "Suzu laid bells (0)", which misleads. The test still fails, so this is only a matter of the message. | Re-pause (`ui.paused = true`) once the wait returns or times out, or assert on `stepped.bells > 0` for "laid" and use `p2` only for `drawn === bells`. |
| I1 | Info | `src/render/BattleRenderer.js:1585` vs `:1592` | `clearTripoProps()` (like `clearPropCache()`) runs after `renderer.dispose()`, which has already reset three's property map. The map's `dispose` therefore frees only the JS side, and the GL texture goes with the dropped context. This is the existing pattern and not a leak (see the cycle table). | Optional: run the cache clears before `renderer.dispose()`, so three deletes the GL objects deterministically. |
| I2 | Info | `src/render/staffFx.js:298` | The props are now fetched when first needed, so the first barricade, walker or bell shows its procedural shape until the file lands. After each clear, every battle fetches them again (the HTTP cache usually answers). r1's "better still" preload from the formation was not done. | Optional: preload from `controller.js` from the formation (hero id, Suzu in the towers). |
| I3 | Info | `src/data/patchNotes.js` | Still no patch note; one is needed at the push to `main` (r1 I1). | Add it at merge. |
