"""Data table of the item art: one line per key describing its model (README table: build_items.py --table).
(appr.) marks the 13 keys rebuilt from the owner-approved icons; their approved files are the look targets. A key in
models.SHIPPED ships its approved file instead of the rebuild (PLAN C11)."""

APPROVED = ('book_common', 'book_rare', 'book_superRare', 'book_legendary', 'coins', 'gems', 'crown_rainbow', 'gearbox_mythic',
            'mat_rime_common', 'mat_rime_superRare', 'mat_rime_legendary', 'needle_star', 'ticket_recruit')

_TIERS = ('common', 'rare', 'superRare', 'mythic', 'legendary', 'zenith')

NOTES = dict(
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
#   hairclip  blossom, heart (never a bow, a star or a snowflake: the gear update spec 2.1 and 3.3)
#   body: a fixed body colour (default: the rarity tint); trim: a fixed trim metal (set looks); note: the README line.
GEAR_SHAPES = dict(pendant=('diamond', 'heart', 'round', 'star', 'blossom'),
                   necklace=('diamond', 'heart', 'round', 'star', 'blossom'),
                   bow=('classic', 'wide'), sneaker=('low', 'high'), hairclip=('blossom', 'heart'))
GEAR_MOTIFS = ('sakura', 'star', 'heart', 'moon')
GEAR_SLOT_ART = dict(
    charm=dict(base='pendant', shape='diamond', note='faceted diamond stone in a bezel on a short chain'),
    ribbon=dict(base='bow', shape='classic', note='chunky satin bow with a knot clip and two notched tails'),
    shoes=dict(base='sneaker', shape='low', note='chunky sneaker: white toe cap and sole, fat laces, padded collar, heel counter'),
    # the gear update's Hair Clip and Necklace (preview until GEAR_SLOTS has them)
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
    # The six launch sets (docs/specs/GEAR_SET_LOOKS.md; names from docs/specs/GEAR_UPDATE.md 3.3). Set-level colours
    # (body, accent, light, trim, glass) apply to every slot; a slot row adds its base, options and story fields
    # (piece, hero, lore: data for the spec and the boards, not drawn). preview=True until the sets ship.
    spirit=dict(preview=True, silhouette='round and fluffy: pom-pom puffs, a heart, a bright white trainer. Red over white reads first; gold is only the pins and the ring.',
             name='Spirit Squad', role='support',
                motif='the spirit squad at a match: pom-poms and light-up gear',
                material='glossy cheer satin and enamel on gold pins', body='#e8364f', accent='#ffffff', light='#ff9fb0',
                trim='gold', note='cherry red and white, gold pins, soft red lights',
                slots=dict(
                    charm=dict(base='keyring', fob='pompom', piece='Pom-Pom Keyring',
                               hero='a light-up bead in the pom-pom cap',
                               lore='Shake it once and the bead glows: the whole stand knows you are cheering.'),
                    ribbon=dict(base='setbow', knot='grille', stripes=2, stripe='white', piece='Cheer Bow',
                                hero='a tiny speaker-grille knot',
                                lore='The knot hums the school song at exactly the volume a teacher allows.'),
                    shoes=dict(base='setshoe', style='trainer', sole='glow', heel='accent', laces='accent',
                               body='#f3f5fa', accent='#e8364f', light='#f0284a', piece='Light-Up Trainers',
                               hero='soles that glow cherry red with each step',
                               lore='Every jump leaves a little red flash on the gym floor.'),
                    hair=dict(base='setclip', ornament='pompom', piece='Pom Clip',
                              hero='a mini pom-pom with a glowing bead',
                              lore='Small enough for class, loud enough for the final whistle.'),
                    necklace=dict(base='setlocket', locket='heart', light='#ffd1da', piece='Spirit Locket',
                                  hero='a heart locket with a soft status light',
                                  lore='Its light stays on while a friend is still cheering for you.'))),
    freezetag=dict(preview=True, silhouette="round and flat: a token, a pause button, a round timer, all ice blue with one coral mark each (never across a ring's centre). Chalk white lines, never a snowflake or an ice crystal.",
             name='Freeze Tag', role='control',
                   motif='playground freeze tag: chalk lines and a tag timer',
                   material='frosted acrylic, chalk white and a coral tag stripe', body='#7cc7f0', accent='#ff7a6b',
                   light='#ff7a6b', trim='silver', note='ice blue, chalk white, coral',
                   slots=dict(
                       charm=dict(base='keyring', fob='token', piece='Tag Token',
                                  hero='a chalk ring and a coral LED dot',
                                  lore='Tap it to someone and they have to hold still: playground rules.'),
                       ribbon=dict(base='setbow', knot='chalk', stripes=2, stripe='white', piece='Chalk-Line Ribbon',
                                   hero='white chalk lines and a coral tag band on the knot',
                                   lore='Drawn like the court lines, so you always know where safe is.'),
                       shoes=dict(base='setshoe', style='trainer', sole='grid', side='stripe',
                                  piece='Hopscotch Sneakers', hero='a hopscotch grid along the soles',
                                  lore='One, two, freeze: the soles count your steps for you.'),
                       hair=dict(base='setclip', ornament='button', piece='Pause-Button Clip',
                                 hero='a round pause button with coral bars',
                                 lore='Press pause on the whole game, just for a moment.'),
                       necklace=dict(base='setlocket', locket='timer', cord='cord', piece='Tag Timer',
                                     hero='a round countdown display on a coral cord',
                                     lore='Ten seconds frozen, then everybody runs again.'))),
    geometry=dict(preview=True, silhouette='straight lines and circles: a compass, a protractor arc, a set-square standing on its clip, a crosshair window, ruler-tick soles. Teal slate with brass edges and one cyan dot per piece.',
             name='Geometry Set', role='precision',
                  motif='the maths geometry kit and a cyan laser dot',
                  material='brushed brass on teal slate, cyan laser glass', body='#4a7c92', accent='#34e0ff',
                  light='#5ff0ff', trim='brass', glass='#c4f4ff', note='teal slate, brass, a cyan laser dot',
                  slots=dict(
                      charm=dict(base='keyring', fob='compass', piece='Compass Keyring',
                                 hero='a compass needle and a laser-dot lens on the rim',
                                 lore='It never points north: it points at the answer.'),
                      ribbon=dict(base='setbow', knot='protractor', piece='Protractor Ribbon',
                                  hero='a brass protractor arc for a clasp',
                                  lore='Tied at exactly ninety degrees, every morning.'),
                      shoes=dict(base='setshoe', style='loafer', sole='ticks', strap='dark', piece='Ruler-Step Loafers',
                                 hero='ruler ticks along brass soles',
                                 lore='Every step measured, every corner square.'),
                      hair=dict(base='setclip', ornament='setsquare', piece='Set-Square Clip',
                                hero='a set-square with a window and ruler ticks',
                                lore='Keeps a fringe perfectly straight and a sight line perfectly clear.'),
                      necklace=dict(base='setlocket', locket='crosshair', piece='Crosshair Locket',
                                    hero='a round window with a crosshair and a laser dot',
                                    lore='Look through it and the target is already centred.'))),
    popper=dict(preview=True, silhouette='bursting outward: a cone with streamers, curled streamer tails, a confetti capsule. Magenta-violet and gold with small multicolour confetti; the only set with loose streamers.',
             name='Party Popper', role='crowd',
                motif='a class party: poppers, streamers and confetti',
                material='magenta-violet foil and warm gold with fibre-optic sparkle', body='#c23dbf', accent='#f6c04a',
                light='#ffe27a', trim='gold', glass='#efe6ff', note='magenta-violet and warm gold, confetti colours',
                slots=dict(
                    charm=dict(base='keyring', fob='popper', piece='Popper Keyring',
                               hero='fibre-optic streamers bursting from the popper',
                               lore='Pull the string at the end of a test: the party starts early.'),
                    ribbon=dict(base='setbow', knot='star', tails='streamers', piece='Streamer Bow',
                                hero='curled paper streamers for tails and a gold star clasp',
                                lore="Every curl is a streamer saved from last year's festival."),
                    shoes=dict(base='setshoe', style='trainer', sole='glitter', laces='accent',
                               piece='Glitter-Trail Trainers', hero='confetti glitter set into the soles',
                               lore='Wherever you dance, a little sparkle stays behind.'),
                    hair=dict(base='setclip', ornament='confetti', piece='Confetti Clip',
                              hero='a clear capsule filled with confetti',
                              lore='A whole party, packed small enough to wear.'),
                    necklace=dict(base='setlocket', locket='party', piece='Party Locket',
                                  hero='a clear locket with tiny lights inside',
                                  lore='The lights blink in time with the loudest laugh in the room.'))),
    treasurer=dict(preview=True, silhouette='coins and ledgers: round silver coins, beads on a bangle, a calculator key, loafers with a coin buckle. Mint with silver; small dark LCD windows with green digits.',
             name='Treasurer', role='money', motif="the class treasurer's kit and a calculator",
                   material='brushed silver and mint enamel, a green LCD', body='#5fd6a8', accent='#eef3f8',
                   light='#8dffc9', trim='silver', note='mint and silver, a green LCD',
                   slots=dict(
                       charm=dict(base='bracelet', piece='Abacus Bracelet', hero='abacus beads on a silver bangle',
                                  lore='Slide a bead for every coin saved for the class trip.'),
                       ribbon=dict(base='setbow', knot='coin', stripes=2, stripe='white', piece='Coin-Clasp Ribbon',
                                   hero='a silver coin clasp over ruled ledger lines',
                                   lore='The ruled lines always add up, and so does she.'),
                       shoes=dict(base='setshoe', style='loafer', buckle='coin', strap='accent',
                                  piece='Coin-Buckle Loafers', hero='a coin buckle with a mint centre',
                                  lore='Polished every morning, like the club accounts.'),
                       hair=dict(base='setclip', ornament='calc', piece='Calculator Clip',
                                 hero='a calculator key with a tiny LCD',
                                 lore='Shows the class balance, always a little higher than last week.'),
                       necklace=dict(base='setlocket', locket='coin', piece='Coin Locket',
                                     hero='a coin locket with a tiny LCD',
                                     lore='The first coin of the class fund, kept safe and still counting.'))),
    powerbank=dict(preview=True, silhouette='blocky rounded rectangles: an upright power bank on a cable, a wide battery cell, a plug, a bolt. Indigo with lime: stacked bars on the upright pieces, an upright gauge on the wide cell.',
             name='Power Bank', role='abilities', motif='phone power banks and charge bars',
                   material='matte indigo plastic, steel and lime charge LEDs', body='#4446b8', accent='#9be22e',
                   light='#b6ff4a', trim='steel', note='indigo and lime charge green',
                   slots=dict(
                       charm=dict(base='keyring', fob='powerbank', piece='Power Bank Keyring',
                                  hero='four lime charge-bar LEDs and a port',
                                  lore='Always full, because she always remembers to charge it.'),
                       ribbon=dict(base='setbow', knot='plug', tails='cable', stripes=1, piece='Charging-Cable Bow',
                                   hero='a bow tied from a charging cable, the plug for a knot',
                                   lore='Never tangled, never left behind in a classroom socket.'),
                       shoes=dict(base='setshoe', style='trainer', side='chargebars', laces='accent',
                                  piece='Charge-Bar Trainers', hero='battery bars that fill along the side',
                                  lore='The bars fill up as she runs: four bars, ready to go.'),
                       hair=dict(base='setclip', ornament='bolt', body='#9be22e', accent='#4446b8', light='#eaffb0',
                                 piece='Lightning Clip', hero='a lightning bolt with a glowing core',
                                 lore='A quick charge for a sleepy morning.'),
                       necklace=dict(base='setlocket', locket='battery', piece='Battery Locket',
                                     hero='a battery showing a full charge',
                                     lore='Four bars means she has energy to spare for everyone.'))),
)

# The options each set-look base draws (gear_design refuses any other option name or value; REQUIRED names the options
# a base cannot draw without).
GEAR_OPTIONS = dict(
    keyring=dict(fob=('pompom', 'token', 'compass', 'popper', 'powerbank')),
    bracelet=dict(),
    setbow=dict(knot=('plain', 'grille', 'chalk', 'protractor', 'star', 'coin', 'plug'),
                tails=('notched', 'streamers', 'cable'), stripes=(0, 1, 2, 3)),
    setshoe=dict(style=('trainer', 'loafer'), sole=('plain', 'glow', 'grid', 'ticks', 'glitter'),
                 side=('none', 'chargebars', 'stripe'), buckle=('none', 'coin', 'plain'), heel=('trim', 'accent'),
                 laces=('white', 'accent'), toe=('white', 'body')),
    setclip=dict(ornament=('pompom', 'button', 'setsquare', 'confetti', 'calc', 'bolt')),
    setlocket=dict(locket=('heart', 'timer', 'crosshair', 'party', 'coin', 'battery'), cord=('chain', 'cord')),
)
GEAR_REQUIRED = dict(keyring=('fob',), setclip=('ornament',), setlocket=('locket',))
GEAR_SET_FIELDS = ('body', 'accent', 'light', 'trim', 'glass')   # set-level colours every slot inherits
GEAR_STORY_FIELDS = ('base', 'piece', 'hero', 'lore', 'note')    # set slot-row fields that are data, not drawing
GEAR_TRIM_NAMES = ('pewter', 'silver', 'rose', 'gold', 'iri', 'brass', 'steel')
GEAR_ROLES = ('accent', 'white', 'trim', 'body', 'dark')         # stripe / strap paint roles

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
    srow = GEAR_SETS[gear_set] if gear_set else None
    row = srow['slots'].get(slot, {}) if srow else {}
    if srow:
        d.update({k: srow[k] for k in GEAR_SET_FIELDS if k in srow})
        d.update(row)
    base = d['base']
    where = f'gear {slot}/{gear_set}'
    for k in GEAR_SET_FIELDS:                            # colours: a hex, or a trim metal by name
        v = d.get(k)
        if v is None:
            continue
        ok = isinstance(v, str) and len(v) == 7 and v[0] == '#' and all(c in '0123456789abcdefABCDEF' for c in v[1:])
        if not ok and not (k == 'trim' and v in GEAR_TRIM_NAMES):
            raise ValueError(f'{where}: {k} {v!r} is not a #rrggbb colour' + (' or a trim name' if k == 'trim' else ''))
    if base in GEAR_OPTIONS:
        known = set(GEAR_OPTIONS[base]) | set(GEAR_SET_FIELDS) | set(GEAR_STORY_FIELDS) | {'stripe', 'strap'}
        unknown = sorted(k for k in row if k not in known)   # the slot row's own names (not the inherited defaults)
        if unknown:
            raise ValueError(f'{where}: {base} draws no option named {unknown} (it draws {sorted(GEAR_OPTIONS[base])})')
        missing = [k for k in GEAR_REQUIRED.get(base, ()) if k not in d]
        if missing:
            raise ValueError(f'{where}: {base} needs {missing}')
        for field, allowed in GEAR_OPTIONS[base].items():
            if field in d and d[field] not in allowed:
                raise ValueError(f'{where}: {field} {d[field]!r} is not drawn by {base} {allowed}')
        for field in ('stripe', 'strap'):
            if field in d and d[field] not in GEAR_ROLES:
                raise ValueError(f'{where}: {field} {d[field]!r} is not one of {GEAR_ROLES}')
        return d
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
            if slot in slots or preview:
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
    if d.get('piece'):                                   # a set look: its piece name and hero detail
        return f"{GEAR_SETS[gs]['name']}: {d['piece']}, {d['hero']}"
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
