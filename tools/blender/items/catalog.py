"""Data table of the item art: one line per key describing its model (README table: build_items.py --table).
(appr.) marks the 13 keys rebuilt from the owner-approved icons; their approved files are the look targets. A key in
models.SHIPPED ships its approved file instead of the rebuild (PLAN C11)."""

APPROVED = ('book_common', 'book_rare', 'book_superRare', 'book_legendary', 'coins', 'gems', 'crown_rainbow', 'gearbox_mythic',
            'mat_rime_common', 'mat_rime_superRare', 'mat_rime_legendary', 'needle_star', 'ticket_recruit')

_TIERS = ('common', 'rare', 'superRare', 'mythic', 'legendary', 'zenith')

NOTES = dict(
    setbox_pick_mythic_random='Set Box (random): the gear box in pearl, a ring of the six set colours round a white sakura; rose-gold straps, pink gem',
    setbox_pick_legendary_random='Set Box (random): the gear box in pearl, a ring of the six set colours round a white sakura; gold straps, amber gem',
    setbox_pick_ur_random='Set Box (random): the gear box in pearl, a ring of the six set colours round a white sakura; rainbow straps and gem',
    setbox_pick_ur='Set Box (preset, UR): the gear box in pearl, a ring of the six set colours round a white sakura; rainbow straps and gem; the gold pencil tag',
    setbox_spirit_mythic_random='Set Box (random): the gear box in red, white pom crest; rose-gold straps, pink gem',
    setbox_spirit_legendary_random='Set Box (random): the gear box in red, white pom crest; gold straps, amber gem',
    setbox_spirit_ur_random='Set Box (random): the gear box in red, white pom crest; rainbow straps and gem',
    setbox_spirit_ur='Set Box (preset, UR): the gear box in red, white pom crest; rainbow straps and gem; the gold pencil tag',
    setbox_freezetag_mythic_random='Set Box (random): the gear box in ice blue, white pause-bars crest; rose-gold straps, pink gem',
    setbox_freezetag_legendary_random='Set Box (random): the gear box in ice blue, white pause-bars crest; gold straps, amber gem',
    setbox_freezetag_ur_random='Set Box (random): the gear box in ice blue, white pause-bars crest; rainbow straps and gem',
    setbox_freezetag_ur='Set Box (preset, UR): the gear box in ice blue, white pause-bars crest; rainbow straps and gem; the gold pencil tag',
    setbox_geometry_mythic_random='Set Box (random): the gear box in slate blue, white set-square crest; rose-gold straps, pink gem',
    setbox_geometry_legendary_random='Set Box (random): the gear box in slate blue, white set-square crest; gold straps, amber gem',
    setbox_geometry_ur_random='Set Box (random): the gear box in slate blue, white set-square crest; rainbow straps and gem',
    setbox_geometry_ur='Set Box (preset, UR): the gear box in slate blue, white set-square crest; rainbow straps and gem; the gold pencil tag',
    setbox_popper_mythic_random='Set Box (random): the gear box in purple, white star crest; rose-gold straps, pink gem',
    setbox_popper_legendary_random='Set Box (random): the gear box in purple, white star crest; gold straps, amber gem',
    setbox_popper_ur_random='Set Box (random): the gear box in purple, white star crest; rainbow straps and gem',
    setbox_popper_ur='Set Box (preset, UR): the gear box in purple, white star crest; rainbow straps and gem; the gold pencil tag',
    setbox_treasurer_mythic_random='Set Box (random): the gear box in mint, white coin crest; rose-gold straps, pink gem',
    setbox_treasurer_legendary_random='Set Box (random): the gear box in mint, white coin crest; gold straps, amber gem',
    setbox_treasurer_ur_random='Set Box (random): the gear box in mint, white coin crest; rainbow straps and gem',
    setbox_treasurer_ur='Set Box (preset, UR): the gear box in mint, white coin crest; rainbow straps and gem; the gold pencil tag',
    setbox_powerbank_mythic_random='Set Box (random): the gear box in lime, white bolt crest; rose-gold straps, pink gem',
    setbox_powerbank_legendary_random='Set Box (random): the gear box in lime, white bolt crest; gold straps, amber gem',
    setbox_powerbank_ur_random='Set Box (random): the gear box in lime, white bolt crest; rainbow straps and gem',
    setbox_powerbank_ur='Set Box (preset, UR): the gear box in lime, white bolt crest; rainbow straps and gem; the gold pencil tag',
    setbox_pick_mythic='Set Box (preset): the gear box in pearl, a ring of the six set colours round a white sakura; rose-gold straps, pink gem; the gold pencil tag',
    setbox_pick_legendary='Set Box (preset): the gear box in pearl, a ring of the six set colours round a white sakura; gold straps, amber gem; the gold pencil tag',
    setbox_spirit_mythic='Set Box (preset): the gear box in red, white pom crest; rose-gold straps, pink gem; the gold pencil tag',
    setbox_spirit_legendary='Set Box (preset): the gear box in red, white pom crest; gold straps, amber gem; the gold pencil tag',
    setbox_freezetag_mythic='Set Box (preset): the gear box in ice blue, white pause-bars crest; rose-gold straps, pink gem; the gold pencil tag',
    setbox_freezetag_legendary='Set Box (preset): the gear box in ice blue, white pause-bars crest; gold straps, amber gem; the gold pencil tag',
    setbox_geometry_mythic='Set Box (preset): the gear box in slate blue, white set-square crest; rose-gold straps, pink gem; the gold pencil tag',
    setbox_geometry_legendary='Set Box (preset): the gear box in slate blue, white set-square crest; gold straps, amber gem; the gold pencil tag',
    setbox_popper_mythic='Set Box (preset): the gear box in purple, white star crest; rose-gold straps, pink gem; the gold pencil tag',
    setbox_popper_legendary='Set Box (preset): the gear box in purple, white star crest; gold straps, amber gem; the gold pencil tag',
    setbox_treasurer_mythic='Set Box (preset): the gear box in mint, white coin crest; rose-gold straps, pink gem; the gold pencil tag',
    setbox_treasurer_legendary='Set Box (preset): the gear box in mint, white coin crest; gold straps, amber gem; the gold pencil tag',
    setbox_powerbank_mythic='Set Box (preset): the gear box in lime, white bolt crest; rose-gold straps, pink gem; the gold pencil tag',
    setbox_powerbank_legendary='Set Box (preset): the gear box in lime, white bolt crest; gold straps, amber gem; the gold pencil tag',
    tie_pin='gold tie bar over its back clip, a stamped sakura and a small pink gem',
    collar_pin='round pink enamel collar stud on a gold rim, gold centre boss, pressed petals, post behind',
    lens_nightglass='navy lens in a thick white-gold rim with a loop, a pale star and starlight specks, rim glint',
    book_common='kraft spiral notebook, pencil, pink star sticker, label with two blue lines',
    book_rare='blue hardcover, 2 silver corner guards, white label with a sakura, red ribbon',
    book_superRare='violet hardcover, 4 silver guards, silver medallion with a blossom and a violet gem, ring clasp',
    book_mythic='rose hardcover, rose-gold guards, rose-gold blossom medallion with a glowing pink core, clasp strap',
    book_legendary='teal hardcover, gold L-guards, gold sunburst medallion with a big cut gem and a star, gold strap with a stud',
    coins='two gold coins (hero + echo): rounded rim, groove, embossed cream sakura with a pearl, glint',
    gems='two faceted sakura-flower crystals (hero + echo), white blossom centre',
    recruitPoints='sakura rosette badge: a ring of petals, a gold star boss, two ribbon tails',
    token_bounty='thick mint token coin, embossed cream ring and blossom',
    token_boss='thick rose token coin, silver rim, embossed ivory horned mask',
    memento='heart locket on a violet ribbon loop, silver hinge, inset violet gem',
    moonpearl='lavender-white pearl in a gold crescent cradle, star glint',
    evt_halloween_candy='wrapped bright pumpkin candy (ribs as tone lines), lilac wrapper twists, carved smile, stem',
    ticket_recruit='pink stub with a gold star, white body with a sakura and three bars, perforation, notches',
    ticket_recruit10='fanned stack of three recruit tickets (rose-gold, violet, pink stubs) held by a rose-gold band',
    ticket_ssr_select='gold-foil ticket, cream stub, big pink star crest, iridescent edge stripe',
    star_fragment='chunky five-point star crystal and a splinter, pastel pink to violet facets, sparkle on the top tip',
    kindred_r='smooth glass drop (sky blue): darker top rim, light pooled low, crescent highlight, blossom inside, silver cap',
    kindred_sr='smooth glass drop (violet), blossom inside, silver cap with an inset gem',
    kindred_ssr='smooth glass drop (clear warm gold), blossom inside, gold cap, star',
    kindred_shard_ssr='warm-gold hexagonal crystal shard in a rose-gold collar (mythic), embossed pink sakura in a raised gold '
                      'rim on its front facet, a chip, sparkle on the lit edge',
    crown_slime='glossy green jelly crown, round cone points, silver ball finials, jelly drips',
    crown_iron='steel crown, round cone points, rivets, an inset red-violet gem',
    crown_cog='yellow-brass crown with steel gear teeth round the band, steel cogs on its points, aqua clock-face gem',
    crown_oni='red lacquer crown, round cone points, two ivory horns, rose-gold rims, glowing front gem',
    crown_dragon='ember-orange crown with thick wing-shaped points, gold rims, red gem with a star',
    crown_rainbow='iridescent crown: thick rainbow band with rims, five round cone points with pearl finials, three big gems',
    crown_rainbow_shard='curved slice of the Rainbow Crown ring (the band with its rims in one profile), one whole cone point '
                        'and one snapped low to a stump with a lighter flat break face, pink gem between them, a jagged '
                        'lighter break at each end of the band (no ball tips), deeper lilac shadow plane',
    gearbox_common='plain warm-grey chest, wood straps, lid closed, gear emblem',
    gearbox_rare='blue chest, silver straps, lid open 15 degrees on its hinge, cream lining sunk below the rim, gear emblem with a '
                 'blue gem',
    gearbox_superRare='violet chest, silver straps, lid open 15 degrees, sunk lining, gear emblem with a violet gem, violet gem in '
                      'the clasp',
    gearbox_mythic='pink chest, rose-gold straps and latch, lid open 15 degrees on its hinge, cream lining sunk below the rim, '
                   'gear emblem with a pink gem',
    gearbox_legendary='teal chest, gold straps, lid open 15 degrees, sunk lining, white-blue gem, star glint',
    gearbox_rainbow='lilac-pearl iridescent chest, iridescent straps, lid open 15 degrees, sunk lining, prism glints',
    dice_reroll='rounded light-blue die, white pips, a sakura on the top face',
    lock_pin='silver padlock with a violet-gem keyhole, pink-headed pin through it',
    dice_prism='chunky rounded d12 die in pastel iridescence, tilted, saturated violet shadow plane, big embossed rose-gold pips '
               '(1-3) on its front faces',
    seed_rainbow='iridescent seed with a green two-leaf sprout, prism glints',
    needle_star='bevelled gold four-point star (a ridge on each arm), steel needle behind it, pink thread through the eye',
    club_band='pink cloth armband loop with stitching and a rose-gold star badge',
)

_MAT = dict(
    feather=('curved brown sparrow feather: two vane halves (the far one in shadow), split barbs, cream quill',
             'sleek sky-blue plume, split barbs, silver quill cap',
             'violet barred quill, split barbs, silver cap with a violet gem',
             'red-orange plume with a cel-banded flame edge (yellow, orange) along its tip, rose-gold band, glowing shaft',
             'pearl plume with a deep-gold edge, gold cap with a star glint (none on the vane)',
             'lilac-pearl plume (saturated shadow half), iridescent edge and cap, glint on the cap'),
    blade=('steel shard with a notch: central ridge (lit left plane, shadow right plane), white glint strip on the lit plane, '
           'dark band on the shadow plane',
           'blue-steel shard, ridge, glint and dark band, silver collar and grip',
           'violet moonsteel shard with a crescent gem, silver collar', 'rose-steel shard (one colour on both planes), rose-gold collar',
           'gold-steel blade, gold guard, gem, star', 'lilac-pearl blade (saturated shadow plane), iridescent guard'),
    ember=('chunky warm-grey coal (clean facets, matte) with a glowing fissure cut in: sharp at both ends, widest in the '
           'middle, yellow core, orange edge, a darker rock lip below; one crack per tier',
           'the coal with its crack and a small flame lick (blue core)',
           'the coal with a flame crown and an inset violet gem', 'the coal in a rose-gold setting (waist band, four claws), rose flame',
           'the coal and flame before a gold sun frame (ring and rays), inset gem, star glint on the ring',
           'lilac mid-tone coal (near-white only on the lit top facet, violet shadow planes), pink flame round a saturated '
           'orange core, iridescent sun frame with a glint'),
    rime=('three ice prisms on a snow-capped stone', 'feathery ice-blue crystal spray on a snow puff, silver frost ring',
          'lavender crystal cluster on a snow puddle', 'mint-to-violet crystal cluster on a rose-gold ring, inner glow',
          'big faceted ice heart in a slim gold band over a six-armed snowflake (broad flat arms in light gold with a darker '
          'lower edge, a V of two branches each, soft points), star',
          'lilac heart in a slim iridescent band over the iridescent snowflake (deeper lilac arms, violet lower edge)'),
    charm=('paper omamori pouch, red cord knot, red stamped sakura', 'blue silk omamori, embroidered white sakura, silver cord ring',
           'violet omamori with a silver hand bell (dome, lip, clapper) and a gem knot',
           'rose-red lacquered tag, rose-gold cap, glowing sakura inlay',
           'cream silk omamori with gold trim, band and cord, pink sakura with an inset gem, star',
           'iridescent silk omamori with iridescent trim, sakura with an inset gem'),
    rune=('slate runestone (arched, chipped outline, thick side plane, matte) with a chalk compass star in a carved groove',
          'cream runestone with a thin silver inlay, glowing blue compass star in a carved groove',
          'lavender runestone, glowing compass star round an inset violet gem',
          'violet runestone with a thin rose-gold inlay, glowing rose-gold compass star round a pink gem',
          'violet runestone with a gold inlay, glowing gold compass star with a gem, star glint on the inlay',
          'lilac-pearl runestone (saturated lilac side plane) with an iridescent inlay, deep violet compass star with a gem'),
    cog=('warm brass cog with one bent tooth, a real axle hole (inner wall), a glint strip on the lit upper-left edge of '
         'the teeth and rim, a dark reflection band on the lower-right teeth',
         'blue-steel gear with a silver axle hub', 'steel coil spring on a steel gear base, violet end caps',
         'glowing aqua mainspring in a rose-gold gear housing', 'gold gear around a glowing cut-gem core, star',
         'lilac-pearl gear, iridescent core'),
)
for _fam, _rows in _MAT.items():
    for _t, _txt in zip(_TIERS, _rows):
        NOTES[f'mat_{_fam}_{_t}'] = _txt

# ---------------------------------------------------------------------------
# Gear (gearIcon: gear_<slot>_<rarity>, gear_<slot>_ur, and the set looks gear_<set>_<slot>)
# ---------------------------------------------------------------------------
# Three tables drive every gear icon. models/gear.py holds the base models (pendant, bow, sneaker, hairclip,
# necklace) and reads only these rows: a new slot on an existing base, a ladder tweak or a set look that re-skins a
# base is a row here. A design that needs a new form (a keyring, a bracelet, loafers...) is a new base in
# models/gear.py first.
#
# GEAR_SLOT_ART: one row per gear slot (src/data/types.js GEAR_SLOTS; the update's gearSlots.js SLOT_IDS) -> the base
#   model and its default design. A slot the game data does not have yet is a preview only (--family gear-preview
#   bakes it into the scratch folder, never into public/). What each base draws:
#   base      shape                                   motif (an emblem on the piece)
#   pendant   diamond, heart, round, star, blossom    sakura, star, heart, moon
#   necklace  diamond, heart, round, star, blossom    sakura, star, heart, moon
#   bow       classic, wide                           sakura, star, heart, moon
#   sneaker   low, high                               sakura, star, heart, moon
#   hairclip  blossom, heart (never a bow, a star or a snowflake: the gear update spec 2.1 and 3.3); the set looks'
#             ornaments: pom, pause, setsquare, confetti, calc, bolt
#   necklace  (also) the set lockets: megaphone, stopwatch, crosshair, popper, coin, battery
#   keyring   a set's charm: its ornament on a split keyring (shape: the hairclip's set ornaments)
#   emblem: a set look's ornament drawn as a badge (the bow's knot, the sneaker's side), shared by all five pieces
#   body: a fixed body colour (default: the rarity tint); trim: a fixed trim metal (set looks); note: the README line.
GEAR_SHAPES = dict(pendant=('diamond', 'heart', 'round', 'star', 'blossom'),
                   necklace=('diamond', 'heart', 'round', 'star', 'blossom', 'megaphone', 'stopwatch', 'crosshair',
                             'popper', 'coin', 'battery'),
                   bow=('classic', 'wide'), sneaker=('low', 'high'),
                   hairclip=('blossom', 'heart', 'pom', 'pause', 'setsquare', 'confetti', 'calc', 'bolt'),
                   keyring=('pom', 'pause', 'setsquare', 'confetti', 'calc', 'bolt'))
GEAR_MOTIFS = ('sakura', 'star', 'heart', 'moon')
GEAR_SLOT_ART = dict(
    charm=dict(base='pendant', shape='diamond', note='faceted diamond stone in a bezel on a short chain'),
    ribbon=dict(base='bow', shape='classic', note='chunky satin bow with a knot clip and two notched tails'),
    shoes=dict(base='sneaker', shape='low', note='chunky sneaker: white toe cap and sole, fat laces, padded collar, heel counter'),
    # the gear update's Hair Clip and Necklace (src/data/gearSlots.js SLOT_IDS; set pieces only, so mostly set looks)
    hair=dict(base='hairclip', shape='blossom', note='hair clip: a rounded bar clip with a sakura ornament at its end'),
    necklace=dict(base='necklace', shape='heart', note='heart pendant on a chain loop with a clasp'),
)

# GEAR_TIERS: the rarity ladder every slot shares (default looks). Rarity reads from shape and trim, not colour alone:
#   trim     metal of the bezel / clip / heel counter: pewter, silver, rose, gold, iri
#   gem      a set gem in the trim (its tier colour)            studs  ball studs on the frame points
#   crest    0 none; 1 a sakura blossom behind the stone / layered loops / a sole stripe;
#            2 sunburst rays / a star medallion / a gold toe rim (hair clip: a gold disc behind the flower)
#   shoe_wing  feathers in the sneaker's heel wing (0..4)         wings  feathers per side wing on every base (UR)
#   drop     a bead hanging below (never on the shoes)          glow   inner glow of the body
#   star     the 4-point glint (px at 256)
# 'set' is the ladder row of the set looks: one look per set and slot, rarity shows on the tile (and the UR ring).
GEAR_TIERS = dict(
    common=dict(trim='pewter', gem=False, studs=False, crest=0, shoe_wing=0, wings=0, drop=False, glow=0.0, star=0,
                note='plain: pewter trim'),
    rare=dict(trim='silver', gem=False, studs=False, crest=0, shoe_wing=0, wings=0, drop=False, glow=0.0, star=8,
              note='silver trim (charm: a bail cap)'),
    superRare=dict(trim='silver', gem=True, studs=True, crest=0, shoe_wing=2, wings=0, drop=False, glow=0.0, star=9,
                   note='silver trim, studs (ribbon: tail bands, shoes: eyelets) and a violet gem; shoes: a small wing'),
    mythic=dict(trim='rose', gem=True, studs=True, crest=1, shoe_wing=2, wings=0, drop=True, glow=0.3, star=10,
                note='rose-gold trim, a rose-gold sakura blossom behind the stone (ribbon: layered loops; shoes: a sole '
                     'stripe and a wing), glow'),
    legendary=dict(trim='gold', gem=True, studs=True, crest=2, shoe_wing=3, wings=0, drop=True, glow=0.3, star=12,
                   note='gold trim, sunburst rays (ribbon: a star medallion; shoes: a gold toe rim and a bigger wing), '
                        'star'),
    ur=dict(trim='iri', gem=True, studs=True, crest=2, shoe_wing=4, wings=4, drop=True, glow=0.35, star=13,
            note='iridescent body (saturated shadow) and trim, the legendary crest (the charm swaps its rays for the '
                 'wings) plus rainbow wings (one pastel per feather)'),
    set=dict(trim='silver', gem=True, studs=False, crest=0, shoe_wing=0, wings=0, drop=False, glow=0.0, star=10,
             note='set look (rarity on the tile)'),
)

# GEAR_SETS: one look per gear set and slot, gear_<set>_<slot> (the gear update spec 3.3: 6 sets x 5 slots). The set
# id is the piece's own `set` (SET_IDS in src/data/gearSets.js), never its club: a set is fixed per piece, a club is
# re-tagged by the armband and already shows as its emblem. Set ids are [a-z0-9]+ and never a slot or tier name.
# A row overrides the slot design per slot (any GEAR_SLOT_ART field: base, shape, motif, body, trim) and bakes every
# slot of GEAR_SLOT_ART the game has; gearIcon(slot, rarity, { set: g.set }) shows it and falls back to the default
# look while a set has no art. preview=True bakes into the scratch folder only.
GEAR_SETS = dict(
    sample=dict(preview=True, note='preview of a set look: a heart charm, a wide bow with a heart clip, high-tops',
                slots=dict(charm=dict(shape='heart', motif='heart', body='#ff7eb6'),
                           ribbon=dict(shape='wide', motif='heart', body='#ff7eb6'),
                           shoes=dict(shape='high', motif='heart', body='#ff7eb6'),
                           hair=dict(shape='heart', body='#ff7eb6'),
                           necklace=dict(shape='heart', motif='heart', body='#ff7eb6'))),
    # The six sets' five pieces: one motif per set (its ornament) shared by all five, in the set colour (src/data/
    # gearSets.js) with white and gold trim (docs/art/tripo/chrome-batch-1.md rows 2-13 for the Hair Clip and Necklace):
    # the charm is the ornament on a keyring, the ribbon and the shoes wear it as a badge, the Hair Clip carries it and
    # the Necklace is the set's locket. A set row bakes only the slots it lists.
    spirit=dict(note='Spirit Squad: the Pom Clip (a cheer pom-pom) and the Spirit Locket (a heart with a megaphone)',
                slots=dict(charm=dict(base='keyring', shape='pom', body='#e5484d', trim='gold'),
                           ribbon=dict(shape='classic', body='#e5484d', trim='gold', emblem='pom'),
                           shoes=dict(shape='high', body='#e5484d', trim='gold', emblem='pom'),
                           hair=dict(shape='pom', body='#e5484d', trim='gold'),
                           necklace=dict(shape='megaphone', body='#e5484d', trim='gold'))),
    freezetag=dict(note='Freeze Tag: the Pause-Button Clip and the Tag Timer (a pendant stopwatch)',
                   slots=dict(charm=dict(base='keyring', shape='pause', body='#5fb4e8', trim='gold'),
                           ribbon=dict(shape='classic', body='#5fb4e8', trim='gold', emblem='pause'),
                           shoes=dict(shape='low', body='#5fb4e8', trim='gold', emblem='pause'),
                           hair=dict(shape='pause', body='#5fb4e8', trim='gold'),
                              necklace=dict(shape='stopwatch', body='#5fb4e8', trim='gold'))),
    geometry=dict(note='Geometry Set: the Set-Square Clip and the Crosshair Locket',
                  slots=dict(charm=dict(base='keyring', shape='setsquare', body='#5a6fa8', trim='gold'),
                           ribbon=dict(shape='classic', body='#5a6fa8', trim='gold', emblem='setsquare'),
                           shoes=dict(shape='low', body='#5a6fa8', trim='gold', emblem='setsquare'),
                           hair=dict(shape='setsquare', body='#5a6fa8', trim='gold'),
                             necklace=dict(shape='crosshair', body='#5a6fa8', trim='gold'))),
    popper=dict(note='Party Popper: the Confetti Clip and the Party Locket (a party popper)',
                slots=dict(charm=dict(base='keyring', shape='confetti', body='#9b5de5', trim='gold'),
                           ribbon=dict(shape='wide', body='#9b5de5', trim='gold', emblem='confetti'),
                           shoes=dict(shape='high', body='#9b5de5', trim='gold', emblem='confetti'),
                           hair=dict(shape='confetti', body='#9b5de5', trim='gold'),
                           necklace=dict(shape='popper', body='#9b5de5', trim='gold'))),
    treasurer=dict(note='Treasurer: the Calculator Clip and the Coin Locket (a gold coin with a sakura stamp)',
                   slots=dict(charm=dict(base='keyring', shape='calc', body='#9fd8c4', trim='gold'),
                           ribbon=dict(shape='classic', body='#9fd8c4', trim='gold', emblem='calc'),
                           shoes=dict(shape='low', body='#9fd8c4', trim='gold', emblem='calc'),
                           hair=dict(shape='calc', body='#9fd8c4', trim='gold'),
                              necklace=dict(shape='coin', body='#9fd8c4', trim='gold'))),
    powerbank=dict(note='Power Bank: the Lightning Clip and the Battery Locket (a charge bar)',
                   slots=dict(charm=dict(base='keyring', shape='bolt', body='#8bd13a', trim='gold'),
                           ribbon=dict(shape='wide', body='#8bd13a', trim='gold', emblem='bolt'),
                           shoes=dict(shape='high', body='#8bd13a', trim='gold', emblem='bolt'),
                           hair=dict(shape='bolt', body='#8bd13a', trim='gold'),
                              necklace=dict(shape='battery', body='#8bd13a', trim='gold'))),
)

GEAR_TIER_ORDER = ('common', 'rare', 'superRare', 'mythic', 'legendary', 'ur')


def gear_key(slot, tier=None, gear_set=None):
    return f'gear_{gear_set}_{slot}' if gear_set else f'gear_{slot}_{tier}'


def gear_parse(key):
    """(slot, tier, set or None) of a gear art key, or None. A set look is (slot, 'set', set id)."""
    parts = key.split('_')
    if len(parts) != 3 or parts[0] != 'gear':
        return None
    if parts[2] in GEAR_TIER_ORDER:
        return parts[1], parts[2], None
    if parts[2] in GEAR_SLOT_ART and parts[1] in GEAR_SETS:
        return parts[2], 'set', parts[1]
    return None


def gear_design(slot, gear_set=None):
    d = dict(GEAR_SLOT_ART[slot])
    if gear_set:
        d.update(GEAR_SETS[gear_set]['slots'].get(slot, {}))
    base = d['base']
    if d.get('shape') not in GEAR_SHAPES[base]:
        raise ValueError(f"gear {slot}/{gear_set}: shape {d.get('shape')!r} is not drawn by {base} {GEAR_SHAPES[base]}")
    if d.get('motif') and (d['motif'] not in GEAR_MOTIFS or base == 'hairclip'):
        raise ValueError(f"gear {slot}/{gear_set}: motif {d['motif']!r} is not drawn by {base}")
    return d


def gear_rows(slots, names=None, preview=False):
    """Extra build rows: the set looks of the game slots and, with preview, the preview slots and sets (their rows
    are kind='calibration', so they bake into the scratch folder only)."""
    names = names or {}
    out = []

    def row(slot, tier, gear_set, prev):
        label = names.get(slot, slot.capitalize())
        r = 'superRare' if tier == 'set' else 'legendary' if tier == 'ur' else tier
        return dict(key=gear_key(slot, tier, gear_set), kind='calibration' if prev else 'gear',
                    name=f"{label} ({gear_set + ' set' if gear_set else 'UR' if tier == 'ur' else tier})",
                    category='gear', rarity=r, family=slot, tier='', display='ur' if tier == 'ur' else '',
                    rainbow=tier == 'ur')
    for gs, srow in GEAR_SETS.items():
        if gs in GEAR_SLOT_ART or gs in GEAR_TIER_ORDER or not gs.isalnum() or gs != gs.lower():
            raise ValueError(f'gear set id {gs!r}: [a-z0-9]+, never a slot or tier name')
        if srow.get('preview') and not preview:
            continue
        for slot in GEAR_SLOT_ART:
            if (slot in slots or preview) and (srow.get('preview') or slot in srow['slots']):
                out.append(row(slot, 'set', gs, bool(srow.get('preview')) or slot not in slots))
    if preview:
        for slot in GEAR_SLOT_ART:
            if slot not in slots:
                out += [row(slot, t, None, True) for t in GEAR_TIER_ORDER]
    return out


def _gear_note(key):
    g = gear_parse(key)
    if not g or g[0] not in GEAR_SLOT_ART:
        return ''
    slot, tier, gs = g
    d = gear_design(slot, gs)
    extra = []
    if d.get('shape') != GEAR_SLOT_ART[slot].get('shape'):
        extra.append(f"{d['shape']} shape")
    if d.get('motif'):
        extra.append(f"{d['motif']} motif")
    if d.get('body'):
        extra.append(f"body {d['body']}")
    if d.get('trim'):
        extra.append(f"{d['trim']} trim")
    tail = ', a drop bead' if GEAR_TIERS[tier]['drop'] and d['base'] != 'sneaker' else ''   # the sneaker draws none
    return d['note'] + (' (' + ', '.join(extra) + ')' if extra else '') + '; ' + GEAR_TIERS[tier]['note'] + tail


def note(key):
    return NOTES.get(key) or _gear_note(key)


def table(rows, family, small_cut, shipped=()):
    """Markdown table for the README."""
    out = ['| Key | Name | Family | Tier | Files | Model |', '|---|---|---|---|---|---|']
    for r in rows:
        k = r['key']
        tier = 'zenith' if r.get('tier') == 'zenith' else ('ur' if r.get('display') == 'ur' or k.endswith('_ur') else r['rarity'])
        if r.get('rainbow') and tier != 'ur':
            tier += ' (rainbow)'
        files = '256, 128' + (', small' if k in small_cut else '')
        appr = ' (appr.)' if k in APPROVED else ''
        if k in shipped:
            appr = ' (appr.; ships the approved file, PLAN C11; this model only with --no-ship)'
        out.append(f"| `{k}` | {r['name']} | {family(k)} | {tier} | {files} | {note(k)}{appr} |")
    return '\n'.join(out)
