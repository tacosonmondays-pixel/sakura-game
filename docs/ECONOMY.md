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
| Assault Tokens (`token_boss`) | items | minibosses (x-5 stages), Total Assault, **Titan Trials** (every fight; the Titan of the Week +50 %) | Boss Exchange: crowns, dice, Lock Pins, fragments, 1 ticket / week, and the weekly **Titan shelf** |
| Mementos (`memento`) | items | spare duplicates (a copy past her Essence cap): R ×2, SR ×6 | Memento Exchange (lower shelf): Recruit Ticket, fragments, Tomes, materials, dice, coins |
| Moonpearls (`moonpearl`) | items | spare duplicates: SR ×1, SSR ×10 | Memento Exchange (higher shelf): 10× ticket, Chosen SSR Essence, Crown Shards, Zenith, legendary, Celestial box |
| Trial Keys | `missions.counters['tk:left']` | 12 a week (Sunday 7 PM Central), up to 6 unused carry over | one per Titan Trials fight or sweep that reaches Bronze; never sold |
| Bounty Tokens (`token_bounty`) | items | Bounty arenas, Tactical Challenge, commissions | Bounty Exchange: gear boxes, dice, Lock Pins, books |

## 2. Recruitment (gacha)

* Rates: **SSR 1.5% · SR 18.5% · R 80%**. Every unit (free recruits and heroes included) is in its rarity's pool.
* **Pity:** the 90th recruit without an SSR is an SSR. Consolidated SSR rate ≈ **2.02%** (1 SSR per ≈ 49.6 recruits on average).
* **10× guarantee:** at least one SR or better in every 10×.
* Duplicates → **+1 Essence of her** and nothing else (Ascension, `docs/specs/ASCENSION.md` §A; no Star
  Fragments, no Tomes). **Raise Potential** on her page: 1 Essence + coins per step (R 2k/4k/6k/10k/15k,
  SR 5k/10k/15k/25k/40k, SSR 10k/20k/40k/70k/100k: 37k / 95k / 240k for P1 → P6). She holds at most 6 − P
  Essence; a copy past that is a **spare**: R 2 Mementos + ⅕ recruit point · SR 6 Mementos + 1 Moonpearl +
  1 point · SSR 10 Moonpearls + 5 points. Sparks and SSR Select Tickets on an owned girl count as duplicates.
  **Kindred Essence** (R, SR; SSR only as shards, 10 → 1) stands in for her own on a girl of its rarity or
  lower with none of her own. Each P step opens her next level gate past 60 (§5, Breakthrough).
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
| Achievements | 13,000 | 23 | 131.3 | 118 achievements (the shipped 30 + 86 new at launch + 2 with social; docs/specs/ACHIEVEMENTS.md) |
| Redemption codes | 1,040 | 3 | 11.7 | SAKURA2026 · WELCOME · TACOTUESDAY |
| **Total** | **32,220** | **47** | **≈ 316** | |

The chart counts gems and tickets only. The achievements expansion also gives **gear boxes**: 8 Sturdy, 61 Ornate,
18 Radiant and 4 Celestial at launch (≈ 27,600 gem-equivalent, RE §2.1). Boxes open into gear and never become
recruits; no box or crown can be claimed before Equipment (2-1) or Awakening (3-2) opens on a new save. The social wave
(2 donation rows, 3 Ornate boxes, no gems) is live; the Codex and later waves add 14 rows (850 gems, 1 ticket) when their
features ship.

The action code `RESET 67` (reset progress) grants nothing and is left out of the chart; the developer gem code (removed) is gone.

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
* **Clan requests / donations** (online, `src/online/donateRules.js`; game day resets at 7 PM Central):
  a player receives at most **one request a day** (10 common / 6 rare / 3 super rare / 1 mythic of one
  material; super rare ≤ 3 and mythic ≤ 1 per 7 days; mythic only in an established clan; never
  legendary). Donors give their own pieces, up to **30 points a day** (common 1, rare 2, super rare 5,
  mythic 10 per piece) and earn **+50 coins per point (≤ 1,500 coins / day)** and +1 clan XP per point.
  Pieces move from the donor's save to the requester's; the server cannot see backpacks, so these caps
  (not the donor's honesty) bound what anyone can receive.

## 5. Progression costs

### Levels (books + coins)

`expForLevel(L) ≈ 40·L^1.75 + 60` (rounded to 10) up to 60; **from 60, one Akashic Tome per level** (30,000 EXP and
12,000 coins; `LEVEL_PAST_GATES` in `src/systems/progression.js`, the one table a later ascension replaces). Books:
Doodle Notes 100 · Study Guide 500 · Academy Textbook 2,000 · Sage's Codex 8,000 · Akashic Tome 30,000 EXP. Coins:
0.4 per EXP applied at every level (overflow past the cap is wasted and not charged).

| Reach level | 10 | 20 | 30 | 40 | 50 | 60 | 63 | 67 | 72 | 78 | 85 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Total EXP | 7,610 | 52,410 | 161,900 | 359,830 | 667,950 | 1,106,630 | 1,196,630 | 1,316,630 | 1,466,630 | 1,646,630 | 1,856,630 |

**Level cap past 60 (Potential v3).** With all five breakthrough gates open her cap is her Potential's: P1 60 · P2 63
· P3 67 · P4 72 · P5 78 · P6 85 (a P6 girl below gate 5 keeps the gate cap). 60 → 85 is 25 Tomes (750,000 EXP) and
300,000 coins a girl; her growth continues unchanged (L85 ≈ ×1.28 her L60 damage per second). Akashic Tome sources:

| Source | Amount | Cap |
|---|---|---|
| Library Courtyard III, Nightmare | 20 % a run (was 5 %) | energy / runs |
| Freeplay caches (every 25 freeplay waves) | +1 per cache | 2 a week per account, solo and co-op together (`fpTome:<week>` in `missions.counters`) |
| Bounty Exchange | 40 Bounty Tokens each | 2 a week |
| Duplicates past P6 | SR ×1, SSR ×5 | duplicates |
| Total Assault: Ashwing Matriarch (Hard) | 6 % a run (unchanged) | runs |

None is sold for gems. Older builds clamp a level above 60 back to 60 when they load; `lv:<id>` in
`missions.counters` restores it (never above the cap) on the next load of this build.

### Breakthrough (cap 10 → 60 in steps of 10, then gates 6–10 to 85; unit's own material family)

| Gate | Materials | Coins |
|---|---|---:|
| 1 (cap 20) | 8 common | 5,000 |
| 2 (cap 30) | 12 common + 5 rare | 15,000 |
| 3 (cap 40) | 10 rare + 4 super rare | 40,000 |
| 4 (cap 50) | 10 super rare + 3 mythic | 100,000 |
| 5 (cap 60) | 8 mythic + 2 legendary | 250,000 |
| 6 (cap 63, needs P2) | 8 mythic + 2 legendary | 150,000 |
| 7 (cap 67, P3) | 10 mythic + 3 legendary + 1 Zenith | 200,000 |
| 8 (cap 72, P4) | 4 legendary + 2 Zenith | 300,000 |
| 9 (cap 78, P5) | 5 legendary + 3 Zenith + 1 Rainbow Crown | 450,000 |
| 10 (cap 85, P6) | 6 legendary + 4 Zenith + 1 Rainbow Crown | 800,000 |

Gates 6–10 (Ascension): 18 mythic, 20 legendary, 10 Zenith, 2 Rainbow Crowns and 1.9M coins a girl, plus the 25
Akashic Tomes and 300k coins of the levels in between: **2.2M coins a girl from 60 to 85**. +2 % damage per gate
continues (×1.035 at L85 ★5 against gate 5). **Zenith** is the seventh tier of every family (Zenith Plume, Edge,
Flame, Frost, Omamori, Sigil, Cog), from Titan Trials, the Titan shelf and the Craft Room. The **Rainbow Crown**
(10 Rainbow Crown Shards fuse into one) comes only from Titan Trials and their shelves, never for gems.

**Craft Room** (any family material's sheet): 3 → 1 of the next tier for 5k / 15k / 40k / 100k / 150k coins (into
rare … Zenith), 2 → 1 into another family for half the combine fee into that tier; weekly caps: legendary 10,
Zenith 3 (combine), legendary 5, Zenith 2 (swap).

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

### Potential (P1–P6, bought with Essence; `docs/specs/POTENTIAL.md`, `docs/specs/ASCENSION.md` §A)

Every duplicate gives a girl 1 Essence; 1 Essence and coins raise her Potential by 1, up to P6 (one Essence per
step, so the pace below is unchanged). v3 (train C): every step is
bigger than the one before, a stat boost plus (from P3, from P2 for SSRs and heroes) a kit step; a damage girl's P6
is about R ×1.59 · SR ×1.83 · SSR ×2.28 over P1 on paper (the v3 design spec), and with level 85 (her cap at P6)
×2.04 / ×2.35 / ×2.93. Each step also raises her level cap (§5, Levels). (v1, live in v0.1.34, was ×1.07–1.10.)

How fast free players get there (revision 1's Monte Carlo, `exp/gacha-mc.mjs`, 3,000 players; the duplicate rules
are unchanged):

| Girl | Pulls to P2 (median) | Pulls to P4 | Pulls to P6 (median, 25–75 %) | P6 for a typical free player |
|---|---|---|---|---|
| Aoi (R, starter) | 4 | 13 | 24 (17–31) | inside the starter gift |
| Momo (R, gacha) | 9 | 19 | 29 (22–37) | inside the starter gift |
| Kage (SR, free after 2-5) | 37 | 135 | 236 (173–318) | inside the one-time sources |
| Raika (SR, gacha) | 86 | 190 | 294 (217–384) | ≈ 12 days after them |
| Hikari (SSR, starter) | 176 | 668 | 1,164 (857–>1,185) | ≈ 11 months after them |
| Kaede (SSR, gacha) | 411 | 896 | > 1,185 | over a year |
| Kaede with every spark on her | 200 | 411 | 654 (600–800) | ≈ 5 months after them |

After the roster (30 girls) everything slows (Aoi P6 at ~36 pulls, a standard-banner SSR P2 at ~910).
**R girls are P6 for everyone on day one and SR girls within the one-time sources**, so chapters 1–3 are played
with R girls at ≈ P6 (note for the playtest rebalance, #75). Value changes for the owner (spec §10): sparks and
tickets on an owned SSR give a step; freeplay runs last a few waves longer (more coins, milestones a little
sooner); endless pays a few more waves; clan boss caps unchanged.

### Battle scaling (deliberately modest — heroes used to be overpowered)

damage ×(1 + 1.8%·(level−1) + 2%·gates + 5%·stars) → level 60 / 5 gates / ★5 ≈ **×2.41**;
attack rate +0.4% per level; gear adds on top (ATK%, attack speed, range, crit, armor pierce,
cost cut ≤ 25%, ult haste ≤ 50%).

## 6. Gear

* Slots: charm (main ATK% / Crit DMG), ribbon (Crit Rate / Range / Armor Pierce), shoes (Attack Speed /
  Cost Reduction / Skill Haste).
* Rarity scales every roll: common ×1 · rare ×1.35 · super rare ×1.75 · mythic ×2.2 · legendary ×2.8
  (Armor Pierce scales at half rate). Main stats roll 1.2× a substat range and grow +6%/level (+4% for
  Armor Pierce) up to +10. Substats: 0/1/2/3/4 by rarity, never duplicating the main stat or each other;
  every 3rd enhancement level grows the least-upgraded substat.
* **Reroll substats:** Fortune Dice (1 / 1 / 1 / 2 / 3 by rarity) + coins; add a **Lock Pin** to keep one
  substat exactly as it is. Earned enhancement growth is kept.
* **Change main stat:** one Prism Dice + coins → the main stat the player picks from the slot's options.
* **Enhance:** (800 + 400·level) × (rarity order + 1) coins per level.
* **Salvage:** coins (+50% of enhance coins back) and Fortune Dice for super rare+ (legendary also gives a
  Lock Pin). Equipped or locked gear cannot be salvaged.
* Gear boxes (`gearbox_<rarity>`) dropped in battle open immediately into real gear; boxes bought in the
  Mall stay in the backpack until opened (`openGearBox`).
* **Ult Haste is called Skill Haste** (same key `ultHaste`, same numbers). **Every Line Counts:** a line her kit can't
  use (`GEAR_FIT`, `src/data/gearStats.js`), or the part of a stat past its MAX, turns into ATK at half an ATK line's
  worth, with the soft limit `12% × f / (f + 12%)` (Umeko and Miko: into Aura Power and aura radius, up to +5%).
  Caps: crit 75%, cost cut 25%, Skill Haste 50%, Crit DMG +200%, Range +50%, Pierce +150%, Aura Power +15%.

### Rainbow UR gear (`docs/specs/GEAR_AWAKEN.md`)

* **Rainbow Bloom:** a Legendary at +10 → UR for **1 Rainbow Seed + 80,000 coins** (always works, auto-locks). Every
  number ×8/7 (Armor Pierce ×1.105), max **+12**; +11 / +12 cost 28,800 / 31,200 coins (tier-6 prices: rerolls 3 dice +
  12,000, main 1 Prism + 30,000). A finished UR piece costs about 310,000 coins.
* **Starlight Needle:** 1 Needle + 20,000 coins per stitch (+1 growth step on the line chosen); gold +10 takes 1, UR 2
  (both may sit on one line). **Take back:** 10,000 coins, the Needle returns. Salvage returns the Seed and every Needle.
* **Seeds (never sold for gems, never random):** Rainbow Hunt weekly (3 Total Assault clears or Titan Trials wins, after 5-5) 1; first gold
  +10 gift 1; Freeplay "Ashwing Matriarch defeated" 1 per tier (3 in all; paid once on load to saves that passed it).
  About **1 a week** for an everyday late-game player.
* **Needles (never sold for gems):** Rainbow Hunt 1, Bounty Exchange 1 (30 Bounty Tokens, weekly), the week's first
  Freeplay cache 1 → **3 a week**; Freeplay "Reached wave 150" 2 per tier once.
* **Rainbow Resonance:** 2 UR pieces on one girl +5% Range, 3 +10%.
* **Celestial bad-luck counter (`pity:cel`):** 40 solo Total Assault Hard+ / Workshop Yard III Nightmare runs (sweeps
  count) without a Legendary piece → the next one adds a Celestial piece. Any Legendary resets it.

### Academy Clubs (`docs/specs/GEAR_STATS.md`)

* Mythic, Legendary and UR pieces belong to a club. 2 pieces: Archery +30% Pierce · Fencing +3% Crit Rate · Taiko +5%
  Attack Speed · Pyrotechnics +5% ATK · Tea +6% Aura Power. 3 pieces add a trick (Follow-Through, Finishing Thrust,
  Big Beat, Finale Pop, Second Cup). Bell (+8% Skill Haste, First Bell) comes with the tower abilities.
* Every new Mythic+ drop joins a random club; club pieces roll their club's 3 favourite substats at ×2 weight and
  can roll **Pierce** (ribbons) / **Aura Power** (shoes). Pieces without a club keep today's odds exactly.
* **Club Armband:** 1 band + 2,000 × (tier + 1) coins (Mythic 8,000 · Legendary 10,000 · UR 12,000) moves a piece into
  the club picked; stats unchanged. Sources (never gems): 9 as a welcome gift with the first Mythic+ piece, Club Day
  weekly (10 wins, after 2-5) 1 + 10,000 coins, Bounty Exchange 2 a week (10 tokens each) → about 3 a week.
* **Prism Dice:** the player chooses the new main stat (price unchanged).
* Weekly gem income is unchanged (the new weekly rows pay no gems).

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

## 9. Titan Trials, the weekly bosses (`docs/specs/ASCENSION.md` §C)

Four titans (Foundry Titan, Gloom Regent, Hyakki Daimyo, Eclipse Wyrm), each weak to one attack type and dropping
two material families (tap the one you need). Normal after 3-5, Hard after 6-5 + a Normal win, Nightmare after
8-5 + a Hard win, Mayhem after a Nightmare win, Mayhem +n after +(n − 1). 12 Trial Keys a week (6 carry over);
a key is used only at Bronze or better. Bronze / Silver / Gold (25 / 50 / 75 % of her HP) pay 35 / 60 / 85 % of the
damage table; a Victory pays all of it and the **Victory Chest** (legendary, Zenith and Crown Shard chances, one
gear box: Rainbow 0.5 % Nightmare / 4 % Mayhem (+0.25 % a rank, 6 % at most), Celestial 3 / 25 / 45 %, Radiant
25 / 59.5 / 51 %). The **Rainbow Meter** guarantees a Rainbow Gear Box by the 40th Mayhem win; the box opens in the Backpack
into one rainbow UR piece at +0 in the slot the player picks (salvage returns a Rainbow Seed). First clears pay
3,600 gems in all (once per titan per tier, solo only). Sweeps (a key) pay a Victory at the best tier won solo.

Weekly stores (game week): the Boss Exchange's **Titan shelf** (Crown Shard 40, Zenith 60, legendary 25 ×4, mythic
8 ×6, Tome 30 ×2, Kindred R 15 ×2, Kindred SR 60, SSR Kindred Shard 50 every other week from a Nightmare win,
Celestial box 120), the Gem Shop's Titan shelf (Zenith 250 ×2, SSR Kindred Shard 1,500 ×1; never crowns, keys or
boxes) and the **Memento Exchange** (tab of its own, two wallets). Measured pace (`tools/ascensionPace.mjs`, the
built tables): a free player's four carries reach L85 in week 22 and eight girls in week 30; Star Fragments a week
122 → 134 → 143 (free), 206 (spender); the Rainbow Meter averages 20 Mayhem wins and never passes 40.
