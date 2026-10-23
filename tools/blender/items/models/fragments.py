"""Awakening fragments: Star Fragment and the Kindred Essence drops (one teardrop model, recoloured by
tier; colour and the tile carry the tier, so the old R / SR / SSR text labels are gone)."""
import math

from mathutils import Vector

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
    P.glint((0.08, -0.3, 1.02), 11, edge=True)             # the approved sparkle, on the tip of the top arm
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
    """Kindred Shard (mythic in the game data): a warm-gold crystal shard (a hexagonal prism with a cut tip,
    the Kindred SSR gold) held in a rose-gold collar (the mythic accent), a chip beside it, and an embossed
    pink sakura framed by a raised gold rim on its front facet (no flat white cut-out)."""
    gold = C.paint('#ffc93c', light='#fff0a8', shadow='#f09a1e', ink='#6a3404', deep='#d97a10', spec=0.6, spec_at=0.99)
    crys = P.crystal(0.44, 0.92, 0.42, sides=6, a0=0.3, taper=0.86, base=0.22)
    P.xf(crys, rot=(0, 18, 0), loc=(-0.05, 0.0, -0.62))
    P.paint(crys, dict(gold, steps=(0.12, 0.66, 0.02), deep_at=-0.4), line=2.6, smooth=False)
    tree = P.bvh(crys)
    # the rose-gold collar round the shard's foot (rays cast in from outside at its height)
    path = []
    for i in range(48):
        a = 2 * math.pi * i / 48
        d = Vector((math.cos(a), math.sin(a), 0.0))
        loc, _ = P.hit(tree, d * 3.0 + Vector((-0.05, 0.0, -0.5)), -d)
        if loc is not None:
            path.append(Vector((loc.x, loc.y, -0.5)) + d * 0.035)
    if len(path) > 8:
        col = P.sweep(path, P.rrect2(0.06, 0.16, 0.025, 3), closed=True, up=(0, 0, 1), name='collar')
        P.paint(col, C.ROSE_GOLD, line=1.8)
    # the sakura on the facet that faces the viewer: a raised gold rim, a pink blossom embossed in it, a pearl
    import rig
    pose = rig.pose_matrix('standing', yaw=18, elev=14, roll=-14)
    view = (pose.to_3x3().transposed() @ rig.VIEW.copy()).normalized()
    best = max((p for p in crys.data.polygons if abs(p.normal.z) < 0.5), key=lambda p: p.normal.dot(view) * p.area)
    nrm = best.normal.copy()
    loc = best.center.copy() + Vector((0.0, 0.0, 0.06))
    rim_ = P.slab(P.blossom2(0.2, inner=0.42, notch=0.17), 0.03, 0.012, 2, 'bloomrim')
    P.face_to(rim_, nrm, loc + nrm * 0.012)
    P.paint(rim_, C.GOLD_TRIM, line=1.2, lift=0.02)
    bl = P.slab(P.blossom2(0.155, inner=0.42, notch=0.17), 0.03, 0.012, 2, 'bloom')
    P.face_to(bl, nrm, loc + nrm * 0.03)
    P.paint(bl, C.paint('#ffb8d2', light='#ffe0ec', shadow='#f287b2', ink='#781948', glow=0.25), line=1.0, lift=0.02)
    pearl = P.sphere(0.04, 16, 8, 'pearl', scale=(1, 0.6, 1))
    P.face_to(pearl, nrm, loc + nrm * 0.05)
    P.paint(pearl, C.paint('#fff1c7', light='#ffffff', shadow='#f4cf7a', ink='#7d4705'), line=0.0)
    chip = P.crystal(0.15, 0.3, 0.16, sides=5, a0=0.2, taper=0.8)
    P.xf(chip, rot=(0, -34, 0), loc=(0.6, 0.05, -0.62))
    P.paint(chip, dict(gold, steps=(0.12, 0.66, 0.02), deep_at=-0.4), line=2.0, smooth=False)
    P.glint((-0.36, -0.4, 0.5), 11, edge=True)               # on the lit edge of the shard
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
