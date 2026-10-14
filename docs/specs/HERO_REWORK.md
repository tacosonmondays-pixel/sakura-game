# Hero rework: free heroes that level 1–25 in battle (build spec, r2)

Sakura Sentinels, roadmap task #168. Written 2026-10-14; **r2** resolves every valid point of `CRITIC.md` (resolution list in §16). Live checkout `/home/user/sakura-game` (read-only, never written): the spec was drafted on `9bede1e` (v0.1.25); live is now `ffc4d23` (UR awakening merged: UI files only, no sim, data or co-op file changed, so the co-op id is unchanged and every sim line reference below still holds; UI line numbers were re-checked on `ffc4d23`).

**Evidence.** Every number comes from a working prototype on the real sim: a Vite bundle of the live code with the changed files swapped in from an overlay where every patch is an asserted exact-once replacement. r1 lives in `exp/`, r2 in `exp-r2/` (`make-overlay.mjs` builds solo + two-hero co-op + the r2 fixes in one overlay; `out/` is the r2 bundle, `../exp/out-live/` the live baseline). Bots: the `tests/integration/balance.test.js` F2P roster at `EXPECTED_LEVEL` with `autoPlan`, plus the "strong" roster from the freeplay spec. Determinism was checked in V8 (Node 22) and JavaScriptCore (Bun 1.3.14). File list in the Appendix.

**Rule for this document and the build:** our own names and words only. The owner names their reference game in chat; player-facing copy never does (two existing wiki lines, `src/data/wiki.js:36` and `:209`, still name it and should be reworded). Heroes are adult guardians; nothing here is about anyone's looks.

---

## 0. The owner's words → behaviour

> "Can you make towers free, give up to level 25 like auto level during a battle, like heroes in bloons, and instead of manually purchasing an upgrade path, combines all the path passives into one, and spread those buffs throughout all 25 levels, you can purchase levels with coins during a match, right now they feel moderately pointless compared to towers, they should be strong and get stronger as the battle goes on! Do you know what I mean?"

**Reading (owner question 1).** "make towers free" is read as **make heroes free**: the rest of the sentence is about heroes (levels, auto level "like heroes in bloons", "they feel pointless compared to towers"). Towers keep their prices and paths. "Free" means **free to deploy in battle** (0 battle coins); how a hero is *obtained* (Hikari starter, Nami free after 1-5, Luna gacha) does not change. The other plausible reading, "the *upgrades* become free (she levels by herself instead of buying paths) but placing her still costs coins", is a one-line data change (`base.cost` back to 460–620); Q1 gives the owner both and what each does (free placement is what turns some Hard and Nightmare stages into wins, §6.4).

| Owner's words | Behaviour in this spec |
|---|---|
| "make towers [heroes] free" | Hero placement costs **0 coins**. Her card and every screen that showed her deploy cost say **FREE**. Battle start auto-arms her card (one tap places her). She cannot be sold (nothing to refund); she can be **moved** instead: free and instant before a wave or between waves; during a wave she stops attacking for 3 s and Move recharges for 15 s. |
| "give up to level 25 … auto level during a battle" | `BATTLE.maxHeroLevel` 10 → **25**. XP comes in on its own: **time in a wave**, **each cleared wave**, and **the damage she deals** (measured in the enemy's base HP). A **stage pace** makes short stages play the same arc as long ones: with no coins spent she is **Lv 7–9 at mid-stage on every stage** (r1: about 5 on chapter 1), and ends a 12–16-wave stage at **Lv 14–15**, an 18–20-wave stage at **Lv 15–20** and a 22–30-wave stage at **Lv 18–24** (measured, §4.3). |
| "instead of manually purchasing an upgrade path, combines all the path passives into one" | Heroes have **no upgrade paths** in battle. All 15 old path tiers (3 paths × 5) and the 9 old level milestones are merged into **one 25-level track** per hero. |
| "spread those buffs throughout all 25 levels" | Every level from 2 to 25 gives exactly **one** of those 24 items: tier 1s at Lv 4–6, tier 2s at 8–10, tier 3s at 12–15, tier 4s at 17–20, tier 5s at 22–24, the old milestones in between. **Counters come early**: each counter a hero used to buy from her paths (armor pierce, anti-air, cleanse, stun, Veil Sight aura) is on her track by Lv 8–14 (§3.1 rule 5). Every level also adds **+3 % damage** (Lv 25 = +72 %), so every level is felt. |
| "you can purchase levels with coins during a match" | A **Level up** button (hero widget and her panel) buys the rest of the current level. The price is the level's price × the share of its XP still missing (it shrinks as she earns XP), × difficulty and gear Cost Reduction. Lv 2 costs 150, Lv 10 600, Lv 20 1,830, Lv 25 5,750 (from an empty bar). A tap buys the level the button shows at the price it shows, never a dearer one (co-op safe, §8). |
| "they should be strong and get stronger as the battle goes on" | Measured (§5, §6): today she caps at Lv 10 around wave 17–20 and ends 8-5 at **28 panel DPS against 140 for the best tower**; her share of the team's damage falls to 14–17 %. On the new track she keeps levelling to the last wave; at Lv 20 she is at the top of the tier-4 towers on a crowd and at Lv 25 Hikari equals and Luna passes the best tier-5 tower on a crowd (Nami stays a control hero, above the tier-5 median). Her ultimate gains two ranks (Lv 10, Lv 20). Past Lv 25 (long freeplay runs) she keeps growing slowly: **Mastery** +1 % damage per 2,000 XP, at most +25 %. |

---

## 1. Decisions on one page

1. **Heroes are free to deploy, one per player.** `base.cost` 0 for every hero; `Sim.placeCost` returns 0 for a 0-cost unit (today `roundCost` would floor it to 5, `Sim.js:36-38`).
2. **One 25-level track per hero, no paths.** Data in a new file `src/data/heroTracks.js` (`HERO_TRACKS[id] = { pathKeys, levels[25], ultRanks[] }` plus the shared XP/price tables). `units.js` hero blocks get `paths: []` and `hero: { levels, ult: { …, ranks } }`. Stat resolution is unchanged: `collectModSets` already applies every `hero.levels` entry ≤ her level (`mods.js:194-197`); it gains one growth ModSet (+3 %/level, plus Mastery past 25).
3. **Counters early (curation rule 5).** The first level that grants each capability in the hero's old `pathCapabilities` is Lv ≤ 10, or costs ≤ 1.5× the old cheapest path price to buy from Lv 1; capstone-only capabilities stay on the tier-5 level. Cleanse is Lv 9 (was Lv 19), anti-air Lv 10 (was 15), armor pierce Lv 8 for all three (was 12). Lv 25 stats are unchanged by the reordering (data test).
4. **XP: time + waves + damage in base HP, with a stage pace.** `k = clamp(22 / totalWaves, 1, 2)`: wave *n* of a short stage counts as wave *n × k* of a 22-wave stage, *k* times, and time XP is × *k*. Stages of 22+ waves are unchanged. Damage XP is `dealt ÷ enemy.hpMul × 0.4`, so stage HP scale, difficulty, co-op ×1.6 and the freeplay ramp do not change the pace. Passive XP and ult charge run only during waves.
5. **Buying levels:** `Sim.heroLevelStatus(want?)` / `Sim.buyHeroLevel(want?)` → `{ ok, reason, price }`. `want = { level, maxPrice }` makes a delayed buy safe: it is refused as `'stale'` if she already levelled past it or the price rose. Price table `HERO_LEVEL_PRICES` (24 entries, 150 → 5,750; 40,285 from Lv 1 to 25) × missing-XP share × `diff.costMul` × gear `costMul`, rounded up to 5. Cost-cut auras do **not** apply (a deliberate nerf for economy builds, said in the tips).
6. **Ultimate ranks.** Unlock at Lv 3 (as today), **rank 2 at Lv 10, rank 3 at Lv 20** (bigger radius / longer effect, −15 % cooldown each). Ult damage keeps scaling with her current damage (`hero.js:105-109`).
7. **No selling; Move instead.** `canSell(uid)` → `{ ok: false, reason: 'hero' }`; `sellTower` returns `false` for a hero (the UI already reads `false` as "refused", `towerPanel.js:304`) and emits nothing. `Sim.moveHero(x, y)`: free and instant in `prep`/`between`; in a `wave` she stops attacking for `HERO_MOVE.downtime` 3 s and cannot move again for `HERO_MOVE.cooldown` 15 s. No state window to hit, so auto-start and co-op command delay cannot make it fail.
8. **Co-op: each player brings her own hero.** The Sim holds up to two heroes (`sim.heroes[]`, by player index); `sim.hero` is a getter for the *active player's* hero. Nothing inside the step reads `sim.hero`/`sim.heroConfig`: a **runtime trap** throws if it does (tests and the prototype run with it on). New commands `hlv[level, maxPrice]` and `hmv[qx, qy]`. `COOP_PROTOCOL` +1.
9. **Determinism.** Only + − × ÷, `min/max/floor/ceil` on doubles and integer tables; no rng. r2 two-hero co-op battle with `hlv` sent from what the player saw 4.5 s earlier, moves before and during waves, auto-start and the view trap on: one digest (`a5769346`, 238 hashes) for both views, in V8 and JSC (§8.4).
10. **Saves.** No profile field, no `SAVE_VERSION` bump. Battle-save (#170): new snapshot fields, and if #170 ships first, `SNAP_V` 1 → 2 with a v1 hero migration (§9).
11. **Co-op id and data hash change** (sim, data, co-op files): both players must update; ship with the next forced bump (freeplay M1, codex modes, roster B3).
12. **Balance (§6).** The campaign gets easier on Normal: headroom (largest enemy-HP multiplier the bot still beats) rises **×1.4–×3.4** wherever the 16 cap does not hide it (geometric mean **×2.0** over 7 stages); 8-5 stays lost without buying and is won when the bot buys levels; per hero Hikari ×1.25–2.3, Luna ×0.9–2.7; co-op ×1.5–3.1. The balance branch (#75) re-runs its calibration after this lands; every knob is data.
13. **Economy: one item needs the owner's approval** (Q2). Free deploy plus the long track let the free-player bot clear 6 more Hard and 4 more Nightmare stages: **760 first-clear gems reachable earlier** (once per account; the medal budget itself is unchanged) and earlier sweeping on those stages (§6.4). No reward, price or currency in the account economy changes; level prices are battle coins.

---

## 2. How it plays

### 2.1 A battle, start to finish

1. **Wave 0.** The hero card is first in the bar, shows **FREE** instead of a price and pulses; the controller arms it (as if tapped) once the board is ready, so one tap on the grass places her (not in the coached tutorial). Toast: **"Hikari is free to deploy — tap the grass to place her."**
2. **Placed.** Toast (`controller.js:224` text replaced): **"Hikari takes the field! She levels up through the battle. Tap her to buy levels."** The hero widget (bottom-left) appears with **Lv 1**, her XP bar, the ult button (locked until Lv 3) and the **Level up** pill.
3. **During waves** XP fills from time, kills and wave clears. Each level-up: the portrait pops (`bt-levelup`, exists), the board shows "LV 8" (renderer, exists), and a toast names what she learned: **"Hikari Lv 8 · Wide Arc: 2 more targets per sweep, +0.2 range; ignores 2 armor."** Lv 10 and Lv 20 add **"Celestial Bloom rank 2!"**; tier-5 levels get the big banner **"LV 22 · NOON ABSOLUTE"**; Lv 25: **"Hikari reached Lv 25 — Dawnblade Ascendant!"**
4. **Buying.** Tap **Level up · 🪙 480** (widget or panel). If short: **"Need 140 more coins."** (same copy as upgrades, `towerPanel.js:265`). The price falls as the bar fills; at Lv 25 the pill disappears and the badge reads **MAX** (with Mastery: **MAX · +7 %**).
5. **Moving.** Panel → **Move** → tap a spot. Before a wave or between waves she walks over at once. During a wave the button reads **Move · pauses 3s**; after a wave move it shows **Move · 12s** while it recharges.
6. **Results.** The stats line adds **"Hikari reached Lv 18 (4 levels bought)"** for your own hero (co-op: your hero only, from her own counters).

### 2.2 What changes for players who liked paths

Nothing is lost: every old tier is on the track (§3), and at Lv 25 she has **all three tier-5s at once**, which a tower can never have (crosspath rule, `mods.js:249-257`). What goes away is *choosing* which path; the owner asked for exactly that. Two side effects are deliberate and written into the tips: cost-cut auras (Umeko, Miko, Nami's Harbor) discount tower upgrades but **not** hero levels, and gear Cost Reduction on a hero now discounts her **level prices** (shown on her stats as "Level prices −X %").

---

## 3. The level track (data model)

### 3.1 File `src/data/heroTracks.js` (new, data only, in the co-op graph through `units.js` and `hero.js`)

```js
export const HERO_XP_STEPS = [ /* 24 entries: XP for Lv 2..25 */ ];
export const HERO_LEVEL_PRICES = [ /* 24 entries: coins for Lv 2..25 from an empty bar */ ];
export const HERO_XP = { perSecond: 4, waveBase: 60, wavePer: 18, perBaseHp: 0.4,
  refWaves: 22, paceMax: 2,                                   // stage pace
  masteryXp: 2000, masteryStep: 0.01, masteryMax: 0.25 };     // past Lv 25 (0 = off)
export const HERO_GROWTH = { damage: 0.03, rate: 0 };          // per level above 1, additive
export const HERO_MOVE = { downtime: 3, cooldown: 15 };        // seconds, wave moves only
export const HERO_TRACKS = {
  hikari: { pathKeys: ['radiant', 'sanctuary', 'lightbringer'],
            levels: [ { level, from, also?, desc, mods } × 25 ],
            ultRanks: [ { level, desc, effect, cooldownMul } × 2 ] },
  luna: { … }, nami: { … },
};
```

- **One source of truth for the cap:** `BATTLE.maxHeroLevel` (`types.js:277`) = 25. `HERO_XP` has no `maxLevel` (r1 had a duplicate).
- `from` documents where a level came from (`'radiant.3'` = Radiant Edge tier 3, `'L5'` = old Lv 5 milestone, `'base'`); `also` lists a tier whose **capability part** was moved onto this level (rule 5). `pathKeys` maps `from` to the old path index (the attack-FX looks need it, §11). The sim ignores all three; data tests check them.
- **Per-hero override:** a hero may carry `hero.levelXp` (24 entries) **and must then carry `hero.levelPrices`** (24 entries); a data test enforces the pair, so prices always match that hero's steps. The three heroes use the shared tables.
- `units.js` hero blocks (`HIKARI` `units.js:77-165`, `LUNA` `:167-252`, `NAMI` `:254-339`): `base.cost` → `0`; `paths: []`; `hero: { levels: HERO_TRACKS.x.levels, pathKeys, ult: { name, desc, unlockLevel: 3, cooldown, effect, ranks: HERO_TRACKS.x.ultRanks } }`; `levelXp` removed. `pathCapabilities` stays (it now means "capabilities her track grants"; scouting reads it).
- **Canonical order** (paths A/B/C = old `paths[0..2]`, milestones M2..M10): Lv 2 M2 · 3 M3 (ult) · 4 A1 · 5 B1 · 6 C1 · 7 M4 · 8 A2 · 9 B2 · 10 C2 (+ult rank 2) · 11 M5 · 12 A3 · 13 M6 · 14 B3 · 15 C3 · 16 M7 · 17 A4 · 18 M8 · 19 B4 · 20 C4 (+ult rank 3) · 21 M9 · 22 A5 · 23 B5 · 24 C5 · 25 M10; then rule 5 moves counters forward. `tools/heroTrack.mjs <heroId>` prints a draft in this order from a hero's old `paths` + `levels` and flags rule-5 violations, for curation.
- **Curation rules** (written as comments in the file):
  1. **One attack per hero:** a tier that *replaced* her attack keeps its numbers, not the behaviour change (Hikari "Halo Lances" → "Halo Reach": +4 damage, +1 range, 2 more targets; no switch to projectiles).
  2. **Stacked beams are trimmed:** Luna's Lances T5 gives 1 beam, +10 damage, +20 % speed (was 2 beams, +24, +30 %), because Court T5 and the Lv 16 milestone also add beams; with r1's numbers (+16 damage, +30 %) the in-sim crowd bench put Lv 25 Luna at 1.68× the best tier-5 tower on a crowd, now 1.34× (§5.3).
  3. **Stacked push-back is trimmed:** Nami's Undertow tiers give 0.15 / 0.1 / 0.1 / 0.15 tiles (were 0.2 / 0.2 / 0.3 / 0.6) and the old Lv 10 milestone loses its 0.15 push (0.5 per hit at Lv 25 instead of 1.45), with the per-enemy **push lock** (roster B3's `PUSH_LOCK`, §11).
  4. **Redundant milestones get a top-up** instead of vanishing (Nami Lv 11 "Cold Front" +1 damage).
  5. **Counters come early.** For each capability in the old `pathCapabilities`, the first level that grants it is **Lv ≤ 10, or costs ≤ 1.5× the old cheapest path price** (tiers only) to buy from Lv 1. A capability that only a tier 5 granted stays on that tier-5 level (its old price was already 10,000+). The counter moves either by **swapping** two tiers of the same path when they are of similar power, or by moving **only its capability part** onto an earlier tier of the same path (`also`). Lv 25 stats are identical either way (measured: `exp-r2/lv25eq.mjs`, all three heroes).

**Rule 5, measured** (`exp-r2/caps.mjs`, coins = buying every level from Lv 1):

| Hero | Capability | Live: cheapest path source | r1 track | **r2 track** | Rule 5 |
|---|---|---|---|---|---|
| Hikari | armor pierce | Radiant Edge T3 (1,420) | Lv 12 (5,045) | **Lv 8 (2,145)** | pass |
| Hikari | cleanse | Sanctuary T4 (4,740) | Lv 19 (14,705) | **Lv 9 (2,685)** | pass |
| Hikari | anti-air | Lightbringer T3 (1,400) | Lv 15 (7,985) | **Lv 10 (3,285)** | pass |
| Hikari | reveal | Sanctuary T4 (4,740) | Lv 13 (5,985) | **Lv 13 (5,985)** | pass |
| Hikari | buff aura | Sanctuary T1 (140) | Lv 5 (885) | Lv 5 (885) | pass |
| Hikari | stun | Lightbringer T5 (14,800) | Lv 24 | Lv 24 | T5-only, stays |
| Luna | armor pierce | Lunar Lances T3 (1,600) | Lv 12 | **Lv 8 (2,145)** | pass |
| Luna | Veil Sight aura | Astral Court T3 (1,670) | Lv 15 | **Lv 10 (3,285)** | pass |
| Luna | stun | Night Gravity T4 (4,840) | Lv 19 (14,705) | **Lv 14 (6,965)** | pass |
| Luna | slow / buff aura | T1 (140 / 150) | Lv 5 / 6 | Lv 5 / 6 | pass |
| Nami | armor pierce | Frostbrand T3 (1,380) | Lv 12 | **Lv 8 (2,145)** | pass |
| Nami | stun (push-back) | Undertow T2 (460) | Lv 9 | Lv 9 (2,685) | pass |
| Nami | buff aura | Harbor Watch T1 (120) | Lv 6 | Lv 6 | pass |

What it means on the stages the critic found: 6-3, 6-4 and 6-5 list `cleanse`, sabotage starts at wave 2–3, and Hikari is the only F2P provider (`exp-r2/cleanse.mjs`, Hikari as the hero, Normal):

| Stage | Live bot (Hikari + paths) | r2, no buying | r2, buying levels from the first sabotage |
|---|---|---|---|
| 6-3 | never cleanses (ends Lv 10); 43 sabotages; won ♥93 | cleanse at wave 14; 41; won ♥98 | **cleanse at wave 8 for 1,505 coins**; 39; won ♥96 |
| 6-4 | never; 94 sabotages; won ♥99 | wave 12; 60; won ♥100 | **wave 7 for 1,425**; 52; won ♥100 |
| 6-5 | never; 67 sabotages; won ♥100 | wave 12; 64; won ♥100 | **wave 7 for 1,525**; 66; won ♥100 |

Coins in hand at wave 3 are 110–350 on these stages, so no build has cleanse at wave 3: today it takes 5,260 coins (Hikari 520 + Sanctuary T1–T4), on r2 about 1,500 bought or nothing by wave 12–14. The aura covers girls within 2.6 tiles of her, so placement still matters.

### 3.2 The three tracks (exact panel copy)

Generated from the prototype data (`exp-r2/src-heroTracks.js` → `exp-r2/res/tracks.md`). "r2 change" marks what moved or changed since r1.

**Hikari** (vanguard, holy cleave)

| Lv | Was | Level text | r2 change |
|---|---|---|---|
| 1 | base | Holy cleaves with Veil Sight. | |
| 2 | old L2 | Steady Guard: +1 damage. | |
| 3 | old L3 | Celestial Bloom unlocked; +5% attack speed. | |
| 4 | Radiant Edge T1 | Honed Light: +2 damage. | |
| 5 | Sanctuary T1 | Guiding Light: girls within 2.6 tiles gain +6% range. | |
| 6 | Lightbringer T1 | Bright Step: +0.3 range. | |
| 7 | old L4 | Wider Sweep: +1 target per sweep, +0.2 range. | |
| 8 | Radiant Edge T2 (+ T3's armor pierce) | Wide Arc: 2 more targets per sweep, +0.2 range; ignores 2 armor. | counter in |
| 9 | Sanctuary T2 (+ T4's cleanse) | Shared Light: aura +5% attack speed and cleanses sabotage and stuns. | counter in |
| 10 | Lightbringer T3 | Skyward Radiance: her sweeps reach flying enemies; +0.6 range. Celestial Bloom rank 2. | from Lv 15 |
| 11 | old L5 | Radiant Focus: +2 damage, +5% crit chance. | |
| 12 | Radiant Edge T3 | Sunsteel Edge: ignores 1 more armor (3 in all), +4 damage. | 1 pierce left |
| 13 | old L6 | Searing Dawn: hits reveal veiled enemies for 1.5s. | |
| 14 | Sanctuary T3 | Blessed Ground: aura shares Veil Sight and +10% damage; hits silence for 0.6s. | |
| 15 | Lightbringer T2 | Morning Tempo: +15% attack speed. | from Lv 10 |
| 16 | old L7 | Captain's Resolve: +10% damage. | |
| 17 | Radiant Edge T4 | Judgement Arc: +10 damage, 3 more targets, 15% crits for ×2. | |
| 18 | old L8 | Unwavering: +10% attack speed, +1 target. | |
| 19 | Sanctuary T4 | Sanctified Banner: aura +15% attack speed and reaches 3.2 tiles; hits reveal veiled foes for 2s. | cleanse moved out |
| 20 | Lightbringer T4 | Halo Reach: +4 damage, +1 range, 2 more targets. Celestial Bloom rank 3. | |
| 21 | old L9 | Sunforged: +3 damage, ignores 1 armor. | |
| 22 | Radiant Edge T5 | Noon Absolute: +24 damage, +40% attack speed, 4 more targets, +0.5 range. | |
| 23 | Sanctuary T5 | Dawn Sanctuary: aura +20% damage and reaches 4 tiles; silence +0.8s. | |
| 24 | Lightbringer T5 | Celestial Choir: +20 damage; hits may stun (25%, 0.4s) and reveal for 3s. | |
| 25 | old L10 | Dawnblade Ascendant: +15% damage, +0.3 range. | |

Ult ranks — Lv 10: "Rank 2: 5.5-tile bloom, stun 1.6s, recharges 15% faster." Lv 20: "Rank 3: the bloom covers 7 tiles, stuns for 2s and leaves foes Brittle (+15% damage taken, 6s)."

**Luna** (mystic, piercing beams)

| Lv | Was | Level text | r2 change |
|---|---|---|---|
| 1 | base | Three piercing moon beams. | |
| 2 | old L2 | Arcane Focus: +1 damage. | |
| 3 | old L3 | Moonfall unlocked; +0.2 range. | |
| 4 | Lunar Lances T1 | Focused Moonlight: +1 beam damage. | |
| 5 | Night Gravity T1 | Dusk Veil: beams slow by 15% for 1s. | |
| 6 | Astral Court T1 | Starlit Study: girls within 3 tiles gain +5% range. | |
| 7 | old L4 | Threaded Light: +1 pierce. | |
| 8 | Lunar Lances T2 (+ T3's armor pierce) | Silver Thread: each beam pierces 2 more enemies and ignores 2 armor. | counter in |
| 9 | Night Gravity T2 | Heavy Night: +0.4 range. | |
| 10 | Astral Court T3 | Celestial Court: aura shares Veil Sight and +10% damage. Moonfall rank 2. | from Lv 15 |
| 11 | old L5 | Night Tempo: +1 damage, +8% attack speed. | |
| 12 | Lunar Lances T3 | Eclipse Prism: beams ignore 1 more armor (3 in all) and deal +3 damage. | 1 pierce left |
| 13 | old L6 | Silver Edge: ignores 1 armor. | |
| 14 | Night Gravity T3 (+ T4's stun) | Lunar Gravity: slow 30%, struck foes turn Brittle (+10% damage from everyone); 15% chance to stun for 0.5s. | counter in |
| 15 | Astral Court T2 | Night Lessons: aura +5% attack speed. | from Lv 10 |
| 16 | old L7 | Fourth Phase: a fourth beam. | |
| 17 | Lunar Lances T4 | Full Moon Lance: +8 damage, +4 pierce, +25% against elites. | |
| 18 | old L8 | Tidal Moon: +2 damage. | |
| 19 | Night Gravity T4 | Starfall Bind: +20% damage. | stun moved out |
| 20 | Astral Court T4 | Moon Court Regalia: aura +12% attack speed and reaches 3.6 tiles; +4 damage. Moonfall rank 3. | |
| 21 | old L9 | Midnight Cadence: +10% attack speed. | |
| 22 | Lunar Lances T5 | Lunatic Lance: one more beam, +10 damage, +20% attack speed. | trimmed (rule 2) |
| 23 | Night Gravity T5 | Event Horizon: freeze chance, 50% slows, Brittle +20%, +20% attack speed. | |
| 24 | Astral Court T5 | Queen of the Night Sky: aura +20% damage, +10% range and speed; another beam. | |
| 25 | old L10 | Lunar Sovereign: +15% damage, +2 pierce. | |

Ult ranks — Lv 10: "Rank 2: slow lasts 6s, the haste lasts 10s, recharges 15% faster." Lv 20: "Rank 3: 60% slow and every girl attacks 40% faster."

**Nami** (tideguard, frost splash, water)

| Lv | Was | Level text | r2 change |
|---|---|---|---|
| 1 | base | Frost strikes from the water that slow. | |
| 2 | old L2 | Salt Spray: +1 damage. | |
| 3 | old L3 | Tidal Wave unlocked; +0.2 range. | |
| 4 | Frostbrand T1 | Cold Current: +1 damage. | |
| 5 | Undertow T1 | Riptide: +0.3 range. | |
| 6 | Harbor Watch T1 | Sea Breeze: girls within 2.8 tiles attack 5% faster. | |
| 7 | old L4 | Rolling Surf: +0.2 splash. | |
| 8 | Frostbrand T2 (+ T3's armor pierce) | Biting Spray: slow strengthened to 25% for 1.5s; ignores 1 armor. | counter in |
| 9 | Undertow T2 | Undertow: hits push enemies back 0.15 tiles (not bosses). | |
| 10 | Harbor Watch T2 | Lighthouse: +0.5 range. Tidal Wave rank 2. | |
| 11 | old L5 | Cold Front: slow strengthened to 25% for 1.4s; +1 damage. | |
| 12 | Frostbrand T3 | Rime Spear: Brittle +12%, wider splash. | pierce moved out |
| 13 | old L6 | Deep Current: +2 damage. | |
| 14 | Undertow T3 | Whirlpool: bigger splash, push-back +0.1 and a 35% slow. | |
| 15 | Harbor Watch T3 | Captain's Orders: aura +10% attack speed and +5% range. | |
| 16 | old L7 | Steady Helm: +10% attack speed. | |
| 17 | Frostbrand T4 | Glacier Breaker: +6 damage; 20% chance to freeze for 0.8s. | |
| 18 | old L8 | Rimebite: struck foes turn Brittle (+8% damage taken) for 2s. | |
| 19 | Undertow T4 | Maelstrom: +4 damage, push-back +0.1, 20% chance to stun for 0.4s. | |
| 20 | Harbor Watch T4 | Fleet Formation: aura +12% damage and reaches 3.4 tiles. Tidal Wave rank 3. | |
| 21 | old L9 | High Tide: +2 damage. | |
| 22 | Frostbrand T5 | Absolute Zero Tide: +18 damage, 30% freeze for 1.5s, huge splash, +25% attack speed. | |
| 23 | Undertow T5 | Leviathan's Wake: +14 damage, massive splash, push-back +0.15, +20% speed. | |
| 24 | Harbor Watch T5 | Admiral of the Tides: aura +15% damage, +10% speed, 10% cheaper upgrades; +10 damage. | |
| 25 | old L10 | Tidecaller: +15% damage. | |

Ult ranks — Lv 10: "Rank 2: the wave pushes 6 tiles and slows by 50%, recharges 15% faster." Lv 20: "Rank 3: the wave pushes 7 tiles, freezes for 1s and leaves foes Brittle (+15%, 6s)."

**Names.** Track names are the live tier names ("Silver Thread" is live Lunar Lances T2, "Riptide" live Undertow T1). The Potential spec (#165) reuses both for its P6 passives; that clash is resolved on the Potential side (§11).

**Interplay note:** Nami Lv 24 brings a 10 % `costCut` aura (as her old Harbor T5). It cuts tower upgrades in range (`Sim._upgradeCost`, `Sim.js:629-633`), **not** hero level prices (§4.4).

### 3.3 Ult ranks (data + sim)

`hero.ult.ranks = [{ level, desc, effect: {partial UltEffect}, cooldownMul }]`. New helpers in `hero.js`:

```js
export function ultRank(hero)   { let r = 1; for (const k of hero.def.hero?.ult?.ranks || []) if (hero.level >= k.level) r++; return r; }
export function ultEffect(hero)  { let e = hero.def.hero.ult.effect; for (const k of ranks) if (hero.level >= k.level && k.effect) e = { ...e, ...k.effect }; return e; }
// ultCooldown(hero) multiplies ult.cooldown by every reached cooldownMul before ultHaste (hero.js:29-34)
```

`activateUlt` (`hero.js:143-181`) reads `ultEffect(h)`; `heroUltStatus` adds `rank`; the `ult` event adds `rank`. Ult damage keeps `ultDamageScale` (her damage ÷ base damage), so it grows with every level:

| Hero | Ult | Lv 3 | Lv 10 (rank 2) | Lv 15 | Lv 20 (rank 3) | Lv 25 |
|---|---|---|---|---|---|---|
| Hikari | Celestial Bloom (nova) | 198 dmg, r 4.5, 70 s | 305, r 5.5, 60 s | 568 | 1,336, r 7, 51 s | 4,410 |
| Luna | Moonfall (timeWarp) | slow 50 %, haste ×1.3, 80 s | 6 s / 10 s, 68 s | — | slow 60 %, haste ×1.4, 58 s | — |
| Nami | Tidal Wave (tide, whole map) | 89 dmg, push 5, 60 s | 124, push 6, 51 s | 199 | 440, push 7 + freeze, 43 s | 1,772 |

(Default stats, no gear; `exp/e7-tables.mjs`. Rule 5 moved no damage item across Lv 10, 15, 20 or 25, so r1's figures hold.) Nami's Lv 25 wave (1,772 to every enemy on the map every 43 s) is the strongest late ult; its knob is `ult.effect.damage` (70) in data.

---

## 4. XP, pace and prices

### 4.1 Formulas (`hero.js`, all deterministic)

```js
heroPace(sim)       = totalWaves finite ? min(paceMax, max(1, refWaves / totalWaves)) : 1   // 22 / N, 1..2
waveClearXp(n, k)   = (HERO_XP.waveBase + HERO_XP.wavePer * n * k) * k                     // every cleared wave
passive per step    = HERO_XP.perSecond * k * dt                                           // only while state === 'wave'
damageXp(dealt, e)  = dealt / (e.hpMul > 0 ? e.hpMul : 1) * HERO_XP.perBaseHp              // not paced
xpToReach(L)        = Σ steps[2..L]                     // steps = hero.levelXp ?? HERO_XP_STEPS; Lv 25 = 24,280
heroMastery(h)      = h.level === 25 ? min(masteryMax, floor((xp − xpToReach(25)) / masteryXp) × masteryStep) : 0
price(now)          = ceil5( prices[level-1] × xpLeft/step × diff.costMul × unitStats.costMul )  // min 5; prices = hero.levelPrices ?? HERO_LEVEL_PRICES
```

- `k` uses `sim.totalWaves`, which freeplay keeps as the goal (freeplay SPEC §7, `totalWaves` "untouched"), so waves past the goal keep the stage's pace; endless (`Infinity`) is `k = 1`. Values: 12 waves ×1.83, 14 ×1.57, 15 ×1.47, 16 ×1.38, 18 ×1.22, 20 ×1.10, 22+ ×1.00 (`exp-r2/checks.mjs`); `paceMax` 2 only binds below 11 waves (event or tutorial stages).
- `e.hpMul` exists on every enemy (`enemies.js:99`). `Sim._credit(tower, dealt)` (`Sim.js:374-379`) gains the enemy as a third argument; both callers have it (`_hit` `:310`, `_dot` `:368`).
- Past Lv 25 XP keeps counting up to `xpToReach(25) + masteryXp × 25` (74,280), then stops; Mastery is a damage term added to the growth ModSet. `masteryMax: 0` turns it off.
- Wave XP and passive XP go to **every placed hero** (`sim.heroes`), never to the view-dependent `sim.hero` (§8.3).

### 4.2 Tables

| Lv | XP for the level | Total XP | Price, empty bar | Total coins from Lv 1 |
|---|---|---|---|---|
| 2 | 200 | 200 | 150 | 150 |
| 3 | 260 | 460 | 195 | 345 |
| 4 | 320 | 780 | 240 | 585 |
| 5 | 400 | 1,180 | 300 | 885 |
| 6 | 480 | 1,660 | 360 | 1,245 |
| 7 | 560 | 2,220 | 420 | 1,665 |
| 8 | 640 | 2,860 | 480 | 2,145 |
| 9 | 720 | 3,580 | 540 | 2,685 |
| 10 | 800 | 4,380 | 600 | 3,285 |
| 11 | 860 | 5,240 | 860 | 4,145 |
| 12 | 900 | 6,140 | 900 | 5,045 |
| 13 | 940 | 7,080 | 940 | 5,985 |
| 14 | 980 | 8,060 | 980 | 6,965 |
| 15 | 1,020 | 9,080 | 1,020 | 7,985 |
| 16 | 1,060 | 10,140 | 1,590 | 9,575 |
| 17 | 1,100 | 11,240 | 1,650 | 11,225 |
| 18 | 1,140 | 12,380 | 1,710 | 12,935 |
| 19 | 1,180 | 13,560 | 1,770 | 14,705 |
| 20 | 1,220 | 14,780 | 1,830 | 16,535 |
| 21 | 1,500 | 16,280 | 3,750 | 20,285 |
| 22 | 1,700 | 17,980 | 4,250 | 24,535 |
| 23 | 1,900 | 19,880 | 4,750 | 29,285 |
| 24 | 2,100 | 21,980 | 5,250 | 34,535 |
| 25 | 2,300 | 24,280 | 5,750 | 40,285 |

Why these numbers:
- **Prices ≈ the old paths.** Buying every level from an empty bar (40,285) costs about what the three old paths cost together (Hikari 44,460). Coins per XP rise 0.75 → 1.0 → 1.5 → 2.5 per block of five: early levels are cheap catch-up, tier-5 levels (21–25) are an investment next to a tower's tier 5 (9,000–12,000).
- **What a stage pays** (live bot, total battle coins incl. start cash, `exp/e0-econ.mjs`): 1-1 2.3k · 1-3 3.4k · 1-5 4.8k · 2-5 8.3k · 3-5 8.4k · 4-5 13.8k · 5-5 34k · 6-5 36k · 7-5 30k · 8-5 45k.

### 4.3 The pace, measured (no coins spent; `exp-r2/res/e4-r2.txt`, default F2P hero)

| Stage | Waves | k | Total XP (time / wave / damage) | Lv at wave 5 / 10 / 15 / 20 / 25 | End: live → r1 → **r2** |
|---|---|---|---|---|---|
| 1-1 | 12 | 1.83 | 9,307 (28 / 65 / 7 %) | 7 / 12 / – | 6 → 9 → **15** |
| 1-2 | 14 | 1.57 | 8,751 (21 / 68 / 11 %) | 5 / 10 / – | – → – → **14** |
| 1-3 | 15 | 1.47 | 8,081 (24 / 74 / 2 %) | 5 / 9 / 14 | 6 → 10 → **14** |
| 1-4 | 16 | 1.38 | 10,095 (28 / 59 / 13 %) | 5 / 9 / 14 | – → – → **15** |
| 1-5 | 18 | 1.22 | 13,616 (22 / 43 / 35 %) | 5 / 9 / 14 | 10 → 17 → **19** |
| 2-1 | 18 | 1.22 | 9,598 (27 / 62 / 11 %) | 4 / 8 / 12 | – → – → **15** |
| 2-3 | 20 | 1.10 | 15,442 (22 / 38 / 40 %) | 5 / 8 / 13 / 20 | – → – → **20** |
| 2-5 | 22 | 1.00 | 13,295 (32 / 44 / 24 %) | 5 / 8 / 12 / 16 | 10 → 18 → **18** |
| 3-5 | 25 | 1.00 | 12,750 (25 / 58 / 17 %) | 5 / 8 / 10 / 13 / 18 | 10 → 18 → **18** |
| 4-5 | 26 | 1.00 | 13,081 (18 / 60 / 22 %) | 4 / 7 / 10 / 13 / 17 | 10 → 18 → **18** |
| 5-5 | 28 | 1.00 | 23,855 (21 / 38 / 41 %) | 5 / 8 / 11 / 16 / 21 | 10 → 24 → **24** |
| 6-5 | 28 | 1.00 | 16,223 (28 / 55 / 17 %) | 4 / 8 / 11 / 14 / 18 | 10 → 20 → **20** |
| 7-5 | 30 | 1.00 | 13,099 (19 / 78 / 4 %) | 4 / 7 / 9 / 12 / 15 | 10 → 18 → **18** |
| 8-5 | 30 | 1.00 | 13,985 (20 / 68 / 12 %) | 4 / 7 / 10 / 12 / 15 | 10 → 19 → **19** |

She is Lv 7–9 at mid-stage on every stage (`lvMid` in `res/hr-r2-auto.jsonl`) and keeps growing to the last wave. A first try with `refWaves: 30` (`exp-r2/res/ref30/`) lifted every stage under 30 waves: chapter 1 ended at Lv 16–22, 3-5 / 4-5 / 6-5 at Lv 20 / 20 / 22 instead of 18 / 18 / 20, and 1-3 / 1-5 headroom went to ≥16 / 12.3 (×2.7 / ×3.3 over today). 22 keeps 2-5 to 8-5 exactly as r1 and lifts only the short stages.

### 4.4 Price rules

- `diff.costMul` (difficulty) and gear **Cost Reduction** (`unitStats.costMul`, `progression.js:279`) apply, like tower upgrades. **Cost-cut auras do not** (no feedback loop with Nami's own Lv 24 aura). Today Umeko (up to 25 %), Miko and Nami's Harbor also discount *hero path* upgrades; under the rework they do not discount levels. This is a deliberate nerf to economy builds, said in the tips (Umeko, Miko, Nami: "…cheaper upgrades for girls nearby (not hero levels)") and in `docs/BALANCE.md`.
- The Codex modes' Half Income (#169) halves coins, not prices: buying is relatively dearer there, by design.
- `buyHeroLevel` adds exactly the missing XP (`gainHeroXp(sim, h, xpToReach(level+1) − xp, 'bought')`), so a bought level is indistinguishable from an earned one (the snapshot and the hash only see XP).
- **Stale guard:** `want = { level, maxPrice }`: refused with `reason: 'stale'` if `hero.level + 1 !== want.level` or `price > want.maxPrice`; the UI passes what the button shows, so an L-key repeat or a lagging co-op command can never buy a dearer level than the one on screen.

---

## 5. Power: measured

### 5.1 Why heroes feel pointless today (live bundle, `exp/e1-baseline.mjs`, `e3-battle.mjs`)

| Stage | Hero | Q1 | Q2 | Q3 | End | Panel DPS at the end: hero vs best tower |
|---|---|---|---|---|---|---|
| 2-5 | Nami | Lv 3, 14 % | Lv 6, 42 % | Lv 10, 61 % | Lv 10, 30 % | 15 vs 19 (Sango 0/0/3) |
| 4-5 | Nami | Lv 4, 51 % | Lv 7, 53 % | Lv 10, 36 % | Lv 10, 27 % | 19 vs 70 (Shiro 4/0/0) |
| 6-5 | Nami | Lv 3, 9 % | Lv 7, 22 % | Lv 10, 20 % | Lv 10, 16 % | 24 vs 119 (Shiro 4/0/2) |
| 8-5 | Nami | Lv 5, 32 % | Lv 8, 20 % | Lv 10, 24 % | Lv 10, 14 % | 28 vs 140 (Shiro 4/0/2) |

(Per quarter of the stage: her level and her share of the team's damage. F2P, Normal, the balance bot with ult use.) She caps at Lv 10 around wave 17–20 and stops growing for the last third of every long stage. With the strong roster the towers kill everything near the spawn and her share is 0–2 % on 4-5 and 8-5.

### 5.2 Chapter 1, where the owner will look first

| Stage (Hikari) | Live: end level, share | r1: end level, share | **r2: end level, share** | Headroom live → r1 → **r2** |
|---|---|---|---|---|
| 1-1 | Lv 6, 52 % | Lv 9, 47 % | **Lv 15, 47 %** | 9.21 → ≥8 (r1 cap) → **12.74** |
| 1-3 | Lv 6, 12 % | Lv 10, 6 % | **Lv 14, 7 %** (placed first: **40 %**, live 21 %) | 5.84 → 7.18 → **9.83** |
| 1-5 | Lv 10, 88 % | Lv 17, 92 % | **Lv 19, 93 %** | 3.71 → 7.18 → **9.83** |

On 1-3 the bot's plan gives the best bends to the towers and her spot sees little that is still alive (528 damage at Lv 14); placed first on her own best spot, which is what the armed FREE card at wave 0 invites, she deals **40 % of the team's damage** (live, placed the same way: 21 %; `exp-r2/res/share13.txt`). Headroom: live and r2 from the cap-16 runs of §6.1, r1 from its cap-8 runs.

### 5.3 Crowd and single-target DPS in the real sim (`exp-r2/crowd-bench.mjs`)

r1 compared per-target hero DPS with all-projectile tower DPS (critic point 10). r2 measures **both kinds of unit on the same bench**: stage 4-5, a stationary column of **10 ground enemies along 2 tiles of road** (1e9 HP, no armor), the unit on the nearest valid spot, 20 s of sim, damage dealt ÷ 20. Single target: the same with one enemy. Default stats, no gear; towers at their best main/cross split.

| Unit | Lv 1 | Lv 5 | Lv 10 | Lv 15 | Lv 20 | Lv 25 | Lv 25, single target |
|---|---|---|---|---|---|---|---|
| Hikari | 19 | 33 | 75 | 167 | 809 | **3,944** (1.05× best) | 397 (0.33×) |
| Luna | 29 | 48 | 98 | 225 | 1,028 | **5,009** (1.34×) | 135 (0.11×) |
| Nami | 20 | 31 | 77 | 156 | 381 | **1,552** (0.41×; 1.45× median) | 120 (0.10×) |

Towers on the same bench, crowd: tier 3/2 median 100 (top Kage 210, Akane 166) · 4/2 median 284 (top Kage 654, Shiro 373) · 5/2 median 1,069 (top **Kage 5/2/0 3,749**, Shiro 2/0/5 2,184, Akane 5/0/2 2,110). Single target at 5/2: top **Kage 1,189**, Shiro 716, Kaede 508, median 141 (`res/crowd-bench.md`, `res/single-bench.md`).

Reading: at **Lv 10** (mid-stage) a hero sits at the tier-3/2 tower median on a crowd (75–98 vs 100); at **Lv 20** (late stage, or bought) she is at or above the best tier-4/2 tower (381–1,028 vs Kage 654); at **Lv 25** Hikari matches the best tier-5 tower on a crowd and Luna passes it, while all three stay far below the single-target towers (0.10–0.33× Kage 5/2/0), so towers keep their job against bosses. Nami is a control hero (slow, freeze, Brittle, push, the strongest ult). Every hero keeps her aura and ult on top of these numbers.

**Power guard** (data test, §12): on this bench, Lv 25 crowd DPS ≤ **1.4×** and single-target DPS ≤ **1.0×** the best tier 5/2 tower; Lv 25 crowd ≥ the tier-5/2 median; Lv 20 crowd ≥ the tier-4/2 median; Lv 10 crowd ≥ 0.5× the tier-3/2 median.

### 5.4 In battle (`exp/e3-battle.mjs`, r1, F2P Normal; her share of all damage dealt, level at the last wave)

"Buying" = the bot buys a level when the price is ≤ half its next planned purchase or it can afford both. On long stages r2 equals r1 (`k = 1`; only the counter order differs).

| Stage | Live | New, no buying | New, buying (coins on levels) |
|---|---|---|---|
| 2-5 | 38 % (Lv 10) | 35 % (Lv 18) | **63 %** (Lv 22; 3,765) |
| 4-5 | 32 % (Lv 10) | 46 % (Lv 18) | **59 %** (Lv 22; 6,545) |
| 6-5 | 17 % (Lv 10) | 17 % (Lv 20) | **32 %** (Lv 25; 10,705) |
| 8-5 | 17 % (Lv 10), **lost** | 20 % (Lv 19), lost | **41 %** (Lv 25; 12,045), **won ♥97** |

Strong-roster caveat (`exp/res-e3-strong-hf.txt`): with level-60 ★3 mythic gear on Normal, Kage/Shiro kill everything near the spawn and any unit further down the road deals ~0 %, the hero included. Damage share measures what is left to kill, not strength; §5.3 and §6 are the real measures.

---

## 6. Balance and difficulty

### 6.1 Headroom (`exp-r2/hr.mjs`)

Headroom = the largest multiplier on the stage's enemy HP that the balance bot still wins (Normal, F2P roster at the expected level, seed 1, bracket search 0.25–**16** on a log scale, 7 steps; 16 = the cap). Every cell also says whether the bot **won at ×1** (✓/✗), because the buying bot is not monotonic in HP (critic point 17: Luna's 8-5 run wins at ×1 while the search reports 0.87). Seeds 2 and 3 give the same 3-5 figure as seed 1 (critic's `hrs-auto-*`).

| Stage | Hero | No hero | Live (today) | **r2, no buying** | r2, buying (coins on levels) | r2 no buying ÷ live |
|---|---|---|---|---|---|---|
| 1-1 | Hikari | · | 9.21 ✓ (Lv 6) | **12.74 ✓ (Lv 15)** | 12.74 ✓ (Lv 16; 965) | ×1.38 |
| 1-3 | Hikari | 2.68 ✓ | 5.84 ✓ (Lv 6) | **9.83 ✓ (Lv 14)** | 11.19 ✓ (Lv 14; 745) | ×1.68 |
| 1-5 | Hikari | · | 3.71 ✓ (Lv 10) | **9.83 ✓ (Lv 19)** | 9.51 ✓ (Lv 20; 2,095) | ×2.65 |
| 2-5 | Nami | · | 5.13 ✓ (Lv 10) | **≥16 ✓ (Lv 18)** | ≥16 ✓ (Lv 22; 3,420) | ≥×3.12 |
| 3-5 | Nami | 0.86 ✗ | 2.21 ✓ (Lv 10) | **4.51 ✓ (Lv 18)** | 3.48 ✓ (Lv 20; 2,700) | ×2.04 |
| 4-5 | Nami | 1.49 ✓ | 2.77 ✓ (Lv 10) | **6.44 ✓ (Lv 18)** | 8.35 ✓ (Lv 22; 6,465) | ×2.33 |
| 5-5 | Nami | · | ≥16 ✓ (Lv 10) | **≥16 ✓ (Lv 24)** | 14.99 ✓ (Lv 25; 11,880) | ≥×1.00 |
| 6-5 | Nami | · | 6.44 ✓ (Lv 10) | **≥16 ✓ (Lv 20)** | ≥16 ✓ (Lv 25; 10,690) | ≥×2.48 |
| 7-5 | Nami | · | 4.22 ✓ (Lv 10) | **14.51 ✓ (Lv 18)** | ≥16 ✓ (Lv 23; 9,105) | ×3.44 |
| 8-5 | Nami | 0.56 ✗ | 0.55 ✗ (Lv 10) | **0.71 ✗ (Lv 19)** | **1.54 ✓** (Lv 25; 12,045) | ×1.30 |

What it says:
- **Today's hero matters early and not at all late** (no hero → live: ×2.2 on 1-3, ×2.6 on 3-5, ×1.9 on 4-5, ×1.0 on 8-5). That is the owner's "moderately pointless", measured.
- **The new hero is worth a lot more:** ×1.4 to ×3.4 wherever the cap does not hide it, geometric mean **×2.0** over the 7 measurable stages (r1 reported ×1.7 with an 8 cap that hid the largest gains: 2-5, 6-5 and 7-5 were all "≥8").
- **8-5** stays lost without buying (0.55 → 0.71) and is **won when the bot invests in her** (1.54 ✓, 12,045 coins on levels).
- **Buying is a real choice:** it wins 8-5 and helps 1-3 and 4-5, but costs headroom on 3-5 (4.51 → 3.48) and 1-5, because levels and towers compete for the same coins.

### 6.2 Per hero (`hero` forced; the default rows above are Hikari on chapter 1 and Nami after it)

| Hero | Stage | Live | r2, no buying | r2, buying (coins) | no buying ÷ live |
|---|---|---|---|---|---|
| Hikari | 3-5 | 3.59 ✓ (Lv 10) | 5.48 ✓ (Lv 17) | 6.24 ✓ (Lv 20; 2,750) | ×1.53 |
| Hikari | 4-5 | 1.76 ✓ (Lv 10) | 3.59 ✓ (Lv 17) | 3.71 ✓ (Lv 20; 4,415) | ×2.04 |
| Hikari | 6-5 | 3.15 ✓ (Lv 8) | 7.34 ✓ (Lv 19) | 6.44 ✓ (Lv 25; 16,375) | ×2.33 |
| Hikari | 8-5 | 0.58 ✗ (Lv 9) | 0.73 ✗ (Lv 18) | **1.11 ✓** (Lv 24; 11,780) | ×1.25 |
| Luna | 1-3 | 6.04 ✓ (Lv 8) | 8.35 ✓ (Lv 15) | 10.83 ✓ (Lv 16; 985) | ×1.38 |
| Luna | 3-5 | 0.81 ✗ (Lv 10) | 2.21 ✓ (Lv 18) | 2.13 ✓ (Lv 20; 2,360) | ×2.74 |
| Luna | 4-5 | 2.68 ✓ (Lv 10) | 4.97 ✓ (Lv 18) | 5.66 ✓ (Lv 22; 5,395) | ×1.85 |
| Luna | 6-5 | 4.22 ✓ (Lv 10) | 9.51 ✓ (Lv 22) | 10.49 ✓ (Lv 25; 14,225) | ×2.25 |
| Luna | 8-5 | 0.62 ✗ (Lv 8) | 0.55 ✗ (Lv 18) | 0.83 **✓** (Lv 24; 11,290) | ×0.88 |

All three heroes land in the same band (×1.25–×2.7 on long stages). Luna on 8-5 without buying is the one cell below today (0.62 → 0.55, both lost): today's bot buys her Lances path, the new bot never buys; with buying she wins 8-5 at ×1 (the search reports 0.83 because the buying bot is not monotonic in HP, critic point 17). Nami is the default hero after 1-5, so §6.1 is her table.

### 6.3 What the pace and the free deploy add

| Stage | Live | r2 without the pace (`out-nopace`) | **r2** | End level: live / no pace / r2 |
|---|---|---|---|---|
| 1-1 | 9.21 ✓ | 7.83 ✓ | **12.74 ✓** | 6 / 9 / 15 |
| 1-3 | 5.84 ✓ | 7.34 ✓ | **9.83 ✓** | 6 / 10 / 14 |
| 1-5 | 3.71 ✓ | 7.83 ✓ | **9.83 ✓** | 10 / 17 / 19 |

- **Without the pace, 1-1 is worse than today** (9.21 → 7.83): a Lv 9 track hero is weaker than today's Lv 6 hero with her bought paths. That is critic point 2, measured; the pace fixes it.
- **"Free" alone moves little on Normal** (r1's decomposition, `exp/res-hr-free.jsonl`: today's hero made free ×1.0–1.1 on 3-5, 4-5, 7-5, 8-5); the **long track** and, on short stages, the **pace** do the work. On medal difficulties free placement matters more (§6.4).

### 6.4 Hard and Nightmare medals (`exp-r2/fulltable.mjs`, the `BALANCE=full` replica: `autoPlan`, no ult, no buying, seed 1, all 40 campaign stages)

| Difficulty | Live wins | r1 wins (critic) | **r2 wins** | Newly won on r2 | Lost on r2 | First-clear gems that become reachable |
|---|---|---|---|---|---|---|
| Easy | 40/40 | — | **40/40** | — | — | 0 |
| Normal | 39/40 (8-5 lost) | — | **39/40** (8-5 lost) | — | — | 0 |
| Hard | 30/40 | 36/40 | **36/40** | 2-2, 3-1, 4-4, 4-5, 5-2, 5-3 | — | 6 × 60 = **360** |
| Nightmare | 0/40 (all lost at waves 1–3) | 3/40 | **4/40** | 1-1, 1-2, 1-3, 1-4 | — | 4 × 100 = **400** |

- **760 premium gems** (about 0.6 of a 10-pull at 1,200) become reachable for a free player at the expected level, **once per account and earlier, not in addition**: every medal could always be earned with more levels or gear, and the campaign's one-time medal budget (220 gems × 40 stages, `missions.js:344-350`) does not change. Hard and Nightmare clears also unlock **sweeping** of those stages earlier (`rewards.js:168-173`).
- **Why:** on Nightmare (one life, no income) today's bot loses every stage at waves 1–3 because it cannot afford enough at the start; a free hero is an extra unit at wave 1, and on chapter 1 the pace levels her quickly. On Hard the long track carries the last third of 2-2 … 5-3.
- `BALANCE=full`'s assertion "Nightmare ≤ 35 %" still holds (10 %).
- **Approval:** owner question 2. Fallback if declined: `DIFFICULTIES.hard.heroCost` / `nightmare.heroCost` (data, default 0) put a deploy price back on medal difficulties only; M5 re-runs this table with the chosen value.

### 6.5 What to do about it

- **This spec does not touch stage HP or rewards.** The owner asked for strong heroes; the campaign getting easier is the expected cost.
- **The balance branch (#75, `feature/balance-playtest`) re-runs its calibration after this lands** (it is mid-recalibration anyway). Its WIP lines that this spec supersedes: `HERO_XP_PER_DAMAGE` 1 → 0.4 (`constants.js`, replaced by `HERO_XP`), and the hero `base: stats({ cost` lines (now 0).
- **Knobs, all data, one co-op id bump each:** `HERO_XP` (pace, incl. `refWaves`/`paceMax`), `HERO_GROWTH.damage` (0.03), `HERO_LEVEL_PRICES` (buying), track numbers per level, `ult.effect` damage, `DIFFICULTIES[d].heroCost` (Q2 fallback, default 0), stage `hpScale` (#75's job).

### 6.6 Co-op balance (`exp-r2/e6-coop.mjs`)

Approximation in one Sim: co-op HP (×1.6), both start-cash shares pooled, the union of the two F2P formations (the guest's lost 6th girl is not modelled: an upper bound), seed 1, no buying. Live = the host's hero only; new = both players' heroes (Nami + Hikari).

| Stage | Live, one hero (Lv 10) | r2, two heroes (levels at the end) | r2 ÷ live |
|---|---|---|---|
| 2-5 | 3.19 | ≥ 8 (Nami 17, Hikari 20) | ≥ ×2.5 |
| 4-5 | 1.85 | 5.78 (Nami 18, Hikari 16) | ×3.12 |
| 8-5 | 0.33 | 0.51 (Nami 19, Hikari 18) | ×1.54 |

(Cap 8, 6 steps, as r1's co-op runs, so the two are comparable; r1 gave ≥×2.5 / ×2.95 / ×1.54.) Co-op gets easier than solo does, because the second hero is new power on top of the track.

Default: keep `COOP.hpMul` 1.6 and re-measure in M5 with freeplay's bot (`hpBands`); if co-op should stay exactly as hard relative to solo as today, the starting point is `COOP.hpMul` ≈ 1.9 (data, `src/data/coop.js:7`).

---

## 7. Sim changes (all in the co-op graph)

| File | Function / line | Change |
|---|---|---|
| `src/data/heroTracks.js` (**new**) | — | §3.1. Pure data, frozen. |
| `src/data/units.js` | `HIKARI` / `LUNA` / `NAMI` (`:77-165`, `:167-252`, `:254-339`) | `base.cost: 0`; `paths: []`; `hero: { levels, pathKeys, ult: { …, ranks } }` from `HERO_TRACKS`; drop `levelXp`. Header comment (`:15`) updated. Tips: "Sanctuary turns her into a holy banner" → **"From Lv 9 her aura cleanses sabotage; at Lv 19 it becomes a holy banner."**; cost-cut tips per §4.4. |
| `src/data/types.js` | `BATTLE.maxHeroLevel` (`:277`) | 10 → 25 (the only cap constant). `DIFFICULTIES[d].heroCost` (**new**, optional, default 0; Q2 fallback). |
| `src/sim/constants.js` | `HERO_XP_PER_DAMAGE`, `heroWaveXp` (`:68-72`) | Removed (moved to `HERO_XP`). `ULT_INITIAL_CHARGE` stays. |
| `src/sim/mods.js` | `collectModSets` (`:184-200`), `resolveStats` (`:228`) | 5th arg / option `heroMastery` (default 0). After the hero levels: `if (heroLevel > 1) sets.push({ damageMul: 1 + g.damage × (heroLevel − 1) + heroMastery, rateMul: 1 + g.rate × (heroLevel − 1) })`, `g = def.hero.growth ?? HERO_GROWTH`. Order stays paths → hero levels (+growth) → awaken → Potential (#165). |
| `src/sim/towers.js` | `refreshTowerStats` (`:98`) | passes `heroMastery: t.isHero ? t.mastery : 0`. |
| | `updateTower` (`:611-615`) | after the `disabled` check: `if (t.moveLock > 0) return;` (she is repositioning). |
| `src/sim/hero.js` | `xpToReach` (`:14-19`) | Steps from `heroDef.levelXp ?? HERO_XP_STEPS`. |
| | **new** `heroPace(sim)`, `waveClearXp(n, k)`, `damageXp(dealt, e)`, `heroMastery(h)` | §4.1. |
| | `gainHeroXp` (`:58-71`) | 4th arg `src` (`'time'|'wave'|'damage'|'bought'|'restore'`), counted in `sim.stats.heroXp[src]`; at Lv 25 the XP feeds Mastery (`heroMastery` event `{ towerUid, bonus }` + refresh when the step changes), capped at 74,280. |
| | **new** `ultRank`, `ultEffect`; `ultCooldown` (`:29-34`) applies rank `cooldownMul` | §3.3. |
| | `initHero` (`:46-52`) | Adds `levelSpent = 0`, `levelsBought = 0`, `mastery = 0`, `moveCd = 0`, `moveLock = 0`. |
| | `tickHero` (`:82-86`) | Loops `sim.heroes`: `moveCd`/`moveLock` count down in any state; passive XP (`× k`, `'time'`) and ult charge only in `'wave'`. |
| | **new** `heroLevelStatus(sim, hero, want)` → `{ level, max, price, xpLeft, reason: null|'noHero'|'max'|'ended'|'stale'|'cash' }`; `buyHeroLevel(sim, hero, want)` → `{ ok, reason, price }` | §4. Spends with `sim._spend`, adds `levelSpent`, `levelsBought`, `stats.heroLevelsBought`, emits `heroBuy { towerUid, level, price }`. |
| | **new** `canMoveHero(sim, x, y, hero)` → `{ ok, reason: null|'noHero'|'ended'|'cooldown'|'same'|<placement reason>, downtime }`; `moveHero(sim, x, y, hero)` | `placement.check(def, x, y, towers without her)`; `sim._relocate(h, x, y)`; in `'wave'`: `moveLock = 3`, `moveCd = 15`; emits `heroMove { towerUid, x, y, fromX, fromY, downtime }`. |
| | `activateUlt` (`:143-181`) | `ultEffect(h)`; event `ult` gains `rank`. Freeplay's `pushBack` Resolve clip (`wt-freeplay` `hero.js:132-135`) is untouched — edit around it, never rewrite the file. |
| `src/sim/Sim.js` | constructor (`:47`, `:65-75`, `:95`) | Accepts `heroes: [{unitId, stats}|null × ≤2]` (co-op) besides `hero`. `heroConfigs[i] = { unitId, stats, index: i }`, `heroConfig = heroConfigs[0]`, `heroes = [null…]`, `_stepping = false`. `this.hero = null` (`:95`) is removed. |
| | **new** getters `hero`, `heroConfig` (+ setter backed by `_heroConfig`) | `hero` = `heroes[heroConfig.index]`. **View trap:** while `_stepping`, both getters throw when `globalThis.__SIM_VIEW_TRAP__` is set (vitest setup file sets it; production never does). |
| | `_step` (`:149`) | `_stepping = true` in `try/finally` around the existing body (renamed `_step1`). |
| | `_credit` (`:374-379`) + callers `:310`, `:368` | `(tower, dealt, e)`; hero XP `damageXp(dealt, e)`. |
| | `_checkWaveEnd` (`:462`) | `const k = heroPace(this); for (const h of this.heroes) if (h && !h.removed) gainHeroXp(this, h, waveClearXp(this.wave, k), 'wave')`. |
| | `placeCost` (`:498-511`) | `if (!(baseCost(def) > 0)) return 0;` before the rounding (plus `DIFFICULTIES[d].heroCost` for heroes when Q2 asks for it). |
| | `placeTower` (`:589`) | `t.heroIndex = heroConfig.index; heroes[t.heroIndex] = t`. |
| | **new** `canSell(uid)` → `{ ok, reason: null|'none'|'hero'|'ended' }` | |
| | `sellTower` (`:676-691`) | `if (t && t.isHero) return false;` first (no refund, no `sell` event); the `this.hero === t` line (`:686`) is deleted. Unknown uid / ended keep returning 0. |
| | **new** `_relocate(t, x, y)` | Sets `x, y, tx, ty`; clears `trapSpots`, `targetUid`, `rampTarget`, `rampStacks`; shifts drones by the move; `_buffsDirty` + `recomputeBuffs`. Codex modes adds `assignPads(this)` here, roster B3 adds `updateRelayOrigin(this, t)` here (§11): one place for every position-derived field. |
| | **new** `heroLevelStatus(want)`, `buyHeroLevel(want)`, `canMoveHero(x, y)`, `moveHero(x, y)` | Wrappers on the active hero. |
| | `towerStats` (`:713-714`) | Adds `heroLevel: heroLevelStatus(this, t)`, `ultRank`, `mastery`. |
| | `upgradeStatus` (`:638-651`) | Unchanged: with `paths: []` it returns `reason: 'max'` for heroes. |
| | `result()` (`:813`) | `heroLevel` (active hero) plus `heroLevels: heroes.map(lv)`; per-hero `heroes: [{ unitId, level, levelsBought, levelSpent }]` for the results screen. |
| `src/sim/headless.js` | `sell` action (`:38-42`) | `return sim.sellTower(t.uid) === false ? 'fail' : 'done'`. Optional plan action `{ action: 'heroLevel' }` for balance scripts. |
| `src/sim/report.js` | `capabilitySources` (`:59-92`) | For heroes, scan `hero.levels` for the first level that grants the capability: `{ unitId, path: null, tier: 0, heroLevel: 9 }`; `helpText` → **"Hikari at Lv 9"**. The scout UI appends the live price (§10.4). |

**Determinism:** no `Math.pow/exp/log/**` anywhere (`HERO_GROWTH` additive, the pace is one division and a clamp, Mastery uses `Math.floor`, the rank merge is object spread). The r2 prototype hashes match across V8 and JSC (§8.4).

**Golden:** a battle without a hero is bit-identical on the live and the r2 bundles (1-3, 4-5 and 8-5: same `hashSim` computed with the live hash function, same lives, cash and tick count; `exp-r2/golden.mjs`, `res/golden.txt`). The r2 `hashSim` itself differs only because it now also folds each tower's level and XP.

**Co-op id:** changes `src/sim/{Sim,hero,mods,towers,constants}.js`, `src/data/{units,types}.js`, adds `src/data/heroTracks.js`, and the co-op files of §8. `SIM_ID` and the data hash (`version.js:38`, `UNITS` embeds the tracks) change. Deliberate.

---

## 8. Co-op: each player brings her hero

### 8.1 Behaviour

- Lobby text (`screens/coop.js:287`): **"You bring your formation: your hero and 5 girls each. Drops go to both; medals stay solo."**
- Each player's hero card is in **her own** bar (built from the local view, `towerBar.js:18`). Both heroes are on the field; tapping the ally's hero opens her panel with the ally note (`towerPanel.js:211-215`) and no Level up / Move buttons.
- Each hero levels on her own (time and waves for both; damage XP for her own hits). Each player buys her hero's levels from her wallet and fires her own ult — the "Only the host commands the hero" toast (`controller.js:295`) is removed.
- Two players may bring the same hero (both Hikari): heroes are keyed by player index, not unit id.
- **Feed attribution** (`controller.js:446-455`): `heroLevel`, `heroBuy`, `heroMastery` and `ult` resolve their hero by `sim.getTower(ev.towerUid)`, never `sim.hero`. Your hero: full toast / banner as in §2.1. The ally's hero: one small chip, at most one per 3 s, **"Rin's Luna Lv 8"** / **"Rin's Luna: Moonfall!"**.
- **Results:** per hero from her own `levelsBought` / `levelSpent` (`result().heroes`); the line shows your hero only. `sim.stats.heroXp` and `stats.heroLevelsBought` stay battle-wide (balance scripts).

### 8.2 Code

| File | Change |
|---|---|
| `src/online/coop/loadout.js` (`:16-23`) | `count = COOP.towersPerPlayer + (hero ? 0 : 1)` for both; `hero` for both. Header comment updated. |
| `src/data/coop.js` (`:29`) | Comment: "Towers per player (each also brings her hero; a player without one gets one more tower)". |
| `src/online/coop/session.js` (`:616-617`) | `start.players[1].hero = s.peer.hero || null`. |
| `src/online/coop/commands.js` | `new Sim({ …, heroes: players.map((p) => p.hero || null) })` (`:70`); `views[i].heroConfig = sim.heroConfigs[i]` (`:73-81`); `KINDS += 'hlv', 'hmv'` (`:21`); **`hlv[level, maxPrice]`** (two integers) → `sim.buyHeroLevel({ level, maxPrice })` under the slot's view, result `{ ok, price }` or `{ ok: false, reason }` with the real reason (`noHero`, `max`, `ended`, `stale`, `cash`); **`hmv[qx, qy]`** → `sim.moveHero(qx/Q, qy/Q)`, reason from `canMoveHero`; `sell` of a hero → `{ ok: false, reason: 'hero' }` via `sim.canSell` **without** deleting the owner entry (today `:149` would drop it). `ult` (`:159-161`) works for both players unchanged. |
| `src/online/coop/simHash.js` (`:46`) | Per tower also `.int(t.level).int(t.xp * 16)` (desync shows at the first level difference). |
| `src/online/coop/version.js` (`:20`) | `COOP_PROTOCOL` +1 (start message shape, new commands). Bundle with freeplay's / codex modes' bump if they ship together. |
| `src/ui/battle/controller.js` (`coopActions`) | `levelUp: () => { const st = sim.heroLevelStatus(); ls.queue('hlv', [st.level + 1, st.price]); }` and `moveHero: (x, y) => ls.queue('hmv', quantize(x, y))`; a `stale` result toasts **"She levelled up first — tap again for Lv 9."**; `cooldown` toasts **"Move recharging · 12s"**. |

### 8.3 Who reads `sim.hero`

The getter follows the view: at rest it is the local player's hero (HUD, widget, panel — correct per client); during `apply(cmd)` it is the commanding player's (place, ult, level, move — correct). `tickHero`, `_checkWaveEnd` and `_credit` use `sim.heroes` / the tower. Three guards keep it that way:
1. **Runtime trap** (§7): any read of `sim.hero` or `sim.heroConfig` inside the step throws under tests. The r2 prototype ran its co-op battle with the trap on (no throw), and a check confirms the trap fires (`exp-r2/checks.mjs`).
2. **Source test** (`tests/sim/viewRule.test.js`): greps `src/sim/**` and `src/online/coop/commands.js` for `\.hero\b` and `\.heroConfig\b` outside an allow-list (Sim getters and command methods, `hero.js` command functions `heroLevelStatus`/`buyHeroLevel`/`canMoveHero`/`moveHero`/`heroUltStatus`/`activateUlt`, `report.js` scouting, `headless.js`). Codex modes (Festival Encore in `_checkWaveEnd`), B3 ult buffs and freeplay hooks are covered by both.
3. **Two-view lockstep test** (§12): the same command log as slot 0 and slot 1, equal hashes.

### 8.4 Measured

`exp-r2/det.mjs`: 2-5 co-op, both players bring Hikari, auto-start on, every `hlv` carries the level and price its player saw **270 ticks (4.5 s) earlier** (the critic's worst case: 0.5 s delay, adaptive ×3, at 3× speed), 7 `hmv` (1 in prep, 6 during waves with the downtime; with auto-start the between-wave window is 1 s, so a real player's moves land mostly in waves too), 80 `ult`, upgrades, a refused hero `sell`, the view trap on, through wave 16 (238 hashes, every 120 ticks): **digest `a5769346` for view 0 and view 1, in Node 22 and Bun 1.3.14**. Of 38 `hlv`: 22 bought, **3 refused `stale`** (she had levelled before the command landed; nothing spent), 13 `cash`; all 7 moves applied; the sell was refused with `hero`. (r1's run, `6256d586`, had no moves and no stale guard.)

---

## 9. Saves

### 9.1 Profile

No new field, no `SAVE_VERSION` bump (live `save.js:13` = 2; roster's 3 is unaffected). Formation still holds one hero (`save.js:378-385`). A player's hero account level (1–60, gear, awakening) still feeds `unitBattleStats` (`progression.js:265-286`) and multiplies on top of the track.

### 9.2 Battle save (#170, `wt-battlesave`, solo only)

- **Snapshot** (`snapshot.js:102-105`) already carries `xp, lvl, ultOn, ult` for a hero; add `ls` (`levelSpent`), `lb` (`levelsBought`), `mc` (`moveCd`; `moveLock` is always 0 between waves). Mastery is derived from XP.
- **Restore** (`:186-193`): for a hero, skip the tier loop entirely (heroes have no tiers) and never call `sellTower` on her; `gainHeroXp(sim, t, o.xp, 'restore')`; set `levelSpent`, `levelsBought`, `moveCd`. Placement is free, so `t.spent` stays 0.
- **Key tables** (`:40-64`): `KNOWN_SIM_KEYS` remove `hero` and `heroConfig` (now prototype getters), add `heroes: 'snap'` (rebuilt by the tower restore), `heroConfigs: 'config'`, `_heroConfig: 'config'`, `_stepping: 'scratch'`. `KNOWN_TOWER_KEYS` add `levelSpent: 'snap'`, `levelsBought: 'snap'`, `moveCd: 'snap'`, `moveLock: 'calm'`, `mastery: 'derived'`, `heroIndex: 'config'`. The key guard test fails until this is done — that is its job.
- A level bought during the interrupted wave is undone with that wave (coins come back with the snapshot), like any purchase.

### 9.3 Snapshots from before the rework (critic point 4)

If #170 ships **before** the rework, live players can hold a `SNAP_V 1` snapshot with an old-scale hero. The rework release then bumps **`SNAP_V` 1 → 2** (`battleSave.js:17`) and `restoreSim` migrates a v1 hero:
- **Tiers are ignored** (no `upgradeTower`, no `sellTower`, she is never dropped).
- **Level, not XP:** old XP (1 per HP, old steps summing to 9,680 for Lv 10) would land on a wrong level (old Lv 10 → new Lv 15). She is restored at `xpToReach(min(25, o.lvl))`, bar empty.
- **Refund everything she cost:** `refunded += o.spent` (placement + tiers). The critic proposed refunding only the tier part (`spent − old base cost × costMul`); the new build cannot compute that (her `base.cost` is 0 in the new data) and under the new rules the placement would have been free too, so the whole `spent` comes back. Toast: **"Heroes changed: Hikari keeps Lv 7 and her upgrades came back as 1,240 coins."**
- Her ult state (`ultOn`, `ult`) is restored as saved.
If the rework ships **first**, #170's first release already writes the new format and no migration is needed (the bump is then not required). Whichever lands second owns this; M4's "done when" includes the fixture test.

### 9.4 Freeplay checkpoints (critic point 8)

Freeplay M6's wave-boundary checkpoints (freeplay SPEC §M6: "towers, hero, wallets…") must carry, per hero: `heroIndex`, `level`, `xp` (Mastery follows), `levelSpent`, `levelsBought`, `ultUnlocked`, `ultCooldown`, `moveCd`, and the Sim's `heroes[]` (rebuilt from the towers). It reuses §9.2's snapshot code paths so the two lists cannot drift.

---

## 10. UI (phone 844×390, PC 1280×720)

All copy below is exact. Test ids in `code`. Line numbers are on live `ffc4d23`.

### 10.1 Tower bar hero card (`towerBar.js:24-47`, `:100-117`; `battle.css:173-174`)

- Price slot shows **FREE** (`span.bt-card-cost.bt-free`, mint background) instead of the coin icon and price; `bt-poor` never applies.
- Wave 0, not deployed: the card pulses (`bt-card-hero-arm`) and is armed on load (`placement.start(heroId)`, as `ctx.onCardTap` does). Not in the coached tutorial battle and not in co-op until the room's first tick.
- Deployed: **Deployed · Lv 7** (`span.bt-card-deployed`); tapping selects her (`placement.js:64-66`).
- Sizes unchanged: 82 px wide on PC, 72 (≤ 700 px) / 64 (short landscape) on phones.

### 10.2 Hero widget (`heroWidget.js`, `battle.css:215-238`)

Row, bottom-left above the bar: **[portrait 66 px (54 on phones) with "Lv 7" badge and XP bar] [ult 58 px (48)] [Level up pill]**.
- **Level up pill** (`button.bt-herow-lvup`, `hero-levelup-quick`): 96×34 px on PC, 80×30 on phones (short-landscape query `battle.css:547-582`). Two lines: small **LV UP** over **🪙 480**. Yellow when affordable, grey (`.poor`) when not; tap when grey → **"Need 140 more coins."** Hidden when not deployed, at Lv 25, and after the battle ends. Row width 232 px PC / 198 px phone, clear of the wave control on both.
- **Price refresh:** the shown price (and the panel button's) is re-read at most **twice a second** (`PRICE_TICK = 0.5 s` in the widget; the panel's `signature()` uses the price rounded to that tick), so passive XP does not repaint the panel every frame on phones. A tap always sends the price on screen as `maxPrice`, so a slightly old figure can only make the buy refuse, never overcharge.
- Badge reads **MAX** at Lv 25 (**MAX · +7 %** with Mastery); XP bar full (Mastery: a thin gold bar fills per 2,000 XP).
- Co-op: the widget is always the local player's hero. Hidden on phones while a panel is open (`battle.css:520`); the panel has its own button.

### 10.3 Hero panel (`towerPanel.js`)

Header: **Hikari** · **Lv 7** (as today). The hero block (`:102-130`) is rebuilt:

```
[Lv 7] [=======XP=====-----] 380 / 640 XP
[ ▲ Level up · 🪙 300 ]                        (bt-buy style, hero-levelup)
Next: Lv 8 · Wide Arc: 2 more targets per sweep, +0.2 range; ignores 2 armor.
Then: Lv 9 · Shared Light: aura +5% attack speed and cleanses sabotage and stuns.   Lv 10 · Skyward Radiance … · Celestial Bloom rank 2
[Full track ▾]                                   (hero-track-toggle → all 25 rows, reached ones ticked)
Celestial Bloom · Rank 1        [ Activate! ]
A sun blooms around Hikari … (rank 2 at Lv 10)
```

- **No "Upgrades" section** for heroes (`:223` and the tier list skipped when `def.paths.length === 0`).
- Stats grid as today plus **Level bonus +18 % damage** (growth; with Mastery "+18 % · Mastery +7 %") in `.bt-stat-wide2`, and when gear Cost Reduction applies **"Level prices −8 %"** (the line that reads "Upgrades … cheaper" for towers, `:168`).
- Footer (`:202-209`): instead of Sell, **Move** (`hero-move`): in prep/between **Move**; in a wave **Move · pauses 3s**; recharging **Move · 12s** (disabled). Tap → placement mode with her ghost; drop → `ctx.act.moveHero`. "Invested" reads **Levels bought 1,240**.
- `signature()` (`:44-49`) adds level, the price bucket, the reason and the move state.
- Phone (bottom sheet) and PC (right card) layouts are the existing ones; the block is ~150 px tall collapsed; the full track scrolls inside `.bt-panel-scroll`.

### 10.4 Feed, banners, audio, keys, scouting

- Level-up toasts (§2.1), text from the level's `desc`; several level-ups in one frame (a buy, a big kill) → one toast for the highest level. Tier-5 levels (`from` ends in `.5`) and ult ranks use `feed.announce` (banner). Attribution by `towerUid` (§8.1).
- `heroBuy` → coin fx on her and `ui.confirm`; `heroMove` → the renderer drops her view so the sync recreates it at the new spot (`actors.sync`, `actors.js:179-195`) + a puff at both spots; during a wave a small "…" bubble over her for the 3 s downtime.
- Audio `hero.level` (`audio/battle.js:115-117`): at most one per 400 ms.
- PC keys (`controller.js:351-366`): **Q** fires the ult, **L** buys a level (sends the shown level and price, so a held key cannot overshoot). (Unit-info WIP uses **T**.)
- **Scout warnings** (the wave-warning builder in `report.js` → UI): for a hero source the help text is **"Hikari at Lv 9 · Level up now 🪙 2,340"** (price of all levels from her current one to that level, computed in the UI from `heroLevelStatus` + the table), or **"Hikari (Lv 9 ✓)"** once reached.

### 10.5 Outside battle

- **Student page** (`student.js`): the info row **Deploy cost** (`:171`) shows **Free** for heroes (not "0 → 0"); `heroSection` (`:355`): title **Hero**; ult block with **Rank 2 at Lv 10 · Rank 3 at Lv 20**; list **Battle levels (1–25)** with all 25 rows (`desc`, and the small "from Radiant Edge T3" source line); footer **"Heroes deploy for free and level up inside each battle — from time in the wave, waves cleared and the damage they deal. Buy the next level with battle coins any time. One hero per player."** The **Tree** tab (`:700-729`) shows the track instead of path columns when `unit.kind === 'hero'`. Gear Cost Reduction on a hero reads **"Level prices −X %"**.
- **Formation** (`formation.js`): the picker cost (`:203`) shows **Free** for heroes; the deploy total (`:114`) skips heroes; hero slot caption **"Hero · free in battle"**.
- **Unit info / upgrade tree WIP** (`wt-unit-info` `treeModel.js:71-81`): already models `hero.levels` with `reached`; add `ranks` and the price of the next level in battle.
- **Wiki** (`wiki.js:329`): "Heroes use the same scaling; they were toned down so a hero supports your team rather than carrying it." → **"Heroes deploy for free and grow from Lv 1 to 25 during each battle. Early on she is one more defender on the field; by the last waves she is your strongest."** Controls row (`:155`): add **Level up · Level up pill next to the hero portrait · L** and **Move hero · Move in her panel · —**.
- **Tutorial (story WIP, `wt-story` `tutorial.js:18-21`, `coachSteps.js:113`)**: the `hero` step still works (cost 0 → the gate opens between waves); the body already fits ("I grow stronger with every wave!"). Optional new step `herolevel` after `upgrade`: **"Tap me, then Level up — I'll learn something new every level!"** (target `hero-levelup`).
- **Co-op room** (`screens/coop.js:392`): both players' hero chips show.

### 10.6 Screens to screenshot (e2e, both viewports)

Wave 0 with the FREE card armed; the widget with the pill (affordable, poor, MAX · Mastery); the hero panel collapsed and with the full track; a tier-5 banner; Move in prep and in a wave (downtime bubble, recharge label); the student page Hero section with **Deploy cost Free**; the formation picker; co-op with two heroes and an ally chip.

---

## 11. Interplay with in-flight work

| Work | Interaction | What to do |
|---|---|---|
| **Co-op freeplay** (`wt-freeplay`, protocol 3) | Past the goal `k` stays the stage's (totalWaves = goal); heroes reach Lv 25 around goal + 10–15 and then grow by **Mastery** (+1 % per 2,000 XP, +25 % at most; from the XP tables, the cap comes about 50 waves past the goal on 8-5, an estimate the M5 bot run replaces). Freeplay's Resolve clips hero `pushBack` (keep their lines in `hero.js`). Their calibration used one hero bought with coins and a bot that never fired the ult. M6 checkpoints carry the §9.4 fields. | Re-run freeplay's `bot.mjs` (Blossom strong 1-3 / 8-5) **with ults on for both heroes** once M2 lands; retune `hpBands` (data) if death waves move by > 10. Bundle `COOP_PROTOCOL` bumps. |
| **Battle save** (`wt-battlesave`, outside the graph) | §9.2–9.3: key tables, three fields, hero restore without tiers/sell, `SNAP_V` 2 + v1 migration if #170 ships first. | Whichever lands second does it (the key guard and the v1 fixture force it). |
| **Roster B3** (`wt-roster`, Kanna/Yoriko/Seiran, `strike` ult, aimed nova, `dmgBuff`, `PUSH_LOCK`, `globalDmgMul`, relay) | B3 is still writing its three heroes with `paths`; the rework removes hero paths. Rule 1 (one attack per hero) would strip behaviour tiers (aim, mortar) from a flattened path. `_onHitEffects` knockback is edited by freeplay (Resolve), B3 (`PUSH_LOCK`) and this spec (Nami relies on `PUSH_LOCK`). Relay origin is position-derived. | **Ask B3 to write `HERO_TRACKS` entries (levels + ult ranks) directly** for its three heroes, using `tools/heroTrack.mjs` only as a draft; behaviour tiers become innate (Lv 1) or a track level. **Owner of `_onHitEffects`: roster B3** (it introduces `PUSH_LOCK`); merge order **B3 → freeplay Resolve → rework**; if the rework lands before B3 it carries B3's `PUSH_LOCK` lines verbatim and B3 rebases onto them. B3 adds `updateRelayOrigin` to `_relocate`. |
| **Balance playtest** (`feature/balance-playtest`) | Supersedes its `HERO_XP_PER_DAMAGE` 0.4 and hero cost lines; its stage HP calibration must be redone after this. | §6.5. |
| **Codex modes** (#169) | Festival Encore resets `hero.ultCooldown` in `_checkWaveEnd` → loop `sim.heroes` (the view trap would throw otherwise). Prism pads are position-derived. Half Income makes levels dearer (fine). | One line in `_checkWaveEnd`; `assignPads(this)` inside `_relocate`; its `padIndex/onPad/padMul/padRangeAdd` keys stay `derived`. |
| **Potential** (#165) | Hero Potential ModSets go after hero levels + growth (+ Mastery); unchanged order. Its P6 names "Silver Thread" (Luna) and "Riptide" (Nami) are live tier names that the track keeps. Its golden test (`resolveStats` × `heroLevel {0,1,10}`) must be re-snapshotted after whichever lands first. | Potential renames its P6s (suggested **"Moonlit Resolve"**, **"Spring Tide"**); landing order **rework → Potential** (Potential is scheduled after co-op and freeplay anyway); if Potential lands first, the rework re-snapshots its golden. |
| **Attack FX** (`wt-attack-fx`, render-only) | Looks key on `t.tiers` (`flair.js` `tierLook`/`lookAt`), which stay `[0,0,0]` for a track hero: Hikari's second arc (P0 T5), motes/banner (P1 T3/T4) and lances (P2 T4), Luna's swirl (P1 T3), Nami's ice (P0 T3) and swirl (P1 T3) would never show. `tierLook` allows one look path; a Lv 25 hero has three tier-5s. Hero `intensity()` is uncapped (1.96 at Lv 25). | **New pure `heroLookTiers(def, level)`** (in `hero.js`; per path, the highest tier among reached levels' `from`, mapped by `pathKeys`; `also` is ignored; Hikari Lv 9 → [2,2,1], Lv 10 → [2,2,3], Lv 15 → [3,3,3], Lv 22 → [5,4,4], Lv 25 → [5,5,5]); `attackFx/index.js refreshLook` feeds it to `tierLook(tiers, out, { multi: t.isHero })`; with `multi`, `lookAt(lk, i)` returns each path's tier ≥ 3 (several looks and capstones at once); hero intensity `min(1.6, 1 + 0.04 × (L − 1))`; `tierKey` already includes the hero level. Unit test at Lv 9, 15, 22, 25 (looks + intensity ≤ 1.6). |
| **Solo freeplay** (#174, cloud branch `feature/solo-freeplay` off coop-freeplay) | "Keep going" past the goal in solo: same rules as co-op freeplay here (`totalWaves` stays the goal, so the pace holds; Mastery past Lv 25); its checkpoint/continue uses §9.2's snapshot fields. | Nothing extra; reuse §9.4's field list. |
| **Sandbox** (#175, `feature/sandbox`) | 999,999 coins: a hero can be bought to Lv 25 at once; no rewards, so no economy effect. | Show the Level up pill as usual; optional "Set level" control is a sandbox feature, not this spec's. |
| **Unit info** (`wt-unit-info`) | §10.5. | `treeModel` ranks + price. |
| **Story / tutorial** (`wt-story`) | §10.5. | Optional `herolevel` step. |

---

## 12. Tests

| Level | Test |
|---|---|
| **Data** `tests/data/units.test.js` (`:497-556`) | Replace "HeroDef is complete" with: 25 `levels` (1..25, `desc` > 5 chars, valid ModSets), `from` covers every old tier ref `<path>.<1..5>` and milestones `L2..L10` exactly once (a frozen list per hero), `also` refs point to a later level's `from`; `pathKeys` length 3; `ult.ranks` levels ascending in (3, 25], `cooldownMul` in (0, 1], rank effects valid for their ult type; `paths` empty; `base.cost === 0`; `levelXp` present ⇒ `levelPrices` present (24 each). `HERO_XP_STEPS`/`HERO_LEVEL_PRICES` length 24, positive, non-decreasing. **Rule 5:** for each capability in `pathCapabilities` (via `report.js` `CAP_TESTS`), the first granting level is ≤ 10 or its price from Lv 1 ≤ 1.5× a frozen table of the old cheapest tier costs (T5-only entries exempt). **Lv 25 frozen snapshot:** `resolveStats(hero, { heroLevel: 25 })` deep-equals a frozen object (catches accidental power changes when levels move). Replace `units.test.js:469-474` (hero `base.cost` 450–650) with `base.cost === 0`. Replace "heroes are nerfed: level 10 ≈ tier-4" with the frozen crowd/single numbers of §5.3 (±5 %), the live bench being in `BALANCE=hero`. |
| **Sim** `tests/sim/hero.test.js` | XP: `waveClearXp(5, 1) = 150`; `heroPace` = 1.83 / 1.38 / 1 for 12 / 16 / 22-wave stages, 2 for a 10-wave stage and 1 for endless; passive 4 × k XP/s only during waves; damage XP = dealt ÷ `e.hpMul` × 0.4 (same XP on a ×1 and a ×6.5 stage for the same base-HP kill). Levels: 25 cap, `heroLevel` events once per level, refresh on level. **Mastery:** +1 % per 2,000 XP past Lv 25, cap +25 %, one `heroMastery` event per step, XP capped at 74,280. Buying: price at empty bar = table × `diff.costMul` × `costMul`, price falls with XP, `cash` reason, refused when `won`/`lost`, emits `heroBuy`, adds exactly the missing XP; **stale:** status at Lv L, a wave clear levels her, `buyHeroLevel({ level: L+1, maxPrice })` → `stale`, no coins spent; price above `maxPrice` → `stale`. Free: `placeCost(hero) === 0`, `canPlace` with 0 cash ok. **Sell:** `canSell(hero)` → `{ ok: false, reason: 'hero' }`, `sellTower(hero) === false`, she stays, no `sell` event; unknown uid → 0. Growth: Lv 25 damage = track sum × (1 + 24 × 0.03). Ult ranks: cooldown × 0.85 at Lv 10, radius 5.5 / 7, `heroUltStatus().rank`. **Move:** prep/between → instant, no lock; wave → `moveLock` 3 (she does not attack: `damageDealt` flat for 3 s), `moveCd` 15, second move → `cooldown`; validates terrain/overlap ignoring herself; keeps level/XP/cooldown; `_relocate` clears `trapSpots`/target and refreshes auras (a buffed girl in her old aura loses it, one in the new aura gains it); emits `heroMove`. Fixture heroes (`heroine`, `warper`, `tider`) gain `cost: 0`, `paths: []`, 25-level `levels` (one keeps 10 levels + `levelXp` + `levelPrices` to exercise the override). |
| **Sim, two heroes** `tests/sim/heroes.test.js` (new) | `new Sim({ heroes: [a, b] })`: `heroConfigs` indices, placing hero 0 then switching `heroConfig` to 1 places hero 1, both get wave/passive XP, `sim.hero` follows `heroConfig`, `heroPlaced` per index, two Hikaris allowed. **View trap:** with `__SIM_VIEW_TRAP__` on, a 10-wave two-hero battle with ults, buys and moves never throws; setting `_stepping` and reading `sim.hero` throws. |
| **Source** `tests/sim/viewRule.test.js` (new) | The §8.3 allow-list grep. |
| **Co-op** `tests/online/lockstep.test.js` | `START.players[1].hero` set (both Hikari): equal hashes for both clients through 10 waves with `hlv`, `ult` and `hmv` (between and during waves) from both slots, auto-start on and a partner `wave` start racing a `hmv`; **a wave clear lands between queue and apply → `hlv` refused `stale`, wallet unchanged**; `hlv` with no coins → `cash`; a hero `sell` → `{ ok: false, reason: 'hero' }` and `ownerOf` unchanged; the guest's ult fires the guest's hero; reasons pass through (`max`, `ended`, `noHero`). `pickLoadout`: both bring hero + 5. `COOP_PROTOCOL` bumped. |
| **Engines** `e2e/engines.mjs` + `e2e/engines/scriptedBattle.js` | The `exp-r2/det.mjs` scenario (2-5, two heroes, `hlv` 4.5 s late, `hmv` in prep and waves, `ult`, to wave 16): one digest in V8, JSC and SpiderMonkey (prototype `a5769346`, V8 = JSC). |
| **Battle save** (`tests/battle-ui/snapshot.test.js`, after #170) | Round trip with a Lv 12 hero with bought levels, Mastery and a running `moveCd`: XP, level, `levelSpent`, `levelsBought`, ult rank and cooldown restored. **v1 fixture:** a `SNAP_V 1` snapshot with a Lv 7 hero at tiers 2/1/0 and `spent` 1,240 → restored at Lv 7 (`xpToReach(7)`), on her spot, not dropped, `refunded` 1,240, no `sell` event, ult state kept. Key guard tables updated. |
| **Attack FX** (`wt-attack-fx` tests) | `heroLookTiers` at Lv 9 / 15 / 22 / 25; `tierLook(..., { multi: true })` returns several looks; hero intensity ≤ 1.6. |
| **UI** `tests/battle-ui/*` | Hero card FREE / `Deployed · Lv n`; widget pill states (hidden / poor / affordable / MAX / Mastery); panel 25-row track, no Upgrades, Move label per state (prep / wave / recharging), no Sell; price repaint at most twice a second under passive XP (fake clock); **co-op attribution:** an ally `heroLevel` event shows a chip with the ally's hero name, not a toast with yours; results line from the hero's own counters; student **Deploy cost Free**; formation picker **Free**. |
| **Balance** `tests/integration/balance.test.js` | Easy gate still all wins. `BALANCE=hero`: the §6.1 table for 10 stages, printed with "won at ×1" (cap 16); **pace guard**: end level with no buying, default hero: 1-1..1-5 in [13, 20], 8-5 in [17, 21]; the §5.3 crowd/single power guard on the in-sim bench; **capability timing:** for each stage's `recommended` capability that only a hero provides, the level that hero reaches by the trait's first wave, or the coins to buy it then, is printed (6-3/6-4/6-5 cleanse). `BALANCE=full`: Hard and Nightmare wins and the new first-clear gem total, recorded in `docs/BALANCE.md`. |
| **e2e** `e2e/hero.mjs` (new; Playwright, fresh profile, 844×390 and 1280×720) | 1-2 (not the tutorial stage): card says FREE and is armed at wave 0 → tap grass → hero placed with 0 coins spent. Start waves, fast-forward: `sim.hero.level` rises during waves, not between. Buy a level from the pill (cash drops by the shown price, level +1, toast). Open the panel: track rows, Level up, no Sell; Move between waves → new spot, same level; Move in a wave → "Move · 12s". Q fires the ult, L buys a level (PC). Screenshots of §10.6. Co-op (`e2e/online.mjs`, two tabs): both heroes on the field, guest buys a level, ally chip on the host, hashes stay equal. |

---

## 13. Risks

| Risk | Mitigation |
|---|---|
| Campaign too easy (free hero + growth + short-stage pace) | Measured (§6); #75 recalibrates stage HP afterwards; all knobs are data; `refWaves: 30` was tried and rejected (it also lifted chapters 2–6). |
| Medal gems reachable earlier (Hard/Nightmare first clears) | Owner approval (Q2) before release; fallback knob `DIFFICULTIES[d].heroCost`. |
| Hero mandatory / towers pointless | At no-buy pace she reaches the tier-4 band only in the last third; buying competes with tower tiers; the §5.3 power guard (crowd ≤ 1.4×, single ≤ 1.0× the best 5/2). |
| Counters at the wrong time (cleanse, anti-air, armor) | Rule 5 + its data test + the capability-timing print in `BALANCE=hero`. |
| View-dependent `sim.hero` read inside the step → co-op desync | Runtime trap, source allow-list test, two-view lockstep test, hash includes hero level/XP. |
| Delayed level buys in co-op | `hlv[level, maxPrice]` + `stale`; tested with a wave clear between queue and apply. |
| Move abuse during waves (chasing a boss) | 3 s downtime + 15 s recharge per wave move (data). |
| Nami push-back pins lanes | Trimmed numbers + `PUSH_LOCK` (§3.1, §11). |
| Merge conflicts in `hero.js` (freeplay, B3), `units.js` (roster, balance), `Sim.js` (everyone) | Edit, never rewrite; the hero blocks in `units.js` are the only lines this spec owns there; `heroTracks.js` is new; `_onHitEffects` has one owner (B3). |
| Old battle saves with hero tiers | §9.3 migration + v1 fixture test in M4. |
| Level-up spam (24 levels, buys) | One toast per frame, audio throttle, banners only for tier-5 levels and ranks, ally events as chips. |
| Players who liked choosing paths | Lv 25 has all three tier-5s; the owner asked for it. |

---

## 14. Milestones

Each ends with vitest + build green and one logical commit. M1–M2 change the co-op id: ship them together with the next forced bump.

| # | Scope | Done when |
|---|---|---|
| M0 | `heroTracks.js` (3 tracks, rule 5, pace/Mastery/move constants), `tools/heroTrack.mjs` (draft + rule-5 report), data tests | Data tests green incl. rule 5 and the Lv 25 snapshot; `units.js` heroes wired (`paths: []`, cost 0). |
| M1 | Sim solo: XP sources + pace, growth + Mastery, buy with `want`, ranks, free placement, `canSell`/`sellTower` false, `moveHero` + `_relocate` + `moveLock`, view getters + trap, `towerStats`/`result` fields, `report.js`, `headless.js` | `hero.test.js` + `heroes.test.js` + `viewRule.test.js` green; golden: tower-only battles bit-identical to live. |
| M2 | Co-op: `heroes[]`, `hlv[level,maxPrice]`/`hmv`, loadout, session start, hash, protocol | Lockstep tests (two views, stale race, move/auto-start race) + engines digest V8 = JSC = SpiderMonkey. |
| M3 | Battle UI: card FREE + arm, widget pill (2 Hz price), panel block + full track + Move states, feed attribution + ally chips, banners/audio/keys, scout text, renderer move | UI unit tests; `e2e/hero.mjs` + screenshots reviewed at both sizes. |
| M4 | Outside battle: student (Deploy cost Free, Hero section, Tree tab), formation (Free, total), wiki, tips, co-op lobby; battle-save fields + v1 migration (if #170 landed); attack-FX hand-off (`heroLookTiers`, multi looks, intensity cap) to the attack-fx branch | Screens reviewed; snapshot round trip + v1 fixture; attack-fx unit test green on its branch. |
| M5 | Balance pass: `BALANCE=hero` (headroom with won-at-×1, per hero, pace guard, power guard, capability timing), `BALANCE=full` Hard/Nightmare gem delta, freeplay bot rerun with both ults, hand-off to #75 | Tables in `docs/BALANCE.md`; **owner has answered Q2** (medal gems) before release; #75's stage-HP pass is in the same release (Q3 default). |
| M6 | Docs: CONTRACTS §3 HeroDef (track, `pathKeys`, ranks, no paths), §6 Sim API (`heroes`, `heroLevelStatus(want)`, `buyHeroLevel(want)`, `canSell`, `moveHero`, view rule, events `heroBuy`/`heroMove`/`heroMastery`), §13 co-op commands; `docs/ROSTER.md` heroes; `OWNER_REQUESTS.md` row | — |

---

## 15. Owner questions (each has a default; none blocks M0–M4)

1. **"Make towers free" = heroes, free to deploy?** Default: **yes** — heroes cost 0 to place, towers keep their prices, Luna stays a gacha hero. The other reading is "her *upgrades* become free (she levels by herself, no path buying) but placing her still costs 460–620 coins": one data line per hero (`base.cost`). What it changes: free placement barely moves Normal (r1: today's hero made free, ×1.0–1.1 headroom), but on Nightmare (one life, no income) an extra unit at wave 1 is what the bot lacks today, and Nightmare 1-1 to 1-4 become wins (Q2).
2. **Medal gems (needs your approval; economy).** With the free hero and the new track, the free-player balance bot newly clears **6 Hard stages** (2-2, 3-1, 4-4, 4-5, 5-2, 5-3) and **4 Nightmare stages** (1-1 to 1-4) that it loses today: 360 + 400 = **760 first-clear gems** reachable earlier, once per account (the total medal budget does not change), and sweeping unlocks earlier on those stages (§6.4). Default (what M0–M4 assume; the release waits for your answer): **ship it as measured and record the gem figure in `docs/BALANCE.md`**; if you say no, the data knob `DIFFICULTIES.hard/nightmare.heroCost` puts a deploy price back on medal difficulties only (Normal and Easy stay free) and we re-measure.
3. **The campaign gets easier on Normal** (§6: the free-player bot survives about **twice** the enemy HP, ×1.4–×3.4 by stage; co-op ×1.5–×3.1). Default: **ship the designed pace and let the balance pass (#75) raise stage HP in the same release**, so players never get a campaign that is twice as easy. Alternatives: a gentler pace (XP ×0.75, growth 2 %; r1 measured it at ×1.4–1.5 where the full pace gives ×2.1–2.4 on 3-5 and 4-5), or hold the rework until #75 lands and calibrate both at once.

Decided without a question (tell us if you disagree): each co-op player brings her own hero (the guest trades her 6th girl for her hero); heroes can't be sold and Move instead; past Lv 25 a capped Mastery (+25 % at most) keeps freeplay heroes growing (`masteryMax: 0` turns it off).

---

## 16. Critic resolution

Every point of `CRITIC.md`, in its order. **Fixed** = changed in this spec and, where it is measurable, in the r2 prototype (`exp-r2/`).

| # | Point | Verdict | What changed |
|---|---|---|---|
| 1 | Counters move to deep levels (cleanse gone on 6-3/6-4/6-5) | **Fixed** | Curation rule 5 (Lv ≤ 10 or ≤ 1.5× old cost; T5-only exempt) applied to all three heroes by swap or capability split; table in §3.1 (cleanse Lv 19 → 9, anti-air 15 → 10, armor pierce 12 → 8 ×3, Luna stun 19 → 14, Luna Veil Sight aura 15 → 10); Lv 25 unchanged (verified); data test; `capabilitySources` "Lv N" + live price in the scout text (§10.4); capability-timing print in `BALANCE=hero`; 6-x measured: cleanse by wave 7–8 for ~1,500 coins, or wave 12–14 with no coins (today: never for the bot, 5,260 coins). |
| 2 | Chapter 1 hero not visibly stronger without buying | **Fixed** | Stage pace `k = clamp(22/N, 1, 2)` on time and wave XP (§4.1): chapter 1 ends Lv 14–19 instead of 9–17 (live 6–10), Lv 7–9 at mid-stage everywhere (r1: ~5 on chapter 1); stages of 22+ waves unchanged. Pace guard in `BALANCE=hero`. Chapter-1 table in §5.2. `refWaves: 30` measured and rejected (it lifted chapters 2–6 too; 1-5 headroom ×3.3). |
| 3 | Co-op `hlv` buys the next, dearer level after a delay | **Fixed** | `hlv[level, maxPrice]`, `reason: 'stale'`, real reasons passed through, same `want` for solo/L key; prototype: 3 stale refusals in the determinism run (4.5 s delay); lockstep test with a wave clear between queue and apply. |
| 4 | Pre-rework battle saves restore wrongly | **Fixed, one detail rejected** | `SNAP_V` 2, v1 hero restored by level, tiers ignored, never sold or dropped, v1 fixture test, M4 "done when". Rejected: refunding only `spent − old base cost × costMul` — the new data has `base.cost` 0 so it cannot be computed, and the placement is free under the new rules; the whole `spent` is refunded. |
| 5 | Hard/Nightmare medals (premium gems) become reachable | **Fixed (flagged for approval)** | Measured on r2 (§6.4): Hard 30 → 36, Nightmare 0 → 4 (1-1 to 1-4), 760 first-clear gems reachable earlier (once per account), earlier sweeping; owner question 2 with a default and the `heroCost` fallback knob; M5 requires the answer before release; §1 point 13 no longer claims "no economy impact". |
| 6 | Attack FX hero looks vanish; uncapped intensity | **Fixed** | `heroLookTiers(def, level)`, `tierLook` multi-look for heroes, hero intensity cap 1.6, attack-fx unit test (§11, §12). |
| 7 | Move unusable with auto-start / co-op, not prototyped, position state | **Fixed** | Move allowed in any state (free between waves; 3 s downtime + 15 s recharge in a wave), so no timing window; single `_relocate` for every position-derived field (traps, targets, drones, auras; codex `assignPads`, B3 `updateRelayOrigin`); prototyped and in the two-view digest (7 moves: 1 in prep, 6 during waves, auto-start on). |
| 8 | Freeplay: no growth past 25; checkpoints miss fields | **Fixed** | Capped Mastery (+1 % / 2,000 XP, ≤ +25 %, data, can be off); §9.4 checkpoint fields; freeplay bot rerun with both ults in M5. |
| 9 | Co-op UI shows the ally's hero events as yours | **Fixed** | Events resolved by `towerUid`; ally chips; results from the hero's own counters (§8.1, §10.4); UI test. |
| 10 | Power guard ignores target count; only Nami measured | **Fixed** | In-sim crowd and single-target bench for heroes and towers (§5.3); guard on that bench (Lv 25 crowd ≤ 1.4×, single ≤ 1.0× the best 5/2 tower); Luna's Lv 22 trimmed after the bench showed 1.68× (now 1.34×; Hikari 1.05×, Nami 0.41×); headroom per hero for Hikari and Luna on five stages (§6.2): all in the ×1.25–×2.7 band. |
| 11 | View rule enforced only by a hash | **Fixed** | Runtime trap in the `hero`/`heroConfig` getters (on in tests and in the prototype runs), source allow-list test (§8.3). |
| 12 | `sellTower` contract ambiguous | **Fixed** | `canSell(uid)`; `sellTower` returns `false` for a hero (matches `towerPanel.js:304`), no event; headless `'fail'`; commands keep the owner; tests for all callers. |
| 13 | Potential name clashes | **Fixed on the Potential side** | The track keeps the live tier names; Potential renames its P6s (suggested names), landing order and golden re-snapshot in §11. |
| 14 | Places still showing a deploy cost | **Fixed** | Student Deploy cost **Free**, formation picker/total, `units.test.js:469-474` replaced, "Level prices −X %" for gear Cost Reduction (§10.5, §12). |
| 15 | "one more girl" for an adult guardian | **Fixed** | "one more defender" (§10.5). |
| 16 | Pill price repaints every frame | **Fixed** | Price re-read at most twice a second; stale-safe `maxPrice` (§10.2). |
| 17 | Headroom method (monotonic, cap) | **Fixed** | Cap 16, 7 steps, "won at ×1" beside every figure (§6.1). |
| 18 | Cost-cut auras no longer discount the hero | **Fixed** | Stated as a deliberate nerf in §2.2, §4.4, the tips and `docs/BALANCE.md`. |
| 19 | Duplicate sources of truth | **Fixed** | `HERO_XP.maxLevel` removed; per-hero `levelXp` requires `levelPrices` (data test). |
| 20 | Coordinating with roster B3 | **Fixed** | B3 asked to write tracks directly; `_onHitEffects` owner = B3, merge order B3 → freeplay → rework (§11). |
| 21 | Owner question 1 should give the alternative | **Fixed** | Q1 states both readings and the Nightmare/Hard consequence. |
| — | Missing tests (9 items) | **Fixed** | All nine are in §12: capability timing, stale `hlv`, `hmv` + auto-start/partner races in the digest, battle-save v1 fixture, Hard/Nightmare deltas, attack-fx looks + intensity, view trap, co-op attribution, short-stage pace guard. |

Nothing in the critique was rejected outright; the one partial rejection is point 4's refund formula (reason above).

---

## Appendix: prototype, scripts, raw results

r1 under `scratchpad/four-features/hero-rework/exp/` (unchanged; see r1's list in `SPEC.r1.md`). r2 under `exp-r2/`:

| File | What |
|---|---|
| `src-heroTracks.js` | The proposed `src/data/heroTracks.js` (r2: rule 5, pace, Mastery, move, `pathKeys`, Luna trim) |
| `proto/hero.js` | Reference `src/sim/hero.js` (pace, Mastery, `want`/stale, two heroes, move) |
| `make-overlay.mjs`, `entry.js`, `out/` | One overlay for solo + co-op + r2 (`Sim.js`, `mods.js`, `towers.js`, `types.js`, `units.js`, `commands.js`, `loadout.js`, `simHash.js`); the r2 bundle |
| `src-heroTracks-nopace.js`, `out-nopace/` | Ablation: r2 without the stage pace |
| `lib.mjs`, `hr.mjs` | Bench (r1's bot, `{ok}` buy results) and headroom (cap 16, won at ×1) |
| `checks.mjs` | View trap fires; stale buy; sell refusal; move in prep / wave; Mastery; pace per stage length |
| `det.mjs`, `det-node.txt`, `det-bun.txt` | Two-hero co-op determinism with delayed `hlv`, `hmv`, auto-start, view trap |
| `caps.mjs`, `res/caps.md` | Rule 5 table |
| `lv25eq.mjs`, `crowd-bench.mjs`, `crowd-bench-lib.mjs`, `luna-trim.mjs`, `res/crowd-bench.md` | Lv 25 equality; in-sim crowd / single-target bench; Luna trim options |
| `cleanse.mjs`, `res/cleanse.jsonl` | 6-3 / 6-4 / 6-5 cleanse timing (live, r2 no buying, r2 buying from the first sabotage) |
| `tracks-md.mjs`, `res/tracks.md` | §3.2 tables |
| `fulltable.mjs`, `res/ft-*.jsonl` | `BALANCE=full` replica (critic's script): r2 on all four difficulties, live Easy/Normal (live Hard/Nightmare are the critic's `critic-exp/ft-live-*`) |
| `e6-coop.mjs`, `res/coop-2h.jsonl` | Co-op approximation (two heroes) |
| `res/hr-*.jsonl`, `tables.mjs`, `res/tables.md`, `res/e4-r2.txt`, `res/ref30/` | Headroom (default, per hero, no hero, no pace), the table builder, pace table, the rejected `refWaves: 30` runs |
| `single-bench.mjs`, `res/single-bench.md` | Single-target bench (heroes Lv 10/20/25, towers 5/2) |
| `share13.mjs`, `res/share13.txt` | 1-3 damage share with the bot's plan vs hero placed first |
| `golden.mjs`, `res/golden.txt` | Hero-less battles: live = r2 (1-3, 4-5, 8-5) |
