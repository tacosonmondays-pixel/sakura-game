# S5a build review, round 1

Target: `origin/feature/attack-shapes-s5` at 7b6d0c9c (Miko's Charm Wheel, Rei's Crescent Return with the densest-line aim, Suzu's Bell Toll, and the shared S5 base). Base: `origin/feature/balance-r5` 04bcc258 (the merge-base). Reviewed: `git diff 04bcc258 7b6d0c9c`, without the spec doc's own history. Every run below was made by the reviewer on clean worktrees of both shas.

**Verdict: OK.** No HIGH and no MEDIUM. Seven LOWs, none blocking. The release still needs the `COOP_PROTOCOL` bump (see the last section).

## Runs (reviewer's own)

| Check | Result |
|---|---|
| `npm test` (full, at 7b6d0c9c, after the aim commit 646fe84d) | 401 files passed, 2 skipped; **6,305 tests passed**, 11 skipped; exit 0 |
| `node e2e/smoke.mjs` | ALL SMOKE CHECKS PASSED (678 ok, three viewports) |
| `node e2e/engines.mjs` | OK: 3 runs on 2 engines (Node V8, Bun JavaScriptCore, Chromium V8). S5a battle on all three: ticks 32480, won w22, cres/charm/toll/rung 1045/159/66/3121, final 2356239460, 64 checkpoints → 39790359, mid-wave rejoin from the w3 checkpoint at tick 7560 lands on the run. Firefox and WebKit are not installed here |
| Perf, `tests/sim/perf.test.js` "S5a" (best of 3) | **0.202 ms a step** (runs: 0.425 / 0.202 / 0.273; limit 2 ms). S2–S4 cases read the same as before (0.21–0.39) |
| `tools/balance/lrBar.mjs` | All six LR builds pass: crowd ×1.39–1.40, boss ×2.36–4.74 of the bar (≥ 1.25) |

### No-nerf gate (`tools/balance/noNerfGate.mjs`, live = 04bcc258; the three tools are byte-identical in both trees)

| Pass | cells | missing | under live ×0.995 | bit-identical | changed (all ≥ ×1.10) |
|---|---:|---:|---:|---:|---:|
| Umeko + Midori | 4,455 | 0 | **0** | 4,428 | 27 (Rei 6, Miko 6, Suzu 15) |
| alone | 4,455 | 0 | **0** | 4,425 | 30 (Rei 6, Miko 6, Suzu 18) |

No cell of any other girl moved. Rei's and Miko's boss and walking-boss cells are bit-identical in every profile. The maxed rows (live → S5a) match §15 exactly:

| Cell | Supported | Alone |
|---|---|---|
| Rei T4 / T5 crowd | 122,978 → 146,887 ×1.19 / 1.82M → 2.07M ×1.14 | 11,851 → 14,137 ×1.19 / 171,136 → 199,090 ×1.16 |
| Miko T4 / T5 crowd | 45,842 → 54,813 ×1.20 / 385,250 → 445,445 ×1.16 | 4,411 → 5,279 ×1.20 / 35,565 → 41,457 ×1.17 |
| Suzu T4 crowd / walking | ×1.11 / ×1.19 | ×1.13 / ×1.20; boss 0 → 87 |
| Suzu T5 crowd / walking / boss | ×1.12 / ×1.44 / 0 → 6,462 | ×1.10 / ×1.38 / ×2.37 |

## Spec rules in code

- **Rule 5 (shape shots never evict or block live ones).** `straightRoom` skips shape shots when it counts and when it evicts (`src/sim/rings.js:43`, `:53`). `shapeRoom` evicts only `p.shape` shots (`rings.js:87`). Probe: 6 Kinu (bobbin 5 / iron 2), 3 Fuu (gale 5) and 3 Momo (orchard 5) across both players, with 3 Mikos and 3 Reis at T4–5, on a healed crowd. Off-map filler held 185, 195 and 200 live straights per player, so the field sat at the 400 cap. Against the live data, the live-straight count was identical on every one of 1,800 steps. Every girl's live damage was identical, and the rng drew 1,198 times on both sides. At 200 a player, every shape skips.
- **Tolls never block Kanna.** `sendToll` counts and pushes only `t.tolls` (`src/sim/s5shapes.js:218-229`). `groundTick` and `room()` are untouched. `tollTick` runs under its own guard before the sabotage check (`src/sim/towers.js:2057`).
- **Rule 6 (partners' picks).** The brew window (`src/sim/buffs.js:220-222`), the rally pick (`src/sim/abilities.js:719`) and the drink target (`src/sim/drinks.js:35`) read `allocDealt`. `projectedDps` has no S5 line. Probe: Rei at 400 live + 600 shape damage beside Kage at 500. Both the drink and the rally go to Kage.
- **Ena (noShare).** `src/sim/Sim.js:599` checks `!spec.noShare`. `shapeSpec` sets it (`src/sim/shapes.js:134`). Test: `s5shapes.test.js:353`.
- **A lone held boss reads exactly live (Miko, Rei).** The skip list is a copy of `t._struck` (`s5shapes.js:86`, `:165`). It is filled from the volley's targets (`towers.js:881`), the pulse's victims (`:927`) and the beam's hits (`:1162`). `crescentAim` returns her lead's line when no unstruck walker is in reach (`s5shapes.js:122`). The gate's boss cells are bit-identical.
- **Crescent.** It has its own cut branch and never touches `p.pierce` (`towers.js:2244-2248`). The flip at maxTravel is `towers.js:2260`. `crescentFlip` is an exact negation (`s5shapes.js:190-201`).

## Determinism

There is no rng, `Math.random`, trig, hypot or `**` in `s5shapes.js` (`dirAngle` only sets the render-only `facing`, which only Kage's doubles read). Timers are integers: `tollCd`, and the ring's step count `g`. `crescentAim` sorts by (d², uid), and ties go by direction gap, then the lower table index. The grid query has a 0.5 pad, so the crescent's 0.45 half-width is covered. Calm saves carry no shape objects. `endS5Wave` (`s5shapes.js:260-266`) clears tolls and `wheelK` and sets `tollCd` to 1, and a restored trap reads `?? 1` both in `tollBell` and in the hash (`src/online/coop/simHash.js:181`). The engines rejoin covers a mid-wave rejoin with a crescent, charms and a toll ring live, and a w3 checkpoint taken after bells survived a wave clear. The hash folds apply only while present, so old battles keep their digests (all older engines pins hold).

## The four §15 deviations

All four are sound.

1. Suzu's knob was raised. That is gain only, and it lands in Q9's band (alone T5 crowd is ×1.103, just over the floor).
2. No panel line. The panel is her one-target figure, and S5a adds nothing on one target (Suzu's trap panel is 0 in live). Mark the §2 "Shape DPS" row and the §8 "drawer test" row as superseded.
3. Gear Pierce does not add crescent cuts. That is correct: asking `pierceCarry` again would move her live pulse.
4. An echo adds to the same throw. This gives fewer crescents than the spec but never fewer than live. The tier text does not promise an echo crescent.

## Renderers

The toll rings are a plain alpha ring in the shared ground batch, with no additive blend, inside the flash guard (`src/render/groundShapes.js:91-100`, the same as the quakes). The charm and crescent geometries are built once with the projectile geometry set (`src/render/actors.js:103-107`), so nothing is allocated per frame. Their spin uses the existing `SPIN_KINDS` path, which behaves under Reduce motion as shuriken do.

## Findings

**HIGH:** none. **MEDIUM:** none.

**LOW**

1. **`shapeRoom` can evict another player's shape shots without freeing per-player room** (`src/sim/rings.js:81-95`). `over` is one counter for the per-player and per-sim caps. In pass 2 it evicts any player's shape shot and counts it against a per-player overflow. Probe: player 0 has 200 live straights and player 1 has 20 charms. A player-0 Miko gets `fit` 9, player 1 loses 9 charms, and player 0 holds 209 straights. There is no live or gate effect, because `straightRoom` ignores shape shots. Live `straightRoom` has the same pattern. Fix: keep `overPlayer` and `overAll` apart, decrement `overPlayer` only in passes 0–1, and return `n − max(overMine, overPlayer, overAll)`.
2. **`tollCd` is not in the trap record** (spec §2 "Battle-save classes"). The build relies on `?? 1` (`s5shapes.js:209`, `simHash.js:181`). That is equivalent at every calm point. Record it in §15 and CONTRACTS.
3. **No test for the drink or rally pick beside an S5 girl** (spec §7.5). The reviewer's probe passes. Add a two-line case beside `s5shapes.test.js:388`, with Suzu in the brewer test too.
4. **The perf stress never reaches the toll caps** (at most 6 rings against 32/128). Add a sparse-road or Bell Carpet variant.
5. **`e2e/engines.mjs:549`'s OK line still says "S1, S2, S3 and S4"**. It should add S5a.
6. **Plain looks.** §6's bell wobble on her trap sprite is not built, and the crescent is a closed torus (`actors.js:107`). Both are cosmetic and can follow on the effects track.
7. **Release gate.** There is no `COOP_PROTOCOL` bump on the branch (`PENDING_BUMP {13: 722edb51def8}`, `tests/art/itemArtRuntime.test.js:212`). Bump once at S5's release, and run `engines.mjs --require-all` where SpiderMonkey and WebKit exist.
