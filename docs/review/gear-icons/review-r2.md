# Gear icons: independent review, round 2

Reviewed: `feature/gear-icons` at `77692ff7` (the r1 fixes, on `19819832` and `origin/main` `60ce9cad`), Oct 30, 2026.
Reviewer: a fresh agent that built none of it and did not do round 1 (art judge and code reviewer, HANDOFF §6 review
gate).

**Verdict: OK.** Both r1 MEDIUMs are fixed:
- Set looks are keyed by the gear set id at every call site.
- The Mythic charm's crest is now a sakura blossom that reads apart from the Legendary sunburst down to 22 px.

Of the eight r1 LOWs, six are fixed and two (L2, L3) are partly fixed. Those two carry over as LOWs R1 and R2, and
there are three new LOWs (R3 to R5). None blocks.

## What I checked

- **The board** `/tmp/gear-icons/gear-board-r2.png` (1128×2084).
  - Tier columns are 168 px wide from x=120: common 120–288, rare 288–456, superRare 456–624, mythic 624–792,
    legendary 792–960, ur 960–1128.
  - Rows:

    | Slot | live | NEW |
    |---|---|---|
    | charm | y 64–282 | y 282–500 |
    | ribbon | y 506–724 | y 724–942 |
    | shoes | y 948–1166 | y 1166–1384 |

    The previews start at y 1430.
  - In a cell, the 160 px view sits at (+4, +0), the 32 px tile at (+14, +168) and the 64 px tile at (+62, +154).
  - The board shows this commit. Its NEW cells match the committed WebPs and its live cells match `origin/main`
    (mean absolute difference ≤ 0.43 of 255 per cell).
  - I cropped every 32 px and 64 px tile and zoomed it 4–6× (nearest).
- **The 36 committed WebPs** (`public/art/items/gear_*`), opened directly and compared with `origin/main` and with r1
  (`19819832`).
  - Measured with Pillow: alpha box, edge contact, light semi-transparent fringe, fill, mean tone and sampled body
    tones.
  - Zoomed 2–16× on white, dark and checkerboard: edges, corners, toes, drop beads and wing roots.
  - Drew play-size strips at 22, 32 and 48 px on the pipeline's own tier plate (`post.tile`), live above new.
  - Mask-matched each UR body against its Legendary body to measure its scale.
- **Code.**
  - The r1 fix diff (`57676e9d..77692ff7`) and the whole branch diff.
  - The set path, exercised with a baked set look faked in memory. A loader hook adds `gear_spirit_charm` and
    `gear_tea_ribbon` to `ITEM_ART`; nothing is written to the repo. It covers `gearArtKey`, `gearIcon` (keys,
    fallbacks, srcset, the 22 px cut, UR) and `itemArtSVG`. All 23 checks pass.
  - One mutation against the new call-site guard test (R3), reverted afterwards.
  - The spec on `origin/spec/gear-update` (`d3d59b7e`), `docs/specs/GEAR_UPDATE.md` §2.1–2.2 and §3.1–3.5.
- **Tests and sim.**
  - Tests, run with `nice`: `tests/art` (4 files), `tests/ui/{gearTile,gearView,unitBuild,girlDetail,allySheet}.test.js`
    and `tests/integration/consistency.test.js`. 10 files, 87/87 pass.
  - Sim id `be940ecb2087` (unchanged) and `COOP_PROTOCOL` 13. No file under `src/sim`, `src/online`, `src/data` or
    `src/systems` changed.
- **No re-bake.** This container has no Blender, and the machine ran at a load of about 15 on 4 cores.

## The r1 findings

| r1 | Status |
|---|---|
| M1: set looks keyed by the club | **Fixed** |
| M2: the Mythic charm's crest reads as a turtle | **Fixed** |
| L1: lower tiers colour-only; Super Rare shoes lost their wing | Fixed |
| L2: Legendary paler than live | **Partly fixed**: R1 |
| L3: UR ribbon wings like ears; UR shoe wing muted | **Partly fixed**: R2 |
| L4: floating UR sparkles | Fixed |
| L5: the UR reveal does not pass the set | Fixed |
| L6: CONTRACTS.md signatures | Fixed |
| L7: catalog options the models don't draw or the spec forbids | Fixed |
| L8: set-look keys and tiers against the spec and the budget | Fixed |

### M1: Fixed

**Call sites.** Every gear screen passes the piece's own set, and no club reaches `gearIcon`:
- `src/ui/battle/results.js:53`, `src/ui/gearTile.js:114` and `src/ui/gearUr.js:92`.
- The UR reveal, `src/ui/gearUr.js:373` (L5).
- `src/ui/screens/stage.js:244`.
- `src/ui/unitBuild.js:107`. Its model now carries `set: g.set || null` (`:43`).

The two other calls draw no piece: the empty slot (`unitBuild.js:102`) and the slot filter chips
(`src/ui/screens/backpack.js:331`). Gear pieces have no `set` field today, so every screen keeps the default look.

**Key.** The key is `gear_<set>_<slot>`, one look per set and slot, as in spec §3.3:
- `src/art/icons.js:92-97`.
- `tools/blender/items/catalog.py:183-196` (`gear_key`, `gear_parse`).
- `catalog.py:211-237`: `gear_rows` bakes one row per set and slot.

**Fallbacks.** I checked them with the faked baked look.
- These all get the default look: no set, an unknown set, a set baked for another slot only, a tier name as the set,
  and `__proto__`.
- A baked set shows its look, also on a UR piece (UR shows in the tile's ring). The error fallback stays the piece's
  own slot and rarity drawing (`icons.js:180-182`).
- At 22 px it uses the 128 cut (set looks have no small cut).
- `itemArtSVG` of a set key draws the slot, never the "?" (`icons.js:137`).
- Only keys from the frozen manifest reach the markup, so a stray or peer-sent `set` string cannot inject anything.

**Tests.**
- The manifest test accepts a set key only for the six spec ids, and checks that no id is a slot, a tier or `ur`
  (`tests/art/itemArt.test.js:27-31` and `:56-58`). The pipeline refuses such an id too (`catalog.py:225-226`).
- The runtime test uses `spirit`, and keeps the club `tea` as a negative case (`tests/art/itemArtRuntime.test.js:155-175`).
- The new call-site guard test (`:177-185`) has a gap: see R3.

**Docs.** They all say "the piece's gear set id, never the club":
- `icons.js:86-91` and `:175-179`.
- `catalog.py:165-170`.
- `tools/blender/items/README.md:128-133`.
- `docs/MODELS.md:575-578`.
- `CONTRACTS.md:1704` and `:1706` (L6).

### M2: Fixed

`tools/blender/items/models/gear.py:179-184` puts a five-petal sakura blossom (`P.blossom2`, notched petals) behind
the stone, in the rose-gold light tone.

**At 128–256 px** it reads as a blossom crest:
- Round, notched petals show all round the stone. Nothing reads as flippers, a head or a tail.
- The petals are now the lightest trim on the piece, no longer the muddiest.
- It is the item family's own rose gold (compare `book_mythic`'s blossom medallion).

**At 22–32 px** it reads as a pink stone on a rounded, scalloped peach backing, against Legendary's spiky gold star.
- Boundary roughness at 32 px (boundary pixels per √area): Mythic 4.16, Legendary 4.74. r1's Mythic was 4.63, as spiky
  as the Legendary.
- At 22 px: Mythic 3.84, Legendary 4.60.
- So Mythic and Legendary now differ in outline as well as in colour.

Board: charm NEW row (y 282–500), the mythic column (x 624–792) against the legendary one (x 792–960). The 32 px
tiles are at y 450–482.

### L1: Fixed

- Super Rare shoes keep a small two-feather wing (`catalog.py:150` `shoe_wing=2`; `gear.py:417-427`, size 0.72). It
  shows at 32 px (board: shoes NEW, x 456–624).
- The studs (`gear.py:192`) and tail bands (`gear.py:252`) are bigger.
- Common, Rare and Super Rare still read mostly by colour and the tile tint below 48 px, which r1 accepted. Common and
  Rare also share one frame step in the UI (`src/ui/gearTile.js:40`).

### L2: Partly fixed (carried over as R1)

- **Shoes: fixed.** Legendary keeps the white toe cap, with a gold rim behind it (`gear.py:368-372`).
- **Ribbon: still paler than live.** The Legendary inner loops are now in the base tone (`gear.py:260`), but the bow
  stays paler than live: mean lightness 0.649 (r1 0.663, live 0.578). The inner loops were not the main cause: see R1.

### L3: Partly fixed (carried over as R2)

- **Ribbon wings: fixed.** The UR ribbon's wings now fan sideways (`gear.py:246`, 48–124°), so there are no ears.
  Their tips sit at mid-height, clear of the tile's corner stickers.
- **Shoe wing: fixed.** The UR shoe's wing has brighter shadow tones (`gear.py:45-47`). It reads as a pastel rainbow
  (pink, peach, mint, sky), no longer salmon and sage.
- **Still open: the bow shrank.** The UR bow got smaller: see R2.

### L4: Fixed

- `_sparkles` is gone. The remaining 4-point glints sit on the stone (`gear.py:223`) and on the knot or medallion
  (`:286`).
- All 36 files have 0 % light semi-transparent edge pixels, and no glint shows off the piece.

### L5: Fixed

`src/ui/gearUr.js:373` passes `set: g.set`.

### L6: Fixed

`CONTRACTS.md:1704` and `:1706` show the new signatures.

### L7: Fixed

- `GEAR_SHAPES` and `GEAR_MOTIFS` (`catalog.py:123-126`) list only what the bases draw, and `gear_design` refuses
  anything else (`:199-208`).
- The hair clip is a blossom or a heart. Its big crest is a scalloped disc, never a star (`gear.py:454-457`; board
  previews y 1430–1648, legendary and ur).

### L8: Fixed

- The key is `gear_<set>_<slot>` as in spec §3.3: one look per set and slot, with rarity on the tile and the UR ring.
  The 30 looks come to about 0.46 MB, about 2.07 MB in all against the 2.2 MiB cap.
- The parsers read the set-first key: `icons.js:137` and `catalog.py:187-196`.
- The README says a new form is a new base (`README.md:112-115`).

## Findings (this round)

### R1: LOW. The Mythic and Legendary ribbon and shoe bodies read lighter than live (L2 remainder)

Where:
- Code: `tools/blender/items/models/gear.py:62`.
- Files: `gear_ribbon_{mythic,legendary}` and `gear_shoes_{mythic,legendary}`.
- Board: the ribbon NEW and shoes NEW rows, mythic and legendary columns.

`Look` gives every Mythic and Legendary body `glow=0.3`; live gave the glow to the charm's stone only. On the bow and
the sneaker it washes the whole body toward its light tone. Super Rare has no glow, and its body tones match live
(`#9b6afe`, `#8a5df0`).

| Body tone (256 cut, median of a patch) | live | this commit |
|---|---|---|
| Legendary ribbon, outer loop | `#fdb527` (L 0.57) | `#fdc56b` (L 0.71) |
| Legendary ribbon, tail | `#fdae2a` (L 0.58) | `#fac267` (L 0.69) |
| Legendary shoe, upper | `#eea422` (L 0.53) | `#f1b268` (L 0.68) |
| Mythic ribbon, outer loop | `#fe597a` (L 0.67) | `#ff8298` (L 0.75) |
| Mythic shoe, upper | `#ed4c72` (L 0.61) | `#ee798e` (L 0.70) |

At 22–32 px:
- The Legendary bow and sneaker read apricot instead of amber on their cream tiles.
- The Mythic ones read salmon.
- The ladder still reads: the crests and the tile carry it.

Fix: glow the stones only. In `_stone`, paint the stone with `dict(look.body, glow=look.glow)` and keep `self.body`
unglowed. Or drop the glow to about 0.1 on the bow and the sneaker.

### R2: LOW. The UR ribbon's bow is about 19 % smaller than every other ribbon (L3 remainder)

Where:
- Code: `gear.py:246`.
- Files: `gear_ribbon_ur-{256,128}.webp`.
- Board: the ribbon NEW row, ur column (x 960–1128, y 724–942), beside the legendary cell.

The ribbon's width is what binds it in the shared auto-fit: the Legendary bow is 233 px wide but only 186 px tall.
Wings fanned sideways widen the silhouette, so the whole bow shrinks.

A mask match puts the UR bow at 0.81× the Legendary bow (IoU 0.97). In r1, with the wings up, it was 0.91×; live is
1.00×.

So the top tier now has the smallest bow in the ladder, against the branch's own rule that shape grows with rarity. It
still reads as UR, through the rainbow wing tips and the tile's ring.

Fix: keep the wing tips inside the loops' width. Use shorter feathers rooted further in, fanned up and out (about
30–80°), into the free height rather than the width.

### R3: LOW. The call-site guard test misses a call without an options object

Where: `tests/art/itemArtRuntime.test.js:177-185`.

- The test only looks at calls that match `gearIcon\([^)]*\{[^}]*\}\)`, so a call with no `{…}` is never checked.
- Mutation: I put `src/ui/battle/results.js:53` back to its r1 form, `gearIcon(g.slot, g.rarity)`. The test stayed
  green.
- It reads five named files only, so a new gear screen is not checked either.

Today every call site passes the set, so nothing is wrong on screen.

Fix: scan `src/ui/**/*.js`, and require `set: <x>.set` on every `gearIcon(<x>.slot, …)` call (a piece's slot). Allow
only the literal-rarity calls that draw no piece (`unitBuild.js:102`, `backpack.js:331`).

### R4: LOW. The sole stripe's front end shows as a separate fleck at the toe tip

Where:
- Code: `gear.py:360-362`. The stripe runs from t 0.02 to 0.98 at 1.1× the foot width; the sole is 1.08×.
- Files: `gear_shoes_{mythic,legendary,ur}-256.webp`, at about (4–9, 139–148).
- Board: shoes NEW, the toe tip of the mythic, legendary and ur cells.

At the toe the stripe stops under the toe cap. Its front end then pokes out past the outline as a 3×8 px rose, gold or
pearl fleck, with white sole between the fleck and the stripe.
- On the 128 cut it is 1–2 px; at play size it is invisible.
- It is unchanged since r1.

Fix: start the stripe behind the toe cap (t ≈ 0.06), or taper its width to the sole's at the toe.

### R5: LOW. The ladder notes give the shoes a drop bead they don't have

Where:
- `tools/blender/items/README.md:120-125`.
- The generated table rows `gear_shoes_mythic` and `gear_shoes_legendary` (`README.md:244-245`).
- The `GEAR_TIERS` notes (`catalog.py:152-157`).
- The module docstring (`gear.py:14-18`).

They say Mythic and Legendary add a drop bead. But `sneaker()` never calls `_drop` (`gear.py:353-430`), and the shoe
art has no bead.

Fix (docs only): name the slots that get the bead, the charm and the ribbon.

## Notes (no action on this branch)

- **The update's two new slots.** The update adds `hair` and `necklace` through `SLOT_IDS` (`src/data/gearSlots.js`)
  and keeps `types.js` frozen (spec §2.2). Three checks still read `GEAR_SLOTS`:
  - `gearArtKey` (`icons.js:93`);
  - `itemArtSVG` (`:137`);
  - the manifest test's `isSetKey` (`itemArt.test.js:28-31`).

  Until they move to `SLOT_IDS`, a Hair Clip draws as a charm, and a `gear_<set>_hair` look fails the manifest test.
  The spec already lists `src/art/icons.js` among the readers that move. When `gearSets.js` lands, the test's copy of
  `SET_IDS` should switch to it, as its own comment says.
- **Patch note at ship.** It should say the gear icons changed (a rarity ladder in shape and trim). Super Rare shoes
  keep their wing, so r1's request to tell players about a lost wing no longer applies.
- **Sizes and edges.**
  - The folder is 1,607,660 B of the 2,306,867 B cap (69.7 %), +20.4 KB over live.
  - The largest gear cuts are 12,268 B (256 cut, cap 20 KB) and 7,208 B (128 cut, cap 9 KB).
  - Edge contact is the same as live or lower: ribbons and shoes touch column 0 at alpha ≤ 15, the charms' top row at
    alpha 3.
  - No preview key (hair, necklace, `sample`) reached `public/` or the manifest.
- **Rules.**
  - No other games' or anime names in the diff or the commit messages (I searched both).
  - The content is wholesome: charms, bows and sneakers.
  - No third-party images: under `public/`, only the 36 re-baked gear WebPs changed.
  - No secrets. Display only.

## Verdict

**OK.** No BLOCKER, HIGH or MEDIUM.
- M1 and M2 are fixed.
- L1 and L4 to L8 are fixed.
- L2 and L3 are partly fixed, and carry over as LOWs R1 and R2. There are three new LOWs, R3 to R5.

All five LOWs are at the builder's discretion. R1, R2 and R4 need a re-bake, so they fit best with the first set-look
bake. Any later change for them goes through the review gate as usual.
