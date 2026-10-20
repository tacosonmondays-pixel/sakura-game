# Gear Awakening: rainbow UR gear and the Starlight Needle (build spec)

**Owner request (Oct 15, verbatim):** *"Also can we make it so you can awaken gold gear? have an item that allows
you to buff a specific sub stat, UR gear will have rainbow effect, this will allow stats to get crazier XD! what else
do you sughggest"*

**Reading.**
- "Gold" gear is **Legendary** (`ITEM_RARITIES.legendary.color = '#ffb627'`, `src/data/types.js:209`).
- A Legendary piece can be **awakened** into **UR gear**, which wears the same rainbow as the girls' UR (v0.1.26:
  `src/ui/rarity.js:53-78`, `src/ui/styles/ur.css`).
- A new **item raises one substat the player picks**.
- Numbers get bigger, inside a power budget that keeps Freeplay and the campaign fair.

**Inputs.**
- Live game `/home/user/sakura-game` at `fddf01c`. Paths are relative to it unless prefixed.
- `TA:` is train A, `/home/user/wt-traina` at `8d5f936`.
- The five working files in this folder: `research-gear.md` (RG), `research-economy-power.md` (RE),
  `design-progression.md` (DP), `design-economy.md` (DE) and `design-ui.md` (DU).
- The Sensei Profile spec and SQL (`(design scratch, not in the repo)/`), the achievements spec (`docs/specs/ACHIEVEMENTS.md`),
  the landing plan (`wt-trainc docs/specs/LANDING_PLAN.md`) and the train C freeplay bot
  (`(design scratch, not in the repo)/`).

**Evidence.** Every number comes from scripts that read the live modules: RE `tools/`, DP `progression/`, DE `econ/`,
DU `ui/tools/` and this spec's `spec/ceilings-spec.mjs`. Nothing in any repo was changed.

---

## 0. The feature on one page

1. **Rainbow Bloom (the awakening).**
   - A gold piece at **+10** shows a rainbow **Awaken** button where today's dead "Max +10" button sits
     (`src/ui/screens/student.js:645`).
   - Cost: **1 Rainbow Seed + 80,000 coins**. It always works.
   - The piece becomes **UR gear**: every number +14%, it can level to **+12**, it is auto-locked, and it gets a
     second Needle slot.
   - It shows a turning rainbow ring and a rainbow `UR` pill. A one-time "Awakened to UR!" moment plays.
2. **The Starlight Needle (the owner's substat item).**
   - **One item.** Pick a substat line and **Stitch**: that line gains one growth step (✦).
   - Gold +10 pieces take **1 stitch** (gold ✦). UR pieces take **2** (gold ✦ + rainbow ✦), and both may sit on the
     same line. That is the "crazy line", for example **+74% Crit DMG ✦✦**.
   - A stitch can be taken back for coins. Rerolls never touch a ✦ line.
3. **Fair ceilings.**
   - A girl's best realistic set goes from **×3.1 to ×5.5 DPS** against no gear, which is **×1.77 her gold set**.
   - In today's Freeplay (fddf01c) that is **+2 boss tiers on Crimson Moon** (wave 120 → 140), and no run reaches the
     Eclipse Wyrm.
   - The path-cap pass makes tiers 4 and 5 much stronger and is tuned on `MAXED`, so gear is re-measured with it
     (on the path-cap branch before R2 ships, and again in train C's combined pass) with a hard guard: **`UR_LATE`
     must not beat the Wyrm**, and if it does, gear gives way first (§7.4, §13).
   - Two new caps hold the far tail: **Crit DMG ≤ +200%** and **Range ≤ +50%**. Every cap shows a **MAX** tag.
4. **Pace.**
   - Seeds come only from capped or one-time sources: the weekly "Rainbow Hunt", a first-bloom gift, achievements and
     Freeplay milestones. That is about **1 UR piece a week**, with or without energy.
   - First rainbow in week 1 of the late game (active player), a full set on one girl in week 3, 24 pieces (eight
     girls) in about 20 weeks, 27 with the hero in about 23.
5. **Safe for old builds and co-op.**
   - No new rarity id, no `src/data/types.js` change, no `SAVE_VERSION` bump.
   - A UR piece stays `rarity: 'legendary'` with a `ur` flag. The marks are mirrored in `missions.counters`.
   - Two releases ("reader" first, then "writer"), **neither changes the co-op id**. `loadout.js` is untouched.
   - A co-op stat sanity clamp rides train C.

---

## 1. Rulings (where the three designs disagreed or left a choice)

| # | Topic | Ruling | Taken from / over | Why |
|---|---|---|---|---|
| R1 | How UR is stored | `rarity: 'legendary'` + `ur: 1`. **No `'ur'` rarity id**; `src/data/types.js` untouched. | All three agree | An older build **deletes** an unknown rarity (`src/systems/save.js:174`; DE §2 case A). `src/data/items.js` crashes at load with a 6th rarity (`:142-161`). `types.js` is co-op hashed (RG §11). |
| R2 | Stored numbers | Values stay in **Legendary form** on disk. The UR multiplier is applied when a value is read, through one helper. | DE D2 over baked values | A reroll in an old tab then cannot leave lines silently 12.5% low, and the UR scale stays one constant (DE §9.2). |
| R3 | UR numbers | Scale 2.8 → **3.2**: every number ×8/7 (+14.3%), Armor Pierce ×1.105. Max level **+12**, with a 4th ▲ at +12. | RE option R; DP and DE agree | Biggest visible change for the least randomness (RE §8.1). |
| R4 | Who can awaken | Legendary at **+10**, equipped or spare, not already UR. Always succeeds, auto-locks, renames to "…of the Rainbow Sakura". One-way: salvage is the undo. | DP §3 | No failure chances for kids. |
| R5 | Awakening cost | **1 Rainbow Seed + 80,000 coins.** | Item count and price from DE; name and art from DP and DU. Over 3 Seeds + 150k (DP) and over 3 Prism Dice + a fodder gold piece (RE). | The DE pace model was run on 1 item + 80k (§6.4). There is no fodder, which would tax casual players who are short of gold pieces. One Seed per piece is easy to count and refund. Seed art and copy already exist (DU §2.1). |
| R6 | Seed sources | Weekly **Rainbow Hunt** (1); first-bloom gift (1); 2 achievements; Freeplay "Matriarch defeated" per tier (3). **No stage drops, no gem price, no salvage Seed Jar, no Workshop in v1.** | DE §5.1, simplified | Deterministic and capped, so no pity is needed. The pace is the same with or without energy. Stage drop tables are co-op hashed. |
| R7 | The substat item | **One item: Starlight Needle.** Legendary +10: 1 stitch (gold ✦). UR: 2 stitches (gold ✦ + rainbow ✦), **allowed on the same line**. Each stitch = +1 growth step at the piece's scale. | DE's single item and budget, DP's rainbow ✦ and "crazy line". Over DP's three Needles. | The owner asked for "an item". The rainbow ✦ keeps the UR chase. Same endpoint budget (×1.77). "Polish" clashes with the achievements "Polished to a Shine" / "Master Polisher" (achievements SPEC rows `a_plus10_1`, `a_plus10_10`). Glimmer (roll lift) moves to the suggestions (§14). |
| R8 | Stitch price | 1 Needle + 20,000 coins. **Take back:** 10,000 coins, and the Needle returns. | DE price; DP and DU take-back | No regret for kids; a coin sink, not an exploit. |
| R9 | Rerolls and ✦ | **✦ lines always stay** in a Fortune Dice reroll (a free lock; they keep their ▲). At least 2 lines always reroll, so a Lock Pin is offered only when that still holds. | DP §5.3 over DE's refund | A child who stitched Crit Rate expects Crit Rate to still be there. |
| R10 | Needle sources | Steady: Rainbow Hunt 1 + Bounty Exchange 1 (30 tokens) + first Freeplay cache of the week 1 = **3 a week**. One-time: Freeplay "wave 150" ×2 per tier, achievements 3. **No gem price.** | DE §5.2, without the Workshop | Needles never limit pace (§6.4), so they can stay generous. |
| R11 | Salvaging UR or stitched gear | Legendary payout + the **Seed back + every Needle back**. UR is auto-locked, and unlocking asks "This is UR gear!". | DE D10 / DP §3.5 | Nothing a child earned is ever lost. Total UR pieces can never exceed Seeds earned. |
| R12 | UR prices for old actions | Priced as **tier 6** (order 5): enhance (800 + 400·L) × 6 (+11: 28,800, +12: 31,200); reroll subs 3 dice + 12,000; reroll main 1 Prism Dice + 30,000. | DE §4.1, made uniform | One rule (`gearTier`) for every price, so nothing silently falls back to Common (DE §2 case E). |
| R13 | Caps | Keep crit 75%, cost 25%, ult 50% (`src/systems/progression.js:276-280`). Add **Crit DMG ≤ +200%** (critMul ≤ 3.0) and **Range ≤ +50%**. Show **MAX** wherever totals show. | RE §8.3; all agree | Neither bites a realistic set; together they hold the theoretical tail (§7.3). |
| R14 | Rainbow Resonance | 2 UR pieces on one girl: **+5% Range**. 3 UR pieces: **+10% Range** and rainbow sparkles on her shots. Ships in R2 **if the owner says yes (Q2, default yes)**. | DP §4.2 | A set goal with no DPS-budget cost (Range is not in the DPS product). It is already inside the measured endpoint (§7). |
| R15 | Pity | None for Seeds or Needles (all deterministic). Add a **Celestial bad-luck counter**: 40 solo Total Assault Hard / Workshop Yard III Nightmare runs with no Legendary piece → the next one adds a Celestial box. | DE §6 | Legendary drops are the only luck left. The counter adds about 9% Legendary supply. |
| R16 | Save | Additive fields only. Mirrors in `missions.counters` (`gur:`, `gtn:`, `inv:`, plus `ga:gift`, `fpu:`, `pity:cel`), restored on load, idempotent. | DE §9 | Every build keeps `missions.counters` verbatim (`src/systems/save.js:137-145`, `:238`). This is the Potential pattern. |
| R17 | Releases | **R1 "reader"** (next normal update after train A), then **R2 "writer"** at least 2 weeks later. Both keep the co-op id. | DE D5 | Stale tabs after R2 are then mostly R1, which handles UR fully. |
| R18 | Co-op | No change for UR (stats travel as numbers). The plausibility clamp goes in `createCoopSim` and rides **train C**. | DE §10, with this spec's ceilings | `commands.js` is hashed; train C changes the id anyway. |
| R19 | Profile card | `r: 'ur'`, `l` ≤ 12, effective values, and a 4th sub element `tuned` 0–3 (bit 1 = gold ✦, bit 2 = rainbow ✦). **Amend the SQL before the M2 paste.** | DE §11 + DP §5.4 bitmask | Otherwise viewers drop UR pieces, clamp them to Legendary values, or the whole card is refused. |
| R20 | Drops | UR never drops; no UR gear box. | DP §3.2 | Pride of making it, and the gear-box tables stay at 5 tiers. |
| R21 | Backpack actions | The Backpack gear modal gets the full action row (Enhance, Awaken, Stitch, rerolls, Lock), so spare pieces can bloom. | DP §8 item 2; DU §3.3 | Today the modal is read-only (`src/ui/screens/backpack.js:215-241`). |
| R22 | Tuning rule for content | Never tune stages on UR stats. Path-cap sets the Freeplay bands on `MAXED` (path-cap SPEC §6.2 M7a–M7c); gear adds guard runs with `LATE` and `UR_LATE` in the same pass (§7.4). **`UR_LATE` must never beat the Eclipse Wyrm**; if it does, gear gives way first (no ✦✦ on one line, then one stitch per UR piece), never the post-200 band. | RE §4.4, DP §6.5, path-cap §6.2 rule 5 | Non-UR players are never locked out, and the owner's "top" stays out of reach. |
| R23 | Achievement metrics | New metric names are `gearUrEver`, `gearUrWornMax` and `gearStitches`. **Not** `urOwned`. | New | The achievements spec already uses `urOwned` for UR **girls** (achievements `SPEC.md:293`, `:431`, as of its 09:57 version). |
| R24 | Names (placeholders, Q3) | Rainbow Bloom (the action), Rainbow Seed, Starlight Needle, Stitch / Take back, Bloom pips / Full Bloom, Rainbow Resonance, Rainbow Hunt. | DP + DU | One new word per system. |

---

## 2. Rainbow Bloom (awakening)

### 2.1 Rules
- **Eligible:** `rarity === 'legendary' && level === 10 && !ur`. Equipped or spare.
- **Cost:** `[{ id: 'seed_rainbow', count: 1 }, { id: 'coins', count: 80000 }]`. A failure returns `missing`, the same
  as rerolls (`src/systems/gear.js:233`).
- **Effect** (one commit, reason `gear-awaken`):
  - `ur = 1`, `locked = true`;
  - the name suffix "of the Eternal Sakura" becomes "of the Rainbow Sakura" (`RARITY_SUFFIX`, `src/systems/gear.js:39`);
  - the max level becomes 12;
  - stored values are **not** rewritten (R2): every read becomes ×8/7 at once;
  - a gold ✦ already on the piece is kept, and the rainbow ✦ slot opens;
  - `track(profile, 'gearAwaken', 1)`;
  - audio: map `gear-awaken` to the existing awaken jingle (`src/audio/economy.js:57-59`).
- **After it:**
  - **+11** costs 28,800 coins and **+12** costs 31,200. The main stat grows +6% of its base per level (Armor
    Pierce +4%, `src/systems/gear.js:84-88`).
  - At **+12** the least-upgraded line gains a ▲ (today's rule, `src/systems/gear.js:307-313`). ✦ marks do not
    count as upgrades.
- **Bloom pips** (cosmetic): +11 · +12 · gold ✦ · rainbow ✦. All four lit = **Full Bloom**: glints on the ring and a
  "Full Bloom" tag. No extra stats.
- **No undo.** Salvage refunds the Seed (§5).

### 2.2 One real piece, step by step
"Keen Pendant of the Eternal Sakura" from the research save (DP §4.1, `progression/walkthrough.mjs`):

| Step | Lv | Main | Substats |
|---|---|---|---|
| Legendary today | +10 | Crit DMG 37.4% | Ult Haste 11.3% · Crit Rate 9.0% · Armor Pierce 5.4 ▲▲ · Attack Speed 15.4% ▲ |
| Awakened | +10 | **42.7%** | 12.9% · 10.3% · 6.0 ▲▲ · 17.6% ▲ |
| +12 | +12 | **45.9%** | Ult Haste **20.9% ▲** (the least-grown line) · … |
| Gold ✦ on Crit Rate | +12 | 45.9% | Crit Rate **15.9% ✦** |
| Rainbow ✦ on Crit Rate too | +12 | 45.9% | Crit Rate **21.5% ✦✦** |

The +12 growth landed on a line the player may not want. That is exactly the gap the Needle fills. The Equipment tab
names the line that grows next (§10).

---

## 3. UR gear stats

Effective value = stored Legendary-form value × `urMul(stat)`, where
`urMul = statScale(stat, 3.2) / statScale(stat, 2.8)` (Armor Pierce scales at half rate, `src/systems/gear.js:43-46`).
One growth step (▲ or ✦) = `((min+max)/2) × scale × 0.5` (`src/systems/gear.js:68-71`).

Computed by `spec/ceilings-spec.mjs` from the live constants:

| Stat | ×UR | Step: Legendary → UR | Main max: Legendary +10 → UR +12 | One sub line: Legendary today (best roll + 3 ▲ via reroll luck) | UR sweet spot (good roll + its ▲ + ✦✦) | UR theoretical top (best roll + 4 ▲ + ✦✦) |
|---|---:|---|---|---:|---:|---:|
| ATK | 1.143 | 6.3% → 7.2% | 32.3% → 39.6% | 35.7% | 38.4% | 62.4% |
| Attack Speed | 1.143 | 4.9% → 5.6% | 26.9% → 33.0% | 28.7% | 30.8% | 49.6% |
| Range | 1.143 | 4.2% → 4.8% | 21.5% → 26.4% | 23.8% | 25.6% | 41.6% |
| Crit Rate | 1.143 | 4.9% → 5.6% | 26.9% → 33.0% | 28.7% | 30.8% | 49.6% |
| Crit DMG | 1.143 | 11.9% → 13.6% | 64.5% → 79.3% | 69.3% | **74.4%** | 120.0% |
| Armor Pierce | 1.105 | 1.4 → 1.6 | 6.4 → 7.5 | 8.1 | 8.4 | 13.7 |
| Cost Reduction | 1.143 | 2.8% → 3.2% | 16.1% → 19.8% | 16.8% | 18.0% | 28.8% |
| Ult Haste | 1.143 | 7.0% → 8.0% | 37.6% → 46.2% | 40.6% | 43.6% | 70.4% |

- **The "crazier XD" moment:** a line reading **"+74% Crit DMG ✦✦"** on a rainbow card is reachable by choice, not by
  luck. Today the best line is 69%, and only after lucky rerolls.
- `lineCeiling(stat, { ur, main, level, ups, tuned })` is one exported function in `gear.js`. Tests, the save repair
  and the profile viewer all use it.

---

## 4. The Starlight Needle (substat item)

| Field | Value |
|---|---|
| id / name | `needle_star` / **Starlight Needle** |
| Category | `dice` (Backpack → Equipment). The category's display title becomes **"Gear Tool"** (`ITEM_CATEGORIES.dice`, `src/data/items.js:32`). |
| Tile | Legendary (gold) |
| Text | "Stitch a ✦ onto the substat you choose. Gold gear at +10 takes one; rainbow UR gear takes two, even on the same line." |
| Works on | Legendary at +10 (gold slot) and UR (gold + rainbow slots) |
| Effect | +1 growth step on the chosen line, at the piece's scale: Legendary +11.9% Crit DMG / +6.3% ATK / +4.9% Crit Rate; UR ×8/7 |
| Slots | Gold ✦: 1 per piece. Rainbow ✦: 1 per UR piece. Use fills gold first, then rainbow. A line may hold both. |
| Cost | 1 Needle + 20,000 coins; `track(profile, 'gearStitch', 1)` |
| Take back | 10,000 coins: removes one mark from the line (rainbow before gold) and returns the Needle |
| Caps | The Stitch modal **warns** (it does not block) when the wearer is already at a cap for that stat: crit 75%, cost 25%, ult 50%, Crit DMG +200%, Range +50%. Gear moves between girls, so a spare piece shows no warning. |

The Seed for comparison:

| Field | Value |
|---|---|
| id / name | `seed_rainbow` / **Rainbow Seed** |
| Category | `dice` ("Gear Tool") |
| Tile | Legendary, drawn with the rainbow tile (`.item-tile.is-ur`, display only, DU §2) |
| Text | "A seven-colour sakura seed. Plant it in a +10 gold piece and it blooms into rainbow UR gear." |

**Measured power of the Needle** (DP §6.1, best of 10 Legendary +10, a girl without crit of her own, DPS against
her own gold set):

| | DPS |
|---|---:|
| Gold set + 1 gold ✦ per piece (no UR) | ×1.15 |
| UR set, no stitches | ×1.31 |
| UR + gold ✦ per piece | ×1.53 |
| **UR + gold ✦ + rainbow ✦ per piece (endpoint)** | **×1.77** (crit kit ×1.89, best of 6 ×1.68) |
| Same, but the rainbow ✦ may not stack on the gold line | ×1.72 |

---

## 5. How UR and ✦ change the existing actions

| Action | Gold, no ✦ | Line with ✦ | UR piece | Older tab (and the repair) |
|---|---|---|---|---|
| Enhance | as today, max +10 | value = base + (▲ + ✦ count) × step | max +12, tier-6 prices; ✦ never counts as a ▲ | Clamps level to 10 (`src/systems/save.js:190`). Restored from `gur:`. |
| Reroll subs | as today (`src/systems/gear.js:226-249`) | **Kept in place** with its ▲ (free lock) | rolls in Legendary form and reads ×8/7; at +12, 4 ▲ minus the kept lines' ▲ are re-dealt at random over the new lines (rule at `:239-241`); 3 dice + 12,000 | Wipes ✦ lines and re-deals 3 ▲. On the next load, Needles are refunded from `gtn:` and the missing ▲ goes to the least-upgraded line. |
| Lock Pin | as today | — | offered only when at least 2 lines still reroll: none with ✦ on 2 different lines | — |
| Reroll main | as today (`:256-278`) | If the new main is a ✦ line's stat, that line rerolls into a free stat and **keeps its ▲ and ✦** (today's clash rule, `:266-273`) | 1 Prism + 30,000; keeps "Rainbow" in the name | Recomputes the main at level 10. The new build recomputes at the restored level. |
| Awaken | — | ✦ kept, and the step grows ×8/7 | — | — |
| Salvage | as today | **+1 Needle per ✦** | Refused while locked or equipped (`:338-339`). Unlocked: Legendary payout (coins 7,500 + 50% of invested enhance coins, +11/+12 at tier 6) + 3 Fortune Dice + 1 Lock Pin (`:321-328`) + **the Seed + every Needle** | An old tab pays the Legendary payout only. The new build pays the Seed + Needles once from `gur:` / `gtn:`. |
| Multi-salvage | precious warning (`src/systems/salvage.js:23-25`) | preview lists the Needles | UR is locked, so it is dimmed | `locked` is a known field |
| Lock / unlock | as today | — | auto-locked on awakening; unlocking asks "This is UR gear!" | kept |
| Equip / move | as today (`src/systems/gear.js:168-183`) | — | Resonance follows the pieces | — |

A finished UR piece costs about **310,000 coins**: 130,000 for +0 → +10, 80,000 to awaken, 60,000 for +11/+12 and
40,000 for two stitches. 24 pieces cost about 7.4 M coins, a late-game coin sink.

---

## 6. Sources, costs, pity and the free-player timeline

### 6.1 Rainbow Seed
| Source | Amount | Cap | Code (none hashed) |
|---|---|---|---|
| **Rainbow Hunt** (weekly commission): "Clear Total Assault 3 times this week (sweeps count)." | 1 Seed + 1 Needle, no gems | 1 / week | New row in `WEEKLY_MISSIONS` (`src/data/missions.js:24-30`) with `requires: '5-5'` (Total Assault opens after 5-5, `src/data/stages.js:921`). New track event `assaultClear` (`TRACK_EVENTS`, `src/data/missions.js:11`), fired next to `battleWin` (`src/systems/rewards.js:151`) and `sweep` (`:200`) for `kind: 'boss'` stages. |
| **First-bloom gift** | 1 | once | The first time the save holds a Legendary +10 (on enhance, or at the first R2 load). Mark `ga:gift`. Paid straight into items with a "Show me" line. |
| Achievement "Rainbow Wardrobe" (one girl wears 3 UR) | 1 | once | §6.3 |
| Achievement "Rainbow Atelier" (12 UR made) | 1 | once | §6.3 |
| Freeplay milestone "Ashwing Matriarch defeated", per tier | 1 × 3 tiers | once per tier | Add `items` to the milestone row (`src/online/coop/rewards.js:37-38`). It is already old-build-safe through the `fpm:` marks (`:236-237`). |

**One-time Seeds in total: 6.** There is no stage drop and no gem price.

### 6.2 Starlight Needle
| Source | Amount | Cap |
|---|---|---|
| Rainbow Hunt | 1 | 1 / week |
| Bounty Exchange `bty_needle`, 30 Bounty Tokens | 1 | 1 / week (`src/data/shop.js:54-61` block) |
| First Freeplay cache of the game week, solo or co-op | 1 | 1 / week, through a `missions.weekly['cap:fpNeedle']` key, which the weekly reset wipes (`src/systems/missions.js:43-46`) |
| Freeplay milestone "Reached wave 150", per tier | 2 × 3 | once per tier |
| Achievements "First Rainbow" (2), "Needlework" (1) | 3 | once |
| Refunds: Take back, salvage, an old-tab repair | 1 each | — |

### 6.3 Achievement rows (offered to the achievements catalogue as a "Gear awakening" wave that ships with R2)

| id | Name | Goal | Reward |
|---|---|---|---|
| `a_ur_first` | First Rainbow | `gearUrEver` ≥ 1 | 50 gems + 2 Starlight Needles |
| `a_ur_wear3` | Rainbow Wardrobe | `gearUrWornMax` ≥ 3 | 50 gems + 1 Rainbow Seed |
| `a_stitch_10` | Needlework | `gearStitches` ≥ 10 | 1 Starlight Needle |
| `a_ur_12` | Rainbow Atelier | `gearUrEver` ≥ 12 | 100 gems + 1 Rainbow Seed + title *Rainbow Gearsmith* |
| `a_ur_24` | Rainbow Academy | `gearUrEver` ≥ 24 | profile frame **Rainbow Bloom** (`ur-ring`, beside the SPEC's `ur` frame, `profile/SPEC.md:345`) |

- **200 gems in all.** The achievements spec's "all new" total goes 6,780 → 6,980, under its 7,000 cap (achievements
  SPEC §1.3 and R2 at `:49`; the caps test at `:1132`).
- `gearUrEver` and `gearStitches` are counter-backed (`ach:urEver`, the `gearStitch` event), so they never go down
  after a salvage (that spec's R21).
- `gearUrWornMax` is counter-backed too: `ach:urWorn` keeps the highest number of UR pieces one girl has worn, written
  on equip and on load. Without it, unequipping a piece would move unclaimed progress backwards (that spec's R21).
- UR pieces count for `gearEver(legendary)` automatically, because the stored rarity stays Legendary.
- `gearMaxEver` must read `level >= 10`, so UR +11/+12 still counts.
- Awakening is **not** "gear received" (`profile.seq.gear` does not move).

### 6.4 Pity
- **Seeds and Needles:** none needed. Every source pays a fixed amount, and a child can always see how far away the
  next one is.
- **Legendary drops** are the remaining luck (4–8%: `src/data/stages.js:806`, `:925`, `:940`, `:956`).
  - **Celestial bad-luck counter:** `pity:cel` in `missions.counters`, kept in `src/systems/rewards.js` as a
    post-roll step.
  - Each solo Total Assault Hard+ or Workshop Yard III Nightmare run with no Legendary adds 1, sweeps included.
  - At 40, the next such run adds a Celestial box and the counter resets. Any Legendary piece also resets it.
  - Co-op wins already drop no gear (`src/online/coop/rewards.js:77-79`).
- **Measured:** P(no Legendary in 30 runs) for the active mix ≈ 16%. The cap at 40 raises the average supply by
  ≈ 9% (DE §6).

### 6.5 Free-player timeline (DE `econ/pace.mjs`, re-run with this spec's v1 sources)

Run with `--econ '{"seedDustStock":0,"polishDustStock":0,"fpPolishPerWeek":2}'`, which means no Workshop, and Hunt +
first cache as the weekly Needles. Weeks count from entering the late game. Expected values, so read them as ±30%.

| Player | Seeds / week | UR-worthy gold / week | First UR | First full set (3 on one girl) | UR at week 4 / 8 / 13 / 26 / 52 | 24 UR (8 girls) | What limits them |
|---|---:|---:|---:|---:|---|---:|---|
| Casual (energy, 4 days a week) | 1 | 0.45 | week 3 | week 6 | 1 / 4 / 7 / 14 / 24 | week ≈ 43 | gold supply |
| **Active (energy, daily)** | 1 | 1.18 | **week 1** | **week 3** | 5 / 10 / 15 / 24 / 24 | **week ≈ 20** | balanced |
| All energy on Total Assault | 1 | 1.57 | week 1 | week 6 | 2 / 3 / 5 / 10 / 20 | week ≈ 61 | coins (no coin runs) |
| Heavy sweeper, live today (no energy) | 1 | 13.7 | week 1 | week 2 | 7 / 11 / 18 / 24 / 24 | week ≈ 19 | Seeds (the cap holds) |

- For the casual, active and all-Total-Assault players the weeks are **identical to the economy design's run with the
  Workshop on**, so dropping Rainbow Dust and the Workshop from v1 costs them no pace. Only the heavy sweeper is
  slower (24 UR at week ≈ 19 instead of ≈ 10), which is what the weekly cap is for.
- "24 UR" is eight girls. The hero wears gear too (`unitBattleStats` serves her, `src/systems/progression.js:265`);
  27 pieces take the active player to week ≈ 23 (`review/pace27.mjs`, the same model with 27 as the goal).
- **Needles never limit anyone:** 48 stitches land in the same week as the 24th UR piece.
- **Energy is not a prerequisite.** Without energy, the weekly Seed holds heavy sweepers to the same pace as active
  players.
- **Mid players** (no Legendary, Total Assault locked) see nothing new: the Hunt row is hidden until 5-5.
- **Gems:** weekly gem income is unchanged (the Hunt pays no gems; 600 gems a week from weeklies,
  `src/data/missions.js:23`). No gem offer. The awaken screen's "Where to get coins" lists Market Canal before the Gem
  Shop's coin offer (`src/data/shop.js:32`), so kids are not nudged to spend gems.

---

## 7. Power budget

### 7.1 What the player sees (one girl, best of 10 Legendary +10, average of 120 sets, DP §6.2)

| Gear total | Gold set today | **UR endpoint** (UR + ✦✦ per piece + Resonance) |
|---|---:|---:|
| ATK | +45% | **+64%** |
| Attack Speed | +33% | **+42%** |
| Range | +17% | **+31%** (+21% without Resonance) |
| Crit Rate | +36% | **+58%** |
| Crit DMG | +80% | **+123%** |
| Armor Pierce | 5.3 | 6.6 |
| Cost Reduction | 12.5% | 16% |
| Ult Haste | 28% | 35% |
| **DPS against no gear** | ×3.1 | **×5.5** (×1.77 her gold set) |

### 7.2 Battle-stat blocks for the re-tune (level 60, 5 gates, ★5, `awakenPassive: true`)

| Block | damageMul | rateMul | rangeMul | critChance | critMul | armorPen | costMul | ultHaste | Source |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `MAXED` (today's calibration, average Legendary) | 2.87 | 1.53 | 1 | 0.39 | 1.48 | 2 | 1 | 0 | `tools/freeplayBot.mjs:20` |
| `LATE` (best of 10 Legendary) | 3.50 | 1.64 | 1.17 | 0.36 | 1.80 | 5.3 | 0.88 | 0.27 | DP §6.5 |
| **`UR_LATE`** (this spec's endpoint) | **3.97** | **1.75** | **1.30** | **0.58** | **2.23** | 6.6 | 0.85 | 0.31 | DP §6.5 |
| `UR_MAX` (theoretical max rolls, capped; unobtainable) | 6.38 | 2.87 | 1.50 | 0.75 | 3.00 | 34.8 | 0.75 | 0.50 | `spec/ceilings-spec.json` (per-stat maxima, not one set) |

`UR_LATE` against the train C bot presets (`four-features/potential/exp/r2/fp/builds.mjs:13-17`):
- It sits **below `god`** in damage (3.97 vs 4.92) and crit DMG (2.23 vs 2.37).
- It sits above `god` in crit chance (0.58 vs 0.55) and has range and cost cut, which `god` lacks.

### 7.3 Caps (in `unitBattleStats`, `src/systems/progression.js:265-286`, which is not co-op hashed)

| Stat | Cap | Status | Realistic endpoint | Notes |
|---|---|---|---|---|
| Crit Rate (gear part) | 75% | live (`:276`) | 58% | a crit-stacker reaches it, so it shows MAX |
| Cost Reduction | 25% | live (`:279`) | 16% | |
| Ult Haste | 50% | live (`:280`; also `src/sim/hero.js:32`) | 35% | |
| **Crit DMG** | **+200%** (critMul ≤ 3.0) | new | +123% | Touches no realistic set. Today's theoretical max (+208%) loses 2.6%. It holds the UR max-roll stack to ×1.28 over today's max set (DP `ladder.json` `god`). |
| **Range** | **+50%** | new | +31% | Coverage grows with the square of range (RG §8) |
| ATK, Attack Speed, Armor Pierce | none | watch | — | Perf guard below |

Export `BATTLE_CAPS = { critChance: 0.75, costCut: 0.25, ultHaste: 0.5, critDmg: 2.0, rangePct: 0.5 }` for the MAX tags.
Like the live crit-rate cap (`Math.min(0.75, g.critChance)`, `:276`), both new caps act on the gear totals:
`critMul = 1 + min(g.critDmg, 2.0)` and `rangeMul = 1 + min(g.rangePct, 0.5)`, with Resonance inside `g.rangePct`.
Bonuses from outside gear (Potential, path upgrades and auras in the sim) are not capped here.

### 7.4 Freeplay (live `runBot` on 4-5, team build, Normal, seed 7; RE `res/bot.jsonl` and DP `progression/bot.jsonl`)

| Stat block on every girl | DPS vs no gear | Crimson Moon falls at | Blossom falls at | Kage-only, Crimson |
|---|---:|---:|---:|---:|
| No gear | 1.0 | 50 | — | 50 |
| `MAXED` | 2.2 | 90 | 150 | 50 |
| `LATE` | 3.1 | 120 | 190 | 90 |
| UR, awakening only | 4.1 | 130 | — | — |
| **`UR_LATE`** | **5.5** | **140** | **200 (the Ashwing Matriarch)** | 90 |
| UR set with 1 ✦ per line (RE's block) | 5.4 | 150 | 200 | — |

- Bot runs move in whole boss tiers, with ±10 waves of noise.
- On 1-5 Blossom the UR sets beat the Matriarch and fall at 215–220.
- **On fddf01c nothing reaches the Eclipse Wyrm (250).**
- The Kage-only wall does not move: gear cannot replace a missing answer to fliers or veils.

**The re-tune belongs to path-cap** (`docs/merge/PATH_CAP.md` §6.2–§6.5), and it changes the ground under this
table:
- It tunes on `MAXED` (its §6.3), with bands for its mixed team (Build A) of **Blossom 180–220, Tempest 140–180,
  Crimson Moon 110–140** (M7a–M7c).
- It adds a boss every 5 waves from wave 50, so "boss tiers" in this section mean the 10-wave steps measured on
  fddf01c.
- On fddf01c `LATE` is already +40 waves over `MAXED` on Blossom (150 → 190). A `MAXED` band of 180–220 can therefore
  put `UR_LATE` close to the Wyrm. That is the case the guard below catches.

**Gear's guard runs, in the same pass** (path-cap §6.5 step 5, LANDING_PLAN §9.2 step 7):
- Build A with `LATE` on every girl, and again with `UR_LATE`, on 4-5 and 1-5, Blossom and Crimson Moon, seeds 7
  and 11.
- `LATE` above the `MAXED` band is expected: that is the reward for good gear, not a miss.
- `UR_LATE` lands 10–30 waves above `LATE` on Crimson Moon (today +20).
- **`UR_LATE` must not beat the Eclipse Wyrm on any run.** If one does, gear gives way first: ✦✦ may no longer share a
  line (×1.72), then one stitch per UR piece (×1.53). Path-cap's rule 5 keeps the Matriarch and the post-200 band
  untouched, so the top is never raised to fit gear.
- Add presets `late` and `urLate` to the pass's `builds.mjs`, and a `urCarry` lineup (`UR_LATE` on the top carry,
  `LATE` on the rest) as the reference for months 1–3 of the late game.
- **Stacking:** Potential (+9%), path-cap T4/T5 and the hero rework multiply on top of gear, so all of them are
  measured in that one pass.

### 7.5 Campaign, clan boss and performance
- **Campaign:**
  - The balance gate assumes no gear (`tests/integration/balance.test.js:39`).
  - UR arrives only after 5-5 / 8-5, so the curve a new player meets is unchanged.
  - Rule R22 applies: never tune on UR.
- **Clan boss:** the per-attempt cap test uses damageMul 16 / rateMul 5.5 (`tests/online/clanBoss.test.js:14-25`), far
  above UR. No server change.
- **Performance:** UR raises attack speed to rateMul 1.75–1.83. Add a `UR_LATE` rate block (1.83, the worst
  measured) beside `MAXED` in `tests/sim/perf.freeplay.test.js:12`.

---

## 8. Save model and old-build safety

### 8.1 Stored shape
- **Piece:** `{ uid, slot, rarity: 'legendary', level: 0..10 (0..12 when ur), main: { stat, value, base }, subs: [{ stat, value, base, upgrades, tuned? }], locked, equippedBy, name, ur? }`
  - `ur: 1` only on awakened pieces.
  - `tuned` is a per-line bitmask: 1 = gold ✦, 2 = rainbow ✦, 3 = both.
  - Existing pieces are byte-identical, so there is nothing to migrate.
- **Stored (Legendary form):**
  - `main.value = base × (1 + growth × level)`;
  - `sub.value = base + (upgrades + popcount(tuned)) × step(stat, 'legendary')`.
- **Effective** (shown, summed, sent to battle, written to the card) = stored × `urMul(stat)` when `ur`.
  - It is read only through `gearLines(g)`.
  - A missed read site shows the Legendary number (understated) and never corrupts anything. A grep test pins the
    sites (§12).
- **Items:** `seed_rainbow` and `needle_star`.
- **No `SAVE_VERSION` bump:** a newer version makes an older build start a fresh profile (`src/systems/save.js:472`).
  The landing plan keeps 2 through trains A–C.

### 8.2 What an older build does (DE `econ/oldbuild.mjs`, run on live and on `TA:`)
- **A UR piece** survives as Legendary: `ur` and `tuned` are stripped, the level is clamped to 10, and the stored
  values are kept. The load is **silent** (backup `null`; `src/systems/save.js:173-197`).
- **New item ids** are dropped and the load is marked `lossy` (`:314`, `:444-450`).
- **`missions.counters`** is kept word for word (`:238`).
- So the mirrors below are required, not optional.

### 8.3 Mirrors in `missions.counters`

| Key | Value | Written when | Restores |
|---|---|---|---|
| `gur:<uid>` | UR level, 10–12 | awaken, enhance, salvage, and the end of every load | `ur = 1`; `level = min(12, max(level, v))` |
| `gtn:<uid>` | Σ `tuned(line) << 2·TUNE_BITS.indexOf(stat)` (≤ 65,535) | stitch, take back, reroll, salvage, load | ✦ marks on lines whose stat is present; a Needle refund for each mark whose stat is gone |
| `inv:seed_rainbow`, `inv:needle_star` | the item count, 0 included | in `setCount` (`src/systems/inventory.js:36-42`, the only writer of `profile.items`) | `items[id]` when the item is absent |
| `ga:gift`, `fpu:<tier>:<id>`, `pity:cel` | 1 / 1 / count | when paid / counted | once-only grants survive old tabs |

- `TUNE_BITS` is a frozen literal list (`['atkPct', 'ratePct', 'rangePct', 'critChance', 'critDmg', 'armorPen', 'costCut', 'ultHaste']`),
  never `Object.keys(GEAR_STATS)`.

**`restoreGearMarks(p)`** runs in `migrateProfile` after gear and missions are cleaned, where Potential's
`creditPotential` runs in train A. Steps:
1. **Items:** for each `inv:<id>` > 0 whose item is absent, set `items[id] = min(v, 9999)`. Spent items have
   mirror 0 and are never resurrected.
2. **UR:** for each `gur:<uid>`:
   - **Piece present and still Legendary at level ≥ 10:** set the flag and the level.
   - **Piece gone** (or a different piece now holds the uid): an older build salvaged it. Uids are not reused while
     `seq.gear` survives (`src/systems/save.js:341-343`), but a save that lost `seq` restarts from the highest uid
     left, so the rarity and level check above is what keeps a new +0 piece from being awakened by an old mark.
     - Pay the Seed + one Needle per `gtn:` mark **once**, straight into items, with a notice. Not by mail: an old
       `cleanMail` strips unknown ids (`:258`, `:276`).
     - Also pay the half of the +11/+12 coins that the old salvage could not see (it priced the piece as Legendary
       +10, `src/systems/gear.js:321-328`): 14,400 for a `gur:` of 11, 30,000 for 12. Then nothing a child put in
       is lost, even through a stale tab.
     - Step 5 then drops the key, so the refund cannot pay twice.
3. **✦:** on a piece that is UR or Legendary +10 (the same uid check as step 2), set the marks on lines whose stat
   is present, and refund the rest. A `gtn:` key whose piece is gone was already refunded in step 2.
4. **Canonicalise UR and ✦ pieces:**
   - recompute `main.value` and each `sub.value` from base, level, ▲ and ✦ (derive `base` if it is missing);
   - if Σ ▲ < floor(level/3) (an old tab re-dealt 3 at level 12), give the missing ▲ to the least-upgraded line;
   - enforce the slot limits (gold ≤ 1, rainbow ≤ 1 and only on UR, gold only at +10 or on UR), refunding any excess;
   - put back "of the Rainbow Sakura" when an old tab's main-stat reroll renamed the piece with the Legendary
     suffix (`gearName`, `src/systems/gear.js:105-109`, `:274`).
5. **Rewrite every mirror** from the cleaned profile, and drop keys of pieces that are no longer UR or tuned.

**Idempotent:** `migrateProfile(migrateProfile(x))` deep-equals `migrateProfile(x)`, and no refund pays twice.

### 8.4 Two releases
| Release | Contains | Visible |
|---|---|---|
| **R1 "reader"** | the 2 item ids (no sources); tolerant `cleanStat` / `cleanGear`; mirrors + `restoreGearMarks`; `gearLines` at every read site; UR-aware enhance, reroll and salvage (with refunds); `gearTier`, `lineCeiling`; the new caps and `BATTLE_CAPS`; offers defined with stock 0; a minimal card look (`UR` pill, ✦ marks) | nothing for players without UR gear |
| **R2 "writer"**, ≥ 2 weeks later | Awaken and Stitch actions and their screens; Rainbow Hunt, the shop offer, Freeplay items, the gift and the retro grant; the Celestial counter; full rainbow visuals; Backpack actions; MAX tags; achievements; Resonance (if Q2 = yes); patch note | everything |

**Known gaps** (pre-existing):
- Two open tabs: the last save wins (`src/core/store.js:95-98`).
- A stale tab shows rainbow pieces as gold. Patch-note line: "Rainbow gear looking gold? Reload the page."
- A pre-R1 build may show a new weekly offer as sold out for one week (`src/systems/shop.js:20-24`).

---

## 9. Co-op and the profile card

### 9.1 Co-op
**UR works in co-op with no change:**
- Each player's girls fight with their owner's stats.
- `pickLoadout` passes `statsOf(unitId)` whole (`src/online/coop/loadout.js:16-23`).
- The peer merges them as received (`src/online/coop/commands.js:85`).
- `progression.js` and `gear.js` are outside the hashed graph (`tools/simId.mjs:19-27`).
- **`loadout.js` is not edited.**
- The optional Resonance key `rainbow` (0–3) rides inside that stats object for the renderer's sparkles. The sim never
  reads it, and an older peer ignores it.

**Fairness:**
- Rewards are per player: coins split evenly (`src/online/coop/commands.js:219-236`); co-op wins drop no gear.
- A UR player carries a weaker friend and never takes their rewards.

**Plausibility clamp (train C, not R1/R2):** `clampUnitStats(stats)` in a new `src/online/coop/statLimits.js`,
imported by `commands.js` (so it joins the hashed graph). It is applied to every union loadout entry, every view
entry and the host hero inside `createCoopSim`. Both peers clamp the same `start` message, so they stay in lockstep.

| Field | Rule | Honest max with UR (`spec/ceilings-spec.json`) | Headroom |
|---|---|---:|---:|
| `damageMul` | finite, 0–10 | 6.38 | 1.57× |
| `rateMul` | 0–5 | 2.87 | 1.74× |
| `rangeMul` | 0–3 | 2.20 uncapped (1.50 capped) | 1.37× |
| `critChance` | 0–0.75 | 0.75 | exact (capped at source) |
| `critMul` | 1–6 | 4.19 uncapped (3.00 capped) | 1.43× |
| `armorPen` | 0–50 | 34.8 | 1.44× |
| `costMul` | 0.75–1 | 0.75 | exact |
| `ultHaste` | 0–0.5 | 0.5 | exact |
| `rainbow` | integer 0–3 | 3 | — |
| `level` / `awaken` / `breakthrough` | integers 1–99 / 0–5 / 0–5 | — | — |
| non-finite | → the `DEFAULT_UNIT_STATS` value (`src/sim/constants.js:82-94`) | — | — |
| loadout length | ≤ `COOP.towersPerPlayer + 1` per player | — | — |

- The ceilings are wide enough that a later UR knob (scale 3.4) or dropping the new caps needs no id change.
- Potential (train C) is merged before the clamp, and a test fails if `DEFAULT_UNIT_STATS` gains a key with no rule.
- It closes a hole that exists today (`damageMul: 1000` is accepted now).

### 9.2 Sensei Profile card (`profile/SPEC.md` §5)

**`buildCard` (§5.2):**
- A UR piece writes `r: 'ur'` and `l` (10–12).
- `m` and `x` carry **effective** values (4 decimals).
- A sub with marks writes `[stat, value, ups, tuned]` (`ups` 0 if needed). Other subs are unchanged.
- The heaviest card goes from 4,587 B to about 4,611 B, under the 6,000 B budget.

**SQL** (`20261016000000_profile.sql:116-122`; amend **before** the M2 paste, which is not run yet):
```sql
if not (jsonb_array_length(p) = 2 or (p_ups and jsonb_array_length(p) between 3 and 4)) then return false; end if;
if jsonb_array_length(p) >= 3 and not profile_num(p -> 2, 0, 9, true) then return false; end if;
if jsonb_array_length(p) = 4 and not profile_num(p -> 3, 0, 3, true) then return false; end if;
```
- Mirror the change in `profile/profileRules.sketch.js` (`statOk`), and add accept and refuse cases to
  `profile/probe.mjs`.
- `r: 'ur'` already fits `^[a-zA-Z]{1,12}$` (`:167`), `l` ≤ 99 (`:168`), and the gear keys stay `s, r, l, m, x`
  (`:164`).

**`cleanViewedCard` (§5.4).** The viewer knows `ITEM_RARITY_ORDER` plus a card-only `'ur'`, kept in
`src/data/gearAwaken.js` (not `types.js`).

| `r` | `l` | `ups` per line | `tuned` per line | per piece |
|---|---|---|---|---|
| `ur` | 10–12 | 0–floor(l/3) | 0–3 | ≤ 1 gold bit, ≤ 1 rainbow bit, ≤ 4 subs |
| `legendary` | 0–10 | 0–floor(l/3) | 0–1, only at `l` = 10 | ≤ 1 gold bit |
| others | 0–10 | 0–floor(l/3) | 0 | — |

- Values are clamped to `lineCeiling(...)`.
- **Ship these viewer rules with profile M2 even if R2 has not shipped**, or early viewers drop UR pieces from others'
  showcases (`profile/SPEC.md:458`).

**Mini-profile (§5.5):** a UR card piece becomes `{ rarity: 'legendary', urCard: true, … }`, with `tuned` from
`x[i][3]`.
- It **never** carries `ur`, because card values are already effective. Carrying it would apply ×8/7 twice.
- `gearDisplayRarity` reads `ur || urCard`.
- Resonance counts `urCard` pieces too.
- The spec's planned round-trip test (`profile/SPEC.md:841`) must include a UR piece.

---

## 10. UI screens

**Built as mocked** in `design-ui.md`. The real-game shots are in `ui/shots/` (`<viewport>-<scene>.png`, at
1280×720 and 844×390), and the CSS is in `ui/ur-gear.css`. The table lists only the changes from those mocks.

**The final mock already applies the right-hand column:** `mock/gear.html` (`?state=` lists the 14 states), its
shots `mock/shots/<viewport>-<state>.png` at both sizes, and `mock/shots/ur-anim.webp` (the "Awakened to UR!"
moment and the ring shimmer after it, 24 frames, about 4.6 s a loop). Its CSS, `mock/css/gear-ur.css`, is the
section to append to `ur.css` and supersedes `ui/ur-gear.css`. Its numbers come from the live formulas
(`mock/tools/data.mjs`).

| Surface | What ships | Change from the DU mock |
|---|---|---|
| Gear card, all lists (`gearCard`, `src/ui/screens/backpack.js:102-123`) | `.mb-gear.is-ur`: the turning ring replaces the gold strip, pearl fill, rainbow icon art, `UR` pill with the title "UR — awakened gear", Bloom pips, ▲ / gold ✦ / rainbow ✦ (a different shape from the gold one), "✦ Can awaken" on gold +10 cards | none |
| Girl → Equipment (`src/ui/screens/student.js:620-698`) | Still rainbow slot buttons with a `UR` flag; ✦ chip on a slot that can awaken; Resonance strip (if Q2); totals with **MAX** (`:561-565`); **Awaken** in place of "Max +10" (`:645`); **Stitch** button; "Next growth at +12 → Attack Speed" (`:660`); +10 toast "It can awaken now ✦" (`:651`); a rainbow dot on the Equipment tab only when a piece can awaken now (`:759-770`) | "Tune" is labelled **Stitch** |
| Backpack gear modal (`:215-241`) | Feature card and the same action row as the Equipment tab; the salvage preview lists the Seed and Needles | — |
| Awaken modal (`awaken`, `awaken-short` shots) | Before → After with green `+x` pills, gain chips, Power before → after (`unitPower`, `src/systems/progression.js:292-303`), cost chips, one big **Awaken!** (the preview is the confirm; 600 ms double-tap guard); short state "Get Seeds" | Cost row **1 Seed + 80,000** (mock: 3 + 150,000); chip "Rainbow ✦ slot (a 2nd stitch)" |
| "Awakened to UR!" moment (`moment-*` shots) | Gear twin of `showAscension` (`student.js:541-557`), about 2.4 s, any tap skips, reduced motion shows the end state | **One** Seed flies in (mock: three) |
| Stitch modal (`tune-*` shots) | Piece card with radio rows, preview (old → new, Power), cap warning, **Stitch**, then a done state with "Take back · 10,000" | **No needle tabs** (DU §6.6). The header reads "Starlight Needle ×N · this piece: gold ✦ used · rainbow ✦ free". The rule line reads "Rerolls never touch a ✦ line." No Glimmer meter. |
| Needle / Seed tile → **Use** (`pick` shots) | Piece picker (eligible first), then the Stitch or Awaken modal; the existing `usable` hook (`backpack.js:438`) | Tags "Gold slot free" / "Rainbow slot free" / "Reach +10 first" |
| Filters (`src/systems/gearFilter.js`, `src/ui/gearFilterBar.js`) | `GEAR_DISPLAY_RARITIES = [...ITEM_RARITY_ORDER, 'UR']` (UI only); a rainbow UR chip; `'legendary'` excludes UR; rank uses `gearTier` (fixes `rarityRank`, `:27`); new "Show" options **Ready to awaken** and **Has ✦** | — |
| Battle | No gear rainbow on any girl frame. `✦2/3` / `✦3/3` pip by her name in the selected-girl panel; at 3/3, ≤ 3 glints per shot, 250 ms, pooled, off on Low quality and with reduced motion | only with Resonance (Q2) |
| Unit Sheet (`TA:src/ui/unitSheet.js`) / profile Build tab | "Her gear" strip with still rainbow edges; the build sheet gets `.bs-gc.is-ur`, ✦ marks and the Resonance chip | with profile M2 |
| Wiki (`src/data/wiki.js:333-351`), item info (`src/systems/inventory.js:194`) | "Rainbow Bloom" section and a marks legend; sources for the Seed and the Needle | — |

**Motion and accessibility** (DU §10–11):
- The ring turns only on gear cards. Everything icon-sized gets the still conic edge.
- New animated selectors go into **both** reduced-motion blocks (`ur.css:236-249`).
- A shared IntersectionObserver pauses rings that are off screen. On Low quality every gear ring becomes the still
  edge.
- Rows are ≥ 36 px. The marks differ by shape. Every action has a one-sentence, child-readable line.
- No lobby dot.

---

## 11. Code plan

### 11.1 Files and functions

| File (hashed?) | Change | Milestone |
|---|---|---|
| `src/data/gearAwaken.js` (new, no) | `UR_SCALE 3.2`, `UR_MAX_LEVEL 12`, `TUNE_BITS`, `AWAKEN_COINS 80000`, `STITCH_COINS 20000`, `TAKE_BACK_COINS 10000`, `RESONANCE = [0, 0, 0.05, 0.10]`, `CARD_RARITIES`, mirror prefixes, `CELESTIAL_PITY 40` | M0 |
| `src/data/items.js` (no) | `seed_rainbow`, `needle_star` (`dice`, sort 5003–5004, `display: 'ur'` on the Seed); `ITEM_CATEGORIES.dice.name` → "Gear Tool" | M0 |
| `src/systems/gear.js` (no) | **New:** `isUrGear`, `gearTier`, `maxGearLevel`, `urMul`, `gearLines`, `effectiveStat`, `stitchSlots`, `lineCeiling`, `awakenCost`, `canAwakenGear`, `awakenGear`, `stitchCost`, `canStitch`, `stitchSub`, `takeBackStitch`, `gearResonance`. **Changed:** `enhanceCost` / `enhanceInvested` / `enhanceGear` (tier, max 12; ✦ excluded from the least-upgraded pick), `rerollCost` / `mainRerollCost` (tier), `rerollSubstats` (✦ lines kept, ≥ 2 reroll, ▲ re-deal), `rerollMainStat` (clash keeps ▲ and ✦; UR suffix), `applySubUpgrades` (+ popcount(tuned)), `salvageRewards` / `salvageGear` (refunds), `gearName` (UR suffix), `gearStatTotals` (effective values; Resonance added to `rangePct` with a breakdown), `gearList` (sort by `gearTier`) | M0 (reads, prices, refunds); M1 (actions) |
| `src/systems/gearMarks.js` (new, no) | `writeGearMarks(p)`, `restoreGearMarks(p)` (§8.3), `mirrorItem(p, id)` | M0 |
| `src/systems/save.js` (no) | `cleanStat` keeps `tuned` 0–3; `cleanGear` keeps `ur` and allows level ≤ 12 when `ur`; `migrateProfile` calls `restoreGearMarks`; the item mirror through `inventory.js` | M0 |
| `src/systems/inventory.js` (no) | `setCount` writes `inv:` for the 2 ids; `itemSources` for both | M0 / M1 |
| `src/systems/progression.js` (no) | `unitBattleStats`: critMul ≤ 3.0, rangeMul ≤ 1.5, `rainbow` count; export `BATTLE_CAPS` | M0 (caps); M3 (`rainbow`) |
| `src/systems/gearFilter.js` (no) | `gearTier` rank; `'UR'`, `'ready'`, `'tuned'` | M0 / M2 |
| `src/data/missions.js` (no) | `TRACK_EVENTS` + `gearAwaken`, `gearStitch`, `assaultClear`; `w_rainbow` (Rainbow Hunt, `requires: '5-5'`) | M1 |
| `src/systems/missions.js` + the commissions view (no) | the `requires` gate (hide until the stage is cleared); counters `ach:urEver` | M1 |
| `src/systems/rewards.js` (no) | `assaultClear` on boss-kind wins and sweeps; Celestial `pity:cel` | M1 |
| `src/data/shop.js` (no) | `bty_needle` (30 tokens, 1 / week) | M1 |
| `src/online/coop/rewards.js` (no, `:16-17`) | milestone `items` (matriarch: Seed; w150: 2 Needles); weekly-first-cache Needle; retro grant (`fpu:`) | M1 |
| `src/ui/rarity.js`, `src/ui/components.js` | `gearDisplayRarity`, `applyUrGearFrame(el, g, { feature, still })`; `urBadge(extraCls, title)` | M0 (pill) / M2 |
| `src/ui/screens/backpack.js`, `src/ui/screens/student.js` | §10 | M2 |
| `src/ui/gearUr.js` + `src/ui/styles/gear-ur.css` (new, lazy) | `awakenGearModal`, `showGearAscension`, `stitchModal`, `pickGearFor(itemId)` | M2 |
| `src/ui/styles/ur.css` | card, slot, chip, mark, pip, button, tile and dot rules + reduced motion (from `mock/css/gear-ur.css`) | M2 |
| `src/art/icons/items.js`, `src/art/icons.js` | `gearBodyUR` with ids `igr-<slot>-ur`, `urBack`, `urFront`, `rainbowSeedBody`, `needleBody` (from `ui/tools/icons.mjs`); `gearIcon(slot, rarity, { ur })`; `SPECIAL_ITEMS` | M2 |
| `src/audio/economy.js` | `gear-awaken` → awaken jingle; `gear-stitch` → `gear.enhance` at a high rate | M2 |
| `src/ui/battle/towerPanel.js` + renderer (no) | Resonance pip and glints | M3 |
| `src/data/wiki.js`, `docs/ECONOMY.md` §6, `CONTRACTS.md` (GearInstance, gear API), `docs/FREEPLAY.md` (blocks), `docs/OWNER_REQUESTS.md` | docs | M1–M3 |
| Profile: `profileCard.js`, `cleanViewedCard`, `snapshotToMiniProfile`, `unitBuild.js`, SQL + sketch + probe | §9.2 | M4 (SQL now) |
| `src/online/coop/statLimits.js` (new, **hashed**) + `commands.js` (**hashed**) | `clampUnitStats` | M5 (train C) |
| `four-features/.../fp/builds.mjs` | `late`, `urLate` presets; `urCarry` lineup | M5 (train C pass) |

**Never touched:** `src/data/types.js`, `src/data/stages.js`, `src/sim/*`, `src/online/coop/loadout.js`, `session.js`
and `version.js`.

### 11.2 Milestones
| M | Release | Content | Gate |
|---|---|---|---|
| **M0** | R1 | data, save, mirrors, effective reads, prices, refunds, caps, a minimal card look | unit tests §12; full vitest; smoke at both sizes; `simId()` unchanged |
| **M1** | R2 | actions and sources: awaken, stitch, take back, Hunt, shop, Freeplay items, gift, retro, Celestial counter, achievement metrics | unit tests; missions F2P gem test unchanged |
| **M2** | R2 | all UI of §10 | `e2e/gear-awaken.mjs` at 844×390 and 1280×720; e2e multi-salvage, stat-display and smoke |
| **M3** | R2 (if Q2 = yes) | Rainbow Resonance stat, strip, pip and glints | unit + e2e; perf with 24 rings |
| **M4** | profile M2 | SQL amendment (now), card writer and viewer, mini-profile, build sheet | profile tests incl. a UR round trip |
| **M5** | train C | co-op clamp; bot presets in the combined Freeplay pass | `tests/online/coopStatLimits.test.js`; the train C gates |

Branch `feature/gear-awaken` off live after train A merges. The effort guess is about 2 weeks of work in all:
M0 3 days, M1 3, M2 5, M3 1–2, M4 1, M5 1.

---

## 12. Tests

### 12.1 Unit (vitest)
| File | Cases |
|---|---|
| `tests/systems/gearAwaken.test.js` (new) | **Awaken:** needs Legendary +10 + 1 Seed + 80k; sets `ur` and `locked`; renames; stored values untouched; refused for Mythic, below +10, already UR, or without a Seed (`missing`). **Effective values:** `gearStatTotals` = Σ stored × urMul (Armor Pierce 1.1053). **Enhance:** +11/+12 cost 28,800 / 31,200; +12 grows the least-upgraded line and ✦ does not count; Legendary still stops at +10. **Stitch:** gold-first then rainbow; 1 on Legendary +10, 2 on UR; both on one line allowed; refused below +10 and on Mythic; value = base + (▲ + ✦) × step. **Take back:** −10k, Needle +1, value restored. **Reroll:** ✦ lines kept with their ▲; ≥ 2 lines reroll; Lock Pin refused when it would leave < 2; 4 ▲ conserved at +12; still UR. **Main reroll:** clash keeps ▲ and ✦; name keeps "Rainbow". **Salvage:** UR refused while locked; unlocked pays the Legendary payout + Seed + Needles; Legendary + ✦ pays the Needle. **No Common fallback:** for every action and level, UR price and payout ≥ Legendary's (property test). |
| `tests/systems/save.test.js` (extend) | **Round trip:** UR +12 with ✦✦ survives `migrateProfile` with no `lossy`. **Old build:** a vendored fddf01c `cleanGear` (strips `ur` / `tuned`, clamps level 10), then a new load restores flag, level, marks and values. **Old reroll:** a ✦ stat gone refunds once and clears its bits; the missing ▲ goes to the least-upgraded line. **Old salvage:** `gur:g7` with no `g7` pays the Seed, the Needles and the +11/+12 half-coins once. **Old main reroll:** the name gets "of the Rainbow Sakura" back. **Lost `seq`:** a `gur:g7` next to a new +0 `g7` does not awaken it and pays the refund once. **Items mirror:** dropped items are restored; spent-to-0 items are not. **Idempotence:** double migrate is equal. **Hostile counters:** `NaN`, negatives and 1e9 do not throw; restores are capped at 9999. |
| `tests/systems/items.test.js` | Id list (`:11-28`) + 2; `dice` count 3 → 5; `itemSources` non-empty for both |
| `tests/systems/gear.test.js` | The rarity loops (`:18-46`) are unchanged (no new rarity); Legendary behaviour byte-identical without `ur` |
| `tests/systems/progression.test.js` | Caps: critMul ≤ 3.0, rangeMul ≤ 1.5; `BATTLE_CAPS` matches; `unitPower` rises on awaken |
| `tests/systems/gearFilter.test.js` | The UR chip matches only UR, Legendary excludes UR; Best first gives UR +12 > UR +10 > Legendary +10; normalize keeps `'UR'`, `'ready'`, `'tuned'` |
| `tests/systems/missions.test.js` | Rainbow Hunt progresses on `assaultClear` (battle and sweep), is hidden before 5-5 and pays Seed + Needle; F2P gems per 28 days unchanged; metrics `gearUrEver`, `gearUrWornMax`, `gearStitches` |
| `tests/systems/shop.test.js` | `bty_needle` 30 tokens, 1 / week |
| `tests/systems/rewards.test.js` | The Celestial counter adds a box at 40 runs, resets on any Legendary, is solo only, and sweeps count |
| `tests/online/coopRewards.test.js` (extend) | Milestone items once per tier; the weekly-first-cache Needle once per game week, including through `payPendingFreeplayRuns` (`src/online/coop/rewards.js:179`); retro grant once (`fpu:`) |
| `tests/systems/gearValueReads.test.js` (new, grep) | No `src/ui` / `src/systems` file outside `gear.js`, `gearMarks.js` and `save.js` reads `.main.value` or a sub's `.value` (except `changedSubs`, `student.js:567`) |
| `tests/ui/ur-gear.test.js` (new, jsdom) | `gearCard(UR)`: `.is-ur`, exactly one `.ur-ring`, the gear-titled pill, pips 0–4 / Full Bloom, `.mb-sub-star` / `.mb-sub-rb`; gold +10 shows "Can awaken"; `applyUrGearFrame` is idempotent |
| `tests/art/icons.test.js` | `gearIcon(s, 'legendary', { ur: true })` ids start with `igr-<slot>-ur` and never collide with the 15 rarity icons |
| `tests/sim/perf.freeplay.test.js` | + `UR_LATE` rate block (rateMul 1.83) |
| `tests/online/profileCard.test.js` (M4) | `buildCard`: `r: 'ur'`, `l` 12, 4-element subs, effective values; viewer accepts at the ceiling and clamps above; the mini-profile round trip equals the owner's totals (no double ×8/7); probe SQL accepts `[s, v, 0, 3]` and refuses tuned 4, ups 10 and 5 elements |
| `tests/online/coopStatLimits.test.js` (M5) | Absurd and `NaN` stats are clamped identically for both slots; `clamp(unitBattleStats(max UR))` is the identity; every `DEFAULT_UNIT_STATS` key has a rule; the loadout length is capped |

### 12.2 e2e (run by the team at both sizes; not here)
`e2e/gear-awaken.mjs` (new):
1. A seeded save with a gold +10 piece and 1 Seed: the Equipment tab shows `.ur-dot` and **Awaken**; the modal shows
   Before/After and Power; tap Awaken; `[data-testid=gear-ascend]` appears; tap Wonderful; the card has
   `.is-ur .ur-ring` and the slot `.is-ur`.
2. With 0 Seeds: "Get Seeds" opens item info.
3. Stitch gold, then rainbow on the same line: `.mb-sub-star` + `.mb-sub-rb`. Take back restores the value and the
   count.
4. Reroll subs: the ✦ line is unchanged.
5. Filters: the UR chip shows only UR; "Ready to awaken" shows the gold +10.
6. Backpack modal: a spare gold +10 can be awakened.
7. Reduced motion: no running infinite animation in the moment; the end state shows at once.
8. Layout: no horizontal overflow, and every modal fits 844×390.

Also extend `e2e/multi-salvage.mjs` (UR dimmed; the preview lists Seed and Needles) and `e2e/stat-display.mjs`
(MAX tags).

---

## 13. Release train

| Train | This feature |
|---|---|
| **A** (v0.1.28, in final testing) | nothing (too late; no co-op change needed anyway) |
| **Now** (not a release) | Amend the profile SQL + rules sketch + probe (§9.2) **before the M2 paste**. Send the §6.3 rows to the achievements catalogue. |
| **R1 "reader"** | The first normal update after train A (it can ride with achievements M0 or profile M0, which also branch off live after train A). **Co-op id unchanged** (`types.js`, `stages.js`, the sim, `loadout.js`, `commands.js`, `session.js` and `version.js` are all untouched). `SAVE_VERSION` stays 2. |
| **R2 "writer"** | A normal update ≥ 2 weeks after R1. **Co-op id unchanged.** It does not depend on train C or energy. If it ships before train C, run §7.4's guard once before release on the path-cap branch (its capBot Build A with `LATE` and `UR_LATE`), so any trim to UR happens before a child owns a UR piece; train C's combined pass then includes it anyway. |
| **C** (forced co-op update #2) | M5: the stat clamp in `commands.js` / `statLimits.js` changes the sim id **inside train C's single bump**. `COOP_PROTOCOL` is not touched by this feature: train C sets 4 for its own reasons (LANDING_PLAN S9). `loadout.js` stays as is. Bot presets `late` / `urLate` / `urCarry` go into the combined Freeplay pass. |
| **D** (roster, `SAVE_VERSION` 3) | nothing; the UR fields are additive and survive the bump |

---

## 14. What else: ranked suggestions

Value is how much a player feels it. Effort: S ≈ a day, M ≈ 2–4 days, L ≈ a week or more.

| # | Suggestion | Value | Effort | When |
|---:|---|---|---|---|
| 1 | **Show the caps** ("Crit Rate 82% → 75% MAX"), Before → After + Power on every gear action, and name the line that grows next | High | S | **Now** (R2; needed for UR to read well) |
| 2 | **Gear actions from the Backpack**, so spare pieces can be enhanced, rerolled, awakened and stitched without equipping them | High | S–M | **Now** (R2) |
| 3 | **Rainbow Resonance**: 2 / 3 UR pieces on one girl → +5% / +10% Range and rainbow sparkles on her shots | High | S–M | **Now** if the owner agrees (Q2) |
| 4 | **"vs equipped" line on spare cards** ("+6.2% ATK, −3% Crit") | Med–High | S | **Now** (reuses the Before/After helper) |
| 5 | **Gear presets per girl + "Best for her"** (one tap moves the pieces) | High | M | Next |
| 6 | **Glimmer Needle + Lucky Meter**: lifts one weak substat roll to "Good"; every 10 rerolls give a free one (bad-luck protection for mid players) | Med–High | S–M | Next |
| 7 | **Achievements, the *Rainbow Gearsmith* title and the "Rainbow Bloom" profile frame** (§6.3) | Med | S | With R2 |
| 8 | **Rainbow Workshop + Rainbow Dust**: Mythic and Legendary salvage gives dust for weekly-stocked Needles, pins and dice | Med | M | Later (after energy) |
| 9 | **Wish Loom**: 3 gold pieces → 1 gold piece of the slot and main stat you pick | Med | M | Later |
| 10 | **Academy Club gear sets** (Tea Club, Astronomy Club…): 2- and 3-piece bonuses | High | L | Later, budgeted together with Resonance |
| 11 | **Name your UR piece** (two-word picker, no free text) and a **Gear Album** of every piece you bloomed | Low–Med | S | Later |
| 12 | **Workshop Festival weekend** (extra Seed and Needle stock) | Med | M | With the event system |
| 13 | **Rainbow glint on the 3D chibi** at 3/3 | Med | L | Last |

**Recommendation:** build 1–4 inside R2 (they are what makes rainbow gear readable and usable) and ship 7 with it.
Do 5 and 6 next. Leave 8–13 for later.

---

## 15. Owner questions (at most 3, each with a default)

1. **How crazy should rainbow gear be?**
   **Default:** every number +14%, level +12, two Needle stitches on a rainbow piece (allowed on one substat). That
   is about **1.75× her gold-set damage** and +2 boss tiers in today's Crimson Moon Freeplay.
   - Milder: one stitch on rainbow gear, about 1.5×.
   - Crazier: every number +21%, about 1.9×.
2. **Rainbow Resonance now?** A girl wearing 2 rainbow pieces gets +5% range; with 3 she gets +10% range and rainbow
   sparkles on her shots.
   **Default:** yes, with range. An attack bonus instead would be about 3% stronger.
3. **Names OK?** Rainbow Bloom (the awakening), Rainbow Seed, Starlight Needle (the substat item, "Stitch"), Rainbow
   Hunt (the weekly task).
   **Default:** keep these.

---

## 16. Risks

| Risk | Guard |
|---|---|
| A read site misses `gearLines` and shows the Legendary number | Never corrupts anything; the grep test pins the sites (§12) |
| A stale tab shows rainbow as gold, or rerolls ✦ away | Mirrors and refunds (§8.3); R1 two weeks ahead; patch-note line |
| Power stacks with train C (hero rework, Chika, Potential, path-cap T4/T5); path-cap tunes on `MAXED`, so `UR_LATE` may reach the Eclipse Wyrm | One combined Freeplay pass with the `late` / `urLate` presets and the Wyrm guard (§7.4); gear gives way first (×1.72, then ×1.53); content is never tuned on UR (R22) |
| Kids waste a Needle on a capped stat | MAX tags and the cap warning; Take back |
| Many turning rings on the Backpack grid | IntersectionObserver pause and Low-quality still edges; the e2e records the animation count at 24 cards |
| The achievements gem cap | +200 gems keeps it at 6,980 ≤ 7,000 |
| Heavy sweepers without energy | The weekly Seed caps them at the active player's pace (§6.5) |

---

### Evidence in this folder
- `spec/ceilings-spec.mjs` → `spec/ceilings-spec.json`: line ceilings, per-stat maxima and co-op clamp maxima for
  this spec's rules. Run with `cd /home/user/sakura-game && node <this folder>/spec/ceilings-spec.mjs`.
- `econ/pace.mjs`: the §6.5 run, `--table --econ '{"seedDustStock":0,"polishDustStock":0,"fpPolishPerWeek":2}'`.
- `econ/oldbuild.mjs`: what older builds do with UR saves (§8.2).
- `review/pace27.mjs`: the §6.5 model with 27 pieces as the goal (eight girls + the hero).
- `progression/ladder.json`, `progression/bot.jsonl`, `res/bot.jsonl`: the DPS ladder and the Freeplay bot runs
  (§4, §7).
- `ui/shots/`, `ui/ur-gear.css`, `ui/tools/icons.mjs`: the design-pass mocks, CSS and prototype art (§10).
- `mock/gear.html`, `mock/shots/`, `mock/css/gear-ur.css`: the final mock that matches this spec (§10); `mock/tools/shoot.mjs`
  re-shoots it, `mock/tools/anim.mjs` + `webp.py` rebuild the animation.

---

## Build notes (track 2, `feature/ur-gear`, 2026-10-20)

Built on `specs/next-wave` (Potential v3 inside). Every file:line above was re-checked against that branch; the
places it moved are only line shifts. What shipped differently, and why:

- **One branch, reader and writer together.** R1 and R2 are one track here; the coordinator decides how to stage the
  releases. Old builds stay safe either way: every new field is mirrored in `missions.counters` and restored by
  `src/systems/gearMarks.js` (`restoreGearMarks` runs in `migrateProfile` right after `creditPotential`).
- **The co-op id changes** — not because of UR (UR still travels as numbers) but because gear-stats M1 (Pierce, Aura
  Power, the club tricks) rides the same branch. `COOP_PROTOCOL` is left for the coordinator.
- **`inv:` mirrors** are rewritten on every save (`src/core/store.js` `saveText` → `writeGearMarks`), not inside
  `setCount`; an item never held has no mirror, a spent one keeps 0.
- **Achievement rows §6.3 are not added** (the achievements catalogue and its gem-cap tests belong to that spec's
  owner). Their metrics are ready: `ach:urEver`, `ach:urWorn` (counters) and the `gearAwaken` / `gearStitch` events.
- **Profile card:** UR pieces publish now as `r: 'ur'` with effective values (today's server rules already accept it).
  The ✦ 4th element and the club key `c` need `supabase/migrations/20261020000000_profile_gear.sql` pasted first;
  until then `CARD_GEAR_MARKS` (`src/online/profileCard.js`) stays `false`. The viewer accepts all of it now.
- **Gifts and refunds are paid without a notice line:** the first-bloom Seed shows a toast on the enhance that earns
  it; paid at load (a save that already held a gold +10), and old-tab refunds, are silent.
- **Not built (cosmetic, left for the condense pass):** Resonance's battle pip and shot glints (the `rainbow` key
  travels for the renderer), the Seed's rainbow item tile, the Unit Sheet's rainbow build-sheet styling (its model
  carries `ur`, `club` and `tuned`), the Backpack's own rarity chips (the UR chip is in the gear filter bar).
- "Awakened to UR!" closes on **Wonderful!** (as the girls' ascension does), not on any tap.

Files: `src/data/gearAwaken.js`, `src/systems/gear.js` (UR reads, awaken, stitch, rerolls, salvage), `src/systems/gearMarks.js`,
`src/systems/save.js`, `src/systems/rewards.js` (Celestial counter, `assaultClear`), `src/online/coop/rewards.js` (Freeplay
Needle and milestone items), `src/ui/gearUr.js`, `src/ui/styles/gear-ur.css`. Tests: `tests/systems/gearAwaken.test.js`,
`tests/systems/gearStats.test.js` (mirrors), e2e `e2e/ur-gear.mjs`.
