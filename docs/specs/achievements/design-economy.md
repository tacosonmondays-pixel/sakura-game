# Achievements expansion: economy and integrity design

Oct 15, 2026. Design only: nothing in any repo or worktree was edited.

**Owner request (verbatim):** "Can you add more achievements some will grant you like gear boxes alongside gems and maybe even some ribbons? Special ribbons will have a cool effect to them!! And maybe titles too?"

**Lens:** economy (what it pays, and when) and integrity (no reward can ever pay twice, nothing earned can be lost).

**Citations:**
- Plain `path:line` is the live game `/home/user/sakura-game` at `fddf01c` (v0.1.27).
- `TA:` is train A (`git -C /home/user/wt-traina show HEAD:<path>`, `917027e`).
- `CX:` is `origin/feature/codex-modes` (`6c7e0d0`).
- `SPEC:`, `SQL:` and `RULES:` are the Sensei Profile spec (`scratchpad/profile/SPEC.md`), its migration (`scratchpad/profile/20261016000000_profile.sql`) and its JS mirror (`scratchpad/profile/profileRules.sketch.js`).
- `RS`, `RE` and `RM` are the three research files in this folder (systems, economy, metrics and cosmetics).

**Numbers are computed, not estimated.** Every total, per-tier figure and update-day payout below comes from `econ/check.mjs`. The script imports the live code, builds the three archetype saves from `retro.mjs`, and checks the catalog in `econ/catalog.mjs`. Its raw output is `econ/out.json`.

---

## 0. Summary

| Owner asked for | This design |
|---|---|
| (a) **More achievements** | **62 new** (30 → 92): 56 at launch, 5 more when Codex modes ship, 1 when social ships. Grouped in 8 category tabs. |
| (b) **Gear boxes alongside gems** | **56 of the 62** give a gear box. 52 of those also give gems. In total: **47 Ornate, 20 Radiant and 5 Celestial** boxes. None are Plain or Sturdy. |
| (c) **Ribbons** | **41 Honor Ribbons**: 34 on new achievements and 7 added to shipped ones. A ribbon is owned because its achievement is claimed, so it is never stored as an item. |
| (d) **Special ribbons with a cool effect** | **8 specials**: 6 new capstones, plus Valedictorian and Encyclopedia Sakura. There are 4 effects: Prism, Sakura Drift, Starlight and Sunrise. They are compositor-only CSS and stand still under Reduce Motion. |
| (e) **Titles** | **36 titles**: 24 new, 10 on shipped achievements, plus the 2 freeplay titles. A title's id is its achievement's id, so the profile card needs **no SQL change**. |
| Gems, whole life | **5,910** gems at launch (+720 with the Codex pack) and **5 Recruit Tickets**, ≈ 60 recruits. That is under the 7,000 cap and **0.79 of one month** of active free-to-play income. |
| Update day | Pay everything already earned, in full: **early save 100 gems, mid save 590, late save 3,040, and 0 tickets**. Mid gets 13 boxes and late gets 48. There is no cap and no back-pay mail. |
| Integrity | Claims stay in `missions.achievements` and new counters in `missions.counters`. Every older build keeps both. **No new top-level save key, no new item id, no `SAVE_VERSION` bump.** Cosmetics are derived, never stored. Boxes and crowns wait for their train-A feature gate. |

---

## 1. Baselines

### 1.1 Free-to-play income

| | Gems | Tickets | ≈ Recruits | Source |
|---|---:|---:|---:|---|
| Active player, per 28 days | 6,800 | 20 | 76.7 | `f2pIncomeSummary()` `src/systems/missions.js:319-360`; `docs/ECONOMY.md:32-39`. `econ/out.json` `income.per28` agrees. |
| Active player, per day | ≈ 243 | 0.71 | 2.74 | RE §1.1 |
| Casual kid (Morning Roll Call + login calendar), per week | 400 | 2 | 5.3 | `src/data/missions.js:15`, `:33-41` |
| One-time sources in the live game | 26,290 | 42 | ≈ 261 | `docs/ECONOMY.md:46-54` |
| One-time sources with train A (patch gifts, journal, story) | ≈ 30,990 | 53 | ≈ 311 | RE §1.2 |
| Patch-gift backlog paid on train A's release day | 2,700 | — | 22.5 | `TA:src/systems/patchGifts.js:17` × 27 versions (`TA:src/data/patchNotes.js:23-256`) |

- Recruits cost 120 gems each, 1,200 for ten, and a spark costs 200 recruit points (`src/data/types.js:260-267`).
- The **30 shipped achievements pay 7,070 gems + 18 ticket-recruits = 76.9 recruits**, an average of 236 gems each.
  - `src/data/missions.js:55-79`; the `Achievements` row of `f2pIncomeSummary` (`src/systems/missions.js:346`, `:353`).
  - None of them gives a gear box.

### 1.2 What a gear box is worth

- A box always opens into one piece of its own rarity: `openGearBox` → `rollGear(rng, { rarity: item.rarity })` (`src/systems/gear.js:149-161`).
- Values below are RE §2.1 (token price ≈ 7.2 gems per Bounty Token).

| Box (id) | Gem-equivalent | Free farm once reachable | Where it fits |
|---|---:|---|---|
| Plain `gearbox_common` | ≈ 1 | Workshop Yard I: 1–2 per run | **Never** an achievement reward (0 substats) |
| Sturdy `gearbox_rare` | ≈ 58 | WY II | Not used. Too weak for anyone who can claim a box (§4.6). |
| Ornate `gearbox_superRare` | **180** (Gem Shop price, `src/data/shop.js:36`) | WY III ≈ 0.7 runs | T2 and T3 |
| Radiant `gearbox_mythic` | ≈ 576 | Ashwing TA ≈ 2.5 runs | T3 headline steps, T4 |
| Celestial `gearbox_legendary` | ≈ 1,440 | Ashwing TA Hard ≈ 12.5 runs | Capstones only (5) |

**Why boxes carry the bulk:**
1. Boxes never become recruits.
2. Gear's battle effect is modest (RE §2.1).
3. Sweeps are free and unlimited (`src/systems/rewards.js:180-202`), so a box is worth a lot *before* a player can farm its rarity and little after.
4. A box is also a coin sink: +10 costs up to 130,000 coins (`src/systems/gear.js:298-318`).

---

## 2. The set

### 2.1 Rules the catalog follows

All of these are enforced by tests (§8).

1. **Ids are permanent and short.** They match `^a_[a-z0-9_]+$` and are at most 24 characters.
   - At most 24 characters means every id can also be a title id: `SQL:135`, `SQL:148`, `RULES:30`.
   - It can also be an `ach:` pin: `SQL:193`, `RULES:34`.
   - The longest new id is `a_slimekill_1k` (14 characters).
2. **Rewards are existing `ITEMS` ids only**, so `tests/integration/consistency.test.js:81-89`, `tests/systems/items.test.js:60-69` and the exact item list at `tests/systems/items.test.js:26` stay green.
   - Excluded rewards: `gearbox_common`, `ticket_recruit10`, `ticket_ssr_select`.
3. **Gems are tiered by when a step is usually reached** (§3.2). Grindable steps pay **no gems**.
   - A step is grindable when free, unlimited taps can raise it: sweeps, coin spending, opening boxes, salvage.
   - Sweeps add only `counters.sweep` and `clears` (`src/systems/rewards.js:198-200`). They add no kills, wins or medals, so kill, win and medal steps are not grindable.
4. **No double gems with an existing one-time payout.**
   - Freeplay wave 100/150 milestones already pay 50/100 gems (`src/online/coop/rewards.js:35-40`), and Captain's Journal lessons already pay. Achievements on those same conditions pay a box and a ribbon only (`a_fp_seasons`, `a_journal_all`).
   - Codex mode ribbons pay 0 gems in v1 (`CX:src/systems/rewards.js:20`). The Codex pack gives gems, sized as if Q1 never turns ribbon gems on.
   - If the owner later turns ribbon gems on, halve the gems on `a_mr_*` in that same release.
5. **No spending signals and nothing that pushes kids to strangers.**
   - Excluded: recruit counts, gems spent, Potential (it comes from duplicates), friend counts and messages (RM §0.8, `SPEC:726`).
   - Co-op wins and clan donations are fine.
   - Login steps are cumulative ("on 30 different days"), never streaks.
6. **Fixed goals only.** `a_units_all`'s goal of `UNITS.length` (`src/data/missions.js:74`) and the bestiary-% denominator (`src/systems/missions.js:197-212`) both grow with content; new goals do not use them.
7. **Names and titles** are original, kid-safe and about school life, the academy, sakura, the girls or this game's enemies. Titles never mention appearance and never mock.

### 2.2 The 62 new achievements

**Columns:**
- **Data:**
  - `retro`: the save already holds the data, so veterans get credit.
  - `new`: a new `missions.counters` key that starts at 0.
  - `TA` / `CX` / `S`: ships with train A, Codex modes or social.
- **Tier:** T1–T4 is the economy tier; T4★ is a capstone.

| Id | Name | Goal | Data | Tier | Gems | Items | Honor ribbon | Title |
|---|---|---|---|---|---:|---|---|---|
| `a_quad_1` | Four-Medal Report Card | Earn all four medals on one campaign stage. | retro | T2 | 50 | Ornate box | blue | — |
| `a_quad_10` | Straight-A Semester | Earn all four medals on 10 campaign stages. | retro | T3 | 100 | Radiant box | gold | Straight-A Sensei |
| `a_quad_40` | Academy Laureate | Earn all four medals on all 40 campaign stages. | retro | T4★ | 300 | Celestial box, Recruit Ticket | **SPECIAL: prism** (prism) | Academy Laureate |
| `a_gold_20` | Gold Star Student | Earn Gold medals on 20 campaign stages. | retro | T3 | 100 | Ornate box ×2 | — | — |
| `a_sakura_20` | Sakura in Full Bloom | Earn Sakura medals on 20 campaign stages. | retro | T4 | 200 | Radiant box | sakura | — |
| `a_sakura_40` | Thousand-Petal Sentinel | Earn Sakura medals on all 40 campaign stages. | retro | T4★ | 300 | Celestial box, Recruit Ticket | **SPECIAL: sakura** (sakura) | Thousand-Petal Sentinel |
| `a_csak_1` | Blossoming Chapter | Earn Sakura medals on every stage of one chapter. | retro | T3 | 100 | Radiant box | sakura | — |
| `a_bounty_5` | Joined a Club | Clear 5 Bounty stages. | retro | T1 | 20 | Study Guide ×3 | — | — |
| `a_bounty_15` | Every Club Room | Clear all 15 Bounty stages. | retro | T3 | 100 | Ornate box ×2 | — | — |
| `a_bountyg_15` | Club Captain | Earn Gold medals on all 15 Bounty stages. | retro | T3 | 100 | Radiant box | gold | Club Captain |
| `a_minis_4` | Crown Inspector | Defeat the Slime Prince, Goblin Machine, Orc General and Oni Champion. | retro | T3 | 100 | Ornate box ×2 | — | — |
| `a_lych_10` | Lantern Keeper | Defeat the Grave Lych 10 times. | retro | T3 | 100 | Ornate box ×2 | — | — |
| `a_colossus_10` | Iron Will | Defeat the Iron Colossus 10 times. | retro | T3 | 100 | Ornate box ×2, Lock Pin | — | — |
| `a_ashwing_10` | Ashwing Watch | Defeat the Ashwing Matriarch 10 times. | retro | T4 | 200 | Radiant box | — | — |
| `a_boss_gold_3` | Assault Squad Leader | Earn Gold medals on all three Total Assault bosses. | retro | T4 | 200 | Radiant box, Prism Dice ×2 | gold | Assault Squad Leader |
| `a_boss_sak_3` | Dawn After the Storm | Earn Sakura medals on all three Total Assault bosses. | retro | T4★ | 300 | Celestial box, Recruit Ticket | **SPECIAL: sunrise** (prism) | Stormproof Sentinel |
| `a_slime_15` | Slime Specialist | Discover 15 kinds of slime. | retro | T2 | 50 | Ornate box | blue | Slime Specialist |
| `a_slimekill_1k` | Bubble Patrol | Defeat 1,000 slimes. | retro | T2 | 50 | Ornate box | — | — |
| `a_dragon_4` | Dragon Spotter | Discover 4 kinds of dragon. | retro | T3 | 100 | Ornate box ×2 | gold | Dragon Spotter |
| `a_units_15` | Lively Club Room | Have 15 students in your academy. | retro | T2 | 50 | Ornate box | — | — |
| `a_lv20_10` | Study Group | Raise 10 students to level 20. | retro | T2 | 50 | Ornate box | — | — |
| `a_lv40_10` | Honor Society | Raise 10 students to level 40. | retro | T3 | 100 | Ornate box ×2, Sage's Codex | gold | — |
| `a_lv60_5` | Top of the Class | Raise 5 students to level 60. | retro | T4 | 200 | Radiant box, Akashic Tome | gold | Head of the Class |
| `a_awake_3` | Rising Stars | Awaken 3 students. | retro | T2 | 50 | Ornate box, Star Fragment ×10 | — | — |
| `a_stars_25` | Constellation | Earn 25 awakening stars across your students. | retro | T3 | 100 | Radiant box, Star Fragment ×20 | blue | — |
| `a_stars_50` | Starry Sky | Earn 50 awakening stars across your students. | retro | T4 | 200 | Radiant box, Ashwing Crown | gold | Starry-Eyed Sensei |
| `a_gear_sr` | Ornate Taste | Get a Super Rare piece of gear. | retro | T2 | 50 | Ornate box | — | — |
| `a_gear_myth` | Crimson Moon Keepsake | Get a Mythic piece of gear. | retro | T3 | 100 | Ornate box ×2, Lock Pin | — | — |
| `a_gear_leg` | Eternal Sakura Keepsake | Get a Legendary piece of gear. | retro | T4 | 200 | Radiant box, Lock Pin | gold | — |
| `a_plus10_1` | Polished to a Shine | Enhance a piece of gear to +10. | retro | T2 | 50 | Ornate box, Fortune Dice ×2 | — | — |
| `a_plus10_10` | Workshop Regular | Have 10 pieces of gear at +10. | retro | T3 | 100 | Ornate box ×2 | — | — |
| `a_leg_plus10` | Celestial Craftwork | Enhance a Legendary piece of gear to +10. | retro | T4 | 200 | Radiant box, Prism Dice | gold | Master Crafter |
| `a_reroll_50` | Fine-Tuner | Reroll gear 50 times. | retro | T3 | 100 | Prism Dice | — | — |
| `a_set_myth` | Matching Set | Equip three Mythic or Legendary pieces on one student. | retro | T3 | 100 | Ornate box ×2 | — | — |
| `a_box_25` | Unboxing Day | Open 25 gear boxes from your Backpack. | new | T2 | — | Ornate box, Fortune Dice ×2 | blue | — |
| `a_salvage_100` | Tidy Workshop | Salvage 100 pieces of gear. | new | T2 | — | Lock Pin, Fortune Dice ×3 | blue | — |
| `a_kills_5k` | Neighborhood Watch | Defeat 5,000 enemies. | retro | T2 | 50 | Ornate box | — | — |
| `a_kills_100k` | Petal Storm | Defeat 100,000 enemies. | retro | T4 | 200 | Radiant box | gold | Petal Storm |
| `a_wins_100` | Patrol Veteran | Win 100 battles. | retro | T2 | 50 | Ornate box | — | — |
| `a_wins_500` | Seasoned Sentinel | Win 500 battles. | retro | T3 | 100 | Ornate box ×2 | gold | Seasoned Sentinel |
| `a_hardwin_100` | Extra Credit | Win 100 battles on Hard or Nightmare. | retro | T3 | 100 | Ornate box ×2 | — | — |
| `a_bosskill_100` | Boss Patrol | Defeat 100 minibosses or bosses. | retro | T3 | 100 | Ornate box ×2, Assault Token ×20 | — | — |
| `a_flawless_10` | Not a Petal Lost | Win 10 battles on Normal or Hard without losing a life. | new | T2 | 50 | Ornate box | blue | Flawless Guardian |
| `a_coop_1` | Study Buddies | Win a co-op battle. | new | T1 | 20 | Study Guide ×3 | — | — |
| `a_coop_25` | Team Spirit | Win 25 co-op battles. | new | T3 | 100 | Ornate box ×2 | blue | Team Spirit |
| `a_tc_30` | Tactical Thinker | Reach wave 30 in the Tactical Challenge. | retro | T2 | 50 | Ornate box | — | — |
| `a_fp_50` | After-Hours Patrol | Reach wave 50 in any Freeplay. | retro | T2 | 50 | Ornate box | — | — |
| `a_fp_seasons` | Three Seasons | Reach wave 100 on Blossom, Tempest and Crimson Moon. | retro | T4 | — | Radiant box | gold | — |
| `a_fp_wyrm` | Eclipse Watcher | Defeat the Eclipse Wyrm in Freeplay. | retro | T4 | 200 | Radiant box | **SPECIAL: starlight** (navy) | Eclipse Watcher |
| `a_login_7` | Settling In | Visit the academy on 7 different days. | retro | T1 | 20 | Study Guide ×3 | blue | — |
| `a_login_30` | Regular Attendance | Visit the academy on 30 different days. | retro | T2 | 50 | Ornate box | — | — |
| `a_login_100` | Perfect Attendance Award | Visit the academy on 100 different days. | retro | T3 | 100 | Radiant box | gold | Perfect Attendance |
| `a_login_365` | Academy Anniversary | Visit the academy on 365 different days. | retro | T4★ | 300 | Celestial box, Recruit Ticket | **SPECIAL: sakura** (sakura) | Sensei of the Year |
| `a_daily_30` | Homework Hero | Finish every daily commission on 30 days. | retro | T2 | 50 | Ornate box | — | Homework Hero |
| `a_daily_100` | Class Representative | Finish every daily commission on 100 days. | retro | T3 | 100 | Radiant box | gold | Class Representative |
| `a_journal_all` | Captain's Logbook | Claim every Captain's Journal lesson. | TA | T2 | — | Ornate box ×2 | blue | Bookworm Sensei |
| `a_mr_1` | Trying Something New | Earn your first mode ribbon. | CX | T1 | 20 | Fortune Dice | — | — |
| `a_mr_100` | Mode Explorer | Earn 100 mode ribbons. | CX | T3 | 100 | Radiant box | — | — |
| `a_perfect_1` | Rosette Stage | Earn all 20 mode ribbons on one stage. | CX | T3 | 100 | Radiant box | gold | — |
| `a_mr_400` | Versatile Strategist | Earn 400 mode ribbons. | CX | T4 | 200 | Radiant box ×2 | gold | Versatile Strategist |
| `a_mr_800` | Every Ribbon, Every Stage | Earn all 800 campaign mode ribbons. | CX | T4★ | 300 | Celestial box, Recruit Ticket | **SPECIAL: prism** (prism) | All-Round Sensei |
| `a_donate_10` | Helping Hands | Make 10 donations to your clan. | S | T2 | — | Ornate box | blue | Helping Hands |

**Where each metric reads.** Every `retro` metric already exists in every save (RM §1.2, RS §1.2):
- **Medals:** `progress.stages[id][difficulty]` (`src/systems/save.js:358-376`).
- **Per-enemy kills and discovery:** `bestiary[id]` (`src/systems/save.js:404-411`).
- **Lifetime events:** `missions.counters.{kill,battleWin,battleWinHard,bossKill,login,dailyDone,gearReroll}`, written by `track()` (`src/systems/missions.js:67-71`).
- **Gear:** owned gear and its level (`src/systems/save.js:321-344`).
- **Tactical Challenge:** `stages.challenge.bestWave` (`src/systems/rewards.js:127`).
- **Freeplay:** bests (`src/systems/save.js:366-374`) and `fpm:` marks (`src/online/coop/rewards.js:302`).
- **Train A:** `sl:` lesson marks (`TA:src/systems/story.js:46-50`).
- **Codex:** `ribbonCount` / `campaignShowcase` (`CX:src/systems/unlocks.js:82-86`, `:137-141`).
- **Goal to confirm with balance:** `a_tc_30` (wave 30) is a placeholder.

### 2.3 Cosmetic retrofit of the 30 shipped achievements

- Ids, goals and rewards **do not change**. Only display fields are added.
- Shipped achievements carry no Plain or Sturdy boxes and no new rewards.

| Id | Adds | Why |
|---|---|---|
| `a_first_win` | blue ribbon | Every player owns a ribbon from the first day |
| `a_chapter_8` | gold ribbon, title "Academy Graduate" | "Chapter 8 Complete" is not a title |
| `a_gold_10` | title "Golden Student" | |
| `a_gold_40` | **SPECIAL ribbon: sunrise** (gold), title "Valedictorian" | Same as `SPEC:335`'s example |
| `a_sakura_10` | sakura ribbon, title "Sakura Sentinel" | |
| `a_bestiary_50` | title "Monster Scholar" | |
| `a_bestiary_100` | **SPECIAL ribbon: starlight** (navy), title "Walking Encyclopedia" | |
| `a_level_60` | title "Perfect Score" | |
| `a_awaken_5` | gold ribbon, title "Radiant Halo" | |
| `a_kills_25000` | title "Legend of the Academy" | |
| `a_boss_3` | blue ribbon, title "Assault Veteran" | |
| `a_reroll_10` | display rename "Gambler's Eye" → **"Keen Tinkerer"**; no title | The old name is a gambling reference (`src/data/missions.js:77`). The id stays, so it cannot pay again. |
| `a_pulls_10/100/300`, `a_units_all` | **nothing** | Recruit-driven, a spending signal (`SPEC:726`) |

**Totals:**
- 41 honor ribbons (8 special).
- 36 titles: 24 new + 10 retrofit + `fp_ashwing` / `fp_crimson` (`SPEC:333-334`).

---

## 3. Reward budget

### 3.1 Totals

From `econ/out.json` `budget`:

| Set | Count | Gems | Tickets | ≈ Recruits | Ornate / Radiant / Celestial | Box and item value (gem-eq.) | Ribbons (special) | Titles |
|---|---:|---:|---:|---:|---|---:|---|---:|
| **Launch** (retro + new counters + train A) | 56 | **5,910** | 4 | **53.3** | 46 / 16 / 4 | ≈ 28,450 | 30 (5) | 21 |
| Codex pack (ships with CX) | 5 | 720 | 1 | 7.0 | 0 / 4 / 1 | ≈ 3,900 | 3 (1) | 2 |
| Social pack (ships with S) | 1 | 0 | 0 | 0 | 1 / 0 / 0 | 180 | 1 (0) | 1 |
| **All new** | **62** | **6,630** | **5** | **60.3** | **47 / 20 / 5** | ≈ 32,500 | 34 (6) | 24 |
| *Shipped 30, for comparison* | *30* | *7,070* | *8 + one 10×* | *76.9* | *none* | | | |

**Against the baselines:**
- **The launch set pays 0.69 of a month** of active income (53.3 / 76.7 recruits). Everything new pays **0.79** (60.3).
- **One-time recruits rise** from ≈ 311 to ≈ 364 at launch (+17%) and ≈ 371 with everything (+19%).
- **Per achievement**, the new set pays **107 gems on average**, under half of the shipped 236. There are twice as many steps, and each pays a box.
- **It stays inside RE §3.1's proposal:** ≤ 6,000 gems at launch (5,910), a hard cap of 7,000 (6,630), ≤ 6 single tickets (5), and no 10× tickets.
- **It can't buy a spark** (200 recruits): 60 recruits is 0.30 of one.
- **Boxes give about 27,000 gem-equivalent** (47 × 180 + 20 × 576 + 5 × 1,440). This is where the "wow" lives. None of it turns into recruits.

### 3.2 Per tier

| Tier | When it's usually reached | Count | Gems each | Box | Other items | Total gems | Boxes O / R / C |
|---|---|---:|---:|---|---|---:|---|
| T1 | week 1 (chapters 1–3) | 4 | 20 | **none** | Study Guides, Fortune Dice | 80 | 0 / 0 / 0 |
| T2 | weeks 2–4 (chapters 4–6, first Gold medals, Bounty I–II) | 19 | 50 (0 on the 4 grind / overlap steps) | Ornate ×1 (×2 on the journal; none on Tidy Workshop, which gives a Lock Pin) | dice, fragments, Lock Pin | 750 | 19 / 0 / 0 |
| T3 | month 2 (chapters 7–8, Gold 20+, Bounty III, Total Assault) | 23 | 100 | Ornate ×2, **or** Radiant ×1 on headline steps (Fine-Tuner gives a Prism Die instead) | Lock Pin, Prism Dice, Codex book, fragments, Assault Tokens | 2,300 | 28 / 8 / 0 |
| T4 | month 3+ (Nightmare, all Gold, Legendary gear) | 11 | 200 (0 on `a_fp_seasons`) | Radiant ×1 (×2 on `a_mr_400`) | Akashic Tome, Prism Dice, one Ashwing Crown | 2,000 | 0 / 12 / 0 |
| T4★ capstone | months 3–12 | 5 | 300 | **Celestial ×1** | **Recruit Ticket ×1** | 1,500 | 0 / 0 / 5 |

**Hard caps, pinned by tests (§8):**
- new gems ≤ 7,000;
- single tickets ≤ 6, only on capstones;
- Celestial ≤ 5;
- Radiant ≤ 20 (16 at launch);
- specials ≤ 8.

**Why each number:**
- **T1 has no box.** A T1 step can be met before stage 2-1. A box there would open train A's Equipment gate early (`TA:src/systems/story.js:429-438`, gate `TA:src/data/story/lessons.js:173`). It would also be a power spike for a new player.
- **T2 gives an Ornate box.** It is the only box with a gem price (180, `src/data/shop.js:36`), so it reads as fair. It is a real upgrade before Workshop Yard III. Sturdy is skipped because anyone past 2-1 farms it on Workshop Yard II.
- **Radiant appears from T3**, when Total Assault runs (≈ 2.5 per Radiant box) are open. That keeps a chapter-5 player from leaping two rarities.
  - It is held to 20, which equals about 50 Ashwing TA runs.
- **Celestial is capstones only.** 5 is about a month of Bounty Exchange stock (1 a week, `src/data/shop.js:59`).
- **Recruit Tickets go only on the 5 capstones** a late save hasn't reached. The update day therefore pays **0 tickets** (§5).

### 3.3 Other items

| Item | Count in the new set | Fits | Rough value (RE §2.2) |
|---|---:|---|---:|
| Study Guide (`book_rare`) | 9 | T1 (book reward before gear opens) | 6 each |
| Sage's Codex / Akashic Tome | 1 / 1 | Level steps | 300 / 1,100 |
| Fortune Dice | 8 | gear steps | 40 each |
| Prism Dice | 4 | gear and boss capstones | ≈ 200 each |
| Lock Pin | 4 | gear steps, Colossus | 150 each |
| Star Fragment | 30 | awakening steps | ≈ 30 each |
| Ashwing Crown | 1 | `a_stars_50` only (the ★5 bottleneck, RE §2.2) | ≈ 600 |
| Assault Token | 20 | Boss Patrol | ≈ 4 each |

Never used: SSR Select, 10× tickets, Plain boxes, any new item id.

---

## 4. Save model and integrity

### 4.1 Where everything lives

| Data | Where | Kept when an older cached build loads and saves? | Can it double-pay? |
|---|---|---|---|
| **The claim** | `missions.achievements[id] = true`, set **before** the payout (`src/systems/missions.js:253-254`) | **Yes.** `cleanMissions` copies every truthy key, known or not (`src/systems/save.js:237`). This has been true since the first full build, and train A has the same line (`TA:src/systems/save.js:254`). | **No.** An older build can't claim an id it doesn't know: `claimAchievement` returns `'unknown'` (`src/systems/missions.js:249-250`; probe below). |
| **Gems and boxes paid** | `currencies.gems` and `items.gearbox_*` (`src/systems/inventory.js:36-42`) | **Yes.** Both are known ids (`src/systems/save.js:313-314`). | No |
| **New counters** (`coopWin`, `flawless`, `boxOpen`, `salvage`, `donate`, `gear:<rarity>`) | `missions.counters[key]`, written through `track()` (`src/systems/missions.js:67-71`) | **Yes, as numbers.** `cleanNumberMap` keeps any finite number and turns a numeric string into a number (`src/systems/save.js:137-145`, `:238`). Booleans and objects are dropped, so marks are always numbers. | No. Counters feed progress, never a payout. An older tab simply doesn't add to them while it runs. |
| **Honor ribbons and titles owned** | **Not stored.** Derived from claims (§6.2). | n/a, nothing to drop | No |
| **Equipped title and pins** | `sensei.title` / `sensei.pins` (`SPEC:265-281`) | Dropped by pre-profile builds, then restored from the server card (`SPEC:318`) | Cosmetic only |
| **"New honors" dot** | `missions.counters['ach:seen']`, a high-water count (§7.4) | Yes | No |
| **One-time intro** | `seenIntro` gains `'ach2'` (`src/systems/save.js:103`, `:433`, a string list kept by every build) | Yes | No |

**Probe** (`econ/check.mjs` §4: the live `migrateProfile`, which is exactly what an older cached tab runs).

The input save held:
- `missions.achievements.a_quad_40 = true` (an id this build doesn't know);
- counters `{ coopWin: 3, flawless: 2, 'ach:seen': 4, boxOpen: '7', bad: true }`;
- a top-level `honors` block.

Output: `claimKept: true`, counters `{ coopWin: 3, flawless: 2, 'ach:seen': 4, boxOpen: 7 }` (the boolean was dropped), `storedBlockKept: false`, and `claimAchievement(…, 'a_quad_40')` → `'unknown'`.

This is the reason cosmetics must never live in a new block. RS §1.6 shows the same result for `profile.honors`.

### 4.2 No mirror needed for claims, unlike `fpm:` and `pg:`

- **Why those features mirror.** The freeplay `fpm:` mark (`src/online/coop/rewards.js:221-237`, `:302`) and train A's `pg:` mark (`TA:src/systems/patchGifts.js:20`, `:46-65`) exist because their primary record lives in a block that older builds drop: `progress.freeplay` and `profile.patchGifts`.
- **Achievements already sit in the surviving place.** Their primary record is `missions.achievements`, the place those mirrors copy into for safety.
- **Rule for the build:** don't add an `ach:<id>` mirror. It would double the save growth and add a second source of truth.
- **The one thinking we reuse from `fpm:`:** anything new that gates a payout goes in `missions.*`, never in a new block.

### 4.3 No `SAVE_VERSION` bump, and no migration

- **The bump is harmful.** An older build that loads a newer-version save starts a fresh profile (`src/systems/save.js:472`). That fresh profile is written over the real save on `app-start` (`src/core/store.js:63-76`, `:89-98`), leaving the real save only in `BACKUP_KEY` (RS §1.6). Bumping would turn "an old tab is open" into "the save is replaced".
- **Nothing needs migrating.** Every new field is either computed live (metrics, cosmetics) or added on demand (counters through `ensure()`, `src/systems/missions.js:16-29`). A v0.1.27 save loads into the new build unchanged and simply shows its claimable achievements.
- **The only one-time step** is the `seenIntro` mark for the intro notice (§5.3), and it is idempotent.

### 4.4 Old tabs, two tabs, import, transfer, reset

| Event | What happens | Double pay? |
|---|---|---|
| An old tab saves after a new tab claimed | The profile is one JSON written by one `setItem` (`src/core/store.js:97`). The last writer wins, so the old tab's save can roll the claim **and** its gems back together. | No. This is the existing rollback risk, not a new one. Social's `saveRev` guard only protects tabs running the new build. |
| Two new-build tabs both claim | Each pays its own copy. The last write keeps exactly one payment. | No |
| Import an older export, or RESET67 | The whole profile is replaced (`src/core/store.js:100-110`), so claims and rewards go back together | No net gain |
| Transfer code | Copies the save to a new device (`src/ui/online/settingsOnline.js:39`, `:72`). Both copies can claim. | This is the same fork as every reward and every currency. Accepted: nothing server-side reads gems. |
| Dev gem code (removed) | Unrelated to achievements | — |

### 4.5 Permanence rules

1. **Never rename, reuse or delete an id.**
   - Renaming = a new claimable id (double gems), and the old title disappears.
   - To retire an achievement, keep the def with `retired: true`: hidden, not claimable, but it still grants its ribbon and title.
   - A frozen ledger test enforces this (§8).
2. **Never change the rewards of a shipped def.** Claimed and unclaimed players would end up with different totals. Display text, ribbons and titles may be added (§2.3).
3. **Metrics must not go backwards for unclaimed steps.**
   - "Get a Legendary piece" = `max(counters['gear:legendary'], owned now)`. `addGear` is the single entry point for drops and boxes (`src/systems/gear.js:135-143`), so it is the one place to count.
   - Kill steps use `max(stats.kills, counters.kill)`. That keeps the shipped `a_kills_*` monotone if their metric moves to the counter that includes co-op (`src/systems/missions.js:228`; RM §0.5).
4. **Codex steps read `progress.stages[id].modes`, which live `migrateProfile` drops** (`src/systems/save.js:358-376`).
   - An old tab can therefore make *unclaimed* ribbon progress go back.
   - Claims are safe. Ribbons and titles derive from the claim, so they are safe too.
5. **If CX ever turns ribbon gems on, use a counters mirror, not its planned bump** (`CX:docs/specs/CODEX_MODES.md:290-291`).
   - The mirror: `mr:<stageId>` = a 20-bit mask of paid ribbon cells, merged back on load like `fpm:`.
   - That is 40 keys, under 1 KB.

### 4.6 Claim gates (train A feature gates)

- **The rule.** `claimAchievement` refuses with `'locked'` while a reward's feature is closed:
  - any `gearbox_*` reward → `featureOpen(p, 'gear')`;
  - any `crown_*` reward → `featureOpen(p, 'awaken')`.
- **Where `featureOpen` comes from:** `TA:src/systems/story.js:445-452`. It returns `true` for legacy saves and opens on the lesson (gear at 2-1, awaken at 3-2, `TA:src/data/story/lessons.js:173-174`) or on evidence of use.
- **Effect:** a fast new player who meets "Defeat 1,000 slimes" in chapter 1 claims it after 2-1. Veterans are never locked.
- **Why claims, not data:** it is one central rule instead of per-def guesses about reachability.
- **UI:** `achievementList` returns `locked: 'gear'`. The row reads "Claim after stage 2-1". Locked rows don't light badges and are skipped by Claim all.
- **Build check:** look for an import cycle between `missions.js` and `story.js`. If there is one, pass a `gateOpen(p, featureId)` function into `claimAchievement`.

### 4.7 Counter size

- New keys: 5 counters, 5 `gear:<rarity>` counters and `ach:seen`, about 11 keys and under 300 B.
- Claims: 92 × about 20 B, under 2 KB.
- The transfer limit is 300 KB (RS §4 risk 11).
- No per-stage or per-ribbon marks are added.

---

## 5. Update day (retroactive unlocks)

### 5.1 Policy

**What becomes claimable:** everything already earned, at once, in full. There is no runtime cap, no back-pay mail and no pacing timer. The amount is bounded by the tier curve, not at runtime.

**Why:**
- Kids read "Claim → less than shown" or "come back tomorrow for the rest" as the game taking their reward.
- Veterans did the work.
- The payout is already bounded by design (table below).
- Claim all already merges any number of claims into one modal (`src/ui/screens/commissions.js:218-232`).

**Why not a back-pay mail.** A mail is a second ledger for the same reward, with its own once-only guard (`mail.delivered`, `src/systems/mail.js:79-81`), split from the achievement claim. One ledger per reward is the integrity rule.

### 5.2 Numbers

From `econ/out.json` `day1`. The archetype saves are RE §4.1's early, mid and late saves built with the live `createProfile`, with every shipped achievement already claimed. Launch set only (the Codex and social packs are not live yet).

| Save | New met | Gems | Tickets | Boxes O / R / C | ≈ Days of active income | Ribbons lit (new + retrofit) | Titles available |
|---|---:|---:|---:|---|---:|---:|---:|
| Early (day ~5, chapter 2–3) | 2 / 56 | **100** | 0 | 2 / 0 / 0 | 0.4 | 1 | 0 |
| **Mid** (day ~25, chapter 6) | 13 / 56 | **590** | 0 | 13 / 0 / 0 | 2.4 | 4 | 4 |
| Late (day ~60, campaign done) | 37 / 56 | **3,040** | 0 | 42 / 6 / 0 | 12.5 | 20 | 19 |

**Targets from RE §4.3:**

| Target | Result |
|---|---|
| Mid save ≤ 1,500 gems | **590** |
| Late save ≤ 4,000 gems | **3,040** |
| 0 tickets on update day | **0** for all three saves |

**Other checks:**
- **Mid save boxes.** 13 Ornate boxes ≈ 2,340 gem-equivalent: a solid gear bump for a chapter-6 player, with no Radiant before Total Assault.
- **Late save boxes.** 48 boxes ≈ 11,000 gem-equivalent. That is about 30 Workshop Yard III sweeps, which that save already farms for free. It matters for power only briefly, but it is a lot of opening (§7.3).
- **Stacking with train A.** That release pays 2,700 gems of patch-gift backlog to every save one release earlier. A late veteran therefore sees about 5,700 gems over two releases, ≈ 48 recruits, under one month of active income. The patch backlog is the same for everyone, while the achievement back pay scales with what the player did. That keeps it fair.
- **Codex pack later.** When it ships, ribbon progress starts at 0 for everyone except Nightmare × Last Petal, which comes free with each Nightmare medal (`CX:src/systems/unlocks.js:77`). The late save would meet only `a_mr_1`, worth 20 gems.

### 5.3 Rules for update day

1. **One intro notice, once.** "62 new achievements, Honor Ribbons and titles. You've already earned N!" with a button to open the Achievements tab. It is gated by `seenIntro` `'ach2'` and gives no reward.
2. **No-history achievements say so.** Achievements on new counters (`a_flawless_10`, `a_coop_*`, `a_box_25`, `a_salvage_100`, `a_donate_10`) show "Counts from v0.1.N" in their description, so nobody thinks past play was lost.
3. **Gear-ever steps are retroactive** through `max(counter, owned now)` (§4.5).
4. **Brand-new accounts** see the same list with nothing claimable. T1 steps arrive in week 1.

---

## 6. Cosmetic rewards as data

### 6.1 Shapes

In `src/data/missions.js`, extend the `A()` helper (`src/data/missions.js:43-46`) with an options bag:

```js
// One achievement def (new fields are optional; shipped defs gain only honor/title/rename)
{ id: 'a_quad_40', name: 'Academy Laureate', desc: '…', metric: 'allFourMedals', goal: 40,
  rewards: [{ id: 'gems', count: 300 }, { id: 'gearbox_legendary', count: 1 }, { id: 'ticket_recruit', count: 1 }],
  cat: 'campaign', tier: 5,
  honor: { look: 'prism', fx: 'prism' },   // Honor Ribbon; fx !== null ⇒ SPECIAL
  title: 'Academy Laureate',               // title text; the title id IS the achievement id
  since: '0.1.N' }                         // shown on "counts from" achievements only

export const HONOR_LOOKS = ['blue', 'navy', 'gold', 'sakura', 'prism'];
export const HONOR_FX = ['prism', 'sakura', 'starlight', 'sunrise'];
```

**Rules for these fields:**
- **`honor` and `title` sit beside `rewards`, never inside it.** A `{id,count}` entry for a cosmetic would have three effects:
  - it would land in `profile.items` (`src/systems/inventory.js:40`);
  - an older build would then drop it and flag the save `'lossy'` with a backup modal (`src/systems/save.js:314`, `:448`);
  - it would break the item tests (`tests/systems/items.test.js:26`).
- **The ribbon name.** Use "Honor Ribbon" in the UI and `honor` in code. "Ribbon" is already the gear slot (`src/data/types.js:233`) and the Codex mode ribbon (RM §0.7).
- **`look` and `fx` are client-side art keys.** They are never published, so changing art never touches the server.

### 6.2 Ownership is derived, never stored

New pure module `src/systems/honors.js`:

```js
export const earnedHonors = (p) => ACHIEVEMENTS.filter((a) => a.honor && p.missions?.achievements?.[a.id] === true);
export const earnedAchievementTitles = (p) => ACHIEVEMENTS.filter((a) => a.title && p.missions?.achievements?.[a.id] === true).map((a) => a.id);
export const honorCount = (p) => earnedHonors(p).length;
```

**What this gives:**
- **Nothing to lose.** An older build cannot drop a ribbon or a title, because no ribbon or title is written anywhere.
- **Nothing to repair.** If a retrofit adds a ribbon to a shipped achievement, every past claimer owns it at once.

**Changes to the profile spec. These must land before the profile is built:**
1. **Replace R5** (`SPEC:36`, `SPEC:335`), which reads "every claimed achievement except `a_pulls_*` is a title", with "achievements that declare `title`". Then `earnedTitles(p) = fp titles (SPEC:333-334) + earnedAchievementTitles(p)`.
   - **Why it has to happen now:** if the profile ships with R5 first, a player could equip "Chapter 3 Complete". A later build would then silently unequip it, and viewers would hide it.
2. **Achievement plaques draw the honor ribbon.** `pinEarned` for `ach:` pins stays "claimed and not `a_pulls_*`" (`SPEC:383`), but the plaque draws the honor ribbon when the def has one, and the trophy otherwise. This is exactly the "per-achievement badges in M3" slot (`SPEC:189`).
3. **Forward-compatible `cleanSensei`** (`SPEC:283-296`). Keep an equipped `title` or an `ach:` pin whose id this build does not know when all of these hold:
   - `missions.achievements[id] === true`;
   - the id matches `ID_RE`;
   - the id is not `a_pulls_*`.

   This build's own UI shows "—" for that title, but the card still publishes it. Without this rule, a build that has the profile but predates an achievement pack would erase the player's equipped title on load.

### 6.3 On the public card

**v1 needs no SQL change:**

| What | Card field | Server check | Viewer |
|---|---|---|---|
| Equipped title | `ttl: 'a_quad_40'` | `^[a-z][a-z0-9_]{0,23}$` (`SQL:135`, `:148`; `RULES:30`) | `TITLES[ttl]`. Unknown → hidden (`SPEC:453`). |
| Honor Ribbon on display | pin `'ach:a_quad_40'` (≤ 4 pins, `SQL:189`) | `ach:[a-z][a-z0-9_]{0,31}` (`SQL:193`; `RULES:34`) | Plaque with the ribbon art; special fx while on screen |
| Freeplay titles | `ttl: 'fp_crimson'` | same pattern | unchanged |

- **What the server checks.** It validates the **shape** only, never the earning: it cannot see the save.
- **What the client checks.** `cleanSensei` and `buildCard` publish only what this save earned (`SPEC:283-296`, `:425-436`).
- **A hacked client** could publish a valid-looking title it never earned. The viewer still renders only its *own* text and art for that id, so the worst case is a mis-claimed cosmetic. The spec already accepts this (`SPEC:468`).

**Optional, one line before the first SQL paste: `st.h`, the Honor Ribbon count.**
- **Where it shows:** next to the existing stats tiles (`SPEC:112`).
- **The amendment:**
  - `st` keys become `u s b k h` at `SQL:211`, with `h` 0–999 added beside the existing range checks (`SQL:212-215`) and to the `RULES:135` `lim` map;
  - `probe.mjs` and `parity.mjs` gain the case.
- **Cost now:** cheap, because the file has not been pasted (`SPEC:56`, `:610`).
- **If the file has already been pasted** when this ships, **skip `st.h`**. A new client would send a key the server refuses, and `valid_profile_card` would reject the **whole** card (`SQL:146`, `:211`). Versioning that is not worth it for one number.

**Viewer fallbacks** for a viewer whose build is older than the card:
- **Unknown `ttl`** → no title ribbon (`SPEC:453`).
- **Unknown `ach:` pin:**
  - Today `SPEC:465` drops it.
  - **Proposed instead:** a neutral plaque with the generic trophy and the viewer's own text, "A newer trophy · update to see it". It never shows the id string, which keeps `SPEC:451`'s rule. Version skew between friends is normal, and a missing plaque looks like a bug.
- **A known id whose `fx` this viewer can't draw** → the static `look`, which is always available.
- **Unknown card keys** (for example `st.h` seen by an older viewer): `cleanViewedCard` must read known fields one by one and **never run `validCard` as a whole-card gate on read** (`RULES:97-139`). Otherwise a single new key blanks the profile for every older viewer.

### 6.4 Special ribbons (what the "cool effect" is)

| Effect | Look | On | Built from (RM §3) |
|---|---|---|---|
| **Prism** | rainbow ring turning inside the pleats | `a_quad_40` Academy Laureate, `a_mr_800` Every Ribbon, Every Stage | the UR ring pattern: `transform: rotate`, masked (`src/ui/styles/ur.css:21-35`) |
| **Sakura Drift** | pink glints; CSS petals in the detail view | `a_sakura_40` Thousand-Petal Sentinel, `a_login_365` Academy Anniversary | glints on `opacity`/`transform`; petals like the lobby's (`src/ui/styles/meta-a.css:384-387`) |
| **Starlight** | navy disc with 2–3 twinkling stars | `a_fp_wyrm` Eclipse Watcher, `a_bestiary_100` Encyclopedia Sakura | glints |
| **Sunrise** | gold sheen (64 px and up) plus one glint at 40 px | `a_boss_sak_3` Dawn After the Storm, `a_gold_40` Valedictorian | sheen on `transform` |

**Effect budget (RM §3.3, measured):**
- at most 6 animating in the achievement list, and only rows on screen; off-screen rows get `animation: none`, never `paused`;
- at most 4 on the profile shelf;
- 1 large one in the detail view;
- a one-shot burst at the claim moment.

**Rules:**
- Animate only `transform` and `opacity`. No SMIL: it ignores Reduce Motion and cost about 1,070 ms per second in RM's test.
- Under `prefers-reduced-motion` **and** `html[data-reduce-motion]` (`src/ui/components.js:163-171`), set `animation: none !important`, as `ur.css` does at `:236-249`. The ring and glints stay visible but still.

**Economy note:** specials cost **0 gems**. Rarity is the point: 8 of 41 ribbons, all on steps that take months, plus one (365 days) any patient player reaches.

---

## 7. Claim UX rules

### 7.1 Claim one, claim all

**Shared claim behaviour:**
- **Marker first, then payout.** Both buttons call `claimAchievement`, which sets `missions.achievements[id]` before `addItems` (`src/systems/missions.js:253-254`). Claim all loops the same function over a snapshot (as `src/ui/screens/commissions.js:222-227` does). A double tap is therefore harmless: the second call returns `'claimed'`.
- **One commit, one modal.** Each claim action commits once (`store.commit('achievements')`) and shows one `showRewardsModal` (`src/ui/screens/stage.js:162-174`).
  - Rewards are merged (`mergeRewards`, `src/ui/screens/commissions.js:268-272`).
  - The modal's `extra` slot carries a **New Honors** strip (ribbons) and a **New Titles** strip (chips with an "Equip" link to Edit Profile → Title).
  - Each strip shows at most 8, then "+N more".
- **Order:** categories in tab order, then list order. This is deterministic, so tests and e2e can predict the modal.
- **Test ids:** `ach-claim-<id>` and `ach-claim-all`. Today's buttons have none (RS §3.1).

**Claim all specifics:**
- **Skips locked rows** (feature gate, §4.6). The modal adds "2 more after stage 2-1" when relevant.
- **Busy guard.** Disable the button until the modal opens. This is not needed for integrity, only to avoid two modals.

### 7.2 Notification badges

- **Lobby stays dots.** The Tasks dot (`src/ui/screens/lobby.js:375`) and the dock dot (`:529-536`) come from `commissionsNotice` (`:37-50`). They are dots, never numbers, so 37 claimable on update day doesn't show a scary "37". Locked rows don't count.
- **Commissions:** the Achievements tab dot (`src/ui/screens/commissions.js:73`).
- **Inside the tab:**
  - each category chip shows a small claimable count, displayed as "9+" above 9;
  - the header shows "Claim all (n)" (`src/ui/screens/commissions.js:218`).
- **Profile:** a dot on Edit Profile → Title / Honors while `honorCount(p) + titleCount(p) > counters['ach:seen']`. Opening that section sets the mark to the current total.
  - The mark is a number, so it survives older builds (§4.1). The derived count never goes down, so the dot can't come back by itself.
- **Battle results:** one line, "2 achievements ready to claim →", added next to the freeplay milestone lines (`src/ui/battle/results.js:348`). It comes from a pure `achievementsReady(before, after)`. It never auto-claims.
- **Performance:** compute the metric context once per `achievementList` call. Cache it for one render, because the lobby calls `commissionsNotice` three times per render (`src/ui/screens/lobby.js:296`, `:362`, `:529`).

### 7.3 When the Backpack gets many boxes at once

**At claim:**
- **Boxes never auto-open at claim.** `claimAchievement` stays free of RNG and pure (RS §5). Boxes land in `items` and are opened from the Backpack (`src/ui/screens/backpack.js:256-266`).
- **The rewards modal shows merged tiles** ("Ornate Gear Box ×42", "Radiant Gear Box ×6"). It has two actions:
  - **Open boxes:** opens exactly the boxes this claim granted, capped by what is owned. It calls `openGearBox(p, id, rng, n)` once per rarity (`src/systems/gear.js:149-161`; it has no per-call cap) and commits `'gearbox-open'` once.
  - **Later:** the boxes wait in Backpack → Equipment.

**Opening many:**
- **Summary results.** When more than 12 pieces come out, show counts by rarity and slot plus the best 6 cards, with "See all in Equipment". Don't render 48 gear cards in one modal; today's modal renders them all (`src/ui/screens/backpack.js:247-252`).
- **Backpack "Open all (n)".** Add it when a rarity has more than 10. Today only "×10" exists (`src/ui/screens/backpack.js:265`).
- **No cap.** There is no gear cap anywhere (searching `src` for gear limits finds none), so nothing overflows. The summary links to multi-salvage (v0.1.23).

**Other copy:**
- **Where to get.** Gear boxes list achievements automatically (`src/systems/inventory.js:164`). Change that label to "Achievements (n)" so one row doesn't stand for 52.
- **Box note.** The note "open into real gear the moment they drop" (`src/systems/inventory.js:169`) applies to drops only. Keep it on the Bounty row.

### 7.4 Sound

- `'achievements'` is already a claim reason (`src/audio/economy.js:24`): the claim sound plus gem and item sounds 120 ms apart (`:96-100`).
- Add the commit reason **`'achievements-special'`** for a claim batch that unlocks any special ribbon. It plays the claim cue, then the `awaken` jingle (`{ music: 'awaken' }`, as `src/audio/economy.js:57-59`). Add it to `tests/audio/manifest.test.js:103`.

### 7.5 Tab layout

- **Category chips:** Campaign, Bounty & Assault, Bestiary, Students, Gear, Battles, Freeplay, Academy Life, and Codex when it ships.
- **Sort order:** claimable first, then locked ("after 2-1"), then by progress.
- **Claimed rows** collapse under "Done (n)". Today all 30 rows render at once (`src/ui/screens/commissions.js:236-263`); 92 shouldn't.
- **Row icon:** the honor ribbon when the def has one, the trophy otherwise (`src/ui/screens/commissions.js:238`). Plus a small title chip.

---

## 8. Tests to add

| File | Covers |
|---|---|
| `tests/data/achievements.test.js` (new) | **Ids:** unique, match `^a_[a-z0-9_]+$`, ≤ 24 characters. **Metrics:** every one is in an exported `ACHIEVEMENT_METRICS` (today an unknown metric silently returns 0, `src/systems/missions.js:232`). **Rewards:** `ITEMS` ids only; none of `gearbox_common`, `ticket_recruit10`, `ticket_ssr_select` outside the shipped 30. **Grind steps:** no gems when `metric` is one of `counter.sweep`, `counter.spendCoins`, `counter.boxOpen`, `counter.salvage`, or stage clears. **Cosmetics:** `honor.look` ∈ `HONOR_LOOKS`, `fx` ∈ `HONOR_FX ∪ {null}`; titles are unique text of ≤ 24 characters; no title or honor on `a_pulls_*` / `a_units_all`. **Budget caps:** new gems ≤ 7,000; tickets ≤ 6, only on tier 5; Celestial ≤ 5; Radiant ≤ 20; specials ≤ 8. **T1:** no `gearbox_*` or `crown_*` on tier 1. |
| `tests/fixtures/achievements-shipped.json` + a test in the same file | **Ledger:** every shipped id with its rewards. Each must still exist with **identical** rewards; changing one takes a deliberate fixture edit. Starts with the 30 from `src/data/missions.js:55-79`. |
| `tests/systems/missions.test.js` (extend, next to `:99-120`) | **Claim cycle:** for one new def per metric kind: incomplete → claimable → ok → `'claimed'`. **Marker before payout:** after a claim, the marker and the gems are both set. **Claim all:** equals the sum of single claims, and a second Claim all pays nothing. **Feature gate:** a box-paying claim on a new non-legacy save before 2-1 → `'locked'`; after the gear lesson unlocks → ok; a legacy save → ok. **Monotone metrics:** `a_gear_leg` stays met after salvaging the piece; kills use `max(stats.kills, counters.kill)`. |
| `tests/systems/achievementCounters.test.js` (new) | **Where each counter increments:** `coopWin` only on a won `applyCoopResult` / `applyCoopClear`, once per battle (`src/online/coop/rewards.js:71-87`, `:99-105`). `flawless` only on a solo Normal/Hard win with `livesLeft === maxLives` (`src/sim/Sim.js:878-879`). `boxOpen` += n in `openGearBox`; `salvage` += 1 in `salvageGear` (`src/systems/gear.js:341`). `gear:<rarity>` in `addGear`. **Isolation:** sandbox and practice runs count nothing (the guard at `src/systems/rewards.js:90-93`). |
| `tests/systems/save.test.js` (extend) | **Old-build guarantees:** `migrateProfile` keeps unknown claimed ids and numeric new counters, and drops boolean ones. After a round trip, every claimed new id returns `'claimed'`. **No new top-level keys:** `createProfile()`'s key list is unchanged by this feature. **Version:** `SAVE_VERSION === 2`. |
| `tests/systems/honors.test.js` (new) | **Derived ownership:** `earnedHonors` / `earnedAchievementTitles` come from `missions.achievements` alone and survive deleting `sensei` and any other block. **Unknown ids:** claimed ids this build doesn't know are ignored. **Exclusions:** `a_pulls_*` never gives a title. **Retrofit:** shipped claimers get the retrofit cosmetics. |
| Profile tests (`SPEC:838-841`, extend) | **Forward compatibility:** `cleanSensei` keeps an unknown claimed title or `ach:` pin. **Patterns:** every title id passes `ID_RE` and every `ach:<id>` passes `PIN_RE`. **Viewer:** unknown `ttl` → none; unknown `ach:` pin → the neutral plaque with no id text; a card with an unknown key still renders its known fields. **If adopted:** `st.h` is in the SQL parity and probe cases. |
| `tests/integration/achievementsRetro.test.js` (new) | **Update-day bounds:** fixture builders port `econ/check.mjs`'s archetypes. Assert day-one gems ≤ 1,500 for mid and ≤ 4,000 for late, 0 tickets for all three, and 0 Radiant for mid. |
| `tests/audio/economy.test.js`, `tests/audio/manifest.test.js:103` | **New reason:** `'achievements-special'` → claim cue + `awaken` jingle. |
| `tests/systems/missions.test.js` F2P (`:211-226`) | **Unchanged:** the 28-day band of 70–80 holds. **Add:** the `Achievements` one-time row equals the sum of the defs. |
| `e2e/achievements.mjs` (new; both viewports) | **Claim flow:** a seeded late save shows the tab dot → Claim all (`ach-claim-all`) → the modal shows "Ornate Gear Box ×42", the New Honors and New Titles strips → Open boxes shows the summary → reload: still claimed and Claim all disabled. **Animation budget:** at most 6 running animations in the list at 844×390, and 0 under `data-reduce-motion`. **Gate:** a locked row on a new save shows "after stage 2-1". |

**Docs:**
- `docs/ECONOMY.md:44-55`: the Achievements row becomes 86 achievements, 12,980 gems and 22 ticket-recruits at launch. With the Codex and social packs it is 92 achievements, 13,700 gems and 23 ticket-recruits. Add a gear-box note, because `f2pIncomeSummary` counts gems and tickets only (`src/systems/missions.js:311-312`).
- `CONTRACTS.md` §5: the def fields, `honors.js`, the claim gate and the counter keys.

---

## 9. Questions for the owner

1. **Update day:** pay everything already earned at once (recommended; late save 3,040 gems + 48 boxes), or hold some back?
2. **Profile:** show an "Honor Ribbons: 23" count to visitors? It is one extra line in the profile SQL **before** it is first pasted (§6.3).
3. **Tactical Challenge goal:** is wave 30 the right number for `a_tc_30`?

---

## 10. Files

- `docs/specs/achievements/design-economy.md`: this design.
- `docs/specs/achievements/econ/catalog.mjs`: the 62 defs and the retrofit, as data.
- `docs/specs/achievements/econ/check.mjs`: validation, budget, update-day model and the save probe.
  - Run `node econ/check.mjs` for JSON, or add `--md` for the table in §2.2.
  - It imports the live repo read-only.
- `docs/specs/achievements/econ/out.json`: the output every number above comes from.
- `docs/specs/achievements/econ/table.md`: the generated catalog table.
