"""Gear tools (category dice): Fortune Dice, Lock Pin, Prism Dice, Rainbow Seed, Starlight Needle,
Club Armband."""
import math

from mathutils import Vector

import parts as P
import palette as C

THREAD = C.paint('#f78fb3', light='#fbbdd3', shadow='#e0608f', ink='#781948', rim=0.4)


def star4_gem(R, r, at, paint, rot=0.0, depth=0.16, rise=0.22, line=2.4, points=4):
    pts = P.star2(points, R, r, a0=90)
    pts = P.poly_round(pts, R * 0.04, 2)
    g = P.fan_gem(pts, depth * R, rise * R, name='star')
    P.xf(g, rot=(0, rot, 0), loc=at)
    q = dict(paint)
    q.setdefault('steps', (0.0, 0.8, 0.02))
    q.setdefault('deep_at', -0.4)
    return P.paint(g, q, line=line)


def needle_star():
    # steel needle passing behind the star, eye at the upper right; pink thread through the eye
    a = Vector((-1.15, 0.12, -0.62))
    b = Vector((1.05, 0.12, 0.62))
    d = (b - a).normalized()
    shaft = P.tube([a + d * 0.12, b], 0.045, 10, name='needle')
    P.paint(shaft, C.STEEL, line=1.8)
    tip = P.lathe([(0.045, 0.0), (0.0, 0.16)], segs=10, name='tip')
    ang = math.degrees(math.atan2(-d.x, -d.z))
    P.xf(tip, rot=(0, ang, 0), loc=a + d * 0.12)
    P.paint(tip, C.STEEL, line=1.8)
    eye = P.torus(0.06, 0.03, 24, 8, 'eye')
    P.xf(eye, scale=(1.0, 2.0, 1.0), rot=(90, 0, 0))
    P.xf(eye, rot=(0, math.degrees(math.atan2(d.x, d.z)) - 90, 0), loc=b + d * 0.02)
    P.paint(eye, C.STEEL, line=1.6)
    gold = C.paint('#fcd34d', light='#fee99a', shadow='#eaa520', ink='#7d4705', deep='#d08a10')
    # four bevelled arms: a central ridge on each, so every arm shows a lit and a shadowed facet (approved)
    star4_gem(0.98, 0.36, (0.0, 0.0, 0.0), dict(gold, steps=(0.45, 0.86, 0.02), deep_at=-0.5), rot=8, line=2.6, rise=0.34)
    pts = [b + Vector((0.0, -0.05, 0.0)), Vector((1.25, -0.2, 0.9)), Vector((1.0, -0.2, 0.25)), Vector((0.35, -0.2, -0.2)),
           Vector((0.15, -0.25, -0.75)), Vector((0.4, -0.25, -1.1))]
    th = P.tube(P.smooth_path(pts, 40), 0.04, 8, name='thread')
    P.paint(th, THREAD, line=1.6)
    P.glint((0.13, -0.25, 0.94), 13)
    return dict(kind='flat', roll=0.0, turn=12.0, tip=12.0)


def _pip(at, normal_rot, r, paint, line=0.0):
    d = P.cabochon(r, r * 0.35, n=20)
    P.xf(d, rot=normal_rot, loc=at)
    return P.paint(d, paint, line=line)


def dice_reroll():
    """Rounded die (about 12% corner radius), light blue, white pips, a sakura on the top face, silver rims."""
    blue = C.paint('#8ec5ff', light='#c2e0ff', shadow='#5d98e6', ink='#1d3a6b', sheen=0.2)
    s = 1.0
    d = P.rbox(s, s, s, r=0.14, seg=5, name='die')
    P.xf(d, loc=(0, 0, s / 2))
    P.paint(d, blue, line=2.6)
    white = C.paint('#ffffff', light='#ffffff', shadow='#dce8f7', ink='#1d3a6b', rim=0.0)
    h = s / 2 + 0.005
    # front face (-Y): three pips on a diagonal
    for u in (-0.26, 0.0, 0.26):
        _pip((u, -h, s / 2 - u), (90, 0, 0), 0.085, white)
    # right face (+X): two pips
    for u in (-0.22, 0.22):
        _pip((h, u, s / 2 + u), (0, 90, 0), 0.085, white)
    # top face: a sakura blossom
    b = P.slab(P.blossom2(0.3, inner=0.42, notch=0.17), 0.04, 0.015, 2, 'topbloom')
    P.xf(b, rot=(-90, 0, 0), loc=(0, 0, s + 0.012))
    P.paint(b, C.paint('#ffb3cf', light='#ffd8e6', shadow='#f285b0', ink='#781948'), line=1.3, lift=0.0)
    P.glint((-0.42, -0.5, s + 0.05), 11)
    return dict(kind='standing', yaw=30, elev=26, roll=-8)


def lock_pin():
    """Round-headed pink pin through a small silver padlock with a violet-gem keyhole."""
    body = P.rbox(0.9, 0.36, 0.72, r=0.14, seg=4, name='lock')
    P.xf(body, loc=(0, 0, 0))
    P.paint(body, dict(C.SILVER, sheen=0.25), line=2.6)
    shackle = P.sweep(P.smooth_path([(-0.28, 0, 0.3), (-0.3, 0, 0.62), (0.0, 0, 0.82), (0.3, 0, 0.62), (0.28, 0, 0.3)], 30),
                      P.circle2(0.075, 12), name='shackle')
    P.paint(shackle, C.STEEL, line=2.2)
    g = P.cabochon(0.13, 0.07)
    P.xf(g, rot=(90, 0, 0), loc=(0, -0.19, 0.04))
    P.paint(g, C.TIER_GEM['superRare'], line=1.3, spec=1.0, spec_at=0.985)
    key = P.slab(P.rrect2(0.07, 0.16, 0.03, 3), 0.02, 0.008, 1, 'keyhole')
    P.xf(key, loc=(0, -0.26, -0.03))
    P.paint(key, C.paint('#5a3aa8', light='#7a5ad0', shadow='#40248a', ink='#26136e'), line=0.0)
    pin = P.tube([(-0.95, -0.25, -0.55), (0.75, -0.25, 0.62)], 0.045, 10, name='pin')
    P.paint(pin, C.STEEL, line=1.8)
    tip = P.lathe([(0.045, 0.0), (0.0, 0.16)], segs=10, name='pintip')
    d = (0.75 + 0.95, 0.62 + 0.55)
    ang = math.degrees(math.atan2(d[0], d[1]))
    P.xf(tip, rot=(0, ang, 0), loc=(0.75, -0.25, 0.62))
    P.paint(tip, C.STEEL, line=1.6)
    head = P.sphere(0.24, 32, 16, 'pinhead')
    P.xf(head, loc=(-0.98, -0.25, -0.57))
    P.paint(head, C.paint('#ff7ad9', light='#ffb0ea', shadow='#e04cb8', ink='#6e1a5c', spec=1.0, spec_at=0.975), line=2.4)
    P.glint((-1.06, -0.45, -0.45), 9)
    return dict(kind='flat', roll=0.0, turn=18.0, tip=14.0)


def dice_prism():
    """Chunky rounded d8 die in pastel iridescence, tilted like Fortune Dice, embossed rose-gold pips on
    its faces (one to three, like a die: never a number) and an inner glow."""
    import rig
    pr = C.anchored(C.paint('#f2d6ff', light='#fff4ff', ink='#3f2470', iri=0.5, glow=0.25, sheen=0.15),
                    shadow='#b48fec', deep='#9670e0', anchor=0.75)
    pts = [(0, 0, 1.0), (0, 0, -1.0), (0.78, 0, 0), (-0.78, 0, 0), (0, 0.78, 0), (0, -0.78, 0)]
    pts = [(x * 0.7071 - y * 0.7071, x * 0.7071 + y * 0.7071, z) for x, y, z in pts]     # an edge faces the viewer
    d = P.hull(pts, bevel=0.07, seg=3, name='d8')
    P.paint(d, dict(pr, steps=(0.2, 0.82, 0.03), deep_at=-0.4), line=2.6)
    pose = rig.pose_matrix('standing', yaw=26, elev=24, roll=-10)
    view = (pose.to_3x3().transposed() @ rig.VIEW.copy()).normalized()      # toward the camera, in model space
    faces = []
    for p in d.data.polygons:
        n = p.normal.copy()
        if p.area > 0.2 and n.dot(view) > 0.3:
            faces.append((n.dot(view), p.center.copy(), n))
    faces.sort(key=lambda f: -f[0])
    rose = C.over(C.ROSE_GOLD, base='#eba08f', light='#ffd0c2', shadow='#c97666', spec=0.6)
    z_up = Vector((0.0, 0.0, 1.0))
    for k, (_, c, n) in enumerate(faces[:3]):
        count = (1, 2, 3)[k]
        # pips laid out in the face plane, "up" toward its apex
        up = (z_up - n * z_up.dot(n)).normalized()
        side = n.cross(up).normalized()
        offs = {1: [(0, 0)], 2: [(-0.16, -0.1), (0.16, 0.1)], 3: [(-0.2, -0.14), (0, 0), (0.2, 0.14)]}[count]
        for sx, sz in offs:
            pip = P.cabochon(0.075, 0.035, n=20)
            P.xf(pip, rot=(90, 0, 0))                      # cabochon dome toward -Y
            at = c + side * sx + up * (sz - 0.05) + n * 0.005
            P.face_to(pip, n, at)
            P.paint(pip, rose, line=1.0)
    P.glint((-0.3, -0.6, 0.45), 11)
    return dict(kind='standing', yaw=26, elev=24, roll=-10)


def seed_rainbow():
    """Iridescent seed with a green leaf sprout and prism glints."""
    seed = P.sphere(0.6, 48, 24, 'seed', scale=(0.82, 0.7, 1.0))
    P.xf(seed, loc=(0, 0, 0))
    P.paint(seed, dict(C.IRI, base='#f3e3ff', shadow='#b49ae8', spec=1.0, spec_at=0.975, glow=0.2), line=2.6)
    stem = P.tube(P.smooth_path([(0.0, 0.0, 0.5), (0.04, 0.0, 0.75), (0.1, 0.0, 0.95)], 10), 0.05, 8, name='stem')
    green = C.paint('#7fd65f', light='#b2ec8f', shadow='#4ea93f', ink='#1f5a1a')
    P.paint(stem, green, line=1.8)
    for sx, rot in ((1, -50), (-1, 45)):
        leaf = P.slab(P.leaf2(0.32, 0.62), 0.05, 0.02, 2, 'leaf')
        P.xf(leaf, rot=(0, rot, 0), loc=(0.1, -0.02, 0.92))
        P.paint(leaf, green, line=1.8)
    P.glint((-0.25, -0.5, 0.25), 12)
    P.glint((0.3, -0.5, -0.35), 8)
    return dict(kind='flat', roll=-10.0, turn=14.0, tip=10.0)


def club_band():
    """Pink cloth armband loop with a rose-gold star badge."""
    pink = C.paint('#ff8fab', light='#ffb8c8', shadow='#e0567a', ink='#7a1f3a', sheen=0.15, rim=0.4)
    path = [(0.82 * math.cos(2 * math.pi * i / 64), 0.82 * math.sin(2 * math.pi * i / 64) * 0.62, 0.0) for i in range(64)]
    band = P.sweep(path, P.rrect2(0.08, 0.5, 0.035, 3), closed=True, up=(0, 0, 1), name='armband')
    P.paint(band, pink, line=2.6)
    for z in (-0.17, 0.17):
        st = P.torus(0.84, 0.012, 64, 6, 'stitch')
        P.xf(st, scale=(1, 0.62, 1), loc=(0, 0, z))
        P.paint(st, C.over(pink, base='#ffd0dc', light='#ffe6ee'), line=0.0)
    badge = P.slab(P.poly_round(P.star2(5, 0.34, 0.17), 0.05, 3), 0.1, 0.04, 3, 'badge')
    P.xf(badge, loc=(0.0, -0.56, 0.0))
    P.paint(badge, C.over(C.ROSE_GOLD, sheen=0.2), line=2.0)
    P.glint((-0.2, -0.75, 0.25), 11)
    return dict(kind='standing', yaw=10, elev=34, roll=-10)


def build(row):
    k = row['key']
    table = dict(needle_star=needle_star, dice_reroll=dice_reroll, lock_pin=lock_pin, dice_prism=dice_prism,
                 seed_rainbow=seed_rainbow, club_band=club_band)
    return table[k]()
