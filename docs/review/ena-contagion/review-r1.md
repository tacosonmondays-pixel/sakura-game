# Review r1: Ena's spreading hex (`feature/ena-contagion`)

- Reviewed `6c679dfe75aa5a0eb269a4c980534e9328c08d78`, diff `b19c86f9..6c679dfe`. `b19c86f9` is on `origin/feature/balance-r5` and is the merge base.
- I did not build this change. It changes the battle sim, so I reviewed it at the strict level.

## Verdict

**OK.** There is no BLOCKER, HIGH or MEDIUM finding. The seven LOW findings below are optional follow-ups. None of them affects determinism or balance.

## What I ran

Every command ran under `nice`. I did not run the full suite.

| Run | Result |
|---|---|
| `tests/sim/mechanics-merge`, `tests/sim/snapshot`, `tests/sim/tryoutGolden`, `tests/data/abilities`, `tests/data/units`, `tests/art/itemArtRuntime` | all pass |
| `tests/online/engines`, `tests/online/coopAbilities` | 41/41 pass |
| `tests/battle-ui/snapshot`, `tests/battle-ui/battleSaveFreeplay`, `tests/sim/battleSaveGrandfather`, `tests/sim/perf` (run on its own) | 127/127 pass |
| `tests/sim/perf` run in parallel with six other files (load average 10–14 on 4 cores) | all four of its budget checks failed, including the three scenarios with no Ena (200 enemies + 30 towers, ground shapes, long beam). Run on its own it passes. This is the machine's load, not this change. |
| Ad hoc: 12 Garden of Calamity Enas with 400 / 1500 immortal walkers on the perf map, base vs head | 0.31 → 0.57 ms/step and 0.70 → 0.80 ms/step. Up to 870 enemies were cursed at once, with 1068 passes in 1200 steps. Cheap. |
| Ad hoc: mid-wave snapshot → JSON → restore into a fresh Sim. 95 enemies were rotting and 88 spread timers were mid-count. Both copies then ran 1200 steps. | 20/20 checks: equal `snapshotDigest` and `hashSim` |
| `tools/balance/teamCrowd.mjs kage --build p0t5 --partner ena:p0t5 --hp 2e6 --seeds 9` | Ena 2.18M. BALANCE.md gives 2.15M averaged over 3 seeds, so this matches. |
| `tools/capBot.mjs --build AE --seed 7 --maxWave 120 --shares` | Reached wave 120 with no leak. Ena's share was 2.3% and Shiro's 83.6%, so she is not absurd in late Freeplay. |
| Ad hoc: the same 12-tower crowd bench for Kage (path 0) on base and head | 2,812,431 on both: Kage's number is identical |
| Ad hoc: Tryout seed 1212 (grade 12, half day, maxed) | Ena is in the run (aoi, ena, hikari, kage, yuki, yuzuha) and her rot deals 16,048. It is still won on wave 28. |

## 1. Determinism: OK

- **Integer counters.** `spreadIn` is a whole number of steps. It is set to `CURSE_SPREAD_STEPS` (60) in `src/sim/status.js:68` and `:97`, counts down by 1 per `updateEnemy` in `src/sim/Sim.js:871`, and is reset at `Sim.js:890`. `updateEnemy` is called once per enemy per step (`Sim.js:385`, `src/sim/enemies.js:495`), and there are no float timers. The rot is `rotDps × dt` (`Sim.js:869`), which is plain IEEE arithmetic.
- **Grid query order.** `SpatialGrid.query` (`src/sim/grid.js:50`) walks the cells row by row, then each cell's array in insertion order. Insertion order is `sim.enemies` order, from `grid.rebuild` at `Sim.js:372`. The query filters on live positions. The search for the nearest enemy uses a strict `<` (`Sim.js:884`), so a tie keeps the first enemy in grid order. All of this is the same in every engine. There is no `Math.*`, no rng and no `Date`. The `rng` held in `_spreadCtx` is never read, because spread specs have no `chance` (`status.js:28`).
- **Budget order.** `_spreadBudget` is refilled at `Sim.js:376`, before the enemy loop and after `ruleStep`. `_curseTick` is only reached from `updateEnemy`, so it always sees a fresh budget. An enemy over the budget keeps `spreadIn` at 0 and tries again next step (`Sim.js:872`). The enemies are visited in array order, so it is deterministic. A query that finds no target does not spend the budget. The test at `tests/sim/mechanics-merge.test.js` "at most 64 passes a step" covers this.
- **Snapshot and save.**
  - `spreadIn` and `rotDps` live on the curse status object. The generic serializer (`src/sim/snapshot.js`) stores statuses as they are. My mid-wave restore check above agreed 20/20.
  - `_spreadBudget` is classed `'calm'` and `_spreadCtx` `'scratch'` (`src/ui/battle/snapshot.js:181`), like `_curseBudget` and `_curseCtx`. Neither is read before it is reset or overwritten.
  - `_spreadCtx.rng` is the shared rng object, which the serializer keeps shared.
- **Co-op checkpoints and rejoin.** The LINKS engines battle has a mid-wave rejoin with six Enas, whose base 15% rot spreads. It passes with `rejoinTick` 7076 unchanged (`tests/online/engines.test.js:386`). Every engines battle asserts that both views agree.
- **Re-pinned digests.** Every battle whose result moved has Ena in it:
  - the main abilities battle has `ena.omenCard` (`engines.test.js:219`);
  - the curse battle (`:242`);
  - GEAR_GIRLS has Ena in the host loadout, `e2e/engines/scriptedBattle.js:2016` (`:306`);
  - LINKS has the six Shared Fate Enas (`:386`).

  The Tenka battle has no Ena. Only its `ckDigest` and `finalDigest` moved: ticks, final, hashes, wallets and lab numbers are unchanged (`:283`). That is what two new Sim fields in the generic snapshot should do. The S4 tether fields moved the same digests in the same way earlier.
- **Sim id and protocol.** `simId()` is `50ea041ca870` and matches `PENDING_BUMP {13: …}` (`tests/art/itemArtRuntime.test.js:210`). `COOP_PROTOCOL` is still 13 on the branch, which is the established pattern for balance-r5. The release that ships this needs the bump to 14 and a patch note.

## 2. Test integrity: OK

- **coopAbilities, Kaze's Swoop and First Aid Call (`tests/online/coopAbilities.test.js:686`). STRONG damageMul 6/1.1 → 3.**
  - Ena is in this scenario as the guest's girl, so the battle legitimately changes.
  - `abilityKill` runs for every kill, whatever its source (`src/sim/Sim.js:796`), so rot kills near Noa still count toward a life. The rally logic itself did not change.
  - The edit is a scenario-tuning value. Every assertion is unchanged:
    - equal hashes on more than 20 checks;
    - Swoop, First Aid Call and Omen Card all cast;
    - at least one life restored, the same lives on both views, each life by Noa's First Aid Call, never the same life twice.
  - It keeps the test's intent and hides nothing. The scenario is very sensitive to the seed, though (see L5).
- **Tryout golden seed 1212 (`tests/sim/tryoutGolden.test.js:69`).** The re-pin is legitimate. Ena plays in this run (checked above), so its calm-point hashes have to move. The wave-28 win holds. Seeds 77 and 1201 and every plan digest are untouched. The file's "never re-freeze for an Extended Day change" rule does not apply, because this is a sim change and the comment says so.

## 3. Correctness: OK

- **Rot through `computeDot` (`src/sim/combat.js:177-180`).**
  - Rot has no element, so no ward and no rule element scale applies (`src/sim/rules.js:151`).
  - There is no type chart and no flat armour, the same as poison.
  - Guard and shield apply through `reduceByModifiers` as `'mystic'`; mark and vulnerable apply through `damageTakenBonus`; the barrier is taken first.
  - There is no double-dip. The burn and poison branches are byte-for-byte unchanged.
  - Damage is credited to `c.sourceUid` through `_dot` (`Sim.js:746-766`) and counted under `damageByType.curse`. Nothing in `src/` outside the sim reads that key.
- **Bosses take half the rot.** `Sim.js:868-869` uses `CURSE_ROT_BOSS_MUL` 0.5 on bosses and minibosses. Bosses still catch the hex and pass it on. Both are tested.
- **The depth-4 chain stop.** `Sim.js:870` stops at `depth + 1 > 4`. The test gives depths `[0,1,2,3,4,null,null]`.
- **No endless re-spread.** A living pass only targets an enemy with no curse (`Sim.js:880`). Each pass raises the depth by one, and depth 0 only comes from Ena's own hit or Omen Card (`Sim.js:652`, `src/sim/abilities.js:428`). So A↔B ping-pong ends by generation 4. Each source re-passes at most once per 60 steps. The merge rules (`status.js:89-97`) only ever adopt a real chain depth, so a merge never lowers a depth below an actual source's depth.
- **Target filter.** The filter is dead / hidden / already cursed. This matches the on-death burst (`Sim.js:845`), which hits veiled, flying and phasing enemies, being mystic with `detection` and `canHitAir`. Living spread treats them the same way. Tunnel enemies are excluded.
- **No double rot from the death burst.** The burst entry carries `rotDps` (`Sim.js:814`). Survivors get `rotDps × 0.6` (`Sim.js:850`), which merges by max and never stacks (`status.js:95`). The burst spec itself has `status: []`, and the dying enemy ticks no more.
- **Re-entrancy.** `_scratch3` is cleared before `_applyStatusEvent` (`Sim.js:889`). A rot kill inside `_dot` returns before the query (`Sim.js:870`).
- **Data merge.** `mergeStatusList` keeps the per-field max (`src/sim/mods.js:478-490`), so tiers and the awaken passive take the strongest `rot`, and the Marked Deck `statusAdd` only adds duration.
- **Perf.** See the table. The shared perf test only has Shared Fate Enas (base 15% rot). There is no huge-wave Cursed Bloom scenario in it (L6).

## 4. Balance: OK

- **Nobody else changed.** Only Ena's data changed. The `kind === 'curse'` branches in `computeDot` and `ruleDotScale` touch only the new rot. Kage's crowd number is identical on base and head (2,812,431).
- **Her numbers are plausible.**
  - 12 fully upgraded Cursed Bloom Enas on a dense immortal crowd go from 0.69M to 1.54M (×2.24, with rot 55% of her damage). That is still 0.55× the same bench with 12 Kages (2.81M).
  - Shared Fate: 0.53M → 0.73M. Withering Script: 0.15M → 0.30M.
  - The builder's maxed "1.09× Kage" for her best build and the flat boss numbers are consistent with this.
- **Late Freeplay.** Rot scales with her hit, not with enemy HP, so it falls off as Freeplay HP grows. capBot AE to wave 120: no leak, 2.3% share. Not absurd.

## 5. Text: OK

- **No disease names.** "contagion" appears only in the branch name, dev comments, BALANCE.md and a test name. It is a general word. Player text uses hex, rot and spread. No other games' or anime names.
- **The tier text matches the data.**
  - Rot: base 15%; Cursed Bloom 20, 25, 40, 50, 60%; awaken 20%; Omen Card 60%, and 80% at tier 5 (`abilityText` `{curseRot}`).
  - The tips' 1.2 tiles, "every second" (60 steps at `STEP` 1/60) and "up to four times" match the constants.

## Findings

All seven are LOW and optional.

- **L1 (LOW, `src/sim/status.js:91-97`): the rot's credit can belong to a different Ena.** The rot's source is never recorded separately: `sourceUid` and `depth` follow the larger *burst*, and `rotDps` follows the larger *rot*. With two Enas of different builds or owners, a curse can take its rot from one Ena while `_dot` credits it to the other (`Sim.js:869` → `_credit`). In co-op that also moves rot-kill bounty to the other player's wallet. It is deterministic and only happens in a narrow window, for example a Shared Fate hit 2.2–3× a Cursed Bloom hit. Fix: keep a `rotUid` set where `rotDps` is upgraded, and credit the rot to it.
- **L2 (LOW, `src/data/wiki.js:774`, `src/data/types.js:78`): the boss rule is misstated.** The wiki says "bosses take half the rot", but the code also halves minibosses (`Sim.js:868`), and the status description in `types.js` does not mention the boss half at all. Say "bosses and minibosses take half the rot".
- **L3 (LOW, `src/data/types.js:76-78`, `src/data/wiki.js:774`): "hex" now names two different things.** Player text calls Ena's curse "a spreading hex", but "Hexed" is Yoriko's separate status, which takes a share of max HP and blocks regen. The wiki's "Curses and hexes" section describes both. Players may read Ena's Cursed icon as Hexed. Consider "a spreading curse", or keep the word "hex" for Yoriko.
- **L4 (LOW, `CONTRACTS.md:397`, `:1819`): CONTRACTS.md is out of date.** It still lists `curse { burstMul, radius, duration }`. It does not mention `rot`, the runtime `rotDps` and `spreadIn`, `_curseTick`, the six `CURSE_SPREAD_*` / `CURSE_ROT_BOSS_MUL` constants, `_spreadBudget`, or the new `curseSpread` event. Update it to match the change.
- **L5 (LOW, `tests/online/coopAbilities.test.js:683-686`): the First Aid Call scenario is fragile.** Only damageMul 3 still produces the rally kills; 4, 5, 6/1.2 and 6/1.1 all miss. The next sim change will likely need another re-tune. A sturdier set-up would place the guest's Ena where her hex does not thin the wave before it reaches Noa, or start the rally earlier. This is not a weakening: every assertion is intact.
- **L6 (LOW, `tests/sim/perf.test.js:262-330`): no perf test for the strongest hex in a huge wave.** The only perf scenario with Ena uses Shared Fate (15% rot). A Cursed Bloom tier-5 + Omen Card case with 400 or more enemies would guard the spread path. My ad hoc run shows it is cheap today: +0.1–0.26 ms/step.
- **L7 (LOW, `src/sim/Sim.js:899`, `:880`): the living spread has no visual and no curseSpread listener.** The 'curseSpread' event has no consumer in the renderer, so players see only the Cursed icon appear on the next enemy. The owner asked to see her hex "spread", so a thin thread or flash on `curseSpread` belongs on the effects track. A cursed enemy inside a tunnel can also still pass the hex to a visible enemy within 1.2 tiles. Only the target is checked for `hidden`. This is harmless, but differs from "nothing can reach it".

No BLOCKER, HIGH or MEDIUM findings. **Verdict: OK.**
