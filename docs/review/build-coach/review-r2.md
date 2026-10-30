# Build Coach (C1): independent review, round 2

Reviewer: a new independent agent that did not build this and did not write r1. Scope: `git diff 1504c11d 2f892f7e` on
`feature/build-coach`, which includes `6017cf66` (the news-chip page that r1 did not review), the r1 fixes
(`db776f8`) and the banner-info line (`2f892f7`). The merged `feature/gear-loadouts` commits (teams, lent pieces) have
their own review and are not covered here. Spec: `docs/specs/BUILD_COACH.md` on `origin/spec/gear-update` @ `44ba55dc`.
Coordinator ruling applied: sources fed by banners are information only and never ranked.

## What I ran

- The full `npm test`: **392 files passed, 2 skipped; 6,226 tests passed, 11 skipped**. Exit 0.
- `node e2e/smoke.mjs`: **ALL SMOKE CHECKS PASSED**, exit 0.
- `node e2e/buildCoach.mjs --shots`: **75/75 ok** at 844x390, 1280x720 and 390x844, with no page errors.
- A throwaway sweep, not committed. It covers **all 78 units × every path (101 rows)** on three saves: a fresh save; a
  save at L37 / gate 3 / ★1 with Mythic, Legendary and Rare gear; and a save with the first 20 campaign stages cleared.
  It runs `gearPlan`, `buildScore`, `toMax`, `farmPlan`, `potentialPlan` and `homeLine` on each, 303 path plans and
  96 stage Go links in all. Results:
  - no NaN, Infinity, `undefined` or `null` in any text;
  - no measured row whose weights are all zero;
  - every girl's plan has substats and at least one main;
  - every stage the Farm list offers exists and is unlocked on that save;
  - no Recruit, Memento, Moonpearl or Gem source is ever ranked.
- A Playwright probe, not committed, at the three sizes:
  - Midori's Coach tab: the path chips measure 44–48 px, and no Coach button is under 44 px;
  - the Farm sheet;
  - Kage's Stage Prep tag on 1-1: 175–186 × 22 px, no clipping, no horizontal overflow.
- I re-ran the bench's crowd target with an alive-count probe: `tools/balance/buildCoachBench.mjs midori --dry`.
- I grepped the added lines for other games' and anime names, and for he/his about players: none found.

## r1 findings: status

| r1 | Status | Evidence |
|---|---|---|
| B1 | **Partly fixed** | No measured row has all-zero weights, and no row reads tens of millions. Midori's default view still says "Shoes: Cost Reduction" (H1 below). |
| H1 home chip | Fixed | `.bc-home-chip` and its CSS are gone. The step is a `homeChipPages` page (`lobbyTray.js:138`) after the objective and the event, before the bosses. It fits at all three sizes and opens her Coach tab. |
| H2 Recruit Exchange | Fixed | `BANNER_FED` filter (`buildCoach.js:225,232`), plus a test. |
| M1 duplicate exchanges | Fixed, per the ruling | Memento and Moonpearl offers are dropped. They show as one unranked note with no Go button: "Also from recruiting…" (`ui/buildCoach.js:160`). Potential now names Kindred Essence from Titan Trials. |
| M2 to 85 | Fixed | `levelNeed` counts to `MAX_LEVEL` and needs Tomes above 60. Coins are no longer charged on EXP she already holds (test: exp 100 → 40 coins). |
| M3 gear road | Fixed | Legendary pieces count +10, the Bloom, UR +12, both stitches and `STITCH_COINS`. |
| M4 difficulty | Fixed | `stageYield` uses the hardest open difficulty (events ask `eventDifficultyStatus`), and the note and the Go use that difficulty. Every campaign difficulty is open once the stage is (`stage.js:598`). |
| M5 Potential Go | Fixed | `tab: 'info', focus: 'potential'` |
| M6 bench basis | Mostly fixed | The bench uses moving targets, 20 s runs, and `est` for Haste/Range. A note per ruler (`basisNote`) and "by her role" on Club/Set/LR. One gap remains (H1). |
| M7 support default | Fixed | `rank`: support classes open on their support path (Miko → Blessing). A slot with no weighted main shows "any main". |
| M8 taps | Fixed | `--tap` on chips, Go and All. |
| L1–L9 | Fixed | The tag is one item plus "+1" and clips with an ellipsis. Kickers are aligned. There is a "Main" badge on tiles. `cm:` is in the namespace test. Costs come from `armbandCost`; the invented +20000 is gone. |
| L10 patch note | Open | Still needed when this ships to `main`. |

## Findings

### HIGH

**H1. B1 is only half fixed: the bench's "crowd" piles up about 250 immortal grunts. Midori's default plan is still
"Shoes: Cost Reduction".**
`tools/balance/buildCoachBench.mjs:84-90`, `src/data/buildCoachData.js` (`midori` Toxicology, `kohaku_tsubaki`
Refraction, `marumi` Lane Master), `src/systems/buildCoachModel.js:23,45`.
- **Cause.** A grunt spawns every 0.1 s and is healed to full every step. None die, and none leave within 25 s. The
  probe counts 51, 101, 151, 201 alive at 5, 10, 15, 20 s.
  - A splash attack or a %-max-HP cloud hits the whole pile, so its damage is mostly the pile's size and barely
    depends on stats.
  - Toxicology reads 66,115 dps (18.5× the crowd median). Its weights are ATK 0.029, Rate 0.051 and Pierce 0.176:
    +30 % ATK gives under 1 % more damage.
  - `COST_WEIGHT` (0.1) then beats her measured stats.
- **On screen, the default for Midori at all three sizes:**
  - "Build 100 · Max 72" with no gear at all;
  - "Shoes: Cost Reduction";
  - "Substats: Pierce > Range > Cost Reduction > …";
  - "Measured on a crowd." with no caveat.
- **Related.** Refraction (270,630 dps, 75.9×, Rate 0) and Lane Master (118,712) have almost flat weights too. The
  new data test's 100×-median bound lets all three through.
- **Fix:**
  - cap the crowd at a realistic number alive (say 10–15: drop grunts past her reach, or let them die at
    late-Freeplay HP and respawn);
  - treat a row whose largest weight is under about 0.15 as stat-insensitive (role weights, `measured: false`);
  - never recommend Cost Reduction as a main or a top-3 substat on a measured damage row;
  - add a test that fails when the ATK step moves a measured row by less than about 5 %.

### MEDIUM

**M1. SR family materials have no source at all early on. The Farm sheet shows a heading with only the recruiting
note.**
`src/systems/buildCoach.js:264-283`.
- The sweep shows all 39 girls on the fresh and L37 saves with an empty source list for their `mat_*_superRare`.
  Seen in the probe: "Carved Runestone ×14", then straight to "Also from recruiting…".
- The only earned sources are stages still locked (5-2, 2-6 Hard+, Rune Garden), and those are filtered out
  entirely. Before the H2 fix, the Memento row hid this gap.
- **Fix:** when no open source remains, list the first locked stage that drops it as information ("opens after
  2-5"), with no ranking and no Go. Or say "Opens later in the campaign".

**M2. Haste and Range estimates choose mains.**
`tools/balance/buildCoachBench.mjs` (`ESTIMATE`), data rows Permafrost, Sharper Strips, Checkpoint Duty, Pin
Cushion, Lane Master and Refraction.
- On these rows, a stat the bench could not see (weight = 0.25 × ATK, a guess) becomes the Shoes main ("Shoes: Skill
  Haste"). This happens wherever Rate measured near 0.
- **Fix:** do not let an `est` stat take a main slot over a measured stat, or say so on the slot line.

### LOW

- **L1.** The Farm Go opens the hardest open difficulty, which is Nightmare on any open campaign stage, even for a
  level-1 save that has never cleared Easy. Consider the best difficulty she has cleared, plus one.
  `buildCoach.js:202`.
- **L2.** The coach e2e no longer reaches Stage Prep: Farm Go 0 is now a Mall row, so the "Farming for" check is
  skipped silently. Point it at a stage source. `e2e/buildCoach.mjs:85-96`.
- **L3.** Patch note pending (r1 L10).

## Verdict

**NOT OK.** Fix H1 (the remainder of B1) before shipping. M1 and M2 should ride along. Everything else from r1 is
genuinely fixed:
- the home is clean, and the step is a news-chip page;
- banner-fed sources are information only;
- the To max counts follow the game's own functions;
- the UI holds up at all three sizes.
