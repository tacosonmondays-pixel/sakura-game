"""Crowns (crown_*): a round band with five points and ball finials, gems on the band. Standing pose,
low elevation so the inside of the back of the band shows."""
import math

from mathutils import Matrix

import parts as P
import palette as C

RB = 1.0          # band radius
BH = 0.42         # band height


def band(paint, line=2.6, h=BH, t=0.13):
    prof = P.rrect2(t, h, 0.05, 4)          # (radial, height)
    path = [(RB * math.cos(2 * math.pi * i / 72), RB * math.sin(2 * math.pi * i / 72), 0.0) for i in range(72)]
    o = P.sweep(path, prof, closed=True, up=(0, 0, 1), name='band')
    P.xf(o, loc=(0, 0, h / 2))
    return P.paint(o, paint, line=line)


def spike(theta_deg, w, hgt, paint, base_z=BH, line=2.2, concave=0.18, t=0.1):
    """A flat crown point tangent to the band at angle theta (0 = front, -Y)."""
    n = 14
    pts = []
    for i in range(n + 1):           # left edge, base to apex, concave
        u = i / n
        x = -w / 2 * (1 - u) + concave * w * math.sin(math.pi * u) * 0.5
        pts.append((x, -0.06 + u * hgt))
    for i in range(1, n):
        u = 1 - i / n
        x = w / 2 * (1 - u) - concave * w * math.sin(math.pi * u) * 0.5
        pts.append((x, -0.06 + u * hgt))
    pts = [(p[0], p[1]) for p in pts]
    o = P.slab(pts, t, t * 0.4, 2, 'spike')
    th = math.radians(theta_deg)
    # tangent plane at the band: front of the slab faces outward
    P.xf(o, loc=(0, -RB, base_z))
    m = Matrix.Rotation(th, 4, 'Z')
    P.matx(o, m)
    return P.paint(o, paint, line=line)


def finial(theta_deg, z, r, paint, line=1.8):
    th = math.radians(theta_deg)
    s = P.sphere(r, 24, 12, 'finial')
    P.xf(s, loc=(math.sin(th) * RB, -math.cos(th) * RB, z))
    return P.paint(s, paint, line=line)


def band_gem(theta_deg, z, r, paint, sides=6, line=1.4, out=0.08):
    th = math.radians(theta_deg)
    g = P.gem(r, sides=sides, crown=0.3, table=0.6, pavilion=0.5, name='bandgem')
    P.xf(g, scale=(1, 1, 0.6), rot=(90, 0, 0))
    P.xf(g, loc=(0, -(RB + out), z))
    P.matx(g, Matrix.Rotation(th, 4, 'Z'))
    q = dict(paint)
    q.setdefault('steps', (0.1, 0.84, 0.03))
    q.setdefault('deep_at', -0.35)
    return P.paint(g, q, line=line, smooth=False)


def rim(paint, z=0.05, r=0.075, line=2.2):
    o = P.torus(RB + 0.03, r, 72, 12, 'rim')
    P.xf(o, loc=(0, 0, z))
    return P.paint(o, paint, line=line)


IRI_CROWN = dict(C.IRI, base='#d9c8fb', light='#f6f0ff', shadow='#a58ce8', iri=0.7)
SPIKE_IRI = dict(C.IRI, base='#c6b0f7', light='#ece4ff', shadow='#9277e0', iri=0.45)


def rainbow():
    band(dict(IRI_CROWN, iri=1.0), h=0.5)
    rim(dict(IRI_CROWN, iri=1.0), r=0.085)
    tall = {0: 1.3, -72: 1.2, 72: 1.2, 144: 1.12, 216: 1.12}
    for th, h in tall.items():           # wide points that meet at the base: one filled zigzag, like the approved crown
        spike(th, 1.28, h, SPIKE_IRI, base_z=0.5, concave=0.24, t=0.12)
    for th, h in tall.items():
        finial(th, 0.5 + h - 0.04, 0.115, C.PEARL)
    gm = [(-40, C.paint('#a8f0d8', light='#e6fff5', shadow='#5fcfae', ink='#1d5a4a')),
          (0, C.paint('#ffb3d1', light='#ffe6f0', shadow='#f07aa5', ink='#781948')),
          (40, C.paint('#a9d4ff', light='#e5f2ff', shadow='#6aa6ef', ink='#1d3a6b'))]
    for th, p in gm:
        band_gem(th, 0.25, 0.11, p)
    P.glint((-0.62, -0.95, 0.85), 10)
    P.glint((0.35, -1.1, 0.25), 8)
    return dict(kind='standing', yaw=8, elev=9)


def crown(body, finial_p=None, gem_p=None, tall=None, width=1.0, rim_p=None, gems_side=None, elev=12):
    band(body)
    rim(rim_p or body)
    tall = tall or {0: 0.95, -72: 0.85, 72: 0.85, 144: 0.8, 216: 0.8}
    for th, h in tall.items():
        spike(th, width, h, body)
        if finial_p:
            finial(th, BH + h - 0.04, 0.1, finial_p)
    if gem_p:
        band_gem(0, BH / 2, 0.14, gem_p, sides=8)
    for th, p in (gems_side or []):
        band_gem(th, BH / 2, 0.09, p, sides=6)
    return dict(kind='standing', yaw=8, elev=elev)


def slime():
    jelly = C.paint('#7fe08a', light='#b8f5a0', shadow='#3fbf5f', ink='#1f6a3a', spec=1.0, spec_at=0.975, rim=0.9, glow=0.25, sheen=0.25)
    spec = crown(jelly, finial_p=C.SILVER, tall={0: 0.85, -72: 0.75, 72: 0.75, 144: 0.7, 216: 0.7}, width=1.05)
    # jelly drips on the band
    for th in (-40, 25):
        t = math.radians(th)
        d = P.sphere(0.07, 16, 8, 'drip', scale=(1, 0.8, 1.5))
        P.xf(d, loc=(math.sin(t) * (RB + 0.06), -math.cos(t) * (RB + 0.06), 0.1))
        P.paint(d, jelly, line=1.4)
    P.glint((-0.5, -1.0, BH + 0.5), 10)
    return spec


def iron():
    steel = dict(C.STEEL, sheen=0.15)
    gem = C.paint('#d65a9e', light='#f08cc0', shadow='#a83478', ink='#4e1238', deep='#7e2058', spec=0.8, spec_at=0.99)
    spec = crown(steel, finial_p=None, gem_p=gem, tall={0: 0.8, -72: 0.72, 72: 0.72, 144: 0.68, 216: 0.68}, width=1.0)
    for th in (-55, -30, 30, 55):          # rivets
        t = math.radians(th)
        r = P.sphere(0.04, 12, 6, 'rivet')
        P.xf(r, loc=(math.sin(t) * (RB + 0.07), -math.cos(t) * (RB + 0.07), BH / 2))
        P.paint(r, C.SILVER, line=1.0)
    P.glint((0.12, -1.25, BH * 0.7), 10)
    return spec


def cog_crown():
    brass = dict(C.BRASS, sheen=0.15)
    clock = C.paint('#8af0e6', light='#c6fbf5', shadow='#45c7c0', ink='#0f4a5c', deep='#2aa3a8', spec=0.8, spec_at=0.99)
    spec = crown(brass, gem_p=clock, tall={0: 0.85, -72: 0.75, 72: 0.75, 144: 0.7, 216: 0.7})
    for th, h in ((-72, 0.75), (72, 0.75)):
        t = math.radians(th)
        g = P.slab(P.gear2(0.16, 8, 0.25), 0.05, 0.015, 2, 'smallcog')
        P.matx(P.xf(g, loc=(0, -RB - 0.05, BH + h - 0.05)), Matrix.Rotation(t, 4, 'Z'))
        P.paint(g, C.STEEL, line=1.5)
    P.glint((-0.1, -1.25, BH * 0.75), 10)
    return spec


def oni():
    lacquer = C.paint('#ff6b6b', light='#ff9d95', shadow='#d63c4c', ink='#5c1a1a', sheen=0.3, spec=0.6, spec_at=0.985)
    ivory = C.paint('#fff6e6', light='#ffffff', shadow='#e8d3b4', ink='#5c3a1a')
    gem = dict(C.TIER_GEM['mythic'], glow=0.6)
    spec = crown(lacquer, gem_p=gem, rim_p=C.ROSE_GOLD, tall={0: 0.8, -72: 0.7, 72: 0.7, 144: 0.66, 216: 0.66})
    for sx in (-1, 1):
        pts = P.smooth_path([(sx * 0.42, -0.85, BH + 0.1), (sx * 0.55, -0.8, BH + 0.55), (sx * 0.72, -0.75, BH + 0.9)], 16)
        horn = P.sweep(pts, P.circle2(1.0, 12), scales=[0.13 * (1 - i / 16) + 0.012 for i in range(16)], name='horn')
        P.paint(horn, ivory, line=2.0)
    P.glint((0.0, -1.3, BH * 0.5), 11)
    return spec


def dragon():
    ember = C.paint('#ff9a4d', light='#ffc285', shadow='#e06a2a', ink='#6a1b1b', sheen=0.2)
    gem = dict(C.paint('#ff5a5a', light='#ff9a9a', shadow='#d02a3a', ink='#5a0f1a', deep='#a01a2a', spec=0.8, spec_at=0.99), glow=0.4)
    band(ember)
    rim(C.GOLD_TRIM)
    # wing-shaped points: swept, scalloped spikes leaning outward
    for th, h in ((0, 1.0), (-72, 0.88), (72, 0.88), (144, 0.8), (216, 0.8)):
        n = 10
        pts = []
        w = 1.0
        for i in range(n + 1):
            u = i / n
            pts.append((-w / 2 + w * 0.15 * u + 0.08 * math.sin(math.pi * u * 3) * (1 - u), -0.06 + u * h))
        for i in range(1, n):
            u = 1 - i / n
            pts.append((w / 2 * (1 - u) + 0.05 * math.sin(math.pi * u), -0.06 + u * h * (0.82 + 0.18 * u)))
        o = P.slab(pts, 0.1, 0.04, 2, 'wing')
        P.xf(o, loc=(0, -RB, BH))
        P.matx(o, Matrix.Rotation(math.radians(th), 4, 'Z'))
        P.paint(o, ember, line=2.2)
    band_gem(0, BH / 2, 0.15, gem, sides=8)
    P.glint((0.0, -1.3, BH * 0.5), 13)
    P.glint((-0.55, -1.0, BH + 0.7), 8)
    return dict(kind='standing', yaw=8, elev=12)


def rainbow_shard():
    """One iridescent crown point with a pearl finial and a facetted break at its base."""
    iri = IRI_CROWN
    pts = []
    n = 10
    for i in range(n):                        # concave left edge, base to tip
        u = i / n
        pts.append((-0.6 * (1 - u) + 0.14 * math.sin(math.pi * u) * 0.5, u * 1.5))
    pts.append((0.0, 1.5))
    for i in range(1, n + 1):                 # right edge, tip to base
        u = 1 - i / n
        pts.append((0.6 * (1 - u) - 0.14 * math.sin(math.pi * u) * 0.5, u * 1.5))
    pts += [(0.38, -0.13), (0.16, 0.02), (-0.06, -0.17), (-0.3, -0.03), (-0.46, -0.15)]   # facetted break
    o = P.fan_gem(pts, 0.24, 0.16, spine=[(0.0, 0.0, 0.16), (0.0, 0.7, 0.16), (0.0, 1.3, 0.1)], name='shard')
    P.paint(o, iri, steps=(0.35, 0.86, 0.02), deep_at=-0.2, line=2.6)
    # the piece of band it broke off with: a curved chunk with a jagged right end
    chunk = [(-0.78, -0.42), (0.42, -0.42), (0.56, -0.3), (0.44, -0.2), (0.6, -0.08), (0.48, 0.04), (-0.78, 0.04)]
    b = P.slab(P.poly_round(chunk, 0.04, 2), 0.22, 0.08, 3, 'bandchunk')
    P.xf(b, loc=(0.0, 0.06, -0.06))
    P.paint(b, iri, line=2.4)
    bg = P.gem(0.09, sides=6, crown=0.3, table=0.6, pavilion=0.5)
    P.xf(bg, scale=(1, 1, 0.6), rot=(90, 0, 0), loc=(-0.4, -0.08, -0.19))
    P.paint(bg, C.paint('#a8f0d8', light='#e6fff5', shadow='#5fcfae', ink='#1d5a4a'), steps=(0.4, 0.86, 0.02), deep_at=-0.2,
            line=1.2, smooth=False)
    f = P.sphere(0.16, 24, 12, 'finial')
    P.xf(f, loc=(0.0, 0.0, 1.55))
    P.paint(f, C.PEARL, line=2.0)
    g = P.gem(0.1, sides=6, crown=0.3, table=0.6, pavilion=0.5)
    P.xf(g, scale=(1, 1, 0.6), rot=(90, 0, 0), loc=(0, -0.2, 0.45))
    P.paint(g, C.paint('#ffb3d1', light='#ffe6f0', shadow='#f07aa5', ink='#781948'), steps=(0.4, 0.86, 0.02), deep_at=-0.2, line=1.3, smooth=False)
    P.glint((-0.2, -0.2, 1.2), 10)
    return dict(kind='flat', roll=-16.0, turn=18.0, tip=14.0)


def build(row):
    k = row['key']
    table = dict(crown_rainbow=rainbow, crown_slime=slime, crown_iron=iron, crown_cog=cog_crown, crown_oni=oni,
                 crown_dragon=dragon, crown_rainbow_shard=rainbow_shard)
    return table[k]()
