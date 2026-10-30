# Gear update M3 (LR gear): re-review r2

Target: `origin/feature/gear-lr` at `a3079fb0`. I read the M3 fix commits `0103c469` and `5bf79b9a`, and the merged M3
files in the tree. M0 and M2 underneath were already approved, so they were not re-reviewed.

**Verdict: NOT OK.** There is 1 MEDIUM (a problem the r1 fix introduced) and 1 MEDIUM on docs (part of r1 #4 still
open). The other r1 findings are fixed.

## r1 findings

| r1 | Status | Evidence |
|---|---|---|
| M1 caps shown | fixed | `unitGearCaps` (`src/systems/gear.js:1018`) is read by `gearTotals` (`src/ui/gearUr.js:147`), the stitch `atCap` check (`:411`), `gearShare` and `gearTotalsRows` (`src/ui/gearView.js:27,70`). No `BATTLE_CAPS` is left in either UI file. |
| M2 stitch preview | fixed | `step = subGrowth × readMul(g, stat)` (`gearUr.js:409`), and powerPreview divides by `readMul`. Scratch test: on Set LR and Blank LR, all three stitches (gold, rainbow, Nightglass) give exactly the preview step. |
| M3 tests | fixed | `tests/systems/lrGear.test.js:149-215` covers titanMayhem wins and sweeps, the Hunt (8-5 gate, 1 Lens), w225 once per tier and both achievements. `tests/sim/setSim.test.js` covers the Bake Sale discount and a free upgrade. |
| M4 haste (code) | fixed | `src/sim/hero.js:119`. Scratch test: compared with `origin/main`'s `ultCooldown` over every 4-decimal gear haste from 0 to 0.5000 × Potential haste 0 to 0.40, the results are bit-identical. That is the only value range `unitBattleStats` can produce without LR gear (`ultHaste = r4(min(B.ultHaste, g))`, where B excludes set caps, so a Power Bank 5-piece cannot reach the new branch). |
| M4 haste (spec), gates | **open** | See MEDIUM 2. |
| M4 achievements | fixed | `src/data/achievements.js:216-219`, wave `gear`. `ach:lrForm` is set from `noteUrWorn`, both on equip and on a Limit Break of a piece she is wearing. |
| LOW bakeW | fixed | `src/sim/Sim.js:1380`. It is set only when `st.cost > 0`, and it is in the snapshot `GEAR_FIELDS`. |
| LOW Blank LR name | fixed | `gear.js:833` (see LOW 1 for the save-repair path). |
| LOW confirm | fixed | `gearUr.js:654`, `danger: true` |
| LOW gearCaps rounding | fixed | `gear.js:1010` |
| LOW Pierce | fixed, but it over-reaches | See MEDIUM 1. |
| LOW Needle text, TRACK_EVENTS, BLANK_FIVE, results | fixed | |

## Findings

**MEDIUM 1: with five Blank LR, Pierce between 200 and 300 % counts twice for blast and trap kits.**
`src/systems/gear.js:1106-1107` now treats Pierce above `PIERCE_SHOT_PCT` (200 %) as over the cap for every girl
except a 5-piece Party Popper. But `pierceK` is still capped at `B.piercePct`, which is 300 % with five Blank LR
(`src/systems/progression.js:527`). `applyGearReach` widens blasts and traps up to `PIERCE_K_MAX` 300
(`src/sim/mods.js:850-854`). So a splash or trap girl gets the extra 100 % twice: wider blasts and ATK fill-in.
Scratch test: aoi in five Blank LR with all-Pierce substats reads `pierceK` > 200 and also shows a Pierce `over`
part greater than 0. This exclusion is the same reason the Popper case was left out, applied to every kit that uses
blasts or traps. Only five Blank LR can reach Pierce above 200 % (LR caps top out at 150 + 5 × 10 %).
*Fix:* fill in above 200 % only when her kit has no blast and no trap splash (the same check as `applyGearReach`),
or cap `pierceK` at 200 for the girls whose surplus fills in. Add a test with one splash tower and one single-target
tower. This is a sim-side change, so re-pin `PENDING_BUMP`.

**MEDIUM 2 (docs): the r1 #4 records are not made.** `CONTRACTS.md:820-823` records the haste split. The spec branch
does not: `origin/spec/gear-update` is still at `2829739a`, from before the fix. `GEAR_UPDATE.md:493` and the `:899`
table still say "`SKILL_HASTE_CAP` 0.75", and gates G0, G1, G4, G5, G7 and G10–G12 are not marked deferred
anywhere. The M3 row (`:1079`) still lists them as required.
*Fix:* add a spec commit that records the split (`ULT_HASTE_MAX` 0.75, with Potential haste stacked above 50 % gear
haste) and marks those gates deferred to before M3 ships.

**LOW 1: the save-repair path keeps the set's name.** `src/systems/gearMarks.js:255-256` restores a Blank LR piece
from its `lr:` mark and deletes `set`, but `:441` renames it with `lrName(g.name)`, not `pieceName(g)`. A Blank LR
piece made from a set piece and restored from marks gets the set piece's name back.
*Fix:* when the restore deletes a set, set `g.name = pieceName(g)`, the same as `limitBreakGear` does.

**LOW 2 (balance note, not a bug): an ult haste jump.** A hero at 0.50 gear haste with 0.2 Potential haste has a
0.50 cooldown factor. At 0.51 gear haste it is 0.29: one LR cap step (+1 %) is worth up to +21 % ult haste. This
follows the requested rule. The deferred G1 and G4 runs should measure it.

## Checks

- **Determinism:** `tools/simId.mjs` gives `c90dd47967c3`, which matches `PENDING_BUMP[13]`
  (`tests/art/itemArtRuntime.test.js:212`). `COOP_PROTOCOL` is still 13, which is correct while unshipped.
  `bakeW` is deterministic and is saved in the battle snapshot.
- **Economy:** salvaging LR gear returns its 1 Lens (`gear.js:709`) and half the coins invested in levels. The
  150,000 Limit Break coins are not returned, so there is no Lens or coin loop. A Limit Break needs the UR +12
  piece, and salvage destroys it. The marks repair refunds the Lens and half the LR levels (`gearMarks.js:266-267`).
  w225 is once per tier, and the Hunt pays once a week behind 8-5.
- **Heroes without LR gear:** ult haste is bit-identical to live (above). Pierce fill-in is unchanged for them, since
  their Pierce cap is ≤ 200.
- **Tests:** full `npm test` at `a3079fb0`: 394 files passed, 2 skipped; 6249 tests passed, 11 skipped, 0 failed
  (the same counts on a clean re-run).
  `node e2e/smoke.mjs`: **ALL SMOKE CHECKS PASSED** (678 ok, all three viewports, exit 0). Both r1 smoke failures
  now pass: the wiki top bar ("every top bar control on screen and on top") and `outfit-wear-aoi_sentinel`
  ("Wear saves Sentinel Style"). Nothing failed, so there was nothing to re-run as a flake.
