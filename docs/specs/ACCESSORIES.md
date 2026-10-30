# Accessories: the sixth slot, standard accessories and LR personal accessories (build spec)

Sakura Sentinels, 2026-10-30, revision 2. Spec only. Companion to `docs/specs/GEAR_UPDATE.md` (cited as GU); the owner
questions are on `docs/review/gear-update/OWNER_BOARD.md` (Q17, and Q19 for the LR floor). The fixes for review r2 (F8,
F9, L17, L21–L24) are listed in GU's "Changes since r2" table.

**Owner request (Oct 30, verbatim):** "LRs are premium units and will have an accessory gacha.. you can equip standard
accessories on any girl but these unit specific ones are super strong and unlock passives traits or new gameplay
mechanics".

**Reading.** A sixth equipment slot, the **Accessory**, outside the five-piece sets. **Standard accessories** fit any
girl and come from normal play. Each LR unit has one **personal accessory** of her own (the "unit specific" ones), only
from an **Accessory Banner** (gems, rate-up, pity), raised from R1 to R5 by duplicates; R1 unlocks a passive, trait or
new mechanic for her. Proposed here: one for Kohaku & Tsubaki and one for Tenka; every later LR (the owner's
fox-and-hawk duo, for example) launches with its own.

**Sources.** `file:line` is `origin/main` at `60ce9cad` (v0.1.61, `COOP_PROTOCOL` 13). Number labels as in GU. No other
game is named here; players are "they".

---------------------------------------------------------------------------------------------------

## 0. On one page

1. **The Accessory slot**: one per girl, any girl, beside her five gear pieces, saved in a field of its own
   (`unit.accItem`), never in `unit.gear` or a loadout (L22). It belongs to no set and no club, and takes no ✦, pins or
   Limit Break.
2. **Standard accessories**: six kinds (Wrist Tape, Smartwatch, Headphones, Sun Visor, Pocket Notebook, Pocket
   Speaker), one stat each, at three grades (Rare, Mythic, Legendary). From normal play; three of a grade fuse into one
   of the next in the Craft Room. A Legendary one is worth about one average Legendary substat line.
3. **Personal accessories**: one per LR unit, only from her Accessory Banner. Copies raise it **R1 → R5**. R1 unlocks a
   new mechanic; R2–R5 strengthen it.
   - **Kohaku & Tsubaki: the Walkie-Talkie Pair.** R1 **Target Call**: every 8 s Kohaku's beam calls the strongest
     enemy in her reach; Tsubaki's shells aimed at a called enemy land at once and split into prism shards whatever her
     split count says.
   - **Tenka: the Lab Goggles.** R1 **Charged Rail**: once a second her next coil bolt also lays a charged rail along
     its line for 2 s (at most 3 live rails); each enemy a rail touches takes, once, 15 % of a second of her coil
     damage.
4. **The Accessory Banner**: 120 gems a pull, the featured personal accessory at 1 % (rate-up), **a guaranteed one by
   the 80th pull**, no spark; the rest of the pool is standard accessories. Rates and pity are shown on the banner.
   R1 takes about 55 pulls on average (≈ 6,600 gems; at most 80), R5 about 276 (≈ 33,000 gems; at most 400 =
   **48,000 gems**) (§4).
5. **Balance**: on top of the **LR floor** (the owner's decision, board Q19: each LR unit at least about 2.5–3× the best
   Kage T5 on both a boss and a crowd; set by balance round 5's LR rows and gated by GU §8.4 G0), her accessory adds
   R1 +15–20 % of her own output, R5 +40–50 %. GU's G4 is tuned without accessories to the low end of its band (6–10
   wins of 24 runs); with R5 accessories the best full blank-LR board may win up to 18 of 24, never every run (A-G2).
6. **Co-op**: standard accessories are numbers only (no sim change). Personal accessories are new sim rules: one
   `COOP_PROTOCOL` bump with their release (A2), or GU M3's.
7. **Milestones**: A0 reader (with GU M0) → A1 standard accessories (normal update) → A2 personal accessories and the
   banner (a co-op update), which waits for the owner's answer to Q17 and for GU M3's G4.

---------------------------------------------------------------------------------------------------

## 1. The slot

- A sixth slot, **Accessory**, shown on her Gear tab as a round card apart from the five gear cards. One per girl.
- **Outside the sets**: it never counts toward a set (GU §3) or a club (GS §C), takes no ✦ stitch, no Tie or Collar
  Pin, no awakening and no Limit Break. It has no random rolls.
- **Not a gear slot in code (L22).** The accessory never enters `SLOT_IDS`, `unit.gear` or the loadouts: GU §7.4 keeps
  `unit.gear` equal to the active loadout, and every `unit.gear` value is a piece uid that code reads as one
  (`src/ui/screens/student.js:1106`). It is saved in a field of its own, **`unit.accItem`** (an item id or null), and
  **a loadout or team switch never changes it**: the accessory belongs to the girl.
- **Code names.** Players see "Accessory". Identifiers avoid the look field `accessory` (`accessory: 'horns'`,
  `'catEars'`, `'hairpin'` in `src/data/unitsExpansion.js:46`, `:101`, `:220`; `tools/blender/lib/accessory.py`) and the
  bare `acc`, which already names the sim's step accumulator (`this._acc`, `src/sim/Sim.js:193`) and the achievement
  rows' styles (`.acc-*`, `src/ui/styles/achievements.css:70-74`). So: the save field `accItem`, the kind list
  `ACC_IDS` (`src/data/accessories.js`, append-only), the unit-stat keys **`accId`** and **`accR`**, the card key `ac`,
  the mirror `acw:`, the CSS prefix **`.acs-`**, and item ids starting `acc_` (no item id uses it today).

## 2. Standard accessories

| Kind (id) | Stat | Rare | Mythic | Legendary | Look (school with a tech touch) |
|---|---|---:|---:|---:|---|
| Wrist Tape (`acc_tape`) | ATK | 6 % | 10 % | 15 % | sports wrist tape with a printed grip pattern |
| Smartwatch (`acc_watch`) | Attack Speed | 5 % | 8 % | 12 % | a slim watch with a step-counter face |
| Headphones (`acc_phones`) | Range | 4 % | 6 % | 9 % | over-ear headphones, one cup with an LED ring |
| Sun Visor (`acc_visor`) | Crit Rate | 4 % | 6 % | 9 % | a sports visor with a clear tinted brim |
| Pocket Notebook (`acc_notes`) | Skill Haste | 6 % | 10 % | 15 % | a small ring-bound notebook with a stylus clip |
| Pocket Speaker (`acc_speaker`) | Aura Power | 3 % | 5 % | 8 % | a palm-sized speaker on a wrist strap |

- Values add to her gear totals under the same caps and Every Line Counts (GS §B). A Legendary Wrist Tape (15 % ATK) is
  about one average Legendary +10 ATK substat (17.3 %), so a standard accessory adds about a sixteenth of a five-piece
  set: ×1.03–1.06 her damage (modelled).
- **Grades**: three of one kind and grade fuse into one of the next grade in the Craft Room (`src/systems/craft.js`;
  coins 10,000 / 40,000), weekly-capped like its top steps.
- **Sources** (never for gems outside the Accessory Banner): Bounty Exchange (a Rare, 2 a week, 15 Bounty Tokens);
  Titan shelf (a Mythic, 1 a week, 80 Assault Tokens); a weekly commission "Accessorize" (a Rare); each limited event
  (a Legendary); achievements; the Accessory Banner's pool.

## 3. Personal accessories (LR units)

**Rules.**
- One per LR unit, equipped only on her. It works at every rank she has (SSR, UR, LR); the balance is measured at LR.
- Only from her **Accessory Banner** (§4). The first copy is **R1**; each further copy raises it one step, to **R5** at
  five copies. Copies past R5 become **Accessory Tokens** (§4), so none is wasted.
- **R1 unlocks the mechanic**; R2–R5 strengthen it. A tap on her accessory card shows every step.
- Never lent through Friend Support (GU §11.2: the LR-only extras stay home); travels in co-op with her owner's stats.

### 3.1 Kohaku & Tsubaki: the **Walkie-Talkie Pair**

A matching pair of compact radios, Tsubaki's navy cadet one and Kohaku's lilac council one, each with a tiny star
antenna light. (Her kit, `src/data/unitsDuo.js` and `src/sim/duo.js`: Tsubaki's aimed star shells land after a 1 s
delay (`MORTAR_DELAY`) anywhere on the ground; Kohaku's prism beam guards the sky; and **every `every`th shell splits**
(base 4; Cut Facets 3, Refraction 2, Constellation Lattice 1), counted by `t.prismN` (`duo.js:21-24`): that shell lands
as usual and its shards land around it at the fixed table `PRISM_SHARDS`, with no rng (L23).)

| R | Target Call |
|---|---|
| **R1** | Every 8 s, Kohaku's beam **calls** the strongest enemy in her reach (highest HP, ties by lower uid) for 3 s. Tsubaki's shells aimed at a called enemy **land at once** (they skip the `MORTAR_DELAY` queue, `src/sim/towers.js:1306-1340`) and **split whatever the count**: a forced split leaves `prismN` as it is, so her regular splits keep their rhythm. A forced split's shards take her **average crit** (GU §8.3 lever 1) in place of a crit draw (`shardSpec` copies the shell's crit chance, `duo.js:284-295`), so Target Call adds no draw (L17). |
| R2 | Called enemies take +8 % damage from her |
| R3 | A call every 6 s |
| R4 | +16 % |
| R5 | Two calls at once (the two strongest) |

It answers the duo's written weakness ("1 s delay; fast foes escape"): her shells catch the enemy she calls.

### 3.2 Tenka: the **Lab Goggles**

Smart lab goggles with a heads-up display and a lens rim shaped like her LR crest, the orbit ring
(`src/systems/limitBreak.js`, `LR_TRIALS.tenka`).

| R | Charged Rail |
|---|---|
| **R1** | **Once a second** (a fixed step count), her next coil bolt also lays a **charged rail** along its line, from her to the end of her reach, for 2 s. Each enemy a rail touches takes **15 % of a second of her coil damage** (her bolt damage × her bolts a second, worked out from her stats), **once per rail**. Rails never crit and make no draw. |
| R2 | 20 % |
| R3 | Rails last 3 s |
| R4 | 25 %, and a rail slows 15 % for 1 s (a control status with no `chance`, so no draw; Control Strength and You're It apply, GU §2.4) |
| R5 | Rails also hit flyers |

**Bounds (L23).**
- **One rail a second, whatever her speed.** At base she fires 8 hitscan bolts a second (`src/data/units.js:1365-1366`),
  and Rapid Cycle, Zero Point, the awakening passive, gear speed and Twin Rails' second target multiply that: one rail a
  bolt would mean dozens to hundreds of live rails per Tenka.
- **Live rails:** at most **3 per Tenka** and **24 in the battle**; a new rail replaces that Tenka's oldest (at the
  battle cap, the battle's oldest).
- **Crossing tests:** each step, each live rail tests only the enemies inside its bounding box; a rail keeps the uids it
  has hit (at most 12 enemies a rail).
- **Battle-wide budget** `railBudget` (an integer on the sim, like Finale Pop's `popBudget`): **+1 a step, at most 30
  banked, 1 a rail hit**, so rails hit at most 60 enemies a second across the whole battle, with any number of Tenkas.
- **Size:** a second of her coil damage is about a second of her single-target output, so R1 adds about +15 % against
  one target and more against a crowd that walks into a rail; A-G1 measures it.

### 3.3 Later LR units

Each LR launches with its own personal accessory, designed with her kit (the owner's fox-and-hawk duo, for example).
A new one is a new sim rule (§7) and rides that LR's own co-op update.

## 4. The Accessory Banner

| Field | Value (spec; board Q17) |
|---|---|
| Featured | one LR's personal accessory (rate-up); one banner per LR at a time, rerun later |
| Price | 120 gems a pull, 1,200 for ten (the Recruit's price, `src/data/types.js:293-294`) |
| Rates | personal accessory **1.0 %**; standard accessories: Legendary 6 %, Mythic 28 %, Rare 65 % |
| Ten-pull | at least one Mythic or better standard accessory |
| **Pity** | **the 80th pull without the personal accessory gives it**; the count carries over to that LR's next Accessory Banner, never to another LR's |
| Spark | none (LR units cannot be sparked, HANDOFF §5) |
| Copies past R5 | each becomes 10 **Accessory Tokens**; 50 Tokens buy a Legendary standard accessory of your choice |
| Shown | the rates, the pity count and the R steps on the banner |
| Never | Recruit Points, tickets, free pulls; the Build Coach never links to it (board Q18) |

**Expected cost** (arithmetic on the rate and the pity, L24; each copy starts a new count):

| Step | Pulls on average | At most | Gems on average / at most | A free player's gems (1,700 a week, `docs/specs/BANNERS.md:23`) |
|---|---:|---:|---:|---|
| R1 (one copy) | ≈ 55 | 80 | ≈ 6,600 / 9,600 | ≈ 4 weeks (at most 6) |
| R5 (five copies) | ≈ 276 | 400 | ≈ 33,000 / **48,000** | ≈ 20 weeks (at most 28), pulling nothing else |

- About 55 % of players get the accessory before the 80th pull (1 − 0.99^79); the pity covers the rest. The average
  with the pity is (1 − 0.99^80) ÷ 0.01 ≈ 55 pulls.
- For comparison: the LR unit herself comes by the 300th pull on her own LR Banner (`LEGEND_PROMISE`,
  `src/data/banners.js:113-114`).
- These numbers and the power they buy (§5) are on the owner board (Q17); A2 waits for the answer (§11).

## 5. Balance

- **The base: the LR floor (F8).** Each LR unit is at least about **2.5–3× the best Kage T5 on both the boss and the
  crowd ruler** before any accessory: the owner's decision (board Q19, "LR floors, no nerfs"), set by balance round 5's
  LR rows (`LR_POWER`, `src/data/balance.js` on `feature/balance-r5`) and gated by GU §8.4 **G0**. A floor, never a cap.
  This spec adds on top:

| Step | Her own output (target, measured) |
|---|---|
| R1 (the mechanic) | +15–20 % |
| R3 | +25–30 % |
| R5 | +40–50 % |
| LR unit with R5 | at least about 3.5× the best Kage T5 (the floor × 1.4; no cap) |

- **Standard accessories** add ×1.03–1.06 to any girl (§2) and need no special gate.
- **Gates** (with GU §8.4's tools):

| # | Gate | Pass |
|---|---|---|
| A-G1 | her ruler on r5's bench (`tools/balance/r5Bench.mjs`) at R0, R1, R5, with `urLate5'` and `lrBlank5'` gear, the LR units at their lifted rows (G0) | inside the table above |
| A-G2 | GU G4's 24 runs (`tools/wyrmGate.mjs --acc r5`): R5 personal accessories on the duo and Tenka, the best standard accessory on everyone else | the best board wins **at most 18 of 24** (75 %), with at least one loss on each stage; G4 itself lands at 6–10 of 24 without accessories, which leaves this room (F9) |
| A-G3 | co-op clamps (`tests/online/coopStatLimits.test.js`) | the identity on the honest maximum: with Legendary standard accessories (A1) and with R5 personal ones (A2) |
| A-G4 | perf: rails and calls on a 60-girl board at 3× | inside the frame budget |
| A-G5 | Tryout Day ceiling (`tools/bench.mjs --hit --ceiling --maxed geared`) | recorded; above GU G6's line goes to the owner |

- **Knobs**, in order, each before it ships: the R2–R5 numbers, then the R1 numbers (call period, rail share).

## 6. Save

- `ACC_IDS` (`src/data/accessories.js`, append-only) lists every accessory **kind** by its id: the six standard kinds
  (`acc_tape`, `acc_watch`, `acc_phones`, `acc_visor`, `acc_notes`, `acc_speaker`), then one per LR unit
  (`acc_kohaku_tsubaki`, `acc_tenka`, …).
- Standard accessories are **items** (`profile.items`), ids `<kind>_<grade>` (grade `r`, `m`, `l`: `acc_tape_l`); a
  personal accessory is the item with its kind's id (`acc_tenka`), whose count is the copies owned (R = min(5, count));
  Accessory Tokens are the item `acc_token`.
- Equipping sets **`unit.accItem`** to an item id (L22): its own field, outside `unit.gear`, the loadouts (GU §7.4) and
  the teams; no loadout or team switch touches it. A standard accessory worn by three girls needs three copies (the
  Backpack shows "3 (2 worn)"). A personal accessory goes only on her.
- **Older builds** drop unknown items and the unknown field: `inv:<id>` mirrors (`MIRRORED_ITEMS`) bring the items back,
  and **`acw:<unitId>`** = 1 + the kind's index in `ACC_IDS` + 1,000 × grade (1 Rare, 2 Mythic, 3 Legendary; 0 for a
  personal accessory, whose R comes from the item count) brings back what she wore; 0 or absent means none (no counter
  uses `acw:` today). The banner's pity lives in `missions.counters` (`apity:<unitId>`), which every build keeps word for
  word.
- `SAVE_VERSION` stays 2; the export is versioned with GU §9.4.

## 7. Sim and co-op

- **Standard accessories**: their stat joins her gear totals in `unitBattleStats` (`src/systems/progression.js`, not
  hashed). Values stay inside the GU §10.2 clamp rows. **No sim id change.**
- **Personal accessories**: new rules in a new hashed `src/sim/accessories.js`; unit-stat keys **`accId`** (one of the
  personal kinds, or null) and **`accR`** (0–5) in `DEFAULT_UNIT_STATS` (`src/sim/constants.js:190`); clamp rows
  `accId: oneOf(SIM_ACC_IDS)` (a test keeps `SIM_ACC_IDS` equal to `ACC_IDS`' personal kinds), `accR: int(0, 5)`
  (`src/online/coop/statLimits.js`). **A `COOP_PROTOCOL` bump** with A2 (or GU M3's, if they ship together).
- **No draw of their own (L17)**: the call picks by HP, then lower uid; a forced split's shards take her average crit
  instead of a crit draw (her regular splits' shards draw as today); rail hits never crit; the R4 slow has no `chance`;
  every shell keeps its one usual crit draw. A test counts `sim.rng` draws by source and finds none from either
  mechanic.
- **Determinism and bounds**: calls and rails count fixed steps; rails are segments with an integer life, at most 3 per
  Tenka and 24 in the battle, laid once a second; `railBudget` is an integer on the sim (+1 a step, at most 30, 1 a hit;
  §3.2).
- **Battle saves**: tower keys `callT`, `called` (uids), `railT` and `rails` (snap); sim key `railBudget` (snap); one
  split-run case each, and the scripted engines battle (`e2e/engines/scriptedBattle.js`) gains both mechanics.
- **Co-op**: each player's girls fight with their own accessories, which travel in the loadout stats
  (`src/online/coop/loadout.js:16-23`, unchanged).

## 8. Profile card and Friend Support

- The card's unit entry gains **`ac`**, defined once with GU §11.2 (L21): two integers **`[i, n]`**, `i` the kind's index
  in `ACC_IDS` (0–255) and `n` 1–5 (a standard accessory's grade 1–3; a personal accessory's R 1–5). GU §11.2's one SQL
  paste writes exactly this rule, so the accessories need no second paste.
- A borrowed girl brings her standard accessory's stat but **never her personal accessory** (GU §11.2).

## 9. Screens

| Screen (file) | What changes |
|---|---|
| Girl page → Gear tab (`src/ui/girlGear.js`) | the round Accessory card beside the five gear cards (styles under the `.acs-` prefix); a picker of owned accessories; a personal accessory shows its R pips and "Unlocks: Target Call" |
| Recruit (`src/ui/screens/recruit.js`) | an **Accessories** tab beside the girls' banners: the featured accessory, its R steps, rates, pity count |
| Backpack | the accessory items, "N (M worn)", fusion |
| Battle panel and drawer | the call marker on a called enemy; rails drawn on the road (pooled, off on Low and with Reduce motion) |
| Wiki | "Accessories" article |

## 10. Art

Icon keys for `feature/gear-icons`: `acc_tape`, `acc_watch`, `acc_phones`, `acc_visor`, `acc_notes`, `acc_speaker`
(grades in the tile), `acc_kohaku_tsubaki`, `acc_tenka`, `acc_token`. Wholesome everyday school things with one tech touch;
the generators never receive third-party images (HANDOFF §6).

## 11. Milestones

| M | Contents | Sim / co-op | Gates |
|---|---|---|---|
| **A0** | readers and mirrors for the slot and the items (rides GU M0) | unchanged | save tests |
| **A1** | the six standard accessories, the slot on the Gear tab, sources, fusion | unchanged | **A-G3** with Legendary standard accessories (L24); e2e of the Gear tab at 844 × 390 and 1280 × 720 |
| **A2** | personal accessories for the duo and Tenka, the Accessory Banner, the card key | **bump** (or GU M3's) | **waits for the owner's answer to Q17** (the banner's price and pity are the game's first new gem price) and for GU M3's G4; then A-G1 – A-G5 |

## 12. Tests

| File | Cases |
|---|---|
| `tests/systems/accessories.test.js` (new) | one per girl; never in a set or club; totals and caps; fusion; worn counts; personal only on her; R from copies; Tokens past R5; `unit.accItem` unchanged by a loadout or team switch |
| `tests/systems/accessoryBanner.test.js` (new) | rates; ten-pull guarantee; pity at 80 carries within one LR's banners only; no spark; never Recruit Points |
| `tests/sim/accessories.test.js` (new) | Target Call: call timing, the strongest enemy, instant shells, forced splits leave `prismN` alone, R steps; Charged Rail: one rail a second, ≤ 3 per Tenka and ≤ 24 in the battle, once per rail, `railBudget`, R4 slow through `applyStatus`, R5 flyers; no `sim.rng` draw from either mechanic |
| `tests/online/coopStatLimits.test.js`, `tests/sim/snapshot.test.js`, `tests/online/engines.test.js` | the new keys; split runs; both engines |
| `tests/systems/save.test.js` (extend) | items and the worn accessory survive an older build through `inv:` and `acw:` |
