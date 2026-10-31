# v0.1.66 release audit A: sim, determinism, co-op lockstep

Target `release/v0.1.66` @ `94cb548b`. Auditor A (independent; built none of it). Scope: the merges, not the
features one by one.

**Verdict: GO.** No HIGH or MEDIUM findings. There are three LOW notes for after the release. None blocks the
release, and fixing any of them changes the sim id.

## 1. Merge conflict resolutions (`git show --remerge-diff`)

| Merge | Conflicts | Resolution checked |
|---|---|---|
| `0e70d5da` S5 (+r5) | `tests/sim/freeplayWyrmReach.test.js` | ok (a test only) |
| `a1c48d06` Ena | tests only (`engines.test.js`, `perf.test.js`, `itemArtRuntime`) | ok |
| `3e460c1b` Iroha | `rosterFx.js`, tests | ok: the network loop is kept, mirror 0 goes through `_mirrorSpot` (Ena-side panel fix), `_glideProp` + `_mirrorSpot` both kept; the snapshot guard uses `irohaRun()` and keeps the S5 keys |
| `ee06becd` gear LR | `Sim.js`, `buffs.js`, `combat.js`, `drinks.js`, `mods.js`, `status.js`, `vines.js`, `progression.js`, `ui/battle/snapshot.js`, `scriptedBattle.js` | ok, details below |
| `ad4ac047` loadouts + Build Coach | `save.js` | ok: `grantSetBoxGifts` runs, then `cleanBuildCoach`/`writeBuildCoachMark`; both imports kept |
| `b894f8d7` main v0.1.65 | `patchNotes.js`, `results.js`, `unitBuild.js`, `icons.js` | ok: v0.1.66 is on top, v0.1.65 below it unchanged; `slotName()` plus `{ set }` are both kept (display only) |

`ee06becd` in detail:
- `Sim.js:715-723` knockback: the Control Strength `pushMul` runs first, then the wind `kbLeft` cost (`WIND_KB_COST`). This is the requested order, and `wind` is in scope.
- `combat.js:194` `computeDot`: the curse has no element and no ward, and it reduces as mystic. It also takes `damageTakenBonus × itMul`, so all three sides are present.
- `vines.js:175,202`: the S3 road-vine `holdLead` and the vine slow both use `statusCtxFor(ctx, t)`. Gear's old `castVine` body was dropped correctly, because S3 replaced it, and the gear side only changed `ctx.sourceUid = t.uid` → `statusCtxFor`.
- `mods.js:1102-1104`: `pierceBand(s, us)` → `applyUnitStats(…ub × pot…)` → `if (pw) applyPower(s, pw)`. Power is kept, and the import union is complete (`powerFor`, `PIERCE_MAX_EXTRA`, setRules).
- The `status.js`, `buffs.js`, `drinks.js`, `progression.js` and `snapshot.js` imports are union merges with nothing lost (`CURSE_SPREAD_STEPS`, `CONTROL_TYPES`, `restoreMirrors`, `INCOME_INTEREST_*`, `powerKitOf`).
- `scriptedBattle.js`: the engine-check return carries `sets` plus all S1–S5 runs.

The non-conflict seams I spot-read are all fine:
- `Sim._hit` (`Sim.js:625-674`): the tether share is skipped when `spec.noShare` is set (S5), Confetti runs before the kill, and the share runs after the kill or the effects.
- `mirrors.js` (`p.scale` is carried to the copies, `split = true` is set on her bolts) and `s5shapes.js:95,169` (`p.split = true`).
- `channel.js:34` `ch.set`, and `towers.js:2492` clears its burst bit.
- `simHash.js:110` hashes `ch.set` only when it is nonzero.
- Battle-save keys: `mr`, `gr` (incl. `bakeW`), `bk` (bakeC, unrounded), `sd`, `lb`. All are present in a combined save.

## 2. Determinism

- `git diff origin/main...HEAD -- src/sim src/online src/systems src/data`, with comments ignored, adds no `Math.random`, no `Date`/`performance.now`, and no trig, `exp`, `log` or `pow` in sim paths. The only new math is `Math.sqrt`, which is correctly rounded. `Date.now()` appears only as a default in `gearSets.js` profile code, which is outside the sim. `**` and `10 **` appear only in save marks.
- Iteration runs over arrays and insertion-ordered objects, and ties are broken by uid or grid order.
- Sim id `36cba1c215b0` = `KNOWN[14]`, and `COOP_PROTOCOL = 14`.
- `statLimits.js` passes every new gear key (`set`, `setN`, `setLr`, `buffDurMul`, `controlMul`, `blastK`, `pierceAtkMul`, `avgCrit`, `critCeil`, `lr`), so co-op loadouts keep set passives.
- **Combined stress test** (a scratch vitest, not committed). On 3-5 Hard and the endless challenge, the team is Iroha T5 (a placed mirror, Geometry LR), Ena T5 (Freeze Tag LR, Control 1.3), Suzu T5 Bell Toll (Popper LR), Miko Charm Wheel (Spirit LR, Buff Duration), Momo (Treasurer LR), Raika (Powerbank LR), Fuu (Control 1.4, wind) and Luna, with abilities on Auto:
  - At every calm point over 10 waves, I restored the battle save. The restored copy and a sim-snapshot twin then played the next two waves with the same `hashSim`, cash and lives, and nothing was dropped.
  - I took a co-op checkpoint mid-wave with a curse live and toll rings out (wave 11). It restored to the identical JSON, and the snapshot digests stayed equal every 500 ticks for 6000 ticks. **4/4 passed.**
- **Old saves:** I built a v0.1.65 profile on `origin/main`'s own code (7 girls, 12 equipped pieces) and loaded it on the release with `deserializeProfile`. **0 leaves changed or lost.** The only addition is the empty `hair`/`necklace` slots. Migrating it back through main's `migrateProfile` also changes 0 leaves.
- **Protocol 13 refused:** `coopSession.test.js` and `coopFreeplay.test.js` test that a hello or a start from protocol 13 sets `mismatch` and never becomes a battle. The banner (`coop.js:255/258`) reads "… is on 0.1.65 and you're on 0.1.66, the newest. Ask … to reload the page (the game updates itself)", which is friendly.

## 3. Runs

| Gate | Result |
|---|---|
| `npm test` (full) | **420 files passed, 2 skipped; 6636 tests passed, 11 skipped** (532 s), exit 0 |
| `node e2e/engines.mjs --require-all` | 27 scripted battles identical on Node V8, Bun 1.4.4 JSC and Playwright Chromium 153 (gear sets, Iroha gear, links, S5a, S5b, Ena curses, abilities, Tenka, Tryout/Extended rejoins…). Exit 1 **only** for `--require-all: 2 engine(s) missing` (SpiderMonkey/Firefox and WebKit are not installed) |
| `e2e/coop-rejoin.mjs` | all ok (179 s): rejoin from a checkpoint, resync replays 2 ticks, hashes agree |
| `e2e/coop-freeplay.mjs` | all ok (113 s) |
| `e2e/multiplayer.mjs` | all passed |
| `e2e/tryout-coop.mjs` | all passed |
| `tests/online` | inside the full run, all passed |

## 4. Findings

**HIGH:** none. **MEDIUM:** none.

**LOW 1: Control Strength on push-backs differs by source.**
- `Sim.js:718` scales on-hit knockback by `pushMul({ controlMul: ctx.controlMul })`, where `ctx.controlMul` comes from `controlMulOf()` and so includes Freeze Tag LR's ×1.15.
- `hero.js:455` and `abilities.js:1189` use `pushMul(unitStats)`, which uses the raw `controlMul` and leaves out the LR ×1.15.
- The result is deterministic, but the same girl pushes slightly further with her attack than with her ability.
- Fix (after the release, sim id bump): give `pushMul` one definition (e.g. `pushMul = (us) => 1 + (controlMulOf(us) - 1) / 2`) and call `pushMul(tower.unitStats)` in `Sim.js`. Alternatively, document the difference as intended.

**LOW 2: `_spreadCtx` is not set through `statusCtxFor`.**
- `Sim.js:245` creates `_spreadCtx` without `controlMul`/`itBonus`, and `_curseTick` (`Sim.js:941-942`) sets only `sourceUid`.
- `_flushCurses` (`Sim.js:893`) calls `statusCtxFor(ctx, null)` first.
- Harmless today, because a curse is not a `CONTROL_TYPE` and `undefined > 1` is false. It does break the "every call site uses statusCtxFor" contract in `setRules.js:108`.
- Fix: call `statusCtxFor(ctx, null)` before setting `sourceUid` in `_curseTick` (the behaviour is identical, but `Sim.js` is a hashed file, so it goes in the next sim release), and add the two fields to the `_spreadCtx` and `_curseCtx` literals.

**LOW 3: the co-op hash does not cover enemy statuses.**
- `simHash.js` covers enemy uid, position and HP only, not the curse state (`rotDps`, `rotUid`, `spreadIn`, depth), so a curse desync is caught only once HP diverges, a few ticks later. This was true before the release too.
- Checkpoints still carry the curse state exactly, because the generic serializer stores it.
- Fix: no fix needed now. Optionally fold `e.statuses.curse` (depth, spreadIn) into the hash when it is present (a hash change, so a protocol bump).
