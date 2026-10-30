# Build Coach (C1): independent review, round 1

Reviewer: an independent agent that did not build this. Scope: `git diff 94b7d3f8 1504c11d` on `feature/build-coach`
(the C1 commit only; `feature/gear-loadouts` @ `94b7d3f8` has its own review). Spec: `docs/specs/BUILD_COACH.md` on
`origin/spec/gear-update` @ `44ba55dc`. Covers look and logic.

**Note on timing.** While this review ran, the branch moved to `6017cf66`: "C1 to spec r3: the Main's next step is a
page of the home's news chip", plus an M0 merge. A first read of that diff shows the home chip moved into
`homeChipPages`, which is what H1 asks for. I did **not** review `6017cf66`. Every finding below is against
`1504c11d`, and round 2 must check H1 again on the new tip, including the news-chip page's look at the three sizes.
None of the other findings is touched by `6017cf66` (it only adds a `chip` label to each step).

## What I ran

- `npm ci`, then `nice npx vitest run tests/systems/buildCoach.test.js tests/systems/buildCoachScore.test.js tests/data/buildCoachData.test.js`: 3 files, 18/18 pass.
- `nice node e2e/buildCoach.mjs --shots …`: all ok at 844x390, 1280x720 and 390x844, no page errors.
- My own throwaway probe (not committed) at the same three sizes at 2x: Midori, Miko and Kage Coach tabs, every
  button's box, clipped text, Start's box on Stage Prep before and after Set as Main, and the home chip's box against
  the news card, Co-op and the battle plate, with crops zoomed on the chip and the Stage Prep tag.
- Sim id: `be940ecb2087` (unchanged). No file in `simId().files` matches `buildCoach`; nothing under `src/sim` or
  `src/online` imports the coach.
- Save round trip through two older builds: I extracted `src/` of `origin/main` (`60ce9cad`, live) and of
  `94b7d3f8` and ran their `migrateProfile` on this build's `saveText`. Both drop `profile.buildCoach` and keep
  `cm:midori = 1`. This build then restores Main = Midori. After Clear Main → older build → this build, Main stays
  null. Works.
- Spot checks with a script on Kage (L37, gate 3, ★1, P2, Mythic +4 Charm, Legendary +10 Ribbon, Rare +2 Shoes),
  Midori (L60, gate 5, ★3, P1) and Miko (L12, gate 1, ★0, P1), 30 stages cleared.
- Grepped the added lines for other games' and anime names: none.

## What is right

- **Gates, stars and Potential counts** equal the game's own functions for all three girls: `breakthroughCost` per
  gate, `awakenCost` per star and `raiseCost` per P step. EXP to her current cap equals `expForLevel` minus her held EXP.
- **The farm order between stages** follows `stageItemOdds` (chance × the mean of min and max). For example, 1-5's
  `mat_charm_common` is 0.9 × 3 = 2.7.
- The **Gem Shop** (`currency`/`tab` `gems`) and the `recruit` route never show. The owner's words are right: the
  UI says "Set as Main" and "Clear Main", never "pin".
- Every new file and the save key carry the `buildCoach` prefix. The `cm:` prefix collides with no existing counter.
- **Stage Prep's tag never moves Start.** Its box was identical before and after Main at all three sizes:
  844x390 (662, 332, 166×48), 1280x720 (1055, 500, 185×56) and 390x844 (165, 723, 209×50).
- The Coach tab has no horizontal overflow at the three sizes. Its Go buttons and "All" buttons measure 44–48 px
  tall. The Ink & Paper kit is used throughout: panels, kickers, `ui-opt` path chips, the plate-numbered steps.
- `buildCoachSave.js` stays light. `migrateProfile` restores the mark and rewrites it, and `saveText` rewrites it.

## Findings

### BLOCKER

**B1. DoT paths read as tens of millions and all-zero weights. That makes Akane's and Midori's default plan "Cost
Reduction everywhere".**
`src/data/buildCoachData.js` (rows `akane` Wildfire, `midori` Toxicology); `tools/balance/buildCoachBench.mjs:69-72`;
`src/systems/buildCoach.js:47-50`; `src/systems/buildCoachModel.js:71,75`.
- **Cause.** The bench holds 1e9-HP, speed-0 targets for 12 s. Wildfire reads 29,668,123 dps and Toxicology
  24,723,183. Both rows have every `w` = 0, which suggests damage that scales with the target's max HP: none of the
  steps moves it.
- **Effect.** `coachPaths` sorts by `dps`, so both bogus rows become the girls' best path and open by default. From
  all-zero weights, `recommend` gives `subs: ["costCut"]`, Shoes main Cost Reduction, set Treasurer, and Charm ATK /
  Ribbon Crit Rate only by tie-break.
- **On screen.** Midori at level 1 with no gear shows "Build 99 · Max 98", "Shoes: Cost Reduction" and "Substats:
  Cost Reduction". This is actively wrong advice, it is the default view, and it feeds Next steps and the home line.
- **Fix:**
  - measure DoT paths on killable targets, or on HP that a %-max-HP effect cannot inflate (or cap the per-hit HP
    basis);
  - never pick a best path by raw `dps` across rulers;
  - treat a row whose weights are all zero as unmeasured (role weights, `measured: false`);
  - add a data test that fails on an all-zero `w` or a dps more than about 100× the roster median.

### HIGH

**H1. The home chip goes against the owner's decision (spec L25: no new element on the home).**
`src/ui/screens/lobby.js:894-896`, `src/ui/buildCoach.js:152-161`, `src/ui/styles/buildCoach.css:48-53,58-61`.
- **The spec says** (r3 §0.3, §8) that the main girl's next step is one filler page of the existing news chip
  (`src/ui/lobbyTray.js:130` `homeChipPages`), after the objective and before the weekly bosses. The home was made
  calm on purpose (v0.1.54 "Quiet Home").
- **The build** adds a second dark bar over the battle plate at every size. At 390x844 it stacks news (y 508–554),
  chip (568–604) and Co-op (610) with about 6–14 px gaps. A fixed `bottom: 290px` rule moves the news card up on
  portrait phones to make room.
- **Look.** It does not overlap the news card or Battle at the three sizes. It is 36 px tall (below 44), and its
  text is cut at all three sizes ("…Equip Bargain Loafers of th…", text width 296 > 180 at 844x390). No owner OK for
  the deviation is recorded.
- **Verdict:** not acceptable as is. Move the line into `homeChipPages` as specified, and drop the chip, its CSS
  and the `.home-news-host` override.

**H2. The Farm list points to the Recruit Exchange, which is paid in Recruit Points that only recruiting earns.**
`src/systems/buildCoach.js:193-200`.
- **Cause.** `earnedByPlay` filters `route === 'recruit'` and Gem Shop offers, but keeps Mall `tab: 'recruit'`
  (`currency: recruitPoints`). Recruit Points come only from pulls (`src/systems/gacha.js:60,86`) and spare
  duplicates.
- **Effect.** "Mall · Recruit Exchange [×10 for 30 Recruit Points]" is the **first** Star Fragment source on a fresh
  save. It is the third once Total Assault is open, for every girl, since every girl needs 130–190 fragments.
- That breaks Q18 ("never … a banner"). It also breaks the coach's own Wiki line "Only places you play: never the
  Gem Shop or recruiting" (`src/data/wiki.js:440`). The test only checks `go.route !== 'recruit'` and
  `tab !== 'gems'` (`tests/systems/buildCoach.test.js:99-102`), so it misses this.
- **Fix:** drop offers whose currency is earned by recruiting (`recruitPoints`). Add the case to the test.

### MEDIUM

**M1. The Memento Exchange and the Potential copy lean on duplicates from banners. This needs the owner's ruling
under Q18.**
`src/systems/buildCoach.js:148,193-200`.
- **Memento Exchange.** Rows priced in Mementos and Moonpearls show for every family's SR, Mythic, Legendary and
  Zenith materials, often in the top three ("Hawk Quill ×14 · Mall · Memento Exchange"). Both currencies come from
  spare duplicates (`src/systems/essence.js` `SPARE_PAY`, `inventory.js` "Spare duplicates" → `recruit`).
- **Potential copy.** The Potential row says "5 Essence … from her duplicates". It never names the play-earned path
  (Kindred Essence from Titan Trials), and Essence never reaches Farm.
- **Fix:** ask the owner whether duplicate-fed exchanges count as "banners". Either way, point Potential at Kindred
  Essence and its Titan Trials source.

**M2. "To max" stops at her current level cap, and the row collapses to a check mark when she is far from max.**
`src/systems/buildCoach.js:114-121`.
- The row counts only to `levelCap(st)`. Midori at L60 / P1 reads "Level 60: at her cap" with a check mark and 0
  coins, though she has 25 levels to go (85 at P6: 25 Akashic Tomes, 300,000 coins). So "Coins to max" undercounts
  for every girl below 85.
- §2 asks for "to her current cap, then to the next cap the next gate or Potential step opens". Show the cap now
  and the rest to 85 (the Tomes as a need row).
- Minor: `levelNeed` charges coins on the EXP she already holds (`:84` runs from `st.level`, and only `exp`
  subtracts `st.exp`). It overcounts by `st.exp × 0.4`. Use `coinsFor` (`progression.js:155`), the game's own rule.

**M3. Gear in "To max" is not to max.**
`src/systems/buildCoach.js:163-170`.
- A Legendary piece counts the Seed and 80,000 for its awakening, but not UR +10 → +12 (`UR_MAX_LEVEL`, tier-5
  prices).
- `needle_star` is +1 only when `stitchSlots().free` is set. A piece below +10 needs 0 now but 2 at UR (gold +
  rainbow), and an unstitched UR piece needs 2.
- The stitch coins (`STITCH_COINS`, 20,000 each) are never added.
- §2 names "+10 / +12 / +18". Count the whole road.

**M4. The Farm shows the hardest difficulty's yield but opens the easiest, and never checks whether that difficulty
is open.**
`src/systems/buildCoach.js:209-216`.
- `itemSources().expected` is the Nightmare figure (`inventory.js` `best`). The line reads "≈ 0.54 per run · 30%
  · up to 46.8% …", and Go opens `minDifficulty` (Easy).
- Ranking ignores which difficulties the save has open (`isStageUnlocked` is per stage). A row like "Mission 3-2 ·
  Hard+ 12%" can send the player to a Hard prep whose Start is locked.
- **Fix:** rank by the expected count at the hardest difficulty open on this save, show that number, and pass that
  difficulty to Go.

**M5. The Potential row's Go opens the Awaken tab, but Potential lives on Info.**
`src/systems/buildCoach.js:149`.
- `go: { tab: 'awaken' }`, but the Potential card and sheet are on Info (`student.js:517`). The page's own link is
  `?tab=info&focus=potential` (`student.js:1205-1212`, `:1288`). Use that.
- Related (LOW): the Titan Trials Go has no titan (`params: {}`). §3 says "on that titan".

**M6. The bench differs from spec §7, and its blind spots are not shown as such.**
`tools/balance/buildCoachBench.mjs:6-15,43,82-89`; `src/systems/buildCoachModel.js:28-36,77-82`.
- **Differences from §7:**
  - its own harness, not r5's `measure`;
  - a no-gear L60 / gate 5 / ★3 base, not the maxed five-piece bench build;
  - one seed, not 3;
  - 12 s;
  - no set or club runs. Clubs (`TRICK_WORTH`), sets (signature × `mainScale`), the Tie Pin and Blank/Set LR are
    role formulas, not bench data.
- **Blind spots.** Speed-0 targets placed next to her make Range read 0 for 68 of 72 measured rows, and Skill Haste
  0 for all 72. So neither is ever a substat or main for a damage girl, and an ultimate-led girl is mis-planned.
- **What the UI shows.** It marks only `measured: false` rows (supports, heroes), and only with "her own damage is
  small …". For a hero row that text is wrong.
- **Fix:**
  - run moving targets over a full wave, long enough for ultimates (or mark Range and Haste "not measured");
  - mark set, club and LR lines as role-based until the sets ship and get measured;
  - word the note per ruler.

**M7. Supports never open on their support path, and a zero weight still picks a main.**
`src/systems/buildCoach.js:47-50`; `src/systems/buildCoachModel.js:75`.
- Unmeasured support rows have `dps: 0`, so a hybrid girl always opens on her damage path. Miko opens on
  Purification with a Charm ATK / Shoes Attack Speed plan, and her Blessing and Sacred Grounds rows sort last (the
  same for Momo, Chika and Yuzuha).
- On support rows, Charm wants ATK% with weight 0 (the first option wins the tie-break).
- **Fix:** let the girl's role or the player's last path choose the default. Show "any" (or nothing) for a slot whose
  options all weigh 0.

**M8. Taps under 44 px.**
`src/ui/styles/buildCoach.css:13` (`.bc-path --h: 36px`), `:50` (home chip `min-height: 36px`).
- The Path chips measure 78–95 × 36 at all three sizes. The home chip is 36 tall (H1 removes it).
- Make the path chips ≥ 44 px.

### LOW

- **L1.** The Stage Prep tag is cut mid-word with no ellipsis at 844x390: "…Swallow Plum", text width 281 > 252. The
  text is a bare text node in a flex chip, so `text-overflow` does not apply. Its row grows from 22 to 50 px over the
  map thumbnail at 844x390 and 390x844. Wrap the text in a span, or show one item plus "+1".
  `src/ui/buildCoach.js:168-169`, `src/ui/styles/buildCoach.css:56`.
- **L2.** "Prism Dice: her Shoes's main" reads wrongly; use "her Shoes' main" or "the main on her Shoes".
  `src/systems/buildCoach.js:404`.
- **L3.** A zero-gain level step shows "+1". `Math.max(1, round(gain))` turns 0 into 1 on "Level her up to 10 · +1".
  Show no number for gain 0. `src/systems/buildCoach.js:428-433`.
- **L4.** Step costs are rough:
  - the Prism step sorts with an invented `+ 20000`;
  - the Armband step shows "1 Club Armband" but `armbandCost` also charges `2,000 × (tier + 1)`;
  - a step that needs something missing does not point to its Farm row (§6).
  `src/systems/buildCoach.js:404,424`.
- **L5.** "Max" is measured against Legendary +10, though the doc comment says "Legendary UR +12".
  `src/systems/buildCoach.js:330,349`.
- **L6.** The main girl's tile in lists has no "Main" tag (§1). Nothing outside the Coach reads `mainGirl`.
- **L7.** `cm:` is not added to the namespace test in `tests/integration/missionCounters.test.js`.
  `tests/data/buildCoachData.test.js` cannot catch B1.
- **L8.** The Next steps and To max kickers sit at different heights on wide layouts: the "All" button makes one
  head taller. `src/ui/styles/buildCoach.css:19`.
- **L9.** The Wiki article also takes over Teams and Loadouts ("Build Coach, Teams and Loadouts"). That part belongs
  to the gear-loadouts branch's review. Its line "Her next step shows on the home screen" must follow H1's outcome.
  `src/data/wiki.js:430-450`.
- **L10.** No patch note is in this commit. It is needed when this ships to `main`.

## Verdict

**NOT OK.** Before re-review, fix:
- the BLOCKER: B1;
- the HIGHs: H1, H2;
- the MEDIUMs: M1 (needs the owner's ruling), M2, M3, M4, M5, M6, M7, M8.

The LOWs can ride along. The core is sound: the save mirror, the hashing boundary, gates, stars and Potential counts
and the Go wiring. The blocking problems are the data (DoT rows and the bench's blind spots), sources fed by
recruiting, and the home chip that the spec rules out.
