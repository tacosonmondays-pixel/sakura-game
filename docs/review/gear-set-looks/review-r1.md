# Gear set looks: independent review, round 1

Reviewed: `feature/gear-set-looks` at `dabd63eb` (on `feature/gear-icons` `a069d2f1`, already approved), Oct 30, 2026.
Reviewer: a fresh agent that built none of it (art judge and code reviewer, HANDOFF §6 review gate).

**Verdict: NOT OK.** Four MEDIUMs block it:
- **M1:** the Power Bank charm and necklace are the same icon at play size.
- **M2:** the Set-Square Clip reads as an arrowhead.
- **M3:** the Tag Token reads as a "no entry" sign.
- **M4:** `gear_design` does not refuse unknown option names.

There are also 13 LOWs (L1 to L13). No BLOCKER or HIGH.

The work is otherwise strong:
- The six kits are coherent and the six sets read apart at 22–32 px.
- Edges are clean.
- The names match the gear update spec.
- The lore is wholesome and original.
- Preview rows cannot reach `public/` or the manifest.
- The sim id is unchanged.

## What I checked

- **The board** `/tmp/gear-icons/gear-set-looks.png` (1860×1604).
  - Layout:
    - The header is y 0–92.
    - Each set row is 252 px tall: Spirit Squad y 92–344, Freeze Tag 344–596, Geometry 596–848, Party Popper
      848–1100, Treasurer 1100–1352, Power Bank 1352–1604.
    - Each slot column is 202 px wide from x=250: Charm 250–452, Ribbon 452–654, Shoes 654–856, Hair Clip 856–1058,
      Necklace 1058–1260.
    - In a cell, the 190 px view sits at (+6, +0), the 32 px tile at (+40, +204) and the 64 px tile at (+90, +184).
  - I cropped all 30 tiles at 32 px (×5, nearest) and 64 px (×3).
- **The board shows this commit.** 29 of the 30 renders in `/tmp/gear-icons/sets/png` are older than the last edits
  to `catalog.py` (07:15:56) and `gearset.py` (07:16:37); only the spirit charm was baked again after them. So I baked
  all 30 keys again from a detached checkout of `dabd63eb`:
  - one Blender process, `nice -n 19`, `--no-manifest`, output to my scratch folder;
  - all 30 are pixel-identical to the board's renders (0 pixels differ);
  - the repo stayed clean.
- **The 256 px renders**, checked on the re-bake:
  - On Nightglass-like navy (to find halos) and on a checker.
  - Edge and corner zooms ×3: popper streamers, necklace chain, cable bow, set-square tip, pom-pom cap, bracelet beads.
  - Machine checks:
    - connected components of alpha (floating bits);
    - bright semi-transparent edge pixels (halos);
    - opaque pixels on the canvas border (clipping).
- **Tiles:**
  - every piece as a 32 px tile on the Super Rare, Mythic, Legendary and UR plates (`post.tile`);
  - each set's charm beside its necklace at 22 px;
  - the six hair clips beside the approved default charm at 22 px.
- **Style:** compared with the approved board `/tmp/gear-icons/gear-board-r2.png`, the default gear in
  `public/art/items`.
- **Colours:** CIEDE2000 between the set bodies and against the default rarity bodies.
- **Names:** the spec and rows against `docs/specs/GEAR_UPDATE.md` §2.1, §3.2 and §3.3 on `origin/spec/gear-update`
  (`cfe3f57c`). I also listed every capitalised word in the added lines and the commit message to look for outside
  names.
- **Code:**
  - I read the whole diff.
  - I probed `gear_design` with bad values, typo'd option names, options from another base and missing options.
  - I checked `gear_rows` routing with and without preview.
  - I compared the spec tables with the rows field by field.
- **Tests and sim:**
  - `nice -n 19 npx vitest run tests/art`: 4 files, **34 tests pass**.
  - The sim id is **`be940ecb2087`** (unchanged). Nothing in `src/` changed, so `COOP_PROTOCOL` stays.

## Findings

### M1 (MEDIUM) Power Bank: the charm and the necklace are the same icon at 22–64 px

- **Where:** board row 6 (y 1352–1604), Charm vs Necklace; `models/gearset.py:170-177` (`keyring` fob `powerbank`)
  vs `:554-559` (`setlocket` locket `battery`).
- **What:** both pieces are a steel ring over an upright indigo rounded rectangle with four lime bars. The only
  difference is the size of the ring (the keyring's split ring vs the necklace loop). Side by side at 22 px they read
  as one item twice, and alone in a backpack row a player cannot tell which slot it is. That fails "a player reads
  the slot before the set" (spec §2) and the brief's charm-vs-necklace check.
- **Fix:** give one of them its own silhouette.
  - Keep the keyring as the flat power bank, and make the locket clearly a battery: a horizontal cell with a
    terminal nub on the side, or a round charge-ring gauge.
  - Or turn the keyring sideways, with a cable stub and port.
  - Keep the four lime bars on only one of them, or use different bar layouts.

### M2 (MEDIUM) Geometry's Set-Square Clip reads as an arrowhead (flagged by the builder)

- **Where:** board row 3 (y 596–848), Hair Clip; `models/gearset.py:445-457`.
- **What:** the triangle sits on the end of the bar with its sharp corner pointing along the bar's axis. The window
  shows the brass bar tip inside it (zoom ×3), so at 22, 32 and 64 px it reads as an arrow on a shaft: a weapon read
  on a hair piece, not a set-square.
- **Fix:**
  - Turn the triangle so its right angle sits at the bar end, with the hypotenuse facing back or up, not pointing
    away along the bar.
  - Or set the set-square across the bar.
  - Either way, close the window over the bar, so the triangle reads as a drafting tool rather than a head.

### M3 (MEDIUM) Freeze Tag's Tag Token reads as a "no entry / prohibited" sign

- **Where:** board row 2 (y 344–596), Charm; `models/gearset.py:116-124` (the coral `_bar(..., rot=-25.0)` across
  the white chalk ring).
- **What:** a round disc, a white ring and a coral bar running diagonally through the centre is the universal
  prohibition glyph. It reads that way at every size, including 256. On an item tile it suggests "disabled" or
  "can't use", and it also echoes the Compass Keyring's diagonal needle.
- **Fix:** move the coral mark off the diagonal, for example a horizontal tag stripe low on the token, or a coral
  chalk hand mark. Keep the chalk ring and the LED dot.

### M4 (MEDIUM) `gear_design` refuses unknown option values, but not unknown option names

- **Where:** `tools/blender/items/catalog.py:342-349`, `GEAR_OPTIONS` at `:302-311`; `models/gearset.py:105`,
  `:362`, `:385-390`, `:428`, `:508`.
- **What:** the spec (§4, `docs/specs/GEAR_SET_LOOKS.md:130`) and the commit say `GEAR_OPTIONS` lists what each base
  draws and `gear_design` refuses anything else. Probed on copies of the rows:
  - Refused, as they should be: `knot='bogus'`, `stripe='pink'`, `stripes=7`.
  - **Accepted:**
    - `knto='grille'`: a typo; the bow silently draws the plain knot.
    - `soel='glow'`: the shoe silently draws a plain sole.
    - `fob='pompom'` on a `setbow`: an option from another base, silently ignored.
    - `toe='body'` and `toe='nonsense'`: `setshoe` draws `toe` (`gearset.py:362`), but `GEAR_OPTIONS` doesn't
      declare it, so any value passes.
    - `body='not-a-colour'`.
  - `buckle='none'` is declared but draws the plain buckle (`gearset.py:385-390`: anything that is not `coin` is the
    plain buckle).
  - A row that leaves out `fob`, `ornament` or `locket` passes `gear_design` and fails later in Blender with a
    `KeyError` (`gearset.py:105`, `:428`, `:508`).

  The six sets are "rows only" for the next set (spec §4), so a typo'd option name drawing the default look without
  a word is exactly what this guard is for.
- **Fix:**
  - In `gear_design`, refuse any key of the set's slot row that is not in `GEAR_OPTIONS[base]`, `GEAR_SET_FIELDS`,
    `stripe`/`strap`, or the story fields (`base`, `piece`, `hero`, `lore`, `note`). Leave the inherited
    `GEAR_SLOT_ART` defaults out of that check.
  - Declare `toe` (or drop it).
  - Make `buckle='none'` draw no buckle (or drop `none`).
  - Require `fob`, `ornament` and `locket` for their bases.
  - A small Python check (for example, the builder's `check_catalog.py` plus these cases) would keep this honest.

### LOWs

- **L1. Hair clips read as other objects at 22–32 px** (Hair Clip column, x 856–1058).
  - All six follow the approved default clip form (a long diagonal bar with an ornament at its end), so this is
    consistent.
  - But at play size the ornaments carry the read: the Pom Clip is a lollipop, the Pause-Button Clip a magnifying
    glass, the Calculator Clip a key or USB stick, the Confetti Clip a hairbrush or sprinkle ice lolly, and the
    Lightning Clip a wand.
  - A shorter bar, or a visible clip hinge or spring under the ornament, would say "clip". This is an owner-level
    call on the approved form.
- **L2. The necklace loop takes about 45 % of the icon height** (Necklace column; flagged by the builder).
  - It matches the approved default necklace, so I accept it.
  - Paired with keyring charms, Geometry's Compass Keyring and Crosshair Locket are close at 22 px (a brass ring over
    a round brass disc), though still separable by loop size. M1 is the pair that fails.
- **L3. The Abacus Bracelet reads as a finger ring with a stone** at 22–32 px.
  - Where: row 5, Charm; `gearset.py:203-206`.
  - Cause: the round coin tag on a jump ring sits on top of the hoop.
  - Fix: move the tag to the side, or drop it. (Owner question 4 covers the bracelet itself.)
- **L4. Some details only show at 64–256 px** (flagged by the builder): the hopscotch grid, ruler ticks, LCD digits,
  grille dots and compass ticks. That matches spec §2 ("small parts are for the 64–256 px views"), and every hero
  detail holds at 32 px. One exception: the Light-Up Trainers' "cherry red" glow sole reads pink, and the shoe reads
  white (row 1, Shoes; owner question 1).
- **L5. Pom-Pom Keyring glint** (row 1, Charm; glint `star` at `gearset.py:115`).
  - The 4-point glint lands on a white tuft and fuses into a white teardrop.
  - At 32–64 px the two white tufts read as spots or eyes on the red ball.
  - Fix: put the glint on red.
- **L6. Geometry slate and Power Bank indigo** are ΔE2000 14.2 apart.
  - That is under the ΔE ≥ 15 the gear update sets for set chip colours (§3.3).
  - On the pale plates they separate by brass vs lime at 22–32 px, which is fine.
  - On navy (the Nightglass LR tile, `#0e1930`) the slate Protractor Ribbon and Ruler-Step Loafers sink.
  - Check this when the LR gear tile is built.
- **L7. "Colour pair first" (spec §2) is softer than written.** Party Popper's violet `#8a5cf0` is ΔE 5.5 from the
  default Super Rare body `#9b6bff`, and Spirit Squad's red is 10.2 from Mythic. Beside default pieces in the
  backpack, those sets read by their gold or white and their shape, not their body colour. This is a note for the
  spec wording, not the art.
- **L8. Party Popper's Streamer Bow has a gold star clasp** (row 4, Ribbon). The rule is "no star hair clip", so this
  is allowed. But the Ribbon slot includes hair ribbons (GEAR_UPDATE §2.1), and the star rule exists for Hikari's and
  Ruri's looks. Worth the owner's glance; a confetti-burst clasp would avoid the question.
- **L9. Role wording:** Party Popper's role is `crowds` in the row and the spec (`catalog.py:242`,
  `GEAR_SET_LOOKS.md:81`) but `crowd` in GEAR_UPDATE §3.2.
- **L10. The spec tables are said to be "generated from those rows"** (`GEAR_SET_LOOKS.md:130-131`), but the generator
  is not in the repo, and no test keeps them in sync. Today there is no drift (I checked every option, hero, lore
  and role field). Commit the generator or add a sync test.
- **L11. Test gap:** the new test checks that the rows exist with five lore lines. Nothing holds the six sets at
  `preview=True` until `src/data/gearSets.js` lands, and `tests/art/itemArt.test.js` already accepts
  `gear_<set>_{charm,ribbon,shoes}` manifest keys, so dropping `preview` early and baking would pass the tests. The
  build guard itself is sound: preview rows are `kind='calibration'` and go to `<scratch>/calibration`; without
  `--family gear-preview` or named keys, `gear_rows` gives no set keys; the manifest is built from `public/` only.
- **L12. Art budget.** `public/art/items` holds 1.61 MB. These 30 icons are 0.45 MB, and the default Hair Clip and
  Necklace ladders are 0.17 MB (their previews). That makes 2.23 MB of the 2.2 MiB (2.31 MB) `TOTAL_CAP`, leaving
  about 75 KB before the Set Box, pin and lens icons of GEAR_UPDATE §3.3. Plan the budget before the sets ship.
- **L13. Tidiness in `gearset.py`:**
  - `:144` has a dead term (`0.09 * k * 0`).
  - `:174` has a branch that is always true (`if k < 4` inside `range(4)`).
  - The module docstring (`:10-11`) leaves out `heel`, `laces`, `toe` and the `plain` buckle.

## What passes

- **Coherence.** Each set is one motif, one palette and one material:
  - Spirit Squad: cheer red and white with gold pins.
  - Freeze Tag: ice blue and chalk white with one coral mark per piece.
  - Geometry: slate with brass and a cyan dot.
  - Party Popper: violet with gold and confetti.
  - Treasurer: mint with silver and a green LCD.
  - Power Bank: indigo with lime bars and steel.

  The hero details are the largest contrast marks, as the spec says.
- **Sets apart at 22–32 px.** All six read as different sets on every plate (Super Rare, Mythic, Legendary, UR); see
  L6 and L7 for the close colours.
- **Slots.** The bows and shoes read as their slots in every set. Necklaces read as necklaces. Charms read as charms,
  except M1, M3 and L3.
- **Artifacts.**
  - No halos on navy.
  - No floating bits: each render is one connected shape.
  - No clipping: no opaque pixel on any canvas edge, the same as the approved defaults.
  - Alpha edges are smooth, and the ink outline is continuous and even on every piece.
- **Style.** Same camera, cel shading, ink weight, glints and framing as the approved gear. The new brass and steel
  metals sit well beside the approved silver and gold.
- **Spec and names.**
  - All 30 piece names and the six set ids match GEAR_UPDATE §3.3 and §3.2 exactly.
  - The hair pieces are rigid clips, with no bow, star or snowflake clip.
  - No hair ornament clashes with a girl's look.
  - The lore is wholesome, original and school-with-tech.
  - No other games' or anime names anywhere in the diff or the commit message.
  - No images are added.
- **Code.**
  - `gear.py` changes are additive: brass and steel, hex trims, and the set-base lookup. The default looks are
    untouched.
  - The `_HI` shoe height that `setshoe` sets is reset at the end, and the default sneaker sets it on entry, so it
    cannot leak.
  - Sim id `be940ecb2087`. `tests/art` 34/34.

## Verdict

**NOT OK.** Fix M1, M2, M3 and M4, then send it to a fresh reviewer with a new board baked from the fix commit. The
LOWs are optional; L5, L9, L10 and L13 are quick, and L12 needs a plan before the sets ship.
