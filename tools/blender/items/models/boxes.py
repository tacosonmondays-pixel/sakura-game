"""Gear boxes (gearbox_*): one rounded chest, two straps, a gear emblem on the front. Opened tiers: the lid
stands open about 15 degrees on its hinge (its back edge resting on the back rim), and the top is a real
opening, a rim round a cavity, with a cream lining sunk below the rim so a thin inner wall shows above it.
Standing pose: lid top lightest, front mid, right side darkest.
Tier steps: common closed and plain; rare silver straps and a blue gem; super rare adds a violet gem in
the clasp; mythic rose gold; legendary gold; rainbow iridescent.
Set Boxes (setbox_<set>_<mythic|legendary>, the gear update): the same chest in the set's colour (src/data/gearSets.js)
with that set's crest on the front instead of the gear, and the rarity treatment of the gear box of that rarity (rose
gold straps and a pink gem for Mythic, gold and an amber gem for Legendary). The pick box (setbox_pick_*: choose any
set) is pearl with a ring of the six set colours round its crest.
Set Boxes v2 (docs/specs/SET_BOXES_V2.md): setbox_<set|pick>_<mythic|legendary|ur>_random are the plain boxes above;
the preset boxes (no _random: you choose the main stats; Supply Bot only) add a gold tag with a white pencil hanging from
the lid, so the two kinds never look alike; UR boxes keep the set colour with rainbow straps and a rainbow gem."""
import math

import parts as P
import palette as C

BODY = dict(
    common=C.paint('#d9cdbd', light='#ece3d6', shadow='#b5a48f', ink='#4a3d30'),
    rare=C.paint('#7db6f3', light='#a6cdfa', shadow='#5589d8', ink='#0d336f'),
    superRare=C.paint('#b39afd', light='#cab7fd', shadow='#896be7', ink='#26136e'),
    mythic=C.paint('#fc6d95', light='#fda7bc', shadow='#d63e71', ink='#651233'),                    # (appr.)
    legendary=C.paint('#77dae4', light='#a5ebf0', shadow='#3fb0c4', ink='#013749'),
    rainbow=C.anchored(C.PEARL, base='#d3c1f8', iri=0.55, base_anchor=0.5, shadow='#a184e4', deep='#8264d6',
                       ink='#3f2a78'),
)
STRAP = dict(
    common=C.paint('#b88a5a', light='#d4a87a', shadow='#93663c', ink='#4a2e14', rim=0.3),
    rare=C.SILVER, superRare=C.SILVER, mythic=C.ROSE_GOLD, legendary=C.GOLD_TRIM, rainbow=C.IRI_DEEP,
)
GEM = dict(common=None, rare=C.TIER_GEM['rare'], superRare=C.TIER_GEM['superRare'],
           mythic=C.paint('#fbb6cf', light='#fde3ee', shadow='#f07aa5', ink='#781948', spec=0.8, spec_at=0.985),
           legendary=C.TIER_GEM['legendary'], rainbow=dict(C.IRI, glow=0.4))
CLOTH = C.paint('#f9eedb', light='#fff9ee', shadow='#e6d0ac', ink='#7a5a3a', rim=0.0)

# the gear sets' colours (src/data/gearSets.js GEAR_SETS[id].color; tests/data/gearSetColors.test.js keeps them apart)
SET_COLORS = dict(spirit='#e5484d', freezetag='#5fb4e8', geometry='#5a6fa8', popper='#9b5de5', treasurer='#9fd8c4',
                  powerbank='#8bd13a')
WHITE = C.paint('#fbfcff', light='#ffffff', shadow='#d3dcea', ink='#33435c', rim=0.2)
BOLT2 = [(-0.12, 0.62), (0.34, 0.62), (0.08, 0.14), (0.36, 0.14), (-0.22, -0.66), (-0.04, -0.12), (-0.32, -0.12)]


def _crest2(gear_set, R):
    """A set's crest outline (x, z) about 2R across: pom, pause, set square, confetti star, coin, bolt."""
    if gear_set == 'spirit':
        return [P.blossom2(R, inner=0.78, notch=0.0)]
    if gear_set == 'freezetag':
        return [P.rrect2(R * 0.5, R * 1.7, R * 0.2, 4, cx=-R * 0.42), P.rrect2(R * 0.5, R * 1.7, R * 0.2, 4, cx=R * 0.42)]
    if gear_set == 'geometry':
        return [P.poly_round([(-R * 0.9, -R * 0.8), (R * 1.0, -R * 0.8), (-R * 0.9, R * 1.0)], R * 0.12, 3)]
    if gear_set == 'popper':
        return [P.poly_round(P.star2(5, R * 1.05, R * 0.5), R * 0.1, 3)]
    if gear_set == 'treasurer':
        return [P.circle2(R * 0.95, 48)]
    if gear_set == 'powerbank':
        return [P.poly_round([(a * R * 1.5, b * R * 1.5) for a, b in BOLT2], R * 0.06, 3)]
    return [P.blossom2(R, inner=0.42, notch=0.17)]


# UR Set Boxes: each strap is two saturated rainbow bands (pink | gold on the left, mint | sky on the right), so a UR box
# clearly outranks a Legendary one even at 40 px (review r1 L1)
UR_BANDS = [C.paint(b, ink='#3f2266', spec=0.6, spec_at=0.985, rim=0.5) for b in ('#ff4fa3', '#ffc928', '#2fd08e', '#3fa9ff')]
NAVY = C.paint('#24325e', light='#3b4e8a', shadow='#151d3d', ink='#0d1430')

BW, BD, BH = 1.2, 1.04, 0.74
LW, LD, LH = 1.26, 1.1, 0.3
WALL = 0.05            # the rim you see round the opening, inside the rounded edge
LID_ANGLE = 15.0       # the lid stands open about 15 degrees, its back edge resting on the back rim
SINK = 0.07            # the lining sits this far below the rim, so a thin inner wall shows above it


def build(row):
    key = row['key']
    is_set = key.startswith('setbox_')
    ur = is_set and '_ur' in key
    tier = 'rainbow' if row.get('rainbow') or ur else row['rarity']
    body_p, strap_p, gem_p = BODY[tier], STRAP[tier], GEM[tier]
    gear_set = key.split('_')[1] if is_set else None
    preset = is_set and not key.endswith('_random')
    if gear_set in SET_COLORS:
        body_p = C.paint(SET_COLORS[gear_set])
    elif gear_set:                                       # the pick box: pearl
        body_p = C.anchored(C.PEARL, base='#efe6ff', iri=0.35, base_anchor=0.6, shadow='#b9a3e8', deep='#9a7fe0', ink='#3f2a78')
    opened = tier != 'common'
    body = P.rbox(BW, BD, BH, r=0.1, seg=4, name='body')
    if opened:         # a real opening: the top is a rim round a cavity with flat inner walls
        P.hollow_top(body, WALL, 0.34)
    P.xf(body, loc=(0, 0, BH / 2))
    P.paint(body, body_p, line=2.6)
    lid = P.rbox(LW, LD, LH, r=0.11, seg=4, name='lid')
    P.xf(lid, loc=(0, -LD / 2 + 0.02, LH / 2))       # hinge at the lid's back bottom edge
    lid_parts = [lid]
    P.paint(lid, C.over(body_p, sheen=0.25, sheen_at=-0.46, **({'glow': 0.25} if ur else {})), line=2.6)
    for i, sx in enumerate((-0.34, 0.34)):
        # a UR box: two rainbow bands per strap; every other box: one strap of its metal
        bands = [(sx - 0.036, 0.072, UR_BANDS[2 * i]), (sx + 0.036, 0.072, UR_BANDS[2 * i + 1])] if ur else [(sx, 0.14, strap_p)]
        for bx, bw, paint in bands:
            s = P.rbox(bw, LD + 0.03, LH + 0.03, r=0.03 if ur else 0.04, seg=3, name='lstrap')
            P.xf(s, loc=(bx, -LD / 2 + 0.02, LH / 2))
            lid_parts.append(P.paint(s, paint, line=1.4 if ur else 1.8))
            s2 = P.rbox(bw, BD + 0.03, BH - 0.02, r=0.03 if ur else 0.04, seg=3, name='bstrap')
            P.xf(s2, loc=(bx, 0, BH / 2 - 0.01))
            P.paint(s2, paint, line=1.4 if ur else 1.8)
    big = tier == 'superRare'
    latch = P.rbox(0.25 if big else 0.17, 0.06, 0.2 if big else 0.13, r=0.03, seg=2, name='latch')
    P.xf(latch, loc=(0, -LD + 0.0, 0.07 if not big else 0.04))
    lid_parts.append(P.paint(latch, strap_p, line=1.6))
    if big:                                    # SR's own step: a violet gem set in a wider clasp
        cg = P.cabochon(0.085, 0.05)
        P.xf(cg, rot=(90, 0, 0), loc=(0, -LD - 0.035, 0.04))
        lid_parts.append(P.paint(cg, gem_p, line=1.1))
    if gear_set:                                         # a Set Box: the set's crest on the lid, tilting with it
        for o in _crest_parts(gear_set, strap_p, scale=1.25):
            P.xf(o, rot=(-90, 0, 0), loc=(0, -LD / 2 + 0.02, LH + 0.012))
            lid_parts.append(o)
    if preset:                                           # a preset box: a gold tag with a white pencil on the lid's front
        lid_parts += _choose_tag()
    # propped open (approved): the lid tilts up about 15 degrees on its hinge at the back rim
    ang = -LID_ANGLE if opened else 0
    hz = BH - 0.01 - (0.03 if opened else 0.0)      # opened: the lid's back edge sinks a hair into the back rim
    for o in lid_parts:
        P.xf(o, rot=(ang, 0, 0), loc=(0, BD / 2 - 0.02, hz))
    if opened:
        # hinge knuckles where the lid meets the back rim, in the strap metal
        for sx in (-0.34, 0.34):
            k = P.tube([(sx - 0.1, BD / 2 + 0.01, BH + 0.01), (sx + 0.1, BD / 2 + 0.01, BH + 0.01)], 0.055, 14, name='hinge')
            P.paint(k, strap_p, line=1.6)
        # the lining: a soft cushion inside the walls, its top sunk below the rim
        iw, idp = BW - 0.2 - 2 * WALL, BD - 0.2 - 2 * WALL
        cloth = P.rbox(iw - 0.02, idp - 0.02, 0.3, r=0.1, seg=4, name='cloth')
        P.xf(cloth, loc=(0, 0.0, BH - SINK - 0.15))
        P.paint(cloth, CLOTH, line=1.4)
    ez = BH * 0.42
    if gear_set:                                         # a Set Box: the set's crest instead of the gear
        _set_crest(gear_set, strap_p, ez)
        _glint_lid(tier, ang, hz)
        return dict(kind='standing', yaw=32.0, elev=22.0)
    # gear emblem on the front
    g = P.slab(P.gear2(0.22, 8, 0.22), 0.045, 0.016, 2, 'emblem')
    P.xf(g, loc=(0, -BD / 2 - 0.012, ez))
    P.paint(g, strap_p, line=1.5, lift=0.03)
    if gem_p:
        cab = P.cabochon(0.09, 0.055)
        P.xf(cab, rot=(90, 0, 0), loc=(0, -BD / 2 - 0.035, ez))
        P.paint(cab, gem_p, line=1.1, lift=0.0)
    else:
        hub = P.slab(P.circle2(0.07, 24), 0.03, 0.01, 2, 'hub')
        P.xf(hub, loc=(0, -BD / 2 - 0.035, ez))
        P.paint(hub, C.over(strap_p, base=strap_p['shadow']), line=1.1, lift=0.02)
    _glint_lid(tier, ang, hz)
    if ur:                                               # a second sparkle, on the body's lower right corner
        P.glint((BW / 2 - 0.08, -BD / 2 - 0.02, 0.16), 9)
    return dict(kind='standing', yaw=32.0, elev=22.0)


def _choose_tag():
    """The preset boxes' mark: a white luggage tag (with a navy eyelet) hanging from the lid's front left corner, a navy
    pencil on it ("you choose the main stats"): white and navy read against every box colour and gold strap, at 40 px
    too (review r1 L2). Built in the lid's frame, so it tilts with the lid."""
    k = 1.3
    x, y, z = -0.37, -LD + 0.0, LH * 0.3
    tag = P.slab(P.poly_round([(a * k, b * k) for a, b in ((-0.17, -0.2), (0.17, -0.2), (0.17, 0.12), (0.0, 0.24), (-0.17, 0.12))],
                              0.04, 3), 0.06, 0.02, 2, 'tag')
    P.xf(tag, rot=(0, -12, 0), loc=(x, y - 0.06, z - 0.14))
    out = [P.paint(tag, dict(WHITE, ink='#0d1430'), line=2.0)]
    eye = P.torus(0.045, 0.016, 16, 6, 'tageye')
    P.xf(eye, rot=(90, 0, 0), loc=(x - 0.03, y - 0.1, z + 0.09))
    out.append(P.paint(eye, NAVY, line=0.0))
    pen = P.slab(P.poly_round([(a * k, b * k) for a, b in ((-0.035, -0.12), (0.035, -0.12), (0.035, 0.08), (0.0, 0.14), (-0.035, 0.08))],
                              0.01, 2), 0.025, 0.008, 1, 'pencil')
    P.xf(pen, rot=(0, 38, 0), loc=(x + 0.01, y - 0.1, z - 0.18))
    out.append(P.paint(pen, NAVY, line=0.8, lift=0.02))
    return out


def _glint_lid(tier, ang, hz):
    if tier in ('superRare', 'mythic', 'legendary', 'rainbow'):
        # on the lit edge: the lid's top front corner at the upper left
        a = math.radians(ang)
        y, z = -LD + 0.1, LH + 0.01
        P.glint((-LW / 2 + 0.16, y * math.cos(a) - z * math.sin(a) + BD / 2 - 0.02, y * math.sin(a) + z * math.cos(a) + hz), 12)


def _crest_parts(gear_set, strap_p, scale=1.0):
    """A set's crest at the origin, facing -Y: a strap-metal disc with the set's white crest on it (the pick box: a ring
    of the six set colours round a white sakura). Returns the parts (placed by the caller)."""
    out = []
    plate = P.slab(P.circle2(0.25 * scale, 48), 0.045, 0.016, 2, 'crestplate')
    out.append(P.paint(plate, strap_p, line=1.5, lift=0.03))
    for k, outline in enumerate(_crest2(gear_set, 0.15 * scale)):
        c = P.slab(outline, 0.03, 0.01, 2, 'crest%d' % k)
        P.xf(c, loc=(0, -0.03, 0))
        out.append(P.paint(c, WHITE, line=1.1, lift=0.02))
    if gear_set not in SET_COLORS:
        for k, col in enumerate(SET_COLORS.values()):
            a = math.radians(90 - 60 * k)
            d = P.cabochon(0.045 * scale, 0.03, n=16)
            P.xf(d, rot=(90, 0, 0), loc=(math.cos(a) * 0.31 * scale, -0.02, math.sin(a) * 0.31 * scale))
            out.append(P.paint(d, C.paint(col), line=0.9))
    return out


def _set_crest(gear_set, strap_p, ez):
    """The crest on a Set Box's front, below the latch."""
    for o in _crest_parts(gear_set, strap_p):
        P.xf(o, loc=(0, -BD / 2 - 0.012, ez))
