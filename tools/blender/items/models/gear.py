"""Gear pieces drawn by gearIcon (gear_<slot>_<rarity>, gear_<slot>_ur): a charm pendant, a ribbon bow and
a loafer. Parametric per slot; the body takes the tier colour, the trim ladder goes on the bezel, the knot
clip or the buckle (C plain, R silver, SR silver + gem, M rose gold + glow, L gold + star, UR iridescent)."""
import math

import parts as P
import palette as C
from models import common as K

BODY = dict(
    common=C.paint('#8e9cb0', light='#b4c0d0', shadow='#6b7894', ink='#3a4560'),
    rare=C.paint('#4b8fea', light='#80b4f2', shadow='#3462c9', ink='#1f3566'),
    superRare=C.paint('#9b6bff', light='#bd9eff', shadow='#7448e0', ink='#34206e'),
    mythic=C.paint('#ff5a7a', light='#ff8ea3', shadow='#d6336c', ink='#6e1a3c'),
    legendary=C.paint('#ffb627', light='#ffd877', shadow='#e0861a', ink='#6e3b08'),
    ur=C.paint('#d7b8ff', light='#f3e8ff', shadow='#9a4fe0', ink='#4a2a6e', iri=0.75),
)
TRIM = dict(common=C.paint('#c7ceda', light='#e6eaf1', shadow='#9aa4b6', ink='#3a4560', spec=0.5, spec_at=0.985),
            rare=C.SILVER, superRare=C.SILVER, mythic=C.ROSE_GOLD, legendary=C.GOLD_TRIM, ur=dict(C.IRI, iri=0.9))
GEM = dict(superRare=C.TIER_GEM['superRare'], mythic=C.TIER_GEM['mythic'], legendary=C.TIER_GEM['legendary'],
           ur=C.paint('#f3e6ff', light='#ffffff', shadow='#c4a8f2', ink='#4a2a6e', deep='#a585e8', iri=0.6, glow=0.4))


def _tier(row):
    return 'ur' if row['key'].endswith('_ur') else row['rarity']


def charm(t):
    body, trim = BODY[t], TRIM[t]
    out = P.poly_round([(0, -0.78), (0.52, 0.0), (0, 0.62), (-0.52, 0.0)], 0.12, 4)
    bez = P.slab(P.offset_outline(out, 0.08), 0.24, 0.08, 3, 'bezel')
    P.xf(bez, loc=(0, 0.03, 0))
    P.paint(bez, trim, line=2.6)
    g = P.fan_gem(out, 0.14, 0.24, ridges=[(0.0, -0.3, 0.17), (0.26, 0.0, 0.17), (0.0, 0.3, 0.17), (-0.26, 0.0, 0.17)], name='charm')
    P.xf(g, loc=(0, -0.08, 0))
    P.paint(g, dict(body, steps=(0.45, 0.86, 0.02), deep_at=0.0, glow=0.3 if t in ('mythic', 'legendary', 'ur') else 0.0), line=1.8)
    bail = P.torus(0.1, 0.035, 24, 8, 'bail')
    P.xf(bail, rot=(0, 90, 0), loc=(0, 0.0, 0.78))
    P.paint(bail, trim, line=1.6)
    for i in range(3):
        ln = P.torus(0.08, 0.026, 20, 8, 'link')
        P.xf(ln, scale=(1, 1, 1.4), rot=(90 if i % 2 == 0 else 0, 0, 90 * (i % 2)), loc=(0, 0, 0.95 + i * 0.17))
        P.paint(ln, trim, line=1.3)
    if t in GEM:
        P.glint((-0.05, -0.35, 0.05), 12 if t in ('legendary', 'ur') else 9)
    return dict(kind='flat', roll=-14.0, turn=14.0, tip=10.0)


def _loop(side, body):
    pts = P.poly_round([(0.0, 0.0), (side * 0.85, 0.42), (side * 0.95, 0.0), (side * 0.85, -0.38)], 0.16, 5)
    o = P.slab(pts, 0.32, 0.13, 4, 'loop')
    P.xf(o, rot=(0, side * -6, 0), loc=(side * 0.06, 0.02, 0.05))
    return P.paint(o, dict(body, sheen=0.3), line=2.6)


def ribbon(t):
    body, trim = BODY[t], TRIM[t]
    for side in (-1, 1):
        K.ribbon_tail(side * 0.18, -0.12, 0.8, 0.3, 0.06, dict(body), notch=0.45, rot=side * -20, line=2.4)
    for side in (-1, 1):
        _loop(side, body)
        fold = P.tube([(side * 0.18, -0.16, 0.05), (side * 0.58, -0.12, 0.05)], 0.035, 8, name='fold')
        P.paint(fold, C.over(body, base=body['shadow'], light=body['shadow']), line=0.0)
    knot = P.rbox(0.36, 0.38, 0.44, r=0.14, seg=4, name='knot')
    P.xf(knot, loc=(0, -0.04, 0.05))
    P.paint(knot, trim if t != 'common' else C.over(body, base=body['light'], light='#ffffff'), line=2.2)
    if t in GEM:
        g = P.cabochon(0.1, 0.07)
        P.xf(g, rot=(90, 0, 0), loc=(0, -0.24, 0.05))
        P.paint(g, GEM[t], line=1.1)
        P.glint((-0.02, -0.33, 0.1), 11 if t in ('legendary', 'ur') else 8)
    return dict(kind='flat', roll=-8.0, turn=14.0, tip=14.0)


def _shoe_outline(L=1.2, n=72):
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        x = L / 2 * math.cos(a)
        w = 0.22 + 0.035 * (-x / (L / 2))          # a little wider at the toe (-x)
        y = w * math.sin(a)
        pts.append((x, y))
    return pts


def shoes(t):
    body, trim = BODY[t], TRIM[t]
    out = _shoe_outline()
    sole = P.slab(out, 0.14, 0.05, 3, 'sole')
    P.xf(sole, rot=(-90, 0, 0), loc=(0, 0, 0.07))
    P.paint(sole, C.paint('#fbfcff', light='#ffffff', shadow='#d6deea', ink=body['ink'], rim=0.0), line=2.4)
    upper = P.slab(P.offset_outline(out, -0.025), 0.42, 0.19, 5, 'upper')
    P.xf(upper, rot=(-90, 0, 0), loc=(0, 0, 0.13 + 0.21))
    for v in upper.data.vertices:               # lower the toe so the shoe slopes down to the front
        if v.co.x < 0:
            v.co.z = 0.13 + (v.co.z - 0.13) * (1 - 0.42 * (-v.co.x / 0.6) ** 1.5)
    upper.data.update()
    P.paint(upper, dict(body, sheen=0.25), line=2.6)
    lining = P.slab(P.circle2(0.27, 40, rz=0.165), 0.04, 0.014, 2, 'lining')
    P.xf(lining, rot=(-90, 0, 0), loc=(0.24, 0, 0.555))
    P.paint(lining, C.paint('#fff6ea', light='#ffffff', shadow='#ead9c2', ink=body['ink'], rim=0.0), line=1.6)
    hole = P.slab(P.circle2(0.2, 40, rz=0.11), 0.03, 0.01, 2, 'opening')
    P.xf(hole, rot=(-90, 0, 0), loc=(0.26, 0.01, 0.57))
    P.paint(hole, C.over(body, base=C.tone(body['shadow'])['shadow'], light=body['shadow'], shadow=C.tone(body['shadow'])['shadow']),
            line=0.0)
    sx = -0.14
    path = P.smooth_path([(sx, -0.25, 0.22), (sx, -0.2, 0.47), (sx, 0.0, 0.565), (sx, 0.2, 0.47), (sx, 0.25, 0.22)], 24)
    strap = P.sweep(path, P.rrect2(0.03, 0.14, 0.012, 2), up=(1, 0, 0), name='strap')
    P.paint(strap, C.over(body, base=body['shadow'], light=body['base']), line=1.6)
    buckle = P.rbox(0.18, 0.12, 0.05, r=0.02, seg=2, name='buckle')
    P.xf(buckle, loc=(sx, -0.0, 0.585))
    P.paint(buckle, trim, line=1.4)
    if t in GEM:
        g = P.cabochon(0.045, 0.03)
        P.xf(g, loc=(sx, 0.0, 0.605))
        P.paint(g, GEM[t], line=0.9)
    if t in ('superRare', 'mythic', 'legendary', 'ur'):
        white = C.paint('#ffffff', light='#ffffff', shadow='#dfe6f2', ink=body['ink'], rim=0.2)
        for k, (ang, ln) in enumerate(((34, 0.42), (58, 0.36), (82, 0.28))):    # three feathers fanned back and up
            f = P.slab(P.leaf2(0.13, ln, 30, tip_sharp=1.2), 0.04, 0.016, 2, 'wingfeather')
            P.xf(f, rot=(0, ang, 0), loc=(0.3, -0.25 - 0.012 * k, 0.33))
            P.paint(f, white, line=1.5)
    if t in ('legendary', 'ur'):
        P.glint((-0.4, -0.2, 0.4), 11)
    return dict(kind='standing', yaw=-38.0, elev=30.0)


def build(row):
    slot = row['family']
    t = _tier(row)
    return dict(charm=charm, ribbon=ribbon, shoes=shoes)[slot](t)
