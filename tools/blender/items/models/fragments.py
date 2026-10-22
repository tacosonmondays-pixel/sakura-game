"""Awakening fragments: Star Fragment and the Kindred Essence drops (one teardrop model, recoloured by
tier; colour and the tile carry the tier, so the old R / SR / SSR text labels are gone)."""
import math

import parts as P
import palette as C
from models import common as K

FACETS = dict(steps=(0.45, 0.86, 0.02), deep_at=0.0)


def star_crystal(R, at, paint, rot=0.0, points=5, inner=0.5, depth=0.32, rise=0.42, line=2.6):
    pts = P.star2(points, R, R * inner, a0=90)
    rid = []
    for i in range(points):
        a = math.radians(90 + 360 * i / points)
        rid.append((R * 0.55 * math.cos(a), R * 0.55 * math.sin(a), R * rise * 0.7))
    g = P.fan_gem(P.poly_round(pts, R * 0.05, 2), depth * R, rise * R, ridges=rid, name='starc')
    P.xf(g, rot=(0, rot, 0), loc=at)
    q = dict(paint)
    for k, v in FACETS.items():
        q.setdefault(k, v)
    return P.paint(g, q, line=line)


def star_fragment():
    pastel = C.paint('#ffd0ea', light='#fff0f8', shadow='#d9a2f5', ink='#5a2a8a', deep='#b98af2', iri=0.15)
    star_crystal(1.0, (0, 0, 0), pastel, rot=-8)
    spl = P.fan_gem([(-0.12, -0.2), (0.14, -0.16), (0.18, 0.2), (0.0, 0.3), (-0.16, 0.12)], 0.12, 0.12, name='splinter')
    P.xf(spl, rot=(0, -30, 0), loc=(0.88, 0.1, -0.72))
    P.paint(spl, dict(pastel, **FACETS), line=2.0)
    P.glint((-0.25, -0.5, 0.55), 12)
    return dict(kind='flat', roll=-6.0, turn=18.0, tip=18.0)


def teardrop(body, cap_p, gem_p=None, star=False, blossom_p=None):
    """Glass drop (ITEM_STYLE 2.7): smooth, darker toward the top rim, light pooling at the bottom, a
    crescent highlight at the upper left, a blossom held inside."""
    prof = [(0.0, -0.95)]
    for i in range(1, 16):
        a = -math.pi / 2 + math.pi * 0.62 * i / 15
        prof.append((0.62 * math.cos(a), -0.38 + 0.6 * math.sin(a)))
    prof += [(0.42, 0.36), (0.3, 0.5), (0.2, 0.62)]
    prof.append((0.0, 0.7))
    t = P.lathe(prof, segs=48, name='tear', smooth=True)
    # the printed stripe trick: one broad band crest at the top darkens the upper rim toward the shadow tone
    P.paint(t, dict(body, steps=(0.05, 0.8, 0.06)), line=2.6, spec=0.0, rim=0.8, stripe=(0.6, 0.42, 0.3),
            stripe_dir=(0, 0, 1))
    # light pooled at the bottom: a light-tone crescent on the lower right inner rim, no line
    pool = P.slab(P.poly_round(P.crescent2(0.42, cut=0.86, shift=0.22), 0.02, 2), 0.02, 0.006, 1, 'pool')
    P.xf(pool, rot=(0, -125, 0), loc=(0.02, -0.58, -0.34))
    P.paint(pool, dict(base=body['light'], light=body['light'], shadow=body['light'], deep=body['light'], ink=body['ink'],
                       rim=0.0, drift=0.0), line=0.0)
    # crescent highlight at 10-11 o'clock
    cres = P.slab(P.poly_round(P.crescent2(0.34, cut=0.92, shift=0.16), 0.008, 2), 0.02, 0.006, 1, 'crescent')
    P.xf(cres, rot=(0, 45, 0), loc=(-0.2, -0.53, -0.2))
    P.paint(cres, dict(base='#ffffff', light='#ffffff', shadow='#ffffff', ink=body['ink'], rim=0.0, drift=0.0), line=0.0)
    K.blossom(0.24, 0.04, (0.0, -0.6, -0.3), blossom_p or C.paint('#ffffff', light='#ffffff', shadow='#e6eef8', ink=body['ink']),
              line=1.1, pearl=C.paint('#fff1c7', light='#ffffff', shadow='#f4cf7a', ink='#7d4705'), pearl_r=0.25)
    cap = P.lathe([(0.0, 0.5), (0.3, 0.52, 'S'), (0.32, 0.62), (0.26, 0.74), (0.0, 0.82)], segs=32, name='cap')
    P.paint(cap, cap_p, line=2.0)
    ring = P.torus(0.1, 0.035, 24, 8, 'loop')
    P.xf(ring, rot=(90, 0, 0), loc=(0, 0, 0.92))
    P.paint(ring, cap_p, line=1.6)
    if gem_p:
        g = P.cabochon(0.08, 0.05)
        P.xf(g, rot=(90, 0, 0), loc=(0, -0.3, 0.64))
        P.paint(g, gem_p, line=1.0)
    if star:
        P.glint((0.0, -0.7, -0.3), 14)
    P.glint((-0.3, -0.5, 0.2), 9)
    return dict(kind='flat', roll=-14.0, turn=14.0, tip=10.0)


def kindred_shard():
    """A warm-gold crystal shard (a hexagonal prism with a cut tip and a broken base) and a chip: clear
    facet planes with a bright facet edge, a blossom glowing inside, so it reads as crystal, not a blade."""
    gold = C.paint('#ffc93c', light='#fff0a8', shadow='#f09a1e', ink='#6a3404', deep='#d97a10', spec=0.6, spec_at=0.99)
    crys = P.crystal(0.44, 0.92, 0.42, sides=6, a0=0.3, taper=0.86, base=0.22)
    P.xf(crys, rot=(0, 18, 0), loc=(-0.05, 0.0, -0.62))
    P.paint(crys, dict(gold, steps=(0.12, 0.66, 0.02), deep_at=-0.4), line=2.6, smooth=False)
    K.blossom(0.15, 0.03, (-0.02, -0.36, -0.02), C.paint('#fff6d8', light='#ffffff', shadow='#ffe08a', ink='#6a3404', glow=0.5),
              rot=18, line=1.0)
    chip = P.crystal(0.15, 0.3, 0.16, sides=5, a0=0.2, taper=0.8)
    P.xf(chip, rot=(0, -34, 0), loc=(0.6, 0.05, -0.62))
    P.paint(chip, dict(gold, steps=(0.12, 0.66, 0.02), deep_at=-0.4), line=2.0, smooth=False)
    P.glint((-0.2, -0.45, 0.55), 11)
    return dict(kind='standing', yaw=18, elev=14, roll=-14)


def build(row):
    k = row['key']
    if k == 'star_fragment':
        return star_fragment()
    if k == 'kindred_r':
        return teardrop(C.paint('#9be7ff', light='#dbf7ff', shadow='#5cbfee', ink='#1b4f7a', deep='#3f9ed8'), C.SILVER)
    if k == 'kindred_sr':
        return teardrop(C.paint('#d7b4ff', light='#f1e4ff', shadow='#ab80f2', ink='#4a2a8a', deep='#8d5fe4'), C.SILVER,
                        gem_p=C.TIER_GEM['superRare'])
    if k == 'kindred_ssr':
        return teardrop(C.paint('#ffd257', light='#fff1b0', shadow='#f2a72c', ink='#6a3807', deep='#de8c1c'), C.GOLD_TRIM,
                        gem_p=C.TIER_GEM['legendary'], star=True,
                        blossom_p=C.paint('#fffaf0', light='#ffffff', shadow='#ffe3a8', ink='#6a3807'))
    if k == 'kindred_shard_ssr':
        return kindred_shard()
    raise KeyError(k)
