# Gear icons: independent review, round 1

Reviewed: `feature/gear-icons` at `19819832` (one commit on `origin/main` `60ce9cad`, v0.1.61), Oct 30, 2026.
Reviewer: an agent that did not build it (art judge and code reviewer, HANDOFF §6 review gate).

**Verdict: NOT OK**, because of two MEDIUM findings: M1 (set looks keyed by the club) and M2 (the Mythic charm reads
as a turtle). The art is otherwise close: style, framing and edges match the item set, and UR reads as the top tier on
all three slots.

## What I checked

- **Boards.**
  - The full board `/tmp/gear-icons/gear-board.png` (1242×9304). Rows are 190 px from y=92: charm rows 0–5, ribbon
    6–11, shoes 12–17, the preview section after y≈3512. Columns: current SVG x 180–360, live x 360–540, NEW
    x 540–720, the tiles from x 750 (NEW tiles x 1077–1242).
  - The compact live-vs-new grid (`gear-icons-live-vs-new.png` in the session scratchpad).
- **The 36 committed WebPs.** I opened them directly and measured them with Pillow: canvas, alpha bounding box,
  edge contact, light fringes and tone, each against the live files from `origin/main`. I zoomed in 4–7× on white,
  dark and checkerboard backgrounds, and drew play-size strips (64/48/32/22 px) on tier plates.
- **Code.**
  - The diff of `src/art/icons.js`, `src/art/itemArt.js`, the five call sites, `tests/art/*` and
    `tools/blender/items/{catalog.py, build_items.py, models/gear.py, README.md}`.
  - `docs/MODELS.md` and `CONTRACTS.md`.
  - The gear update spec `docs/specs/GEAR_UPDATE.md` on `origin/spec/gear-update` (`7b93dfc3`).
- **Tests and sim.**
  - Tests, run with `nice`: `tests/art` plus `tests/ui/{gearTile,gearView,unitBuild,girlDetail}.test.js`. 8 files,
    67/67 pass.
  - Sim id `be940ecb2087` (unchanged) and `COOP_PROTOCOL` 13. No file under `src/sim`, `src/online`, `src/data` or
    `src/systems` changed.
- **No re-bake.** This container has no Blender module and the machine ran at load ~17 on 4 cores. The committed file
  sizes match the builder's final bake log, and its bake report passes the framing check on every key.

## What is good

- **Same look as the items.** The rig, light, ink and poses are the items' own: the pose dicts are unchanged from
  `main`, and `rig.py`, `post.py` and `palette.py` are untouched.
- **Framing matches the item set.** Max-side fill is 0.89–0.91 with 3–4 px margins; the other items have a median
  fill of 0.90 and a 3 px margin. The ribbons and shoes touch the left edge only with alpha ≤ 15, the same as live
  (column 0 is byte-identical).
- **Clean edges.**
  - The 128 cuts are cleanly anti-aliased.
  - Light semi-transparent edge pixels: 0 % on every key below UR. On UR they are 8–9 %, from the sparkles and the
    pearl parts, which is within the approved items' range (the kindred tickets are at 10 %).
  - Outline weights follow the item rules: about 2.5 px on the bodies, thinner on feathers, studs and gems.
- **The ladder works from Mythic up, at every size.** Mythic adds a crest (charm), layered loops (ribbon), or small
  wings and a sole stripe (shoes). Legendary adds a sunburst, a star medallion and a gold bumper. UR shows its rainbow
  feathers down to 22 px, and the UR charm and ribbon read much richer than live's recolour.
- **Size caps hold.**
  - The largest 256 cut is 14,364 B (cap 20 KB) and the largest 128 cut 8,358 B (cap 9 KB).
  - The folder totals 1,613,222 B of the 2.2 MiB cap (70 %), +25.9 KB over live.
- **Code.**
  - Without `set`, `gearArtKey` and `gearIcon` return exactly the old keys.
  - With an unbaked or unknown set they fall back to the default look.
  - A baked set key keeps the slot's drawn tier SVG as its error fallback (the `itemArtSVG` regex).
  - Tests cover all three cases. Set keys only come from the frozen manifest, so nothing typed by a player reaches
    the markup.
- **Rules.** No other games' or anime names in the diff, the commit or the boards. The content is wholesome
  (accessories and sneakers). No third-party images, no secrets. Display only.

## Findings

### M1 — MEDIUM — Set looks are keyed by the club; they should be keyed by the gear set id

Where:
- The call sites pass `set: g.club`: `src/ui/battle/results.js:53`, `src/ui/gearTile.js:114`, `src/ui/gearUr.js:92`,
  `src/ui/screens/stage.js:244`, `src/ui/unitBuild.js:107` (its model, `:43`, carries only `club`).
- The docs say "the piece's club id": `src/art/icons.js:86-90` and `:173-176`, `tools/blender/items/catalog.py:149`,
  `tools/blender/items/README.md:126`, `docs/MODELS.md:577`.
- `tests/art/itemArt.test.js:26-30` accepts a set key only when its last part is in `CLUBS`.
- `tests/art/itemArtRuntime.test.js:157` tries `tea`.

The gear update (spec §3.1, §3.3, §3.5) makes sets and clubs two independent layers that stack:
- **Sets.** A piece has at most one **set**. It is fixed from the piece's source and survives awakening, Limit Break,
  rerolls and pins. The ids live in a new `src/data/gearSets.js` `SET_IDS`: `spirit`, `freezetag`, `geometry`,
  `popper`, `treasurer`, `powerbank`. Today's pieces are "No set" (no `set` field).
- **Clubs.** A piece has at most one **club** (Mythic+), and a Club Armband can re-tag it at any time. A club already
  has its own picture, its emblem in the tile corner (`gearTile.js` `k-club`), and keeps it in the update ("a club
  chip shows the club emblem in the club colour").
- **Custom designs.** "New gear sets with custom designs" (owner, Oct 30) are the five-piece sets: §3.3 gives each set
  its own five piece designs.

Keyed by club:
1. A piece's picture would change every time an armband re-tags it.
2. A club look would repeat the emblem that the tile already shows.
3. The update's set looks would never be found, and the manifest test would reject them (`CLUBS.spirit` is undefined).
4. Club pieces are Mythic and Legendary only, so the Common to Super Rare club bakes would never be shown.

Nothing changes on screen today (no set look is baked; `sample` is preview only), so it is cheap to fix now.

**Fix (the right hook):**
1. **Call sites.** Every call site passes the piece's own set: `{ set: g.set }`, plus the UR reveal (L5). Today no
   piece has `set`, so every screen keeps the default look until the update adds the field. Add `set: g.set || null`
   next to `club` in `unitBuild.js:43`.
2. **Docs.** `gearArtKey`/`gearIcon`, `catalog.py:149`, `README.md:126`, `docs/MODELS.md:577` and `CONTRACTS.md` (L6)
   should all say: "`set` = the piece's gear set id (`SET_IDS` in `src/data/gearSets.js`; absent = No set), never the
   club".
3. **Manifest test.** Check set keys against the set ids, not `CLUBS`. Until `gearSets.js` exists, use the non-preview
   rows of `catalog.GEAR_SETS` (or a short list copied from the spec); after that, use `SET_IDS`. Keep set ids
   `[a-z0-9]+` and never equal to a tier name (`ur`, `rare`…), so `itemArtSVG` and `catalog.gear_parse` stay
   unambiguous.
4. **Runtime test.** Use a set id, not `tea`, in the set test.

The key format and tier policy also have to match the spec before the first set look is baked: see L8.

### M2 — MEDIUM — The Mythic charm's petal crest reads as a turtle, and as a spiky star at play size

Where:
- Code: `tools/blender/items/models/gear.py:183-188` (crest 1 on the pendant), `catalog.py:141`.
- Files: `public/art/items/gear_charm_mythic-{256,128}.webp`.
- Boards: full board row 3 (y 662–852), NEW 256 and NEW tiles; compact grid, NEW half, charm row, mythic column.

At 128–256 px the crest reads as a turtle seen from above:
- Four short, fat, copper-brown leaves stick out of the diamond's four sides, like flippers.
- The bail ring on top reads as a head and the drop bead below as a tail.
- The rose-gold leaves are the muddiest, darkest part of the icon.

At 22–32 px it becomes a spiky pink star, the same "spiky blob" outline as the Legendary sunburst. So Mythic to
Legendary relies on colour alone at play size, against the branch's own aim that shape grows with rarity. The
necklace's Mythic preview (heart plus the same leaves, board y≈5314–5504) reads as a beetle for the same reason.

MEDIUM because:
- It is a shipped key.
- Mythic is one of the two club tiers, so this charm is among the gear pictures players see most.
- The point of this change is a ladder that reads by tier.

**Fix:** make the crest read as petals, not limbs:
- Option 1: five small sakura petals fanned behind the top half of the stone (the game's own motif).
- Option 2: a slim laurel along the lower half only: 3–4 narrow leaves per side, curving up toward the bail.

In either case:
- Paint it in the rose-gold light tone rather than the copper base.
- Keep its 22 px outline clearly different from Legendary's eight-ray sunburst.
- Check it again on the compact grid and at 22/32 px.

### L1 — LOW — The lower tiers differ only in colour below 48 px; Super Rare shoes lost the wing they had live

Where: `catalog.py:137-140`; board rows 1–2, 7–8 and 13–14 (tiles); compact grid, shoes, superRare.

At 22–32 px the bail cap, studs, tail bands, eyelets and small gems are smaller than a pixel. So Common, Rare and
Super Rare are a recolour on all three slots; the tile tint still separates them, as before.

Live Super Rare shoes (v0.1.46–v0.1.61) had a small wing. Wings now start at Mythic, so Super Rare shoes read as
violet Rare shoes at every size up to 64 px. Players will see this change on pieces they already own: say so in the
patch note, or keep one feather on Super Rare shoes.

### L2 — LOW — Legendary reads paler than live on its gold tile at 22–32 px

Where: board rows 10 and 16; compact grid, legendary column.

- **Ribbon.** The light-tone inner loops (`models/gear.py:264-267`) raise the bow's mean lightness from 0.57 to 0.65
  (saturation unchanged). The Legendary bow reads butter-yellow on a cream tile.
- **Shoes.** The solid gold toe bumper (`gear.py:374`) replaces the white toe cap. The sneaker loses its white/amber
  contrast and reads as a yellow slipper at 22 px.

Suggestions: paint the inner loops in the base tone at Legendary; give the shoe a white toe with a gold rim instead
of a gold cap.

### L3 — LOW — The UR ribbon's wings stand up like ears; the UR shoe's wing is muted

Where: board rows 11 and 17; compact grid, ur column.

- **Ribbon** (`gear.py:249-251`, spread 8–70°). The feathers stand straight up behind the loops, so the auto-fit
  shrinks the bow by about 7 % against the other tiers. At 22–32 px they read as small spikes or ears, and in the CSS
  gear tile (icon at 78 %, corner stickers at −5 px) their tips reach the top corners where the stickers sit.
  Spreading them sideways, like the charm's wings, would keep the bow's size.
- **Shoes** (`gear.py:419-429`). The fan faces away from the key light, so the feathers sit mostly in their cel
  shadow. The "gold" feather reads salmon and the "mint" one sage (saturation 0.23–0.28), making it the dullest of the
  three UR wings. Brighten the shadow tone or turn the fan toward the light.

### L4 — LOW — The UR sparkles float in empty space

Where: `gear.py:129-131`, called at `:228`, `:292` and `:432`.

The two 7 px glints are placed outside the silhouette and not snapped to it (`edge=True`). On the near-white UR plate
only their cool-grey rim shows. At 128–256 px they read as specks of dust: on the charm at top right and bottom left,
on the ribbon at the left, on the shoe at the top and by the toe. Below 48 px they disappear. The pipeline's own rule
is that a glint never floats beside the object (`tools/blender/items/README.md:73-75`). Drop them, or snap them onto
the wings with `edge=True`.

### L5 — LOW — The UR awakening reveal does not pass the set

`src/ui/gearUr.js:373` (`showGearAscension`) draws `gearIcon(g.slot, 'legendary', { ur: true, px: 104 })`. Once a set
has a UR look, the "Awakened to UR!" card would show the default UR art while the piece's own card shows its set's
art. Pass `set: g.set` as part of M1.

### L6 — LOW — CONTRACTS.md still lists the old signatures

`CONTRACTS.md:1704` still reads `gearIcon(slot, rarity, { ur = false, px = 64 } = {})`, and `:1706` reads
`gearArtKey(slot, rarity, { ur })`. Add `set`, the set id after M1.

### L7 — LOW — The catalog lists shapes and motifs the models don't draw; two hair-clip options break the spec

`catalog.py:113-115` lists three options that the models don't handle:

| Option | What happens | Where |
|---|---|---|
| Pendant/necklace shape `drop` | silently draws the diamond | `gear.py:94-104` |
| Motif `note` | `_motif2` returns None, so no emblem is drawn | `gear.py:82-91` |
| Hair-clip shape `bow` | `None` reaches `P.slab`, so the bake fails | `gear.py:462` and `:465` |

The spec also forbids two of the hair-clip options:
- A bow on the hair piece (§2.1: "never a ribbon or a bow").
- Any star or snowflake hair clip (§3.3: those are Hikari's, Ruri's and Yuki's own looks).

Yet the catalog offers `star` and `bow`, and the Legendary and UR hair-clip previews put an eight-point star behind
the flower (board y≈4364–4744). This is preview only: trim the lists to what is drawn and allowed.

### L8 — LOW — Set-look keys and tiers disagree with the spec and the size budget

**Key format.** Spec §3.3 asks this track for `gear_<set>_<slot>`: 30 designs, with rarity on the tile. This branch
builds `gear_<slot>_<tier>_<set>` with all six tiers per set (`catalog.py:194-201`). Set pieces only exist from Super
Rare up (§3.1), so the Common and Rare set keys would never be shown.

**Budget.** Today a gear key averages 15.2 KB (256 + 128 cuts). The folder holds 1.61 MB of the 2.2 MiB cap.

| Set looks for six sets × 5 slots | Keys | Added | Folder total |
|---|---|---|---|
| All six tiers | 180 | ≈ 2.7 MB | ≈ 4.3 MB (alone over the cap) |
| Super Rare to UR only | 120 | ≈ 1.8 MB | ≈ 3.4 MB (over the cap) |
| One look per set and slot | 30 | ≈ 0.46 MB | ≈ 2.07 MB (90 % of the cap) |

**Designs.** `GEAR_SETS` can re-skin today's five bases (shape, motif, colour). But the spec's designs (Pom-Pom
Keyring, Abacus Bracelet, Compass Keyring, the loafers, Tag Timer…) need new base models. So "gear changes are rows,
not code" (`README.md:113`) over-promises: new bases are code.

**Recommendation.**
1. Use one look per set and slot, keyed slot-first as `gear_<slot>_<set>`, and show rarity with the tile and the UR
   ring. Slot-first because the parsers in `icons.js` and `catalog.gear_parse` read the slot first; with the spec's
   `gear_<set>_<slot>`, an image error would draw the "?" fallback.
2. Alternatively, bake per-tier looks only for `SET_RARITIES` + UR, and get the owner's yes to a bigger cap.
3. If both forms are wanted, `gearArtKey` tries `gear_<slot>_<tier>_<set>`, then `gear_<slot>_<set>`, then the
   default look.
4. Either way, `gear_rows` skips the tiers a set cannot have.
5. The spec's §3.3 line and this branch must agree before the first set look is baked. The spec's "rarity lives in
   the tile, not the art, per README" is now out of date for default gear.

## Q3: club or set id, and the right hook

Key the look by the **gear set id** (`g.set`, an id from `SET_IDS` in the coming `src/data/gearSets.js`), not the
club:
- A set is fixed per piece and carries the custom designs.
- A club changes with every armband and already shows as its emblem.

The hook:
- `gearArtKey(slot, rarity, { ur, set })` and `gearIcon(…, { set })` keep their shape.
- Every gear screen passes `set: g.set`, including the UR reveal at `gearUr.js:373`.
- Today `set` is undefined everywhere, so nothing changes.
- When the update adds `set` to pieces and bakes the looks, they appear with no UI change.
- The manifest test checks set keys against the set ids.
- The key format follows L8.

## Notes (no action)

- The board's tiles come from the pipeline's PIL tile (`post.tile`), not a browser screenshot. The CSS gear tile is
  covered under L3.
- The patch note at ship should say the gear icons changed, including the Super Rare shoe's wing (L1). This branch
  has no patch note yet, which is expected at the release merge.

## Verdict

**NOT OK.** Fix M1 and M2, then a fresh reviewer re-checks them. Fixing M1 naturally covers L5 and L6. The other LOWs
are at the builder's discretion; L2–L4 can ride along with M2, since they need the same re-bake.
