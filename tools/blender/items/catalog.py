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
    crown_rainbow_shard='jagged chunk of the iridescent band with its rims, one whole cone point and one snapped off at an '
                        'angle (no ball tips), pink gem, deeper lilac shadow plane',
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
             'pearl plume with a deep-gold edge, gold cap, star', 'lilac-pearl plume (saturated shadow half), iridescent edge and cap'),
    blade=('steel shard with a notch: central ridge (lit left plane, shadow right plane), white glint strip on the lit plane, '
           'dark band on the shadow plane',
           'blue-steel shard, ridge, glint and dark band, silver collar and grip',
           'violet moonsteel shard with a crescent gem, silver collar', 'rose-steel shard (one colour on both planes), rose-gold collar',
           'gold-steel blade, gold guard, gem, star', 'lilac-pearl blade (saturated shadow plane), iridescent guard'),
    ember=('chunky warm-grey coal (clean facets) with glowing cracks (orange edge, yellow core, tapered), one pattern per tier',
           'the coal with its cracks and a small flame lick (blue core)',
           'the coal with a flame crown and an inset violet gem', 'the coal in a rose-gold setting (waist band, four claws), rose flame',
           'the coal and flame before a gold sun frame (ring and rays), inset gem, star',
           'lilac-pearl coal with a deeper lilac shadow plane, pink flame round a saturated orange core, iridescent sun frame'),
    rime=('three ice prisms on a snow-capped stone', 'feathery ice-blue crystal spray on a snow puff, silver frost ring',
          'lavender crystal cluster on a snow puddle', 'mint-to-violet crystal cluster on a rose-gold ring, inner glow',
          'big faceted ice heart in a slim gold band over a six-armed snowflake (broad flat arms, a V of two branches each, '
          'soft points), star',
          'lilac heart in a slim iridescent band over the iridescent snowflake'),
    charm=('paper omamori pouch, red cord knot, red stamped sakura', 'blue silk omamori, embroidered white sakura, silver cord ring',
           'violet omamori with a silver hand bell (dome, lip, clapper) and a gem knot',
           'rose-red lacquered tag, rose-gold cap, glowing sakura inlay',
           'cream silk omamori with gold trim, band and cord, pink sakura with an inset gem, star',
           'iridescent silk omamori with iridescent trim, sakura with an inset gem'),
    rune=('slate runestone (arched, chipped outline, thick side plane) with a chalk compass star in a carved groove',
          'cream runestone in a silver rim, glowing blue compass star in a carved groove',
          'lavender runestone, glowing compass star round an inset violet gem',
          'violet runestone with a star-dot constellation (a closed kite and a tail star), rose-gold rim',
          'violet runestone in a thick gold rim, glowing gold compass star with a gem, star',
          'lilac-pearl runestone (saturated lilac side plane) in an iridescent rim, deep violet compass star with a gem'),
    cog=('brass cog with one bent tooth, a real axle hole (inner wall), a glint strip on the lit edge',
         'blue-steel gear with a silver axle hub', 'steel coil spring on a steel gear base, violet end caps',
         'glowing aqua mainspring in a rose-gold gear housing', 'gold gear around a glowing cut-gem core, star',
         'lilac-pearl gear, iridescent core'),
)
for _fam, _rows in _MAT.items():
    for _t, _txt in zip(_TIERS, _rows):
        NOTES[f'mat_{_fam}_{_t}'] = _txt

_GEAR = dict(charm='rounded faceted diamond pendant in a bezel, short chain', ribbon='chunky satin bow with a knot clip and two tails',
             shoes='chunky sneaker: white toe cap and sole with toe spring, three fat laces, padded collar and tongue, heel counter')
_GEAR_TIER = dict(common='plain', rare='silver trim', superRare='silver trim + gem (shoes: wing)',
                  mythic='rose-gold trim + glow (shoes: wing)', legendary='gold trim + star (shoes: wing)',
                  ur='iridescent body (saturated shadow) and trim (shoes: wing)')
for _slot, _txt in _GEAR.items():
    for _t, _tt in _GEAR_TIER.items():
        NOTES[f'gear_{_slot}_{_t}'] = f'{_txt}; {_tt}'


def note(key):
    return NOTES.get(key, '')


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
