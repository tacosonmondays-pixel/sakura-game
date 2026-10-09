# Sakura Sentinels — Economy

Owner: systems. Source of truth is the data (`src/data/items.js`, `src/data/shop.js`,
`src/data/missions.js`, `src/data/stages.js`) and `f2pIncomeSummary()` in
`src/systems/missions.js`, which computes the income chart below from those tables
(the in-game Rewards screen shows the live version, so it never drifts from this file).

## 1. Currencies

| Currency | Where it lives | Earned from | Spent on |
|---|---|---|---|
| Coins | `profile.currencies.coins` | every stage drop (×0.8 Easy … ×1.5 Nightmare), Coin Bounty, commissions, salvage | level ups (0.4 coin / EXP), breakthroughs, awakenings, gear enhance & rerolls, General shop |
| Sakura Gems | `profile.currencies.gems` | first clears per difficulty, chapter finales, commissions, login, achievements, codes | recruits (120 / 1200 for 10×), Gem Shop |
| Recruit Points | `profile.gacha.recruitPoints` | +1 per recruit | spark any SSR (200), Star Fragments |
| Assault Tokens (`token_boss`) | items | minibosses (x-5 stages), Total Assault | Boss Exchange: crowns, dice, Lock Pins, fragments, 1 ticket / week |
| Bounty Tokens (`token_bounty`) | items | Bounty arenas, Tactical Challenge, commissions | Bounty Exchange: gear boxes, dice, Lock Pins, books |

## 2. Recruitment (gacha)

* Rates: **SSR 1.5% · SR 18.5% · R 80%**. Every unit (free recruits and heroes included) is in its rarity's pool.
* **Pity:** the 90th recruit without an SSR is an SSR. Consolidated SSR rate ≈ **2.02%** (1 SSR per ≈ 49.6 recruits on average).
* **10× guarantee:** at least one SR or better in every 10×.
* Duplicates → Star Fragments: R ×2, SR ×10, SSR ×40.
* **Spark:** 200 recruit points → any SSR (Recruit Exchange or `spark()`).
* Tickets are always spent before gems (`ticket_recruit10` for a 10×, then single tickets, then gems).

## 3. F2P income per 28 days (version reward chart)

An *active* free player = logs in daily, clears all daily + weekly commissions, buys the two
weekly recruit tickets in the Mall (40,000 coins and 60 Assault Tokens).

| Source | Gems | Tickets | ≈ Recruits | Note |
|---|---:|---:|---:|---|
| Daily Commissions | 3,360 | 0 | 28.0 | 120 gems × 28 days |
| Weekly Commissions | 2,400 | 4 | 24.0 | 600 gems + 1 ticket × 4 weeks |
| Login Calendar | 1,040 | 8 | 16.7 | 7-day cycle × 4 (day 3 + day 7 tickets) |
| Mall · General (coins) | 0 | 4 | 4.0 | 1 ticket / week for 40,000 coins |
| Mall · Boss Exchange | 0 | 4 | 4.0 | 1 ticket / week for 60 Assault Tokens |
| **Total / 28 days** | **6,800** | **20** | **76.7** | ≈ 1.5 SSR expected, 0.38 sparks of points |

Target was 70–80 recruits per 28 days — met (76.7), and pinned by a test
(`tests/systems/missions.test.js › F2P income`).

### One-time sources (not part of the monthly chart)

| Source | Gems | Tickets | ≈ Recruits | Note |
|---|---:|---:|---:|---|
| Starter gift | 2,400 | 10 | 30.0 | 2,400 gems + one 10× ticket |
| Campaign medals | 8,800 | 0 | 73.3 | 20 / 40 / 60 / 100 gems for Easy / Normal / Hard / Nightmare on each of 40 stages |
| Chapter finales | 1,520 | 8 | 20.7 | first clear of each x-5 stage |
| Bounty & Total Assault | 5,460 | 3 | 48.5 | first clears + medals |
| Achievements | 7,070 | 18 | 76.9 | 30 achievements |
| Redemption codes | 1,040 | 3 | 11.7 | SAKURA2026 · WELCOME · TACOTUESDAY |
| **Total** | **26,290** | **42** | **≈ 261** | |

The owner's developer codes (`VERITY777` = 999,999 gems, `RESET 67` = reset progress) are
excluded from the chart.

## 4. Commissions, login, achievements, codes, events

* **Daily** (reset at local midnight, `onAppStart`): Morning Roll Call 20 · Patrol Duty (win 3) 30 ·
  Pest Control (300 kills) 20 · Study Session (level up) 15 · Shopping Trip (spend 10k coins) 15 ·
  Elite Training (Hard win or sweep) 20 → **120 gems/day** + books, coins, dice, tokens.
* **Weekly** (ISO week): win 20 (150), 3,000 kills (100), 3 boss/miniboss kills (150), 3 gear rerolls (50),
  finish all dailies on 5 days (150 + ticket) → **600 gems/week**.
* **Login calendar:** 7 days, repeats; missed days do not reset the cycle.
* **Achievements:** one-time (first clear, chapter clears, Gold/Sakura medal counts, bestiary 25/50/100%,
  recruits, max level, awakening, roster size, kills, rerolls, all Total Assault bosses).
* **Codes:** `SAKURA2026`, `WELCOME`, `TACOTUESDAY` (once per account, case/space-insensitive).
* **Weekly event:** double drops in one Bounty arena, chosen from the ISO week key
  (`currentEvent()`; books → coins → gear → materials A/B rotate pseudo-randomly).

## 5. Progression costs

### Levels (books + coins)

`expForLevel(L) ≈ 30·L^1.7 + 50` (rounded to 10; was 40·L^1.75 + 60 before the "frisk1636"
playtest round — 30–38 % cheaper). Books: Doodle Notes 100 · Study Guide 500 ·
Academy Textbook 2,000 · Sage's Codex 8,000 · Akashic Tome 30,000 EXP. Coins: 0.4 per EXP applied
(overflow past the cap is wasted and not charged).

| Reach level | 10 | 20 | 30 | 40 | 50 | 60 |
|---|---:|---:|---:|---:|---:|---:|
| Total EXP | 5,290 | 34,730 | 104,790 | 229,220 | 420,440 | 689,910 |
| (before) | 7,610 | 52,410 | 161,900 | 359,830 | 667,950 | 1,106,630 |

**Campaign first-clear books** (`campaignFirstClear` in `stages.js`, on top of coins and gems):
ch1–2 4 Study Guides (2,000 EXP) · ch3–4 2 Academy Textbooks (4,000) · ch5–6 3 Textbooks (6,000) ·
ch7–8 4 Textbooks (8,000) per stage (was 2–3 Study Guides). With the cheaper curve the free squad
reaches the campaign's tuning level (`EXPECTED_LEVEL` in `tools/balance/f2p.mjs`: 1 / 5 / 10 / 15 /
20 / 24 / 28 / 32 by chapter) from first clears alone in chapters 1–3; from chapter 4 on it takes
Library Bounty sweeps (≈ 31 / 70 / 32 / 36 / 46 clears for chapters 4–8, `docs/BALANCE.md` §7).

### Breakthrough (cap 10 → 60 in steps of 10; unit's own material family)

| Gate | Materials | Coins |
|---|---|---:|
| 1 (cap 20) | 8 common | 5,000 |
| 2 (cap 30) | 12 common + 5 rare | 15,000 |
| 3 (cap 40) | 10 rare + 4 super rare | 40,000 |
| 4 (cap 50) | 10 super rare + 3 mythic | 100,000 |
| 5 (cap 60) | 8 mythic + 2 legendary | 250,000 |

Families: feather (Aoi, Kage, Shiro), blade (Rei, Kaede), ember (Akane, Sango), rime (Yuki, Nami),
charm (Hikari, Umeko, Miko, Hotaru), rune (Luna, Midori, Raika), cog (Momo, Suzu, Chika).
Names run e.g. Sparrow Feather → Swallow Plume → Hawk Quill → Phoenix Plume → Celestial Pinion.

### Awakening (★1–★5)

| Star | Crowns | Star Fragments | Coins |
|---|---|---:|---:|
| ★1 | Jelly Crown (Slime Prince, 1-5) | 10 | 20,000 |
| ★2 | Iron Warlord Crown (Orc General 4-5 / Iron Colossus) | 20 | 50,000 |
| ★3 | Clockwork Crown (Goblin Machine 6-5) + Iron Warlord Crown | 30 | 100,000 |
| ★4 | Horned Festival Crown (Oni Champion 7-5 / Grave Lych) | 50 | 200,000 |
| ★5 | Ashwing Crown (Ashwing Matriarch 8-5 / Total Assault) + Horned Festival Crown | 80 | 400,000 |

★3 unlocks the unit's awaken passive. Crowns also rotate in the Boss Exchange (weekly stock).

### Battle scaling (deliberately modest — heroes used to be overpowered)

damage ×(1 + 1.8%·(level−1) + 2%·gates + 5%·stars) → level 60 / 5 gates / ★5 ≈ **×2.41**;
attack rate +0.4% per level; gear adds on top (ATK%, attack speed, range, crit, armor pierce,
cost cut ≤ 25%, ult haste ≤ 50%).

## 6. Gear

* Slots: charm (main ATK% / Crit DMG), ribbon (Crit Rate / Range / Armor Pierce), shoes (Attack Speed /
  Cost Reduction / Ult Haste).
* Rarity scales every roll: common ×1 · rare ×1.35 · super rare ×1.75 · mythic ×2.2 · legendary ×2.8
  (Armor Pierce scales at half rate). Main stats roll 1.2× a substat range and grow +6%/level (+4% for
  Armor Pierce) up to +10. Substats: 0/1/2/3/4 by rarity, never duplicating the main stat or each other;
  every 3rd enhancement level grows the least-upgraded substat.
* **Reroll substats:** Fortune Dice (1 / 1 / 1 / 2 / 3 by rarity) + coins; add a **Lock Pin** to keep one
  substat exactly as it is. Earned enhancement growth is kept.
* **Reroll main stat:** one Prism Dice + coins → a different main stat for the slot.
* **Enhance:** (800 + 400·level) × (rarity order + 1) coins per level.
* **Salvage:** coins (+50% of enhance coins back) and Fortune Dice for super rare+ (legendary also gives a
  Lock Pin). Equipped or locked gear cannot be salvaged.
* Gear boxes (`gearbox_<rarity>`) dropped in battle open immediately into real gear; boxes bought in the
  Mall stay in the backpack until opened (`openGearBox`).

## 7. Mall

| Tab | Currency | Highlights | Stock |
|---|---|---|---|
| General | coins | books, common/rare materials of every family, Fortune Dice, **1 Recruit Ticket / week** | daily (ticket weekly) |
| Gem Shop | gems | 30k coins, Academy Textbooks, dice, Lock Pin, Ornate Gear Box, super rare materials | weekly (coins daily) |
| Recruit Exchange | recruit points | spark any SSR (200), Star Fragments | spark unlimited, fragments weekly |
| Boss Exchange | Assault Tokens | every crown, Prism Dice, Lock Pins, fragments, **1 Recruit Ticket / week** | weekly |
| Bounty Exchange | Bounty Tokens | gear boxes rare → legendary, Fortune Dice, Lock Pins, textbooks | daily / weekly |

## 8. Sweeping

A stage cleared on **Hard or Nightmare** can be swept up to 10× per tap at any difficulty already
cleared: drops only (no medals, first clears or bestiary changes); sweeps count for "win" commissions.

## 9. Battle coins (in-battle economy)

Battle coins are separate from the wallet and reset every stage (`src/sim/Sim.js`). Tuned in the
"frisk1636" playtest round; targets and measurements in `docs/BALANCE.md`.

* **Start cash** `stage.startCash` (650 at 1-1, then 700 → 900) × difficulty `startCashMul`
  (Nightmare ×1.5, everything else ×1).
* **Kill bounty** = enemy `bounty` × difficulty `cashMul` × `stage.cashScale`.
* **Wave-clear bonus** = (100 + 7 × wave + **crowd**) × `cashMul` × `stage.cashScale`, paid at the end
  of every wave even when enemies leaked (`BATTLE.waveClearBonusBase / waveClearBonusPerWave`).
* **Crowd bonus** (the "more money per round based on how many enemies / types" note) = 1 coin per
  scheduled enemy of the wave (max 20) + 4 per distinct enemy type (`BATTLE.crowdBonus`; split
  children and summons do not count). Known at wave start, deterministic. It adds 9–18 % to the
  wave-clear bonus and 3–11 % of a campaign stage's coins (up to 11 % in Bounty); the wave-clear
  toast shows it
  ("Wave 6 cleared · +208 coins (+23 crowd)" on 1-1 Normal).
* **cashScale** (campaign) = max(1.3, curve^0.45) where curve = 6.5^(index/39) is the smooth
  campaign index curve: 1.3 for 1-1 … 3-3, then up to 2.32 at 8-5. Bounty tiers 1.2 / 1.64 / 2.06;
  Total Assault 2.06 / 2.24 / 2.40; Tactical Challenge 1.
* **Tower income** (Momo) = (perWave × cashMul + interest) × difficulty `incomeMul` (Nightmare ×0.5;
  the legacy `noIncome: true` flag still means 0).
* **Prices**: placement and tiers 1–3 were cut ×0.75, tier 4 ×0.5, tier 5 ×0.9 (one rule for every
  unit, rounded to 5 / 10 / 50 / 250). Aoi 150 · Rei 180 · Hikari 390; Aoi's tier 4s 1,000–1,200
  (place → T4 1,890–2,060 coins, was 3,180–3,540). Difficulty `costMul` multiplies every price.

| Difficulty | Enemy HP | Speed | Coins | Prices | Lives | Start cash | Income girls |
|---|---:|---:|---:|---:|---:|---:|---:|
| Easy | ×0.6 | ×1 | ×1.1 | ×0.9 | 150 | ×1 | ×1 |
| Normal | ×1 | ×1 | ×1 | ×1 | 100 | ×1 | ×1 |
| Hard | ×1 | ×1 | ×1 | ×1.05 | 50 | ×1 | ×1 |
| Nightmare | ×1 | ×1 | ×1 | ×1.1 | 20 | ×1.5 | ×0.5 |

Coins per stage on Normal if every enemy dies (start + bounty + wave-clear incl. crowd): 1-1 3,523 ·
1-5 7,139 · 2-5 9,889 · 3-5 9,797 · 4-5 14,265 · 5-5 31,162 · 6-5 32,771 · 7-5 27,082 · 8-5 37,693.
A focused player (hero + Rei + Aoi to tier 4) can afford the tier 4 by wave 10 of 15–18 in chapter 1;
tier 5 is a chapter-4+ goal (all-in Aoi tier 5 first fits at wave 22–24 of 24–26 in chapter 4).
