# Set Boxes v2: random and preset boxes, batch open, UR set boxes (and D5: UR → LR is an awakening)

Status: **decided defaults, building** on `feature/set-boxes-v2` (off `main` = v0.1.66 `fc978aba`). Ships in v0.1.68
with the item icons (`feature/item-icons-3d`). The owner may override any default below; the open questions are in §9.
Builds on the gear update (`docs/specs/GEAR_UPDATE.md` on `origin/spec/gear-update`, §5 Set Boxes, §4 LR gear).

## 0. The owner's words

> "you should be able to open multiple of those preset boxes. Those preset boxes should only be available through the
> supply bot, otherwise they'll batch open random stats like the regular boxes! they will also have their UR versions?"

> "Specific boxes should open specific sets… if there is a party popper box, it should only give you party popper
> pieces."

> (D5) "instead of set LR it should awaken into an LR, like you awaken from legend to UR."

## 1. Today (live v0.1.66)

- Every Set Box is a **preset** box: you choose each piece's main stat, the substats roll, one box at a time
  (`src/systems/gearSets.js` `openSetBox`, `src/ui/gearUr.js` `setBoxModal`, the Backpack's Supplies row).
- Rarities Mythic and Legendary. Ids `setbox_<set>_<rarity>` for the six sets and `setbox_pick_<rarity>` (choose the
  set) — 14 ids, all in `MIRRORED_ITEMS` (`inv:` mirrors).
- Player sources: the welcome gift (`setbox_pick_mythic`, mark `su:welcome`) and each titan's Nightmare first clear
  (`setbox_<titan set>_legendary`, mark `su:titanbox:<titan>`), `grantSetBoxGifts`. Nothing else pays a Set Box.
- The Supply Bot (developer clan sandbox, `src/ui/online/supplyBot.js`) grants any item.
- UR gear: Legendary awakened to rainbow (`ur: 1`); the Rainbow Gear Box makes box-born UR (`gbx:` mark / `box`).

## 2. Decided defaults

**D1. Two kinds of Set Box**, for each of the six sets and for the pick box:

| Kind | Opens | Picker | Batch | Who gets it |
|---|---|---|---|---|
| **Set Box** (random) | all five pieces of its set at its rarity, +0; **main stats roll** like a regular gear box (uniform over the slot's mains); substats roll | none (the pick box: choose the set once per batch) | **Open · Open ×10 · Open all** (up to 20 boxes a tap), one results summary | the player sources (D3) |
| **Preset Set Box** | the same five pieces, **main stats chosen** (today's box) | set (pick box) + a main stat per slot, "Fill for a girl" | choose once, applied to all N, **confirm step** when N > 1 | **Supply Bot only** (and boxes players already own, D3) |

**D2. Rarities: Mythic, Legendary and UR**, for both kinds. A UR box gives all five pieces as **UR**: Legendary
`ur: 1`, +0, four substats, auto-locked, exactly as the Rainbow Gear Box makes UR (box-born: the `gbx:` mark on a
Charm / Ribbon / Shoes piece, `box: 1` on a Hair Clip / Necklace, UR prices below +10, salvage pays its Seed).
Player sources for UR boxes: **none yet** besides the Supply Bot (§9 Q1 proposes some).

**D3. Player sources switch to the random kind from now on.** The welcome gift becomes `setbox_pick_mythic_random`,
each titan's Nightmare first clear `setbox_<set>_legendary_random`. Same one-time rules and the **same marks**
(`su:welcome`, `su:titanbox:<titan>`), so nobody is paid twice: a save already marked gets nothing new; an unmarked
save gets the random box. **Grandfathered:** every preset box a player already owns keeps its id, stays preset and stays
openable (with its picker, now also in batches). No take-backs, no conversion.

**D4. A box only ever gives its own set's pieces.** A set's own box: that set, always. The pick box: the set chosen for
that batch, for every piece of it. Locked by a test over every set × kind × rarity (§8).

**D5. UR → LR is an awakening** (sibling spec `docs/specs/LR_AWAKEN.md`): the Lens awakens a UR +12 piece into **LR**
(today's Set LR numbers); Blank LR stays, as a separate "Unbind to Blank LR…" action. Gameplay unchanged.

## 3. Items and ids

Seven boxes (six sets + pick) × two kinds × three rarities = **42 ids**: the 14 live ones plus 28 new.

| Kind | Mythic / Legendary | UR |
|---|---|---|
| Preset | `setbox_<set>_mythic`, `setbox_<set>_legendary` (**live ids, unchanged meaning**) | `setbox_<set>_ur` (new) |
| Random | `setbox_<set>_mythic_random`, `setbox_<set>_legendary_random` (new) | `setbox_<set>_ur_random` (new) |

`<set>` is one of `SET_IDS` or `pick`. Helpers in `src/data/gearAwaken.js`: `setBoxId(set, rarity, kind = 'preset')`,
`SET_BOX_RARITIES = ['mythic', 'legendary', 'ur']`, `SET_BOX_KINDS = ['random', 'preset']`, `SET_BOX_IDS` /
`SET_PICK_BOX_IDS` (every kind and rarity), `setBoxInfo(id) → { set, rarity, kind } | null`.

Item fields (category `gearbox`, so they sit with the gear boxes; `pickSet: true` stays the "Set Box" flag that
`openGearBox` refuses):

| Field | Value |
|---|---|
| `set` | its set (absent on the pick box) |
| `setKind` | `'random'` or `'preset'` |
| `setRarity` | `'mythic'`, `'legendary'` or `'ur'` |
| `rarity` | Mythic / Legendary; a UR box is `'legendary'` with `display: 'ur'`, `rainbow: true` (as the Seed and the Rainbow Gear Box) |
| `supplyOnly` | `true` on every preset box: the Supply Bot tags it "Supply Bot only" |

Names: random — "Party Popper Box (Legendary)", "Legendary Set Box", "Party Popper Box (UR)", "UR Set Box"; preset —
"Party Popper Preset Box (Legendary)", "Legendary Preset Set Box", … (the live preset ids are renamed with "Preset";
their behaviour is unchanged). Descriptions say what is rolled and what is chosen, and that the random kind opens in
batches.

Icons: until `feature/item-icons-3d` bakes them, a set box draws the gear box of its rarity (UR: the Rainbow Gear Box
art); `src/art/icons.js` matches every id above.

## 4. Opening

`openSetBox(profile, itemId, rng, { set, mains, count = 1 })` (systems/gearSets.js):

1. Not a Set Box → `notSetBox`. The pick box needs `set` ∈ `SET_IDS`; a set's own box ignores `set` (D4).
2. `n = min(count, held, SET_OPEN_BATCH_MAX = 20, floor(gearRoom / 5))`; `n = 0` → `bagFull` (room) or `missing`.
3. Consume `n` boxes, then for each box and each of the five slots: `rollSetPiece(rng, set, { slot, rarity, main })`,
   `main` = the chosen one (preset; a missing or wrong one: the slot's first, as today) or none (random: rolled).
   UR: the piece becomes box-born UR (`makeBoxUr`, shared with `openRainbowBox`). Each Mythic+ piece joins a random
   club, as every drop.
4. `track('setBox', n)`. Returns `{ ok, gear, opened: n, wanted: count, set }`.

Fewer than asked (bag room, the batch cap) opens what fits; the rest stay in the Backpack and a toast says so.

## 5. UI flows

**Backpack · Supplies** (`src/ui/screens/backpack.js`):
- A random set's own box: **Open · Open ×10 · Open all** (as regular gear boxes; "Open 20" above 20), straight to the
  results summary.
- A random pick box: **Open** → `setBoxModal` in pick mode (choose the set, how many: 1 / ×10 / all) → summary.
- A preset box: **Open** → `setBoxModal` in preset mode (set if pick, a main stat per slot, "Fill for a girl", how
  many) → for N > 1 a confirm ("Open 5 boxes with these main stats? 25 pieces.") → summary.

**setBoxModal(itemId, onDone)** modes from the item (`setKind`, `set`): the header (`setBoxHeader(set, item)`: the set
name, its pieces and its bonus text; the dead-passive line) is one function so the icons branch's redesign (icon, five
pieces, set bonus) replaces it in one place; then the set row (pick box), the main-stat rows (preset only), the count
row, and Open.

**Results summary** (`setBoxResults`): title "<box name> ×N", a line "N boxes · 5N pieces · all <Set>", the pieces
(the gear card grid; the counted summary above 12 pieces, as `openBoxes` does). A UR box's pieces show as UR cards in
the summary (no per-piece reveal for a batch).

**Supply Bot:** lists every Set Box (random, preset, UR) in the Equipment tab as today; the picked line says "Supply Bot
only" for a preset box.

## 6. Save safety (older builds)

Live v0.1.66 knows the 14 preset ids and nothing else. The new 28 ids follow the gear update's own pattern:
- **`inv:` mirrors.** Every new id joins `MIRRORED_ITEMS`. An older build drops the item (and keeps a "lossy" backup
  copy, as for every item added since the Seed) but keeps `missions.counters` word for word and never rewrites an
  `inv:` key it does not list; the next load here restores the count (`restoreGearMarks` step 1). A spent box keeps
  `inv: 0`, so it never comes back.
- **Gift letters.** `repairSetBoxLetters` already gives a letter back the boxes an older build's `cleanMail` stripped
  when every box its id names is a one-time box whose mark is set; `boxMark` now knows the random ids too. New: a
  letter an older build **claimed** while it was empty paid nothing; claiming here sets `su:paid:<letter id>`, so a
  claimed `setbox-gift:` letter that names a v2 id and has no such mark pays its boxes once (then the mark).
- **Box-born UR pieces** from a UR box use the Rainbow Gear Box's mirrors (`gbx:` / `gbl:` / the whole-piece mirror),
  already proven across older builds.
- **Marks** `su:welcome` / `su:titanbox:<titan>` are unchanged, and an older tab that pays the gift first pays the
  preset id (its own code), which this build grandfathers.
- Proven by a round trip in `tests/systems/setBoxesV2Save.test.js` against v0.1.66's own code vendored under
  `tests/fixtures/main-fc978aba` (save.js, gearMarks.js, gear.js, gearSets.js, mail.js, rosterSave.js and the gear
  data): grant here → load and save in v0.1.66 (and open / claim there) → load here.

No `SAVE_VERSION` bump; additive.

## 7. Balance

- Gear opening is outside the battle sim; the sim id stays `b2ff5e0e884b` and `COOP_PROTOCOL` is unchanged.
- **The ceiling does not move.** Five UR set pieces (any slot, any set) are already attainable: Legendary set pieces
  awaken, and the Rainbow Gear Box gives a titan-set UR piece in any slot. A UR box only shortens the road, and it is
  Supply Bot only for now.
- **lrBar.** Its bench (`tools/balance/maxedProfile.mjs`) gives every girl three no-set UR +12 pieces: it does not model
  set gear. It gains `gear: 'urset:<set>'` (five UR +12 pieces of that set at average rolls, mains by "Fill for a girl")
  and `lrBar.mjs --gear urset`: every LR build and every bar candidate under each set, the best set per build, then
  each LR build ÷ the best non-LR. Margins go in the report; an LR under ×1.25 stops the work (no nerf).
- **noNerf.** No battle stat or sim number changes; the gate's maxed tier-5 pass is compared live vs branch.

### 7.1 Results (feature/set-boxes-v2)

- Sim id `b2ff5e0e884b` (unchanged). noNerf, maxed tier 5, Umeko + Midori, seed 9, live `fc978aba` vs branch: 297
  cells, 0 under, the two outputs byte-identical.
- lrBar, today's bench (three no-set UR +12): unchanged, crowd ×1.31–1.33, boss ×2.18–4.37 of LR_BAR. All ≥ 1.25.
- lrBar `--gear urset` (five UR +12 set pieces on everyone, best set per build; the bar re-measured on that gear):
  bar crowd Akane p0t5 53.21M (Geometry), boss Aoi p2t5c1 13.26M (Geometry).

  | LR build | crowd | ×bar | boss | ×bar |
  |---|---:|---:|---:|---:|
  | kohaku_tsubaki p0t5 | 80.35M | 1.51 | 64.95M | 4.90 |
  | kohaku_tsubaki p1t5 | 70.76M | 1.33 | 73.80M | 5.57 |
  | **kohaku_tsubaki p2t5** | 54.04M | **1.02** | 30.92M | 2.33 |
  | tenka p0t5 | 72.34M | 1.36 | 88.11M | 6.65 |
  | tenka p1t5 | 71.11M | 1.34 | 67.21M | 5.07 |
  | tenka p2t5 | 78.28M | 1.47 | 84.65M | 6.38 |

  **Kohaku & Tsubaki p2t5 falls under ×1.25 on a crowd (×1.02)** once everyone wears five Geometry UR pieces
  (Akane's crowd grows ×3.06 with the uncapped crit; the duo's p2t5 ×2.37). Per the rules nothing is nerfed and this is
  reported to the owner (§9 Q6). This gear is **already reachable on live** (Legendary set pieces awaken; the Rainbow
  Gear Box makes titan-set UR in any slot), so UR Set Boxes do not create it, they only shorten the road, and they are
  Supply Bot only for now.

## 8. Tests

- Unit (`tests/systems/setBoxesV2.test.js`): every set × kind × rarity opens only its own set's five pieces (one per
  slot) at its rarity (UR: `ur: 1`, locked, box-born marks); the pick box only the chosen set; random mains vary and
  are each valid for the slot; preset mains are the chosen ones for every box of a batch; batch counts, the cap, bag
  room, `missing`; `openGearBox` still refuses them; ids, names, `supplyOnly`, `MIRRORED_ITEMS`, icons.
- Grants: welcome and titan gifts pay the random ids; marks stop a second pay; an owned preset box stays preset.
- Older build round trip (above), the letter repairs, the claimed-empty letter.
- e2e `e2e/gear-slots.mjs`: batch-open 5 Party Popper (Legendary) random boxes from the Supplies sheet → 25 pieces, all
  Party Popper, one per slot per box, mains not all the same; a preset box's batch with the confirm.
- The gear e2e (gear-slots, ur-gear, teams) and `npm test`.

## 9. Open questions for the owner (defaults in bold)

**Owner decisions (Oct 31, via the coordinator):** UR Set Boxes stay **Supply Bot only** (Q1), and the Tie Pin and Collar
Pin stay Supply Bot only too (no player sources). The batch cap of 20 (Q2), the "Preset" rename (Q3) and uniform random
mains (Q4) stand as defaults until the owner says otherwise.

1. **UR set box sources.** **None yet (Supply Bot only).** Proposals: a rare Titan Trials Mayhem drop beside the
   Rainbow Gear Box (e.g. 1% a win, the Rainbow Meter guarantees one by the 60th Mayhem win); an event's top-shelf
   exchange item; a "five full UR sets" achievement. Note: a UR box salvages into five Seeds (as five Rainbow Gear
   Boxes), so its price should sit near five Rainbow Gear Boxes.
2. **Batch cap.** **20 boxes (100 pieces) a tap**, the same 100 pieces as a regular "Open all".
3. **Preset rename.** **Owned preset boxes are renamed "… Preset Box …"** so a player can tell them apart from the new
   random ones.
4. **Random main-stat odds.** **Uniform over the slot's mains, as a regular gear box.** (A weighted roll toward a
   girl's wants would be a different box.)
6. **The LR bar on set gear** (§7.1). **Reported, nothing changed.** Under five Geometry UR pieces on everyone, the
   duo's p2t5 crowd is ×1.02 of the best non-LR (Akane p0t5). Options for the owner: raise the duo's p2t5 crowd; or
   keep the bar on today's bench (no set gear). UR Set Box player sources (Q1) should wait for that answer.
5. **More random sources** (the gear update's planned Titan shelf, event exchanges, the "Five of a Kind" / "Set
   Collector" achievements) are not built; when they come, they pay the random kind.
