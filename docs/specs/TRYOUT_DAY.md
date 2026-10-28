> **Owner decisions (Oct 27-28, 2026).** Every §17 default is accepted (the owner: "The sets all look good enough!!"),
> with ONE change: **Q7 co-op. The owner: "It has to be multiplayer too!!"** Co-op is required at launch, not after
> the solo ship: build the §11 co-op seams alongside M1-M4 (two-view lockstep tests from M1 on), and the first public
> release ships solo and co-op together (M5's work folds into the earlier milestones; the "co-op ships last" risk
> mitigation in §19 no longer applies). Co-op means today's 2-player lockstep co-op. Build timing (Q12): the owner
> asked to start now (content first); the mode still ships after the ultimates (COOP 9) and the balance pass, and its
> Ink & Paper screens (M3) follow the UI v2 menus.

# Tryout Day: the roguelike run mode (final spec)

Line numbers below are `origin/main`'s at writing time and have drifted on the build branches; search by name.

Final spec for the owner's roguelike run idea of Oct 27, 2026 (decision 155). Written Oct 27, 2026 from a read-only look
at `origin/main` v0.1.53 (`f4cf107b`, sim id `92e2e22527cf`, `COOP_PROTOCOL` 8), `origin/feature/abilities`
(`a2a20fe7`) and `origin/feature/ui-v2` (`36c3ce4c`). Nothing in the repo was changed. Line numbers are `origin/main`
unless a branch is named. **Revision 2** (same day) fixes the findings of an independent review: the
Window Seat cap, quitting mid-wave, last-pick cards, per-player co-op counters, the restore order for girls who join
mid-run, five name collisions and the owner page (Appendix A.2).

> **Where this file lands.** The owner's working title for the idea is another game's mode name, so it stays out of the
> repo and out of the game (`docs/specs/SCREEN_IDEAS.md` §7). Land this file as **`docs/specs/TRYOUT_DAY.md`** (or under
> whatever name the owner picks in Q1), not under the working title. The mode's player-facing name and code name are
> our own: **Tryout Day**, code `tryout` (Q1).

How it was made: three competing designs (a boon run, a squad draft and a node map) went to two judges. The judges split
(node map 8 + 5 = 13, squad draft 7 + 8 = 15, boon run 6.5 + 7 = 13.5), so this spec starts from the highest combined
score, the **squad draft on one long battle**, cuts its scope hard, and grafts in the best parts of the other two: the
node map's route choice with visible challenges, drawbacks on the biggest cards, its tracker states and its single
command kind; and the boon run's integer score, additive caps, readable rarity link, Double Dare, Make-up Test and
break comforts. Appendix A lists every graft and every judge problem with where it is fixed.

---

## 0. Summary

**Tryout Day is one school day of defense on one map.** You draft 3 girls from 6 before class. The day runs in
**Periods** of 4 waves. After every period you **pick 1 of 3 Pep Talks**: one for the whole team, one for one girl,
and a wild card that is sometimes **a new girl trying out for the squad**. Each period shows **3 Assignments** (lose no
hearts, hit a score, let a named girl carry…), and every assignment you clear raises the **rarity** of the next pick,
from R to LR. At **Recess** and **Cleaning Time** the bonus spots on the board (**Window Seats**) are redrawn by
lottery, the **Seat Change**, and you get **3 Hall Passes** to move girls you already placed. Placement matters, and so
does luck.

```
 BEFORE CLASS  P1   P2   P3   RECESS        P4   P5   P6   CLEANING TIME   FINAL PERIOD   CLASS PHOTO
 map 1 of 2    4w   4w   4w   Seat Change   4w   4w   4w   Seat Change     4w, boss       summary
 draft 3 of 6  ▼    ▼    ▼    3 Hall Passes ▼    ▼    ▼    3 Hall Passes   on wave 28     Marbles
 hero          pick pick pick Snack/Brush Up pick pick pick Snack/Brush Up                 Yearbook
               (girls)                                 (Exam Prep ≥ SR)
```

| | Half Day (default) | Full Day (unlocks after a Half Day clear) |
|---|---|---|
| Waves | 28 (7 periods × 4) | 48 (12 periods × 4) |
| Picks | 6 (one every ~2 min) | 11 |
| Breaks | 2 (Recess, Cleaning Time) | 3 (Recess, Lunch Break, Cleaning Time) |
| Length at 1× / 2× | **~16 min / ~10 min** | ~27 min / ~16 min |
| Pause points | every wave end; a calm card every ~2.2 min | same |

- **One map, one Sim, one battle** (reading A of CONTEXT §1.1). No board rebuild, no chain of Sims, no second save
  layer. The existing wave-end checkpoints and the battle save cover the run.
- **Your collection counts, inside a band.** Owned girls bring their own stats, raised to the run's floor and capped at
  about a Lv 60 geared girl; girls you don't own join as **Loaners** at the floor. Cards and Window Seats together are
  capped per girl, so nothing in a run makes a girl stronger than a fully maxed girl (§9).
- **0 gems per run.** Marbles (capped at 150 a week) buy cosmetics and small perks; coins pay 60 % of the campaign's
  per-wave rate and up to 3 Lunchboxes a week are filled by periods cleared, so the mode pays less than the campaign per
  minute; a 12-row achievement wave pays 360 gems once (§10).
- **Leaving mid-wave spends the Make-up Test.** The interrupted wave replays once per run; a second mid-wave Continue
  turns the rest of the run into practice (§12.3). Quitting at a calm point costs nothing.
- **Every random draw comes from the run seed; every choice is a sim command.** One `COOP_PROTOCOL` bump covers the mode
  (§8, §11).

---

## 1. The four owner asks, answered

### 1.1 "Every few stages an all buff / specific unit buff"

After every period (6 picks in a Half Day) you pick 1 of 3 cards. **The cards always sit in the same places**, so players
learn where to look:

| Slot | Card | What it is |
|---|---|---|
| **Left** | **Team** | An *Everyone* card (all your girls and your hero) or a *Group* card (one attack type, element or role). The owner's "all buff". |
| **Middle** | **One girl** | A *Personal* card that names one girl in your squad; every copy of her gets it. The owner's "specific unit buff". About twice as strong as the Team card of the same rarity. |
| **Right** | **Wild** | Another Team or One-girl card, a *Board* card (coins, hearts, seats, passes), a *Hidden Talent* (SSR, changes how one girl plays), a UR or LR card with a visible drawback, **or a girl** (§1.3). |

All three cards share **one rarity**, rolled once per pick. The full catalogue (70 cards, 53 in the first ship, with
numbers at every rarity) is in §4.

### 1.2 "Complete challenge for increased rarity buff: don't lose hp, get certain score"

Every period shows **3 Assignments**. Slot 1 is always **Full Hearts** (lose no hearts). Slot 2 is a skill assignment
(a score, a fast clear, a quick boss kill). Slot 3 is a style assignment (a budget, a named girl carries, a small
class…). Each one cleared is **1 credit**; an optional **Double Dare** curse adds 1; a skipped pick banks 1. Credits
(0-4) pick the row of a visible odds table:

| Credits | R | SR | SSR | UR | LR | Floor |
|---|---|---|---|---|---|---|
| 0 | 45 | 38 | 15 | 2 | 0 | — |
| 1 | 28 | 47 | 21 | 4 | 0 | — |
| 2 | 0 | 62 | 31 | 6 | 1 | at least SR |
| 3 | 0 | 0 | 78 | 18 | 4 | at least SSR |
| 4 | 0 | 0 | 60 | 30 | 10 | at least SSR |

(Middle picks shown; early and late picks have their own rows, §3.4.) In plain words: **2 assignments guarantee SR, all 3
guarantee SSR**, and a Double Dare on top is the road to UR and LR. Measured over 200,000 runs: a casual player sees
2.3 SSR-or-better picks in a Half Day and an LR in 8 % of runs; a strong player 4.5 and 22 %.

### 1.3 "Perhaps you get individual units as a chance instead of buffs"

- **The first pick of every run is a Tryout pick:** 3 girls instead of 3 cards.
- **After that, the Wild card is a girl 30 % of the time** while the squad has room. If 3 picks in a row brought no
  girl and the squad has fewer than 6, the next Wild card is a girl.
- **Any of the 29 students can try out.** An owned girl plays with her own stats inside the band; a girl you don't own
  joins as a **Loaner** at the run's floor, for this run only.
- **The pick's rarity is her arrival package:** an R pick gives a free first copy, SR a free copy at tier 2, SSR at
  tier 3, UR tier 3 plus Varsity, LR tier 4 plus Varsity and her Hidden Talent.
- **A coverage guarantee:** if the next block brings flyers, veils, heavy armour, regeneration or spectral foes that the
  squad cannot answer, the next girl card is drawn only from girls who answer it, and says so.

### 1.4 "A break chance where you can move 3 or so units; placement is important and so is RNG"

- **Recess** (after Period 3) and **Cleaning Time** (after Period 6) are breaks. Nothing moves until you tap **Back to
  class**.
- **Seat Change:** the 3 Window Seats (chalk circles: the girl sitting in one deals +25 % damage and reaches +0.7 tiles
  further; cards can raise that to +50 %, never more) are redrawn by the seed for the next block. New seats show dashed, old ones fade. **This is the RNG half.**
- **3 Hall Passes:** each one moves one placed girl, tiers and all, to any legal spot for free. Unused passes carry over
  (hold up to 5). Moving a girl back where she started refunds the pass. **This is the placement half.**
- During the break you see the next block's scout card (families, flyers, the boss and its road) and pick **Snack**
  (heal 15 hearts) or **Brush Up** (raise one of your Pep Talks one rarity).

---

## 2. Run structure, length and pacing

### 2.1 One long battle

A run is one Sim built from a generated StageDef (§2.3). A **Period** is a block of 4 waves; period boundaries are wave
ends, which are already calm points: `_checkWaveEnd` (`src/sim/Sim.js:779`) ends every per-wave effect, the battle save
writes there (`persistCalm`), and co-op keeps a whole-battle checkpoint there (`src/online/coop/commands.js` `snapshot()`).
The board stays all day, so a Hall Pass is a real placement decision. Variety comes from the map pick, the seeded draft,
the Subjects (§2.4), the Back Gate and the Seat Changes, not from changing maps.

The two-map variant (the node map's "pack up and rebuild" design) is written down for later in §16 so nobody has to
reinvent it, but it is not part of this mode's first ship.

### 2.2 The timetable

**Half Day** (default):

| Step | Waves | What happens |
|---|---|---|
| Before Class | — | Pick 1 of 2 seeded maps, your hero (owned heroes only; Hikari and Nami are free for everyone), the Grade, and 3 of 6 drafted girls (one free redraw). The timetable shows every period's Subject choices, the breaks, and the Final Period boss. |
| Period 1 | 1-4 | No Subject. |
| Pick 1 | — | **Tryout pick** (3 girls). |
| Period 2 | 5-8 | |
| Pick 2 | — | Pep Talk pick. |
| Period 3 | 9-12 | A miniboss on wave 12. |
| Pick 3 | — | Pep Talk pick. |
| **Recess** | — | Seat Change for P4-P6, 3 Hall Passes, Snack or Brush Up. |
| Periods 4-5 | 13-20 | Picks 4 and 5 after them. |
| Period 6 | 21-24 | A miniboss on wave 24. |
| Pick 6 | — | **Exam Prep:** at least SR. |
| **Cleaning Time** | — | Seat Change for the Final Period, 3 Hall Passes, Snack or Brush Up, boss scout. |
| Final Period | 25-28 | The boss arrives on wave 28. Assignments still count for score and Marbles. |
| Class Photo | — | Summary and rewards (§13.8). |

**Full Day:** 12 periods of 4 waves (48 waves); picks after P1-P11 (11 picks; picks 1 and 5 are Tryout picks); Recess
after P3, **Lunch Break** after P7, Cleaning Time after P11; minibosses on waves 12, 28 and 44; the boss on wave 48;
pick 11 is Exam Prep. The timetable is data (`TRYOUT.lengths`), so the Full Day costs no new code beyond a performance
check at wave 48 (§15).

### 2.3 The generated stage and its enemies

`buildTryoutStage(plan)` returns a StageDef that reaches the Sim through `data.stage`, the Titan Trials and event-variant
pattern (`src/ui/battle/setup.js:129-160`):

- **id** `tryout:<seed36>:<grade>:<length>`, so `generateWave`'s hash `` `${stage.id}|wave|${n}` ``
  (`src/sim/waves.js:72`) gives fresh enemies every run and the same enemies for everyone on the Weekly Timetable. No
  change to `waves.js`.
- **waveGen.pool:** the existing `from` / `to` wave ranges give each block its own two enemy families from the Grade's
  content window (§7), built like `chapterRoster()` in `src/data/freeplay.js`.
- **waveGen.fixed:** minibosses at the ends of P3 and P6 (Slime Prince, Goblin Machine, Orc General or Oni Champion by
  window) and the boss on the last wave (one of the 7: Grave Lych, Iron Colossus, Ashwing Matriarch, Foundry Titan, Gloom
  Regent, Hyakki Daimyo, Eclipse Wyrm), seeded and shown at Before Class. A boss leak takes 40 hearts (60 from Grade 6),
  through `spawnEnemy(…, { leak })` as freeplay bosses do.
- **hpScale / budget / cashScale:** first passes per window (Spring Term 2.2 / 1.4, Summer Term 4.0 / 2.0, Autumn Term
  6.5 / 2.6),
  tuned by the bot for banded boards with a typical card load (§15).
- **rule: null.** The run owns the Sim's one rule runtime (§2.4).
- **Start coins 700**; the wave bonus and bounties as in any battle × the stage's `cashScale`; a period-end bonus of
  `100 + 50 × period` × `cashScale`.

### 2.4 Subjects, the class choice and the Back Gate

Each period from P2 to the last pick offers **two Subjects**; you choose the next period's Subject on the period-end
sheet (the "Start" button is split in two). Both options show their 3 assignments before you choose, which is the node
map's route choice without leaving the board. Subjects are the map-independent campaign rules (`src/data/rules.js`
`MAP_RULES`), so no new effect code is needed:

| Subject | id | Rule entry | Twist |
|---|---|---|---|
| Science | `subj_science` | `alchemists_mist` | poison ×1.4; heavy foes ×0.85 speed |
| P.E. | `subj_pe` | `tailwind` | in pulses: foes ×1.25 speed; pierce, slash and blast ×1.25 |
| Music | `subj_music` | `firefly_chorus` | in pulses: all damage ×1.25 |
| Festival Prep | `subj_festival` | `festival_encore` | every 3rd wave clear: +120 coins and ult charge |
| Shop Class | `subj_shop` | `supply_ship` | every 4th wave clear: +150 coins; lightning ×1.2 |
| Home Ec | `subj_homeec` | `petal_sanctuary` | +3 hearts at every wave clear (Full Hearts counts leaks, so healing never fakes it) |
| Night Class | `subj_night` | `lunar_eclipse` | in pulses: holy ×1.5; spectral foes ×1.2 speed |
| Literature | `subj_lit` | `moonlit_blessing` | in pulses: holy ×1.3 |
| Geography | `subj_geo` | `changing_tides` | in pulses: slimes ×0.65 speed; lightning ×1.35 |
| Winter Sports | `subj_winter` | `snowbell_blizzard` | in pulses: foes ×0.7 speed, reach ×0.85 |
| History | `subj_history` | `rear_ambush` | **the Back Gate:** even waves come in by the exit road (route reversed) |
| Art Class | `subj_art` | — (seat count) | Window Seats +1 this period (the seat bonus itself never changes with a Subject) |

- Not used: `forge_vents` (map vents), `prism_conduits` (map pads), `heat_mirage` and `shifting_stars` (kept for
  later).
- A Subject appears at most once in a Half Day and twice in a Full Day, never in neighbouring periods.
- **One rule runtime** (`this.rule`, `Sim.js:93`). At each period start, and after a Board pick, the run builds one
  definition, `tryoutRuleDef(sim)`: the Subject's `cycle` and `active` keys, its `always` keys merged with the run's
  (`bountyAdd` from Spare Change), and `pads` = this block's Window Seats. Multiplying keys multiply; adding keys
  (`bountyAdd`, `livesPerWave`, `rangeAdd`) add. **`padDmgMul` and `padRangeAdd` are written once, by the run only:**
  `padDmgMul = 1 + min(0.50, seat bonus)` and `padRangeAdd = min(0.7, seat reach)`. No Subject carries them, which
  matches today's code: `rebuildRuleTables` keeps the last value it meets (`padDmg = s.padDmgMul`, `rules.js:113`) and
  never multiplies. Then
  `createRuleRuntime` + `_bountyAdd = ruleBountyAdd(…)` + `rebuildRuleTables` + `assignPads` run once
  (`src/sim/rules.js:25`, `:86`, `:274`, `:283`). No per-step work.
- **Past the goal:** a run has no freeplay goal (`_ruleGoal` = the last wave), so economy keys never switch off early.
- **The map's own campaign rule is not used**, so the Prism Conduits stages' pads never meet the Window Seats.
- **Back Gate:** when the plan contains History, the Sim is built with `_pathsRev` (today built only for Reverse Route
  or a reversing rule, `Sim.js:98`), and the rule must be installed before `startNextWave` calls `routeReversedFor`.
- Lanes per period (the squad draft's `waveGen.lanes`) are **cut**: they change `waves.js`, a hashed pure function, for
  a small gain. Later, behind a golden-hash test.

### 2.5 Hearts

100 hearts at Grades 1-2 (Grades lower it, §7). They carry through the run because it is one Sim (`options.tryout`
sets `maxLives` / `lives`; today every difficulty sets `lives`, `Sim.js:139`). Healing: Snack, Nurse's Office, Home Ec,
and the girls who already heal (Chigusa, Wakaba, Noa, through `sim.canHeal()`, `Sim.js:1475`). Max hearts can rise by at
most +50 in a run.

### 2.6 Phone pacing (844 × 390)

- **One screen per period end.** The period-end sheet holds the assignment stamps (1.5 s, tap to skip), the 3 cards,
  Eraser and Hand it in later, and the next period's two Subjects with the Double Dare toggle. One tap takes a card; a
  second tap on a Subject starts the period. Nothing else opens between periods.
- **No timers in solo.** A pick or a break is a pause point.
- **Time budget, Half Day at 1×:** Before Class ~1 min; 28 waves × ~26 s ≈ 12 min; 6 period-end sheets × ~15 s ≈
  1.5 min; 2 breaks × ~45 s ≈ 1.5 min. **≈ 16 min** (≈ 10 min at 2×). Full Day ≈ 27 min (≈ 16 min at 2×).
- **Decisions in a Half Day:** about 25-30 taps, every one at a calm point: Before Class (~5), 6 picks, up to 5 Subject
  choices, optional Double Dares, 2 breaks (≤ 3 moves each, Snack or Brush Up, Back to class). The node map design asked for
  35-40 in the same time; this is the cut the judges asked for. The playtest in M2 measures seconds spent per sheet; the
  target is ≤ 15 s median.
- The default Subject on the sheet is the one the player last tapped to read, so a returning player starts with one tap.

---

## 3. Assignments, score and rarity

### 3.1 The catalogue (17; 16 in the first ship)

All counts are differences from a small **baseline** stored at the period's first wave start: leaks, coins spent, girls
placed, upgrades, girls sold, ults used, damage per girl type, kills of the newest girl. Each assignment is a pure integer
test **inside the Sim** at the period's last wave clear (`_checkWaveEnd`, next to `ruleWaveClear`), so co-op and
Continue agree. The HUD reads live progress from a pure `assignProgress(sim)` at frame rate (no sim work).

| # | Assignment | Slot | Clear it by… (Grade 1 numbers) | Drawn only when | Sim data |
|---|---|---|---|---|---|
| A1 | **Full Hearts** | 1 | losing no hearts this period | always | `stats.leaks` change (hearts lost to leaks, boss leaks included; **never** the change in `lives`, so healers and Home Ec can't fake it) |
| A2 | **Ace the Test** | 2 | Period Score ≥ 65 % of the period's best possible (75 % at Grade 7+) | always | §3.3 |
| A3 | **Speed Round** | 2 | every wave clears within 8 s of its last spawn | always | `_waveTime` vs the last spawn tick |
| A4 | **Quick Answer** | 2 | the period's miniboss or boss falls within 12 s of arriving | the period has one | spawn and kill ticks |
| A5 | **Sky Guard** | 2 | every flyer falls before the halfway point of its road | the period has flyers | kill hook, `e.dist` |
| A6 | **Guest Lecture** | 2 | your hero deals ≥ 20 % of the period's damage | she dealt ≥ 12 % last period | `stats.damageByTower` |
| A7 | **Tight Budget** | 3 | spend ≤ B coins (B = 40 % of last period's income, at least 600) | P2+ | `ctr.spent` change |
| A8 | **Save It Up** | 3 | end with ≥ 60 % of the period's expected income unspent | P2+, **solo only** (no wallet is visible inside the Sim in co-op) | `cash` |
| A9 | **Star Pupil: *girl*** | 3 | the named girl (all copies) deals ≥ 35 % of the damage | she is placed and dealt damage last period | `stats.damageByTower` by unit |
| A10 | **Show Her Around** | 3 | your newest girl's copies defeat ≥ N foes (N grows by period) | a girl joined at the last pick | `t.kills` of her copies |
| A11 | **No Returns** | 3 | sell no girl | always | `ctr.sells` change |
| A12 | **Small Class** | 3 | place at most 1 new girl | always | `ctr.placed` change |
| A13 | **By the Window** | 3 | girls on Window Seats deal ≥ 35 % of the damage | at least one seat is held | `stats.damageByTower` of seat holders |
| A14 | **Team Effort** | 3 | ≥ 4 girl types each deal ≥ 8 % | 4+ types placed | grouped `stats.damageByTower` |
| A15 | **Quick Learner** | 3 | buy ≥ 4 path tiers | always | `ctr.upgrades` change |
| A16 | **Big Finish** | 3 | your hero uses her ult ≥ 2 times | always | `ctr.ults` change |
| A17 | **Show and Tell** | 3 | ⚡ abilities used ≥ 5 times | **only after the abilities sim ships (COOP 9)** | ability uses |

- **Per-owner counters.** The Sim's `stats` (`Sim.js:158`) counts the whole battle, so the run keeps
  `tryout.ctr[owner] = { spent, placed, upgrades, sells, ults }`, bumped by `t.owner ?? 0` in `placeTower`, the upgrade
  path, `sellTower` and the ult path, and damage shares read `stats.damageByTower` filtered by owner. Solo reads the same
  counters (owner 0), so one code path serves both, and the counters are in the sim id from M1.
- The same assignment never comes twice in a row. Slots 2-3 are drawn from the seed (`assign:<period>:<subject>`), so
  both Subject options show theirs.
- **Grade 8** makes targets 15 % stricter (Ace the Test, Speed Round, Quick Answer).
- **Failing early:** A1, A7, A11 and A12 can fail mid-period; their chip greys at once. A15 and A10 can lock in early.
- **Resumed periods** (§12.3): a period replayed by the Make-up Test or a mid-wave Continue is *resumed*: **all three of
  its assignments are void** (the chips say "resumed"), so a replay can never buy rarity.

### 3.2 Partial credit

Three small assignments instead of one big one is the partial credit the study asked for: losing one heart costs one
credit, not the reward. Teacher's Note (§3.4) and Hand it in later (§8.4) catch the bad periods.

### 3.3 Score (there is no score in the game today)

Integer only, computed in the Sim, rewarding early kills:

- **Points per foe by tier** (`def.tier`, `src/data/enemies.js`): normal 10, elite 40, miniboss 150, boss 600.
  **Split and summoned children score 0** (they carry `parentUid`, `Sim.js:454`), so splitters can't be farmed.
- **A kill** scores `floor(pts × (2048 − q) / 1024)`, where `q = min(1024, floor(1024 × e.dist / path.length))`: 2× at
  the gate, 1× at the exit. One integer multiply in `_killEnemy` (`Sim.js:642`).
- **A leak** scores `−2 × pts` (`_leak`, `Sim.js:713`).
- **Best possible** = 2 × Σ pts over the period's spawn list, children excluded, known from `_getWave` (`Sim.js:742`) at
  the period start. Ace the Test's bar shows a real target.
- **Period Score** × 11/10 (floored) with a Double Dare.
- **Run Score** = Σ Period Scores + 300 × assignments cleared + 20 × hearts left, × (9 + Grade) / 10 (floored).
- **Local only in v1:** personal bests per map, Grade and length. Share-code runs and practice replays never record. A
  ranked board waits for the server replay planned for the Sports Day Cup (`SCREEN_IDEAS.md` C01); resumed runs are
  flagged for it.

### 3.4 Credits → rarity

**Credits** = assignments cleared (0-3) + 1 for a finished Double Dare + 1 banked by Hand it in later, **capped at 4**.
The pick banner lists the sources ("Full Hearts ✓ · Ace the Test ✓ · Star Pupil (Kage) ✗ · Double Dare ✓ = 3").

One rarity is rolled per pick from the band (which pick it is) and the credits, and **all cards share it**:

| Band | Credits | R | SR | SSR | UR | LR |
|---|---|---|---|---|---|---|
| **Early** (Half Day picks 1-2; Full Day 1-4) | 0 | 60 | 32 | 8 | 0 | 0 |
| | 1 | 40 | 45 | 14 | 1 | 0 |
| | 2 | 0 | 72 | 24 | 4 | 0 |
| | 3 | 0 | 0 | 85 | 13 | 2 |
| | 4 | 0 | 0 | 70 | 24 | 6 |
| **Mid** (picks 3-4; Full Day 5-8) | 0 | 45 | 38 | 15 | 2 | 0 |
| | 1 | 28 | 47 | 21 | 4 | 0 |
| | 2 | 0 | 62 | 31 | 6 | 1 |
| | 3 | 0 | 0 | 78 | 18 | 4 |
| | 4 | 0 | 0 | 60 | 30 | 10 |
| **Late** (picks 5-6; Full Day 9-11) | 0 | 30 | 42 | 22 | 5 | 1 |
| | 1 | 15 | 45 | 30 | 8 | 2 |
| | 2 | 0 | 50 | 36 | 11 | 3 |
| | 3 | 0 | 0 | 68 | 24 | 8 |
| | 4 | 0 | 0 | 50 | 35 | 15 |

**Teacher's Note** (the pity rules, shown as pips on the pick banner):

- After 2 R picks in a row, the next pick is at least SR.
- After 4 picks with no SSR or better, the next pick is at least SSR.
- The last pick (**Exam Prep**) is at least SR.
- **LR cap:** 1 per Half Day, 2 per Full Day; a later LR roll becomes UR.

**Measured** (`tools/tryoutOdds.mjs`, 200,000 runs each; "casual" clears assignments at 40 / 35 / 45 % and
takes a Double Dare 10 % of the time, "average" 60 / 55 / 60 % and 25 %, "strong" 80 / 75 / 78 % and 50 %, "expert"
takes every Double Dare; a Double Dare costs 15 % on each assignment, so the expert clears each one 85 % of the time):

| Player | Avg credits | R / SR / SSR / UR / LR picks | SSR+ picks | UR+ picks | Runs with an LR | Teacher's Note fires |
|---|---|---|---|---|---|---|
| Half Day, casual | 1.28 | 17 / 44 / 30 / 7 / 1 % | 2.3 of 6 | 0.48 | 8 % | 0.94 |
| Half Day, average | 1.94 | 9 / 39 / 40 / 10 / 2 % | 3.1 | 0.72 | 13 % | 0.39 |
| Half Day, strong | 2.65 | 2 / 23 / 55 / 16 / 4 % | 4.5 | 1.16 | 22 % | 0.09 |
| Half Day, expert (every Double Dare, 85 % clears) | 3.55 | 0 / 4 / 64 / 26 / 7 % | 5.8 | 1.96 | 40 % | 0 |
| Full Day, average | 1.93 | 9 / 39 / 40 / 9 / 2 % | 5.7 of 11 | 1.26 | 20 % | 0.54 |
| Full Day, strong | 2.66 | 2 / 24 / 56 / 15 / 4 % | 8.2 | 2.04 | 35 % | 0.10 |

Effort clearly pays (2.3 → 4.5 SSR+ picks), casual players still see SSR picks every run, and the pity does its work for
casual players, not experts. LR stays special.

### 3.5 Making the link readable (the point of the mode)

- **Before the period:** each Subject option on the sheet lists its 3 assignments; Star Pupil shows her portrait.
- **During it:** the tracker (§13.4): an open ring while in play, a **sakura stamp** once locked in, a soft **ink
  strike** when failed (grey, never red; failing is not danger, and hazard stripes are for danger only). A line under
  the chips: **"Next pick: SR 62 · SSR 31 · UR 6 · LR 1"** (the Mid row at 2 credits), updated live. Buy and sell buttons carry a small note before they
  would break an assignment ("breaks Tight Budget").
- **At the pick:** the banner reads "3 credits → SSR" with the reason line and the Teacher's Note pips. MORE opens the
  whole table.
- **At the end:** the Class Photo shows a periods × 3 grid of stamps next to each pick's rarity: "my assignments bought
  these cards".

---

## 4. Pep Talks: the buff catalogue

### 4.1 Targets and scope

| Target | Affects | Seam |
|---|---|---|
| **Everyone** | all your students and your hero | run ModSet in `t.runMods` |
| **Group** | an attack type, the elemental girls, the Control or the Support girls | run ModSet |
| **Personal** | every copy of one squad girl (or your hero) | run ModSet |
| **Board** | the run: coins, hearts, Window Seats, Hall Passes, Erasers | run state and the merged rule |
| **Placement** | girls by where they stand (Desk Partners, Quiet Corner) | computed in `recomputeBuffs` only when buffs are dirty |

In co-op, Everyone, Group and Personal cards touch **your own** girls only (`owner === slot`); Board cards are team-wide
and say so (§11).

### 4.2 Rarity

- **Scaling cards** exist at R, SR, SSR, UR and LR: value = R value × **1 / 1.5 / 2 / 2.5 / 3**.
- **Fixed cards** have one rarity: Hidden Talents are SSR (at UR they also add +20 % damage; at LR they come with an LR
  arrival); build cards are UR; capstones are LR. Every UR and LR card except the synergy pairs carries a **bold,
  visible drawback**, so the biggest cards are decisions, not free wins.
- An LR pick shows LR-scaled cards in the Team and One-girl slots and an LR capstone in the Wild slot when one is
  eligible.
- Taking the same scaling card again adds its value, inside the caps (§4.4). One-of-a-kind cards are never offered twice.

### 4.3 The catalogue (70 cards; ✔ = in the first ship, 53)

Values are the R value unless a column says otherwise. Role groups use `ROLE_CATEGORIES` (`src/data/types.js`);
attack types and elements come from each unit's `base`.

**Everyone (8)**

| id | Card | R value (× rarity) | Helps | Keys | |
|---|---|---|---|---|---|
| E01 | **Big Breakfast** | +8 % damage | everyone | `damageMul` | ✔ |
| E02 | **Morning Stretch** | +5 % attack speed | everyone; supports refresh faster | `rateMul` | ✔ |
| E03 | **Good Posture** | +0.15 tiles reach | short-reach girls (Rei, Kaede, Hikari, Kanna) | `range` | ✔ |
| E04 | **Kite Day** | +12 % vs flyers | everyone, ground-heavy squads | `airMul` | ✔ |
| E05 | **Can Opener** | +12 % vs heavy and scaled armour | pierce and slash squads vs orcs, constructs, dragons | `classMul` | ✔ |
| E06 | **Test Prep** | +12 % vs elites, minibosses and bosses | snipers, duelists | `eliteMul`, `bossMul` | ✔ |
| E07 | **Bubble Popper** | +20 % vs barriers | everyone vs shielded waves | `barrierMul` | ✔ |
| E08 | **Team Huddle** (SR+) | SR +6 % damage and +3 % speed; SSR +8 / +4; UR +10 / +5; LR +12 / +6 | everyone | `damageMul`, `rateMul` | ✔ |

**Group (8)**: offered when 2 squad girls are in the set (1 at SSR and above).

| id | Card | Set | R value | Keys | |
|---|---|---|---|---|---|
| G01 | **Sharp Pencils** | Pierce (11 students) | +12 % damage; SSR+ also +1 pierce | `damageMul`, `pierce` | ✔ |
| G02 | **Science Fair** | Blast (Akane, Sango, Suzu, Marumi) | +12 % damage, +0.1 splash | `damageMul`, `splash` | ✔ |
| G03 | **Sword Drills** | Slash (Rei, Kaede; Kanna) | +14 % damage, +2 crit points | `damageMul`, `crit` | ✔ |
| G04 | **Library Hour** | Mystic | +12 % damage, +8 % vs warded | `damageMul`, `classMul` | ✔ |
| G05 | **Shrine Visit** | Holy (Miko, Hotaru, Noa, Ouka; Hikari) | +12 % damage; hits reveal veiled foes for 1 s (+0.5 s per rarity step) | `damageMul`, `reveal` | ✔ |
| G06 | **Weather Report** | Elemental (fire, frost, lightning, poison, water) | +10 % damage; burns and poisons +15 % | `damageMul`, `dotMul` | ✔ |
| G07 | **Crossing Guards** | Control (Yuki, Suzu, Hotaru, Fuu, Azami, Chigusa) | +8 % attack speed, +0.15 reach | `rateMul`, `range` | ✔ |
| G08 | **Backstage Crew** | Support (Umeko, Miko, Noa, Chika, Ouka, Yuzuha, Wakaba) | aura and office reach +0.2 tiles, aura bonuses +2 points | `aura` | ✔ |

Auras: "only the strongest aura per stat counts" still holds (HANDOFF §10). Backstage Crew raises the winning aura.

**Personal (6 templates × any squad girl)**

| id | Card | R value | Fits | Keys | |
|---|---|---|---|---|---|
| P01 | **Extra Practice** | +16 % damage | your carry | `damageMul` | ✔ |
| P02 | **New Sneakers** | +10 % attack speed | any attacker; buff throwers | `rateMul` | ✔ |
| P03 | **Step Stool** | +0.3 tiles reach | melee, auras, trap layers (never offered for map-wide girls) | `range` | ✔ |
| P04 | **Scholarship** | her placing and upgrades −8 % | expensive girls (Hotaru, Chika at 650) | run cost factor by unit | ✔ |
| P05 | **Hot Streak** | +4 crit points, +0.1 crit damage | crit builds | `crit` | ✔ |
| P06 | **Free Refills** | her next 1 / 1 / 2 / 2 / 3 upgrades of tier 3 or lower are free | any | `_upgradeCost` → 0 for a counter; `t.spent` does not grow, so selling refunds nothing for them | ✔ |

**Board (8)**

| id | Card | Rarities | Effect | Notes | |
|---|---|---|---|---|---|
| B01 | **Snack Fund** | R / SR | +200 / +350 coins now and +30 / +50 at each of the next 8 wave clears (× `cashScale`; co-op: to your wallet) | not in the last 2 picks | ✔ |
| B02 | **Spare Change** | R / SR | foes give +1 / +2 coins (`bountyAdd` in the merged rule) | team-wide in co-op; not in the last 2 picks | ✔ |
| B03 | **Nurse's Office** | R / SR / SSR | heal 15 / 25 / 40 hearts; max hearts +5 / +8 / +12 | refused at Grade 12 (no healing) | ✔ |
| B04 | **Sunny Window** | SR / SSR | the seat bonus rises from +25 % to +35 % / +40 % damage (reach stays +0.7: M2); SSR adds 1 seat | **one of a kind**; team-wide; inside the seat cap (§4.4) | ✔ |
| B05 | **Spare Pass** | SR | +1 Hall Pass at every break from now on (passes are spent only in breaks) | one of a kind; team-wide in co-op (every player gets the pass) | ✔ |
| B06 | **Rainy-Day Fund** | SR | at every period end, +10 % of your unspent coins (at most 300 × `cashScale`) | one of a kind; **solo only** (it reads the wallet) | ✔ |
| B07 | **Multiple Choice** | UR | every later pick shows 4 cards (a second Wild) and +1 Eraser; **drawback: Hand it in later pays no coins** | one of a kind; never at the last pick | ✔ |
| B08 | **Extra Desk** | UR | +1 squad spot and your next pick is a Tryout pick; **drawback: max hearts −10** | one of a kind; never at the last pick | ✔ |

**Placement (2)**: these make Hall Passes and Seat Changes pay off.

| id | Card | R value | Effect | |
|---|---|---|---|---|
| L01 | **Desk Partners** | +5 % attack speed | for girls with another of your girls within 1.25 tiles (tight corners) | ✔ |
| L02 | **Quiet Corner** | +8 % damage | for girls with no other girl within 1.75 tiles (lone snipers, mirrors, far bends) | ✔ |

Both are folded inside `recomputeBuffs` (`src/sim/towers.js:331`) only when buffs are dirty (a placement, a sale, a Hall
Pass move), never per step.

**Hidden Talents (29, SSR, Personal):** one per student; each changes how she plays. Offered in the One-girl or Wild slot of
an SSR+ pick, half the time when she has none yet. One per girl. Every key already exists in `src/sim/mods.js`.

| Girl | Hidden Talent | What changes | Keys | |
|---|---|---|---|---|
| Aoi | **Blessed Arrows** | her arrows become holy (×2 vs spectral) and she gains Veil Sight | `attackType`, `detection` | ✔ |
| Rei | **Flying Slash** | she can hit flyers; sweep +0.5 tiles | `canHitAir`, `range` | ✔ |
| Yuki | **Snowball Fight** | 25 % of her snowballs freeze for 0.5 s; splash +0.3 | `status`, `splash` | ✔ |
| Momo | **Sold-Out Show** | +25 coins a wave and +1 % interest (her cap of 150 stays) | `income` | |
| Akane | **Sparkler Rain** | 3 fireballs per throw at 55 % each, spread wide | `projectiles`, `damageMul` | ✔ |
| Sango | **Depth Charge** | her shells knock back 0.3 tiles and can hit flyers | `knockback`, `canHitAir` | |
| Kage | **Ambidextrous** | +2 shuriken per throw, +1 pierce | `projectiles`, `pierce` | ✔ |
| Umeko | **Harbor Lights** | Veil Sight aura +1.5 tiles; her aura also gives +8 % attack speed | `aura` | |
| Shiro | **Piercing Round** | each shot passes through 1 more foe (M2: `chain` did nothing on her shots; 2 put her past the ceiling gate) | `pierce` | ✔ |
| Midori | **Lab Day** | flask splash +0.4; hits shred 1 armour for 3 s | `splash`, `status` | |
| Suzu | **Wind Chimes** | +3 traps; trap hits +30 % | `trap` | |
| Raika | **Lightning Round** | +3 jumps; shock 0.3 s | `chain`, `status` | ✔ |
| Miko | **Travelling Shrine** | aura +1.0 tile and +8 % attack speed inside it | `aura` | |
| Hotaru | **Parade of Lights** | +4 targets, +0.5 reach | `maxTargets`, `range` | ✔ |
| Kaede | **Focused Mind** | keeps 60 % of her focus when her target falls; can hit flyers | `keepRamp`, `canHitAir` | ✔ |
| Chika | **Tinker Time** | +2 drones | `turret.max` | ✔ |
| Fuu | **Gather Round** | her gusts gather the wave into a clump: a combo setter for splash girls | `gather` | ✔ |
| Hana | **Falcon Eye** | her mark makes foes take +10 % from everyone; +0.6 reach | `mark`, `range` | |
| Ruri | **Pack Leader** | Kon stands 1.0 tile further; +30 % damage | relay reach, `damageMul` | |
| Noa | **House Call** | her chimes silence 1 s longer and reveal; aura +0.8 tiles | `silence`, `reveal`, `aura` | |
| Iroha | **Polished Glass** | her mirror panel reaches 1.2 tiles further; +20 % damage | relay reach | |
| Ena | **Chain Letter** | curse bursts 40 % harder and 0.4 tiles wider | `status` (curse) | |
| Azami | **Long Hallway** | strips last +4 hits | `strip.hits` | |
| Kinu | **Sewing Circle** | +1 scissor; pins travel 0.5 tiles further | ring | |
| Wakaba | **Two Bottles** | drinks splash 0.6 tiles wider and last 2 more attacks | `drink` | |
| Yuzuha | **Spare Toolbox** | +1 sentry; her nets catch elites | `sentry.max`, `netElite` | |
| Ouka | **Open Office** | office radius +1.0 tile; discount +5 points (the 50 % cap stays) | `hub` | |
| Chigusa | **Garden Plot** | +1 thorn bed; vine hold +0.5 s | `vine` | |
| Marumi | **Bonus Frame** | her balls ricochet to 2 more walkers | `ball.bounce` | ✔ |

The first ship carries 12 (marked ✔), chosen for squads that lack anti-air, multi-target or control. The other 17 follow
as content updates, each with its bench check (§9.3).

**UR build cards (5)**

| id | Card | Needs | Effect | Drawback | |
|---|---|---|---|---|---|
| U01 | **School Spirit** | — | everyone +20 % damage, +10 % attack speed, +0.3 reach | **−1 Hall Pass at every later break** | ✔ |
| U02 | **Fire and Ice** | a fire and a frost girl | fire hits leave foes **Brittle** (+10 % damage from everyone for 3 s: the existing `S.vulnerable`, and the strongest Brittle wins, `status.js`); frost girls +30 % damage | **girls who are neither fire nor frost −10 % damage** | ✔ |
| U03 | **Thunder and Rain** | a water and a lightning girl | water hits Soak for 3 s; lightning girls +1 jump, +30 % damage | **the others −10 % damage** | ✔ |
| U04 | **Light and Shadow** | a holy and a pierce girl | holy hits reveal for 3 s; pierce girls +12 crit points | **the others −10 % damage** | ✔ |
| U05 | **Varsity Letter** | a squad girl below Varsity; not the last pick | Personal: she gains Varsity (+15 % damage, +10 % attack speed, her copies cost 10 % less) | **your next pick shows 2 cards** | ✔ |

**LR capstones (4)**: at most 1 per Half Day, 2 per Full Day. None bends an owner rule.

| id | Card | Effect | Drawback | |
|---|---|---|---|---|
| X01 | **Hundred Points** | everyone +35 % damage, +20 % attack speed | **foes +10 % HP for the rest of the run** | ✔ |
| X02 | **Whole Class Turns Up** | take 2 of 4 girls, both with the SSR arrival package; +1 squad spot (offered only with at least 1 open spot, never at the last pick) | **your next pick is skipped** | ✔ |
| X03 | **Golden Chalk** | Window Seats +1 and the seat bonus to its cap: +50 % damage | **−1 Hall Pass at every later break** | ✔ |
| X04 | **Final Bell** | the last wave of every period: all girls +40 % attack speed and +20 % damage | **the first wave of every period: −10 % damage** | ✔ |

**Count:** 8 Everyone + 8 Group + 6 Personal + 8 Board + 2 Placement + 29 Hidden Talents + 5 UR + 4 LR = **70**; the first
ship has 53. Each Personal template can name any squad girl, so a run meets far more distinct cards than templates.

### 4.4 Caps and stacking (anti-snowball)

Every card a player owns is **folded once per girl type into one cached ModSet** at the pick (and at a period start,
when the Run Level floor rises), then `_refreshTower` + `recomputeBuffs` run on her towers. The battle reads that object
and never re-sums. Families **add**, never multiply, inside these caps per girl, from all run sources together
(cards, Varsity, capstones). **Order:** bonuses are summed and capped first, then drawbacks are subtracted, so a drawback
always bites, even on a girl at her cap: `min(cap, Σ bonus) − Σ drawback`.

| Stat | Cap per girl |
|---|---|
| Damage | **+100 %** |
| Attack speed | **+50 %** |
| Reach | +0.5 tile (M2 ceiling gate; was +1.0) |
| Crit chance / crit damage | +10 points / +0.25 (M2; card crit's expected gain also counts inside the ×2.5 below) |
| Pierce / projectiles / chain jumps | +1 / +1 / +2 (M2) |
| Splash | +0.25 tiles (M2) |
| Each "vs" bonus (air, heavy and scaled, elite and boss, barrier, warded) | +30 %, and only the room left under the ×2.5 run damage (M2: a vs card never costs damage against ordinary foes) |
| Cost cuts (placing and upgrading) | −30 % |
| Window Seat bonus (one team-wide value) | +50 % damage; reach stays +0.7 (Prism's: M2) |
| **Run damage, cards × seat together** | **×2.5 per girl** |

- - **The "vs" bonuses count inside the run-damage cap** (M0 review: E06 gives elite and boss together, ×1.3 × ×1.3 against
  a boss, which broke the ceiling proof): each vs family caps at **+30 %**, and a girl's card damage times her largest vs
  multiplier never passes ×2.5 (damage gives way first); the seat clamp divides by that same product.
- Every card shows a **cap bar**: "Team damage +36 % → +52 % / 100 %"; a Team card shows the most-affected girl and
  "applies fully to 4 of 5 girls".
- A family at its cap drops out of offers. If the filters empty a slot, it falls back to Big Breakfast (Team) or Extra
  Practice (One girl) at the pick's rarity.
- **The seat is inside the cap.** The seat bonus is one team-wide number: +25 % base, raised by Sunny Window (one of a
  kind) and Golden Chalk, never above +50 %; Subjects never touch it. A seat holder's hit multiplier `t.padMul` is then
  clamped to `2.5 / (1 + her capped card damage)`, so cards and seat together never pass ×2.5. A girl at the +100 % card
  cap still gets the base ×1.25 seat; the bigger seat cards help girls below the cap. The clamp runs where the run's seat
  assigner sets `padMul` and after every pick (≤ 4 seats), never per step.
- Run cards never touch `unitStats`, so the co-op clamp (`src/online/coop/statLimits.js:29`) never cuts them.

### 4.5 No dead picks

A card is never offered when:

1. its target is not in the squad (Personal names a squad girl, weighted 3× toward placed girls and by last period's
   damage share; Group needs 2 set members, 1 at SSR+);
2. at least half of its value would be cut by a cap for every target;
3. it is an economy card in the last 2 picks;
4. it is one of a kind and already owned;
5. it is a reach card for a map-wide girl;
6. it is a pair card (U02-U04) without both halves in the squad;
7. it is an ability card before the abilities sim ships;
8. it changes the *next* pick and this is the last pick (Multiple Choice, Extra Desk, Varsity Letter, Whole Class Turns
   Up). At the last pick Hand it in later pays coins only and banks no credit, and its button says so;
9. it brings girls or squad spots the squad can't use (Whole Class Turns Up needs at least 1 open spot);
10. it reads a wallet and the run is co-op (Rainy-Day Fund; the assignment Save It Up likewise).

**Hand it in later** is always on the sheet, so even a bad offer is worth something (§8.4).

### 4.6 Held back

- **Rule-bending cards are out** unless the owner says yes (Q10): two copies owning one final tier (path cap,
  `src/sim/finalTier.js`), a second path past tier 2 (crosspath, `mods.js:785`), mid-wave moves, three girls per seat,
  and the second-strongest aura counting. Each would need its own tests.
- **Ability content waits for the abilities sim (COOP 9):** Show and Tell, ability-charge cards and a ⚡ path on SSR
  arrival packages stay out of the pools until then.

---

## 5. Girls: Tryouts and Loaners

| Question | Answer |
|---|---|
| **Starting squad** | Before Class shows **6 seeded girls**; take 3. The 6 always include 2 strikers, 1 girl who hits flyers at tier 0, and 1 Control or Support girl. If you own at least 4 eligible students, 4 of the 6 are yours. One free redraw. |
| **When girls are offered** | Pick 1 is a **Tryout pick** (3 girls); the Full Day adds one at pick 5. Other picks: the Wild card is a girl **30 %** of the time while the squad has room, and Teacher's Note forces one after 3 picks with no girl while the squad has fewer than 6 types. Extra Desk and Whole Class Turns Up add more. Expected joins: about 2.5 in a Half Day (squad of ~5-6 types). |
| **Squad cap** | 8 types in solo (the formation of 8 + 1, `BATTLE.maxTowers`); 5 per player in co-op (`COOP.towersPerPlayer`, inside `LOADOUT_MAX` 6 with the hero, `statLimits.js:58`). A full squad gets no girl cards; the Wild slot becomes a Pep Talk. **No swaps** in the first ship. |
| **Which girls** | Any of the 29 students not in the squad. Weights: owned 1.5, not owned 1.0; a girl who answers a trait of the next block that the squad cannot answer +0.5; the girl you declined at the last pick is skipped once. A girl already in the squad comes as a **Varsity card** (weight 0.5) until she has Varsity. |
| **Coverage guarantee** | The plan is known from the seed, so the Sim knows the next block's traits: flyers, veiled, heavy armour, regeneration, spectral. If one has no answer in the squad (unit `capabilities` + `pathCapabilities`, the data the stage `recommended` tests use), the next girl card is drawn only from girls who answer it. Her MORE sheet says why: "Coverage: no anti-air for P5's flyers". |
| **Power** | **Owned:** her account stats inside the band (§9). **Loaner** (the repo's word, `SCREEN_IDEAS.md` A07, C09): a girl you don't own plays at the Run Level floor, P1, no gear, no club, no awakening passive, for this run only. A late joiner arrives at the current floor, never at Lv 1. |
| **Arrival package** | The pick's rarity: **R** free first copy at tier 0 · **SR** free copy at tier 2 on a path you choose · **SSR** tier 3 on a path you choose · **UR** tier 3 + Varsity · **LR** tier 4 + Varsity + her Hidden Talent. Never a final tier; crosspath and the path cap apply. |
| **The voucher** | The free copy is a voucher that waits until used: her next placement costs 0 and starts at those tiers. TAKE puts her ghost on the board straight away; "Place later" keeps it. **The gift's value stays out of `t.spent`**, so selling her refunds 70 % of coins added later and nothing for the gift. |
| **Varsity** | +15 % damage and +10 % attack speed (inside the caps), and her copies cost 10 % less to place. One level only in the first ship (the second level bent the path cap). |
| **Gacha safety** | Loaners never join the account and play at the floor, below an invested copy. The Class Photo links to her girl page ("Try her", E08, when it exists). There is no store link and no recruit button inside a run. |

The card shows her portrait in **her own unit rarity frame** (§13.1), role and type chips, a power line ("Yours · plays
at the band cap" or "Loaner · Run Level 58"), the arrival package ("Arrives at tier 2 · choose a path") and, when it
applies, the coverage reason.

---

## 6. The breaks: Seat Change and Hall Passes

### 6.1 When

| Break | Half Day | Full Day | Window Seats drawn for |
|---|---|---|---|
| **Recess** | after P3 | after P3 | the next block |
| **Lunch Break** | — | after P7 | the next block |
| **Cleaning Time** | after P6 | after P11 | the Final Period |

`startNextWave` and auto-start are refused until **Back to class** (solo) or both players are Ready (co-op). No timer in
solo.

### 6.2 Window Seats and the Seat Change

- **3 Window Seats** (4 in co-op; 2 / 3 from Grade 4), each a chalk circle with a small desk glyph, radius 0.9 tiles
  (the pad default in `src/data/rules.js`).
- **The girl whose centre sits in a seat deals +25 % damage and reaches +0.7 tiles further** (the base; cards can raise
  it to +50 % and +1.0, the cap, §4.4): the Prism Conduits numbers
  (`padDmgMul` 1.25, `padRangeAdd` 0.7), applied by the existing pad code (`assignPads`, `src/sim/rules.js:283`;
  `ruleHitScale`, `ruleRangeFor`).
- **Students only.** Heroes already move for free between waves, so a hero could always claim the newest seat. The run's
  seat assigner (`assignSeats`, below) skips heroes; Prism Conduits stages keep today's `assignPads` behaviour, proven by
  the golden test (§15).
- **One girl per seat, and the first to sit keeps it.** The run stores each seat's holder (`tryout.seatHolder[i]`, a uid):
  a girl claims a free seat when she is placed or moved into it and keeps it until she leaves it (sold or moved off) or
  the seats change. When a Seat Change takes effect, seats claimed during the break go to the girls moved into them, in
  move order; a seat still free goes to the lowest-uid girl inside it. This replaces today's lowest-uid rule
  (`assignPads`, `rules.js:283`) for runs only, through one guarded line, `if (sim.tryout) return assignSeats(sim)`,
  which sets the same `padIndex` / `onPad` / `padMul` / `padRangeAdd` fields. So a Hall Pass girl with an older uid
  never takes a seat from its holder, and in co-op a partner's older girl can't take yours. Every seat shows its
  holder's portrait chip. A Hall Pass ghost over a held seat says "Seat held by Kage: no bonus here".
- **Positions are seeded** (`seats:<block>`) from the placement lattice `headless.autoPlan` uses
  (`src/sim/headless.js:245`): land spots 1.2-2.6 tiles from the road segments the block's waves use most, at least 3
  tiles apart. All seats of the run are drawn at the start and shown one block ahead.
- **Seat Change** happens only at a break, for the next block: new seats dashed, old ones fading; the seats switch over
  when the next period starts. RNG sets the puzzle; Hall Passes solve it.

### 6.3 Hall Passes

- **3 per break** (2 from Grade 7). Spare Pass adds 1; School Spirit and Golden Chalk take 1. Unused passes carry over;
  hold up to 5.
- **A pass moves one placed student of yours** to any legal spot, free. Legal = the hero Move's check: `inBounds`, then
  `placement.check(def, x, y, towers minus herself)` (`src/sim/hero.js:252`, `src/sim/placement.js`): off the path band,
  no overlap, land or water as she needs, no trees or rocks. The ghost turns red with the reason and shakes, as placement
  does today.
- **She keeps** her tiers, coins spent, kills, damage totals, targeting, Varsity and ability charge. Path upgrades, the
  path cap and crosspath don't care where she stands. A cost cut at the new spot refunds and charges nothing; it applies
  to future buys only.
- **Undo:** the Undo button takes back the last move and refunds its pass (repeatable, newest first). Moving a girl back
  to where she stood at the break's start refunds every pass she used this break, however many moves it took.
- **Heroes** use their own free move, never a pass.
- **Why it matters:** without a pass the only way to move is sell (70 %) and re-buy, so one pass on a tier-4 girl is
  worth thousands of coins.

### 6.4 What a moved girl's things do (one rule, one test per kit)

The rule: **anything lying on the road stays until foes use it up; anything that must stay inside her reach follows her
reach.** `moveGirl` calls `Sim._relocate` (`Sim.js:1196`, "the one place for every position-derived field", which already
resets trap spots, targets and ramp stacks, moves drones, re-assigns pads, recomputes buffs and the relay origin) and then
applies this table:

| What | Where it lives | On a Hall Pass move |
|---|---|---|
| Suzu's traps | `sim.traps` by `ownerUid` | **stay** until triggered (they count toward her cap, so she refills near her new seat as they are spent) |
| Azami's Sticky Tar strips | `src/sim/strips.js` | **stay** (finite hits) |
| Yuzuha's nets | `t.nets` | **stay** (on the road) |
| Ouka's Rally Banners | `t.banners` | banners beyond her banner reach from the new spot are **picked up**; she plants them again next wave |
| A mirror or checkpoint aim (Iroha…) | `t.aim` | **clamped** to her reach from the new spot (the `setAim` rule, `Sim.js:1225`) |
| A mortar aim | `t.aim` | **stays** (map-wide) |
| Chika's Hold and Patrol points | `t.flight` | kept inside her leash; outside it, back to **Hover** |
| Ruri's Kon, Iroha's panel origin | relay origin | recomputed (already in `_relocate`) |
| Window Seat ownership | `assignPads` | recomputed (already in `_relocate`) |
| Abilities | `abilGroups` | charge kept; a calm point holds no running effect |

The card warns before a move: "Her 3 banners outside her reach will be picked up."

### 6.5 Snack or Brush Up

At every break, one tap: **Snack** heals 15 hearts (at full hearts, +5 max hearts; at Grade 12, where nothing heals, it
gives +1 Hall Pass instead and says so) or **Brush Up** raises one scaling Pep Talk you own by one rarity (max UR). In co-op each player chooses; a Snack heals 8 hearts per player.

### 6.6 On screen

A banner "RECESS · Seat Change" with Hall Pass tokens (●●●○○), the next block's scout card (families and traits from
`waveWarnings`, the miniboss or boss and its road, the History periods), road heat stripes, the dashed new seats with
holder chips, Snack and Brush Up cards, and **Back to class**. The hero widget's move flow is the UI precedent
(`src/ui/battle/heroWidget.js`, `src/ui/battle/placement.js`).

---

## 7. Difficulty: Grades and content windows

> **M2 tuning (bot sweeps, `tools/tryoutBot.mjs --sweep`):** the run table now has hearts 60 at Grades 1-9 (Grade 10: 55;
> 11-12 as below), spring hpScale 3.3, summer 7.0 and hpMul 1 / 1.2 / 1.1 / 1.25 / 1.4 / 1.4 / 1.4 / 1.5 / 1.5 / 1.5 / 1.5 / 1.52;
> `src/data/tryout.js` is the source of truth where the Hearts column below differs. Normal waves barely leak, so runs are
> decided by the minibosses and the boss: with 100 hearts a run could not be lost. Measured (solo, Half Day, random
> picks): Grade 1 new account 60 %, average 96 %, Grade 6 average 48 %, Grade 12 maxed 8 %. The average player's ~75 % at
> Grade 1 cannot be met together with the new account's ~60 %: the band puts a new account at the floor and an average
> one at the cap (~1.7-2× the damage), and that gap is a §9.2 design call (owner question, M2 PR).

Grades 1-12 are one ladder; clearing Grade N (either length) opens N + 1. Each Grade keeps the twists below it. Content
windows match campaign progress, so the mode can open early without meeting chapter 8 bosses on day one.

| Grade | Window and unlock | Adds | Hearts |
|---|---|---|---|
| 1 | **Spring Term** (maps and families of chapters 1-3; minibosses Slime Prince, Goblin Machine; final Grave Lych or Iron Colossus). The mode opens after clearing **2-5**. | the run as described | 100 |
| 2 | | foes +10 % HP | 100 |
| 3 | **Summer Term** (chapters 1-6; adds Orc General, Oni Champion and the Ashwing Matriarch). Needs **4-5** cleared. | | 80 |
| 4 | | Window Seats −1 | 80 |
| 5 | | 1 Eraser instead of 2 (the Weekly Timetable plays Grade 5 rules) | 80 |
| 6 | **Autumn Term** (all chapters; all 7 bosses). Needs **8-5** cleared on Normal. | foes +25 % HP in total; boss leak 60 | 80 |
| 7 | | 2 Hall Passes per break; Ace the Test needs 75 % | 80 |
| 8 | | from P3, each period carries one affix (swift, regen, armored or shielded), shown on the timetable; targets 15 % stricter | 80 |
| 9 | | Snack heals half | 50 |
| 10 | | arrival packages one step lower (at least R) | 50 |
| 11 | | foes +45 % HP in total; the Final Period adds a second boss escort group | 50 |
| 12 | | **no healing** (`canHeal` off, the Last Petal rule) | 20 |

- **Minibosses and bosses** are the window's named list whatever chapter they first appear in (Goblin Machine is a
  chapter 6 enemy, yet Spring Term's miniboss on purpose: one big foe is a set piece, not a family the squad must
  answer every wave); the families come from the window's chapters.
- **Boss leaks** (M0 review): every boss has `leak: Infinity` and generated waves carry no `leak`, so the run sets a
  boss's leak to the Grade's 40 or 60 in its `spawnEnemy` hook (`tryoutSpawn`); split children keep theirs.
- **Targets for the bot** (§15): at Grade 1, a new account (2-5 cleared) wins ~60 % of Half Days and an average player
  ~75 %; a random-legal-picks bot ~50 %; strong players clear Grade 12 ~5-10 % of the time.
- **Make-up Test** (solo): once per run, replay a wave from its start with the hearts, coins and luck you had then. It
  is spent either when hearts hit 0 (a Make-up Test button replaces the defeat sheet) or by a Continue that restarts a
  wave already in progress (§12.3), whichever comes first. It reuses the battle save written at every wave start; the
  replayed period is resumed, so its assignments are void. Not in co-op in the first ship.

---

## 8. RNG, seeds, rerolls and pity

### 8.1 Seeds and streams

- **One run seed** (uint32), drawn once at New Run outside the Sim (the UI may use the clock there) and stored. The
  Weekly Timetable seed is `hashString('tryout-week:' + gameWeekNumber())` (`src/core/reset.js`, the week Titan Trials
  use). A **share code** is 8 characters of base 32 (Crockford's alphabet, no I, L, O or U: 40 bits): the uint32 seed, the
  Grade (4 bits), the length (1 bit) and a 3-bit check.
- **Every draw** comes from `createRng(hashString(\`${seed}|tryout|${label}\`))` (`src/core/rng.js`; `rng.weighted` for
  weighted picks). **Never `sim.rng`** (combat, re-seeded per wave by `useWaveStream`, `src/ui/battle/snapshot.js:241`),
  never `Math.random`, never `Date.now`.

| Label | Draws |
|---|---|
| `plan` | the 2 maps, the Subject pairs, the families per block, the minibosses and the boss |
| `seats:<block>` | Window Seat positions |
| `draft:<slot>:<redraw>` | the Before Class 6 |
| `assign:<period>:<subject>` | assignments 2-3 and the Star Pupil girl |
| `dare:<period>` | the Double Dare curse |
| `rarity:<pick>:<slot>` | the pick's rarity |
| `offer:<pick>:<slot>:<erasers>` | the cards, and whether the Wild card is a girl |

- **Offers are a pure function of the seed, the choice history and the board at that wave end.** The choice history
  (squad, cards owned, pity counters, credits, Erasers used) is run state, which only commands change. The board inputs
  (last period's damage shares for Personal weights and Star Pupil; placed girls and tiers for coverage) are Sim state
  at that wave end, so they are lockstep-identical too. The open offer is **stored in run state** when the sheet opens,
  so a reload, a Continue or a co-op peer shows exactly what was shown; the §15 test rebuilds it from the seed plus the
  snapshot taken at that wave end.
- **Waves** are a pure function of the stage id and wave number; battle saves keep the per-wave stream rule.

### 8.2 Erasers (rerolls)

2 per run (1 from Grade 5); a perfect period (3 of 3) earns +1; hold up to 3. An Eraser redraws all cards **at the same
rarity**, never the same set again. It never changes the rarity, so it cannot fish for rarity. Never sold for gems. If
the eligible pool can't form a different set, the Eraser changes every slot it can and keeps the rest; if no slot can
change, the button is disabled ("No other cards at this rarity") and nothing is spent.

### 8.3 Double Dare

On the period-end sheet, an optional toggle for the next period: one affix from the freeplay list (`FREEPLAY.affixes`,
`src/data/freeplay.js:49`: swift ×1.2 speed, regen 2 %/s after 2 s, armored +3, shielded 30 % barrier), applied with
`applySpawnMods` (`src/sim/enemies.js:167`). The curse is named before you tap. Finishing the period gives **+1 credit**
and **+10 % Period Score**. Off by default; one tap. In co-op it is on only if both players tap it before the period
starts.

### 8.4 Hand it in later

Turn down the whole pick for `150 + 50 × period` coins (× `cashScale`); the next pick counts **+1 credit** (cap 4). A
bad offer buys a better next one. The node map's plain skip is replaced by this. At the last pick there is no next
pick, so it pays the coins only.

### 8.5 Pity and caps

Teacher's Note and the LR cap (§3.4); the coverage guarantee and the forced girl card (§5); floors in the table itself
(2 credits ≥ SR, 3 ≥ SSR).

### 8.6 Reloads and quitting

Every run command (pick, Eraser, hand-in, Double Dare, Subject, Hall Pass move, Snack or Brush Up, Ready) triggers a
battle-save write, so closing the tab can't undo an Eraser or a move. Quitting mid-wave is the one retry a battle save
allows (`docs/BATTLE_SAVE.md`: "Retrying a wave from its start is allowed"). A run counts it: the first spends the
Make-up Test and voids that period's assignments, and a second turns the run into practice (§12.3). So a retry can't
rescue an assignment, a Grade clear or an achievement.

---

## 9. Player power and the balance target

### 9.1 The trade, plainly

| Option | What it means | Spread between a new and a maxed account at P1 | Cost |
|---|---|---|---|
| **Own roster at full power** | your stats as in the campaign | about **12×** (`tryout-power.mjs`) | enemies can't be tuned for both; co-op clamps cut stats; veterans breeze through |
| **Even** (everyone at Run Level) | every girl at the same normalised level | 1× | fairest, but the collection gives no power, which misfits a gacha whose owner prizes long-term roster goals |
| **The band (default)** | owned girls count, raised to the floor and capped near a Lv 60 geared girl; Loaners at the floor | **2.0× at P1, 1.5× fully built** | one balance band, a reason to invest, day-one access |

### 9.2 The band, exactly

All of this is computed **inside the Sim** (`src/sim/tryout/power.js`) from constants in the hashed run table, so co-op
peers agree and the formula sits inside the sim id. The account stats arrive in the loadout as today (frozen at New Run,
like a battle save; `unitBattleStats`, `src/systems/progression.js:472`) and are kept in run state so the band can be
re-applied when the floor rises.

- **Run Level floor** rises in even steps from **Lv 50** at P1 to **Lv 74** at the Final Period: damage
  `1 + 0.018 × (L − 1)`, attack speed `1 + 0.004 × (L − 1)` (the `PER_LEVEL_DAMAGE` / `PER_LEVEL_RATE` maths of
  `progression.js:61-64`, copied into the table). P1 = ×1.88 / ×1.20; Final = ×2.31 / ×1.29.
- **Band cap:** damage ×3.0, attack speed ×1.5, range ×1.1, crit chance 15 %, crit damage ×1.5, armour pen 3, cost cut
  10 %, aura +10 %. That is about a Lv 60, gate 5, 2-star girl with +40 % gear (×3.17 / ×1.42).
- **Run stat** = clamp(account stat, floor, cap), per key. Kit effects come with her: club tricks, the ★3 awakening
  passive and Potential steps **up to P3**.
- Loaners: the floor, P1, nothing else.
- Each period start updates the loadout entries **in place** (so `t.unitStats` identity holds) and calls `_refreshTower`
  once per tower. Never per step.

**The ceiling, proven** (`tryout-power.mjs`), with every multiplier a run can add:

| Source | Damage | Attack speed | What bounds it |
|---|---|---|---|
| Band cap on account stats | ×3.0 | ×1.5 | the band (above) |
| Run cards (Everyone, Group, Personal, Placement, Varsity, UR, LR) | up to ×2.0 | up to ×1.5 | additive family caps (§4.4) |
| Window Seat | ×1.25 base, ×1.5 at most | — | the seat cap; Sunny Window is one of a kind; Subjects never change it |
| **Cards × seat together** | **×2.5 at most** | — | the seat holder's `padMul` is clamped (§4.4) |
| Subject pulses (Music all ×1.25, Night Class holy ×1.5, Geography lightning ×1.35…) | × S | | the campaign's own map rules (`MAP_RULES`) at the same numbers, so a maxed girl on that rule's campaign map gets the same × S |
| Brittle from Fire and Ice | +10 % taken | | `status.js` keeps the strongest Brittle; campaign teams already reach +15-20 % (hero tracks) |

So a fully capped run girl deals at most **3.0 × 2.5 = ×7.50** damage (a maxed girl: ×7.57) at **×2.25** attack speed
(maxed: ×3.10): a stat block of **16.9 vs 23.5, 72 % of a maxed girl** with the same tiers. Under a Subject the
comparison holds rule for rule (Night Class: 11.25 vs 11.36 for a maxed girl on the Lunar Eclipse map), and the
campaign's own seat-like case, a maxed girl on a Prism Conduits pad (×9.46), is above every run ceiling without a pulse.
The first draft of this proof missed the seat cards: Sunny Window, Golden Chalk and Art Class could have pushed the stat
block to 125-157 % of a maxed girl. With the seat cap, a one-of-a-kind Sunny Window, an Art Class that only adds a seat
and the ×2.5 clamp, every combination stays at ×7.50 (the script prints each case). So **nothing in a run makes a girl
stronger than a fully maxed girl, and the 1M-2.5M band (CONTEXT C6) holds by construction**. Hidden Talents add
projectiles, chains or targets, so each one is benched (§9.3).

| Account | P1 stat block | Fully built (Final, caps + seat) |
|---|---|---|
| New (2-5 cleared: Lv 30, gate 2, +10 % gear) | ×2.25 (raised to the floor) | ×11.2 |
| Mid (6-5: Lv 60, gate 5, 2 stars, +40 % gear) | ×4.26 | ×16.0 |
| Maxed | ×4.50 (capped) | ×16.9 |
| Loaner | ×2.25 | ×11.2 |

### 9.3 Measuring

- **Bench real hit DPS, not panel DPS.** Panel DPS (`Sim.towerStats`, `Sim.js:1346`: `e.damage × e.rate`) leaves out the
  seat (`padMul` is applied only at hit time, `ruleHitScale`, `rules.js:136`), rule pulses and Brittle. So the gate
  measures damage actually dealt: `tools/bench.mjs` gains a `--hit` mode that places one girl on a long dummy wave and
  divides `stats.damageByTower` by the seconds (crits, chains, splash, seat and Brittle included). For every girl and
  every Hidden Talent at the run ceiling (band cap, cards at cap, seat at its cap, sitting on a seat), measured hit DPS
  must be ≤ the same girl fully maxed on a Prism Conduits pad, and ≤ 2.5M × 1.25. A Hidden Talent that fails has its
  numbers cut before it ships. This is an M2 gate.
- `tools/tryoutBot.mjs` (§15) sweeps three roster strengths (new, mid, maxed) and the three content windows.
- **Weekly Timetable:** everyone plays at the floor only (Even), with Desk Supplies off, so shared-seed scores compare
  fairly.
- The numbers assume the post-balance band (strikers at 90-105 % of Kage); they are re-run when the balance pass lands.

---

## 10. Rewards, Marbles, shop and long-term goals (no gem inflation)

### 10.1 Per run

| Reward | Amount | Rule |
|---|---|---|
| **Marbles** (run currency) | 2 per period cleared + 1 per assignment + 6 for a full clear, × (1 + 0.1 × (Grade − 1)), rounded | **weekly cap 150** (the Trial Keys reset, `gameWeekNumber`). A Grade 1 Half Day clear pays ~32, so ~5 runs fill the week. Past the cap a run still scores and fills the Yearbook. Never sold, never bought, never turned into gems. |
| **Lunchbox** | **3 a week**; opened at the run's end and **filled by periods cleared** (1/7 of a box per period; a Half Day clear fills one; a Full Day opens at most one full box) | Study Guides (the 500 EXP book) and family materials; a gear box from Summer Term up. A full box is worth at most **4 minutes** of that window's Hard campaign per-minute material pay. |
| **Coins** | per wave cleared, **60 %** of the per-wave pay of the furthest cleared campaign stage in the window (`soloWaveCoins`, `src/systems/freeplayRewards.js`) | capped at 150 waves' worth a week. Run waves last as long as campaign waves (~26 s), so the freeplay rule (pay under normal play per minute) needs the 60 %. With a full box worth ≤ 4 minutes per ~16-minute Half Day, the mode pays about 60 % of the campaign's coins and at most a quarter of its materials per minute. |
| **Gems** | **none per run** | |
| **Merit Stamps** (when built) | first clears of Grades 4, 8 and 12 | the owner's "harder modes give Merit Stamps" rule |

**Entry is free.** There is no energy today; if energy ships, only opening a Lunchbox may cost it. Tries, Erasers,
passes and power are never sold for gems (`SCREEN_IDEAS.md` §4).

### 10.2 One-time gems, counted

A 12-row achievement wave (ids `a_try_*`, frozen at ship; titles and ribbons derived by `src/systems/honors.js`):

| Row | Goal | Reward |
|---|---|---|
| School's Out | clear a Half Day | 20 gems |
| Full Day's Work | clear a Full Day | 30 gems |
| Spotless Day | win a run with no hearts lost and no Make-up Test | 40 gems |
| Every Box Ticked | clear all 3 assignments in 5 periods of one run | 30 gems |
| Daredevil | finish 10 Double Dare periods | 20 gems |
| Open Tryouts | see all 29 students try out across runs | 40 gems + title *Head Scout* |
| Top Marks | take an LR Pep Talk | 20 gems |
| Window Watcher | clear By the Window 20 times | 20 gems |
| Hall Pass Pro | make 50 Hall Pass moves | 20 gems |
| Grade 4 | clear Grade 4 | 30 gems + plain ribbon |
| Grade 8 | clear Grade 8 | 40 gems + shiny ribbon |
| Grade 12 | clear Grade 12 | 50 gems + special ribbon + title *Grade 12 Sensei* |

A run that has turned into practice (§12.3) counts for none of these rows and for no Grade clear.

**Total: 360 gems, once** = 3 recruits at 120 gems (`costSingle`, `src/data/types.js:286`). It joins the one-time sources
(≈ 316 recruits → ≈ 319). The 28-day free-player chart (6,800 gems + 20 tickets ≈ **76.7 recruits**,
`tests/systems/missions.test.js`) **does not move**, and the test stays pinned. Grade first clears pay 10 Marbles each
(outside the cap), never gems.

### 10.3 The Marble Jar (shop between runs)

| Shelf | Items | Price |
|---|---|---|
| **Desk Supplies** (small perks; each can be switched off; always off in the Weekly) | Spare Eraser (+1 Eraser), Bigger Draft (7 candidates at Before Class), Pencil Money (+100 start coins), Extra Pocket (hold up to 6 passes) | 60-120 each, once |
| **Cosmetics** | Window Seat chalk colours ×4; Class Photo backdrops ×4 (classroom, rooftop, sakura gate, festival night); profile frame **Blackboard Bloom** (frame steps 1-4 only, never Nightglass or the rainbow); a lobby pennant | 30-150 |
| **Materials** | Study Guide bundle (3 a week), family material pack (2 a week) | priced below the campaign's per-minute material rate |

About 1,100 Marbles of content: roughly 8 weeks at the cap, a long-term goal without power creep.

### 10.4 Long-term goals

- **Grades 1-12** with titles and ribbons.
- **The Yearbook:** a page per girl (her portrait stamped the first time she tries out: pencil if unowned, colour if
  owned), every Pep Talk seen and taken, every boss beaten, best scores per map and Grade. Each 10 stamps give 5 Marbles
  once (outside the cap).
- **Weekly Timetable:** one shared seed a week at Grade 5 rules (opens after a Grade 4 clear), everyone at the floor,
  Desk Supplies off; the first clear each week pays a 30-Marble chest (inside the cap) and a Yearbook stamp; local best
  only in v1.
- **Share codes and "Replay this seed"** from the Class Photo start a **practice run**: no Marbles, no Lunchbox, no
  records, no achievements, so a known-good seed can't be farmed.

---

## 11. Co-op

**Co-op ships with solo at launch** (owner, Oct 28; §16 re-plan). Every choice is a sim command from day one, and the
per-owner counters are in the Sim from M1 (solo reads owner 0). M1 builds the co-op seams this mode needs alongside solo:
personal coins through `ownerCash`, the start message's `pool` and the checkpoint's `squads` (§12.2), the timeouts and a
plain room option; M3 gives the room its Ink & Paper panels.

| Topic | Rule |
|---|---|
| **Squads** | Each player drafts 3 of their own 6 and grows to 5 types (inside `LOADOUT_MAX` 6 with the hero). Before Class happens in the room; both tap Ready. |
| **Shared** | hearts, enemy HP ×1.6 (`coopStage`) with a co-op factor tuned by the bot, the timetable, Window Seats (4; the first to sit keeps one, stored holders, §6.2), Board cards (Nurse's Office heals the shared hearts; Spare Pass gives each player +1; Sunny Window lifts every seat), Double Dare (only if both tap). |
| **Personal** | picks: **each player picks from their own 3 cards at the same time** (streams keyed by slot), so nobody waits for a partner's turn and nothing can deadlock. Everyone, Group and Personal cards touch only your own girls. Erasers, Hand it in later (coins to your wallet), Hall Passes (3 each, own girls only), Snack or Brush Up. |
| **Assignments** | slots 1 and 2 are team assignments; slot 3 is drawn per player from the assignments the Sim can judge per owner (Tight Budget, Small Class, Quick Learner, No Returns, Big Finish, Star Pupil, Show Her Around, By the Window, Team Effort), read from the per-owner counters and owner-filtered damage (§3.1). Save It Up is solo only. Each player's credits = team cleared + own slot 3 + Double Dare + own banked hand-in, so each player's rarity roll is their own. |
| **Coins** | shared income (wave bonus, bounties, the period-end bonus) is split as today (`stepSim`). Personal coins (Hand it in later, Snack Fund's per-wave pay) go through `sim._gainCashFor(owner, n)` (`Sim.js:400`) into `sim.ownerCash`, which the command layer moves into that player's wallet after every command and step. That flush ships with the abilities sim (COOP 9, `flushOwnerCash` in `feature/abilities` `commands.js`), which this mode already waits for (Q12). Cards and assignments that would read a wallet inside the Sim (Rainy-Day Fund, Save It Up) are solo only. |
| **Subject choice** | alternates by period (period number mod 2 → slot); the other player taps an option to suggest it (a room message outside lockstep). |
| **Team cards and caps** | a team-wide one-of-a-kind card (Sunny Window, Golden Chalk) is offered only while no player holds it; two players taking it on one tick resolve in command order, and the second gets Big Breakfast at that rarity. Spare Change stacks across players. The LR cap counts per player; a card's Hall Pass drawback costs its taker's passes. Tight Budget's bar is the team's last-period income ÷ players. |
| **Windows** | while a pick or break is open, `wave` and `auto` are refused. **Timeout: 5400 lockstep ticks (90 s at 1×; ticks run faster at 2× and 3×), counted per player and per window** (a pick and the break after it each get the whole timeout; M1 review) (the tick counter runs between waves, `commands.js:305`): an unresolved pick hands in for coins, an unresolved break becomes Ready. A player marked `gone` (`MARKERS`, `commands.js:64`) resolves at once the same way, and every later window of theirs resolves as it opens while they stay gone (the marker is mirrored into `sim.tryout`); their girls keep fighting. A Subject choice whose chooser is gone or times out takes the first Subject; a Double Dare needs both taps, so it stays off. |
| **Commands** | one kind **`tr[op, a, b, c]`** (ops: pick card + path, Eraser, hand in, Double Dare, Subject, Snack or Brush Up, Ready) and **`mv[uid, qx, qy]`** (a Hall Pass move, owner-only, quantised to 1/1024 like `hmv`). `KINDS` grows by two, arity stays ≤ 4 (`isValidCmd`, `commands.js:72`). Every op carries the open offer's sequence number and is validated **in the Sim** at its tick; a stale or wrong one is a no-op with a reason. |
| **Start message** | `{ tryout: { seed, grade, length, mapId, tableVersion }, players: [{ hero, draft, pool }] }`. `pool` holds the player's frozen account stats for **every student they own** (≤ 29 entries, each clamped by the `statLimits.js` plausibility clamp; Loaners need no entry, the floor comes from the table), so a girl who joins mid-run always has an entry every client can resolve. The loadout field stays the draft, inside `LOADOUT_MAX`. |
| **Checkpoints** | period ends are wave ends, so the existing wave-end checkpoint holds the open offers and run state (the generic snapshot saves every own field except `REBUILT`, `src/sim/snapshot.js:44`). The envelope beside `wallets` and `owners` gains `squads` (each player's girl ids in join order) and `period`, so a fresh client rebuilds every loadout entry **before** `sim.restore` (§12.2). |
| **Rewards** | each player banks Marbles and Lunchboxes into their own save under their own weekly caps (`src/online/coop/rewards.js`). Grade first-clear Marbles and medals are solo only, as today. |
| **Not in co-op v1** | **Continue** (co-op battles never battle-save) and the Make-up Test. A player who leaves is gone; the other can finish. |
| **Version gate** | `COOP_PROTOCOL` **10** (abilities take 9), or folded into a later train's single bump, with a history line in `version.js`; the `TRYOUT` table joins `coopVersion()`'s data hash (`version.js:66`). Display text lives outside hashed files. |

---

## 12. Save and Continue

### 12.1 One run, its own slot

- One run at a time in its own slot **`tryout`**, outside the 5-save cap (`MAX_BATTLE_SAVES`, `src/systems/battleSave.js:42`).
  `isSavableRun` (`:70`) returns true for a solo `req.tryout`.
- Writes: the existing ones (every wave start, `persistCalm` at every wave end, hide or leave) plus every run command
  (§8.6).
- Closing the tab during a pick or a break reopens the same sheet (the offer is in state). Closing mid-wave restarts that
  wave with the same enemies and luck, as every battle save does, and spends the Make-up Test (§12.3).
- Record kind `tryout`; config `{ seed, grade, length, mapId, tableVersion, hero, pool, squad, period }` plus the run
  guards `{ waveOpen, makeUpUsed, resumes, practice }` (§12.3). `pool` = the frozen account stats of every owned student
  (taken at New Run, as a battle save freezes the team), `squad` = the girl ids in join order, `period` = the current
  period; `squad` and `period` are rewritten by saves the run already makes (every run command, every wave start). Size:
  the pool (≤ 29 small stat objects, ~4 KB), ~12 cards, counters, baselines, the open offer, 7-12 period scores: about
  7 KB, plus the generic battle snapshot the record stores (M0 review): measured 23-74 KB at waves 8-27.

### 12.2 The restore contract (both paths)

The snapshot can't carry the squad. `loadout`, `stage` and friends are **REBUILT** by the constructor
(`src/sim/snapshot.js:44`); each girl's `t.unitStats` is stored as a reference into the restoring side's config
(`['cfg', …]`, "a reference into the start message", `lockstep.js:107`), and `resolveData` throws `[snapshot] no game
data` when that entry is missing (`snapshot.js:121`). A girl who joined at a pick is in no start message, and run state
lives inside the very snapshot that would fail. So the squad and the frozen stats travel **outside** the snapshot, and
the loadout is rebuilt **before** `restore`:

**M0 review (blocker):** today's solo battle save does not use `sim.restore`; it replays placements and upgrades
(`src/ui/battle/snapshot.js` `restoreSim`), which would fire every run hook again (counters, vouchers, refills, seat
claims) and refuses any stage id outside `STAGE_MAP`. A **Tryout Day save therefore stores the generic Sim snapshot**
(`sim.snapshot(config)`, `src/sim/snapshot.js`, the format co-op checkpoints use) in its record, and Continue takes a
`tryout` branch before the `STAGE_MAP` check: build the stage from the plan, build the Sim with the record's squads and
period (the constructor fills the loadouts, step 2), then `sim.restore`. Nothing is replayed.

| Step | Solo Continue (the `tryout` branch of `restoreSim`, `src/ui/battle/snapshot.js`) | Co-op resync or rejoin (`restore(snap)`, `commands.js`) |
|---|---|---|
| 1. Stage | `buildTryoutStage(plan)` from the record's run config | the same, from the start message |
| 2. Loadout, **before** restore | `new Sim({ …, options: { tryout: { …, pools: [record.pool], squads: [record.squad], period: record.period } } })`: the constructor's `tryoutLoadouts` puts `bandStats(pool[id] ?? LOANER, runLevelOf(period))` into `sim.loadout` | for each player i and each id in `snap.squads[i]`: the same into `views[i].loadout` (`tryoutLoadouts` on the fresh CoopSim's Sim); then `view(viewSlot)` |
| 3. Restore | `sim.restore(record.snap, simConfig(sim))`: every `['cfg', …]` path resolves | `withDetMath(() => sim.restore(snap.sim, config()))` |
| 4. `tryoutRestore(sim)` | the rule (`tryoutRuleDef` → `createRuleRuntime`, `_bountyAdd`, `rebuildRuleTables`, `assignSeats` with the seat clamp), `maxLives`, `t.runMods` per tower, `_refreshTower` each, `recomputeBuffs` once | the same |
| 5. Check | — | `rederiveStats` (`lockstep.js:121`) finds each girl's stored stats equal to her rebuilt entry, so an honest checkpoint is left exactly as it is |

`bandStats` is a pure function of the frozen stats and the period, so step 2 gives the same numbers the Sim wrote in
place at that period's start. Round-trip tests: Continue and co-op rejoin **after a mid-run join** (a Tryout pick, a
Wild girl, Whole Class Turns Up), mid-pick, mid-break (after 2 of 3 moves), after a Varsity, after a Brush Up, after
Spare Change.

### 12.3 Quitting mid-wave

A battle save holds the battle at the start of the wave in progress (`src/systems/battleSave.js` header), and
`docs/BATTLE_SAVE.md` allows retrying that wave. Unguarded, a player about to lose could quit and Continue as often as
they like, and retry Speed Round or Quick Answer for credits. The run counts it:

- **`waveOpen`.** The save written at every wave start records `waveOpen: n`; the calm save at that wave's end clears
  it. A Continue that finds `waveOpen` set is a **mid-wave resume**: `resumes` goes up by one and is written **before**
  the battle restarts, so quitting again can't reset it.
- **First mid-wave resume: the Make-up Test.** If the Make-up Test is unused, it is spent now (the hub's Continue band
  says so before the tap: "Continue · wave 14 · uses your Make-up Test"). The wave replays from its start; the period is
  resumed and **all its assignments are void**, so a replay can't buy rarity.
- **Any later mid-wave resume: practice.** If the Make-up Test is already spent (by an earlier resume or at 0 hearts),
  the run goes on as a **practice run** (the repo's meaning: it records nothing): no further Marbles, Lunchbox or coins,
  no Grade clear, no achievements, no records. Periods banked before stay paid (§12.4). The run stays playable to the end.
- **Calm-point quits are free.** Closing during a pick, a break or between waves loses nothing: the save is at a calm
  point, so there is nothing to retry.
- **An honest killed tab** costs the Make-up Test once, never the run; a phone killed twice in one run plays on as
  practice. The hub explains this in one line. Q14 offers a gentler rule.

Co-op has no battle save, so none of this applies there in v1.

### 12.4 Paid exactly once

Marbles, coins and the Lunchbox are a pending ledger inside run state, banked per period. They are paid at the run's end
(win, Early Dismissal, abandon, or a forced close) by `applyTryoutResult` → `saver.finish()` → commit in one synchronous
write that also deletes the save (the `applyBattleResult` pattern, `src/systems/rewards.js:180`). Not the solo freeplay
in-memory ledger (CONTEXT C3). Crash tests at each write.

### 12.5 Updates mid-run

The record carries `tableVersion` (`tryoutTableVersion()`: a hash of `TRYOUT`, `PEP_CARDS` and the student list) and the sim id. On a mismatch the open run is **closed
and paid for the periods it cleared**, with a toast that says so. An open offer can never point at a card that no longer
exists, because the run closes first. Wording fixes (text files) never close a run.

---

## 13. UI screens

Menus use the UI v2 Ink & Paper kit on the day surface (`src/ui/styles/ink.css`, `src/ui/kit.js`: `.ui-panel`,
`.ui-btn`, `.ui-chip`, `.ui-cd`, `.ui-host`, `.ui-sheet`, `.ui-srail`, `.ui-girltile`); in-battle pieces follow the
battle HUD of the abilities track (A3 M4). All at 844 × 390 and 1280 × 720 with no horizontal scroll, 12 px minimum
(cssFloor), one primary action per card, a MORE sticker for details, line icons (`src/ui/lineGlyphs.js`, credit line
on ship), Reduce Motion holding every animation still.

### 13.1 Frames: cards get their own ladder, girls keep theirs

| Rarity | **Pep Talk card ("Stationery")** | **Girl card (her real unit frame)** |
|---|---|---|
| R | step 1 flat: paper card, `--rar-r` 2 px border | flat |
| SR | step 2 tinted: `--rar-sr` 3 px border, 12 % tint | tinted |
| SSR | step 3 glow: inner white line, 8 px `--rar-ssr` glow | glow |
| UR | **step 4 metal: gold foil gradient, one glint on reveal. No rainbow.** | rainbow (an awakened SSR at ★5, `ur.css`) |
| LR | **Pressed Blossom:** a laminated navy card face with a pressed sakura and a gold-leaf corner. **No Nightglass edge, comet or twin-star crest.** | Nightglass (LR units only) |

- Labels are always navy `--plate` pills with rarity-coloured letters, the same five letters the owner likes; never
  white text on a rarity fill (`UI_DIRECTION.md` §5.6).
- Rarity colour appears only on frames and labels, never on names or numbers.
- A "UR card" therefore never looks like a UR girl, and Nightglass stays exclusive to LR units. (Q4.)

### 13.2 Hub (`#/tryout`, the UI M5 hub pattern)

Host girl **Wakaba**, the track team manager with her clipboard (she runs the tryouts). Pieces: a Continue band
(P4 · wave 14 · ♥ 86 · squad portraits; "uses your Make-up Test" when the save is mid-wave, §12.3) or Start (Half Day / Full Day); a Grade stepper with each Grade's twist line; the
Weekly Timetable tile with a `.ui-cd` countdown; Marble Jar; Yearbook; Records. Marbles sit in the top-bar wallet
(`src/ui/wallets.js`). States: locked (before 2-5, "Clear 2-5 to open"), fresh, run in progress, weekly done.

### 13.3 Before Class

Left: 2 map cards (thumbnail, theme, roads). Middle: the 6 draft tiles (`.ui-girltile` in unit frames, role chip,
attack-type glyph, "Yours · band cap" or "Loaner"), tap 3; **Redraw (1)**. Right: the hero picker. Top: the timetable
strip with the Final boss portrait. Primary: **Start class** (yellow). States: fewer than 3 picked (Start disabled with
the reason), redraw used.

### 13.4 The timetable strip (run map and progress)

Cells P1 … Final with breaks between. A period cell shows its two Subject glyphs (or the chosen one), the Back Gate mark
⟲ for History, an affix dot from Grade 8, and after play its 3 assignment dots (stamp or strike). States: done, current
(navy plate, yellow ring), upcoming (outline), Double Dare flag. In battle it shrinks to a thin band:
"P3 · wave 2/4 · Science". Tap a cell for its preview (families, traits, boss).

### 13.5 Assignment tracker (battle HUD)

Three chips under the hearts: line icon, short label, live progress ("♥ 0 lost", "Score 1,240 / 1,800",
"Kage 31 % / 35 %"). States: **open ring** (in play), **sakura stamp** (locked in), **ink strike, grey** (failed; never
red), "resumed" tag. Under them: "Next pick: SR 62 · SSR 31 · UR 6 · LR 1". On phones the chips fold into one pill,
"Assignments 2/3"; tap to expand. Buy and sell buttons carry "breaks Tight Budget" / "breaks No Returns" notes.

### 13.6 Period-end sheet (one screen)

Top band: the stamps (1.5 s, tap to skip), then "3 credits → **SSR**", the reason line and the Teacher's Note pips.
Middle: three cards in their Stationery frames, Team · One girl · Wild; each card has its target chip or portrait, name,
one-line effect with the number in bold, and the cap bar. Bottom: **Eraser (2)**, **Hand it in later (+490 · next pick
+1)** (Grade 2 after P4: (150 + 50 × 4) × 1.4), MORE (odds table and caps). Right column: the next period's two Subjects, each with its 3 assignments, and the
Double Dare toggle naming its curse. Flow: tap a card (it lifts, "Taken") → tap a Subject to start. Reduce Motion: the
cards appear without the paper-envelope reveal. Co-op: a chip "Partner: choosing… / ✓".

### 13.7 Girl card and Tryout pick

Three girl cards in their own unit frames: portrait, name, role and type chips, power line, arrival package, coverage
reason. **Take** puts her ghost on the board (`BattleRenderer.setGhost / showTileHints`) with the path buttons for her
free tiers; "Place later" keeps the voucher. A Varsity card shows a small pennant.

### 13.8 Break mode

Banner "RECESS · Seat Change · Hall Passes ●●●○○". The board dims; your girls glow; the old seats fade and the new ones
show dashed with desk glyphs and holder chips. The scout card for the next block sits on the right. Tap a girl (she lifts,
range ring) → tap a spot (ghost green or red with the reason) → she walks over; a chair badge marks moved girls and an
Undo button takes back the last move. Then Snack or Brush Up, and **Back to class** (yellow). A moved girl leaves a short chalk footprint
trail, held still under Reduce Motion.

### 13.9 Class Photo (summary)

The squad posed as a class photo in two rows, the hero standing at the side as the teacher, Loaners with a small tag,
Varsity girls with a pennant. Run Score and best; the periods × 3 stamp grid next to each pick's rarity; the Pep Talks
taken; Marbles (+32 · 96 / 150 this week), the Lunchbox, new Yearbook stamps. Buttons: **Again** (yellow), Hub, Replay
this seed (practice). A defeat is titled **Early Dismissal** with the periods reached, the same layout; defeat is shown
by absence, never by injury. A run that turned into practice wears a small "Practice" ribbon and shows no rewards.

### 13.10 Marble Jar, Yearbook, co-op room

Left-rail lists (`.ui-srail`) with page progress; Yearbook girl pages in pencil or colour. The co-op room
(`src/ui/screens/coop.js`) gets a Tryout Day option, a Before Class panel per player, and the Ready row.

Display text lives in `src/ui/text/tryout.js`, never in hashed data, so a wording fix never forces a co-op update.

---

## 14. Code changes by file

### 14.1 Sim (`src/sim/tryout/*`, all inside the sim id)

| File | What |
|---|---|
| `index.js` | `createTryout(sim, cfg)` → `sim.tryout` (plain data); `tryoutCommand(sim, slot, op, args)` → `{ ok, reason }`, never throws; `tryoutRestore(sim)` (§12.2) |
| `plan.js` | `buildTryoutPlan(seed, grade, length, mapId)` (Subject pairs, families per block, seats per block, minibosses, boss) and `buildTryoutStage(plan)`. Pure. |
| `power.js` | the floor, the band, `bandStats(acct, level)` (§9.2) |
| `offers.js` | rarity roll, Teacher's Note, cards with filters, girls with coverage, Erasers, hand-in |
| `pep.js` | card effects → one ModSet per girl type and player (`t.runMods`) with caps; run hooks (coins, hearts, passes, seats) |
| `assign.js` | 17 assignments: draw filters, baseline, per-owner counters `ctr[owner]`, pure `assignProgress(sim)` for the HUD, period-end evaluation |
| `score.js` | kill and leak points, best possible |
| `rule.js` | `tryoutRuleDef(sim)` and its install |
| `breaks.js` | Seat Change, `assignSeats` (stored holders, students only, §6.2) with the seat clamp (§4.4), `canMoveGirl` / `moveGirl` (→ `_relocate` + the §6.4 table), the Undo stack, Snack or Brush Up, Ready |

**Hooks in existing files**, each behind `if (this.tryout)` so a battle without a run stays bit-identical:

- `Sim.js` constructor: `options.tryout` → `this.tryout`; `maxLives` / `lives` from the run (`:139`); `_pathsRev` when the
  plan has History (`:98`).
- `startNextWave` (`:753`): refuse while a window is open; at a period's first wave install the rule, store the baseline,
  set the Double Dare affix.
- `_checkWaveEnd` (`:779`): after `ruleWaveClear`, `tryoutWaveEnd(this)`: evaluate, score, bank, period bonus, open the
  pick or break, `_autoTimer = -1`.
- `_killEnemy` (`:642`) and `_leak` (`:713`): score; Sky Guard and Quick Answer counters.
- `spawnEnemy` (`:431`): Double Dare and Grade affixes via `applySpawnMods`; Hundred Points HP.
- `placeCost` (`:887`), `placeTower` (`:969`), `_upgradeCost` (`:1094`), `sellTower` (`:1171`): vouchers, Scholarship,
  Varsity, Free Refills, and the per-owner counters (`placed`, `spent`, `upgrades`, `sells` by `t.owner ?? 0`); the ult
  path bumps `ults`. Personal coins use the existing `_gainCashFor` (`:400`).
- `result()` (`:1628`): a `tryout` block (assignments, scores, banked ledger).
- `src/sim/towers.js` `towerResolvedStats` (`:147`): `extra: [t.abilMods, t.runMods]` with nulls dropped (identical when
  both are null); `recomputeBuffs` (`:331`): Desk Partners and Quiet Corner inside the dirty pass.
- `src/sim/rules.js` `assignPads` (`:283`): one guarded line, `if (sim.tryout) return assignSeats(sim)`. The run's
  assigner keeps stored holders, skips heroes and applies the seat clamp; a battle without a run keeps the lowest-uid
  rule bit for bit.
- **Unchanged:** `waves.js`, `finalTier.js`. `mods.js` gains exactly one key, the additive `crit.mulAdd` (Hot Streak's
  crit damage; §16.1); the scaling cards carry run keys that `pep.js` sums, caps and turns into existing ModSet keys,
  and the Hidden Talents carry raw ModSets (`src/data/tryout.js` header, `RUN_KEYS`).

### 14.2 Data and text

- `src/data/tryout.js` (numbers only): lengths and timetables, Run Levels, the band, odds tables, Teacher's Note, Grades
  and windows, Subjects → rule ids, map pools, assignment parameters, card numbers and ModSets, caps, arrival packages,
  Varsity, score points, Marbles. Joins `coopVersion()`'s data hash (`src/online/coop/version.js:66`).
- `src/ui/text/tryout.js`: every name and description.

### 14.3 Systems, setup and save

- `src/systems/tryoutRuns.js`: New Run (seed, draft candidates, frozen account stats), the weekly seed, share codes,
  records, the Yearbook.
- `src/systems/tryoutRewards.js`: `applyTryoutResult`, the Marble cap, Lunchbox keys (counters beside `tk:left`), the
  coin cap, Grade first clears, Merit Stamps hook.
- `src/systems/battleSave.js`: the `tryout` slot outside `MAX_BATTLE_SAVES`; the `isSavableRun` branch; the run guards
  (`waveOpen`, `resumes`, `makeUpUsed`, `practice`) in the record, set by `src/ui/battle/battleSaver.js` at wave start
  and wave end and checked on Continue before the battle restarts (§12.3).
- `src/ui/battle/setup.js`: a `req.tryout` branch (stage from the plan, loadout from the record, `options.tryout`).
- `src/ui/battle/snapshot.js`: classify `tryout: 'snap'`, and `_tryoutCfg`, `_loadouts`, `viewOwner: 'config'` (all
  three are in the Sim snapshot's `REBUILT`) in `KNOWN_SIM_KEYS`; `runMods: 'derived'`, `gift: 'snap'` and `tyAt: 'snap'`
  (an enemy's arrival tick for Quick Answer) where the key guards list tower and enemy keys; the `tryout` branch of
  `restoreSim` that restores the stored generic snapshot (§12.2), then calls `tryoutRestore`.
- `src/systems/rewards.js`: dispatch to `applyTryoutResult`. Achievements: `src/data/achievements.js` (wave `tryout`),
  `src/systems/achievementCounters.js`, `achievementMetrics.js`, `honors.js`; the frozen ledger gains the rows.

### 14.4 Co-op

- `src/online/coop/commands.js`: a `start.tryout` branch in `createCoopSim` (the stage from `buildTryoutStage(plan, {
  coop: true })`, never `coopStage`, which knows no `tryout:` id; the Sim built with each player's `pool`, `draft` and
  hero; `views[i].loadout` = the Sim's `_loadouts[i]`); `view(slot)` also sets `sim.viewOwner`; the `gone` / `join`
  markers also call `tryoutGone` so a later window of a player still gone resolves at once (§11); `KINDS` += `tr`, `mv`; `isValidCmd` arity; `stepSim` cases with `views[slot]`;
  `view(slot)` exposes the player's run state; `snapshot()` adds `squads` and `period` to the envelope, and `restore(snap)`
  rebuilds `views[i].loadout` from the start message's `pool` before `sim.restore` (§12.2); a join adds her entry to
  `views[slot].loadout` from the pool; personal coins through `ownerCash` (§11); window gating and the tick timeout.
- `src/online/coop/session.js`: the room carries the run settings (`tryout: { seed, grade, length, mapId }`, the host's)
  and every hello and ready carries the player's `pool` and `draft` (3 ids) besides the hero; the start message is built
  from them (§11). `src/online/coop/simHash.js`: `hashSim` also folds in a compact digest of `sim.tryout` (offers, cards,
  credits, counters, seat holders, score), so a desync in run state is caught at the next hash, not only once a tower
  differs.
- `src/online/coop/statLimits.js`: `clampStart` clamps each `pool` entry like a loadout entry; the pool is not a loadout,
  so `LOADOUT_MAX` doesn't apply to it (at most 29 entries).
- `src/online/coop/lockstep.js`: restore order (`tryoutRestore` before the stats check).
- `src/online/coop/version.js`: `COOP_PROTOCOL` bump with a history line; `TRYOUT` in the data hash.
- `src/online/coop/rewards.js`: a `tryout` branch. `src/ui/screens/coop.js`: room option and panels.

### 14.5 UI

`src/ui/screens/tryout.js` (hub), `tryoutSetup.js` (Before Class), `yearbook.js`, `marbleJar.js`;
`src/ui/battle/tryout/` (`timetable.js`, `tracker.js`, `periodEnd.js`, `girlCard.js`, `breakMode.js`, `classPhoto.js`);
the seat view reuses the renderer's pad view with a chalk skin and dashed next seats; card frame tokens `--pep-*` and
`.ty-card` in `ink.css`; new line glyphs in `src/ui/lineGlyphs.js`; Marbles in `src/ui/wallets.js`.

---

## 15. Tests and the determinism plan

| Area | Test |
|---|---|
| **Bit-identical guard** | a golden hash over every existing stage (waves 1..N, route orientation) and a fixed command log on 6 stages, Prism Conduits included, before and after the change: a battle without `options.tryout` hashes the same. |
| **Offers** | rebuilt from the seed, the history and the wave-end snapshot equals the stored offer; a reload never rerolls; an Eraser never changes the rarity, and its fallback when no new set exists; last-pick filters (no next-pick cards; Hand it in later pays coins only); Whole Class Turns Up needs an open spot; property test that every offered card has a valid target and is under its caps. |
| **Odds** | the table and Teacher's Note in the Sim match `tryout-odds.mjs` within 0.5 points over 100,000 seeded picks. |
| **Assignments** | pass and fail cases for each of the 17; Full Hearts fails on a leak even with Home Ec healing; Star Pupil and Guest Lecture filters. |
| **Score** | children score 0; a leak −2 × pts; best possible from the spawn list. |
| **Caps and band** | folding, cap bars, families dropping out; drawbacks subtract after the cap; the band clamp per key; the seat cap (+50 %) and the cards × seat clamp (×2.5) for every seat card mix (Sunny Window SR and SSR, Golden Chalk, Art Class); Sunny Window never offered twice; the ceiling (damage ≤ 7.5, rate ≤ 2.25 before kit effects). |
| **Hit DPS bench** | `tools/bench.mjs --hit` for every girl and Hidden Talent at the run ceiling on a seat: ≤ the same girl maxed on a Prism Conduits pad and ≤ 2.5M × 1.25 (an M2 gate). |
| **Breaks** | legality refusals; the Undo stack (two moves of one girl, then back to her start refunds both); seats students-only; stored holders (a moved girl with an older uid never takes a held seat; a co-op partner's girl never takes yours); one test per kit for §6.4: Suzu, Azami, Yuzuha, Ouka, Iroha, Chika, Ruri. |
| **Vouchers** | the gift never sells for coins; arrival tiers respect crosspath and the path cap. |
| **Save** | key-guard classification; the §12.2 round trips, **Continue after a mid-run join** included; mid-wave resume: the first spends the Make-up Test and voids the period's assignments, the second makes the run practice (no Marbles, no Grade clear, no achievements), a calm-point quit costs nothing, `resumes` is written before the restart; pay-once with induced crashes at each write; a `tableVersion` change closes and pays; the share code round trip (8 characters, check bits). |
| **Co-op** | command validation (owner, window, sequence); the tick timeout; `gone` auto-resolve; personal offers per slot; **rejoin and resync after a mid-run join** (start-message `pool` + checkpoint `squads`); per-owner counters judge slot 3 per player; personal coins reach the right wallet; a cross-engine hash with picks, moves and a Subject choice (`e2e/engines.mjs`). |
| **Performance** | `tests/sim/perf.*`: no per-step growth with a full card load and a 40-girl board; a Full Day at wave 48 (trim the wave cache as freeplay does, `Sim.js:760`; measure checkpoint size and renderer cost). |

**The bot:** `tools/tryoutBot.mjs` runs `headless.autoPlan` plus pick policies (random-legal, greedy-damage,
coverage-first) and simple Hall Pass logic (move the lowest-value girl onto the newest seat), 500 seeds per Grade, at
three roster strengths. It reports win rates against the §7 targets, assignment clear rates (target 50-60 % at Grade 1),
rarity mixes (checks §3.4 against real play), and DPS against the ceiling.

Determinism rules hold throughout: every draw from a named stream; integer clocks and scores; quantised coordinates;
nothing outside `withDetMath` in co-op.

---

## 16. Milestones

**Re-planned at M0 (Oct 28, 2026) for co-op at launch** (the owner: "It has to be multiplayer too!!"). The old M5 is
folded in: every milestone builds solo and 2-player co-op together, and from M1 on every sim feature has a **two-view
lockstep test** (two CoopSims fed the same command log, digests compared at every wave end) next to its solo test. The
build branch is `feature/tryout-day` (from `feature/abilities`, for `ownerCash` and the per-owner coin flush); it merges
`origin/feature/abilities` between milestones, **never bumps `COOP_PROTOCOL`** (the mode ships later in one release with
its own bump) and records the sim id at the end of each milestone.

| M | Content | Gate |
|---|---|---|
| **M0** | Spec gate: owner answers (all defaults, Q7 changed), this re-plan, the data table draft (`src/data/tryout.js`), the M0 build notes below, an independent spec review and its fixes. | review fixed |
| **M1** | **The first fun slice, solo and co-op.** Half Day on the 4 Spring Term maps (Grade 1); the generated stage; 7 periods; Full Hearts + slot 2 from {Ace the Test, Speed Round, Quick Answer} + slot 3 from {Tight Budget, No Returns, Small Class, Quick Learner} (co-op: slot 3 per player); the integer score; the odds table and Teacher's Note; Eraser and Hand it in later; the 20 M1 Pep Talks (Everyone, Personal, Board) through `t.runMods` with caps; the Tryout pick with the band and Loaners (vouchers at tier 0); Recess and Cleaning Time with Window Seats (stored holders, the seat clamp), Seat Change, 3 Hall Passes with Undo, Snack, Ready, and the §6.4 table; offers in run state; per-owner counters. **Co-op in the same slice:** `tr` / `mv`, personal picks (one stream per slot), the 90 s tick timeout, `gone` resolution, the start message with each player's `pool`, the checkpoint envelope's `squads` and `period` and the §12.2 restore order, personal coins through `ownerCash`. **Solo save:** the `tryout` slot, the restore contract and the mid-wave rule. Plain UI on today's HUD (pick sheet, tracker chips, break banner, a Tryout Day card in the co-op room); the headless bot. | two-view lockstep digests; `e2e/engines.mjs`; screenshots 844 × 390 and 1280 × 720 |
| **M2** | All 53 first-ship cards, 16 assignments, Subjects with the class choice (co-op: alternating chooser, partner suggestion) and the Back Gate, Double Dare (co-op: both tap), the coverage guarantee, arrival packages and Varsity, the Make-up Test (solo), Grades 1-6; the hit-DPS bench gate on every girl and Hidden Talent (`bench.mjs --hit`); bot sweeps at three roster strengths, solo and co-op; a playtest timing the sheets. | bench and bot gates |
| **M3** | Ink & Paper UI **after the UI v2 menus land** (merge `feature/ui-v2`, build with its kit): hub, Before Class (co-op: a panel per player and the Ready row in the room), timetable strip, period-end sheet (co-op partner chip), tracker states, girl cards, break mode, Class Photo, Stationery frames, text, Reduce Motion. Until UI v2 lands the plain M1 UI stays. | screenshots |
| **M4** | Meta and **ship prep only**: Marbles and the Marble Jar, Lunchbox, coin cap, Yearbook, the achievement wave (360 gems counted), Grades 7-12, Weekly Timetable, share codes, the Full Day (data + wave-48 perf check), co-op rewards (`src/online/coop/rewards.js`); go/no-go list, patch note draft, the planned `COOP_PROTOCOL` bump written down but not made. **Not shipped**: the mode goes out after the ultimates (COOP 9) and the balance pass, with the owner's yes on screenshots. | full review |

**Every milestone's review gate:** an independent reviewer (a subagent that did not build it) checks logic and look
(screenshots at 844 × 390 and 1280 × 720) and determinism (headless two-view lockstep digests and `e2e/engines.mjs`
across engines); every blocker, high and medium finding is fixed, at most 3 fix rounds. Gates: `npm test`,
`e2e/smoke.mjs`, `vite build` then `rm -rf dist`. Each milestone ends with a labelled board under
`docs/review/tryout-day/<milestone>/` and an updated draft PR.

**Later, each its own decision:** the other 17 Hidden Talents (content updates); lanes per period (with a golden-hash test on
`waves.js`); the rule-bending cards (Q10); a Full-power "Open Day" variant; a two-map "Field Day" variant that packs up
the board at 100 % of `t.spent` plus coins in hand and offers rebuild cards that send ordinary `place` and `upg`
commands, with the hero's level carried (the node map's design, kept here so it never has to be reinvented); Night Watch
on the same engine; co-op Continue and the co-op Make-up Test; 3-4 player co-op.

### 16.1 M0 build notes (decisions taken while reading the code; each is also an owner question with its default)

1. **Tenka is not a student.** The pool is the 29 students of HANDOFF §1 (`TRYOUT_STUDENTS`); Tenka, the ultimate tower,
   never tries out and is never drafted.
2. **Heroes are banded too** (the floor and the band cap apply to the hero's account stats), so the co-op partner and a
   whale's hero sit in the same band. Hikari and Nami are free for everyone; an unowned free hero plays at the floor.
3. **Hot Streak's crit damage** needs an additive crit-damage key: `crit.mulAdd` (one line in `mods.js`; `crit.mul` is a
   max today). Everything else in the 53 uses existing keys. The non-first-ship Hidden Talents' keys are drafts and are
   checked against `mods.js` before each one ships.
4. **Two Sim fields the snapshot skips** (`REBUILT`): `_loadouts` (each player's loadout map; co-op points it at its
   views, so a join or a period-start band update reaches the right player whatever the current view) and `viewOwner`
   (the viewing or commanding player, so `placeCost` can price that player's voucher and Scholarship). Both are set by
   their owner (the constructor solo, `createCoopSim` co-op), never stored.
5. **The band's other keys:** Pierce ≤ 20 hundredths, burn and poison share ≤ ×1.2, aura fill-in reach ≤ ×1.1, ult
   haste ≤ 0.1, Potential ≤ P3 (in `TRYOUT.bandCap`).
6. **Windows** for M1: one at a time per player is open (`pick`, then `break` when a break follows that pick); the next
   wave starts by the usual Start button (or Auto) once every player has resolved. Co-op counts window ticks inside the
   Sim's step, so the 90 s timeout fires on the same tick on every client.
7. **Blocks** (seats and enemy families) are the stretches between breaks: Half Day P1-P3, P4-P6, P7.
8. **M1 vouchers** arrive at tier 0 for every rarity (the R package); the tiered packages are M2 as planned.

---

## 17. Owner questions (each with a default)

| # | Question | Default if the owner says "defaults" |
|---|---|---|
| Q1 | The mode's name | **Tryout Day** (code `tryout`). Alternatives: *Long School Day*, *Full Timetable*. The owner's working title stays private: it is another game's mode name. |
| Q2 | Player power | **The band:** your girls count, raised to the run floor and capped near a Lv 60 geared girl; Loaners at the floor; the Weekly is even. Alternatives: *Even* (everyone at Run Level) or *Full power* (your own stats, ~12× spread). |
| Q3 | Default length | **Half Day (~16 min)**; Full Day (~27 min) opens after a Half Day clear. |
| Q4 | Rarity look on Pep Talk cards | **R / SR / SSR / UR / LR letters on our own Stationery frames** (UR gold foil, LR Pressed Blossom); girls keep their real frames, UR rainbow and LR Nightglass included. Alternative: put the girls' rainbow and Nightglass on cards too (breaks the house rule in `UI_DIRECTION.md` §5.6). |
| Q5 | Girls you don't own | **Yes, as Loaners** at Run Level, run only, with a link to her page after the run. |
| Q6 | The break | **3 Hall Passes per break** (carry up to 5), free, Undo refunds; Window Seats redrawn at every break; seat bonus +25 % (cards can raise it to +50 %); the first girl to sit keeps a seat. |
| Q7 | Co-op | ~~After solo (M5)~~ **Owner: required at launch** (built alongside solo from M1); each player picks their own cards; hearts, seats and Board cards shared; no co-op Continue in v1. |
| Q8 | Rewards | **0 gems per run**; Marbles (150 a week) and the Marble Jar; 3 Lunchboxes a week; 360 one-time gems from 12 achievements; Merit Stamps at Grades 4, 8, 12 once they exist. |
| Q9 | Entry and unlock | **Free, no energy; opens after 2-5.** |
| Q10 | Rule-bending cards (two final tiers on one path, a second path past tier 2, mid-wave moves, 3 girls per seat, stacking auras) | **Leave them out.** |
| Q11 | Night Watch and Field Trip (reserved ideas C08, C07) | **Keep both reserved** as later modes on the same run engine; ship this as Tryout Day. Alternative: ship this *as* Night Watch and retire C08. |
| Q12 | Build timing | **After UI v2, the abilities sim (COOP 9) and the balance pass.** |
| Q13 | Host girl | **Wakaba** (the track team manager runs tryouts). |
| Q14 | Quitting mid-wave | **The first mid-wave Continue spends the Make-up Test** (the wave replays; that period's assignments are void); **a second one turns the run into practice** (no further rewards, no Grade clear, no achievements). Quitting at a calm point is free. Alternative (gentler): every mid-wave Continue only voids that period's assignments and keeps the run out of Grade clears and achievements, but Marbles still pay. |

---

## 18. Names

Checked with `git grep -i -w -F` on `origin/main`, `origin/feature/abilities` and `origin/feature/ui-v2` (line counts
main / abilities / ui-v2), and re-run in full for revision 2: the first pass had missed Signature, Honors, Senior,
Grade and Study, which are renamed or recorded below. Every name below has **0 / 0 / 0** unless the note says otherwise:

- **Mode and run:** Tryout Day, Before Class, Final Period, Lunch Break, Cleaning Time, Class Photo, Early Dismissal,
  Half Day, Timetable, Weekly Timetable, Back Gate, Window Seat(s), Seat Change, Hall Pass(es), Pep Talk(s), Double Dare,
  Hand it in later, Teacher's Note, Exam Prep, Run Level, Varsity, Make-up Test, Period Score, Run Score, Marbles,
  Marble Jar, Lunchbox, Yearbook, Desk Supplies, Stationery, Pressed Blossom, Blackboard Bloom, squad spot, Brush Up,
  Hidden Talent(s), Spring Term, Summer Term, Autumn Term.
- **Light hits, kept:** Recess (1: a material note, "Gold recess"); Full Day (1: prose in a Halloween doc); Eraser (1: a
  Blender part); Assignments (13: an audio-tool variable); Loaner (4 / 2 plural: the same concept in `SCREEN_IDEAS.md`
  A07 and C09, consistent); Literature (1: a future girl's bio prose); Science Fair (0 / 1 / 0: a bio line); Brittle
  (the existing status, used with its own meaning); **Grade** (6 / 6 / 22: colour-grading prose such as "the night
  grade" and the UI kit's sticker kind "grades" in `UI_DIRECTION.md`; no system is called Grade, so the ladder keeps
  it); **Snack** (4: character prose, "everyone's favourite snack"); **practice run** (25: the repo's own `isPracticeRun`,
  "records nothing", used here with exactly that meaning); Talent (7: an old "talent tree" in handoff docs; used only
  inside Hidden Talent).
- **Subjects:** P.E., Festival Prep, Shop Class, Home Ec, Night Class, Geography, Winter Sports, Art Class (0); Science,
  Music, History are generic words, so ids are prefixed (`subj_science`…).
- **Assignments:** Full Hearts, Ace the Test, Speed Round, Quick Answer, Sky Guard, Guest Lecture, Tight Budget, Save It
  Up, Star Pupil, Show Her Around, No Returns, Small Class, By the Window, Team Effort, Quick Learner, Big Finish, Show and
  Tell.
- **Cards:** every name in §4.3.
- **Achievements and titles:** School's Out, Full Day's Work, Spotless Day, Every Box Ticked, Daredevil, Open Tryouts,
  Top Marks, Window Watcher, Hall Pass Pro; titles Head Scout and Grade 12 Sensei. Perks: Spare Eraser, Bigger Draft, Pencil Money, Extra
  Pocket.
- **Command kinds** `tr` and `mv` are not in `KINDS` on main or abilities (`pick` is Midori's brew pick).

**Renamed after a collision:**

| Candidate | Collided with | Used instead |
|---|---|---|
| Elective(s) | "The Elective Path" `A05` | class choice (no new name) |
| Drama (Subject) | Yoriko, Drama Club Director | Music |
| Choir | 48 hits | — |
| Astronomy (Subject) | the planned Astronomy Club gear set | Night Class |
| Coupon Book | Momo's tier | Free Refills |
| Study Buddies | the co-op achievement | Desk Partners |
| First Bell | the planned Bell Club trick | School's Out |
| Last Bell | Halloween event prose | Final Bell |
| Hall Monitor | Ouka's "Hall Monitors" tier | Spare Pass |
| Gold Foil (as a frame name) | the Gold title plate's description | described, not named |
| Pressed Blossom (as a profile frame) | the LR card frame | Blackboard Bloom |
| Hundred Points! (achievement) | the LR card | Top Marks |
| Window Seat (the lone-girl card) | the bonus spot | Quiet Corner |
| Keep Your Seat, Same Seats | "seat" overload | No Returns, Small Class |
| Exchange Student | 346 "Exchange" hits (shops) | Loaner |
| Signature(s) (the 29-card family) | Potential's P6 signature step (138 / 140 / 138: `POTENTIAL_SIGNATURE_DEFAULT`, `docs/specs/POTENTIAL.md` "P6 signature", the wiki's search keyword, the "Signature Move" achievement): the same idea under the same word | **Hidden Talent(s)** |
| Junior / Senior / Honors (content windows) | Honors (158 / 150 / 158: the shipped Honors system, `src/data/honors.js`, `src/systems/honors.js`, Honor Ribbons, the v0.1.30 "Sensei Profile & Honors" patch); Senior (4: Hikari's bio, "senior guardian"); Junior (0) renamed with them | **Spring Term, Summer Term, Autumn Term** |
| Study (the break choice) | Study Guide, Study Session, Study Buddies (115 / 114 / 118) | **Brush Up** |
| Study Hard, Spellbook Study | the same word | **Quick Learner, Library Hour** |
| Talent Scout | one meaning for "Talent" (Hidden Talent) | **Open Tryouts**, title **Head Scout** |

**One meaning per name** (the three designs disagreed): Snowball Fight = Yuki's Hidden Talent; Window Seat = the bonus spot;
Class Photo = the summary; Hall Pass = the move token; Star Pupil and Team Effort = assignments; Morning Stretch, Kite
Day, Can Opener = Everyone cards; Sharp Pencils, Science Fair, Sword Drills, Shrine Visit, Crossing Guards = Group cards;
Nurse's Office = the Board heal; Focused Mind, Polished Glass, Depth Charge = Kaede's, Iroha's and Sango's Hidden Talents;
Front Row, Golden Week and Same Seats are not used. "Seat" means only the bonus spots (Window Seat, Seat Change); squad
size is "squad spots". "Study" is used only by the existing Study Guide; "Term" only for the three content windows.

**Reserved names left alone:** Night Watch, Glowsticks, Field Trip. The achievement "Field Trip Circuit" (a freeplay row)
is unaffected. No other game's or anime's names appear in this spec. No player names; players are "they".

---

## 19. Risks

1. **One map for 16-27 minutes could feel samey.** Mitigation: Subjects with a choice every period, Seat Changes, the
   Back Gate, two maps to pick from, a seeded draft; Half Day as the default; the playtest asks about it.
2. **Moving placed students is new.** Owned objects are a fresh edge-case surface. Mitigation: the §6.4 rule as one code
   path, a test per kit, cross-engine hashes.
3. **The band may disappoint whales.** Mitigation: the head start is real (2×), kit effects come along, the Grade ladder
   is the place to flex; Full power stays an owner option.
4. **Restore paths.** Drafted girls and the per-period rule are rebuilt state. Mitigation: one `tryoutRestore`, both
   paths, round-trip tests.
5. **Content volume.** 53 cards and 17 assignments of text and glyphs. Mitigation: a 20-card M1; the other Hidden Talents
   later.
6. **Co-op windows and co-op at launch.** Mitigation: personal picks, tick timeouts, `gone` resolution; two-view lockstep
   tests and cross-engine hashes from M1 on, so co-op is never a late add-on.
7. **Schedule.** It waits on COOP 9, the balance pass and UI v2; one COOP bump lands with it.
8. **The mid-wave rule may feel harsh on phones that kill tabs.** Mitigation: calm-point quits are free, the first
   mid-wave Continue costs only the Make-up Test, the hub warns before the tap, and Q14 has a gentler rule.

---

## Appendix A. How this spec answers the judges

**Base:** the squad draft on one long battle (highest combined score). **Its problems fixed:** scope cut (no lanes, 12
Hidden Talents, no swaps, no Varsity 2, Half Day default); restore contract (§12.2); the Run Level maths inside the hash
(§9.2); save-scum (§12.3); heart assignments count `stats.leaks` (§3.1); the DPS ceiling stated with every multiplier
(§9.2); rule-bending content off (§4.6); heroes and Window Seats (§6.2); golden-hash guard (§15); economy cut to 360
one-time gems with numeric caps (§10); vouchers out of `t.spent` (§5); one cleanup rule (§6.4); co-op timeouts instead of
a host-only command (§11); `tableVersion` closes and pays (§12.5); the power question stated plainly (§9.1); girls as a
chance inside picks and a small draft (§1.3); own card frames (§13.1); names re-checked (§18); real `KNOWN_SIM_KEYS`
classes (§14.3); unique script names (Appendix B).

**From the boon run:** the integer early-kill score and its anti-farm rules; additive caps with a cap bar; achievable-only
filters; Double Dare; the live odds line, reason line and run-end grid; break Undo and the scout card; tick timeouts and
`gone`; 0 gems per run, ~360 one-time gems, the Lunchbox pattern, practice replays; the Make-up Test; content windows
matched to campaign progress; the LR cap; Desk Partners and Quiet Corner; the word Loaner.

**From the node map:** route choice with visible challenges (the Subject pair on every period-end sheet); one command kind
with an op argument plus `mv`; tracker states (ring, stamp, strike; no red); bold drawbacks on UR and LR cards; pity
pips; one screen per stop end; the weekly seed on the titans' week and share codes as practice; the Pack Up and rebuild
design kept for a later two-map variant.

**The node map's problems, where they apply:** decision load cut (§2.6); no rebuild chore (one board); difficulty matched
to the unlock (§7); the break has a purpose (Window Seats); one rule runtime merge (§2.4); co-op scopes (§11); credits
capped at 4 with sources listed (§3.4); rarity letters on non-girl cards (§13.1); name collisions (§18); the reserved
modes (Q11); scope (§16).

### A.2 Revision 2: the independent review

| Severity | Finding | Fix (where) |
|---|---|---|
| High | The Window Seat bonus had no cap or stacking rule; Art Class, Sunny Window and Golden Chalk broke the ceiling proof, and the bench read panel DPS, which leaves out `padMul` | one team-wide seat bonus capped at +50 %, written once by the run (never by a Subject); Sunny Window one of a kind; Art Class adds a seat only; cards × seat clamped at ×2.5 per girl; ceiling table with seat, Subjects and Brittle; hit-DPS bench (§2.4, §4.3, §4.4, §9.2, §9.3) |
| High | Quitting mid-wave gave unlimited retries | `waveOpen` / `resumes` in the record; the first mid-wave Continue spends the Make-up Test and voids the period's assignments, a second makes the run practice (§7, §8.6, §12.3, Q14) |
| Medium | "Next pick" cards were dead or lost their drawbacks at the last pick; Snack Fund paid nothing at some picks | filter 8 (no next-pick cards at the last pick; Hand it in later pays coins only there); Snack Fund pays over the next 8 wave clears (§4.3, §4.5, §8.4) |
| Medium | Per-player assignments and coins could not be read inside the Sim in co-op | per-owner counters `ctr[owner]` from M1; personal coins through `_gainCashFor` → `ownerCash`; wallet readers solo only (§3.1, §11) |
| Medium | Restore order could not work for girls who joined mid-run | `pool` + `squad` + `period` outside the snapshot (record, start message, checkpoint envelope); loadout rebuilt before `restore`; rejoin and Continue tests after a join (§11, §12.1, §12.2, §15) |
| Medium | Names collided (Signature, Honors, Senior, Study) or were unchecked (Junior, Grade) | Hidden Talents, Spring / Summer / Autumn Term, Brush Up, Quick Learner, Library Hour, Open Tryouts; Grade recorded (§18) |
| Medium | Owner page mock-ups unreadable at 400 px; tables clipped | fixed-width mock-ups that scroll sideways with a cue, 12 px minimum mock text, catalogue as cards on phones, odds table without the Floor column (owner page) |
| Low | Lowest-uid seats let a moved girl or a partner take a seat | stored seat holders, first to sit keeps it (§6.2) |
| Low | Mock-ups and examples contradicted the spec | odds line from a real row, Full Hearts open mid-period, +490, a Spring Term miniboss, the expert row relabelled, Raika's arrival line (§3.4, §3.5, §13, owner page) |
| Low | Smaller gaps | 8-character share code; Brittle +10 %; offers depend on the wave-end board too; Eraser fallback; drawbacks after the cap; Snack at Grade 12; the Undo stack; Whole Class Turns Up needs a spot (§4-§8) |
| Low | Lunchbox above the campaign per-minute rate | coins at 60 %; the box filled by periods cleared, worth ≤ 4 minutes (§10.1) |
| Low | The owner page headline used the working title | the page is headed Tryout Day; the working title appears once in the intro and in the browser tab title the brief asked for |

### A.3 M0: the independent review of the build plan (Oct 28)

| Severity | Finding | Fix (where) |
|---|---|---|
| Blocker | Solo Continue replays placements and refuses non-campaign stage ids, so it could not restore a run | a run save stores the generic Sim snapshot and Continue takes a `tryout` branch (§12.2, §14.3) |
| High | Card `mods` used keys `mods.js` does not have or reads differently (multiply vs add, max vs add) | two kinds of `mods`: run keys summed by `pep.js` (`RUN_KEYS`, a data test) and raw ModSets for Hidden Talents; talent keys fixed or marked `draft`; one new key, `crit.mulAdd` (§14.1, data header) |
| High | The ceiling proof left out the "vs" cards (E06 hits a boss twice) | vs caps +30 % and inside the ×2.5 run damage; the seat clamp divides by the product (§4.4) |
| High | Co-op hashes missed run state | `hashSim` folds in a `sim.tryout` digest (§14.4) |
| High | The co-op lobby and `createCoopSim` had no path for a run | `session.js` and a `start.tryout` branch in M1 scope (§14.4, §16) |
| Medium | Snapshot key lists incomplete | `REBUILT` += `_tryoutCfg`, `_loadouts`, `viewOwner`; key-guard classes (§14.3) |
| Medium | A boss leak took every heart (`leak: Infinity`, waves carry none) | the `spawnEnemy` hook sets the Grade's boss leak (§7) |
| Medium | Simultaneous co-op takes of team-wide one-of-a-kind cards; per-team or per-player caps unstated | command order, the second taker gets Big Breakfast; caps stated (§11) |
| Medium | `gone` lived only in the command layer; Subject and Dare had no timeout default | mirrored into `sim.tryout`; first Subject, Dare off (§11) |
| Medium | Tight Budget per player had no per-player income | the team's income ÷ players (§11) |
| Medium | `costMul` clamp direction | clamped to [cap, 1] (data table) |
| Medium | Window bosses from later chapters | stated as intended set pieces (§7) |
| Low | Seats before wave 1; rule defs without `active` | the run's rule is installed at construction with both `always` and `active` (§16.1) |
| Low | Festival Prep's `wave % 3` is absolute | M2 counts the period's waves for Subjects (noted for M2) |
| Low | The timeout is 90 s only at 1× | stated as ticks (§11) |
| Low | Table version was hand-bumped; the odds script kept its own copy | `tryoutTableVersion()` hashes the table; `tools/tryoutOdds.mjs` reads `src/data/tryout.js` (§12.5, Appendix B) |
| Low | Line numbers drifted | a note at the top |

## Appendix B. Check scripts

- `tools/tryoutOdds.mjs`: the §3.4 Monte Carlo (`node tools/tryoutOdds.mjs 200000`), reading its odds from
  `src/data/tryout.js`; "expert" takes every Double Dare.
- `tools/tryoutPower.mjs`: the §9 band and ceiling numbers, every seat card case and the Subject comparison
  (`node tools/tryoutPower.mjs`).
