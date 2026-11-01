OK

Round 6 of the VFX library review on `feature/vfx-shapes`: a delta check of `git diff b7ed2c2e 916d8aae`. That is 26d11f79 (code, docs, tests) and 916d8aae (the round 4 and 5 records). I am a fresh reviewer: I did not build any of this and wrote no earlier review.
- I read round 5 in full, the whole diff, and the code each claim rests on.
- Every mutation ran on a scratch copy (`git archive 916d8aae` into `/tmp/rvlib6/tree`). The merge checks ran in a scratch bare repo, `/tmp/rvlib6/repo.git`, which borrows the main object store read-only.
- The worktree is still clean at 916d8aae.

**Verdict.**
- **All four items are fixed: LOW-1, LOW-2, NIT-1 and NIT-3.**
- **LOW-1:** with the option off, no path starts or draws a tornado. With it on, the tornado path does exactly what b7ed2c2e's did, frame for frame.
- **LOW-2:** every new sentence is true to the code.
- **The new pins** fail on every plain way of breaking the gate.
- **Nothing in the follow-up is broken.** Gates 1 to 3 pass.
- **Gate 4 is not clean, but this follow-up did not cause it.** There is one docs-only conflict in CONTRACTS.md with the tornado branches. It is already there at b7ed2c2e, and the follow-up's own hunks merge cleanly.
  - With the hunk resolved, the full release merge is clean and all of `tests/render` passes on it.
  - It is LOW-A below, with a validated fix.
- **Three NITs, all optional.**

## Gates

1. **Sim id: pass.**
   - It prints `e4001588f40b` in the worktree, in the scratch copy and on the fully merged tree.
   - The diff touches 7 files. None of them is among the 92 files `tools/simId.mjs` hashes.
   - The only code change is one token in `BattleRenderer.js`. No `COOP_PROTOCOL` bump is needed.
2. **`nice npx vitest run tests/render` at 916d8aae, in the worktree: pass.**
   - 62 files and 692 tests, all green, in 111 s. The load average reached about 10, from other work on the machine.
   - There were no timeouts, so nothing was rerun. The worktree was clean afterwards.
   - The guard file has 11 tests. Both numbers match the author's.
3. **Content: pass.**
   - I scanned the 396 added lines (records included) and both commit messages, matching whole words:
     - against `/tmp/rvlib5/tools/names.txt` (115 names): 0 hits;
     - against round 4's larger list (376 show, game, studio, character and technique names): 0 hits.
   - I also read every added line myself: the code hunks, and both records in full.
   - There are no player names and no keys or secrets. The only email addresses and links are the attribution lines.
   - The two records are byte-identical (`cmp`) to the reviewers' files, `/tmp/rvlib4/review.md` and `/tmp/rvlib5/review.md`, so "verbatim" is true.
4. **Merges (`git merge-tree --write-tree`): clean with main; one pre-existing conflict with the tornado branches.**
   - Local refs match `git ls-remote`: main 2dba8b4a, `feature/vfx-tornado` 0f60e9e1, `feature/vfx-tornado-polish` 10cd203f.

   | Merge | Result |
   |---|---|
   | 916d8aae + origin/main | clean: main is an ancestor, so the tree is 916d8aae's |
   | 916d8aae + origin/feature/vfx-tornado | **CONFLICT (content) in CONTRACTS.md**, one hunk; docs/VFX.md and BattleRenderer.js auto-merge |
   | main + tornado (the release before) | clean |
   | (main + tornado) + 916d8aae | the same CONTRACTS.md conflict |
   | 916d8aae + polish | the same conflict |
   | b7ed2c2e with each of the above | **the same conflict**: it predates this follow-up |
   | after a union resolution of the hunk, + polish | clean (exit 0), in either order (the same tree, c99cafb2) |

   - **The hunk.** It is the renderer's dev-tooling list:
     - this branch's `CONTRACTS.md:2119-2125`: the two base `r.tornadoDemo` / `r.tornado` lines, with the library's five lines (`r.lightningDemo` … `r.shapes`) added right under them (dee4e92a);
     - the tornado branches' `CONTRACTS.md:2117-2118`: the same two lines, reworded (02cec85d).
   - **The follow-up's hunks merge cleanly and land intact:**
     - CONTRACTS.md's Attack FX paragraph;
     - the VFX.md Setting line;
     - the `vfxOn &&` gate (the merged file still has exactly 2 `tornado.spawn(` calls);
     - the tests.
   - **On the resolved release merge** (main + tornado + this branch + polish, `/tmp/rvlib6/merged`): `nice npx vitest run tests/render` gives 62 files and 693 tests, all green, in 88 s (polish adds one tornado test).

## LOW-1: fixed

**With the option off, nothing starts or draws a tornado.** I traced every path with `settings.attackFx === false`:
- **The cast** (`BattleRenderer.js:770-771`) now needs `vfxOn`. With it false, a Starmine `abilityWarn` falls to the `else if`. That branch tests for `abilityShell`, so nothing runs, and the chain ends there: there is no later branch to fall into.
- **A shell** (`:772-773`) calls `tornado.feed(tornadoOf.get(uid), 0.45)`. The map is never filled, so this is `feed(undefined)`, and `tornado.js:373` (`if (rec && live.includes(rec))`) does nothing. It is quiet: it does not throw, so `tornadoSafe` never trips.
- **Every frame** (`:1188-1191`): `hold` and `update` with an empty `live` list.
  - `geo.instanceCount = 0` (`tornado.js:401`) and no quads are pushed.
  - The mesh is hidden: `mesh.visible = n > 0 && !held` (`:407`). Hidden means no draw call.
- **A quality switch** (`:613`) and **the glow** (`:567`) only set the tier and the bloom flag.
- **Impact frames** (`:515`): `impact.js:146` skips a hidden object, and `:186` re-shows only what it hid. The hidden column stays hidden.
- **Errors:** `tornadoSafe` (`:315-329`) clears and hides. `vfxOff` never touches the tornado: it has its own switch, as VFX.md says.
- **The dev tools:**
  - `tornadoDemo` (`:1509-1511`) and the `tornado` getter still start one when called, like `lightningDemo` and `beamDemo`.
  - Their callers are `tools/vfx/capture.mjs:400`, which runs the real game, where the option is never off, and the DEV-only `?tornadoLab` panel (`:1800-1805`, `tornadoPanel.js:17`).
  - No preview calls either.
- **A behaviour check backs the reading.** `tests/rv6/tornado-off.test.js` runs the renderer's own branch, cut from the source text, against a real tornado layer.
  - The script:
    - a Starmine cast with 6 shells;
    - a second girl's cast;
    - a stray shell with no warning;
    - impact frames, a quality switch there and back, and the glow on;
    - all on high, medium and low.
  - The result: 0 live columns, never visible, 0 instances, 0 quads, no error, an empty `tornadoOf`.
  - With an error thrown mid-battle: still nothing.
  - The control, b7ed2c2e's branch with the option off, does start a column, so the check is not vacuous.

**With the option on, the tornado path is unchanged.**
- Without comments, the only change in the diff is `vfxOn && ` in that one condition. With `vfxOn` true, it is the old condition.
- The same scratch test runs the new and the old branch with the option on, on every tier. They match frame for frame: visibility, instance count, all seven instance attributes, every quad pushed, and the uniforms.
- The `tornado` random fork is made with the option on or off, so no other stream moves.
- `vfxOn` is set at creation (`:338`). `handleEvents` runs only from the per-frame `update` (`:1124`), so there is no TDZ risk.

**Docs and tests.**
- VFX.md:352, CONTRACTS.md:2150-2155 and the comments at `BattleRenderer.js:335-337` and `:766-769` say what the code does.
- "Every effect keeps the plain look" is now true for the tornado too.
- Round 5's third step, a Setting line in VFX.md's own tornado section, was not done. That is NIT-C.

## LOW-2: fixed

Every claim in the new wording holds:
- **Only the previews set it:** `previews/renderer.js:80` (`fx=off`) and `previews/attacks.js:33` and `:208` (the FX on/off A/B button).
  - No file under `src/` reads an `fx` URL flag.
  - `e2e/attack-fx.mjs` and `e2e/attack-reel.mjs` reach it only through `previews/attacks.html`.
- **No Settings toggle sets it.** Nothing under `src/ui` or `src/systems` mentions `attackFx`, apart from a comment in `controller.js:1299`.
- **The save does not keep the key.** `DEFAULT_SETTINGS` has no `attackFx`, and `cleanSettings` (`save.js:358-396`) does not copy it. A scratch check (`tools/settings.mjs`) confirms it: a stored `attackFx: false` comes back `undefined` through `migrateProfile` and through serialize → deserialize.
  - So the two e2e scripts that seed `attackFx: false` into the save (round 5's aside) never reach the renderer, and "only the previews" is true in effect.
- **No "player's … setting" wording is left.** I searched the tree outside the review records. The b7ed2c2e commit message cannot change.
- **One older line still implies a profile setting:** `CONTRACTS.md:2128-2133` lists `attackFx` among the settings read from "the profile's live settings object". That is NIT-A.

## NIT-1: fixed

`tests/render/vfx-trail-optout.test.js:111` now reads "one girl per battle: her booth (the first) is beside the first lane". That matches the header, and nothing in the file says the shots meet the enemies any more.

## NIT-3: fixed

CONTRACTS.md's Attack FX paragraph (2148-2157) now wraps like its neighbours: no line is over 101 characters. The 163-character line is gone.

## The new pins

Each mutation was applied to the scratch copy, run against the guard and tornado tests, then restored, and the file was compared with 916d8aae (`logs/mutations.txt`, `logs/mut/*.log`).

| Mutation in `BattleRenderer.js` | Result |
|---|---|
| T1: the gate removed | caught, guard line 219 |
| T2: `(vfxOn \|\| true) &&` | caught, line 219 |
| T8b: the gate moved from the cast to the shell branch | caught, line 219 |
| T3: the shell branch spawns a column it cannot find | caught, line 220 (3 spawns) |
| T4: a second, ungated `abilityWarn` start | caught, line 220 |
| T7: the demo outside `tornadoSafe` | caught, line 221 |
| T5: the shell branch starts one through `api.tornadoDemo(…)` | passes |
| T6: a shadowing `const vfxOn = true;` in `handleEvents` | passes |
| T9: the gated text kept only in a comment, the live line ungated | passes |

| Mutation in `tornado.js` | Result |
|---|---|
| T10: `feed` starts a column for a missing record | passes |
| T11: `feed` throws on a missing record | passes |

- **"Removing the gate fails it" is true,** and so is every direct way around the gate.
- **T6 and T9 are the usual limits of a pin on the source text.** The existing hand-off pins share them.
- **T5, T10 and T11 matter more:**
  - T5 is a start that does not use `tornado.spawn(`.
  - T10 and T11 show that the claim "a shell then feeds nothing" is not pinned anywhere: the stale-record test never passes `undefined`.
  - Two cheap pins catch all three (NIT-B, validated).

## New findings

### LOW

**LOW-A. The release merge conflicts in CONTRACTS.md (pre-existing, docs only).**
- **Where:**
  - this branch's `CONTRACTS.md:2119-2125`;
  - `CONTRACTS.md:2117-2118` on 0f60e9e1 and 10cd203f.
- **What happens:** when the coordinator merges this branch onto main + `feature/vfx-tornado`, or with `feature/vfx-tornado-polish`, git stops on this hunk.
  - The conflict was already there at b7ed2c2e. No earlier round checked merges with the tornado branches.
  - Nothing a player sees depends on it, and nothing in the code conflicts.
- **Fix (either one):**
  1. **At the merge:** keep the tornado branches' two reworded lines, then this branch's five library lines (`r.lightningDemo`, `r.lightning`, `r.beamDemo`, `r.beams`, `r.shapes`).
     - This is validated: the result then merges cleanly with polish in either order, and the merged tree passes all of `tests/render`.
     - The resolved file is `/tmp/rvlib6/merge-CONTRACTS.resolved.md`.
  2. **Or before it, on this branch (docs only):** move the five library lines up, above `r.hdrProbe(...)`, so that one unchanged line separates them from the tornado lines.
     - This is validated: merge-tree is then clean with the tornado branch, main + tornado, polish and main, and (main + tornado) + polish is clean too.
     - The content is the same as fix 1; only the order of those lines differs.
     - The file is `/tmp/rvlib6/pre2-CONTRACTS.md`.
     - Simply copying the tornado branches' wording onto this branch is **not** enough: an add-beside-a-change conflict remains (checked).

### NIT

- **NIT-A. CONTRACTS.md still lists `attackFx` among the profile's settings** (`CONTRACTS.md:2128-2133`).
  - The line reads "Settings the renderer reads (`opts.settings`, the profile's live settings object): … `camera`, `buffIcons`, `attackFx`". Its neighbours `hitEffects` and `impactFrames` name their Settings toggles, so a reader takes `attackFx` for a player setting too.
  - **Fix:** "`attackFx` (set only by the previews: no Settings toggle, and the save does not keep it; see Attack FX below)".
  - This is validated: it adds no conflict of its own (scratch ref `P5`: the only hunk left is LOW-A's).
- **NIT-B. Two pins would close T5, T10 and T11** (`tests/render/vfx-library-guard.test.js`, after line 221).
  - **Fix:** add both:
    - `const t = createTornadoFx({ scene: new THREE.Scene(), quality: 'high' }); expect(() => t.feed(undefined, 0.45)).not.toThrow(); t.update(1 / 60); expect(t.live.length).toBe(0); expect(t.stats.visible).toBe(false);`
    - `expect(src.match(/tornadoDemo\(/g)).toHaveLength(1);`
  - They are validated as `tests/rv6/pins.test.js`: green at 916d8aae and on the merged tree's source, and they catch T5, T10 and T11.
  - Put them in the guard file, not in `vfx-tornado.test.js`, which the tornado branches also edit.
- **NIT-C. VFX.md's tornado section does not mention the option** (`docs/VFX.md:303-307`).
  - The Presets bullet still says the `abilityWarn` event starts the column, with no condition. Only the library's Setting line (352) says otherwise.
  - Round 5 suggested a Setting line here.
  - **Fix:** after line 307, add "  With the attack effects option off (`settings.attackFx === false`) no column starts (see the library's Setting line)."
  - This is validated: it merges cleanly with all three tornado refs. It sits between polish's two VFX.md hunks.
- **All the docs fixes together are validated too** (LOW-A fix 2, NIT-A and NIT-C; scratch ref `P4`). merge-tree is clean (exit 0) with origin/main, the tornado branch, main + tornado, and polish.

## Owner calls (not code defects)

1. **A player toggle (carried from round 5).** The option is preview-only today. If the owner wants players to have an "attack effects" toggle, that is a separate change with its own review:
   - a Settings row;
   - the key in `DEFAULT_SETTINGS` and `cleanSettings`;
   - a patch note;
   - the docs' "only the previews" lines.

   The two e2e scripts that seed `attackFx: false` would then start running with the plain look.
2. **LOW-A's fix:** fix 2 on this branch, or fix 1 at the merge. That is for the coordinator.

## Must-fix list

None. I recommend LOW-A, at least fix 1 written into the coordinator's merge notes. The NITs are optional.

## Scratch evidence (`/tmp/rvlib6`)

- **Scratch copy:** `tree/`, extracted from 916d8aae, with `node_modules` symlinked. Every mutated file was restored and compared with 916d8aae. The only difference left is the scratch `tests/rv6/`.
- **Scratch tests** (`tree/tests/rv6/`):
  - `tornado-off.test.js`: LOW-1 off and on, 10 tests, green;
  - `pins.test.js`: NIT-B (also run in `merged/tests/rv6/`: green).
- **Scratch repo:** `repo.git` (scratch refs main, tornado, polish, shapes, r5, mainT, X, S1, P2, P3, P4, P5).
- **Merged tree:** `merged/`, c99cafb2.
- **Merge files:**
  - `merge-CONTRACTS.resolved.md`: LOW-A fix 1;
  - `pre2-CONTRACTS.md`: LOW-A fix 2;
  - `pre3-VFX.md`: NIT-C.
- **Logs** (`logs/`):
  - `vitest-render.log`: gate 2;
  - `vitest-render-merged.log`: the merged tree;
  - `baseline.log`: the guard and tornado tests, green in the scratch copy;
  - `mutations.txt` and `mut/*.log`: the mutations;
  - `rv6-*.log`: the scratch tests;
  - `mt-*.txt`: the merge-trees;
  - `added.txt`, `msg.txt` and `names-big.txt`: the content scan.
- **Tools** (`tools/`):
  - `mutate.sh` and `mut.mjs`: the mutation runner;
  - `scan.mjs`: the content scan;
  - `settings.mjs`: the save drops `attackFx`.

I changed no tracked files, started no captures, and committed or pushed nothing.
