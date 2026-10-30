# Gear update M2: review r2

- **Reviewed:** `feature/gear-sets` at `d501c0b9`, as the diff `2cbda751..d501c0b9`. This diff also carries the merge of `feature/gear-m0` at `7f7a9fcf`, which is reviewed separately.
- **Previous review:** r1, `docs/review/gear-m2/review-r1.md` (`6430dc29`): NOT OK, six MEDIUM.
- **Spec:** `docs/specs/GEAR_UPDATE.md` r3 (`origin/spec/gear-update`, `44ba55dc`).
- **Reviewer:** independent re-review. I did not build this.
- **Verdict:** **NOT OK**. One MEDIUM: r1's M2 is fixed for cash but not for the lab joiners. There are also six LOW findings.

## What I ran

- `npm test` (full): 395 files (393 passed, 2 skipped); 6,237 tests (6,226 passed, 11 skipped); exit 0.
- `node e2e/smoke.mjs`:
  - **First run:** 677 ok and 1 FAIL ("drag (touch): releasing places aoi where the pointer let go", 0.42 tiles off). That run shared the CPU with the vitest run.
  - **Rerun alone:** 678 ok, `ALL SMOKE CHECKS PASSED`. I count it as load flake, not a regression.
- `node e2e/gear-slots.mjs`: all checks pass at 844 × 390 and 1280 × 720, including the idle greying.
- **Sim id:** `simId()` (`tools/simId.mjs`) gives `c086fd626d88`, equal to `PENDING_BUMP` (`tests/art/itemArtRuntime.test.js:211`). `COOP_PROTOCOL` is still 13, which is correct for an unshipped branch.

## The r1 findings

| r1 | Status | Evidence |
|---|---|---|
| M1 box marks | **Fixed** | `su:vet` is gone. `su:welcome` is gated on `titansUnlocked`, and each titan has its own `su:titanbox:<titan>` (`src/systems/gearSets.js` `grantSetBoxGifts`). The check runs in `migrateProfile` (`save.js:687`), after campaign wins (`rewards.js:351`) and after Titan Trials results (`titans.js:285`). The Nightmare first clear drops its plain Legendary box and pays only through the check (`titans.js:253`). `createProfile` no longer pre-sets a mark. The "older tab clears Nightmare after M2 loaded" case now pays at the next M2 load. |
| M2 `CASH_MAX` / interest | **Partly fixed** (see N1) | `CASH_MAX = 1e12` is in `_gainCash` (the carry clears at the cap), in `_gainCashFor` (pooled and `ownerCash`) and in the co-op wallets (`commands.js:225-234`). `INCOME_INTEREST_SET_MAX` replaces `INTEREST_SET_CEIL`. The lifted part of the interest goes to its owner (`Sim.js:972`). `tests/sim/cashCeiling.test.js` runs 2,000 wave clears. The lab lift reads the wrong girl's set. |
| M3 crit clamp | **Fixed** | `applyBuffExtras` splits kit, gear and aura crit with `splitCrit(…, critCeilOf(us))`, for `eff` and the turret (`buffs.js:36-46`). With ceiling 1, `splitCrit` returns `[min(1, c), 0]`, the same as before for every girl without the set. `eff` and `turretSpec` are rebuilt on each `refreshEffective`, so nothing accumulates. |
| M4 Big Cheer key | **Fixed** | The strongest cheer multiplies on top of the strongest rally (`buffs.js:340-361`). It applies even with no ability rally. Ability rallies are unchanged. |
| M5 Bake Sale sources | **Fixed** | `_bakeOn` covers Golden Harvest (`Sim.js`), the econ ability coins (`abilities.js:1034`), Ouka's hub coins (`hubs.js:106`) and the lab economy. Lifted interest is owner-routed. `SET_TEXT` matches. |
| M6 Right Angle / Confetti | **Fixed** (the `setIdle` option) | Both counting and firing are gated to `SET_ATTACK_BEHAVIORS` (`towers.js:670`, `:690`). `setIdle` greys the set line with a reason (`girlGear.js:87`), and the e2e checks it. The Set Box picker does not read it yet (R2). |
| L1 You're It time | **Fixed** | `max(duration, cur.left)` (`status.js:76`). Same units (seconds), and no Infinity durations exist in `src/sim`. |
| L2 push-backs | **Fixed** | `pushMul` is applied on hits, ability moves (`abilities.js:1190`) and the hero ult (`hero.js:449`). |
| L3 avgCrit | **Partly fixed** | The aura-fill girls no longer get both (`progression.js:490`). Curse bursts take the average crit (`Sim.js:651`, `abilities.js:430`). The key still travels as a factor, not a flag; that is acceptable. |
| L4 Rainbow sets | **Fixed** | `TITAN_SETS` is now in `src/data/gearSets.js` and is checked in `openRainbowBox`. |
| L5 `gpl:` | **Fixed** | `gbl:` is now used on the new-slot pieces too, as spec L19 allows. |
| L6 mode wins | **Fixed** | `rewards.js:287`. It shares the forked `setPost` rng and the daily cap of 3, so there is no double roll. |
| L7 notice | **Fixed** (by mail) | See R5. |
| L8 rounding | **Fixed** | `0.5 × r4(…)` again (`progression.js:507`), so no existing girl's charge per tick moves. |
| L9 comment | **Fixed** | |

## Regression hunt

- **Determinism and lockstep:**
  - No new rng draw: `_bakeOn`, `pushMul`, `avgCritOf`, `splitCrit` and the cheer product are all arithmetic.
  - The behaviour gate reads `t.eff.behavior`, which is sim state.
  - `buffBy.cheer` is set only when a cheer is present. It is derived, so a recompute after a checkpoint gives the same value.
  - The new SET_START co-op scripted battle (every passive, checkpoint replay) passes in `engines.test.js`.
- **Save and resume:** no new persisted sim field. Cheers are rally records flagged `cheer`, and they end with the wave like every rally.
- **Economy:**
  - The gifts are idempotent: the mark is set before payment, and the mail id is deduplicated through `delivered`.
  - Titan first clears cannot pay twice.
  - Mode-win post-rolls share the daily cap.
  - `CASH_MAX` bounds every `cash +=` path. The sell refund (`Sim.js:1414`) is at most the cost.
- **No nerfs without sets:**
  - The interest is `min(150, raw)` exactly as before, and the Bake Sale base is unchanged.
  - The crit split at ceiling 1 is identical.
  - Rallies are untouched, push-backs are ×1 without Control Strength, and the abilHaste rounding is restored.
  - The average crit is a new unshipped lever, so zeroing it for the aura-fill girls takes nothing from live players.
- **Names:** I grepped the added lines and found no other games' or anime names.

## Findings

### MEDIUM

**N1. The lifted interest cap for lab joiners reads the lab girl's set, not the joiner's (r1 M2 not met for the lab).**
- **Where:** `src/sim/lab.js:249`, with the join at `lab.js:153`.
- **What the spec says:** §3.2 and §10.2 give "5,000 coins **a girl** a wave … `Sim.js:927` and the lab joiners' interest". The line is "Treasurer: **her** interest uses `INCOME_INTEREST_SET_MAX`". r1 M2 named the failing case: "caps a Treasurer 5-piece joiner at 150 coins".
- **What the code does:** at join, only `inc.interest` is pushed and the joiner is removed. `labIncome` then lifts every joiner's cap when the **lab girl** (Tenka) wears Treasurer 5.
- **Failure scenario:** a Momo with Treasurer 5 joins Tenka's lab, and her interest is capped at 150 again. A Tenka with Treasurer 5 lifts the cap for plain, set-less joiners. Tenka is on Power Bank's fit list, not Treasurer's.
- **Fix:** record each joiner's cap at join (for example a parallel `lab.interestCap` entry, or the rate with its cap), and pack it in the battle save's lab arrays and the snapshot. Alternatively, have the owner amend the spec to "the lab girl's set".
- **Timing:** this is a hashed file, so settle it before the bump.

### LOW

- **R1. The lifted interest emits no `cash` event (`src/sim/Sim.js:972`).** It is counted in `stats.cashEarned` but no coin popup shows, unlike the capped part on the line above.
- **R2. The Set Box picker ignores `setIdle` (`src/ui/gearUr.js:551-590`).** Spec §3.1 says the set chip, the Set Box picker and the battle panel read it. Only the set line does.
- **R3. `setIdle` reads `def.base.behavior` (`gearSets.js:273`), while the sim gates on `t.eff.behavior` (`towers.js:670`).** I found no form that changes behaviour today, but a future one would show a wrong chip. A test that pins them equal for every unit would catch it.
- **R4. The cheer has no buff-drawer row.** `ralliesOn` skips cheers (`buffs.js:297`), and its comment points to a `cheersOn` that does not exist. The spec's `cheer` icon is M3 UI, so it is noted here.
- **R5. The one-time boxes are paid by mail (`save.js:687`).** Spec §5.3 says "into items with one notice line". Mail has no `inv:` mirror, and the live build's `cleanMail` drops unknown reward ids (`isRewardId`, fixture `main-60ce9cad/src/systems/save.js:381`). This is safe only because M0 defines the set-box items. **M0 must ship before M2**, or this path must pay into items.
- **R6. The first smoke run failed once on touch-drag placement under CPU load.** It passed alone. It is worth watching if it recurs.

## Verdict

**NOT OK** on N1 alone. Every other r1 finding is genuinely fixed in the code. Determinism, saves, the economy guards and the no-nerf rule hold. The fix is small, but `lab.js` is hashed, so the sim id will move again after it.
