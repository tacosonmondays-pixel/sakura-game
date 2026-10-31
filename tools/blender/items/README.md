# Item art pipeline (3D-flat icons)

One-line usage (one Blender at a time, below-normal priority):

```
blender --background --factory-startup --python-use-system-env --python tools/blender/items/build_items.py -- [keys ...] [--family books]
```

It bakes every item icon the game draws (every item id, `gear_<slot>_<rarity>` / `gear_<slot>_ur` for the five slots,
the gear sets' looks `gear_<set>_<slot>` and `recruitPoints`: 141 keys; `tests/art/itemArtGuard.test.js` fails on any
item or gear key the game can show without one) in the approved "3D-flat" look: chunky rounded toy objects in one shared 3/4 view, lit
from the top left, base + light + one cel shadow, tinted (never black) ink, a soft navy contact shadow, no text.
Rarity lives in the tile, not in the art (gear is the exception: its shape and trim grow with rarity, see "Gear").

Outputs (all committed, so CI never needs Blender):
- `public/art/items/<key>-256.webp` (big views) and `<key>-128.webp` (tiles); `<key>-small.webp` (96 px, heavier
  line) for the keys in `models.SMALL_CUT` that show at 24 CSS px or less.
- `src/art/itemArt.js`: the manifest (`ITEM_ART`, `ITEM_ART_SMALL`: key → 8-char content hash), rewritten from the
  files in `public/art/items/` after every run.
- Scratch, never in the repo (`--scratch`, default `$TEMP/item-art`): raw renders, PNG copies, `report.json`,
  one contact sheet per family and, with `--compare <dir of approved <key>_256.webp>`, an approved-vs-new grid.
  A sheet row is the 256 view, then the approved tile (#108) at 80 / 62 / 48 px with an `x450K` count and at
  32 / 22 px without one, then 62 px at DPR 2. The tile is the landscape plate (1.09:1) slanted −8°, a 1 px tier
  border and white inner rim, the tier tint fading to white, our sheen (faint sakura petals and one diagonal
  band), the art centred at 47 % / 46 % filling about 82 % of the height, and the count (heavy italic navy,
  white outline, 13 px on the 62 px tile) overlapping the lower right. The game draws the real tile in CSS
  (`itemTile` in `src/ui/components.js`, `base.css` "Items"); `itemIcon` / `gearIcon` / `currencyIcon` read the
  manifest (`docs/MODELS.md`, "Item icons").

## Setup

- Blender 5.2 (EEVEE) headless, as above. Pillow must be importable: install it once into a folder outside
  Blender and pass it with `--pylibs <dir>` (or `ITEMS_PYLIBS`), or run with `--python-use-system-env` and
  `PYTHONPATH`. The `bpy` module of `tools/blender/requirements.txt` also works: `python3 tools/blender/items/build_items.py`.
- Node on PATH (or `--node` / `NODE`): `dump_items.mjs` reads the keys from `src/data`. `--items items.json`
  skips node.
- Never Cycles. EEVEE at 256 px with 32 samples takes about 1-2 s per key; all 100 keys take 2-5 minutes.

## Commands

```
... build_items.py --                                   # all 100 keys, manifest, one sheet per family
... build_items.py -- book_mythic coins                 # just these (other files and manifest entries stay)
... build_items.py -- --family materials                # a family: books, currency, tickets, materials, mat_rime
                                                        #   (any mat_<family>), boxes, crowns, fragments, tools, gear
... build_items.py -- energy --compare <approved dir>   # calibration-only key (approved, not a game item): scratch only
... build_items.py -- crown_rainbow --approved <dir>    # a shipped key (models.SHIPPED): copies <dir>/<key>_256.webp
                                                        #   as <key>-256.webp byte for byte, downscales the 128 cut
                                                        #   (no Blender needed: python3 build_items.py works too)
... build_items.py -- crown_rainbow --no-ship           # bake a shipped key's model instead (trials, with --out)
python3 tools/blender/items/build_items.py --table      # rewrite the data table below from catalog.py (no Blender)
python3 tools/blender/items/build_items.py --list       # keys and families
```

## How a key is drawn

- `rig.py`: one orthographic camera looking along +Y; the key light is fixed in camera space (upper left, toward
  the viewer). Two shared materials for everything: an emission-only toon shader (cel steps from N·L, a deep step
  for facets, rim light on grazing shadow edges, specular for metal and gloss, diagonal sheen bands, a small
  screen-space drift, iridescence, inner glow, printed stripes) and the ink. Each part carries its colours and
  amounts as object custom properties (`toon_*`, `ink_col`) read by Attribute nodes, so EEVEE compiles two shaders.
  Iridescent parts (UR, zenith, rainbow) set an anchor (`toon_fx4`) that keeps a saturated lilac shadow plane and
  part of their own base under the pastel ramp, so the premium tier holds the same value range as the others on a
  white tile. On flat items `shadow_rel` / `light_rel` place a part's cel steps relative to the face's own N·L
  (a feather's far vane half or a blade's far plane goes to shadow, its near plane to light).
- Ink is an inverted hull per part, pushed out by the line width in output pixels (2 px lit side, about 3 px
  shadow side at the default 2.5 px); overlapping parts give the inner lines; `lift` brings the hull of thin raised
  motifs forward.
- Poses: `standing` (boxes, crowns, crystals: seen from above-front-right) and `flat` (books, coins, tickets: the
  face turned a little left and leaning back so the thickness shows on the right and bottom, rolled in plane). A
  flat item's light step and specular threshold sit just above its face's own N·L / N·H, so the face reads as the
  base tone and only bevels and rims catch the light.
- Auto-fit: the silhouette lands centred at (119, 117.5) px inside about 228 x 226 px (the approved framing).
- `post.py`: 4-point glints (drawn at model anchors; `glint(..., edge=True)` snaps the sparkle onto the rendered
  silhouette, 3 px inside the lit edge, and gives it the approved thin cool-grey rim, so it never floats beside
  the object; on the runes, embers and feathers one glint at most, on a metal or crystal part, never on the matte
  stone or vane (ITEM_STYLE 2.5)), the contact shadow (silhouette offset (+1, +5) px,
  blurred, navy `#263a5c` at 32% core), framing check, Lanczos downscale (premultiplied), WebP q88 / alpha 100,
  size caps (20 KB / 9 KB / 5 KB, 2.2 MB in all; `tests/art/itemArt.test.js` enforces them), sheets, manifest.
- `parts.py`: outlines (rounded rect, sakura, star, heart, gear, crescent, flame, leaf), solids (bevelled slab,
  rounded box, lathe with hard edges, sweep, torus, faceted fan gem with ridges or a spine, cut gem, cabochon,
  crystal prism, round cone, convex hull with rounded edges for cut stones and dice, `ring_slab` for a slab with a
  real hole, `hollow_top` for a box with an opening, `cut` for an angled break, `face_plate` for a lighter break
  face with its own fine line on a cut, `arc_band` for a curved slice of a ring swept from the band's own profile),
  `on_surface` / `hit` (ray casts that lay gems and claws onto a part) and `strip` / `lens2` (flat decals projected
  onto a part: tapered fissures, glint strips and reflection bands). `palette.py`: the tone rule (light +L toward yellow,
  shadow -L toward magenta, ink L 25%), the trim ladder (silver, rose gold, gold, iridescent), shared materials
  and `anchored()` for UR and zenith parts.
- `models/<family>.py`: one module per family, `build(row) -> dict(kind=..., roll=...)`. `catalog.py`: the table below.
- Shipped keys (`models.SHIPPED`, PLAN C11): an approved icon whose rebuild still missed after two rounds ships the
  approved file itself (our art). Today that is `crown_rainbow` (the rebuild lost the iridescent band and read as a
  plain lilac crown). Its `-256.webp` is the approved file byte for byte, and `post.ship` downscales the `-128.webp`
  from it the same way as every other key. The source is `--approved <dir>/<key>_256.webp` (or `ITEMS_APPROVED`).
  Without it, a run keeps the committed `-256.webp` and only re-cuts the 128, so a full re-bake never puts the
  model back. `--no-ship` bakes the model (keep that for trials with `--out`).
- Family rules (items; gear has its own ladder, see "Gear" below): each family keeps one silhouette through every tier (charm = an omamori, rune = an arched,
  chipped runestone with a thick side plane, never a book-like rectangle, its trim a thin inlay and never a frame,
  ember = one coal with one tapered fissure cut into it, cog = a gear, feather, blade, rime crystals, crowns with
  round cone points). Stone (runes, the coal) and feather vanes are matte: no sheen and no specular. The round disc is for
  currencies and tokens only. Accents follow the tier palette: rare blue or silver, super rare a violet gem,
  mythic rose gold, legendary gold, UR / zenith iridescent with a saturated shadow plane. Surfaces stay clean
  cel bands (big flat facets or smooth forms, never noise or bumps), and no emblem may read as a letter.

## Adding or changing an item

1. Add the id in `src/data` as usual; `dump_items.mjs` picks it up.
2. Give it a builder in the family module (reuse a base model; a tier is usually a paint swap plus one trim step)
   and a line in `catalog.py`.
3. Run it alone with `--compare` or look at its family sheet; then commit the WebPs and `src/art/itemArt.js`.

## Gear (gearIcon)

Gear is drawn from three tables in `catalog.py`; `models/gear.py` holds the base models (`BASES`: pendant, bow,
sneaker, hairclip, necklace) and reads the rows. A new slot on an existing base, a ladder tweak or a set look that
re-skins a base is a row; a design that needs a new form (a keyring, a bracelet, loafers) is a new base in
`models/gear.py` first. `catalog.gear_design` refuses a shape or motif its base does not draw.

- `GEAR_SLOT_ART`: one row per slot (`src/data/types.js` `GEAR_SLOTS`) naming its base and default design (`shape`,
  `motif`, `body`, `trim`). A row whose slot the game does not have yet is a preview: today `hair` (the Hair Clip: a
  bar clip with a sakura ornament; never a bow, a star or a snowflake) and `necklace` (a heart on a chain loop). Both
  are game slots since the gear update (`src/data/gearSlots.js` `SLOT_IDS`), baked at every rarity and UR.
- `GEAR_TIERS`: the rarity ladder of the default looks; rarity reads from the shape and the trim, not the colour
  alone. Common: plain, pewter. Rare: silver (the charm's bail cap). Super rare: silver, ball studs (shoes: eyelets,
  ribbon: tail bands), a violet gem, and a small wing on the shoes. Mythic: rose gold, the first crest (charm: a
  rose-gold sakura blossom behind the stone, ribbon: layered loops, shoes: a sole stripe and a bigger wing), a drop
  bead (not on the shoes), a glow. Legendary: gold, the big crest (charm: sunburst rays, ribbon: a star medallion, shoes: a gold rim
  round the white toe cap and a big wing), a star glint. UR: iridescent with a saturated shadow, the big crest (the
  charm swaps its rays for the wings) plus rainbow wings (one pastel per feather: pink, gold, mint, sky). No glint
  floats beside the piece. The `set` row is the ladder of the set looks.
- `GEAR_SETS`: one look per gear set and slot, `gear_<set>_<slot>` (the gear update spec 3.3: 6 sets x 5 slots, about
  0.46 MB in all), with rarity on the tile and the UR ring. The set id is the piece's own `set` (`SET_IDS` in the
  update's `src/data/gearSets.js`), never its club: a set is fixed per piece, a club is re-tagged by the armband and
  already shows as its tile emblem. Set ids are `[a-z0-9]+` and never a slot or tier name. A row overrides any design
  field per slot; `gearIcon(slot, rarity, { set: g.set })` shows it and falls back to the default look while a set
  has no art. `preview=True` bakes to the scratch folder only (`sample` is one). A set row bakes only the slots it
  lists: today the six sets draw their Hair Clip (pom, pause button, set square, confetti star, calculator, lightning
  bolt on the bar clip) and Necklace (heart with a megaphone, stopwatch, crosshair locket, party popper, sakura coin,
  battery), in the set colour with white and gold trim; their Charm, Ribbon and Shoes keep the default looks.
- Set Boxes (`setbox_<set>_<mythic|legendary>`, `models/boxes.py`): the gear box in the set colour with the set's crest
  (the pick box: pearl, a ring of the six set colours). Tie Pin, Collar Pin and Nightglass Lens are in `models/tools.py`.

```
... build_items.py -- --family gear                     # the game's gear keys (+ the set looks of GEAR_SETS)
... build_items.py -- --family gear-preview             # the preview slots and preview sets, scratch only
```

Visual targets are our own approved icons only (kept outside the repo, except a shipped key's output in
`public/art/items`); never third-party images.

## Data table

<!-- table:start -->
| Key | Name | Family | Tier | Files | Model |
|---|---|---|---|---|---|
| `book_common` | Doodle Notes | books | common | 256, 128 | kraft spiral notebook, pencil, pink star sticker, label with two blue lines (appr.) |
| `book_rare` | Study Guide | books | rare | 256, 128 | blue hardcover, 2 silver corner guards, white label with a sakura, red ribbon (appr.) |
| `book_superRare` | Academy Textbook | books | superRare | 256, 128 | violet hardcover, 4 silver guards, silver medallion with a blossom and a violet gem, ring clasp (appr.) |
| `book_mythic` | Sage's Codex | books | mythic | 256, 128 | rose hardcover, rose-gold guards, rose-gold blossom medallion with a glowing pink core, clasp strap |
| `book_legendary` | Akashic Tome | books | legendary | 256, 128 | teal hardcover, gold L-guards, gold sunburst medallion with a big cut gem and a star, gold strap with a stud (appr.) |
| `mat_feather_common` | Sparrow Feather | materials | common | 256, 128 | curved brown sparrow feather: two vane halves (the far one in shadow), split barbs, cream quill |
| `mat_feather_rare` | Swallow Plume | materials | rare | 256, 128 | sleek sky-blue plume, split barbs, silver quill cap |
| `mat_feather_superRare` | Hawk Quill | materials | superRare | 256, 128 | violet barred quill, split barbs, silver cap with a violet gem |
| `mat_feather_mythic` | Phoenix Plume | materials | mythic | 256, 128 | red-orange plume with a cel-banded flame edge (yellow, orange) along its tip, rose-gold band, glowing shaft |
| `mat_feather_legendary` | Celestial Pinion | materials | legendary | 256, 128 | pearl plume with a deep-gold edge, gold cap with a star glint (none on the vane) |
| `mat_feather_zenith` | Zenith Plume | materials | zenith | 256, 128 | lilac-pearl plume (saturated shadow half), iridescent edge and cap, glint on the cap |
| `mat_blade_common` | Chipped Edge Shard | materials | common | 256, 128 | steel shard with a notch: central ridge (lit left plane, shadow right plane), white glint strip on the lit plane, dark band on the shadow plane |
| `mat_blade_rare` | Tempered Shard | materials | rare | 256, 128 | blue-steel shard, ridge, glint and dark band, silver collar and grip |
| `mat_blade_superRare` | Moonsteel Fragment | materials | superRare | 256, 128 | violet moonsteel shard with a crescent gem, silver collar |
| `mat_blade_mythic` | Crimson Katana Shard | materials | mythic | 256, 128 | rose-steel shard (one colour on both planes), rose-gold collar |
| `mat_blade_legendary` | Starforged Edge | materials | legendary | 256, 128 | gold-steel blade, gold guard, gem, star |
| `mat_blade_zenith` | Zenith Edge | materials | zenith | 256, 128 | lilac-pearl blade (saturated shadow plane), iridescent guard |
| `mat_ember_common` | Warm Cinder | materials | common | 256, 128 | chunky warm-grey coal (clean facets, matte) with a glowing fissure cut in: sharp at both ends, widest in the middle, yellow core, orange edge, a darker rock lip below; one crack per tier |
| `mat_ember_rare` | Glowing Ember | materials | rare | 256, 128 | the coal with its crack and a small flame lick (blue core) |
| `mat_ember_superRare` | Blazing Coal | materials | superRare | 256, 128 | the coal with a flame crown and an inset violet gem |
| `mat_ember_mythic` | Phoenix Ember | materials | mythic | 256, 128 | the coal in a rose-gold setting (waist band, four claws), rose flame |
| `mat_ember_legendary` | Sunheart Core | materials | legendary | 256, 128 | the coal and flame before a gold sun frame (ring and rays), inset gem, star glint on the ring |
| `mat_ember_zenith` | Zenith Flame | materials | zenith | 256, 128 | lilac mid-tone coal (near-white only on the lit top facet, violet shadow planes), pink flame round a saturated orange core, iridescent sun frame with a glint |
| `mat_rime_common` | Frost Pebble | materials | common | 256, 128 | three ice prisms on a snow-capped stone (appr.) |
| `mat_rime_rare` | Rime Shard | materials | rare | 256, 128 | feathery ice-blue crystal spray on a snow puff, silver frost ring |
| `mat_rime_superRare` | Glacier Prism | materials | superRare | 256, 128 | lavender crystal cluster on a snow puddle (appr.) |
| `mat_rime_mythic` | Aurora Crystal | materials | mythic | 256, 128 | mint-to-violet crystal cluster on a rose-gold ring, inner glow |
| `mat_rime_legendary` | Eternal Winter Heart | materials | legendary | 256, 128 | big faceted ice heart in a slim gold band over a six-armed snowflake (broad flat arms in light gold with a darker lower edge, a V of two branches each, soft points), star (appr.) |
| `mat_rime_zenith` | Zenith Frost | materials | zenith | 256, 128 | lilac heart in a slim iridescent band over the iridescent snowflake (deeper lilac arms, violet lower edge) |
| `mat_charm_common` | Paper Omamori | materials | common | 256, 128 | paper omamori pouch, red cord knot, red stamped sakura |
| `mat_charm_rare` | Silk Omamori | materials | rare | 256, 128 | blue silk omamori, embroidered white sakura, silver cord ring |
| `mat_charm_superRare` | Blessed Bell Charm | materials | superRare | 256, 128 | violet omamori with a silver hand bell (dome, lip, clapper) and a gem knot |
| `mat_charm_mythic` | Shrine Guardian Talisman | materials | mythic | 256, 128 | rose-red lacquered tag, rose-gold cap, glowing sakura inlay |
| `mat_charm_legendary` | Sakura Divine Seal | materials | legendary | 256, 128 | cream silk omamori with gold trim, band and cord, pink sakura with an inset gem, star |
| `mat_charm_zenith` | Zenith Omamori | materials | zenith | 256, 128 | iridescent silk omamori with iridescent trim, sakura with an inset gem |
| `mat_rune_common` | Chalk Rune | materials | common | 256, 128 | slate runestone (arched, chipped outline, thick side plane, matte) with a chalk compass star in a carved groove |
| `mat_rune_rare` | Inked Rune | materials | rare | 256, 128 | cream runestone with a thin silver inlay, glowing blue compass star in a carved groove |
| `mat_rune_superRare` | Carved Runestone | materials | superRare | 256, 128 | lavender runestone, glowing compass star round an inset violet gem |
| `mat_rune_mythic` | Astral Glyph | materials | mythic | 256, 128 | violet runestone with a thin rose-gold inlay, glowing rose-gold compass star round a pink gem |
| `mat_rune_legendary` | Primordial Sigil | materials | legendary | 256, 128 | violet runestone with a gold inlay, glowing gold compass star with a gem, star glint on the inlay |
| `mat_rune_zenith` | Zenith Sigil | materials | zenith | 256, 128 | lilac-pearl runestone (saturated lilac side plane) with an iridescent inlay, deep violet compass star with a gem |
| `mat_cog_common` | Brass Cog | materials | common | 256, 128 | warm brass cog with one bent tooth, a real axle hole (inner wall), a glint strip on the lit upper-left edge of the teeth and rim, a dark reflection band on the lower-right teeth |
| `mat_cog_rare` | Steel Gear | materials | rare | 256, 128 | blue-steel gear with a silver axle hub |
| `mat_cog_superRare` | Clockwork Spring | materials | superRare | 256, 128 | steel coil spring on a steel gear base, violet end caps |
| `mat_cog_mythic` | Aether Mainspring | materials | mythic | 256, 128 | glowing aqua mainspring in a rose-gold gear housing |
| `mat_cog_legendary` | Perpetual Engine Core | materials | legendary | 256, 128 | gold gear around a glowing cut-gem core, star |
| `mat_cog_zenith` | Zenith Cog | materials | zenith | 256, 128 | lilac-pearl gear, iridescent core |
| `crown_slime` | Jelly Crown | crowns | rare | 256, 128 | glossy green jelly crown, round cone points, silver ball finials, jelly drips |
| `crown_iron` | Iron Warlord Crown | crowns | superRare | 256, 128 | steel crown, round cone points, rivets, an inset red-violet gem |
| `crown_cog` | Clockwork Crown | crowns | superRare | 256, 128 | yellow-brass crown with steel gear teeth round the band, steel cogs on its points, aqua clock-face gem |
| `crown_oni` | Horned Festival Crown | crowns | mythic | 256, 128 | red lacquer crown, round cone points, two ivory horns, rose-gold rims, glowing front gem |
| `crown_dragon` | Ashwing Crown | crowns | legendary | 256, 128 | ember-orange crown with thick wing-shaped points, gold rims, red gem with a star |
| `crown_rainbow` | Rainbow Crown | crowns | legendary (rainbow) | 256, 128 | iridescent crown: thick rainbow band with rims, five round cone points with pearl finials, three big gems (appr.; ships the approved file, PLAN C11; this model only with --no-ship) |
| `crown_rainbow_shard` | Rainbow Crown Shard | crowns | mythic (rainbow) | 256, 128 | curved slice of the Rainbow Crown ring (the band with its rims in one profile), one whole cone point and one snapped low to a stump with a lighter flat break face, pink gem between them, a jagged lighter break at each end of the band (no ball tips), deeper lilac shadow plane |
| `star_fragment` | Star Fragment | fragments | superRare | 256, 128 | chunky five-point star crystal and a splinter, pastel pink to violet facets, sparkle on the top tip |
| `kindred_r` | Kindred Essence (R) | fragments | rare | 256, 128 | smooth glass drop (sky blue): darker top rim, light pooled low, crescent highlight, blossom inside, silver cap |
| `kindred_sr` | Kindred Essence (SR) | fragments | superRare | 256, 128, small | smooth glass drop (violet), blossom inside, silver cap with an inset gem |
| `kindred_ssr` | Kindred Essence (SSR) | fragments | legendary | 256, 128 | smooth glass drop (clear warm gold), blossom inside, gold cap, star |
| `kindred_shard_ssr` | Kindred Shard (SSR) | fragments | mythic | 256, 128 | warm-gold hexagonal crystal shard in a rose-gold collar (mythic), embossed pink sakura in a raised gold rim on its front facet, a chip, sparkle on the lit edge |
| `gearbox_common` | Plain Gear Box | boxes | common | 256, 128 | plain warm-grey chest, wood straps, lid closed, gear emblem |
| `gearbox_rare` | Sturdy Gear Box | boxes | rare | 256, 128 | blue chest, silver straps, lid open 15 degrees on its hinge, cream lining sunk below the rim, gear emblem with a blue gem |
| `gearbox_superRare` | Ornate Gear Box | boxes | superRare | 256, 128 | violet chest, silver straps, lid open 15 degrees, sunk lining, gear emblem with a violet gem, violet gem in the clasp |
| `gearbox_mythic` | Radiant Gear Box | boxes | mythic | 256, 128 | pink chest, rose-gold straps and latch, lid open 15 degrees on its hinge, cream lining sunk below the rim, gear emblem with a pink gem (appr.) |
| `gearbox_legendary` | Celestial Gear Box | boxes | legendary | 256, 128 | teal chest, gold straps, lid open 15 degrees, sunk lining, white-blue gem, star glint |
| `gearbox_rainbow` | Rainbow Gear Box | boxes | legendary (rainbow) | 256, 128 | lilac-pearl iridescent chest, iridescent straps, lid open 15 degrees, sunk lining, prism glints |
| `setbox_pick_mythic` | Mythic Set Box | boxes | mythic | 256, 128 | Set Box: the gear box in pearl, a ring of the six set colours round a white sakura; rose-gold straps, pink gem |
| `setbox_pick_legendary` | Legendary Set Box | boxes | legendary | 256, 128 | Set Box: the gear box in pearl, a ring of the six set colours round a white sakura; gold straps, amber gem |
| `setbox_spirit_mythic` | Spirit Squad Box (Mythic) | boxes | mythic | 256, 128 | Set Box: the gear box in red, white pom crest; rose-gold straps, pink gem |
| `setbox_spirit_legendary` | Spirit Squad Box (Legendary) | boxes | legendary | 256, 128 | Set Box: the gear box in red, white pom crest; gold straps, amber gem |
| `setbox_freezetag_mythic` | Freeze Tag Box (Mythic) | boxes | mythic | 256, 128 | Set Box: the gear box in ice blue, white pause-bars crest; rose-gold straps, pink gem |
| `setbox_freezetag_legendary` | Freeze Tag Box (Legendary) | boxes | legendary | 256, 128 | Set Box: the gear box in ice blue, white pause-bars crest; gold straps, amber gem |
| `setbox_geometry_mythic` | Geometry Set Box (Mythic) | boxes | mythic | 256, 128 | Set Box: the gear box in slate blue, white set-square crest; rose-gold straps, pink gem |
| `setbox_geometry_legendary` | Geometry Set Box (Legendary) | boxes | legendary | 256, 128 | Set Box: the gear box in slate blue, white set-square crest; gold straps, amber gem |
| `setbox_popper_mythic` | Party Popper Box (Mythic) | boxes | mythic | 256, 128 | Set Box: the gear box in purple, white star crest; rose-gold straps, pink gem |
| `setbox_popper_legendary` | Party Popper Box (Legendary) | boxes | legendary | 256, 128 | Set Box: the gear box in purple, white star crest; gold straps, amber gem |
| `setbox_treasurer_mythic` | Treasurer Box (Mythic) | boxes | mythic | 256, 128 | Set Box: the gear box in mint, white coin crest; rose-gold straps, pink gem |
| `setbox_treasurer_legendary` | Treasurer Box (Legendary) | boxes | legendary | 256, 128 | Set Box: the gear box in mint, white coin crest; gold straps, amber gem |
| `setbox_powerbank_mythic` | Power Bank Box (Mythic) | boxes | mythic | 256, 128 | Set Box: the gear box in lime, white bolt crest; rose-gold straps, pink gem |
| `setbox_powerbank_legendary` | Power Bank Box (Legendary) | boxes | legendary | 256, 128 | Set Box: the gear box in lime, white bolt crest; gold straps, amber gem |
| `dice_reroll` | Fortune Dice | tools | rare | 256, 128 | rounded light-blue die, white pips, a sakura on the top face |
| `lock_pin` | Lock Pin | tools | superRare | 256, 128 | silver padlock with a violet-gem keyhole, pink-headed pin through it |
| `dice_prism` | Prism Dice | tools | mythic | 256, 128 | chunky rounded d12 die in pastel iridescence, tilted, saturated violet shadow plane, big embossed rose-gold pips (1-3) on its front faces |
| `seed_rainbow` | Rainbow Seed | tools | ur | 256, 128 | iridescent seed with a green two-leaf sprout, prism glints |
| `needle_star` | Starlight Needle | tools | legendary | 256, 128 | bevelled gold four-point star (a ridge on each arm), steel needle behind it, pink thread through the eye (appr.) |
| `club_band` | Club Armband | tools | mythic | 256, 128 | pink cloth armband loop with stitching and a rose-gold star badge |
| `tie_pin` | Tie Pin | tools | legendary | 256, 128 | gold tie bar over its back clip, a stamped sakura and a small pink gem |
| `collar_pin` | Collar Pin | tools | mythic | 256, 128 | round pink enamel collar stud on a gold rim, gold centre boss, pressed petals, post behind |
| `lens_nightglass` | Nightglass Lens | tools | ur | 256, 128 | navy lens in a thick white-gold rim with a loop, a pale star and starlight specks, rim glint |
| `ticket_recruit` | Recruit Ticket | tickets | superRare | 256, 128, small | pink stub with a gold star, white body with a sakura and three bars, perforation, notches (appr.) |
| `ticket_recruit10` | 10× Recruit Ticket | tickets | mythic | 256, 128 | fanned stack of three recruit tickets (rose-gold, violet, pink stubs) held by a rose-gold band |
| `ticket_ssr_select` | SSR Select Ticket | tickets | legendary | 256, 128 | gold-foil ticket, cream stub, big pink star crest, iridescent edge stripe |
| `token_boss` | Assault Token | currency | rare | 256, 128, small | thick rose token coin, silver rim, embossed ivory horned mask |
| `token_bounty` | Bounty Token | currency | common | 256, 128, small | thick mint token coin, embossed cream ring and blossom |
| `memento` | Memento | currency | superRare | 256, 128, small | heart locket on a violet ribbon loop, silver hinge, inset violet gem |
| `moonpearl` | Moonpearl | currency | legendary | 256, 128, small | lavender-white pearl in a gold crescent cradle, star glint |
| `evt_halloween_candy` | Pumpkin Candy | currency | rare | 256, 128, small | wrapped bright pumpkin candy (ribs as tone lines), lilac wrapper twists, carved smile, stem |
| `coins` | Coins | currency | common | 256, 128, small | two gold coins (hero + echo): rounded rim, groove, embossed cream sakura with a pearl, glint (appr.) |
| `gems` | Sakura Gems | currency | legendary | 256, 128, small | two faceted sakura-flower crystals (hero + echo), white blossom centre (appr.) |
| `gear_charm_common` | Charm (common) | gear | common | 256, 128 | faceted diamond stone in a bezel on a short chain; plain: pewter trim |
| `gear_charm_rare` | Charm (rare) | gear | rare | 256, 128 | faceted diamond stone in a bezel on a short chain; silver trim (charm: a bail cap) |
| `gear_charm_superRare` | Charm (superRare) | gear | superRare | 256, 128 | faceted diamond stone in a bezel on a short chain; silver trim, studs (ribbon: tail bands, shoes: eyelets) and a violet gem; shoes: a small wing |
| `gear_charm_mythic` | Charm (mythic) | gear | mythic | 256, 128 | faceted diamond stone in a bezel on a short chain; rose-gold trim, a rose-gold sakura blossom behind the stone (ribbon: layered loops; shoes: a sole stripe and a wing), glow, a drop bead |
| `gear_charm_legendary` | Charm (legendary) | gear | legendary | 256, 128 | faceted diamond stone in a bezel on a short chain; gold trim, sunburst rays (ribbon: a star medallion; shoes: a gold toe rim and a bigger wing), star, a drop bead |
| `gear_charm_ur` | Charm (UR) | gear | ur | 256, 128 | faceted diamond stone in a bezel on a short chain; iridescent body (saturated shadow) and trim, the legendary crest (the charm swaps its rays for the wings) plus rainbow wings (one pastel per feather), a drop bead |
| `gear_ribbon_common` | Ribbon (common) | gear | common | 256, 128 | chunky satin bow with a knot clip and two notched tails; plain: pewter trim |
| `gear_ribbon_rare` | Ribbon (rare) | gear | rare | 256, 128 | chunky satin bow with a knot clip and two notched tails; silver trim (charm: a bail cap) |
| `gear_ribbon_superRare` | Ribbon (superRare) | gear | superRare | 256, 128 | chunky satin bow with a knot clip and two notched tails; silver trim, studs (ribbon: tail bands, shoes: eyelets) and a violet gem; shoes: a small wing |
| `gear_ribbon_mythic` | Ribbon (mythic) | gear | mythic | 256, 128 | chunky satin bow with a knot clip and two notched tails; rose-gold trim, a rose-gold sakura blossom behind the stone (ribbon: layered loops; shoes: a sole stripe and a wing), glow, a drop bead |
| `gear_ribbon_legendary` | Ribbon (legendary) | gear | legendary | 256, 128 | chunky satin bow with a knot clip and two notched tails; gold trim, sunburst rays (ribbon: a star medallion; shoes: a gold toe rim and a bigger wing), star, a drop bead |
| `gear_ribbon_ur` | Ribbon (UR) | gear | ur | 256, 128 | chunky satin bow with a knot clip and two notched tails; iridescent body (saturated shadow) and trim, the legendary crest (the charm swaps its rays for the wings) plus rainbow wings (one pastel per feather), a drop bead |
| `gear_shoes_common` | Shoes (common) | gear | common | 256, 128 | chunky sneaker: white toe cap and sole, fat laces, padded collar, heel counter; plain: pewter trim |
| `gear_shoes_rare` | Shoes (rare) | gear | rare | 256, 128 | chunky sneaker: white toe cap and sole, fat laces, padded collar, heel counter; silver trim (charm: a bail cap) |
| `gear_shoes_superRare` | Shoes (superRare) | gear | superRare | 256, 128 | chunky sneaker: white toe cap and sole, fat laces, padded collar, heel counter; silver trim, studs (ribbon: tail bands, shoes: eyelets) and a violet gem; shoes: a small wing |
| `gear_shoes_mythic` | Shoes (mythic) | gear | mythic | 256, 128 | chunky sneaker: white toe cap and sole, fat laces, padded collar, heel counter; rose-gold trim, a rose-gold sakura blossom behind the stone (ribbon: layered loops; shoes: a sole stripe and a wing), glow |
| `gear_shoes_legendary` | Shoes (legendary) | gear | legendary | 256, 128 | chunky sneaker: white toe cap and sole, fat laces, padded collar, heel counter; gold trim, sunburst rays (ribbon: a star medallion; shoes: a gold toe rim and a bigger wing), star |
| `gear_shoes_ur` | Shoes (UR) | gear | ur | 256, 128 | chunky sneaker: white toe cap and sole, fat laces, padded collar, heel counter; iridescent body (saturated shadow) and trim, the legendary crest (the charm swaps its rays for the wings) plus rainbow wings (one pastel per feather) |
| `gear_hair_common` | Hair Clip (common) | gear | common | 256, 128 | hair clip: a rounded bar clip with a sakura ornament at its end; plain: pewter trim |
| `gear_hair_rare` | Hair Clip (rare) | gear | rare | 256, 128 | hair clip: a rounded bar clip with a sakura ornament at its end; silver trim (charm: a bail cap) |
| `gear_hair_superRare` | Hair Clip (superRare) | gear | superRare | 256, 128 | hair clip: a rounded bar clip with a sakura ornament at its end; silver trim, studs (ribbon: tail bands, shoes: eyelets) and a violet gem; shoes: a small wing |
| `gear_hair_mythic` | Hair Clip (mythic) | gear | mythic | 256, 128 | hair clip: a rounded bar clip with a sakura ornament at its end; rose-gold trim, a rose-gold sakura blossom behind the stone (ribbon: layered loops; shoes: a sole stripe and a wing), glow, a drop bead |
| `gear_hair_legendary` | Hair Clip (legendary) | gear | legendary | 256, 128 | hair clip: a rounded bar clip with a sakura ornament at its end; gold trim, sunburst rays (ribbon: a star medallion; shoes: a gold toe rim and a bigger wing), star, a drop bead |
| `gear_hair_ur` | Hair Clip (UR) | gear | ur | 256, 128 | hair clip: a rounded bar clip with a sakura ornament at its end; iridescent body (saturated shadow) and trim, the legendary crest (the charm swaps its rays for the wings) plus rainbow wings (one pastel per feather), a drop bead |
| `gear_necklace_common` | Necklace (common) | gear | common | 256, 128 | heart pendant on a chain loop with a clasp; plain: pewter trim |
| `gear_necklace_rare` | Necklace (rare) | gear | rare | 256, 128 | heart pendant on a chain loop with a clasp; silver trim (charm: a bail cap) |
| `gear_necklace_superRare` | Necklace (superRare) | gear | superRare | 256, 128 | heart pendant on a chain loop with a clasp; silver trim, studs (ribbon: tail bands, shoes: eyelets) and a violet gem; shoes: a small wing |
| `gear_necklace_mythic` | Necklace (mythic) | gear | mythic | 256, 128 | heart pendant on a chain loop with a clasp; rose-gold trim, a rose-gold sakura blossom behind the stone (ribbon: layered loops; shoes: a sole stripe and a wing), glow, a drop bead |
| `gear_necklace_legendary` | Necklace (legendary) | gear | legendary | 256, 128 | heart pendant on a chain loop with a clasp; gold trim, sunburst rays (ribbon: a star medallion; shoes: a gold toe rim and a bigger wing), star, a drop bead |
| `gear_necklace_ur` | Necklace (UR) | gear | ur | 256, 128 | heart pendant on a chain loop with a clasp; iridescent body (saturated shadow) and trim, the legendary crest (the charm swaps its rays for the wings) plus rainbow wings (one pastel per feather), a drop bead |
| `recruitPoints` | Recruit Points | currency | superRare | 256, 128, small | sakura rosette badge: a ring of petals, a gold star boss, two ribbon tails |
| `gear_spirit_hair` | Hair Clip (spirit set) | gear | superRare | 256, 128 | hair clip: a rounded bar clip with a sakura ornament at its end (pom shape, body #e5484d, gold trim); set look (rarity on the tile) |
| `gear_spirit_necklace` | Necklace (spirit set) | gear | superRare | 256, 128 | heart pendant on a chain loop with a clasp (megaphone shape, body #e5484d, gold trim); set look (rarity on the tile) |
| `gear_freezetag_hair` | Hair Clip (freezetag set) | gear | superRare | 256, 128 | hair clip: a rounded bar clip with a sakura ornament at its end (pause shape, body #5fb4e8, gold trim); set look (rarity on the tile) |
| `gear_freezetag_necklace` | Necklace (freezetag set) | gear | superRare | 256, 128 | heart pendant on a chain loop with a clasp (stopwatch shape, body #5fb4e8, gold trim); set look (rarity on the tile) |
| `gear_geometry_hair` | Hair Clip (geometry set) | gear | superRare | 256, 128 | hair clip: a rounded bar clip with a sakura ornament at its end (setsquare shape, body #5a6fa8, gold trim); set look (rarity on the tile) |
| `gear_geometry_necklace` | Necklace (geometry set) | gear | superRare | 256, 128 | heart pendant on a chain loop with a clasp (crosshair shape, body #5a6fa8, gold trim); set look (rarity on the tile) |
| `gear_popper_hair` | Hair Clip (popper set) | gear | superRare | 256, 128 | hair clip: a rounded bar clip with a sakura ornament at its end (confetti shape, body #9b5de5, gold trim); set look (rarity on the tile) |
| `gear_popper_necklace` | Necklace (popper set) | gear | superRare | 256, 128 | heart pendant on a chain loop with a clasp (popper shape, body #9b5de5, gold trim); set look (rarity on the tile) |
| `gear_treasurer_hair` | Hair Clip (treasurer set) | gear | superRare | 256, 128 | hair clip: a rounded bar clip with a sakura ornament at its end (calc shape, body #9fd8c4, gold trim); set look (rarity on the tile) |
| `gear_treasurer_necklace` | Necklace (treasurer set) | gear | superRare | 256, 128 | heart pendant on a chain loop with a clasp (coin shape, body #9fd8c4, gold trim); set look (rarity on the tile) |
| `gear_powerbank_hair` | Hair Clip (powerbank set) | gear | superRare | 256, 128 | hair clip: a rounded bar clip with a sakura ornament at its end (bolt shape, body #8bd13a, gold trim); set look (rarity on the tile) |
| `gear_powerbank_necklace` | Necklace (powerbank set) | gear | superRare | 256, 128 | heart pendant on a chain loop with a clasp (battery shape, body #8bd13a, gold trim); set look (rarity on the tile) |
<!-- table:end -->
