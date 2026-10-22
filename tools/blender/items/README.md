# Item art pipeline (3D-flat icons)

One-line usage (one Blender at a time, below-normal priority):

```
blender --background --factory-startup --python-use-system-env --python tools/blender/items/build_items.py -- [keys ...] [--family books]
```

It bakes every item icon the game draws (the 81 item ids, `gear_<slot>_<rarity>` / `gear_<slot>_ur` and
`recruitPoints`: 100 keys) in the approved "3D-flat" look: chunky rounded toy objects in one shared 3/4 view, lit
from the top left, base + light + one cel shadow, tinted (never black) ink, a soft navy contact shadow, no text.
Rarity lives in the tile, not in the art.

Outputs (all committed, so CI never needs Blender):
- `public/art/items/<key>-256.webp` (big views) and `<key>-128.webp` (tiles); `<key>-small.webp` (96 px, heavier
  line) for the keys in `models.SMALL_CUT` that show at 24 CSS px or less.
- `src/art/itemArt.js`: the manifest (`ITEM_ART`, `ITEM_ART_SMALL`: key → 8-char content hash), rewritten from the
  files in `public/art/items/` after every run.
- Scratch, never in the repo (`--scratch`, default `$TEMP/item-art`): raw renders, PNG copies, `report.json`,
  one contact sheet per family (256 view + 80/62/48/32/22 px on the slanted tile + 62 px at DPR 2) and, with
  `--compare <dir of approved <key>_256.webp>`, an approved-vs-new grid.

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
python3 tools/blender/items/build_items.py --table      # rewrite the data table below from catalog.py (no Blender)
python3 tools/blender/items/build_items.py --list       # keys and families
```

## How a key is drawn

- `rig.py`: one orthographic camera looking along +Y; the key light is fixed in camera space (upper left, toward
  the viewer). Two shared materials for everything: an emission-only toon shader (cel steps from N·L, a deep step
  for facets, rim light on grazing shadow edges, specular for metal and gloss, diagonal sheen bands, a small
  screen-space drift, iridescence, inner glow, printed stripes) and the ink. Each part carries its colours and
  amounts as object custom properties (`toon_*`, `ink_col`) read by Attribute nodes, so EEVEE compiles two shaders.
- Ink is an inverted hull per part, pushed out by the line width in output pixels (2 px lit side, about 3 px
  shadow side at the default 2.5 px); overlapping parts give the inner lines; `lift` brings the hull of thin raised
  motifs forward.
- Poses: `standing` (boxes, crowns, crystals: seen from above-front-right) and `flat` (books, coins, tickets: the
  face turned a little left and leaning back so the thickness shows on the right and bottom, rolled in plane). A
  flat item's light step and specular threshold sit just above its face's own N·L / N·H, so the face reads as the
  base tone and only bevels and rims catch the light.
- Auto-fit: the silhouette lands centred at (119, 117.5) px inside about 228 x 226 px (the approved framing).
- `post.py`: 4-point glints (drawn at model anchors), the contact shadow (silhouette offset (+1, +5) px,
  blurred, navy `#263a5c` at 32% core), framing check, Lanczos downscale (premultiplied), WebP q88 / alpha 100,
  size caps (20 KB / 9 KB / 5 KB, 2.2 MB in all; `tests/art/itemArt.test.js` enforces them), sheets, manifest.
- `parts.py`: outlines (rounded rect, sakura, star, heart, gear, crescent, flame, leaf), solids (bevelled slab,
  rounded box, lathe with hard edges, sweep, torus, faceted fan gem with ridges or a spine, cut gem, cabochon,
  crystal prism, lump). `palette.py`: the tone rule (light +L toward yellow, shadow -L toward magenta, ink L 25%),
  the trim ladder (silver, rose gold, gold, iridescent) and shared materials.
- `models/<family>.py`: one module per family, `build(row) -> dict(kind=..., roll=...)`. `catalog.py`: the table below.

## Adding or changing an item

1. Add the id in `src/data` as usual; `dump_items.mjs` picks it up.
2. Give it a builder in the family module (reuse a base model; a tier is usually a paint swap plus one trim step)
   and a line in `catalog.py`.
3. Run it alone with `--compare` or look at its family sheet; then commit the WebPs and `src/art/itemArt.js`.

Visual targets are our own approved icons only (kept outside the repo); never third-party images.

## Data table

<!-- table:start -->
| Key | Name | Family | Tier | Files | Model |
|---|---|---|---|---|---|
| `book_common` | Doodle Notes | books | common | 256, 128 | kraft spiral notebook, pencil, pink star sticker, label with two blue lines (appr.) |
| `book_rare` | Study Guide | books | rare | 256, 128 | blue hardcover, 2 silver corner guards, white label with a sakura, red ribbon (appr.) |
| `book_superRare` | Academy Textbook | books | superRare | 256, 128 | violet hardcover, 4 silver guards, silver medallion with a blossom and a violet gem, ring clasp (appr.) |
| `book_mythic` | Sage's Codex | books | mythic | 256, 128 | rose hardcover, rose-gold guards, rose-gold blossom medallion with a glowing pink core, clasp strap |
| `book_legendary` | Akashic Tome | books | legendary | 256, 128 | teal hardcover, gold L-guards, gold sunburst medallion with a big cut gem and a star, gold strap with a stud (appr.) |
| `mat_feather_common` | Sparrow Feather | materials | common | 256, 128 | brown sparrow feather, cream quill |
| `mat_feather_rare` | Swallow Plume | materials | rare | 256, 128 | sleek sky-blue plume, silver quill cap |
| `mat_feather_superRare` | Hawk Quill | materials | superRare | 256, 128 | amber quill with darker stripes, silver cap with a violet gem |
| `mat_feather_mythic` | Phoenix Plume | materials | mythic | 256, 128 | red-orange plume with flame tips, rose-gold band, glowing shaft |
| `mat_feather_legendary` | Celestial Pinion | materials | legendary | 256, 128 | pearl-white plume with pale-gold edges, gold cap, star |
| `mat_feather_zenith` | Zenith Plume | materials | zenith | 256, 128 | pearl-white plume, iridescent edges and cap, prism glints |
| `mat_blade_common` | Chipped Edge Shard | materials | common | 256, 128 | dull steel shard with a notch |
| `mat_blade_rare` | Tempered Shard | materials | rare | 256, 128 | polished steel shard, temper line, silver collar and grip |
| `mat_blade_superRare` | Moonsteel Fragment | materials | superRare | 256, 128 | blue-violet steel shard with a crescent gem, silver collar |
| `mat_blade_mythic` | Crimson Katana Shard | materials | mythic | 256, 128 | steel shard with a glowing crimson tip, rose-gold collar |
| `mat_blade_legendary` | Starforged Edge | materials | legendary | 256, 128 | white-gold blade, gold guard, gem, star |
| `mat_blade_zenith` | Zenith Edge | materials | zenith | 256, 128 | pearl-white blade, iridescent guard, prism glints |
| `mat_ember_common` | Warm Cinder | materials | common | 256, 128 | plum-grey cinder with glowing orange cracks |
| `mat_ember_rare` | Glowing Ember | materials | rare | 256, 128 | glowing orange coal in a silver dish |
| `mat_ember_superRare` | Blazing Coal | materials | superRare | 256, 128 | hot coal with a flame crown and a violet heat gem |
| `mat_ember_mythic` | Phoenix Ember | materials | mythic | 256, 128 | flame-shaped ember in a rose-gold crescent cradle, inner glow |
| `mat_ember_legendary` | Sunheart Core | materials | legendary | 256, 128 | sun orb in a gold ring with ray spikes, star inside |
| `mat_ember_zenith` | Zenith Flame | materials | zenith | 256, 128 | pearl sun orb, iridescent ring and rays |
| `mat_rime_common` | Frost Pebble | materials | common | 256, 128 | three ice prisms on a snow-capped stone (appr.) |
| `mat_rime_rare` | Rime Shard | materials | rare | 256, 128 | feathery ice-blue crystal spray on a snow puff, silver frost ring |
| `mat_rime_superRare` | Glacier Prism | materials | superRare | 256, 128 | lavender crystal cluster on a snow puddle (appr.) |
| `mat_rime_mythic` | Aurora Crystal | materials | mythic | 256, 128 | mint-to-violet crystal cluster on a rose-gold ring, inner glow |
| `mat_rime_legendary` | Eternal Winter Heart | materials | legendary | 256, 128 | faceted ice heart in a gold snowflake frame, star (appr.) |
| `mat_rime_zenith` | Zenith Frost | materials | zenith | 256, 128 | pearl heart in an iridescent snowflake frame |
| `mat_charm_common` | Paper Omamori | materials | common | 256, 128 | paper omamori pouch, red cord knot |
| `mat_charm_rare` | Silk Omamori | materials | rare | 256, 128 | pink silk omamori, embroidered sakura, silver cord ring |
| `mat_charm_superRare` | Blessed Bell Charm | materials | superRare | 256, 128 | violet omamori with a silver bell and a gem knot |
| `mat_charm_mythic` | Shrine Guardian Talisman | materials | mythic | 256, 128 | rose-red lacquered tag, rose-gold cap, glowing sakura inlay |
| `mat_charm_legendary` | Sakura Divine Seal | materials | legendary | 256, 128 | white seal disc with a pink sakura, gold rim, star |
| `mat_charm_zenith` | Zenith Omamori | materials | zenith | 256, 128 | pearl seal disc, iridescent rim and blossom |
| `mat_rune_common` | Chalk Rune | materials | common | 256, 128 | slate tablet with a chalk glyph (abstract mark) |
| `mat_rune_rare` | Inked Rune | materials | rare | 256, 128 | rice-paper slip with a blue ink glyph, silver pin |
| `mat_rune_superRare` | Carved Runestone | materials | superRare | 256, 128 | lavender runestone with a glowing glyph and a gem |
| `mat_rune_mythic` | Astral Glyph | materials | mythic | 256, 128 | violet tablet with a star-dot constellation, rose-gold rim |
| `mat_rune_legendary` | Primordial Sigil | materials | legendary | 256, 128 | violet disc with a gold sigil, gold rim, star |
| `mat_rune_zenith` | Zenith Sigil | materials | zenith | 256, 128 | pearl disc with an iridescent sigil |
| `mat_cog_common` | Brass Cog | materials | common | 256, 128 | brass cog with one bent tooth |
| `mat_cog_rare` | Steel Gear | materials | rare | 256, 128 | steel gear with an axle hub |
| `mat_cog_superRare` | Clockwork Spring | materials | superRare | 256, 128 | steel coil spring between two caps, violet gem |
| `mat_cog_mythic` | Aether Mainspring | materials | mythic | 256, 128 | glowing aqua mainspring in a rose-gold housing |
| `mat_cog_legendary` | Perpetual Engine Core | materials | legendary | 256, 128 | gold gear around a glowing cut-gem core, star |
| `mat_cog_zenith` | Zenith Cog | materials | zenith | 256, 128 | pearl gear, iridescent core |
| `crown_slime` | Jelly Crown | crowns | rare | 256, 128 | glossy green jelly crown, silver ball finials, jelly drips |
| `crown_iron` | Iron Warlord Crown | crowns | superRare | 256, 128 | steel crown with rivets and an inset red-violet gem |
| `crown_cog` | Clockwork Crown | crowns | superRare | 256, 128 | brass crown with two steel cogs on its points and an aqua clock-face gem |
| `crown_oni` | Horned Festival Crown | crowns | mythic | 256, 128 | red lacquer crown, two ivory horns, rose-gold rim, glowing front gem |
| `crown_dragon` | Ashwing Crown | crowns | legendary | 256, 128 | ember-orange crown with wing-shaped points, gold rim, red gem with a star |
| `crown_rainbow` | Rainbow Crown | crowns | legendary (rainbow) | 256, 128 | iridescent crown: rainbow band, five filled points with pearl finials, three gems (appr.) |
| `crown_rainbow_shard` | Rainbow Crown Shard | crowns | mythic (rainbow) | 256, 128 | one iridescent crown point with a pearl finial on a jagged chunk of band |
| `star_fragment` | Star Fragment | fragments | superRare | 256, 128 | chunky five-point star crystal and a splinter, pastel pink to violet facets |
| `kindred_r` | Kindred Essence (R) | fragments | rare | 256, 128 | faceted teardrop crystal (sky blue) with a white blossom, silver cap |
| `kindred_sr` | Kindred Essence (SR) | fragments | superRare | 256, 128, small | faceted teardrop crystal (violet) with a white blossom, silver cap with an inset gem |
| `kindred_ssr` | Kindred Essence (SSR) | fragments | legendary | 256, 128 | faceted teardrop crystal (warm gold, iridescent) with a white blossom, gold cap, star |
| `kindred_shard_ssr` | Kindred Shard (SSR) | fragments | mythic | 256, 128 | gold-iridescent crystal splinter and a chip |
| `gearbox_common` | Plain Gear Box | boxes | common | 256, 128 | plain warm-grey chest, wood straps, lid closed, gear emblem |
| `gearbox_rare` | Sturdy Gear Box | boxes | rare | 256, 128 | blue chest, silver straps, lid ajar with cream cloth, gear emblem with a blue gem |
| `gearbox_superRare` | Ornate Gear Box | boxes | superRare | 256, 128 | violet chest, silver straps, gear emblem with a violet gem |
| `gearbox_mythic` | Radiant Gear Box | boxes | mythic | 256, 128 | pink chest, rose-gold straps and latch, cream cloth, gear emblem with a pink gem (appr.) |
| `gearbox_legendary` | Celestial Gear Box | boxes | legendary | 256, 128 | teal chest, gold straps, white-blue gem, star glint |
| `gearbox_rainbow` | Rainbow Gear Box | boxes | legendary (rainbow) | 256, 128 | pearl-white iridescent chest, iridescent straps, prism glints |
| `dice_reroll` | Fortune Dice | tools | rare | 256, 128 | rounded light-blue die, white pips, a sakura on the top face |
| `lock_pin` | Lock Pin | tools | superRare | 256, 128 | silver padlock with a violet-gem keyhole, pink-headed pin through it |
| `dice_prism` | Prism Dice | tools | mythic | 256, 128 | pastel iridescent bipyramid die, rose-gold caps, inner glow (no number) |
| `seed_rainbow` | Rainbow Seed | tools | ur | 256, 128 | iridescent seed with a green two-leaf sprout, prism glints |
| `needle_star` | Starlight Needle | tools | legendary | 256, 128 | faceted gold four-point star, steel needle behind it, pink thread through the eye (appr.) |
| `club_band` | Club Armband | tools | mythic | 256, 128 | pink cloth armband loop with stitching and a rose-gold star badge |
| `ticket_recruit` | Recruit Ticket | tickets | superRare | 256, 128, small | pink stub with a gold star, white body with a sakura and three bars, perforation, notches (appr.) |
| `ticket_recruit10` | 10× Recruit Ticket | tickets | mythic | 256, 128 | fanned stack of three recruit tickets (rose-gold, violet, pink stubs) held by a rose-gold band |
| `ticket_ssr_select` | SSR Select Ticket | tickets | legendary | 256, 128 | gold-foil ticket, cream stub, big pink star crest, iridescent edge stripe |
| `token_boss` | Assault Token | currency | rare | 256, 128, small | thick rose token coin, silver rim, embossed ivory horned mask |
| `token_bounty` | Bounty Token | currency | common | 256, 128, small | thick mint token coin, embossed cream ring and blossom |
| `memento` | Memento | currency | superRare | 256, 128, small | heart locket on a violet ribbon loop, silver hinge, inset violet gem |
| `moonpearl` | Moonpearl | currency | legendary | 256, 128, small | lavender-white pearl in a gold crescent cradle, star glint |
| `evt_halloween_candy` | Pumpkin Candy | currency | rare | 256, 128, small | wrapped pumpkin candy, violet wrapper twists, carved smile, stem |
| `coins` | Coins | currency | common | 256, 128, small | two gold coins (hero + echo): rounded rim, groove, embossed cream sakura with a pearl, glint (appr.) |
| `gems` | Sakura Gems | currency | legendary | 256, 128, small | two faceted sakura-flower crystals (hero + echo), white blossom centre (appr.) |
| `gear_charm_common` | Charm (common) | gear | common | 256, 128 | rounded faceted diamond pendant in a bezel, short chain; plain |
| `gear_charm_rare` | Charm (rare) | gear | rare | 256, 128 | rounded faceted diamond pendant in a bezel, short chain; silver trim |
| `gear_charm_superRare` | Charm (superRare) | gear | superRare | 256, 128 | rounded faceted diamond pendant in a bezel, short chain; silver trim + gem (shoes: wing) |
| `gear_charm_mythic` | Charm (mythic) | gear | mythic | 256, 128 | rounded faceted diamond pendant in a bezel, short chain; rose-gold trim + glow (shoes: wing) |
| `gear_charm_legendary` | Charm (legendary) | gear | legendary | 256, 128 | rounded faceted diamond pendant in a bezel, short chain; gold trim + star (shoes: wing) |
| `gear_charm_ur` | Charm (UR) | gear | ur | 256, 128 | rounded faceted diamond pendant in a bezel, short chain; iridescent body and trim (shoes: wing) |
| `gear_ribbon_common` | Ribbon (common) | gear | common | 256, 128 | chunky satin bow with a knot clip and two tails; plain |
| `gear_ribbon_rare` | Ribbon (rare) | gear | rare | 256, 128 | chunky satin bow with a knot clip and two tails; silver trim |
| `gear_ribbon_superRare` | Ribbon (superRare) | gear | superRare | 256, 128 | chunky satin bow with a knot clip and two tails; silver trim + gem (shoes: wing) |
| `gear_ribbon_mythic` | Ribbon (mythic) | gear | mythic | 256, 128 | chunky satin bow with a knot clip and two tails; rose-gold trim + glow (shoes: wing) |
| `gear_ribbon_legendary` | Ribbon (legendary) | gear | legendary | 256, 128 | chunky satin bow with a knot clip and two tails; gold trim + star (shoes: wing) |
| `gear_ribbon_ur` | Ribbon (UR) | gear | ur | 256, 128 | chunky satin bow with a knot clip and two tails; iridescent body and trim (shoes: wing) |
| `gear_shoes_common` | Shoes (common) | gear | common | 256, 128 | chunky loafer, white sole, penny strap and buckle; plain |
| `gear_shoes_rare` | Shoes (rare) | gear | rare | 256, 128 | chunky loafer, white sole, penny strap and buckle; silver trim |
| `gear_shoes_superRare` | Shoes (superRare) | gear | superRare | 256, 128 | chunky loafer, white sole, penny strap and buckle; silver trim + gem (shoes: wing) |
| `gear_shoes_mythic` | Shoes (mythic) | gear | mythic | 256, 128 | chunky loafer, white sole, penny strap and buckle; rose-gold trim + glow (shoes: wing) |
| `gear_shoes_legendary` | Shoes (legendary) | gear | legendary | 256, 128 | chunky loafer, white sole, penny strap and buckle; gold trim + star (shoes: wing) |
| `gear_shoes_ur` | Shoes (UR) | gear | ur | 256, 128 | chunky loafer, white sole, penny strap and buckle; iridescent body and trim (shoes: wing) |
| `recruitPoints` | Recruit Points | currency | superRare | 256, 128, small | sakura rosette badge: a ring of petals, a gold star boss, two ribbon tails |
<!-- table:end -->
