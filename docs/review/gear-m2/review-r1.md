# Gear update M2: review r1

- **Reviewed:** `feature/gear-sets` at `2cbda751`, as the diff `d15fba99..2cbda751`. M0 (`feature/gear-m0` at `d15fba99`) is reviewed separately.
- **Spec:** `docs/specs/GEAR_UPDATE.md` r3 (`44ba55dc`), with its reviews up to `docs/review/gear-update/review-r3.md` (`2829739a`).
- **Reviewer:** independent. I did not build this.
- **Verdict:** **NOT OK** (no BLOCKER or HIGH; six MEDIUM, listed at the end).

The sim work is careful. Determinism and co-op safety hold: no rng draw is added, the counters are integers, and every status call
site goes through `statusCtxFor`. I measured the re-pinned engine digests: the battles are byte-identical apart from the new fields
(§1.5). The MEDIUM findings are departures from spec r3. Most are passives that do less than the spec says, plus two spec-mandated
guards (the boxes' marks and `CASH_MAX`) that were built a different way. None of them can desync co-op or duplicate items. All of
them change hashed files or the save marks, so they should be settled before the sim id is bumped.

## What I ran

- `nice npx vitest run tests/sim/setSim.test.js tests/systems/gearSets.test.js tests/battle-ui/snapshot.test.js tests/sim/snapshot.test.js tests/online/coopStatLimits.test.js tests/art/itemArtRuntime.test.js tests/systems/gearUpdateSave.test.js tests/systems/gearStats.test.js --testTimeout=60000`: 8 files, 215 tests, all pass.
- `nice npx vitest run tests/online/engines.test.js tests/online/coopSession.test.js`: 2 files, 62 tests, all pass.
- `node tools/simId.mjs` gives `293123e663ed`, the `PENDING_BUMP` pin. The hash covers `src/sim/setRules.js` and `src/online/coop/statLimits.js`.
- **The digest check (§1.5).** I exported `src/`, `e2e/` and `tools/` at `d15fba99` and at `2cbda751` into two scratch trees. In both I
  patched `snapshotDigest` the same way: it strips the new keys (`burstBudget`, `controlMul`, `itBonus`, `superCrit`, `set`, `setN`,
  `setLr`, `buffDurMul`, `abilHaste`, `blastK`, `avgCrit`, `critCeil`, `superChance`, `sure`, `confetti`, `burstLeft`) and dumps
  every snapshot it hashes. Then I ran `runReturningAbilBattle` (47,017 ticks) and `runTenkaBattle` (51,073 ticks) in each tree.

## 1. Determinism and co-op

1. **No new rng draw: holds.**
   - A sure crit is `hit.sure > 0` on the spec. A super crit reuses the hit's one draw: `critRoll < hit.superChance` (`src/sim/combat.js:103-112`).
   - `Sim._hit` still draws only when `spec.critChance > 0` (`src/sim/Sim.js:590`).
   - Confetti Burst's spec sets `critChance: 0`, `superChance: 0`, `sure: 0`, `status: []`, `procStatus: null`, `mark: null` and
     `knockback: 0`, so it draws nothing (`src/sim/towers.js:2292-2296`).
   - The average crit is arithmetic (`src/sim/setRules.js:130-134`).
   - `setSim.test.js` "no rng draw added" counts one draw per sure-crit hit.
2. **Counters: integer, as the spec requires.**
   - `cheerT` counts steps (`src/sim/abilities.js:656`). `angleN` and `burstN` are taken modulo the period (`src/sim/towers.js:692`, `:695`).
   - `burstBudget` gains +1 a step, up to 12 (`src/sim/Sim.js:357`). `it.left` is in whole steps (`src/sim/status.js:121-129`, `src/sim/enemies.js:497`).
   - The Bake Sale carry `bakeC` is a float fraction, like `_cashCarry`. It is deterministic IEEE arithmetic (`src/sim/Sim.js:505-511`).
3. **`statusCtxFor` at every site: holds.** I grepped `applyStatus(`, `_applyStatusEvent(`, `_statusCtx` and `_curseCtx` in `src/sim`. Every site sets the
   applier through `statusCtxFor` before its first apply:
   - `Sim.js:636` (`_onHitEffects`: hit statuses, `procStatus`, mark, silence, reveal, the holy silence, and the knockback read at `:664`)
   - `Sim.js:833` (curse spread: `null`, then its own `sourceUid`)
   - `abilities.js:427` (`applyStatuses`; callers `:450`, `:558`, `:609`, `:1010`, `:1011`, `:1189`)
   - `hero.js:406` (covers `:431`, `:437`, `:439`, `:450`)
   - `barricades.js:364`, `:409` (covers `:416`, `:418`)
   - `vines.js:56`, `lab.js:217` (read at `:177` inside the same `grid.each`), `zones.js:300` (read by `inWell` at `:277-284` in the same step; `sourceUid` is reset to `z.src` at `:301`)
   - `potential.js:102`, `:163`, `duo.js:271`

   No site reads a stale `controlMul` or `itBonus`. The helper writes only `sourceUid`, `controlMul` and `itBonus`, so where it sits
   among the other context assignments does not matter. Previous `sourceUid` values are kept at every site.
4. **Bake Sale carry in saves: holds.** The generic co-op snapshot (`src/sim/snapshot.js`) stores tower fields, so `bakeC` rides
   in checkpoints. The battle save packs it as `bk` and clamps it to 0–1 on restore (`src/ui/battle/snapshot.js:466`).
   `cheerT`, `angleN` and `burstN` are appended to the index-coded `GEAR_FIELDS` (`:458`). `burstBudget` is packed as `bb` (`:324`, `:720`).
   Enemies, and so the `it` record and the cheer rallies, are `calm` (gone at a battle save). `tests/battle-ui/snapshot.test.js` passes.
5. **Re-pinned digests: only the new fields changed (verified).** With the new keys stripped, I compared the old and new trees:
   - `runReturningAbilBattle` gives `ckDigest c653f418` and `finalDigest 089da6b4` in both trees. These equal the pre-M2 pins.
     `final 3293782298` and `hashes 6e087590` are also equal.
   - `runTenkaBattle` gives `e864bd71` and `8e111df8` in both trees, again equal to the pre-M2 pins.
   - Every dumped snapshot (checkpoints and finals) is **byte-identical** between the trees (`cmp`).

   So the battles are unchanged in their whole state, which is a stronger result than unchanged hit sequences. The new pins
   (`tests/online/engines.test.js:213`, `:269`) differ only by the new keys.
6. **Save and restore with the new fields: holds** (item 4). `restoreSim` sets a missing `bb` back to `BURST_BUDGET_MAX`
   (`src/ui/battle/snapshot.js:720`), so older battle saves restore.
7. **An old client is refused: holds today, before the bump.**
   - `sameVersion` compares `sim` whenever both sides send it (`src/online/coop/version.js:97-100`). The id changes to `293123e663ed`, so an M1 client and an M2 client cannot pair.
   - The `COOP_PROTOCOL` bump at release (`version.js:72`, still 13) adds the protocol check on top.
   - `PENDING_BUMP` (`tests/art/itemArtRuntime.test.js:211`) must be replaced by a `KNOWN` line when the protocol is assigned.

## 2. The passives against the spec

- **You're It: correct.**
  - Bosses and minibosses take half (`combat.js:49-53`).
  - Hits take it (`combat.js:100`) and so do DoT ticks (`computeDot`, `combat.js:199`). It is applied once in each place; `damageTakenBonus` is untouched, so it never doubles.
  - It is marked only for control types, after the ward, the chance draw and the zero-duration returns (`status.js:75`).
  - `sourceUid` is never read for it.
- **Control Strength comes before `CC_RESIST` and `ccLeft`: correct** (`status.js:44-48`). A slow's strength is unchanged.
- **Push-back ×(1 + (c − 1)/2): correct on the hit path** (`Sim.js:664`). Bosses stay immune through `KNOCKBACK_RESIST`. See L2.
- **Buff Duration: correct on every site** the spec lists for M2:
  - rallies (`abilities.js:978`, `:988`, `:1015`)
  - Big Cheer (`:661`)
  - the hero ult rate buff (`hero.js:443`)
  - overclock (`buffs.js:196`)
  - drinks, with `floor` (`drinks.js:47`)
  - Brews and auras are untouched, as specified.
- **Super crits: correct, apart from M3.** They are split at `mods.js:805`. `critCeil` is 2 only with Geometry 5 (`progression.js:533`, `setRules.js:115`).
- **The average-crit paths: correct.** The factor reaches non-critting traps (`mods.js:812-813`) and burns and poisons (`mods.js:867`). `progression.js:483-493` picks the better of the fill-in and the average crit for kits whose crit lines fill in. See L3.
- **Supercharge: correct.** Rally and debuff kinds are excluded from the faster charge (`gearRules.js:105-109`). Damage goes through `abilitySpec` (`abilities.js:323`).

## 3. Economy

- **Set Boxes: no duplication.** `openSetBox` checks room for 5, then consumes the box once, then adds 5 pieces at the box's rarity, never UR (`gearSets.js:84-97`).
- **Pins: no farming.**
  - Gold, UR and LR only.
  - One Tie Pin per main; one Collar Pin per piece (LR: two, on different lines).
  - Each pin is consumed with its coins before it applies (`gearSets.js:114-164`).
- **Post-roll: capped and not scummable.**
  - It pays only on wins and sweeps, under the `cap:setDay` daily cap of 3. The counter rises only when a piece is paid (`gearSets.js:179-215`).
  - Its forked rng hangs off the battle's drop seed (`battleDropSeed` for saved battles), so reloading cannot reroll it.
  - Sweeps fork per run (`rewards.js:401`).
- **Titan chests and first clears: correct.**
  - The chests pay the titan's set (`titans.js:283`, `:351`). Normal's Rare box stays No set (`titanRewards.js:120`).
  - Hard's and Mayhem's first-clear boxes become set pieces. Nightmare's Legendary box becomes the titan's Legendary Set Box (`titans.js:252`).
- **The Rainbow Gear Box: correct.** It takes any of the five slots, and a Hair Clip or Necklace needs a set (`gear.js:396-416`). No legacy mark is written for a new-slot piece. See L4.
- **Veteran and welcome boxes:** they are never paid twice, but the design differs from spec r3 (**M1**).

## 4. Caps

- **`statLimits` rows: match §10.2.** `damageMul` 0–40, `rateMul` 0–12, `critChance` 0–2, `critMul` 1–12, `armorPen` 0–100, `auraPct` 0–5, `auraRangeMul` 1–2, `dotMul` 1–4, plus the new keys (`statLimits.js:34-77`). `coopStatLimits.test.js` and `coopSession.test.js` pass.
- **`unitBattleStats` keeps `ultHaste` and `pierceK` at today's caps.** The set caps only reach `abilHaste` and `blastK` (`progression.js:504-520`). A hero's ult never sees the lifted haste.
- **Infinity and NaN: none in practice, but the spec's guard is missing (M2).** The interest ceiling (`Sim.js:952`) makes cash grow at most linearly, so cash stays far below 2^53. `CASH_MAX`, the cash test and the lab's lifted ceiling are still missing.

## 5. Not finished yet (noted, not failed)

- **Gates and tuning:**
  - Gates G0–G13 are unmeasured.
  - The raise-only pass over r5's rows has not been done.
  - The `maxed5'` … `urLate5'` presets do not exist.
  - G4's tooling belongs to M3.
- **Spec §13 tests that do not exist yet:**
  - `tests/sim/cashCeiling.test.js`, `setBox.test.js`, `pins.test.js`, `gearSources.test.js`, `neverWeaker.test.js`
  - the per-call-site Control Strength cases and the Buff Duration per-kind cases
  - the `SET_START` scripted battle in `e2e/engines/scriptedBattle.js` (§10.4)
  - `e2e/gear-sets.mjs`
  - `tests/data/gearSupportFit.test.js`, which `src/data/gearStats.js:232` names but does not exist
- **Unfinished UI and display:**
  - The UI is minimal: five slot cards, a set line, the Set Box and pin modals. `setIdle` (§3.1) does not exist (see M6).
  - The battle panel has no "Crit 112 % · super 12 %" readout and no super-crit numbers. There is no set crest or ring, no Formation work and no wiki article.
  - `CARD_FIVE_PIECES` is still off (three pieces on cards and Support Students, as specified until the SQL paste).
- **Release work:**
  - The patch note is due at the push to `main`.
  - The `COOP_PROTOCOL` number and its `KNOWN` line are due at release.
- **Would ship visibly wrong:** `SHOWN_SLOTS` is now all five (`gearSlots.js:14`), but no e2e covers the 844 × 390 layout. Also see M6: passives that the set line promises but that do nothing for some kits.

## 6. Other games' names

- I grepped the added lines for common franchise names and found none.
- The set, passive and piece names are spec r3's.

## Findings

### MEDIUM

**M1. The veteran and titan Set Box marks are not spec r3 §5.3's one-mark-per-box rule.**
- **Where:** `src/systems/gearSets.js:221-243`, `src/systems/save.js:150`, `src/systems/titans.js:251-252`, `src/data/gearAwaken.js:86`.
- **What spec r3 says:** one mark per box, `su:welcome` and `su:titanbox:<titan>`. The check runs in `migrateProfile`, after each campaign result and after each Titan Trials result. The Nightmare first clear "pays it through this same check, never on its own". "There is no separate `su:vet` mark."
- **What the builder does:**
  - One `su:vet` mark pays every titan already cleared on Nightmare, once, at the first M2 load.
  - `createProfile` pre-sets `su:vet`.
  - The first-clear table pays the Legendary Set Box directly.
- **Effect:** I found no double payment. But a save that loads M2 and then makes a titan's Nightmare first clear in an older open tab (M0 or M1, which pays a plain Legendary box) never gets that titan's Set Box. Spec §13's "whichever trigger comes first, in any order" case cannot pass.
- **Fix:**
  1. Replace `su:vet` with `su:titanbox:<titan>` per titan: whenever a save has `tfc:<titan>:2` and no mark, pay and set the mark.
  2. Route the first-clear box through that check.
  3. Run the check after Titan Trials results too.

**M2. `CASH_MAX`, the cash-ceiling test and the lab joiners' lifted interest ceiling are missing (L16).**
- **Where:** `src/sim/Sim.js:478-500`, `src/sim/lab.js:248`, `src/sim/constants.js`.
- **What spec r3 requires** (§3.2, §10.1, §10.3, §13):
  - `CASH_MAX = 1e12` (hashed) in `_gainCash`, clearing `_cashCarry` when it caps.
  - The same in `_gainCashFor`, so the co-op wallets are bounded.
  - `INCOME_INTEREST_SET_MAX` for the lab joiners' interest.
  - A 2,000-wave Treasurer test.
- **What exists:** only the per-girl interest ceiling `INTEREST_SET_CEIL` (`setRules.js:58`, used at `Sim.js:952`). Its name also differs from the spec's `INCOME_INTEREST_SET_MAX`.
- **Effect:** by my count no realistic Freeplay run reaches Infinity, because cash grows at most linearly. But the guard the spec made mandatory, and its test, are absent. `lab.js:248` still caps a Treasurer 5-piece joiner at 150 coins.
- **Why it matters now:** this changes hashed files, so it must land before the bump.

**M3. Crit buffs still clamp at 100 %; spec §4.5 (L15) moves both clamps to `critCeil`.**
- **Where:** `src/sim/buffs.js:36-37`.
- **What happens:** `applyBuffExtras` still does `Math.min(1, t.stats.crit.chance + b.critChance)` for `t.eff` and the turret line. The super-crit chance only comes from her unit crit (`mods.js:805`).
- **Effect:** a Geometry 5-piece girl gets nothing from crit auras, brews or links once she is at 100 %. The spec's "her kit and aura crit pass 1" cannot happen.
- **Fix:** read `critCeilOf(t.unitStats)` here too, and add the part over 1 to `t.eff.superChance` (and the turret spec's).

**M4. Big Cheer is merged into the ability rallies' `dmgMul` instead of having its own `cheer` buff key.**
- **Where:** `src/sim/abilities.js:642-680`.
- **What spec r3 says:** §3.4 has Big Cheer give "buff key `cheer` … read in `recomputeBuffs`". §10.4 lists `cheer` as a derived tower key.
- **What the builder does:** each cheer is a rally record flagged `cheer` (`:675`), and `applyRallies` takes the strongest `dmgMul` per key.
- **Effect:** a cheer adds nothing to a girl who is already under a stronger ability rally. Many of the spec's Spirit Squad fits (Wakaba, Noa, Ouka, Chika) cast rallies themselves. While they rally, the 4-piece passive is dead on their own team.
- **Fix:** add a separate `cheer` key (strongest cheer wins, and it multiplies with the rallies), or have the spec amended to say "strongest of cheer and rally".

**M5. Bake Sale misses the coin-makers the spec names, and Treasurer interest is not owner-routed.**
- **Where:** `src/sim/Sim.js:775-776`, `:951-956`.
- **What spec r3 says:** §3.2: "a coin-maker's own coins too (Momo's wave coins, Chigusa's harvest, Ouka's coins per kill)", and "Bake Sale and the Treasurer's interest pay her owner's wallet in co-op".
- **What is covered:** only kill bounties and wave income plus interest.
- **What is not:**
  - Golden Harvest (`Sim.js:960`)
  - the econ abilities' coins (`abilities.js:1032`)
  - Ouka's hub coins (`hubs.js:104`)
  - the lab economy coins (`lab.js:251`)
- **The interest:** the set-cap interest, up to 5,000 a wave, still pays into the pooled cash (`Sim.js:954`), so in co-op it is split between the players.
- **SET_TEXT:** its "her own coins too" (`src/data/gearSets.js:70`) overstates what the passive does.

**M6. Right Angle and Confetti Burst count every attack but act only in five behaviours; there is no idle state.**
- **Where:** `src/sim/towers.js:660-704`, with `gearSpec` called only at `:861`, `:892`, `:910`, `:1111`, `:1169`.
- **Where they work:** projectile, pulse, duel, beam and chain attacks.
- **What goes wrong elsewhere:** `mortar` (the duo), `ring` (Kinu), `roll` (Marumi), `strip` and `drink` attacks still advance `angleN` and `burstN`. Right Angle even emits `setTrick rightAngle` (`:692`) when nothing crit.
- **Effect:** Kinu, Marumi and the duo are on the spec's Party Popper fit list, and Confetti Burst does nothing for them.
- **What is missing:** spec §3.1's dead-passive rule (`setIdle`) does not exist, so the set line (`girlGear.js` `gearSetLine`) and the Set Box picker promise these passives.
- **Fix:** apply the passives in those behaviours, or add `setIdle` with the idle chip and stop counting and emitting for kits that cannot use them.

### LOW

- **L1. You're It's time (`src/sim/status.js:75`).** The mark's `left` comes from the duration just applied. Spec §3.4 says "the longer of its own and that status's remaining time", which is the merged `cur.left` after a refresh. The difference only shows when another girl's longer status is refreshed by a shorter one from the Freeze Tag girl.
- **L2. Push-backs (`src/sim/Sim.js:664`).** Control Strength lengthens only the on-hit push-back. Ability pushes and the hero ult's push (`abilities.js`, `hero.js`) are not lengthened, while §2.4 says "her push-backs".
- **L3. The `avgCrit` key (`src/systems/progression.js:483-493`, `statLimits.js:75`).**
  - It travels as the factor (row 1–20), not spec §8.3's 0/1 flag.
  - For the aura-fill girls (Miko, Umeko), whose crit lines fill into aura, the comparison is skipped, so they get both (the spec says "never both"). The effect is small today.
  - Curse bursts do not take the average crit (lever 1 lists them).
- **L4. Rainbow Gear Box sets (`src/systems/gear.js:399`).** `openRainbowBox` accepts all six sets, including Treasurer and Power Bank. Spec §3.6 says "a titan set". The UI offers only the four titan sets (`src/ui/gearUr.js:507`). Restrict it to `TITAN_SETS` in the system as well.
- **L5. The `gpl:` mark (`src/systems/gear.js:652`, `src/data/gearAwaken.js:83`).** Box-born UR Hair Clips and Necklaces keep their paid-level bits in a new `gpl:` mark. Spec §9.4 (L19) says `gbl:` is allowed on new-slot pieces, so that M0's `boxPaidBits` prices them. With `gpl:`, an M0 or M1 build that salvages such a piece refunds those levels at the lower price (short, never double).
- **L6. Mode wins (`src/systems/rewards.js:267-288`).** Battle-mode wins do not get the set post-roll. §3.6 says "each win or sweep".
- **L7. The boxes are silent.** The one-time boxes are paid inside `migrateProfile` with no notice line (§5.3 asks for one).
- **L8. Rounding (`src/systems/progression.js:504`).** `abilHaste` is `r4(0.5 × min(…))`, where the old path was `0.5 × r4(…)`. The last digit can differ, which can very rarely change an existing girl's integer charge per tick. This is harmless under the bump, but the claim that existing battles are unchanged rests on it.
- **L9. Misplaced comment (`src/sim/combat.js:47`).** The JSDoc "Bonus multiplier from mark + vulnerable" now sits above `itMul` instead of `damageTakenBonus`.

## Verdict

**NOT OK.** Six MEDIUM findings stand: M1 (veteran and titan box marks), M2 (`CASH_MAX` and the lab interest ceiling), M3 (crit-buff clamp at `critCeil`), M4 (Big Cheer's own buff key), M5 (Bake Sale coverage and wallet routing), M6 (Right Angle and Confetti Burst on the other behaviours, or `setIdle`).

There is no BLOCKER and no HIGH. Determinism, co-op refusal, the re-pinned digests (only the new fields changed, verified byte for byte), battle saves, Set Box, pin and post-roll farming, and the clamp rows all hold.

M2 through M6 touch hashed sim files, so fix them before the sim id is re-pinned and the `COOP_PROTOCOL` bump is assigned. Each MEDIUM can also be closed by an owner-approved spec amendment instead of a code change.
