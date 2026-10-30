# Gear update: five-piece sets, the Hair Clip and the Necklace, LR gear, Set Boxes, pins and loadouts (build spec)

Sakura Sentinels, 2026-10-30. Spec only: nothing in the game changes on this branch. The decisions only the owner can
make are on `docs/review/gear-update/OWNER_BOARD.md`; the build follows the defaults there until the owner answers.

**Owner requests (verbatim).**
- Oct 21 (HANDOFF §4): five equipment pieces; the hair accessory and the necklace come in role sets you farm (support,
  control, money, precision, abilities, …), each set from its own source; clubs on any of the five pieces, counted
  across all five (3 + 2 splits); support main stats Aura Power, Aura Radius, Buff Duration, Control Strength; LR gear
  above UR at max +18, each LR piece raising the stat caps a little, aura most and crit least; five pieces ≈ +60 % gear
  stats, so the Kage-relative tuning ships in the same update.
- Oct 30: "Multiple girl load outs, flat 3d icons for gear, new gear sets with custom designs, lr gear".
- Oct 30: "Custom boxes with pre loaded gear sets, new pins that allow you to max a main and substat".
- Oct 30: **"A set will be 5 pieces of gear now remember"**: every set covers all five slots. This overrides HANDOFF §4's
  two-piece role sets on the new pieces.
- Oct 30: "LR's should be more op!" (mainly the LR units, which the balance work handles; this spec carries the same
  intent into LR gear: a clearly felt step above UR, not a small one).

**Out of scope here.** The flat 3D gear icons are built on `feature/gear-icons` (the Blender items pipeline,
`tools/blender/items/`); §3.3 lists the icon keys and the design brief that track needs. Balance round 5 is on
`feature/balance-r5` (PR #40); §8 says how this update is tuned on top of it.

**Sources.** `file:line` is `origin/main` at `60ce9cad` (v0.1.61, `COOP_PROTOCOL` 13). r5 = `feature/balance-r5`
(`docs/BALANCE.md` there). GS = `docs/specs/GEAR_STATS.md`, GA = `docs/specs/GEAR_AWAKEN.md`, ASC = `docs/specs/ASCENSION.md`.
Number labels: **code** (read from source), **modelled** (arithmetic or Monte Carlo on the live roll formulas in a
scratch script; not a battle), **spec** (a number this file sets; the §8 gates tune it), **measured** (a sim run).
Players are "they"; girls are "she". No other game is named in this file.

---------------------------------------------------------------------------------------------------

## 0. The update on one page

1. **Five slots.** Charm, Ribbon and Shoes stay exactly as they are (main stats, substats, odds). Two new slots: the
   **Hair Clip** and the **Necklace**. They come only as set pieces, from set sources and Set Boxes; today's random
   drops and gear boxes keep rolling the three old slots, so no existing reward roll changes.
2. **A set is five pieces** (owner, Oct 30): one piece per slot, each with the set's own design. Six sets launch, one
   per role, each from its own source: **Spirit Squad** (support, the Hyakki Daimyo), **Freeze Tag** (control, the Gloom
   Regent), **Geometry Set** (precision, the Eclipse Wyrm), **Party Popper** (crowd, the Foundry Titan), **Treasurer**
   (money, Market Canal) and **Power Bank** (abilities, Total Assault).
3. **Set bonuses at 2 / 4 / 5 pieces**: 2 pieces give the set's stat, 4 its passive, 5 a stronger passive and the set's
   look. A girl has at most one passive; 2 + 2 + 1 mixes give two stats. Today's pieces are **No set** and stay usable.
4. **Clubs stay on top of sets.** Any of the five pieces can carry a club (Armbands too), counted across all five: a
   3 + 2 split gives one trick and two club stats. Sets and clubs stack.
5. **Support main stats** on the new pieces: **Aura Power** and **Aura Radius** (Hair Clip), **Buff Duration** and
   **Control Strength** (Necklace). Damage mains are offered beside them, so carries use the new slots too.
6. **LR gear** ("more OP"): a UR +12 piece **Limit Breaks** into LR with a **Nightglass Lens**. Every number ×1.25 over UR,
   max **+18**, two more ▲, a third ✦, cap raises per LR piece (aura most, crit least) and an **LR Set Form** when all
   five pieces of one set are LR. One LR piece ≈ **×1.20** her damage over the UR piece it replaces; a full LR set ≈
   **×2.2** a full UR set (modelled).
7. **Set Boxes**: a whole five-piece set at Mythic or Legendary, +0, main stats picked by the player, substats rolled.
   Rare, never for gems, never UR or LR, so each set's own source stays the way to many good pieces.
8. **Pins**: the **Tie Pin** sets a piece's main stat to its best roll, the **Collar Pin** one substat. Gold, UR and LR
   pieces; one of each per piece (LR: two Collar Pins). Values only: no sim change.
9. **Teams and gear loadouts**: today the game has one formation and no presets (§7.1). Up to **5 saved teams** on
   Formation and Stage Prep, and up to **3 gear loadouts per girl**; a team remembers which loadout each girl uses.
10. **Power**: five pieces raise a fully geared girl's damage about **×1.9–2.3** (stats multiply, so +60 % stats is
    about double the damage), clubs and sets ×1.15–1.30 on top (modelled). It is tuned **after balance round 5, on top
    of it**, with r5's own bench and gates; knobs touch only new gear numbers before they ship. Nobody is nerfed.
11. **Safety**: `SAVE_VERSION` stays 2, `src/data/types.js` stays frozen, every new field is mirrored in
    `missions.counters` (whole pieces for the new slots), and a reader ships first.
12. **Co-op**: set passives, the new stats in battle and LR's cap raises change the sim: one `COOP_PROTOCOL` bump for
    M2 and one for M3 (or one if they ship together). M0, M1 and the pins keep the sim id.
13. **Milestones**, each shippable on its own: **M0** reader → **M1** teams and loadouts → **M2** five pieces, sets, Set
    Boxes and pins (after r5) → **M3** LR gear.

---------------------------------------------------------------------------------------------------

## 1. Decisions this spec follows

| # | Decision | Source | Status here |
|---:|---|---|---|
| D1 | A set is five pieces, one per slot | owner, Oct 30 | **decided**; overrides HANDOFF §4's two-piece role sets |
| D2 | Charm, Ribbon and Shoes stay as they are; the hair accessory and the necklace are new | owner, Oct 21 | kept |
| D3 | Each set from its own source (one Titan Trials titan per set where one fits) | owner, Oct 21 | kept: four titan sets, two from other modes (§3.6) |
| D4 | Clubs on any of the five pieces, counted across all five (3 + 2) | owner, Oct 21 | kept |
| D5 | Support main stats: Aura Power, Aura Radius, Buff Duration, Control Strength | owner, Oct 21 | kept (§2.4) |
| D6 | LR gear above UR at max +18; each LR piece raises the caps, aura most, crit least | owner, Oct 21 | kept; sized up by D7 |
| D7 | "LR's should be more op!": a clearly felt step | owner, Oct 30 | default numbers in §4 |
| D8 | Five pieces ≈ +60 % gear stats; the Kage-relative tuning ships in the same update | owner, Oct 21 | §8 |
| D9 | Balance round 5: "no cap, everyone close to Kage", no nerfs | owner, Oct 28 | §8 gates and knobs |
| D10 | Custom pre-loaded set boxes; pins that max a main stat and a substat | owner, Oct 30 | §5, §6 |
| D11 | Multiple girl loadouts | owner, Oct 30 | §7 (teams + per-girl gear loadouts) |

---------------------------------------------------------------------------------------------------

## 2. Five slots

### 2.1 The slots (board Q4)

| Slot (id) | Card name | Main stats | Substats | Comes from |
|---|---|---|---|---|
| `charm` | Charm | ATK, Crit DMG (code, `src/data/types.js:281`) | today's eight; club pieces as today (GS §A.5) | as today + set sources |
| `ribbon` | Ribbon | Crit Rate, Range, Armor Pierce (`:282`) | today's eight; club pieces + Pierce | as today + set sources |
| `shoes` | Shoes | Attack Speed, Cost Reduction, Skill Haste (`:283`) | today's eight; club pieces + Aura Power | as today + set sources |
| `hair` | **Hair Clip** | ATK, Crit Rate, **Aura Power**, **Aura Radius** | today's eight; club pieces + Pierce | set sources and Set Boxes only |
| `necklace` | **Necklace** | Crit DMG, Attack Speed, **Buff Duration**, **Control Strength** | today's eight; club pieces + Aura Power | set sources and Set Boxes only |

- Every slot rolls the same way: substat count by rarity (`GEAR_SUBSTATS_BY_RARITY`, `types.js:286`), the rarity scale,
  ▲ every 3 levels, ✦ stitches, UR and LR. The new support stats are **main stats only**: they never roll as
  substats, so a carry's substat odds on the new slots are today's eight (plus the club-only stat on club pieces).
- A Hair Clip or Necklace always belongs to a set. The three old slots hold both No-set pieces (today's drops) and set
  pieces (set sources).
- **Classic main pools are frozen.** The new mains exist only on the new slots, because an older build deletes a whole
  piece whose main stat it does not know (`src/systems/save.js:272-273`); on a new slot the piece is unknown to it anyway
  and is covered by the whole-piece mirror (§9.3).
- Names: a set piece has a fixed name per set and slot (§3.3) plus today's rarity suffix ("of the Crimson Moon",
  "of the Eternal Sakura", "of the Rainbow Sakura") and LR's new "of the Nightglass Sakura". New No-set charms stop
  using the noun "Pendant" (the Necklace owns necklaces); stored names are never rewritten (the same rule as the
  "Piercing" prefix, `src/systems/gear.js:53-54`).
- The Ribbon slot's nouns already include hair items ("Hair Bow", "Scrunchie", "Hairpin", `gear.js:44`), so the new hair
  piece is a rigid clip or comb, never a ribbon or a bow, in name and in art.

### 2.2 Where the slots live in code

- `GEAR_SLOTS` and `GEAR_MAIN_STATS` sit in `src/data/types.js:263-284`, which the sim imports (it is in the co-op hash,
  `tools/simId.mjs`). **`types.js` is not edited** (the standing GS/GA rule).
- New non-hashed **`src/data/gearSlots.js`**: `SLOT_IDS` (`['charm', 'ribbon', 'shoes', 'hair', 'necklace']`,
  append-only: mirrors store the index), `GEAR_SLOT_DEFS` (names, descriptions), `MAIN_STATS_BY_SLOT` (spreads
  `GEAR_MAIN_STATS` and adds the two new rows), `ROLL_SLOTS` (the three old slots) and `SET_ONLY_SLOTS`
  (`['hair', 'necklace']`). A grep test forbids `GEAR_SLOTS` outside `gearSlots.js` and the sim.
- `rollGear` with no slot keeps `rng.pick(ROLL_SLOTS)` (`gear.js:234` picks among the three today): every random drop,
  box and pinned test sequence stays identical.
- Readers that list slots move to `SLOT_IDS`: `save.js` (`SLOTS` `:46`, `newUnitState` `:104`, `cleanUnit` `:240`),
  `rosterSave.js:26` (`own:<id>:<slot>` marks), `gearMarks.js` (`gbx:` slot order: append-only, so 3 = hair, 4 =
  necklace), `gear.js` (`wornGear` `:798`, `boxMark` `:332`), `profileCard.js:246`, `craft.js`, `salvage.js`,
  `achievementMetrics.js`, `src/art/icons.js`, and the UI files in §11.

### 2.3 The gear-stat table after the update

| Key | Card name | Kind | Common base | Main on | Sub on | Cap (§4.3 adds LR raises) | Status |
|---|---|---|---|---|---|---|---|
| today's eight | (unchanged) | | `types.js:271-278` | as today | all slots | as today, + Armor Pierce cap 40 (new, §4.3) | unchanged |
| `piercePct` | Pierce | % | 8–16 % | never | club Ribbon, club **Hair Clip** | 150 % | slot list widened |
| `auraPct` | Aura Power | % | 2–4 % | **Hair Clip** | club Shoes, club **Necklace** | **25 %** (was 15 %, see below) | now a main |
| `auraRangePct` | **Aura Radius** | % | 2–4 % | Hair Clip | never | 20 % | new |
| `buffDurPct` | **Buff Duration** | % | 3–7 % | Necklace | never | 40 % | new |
| `controlPct` | **Control Strength** | % | 3–7 % | Necklace | never | 40 % | new |

- Stat definitions extend `GEAR_STAT_DEFS` in `src/data/gearStats.js:10-14`; `NEW_STAT_SLOT` (`:32`) becomes a slot list
  per stat (`piercePct: ['ribbon', 'hair']`, `auraPct: ['shoes', 'necklace']`), and `save.js` `cleanGear` (`:280`)
  checks membership instead of equality.
- `TUNE_BITS` (`src/data/gearAwaken.js:8`) is append-only: `auraRangePct`, `buffDurPct`, `controlPct` are appended
  (13 keys). They are mains only, so they never carry ✦ bits; the slots exist so every stat has a stable index for the
  §9 mirrors.
- **Main values** (modelled, live formula `base × scale × 1.2 × (1 + 0.06 × level)`): a Legendary +10 Aura Radius main
  averages 16.1 % (max 21.5 %); Buff Duration and Control Strength 26.9 % (max 37.6 %); UR +12 ×1.23 of that; LR +18
  ×1.86.
- **Aura Power's cap rises from 15 % to 25 %** (board Q12) because it is now a main (one Legendary +10 main averages 16.1 %, which
  alone passed the old cap). Nothing gets weaker: the part of Aura Power above 15 % keeps filling in exactly as before
  (GS §B.1 rule 2, "fill lines keep their own effect") and now also counts as Aura Power up to 25 %. The soft limit
  (12 % ATK, 5 % for the aura girls) bounds the overlap.

### 2.4 What the support stats do (sim, M2)

| Stat | Effect | Sim key and site | Never touches |
|---|---|---|---|
| Aura Power | as today (GS §A.4): her aura's bonus parts grow | `auraPct` (exists) | cost cuts, detection, cleanse, brews, links |
| Aura Radius | her aura reaches that much further, on top of Range's widening (GS §B.3) | `auraRangeMul` (exists; today the aura girls' fill) = `(1 + min(cap, auraRangePct)) × (1 + auraFill)` | her attack range |
| Buff Duration | her timed buffs on girls last that much longer: Midori's brews, Chika's overclock, Wakaba's drinks, rally-kind ⚡ abilities and hero skills, Spirit Squad's Big Cheer | new key **`buffDurMul`**; read where each timed buff is created (`src/sim/buffs.js`, `drinks.js`, `abilities.js`, `hero.js`) | auras (they have no timer), debuffs on enemies |
| Control Strength | her slows, freezes, stuns, holds and groundings last that much longer; her push-backs push half that much further | new key **`controlMul`**: one site, `applyStatus` (`src/sim/status.js:25`) multiplies `duration` for her control types **before** boss resistance (`CC_RESIST`) and the Freeplay CC budget (`ccLeft`); push sites (Fuu's wind, Marumi's balls, Kogane's plow, Norika's STOP) take `1 + (controlMul − 1) / 2` | a slow's strength (`MAX_SLOW`), bosses' immunity to holds and pushes |

- **Every Line Counts** covers them (GS §B): a girl whose kit cannot use a stat fills it in as ATK (Umeko and Miko: as
  aura). `GEAR_FIT` (`src/data/gearStats.js:121-176`) gains the three stats per girl; a data test derives the Control
  Strength row from her kit (a control status on any path) and the Buff Duration row from her timed buffs, and fails
  when a playable girl has no row. A worn set counts as "what a menu can see": Buff Duration is real for a girl
  wearing 4+ Spirit Squad, Control Strength for a girl wearing 4+ Freeze Tag.
- Fill-in worth uses the Common mid roll (GS §B.1 rule 3): Aura Radius 0.03, Buff Duration and Control Strength 0.05.

---------------------------------------------------------------------------------------------------

## 3. Sets

### 3.1 Rules

- **A set is five pieces** (D1): a Charm, a Ribbon, Shoes, a Hair Clip and a Necklace, each with the set's design.
- **Membership is fixed.** A piece's set comes from its source and never changes (no item moves a piece between sets;
  the Club Armband stays the only re-tagging item). Awakening, Limit Break, rerolls and pins keep the set.
- **Rarities.** Set pieces exist at Super Rare and above (SR, Mythic, Legendary; UR and LR by awakening). Bonuses do not
  scale with rarity, as for clubs (GS §C.1): a free player's Mythic set plays the same game as a whale's LR set, and the
  numbers on the pieces are where rarity shows.
- **Thresholds 2 / 4 / 5** (owner default, board Q1):
  - **2 pieces**: the set's stat, folded into her gear totals (not hashed), under the caps and Every Line Counts.
  - **4 pieces**: the set's **passive** (a sim rule).
  - **5 pieces**: the passive's stronger numbers, and the set's look: a set crest on her portrait card and her battle
    ring in the set colour (display only; off on Low quality and with Reduce motion).
  - **5 LR pieces of one set**: the passive's **LR Set Form** (§4.4).
- **Mixing.** Only one set can reach 4 of 5 slots, so a girl has **at most one passive**. 4 + 1: the passive plus any
  fifth piece (No set, or another set's). 2 + 2 + 1 and 2 + 3: two sets' 2-piece stats. 5: the full set.
- **Today's pieces are No set** (absent `set` field) and stay fully usable: they fill a slot in a 4 + 1, take clubs,
  bloom to UR and Limit Break to LR.
- **The dead-passive rule** (GS §C.2's `trickIdle`, owner default Q3 "never promise what is not there"): one function,
  `setIdle(setId, unitId, battleCtx)`, greys a passive that does nothing for her kit (Right Angle on a kit that cannot
  crit; Bake Sale on a girl who defeats nothing and makes no coins; Supercharge when her ability does not run). Her set
  chip, the Set Box picker and the battle panel read it.

### 3.2 The six launch sets (board Q2; spec numbers, §8 tunes them)

| Set (id) | Role | Source | 2 pieces | 4 pieces: the passive | 5 pieces | LR Set Form (5 LR pieces) | Value on her role (modelled) |
|---|---|---|---|---|---|---|---|
| **Spirit Squad** (`spirit`) | support | Hyakki Daimyo | +8 % Aura Radius | **Big Cheer**: every 20 s she cheers; girls in her aura (no aura: the 2 nearest within 2 tiles) deal +12 % damage for 5 s | +16 % for 6 s | every 15 s, +20 % for 7 s | partners ×1.03 / ×1.05 / ×1.09; ×1.04 / ×1.07 / ×1.13 with 40 % Buff Duration |
| **Freeze Tag** (`freezetag`) | control | Gloom Regent | +10 % Control Strength | **You're It**: an enemy under her slow, freeze, stun, hold or grounding takes +6 % damage from every girl while it lasts (minibosses and bosses +3 %) | +8 % (+4 %) | +10 % (+5 %), and her control lasts 15 % longer | crowd team ×1.04–1.08; boss board ≤ ×1.03 |
| **Geometry Set** (`geometry`) | precision | Eclipse Wyrm | +10 % Crit DMG | **Right Angle**: every 4th attack is a sure crit | and sure crits deal +20 % more | every 3rd attack; sure crits +30 % | ×1.06–1.13 / ×1.09–1.16 / ×1.15–1.22 (more for girls with little crit) |
| **Party Popper** (`popper`) | crowd | Foundry Titan | +20 % Pierce | **Confetti Burst**: every 6th attack bursts in a 1-tile ring around the enemy it hits, for 50 % of the hit, on the other enemies there | every 5th, 60 % | every 4th, 75 %, 1.3-tile ring | crowd ×1.04–1.08 / ×1.07–1.12 / ×1.12–1.20; a lone boss ×1.00 |
| **Treasurer** (`treasurer`) | money | Market Canal | +4 % Cost Reduction | **Bake Sale**: coins from enemies she defeats +10 %; a coin-maker's own coins too (Momo's wave coins, Chigusa's harvest, Ouka's coins per kill) | +15 % | +20 %, and the first upgrade she buys each wave costs 10 % less | team income +2–6 % (measured gate) |
| **Power Bank** (`powerbank`) | abilities | Total Assault | +8 % Skill Haste | **Supercharge**: her ⚡ ability (a hero: her skill) deals +15 % damage and charges 10 % faster | +25 %, 15 % faster | +35 %, 20 % faster, and it starts every wave 20 % charged | ×1.05–1.08 / ×1.08–1.13 / ×1.12–1.20 |

- **Who suits which** (fits, not rules): Spirit Squad: Miko, Umeko, Noa, Wakaba, Ouka, Chika and the heroes' auras.
  Freeze Tag: Yuki, Fuu, Chigusa, Azami, Suzu, Hotaru, Yuzuha, Yoriko, Norika, Kogane. Geometry Set: Kage, Shiro, Aoi,
  Kaede, Tenka, Hana, Ena, Luna. Party Popper: Akane, Sango, Hotaru, Iroha, Marumi, Kinu, Raika, Rei, Midori, Nami and the
  duo. Treasurer: Momo, Ouka, Chigusa, and any carry who trades damage for coins. Power Bank: Tenka, Kage, Chika, Suzu,
  Fuu, Iroha, the duo and every hero.
- **Rules that keep them in budget.**
  - Big Cheer is a `rally`-kind buff: the strongest cheer on a girl wins (cheers never stack), it multiplies with auras
    like the ability rallies (`src/sim/buffs.js`), and Skill Haste never speeds it (GS §B.4's not-hasted kinds).
  - You're It: the strongest You're It on an enemy wins; it multiplies with Moonbrand and the other marks; it is the one
    set effect that reaches a boss board, so the §8 gate holds it at ≤ ×1.03 on a boss (P3 §3.4's "no boss
    multipliers" in spirit; board Q11).
  - Right Angle and Confetti Burst count her own attacks only, like the club tricks (echo throws, doubles' volleys, drones and
    pops do not advance them; GS §C.3). A sure crit uses her crit DMG; a kit that cannot crit gets the idle chip.
  - Confetti Burst never chains (a burst cannot burst) and shares one budget for the whole battle like Finale Pop
    (`popBudget`, `src/sim/gearRules.js:30`): at most 30 bursts a sim second however many girls wear it.
  - Supercharge's faster charge never reaches rally or debuff kinds (the same rule as Skill Haste); its damage part
    reaches every damaging ability. Its product with Skill Haste, Bell's First Bell and Ouka's Club Mentors is held by
    the abilities budget gate (G7 in §8.3).
  - Bake Sale pays into her owner's wallet in co-op; Freeplay's coin pacing is a measured gate.

### 3.3 Designs and names: school uniform with tech touches (board Q13)

Each set has one colour pair and one motif; each piece is a uniform accessory with one small tech touch. All of them
are wholesome everyday school things. Fixed piece names (plus the rarity suffix):

| Set | Colours (art) | Motif | Charm | Ribbon | Shoes | Hair Clip | Necklace |
|---|---|---|---|---|---|---|---|
| Spirit Squad | cherry red, white | the school spirit squad at a match; light-up gear | **Pom-Pom Keyring** (a pom-pom with a light-up bead) | **Cheer Bow** (striped, a tiny speaker-grille knot) | **Light-Up Trainers** (white, glowing soles) | **Pom Clip** (a little pom-pom clip) | **Heart Pendant** (a heart with a soft status light) |
| Freeze Tag | ice blue, chalk white, a coral "tag" stripe | the playground game of freeze tag; chalk lines; a tag timer | **Tag Token** (a chalk-drawn token with an LED dot) | **Chalk-Line Ribbon** (white chalk lines on blue) | **Hopscotch Sneakers** (a chalk hopscotch grid on the soles) | **Pause-Button Clip** (a round pause-button clip) | **Tag Timer** (a round countdown display on a cord) |
| Geometry Set | slate blue, a cyan laser dot | the maths geometry kit | **Compass Keyring** (a brass compass with a laser-dot lens) | **Protractor Ribbon** (a protractor arc for a clasp) | **Ruler-Step Loafers** (ruler ticks on the soles) | **Set-Square Clip** (a triangle clip) | **Crosshair Lens** (a round lens on a fine chain) |
| Party Popper | violet, warm gold | a class party: poppers, streamers and confetti; fibre-optic sparkle | **Popper Keyring** (a party popper with fibre-optic streamers) | **Streamer Bow** (curled paper streamers) | **Glitter-Trail Trainers** (glitter soles) | **Confetti Clip** (a clear clip filled with confetti) | **Party Locket** (a clear locket with tiny lights inside) |
| Treasurer | silver, mint | the class treasurer's kit; a calculator | **Abacus Bracelet** (abacus beads) | **Coin-Clasp Ribbon** (ruled lines, a coin clasp) | **Coin-Buckle Loafers** | **Calculator Clip** (a calculator-key clip with an LCD) | **Gold Coin Pendant** (a coin with a tiny LCD) |
| Power Bank | lime charge green, indigo | phone power banks; charge bars | **Power Bank Keyring** (charge-bar LEDs) | **Charging-Cable Bow** (a bow twisted from a cable) | **Charge-Bar Trainers** (battery bars on the side) | **Lightning Clip** (a lightning-bolt clip) | **Battery Pendant** (a battery showing a full charge) |

- **UI colours.** A set chip shows the set crest in the set colour on ink; a club chip shows the club emblem in the club
  colour. A test keeps the six set colours at least ΔE 15 apart from each other, from the six club colours
  (`src/data/clubs.js:20-27`) and from LR's Nightglass navy; the build adjusts the shades, and no set chip is a second
  yellow beside a screen's one primary (the rule behind Bell's teal, `clubs.js:26`).
- **Icon keys for `feature/gear-icons`** (rarity lives in the tile, not the art, per `tools/blender/items/README.md`):
  `gear_<set>_<slot>` for 6 sets × 5 slots = **30 designs**; `setbox_pick` (a uniform box with a band in all six set colours) and
  `setbox_<set>` (the same box in each set's colour, 6); `tie_pin`, `collar_pin`, `lens_nightglass`. UR and LR show in
  the tile (the rainbow ring; LR's Nightglass navy with a white-gold line, `src/ui/styles/lr.css`, never rainbow).
  Empty Hair Clip and Necklace slots use a line glyph (`src/ui/lineGlyphs.js`), not item art.
- **Names checked** (case-insensitive grep over `src`, `docs`, `CONTRACTS.md`): "Hair Clip", "Necklace", "Tie Pin",
  "Collar Pin", "Set Box", "Nightglass Lens", the six set names, the six passive names and the thirty piece names have
  no hits. First choices that clashed and were replaced: "Cheer Squad" (Wakaba's ★3 passive,
  `src/data/unitsNewGirls.js:208`), "Hall Monitors" (Ouka's tier, `unitsNewGirls.js:330`), "Starburst" (Akane's
  Potential proc, `src/data/potential.js:158`), "Overcharge" (Raika's path, `src/data/units.js:1032`), "Sparkler"
  (Akane's Tryout card), "Comet Clip" and "Coach's Whistle" (hero tracks in `docs/specs/BANNERS.md`), and any star or
  snowflake hair clip (Hikari's, Ruri's and Yuki's own looks). Known overlaps kept on purpose: "Nightglass" is the LR
  look's own name (`src/ui/rarity.js:23`); "Limit Break" is the girls' LR step (`src/systems/limitBreak.js`), used for
  gear so LR means one thing; Confetti Burst (a burst on her attacks) sits beside the Pyrotechnics club's Finale Pop
  (a burst on her defeats); the girl page's "set bonuses" wording means club bonuses today
  (`src/ui/girlDetail.js:61-71`) and becomes "Club bonuses" beside the new "Set bonuses".

### 3.4 Set passives in the sim (deterministic; constants in a new hashed `src/sim/setRules.js`)

| Passive | Code site | State (battle save) | Random draws |
|---|---|---|---|
| Big Cheer | tower step: `t.cheerT` counts fixed steps; at the period every girl in her aura (or her 2 nearest within 2 tiles, ties by lower uid, like Second Cup's `secondCupTargets`) gets buff key `cheer` for `duration × buffDurMul`; read in `recomputeBuffs` like the rallies | `cheerT` (tower, snap); `cheer` (derived) | none |
| You're It | `computeHit` (`src/sim/combat.js`): when the target holds a control status whose `sourceUid` (already on every status, `status.js:45-60`) is a You're It girl, the hit × (1 + bonus); `sim.tagBonus` (uid → bonus) is rebuilt on place, sell and upgrade | `tagBonus` (derived) | none |
| Right Angle | each `attack*` after the "no target" return, like the club tricks: `t.angleN++`; at the period that attack's hits crit for sure (and × the 5-piece bonus); reset | `angleN` (tower, snap) | none added: each hit keeps its usual crit draw (`Sim._hit`: one draw per hit when she has a crit chance, none when she has none, `src/sim/towers.js:340-345`) and a sure crit only overrides its result |
| Confetti Burst | the same sites: `t.burstN++`; at the period `explode(sim, tower, burstSpec, e.x, e.y, r)` on the other enemies, `noPop: true`, from the shared `sim.burstBudget` (+1 a step, ≤ 12 half-bursts banked) | `burstN` (tower, snap), `burstBudget` (sim, snap) | none |
| Bake Sale | `_killEnemy(e, tower)` (`src/sim/Sim.js`) and the coin-maker sites: her coins × (1 + share), rounded down per payout | none | none |
| Supercharge | `src/sim/abilities.js`: her charge per tick × (1 + charge) for hasted kinds (after `abilityChargePerTick`, `gearRules.js:98`), her ability damage × (1 + dmg); the LR form's wave-start charge beside First Bell (`firstBellCharge`, `gearRules.js:104`) | none | none |

- Her set travels as unit stats **`set`** (the set id when she wears 4+, else null), **`setN`** (4 or 5) and
  **`setLr`** (all five LR); 2-piece stats fold into her totals and never reach the sim as a set. The sim has its own
  copy of the ids (`SIM_SET_IDS`) and a test keeps it equal to `SET_IDS` (`src/data/gearSets.js`), as for clubs.
- Timers count fixed steps (`STEP = 1/60`); FX: event `setTrick { towerUid, kind }`, pooled, off on Low quality and with
  Reduce motion. The sim never reads a quality setting.

### 3.5 Clubs and sets together (board Q3)

- **Independent layers.** A piece has at most one set (fixed) and at most one club (Mythic+, Armband). Both stack.
- **Clubs across five** (D4): every club with 2+ worn pieces gives its 2-piece stat (at most two clubs: 2 + 2 or 3 + 2);
  a club with 3+ gives its trick (at most one). There is no 4- or 5-piece club bonus.
- **Most a girl can stack**: the set's 2-piece stat + its passive (or LR Set Form) + one club trick + two club stats.
- **Code.** `gearSetInfo` (`src/systems/gear.js:808-818`) returns `clubs: [{ id, n }]` (each n ≥ 2, largest first, ties
  by club index), `club` / `clubN` = the trick club (n ≥ 3, `clubN` capped at 3 at source, so the clamp row `clubN:
  int(0, 3)` and `trickClub` (`gearRules.js:36`) need no change), and `set` / `setN` / `setLr` / `sets2` (2-piece stats).
  `gearStatTotals` (`:838-851`) adds both club stats and up to two set stats.
- **Balance math** (modelled, a crit carry at five UR +12 pieces; boss wall):

| Layer | Pieces | Modelled ×damage | Notes |
|---|---|---:|---|
| Club stat, Taiko | 2 | ×1.03 | +5 % speed |
| Club trick, Big Beat | 3 | ×1.05 | GS §C.2 |
| Second club stat, Fencing | 2 | ×1.00–1.03 | at the crit cap it fills in instead |
| Set stat, Geometry | 2 | ×1.00–1.04 | at the crit DMG cap it fills in instead |
| Right Angle | 4 | ×1.06 (75 % crit) – ×1.13 (40 %) | |
| Geometry 5-piece | 5 | ×1.03–1.04 | |
| **Clubs + set, one carry** | 5 | **×1.15–1.30** | today (three pieces, one club): ×1.09–1.16 (GS §D.2) |
| LR Set Form (instead of 5) | 5 LR | ×1.06 more | §4.4 |

### 3.6 Sources and farming time

| Set | Source | What pays a piece | Rarity of the piece | Cap |
|---|---|---|---|---|
| Spirit Squad, Freeze Tag, Geometry Set, Party Popper | **Titan Trials**: the Hyakki Daimyo, the Gloom Regent, the Eclipse Wyrm, the Foundry Titan (`src/data/titans.js:39-75`) | the Victory Chest's one gear box (`victoryChest`, `src/systems/titanRewards.js:56-72`) opens into a piece of **that titan's set**, slot at random among the five; the co-op Together Chests the same; the first clears (`firstClearTable`, `:76-85`): Hard's Mythic box and Mayhem's Legendary box become set pieces, and Nightmare's Legendary box becomes that titan's Legendary Set Box (§5) | the box's own roll: Hard SR 72 % / Mythic 25 % / Legendary 3 %; Nightmare SR 15 % / Mythic 59.5 % / Legendary 25 %; Mayhem Mythic ≈ 51 % / Legendary 45 % (code); a Rare box (Normal tier) stays a No-set classic piece | the 12 weekly keys (+6 carried) |
| Treasurer | **Market Canal** II–III (`res-coins`, `src/data/stages.js:1442`) | a post-roll step in `src/systems/rewards.js` (stage drop tables are co-op hashed; this step is not): each win or sweep, 25 % (II) / 35 % (III) | II: SR 60 % / Mythic 40 %; III: Mythic 75 % / Legendary 25 % on Nightmare (10 % on Hard) | 3 set pieces a game day (`cap:setDay`, `missions.daily`) |
| Power Bank | **Total Assault**, Hard and up (`boss-*`, `stages.js:1548+`) | the same post-roll: each win or sweep, 35 % | Mythic 70 % / Legendary 30 % on Nightmare (15 % on Hard) | 3 a game day, shared with Treasurer's cap |

- `grantGearBox(profile, rarity, rng, { set })` (`titanRewards.js:104`) and `addGear(profile, g, { club, set })` carry the
  set; a fresh Mythic+ set piece still joins a random club (or the Titan Trials Club Focus once it exists, GS §K.2).
- **The Rainbow Gear Box** (`gearbox_rainbow`, `items.js:218`; Mayhem chests and the Rainbow Meter) opens into a slot
  **and** a titan set the player picks (today: a slot of three, No set).
- **Farming time** (modelled: coupon collector over five slots, `(1 / p) × 5 × H₅ = 11.4 / p` set pieces of the wanted
  rarity; main stats fixed with Prism Dice, which already lets the player choose, GS §A.5):

| Player | Where | Legendary set pieces a week | A full **Legendary** set of one set | A full Mythic set |
|---|---|---:|---|---|
| Late, focused | one titan at Mayhem, 12 keys | ≈ 5.4 | **≈ 2 weeks** | ≈ 4 days |
| Late, focused | one titan at Nightmare | ≈ 3 | ≈ 4 weeks | ≈ 1 week |
| Daily player | Market Canal III Nightmare (cap 3 a day) | ≈ 5 | ≈ 2.5 weeks | ≈ 1 week |
| Daily player | Total Assault Nightmare (cap 3 a day) | ≈ 6 | ≈ 2 weeks | ≈ 1 week |
| Mid | one titan at Hard | ≈ 0.4 | months | ≈ 2 weeks (SR set sooner) |

  After the set is complete, the farm goes on for better substats (best of N), more Legendary pieces to bloom, and the
  other sets: a team wants several. Energy (`docs/specs/ENERGY_RESET.md`) changes the replay pace when it ships; the
  caps above then sit beside it.
- **Later sets**, each with new content (budgeted then): a summons set (drones, traps, deploys, sentries), a guard set
  (lives and leaks), a hero set, and one set per limited event (the event exchange pays it; it joins a permanent
  source afterwards).

---------------------------------------------------------------------------------------------------

## 4. LR gear (board Q8)

### 4.1 How LR gear is made

- **Limit Break**, the girls' LR word on purpose: a **UR piece at +12** (a bloomed gold piece or a box-born UR piece
  levelled to +12) and **1 Nightglass Lens + 150,000 coins** become LR. It always works.
- The piece stays `rarity: 'legendary'` with `ur: 1` and gains **`lr: 1`** (no new rarity id: an older build deletes an
  unknown rarity, GA R1). It is auto-locked; unlocking asks "This is LR gear!". Its name suffix becomes "of the
  Nightglass Sakura". Look: the Nightglass tile (navy, a white-gold line), never the rainbow.
- **No undo.** Salvage pays the Legendary payout, the Seed, the Lens, every Needle and every pin back (nothing a child
  earned is lost, GA R11). Set Boxes and drops never give LR.

### 4.2 Numbers ("more OP")

| | Legendary (gold) | UR (rainbow) | **LR (Nightglass)** |
|---|---|---|---|
| Rarity scale (`gear.js:29`, `gearAwaken.js:5`) | 2.8 | 3.2 (×1.143) | **4.0** (×1.25 over UR; ×1.43 over gold); Armor Pierce 2.5 (half rate) |
| Max level | +10 | +12 | **+18**; the main grows +6 % of its base a level (Armor Pierce +4 %) |
| ▲ (a substat grows every 3 levels) | 3 | 4 | **6** (+15, +18: the least-grown line, `nextGrowthIndex`) |
| ✦ stitches (Starlight Needle) | 1 gold | gold + rainbow | **+ Nightglass ✦** (a third; all three may sit on one line) |
| Collar Pins (§6) | 1 | 1 | **2** (different lines) |
| Price tier (`gearTier`) | 4 | 5 | **6**: +13 … +18 cost 39,200 … 53,200 coins (277,200 in all) |

Line values (modelled, the live formulas; stored in Legendary form and read ×`lrMul` = 4.0 / 2.8, as UR reads ×`urMul`):

| Line | Legendary +10 | UR +12 | **LR +18** | LR best line (Collar Pin + 2 ▲ + ✦✦✦) |
|---|---:|---:|---:|---:|
| ATK main (average roll / Tie Pin) | 24.2 % / 32.3 % | 29.7 % / 39.6 % | **44.9 % / 59.9 %** | — |
| Crit DMG main | 45.7 % / 64.5 % | 56.1 % / 79.3 % | **84.9 % / 119.8 %** | — |
| ATK substat, average line | 17.3 % | 21.6 % | **31.5 %** | 69 % |
| Crit DMG substat, average line | 32.7 % | 40.8 % | **59.5 %** | **133 %** ("the crazy line") |
| Crit Rate / Attack Speed substat | 13.5 % | 16.8 % | **24.5 %** | 55 % |

### 4.3 Cap raises per LR piece (aura most, crit least)

Caps act on her gear totals in `unitBattleStats` (`src/systems/progression.js:474-513`); each LR piece she wears adds
one step, so five LR pieces give the last column. The part over a cap still fills in (GS §B).

| Stat | Cap (with this update) | + per LR piece | Cap with 5 LR | Raise |
|---|---:|---:|---:|---:|
| Aura Power | 25 % | +4 % | **45 %** | +80 % |
| Aura Radius | 20 % | +3 % | 35 % | +75 % |
| Buff Duration | 40 % | +4 % | 60 % | +50 % |
| Control Strength | 40 % | +4 % | 60 % | +50 % |
| Range | 50 % | +4 % | 70 % | +40 % |
| Pierce | 150 % | +10 % | 200 % | +33 % |
| Crit DMG | +200 % | +10 % | +250 % | +25 % |
| Armor Pierce (new cap; today's honest max is 34.8, GA §7.2) | 40 | +2 | 50 | +25 % |
| Skill Haste | 50 % | +1 % | 55 % | +10 % |
| Cost Reduction | 25 % | +0.5 % | 27.5 % | +10 % |
| Crit Rate | 75 % | +1 % | **80 %** | +6.7 % |

The sim's own guard caps follow the five-LR maximum: `SKILL_HASTE_CAP` 0.55 and `PIERCE_K_MAX` 200
(`src/sim/gearRules.js:18`, `:80`) and the hero ult haste cap 0.55 (`src/sim/hero.js:113`), all in M3's protocol bump.

### 4.4 LR Set Forms

When all five pieces she wears are LR **and** of one set, her set's passive takes its LR Set Form (§3.2's last
column; unit stat `setLr: true`), named like the LR girls' forms ("Critical Mass · Event Horizon",
`src/systems/limitBreak.js`): "Big Cheer · Nightglass", "You're It · Nightglass", "Right Angle · Nightglass",
"Confetti Burst · Nightglass", "Bake Sale · Nightglass", "Supercharge · Nightglass". The set crest turns Nightglass. A
form that does nothing for her kit is idle like any passive.

### 4.5 Nightglass Lens sources and pace

| Source | Amount | Cap | Code (none hashed) |
|---|---|---|---|
| Weekly commission **Nightglass Hunt**: "Win 3 Titan Trials victories at Mayhem this week (sweeps count)" | 1 | 1 a week | `WEEKLY_MISSIONS` (`src/data/missions.js:25`), shown after the first Mayhem victory |
| Freeplay milestone "Reached wave 225", per tier | 1 × 3 | once per tier | `src/online/coop/rewards.js` milestone items (as GA's `w150` / `matriarch`) |
| Achievements "First Nightglass" (first LR piece) and "Nightglass Form" (an LR Set Form) | 2 | once | offered to the achievements catalogue |
| Each limited event's exchange, top shelf | 1 | 1 an event | event data |

No gem price, no stage drop, no Workbench output. **Pace:** about one Lens a week once Mayhem is open; LR pieces also
need UR +12 pieces (one Rainbow Seed a week, GA §6.1), so an active top player makes about one LR piece a week: a full
LR set on one girl in about **5–6 weeks**, an LR Set Form soon after, a whole team in about a year. LR stays the long
chase, as LR girls are.

### 4.6 Power of LR (modelled, a crit carry; the same pieces at UR)

| | ×damage over five UR +12 pieces |
|---|---:|
| One LR piece (four UR) | **×1.20** |
| Three LR pieces | ×1.64 |
| **Five LR pieces** (scale 4.0, caps raised) | **×2.18** |
| Five LR pieces at a milder scale 3.6 (board alternative) | ×1.86 |
| + LR Set Form (Geometry Set) | ×1.06 more |

---------------------------------------------------------------------------------------------------

## 5. Set Boxes, the custom pre-loaded boxes (board Q9)

| Field | Value |
|---|---|
| Items | **Set Box** (`setbox_pick_mythic`, `setbox_pick_legendary`: choose the set when opened) and a set's own box (`setbox_<set>_mythic`, `setbox_<set>_legendary`: one set). Category `gearbox` (Backpack → Equipment), opened through a picker like the Rainbow Gear Box (`pickSet: true`; `openGearBox` refuses it, `gear.js:311`) |
| Contents | **All five pieces of one set** (Charm, Ribbon, Shoes, Hair Clip, Necklace) at the box's rarity, **+0** |
| Main stats | **Chosen** by the player, one per piece, from the slot's list; "Fill for a girl" picks them from her wants (`GEAR_FIT` and her role) in one tap |
| Substats | **Rolled** (the slot's pool; a club piece's pool and favourites, GS §A.5) |
| Club | each Mythic+ piece joins a random club when it enters the bag, as every drop (or the Club Focus once built) |
| Room | needs 5 free places in the gear bag (`GEAR_BAG_MAX` 1000, `gear.js:293`) |
| Never | UR, LR, a gem price, a stage drop, a Workbench output, the Gem Shop's Titan shelf ("never boxes", `src/data/shop.js:98`) |

**Sources (spec):**

| Box | Source | How often |
|---|---|---|
| Set Box (Mythic, choose) | welcome gift the day Titan Trials open (after 3-5); each limited event's exchange; the achievement "Five of a Kind" (first full set) | 1 once + 1 an event |
| A titan set's box (Mythic) | Boss Exchange **Titan shelf**: the Titan of the Week's set, 150 Assault Tokens | 1 a week (so each titan set once a month) |
| A titan set's box (Legendary) | that titan's **Nightmare first clear** (solo, `firstClearTable`) | 4 once |
| Set Box (Legendary, choose) | each limited event's exchange top shelf; the achievement "Set Collector" (three different full sets) | 1 an event + 1 once |

**Why each set's own source still matters.** A box gives coverage: five slots with chosen mains, at +0 and with
random substats. A Legendary box saves about 2–4 weeks of one set's coupon collecting (§3.6), and arrives about once a
month. Farming stays the way to many Legendary pieces with good substats, to Legendary pieces to bloom (UR needs a gold
+10, then LR needs UR +12), to the two other non-titan sets, and to every set a team wants at once. A Mythic box gives
the set bonuses early (they do not scale with rarity) but Mythic numbers (×0.79 of gold, three substats) and no path to
UR or LR. **LR**: box pieces bloom and Limit Break like any piece; a box never holds UR or LR.

---------------------------------------------------------------------------------------------------

## 6. Pins: max a main stat and a substat (board Q10)

The game already has one pin, the **Lock Pin** (`lock_pin`, `src/data/items.js:230`); the new two join that gear-tool
family. "Pin" also names profile pins (`PINS_MAX`, `src/online/profileRules.js:15`, `src/ui/profile/pinPicker.js`) and
Kinu's ring pins in the sim (`src/sim/rings.js`), so the code never uses a bare "pin" identifier: item ids `tie_pin`
and `collar_pin` (the `lock_pin` pattern), actions `topMainRoll` / `topSubRoll`, line mark `top`, mirror `gtp:`.

| | **Tie Pin** (`tie_pin`) | **Collar Pin** (`collar_pin`) |
|---|---|---|
| Does | the piece's **main stat** becomes its best roll for its rarity: `main.base` = the top of `mainStatRange` (`gear.js:129`); it keeps growing with the level | **one substat** you pick becomes its best roll: its `base` = the top of `substatRange` (`gear.js:101`); its ▲ and ✦ stay on top |
| Item rarity / tile | Legendary (gold) | Mythic |
| Works on | Legendary (any level), UR, LR | Legendary (any level), UR, LR |
| Per piece | 1 | 1 (LR: 2, on different lines) |
| Cost | 1 Tie Pin + 20,000 coins | 1 Collar Pin + 10,000 coins |
| Rerolls | a Prism Dice change keeps the pin: the new main also takes its best roll | Fortune Dice keep a pinned line in place with its ▲ (a free lock, like ✦, GA R9); a Lock Pin is offered only while 2+ lines still reroll |
| Undo | none: the preview shows before → after and Power before → after; **salvage returns every pin** | the same |
| Card text | "Pin it on a gold, rainbow or LR piece: its main stat becomes its best possible roll." | "Pin one substat of a gold, rainbow or LR piece: that line becomes its best possible roll, and rerolls keep it." |

**Sources (spec)**, never a gem price:

| Source | Tie Pin | Collar Pin |
|---|---|---|
| Bounty Exchange (`src/data/shop.js:79-82` block) | — | 2 a week, 25 Bounty Tokens |
| Boss Exchange Titan shelf (`shop.js:87-96`) | 1 a week, 60 Assault Tokens | — |
| Titan Trials Victory Chest | Mayhem 5 % | Nightmare 10 %, Mayhem 20 % |
| Freeplay milestone "Reached wave 175", per tier | 1 × 3 once | — |
| Achievements (offered to the catalogue) | 2 once | 3 once |
| Each limited event | 1 | 2 |

Pace: about 1–2 Tie Pins and 3–5 Collar Pins a week for an active late player: a girl's five pieces fully pinned in
about 3–5 weeks. **Power** (modelled): pins on all five pieces ×1.20 (UR) / ×1.22 (LR); one piece ×1.04.

**UI.** A pinned line carries a small gold pin glyph (a different shape from ✦ and ▲); a pinned main shows "Best
roll". The slot sheet's action row gains **Pin** (a modal: Main or a substat, the before → after line, Power, cost,
"Pin it!"); the Backpack tiles use the existing `usable` hook (`src/ui/screens/backpack.js`) to pick a piece.

**Sim and co-op.** Pins change stored values only; values reach battle through `unitBattleStats`, which is not
hashed, and travel whole in the co-op loadout (`src/online/coop/loadout.js:16-22`). The co-op clamps' honest maxima
already assume best rolls (GA §9.1), so pins raise no ceiling: **no sim id change, no `COOP_PROTOCOL` bump**. Pins can
ship in any normal update; the default ships them with M2's measured pass because they move power.

---------------------------------------------------------------------------------------------------

## 7. Teams and gear loadouts (the owner's "multiple girl loadouts")

### 7.1 What the code has today

- **One formation**: `profile.formation = { hero, towers }` (`src/systems/save.js:154`, cleaned at `:598-604`; at most
  8 towers, `BATTLE.maxTowers`). Formation edits it in place (`src/ui/screens/formation.js:89-99`); Stage Prep reads it
  (`formationIds`, `src/ui/screens/stage.js:390`; the Counters sheet's formation section, `:1158-1170`); the battle
  (`src/ui/battle/setup.js:44`), co-op ("You bring your formation", `src/ui/screens/coop.js:455`; `pickLoadout`), Tryout
  setup, Sandbox, results, missions and achievements read it too.
- **No saved teams and no gear presets.** Gear lives on the girl (`units[id].gear`, one piece per slot); moving a
  piece takes it from its wearer (`equipGear`, `src/systems/gear.js:367-385`).
- Earlier plans named it: "Gear presets per girl + Best for her" (GA §14 #5, "Next"), "Formation presets" (WE-3 in
  `docs/specs/UNITS_BACKLOG.md:60`); the old prototype had three saved teams of a hero + six girls with a name
  (`docs/merge/world.md:91`). In code, "loadout" already means what a player brings to co-op (`loadout.js`), so the new
  objects are called **teams** and **presets** in code; players see "Team" and "Loadout".

### 7.2 The design (default; board Q7)

- **Teams** (Formation and Stage Prep): up to **5 saved teams**, each a hero + up to 8 students, named "Team 1" … "Team
  5" (rename to a short name kept on this device only; never sent online). The active team **is** `profile.formation`,
  so every reader above keeps working unchanged. Edits on Formation edit the active team (auto-saved, as today).
- **Gear loadouts** (her Equipment tab): up to **3 per girl**, **A / B / C**. A loadout remembers the five pieces she
  wears. Her active loadout is what she wears: changing her gear changes it. Switching her loadout equips its pieces.
- **A team remembers which loadout each girl uses** (default A). Switching team sets the formation and switches each
  member to her team loadout. So a girl can be in a boss team in her Geometry Set (loadout A) and in a crowd team in her
  Party Popper set (loadout B).
- **Decision: does a loadout remember each girl's gear? Yes, through her own loadouts, never by copying pieces.** Pieces
  are unique, so a piece named by two loadouts moves when one is put on.

### 7.3 Rules

- **Switching.** A switch that takes pieces from other girls shows them first: "Takes Keen Charm from Aoi" (one line
  per piece) with **Switch** and **Cancel**; then a toast with **Undo** (the previous team and loadouts back). A piece
  that is gone (salvaged) leaves that slot empty, with a red dot on her loadout chip.
- **Inside one team**, two members whose loadouts name the same piece: the team editor marks both chips and says
  which; applying gives the piece to the first girl in team order (hero first, then the student order).
- **Battle, co-op, saves.** A battle uses the stats when it starts; a saved battle keeps its frozen team (Continue
  ignores teams, as today, `stage.js:938`). In a co-op room the team chip can be switched until Ready; the hello carries
  the stats as today. Tryout Day and Sandbox keep their own squads.
- **Limits.** Teams 5, loadouts 3 a girl (spec numbers; board Q7). Copy a team, Clear a team, and "Copy loadout A to B"
  are one tap each.

### 7.4 Save shape (additive; `SAVE_VERSION` stays 2)

- `profile.teams = { active: 0…4, list: [{ name, hero, towers: [], use: { [unitId]: 0…2 } }] }`; `profile.formation`
  always equals `list[active]`'s hero and towers. Migration: Team 1 = today's formation.
- `unit.presets = [{ charm, ribbon, shoes, hair, necklace }]` (1–3 entries) and `unit.preset` (the active index);
  `unit.gear` always equals `presets[preset]`. Migration: loadout A = what she wears today.
- Mirrors (§9.2): `tm:a`, `tm:<team>:<unitId>`, `gp:<unitId>`, `gp:<unitId>:<n>:<slot>`. Team names are not mirrored
  (a stale tab can drop a custom name; it comes back as "Team N").

---------------------------------------------------------------------------------------------------

## 8. Power budget and balance (with balance round 5)

### 8.1 Five pieces (modelled; one crit carry; DPS proxy `(1 + ATK + fill) × (1 + Speed) × crit` against no gear, the
GA §7 method; caps and Every Line Counts applied)

| Profile | ATK | Speed | Crit Rate | Crit DMG | ×damage over the same rarity with 3 pieces |
|---|---:|---:|---:|---:|---:|
| One average gold +10 piece per slot | 46 → 72 % | 27 → 46 % | 30 → 54 % | 77 → 113 % | **×1.93** |
| Best of 10 gold +10 per slot | 61 → 106 % | 42 → 66 % | 49 → 75 % | 96 → 168 % | **×2.34** |
| Best of 10 UR +12 ✦✦ per slot | 88 → 154 % | 50 → 85 % | 63 → 88 % | 128 → 213 % | **×2.29** |

- +67 % lines (five pieces over three; the owner's "≈ +60 % stats") make **about double the damage**, because ATK,
  speed and crit multiply. Board Q5 asks the owner to confirm; the alternative (the new pieces at 60 % numbers) gives
  about ×1.5.
- The absolute ×values of this proxy run above GA's (its best-of-10 picks pieces for one girl's damage), so only the
  ratios are used. Every number here is a boss-wall proxy: no Pierce crowd value, range, armor, auras or burns. The
  gates below are measured.

### 8.2 Everything together (modelled, one carry, over today's best three-piece UR set with one club)

| Step | ×damage |
|---|---:|
| Five UR pieces instead of three | ×2.29 |
| Clubs across five + her five-piece set, instead of one club (§3.5: ×1.15–1.30 over today's ×1.09–1.16) | ×1.05–1.12 |
| Pins on all five pieces | ×1.20 |
| **Full UR endgame** | **≈ ×2.9–3.1** |
| Full LR set instead of UR (§4.6) + LR Set Form | ×2.18 × 1.06 |
| **Full LR endgame** | **≈ ×6.7–7.1** (a year-long chase per team, §4.5) |

### 8.3 How it is tuned with balance round 5

- **Order.** Round 5 ships first (after Nov 1, 7 PM Central, with its own `COOP_PROTOCOL` bump; r5 `docs/BALANCE.md`).
  M0 and M1 change no battle numbers and can ship before, beside or after it. **M2 and M3 are tuned on top of round 5**:
  their measured pass runs on a branch that has `main` with r5 merged, reads r5's rows (`src/data/balance.js` on r5)
  as they are, and is re-run if r5 changes after review.
- **The bench moves to five pieces.** r5's bench gives each girl "three UR +12 Taiko pieces at average rolls"
  (`tools/balance/r5Bench.mjs`). The gear pass adds presets **`maxed5'`** (five average gold +10 pieces in her best
  set, Taiko 3 + Fencing 2), **`late5'`** (best of 10 gold), **`urLate5'`** (UR +12 ✦✦, pins) and **`lrLate5'`** (LR +18
  ✦✦✦, pins, LR Set Form), and the r5 bench profile becomes "five UR +12 pieces at average rolls in her best set" so
  the next balance round tunes on five pieces.
- **Kage stays the reference.** Gear multiplies every girl, so r5's band should hold in ratio; the gate checks that it
  does, and the fix for a girl who falls behind is to raise her (her set fit, or her r5 row up), never to lower another.
- **No nerfs.** Knobs act only on new gear numbers, before they ship: never on girls, r5's rows, content, or anything a
  player already owns.

**Gates (M2 and M3; each a measured run, `--seeds 7,11` unless said):**

| # | Gate | Tool | Pass |
|---|---|---|---|
| G1 | The band, ratio to Kage | `tools/balance/r5Bench.mjs` with `maxed5'`, `urLate5'`, `lrLate5'` | every striker's ruler ÷ Kage's within ±10 % of its r5 value |
| G2 | Supports' boost | r5's support table ("Kage beside her ÷ alone"), each support in her best set | none falls; a rise above ×1.25 of its r5 value goes to the owner (supports turning mandatory) |
| G3 | Never weaker | `tests/systems/neverWeaker.test.js` (fixtures + 10,000 random profiles under the new rules) and `tests/systems/powerKit.test.js` (r5) | `unitBattleStats` after ≥ before on every key; Power never drops |
| G4 | Freeplay top | `tools/gearGuard.mjs` with `late5'` / `urLate5'` / `lrLate5'` on 4-5 and 1-5, Blossom and Crimson Moon | the Eclipse Wyrm (wave 250) is never beaten (board Q6, default keep) |
| G5 | Titans | `tools/balance/r5Titans.mjs` + the ladder with the new presets | the Mayhem rank reached is recorded; weekly rewards stay inside their caps (Rainbow Meter, Lens, pins) |
| G6 | Tryout Day | `tools/bench.mjs --hit --ceiling --maxed geared` (five pieces) and `tools/tryoutBot.mjs --sweep` | Grade 12 maxed win rate recorded; above 50 % goes to the owner |
| G7 | Abilities budget | AB's A7 bench at `urLate5'` / `lrLate5'` with Power Bank, Bell and 55 % Skill Haste | the 1.35× / 1.6× ceilings hold (AB §11) |
| G8 | You're It on bosses | a boss board with a Freeze Tag girl | ≤ ×1.03 |
| G9 | Coins | Freeplay coins at waves 50 / 100 / 150 with Treasurer | team income ≤ +6 % |
| G10 | Co-op clamps | `tests/online/coopStatLimits.test.js` | `clamp(unitBattleStats(honest max))` is the identity (§10.2) |
| G11 | Clan boss | `tests/online/clanBoss.test.js` at the new honest max | caps and the full-run time hold |
| G12 | Perf | `tests/sim/perf.freeplay.test.js`, r5's `tests/sim/perf.test.js` | the 60-girl board in `lrLate5'` with Confetti Burst everywhere, Big Cheer and You're It, at 3×, inside the frame budget |
| G13 | Finales | `tools/balance/r5Finales.mjs` | no win becomes a loss (gear only adds; a sanity run) |

**Knobs, in order** (gear gives way first, GA R22):
1. Set passive numbers (4 / 5 / LR form): G1, G2, G5, G7, G8, G9.
2. LR scale 4.0 → 3.6, then LR cap raises halved: G4, G10, G11.
3. LR's second Collar Pin dropped; Tie Pin's main stat to 90 % of the top instead of the top: G4.
4. Set 2-piece stats.
5. Last, owner's call (board Q5): the new slots at reduced numbers.

---------------------------------------------------------------------------------------------------

## 9. Save migration and old builds

### 9.1 Today's gear and saves

- **Every stored piece keeps every field and value.** Today's pieces have no `set` field: they are **No set**, keep
  today's odds, clubs, UR and stitches, and stay legal in every slot of their kind.
- `unit.gear` gains `hair: null, necklace: null` (`newUnitState`, `cleanUnit`); `unit.presets` = [today's gear]
  (loadout A); `profile.teams` = { active 0, [Team 1 = today's formation] }.
- No `SAVE_VERSION` bump (a newer version makes an older build start a fresh profile, `save.js:720`); `types.js` is not
  edited.

### 9.2 What an older build does, and the guards

| Thing | Older build (code) | Guard |
|---|---|---|
| A Hair Clip or Necklace piece | `cleanGear` returns null for an unknown slot (`save.js:271`): **the whole piece is dropped**, the load is marked `lossy` and a backup is kept (`:690-697`, `:722`) | whole-piece mirror (§9.3) + reader first (§9.4) |
| `set` on a Charm / Ribbon / Shoes piece | dropped by the allowlist object (`:288-302`) | `gst:<uid>` = set index |
| `lr`, level 13–18 | `lr` dropped; level clamped to 12 (`:291`), so the piece reads as UR +12 (understated, never corrupt) | `glr:<uid>` = LR level (like `gur:`), then GA §8.3 step 4 gives back the missing ▲ |
| The Nightglass ✦ (`tuned` bit 4) | clamped to 0–3 (`:265`) | `gtx:<uid>` (1 bit per stat, `TUNE_BITS` order); a mark whose stat is gone refunds its Needle |
| Pin marks (`top`) | dropped; the best roll stays in `base`, so the stat survives | `gtp:<uid>` (bit 0 main, bit 1 + `TUNE_BITS` index per sub): re-applied on load; a pinned stat that an old reroll removed refunds its pin |
| `unit.gear.hair/necklace` | dropped (`cleanUnit` keeps three slots) | `own:<id>:hair`, `own:<id>:necklace` (rosterSave marks over `SLOT_IDS`) |
| `teams`, `presets` | dropped (unknown blocks) | `tm:` and `gp:` mirrors |
| New items (Set Boxes, `tie_pin`, `collar_pin`, `lens_nightglass`) | dropped, load marked `lossy` | `inv:<id>` (`MIRRORED_ITEMS`, `gearAwaken.js:46`) |
| The new stats | on new slots only (dropped with the piece) or as club subs on new slots | — |

### 9.3 The whole-piece mirror (new-slot pieces)

For every Hair Clip and Necklace piece that is equipped, locked, levelled or Mythic and up (a spare +0 Super Rare piece
is the only kind left out: a stale tab may drop it, and the `lossy` backup keeps it), `missions.counters` holds
(numbers only, kept word for word by every build):

- `gph:<uid>` = slot (1 Hair Clip, 2 Necklace) + 10 × rarity order + 100 × level + 10,000 × set index + 1,000,000 ×
  main-stat index (frozen list) + 100,000,000 × flags (1 locked, 2 UR, 4 LR, 8 main pinned);
- `gpm:<uid>` = `round(main.base × 1e6)` (Legendary form);
- `gps:<uid>:<i>` (i = 0–3) = stat index × 1e10 + ▲ × 1e9 + pinned × 1e8 + ✦ bits × 1e7 + `round(base × 1e6)`;
- the club rides `gcl:` and the wearer rides `own:<id>:<slot>` (both exist); the name is rebuilt from the set, slot and
  rarity.

`restoreGearMarks` (`src/systems/gearMarks.js`) rebuilds a missing piece from them before gear consistency runs; a
present piece always wins over its mirror; salvage drops the keys (`dropMarks`, `gear.js:637-643`). Idempotent:
`migrateProfile(migrateProfile(x))` deep-equals `migrateProfile(x)`. Size: 6 keys a piece, ≈ 40 KB at 200 pieces.

### 9.4 Reader first

**M0** teaches every reader the new shape (five slots, `set`, `lr`, level ≤ 18, `tuned` ≤ 7, `top`, the new items and
stats, teams and presets), writes every mirror, and changes nothing a player sees. M1 can follow at once (it writes
only teams and presets, both mirrored); **M2 waits at least one week after M0** (two preferred, GA R17), so stale tabs
that meet new-slot pieces are mostly M0 or newer. The mirrors make it safe either way.

---------------------------------------------------------------------------------------------------

## 10. Sim, co-op and `COOP_PROTOCOL`

### 10.1 What changes the sim id

| Milestone | Hashed files | Sim id | `COOP_PROTOCOL` |
|---|---|---|---|
| M0 reader | none | unchanged | unchanged |
| M1 teams and loadouts | none (formation stays the co-op input; `loadout.js` untouched) | unchanged | unchanged |
| Pins (with M2 by default) | none | unchanged | unchanged |
| **M2** five pieces and sets | `src/sim/setRules.js` (new), `constants.js` (`DEFAULT_UNIT_STATS` + `set`, `setN`, `setLr`, `buffDurMul`, `controlMul`), `status.js`, `combat.js`, `towers.js`, `buffs.js`, `abilities.js`, `drinks.js`, `hero.js`, `Sim.js`, `statLimits.js` | changes | **one bump** |
| **M3** LR gear | `gearRules.js` (`SKILL_HASTE_CAP`, `PIERCE_K_MAX`), `hero.js` (ult haste cap), `setRules.js` (LR Set Forms), `statLimits.js` | changes | **one bump** (or rides M2's when they ship together) |

Today's protocol is 13 (`src/online/coop/version.js`); round 5 takes the next number at its ship. The coordinator
assigns M2's (and M3's) at assembly; until then the branch pins its sim id as a `PENDING_BUMP` (the pattern in
`tests/art/itemArtRuntime.test.js`) and `version.js` gets one comment line per bump, as for 1–13.

### 10.2 Unit-stat keys and clamp rows (`src/online/coop/statLimits.js:30-64`)

Honest maxima are modelled for L85, P6, 10 gates, ★5, an LR girl with UR Resonance, and the best possible gear; the
build re-derives them with a ceilings script (GA's `spec/ceilings-spec.mjs` method) and the clamp-identity test holds
them.

| Key | Today's row | Honest max (modelled) | New row | Milestone |
|---|---|---|---|---|
| `damageMul` | 0–15 | ≈ 14.4 five UR; ≈ 20.7 five LR | **0–30** | M2 (UR fits 15 with no headroom) |
| `rateMul` | 0–5 | ≈ 4.2 five UR; ≈ 6.2 five LR | **0–9** | M2 |
| `critChance` | 0–0.75 | 0.80 (cap at source) | **0–0.80** | M3 |
| `costMul` | 0.75–1 | 0.725 | **0.70–1** | M3 |
| `ultHaste` | 0–0.5 | 0.55 | **0–0.55** | M3 |
| `armorPen` | 0–50 | 50 (new cap at source) | **0–60** | M2 |
| `pierceK` | 0–200 | 200 | **0–250** | M3 |
| `auraPct` | 0–0.75 | ≈ 0.90 (45 % + fill, × Resonance and LR) | **0–1.2** | M2 / M3 |
| `auraRangeMul` | 1–1.2 | ≈ 1.42 | **1–1.6** | M2 |
| `buffDurMul` (new) | — | 1.6 | **1–2** | M2 |
| `controlMul` (new) | — | 1.6 | **1–2** | M2 |
| `set` (new) | — | one of `SIM_SET_IDS` or null | enum | M2 |
| `setN` (new) | — | 5 | int 0–5 | M2 |
| `setLr` (new) | — | — | bool | M3 (M2 may carry it as false) |
| `clubN` | 0–3 | 3 (capped at source) | unchanged | — |
| `critMul`, `rangeMul`, `dotMul` | 1–6, 0–3, 1–1.5 | 3.5, 1.7, 1.25 | unchanged | — |

Non-finite → the `DEFAULT_UNIT_STATS` value; "every `DEFAULT_UNIT_STATS` key has a rule" covers the new keys.

### 10.3 Determinism

Integer counters and timers on the tower (`cheerT`, `angleN`, `burstN`) and an integer budget on the sim
(`burstBudget`); `buffDurMul` and `controlMul` rounded to 4 decimals like every unit stat; no new `sim.rng` draw (a
sure crit keeps each hit's usual crit draw and only overrides its result, so a set never changes how many numbers a
battle draws); You're It's `tagBonus` map is derived in placement order. Set and club rolls, Set Boxes and pins happen outside any battle (co-op wins drop no gear).

### 10.4 Battle saves and engines

`KNOWN_TOWER_KEYS` (`src/ui/battle/snapshot.js`): `cheerT`, `angleN`, `burstN` (snap), `cheer` (derived);
`KNOWN_SIM_KEYS`: `burstBudget` (snap), `tagBonus` (derived). One split-run case each. Pin a **`SET_START`** scripted
battle (every passive and LR form) in `e2e/engines/scriptedBattle.js`, equal on V8 and JavaScriptCore (`GEAR_START`'s
pattern).

---------------------------------------------------------------------------------------------------

## 11. Screens (844 × 390 first, then 1280 × 720; rows ≥ 36 px; the Ink & Paper kit)

| Screen (file) | What changes |
|---|---|
| **Girl page → Equipment** (`src/ui/girlGear.js`) | Five slot cards (one row at 1280; 3 + 2 at 844 × 390, no scroll); the **set strip** (crest, "Spirit Squad ●●●●○", the 2 / 4 / 5 lines, lit when on; idle grey per `setIdle`); the **club strip** with up to two clubs; **Loadout A · B · C** above the cards; gear totals with the new stats and MAX tags that show LR raises ("Crit Rate 78 % MAX (+3 LR)"); slot sheet actions **Pin** and **Limit Break** beside Enhance, Awaken, Stitch, rerolls, Club and Lock |
| Girl page Compact / Detailed (`src/ui/girlDetail.js`) | "Set bonuses" (new) and "Club bonuses" (today's club lines, renamed) as two lists |
| **Backpack** (`src/ui/screens/backpack.js`) and the gear filter (`src/ui/gearFilterBar.js`, `src/systems/gearFilter.js`) | Slot chips × 5, set chips, "LR", "Has pin"; Set Box opening (set picker, then the five main-stat picks with "Fill for a girl"); Use on Tie Pin, Collar Pin and Nightglass Lens |
| Gear card (`src/ui/gearTile.js`, `gearView.js`) | set crest corner, pin glyphs, the Nightglass tile and "LR" tag, the "of the Nightglass Sakura" name |
| UR and LR modals (`src/ui/gearUr.js`) | **Limit Break** modal (before → after, Power, cost, "Limit Break!"), a "Limit Broken!" moment (the twin of GA's "Awakened to UR!"); the Pin modal |
| **Formation** (`src/ui/screens/formation.js`) | Team chips 1–5 above the Squad card (tap to switch, hold to rename, copy or clear); a loadout letter on each squad tile when not A (tap to cycle for this team) |
| **Stage Prep** (`src/ui/screens/stage.js`) | the Counters sheet's formation section gets the team chips; a "Team 2" chip beside Start (the screen keeps no scroll at 844 × 390) |
| Co-op room (`src/ui/screens/coop.js`) | "You bring Team 2" with the chip until Ready |
| **Titan Trials** (`src/ui/screens/titans.js`) | each titan card shows its set (the five icons, "Drops: Spirit Squad"); the Titan shelf rows (the week's set box, Tie Pin) |
| Bounty and Total Assault cards (`src/ui/screens/` meta-a screens) | "Drops: Treasurer set" / "Power Bank set" |
| Battle panel and drawer (`src/ui/battle/towerPanel.js`, `drawerView.js`) | a set pip by her name (crest + 4/5, Nightglass for a form); a small ring toward Right Angle / Confetti Burst; the `cheer` buff icon (buff icons exist); a You're It mark on enemies (pooled, off on Low) |
| Unit Sheet, profile Build tab (`src/ui/unitSheet.js`, `src/ui/unitBuild.js`) | five pieces and the set chip |
| Profile card (`src/online/profileCard.js`) | five pieces per showcase girl after the SQL paste (`CARD_FIVE_PIECES`, like `CARD_GEAR_MARKS` `:51`): gear entries ≤ 5 (today ≤ 4, `supabase/migrations/20261020000000_profile_gear.sql:57`), a set key `t` (0–15), `tuned` 0–7; one migration file, no keys, pasted by the owner. The client byte budget goes 6,000 → 7,600 B (server cap 8,192) |
| Wiki (`src/data/wiki.js`) | "Gear & Rerolls" covers five slots, sets, pins and LR; a "Gear sets" article |
| Patch notes (`src/data/patchNotes.js`) | one per milestone (§14) |

---------------------------------------------------------------------------------------------------

## 12. Code plan

| File (hashed?) | Change | M |
|---|---|---|
| `src/data/gearSlots.js` (new, no) | slots, names, main pools, `ROLL_SLOTS`, `SET_ONLY_SLOTS` | M0 |
| `src/data/gearSets.js` (new, no) | `SET_IDS` (append-only), the set table (names, pieces, colours, sources, bonuses, texts), `SET_RARITIES`, indices | M0 (ids), M2 |
| `src/data/gearStats.js` (no) | three new stats, `NEW_STAT_SLOT` lists, caps (Aura Power 25 %, Armor Pierce 40, new stats), `LR_CAP_STEP`, `GEAR_FIT` rows, `setIdle` | M0 (defs), M2, M3 |
| `src/data/gearAwaken.js` (no) | `TUNE_BITS` + 3 (append), `LR_SCALE 4.0`, `LR_MAX_LEVEL 18`, `TUNE_NIGHT 4`, `LIMIT_BREAK_COINS`, LR suffix, new `MARK` prefixes (`gst:`, `glr:`, `gtx:`, `gtp:`, `gph:`, `gpm:`, `gps:`, `tm:`, `gp:`), `MIRRORED_ITEMS` + 6 | M0 |
| `src/data/items.js` (no) | Set Boxes (`gearbox`, `pickSet`), `tie_pin`, `collar_pin` (`dice`, "Gear Tool"), `lens_nightglass` | M0 (no sources), M2, M3 |
| `src/systems/gear.js` (no) | five slots; set pieces (`rollSetPiece`, `addGear(…, { set })`); `gearSetInfo` (clubs ×2, sets); totals; LR reads (`isLrGear`, `lrMul`, `effectiveValue`), `maxGearLevel` 18, `gearTier` 6, `canLimitBreak` / `limitBreakGear`; third ✦; `topMainRoll` / `topSubRoll` and the reroll rules; salvage refunds; `openSetBox` | M0 (reads), M2, M3 |
| `src/systems/gearMarks.js` (no) | every §9.2 mirror and restore step, whole-piece rebuild | M0 |
| `src/systems/save.js`, `rosterSave.js` (no) | readers (§9.4), five slots, teams, presets | M0 |
| `src/systems/teams.js` (new, no) | teams and loadouts: switch, conflicts, undo, mirrors | M1 |
| `src/systems/progression.js` (no) | caps with LR raises, new keys out (`set`, `setN`, `setLr`, `buffDurMul`, `controlMul`, `auraRangeMul`) | M2, M3 |
| `src/systems/titanRewards.js`, `rewards.js`, `src/data/shop.js`, `src/data/missions.js`, `src/online/coop/rewards.js` (no) | set sources, daily cap, shelves, Nightglass Hunt, milestones | M2, M3 |
| `src/sim/setRules.js` (new, **hashed**) | `SIM_SET_IDS`, passive and LR form constants, burst budget | M2, M3 |
| `src/sim/constants.js`, `status.js`, `combat.js`, `towers.js`, `buffs.js`, `abilities.js`, `drinks.js`, `hero.js`, `Sim.js` (**hashed**) | §2.4, §3.4 | M2 |
| `src/sim/gearRules.js`, `hero.js` (**hashed**) | LR guard caps | M3 |
| `src/online/coop/statLimits.js` (**hashed**) | §10.2 rows | M2, M3 |
| UI files of §11 | screens | M1, M2, M3 |
| `src/online/profileCard.js` + one SQL migration | five pieces, `t`, `tuned` 0–7 | M2 (SQL any time before) |
| `tools/gearGuard.mjs`, `tools/balance/*` (r5) | the five-piece and LR presets | M2, M3 |
| `CONTRACTS.md` (GearInstance, unit stats), `docs/ECONOMY.md`, `docs/FREEPLAY.md`, `docs/specs/GEAR_STATS.md` / `GEAR_AWAKEN.md` (a pointer here) | docs | M0–M3 |

**Never touched:** `src/data/types.js`, `src/data/stages.js` (the battle-data hash, `version.js`), `src/online/coop/loadout.js`.

---------------------------------------------------------------------------------------------------

## 13. Tests

| File | Cases |
|---|---|
| `tests/systems/gearSlots.test.js` (new) | `rollGear` with no slot draws exactly today's sequence for a fixed seed; new mains only on new slots; support stats never as subs; Pierce / Aura Power only on club pieces of their slots; grep: no `GEAR_SLOTS` outside `gearSlots.js` and the sim |
| `tests/systems/gearSets.test.js` (new) | 2 / 4 / 5 activation, mixing (4 + 1, 2 + 2 + 1, 3 + 2), at most one passive; clubs across five (3 + 2 → trick + two stats, `clubN` ≤ 3); SR+ only; membership survives awaken, Limit Break, rerolls, pins; `SET_IDS` = `SIM_SET_IDS`; set colours ΔE; every set has 5 pieces, names and icon keys |
| `tests/systems/gearSources.test.js` (new) | each titan's chest gives its own set; Rare boxes stay No set; Market Canal / Total Assault post-roll rates and the daily cap; other drops' rng sequences unchanged; Rainbow Gear Box asks slot and set |
| `tests/systems/setBox.test.js` (new) | five pieces of the picked set at the box rarity, +0, chosen mains, rolled subs; bag room 5; refused UR/LR; never sold for gems (shop scan); Workbench scan |
| `tests/systems/pins.test.js` (new) | Tie Pin = top of `mainStatRange` at every rarity and level; Collar Pin = top of `substatRange` + ▲ + ✦; limits 1 / 1 (LR 2); rerolls keep pinned lines; Prism keeps the main pin; salvage refunds; eligibility (refused below Legendary) |
| `tests/systems/lrGear.test.js` (new) | Limit Break needs UR +12 + Lens + coins; ×`lrMul`; +18 prices; 6 ▲; third ✦; cap raises per LR piece; LR Set Form only with five LR of one set; salvage refunds Seed, Lens, Needles, pins |
| `tests/systems/teams.test.js` (new) | migration (Team 1 = formation, loadout A = worn gear); switching team and loadout; conflicts and undo; `formation` always equals the active team |
| `tests/systems/save.test.js` (extend) | round trips with every new field, no `lossy`; a vendored old `cleanGear` / `cleanUnit` drops new-slot pieces, `set`, `lr`, `top`, teams and presets, and the new load restores all of them; old reroll on a pinned line refunds; old Prism on a pinned main re-applies; idempotence; hostile counters |
| `tests/systems/neverWeaker.test.js` (build it, GS §I) | §8.3 G3 under M2 and M3 rules, including the Aura Power cap move |
| `tests/sim/setSim.test.js` (new) | each passive and LR form: timers, counters, budgets, resets; You're It's strongest-wins and boss half; Control Strength before `CC_RESIST` and `ccLeft`; Buff Duration on every timed buff site; no rng draw added (draw count equal with and without sets) |
| `tests/online/coopStatLimits.test.js` (extend) | §10.2 rows; clamp identity at the honest max |
| `tests/sim/snapshot.test.js`, `tests/online/engines.test.js` | §10.4 split runs; `SET_START` equal in every engine |
| `tests/sim/perf.freeplay.test.js` | G12 |
| `e2e/gear-sets.mjs` (new; 844 × 390 and 1280 × 720) | five slot cards fit with no horizontal overflow; set and club strips; Set Box flow; Pin; Limit Break; loadouts; teams on Formation, Stage Prep and the co-op room |

---------------------------------------------------------------------------------------------------

## 14. Milestones, each shipping on its own (board Q14)

| M | Contents | Sim / co-op | Gates | Effort |
|---|---|---|---|---|
| **M0 Reader** | every reader, mirror and restore step of §9; the new item ids with no sources; nothing visible | unchanged | save tests; full vitest; smoke at both sizes; `simId()` unchanged | 3–4 days |
| **M1 Teams and loadouts** | §7 on today's three slots (the five-slot loadouts are ready for M2) | unchanged | teams tests; e2e Formation / Stage Prep / co-op; smoke | 3–4 days |
| **M2 Five pieces and sets** | the two slots, the six sets and passives, support stats in battle, clubs across five, set sources, Set Boxes, Rainbow Gear Box over five slots, pins, the set icons from `feature/gear-icons`, the profile card (after the SQL paste) | **bump** | §8.3 gates G1–G13 with `maxed5'` / `late5'` / `urLate5'`; ≥ 1 week after M0; after round 5 | 2–3 weeks |
| **M3 LR gear** | Limit Break, the Lens and its sources, +18, LR numbers, the third ✦ and second Collar Pin, cap raises, LR Set Forms | **bump** (or M2's) | G1, G4, G5, G7, G10–G12 with `lrLate5'` | 1 week |

Patch-note lines (2–5 player-facing bullets each): M1 "Save up to 5 teams and up to 3 gear loadouts per girl"; M2 "Two
new pieces: the Hair Clip and the Necklace. Six new five-piece gear sets, each with its own look and bonus. New: Set
Boxes and pins"; M3 "LR gear: Limit Break your rainbow gear into Nightglass LR".

---------------------------------------------------------------------------------------------------

## 15. Risks

| Risk | Guard |
|---|---|
| Five pieces double a geared girl's damage; content gets easier for geared players | owner confirms (board Q5); r5's band re-checked (G1); content is never tuned on gear (GA R22); the Wyrm guard (G4) |
| LR at ×1.25 numbers and big caps passes the Eclipse Wyrm or the co-op clamps | G4, G10; knob 2; the clamp rows of §10.2 |
| Sets + clubs + pins + LR are a lot for a child | one rule line per layer ("2 pieces: a stat. 4: the passive. 5: it grows."), idle greys, "Fill for a girl", the wiki article; the board can cut a layer |
| You're It is a team boost on bosses | half on bosses, G8 ≤ ×1.03, knob 1 |
| Stale tabs drop new-slot pieces | the whole-piece mirror; reader first; the `lossy` backup |
| Loadout switches move pieces players did not expect | the "Takes … from …" list before, Undo after |
| Set farming and boxes flood the 1,000-piece bag | daily caps on non-titan sources; multi-salvage already exists (`src/systems/salvage.js`) |
| Every number here is modelled | the measured gates of §8.3 decide; the knobs move only new numbers |

## 16. Owner questions

`docs/review/gear-update/OWNER_BOARD.md`. The build follows its defaults until the owner answers.
