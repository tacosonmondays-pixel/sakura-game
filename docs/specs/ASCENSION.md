# Essence, level gates 60 → 85 and Titan Trials (build spec)

Sakura Sentinels, 2026-10-15. The build spec for the owner's request, synthesized from three proposals
(`proposal-fair.md`, `proposal-chase.md`, `proposal-simple.md`) and the fact base (`research.md`). Players and the owner
are "they"; every girl is "she". No other game is named anywhere in this file.

**The owner's request (verbatim):** "When you get a duplicate character, you will recieve an essense, you will use that
item to increase their potential level! However leveling them will require a new set of items, including a ur crown
from new bosses! Weekly bosses are here, they have a low chance to drop ur gear boxes, a medium chance for legenfary or
ssr gear boxes, etc. and you will recieve a specific item depending on the boss and what you need for the girls you
know for enhancment theres different item catergries like feathers and gears, it that basically, it alsos takes a lot
of money! What else do you suggest"

**Binding answers.** Round 1: the boss items are for **level gates past 60** (P2 63 · P3 67 · P4 72 · P5 78 · P6 85);
Essence + coins raise Potential; each P level opens a gate broken with family materials + coins, the last gates also a
UR Crown; Akashic Tomes give the EXP in between. **A duplicate gives Essence only** (no Star Fragments); fragments must
come from the weekly bosses and the shop. Wave 250 stays out of reach; L85 at P6; free players beat the 4-5 Matriarch
around month 6. Round 2 (`OWNER_ANSWERS_2.md`): all ten suggestions yes: (1) visible UR-box pity; (2) UR Crown shards,
also buyable with universal Essence shards in a limited weekly store; (3) a boss exchange currency; (4) 3 → 1 combine
and family swap; (5) universal Essence **with rarities** "otherwise players might get too many for SSRs"; (6) tiers,
first clears, sweeps; (7) a weakness per boss; (8) damage tiers **plus a guaranteed bonus for beating it**; (9) co-op,
a together chest, a clan damage board; (10) extra Essence gives spark progress "of course" **and** feeds a
**two-currency duplicate shop** (higher currency: higher-rarity items, featured-girl Essence, premium tickets; lower:
simple materials, standard tickets).

**Sources.** `file:line` with no prefix = `/home/user/wt-v130` (release/v0.1.30, HEAD `25c6a76`). `RS §n` =
`(design scratch, not in the repo)`. `P3 §n` = `docs/specs/POTENTIAL.md (v3 sections; full design notes stayed in the design scratch)`; `P2R §n` =
`(design scratch, not in the repo)`; `GA Rn/§n` = `docs/specs/GEAR_AWAKEN.md`; `EN` =
`docs/specs/ENERGY_RESET.md`; `PC` = `docs/merge/PATH_CAP.md`; `ACH` = `docs/specs/ACHIEVEMENTS.md`;
`ECON` = `docs/ECONOMY.md`. Proposals: `PF` (fair), `PCh` (chase), `PS` (simple).

**Labels.** **code** = read from source; **computed** = arithmetic on code values; **spec** = a planned number from
another spec; **model** = expected values from `(design scratch, not in the repo)` → `synth.txt` and
`tools/titanhp.mjs` → `titanhp.txt` (built on RS §2.6's late-game income, P3 §8.4's kill capacities and P2R §4's
duplicate pace); **design** = a number this spec sets (a tuning knob checked by the gates in §H). Nothing in any repo
was written.

**Revision 2 (critic round, same day).** One budget per currency in the model (tokens, Mementos, Moonpearls are spent
once); Normal/Hard titan tables scaled to the chapters they open in; the Rainbow Gear Box drops on Mayhem (4 %+) and at
0.5 % on Nightmare, never from first clears, so titans no longer pull free UR forward; every SSR Kindred source counted
(free ≈ 1 step by week 26); Rainbow Crown supply cut so the crown binds; co-op titans pay no first clears and unlock
nothing; titan HP conversion through the sim's multipliers; shop, box-born UR, Rainbow box and pouch safety for stale
tabs; gates 6–10 are ×1.035 (not ×1.017); spender ★ pace and pull income stated; "Material Workshop" renamed **Craft
Room**. Model v2: `tools/synth.mjs` → `synth.txt` (v1 kept as `synth.v1.*`).

**Hard rules for the builder.** Never write another commercial game's name in code, docs, tests, commits or player text.
Everything the sim decides stays deterministic. Kid-safe wording (she trains harder; nothing about looks). Commit
trailers as the session asks.

---------------------------------------------------------------------------------------------------

## 0. Decisions on one page

1. **A duplicate gives 1 Essence of her, at every rarity, and nothing else** (no Star Fragments). **Each Potential step
   costs 1 Essence + coins**: R 37k · SR 95k · SSR 240k for P1 → P6 (design). One Essence per step reproduces Potential
   v3's pace to the recruit (P2R §4.2: R P6 in 24–29 recruits, free SR ≈ 237, free SSRs P2–P3 for months). Potential is
   bought with a button, never automatic.
2. **She holds at most `6 − P` Essence.** A duplicate beyond that is a **spare** and converts on arrival: **R → 2
   Mementos + ⅕ recruit point; SR → 6 Mementos + 1 Moonpearl + 1 recruit point; SSR → 10 Moonpearls + 5 recruit
   points.** Spark every ≈ 148 recruits for a late free player instead of 200 (model).
3. **Memento Exchange** (new Mall tab, two wallets): **Mementos** (lower) buy simple materials, Tomes, Star Fragments and
   a standard Recruit Ticket; **Moonpearls** (higher) buy Legendary/Zenith items, Rainbow Crown Shards, a **Chosen SSR
   Essence** (the featured girl once banners ship) and a premium 10× Recruit Ticket. Weekly stock; it returns at most
   4.6 % + 2.6 % of the recruits that fed it, so it can never loop into free pulls; nothing in it is sold for gems
   (computed, §A.5).
4. **Kindred Essence** (universal, with rarities): **R** and **SR** whole; **SSR only as shards (10 → 1)**. Each works on
   a girl of its rarity or lower who has none of her own. Rows with no girl to use them on are hidden. SSR shards: a
   Titan shelf row every other week, a 4 % Mayhem chest line and one gem row a week; a free player gets ≈ 1 SSR step by
   month 6 from them (model, §A.4).
5. **Gates 6–10 continue breakthrough past 60.** Gate *k* opens at P(k − 4) (caps 63 / 67 / 72 / 78 / 85) and costs
   her family's **mythic + legendary**, a **new seventh tier, Zenith** (Zenith Plume, Edge, Flame, Frost, Omamori,
   Sigil, Cog), coins, and on gates 9 and 10 one **Rainbow Crown** (the UR Crown; 10 Rainbow Crown Shards fuse into
   one). Per girl: **18 mythic · 20 legendary · 10 Zenith · 2 Rainbow Crowns · 1.9M coins**, plus P3's unchanged **25
   Akashic Tomes + 300k coins** for the levels between gates = **2.2M coins a girl** (today's whole 1 → 60 + gates 1–5 +
   ★5 bill is 1.62M, RS §1.4). Each gate adds +2 % damage as gates 1–5 do: ×1.035 at L85 ★5 for gates 6–10 (§B.1).
6. **Titan Trials, the weekly bosses**: the four Freeplay titans (already modelled, already in the co-op hash,
   `src/data/enemies.js:822,835,848,860`) — **Foundry Titan, Gloom Regent, Hyakki Daimyo, Eclipse Wyrm** — each with
   its type-chart weakness (`src/data/types.js:25-31`) and two material families (tap one as your target). **12 Trial
   Keys a week** spent on any titan, up to 6 carried over; no energy. Tiers **Normal → Hard → Nightmare → Mayhem →
   Mayhem +1, +2 …** ("Inferno" is Akane's top tier name, `src/data/units.js:655`). Normal and Hard pay what their
   chapters (3-5, 6-5) can use: no legendary in Normal, legendary 25 % on Hard (§C.6).
7. **Damage chests + a guaranteed Victory Chest.** Bronze 25 % / Silver 50 % / Gold 75 % of her HP pay 35 / 60 / 85 %
   of the tier's damage table without a kill; a **Victory** pays all of it **plus the Victory Chest**: legendary of the
   target family, Zenith and Rainbow Crown Shard chances, and **one gear box: Rainbow (UR) 0.5 % on Nightmare, 4 % on
   Mayhem (+0.25 % a rank, cap 6 %); Celestial (legendary) 3 / 25 / 45 %; Radiant (the "SSR" box) 25 / 59.5 / 51 %** on
   Hard / Nightmare / Mayhem. **Rainbow Meter:** a Rainbow Gear Box at the latest on the 40th **Mayhem** Victory Chest,
   shown on the hub.
8. **The exchange currency is the Assault Token**, and the existing **Boss Exchange** gets a weekly **Titan shelf**
   (a Crown Shard, Zenith, legendary of any family, Kindred Essence, an SSR shard every other week, Tomes, a Celestial
   box). The **Gem Shop** gets a small weekly Titan shelf for spenders (Zenith ×2, SSR shard ×1; never crowns).
9. **Craft Room** (Backpack): combine **3 → 1** of the next tier, swap **2 → 1** into another family, both for coins;
   top steps weekly-capped.
10. **Star Fragments stay whole.** Each currency is spent once in the model (tokens: Boss ticket → both fragment packs →
    Titan shelf; Mementos: two fragment packs → a Tome). Free: **≈ 95 a week in weeks 1–2** (today ≈ 88 early), **129**
    in weeks 3–4, **134** in months 2–5, **143** in month 6 (today ≈ 100 late, 80 % of it from duplicates, RS §4).
    Spender: **206** against today's 266 (**78 %**), because duplicates no longer pay fragments (§A.8).
11. **Pace (model):** an active free player has **4 carries at L75 in week 16** (month 3.7), **at L85 in week 24**
    (month 5.5) and **8 girls at L85 in week 30** (month 7). **Coins and Rainbow Crowns** are what they wait on ("it
    alsos takes a lot of money"). That is P3's F2P-steady and F2P-late on time. A spender has **9 girls at L85 in week
    15** and all 19 in **week 28**, then climbs Mayhem +2 … +4 by weakness (§E.2). Free UR gear is still GA's pace (titans
    add ≈ 1.7 boxes by week 26); gate K2 measures P3's ladder with that profile before "P3's ladder holds" is claimed.
12. **Co-op safety:** M1 touches **no co-op-hashed file**: solo titan battles inject their stage and enemy overrides
    through the sim's existing data hook (`src/sim/data.js:52-68`), and every drop is rolled **outside the sim from a
    per-attempt seed** (§C.6). Co-op titans (M2) change the co-op id once and **never pay first clears, unlock tiers or
    raise the sweep tier** (the co-op rule, `src/online/coop/rewards.js:1-3`).
13. **Saves:** additive only, no `SAVE_VERSION` bump (`src/systems/save.js:19`); every new value is mirrored in
    `missions.counters`; a reader release (M0) ships first, with every new item and shop offer id.
14. **Ships:** M0 reader (normal update) → **M1 "Essence & Titans"** (with Potential v3 in train C, or the next normal
    update; Essence-only and the titans never ship apart) → M2 co-op titans, Together Chest, clan board (next co-op-id
    release) → M3 cosmetic chase (frames, titles, seasons).

---------------------------------------------------------------------------------------------------

## 1. The owner's words → behaviour

| Owner said | Behaviour | § |
|---|---|---|
| "When you get a duplicate character, you will recieve an essense" | 1 Essence of her per duplicate, every rarity; nothing else | A.1 |
| "you will use that item to increase their potential level!" | **Raise Potential**: 1 Essence + coins per step | A.2 |
| "leveling them will require a new set of items" | gates 6–10: her family's mythic + legendary + the new **Zenith** tier ("feathers and gears": Zenith Plume … Zenith Cog) | B |
| "including a ur crown from new bosses!" | **Rainbow Crown** on gates 9 and 10; shards only from Titan Trials and their shelves | B.4 |
| "Weekly bosses are here" | Titan Trials: four titans, 12 keys a week | C |
| "a low chance to drop ur gear boxes" | Rainbow Gear Box 0.5 % on Nightmare, 4 % on Mayhem (up to 6 % at high ranks) + Rainbow Meter 40 (Mayhem) | C.6, C.8 |
| "a medium chance for legenfary or ssr gear boxes, etc." | Celestial (legendary) 25–45 % from Nightmare up (3 % on Hard), Radiant (mythic, the tier above SR) 25–60 %, Ornate / Sturdy as filler | C.6 |
| "a specific item depending on the boss and what you need for the girls" | each titan drops two families; you tap the one you need (pre-picked for the girl whose gate is next) | C.1 |
| "it alsos takes a lot of money" | 1.9M coins in gates + 300k in levels per girl; gate 10 alone is 800k, the biggest single price in the game | B.2, E.4 |
| Answer 1: bad-luck counter | Rainbow Meter "23 / 40" on the hub | C.8 |
| Answer 2: crown shards; buy shards in a weekly store | 10 shards = 1 Rainbow Crown; the Titan shelf (tokens) sells a Crown Shard a week and an SSR Kindred Shard every other week; Moonpearls buy Crown Shards; the Gem Shop's Titan shelf sells one SSR shard a week | B.4, C.10 |
| Answer 3: boss exchange currency | every attempt pays Assault Tokens; the Boss Exchange's Titan shelf sells exactly what you miss | C.10 |
| Answer 4: conversion | Craft Room: 3 → 1 up, 2 → 1 family swap | B.6 |
| Answer 5: universal Essence with rarities | Kindred Essence R / SR whole, SSR only as shards | A.4 |
| Answer 6: tiers, first clears, sweep | Normal / Hard / Nightmare / Mayhem / Mayhem +n; first-clear rewards; sweep after a solo Victory | C.3, C.4, C.9 |
| Answer 7: weakness per boss | the titan's armor class on the live type chart; the hub lists your girls who hit it | C.1 |
| Answer 8: damage tiers + guaranteed reward for beating it | Bronze / Silver / Gold pay a share; Victory pays all of it **and** the Victory Chest | C.5 |
| Answer 9: co-op, together chest, clan board | M2: co-op titans (damage table + Victory Chest + Together Chest; no first clears or unlocks), clan titan board on the Titan of the Week | C.11 |
| Answer 10: spark + two-currency duplicate shop | spares give recruit points + Mementos / Moonpearls → Memento Exchange | A.3, A.5 |

---------------------------------------------------------------------------------------------------

## 2. How this design was chosen

### 2.1 Scores (0–10)

| Criterion | Fair (`PF`) | Chase (`PCh`) | Simple (`PS`) |
|---|---:|---:|---:|
| Owner fit (every requirement and binding answer) | 8 | 8.5 | 7.5 |
| Free-player fairness | 9 | 7 | 8 |
| Spender excitement | 6.5 | 9.5 | 6.5 |
| Clarity for players | 6.5 | 5.5 | 8.5 |
| Build cost / risk (high = cheap and safe) | 6 | 4.5 | 8 |
| Economy soundness (vs `RS`) | 7.5 | 7 | 6.5 |
| **Total (of 60)** | **44** | **42** | **45** |

- **PF:** meets all ten answers with the strongest free-player protections (fragment bridges, welcome pouch, pity 30, no
  gem keys). Against it: "Inferno" clashes with Akane's tier `Inferno Queen` (`src/data/units.js:655`); "Wish Essence"
  echoes another game's pull word; five new currencies plus a Training Focus and a 2 + 1 attempt rule; Gatebreaker
  stages in hashed `STAGES` plus a sim leak rule; it counts gates 6–10 as +10 % damage, but the bonus is additive inside
  the level term, so it is ×1.035 at L85 (computed from `src/systems/progression.js:273`: (1 + 1.8 %·84 + 2 %·10 +
  5 %·5) / (1 + 1.8 %·84 + 2 %·5 + 5 %·5) = 2.962 / 2.862); its fragment text (114–138) and its own model output
  (90–114, `tools/fair.txt`) disagree.
- **PCh:** the best spender chase (endless ranks, a whole-crown jackpot, frames), the cleanest shop-return maths
  (1.6 % / 2.65 %), and it caught the profile-card limit (`bt` 0–9, `src/online/profileRules.js:105`). Against it:
  ≈ 40 new item ids (one Essence item per girl), monthly shop resets (a new reset kind; `src/data/shop.js:3` has
  daily / weekly / never), gem-bought keys in a kids' game, a hashed `titans.js` + a sim result in M1, co-op in train C,
  Zenith and shards ≈ 2× the month-6 need, the most currencies to learn.
- **PS:** the cheapest safe build: solo titans injected through `createDataSource` overrides (no hash change), Essence
  as a derived number, 8 item ids, Assault Tokens as the "Boss Seals", one sentence per screen. Against it: no new
  family items (the owner asked for "a new set of items … like feathers and gears"); two bugs — "the tier changes only
  `hpScale`" would also multiply every escort (`src/sim/Sim.js:280`), and `breakthrough` 10 makes the profile card fail
  (`src/online/profileRules.js:105`); the highest shop return (6–8 %); 60 mythic per girl (a mythic glut).

### 2.2 What this spec takes from each

| From | Taken |
|---|---|
| **PS (base: build skeleton)** | solo titans with **no co-op-hash change** (stage + enemy overrides through `src/sim/data.js:52-68`), damage read outside the sim; Essence as a **derived number**, not 19–30 items; **hold cap 6 − P** with spares converting on arrival; **Assault Tokens + the Boss Exchange** as the exchange ("Boss Seals"); one Mall tab with both wallets; R / SR whole + SSR-only-as-shards; the full-board titan format; **Rainbow Crown** and **Mayhem** names; `breakthrough` continuing to 10; one-sentence screens |
| **PF (free-player protections)** | the escalating Potential coins (R 37k / SR 95k / SSR 240k); the **fragment bridges** (daily +2, weekly +10, lesson +40) and the Memento fragment row; welcome pouch; **monotone counters** for the Essence balance (stale tabs cannot corrupt it); titans weak/strong by the live chart with the free carries' families on the pierce-weak Wyrm (feather / ember); bestiary guard for "Starlight Vigil"; "Rainbow Hunt joins the titans" |
| **PCh (spender chase + correctness)** | the **Zenith** tier names; **Kindred Essence** name; **pooled Trial Keys** with carry-over (pick the titan you need); **Mayhem +n** endless ranks and the rare **whole Rainbow Crown** jackpot; Rainbow Gear Box opening into **real UR gear at +0 in the slot you choose**; "choose family" shelf rows; HP sized from P3 profiles; R spares give ⅕ point (honours "spark currency of course"); the 10× ticket priced so the price itself bounds the return; profile card sends `bt ≤ 5`; no-key-below-Bronze |
| **Synthesis fixes** | titan HP per tier = k × √(capacity vs her class × neutral capacity) of the tier's profile so the weakness matters without walling Build A at Hard (§C.3); escorts kept at chapter-8 size by overriding only the titan and her splitter children's HP, divided by the sim's own multipliers (§C.2); gate costs and drop rates retuned on one model (`synth.mjs`, one budget per currency) so coins and Rainbow Crowns bind; no gem keys |

---------------------------------------------------------------------------------------------------

## A. Essence

### A.1 The rule ("Each duplicate gives her one Essence; one Essence and some coins raise her Potential.")

- `grantUnit` (`src/systems/unlocks.js:27-46`) keeps `dupes += 1` (`:40`) and the `pot:` shadow
  (`src/systems/potential.js:56-61`): `dupes` is now the **Essence-earned history**. It **stops adding Star Fragments**
  (`unlocks.js:42-43`). `UNIT_RARITIES[*].fragmentsOnDupe` (`src/data/types.js:198-202`) stays in the file unread,
  because `types.js` is co-op hashed (RS §5.4); a later id-changing train may delete it.
- Return shape becomes `{ isNew, essence: 0|1, spare: null|{ mementos, moonpearls, points }, potential, readyStep }`
  (recruit screen chips, §D.1). Every reader of the old `fragments` field changes with it (§A.6).
- A first copy gives nothing new (`unlocks.js:30-37`). Stage-clear unlocks of an owned girl still never make a
  duplicate (`src/systems/rewards.js:178-183`).
- **Potential is bought.** `potentialLevel(u)` (`src/systems/potential.js:46-48`) reads the stored unit field `pl`
  (1–6) instead of `min(6, 1 + dupes)`, and returns **1 when `pl` is absent** (never falls back to `dupes`, which now
  counts spares too). Migration (§A.7) sets `pl` on every owned girl, and the profile-card and co-op snapshots carry it
  (§F.4). P3's ladders, caps and battle steps read `potentialLevel` and are otherwise unchanged.
- **Why 1 each:** P3 sized every step on one duplicate per step (P2R §4.2-4.6); rarity-weighted Essence would put free
  SSRs at P4–P5 by month 3 and break P3's "SSRs are the lasting spender gap" (P3 §0 item 9).

| Girl (class) | Recruits for P2 | P4 | P6 (median, P2R §4.2) |
|---|---:|---:|---:|
| Aoi (R, starter) | 4 | 14 | 24 |
| Momo (R, gacha) | 9 | 19 | 29 |
| Kage (SR, free) | 37 | 136 | 237 (≈ day 30 active free, P2R §4.3-4.4) |
| Raika (SR, gacha) | 87 | 191 | 296 |
| Hikari (SSR hero) | 174 | 669 | 1,158 |
| Kaede (SSR, gacha) | 418 | 907 | 1,400 |

### A.2 Raise Potential: 1 Essence + coins (design; table in `src/systems/potential.js`, not hashed)

| Step | R | SR (and Nami) | SSR (and Hikari, Luna) | Allows |
|---|---:|---:|---:|---|
| P1 → P2 | 2,000 | 5,000 | 10,000 | gate 6 (cap 63) |
| P2 → P3 | 4,000 | 10,000 | 20,000 | gate 7 (67) |
| P3 → P4 | 6,000 | 15,000 | 40,000 | gate 8 (72) |
| P4 → P5 | 10,000 | 25,000 | 70,000 | gate 9 (78) |
| P5 → P6 | 15,000 | 40,000 | 100,000 | gate 10 (85) |
| **P1 → P6** | **37,000** | **95,000** | **240,000** | |

- All 14 R/SR girls to P6 = 4 × 37k + 10 × 95k = **1.1M coins over the first ≈ two months** (computed) — a speed
  bump, so P3's chapter-indexed campaign profiles (P3 §10) still hold. SSR steps are the expensive ones and arrive
  months apart for free players.
- The step needs no level or gate; the kit buffs (P3 §5) work at any level. It only *allows* the next gate (§B.1).
- Essence never expires. Coins are charged only on **Raise Potential**; the button never fails.

### A.3 Hold cap and spares (the owner's "extra essences")

- **She holds at most `6 − P` Essence.** A duplicate (or spark, or Select Ticket) that would exceed it is a **spare**
  and converts at once:

| Spare of | Mementos (lower) | Moonpearls (higher) | Recruit points (spark) |
|---|---:|---:|---:|
| an R girl | 2 | — | **⅕** (counter `spk:r` keeps fifths; the recruit screen shows a 5-pip meter) |
| an SR girl | 6 | 1 | +1 |
| an SSR girl | — | 10 | +5 |

- Recruit points already come 1 per recruit and 200 buy any SSR (`src/systems/gacha.js:49,116-126`,
  `src/data/shop.js:40`). **Why R gives only ⅕:** R spares are 78.5 % of all recruits after ≈ 30 recruits
  (`src/systems/potential.js:25`); a full point each would make sparks ≈ 1.8× as frequent for everyone.
- **Spark pace (model, `synth.txt`):** late free player 148 recruits per spark (was 200), SSRs per recruit 2.71 % vs
  2.53 % (+6.9 %); everyone-P6 spender 138 (+8.9 %). Knob: R ⅕ → 0 (168 recruits, +3.9 %) if the owner wants the gem
  economy closer to today.
- **Free SSR income, everything together (model):** 0.486 SSRs a week today (19.2 × 2.53 %) → **0.519 (+6.9 %)** with
  the spark, and **at most 0.550 (+13.2 %)** if every Memento and Moonpearl also went to Recruit Tickets (1.12 recruits a
  week). The model player spends Mementos on fragments and a Tome and saves Moonpearls for a Chosen SSR Essence, so it
  sits near +7 %. Once: 3,600 first-clear gems (30 recruits, §C.9). Gate E3 holds the combined figure at ≤ +15 %.
- No loop: a spark on a P6 SSR returns 5 of its 200 points.
- **Replaces P3 §4.4's "duplicates past P6 pay SR 1 / SSR 5 Akashic Tomes"** (Tomes move to the Memento Exchange, the
  Titan shelf and titan drops, §B.5).

### A.4 Kindred Essence (universal, with rarities)

| Item (id) | Works on | Free sources | Spender source |
|---|---|---|---|
| **Kindred Essence (R)** `kindred_r` | an R girl | Titan shelf 15 tokens ×2/week; Memento 30 ×1/week; Normal first clears ×2 per titan | — |
| **Kindred Essence (SR)** `kindred_sr` | an SR or R girl | Titan shelf 60 tokens ×1/week; Hard first clears ×1 per titan | — |
| **Kindred Shard (SSR)** `kindred_shard_ssr` → 10 fuse into **Kindred Essence (SSR)** `kindred_ssr` | any girl | Titan shelf 50 tokens, **1 every other game week**, opens with the first Nightmare titan clear; Mayhem Victory Chest 4 % | Gem shelf 1,500 gems ×1/week |

- **Rules (one sentence on screen: "Kindred Essence stands in for her own Essence."):** usable only when she has **none
  of her own Essence**, never on a P6 girl. Using an SSR-grade one on an R or SR girl asks first ("This is your rarest
  Essence. Use it on Aoi?").
- **No dead rows (design):** a shop row is hidden while no owned girl can use it (the R row once every R girl is P6, the
  SR row once every R and SR girl is P6; R girls reach P6 at 24–29 recruits and SRs by ≈ day 60, P2R §4.4). A Kindred
  item already in the Backpack with no girl to use it on can be **released** for exactly a spare of its rarity (R 2
  Mementos; SR 6 Mementos + 1 Moonpearl; SSR 10 Moonpearls), **without** recruit points. The roster update's new girls
  bring the rows back.
- **All SSR sources counted (model, `synth.txt`).** Free: the shelf row from week 10 (≈ 9 shards by week 26) + Mayhem
  chests (8 × 4 % = 0.32 a week from week 25) = **≈ 9.6 shards by week 26 ≈ one SSR step by month 6**. The Moonpearl
  **Chosen SSR Essence** (120, §A.5) is first affordable around **week 37** (15 in the pouch + 3.7 a week from week 9).
  Mayhem first clears pay **no** SSR Kindred (§C.9). So P3's free profile (SSRs P2–P3, P3 §8.3) moves by at most one
  step on one favourite by day 180 (gate E2b), and the whale gap (SSRs at P6, P3 §0 item 9) is kept.
- **Spender (model):** Titan shelf 0.5 + Mayhem chests 0.48 + Gem shelf 1 = **≈ 2 shards a week (0.2 SSR steps)**, plus
  at most 0.19 steps from Chosen SSR Essence if every Moonpearl went there → **≤ 0.4 SSR steps a week** on top of their
  duplicates (gate E3). That answers the owner's "otherwise players might get too many for SSRs".
- **Gem price:** 10 shards = 15,000 gems = 125 recruits (120 gems each, ECON) for one chosen SSR step; a chosen SSR copy
  by spark is 200 recruits, a specific SSR by luck ≈ 246 (RS §4: 2.03 % over 5 SSRs). One gem shard a week = one step per
  10 weeks.
- Fusing 10 shards is automatic, with the fanfare (§D.4).

### A.5 The Memento Exchange (new Mall tab; both wallets on one tab)

`SHOP_TABS` gains `{ id: 'memento', name: 'Memento Exchange', desc: 'Spare duplicates become Mementos and Moonpearls.
Spend them here.' }` (`src/data/shop.js:10-16`). Offers carry a per-offer `currency` (`memento` or `moonpearl`), which
the Mall reads instead of the tab currency (small shop change; not hashed). **All stock is weekly** (`resets:
'weekly'`, `src/data/shop.js:3`); "choose family" rows are seven offers sharing one weekly `group` stock (new `group`
field, counted in `profile.shop`; reset rule in §F.1).

| Mementos (lower) | Price | Stock / week | | Moonpearls (higher) | Price | Stock / week |
|---|---:|---:|---|---|---:|---:|
| Recruit Ticket (standard; `ticket_recruit`) | 60 | 1 | | **10× Recruit Ticket** (premium, SR+ guaranteed, `ticket_recruit10`; becomes the featured-banner 10× ticket once banners ship) | 150 | 1 |
| **Star Fragment ×10** | 15 | **8** | | **Chosen SSR Essence** (1 Essence for an owned SSR you pick; the featured girl once banners ship) | **120** | 1 |
| Akashic Tome | 20 | 2 | | Rainbow Crown Shard | 12 | 2 |
| Mythic material (choose family) | 20 | 2 | | Zenith material (choose family) | 15 | 1 |
| 2 Super Rare materials (choose family) | 10 | 4 | | Legendary material (choose family) | 6 | 2 |
| Kindred Essence (R) (hidden with no R girl below P6) | 30 | 1 | | Celestial Gear Box | 25 | 1 |
| Fortune Dice | 6 | 3 | | | | |
| 20,000 coins | 10 | 3 | | | | |

- **Why it cannot be farmed into pulls (computed):** per recruit an everyone-P6 account gets at most 0.785 × 2 + 0.194 ×
  6 = **2.73 Mementos** and 0.194 + 0.0203 × 10 = **0.40 Moonpearls**. A Recruit Ticket (60) therefore returns ≤ 4.6 %
  of the recruits that fed it and the 10× ticket (150 for 10) ≤ 2.6 %; the series converges, and the weekly stock (1 + 10
  recruits) binds first for big spenders. A free late player earns 52.5 Mementos and 3.7 Moonpearls a week (model):
  **at most** 1.12 recruits a week back (5.8 %) if all of it went to tickets; the model player spends Mementos on two
  fragment packs and a Tome instead (§A.8) and saves Moonpearls (§A.4). Combined pull income: §A.3. **No Memento or
  Moonpearl is ever sold for gems**, and gems never buy them.
- **Fragment row stock 8** so spare-rich spenders keep a ★ pace (§A.8): 155 Mementos a week buy all 8 packs.
- **Chosen SSR Essence** adds to `essB:<id>` (§F) and is greyed when she is at her hold cap. Its price (120) puts the first
  one at ≈ week 37 for a free player and ≈ 0.19 a week for a spender (§A.4). No SR "chosen" or SR Kindred rows on the
  Moonpearl side: Moonpearls only start once SR spares do (all SRs P6, ≈ day 60, P2R §4.4), when no SR row would have a
  girl to use it on.

### A.6 Sparks, Select Tickets and copy

- **SSR Select Ticket on an owned SSR** (`src/systems/gacha.js:136-145`): 1 Essence of her (or a spare at her cap)
  instead of 40 fragments. Text at `src/data/items.js:182`: "…If you already have her, she gains 1 Essence."
- **Spark of an owned SSR** (`gacha.js:116-126`): 1 Essence of her (same `grantUnit`).
- Every "duplicates → fragments" line changes in one pass (RS §1.6): `src/data/items.js:165,182`,
  `src/systems/inventory.js:172`, `src/ui/screens/recruit.js:73,83,248,374,421`, `src/ui/selectTicket.js:39,48`,
  `src/data/wiki.js:272,324,362,373`, `docs/ECONOMY.md:14,23`. Star Fragment text: "Crystallised wishes. Earned in Titan
  Trials, exchanges and commissions, and used for every awakening."
- **Readers of the old `fragments` result field** (it no longer exists): `src/ui/selectTicket.js:80` ("+N Star
  Fragments" would read "+undefined"), `src/ui/screens/recruit.js:97` (spark reveal) and `:369` (fragment total),
  `src/systems/gacha.js:98` (result rows), `src/systems/shop.js:87` (spark rewards list). The recruit results, the Select
  Ticket result and the spark result show **"+1 Essence"** or the spare payout ("+6 Mementos · +1 Moonpearl · +1 point")
  instead.

### A.7 Migration (first M1 load; idempotent; marker counter `ess:mig`)

1. **Already-counted duplicates become Potential, free.** For every owned girl `pl = min(6, 1 + dupes)` — exactly what
   the v0.1.28 patch note promised ("counted for her … ready for Potential in a coming update",
   `src/data/patchNotes.js:67`). No coins. Saves from before M0 are first credited by `creditPotential`
   (`src/systems/save.js:463`, `src/systems/potential.js:63-149`).
2. **Duplicates past P6** (`dupes − 5 > 0`) are marked converted (`essX = dupes − 5`). Those copies already paid their
   fragments and their recruit point in the live build (`src/systems/unlocks.js:22,42-43`), so this step is **a gift
   inside the welcome pouch, not a payout**: it sizes the pouch at the §A.3 rates, no recruit points.
3. **Welcome pouch:** every account gets at least **60 Mementos + 15 Moonpearls**, and at most 300 + 60 from step 2
   (a veteran with ≈ 55 spare copies per R girl would otherwise get ≈ 450 at once, PS §A7). **Paid straight into
   `profile.items` during the migration** and mirrored by `inv:` (§F.1), never as a letter attachment: an older build's
   `cleanMail` drops reward ids it does not know (`src/systems/save.js:282,300`; GA §8.3 avoids mail for the same
   reason). A letter only explains it: "Your girls' duplicates are now Essence! Every Potential step they had earned is
   unlocked for free, and extra copies became Mementos and Moonpearls for the new Memento Exchange."
4. **Star Fragments already owned stay.** Nothing converts.
5. If train C ships P3's automatic Potential before M1, step 1 gives the same P: **P never drops**.

### A.8 Star Fragments after "Essence only"

New fragment sources (with today's: login day 6 5/week, Total Assault 20–30 %, Recruit Exchange 10 for 30 points, Boss
Exchange 10 for 40 tokens ×2, clan boss; RS §2.5):

| Source | Amount | Code |
|---|---|---|
| Titan Trials damage table | 5 / 5 / 5 / 6 per Victory (Normal / Hard / Nightmare / Mayhem); × the notch share otherwise | §C.6 |
| First clears | 20 per titan on Normal | §C.9 |
| Memento row | 10 for 15 Mementos, **8 a week** | §A.5 |
| **Bridge:** daily "Patrol Duty" | +2 Star Fragments (today 30 gems + 2 rare books); titan Victories and sweeps count | `src/data/missions.js:14` |
| **Bridge:** weekly "Crown Hunter" | +10 Star Fragments | `src/data/missions.js:25` |
| **Bridge:** Captain's Journal Awakening lesson | 10 → **50** once | `src/data/story/lessons.js:150` |

**One budget per currency (model, `synth.mjs` v2):** Assault Tokens go to the Boss Exchange Recruit Ticket (60), then
**both fragment packs (80)**, then the Titan shelf (Crown Shard, Zenith, the SSR shard on its weeks, legendary, Tomes);
Mementos go to **two fragment packs (30)**, then one Akashic Tome (20). Early token income before Total Assault and the
clan boss open is an **estimate** (≈ 30 a week; 108.5 after, RS §2.6).

| Free player (model) | Titans | Other | Bridges | Boss packs | Memento packs | **A week** | Today |
|---|---:|---:|---:|---:|---:|---:|---:|
| Weeks 1–2 (Normal Silver) | 36 | 5 (login) | 24 | 10 | 20 | **≈ 95** | ≈ 88 (RS §4, early) |
| Weeks 3–4 (Normal Victory) | 60 | 5 | 24 | 20 | 20 | **≈ 129** | ≈ 88 |
| Months 2–5 (Hard, Nightmare) | 60 | 10.45 | 24 | 20 | 20 | **≈ 134** | ≈ 100 |
| Month 6 (Mayhem) | 68 | 10.45 | 24 | 20 | 20 | **≈ 143** | ≈ 100 |

- **Spender (computed, `synth.txt`):** today a duplicate pays R 2 · SR 10 · SSR 40 (`src/data/types.js:198-202`) = **4.32
  fragments a recruit** with every girl owned (RS §4 shares), so 56.7 recruits a week make ≈ 245 + 20 = **266** today.
  After: titans 72 (Mayhem +2) + 10.45 + 24 + 20 + **80 (all 8 Memento packs)** = **206 = 78 %** of today; all 19 girls to
  ★5 (3,610, `src/systems/progression.js:214-220`) in ≈ 17.5 weeks instead of 13.6. A 100-recruit whale goes from 453 to
  206 (**46 %**, 8 → 17.5 weeks): the owner's "a duplicate gives Essence only" moves the whale's ★ edge into Essence and
  Potential; the stock-8 row keeps money useful (gate E4: spender ≥ 70 %).
- Demand is finite: 190 per girl for ★5 (`src/systems/progression.js:214-220`). Knobs: if the early ★ pace runs hot,
  Normal fragments 5 → 4 (weeks 1–2 ≈ 83, weeks 3–4 ≈ 117); if spenders feel it, the Memento row 8 → 10.

---------------------------------------------------------------------------------------------------

## B. Gates 6–10 (level gates past 60)

### B.1 The rule ("Each Potential step opens a gate; break it with her materials and coins to raise her level cap.")

- `MAX_BREAKTHROUGH` 5 → **10** (`src/systems/progression.js:17`); `breakthrough` simply continues.
- Gate *k* (6–10) can be broken only at **Potential ≥ k − 4** and at her current cap (`canBreakthrough`,
  `progression.js:187-198`, gains a `reason: 'potential'`).
- `levelCap(u) = gates < 5 ? 10 + 10·gates : GATE_CAPS[gates]` with `GATE_CAPS = [.., 60, 63, 67, 72, 78, 85]` for
  gates 5–10. Because gate *k* needs P(k − 4), the gate cap is never above P3's Potential cap
  (`POTENTIAL_LEVEL_CAPS`, P3 §4.1): a P6 girl with gate 7 is capped at 67; a P2 girl stops after gate 6 (63).
- `breakthroughCost` (`progression.js:177-182`) reads 10 rows; rows 6–10 add `zenith` (`mat_<family>_zenith`) and
  `crown` (`crown_rainbow`) lines.
- **+2 % damage per gate continues** (`PER_GATE_DAMAGE`, `progression.js:23`). It is additive inside the level term
  (`progression.js:273`), so gates 6–10 are **×1.035** at L85 ★5 (computed: 1 + 1.512 + 0.20 + 0.25 = 2.962 against
  1 + 1.512 + 0.10 + 0.25 = 2.862). P3's K1 run adds it; fallback: gates past 5 add 0 %.
- `progression.js` is not co-op hashed (RS §5.4).

### B.2 Cost per gate (her own family; design)

| Gate | Cap | Needs | Mythic | Legendary | Zenith | Rainbow Crown | Coins |
|---|---:|---|---:|---:|---:|---:|---:|
| (5, today) | 60 | — | 8 | 2 | — | — | 250,000 (`progression.js:170`) |
| **6** | 63 | P2 | 8 | 2 | — | — | 150,000 |
| **7** | 67 | P3 | 10 | 3 | 1 | — | 200,000 |
| **8** | 72 | P4 | — | 4 | 2 | — | 300,000 |
| **9** | 78 | P5 | — | 5 | 3 | **1** | 450,000 |
| **10** | 85 | P6 | — | 6 | 4 | **1** | **800,000** |
| **6–10** | | | **18** | **20** | **10** | **2** | **1,900,000** |

- The scarce item climbs gate by gate: familiar mythic → legendary (today 0.07–0.30 a week per family, RS §2.6; Titan
  Trials make it common) → Zenith and the Rainbow Crown (Titan Trials only).
- Gate 10 (800k) is the biggest single price in the game (today's largest is ★5 at 400k, `progression.js:219`).
- Example (Kage, feather): "Gate 9 · Level cap 72 → 78 · 5 Celestial Pinion · 3 Zenith Plume · 1 Rainbow Crown ·
  450,000 coins".

### B.3 The Zenith tier (seven new family items)

Stored as `rarity: 'legendary'` with `tier: 'zenith'` (shown with the rainbow UR frame, `src/ui/rarity.js:32-40`). **Never
a sixth item rarity:** an older build deletes unknown rarities and `src/data/items.js:142-174` indexes books and gear
boxes by `ITEM_RARITY_ORDER` (GA R1). Seven explicit entries in `items.js`, category `material`, `family` set:

| Family (girls, RS §3) | Id | Name | Flavour |
|---|---|---|---|
| feather (Aoi, Kage, Shiro) | `mat_feather_zenith` | **Zenith Plume** | A feather from the very top of the sky, where the sun stands still. |
| blade (Rei, Kaede) | `mat_blade_zenith` | **Zenith Edge** | Steel folded a thousand times under the noon sun. |
| ember (Akane, Sango) | `mat_ember_zenith` | **Zenith Flame** | A flame that burns straight up and never flickers. |
| rime (Nami, Yuki) | `mat_rime_zenith` | **Zenith Frost** | Ice from the highest peak; it hums one clear note. |
| charm (Hikari, Umeko, Miko, Hotaru) | `mat_charm_zenith` | **Zenith Omamori** | Blessed at the shrine on the brightest day of the year. |
| rune (Luna, Midori, Raika) | `mat_rune_zenith` | **Zenith Sigil** | A glyph that can only be read in perfect light. |
| cog (Momo, Suzu, Chika) | `mat_cog_zenith` | **Zenith Cog** | A golden gear that turns all by itself. |

### B.4 The UR Crown: the Rainbow Crown

- **Rainbow Crown** `crown_rainbow` (category `crown`, rarity legendary, rainbow style): "Woven from the light of every
  titan. It opens level gates 9 and 10." **Rainbow Crown Shard** `crown_rainbow_shard` (category `crown`): **10 fuse
  into a crown automatically** with a fanfare. "UR Crown" is not used as a name because "UR" already means a ★5 SSR
  (`src/ui/rarity.js:32-40`) and rainbow gear (GA).
- **Sources (only the titans and their shelves):** Victory Chest shard 10 % (Hard) / 25 % (Nightmare) / 1 (Mayhem,
  +0.25 per rank); a **whole Rainbow Crown** at 1 % per Mayhem Victory (+0.25 % per rank, cap 3 %); first clears (Hard
  2, Nightmare 3, Mayhem a whole crown); Titan shelf 40 tokens ×1/week; Moonpearls 12 ×2/week; Together Chest 50 % (M2).
  **Never sold for gems.**
- **The crown binds (model):** a free player at Nightmare gets ≈ 3 chest + 1 shelf = **0.4 crowns a week** plus 20
  first-clear shards (8 at Hard, 12 at Nightmare); a team needs 2 per girl. The crown-shard bank falls to 1–5 around
  weeks 20–24, and a level-ready gate waits on a crown in 6 of the model's weeks (coins in 18). After the free team is
  done (week 30) shards bank again (118 by week 40), for the roster update's girls.

### B.5 Levels between gates (P3 kept) and Tome sources

- **P3 §4.3 unchanged:** each level above 60 = one Akashic Tome (30,000 EXP) + 12,000 coins; 25 Tomes + 300k coins for
  60 → 85. The gates are the doors; Tomes are the EXP. Nothing replaces the per-level cost.
- **Tome sources:** P3 §4.4's Library III Nightmare 20 %, Freeplay cache 2 a week, Bounty Exchange 2 a week **stay**;
  "duplicates past P6 pay Tomes" is **removed** (§A.3) and replaced by: Memento row 20 ×2/week; Titan shelf 30 tokens
  ×2/week; titan books (Normal 2 Academy Textbooks, Hard 1 Sage's Codex, Nightmare Akashic 20 %, Mayhem 30 %).
- EXP a week (model): P3's 455k − 98k of overflow Tomes + 72k titans (Nightmare) + 30k Memento (one Tome) + shelf
  Tomes only when tokens are left (usually none at Nightmare) ≈ **460k**, at least P3's pace (P3 §4.5); in the model a
  level-ready gate never waits on EXP.

### B.6 Craft Room (Backpack; owner answer 4)

A sheet on any family material (`src/systems/inventory.js` actions; no new item, nothing hashed):

| Action | Rate | Coins per result | Weekly cap |
|---|---|---:|---|
| Combine common → rare | 3 → 1 | 5,000 | — |
| Combine rare → Super Rare | 3 → 1 | 15,000 | — |
| Combine Super Rare → mythic | 3 → 1 | 40,000 | — |
| Combine mythic → legendary | 3 → 1 | 100,000 | 10 |
| Combine legendary → Zenith | 3 → 1 | 150,000 | **3** |
| Swap family (same tier) | 2 → 1 | half the combine fee into that tier (rare 2,500 … legendary 50,000, Zenith 75,000; common 1,000) | legendary 5, Zenith 2 |
| Rainbow Crown Shards, Kindred Shards (SSR) | 10 → 1 | free, automatic | — |

- Fees keep the Craft Room from beating the Mall: 3 Mall commons (3 × 1,000) + 5,000 = 8,000, the Mall's price for one
  rare (`src/data/shop.js:26-27`).
- The Zenith cap keeps Zenith a chase: without it, a Mayhem player's spare legendary would mint several extra Zenith a
  week.
- It does not apply to crowns, books, fragments or Essence.

### B.7 One girl, one team (computed from §B.2 + P3 §4.3)

| Bill | Coins | Items |
|---|---:|---|
| Today: 1 → 60 + gates 1–5 + ★5 (RS §1.4) | 1,622,652 | 62 family mats, 7 crowns, 190 fragments |
| Potential P1 → P6 (§A.2) | 37k / 95k / 240k | 5 Essence |
| Gates 6–10 | 1,900,000 | 18 mythic, 20 legendary, 10 Zenith, 2 Rainbow Crowns |
| Levels 60 → 85 (P3) | 300,000 | 25 Akashic Tomes |
| **One girl 60 → 85** | **2,200,000** | |
| A free team of 8 to L85 | 17.6M | 160 legendary, 80 Zenith, 16 crowns |

Pace: §E.2.

---------------------------------------------------------------------------------------------------

## C. Titan Trials (the weekly bosses)

### C.1 The four titans

Defs, GLB models and phases exist and sit in the co-op hash already (`src/data/enemies.js:822,835,848,860`); players meet
them today only past Freeplay wave 210 (RS §5.2). Weakness = the live type chart (`src/data/types.js:25-31`):

| Titan (def) | Class · armor | Weak to | Resists | Families (tap one as target) | Arena (`src/data/maps.js`) | Girls who shine |
|---|---|---|---|---|---|---|
| **Foundry Titan** (`fp_foundry_titan`, 20k, crystal + splitter → 2 Iron Colossi) | heavy · 8 | **blast ×1.5**, mystic ×1.25 | slash ×0.6, pierce ×0.75 | **cog** · blade | Colossus Forge `arena_forge` (`:1357`) | Akane, Sango, Suzu (blast); Luna, Raika, Midori (mystic) |
| **Gloom Regent** (`fp_gloom_regent`, 18k, regen + summoner + splitter → 2 Grave Lychs) | spectral · 4 | **holy ×2.0** | blast, pierce, slash ×0.5 | **rune** · charm | Lych Crypt `arena_crypt` (`:1331`) | Hotaru (+ her P4 vs ghosts, P3 §5.15), Hikari, Miko |
| **Hyakki Daimyo** (`fp_hyakki_daimyo`, 16k, field + splitter → 2 Oni Champions + brood) | warded · 5 | holy ×1.25 | mystic ×0.5 | **charm** · rime | Sakura Colosseum `arena_colosseum` (`:1411`) | physical girls ×1.0, holy girls ×1.25 |
| **Eclipse Wyrm** (`fp_eclipse_wyrm`, 16k, ward + splitter → Ashwing Matriarch + brood) | scaled · 6 | **pierce ×1.5**, mystic ×1.25 | slash ×0.75, holy ×0.75 | **feather** · ember | Ashwing Summit `arena_summit` (`:1383`) | Shiro, Kage, Aoi, Chika, Momo (pierce) |

- All seven families are covered; charm (four girls) appears twice; **rime gets its first boss source** (RS §2.2).
- **Target family:** each card has two family chips; the tapped one is the "target" in every table below. Default:
  the family of the girl whose next gate is nearest to affordable (auto-target, PCh suggestion 3). Stored
  `ttgt:<titan>`.
- The free Build A carries (Shiro, Kage, Aoi feather; Sango ember; P3 §8.3) all farm on the pierce-weak Wyrm; the
  holy girls farm their own charm on the Daimyo and the Regent's rune/charm.
- **Titan of the Week** (rotates Foundry → Regent → Daimyo → Wyrm by game week): +50 % Assault Tokens, a glowing card,
  the lobby slide headline and (M2) the clan board's titan.

### C.2 The battle ("Build your best board, then hold off the titan.")

- **Format (design):** 7 escort waves, the titan on wave 8. **Start cash: Normal 20,000; Hard and up 300,000** (a
  full board, so the girls' levels, Potential and gear decide it, which is what the measured capacities assume, P3
  §8.4). Lives 100; Normal difficulty rules (`DIFFICULTIES` is hashed, `src/data/types.js:179-185`, so tiers are not
  difficulties). Knob: start cash (PS risk 2: economy girls matter less here).
- **No sim change and no hashed file (M1, solo):** `src/data/titans.js` (new) builds `titanStage(titanId, tier, rank)`
  and an `enemies` override map; the battle controller passes them as `data: { stage, enemies }` when `req.titan` is set,
  instead of `STAGE_MAP[req.stageId]` (`src/ui/battle/controller.js:90`). The sim already accepts both
  (`createDataSource(stageId, overrides)`, `src/sim/data.js:52-68`; `Sim` constructor, `src/sim/Sim.js:49-50`).
  - **HP:** the override map clones the titan def and her **splitter children** with an `hp` chosen so the *spawned*
    HP hits §C.3's pool. The sim multiplies every spawn, the titan included, by `stage.hpScale × diff.hpMul × waveHpMul`
    (`src/sim/Sim.js:280-281`, `src/sim/enemies.js:58`), where `waveHpMul` is `waveHpRamp(stage, wave)` (`src/sim/waves.js:81`)
    times the spawn-cap factor when a wave is over `MAX_SPAWNS_PER_WAVE` (`:128-135`); splitter children get the
    parent's `hpMul × inherit` (`src/sim/enemies.js:506`). So `titans.js` sets
    **`hp = pool / ((1 + count·inherit) · hpScale · DIFFICULTIES.normal.hpMul · waveHpRamp(stage, 8))`** on the titan and
    the same `hp` on her splitter children (they land at `inherit` × her HP), and keeps wave 8 under the spawn cap so
    that factor is 1. Escorts keep a chapter-8 size through the stage `hpScale` (2 / 4 / 6 / 8 by tier; tuned in W1).
    Pool = titan × (1 + count × inherit) = Foundry 1.7, Regent 1.7, Daimyo 2.0, Wyrm 1.5. A test builds the real `Sim`
    from `titanStage()` and checks the spawned titan's and children's maxHp (§H.2); a data-only check would pass while
    the runtime HP is 2–8 × too big.
  - **Escort pools** exclude every child, brood and summon id of that titan (no override leaks onto an escort).
  - `kind: 'boss'`, `id: 'titan:<titanId>:<tier>'`; never battle-savable (like Freeplay and the clan boss); quitting
    uses no key.
- **Damage is read outside the sim** after the battle: the titan's uid and every enemy whose `parentUid` chain leads
  to her through `splitter` (`src/sim/Sim.js:295`): HP removed ÷ pool HP. Summons and brood do not count. The clan
  boss already reads sim stats after the battle (`src/ui/battle/controller.js:1039`).
- **Victory** = the titan and every splitter child fell. **If she leaks**, the run ends as today's loss, and the result
  screen reads "The Gloom Regent got away! You reached Silver." (never the defeat screen).
- **Bestiary guard:** titan-trial kills write `missions.counters['tkill:<titan>']`, not `bestiary[id].kills`, so
  "Starlight Vigil" (`src/data/achievements.js:165`, `enemySetKilled`, `src/systems/achievementMetrics.js:236`) still
  needs Freeplay. Titans still become `seen`.
- **Practice:** unlimited runs on any unlocked tier, no keys, no rewards (the Sandbox rule, `src/systems/rewards.js:123`).
- **Tier names on screen:** the results header prints `diff.name` (`src/ui/battle/results.js:266`), which is always
  "Normal" here; titan results and the hub print the **tier** ("Gloom Regent — Nightmare").
- **Mission events:** a titan Victory fires `battleWin` and `bossKill` (Crown Hunter); a **Hard-or-higher** titan Victory
  also fires `battleWinHard` (Elite Training, `src/data/missions.js:18`); a sweep fires `sweep` (Patrol Duty and Elite
  Training count sweeps, `:14,18`). Bronze–Gold results fire only `kill`.

### C.3 Tiers, HP and who wins (model, `tools/titanhp.txt`)

**Unlocks:** Normal after **3-5** (Awakening opens at 3-2, `src/data/story/lessons.js:174`, so early players have a
fragment source); Hard after **6-5** + a Normal Victory on that titan; Nightmare after **8-5** + a Hard Victory;
Mayhem after a Nightmare Victory; **Mayhem +n** after +(n − 1). Co-op HP ×1.6 (`src/data/coop.js:8`).

**HP rule (design):** pool HP = k × √(capacity vs her class × neutral capacity) of the tier's profile (P3 §8.4, 4-5
solo, Build A): **Hard** k 0.6 × path-cap P1; **Nightmare** 0.75 × F2P-steady; **Mayhem** 0.88 × F2P-late; **+n** ×
1.3ⁿ. The square root makes the weakness matter (a pierce team is short on the spectral Regent) without walling a free
team on Hard. **Normal** is an estimate (no measured mid-game capacity): chapter 4 reaches Silver, 5-5 wins (gate W2).

| Titan (pool HP, solo) | Normal | Hard | Nightmare | Mayhem | Mayhem +3 |
|---|---:|---:|---:|---:|---:|
| Foundry Titan | 0.8M | 18M | 48M | 100M | 220M |
| Gloom Regent | 0.6M | 14M | 38M | 82M | 180M |
| Hyakki Daimyo | 0.9M | 20M | 54M | 115M | 253M |
| Eclipse Wyrm | 1.2M | 25M | 66M | 135M | 297M |

| Profile (P3 §8.3) | Foundry | Regent | Daimyo | Wyrm |
|---|---|---|---|---|
| path-cap P1 (L60, gold +10) | Hard ✓ (×1.58), NM Silver | Hard ✓ (×1.23), NM Bronze | Hard ✓, NM Silver | Hard ✓ (×2.0), NM Gold |
| F2P-steady (month 3, carries L75) | **NM ✓** (×1.25) | NM **Gold** (×0.95) — bring holy | NM ✓ (×1.33) | NM ✓ (×1.62), Mayhem Gold |
| F2P-late (month 6, L85, best gold)¹ | **Mayhem ✓** (×1.02) | Mayhem Gold (×0.80) | Mayhem ✓ (×1.14) | Mayhem **+1** |
| Whale A (all P6, L85, UR, Build A) = **free month 7+** once GA's UR set is complete² | Mayhem +2 | Mayhem +1 | Mayhem +3 | Mayhem +3 |
| Whale W (SSR-carried, holy) | Mayhem +3 | Mayhem **+3** | Mayhem +3 | Mayhem **+4** |

¹ GA alone puts ≈ 17 UR pieces on an active free account by model week 26 (GA §6.5: GA week 16, counted from 8-5), so a
real month-6 board sits between this row and Whale A; gate K2 measures it. ² GA's 24 pieces land ≈ GA week 20 ≈ model
week 30 (titans add ≈ 1.7 boxes by week 26, §C.8). From then on the free player's tier is Whale A's (Mayhem +1 … +3),
and the spender's lasting titan edge is SSR Potential (Whale W, one more rank on the Regent and the Wyrm) and time
(§E.5).

These sit far below the Freeplay summit (Gloom Regent at wave 210 = 239M, Eclipse Wyrm at 250 = 28.9B, RS §5.2), so
path-cap's rule 5 and GA R22 are untouched. Roster depth shows up where the owner wanted it: a holy core takes the
Regent a tier higher, and a whale's best rank follows the weakness their roster hits.

### C.4 Keys, sweeps, reset, energy

- **12 Trial Keys a week**, spent on any titan and tier; **unused keys carry over up to 6** (18 stored at most), so a
  missed week loses little. Not an item: counters `tk:left` and `tk:week` (re-filled to `12 + min(6, left)` on the
  first load of a new game week).
- **A key is used only when the result is applied and reached Bronze or better.** Under 25 %: "This one didn't count —
  try again!" and the key stays.
- **Sweep** (after a **solo** Victory on that tier): one key, pays a Victory at the best tier won **solo** (damage table
  + Victory Chest). `tbest:<titan>` counts solo Victories only; a co-op Victory never raises it (§C.11).
- **Reset:** the shop's `weekKey` today (`src/core/util.js:32`); Sunday 7 PM Central with EN.
- **No energy:** a titan run is `free` in EN's `planRun` like the clan boss (EN §3.4, A8); keys are the cap.
- **No gem keys** (a kids' game; keys stay the free player's equalizer).

### C.5 Damage notches and the Victory Chest

| Result | Pays | Victory Chest | Key |
|---|---|---|---|
| under 25 % | nothing | — | kept |
| **Bronze** ≥ 25 % | 35 % of the damage table | — | used |
| **Silver** ≥ 50 % | 60 % | — | used |
| **Gold** ≥ 75 % | 85 % | — | used |
| **Victory** | 100 % | **yes** — the guaranteed bonus for beating her | used |

### C.6 Drop tables (design; tables in `src/systems/titanRewards.js`, not hashed; "target" = the tapped family, "other" = her second)

Normal opens at 3-5 and Hard at 6-5, so they pay what those chapters can use: today mythic family items first drop on
chapter-6 Hard at 3–7 % and legendary only on the 8-5 row's Nightmare at 2 % (RS §2.2, `src/data/stages.js:57-87`).
**Normal pays no mythic or legendary; Hard pays 1 mythic a Victory and legendary at 25 %.** Gate CP1 (§H.1) runs the
campaign census with titan-fed chapter-4 and chapter-6 profiles.

**Damage table** (× the notch share):

| | Normal | Hard | Nightmare | Mayhem | +n per rank |
|---|---:|---:|---:|---:|---:|
| Coins | 8,000 | 20,000 | 60,000 | 80,000 | +5,000 |
| Star Fragments | 5 | 5 | 5 | 6 | — |
| Assault Tokens (×1.5 Titan of the Week) | 10 | 15 | 20 | 25 | +2 |
| Target family | 3 Super Rare + 2 rare | 1 mythic + 2 Super Rare | 1 mythic + 0.2 legendary (20 %) | 1 mythic + 0.5 legendary (50 %) | +0.05 legendary |
| Other family | 2 rare | 2 Super Rare | 0.5 mythic (50 %) | 0.3 legendary (30 %) | — |
| Books | 2 Academy Textbooks | 1 Sage's Codex | Akashic Tome 20 % | Akashic Tome 30 % | — |

**Victory Chest** (Victory only):

| | Normal | Hard | Nightmare | Mayhem | +n per rank (cap) |
|---|---:|---:|---:|---:|---:|
| Target family | 1 Super Rare | legendary 25 % | legendary 70 % | 1 legendary | — |
| Zenith (target) | — | — | 20 % | 50 % | +5 % (90 %) |
| Rainbow Crown Shard | — | 10 % | 25 % | 1 | +0.25 |
| **Whole Rainbow Crown** | — | — | — | 1 % | +0.25 % (3 %) |
| Kindred Shard (SSR) | — | — | — | 4 % | — |
| **One gear box** — Rainbow (UR) | — | — | **0.5 %** (no Meter) | **4 %** (Meter) | +0.25 % (6 %) |
| — Celestial (legendary, "legendary box") | — | 3 % | 25 % | 45 % | — |
| — Radiant (mythic, the owner's "SSR box") | — | 25 % | 59.5 % | 51 % | the rest |
| — Ornate (Super Rare) | 30 % | 72 % | 15 % | — | — |
| — Sturdy (rare) | 70 % | — | — | — | — |

- Box names: `src/data/items.js:110-116`; boxes from battle open at once (`src/systems/rewards.js:45-47`) **except the
  Rainbow Gear Box**, which goes to the Backpack so the player can choose its slot (§C.8).
- **Rolls:** each line rolls on its own, **outside the sim, from a per-attempt seed**
  `hashString('titan:<titan>:<tier>:<rank>:<sim seed>:<tatt>')`, where `tatt` (a counter) rises when the key is spent;
  a sweep uses the same counter. `battleDropSeed` (`src/systems/rewards.js:98`) only seeds saved runs, and unsaved runs
  use `Date.now()` (`src/ui/battle/results.js:167`); titan runs are never saved, so they get their own seed. Once-only
  grants (first clears, Meter, keys) are guarded by their counters (§F.1).
- The owner's "low chance UR, medium chance legendary or SSR box" maps onto one roll: Rainbow 0.5–6 %, Celestial
  25–45 %, Radiant 51–60 % from Nightmare up.

### C.7 A week of titans (12 keys; model, `synth.txt`; titans only, before the shops)

| Profile | Coins | Star Fragments | Assault Tokens | Mythic | Legendary | Zenith | Crown Shards | Whole Crowns | SSR Kindred Shards | Radiant | Celestial | Rainbow (with Meter) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Free month 1 (Normal: 6 Victory + 6 Silver) | 77k | 48 | 96 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Free month 2 (Hard: 12 Victory) | 240k | 60 | 180 | 12 | 3.0 | 0 | 1.2 | 0 | 0 | 3.0 | 0.36 | 0 |
| Free months 3–5 (Nightmare: 12 Victory) | 720k | 60 | 240 | 18 | 10.8 | 2.4 | 3.0 | 0 | 0 | 7.1 | 3.0 | 0.06 |
| Free month 6 (Mayhem: 8 Victory + 4 Gold) | 912k | 68 | 285 | 11.4 | 16.1 | 4.0 | 8.0 | 0.08 | 0.32 | 4.1 | 3.6 | 0.40 |
| Spender (Mayhem +2: 12 Victory) | 1,080k | 72 | 348 | 12 | 22.8 | 7.2 | 18 | 0.18 | 0.48 | 6.1 | 5.4 | 0.64 |

Today, for comparison (RS §2.6): legendary family materials ≈ 1.2 a week in all, Celestial boxes 0.44 + 1 from the
Bounty Exchange, Radiant 2.45 + 1, coins ≈ 395k. The month-6 row is a floor: once GA's UR set is complete (≈ week 30) a
free player wins Mayhem +1 … +3 like Whale A (§C.3) and earns close to the spender row.

### C.8 The Rainbow Gear Box and the Rainbow Meter

- **`gearbox_rainbow`** (category `gearbox`, a standalone entry outside the five-rarity loop at
  `src/data/items.js:167-174`). **Open → choose charm, ribbon or shoes → one Legendary piece already UR** (`rarity:
  'legendary'`, `ur: 1`, GA R1), **+0, four substats**. It enhances to +12 at GA's tier-6 prices (GA R12: (800 + 400·L)
  × 6, 216,000 coins for +0 → +12, computed) and takes two Needle stitches like any UR piece (GA R7). Salvage: Legendary
  payout + 1 Rainbow Seed (GA R11's rule, so a box-born UR can be re-bloomed elsewhere).
- **Where it drops:** Mayhem Victory Chests 4 % (+0.25 % a rank, cap 6 %) and Nightmare Victory Chests 0.5 %. **Never
  from first clears**, never for gems.
- **Only the slot picker opens it.** `openGearBox` (`src/systems/gear.js:161-171`) opens any `gearbox` item as a plain
  roll of its rarity, the Backpack lists every gearbox with Open / ×10 / Open all (`src/ui/screens/backpack.js:261-268`),
  and battle drops of category `gearbox` auto-open (`src/systems/rewards.js:45-47`). So in M1 `openGearBox` refuses
  `gearbox_rainbow` (`error: 'pickSlot'`), the Backpack routes it to the slot picker, "Open all" skips it, and titan
  rewards grant it as an item (never through `rollStageDrops`). The **M0 reader** lists the box with Open disabled
  ("Open it in the latest version"), so a stale tab cannot turn it into an ordinary Legendary piece. Tests in §H.2.
- **Box-born UR survives older builds:** an older `cleanGear` is an allowlist that drops `ur` (`src/systems/save.js:197-221`),
  and GA's `gur:` mirror restores only pieces at +10 or more (GA §8.3, on purpose). So opening the box writes
  **`gbx:<uid>`** = slot index × 100 + main-stat index + 1 in `missions.counters`; load restores `ur: 1` when a piece with
  that uid, slot and main stat is present at any level; salvage writes 0 (§K item 10).
- **Overrides GA R20** ("UR never drops; no UR gear box") at the owner's request. **Needs GA's R1 reader on players'
  devices first** (older builds delete unknown gear fields).
- **If GA's writer (R2) is not live when M1 ships:** the Rainbow share of every roll goes to Celestial, the Meter is
  hidden, and each Rainbow Gear Box earned (Meter) is recorded in `rbx:owed` and paid when GA lands.
- **Rainbow Meter** (owner answer 1): "Rainbow Meter 23 / 40" on every titan card. Each **Mayhem** Victory Chest without a
  Rainbow box adds 1; **the 40th is a Rainbow Gear Box**; any Rainbow box resets it. Counter `pity:rain` (beside GA's
  `pity:cel`). Expected Mayhem chests per box (closed form `(1 − (1 − p)^40) / p`, model): Mayhem 20, +2 18.7, cap 15.3
  → **one every ≈ 2.5 weeks for a free Mayhem player (8 Victories), ≈ 1.6 weeks for a spender**. The hub shows the
  Meter from the first Mayhem unlock ("Rainbow Meter opens at Mayhem").
- **GA pace:** titans add ≈ 0.06 boxes a week at Nightmare and ≈ 0.4 at Mayhem: **≈ 1.7 by week 26** for a free player
  against GA's ≈ 17 pieces from Seeds by then (GA §6.5), so free UR stays on GA's pace (24 pieces ≈ GA week 20 ≈ model
  week 30). A spender gets ≈ 11.6 by week 26. GA R22 (UR_LATE never beats the wave-250 Wyrm) is about the endpoint and
  still holds. Knob: Meter 40 → 60.

### C.9 First clears (once per titan per tier; on a **solo** Victory; counter `tfc:<titan>:<tier>`)

| Tier | Gems | Items |
|---|---:|---|
| Normal | 100 | 2 Kindred Essence (R), 20 Star Fragments |
| Hard | 150 | 1 Kindred Essence (SR), 2 Rainbow Crown Shards, 1 Radiant Gear Box |
| Nightmare | 250 | 3 Rainbow Crown Shards, 2 Zenith (target family), 1 Celestial Gear Box |
| Mayhem | 400 | **1 Rainbow Crown**, 2 Zenith (target family), 1 Celestial Gear Box |
| Mayhem +n (each new rank) | — | 1 Rainbow Crown Shard + 10 Assault Tokens |

**3,600 gems once** over the four titans (30 recruits; today's one-time total is 32,220, ECON §3). A co-op Victory pays
**no** first clear (§C.11). The Mayhem first clear pays no Rainbow Gear Box and no SSR Kindred: those would pull free UR
and free SSR Potential forward (§C.8, §A.4); the whole Rainbow Crown is the jackpot. Titan achievement rows (M3) pay
items only: ACH's new-row gem cap of 7,000 is already 6,980 with GA's wave (GA §6.3).

### C.10 The weekly stores (owner answers 2 and 3)

**Boss Exchange → new "Titan shelf"** (Assault Tokens, `src/data/shop.js:44-52`; weekly; "choose family" rows share
one group stock; rows with no girl to use them on are hidden, §A.4):

| Row | Tokens | Stock |
|---|---:|---:|
| Rainbow Crown Shard | 40 | 1 a week |
| Zenith material (choose family) | 60 | 1 a week |
| Legendary material (choose family) | 25 | 4 a week |
| Mythic material (choose family) | 8 | 6 a week |
| Akashic Tome | 30 | 2 a week |
| Kindred Essence (R) | 15 | 2 a week |
| Kindred Essence (SR) | 60 | 1 a week |
| Kindred Shard (SSR) | 50 | **1 every other game week** (`everyOtherWeek: true`; "Back next week" on odd weeks); opens with the first Nightmare titan clear |
| Celestial Gear Box | 120 | 1 a week |

- Full shelf ≈ 543 tokens a week (the SSR row averaged) + today's rows 661 (computed from `shop.js:44-52`); income ≈ 108
  today (RS §2.6) + 180 / 240 / 285 from titans (Hard / Nightmare / Mayhem). The model spends tokens once, in order:
  the Boss ticket, both fragment packs, then the shelf (§A.8). At Nightmare (≈ 348 a week) that leaves ≈ 108 after the
  Crown Shard and Zenith for legendary, the SSR shard or Tomes: players **buy what they are missing**, not everything.

**Gem Shop → "Titan shelf"** (spenders; weekly):

| Row | Gems | Stock / week |
|---|---:|---:|
| Zenith material (choose family) | 250 | 2 |
| Kindred Shard (SSR) | 1,500 | 1 |

At most **2,000 gems a week** (≈ 17 recruits) if bought out. Gems never buy Rainbow Crowns or their shards, legendary
materials, Rainbow Gear Boxes, keys, Assault Tokens, Mementos or Moonpearls: the Rainbow Crown stays the thing every
player earns from the titans (§B.4).

**Weekly reset safety.** An older build's `refreshShop` clears only the offers it knows when the week changes, then sets
`shop.week` (`src/systems/shop.js:21-23`), and the sanitizer keeps unknown `bought` keys (`src/systems/save.js:448`). A
stale tab that opens first in a new week would leave every new row sold out for the week. So **M0 ships every new offer
id** (`resets: 'weekly'`) and the `group` keys' reset, and **M1 keeps its own marker `shopwk:asc`** (the game week as a
number in `missions.counters`): when it differs from the current week, M1 clears its own offers and group keys, then
sets it. S1 covers it.

### C.11 Co-op titans, the Together Chest and the clan board (M2)

- **Co-op titans:** a room picks a titan, tier and rank the **host has unlocked solo**; a guest may join a tier at most
  **one step above their own solo best** (steps: Normal, Hard, Nightmare, Mayhem, +1, +2 …). HP ×1.6
  (`src/data/coop.js:8,66`); two boards are ×1.7–1.9 a solo board (P3 §8.4), so a pair is slightly ahead. Each player
  spends **one of their own keys** and rolls their **own** loot on their own save from the shared damage notch.
- **What a co-op run pays:** the damage table and, on a Victory, that tier's Victory Chest and the Together Chest.
  **Never** a first clear, a tier unlock or a higher sweep tier (`tbest` is solo only, §C.4) — the existing co-op rule
  ("No medals, first-clear gems or unlocks — those stay a solo achievement", `src/online/coop/rewards.js:1-3`). Without
  it a spender could carry a friend through every first clear (3,600 gems, 4 crowns, 8 Zenith, boxes) and leave them a
  permanent Mayhem +3 sweep; with it, a carry is worth one tier step of loot for the runs played together.
  `tests/online/coopTitan.test.js` asserts all three, and refuses a guest above solo best + 1.
- **Together Chest** (each player, each co-op Victory, at most 3 a week, `missions.weekly['tk:tog']`): 10 Assault
  Tokens, 5 Star Fragments, 50 % a Rainbow Crown Shard (Hard+).
- **Clan titan board:** each member's best damage on the Titan of the Week, summed for the clan and ranked inside it.
  New table + RPC `submit_titan_best(week, titan, tier, rank, damage, seconds)` beside `submit_boss_damage`
  (`supabase/migrations/20261008000000_online.sql:588-730`): the server clamps damage to the tier's pool HP (×1.6 in
  co-op) and requires ≥ 10 s. Rewards from a client table after the server returns the rank (the clan boss pattern,
  `src/online/clanRules.js:267-286`): #1 30 tokens + the week's "Titan Ace" ribbon line, #2 20, #3 10, everyone with a
  Bronze 5. Owner-run SQL migration.
- The existing clan weekly boss stays as it is.

---------------------------------------------------------------------------------------------------

## D. Screens and moments (phone 844×390 and PC 1280×720, no horizontal scroll)

### D.1 Recruit results

A duplicate card says **"Kage's Essence +1 · P5 ready!"** where it said "+10" fragments
(`src/ui/screens/recruit.js:248,374,421`); a spare says **"Spare → +6 Mementos · +1 Moonpearl · +1 point"**; R spares show
the ⅕ pip meter. The duplicate's letter turns into a glowing crystal that flies into her card.

### D.2 Her page (`src/ui/screens/student.js`)

- **Potential panel** (P3's six-node track, P3 §11): "Kage's Essence ×1" and the button **Raise to P5 · 1 Essence +
  25,000 coins** (glows when affordable). With no Essence of her own and a fitting Kindred: "Use Kindred Essence (SR)
  (2)". At P6: "Full Potential · spare copies become Mementos and Moonpearls".
- **Gate card** (today's breakthrough card, `student.js:474-485`, from gate 6): "**Gate 9 · Level cap 72 → 78**" with
  have/need per item ("Zenith Plume 3/3", "Rainbow Crown 0/1"), coins, and **Where to get** per missing line: the titan
  that drops her family (opens the hub with that titan and family pre-picked), the Titan shelf row, the Craft Room. A
  locked gate reads "Opens at P5 (1 more Essence)". Level block: "Cap 72 · P4 · max 85" (P3 §4.9).

### D.3 Titan Trials hub (lobby tile next to Total Assault; route `#/titans`)

```
┌ TITAN TRIALS   Keys 9/12 (+2 saved) · resets Sun 7 PM · Assault Tokens 214 ─────────────┐
│ [Foundry Titan] [Gloom Regent ★ TITAN OF THE WEEK] [Hyakki Daimyo] [Eclipse Wyrm]        │
│  ┌ 3D titan (assault.js card) ┐  Spectral · Weak: Holy ×2 · Resists blast/pierce/slash ×½ │
│  └────────────────────────────┘  Your holy girls: Hikari P3 · Miko P6 · Hotaru P2         │
│  Target: (●) Rune  ( ) Charm      Rainbow Meter 23/40 (Mayhem wins)                        │
│  Normal ✓  Hard ✓  NIGHTMARE  Mayhem 🔒       HP 38M  ▕██▏25%▕██▏50%▕██▏75%▕█▏  best: Gold │
│  Victory Chest: Legendary 70% · Zenith 20% · Crown Shard 25% · Rainbow box 0.5%           │
│  [ Fight ]  [ Sweep ]  [ Practice ]  [ Co-op (M2) ]       First clear: 250 gems + …       │
│  Tabs: Titans · Titan shelf · Board (M2)                                                 │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

Built from the Total Assault screen (`src/ui/screens/assault.js`: 3D boss card, drop grid, sweeps). The lobby's
"Weekly boss · Boss Raid" slide (`src/ui/screens/lobby.js:441`) keeps pointing at Total Assault; the new tile reads
"Titan Trials · 4 titans this week".

### D.4 Moments

- **Notch chimes:** three chest icons sit on the titan's HP bar; passing one bursts it with a chime and a "Silver!"
  banner (the battle feed's banner).
- **Victory Chest** stamps down on the result screen; the gear box inside shakes once per rarity step before it opens.
- **Rainbow Gear Box:** the screen dims, a rainbow pillar hits the chest, the box glows through seven colours; in the
  Backpack, "Open" → pick a slot → the piece appears with the UR rainbow label (`src/ui/rarity.js:32-40`, GA's look).
  The Meter resets with a sparkle.
- **Rainbow Crown forged:** the tenth shard flies in, ten pieces circle and click into a crown: "A Rainbow Crown! Gate 9
  or 10 can open." A **whole crown drop** at Mayhem gets the biggest moment (bell, gold → rainbow shimmer).
- **Gate 10:** a 2-second moment like "Ascended to UR" (`student.js:536-563`): "Level cap 85 · Full Potential".

### D.5 Mall and Backpack

Mall: Boss Exchange gains the "Titan shelf" header; new **Memento Exchange** tab (two wallets, two sections); Gem Shop
gains a "Titan shelf". Backpack: the Awakening tab's text becomes "Crowns, Star Fragments and Essence"
(`src/data/items.js:20`) and holds Kindred items and crown shards; the material sheet gets a **Craft Room** button
(always the full label, never "Workshop", which already names the Workshop Yard bounty, `src/data/stages.js:795`) with
**Combine** and **Swap** and a live price. The Rainbow Gear Box opens only through its slot picker (§C.8).

---------------------------------------------------------------------------------------------------

## E. Economy check (model unless marked)

### E.1 Assumptions (`synth.mjs` v2)

Active free player: base ≈ 395k coins a week (RS §2.6), of which 300k a week go to other sinks (gear, awakening, Potential
steps, 1 → 60 for others); titans: Normal weeks 1–4 (Silver, then Victory), Hard weeks 5–9, Nightmare from week 10, Mayhem
once three carries are L85; 12 keys on the titan that drops the carries' families. Carries (Shiro, Kage, Aoi, Sango) reach
L60 gate 5 in week 9 (P3's late-game profile), all R/SR at P6 by ≈ day 60 (P2R §4.4). First clears are counted (Hard
week 5, three Nightmare clears week 10 and the Regent once the carries are L75, three Mayhem clears when Mayhem opens).
**Each currency is spent once:** tokens (≈ 30 a week before Total Assault, an estimate; 108.5 after, RS §2.6) → Boss
ticket → both fragment packs → Titan shelf (Crown Shard, Zenith, SSR shard on its weeks, legendary ×4, Tome ×2) as far
as they go; Mementos (60 pouch, ≈ 30 a week from R spares, 52.5 from week 9) → two fragment packs → one Tome → a ticket
when 60 are left; Moonpearls bank for a Chosen SSR Essence. **Spender:** gem coins 630k a week (`src/data/shop.js:32`) +
gem Zenith ×2; tier tied to capacity: Hard weeks 1–2, Nightmare 3–8, Mayhem +0 weeks 9–14, Mayhem +2 after (Whale A
reaches +1 … +3 only at L85 with UR, §C.3); Mementos → 8 fragment packs, 2 Tomes; Moonpearls → 2 Crown Shards.

### E.2 Timeline (the pacing constraint is P3 §8.3: carries L75 at month 3, L85 at month 6)

| Player | 4 carries L75 | first L85 | 4 carries L85 | 8 girls L85 | all 19 L85 |
|---|---|---|---|---|---|
| Free, active | **week 16** | week 23 | **week 24** | **week 30** | — (SSRs stop at their P cap) |
| Free, casual coin farming (other sinks 350k) | week 17 | week 18 | week 25 | week 31 | — |
| Spender | week 10 | week 12 | week 13 | **week 15** (9 girls) | **week 28** |

- Free carries hit P3's F2P-steady (L75) at ≈ month 3.7 and F2P-late (L85) at ≈ month 5.5, so P3 §8.5's month-3 and
  month-6 rows apply on time; whether the month-6 board (with GA's ≈ 17 UR pieces) still falls inside P3's 195–209 band
  is gate K2's question, not an assumption (§C.3 note 1). Wave 250 stays out of reach (GA R22).
- **What binds (model):** of the weeks a level-ready gate waited, **coins** bound 18 and **Rainbow Crowns** 6 (the shard
  bank falls to 1–5 around weeks 20–24); EXP, Zenith (bank ≈ 9–11) and mythic never bound. Legendary and mythic still
  pile up (≈ 130 / 354 by week 24), which makes gates 1–5 and the Craft Room easy (knob in §E.6). Knob if carries reach
  L85 before week 21: gate coins first (gate 10 800k → 1M), never the Essence rule.
- The casual player's "first L85" comes earlier only because the model's greedy order spends differently; their four
  carries still finish a week later.

### E.3 Star Fragments, spares, pulls and the shop

- Fragments a week: §A.8 (free ≈ 95 → 143 by phase vs ≈ 88–100 today; spender 206 vs 266 today, 78 %).
- Spares (late free): 52.5 Mementos, 3.7 Moonpearls, +6.7 recruit points a week; spender (everyone P6, 56.7 recruits)
  155 / 22.5 / +25.7 (model).
- **Free SSR income: +6.9 % (spark); at most +13.2 % (spark + every Memento and Moonpearl on tickets)**; +30 recruits
  once from first-clear gems (§A.3, §C.9).
- Shop return: ≤ 4.6 % (Mementos → ticket) + ≤ 2.6 % (Moonpearls → 10× ticket) of the recruits that fed them; weekly
  stock caps a whale at 11 recruits a week (computed, §A.5).
- SSR Kindred: free ≈ 1 step by week 26; spender ≤ 0.4 steps a week (§A.4).

### E.4 Coins: "a lot of money", sized

| Sink | Per girl | Free team of 8 |
|---|---:|---:|
| Gates 6–10 | 1.9M | 15.2M |
| Levels 60 → 85 (P3) | 0.3M | 2.4M |
| Potential P1 → P6 | 37k / 95k / 240k | ≈ 1.1M (R/SR) |
| Craft Room fees (typical) | — | ≈ 1–2M |
| Rainbow box UR to +12 (GA R12) | 216k a piece | — |

- Free coin income goes from ≈ 395k a week to **≈ 1.1M (Nightmare: 395k + 720k titans)** and **≈ 1.3M (Mayhem: 395k +
  912k)**. The titans' coins are the gate budget: they already pay more than all of today's late-game battle coins
  (294k, RS §2.6), so Market Canal matters less once a player reaches Nightmare.
- The sinks take it until the free team of 8 is done (week 30). After that the bank grows ≈ 1M a week (3.0M week 32 →
  11.1M week 40, `synth.txt`). **The next sink is the roster update's 11 girls:** each needs today's 1 → 60 + ★5 bill
  (1.62M, RS §1.4) and, once her Potential allows, up to 2.2M for gates 6–10 and levels → up to **≈ 42M** for all 11,
  about 40 weeks of that surplus. Fallback knob if the update slips: halve the damage-table coins for a player whose
  owned R/SR girls are all at gate 10.

### E.5 Where the spender edge lives

| Edge | Free player | Spender |
|---|---|---|
| SSR Potential | P2–P3 for months (P2R §4.4) + ≈ 1 Kindred step on a favourite by month 6 | P6 on every SSR + ≤ 0.4 Kindred / Chosen steps a week |
| Tier | Mayhem on 2–3 titans at month 6; Mayhem +1 … +3 once GA's UR set lands (≈ month 7, Whale A) | Mayhem +2 … +4 by weakness (Whale W: one more rank on the Regent and the Wyrm), months earlier |
| Team at L85 | 4 carries week 24, 8 girls week 30 | 9 girls week 15, 19 girls week 28 |
| UR gear | GA Seeds (+ ≈ 1.7 titan boxes by week 26, then one every ≈ 2.5 weeks at Mayhem) | Seeds + one every ≈ 1.6 weeks |
| Star Fragments | ≈ 134–143 a week | ≈ 206 a week (8 Memento packs) |
| Jackpots | — | whole Rainbow Crown 1–3 % per Mayhem Victory |
| Prestige (M3) | Mayhem first-clear titles | +5 / +10 frames, top of the clan board |

Money speeds the climb but never skips it: no crowns or crown shards, Rainbow boxes, keys or exchange currencies for
gems. Honest limit: once GA's UR set lands, the free player's titan tier catches up to Whale A; the lasting edges are SSR
Potential, time and the whole-crown jackpots (as P3 §0 item 9 intends).

### E.6 Fit with Potential v3, path-cap and gear awakening

- **Power targets unchanged:** gates change *when* levels arrive; the only new power is +2 % per gate (**×1.035** at L85
  ★5, §B.1), which K1 adds on top of P3's ×1.283. Titan Trials never touch Freeplay waves, the boss schedule or
  path-cap's bands (PC F5, M7; P3 §9.2).
- **UR supply:** ≈ 0.06 boxes a week at Nightmare, ≈ 0.4 at Mayhem (free), ≈ 0.64 (spender) (§C.8); GA R22 holds.
- **Legendary inflation** (PF risk): legendary goes from ≈ 1.2 to ≈ 3 a week at Hard and ≈ 11–16 at Nightmare/Mayhem; gate
  5 and Legendary gear salvage get easier late. Knob: Nightmare Victory legendary 70 % → 50 %.

---------------------------------------------------------------------------------------------------

## F. Saves, migration and older-build safety

### F.1 New state (additive; `SAVE_VERSION` stays 2, `src/systems/save.js:19`)

Builds keep `missions.counters` word for word (`cleanNumberMap`, `src/systems/save.js:159-167`), while `cleanUnit` is an
allowlist (`:169-187`) that drops unknown unit fields, clamps `breakthrough` to 0–5 (`:172`) and the level to
`min(60, 10 + 10·bt)` (`:173,177`); unknown items are dropped (`:338`) and the load is flagged lossy (`:533,549`).

| State | Stored | Mirror (restore = max) | What an older build does |
|---|---|---|---|
| Bought Potential | `units[id].pl` 1–6 | `pl:<id>` | drops `pl` → restored from the mirror |
| Gates 6–10 | `units[id].breakthrough` 0–10 | `bt:<id>` (written when > 5) + P3's `lv:<id>` | clamps to 5 and L60 → restored, then re-clamped to `levelCap` |
| Essence history | `units[id].dupes` (existing, allowlisted `:185`) | `pot:<id>` (existing) | keeps counting duplicates (and pays its old fragments: a small gift) |
| Steps paid with Kindred | counter `essU:<id>` | itself | kept |
| Kindred released for a spare payout | counter `kinX:<rarity>` | itself | kept |
| Own Essence converted as spares | counter `essX:<id>` | itself | kept |
| Own Essence bought ("Chosen Essence") | counter `essB:<id>` | itself | kept |
| **Essence balance** | **derived**: `dupes + essB − (pl − 1 − essU) − essX` (all monotone) | — | a stale tab's duplicate simply raises it |
| R spare fifths | `spk:r` | itself | kept |
| Migration / pouch | `ess:mig` | itself | kept (never runs twice) |
| Keys | `tk:left`, `tk:week` | itself | kept |
| Titan progress | `tbest:<titan>` (solo only; tier × 100 + rank), `tfc:<titan>:<tier>` (solo only), `ttgt:<titan>`, `tkill:<titan>`, `tatt` (attempt counter for the drop seed) | itself | kept |
| Rainbow Meter / owed box | `pity:rain`, `rbx:owed` | itself | kept |
| Box-born UR flag | gear `ur: 1` | `gbx:<uid>` = slot index × 100 + main-stat index + 1 (0 after salvage) | drops `ur` → restored when that uid, slot and main stat are present, at any level (§C.8) |
| New shop offers + `group` stock | `profile.shop.bought` | `shopwk:asc` (game week as a number) | an older tab rolling the week first keeps their counts → M1 clears its own ids and group keys when `shopwk:asc` ≠ this week (§C.10) |
| Welcome pouch | `profile.items` (`memento`, `moonpearl`), paid during migration | `inv:` | dropped → restored from `inv:`; never sent by mail (§A.7) |
| Together Chests (M2) | `missions.weekly['tk:tog']` | wiped weekly (`src/systems/missions.js:46-50`) | — |
| 16 new item ids (§F.3) | `profile.items` | `inv:<id>` (GA R16's helper in `setCount`, `src/systems/inventory.js:37`) | dropped, load lossy → restored from `inv:` (a spent item mirrors 0) |

Prefixes checked against those in use and planned (RS §7: `pot:`, `fpm:`, `pg:`, `pfs:`, `story:new`, `lv:`, `fpTome:`,
`gur:`, `gtn:`, `inv:`, `ga:gift`, `fpu:`, `pity:cel`; ACH's `ach:`): no collision.

### F.2 Load order (`migrateProfile`; idempotent)

`creditPotential` (today) → restore `pl:` / `bt:` / `lv:` by max → restore `inv:` items and `gbx:` flags → migration
A.7 once (`ess:mig`) → re-clamp `level` to `levelCap` (exp 0 if clamped, P3 §4.6) → convert any Essence above `6 − pl`
to spares (`essX`). **That load-time conversion only raises `essX`; it pays nothing** (no Mementos, Moonpearls or
points): such Essence comes from a duplicate an older build already handled, and that build paid its fragments and its
recruit point. So a stale-tab duplicate pays once (S1 asserts it). The sanitizer allows `pl` 1–6, `breakthrough` 0–10
and caps the level at `gates < 5 ? 10 + 10·gates : 85` until migrate re-clamps (P3 §4.6's ordering).

### F.3 New item ids (16)

`kindred_r`, `kindred_sr`, `kindred_ssr`, `kindred_shard_ssr` (category `fragment`) · `crown_rainbow`,
`crown_rainbow_shard` (`crown`) · `gearbox_rainbow` (`gearbox`) · `memento`, `moonpearl` (`token`) · `mat_feather_zenith`,
`mat_blade_zenith`, `mat_ember_zenith`, `mat_rime_zenith`, `mat_charm_zenith`, `mat_rune_zenith`, `mat_cog_zenith`
(`material`, rarity `legendary`, `tier: 'zenith'`). Per-girl Essence is **not** an item (no 19–30 ids, no backpack tab, no
mirrors needed).

### F.4 Profile card and other readers

- The card validator allows `bt` 0–9 only (`src/online/profileRules.js:105`), so a gate-10 girl would make the whole card
  fail. **Cards send `bt: min(bt, 5)`**; the viewer's clamp (P3 §4.6) becomes `bt < 5 ? 10 + 10·bt :
  POTENTIAL_LEVEL_CAPS[p − 1]` (the gate cap is never above the Potential cap). No SQL change.
- **Snapshots carry `pl`.** `snapshotToMiniProfile` builds `{ level, breakthrough: u.bt, dupes: (u.p || 1) − 1 }`
  (`src/online/profileCard.js:182`), and the showcase calls `potentialLevel(st)` and `levelCap(st)`
  (`src/ui/profile/parts.js:111,123`); with `potentialLevel` reading `pl`, every showcase girl would read P1 and an L85
  girl's cap 60. So the snapshot sets **`pl: u.p`**, and the viewer cap and the co-op ally clamp in
  `loadoutToMiniProfile` (`:186-189`, today `levelCap({ breakthrough: bt })`) use the formula above instead of
  `levelCap`. `src/online/profileCard.js` joins §G's M1 list; `tests/online/profileRules.test.js` covers both.
- Battle saves freeze stats (P3 §4.6); titan runs are not savable.
- Achievements: the "Reach level 85" row (P3 §11) works unchanged; `bossKill` (Crown Hunter) counts titan Victories.

### F.5 Two releases

**M0 reader** (normal update, ≥ 2 weeks before M1; GA R17's pattern): every new item id (no sources) **and every new
shop offer id with `resets: 'weekly'` plus the `group` reset** (§C.10), tolerant `cleanUnit` (`pl`, `breakthrough` ≤
10, level ≤ 85), the counter restores (`pl:`, `bt:`, `inv:`, `gbx:`), the Rainbow box reader (listed in the Backpack
with Open disabled, with or after GA R1), the card's `bt ≤ 5` writer and the snapshot's `pl`. Nothing earns yet. Stale
tabs after M1 are then mostly readers.

---------------------------------------------------------------------------------------------------

## G. Co-op determinism and the co-op id

- **M1 changes no co-op-hashed file.** Touched: `src/systems/{unlocks,potential,progression,inventory,rewards,save,shop,
  gacha,missions,gear}.js`, new `src/systems/titanRewards.js` (all drop tables), `src/data/{items,shop,missions,
  patchNotes,wiki}.js`, `src/data/story/lessons.js`, `src/online/profileCard.js` (snapshot `pl`, caps; not in the co-op
  graph), new `src/data/titans.js` (stage + enemy overrides only; imported by UI and systems **only**, never by
  `src/sim/**`, `src/online/coop/**` or `src/data/coop.js`), UI (`src/ui/selectTicket.js`, `src/ui/screens/{recruit,
  backpack,student,assault}.js`, `src/ui/battle/{controller,results}.js`, the new hub). `src/data/types.js` untouched
  (`fragmentsOnDupe` stays, unread).
  Gate: `node tools/simId.mjs` (`tools/simId.mjs:20-63`) is equal before and after the M1 commits (on top of train C's own
  change).
- **Drops are rolled outside the sim**, after the battle, from a per-attempt seed (§C.6; not `battleDropSeed`, which
  only seeds saved runs) on each player's own save; the damage notch is read from the deterministic final sim state, so
  co-op partners always see the same notch.
- **M2 changes the co-op id once.** `src/data/coop.js` imports `titans.js` so rooms can offer titan stages. That changes
  **`SIM_ID`** through the import graph (`tools/simId.mjs:18-27` entries, `:44-60` walk), not the data hash: `coopVersion`'s
  `data` is fnv over `[UNITS, ENEMIES, STAGES, MAPS, BATTLE, DIFFICULTIES, TYPE_CHART, COOP, FREEPLAY]`
  (`src/online/coop/version.js:44`). From then on everything `titans.js` imports is co-op hashed, so **`titans.js` imports
  only data that is already hashed** (enemies, maps, stages, types, `src/sim/waves.js`) and never `items.js` or a systems
  file; drop tables live in `src/systems/titanRewards.js`, so later reward tweaks never move the id. `commands.js` builds
  the co-op Sim with `data: { stage: stageDef }` only (`src/online/coop/commands.js:76-79`), so M2 also passes the enemy
  overrides (`data: { stage, enemies }`), and `session.js` carries `{ mode: 'titan', titan, tier, rank }` in the start
  message (`COOP_PROTOCOL` +1, `version.js:22`). It rides a release that changes the id anyway (train C if it fits, else
  the roster train). No new enemy defs (the titans are already hashed).
- Loadouts carry `level` and multipliers as numbers (`src/online/coop/commands.js:83-87`); GA's train-C clamp (`level` ≤
  99) covers L85 and P3's `potential` 1–6 rule reads `pl` (P3 §4.7).

---------------------------------------------------------------------------------------------------

## H. Test gates

### H.1 Measurement gates (run on the integrated tree before release)

| # | Run | Pass |
|---|---|---|
| **W1** | `killcap` on each titan arena with the titan format (§C.2), five P3 profiles (path-cap P1, F2P-steady, F2P-late, Whale A, Whale W), solo (M1) and `--coop 2` (M2) | §C.3's table within ±30 %; else rescale the pool numbers (the rule stays) |
| **W2** | `census` at 3-5 / 4-5 / 5-5 teams on Normal | chapter 4 reaches Silver; 5-5 wins |
| **W3** | escorts: the run is never lost to escorts before the titan at any tier/profile that should win | 0 escort leaks over 1 % of lives |
| **W4** | runtime titan HP: build the real `Sim` from `titanStage()` per titan × tier × rank | spawned titan maxHp and her children's maxHp after the split within 1 % of §C.3's pool (§C.2) |
| **CP1** | P3's C1 campaign census (P3 §13.1) with titan-fed profiles: chapter 4 with Normal titans for 4 weeks, chapter 6–7 with Hard titans for 4 weeks (gates 4–5 broken ≈ 1 chapter early) | P3's C1 bands; else Normal/Hard tables first (§C.6), then the unlocks (Normal 5-5, Hard 8-5) |
| **E1** | `synth.mjs` rerun on the built tables | free 4 carries L75 weeks 13–17, L85 weeks 21–27; 8 girls ≤ week 34; spender 9 girls ≤ week 16, 19 girls ≤ week 30 |
| **E2** | Essence pace: simulated recruits with the P2R §4.2 pool | R P6 24–30 recruits; free SR P6 ≈ 237 ± 15 %; SSR medians unchanged |
| **E2b** | free SSR Potential at day 180 (week 26) with every Kindred and Chosen source (§A.4) | ≤ P3's free profile + 1 step on one girl (≤ 10 SSR shards, no Chosen SSR Essence yet) |
| **E3** | shop return per row (spare income per recruit × prices); combined pull income; spender SSR steps | Mementos → tickets ≤ 5 %, Moonpearls → tickets ≤ 3 %; ≤ 11 recruits a week from stock; **free SSRs a week ≤ +15 % over today** (spark + tickets); spender Kindred + Chosen ≤ 0.45 SSR steps a week |
| **E4** | Star Fragments a week, each currency spent once | free weeks 1–2 ≥ today's ≈ 88, late ≥ 120; **spender ≥ 70 % of today's (266)** |
| **E5** | Rainbow Meter Monte Carlo (1e6 players) | nobody passes 40 Mayhem Victory Chests; mean as §C.8 |
| **K1** | P3's K1 with the gate bonus (×1.035 at L85) | P3 §8.4–8.5 within ±30 % |
| **K2** | P3's ladder (K1 runs, 4-5 and 8-5) with the **free month-6 board as it really is**: F2P-late + GA's ≈ 17 UR pieces + titan boxes, and the month-7+ board (= Whale A) | wave 250 never beaten (GA R22); report the free falls; if month 6 lands above P3's 195–209, Meter 40 → 60 and the Nightmare 0.5 % → 0 first, then GA's own knobs |
| **S1** | stale-tab tests: a pre-M0 build and an M0 build save over M1 data | every `pl`, gate, level, item, first clear and key restored; a box-born UR at +0 keeps `ur` through a pre-GA build (`gbx:`); a stale tab that rolls the shop week first leaves no new row sold out (`shopwk:asc`); an M0 tab cannot open a Rainbow Gear Box; the welcome pouch survives a pre-M0 save; **nothing pays twice** (load-time spares pay nothing); Essence balance exact |
| **C1** | `node tools/simId.mjs` | unchanged by M1 commits |

### H.2 Unit tests (vitest)

- `tests/systems/unlocks.test.js`: a duplicate gives 1 Essence and 0 fragments; spare at `6 − P`; spare table per
  rarity; R fifths roll into a point on the 5th; first copy unchanged; the result has no `fragments` field and every
  reader (§A.6) shows Essence or the spare payout.
- `tests/systems/potential.test.js`: Raise Potential charges §A.2 coins; never above 6; Kindred only with no own Essence,
  rarity-or-lower, never at P6; release pays a spare of its rarity with no points; `potentialLevel` is 1 without `pl`;
  the derived balance after any order of grants, buys, spares and stale-tab duplicates.
- `tests/systems/progression.test.js`: `levelCap` for gates 0–10 × P1–P6 (gate *k* refused below P(k − 4)); §B.2 costs
  per family; `MAX_BREAKTHROUGH` 10; damage at L85 gate 10 ★5 = 2.962 × (1 + ATK %) and at gate 5 = 2.862 (×1.035);
  P3's assertions re-pinned (`levelCap({ breakthrough: 9 })` now 78 at P5+).
- `tests/systems/inventory.test.js`: Craft Room rates, fees, weekly caps, shard fusion; no Mall arbitrage.
- `tests/systems/gear.test.js`: `openGearBox(gearbox_rainbow)` refused (`pickSlot`); the slot picker makes a `ur: 1`
  Legendary at +0 and writes `gbx:`; "Open all" skips it; salvage pays Legendary + 1 Rainbow Seed and zeroes `gbx:`.
- `tests/systems/titanRewards.test.js`: notch shares; Victory Chest lines per tier (no mythic/legendary on Normal,
  legendary 25 % on Hard); Meter counts Mayhem chests only and guarantees the 40th; first clears pay once (`tfc:`), solo
  only; keys spent only at Bronze+; carry-over ≤ 6; Titan of the Week ×1.5 tokens; the same `tatt` rolls the same
  drops; mission events (Hard+ Victory fires `battleWinHard`, sweeps fire `sweep`).
- `tests/data/titans.test.js`: escort pools contain no child, brood or summon id; stage ids unique; `titans.js` absent
  from the sim/coop import graph (M1) and imports only hashed data (M2); **the runtime HP test of W4** (real `Sim`, not
  data arithmetic).
- `tests/data/shop.test.js`: Memento rows, Titan shelves, group stock, per-offer currency, the every-other-week SSR row,
  hidden rows with no eligible girl, no gem price on Mementos, Moonpearls, crowns or crown shards, legendary, Rainbow
  boxes or keys; `shopwk:asc` resets the new rows after an older build rolled the week.
- `tests/systems/save.test.js`: migration A.7 (P never drops, idempotent, pouch caps, pouch in items not mail); mirrors
  (`pl:`, `bt:`, `inv:`, `gbx:`); `cleanUnit` order; load-time spares pay nothing; a hostile `bt:`/`pl:` never lifts a
  girl above her P cap.
- `tests/online/profileRules.test.js`: card with a gate-10 girl sends `bt` 5 and passes; the snapshot carries `pl`, the
  showcase shows her real P and an L85 cap; the co-op ally clamp keeps L85.
- `tests/data/achievements.test.js`: titan kills do not move "Starlight Vigil".
- M2: `tests/online/coopTitan.test.js` — two clients, one titan: hashes agree, the notch is equal, drops differ per
  save; a co-op Victory pays no first clear, unlocks nothing and leaves `tbest` unchanged; a guest above solo best + 1 is
  refused.

### H.3 e2e (844×390 touch and 1280×720)

`e2e/essence.mjs` (recruit chip, Raise Potential, Kindred sheet, Memento Exchange buy), `e2e/titans.mjs` (hub, target
chip, fight → notch chimes → Victory Chest, sweep, Meter, Titan shelf), `e2e/gates.mjs` (gate 9 card, Where to get,
Craft Room combine, Rainbow Crown fuse, gate 10 moment). No horizontal scroll.

---------------------------------------------------------------------------------------------------

## I. Milestones and build plan

| # | Ships in | Contents | Co-op id |
|---|---|---|---|
| **M0 reader** | next normal update (with or after GA R1) | §F.5 | unchanged |
| **M1 "Essence & Titans"** | **train C after Potential v3** (merge order: hero → Chika → path-cap → Potential v3 → **M1** → Codex modes), or the next normal update after train C | Essence-only duplicates + migration; Raise Potential; spares, ⅕ points, Memento Exchange; Kindred; gates 6–10, Zenith, Rainbow Crown; Craft Room; Titan Trials solo (4 titans × Normal–Mayhem + ranks), keys, sweeps, practice, Victory Chest, first clears, Meter (if GA R2 live), Titan of the Week, Titan shelves; fragment bridges; Rainbow Hunt fold-in; all copy, wiki, patch note, letter | **unchanged** (gate C1) |
| **M2 "Titans together"** | the next release that changes the co-op id (train C if room) | co-op titans, Together Chest, clan titan board (owner-run SQL) | changes once |
| **M3** | normal updates | titan achievements (items only), Mayhem +5/+10 frames and titles, monthly board season, later new titans | M3 titans change it |

**Why M1 is one piece:** Essence-only removes ≈ 80 % of fragment income (RS §4), so the titans must arrive with it; the
gates need P3's caps; Essence without gates would leave P3's "duplicate is the gate" in place for a release. If M1 slips
past train C, train C ships P3's automatic P and M1's migration keeps every P and counts gates up to each girl's current
level as broken (no level ever drops).

**M1 commits:** E1 Essence (`unlocks`, `potential`, counters, migration, Kindred, Select/spark text) → E2 gates
(`progression`, `save` sanitizer, `bt:`, card writer) → E3 items + `inv:` + `gbx:` + Craft Room → E4 `titans.js` + controller
`req.titan` + `titanRewards.js` (notches, chest, Meter, first clears, keys, sweep) → E5 shops (Titan shelves, Gem shelf,
Memento Exchange, group stock, per-offer currency, `shopwk:asc`) → E6 UI + moments + copy → E7 gates W1–W4, CP1, E1–E5,
K1–K2, S1, C1, e2e.

---------------------------------------------------------------------------------------------------

## J. Changes to `docs/specs/POTENTIAL.md (v3 sections; full design notes stayed in the design scratch)`

1. **§0 item 5, §4.1:** "There is **no gate 6**: the duplicate is the gate" is replaced. `MAX_BREAKTHROUGH` 5 → 10; gate
   *k* (6–10) opens at P(k − 4) and is broken with §B.2's costs; `levelCap(u) = gates < 5 ? 10 + 10·gates :
   GATE_CAPS[gates]` (60, 63, 67, 72, 78, 85 for gates 5–10). `POTENTIAL_LEVEL_CAPS` stays as the ceiling per P.
2. **§4.1 / `potential.js`:** `potentialLevel(u)` reads the bought field `u.pl` (1–6), not `min(6, 1 + dupes)`.
   **Potential is no longer automatic:** a duplicate gives 1 Essence; **Raise Potential** costs 1 Essence + §A.2 coins.
   "Potential only grows" still holds (`pl` is monotone and mirrored).
3. **§4.3 per-level cost: kept unchanged** (one Akashic Tome + 12,000 coins per level above 60; 25 Tomes + 300k coins for
   60 → 85). The gate costs are **added** on top; the screens say "Tomes for the levels, the gate for the door".
4. **§4.4 Tome sources:** keep Library III Nightmare 20 %, the Freeplay cache (2 a week) and the Bounty Exchange row
   (2 a week). **Remove** "duplicates past P6 pay SR 1 / SSR 5 Tomes". **Add** the Memento Akashic Tome row (20 Mementos,
   2 a week), the Titan shelf Tome row (30 tokens, 2 a week) and titan books (Nightmare 20 %, Mayhem 30 %; Hard Sage's
   Codex; Normal 2 Textbooks).
5. **§4.5:** EXP pace ≈ 460k a week (≥ P3's 455k); the pace of levels past 60 is now set by gate coins and Rainbow
   Crowns (§E.2: carries L75 week 16, L85 week 24), which lands P3's F2P-steady at ≈ month 3.7 and F2P-late at ≈ month
   5.5. P3 §8.3's F2P-late assumes best-gold gear; with GA the real month-6 board carries ≈ 17 UR pieces (gate K2).
6. **§4.6 saves:** add `pl:<id>` and `bt:<id>` mirrors beside `lv:<id>`; `cleanUnit` caps the level at `gates < 5 ? 10 +
   10·gates : 85` and allows `breakthrough` 0–10; the **profile card sends `bt ≤ 5`** and the viewer clamp becomes
   `bt < 5 ? 10 + 10·bt : POTENTIAL_LEVEL_CAPS[p − 1]` (`src/online/profileRules.js:105` allows `bt` ≤ 9 only).
7. **§4.7 co-op:** unchanged (`potential` 1–6 now reads `pl`).
8. **§4.9 / §11 copy:** "Next: 78 at P5 (1 more duplicate)" → the Potential panel's **Raise Potential** button and the gate
   card ("Gate 9 · Level cap 72 → 78"); "Potential up!" cards appear on **Raise**, not on the recruit.
9. **§8 / §13.1 K1:** add the +2 % per gate for gates 6–10 (×1.035 at L85 ★5: 2.962 / 2.862); fallback 0 % past
   gate 5. Add K2 (§H.1) beside K1.
10. **§12 patch note and letter:** "Every duplicate raises a girl from P1 up to P6" → "Every duplicate gives her an
    Essence; use Essence and coins to raise her Potential, then break her level gates with materials from the new Titan
    Trials." The letter is §A.7's.
11. **§13.2 tests:** `gacha.test.js` "duplicates past P6 pay Tomes besides fragments" → §H.2's Essence/spare tests;
    `progression.test.js` gains gates 6–10 × P.
12. **§14 L1:** drop the overflow-Tome part. **§15:** M1 merges right after Potential v3 in train C.

## K. Changes to `docs/specs/GEAR_AWAKEN.md`

1. **R20 "UR never drops; no UR gear box" is overridden** by the owner: the **Rainbow Gear Box** drops from Titan Trials
   Victory Chests (Nightmare 0.5 %, Mayhem 4 %, +0.25 % per rank to 6 %) and is guaranteed by the **Rainbow Meter** (40
   Mayhem Victory Chests, `pity:rain`); no first clear pays one. It opens (player picks the slot) into a Legendary piece
   with `ur: 1` at **+0** with four substats; the generic Open refuses it (§C.8).
2. **R6 / R10 (Seeds and Needles never drop):** unchanged for Seeds and Needles; the box is a separate source.
   **Rainbow Hunt** ("Clear Total Assault 3 times") also accepts **Titan Trials Victories (sweeps count)** — one weekly
   boss loop (the `assaultClear` event also fires for titan Victories).
3. **R4 (awaken at +10):** a box-born UR is already UR; it enhances +0 → +12 at **R12's tier-6 prices** (216,000 coins).
4. **R11 salvage:** a box-born UR salvages to the Legendary payout **+ 1 Rainbow Seed** (same rule as a bloomed piece).
5. **R15:** the Celestial counter `pity:cel` also counts Titan Trials Nightmare+ Victories.
6. **R1 / R17:** M0 ships the Rainbow box reader with or after GA's R1 reader; if GA's writer (R2) is not live at M1, the
   Rainbow roll goes to Celestial and earned boxes wait in `rbx:owed`.
7. **§6.5 pace:** titans add ≈ 0.06 UR pieces a week at Nightmare and ≈ 0.4 at Mayhem (free; ≈ 1.7 by model week 26),
   so a free player's 24 pieces still land ≈ GA week 20; a spender's land sooner. **R22** (UR_LATE never beats the
   Eclipse Wyrm) unchanged; knob Meter 40 → 60. GA's own note: by GA week 16 its free player already wears ≈ 17 UR
   pieces, which P3's F2P-late profile does not include (gate K2).
8. **§6.3 achievements:** titan achievement rows pay items only (the ACH new-row gem cap is at 6,980 with GA's wave).
9. **§8.3 `inv:`:** the mirror helper also covers the 16 new ids (§F.3).
10. **R16 (mirrors):** add `gbx:<uid>` for box-born UR from +0 (slot index × 100 + main-stat index + 1; 0 after salvage).
    `gur:` keeps its +10 rule; `gbx:` restores `ur: 1` at any level when that uid, slot and main stat are present
    (§C.8, §F.1).

---------------------------------------------------------------------------------------------------

## L. What else (ranked)

| # | Idea | When |
|---|---|---|
| 1 | **Auto-target:** the hub pre-picks the titan and family your next gate needs ("Kage needs 2 Zenith Plume → Eclipse Wyrm") | in M1 |
| 2 | **"Where to get" and "Needed for" tags** on the gate card, drops and shelves ("Needed: Kage Gate 9") | in M1 |
| 3 | **One weekly boss loop:** GA's Rainbow Hunt accepts 3 titan Victories | in M1 |
| 4 | **Titan of the Week** (+50 % tokens, the lobby headline, the clan board's titan) | in M1 |
| 5 | **Recruit chips** "+1 Essence · P4 ready!" / "Spare → +6 Mementos" | in M1 |
| 6 | **Titan moods:** one readable weekly twist per titan ("Moonlit: holy +25 %", "Armored week") so the best team changes | later (a sim modifier: next co-op-id train) |
| 7 | **Borrow a clanmate's girl** once a week for a titan fight (stats frozen when lent) | later (online work) |
| 8 | **Late-starter boost:** ×2 Assault Tokens for the first 4 weeks after Titan Trials unlock | later (M3) |
| 9 | **Potential memory scenes:** each Raise unlocks a short "she trains harder" scene or voice line | later (content) |
| 10 | **Prestige:** "<Titan> Vanquisher" titles, Mayhem +5 / +10 frames, a monthly clan-board season, a tiny rainbow crown on cards past gate 10 | M3 |

---------------------------------------------------------------------------------------------------

## M. Risks and knobs

| Risk | Guard / knob |
|---|---|
| Titan HP is modelled from 4-5 Freeplay boards (P3 §8.4), not the titan arenas; Normal is an estimate | gates W1–W4; knobs are the pool numbers (the √ rule stays) |
| Titan `hp` multiplied again by the sim (hpScale × difficulty × wave ramp) | §C.2's divisor; W4 checks the spawned maxHp |
| Full-board start budget sidelines economy girls and may let strong boards idle through escorts | start cash per tier (W3) |
| Coins and Rainbow Crowns bind free players (by design) | knob order: gate coins → damage-table coins → Nightmare crown shard 25 % ↔ 40 %; never the Essence 1:1 rule |
| Normal/Hard titans pull campaign materials forward | §C.6's chapter-sized tables; CP1; then Normal 5-5 / Hard 8-5 unlocks |
| Legendary inflation (≈ 11–16 a week late vs ≈ 1.2 today) | Nightmare Victory legendary 70 % → 50 % |
| Free SSR income +6.9 % (spark), ≤ +13.2 % with tickets | R ⅕ → 0 (+3.9 %); E3 ≤ +15 %; patch note states it |
| One free SSR rises one step above P3's free profile via Kindred by month 6 | E2b; the SSR shelf row is already every other week |
| Free UR through titans | Rainbow box Mayhem 4 %, Nightmare 0.5 %, none from first clears; Meter 40 → 60; K2 |
| Spender ★ pace −22 % (whale −54 %) without duplicate fragments (the owner's rule) | Memento fragment stock 8 → 10; E4 ≥ 70 % |
| Weeks 1–4 fragments (≈ 95 / 129 vs ≈ 88 today) | Normal fragments 5 → 4 if ★ runs hot |
| Co-op carries | no first clears, unlocks or sweep tier from co-op; guests ≤ solo best + 1 (§C.11) |
| Eclipse Wyrm as a weekly titan may take mystery from the wave-250 summit | swap that slot for a titan-scaled Ashwing Matriarch (same families, same pierce weakness) — owner question 1 |
| Stale tabs (16 ids, gates > 5, new shop rows, box-born UR, Rainbow box Open, pouch) | M0 reader ≥ 2 weeks earlier, mirrors (`inv:`, `gbx:`, `shopwk:asc`), S1 |
| Profile card refuses `bt` 10; snapshots lose Potential | cards send `bt ≤ 5` and `pl` (§F.4) |
| Clan board trusts client damage | server clamp to pool HP and ≥ 10 s; small rewards |
| Coins pile up after the free team is done (≈ 1M a week from week 30) | the roster update's 11 girls (≈ 42M); fallback: halve damage-table coins once all owned R/SR are at gate 10 |
| Train C is already large | M1 touches no hashed file, so it can follow train C by one normal update (§I) |
| Gem rows (≤ 2,000 gems a week) on a kids' game | weekly caps; Zenith and one SSR shard only; never crowns, keys or boxes — owner question 2 |

---------------------------------------------------------------------------------------------------

## N. Owner questions (the build goes ahead on the default)

1. **Eclipse Wyrm as a weekly titan?** It is the free team's favourite (weak to pierce), but it is also the wave-250
   summit. *Default: keep it (a much smaller version; the summit stays out of reach).*
2. **Spender shelf in the Gem Shop** (SSR Kindred Shard 1,500 gems ×1, Zenith 250 ×2; at most 2,000 gems a week).
   *Default: keep, capped weekly; never crowns or crown shards, keys or boxes.*
3. **Pace:** four carries at L85 around month 5.5, a free team of eight around month 7, gate 10 costing 800k coins.
   *Default: yes.*

---------------------------------------------------------------------------------------------------

## Appendix. Names (case-insensitive grep over `src docs CONTRACTS.md`, 2026-10-15)

No hits: Kindred, Memento, Moonpearl, Rainbow Crown (and Shard), Rainbow Gear Box, Rainbow Meter, Titan Trial(s), Trial
Key, Mayhem, Victory Chest, Together Chest, **Craft Room**, Titan shelf, Titan of the Week, Chosen Essence, Vanquisher.
**"Material Workshop" was dropped:** the full phrase has no hits, but "Workshop" already names the Workshop Yard bounty
(`src/data/stages.js:795`, `src/data/maps.js:1249`), its Backpack and student-page hints
(`src/ui/screens/backpack.js:353`, `src/ui/screens/student.js:718`), the event "Workshop Open House"
(`src/data/missions.js:61`) and the achievements "Workshop Regular" / "Tidy Workshop" (`src/data/achievements.js:141,192`).
"Zenith" appears only as a word in Hikari's tier text (`src/data/units.js:121`) and a code comment;
"Omamori", "Sigil" and "Cog" are already the charm / rune / cog family words (`src/data/items.js:72-73,83`), which the
Zenith names follow on purpose. Avoided: "Inferno" (Akane's `Inferno Queen`, `src/data/units.js:655`), "Calamity"
(Freeplay's wave-250 rank, `src/sim/freeplay.js`), "Breaker" (path tier names, `src/data/units.js:294,386`), "Spotlight"
(the story coach UI), "Ascension" (the ★5 moment), "Keepsake" (achievement names), "Wish" as an item name, and every
commercial game title.

Model: `(design scratch, not in the repo)` → `synth.txt`; `tools/titanhp.mjs` → `titanhp.txt`.
