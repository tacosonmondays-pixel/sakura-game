# Gear set looks: the six launch sets' own icons (art spec)

Status: preview art for the gear update (`docs/specs/GEAR_UPDATE.md` §3.2–3.3 on `spec/gear-update`). The 30 looks are
baked to the scratch folder only; they go into `public/art/items` and the manifest when the sets ship.

## 1. What a set look is

- **One look per set and slot:** `gear_<set>_<slot>`, 6 sets × 5 slots = 30 icons (about 0.46 MB). Set pieces exist
  from Super Rare up, and the rarity shows on the item tile (and the UR ring, LR's Nightglass tile), never in the set
  art. `gearIcon(slot, rarity, { set: g.set })` shows the look once it is baked and falls back to the default gear look
  until then.
- **A themed kit.** The five pieces of a set share one motif, one palette (a main colour, an accent and a light colour
  for LEDs and glows) and one material (the trim metal and surface). Each piece has one **hero detail** that tells its
  story, and a one-line **lore** text.
- **Premium construction, cute world.** Every piece is layered: a metal frame or ring, a face of enamel, glass or an
  LED window, and a fabric, cord or ribbon accent. All of them are everyday school things with one small tech touch
  (an LED, a tiny display, a charge bar). Wholesome, no text or letters, no outside imagery, and no star or snowflake
  hair clip (§2.1 and §3.3 of the gear update spec).
- **Same render as every item.** The 3D-flat pipeline (`tools/blender/items`): the shared camera, key light, cel
  shading, tinted ink and contact shadow, framed like the default gear.

## 2. Reading at 22–32 px

- **Colour pair first.** Each set owns a pair no other set uses: red over white (Spirit Squad), ice blue with a coral
  mark (Freeze Tag), teal slate with brass and a cyan dot (Geometry Set), magenta-violet with gold (Party Popper), mint
  with silver (Treasurer), indigo with lime (Power Bank). The six main colours are at least ΔE2000 15 apart from each
  other (the gear update's set-chip rule; the closest pair, Geometry and Power Bank, is 19.3). Beside default gear the
  pair is what counts, not the main colour alone: Spirit Squad's cherry red is ΔE 10 from the default Mythic red and
  Party Popper's magenta-violet ΔE 16 from the default Super Rare violet, so those two read by their white and gold.
- **Dark tiles.** Every main colour keeps a lightness the ink and the light tones separate from LR's Nightglass navy
  (`#0e1930`); check it again when the LR gear tile is built.
- **Then the silhouette family.** Round and fluffy; round and flat; straight lines and circles; bursting streamers;
  coins and beads; blocky rounded rectangles (per set below). Each slot keeps its slot's outline where it can (a bow
  is a bow, shoes are shoes), so a player reads the slot before the set.
- **No warning glyphs.** No bar through a ring's centre (a "no entry" sign), no arrowhead on a hair piece; a charm and a
  necklace of one set never share a silhouette (Power Bank: an upright bank on a cable vs a wide battery cell).
- **One hero detail at play size.** The hero detail is the largest contrast mark on the piece (the pom-pom, the
  pause bars, the compass needle, the streamers, the coin, the charge bars); small parts (grille dots, ticks, LCD
  digits) are for the 64–256 px views.

## 3. The six sets

Generated from the rows by `python3 tools/blender/items/gear_sets.py --write-doc`; `--check` (and `tests/art`) keep it in sync.

<!-- sets:start -->
### Spirit Squad (`spirit`, support)

- **Motif:** the spirit squad at a match: pom-poms and light-up gear.
- **Palette:** body `#e8364f`, accent `#ffffff`, light `#ff9fb0`; trim `gold`.
- **Material:** glossy cheer satin and enamel on gold pins.
- **Silhouette:** round and fluffy: pom-pom puffs, a heart, a bright white trainer. Red over white reads first; gold is only the pins and the ring.

| Slot | Piece | Base and options | Hero detail | Lore |
|---|---|---|---|---|
| Charm | **Pom-Pom Keyring** | `keyring`: fob pompom | a light-up bead in the pom-pom cap | Shake it once and the bead glows: the whole stand knows you are cheering. |
| Ribbon | **Cheer Bow** | `setbow`: knot grille, stripes 2, stripe white | a tiny speaker-grille knot | The knot hums the school song at exactly the volume a teacher allows. |
| Shoes | **Light-Up Trainers** | `setshoe`: style trainer, sole glow, heel accent, laces accent, body #f3f5fa, accent #e8364f, light #f0284a | soles that glow cherry red with each step | Every jump leaves a little red flash on the gym floor. |
| Hair Clip | **Pom Clip** | `setclip`: ornament pompom | a mini pom-pom with a glowing bead | Small enough for class, loud enough for the final whistle. |
| Necklace | **Spirit Locket** | `setlocket`: locket heart, light #ffd1da | a heart locket with a soft status light | Its light stays on while a friend is still cheering for you. |

### Freeze Tag (`freezetag`, control)

- **Motif:** playground freeze tag: chalk lines and a tag timer.
- **Palette:** body `#7cc7f0`, accent `#ff7a6b`, light `#ff7a6b`; trim `silver`.
- **Material:** frosted acrylic, chalk white and a coral tag stripe.
- **Silhouette:** round and flat: a token, a pause button, a round timer, all ice blue with one coral mark each (never across a ring's centre). Chalk white lines, never a snowflake or an ice crystal.

| Slot | Piece | Base and options | Hero detail | Lore |
|---|---|---|---|---|
| Charm | **Tag Token** | `keyring`: fob token | a chalk ring, a coral tag stripe and an LED dot | Tap it to someone and they have to hold still: playground rules. |
| Ribbon | **Chalk-Line Ribbon** | `setbow`: knot chalk, stripes 2, stripe white | white chalk lines and a coral tag band on the knot | Drawn like the court lines, so you always know where safe is. |
| Shoes | **Hopscotch Sneakers** | `setshoe`: style trainer, sole grid, side stripe | a hopscotch grid along the soles | One, two, freeze: the soles count your steps for you. |
| Hair Clip | **Pause-Button Clip** | `setclip`: ornament button | a round pause button with coral bars | Press pause on the whole game, just for a moment. |
| Necklace | **Tag Timer** | `setlocket`: locket timer, cord cord | a round countdown display on a coral cord | Ten seconds frozen, then everybody runs again. |

### Geometry Set (`geometry`, precision)

- **Motif:** the maths geometry kit and a cyan laser dot.
- **Palette:** body `#4a7c92`, accent `#34e0ff`, light `#5ff0ff`, glass `#c4f4ff`; trim `brass`.
- **Material:** brushed brass on teal slate, cyan laser glass.
- **Silhouette:** straight lines and circles: a compass, a protractor arc, a set-square standing on its clip, a crosshair window, ruler-tick soles. Teal slate with brass edges and one cyan dot per piece.

| Slot | Piece | Base and options | Hero detail | Lore |
|---|---|---|---|---|
| Charm | **Compass Keyring** | `keyring`: fob compass | a compass needle and a laser-dot lens on the rim | It never points north: it points at the answer. |
| Ribbon | **Protractor Ribbon** | `setbow`: knot protractor | a brass protractor arc for a clasp | Tied at exactly ninety degrees, every morning. |
| Shoes | **Ruler-Step Loafers** | `setshoe`: style loafer, sole ticks, strap dark | ruler ticks along brass soles | Every step measured, every corner square. |
| Hair Clip | **Set-Square Clip** | `setclip`: ornament setsquare | a set-square with ruler ticks and a finger hole, lying along the clip | Keeps a fringe perfectly straight and a sight line perfectly clear. |
| Necklace | **Crosshair Locket** | `setlocket`: locket crosshair | a round window with a crosshair and a laser dot | Look through it and the target is already centred. |

### Party Popper (`popper`, crowd)

- **Motif:** a class party: poppers, streamers and confetti.
- **Palette:** body `#c23dbf`, accent `#f6c04a`, light `#ffe27a`, glass `#efe6ff`; trim `gold`.
- **Material:** magenta-violet foil and warm gold with fibre-optic sparkle.
- **Silhouette:** bursting outward: a cone with streamers, curled streamer tails, a confetti capsule. Magenta-violet and gold with small multicolour confetti; the only set with loose streamers.

| Slot | Piece | Base and options | Hero detail | Lore |
|---|---|---|---|---|
| Charm | **Popper Keyring** | `keyring`: fob popper | fibre-optic streamers bursting from the popper | Pull the string at the end of a test: the party starts early. |
| Ribbon | **Streamer Bow** | `setbow`: knot star, tails streamers | curled paper streamers for tails and a gold star clasp | Every curl is a streamer saved from last year's festival. |
| Shoes | **Glitter-Trail Trainers** | `setshoe`: style trainer, sole glitter, laces accent | confetti glitter set into the soles | Wherever you dance, a little sparkle stays behind. |
| Hair Clip | **Confetti Clip** | `setclip`: ornament confetti | a clear capsule filled with confetti | A whole party, packed small enough to wear. |
| Necklace | **Party Locket** | `setlocket`: locket party | a clear locket with tiny lights inside | The lights blink in time with the loudest laugh in the room. |

### Treasurer (`treasurer`, money)

- **Motif:** the class treasurer's kit and a calculator.
- **Palette:** body `#5fd6a8`, accent `#eef3f8`, light `#8dffc9`; trim `silver`.
- **Material:** brushed silver and mint enamel, a green LCD.
- **Silhouette:** coins and ledgers: round silver coins, beads on a bangle, a calculator key, loafers with a coin buckle. Mint with silver; small dark LCD windows with green digits.

| Slot | Piece | Base and options | Hero detail | Lore |
|---|---|---|---|---|
| Charm | **Abacus Bracelet** | `bracelet` | abacus beads on a silver bangle | Slide a bead for every coin saved for the class trip. |
| Ribbon | **Coin-Clasp Ribbon** | `setbow`: knot coin, stripes 2, stripe white | a silver coin clasp over ruled ledger lines | The ruled lines always add up, and so does she. |
| Shoes | **Coin-Buckle Loafers** | `setshoe`: style loafer, buckle coin, strap accent | a coin buckle with a mint centre | Polished every morning, like the club accounts. |
| Hair Clip | **Calculator Clip** | `setclip`: ornament calc | a calculator key with a tiny LCD | Shows the class balance, always a little higher than last week. |
| Necklace | **Coin Locket** | `setlocket`: locket coin | a coin locket with a tiny LCD | The first coin of the class fund, kept safe and still counting. |

### Power Bank (`powerbank`, abilities)

- **Motif:** phone power banks and charge bars.
- **Palette:** body `#4446b8`, accent `#9be22e`, light `#b6ff4a`; trim `steel`.
- **Material:** matte indigo plastic, steel and lime charge LEDs.
- **Silhouette:** blocky rounded rectangles: an upright power bank on a cable, a wide battery cell, a plug, a bolt. Indigo with lime: stacked bars on the upright pieces, an upright gauge on the wide cell.

| Slot | Piece | Base and options | Hero detail | Lore |
|---|---|---|---|---|
| Charm | **Power Bank Keyring** | `keyring`: fob powerbank | four lime charge-bar LEDs and a short charging cable | Always full, because she always remembers to charge it. |
| Ribbon | **Charging-Cable Bow** | `setbow`: knot plug, tails cable, stripes 1 | a bow tied from a charging cable, the plug for a knot | Never tangled, never left behind in a classroom socket. |
| Shoes | **Charge-Bar Trainers** | `setshoe`: style trainer, side chargebars, laces accent | battery bars that fill along the side | The bars fill up as she runs: four bars, ready to go. |
| Hair Clip | **Lightning Clip** | `setclip`: ornament bolt, body #9be22e, accent #4446b8, light #eaffb0 | a lightning bolt with a glowing core | A quick charge for a sleepy morning. |
| Necklace | **Battery Locket** | `setlocket`: locket battery | a wide battery cell with a full charge gauge and a bolt | A full gauge means she has energy to spare for everyone. |
<!-- sets:end -->

## 4. How it is built

- **Rows:** `tools/blender/items/catalog.py` `GEAR_SETS` holds one row per set: name, role, motif, material, the set
  colours (`body`, `accent`, `light`, `glass`, `trim`) and one row per slot with its base, options, piece name, hero
  detail and lore, plus its silhouette rule. `GEAR_OPTIONS` lists what each base draws and `GEAR_REQUIRED` what it
  cannot draw without; `gear_design` refuses any other option name or value, a missing required option and a bad
  colour. `tools/blender/items/gear_sets.py --check` validates every row, probes the guard with bad rows, holds the
  six launch sets at `preview=True` and checks that §3 matches the rows (`tests/art` runs it).
- **Bases:** `tools/blender/items/models/gearset.py`: `keyring` (a fob on a split ring: pompom, token, compass, popper,
  powerbank), `bracelet` (abacus beads), `setbow` (knots: grille, chalk, protractor, star, coin, plug; tails: notched,
  streamers, cable; stripes), `setshoe` (trainer or loafer; soles: glow, grid, ticks, glitter; side: charge bars, a
  stripe; a loafer buckle: none, plain or coin; heel, laces, toe colours), `setclip` (pompom, pause button, set-square, confetti capsule, calculator key, bolt) and
  `setlocket` (heart, timer, crosshair, party, coin, battery; chain or cord). A new set that re-uses these options is
  rows only; a new form is a new option in `gearset.py`. The default gear looks are untouched.
- **Preview:** every row has `preview=True`, so `build_items.py -- gear_<set>_<slot> …` (or `--family gear-preview`)
  bakes into the scratch folder only. To ship a set: drop `preview` once `src/data/gearSets.js` has its id, run
  `--family gear`, and commit the files and the manifest; the tests accept `gear_<set>_<slot>` keys for the six set
  ids.

## 5. Budget

`public/art/items` holds 1.61 MB of the 2.2 MiB (2.31 MB) cap. The 30 set looks add about 0.45 MB and the default Hair
Clip and Necklace ladders about 0.17 MB, so the gear update reaches about 2.23 MB, leaving about 75 KB for the Set Box,
pin and lens icons (GEAR_UPDATE §3.3). Before the sets ship, either trim the 256 cuts of the item art (a lower WebP
quality on the busiest keys), or raise the cap with the owner's yes.

## 6. Owner questions (defaults in use)

1. **Spirit Squad's Light-Up Trainers are white with red trim** (the spec says "white"), so the shoes read less red
   than the other four pieces. Default: keep white; the hero detail is the glowing red sole.
2. **Treasurer's main colour is mint, with silver as the metal** (the spec lists "silver, mint"). With mint as the
   main colour the set never reads as a plain silver default piece at 22 px. Default: mint main.
3. **Power Bank's Lightning Clip is lime on indigo** (the other four pieces are indigo with lime): the bolt is the
   charge itself. Default: lime bolt.
4. **The Abacus Bracelet** is the only charm that is not a keyring or pendant (it follows the spec's name). Default:
   keep it.
5. **Set pieces show no rarity in the art** (spec §3.3), while default gear does (its approved ladder). Default: keep.
