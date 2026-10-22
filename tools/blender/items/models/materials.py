"""Breakthrough materials (mat_<family>_<rarity>, mat_<family>_zenith): seven families, one base model
each, with the tier ladder of PLAN 3.5 (common = the humble version, rare silver trim, super rare an
inset gem, mythic rose gold + inner glow, legendary gold + star, zenith = the legendary object in
pearl white with iridescent trim)."""
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

# Zenith: the legendary object in pearl white, iridescent trim, prism glints
ZEN_BODY = C.paint('#f8f4ff', light='#ffffff', shadow='#cfc2ee', ink='#4a2a6e', iri=0.35, spec=0.6, spec_at=0.985)
ZEN_TRIM = dict(C.IRI, iri=0.9)
ZEN_GEM = C.paint('#f3e6ff', light='#ffffff', shadow='#c4a8f2', ink='#4a2a6e', deep='#a585e8', iri=0.6, glow=0.4,
                  spec=0.8, spec_at=0.99)
GLOW_GOLD = C.paint('#ffd75a', light='#fff3b0', shadow='#f2a922', ink='#6e3b08', glow=0.5, spec=0.6, spec_at=0.985)


def trim(r):
    return dict(rare=C.SILVER, superRare=C.SILVER, mythic=C.ROSE_GOLD, legendary=C.GOLD_TRIM, zenith=ZEN_TRIM).get(r)


def gem(r):
    return dict(superRare=C.TIER_GEM['superRare'], mythic=C.TIER_GEM['mythic'], legendary=C.TIER_GEM['legendary'],
                zenith=ZEN_GEM, rare=C.TIER_GEM['rare']).get(r)


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
# Feather
# ---------------------------------------------------------------------------

FEATHER = dict(
    common=C.paint('#c9a27a', light='#e2c39d', shadow='#a57d58', ink='#5a3a1e', rim=0.3),
    rare=C.paint('#7cbcf5', light='#acd6fa', shadow='#4f8fe0', ink='#1a3566', rim=0.4, sheen=0.2),
    superRare=C.paint('#f2b45a', light='#f9d18e', shadow='#d88a2c', ink='#6b3a0c', rim=0.4),
    mythic=C.paint('#ff7a5a', light='#ffab86', shadow='#e04a3e', ink='#6e1a2a', rim=0.5, glow=0.2),
    legendary=C.paint('#fff6e0', light='#ffffff', shadow='#efd9a8', ink='#6e4a10', rim=0.3),
    zenith=ZEN_BODY,
)


def _vane(w, h, asym, notches, flame=False):
    pts = P.leaf2(w, h, 70, asym=asym, tip_sharp=1.15)
    out = []
    for x, z in pts:
        u = z / h
        for nz, side, depth in notches:
            if (x > 0) == (side > 0) and abs(u - nz) < 0.04:
                x *= 1 - depth * (1 - abs(u - nz) / 0.04)
        if flame and u > 0.7:
            x *= 1 + 0.18 * math.sin((u - 0.7) * 40) * (u - 0.7) * 3
        out.append((x, z))
    return out


def feather(r, row):
    body = FEATHER[r]
    sleek = r in ('rare', 'mythic')
    w = 0.52 if sleek else 0.62
    notches = [(0.42, -1, 0.35), (0.62, 1, 0.3)] if r == 'common' else [(0.55, 1, 0.22)]
    vane = _vane(w, 1.75, 0.12, notches, flame=(r == 'mythic'))
    if r in ('legendary', 'zenith'):        # pale-gold (or iridescent) edge: a slightly larger vane behind
        edge = P.slab(P.offset_outline(vane, 0.05), 0.05, 0.02, 2, 'edge')
        P.xf(edge, loc=(0, 0.03, 0))
        P.paint(edge, trim(r), line=2.2)
    v = P.slab(vane, 0.07, 0.03, 2, 'vane')
    extra = {}
    if r == 'superRare':
        extra = dict(stripe=(0.55, 2.2, 0.35), stripe_dir=(0, 0, 1))
    P.paint(v, body, line=2.4, **extra)
    if r == 'mythic':
        tipv = P.slab(_vane(w * 0.55, 0.75, 0.1, [], flame=True), 0.05, 0.02, 2, 'flametip')
        P.xf(tipv, loc=(0.0, -0.045, 1.02))
        P.paint(tipv, C.paint('#ffc061', light='#ffe1a1', shadow='#f2953a', ink='#6e2a10', glow=0.4), line=1.4, lift=0.03)
    shaft_p = C.paint('#fff4dc', light='#ffffff', shadow='#e6d2a8', ink=body['ink'], rim=0.3)
    if r == 'mythic':
        shaft_p = C.paint('#fff0c2', light='#ffffff', shadow='#ffcf7a', ink=body['ink'], glow=0.6)
    shaft = P.sweep(P.smooth_path([(0, -0.06, -0.42), (0.0, -0.06, 0.6), (0.02, -0.06, 1.6)], 30), P.circle2(1.0, 10),
                    scales=[0.04 * (1 - 0.7 * i / 30) for i in range(30)], name='shaft')
    P.paint(shaft, shaft_p, line=1.4)
    t = trim(r)
    if t:
        cap = P.tube([(0, -0.06, -0.3), (0, -0.06, -0.12)], 0.065, 14, name='cap')
        P.paint(cap, t, line=1.6)
        if r in ('superRare', 'legendary', 'zenith'):
            _gem_front(0.045, (0, -0.12, -0.21), gem(r), line=1.0)
    if r in ('legendary', 'zenith'):
        P.glint((0.1, -0.1, 1.3), 12)
    elif r != 'common':
        P.glint((-0.18, -0.12, 0.85), 9)
    return dict(kind='flat', roll=38.0, turn=14.0, tip=12.0)


# ---------------------------------------------------------------------------
# Blade
# ---------------------------------------------------------------------------

BLADE = dict(
    common=C.paint('#b6bfcc', light='#d6dce5', shadow='#8d97a8', ink='#343f55', rim=0.4),
    rare=dict(C.STEEL, sheen=0.25),
    superRare=C.paint('#a3acf5', light='#ccd1fb', shadow='#7a80e6', ink='#22286e', spec=0.8, spec_at=0.985, sheen=0.2),
    mythic=dict(C.STEEL, sheen=0.2),
    legendary=C.paint('#fff1c2', light='#fffaea', shadow='#f2cf7a', ink='#6e3b08', spec=0.8, spec_at=0.985, sheen=0.25),
    zenith=ZEN_BODY,
)


def blade(r, row):
    body = BLADE[r]
    pts = [(-0.24, -0.62), (0.22, -0.62), (0.3, 0.25), (0.04, 1.12), (-0.24, 0.42)]
    if r == 'common':
        pts = [(-0.24, -0.62), (0.22, -0.62), (0.3, 0.12), (0.2, 0.3), (0.29, 0.42), (0.04, 1.05), (-0.24, 0.42)]
    pts = P.poly_round(pts, 0.03, 2)
    spine = [(-0.01, -0.5, 0.09), (0.0, -0.1, 0.1), (0.03, 0.35, 0.1), (0.04, 0.85, 0.06)]
    g = P.fan_gem(pts, 0.1, 0.1, spine=spine, name='blade')
    P.paint(g, dict(body, steps=(0.4, 0.86, 0.02), deep_at=-0.2), line=2.6)
    if r == 'mythic':
        tp = P.fan_gem(P.poly_round([(-0.21, 0.46), (0.27, 0.29), (0.04, 1.09)], 0.02, 2), 0.1, 0.11,
                       spine=[(0.02, 0.45, 0.11), (0.04, 0.9, 0.07)], name='crimson')
        P.xf(tp, loc=(0, -0.012, 0))
        P.paint(tp, C.paint('#ff7a90', light='#ffadba', shadow='#e04866', ink='#6e1a3c', glow=0.35), steps=(0.4, 0.86, 0.02),
                deep_at=-0.2, line=1.6)
    if r == 'rare':
        wave = [(-0.16 + 0.03 * math.sin(i * 1.3), -0.11, -0.5 + i * 0.1) for i in range(12)]
        wv = P.tube(P.smooth_path(wave, 30), 0.012, 6, name='temper')
        P.paint(wv, C.over(body, base='#eef3fa', light='#ffffff'), line=0.0)
    if r == 'superRare':
        cres = P.slab(P.poly_round(P.crescent2(0.14, cut=0.8, shift=0.4), 0.01, 2), 0.03, 0.01, 2, 'moon')
        P.xf(cres, rot=(0, -30, 0), loc=(0.02, -0.12, 0.1))
        P.paint(cres, C.TIER_GEM['superRare'], line=1.1, lift=0.02)
    t = trim(r)
    if t:
        collar = P.rbox(0.66 if r in ('legendary', 'zenith') else 0.56, 0.2, 0.16, r=0.05, seg=3, name='collar')
        P.xf(collar, loc=(-0.01, 0.0, -0.66))
        P.paint(collar, t, line=2.0)
        grip = P.tube([(0, 0, -0.74), (0, 0, -1.0)], 0.08, 12, name='grip')
        P.paint(grip, C.over(t, base=t['shadow'], light=t['base']), line=1.8)
        if r in ('legendary', 'zenith', 'mythic'):
            _gem_front(0.06, (-0.01, -0.1, -0.66), gem(r), line=1.0)
    if r in ('legendary', 'zenith'):
        P.glint((0.04, -0.12, 1.05), 12)
    elif r != 'common':
        P.glint((-0.15, -0.1, 0.55), 9)
    return dict(kind='flat', roll=-32.0, turn=16.0, tip=12.0)


# ---------------------------------------------------------------------------
# Ember
# ---------------------------------------------------------------------------

def _flame(w, h, at, outer, inner=None, line=2.4, depth=0.18):
    o = P.slab(P.flame2(w, h), depth, depth * 0.45, 3, 'flame')
    P.xf(o, loc=at)
    P.paint(o, outer, line=line)
    if inner:
        i = P.slab(P.flame2(w * 0.55, h * 0.6), depth * 0.6, depth * 0.3, 2, 'core')
        P.xf(i, loc=(at[0], at[1] - depth * 0.55, at[2] - h * 0.08))
        P.paint(i, inner, line=0.0)
    return o


FLAME_O = C.paint('#ff8a3d', light='#ffb36e', shadow='#e85d2a', ink='#6e1a10', glow=0.3)
FLAME_Y = C.paint('#ffd75a', light='#fff3b0', shadow='#ffb02e', ink='#6e3b08', glow=0.5)


def ember(r, row):
    if r == 'common':
        lump = P.lump(0.8, seed=3, amp=0.1, scale=(1.0, 0.85, 0.72))
        P.paint(lump, C.paint('#8f7682', light='#ad97a2', shadow='#6e5664', ink='#3a2632', rim=0.4), line=2.6)
        crack = [(-0.45, -0.62, 0.15), (-0.2, -0.7, 0.0), (-0.05, -0.72, 0.12), (0.18, -0.7, -0.05), (0.42, -0.6, 0.06)]
        c = P.tube(crack, 0.035, 6, name='crack')
        P.paint(c, C.paint('#ffa552', light='#ffd08f', shadow='#ff8a3d', ink='#6b2a08', glow=0.8, rim=0.0), line=0.0)
        c2 = P.tube([(-0.05, -0.72, 0.12), (0.0, -0.65, 0.4)], 0.03, 6, name='crack2')
        P.paint(c2, C.paint('#ffa552', light='#ffd08f', shadow='#ff8a3d', ink='#6b2a08', glow=0.8, rim=0.0), line=0.0)
        return dict(kind='standing', yaw=20, elev=20)
    if r == 'rare':
        dish = P.lathe([(0.0, -0.05), (0.75, 0.0, 'S'), (0.95, 0.22), (0.88, 0.26, 'S'), (0.68, 0.08), (0.0, 0.06)], segs=64, name='dish')
        P.paint(dish, dict(C.SILVER, sheen=0.2), line=2.4)
        lump = P.lump(0.55, seed=5, amp=0.1, scale=(1.0, 0.9, 0.7))
        P.xf(lump, loc=(0, 0, 0.36))
        P.paint(lump, C.paint('#ffa552', light='#ffd08f', shadow='#e8732a', ink='#6b2a08', glow=0.45), line=2.4)
        P.glint((-0.3, -0.4, 0.7), 10)
        return dict(kind='standing', yaw=20, elev=24)
    if r == 'superRare':
        lump = P.lump(0.62, seed=7, amp=0.1, scale=(1.0, 0.85, 0.7))
        P.paint(lump, C.paint('#e8604a', light='#ff8f6a', shadow='#b83a3a', ink='#5a1418', rim=0.5), line=2.6)
        _flame(0.9, 1.1, (0.02, 0.05, 0.42), FLAME_O, FLAME_Y)
        _cut_front(0.13, (0.0, -0.55, -0.02), C.TIER_GEM['superRare'])
        return dict(kind='standing', yaw=16, elev=16)
    if r == 'mythic':
        cup = P.slab(P.poly_round(P.crescent2(0.9, cut=0.82, shift=0.36), 0.04, 3), 0.22, 0.08, 3, 'cradle')
        P.xf(cup, rot=(0, -90, 0), loc=(0, 0.08, -0.4))
        P.paint(cup, C.ROSE_GOLD, line=2.4)
        _flame(1.05, 1.5, (0.0, 0.0, -0.05), C.paint('#ff7043', light='#ffa070', shadow='#e04a2a', ink='#6e1a10', glow=0.5), FLAME_Y,
               depth=0.3)
        P.glint((-0.25, -0.3, 0.55), 10)
        return dict(kind='flat', roll=0.0, turn=12.0, tip=10.0)
    # legendary / zenith: sun orb in a ring with modelled ray spikes, star inside
    zen = r == 'zenith'
    t = trim(r)
    for i in range(10):
        a = math.radians(90 + 36 * i)
        tip = P.lathe([(0.12, 0.0), (0.0, 0.38)], segs=4, name='ray', smooth=False, a0=math.pi / 4)
        P.xf(tip, scale=(1.0, 0.5, 1.0))
        P.xf(tip, rot=(0, 90 - math.degrees(a), 0), loc=(0.78 * math.cos(a), 0.06, 0.78 * math.sin(a)))
        P.paint(tip, dict(t, steps=(0.3, 0.85, 0.02)), line=2.0, smooth=False)
    ring = P.torus(0.74, 0.09, 72, 12, 'sunring')
    P.xf(ring, scale=(1, 1, 0.7), rot=(90, 0, 0))
    P.paint(ring, t, line=2.2)
    orb = P.sphere(0.66, 48, 24, 'sun')
    P.xf(orb, scale=(1, 0.7, 1))
    P.paint(orb, ZEN_GEM if zen else GLOW_GOLD, line=2.0)
    P.glint((0.0, -0.6, 0.0), 16)
    P.glint((-0.32, -0.5, 0.36), 8)
    return dict(kind='flat', roll=-8.0, turn=12.0, tip=10.0)


# ---------------------------------------------------------------------------
# Rime
# ---------------------------------------------------------------------------

def _heart_frame(t, heart_p, glints=True):
    heart = P.resample(P.heart2(1.2, 1.12, 160), 26)
    g = P.fan_gem(heart, 0.2, 0.26, name='heart')
    P.paint(g, heart_p, steps=(0.62, 0.9, 0.02), deep_at=0.35, glow=0.12, line=1.6)
    frame = P.ring_along(P.offset_outline(P.heart2(1.2, 1.12, 160), 0.06), 0.075, 12, 'frame', scale_depth=0.8)
    P.paint(frame, t, line=2.4)
    for ang in (30, 90, 150, 210, 270, 330):
        a = math.radians(ang)
        d = Vector((math.cos(a), 0, math.sin(a)))
        arm = P.tube([d * 0.5 + Vector((0, 0.12, 0)), d * 0.98 + Vector((0, 0.12, 0))], 0.055, 10, name='arm')
        P.paint(arm, t, line=2.2)
        for side in (-1, 1):
            tw = Vector((math.cos(a + side * 0.8), 0, math.sin(a + side * 0.8)))
            mid = d * 0.8 + Vector((0, 0.12, 0))
            twig = P.tube([mid, mid + tw * 0.2], 0.045, 8, name='twig')
            P.paint(twig, t, line=2.0)
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
    _heart_frame(ZEN_TRIM, C.paint('#f6f0ff', light='#ffffff', shadow='#d0c2f0', ink='#4a2a6e', deep='#b5a0e8', iri=0.4))
    return dict(kind='flat', roll=-8.0, turn=10.0, tip=12.0)


# ---------------------------------------------------------------------------
# Charm
# ---------------------------------------------------------------------------

def _pouch(paint, band_p=None, w=0.9, h=1.3):
    pts = [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h * 0.32), (w * 0.3, h / 2), (-w * 0.3, h / 2), (-w / 2, h * 0.32)]
    pts = P.poly_round(pts, 0.12, 4)
    o = P.slab(pts, 0.34, 0.14, 5, 'pouch')
    P.paint(o, paint, line=2.6)
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


def charm(r, row):
    red = C.paint('#e5383b', light='#f26b6b', shadow='#c0252e', ink='#5a0f14')
    if r == 'common':
        fy = _pouch(C.PAPER, band_p=C.paint('#f2dfb8', light='#faecd0', shadow='#dcc497', ink='#6b4a2a'))
        _cord(red)
        mark = P.tube([(0, fy - 0.03, 0.1), (0, fy - 0.03, -0.4)], 0.02, 6, name='mark')
        P.paint(mark, C.paint('#c98f6a', light='#d8a886', shadow='#a8704c', ink='#6b4a2a'), line=0.0)
        return dict(kind='flat', roll=-10.0, turn=16.0, tip=12.0)
    if r == 'rare':
        pink = C.paint('#ff9fbf', light='#ffc4d8', shadow='#e86f9a', ink='#6e1a3c', sheen=0.3)
        fy = _pouch(pink, band_p=C.paint('#ffd0e0', light='#ffe6ee', shadow='#f7a8c2', ink='#6e1a3c'))
        _cord(C.paint('#ffd0e0', light='#ffe6ee', shadow='#f7a8c2', ink='#6e1a3c'), knot_p=C.SILVER)
        K.blossom(0.22, 0.03, (0, fy - 0.0, -0.2), C.paint('#ffffff', light='#ffffff', shadow='#f2dbe5', ink='#6e1a3c'), line=1.2,
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
        bell = P.sphere(0.24, 32, 16, 'bell', scale=(1, 0.9, 0.95))
        P.xf(bell, loc=(0.0, -0.3, -0.22))
        P.paint(bell, C.SILVER, line=2.0)
        slit = P.tube([(-0.12, -0.52, -0.3), (0.12, -0.52, -0.3)], 0.02, 6, name='slit')
        P.paint(slit, C.paint('#5a6880', light='#6e7c94', shadow='#46546c', ink='#33435c'), line=0.0)
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
    zen = r == 'zenith'
    disc = C.paint('#fff3fa', light='#ffffff', shadow='#f2d3e2', ink='#7a1f4a', sheen=0.25) if not zen else ZEN_BODY
    from models.currency import coin_body
    fy = coin_body((0, 0, 0), 1.0, disc, rim_paint=trim(r), sheen=0.25, depth=0.28)
    K.blossom(0.52, 0.05, (0, fy, 0), C.paint('#ff8fbf', light='#ffbfd8', shadow='#ea5f97', ink='#781948') if not zen else ZEN_GEM,
              line=1.5, pearl=C.paint('#ffe37a', light='#fff3b8', shadow='#f2b83a', ink='#7d4705'), pearl_r=0.22)
    P.glint((-0.62, -0.25, 0.55), 13)
    P.glint((0.0, -0.3, 0.0), 9)
    return dict(kind='flat', roll=-10.0, turn=24.0, tip=22.0)


# ---------------------------------------------------------------------------
# Rune
# ---------------------------------------------------------------------------

def _glyph(at_y, paint, scale=1.0, r=0.035, line=0.0, glow=0.0):
    """An original abstract mark (not a letter): a stem, two rising branches and a dot ring."""
    s = scale
    strokes = [
        [(0.0, at_y, -0.42 * s), (0.0, at_y, 0.36 * s)],
        [(0.0, at_y, 0.02 * s), (-0.27 * s, at_y, 0.26 * s)],
        [(0.0, at_y, -0.2 * s), (0.22 * s, at_y, -0.2 * s), (0.22 * s, at_y, 0.04 * s)],
        [(-0.2 * s, at_y, -0.32 * s), (-0.08 * s, at_y, -0.42 * s)],
    ]
    q = dict(paint, glow=glow) if glow else paint
    for st in strokes:
        o = P.tube(st, r * s, 8, name='glyph')
        P.paint(o, q, line=line)
    ring = P.torus(0.07 * s, r * 0.8 * s, 20, 6, 'gdot')
    P.xf(ring, rot=(90, 0, 0), loc=(0.0, at_y, 0.5 * s))
    P.paint(ring, q, line=line)


def rune(r, row):
    if r == 'common':
        tab = P.rbox(1.0, 0.24, 1.3, r=0.1, seg=4, name='slate')
        P.paint(tab, C.paint('#c7cad6', light='#e0e2ea', shadow='#9da1b4', ink='#3a3f55', rim=0.3), line=2.6)
        _glyph(-0.13, C.paint('#f7f8fb', light='#ffffff', shadow='#dfe2ea', ink='#3a3f55', rim=0.0))
        return dict(kind='flat', roll=-10.0, turn=20.0, tip=16.0)
    if r == 'rare':
        slip = P.slab(P.rrect2(0.74, 1.5, 0.04, 3), 0.04, 0.012, 2, 'slip')
        P.paint(slip, C.over(C.PAPER, sheen=0.0), line=2.2)
        _glyph(-0.04, C.paint('#2f6fd0', light='#5a8fe0', shadow='#2458a8', ink='#14306a', rim=0.0), scale=0.95, r=0.04)
        pin = P.tube([(0, -0.06, 0.62), (0, 0.1, 0.62)], 0.03, 8, name='pin')
        P.paint(pin, C.STEEL, line=1.4)
        head = P.sphere(0.075, 16, 8, 'pinhead')
        P.xf(head, loc=(0, -0.09, 0.62))
        P.paint(head, C.SILVER, line=1.6)
        return dict(kind='flat', roll=8.0, turn=18.0, tip=14.0)
    if r == 'superRare':
        stone = P.lump(0.7, seed=11, amp=0.06, scale=(0.9, 0.42, 1.0))
        P.paint(stone, C.paint('#b197fc', light='#cfbefd', shadow='#8a6ef0', ink='#2c1a6e', rim=0.4), line=2.6)
        _glyph(-0.31, C.paint('#e6f3ff', light='#ffffff', shadow='#b7d4ff', ink='#2c1a6e'), scale=0.85, glow=0.6)
        _cut_front(0.11, (0.0, -0.33, -0.05), C.TIER_GEM['superRare'])
        return dict(kind='flat', roll=-8.0, turn=18.0, tip=14.0)
    if r == 'mythic':
        tab = P.slab(P.rrect2(1.0, 1.3, 0.22, 6), 0.22, 0.08, 3, 'tablet')
        P.paint(tab, C.paint('#8f80f5', light='#b2a7f8', shadow='#6a5ae0', ink='#1d1660', sheen=0.2), line=2.6)
        fr = P.ring_along(P.rrect2(1.0, 1.3, 0.22, 6), 0.06, 10, 'rim', scale_depth=0.8)
        P.xf(fr, loc=(0, -0.08, 0))
        P.paint(fr, C.ROSE_GOLD, line=2.0)
        stars = [(-0.22, 0.35), (0.12, 0.2), (-0.05, -0.08), (0.25, -0.3), (-0.2, -0.38)]
        glowp = C.paint('#fff1b8', light='#ffffff', shadow='#ffd76a', ink='#6e3b08', glow=0.7, rim=0.0)
        for a, b in zip(stars, stars[1:]):
            l = P.tube([(a[0], -0.13, a[1]), (b[0], -0.13, b[1])], 0.014, 6, name='cline')
            P.paint(l, C.over(glowp, base='#d8d2ff', light='#efeaff'), line=0.0)
        for x, z in stars:
            s = P.slab(P.poly_round(P.star2(4, 0.075, 0.03), 0.008, 2), 0.03, 0.01, 1, 'cstar')
            P.xf(s, loc=(x, -0.14, z))
            P.paint(s, glowp, line=1.0)
        return dict(kind='flat', roll=-10.0, turn=18.0, tip=14.0)
    zen = r == 'zenith'
    from models.currency import coin_body
    disc = C.paint('#9b7bff', light='#bba5ff', shadow='#7656e8', ink='#34206e', sheen=0.25) if not zen else ZEN_BODY
    fy = coin_body((0, 0, 0), 1.0, disc, rim_paint=trim(r), sheen=0.25, depth=0.3)
    _glyph(fy - 0.02, trim(r), scale=1.05, r=0.05, line=1.2)
    P.glint((0.0, -0.3, 0.55), 13)
    P.glint((-0.62, -0.25, 0.5), 9)
    return dict(kind='flat', roll=-10.0, turn=22.0, tip=20.0)


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


def cog(r, row):
    if r == 'common':
        _gear(1.0, 8, dict(C.BRASS, base='#dcb183'), bent=True, hole=0.24)
        return dict(kind='flat', roll=-8.0, turn=24.0, tip=24.0)
    if r == 'rare':
        _gear(1.0, 10, dict(C.STEEL, sheen=0.2), hole=0.0)
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
    if r == 'mythic':
        back = P.lathe([(0.0, 0.0), (0.82, 0.0, 'S'), (0.9, 0.08), (0.9, 0.22), (0.82, 0.28, 'S'), (0.0, 0.28)], segs=64, name='housing', axis='Y')
        P.xf(back, loc=(0, 0.1, 0))
        P.paint(back, C.ROSE_GOLD, line=2.6)
        plate = P.slab(P.circle2(0.74, 64), 0.05, 0.02, 2, 'plate')
        P.xf(plate, loc=(0, -0.2, 0))
        P.paint(plate, C.paint('#3d6f8a', light='#4d8aa6', shadow='#2d5670', ink='#0f3044', rim=0.0), line=1.2, lift=0.03)
        sp = P.tube(P.spiral2(0.08, 0.62, 3.0), 0.04, 8, name='mainspring')
        P.xf(sp, loc=(0, -0.25, 0))
        P.paint(sp, C.paint('#8af0ff', light='#d2fbff', shadow='#4cc8e0', ink='#0f4a5c', glow=0.8), line=1.2)
        P.glint((-0.5, -0.4, 0.5), 10)
        return dict(kind='flat', roll=-8.0, turn=22.0, tip=22.0)
    zen = r == 'zenith'
    _gear(1.0, 12, dict(ZEN_BODY) if zen else dict(C.GOLD_TRIM, sheen=0.2), hole=0.0)
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
