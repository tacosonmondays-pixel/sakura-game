"""Crowns (crown_*): a thick round band with a rim top and bottom, five round cone prongs (finials or
rounded tips), big gems on the band. Standing pose, low elevation so the inside of the back of the band
shows. Prongs are real volumes (round cones, or thick rounded wedges for the dragon's wings), never flat
plates."""
import math

from mathutils import Matrix

import parts as P
import palette as C

RB = 1.0          # band radius
BH = 0.46         # band height


def band(paint, line=2.6, h=BH, t=0.17):
    prof = P.rrect2(t, h, 0.06, 4)          # (radial, height)
    path = [(RB * math.cos(2 * math.pi * i / 72), RB * math.sin(2 * math.pi * i / 72), 0.0) for i in range(72)]
    o = P.sweep(path, prof, closed=True, up=(0, 0, 1), name='band')
    P.xf(o, loc=(0, 0, h / 2))
    return P.paint(o, paint, line=line)


def rim(paint, z=0.05, r=0.08, line=2.2):
    o = P.torus(RB + 0.04, r, 72, 12, 'rim')
    P.xf(o, loc=(0, 0, z))
    return P.paint(o, paint, line=line)


def prong(theta_deg, w, hgt, paint, base_z=BH, line=2.2, flat=0.5, lean=6.0, concave=1.25):
    """A round cone prong on the band at angle theta (0 = front, -Y): elliptical (flattened radially),
    its base sunk into the band so neighbouring prongs meet in a zigzag."""
    o = P.cone(w / 2, hgt + 0.16, concave=concave, tip=0.1, n=40, name='prong')
    P.xf(o, scale=(1.0, flat, 1.0), rot=(lean, 0, 0), loc=(0, -RB, base_z - 0.16))
    P.matx(o, Matrix.Rotation(math.radians(theta_deg), 4, 'Z'))
    P.paint(o, paint, line=line)
    zs = max(v.co.z for v in o.data.vertices)
    top = [v.co for v in o.data.vertices if v.co.z > zs - 1e-4][0]
    return (top.x, top.y, top.z)


def finial(at, r, paint, line=1.8, up=0.6):
    """A ball on a prong tip (at = the tip point); `up` = how far the ball sits above it, in radii."""
    s = P.sphere(r, 24, 12, 'finial')
    P.xf(s, loc=(at[0], at[1], at[2] + r * up))
    return P.paint(s, paint, line=line)


def band_gem(theta_deg, z, r, paint, sides=6, line=1.4, out=0.11):
    th = math.radians(theta_deg)
    g = P.gem(r, sides=sides, crown=0.3, table=0.6, pavilion=0.5, name='bandgem')
    P.xf(g, scale=(1, 1, 0.6), rot=(90, 0, 0))
    P.xf(g, loc=(0, -(RB + out), z))
    P.matx(g, Matrix.Rotation(th, 4, 'Z'))
    q = dict(paint)
    q.setdefault('steps', (0.1, 0.84, 0.03))
    q.setdefault('deep_at', -0.35)
    return P.paint(g, q, line=line, smooth=False)


TALL = {0: 0.95, -72: 0.85, 72: 0.85, 144: 0.8, 216: 0.8}


def crown(body, finial_p=None, gem_p=None, tall=None, width=0.92, rim_p=None, gems_side=None, elev=12, top_rim=True,
          prong_p=None):
    band(body)
    rim(rim_p or body)
    if top_rim:
        rim(rim_p or body, z=BH - 0.02, r=0.06, line=2.0)
    tall = tall or TALL
    tips = {}
    for th, h in tall.items():
        tips[th] = prong(th, width, h, prong_p or body)
        if finial_p:
            finial(tips[th], 0.1, finial_p)
    spec_tips = tips
    if gem_p:
        band_gem(0, BH / 2, 0.16, gem_p, sides=8)
    for th, p in (gems_side or []):
        band_gem(th, BH / 2, 0.12, p, sides=6)
    return dict(kind='standing', yaw=8, elev=elev, tips=spec_tips)


IRI_CROWN = C.anchored(dict(C.IRI, base='#d9c8fb', light='#f6f0ff', iri=1.0), shadow='#a387e6', deep='#8466d8',
                       ink='#3a1f66', anchor=0.6)
PRONG_IRI = C.anchored(dict(C.IRI, base='#bea6f4', light='#ece4ff', iri=0.45), shadow='#9476e0', deep='#7656cc',
                       ink='#3a1f66', anchor=0.75, base_anchor=0.4)


def rainbow():
    """The approved Rainbow Crown: a thick rainbow band with a rim top and bottom, five round cone prongs
    with pearl finials, three big hexagonal gems."""
    bh = 0.72
    band(IRI_CROWN, h=bh, t=0.22)
    rim(IRI_CROWN, r=0.1)
    rim(IRI_CROWN, z=bh - 0.02, r=0.09, line=2.0)
    tall = {0: 0.98, -72: 0.9, 72: 0.9, 144: 0.84, 216: 0.84}
    tips = [prong(th, 1.45, h, PRONG_IRI, base_z=bh, concave=1.05, flat=0.38) for th, h in tall.items()]
    for tp in tips:
        finial(tp, 0.13, C.PEARL)
    gm = [(-36, C.paint('#a8f0d8', light='#e6fff5', shadow='#5fcfae', ink='#1d5a4a')),
          (0, C.paint('#ffb3d1', light='#ffe6f0', shadow='#f07aa5', ink='#781948')),
          (36, C.paint('#a9d4ff', light='#e5f2ff', shadow='#6aa6ef', ink='#1d3a6b'))]
    for th, p in gm:
        band_gem(th, bh * 0.46, 0.19, p, out=0.15)
    P.glint((-0.7, -0.95, bh + 0.45), 10)
    P.glint((0.3, -1.24, bh * 0.46), 8)
    return dict(kind='standing', yaw=8, elev=15)


def slime():
    jelly = C.paint('#7fe08a', light='#b8f5a0', shadow='#3fbf5f', ink='#1f6a3a', spec=1.0, spec_at=0.975, rim=0.9, glow=0.25,
                    sheen=0.25)
    spec = crown(jelly, finial_p=C.SILVER, tall={0: 0.85, -72: 0.75, 72: 0.75, 144: 0.7, 216: 0.7}, width=0.98, top_rim=False)
    for th in (-40, 25):          # jelly drips on the band
        t = math.radians(th)
        d = P.sphere(0.075, 16, 8, 'drip', scale=(1, 0.8, 1.5))
        P.xf(d, loc=(math.sin(t) * (RB + 0.1), -math.cos(t) * (RB + 0.1), 0.12))
        P.paint(d, jelly, line=1.4)
    P.glint((-0.5, -1.0, BH + 0.5), 10)
    return spec


def iron():
    steel = dict(C.STEEL, sheen=0.15)
    gem = C.paint('#d65a9e', light='#f08cc0', shadow='#a83478', ink='#4e1238', deep='#7e2058', spec=0.8, spec_at=0.99)
    spec = crown(steel, finial_p=None, gem_p=gem, tall={0: 0.8, -72: 0.72, 72: 0.72, 144: 0.68, 216: 0.68}, width=0.9)
    for th in (-55, -30, 30, 55):          # rivets
        t = math.radians(th)
        r = P.sphere(0.045, 12, 6, 'rivet')
        P.xf(r, loc=(math.sin(t) * (RB + 0.09), -math.cos(t) * (RB + 0.09), BH / 2))
        P.paint(r, C.SILVER, line=1.0)
    P.glint((0.14, -1.28, BH * 0.7), 10)
    return spec


BRASS_Y = dict(base='#ecc95a', light='#fbe9a2', shadow='#c69a2a', ink='#5a3a08', spec=1.0, rim=0.6, spec_at=0.985)


def _cog(theta_deg, at, R, paint, teeth=8, line=1.5):
    """A small steel cog standing on a prong tip, facing out from the crown."""
    th = math.radians(theta_deg)
    g = P.slab(P.gear2(R, teeth, 0.28), 0.07, 0.02, 2, 'cogtip')
    h = P.slab(P.circle2(R * 0.32, 20), 0.09, 0.02, 2, 'cogaxle')
    for o, p in ((g, paint), (h, C.over(paint, base=paint['shadow'], light=paint['base']))):
        P.matx(o, Matrix.Rotation(th, 4, 'Z'))
        P.xf(o, loc=(at[0], at[1], at[2] + R * 0.6))
        P.paint(o, p, line=line if o is g else 1.0)


def cog_crown():
    """Clockwork Crown: yellow brass, a gear-toothed band (steel teeth round its middle), steel cogs for
    finials, an aqua clock-face gem."""
    brass = dict(BRASS_Y, sheen=0.15)
    clock = C.paint('#8af0e6', light='#c6fbf5', shadow='#45c7c0', ink='#0f4a5c', deep='#2aa3a8', spec=0.8, spec_at=0.99)
    tall = {0: 0.82, -72: 0.74, 72: 0.74, 144: 0.68, 216: 0.68}
    spec = crown(brass, gem_p=clock, tall=tall)
    steel = dict(C.STEEL, sheen=0.0)
    for i in range(22):               # gear teeth round the band
        th = 360.0 * i / 22 + 8.0
        if abs(((th + 180) % 360) - 180) < 14:
            continue                  # leave room for the clock gem
        t = math.radians(th)
        tooth = P.rbox(0.13, 0.12, 0.17, r=0.035, seg=2, name='tooth')
        P.xf(tooth, loc=(0, -(RB + 0.1), BH / 2))
        P.matx(tooth, Matrix.Rotation(t, 4, 'Z'))
        P.paint(tooth, steel, line=1.3)
    for th, tp in spec['tips'].items():
        _cog(th, tp, 0.17, steel)
    P.glint((-0.12, -1.3, BH * 0.8), 10)
    return spec


def oni():
    lacquer = C.paint('#ff6b6b', light='#ff9d95', shadow='#d63c4c', ink='#5c1a1a', sheen=0.3, spec=0.6, spec_at=0.985)
    ivory = C.paint('#fff6e6', light='#ffffff', shadow='#e8d3b4', ink='#5c3a1a')
    gem = dict(C.TIER_GEM['mythic'], glow=0.6)
    spec = crown(lacquer, gem_p=gem, rim_p=C.ROSE_GOLD, tall={0: 0.8, -72: 0.7, 72: 0.7, 144: 0.66, 216: 0.66}, width=0.86)
    for sx in (-1, 1):
        pts = P.smooth_path([(sx * 0.42, -0.85, BH + 0.1), (sx * 0.55, -0.8, BH + 0.55), (sx * 0.72, -0.75, BH + 0.9)], 16)
        horn = P.sweep(pts, P.circle2(1.0, 12), scales=[0.13 * (1 - i / 16) + 0.012 for i in range(16)], name='horn')
        P.paint(horn, ivory, line=2.0)
    P.glint((0.0, -1.32, BH * 0.5), 11)
    return spec


def dragon():
    """Ashwing Crown: ember orange-red, wing-shaped points as thick rounded wedges, gold rims, a red gem."""
    ember = C.paint('#ff8a4a', light='#ffb882', shadow='#e05a2a', ink='#6a1b1b', sheen=0.2)
    gem = dict(C.paint('#ff5a5a', light='#ff9a9a', shadow='#d02a3a', ink='#5a0f1a', deep='#a01a2a', spec=0.8, spec_at=0.99), glow=0.4)
    band(ember)
    rim(C.GOLD_TRIM)
    rim(C.GOLD_TRIM, z=BH - 0.02, r=0.06, line=2.0)
    for th, h in ((0, 1.0), (-72, 0.88), (72, 0.88), (144, 0.8), (216, 0.8)):
        n = 10
        pts = []
        w = 0.92
        for i in range(n + 1):
            u = i / n
            pts.append((-w / 2 + w * 0.15 * u + 0.08 * math.sin(math.pi * u * 3) * (1 - u), -0.12 + u * h))
        for i in range(1, n):
            u = 1 - i / n
            pts.append((w / 2 * (1 - u) + 0.05 * math.sin(math.pi * u), -0.12 + u * h * (0.82 + 0.18 * u)))
        o = P.slab(P.poly_round(pts, 0.04, 2), 0.2, 0.085, 4, 'wing')
        P.xf(o, rot=(5, 0, 0), loc=(0, -RB + 0.02, BH))
        P.matx(o, Matrix.Rotation(math.radians(th), 4, 'Z'))
        P.paint(o, ember, line=2.2)
    band_gem(0, BH / 2, 0.16, gem, sides=8)
    P.glint((0.0, -1.32, BH * 0.5), 13)
    P.glint((-0.55, -1.0, BH + 0.7), 8)
    return dict(kind='standing', yaw=8, elev=12)


# the shard keeps a deeper lilac-pink shadow plane, so it holds its value range on the white tile
SHARD_BAND = C.anchored(dict(C.IRI, base='#dccbfb', light='#f6f0ff', iri=0.9), shadow='#a46ad0', deep='#8a50c0',
                        ink='#3a1f66', anchor=0.85, base_anchor=0.2)
SHARD_PRONG = C.anchored(dict(C.IRI, base='#c4aaf6', light='#ece4ff', iri=0.45), shadow='#8a5cd6', deep='#7044c4',
                         ink='#3a1f66', anchor=0.9, base_anchor=0.45)
SHARD_BREAK = C.paint('#f3eaff', light='#ffffff', shadow='#c9b2f2', ink='#3a1f66', rim=0.0)


def rainbow_shard():
    """A piece broken out of the Rainbow Crown: a jagged chunk of the iridescent band with its rims, one whole
    round cone prong and one snapped off at an angle (no ball tips), a pink gem on the band between them."""
    chunk = [(-0.86, -0.4), (-0.7, -0.46), (-0.38, -0.44), (0.1, -0.46), (0.52, -0.42), (0.62, -0.3), (0.5, -0.2),
             (0.68, -0.08), (0.56, 0.02), (0.6, 0.12), (-0.66, 0.12), (-0.78, 0.0), (-0.64, -0.12), (-0.84, -0.22)]
    b = P.slab(P.poly_round(chunk, 0.03, 2), 0.28, 0.09, 3, 'bandchunk')
    P.xf(b, loc=(0.0, 0.02, 0.0))
    P.paint(b, SHARD_BAND, line=2.5)
    for z, rr in ((0.1, 0.06), (-0.4, 0.07)):          # the band's rims, broken off with it
        rim_ = P.tube([(-0.62 if z > 0 else -0.7, -0.13, z), (0.5 if z > 0 else 0.46, -0.13, z)], rr, 12, name='rim')
        P.paint(rim_, SHARD_BAND, line=1.8)
    whole = P.cone(0.36, 1.22, concave=1.2, tip=0.12, n=40, name='prong')
    P.xf(whole, scale=(1.0, 0.6, 1.0), rot=(0, -6, 0), loc=(-0.34, 0.0, 0.0))
    P.paint(whole, SHARD_PRONG, line=2.5)
    snapped = P.cone(0.34, 1.1, concave=1.2, tip=0.12, n=40, name='prong')
    P.xf(snapped, scale=(1.0, 0.6, 1.0), rot=(0, 8, 0), loc=(0.3, 0.0, 0.0))
    P.cut(snapped, (0.36, 0.0, 0.6), (-0.45, -0.25, 0.86))           # an angled break, its face toward the light
    P.paint(snapped, SHARD_PRONG, line=2.5)
    g = P.gem(0.15, sides=6, crown=0.3, table=0.6, pavilion=0.5)
    P.xf(g, scale=(1, 1, 0.6), rot=(90, 0, 0), loc=(-0.02, -0.17, -0.16))
    P.paint(g, C.paint('#ffb3d1', light='#ffe6f0', shadow='#f07aa5', ink='#781948', deep='#e05a92'), steps=(0.4, 0.86, 0.02),
            deep_at=-0.2, line=1.3, smooth=False)
    P.glint((-0.5, -0.2, 0.75), 10, edge=True)
    return dict(kind='flat', roll=-12.0, turn=18.0, tip=14.0)


def build(row):
    k = row['key']
    table = dict(crown_rainbow=rainbow, crown_slime=slime, crown_iron=iron, crown_cog=cog_crown, crown_oni=oni,
                 crown_dragon=dragon, crown_rainbow_shard=rainbow_shard)
    return table[k]()
