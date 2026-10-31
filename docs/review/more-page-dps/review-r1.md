# Review r1: `feature/more-page-dps` @ 7467f96f (code 1f8f895, off main eb0b1ab9 / v0.1.67)

Independent reviewer, fresh clone. Owner's ask: "show everyone's actual dps, not just chika; luna doesn't show all the info in the more page."

## Verdict: **OK**

The change only displays data. Its numbers match the data and the sim's credits, every damage dealer gets DPS cells, layout is clean at all three sizes, and it adds no measurable frame cost. There are no blockers.

One **Medium** (kit rows with live counts go stale while the drawer stays open) should be fixed before ship; it is a cheap fix. The rest are Lows.

## 1. Display only

- **Code read.** `kitRows.js` and every `towerPanel.js` hunk only read. The new live line (`towerPanel.js:1318`) calls `damageSplit(t)`, which reads `damageDealt`, `shapeDealt`, `droneDmg` and `eff`, and only sets `textContent`.
- **The one indirect path.** `mirrorsReflect` (`src/sim/mirrors.js:125`) goes through `abilityDef` and then `mergedTower`. That fills `T5_CACHE` (`src/sim/abilities.js:96`), a module-level memo of `Object.freeze`d merged data that the sim fills itself. It is a pure function of (entry, tier, lr), so it changes no state and does not touch the hash. Not a finding.
- **My own write trap.** I wrapped every tower and `towerStats` in a recursive Proxy that records every set, define and delete. I called `kitRows`, `dealsDamage` and `damageSplit` on **all 39 units × 9 builds** (each path at tier 5, plus 5-2-0, 5-0-2, 2-5-0, 0-5-2, 2-0-5 and 0-2-5; heroes at Lv 25), **287 builds** in all, after 10 s of fighting. Result: **0 writes**. `hashSim` from `src/online/coop/simHash.js` was identical before and after on all 287 builds.
- **Sim id.** `simId()` from `tools/simId.mjs` returns **`0fe7c5c04aec`**. The diff touches no file under `SIM_ENTRIES`. `COOP_PROTOCOL` is still 15.
- **`node e2e/engines.mjs`: OK.** Node V8, Bun (JavaScriptCore) and Chrome 153 computed identical results for every scripted co-op run, including the Tenka, abilities, S1–S5b shapes, drones, freeplay, Extended Day and rejoin runs. Firefox and WebKit are not installed here, so they were skipped.

## 2. Numbers

### Spot checks against `src/data/*`

| Kit | Data | Row |
|---|---|---|
| Luna Lv 25 Moonbeam | `heroTracks.js:132,135`: beams 2, arc 30 steps, mul 0.35 | `2 beams · ±45° sweep · 35% of her hit` ✓ |
| Iroha 5-0-0 mirrors | `unitsExpansion.js:473-481` | `5/5 placed · 5 bounces`, allies 2 bounces, reach 3.7 ✓ |
| Iroha 0-5-0 mirrors | reach 3.7+0.6+0.8, bounceMul 0.15+0.15+0.1+0.1 | reach 5.1, +50% a bounce, 4 mirrors, 5 bounces ✓ |
| Iroha 0-0-5 mirrors | splash 0.8+0.4+0.3, shards | splash 1.5 · 1 shard ✓ |
| Midori 0-0-5 Spore Mist | `units.js:911` half 36, cap 96, mul 0.65, dot 0.6 | `108° cone · up to 96 · 65% … · spores 60%` ✓ |
| Suzu 5-0-0 Bell Toll | `units.js:964` every 1.2 s, 1.4 tiles, ×0.2 | `every 1.2s · 1.4 tiles ring · 20% of a trap hit` ✓ |
| Duo 0-5-0 / 0-0-5 prism | beamDmg × beamMul (24.92 × 11.7, 7 × 150), beams, pierce, ramp | `4 beams · 292 dmg · … pierce 8 · ramp +60%`; `1 beam · 1,050 dmg`; refraction `every 1 shell · 5 shards · slow 20% · +12% taken` ✓ |
| Tenka 5-0-0 lab | `units.js:1374` rounds 2, power 3 | `round 2 of 2 · … · weapons ×3` ✓ |
| Tenka 0-0-5 well / Last Line | `units.js:1386-1388` | `every 8s · 2 tiles · 6s · slow 30% · +20% taken`; `up to 30 · 8s · 2:00 recharge` ✓ |
| Chigusa vines | `unitsNewGirls.js:376-397` | Bloom up to +200% (0.6+0.6+0.8) ✓. 0-5-0: 2 vines, every 2.5 s, 4 tiles, hold 2 s, slow 35% ✓. Lash and bed damage show the effective (scaled) values ✓. Harvest +3 lives ✓ |

### Damage by source

The sim adds `shapeDealt` (`Sim.js:661,805`) and `droneDmg` (`Sim.js:821`) on top of the credit to `damageDealt`, so both are subsets of it. On all 287 builds the split's shares summed to 1 (within 1e-6), no part was negative, and `shapeDealt + droneDmg ≤ damageDealt` always held. The unit test also asserts that the shape part equals `t.shapeDealt`.

### "Moonbeam 0%" is honest

`moonPass` (`s5shapes.js:440`) seeds each beam's struck list with her volley's victims (`t._struck`), so the beam only hits enemies her 6-beam, pierce-12 volley missed.

I ran Luna at Lv 25 (with `damageDealt` reset after leveling) against crowds of different sizes:

| Crowd | Shape damage | Split |
|---|---|---|
| 10 enemies | 0 | Moonbeam 0% |
| 40 enemies | 189 of 53.7k | Moonbeam 0% (rounded) |
| 80 enemies | 1,124 of 72.4k | Moonbeam 2% |

So the claim holds: Moonbeam only gets a share once the crowd is bigger than her volley. See L4 for showing tiny shares better.

## 3. Coverage

My 287-build run (all units, 9 builds each) found:

- **No unit** that dealt damage without DPS cells.
- **No unit** that had DPS cells and dealt nothing.

Notable units:

- **Heroes.** I leveled them with `_credit(1e9)` and then **reset `damageDealt` to 0**, so the check is not trivial. All 8 heroes (Hikari, Luna, Nami, Kanna, Yoriko, Seiran, **Kogane**, **Norika**) have `dealsDamage` true before the fight starts, through `st.dps > 0`.
- **Wakaba.** Towel Snap builds (0-0-5, 2-0-5, 0-2-5) show DPS cells. Her paths 1 and 2 have none.
- **Ouka.** No DPS cells at any build.

In the app, Ouka shows "Boost to allies" and no DPS cells (e2e). Wakaba 0-2-5 shows DPS 0 / avg 0.9–1.5 *and* "Boost to allies ~820 DPS · 8 girls". That is honest: her towel deals 2 damage.

Row checks:

- No row value anywhere contained NaN, undefined, Infinity, null or `[object`.
- Every object kit piece in `t.eff` has a row; the branch's own test covers this.

## 4. Layout and performance

**Layout.** I wrote my own Playwright script on map 1-3 with Kogane (Lv 25) plus the longest kits: duo 0-5-2, Tenka 2-0-5, Chigusa 2-5-0, Wakaba 0-2-5 and Midori 0-2-5, on a 150-enemy wave. At **390x844, 844x390 and 1280x720**:

- no sideways scroll;
- no cell, chip or line spilling past the drawer or the screen;
- no NaN or undefined in the drawer text.

Stills are in this folder: `r1-*.jpg`, each 44–120 KB.

> A Kogane still at 390x844 came out at 40% opacity: the drawer's `bt-sheet-up` animation clock was stuck at 0. **Main shows exactly the same animation state** (one render in 3 s, `currentTime` 0) in this software-WebGL headless browser, so it is a harness artifact, not a regression. I left that still out.

**Performance.** The new live work per frame is one `damageSplit` (O(1)) and one string compare. `kitRows` runs only when the drawer re-renders: the signature gains a single `d` the first time she deals damage.

Measured: `ui.panel.update()` timed over 300 sim steps with the More page open, on a 150-enemy wave at 1280x720. Values are mean / p95 in ms.

| Unit | Branch | Main |
|---|---|---|
| Midori | 0.51 / 1.0 | 0.56 / 1.3 |
| Duo | 0.24 / 0.4 | 0.24 / 0.6 |
| Chigusa | 0.42 / 0.9 | 0.47 / 1.0 |
| Hero Kogane | 0.56 / 1.1 | 0.43 / 0.7 |

The hero is about +0.1 ms because it now has the full grid; everything is within noise and far under a 16.7 ms frame. This shows no measurable frame cost.

## 5. Tests

| Run | Result |
|---|---|
| `npm test` (full, under load from parallel e2e) | 6,772 passed, 3 failed, 11 skipped (6,786) |
| Those 3 re-run alone (`store`, `coopPotential`, `perf.mirror`) | 17/17 pass, on both the branch and main (load flakes: two 5 s timeouts and one wall-clock budget) |
| `tests/battle-ui/kitRows.test.js` | 48/48 |
| `node e2e/more-page.mjs` | all checks pass, 81 ok (27 × 3 viewports) |
| `node e2e/smoke.mjs` | 676/678; the 2 failures are the known "drag (touch)" ones |
| `node e2e/engines.mjs` | OK (V8, JavaScriptCore) |

## Findings

### M1 (Medium): kit rows with live counts go stale while the drawer stays open

- **Where.** `src/ui/battle/kitRows.js:143` (Vines `n/max`), `:154` (Sentries `n/max`), `:166` (Barricades up `n/count`) and `:168` (Lab `round n` and `n girls`).
- **What happens.** These rows are built only in `render()`. The drawer's `signature()` (`towerPanel.js:171`) has none of these counts (mirrors do have `mirrorSig`), and `updateLive` does not repaint them.
- **Reproduced.** Chigusa 2-5-0 with More open: the row read **"2/2"** for 4.5 s of sim time while `t.vines.length` went 2 → 1.
- **Fix.** Either add the counts to the signature (``|${t.vines?.length||0},${t.sentries?.length||0},${(t.bars||[]).filter(b=>!b.down).length},${t.lab?.rounds||0}``), or give those cells a `live.kitCounts` entry in `updateLive`. Alternatively, drop the live count and show only the cap.

### L1 (Low): Iroha's "Allies' shots … while her ⚡ runs" shows when her ⚡ is locked

- **Where.** `kitRows.js:125`.
- **What happens.** At 0-5-0, 0-0-5 and 2-0-5 (the e2e build), her ability row says "Laser Web · Mirror Hall tier 3", so the ability is locked. Yet the allies' row promises reflection "while her ⚡ runs", which cannot happen yet.
- **Fix.** When `!st.ability?.unlocked`, say "once her ⚡ unlocks", or omit the row.

### L2 (Low): the test's "sim hash unchanged" assertion never runs

- **Where.** `tests/battle-ui/kitRows.test.js:133,138`.
- **What happens.** `Sim` has no `hash()` method, so `hash` is `undefined` and the check is skipped.
- **Fix.** `import { hashSim } from '../../src/online/coop/simHash.js'` and compare `JSON.stringify(hashSim(sim))` before and after.
- The JSON snapshot there also covers only six fields. A Proxy write trap like mine covers everything.

### L3 (Low): the hero coverage check is vacuous

- **Where.** `kitRows.test.js:28,53`.
- **What happens.** `sim._credit(t, 1e9)` sets `damageDealt` to 1e9. `dealsDamage` is then true through `damageDealt > 0` whatever the hero's kit, and the before-the-fight check is computed after the credit. It also makes a hero's damage split meaningless (the shape share is about 0 against 1e9).
- **Fix.** Add `t.damageDealt = 0` after leveling, as `e2e/more-page.mjs` already does. My run with the reset passes for all 8 heroes, so this is a test gap, not a bug.

### L4 (Low): small shares round to "0%"

- **Where.** `kitRows.js:79` (`pct`).
- **What happens.** Luna's Moonbeam at 189 of 53.7k reads "Moonbeam 0%". The live Luna still in the branch shows "Attack 100% · Moonbeam 0%", high on her More page.
- **Fix.** Show "<1%" when 0 < share < 0.005, and "—" when the shape has dealt nothing. This keeps it honest without reading as broken.

### L5 (Low, copy): the locked ability row is ambiguous

- **Where.** `kitRows.js:90`.
- **What happens.** "Prismfall · Refraction tier 3" does not say "unlocks at". For the duo, "Refraction" is also the label of the kit row just above.
- **Fix.** Use "unlocks at Refraction tier 3".

### L6 (Low, process): no patch note on the branch

`src/data/patchNotes.js` is untouched. A top entry is needed before this lands on `main` (CLAUDE.md).

### Info

- `damageSplit` subtracts `shapeDealt` and `droneDmg` separately. A hit that is both a drone's and `spec.shape` would be counted twice. No such unit exists today; worth a comment.
- The audit says the fights lasted 8 s; the test uses 6 s. Cosmetic.

*Reviewer scripts (Proxy write trap, 287-build sweep, layout and perf harness) were kept outside the repo and are not committed.*
