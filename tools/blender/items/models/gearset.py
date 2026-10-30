"""Set-look bases for gear_<set>_<slot> (docs/specs/GEAR_SET_LOOKS.md; rows in catalog.GEAR_SETS).

Each gear set is a kit of five matching pieces with one motif, one palette (main, accent, light colour) and one
material (the trim). Every piece is layered: a metal frame, a gem / glass / LED face, and a fabric or cord accent,
plus one hero detail that tells the piece's story. The rows pick a base and its options; this module draws them:

  keyring   the charm as a key fob on a split ring; fob: pompom, token, compass, popper, powerbank
  bracelet  the charm as a bead bracelet; beads: abacus
  setbow    the ribbon; knot: grille, chalk, protractor, star, coin, plug; stripes: 0..3; tails: notched, streamers, cable
  setshoe   the shoes; style: trainer, loafer; sole: plain, glow, grid, ticks, glitter; side: none, chargebars, stripe;
            buckle: none, coin
  setclip   the hair clip; ornament: pompom, button, setsquare, confetti, calc, bolt (never a bow, star or snowflake)
  setlocket the necklace; locket: heart, timer, crosshair, party, coin, battery; cord: chain, cord

Shared paint roles (catalog row fields): body (main colour), accent (second colour), light (the LED / glow colour),
trim (a TRIMS name or a hex metal), glass (a pale glass tint); stripe / strap pick which role paints the ribbon
stripes and the loafer strap (accent, white, trim, body, dark). Built facing the viewer (-Y), as every item.
"""
import math

import parts as P
import palette as C
from models import common as K
from models import gear as G


# ---------------------------------------------------------------------------
# paints and small parts
# ---------------------------------------------------------------------------

def _paints(look):
    d = look.d
    body = look.body
    accent = C.paint(d['accent']) if d.get('accent') else C.over(body, base=body['light'])
    light = C.paint(d.get('light') or '#ffffff', glow=0.75, rim=0.2)
    glass = C.paint(d.get('glass') or '#e8f4ff', light='#ffffff', rim=0.4, spec=0.6, spec_at=0.99)
    white = C.paint('#fbfcff', light='#ffffff', shadow='#d3dcea', ink=body['ink'], rim=0.0)
    dark = C.paint('#2a3352', light='#3a4670', shadow='#1c2238', ink='#141a2c', rim=0.2)
    pp = dict(body=body, accent=accent, light=light, glass=glass, white=white, dark=dark, trim=look.trim)
    pp['stripe'] = pp[d.get('stripe', 'accent')]
    pp['strap'] = pp[d.get('strap', 'accent')]
    return pp


def _disc(R, depth, at, paint, line=2.2, bevel=None, name='disc', n=64):
    o = P.slab(P.circle2(R, n), depth, depth * 0.4 if bevel is None else bevel, 3, name)
    P.xf(o, loc=at)
    return P.paint(o, paint, line=line)


def _slab(outline, depth, at, paint, line=2.0, bevel=None, rot=0.0, name='slab'):
    o = P.slab(outline, depth, depth * 0.4 if bevel is None else bevel, 3, name)
    P.xf(o, rot=(0, rot, 0), loc=at)
    return P.paint(o, paint, line=line)


def _led(at, r, paint, line=1.0):
    b = P.sphere(r, 20, 10, 'led', scale=(1, 0.7, 1))
    P.xf(b, loc=at)
    return P.paint(b, paint, line=line)


def _bar(w, h, at, paint, depth=0.03, line=0.9, rot=0.0):
    return K.emboss(P.rrect2(w, h, min(w, h) * 0.35, 3), depth, at, paint, rot=rot, line=line)


def _ring(R, r, at, paint, line=1.4, flat=False):
    """A ring facing the viewer (in the XZ plane), or lying flat."""
    t = P.torus(R, r, 40, 10, 'ring')
    P.xf(t, rot=(0, 0, 0) if flat else (90, 0, 0), loc=at)
    return P.paint(t, paint, line=line)


def _pom(R, at, paint, lobes=17, name='pom'):
    """A fluffy pom-pom: a scalloped puffy disc with a few front tufts."""
    out = [(R * (1 + 0.08 * math.cos(lobes * 2 * math.pi * i / 170)) * math.cos(2 * math.pi * i / 170),
            R * (1 + 0.08 * math.cos(lobes * 2 * math.pi * i / 170)) * math.sin(2 * math.pi * i / 170)) for i in range(170)]
    o = P.slab(out, R * 0.7, R * 0.3, 4, name)
    P.xf(o, loc=at)
    P.paint(o, dict(paint, sheen=0.15), line=2.2)
    for k, (dx, dz, rr) in enumerate(((-0.35, 0.3, 0.34), (0.3, 0.32, 0.3), (0.05, -0.05, 0.38), (-0.3, -0.35, 0.3),
                                      (0.38, -0.3, 0.3))):
        t = P.sphere(R * rr, 20, 10, 'tuft', scale=(1, 0.55, 1))
        P.xf(t, loc=(at[0] + dx * R, at[1] - R * 0.36, at[2] + dz * R))
        P.paint(t, C.over(paint, base=paint['light'], shadow=paint['base']) if k % 2 == 0 else paint, line=1.0)


def _keyring_top(look, pp, top):
    """Split ring and two links above a fob whose top is at z = top. Returns the ring centre z."""
    for i in range(2):
        ln = P.torus(0.075, 0.026, 20, 8, 'link')
        P.xf(ln, scale=(1, 1, 1.35), rot=(90 if i % 2 == 0 else 0, 0, 90 * (i % 2)), loc=(0, 0, top + 0.1 + i * 0.15))
        P.paint(ln, pp['trim'], line=1.3)
    zc = top + 0.5
    _ring(0.2, 0.038, (0, 0, zc), pp['trim'], line=1.6)
    return zc


# ---------------------------------------------------------------------------
# keyring (charm)
# ---------------------------------------------------------------------------

def keyring(look):
    pp = _paints(look)
    fob = look.d['fob']
    star = None
    if fob == 'pompom':           # Pom-Pom Keyring: a pom-pom on a trim cap with a light-up bead
        _pom(0.56, (0, 0.0, -0.1), pp['body'])
        for dx, dz in ((-0.3, 0.12), (0.28, -0.22)):    # white tufts: the squad colours mixed in
            t = P.sphere(0.13, 20, 10, 'tuft', scale=(1, 0.55, 1))
            P.xf(t, loc=(dx, -0.36, -0.1 + dz))
            P.paint(t, pp['white'], line=1.0)
        cap = _slab(P.rrect2(0.3, 0.2, 0.06, 3), 0.22, (0, -0.02, 0.5), pp['trim'], line=1.8)
        _led((0, -0.14, 0.5), 0.085, pp['light'])
        top, star = 0.6, (-0.2, -0.4, 0.15)
    elif fob == 'token':          # Tag Token: a chalk-drawn token, a coral tag stripe and an LED dot
        _disc(0.6, 0.2, (0, 0.0, 0.0), pp['trim'], line=2.4)
        _disc(0.5, 0.06, (0, -0.1, 0.0), pp['body'], line=1.4)
        ring = P.ring_slab(P.circle2(0.4, 48), P.circle2(0.34, 48), 0.03, 0.01, 2, name='chalkring')
        P.xf(ring, loc=(0, -0.14, 0.0))
        P.paint(ring, pp['white'], line=0.9, lift=0.02)
        _bar(0.62, 0.14, (0.0, -0.14, -0.05), pp['accent'], rot=-25.0)
        _led((0.22, -0.17, 0.2), 0.07, pp['light'])
        top, star = 0.6, (-0.3, -0.2, 0.32)
    elif fob == 'compass':        # Compass Keyring: a brass compass, a needle, a laser-dot lens on the rim
        _disc(0.6, 0.24, (0, 0.0, 0.0), pp['trim'], line=2.4)
        _disc(0.48, 0.06, (0, -0.12, 0.0), pp['body'], line=1.2)
        for a in range(0, 360, 45):
            r0 = 0.4 if a % 90 else 0.36
            x, z = math.cos(math.radians(a)), math.sin(math.radians(a))
            K.emboss(P.rrect2(0.03, 0.08 if a % 90 else 0.12, 0.012, 2), 0.02, (x * r0, -0.16, z * r0), pp['white'],
                     rot=-(a - 90), line=0.0)
        needle = P.poly_round([(0, 0.4), (0.07, 0), (0, -0.4), (-0.07, 0)], 0.02, 2)
        _slab(needle, 0.05, (0, -0.18, 0.0), pp['white'], line=1.2, rot=35.0)
        tip = P.poly_round([(0, 0.4), (0.07, 0), (-0.07, 0)], 0.02, 2)
        _slab(tip, 0.055, (0, -0.19, 0.0), pp['accent'], line=1.2, rot=35.0)
        _led((0, -0.21, 0.0), 0.05, pp['trim'])
        _led((0.42, -0.12, 0.42), 0.075, pp['light'])     # the laser dot
        top, star = 0.6, (-0.28, -0.2, 0.3)
    elif fob == 'popper':         # Popper Keyring: a party popper with fibre-optic streamers
        cone = P.poly_round([(-0.42, 0.3), (0.42, 0.3), (0.02, -0.85)], 0.07, 3)
        _slab(cone, 0.3, (0.0, 0.0, -0.05), pp['body'], line=2.4, rot=-20.0)
        for k, z in enumerate((-0.02, -0.28)):
            _bar(0.42 - 0.14 * k, 0.07, (0.02 + 0.09 * k * 0, -0.17, z + 0.0), pp['accent'], rot=-20.0)
        rim = P.rbox(0.92, 0.36, 0.14, r=0.05, seg=2, name='rim')
        P.xf(rim, rot=(0, -20, 0), loc=(0.09, 0.0, 0.2))
        P.paint(rim, pp['trim'], line=1.8)
        cols = [pp['accent'], C.paint('#ff8ac2'), C.paint('#6fe0ff')]
        for k, (ang, ln) in enumerate(((-58, 0.62), (-20, 0.74), (24, 0.6))):
            a = math.radians(ang - 20)
            pts = []
            for i in range(14):
                u = i / 13
                r = 0.12 + ln * u
                pts.append((0.09 + math.sin(a) * r + 0.06 * math.sin(u * 9 + k), -0.02,
                            0.26 + math.cos(a) * r + 0.06 * math.cos(u * 9 + k)))
            tb = P.tube(pts, 0.03, 8, name='streamer')
            P.paint(tb, cols[k], line=1.1)
            _led(pts[-1], 0.055, dict(pp['light'], base=cols[k]['light']))
        top, star = 0.5, (-0.15, -0.25, 0.0)
        # the ring sits on the cone's foot, off to one side
        for i in range(2):
            ln = P.torus(0.07, 0.024, 20, 8, 'link')
            P.xf(ln, scale=(1, 1, 1.35), rot=(90 if i % 2 == 0 else 0, 0, 90 * (i % 2)),
                 loc=(0.32 + 0.03 * i, 0, -0.9 - 0.14 * i))
            P.paint(ln, pp['trim'], line=1.2)
        _ring(0.18, 0.036, (0.38, 0, -1.27), pp['trim'], line=1.5)
        P.glint(star, look.star)
        return dict(kind='flat', roll=-6.0, turn=14.0, tip=10.0)
    elif fob == 'powerbank':      # Power Bank Keyring: a rounded power bank, charge-bar LEDs, a port
        _slab(P.rrect2(0.74, 1.1, 0.16, 5), 0.26, (0, 0.0, -0.05), pp['body'], line=2.4)
        _slab(P.rrect2(0.42, 0.66, 0.08, 4), 0.04, (0, -0.14, 0.02), pp['dark'], line=1.0)
        for k in range(4):
            _bar(0.32, 0.1, (0, -0.17, -0.22 + k * 0.15), pp['light'] if k < 4 else pp['dark'], line=0.6)
        _bar(0.22, 0.06, (0, -0.15, -0.47), pp['dark'], line=0.6)
        _slab(P.rrect2(0.3, 0.12, 0.05, 3), 0.2, (0, 0.0, 0.52), pp['trim'], line=1.6)
        top, star = 0.58, (-0.24, -0.2, 0.32)
    else:
        raise ValueError(f'keyring fob {fob!r}')
    _keyring_top(look, pp, top)
    if star and look.star:
        P.glint(star, look.star)
    return dict(kind='flat', roll=-12.0, turn=14.0, tip=10.0)


def bracelet(look):
    """Abacus Bracelet: a silver bangle threaded with abacus beads, a mint counter bar and a coin tag."""
    pp = _paints(look)
    R = 0.66
    _ring(R, 0.05, (0, 0.02, 0), pp['trim'], line=2.0)
    n = 9
    for k in range(n):
        a = math.radians(200 + 140 * k / (n - 1))
        x, z = R * math.cos(a), R * math.sin(a)
        b = P.lathe([(0.0, -0.09), (0.1, -0.05), (0.13, 0.0), (0.1, 0.05), (0.0, 0.09)], 24, 'bead')
        P.xf(b, rot=(0, -math.degrees(a), 0), loc=(x, -0.02, z))
        # lathe axis Z -> along the band tangent
        P.paint(b, pp['body'] if k % 3 != 1 else pp['accent'], line=1.6)
    for s in (-1, 1):                                    # the counter bars that hold the beads
        a = math.radians(270 + s * 82)
        _slab(P.rrect2(0.08, 0.3, 0.03, 3), 0.12, (R * math.cos(a), -0.02, R * math.sin(a)), pp['trim'], line=1.4,
              rot=-(math.degrees(a) - 90))
    # a coin tag on a jump ring at the top
    _ring(0.06, 0.02, (0.0, 0.0, R + 0.06), pp['trim'], line=1.0)
    _disc(0.2, 0.06, (0.0, -0.02, R + 0.27), pp['trim'], line=1.6)
    _disc(0.13, 0.03, (0.0, -0.06, R + 0.27), pp['accent'], line=0.8)
    if look.star:
        P.glint((-0.38, -0.2, -0.42), look.star)
    return dict(kind='flat', roll=-8.0, turn=14.0, tip=24.0)


# ---------------------------------------------------------------------------
# setbow (ribbon)
# ---------------------------------------------------------------------------

def setbow(look):
    pp = _paints(look)
    body, trim = pp['body'], pp['trim']
    d = look.d
    tails = d.get('tails', 'notched')
    if tails == 'notched':
        for side in (-1, 1):
            K.ribbon_tail(side * 0.18, -0.12, 0.8, 0.3, 0.06, dict(body), notch=0.45, rot=side * -20, line=2.4)
            if d.get('stripes'):
                r = math.radians(side * -20)
                for k in range(d['stripes']):
                    dd = 0.25 + 0.2 * k
                    _bar(0.3, 0.05, (side * 0.18 - math.sin(r) * dd, 0.02, -0.12 - math.cos(r) * dd), pp['stripe'],
                         rot=side * -20, line=0.6)
    elif tails == 'streamers':    # curled paper streamers instead of tails
        cols = [pp['accent'], body, C.paint('#ff8ac2')]
        for k, (x0, ph) in enumerate(((-0.22, 0.0), (0.0, 1.7), (0.22, 3.1))):
            pts = [(x0 + 0.12 * math.sin(i * 0.9 + ph) + (x0 * 0.6) * i / 12, 0.02 + 0.06 * math.cos(i * 0.9 + ph),
                    -0.12 - 0.07 * i) for i in range(13)]
            tb = P.sweep(pts, P.rrect2(0.12, 0.03, 0.012, 2), name='streamer')
            P.paint(tb, cols[k], line=1.4)
    elif tails == 'cable':        # a charging cable for tails, a plug at one end
        pts = [(-0.12, 0.02, -0.1), (-0.3, 0.02, -0.4), (-0.18, 0.02, -0.7), (0.05, 0.02, -0.82), (0.3, 0.02, -0.62),
               (0.42, 0.02, -0.38)]
        tb = P.tube(P.smooth_path(pts, 40), 0.055, 10, name='cable')
        P.paint(tb, body, line=1.8)
        plug = P.rbox(0.16, 0.14, 0.26, r=0.04, seg=2, name='plug')
        P.xf(plug, rot=(0, 35, 0), loc=(0.48, 0.02, -0.26))
        P.paint(plug, pp['white'], line=1.6)
        _bar(0.14, 0.05, (0.52, -0.06, -0.2), pp['light'], rot=35, line=0.6)
    for side in (-1, 1):
        G._loop(side, body)
        fold = P.tube([(side * 0.18, -0.16, 0.05), (side * 0.58, -0.12, 0.05)], 0.035, 8, name='fold')
        P.paint(fold, C.over(body, base=body['shadow'], light=body['shadow']), line=0.0)
        for k in range(d.get('stripes') or 0):         # stripes across the loops
            z = 0.05 + (k - (d['stripes'] - 1) / 2) * 0.16
            _bar(0.5, 0.06, (side * 0.52, -0.16, z), pp['stripe'], rot=side * -6, line=0.6)
    knot = d.get('knot', 'plain')
    front = -0.24
    if knot == 'grille':          # a tiny speaker grille
        k = P.rbox(0.38, 0.38, 0.44, r=0.14, seg=4, name='knot')
        P.xf(k, loc=(0, -0.04, 0.05))
        P.paint(k, trim, line=2.2)
        _slab(P.rrect2(0.26, 0.3, 0.07, 3), 0.04, (0, -0.24, 0.05), pp['dark'], line=1.0)
        for i in range(3):
            for j in range(3):
                _led(((i - 1) * 0.07, -0.27, 0.05 + (j - 1) * 0.08), 0.022, pp['white'] if (i, j) != (1, 1) else pp['light'],
                     line=0.0)
        front = -0.3
    elif knot == 'chalk':         # a chalk-white knot with a coral tag band
        k = P.rbox(0.36, 0.38, 0.44, r=0.14, seg=4, name='knot')
        P.xf(k, loc=(0, -0.04, 0.05))
        P.paint(k, pp['white'], line=2.2)
        _bar(0.4, 0.1, (0, -0.24, 0.05), pp['accent'], line=0.8)
        _led((0.0, -0.27, 0.2), 0.04, pp['light'])
    elif knot == 'protractor':    # a brass protractor arc as the clasp, with a laser dot
        k = P.rbox(0.3, 0.34, 0.4, r=0.12, seg=4, name='knot')
        P.xf(k, loc=(0, -0.02, 0.05))
        P.paint(k, body, line=2.0)
        arc = P.ring_slab([(0.36 * math.cos(math.pi * i / 32), 0.36 * math.sin(math.pi * i / 32)) for i in range(33)] +
                          [(-0.36, -0.02), (0.36, -0.02)],
                          [(0.16 * math.cos(math.pi * i / 32), 0.16 * math.sin(math.pi * i / 32)) for i in range(33)] +
                          [(-0.16, 0.0), (0.16, 0.0)], 0.08, 0.025, 2, name='protractor')
        P.xf(arc, loc=(0, -0.24, -0.06))
        P.paint(arc, trim, line=1.8)
        for i in range(1, 8):
            a = math.pi * i / 8
            K.emboss(P.rrect2(0.02, 0.07, 0.008, 2), 0.015, (0.31 * math.cos(a), -0.29, -0.06 + 0.31 * math.sin(a)),
                     pp['dark'], rot=-(math.degrees(a) - 90), line=0.0)
        _led((0, -0.3, -0.06), 0.05, pp['light'])
        front = -0.3
    elif knot == 'coin':          # a silver coin clasp with a mint centre
        k = P.rbox(0.32, 0.34, 0.4, r=0.12, seg=4, name='knot')
        P.xf(k, loc=(0, -0.02, 0.05))
        P.paint(k, body, line=2.0)
        _disc(0.24, 0.08, (0, -0.22, 0.05), trim, line=1.8)
        _disc(0.15, 0.03, (0, -0.27, 0.05), pp['accent'], line=0.9)
        front = -0.3
    elif knot == 'plug':          # the cable's knot: a plug block with a lime charge band
        k = P.rbox(0.36, 0.36, 0.42, r=0.1, seg=3, name='knot')
        P.xf(k, loc=(0, -0.04, 0.05))
        P.paint(k, pp['white'], line=2.2)
        _bar(0.3, 0.08, (0, -0.23, 0.12), pp['light'], line=0.6)
        _bar(0.3, 0.08, (0, -0.23, -0.02), pp['light'], line=0.6)
    elif knot == 'star':          # a gold star clasp (Party Popper's confetti star)
        k = P.rbox(0.3, 0.34, 0.4, r=0.12, seg=4, name='knot')
        P.xf(k, loc=(0, -0.02, 0.05))
        P.paint(k, body, line=2.0)
        _slab(P.poly_round(P.star2(5, 0.28, 0.13), 0.03, 2), 0.09, (0, -0.22, 0.06), trim, line=1.8)
        front = -0.28
    else:
        k = P.rbox(0.36, 0.38, 0.44, r=0.14, seg=4, name='knot')
        P.xf(k, loc=(0, -0.04, 0.05))
        P.paint(k, trim, line=2.2)
    if look.star:
        P.glint((-0.04, front - 0.06, 0.16), look.star)
    return dict(kind='flat', roll=-8.0, turn=14.0, tip=14.0)


# ---------------------------------------------------------------------------
# setshoe (shoes): the default sneaker's sweeps, as a trainer or a loafer
# ---------------------------------------------------------------------------

def setshoe(look):
    pp = _paints(look)
    d = look.d
    body, trim = pp['body'], pp['trim']
    loafer = d.get('style') == 'loafer'
    G._HI[0] = 0.66 if loafer else 1.0
    SL, SH = G.SHOE_L, G.SOLE_H
    sw, sh, piece, arch, tt = G._shoe_w, G._shoe_h, G._shoe_piece, G._arch, G._shoe_t
    sole_kind = d.get('sole', 'plain')
    sole_p = dict(C.over(pp['light'], glow=0.55), ink=body['ink']) if sole_kind == 'glow' else \
        trim if sole_kind == 'ticks' else pp['white']
    sole = piece(0.0, 1.0, P.rrect2(2.0, 1.0, 0.38, 4, cz=0.5), lambda u: sw(u) * 1.08 + 0.012,
                 lambda u: SH * (1.25 if loafer else 1.0), name='sole')
    P.paint(sole, sole_p, line=2.4)
    side_y = lambda t: -sw(t) * 1.08 - 0.02          # the outer face of the sole
    if sole_kind == 'grid':       # a chalk hopscotch grid along the sole
        for k in range(7):
            t = 0.12 + 0.12 * k
            x = -SL / 2 + SL * t
            K.emboss(P.rrect2(0.016, SH * 0.8, 0.004, 2), 0.02, (x, side_y(t), SH * 0.5 + G._shoe_spring(x)),
                     body, line=0.0)
        stripe = piece(0.04, 0.96, P.rrect2(2.0, 1.0, 0.3, 3, cz=0.5), lambda u: sw(u) * 1.1 + 0.02,
                       lambda u: SH * 0.12, z0=SH * 0.44, name='gridline')
        P.paint(stripe, body, line=0.0)
    elif sole_kind == 'ticks':    # ruler ticks on a brass sole
        for k in range(15):
            t = 0.08 + 0.06 * k
            x = -SL / 2 + SL * t
            hgt = SH * (0.7 if k % 5 == 0 else 0.4)
            K.emboss(P.rrect2(0.014, hgt, 0.005, 2), 0.02, (x, side_y(t), SH * 1.25 - hgt / 2 - 0.02 + G._shoe_spring(x)),
                     pp['dark'], line=0.0)
    elif sole_kind == 'glitter':  # glitter in the sole
        cols = [pp['accent'], C.paint('#ff8ac2'), C.paint('#6fe0ff'), pp['white']]
        for k in range(16):
            t = 0.06 + 0.055 * k
            x = -SL / 2 + SL * t
            K.emboss(P.poly_round(P.star2(4, 0.035, 0.014), 0.004, 1), 0.02,
                     (x, side_y(t), SH * (0.3 + 0.4 * ((k * 7) % 3) / 2) + G._shoe_spring(x)), cols[k % 4], line=0.0)
    upper = piece(0.015, 0.99, arch(), sw, sh, z0=SH - 0.01 + (0.04 if loafer else 0.0), name='upper')
    P.paint(upper, dict(body, sheen=0.25), line=2.6)
    if not loafer:
        cap = piece(0.0, 0.25, arch(), lambda u: sw(u) * 1.045 + 0.006, lambda u: sh(u) * 1.06 + 0.012,
                    z0=SH - 0.02, n=16, name='toecap')
        P.paint(cap, pp['white'] if d.get('toe') != 'body' else body, line=2.0)
    heel = piece(0.8, 1.0, arch(), lambda u: sw(u) * 1.05 + 0.008, lambda u: sh(u) * (0.55 if not loafer else 0.8),
                 z0=SH - 0.02 + (0.04 if loafer else 0.0), n=14, name='heelcounter')
    P.paint(heel, pp['accent'] if d.get('heel') == 'accent' else trim if not loafer else C.over(body, base=body['shadow']),
            line=1.8)
    # the opening: a padded collar on trainers, a wide low throat on loafers
    t_o = 0.74 if loafer else 0.79
    top = SH - 0.01 + sh(0.78) + (0.04 if loafer else 0.0)
    ox, orx = -SL / 2 + SL * t_o, (0.3 if loafer else 0.19)
    ory = sw(t_o) * (0.74 if loafer else 0.66)
    hole = P.slab(P.circle2(orx, 40, rz=ory), 0.04, 0.012, 2, 'opening')
    P.xf(hole, rot=(-90, 0, 0), loc=(ox, 0, top - 0.005))
    dark = C.tone(body['shadow'])['shadow']
    P.paint(hole, C.over(body, base=dark, light=body['shadow'], shadow=dark), line=0.0)
    collar = P.torus(1.0, 0.05 if loafer else 0.06, 48, 10, 'collar')
    P.xf(collar, scale=(orx + 0.035, ory + 0.035, 1.0), loc=(ox, 0, top + 0.01))
    P.paint(collar, C.over(body, sheen=0.0) if not loafer else trim, line=1.8)
    if loafer:                    # the saddle strap across the instep, and its buckle
        strap = piece(0.38, 0.47, arch(), lambda u: sw(u) * 1.04 + 0.01, lambda u: sh(u) * 1.05 + 0.014,
                      z0=SH + 0.03, n=8, name='strap')
        P.paint(strap, pp['strap'], line=1.6)
        t = 0.425
        x = -SL / 2 + SL * t
        if d.get('buckle') == 'coin':
            _disc(0.11, 0.05, (x, -sw(t) * 1.05 - 0.03, SH + sh(t) * 0.55), trim, line=1.4, n=40)
            _disc(0.065, 0.02, (x, -sw(t) * 1.05 - 0.06, SH + sh(t) * 0.55), pp['light'], line=0.6, n=32)
        else:
            _slab(P.rrect2(0.16, 0.1, 0.03, 3), 0.04, (x, -sw(t) * 1.05 - 0.03, SH + sh(t) * 0.55), trim, line=1.2)
            _led((x, -sw(t) * 1.05 - 0.06, SH + sh(t) * 0.55), 0.03, pp['light'], line=0.6)
    else:
        tongue = P.rbox(0.07, ory * 1.5, 0.3, r=0.034, seg=3, name='tongue')
        P.xf(tongue, rot=(0, -28, 0), loc=(ox - orx - 0.02, 0, top + 0.06))
        P.paint(tongue, C.over(body, base=body['light'], light='#ffffff', shadow=body['base']), line=1.8)
        lace_p = pp['accent'] if d.get('laces') == 'accent' else pp['white']
        for lx in (-0.3, -0.16, -0.02):
            t = tt(lx)
            z0 = SH - 0.01 + G._shoe_spring(lx)
            w, h = sw(t), sh(t)
            path = [(lx + 0.015 * (1 - abs(u)), -u * w * 1.02, z0 + h * G._arch_v(u) * 1.02 + 0.012)
                    for u in [-0.62 + 1.24 * i / 10 for i in range(11)]]
            lace = P.tube(path, 0.034, 8, name='lace')
            P.paint(lace, lace_p, line=1.3)
    side = d.get('side', 'none')
    if side == 'chargebars':      # battery bars on the outer side
        for k in range(4):
            t = 0.36 + 0.09 * k
            x = -SL / 2 + SL * t
            _slab(P.rrect2(0.07, 0.07 + 0.035 * k, 0.02, 2), 0.03, (x, -sw(t) * 0.99 - 0.02, SH + 0.1 + 0.0175 * k),
                  pp['light'], line=0.8)
    elif side == 'stripe':        # a tag stripe along the side
        stripe = piece(0.3, 0.72, P.rrect2(2.0, 1.0, 0.3, 3, cz=0.5), lambda u: sw(u) * 1.01 + 0.012,
                       lambda u: 0.05, z0=SH + 0.1, name='sidestripe')
        P.paint(stripe, pp['accent'], line=1.0)
    if look.star:
        P.glint((-0.5, -0.2, SH + 0.28 * G._HI[0]), look.star - 1)
    G._HI[0] = 1.0
    return dict(kind='standing', yaw=-18.0, elev=26.0, roll=-4.0)


# ---------------------------------------------------------------------------
# setclip (hair clip)
# ---------------------------------------------------------------------------

def setclip(look):
    pp = _paints(look)
    body, trim = pp['body'], pp['trim']
    orn = look.d['ornament']
    bar = P.slab(P.rrect2(1.7, 0.26, 0.13, 6), 0.12, 0.045, 3, 'clipbar')
    P.xf(bar, loc=(-0.25, 0.02, 0))
    P.paint(bar, trim, line=2.4)
    inlay = P.slab(P.rrect2(1.3, 0.12, 0.06, 6), 0.03, 0.012, 2, 'inlay')
    P.xf(inlay, loc=(-0.38, -0.05, 0))
    P.paint(inlay, pp['accent'], line=1.0, lift=0.02)
    cx, cz = 0.55, 0.02
    star = (0.45, -0.25, 0.18)
    if orn == 'pompom':
        _pom(0.42, (cx, -0.02, cz), body)
        _led((cx, -0.3, cz), 0.07, pp['light'])
    elif orn == 'button':         # a round pause button
        _disc(0.46, 0.16, (cx, -0.02, cz), trim, line=2.2)
        _disc(0.38, 0.08, (cx, -0.1, cz), body, line=1.4)
        for s in (-1, 1):
            _bar(0.09, 0.32, (cx + s * 0.09, -0.14, cz), pp['accent'], depth=0.05, line=1.0)
    elif orn == 'setsquare':      # a set-square: a right triangle with a triangular window
        tri = [(-0.4, -0.36), (0.48, -0.36), (-0.4, 0.5)]
        outer = P.resample(P.poly_round(tri, 0.06, 4), 60)
        inner = P.resample(P.poly_round([(-0.24, -0.22), (0.18, -0.22), (-0.24, 0.2)], 0.03, 4), 60)
        o = P.ring_slab(outer, inner, 0.12, 0.04, 2, name='setsquare')
        P.xf(o, loc=(cx, -0.04, cz))
        P.paint(o, body, line=2.2)
        for k in range(7):
            x = -0.32 + 0.11 * k
            K.emboss(P.rrect2(0.016, 0.1 if k % 2 == 0 else 0.06, 0.006, 2), 0.02, (cx + x, -0.11, cz - 0.3),
                     trim, line=0.0)
        _led((cx - 0.3, -0.12, cz + 0.36), 0.05, pp['light'])
        star = (cx - 0.25, -0.2, cz - 0.1)
    elif orn == 'confetti':       # a clear capsule filled with confetti
        cap = _slab(P.rrect2(0.8, 0.5, 0.24, 6), 0.18, (cx, -0.04, cz), pp['glass'], line=2.2)
        _slab(P.rrect2(0.86, 0.12, 0.06, 4), 0.2, (cx, -0.02, cz + 0.27), trim, line=1.4)
        cols = [pp['accent'], body, C.paint('#ff8ac2'), C.paint('#6fe0ff')]
        for k in range(10):
            x = -0.3 + 0.067 * k
            z = -0.14 + 0.09 * ((k * 5) % 4)
            K.emboss(P.rrect2(0.07, 0.04, 0.012, 2), 0.02, (cx + x, -0.14, cz + z), cols[k % 4], rot=(k * 47) % 90 - 45,
                     line=0.0)
    elif orn == 'calc':           # a calculator key with an LCD
        _slab(P.rrect2(0.66, 0.78, 0.12, 5), 0.18, (cx, -0.04, cz), trim, line=2.2)
        _slab(P.rrect2(0.5, 0.2, 0.04, 3), 0.04, (cx, -0.14, cz + 0.2), pp['dark'], line=0.9)
        for k in range(3):
            _bar(0.08, 0.035, (cx - 0.12 + 0.11 * k, -0.17, cz + 0.2), pp['light'], line=0.0)
        for i in range(2):
            for j in range(2):
                _slab(P.rrect2(0.18, 0.14, 0.04, 3), 0.05, (cx + (i - 0.5) * 0.24, -0.14, cz - 0.05 - j * 0.19),
                      body if (i, j) != (1, 1) else pp['accent'], line=1.0)
    elif orn == 'bolt':           # a lightning bolt
        bolt = P.poly_round([(0.1, 0.55), (-0.3, -0.02), (-0.02, -0.02), (-0.14, -0.55), (0.32, 0.08), (0.04, 0.08)],
                            0.035, 3)
        _slab(bolt, 0.16, (cx, -0.04, cz), body, line=2.4)
        K.emboss(P.poly_round([(0.05, 0.36), (-0.14, 0.03), (0.0, 0.03)], 0.02, 2), 0.03, (cx, -0.13, cz), pp['light'],
                 line=0.0)
    else:
        raise ValueError(f'setclip ornament {orn!r}')
    if look.star:
        P.glint(star, look.star)
    return dict(kind='flat', roll=-24.0, turn=14.0, tip=12.0)


# ---------------------------------------------------------------------------
# setlocket (necklace)
# ---------------------------------------------------------------------------

def setlocket(look):
    pp = _paints(look)
    body, trim = pp['body'], pp['trim']
    d = look.d
    cord = d.get('cord', 'chain')
    cz, R = 0.64, 0.46
    cord_p = pp['accent'] if cord == 'cord' else trim
    for a0, a1 in ((100.0, 266.0), (274.0, 440.0)):
        path = [(R * math.cos(math.radians(a0 + (a1 - a0) * i / 40)), 0.05,
                 cz + R * 1.05 * math.sin(math.radians(a0 + (a1 - a0) * i / 40))) for i in range(41)]
        ch = P.tube(path, 0.05 if cord == 'cord' else 0.04, 10, name='chain')
        P.paint(ch, cord_p, line=1.6)
    _ring(0.07, 0.028, (0.0, 0.05, cz + R * 1.05 + 0.02), trim, line=1.2)
    bail_z = cz - R * 1.05 - 0.02
    _ring(0.08, 0.03, (0, 0.02, bail_z), trim, line=1.3)
    kind = d['locket']
    pz = bail_z - 0.62                                   # the locket's centre
    star = (-0.15, -0.3, pz + 0.2)
    if kind == 'heart':           # a heart locket with a soft status light
        h = P.heart2(1.0, 0.92)
        _slab(P.offset_outline(h, 0.07), 0.22, (0, 0.02, pz), trim, line=2.4)
        _slab(h, 0.08, (0, -0.1, pz), body, line=1.4)
        K.emboss(P.heart2(0.56, 0.5), 0.03, (0.0, -0.15, pz + 0.02), C.over(body, base=body['light']), line=0.8)
        _led((0.0, -0.18, pz - 0.02), 0.07, pp['light'])
    elif kind == 'timer':         # a round countdown display
        _disc(0.5, 0.2, (0, 0.0, pz), body, line=2.4)
        _slab(P.rrect2(0.6, 0.3, 0.08, 4), 0.04, (0, -0.11, pz), pp['dark'], line=1.0)
        for k, x in enumerate((-0.18, -0.06, 0.08, 0.2)):
            _bar(0.06, 0.16, (x, -0.14, pz), pp['light'], line=0.0)
        _led((0.0, -0.13, pz + 0.0), 0.022, pp['light'], line=0.0)
        ring = P.ring_slab(P.circle2(0.5, 64), P.circle2(0.42, 64), 0.05, 0.015, 2, name='timerring')
        P.xf(ring, loc=(0, -0.11, pz))
        P.paint(ring, pp['white'], line=1.0)
        _bar(0.2, 0.08, (0.0, -0.12, pz - 0.36), pp['accent'], line=0.8)
    elif kind == 'crosshair':     # a round locket with a crosshair window
        _disc(0.5, 0.22, (0, 0.0, pz), trim, line=2.4)
        _disc(0.38, 0.06, (0, -0.12, pz), pp['glass'], line=1.2)
        for rot in (0, 90):
            _bar(0.62, 0.025, (0, -0.16, pz), pp['dark'], rot=rot, line=0.0)
        ring = P.ring_slab(P.circle2(0.2, 48), P.circle2(0.17, 48), 0.02, 0.006, 2, name='reticle')
        P.xf(ring, loc=(0, -0.16, pz))
        P.paint(ring, pp['dark'], line=0.0)
        _led((0.0, -0.18, pz), 0.045, pp['light'])
        _disc(0.12, 0.06, (0.0, 0.0, pz + 0.5), body, line=1.2)     # a slate crown cap
    elif kind == 'party':         # a clear oval locket with tiny lights inside
        oval = P.circle2(0.42, 64, rz=0.52)
        _slab(P.offset_outline(oval, 0.07), 0.22, (0, 0.02, pz), trim, line=2.4)
        _slab(oval, 0.08, (0, -0.1, pz), pp['glass'], line=1.2)
        cols = [pp['light'], C.paint('#ff8ac2', glow=0.7), C.paint('#6fe0ff', glow=0.7), C.paint('#ffffff', glow=0.7)]
        for k, (x, z) in enumerate(((-0.18, 0.2), (0.12, 0.28), (0.2, -0.04), (-0.1, -0.06), (0.04, -0.3), (-0.22, -0.26),
                                    (0.0, 0.08))):
            _led((x, -0.15, pz + z), 0.04 + 0.01 * (k % 2), cols[k % 4], line=0.6)
    elif kind == 'coin':          # a coin locket with a tiny LCD
        _disc(0.5, 0.2, (0, 0.0, pz), trim, line=2.4)
        ring = P.ring_slab(P.circle2(0.44, 64), P.circle2(0.38, 64), 0.03, 0.01, 2, name='coinring')
        P.xf(ring, loc=(0, -0.11, pz))
        P.paint(ring, C.over(trim, base=trim['light']), line=0.8)
        _slab(P.rrect2(0.46, 0.2, 0.05, 3), 0.04, (0, -0.12, pz), pp['dark'], line=0.9)
        for k in range(3):
            _bar(0.08, 0.035, (-0.12 + 0.12 * k, -0.15, pz), pp['light'], line=0.0)
        _bar(0.3, 0.06, (0, -0.12, pz - 0.25), pp['accent'], line=0.6)
    elif kind == 'battery':       # a battery showing a full charge
        _slab(P.rrect2(0.6, 0.92, 0.14, 5), 0.22, (0, 0.0, pz - 0.04), body, line=2.4)
        _slab(P.rrect2(0.26, 0.1, 0.04, 3), 0.18, (0, 0.0, pz + 0.47), trim, line=1.4)
        _slab(P.rrect2(0.42, 0.7, 0.06, 4), 0.04, (0, -0.12, pz - 0.04), pp['dark'], line=0.9)
        for k in range(4):
            _bar(0.34, 0.12, (0, -0.15, pz - 0.3 + 0.17 * k), pp['light'], line=0.4)
    else:
        raise ValueError(f'setlocket locket {kind!r}')
    if look.star:
        P.glint(star, look.star)
    return dict(kind='flat', roll=-10.0, turn=14.0, tip=10.0)


BASES = dict(keyring=keyring, bracelet=bracelet, setbow=setbow, setshoe=setshoe, setclip=setclip, setlocket=setlocket)
