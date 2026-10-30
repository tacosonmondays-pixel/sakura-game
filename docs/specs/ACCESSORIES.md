# Accessories: the sixth slot, standard accessories and LR personal accessories (build spec)

Sakura Sentinels, 2026-10-30. Spec only. Companion to `docs/specs/GEAR_UPDATE.md` (cited as GU); the owner questions
are on `docs/review/gear-update/OWNER_BOARD.md` (Q17).

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

1. **The Accessory slot** (code `acc`): one per girl, any girl, beside her five gear pieces. It belongs to no set and
   no club, and takes no ✦, pins or Limit Break.
2. **Standard accessories**: six kinds (Wrist Tape, Smartwatch, Headphones, Sun Visor, Pocket Notebook, Pocket
   Speaker), one stat each, at three grades (Rare, Mythic, Legendary). From normal play; three of a grade fuse into one
   of the next in the Craft Room. A Legendary one is worth about one average Legendary substat line.
3. **Personal accessories**: one per LR unit, only from her Accessory Banner. Copies raise it **R1 → R5**. R1 unlocks a
   new mechanic; R2–R5 strengthen it.
   - **Kohaku & Tsubaki: the Walkie-Talkie Pair.** R1 **Target Call**: every 8 s Kohaku's beam calls the strongest
     enemy in its reach; Tsubaki's shells aimed at a called enemy land at once and always split into prism shards.
   - **Tenka: the Lab Goggles.** R1 **Charged Rail**: each coil bolt leaves a charged rail along its path for 2 s; an
     enemy that crosses it takes 15 % of the bolt's damage.
4. **The Accessory Banner**: 120 gems a pull, the featured personal accessory at 1 % (rate-up), **a guaranteed one by
   the 80th pull**, no spark; the rest of the pool is standard accessories. Rates and pity are shown on the banner.
5. **Balance**: on top of the LR target the balance work sets (an LR unit ≈ 2.5–3× the best Kage T5 before her
   accessory): R1 +15–20 % of her own output, R5 +40–50 %. The best full blank-LR board with R5 accessories still must
   not beat the Wyrm every run (GU §8.4 G4).
6. **Co-op**: standard accessories are numbers only (no sim change). Personal accessories are new sim rules: one
   `COOP_PROTOCOL` bump with their release (A2), or GU M3's.
7. **Milestones**: A0 reader (with GU M0) → A1 standard accessories (normal update) → A2 personal accessories and the
   banner (a co-op update).

---------------------------------------------------------------------------------------------------

## 1. The slot

- A sixth slot, **Accessory**, shown on her Equipment tab as a round card apart from the five gear cards. One per girl.
- **Outside the sets**: it never counts toward a set (GU §3) or a club (GS §C), takes no ✦ stitch, no Tie or Collar
  Pin, no awakening and no Limit Break. It has no random rolls.
- **Code names.** The slot id is `acc` and item ids start with `acc_`. The word `accessory` already names a part of each
  girl's 3D look (`accessory: 'horns'`, `'catEars'`, `'hairpin'` in `src/data/unitsExpansion.js:46`, `:101`, `:220`;
  `tools/blender/lib/accessory.py`), so the new system never uses a bare `accessory` identifier. Players see
  "Accessory".

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
antenna light. (Her kit, `src/data/unitsDuo.js`: Tsubaki's aimed star shells land after a 1 s delay anywhere on the
ground; Kohaku's constant prism beam guards the sky; a shell that passes through the prism splits into starlight
shards.)

| R | Target Call |
|---|---|
| **R1** | Every 8 s, Kohaku's beam **calls** the strongest enemy in its reach (highest HP, ties by lower uid) for 3 s. Tsubaki's shells aimed at a called enemy **land at once** (no 1 s delay) and always split into prism shards. |
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
| **R1** | Each coil bolt leaves a **charged rail** along its path for 2 s. An enemy that crosses a rail takes 15 % of that bolt's damage, once per rail. Rails never crit and share one battle-wide budget. |
| R2 | 20 % |
| R3 | Rails last 3 s |
| R4 | 25 %, and a rail slows 15 % for 1 s (a control status: Control Strength and You're It apply, GU §2.4) |
| R5 | Rails also hit flyers |

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

Expected cost (modelled): R1 ≈ 100 pulls on average without pity (a 1 % rate), at most 80 with it; most players reach R1
at the pity. R5 needs five copies: at most 400 pulls.

## 5. Balance

- **The base.** The balance work tunes LR units to about **2.5–3× the best Kage T5** before any accessory (the owner's
  "LR's should be more op!"). This spec adds on top:

| Step | Her own output (target, measured) |
|---|---|
| R1 (the mechanic) | +15–20 % |
| R3 | +25–30 % |
| R5 | +40–50 % |
| LR unit with R5 | ≈ 3.5–4.5× the best Kage T5 |

- **Standard accessories** add ×1.03–1.06 to any girl (§2) and need no special gate.
- **Gates** (with GU §8.4's tools):

| # | Gate | Pass |
|---|---|---|
| A-G1 | her ruler on r5's bench (`tools/balance/r5Bench.mjs`) at R0, R1, R5, with `urLate5'` and `lrBlank5'` gear | inside the table above |
| A-G2 | the Wyrm band (GU G4) with R5 accessories on the duo and Tenka | the best board still wins at most 3 of 4 runs |
| A-G3 | co-op clamps (`tests/online/coopStatLimits.test.js`) | the identity on the honest maximum with R5 |
| A-G4 | perf: rails and calls on a 60-girl board at 3× | inside the frame budget |
| A-G5 | Tryout Day ceiling (`tools/bench.mjs --hit --ceiling --maxed geared`) | recorded; above GU G6's line goes to the owner |

- **Knobs**, in order, each before it ships: the R2–R5 numbers, then the R1 numbers (call period, rail share).

## 6. Save

- Standard accessories are **items** (`profile.items`), ids `acc_<kind>_<grade>`; a personal accessory is the item
  `acc_<unitId>` whose count is the copies owned (R = min(5, count)); Accessory Tokens are the item `acc_token`.
- Equipping sets `unit.gear.acc` to an item id; a standard accessory worn by three girls needs three copies (the
  Backpack shows "3 (2 worn)"). A personal accessory goes only on her.
- **Older builds** drop unknown items and the unknown slot: `inv:<id>` mirrors (`MIRRORED_ITEMS`) bring the items back,
  and `own:<id>:acc` (an index in the append-only `ACC_IDS`) brings back what she wore. The banner's pity lives in
  `missions.counters` (`apity:<unitId>`), which every build keeps word for word.
- `SAVE_VERSION` stays 2; the export is versioned with GU §9.4.

## 7. Sim and co-op

- **Standard accessories**: their stat joins her gear totals in `unitBattleStats` (`src/systems/progression.js`, not
  hashed). Values stay inside the GU §10.2 clamp rows. **No sim id change.**
- **Personal accessories**: new rules in a new hashed `src/sim/accessories.js`; unit-stat keys **`acc`** (one of the
  personal ids, or null) and **`accR`** (0–5) in `DEFAULT_UNIT_STATS` (`src/sim/constants.js:190`); clamp rows
  `acc: oneOf(SIM_ACC_IDS)`, `accR: int(0, 5)` (`src/online/coop/statLimits.js`). **A `COOP_PROTOCOL` bump** with A2 (or
  GU M3's, if they ship together).
- **Determinism**: calls and rails count fixed steps; "the strongest enemy" is chosen by HP, then lower uid; rails are
  segments on the tower with an integer life; the rail budget is an integer on the sim (like `popBudget`); no `sim.rng`
  draw (rails never crit).
- **Battle saves**: tower keys `callT`, `called` (uids) and `rails` (snap); sim key `railBudget` (snap); one split-run
  case each, and the scripted engines battle (`e2e/engines/scriptedBattle.js`) gains both mechanics.
- **Co-op**: each player's girls fight with their own accessories, which travel in the loadout stats
  (`src/online/coop/loadout.js:16-23`, unchanged).

## 8. Profile card and Friend Support

- The card's unit entry gains **`ac`**: `[accessory index, R]` for a personal accessory, or `[index, grade]` for a
  standard one. The server key is accepted by GU §11.2's one SQL paste, so the accessories need no second paste.
- A borrowed girl brings her standard accessory's stat but **never her personal accessory** (GU §11.2).

## 9. Screens

| Screen (file) | What changes |
|---|---|
| Girl page → Equipment (`src/ui/girlGear.js`) | the round Accessory card beside the five gear cards; a picker of owned accessories; a personal accessory shows its R pips and "Unlocks: Target Call" |
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
| **A1** | the six standard accessories, the slot on the Equipment tab, sources, fusion | unchanged | e2e Equipment at 844 × 390 and 1280 × 720 |
| **A2** | personal accessories for the duo and Tenka, the Accessory Banner, the card key | **bump** (or GU M3's) | A-G1 – A-G5 |

## 12. Tests

| File | Cases |
|---|---|
| `tests/systems/accessories.test.js` (new) | one per girl; never in a set or club; totals and caps; fusion; worn counts; personal only on her; R from copies; Tokens past R5 |
| `tests/systems/accessoryBanner.test.js` (new) | rates; ten-pull guarantee; pity at 80 carries within one LR's banners only; no spark; never Recruit Points |
| `tests/sim/accessories.test.js` (new) | Target Call: call timing, the strongest enemy, instant shells, shards, R steps; Charged Rail: rails, once per rail, budget, R4 slow through `applyStatus`, R5 flyers; no rng draw |
| `tests/online/coopStatLimits.test.js`, `tests/sim/snapshot.test.js`, `tests/online/engines.test.js` | the new keys; split runs; both engines |
| `tests/systems/save.test.js` (extend) | items and the slot survive an older build through `inv:` and `own:<id>:acc` |
