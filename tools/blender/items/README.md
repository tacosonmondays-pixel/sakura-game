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
- `post.py`: 4-point glints (drawn at model anchors), the contact shadow (silhouette offset (+1, +5) px,
  blurred, navy `#263a5c` at 32% core), framing check, Lanczos downscale (premultiplied), WebP q88 / alpha 100,
  size caps (20 KB / 9 KB / 5 KB, 2.2 MB in all; `tests/art/itemArt.test.js` enforces them), sheets, manifest.
- `parts.py`: outlines (rounded rect, sakura, star, heart, gear, crescent, flame, leaf), solids (bevelled slab,
  rounded box, lathe with hard edges, sweep, torus, faceted fan gem with ridges or a spine, cut gem, cabochon,
  crystal prism, round cone, convex hull with rounded edges for cut stones and dice), and `on_surface` / `hit`
  (ray casts that lay cracks, gems and claws onto a part). `palette.py`: the tone rule (light +L toward yellow,
  shadow -L toward magenta, ink L 25%), the trim ladder (silver, rose gold, gold, iridescent), shared materials
  and `anchored()` for UR and zenith parts.
- `models/<family>.py`: one module per family, `build(row) -> dict(kind=..., roll=...)`. `catalog.py`: the table below.
- Shipped keys (`models.SHIPPED`, PLAN C11): an approved icon whose rebuild still missed after two rounds ships the
  approved file itself (our art). Today that is `crown_rainbow` (the rebuild lost the iridescent band and read as a
  plain lilac crown). Its `-256.webp` is the approved file byte for byte, and `post.ship` downscales the `-128.webp`
  from it the same way as every other key. The source is `--approved <dir>/<key>_256.webp` (or `ITEMS_APPROVED`).
  Without it, a run keeps the committed `-256.webp` and only re-cuts the 128, so a full re-bake never puts the
  model back. `--no-ship` bakes the model (keep that for trials with `--out`).
- Family rules: each family keeps one silhouette through every tier (charm = an omamori, rune = a tablet, ember =
  one coal, cog = a gear, feather, blade, rime crystals, crowns with round cone points). The round disc is for
  currencies and tokens only. Accents follow the tier palette: rare blue or silver, super rare a violet gem,
  mythic rose gold, legendary gold, UR / zenith iridescent with a saturated shadow plane. Surfaces stay clean
  cel bands (big flat facets or smooth forms, never noise or bumps), and no emblem may read as a letter.

## Adding or changing an item

1. Add the id in `src/data` as usual; `dump_items.mjs` picks it up.
2. Give it a builder in the family module (reuse a base model; a tier is usually a paint swap plus one trim step)
   and a line in `catalog.py`.
3. Run it alone with `--compare` or look at its family sheet; then commit the WebPs and `src/art/itemArt.js`.

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
| `mat_feather_mythic` | Phoenix Plume | materials | mythic | 256, 128 | red-orange plume with flame tips, rose-gold band, glowing shaft |
| `mat_feather_legendary` | Celestial Pinion | materials | legendary | 256, 128 | pearl plume with a deep-gold edge, gold cap, star |
| `mat_feather_zenith` | Zenith Plume | materials | zenith | 256, 128 | lilac-pearl plume (saturated shadow half), iridescent edge and cap |
| `mat_blade_common` | Chipped Edge Shard | materials | common | 256, 128 | steel shard with a notch: bevelled ridge (lit and shadow planes), white glint on the lit edge |
| `mat_blade_rare` | Tempered Shard | materials | rare | 256, 128 | blue-steel shard, ridge, glint and dark band, silver collar and grip |
| `mat_blade_superRare` | Moonsteel Fragment | materials | superRare | 256, 128 | violet moonsteel shard with a crescent gem, silver collar |
| `mat_blade_mythic` | Crimson Katana Shard | materials | mythic | 256, 128 | rose-steel shard with a glowing crimson tip, rose-gold collar |
| `mat_blade_legendary` | Starforged Edge | materials | legendary | 256, 128 | gold-steel blade, gold guard, gem, star |
| `mat_blade_zenith` | Zenith Edge | materials | zenith | 256, 128 | lilac-pearl blade (saturated shadow plane), iridescent guard |
| `mat_ember_common` | Warm Cinder | materials | common | 256, 128 | chunky warm-grey coal (clean facets) with glowing orange cracks |
| `mat_ember_rare` | Glowing Ember | materials | rare | 256, 128 | the coal with brighter cracks and a small flame lick (blue core) |
| `mat_ember_superRare` | Blazing Coal | materials | superRare | 256, 128 | the coal with a flame crown and an inset violet gem |
| `mat_ember_mythic` | Phoenix Ember | materials | mythic | 256, 128 | the coal in a rose-gold setting (waist band, four claws), rose flame |
| `mat_ember_legendary` | Sunheart Core | materials | legendary | 256, 128 | the coal and flame before a gold sun frame (ring and rays), inset gem, star |
| `mat_ember_zenith` | Zenith Flame | materials | zenith | 256, 128 | lilac-pearl coal, pink flame, iridescent sun frame |
| `mat_rime_common` | Frost Pebble | materials | common | 256, 128 | three ice prisms on a snow-capped stone (appr.) |
| `mat_rime_rare` | Rime Shard | materials | rare | 256, 128 | feathery ice-blue crystal spray on a snow puff, silver frost ring |
| `mat_rime_superRare` | Glacier Prism | materials | superRare | 256, 128 | lavender crystal cluster on a snow puddle (appr.) |
| `mat_rime_mythic` | Aurora Crystal | materials | mythic | 256, 128 | mint-to-violet crystal cluster on a rose-gold ring, inner glow |
| `mat_rime_legendary` | Eternal Winter Heart | materials | legendary | 256, 128 | faceted ice heart in a thick gold frame with fat round-ended snowflake arms, star (appr.) |
| `mat_rime_zenith` | Zenith Frost | materials | zenith | 256, 128 | lilac heart in an iridescent snowflake frame |
| `mat_charm_common` | Paper Omamori | materials | common | 256, 128 | paper omamori pouch, red cord knot, red stamped sakura |
| `mat_charm_rare` | Silk Omamori | materials | rare | 256, 128 | blue silk omamori, embroidered white sakura, silver cord ring |
| `mat_charm_superRare` | Blessed Bell Charm | materials | superRare | 256, 128 | violet omamori with a silver hand bell (dome, lip, clapper) and a gem knot |
| `mat_charm_mythic` | Shrine Guardian Talisman | materials | mythic | 256, 128 | rose-red lacquered tag, rose-gold cap, glowing sakura inlay |
| `mat_charm_legendary` | Sakura Divine Seal | materials | legendary | 256, 128 | cream silk omamori with gold trim, band and cord, pink sakura with an inset gem, star |
| `mat_charm_zenith` | Zenith Omamori | materials | zenith | 256, 128 | iridescent silk omamori with iridescent trim, sakura with an inset gem |
| `mat_rune_common` | Chalk Rune | materials | common | 256, 128 | slate tablet with a chalk sigil (a ring and a four-point star) |
| `mat_rune_rare` | Inked Rune | materials | rare | 256, 128 | cream stone tablet in a silver frame, blue ink sigil |
| `mat_rune_superRare` | Carved Runestone | materials | superRare | 256, 128 | lavender runestone tablet (chamfered cut), glowing sigil round an inset violet gem |
| `mat_rune_mythic` | Astral Glyph | materials | mythic | 256, 128 | violet tablet with a star-dot constellation (a closed kite and a tail star), rose-gold rim |
| `mat_rune_legendary` | Primordial Sigil | materials | legendary | 256, 128 | violet tablet in a thick gold frame, glowing gold sigil with a gem, star |
| `mat_rune_zenith` | Zenith Sigil | materials | zenith | 256, 128 | lilac-pearl tablet in an iridescent frame, iridescent sigil |
| `mat_cog_common` | Brass Cog | materials | common | 256, 128 | brass cog with one bent tooth |
| `mat_cog_rare` | Steel Gear | materials | rare | 256, 128 | blue-steel gear with a silver axle hub |
| `mat_cog_superRare` | Clockwork Spring | materials | superRare | 256, 128 | steel coil spring between two caps, violet gem |
| `mat_cog_mythic` | Aether Mainspring | materials | mythic | 256, 128 | glowing aqua mainspring in a rose-gold gear housing |
| `mat_cog_legendary` | Perpetual Engine Core | materials | legendary | 256, 128 | gold gear around a glowing cut-gem core, star |
| `mat_cog_zenith` | Zenith Cog | materials | zenith | 256, 128 | lilac-pearl gear, iridescent core |
| `crown_slime` | Jelly Crown | crowns | rare | 256, 128 | glossy green jelly crown, round cone points, silver ball finials, jelly drips |
| `crown_iron` | Iron Warlord Crown | crowns | superRare | 256, 128 | steel crown, round cone points, rivets, an inset red-violet gem |
| `crown_cog` | Clockwork Crown | crowns | superRare | 256, 128 | yellow-brass crown with steel gear teeth round the band, steel cogs on its points, aqua clock-face gem |
| `crown_oni` | Horned Festival Crown | crowns | mythic | 256, 128 | red lacquer crown, round cone points, two ivory horns, rose-gold rims, glowing front gem |
| `crown_dragon` | Ashwing Crown | crowns | legendary | 256, 128 | ember-orange crown with thick wing-shaped points, gold rims, red gem with a star |
| `crown_rainbow` | Rainbow Crown | crowns | legendary (rainbow) | 256, 128 | iridescent crown: thick rainbow band with rims, five round cone points with pearl finials, three big gems (appr.; ships the approved file, PLAN C11; this model only with --no-ship) |
| `crown_rainbow_shard` | Rainbow Crown Shard | crowns | mythic (rainbow) | 256, 128 | one iridescent cone point with a pearl finial on a jagged chunk of band |
| `star_fragment` | Star Fragment | fragments | superRare | 256, 128 | chunky five-point star crystal and a splinter, pastel pink to violet facets |
| `kindred_r` | Kindred Essence (R) | fragments | rare | 256, 128 | smooth glass drop (sky blue): darker top rim, light pooled low, crescent highlight, blossom inside, silver cap |
| `kindred_sr` | Kindred Essence (SR) | fragments | superRare | 256, 128, small | smooth glass drop (violet), blossom inside, silver cap with an inset gem |
| `kindred_ssr` | Kindred Essence (SSR) | fragments | legendary | 256, 128 | smooth glass drop (clear warm gold), blossom inside, gold cap, star |
| `kindred_shard_ssr` | Kindred Shard (SSR) | fragments | mythic | 256, 128 | warm-gold hexagonal crystal shard with a glowing blossom inside, and a chip |
| `gearbox_common` | Plain Gear Box | boxes | common | 256, 128 | plain warm-grey chest, wood straps, lid closed, gear emblem |
| `gearbox_rare` | Sturdy Gear Box | boxes | rare | 256, 128 | blue chest, silver straps, lid propped open over a cream lining, gear emblem with a blue gem |
| `gearbox_superRare` | Ornate Gear Box | boxes | superRare | 256, 128 | violet chest, silver straps, lid open, gear emblem with a violet gem, violet gem in the clasp |
| `gearbox_mythic` | Radiant Gear Box | boxes | mythic | 256, 128 | pink chest, rose-gold straps and latch, lid open over a cream lining, gear emblem with a pink gem (appr.) |
| `gearbox_legendary` | Celestial Gear Box | boxes | legendary | 256, 128 | teal chest, gold straps, lid open, white-blue gem, star glint |
| `gearbox_rainbow` | Rainbow Gear Box | boxes | legendary (rainbow) | 256, 128 | lilac-pearl iridescent chest, iridescent straps, lid open, prism glints |
| `dice_reroll` | Fortune Dice | tools | rare | 256, 128 | rounded light-blue die, white pips, a sakura on the top face |
| `lock_pin` | Lock Pin | tools | superRare | 256, 128 | silver padlock with a violet-gem keyhole, pink-headed pin through it |
| `dice_prism` | Prism Dice | tools | mythic | 256, 128 | chunky rounded d8 die in pastel iridescence, embossed rose-gold pips (1-3) on its faces, inner glow |
| `seed_rainbow` | Rainbow Seed | tools | ur | 256, 128 | iridescent seed with a green two-leaf sprout, prism glints |
| `needle_star` | Starlight Needle | tools | legendary | 256, 128 | bevelled gold four-point star (a ridge on each arm), steel needle behind it, pink thread through the eye (appr.) |
| `club_band` | Club Armband | tools | mythic | 256, 128 | pink cloth armband loop with stitching and a rose-gold star badge |
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
| `gear_charm_common` | Charm (common) | gear | common | 256, 128 | rounded faceted diamond pendant in a bezel, short chain; plain |
| `gear_charm_rare` | Charm (rare) | gear | rare | 256, 128 | rounded faceted diamond pendant in a bezel, short chain; silver trim |
| `gear_charm_superRare` | Charm (superRare) | gear | superRare | 256, 128 | rounded faceted diamond pendant in a bezel, short chain; silver trim + gem (shoes: wing) |
| `gear_charm_mythic` | Charm (mythic) | gear | mythic | 256, 128 | rounded faceted diamond pendant in a bezel, short chain; rose-gold trim + glow (shoes: wing) |
| `gear_charm_legendary` | Charm (legendary) | gear | legendary | 256, 128 | rounded faceted diamond pendant in a bezel, short chain; gold trim + star (shoes: wing) |
| `gear_charm_ur` | Charm (UR) | gear | ur | 256, 128 | rounded faceted diamond pendant in a bezel, short chain; iridescent body (saturated shadow) and trim (shoes: wing) |
| `gear_ribbon_common` | Ribbon (common) | gear | common | 256, 128 | chunky satin bow with a knot clip and two tails; plain |
| `gear_ribbon_rare` | Ribbon (rare) | gear | rare | 256, 128 | chunky satin bow with a knot clip and two tails; silver trim |
| `gear_ribbon_superRare` | Ribbon (superRare) | gear | superRare | 256, 128 | chunky satin bow with a knot clip and two tails; silver trim + gem (shoes: wing) |
| `gear_ribbon_mythic` | Ribbon (mythic) | gear | mythic | 256, 128 | chunky satin bow with a knot clip and two tails; rose-gold trim + glow (shoes: wing) |
| `gear_ribbon_legendary` | Ribbon (legendary) | gear | legendary | 256, 128 | chunky satin bow with a knot clip and two tails; gold trim + star (shoes: wing) |
| `gear_ribbon_ur` | Ribbon (UR) | gear | ur | 256, 128 | chunky satin bow with a knot clip and two tails; iridescent body (saturated shadow) and trim (shoes: wing) |
| `gear_shoes_common` | Shoes (common) | gear | common | 256, 128 | chunky sneaker: white toe cap and sole with toe spring, three fat laces, padded collar and tongue, heel counter; plain |
| `gear_shoes_rare` | Shoes (rare) | gear | rare | 256, 128 | chunky sneaker: white toe cap and sole with toe spring, three fat laces, padded collar and tongue, heel counter; silver trim |
| `gear_shoes_superRare` | Shoes (superRare) | gear | superRare | 256, 128 | chunky sneaker: white toe cap and sole with toe spring, three fat laces, padded collar and tongue, heel counter; silver trim + gem (shoes: wing) |
| `gear_shoes_mythic` | Shoes (mythic) | gear | mythic | 256, 128 | chunky sneaker: white toe cap and sole with toe spring, three fat laces, padded collar and tongue, heel counter; rose-gold trim + glow (shoes: wing) |
| `gear_shoes_legendary` | Shoes (legendary) | gear | legendary | 256, 128 | chunky sneaker: white toe cap and sole with toe spring, three fat laces, padded collar and tongue, heel counter; gold trim + star (shoes: wing) |
| `gear_shoes_ur` | Shoes (UR) | gear | ur | 256, 128 | chunky sneaker: white toe cap and sole with toe spring, three fat laces, padded collar and tongue, heel counter; iridescent body (saturated shadow) and trim (shoes: wing) |
| `recruitPoints` | Recruit Points | currency | superRare | 256, 128, small | sakura rosette badge: a ring of petals, a gold star boss, two ribbon tails |
<!-- table:end -->
