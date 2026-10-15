# Achievements expansion: catalogue and player journey

Oct 15, 2026. Design lens: **the catalogue and the player journey**. Nothing in any repo was edited.

**Owner request (Oct 15, verbatim):** "Can you add more achievements some will grant you like gear boxes alongside gems and maybe even some ribbons? Special ribbons will have a cool effect to them!! And maybe titles too?"

**Inputs:** `research-systems.md`, `research-economy.md`, `research-metrics-cosmetics.md` (this folder) and the Sensei Profile spec (`../profile/SPEC.md`). Code citations are live `/home/user/sakura-game` at `fddf01c` unless prefixed:
- **TA:** train A, `git -C /home/user/wt-traina show HEAD:<path>` (`917027e`);
- **SO:** `/home/user/wt-social` (`c731c6e`);
- **CX:** `origin/feature/codex-modes` (`6c7e0d0`).

**Source of truth:** every achievement row below is generated from `catalogue.mjs` (data) by `_cat/build.mjs`. The numbers (budget, pacing, update day) come from `_cat/eval.mjs`, which imports the live game's own `createProfile`, `achievementList`, stage, enemy, unit and item tables read-only. Run `node _cat/eval.mjs` to re-check after any change; it also fails on bad ids, name clashes, unknown reward ids, boxes or crowns before stage 2-1, and banned words.

---

## 0. The answer in one screen

| The owner asked for | This design |
|---|---|
| **(a) More achievements** | **112 new** achievements (30 → 142), in 13 categories, with ladders where natural. 77 work on data the live game already keeps (they count past play), 13 need a new counter, 5 come with train A, 2 with social, 11 with Codex modes and 4 later. |
| **(b) Gear boxes alongside gems** | 89 of the 112 new achievements give a gear box; 55 give a box **and** gems. Sturdy early, Ornate mid, Radiant on 12 headline steps, Celestial on 5 capstones. Never a Plain box, and no box on any step a new player can reach before 2-1, where Equipment opens. |
| **(c) Ribbons** | **52 Honor Ribbons**: 37 on new achievements and 15 added to existing ones (one per chapter, plus medal, bestiary and boss milestones). Tiers bronze, silver, gold and sakura. |
| **(d) Special ribbons with a cool effect** | **12 special ribbons** with 5 animated effects: **Prism**, **Sakura Drift**, **Starlight**, **Sunrise** and **Ember** (§4.2). Cheap on phones (transform/opacity only), still under Reduce Motion. |
| **(e) Titles** | **42 titles** from achievements (33 new, 9 on existing ones), plus the 2 freeplay titles already planned. All wholesome; none about looks, spending or luck (§5). |

Gem budget: **5,970 gems** over a player's whole life for all 112 new achievements (5,790 in the first release), inside the economy research's 6,000 target. On update day a mid-game veteran can claim **1,010 gems** at once and a late one **2,960**, with **0 tickets** (§8).

---

## 1. Rules this catalogue follows

### 1.1 Ids, claims and cosmetics (so nothing ever pays twice)

1. **Existing ids never change** (`src/data/missions.js:55-79`). Renaming one would make it claimable again (research-systems Risk 4). This design only adds cosmetics to existing ids and fixes one display name (§3).
2. **New ids** match `^[a-z][a-z0-9_]{0,23}$`. That is the profile card's title and frame pattern (profile SQL `:135`), so every achievement id can double as its title id with no server change. `eval.mjs` checks all 142.
3. **The claim stays `missions.achievements[id] = true`**, set before the payout (`src/systems/missions.js:253`). Every older build keeps every truthy key there, known or not (`src/systems/save.js:237`), so an old cached tab can never make a new achievement pay twice.
4. **Ribbons and titles are never stored and never `rewards`.** They are fields on the def (`honor`, `title`) and are derived from the claim, like the profile spec derives titles (SPEC.md:329-338).
   - A cosmetic in `rewards` would be an unknown item. Older builds drop it and flag the save "lossy" (`save.js:314`, `:448`), and two tests forbid it (research-systems §4).
   - So `rewards` stays items-only. Gear boxes are ordinary items (`src/data/items.js:167-174`) and need no new code.
5. **New lifetime counters go in `missions.counters`** (kept by every build, `save.js:238`), written with `track()` (`missions.js:67-71`).
   - Plain event names: `coopWin`, `ults`, `eventWin`, `weeklyDone`, `salvage`, `clanBossHit`, `donate`.
   - Non-event marks use an `ach:` prefix: `ach:flawless`, `ach:squad3`, `ach:closeCall`, `ach:welcomeBack`. Event names never contain `:`, so they can't collide.
6. **Fixed goals.** New achievements use fixed numbers ("Discover 55 kinds of enemies", "Have 15 students") instead of "all" or "%", so a content update can't push a "claimable" achievement back (research-systems Risk 5).

### 1.2 The def shape (buildable)

```js
// src/data/missions.js: optional new fields; `rewards` stays [{ id, count }] of known items
{ id, name, desc, metric, goal, rewards, param?,
  cat: 'medals',                                        // category tab
  honor?: { name, tier: 'bronze'|'silver'|'gold'|'sakura',
            fx: null|'prism'|'sakura'|'starlight'|'sunrise'|'ember', emblem },
  title?: 'Eternal Sakura',                             // title id = achievement id
  hidden?: true, hint?: '…' }
```

- The data field is `honor`, not `ribbon`. "Ribbon" already means a gear slot (`src/data/types.js:233`) and a Codex mode ribbon (CX `src/data/modes.js:30-31`).
- **Rows ship with their data.** A Codex row is added by the release that merges Codex modes, a social row by the social release, and so on.

### 1.3 Reward ladder (from research-economy §3)

| Step | Usually reached | Gems | Box | Extras |
|---|---|---:|---|---|
| Starter | hour 1 (before 2-1) | 20-30 | **none** (no box or crown before 2-1, TA `src/data/story/lessons.js:172-175`) | books, coins |
| T1 | week 1 | 20-30 | Sturdy | dice, books |
| T2 | weeks 2-4 | 50 | Ornate, or Sturdy ×2 | tokens, Lock Pin |
| T3 | month 2 | 100 | Ornate ×2 | Prism Dice, books |
| T4 headline | month 3+ | 200-300 | Radiant (12 in the set) or Celestial (5) | Recruit Ticket on 5 capstones only; 1 Ashwing Crown |
| Grindable or already-paid steps | any | **0** | boxes and items only | — |

- **No gems** on steps a player can grind by tapping: gear count and arena runs, where sweeps count (`src/systems/rewards.js:180-200`).
- **No gems** on steps whose event already pays gems:
  - freeplay (milestones pay 50/100/200, `src/online/coop/rewards.js:35-40`);
  - story lessons and scenes (TA `lessons.js:178-187`);
  - Codex ribbons (to avoid paying twice if ribbon gems are switched on later; research-economy §3.1 point 5).

---

## 2. The catalogue

112 new achievements. **Metric** names the value the game computes; new metrics are defined in §9. **Available**:
- *Live*: counts past play from day one;
- *Live, new counter*: counts from the release that adds it;
- *Train A* / *Social* / *Codex* / *Later*: ships with that feature.

**Reached** is when a typical new player gets it (§7).

| Category | New | Gems | Boxes (S / O / R / C) | Ribbons | Titles |
|---|---:|---:|---|---:|---:|
| Campaign | 3 | 80 | 1 / 1 / 0 / 0 | 0 | 0 |
| Medals | 10 | 1,280 | 0 / 11 / 2 / 1 | 5 | 2 |
| Battle record | 9 | 630 | 4 / 12 / 0 / 0 | 2 | 3 |
| Bounty, Total Assault & Tactical Challenge | 13 | 950 | 3 / 9 / 1 / 1 | 3 | 4 |
| Freeplay | 8 | 0 | 0 / 8 / 2 / 1 | 5 | 2 |
| Co-op & clan | 8 | 180 | 5 / 6 / 1 / 0 | 3 | 2 |
| Students | 12 | 1,070 | 3 / 5 / 2 / 1 | 3 | 2 |
| Gear | 9 | 520 | 3 / 3 / 1 / 0 | 1 | 1 |
| Bestiary | 7 | 430 | 3 / 8 / 0 / 0 | 0 | 4 |
| Story | 5 | 0 | 2 / 3 / 0 / 0 | 2 | 2 |
| School life | 9 | 830 | 6 / 7 / 2 / 0 | 3 | 3 |
| Codex modes | 11 | 0 | 0 / 16 / 1 / 1 | 7 | 6 |
| Hidden | 8 | 0 | 4 / 2 / 0 / 0 | 3 | 2 |

### 2.1 Campaign

The story path. The 8 chapter achievements already exist (§3); they now also give one Honor Ribbon per chapter.

| Id | Name | What to do | Metric | Rewards | Ribbon / title | Available | Reached |
|---|---|---|---|---|---|---|---|
| `a_clear_10` | Off to Class | Clear 10 campaign stages. | `stagesCleared ≥ 10` | **30 gems** + **Sturdy box** |  | Live | Week 1 |
| `a_sweep_1` | Quick Study | Sweep a stage you have cleared on Hard. | `counters.sweep ≥ 1` | Academy Textbook ×2 |  | Live | Week 1 |
| `a_clear_25` | Halfway Up the Hill | Clear 25 campaign stages. | `stagesCleared ≥ 25` | **50 gems** + **Ornate box** |  | Live | Month 1 |

### 2.2 Medals

Ladders for each medal colour (Bronze = Easy, Silver = Normal, Gold = Hard, Sakura = Nightmare), plus "all four medals". There are four medal-set ribbons: Bronze Bouquet, Silver Lining, Valedictorian and Eternal Sakura.

| Id | Name | What to do | Metric | Rewards | Ribbon / title | Available | Reached |
|---|---|---|---|---|---|---|---|
| `a_gold_1` | Going for Gold | Earn your first Gold medal (Hard) on a campaign stage. | `medals(hard) ≥ 1` | **30 gems** + Study Guide ×3 |  | Live | Week 1 |
| `a_gold_25` | Gold Standard | Earn Gold medals on 25 campaign stages. | `medals(hard) ≥ 25` | **100 gems** + **Ornate box** ×2 |  | Live | Month 2 |
| `a_bronze_40` | Bronze Bouquet | Earn Bronze medals (Easy) on all 40 campaign stages. | `medals(easy) ≥ 40` | **50 gems** + **Ornate box** | Ribbon: Bronze Bouquet Ribbon (bronze) | Live | Months |
| `a_silver_40` | Silver Lining | Earn Silver medals (Normal) on all 40 campaign stages. | `medals(normal) ≥ 40` | **100 gems** + **Ornate box** ×2 | Ribbon: Silver Lining Ribbon (silver) | Live | Month 2 |
| `a_sakura_20` | Blossom in the Storm | Earn Sakura medals (Nightmare) on 20 campaign stages. | `medals(nightmare) ≥ 20` | **200 gems** + **Radiant box** |  | Live | Months |
| `a_sakura_40` | Eternal Sakura | Earn Sakura medals on all 40 campaign stages. | `medals(nightmare) ≥ 40` | **300 gems** + **Celestial box** + **Recruit Ticket** | Ribbon: Eternal Sakura Ribbon (sakura, **special: Sakura Drift**)<br>Title: *Eternal Sakura* | Live | Months |
| `a_quad_1` | Medal Quartet | Earn all four medals on one campaign stage. | `medalsAll ≥ 1` | **50 gems** + **Ornate box** |  | Live | Month 1 |
| `a_quad_40` | Perfect Attendance | Earn all four medals on every campaign stage. | `medalsAll ≥ 40` | **300 gems** + **Radiant box** + **Ornate box** ×2 + **Recruit Ticket** | Ribbon: Perfect Attendance Ribbon (gold, **special: Sunrise**)<br>Title: *Perfect Attendance* | Live | Months |
| `a_goldchap_1` | Golden Chapter | Earn Gold medals on every stage of one chapter. | `chapterSets(hard) ≥ 1` | **50 gems** + **Ornate box** |  | Live | Month 1 |
| `a_sakurachap_1` | Midnight Blossom | Earn Sakura medals on every stage of one chapter. | `chapterSets(nightmare) ≥ 1` | **100 gems** + **Ornate box** ×2 | Ribbon: Midnight Blossom Ribbon (sakura) | Live | Month 2 |

### 2.3 Battle record

| Id | Name | What to do | Metric | Rewards | Ribbon / title | Available | Reached |
|---|---|---|---|---|---|---|---|
| `a_wins_100` | Patrol Veteran | Win 100 battles. | `counters.battleWin ≥ 100` | **50 gems** + **Sturdy box** ×2 |  | Live | Month 1 |
| `a_wins_500` | Seasoned Sentinel | Win 500 battles. | `counters.battleWin ≥ 500` | **100 gems** + **Ornate box** ×2 |  | Live | Month 2 |
| `a_hardwins_100` | Hard Worker | Win 100 battles on Hard or Nightmare. | `counters.battleWinHard ≥ 100` | **100 gems** + **Ornate box** ×2 | Title: *Hard Worker* | Live | Month 2 |
| `a_kills_100k` | Petal Storm | Defeat 100,000 enemies (co-op and freeplay count). | `counters.kill ≥ 100,000` | **150 gems** + **Ornate box** ×2 | Ribbon: Petal Storm Ribbon (gold) | Live | Month 2 |
| `a_bosskill_100` | Boss Patrol | Defeat 100 minibosses or bosses. | `counters.bossKill ≥ 100` | **50 gems** + **Ornate box** ×2 + Assault Token ×20 |  | Live | Month 2 |
| `a_flawless_10` | Not a Scratch | Win 10 battles on Hard without losing a single heart. | `counters.ach:flawless ≥ 10` | **100 gems** + **Ornate box** ×2 | Ribbon: Spotless Shield Ribbon (silver)<br>Title: *Perfect Defense* | Live, new counter | Month 2 |
| `a_squad3` | Small but Mighty | Win a stage from chapter 5 onward on Hard or Nightmare with 3 or fewer different students on the field (your hero doesn't count). | `counters.ach:squad3 ≥ 1` | **50 gems** + **Ornate box** | Title: *Small but Mighty* | Live, new counter | Month 2 |
| `a_ults_100` | Signature Move | Use your hero's ultimate skill 100 times. | `counters.ults ≥ 100` | **Sturdy box** ×2 |  | Live, new counter | Week 1 |
| `a_hero_25` | Commander's Rise | Your hero reaches Lv 25 during a battle. | `counters.heroMax ≥ 25` | **30 gems** + **Ornate box** |  | Later | With hero rework |

- Kills use `counters.kill`, which includes co-op and freeplay (`coop/rewards.js:84`, `:275`). `stats.kills` does not (research-economy §5.5).
- "Not a Scratch", "Small but Mighty" and "By a Petal" read `livesLeft`, `maxLives` and `stats.towerUnits` from `Sim.result()` (`src/sim/Sim.js:878-879`, `:889`). Today the save keeps none of these (`rewards.js:85-161`), so each gets a new counter.
- "Signature Move" counts **hero** ultimates: `ultsUsed` is only incremented in `src/sim/hero.js:179`.

### 2.4 Bounty, Total Assault and Tactical Challenge

| Id | Name | What to do | Metric | Rewards | Ribbon / title | Available | Reached |
|---|---|---|---|---|---|---|---|
| `a_bounty_1` | Supply Run | Clear any Bounty stage. | `kindClear(resource) ≥ 1` | **20 gems** + Bounty Token ×5 |  | Live | Week 1 |
| `a_bounty_5` | Errand Expert | Clear 5 different Bounty stages. | `kindClear(resource) ≥ 5` | **50 gems** + Bounty Token ×10 |  | Live | Month 1 |
| `a_bounty_15` | Supply Captain | Clear all 15 Bounty stages. | `kindClear(resource) ≥ 15` | **100 gems** + **Ornate box** ×2 | Ribbon: Supply Captain Ribbon (silver)<br>Title: *Supply Captain* | Live | Month 2 |
| `a_bounty_gold_15` | Expedition Gold | Earn Gold medals on all 15 Bounty stages. | `kindMedals(resource:hard) ≥ 15` | **100 gems** + **Ornate box** ×2 |  | Live | Month 2 |
| `a_lib_100` | Bookworm | Run the Library Courtyard 100 times (sweeps count). | `arenaRuns(res-books) ≥ 100` | Sage's Codex + Academy Textbook ×5 | Title: *Bookworm* | Live | Month 2 |
| `a_yard_100` | Workshop Regular | Run the Workshop Yard 100 times (sweeps count). | `arenaRuns(res-gear) ≥ 100` | Lock Pin + Prism Dice |  | Live | Month 2 |
| `a_event_10` | Festival Helper | Win 10 Bounty battles during the weekly double-drop event. | `counters.eventWin ≥ 10` | **Sturdy box** ×2 + Bounty Token ×10 |  | Live, new counter | Month 2 |
| `a_boss_1` | Assault Debut | Clear any Total Assault boss. | `bossClears ≥ 1` | **50 gems** + **Ornate box** |  | Live | Month 1 |
| `a_boss_gold_3` | Assault Ace | Earn Gold medals on all three Total Assault bosses. | `kindMedals(boss:hard) ≥ 3` | **100 gems** + **Ornate box** ×2 |  | Live | Months |
| `a_boss_sakura_3` | Unshakable | Earn Sakura medals on all three Total Assault bosses. | `kindMedals(boss:nightmare) ≥ 3` | **200 gems** + **Celestial box** + Ashwing Crown | Ribbon: Ember Crest Ribbon (gold, **special: Ember**)<br>Title: *Unshakable* | Live | Months |
| `a_tc_10` | Colosseum Debut | Reach wave 10 in the Tactical Challenge. | `challengeWave ≥ 10` | **30 gems** + **Sturdy box** |  | Live | Week 1 |
| `a_tc_40` | Crowd Favorite | Reach wave 40 in the Tactical Challenge. | `challengeWave ≥ 40` | **100 gems** + **Ornate box** ×2 |  | Live | Month 2 |
| `a_tc_70` | Colosseum Legend | Reach wave 70 in the Tactical Challenge. | `challengeWave ≥ 70` | **200 gems** + **Radiant box** + **Recruit Ticket** | Ribbon: Colosseum Laurel Ribbon (gold, **special: Ember**)<br>Title: *Colosseum Legend* | Live | Months |

- **Box gate.** Bounty tier I opens after 1-5 (`src/data/stages.js:748-752`), before 2-1, so the first two Bounty steps pay tokens instead of a box.
- **Tactical Challenge** needs 2-5 (`stages.js:998`), and its fixed boss waves run to the Ashwing Matriarch at wave 70 (`stages.js:989`). Wave 70 is the capstone; tune it after a balance run (owner question 3).

### 2.5 Freeplay

No gems: freeplay milestones already pay gems once per tier (`coop/rewards.js:35-40`). These steps give boxes and ribbons on top.

| Id | Name | What to do | Metric | Rewards | Ribbon / title | Available | Reached |
|---|---|---|---|---|---|---|---|
| `a_fp_extra_10` | Encore! | Keep going: clear 10 waves past a stage's goal in freeplay. | `freeplayExtra ≥ 10` | Academy Textbook ×2 + 10,000 coins |  | Live | Week 1 |
| `a_fp_stages_10` | Field Trip Circuit | Clear 10 waves past the goal on 10 different stages. | `freeplayStages(+10) ≥ 10` | **Ornate box** ×2 |  | Live | Months |
| `a_fp_blossom_100` | Hundred-Wave Bloom | Reach wave 100 in Blossom freeplay. | `freeplayBest(blossom) ≥ 100` | **Ornate box** | Ribbon: Blossom Marathon Ribbon (bronze) | Live | Month 2 |
| `a_fp_tempest_100` | Eye of the Storm | Reach wave 100 in Tempest freeplay. | `freeplayBest(tempest) ≥ 100` | **Ornate box** ×2 | Ribbon: Tempest Ribbon (silver) | Live | Months |
| `a_fp_crimson_100` | Crimson Moonrise | Reach wave 100 in Crimson Moon freeplay. | `freeplayBest(crimson) ≥ 100` | **Radiant box** | Ribbon: Crimson Moon Ribbon (gold) | Live | Months |
| `a_fp_200` | Two Hundred Strong | Reach wave 200 in any freeplay tier. | `freeplayBest(any) ≥ 200` | **Ornate box** ×3 | Title: *Marathon Sentinel* | Live | Months |
| `a_fp_boss_4` | Starlight Vigil | Defeat all four freeplay bosses: Foundry Titan, Gloom Regent, Hyakki Daimyo and Eclipse Wyrm. | `enemySetKilled(4 fp bosses) ≥ 4` | **Celestial box** | Ribbon: Starlight Vigil Ribbon (gold, **special: Starlight**)<br>Title: *Starlight Guardian* | Live | Months |
| `a_fp_crimson_boss` | Under the Crimson Moon | Defeat the Ashwing Matriarch in Crimson Moon freeplay. | `counters['fpm:crimson:matriarch']` | **Radiant box** + Prism Dice | Ribbon: Crimson Crest Ribbon (gold, **special: Starlight**) | Live | Months |

- **Retroactive.**
  - Best waves are read from `freeplayBest` and `coopBestWave` on each stage (`save.js:366-374`).
  - The Crimson Moon Matriarch kill is read from the `fpm:crimson:matriarch` mark (`coop/rewards.js:302`), which survives older builds.
  - The four freeplay bosses are read from `bestiary[id].kills`. These bosses are outside the bestiary % denominator (research-metrics-cosmetics §1.2).
- **No duplicate title.** "Under the Crimson Moon" has no title because the milestone already gives *Crimson Slayer* (SPEC.md:334).

### 2.6 Co-op and clan (social later)

| Id | Name | What to do | Metric | Rewards | Ribbon / title | Available | Reached |
|---|---|---|---|---|---|---|---|
| `a_coop_1` | Study Buddies | Win a co-op battle. | `counters.coopWin ≥ 1` | **30 gems** + Academy Textbook ×2 |  | Live, new counter | Week 1 |
| `a_coop_10` | Team Spirit | Win 10 co-op battles. | `counters.coopWin ≥ 10` | **50 gems** + **Sturdy box** ×2 |  | Live, new counter | Month 2 |
| `a_coop_50` | Better Together | Win 50 co-op battles. | `counters.coopWin ≥ 50` | **100 gems** + **Radiant box** | Ribbon: Friendship Knot Ribbon (gold)<br>Title: *Team Player* | Live, new counter | Months |
| `a_coop_fp_100` | Relay Marathon | Reach wave 100 in co-op freeplay. | `coopBest(any) ≥ 100` | **Ornate box** ×2 |  | Live | Months |
| `a_clanboss_10` | Clan Boss Challenger | Battle your clan's boss 10 times. | `counters.clanBossHit ≥ 10` | **Sturdy box** ×2 |  | Live, new counter | Month 1 |
| `a_clanboss_50` | Clan Stalwart | Battle your clan's boss 50 times. | `counters.clanBossHit ≥ 50` | **Ornate box** ×2 | Ribbon: Clan Crest Ribbon (silver) | Live, new counter | Months |
| `a_donate_1` | Lending a Hand | Send a clanmate a piece of gear they asked for. | `counters.donate ≥ 1` | **Sturdy box** |  | Social | Month 1 of social |
| `a_donate_25` | Generous Heart | Help clanmates with 25 gear donations. | `counters.donate ≥ 25` | **Ornate box** ×2 | Ribbon: Kind Heart Ribbon (silver)<br>Title: *Helping Hand* | Social | Months |

**Kid-safety rule.** None of these counts friends, messages, invites or clan joins. That would push kids to add strangers (research-metrics-cosmetics §0.8).
- Co-op wins need a new counter: today `applyCoopResult` only tracks kills (`coop/rewards.js:71-87`).
- Clan boss hits are counted after `submitBossDamage` resolves (`src/ui/battle/controller.js:819`).
- Donations are counted in `finalizeDonation` after the key is recorded (SO `src/online/donateLedger.js:84`). That function is idempotent per key.

### 2.7 Students (growth and collection)

| Id | Name | What to do | Metric | Rewards | Ribbon / title | Available | Reached |
|---|---|---|---|---|---|---|---|
| `a_formation_8` | Full Formation | Fill every student slot in your formation (8 students and a hero). | `formationSize ≥ 8` | **20 gems** + Study Guide ×3 |  | Live | Hour 1 |
| `a_break_1` | Breaking Through | Open a student's first breakthrough gate. | `maxBreakthrough ≥ 1` | **20 gems** + Study Guide ×3 |  | Live | Hour 1 |
| `a_lv20_5` | Study Group | Raise 5 students to level 20. | `unitsAtLevel(20) ≥ 5` | **30 gems** + **Sturdy box** |  | Live | Month 1 |
| `a_lv40_5` | Honors Class | Raise 5 students to level 40. | `unitsAtLevel(40) ≥ 5` | **100 gems** + Sage's Codex |  | Live | Month 2 |
| `a_lv60_3` | Top of the Class | Raise 3 students to level 60. | `unitsAtLevel(60) ≥ 3` | **200 gems** + Akashic Tome + **Radiant box** |  | Live | Months |
| `a_lv60_9` | Graduating Class | Raise 9 students to level 60: a whole formation. | `unitsAtLevel(60) ≥ 9` | **300 gems** + **Celestial box** + **Recruit Ticket** | Ribbon: Graduation Ribbon (gold, **special: Sunrise**)<br>Title: *Head of the Class* | Live | Months |
| `a_units_15` | Lively Classroom | Have 15 students and heroes at the academy. | `unitsOwned ≥ 15` | **50 gems** + **Sturdy box** ×2 |  | Live | Month 1 |
| `a_stars_25` | Constellation | Earn 25 awakening stars across all your students. | `awakenStars ≥ 25` | **100 gems** + **Ornate box** + Star Fragment ×20 |  | Live | Months |
| `a_ur_1` | Rainbow Bright | Awaken an SSR student all the way to UR (★5). | `urOwned ≥ 1` | **100 gems** + **Radiant box** | Ribbon: Rainbow Ribbon (gold, **special: Prism**) | Live | Month 2 |
| `a_units_30` | Whole School | Have 30 students and heroes at the academy. | `unitsOwned ≥ 30` | **100 gems** + **Ornate box** ×2 | Ribbon: Whole School Ribbon (gold) | Later | With the roster merge |
| `a_bond_10` | Best Friends | Reach bond level 10 with any student. | `bondMax ≥ 10` | **50 gems** + **Ornate box** | Title: *Trusted Sensei* | Later | With the City |
| `a_outfit_3` | Dress-Up Day | Choose an outfit for 3 students. | `outfits ≥ 3` | **Ornate box** |  | Later | With outfits |

- "Rainbow Bright" uses the UR rule: an SSR at ★5 (`src/ui/rarity.js:32-37`). Move that one-line check into `systems/` first, because systems must not import `ui/`.
- "Best Friends" waits for the City: bond is 0 until then (`src/data/lobbyArt.js:115-116`).
- **Never counted:** recruit-driven goals (Potential, recruit counts, owning SSRs) get no new achievements and no titles. That rule comes from SPEC.md:726.

### 2.8 Gear

| Id | Name | What to do | Metric | Rewards | Ribbon / title | Available | Reached |
|---|---|---|---|---|---|---|---|
| `a_fullset_1` | Fully Equipped | Fill all three gear slots on one student: charm, ribbon and shoes. | `fullSets(any) ≥ 1` | **20 gems** + Fortune Dice ×2 |  | Live | Week 1 |
| `a_gear_25` | Accessory Box | Collect 25 pieces of gear (salvaged ones count). | `gearReceived ≥ 25` | **Sturdy box** + Fortune Dice |  | Live | Month 1 |
| `a_gear_100` | Gear Collector | Collect 100 pieces of gear (salvaged ones count). | `gearReceived ≥ 100` | **Sturdy box** ×2 + Fortune Dice ×2 |  | Live | Month 1 |
| `a_gear_mythic` | Crimson Moon Find | Own a Radiant (Mythic) piece of gear. | `gearOwned(mythic) ≥ 1` | **50 gems** + Lock Pin |  | Live | Month 1 |
| `a_gear_legend` | Eternal Sakura Find | Own a Celestial (Legendary) piece of gear. | `gearOwned(legendary) ≥ 1` | **100 gems** + Lock Pin + Prism Dice |  | Live | Month 2 |
| `a_plus10_1` | Polished to +10 | Enhance a piece of gear to +10. | `gearAtMax(any) ≥ 1` | **50 gems** + **Ornate box** |  | Live | Month 1 |
| `a_plus10_10` | Master Polisher | Own 10 pieces of gear at +10. | `gearAtMax(any) ≥ 10` | **100 gems** + **Ornate box** ×2 |  | Live | Month 2 |
| `a_legend10` | Celestial Craft | Enhance a Celestial (Legendary) piece to +10. | `gearAtMax(legendary) ≥ 1` | **200 gems** + **Radiant box** | Ribbon: Gearsmith Ribbon (gold)<br>Title: *Gearsmith* | Live | Month 2 |
| `a_salvage_100` | Tidy Workshop | Salvage 100 pieces of gear. | `counters.salvage ≥ 100` | Fortune Dice ×5 |  | Live, new counter | Month 2 |

- "Collect N pieces" reads `profile.seq.gear`, the lifetime gear counter (`src/systems/gear.js:139`, kept by `save.js:341-343`). It counts salvaged pieces, so it is retroactive.
- Sweeps add gear, so these steps pay no gems.
- **Why "Accessory Box" can give a box before 2-1.** It needs 25 owned pieces. Owning gear already opens Equipment through the same "evidence" rule (TA `lessons.js:172-175`), so the box changes nothing.

### 2.9 Bestiary

| Id | Name | What to do | Metric | Rewards | Ribbon / title | Available | Reached |
|---|---|---|---|---|---|---|---|
| `a_family_1` | Family Portrait | Discover every member of one enemy family. | `familiesFound ≥ 1` | **30 gems** + **Sturdy box** |  | Live | Week 1 |
| `a_family_6` | Family Reunion | Discover every member of 6 enemy families. | `familiesFound ≥ 6` | **100 gems** + **Ornate box** ×2 |  | Live | Month 1 |
| `a_found_55` | Field Guide | Discover 55 kinds of enemies. | `enemiesFound ≥ 55` | **100 gems** + **Ornate box** |  | Live | Month 2 |
| `a_slime_1000` | Slime Wrangler | Defeat 1,000 slimes. | `familyKills(slime) ≥ 1,000` | **50 gems** + **Sturdy box** ×2 | Title: *Slime Wrangler* | Live | Week 1 |
| `a_ghost_500` | Night Light | Defeat 500 ghosts. | `familyKills(ghost) ≥ 500` | **50 gems** + **Ornate box** | Title: *Night Light* | Live | Month 1 |
| `a_oni_500` | Festival Peacekeeper | Defeat 500 oni. | `familyKills(oni) ≥ 500` | **50 gems** + **Ornate box** ×2 | Title: *Festival Peacekeeper* | Live | Month 2 |
| `a_dragon_200` | Dragon Tamer | Defeat 200 dragons. | `familyKills(dragon) ≥ 200` | **50 gems** + **Ornate box** ×2 | Title: *Dragon Tamer* | Live | Month 2 |

- **Families:** 12 families, each with every discoverable member (`_cat/disc.mjs`). The smallest families (lizard, beast) finish in chapters 2 and 4.
- **Family kills** read `bestiary[id].kills`. Sweeps never add kills (`rewards.js:177`), so these need real battles and can pay gems.

### 2.10 Story (train A)

| Id | Name | What to do | Metric | Rewards | Ribbon / title | Available | Reached |
|---|---|---|---|---|---|---|---|
| `a_journal_4` | Good Listener | Claim 4 lessons from the Captain's Journal. | `lessons ≥ 4` | 5,000 coins + Study Guide ×3 |  | Train A | Hour 1 |
| `a_journal_12` | Attentive Sensei | Claim all 12 lessons from the Captain's Journal. | `lessons ≥ 12` | **Ornate box** | Ribbon: Journal Ribbon (silver)<br>Title: *Attentive Sensei* | Train A | Month 1 |
| `a_story_1` | Story Time | See every story scene of one chapter. | `storyChapters ≥ 1` | Study Guide ×3 |  | Train A | Hour 1 |
| `a_story_4` | Page Turner | See every story scene of 4 chapters. | `storyChapters ≥ 4` | **Sturdy box** ×2 |  | Train A | Month 1 |
| `a_story_8` | Storyteller | See every story scene of all 8 chapters. | `storyChapters ≥ 8` | **Ornate box** ×2 | Ribbon: Storybook Ribbon (gold)<br>Title: *Storyteller* | Train A | Month 2 |

- **Data:** lessons are the `sl:` marks and scenes the `ss:` marks in `missions.counters` (TA `src/systems/story.js:49-50`, `:183-184`). A chapter's scenes come from `chapterScenes(c)` (TA `src/data/story/index.js:49-51`).
- **Wording:** a skipped scene also writes `ss:`, so the text says "see every scene", not "watch".
- **Not rewarded:** the opening is left out, because legacy saves never saw it (research-metrics-cosmetics §1.2).

### 2.11 School life

| Id | Name | What to do | Metric | Rewards | Ribbon / title | Available | Reached |
|---|---|---|---|---|---|---|---|
| `a_login_7` | Settling In | Visit the academy on 7 different days. | `counters.login ≥ 7` | **30 gems** + Academy Textbook ×2 |  | Live | Month 1 |
| `a_login_30` | Familiar Face | Visit the academy on 30 different days. | `counters.login ≥ 30` | **50 gems** + **Ornate box** |  | Live | Month 2 |
| `a_login_100` | Academy Regular | Visit the academy on 100 different days. | `counters.login ≥ 100` | **100 gems** + **Ornate box** ×2 | Ribbon: Hundred Days Ribbon (gold)<br>Title: *Academy Regular* | Live | Months |
| `a_login_365` | A Year of Sakura | Visit the academy on 365 different days. | `counters.login ≥ 365` | **200 gems** + **Radiant box** + **Ornate box** ×2 | Ribbon: Sakura Year Ribbon (sakura, **special: Sakura Drift**) | Live | Months |
| `a_daily_10` | Homework Hero | Finish every daily commission on 10 days. | `counters.dailyDone ≥ 10` | **50 gems** + **Sturdy box** ×2 |  | Live | Month 1 |
| `a_daily_50` | Dependable | Finish every daily commission on 50 days. | `counters.dailyDone ≥ 50` | **100 gems** + **Ornate box** ×2 | Title: *Dependable* | Live | Month 2 |
| `a_weekly_4` | Weekly Wonder | Finish every weekly commission in 4 different weeks. | `counters.weeklyDone ≥ 4` | **50 gems** + **Sturdy box** ×2 |  | Live, new counter | Month 2 |
| `a_ach_25` | Achiever | Claim 25 achievements. | `achievementsClaimed ≥ 25` | **50 gems** + **Sturdy box** ×2 |  | Live | Month 1 |
| `a_ach_100` | Hall of Fame | Claim 100 achievements. | `achievementsClaimed ≥ 100` | **200 gems** + **Radiant box** + **Recruit Ticket** | Ribbon: Hall of Fame Ribbon (gold, **special: Prism**)<br>Title: *Hall of Famer* | Live | Month 2 |

- **Day counts, not streaks.** `counters.login` counts days the game was opened (`missions.js:54`), and a missed day never resets anything. That is better for kids than a streak.
- **`weeklyDone`** is new. Add it in `claimMission` exactly like `dailyDone` (`missions.js:121`).

### 2.12 Codex modes

Ships with `origin/feature/codex-modes`. No gems (§1.3).

| Id | Name | What to do | Metric | Rewards | Ribbon / title | Available | Reached |
|---|---|---|---|---|---|---|---|
| `a_mode_1` | Try Something New | Earn your first mode ribbon. | `ribbonsTotal ≥ 1` | Academy Textbook ×2 + 10,000 coins |  | Codex | Hour 1 of codex |
| `a_rev_80` | Reverse Route Expert | Earn 80 Reverse Route ribbons. | `modeRibbons(reverse) ≥ 80` | **Ornate box** ×2 | Ribbon: Reverse Route Ribbon (gold)<br>Title: *Wrong-Way Warden* | Codex | Months |
| `a_rush_80` | Goblin Rush Expert | Earn 80 Goblin Rush ribbons. | `modeRibbons(rush) ≥ 80` | **Ornate box** ×2 | Ribbon: Goblin Rush Ribbon (gold)<br>Title: *Rush Hour Hero* | Codex | Months |
| `a_iron_80` | Ironclad Expert | Earn 80 Ironclad ribbons. | `modeRibbons(ironclad) ≥ 80` | **Ornate box** ×2 | Ribbon: Ironclad Ribbon (gold)<br>Title: *Armor Breaker* | Codex | Months |
| `a_frugal_80` | Half Income Expert | Earn 80 Half Income ribbons. | `modeRibbons(frugal) ≥ 80` | **Ornate box** ×2 | Ribbon: Half Income Ribbon (gold)<br>Title: *Thrifty Tactician* | Codex | Months |
| `a_petal_80` | Last Petal Expert | Earn 80 Last Petal ribbons. | `modeRibbons(laststand) ≥ 80` | **Ornate box** ×2 | Ribbon: Last Petal Ribbon (gold)<br>Title: *Last Petal Keeper* | Codex | Months |
| `a_ribbons_100` | Ribbon Collector | Earn 100 mode ribbons. | `ribbonsTotal ≥ 100` | **Ornate box** ×2 |  | Codex | Month 1 of codex |
| `a_ribbons_800` | Codex Complete | Earn all 800 mode ribbons. | `ribbonsTotal ≥ 800` | **Celestial box** | Ribbon: Codex Ribbon (gold, **special: Prism**)<br>Title: *Codex Master* | Codex | Months (capstone) |
| `a_perfect_1` | Full Rosette | Earn all 20 mode ribbons on one stage. | `perfectStages ≥ 1` | **Ornate box** ×2 |  | Codex | Month 1 of codex |
| `a_perfect_10` | Rosette Garden | Earn all 20 mode ribbons on 10 stages. | `perfectStages ≥ 10` | **Radiant box** | Ribbon: Rosette Garden Ribbon (gold) | Codex | Months |
| `a_rules_15` | Rulebook Scholar | Earn a Gold medal on a stage of each of the 15 map rules. | `ruleGold ≥ 15` | **Ornate box** ×2 |  | Codex | Month 2 of codex |

- **Helpers.** These read the CX helpers `modeRibbons`, `ribbonCount` and `campaignShowcase` (CX `src/systems/unlocks.js:72-141`).
- **Map rules.** "Rulebook Scholar" reads `STAGE_RULES` × Gold medals (CX `src/data/rules.js:42-80`; there are 15 rules at `:19-38`).
- **Two kinds of ribbon.** The UI keeps them apart: *mode ribbons* are the 800 Codex ribbons, *Honor Ribbons* come from achievements.

### 2.13 Hidden (wholesome fun)

Shown as **???** with the hint until done.
- They don't count in "done / total" until found; the header shows "+ 8 secrets".
- None needs spending, playing late at night, or talking to anyone.

| Id | Name | What to do | Metric | Rewards | Ribbon / title | Available | Reached |
|---|---|---|---|---|---|---|---|
| `a_taco_party` | Taco Party *(hidden)* | Redeem the TACOTUESDAY code.<br>Hint: "Some codes are tastier than others…" | `redeemed has TACOTUESDAY` | 5,000 coins | Ribbon: Taco Ribbon (bronze)<br>Title: *Taco Enthusiast* | Live | Any time |
| `a_first_petals` | Where It All Began *(hidden)* | Earn all four medals on stage 1-1, First Petals.<br>Hint: "Go back to the very first stage…" | `stageMedals(1-1) = 4` | Academy Textbook ×2 | Ribbon: First Petal Ribbon (bronze) | Live | Month 1 |
| `a_close_call` | By a Petal *(hidden)* | Win a battle with exactly 1 heart left (one-heart battles don't count).<br>Hint: "Cutting it close is fine… once." | `counters.ach:closeCall ≥ 1` | **Sturdy box** ×2 | Title: *Cool Under Pressure* | Live, new counter | Any time |
| `a_room_view` | Room with a View *(hidden)* | Pick a lobby background for one of your girls.<br>Hint: "The lobby could use a new look…" | `lobbyBgs ≥ 1` | 5,000 coins |  | Live | Any time |
| `a_gold_rush` | Gold Rush *(hidden)* | Defeat 500 Gold Slimes.<br>Hint: "Some slimes sparkle more than others." | `enemyKills(slime_gold) ≥ 500` | 50,000 coins |  | Live | Month 1 |
| `a_not_fooled` | Not Fooled! *(hidden)* | Defeat 100 Mimic Slimes.<br>Hint: "That slime looks a little too familiar…" | `enemyKills(slime_mimic) ≥ 100` | **Sturdy box** ×2 |  | Live | Month 2 |
| `a_mirror_mirror` | Mirror, Mirror *(hidden)* | Defeat the Mirror Queen 25 times.<br>Hint: "Who is the bravest of them all?" | `enemyKills(fae_queen) ≥ 25` | **Ornate box** + Prism Dice |  | Live | Month 2 |
| `a_welcome_back` | Welcome Home! *(hidden)* | Come back to the academy after 7 or more days away.<br>Hint: "We'll be right here whenever you return." | `counters.ach:welcomeBack ≥ 1` | **Ornate box** + Academy Textbook ×2 | Ribbon: Homecoming Ribbon (silver) | Live, new counter | Any time |

---

## 3. The existing 30: what changes

**Item rewards, goals and ids are unchanged.** Cosmetics are added to 17 of them, and one display name is fixed. Veterans who already claimed these get the ribbons and titles at once, for free.

| Id | Name | Rewards (unchanged) | Added in this design | Reached |
|---|---|---|---|---|
| `a_first_win` | First Patrol | **50 gems** + Study Guide ×3 | — | Hour 1 |
| `a_chapter_1` | Chapter 1 Complete | **125 gems** | Ribbon: Sakura Gardens Ribbon (bronze) | Hour 1 |
| `a_chapter_2` | Chapter 2 Complete | **150 gems** + **Recruit Ticket** | Ribbon: Moonlit Lakeshore Ribbon (bronze) | Week 1 |
| `a_chapter_3` | Chapter 3 Complete | **175 gems** | Ribbon: Moonveil Shrine Ribbon (bronze) | Month 1 |
| `a_chapter_4` | Chapter 4 Complete | **200 gems** + **Recruit Ticket** | Ribbon: Ironhold Pass Ribbon (silver) | Month 1 |
| `a_chapter_5` | Chapter 5 Complete | **225 gems** | Ribbon: Gloomfen Marsh Ribbon (silver) | Month 1 |
| `a_chapter_6` | Chapter 6 Complete | **250 gems** + **Recruit Ticket** | Ribbon: Clockwork Foundry Ribbon (silver) | Month 2 |
| `a_chapter_7` | Chapter 7 Complete | **275 gems** | Ribbon: Oni Festival Ribbon (gold) | Month 2 |
| `a_chapter_8` | Chapter 8 Complete | **300 gems** + **Recruit Ticket** | Ribbon: Ashwing Peaks Ribbon (gold)<br>Title: *Summit Sentinel* | Month 2 |
| `a_gold_10` | Golden Student | **200 gems** + Lock Pin | — | Month 1 |
| `a_gold_40` | Valedictorian | **600 gems** + **Recruit Ticket** ×2 | Ribbon: Valedictorian Ribbon (gold)<br>Title: *Valedictorian* | Month 2 |
| `a_sakura_1` | Nightmare Survivor | **150 gems** | — | Month 1 |
| `a_sakura_10` | Sakura Sentinel | **400 gems** + Horned Festival Crown | Title: *Sakura Sentinel* | Month 2 |
| `a_bestiary_25` | Field Notes | **100 gems** | Ribbon: Field Notes Ribbon (bronze) | Month 1 |
| `a_bestiary_50` | Monster Scholar | **200 gems** | Ribbon: Monster Scholar Ribbon (silver)<br>Title: *Monster Scholar* | Month 1 |
| `a_bestiary_100` | Encyclopedia Sakura | **500 gems** + **Recruit Ticket** ×2 | Ribbon: Encyclopedia Ribbon (gold, **special: Prism**)<br>Title: *Walking Encyclopedia* | Month 2 |
| `a_pulls_10` | Welcome Committee | **50 gems** | — | Hour 1 |
| `a_pulls_100` | Club President | **200 gems** | — | Month 1 |
| `a_pulls_300` | Student Council | **300 gems** + Star Fragment ×40 | — | Month 2 |
| `a_level_20` | Diligent | **80 gems** + Academy Textbook ×2 | — | Month 1 |
| `a_level_40` | Honor Roll | **150 gems** + Sage's Codex | — | Month 2 |
| `a_level_60` | Perfect Score | **300 gems** + Akashic Tome | Ribbon: Perfect Score Ribbon (gold)<br>Title: *Perfect Score* | Month 2 |
| `a_awaken_1` | Awakened | **80 gems** | — | Month 1 |
| `a_awaken_5` | Radiant Halo | **500 gems** | Ribbon: Radiant Halo Ribbon (gold)<br>Title: *Radiant Halo* | Month 2 |
| `a_units_10` | Growing Club | **150 gems** | — | Hour 1 |
| `a_units_all` | Full Roster | **500 gems** + 10× Recruit Ticket | — | Month 2 |
| `a_kills_1000` | Guardian | **80 gems** | — | Week 1 |
| `a_kills_25000` | Legend of the Academy | **300 gems** | Title: *Legend of the Academy* | Month 1 |
| `a_reroll_10` | Gambler's Eye | **80 gems** + Lock Pin | Display name "Gambler's Eye" → "Fine Tuner" (no title) | Month 1 |
| `a_boss_3` | Total Assault | **400 gems** + Ashwing Crown | Ribbon: Total Assault Ribbon (gold)<br>Title: *Boss Buster* | Month 2 |

**Two goal notes for later** (no change now):
- **`a_units_all`.** Its goal is `UNITS.length` (`src/data/missions.js:74`). When the roster merge adds 11 girls, set it to a fixed 19 ("Have all 19 founding students and heroes"). The new girls are covered by "Whole School" (30).
- **`a_bestiary_100`.** It is a percentage of discoverable enemies (`missions.js:197-212`), so new enemies lower an unclaimed player's progress. Accept this, or freeze the list per release.

---

## 4. Honor Ribbons

### 4.1 Tiers and emblems

- **Shape:** one SVG ribbon, sized for each place it appears: two tails, a pleated rosette and a centre disc with an emblem (prototype `proto/ribbons.html`).
- **Tiers** change the metal colour of the pleats and disc:
  - **bronze** (8), **silver** (12), **gold** (29);
  - **sakura** (3): white-pink pleats with a blush disc, for Nightmare-level goals.
- **Emblems** come from this game: a blossom, crescent, shrine gate, mountain, lily, cog, lantern or wing for the 8 chapters; a notebook for the bestiary, a crown for bosses, a satchel for Bounty, and so on (column "emblem" in `catalogue.mjs`).

### 4.2 Special ribbons: the cool effect

12 ribbons are **special**: the same art plus an animated layer. All five effects use only `transform` and `opacity`. In research-metrics-cosmetics §3.2, 40 ribbons cost about 10-45 ms of main thread per second with 0 paints at 4× CPU throttle. The UR rainbow uses the same pattern (`src/ui/styles/ur.css:21-56`).

| Effect | In a list (40 px) | Detail view (160 px) | Ribbons |
|---|---|---|---|
| **Prism** | rainbow ring turning inside the pleats (the UR rainbow `--ur-rainbow`, `ur.css:12`) | ring + light sweep + 2 glints | Encyclopedia, Rainbow (first UR), Hall of Fame, Codex Complete |
| **Sakura Drift** | 2 pink four-point glints twinkling | glints + 6-8 CSS petals drifting down (the lobby petal pattern, `src/ui/styles/meta-a.css:384`) | Eternal Sakura (all 40 Nightmare), A Year of Sakura (365 days) |
| **Starlight** | navy disc, 3 white glints twinkling out of step | glints + slow star sweep | Starlight Vigil (4 freeplay bosses), Crimson Crest (Crimson Moon Matriarch) |
| **Sunrise** | 1 warm glint | gold light band sweeping across every few seconds | Perfect Attendance (all medals), Graduation (9 girls at Lv 60) |
| **Ember** | warm orange ring pulse (opacity) | ring + 2 rising orange glints | Ember Crest (Sakura on all Total Assault bosses), Colosseum Laurel (Tactical Challenge wave 70) |

**Claim moment:** a one-shot burst like the UR ascension (`ur.css:141` onward). These are keyframes that end. Shown in the reward modal's `extra` slot (`src/ui/screens/stage.js:162-170`).

**Budget rules** (from the measurements):
- At most **6 animated ribbons on screen** in a list. An IntersectionObserver adds `.live`; off-screen ribbons get `animation: none` (pausing alone kept ~1,600 layers).
- At most **4 on the profile shelf**, and **1** in the detail view.
- **Never** SMIL or animated SVG gradients: 1,066 ms/s and 1,230 paints/s, and they ignore Reduce Motion.

**Reduce Motion:** mirror `ur.css:236-249`.
- Under both `prefers-reduced-motion` and `html[data-reduce-motion]` (`src/ui/components.js:166-167`): `animation: none !important`.
- The ring and glints stay visible but still; the sweep and petals hide.

### 4.3 Where ribbons show

1. **Achievements → Ribbons** sub-tab: a ribbon case grouped by category. Earned ribbons are in colour; locked ones are silhouettes with "how to earn".
2. **Profile pin shelf.** Pinning `ach:<id>` (profile SQL `:193`; ids ≤ 24 characters fit the 32 limit) draws that achievement's ribbon instead of the trophy. This is the "per-achievement badges in M3" (SPEC.md:189), with no SQL change.
3. **Reward popup:** "New Honor Ribbon!" with the claim burst.

*Optional, cheap now:* a public honor-ribbon count needs one new card key. The profile SQL whitelists keys (`:146`) and has not been pasted yet (SPEC.md:56). Not required for v1.

---

## 5. Titles

**Rule change (replaces profile spec R5, SPEC.md:36 / :335).** A title exists only when the def has a `title` field. It is no longer "every achievement name except recruits".
- `TITLES` = `fp_ashwing`, `fp_crimson` plus every achievement with a `title`. The title id is the achievement id.
- `earnedTitles(p)` = claimed achievements with a `title`, plus the freeplay marks (SPEC.md:333-334).
- Nothing changes for players: the profile isn't built yet.
- The three titles the spec names keep their text: *Valedictorian*, *Sakura Sentinel*, *Monster Scholar* (SPEC.md:335).

**Why opt-in:**
- With 142 achievements, R5 would give "Chapter 3 Complete" and "Gambler's Eye" as titles.
- Opt-in lets a title read like an identity, and lets it differ from the achievement name (`a_bestiary_100` "Encyclopedia Sakura" → title *Walking Encyclopedia*).

**Style rules** (checked by `eval.mjs`):
- ≤ 22 characters;
- about something you **did** (*Hard Worker*, *Bookworm*, *Team Player*, *Slime Wrangler*);
- never about looks, spending, recruiting or luck;
- never mean or edgy;
- no names from other games.

**Deliberately without a title:**
- recruit counts (`a_pulls_*`);
- gear rerolls;
- owning every unit, and the first UR (both luck- and spend-adjacent);
- Potential;
- anything that only counts days (except *Academy Regular* at 100 days and *Dependable* at 50 days of dailies).

**Picker:** Edit Profile → Title lists earned titles grouped by category, plus "None" (SPEC.md:214). Viewers resolve unknown ids to no title (SPEC.md:453), so a title added in a later release never shows raw text on an older client.

---

## 6. Every ribbon-granting and title-granting achievement

| # | Achievement | Honor Ribbon | Tier | Special effect | Title | Available | Reached |
|---|---|---|---|---|---|---|---|
| 1 | `a_chapter_1` Chapter 1 Complete *(existing)* | Sakura Gardens Ribbon | bronze | — | — | Live | Hour 1 |
| 2 | `a_chapter_2` Chapter 2 Complete *(existing)* | Moonlit Lakeshore Ribbon | bronze | — | — | Live | Week 1 |
| 3 | `a_chapter_3` Chapter 3 Complete *(existing)* | Moonveil Shrine Ribbon | bronze | — | — | Live | Month 1 |
| 4 | `a_chapter_4` Chapter 4 Complete *(existing)* | Ironhold Pass Ribbon | silver | — | — | Live | Month 1 |
| 5 | `a_chapter_5` Chapter 5 Complete *(existing)* | Gloomfen Marsh Ribbon | silver | — | — | Live | Month 1 |
| 6 | `a_chapter_6` Chapter 6 Complete *(existing)* | Clockwork Foundry Ribbon | silver | — | — | Live | Month 2 |
| 7 | `a_chapter_7` Chapter 7 Complete *(existing)* | Oni Festival Ribbon | gold | — | — | Live | Month 2 |
| 8 | `a_chapter_8` Chapter 8 Complete *(existing)* | Ashwing Peaks Ribbon | gold | — | *Summit Sentinel* | Live | Month 2 |
| 9 | `a_gold_40` Valedictorian *(existing)* | Valedictorian Ribbon | gold | — | *Valedictorian* | Live | Month 2 |
| 10 | `a_sakura_10` Sakura Sentinel *(existing)* | — | — | — | *Sakura Sentinel* | Live | Month 2 |
| 11 | `a_bestiary_25` Field Notes *(existing)* | Field Notes Ribbon | bronze | — | — | Live | Month 1 |
| 12 | `a_bestiary_50` Monster Scholar *(existing)* | Monster Scholar Ribbon | silver | — | *Monster Scholar* | Live | Month 1 |
| 13 | `a_bestiary_100` Encyclopedia Sakura *(existing)* | Encyclopedia Ribbon | gold | **Prism** | *Walking Encyclopedia* | Live | Month 2 |
| 14 | `a_level_60` Perfect Score *(existing)* | Perfect Score Ribbon | gold | — | *Perfect Score* | Live | Month 2 |
| 15 | `a_awaken_5` Radiant Halo *(existing)* | Radiant Halo Ribbon | gold | — | *Radiant Halo* | Live | Month 2 |
| 16 | `a_kills_25000` Legend of the Academy *(existing)* | — | — | — | *Legend of the Academy* | Live | Month 1 |
| 17 | `a_boss_3` Total Assault *(existing)* | Total Assault Ribbon | gold | — | *Boss Buster* | Live | Month 2 |
| 18 | `a_bronze_40` Bronze Bouquet | Bronze Bouquet Ribbon | bronze | — | — | Live | Months |
| 19 | `a_silver_40` Silver Lining | Silver Lining Ribbon | silver | — | — | Live | Month 2 |
| 20 | `a_sakura_40` Eternal Sakura | Eternal Sakura Ribbon | sakura | **Sakura Drift** | *Eternal Sakura* | Live | Months |
| 21 | `a_quad_40` Perfect Attendance | Perfect Attendance Ribbon | gold | **Sunrise** | *Perfect Attendance* | Live | Months |
| 22 | `a_sakurachap_1` Midnight Blossom | Midnight Blossom Ribbon | sakura | — | — | Live | Month 2 |
| 23 | `a_hardwins_100` Hard Worker | — | — | — | *Hard Worker* | Live | Month 2 |
| 24 | `a_kills_100k` Petal Storm | Petal Storm Ribbon | gold | — | — | Live | Month 2 |
| 25 | `a_flawless_10` Not a Scratch | Spotless Shield Ribbon | silver | — | *Perfect Defense* | Live, new counter | Month 2 |
| 26 | `a_squad3` Small but Mighty | — | — | — | *Small but Mighty* | Live, new counter | Month 2 |
| 27 | `a_bounty_15` Supply Captain | Supply Captain Ribbon | silver | — | *Supply Captain* | Live | Month 2 |
| 28 | `a_lib_100` Bookworm | — | — | — | *Bookworm* | Live | Month 2 |
| 29 | `a_boss_sakura_3` Unshakable | Ember Crest Ribbon | gold | **Ember** | *Unshakable* | Live | Months |
| 30 | `a_tc_70` Colosseum Legend | Colosseum Laurel Ribbon | gold | **Ember** | *Colosseum Legend* | Live | Months |
| 31 | `a_fp_blossom_100` Hundred-Wave Bloom | Blossom Marathon Ribbon | bronze | — | — | Live | Month 2 |
| 32 | `a_fp_tempest_100` Eye of the Storm | Tempest Ribbon | silver | — | — | Live | Months |
| 33 | `a_fp_crimson_100` Crimson Moonrise | Crimson Moon Ribbon | gold | — | — | Live | Months |
| 34 | `a_fp_200` Two Hundred Strong | — | — | — | *Marathon Sentinel* | Live | Months |
| 35 | `a_fp_boss_4` Starlight Vigil | Starlight Vigil Ribbon | gold | **Starlight** | *Starlight Guardian* | Live | Months |
| 36 | `a_fp_crimson_boss` Under the Crimson Moon | Crimson Crest Ribbon | gold | **Starlight** | — | Live | Months |
| 37 | `a_coop_50` Better Together | Friendship Knot Ribbon | gold | — | *Team Player* | Live, new counter | Months |
| 38 | `a_clanboss_50` Clan Stalwart | Clan Crest Ribbon | silver | — | — | Live, new counter | Months |
| 39 | `a_donate_25` Generous Heart | Kind Heart Ribbon | silver | — | *Helping Hand* | Social | Months |
| 40 | `a_lv60_9` Graduating Class | Graduation Ribbon | gold | **Sunrise** | *Head of the Class* | Live | Months |
| 41 | `a_ur_1` Rainbow Bright | Rainbow Ribbon | gold | **Prism** | — | Live | Month 2 |
| 42 | `a_legend10` Celestial Craft | Gearsmith Ribbon | gold | — | *Gearsmith* | Live | Month 2 |
| 43 | `a_slime_1000` Slime Wrangler | — | — | — | *Slime Wrangler* | Live | Week 1 |
| 44 | `a_ghost_500` Night Light | — | — | — | *Night Light* | Live | Month 1 |
| 45 | `a_oni_500` Festival Peacekeeper | — | — | — | *Festival Peacekeeper* | Live | Month 2 |
| 46 | `a_dragon_200` Dragon Tamer | — | — | — | *Dragon Tamer* | Live | Month 2 |
| 47 | `a_journal_12` Attentive Sensei | Journal Ribbon | silver | — | *Attentive Sensei* | Train A | Month 1 |
| 48 | `a_story_8` Storyteller | Storybook Ribbon | gold | — | *Storyteller* | Train A | Month 2 |
| 49 | `a_login_100` Academy Regular | Hundred Days Ribbon | gold | — | *Academy Regular* | Live | Months |
| 50 | `a_login_365` A Year of Sakura | Sakura Year Ribbon | sakura | **Sakura Drift** | — | Live | Months |
| 51 | `a_daily_50` Dependable | — | — | — | *Dependable* | Live | Month 2 |
| 52 | `a_ach_100` Hall of Fame | Hall of Fame Ribbon | gold | **Prism** | *Hall of Famer* | Live | Month 2 |
| 53 | `a_rev_80` Reverse Route Expert | Reverse Route Ribbon | gold | — | *Wrong-Way Warden* | Codex | Months |
| 54 | `a_rush_80` Goblin Rush Expert | Goblin Rush Ribbon | gold | — | *Rush Hour Hero* | Codex | Months |
| 55 | `a_iron_80` Ironclad Expert | Ironclad Ribbon | gold | — | *Armor Breaker* | Codex | Months |
| 56 | `a_frugal_80` Half Income Expert | Half Income Ribbon | gold | — | *Thrifty Tactician* | Codex | Months |
| 57 | `a_petal_80` Last Petal Expert | Last Petal Ribbon | gold | — | *Last Petal Keeper* | Codex | Months |
| 58 | `a_ribbons_800` Codex Complete | Codex Ribbon | gold | **Prism** | *Codex Master* | Codex | Months (capstone) |
| 59 | `a_perfect_10` Rosette Garden | Rosette Garden Ribbon | gold | — | — | Codex | Months |
| 60 | `a_taco_party` Taco Party *(hidden)* | Taco Ribbon | bronze | — | *Taco Enthusiast* | Live | Any time |
| 61 | `a_first_petals` Where It All Began *(hidden)* | First Petal Ribbon | bronze | — | — | Live | Month 1 |
| 62 | `a_close_call` By a Petal *(hidden)* | — | — | — | *Cool Under Pressure* | Live, new counter | Any time |
| 63 | `a_welcome_back` Welcome Home! *(hidden)* | Homecoming Ribbon | silver | — | — | Live, new counter | Any time |
| 64 | `a_units_30` Whole School | Whole School Ribbon | gold | — | — | Later | With the roster merge |
| 65 | `a_bond_10` Best Friends | — | — | — | *Trusted Sensei* | Later | With the City |

---

## 7. Player journey and pacing

**Model.** `_cat/eval.mjs` builds four saves with the live `createProfile()` and real stage, enemy and unit ids:
- **hour 1**: chapter 1 done, starter 10-pull used;
- **day ~5**, **day ~25** and **day ~60**: these copy research-economy's early, mid and late saves (§4.1).

For a new player it adds estimates for data the live save can't hold yet: new counters, train A story progress, freeplay depth (the `journey` blocks in `eval.mjs`). Each row below lists what is **newly** met by that point.

- **Hour 1** (~1 hour (chapter 1 done)): 8 achievements, 8 in total. New ones: Full Formation, Breaking Through, Good Listener, Story Time. Existing ones: First Patrol, Chapter 1 Complete, Welcome Committee, Growing Club.
- **Week 1** (Early (day ~5, chapter 2-3)): 13 achievements, 21 in total. New ones: Off to Class, Quick Study, Going for Gold, Signature Move, Supply Run, Colosseum Debut, Encore!, Study Buddies, Fully Equipped, Family Portrait, Slime Wrangler. Existing ones: Chapter 2 Complete, Guardian.
- **Month 1** (Mid (day ~25, chapter 6)): 34 achievements, 55 in total. New ones: Halfway Up the Hill, Medal Quartet, Golden Chapter, Patrol Veteran, Errand Expert, Assault Debut, Clan Boss Challenger, Study Group, Lively Classroom, Accessory Box, Gear Collector, Crimson Moon Find, Polished to +10, Family Reunion, Night Light, Attentive Sensei, Page Turner, Settling In, Homework Hero, Where It All Began, Gold Rush, Achiever. Existing ones: Chapter 3 Complete, Chapter 4 Complete, Chapter 5 Complete, Golden Student, Nightmare Survivor, Field Notes, Monster Scholar, Club President, Diligent, Awakened, Legend of the Academy, Fine Tuner.
- **Month 2** (Late (day ~60, campaign done)): 45 achievements, 100 in total. New ones: Gold Standard, Silver Lining, Midnight Blossom, Seasoned Sentinel, Hard Worker, Petal Storm, Boss Patrol, Not a Scratch, Small but Mighty, Supply Captain, Expedition Gold, Bookworm, Workshop Regular, Festival Helper, Crowd Favorite, Hundred-Wave Bloom, Team Spirit, Honors Class, Rainbow Bright, Eternal Sakura Find, Master Polisher, Celestial Craft, Tidy Workshop, Field Guide, Festival Peacekeeper, Dragon Tamer, Storyteller, Familiar Face, Dependable, Weekly Wonder, Not Fooled!, Mirror, Mirror, Hall of Fame. Existing ones: Chapter 6 Complete, Chapter 7 Complete, Chapter 8 Complete, Valedictorian, Sakura Sentinel, Encyclopedia Sakura, Student Council, Honor Roll, Perfect Score, Radiant Halo, Full Roster, Total Assault.
- **Any time** (hidden, not tied to progress): By a Petal, Welcome Home!, Taco Party, Room with a View.
- **Months** (not met by the day-60 model): 40 new achievements, listed with "Months" or a feature in the tables.

### 7.1 What it feels like

- **Hour 1: "the game notices me."**
  - Clearing 1-1 and chapter 1, using the starter 10-pull and owning 10 girls: 4 existing achievements.
  - Then 4 small new ones that teach the next system:
    - **Full Formation** teaches filling all 8 slots;
    - **Breaking Through** teaches the level cap;
    - **Good Listener** and **Story Time** reward reading Hikari's lessons and the chapter 1 scenes.
  - They pay gems, books and coins, never a box (Equipment opens at 2-1).
  - The first Honor Ribbon appears at once: the **Sakura Gardens Ribbon** from Chapter 1 Complete.
- **Week 1: "every mode has a goal."**
  - Each newly opened system gets its first rung: Sweep (**Quick Study**), Bounty (**Supply Run**), Tactical Challenge (**Colosseum Debut**), freeplay (**Encore!**), co-op (**Study Buddies**), gear (**Fully Equipped**), bestiary (**Family Portrait**).
  - The first Sturdy boxes arrive here, after 2-1.
  - The first title is usually *Slime Wrangler*.
- **Month 1: "ladders and collections."**
  - The second rungs land: Halfway Up the Hill, Golden Chapter, Medal Quartet, Patrol Veteran, Gear Collector, Crimson Moon Find, Polished to +10, Family Reunion, Homework Hero.
  - **Achiever** (25 claimed) arrives.
  - Ornate boxes take over from Sturdy, and several hidden ones are found around here.
  - About 10 ribbons and 6 titles by day 25.
- **Month 2: "mastery."**
  - Chapters 6-8 and Valedictorian; then Silver Lining, Hard Worker, Petal Storm, Supply Captain, Master Polisher, Celestial Craft (*Gearsmith*), Storyteller.
  - The first **special** ribbons: Encyclopedia (bestiary 100%, Prism) and Rainbow Bright (first UR, Prism).
  - **Hall of Fame** (100 claimed) for the most active.
- **Months: the long tail.** These are the special-ribbon capstones:
  - Eternal Sakura, Perfect Attendance, Unshakable, Colosseum Legend, Starlight Vigil, Under the Crimson Moon, Graduating Class, A Year of Sakura;
  - all the Codex mode experts and Codex Complete.
  - 5 Celestial boxes and 5 Recruit Tickets sit only here.

**Why it holds up:**
- **Always a next step.** Every category has a step in week 1 and a capstone months out, so a player never runs dry.
- **Fresh content waves.** Train A, social and Codex each arrive with their own fresh rows (5, 2 and 11).

### 7.2 Hidden achievements (all wholesome)

| Hidden | How it's found | Why it's fun |
|---|---|---|
| Taco Party | redeeming TACOTUESDAY | a nod to the owner's code; a little taco ribbon and the *Taco Enthusiast* title |
| Where It All Began | all four medals on 1-1 | going back to the very first stage |
| By a Petal | winning with exactly 1 heart left | a happy accident most players hit once |
| Room with a View | picking a lobby background | rewards decorating |
| Gold Rush | 500 Gold Slimes | they sparkle and run; 50,000 coins |
| Not Fooled! | 100 Mimic Slimes | the copycat slimes of chapter 7 |
| Mirror, Mirror | the Mirror Queen 25 times | a fairy-tale wink |
| Welcome Home! | coming back after 7+ days away | a warm hug, not a penalty: a Homecoming Ribbon |

---

## 8. Update day: veterans

New counters start at 0, so only *Live* rows and train A's journal can be claimed at once. Measured with research-economy's three saves:

| Veteran save on update day | Can claim at once (new) | Gems | Tickets | Gear boxes | Other items | Honor Ribbons lit | Titles unlocked |
|---|---:|---:|---:|---|---|---:|---:|
| Early (day ~5, chapter 2-3) | 10 | 220 | 0 | Sturdy box ×4 | Academy Textbook ×2, Study Guide ×12, Bounty Token ×5, Fortune Dice ×2, 5,000 coins | 2 | 1 |
| Mid (day ~25, chapter 6) | 34 | 1,010 | 0 | Sturdy box ×17, Ornate box ×9 | Academy Textbook ×8, Study Guide ×12, Bounty Token ×15, 75,000 coins, Fortune Dice ×5, Lock Pin | 10 | 6 |
| Late (day ~60, campaign done) | 59 | 2,960 | 0 | Sturdy box ×19, Ornate box ×41, Radiant box ×2 | Academy Textbook ×13, Study Guide ×12, Assault Token ×20, Bounty Token ×15, Sage's Codex ×2, Lock Pin ×3, Prism Dice ×3, 75,000 coins, Fortune Dice ×5 | 25 | 20 |

**Targets** (research-economy §4.3):
- **Gems:** mid ≤ 1,500 and late ≤ 4,000, both met.
- **Tickets:** 0 tickets retroactively, met. The 5 tickets sit on capstones the late save hasn't reached.
- **Cosmetics:** most of the "wow" is cosmetic. A late veteran's profile lights up with 25 ribbons and 20 titles on day one, at no economic cost.

**Box opening is the one friction.** A late save receives about 60 boxes in one "Claim all". The reward modal should offer **Open all** (the Backpack already opens n at a time, `src/ui/screens/backpack.js:244`).

---

## 9. New metrics and counters

**Derived metrics** read data every build already keeps, so they are retroactive. Each would be a new `case` in `metricValue` (`src/systems/missions.js:216-234`).

| Metric | Value | Source |
|---|---|---|
| `medalsAll` | campaign stages with all 4 medals | `progress.stages[id]` booleans (`save.js:358-376`) |
| `chapterSets(diff)` | chapters whose 5 stages all have that medal | same + `CHAPTERS` (`src/data/stages.js:148`) |
| `stageMedals(stage)` | medals on one stage (0-4) | same |
| `kindClear(kind)` / `kindMedals('kind:diff')` | Bounty (`resource`) or Total Assault (`boss`) stages cleared / with a medal | same |
| `arenaRuns(arena)` | sum of `clears` over the arena's 3 stages (sweeps count) | `rewards.js:136`, `:199` |
| `challengeWave` | `progress.stages.challenge.bestWave` | `rewards.js:127` |
| `enemiesFound` / `familiesFound` | discovered enemies / families with every discoverable member found | `bestiary[id].discovered`, `discoverableEnemies()` (`missions.js:197-204`) |
| `familyKills(fam)` / `enemyKills(id)` / `enemySetKilled(ids)` | per-family, per-enemy, distinct-killed counts | `bestiary[id].kills` (`rewards.js:114`, `coop/rewards.js:58-59`) |
| `maxBreakthrough`, `unitsAtLevel(lv)`, `awakenStars`, `urOwned` | from `profile.units` | `save.js:147-163`; UR rule `src/ui/rarity.js:32-37` |
| `formationSize` | `formation.towers.length` (max 8) | `save.js:416-418`, `src/data/types.js:274` |
| `gearReceived` | `profile.seq.gear` | `gear.js:139`, `save.js:341-343` |
| `gearOwned(r)`, `gearAtMax(r)`, `fullSets(r)` | owned pieces of a rarity / at +10 / students with 3 slots filled | `profile.gear`, `units[id].gear` (`save.js:173-197`) |
| `freeplayExtra`, `freeplayStages(n)`, `freeplayBest(tier)`, `coopBest` | best waves past each stage's goal, solo or co-op | `freeplayBest` / `coopBestWave` (`save.js:366-374`), stage `waves` |
| `freeplayMark('tier:id')` | `counters['fpm:' + key] > 0` | `coop/rewards.js:237`, `:302` |
| `redeemed(code)` / `lobbyBgs` | code in `profile.redeemed` / entries in `profile.lobbyBg` | `save.js:425`, `:428` |
| `achievementsClaimed` | known ids claimed | `missions.achievements` |
| `lessons` / `storyChapters` (TA) | `sl:` marks / chapters with every scene's `ss:` mark | TA `story.js:49-50`, `index.js:49-51` |
| `ribbonsTotal`, `modeRibbons(m)`, `perfectStages`, `ruleGold` (CX) | Codex ribbon counts | CX `unlocks.js:72-141`, `rules.js:42-80` |

**New counters** count from the release that adds them. All are numbers in `missions.counters`.

| Key | +1 when | Hook |
|---|---|---|
| `coopWin` | a co-op battle is won (covers freeplay clears through `applyCoopClear`) | `applyCoopResult`, `coop/rewards.js:71-87` (`applyCoopClear` `:99-105`) |
| `ults` | += `result.stats.ultsUsed` (hero ultimates) | solo `applyBattleResult` (`rewards.js:85`); not co-op, where `stats` covers the room |
| `ach:flawless` | won on Hard and `livesLeft === maxLives` | `rewards.js:130-152`; `Sim.js:878-879` |
| `ach:squad3` | won, campaign chapter ≥ 5, Hard/Nightmare, ≤ 3 distinct ids in `stats.towerUnits` | same; `Sim.js:649`, `:889` |
| `ach:closeCall` | won with `livesLeft === 1` and `maxLives > 1` | same |
| `eventWin` | won while `out.eventBonus` | `rewards.js:146` |
| `weeklyDone` | every weekly claimed | `claimMission`, like `dailyDone` (`missions.js:121`) |
| `salvage` | a piece is salvaged | `salvageGear`, `gear.js:335-344` |
| `clanBossHit` | a clan boss attempt is counted | after `submitBossDamage` (`controller.js:819`) |
| `donate` (SO) | a donation is finalized | SO `donateLedger.js:84` |
| `ach:welcomeBack` | the new day key is ≥ 7 days after `m.day` | `onAppStart`, before `m.day = day` (`missions.js:49-50`) |
| `heroMax` (later) | max in-battle hero level | hero rework |

**Never counts:**
- practice runs: keep the guard at `rewards.js:90-93`;
- the planned Sandbox.

---

## 10. Budget

| Group | New achievements | Gems | Recruit Tickets | Sturdy | Ornate | Radiant | Celestial |
|---|---:|---:|---:|---:|---:|---:|---:|
| Live | 77 | 5,410 | 5 | 19 | 59 | 10 | 4 |
| Live, new counter | 13 | 380 | 0 | 12 | 6 | 1 | 0 |
| Social | 2 | 0 | 0 | 1 | 2 | 0 | 0 |
| Train A | 5 | 0 | 0 | 2 | 3 | 0 | 0 |
| Codex | 11 | 0 | 0 | 0 | 16 | 1 | 1 |
| Later | 4 | 180 | 0 | 0 | 5 | 0 | 0 |
| **All new** | 112 | 5,970 | 5 | 34 | 91 | 12 | 5 |

- **Gems:** 5,970 total, inside research-economy's ≤ 6,000 target (hard cap 7,000).
- **Recruit Tickets:** 5 singles (≤ 6) and no 10× tickets. Tickets sit only on capstones: Eternal Sakura, Perfect Attendance, Colosseum Legend, Graduating Class, Hall of Fame.
- **Boxes:** Radiant is on exactly 12 headline steps and Celestial on 5 capstones (Eternal Sakura, Unshakable, Graduating Class, Starlight Vigil, Codex Complete).
  - Box value is about 300 gem-equivalent per step, the same per-step value as the economy research's 63-step example (research-economy §3.2).
  - None of it turns into recruits.
- **Crowns:** 1 Ashwing Crown, on Unshakable (the ★5 bottleneck, research-economy §2.2), deep in the long tail. There are no crowns before 3-2.

---

## 11. Release waves

| Wave | Rows | Notes |
|---|---:|---|
| **1: first achievements release** (after train A) | 77 live + 13 new-counter + 5 train A | Live rows are retroactive; new counters start at 0 |
| **2: social** | 2 | Donations only; nothing about friends or messages |
| **3: Codex modes** | 11 | No gems; mode experts give titles; Codex Complete is a Prism capstone |
| **Later** | 4 | Whole School (roster merge), Commander's Rise (hero rework), Best Friends (City), Dress-Up Day (outfits) |

The profile (SPEC M0/M1) reads `honor` and `title` from the defs, so whichever of the two merges second wires `earnedTitles` and pins to them.

---

## 12. Questions for the owner

1. **Titles become opt-in.** There are 42 hand-picked titles instead of "every achievement name" (profile spec R5). OK?
2. **Taco Party** is a hidden achievement for redeeming TACOTUESDAY. If that code is ever retired, new players can't earn it. Keep it?
3. **Colosseum Legend** = wave 70 of the Tactical Challenge (the Ashwing wave). Keep 70, or set it after a balance run?
4. **Welcome Home!** rewards coming back after 7+ days away (a box and a ribbon). OK as a hidden treat?

---

## 13. Files

| File | What |
|---|---|
| `docs/specs/achievements/design-catalogue.md` | this document (generated) |
| `docs/specs/achievements/catalogue.mjs` | the catalogue as data: 112 rows, the cosmetics on existing ids, the one rename |
| `docs/specs/achievements/_cat/eval.mjs` | checks + budget + pacing + update day against the live game (read-only) |
| `docs/specs/achievements/_cat/build.mjs` | renders this doc from `_cat/design-catalogue.src.md` |
| `docs/specs/achievements/_cat/disc.mjs` | enemy discoverability and family sizes |
