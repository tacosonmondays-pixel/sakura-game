"""Head accessories per look.accessory."""
import math
from mathutils import Vector

from . import mesh as M
from .colors import mix, darken, lighten
from .outfit import bow
from .hair import HAIR_TOP

WHITE = '#f7f7fb'


def build(ctx):
    acc = ctx['look'].get('accessory', 'none')
    fn = ACCESSORIES.get(acc)
    if not fn:
        return []
    parts = fn(ctx)
    ctx['parts'] += parts
    return parts


def ribbon(ctx):
    H = ctx['H']
    c = H.surf(55, 44, HAIR_TOP + 0.02)
    return bow((c.x, c.y, c.z), ctx['pal']['accent'], size=0.045, bone='head', tails=True)


def bunny_ears(ctx):
    H = ctx['H']
    pal = ctx['pal']
    parts = []
    for s in (1, -1):
        base = H.surf(s * 35, 62, HAIR_TOP - 0.04)
        pts = [base, base + Vector((s * 0.015, -0.005, 0.07)), base + Vector((s * 0.035, -0.01, 0.15)), base + Vector((s * 0.06, -0.02, 0.21)), base + Vector((s * 0.085, -0.03, 0.245))]
        v, f, r = M.tube(pts, [(0.03, 0.02), (0.036, 0.022), (0.036, 0.022), (0.03, 0.02), (0.001, 0.001)], sides=6, tip_end=True, up=Vector((0, -1, 0)), squash=0.3)
        e = M.new_object(f'bunny{s}', v, f, color=WHITE, bone='head')
        M.crease(e, M.tip_edges(r), 1.0)
        M.finish(e, levels=1)
        parts.append(e)
        v, f, r = M.tube([p + Vector((0, -0.012, 0)) for p in pts[1:4]], [(0.016, 0.008), (0.018, 0.008), (0.012, 0.006)], sides=6, up=Vector((0, -1, 0)))
        i = M.new_object(f'bunny_in{s}', v, f, color=pal['accent'], bone='head')
        M.finish(i, levels=1)
        parts.append(i)
    return parts


def cat_ears(ctx):
    return _animal_ears(ctx, 0.075, 0.07, ctx['pal']['hair'], mix(ctx['pal']['accent'], '#ffffff', 0.4), az=52, el=52)


def fox_ears(ctx):
    return _animal_ears(ctx, 0.095, 0.085, ctx['pal']['hair'], WHITE, az=48, el=50)


def _animal_ears(ctx, height, width, color, inner, az, el):
    H = ctx['H']
    parts = []
    for s in (1, -1):
        base = H.surf(s * az, el, HAIR_TOP - 0.05)
        n = H.normal(s * az, el)
        tip = base + n * height * 0.55 + Vector((s * width * 0.3, -0.01, height * 0.75))
        pts = [base - n * 0.02, base + n * 0.01, base.lerp(tip, 0.55) + n * 0.01, tip]
        v, f, r = M.tube(pts, [(width * 0.55, 0.02), (width * 0.5, 0.022), (width * 0.3, 0.016), (0.001, 0.001)], sides=6, tip_end=True, up=Vector((0, -1, 0)))
        e = M.new_object(f'ear{s}', v, f, color=color, bone='head')
        M.crease(e, M.tip_edges(r), 1.0)
        M.finish(e, levels=2)
        parts.append(e)
        pts2 = [p + Vector((0, -0.012, 0)) for p in pts[1:]]
        v, f, r = M.tube(pts2, [(width * 0.3, 0.008), (width * 0.18, 0.007), (0.001, 0.001)], sides=6, tip_end=True, up=Vector((0, -1, 0)))
        i = M.new_object(f'earin{s}', v, f, color=inner, bone='head')
        M.crease(i, M.tip_edges(r), 1.0)
        M.finish(i, levels=1)
        parts.append(i)
    return parts


def hairpin(ctx):
    H = ctx['H']
    c = H.surf(-48, 24, HAIR_TOP)
    pts = []
    for i in range(10):
        a = i / 10 * math.pi * 2
        rr = 0.022 if i % 2 == 0 else 0.009
        pts.append((math.cos(a) * rr, math.sin(a) * rr))
    v, f = M.plate(pts, 0.008, center=(c.x, c.y, c.z), plane='xz')
    o = M.new_object('hairpin', v, f, color=ctx['pal']['accent'], bone='head')
    M.finish(o, levels=1)
    v, f, r = M.tube([c + Vector((0.0, 0.0, -0.005)), c + Vector((-0.03, 0.005, -0.035))], 0.004, sides=6)
    p = M.new_object('pin', v, f, color=lighten(ctx['pal']['accent'], 0.4), bone='head')
    M.finish(p, levels=1)
    return [o, p]


def beret(ctx):
    from mathutils import Matrix
    H = ctx['H']
    c = H.surf(-40, 58, HAIR_TOP - 0.03)
    col = ctx['pal']['accent']
    # a soft puffed disc that sits on one side of the head, tilted down towards that side
    v, f = M.sphere((0, 0, 0), (H.R.x * 0.78, H.R.y * 0.72, 0.058))
    v = [(x, y, z * (0.5 if z < 0 else 1.0)) for x, y, z in v]
    o = M.new_object('beret', v, f, color=col, bone='head')
    M.finish(o, levels=1)
    tilt = Matrix.Rotation(math.radians(28), 4, 'Y') @ Matrix.Rotation(math.radians(6), 4, 'X')
    o.data.transform(Matrix.Translation(c) @ tilt)
    o.data.update()
    v, f = M.sphere((0, 0, 0.062), (0.012, 0.012, 0.012))
    t = M.new_object('beret_top', v, f, color=darken(col, 0.3), bone='head')
    M.finish(t, levels=1)
    t.data.transform(Matrix.Translation(c) @ tilt)
    t.data.update()
    # band under the beret
    v, f, r = M.tube([Vector((0, 0, -0.03)), Vector((0, 0, -0.016))], (H.R.x * 0.7, H.R.y * 0.66), sides=12)
    b = M.new_object('beret_band', v, f, color=darken(col, 0.25), bone='head')
    M.finish(b, levels=1)
    b.data.transform(Matrix.Translation(c) @ tilt)
    b.data.update()
    return [o, t, b]


def witch_hat(ctx):
    H = ctx['H']
    pal = ctx['pal']
    ctx['halo_lift'] = 0.14
    top = H.surf(0, 90, HAIR_TOP - 0.02)
    base = Vector((top.x, top.y + 0.01, top.z - 0.01))
    col = pal['outfit']
    # brim
    v, f, r = M.lathe([(H.R.x * 1.45, 0.0), (H.R.x * 1.15, 0.012), (H.R.x * 0.9, 0.02)], segments=14, close_top=True, close_bottom=True, center=(base.x, base.y, base.z - 0.015), scale_xy=(1.0, 1.05))
    b = M.new_object('brim', v, f, color=col, bone='head')
    M.finish(b, levels=2)
    # cone, bent back
    pts = [base, base + Vector((0, 0.0, 0.07)), base + Vector((0, 0.02, 0.14)), base + Vector((0.01, 0.06, 0.2)), base + Vector((0.03, 0.11, 0.23))]
    v, f, rr = M.tube(pts, [H.R.x * 0.88, H.R.x * 0.65, H.R.x * 0.42, H.R.x * 0.2, 0.001], sides=8, tip_end=True)
    c = M.new_object('cone', v, f, color=col, bone='head')
    M.crease(c, M.tip_edges(rr), 1.0)
    M.finish(c, levels=2)
    # band
    v, f, r = M.tube([base + Vector((0, 0, 0.012)), base + Vector((0, 0, 0.035))], (H.R.x * 0.86, H.R.y * 0.9), sides=10)
    band = M.new_object('hatband', v, f, color=pal['accent'], bone='head')
    M.finish(band, levels=1)
    return [b, c, band]


def horns(ctx):
    H = ctx['H']
    parts = []
    col = mix(ctx['pal']['accent'], '#ffffff', 0.15)
    for s in (1, -1):
        base = H.surf(s * 42, 50, HAIR_TOP - 0.05)
        n = H.normal(s * 42, 50)
        pts = [base - n * 0.01, base + n * 0.03, base + n * 0.05 + Vector((s * 0.01, -0.02, 0.03)), base + n * 0.05 + Vector((s * 0.02, -0.05, 0.065))]
        v, f, r = M.tube(pts, [0.024, 0.02, 0.013, 0.001], sides=6, tip_end=True)
        h = M.new_object(f'horn{s}', v, f, color=col, bone='head')
        M.crease(h, M.tip_edges(r), 1.0)
        M.finish(h, levels=2)
        parts.append(h)
    return parts


def flower(ctx):
    H = ctx['H']
    c = H.surf(58, 30, HAIR_TOP + 0.01)
    n = H.normal(58, 30)
    col = ctx['pal']['accent']
    parts = []
    # 5 petals around the centre, in the plane tangent to the head
    t1 = n.cross(Vector((0, 0, 1))).normalized()
    t2 = n.cross(t1).normalized()
    for i in range(5):
        a = i / 5 * math.pi * 2
        d = t1 * math.cos(a) + t2 * math.sin(a)
        pc = c + d * 0.022
        v, f = M.sphere(pc, (0.02, 0.02, 0.02))
        v = [tuple(Vector(p) - n * (0.012 * (1 - (Vector(p) - pc).length / 0.03))) for p in v]
        p = M.new_object(f'petal{i}', v, f, color=col, bone='head')
        M.finish(p, levels=1)
        parts.append(p)
    v, f = M.sphere(c + n * 0.01, (0.013, 0.013, 0.013))
    k = M.new_object('flower_center', v, f, color='#ffe47a', bone='head')
    M.finish(k, levels=1)
    parts.append(k)
    return parts


def goggles(ctx):
    H = ctx['H']
    pal = ctx['pal']
    parts = []
    # strap around the head at the forehead line
    z = H.c.z + H.R.z * 0.42
    v, f, r = M.tube([Vector((H.c.x, H.c.y, z - 0.02)), Vector((H.c.x, H.c.y, z + 0.02))], (H.R.x * (1 + HAIR_TOP - 0.01), H.R.y * (1 + HAIR_TOP - 0.01)), sides=12)
    s = M.new_object('strap', v, f, color=darken(pal['accent'], 0.35), bone='head')
    M.finish(s, levels=1)
    parts.append(s)
    for sgn in (1, -1):
        c = H.surf(sgn * 22, 40, HAIR_TOP)
        n = H.normal(sgn * 22, 40)
        v, f, r = M.tube([c - n * 0.01, c + n * 0.016], (0.034, 0.03), sides=8)
        g = M.new_object(f'goggle{sgn}', v, f, color=pal['accent'], bone='head')
        M.finish(g, levels=1)
        parts.append(g)
        v, f, r = M.tube([c + n * 0.008, c + n * 0.022], (0.026, 0.022), sides=8)
        l = M.new_object(f'lens{sgn}', v, f, color=lighten(pal['eyes'], 0.3), bone='head')
        M.finish(l, levels=1)
        parts.append(l)
    return parts


def hood(ctx):
    # the outfit's hood (hoodie/robe) already adds one; this is a drawn-up hood for other outfits
    H = ctx['H']
    pal = ctx['pal']
    c = Vector((H.c.x, H.c.y + H.R.y * 0.12, H.c.z + H.R.z * 0.05))
    v, f = M.sphere(c, (H.R.x * 1.24, H.R.y * 1.2, H.R.z * 1.24))
    # open the front: keep only vertices with y >= -0.2 (push the front ones back)
    v = [(x, y if y > c.y - H.R.y * 0.35 else c.y - H.R.y * 0.35 + (y - (c.y - H.R.y * 0.35)) * 0.15, z) for x, y, z in v]
    o = M.new_object('hood_up', v, f, color=pal['outfit'] if pal['outfit'] != '#ffffff' else pal['outfitShade'], bone='head')
    M.finish(o, levels=2)
    return [o]


def headband(ctx):
    H = ctx['H']
    pal = ctx['pal']
    pts = []
    for i in range(9):
        az = -75 + 150 * i / 8
        pts.append(H.surf(az + 180, 52 - 32 * math.cos(math.radians(az)) ** 2 * 0 - 0, 0.105))
    # band across the top from ear to ear
    pts = [H.surf(az, 20 + 60 * (1 - abs(az) / 90), HAIR_TOP) for az in (-88, -60, -30, 0, 30, 60, 88)]
    v, f, r = M.tube(pts, (0.022, 0.012), sides=6, up=Vector((0, -1, 0)))
    o = M.new_object('headband', v, f, color=pal['accent'], bone='head')
    M.finish(o, levels=2)
    parts = [o]
    c = H.surf(-40, 40, HAIR_TOP + 0.02)
    parts += bow((c.x, c.y, c.z), pal['accent'], size=0.03, bone='head', tails=False)
    return parts


def crown(ctx):
    H = ctx['H']
    pal = ctx['pal']
    col = '#ffd45e'
    top = H.surf(0, 90, HAIR_TOP)
    base = Vector((top.x, top.y + 0.02, top.z - 0.02))
    r = H.R.x * 0.55
    # ring
    v, f, rr = M.tube([base + Vector((0, 0, -0.005)), base + Vector((0, 0, 0.022))], (r, r * 0.9), sides=10)
    ring = M.new_object('crown_ring', v, f, color=col, bone='head')
    M.finish(ring, levels=1)
    parts = [ring]
    for i in range(5):
        a = i / 5 * math.pi * 2 + math.pi / 2
        p = base + Vector((math.cos(a) * r, math.sin(a) * r * 0.9, 0.02))
        v, f, rr = M.tube([p, p + Vector((0, 0, 0.03)), p + Vector((0, 0, 0.05))], [0.012, 0.009, 0.001], sides=5, tip_end=True)
        s = M.new_object(f'crown_spike{i}', v, f, color=col, bone='head')
        M.crease(s, M.tip_edges(rr), 1.0)
        M.finish(s, levels=1)
        parts.append(s)
    v, f = M.sphere(base + Vector((0, -r * 0.9, 0.012)), (0.011, 0.008, 0.011))
    gem = M.new_object('crown_gem', v, f, color=pal['accent'] if pal['accent'] != col else '#ff5f8f', bone='head')
    M.finish(gem, levels=1)
    parts.append(gem)
    return parts


ACCESSORIES = dict(ribbon=ribbon, bunnyEars=bunny_ears, catEars=cat_ears, foxEars=fox_ears, hairpin=hairpin, beret=beret, witchHat=witch_hat,
                   horns=horns, flower=flower, goggles=goggles, hood=hood, headband=headband, crown=crown)
