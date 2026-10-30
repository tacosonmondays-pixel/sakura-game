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
# Gear (gearIcon: gear_<slot>_<rarity>, gear_<slot>_ur, gear_<slot>_<rarity|ur>_<set>)
# ---------------------------------------------------------------------------
# Three tables drive every gear icon; models/gear.py holds the base models and reads only these rows, so a new
# slot, a new set look or a ladder tweak is a row here, never new code.
#
# GEAR_SLOT_ART: one row per gear slot (src/data/types.js GEAR_SLOTS) -> the base model and its default design.
#   base: pendant | bow | sneaker | hairclip | necklace (models/gear.py BASES).
#   shape: the base's main form (pendant / necklace: diamond, heart, round, star, blossom, drop;
#          hairclip: blossom, star, heart, bow; bow: classic, wide; sneaker: low, high).
#   motif: an emblem on the piece (sakura, star, heart, note, moon, none), body: a fixed body colour (default:
#   the rarity tint), note: the README line. A slot in this table that the game data does not have yet is a
#   preview only (--family gear-preview bakes it into the scratch folder, never into public/).
GEAR_SLOT_ART = dict(
    charm=dict(base='pendant', shape='diamond', note='faceted diamond stone in a bezel on a short chain'),
    ribbon=dict(base='bow', shape='classic', note='chunky satin bow with a knot clip and two notched tails'),
    shoes=dict(base='sneaker', shape='low', note='chunky sneaker: white toe cap and sole, fat laces, padded collar, heel counter'),
    # the coming gear update (preview until GEAR_SLOTS has them; rename the key to the slot id it ships with)
    hair=dict(base='hairclip', shape='blossom', note='hair clip: a rounded bar clip with a sakura ornament at its end'),
    necklace=dict(base='necklace', shape='heart', note='heart pendant on a chain loop with a clasp'),
)

# GEAR_TIERS: the rarity ladder every slot and set shares. Rarity reads from shape and trim, not colour alone:
#   trim     metal of the bezel / clip / heel counter: pewter, silver, rose, gold, iri
#   gem      a set gem in the trim (its tier colour)            studs  ball studs on the frame points
#   crest    0 none, 1 petals / layered loops / sole stripe, 2 sunburst rays / star medallion / gold toe bumper
#   wings    0..4 feathers per wing (UR: one pastel per feather)  drop  a bead hanging below
#   glow     inner glow of the body                             star   the 4-point glint (px at 256)
#   sparkle  extra small glints round the piece (UR)
GEAR_TIERS = dict(
    common=dict(trim='pewter', gem=False, studs=False, crest=0, wings=0, drop=False, glow=0.0, star=0, sparkle=0,
                note='plain: pewter trim'),
    rare=dict(trim='silver', gem=False, studs=False, crest=0, wings=0, drop=False, glow=0.0, star=8, sparkle=0,
              note='silver trim'),
    superRare=dict(trim='silver', gem=True, studs=True, crest=0, wings=0, drop=False, glow=0.0, star=9, sparkle=0,
                   note='silver trim, studs and a violet gem'),
    mythic=dict(trim='rose', gem=True, studs=True, crest=1, wings=0, drop=True, glow=0.3, star=10, sparkle=0,
                note='rose-gold trim, petal crest (bow: layered loops; shoes: stripe and small wings), drop bead, glow'),
    legendary=dict(trim='gold', gem=True, studs=True, crest=2, wings=0, drop=True, glow=0.3, star=12, sparkle=0,
                   note='gold trim, sunburst rays (bow: star medallion; shoes: gold bumper and wings), drop bead, star'),
    ur=dict(trim='iri', gem=True, studs=True, crest=2, wings=4, drop=True, glow=0.35, star=13, sparkle=2,
            note='iridescent body (saturated shadow) and trim, the legendary crest (the charm swaps its rays for the wings) plus rainbow wings (one pastel per feather) and sparkles'),
)

# GEAR_SETS: a custom look per gear set (a club id in src/data/clubs.js). A row overrides the slot design per slot
# (any GEAR_SLOT_ART field: shape, motif, body, even base) and bakes gear_<slot>_<rarity|ur>_<set> for every slot
# and tier; gearIcon(slot, rarity, { set }) shows it and falls back to the default look while a set has no art.
# preview=True bakes into the scratch folder only (for trying a look before the set ships).
GEAR_SETS = dict(
    sample=dict(preview=True, note='preview of a set look: a heart charm, a wide bow with a heart clip, high-tops',
                slots=dict(charm=dict(shape='heart', motif='heart', body='#ff7eb6'),
                           ribbon=dict(shape='wide', motif='heart', body='#ff7eb6'),
                           shoes=dict(shape='high', motif='heart', body='#ff7eb6'))),
)

GEAR_TIER_ORDER = ('common', 'rare', 'superRare', 'mythic', 'legendary', 'ur')


def gear_key(slot, tier, gear_set=None):
    return f'gear_{slot}_{tier}' + (f'_{gear_set}' if gear_set else '')


def gear_parse(key):
    """(slot, tier, set or None) of a gear art key, or None."""
    parts = key.split('_')
    if len(parts) not in (3, 4) or parts[0] != 'gear' or parts[2] not in GEAR_TIER_ORDER:
        return None
    return parts[1], parts[2], (parts[3] if len(parts) == 4 else None)


def gear_design(slot, gear_set=None):
    d = dict(GEAR_SLOT_ART[slot])
    if gear_set:
        d.update(GEAR_SETS[gear_set]['slots'].get(slot, {}))
    return d


def gear_rows(slots, names=None, preview=False):
    """Extra build rows: the set keys of the game slots and, with preview, the preview slots and sets (their
    rows are kind='calibration', so they bake into the scratch folder only)."""
    names = names or {}
    out = []

    def row(slot, tier, gear_set, prev):
        r = 'legendary' if tier == 'ur' else tier
        label = names.get(slot, slot.capitalize())
        return dict(key=gear_key(slot, tier, gear_set), kind='calibration' if prev else 'gear',
                    name=f"{label} ({'UR' if tier == 'ur' else tier}{', ' + gear_set if gear_set else ''})",
                    category='gear', rarity=r, family=slot, tier='', display='ur' if tier == 'ur' else '', rainbow=tier == 'ur')
    for gs, srow in GEAR_SETS.items():
        if srow.get('preview') and not preview:
            continue
        for slot in GEAR_SLOT_ART:
            if slot not in slots and not preview:
                continue
            for t in GEAR_TIER_ORDER:
                out.append(row(slot, t, gs, srow.get('preview') or slot not in slots))
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
    return d['note'] + (' (' + ', '.join(extra) + ')' if extra else '') + '; ' + GEAR_TIERS[tier]['note']


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
