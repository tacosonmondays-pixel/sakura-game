# Review r1: feature/tripo-batch-1 @ 781a9e20 (on release/v0.1.66 @ 26dd6ab6)

Independent review, Oct 31 2026. Fresh worktrees of both refs; `npm ci` in each; Chromium via SwiftShader (no GPU).

**Verdict: OK to merge.** Nothing blocks. One Medium (the branch's own e2e fails here) and some Low items, listed
below with suggested fixes. None touches the sim.

## 1. Sim untouched

| check | release 26dd6ab6 | branch 781a9e20 |
|---|---|---|
| `simId().id` | `5ba58b3fc229` (91 files) | `5ba58b3fc229` (91 files) |
| hashed files under `src/render`, `src/models`, `src/ui` | none | none |

The diff has no file under `src/sim`, `src/online/coop` or `src/data`. The new render code imports from the sim
(`staffFx.js` already read `sim/runners.js` and `sim/barricades.js`). Nothing in the sim imports render code. No
`COOP_PROTOCOL` bump is needed.

## 2. Loading

Probe: my own Playwright script (not committed). It opens stage 4-7 with Suzu, Aoi and the hero. It spawns 2× each
Brigade enemy plus a slime, starts the wave, then reads the scene graph, the console and the GLB requests.

* **Happy path:** the probe found 10× `glb:tripo/brigade_*` and `tripo:{big_yellow,norika_barricade,suzu_bell}`. The
  hero is drawn as `glb:kogane` / `glb:norika` (not a stand-in). No GLB was requested twice.
* **Failed loads** (requests aborted, and separately answered with 404, for the 5 enemies, the 3 props and the
  heroes): all 10 Brigade enemies wear `glb:construct`. The props keep their procedural shapes and the hero gets the
  procedural placeholder. No page error and no `console.error` from game code. The only errors are Chromium's own
  "Failed to load resource" network lines, which any missing asset logs on release too. The game logs warnings only.
  A failed file is not re-fetched (it is cached as `null`).
* **Preload:** `controller.js` adds `tripo/<id>` only for enemies in the stage's list. Enemies outside the list (the
  probe spawns gnat, tortoise and badger by hand on 4-7) load lazily and are upgraded in place. No double loads were
  seen (`dup: []` in every run).
* **Disposal:** each enemy instance disposes its own toon material. The shared geometry and map are marked
  `userData.shared`, the same as family assets. `StaffFx.dispose` skips the shared Tripo geometry and disposes the
  rest. See L2 for the prop cache.
* **LOD:** `detailFor(quality)` picks `kogane.lod.glb` / `norika.lod.glb` at medium/low quality. Both files are
  listed in the manifest (`lod`, `lodSize`). The `tests/models` LOD tests pass.
* **Bytes:** no GLB is fetched at boot (`bootGlb: []` on both refs), so the initial load grows by **0 B**. Lazy
  loads per battle:
  * Enemies: all five Brigade files are 1,173,544 B; a 4-7 run that only lists trooper and shieldline needs 378,236 B.
  * Hero: 604,972 B (Kogane, high quality) or 328,676 B (Kogane LOD).
  * Props: 337,276 B, fetched by any battle with Kogane, Norika or Suzu (L1).
  * Worst case (high quality, all five Brigade): about **2.0 MiB** over the wire.
  * GPU, decoded: a 1024² WebP becomes about 5.3 MiB with mips. A Brigade wave with Kogane can hold 4 such textures
    (kogane, tortoise, badger, big_yellow) plus four 512² ones: about **27 MiB** of textures. That is fine for
    phones, but worth knowing before batch 2 adds more 1024² files.

## 3. Files and hygiene

Every shipped GLB was checked by reading its header JSON and its WebP chunk:

| file | bytes | tris | texture | extensionsRequired |
|---|---|---|---|---|
| kogane / .lod | 604,972 / 328,676 | 19,970 / 8,999 | 1024² / 512² | KHR_mesh_quantization, EXT_texture_webp |
| norika / .lod | 573,680 / 308,908 | 19,996 / 8,999 | 1024² / 512² | same |
| brigade_trooper | 187,980 | 5,000 | 512² | same |
| brigade_shieldline | 190,256 | 4,990 | 512² | same |
| brigade_gnat | 164,520 | 4,992 | 512² | same |
| brigade_tortoise | 300,208 | 7,990 | 1024² | same |
| brigade_badger | 330,580 | 7,984 | 1024² | same |
| big_yellow | 220,484 | 5,990 | 1024² | same |
| norika_barricade | 57,432 | 800 | 512² | same |
| suzu_bell | 59,360 | 800 | 512² | same |

* Positions are int16 in every file. There is no meshopt or Draco. The sizes and triangle counts match batch-1.md
  and both manifests exactly.
* No raw downloads are in git: no Tripo-named files outside the processed set, and no zip or fbx. No third-party
  images are in the commit; the only image is the board, which shows the game's own renders.
* `git check-ignore` confirms that `tools/art/src/tripo/batch-1/x.glb` is ignored (`.gitignore:28`).
* Secrets: a grep of the diff for `tsk_`, `api_key`, `authorization`, `bearer`, `secret`, `token` and `TRIPO_API`
  finds nothing. The tools take source GLBs from disk and make no API calls.

## 4. Content

* **Board** (`docs/art/tripo/batch-1-board.png`), looked at in full:
  * Kogane: hard hat, hi-vis jacket, trousers and boots.
  * Norika: cap, blazer, sash, slacks and boots.
  * Both are fully clothed, chibi-proportioned and in neutral work poses. Nothing about either is framed around the
    body.
  * The troopers are fully armoured with visors, and the vehicles are toys. There is no gore; the death clips are a
    topple.
* **Names:** the code, docs, tools and e2e in the diff name no other game or anime. batch-1.md does not copy the
  prompts. It says "the wishlist prompt of each row verbatim", and those rows live on the unmerged
  `docs/asset-wishlist` branch. I read all eleven P1 rows there, plus the negative prompt in batch-1.md. They are
  clean: only the game's own descriptions and generic style words ("soft anime chibi style").

## 5. Tests

| run | release 26dd6ab6 | branch 781a9e20 |
|---|---|---|
| `npm test` | 5 failed / 6638 passed / 11 skipped | **4 failed / 6650 passed / 11 skipped** |
| the 4 known (`itemArtRuntime` KNOWN[14] pin, 3 `engines.test.js` replays) | fail | fail |
| other failures | `perf.mirror` Kaleidoscope (timing; passes alone, 2/2) | none |
| `vitest run tests/models` | n/a | 13 files, 201 passed |
| `e2e/smoke.mjs` | 2 FAIL ("drag (touch)" ×2), 676 ok | 2 FAIL (the same two), 676 ok |
| `e2e/tripo-batch1.mjs` | n/a | **1 FAIL, twice: "Suzu laid bells in at least one battle (0)"** (M1) |

The branch adds 11 tests, and all of them pass.

## 6. Screenshots and perf

Shots are in `shots/`: stage 4-7, the Brigade wave, the hero placed, at 844x390 (with a zoom) and 390x844. A
release-vs-branch crop of the same wave is in `brigade-release-vs-branch-844x390.webp`.

* **Scale:**
  * The heroes stand about 1.3–1.4× Suzu's height. This matches the "slightly taller adult staff" brief and Hikari's
    1.224.
  * The Tortoise and Badger fill the road width. Badger is about a tile long, which the doc already notes.
* **Orientation and grounding:**
  * The enemies face down the road and stand on it; I saw no float or sink at this zoom.
  * The barricade stands across the road, as the procedural one did.
  * Big Yellow sits behind and to the left of Kogane, on the ground.
* **Readability:**
  * The troopers read well, and they read better than the construct stand-ins.
  * The elites keep the amber elite rim and read clearly.
  * The shieldline's translucent shield reads as a pale beige blob at 844x390. This is minor; see the open items.
* **Perf on SwiftShader** (same wave and setup on both refs). Frame times on CPU WebGL are 0.4–0.6 s and too noisy to
  compare; please re-measure on a phone or GPU (`SAKURA_E2E_GL=gpu`).

  | | release | branch |
  |---|---|---|
  | draw calls | 108 | **93** (−14%) |
  | triangles | 346k | **463–468k** (+35%) |

  The triangle growth comes from the 5–8k-triangle enemies (×2 with the outline pass) and the 20k hero.

## Findings

| # | sev | where | finding | suggested fix |
|---|---|---|---|---|
| M1 | Medium | `e2e/tripo-batch1.mjs:140`, `:145`, `:173` | The branch's own e2e fails here every time (2/2): no armed bell appears within the 40 s wait on SwiftShader, so `bellsSeen` is 0. On SwiftShader the sim only reaches about 1 sim-second per 6 s of wall time. The per-battle check `drawn === bells` also passes when both are 0, so it proves nothing. The code itself works: my probe saw the `tripo:suzu_bell` mesh in the scene with 1 bell placed, on both 1-1 and 4-7. | Wait for `sim.traps.some(t => !t.strip)` (placed, not armed), or advance the sim by hand (`sim.step` in a loop) before probing. Make the per-battle check `bells > 0 && drawn === bells`. |
| L1 | Low | `src/render/staffFx.js:288` (+ `:333`) | `_ensure` loads all three props whenever any staff layer starts. A Suzu-only battle (no Kogane or Norika) still fetches `big_yellow` and `norika_barricade` (278 KB). A Norika battle fetches Big Yellow, and a Kogane battle fetches the barricade (seen in the probe). | Load a prop only when its kind is first drawn: bars when a hero has `bars`, walkers for a `pilot` or a plow runner, bells when there are traps. Better still, preload from `controller.js` from the formation (hero id and Suzu in towers), so there is no pop-in from the procedural shape. |
| L2 | Low | `src/render/tripoProps.js` (no clear); `src/render/BattleRenderer.js:1590` | The prop cache (cloned geometry, Lambert material, map) lives for the whole session and is never disposed. The other caches are cleared when the last renderer goes (`clearPropCache()`, `clearCostumeCache()`). The cost is small (~3 decoded textures in CPU memory), but it is inconsistent. Family enemy assets are also kept per session, so the enemy side matches release behaviour. | Add `clearTripoProps()`, which disposes geometry, material and map and clears `loaded` / `pending`, and call it beside `clearPropCache()`. |
| L3 | Low | `src/ui/battle/freeplay.js:251` | The freeplay next-wave preload calls `familiesOf(ids)` and does not add `tripo/<id>`. A Brigade wave in Freeplay first shows the construct mesh, then swaps to the Tripo mesh mid-wave. The same holds for the bestiary and the sandbox `ctx.preloadEnemies`. | Add `tripoEnemyKey(ENEMY_MAP[id])` for each id there, as `controller.js` does. A helper `enemyAssetKeys(def)` would fit next to `tripoEnemyKey`. |
| L4 | Low | `src/models/glbEnemy.js:106` | When a Tripo file fails, the warning says "enemy family tripo/brigade_trooper unavailable, using procedural fallback", but what is actually drawn is the construct family mesh. | Change the wording for `tripo/` keys, for example "…, wearing its family model". |
| L5 | Low | `docs/art/tripo/batch-1.md` (Settings) | The prompts are not recorded in the batch doc. They point at the unmerged `docs/asset-wishlist` branch, so the doc cannot be checked or reproduced on its own if that branch changes or is dropped. | Paste the eleven prompts used (or a commit-pinned link) into batch-1.md. |
| I1 | Info | `src/data/patchNotes.js` | The branch has no patch note. That is fine for a feature branch, but the push to `main` will need one. | Add a note at merge. |
| I2 | Info | perf | Triangles are up 35% on a Brigade wave and draw calls are down 14%. | Re-measure frame time on a real phone at medium quality before batch 2 adds more 8k-triangle elites. |

## Open items seen (owner's call, not defects)

* The shieldline's translucent shield reads as a pale blob at battle size. A more opaque, blue-tinted shield would
  read better.
* The heroes do not blink yet (already listed in batch-1.md).
