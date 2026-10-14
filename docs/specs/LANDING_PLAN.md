# Landing plan: freeplay, battle save, Potential, codex modes, hero rework, Chika rework

Sakura Sentinels, written 2026-10-14. Integration plan for six pieces of work: two are built (co-op freeplay, battle save) and four have finished specs (Potential r2, codex modes r2, hero rework r2, Chika rework r2). It also covers the in-flight branches they touch: attack FX, unit info, roster B3, story, balance playtest (#75), and the cloud branches patch notes (#171), solo freeplay (#174) and sandbox (#175).

**Inputs.** The six specs, `four-features/OWNER_DECISIONS.md` (Oct 14) and the worktrees as they are today. Every branch fact below was read from the worktrees (read-only) at the time of writing. Nothing in any repo was written.

**Rules for anything built from this plan.** Use our own names only. The academy girls are students. Rewards and costs stay data-driven and conservative, and every economy change waits for the owner's yes.

---

## 0. The plan on one page

1. **Four release trains, three forced co-op updates.**

   | Train | Contents | Co-op id | `COOP_PROTOCOL` | Profile `SAVE_VERSION` |
   |---|---|---|---|---|
   | **A**, normal updates (now) | battle save (built), Potential M0 (invisible counter), attack FX, unit info | unchanged | 2 | 2 |
   | **B**, co-op update #1 | co-op freeplay (built). Potential M0 rides here if it missed A. | changes | 2 → **3** | 2 |
   | **C**, co-op update #2, the "battle train" | hero rework → Chika rework (with the owner's new flight modes) → Potential M1–M3 → codex modes. One stage-HP pass and one `SNAP_V` bump for all four. | changes once | 3 → **4** | 2 |
   | **D**, co-op update #3 | roster B3, plus ribbon gems if the owner approves them, then kit toggle | changes | +1 only if B3 adds a command | 2 → **3** |

2. **Why this order:**
   - Freeplay is the owner's stated priority and is already built, including its long-run netcode gates (wave-end checkpoints, background rebuild, rejoin at wave 150). It should not wait weeks for features that are only specs.
   - The four specced features touch the same sim seams and the same campaign balance. Each one adds power: free heroes about ×2 headroom on Normal, Chika up to +46% (median +17%) in early and mid waves, Potential about +9%. So they land together, with **one** stage-HP calibration and **one** freeplay re-check, instead of four bumps and four recalibrations.
   - Roster B3 is 95 commits behind live and still mid-build. All four specs prefer it to rebase onto them: hero tracks for its heroes, 11 Potential rows, the relay-sample line, `refreshEffective`.

3. **Cut-off rule for train C.** A feature that is not green when the train's integration window closes waits for train D. It never forces an extra bump. Codex modes is the one most likely to slip, so it merges last and can be dropped without unwinding anything.

4. **Start now, in parallel worktrees (§3):**
   - land battle save;
   - finish and land freeplay;
   - build Potential M0;
   - start hero M0–M1, Chika M0 (with a flight-mode seam) and codex M0–M1 on branches off freeplay;
   - write the Chika flight-mode addendum spec;
   - finish attack FX and unit info.
   - Potential M1–M3 starts the day freeplay merges, as the owner asked.

5. **Twelve cross-spec problems found while planning** (§10). The ones that cause bugs if left alone:
   - `_credit`'s third argument means different things in the hero and Chika specs.
   - Codex and Chika give different formulas for drone range under map rules.
   - Hero's hash change would re-pin every battle, including those without a hero.
   - Freeplay's generic checkpoint would carry the host's view (`_heroConfig`) to the guest, and dense path caches (`_pathsFwd`/`_pathsRev`) into every checkpoint.
   - Potential's P6 names still clash with hero track names, and the suggested fix "Spring Tide" is already a live tier name.
   - Freeplay's once-per-account milestone gems can be paid twice after a stale tab drops `progress.freeplay`.

6. **Owner questions:**
   - Already answered on Oct 14: heroes free to place (hero Q1); Chika's extra power approved (Chika Q2); Chika's flight distance replaced by "like the helicopter" (Chika Q3).
   - **Twelve stay open**, each with a default (§11).
   - Only one blocks a release: hero Q2, the 760 medal gems becoming reachable earlier, blocks train C.

---

## 1. Where everything stands (read from the worktrees today)

| Work | Worktree / branch | Base vs live `ffc4d23` | Sim id (files) | `COOP_PROTOCOL` | `SAVE_VERSION` | State |
|---|---|---|---|---|---|---|
| Live | `sakura-game` `claude/sakura-sentinels` | — | `06763e510bb4` (34) | 2 | 2 | v0.1.25 + UR awakening |
| Co-op freeplay #164 | `wt-freeplay` `feature/coop-freeplay` | 29 ahead, 10 behind | `6447e0fe5bd6` (37) | 3 | 2 | M1–M6 built: sim, data, protocol 3, UI, rewards, `src/sim/snapshot.js` checkpoints, background rebuild, rejoin bench. One uncommitted `lockstep.js` + test change. |
| Battle save #170 | `wt-battlesave` `feature/battle-save` | 7 ahead, 4 behind | `06763e510bb4` (unchanged) | 2 | 2 | M0–M3, docs and e2e committed; ready to rebase and land |
| Attack FX #157 | `wt-attack-fx` | 16 ahead, 0 behind | unchanged (render only) | 2 | 2 | finishing preview, reel and docs |
| Unit info #160–161 | `wt-unit-info` | 12 ahead, 18 behind | unchanged (UI only) | 2 | 2 | e2e, gates and docs pending |
| Roster B3 #137 | `wt-roster` `feature/roster` | 8 ahead, **95 behind** | changes | — | **3** | sim mechanics WIP (`3c47a32`, builder interrupted) |
| Story #118 | `wt-story` | 8 ahead, 95 behind | UI only | — | 2 | WIP |
| Balance playtest #75 | `wt-balance` `feature/balance-playtest` | 9 ahead, 85 behind | changes (`units.js` 610 lines, `stages.js` 179, `Sim.js`, `waves.js`) | — | 2 | WIP |
| Potential #165, codex #169, hero #168, Chika #166 | specs only (`four-features/*/SPEC.md`) | — | — | — | — | revision 2 done |
| Patch notes #171, solo freeplay #174, sandbox #175 | cloud sessions | — | unknown | — | — | in progress elsewhere |

---

## 2. Release trains

### Train A: normal updates, no co-op change (start now)

| Item | Why here | Gate |
|---|---|---|
| **Battle save** | Built. It is outside the co-op graph (sim id unchanged). Landing it first means its key guard (`KNOWN_SIM_KEYS` / `KNOWN_TOWER_KEYS`) protects every later sim change. | Rebase onto `ffc4d23`. Full vitest, build, smoke, `nav-back`, `e2e/battle-save.mjs` at both sizes. `simId()` unchanged. |
| **Potential M0** (invisible counting) | It must ship no later than the roster, so that no duplicate is lost and the backfill pool stays pinned. It makes no sim change. | Potential §11.1 grant, backfill, save and stale-tab tests; co-op id unchanged. Needs Potential Q1 (SSR backfill rule) answered or defaulted. |
| **Attack FX** | Render only. It is easier for Chika M5, hero `heroLookTiers` and codex radius easing to edit its files on live than on a moving branch. | Its own suite. Its sim-id pin follows live. |
| **Unit info** | UI only. Train C features then add their hooks (Chika `SUB_KEYS`, hero `treeModel` ranks, Potential sheet block) to code that is already merged. | Its e2e and gates (#160–161). |
| Patch notes, story | Independent. Each lands when green. | Their own gates. |

### Train B: co-op update #1 (freeplay alone)

- Rebase `feature/coop-freeplay` onto live after battle save. Commit or finish the open `lockstep.js` change.
- **Classify freeplay's four new Sim keys** in battle save's table: `freeplay: 'config'`, `lastWave: 'config'`, `_fp: 'calm'`, `finished: 'calm'`. Battle save's key guard fails until this is done, by design.
- Fix the milestone stale-tab hazard (§10, item 7) before release.
- Gates are freeplay's own (spec §13–14): lockstep, engines in 3 engines, `BALANCE=freeplay`, the two-tab e2e, rejoin at wave 150. Release notes say "both players update".
- Potential M0 rides here if it was not in train A.

### Train C: co-op update #2, the battle train

- An **integration branch `train/battle-2`** is cut from live right after train B ships.
- Features merge in this order. Each merge has its own gates (§9.1).

| # | Feature | Why this position |
|---|---|---|
| 1 | **Hero rework** M0–M4 | It changes the Sim's structure most: `heroes[]`, `hero`/`heroConfig` getters, the view trap around `_step`, `_credit(…, e)`, `_relocate`. Every later merge then adapts to it, and the view trap checks them for free. The owner confirmed "heroes free". |
| 2 | **Chika rework** M0–M7 + flight modes | Takes `towers.js` (drone section, `refreshEffective` turret spec) and the `drone` argument of `_hit`/`_credit`/`_killEnemy` on top of hero's `e` argument. The owner approved the buff and asked for flight modes. |
| 3 | **Potential** M1–M3 | Smallest change (`mods.js`, `constants.js`, data, `version.js` hash). Its benches must run on the final hero and Chika sims (its Chika row is Chika's gate 9). It is placed before codex so a codex slip cannot hold it. |
| 4 | **Codex modes** M0–M6 | It touches the most seams: `spawnEnemy`, `_getWave`, `startNextWave`, `_checkWaveEnd`, `refreshEffective`, `placeTower`/`sellTower`, `_relocate`. Adapting last onto settled seams is cheapest. It is also the most likely to slip, and its spec already says it waits for the next forced bump rather than adding one. |
| 5 | **Combined balance and determinism pass** (§9.2) | Folds in #75's stage-HP pass (hero Q3 default), freeplay `hpBands` if needed, every feature's guards, 3 engines, both snapshot systems, perf, and a joint phone UI review. |

- **One release**: `COOP_PROTOCOL` 4, one sim id change and battle save `SNAP_V` 1 → 2. Release notes say "both players update".
- Solo freeplay (#174) and sandbox (#175) join here *after* step 4 if they touch graph files; otherwise they land in any normal update after train B.

### Train D: co-op update #3 (roster)

Roster B3 rebases onto train C. It brings:
- `SAVE_VERSION` 3 (skins);
- its three heroes written directly as `HERO_TRACKS` entries;
- the 11 Potential rows;
- `refreshEffective(t, globalRateMul, globalDmgMul)` on top of train C's body;
- codex's relay-sample line (`relaySamples(sim._pathsFwd ?? sim.pathData)`);
- `_curseCtx.rng` in battle save's `useWaveStream`;
- `updateRelayOrigin` inside hero's `_relocate`.

If the owner approves codex ribbon gems (codex Q1), they are switched on here so they share the v3 bump. The core-units outcome (#172) is expected to reshape B3's girls; that is decided in B3, not here.

### Where this plan departs from the individual specs

| Spec said | Plan says | Why |
|---|---|---|
| Potential: "ship as its own release, not with freeplay" | Not with freeplay (kept), but inside train C rather than alone | Saves one forced update. Its gates must run on the final hero and Chika sims anyway. Option for the owner: §11, Q-A. |
| Codex: ship in the same bump as freeplay, or roster B3 | Train C | Freeplay is built and should not wait. Train C is "the next forced bump". |
| Hero: merge order B3 → freeplay → rework for `_onHitEffects` | Freeplay → rework → B3 | B3 is far behind. Hero carries B3's `PUSH_LOCK` lines verbatim (`wt-roster` `3c47a32`: `constants.js:114`, `enemies.js:91`, `Sim.js:369-399`), as its own spec allows, so B3's rebase is a no-op there. |
| Hero Q3 default: "#75's stage-HP pass in the same release" | The HP pass runs **on `train/battle-2` after all four features** | The balance branch is 85 commits behind. All four features add power, so one calibration against the final power level is the only one that holds. |
| Chika: Q2 and Q3 open; drones roam a 4-tile disc | Q2 approved. Q3 replaced by the owner's helicopter flight modes, which need an addendum (§3, row 6). | `OWNER_DECISIONS.md` (19:17) came after the Chika r2 brief. The r2 spec does not mention flight modes. |

---

## 3. What can be built in parallel right now

| # | Worktree (new unless noted) | Branch | Base | Scope now | Blocked by | Lands in |
|---|---|---|---|---|---|---|
| 1 | `wt-battlesave` (exists) | `feature/battle-save` | rebase onto live | rebase, verify, merge | nothing | A |
| 2 | `wt-freeplay` (exists) | `feature/coop-freeplay` | rebase onto live after #1 | finish `lockstep.js` WIP, key classification, milestone shadow fix (§10.7), ship | #1 (for the key table) | B |
| 3 | `wt-potential-m0` | `feature/potential-m0` | live | Potential M0: `dupes`, shadow, backfill, `POOL_SIZE_V0125`, tests | Q1 default | A (or B) |
| 4 | `wt-hero` | `feature/hero-rework` | `feature/coop-freeplay` HEAD | M0 data + `tools/heroTrack.mjs`; M1 solo sim; M2 co-op, which can build on protocol 3 and bump to 4 at integration | nothing (Q1 answered) | C #1 |
| 5 | `wt-chika` | `feature/chika-rework` | `feature/coop-freeplay` HEAD | M0 sim core, **with the flight seam** (`t.flight = { mode: 'hover', ax, ay, bx, by }`; the roam centre and leash come from it; only Hover is implemented in M0) | nothing | C #2 |
| 6 | scratch only | — | — | **Chika flight-mode addendum**: spec + prototype + measurement under `four-features/chika-rework/exp3/`. Modes, a `fly` command, battle-save fields, balance gates for Pursuit and Patrol, panel UI at both sizes. | owner reading (§11, Q-B; the default ships if no answer) | feeds Chika M1/M3 |
| 7 | `wt-codex` | `feature/codex-modes` | `feature/coop-freeplay` HEAD | M0 data (numbers, `src/ui/text/*`, 21 glyphs); M1 sim; M2 systems (on battle save's `parseBattleParams` once #1 lands) | nothing for M0–M2; codex Q1–Q4 defaults before M3 | C #4 |
| 8 | `wt-attack-fx` (exists) | `feature/attack-fx` | live | finish #157 | — | A |
| 9 | `wt-unit-info` (exists) | `feature/unit-info` | rebase onto live | finish #160–161 | — | A |
| 10 | `wt-roster` (exists) | `feature/roster` | keep building; rebase onto train C later | B3 tests, renderer and UI hooks | train C | D |

**Wait to start:**
- **Potential M1–M3**: the day freeplay merges (the owner's "after coop stuff and freeplay").
- **Train C balance pass**: after step 4.
- **#75 unit-price edits**: rebase after train C. Its stage-HP work moves into the train C pass.

**Keeping parallel branches mergeable:**
- Every train C branch commits the seam contract (§4) as its first commit, in `docs/merge/SEAMS.md` on the branch, folded into `CONTRACTS.md` at integration.
- Each branch rebases onto `train/battle-2` after every merge into it.
- Builders do not edit another feature's seam lines.

---

## 4. Seam contract (agree before writing code)

These are the shared functions where two or more train C features land. Each rule says what the merged code looks like, so the four branches converge instead of colliding.

| # | Seam | Merged form | Who adds what |
|---|---|---|---|
| S1 | Hit and credit (`Sim.js`) | `_hit(e, tower, spec, scale = 1, drone = null)`, `_credit(tower, dealt, e = null, drone = null)`, `_killEnemy(e, tower, drone = null)` | Hero: damage XP from `e` (`damageXp(dealt, e)`). Chika: per-drone counters from `drone`. Codex: `scale *= ruleHitScale(…)` inside `_hit` and `ruleDotScale` inside `_dot`. B3 curses keep calling `_hit(q, src, spec, 1)`. DoTs credit the girl (`drone` null). **Both specs as written put a different value in `_credit`'s third argument** (§10.1). |
| S2 | `_checkWaveEnd` order | (1) freeplay `waveEnd`, then `goal`; (2) hero wave XP to every `sim.heroes` entry; (3) codex income × `incomeMul`, `bonusEvery` (ult reset loops `sim.heroes`), `livesPerWave` if `canHeal()`; (4) codex `ruleWaveEnd` **last**, because it is the calm-point canonicalizer | — |
| S3 | `_step` | Hero wraps the body in `try/finally` (`_stepping`) and renames it `_step1`. Everyone else edits the body. Codex's `ruleStep` goes right after `grid.rebuild`. | — |
| S4 | `refreshEffective` (`towers.js`) | **Girl range**: `max(1, (s.range + envAdd) × envMul) × buff.rangeMul`. **Roaming drones** (`leash > 0`): `leash = max(1, (leash + envAdd) × envMul) × buff.rangeMul` and `gun = turret.range × envMul × buff.rangeMul`, so additive rule effects go once, to the roam radius. **Anchored turrets** (`leash 0`): codex's formula. | Chika owns the `turretSpec` lines; codex owns the env inputs. Train D: B3 adds `globalDmgMul`. |
| S5 | `_relocate(t, x, y)` (hero, new) | The single place for every position-derived field | Hero: traps, targets, drones, auras. Codex: `assignPads(this)`. B3 (train D): `updateRelayOrigin(this, t)`. |
| S6 | View rule | Nothing inside the step reads `sim.hero` or `sim.heroConfig`; use `sim.heroes` or the tower | Codex's Festival Encore, Chika's code and any freeplay hook. Hero's runtime trap (`__SIM_VIEW_TRAP__`) is switched on in the test setup of every branch once hero has merged. |
| S7 | `mods.js` stat order | paths → hero levels → hero growth and Mastery → awaken → Potential ModSets → `applyUnitStats` | Potential folds `damageMul`/`rateMul`/`rangeMul` into `applyUnitStats`. Chika scales `turret.leash` by `rangeMul` and divides `turret.build` by `rateMul`. |
| S8 | `simHash` | **Conditional folds only**: hero `level`/`xp` only for `t.isHero`; drones only when `t.turrets.length`; freeplay's high-HP term only above 2²⁷ (already built) | Battles without the feature keep their digest. |
| S9 | `version.js` | The data hash list is append-only: `[…, COOP, FREEPLAY, POTENTIAL_LADDERS, POTENTIAL_SIGNATURE_DEFAULT, POTENTIAL_GIRLS, BATTLE_MODES]`. Hero tracks and Chika data ride inside `UNITS`; rules ride inside `STAGES`. | `COOP_PROTOCOL = 4` is set once, by the first protocol-changing merge (hero). Its comment lists every train C change. Nobody bumps it twice. |
| S10 | Co-op start and commands | `start = { …, freeplay, mode, players[i].hero }`. `createCoopSim` reads only `freeplay`, `modeId(start.freeplay ? 'standard' : start.mode)` and each player's `hero`. | Command kinds: freeplay `end`; hero `hlv[level, maxPrice]` and `hmv[qx, qy]`; Chika `fly[mode, qx1, qy1, qx2, qy2]`, owner-only like `tgt`; codex none (the mode travels in `start`); B3 `aim` (train D). |
| S11 | Snapshot duty | Every new Sim, tower or drone key is classified in battle save's tables **and** either survives freeplay's generic `src/sim/snapshot.js` or is listed in its `REBUILT` with an after-restore fix. | Add `AFTER_RESTORE` (a list of `(sim) => void` hooks) to `src/sim/snapshot.js` in train C. Each feature adds one scenario to `tests/sim/snapshot.test.js` and one split-run case to battle save's snapshot test (§8). |
| S12 | Engines fixtures | Each feature adds a **named** scenario (`POTENTIAL_START`, `DRONES_START`, `HERO2_START`, `MODES_*`). `START` and `FREEPLAY_START` are re-pinned only in the hero merge commit: both include Hikari, so their digests change once. | — |
| S13 | `units.js` and `types.js` ownership | Hero blocks (`HIKARI`/`LUNA`/`NAMI`) belong to hero; the Chika block to Chika; `BATTLE.maxHeroLevel` and `DIFFICULTIES[d].heroCost` to hero. Other units belong to balance or roster. | — |
| S14 | UI hot files | New logic goes in feature modules (the pattern of freeplay's `src/ui/battle/freeplay.js`), with at most about 10 lines per feature in `controller.js`. `towerPanel.js` renders per-section functions, and `signature()` is the concatenation of per-section parts (hero adds level, price bucket and move state; Chika adds tab and drone uid). `battle.css` gets one prefixed block per feature. | — |

---

## 5. File-level conflict map (where two or more branches meet)

| File (function) | Branches | Owner, and how to merge |
|---|---|---|
| `src/sim/Sim.js` constructor | FP, CM, HR, B3 | HR's `heroes`/`heroConfigs` block, then CM's paths/mode/rule block; separate blocks. B3 in train D. |
| `Sim.js` `spawnEnemy` | FP, CM | CM multiplies `mode.speedMul` into freeplay's `speedMul × (o.speedMul ?? 1)`; Ironclad uses the `armorBonus` field FP added. |
| `Sim.js` `_hit` / `_credit` / `_killEnemy` / `_dot` | CM, HR, CH, B3 | S1 |
| `Sim.js` `_checkWaveEnd` | FP, CM, HR | S2 |
| `Sim.js` `_step` | HR, CM | S3 |
| `Sim.js` `_getWave` / `startNextWave` | FP, CM | FP's freeplay branch is untouched; CM adds `spacingMul` and route orientation (freeplay is Standard-only in v1). |
| `Sim.js` `placeTower` / `sellTower` / `placeCost` / `towerStats` / `result` | CM, HR, CH | HR's `heroIndex` and sell-refusal come first; CM's `assignPads` after the filter; CH adds `towerStats.turret` and `own`. Additive fields in `result`. |
| `Sim.js` `_onHitEffects` knockback | FP (Resolve), HR (needs `PUSH_LOCK`), B3 | Resolve clip first, then the push lock (B3's lines carried by HR verbatim). |
| `src/sim/towers.js` | FP (1 line), CM, CH, HR, B3 | S4; Chika's drone section is one contiguous block; HR touches `refreshTowerStats` and the `updateTower` `moveLock` early return. |
| `src/sim/mods.js` | P, HR, CH, B3 | S7; three disjoint functions (`resolveStats`, `collectModSets`, `normTurret`/`applyModSet`/`applyUnitStats`). |
| `src/sim/hero.js` | FP (3 lines), HR (large), B3 | HR edits around freeplay's `pushBack` clip and never rewrites the file. |
| `src/sim/enemies.js` | FP, CM, CH, B3 | `checkPhases` `armorBonus` line: FP already has it, so CM skips it. CM `updateEnemy` move multiplier and rift; CH sapper jam block. |
| `src/sim/constants.js` | P, HR, CH, B3, BAL | Append-only constants; HR removes `HERO_XP_PER_DAMAGE` (BAL's 0.4 line superseded). |
| `src/sim/waves.js` | FP, CM, BAL | CM `spacingMul` (bit-identical at 1). BAL rebases after train C. |
| `src/sim/headless.js` / `report.js` | HR, CH / FP, HR | Disjoint functions. |
| `src/sim/snapshot.js` (FP) | CM, HR, CH | S11; `REBUILT` additions and `AFTER_RESTORE` (§8). |
| `src/data/units.js` | HR, CH, B3, **BAL (610 lines)** | S13. BAL must rebase onto train C. Its hero-cost lines are dropped and its Chika lines re-applied on the new block. |
| `src/data/stages.js` | CM (`rule:` line), BAL (179 lines) | CM's one line. **The train C HP pass edits `hpScale` here**, superseding BAL's HP edits. |
| `src/online/coop/version.js`, `commands.js`, `session.js`, `simHash.js`, `loadout.js` | FP, CM, HR, CH | S8–S10 |
| `src/systems/save.js` `migrateProfile` | FP (`coopBestWave`, `progress.freeplay`), BS (`battleSaves`), P (`dupes`, shadow), CM (`modes` ribbons), B3 (v3) | Adjacent but disjoint lines. Each feature adds a regression test that its field survives `migrateProfile(JSON round trip)`. |
| `src/systems/rewards.js` | FP, BS, CM | Disjoint exports: freeplay's cache helper, `battleDropSeed`/`eventAt`, `rewardDifficulty`. |
| `src/ui/battle/controller.js` | FP (+77), BS (+160), AF (+1), HR, CH, CM, B3, BAL | S14. Merge order A → B → C1 → C2 → C3 → C4. |
| `src/ui/battle/towerPanel.js` | UI, P, HR, CH | S14: header (P pill, UR ally rule), hero block, Chika tab row and drone card, unit-info hook. |
| `src/ui/battle/results.js` / `pauseMenu.js` / `scout.js` / `hud.js` | FP, BS, CM, HR | One section per feature. |
| `src/ui/battle/setup.js` `parseBattleParams` | BS (`resume`), CM (`mode`), #174 (`freeplay`) | One key each. |
| `src/ui/screens/stage.js` | BS (Continue / New game), CM (mode grid, rule panel, ribbon state), BAL | CM's spec already designs on top of battle save ("Saved battle · Hard · Goblin Rush …"). |
| `src/ui/screens/student.js` | P, HR, CH, UI, BAL | Disjoint sections: Potential Info section; Hero section and "Deploy cost Free"; Chika's `describeMods` and Drones row. |
| `src/ui/screens/coop.js` | FP, CM, HR, UI | Freeplay segment, then the Mode segment (disabled while freeplay is on), then both hero chips. |
| `src/render/*` | CH (pick, overlays, actors α), CM (`ruleDecals`, terrain reverse build, ambient), HR (actors move), AF | AF lands first (train A); the train C features edit its files. |
| `e2e/engines/scriptedBattle.js` | FP, P, CH, HR, CM | S12 |
| `docs/CONTRACTS.md` | all | One section per feature; merged in train order. |

---

## 6. Co-op compatibility id

| Feature | Graph files changed or added | Data hash | Protocol | Pins to re-baseline |
|---|---|---|---|---|
| Freeplay (B) | new `sim/freeplay.js`, `sim/snapshot.js`, `data/freeplay.js`; `Sim`, `enemies`, `status`, `hero`, `towers`, `waves`, `report`; `data/enemies`, `data/coop`; `core/rng`; `coop/commands`, `session`, `version`, `simHash`, `lockstep` | + `FREEPLAY` | 2 → 3 | its own (already in the branch) |
| Hero (C1) | new `data/heroTracks.js`; `Sim`, `hero`, `mods`, `towers`, `constants`, `headless`, `report`; `data/units`, `types`; `coop/loadout`, `session`, `commands`, `simHash`, `version` | `UNITS` | → 4 | `START`, `FREEPLAY_START`, freeplay's long-run checkpoint digest and campaign goldens with a hero: **once, in the hero merge commit** |
| Chika (C2) | `constants`, `mods`, `towers`, `Sim`, `enemies`, `headless`; `data/units`; `coop/simHash`; with flight modes also `coop/commands` | `UNITS` | shares 4 | none for drone-less battles (S8) |
| Potential (C3) | new `data/potential.js`; `mods`, `constants`; `coop/version` | + 3 tables | — | none; P1 = the train head before the merge |
| Codex (C4) | new `sim/rules.js`, `data/modes.js`, `data/rules.js`; `Sim`, `enemies`, `waves`, `towers`; `data/stages`; `coop/commands`, `session`, `version` | + `BATTLE_MODES`; `STAGES` carries rules | shares 4 | campaign goldens on ruled stages (rules always on); Standard with `rule: null` stays identical |
| Battle save (A), Potential M0 (A) | none | — | — | — |
| Roster B3 (D) | `Sim`, `combat`, `constants`, `enemies`, `hero`, `mods`, `report`, `status`, `towers`; `data/types`, `units` | `UNITS` | +1 if it adds `aim` | its own |

**Result: three forced updates (B, C, D) instead of six.** Each one is deliberate and announced. Every merge commit prints `tools/simId.mjs`.

---

## 7. Saves and migrations

### 7.1 Profile (`src/systems/save.js`)

| Field | Feature, train | Migrate line | Version |
|---|---|---|---|
| `battleSaves` | BS, A | `cleanBattleSaves`; `migrationDropsData` ignores it | none (additive) |
| `units[id].dupes`, `missions.counters['pot:<id>']`, `'pot:at'`, `seenIntro` `'potential-backfilled'` | P M0, A | `cleanUnit` (`null` = needs credit), `restoreFromShadow`, then `backfillDupes` | none (self-marking) |
| `progress.stages[id].coopBestWave`, `progress.freeplay.{done, titles, frames}` | FP, B | already in the branch | none. Needs the shadow fix in §10.7. |
| `progress.stages[id].modes` (ribbons) | CM, C | `cleanModeRibbons` next to freeplay's per-stage line | none while ribbons pay 0 gems |
| skins and friends | B3, D | roster's | **3** |
| Codex ribbon gems (only if Q1 = yes) | D | — | rides roster's **3**. If the owner wants them before roster: bump to 3 in that release, and roster takes 4. |
| Hero, Chika | — | none | none |

**`SAVE_VERSION` stays 2 through trains A, B and C.** The only planned bump is roster's.

### 7.2 Battle save records

| Field | Train | Rule |
|---|---|---|
| `RECORD_V` | A | 1, unchanged through C. Codex's `mode` is additive, and a missing value means Standard. |
| **`SNAP_V`** | **C** | **1 → 2, once for the whole train.** It carries hero's v1 migration (restore by level, refund the whole `spent`, never drop her), Chika's 12-field drone rows (old 5-field rows restore with zero counters), and codex's `rr`. A train-A or train-B build then *drops* a v2 record instead of continuing a Rush or Reverse run as Standard. |
| `mode`, `view.mode` | C (CM) | `cleanBattleSaves` → `modeId(r.mode)`; Continue always uses the saved mode. |
| freeplay `freeplay` / `bankedWave` | solo freeplay #174 | battle save spec §7.11 rule (each checkpoint reward paid in the same write that raises `bankedWave`) |

### 7.3 Freeplay checkpoints (`src/sim/snapshot.js`, `SNAPSHOT_VERSION` 1)

These are same-build only, because co-op peers must share the sim id. No version bump is needed. The train C additions are in §8.

---

## 8. Snapshot additions each feature needs

There are two systems, and **both must be updated by every feature**:
- **Battle save** (`src/ui/battle/snapshot.js`, outside the graph): a classification table plus a rebuild through the public API. It is robust across updates.
- **Freeplay checkpoints** (`src/sim/snapshot.js`, in the graph): a generic serializer of every own Sim field except `REBUILT`. It is exact within one build.

Both are guarded: battle save's key guard fails on an unclassified key, and freeplay's self-test restores a snapshot and runs it 20k ticks against the original.

| Feature | Battle save: keys and record | Freeplay checkpoint | Test scenario to add |
|---|---|---|---|
| **Freeplay** (B) | `KNOWN_SIM_KEYS`: `freeplay` config, `lastWave` config, `_fp` calm, `finished` calm | — | battle save's key guard |
| **Potential** (C3) | No new keys. Frozen `unitStats` carry `potential`; old saves restore at P1 through the neutral merge. Add `potential` to the "missing key → neutral" test. | Nothing: `unitStats` travel as config paths | — |
| **Hero** (C1) | `SNAP_V` 2. Tower row adds `ls` (`levelSpent`), `lb` (`levelsBought`) and `mc` (`moveCd`). `KNOWN_SIM_KEYS`: remove `hero` and `heroConfig` (now getters); add `heroes` snap, `heroConfigs` config, `_heroConfig` config, `_stepping` scratch. `KNOWN_TOWER_KEYS`: `levelSpent`, `levelsBought`, `moveCd` snap; `moveLock` calm; `mastery` derived; `heroIndex` config. Restore a hero without the tier loop and never `sellTower` her. v1 migration as in §7.2. If hero carries `PUSH_LOCK`: the enemy field `pushLock` is calm (enemies are not carried). | **`REBUILT` += `heroConfigs`, `_heroConfig`, `_stepping`.** `_heroConfig` is the *viewing* player's hero. If it travelled, the host's checkpoint would give the guest the host's hero in the HUD and widget. `simConfig` passes every player's hero config. | two heroes, auto-start, a checkpoint built by the host and restored on the guest: equal state, and each client's own view kept |
| **Chika** (C2) | Drone rows grow 5 → 12 fields (`uid, x, y, facing, cooldown, n, slot, dmg, kills, shots, born, jam`), plus tower `ds: [droneDmg, droneKills, droneShots, droneSerial]`. `KNOWN_TOWER_KEYS`: `droneDmg`, `droneKills`, `droneShots`, `droneSerial` snap; `_pool`, `_poolS` scratch; `_poolLeft`, `_poolMode` calm. New `KNOWN_DRONE_KEYS` with its own guard. `restoreDrone()` from `towers.js`; `droneSerial = max(saved, highest n)`. **Flight modes add** `flight: { mode, ax, ay, bx, by }` snap (row field `fl`). | Generic. Optional: clear `_pool` at wave end so checkpoints do not carry dead enemies. | roaming drones still flying home at the calm point, a jam running, Patrol and Pursuit mid-flight |
| **Codex** (C4) | Record `mode`, `view.mode`; `snap.rr`. `KNOWN_SIM_KEYS`: `mode`, `incomeMul`, `_modeArmor`, `_ruleGoal`, `_bountyAdd`, `_pathsFwd`, `_pathsRev`, `rule` config; `routeReversed` snap (as `rr`); `_ruleMul`, `_ruleMove`, `_ruleRange`, `_rulePortal` derived; `_waveTick` calm; `_ruleScratch` scratch. `KNOWN_TOWER_KEYS`: `padIndex`, `onPad`, `padMul`, `padRangeAdd`, `envRangeMul`, `envRangeAdd` derived. Restore passes `options.mode`, then `setRouteOrientation(rr)`. | **`REBUILT` += `_pathsFwd`, `_pathsRev`.** They are constructor-built dense polylines, so without this every checkpoint carries both copies over the network. **`AFTER_RESTORE`**: `setRouteOrientation(routeReversed)` as an absolute set, because `pathData`/`paths` are rebuilt in wave-1 orientation. Rules run in freeplay even though modes do not, so Rear Ambush on 4-2 and 7-2 reaches checkpoints. | 4-2 freeplay checkpoint after an even wave; 6-1 after a pad owner is sold; 6-3 Ironclad with vents (battle save split run) |
| **B3** (D) | `aim`, relay origin, `shells`, `globalDmgMul`, `_curseCtx` (stream: `useWaveStream` reseeds it) | generic; relay caches from `_pathsFwd` | B3's own |

---

## 9. Train C integration and the combined pass

### 9.1 Gates for every merge into `train/battle-2`

1. The feature's own unit tests and e2e at 844×390 and 1280×720.
2. Full vitest, build and smoke; `e2e/battle-save.mjs`, `coop-freeplay`, `online.mjs` two tabs.
3. **Digests.** Every pinned battle that does not use the feature keeps its digest against the train head before the merge. Digests that change are re-pinned in the merge commit, with the reason stated.
4. `node e2e/engines.mjs --require-all` in V8, JSC and SpiderMonkey, with the feature's new scenario plus every existing one.
5. Freeplay's `tests/sim/snapshot.test.js` and battle save's split runs, including the feature's scenario from §8.
6. The Easy gate (40/40) and the view trap on, from hero onwards.
7. The `simId()` value in the merge commit message.

### 9.2 The combined pass (after step 4)

Scripts are copied from each spec into `four-features/train/exp/` and run against a bundle of `train/battle-2` (`REPO=<train worktree>`, `NO_OVERLAY=1`). Seeds are as in each spec. Steps run in this order, because each one changes the inputs of the next:

| Step | Script (source) | Pass |
|---|---|---|
| 1. Measure the stack | `hr.mjs` (hero `exp-r2`), 10 stages, Normal, cap 16, "won at ×1" | Report only: the headroom of the four features together against live's §6.1 column |
| 2. **Stage-HP pass** (the stage-HP part of #75, data only: `stages.js` `hpScale`) | same | Geometric-mean Normal headroom **×1.1–×1.3 of live**. Heroes should feel strong; hero Q3's default rules out "twice as easy". Easy 40/40. Hero spec pace guard: 1-x ends at Lv 13–20. |
| 3. Medal difficulties | `fulltable.mjs` (`BALANCE=full`) | Normal ≥ 60%, Nightmare ≤ 35%. **Record the Hard and Nightmare first-clear gem delta for owner Q-D.** |
| 4. Modes | codex `bench2.mjs combo`, all difficulties | codex §10 thresholds; no mode wins more stages than Standard; the Easy gate with rules on |
| 5. Potential | `campaign-r2.mjs` p1/f2p/p6, `bench-r2.mjs` (including the **Chika row**), `team-bench.mjs` | `BALANCE=potential` (§8.6 of its spec); F2P and P6 win every stage P1 wins |
| 6. Chika | `measure.mjs waves/fullpass/focus/sabo`, `campaign2.mjs`, `perf3.mjs`, plus the addendum's Pursuit and Patrol cases | §8.10 gates for Hover; the addendum's gates for the other modes. Owner: "strong is fine", so the gates watch for runaway, not parity. |
| 7. **Freeplay with everything on** | freeplay `fp/bot.mjs`: Blossom 1-3 and 8-5 strong mixed; god Kage army 8-5; Crimson 1-3 god; Tempest 1-3 strong. Two heroes with ults, Chika lines in Pursuit, Potential F2P and P6, rules on 1-4 / 4-1 / 6-5 / 7-1 / 8-5. | Strong mixed ends in 135–175; god Kage army at most one boss wall past the pre-train branch; Crimson god ends before 160; ruled stages within ±5 waves of rules off. **Out of band → retune `hpBands` (data), and codex `pastGoal: 'off'` per rule, then re-run.** |
| 8. Perf | `tests/sim/perf.test.js` (freeplay) with 6 Chikas in Pursuit, two heroes and a ruled stage | 8-5 wave 200 < 2 ms per step; 5-5 wave 250 < 4 ms; Chika ≤ ×1.10 of today |
| 9. Netcode | freeplay's rejoin bench at wave 150 with two heroes and 60 drones | Rejoin < 5 s; checkpoint size within freeplay's measured part budget |
| 10. Joint UI review | `e2e` screenshots with every feature on the same screen, e.g. 4-1 with Snowbell Blizzard, hero widget, Chika tabs and P pills; co-op freeplay with two heroes | Nothing overlaps at 844×390 (hero widget 198 px, rule pill 36 px, freeplay pressure chip, scout strip); reduced motion |

All knobs are data, inside the same bump: `hpScale`, `hpBands`, `HERO_XP`/`HERO_GROWTH`, Chika `turret.range`, the Potential steps and rule `pastGoal`.

---

## 10. Cross-spec problems found (fix in the branches)

| # | Problem | Fix | Owner |
|---|---|---|---|
| 1 | Hero passes the **enemy** as `_credit`'s third argument (damage XP). Chika passes the **drone** in the same slot. | S1: `_credit(tower, dealt, e = null, drone = null)` | hero, then Chika |
| 2 | Drone range under rules. Codex: `max(1, (turret.range + add) × mul) × buff`. Chika: additive effects go to the roam radius only, and the gun gets only the multiplier. | S4: Chika's rule for `leash > 0`, codex's for anchored turrets | codex rebases onto Chika |
| 3 | Potential's P6 names still clash with hero track names: Luna "Silver Thread" and Nami "Riptide" (`potential.data.js:59-60`). Hero's suggested replacements also clash: "Spring Tide" is a live tier name (`units.js:850`), and "Moonlit Resolve" sits next to codex's "Moonlit Blessing" and freeplay's "Resolve" mechanic. | Use names that appear nowhere in `units.js`, the hero tracks or the rules: e.g. Luna **"Moonwake"**, Nami **"Neap Tide"** (checked unused). Consider renaming Hikari's "Dawn's Resolve" for the same "Resolve" reason. | Potential (M1) |
| 4 | Hero folds `level` and `xp` for **every** tower into `hashSim`, which changes the digest of every battle. | S8: fold only `if (t.isHero)` | hero |
| 5 | Freeplay's generic checkpoint would carry the view-dependent `_heroConfig`, the dense `_pathsFwd`/`_pathsRev` caches, and a stale `pathData` orientation after Rear Ambush waves. | §8: `REBUILT` additions plus `AFTER_RESTORE` | hero, codex |
| 6 | The Chika r2 spec predates the owner's helicopter decision (flight modes: follow, lock, pursuit, patrol). | Addendum (§3, row 6). M0 carries the `t.flight` seam. The `fly` command shares protocol 4. Battle save adds `fl`. Balance gates cover Pursuit (map-wide) and Patrol. | Chika |
| 7 | Freeplay pays once-per-account milestone gems (50/100/200 per tier) recorded in `progress.freeplay.done`, with no `SAVE_VERSION` bump. A stale tab on an older build drops `progress.freeplay` on save, so the milestones can be paid again. Codex found the same hazard for ribbon gems; Potential solved its version with a shadow. | Mirror each milestone id into a map old builds keep verbatim (`missions.counters['fp:<tier>:<id>'] = 1`, Potential's pattern) and read the union on load. Test with v0.1.25's `migrateProfile`. | freeplay, before train B |
| 8 | Hero Q1 and Chika Q2 are already answered; Chika Q3 is superseded. | Record the answers in the specs and in `OWNER_REQUESTS.md`. | each |
| 9 | Potential's determinism anchor "`START` = live `411300916` at P1" cannot hold after hero: `START` fields Hikari as hero. | Potential's P1 check compares with the train head before its merge. | Potential |
| 10 | Battle save is based on `9bede1e`. Freeplay adds four Sim keys that its guard will reject. | Classify them during the train B rebase (§2). | freeplay |
| 11 | Hero's release waits on #75, which is 85 commits behind. | The stage-HP pass runs on the train (§9.2, step 2). #75's other edits rebase after train C. | train C |
| 12 | Codex ribbon gems would bump `SAVE_VERSION` to 3, which collides with roster's 3. | Switch them on in train D, sharing v3. | codex, roster |

---

## 11. Combined owner questions (each has a default that ships if unanswered)

**Already answered (Oct 14, `OWNER_DECISIONS.md`):**
- Hero Q1: heroes are **free to place**; towers keep their prices.
- Chika Q2: her extra power is **approved** ("chika should be strong").
- Chika Q3 (how far drones fly): **replaced** by "operate like the helicopter". See Q-B.

**Open:**

| # | Question | Default | Needed by |
|---|---|---|---|
| Q-A | **Release plan.** Three forced co-op updates: freeplay, then hero + Chika + Potential + codex together, then roster. | Yes. Alternative: Potential alone right after freeplay. That is one more forced update, and Potential becomes visible sooner. | train B release |
| Q-B | **Chika flight modes (new).** Her drone wing gets the flight modes, and Chika herself stays where she is placed. The modes are **Hover** (today's 4-tile roam around her, the default), **Hold** (hover around a point you pick), **Patrol** (between two points you pick) and **Pursuit** (map-wide; chases her target mode's #1), all available from tier 0. "Follow the touch" becomes **tap a rally point**: one command per tap, not a live cursor stream, so co-op stays command-driven. | As written | Chika M1 (data) and M3 (panel) |
| Q-C | Chika Q1: show her split as Overall / Chika / Drones tabs, or let players set it? | Show it (tabs). The flight-mode selector is the panel's control. | Chika M3 |
| Q-D | **Hero Q2 (economy).** The free hero lets free players clear 6 more Hard and 4 more Nightmare stages, so 760 first-clear gems become reachable earlier (once per account) and sweeps unlock earlier. Train C re-measures this figure after the HP pass. | Ship as measured and record the figure in `docs/BALANCE.md`. If no: `DIFFICULTIES.hard/nightmare.heroCost` puts a deploy price back on medal difficulties. | **train C release (blocking)** |
| Q-E | Hero Q3: the four features together make the campaign easier. | One stage-HP pass in train C, aiming the Normal campaign at ×1.1–×1.3 of today's headroom, so heroes feel strong but the campaign is not twice as easy. | train C pass |
| Q-F | Potential Q1: SSR recruits older than the last 100 | (a) cautious guess | Potential M0 |
| Q-G | Potential Q2: sparks and SSR Select Tickets on an owned girl give +1 Potential | Yes | Potential M1 |
| Q-H | Potential Q3: "after coop stuff and freeplay" means after the freeplay merge; the invisible counter ships earlier | Yes | now |
| Q-I | Codex Q1: should mode ribbons pay gems? | No. If yes: 5 per ribbon on Normal and above, only with that difficulty's Standard medal, switched on in the roster release (shares `SAVE_VERSION` 3). | codex M2 |
| Q-J | Codex Q2: medals and medal gems from Standard wins only; modes earn ribbons; mode drops are capped at your best Standard difficulty | Yes | codex M2 |
| Q-K | Codex Q3: modes unlock after the stage's first clear | After one clear | codex M3 |
| Q-L | Codex Q4: co-op freeplay runs in Standard in v1, and past the goal map rules keep only their combat effects | Yes | codex M5 |

Built on defaults and not repeated here: freeplay §15 (Matriarch beatable by max teams; boss leaks cost 35 lives) and battle save §14 (mid-wave quit restarts the wave; End run; 5 saves).

**Needs the owner's economy approval, in one place:**
- Hero Q-D: medal gems reachable earlier.
- Potential Q-F and Q-G: the backfill estimate, and sparks and tickets as duplicates.
- Codex Q-I and Q-J: ribbon gems (off) and the drop cap.
- Freeplay milestone gems: already built; §10.7 protects them.
- Chika: none (no coin, cost or reward change).

---

## 12. Risks

| Risk | Mitigation |
|---|---|
| Train C is a big release: four features, one bump | Sequential merges with per-merge gates (§9.1); the cut-off rule; each feature is one merge commit that can be reverted before release |
| Power stacking: hero ×2, Chika +17% median mid-game, Potential +9%; campaign and freeplay too easy | One combined HP pass and a freeplay `hpBands` re-check in the same bump (§9.2); every guard re-run on the final sim |
| Hot-file conflicts (`Sim.js`, `towers.js`, `controller.js`, `towerPanel.js`) | Seam contract (§4), feature modules, rebase after every merge |
| Snapshot drift between two systems | Key guard, generic self-test, a per-feature scenario in both (§8), `SNAP_V` 2 |
| A re-pin hides a real desync | Re-pin only in the merge commit that changes behaviour, with the reason; battles without the feature must keep their digests (S8) |
| Chika scope grows with flight modes | Addendum measured before M1; Pursuit and Patrol get their own gates; M0 already carries the seam |
| Roster B3 rebase after train C is large (95 behind) | B3 writes hero tracks directly, carries the S4 and S5 hooks, and its girls get Potential rows in the same PR |
| Long co-op freeplay runs with two heroes and 60 drones | Rejoin bench at wave 150 (§9.2, step 9); clear `_pool` at wave end |
| Phone HUD crowding at 844×390 | Joint screenshot review (§9.2, step 10) |
| Cloud branches (#174, #175) touching graph files mid-train | They join train C after step 4, or train D; never a bump of their own |

---

## 13. Landing milestones

| # | Milestone | Done when |
|---|---|---|
| **L0** (today) | Spin up worktrees #3–#7 (§3); commit the seam contract on each train C branch; fix specs for §10 items 1–5 and 8–9; start the Chika flight addendum | Contract in all four branches; specs updated |
| **L1** | Battle save lands (train A) | Its gates on live; sim id unchanged |
| **L2** | Potential M0, attack FX and unit info land (train A, one or more updates) | Their gates; co-op id unchanged |
| **L3** | Freeplay ships (train B): rebase, key classification, milestone shadow, lockstep WIP | Freeplay §13 gates; protocol 3; "both players update" |
| **L4** | `train/battle-2` cut from live; hero → Chika → Potential → codex merged in order | §9.1 gates at every merge; codex dropped to D if not green at the cut-off |
| **L5** | Combined pass (§9.2, steps 1–10) | All guards green; tables in `docs/BALANCE.md`; gem figure recorded |
| **L6** | Q-D answered; docs (`CONTRACTS.md`, `OWNER_REQUESTS.md`, release notes); ship train C | Protocol 4, `SNAP_V` 2; "both players update" |
| **L7** | Roster B3 rebases and ships (train D), with ribbon gems if approved | `SAVE_VERSION` 3; 11 Potential rows; B3 hero tracks |

---

## 14. Roadmap list: suggested updates

| Item | Status now | Suggested entry |
|---|---|---|
| #170 battle save | pending | **Built**: core, wiring, prep and badges, lobby chip, docs, e2e. Ready to land (train A). |
| #164 co-op freeplay | in progress | M1–M6 built, including checkpoints, background rebuild and rejoin at wave 150. Finishing the lockstep change, key classification and the milestone shadow. Train B. |
| #165 Potential | pending | Spec r2 done. **M0 can start now** (train A); M1–M3 after freeplay merges (train C). |
| #166 Chika rework | pending | Spec r2 done; buff approved; **new: flight-mode addendum** (owner Oct 14). M0 can start now. Train C. |
| #168 hero rework | pending | Spec r2 done; Q1 answered (free to place). M0–M1 can start now. Train C; release waits on Q-D. |
| #169 codex modes | pending | Spec r2 done. M0–M1 can start now. Train C (or D if it misses the cut-off). |
| #75 balance | pending | Its stage-HP pass moves into train C's combined pass; its other edits rebase after train C. |
| new | — | `train/battle-2` integration + combined balance pass (L4–L6) |
| new | — | Chika flight modes addendum (spec + prototype + measurements) |
| new | — | Freeplay milestone stale-tab shadow (before train B) |
