"""Gear pieces drawn by gearIcon (gear_<slot>_<rarity>, gear_<slot>_ur): a charm pendant, a ribbon bow and
a chunky sneaker. Parametric per slot; the body takes the tier colour, the trim ladder goes on the bezel, the
knot clip or the sneaker's heel counter (C plain, R silver, SR silver + gem, M rose gold + glow, L gold + star,
UR iridescent with a saturated shadow); shoes get wings from SR up."""
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
    ur=C.paint('#cfacfc', light='#f3e8ff', shadow='#9a5ce2', ink='#3f2266', deep='#7a3fd0', iri=0.7, anchor=0.75,
               base_anchor=0.5),
)
TRIM = dict(common=C.paint('#c7ceda', light='#e6eaf1', shadow='#9aa4b6', ink='#3a4560', spec=0.5, spec_at=0.985),
            rare=C.SILVER, superRare=C.SILVER, mythic=C.ROSE_GOLD, legendary=C.GOLD_TRIM, ur=dict(C.IRI_DEEP, iri=0.9))
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


# Sneaker: length along X (toe at -X), width along Y (the outer side faces the viewer, -Y), up Z.
SHOE_L = 1.5
SOLE_H = 0.15


def _shoe_t(x):
    return (x + SHOE_L / 2) / SHOE_L


def _shoe_spring(x):
    """Toe spring: the sole lifts toward the toe."""
    k = max(0.0, (-0.22 - x) / (SHOE_L / 2 - 0.22))
    return 0.15 * k * k


def _shoe_w(t):
    """Half width along the foot (wide at the ball, narrower at the heel), rounded at both ends."""
    w = 0.25 + 0.05 * math.sin(math.pi * min(1.0, t * 1.5)) - 0.03 * t
    end = (1 - abs(2 * t - 1) ** 4) ** 0.35
    return w * max(0.06, end)


def _shoe_h(t):
    """Upper height: a low round toe box, a rising instep, a high padded collar at the heel."""
    if t < 0.28:
        h = 0.25 + 0.03 * t / 0.28
    elif t < 0.62:
        u = (t - 0.28) / 0.34
        h = 0.28 + 0.24 * (3 * u * u - 2 * u ** 3)
    else:
        h = 0.52
    end = (1 - abs(2 * t - 1) ** 6) ** 0.3
    return h * max(0.15, end)


def _arch(n=24, p=3.0):
    """Upper cross-section: flat bottom, rounded sides and top (superellipse), u in -1..1, v in 0..1."""
    pts = []
    for i in range(n + 1):
        a = math.pi * i / n
        c, s = math.cos(a), math.sin(a)
        pts.append((math.copysign(abs(c) ** (2 / p), c), abs(s) ** (2 / p)))
    pts += [(-0.5, 0.0), (0.0, 0.0), (0.5, 0.0)]
    return pts


def _arch_v(u, p=3.0):
    return max(0.0, 1 - abs(u) ** p) ** (1 / p)


def _shoe_piece(t0, t1, prof, sw, sh, z0=0.0, n=40, name='shoepiece', vscale=1.0):
    xs = [-SHOE_L / 2 + SHOE_L * (t0 + (t1 - t0) * i / (n - 1)) for i in range(n)]
    path = [(x, 0.0, z0 + _shoe_spring(x)) for x in xs]
    scales = [(sw(_shoe_t(x)), sh(_shoe_t(x)) * vscale) for x in xs]
    # the sweep frame: u along -Y (bn = +X x +Z), v along +Z
    return P.sweep(path, prof, scales=scales, up=(0, 0, 1), name=name)


def shoes(t):
    body, trim = BODY[t], TRIM[t]
    white = C.paint('#fbfcff', light='#ffffff', shadow='#d3dcea', ink=body['ink'], rim=0.0)
    sole = _shoe_piece(0.0, 1.0, P.rrect2(2.0, 1.0, 0.38, 4, cz=0.5), lambda u: _shoe_w(u) * 1.08 + 0.012,
                       lambda u: SOLE_H, name='sole')
    P.paint(sole, white, line=2.4)
    upper = _shoe_piece(0.015, 0.99, _arch(), _shoe_w, _shoe_h, z0=SOLE_H - 0.01, name='upper')
    P.paint(upper, dict(body, sheen=0.2), line=2.6)
    cap = _shoe_piece(0.0, 0.25, _arch(), lambda u: _shoe_w(u) * 1.045 + 0.006, lambda u: _shoe_h(u) * 1.06 + 0.012,
                      z0=SOLE_H - 0.02, n=16, name='toecap')
    P.paint(cap, white, line=2.0)
    heel_p = trim if t != 'common' else C.over(body, base=body['light'], light='#ffffff', shadow=body['base'])
    heel = _shoe_piece(0.8, 1.0, _arch(), lambda u: _shoe_w(u) * 1.05 + 0.008, lambda u: _shoe_h(u) * 0.55,
                       z0=SOLE_H - 0.02, n=14, name='heelcounter')
    P.paint(heel, heel_p, line=1.8)
    # the throat: a padded collar round a dark opening at the heel, the tongue standing up in front of it
    top = SOLE_H - 0.01 + _shoe_h(0.78)
    ox, orx = -SHOE_L / 2 + SHOE_L * 0.79, 0.19
    ory = _shoe_w(0.79) * 0.66
    hole = P.slab(P.circle2(orx, 40, rz=ory), 0.04, 0.012, 2, 'opening')
    P.xf(hole, rot=(-90, 0, 0), loc=(ox, 0, top - 0.005))
    dark = C.tone(body['shadow'])['shadow']
    P.paint(hole, C.over(body, base=dark, light=body['shadow'], shadow=dark), line=0.0)
    collar = P.torus(1.0, 0.06, 48, 10, 'collar')
    P.xf(collar, scale=(orx + 0.035, ory + 0.035, 1.0), loc=(ox, 0, top + 0.01))
    P.paint(collar, C.over(body, sheen=0.0), line=1.8)
    tongue = P.rbox(0.07, ory * 1.5, 0.3, r=0.034, seg=3, name='tongue')
    P.xf(tongue, rot=(0, -28, 0), loc=(ox - orx - 0.02, 0, top + 0.06))
    P.paint(tongue, C.over(body, base=body['light'], light='#ffffff', shadow=body['base']), line=1.8)
    # three fat laces across the instep
    for lx in (-0.3, -0.16, -0.02):
        tt = _shoe_t(lx)
        z0 = SOLE_H - 0.01 + _shoe_spring(lx)
        w, h = _shoe_w(tt), _shoe_h(tt)
        path = [(lx + 0.015 * (1 - abs(u)), -u * w * 1.02, z0 + h * _arch_v(u) * 1.02 + 0.012)
                for u in [-0.62 + 1.24 * i / 10 for i in range(11)]]
        lace = P.tube(path, 0.034, 8, name='lace')
        P.paint(lace, white, line=1.3)
    if t in GEM:
        tt = 0.9
        g = P.cabochon(0.055, 0.035)
        P.xf(g, rot=(90, 0, 0), loc=(-SHOE_L / 2 + SHOE_L * tt, -_shoe_w(tt) * 1.05 - 0.03, SOLE_H + _shoe_h(tt) * 0.3))
        P.paint(g, GEM[t], line=1.0)
    if t in ('superRare', 'mythic', 'legendary', 'ur'):
        wing = C.paint('#ffffff', light='#ffffff', shadow='#dfe6f2', ink=body['ink'], rim=0.2)
        wx = -SHOE_L / 2 + SHOE_L * 0.72
        wy = -_shoe_w(0.72) - 0.05
        for k, (ang, ln) in enumerate(((30, 0.44), (54, 0.38), (78, 0.3))):    # three feathers fanned back and up
            f = P.slab(P.leaf2(0.14, ln, 30, tip_sharp=1.2), 0.04, 0.016, 2, 'wingfeather')
            P.xf(f, rot=(0, ang, 0), loc=(wx, wy - 0.012 * k, SOLE_H + 0.26))
            P.paint(f, wing, line=1.5)
    if t in ('legendary', 'ur'):
        P.glint((-0.5, -0.2, SOLE_H + 0.3), 11)
    return dict(kind='standing', yaw=-18.0, elev=26.0, roll=-4.0)


def build(row):
    slot = row['family']
    t = _tier(row)
    return dict(charm=charm, ribbon=ribbon, shoes=shoes)[slot](t)
