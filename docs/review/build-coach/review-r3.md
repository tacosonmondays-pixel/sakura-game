# Build Coach (C1): independent review, round 3

Reviewer: a new independent agent. It did not build this feature and did not write r1 or r2.

Scope: the coach changes on `feature/build-coach` from `2f892f7e` to `0a5f053f`. That is fix commits `9d59584a` and
`0a5f053f`, plus the regenerated `src/data/buildCoachData.js`. The merged `feature/gear-loadouts` code (`teams*`,
`teamBar`) is reviewed separately and is not covered here.

## What I ran

- **Full `npm test`: 391 files passed, 1 failed, 2 skipped. 6,233 tests passed, 1 failed, 11 skipped.**
  - The one failure was `tests/sim/rules.test.js > calm point > 4-1`, which hit the 5 s timeout. My sweep was running
    on the same machine at the time.
  - Re-run alone, that file passes: 25/25.
  - The diff touches nothing under `src/sim`.
- **`node e2e/buildCoach.mjs --shots`: 93/93 ok** at 844x390, 1280x720 and 390x844, with no page errors.
  - The new checks pass: a stage row in the Farm sheet → `#/stage/1-1?difficulty=easy`, the "Farming for Kage" tag,
    Start still on screen, and Miko's aura note.
- **`node e2e/smoke.mjs`:** - Run 1: **677 ok, 1 FAIL**: "wiki: every top bar control on screen and on top (… covered by body.ui-day)". This
    is not the touch-drag flake I was told to expect.
  - Run 2 on the same sha: **ALL SMOKE CHECKS PASSED, 678 ok**, exit 0.
  - The wiki failure is a timing flake that does not reproduce. The diff touches no wiki or top-bar code. The known
    touch-drag flake did not show in either run.
- **A throwaway sweep, not committed.** It covers all 39 coached units × every path (101 rows) × 3 saves:
  - the saves: fresh; L37 with Mythic, Legendary and Rare gear and 10 stages cleared; 20 campaign stages cleared;
  - it ran `gearPlan`, `buildScore`, `toMax`, `farmPlan(per 6)` and `potentialPlan` on each: 303 plans, 1,986 ranked
    stage sources and 2,580 "opens later" notes.
  - **Results:**
    - no NaN, Infinity, `undefined` or `null` in any text;
    - every plan has substats and at least one main;
    - every score is finite;
    - **no Cost Reduction main and no Cost Reduction in the top-3 substats on any of the 216 measured damage plans;**
    - every measured row's ATK step is at least 5 %;
    - every ranked stage exists and is unlocked;
    - every "opens later" stage is still locked, and it is the earliest locked stage that drops the item;
    - no Recruit, Memento, Moonpearl or Gem source is ranked;
    - no item is left with neither a source nor a note.
- **A Playwright probe, not committed,** at the 3 sizes: Midori (default), Miko Purification, Akane (default),
  Umeko Undertow Ripples and the Farm sheet.
  - No horizontal overflow and no page errors.
  - The Farm sheet shows 12 "Opens later" notes, none with a Go.
- **Text:** no other games' names and no he/his about players in the added lines.

## r2 findings: status

| r2 | Status | Evidence |
|---|---|---|
| H1 crowd pile-up | **Fixed** | `CROWD_MAX` 12 with a spawn every 0.5 s (`buildCoachBench.mjs:87`), and gear ATK now feeds `dotMul`. Midori Toxicology is now flat → `measured: false`, using damage-role weights and showing the "barely answers a short bench run" note. Kohaku Refraction (boss, ATK 1.0) and Marumi Lane Master (ATK 1.0) are now real measurements. Cost Reduction is barred as a main and from the top 3 on measured rows (`buildCoachModel.js:83-96`). There is a data test for the ATK step. |
| M1 SR materials | **Fixed** | `farmPlan` `later` (`buildCoach.js:288`); the note is "Opens later: Mission 3-3 · Between Worlds drops it (not open yet)", with no Go. |
| M2 estimates as mains | **Fixed as specified** | An estimated stat takes a main only when the slot has no measured option. The sweep finds 6 such slots (Akane Big Bang Ribbon/Shoes, Sango Concentrated Siege, Suzu ×3 Ribbon), each with no measured alternative. The basis note says "Range estimated". |
| L1 Farm difficulty | **Fixed** | One above her best clear (`stageYield`); there is a test, and the e2e lands on `difficulty=easy`. |
| L2 e2e Stage Prep | **Fixed** | The e2e picks a `data-route="stage"` row, and it fails if there is none. |
| Aura note | **Present, but inaccurate for Umeko** | L1 below. |

## Findings

No HIGH findings.

### MEDIUM

**M1. Midori's default plan (Toxicology) recommends a Crit Rate main for a poison path.**
`src/systems/buildCoachModel.js:22` (`DAMAGE_WEIGHTS`), used for flat rows.
- On screen at all 3 sizes:
  - "Ribbon: Crit Rate";
  - "Substats: ATK > Pierce > Attack Speed > Crit DMG > Crit Rate".
- Poison and burn ticks skip crit (`src/sim/combat.js:7,166`). The row is flat because most of its damage is the
  cloud. A player would be told to build crit on a poison girl. It is better than Cost Reduction, but it still does
  not make sense.
- **Fix:** for a flat row, zero `critChance`/`critDmg` when the kit's damage is mostly DoT (or when the bench's crit
  steps read about 0). Then the Ribbon falls to Range. Alternatively, keep the bench's own relative weights for the
  non-ATK stats that clearly moved.

### LOW

- **L1. Umeko's aura note contradicts her plan.** `src/ui/buildCoach.js:141`.
  - On Undertow Ripples the note says "Her ATK, speed and crit lines turn into her aura…".
  - The same card says "Shoes: Attack Speed" and "Substats: Attack Speed > Range > …".
  - Umeko's `GEAR_FIT` fill does not include `ratePct`; Miko's does.
  - **Fix:** build the list from `deadLines(unitId)`, e.g. "Her ATK and crit lines…" for Umeko.
- **L2. Miko's Purification plan is nearly empty.**
  - It reads "Charm: any main · Ribbon: Range · Shoes: Cost Reduction · Substats: Range > Cost Reduction".
  - Her ATK, speed and crit lines are zeroed as dead, but `GEAR_FIT` says they raise her aura, so they are not
    worthless. The note says her plan "follows her role", but the plan is neither her damage role nor her aura role.
  - This is not her default path (Blessing is).
  - **Fix:** for `fillTo: 'aura'` rows, use `SUPPORT_WEIGHTS`, or give the filled lines the aura weight.
- **L3. The patch note is still pending** (r1 L10, r2 L3); it is needed when this ships to `main`.

## Sanity read (default path, as a player)

Each girl is listed as her default path, then her plan in short.

| Girl | Default path | Plan |
|---|---|---|
| Aoi | Sky Hunter | crit Charm/Ribbon, Speed Shoes |
| Rei | Whirlwind | crit/ATK |
| Kage | Storm of Steel | ATK/Speed |
| Shiro | Execution | crit |
| Akane | Big Bang | ATK; Range/Haste estimated, said so |
| Sango | Wide Fragmentation | Pierce > ATK |
| Kohaku | Refraction | ATK > Range |
| Marumi | Lane Master | ATK > Crit DMG |
| Miko | Blessing | Aura Power substats, Range Ribbon |
| Momo | Fan Club | Haste, Range |

All of these make sense, except Midori (M1). Ouka's three support paths are Cost Reduction only, because her whole
kit fills in; this predates r2.

## Verdict

**OK.**
- H1 and every r2 MEDIUM and LOW finding are genuinely fixed and verified across every unit, path and save.
- Nothing found here blocks shipping. M1 and L1 are small and should ride along if there is another pass; L2 can
  follow.
- The patch note is still needed on the push to `main`.
