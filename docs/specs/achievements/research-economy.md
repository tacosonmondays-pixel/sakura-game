# Achievements expansion: economy and gear box research

Scope: the owner's Oct 15 request ("more achievements … gear boxes alongside gems … ribbons … titles").
This file covers the economy side only: gem income, what gear boxes and other items are worth, a reward
budget for a new achievement set, and the update-day (retroactive) payout.

Sources: live game `/home/user/sakura-game` @ fddf01c (v0.1.27); train A `/home/user/wt-traina` HEAD 917027e
(v0.1.28, read with `git show HEAD:`); `origin/feature/codex-modes` @ 6c7e0d0; Sensei Profile SPEC.md.
Every number below comes from the code or from a script in this folder (see Appendix). Nothing in any repo was edited.

---

## TL;DR

* **Active free player income:** ≈ **243 gems + 0.71 tickets a day**, **1,700 gems + 5 tickets a week**,
  **6,800 gems + 20 tickets per 28 days**. That is **2.74 / 19.2 / 76.7 recruits**.
  A recruit costs 120 gems and a 10-pull costs 1,200 (no discount). Train A adds **100 gems per game version**
  (27 versions are already listed, so **2,700 gems** pay out on its release day).
* **The existing 30 achievements pay 7,070 gems + 8 Recruit Tickets + one 10× ticket ≈ 76.9 recruits.**
  That is about one month of active income, and 29 % of all one-time income in the live game.
* **Gear boxes** always open into one piece of their own rarity (random slot, random main stat). The only price
  in gems is the Ornate (Super Rare) box at **180 gems**. By Bounty Token price (≈ 7.2 gems per token), a box is worth
  about: Sturdy ≈ 58, Ornate 180, Radiant ≈ 576, Celestial ≈ 1,440 gems. Boxes do **not** add recruits, and late
  players can already farm them with unlimited sweeps. So **boxes are the safe bulk reward**. Gems and tickets are
  the part to keep small.
* **Budget proposal for the new set:** **≤ 6,000 gems** over the player's whole life (hard cap 7,000), plus
  **≤ 6 single Recruit Tickets** and **no 10× tickets**. That is ≈ 56 recruits, about 0.73 of a month's income.
  Pay **back-loaded** by tier: 20 / 50 / 100 / 200 gems. Boxes by tier: Sturdy (early) → Ornate (mid) →
  Radiant (late, ≤ 12 in the set) → Celestial (capstones only, ≤ 5). Never give Plain (common) boxes.
* **Update-day payout:** with the back-loaded curve, an illustrative 63-step set pays a **mid-game save ≈ 1,090 gems
  on day one** (23 achievements, < 1 week of income). The same total paid as a flat amount per step gives that
  save 2,323 gems. A late save gets ≈ 3,790 (back-loaded) vs 5,050 (flat). **Recommendation: no runtime cap.**
  Pay in full, and keep the payout bounded by the tier curve instead. The tool for checking a real candidate list is
  `retro.mjs`.
* **Constraints found in the code** (§5):
  1. Store claims only in `missions.achievements`. Older builds keep it word for word, so no `ach:` mirror is needed.
  2. Never use new item ids for ribbons or titles, because older builds drop unknown items.
  3. Train A opens the Equipment feature early when a save holds any `gearbox_*`, so give no boxes before stage 2-1.
  4. "Ribbon" is already a gear slot.
  5. Co-op wins are not counted in `stats.wins`.

---

## 1. Free-to-play gem income

### 1.1 Recurring income (active player: logs in daily and finishes every commission)

| Source | Per day | Per week | Per 28 days | Code |
|---|---:|---:|---:|---|
| Daily commissions | 120 gems | 840 | 3,360 | `src/data/missions.js:14-21` (20+30+20+15+15+20) |
| Weekly commissions | — | 600 gems + 1 ticket | 2,400 + 4 | `src/data/missions.js:24-30` |
| Login calendar (7-day cycle; missed days don't reset it) | — | 260 gems + 2 tickets | 1,040 + 8 | `src/data/missions.js:33-41` (day 1: 50, day 4: 60, day 7: 150; days 3 and 7: tickets) |
| Mall · General: 1 ticket / week for 40,000 coins | — | 1 ticket | 4 | `src/data/shop.js:29` |
| Mall · Boss Exchange: 1 ticket / week for 60 Assault Tokens | — | 1 ticket | 4 | `src/data/shop.js:52` |
| **Total** | **≈ 243 gems + 0.71 tickets ≈ 2.74 recruits** | **1,700 gems + 5 tickets ≈ 19.2 recruits** | **6,800 + 20 ≈ 76.7 recruits** | `f2pIncomeSummary()` `src/systems/missions.js:319-360`; chart `docs/ECONOMY.md:32-39` |

A 30-day month ≈ 7,286 gems + 21.4 tickets ≈ **82 recruits**. A year ≈ **1,000 recruits**.

For comparison, the **casual kid** case: logs in, gets "Morning Roll Call" (20 gems a day), and claims the login
calendar. That is 140 + 260 = 400 gems + 2 tickets a week ≈ **5.3 recruits a week**, about a quarter of the active
player's income. Any one-time payout is about 4× bigger relative to this player's income.

Sources that pay **no gems** day to day:
- Bounty arenas and Total Assault runs pay tokens and items only (`src/data/stages.js:774-833`, `:922-957`).
- The weekly event is double drops in one Bounty arena, with no gems (`src/data/missions.js:94-100`; `dropMul: 2`
  in `src/systems/missions.js:291-305`).
- Sweeping is free and unlimited, up to 10 per tap with no energy cost (`src/systems/rewards.js:168-202`). It pays
  drops only. Energy is only planned (`docs/OWNER_REQUESTS.md:249`).

### 1.2 One-time income

| Source | Gems | Tickets (recruits) | ≈ Recruits | Code |
|---|---:|---:|---:|---|
| Starter gift | 2,400 | 10× ticket (10) | 30.0 | `src/systems/save.js:72-107` (`currencies.gems 2400`, `ticket_recruit10: 1`) |
| Campaign medals (20 / 40 / 60 / 100 per stage × 40) | 8,800 | — | 73.3 | `src/data/types.js:179-182` (`firstClearGems`), `src/systems/rewards.js:137` |
| Chapter finales (first clear of x-5: 100 + 20·chapter + 1 ticket) | 1,520 | 8 | 20.7 | `src/data/stages.js:90-96` |
| Bounty first clears (30·tier) + medals; Total Assault first clears (200 + ticket) + medals | 5,460 | 3 | 48.5 | `src/data/stages.js:861`, `:908` |
| **Existing achievements (30)** | **7,070** | **18** | **76.9** | `src/data/missions.js:55-79` |
| Codes SAKURA2026 · WELCOME · TACOTUESDAY | 1,040 | 3 | 11.7 | `src/data/missions.js:85-91` |
| *Live subtotal* | *26,290* | *42* | *≈ 261* | `docs/ECONOMY.md:46-54` |
| Freeplay milestones: wave 100 (50) + wave 150 (100) + Matriarch (200), per tier × 3 tiers | 1,050 | — | 8.75 | `src/online/coop/rewards.js:35-40` |
| Train A: patch-note gifts (100 × 27 versions listed today) | 2,700 (+100 per new version) | — | 22.5 | train A `src/systems/patchGifts.js:17`, `:83-98`; `src/data/patchNotes.js:23-256` |
| Train A: Captain's Journal lessons | 410 | 1 + 10× (11) | 14.4 | train A `src/data/story/lessons.js:31,93,104,128,139,161`; 10× by mail `:67-68` |
| Train A: story scenes (20 gems × 27 prologue / join / mid / epilogue) | 540 | — | 4.5 | train A `src/data/story/lessons.js:178-187` |
| **Total for a non-beta account** | **≈ 30,990** | **53** | **≈ 311** | |
| Beta Tester Thank-You mail (accounts created on or before Nov 7, 2026) | 3,000 | 5 × 10× (50) + SSR Select | 75 + a free SSR | `src/systems/mail.js:41-56`, `src/systems/inventory.js:171` |

Patch-gift cadence: 27 notes were dated between Oct 7 and Oct 15 (train A `src/data/patchNotes.js:23-256`).
That is ≈ 3 per day, which won't last. If it settles at 1–3 versions a week, it adds **100–300 gems a week**
(+6–18 % on top of weekly gems).

Later systems that may add gems:
- Codex mode ribbons pay **0** in v1. `MODE_RIBBON_GEMS` is in `origin/feature/codex-modes:src/systems/rewards.js:20`.
  If the owner says yes to Q1, they would pay 1,255 gems (expected level) to 2,800 (every ribbon)
  (`origin/feature/codex-modes:docs/specs/CODEX_MODES.md:796-799`).

### 1.3 What a recruit costs

* 1 recruit = **120 gems**; 10× = **1,200 gems** with no discount and at least one SR (`src/data/types.js:260-267`).
* Tickets are always spent before gems (`docs/ECONOMY.md:25`).
* Rates are SSR 1.5 % / SR 18.5 % / R 80 %, with pity at 90. Consolidated SSR ≈ 2.02 %, about **1 SSR per 49.6
  recruits ≈ 5,950 gems** (`docs/ECONOMY.md:20-21`).
* Spark = 200 recruit points (= 200 recruits ≈ 24,000 gem-equivalent) for any SSR (`src/data/shop.js:40`).
* The pool is small: **19 units**, of which 5 SSR, 10 SR and 4 R (`src/data/units.js:1396`).
  11 of them are free by 5-5: the starters `hikari`, `aoi` and `rei` (`src/systems/save.js:23`) plus campaign
  unlocks (`src/data/stages.js` `unlocks`).

### 1.4 The existing 30 achievements, summed

Summed with `sum.mjs`, which matches the "Achievements" row of `f2pIncomeSummary` (`src/systems/missions.js:346,353`):

| Group | Ids | Gems | Other rewards |
|---|---|---:|---|
| First win | `a_first_win` | 50 | 3 Study Guides |
| Chapters 1–8 | `a_chapter_1..8` (100 + 25·c) | 1,700 | 4 Recruit Tickets (even chapters) |
| Gold medals 10 / 40 | `a_gold_10`, `a_gold_40` | 800 | Lock Pin, 2 tickets |
| Sakura medals 1 / 10 | `a_sakura_1`, `a_sakura_10` | 550 | Horned Festival Crown |
| Bestiary 25 / 50 / 100 % | `a_bestiary_*` | 800 | 2 tickets |
| Recruits 10 / 100 / 300 | `a_pulls_*` | 550 | 40 Star Fragments |
| Max level 20 / 40 / 60 | `a_level_*` | 530 | 2 Academy Textbooks, Sage's Codex, Akashic Tome |
| Awaken ★1 / ★5 | `a_awaken_*` | 580 | — |
| Units 10 / all (= `UNITS.length` = 19) | `a_units_*` | 650 | 10× Recruit Ticket |
| Kills 1,000 / 25,000 | `a_kills_*` | 380 | — |
| 10 gear rerolls | `a_reroll_10` | 80 | Lock Pin |
| All 3 Total Assault bosses | `a_boss_3` | 400 | Ashwing Crown |
| **Total** | **30** | **7,070** | **8 tickets + one 10× (= 18 recruits), 2 Lock Pins, 2 crowns, 40 fragments, 5 books** |

Average **236 gems per achievement**; the largest is 600 (`a_gold_40`). **None of them gives a gear box today.**

---

## 2. Gear boxes and the other reward items

### 2.1 Gear boxes `gearbox_<rarity>`

| Id | Name | Substats | Stat scale | Code |
|---|---|---:|---:|---|
| `gearbox_common` | Plain Gear Box | 0 | ×1 | names `src/data/items.js:110-116`; items `:167-174` |
| `gearbox_rare` | Sturdy Gear Box | 1 | ×1.35 | substats `src/data/types.js:254` |
| `gearbox_superRare` | Ornate Gear Box | 2 | ×1.75 | scale `src/systems/gear.js:14` |
| `gearbox_mythic` | Radiant Gear Box | 3 | ×2.2 | |
| `gearbox_legendary` | Celestial Gear Box | 4 | ×2.8 | |

**How a box turns into gear:**
- `openGearBox` consumes the boxes and calls `rollGear(rng, { rarity: item.rarity })` once per box
  (`src/systems/gear.js:149-161`).
- **A box always gives its own rarity, so a box has no internal rarity odds.**
- The slot is uniform over charm / ribbon / shoes (`gear.js:118`). The main stat is uniform over the slot's list
  (`gear.js:120`): charm has ATK% or Crit DMG; ribbon has Crit Rate, Range or Armor Pierce; shoes have Attack Speed,
  Cost Reduction or Ult Haste (`src/data/types.js:248-252`).
- Substats are distinct and never repeat the main stat (`gear.js:122`). Values are uniform in base range × rarity
  scale; mains roll ×1.2 (`gear.js:56-66`, `:78-82`). A new piece starts at level 0.
- Mythic names end in "of the Crimson Moon" and legendary names in "of the Eternal Sakura" (`gear.js:39`).

**Two delivery paths:**
- Battle and sweep drops open the box at once (`src/systems/rewards.js:42-44`, `:193`).
- Boxes from the Mall, rewards or `addItems` stay in the Backpack until opened (`docs/ECONOMY.md:131-132`).
  The Backpack can open n at a time (`src/ui/screens/backpack.js:244`).
- Achievement boxes would take the second path. The reward modal already draws box icons
  (`src/art/icons/items.js:292-305`). Once an achievement lists a box, the "Where to get" sources pick it up
  automatically (`src/systems/inventory.js:164`).

**Where boxes drop or sell today.** Expected boxes per run on the best difficulty come from `itemSources()`:

| Box | Drops | Shop |
|---|---|---|
| Plain | Workshop Yard I: 100 %, 1–2 per run (≈ 1.5) | — |
| Sturdy | Workshop Yard II ≈ 1.5 per run; WY I 40 %; campaign ch 4–6 on Hard+ 10–12 % (`stages.js:79`) | Bounty Exchange 8 tokens, 3 a day (`shop.js:55`) |
| Ornate | WY III ≈ 1.5 per run; WY II 35 %; campaign ch 7–8 on Hard+ 13–14 % | **Gem Shop 180 gems, 2 a week** (`shop.js:36`); Bounty 25 tokens, 4 a week (`shop.js:57`) |
| Radiant | Total Assault 30 / 35 / 40 % (Lych / Colossus / Ashwing); WY III 30 % | Bounty 80 tokens, 1 a week (`shop.js:58`) |
| Celestial | TA Hard+ 5 / 6 / 8 %; WY III Nightmare 4 % | Bounty 200 tokens, 1 a week (`shop.js:59`) |

Workshop Yard tables are at `src/data/stages.js:795-806` and Total Assault tables at `:922-957`.
Tier unlocks: WY I after 1-5, II after 3-5, III after 5-5 (`stages.js:748-752`).

Train A already has one non-battle box: the "Dress for the adventure" lesson gives a Sturdy box + 2 Fortune Dice
(train A `src/data/story/lessons.js:107-117`). Nothing else gives one: no commissions, login days or codes
(`src/data/missions.js:14-91`).

**What a box is worth.** There are three ways to put a gem value on a box: the Mall's gem price, the token price, and
the salvage floor.
- Token price: 1 Bounty Token ≈ 7.2 gems, from the two Ornate prices (180 gems = 25 tokens). Lock Pin (150 gems
  = 20 tokens → 7.5) and Fortune Dice (40 gems = 6 tokens → 6.7) agree with that.
- Coins: 500 coins = 1 gem (Gem Shop 30,000 coins for 60 gems, `shop.js:32`).
- Salvage floor: coins 300·(o+1)², plus dice [0,0,1,2,3], plus a Lock Pin on legendary (`gear.js:321-328`).

| Box | By token price | Gem price | Best farm (runs per box) | Salvage floor | Weekly shop cap |
|---|---:|---:|---|---:|---|
| Plain | — | — | WY I: 0.7 runs | ≈ 1 gem | — |
| Sturdy | ≈ 58 gems | — | WY II: 0.7 runs | ≈ 2 | 21 / week |
| Ornate | 180 | **180** | WY III: 0.7 runs | ≈ 45 | 2 (gems) + 4 (tokens) |
| Radiant | ≈ 576 | not sold | Ashwing TA: 2.5 runs; WY III: 3.3 | ≈ 90 | 1 |
| Celestial | ≈ 1,440 | not sold | Ashwing TA Hard: 12.5 runs; WY III NM: 25 | ≈ 285 | 1 |

The salvage floor counts a Fortune Die at 40 gems, a Lock Pin at 150 and coins at 1 per 500.

**Token income and bounty runs:**
- Bounty Tokens per run are ≈ 1.5 / 2.5 / 3.5 for tiers I / II / III. The free top-up is 2 a day (daily
  commission) + 5 a week (login day 5).
- Buying out the weekly box stock costs ≈ 548 tokens, ≈ 157 tier-III runs.
- One tier-III run ≈ 3.5 tokens ≈ 25 gem-equivalent plus its drops.

**What the table means:**
1. A box is worth a lot *before* the player can farm its rarity, and little *after*. That is because sweeps are free
   and unlimited today (`src/systems/rewards.js:180-202`).
   - A Radiant box in chapter 3 is a big power jump: 2.2× scale and 3 subs, when the best gear the player owns is
     Sturdy.
   - The same box for a player who has cleared 5-5 is ≈ 3 tier-III sweeps.
   - If energy arrives (`docs/OWNER_REQUESTS.md:249`), boxes will be worth more for everyone.
2. Boxes never turn into recruits, and the battle effect of gear is modest. A Celestial charm's ATK% main is
   10–20 % at +0 and up to ≈ +32 % at +10 (`types.js:239`, `gear.js:14-18`). The whole level / gate / star stack
   tops out at ×2.41 (`docs/ECONOMY.md:113`).
   **So boxes can be generous without hurting the pull economy.**
3. Enhancing to +10 costs (800 + 400·L)·(rarity + 1) coins (`gear.js:281-291`), which is 130,000 coins for a
   legendary piece. A box is also a coin sink.

### 2.2 Other reward items: where they come from and a rough value

| Item (id) | Where it drops / sells (code) | Rough value |
|---|---|---|
| Books `book_common…legendary` (100 / 500 / 2,000 / 8,000 / 30,000 EXP, `items.js:94-100`) | Library Courtyard I–III (`stages.js:774-778`); every campaign stage; General shop (Doodle ×5 for 2,500 coins; Study Guide ×2 for 6,000); Gem Shop 2 Textbooks for 150 gems; Bounty 10 tokens per Textbook (`shop.js:24-25,33,61`); daily / weekly commissions; login day 2 / 5 | By EXP at the Gem Shop rate (75 gems per 2,000 EXP): Doodle ≈ 1, Study Guide ≈ 6, Textbook 75, Codex ≈ 300, Tome ≈ 1,100 gems. Codex and Tome are only drops: Library III 30 % / NM 5 %, TA 30 % / Ashwing Hard 6 %. Level 60 needs 1.1 M EXP (`ECONOMY.md:83`). |
| Recruit Ticket `ticket_recruit` | Weekly commission, login days 3 and 7, General (40k coins) and Boss (60 tokens) 1 a week each, chapter finales, TA first clears, achievements | **120 gems**: a direct recruit |
| 10× Recruit Ticket `ticket_recruit10` | Starter, Full Roster achievement, train A welcome mail, beta mail | **1,200 gems** |
| SSR Select `ticket_ssr_select` | Beta mail only (`inventory.js:171`) | About a spark (24,000 gem-equivalent). **Never an achievement reward.** |
| Fortune Dice `dice_reroll` | WY 15 / 30 / 50 %; campaign ch 3+ 4 %; General 12k coins (1 a day); Gem 3 for 120; Bounty 6 tokens (3 a day); salvage of SR+ | ≈ 40 gems |
| Prism Dice `dice_prism` | TA 8–12 %; WY III Hard+ 3 %; Boss Exchange 50 tokens (1 a week) (`shop.js:49`) | Scarce. Rerolls a main stat (`gear.js:214-217`). ≈ 100–300 gem-equivalent. |
| Lock Pin `lock_pin` | Iron Colossus 25 %; WY III 12 %; WY II Hard 5 %; Gem Shop 150 (2 a week); Boss 25 tokens; Bounty 20 tokens; legendary salvage | ≈ 150 gems |
| Crowns `crown_slime / iron / cog / oni / dragon` (`items.js:102-108`) | Miniboss stages 1-5 / 4-5 / 6-5 / 7-5 / 8-5 and TA (`stages.js:261,466,603,671,739`, `:923,938,953`); Boss Exchange 12 / 35 / 35 / 70 / 150 tokens, weekly (`shop.js:44-48`) | They gate awakening: ★1 Jelly … ★5 Ashwing + Horned (`ECONOMY.md:101-107`). **The Ashwing Crown is the ★5 bottleneck**: 1 a week in the shop, 25 % (+15 % Hard) from the Ashwing TA. |
| Star Fragment `star_fragment` | Duplicates R ×2 / SR ×10 / SSR ×40; Recruit Exchange 10 for 30 RP (3 a week); Boss 10 for 40 tokens (2 a week); login day 6 ×5; TA 20–30 % ×1–2 (`shop.js:41,51`) | ★1–★5 needs 190 per girl (`ECONOMY.md:103-107`). When every recruit is a duplicate, one recruit ≈ 4 fragments, so 1 fragment ≈ 30 gems. |
| Bounty Token / Assault Token | Bounty runs and Tactical Challenge / minibosses, TA, Crown Hunter (10 a week), login day 6 (8) | Bounty ≈ 7 gems each. Assault ≈ 2 gems (ticket rate) to 6 gems (Lock Pin rate). |

---

## 3. Reward budget for the new achievement set

### 3.1 How much gem value

**Proposal:**
- **≤ 6,000 gems** over a player's whole life for the whole new set, with a hard cap of **7,000**.
- **≤ 6 single Recruit Tickets**, and **no 10× tickets**.
- Total ≈ **56 recruits**.

Why that number:
1. **Same scale as the first set.** The first 30 achievements cover the whole live game for 76.9 recruits (§1.4).
   The new set covers the same game again plus side systems (gear, bounty, bestiary depth, freeplay, codex modes),
   so it should pay *less* than the first one did: about 70 %.
2. **It stays under a month of income.** 56 recruits ≈ 0.73 × the 28-day active income (76.7). One-time recruits
   rise from ≈ 311 to ≈ 367 (+18 %).
3. **The roster is small.** There are 19 units and 5 SSRs (`src/data/units.js:1396`). A free player already gets
   ≈ 311 one-time recruits plus ≈ 82 a month. By month 2 that is ≈ 475 recruits: ≈ 9.6 expected SSRs plus 2 sparks.
   They own every current SSR either way. Extra gems mostly speed up "roster complete" and take value away from the
   upcoming school-uniform girls' banners. **Recruits should not be what the new set pays most in.**
4. **It can't buy a spark on its own.** 56 recruits = 0.28 of a spark.
5. **No double pay with codex ribbons.** If Q1 turns on ribbon gems (1,255–2,800, §1.2), achievements *about*
   ribbon counts should pay boxes and cosmetics, not more gems.
6. **The pace stays readable.** Spread over ≈ 90 days of progression it is ≈ 0.6 recruits a day, about 23 % of the
   active daily income, and it tapers off after that.

**Gems per step: back-loaded by when the step is usually reached**

| Tier | Typically reached | Gems | Box | Other |
|---|---|---:|---|---|
| T1 Bronze | week 1 (chapters 1–3) | 20–30 | Sturdy ×1. **Not before 2-1** (see §5.3) | books, Fortune Dice |
| T2 Silver | weeks 2–4 (chapters 4–6, first Hard medals, Bounty I/II) | 50 | Ornate ×1 | Lock Pin, 10 fragments |
| T3 Gold | month 2 (chapters 7–8, Hard 30+, Bounty III, TA) | 100 | Ornate ×2, **or** Radiant ×1 on headline steps | Prism Dice, crowns (oni / iron) |
| T4 Sakura (capstone) | month 3+ (Nightmare sweeps, all medals, Crimson Moon) | 200 (max 300) | Radiant ×1–2; **Celestial ×1 on ≤ 5 capstones** | Ashwing Crown, a single Recruit Ticket |

Example mix: 5 T1 + 20 T2 + 25 T3 + 12 T4 ≈ 125 + 1,000 + 2,500 + 2,400 = **6,025 gems**.
The 6 Recruit Tickets go only on T4 capstones.

### 3.2 Gear box mix (which rarity at which stage)

- **Never give Plain boxes.** They have 0 substats, and Workshop Yard I hands out 1–2 per run. A child opening an
  achievement box should never get the junk tier.
- **Early → Sturdy.** It is the first box with a substat, and it matches the box the train A gear lesson hands out.
- **Mid → Ornate.** It is the one box with a gem price (180), so it reads as a fair reward. It is a real upgrade
  before the player reaches WY III.
- **Late → Radiant**, with at most ~12 in the set. Beyond that, 1 a week in the Bounty Exchange stays the main source.
- **Capstones → Celestial**, with at most 5 in the set. The shop sells 1 a week and drops are 4–8 %, so 5 equals about
  a month of buyout stock.

Total box value for a full set of about 25 Sturdy + 30 Ornate + 12 Radiant + 4 Celestial, at shop rates:
≈ 1,450 + 5,400 + 6,900 + 5,760 = **≈ 19,500 gem-equivalent**. **None of it turns into recruits**, so this is where the
"wow" should come from (next to the honor ribbons and titles).

### 3.3 Other item rewards that fit

| Kind of achievement | Good extra reward |
|---|---|
| Level / Bounty Library | books (Textbook / Codex) |
| Gear | Fortune Dice, Lock Pin, Prism Dice |
| Awakening | 10–20 Star Fragments |
| Bosses | crowns (Iron / Oni late; one Ashwing Crown on a capstone) |
| Bounty | Bounty Tokens (≤ 20) |

Avoid SSR Select, 10× tickets, and any new item id (see §5.2).

---

## 4. Update day: what veterans unlock at once

### 4.1 Three archetype saves

`retro.mjs` builds each save with the live `createProfile()` (`src/systems/save.js:72-107`), the real stage ids,
`stageEnemies()` for the bestiary, and real `rollGear()` pieces. It then runs the live `achievementList()`.

Levels follow the balance test's expected level per chapter: 1 / 8 / 14 / 20 / 25 / 30 / 35 / 40
(`tests/integration/balance.test.js:20`).

Recruits for the **mid** save on day 25:
- starter 30 + recurring 68.5 + codes 11.7 + medals / finales / bounty / TA ≈ 42 + achievements claimed ≈ 24
  = **≈ 176**;
- ≈ 250 with the beta mail, ≈ 290 with train A's patch and story gifts;
- the model uses **220**.

Kills ≈ 146 per battle.

| Metric (field) | Early (day ~5, ch 2–3) | **Mid (day ~25, ch 6)** | Late (day ~60, campaign done) |
|---|---:|---:|---:|
| Campaign stages cleared / Normal / Easy | 10 / 10 / 0 | 28 / 28 / 5 | 40 / 40 / 15 |
| Hard (Gold) / Nightmare (Sakura) medals | 3 / 0 | 17 / 1 | 40 / 10 |
| Chapters cleared | 2 | 5 | 8 |
| Bounty stages cleared / on Hard; TA cleared | 2 / 0; 0 | 7 / 5; 1 | 15 / 15; 3 |
| Bestiary % (`bestiaryPercent`, `missions.js:207-212`) | 22 | 66 | 100 |
| Units owned (SSR / SR / R) | 12 (1 / 7 / 4) | 17 (3 / 10 / 4) | 19 (5 / 10 / 4) |
| Max level / units ≥ 20 / ≥ 40 | 18 / 0 / 0 | 38 / 12 / 0 | 60 / 19 / 13 |
| Max awaken / units awakened | 0 / 0 | 2 / 3 | 5 / 8 |
| Recruits (`gacha.totalPulls`) | 90 | 220 | 480 |
| Battles / wins / kills (`stats`) | 45 / 38 / 6,500 | 260 / 220 / 38,000 | 700 / 620 / 140,000 |
| Gear owned (rare / SR / mythic / legendary); at +10 | 20 (6 / 0 / 0 / 0); 0 | 104 (45 / 18 / 1 / 0); 5 | 251 (90 / 80 / 18 / 3); 20 |
| `missions.counters` login / dailyDone / sweep / gearReroll / bossKill / levelUp | 5 / 3 / 20 / 1 / 4 / 120 | 25 / 18 / 420 / 14 / 45 / 420 | 60 / 50 / 2,500 / 70 / 180 / 900 |
| Account level (`src/ui/components.js:105-138`) | 10 | 20 | 32 |
| **Existing achievements met** | 6 (605 gems + 1 ticket) | **18 (2,595 gems + 2 tickets)** | 30 (7,070 + 18) |

These counters are complete for every save. `missions.counters` has counted every `TRACK_EVENTS` event since the
first build (f3bbe0f, Oct 5; `src/systems/missions.js:67-80`). Older builds keep the map word for word
(`src/systems/save.js:238`).

### 4.2 How big the update-day payout gets

`illustrate.mjs` builds an **illustrative** 63-step ladder over the fields above. It is not the design; names come
from the design job. Examples of steps:
- Normal clears 10 / 20 / 30 / 40;
- Hard 5 / 20 / 30;
- Nightmare 5 / 20 / 40;
- all-four-medals 1 / 10 / 40;
- Bounty 5 / 10 / 15;
- units at Lv 20 / 40;
- awakened 3 / 8;
- wins, kills, gear owned, gear at +10, first SR / mythic / legendary piece;
- login / dailyDone 7 / 30 / 100;
- bossKill 25 / 100 / 300;
- …

Each step is tiered by which archetype already meets it. That gives 2 T1 / 21 T2 / 27 T3 / 13 T4.

Both curves below pay the same lifetime total of 6,390 gems:

| Save | Steps met on day one | **Back-loaded (20 / 50 / 100 / 200)** | Flat (101 per step) |
|---|---:|---:|---:|
| Early | 2 / 63 | **40 gems** | 202 |
| **Mid** | 23 / 63 | **1,090 gems (≈ 9 recruits; < 1 week of active income)** | 2,323 (≈ 19 recruits) |
| Late | 50 / 63 | **3,790 gems (≈ 32 recruits)** | 5,050 (≈ 42 recruits) |

With one box per step, the mid save would also get ≈ 2 Sturdy + 21 Ornate boxes on day one. That is ≈ 3,800
gem-equivalent, or ≈ 14 tier-III Workshop runs, which the save could already farm. Fine for power. It is a lot of
opening, though, so an "Open all" button on the rewards modal would help (the Backpack already opens n,
`backpack.js:244`).

### 4.3 How to pace the payout

**Recommended: pay in full, and bound the payout by design, not at runtime.**
- Kids read "Claim → less than shown" as the game taking their reward.
- Veterans did the work.
- The live flow already merges many claims into one modal (`src/ui/screens/commissions.js:217-231`).

Rules for the design job:
1. **Tier the gems by when a step is reached** (§3.1). Run `node retro.mjs candidate.json` on the real list.
   Targets:
   - **mid save ≤ 1,500 gems** on day one (≈ 1 week of active income);
   - **late save ≤ 4,000**;
   - **≤ 0 tickets** in the retroactive part (tickets only on capstones a late save hasn't reached).
2. **Put most of the update-day "wow" in cosmetics and boxes.** Honor ribbons and titles unlocking retroactively
   cost nothing economically. The Profile spec already derives titles from `missions.achievements`
   (SPEC.md:329-338), so a veteran's profile lights up at once.
3. **Keep gems off steps that are grindable by tapping.** Sweeps are free and unlimited and count into
   `counters.sweep` and `stages[id].clears` (`rewards.js:180-202`). `spendCoins` is fed by sweeps too. Steps on
   these should pay cosmetics or boxes only.
4. **Account for train A's 2,700-gem patch-gift backlog.** It lands in an earlier release
   (train A `patchGifts.js:94-98`), so veterans will already have had one windfall. Another 1,000–4,000 is fine,
   but nothing bigger.

**Optional, only if the owner wants a smaller first day:** a "Catch-up Honor Roll".
- Cosmetics and boxes pay at once.
- Retroactive gems above 1,500 arrive as one letter a day (deliver-once mail, `src/systems/mail.js`) for up to 7
  days. That gives a login reason with no loss.
- The ledger must sit in `missions.counters` (an `achp:<day>` mark, like `fpm:` / `pg:`) so an older tab can't
  re-deliver.
- It adds complexity, so I'd skip it unless asked.

---

## 5. Constraints found in the code (for the design and build jobs)

1. **Once-per-account safety is already in place for claims.**
   - `cleanMissions` keeps every truthy key of `missions.achievements`, known or not (`src/systems/save.js:237`),
     and every numeric `missions.counters` key (`:238`).
   - So a claim of a *new* id survives an older cached tab rewriting the save, and it can't pay twice. Unlike
     `progress.freeplay` (`src/online/coop/rewards.js:221-237`), no extra `ach:` mirror is needed.
   - **Keep every claim in `missions.achievements[id] = true`**, and derive ribbons and titles from it.
   - Put any **new lifetime counter in `missions.counters`**, because `stats` is an allowlist of 5 fields
     (`save.js:432`).
2. **No new item ids for ribbons or titles.** `p.items` keeps only ids in `ITEMS` (`save.js:314`), so an older build
   would drop them (a "lossy" backup). Gear boxes, books, dice, pins, crowns, fragments and tickets are all known ids.
3. **Train A feature gates.** `usedEvidence` opens Equipment as soon as the save holds any `gearbox_*`, and
   Awakening as soon as it holds any `crown_*` (train A `src/systems/story.js:429-438`; gates at `lessons.js:172-175`:
   gear at 2-1, awaken at 3-2). So:
   - **no gear boxes from achievements reachable before 2-1** (e.g. "clear 1-1"),
   - **no crowns before 3-2**.
4. **The word "ribbon" is already taken twice:**
   - the gear slot Ribbon (Hair Bow / Scrunchie / Hairpin) (`src/data/types.js:231-235`, `src/systems/gear.js:26`),
     which a gear box can roll;
   - codex **mode ribbons** (`origin/feature/codex-modes:src/data/modes.js:30-31`).

   Call the achievement ones **"Honor Ribbons"** (or a school-life name) in data and UI, so a reward card with
   "Ornate Gear Box + Honor Ribbon" isn't confusing.
5. **Co-op battles are not counted in `stats.wins`, `stats.battles` or `stats.kills`.** `applyCoopResult` only
   tracks `kill` (`src/online/coop/rewards.js:71-87`). For kill steps, use `missions.counters.kill`, which includes
   co-op and freeplay, rather than `stats.kills` (`src/systems/missions.js:228`). Win steps will ignore co-op unless
   a new counter is added.
6. **Goals that move.** `a_units_all` uses `UNITS.length` as its goal (`src/data/missions.js:74`). When the 11 new
   girls land, an unclaimed 19/19 becomes 19/30. Bestiary % also moves when enemies are added
   (`missions.js:197-212`). Use fixed numbers in new goals.
7. **Retroactive data sources that already exist:**
   - per-enemy kills `bestiary[id].kills` (`rewards.js:114`);
   - lifetime gear received `profile.seq.gear` (`gear.js:136-139`);
   - freeplay bests `stages[id].freeplayBest` / `coopBestWave`, and milestone marks `fpm:`;
   - bond `profile.bond`;
   - codex `stages[id].modes['d:m']` once that branch lands.

   **No history exists** for gear boxes opened, gear salvaged, Mall purchases (`shop.bought` is per period) or
   co-op wins. Steps on these start at 0 for everyone.
8. **The recruit-count achievements `a_pulls_*` are excluded from titles and pins** (Profile SPEC.md:36, `:726`).
   Treat new recruit / spending steps the same way: no title, no pin.

---

## Appendix: scripts in this folder (read-only, no repo writes)

* `docs/specs/achievements/sum.mjs`: sums the
  existing achievement rewards and prints the live `f2pIncomeSummary()`.
* `docs/specs/achievements/sources.mjs`: `itemSources()`
  for every box, book, ticket, die, pin, crown, fragment and token (odds and expected count per run).
* `docs/specs/achievements/story.mjs` and `story2.mjs`:
  sum train A's lesson, scene and patch-note gifts. They need a `git archive` copy of train A HEAD, which I removed
  after use. Recreate it with `mkdir _traina && git -C /home/user/wt-traina archive HEAD src | tar -x -C _traina`,
  then run `node story2.mjs $PWD/_traina`.
* `docs/specs/achievements/retro.mjs`: the three
  archetype saves and their metric snapshot.
  - `node retro.mjs candidate.json` prints the day-one payout of a candidate list.
  - Candidate format: `[{ id, metric, goal, rewards }]`.
  - `metric` is any snapshot key, e.g. `hardMedals`, `nightmareMedals`, `allFourMedals`, `bountyHard`, `bossHard`,
    `unitsAt40`, `unitsAwakened`, `ownedSSR`, `kills`, `gearLegendary`, `gearAtPlus10`, `counter.login`,
    `counter.dailyDone`, `counter.bossKill`, …
* `docs/specs/achievements/illustrate.mjs`: the
  63-step back-loaded vs flat comparison in §4.2.
