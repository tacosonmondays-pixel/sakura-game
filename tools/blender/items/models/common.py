"""Shared model pieces: embossed blossoms, corner guards, medallions, gems in settings, ribbons.
Every piece is built facing the viewer (-Y) before the pose."""
import parts as P


def emboss(outline, depth, at, paint, rot=0.0, line=1.3, bevel=None, lift=None, name='emboss'):
    """A thin raised motif on a front-facing surface whose front plane is at y = at[1]."""
    o = P.slab(outline, depth, bevel if bevel is not None else depth * 0.45, 2, name)
    P.xf(o, rot=(0, rot, 0), loc=(at[0], at[1] - depth / 2 + depth * 0.15, at[2]))
    return P.paint(o, paint, line=line, lift=depth * 0.9 if lift is None else lift)


def blossom(R, depth, at, paint, rot=0.0, line=1.3, pearl=None, pearl_r=0.22):
    o = emboss(P.blossom2(R, inner=0.40, notch=0.17), depth, at, paint, rot=rot, line=line, name='blossom')
    if pearl:
        p = P.sphere(R * pearl_r, 20, 10, name='pearl', scale=(1, 0.6, 1))
        P.xf(p, loc=(at[0], at[1] - depth * 0.95, at[2]))
        P.paint(p, pearl, line=0.0)
    return o


def corner_guard(cx, cz, front_y, size, depth, corner, paint, line=2.0, shape='tri'):
    """Metal guard on a board corner. corner: 'tr', 'tl', 'br', 'bl'. (cx, cz) = the board corner."""
    sx = -1 if corner[1] == 'r' else 1
    sz = -1 if corner[0] == 't' else 1
    if shape == 'tri':
        pts = [(0, 0), (sx * size, 0), (0, sz * size)]
        pts = P.poly_round(pts, size * 0.12, 3)
    else:   # L bracket
        w = size * 0.28
        pts = [(0, 0), (sx * size, 0), (sx * size, sz * w), (sx * w, sz * w), (sx * w, sz * size), (0, sz * size)]
        pts = P.poly_round(pts, w * 0.35, 3)
    # inset the guard a hair so its rounded edge sits on the board edge
    pts = [(x - sx * 0.006, z - sz * 0.006) for x, z in pts]
    o = P.slab(pts, depth, depth * 0.45, 2, 'guard')
    P.xf(o, loc=(cx, front_y - depth / 2 + depth * 0.3, cz))
    return P.paint(o, paint, line=line, lift=depth * 0.6)


def ring_medallion(R, r_in, depth, at, paint, line=1.6):
    pts = P.circle2(R, 64)
    o = P.slab(pts, depth, depth * 0.45, 3, 'medallion')
    P.xf(o, loc=(at[0], at[1] - depth / 2 + depth * 0.2, at[2]))
    P.paint(o, paint, line=line, lift=depth * 0.7)
    return o


def cut_gem(r, at, paint, sides=8, line=1.4, depth_scale=0.55, name='gem'):
    """A cut gem with its table facing the viewer (-Y)."""
    g = P.gem(r, sides=sides, crown=0.34, table=0.56, pavilion=0.7, name=name)
    P.xf(g, scale=(1, 1, depth_scale), rot=(90, 0, 0), loc=at)
    q = dict(paint)
    q.setdefault('steps', (0.1, 0.84, 0.03))
    q.setdefault('deep_at', -0.35)
    return P.paint(g, q, line=line, lift=0.0, smooth=False)


def ribbon_tail(x, top_z, length, width, y, paint, notch=0.35, rot=0.0, line=1.8):
    pts = [(-width / 2, 0), (width / 2, 0), (width / 2, -length), (0, -length + width * notch), (-width / 2, -length)]
    pts = P.poly_round(pts, width * 0.08, 2)
    o = P.slab(pts, width * 0.18, width * 0.06, 2, 'ribbon')
    P.xf(o, rot=(0, rot, 0), loc=(x, y, top_z))
    return P.paint(o, paint, line=line)


def bar(w, h, at, paint, depth=0.01, line=0.0):
    o = P.slab(P.rrect2(w, h, h * 0.5, 4), depth, depth * 0.4, 2, 'bar')
    P.xf(o, loc=(at[0], at[1] - depth / 2 + depth * 0.1, at[2]))
    return P.paint(o, paint, line=line)
