"""Breakthrough materials (mat_<family>_<rarity>, mat_<family>_zenith): seven families, one base model
each, with the tier ladder of PLAN 3.5 (common = the humble version, rare silver trim, super rare an
inset gem, mythic rose gold + inner glow, legendary gold + star, zenith = the legendary object in
pearl white with iridescent trim).

Every family keeps its own silhouette through all six tiers (charm = an omamori, rune = a tablet,
ember = one chunky coal, feather, blade, rime crystals, cog = a gear): the disc belongs to currencies
and tokens only. Accents follow the tier palette (ITEM_STYLE 3): rare blue or silver, super rare a
violet gem, mythic rose gold, legendary gold, zenith iridescent anchored by a saturated lilac shadow."""
import math

from mathutils import Vector

import parts as P
import palette as C
from models import common as K

ICE = C.paint('#d9effc', light='#f3fbff', shadow='#9fcbf2', ink='#1b4574', deep='#7fb2e6', spec=0.4, spec_at=0.99)
STONE = C.paint('#a5b7d1', light='#c9d6e8', shadow='#7587aa', ink='#1b4574', rim=0.4)                 # (appr.)
LAV = C.paint('#acb6fc', light='#e6e9fd', shadow='#7c7eed', ink='#22286e', deep='#6366d8')             # (appr.)
CRYSTAL_STEPS = dict(steps=(0.08, 0.72, 0.02), deep_at=-0.35)
FACETS = dict(steps=(0.45, 0.86, 0.02), deep_at=0.0)

# Zenith: the legendary object in pearl white, iridescent trim, prism glints, anchored by one saturated
# lilac shadow plane so it does not fade into the white tile
ZEN_BODY = C.paint('#c6b0f4', light='#ffffff', shadow='#9b7be0', ink='#3f2470', deep='#7e60d2', iri=0.55, spec=0.6,
                   spec_at=0.985, anchor=0.8, base_anchor=0.55)
ZEN_TRIM = C.anchored(C.IRI, iri=0.9, shadow='#9a79e0', deep='#7a57cc', ink='#3a1f66')
ZEN_GEM = C.paint('#efe0ff', light='#ffffff', shadow='#b08ef0', ink='#3f2470', deep='#9370e6', iri=0.6, glow=0.4,
                  spec=0.8, spec_at=0.99, anchor=0.6)
ZEN_FACE = C.over(ZEN_BODY, base='#bca4f1')          # big flat zenith faces (tablet, gear): one step deeper
GLOW_GOLD = C.paint('#ffd75a', light='#fff3b0', shadow='#f2a922', ink='#6e3b08', glow=0.5, spec=0.6, spec_at=0.985)


def trim(r):
    return dict(rare=C.SILVER, superRare=C.SILVER, mythic=C.ROSE_GOLD, legendary=C.GOLD_TRIM, zenith=ZEN_TRIM).get(r)


def gem(r):
    return dict(superRare=C.TIER_GEM['superRare'], mythic=C.TIER_GEM['mythic'], legendary=C.TIER_GEM['legendary'],
                zenith=ZEN_GEM, rare=C.TIER_GEM['rare']).get(r)


def flat(hx, ink='#000000'):
    """One flat tone (printed strips, glints, cracks): base = light = shadow."""
    return dict(base=hx, light=hx, shadow=hx, deep=hx, ink=ink, rim=0.0, drift=0.0)


def _prism(at, r, h, tip, paint, rot=(0, 0, 0), sides=6, line=2.2, a0=0.3, taper=0.92):
    c = P.crystal(r, h, tip, sides=sides, a0=a0, taper=taper)
    P.xf(c, rot=rot, loc=at)
    q = dict(paint)
    for k, v in CRYSTAL_STEPS.items():
        q.setdefault(k, v)
    return P.paint(c, q, line=line, smooth=False)


def _snow(at, rx, ry, rz, paint=C.SNOW, line=2.2):
    s = P.sphere(1.0, 40, 20, 'snow', scale=(rx, ry, rz))
    P.xf(s, loc=at)
    return P.paint(s, paint, line=line)


def _gem_front(r, at, paint, line=1.2):
    g = P.cabochon(r, r * 0.65)
    P.xf(g, rot=(90, 0, 0), loc=at)
    return P.paint(g, paint, line=line, spec=1.0, spec_at=0.985)


def _cut_front(r, at, paint, sides=8, line=1.2):
    return K.cut_gem(r, at, dict(paint, steps=(0.5, 0.9, 0.02), deep_at=0.2), sides=sides, line=line)


# ---------------------------------------------------------------------------
# Feather: a curved vane in two halves around the rachis; the half away from the light turns back
# (one cel shadow plane), V-notches split the barbs, the lit top edge catches the light
# ---------------------------------------------------------------------------

FEATHER = dict(
    common=C.paint('#c49a6c', light='#dfbd92', shadow='#98704a', ink='#4e3016', rim=0.3),
    rare=C.paint('#7cbcf5', light='#b0d8fb', shadow='#4a86da', ink='#1a3566', rim=0.4, sheen=0.15),
    superRare=C.paint('#ab8ff2', light='#cfbefb', shadow='#7a5cdc', ink='#2c1b68', rim=0.4),
    mythic=C.paint('#ff7a5a', light='#ffab86', shadow='#dc4440', ink='#6e1a2a', rim=0.5, glow=0.15),
    legendary=C.paint('#fff1cf', light='#ffffff', shadow='#efc670', ink='#74430a', rim=0.3),
    zenith=ZEN_BODY,
)
FEATHER_H = 1.75
FEATHER_CURVE = 0.16


def _curve_x(z):
    """Sideways bow of the feather (to the right toward the tip)."""
    u = max(0.0, z / FEATHER_H)
    return FEATHER_CURVE * u * u


def _vane_half(side, w, h, notches, flame=False, n=64):
    """One vane half, rachis (x = 0) to edge, base (z = 0) to tip (z = h); side -1 = left, +1 = right.
    notches: [(u, depth)] V-cuts from the edge in and down toward the base (split barbs)."""
    def wid(u):
        k = w * math.sin(math.pi * min(1.0, max(0.0, u)) ** 0.82) ** 0.72
        if flame and u > 0.66:
            k *= 1.0 + 0.32 * max(0.0, math.sin((u - 0.66) * 30.0)) * (u - 0.66) * 2.6
        return k
    edge = []
    cuts = sorted(notches)
    for i in range(n + 1):
        u = i / n
        skip = False
        for nu, _ in cuts:
            if nu - 0.012 < u < nu + 0.04:
                skip = True
        if not skip:
            edge.append((side * wid(u), u * h))
        for nu, depth in cuts:
            if (i - 1) / n < nu - 0.012 <= u:
                ua, ub = nu - 0.012, nu + 0.04
                edge.append((side * wid(ua), ua * h))
                edge.append((side * wid(nu) * (1 - depth), (nu - 0.07) * h))
                edge.append((side * wid(ub), ub * h))
    pts = [(0.0, 0.0)] + edge[1:-1] + [(0.0, h)]
    return pts


def _place_half(o, side, fold):
    """Fold a half back around the rachis, cup its edge a little and bow the whole feather."""
    if fold:
        P.xf(o, rot=(0, 0, side * fold))
    for v in o.data.vertices:
        v.co.y += 0.05 * (abs(v.co.x) / 0.32) ** 2
        v.co.x += _curve_x(v.co.z)
    o.data.update()
    return o


def feather(r, row):
    body = FEATHER[r]
    sleek = r in ('rare', 'mythic')
    w = 0.27 if sleek else 0.32
    h = FEATHER_H
    notch = dict(common=([(0.38, 0.55), (0.66, 0.45)], [(0.5, 0.5)]),
                 rare=([(0.58, 0.4)], [(0.44, 0.38)]),
                 superRare=([(0.42, 0.45), (0.7, 0.4)], [(0.56, 0.42)]),
                 mythic=([(0.5, 0.4)], [(0.4, 0.35)]),
                 legendary=([(0.62, 0.35)], [(0.46, 0.32)]),
                 zenith=([(0.62, 0.35)], [(0.46, 0.32)]))[r]
    extra = {}
    if r == 'superRare':
        extra = dict(stripe=(0.55, 2.4, 0.4), stripe_dir=(0, 0, 1))
    if r == 'common':
        extra = dict(stripe=(0.35, 1.6, 0.3), stripe_dir=(0, 0, 1))
    t = trim(r)
    for side, cuts, fold in ((-1, notch[0], 0.0), (1, notch[1], 24.0)):
        outline = _vane_half(side, w * (1.08 if side < 0 else 0.92), h, cuts, flame=(r == 'mythic'))
        if r in ('legendary', 'zenith'):        # a deeper-toned edge: a slightly larger half behind
            e = P.slab(P.offset_outline(outline, 0.045), 0.04, 0.015, 2, 'edge')
            P.xf(e, loc=(0, 0.035, 0))
            _place_half(e, side, fold)
            P.paint(e, t, line=2.4, shadow_rel=0.08)
        v = P.slab(outline, 0.05, 0.02, 2, 'vane')
        _place_half(v, side, fold)
        P.paint(v, body, line=2.4, shadow_rel=0.09, **extra)
    if r == 'mythic':                            # flame tips: a yellow inner vane near the tip
        for side, fold in ((-1, 0.0), (1, 24.0)):
            tip = [(x * 0.55, z * 0.42 + h * 0.56) for x, z in _vane_half(side, w, h, [], flame=True)]
            tv = P.slab(tip, 0.03, 0.012, 2, 'flametip')
            P.xf(tv, loc=(0, -0.03, 0))
            _place_half(tv, side, fold)
            P.paint(tv, C.paint('#ffc061', light='#ffe1a1', shadow='#f2953a', ink='#6e2a10', glow=0.4), line=0.0,
                    shadow_rel=0.09)
    shaft_p = C.paint('#fff4dc', light='#ffffff', shadow='#e6d2a8', ink=body['ink'], rim=0.3)
    if r == 'mythic':
        shaft_p = C.paint('#fff0c2', light='#ffffff', shadow='#ffcf7a', ink=body['ink'], glow=0.6)
    if r in ('legendary', 'zenith'):
        shaft_p = C.over(shaft_p, shadow='#e2c690' if r == 'legendary' else '#c8b4ee')
    n = 30
    path = [(_curve_x(z), -0.045, z) for z in [-0.42 + (h * 0.97 + 0.42) * i / (n - 1) for i in range(n)]]
    shaft = P.sweep(path, P.circle2(1.0, 10), scales=[0.045 * (1 - 0.72 * i / n) for i in range(n)], name='shaft')
    P.paint(shaft, shaft_p, line=1.5)
    if t:
        cap = P.tube([(0, -0.045, -0.3), (0, -0.045, -0.1)], 0.068, 14, name='cap')
        P.paint(cap, t, line=1.6)
        if r in ('superRare', 'legendary', 'zenith'):
            _gem_front(0.046, (0, -0.11, -0.2), gem(r), line=1.0)
    if r in ('legendary', 'zenith'):
        P.glint((-0.12 + _curve_x(1.2), -0.1, 1.2), 12)
    elif r != 'common':
        P.glint((-0.2 + _curve_x(0.85), -0.1, 0.85), 9)
    return dict(kind='flat', roll=36.0, turn=14.0, tip=12.0)


# ---------------------------------------------------------------------------
# Blade: a bevelled ridge (lit plane + shadow plane), a hard white glint strip along the lit edge and a
# dark reflection band; the steel is tinted per tier
# ---------------------------------------------------------------------------

BLADE = dict(
    common=C.paint('#b3bccb', light='#dfe5ee', shadow='#8e99ac', ink='#323d53', spec=0.6, spec_at=0.985),
    rare=C.paint('#98b8e6', light='#d4e5fb', shadow='#6e90cc', ink='#1d3868', spec=0.9, spec_at=0.985),
    superRare=C.paint('#a6a6f4', light='#d6d6fd', shadow='#7d7ce2', ink='#241f6c', spec=0.9, spec_at=0.985),
    mythic=C.paint('#e9aebb', light='#fbdde3', shadow='#c98192', ink='#5c2034', spec=0.9, spec_at=0.985),
    legendary=C.paint('#f7cc52', light='#fde89a', shadow='#dc9e30', ink='#6a3807', spec=1.0, spec_at=0.985),
    zenith=ZEN_BODY,
)
# the dark reflection band that crosses the lit plane (one step below its light tone)
BAND = dict(common='#a3adbf', rare='#8aaee2', superRare='#9898f0', mythic='#dc9fac', legendary='#efb944', zenith='#c3aaf2')


def _blade_lines(r):
    """Left (lit) edge and the spine as functions of z (x and spine rise), for the glint and the band."""
    tip_z = 1.05 if r == 'common' else 1.12

    def edge_x(z):
        if z <= 0.42:
            return -0.24
        return -0.24 + (0.04 + 0.24) * (z - 0.42) / (tip_z - 0.42)

    spine = [(-0.01, -0.5, 0.17), (0.0, -0.1, 0.18), (0.03, 0.35, 0.17), (0.04, 0.85, 0.1)]

    def spine_at(z):
        if z <= spine[0][1]:
            return spine[0][0], spine[0][2]
        for (x0, z0, r0), (x1, z1, r1) in zip(spine, spine[1:]):
            if z <= z1:
                t = (z - z0) / (z1 - z0)
                return x0 + (x1 - x0) * t, r0 + (r1 - r0) * t
        return spine[-1][0], spine[-1][2]
    return edge_x, spine_at, spine


def _strip_on_plane(r, frac, z0, z1, rad, paint, n=18):
    """A thin flat strip on the lit plane at `frac` of the way from the edge to the spine."""
    edge_x, spine_at, _ = _blade_lines(r)
    pts = []
    for i in range(n):
        z = z0 + (z1 - z0) * i / (n - 1)
        ex = edge_x(z)
        sx, rise = spine_at(z)
        x = ex + (sx - ex) * frac
        pts.append((x, -rise * frac - rad * 0.55, z))
    o = P.tube(pts, rad, 6, name='strip')
    return P.paint(o, paint, line=0.0)


def blade(r, row):
    body = BLADE[r]
    pts = [(-0.24, -0.62), (0.22, -0.62), (0.3, 0.25), (0.04, 1.12), (-0.24, 0.42)]
    if r == 'common':
        pts = [(-0.24, -0.62), (0.22, -0.62), (0.3, 0.12), (0.2, 0.3), (0.29, 0.42), (0.04, 1.05), (-0.24, 0.42)]
    pts = P.poly_round(pts, 0.03, 2)
    _, _, spine = _blade_lines(r)
    g = P.fan_gem(pts, 0.1, 0.1, spine=spine, name='blade')
    # the ridge: the plane toward the light takes the light tone, the other plane is the one cel shadow
    P.paint(g, dict(body, deep_at=-0.5), line=2.6, shadow_rel=0.04, light_rel=-0.03)
    if r == 'mythic':
        tp = P.fan_gem(P.poly_round([(-0.21, 0.46), (0.27, 0.29), (0.04, 1.09)], 0.02, 2), 0.1, 0.11,
                       spine=[(0.02, 0.45, 0.18), (0.04, 0.9, 0.1)], name='crimson')
        P.xf(tp, loc=(0, -0.012, 0))
        P.paint(tp, C.paint('#ff6f88', light='#ffa8b6', shadow='#d83a5c', ink='#6e1a3c', glow=0.35), deep_at=-0.5,
                line=1.6, shadow_rel=0.04, light_rel=-0.03)
    top = 0.4 if r == 'mythic' else 0.92
    _strip_on_plane(r, 0.55, -0.5, min(top, 0.8), 0.024, flat(BAND[r]))            # dark reflection band
    _strip_on_plane(r, 0.13, -0.52, top, 0.017, flat('#ffffff'))                   # hard glint on the lit edge
    if r == 'superRare':
        cres = P.slab(P.poly_round(P.crescent2(0.14, cut=0.8, shift=0.4), 0.01, 2), 0.03, 0.01, 2, 'moon')
        P.xf(cres, rot=(0, -30, 0), loc=(0.1, -0.16, 0.12))
        P.paint(cres, C.TIER_GEM['superRare'], line=1.1, lift=0.02)
    t = trim(r)
    if t:
        collar = P.rbox(0.66 if r in ('legendary', 'zenith') else 0.56, 0.22, 0.16, r=0.05, seg=3, name='collar')
        P.xf(collar, loc=(-0.01, 0.0, -0.66))
        P.paint(collar, t, line=2.0)
        grip = P.tube([(0, 0, -0.74), (0, 0, -1.0)], 0.08, 12, name='grip')
        P.paint(grip, C.over(t, base=t['shadow'], light=t['base']), line=1.8)
        if r in ('legendary', 'zenith', 'mythic'):
            _gem_front(0.06, (-0.01, -0.11, -0.66), gem(r), line=1.0)
    if r in ('legendary', 'zenith'):
        P.glint((0.04, -0.14, 1.05), 12)
    elif r != 'common':
        P.glint((-0.17, -0.12, 0.6), 9)
    return dict(kind='flat', roll=-32.0, turn=16.0, tip=12.0)


# ---------------------------------------------------------------------------
# Ember: one chunky coal with glowing cracks, escalated per tier (crack glow, a flame lick, an inset
# gem, a rose-gold cradle, a gold sun frame, iridescent)
# ---------------------------------------------------------------------------

COAL = dict(
    common=C.paint('#a99790', light='#d2c4bb', shadow='#7d6a6b', ink='#3a2a2e', rim=0.4),
    rare=C.paint('#9d8a88', light='#c7b6ae', shadow='#715e62', ink='#35252b', rim=0.4),
    superRare=C.paint('#a48a86', light='#cdb5aa', shadow='#76585e', ink='#38222a', rim=0.4),
    mythic=C.paint('#a48a86', light='#cdb5aa', shadow='#76585e', ink='#38222a', rim=0.4),
    legendary=C.paint('#a48a86', light='#cdb5aa', shadow='#76585e', ink='#38222a', rim=0.4),
    zenith=C.paint('#ddcefb', light='#ffffff', shadow='#a183e4', ink='#3f2470', deep='#8466d8', iri=0.45, anchor=0.8,
                   base_anchor=0.45),
)
CRACK = flat('#ffb347')
CRACK_HOT = flat('#ffd36a')
FLAME_O = C.paint('#ff8a3d', light='#ffb36e', shadow='#e85d2a', ink='#6e1a10', glow=0.3)
FLAME_Y = C.paint('#ffd75a', light='#fff3b0', shadow='#ffb02e', ink='#6e3b08', glow=0.5)
FLAME_ROSE = C.paint('#ff7d8e', light='#ffb0b8', shadow='#e84a6a', ink='#6e1a30', glow=0.4)
CORE_BLUE = C.paint('#cfeaff', light='#ffffff', shadow='#8cc4f4', ink='#1d3a6b', glow=0.6)
# the coal: a chunky cut stone, broad flat facets (clean cel planes, no noise), flat bottom, narrower top
COAL_PTS = [(-0.56, -0.26, -0.34), (0.22, -0.44, -0.34), (0.62, 0.05, -0.34), (0.05, 0.44, -0.34), (-0.5, 0.28, -0.34),
            (-0.66, 0.0, 0.08), (-0.22, -0.52, 0.04), (0.5, -0.36, 0.02), (0.64, 0.3, 0.12), (-0.1, 0.5, 0.1),
            (-0.28, -0.2, 0.44), (0.24, -0.14, 0.4), (0.04, 0.24, 0.5)]
COAL_TOP = 0.44


def _flame(w, h, at, outer, inner=None, line=2.4, depth=0.16):
    o = P.slab(P.flame2(w, h), depth, depth * 0.45, 3, 'flame')
    P.xf(o, loc=at)
    P.paint(o, outer, line=line)
    if inner:
        i = P.slab(P.flame2(w * 0.55, h * 0.6), depth * 0.6, depth * 0.3, 2, 'core')
        P.xf(i, loc=(at[0], at[1] - depth * 0.55, at[2] - h * 0.08))
        P.paint(i, inner, line=0.0)
    return o


def _coal(r):
    """The coal and its glowing cracks (projected onto its facets). Returns the coal's BVH for placing parts."""
    c = P.hull(COAL_PTS, bevel=0.06, seg=3, name='coal')
    P.paint(c, COAL[r], steps=(0.12, 0.64, 0.04), deep_at=-0.6, line=2.6)
    tree = P.bvh(c)
    hot = r in ('superRare', 'mythic', 'legendary', 'zenith')
    rad = 0.032 if r == 'common' else 0.04
    paint = CRACK_HOT if hot else CRACK
    if r == 'zenith':
        paint = flat('#ff9fd8')
    front = ([(-0.4, -0.04), (-0.22, 0.05), (-0.08, -0.08), (0.1, 0.02), (0.3, -0.1), (0.42, -0.04)],
             [(-0.08, -0.08), (-0.04, -0.24)], [(0.1, 0.02), (0.16, 0.2)])
    for pts in front:
        dense = []
        for (x0, z0), (x1, z1) in zip(pts, pts[1:]):
            for i in range(4):
                dense.append((x0 + (x1 - x0) * i / 4, z0 + (z1 - z0) * i / 4))
        dense.append(pts[-1])
        path = P.on_surface(tree, dense, offset=rad * 0.45)
        if len(path) > 1:
            o = P.tube(path, rad, 6, name='crack')
            P.paint(o, paint, line=0.0)
    top = P.on_surface(tree, [(-0.2, 0.06), (-0.12, -0.0), (-0.04, -0.06), (0.06, -0.02), (0.14, 0.04)],
                       direction=(0, 0, -1), offset=rad * 0.45)
    if len(top) > 1:
        o = P.tube(top, rad * 0.9, 6, name='crack_top')
        P.paint(o, paint, line=0.0)
    return tree


def _on_front(tree, x, z, lift=0.0):
    loc, nrm = P.hit(tree, (x, -10.0, z), (0, 1, 0))
    return loc + nrm * lift, nrm


def _collar(tree, z, paint, gap=0.012, n=48):
    """A rose-gold strap hugging the coal at height z (rays cast in from outside at n azimuths)."""
    path = []
    for i in range(n):
        a = 2 * math.pi * i / n
        d = Vector((math.cos(a), math.sin(a), 0.0))
        loc, _ = P.hit(tree, d * 3.0 + Vector((0.0, 0.0, z)), -d)
        if loc is not None:
            path.append(Vector((loc.x, loc.y, z)) + d * (gap + 0.03))
    o = P.sweep(path, P.rrect2(0.05, 0.1, 0.02, 3), closed=True, up=(0, 0, 1), name='collar')
    return P.paint(o, paint, line=1.6)


def _claw(tree, azim, paint, r=0.042):
    """A rose-gold claw from the waist band up the side and over the top edge of the coal."""
    d = Vector((math.cos(math.radians(azim)), math.sin(math.radians(azim)), 0.0))
    pts = []
    for z in (-0.12, 0.04, 0.2):
        loc, _ = P.hit(tree, d * 3.0 + Vector((0.0, 0.0, z)), -d)
        if loc is not None:
            pts.append(Vector((loc.x, loc.y, z)) + d * (r * 0.8))
    if not pts:
        return
    last = pts[-1]
    rad = Vector((last.x, last.y, 0.0)).length
    loc, _ = P.hit(tree, (d.x * rad * 0.72, d.y * rad * 0.72, 3.0), (0, 0, -1))
    if loc is not None:
        pts.append(loc + Vector((0.0, 0.0, r * 0.8)))
    o = P.tube(P.smooth_path(pts, 14), r, 10, name='claw')
    P.paint(o, paint, line=1.6)
    tip = P.sphere(r * 1.25, 14, 8, 'clawtip')
    P.xf(tip, loc=pts[-1])
    P.paint(tip, paint, line=1.4)


def ember(r, row):
    tree = _coal(r)
    if r == 'common':
        return dict(kind='standing', yaw=20, elev=20)
    big = r != 'rare'
    fw, fh = (0.6, 0.86) if big else (0.42, 0.6)
    inner = CORE_BLUE if r == 'rare' else FLAME_Y
    outer = FLAME_ROSE if r == 'mythic' else FLAME_O
    if r == 'zenith':
        outer = C.paint('#ff9ed3', light='#ffd2ec', shadow='#e66fb8', ink='#5c1f5a', glow=0.4, iri=0.2)
        inner = C.paint('#fff0fa', light='#ffffff', shadow='#ffc6ea', ink='#5c1f5a', glow=0.6)
    _flame(fw, fh, (0.02, 0.04, 0.3 + 0.35 * fh), outer, inner, depth=0.15)
    if r == 'superRare':
        loc, nrm = _on_front(tree, 0.24, -0.14)
        g = K.cut_gem(0.12, (0, 0, 0), dict(C.TIER_GEM['superRare'], steps=(0.5, 0.9, 0.02), deep_at=0.2), line=1.2)
        P.face_to(g, nrm, loc + nrm * 0.03)
        P.glint((-0.34, -0.5, 0.25), 9)
    if r == 'mythic':                            # a rose-gold setting: a band round the waist, four claws over the top
        _collar(tree, -0.14, C.ROSE_GOLD)
        for az in (-140, -40, 40, 140):
            _claw(tree, az, C.ROSE_GOLD, r=0.05)
        P.glint((-0.34, -0.5, 0.25), 10)
    if r == 'rare':
        P.glint((-0.34, -0.5, 0.25), 9)
    if r in ('legendary', 'zenith'):             # gold (or iridescent) sun frame behind the coal
        t = trim(r)
        cz = 0.24
        ring = P.torus(0.78, 0.075, 72, 12, 'sunring')
        P.xf(ring, rot=(90, 0, 0), loc=(0, 0.52, cz))
        P.paint(ring, t, line=2.2)
        for i in range(8):
            a = math.radians(90 + 45 * i)
            ray = P.cone(0.11, 0.28, concave=1.0, tip=0.2, n=16, name='ray')
            P.xf(ray, scale=(1.0, 0.5, 1.0))
            P.xf(ray, rot=(0, 90 - math.degrees(a), 0), loc=(0.82 * math.cos(a), 0.52, cz + 0.82 * math.sin(a)))
            P.paint(ray, t, line=1.8)
        loc, nrm = _on_front(tree, -0.24, -0.16)
        g = K.cut_gem(0.11, (0, 0, 0), dict(gem(r), steps=(0.5, 0.9, 0.02), deep_at=0.2), line=1.2)
        P.face_to(g, nrm, loc + nrm * 0.03)
        P.glint((0.02, -0.4, 1.0), 13)
        P.glint((-0.64, 0.0, 0.66), 8)
    return dict(kind='standing', yaw=20, elev=18)


# ---------------------------------------------------------------------------
# Rime
# ---------------------------------------------------------------------------

def _rtube(path, r, paint, line):
    """A rod with rounded ends (snowflake arms and twigs)."""
    o = P.tube(path, r, 12, name='arm')
    P.paint(o, paint, line=line)
    for p in (path[0], path[-1]):
        s = P.sphere(r, 16, 8, 'armend')
        P.xf(s, loc=p)
        P.paint(s, paint, line=line)


def _heart_frame(t, heart_p, glints=True):
    heart = P.resample(P.heart2(1.2, 1.12, 160), 26)
    g = P.fan_gem(heart, 0.2, 0.26, name='heart')
    P.paint(g, heart_p, steps=(0.62, 0.9, 0.02), deep_at=0.35, glow=0.12, line=1.6)
    # a thick frame (approved): the path is smoothed at the cleft and the tip (bend radius above the rod's
    # radius) so the fat rod does not crease
    soft = P.resample(P.offset_outline(P.resample(P.heart2(1.2, 1.12, 240), 120), 0.085), 120)
    for _ in range(40):
        n = len(soft)
        soft = [((soft[i - 1][0] + 2 * soft[i][0] + soft[(i + 1) % n][0]) / 4,
                 (soft[i - 1][1] + 2 * soft[i][1] + soft[(i + 1) % n][1]) / 4) for i in range(n)]
    frame = P.ring_along(soft, 0.112, 14, 'frame', scale_depth=0.8)
    P.paint(frame, t, line=2.5)
    for ang in (90, 12, 168, 218, 322):     # five fat arms, as on the approved Winter Heart
        a = math.radians(ang)
        d = Vector((math.cos(a), 0, math.sin(a)))
        off = Vector((0, 0.12, 0))
        _rtube([d * 0.5 + off, d * 1.0 + off], 0.085, t, 2.3)
        for side in (-1, 1):
            tw = Vector((math.cos(a + side * 0.8), 0, math.sin(a + side * 0.8)))
            mid = d * 0.8 + off
            _rtube([mid, mid + tw * 0.2], 0.066, t, 2.0)
    if glints:
        P.glint((0.0, -0.3, 0.0), 16)
        P.glint((-0.55, -0.2, 0.55), 9)


def rime(r, row):
    if r == 'common':
        st = P.sphere(1.0, 48, 24, 'stone', scale=(0.74, 0.62, 0.46))
        P.xf(st, loc=(0, 0, 0.0))
        P.paint(st, STONE, line=2.6)
        cap = P.sphere(1.0, 48, 24, 'cap', scale=(0.68, 0.56, 0.38))
        P.xf(cap, loc=(-0.03, -0.03, 0.2))
        P.paint(cap, C.SNOW, line=2.0)
        _prism((0.04, 0.0, 0.36), 0.15, 1.0, 0.24, ICE, rot=(0, 6, 0))
        _prism((-0.34, -0.06, 0.3), 0.12, 0.58, 0.18, ICE, rot=(0, -28, 0))
        _prism((0.4, -0.1, 0.28), 0.11, 0.52, 0.17, ICE, rot=(0, 32, 0))
        P.glint((0.12, -0.15, 1.6), 9)
        return dict(kind='standing', yaw=20, elev=14)
    if r == 'rare':
        _snow((0.0, 0.0, 0.0), 0.62, 0.5, 0.3)
        ring = P.torus(0.6, 0.06, 64, 10, 'frostring')
        P.xf(ring, scale=(1, 0.82, 1), loc=(0, 0, 0.0))
        P.paint(ring, C.SILVER, line=2.0)
        spray = C.paint('#b5f0ff', light='#e8fbff', shadow='#74c8ee', ink='#1b4f7a', deep='#4fa8e0')
        for ang, h, rr in ((0, 1.25, 0.12), (-24, 1.0, 0.1), (24, 1.05, 0.1), (-46, 0.72, 0.08), (46, 0.78, 0.08), (-10, 0.6, 0.07)):
            _prism((math.sin(math.radians(ang)) * 0.12, -0.02, 0.1), rr, h, rr * 1.9, spray, rot=(0, ang, 0), sides=4, line=2.0, a0=0.785)
        P.glint((0.05, -0.2, 1.55), 10)
        return dict(kind='standing', yaw=16, elev=14)
    if r == 'superRare':
        _snow((0.0, 0.0, 0.0), 0.8, 0.56, 0.15)
        _prism((0.0, 0.05, 0.02), 0.3, 1.1, 0.36, LAV, rot=(0, 5, 0), line=2.6)
        _prism((-0.5, -0.02, 0.0), 0.23, 0.72, 0.28, LAV, rot=(0, -34, 0), line=2.4)
        _prism((0.52, 0.02, 0.0), 0.24, 0.78, 0.28, LAV, rot=(0, 26, 0), line=2.4)
        _prism((-0.26, -0.3, 0.0), 0.12, 0.36, 0.15, LAV, rot=(0, -44, 0), line=2.0)
        P.glint((0.1, -0.2, 1.55), 10)
        return dict(kind='standing', yaw=18, elev=16)
    if r == 'mythic':
        ring = P.torus(0.72, 0.09, 64, 12, 'aurora_ring')
        P.xf(ring, scale=(1, 0.7, 1), loc=(0, 0, 0.0))
        P.paint(ring, C.ROSE_GOLD, line=2.2)
        mint = C.paint('#b8f5e6', light='#e6fff8', shadow='#74d6c4', ink='#1d4a5a', deep='#4cb8b0', glow=0.35)
        lilac = C.paint('#c3d6ff', light='#eef3ff', shadow='#8ea6f2', ink='#2a2a6e', deep='#6c84e4', glow=0.35)
        violet = C.paint('#c8b4ff', light='#efe8ff', shadow='#9a7cff', ink='#2a2a6e', deep='#7a5cff', glow=0.35)
        _prism((0.02, 0.04, 0.0), 0.27, 1.05, 0.34, lilac, rot=(0, 4, 0), line=2.6)
        _prism((-0.45, 0.0, -0.02), 0.21, 0.7, 0.26, mint, rot=(0, -30, 0), line=2.4)
        _prism((0.48, 0.02, -0.02), 0.22, 0.74, 0.27, violet, rot=(0, 26, 0), line=2.4)
        _prism((0.2, -0.3, -0.02), 0.11, 0.34, 0.14, mint, rot=(0, 30, 0), line=2.0)
        P.glint((0.08, -0.2, 1.45), 10)
        return dict(kind='standing', yaw=18, elev=18)
    if r == 'legendary':
        _heart_frame(C.GOLD_TRIM, C.paint('#c8ebfc', light='#eef9ff', shadow='#8cc4f0', ink='#1b4574', deep='#68a3e0', spec=0.0))
        return dict(kind='flat', roll=-8.0, turn=10.0, tip=12.0)
    _heart_frame(ZEN_TRIM, C.paint('#d6c6fa', light='#ffffff', shadow='#a98cea', ink='#3f2470', deep='#8a6cdc', iri=0.45,
                                   anchor=0.75, base_anchor=0.5))
    return dict(kind='flat', roll=-8.0, turn=10.0, tip=12.0)


# ---------------------------------------------------------------------------
# Charm: the omamori pouch (or the lacquered tag) at every tier
# ---------------------------------------------------------------------------

CHARM_W, CHARM_H = 0.9, 1.3


def _pouch_outline(w=CHARM_W, h=CHARM_H):
    pts = [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h * 0.32), (w * 0.3, h / 2), (-w * 0.3, h / 2), (-w / 2, h * 0.32)]
    return P.poly_round(pts, 0.12, 4)


def _pouch(paint, band_p=None, w=CHARM_W, h=CHARM_H, frame_p=None):
    pts = _pouch_outline(w, h)
    o = P.slab(pts, 0.34, 0.14, 5, 'pouch')
    P.paint(o, paint, line=2.6)
    if frame_p:                                  # a trim cord round the front face
        fr = P.ring_along(P.offset_outline(pts, -0.12), 0.036, 10, 'ptrim', scale_depth=0.7)
        P.xf(fr, loc=(0, -0.17, 0))
        P.paint(fr, frame_p, line=1.4, lift=0.02)
    if band_p:
        b = P.slab(P.rrect2(w - 0.1, 0.16, 0.04, 3), 0.04, 0.015, 2, 'pband')
        P.xf(b, loc=(0, -0.17, h * 0.2))
        P.paint(b, band_p, line=1.4, lift=0.03)
    return -0.17


def _cord(paint, knot_p=None, loop=True):
    if loop:
        lp = P.tube(P.smooth_path([(-0.06, 0.0, 0.62), (-0.22, 0.0, 0.92), (0.0, 0.0, 1.08), (0.22, 0.0, 0.92), (0.06, 0.0, 0.62)], 30),
                    0.04, 10, name='cord')
        P.paint(lp, paint, line=1.8)
    k = P.sphere(0.11, 20, 10, 'knot', scale=(1.2, 0.9, 0.9))
    P.xf(k, loc=(0, -0.05, 0.64))
    P.paint(k, knot_p or paint, line=1.8)
    for sx in (-1, 1):
        tail = P.tube([(sx * 0.05, -0.08, 0.6), (sx * 0.2, -0.12, 0.4)], 0.035, 8, name='tail')
        P.paint(tail, paint, line=1.6)


def _bell(at, metal, line=1.8):
    """A round hand bell: knob, dome, flared lip and a clapper ball under it, hung on a short cord."""
    x, y, z = at
    prof = [(0.0, 0.36), (0.07, 0.355), (0.13, 0.32), (0.17, 0.25), (0.185, 0.15), (0.2, 0.07), (0.25, 0.01, 'S'),
            (0.235, -0.015), (0.2, 0.0), (0.0, 0.02)]
    b = P.lathe(prof, segs=40, name='bell')
    P.xf(b, loc=(x, y, z))
    P.paint(b, dict(metal, sheen=0.0), line=line)
    knob = P.torus(0.05, 0.022, 20, 8, 'bellknob')
    P.xf(knob, rot=(90, 0, 0), loc=(x, y, z + 0.4))
    P.paint(knob, metal, line=1.2)
    ball = P.sphere(0.065, 20, 10, 'clapper')
    P.xf(ball, loc=(x, y - 0.03, z - 0.05))
    P.paint(ball, metal, line=1.2)


def charm(r, row):
    red = C.paint('#e5383b', light='#f26b6b', shadow='#c0252e', ink='#5a0f14')
    if r == 'common':
        fy = _pouch(C.PAPER, band_p=C.paint('#f2dfb8', light='#faecd0', shadow='#dcc497', ink='#6b4a2a'))
        _cord(red)
        K.blossom(0.22, 0.02, (0, fy, -0.18), C.paint('#d9605a', light='#e98680', shadow='#b8403e', ink='#6b2a20'), line=1.0)
        return dict(kind='flat', roll=-10.0, turn=16.0, tip=12.0)
    if r == 'rare':
        blue = C.paint('#7fb6f5', light='#b2d4fa', shadow='#4f88de', ink='#173569', sheen=0.3)
        fy = _pouch(blue, band_p=C.paint('#e3f0ff', light='#ffffff', shadow='#b9d3f4', ink='#173569'))
        _cord(C.paint('#e3f0ff', light='#ffffff', shadow='#b9d3f4', ink='#173569'), knot_p=C.SILVER)
        K.blossom(0.22, 0.03, (0, fy, -0.2), C.paint('#ffffff', light='#ffffff', shadow='#dce8f8', ink='#173569'), line=1.2,
                  pearl=C.paint('#ffe37a', light='#fff3b8', shadow='#f2b83a', ink='#7d4705'))
        ring = P.torus(0.1, 0.03, 24, 8, 'cring')
        P.xf(ring, rot=(90, 0, 0), loc=(0, -0.1, 0.92))
        P.paint(ring, C.SILVER, line=1.4)
        P.glint((-0.3, -0.25, 0.4), 10)
        return dict(kind='flat', roll=-10.0, turn=16.0, tip=12.0)
    if r == 'superRare':
        vio = C.paint('#b49af7', light='#d3c4fb', shadow='#8a6be8', ink='#34206e', sheen=0.3)
        fy = _pouch(vio, band_p=C.paint('#e2d8fd', light='#f2edff', shadow='#c2b0f6', ink='#34206e'))
        _cord(C.paint('#e2d8fd', light='#f2edff', shadow='#c2b0f6', ink='#34206e'), knot_p=C.TIER_GEM['superRare'])
        hang = P.tube([(0.0, -0.08, 0.56), (0.0, -0.4, 0.16)], 0.022, 8, name='bellcord')
        P.paint(hang, C.paint('#e2d8fd', light='#f2edff', shadow='#c2b0f6', ink='#34206e'), line=1.0)
        _bell((0.0, -0.4, -0.26), C.SILVER, line=2.0)
        P.glint((-0.3, -0.4, 0.3), 10)
        return dict(kind='flat', roll=-10.0, turn=16.0, tip=12.0)
    if r == 'mythic':
        lac = C.paint('#ff6d8a', light='#ff9fb1', shadow='#d6416a', ink='#6e1a3c', sheen=0.3, spec=0.4, spec_at=0.99)
        pts = [(-0.45, -0.72), (0.45, -0.72), (0.45, 0.4), (0.0, 0.72), (-0.45, 0.4)]
        tag = P.slab(P.poly_round(pts, 0.1, 4), 0.2, 0.07, 3, 'tag')
        P.paint(tag, lac, line=2.6)
        cap = P.slab(P.poly_round([(-0.48, 0.32), (0.48, 0.32), (0.48, 0.44), (0.0, 0.78), (-0.48, 0.44)], 0.08, 3), 0.24, 0.08, 3, 'tcap')
        P.xf(cap, loc=(0, 0, 0.02))
        P.paint(cap, C.ROSE_GOLD, line=2.0)
        K.blossom(0.27, 0.04, (0, -0.1, -0.15), C.paint('#ffd6e2', light='#fff0f5', shadow='#ffa8c0', ink='#6e1a3c', glow=0.6), line=1.3,
                  pearl=C.paint('#fff3b8', light='#ffffff', shadow='#f2b83a', ink='#7d4705', glow=0.4))
        _cord(C.paint('#ffd0e0', light='#ffe6ee', shadow='#f7a8c2', ink='#6e1a3c'), loop=True)
        P.glint((-0.25, -0.2, 0.25), 10)
        return dict(kind='flat', roll=-10.0, turn=16.0, tip=12.0)
    # legendary / zenith: the same omamori in silk, trimmed in gold (iridescent), an inset gem in the blossom
    zen = r == 'zenith'
    t = trim(r)
    silk = C.paint('#fff6ea', light='#ffffff', shadow='#f0d2a6', ink='#74430a', sheen=0.3) if not zen else \
        C.over(ZEN_BODY, sheen=0.3)
    fy = _pouch(silk, band_p=t, frame_p=t)
    _cord(t, knot_p=t)
    bl = C.paint('#ff8fbf', light='#ffbfd8', shadow='#e85895', ink='#781948') if not zen else \
        C.paint('#ffb8dc', light='#ffe4f2', shadow='#e17ec0', ink='#5a1f5e', iri=0.35, anchor=0.6)
    K.blossom(0.3, 0.04, (0, fy, -0.2), bl, line=1.4)
    _cut_front(0.1, (0, fy - 0.07, -0.2), gem(r), sides=8, line=1.1)
    P.glint((-0.3, -0.25, 0.42), 12)
    P.glint((0.02, -0.3, -0.2), 8)
    return dict(kind='flat', roll=-10.0, turn=16.0, tip=12.0)


# ---------------------------------------------------------------------------
# Rune: a stone tablet at every tier, the emblem is a sigil ring with a four-point star (never a letter)
# ---------------------------------------------------------------------------

def _sigil(front_y, paint, s=1.0, line=1.0, gem_p=None, depth=0.035):
    """Embossed sigil: a ring with a four-point star across it (and an optional inset gem at the centre)."""
    q = paint
    ring = P.ring_along(P.circle2(0.3 * s, 48), 0.036 * s, 8, 'sigring', scale_depth=0.55)
    P.xf(ring, loc=(0, front_y - 0.012 * s, 0.02 * s))
    P.paint(ring, q, line=line, lift=0.02)
    st = P.slab(P.poly_round(P.star2(4, 0.27 * s, 0.075 * s), 0.012 * s, 2), depth * s, depth * 0.4 * s, 2, 'sigstar')
    P.xf(st, loc=(0, front_y - depth * 0.5 * s + 0.004, 0.02 * s))
    P.paint(st, q, line=line, lift=0.02)
    for a in (45, 135, 225, 315):
        d = P.sphere(0.04 * s, 12, 6, 'sigdot', scale=(1, 0.5, 1))
        P.xf(d, loc=(0.3 * s * math.cos(math.radians(a)), front_y - 0.014 * s, 0.02 * s + 0.3 * s * math.sin(math.radians(a))))
        P.paint(d, q, line=line * 0.8, lift=0.02)
    if gem_p:
        g = P.cabochon(0.085 * s, 0.06 * s)
        P.xf(g, rot=(90, 0, 0), loc=(0, front_y - depth * s, 0.02 * s))
        P.paint(g, gem_p, line=1.0, spec=1.0, spec_at=0.985)


def _tablet(paint, w=1.0, h=1.3, d=0.24, outline=None, line=2.6):
    o = P.slab(outline or P.rrect2(w, h, 0.12, 6), d, d * 0.35, 3, 'tablet')
    P.paint(o, paint, line=line)
    return -d / 2


def _frame(paint, w=1.0, h=1.3, front=-0.12, r=0.06, inset=0.0):
    fr = P.ring_along(P.rrect2(w - inset, h - inset, 0.12, 6), r, 10, 'rim', scale_depth=0.8)
    P.xf(fr, loc=(0, front + 0.04, 0))
    P.paint(fr, paint, line=2.0)


def rune(r, row):
    if r == 'common':
        fy = _tablet(C.paint('#bcc3d4', light='#dde1ec', shadow='#8e95ad', ink='#353c55', rim=0.3))
        _sigil(fy, C.paint('#f7f8fb', light='#ffffff', shadow='#d9dde8', ink='#4a5270', rim=0.0), line=0.9)
        return dict(kind='flat', roll=-10.0, turn=20.0, tip=16.0)
    if r == 'rare':
        fy = _tablet(C.paint('#f4ead4', light='#fffaf0', shadow='#dccaa4', ink='#5a4426', rim=0.0, drift=0.05))
        _frame(C.SILVER, front=fy, r=0.055)
        _sigil(fy, C.paint('#3a78d4', light='#6a9ce6', shadow='#2a5cae', ink='#14306a', rim=0.0), line=0.9)
        P.glint((-0.36, -0.2, 0.5), 9)
        return dict(kind='flat', roll=8.0, turn=18.0, tip=14.0)
    if r == 'superRare':
        cut = P.poly_round([(-0.5, -0.45), (-0.3, -0.66), (0.32, -0.66), (0.5, -0.46), (0.5, 0.44), (0.3, 0.66), (-0.3, 0.66),
                            (-0.5, 0.46)], 0.07, 3)
        fy = _tablet(C.paint('#ad97f6', light='#ccbdfb', shadow='#8169e4', ink='#2c1a6e', rim=0.4), outline=cut, d=0.28)
        _sigil(fy, C.paint('#e6f3ff', light='#ffffff', shadow='#bcd6ff', ink='#2c1a6e', glow=0.6), line=1.0,
               gem_p=C.TIER_GEM['superRare'])
        P.glint((-0.34, -0.25, 0.45), 9)
        return dict(kind='flat', roll=-8.0, turn=18.0, tip=14.0)
    if r == 'mythic':
        tab = P.slab(P.rrect2(1.0, 1.3, 0.22, 6), 0.22, 0.08, 3, 'tablet')
        P.paint(tab, C.paint('#8f80f5', light='#b2a7f8', shadow='#6a5ae0', ink='#1d1660', sheen=0.2), line=2.6)
        fr = P.ring_along(P.rrect2(1.0, 1.3, 0.22, 6), 0.06, 10, 'rim', scale_depth=0.8)
        P.xf(fr, loc=(0, -0.08, 0))
        P.paint(fr, C.ROSE_GOLD, line=2.0)
        # a closed kite of four stars with one star off its tail: a constellation, never a letter
        stars = [(-0.04, 0.4), (0.26, 0.1), (0.0, -0.22), (-0.26, 0.06), (0.16, -0.42)]
        glowp = C.paint('#fff1b8', light='#ffffff', shadow='#ffd76a', ink='#6e3b08', glow=0.7, rim=0.0)
        for i, j in ((0, 1), (1, 2), (2, 3), (3, 0), (2, 4)):
            a, b = stars[i], stars[j]
            l = P.tube([(a[0], -0.13, a[1]), (b[0], -0.13, b[1])], 0.014, 6, name='cline')
            P.paint(l, C.over(glowp, base='#d8d2ff', light='#efeaff'), line=0.0)
        for x, z in stars:
            s = P.slab(P.poly_round(P.star2(4, 0.075, 0.03), 0.008, 2), 0.03, 0.01, 1, 'cstar')
            P.xf(s, loc=(x, -0.14, z))
            P.paint(s, glowp, line=1.0)
        return dict(kind='flat', roll=-10.0, turn=18.0, tip=14.0)
    # legendary / zenith: the tablet in a thick gold (iridescent) frame with a glowing sigil
    zen = r == 'zenith'
    stone = C.paint('#8a6cf0', light='#ad97f8', shadow='#6447d6', ink='#1f135e', sheen=0.15) if not zen else ZEN_FACE
    fy = _tablet(stone)
    _frame(trim(r), front=fy, r=0.085)
    _sigil(fy, GLOW_GOLD if not zen else ZEN_GEM, s=1.05, line=1.2, gem_p=gem(r))
    P.glint((-0.4, -0.22, 0.55), 12)
    P.glint((0.0, -0.25, 0.02), 8)
    return dict(kind='flat', roll=-10.0, turn=20.0, tip=16.0)


# ---------------------------------------------------------------------------
# Cog
# ---------------------------------------------------------------------------

def _gear(R, teeth, paint, depth=0.22, hole=0.18, at=(0, 0, 0), bent=False, line=2.6):
    pts = P.gear2(R, teeth, 0.2, n_per=10)
    if bent:      # one bent tooth: push the tooth at the upper right sideways
        out = []
        for x, z in pts:
            a = math.atan2(z, x)
            if abs(a - math.radians(45)) < math.radians(14) and math.hypot(x, z) > R * 0.85:
                x, z = x + 0.06 * R, z - 0.03 * R
            out.append((x, z))
        pts = out
    g = P.slab(pts, depth, depth * 0.3, 2, 'gear')
    P.xf(g, loc=at)
    P.paint(g, paint, line=line)
    if hole:
        h = P.slab(P.circle2(hole, 32), depth * 1.05, depth * 0.2, 2, 'hole')
        P.xf(h, loc=at)
        P.paint(h, C.over(paint, base=paint['shadow'], light=paint['shadow']), line=1.2)
    return g


BLUE_STEEL = C.paint('#9cb9e4', light='#d8e7fa', shadow='#6688c4', ink='#1f3a6a', spec=1.0, rim=0.6, spec_at=0.98)


def cog(r, row):
    if r == 'common':
        _gear(1.0, 8, dict(C.BRASS, base='#dcb183'), bent=True, hole=0.24)
        return dict(kind='flat', roll=-8.0, turn=24.0, tip=24.0)
    if r == 'rare':
        _gear(1.0, 10, dict(BLUE_STEEL, sheen=0.2), hole=0.0)
        hub = P.lathe([(0.0, 0.0), (0.26, 0.0, 'S'), (0.26, 0.22), (0.2, 0.28, 'S'), (0.0, 0.28)], segs=40, name='hub', axis='Y')
        P.xf(hub, loc=(0, -0.08, 0))
        P.paint(hub, C.SILVER, line=2.0)
        axle = P.lathe([(0.0, 0.0), (0.09, 0.0), (0.09, 0.42), (0.0, 0.42)], segs=24, name='axle', axis='Y')
        P.xf(axle, loc=(0, -0.08, 0))
        P.paint(axle, C.STEEL, line=1.6)
        P.glint((-0.5, -0.3, 0.55), 10)
        return dict(kind='flat', roll=-8.0, turn=24.0, tip=24.0)
    if r == 'superRare':
        for z in (0.0, 1.25):
            cap = P.lathe([(0.0, 0.0), (0.5, 0.0, 'S'), (0.55, 0.06), (0.55, 0.14), (0.5, 0.2, 'S'), (0.0, 0.2)], segs=48, name='scap')
            P.xf(cap, loc=(0, 0, z - 0.1))
            P.paint(cap, C.SILVER, line=2.2)
        coil = P.tube(P.helix(0.4, 1.05, 4.5, 180, z0=0.05), 0.06, 10, name='spring')
        P.paint(coil, dict(C.STEEL, sheen=0.0), line=1.8)
        g = P.gem(0.16, sides=8, crown=0.32, table=0.56, pavilion=0.4)
        P.xf(g, scale=(1, 1, 0.6), loc=(0, 0, 1.36))
        P.paint(g, dict(C.TIER_GEM['superRare'], steps=(0.5, 0.9, 0.02), deep_at=0.2), line=1.3, smooth=False)
        P.glint((-0.3, -0.5, 1.3), 10)
        return dict(kind='standing', yaw=20, elev=18)
    if r == 'mythic':                            # the mainspring sits in a rose-gold gear housing (a gear, not a disc)
        _gear(1.0, 10, C.ROSE_GOLD, depth=0.3, hole=0.0)
        plate = P.slab(P.circle2(0.6, 64), 0.05, 0.02, 2, 'plate')
        P.xf(plate, loc=(0, -0.16, 0))
        P.paint(plate, C.paint('#3d6f8a', light='#4d8aa6', shadow='#2d5670', ink='#0f3044', rim=0.0), line=1.2, lift=0.03)
        sp = P.tube(P.spiral2(0.07, 0.5, 3.0), 0.038, 8, name='mainspring')
        P.xf(sp, loc=(0, -0.21, 0))
        P.paint(sp, C.paint('#8af0ff', light='#d2fbff', shadow='#4cc8e0', ink='#0f4a5c', glow=0.8), line=1.2)
        P.glint((-0.5, -0.4, 0.5), 10)
        return dict(kind='flat', roll=-8.0, turn=22.0, tip=22.0)
    zen = r == 'zenith'
    _gear(1.0, 12, dict(ZEN_FACE) if zen else dict(C.GOLD_TRIM, sheen=0.2), hole=0.0)
    rim = P.torus(0.42, 0.06, 48, 10, 'corering')
    P.xf(rim, rot=(90, 0, 0), loc=(0, -0.12, 0))
    P.paint(rim, ZEN_TRIM if zen else C.GOLD_TRIM, line=1.8)
    _cut_front(0.36, (0, -0.14, 0), ZEN_GEM if zen else dict(C.TIER_GEM['legendary'], glow=0.4), sides=10, line=1.4)
    P.glint((0.0, -0.4, 0.0), 15)
    P.glint((-0.62, -0.3, 0.55), 9)
    return dict(kind='flat', roll=-8.0, turn=22.0, tip=22.0)


FAMILIES = dict(feather=feather, blade=blade, ember=ember, rime=rime, charm=charm, rune=rune, cog=cog)


def build(row):
    fam = row['family']
    r = 'zenith' if row.get('tier') == 'zenith' else row['rarity']
    return FAMILIES[fam](r, row)
