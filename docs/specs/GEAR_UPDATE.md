# Gear update: five-piece sets, the Hair Clip and the Necklace, LR gear, Set Boxes, pins and loadouts (build spec, r3)

Sakura Sentinels, 2026-10-30, revision 3. Spec only: nothing in the game changes on this branch. The owner's answers
and the open questions are on `docs/review/gear-update/OWNER_BOARD.md`. Two companion specs ship beside this one:
`docs/specs/ACCESSORIES.md` (the sixth slot and the LR accessory gacha) and `docs/specs/BUILD_COACH.md` ("Set as Main").

**Owner requests (verbatim).**
- Oct 21 (HANDOFF §4): five equipment pieces; the hair accessory and the necklace come in role sets you farm (support,
  control, money, precision, abilities, …), each set from its own source; clubs on any of the five pieces, counted
  across all five (3 + 2 splits); support main stats Aura Power, Aura Radius, Buff Duration, Control Strength; LR gear
  above UR at max +18, each LR piece raising the stat caps a little, aura most and crit least; five pieces ≈ +60 % gear
  stats, so the Kage-relative tuning ships in the same update.
- Oct 30: "Multiple girl load outs, flat 3d icons for gear, new gear sets with custom designs, lr gear".
- Oct 30: "Custom boxes with pre loaded gear sets, new pins that allow you to max a main and substat".
- Oct 30: **"A set will be 5 pieces of gear now remember"**. This overrides HANDOFF §4's two-piece role sets.
- Oct 30: "LR's should be more op!" (mainly the LR units; this spec carries the intent into LR gear).
- Oct 30, new design: each set's 5-piece bonus **removes the cap on its signature stat**; five **set-less ("blank") LR**
  pieces **double every stat cap** (crit 75 % → 150 %) and carry much bigger raw stats; crit chance above 100 % becomes
  **super crits**, a second, bigger crit; LR units get an **accessory gacha** (ACCESSORIES.md); a **Build Coach**
  (BUILD_COACH.md).
- Oct 30, answers: "default all" on Q0–Q14, **except Q6**: a team in full blank LR **can** beat the wave-250 Freeplay
  boss, "not too easy but not impossible": a hard, earned kill with the best builds (§8.4 G4).
- Oct 30, decided: **LR floors, no nerfs** (board Q19): every LR unit at least about 2.5–3× the best Kage tier 5 on
  both a boss and a crowd, a floor and never a cap; gear is tuned on top of the lifted LR rows, never before (§8.4).

**Out of scope here.** The flat 3D gear icons are built on `feature/gear-icons` (the Blender items pipeline,
`tools/blender/items/`); §3.3 lists the keys and briefs. Balance round 5 is on `feature/balance-r5` (PR #40); §8 says
how this update is tuned on top of it.

**Sources.** `file:line` is `origin/main` at `60ce9cad` (v0.1.61, `COOP_PROTOCOL` 13, sim id `be940ecb2087`). r5 =
`feature/balance-r5` at `d6f092b7` (r2 cited `83b72083`; `6954c757` and `d6f092b7` add the LR rows and
`tools/bossCap.mjs`). GS = `docs/specs/GEAR_STATS.md`, GA = `docs/specs/GEAR_AWAKEN.md`, ASC =
`docs/specs/ASCENSION.md`. Number labels: **code**, **modelled** (Monte Carlo on the live roll formulas in a scratch
script; not a battle), **spec** (a number this file sets; §8 tunes it), **measured** (a sim run). Players are "they";
girls are "she". No other game is named in this file.

### Changes since r1 (review `docs/review/gear-update/review-r1.md`)

| Finding | Where it is fixed |
|---|---|
| F1 uneven gains | §8.3 (who moves, the three levers: average crit, DoT share and cap by pieces worn, a raise-only pass over r5's rows), §8.4 G1, knobs reworded, M2 / M3 estimates |
| F2 You're It, Control Strength | §2.4, §3.4 (an enemy record, not `sourceUid`), §10.1 and §12 (the 24 call sites) |
| F3 Buff Duration | §2.4 (per kind of buff; brews fill in; drinks `floor(shots × mul)`; the fit rule) |
| F4 card and Friend Support | §11.2 (the live `valid_card_unit` / `set_support`, one SQL paste, the LR marker, what a borrowed girl keeps) |
| F5 old builds | §9.2–§9.5 (a versioned export closes transfer codes to older builds, no legacy marks on new-slot pieces, the Nightglass ✦ in its own field, "piece gone" refunds, an LR- and pin-aware M0) |
| F6, F7 | board Q15, Q16; §9.1, §5.3 |
| L1–L13 | §10.2 (`rainbow`), §3.5 (`gearSetInfo` keeps its shape), §2.2 (slot readers), §2.3 (caps), §3.2 (Right Angle), §3.4 (bursts never crit), §2.3 (`AURA_FILL_FROM`), §9.3 (refunds by tier paid), §5 (which sets a box offers), §12 (item ids), §3.6 (the Normal-tier SR box), §7.5 (which side wins; salvage), §3.1 and §3.3 (wording, lockets), board Q5 and Q14 notes |

### Changes since r2 (review `docs/review/gear-update/review-r2.md`)

| Finding | Where it is fixed |
|---|---|
| F8 the LR-unit floor | §1 D16; §8.4 (the order: r5's LR rows first, gear tuned on top of them, never before; new gate **G0**); §14 (the r5 row; G0 in M2 and M3); board **Q19** (decided: LR floors, no nerfs); ACCESSORIES.md §5 |
| F9 G4 cannot run | §8.4 "G4 in detail" (the tool: r5's `tools/capBot.mjs` with new boards **W** and **LR**, `tools/bossCap.mjs`, a new `tools/wyrmGate.mjs`; 2 stages × 12 seeds = 24 runs; a margin and a kill ratio on every run; "weaker" defined; tuned to the low end so A-G2 has room); §12; §14 (M3's effort) |
| L14 the ceilings bind | §3.2 "Battle and maths ceilings" (each ceiling is her cap at source; the part above fills in), §3.4, §10.2 |
| L15 the crit clamps | §4.5 (`critCeil` at `mods.js:803` and `buffs.js:35-36`), §10.1, §10.2, §11.2 (a borrowed Geometry girl keeps her super crits) |
| L16 interest | §3.2 (5,000 coins a girl a wave; `CASH_MAX`), §10.3, §13 (a 2,000-wave cash test) |
| L17 draws | §3.2 and §3.4 (Confetti Burst takes Finale Pop's whole stripped spec); ACCESSORIES.md §3.1 and §7 (Target Call's forced shards take the average crit) |
| L18 You're It on DoT | §3.4 (inside `damageTakenBonus`, which `computeHit` and `computeDot` both read) |
| L19 refunds | §9.2, §9.3 (a pin or Nightglass ✦ whose line an older build rerolled), §9.4 (`gbl:` allowed on new-slot pieces) |
| L20 the welcome box | §5.2, §5.3 (one rule and one mark per box) |
| L21 the card | §11.2 (the card's jsonb length measured against 8,000, with measured sizes; `ac` defined once) |
| L22 the accessory field | ACCESSORIES.md §0, §1, §6, §7 (`unit.accItem`, outside `unit.gear` and the loadouts; `accId`, `.acs-`) |
| L23 rails, the duo's split | ACCESSORIES.md §3.1, §3.2, §7 |
| L24 the banner | ACCESSORIES.md §0, §4, §5, §11; board Q17 |
| L25 Build Coach | BUILD_COACH.md §0, §1, §2, §7, §8, §9, §10 |
| L26 wording | §3.3 (the only Lens item), §3.4 (the crit draw's site), §8.3 lever 1 (`avgCrit`, decided in `progression.js`) |

---------------------------------------------------------------------------------------------------

## 0. The update on one page

1. **Five slots.** Charm, Ribbon and Shoes stay exactly as they are. Two new slots: the **Hair Clip** and the
   **Necklace**, which come only as set pieces. Today's random drops keep rolling the three old slots, so no existing
   reward roll changes.
2. **A set is five pieces**, one per slot, each with the set's own design. Six sets launch, each from its own source:
   **Spirit Squad** (support, the Hyakki Daimyo), **Freeze Tag** (control, the Gloom Regent), **Geometry Set**
   (precision, the Eclipse Wyrm), **Party Popper** (crowd, the Foundry Titan), **Treasurer** (money, Market Canal) and
   **Power Bank** (abilities, Total Assault).
3. **Set bonuses at 2 / 4 / 5 pieces**: a stat, a passive, then a stronger passive that also **removes the cap on the
   set's signature stat** (crit, ability haste, aura power, control strength, money, splash). One passive per girl.
4. **Clubs stay on top**, on any of the five pieces, counted across all five (3 + 2: one trick, two club stats).
5. **Support main stats** on the new pieces: Aura Power and Aura Radius (Hair Clip), Buff Duration and Control
   Strength (Necklace), beside damage mains.
6. **LR gear.** A UR +12 piece **Limit Breaks** with a Nightglass Lens into one of two kinds:
   - **Set LR** keeps its set: numbers ×1.25 over UR, +18, a third ✦, cap raises per piece, and the set's **LR Set
     Form** at five LR pieces of one set.
   - **Blank LR** has no set (today's No-set pieces, or a set piece that gives its set up): numbers ×1.56 over UR, and
     **five blank LR pieces double every stat cap**. Crit chance above 100 % becomes **super crits**.
7. **Set Boxes**: a whole five-piece set at Mythic or Legendary, +0, mains picked, substats rolled; rare, never for
   gems, never UR or LR. Veterans get the first-clear and welcome boxes once (Q16).
8. **Pins**: the **Tie Pin** sets a piece's main stat to its best roll, the **Collar Pin** one substat. Gold, UR and LR;
   values only, no sim change.
9. **Teams and gear loadouts**: 5 saved teams, 3 gear loadouts per girl; a team remembers each girl's loadout.
10. **Power** (modelled, one crit carry): five pieces ≈ ×2.3, clubs and set ×1.15–1.30 more, set LR ≈ ×2.2 over UR,
    blank LR up to ≈ ×5.7 over UR before tuning. Kits that cannot crit and burn or poison kits gain less, so M2 adds
    gear-side levers (average crit, DoT share by pieces worn) and a raise-only pass over r5's rows. Tuned **after balance
    round 5, on top of it**; nobody is nerfed. The best full blank-LR team is tuned to beat the Wyrm sometimes (Q6).
    The LR units' floor (each at least about 2.5–3× the best Kage tier 5 on a boss and on a crowd, Q19) comes first,
    from round 5's LR rows; gear is tuned on top of it, never before (§8.4 G0).
11. **Safety**: `SAVE_VERSION` stays 2, `types.js` frozen, whole-piece mirrors, a reader first, and exports and
    transfer codes that older builds refuse.
12. **Co-op**: M2 (sets, super crits, levers) and M3 (LR) each need a `COOP_PROTOCOL` bump (or one together); M0, M1,
    the pins and the Build Coach keep the sim id.
13. **Milestones**: **M0** reader → **M1** teams and loadouts → **M2** five pieces and sets → **M3** LR gear; the
    accessories (A0–A2) and the Build Coach (C1) have their own milestones in their specs.

---------------------------------------------------------------------------------------------------

## 1. Decisions this spec follows

| # | Decision | Source | Status |
|---:|---|---|---|
| D1 | A set is five pieces, one per slot | owner, Oct 30 | decided (board Q0) |
| D2 | Charm, Ribbon and Shoes stay; the hair accessory and the necklace are new | owner, Oct 21 | kept |
| D3 | Each set from its own source | owner, Oct 21 | four titan sets, two from other modes |
| D4 | Clubs on any of the five pieces, counted across all five | owner, Oct 21 | kept |
| D5 | Support main stats: Aura Power, Aura Radius, Buff Duration, Control Strength | owner, Oct 21 | kept |
| D6 / D7 | LR gear above UR at +18 with cap raises (aura most, crit least); "LR's should be more op!" | owner, Oct 21 / Oct 30 | §4 |
| D8 / D9 | Five pieces ≈ +60 % stats; the Kage-relative tuning in the same update; r5's "no cap, everyone close to Kage", no nerfs | owner, Oct 21 / Oct 28 | §8 |
| D10 / D11 | Set Boxes and pins; multiple loadouts | owner, Oct 30 | §5, §6, §7 |
| D12 | Each set's 5-piece bonus removes the cap on its signature stat | owner, Oct 30 | §3.2 |
| D13 | Blank LR: five set-less LR pieces double every cap and carry bigger raw stats; crit over 100 % = super crits | owner, Oct 30 | §4 |
| D14 | Board Q0–Q14 "default all", except Q6: the best full blank-LR team can beat the Wyrm, hard and earned | owner, Oct 30 | §8.4 G4 |
| D15 | LR accessory gacha; Build Coach | owner, Oct 30 | ACCESSORIES.md, BUILD_COACH.md |
| D16 | LR units at least about 2.5–3× the best Kage tier 5 on **both** a boss and a crowd: a floor, never a cap; no nerfs | owner, Oct 30 | decided (board Q19); §8.4 G0 and the order |

---------------------------------------------------------------------------------------------------

## 2. Five slots

### 2.1 The slots

| Slot (id) | Card name | Main stats | Substats | Comes from |
|---|---|---|---|---|
| `charm` | Charm | ATK, Crit DMG (`src/data/types.js:281`) | today's eight; club pieces as today (GS §A.5) | as today + set sources |
| `ribbon` | Ribbon | Crit Rate, Range, Armor Pierce (`:282`) | today's eight; club pieces + Pierce | as today + set sources |
| `shoes` | Shoes | Attack Speed, Cost Reduction, Skill Haste (`:283`) | today's eight; club pieces + Aura Power | as today + set sources |
| `hair` | **Hair Clip** | ATK, Crit Rate, **Aura Power**, **Aura Radius** | today's eight; club pieces + Pierce | set sources and Set Boxes only |
| `necklace` | **Necklace** | Crit DMG, Attack Speed, **Buff Duration**, **Control Strength** | today's eight; club pieces + Aura Power | set sources and Set Boxes only |

- Every slot rolls the same way: substat count by rarity (`types.js:286`), the rarity scale, ▲ every 3 levels, ✦,
  UR and LR. The four support stats are **main stats only** (never substats), so a carry's substat odds on the new
  slots are today's eight plus the club-only stat on club pieces.
- **Classic main pools are frozen**: an older build deletes a whole piece whose main stat it does not know
  (`src/systems/save.js:272-273`); on a new slot the piece is unknown to it anyway and lives in the whole-piece mirror
  (§9.3).
- **Names.** A set piece has a fixed name (§3.3) plus the rarity suffix ("of the Crimson Moon", "of the Eternal
  Sakura", "of the Rainbow Sakura", and LR's "of the Nightglass Sakura"). New No-set charms stop using the noun
  "Pendant" (stored names are never rewritten, as with "Piercing", `src/systems/gear.js:53-54`). The Ribbon's nouns
  already include hair items (`gear.js:44`), so the new hair piece is a rigid clip, never a ribbon or a bow.

### 2.2 Where the slots live in code

- `GEAR_SLOTS` and `GEAR_MAIN_STATS` sit in `src/data/types.js:263-284`, which the sim imports (co-op hash).
  **`types.js` is not edited.**
- New non-hashed **`src/data/gearSlots.js`**: `SLOT_IDS` (`['charm', 'ribbon', 'shoes', 'hair', 'necklace']`,
  append-only), `GEAR_SLOT_DEFS`, `MAIN_STATS_BY_SLOT`, `ROLL_SLOTS` (the old three), `SET_ONLY_SLOTS`. A grep test
  forbids `GEAR_SLOTS` outside `gearSlots.js` and the sim.
- `rollGear` with no slot keeps picking among the old three (`gear.js:234`): every random drop and pinned test
  sequence stays identical.
- **Slot readers** that move to `SLOT_IDS` (L3): `src/systems/save.js` (`SLOTS` `:46`, `newUnitState` `:104`,
  `cleanUnit` `:240`), `src/systems/rosterSave.js:26`, `src/systems/gearMarks.js` (`gbx:` slot order, append-only),
  `src/systems/gear.js` (`wornGear` `:798`, `boxMark` `:332`), `src/online/profileCard.js:246`,
  `src/ui/battle/results.js:53`, `src/ui/gearSummary.js:46`, `src/art/icons.js` and the UI files of §11.
  (`craft.js`, `salvage.js` and `achievementMetrics.js` read rarities, not slots.)

### 2.3 The gear-stat table and caps after the update

| Key | Card name | Common base | Main on | Sub on | Cap (§4.3 adds LR) | Status |
|---|---|---|---|---|---|---|
| today's eight | (unchanged) | `types.js:271-278` | as today | all slots | as today; **Armor Pierce cap 40** (new; today's honest max is 34.8, GA §7.2) | unchanged |
| `piercePct` | Pierce | 8–16 % | never | club Ribbon, club Hair Clip | 150 % | slot list widened |
| `auraPct` | Aura Power | 2–4 % | Hair Clip | club Shoes, club Necklace | **25 %** (was 15 %) | now a main |
| `auraRangePct` | **Aura Radius** | 2–4 % | Hair Clip | never | **30 %** (L4) | new |
| `buffDurPct` | **Buff Duration** | 3–7 % | Necklace | never | 40 % | new |
| `controlPct` | **Control Strength** | 3–7 % | Necklace | never | **50 %** (L4) | new |

- `GEAR_STAT_DEFS` (`src/data/gearStats.js:10-14`) gains the three stats; `NEW_STAT_SLOT` (`:32`) becomes a list per
  stat; `cleanGear` (`save.js:280`) checks membership. `TUNE_BITS` (`src/data/gearAwaken.js:8`) is append-only and gains
  the three keys (13) so every stat has a stable mirror index.
- **Main values** (modelled): a Legendary +10 Aura Radius main averages 16.1 % (max 21.5 %); Buff Duration and Control
  Strength 26.9 % (max 37.6 %); UR +12 ×1.23 of that; set LR +18 ×1.86; blank LR +18 ×2.32. The raised caps (30 %, 50 %)
  leave room for a UR main plus the set's 2-piece stat (L4).
- **Aura Power 15 % → 25 %, never weaker** (board Q12, L7): the part above 15 % keeps filling in exactly as before
  (GS §B.1 rule 2) and now also counts as Aura Power up to 25 %. `gearFillIn` takes Aura Power's over-cap part from a
  constant of its own, **`AURA_FILL_FROM = 0.15`** (`src/data/gearStats.js`), not from `BATTLE_CAPS.auraPct`
  (`src/systems/gear.js:886-888` reads `BATTLE_CAPS` today), so Umeko's and Miko's aura-radius fill
  (`src/systems/progression.js:501`) is unchanged and G3 holds.

### 2.4 What the support stats do (sim, M2)

| Stat | Effect | Sim key and site | Never touches |
|---|---|---|---|
| Aura Power | as today (GS §A.4) | `auraPct` (exists) | cost cuts, detection, cleanse, brews, links |
| Aura Radius | her aura reaches that much further, on top of Range | `auraRangeMul` (exists) = `(1 + min(cap, auraRangePct)) × (1 + auraFill)` | her attack range |
| Buff Duration | per kind of buff (below) | new key **`buffDurMul`** | auras; debuffs on enemies |
| Control Strength | her slows, freezes, stuns, holds and groundings last that much longer; her push-backs push half that much further | new key **`controlMul`**, passed in the status context at every control call site (below) | a slow's strength (`MAX_SLOW`), bosses' immunity to holds and pushes |

**Buff Duration, per kind of buff (F3).** It acts only where a buff has gaps or a count:

| Buff | Rule | Site |
|---|---|---|
| Rally-kind ⚡ abilities and hero skill buffs | duration × `buffDurMul` | `src/sim/abilities.js`, `src/sim/hero.js` |
| Chika's overclock (periodic) | its `time` × `buffDurMul` | `src/sim/buffs.js:179-197` |
| Spirit Squad's Big Cheer | duration × `buffDurMul` | `src/sim/setRules.js` |
| Wakaba's drinks (counted in shots) | `floor(shots × buffDurMul)` | `src/sim/drinks.js:45-76` |
| Midori's brews (continuous: re-brewed every 6 s, each lasts 6.5 s, `src/sim/constants.js:179-181`, `buffs.js:98`, `:117`) | nothing: a longer brew changes nothing while she brews, so **Buff Duration fills in for her** | — |
| Auras | nothing (no timer) | — |

**Control Strength and You're It at the call sites (F2).** `applyStatus` (`src/sim/status.js:25`) is a pure function
with 24 callers in 10 sim files, each building its own context. Every call site that applies a control type (slow,
freeze, stun, shock, ground, hold) sets three context fields from the girl who applies it, through one helper
`statusCtxFor(sim, source)`: `sourceUid`, `controlMul` (her `unitStats.controlMul`; 1 for anything that is not a girl)
and `itBonus` (her You're It bonus or 0). `applyStatus` multiplies a control type's `duration` by `controlMul` **before**
boss resistance (`CC_RESIST`) and the Freeplay CC budget (`ccLeft`), and records You're It on the enemy (§3.4). The call
sites (all on M2's file list, §10.1):

| File | Sites |
|---|---|
| `src/sim/Sim.js` | `_applyStatusEvent` `:608-613`; `_onHitEffects` `:615-633` (her hit statuses, Potential `procStatus`, mark, silence, reveal, the holy silence); the push-back path `:635+` (`spec.knockback`) |
| `src/sim/abilities.js` | `applyStatuses` `:420-436`, called at `:448`, `:556`, `:607`, `:961`, `:962`, `:1140` |
| `src/sim/hero.js` | `:430`, `:436`, `:438`, `:449` (hero ult and skill effects) |
| `src/sim/barricades.js` | `:364` (reveal), `:415` (break slow), `:417` (release slow): Norika's barricades |
| `src/sim/vines.js` | `:56` (Chigusa's holds) |
| `src/sim/zones.js` | `:279`, `:283` (zone slow and vulnerable; today they reuse the shared `sim._statusCtx`, `Sim.js:225`, so they set their owner's fields first) |
| `src/sim/lab.js` | `:176` (Tenka's lab slow) |
| `src/sim/potential.js` | `:107`, `:163` |
| `src/sim/duo.js` | `:273` (silence: not a control type, but it sets the fields the same way) |
| `src/sim/status.js` | `applyStatus` itself |

- Zone and aura slows are re-applied while an enemy stays inside, so Control Strength only lengthens the linger after
  it leaves; a girl whose only control is a zone or aura slow gets it as a fill-in line (same rule as brews).
- **Every Line Counts** covers the three new stats (GS §B). `GEAR_FIT` (`src/data/gearStats.js:121-176`) gains them; a
  data test derives the rows from her kit: Buff Duration is real for "a timed buff with gaps, or a buff counted in
  shots" (so Midori's brews do not count), Control Strength for "a control status that is not re-applied every tick",
  and a worn 4+ Spirit Squad or Freeze Tag set makes the matching stat real. A playable girl with no row fails the test.

---------------------------------------------------------------------------------------------------

## 3. Sets

### 3.1 Rules

- **A set is five pieces** (D1): Charm, Ribbon, Shoes, Hair Clip, Necklace, each with the set's design.
- **Membership is fixed.** A piece's set comes from its source. The one way out is Limit Breaking it into **blank LR**
  (§4.1), which gives the set up for bigger numbers. Awakening, rerolls and pins keep the set.
- **Rarities.** Set pieces exist at Super Rare and up (UR and LR by awakening and Limit Break). **Set bonuses up to five
  pieces do not scale with rarity** (as clubs, GS §C.1): a free player's Mythic set gets the same 2 / 4 / 5 bonuses as
  a whale's UR set. Only the LR Set Form (five LR pieces of one set, §4.4) goes further.
- **Thresholds 2 / 4 / 5** (board Q1, answered "default"):
  - **2 pieces**: the set's stat, folded into her gear totals (not hashed), under the caps and Every Line Counts.
  - **4 pieces**: the set's passive (a sim rule).
  - **5 pieces**: the passive's stronger numbers, the **set cap** (its signature stat has no cap, §3.2) and the set's
    look (a crest on her card, her battle ring in the set colour; display only, off on Low and with Reduce motion).
- **Mixing.** Only one set can reach 4 of 5 slots, so a girl has at most one passive. 4 + 1: the passive plus any fifth
  piece. 2 + 2 + 1 and 2 + 3: two 2-piece stats.
- **Today's pieces are No set** (absent `set` field), and **they stay No set** (board Q15, F6). They fill a slot in a
  4 + 1, take clubs, bloom to UR, and they are what **blank LR** is built from (§4.1): a No-set UR +12 piece Limit
  Breaks straight into blank LR, giving nothing up.
- **The dead-passive rule** (GS §C.2's `trickIdle`, "never promise what is not there"): `setIdle(setId, unitId,
  battleCtx)` greys a passive or a set cap that does nothing for her kit (Right Angle on a kit that cannot crit; the
  Treasurer's interest cap on a girl with no interest). Her set chip, the Set Box picker and the battle panel read it.

### 3.2 The six launch sets (board Q2, answered "default"; spec numbers, §8 tunes them)

| Set (id) | Role | Source | 2 pieces | 4 pieces: the passive | 5 pieces | **5 pieces: set cap** |
|---|---|---|---|---|---|---|
| **Spirit Squad** (`spirit`) | support | Hyakki Daimyo | +8 % Aura Power | **Big Cheer**: every 20 s she cheers; girls in her aura (no aura: the 2 nearest within 2 tiles) deal +12 % damage for 5 s | +16 % for 6 s | **Aura Power** has no cap |
| **Freeze Tag** (`freezetag`) | control | Gloom Regent | +10 % Control Strength | **You're It**: an enemy under her slow, freeze, stun, hold or grounding takes +6 % damage from every girl while it lasts (minibosses and bosses +3 %) | +8 % (+4 %) | **Control Strength** has no cap |
| **Geometry Set** (`geometry`) | precision | Eclipse Wyrm | +10 % Crit DMG | **Right Angle**: every 4th attack is a sure crit | and those sure crits hit **×1.2** harder (L5: on the hit) | **Crit Rate and Crit DMG** have no gear cap, up to the battle ceiling (crit chance over 100 % gives super crits, §4.5) |
| **Party Popper** (`popper`) | crowd | Foundry Titan | +20 % Pierce | **Confetti Burst**: every 6th attack bursts in a 1-tile ring around the enemy it hits, for 50 % of the hit, on the other enemies there | every 5th, 60 % | **Splash** has no cap: her blasts keep widening with all her Pierce (×1.3 at the 150 % cap today) |
| **Treasurer** (`treasurer`) | money | Market Canal | +4 % Cost Reduction | **Bake Sale**: coins from enemies she defeats +10 %; a coin-maker's own coins too (Momo's wave coins, Chigusa's harvest, Ouka's coins per kill) | +15 % | **Money**: her wave interest passes `INCOME_INTEREST_MAX` (150 coins today, `src/sim/constants.js:170`), up to the maths ceiling (below) |
| **Power Bank** (`powerbank`) | abilities | Total Assault | +8 % Skill Haste | **Supercharge**: her ⚡ ability (a hero: her skill) deals +15 % damage and charges 10 % faster | +25 %, 15 % faster | **Ability haste** has no gear cap: her ⚡ ability takes half of all her Skill Haste, up to the battle ceiling |

**Battle and maths ceilings (L14, L16).** "No cap" means no *gear* cap. Every uncapped stat still has a hard ceiling, so
nothing in endless Freeplay can reach Infinity or NaN. Honest Set LR builds reach two of them (worked from §4.2: a
Geometry Set LR girl's crit chance ≈ 265 % before her kit and auras; half of a Power Bank Set LR girl's Skill Haste ≈
1.9), so **each ceiling is her cap at source**: `unitBattleStats` and `gearFillIn` cap the stat there, the part above
fills in (Every Line Counts, GS §B), her card shows MAX, and every honest value stays inside its co-op clamp row (§10.2,
G10).

| Set cap | Ceiling | Where it holds |
|---|---|---|
| Geometry: crit chance | 200 % (every hit a super crit) | at source; the sim's two crit clamps read `critCeil` (§4.5) |
| Geometry: crit DMG | `critMul` 12 | at source; the clamp row |
| Power Bank: ability haste | 0.75 (charge ×4, so `round(100 / (1 − h))` never divides by zero, `src/sim/gearRules.js:95-100`) | at source (`abilHaste`); `SKILL_HASTE_CAP` |
| Spirit Squad: Aura Power | 500 % (`auraPct` 5) | at source; the clamp row |
| Freeze Tag: Control Strength | ×4 (`controlMul` 4) | at source; boss resistance and Freeplay's CC budget still apply |
| Party Popper: splash | blast radius ×2.0 (frame time) | `applyGearReach` (`src/sim/mods.js:842-846`) |
| Treasurer: interest | **5,000 coins a girl a wave** (`INCOME_INTEREST_SET_MAX`, new, hashed); G9 may lower it, never remove it | `Sim.js:927` and the lab joiners' interest (`src/sim/lab.js:247`) |
| Any cash, any board | **`CASH_MAX` = 1e12** (new, hashed): `_gainCash` (`Sim.js:472-479`) adds at most `CASH_MAX − cash` and clears `_cashCarry` when it caps, an overflow guard like Freeplay's `hpMax: 1e7` (`src/data/freeplay.js:39`) | `Sim._gainCash` |

Money needs both. Interest compounds (`min(cap, interest × cash)` at every wave clear, `Sim.js:927`), every copy of a
Treasurer girl pays it, copies are unlimited, Piggy Bank's 2 % costs 120 coins (`src/data/units.js:503`) and Freeplay has
no last wave (`src/data/freeplay.js:110`). Uncapped, cash would pass 2^53 after about 40 waves at ×2.2 a wave and
overflow after about 900; one Infinity gain turns `_cashCarry` into NaN (`Infinity − Infinity`), then the cash, and a
battle save would write it as null. With the ceilings, interest grows cash at most linearly and cash stays an exact
integer far below 2^53. A unit test runs 2,000 wave clears of a Treasurer board at the ceilings (§13).

**LR Set Forms** (five LR pieces of one set, §4.4), named like the LR girls' forms ("Critical Mass · Event Horizon",
`src/systems/limitBreak.js`):

| Set | LR Set Form |
|---|---|
| Spirit Squad | **Big Cheer · Nightglass**: every 15 s, +20 % for 7 s |
| Freeze Tag | **You're It · Nightglass**: +10 % (bosses +5 %), and her control lasts 15 % longer |
| Geometry Set | **Right Angle · Nightglass**: every 3rd attack; sure crits ×1.3 |
| Party Popper | **Confetti Burst · Nightglass**: every 4th attack, 75 %, a 1.3-tile ring |
| Treasurer | **Bake Sale · Nightglass**: +20 %, and the first upgrade she buys each wave costs 10 % less |
| Power Bank | **Supercharge · Nightglass**: +35 %, 20 % faster, and it starts every wave 20 % charged |

- **Who suits which** (fits, not rules): Spirit Squad: Miko, Umeko, Noa, Wakaba, Ouka, Chika, the heroes' auras.
  Freeze Tag: Yuki, Fuu, Chigusa, Azami, Suzu, Hotaru, Yuzuha, Yoriko, Norika, Kogane. Geometry Set: Kage, Shiro, Aoi,
  Kaede, Tenka, Hana, Ena, Luna. Party Popper: Akane, Sango, Hotaru, Iroha, Marumi, Kinu, Raika, Rei, Midori, Nami, the
  duo. Treasurer: Momo, Ouka, Chigusa. Power Bank: Tenka, Kage, Chika, Suzu, Fuu, Iroha, the duo and every hero.
- **Rules that keep them in budget.**
  - Big Cheer is a `rally`-kind buff: the strongest cheer on a girl wins, it multiplies with auras like the ability
    rallies, and Skill Haste never speeds it.
  - You're It: the strongest bonus on an enemy wins; it multiplies with Moonbrand and the other marks; it is the one
    set effect that helps against a boss, so G8 holds it at ≤ ×1.03 on a boss board (board Q11, answered "default").
  - Right Angle and Confetti Burst count her own attacks only (echo throws, doubles' volleys, drones and pops do not,
    GS §C.3). A sure crit uses her crit DMG. A kit that cannot crit gets the idle chip for Right Angle and its average
    crit instead (§8.3).
  - Confetti Burst never chains and uses **Finale Pop's whole stripped spec** (`src/sim/towers.js:2251-2252`:
    `critChance: 0`, `status: []`, `mark: null`, `silence: 0`, `reveal: 0`, `knockback: 0`, `hpPct: null`; L6, L17), so a
    burst runs no on-hit effect, applies no status and draws nothing (a status with `chance < 1` would draw,
    `src/sim/status.js:29-31`). It shares one battle-wide budget like Finale Pop (`popBudget`, `src/sim/gearRules.js:30`).
  - Supercharge's faster charge never reaches rally or debuff kinds; its damage reaches every damaging ability.
  - Bake Sale and the Treasurer's interest pay her owner's wallet in co-op.

### 3.3 Designs and names: school uniform with tech touches (board Q13, answered "default")

| Set | Colours (art) | Motif | Charm | Ribbon | Shoes | Hair Clip | Necklace |
|---|---|---|---|---|---|---|---|
| Spirit Squad | cherry red, white | the school spirit squad at a match; light-up gear | **Pom-Pom Keyring** (a pom-pom with a light-up bead) | **Cheer Bow** (striped, a tiny speaker-grille knot) | **Light-Up Trainers** (white, glowing soles) | **Pom Clip** (a little pom-pom clip) | **Spirit Locket** (a locket with a soft status light) |
| Freeze Tag | ice blue, chalk white, a coral "tag" stripe | the playground game of freeze tag; chalk lines; a tag timer | **Tag Token** (a chalk-drawn token with an LED dot) | **Chalk-Line Ribbon** | **Hopscotch Sneakers** (a chalk grid on the soles) | **Pause-Button Clip** | **Tag Timer** (a round countdown display on a cord) |
| Geometry Set | slate blue, a cyan laser dot | the maths geometry kit | **Compass Keyring** (a brass compass with a laser dot) | **Protractor Ribbon** | **Ruler-Step Loafers** | **Set-Square Clip** | **Crosshair Locket** (a round locket with a crosshair window) |
| Party Popper | violet, warm gold | a class party: poppers, streamers, confetti; fibre-optic sparkle | **Popper Keyring** | **Streamer Bow** | **Glitter-Trail Trainers** | **Confetti Clip** (a clear clip filled with confetti) | **Party Locket** (a clear locket with tiny lights) |
| Treasurer | silver, mint | the class treasurer's kit; a calculator | **Abacus Bracelet** | **Coin-Clasp Ribbon** | **Coin-Buckle Loafers** | **Calculator Clip** (with an LCD) | **Coin Locket** (with a tiny LCD) |
| Power Bank | lime charge green, indigo | phone power banks; charge bars | **Power Bank Keyring** | **Charging-Cable Bow** | **Charge-Bar Trainers** | **Lightning Clip** | **Battery Locket** (showing a full charge) |

- Every Necklace is a locket or a cord piece, so none shares the "… Pendant" noun of older charms, and the "Nightglass
  Lens" is the only Lens **item** (L12, L26). "Focus Lens" (`src/data/units.js:1370`), "Polished Lens"
  (`src/data/unitsDuo.js:71`) and "Steady Lens" (`src/data/potential.js:405`) are path and Potential tier names, not
  items: no clash.
- **UI colours**: a set chip shows the set crest in the set colour; a test keeps the six set colours ΔE ≥ 15 from each
  other, from the six club colours (`src/data/clubs.js:20-27`) and from LR's Nightglass navy, and no set chip is a
  second yellow beside a screen's primary (the rule behind Bell's teal, `clubs.js:26`).
- **Icon keys for `feature/gear-icons`** (rarity in the tile, not the art): `gear_<set>_<slot>` (30 designs);
  `setbox_pick` (a uniform box with a band of all six set colours) and `setbox_<set>` (six: titan shelves and first
  clears use the four titan sets, events may use any set); `tie_pin`, `collar_pin`, `lens_nightglass`. UR and LR show
  in the tile: the rainbow ring; set LR's Nightglass navy with a white-gold line (`src/ui/styles/lr.css`); **blank LR
  the same Nightglass tile with a plain white-gold edge and no set crest**. Empty Hair Clip and Necklace slots use a
  line glyph (`src/ui/lineGlyphs.js`).
- **Names checked** (case-insensitive grep over `src`, `docs`, `tests`, `tools`, `e2e`, `CONTRACTS.md`): the set,
  passive, piece and item names have no hits. "Hair clip" appears only in look notes (Fuu's leaf clip,
  `tools/blender/lib/accessory.py:96`; a comet clip, `docs/specs/UNIT_GAPS.md:563`), not as a game item. First choices
  that clashed and were replaced: "Cheer Squad" (Wakaba's ★3 passive, `src/data/unitsNewGirls.js:208`), "Hall
  Monitors" (Ouka's tier, `:330`), "Starburst" (Akane's Potential proc, `src/data/potential.js:158`), "Overcharge"
  (Raika's path, `src/data/units.js:1032`), "Sparkler" (Akane's Tryout card), "Comet Clip" and "Coach's Whistle" (hero
  tracks in `docs/specs/BANNERS.md`), "Heart Locket" (the Memento icon, `tools/blender/items/catalog.py:21`) and any star
  or snowflake hair clip (Hikari's, Ruri's and Yuki's looks). Kept on purpose: "Nightglass" (the LR look,
  `src/ui/rarity.js:23`), "Limit Break" (the girls' LR step), Confetti Burst beside the Pyrotechnics club's Finale Pop
  (one bursts on attacks, the other on defeats). The girl page's "set bonuses" wording means club bonuses today
  (`src/ui/girlDetail.js:61-71`) and becomes "Club bonuses" beside "Set bonuses".

### 3.4 Set passives in the sim (deterministic; constants in a new hashed `src/sim/setRules.js`)

| Passive | Code site | State (battle save) | Random draws |
|---|---|---|---|
| Big Cheer | tower step: `t.cheerT` counts fixed steps; at the period every girl in her aura (or her 2 nearest within 2 tiles, ties by lower uid, like `secondCupTargets`) gets buff key `cheer` for `duration × buffDurMul`; read in `recomputeBuffs` | `cheerT` (tower, snap); `cheer` (derived) | none |
| You're It (F2) | in `applyStatus`: when a control status from a girl with `ctx.itBonus > 0` lands **or refreshes**, the enemy records `e.it = { bonus, left }`: the stronger bonus wins, and `left` = the longer of its own and that status's remaining time. `damageTakenBonus` (`src/sim/combat.js:47-50`) multiplies its sum by `1 + e.it.bonus` while `e.it.left > 0` (bosses and minibosses at half), so hits (`computeHit`, `:90`) and burn and poison ticks (`computeDot`, `:178`) both take it (L18); the enemy step counts `left` down. It never reads `sourceUid`, which stays with the first applier (`status.js:96-106`) | `it` (enemy, snap; created only when first set, so a battle without it keeps its snapshots) | none |
| Right Angle | each `attack*` after the "no target" return: `t.angleN++`; at the period that attack's hits crit for sure (×1.2 at 5 pieces, ×1.3 in the LR form); reset | `angleN` (tower, snap) | none added: each hit keeps its usual crit draw (`Sim._hit` draws once per hit when the spec's crit chance is above 0, `src/sim/Sim.js:575`; `computeHit` crits on `roll < critChance`, `src/sim/combat.js:91-92`; L26) and a sure crit only overrides its result |
| Confetti Burst | the same sites: `t.burstN++`; at the period `explode(sim, tower, burstSpec, e.x, e.y, r)` on the other enemies, `noPop: true`, `burstSpec` = Finale Pop's whole stripped spec (§3.2, L17), from the shared `sim.burstBudget` (+1 a step, ≤ 12 half-bursts banked) | `burstN` (tower, snap), `burstBudget` (sim, snap) | none |
| Bake Sale | `_killEnemy(e, tower)` (`src/sim/Sim.js`) and the coin-maker sites: her coins × (1 + share), rounded down | none | none |
| Supercharge | `src/sim/abilities.js`: charge per tick × (1 + charge) for hasted kinds after `abilityChargePerTick`; her ability damage × (1 + dmg); the LR form's wave-start charge beside `firstBellCharge` (`gearRules.js:104`) | none | none |
| Set caps (5 pieces) | each up to its ceiling, capped at source (§3.2): Geometry: crit chance up to 2.0 with `critCeil: 2`, so the sim's crit clamps let it pass 1 (super crits, §4.5); Power Bank: `abilityHaste` reads her new key `abilHaste` (half of her whole Skill Haste, up to 0.75) while her ult keeps the capped `ultHaste`; Party Popper: `applyGearReach` (`src/sim/mods.js:842-846`) reads her whole Pierce for blasts, up to ×2.0; Treasurer: her interest uses `INCOME_INTEREST_SET_MAX` (5,000) instead of `INCOME_INTEREST_MAX` (`Sim.js:927`, `lab.js:247`); Spirit Squad and Freeze Tag: caps at source only | none | none |

- Her set travels as unit stats **`set`** (the set id when she wears 4+, else null), **`setN`** (4 or 5) and
  **`setLr`** (all five LR, M3); 2-piece stats fold into her totals. The sim's own id list (`SIM_SET_IDS`) is kept equal
  to `SET_IDS` (`src/data/gearSets.js`) by a test.
- FX: event `setTrick { towerUid, kind }`, pooled, off on Low and with Reduce motion. The sim never reads a quality
  setting.

### 3.5 Clubs and sets together (board Q3, answered "default")

- **Independent layers.** A piece has at most one set (fixed) and at most one club (Mythic+, Armband). Both stack.
- **Clubs across five** (D4): every club with 2+ worn pieces gives its 2-piece stat (at most two clubs); a club with 3+
  gives its trick (at most one). No 4- or 5-piece club bonus.
- **Most a girl can stack**: the set's 2-piece stat + passive + set cap (or the LR Set Form) + one club trick + two
  club stats.
- **Code (L2): `gearSetInfo` keeps its shape.** `clubs` stays the `{ id: n }` object and `club` / `clubN` keep meaning
  "the largest club with 2+ pieces" (`src/systems/gear.js:808-818`), so `gearUr.js:165` and `gearView.js:157`, which
  sort `Object.entries(set.clubs)`, keep working. A 3 + 2 split's largest club is its trick club, so the sim's
  `trickClub` (`gearRules.js:36`) is unchanged; `unitBattleStats` sends `clubN: min(3, n)` so the clamp row stays
  `int(0, 3)`. New fields: `clubStats` (every club with n ≥ 2, at most two; `gearStatTotals` adds each one's 2-piece
  stat) and `set`, `setN`, `setLr`, `setStats` (up to two sets' 2-piece stats).
- **Balance math** (modelled, a crit carry at five UR +12 pieces, boss wall):

| Layer | Pieces | ×damage |
|---|---|---:|
| Club stat Taiko, trick Big Beat, second club stat Fencing | 3 + 2 | ×1.08–1.11 |
| Set stat Geometry (fills in at the crit DMG cap) | 2 | ×1.00–1.04 |
| Right Angle | 4 | ×1.06 (75 % crit) – ×1.13 (40 %) |
| Geometry 5-piece: sure crits ×1.2 | 5 | ×1.05 |
| **Clubs + set, before the set cap** | 5 | **×1.15–1.30** (today, three pieces and one club: ×1.09–1.16, GS §D.2) |
| Geometry's set cap (crit uncapped, super crits) on UR pieces | 5 | ×1.2–1.5 more for a crit carry with crit above 75 % |

### 3.6 Sources and farming time

| Set | Source | What pays a piece | Rarity of the piece | Cap |
|---|---|---|---|---|
| Spirit Squad, Freeze Tag, Geometry Set, Party Popper | **Titan Trials**: the Hyakki Daimyo, the Gloom Regent, the Eclipse Wyrm, the Foundry Titan (`src/data/titans.js:39-75`) | the Victory Chest's one box (`victoryChest`, `src/systems/titanRewards.js:56-72`) opens into a piece of **that titan's set**, slot at random among the five; Together Chests the same; first clears (`firstClearTable`, `:76-85`): Hard's Mythic box and Mayhem's Legendary box become set pieces, Nightmare's Legendary box becomes that titan's Legendary Set Box (§5) | the box's own roll (code): Normal **Rare 70 % (a No-set classic piece) / SR 30 % (a set piece, L10)**; Hard SR 72 % / Mythic 25 % / Legendary 3 %; Nightmare SR 15 % / Mythic 59.5 % / Legendary 25 %; Mayhem Mythic ≈ 51 % / Legendary 45 % | the 12 weekly keys (+6 carried) |
| Treasurer | **Market Canal** II–III (`res-coins`, `src/data/stages.js:1442`) | a post-roll step in `src/systems/rewards.js` (stage drop tables are co-op hashed; this step is not): each win or sweep, 25 % (II) / 35 % (III) | II: SR 60 % / Mythic 40 %; III: Mythic 75 % / Legendary 25 % on Nightmare (10 % on Hard) | 3 set pieces a game day from bounties and Total Assault together (`cap:setDay`) |
| Power Bank | **Total Assault**, Hard and up (`stages.js:1548+`) | the same post-roll: each win or sweep, 35 % | Mythic 70 % / Legendary 30 % on Nightmare (15 % on Hard) | (shared cap) |

- `grantGearBox(profile, rarity, rng, { set })` (`titanRewards.js:104`) and `addGear(profile, g, { club, set })` carry
  the set; a fresh Mythic+ set piece still joins a random club.
- **The Rainbow Gear Box** (`items.js:218`) opens into a slot and a titan set the player picks (today: a slot of three).
- **Farming time** (modelled: coupon collector, `11.4 / p` pieces of the wanted rarity; mains fixed with Prism Dice):

| Player | Where | Legendary set pieces a week | A full Legendary set | A full Mythic set |
|---|---|---:|---|---|
| Late, focused | one titan at Mayhem | ≈ 5.4 | **≈ 2 weeks** | ≈ 4 days |
| Late, focused | one titan at Nightmare | ≈ 3 | ≈ 4 weeks | ≈ 1 week |
| Daily | Market Canal III Nightmare | ≈ 5 | ≈ 2.5 weeks | ≈ 1 week |
| Daily | Total Assault Nightmare | ≈ 6 | ≈ 2 weeks | ≈ 1 week |
| Mid | one titan at Hard | ≈ 0.4 | months | ≈ 2 weeks |

  After that the farm goes on for better substats, Legendary pieces to bloom, and the other sets a team wants.
- **Later sets** (budgeted then): a summons set, a guard set, a hero set, one set per limited event.

---------------------------------------------------------------------------------------------------

## 4. LR gear (board Q8, answered "default"; blank LR is the owner's Oct 30 design)

### 4.1 Limit Break: Set LR or Blank LR

- **Limit Break**, the girls' LR word on purpose: a **UR piece at +12** and **1 Nightglass Lens + 150,000 coins**. It
  always works. The player picks the kind:
  - **Set LR**: the piece keeps its set. (A No-set piece cannot be Set LR.)
  - **Blank LR**: the piece has no set, or gives its set up for good ("This piece leaves the Spirit Squad set."). This
    is the only way a piece leaves a set.
- The piece stays `rarity: 'legendary'` with `ur: 1` and gains **`lr: 1`** (Set LR) or **`lr: 2`** (Blank LR); no new
  rarity id (GA R1). Auto-locked; "of the Nightglass Sakura"; the Nightglass tile (§3.3).
- **No undo.** Salvage pays everything back by what was really spent (§9.3).

### 4.2 Numbers ("more OP")

| | Legendary | UR | **Set LR** | **Blank LR** |
|---|---|---|---|---|
| Rarity scale (`gear.js:29`, `gearAwaken.js:5`) | 2.8 | 3.2 | **4.0** (×1.25 over UR) | **5.0** (×1.56 over UR); Armor Pierce at half rate (2.5 / 3.0) |
| Max level; main growth | +10 | +12 | **+18**, +6 % of base a level (Armor Pierce +4 %) | **+18** |
| ▲ every 3 levels (least-grown line) | 3 | 4 | **6** | **6** |
| ✦ (Starlight Needle) | 1 | 2 | **3** (the Nightglass ✦) | **3** |
| Collar Pins (§6) | 1 | 1 | **2** | **2** |
| Price tier (`gearTier`) | 4 | 5 | **6**: +13 … +18 cost 39,200 … 53,200 (277,200 in all) | **6** |

Line values (modelled; stored in Legendary form, read ×`lrMul` = 4.0 / 2.8 or ×`blankMul` = 5.0 / 2.8):

| Line | Legendary +10 | UR +12 | Set LR +18 | Blank LR +18 |
|---|---:|---:|---:|---:|
| ATK main, average roll / Tie Pin | 24.2 / 32.3 % | 29.7 / 39.6 % | **44.9 / 59.9 %** | **56.2 / 74.9 %** |
| Crit DMG main | 45.7 / 64.5 % | 56.1 / 79.3 % | **84.9 / 119.8 %** | **106.1 / 149.8 %** |
| ATK substat, average line | 17.3 % | 21.6 % | **31.5 %** | **39.4 %** |
| Crit DMG substat, average line | 32.7 % | 40.8 % | **59.5 %** | **74.4 %** |
| Crit DMG best line (Collar Pin + 2 ▲ + ✦✦✦) | — | — | 133 % | 166 % |

### 4.3 Caps with LR pieces (aura most, crit least; five blank LR pieces double them all)

Caps act on her gear totals in `unitBattleStats` (`src/systems/progression.js:474-513`). Each LR piece she wears (Set
or Blank) adds one step. **Five Blank LR pieces** double every base cap instead.

| Stat | Base cap | + per LR piece | Five Set LR | **Five Blank LR (×2)** |
|---|---:|---:|---:|---:|
| Aura Power | 25 % | +4 % | 45 % | 50 % |
| Aura Radius | 30 % | +3 % | 45 % | 60 % |
| Buff Duration | 40 % | +4 % | 60 % | 80 % |
| Control Strength | 50 % | +4 % | 70 % | 100 % |
| Range | 50 % | +4 % | 70 % | 100 % |
| Pierce | 150 % | +10 % | 200 % | 300 % |
| Crit DMG | +200 % | +10 % | +250 % | **+400 %** |
| Armor Pierce | 40 | +2 | 50 | 80 |
| Skill Haste | 50 % | +1 % | 55 % | 100 % (the battle reads at most 75 %: a cooldown never drops below a quarter) |
| Cost Reduction | 25 % | +0.5 % | 27.5 % | 50 % |
| Crit Rate | 75 % | +1 % | 80 % | **150 %** (the part over 100 % = super crits) |
| Fill-in soft limit (§8.3) | 20 % at five pieces | — | 20 % | 40 % |
| DoT cap (§8.3) | ×2.0 at five pieces | — | ×2.0 | ×3.0 |

A set's 5-piece **set cap** (§3.2) removes that one stat's cap whatever the rarity. The sim's guard caps follow the
highest honest values: `PIERCE_K_MAX` 300 (`src/sim/gearRules.js:18`; blasts up to 500 for a Party Popper 5-piece).

**Skill Haste, as built (M3 review r1 #4, r2).** `SKILL_HASTE_CAP` stays **0.5**; a new `ULT_HASTE_MAX` **0.75** is
the hero ult's ceiling (`src/sim/hero.js ultCooldown`, `src/sim/gearRules.js`). Gear + Potential ult haste is capped at
0.5 exactly as before (bit-identical to main for gear haste ≤ 0.5). Gear ult haste above 0.5 (only LR caps get there)
lifts the ceiling to 0.75 and her Potential ult haste stacks on top (0.55 gear + 0.2 Potential = 0.75). Abilities keep
half her capped haste (`abilHaste`, `ABIL_HASTE_CEIL` 0.75 with Power Bank's set cap). CONTRACTS.md records the same.
The step at the boundary is real: gear haste 0.50 → 0.51 adds her whole Potential ult haste (up to +21 points), so the
deferred G1 and G4 runs must measure a hero at 0.50 and at 0.51 gear haste, not only the presets' values.

**Pierce counts once (M3 review r1 #9, r2 #1, r3).** A kit whose blasts or splash traps Pierce can widen keeps all of
it (up to 300 %, 500 % for its blasts with Party Popper 5) and fills none of it in. `blastKit` asks the sim's own
question (`src/sim/mods.js applyGearReach`): it resolves her stats at `pierceK` 200 and at 300 on each of her builds
(every path at tier 5 with a tier-2 crosspath, her base, a hero at Lv 25) and checks whether her blast or splash-trap
radius moves. Every other kit uses Pierce on shots only, up to 200 % (`PIERCE_SHOT_PCT` = `PIERCE_MAX_EXTRA` 2): its
battle `pierceK` stops at 200 and the part above fills in as ATK (Every Line Counts, `src/systems/gear.js gearFillIn`).
An ability's splash (Tenka), a roll (Marumi), a drink (Wakaba) and a mortar (Kohaku & Tsubaki) are not blasts Pierce
widens; Kogane's splash from her hero levels is.

*Per path (r3 LOW 1, the owner's call).* Yuki, Fuu, Ruri, Iroha and Ena blast on some paths only (e.g. Yuki 5-x-x is a
pulse, Ena's paths 2 and 3 have no blasts). Her battle stats are made before she picks a path, so she keeps the whole
band; on her shot-only paths the part above 200 % does nothing. Pierce by path would read her tiers in the sim (a
protocol change), so it is left as is and said in Pierce's tooltip text.

### 4.4 LR Set Forms

When all five pieces she wears are LR **and** of one set, her passive takes its LR Set Form (§3.2; unit stat
`setLr: true`). The crest turns Nightglass. Blank LR has no form; its reward is the doubled caps and the bigger numbers.

### 4.5 Super crits (M2 with Geometry's set cap; M3 with blank LR)

- Crit chance above 100 % is possible only with Geometry's set cap or five Blank LR pieces. Then **every hit crits**, and
  the part above 100 % is the chance of a **super crit**: a crit that hits **×1.5** again (spec; knob). Crit chance
  counts up to 200 % (every hit a super crit).
- **Who may pass 100 % (L15).** The sim clamps crit chance at 1 in two places today: her unit crit merged into her
  kit's (`s.crit.chance = Math.min(1, …)`, `src/sim/mods.js:803`) and every crit buff (`t.eff.critChance` and the
  turret line, `src/sim/buffs.js:35-36`). Both become `Math.min(critCeil, …)`, reading her new unit stat **`critCeil`**:
  **2** for a girl who wears five Geometry pieces or five Blank LR pieces, **1** for everyone else (`unitBattleStats`
  sets it; clamp row int 1–2). A crit girl whose kit and aura crit pass 1 without either keeps today's 100 %.
- One crit draw per hit, as today (`Sim._hit`, `src/sim/Sim.js:575`): the same number decides the crit (`r < min(1, c)`)
  and the super crit (`r < c − 1`). No draw is added.
- The battle panel shows "Crit 112 % · super 12 %"; a super crit shows a larger, two-tone number (pooled FX, off on
  Low and with Reduce motion).

### 4.6 Nightglass Lens sources and pace

| Source | Amount | Cap |
|---|---|---|
| Weekly commission **Nightglass Hunt**: "Win 3 Titan Trials victories at Mayhem this week (sweeps count)" (`WEEKLY_MISSIONS`, `src/data/missions.js:25`) | 1 | 1 a week |
| Freeplay milestone "Reached wave 225", per tier (`src/online/coop/rewards.js` milestone items) | 1 × 3 | once per tier |
| Achievements "First Nightglass" (a Limit Break) and "Nightglass Form" (an LR Set Form worn): one Lens each, no gems (tier 0, their own `gear` wave: the frozen gem caps stay) | 2 | once |
| Each limited event's exchange, top shelf | 1 | 1 an event |

No gem price, no stage drop, no Workbench output. About one LR piece a week for an active top player (the Lens and the
weekly Seed): a full LR set on one girl in about 5–6 weeks, a whole team in about a year.

### 4.7 Power of LR (modelled, one carry, over five UR +12 pieces with ✦✦, best of 10)

| | Crit carry | Kit that cannot crit |
|---|---:|---:|
| One Set LR piece (four UR) | ×1.20 | — |
| Five Set LR pieces, caps raised | ×2.16 | ×1.78 |
| Five Set LR Geometry pieces (crit uncapped, super crits) | ×3.79 | (average crit, §8.3) |
| **Five Blank LR pieces** (scale 5.0, caps doubled, super ×1.5) | **×5.68** | **×2.49** before the average-crit lever |
| The same with super ×1.3 and scale 4.6 (knob values) | ×4.54 | — |

Blank LR at the owner's numbers is the strongest gear in the game by a wide margin. §8.4's G4 tunes it so that the best
full blank-LR team beats the Wyrm only sometimes (Q6).

---------------------------------------------------------------------------------------------------

## 5. Set Boxes, the custom pre-loaded boxes (board Q9, answered "default")

### 5.1 The boxes

| Field | Value |
|---|---|
| Items | **Set Box** (`setbox_pick_mythic`, `setbox_pick_legendary`: choose any of the **six** sets when opened, L9) and a set's own box (`setbox_<set>_mythic`, `setbox_<set>_legendary`; the titan shelves and first clears use the four titan sets, events any set). Category `gearbox`, opened through a picker like the Rainbow Gear Box (`pickSet: true`; `openGearBox` refuses it, `gear.js:311`) |
| Contents | all five pieces of one set at the box's rarity, +0 |
| Main stats | **chosen**, one per piece; "Fill for a girl" picks them from her wants in one tap |
| Substats | **rolled** (the slot's pool; a club piece's pool and favourites) |
| Club | each Mythic+ piece joins a random club, as every drop |
| Room | 5 free places in the gear bag (`GEAR_BAG_MAX` 1000, `gear.js:293`) |
| Never | UR, LR, a gem price, a stage drop, a Workbench output, the Gem Shop's Titan shelf (`src/data/shop.js:98`) |

### 5.2 Sources

| Box | Source | How often |
|---|---|---|
| Set Box (Mythic, choose) | welcome gift when Titan Trials open (`titansUnlocked`, `src/systems/titans.js:99`; after 3-5), once a save (`su:welcome`, §5.3); each event's exchange; achievement "Five of a Kind" | 1 once + 1 an event |
| A titan set's box (Mythic) | Boss Exchange **Titan shelf**: the Titan of the Week's set, 150 Assault Tokens | 1 a week |
| A titan set's box (Legendary) | that titan's **Nightmare first clear** (solo), once a titan (`su:titanbox:<titan>`, §5.3) | 4 once |
| Set Box (Legendary, choose) | each event's exchange top shelf; achievement "Set Collector" (three different full sets) | 1 an event + 1 once |

**Why each set's source still matters.** A box gives coverage: five slots with chosen mains, at +0 with random
substats. A Legendary box saves about 2–4 weeks of coupon collecting and comes about once a month. Farming stays the way
to many Legendary pieces with good substats, to gold pieces to bloom, and to several sets at once. A Mythic box gives
the bonuses early but Mythic numbers (×0.79 of gold, three substats) and no path to UR or LR. Box pieces bloom and
Limit Break like any piece; a box never holds UR or LR.

### 5.3 Veterans get the new boxes once (board Q16, F7, L20)

**One rule and one mark per box**, so veterans and new players are paid by the same check and nobody is paid twice:
- **The welcome Mythic Set Box**: whenever a save has Titan Trials open (`titansUnlocked`, `src/systems/titans.js:99`)
  and no `su:welcome` mark, pay it and set the mark. A veteran past 3-5 is paid on M2's first load; a new player when
  they clear 3-5.
- **A titan's Legendary Set Box**: whenever a save has that titan's Nightmare first clear (`tfc:<titan>:2`,
  `src/systems/titans.js:9`, `:244`) and no `su:titanbox:<titan>` mark, pay it and set the mark. A veteran is paid on
  M2's first load for every titan already cleared; a new player at the clear (the first-clear table, §3.6, pays it
  through this same check, never on its own).
- The check runs in `migrateProfile`, after each campaign result (clearing 3-5 opens Titan Trials) and after each Titan
  Trials result, and pays into items with one notice line.
  The marks are counters, so an older build keeps them; an older build that drops the boxes gets them back from `inv:`
  mirrors (§9.2). There is no separate `su:vet` mark.

---------------------------------------------------------------------------------------------------

## 6. Pins: max a main stat and a substat (board Q10, answered "default")

The game already has the **Lock Pin** (`lock_pin`, `src/data/items.js:230`); the new pins join that gear-tool family.
"Pin" also names profile pins (`PINS_MAX`, `src/online/profileRules.js:15`) and Kinu's ring pins (`src/sim/rings.js`),
so the code never uses a bare "pin": item ids `tie_pin`, `collar_pin`; actions `topMainRoll`, `topSubRoll`; line mark
`top`; mirror `gtp:`.

| | **Tie Pin** (`tie_pin`) | **Collar Pin** (`collar_pin`) |
|---|---|---|
| Does | the **main stat** becomes its best roll for its rarity (`main.base` = the top of `mainStatRange`, `gear.js:129`); it keeps growing with the level | **one substat** becomes its best roll (`base` = the top of `substatRange`, `gear.js:101`); its ▲ and ✦ stay on top |
| Item rarity | Legendary | Mythic |
| Works on | Legendary, UR, Set LR, Blank LR | the same |
| Per piece | 1 | 1 (LR: 2, on different lines) |
| Cost | 1 Tie Pin + 20,000 coins | 1 Collar Pin + 10,000 coins |
| Rerolls | Prism Dice keeps the pin: the new main also takes its best roll | Fortune Dice keep a pinned line in place with its ▲ (a free lock); a Lock Pin is offered only while 2+ lines still reroll |
| Undo | none; the preview shows before → after and Power; **salvage returns every pin** (§9.3) | the same |

**Sources** (never for gems): Tie Pin: Titan shelf 1 a week (60 Assault Tokens), Mayhem Victory Chests 5 %, Freeplay
"Reached wave 175" per tier (3 once), achievements (2), events (1 each). Collar Pin: Bounty Exchange 2 a week (25 Bounty
Tokens), Victory Chests (Nightmare 10 %, Mayhem 20 %), achievements (3), events (2 each). About 1–2 Tie Pins and 3–5
Collar Pins a week for an active late player. **Power** (modelled): all five pieces pinned ×1.20; one piece ×1.04.

**UI.** A pinned line carries a gold pin glyph (a different shape from ✦ and ▲); a pinned main shows "Best roll". The
slot sheet gains **Pin** (choose Main or a substat, before → after, Power, cost). **Sim and co-op**: values only,
through `unitBattleStats` (not hashed); the clamps' honest maxima already assume best rolls (GA §9.1), so no sim id
change and no bump. Pins ship with M2's measured pass.

---------------------------------------------------------------------------------------------------

## 7. Teams and gear loadouts (board Q7, answered "default")

### 7.1 What the code has today

- **One formation**: `profile.formation = { hero, towers }` (`src/systems/save.js:154`, cleaned at `:598-604`).
  Formation edits it (`src/ui/screens/formation.js:89-99`); Stage Prep reads it (`formationIds`,
  `src/ui/screens/stage.js:390`, `:1158-1170`); the battle (`src/ui/battle/setup.js:44`), co-op
  (`src/ui/screens/coop.js:455`, `pickLoadout`), Tryout setup, Sandbox, results, missions and achievements read it too.
- **No saved teams and no gear presets.** Gear lives on the girl; equipping takes a piece from its wearer
  (`equipGear`, `src/systems/gear.js:367-385`). Earlier plans named both (GA §14 #5; WE-3 in
  `docs/specs/UNITS_BACKLOG.md:60`; the old prototype's three teams, `docs/merge/world.md:91`). "Loadout" means a
  co-op loadout in code (`loadout.js`), so the new objects are **teams** and **presets** in code; players see "Team"
  and "Loadout".

### 7.2 The design

- **Teams**: up to **5**, each a hero + up to 8 students, named "Team 1" … "Team 5" (a short rename kept on this device,
  never sent online). The active team **is** `profile.formation`, so every reader keeps working.
- **Gear loadouts**: up to **3 per girl** (A / B / C), each the five pieces she wears. Her active loadout is what she
  wears; switching it equips its pieces.
- **A team remembers which loadout each girl uses** (default A). Pieces are unique: a piece named by two loadouts moves
  when one is put on.

### 7.3 Rules

- A switch that takes pieces from other girls lists them first ("Takes Keen Charm from Aoi") with Switch / Cancel,
  then Undo. A salvaged piece leaves its slot empty, with a red dot on the loadout chip.
- Two members of one team naming the same piece: the editor marks both; the first girl in team order gets it.
- A battle uses the stats at its start; a saved battle keeps its frozen team (`stage.js:938`). A co-op room's team chip
  can switch until Ready. Tryout Day and Sandbox keep their own squads.
- Copy a team, Clear a team and "Copy loadout A to B" are one tap each.

### 7.4 Save shape (additive)

- `profile.teams = { active: 0…4, list: [{ name, hero, towers, use: { [unitId]: 0…2 } }] }`; `profile.formation` always
  equals the active team's hero and towers. Migration: Team 1 = today's formation.
- `unit.presets = [{ charm, ribbon, shoes, hair, necklace }]` (1–3) and `unit.preset`; `unit.gear` always equals
  `presets[preset]`. Migration: loadout A = what she wears.
- Mirrors (§9.2): `tm:a`, `tm:<team>:<unitId>`, `gp:<unitId>`, `gp:<unitId>:<n>:<slot>`. Custom team names are not
  mirrored.

### 7.5 After an older build, and salvage (L11)

- **Present fields win.** An older build can change `profile.formation` and `unit.gear` while it drops `teams` and
  `presets`. On the next load the present formation becomes the active team and the present gear the active loadout;
  the other teams and loadouts come back from the mirrors.
- **A piece named only by an inactive loadout** is not equipped, so salvage would take it silently. Multi-salvage skips
  it (like a locked piece); single salvage asks "Kage's Loadout B uses this piece. Salvage it anyway?".

---------------------------------------------------------------------------------------------------

## 8. Power budget and balance (with balance round 5)

### 8.1 Five pieces (modelled; DPS proxy `(1 + ATK + fill) × (1 + Speed) × crit` against no gear, GA §7; best of 10)

| Profile | Crit carry: ×damage over three pieces | Kit that cannot crit |
|---|---:|---:|
| One average gold +10 piece per slot | ×1.93 (the review's model: ×2.08) | — |
| Best of 10 gold +10 | ×2.37 (review: ×2.50) | ×1.60 |
| Best of 10 UR +12 ✦✦ | ×2.30 (review: ×2.31) | ×1.70 |

- +67 % lines make **about double the damage** for a crit carry, because ATK, speed and crit multiply (board Q5,
  answered "default"). Only the ratios of this proxy are used; it is a boss-wall model.

### 8.2 Everything together (modelled, one crit carry, over today's best three-piece UR set with one club)

| Step | ×damage |
|---|---:|
| Five UR pieces instead of three | ×2.30 |
| Clubs across five + her five-piece set, instead of one club | ×1.05–1.12 |
| Pins on all five pieces | ×1.20 |
| **Full UR endgame** | **≈ ×2.9–3.1** |
| Five Set LR pieces + LR Set Form | ×2.16 × 1.06 |
| Five Blank LR pieces (owner's numbers, before G4 tunes them) | ×5.68 |

### 8.3 Uneven gains and the levers (F1)

**Who G1 would move** (modelled, five pieces over three, before the levers):
- **Crit carries gain the most** (×2.3): crit rate × crit DMG is bilinear and both grow. Kage is one.
- **Kits that cannot crit gain ×1.6–1.7**, about 30 % behind: Suzu (traps never crit, `src/data/gearStats.js:135`), and
  every girl whose damage is mostly trap hits.
- **Burns and poisons** take gear ATK only through `dotMul = min(1.25, 1 + 0.5 × gear ATK)` (`progression.js:461`,
  `:502`), which three average gold pieces already nearly fill, so the DoT part gains about ×1.0: Akane and Midori fall
  20–35 % behind, by how much of their damage is DoT. Ena's hexes (a share of max HP) never scale with gear, by design.
- At LR the spread widens: Blank LR gives a crit carry ×5.7 and a kit that cannot crit ×2.5 (§4.7).
- Supports are judged by their boost to allies (G2), not by the band.

**The levers, gear side first** (M2 and M3 numbers; G1 tunes them):
1. **Average crit for damage that cannot crit.** Trap hits that never crit, burns, poisons and curse bursts are
   multiplied by her **average crit factor** `1 + min(1, c) × (k − 1) + max(0, min(1, c − 1)) × k × (S − 1)` (c her crit
   chance, k her crit hit multiplier, S the super-crit multiplier). It is deterministic (no draw), so her crit gear works
   for her as it does for a carry. Never weaker: a girl whose crit lines filled in gets the better of the old fill-in
   and the average crit. **`progression.js` decides which** (L26): `unitBattleStats` works out both and sends the
   winner as a new flag **`avgCrit`** (1: her crit lines stay crit and the sim applies the average crit; 0: they fill
   in as today and the sim does not), so the two never stack.
2. **DoT share and cap by pieces worn**: half of gear ATK and ×1.25 at three pieces (today), three quarters and ×1.6 at
   four, all of it and ×2.0 at five; five Blank LR pieces double the cap's bonus part (×3.0).
3. **The fill-in soft limit by pieces worn**: 12 % at three, 16 % at four, 20 % at five; doubled by five Blank LR (40 %).
4. **A raise-only pass over r5's rows** (`src/data/balance.js` on r5) for any striker still below 90 % of her r5 ratio
   to Kage after 1–3: her damage or boss row goes **up** until she is back in; no row ever goes down. Budgeted: 3 days
   in M2 and 2 days in M3 (§14). M2 and M3 change the sim id anyway.

### 8.4 How it is tuned with balance round 5

- **Order (F8), in three steps.**
  1. **Balance round 5 and its LR rows ship first** (after Nov 1, 7 PM Central, with their own `COOP_PROTOCOL` bump).
     The balance work on `feature/balance-r5` is lifting the LR units now: `LR_POWER` rows in `src/data/balance.js`
     (r5 `6954c757`, `d6f092b7`): the duo ×1.6 against bosses and ×1.05 damage, Tenka ×3.4 against bosses. r5's own
     readings against the best Kage T5: at `6954c757` the duo's builds 2.46–3.22× on a crowd and 2.66–2.87× on a boss,
     Tenka (Rail Arms LR) 3.58× on a crowd and 2.75× on a boss; `d6f092b7` adds the duo's ×1.05 (her lowest, Starfall
     LR on a crowd, 2.46 → 2.58×): "every LR axis ≥ 2.5×".
  2. **M2 and M3 are tuned on top of the lifted rows, never before**, on a branch with r5 merged. **G0 must pass there
     before any other gear gate runs**, and every gate is re-run if r5 changes after review.
  3. G4 and ACCESSORIES A-G2 run with the LR units at their lifted rows. A later raise of an LR unit (or a new LR unit)
     re-runs G0 and G4 (knobs below).
  M0, M1 and the Build Coach change no battle numbers and can ship any time.
- **The bench moves to five pieces.** r5's bench gives each girl "three UR +12 Taiko pieces at average rolls"
  (`tools/balance/r5Bench.mjs:9`). The gear pass adds presets **`maxed5'`** (five average gold +10 pieces in her best set,
  Taiko 3 + Fencing 2), **`late5'`** (best of 10), **`urLate5'`** (UR +12 ✦✦, pins), **`lrSet5'`** (Set LR, LR Set Form),
  **`lrBlank4'`** (four Blank LR pieces and one UR: no doubled caps) and **`lrBlank5'`** (Blank LR, super crits); the r5
  bench profile becomes five UR +12 pieces in her best set. Each preset is built from five real pieces per girl through
  `unitBattleStats` (as r5's `full` profile, `tools/balance/maxedProfile.mjs`) and is shared by the bench
  (`r5Bench.mjs`) and the boards (`tools/potentialProfiles.mjs`'s `--gear`), so both use one table.
- **Knobs lower only new gear numbers, before they ship. r5's rows only go up (lever 4). Nothing a player owns is ever
  lowered** (this replaces r1's "never on r5's rows").

**Gates (each a measured run, seeds 7 and 11 unless said):**

| # | Gate | Tool | Pass |
|---|---|---|---|
| G0 | **The LR floor (F8, board Q19)**: runs first, in M2 and in M3 | `tools/balance/r5Bench.mjs`: her best tier-5 build on each ruler (`boss` and `crowd`), r5's supports (Umeko 2-5-0, Midori 5-0-2), seeds 9/1/2; each LR unit and the best Kage T5 in the **same** gear preset (r5's `full`; `urLate5'` in M2; `lrSet5'` and `lrBlank5'` in M3) | every LR unit ÷ the best Kage T5 ≥ **2.5 on both the boss and the crowd ruler**; a floor, never a cap (above 3 is fine); a miss is fixed by a raise-only LR row in that milestone's pass (lever 4), never by lowering Kage |
| G1 | The band | `tools/balance/r5Bench.mjs` with `maxed5'`, `urLate5'` (M2), `lrSet5'`, `lrBlank5'` (M3) | every striker's ruler ÷ Kage's ≥ 90 % of its r5 value after the levers; rises are fine (no cap) and a rise over ×1.25 is reported |
| G2 | Supports' boost | r5's support table, each support in her best set (Spirit Squad's uncapped Aura Power included) | none falls; a rise over ×1.25 of its r5 value goes to the owner |
| G3 | Never weaker | `tests/systems/neverWeaker.test.js` (fixtures + 10,000 random profiles) and r5's `tests/systems/powerKit.test.js` | `unitBattleStats` after ≥ before on every key; Power never drops |
| G4 | **The Wyrm (Q6, changed; F9)** | **`tools/wyrmGate.mjs`** (new) over r5's `tools/capBot.mjs` and `tools/bossCap.mjs`, boards A, A2, **W** and **LR**, LR units at their lifted rows, no accessories; Freeplay 4-5 and 1-5, Blossom, Normal; **2 stages × 12 seeds = 24 runs** a board and preset (details below) | the best board in `lrBlank5'` wins **6–18 of 24** (the owner's "1–3 of 4"), at least 2 on each stage, **tuned to 6–10**; every board in `urLate5'`, `lrSet5'` and `lrBlank4'` wins **0 of 24** with a kill ratio ≤ 0.8 on every run |
| G5 | Titans | `tools/balance/r5Titans.mjs` + the ladder | the Mayhem rank reached is recorded; weekly rewards stay inside their caps |
| G6 | Tryout Day | `tools/bench.mjs --hit --ceiling --maxed geared` (five pieces) and `tools/tryoutBot.mjs --sweep` | Grade 12 maxed win rate recorded; above 50 % goes to the owner |
| G7 | Abilities | AB's A7 bench at `urLate5'` and `lrBlank5'` with Power Bank's uncapped ability haste and Bell | no ability breaks its own rules (Momo's two casts a wave; rallies and debuffs unhasted); a board-wide ability gain above ×1.6 goes to the owner |
| G8 | You're It on bosses | a boss board with a Freeze Tag girl | ≤ ×1.03 (×1.05 in the LR form) |
| G9 | Coins | Freeplay coins at waves 50 / 100 / 150 with Treasurer (Momo's interest up to its 5,000 ceiling) | recorded; above ×1.5 of today's goes to the owner (knob: lower `INCOME_INTEREST_SET_MAX` below 5,000; the ceiling itself always stays, §3.2) |
| G10 | Co-op clamps | `tests/online/coopStatLimits.test.js` | `clamp(unitBattleStats(honest max))` is the identity (§10.2) |
| G11 | Clan boss | `tests/online/clanBoss.test.js` at the new honest max | caps and the full-run time hold |
| G12 | Perf | `tests/sim/perf.freeplay.test.js`, r5's `tests/sim/perf.test.js` | the 60-girl board in `lrBlank5'` with Confetti Burst everywhere, Big Cheer and You're It, at 3×, inside the frame budget |
| G13 | Finales | `tools/balance/r5Finales.mjs` | no win becomes a loss |

**G4 in detail (F9).**
- **Boards.** r5's `tools/capBot.mjs` builds boards with real coins (Builds A, A2, B and C; `tools/bossCap.mjs` uses
  them). `tools/gearGuard.mjs` cannot: it plays only the Freeplay bot's `team` board (`tools/freeplayBot.mjs:24-35`).
  G4 adds two capBot boards, each copy with its own plan like A's: **W** (GS §D.1's Build W: Kaede, Chika, Hotaru,
  Shiro, Kage, Sango, Midori, Miko; hero Luna; until now only modelled, `docs/specs/GEAR_STATS.md:581`) and **LR**
  (Kohaku & Tsubaki and Tenka as the carries at their best tier-5 builds, with Umeko, Miko, Midori and Chika; hero
  Hikari). "The best board" is the one with the highest median kill ratio (below) in `lrBlank5'`.
- **One run, three numbers.** Each run plays capBot's board with real coins to wave 249 and keeps that board. From it:
  the **win** (wave 250 played for real: the Wyrm falls); the **margin** (on a loss, the Wyrm's HP left when the board
  fell, or the wave it fell on if it fell earlier; on a win, the seconds the Wyrm lived); and the **kill ratio K**
  (`tools/bossCap.mjs --bosses fp_eclipse_wyrm --waves 250`: the most Wyrm HP that board kills alone, bisected, ÷ its
  scheduled HP at 250). K is the tuner's steering number; only wins count for the band.
- **The count.** 2 stages (4-5, 1-5) × 12 seeds (7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47) = **24 runs** a board
  and preset, on Blossom at Normal. "1–3 of 4" is a win rate of 25–75 %, so the band is **6–18 wins of 24**.
- **Not fragile.** The best board must also have its median K in 0.9–1.15 and its losses' median HP left ≤ 30 % (a hard,
  earned kill, not a wall). The tuner steers by the median K, not by single seeds; a knob step that moves the median K
  by more than 0.1 is split into smaller steps. Weaker presets must miss clearly (K ≤ 0.8 on every run), so one knob step
  cannot flip them.
- **Weaker** means one gear tier down: the same boards in `urLate5'`, `lrSet5'` and `lrBlank4'`.
- **Room for the accessories.** G4 is measured without accessories and **tuned to the low end, 6–10 wins of 24**.
  ACCESSORIES A-G2 runs the same 24 runs with R5 accessories and may reach 18, never 24.
- **Recorded, not gated:** Tempest and Crimson Moon at Normal, and Blossom at Nightmare (to the owner).
- **Where it starts.** r5 measured with `tools/bossCap.mjs` that a fully maxed 33-girl board in three UR pieces kills
  about 1/8–1/14 of the Wyrm's scheduled HP at 250 on the Nightmare runs it checked (`d6f092b7`); the modelled gain of
  five Blank LR pieces over three UR pieces is about ×4–13 a girl (§8.1 × §4.7). The band is within reach at the
  owner's numbers, and knob 2 may have to move either way.
- **Cost.** A knob step re-runs only the best board in `lrBlank5'` (24 runs). The full matrix (4 boards × 4 presets ×
  24 = 384 runs) runs once at the start and once before M3 ships: an overnight run split by seed across cores. The tool
  work is in M3's estimate (§14).

**Knobs, in order** (each lowers only a new number before it ships):
1. Set passive numbers and the set caps' battle ceilings: G1, G2, G5, G7, G8, G9.
2. **For G4**: the super-crit multiplier ×1.5 → ×1.25, then the Blank LR scale 5.0 → 4.4, then Crit DMG's doubling
   ×2 → ×1.5 (the owner's call). If the best board wins too rarely, the same knobs go the other way. Each step moves the
   best board's median K by at most 0.1. After M3 ships, a raise of an LR unit re-runs G4; if the best board then wins
   more than 18 of 24, the owner decides (the Wyrm's own HP is the one knob left that lowers nothing a player owns).
3. The Set LR scale 4.0 → 3.6, then the per-piece cap raises halved: G10, G11.
4. LR's second Collar Pin; the Tie Pin to 90 % of the top.
5. Last, the owner's call: the new slots at reduced numbers.

---------------------------------------------------------------------------------------------------

## 9. Save migration and old builds

### 9.1 Today's gear and saves

- Every stored piece keeps every field and value. Today's pieces have no `set`: **No set, for good** (Q15), and the base
  of Blank LR.
- `unit.gear` gains `hair: null, necklace: null`; loadout A = today's gear; Team 1 = today's formation.
- No `SAVE_VERSION` bump in the stored save (`save.js:720` would start an older build fresh); `types.js` untouched.

### 9.2 What an older build does, and the guards

| Thing | Older build (code) | Guard |
|---|---|---|
| A Hair Clip or Necklace piece | dropped whole (`save.js:271`), the load marked `lossy` with a backup (`:690-697`, `:722`) | whole-piece mirror (§9.5); **no legacy mark that pays is ever written for it** (§9.4) |
| `set` on a Charm / Ribbon / Shoes piece | dropped (`:288-302`) | `gst:<uid>` |
| `lr`, level 13–18 | `lr` dropped, level clamped to 12 (`:291`): the piece reads as UR +12 (understated, never corrupt) | `glr:<uid>` = LR kind × 100 + level + 1000 × ▲ per line (one digit a line, line 0 lowest); GA §8.3 step 4 gives back missing ▲ |
| The Nightglass ✦ | **never in `tuned`** (F5): its own line field `night` (0 / 1), so no build ever reads `tuned` above 3 | `gtx:<uid>` (1 bit per stat, `TUNE_BITS` order); a bit whose stat is gone pays its Needle back (§9.3) |
| Pin marks (`top`) | dropped; the best roll stays in `base` | `gtp:<uid>` (bit 0 main, bit 1 + `TUNE_BITS` index per sub): re-applied on load; a sub bit whose stat is gone pays its Collar Pin back (§9.3) |
| `unit.gear.hair/necklace`, `teams`, `presets` | dropped | `own:<id>:hair`, `own:<id>:necklace`; `tm:`, `gp:` (§7.5: present fields win) |
| New items (Set Boxes, `tie_pin`, `collar_pin`, `lens_nightglass`) | dropped, `lossy` | `inv:<id>` (`MIRRORED_ITEMS` + 17: 2 choose-boxes, 12 set boxes, 3 tools) |

### 9.3 Refunds that can never pay twice (F5, L8)

- **A piece is gone, and its marks say what it held.** `restoreGearMarks` (`src/systems/gearMarks.js`) gains "piece
  gone" rows for `glr:`, `gtx:` and `gtp:`, beside GA's `gur:` row (`gearMarks.js:148-164`): when one of them names a
  piece that is no longer in the save, pay **once**, straight into items with one notice: the **Lens**, half of what
  **+13 … +18 cost at LR prices**, **one Needle per Nightglass ✦** and **each pin**. Then drop the keys. (An older build
  that salvaged an LR piece paid only the UR part.)
- **Salvage refunds what was spent, level by level (L8).** `enhanceInvested` (`gear.js:537-542`) prices +11 and +12 at
  the UR tier and +13 … +18 at the LR tier; a box-born piece's levels below +10 follow its `gbl:` bits. A refund never
  passes what was spent.
- **Salvage pays back everything** (GA R11): the Legendary payout, the Seed, the Lens, every Needle (Nightglass ✦
  included) and every pin.
- **A pin or Nightglass ✦ whose line an older build rerolled (L19).** An older build reads a classic-slot LR piece as UR
  +12, and its Fortune Dice can reroll a pinned or Nightglass-stitched substat to another stat (it knows neither mark).
  On the next load, a `gtp:` sub bit or a `gtx:` bit whose stat is no longer on the piece pays back **its Collar Pin**
  or **its Needle**, once, and the bit is cleared, as GA's step 3 does for ✦ (`gearMarks.js:165-181`). A line that kept
  its stat gets its mark back (§9.2). The Tie Pin (bit 0) follows the main stat: after an older build's Prism Dice the
  new main takes its best roll, the pin's own rule (§6).

### 9.4 Old builds can never refund or clamp what they cannot see (F5)

- **No legacy mark that pays, for a new-slot piece.** `writeGearMarks` (`gearMarks.js:87-93`) and the Rainbow Gear Box
  (`gear.js:357`) never write `gur:`, `gtn:`, `gbx:`, `gcl:`, `gnx:` or `gnf:` for a Hair Clip or Necklace. Its UR, ✦,
  box, club and line state lives in `gph:` / `gps:` / `gpc:` (§9.5), which no older build reads. An older build that
  drops the piece finds no mark to "refund", and the new build rebuilds it.
- **`gbl:` is allowed on new-slot pieces (L19).** A box-born UR Hair Clip or Necklace keeps its paid-level bits in `gbl:`
  like any piece (`enhanceGear` writes them for every UR piece below +10, `gear.js:574-577`), so its salvage prices those
  levels at UR (`boxPaidBits`, `enhanceInvested`, `gear.js:526-542`); without them it would pay up to 13,000 coins
  short. `gbl:` is inert in an older build: it is read only through a `gbx:` key (`gearMarks.js:127-147`), which a
  new-slot piece never has.
- **Exports and transfer codes are closed to older builds.** From M0, `serializeProfile` (`save.js:768`) writes the
  export, and so the transfer-code payload (`store.exportSave`, `src/ui/online/settingsOnline.js:132`), with
  **`version: 3`** (`EXPORT_VERSION` in `save.js`, an export-format marker; a later stored-save bump moves it past).
  Every older build refuses it through its own check, "Newer save" (`deserializeProfile`, `save.js:797`), and already
  tells the player why: "That save code comes from a newer version of Sakura Sentinels — update the game to import it."
  (`src/ui/screens/settings.js:368-370`). So a transfer code can no longer carry new gear into an old build, on one
  device or two. The stored save is written by `store.js:68` (`JSON.stringify`, not `serializeProfile`) and keeps
  `version: 2`, so an open old tab on the same device still loads it (and finds no marks to refund, above). New builds
  accept versions 2 and 3; `migrateProfile` sets `version` back to 2 (`save.js:662`). There is no cloud save: an export
  code (Settings' "Export & copy", `settings.js:287`) or a transfer code is the only way a save moves between builds, and
  both go through `store.exportSave()` (`store.js:353-355`).
- **M0 knows LR and pins** (as GA's R1 knew UR): its salvage pays LR and pin refunds, its rerolls keep pinned lines and
  the Nightglass ✦, and its enhance prices +13 … +18 at the LR tier, so a save that has met an M3 build is safe in M0.

### 9.5 The whole-piece mirror (new-slot pieces)

For every Hair Clip and Necklace that is equipped, locked, levelled or Mythic and up (a spare +0 Super Rare piece is the
only kind left out; the `lossy` backup keeps it), `missions.counters` holds:
- `gph:<uid>` = slot (1 Hair Clip, 2 Necklace) + 10 × rarity order + 100 × level + 10,000 × set index + 1,000,000 ×
  main-stat index + 100,000,000 × flags (1 locked, 2 UR, 4 Set LR, 8 Blank LR, 16 main pinned, 32 box-born);
- `gpm:<uid>` = `round(main.base × 1e6)` (Legendary form);
- `gps:<uid>:<i>` (i = 0–3) = stat index × 1e10 + ▲ × 1e9 + pinned × 1e8 + ✦ bits (gold 1, rainbow 2, Nightglass 4) ×
  1e7 + `round(base × 1e6)`;
- `gpc:<uid>` = club index (its own key: never the legacy `gcl:`); the wearer rides `own:<id>:<slot>`; the name is
  rebuilt from the set, slot and rarity.

A present piece always wins over its mirror; salvage drops the keys; `migrateProfile(migrateProfile(x))` deep-equals
`migrateProfile(x)`. Size: 7 keys a piece, ≈ 45 KB at 200 pieces.

### 9.6 Reader first

**M0** teaches every reader the new shape, writes every mirror, versions the export (§9.4), and changes nothing a
player sees. M1 can follow at once; **M2 waits at least one week after M0** (two preferred, GA R17).

---------------------------------------------------------------------------------------------------

## 10. Sim, co-op and `COOP_PROTOCOL`

### 10.1 What changes the sim id

| Milestone | Hashed files | Sim id | `COOP_PROTOCOL` |
|---|---|---|---|
| M0 reader, M1 teams and loadouts, the pins, the Build Coach (C1) | none | unchanged | unchanged |
| **M2** five pieces and sets | `src/sim/setRules.js` (new); `constants.js` (`DEFAULT_UNIT_STATS` + `set`, `setN`, `setLr`, `buffDurMul`, `controlMul`, `abilHaste`, `critCeil`, `avgCrit`; `INCOME_INTEREST_SET_MAX` 5,000 and `CASH_MAX` 1e12, §3.2); `status.js` (`controlMul`, You're It); the **control call sites** of §2.4: `Sim.js`, `abilities.js`, `hero.js`, `barricades.js`, `vines.js`, `zones.js`, `lab.js`, `potential.js`, `duo.js`; `Sim.js` also `_gainCash` (`CASH_MAX`) and the interest ceiling (`:927`), `lab.js` the joiners' interest (`:247`); `combat.js` (You're It inside `damageTakenBonus`, average crit on DoT); `towers.js` (tricks, sure crits, average crit on traps, Confetti Burst's stripped spec); `buffs.js` (Buff Duration; `critCeil` at `:35-36`), `drinks.js` (Buff Duration); `mods.js` (splash cap; `critCeil` at `:803`); `gearRules.js` (super crits, ability haste ceiling); `enemies.js` (the `it` record); `statLimits.js` | changes | **one bump** |
| **M3** LR gear | `gearRules.js` (`PIERCE_K_MAX` 300; `SKILL_HASTE_CAP` stays 0.5, new `ULT_HASTE_MAX` 0.75, §4.3), `hero.js` (the ult ceiling split, §4.3), `setRules.js` (LR Set Forms), `Sim.js` (Bake Sale · Nightglass only on a paid upgrade), `statLimits.js` | changes | **one bump** (or M2's, shipping together) |
| Accessories A2 | ACCESSORIES.md §7 | changes | its own bump (or M3's) |

Protocol 13 today (`src/online/coop/version.js`); round 5 takes the next number. The coordinator assigns M2's and M3's
at assembly; until then the branch pins its sim id as a `PENDING_BUMP` (`tests/art/itemArtRuntime.test.js`), and
`version.js` gains one comment line per bump.

### 10.2 Unit-stat keys and clamp rows (`src/online/coop/statLimits.js:30-60`)

Honest maxima are modelled for L85, P6, 10 gates, ★5, an LR girl with UR Resonance and the best possible gear; the build
re-derives them with a ceilings script (GA's `spec/ceilings-spec.mjs` method), and the clamp-identity test holds them.
Every ceiling of §3.2 is applied at source, so no honest value passes its row (L14).

| Key | Today's row | Honest max (modelled) | New row | M |
|---|---|---|---|---|
| `damageMul` | 0–15 | ≈ 14.4 five UR; ≈ 20.7 five Set LR; ≈ 25 five Blank LR | **0–40** | M2 / M3 |
| `rateMul` | 0–5 | ≈ 4.2 / 6.2 / 7.5 | **0–12** | M2 / M3 |
| `critChance` | 0–0.75 | 2.0: the battle ceiling, now her cap at source (§3.2); only a `critCeil: 2` girl passes 1.0 in the sim | **0–2** | M2 |
| `critCeil` (new) | — | 2 with five Geometry or five Blank LR pieces, else 1 (§4.5) | **int 1–2** | M2 |
| `avgCrit` (new) | — | 0 or 1 (§8.3 lever 1; `progression.js` decides) | **int 0–1** | M2 |
| `critMul` | 1–6 | ≈ 5 (Blank LR's +400 %); Geometry's set cap ≈ 9 | **1–12** | M2 |
| `costMul` | 0.75–1 | 0.5 (Blank LR) | **0.5–1** | M3 |
| `ultHaste` | 0–0.5 | 1.0 (Blank LR's doubled cap; ults read ≤ 0.75); Power Bank never lifts it | **0–1** | M3 |
| `abilHaste` (new) | — | 0.75: the ⚡ ability's share, half of her Skill Haste (capped as `ultHaste`, or her whole Skill Haste with Power Bank's set cap), sent so a hero's ult never gets the uncapped value | **0–0.75** | M2 |
| `armorPen` | 0–50 | 80 (Blank LR cap) | **0–100** | M2 / M3 |
| `pierceK` | 0–200 | 300 for shots; 500 for a Party Popper 5-piece's blasts | **0–600** | M2 / M3 |
| `auraPct` | 0–0.75 | ≈ 4 (Spirit Squad's set cap) | **0–5** | M2 |
| `auraRangeMul` | 1–1.2 | ≈ 1.68 (60 % + fill) | **1–2** | M2 / M3 |
| `buffDurMul` (new) | — | 1.8 | **1–2.5** | M2 |
| `controlMul` (new) | — | ≈ 2.5 (Freeze Tag's set cap) | **1–4** | M2 |
| `set` (new) | — | one of `SIM_SET_IDS` or null | enum | M2 |
| `setN` (new) | — | 5 | int 0–5 | M2 |
| `setLr` (new) | — | — | bool | M3 (M2 sends false) |
| `rainbow` (L1) | 0–3 | 3: `unitBattleStats` sends `min(3, ur)` (`progression.js:505`; Resonance stops at 3, `gear.js:817`), and the renderer shows the 3-piece sparkles for 3–5 UR or LR pieces | unchanged | M2 |
| `clubN` | 0–3 | 3 (`min(3, n)` at source) | unchanged | — |
| `rangeMul`, `dotMul` | 0–3, 1–1.5 | 2.0, 3.0 | **0–3**, **1–4** | M2 / M3 |

Non-finite → the `DEFAULT_UNIT_STATS` value; "every `DEFAULT_UNIT_STATS` key has a rule" covers the new keys.

### 10.3 Determinism

Integer counters and timers (`cheerT`, `angleN`, `burstN`, the enemy's `it.left` in steps) and an integer budget
(`burstBudget`); the new multipliers rounded to 4 decimals like every unit stat; no new `sim.rng` draw (sure crits and
super crits reuse each hit's one crit draw; the average crit is arithmetic; Confetti Burst carries no status, so it never
reaches `applyStatus`'s chance draw, L17); maps and records built in placement order. Set and club rolls, boxes and pins
happen outside any battle.

**Maths ceilings (L16).** Every uncapped stat has a ceiling at source and in the sim (§3.2), and cash has `CASH_MAX`, so
no number in an endless run reaches Infinity or NaN and cash stays an exact integer. The run is lockstep either way;
the ceilings keep it playable, and a battle save never writes a null.

### 10.4 Battle saves and engines

`KNOWN_TOWER_KEYS` (`src/ui/battle/snapshot.js`): `cheerT`, `angleN`, `burstN` (snap), `cheer` (derived);
`KNOWN_SIM_KEYS`: `burstBudget` (snap); the enemy's `it` (snap). One split-run case each. Pin a **`SET_START`** scripted
battle (every passive, set cap, super crits and LR form) in `e2e/engines/scriptedBattle.js`, equal on V8 and
JavaScriptCore.

---------------------------------------------------------------------------------------------------

## 11. Screens and the profile card

### 11.1 Screens (844 × 390 first, then 1280 × 720; rows ≥ 36 px; the Ink & Paper kit)

| Screen (file) | What changes |
|---|---|
| **Girl page → Gear tab** (`src/ui/girlGear.js`; "the Equipment tab" in its comments) | Five slot cards (one row at 1280; 3 + 2 at 844 × 390) and the accessory card apart (ACCESSORIES.md); the set strip (crest, "Spirit Squad ●●●●○", the 2 / 4 / 5 lines and the set cap, idle grey per `setIdle`); the club strip (up to two clubs); **Loadout A · B · C**; totals with the new stats and MAX tags that show LR raises or "no cap (set)"; slot actions **Pin** and **Limit Break** (Set LR or Blank LR) beside Enhance, Awaken, Stitch, rerolls, Club, Lock |
| Girl page Compact / Detailed (`src/ui/girlDetail.js`) | "Set bonuses" and "Club bonuses" (today's club lines, renamed) |
| **Backpack** (`src/ui/screens/backpack.js`), gear filter (`src/ui/gearFilterBar.js`, `src/systems/gearFilter.js`) | Slot chips × 5, set chips, "Set LR", "Blank LR", "Has pin"; Set Box opening (set picker, five main picks, "Fill for a girl"); Use on pins and the Lens; multi-salvage skips pieces in a loadout (§7.5) |
| Gear card (`src/ui/gearTile.js`, `src/ui/gearView.js`) | set crest corner, pin glyphs, the two Nightglass tiles and "LR" tag |
| UR and LR modals (`src/ui/gearUr.js`) | **Limit Break** modal (Set LR / Blank LR, before → after, Power, cost; giving a set up says so), a "Limit Broken!" moment; the Pin modal |
| **Formation** (`src/ui/screens/formation.js`) | Team chips 1–5 above the Squad card; a loadout letter on each squad tile when not A |
| **Stage Prep** (`src/ui/screens/stage.js`) | team chips in the Counters sheet's formation section; a "Team 2" chip beside Start (no scroll at 844 × 390) |
| Co-op room (`src/ui/screens/coop.js`) | "You bring Team 2" with the chip until Ready |
| **Titan Trials** (`src/ui/screens/titans.js`) | each titan card shows its set; the Titan shelf rows |
| Bounty and Total Assault cards | "Drops: Treasurer set" / "Power Bank set" |
| Battle panel and drawer (`src/ui/battle/towerPanel.js`, `drawerView.js`) | a set pip (Nightglass for a form); a ring toward Right Angle / Confetti Burst; the `cheer` buff icon; a You're It mark on enemies; "Crit 112 % · super 12 %"; super-crit numbers |
| Unit Sheet, profile Build tab (`src/ui/unitSheet.js`, `src/ui/unitBuild.js`) | five pieces, the set chip |
| Wiki (`src/data/wiki.js`) | "Gear & Rerolls" and a "Gear sets" article (sets, set caps, Blank LR, super crits, pins) |
| Patch notes | one per milestone |

### 11.2 The profile card and Friend Support (F4)

- **The live rule is `valid_card_unit`** (`supabase/migrations/20261028000000_friend_support.sql:130-160`): at most 4
  gear entries (`:144`), gear keys `s, r, l, m, x, c` only, and unit keys `id, lv, bt, aw, p, sk, g`. Both
  `valid_profile_card` (`:166`) and `set_support` (`:276-286`, 2,048 bytes, "that Support Student is not valid") call it.
  The substat rule `profile_stat_ok` (`20261020000000_profile_gear.sql:17-26`) allows ✦ 0–3.
- **One SQL file, pasted once by the owner, with no keys** (`supabase/migrations/<date>_gear_update_card.sql`), before
  `CARD_FIVE_PIECES` turns on. It replaces two functions, so `valid_profile_card` and `set_support` follow:
  - `valid_card_unit`: gear entries ≤ **5**; piece key **`t`** (set index 0–15); unit key **`ac`**, defined once (L21):
    two integers `[i, n]`, `i` the accessory kind's index in the append-only `ACC_IDS` (0–255) and `n` 1–5 (a standard
    accessory's grade 1–3, a personal accessory's R 1–5; ACCESSORIES.md §8); accepted now so the accessories need no
    second paste;
  - `profile_stat_ok`: the ✦ element 0–**7** (bit 4 = the Nightglass ✦; on the card only, never in the save's `tuned`).
  The rarity regex already accepts `r: 'lr'`, levels already allow 0–99 and ▲ 0–9.
- **The LR marker**: `r: 'lr'`; with `t` it is Set LR, without `t` Blank LR. Viewers (`cleanViewedCard`) clamp an LR line
  to `lineCeiling(stat, { lr: 'set' | 'blank' })`.
- **Client mirrors and tests**: `src/online/profileRules.js` (the card rules), `src/online/supportRules.js:47-49`
  (`validCardUnit`, 2,048 bytes), `tests/online/supportSchema.test.js` (it runs fixed cards through both rule sets),
  `src/online/profileCard.js` (`cardGear` `:53-66` writes five pieces, `t`, `r: 'lr'` and the ✦ bit 4; the reader
  `:244-262` knows five slots). Five pieces make a Support Student about 1.1 KB, under 2,048.
- **The card budget (L21), measured.** The server's 8,192-byte cap counts jsonb text, which adds a space after every `:`
  and `,` (`src/online/profileRules.js:18-21`). The late-save fixture's card (`tests/systems/profileFixtures.js`, 8
  units) measures **4,307 bytes** as `JSON.stringify` and **4,938** as jsonb text today (+14.7 %, more than the comment's
  13 %), and **6,923 / 7,957** with five pieces and set keys (measured by duplicating two pieces a girl). A
  `JSON.stringify` budget cannot hold that line (7,200 × 1.149 ≈ 8,270), so `validCard` measures the jsonb length
  itself (`JSON.stringify` plus one byte per `:` and `,` outside strings) against **8,000** (`CARD_TEXT_BUDGET`, a
  192-byte margin), in place of `CARD_JSON_BUDGET`. A card that would pass it drops the substats (`x`) of showcase units
  from the last one back until it fits; the viewer shows those pieces without their lines. A test builds the heaviest
  fixed card (eight LR girls, five LR pieces each, every ✦, pins and `ac`) and checks it.
- **What a borrowed girl brings** (`src/systems/friendSupport.js:94-118` rebuilds her through the card): her five
  pieces' values (clamped to their ceilings), her set's 2 / 4 / 5 bonuses and set cap, and her clubs. **A Geometry girl
  with five pieces keeps `critCeil: 2` and her super crits** (L15): they come from the set cap, which needs no LR piece.
  **The LR-only extras stay home**, the same rule as "never the LR form" for LR girls (`friendSupport.js:91`,
  `clampSupportUnit` `:94`): no LR Set Form, no Blank LR doubled caps (so a Blank LR girl lends with `critCeil: 1` and no
  super crits), no personal accessory.
- Until the paste, `CARD_FIVE_PIECES` is false: cards and Support Students carry the three classic pieces, as today.

---------------------------------------------------------------------------------------------------

## 12. Code plan

| File (hashed?) | Change | M |
|---|---|---|
| `src/data/gearSlots.js` (new, no) | slots, names, main pools, `ROLL_SLOTS`, `SET_ONLY_SLOTS` | M0 |
| `src/data/gearSets.js` (new, no) | `SET_IDS` (append-only), the set table (pieces, colours, sources, bonuses, set caps, LR forms, texts) | M0 (ids), M2 |
| `src/data/gearStats.js` (no) | the three stats, `NEW_STAT_SLOT` lists, caps (Aura Power 25 %, Aura Radius 30 %, Control 50 %, Armor Pierce 40), **`AURA_FILL_FROM 0.15`**, `LR_CAP_STEP`, the blank doubling, fill limit and DoT share by pieces, `GEAR_FIT` rows, `setIdle` | M0 (defs), M2, M3 |
| `src/data/gearAwaken.js` (no) | `TUNE_BITS` + 3, `LR_SCALE 4.0`, `BLANK_SCALE 5.0`, `LR_MAX_LEVEL 18`, `LIMIT_BREAK_COINS`, the LR suffix, `MARK` prefixes (`gst:`, `glr:`, `gtx:`, `gtp:`, `gph:`, `gpm:`, `gps:`, `gpc:`, `tm:`, `gp:`, `su:welcome`, `su:titanbox:`), `MIRRORED_ITEMS` + 17 | M0 |
| `src/data/items.js` (no) | 2 choose-boxes, 12 set boxes (`gearbox`, `pickSet`), `tie_pin`, `collar_pin` (`dice`), `lens_nightglass` | M0 (no sources), M2, M3 |
| `src/systems/gear.js` (no) | five slots; set pieces; `gearSetInfo` + `clubStats`, `setStats`; LR reads (`isLrGear`, `lrKind`, `lrMul`, `blankMul`); `maxGearLevel` 18; `gearTier` 6; `limitBreakGear(…, { kind })`; the Nightglass ✦ field; pins; `enhanceInvested` by tier paid; salvage refunds; `openSetBox` | M0 (reads, refunds), M2, M3 |
| `src/systems/gearMarks.js` (no) | §9 mirrors, "piece gone" and "stat gone" rows, no paying legacy marks on new-slot pieces (`gbl:` allowed), the §5.3 box check (M2) | M0, M2 |
| `src/systems/save.js`, `rosterSave.js` (no) | readers, five slots, teams, presets; `serializeProfile` writes `version: 3`, `deserializeProfile` accepts ≤ 3 | M0 |
| `src/systems/teams.js` (new, no) | teams and loadouts | M1 |
| `src/systems/progression.js` (no) | caps with LR and set caps, each set cap's ceiling applied at source (§3.2); DoT share and fill limit by pieces; lever 1's choice (`avgCrit`); `critCeil`; `rainbow: min(3, ur)`; new keys out | M2, M3 |
| `src/systems/titanRewards.js`, `titans.js`, `rewards.js`, `src/data/shop.js`, `src/data/missions.js`, `src/online/coop/rewards.js` (no) | set sources, daily cap, shelves, Nightglass Hunt, milestones; the §5.3 box check after each campaign and Titan Trials result | M2, M3 |
| `src/sim/setRules.js` (new, **hashed**) and the files of §10.1 (**hashed**) | §2.4, §3.2 ceilings, §3.4, §4.5, §8.3 levers 1–2 | M2, M3 |
| `src/online/coop/statLimits.js` (**hashed**) | §10.2 rows | M2, M3 |
| `src/online/profileCard.js`, `profileRules.js` (`CARD_TEXT_BUDGET`), `supportRules.js`, `src/systems/friendSupport.js` + one SQL file | §11.2 | M2 (SQL any time before) |
| UI files of §11 | screens | M1, M2, M3 |
| `tools/balance/maxedProfile.mjs`, `r5Bench.mjs` (r5), `tools/potentialProfiles.mjs` | the presets `maxed5'` … `lrBlank5'` from five real pieces, one table for the bench and the boards (`--gear`) | M2, M3 |
| `tools/capBot.mjs`, `tools/bossCap.mjs` (r5) | boards **W** and **LR** (§8.4); the Wyrm at 250 in `bossCap` | M3 (W in M2 for G1's boards) |
| `tools/wyrmGate.mjs` (new) | G4's matrix: boards × presets × 2 stages × 12 seeds; wins, margins, K; the pass line; `--acc r5` for ACCESSORIES A-G2 | M3 |
| `tools/gearGuard.mjs` | `--build` through capBot's boards, so its old rule (UR gear never beats the Wyrm) covers every board | M2 |
| `CONTRACTS.md`, `docs/ECONOMY.md`, `docs/FREEPLAY.md`, GS / GA (a pointer here) | docs | M0–M3 |

**Never touched:** `src/data/types.js`, `src/data/stages.js`, `src/online/coop/loadout.js`.

---------------------------------------------------------------------------------------------------

## 13. Tests

| File | Cases |
|---|---|
| `tests/systems/gearSlots.test.js` (new) | `rollGear` with no slot draws today's sequence; new mains only on new slots; support stats never subs; the slot-reader grep |
| `tests/systems/gearSets.test.js` (new) | 2 / 4 / 5, mixing, one passive; clubs across five with `gearSetInfo`'s shape kept (`clubs` object, `club` the largest, `clubN` ≤ 3); SR+; membership survives awaken and pins and leaves only by Blank LR; set caps per set and their idle rule; `SET_IDS` = `SIM_SET_IDS`; set colours ΔE |
| `tests/systems/gearSources.test.js` (new) | each titan's chest gives its own set; Normal's Rare box stays No set and its SR box gives a set piece; post-roll rates and the daily cap; other rng sequences unchanged; the Rainbow Gear Box asks slot and set |
| `tests/systems/setBox.test.js` (new) | five pieces of the picked set (any of six) at +0, chosen mains, rolled subs; bag room; never UR/LR; never for gems; the welcome box and each titan box once, whichever trigger comes first (an M2 first load, a 3-5 clear, a Nightmare first clear, in any order) |
| `tests/systems/pins.test.js` (new) | Tie / Collar Pin values at every rarity and level; limits; rerolls and Prism; salvage refunds |
| `tests/systems/lrGear.test.js` (new) | Limit Break into Set LR and Blank LR (a set piece gives its set up); ×`lrMul` / ×`blankMul`; +18 prices; 6 ▲; the Nightglass ✦ field; per-piece raises; five Blank LR double every cap; LR Set Form only with five LR of one set; refunds by tier paid |
| `tests/systems/teams.test.js` (new) | migration; switching; conflicts and undo; present fields win after an old build; multi-salvage skips loadout pieces |
| `tests/systems/save.test.js` (extend) | round trips with every new field; vendored old `cleanGear` / `cleanUnit` / `restoreGearMarks`: **an old build that drops new-slot pieces pays no refund** (no legacy marks), **never reads `tuned` above 3**, and an old salvage of an LR or pinned piece is completed once by the "piece gone" rows; a pinned or Nightglass line rerolled to another stat by a vendored old Fortune Dice pays its Collar Pin or Needle once; a box-born UR Hair Clip's `gbl:` bits price its salvage at UR; `serializeProfile` writes version 3 and a vendored old `deserializeProfile` throws "Newer save"; idempotence; hostile counters |
| `tests/systems/neverWeaker.test.js` (build it, GS §I) | G3 under M2 and M3 rules: the Aura Power cap move, the average crit (`avgCrit` picks the larger; never both), the fill limit and DoT share by pieces, the ceilings at source |
| `tests/sim/setSim.test.js` (new) | each passive, set cap and LR form; You're It with two controllers (the record follows whoever's control lands, the stronger bonus wins) and on burn and poison ticks (`computeDot`); Control Strength at every call site before `CC_RESIST` and `ccLeft`; Buff Duration per kind (brews unchanged, drinks `floor`); super crits and the average crit; `critCeil` at both clamp sites (a crit girl whose kit and aura pass 1 stays at 100 % without five Geometry or Blank LR pieces); Confetti Burst on a girl with a chance status draws nothing; each set cap at its ceiling; no rng draw added |
| `tests/sim/cashCeiling.test.js` (new) | 2,000 wave clears of a Treasurer board at the interest ceiling: cash finite, an exact integer, ≤ `CASH_MAX`; `_cashCarry` never NaN; a battle save writes a number |
| `tests/online/coopStatLimits.test.js`, `tests/online/supportSchema.test.js`, `tests/online/profileCard.test.js` (extend) | §10.2 rows and clamp identity; five-piece cards, `t`, `r: 'lr'`, ✦ 0–7, `ac` as two integers, the 2,048-byte unit, accepted by the new SQL rules and refused by the old; the heaviest fixed card's jsonb length ≤ 8,000 |
| `tests/sim/snapshot.test.js`, `tests/online/engines.test.js`, `tests/sim/perf.freeplay.test.js` | §10.4 split runs (`it` included); `SET_START` in every engine; G12 |
| `e2e/gear-sets.mjs` (new; 844 × 390 and 1280 × 720) | five slot cards and the accessory card fit; set and club strips; Set Box flow; Pin; Limit Break both kinds; loadouts; teams on Formation, Stage Prep and the co-op room |

---------------------------------------------------------------------------------------------------

## 14. Milestones, each shipping on its own (board Q14, answered "default")

**Order (F8):** balance round 5 with its LR rows → M2 → M3. No gear gate runs before the LR rows land (§8.4).

| M | Contents | Sim / co-op | Gates | Effort |
|---|---|---|---|---|
| r5 + the LR floor (on `feature/balance-r5`; round 5's work, not this spec's) | round 5's rows and its LR rows (`LR_POWER`) | its own bump | **G0** on r5's bench (r5 reads "every LR axis ≥ 2.5×" at `d6f092b7`); round 5's own gates | round 5's |
| **M0 Reader** | every reader, mirror and refund row of §9; the versioned export; LR- and pin-aware salvage, reroll and enhance; the new item ids with no sources | unchanged | save tests; full vitest; smoke; `simId()` unchanged | 4–5 days |
| **M1 Teams and loadouts** | §7 | unchanged | teams tests; e2e Formation / Stage Prep / co-op | 3–4 days |
| **M2 Five pieces and sets** | the two slots, six sets, passives and set caps, super crits, support stats in battle (the 24 call sites), the F1 levers and the **raise-only pass over r5's rows**, clubs across five, sources, Set Boxes and the welcome and veteran boxes (one mark per box, §5.3), the maths ceilings (§3.2), the Rainbow Gear Box over five slots, pins, the set icons from `feature/gear-icons`, the card (after the owner's SQL paste) | **bump** | **G0 first**, then §8.4 G1–G13 with `maxed5'` / `late5'` / `urLate5'`; ≥ 1 week after M0; after round 5 and its LR rows | **3–4 weeks** |
| **M3 LR gear** | Limit Break (Set and Blank), the Lens, +18, the numbers, the third ✦ and second Collar Pin, cap raises and the Blank doubling, LR Set Forms, a second raise-only pass if G1 needs it | **bump** (or M2's) | **Deferred** (Oct 30, M3 review r2): G0, G1, G4, G5, G7 and G10–G12 run after M3's code review, on `feature/gear-g4` (M2 + M3 with round 5 merged; its tools: the five-piece presets, capBot's W and LR boards, `tools/wyrmGate.mjs`, gearGuard `--build`). Then: **G0 first**, then G1, G4 (the Wyrm band: 24 runs a preset), G5, G7, G10–G12 with `lrSet5'` / `lrBlank4'` / `lrBlank5'`; G1 and G4 measure the haste step at 0.50 → 0.51 (§4.3); G4 tuning waits for the owner's F10 answer | **2–2.5 weeks** (G4's tools, 3–4 days: capBot's W and LR boards, the presets, `wyrmGate.mjs`; 24 runs a knob step and two overnight full passes) |
| Accessories A0–A2, Build Coach C1 | ACCESSORIES.md §11, BUILD_COACH.md §9 | A2 bumps; C1 none | in their specs | in their specs |

Patch-note lines: M1 "Save up to 5 teams and up to 3 gear loadouts per girl"; M2 "Two new pieces: the Hair Clip and the
Necklace. Six five-piece gear sets with their own looks; a full set lifts its special stat's limit. New: Set Boxes and
pins"; M3 "LR gear: Limit Break your rainbow gear into Nightglass LR. Keep its set, or go blank for bigger numbers and
doubled limits".

---------------------------------------------------------------------------------------------------

## 15. Risks

| Risk | Guard |
|---|---|
| Five pieces, set caps and Blank LR multiply crit carries far more than other kits | the §8.3 levers, the raise-only pass, G1 |
| Blank LR at the owner's numbers is huge (≈ ×5.7 over UR) | G4's Wyrm band and knob 2, tuned before any player owns it |
| Uncapped stats (crit, ability haste, aura, control, money, splash) | a ceiling for every one, applied at source and in the sim, and `CASH_MAX` (§3.2); G7, G9, G12; the clamp rows; the 2,000-wave cash test |
| The LR units are lifted after gear is tuned, and the Wyrm band breaks with no knob left | the order of §8.4: round 5's LR rows first, G0 before any gear gate; a later LR raise re-runs G0 and G4 |
| G4 rests on a few lucky seeds | 24 runs a preset, the kill ratio as the steer, a margin on every run, weaker presets missing clearly (§8.4) |
| Sets + clubs + pins + LR + accessories are a lot for a child | one rule line per layer, idle greys, "Fill for a girl", the Build Coach |
| You're It is a team boost on bosses | half on bosses, G8 |
| Old builds and transfer codes | §9.4: no paying legacy marks on new-slot pieces, a versioned export, "piece gone" and "stat gone" refunds |
| Loadout switches move pieces | the list before, Undo after |
| Every number here is modelled | the measured gates of §8.4 decide |

## 16. Owner questions

`docs/review/gear-update/OWNER_BOARD.md`: Q0–Q14 answered (Q6 changed); Q19 decided by the owner (LR floors, no nerfs);
Q15–Q18 open.
