"""Tomes (book_*): one hardcover model with a tier ladder, and the kraft spiral notebook for Common.

Built facing the viewer (-Y) in the XZ plane, then shown in the 'flat' pose: turned a little left and
leaning back so the page block shows on the right and bottom, rolled about 12 deg clockwise.
"""
import math

import parts as P
import palette as C
from models import common as K

W, H = 1.0, 1.36           # board size
BT = 0.045                 # board thickness

COVERS = dict(
    rare=C.paint('#7db6f3', light='#a6cdfa', shadow='#5589d8', ink='#0d336f', sheen=0.32),            # (appr.)
    superRare=C.paint('#b39afd', light='#cab7fd', shadow='#896be7', ink='#26136e', sheen=0.32),       # (appr.)
    mythic=C.paint('#ff8fab', light='#ffb8c8', shadow='#e0567a', ink='#6e1a3c', sheen=0.32),
    legendary=C.paint('#77dae4', light='#9be5ed', shadow='#45b3c6', ink='#013749', sheen=0.32),       # (appr.)
)


def _boards(cover, thick):
    t = thick
    out = []
    for side in (-1, 1):
        b = P.slab(P.rrect2(W, H, 0.05, 5), BT, BT * 0.4, 3, 'board')
        P.xf(b, loc=(0, side * (t / 2 - BT / 2), 0))
        out.append(P.paint(b, cover, sheen=cover.get('sheen', 0) if side < 0 else 0.0, line=2.5))
    # rounded spine joining the boards on the left
    sp = P.rbox(0.1, t, H - 0.002, r=min(0.048, t * 0.45), seg=4, name='spine')
    P.xf(sp, loc=(-W / 2 + 0.04, 0, 0))
    P.paint(sp, C.over(cover, sheen=0.0), line=2.5)
    # hinge groove: a slim darker rod just right of the spine on the front board
    hg = P.tube([(-W / 2 + 0.12, -t / 2 - 0.004, -H / 2 + 0.03), (-W / 2 + 0.12, -t / 2 - 0.004, H / 2 - 0.03)], 0.012, 8)
    P.paint(hg, C.over(cover, base=cover['shadow'], light=cover['base'], sheen=0.0), line=0.0)
    return out


def _pages(thick, inset=0.035):
    pg = P.rbox(W - 0.06, thick - 2 * BT + 0.004, H - 2 * inset, r=0.012, seg=2, name='pages')
    P.xf(pg, loc=(0.0, 0, 0))
    return P.paint(pg, C.PAGES, stripe=(0.5, 22.0, 0.28), stripe_dir=(0, 1, 0), line=1.6)


def _label(paint_label, blossom_paint, bar_paint, at_z, front):
    lab = P.slab(P.rrect2(0.58, 0.44, 0.07, 5), 0.016, 0.007, 2, 'label')
    P.xf(lab, loc=(0.04, front - 0.008 + 0.002, at_z))
    P.paint(lab, paint_label, line=1.5, lift=0.012)
    K.blossom(0.11, 0.012, (0.04, front - 0.016, at_z + 0.08), blossom_paint, line=1.1,
              pearl=C.paint('#ffe37a', light='#fff3b8', shadow='#f2b83a', ink='#7d4705'), pearl_r=0.28)
    K.bar(0.34, 0.04, (0.04, front - 0.016, at_z - 0.08), bar_paint)
    K.bar(0.22, 0.04, (0.04, front - 0.016, at_z - 0.145), bar_paint)


def hardcover(rarity):
    cover = COVERS[rarity]
    thick = dict(rare=0.3, superRare=0.31, mythic=0.33, legendary=0.36)[rarity]
    _boards(cover, thick)
    _pages(thick)
    front = -thick / 2
    trim = dict(rare=C.SILVER, superRare=C.SILVER, mythic=C.ROSE_GOLD, legendary=C.GOLD_TRIM)[rarity]
    if rarity == 'rare':
        _label(C.WHITE_LABEL, C.paint('#fba7c4', light='#fdd0e0', shadow='#ef7ba3', ink='#781948'),
               C.paint('#6d9fe6', light='#8fb8f0', shadow='#5589d8', ink='#0d336f', rim=0.0), 0.22, front)
        for c in ('tr', 'br'):
            K.corner_guard(W / 2, H / 2 if c[0] == 't' else -H / 2, front, 0.2, 0.03, c, trim)
        K.ribbon_tail(0.16, -H / 2 + 0.06, 0.3, 0.085, 0.0,
                      C.paint('#ef5d6f', light='#f8899a', shadow='#c93a55', ink='#6e1a2a'))
        return dict(roll=16.0)
    corners = ('tr', 'br', 'tl', 'bl')
    shape = 'L' if rarity == 'legendary' else 'tri'
    for c in corners:
        cx = W / 2 if c[1] == 'r' else -W / 2 + 0.07
        K.corner_guard(cx, H / 2 if c[0] == 't' else -H / 2, front, 0.22 if shape == 'L' else 0.19, 0.03, c, trim, shape=shape)
    mz = 0.04
    mx = 0.03
    gem_steps = dict(steps=(0.55, 0.9, 0.02), deep_at=0.25)
    if rarity == 'superRare':
        K.ring_medallion(0.35, 0.27, 0.04, (mx, front, mz), trim, line=1.8)
        inner = P.slab(P.circle2(0.27, 64), 0.02, 0.008, 2, 'inset')
        P.xf(inner, loc=(mx, front - 0.04, mz))
        P.paint(inner, C.paint('#9a80f4', light='#b9a6f8', shadow='#7a5fe0', ink='#26136e'), line=1.3, lift=0.02)
        K.blossom(0.22, 0.02, (mx, front - 0.058, mz), C.paint('#f1ecff', light='#ffffff', shadow='#c6b6f6', ink='#26136e'), line=1.2)
        K.cut_gem(0.085, (mx, front - 0.09, mz), dict(C.TIER_GEM['superRare'], **gem_steps), line=1.1)
        ring = P.torus(0.07, 0.022, 32, 10, 'clasp')
        P.xf(ring, rot=(0, 90, 0), loc=(-W / 2 + 0.0, front + 0.03, H / 2 - 0.3))
        P.paint(ring, trim, line=1.6)
        P.glint((mx + 0.26, front - 0.06, mz + 0.24), 10)
        return dict(roll=10.0)
    if rarity == 'mythic':
        K.ring_medallion(0.35, 0.27, 0.04, (mx, front, mz), trim, line=1.8)
        inner = P.slab(P.circle2(0.27, 64), 0.02, 0.008, 2, 'inset')
        P.xf(inner, loc=(mx, front - 0.04, mz))
        P.paint(inner, C.paint('#ffd0dc', light='#ffe7ee', shadow='#f7a3b9', ink='#6e1a3c'), line=1.3, lift=0.02)
        K.blossom(0.24, 0.024, (mx, front - 0.058, mz), C.over(trim, base='#e7a08f', light='#f6c7b8'), line=1.3)
        core = P.cabochon(0.1, 0.07)
        P.xf(core, rot=(90, 0, 0), loc=(mx, front - 0.08, mz))
        P.paint(core, C.TIER_GEM['mythic'], line=1.1, spec=1.0, spec_at=0.985)
        strap = P.slab(P.rrect2(0.34, 0.2, 0.06, 4), 0.045, 0.018, 2, 'strap')
        P.xf(strap, loc=(W / 2 - 0.03, front - 0.022, -0.12))
        P.paint(strap, trim, line=1.8)
        stud = P.cabochon(0.05, 0.035)
        P.xf(stud, rot=(90, 0, 0), loc=(W / 2 + 0.05, front - 0.048, -0.12))
        P.paint(stud, C.TIER_GEM['mythic'], line=1.0, spec=1.0, spec_at=0.98)
        P.glint((mx + 0.26, front - 0.07, mz + 0.24), 10)
        return dict(roll=10.0)
    # legendary: sunburst medallion around a big cut gem with a star inside, a gold strap with a stud
    rays = P.star2(12, 0.42, 0.31, a0=90)
    rays = P.poly_round(rays, 0.03, 2)
    K.emboss(rays, 0.045, (mx, front, mz), trim, line=1.7, name='sunburst')
    K.ring_medallion(0.3, 0.2, 0.035, (mx, front - 0.035, mz), C.over(trim, base='#fbd05a'), line=1.6)
    K.cut_gem(0.235, (mx, front - 0.09, mz), dict(C.TIER_GEM['legendary'], **gem_steps), sides=12, line=1.3)
    strap = P.slab(P.rrect2(0.38, 0.21, 0.07, 4), 0.05, 0.02, 2, 'strap')
    P.xf(strap, loc=(W / 2 - 0.02, front - 0.025, -0.16))
    P.paint(strap, trim, line=1.9)
    stud = P.cabochon(0.055, 0.04)
    P.xf(stud, rot=(90, 0, 0), loc=(W / 2 + 0.07, front - 0.055, -0.16))
    P.paint(stud, C.TIER_GEM['legendary'], line=1.0, spec=1.0, spec_at=0.98)
    P.glint((mx, front - 0.2, mz), 13)
    return dict(roll=10.0)


def notebook():
    """Doodle Notes: a kraft spiral notebook with a pencil, a pink star sticker and a label (appr.)."""
    kraft = C.paint('#ecd1a2', light='#f3dab4', shadow='#cfa86f', ink='#6f4717', rim=0.2)
    t = 0.12
    cov = P.slab(P.rrect2(W, H, 0.04, 4), 0.04, 0.016, 2, 'cover')
    P.xf(cov, loc=(0, -t / 2 + 0.02, 0))
    P.paint(cov, kraft, line=2.4)
    back = P.slab(P.rrect2(W, H, 0.04, 4), 0.04, 0.016, 2, 'back')
    P.xf(back, loc=(0.0, t / 2 - 0.02, 0))
    P.paint(back, kraft, line=2.4)
    pg = P.rbox(W - 0.04, t - 0.07, H - 0.05, r=0.01, seg=2, name='pages')
    P.xf(pg, loc=(0.0, 0, 0))
    P.paint(pg, C.PAGES, stripe=(0.5, 26.0, 0.28), stripe_dir=(0, 1, 0), line=1.5)
    # spiral rings along the left edge
    for i in range(8):
        z = H / 2 - 0.1 - i * (H - 0.2) / 7
        ring = P.torus(0.07, 0.017, 24, 8, 'ring')
        P.xf(ring, scale=(1.0, 1.1, 1.0), loc=(-W / 2 + 0.01, -0.0, z))
        P.paint(ring, C.STEEL, line=1.3)
    front = -t / 2
    lab = P.slab(P.rrect2(0.62, 0.32, 0.07, 5), 0.014, 0.006, 2, 'label')
    P.xf(lab, loc=(0.08, front - 0.006, 0.38))
    P.paint(lab, C.WHITE_LABEL, line=1.4, lift=0.012)
    blue = C.paint('#8fb7f0', light='#b3cff6', shadow='#6d9fe6', ink='#0d336f', rim=0.0)
    K.bar(0.44, 0.045, (0.08, front - 0.014, 0.425), blue)
    K.bar(0.34, 0.045, (0.04, front - 0.014, 0.33), blue)
    star = P.poly_round(P.star2(5, 0.17, 0.08), 0.03, 3)
    K.emboss(star, 0.016, (0.28, front, -0.22), C.paint('#f78fb3', light='#fbb8cf', shadow='#e0608f', ink='#781948'), rot=-12, line=1.4)
    # pencil lying across the cover, tip at the lower right
    S, E = (-0.36, 0.18), (0.36, -0.46)
    ux, uz = E[0] - S[0], E[1] - S[1]
    L = math.hypot(ux, uz)
    ux, uz = ux / L, uz / L
    y = front - 0.08
    pr = 0.068
    pen = P.tube([(S[0], y, S[1]), (E[0], y, E[1])], pr, 6, name='pencil', smooth=False)
    P.paint(pen, C.paint('#fed242', light='#fee58c', shadow='#e8a91e', ink='#7d4705'), line=1.9, smooth=False)
    cone = P.lathe([(pr, 0.0), (pr * 0.3, 0.17), (0.0, 0.2)], segs=6, name='tip', smooth=False)
    P.xf(cone, rot=(0, math.degrees(math.atan2(ux, uz)), 0), loc=(E[0], y, E[1]))
    P.paint(cone, C.paint('#f6d7a9', light='#fbe8c9', shadow='#d9b27a', ink='#6f4717'), line=1.6)
    lead = P.lathe([(pr * 0.3, 0.0), (0.0, 0.05)], segs=8, name='lead')
    P.xf(lead, rot=(0, math.degrees(math.atan2(ux, uz)), 0), loc=(E[0] + ux * 0.17, y, E[1] + uz * 0.17))
    P.paint(lead, C.paint('#4b4f63', light='#6e7389', shadow='#363a4d', ink='#24273a'), line=1.0)
    ferr = P.tube([(S[0] - ux * 0.07, y, S[1] - uz * 0.07), (S[0], y, S[1])], pr * 1.05, 12, name='ferrule')
    P.paint(ferr, C.SILVER, line=1.5)
    era = P.tube([(S[0] - ux * 0.17, y, S[1] - uz * 0.17), (S[0] - ux * 0.07, y, S[1] - uz * 0.07)], pr * 1.02, 12, name='eraser')
    P.paint(era, C.paint('#fcc4d9', light='#fde0ea', shadow='#f39abb', ink='#781948'), line=1.6)
    return dict(roll=3.0, turn=24.0, tip=24.0)


def build(row):
    r = row['rarity']
    spec = notebook() if r == 'common' else hardcover(r)
    return dict(kind='flat', roll=spec.get('roll', 14.0), turn=spec.get('turn', 32.0), tip=spec.get('tip', 30.0))
