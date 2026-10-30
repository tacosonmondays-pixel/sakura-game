# Gear update M3 (LR gear): re-review r3

Targets: `origin/feature/gear-lr` at `c2eafc35` (`git diff a3079fb0 c2eafc35`) and `origin/spec/gear-update` at
`430e9e9a` (`git diff 2829739a 430e9e9a`). I read r2 (`review-r2.md`) and checked each r2 finding. I also looped over
every kit with five Blank LR and all-Pierce substats.

**Verdict: NOT OK.** One MEDIUM is left: the r2 #1 fix stops Pierce from counting twice, but for two kits the 200–300 %
band is now lost (it counts zero times). All the other r2 findings are fixed.

## r2 findings

| r2 | Status | Evidence |
|---|---|---|
| MEDIUM 1 Pierce twice | **no double count left; band lost on 2 kits** | `pierceUseCap` (`src/systems/gear.js:1042`) is used by both `gearFillIn` (`:1133`) and `pierceK` (`src/systems/progression.js:528`). No kit both fills in and reaches with the same Pierce. See MEDIUM 1 below. |
| MEDIUM 2 spec | fixed | `GEAR_UPDATE.md:494-500` records `SKILL_HASTE_CAP` 0.5 and `ULT_HASTE_MAX` 0.75, the same as `CONTRACTS.md:821-822` and `gearRules.js:82-89`. The bump table `:911` is updated. Row `:1091` marks G0, G1, G4, G5, G7 and G10–G12 **Deferred**. No "SKILL_HASTE_CAP 0.75" is left. |
| LOW 1 marks name | fixed | `gearMarks.js:256-260` sets `g.name = pieceName(g)` when it drops the set. Covered by the test at `tests/systems/gearUpdateSave.test.js:391`. |
| LOW 2 haste step | fixed | `GEAR_UPDATE.md:499-500`: the G1 and G4 runs must measure gear haste at 0.50 and at 0.51. |

## Findings

**MEDIUM 1: Tenka and Marumi lose Pierce between 200 and 300 % (it is neither used nor filled in).**
`blastKit` (`gear.js:1024`) looks for any `splash > 0` in the base and the paths. `applyGearReach`
(`src/sim/mods.js:850-854`) only widens `s.splash` on `projectile` or `turret` kits, and `s.trap.splash`. Two kits
count as blast kits but are never widened:
- **tenka**: her only splash is in `paths[1].ability.effect`, an ability that never reads Pierce.
- **marumi**: her behavior is `roll`. Her splash is not widened, and `balls.js` never reads Pierce.

With five Blank LR, both get `pierceK` 286 and no fill-in. A shot uses at most 200, since `pierceCarry` stops at
`PIERCE_MAX_EXTRA` 2 and pulses stop at 4 from 2 × k. At `a3079fb0` these two got the ATK fill-in instead. So for
these kits the r2 fix made things worse.
Wakaba (`drink.splash`) and Kohaku & Tsubaki (`mortar`) are also flagged wrongly, but no Pierce is lost for them:
Pierce is a dead stat in their kits, so it all fills in as lines.
*Fix:* `blastKit` should use the same test as `applyGearReach`. For each path at tier 5 (and a hero at level 25),
resolve her stats and ask whether `s.splash > 0` with behavior `projectile`/`turret`, or whether `s.trap?.splash > 0`.
`resolveStats` with `pierceK` 200 and then 300 tells you whether the band does anything. Add a loop test over all
`UNITS`. For a kit with live Pierce, either `pierceK` > 200 and some path widens, or `pierceK` is 200 and
`over` > 0.

**LOW 1 (owner's call): kits that blast on only some paths.** For yuki, fuu, ruri, iroha and ena, Pierce widens on
some paths and not on others. Examples: yuki 5-x-x is a pulse kit, and ena's paths 2 and 3 have no blasts.
`unitBattleStats` cannot know which path she will take, so on her shot paths the 200–300 % band does nothing. Say
this in the spec (§4) or in the Pierce tooltip. Per-path pierce in the sim would be a protocol change.

**LOW 2: Kogane's hero-level splash is missed.** Her splash comes from `hero.levels` (14, 19 and 23), which `blastKit`
does not walk. So she gets the ATK fill-in, but her blasts at level 25 could have used the reach. Pierce still counts
once and is not lost. The MEDIUM 1 fix (resolving at level 25) also fixes this.

## Checks

- **Every kit (39 units, five Blank LR, all-Pierce):** no kit both fills in and has `pierceK` > 200. 31 kits are
  right, including the 5 with dead Pierce, where all of it fills in as lines. The 2 kits in MEDIUM 1 lose the band, and the 6 kits in LOW 1 and LOW 2 are as described there.
- **Without LR gear:** I saved maxed UR profiles (random, all-Pierce and all-haste substats, every unit) on
  `origin/main` and loaded them on the M2 tip `9d94b3c5` and on `c2eafc35`. All of `unitBattleStats` and
  `gearFillIn` came out the same on M2 and M3 (0 differences). There are 12 differences against live, in
  `damageMul` and `dotMul` for suzu, wakaba and ouka. They all come from M2's approved "average crit or crit
  fill-in, never both" rule, not from M3.
- **Determinism:** `tools/simId.mjs` gives `c90dd47967c3`, which equals `PENDING_BUMP[13]`
  (`tests/art/itemArtRuntime.test.js:212`). `c2eafc35` changes no hashed file: the `pierceK` cap lives in
  `progression.js`, and each client sends its own stats. So re-pinning was not needed. `COOP_PROTOCOL` is still 13,
  which is correct while unshipped. `statLimits` `pierceK` ≤ 350 still covers it.
- **Tests:** full `npm test` at `c2eafc35`: 394 files passed, 2 skipped; 6250 tests passed, 11 skipped, 0 failed.
  `node e2e/smoke.mjs`: **ALL SMOKE CHECKS PASSED** (678 ok, exit 0).
