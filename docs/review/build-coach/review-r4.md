# Build Coach (C1): independent review, round 4

Reviewer: a new independent agent. It did not build this feature and did not write r1, r2 or r3.

Scope: `feature/build-coach` from `0a5f053f` (approved in r3) to `22a9eae2`.
- Coach commit `22a9eae2`, which fixes r3's M1, L1 and L2.
- Merge `96683c8` of `feature/gear-loadouts` `16c6c67`. The teams and loadouts code itself is reviewed separately.

## Verdict

**The coach changes are OK. The branch is not ready to ship until the test suite is green: see F1.**

## What I ran (on 22a9eae2, 4 cores)

- **Full `npm test`, run twice: 391 files passed, 1 failed, 2 skipped. 6,237 tests passed, 1 failed, 11 skipped.**
  - Both runs failed on the same test (F1).
  - Run alone, that file still fails (5.7 s against the 5 s limit).
  - The coach tests (`buildCoach`, `buildCoachScore`, `buildCoachData`) pass: 29/29.
- **`node e2e/smoke.mjs`: ALL SMOKE CHECKS PASSED, 678 ok**, exit 0.
- **`node e2e/buildCoach.mjs`: 99/99 ok** at 844x390, 1280x720 and 390x844, with no page errors.
  - It ran twice, once with `--shots`.
  - It includes the new checks: Miko's note names her lines, Miko has an aura plan, and Umeko's note names Crit Rate but not Attack Speed.
- **A throwaway sweep, not committed.** It covers all 101 rows × 3 saves = 303 plans:
  - the saves: fresh; L37 with Mythic, Legendary and Rare gear and 10 stages cleared; 20 stages cleared;
  - it ran `gearPlan`, `buildScore`, `toMax`, `farmPlan(per 6)` and `potentialPlan` on each.
  - **Result: 0 issues.**
    - No NaN, Infinity or undefined, and no empty subs or mains.
    - No crit main or substat on any `noCrit` row or on any girl whose crit lines are dead.
    - No Cost Reduction main or top-3 substat on any measured damage row.
    - No dead line in any unmeasured plan.
    - 2,919 ranked stage sources, all of them existing and unlocked.
    - 2,580 "opens later" notes, all of them still locked.
  - All 101 stored rows equal `recommend(id, row)` today, so the data was regenerated, not edited by hand.
- **A Playwright probe, not committed,** at 390x844 and 844x390: Midori on Toxicology, Miko on Purification and Umeko on Undertow Ripples.
  - No horizontal overflow and no page errors.
  - The long aura note wraps cleanly.

## r3 findings: status

| r3 | Status | Evidence |
|---|---|---|
| M1 Midori Crit Rate | **Fixed** | Toxicology `noCrit`. The plan is "Ribbon: Range · ATK > Pierce > Attack Speed > Range > Skill Haste", and the second set is Power Bank, not Geometry. The bench sets `noCrit` only on flat rows (`buildCoachBench.mjs:173-178`), and `weightsOf` honours it only when `w` is null (`buildCoachModel.js:55`). |
| L1 aura note | **Fixed** | The note is built from `deadLines()` (`buildCoach.js:142-147`). Miko's note lists ATK, Attack Speed, Crit Rate, Crit DMG, Pierce and Skill Haste. Umeko's lists ATK, Crit Rate, Crit DMG, Pierce and Skill Haste, with no Attack Speed, matching her plan. |
| L2 Miko Purification | **Fixed** | Aura weights (`buildCoachModel.js:51`). Substats are "Aura Power > Range > Cost Reduction", the same as her support paths. |

The merge `96683c8` touches only `teams.js`, `teamsSave.js` and `teams.test.js`. It has no conflicts in coach files.

## Findings

### F1 (MEDIUM, ship gate; from the merge, not the coach): the full suite is red
- **Where:** `tests/systems/teams.test.js:483-484`. The loadouts fuzz loop went from 80 to 600 seeds with no timeout.
- **What happens:** the test takes about 5.7–6.4 s, which is over vitest's 5 s default. It failed in every run I made: 2 full runs and 1 run alone.
- **Fix, on `feature/gear-loadouts`:** give the test a timeout, `it('fuzz…', () => {…}, 30000)`, or go back to about 150 seeds. Then merge again.

### L1 (LOW): a comment claims more than the code does
- **Where:** `src/systems/buildCoachModel.js:49`. The comment says the aura plan is "never 'any main / Cost Reduction'".
- **What the plan shows:** the visible 3-slot plan for Miko on Purification and Umeko on Undertow Ripples still reads "Charm: any main · Shoes: Cost Reduction". That is correct for the aura weights, and it matches their support paths.
- **Fix:** change the comment to "(review r3 L2: the aura plan, as on her support paths)".

### L2 (LOW, carried over): the patch note is still pending
The patch note is needed on the push to `main`.

## Sanity read

Each girl is listed with her plan, in short.

| Girl | Plan |
|---|---|
| Midori | Toxicology: ATK, Range, Speed, no crit. Corrosion and Field Kit are measured and keep crit as measured. |
| Umeko | Every path: Aura Power, Range, Buff Duration necklace. Speed sits 4th, which is right, because her speed is alive. |
| Miko | Every path: Aura Power, Range. |
| Hotaru | Lantern Light: crit. Silent Prayer and Guiding Lights: ATK, Range. |
| Ena | Shared Fate: Pierce first. Withering Script: Range first. |

All of these make sense.
