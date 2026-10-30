# Gear stats: Pierce, Aura Power, Skill Haste, "Every Line Counts" and the Academy Club sets (build spec)

Sakura Sentinels, 2026-10-15. Build spec synthesized from two proposals, then revised after a critic pass (§N lists
every change). Nothing in any repo or git state was changed.

**Owner request (verbatim):** "also maybe more substat options like we have armor pen, how about pierce? you mentioned
there would be different gear sets right? I just dont want certain ones to be useless because rn ult haste only matters
for heroes, i know we're getting tower ults but yk what I mean"

**Reading.**
- "More substat options … how about pierce?": two new substats. **Pierce** (it means something on every attack kind
  except a duel) and **Aura Power** (the first gear stat that reaches a support's real job). Both roll only on club
  pieces, so nobody's current odds get worse.
- "Different gear sets": **Academy Club sets**. Two pieces give a stat. Three pieces add a **club trick**.
- "I just dont want certain ones to be useless": **Every Line Counts**. A line her kit can't use still adds ATK (Aura
  Power for Umeko and Miko). Each extra one adds a little less, and none ever adds zero. Ult Haste becomes **Skill
  Haste**; it keeps its ATK fill-in on tower girls and, once the tower abilities ship, also speeds their ⚡ abilities.
- The owner wants a real gacha feel, crazier numbers late on, no dead stats, and free players who stay fine. The owner
  and players are "they". Girls are "she". No other game is named in this file.

**Sources.**
- `file:line` with no prefix is `/home/user/wt-v130` (`release/v0.1.30` at `25c6a76`, read-only).
- Scratchpad files (`scratch/`):
  - RS = `gear-stats/research.md` (measured benches and code facts)
  - PD = `gear-stats/proposal-depth.md`, PC-L = `gear-stats/proposal-clarity.md` (the two inputs)
  - GA = `gear-awaken/SPEC.md`, P3 = `potential3/SPEC.md`, PC = `path-cap/SPEC.md`, AB = `core-units/ABILITIES_SPEC.md`
  - ASC = `ascension/SPEC.md` (Essence, level gates and **Titan Trials**, the weekly bosses; one synthesized spec)
- Number labels: **code** (read from source), **measured** (RS sim benches), **modelled** (arithmetic or Monte Carlo
  in `gear-stats/tools/`; not a battle), **assumed** (an input no source publishes), **spec** (a number this file
  sets; §D gates tune it).

---------------------------------------------------------------------------------------------------

## 0. The design on one page

1. **Ten stats.** Today's eight keep their keys, values, ranges and slots (`src/data/types.js:238-252`). Ult Haste is
   **renamed Skill Haste**; the key stays `ultHaste`. Two substats are new. They are **never main stats** and roll
   **only on club pieces** (Mythic+), so every piece without a club keeps today's odds exactly:
   - **Pierce** (`piercePct`, ribbons): "+46% Pierce" means 46 attacks in 100 hit one more enemy. Shots, beams and
     hitscan pierce one more; blasts and traps grow 20 % wider per 100 %; pulses hit 2 more; lightning jumps once more;
     drones pierce one more. Single-target pierce-1 shooters (Shiro, Momo, Miko) convert it at half rate.
   - **Aura Power** (`auraPct`, shoes): her aura's damage, speed and range bonuses grow by that percentage (cap 15 %).
2. **Every Line Counts.** A line her kit can't use, judged from what a menu can see (her kit, stars and Potential),
   or the part of a stat over its MAX, turns into ATK at half an ATK line's worth. The total follows a soft limit:
   `12 % × f / (f + 12 %)`. One dead line gives about +5 % ATK, two +7 %, six +10 %. A fill-in line keeps whatever
   small effect it has, and nothing a battle adds (a path tier, a hero level, a ⚡ ability) ever takes fill-in away.
   Umeko and Miko fill in as Aura Power and aura radius instead (own bucket, ≤ +5 %, from the battle update).
3. **Two reach rules** (battle update): half of her gear ATK also powers her burns and poisons (gear DoT ≤ ×1.25),
   and Range also widens her aura.
4. **Skill Haste** speeds hero ults exactly as today. With the tower abilities, ⚡ abilities and hero skills take
   **half** of it (≤ 25 % off the cooldown). Rallies and debuffs that lift the whole board (Moonbrand, Morning Rally,
   Shrine Chorus, Lantern Flare, Firefly Hush) are not hasted. This overturns AB:202 for the rest; owner question 1.
5. **Academy Club sets.** Mythic, Legendary and UR pieces belong to one club. Five clubs arrive with the battle update
   (**Archery, Fencing, Taiko, Pyrotechnics, Tea**), **Bell** with the tower abilities, more with new girls.
   2 pieces: a stat. 3 pieces: a trick, e.g. Taiko's **Big Beat** (every 10th attack hits 50 % harder) or Fencing's
   **Finishing Thrust** (every 25th attack deals double and ignores armor). Club pieces roll their club's three
   favourite substats at double weight.
6. **Getting clubs:** every new Mythic+ piece rolls a club when it enters the backpack; Titan Trials gear opens in the
   player's **Club Focus**; the **Club Armband** (new item, 9 as a welcome gift, about 3–5 a week free, no gem price)
   moves any Mythic+ piece, old ones included, into a club of the player's choice.
7. **Power (modelled, on P3's fixed stat presets):** Every Line Counts alone moves the Build A board's boss damage
   **×1.03** (free month 3) to **×1.07** (month 6). Full clubs: **×1.15–1.19 / ×1.20–1.23 / ×1.18–1.22** (free month 3
   / free month 6 / whale). Every P3 and PC band holds in the model **except one coin flip**: the co-op free month-3
   pair vs the 4-5 Matriarch ends ×1.01–1.04 short, so it is treated as a likely breach with a default knob (§D.4).
   Nobody comes within ×43 of the Eclipse Wyrm. Kage's best-gold panel goes 75k → 78k (81k with Taiko).
8. **Safety:** nothing gets weaker, ever, including the day abilities ship; `SAVE_VERSION` stays 2
   (`src/systems/save.js:19`); `types.js` stays frozen; a reader ships first; new stats are never mains, so an older
   build can never delete a whole piece over them (`save.js:199-200`); a mirrored line is restored only when a
   fingerprint proves the piece was not rerolled meanwhile. The co-op id changes once, inside the battle update.
9. **Ships:** M0 normal update with GA R1 (no co-op change, one Freeplay guard run) → M1 battle update (train C) →
   M2 tower abilities → later.

---------------------------------------------------------------------------------------------------

## 1. Scores and what came from where

### 1.1 Scores (0–10)

| Criterion | Depth (PD) | Clarity (PC-L) | Why |
|---|---:|---:|---|
| Owner fit (pierce-like stats, sets, no dead stats incl. Ult Haste, tower ults) | **9** | 6 | PD: four stats, kit-adaptive Pierce, 8 clubs with play-changing rules, Skill Haste on abilities. PC-L: one stat, Pierce real on 6 of 19 girls (F on 13), flat +6 % sets; its hard +8 % bar makes the 2nd dead line add nothing ("bar full"), which is still a useless line. |
| Clarity on a phone | 4 | **9** | PD: 12 stats, Status Power with half-rate sub-parts, a different "signature stat" per girl, 8 multi-clause rules. PC-L: one rule per line on a help sheet, "→ +6% ATK" on the card. |
| Build depth | **10** | 4 | PD: crowd-vs-boss choices, favourites, Prism choice, 3-piece rules. PC-L: one ribbon stat and small flat sets. |
| Balance safety vs P3 / GA / PC budgets | 4 | **8** | PD: board ×1.50–1.55, three tight wall spots, and a universal Boss DMG stat against P3's "boss multipliers: none" (P3 §3.4). PC-L: ×1.09–1.13, bands at their top edge, but its model leaves out burns, auras and Range. |
| Build cost / risk | 3 | **8** | PD: 4 new sim keys, 8 sim rules incl. mines and pops, Talent Swap v0 and v1, a 49-bit + 44-bit mirror pair. PC-L: one sim key family, 5 stat-only sets. |
| Save and co-op safety | 6 | **8** | PD adds new **main** stats, which an older build deletes with the whole piece (`save.js:199-200`), so it needs a piece-rebuild mirror. PC-L keeps Pierce a substat only; both ship sim keys inside train C with clamp rows. |
| **Total (of 60)** | **36** | **43** | |

### 1.2 The synthesis: clarity is the base, depth supplies the depth

| Part of this spec | From | Changed how |
|---|---|---|
| Skill Haste rename, key kept, label outside `types.js` | both | — |
| New stats are substats only, one slot each (Pierce on ribbons) | PC-L | Aura Power follows the same rule (shoes only); both roll on club pieces only (critic pass) |
| **Kit-adaptive Pierce** (blast, pulse, chain, trap, drones) | PD §A.4 | duel cleave dropped (Kaede fills in); % display from PC-L; half rate on pierce-1 single-target shooters |
| **Aura Power** | PD §A.1 row 12 | substat only, shoes only, cap 15 %; no cost-cut, brews or links |
| Every Line Counts (fill as ATK, static kit table, over-cap fill, card prints the result) | PC-L §B.1 | **soft limit instead of a hard bar**, from PD's "no line is ever worth zero" (PD §B.2); fill never removed in battle; Umeko and Miko fill into their aura (PD) |
| ATK → burns/poisons, Range → aura radius | PC-L Rules 2–3 (PD widens Range too) | DoT takes half of gear ATK, cap ×1.25 (critic pass) |
| Skill Haste on ⚡ abilities, `round(100 / (1 − h))` charge | both (PD §B.1, PC-L §E.3) | abilities take half; board-wide rallies and debuffs excluded; fill-in kept (critic pass) |
| Club favourites at ×2 weight | PD §A.3 | — |
| Prism Dice: the player picks the new main | PD §A.3 | slots keep today's 2/3/3 options |
| Clubs Mythic+ only, no gem price, Armband never sold for gems | PD §C.1, §C.4 | — |
| Every new drop rolls a club; weekly-boss **Club Focus**; one transfer item; welcome gift of 9 | PC-L §C.2 | item renamed **Club Armband** ("Patch" clashes with patch notes and patch gifts, `src/ui/lobby/notice.js`) |
| 3-piece play-changing rules (Finishing Thrust, Follow-Through, Finale Pop) | PD §C.2 | sizes cut to fit §D; Tea's rule simplified to Second Cup; Taiko's Big Beat and Bell's First Bell are new; Thrust no longer needs one target (critic pass) |
| Club list (story-bible clubs only) | PC-L (5) + PD (Pyrotechnics) | Astronomy, Robotics, Library, Bazaar, Art left for later |
| `TUNE_BITS` widened before GA R1 | PD §A.5 | 10 keys, not 12 |
| `gcl:` club mirror, new-stat line mirror, `inv:` mirror, SQL gear key `c` | PC-L §E.2 | the line mirror covers both new stats and carries a fingerprint (critic pass) |
| Clamp rows for every new sim key | both | — |
| **Rejected:** Boss DMG and Status Power as rollable stats (P3 §3.4 forbids broad boss multipliers; Status Power touches eight status kinds); 12-stat per-slot pools; new main stats; 8 clubs at once; Pocket Mines and Coin Jar; Talent Swap into Crit DMG | PD | revisit after train C's measured pass (§K) |

---------------------------------------------------------------------------------------------------

## A. The stats

### A.1 The ten stats

Stat definitions move to a new **non-hashed** `src/data/gearStats.js` (`GEAR_STAT_DEFS`), which spreads today's
`GEAR_STATS` and adds the new two. `src/data/types.js` is **not edited**: the sim imports it (`src/sim/towers.js:7`), so
it is in the co-op hash graph (`tools/simId.mjs:19-27`; RS §5.3).

| # | Key (save) | Card name | Kind | Common base (per line) | Main stat on | Substat on | Status |
|---:|---|---|---|---|---|---|---|
| 1 | `atkPct` | ATK | % | 3–6 % | Charm | all | **reach widened (M1)**: half of gear ATK also reaches burns and poisons |
| 2 | `ratePct` | Attack Speed | % | 2–5 % | Shoes | all | unchanged |
| 3 | `rangePct` | Range | % | 2–4 % | Ribbon | all | **reach widened (M1)**: also her aura's radius |
| 4 | `critChance` | Crit Rate | % | 2–5 % | Ribbon | all | unchanged |
| 5 | `critDmg` | Crit DMG | % | 5–12 % | Charm | all | unchanged |
| 6 | `armorPen` | Armor Pierce | flat | 1–2 | Ribbon | all | unchanged (new pieces renamed "Steelbreak …", see names) |
| 7 | `costCut` | Cost Reduction | % | 1–3 % | Shoes | all | unchanged |
| 8 | `ultHaste` | **Skill Haste** (was Ult Haste) | % | 3–7 % | Shoes | all | **renamed (M0)**; also reaches ⚡ abilities and hero skills at half rate (M2) |
| 9 | `piercePct` | **Pierce** | % | 8–16 % | never | **Ribbon, club pieces only** | **new (M1)** |
| 10 | `auraPct` | **Aura Power** | % | 2–4 % | never | **Shoes, club pieces only** | **new (M1)** |

- Today's eight rows are code (`src/data/types.js:238-252`); their per-rarity ranges, steps and maxima are unchanged
  (RS §1.2–§1.3). Gear % stats are stored as fractions (`src/data/types.js:236`), the new two included (0.46 = 46 %).
- **Names checked** (grep over `src docs CONTRACTS.md` and the sibling specs): "Skill Haste", "Aura Power", "Every
  Line Counts", "Fill-in", "Club Armband", "Club Focus", "Finishing Thrust", "Big Beat", "Second Cup", "Finale Pop",
  "Follow-Through", "First Bell" and "Platecutter" have 0 hits. Known overlaps, kept on purpose:
  - "Pierce" is already the attack type (`src/data/types.js:10`) and the battle panel's projectile-pierce label
    (`src/ui/battle/towerPanel.js:155`); the stat raises that same number, so the card gives it its own icon (an arrow
    through two dots) and the tooltip "Hits more enemies".
  - Pieces with an Armor Pierce main are named "Piercing …" today (`STAT_PREFIX.armorPen: ['Piercing', 'Steelbreak']`,
    `src/systems/gear.js:35`). From M1 new pieces use `['Steelbreak', 'Platecutter']`; stored names are never
    rewritten, so an old "Piercing Ribbon" keeps its name and its Armor Pierce main.
  - "Taiko" is already the elite **Taiko Oni** (`src/data/enemies.js:524`) and stage 7-4 "Drums of the Taiko"
    (`src/data/stages.js:648`); the club is the school's drum club, the same word on purpose.
  - AB's planned girl Ouka has **Assembly Bell** and a "Festival of Clubs" upgrade (AB:246); Bell Club is Suzu's story
    club (`docs/story/BIBLE.md:95`). Different screens; the wiki links them.
- The label override: `STAT_LABELS.ultHaste = 'Skill Haste'` in `gearStats.js`. Every UI read of a stat name goes
  through `statName(stat)`: `src/ui/unitBuild.js:41-45`, `src/ui/gearFilterBar.js:84-85`, `describeStat`
  (`src/systems/gear.js:381-382`). A grep test forbids `GEAR_STATS[...].name` outside `gearStats.js`.

### A.2 New-stat roll ranges (spec; the live formulas)

Rarity scale (`src/systems/gear.js:14`), step = mid × scale × 0.5 (`gear.js:20`, `:79-82`), UR = GA's scale 3.2, ×8/7
(GA R3). Both new stats scale at the full rate (only Armor Pierce scales at half, `gear.js:43-46`). Clubs exist only
from Mythic up (§C.1), so the Rare and Super Rare columns apply only if a later content type adds club pieces there.

| Stat | Mythic | Legendary | UR | Step L / UR | Average Legendary +10 line | Legendary ceiling (best + 3 ▲) | UR sweet spot (good roll + ▲ + ✦✦) |
|---|---|---|---|---|---:|---:|---:|
| Pierce | 17.6–35.2 % | **22.4–44.8 %** | 25.6–51.2 % | 16.8 / 19.2 % | **46 %** | 95 % | 102 % |
| Aura Power | 4.4–8.8 % | **5.6–11.2 %** | 6.4–12.8 % | 4.2 / 4.8 % | **11.6 %** | 23.8 % (capped 15 %) | 25.6 % (capped 15 %) |

"Average line" = average roll + 0.75 of a step (PD §A.2 method).

**Pierce sizing, re-derived per kit** (critic pass). One average line = +0.46 pierce at the full rate, +0.23 at half
rate. Measured value of +1 extra (RS §2.1, a packed lane with an orc every 0.1 s, so an **upper bound**) scaled to one
line; the reference is one ATK line (RS §2.1 column 1: 13–34 %, most girls 13–14 %).

| Kit | +1 measured (RS §2.1) | Rate | One average Pierce line | vs one ATK line |
|---|---|---:|---|---|
| Aoi (shots, base pierce 1) | +12–36 % | 1 | +6–17 % | about equal |
| Kage (shots, base pierce 2) | +16–54 % | 1 | +7–25 % | about equal, more in crowds |
| Momo (shots) | +32–120 % | **0.5** | +7–28 % | about equal (her damage is small) |
| Shiro (hitscan → line, `src/sim/towers.js:390-393`) | +33–155 % | **0.5** | +8–36 % | about equal on crowds, 0 on a boss |
| Miko (shots; her own 2 damage) | +33–119 % | **0.5** | +8–27 % of a near-zero number | fill-in for her (§B.2) |
| Raika beam path | +20–26 % | 1 | +9–12 % | a bit less |
| Rei / Hotaru (pulse, +2 targets per 100 %) | +14–34 % / +14–18 % | 1 | +6–16 % / +6–8 % | a bit less |
| Blasts (radius ×1.092 per line; measured +25 % radius) | Akane 20–25, Sango 20–34, Yuki −2–25, Midori 13–22 | 1 | Akane 7–9, Sango 7–13, Yuki 0–9, Midori 5–8 % | less, crowd only |
| Suzu (trap blast) | 0–29 % (+25 % radius) | 1 | 0–11 % | less |
| Raika jumps (+1 chain) | +7–14 % | 1 | +3–6 % | less |

Without the half rate, Shiro (67.5 % of Build A's boss damage, P3 §8.3) would get +15–47 % from one line in the
crowd lane, and an Archery Shiro (§C.2: 46 + 30 % plus Follow-Through, about +0.96 pierce) +32–99 %: a must-have for
every crowd wall. With it, an Archery Shiro is at about +0.48 pierce, +16–49 % (upper bound), comparable to Kage's +1. The PC1 elite wall and the PC3 crowd modes gate it (§D.4).

### A.3 Pierce on every kit (spec)

The gear stat is a fraction (`piercePct`, 0.46). `unitBattleStats` turns the capped total into the **unit-stat key
`pierceK`**, an integer in hundredths (46), so the sim never handles the fraction. The sim keeps an integer carry per
girl, the same pattern as P3's `projCarry` (P3 §6.2 N13):

```
k     = round(rate × (pierceK + (followThrough ? 100 : 0)))      // rate = PIERCE_RATE[kit], 1 or 0.5
carry += k; extra = min(maxExtra, floor(carry / 100)); carry = min(99, carry − 100 × extra)
```

`maxExtra` = 2, or 1 for half-rate kits. Follow-Through (§C.2) adds its 100 **after** the +150 % cap and before the
rate. Only her own counted attacks advance the carry and Follow-Through: P3's Shuriken Storm echo throws, Shadow
Doubles' volleys, drones and pops do not count as her attacks and take no gear Pierce beyond their own spec.

| Her attack (`behavior`, `src/data/units.js`) | 100 % Pierce means | Rate | Where in the sim | Girls (base kit) |
|---|---|---:|---|---|
| `projectile`, no splash | +1 pierce on that shot (spent per contact, `src/sim/towers.js:698-704`) | 1 (Momo, Miko 0.5) | carry per spawned shot | Aoi, Kage, Momo, Miko |
| hitscan (`projectileSpeed` 0) | +1 to the line count (`towers.js:391-393`) | **0.5** | `attackProjectile` | Shiro |
| `beam` | +1 beam pierce | 1 | `attackBeam` (`towers.js:450`) | Luna; Raika T4 and Miko T5 beams |
| `projectile` with splash | blast radius ×(1 + 0.2 × Pierce), no carry; ×1.3 at the cap | — | `applyUnitStats` on `s.splash` (`src/sim/mods.js:206-221`); `explode` (`towers.js:305`) | Akane, Sango, Yuki, Midori, Nami |
| `pulse` | +2 max targets (carry on 2k) | 1 | `attackPulse` (`towers.js:404-418`) | Rei, Hotaru, Hikari, Umeko |
| `chain` | +1 jump (carry) | 1 | `attackChain` (`towers.js:467+`) | Raika, Chika's Tesla path |
| `trap` | trap blast ×(1 + 0.2 × Pierce) | — | trap spec splash (`mods.js:152`) | Suzu |
| `turret` (drones) | +1 drone pierce (carry `droneCarry` on the owner tower) | 1 | the drone **fire site**, which hard-codes `pierce: 1` (`towers.js:590`; `towers.js:704` on `feature/chika-rework`) and wins over `turretSpec` (`towers.js:161`, `opts.pierce ?? spec.pierce` at `:346`) | Chika |
| `duel` | Kaede's blade arts (her AoE rework): +2 targets on every shape of the attack (cleave, crescents, storm, shockwave, maple splash), carry on 2k, at most +4; her strike itself takes none | 1 | `bladeArts` (`src/sim/towers.js`) | Kaede |
| hero ult, ⚡ abilities | nothing (abilities choose their targets, AB §3) | — | — | — |

- **Cap:** gear Pierce ≤ +150 % in total, club 2-piece included; the part above fills in (§B). Follow-Through sits
  outside the cap by design (it is the trick), so the most a single attack can carry is 250 × rate.
- Pierce never helps against a lone boss; that is the crowd half of every crowd-or-boss choice.
- The battle panel shows "Pierce 2 (+46%)" (today it shows integers, `towerPanel.js:155`).
- `PIERCE_RATE` is a frozen per-girl table in hashed `src/sim/gearRules.js`; new girls declare theirs.

### A.4 Aura Power (spec)

- Her aura's **bonus parts** grow: for each of `dmgMul`, `rateMul`, `rangeMul`, `v = 1 + (v − 1) × (1 + auraPct)`;
  path-cap's aura armor pen and aura crit (PC §3.2) × (1 + `auraPct`). Example: Miko's +10 % damage aura
  (`src/data/units.js`, base `aura.dmgMul 1.1`) with 15 % Aura Power gives +11.5 %.
- **Not touched:** `aura.costCut` (P3 §3.4 bans cost cuts; Momo's Savings Pact aura is cost-cut only), `detection`,
  `cleanse`, brews and links. An aura with only detection has no bonus part, so Aura Power does nothing to it (Umeko's
  base aura, `src/data/units.js:837`); her ★3 passive, Plum Rain from tier 1 and Lighthouse from tier 4 add bonus
  parts (`gear-stats/tools/units-dump.txt:41-44`).
- Path tiers stack (`collectModSets`, `src/sim/mods.js:184-189`) and aura mods multiply (`mods.js:135-143`), so a T5
  that adds only a cost cut keeps the T4 bonus (Chika's Grand Workshop keeps Signal Tower's `rangeMul 1.1`,
  PC SPEC:474).
- Auras stay "strongest wins" per key (`src/sim/towers.js:178-195`): a stronger aura wins, it does not stack.
- **Cap +15 %** for lines and the Tea 2-piece; Umeko's and Miko's fill-in adds up to +5 % on top (§B.1), so `auraPct`
  never exceeds 0.20.
- Real on the base kit for Miko; real from ★3 for Umeko; real on a path or a Potential step for Umeko (Plum Rain,
  Lighthouse T4), Hikari (Sanctuary), Luna (Astral Court; every path from P6 Eclipse Crown, P3:808), Nami (Harbor
  Watch), Hotaru (Guiding Lights; every path from P2 Firefly Lamps, P3:722), Chika (Repair Bay T4+) and Shiro
  (Overwatch Network T5, `src/data/units.js:917`). The hero rework moves heroes' path auras onto their level track.

### A.5 Slots, pools, favourites, Prism choice

- **Pools.** A piece **without a club** rolls and rerolls from today's 8 stats (7 options after the main,
  `gear.js:102-107`): its odds never change, old pieces included. A **club piece** adds the slot's new stat: ribbons
  8 + Pierce, shoes 8 + Aura Power; charms stay at 8. Old pieces keep their lines.
- **Club favourites.** A club piece rolls its club's three favourite substats (§C.2) at **×2 weight** in new rolls,
  every Fortune Dice reroll (`gear.js:238-261`) and the clash re-roll of a Prism Dice reroll (`gear.js:278-285`).
  `pickSubStats(rng, count, exclude, fav, pool)` draws by weight; it still draws one `rng.next()` per line.
- **Prism Dice: the player picks.** `rerollMainStat(profile, uid, rng, { stat })` takes the chosen main from the slot's
  list (today it picks at random, `gear.js:271-276`). The value still rolls in the main range; the price is unchanged
  (1 Prism Dice + coins, `gear.js:227-229`); the clash rule is kept.

**Odds of three wanted substats** (modelled, `tools/synth-odds.mjs` → `synth-odds.txt` and the critic-pass
`tools/synth-odds-v2.mjs 0` → `synth-odds-v2.txt`, 400k pieces each; Legendary, 4 substats; Fortune Dice at 3 per
Legendary reroll, `gear.js:219-224`):

| Piece | P(≥ 2 wanted) | P(3 wanted) | Rerolls (dice) |
|---|---:|---:|---:|
| Today: charm, ATK main, Crit Rate + Crit DMG + Speed | 61.6 % | 11.1 % | 9.0 (27) |
| SPEC, any piece **without a club** (pool unchanged), same kind of target | same as today | same as today | same |
| SPEC, Fencing charm, Crit Rate + Crit DMG + Armor Pierce (all favourites) | 84.3 % | **29.5 %** | 3.4 (10) |
| SPEC, Archery ribbon, Pierce + Speed + Crit DMG (two favourites) | 68.6 % | 14.1 % | 7.1 (21) |
| SPEC, Tea shoes, Aura Power + Range + Skill Haste (two favourites) | 69.9 % | 15.2 % | 6.6 (20) |
| SPEC, Taiko shoes, Speed main, ATK + Crit Rate + Crit DMG (one favourite) | 53.1 % | 7.3 % | 13.7 (41) |
| Rejected: all 10 in one shared pool | 41.2 % | 5.0 % | 19.9 (60) |

- A club whose favourites are not the lines she wants is worse than no club (the Taiko row). The Armband (§C.4) moves
  the piece to a club that fits; the card's "Best on" and the Armband modal show the favourites first.
- A Legendary club ribbon whose club does not favour Pierce carries a Pierce line 44.6 % of the time; club shoes carry
  Aura Power 43.5 % (same script).

### A.6 Caps (gear side, `unitBattleStats`, `src/systems/progression.js:265-286`, not hashed)

| Stat | Cap | Status | Typical best set (modelled) |
|---|---|---|---|
| Crit Rate (gear) | 75 % | live (`progression.js:276`) | 36–58 % (GA §7.1) |
| Cost Reduction | 25 % | live (`:279`) | 12–16 % |
| Skill Haste | 50 % | live (`:280`; `src/sim/hero.js:32`) | 27–31 % (GA §7.2); P3's `ult.haste` ≤ 0.20 shares it (P3 §3.4); ⚡ abilities and hero skills take half (≤ 25 %, §B.4) |
| Crit DMG | +200 % | GA R13 | +80–123 % |
| Range | +50 % | GA R13 | +17–31 % |
| **Pierce** | **+150 %** | new | 46–125 % on a Pierce build |
| **Aura Power** | **+15 %** (+5 % support fill on top) | new | 15 % on a support's best set |
| **Fill-in** | soft limit **+12 % ATK** (Umeko, Miko: +5 % Aura Power and aura radius, from M1) | new (§B) | 3–10 % |

`BATTLE_CAPS` (GA §7.3) gains `piercePct: 1.5` and `auraPct: 0.15`. Every cap shows a **MAX** tag, and the part over
it fills in (§B), so nothing over a cap is wasted any more, for heroes too.

---------------------------------------------------------------------------------------------------

## B. No dead stats

### B.1 Every Line Counts (exact)

**Rule (help-sheet text):** "If her kit can't use a line, or a stat is already at MAX, the line still helps: it turns
into ATK (Aura Power for Umeko and Miko). Each extra one adds a little less. Up to +12 % in all. Upgrades she buys in
battle never take it away."

1. **Which lines.** A line is a fill-in line when its stat is in the girl's `fill` list (`GEAR_FIT`, §B.2), plus the
   part of any capped stat above its cap (§A.6), **heroes included**. `GEAR_FIT` is decided from what a menu can see:
   her kit, her stars (`awakenPassive`) and her Potential. A path tier, a hero level or a ⚡ ability exists only in a
   battle, so `progression.js` cannot see it.
2. **Fill-in is never taken away.** A fill-in line still feeds its own stat (Suzu's crit lines still sit in her
   `critChance`, a Shiro Range line still widens her range), so when a battle-only upgrade makes the stat useful (a
   path aura, her ⚡ ability), she gets that on top. This small overlap is the price of "no girl ever gets weaker
   mid-battle"; it is bounded by the soft limit and by each stat's cap, and §D models it.
3. **Worth.** `w = 0.5 × value × mid(target, s) / mid(stat, s)`, where `mid` is the Common mid roll × the piece's scale
   `s` (UR included). For % stats `s` cancels; for Armor Pierce it does not (half-rate scale). Over-cap parts use the
   Legendary scale.
4. **Soft limit.** `f = Σ w`; her fill-in = `M × f / (f + M)` with `M = 0.12` (ATK). Each line's share on the card is
   `fill × w / f`. The total never reaches `M`, and no line is ever 0.
5. **Where it lands.**
   - Everyone except the two aura girls: added to the gear ATK part of `damageMul` (`progression.js:273`), so it
     reaches hits, traps and drones today (`src/sim/mods.js:208-216`) and, at half, burns and poisons from M1 (§B.3).
   - **Aura girls** (`GEAR_FIT.fillTo = 'aura'`: Umeko, role `support`, and Miko, role `enchanter`,
     `gear-stats/tools/units-dump.txt:41`, `:61`): from **M1**, `M = 0.05`, in its own bucket outside the 15 % Aura
     Power cap. The bucket raises `auraPct` **and** her aura radius by the same %, so it works even on a
     detection-only aura. Before M1 their lines are labelled "→ Aura Power from the battle update" and change nothing.

| A line of … | × value → ATK | × value → aura fill (Umeko, Miko; M1) | Average Legendary +10 line → fill weight (before the soft limit) |
|---|---:|---:|---|
| Skill Haste | 0.45 | 0.30 | 19.2 % → 8.6 % ATK |
| Range | 0.75 | — (real for aura girls) | 11.5 % → 8.6 % |
| Crit Rate | 0.643 | 0.429 | 13.5 % → 8.7 % |
| Crit DMG | 0.265 | 0.176 | 32.7 % → 8.7 % |
| Armor Pierce (per point) | 1.5 % C · 2.2 % L · 2.3 % UR | 1.0 % C · 1.5 % L · 1.5 % UR | 3.9 → 8.6 % |
| Pierce | 0.1875 | 0.125 | 46 % → 8.7 % |
| Aura Power (over its cap, or on a girl with no aura bonus) | 0.75 | 0.5 | 11.6 % → 8.7 % |
| ATK (aura girls only) | — | 0.333 | 17.3 % → 5.8 % |
| Attack Speed (Miko only) | — | 0.43 | 14.3 % → 6.1 % |
| Cost Reduction (only above 25 %) | 1.125 | 0.75 | — |

**The soft limit in practice** (modelled, `tools/synth-budget.mjs` header and one-liner): one average dead line gives
**+5.0 %** ATK, two **+7.1 %**, three **+8.2 %**, four **+8.9 %**, six **+9.7 %**.

**Why soft, not a hard bar.** PC-L's hard +8 % bar fills with one average Legendary line (8.6 % > 8 %), so a second Skill
Haste line read "bar full" and added nothing: the exact complaint. A soft limit makes every line count. PC-L's own
runs ruled out no limit at all (Shiro alone +17–20 % on the free board, PC-L §B.1).

### B.2 `GEAR_FIT`: what her kit can't use (static data, `src/data/gearStats.js`)

Decided by her **kit, stars, Potential and role**, never by a battle situation ("Range does little against a dense
stream" is a situation and gets no fill-in). The card can therefore show the result in menus, where no battle exists.
"(+ path)" marks a fill line that a battle-only upgrade also makes real (rule 2: she gets both).

| Girl | Fill-in lines (`fill`) | Target | Source of the fact |
|---|---|---|---|
| Hikari, Nami (heroes) | Aura Power (+ her level-track aura) | ATK | no aura on the base kit; auras come from paths, which the hero rework moves onto the level track |
| Luna (hero) | Aura Power until P6 (+ her level-track aura) | ATK | P6 Eclipse Crown gives an aura on every path (P3:808) |
| Aoi, Rei, Yuki, Momo, Akane, Kage, Raika, Midori | Skill Haste (+ ⚡ at half from M2), Aura Power | ATK | no ult reader but `hero.js:32` (RS §0.3); no aura with a damage, speed or range part |
| Sango | Skill Haste (+ ⚡), Armor Pierce, Aura Power | ATK | 14-damage hits + own pen 2: +0–1 % (RS §1.7) |
| Shiro | Skill Haste (+ ⚡), Range (+ Overwatch aura radius), Armor Pierce, Aura Power (+ Overwatch T5 aura) | ATK | range 10 covers the map; big hits (RS §1.7: Range 0 %, AP ≤ +2 %); T5 Overwatch Network aura `rangeMul 1.1` (`src/data/units.js:917`) |
| Suzu | Skill Haste (+ ⚡), Crit Rate, Crit DMG, Armor Pierce, Aura Power | ATK | traps never crit (`towers.js:145`); 12+ trap hits (RS §1.7) |
| Kaede | Skill Haste (+ ⚡), Armor Pierce, Aura Power | ATK | 10-damage ramping hits (RS §1.7: +1–6 %); Pierce is real since her AoE rework (§A.3 `duel` row) |
| Chika | Skill Haste (+ ⚡), Aura Power (+ Repair Bay T4+) | ATK | no aura on the base kit |
| Hotaru | Skill Haste (Firefly Hush is not hasted, §B.4), Aura Power until P2 (+ Guiding Lights) | ATK | P2 Firefly Lamps gives an aura on every path (P3:722) |
| Miko (aura girl) | ATK, Attack Speed, Crit Rate, Crit DMG, Armor Pierce, Pierce (+ Purification), Skill Haste (Shrine Chorus is not hasted) | aura (M1) | her own shots deal 2 damage; the partner's DPS was identical under every gear variant (RS §1.7 note) |
| Umeko (aura girl) | ATK, Crit Rate, Crit DMG, Armor Pierce, Pierce, Skill Haste (Lantern Flare is not hasted); Aura Power until ★3 (+ Plum Rain, Lighthouse T4) | aura (M1) | her own 1-damage pulse is not her job (RS §1.7 note); base aura is detection only (`units.js:837`) |
| Kanna, Yoriko, Seiran (returning staff heroes) | Aura Power (+ her level-track aura) | ATK | no aura on the base kit (`src/data/unitsExpansion.js`); Yoriko's stage aura comes from her level track |
| Fuu, Hana, Ruri, Iroha, Ena (returning students) | Skill Haste (+ ⚡ at half from M2), Aura Power | ATK | no ult reader; no aura on the base kit |
| Noa (returning student) | Skill Haste (+ ⚡ at half from M2) | ATK | her base sanctuary aura has +8 % damage (`unitsExpansion.js`), so Aura Power is real |

New girls (train D) each declare their `GEAR_FIT` row; a data test fails if a playable girl has no row.

### B.3 The two reach rules (M1, sim)

- **Half of gear ATK → burns and poisons.** Her burn/poison `dps` is multiplied by
  `dotMul = min(1.25, 1 + 0.5 × gear ATK part)` (lines, fill-in and club ATK). Today no gear stat reaches a DoT:
  `applyUnitStats` never touches `s.status` (`src/sim/mods.js:206-221`), and ticks run through `computeDot`
  (`src/sim/combat.js:151`). The `pct`-of-max-HP part that path-cap adds (PC §3.2) is **never** scaled.
  - Why half and a cap: P3 tuned Akane's and Midori's ladders on gear never reaching DoT (RS:27-29) and capped its own
    `girl.dotMul` at 1.20 (P3:221). The full rule would give `MAXED` ×1.19 and `UR_LATE` ×1.65 (3.97 / 2.412 − 1, base
    1 + 0.018·59 + 0.02·5 + 0.05·5 from `src/systems/progression.js:22-25`), about ×1.8 with fill and Pyrotechnics.
    The half rule gives `MAXED` ×1.10, `LATE` ×1.23 and `UR_LATE` ×1.25 (cap). With P3 the most any girl's DoT moves is
    1.20 × 1.25 = **×1.50**. Measured: +25 % DoT gave Toxicology Midori +14–22 % (RS:302), so the cap is worth about
    one and a half ATK lines to her.
- **Range → aura radius.** `s.aura.range *= u.rangeMul` in `applyUnitStats`, for every aura (detection auras too).
  Today the aura radius is untouched (RS §1.6; read in `recomputeBuffs`, `towers.js:178-195`). Coverage-bound: once
  every carry stands inside, more adds nothing.

### B.4 Skill Haste (M0 rename, M2 reach)

- **M0:** label only. Heroes keep exactly today's effect (`src/sim/hero.js:28-34`); on tower girls the line fills in.
- **M2 (with the tower abilities):**
  - Hero **ults** keep `h = min(0.5, ultHaste)` with P3's `ult.haste` inside the same cap (unchanged).
  - ⚡ **abilities and hero skills** take half: `h_ab = 0.5 × min(0.5, ultHaste)` (≤ 0.25), charging
    `round(100 / (1 − h_ab))` points a tick on AB's integer charge (100 per tick, AB §3.2). It multiplies with AB's own
    charge-rate effects (Ouka's Club Mentors, AB:246); the A7 gate below covers the product.
  - **Not hasted:** abilities of kind `rally` or `debuff`, which lift every girl's damage or hold the whole map:
    Hikari's Morning Rally, Luna's Moonbrand, Miko's Shrine Chorus, Umeko's Lantern Flare, Hotaru's Firefly Hush
    (AB:179, :184-185, :206-207), and later ones of those kinds (Ouka's Assembly Bell). Reason: Moonbrand marks the
    strongest enemies for "+20% damage from everyone" (rank 2: +25 %, 8 s every 25 s, AB:207); a full 50 % haste
    would take its uptime 32 % → 64 % and the board's boss damage ×1.08 → ×1.16, a ×1.07 boss multiplier for every
    free player (heroes are free), which P3 §3.4 forbids ("Boss / class multipliers: none", P3:230).
  - Copies of a girl share her stats, so a map-wide group (AB §3.3) charges at her one value. Momo's econ ability stays
    capped at 2 casts a wave (AB §3.3).
- **Never weaker at M2.** A tower girl's Skill Haste keeps its fill-in ATK for good (§B.1 rule 2); the ability haste
  comes on top. There is no `hasteFill` key and no mid-battle drop when she buys her ⚡ tier. The tier-3 panel says
  "Skill Haste also speeds Skyfall Volley (−x %)".
- **Budget (M2 gate).** AB §11 budgets abilities at their base cooldown: local ≤ +35 % of her own output,
  specialists ≤ +60 %, crowd and single-target gain ≤ 1.35× (specialists ≤ 1.6×) (AB:586-596). At the typical best
  set (27–31 % Skill Haste, GA §7.2) abilities cast ×1.16–1.18 as often, so +35 % becomes about +41 % and +60 % about
  +70 % (modelled). The M2 gate re-runs AB's A7 bench at the `late'` and `urLate'` haste values and requires the
  1.35× / 1.6× ceilings to hold; if one misses, that ability's cooldown grows, never the haste share.
- This **overturns AB:202** ("Gear `ultHaste` stays ult-only") for strike, burst, deploy, boost and econ abilities.
  Owner question 1; default yes.

### B.5 The girl × stat matrix after the change

●● a lot · ● a little or on one path · **F** fill-in (shown on the card) · **F→A** aura girl's fill-in into Aura Power
and aura radius (M1) · "+ x" a battle-only bonus on top of the fill. Measured cells are RS §1.7 and §2.1; the rest is
code. The Skill Haste column shows "until M2 → from M2". Bold marks a change from RS §1.8.

| Girl | ATK | Spd | Range | Crit R | Crit D | A.Pierce | Cost | Skill Haste | Pierce (what it does) | Aura Power |
|---|---|---|---|---|---|---|---|---|---|---|
| Hikari (hero) | ●● | ●● | ●● | ● | ● | ● | ● | ●● ult → ●● ult (Morning Rally not hasted) | **●● +2 pulse targets** | **F + her aura** |
| Luna (hero) | ●● | ●● | ● **+ aura** | ●● | ●● | ●● | ● | ●● → ●● ult (Moonbrand not hasted) | **●● beams** | **F (●● from P6) + her aura** |
| Nami (hero) | ●● | ●● | ● **+ aura** | ●● | ●● | ●● | ● | ●● → ●● ult + ● Frost Net | **● wider frost blast** | **F + her aura** |
| Aoi | ●● | ●● | ● | ●● | ●● | ●● | ● | **F → F + ⚡** | **●● +6–17 %** | **F** |
| Rei | ●● | ●● | ● | ●● | ●● | ●● | ● | **F → F + ⚡** | **●● +2 targets** | **F** |
| Yuki | ● | ●● | ●● | ● | ● | ● | ● | **F → F + ⚡** | **● wider frost blast** | **F** |
| Momo | ● | ● | ● | ● | ● | ● | ●● | **F → F + ⚡** | **● Coin Toss shots (half rate)** | **F** |
| Akane | **●● hits + ½ burn** | ●● | ● | ●● | ●● | ● | ● | **F → F + ⚡** | **● blast +7–9 %** | **F** |
| Sango | ●● | ●● | ● | ●● | ●● | **F** | ● | **F → F + ⚡** | **● blast +7–13 %** | **F** |
| Kage | ●● | ●● | ● | ●● | ●● | ●● | ● | **F → F + ⚡** | **●● +7–25 %** | **F** |
| Umeko (aura girl) | **F→A** | ● | **●● + aura radius** | **F→A** | **F→A** | **F→A** | ●● | **F→A** | **F→A** | **F→A (●● from ★3)** |
| Shiro | ●● | ●● | **F + Overwatch radius** | ●● | ●● | **F** | ● | **F → F + ⚡** Verdict Round | **●● line pierce (half rate)** | **F + Overwatch aura** |
| Midori | **●● hits + ½ poison** | ● | ● | ● | ● | ● | ● | **F → F + ⚡** | **● splash +5–8 %** | **F** |
| Suzu | ●● | ● | ● | **F** | **F** | **F** | ● | **F → F + ⚡** | **● wider trap blast** | **F** |
| Raika | ●● | ●● | ● | ●● | ●● | ●● | ● | **F → F + ⚡** | **● +1 jump (beam path ●●)** | **F** |
| Miko (aura girl) | **F→A + Purification shots** | **F→A** | **●● + aura radius** | **F→A** | **F→A** | **F→A** | ●● | **F→A** | **F→A + shots, beam** | **●●** |
| Hotaru | ●● | ●● | ● **+ aura** | ●● | ●● | ● | ● | **F** | **● +2 targets** | **F (●● from P2) + Guiding Lights** |
| Kaede | ●● | ●● | ● | ●● | ●● | **F** | ● | **F → F + ⚡** | **F** | **F** |
| Chika | ●● | ●● | ● **+ aura** | ●● | ●● | ●● | ● | **F → F + ⚡** | **● drones, Tesla jumps** | **F + Repair Bay** |

**Check.** 190 cells, **0 dead** (today 27 dead cells out of 152, PC-L §B.3 count of RS §1.8). A cell that is real only
on one path is now F with the path effect on top, so it is never dead off that path. Every girl has at least one ●●
stat. Suzu has 1 ●● (ATK), and all five of her fill-in lines turn into ATK too (Taiko's Big Beat also works on her
traps). Every stat is ●● for at least 2 girls (Aura Power: Miko, and Umeko from ★3; Cost Reduction: Momo, Umeko,
Miko).

---------------------------------------------------------------------------------------------------

## C. Academy Club sets

### C.1 Rules

- A **Mythic, Legendary or UR** piece may carry one club: `club: '<id>'`. Common to Super Rare never do (free players'
  Mythic sets play the same game as UR sets: bonuses do not scale with rarity, and UR does not multiply them).
- **2 pieces** of one club on a girl: the 2-piece stat. **3 pieces:** the stat and the club's **trick**. Three slots
  allow one full club, or a 2-piece plus any third piece.
- **2-piece stats** fold into the gear totals in `unitBattleStats` (not hashed). **Tricks** are sim rules; her `club`
  and `clubN` travel in her unit stats (§F).
- Club bonus lines obey Every Line Counts and the caps like any line.
- Only club pieces roll Pierce and Aura Power (§A.5).
- **Rainbow Resonance** (GA R14: +5 / +10 % Range for 2 / 3 UR pieces) is kept and stacks with a club. Awakening keeps
  the club.
- **Club captain** (cosmetic, PC-L §C.1): a girl in the full set of her own story club (Aoi Archery, Kaede Fencing,
  Raika Taiko, Akane Pyrotechnics, Rei Tea, Suzu Bell; `docs/story/BIBLE.md:92-95`) gets a club pin on her portrait.

### C.2 The clubs (spec numbers, critic pass)

| Club (ships) | Favourite substats (×2) | 2 pieces | 3 pieces: the trick (one sentence on the card) | Value (modelled, boss) |
|---|---|---|---|---|
| **Archery Club** (M1) | Pierce, Crit Rate, Attack Speed | **+30 % Pierce** | **Follow-Through**: "Every 5th attack gets +100 % Pierce." | crowd only |
| **Fencing Club** (M1) | Crit Rate, Crit DMG, Armor Pierce | **+3 % Crit Rate** | **Finishing Thrust**: "Every 25th attack deals double damage and ignores armor." | +4 % everywhere, more vs armor |
| **Taiko Club** (M1) | ATK, Attack Speed, Range | **+5 % Attack Speed** | **Big Beat**: "Every 10th attack hits 50 % harder." (traps: every 10th trap; drones: every 10th drone shot) | +5 % everywhere |
| **Pyrotechnics Club** (M1) | ATK, Pierce, Range | **+5 % ATK** | **Finale Pop**: "Enemies she defeats burst for 25 % of her hit." (0.9 tiles; pops never pop; a shared budget, §C.3) | crowd only |
| **Tea Club** (M1) | Aura Power, Range, Cost Reduction | **+6 % Aura Power** | **Second Cup**: "Girls in her aura (no aura: the 2 nearest) attack 2 % faster." (the 2 nearest girls within 2 tiles) | partner ×1.02 |
| **Bell Club** (M2) | Skill Haste, Attack Speed, Range | **+8 % Skill Haste** | **First Bell**: "When a wave starts, her hasted skills gain 10 % charge." | ⚡ uptime |

- **Why these numbers.** In the first draft Taiko (favourites ATK, Speed, Crit DMG) was the best boss set for every
  damage role at month 6 and for whales, because Fencing's Armor Pierce favourite is near-dead on boss carries.
  Taiko's third favourite is now Range and its numbers moved, and Fencing's Thrust no longer needs one target. On the
  re-run (§D) neither club leads any role by more than 1.8 % at month 6 (random rolls with favourites: Fencing ahead
  on 4 of 6 roles; fixed presets: Taiko ahead on all), inside the model's ±3 % noise. Crit-heavy girls lean Fencing,
  fast ones Taiko, armor and favourites decide the rest; the §D.4 gate measures it.
- **Finishing Thrust is not a boss multiplier.** The first draft required 20 attacks in a row on one enemy, which in
  practice only bosses and elites allow: a boss multiplier any girl could wear, against P3 §3.4 (P3:230). It now
  counts every attack, like Big Beat, so it is the same +4 % on a crowd as on a boss.
- **Later, each with new content** (names from the bible and AB, PD §C.2 rules as starting points, budgeted then):
  Astronomy (with Sorano), Art (with Iroha), Robotics (Pocket Mines), Library Committee (Margin Notes), Bazaar
  (Coin Jar).
- **Fits** (≥ 2 strong per girl at M1 except Umeko; table §C.6). Every trick does something on every kit except the
  named ones: Follow-Through does nothing for Kaede (duel), Second Cup's value is the partner's, First Bell needs a
  hasted skill.
- **A trick that does nothing for her is never shown as on** (owner default Q3; A3 M2 review look-1). One rule,
  `trickIdle` in `src/data/gearStats.js`: today only First Bell can be idle (her ability waits for a later update, or
  it is a rally or a debuff; in battle also before her ⚡ tier 3 / Lv 7). Her set chip turns flat grey with one calm
  line ("First Bell: no effect yet"), the gear totals' set line says why, the Club Armband picker says it under Bell
  for the girl wearing the piece, and the battle panel's Club cell drops "trick on". In this build First Bell charges
  her ⚡ ability or hero skill only, never a hero's ultimate (§C.3 lists the ult; not built).

### C.3 Tricks in the sim (deterministic; constants in hashed `src/sim/gearRules.js`)

| Trick | Code site | State (battle save, `src/ui/battle/snapshot.js:72`, `:98`) | Random draws |
|---|---|---|---|
| Follow-Through | each `attack*` after the "no target" return (`towers.js:379+`, `:404`, `:450`, `:467`), like P3's `potCount`: `t.ftN++`; at 5 the attack carries the +100 of §A.3 and `ftN = 0`. Echo throws, doubles' volleys, drones and pops do not advance it. A blast kit's 5th attack blasts at ×(1 + 0.2 × (Pierce + 1)) instead of ×(1 + 0.2 × Pierce) (`followThroughBlast`); a trap girl counts the traps that go off (`trapFtN`, like Big Beat's `trapBeatN`) and every 5th blasts that wide. | `trickN`, `trapFtN` (tower, snap) | none |
| Finishing Thrust | same sites: `t.thrustN++`; at 25 that attack's hits carry `hit.thrust = true` → `computeHit` (`src/sim/combat.js:73`) doubles `scale` and skips armor; `thrustN = 0` | `thrustN` (tower, snap) | none |
| Big Beat | same sites (traps: in the lay; drones: per drone shot on the owner tower): `t.beatN++`; at 10 the attack's damage ×1.5; `beatN = 0` | `beatN` (tower, snap) | none |
| Finale Pop | `_killEnemy(e, tower)` (`src/sim/Sim.js:406`): `explode(sim, tower, popSpec, e.x, e.y, 0.9)` (`towers.js:305`) with damage 0.25 × her current hit and `noPop: true`. **One budget for the whole sim**: `sim.popBudget` +1 every 2 steps, at most 6 banked, so at most 30 pops a sim second however many girls wear Pyrotechnics. | `popBudget` (sim, snap) | none |
| Second Cup | `recomputeBuffs` (`towers.js:178-195`): a `tea` buff key, rate ×1.02, strongest Tea wins, multiplies with auras like AB's rallies (AB §3.3); no aura: the 2 nearest girls within 2 tiles, ties by lower uid | derived | none |
| First Bell (M2) | the wave-start handler: +10 % of each of her full charges for hasted skills (integer points; hero ult `hero.js` cooldown ticks) | none | none |

Timers count fixed steps (`STEP = 1/60`, `src/sim/constants.js:4`). FX: event `clubTrick { towerUid, kind }`, pooled,
off on Low quality and with reduced motion (FX only; the sim never reads a quality setting).

### C.4 How a piece gets its club

| Way | Rule | Code (none hashed) |
|---|---|---|
| **Any new Mythic+ piece** (stages, Workshop Yard, Total Assault, Bounty boxes, achievement boxes, titan chests) | one live club at random (M1: 5 clubs; M2: 6) | inside `addGear` (`src/systems/gear.js:146`) when it assigns a fresh uid to a Mythic+ piece that has no `club` key, from a **separate** `createRng('club|' + profile.createdAt + '|' + uid)` (`src/core/rng.js:17`; `createdAt` from `src/systems/save.js:91`). `rollGear` cannot do it: every uid is still `null` there (`gear.js:123`, `:139`), so a `'club|' + uid` seed would put every stage drop in the same club. Stage drops reach `addGear` in `splitDrops` (`src/systems/rewards.js:62`), boxes in `openGearBox` (`gear.js:169`). No existing reward draw shifts. |
| **Titan Trials gear** (ASC's weekly bosses, ASC:76) | every Mythic+ piece from a titan chest opens in the player's **Club Focus**, picked on the Titan Trials hub (free to change). A Rainbow Gear Box opens "choose charm, ribbon or shoes" (ASC:677) and then lands in the Focus club. | `addGear(profile, gear, { club: focus })`; mirror `cfocus` in `missions.counters`; ASC change list §K.2 |
| **Club Armband** (new item) | "Tie it on a Mythic, Legendary or UR piece: it joins the club you pick. Its stats don't change." Re-clubbing costs another. | `club_band`, category `dice` ("Gear Tool", GA §4) |
| Pieces from before M1 | **No club**; every stat kept; today's reroll odds; one Armband joins any club (then they reroll from the club pool) | §E |

**Club Armband.** Cost: 1 Armband + 2,000 × (tier + 1) coins (tier from GA's `gearTier`: Mythic 8,000, Legendary 10,000,
UR 12,000). Not refunded on salvage (like Fortune Dice).

| Source (free) | Amount | Code |
|---|---|---|
| Welcome gift at the first M1 load | **9** once (three girls' full sets on day one), mark `gc:gift` | `missions.counters` |
| Bounty Exchange | 2 a week, 10 tokens each | `src/data/shop.js:54-61` block |
| Weekly commission **Club Day**: "Win 10 battles (sweeps count)." | 1 a week (+10,000 coins) | `WEEKLY_MISSIONS`, `src/data/missions.js:24-30` |
| Boss Exchange **Titan shelf** (ASC:88-90) | 2 a week for Assault Tokens, when Titan Trials ship | ASC change list §K.2 |
| Achievements "Join a Club" (1), "Full Set" (2), "Three Clubs" (2) | 5 once | achievements catalogue |

**No gem price** (GA's rule for Seeds and Needles, GA R6/R10). Pace (modelled arithmetic): 3 a week before Titan
Trials, 5 after, plus 14 one-time: a free player clubs their three best girls on day one and one more girl a week,
faster than Legendary supply (≈ 2.4 a week late, RS §4.2).

### C.5 Save shape

`club?: 'archery' | 'fencing' | 'taiko' | 'pyro' | 'tea' | 'bell'` on the piece; absent = No club. Club ids and their
indices (1–15, append-only) live in non-hashed `src/data/clubs.js` (`CLUB_IDS`); the sim has its own copy in
`gearRules.js` and a test asserts they match.

### C.6 Which clubs suit whom (M1)

Boss clubs (Fencing, Taiko) are within a few % of each other on every carry (§C.2); the order below follows the kit.

| Girl | Strong fits | Also fine |
|---|---|---|
| Hikari | Taiko, Tea (her aura) | Archery (pulse targets) |
| Luna | Archery (beams), Fencing | Tea |
| Nami | Fencing, Pyrotechnics (frost blast) | Tea |
| Aoi | Archery, Taiko | Fencing |
| Rei | Archery (pulse targets), Taiko | Fencing |
| Yuki | Taiko (more slows), Pyrotechnics | Archery |
| Momo | Taiko, Archery (Coin Toss shots) | — |
| Akane | Pyrotechnics, Taiko | Fencing |
| Sango | Pyrotechnics, Fencing (armor) | Taiko |
| Kage | Archery (crowds), Taiko (bosses) | Fencing |
| Umeko | Tea | Taiko |
| Shiro | Fencing (crit), Taiko | Archery (line pierce, half rate) |
| Midori | Pyrotechnics (poison kills pop), Taiko | — |
| Suzu | Taiko (Big Beat traps), Pyrotechnics (trap kills pop) | — |
| Raika | Archery (jumps), Taiko | Fencing |
| Miko | Tea, Archery (Purification) | — |
| Hotaru | Fencing, Tea (Guiding Lights) | Archery |
| Kaede | Fencing (crit), Taiko | — |
| Chika | Taiko (drones), Archery (drone pierce) | Tea (Repair Bay) |

---------------------------------------------------------------------------------------------------

## D. Power budget

### D.1 Method (modelled; two models, both in `gear-stats/tools/`)

- **Preset model** (`synth-presets.mjs` → `synth-presets-final.txt`; the first-draft numbers →
  `synth-presets-oldnumbers.txt`). Starts from the fixed stat blocks the P3 bands were set on: `MAXED`
  (`tools/freeplayBot.mjs:20`, F2P-steady), `LATE` (F2P-late) and `UR_LATE` (whales) (GA §7.2). A primed preset
  (`maxed'`, `late'`, `urLate'`) adds Every Line Counts from the preset's own dead parts (its Skill Haste, Shiro's
  Range, the big hitters' Armor Pierce), the club 2-piece stat and the trick. Miko gets Tea, one average Aura Power line
  and her aura fill-in. This is the model §D.3 uses, because P3's short factors are measured on these presets.
- **Random-roll model** (`synth-budget-v2.mjs` via `run-final.sh` → `synth-budget-final.txt`; first draft
  `synth-budget.mjs` → `synth-budget.txt`). Re-implements the live roll formulas (`src/systems/gear.js:12-22`, `:41-46`,
  `:320-328`), club-only new stats, favourites and the soft limit; profiles avg (one +10 Legendary per slot, moved into
  a club by Armband), best10 and UR b10. It shows what a player's real pieces gain, and its ±3 % Monte Carlo noise
  (120 trials; two columns that are identical by construction differ by up to 0.03) is why §C.2 calls the clubs even.
- **Board** = P3 Build A boss shares (Shiro 0.675, Kage 0.14, Aoi 0.11, Sango 0.07; P3 §8.3) × Miko's partner factor.
  **Build W** (Kaede, Chika, Hotaru, Shiro, Kage, Sango, Midori, Miko; Luna) uses **assumed** shares, since P3
  publishes none: Kaede 0.25, Shiro 0.25, Chika 0.14, Kage 0.12, Midori 0.10 (60 % of it poison), Hotaru 0.08,
  Sango 0.06, with half the board inside Hotaru's Guiding Lights (+55 % at P6, P3:726) and Luna's Eclipse Crown
  (P3:808). Auras are "strongest wins", so in Build W Miko's damage aura loses to Hotaru's and only her Second Cup
  counts.
- Both models leave out Pierce's crowd value, Range, armor, aura radius and coverage: they are boss-wall models. The
  crowd rows (PC1 elite wall, PC3, PC4) are measured gates, not modelled.

### D.2 One girl and the board (modelled; × the same preset or the same-tier pieces today)

**Preset model** (`synth-presets-final.txt`):

| Girl | `maxed'` fill only | `maxed'` best boss club | `late'` fill only | `late'` best boss club | `urLate'` best boss club |
|---|---:|---:|---:|---:|---:|
| Shiro | 1.027 | 1.122 | 1.062 | 1.157 | 1.151 |
| Kage | 1.000 | 1.092 | 1.042 | 1.135 | 1.130 |
| Aoi | 1.000 | 1.092 | 1.042 | 1.135 | 1.130 |
| Sango | 1.027 | 1.122 | 1.055 | 1.149 | 1.143 |
| Miko's partner (Tea, one Aura Power line, aura fill) | 1.010 | 1.066 | 1.011 | 1.066 | 1.067 |
| **Board A** (fill only / `clubs` lineup / every carry in her best boss club) | **×1.031** / ×1.154 / ×1.188 | | **×1.068** / ×1.199 / ×1.228 | | ×1.065 / ×1.192 / ×1.222 |
| **Board W** (assumed shares, best boss clubs) | — | — | — | ×1.201 | ×1.195 |

**Random-roll model** (`synth-budget-final.txt`; "+ best club" = her best of Fencing, Taiko, Pyrotechnics):

| Profile | Rule on today's pieces | + her best full club (avg / best10 / UR) |
|---|---:|---:|
| Carry (Rei, Raika, Hotaru, Chika, Akane) | 1.049 / 1.036 / 1.034 | 1.178 / 1.112 / 1.117 |
| Piercer (Aoi, Kage) | 1.049 / 1.033 / 1.035 | 1.137 / 1.119 / 1.108 |
| Shiro | 1.070 / 1.059 / 1.057 | 1.158 / 1.159 / 1.120 |
| Sango | 1.063 / 1.048 / 1.049 | 1.177 / 1.125 / 1.166 |
| Kaede | 1.064 / 1.045 / 1.049 | 1.161 / 1.153 / 1.126 |
| Suzu | 1.074 / 1.059 / 1.058 | 1.106 / 1.189 / 1.175 |
| Miko's partner in her aura (Tea) | 1.000 | 1.034 / 1.055 / 1.055 |
| **Board** | **×1.064 / ×1.052 / ×1.051** | **×1.193 / ×1.210 / ×1.182** |

- The two models agree within a few %: free month 3 ×1.15–1.19, free month 6 ×1.20–1.23, whale ×1.18–1.22, and
  Every Line Counts alone ×1.03–1.07. The first draft's ×1.154 (month 3) came from random pieces with dead mains; on
  the fixed presets its own numbers give **×1.20–1.22** (`synth-presets-oldnumbers.txt`), which is why §C.2 and the Aura
  Power cap were cut.
- Pieces without a club roll exactly as today, so the first draft's "new pools, no club" column (some girls below 1.0)
  is gone: nothing a free player rolls on Rare–SR gear changes.
- The free month-6 player gains about as much as a whale in ratio terms: "crazier late" stays inside the free
  player's reach. UR stays the whale layer (GA ×1.77).

### D.3 P3 / PC bands with this layer (P3 §8.5 short factor ÷ the upper board; ✓ holds, ⚠ tight)

| Stage · profile | Wall | P3 today | With this spec | Band | Holds? |
|---|---|---|---|---|---|
| 4-5 solo · F2P-steady (`maxed'` ×1.154–1.188) | 200 Matriarch | ✗ ×1.4 | ✗ ×1.18–1.21 | falls 185–200 (PC1) | ✓ |
| 4-5 solo · F2P-late (`late'` ×1.199–1.228) | 210 Regent | ✗ ×3.6 | ✗ ×2.9 | 195–210 (PC6) | ✓ |
| 4-5 solo · Whale A (`urLate'` ×1.192–1.222) | 210 Regent | ✗ ×1.8 | ✗ ×1.47 | ≤ 225 (PC7) | ✓ |
| 4-5 solo · Whale W (×1.195–1.201, assumed shares) | 210 Regent / 220 Daimyo | ≈ ×1.0 / ✗ ×1.7 | passes / ✗ ×1.42 | ≤ 225 (PC7) | ✓ |
| 4-5 co-op · F2P-steady pair | 200 Matriarch | ✗ ×1.2 | ✗ **×1.01–1.04** | PC8 −10…+5 of solo | ⚠ **likely breach** (default knob, §D.4) |
| 4-5 co-op · Whale A pair | 210 Regent | ✗ ×1.5 | ✗ ×1.23 | no co-op whale cap | ✓ |
| 8-5 solo · F2P-late | 200 Matriarch | ✗ ×1.8 | ✗ ×1.47 | PC2: 8-5 whale-only | ✓ |
| Build A2 (Chika) · F2P-steady / whale | 210 / 220 | — (P3 has no A2 ladder) | far below 225 if A2 ≈ A (A is ✗ ×5.6 at 210); whale A2 ≤ W (✗ ×1.42 at 220) | ≤ 225 / ≤ 235 (PC5) | ✓ (assumes A2 ≤ W; gated) |
| Tempest / Crimson Moon · F2P-steady | crowd modes | — (no P3 ladder) | not modelled (Pierce and Pyrotechnics are crowd stats) | 140–180 / 110–140 (PC3) | ⚠ gate |
| Path-cap elite wall · F2P-steady with Archery Shiro and Kage | elites | 185–200 band | not modelled | 185–200 (PC1) | ⚠ gate |
| Kage army (PC4, MAXED, Kage P6 L75) | elites | 135–170 | not modelled (the first draft's "+1–4 waves" had no derivation and is withdrawn) | 135–170 | ⚠ gate |
| Any · any | 250 Eclipse Wyrm | ✗ ×52–270 | ✗ **×43–234** | GA R22 / PC9: never | ✓ |
| Whale − F2P-late | — | +8 … +20 | about 0 waves (both ×1.20–1.23) | PC7 | ✓ |

**Kage's battle panel** (damage × rate × projectiles, `src/sim/Sim.js:763`; P3 §8.1 and P3:460): on `MAXED` she has
no dead line, so no fill-in. On best gold her Skill Haste fills in (+6.0 % on a 45 % gear ATK part, modelled):
**74.6k → 77.7k**; on UR (+6.5 %) **90.3k → 93.9k**, **117k → 122k** under Moonfall. With Taiko's +5 % speed about
**81k / 97k / 126k**. Tricks and Pierce are not on the panel. At M2 nothing comes off: she keeps the fill and Shadow
Doubles charges at half her Skill Haste.

### D.4 Gates and knobs (train C combined Freeplay pass: P3 §13.1, PC §6.5, GA §7.4)

**Presets and lineups.** Add `maxed'`, `late'` and `urLate'` (GA's blocks + fill-in + `pierceK`, `auraPct`, `dotMul`,
`club`, `clubN`) and three lineups: `clubs` (Fencing Shiro, Archery Kage, Taiko Aoi, Pyrotechnics Sango, Tea Miko),
`clubsBoss` (every carry in her best boss club by §D.2) and `clubsCrowd` (Archery Shiro, Archery Kage, Pyrotechnics
Sango and Akane, Tea Miko).

**Gates (M1):**
- §D.3 rows on 4-5 and 8-5, solo and `--coop 2`, seeds 7 and 11, with `maxed'` / `late'` / `urLate'`.
- **PC8 at `maxed'` `--coop 2`**: the pair must still fall to the 200 Matriarch on both seeds.
- **PC1 elite wall and PC3** (Tempest 140–180, Crimson 110–140) with `clubs` and `clubsCrowd`.
- **PC5** Build A2 with `maxed'` and `urLate'`; **PC7** Build W with `urLate'` and `clubsBoss`, ≤ 225 on 4-5.
- **PC4** Kage army with Archery at the Pierce cap.
- **Club spread:** at `late'`, no club may lead by more than 3 % on more than half of the damage roles (§D.2 roles).
- **Perf** (`tests/sim/perf.freeplay.test.js`, which runs a 60-girl late co-op board, `:1-4`), all at 3×, inside the
  frame budget: (a) the 60-girl board with `clubsCrowd` on every girl (Pyrotechnics everywhere, Pierce at cap);
  (b) P3's cap-legal Kage army (28 copies, P3:1233) with Pierce at cap + Archery + Pyrotechnics; (c) the same army at
  M2 with 50 % Skill Haste (Shadow Doubles' uptime ×1.33 at most, cooldown 40 → 30 s); (d) four Archery Shiros with
  line pierce (`linePierce` grid query + sort per shot, `towers.js:360-376`). The sim never reads the quality setting;
  if (d) misses, knob 6 below.

**Gates (M2):** AB A7 at `late'` / `urLate'` haste (§B.4); every girl's ⚡ build ≥ her M1 self; Kage army perf (c).

**Knobs, in order** (gear gives way first, GA R22, P3 §9.4; never Potential, path-cap tiers or Freeplay's enemy side):
1. Finishing Thrust every 25th → 30th; Big Beat every 10th → 12th. **This is the default response if the PC8 pair
   beats the Matriarch**; then knob 2.
2. Soft limit `M` 12 % → 9 %.
3. Archery 2-piece +30 % → +20 % Pierce (PC1, PC3, PC4 gates).
4. Aura Power cap 15 % → 12 %; Second Cup +2 % → +1 %.
5. Last, GA's own UR knobs (no ✦✦ on one line, then one stitch per UR piece).
6. Perf only: gear Pierce stops reaching hitscan (Shiro's lines fill in), deterministic for every player.

If a band runs **short**, the first knob to raise is the tricks' frequency.

---------------------------------------------------------------------------------------------------

## E. Existing gear, saves and older builds

### E.1 Nothing gets weaker

- Every stored line keeps its key and value. Ult Haste lines read "Skill Haste" with the same number; heroes get the
  same ult; tower girls get fill-in ATK (from 0) and keep it after M2.
- Over-cap amounts that were wasted now fill in, for heroes too. Old pieces show **No club**, keep today's reroll odds,
  and can join a club with an Armband.
- **Guard test** (fixture saves + 10,000 random profiles, every girl, at M0, M1 and M2 rules): `unitBattleStats` after
  ≥ before on `damageMul`, `rateMul`, `rangeMul`, `critChance`, `critMul`, `armorPen`, heroes' `ultHaste`, and
  `auraPct`; `costMul` never rises. No exceptions: Umeko's and Miko's fill starts at M1 and is never rerouted.
- **In-battle guard** (M2): a girl's resolved damage never drops when she buys a tier (sim test over every ⚡ path).

### E.2 Save model (additive; `SAVE_VERSION` stays 2, `src/systems/save.js:19`)

- **Piece:** `{ …today's fields, club? }`; subs may hold `piercePct` (ribbon) or `auraPct` (shoes) on a club piece;
  never as `main`.
- **Item:** `club_band`.
- **Readers (M0):** `cleanStat` (`save.js:189-195`) accepts any key of `GEAR_STAT_DEFS` (today only `GEAR_STATS`,
  `:190`); `cleanGear` (`:197-220`) keeps `club` when it is in `CLUB_IDS` and drops a new-stat line whose slot is wrong;
  `gear.js`, `gearFilter.js` (`:36`, `:46-47`), `profileCard.js` (`:8`, `:89`, `:98`) and `unitBuild.js` read
  `GEAR_STAT_DEFS`.

### E.3 What an older build does, and the mirrors

| Thing | Older build (code) | Guard |
|---|---|---|
| A `piercePct` / `auraPct` substat | `cleanStat` returns null (`save.js:190`), the line is **silently deleted**, no backup (`migrationDropsData` checks whole pieces only, `:502`); the piece keeps fewer subs than its rarity allows, and an old Fortune Dice reroll redraws that same smaller count (`gear.js:250-252`) | Reader ≥ 2 weeks before M1 (GA R17's rule) + mirrors `gnx:<uid>` and `gnf:<uid>` |
| `club` field | dropped by the allowlist object (`save.js:210-220`) | mirror `gcl:<uid>` |
| `club_band` item | dropped, load marked lossy (GA §8.2) | `inv:club_band` (GA §8.3 pattern) |
| A new **main** stat | would delete the whole piece (`save.js:199-200`) | **cannot happen**: new stats are never mains |
| Battle save | loadout `stats` stored whole (`src/systems/battleSave.js:178-181`); new keys survive | `KNOWN_TOWER_KEYS` / `KNOWN_SIM_KEYS` rows (§F.4) |

**Mirrors** in `missions.counters` (kept word for word by every build; GA §8.3):

| Key | Value | Written | Restores |
|---|---|---|---|
| `gcl:<uid>` | club index 1–15 | armband, drop, salvage, every load | `club` on a present Mythic+ piece |
| `gnx:<uid>` | `stat × 10,000,000 + index × 1,000,000 + ups × 100,000 + tuned × 10,000 + round(base × 10,000)` with stat 1 = Pierce, 2 = Aura Power, index 0–3 in `subs`, ups 0–4, tuned 0–3 (GA ✦ bits), base in Legendary form (≤ 0.9999) | roll, reroll, stitch, enhance, salvage, load | see below |
| `gnf:<uid>` | fingerprint of the piece's **other** subs: `floor(Σ base × 1,000,000) mod 1,048,576` (bases are fresh `rng.range` draws on every reroll, so any reroll changes it) | with `gnx:` | — |
| `inv:club_band` | item count, 0 included | `setCount` (`src/systems/inventory.js:36-42`) | `items.club_band` |
| `gc:gift`, `cfocus` | 1 / club index | when paid / picked | once-only gift; Focus choice |

**Restoring a new-stat line** (`restoreGearMarks` step after GA's step 3):
1. The piece is present, has no line of that stat, and the fingerprint of its current subs equals `gnf:`: the old tab
   only deleted the line. Put it back at `index` with base, ups and tuned; recompute the value (GA §8.3 step 4).
2. The fingerprint differs: an old tab rerolled the piece meanwhile, so its ▲ were re-dealt over the remaining subs.
   Drop both mirrors. If the piece has fewer subs than its rarity allows, add one fresh line at 0 ▲, drawn from
   `createRng('gnx|' + profile.createdAt + '|' + uid)` out of the piece's pool (club pool if it has a club).
3. Canonicalisation (GA §8.3 step 4) gains: **if Σ ▲ > floor(level / 3), take the excess from the restored line**,
   so no path can leave more upgrades than the rules allow.

Then the mirrors are rewritten (keys of pieces that are gone are dropped). Idempotent:
`migrateProfile(migrateProfile(x))` deep-equals `migrateProfile(x)`.

**Profile card.** `piercePct` and `auraPct` fit the key check `^[a-zA-Z]{1,16}$` (RS §5.2); an older viewer drops the
sub (`src/online/profileCard.js:98`), cosmetic only. Clubs need a **6th gear key `c`** (club index 0–15): add it to
the same SQL amendment GA R19 already requires before the profile M2 paste (GA §9.2). Until then cards show no club.

---------------------------------------------------------------------------------------------------

## F. Co-op, the sim id and clamps

### F.1 Hash impact per milestone

- Hashed: `src/sim/**`, co-op `commands`/`lockstep`/`session`/`loadout`/`version`, `src/data/coop.js` and their import
  graph (`tools/simId.mjs:19-27`), which includes `src/data/types.js`.
- **M0: no hashed file changes.** The label, Every Line Counts and Prism choice live in `progression.js`, `gear.js` and
  the new `gearStats.js` / `clubs.js`; `src/sim` must never import those two (grep test). Each player's stats travel
  whole (`src/online/coop/loadout.js:16-23`) and are merged as received (`src/online/coop/commands.js:85`), so an M0
  player and an older partner stay in lockstep, as with UR (GA §9.1).
- **M1 (battle update, train C):** `DEFAULT_UNIT_STATS` (`src/sim/constants.js:82-94`) gains `pierceK: 0`,
  `auraPct: 0`, `auraRangeMul: 1`, `dotMul: 1`, `club: null`, `clubN: 0`; reads in `mods.js`, `towers.js`,
  `combat.js`, `Sim.js`; new hashed `src/sim/gearRules.js` (`PIERCE_RATE`, trick constants, sim `CLUB_IDS`). The co-op
  id changes **once**, inside train C's bump (P3 §15; GA R18). An older peer cannot pair (`version.js`).
- **M2 (tower abilities):** the half-rate charge and the not-hasted kinds ride AB's own hashed change. No new key.

### F.2 Clamp rows (added to GA's `clampUnitStats`, `src/online/coop/statLimits.js`, train C, GA §9.1)

| Key | Rule | Honest max (modelled) |
|---|---|---|
| `pierceK` | integer 0–200 | 150 (capped at source; Follow-Through is a sim constant, not a stat) |
| `auraPct` | 0–0.3 | 0.20 (15 % lines + 5 % fill) |
| `auraRangeMul` | 1–1.2 | 1.05 (aura girls' fill) |
| `dotMul` | 1–1.5 | 1.25 (capped at source) |
| `club` | one of `CLUB_IDS` or `null` (else `null`) | — |
| `clubN` | integer 0–3 | 3 |
| `damageMul` (existing) | 0–10 (GA) | ≈ 8.3: P3's UR honest maximum at L85 is 7.57 (P3:373-374); fill-in (+0.12) and Pyrotechnics (+0.05) on its gear ATK part 1.645 give ×1.064 → 8.06, and ASC's gates 6–10 (×1.035) → 8.34; headroom ×1.20 |
| `ultHaste` (existing) | 0–0.5 (GA) | 0.5 |

Non-finite → the `DEFAULT_UNIT_STATS` value. GA's test "every `DEFAULT_UNIT_STATS` key has a rule" covers them, and a
clamp-identity test runs on the L85 + P6 + UR_MAX + fill + Pyrotechnics profile.

### F.3 Determinism

- `pierceK` is an integer of hundredths, rounded in `progression.js` from the fraction gear stores; carries and
  counters are integers on the tower; `popBudget` is an integer on the sim.
- `auraPct`, `auraRangeMul` and `dotMul` are rounded to 4 decimals like every unit stat (`progression.js:271`).
- No rule calls `sim.rng`; Pierce-widened splash and the Thrust skip of armor change no draw count.
- Club rolls use their own rng in `addGear`, outside any battle; co-op wins drop no gear (GA §6.4).

### F.4 Battle save and engines

- `KNOWN_TOWER_KEYS` (`src/ui/battle/snapshot.js:98`): `pierceCarry`, `droneCarry`, `ftN`, `thrustN`, `beatN` (snap);
  `tea` (derived). `KNOWN_SIM_KEYS` (`:72`): `popBudget` (snap). One split-run case each.
- `START` is unchanged (neutral new keys). Pin a new **`GEAR_START`** once with the `clubs` lineup, equal in every
  engine.

---------------------------------------------------------------------------------------------------

## G. Screens (844 × 390 first, then 1280 × 720; rows ≥ 36 px)

| Surface | What ships |
|---|---|
| **Gear card** (`gearCard`, `src/ui/screens/backpack.js:104`) | Club emblem chip (bow, foil, drum, firework, teacup; bell at M2) in the club colour; a ✧ beside favourite substats; new icons (Pierce: arrow through two dots; Aura Power: ring of petals). On a girl's page each line shows one of three states: **real** (normal), **fill-in** (grey, "→ +2.4% ATK", plus "· also boosts her Overwatch aura" when a path uses it), **MAX** ("75% MAX · +6% → +1.9% ATK"). Before M1, Umeko's and Miko's fill lines read "→ Aura Power from the battle update". Spare pieces show plain values and a "Best on" row. |
| **Equipment tab** (`src/ui/screens/student.js`, totals line `:582-585`) | Club strip under the three slots: emblem, "Archery Club ●●○", the 2-piece line (lit when active), the 3-piece trick sentence (dim until 3). A **Fill-in** meter: "Fill-in +6.9% ATK (up to 12%)". Totals list 10 stats with MAX tags. A **?** opens the help sheet (§B.1 text verbatim). |
| **"Best on" hints** | Up to 4 portraits of the player's own girls, ranked by ●● lines for her (`GEAR_FIT` and §B.5), club fit as tie-break; F lines never count. Tap → equip (today's flow, `gear.js:180`). Student page: a "Wants" strip, e.g. Shiro "ATK · Crit DMG · Pierce · Fencing". |
| **Club Armband modal** | Five club rows: emblem, sentence, favourites first, 2-piece and trick lines, "Suits:" portraits; before → after preview of her club strip; price; "Tie it on!" |
| **Prism Dice modal** | The slot's main stats as choices; the value range shown before confirming. |
| **Filters** (`src/systems/gearFilter.js`, `src/ui/gearFilterBar.js`) | Club chips; "Has Pierce", "Has Aura Power"; "Good for <girl>". |
| **Titan Trials hub** (ASC) | Club Focus picker with the same rows. |
| **Battle panel** (`src/ui/battle/towerPanel.js`) | "Pierce 2 (+46%)"; a club pip by her name; a small ring that fills toward Finishing Thrust / Big Beat; at M2 the ⚡ tier shows "Skill Haste also speeds <ability> (−x %)". |
| **Wiki** (`src/data/wiki.js`) | "Gear stats and clubs": what each stat does on each kit (§A.3 in plain words), the help sheet, the club table, which abilities Skill Haste speeds. |
| **Patch note** | "Ult Haste is now Skill Haste. Lines a girl can't use now turn into ATK. New: Pierce, Aura Power and the Academy Clubs!" |

---------------------------------------------------------------------------------------------------

## H. Code plan

| File (hashed?) | Change | M |
|---|---|---|
| `src/data/gearStats.js` (new, no) | `GEAR_STAT_DEFS` (8 + 2), `STAT_LABELS`, `statName`, `SUB_POOLS` (with and without club), `NEW_STAT_SLOT`, `GEAR_FIT` (incl. `fillTo`, star and Potential conditions), fill rates, `FILL_SOFT_M`, `AURA_FILL_M`, caps | M0 |
| `src/data/clubs.js` (new, no) | `CLUB_IDS`, club table (favourites, 2-piece stat, trick text), Armband prices, welcome gift | M0 (ids), M1 |
| `src/data/items.js` (no) | `club_band` (`dice`) | M0 (no source), M1 |
| `src/systems/gear.js` (no) | read `GEAR_STAT_DEFS`; slot pools by club; weighted `pickSubStats`; `rerollMainStat(…, { stat })`; `gearFillIn(profile, unitId)` (total + per-line shares); `clubOf`, `clubCount`, `applyArmband`; club roll inside `addGear` (`:146`); armorPen name prefixes `['Steelbreak', 'Platecutter']` for new pieces (`:35`) | M0 (reads, fill, Prism), M1 (rolls, clubs, names) |
| `src/systems/progression.js` (no) | fill-in into `damageMul` (M0); aura fill, caps, 2-piece stats; `pierceK`, `auraPct`, `auraRangeMul`, `dotMul`, `club`, `clubN` out (M1) | M0, M1 |
| `src/systems/save.js`, `src/systems/gearMarks.js` (GA, no) | readers; `gcl:`, `gnx:`, `gnf:`, `inv:club_band`, `gc:gift`, `cfocus`; restore steps of §E.3 | M0 |
| `src/systems/rewards.js`, `src/data/shop.js`, `src/data/missions.js` (no) | Titan chest Focus; `bty_club_band`; Club Day | M1 |
| `src/sim/gearRules.js` (new, **hashed**) | `PIERCE_RATE`, Pierce translation and trick constants, pop budget, sim `CLUB_IDS` | M1 |
| `src/sim/constants.js`, `mods.js`, `towers.js` (incl. the drone fire site `:590`), `combat.js`, `Sim.js` (**hashed**) | §A.3, §A.4, §B.3, §C.3 | M1 |
| `src/online/coop/statLimits.js` (**hashed**, GA) | §F.2 rows | M1 |
| `src/sim/hero.js` + AB's ability module (**hashed**) | half-rate ability charge, not-hasted kinds, First Bell | M2 |
| UI files of §G | screens | M0 (labels, fill text, Prism, hints), M1 (clubs, new stats) |
| `docs/ECONOMY.md`, `CONTRACTS.md` (GearInstance, unit stats), `docs/FREEPLAY.md` (presets) | docs | M0–M2 |

**Never touched:** `src/data/types.js`, `src/data/stages.js` (battle-data hash, `src/online/coop/version.js:40`).

---------------------------------------------------------------------------------------------------

## I. Tests

| File | Cases |
|---|---|
| `tests/systems/gearStats.test.js` (new) | ranges per rarity and UR = §A.2; Pierce only on club ribbon subs, Aura Power only on club shoes subs, never a main; un-clubbed pieces draw from today's 8 (draw sequence identical to today for a fixed seed); favourites ×2 (chi-square on 50k rolls); `rerollMainStat` with `{ stat }` picks it and refuses a stat outside the slot; `statName('ultHaste') === 'Skill Haste'`; grep: no `GEAR_STATS[…].name` outside `gearStats.js`; every playable girl has a `GEAR_FIT` row; new armorPen pieces never get "Piercing" |
| `tests/systems/fillIn.test.js` (new) | §B.1 table values; soft limit 1/2/3/4/6 lines = 5.0/7.1/8.2/8.9/9.7 % (average Legendary lines); every fill line > 0; over-cap parts fill **for heroes too**; a hero's Aura Power line fills in; Umeko/Miko: no fill at M0, `auraPct` and `auraRangeMul` fill at M1, outside the 15 % cap; Luna's Aura Power stops filling at P6, Hotaru's at P2, Umeko's at ★3 |
| `tests/systems/neverWeaker.test.js` (new) | §E.1 guard over fixtures + 10,000 random profiles at M0, M1 and M2 rules |
| `tests/systems/clubs.test.js` (new) | 2 / 3 pieces activate; Mythic+ only; 50 Mythic+ stage drops through `splitDrops` cover every live club; the club roll happens in `addGear` with its own rng (all other drops identical to before for a fixed seed); Armband price per tier, refused on Super Rare; Club Focus; gift once |
| `tests/systems/save.test.js` (extend) | round trip with clubs and new-stat lines, no `lossy`; vendored old `cleanGear` strips them, the new load restores from `gcl:` / `gnx:` when `gnf:` matches; **old tab drops Pierce, rerolls, then the new build loads**: mirror dropped, piece refilled to its sub count, Σ ▲ ≤ floor(level/3); idempotence; hostile counters |
| `tests/sim/gearSim.test.js` (new) | Pierce per kit (§A.3) incl. carry sequences (46 % → extra on attacks 3, 5, 7…; a 46 % gear line becomes `pierceK` 46 end to end); half rate on Shiro, Momo, Miko and `maxExtra` 1; a drone with 100 % Pierce hits 2 enemies; Follow-Through after the cap, echo throws and doubles do not advance `ftN`; splash ×1.3 at cap; Aura Power on bonus parts only, not `costCut`; `dotMul` = min(1.25, 1 + 0.5 × gear ATK), not `pct`; aura radius × `rangeMul` and × `auraRangeMul`; each trick's counter and reset; Finale Pop sim-wide budget; no `rng` draw added (draw count equal with and without clubs) |
| `tests/sim/abilities.haste.test.js` (new, M2) | charge = `round(100 / (1 − 0.5 × h))`; Morning Rally, Moonbrand, Shrine Chorus, Lantern Flare, Firefly Hush charge at 100 whatever the haste; hero ults keep the full haste; no damage drop when a ⚡ tier is bought |
| `tests/online/coopStatLimits.test.js` (GA, extend) | §F.2 rows; `clamp(unitBattleStats(max))` is the identity on the L85 profile |
| `tests/sim/snapshot.test.js`, `tests/online/engines.test.js` | split runs for §F.4 keys; `START` unchanged; `GEAR_START` equal in every engine |
| `tests/sim/perf.freeplay.test.js` | §D.4 perf cases (a)–(d) |
| `e2e/gear-stats.mjs` (new, 844×390 and 1280×720) | fill-in text on a Skill Haste line for Kage; MAX + fill line; Umeko's M0 label; Armband flow; club strip pips; Prism choice; "Best on" equips; no horizontal overflow |
| Measurement (train C pass, §D.4) | every §D.4 gate |

---------------------------------------------------------------------------------------------------

## J. Milestones

| M | Ships with | Contents | Co-op id | Gate |
|---|---|---|---|---|
| **M0** | **GA R1 "reader"** (or any normal update before it) | Skill Haste label; **Every Line Counts** on today's 8 stats (ATK fill only; Umeko's and Miko's lines labelled, no fill yet); MAX + fill on cards and the Fill-in meter; **Prism choice**; "Best on" hints; readers for `piercePct`, `auraPct`, `club`, `club_band`; mirrors and restore steps; **GA `TUNE_BITS` widened to 10** | unchanged | never-weaker; save round trips; `simId()` unchanged; **one capBot Freeplay run** (Build A, `late'` with fill, 4-5 Blossom, seeds 7/11) inside the live bands, since fill-in changes live solo and co-op power (modelled ×1.07 at `late'`) |
| **M1** | **The battle update** (train C: hero rework → Chika → path-cap → P3 → codex modes), **≥ 2 weeks after M0** | Pierce and Aura Power roll on club pieces; kit translation; half ATK → burns/poisons; Range → aura radius; aura girls' fill; **Archery, Fencing, Taiko, Pyrotechnics, Tea** with tricks; Club Armband, gift, sources; random club on Mythic+ drops; Club Focus when Titan Trials exist (if they ship first, their Mythic+ pieces are No club until M1); clamp rows; battle-save keys; `GEAR_START` | changes **once** (train C) | every §D.4 M1 gate; knobs §D.4 |
| **M2** | **The tower abilities** (AB A1; with train C if AB lands in it) | ⚡ abilities and hero skills at half Skill Haste; not-hasted kinds; **Bell Club** (First Bell) | with AB's change | §D.4 M2 gates |
| Later | with Sorano, Iroha and later content | Astronomy, Art, Robotics, Library Committee, Bazaar clubs; gear presets (GA §14 #5); a third new substat only if the measured pass leaves room (owner question 3) | — | budget rerun |

---------------------------------------------------------------------------------------------------

## K. Exactly what changes in the sibling specs

### K.1 `gear-awaken/SPEC.md`

1. **§1 R13, §3 table, §4 Needle "Caps" row, §7.1, §7.2, §7.3:** the label "Ult Haste" → "Skill Haste" (key `ultHaste`
   unchanged). §7.3 `BATTLE_CAPS` adds `piercePct: 1.5, auraPct: 0.15`.
2. **§3 table:** add rows **Pierce** (×1.143; step 16.8 % → 19.2 %; never a main; club pieces only; sweet spot 102 %)
   and **Aura Power** (×1.143; step 4.2 % → 4.8 %; never a main; club pieces only; capped 15 %).
3. **§4 Stitch modal / caps row:** "warns (it does not block)" stays; the warning text becomes "At MAX: the extra fills
   in as ATK" (Every Line Counts), so a stitch on a capped line is no longer pure loss.
4. **§8.1 stored shape:** the piece may carry `club`; club pieces' subs may hold `piercePct` (ribbon) or `auraPct`
   (shoes).
5. **§8.3 `TUNE_BITS`:** the frozen list becomes **10 keys**, append-only:
   `['atkPct', 'ratePct', 'rangePct', 'critChance', 'critDmg', 'armorPen', 'costCut', 'ultHaste', 'piercePct', 'auraPct']`;
   `gtn:` ≤ **1,048,575** (20 bits). This must land **in R1**, before any piece can be stitched.
6. **§8.3 `restoreGearMarks`:** after step 3, run gear-stats §E.3 (`gcl:`, `gnx:` with the `gnf:` fingerprint,
   `inv:club_band`, `gc:gift`); step 4 gains "if Σ ▲ > floor(level/3), take the excess from the restored line".
7. **§8.4 R1 contents:** + the gear-stats M0 readers (`GEAR_STAT_DEFS` in `cleanStat`, `club` in `cleanGear`).
8. **§9.1 clamp table:** add the rows of gear-stats §F.2 (`pierceK`, `auraPct`, `auraRangeMul`, `dotMul`, `club`,
   `clubN`); `damageMul` honest max ≈ 8.3 at L85 (headroom ×1.20 under the 10 clamp).
9. **§9.2 profile SQL:** the same amendment adds optional gear key **`c`** (club index 0–15) to the allowlist
   (`s, r, l, m, x` → `s, r, l, m, x, c`); `cleanViewedCard` keeps `c` when it is a known club.
10. **§7.4 guard runs:** presets `maxed'` / `late'` / `urLate'` with the new keys and the `clubs`, `clubsBoss` and
    `clubsCrowd` lineups (gear-stats §D.4).
11. **§11.1:** `src/data/gearAwaken.js` holds the 10-key `TUNE_BITS`; `gear.js` reads stat definitions from
    `src/data/gearStats.js`.
12. **§12.1 tests:** `TUNE_BITS` order test with 10 keys; a ✦ on a Pierce line survives the stale-tab round trip.
13. **§14 #10 (Academy Club gear sets):** now specced in `gear-stats/SPEC.md`, landing with the battle update; Rainbow
    Resonance is kept and stacks with clubs ("budgeted together with Resonance": §D includes it via GA's blocks).
14. **R20:** unchanged here; ASC overrides it for the Rainbow Gear Box, which opens in the player's Club Focus (§K.2).

### K.2 `ascension/SPEC.md`

1. **Titan Trials hub** (ASC:76 onward): a **Club Focus** picker (the Armband modal's rows), free to change; mirror
   `cfocus` in `missions.counters`, restored like ASC's own marks.
2. **Titan chests:** every Mythic+ piece (Radiant, Celestial) opens in the Focus club; the **Rainbow Gear Box**
   (ASC:677, "choose charm, ribbon or shoes") opens its UR piece in the Focus club too.
3. **Boss Exchange Titan shelf** (ASC:88-90): add a `club_band` row, 2 a week, priced in Assault Tokens (suggested 25;
   ASC's token budget decides). Never on the Gem Shop's Titan shelf.
4. **Box-born UR and stale tabs** (ASC's pouch-safety rules): the `gcl:` mirror covers a Focus club exactly like an
   Armband club.

---------------------------------------------------------------------------------------------------

## L. Owner questions (at most 3; the build proceeds on the defaults)

1. **Should Skill Haste also speed up every girl's ⚡ ability, not only the heroes' ults?** This reverses the earlier
   "ult-only" note in the abilities design. *Default: yes, at half strength (cooldowns at most 25 % shorter), and not for the
   rallies and debuffs that power up the whole team (Moonbrand, Morning Rally, Shrine Chorus, Lantern Flare, Firefly
   Hush), because a fast Moonbrand would be a team-wide boss-damage boost for every free player.* Tower girls keep the
   ATK their Skill Haste gives today.
2. **Lines a girl can't use turn into ATK, each extra one a little less, up to +12 % in all. Right size?**
   *Default: yes.* Bigger (+20 %) lets free co-op pairs beat the wave-200 Matriarch early; smaller (+8 %) makes a second
   dead line feel like nothing.
3. **Two new substats now (Pierce, Aura Power); a third later?** A boss-damage substat is the obvious next one, but it
   moves every free wall at once. *Default: two now; decide on a third after the battle update's measured pass.*

## M. Risks

| Risk | Guard |
|---|---|
| Every number is modelled (lone-boss DPS proxies on fixed presets and random rolls; no Range, armor, burns, aura radius or Pierce crowd value; Build W shares assumed) | train C combined pass, §D.4 gates and knobs |
| Co-op free month-3 pair vs the 4-5 Matriarch: ×1.01–1.04 short in the model, a coin flip (PC8) | `maxed'` `--coop 2` gate; knob 1 by default, then knob 2 |
| Pierce and Archery on crowd walls (PC1 elite wall, PC3 modes, PC4 army); Shiro is the biggest lever | half rate on hitscan; `clubsCrowd` gates; knob 3 |
| Skill Haste on abilities overturns AB:202 | owner question 1; half rate; rallies and debuffs excluded; A7 at `late'` / `urLate'` |
| Stale tabs delete new-stat lines silently, or reroll the piece | reader ≥ 2 weeks before M1; `gnx:` + `gnf:` fingerprint; Σ ▲ trim; new stats are never mains |
| A club piece whose favourites don't match her wants is harder to perfect (7.3 % vs 11.1 %) | the Armband moves it; un-clubbed pieces keep today's odds; the modal shows favourites first |
| Titan Trials ship before M1 | their Mythic+ pieces are No club until then; the Armband fixes it |
| Umeko has one strong club (Tea); Bell's First Bell does not reach Lantern Flare | named gap; Taiko is fine on her; a later support club |
| Frame time at 3× with Pyrotechnics everywhere, Pierce at cap and hasted Shadow Doubles | sim-wide pop budget; perf cases (a)–(d); knob 6 |

## N. Critic pass (what changed and why, 2026-10-15)

| # | Finding | Outcome | Where |
|---|---|---|---|
| 1 | Skill Haste on abilities had no budget; Moonbrand a ×1.07 free boss multiplier | fixed: half rate, rallies/debuffs excluded, A7 ceiling gate | §B.4, §D.4, §L Q1 |
| 2 | Aura girls' fill was capped or fed Miko's own 2-damage shots | fixed: own +5 % bucket outside the cap, into Aura Power and radius; Miko is an aura girl | §B.1, §B.2, §A.6 |
| 3 | Pierce far stronger on pierce-1 shooters (Shiro +33–155 %) | fixed: half rate and `maxExtra` 1 on Shiro, Momo, Miko; per-kit sizing table; crowd gates; "+1–4 waves" withdrawn | §A.2, §A.3, §D.3, §D.4 |
| 4 | Board model used random pieces, not the P3 presets | fixed: preset model, `maxed'`; first-draft numbers give ×1.20–1.22 on presets; numbers cut; PC8 named a likely breach with a default knob | §D |
| 5 | Build W, A2 and PC3 reused Build A's multiplier | fixed: Build W modelled (assumed shares), A2 and PC3 rows and gates added | §D.1, §D.3, §D.4 |
| 6 | ATK → DoT was an unbudgeted ×1.6–1.8 | fixed: half of gear ATK, cap ×1.25; honest max corrected | §B.3, §F.2 |
| 7 | Taiko best boss set for every role late | fixed: Taiko favourites and numbers, Fencing numbers; spread gate | §C.2, §D.4 |
| 8 | No perf test where the new load stacks | fixed: four perf cases, sim-wide pop budget; quality-gating rejected (the sim must not read a client setting) | §C.3, §D.4 |
| 9 | Aura Power dead off aura paths (heroes, Chika, Hotaru) | fixed: fill decided from what menus see, path auras on top. The "dead on Grand Workshop T5" part is wrong: tiers stack and keep T4's `rangeMul 1.1` (`mods.js:135-143`, `:184-189`) | §B.1, §B.2, §A.4 |
| 10 | Drone Pierce would do nothing (`pierce: 1` at the fire site) | fixed: code site `towers.js:590` + test | §A.3, §I |
| 11 | Shiro's Range both fills and widens her aura | rule made explicit instead: fill lines keep their own effect so nobody weakens mid-battle; bounded and modelled | §B.1 rule 2 |
| 12 | Follow-Through vs the cap and echoes undefined | fixed: after the cap, before the rate; echoes and doubles do not count; clamp tightened | §A.3, §C.3, §F.2 |
| 13 | `gnx:` mirror could restore a line after an old reroll (Σ ▲ too high) | fixed: `gnf:` fingerprint, refill, Σ ▲ trim, save test | §E.3, §I, §K.1 |
| 14 | Club seeded with a null uid: every stage drop in one club | fixed: roll in `addGear` with `createdAt` + uid; coverage test | §C.4, §I |
| 15 | M0 changes live power with no gate | fixed: capBot run in the M0 gate | §J |
| 16 | Umeko's M0 fill went to Range, then was taken back at M1 | fixed: no aura-girl fill before M1, no reroute, no guard exception | §B.1, §E.1, §J |
| 17 | Buying the ⚡ tier removed ATK (`hasteFill`) | fixed: fill kept, haste on top; `hasteFill` removed; in-battle guard | §B.4, §E.1, §F |
| 18 | New pools made rerolls worse, Rare–SR got only the downside | fixed: new stats roll only on club pieces; un-clubbed odds identical to today | §A.5, §D.2 |
| 19 | Same-target Finishing Thrust was a boss multiplier against P3 §3.4 | fixed: counts every attack | §C.2, §C.3 |
| 20 | Shiro's T5 aura has `rangeMul 1.1` | fixed: Aura Power fills and also boosts it on Overwatch | §A.4, §B.2, §B.5 |
| 21 | Weekly-boss references out of date | fixed: Titan Trials, Titan shelf, ASC change list | Sources, §C.4, §K.2 |
| 22 | `damageMul` honest max out of date | fixed: ≈ 8.3 at L85, clamp-identity test | §F.2, §K.1 |
| 23 | Names check missed "Piercing …" and "Taiko" | fixed: armorPen prefixes for new pieces; overlaps listed | §A.1, §H |
| 24 | `piercePct` fraction vs integer | fixed: unit key `pierceK` | §A.3, §F |
| 25 | Heroes and over-cap fill contradicted | fixed: heroes get over-cap and Aura Power fill; test changed | §B.1, §I |

## Evidence (`gear-stats/tools/`)

- `synth-presets.mjs` → `synth-presets-final.txt`, `synth-presets-oldnumbers.txt`: §D (run lines in `run-final.sh`).
- `synth-budget-v2.mjs` → `synth-budget-final.txt` (via `run-final.sh`); first draft `synth-budget.mjs` →
  `synth-budget.txt`; club variants tried in `var/v*.txt`.
- `synth-odds.mjs` → `synth-odds.txt`; `synth-odds-v2.mjs 0` → `synth-odds-v2.txt`: §A.5.
- `SPEC.pre-critic.md`, `OWNER_NOTE.pre-critic.md`: the first draft.
- PD's `depth-*.mjs` / `.txt`, PC-L's `clarity-budget.mjs` / `cb-*.txt`, RS's `statbench`, `candbench`, `deadlines`,
  `units-dump.txt`: inputs cited above.

---

## Build notes (track 2, `feature/ur-gear`, 2026-10-20)

M0 and M1 are built on one branch with GEAR_AWAKEN; M2 is the read the abilities track calls. The one place gear reaches a
tower's battle stats is `unitBattleStats` (`src/systems/progression.js`); the sim side is `src/sim/gearRules.js` plus the
reads in `src/sim/mods.js` (`applyGearReach`) and `src/sim/towers.js` (per attack). Deviations:

- **Fresh drops roll their substats from the club pool.** `addGear` gives a fresh Mythic+ drop its club from its own rng
  (`club|<createdAt>|<uid>`) as specified, and then re-draws its substats from that club's pool with the same rng (same
  count, same ▲), so new drops can carry Pierce / Aura Power and their club's favourites. No reward draw shifts (a test pins
  the box rng). The call sites opt in (`{ club: 'random' }` in `splitDrops` and `openGearBox`; an id = Titan Trials' Club
  Focus, the seam track 3 calls).
- **Armband welcome gift:** 9 when the save first holds a Mythic+ piece (on a drop, or at load), not unconditionally.
- **Club Day** opens after 2-5 (gear opens at 2-1).
- **Drone Pierce:** drone bullets stay guided; an extra target is the nearest enemy within 0.6 tiles behind the one it hit.
- **Sweeps:** a pulse's carry runs on 2k with up to 4 extra targets a sweep.
- **M2:** `abilityHaste(unitStats, kind)`, `abilityChargePerTick(unitStats, kind)` (round(100 / (1 − ½·min(0.5, haste))), 100
  for kinds `rally` / `debuff`) and `firstBellCharge` are exported and tested; wiring them into the ability charge is the
  abilities track's. Bell is in the data but not in `LIVE_CLUBS` until then.
- **Not built:** the "Best on" portraits and the "Wants" strip, the trick progress ring and club FX in battle (the sim
  emits `clubTrick` events), club / Has Pierce filter chips (the filter has "In a club" and Pierce / Aura Power in Has
  substat), the 10,000-profile never-weaker guard (the new Crit DMG and Range caps can trim a theoretical max set, which the
  spec accepts; over-cap parts fill in as ATK).
- **Engines:** `GEAR_START` is pinned in `e2e/engines/scriptedBattle.js` (every trick, Pierce on every kit) and plays bit for
  bit the same on V8 and JavaScriptCore.
