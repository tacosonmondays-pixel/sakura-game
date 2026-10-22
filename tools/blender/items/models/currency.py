"""Currencies and tokens: coins, gems, Recruit Points, the two token coins, Memento, Moonpearl and
the event candy. Pile items use "hero plus echo": a smaller copy behind and to the upper right."""
import math

import parts as P
import palette as C
from models import common as K


def coin_mesh(r=1.0, t=0.2, rim=0.15, step=0.05, name='coin'):
    """Coin with a raised stepped rim around a recessed face (built facing the viewer, -Y)."""
    h = t / 2
    prof = [(0.0, -h), (r * 0.97, -h, 'S'), (r, -h * 0.6), (r, h * 0.6), (r * 0.97, h, 'S'),
            (r - rim + 0.02, h, 'S'), (r - rim, h - step * 0.6), (r - rim - 0.02, h - step, 'S'), (0.0, h - step)]
    return P.lathe(prof, segs=72, name=name, axis='Y')


def coin_body(at, scale, metal, rim_paint=None, sheen=0.34, R=1.0, depth=0.22, rim_r=0.12, groove=True, line=2.6):
    """Disc body + a rounded torus rim (light on its upper left, dark on its lower right) + a fine groove.
    Returns the y of the recessed face (front plane for embossed motifs)."""
    s = scale
    h = depth / 2
    body = P.lathe([(0.0, -h), (R * 0.97, -h, 'S'), (R, -h * 0.5), (R, h * 0.3), (R * 0.96, h * 0.45, 'S'),
                    (0.0, h * 0.45)], segs=72, name='coinbody', axis='Y')
    P.xf(body, scale=s, loc=at)
    P.paint(body, C.over(metal, sheen=sheen, sheen_at=-0.42), line=line)
    rim = P.torus(R - rim_r * 0.95, rim_r, 72, 14, 'rim')
    P.xf(rim, scale=(1, 1, 0.7), rot=(90, 0, 0))
    P.xf(rim, scale=s, loc=(at[0], at[1] - h * 0.45 * s, at[2]))
    P.paint(rim, C.over(rim_paint or metal, sheen=sheen * 0.6, sheen_at=-0.42), line=line * 0.6, lift=0.01 * s)
    face_y = at[1] - h * 0.45 * s
    if groove:
        g = P.torus(R - rim_r * 2.3, 0.012, 72, 6, 'groove')
        P.xf(g, scale=(1, 1, 0.5), rot=(90, 0, 0))
        P.xf(g, scale=s, loc=(at[0], face_y, at[2]))
        P.paint(g, C.over(metal, base=metal['shadow'], light=metal['base']), line=0.9, lift=0.004 * s)
    return face_y


def coin(at, scale, roll, gold, emboss_p, front_extra=0.0, sheen=0.34, glint=True, glint_size=13):
    fy = coin_body(at, scale, gold, sheen=sheen, depth=0.28)
    t = 0.28 * scale
    K.blossom(0.5 * scale, 0.04 * scale, (at[0], fy, at[2]), emboss_p, rot=roll, line=1.3,
              pearl=C.paint('#fffaf0', light='#ffffff', shadow='#f1d98a', ink='#7d4705', spec=0.9), pearl_r=0.18)
    if glint:
        P.glint((at[0] - 0.7 * scale, at[1] - t, at[2] + 0.55 * scale), glint_size)


def coins():
    gold = C.GOLD
    cream = C.paint('#fef6cb', light='#fffbe8', shadow='#f4d98c', ink='#7d4705', rim=0.2)
    coin((0.74, 0.5, 0.6), 0.8, 0, gold, cream, glint=False)
    coin((0.0, 0.0, 0.0), 1.0, 0, gold, cream)
    return dict(kind='flat', roll=-14.0, turn=30.0, tip=32.0)


def flower_outline(R, petals=5, a0=90.0):
    """Coarse sakura outline for faceted crystals: per petal a junction, shoulder, tip, notch, tip, shoulder."""
    pts, ridges = [], []
    for i in range(petals):
        a = a0 + 360.0 * i / petals
        for da, rr in ((-36, 0.36), (-25, 0.8), (-11, 1.0), (0, 0.84), (11, 1.0), (25, 0.8)):
            t = math.radians(a + da)
            pts.append((R * rr * math.cos(t), R * rr * math.sin(t)))
        t = math.radians(a)
        ridges.append((R * 0.6 * math.cos(t), R * 0.6 * math.sin(t)))
    return pts, ridges


def sakura_crystal(at, R, gem_p, rot=0.0, depth=0.22, rise=0.3, ridge_rise=0.2, line=2.4, center_emboss=True):
    pts, rid = flower_outline(R)
    g = P.fan_gem(pts, depth * R, rise * R, ridges=[(x, z, ridge_rise * R) for x, z in rid], name='sakura')
    P.xf(g, rot=(0, rot, 0), loc=at)
    q = dict(gem_p)
    q.setdefault('steps', (0.4, 0.86, 0.02))
    q.setdefault('deep_at', -0.1)
    P.paint(g, q, line=line)
    if center_emboss:
        K.blossom(R * 0.2, R * 0.05, (at[0], at[1] - rise * R + R * 0.03, at[2]),
                  C.paint('#fff8fb', light='#ffffff', shadow='#f6d3e2', ink='#781948'), rot=rot, line=1.0,
                  pearl=C.paint('#fff1c7', light='#ffffff', shadow='#f4cf7a', ink='#7d4705'), pearl_r=0.3)
    return g


def gems():
    sakura_crystal((0.0, 0.0, 0.0), 1.0, C.PINK_GEM, rot=8, depth=0.3, rise=0.5, ridge_rise=0.4)
    echo = C.over(C.PINK_GEM, base='#f9a9c9', light='#fde0ec', shadow='#f0689f', deep='#e2508c')
    sakura_crystal((0.98, 0.4, 0.78), 0.42, echo, rot=-14, line=2.0, depth=0.3, rise=0.5, ridge_rise=0.4)
    P.glint((-0.55, -0.3, 0.42), 11)
    return dict(kind='flat', roll=-6.0, turn=22.0, tip=24.0)


def recruit_points():
    """Sakura rosette badge: a ring of petals, a gold star boss, two ribbon tails."""
    pink = C.paint('#ff9ec4', light='#ffc6dc', shadow='#e0609a', ink='#7a1f4a', sheen=0.2)
    tails = C.paint('#f57aab', light='#fba3c6', shadow='#d44f86', ink='#7a1f4a')
    for sx, rot in ((-0.26, 14), (0.26, -14)):
        K.ribbon_tail(sx, -0.25, 0.85, 0.36, 0.12, tails, notch=0.45, rot=rot, line=2.2)
    ros = P.slab(P.blossom2(1.0, inner=0.62, notch=0.12), 0.2, 0.08, 4, 'rosette')
    P.paint(ros, pink, line=2.6)
    ring = P.torus(0.56, 0.05, 64, 10, 'ring')
    P.xf(ring, scale=(1, 1, 0.6), rot=(90, 0, 0), loc=(0, -0.1, 0))
    P.paint(ring, C.over(pink, base='#ffd3e4', light='#ffeaf2'), line=1.4, lift=0.02)
    boss = coin_body((0, -0.1, 0), 0.48, C.GOLD, sheen=0.3, depth=0.22, groove=False, line=2.0)
    star = P.poly_round(P.star2(5, 0.28, 0.13), 0.04, 3)
    K.emboss(star, 0.05, (0, boss, 0), C.paint('#fef6cb', light='#fffbe8', shadow='#f4d98c', ink='#7d4705'), line=1.4)
    P.glint((-0.38, -0.25, 0.42), 12)
    return dict(kind='flat', roll=-8.0, turn=20.0, tip=18.0)


def token(metal, rim_paint, motif):
    fy = coin_body((0, 0, 0), 1.0, metal, rim_paint=rim_paint, sheen=0.3, depth=0.36, rim_r=0.14)
    motif(fy)
    P.glint((-0.68, -0.25, 0.52), 12)
    return dict(kind='flat', roll=-10.0, turn=26.0, tip=26.0)


def token_bounty():
    mint = C.paint('#5fc9b8', light='#9ae6da', shadow='#2f9e94', ink='#0f4a44')
    cream = C.paint('#f6f1df', light='#ffffff', shadow='#d8d0b4', ink='#0f4a44')

    def motif(fy):
        ring = P.slab(P.circle2(0.56, 64), 0.035, 0.012, 2, 'tring')
        P.xf(ring, loc=(0, fy - 0.0175 + 0.005, 0))
        P.paint(ring, cream, line=1.4, lift=0.03)
        hole = P.slab(P.circle2(0.43, 64), 0.03, 0.01, 2, 'thole')
        P.xf(hole, loc=(0, fy - 0.03, 0))
        P.paint(hole, mint, line=1.2, lift=0.02)
        K.blossom(0.3, 0.04, (0, fy - 0.035, 0), cream, line=1.3,
                  pearl=C.paint('#ffe37a', light='#fff3b8', shadow='#f2b83a', ink='#7d4705'), pearl_r=0.22)
    return token(mint, None, motif)


def token_boss():
    rose = C.paint('#ff6b7d', light='#ff9eaa', shadow='#d63a5a', ink='#6e1a2a')
    ivory = C.paint('#fff6e6', light='#ffffff', shadow='#e8d6b8', ink='#6e1a2a')

    def motif(fy):
        face = P.slab(P.rrect2(0.66, 0.56, 0.26, 8), 0.06, 0.025, 3, 'mask')
        P.xf(face, loc=(0, fy - 0.03, -0.06))
        P.paint(face, ivory, line=1.5, lift=0.04)
        for sx in (-1, 1):
            horn = P.slab(P.poly_round([(-0.08, 0), (0.08, 0), (0.02 * sx, 0.24)], 0.03, 3), 0.06, 0.02, 2, 'horn')
            P.xf(horn, rot=(0, -sx * 18, 0), loc=(sx * 0.2, fy - 0.03, 0.17))
            P.paint(horn, ivory, line=1.4, lift=0.04)
            eye = P.slab(P.circle2(0.055, 20, rz=0.07), 0.02, 0.008, 2, 'eye')
            P.xf(eye, loc=(sx * 0.14, fy - 0.07, -0.02))
            P.paint(eye, C.paint('#7a2436', light='#9a3a50', shadow='#5a1626', ink='#4a1020'), line=0.0)
            blush = P.slab(P.circle2(0.05, 16, rz=0.03), 0.01, 0.004, 1, 'blush')
            P.xf(blush, loc=(sx * 0.21, fy - 0.068, -0.13))
            P.paint(blush, C.paint('#ffb3c0', light='#ffd0d8', shadow='#ff99aa', ink='#6e1a2a'), line=0.0)
        smile = P.tube(P.smooth_path([(-0.07, fy - 0.068, -0.15), (0.0, fy - 0.068, -0.19), (0.07, fy - 0.068, -0.15)], 10), 0.014, 6)
        P.paint(smile, C.paint('#7a2436', light='#9a3a50', shadow='#5a1626', ink='#4a1020'), line=0.0)
    return token(rose, C.SILVER, motif)


def memento():
    """Heart locket on a ribbon loop, silver hinge, small inset violet gem."""
    pink = C.paint('#ff8fb8', light='#ffc0d6', shadow='#d6457e', ink='#7a1f4a', sheen=0.3, spec=0.5, spec_at=0.99)
    loop = P.tube(P.smooth_path([(-0.12, 0.05, 0.5), (-0.36, 0.05, 0.95), (0.0, 0.05, 1.18), (0.36, 0.05, 0.95), (0.12, 0.05, 0.5)], 40),
                  0.06, 10, name='loop')
    P.xf(loop, scale=(1, 0.5, 1))
    P.paint(loop, C.paint('#a993f5', light='#c7b8f9', shadow='#7d64e0', ink='#34206e'), line=2.0)
    outline = P.poly_round(P.resample(P.heart2(1.25, 1.12, 240), 56), 0.05, 3)     # blunt the cleft: no bevel fold
    heart = P.slab(outline, 0.32, 0.09, 4, 'locket')
    P.paint(heart, pink, line=2.6)
    edge = P.ring_along(P.offset_outline(outline, -0.08), 0.035, 8, 'edge', scale_depth=0.6)
    P.xf(edge, loc=(0, -0.16, 0))
    P.paint(edge, C.over(pink, base='#ffb0cc', light='#ffd6e5'), line=1.2, lift=0.02)
    hinge = P.tube([(-0.08, 0.0, 0.47), (0.08, 0.0, 0.47)], 0.07, 12, name='hinge')
    P.paint(hinge, C.SILVER, line=1.6)
    bail = P.torus(0.08, 0.03, 24, 8, 'bail')
    P.xf(bail, rot=(0, 90, 0), loc=(0, 0.0, 0.58))
    P.paint(bail, C.SILVER, line=1.4)
    K.cut_gem(0.11, (0.0, -0.2, -0.02), dict(C.TIER_GEM['superRare'], steps=(0.5, 0.9, 0.02), deep_at=0.2), line=1.2)
    P.glint((-0.36, -0.22, 0.28), 11)
    return dict(kind='flat', roll=-10.0, turn=18.0, tip=16.0)


def moonpearl():
    """A lavender-white pearl in a gold crescent cradle, star glint."""
    cres = P.poly_round(P.crescent2(1.0, cut=0.78, shift=0.42), 0.06, 3)
    c = P.slab(cres, 0.26, 0.1, 4, 'crescent')
    P.xf(c, rot=(0, -45, 0))                      # opening to the upper right
    P.paint(c, C.GOLD, sheen=0.25, line=2.5)
    d = 0.42 * 0.7071
    pearl = P.sphere(0.56, 48, 24, 'pearl')
    P.xf(pearl, loc=(d - 0.05, -0.2, d - 0.05))
    P.paint(pearl, C.paint('#efeaff', light='#ffffff', shadow='#b9a8ef', ink='#4c3d8f', spec=1.0, spec_at=0.975, rim=0.8, iri=0.18),
            line=2.4)
    P.glint((d - 0.25, -0.8, d + 0.2), 13)
    P.glint((-0.7, -0.2, -0.2), 8)
    return dict(kind='flat', roll=0.0, turn=16.0, tip=16.0)


def candy():
    """Wrapped round pumpkin candy: a clean bright orange body whose ribs are tone changes only (printed
    stripes, no bumps), light violet wrapper twists, a small carved smile."""
    orange = C.paint('#ff9c33', light='#ffc46e', shadow='#ea7420', ink='#6a2a08', spec=0.6, spec_at=0.985)
    violet = C.paint('#b07ef0', light='#cfaaf7', shadow='#8a58d8', ink='#3a1260')
    prof = []
    for i in range(17):
        a = -math.pi / 2 + math.pi * i / 16
        prof.append((0.62 * math.cos(a) if i not in (0, 16) else 0.0, 0.52 * math.sin(a)))
    body = P.lathe(prof, segs=64, name='pumpkin')
    P.paint(body, orange, line=2.6)
    rib = dict(base='#f2832a', light='#f7a050', shadow='#e06f1c', ink='#6a2a08', rim=0.0, drift=0.0)
    for phi in (-58, -22, 22, 58):        # ribs as tone lines along the meridians
        f = math.radians(phi)
        pts = []
        for i in range(15):
            a = math.radians(-66 + 132 * i / 14)
            pts.append((0.628 * math.cos(a) * math.sin(f), -0.628 * math.cos(a) * math.cos(f), 0.527 * math.sin(a)))
        r = P.tube(pts, 0.024, 6, name='rib')
        P.paint(r, rib, line=0.0)
    for sx in (-1, 1):
        fan = [(0, 0), (sx * 0.5, 0.32), (sx * 0.56, 0.12), (sx * 0.6, -0.04), (sx * 0.54, -0.22), (sx * 0.48, -0.34)]
        fan = P.poly_round(fan, 0.04, 3)
        w = P.slab(fan, 0.12, 0.04, 2, 'twist')
        P.xf(w, loc=(sx * 0.55, 0.05, 0))
        P.paint(w, violet, line=2.2)
        knot = P.sphere(0.1, 16, 8, 'knot', scale=(1.0, 0.8, 0.9))
        P.xf(knot, loc=(sx * 0.62, 0.0, 0))
        P.paint(knot, violet, line=1.6)
    stem = P.tube([(0, 0, 0.42), (0.04, 0, 0.6)], 0.06, 8, name='stem')
    P.paint(stem, C.paint('#6dbb5a', light='#93d47f', shadow='#4a9a3c', ink='#1f4a18'), line=1.6)
    eye_p = C.paint('#7a3410', light='#9a4a1c', shadow='#5a240a', ink='#4a1a06')
    for sx in (-1, 1):
        e = P.slab(P.poly_round([(-0.07, -0.04), (0.07, -0.04), (0.0, 0.07)], 0.015, 2), 0.02, 0.008, 1, 'eye')
        P.xf(e, loc=(sx * 0.17, -0.6, 0.1))
        P.paint(e, eye_p, line=0.0)
    sm = P.tube(P.smooth_path([(-0.2, -0.58, -0.08), (0.0, -0.61, -0.2), (0.2, -0.58, -0.08)], 12), 0.025, 6)
    P.paint(sm, eye_p, line=0.0)
    P.glint((-0.32, -0.6, 0.3), 11)
    return dict(kind='flat', roll=-8.0, turn=14.0, tip=14.0)


def build(row):
    k = row['key']
    table = dict(coins=coins, gems=gems, recruitPoints=recruit_points, token_bounty=token_bounty, token_boss=token_boss,
                 memento=memento, moonpearl=moonpearl)
    if k in table:
        return table[k]()
    if k.startswith('evt_'):
        return candy()
    raise KeyError(k)
