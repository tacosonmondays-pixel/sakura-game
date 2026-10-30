# Gear update M3 (LR gear): re-review r4

Target: `origin/feature/gear-lr` at `b68b79a4` (`git diff c2eafc35 b68b79a4`: `414e0819` and `b68b79a4`), with the
spec at `origin/spec/gear-update` `abc568ef` (§4.3). I read r3 (`review-r3.md`).

**Verdict: OK.** r3 MEDIUM 1 and LOW 2 are fixed. r3 LOW 1 is written down in the spec. Two LOW notes are left
(the tooltip text, and heroes below the level where their splash starts). Neither blocks.

## r3 findings

| r3 | Status | Evidence |
|---|---|---|
| MEDIUM 1 Tenka and Marumi lose the band | **fixed** | `blastKit` (`src/systems/gear.js:1028-1046`) now resolves her stats with `resolveStats` at `pierceK` 200 and at 300 (`PIERCE_K_MAX`) on 7 builds, and compares `s.splash` and `s.trap.splash`. That is the same test `applyGearReach` (`src/sim/mods.js:848-855`) runs. Tenka, Marumi, Wakaba and Kohaku & Tsubaki → `false`. |
| LOW 1 per-path kits | documented | `GEAR_UPDATE.md:511-514` (spec `abc568ef`). The tooltip part is LOW 1 below. |
| LOW 2 Kogane's hero levels | **fixed** | Heroes are resolved at `heroLevel` 25. `blastKit('kogane')` → `true`, `pierceK` 286, no fill-in. |

## Findings

**LOW 1: the Pierce hint does not cover the per-path case, and it says only "shots".** The spec (`:514`) says the
per-path case is "said in Pierce's tooltip text", but `STAT_HINTS.piercePct` (`src/data/gearStats.js:29`) only says
"for a girl without them, the rest turns into ATK". Ena on path 2 has blasts on another path, so a player reads that
the extra is used, but on that path it does nothing. Sweeps (pulses, `2 × k` up to `PULSE_MAX_EXTRA`) and lightning
also stop at 200, not only shots. *Fix (text only):* "…Shots, sweeps and lightning use up to 200%. Only blasts and
traps use more: a girl with none turns the rest into ATK, and on a path without them it does nothing." The hint is a
native `title` (`src/ui/girlGear.js:488`, `src/ui/gearUr.js:110`). At 390×844 on touch, no `title` shows at all.
This is true of every hint from before M3, so it is not a regression and there is no layout risk.

**LOW 2 (owner's call, like r3 LOW 1): a hero below the level where her splash starts.** Kogane only widens from
hero Lv 15 (in my loop, levels 1–25). `blastKit` checks Lv 25 only. So a Kogane below Lv 15 with five Blank LR gets
`pierceK` 286 and no fill-in, and the band does nothing until Lv 15. This is the same as the per-path case: it
fixes itself as she levels. *Fix:* add one clause to `GEAR_UPDATE.md` §4.3 "Per path". Nami and Norika widen from
Lv 1.

## Checks

- **My own loop (every unit, not the branch's test):** 39 units, five Blank LR, all-Pierce. For each kit I resolved
  **every** tier combination (0…n per path), or a hero at each level 1–25, at `pierceK` 200 and at 300. Results:
  - 16 kits: `pierceK` 286, ATK 0, and something widens (akane, sango, midori, suzu, yuki, fuu, ruri, iroha, ena,
    kogane, nami, norika, …).
  - 18 kits: `pierceK` 200, ATK fill-in 0.858, and nothing widens. This includes **Tenka and Marumi**.
  - 5 dead-Pierce kits (umeko, miko, wakaba, ouka, kohaku_tsubaki): Pierce fills in as lines.
  - No kit is in both groups, no kit is in neither, and the exhaustive search agrees with `blastKit` on all 39.
  - Per path at tier 5: yuki `-WW`, fuu `-W-`, ruri `W-W`, iroha `--W`, ena `W--`.
  - Adding Potential 1–6 never adds a splash the reach test misses (0 differences).
- **Deterministic and cheap:** `resolveStats` is pure (`UNITS` is unchanged after every call). It runs at most 14 times
  per unit, once, and is then cached in the `BLAST_KITS` Map. Only `pierceUseCap` calls it, from `gearFillIn` and
  `unitBattleStats`. Those are profile-side and never run per frame. A warm pass over all 39 units takes 0.02 ms.
  `src/sim/mods.js` imports nothing from `src/systems`, so there is no import cycle.
- **Without LR gear:** with no gear and with UR non-LR gear (all-Pierce, mixed and random set lines), I dumped
  `unitBattleStats` and `gearFillIn` for 156 profile/unit cases on `9d94b3c5` and on `b68b79a4`: 0 differences.
  Against `origin/main` with no gear, every field that exists on both is equal. M3 only adds fields with neutral
  values (`blastK` 0, `avgCrit` 1, …).
- **Determinism:** `simId()` = `c90dd47967c3` = `PENDING_BUMP[13]` (`tests/art/itemArtRuntime.test.js:212`). Nothing
  under `src/sim`, `src/online` or `src/data/coop.js` changed in the diff, and `systems/gear.js` is not hashed.
  `COOP_PROTOCOL` is 13 on main and on the branch, which is correct while M3 is unshipped.
- **Tests:** full `npm test` at `b68b79a4`: 394 files passed, 2 skipped; 6251 tests passed, 11 skipped, 0 failed.
  `node e2e/smoke.mjs`: **ALL SMOKE CHECKS PASSED** (678 ok, exit 0).
