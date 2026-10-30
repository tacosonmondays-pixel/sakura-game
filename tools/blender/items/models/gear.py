"""Gear pieces drawn by gearIcon: gear_<slot>_<rarity>, gear_<slot>_ur and the set looks gear_<set>_<slot>.

Data-driven: catalog.GEAR_SLOT_ART names the base model of each slot and its default design, catalog.GEAR_TIERS is
the rarity ladder every base reads (trim metal, gem, studs, crest, wings, drop bead, glow, glint), and
catalog.GEAR_SETS gives each gear set one look per slot (rarity on the tile). This module holds the base models
(BASES); a design that needs a new form is a new base here:

  pendant   the charm: a faceted stone (shape: diamond, heart, round, star, blossom) in a bezel on a short chain
  bow       the ribbon: two loops, a knot clip and two notched tails (shape: classic, wide)
  sneaker   the shoes: a chunky sneaker (shape: low, high)
  hairclip  the Hair Clip: a bar clip with a flower or heart ornament at its end (never a bow, star or snowflake)
  necklace  the Necklace: a pendant (shape as pendant) hanging from a chain loop

Rarity reads from the shape and the trim, not the colour alone: common plain with pewter, rare silver, super rare
silver with studs, a gem and (shoes) a small wing, mythic rose gold with a sakura blossom behind the stone
(ribbon: layered loops; shoes: a sole stripe and a bigger wing) and a glow, legendary gold with the big crest
(sunburst rays, a star medallion, a gold toe rim and a big wing) and a star glint, UR iridescent (saturated shadow)
with rainbow wings; from mythic up a drop bead hangs below every piece but the shoes. Glints sit on the object, never in the air beside it.
"""
import math

import catalog
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
TRIMS = dict(
    pewter=C.paint('#c7ceda', light='#e6eaf1', shadow='#9aa4b6', ink='#3a4560', spec=0.5, spec_at=0.985),
    silver=C.SILVER, rose=C.ROSE_GOLD, gold=C.GOLD_TRIM, iri=dict(C.IRI_DEEP, iri=0.9),
    brass=C.BRASS, steel=C.STEEL,      # set-look metals
)
GEM = dict(superRare=C.TIER_GEM['superRare'], mythic=C.TIER_GEM['mythic'], legendary=C.TIER_GEM['legendary'],
           ur=C.paint('#f3e6ff', light='#ffffff', shadow='#c4a8f2', ink='#4a2a6e', deep='#a585e8', iri=0.6, glow=0.4))
WHITE = C.paint('#fbfcff', light='#ffffff', shadow='#d3dcea', ink='#3a4560', rim=0.0)
FEATHER = C.paint('#ffffff', light='#ffffff', shadow='#dfe6f2', ink='#3a4560', rim=0.2)
# UR wings: one pastel per feather (pink, gold, mint, sky), so the UR piece reads as rainbow even at 22 px
FEATHER_UR = [C.paint(b, light=l, shadow=sh, ink='#3f2266', iri=0.35, rim=0.3) for b, l, sh in (
    ('#ffb0d8', '#ffe3f1', '#f592c6'), ('#ffd86a', '#fff1c4', '#f8bd4e'), ('#8fe6bc', '#dcfbea', '#62d3a2'),
    ('#9ccbff', '#e0efff', '#7cb0f6'))]   # bright shadow tones: the shoe's wing faces away from the key light
MOTIF = C.paint('#fff6fb', light='#ffffff', shadow='#f3cde0', ink='#6e1a3c', rim=0.3)


class Look:
    """Everything a base needs for one key: the tier row, the design row and the paints."""

    def __init__(self, tier, design):
        self.tier = tier
        self.t = catalog.GEAR_TIERS[tier]
        self.d = design
        if tier == 'ur' or not design.get('body'):
            body = BODY['superRare' if tier == 'set' else tier]
        else:
            body = C.paint(design['body'])
        self.body = dict(body, glow=self.t['glow']) if self.t['glow'] and tier != 'ur' else dict(body)
        tr = design.get('trim') or self.t['trim']
        self.trim = C.paint(tr, spec=0.9, rim=0.6, spec_at=0.985) if tr.startswith('#') else TRIMS[tr]
        self.gem = GEM.get(tier, GEM['superRare']) if self.t['gem'] else None
        ink = self.body['ink']
        self.white = dict(WHITE, ink=ink)
        self.feather = FEATHER_UR if tier == 'ur' else dict(FEATHER, ink=ink)
        self.motif_paint = dict(MOTIF, ink=ink) if tier != 'legendary' else dict(C.CREAM)

    def feather_k(self, k, n):
        if self.tier != 'ur':
            return self.feather
        return self.feather[min(len(self.feather) - 1, round(k * (len(self.feather) - 1) / max(1, n - 1)))]

    def __getattr__(self, k):
        return self.t[k]


# ---------------------------------------------------------------------------
# shared bits
# ---------------------------------------------------------------------------

def _motif2(name, R):
    if name == 'sakura':
        return P.blossom2(R, inner=0.40, notch=0.17)
    if name == 'star':
        return P.poly_round(P.star2(5, R, R * 0.48), R * 0.08, 3)
    if name == 'heart':
        return P.heart2(R * 2.0, R * 1.8)
    if name == 'moon':
        return P.crescent2(R, cut=0.78, shift=0.5)
    return None


def _shape2(shape):
    """Stone / ornament outline (x, z), about 1.05 wide and 1.4 tall for the diamond."""
    if shape == 'heart':
        return P.heart2(1.22, 1.12)
    if shape == 'round':
        return P.circle2(0.6, 64)
    if shape == 'star':
        return P.poly_round(P.star2(5, 0.8, 0.42), 0.08, 3)
    if shape == 'blossom':
        return P.blossom2(0.72, inner=0.45, notch=0.15)
    return P.poly_round([(0, -0.78), (0.52, 0.0), (0, 0.62), (-0.52, 0.0)], 0.12, 4)


def _ridges(shape):
    if shape == 'diamond':
        return [(0.0, -0.3, 0.17), (0.26, 0.0, 0.17), (0.0, 0.3, 0.17), (-0.26, 0.0, 0.17)]
    if shape == 'star':
        return [(0.42 * math.cos(math.radians(90 + 72 * i)), 0.42 * math.sin(math.radians(90 + 72 * i)), 0.17) for i in range(5)]
    return None


def _wing(side, root, look, n, length=0.62, spread=(25.0, 112.0), y=0.0, width=0.17, flat=True):
    """A fan of n feathers from `root`, on side +1 (right) or -1 (left). Flat pieces fan in the XZ plane."""
    if n <= 0:
        return
    a0, a1 = spread
    for k in range(n):
        u = k / max(1, n - 1)
        ang = a0 + (a1 - a0) * u
        ln = length * (1.0 - 0.32 * u)
        f = P.slab(P.leaf2(width, ln, 30, tip_sharp=1.2), 0.045, 0.018, 2, 'wingfeather')
        P.xf(f, rot=(0, side * ang, 0), loc=(root[0], root[1] + y + 0.006 * k, root[2]))
        P.paint(f, look.feather_k(k, n), line=1.6)


def _drop(look, x, y, z, r=0.085):
    ln = P.torus(0.055, 0.02, 18, 6, 'droplink')
    P.xf(ln, rot=(90, 0, 0), loc=(x, y, z - 0.04))
    P.paint(ln, look.trim, line=1.1)
    b = P.sphere(r, 24, 12, 'drop', scale=(0.9, 0.7, 1.25))
    P.xf(b, loc=(x, y, z - 0.08 - r * 1.15))
    P.paint(b, dict(look.gem or look.trim, glow=0.25 if look.glow else 0.0), line=1.3)


def _moved(fn, dx=0.0, dz=0.0, scale=1.0, dy=0.0):
    """Runs a builder, then scales and moves the parts and glints it added (for composite bases)."""
    n0, g0 = len(P.ITEM['parts']), len(P.ITEM['glints'])
    spec = fn()
    for o in P.ITEM['parts'][n0:]:
        P.xf(o, scale=(scale, scale, scale), loc=(dx, dy, dz))
    for i in range(g0, len(P.ITEM['glints'])):
        p, s, e = P.ITEM['glints'][i]
        P.ITEM['glints'][i] = (p * scale + p.__class__((dx, dy, dz)), s, e)
    return spec


# ---------------------------------------------------------------------------
# pendant (charm)
# ---------------------------------------------------------------------------

def _stone(look, shape, chain=True):
    """The stone in its frame at the origin. Returns (half width, bottom z, top z, centre z)."""
    out = _shape2(shape)
    xs = [p[0] for p in out]
    zs = [p[1] for p in out]
    hw, bot, top = max(xs), min(zs), max(zs)
    cz = (top + bot) / 2
    bez_out = P.offset_outline(out, 0.08)
    bez = P.slab(bez_out, 0.24, 0.08, 3, 'bezel')
    P.xf(bez, loc=(0, 0.03, 0))
    P.paint(bez, look.trim, line=2.6)
    cx, ccz = (0.0, 0.0) if shape != 'heart' else (0.0, cz + 0.05)
    g = P.fan_gem(out, 0.14, 0.24, ridges=_ridges(shape), center=(cx, ccz), name='stone')
    P.xf(g, loc=(0, -0.08, 0))
    P.paint(g, dict(look.body, steps=(0.45, 0.86, 0.02), deep_at=0.0), line=1.8)
    if look.d.get('motif'):
        m2 = _motif2(look.d['motif'], 0.2)
        if m2:
            K.emboss(m2, 0.05, (0.0, -0.31, ccz), look.motif_paint, line=1.2)
    if look.crest >= 2 and not look.wings:               # sunburst rays behind the frame (UR: wings instead)
        R = max(hw, (top - bot) / 2) * 1.42
        rays = P.slab(P.poly_round(P.star2(8, R, R * 0.66, a0=90.0), 0.035, 2), 0.08, 0.03, 2, 'rays')
        P.xf(rays, loc=(0, 0.17, cz))
        P.paint(rays, look.trim, line=2.0)
    elif look.crest == 1:                                # a sakura blossom of rose gold behind the stone
        petal = C.over(look.trim, base=look.trim['light'], light='#fff4ef', shadow=look.trim['base'])
        R = max(hw * 1.75, (top - bot) / 2 * 1.12)
        bl = P.slab(P.blossom2(R, inner=0.5, notch=0.1), 0.08, 0.03, 2, 'blossom')
        P.xf(bl, loc=(0, 0.17, cz + 0.04))
        P.paint(bl, petal, line=2.0)
    if look.studs:                                       # ball studs on the frame points
        pts = bez_out
        cands = [min(pts, key=lambda p: p[0]), max(pts, key=lambda p: p[0])]
        if shape in ('diamond', 'round', 'blossom'):
            cands.append(min(pts, key=lambda p: p[1]))
        for x, z in cands:
            v = (x * 1.04, z - (0.04 if z < cz - 0.3 else 0.0))
            b = P.sphere(0.095, 20, 10, 'stud')
            P.xf(b, loc=(v[0], -0.06, v[1]))
            P.paint(b, look.trim, line=1.4)
    if chain:
        bail = P.torus(0.1, 0.035, 24, 8, 'bail')
        P.xf(bail, rot=(0, 90, 0), loc=(0, 0.0, top + 0.16))
        P.paint(bail, look.trim, line=1.6)
        if look.tier != 'common':                        # a bail cap from rare up, with a set gem from super rare
            cap = P.slab(P.circle2(0.13, 32), 0.1, 0.035, 2, 'cap')
            P.xf(cap, loc=(0, -0.1, top + 0.06))
            P.paint(cap, look.trim, line=1.4)
        if look.gem:
            gm = P.cabochon(0.07, 0.05)
            P.xf(gm, rot=(90, 0, 0), loc=(0, -0.15, top + 0.06))
            P.paint(gm, look.gem, line=1.0)
        for i in range(3):
            ln = P.torus(0.08, 0.026, 20, 8, 'link')
            P.xf(ln, scale=(1, 1, 1.4), rot=(90 if i % 2 == 0 else 0, 0, 90 * (i % 2)), loc=(0, 0, top + 0.33 + i * 0.17))
            P.paint(ln, look.trim, line=1.3)
    if look.drop:
        _drop(look, 0.0, -0.02, bot - 0.08)
    if look.wings:
        for s in (-1, 1):
            _wing(s, (s * hw * 0.62, 0.08, cz + 0.16), look, look.wings, length=1.0, spread=(30.0, 120.0), width=0.3)
    return hw, bot, top, cz


def pendant(look):
    shape = look.d.get('shape', 'diamond')
    hw, bot, top, cz = _stone(look, shape)
    if look.star:
        P.glint((-0.12, -0.35, cz + 0.22), look.star)
    return dict(kind='flat', roll=-14.0, turn=14.0, tip=10.0)


# ---------------------------------------------------------------------------
# bow (ribbon)
# ---------------------------------------------------------------------------

def _loop(side, paint, sx=1.0, sz=1.0, y=0.02, name='loop', line=2.6):
    pts = P.poly_round([(0.0, 0.0), (side * 0.85 * sx, 0.42 * sz), (side * 0.95 * sx, 0.0), (side * 0.85 * sx, -0.38 * sz)],
                       0.16, 5)
    o = P.slab(pts, 0.32, 0.13, 4, name)
    P.xf(o, rot=(0, side * -6, 0), loc=(side * 0.06, y, 0.05))
    return P.paint(o, dict(paint, sheen=0.3), line=line)


def bow(look):
    body, trim = look.body, look.trim
    wide = look.d.get('shape') == 'wide'
    sx = 1.18 if wide else 1.0
    tail_len = 0.66 if wide else 0.8
    if look.wings:
        for s in (-1, 1):
            _wing(s, (s * 0.62 * sx, 0.24, 0.08), look, look.wings, length=0.78, spread=(48.0, 124.0), width=0.24)
    for side in (-1, 1):
        K.ribbon_tail(side * 0.18, -0.12, tail_len, 0.3, 0.06, dict(body), notch=0.45, rot=side * -20, line=2.4)
        if look.studs:                                   # a metal band on each tail
            r = math.radians(side * -20)
            d = 0.42 * tail_len
            band = P.rbox(0.38, 0.12, 0.1, r=0.035, seg=2, name='tailband')
            P.xf(band, rot=(0, side * -20, 0), loc=(side * 0.18 - math.sin(r) * d, 0.0, -0.12 - math.cos(r) * d))
            P.paint(band, trim, line=1.4)
    for side in (-1, 1):
        _loop(side, body, sx=sx)
        fold = P.tube([(side * 0.18, -0.16, 0.05), (side * 0.58 * sx, -0.12, 0.05)], 0.035, 8, name='fold')
        P.paint(fold, C.over(body, base=body['shadow'], light=body['shadow']), line=0.0)
    if look.crest >= 1:                                  # layered loops: a smaller pair in front (lighter below gold)
        inner = dict(body) if look.tier == 'legendary' else C.over(body, base=body['light'], shadow=body['base'])
        for side in (-1, 1):
            _loop(side, inner, sx=0.62 * sx, sz=0.66, y=-0.1, name='innerloop', line=2.0)
    knot = P.rbox(0.36, 0.38, 0.44, r=0.14, seg=4, name='knot')
    P.xf(knot, loc=(0, -0.04, 0.05))
    P.paint(knot, trim if look.tier != 'common' else C.over(body, base=body['light'], light='#ffffff'), line=2.2)
    motif = look.d.get('motif')
    if look.crest >= 2:                                  # medallion on the knot: the motif shape, or a star
        m2 = _motif2(motif or 'star', 0.34) or _motif2('star', 0.34)
        med = P.slab(m2, 0.1, 0.035, 2, 'medallion')
        P.xf(med, loc=(0, -0.27, 0.06))
        P.paint(med, trim, line=2.0)
        front = -0.32
    else:
        front = -0.24
        if motif and not look.gem:
            m2 = _motif2(motif, 0.12)
            if m2:
                K.emboss(m2, 0.04, (0.0, -0.24, 0.05), look.motif_paint, line=1.1)
    if look.gem:
        g = P.cabochon(0.1, 0.07)
        P.xf(g, rot=(90, 0, 0), loc=(0, front, 0.06))
        P.paint(g, look.gem, line=1.1)
    if look.drop:
        _drop(look, 0.0, -0.1, -0.2, r=0.075)
    if look.star:
        P.glint((-0.02, front - 0.09, 0.12), look.star)
    return dict(kind='flat', roll=-8.0, turn=14.0, tip=14.0)


# ---------------------------------------------------------------------------
# sneaker (shoes): length along X (toe at -X), width along Y (outer side toward the viewer, -Y), up Z
# ---------------------------------------------------------------------------

SHOE_L = 1.5
SOLE_H = 0.15
_HI = [1.0]   # collar height factor of the shape (low 1.0, high 1.35)


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
    """Upper height: a low round toe box, a rising instep, a padded collar at the heel (higher on high-tops)."""
    hi = 0.52 * _HI[0]
    if t < 0.28:
        h = 0.25 + 0.03 * t / 0.28
    elif t < 0.62:
        u = (t - 0.28) / 0.34
        h = 0.28 + (hi - 0.28) * (3 * u * u - 2 * u ** 3)
    else:
        h = hi
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


def sneaker(look):
    body, trim, t = look.body, look.trim, look.tier
    _HI[0] = 1.35 if look.d.get('shape') == 'high' else 1.0
    white = look.white
    sole = _shoe_piece(0.0, 1.0, P.rrect2(2.0, 1.0, 0.38, 4, cz=0.5), lambda u: _shoe_w(u) * 1.08 + 0.012,
                       lambda u: SOLE_H, name='sole')
    P.paint(sole, white, line=2.4)
    if look.crest >= 1:                                  # a stripe of trim along the sole
        stripe = _shoe_piece(0.02, 0.98, P.rrect2(2.0, 1.0, 0.3, 3, cz=0.5), lambda u: _shoe_w(u) * 1.1 + 0.018,
                             lambda u: SOLE_H * 0.3, z0=SOLE_H * 0.38, name='solestripe')
        P.paint(stripe, trim, line=1.2)
    upper = _shoe_piece(0.015, 0.99, _arch(), _shoe_w, _shoe_h, z0=SOLE_H - 0.01, name='upper')
    P.paint(upper, dict(body, sheen=0.2), line=2.6)
    cap = _shoe_piece(0.0, 0.25, _arch(), lambda u: _shoe_w(u) * 1.045 + 0.006, lambda u: _shoe_h(u) * 1.06 + 0.012,
                      z0=SOLE_H - 0.02, n=16, name='toecap')
    P.paint(cap, white, line=2.0)
    if look.crest >= 2:                                  # legendary and UR: a metal rim round the toe cap
        rim = _shoe_piece(0.215, 0.27, _arch(), lambda u: _shoe_w(u) * 1.07 + 0.012, lambda u: _shoe_h(u) * 1.09 + 0.02,
                          z0=SOLE_H - 0.02, n=6, name='toerim')
        P.paint(rim, trim, line=1.6)
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
    # three fat laces across the instep (four on high-tops), metal eyelets from super rare up
    laces = (-0.3, -0.16, -0.02) if _HI[0] == 1.0 else (-0.3, -0.17, -0.04, 0.09)
    for lx in laces:
        tt = _shoe_t(lx)
        z0 = SOLE_H - 0.01 + _shoe_spring(lx)
        w, h = _shoe_w(tt), _shoe_h(tt)
        path = [(lx + 0.015 * (1 - abs(u)), -u * w * 1.02, z0 + h * _arch_v(u) * 1.02 + 0.012)
                for u in [-0.62 + 1.24 * i / 10 for i in range(11)]]
        lace = P.tube(path, 0.034, 8, name='lace')
        P.paint(lace, white, line=1.3)
        if look.studs:
            e = P.sphere(0.034, 16, 8, 'eyelet')
            P.xf(e, loc=path[-1] if path[-1][1] < 0 else path[0])
            P.paint(e, trim, line=1.0)
    motif = look.d.get('motif')
    if motif:                                            # the set emblem on the outer side
        tt = 0.55
        m2 = _motif2(motif, 0.1)
        if m2:
            K.emboss(m2, 0.03, (-SHOE_L / 2 + SHOE_L * tt, -_shoe_w(tt) * 0.98 - 0.02, SOLE_H + _shoe_h(tt) * 0.42),
                     look.motif_paint, line=1.1)
    if look.gem:
        tt = 0.9
        g = P.cabochon(0.055, 0.035)
        P.xf(g, rot=(90, 0, 0), loc=(-SHOE_L / 2 + SHOE_L * tt, -_shoe_w(tt) * 1.05 - 0.03, SOLE_H + _shoe_h(tt) * 0.3))
        P.paint(g, look.gem, line=1.0)
    n = look.shoe_wing
    if n:                                                # feathers fanned back and up from the heel, growing per tier
        wx = -SHOE_L / 2 + SHOE_L * 0.72
        wy = -_shoe_w(0.72) - 0.05
        size = dict(superRare=0.72, mythic=1.0, legendary=1.3, ur=1.65).get(t, 1.0)
        angs = {2: (34, 64), 3: (26, 50, 76), 4: (18, 40, 62, 86)}[n]
        for k, ang in enumerate(angs):
            ln = (0.44 - 0.07 * k) * size
            f = P.slab(P.leaf2(0.14 * size, ln, 30, tip_sharp=1.2), 0.04, 0.016, 2, 'wingfeather')
            P.xf(f, rot=(0, ang, 0), loc=(wx, wy - 0.012 * k, SOLE_H + 0.3 * _HI[0]))
            P.paint(f, look.feather_k(k, n), line=1.6)
    if look.star >= 10:
        P.glint((-0.5, -0.2, SOLE_H + 0.3), look.star - 1)
    return dict(kind='standing', yaw=-18.0, elev=26.0, roll=-4.0)


# ---------------------------------------------------------------------------
# hairclip and necklace (the coming gear update's pieces)
# ---------------------------------------------------------------------------

def hairclip(look):
    body, trim = look.body, look.trim
    shape = look.d.get('shape', 'blossom')
    # the bar clip: a long rounded slab of trim with an enamel inlay of the body colour
    bar = P.slab(P.rrect2(1.7, 0.26, 0.13, 6), 0.12, 0.045, 3, 'clipbar')
    P.xf(bar, loc=(-0.25, 0.02, 0))
    P.paint(bar, trim, line=2.4)
    inlay = P.slab(P.rrect2(1.3, 0.12, 0.06, 6), 0.03, 0.012, 2, 'inlay')
    P.xf(inlay, loc=(-0.38, -0.05, 0))
    P.paint(inlay, body, line=1.0, lift=0.02)
    if look.studs:
        for x in (-0.9, -0.55, -0.2):
            b = P.sphere(0.05, 16, 8, 'pearl')
            P.xf(b, loc=(x, -0.08, 0))
            P.paint(b, C.PEARL, line=1.0)
    # the ornament at the right end
    R = 0.46
    if look.crest >= 2:                                  # a scalloped metal disc behind the flower (never a star)
        disc = P.slab(P.blossom2(R * 1.38, inner=0.86, notch=0.0), 0.06, 0.02, 2, 'disc')
        P.xf(disc, rot=(0, 36, 0), loc=(0.55, 0.12, 0.02))
        P.paint(disc, trim, line=1.8)
    if look.crest >= 1:
        o2 = P.slab(_motif2('sakura' if shape == 'blossom' else shape, R * 0.6), 0.12, 0.04, 2, 'ornament2')
        P.xf(o2, rot=(0, 25, 0), loc=(0.12, 0.06, 0.32))
        P.paint(o2, C.over(body, base=body['light'], shadow=body['base']), line=1.8)
    orn = P.slab(_motif2('sakura' if shape == 'blossom' else shape, R), 0.16, 0.06, 3, 'ornament')
    P.xf(orn, loc=(0.55, -0.04, 0.02))
    P.paint(orn, dict(body, sheen=0.25), line=2.4)
    c = P.cabochon(0.12 if look.gem else 0.1, 0.08)
    P.xf(c, rot=(90, 0, 0), loc=(0.55, -0.13, 0.02))
    P.paint(c, look.gem or C.PEARL, line=1.2)
    if look.drop:
        ch = P.tube([(0.55, -0.05, -0.3), (0.55, -0.05, -0.55)], 0.018, 8, name='chain')
        P.paint(ch, trim, line=1.0)
        _drop(look, 0.55, -0.05, -0.55, r=0.08)
    if look.wings:
        _wing(1, (0.85, 0.1, 0.12), look, look.wings, length=0.6, spread=(20.0, 110.0))
    if look.star:
        P.glint((0.45, -0.2, 0.15), look.star)
    return dict(kind='flat', roll=-24.0, turn=14.0, tip=12.0)


def necklace(look):
    trim = look.trim
    # the chain: a round loop of trim from the clasp at the top down to the pendant's bail
    cz, R = 0.78, 0.66
    for a0, a1 in ((98.0, 266.0), (274.0, 442.0)):
        path = [(R * math.cos(math.radians(a0 + (a1 - a0) * i / 40)), 0.05,
                 cz + R * 1.05 * math.sin(math.radians(a0 + (a1 - a0) * i / 40))) for i in range(41)]
        ch = P.tube(path, 0.045, 10, name='chain')
        P.paint(ch, trim, line=1.6)
    clasp = P.torus(0.075, 0.03, 20, 8, 'clasp')
    P.xf(clasp, rot=(90, 0, 0), loc=(0.0, 0.05, cz + R * 1.05 + 0.02))
    P.paint(clasp, trim, line=1.3)
    _moved(lambda: _stone(look, look.d.get('shape', 'heart'), chain=False), dz=-0.42, dy=-0.04, scale=0.85)
    bail = P.torus(0.08, 0.032, 20, 8, 'bail')
    P.xf(bail, rot=(0, 90, 0), loc=(0, 0.02, cz - R * 1.05 - 0.02))
    P.paint(bail, trim, line=1.3)
    if look.star:
        P.glint((-0.1, -0.34, -0.3), look.star)
    return dict(kind='flat', roll=-10.0, turn=14.0, tip=10.0)


BASES = dict(pendant=pendant, bow=bow, sneaker=sneaker, hairclip=hairclip, necklace=necklace)


def build(row):
    slot, tier, gear_set = catalog.gear_parse(row['key'])
    design = catalog.gear_design(slot, gear_set)
    fn = BASES.get(design['base'])
    if fn is None:                       # the set-look bases (models/gearset.py)
        from models import gearset
        fn = gearset.BASES[design['base']]
    return fn(Look(tier, design))
