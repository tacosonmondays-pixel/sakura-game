"""Data table of the item art: one line per key describing its model (README table: build_items.py --table).
(appr.) marks the 13 keys rebuilt from the owner-approved icons; their approved files are the look targets."""

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
    evt_halloween_candy='wrapped pumpkin candy, violet wrapper twists, carved smile, stem',
    ticket_recruit='pink stub with a gold star, white body with a sakura and three bars, perforation, notches',
    ticket_recruit10='fanned stack of three recruit tickets (rose-gold, violet, pink stubs) held by a rose-gold band',
    ticket_ssr_select='gold-foil ticket, cream stub, big pink star crest, iridescent edge stripe',
    star_fragment='chunky five-point star crystal and a splinter, pastel pink to violet facets',
    kindred_r='faceted teardrop crystal (sky blue) with a white blossom, silver cap',
    kindred_sr='faceted teardrop crystal (violet) with a white blossom, silver cap with an inset gem',
    kindred_ssr='faceted teardrop crystal (warm gold, iridescent) with a white blossom, gold cap, star',
    kindred_shard_ssr='gold-iridescent crystal splinter and a chip',
    crown_slime='glossy green jelly crown, silver ball finials, jelly drips',
    crown_iron='steel crown with rivets and an inset red-violet gem',
    crown_cog='brass crown with two steel cogs on its points and an aqua clock-face gem',
    crown_oni='red lacquer crown, two ivory horns, rose-gold rim, glowing front gem',
    crown_dragon='ember-orange crown with wing-shaped points, gold rim, red gem with a star',
    crown_rainbow='iridescent crown: rainbow band, five filled points with pearl finials, three gems',
    crown_rainbow_shard='one iridescent crown point with a pearl finial on a jagged chunk of band',
    gearbox_common='plain warm-grey chest, wood straps, lid closed, gear emblem',
    gearbox_rare='blue chest, silver straps, lid ajar with cream cloth, gear emblem with a blue gem',
    gearbox_superRare='violet chest, silver straps, gear emblem with a violet gem',
    gearbox_mythic='pink chest, rose-gold straps and latch, cream cloth, gear emblem with a pink gem',
    gearbox_legendary='teal chest, gold straps, white-blue gem, star glint',
    gearbox_rainbow='pearl-white iridescent chest, iridescent straps, prism glints',
    dice_reroll='rounded light-blue die, white pips, a sakura on the top face',
    lock_pin='silver padlock with a violet-gem keyhole, pink-headed pin through it',
    dice_prism='pastel iridescent bipyramid die, rose-gold caps, inner glow (no number)',
    seed_rainbow='iridescent seed with a green two-leaf sprout, prism glints',
    needle_star='faceted gold four-point star, steel needle behind it, pink thread through the eye',
    club_band='pink cloth armband loop with stitching and a rose-gold star badge',
)

_MAT = dict(
    feather=('brown sparrow feather, cream quill', 'sleek sky-blue plume, silver quill cap',
             'amber quill with darker stripes, silver cap with a violet gem', 'red-orange plume with flame tips, rose-gold band, glowing shaft',
             'pearl-white plume with pale-gold edges, gold cap, star', 'pearl-white plume, iridescent edges and cap, prism glints'),
    blade=('dull steel shard with a notch', 'polished steel shard, temper line, silver collar and grip',
           'blue-violet steel shard with a crescent gem, silver collar', 'steel shard with a glowing crimson tip, rose-gold collar',
           'white-gold blade, gold guard, gem, star', 'pearl-white blade, iridescent guard, prism glints'),
    ember=('plum-grey cinder with glowing orange cracks', 'glowing orange coal in a silver dish',
           'hot coal with a flame crown and a violet heat gem', 'flame-shaped ember in a rose-gold crescent cradle, inner glow',
           'sun orb in a gold ring with ray spikes, star inside', 'pearl sun orb, iridescent ring and rays'),
    rime=('three ice prisms on a snow-capped stone', 'feathery ice-blue crystal spray on a snow puff, silver frost ring',
          'lavender crystal cluster on a snow puddle', 'mint-to-violet crystal cluster on a rose-gold ring, inner glow',
          'faceted ice heart in a gold snowflake frame, star', 'pearl heart in an iridescent snowflake frame'),
    charm=('paper omamori pouch, red cord knot', 'pink silk omamori, embroidered sakura, silver cord ring',
           'violet omamori with a silver bell and a gem knot', 'rose-red lacquered tag, rose-gold cap, glowing sakura inlay',
           'white seal disc with a pink sakura, gold rim, star', 'pearl seal disc, iridescent rim and blossom'),
    rune=('slate tablet with a chalk glyph (abstract mark)', 'rice-paper slip with a blue ink glyph, silver pin',
          'lavender runestone with a glowing glyph and a gem', 'violet tablet with a star-dot constellation, rose-gold rim',
          'violet disc with a gold sigil, gold rim, star', 'pearl disc with an iridescent sigil'),
    cog=('brass cog with one bent tooth', 'steel gear with an axle hub', 'steel coil spring between two caps, violet gem',
         'glowing aqua mainspring in a rose-gold housing', 'gold gear around a glowing cut-gem core, star', 'pearl gear, iridescent core'),
)
for _fam, _rows in _MAT.items():
    for _t, _txt in zip(_TIERS, _rows):
        NOTES[f'mat_{_fam}_{_t}'] = _txt

_GEAR = dict(charm='rounded faceted diamond pendant in a bezel, short chain', ribbon='chunky satin bow with a knot clip and two tails',
             shoes='chunky loafer, white sole, penny strap and buckle')
_GEAR_TIER = dict(common='plain', rare='silver trim', superRare='silver trim + gem (shoes: wing)',
                  mythic='rose-gold trim + glow (shoes: wing)', legendary='gold trim + star (shoes: wing)',
                  ur='iridescent body and trim (shoes: wing)')
for _slot, _txt in _GEAR.items():
    for _t, _tt in _GEAR_TIER.items():
        NOTES[f'gear_{_slot}_{_t}'] = f'{_txt}; {_tt}'


def note(key):
    return NOTES.get(key, '')


def table(rows, family, small_cut):
    """Markdown table for the README."""
    out = ['| Key | Name | Family | Tier | Files | Model |', '|---|---|---|---|---|---|']
    for r in rows:
        k = r['key']
        tier = 'zenith' if r.get('tier') == 'zenith' else ('ur' if r.get('display') == 'ur' or k.endswith('_ur') else r['rarity'])
        if r.get('rainbow') and tier != 'ur':
            tier += ' (rainbow)'
        files = '256, 128' + (', small' if k in small_cut else '')
        appr = ' (appr.)' if k in APPROVED else ''
        out.append(f"| `{k}` | {r['name']} | {family(k)} | {tier} | {files} | {note(k)}{appr} |")
    return '\n'.join(out)
