"""Head accessories per look.accessory."""
import math
from mathutils import Vector, Matrix

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


def leaf_clip(ctx):
    """Gold leaf hair clip (Fuu): a sprig of two pointed leaves and a bead, lying on the hair above her
    left eye. Gold comes from the palette's 'trim' key (falls back to a warm gold)."""
    from mathutils import Matrix
    H = ctx['H']
    gold = ctx['pal'].get('trim', '#e2b552')
    az, el = 44, 32
    base = H.surf(az, el, HAIR_TOP - 0.01)
    place = Matrix.Translation(base) @ Matrix.Rotation(math.radians(az), 4, 'Z') @ Matrix.Rotation(math.radians(-el), 4, 'X')
    L, w = 0.052, 0.016
    outline = [(0, 0), (w * 0.8, L * 0.25), (w, L * 0.5), (w * 0.6, L * 0.78), (0, L), (-w * 0.6, L * 0.78), (-w, L * 0.5), (-w * 0.8, L * 0.25)]
    parts = []
    n = len(outline)
    for i, spin in enumerate((38, -22)):
        v, f = M.plate(outline, 0.006, center=(0, 0, 0), plane='xz')
        o = M.new_object(f'leafclip{i}', v, f, color=gold, bone='head')
        M.crease(o, [(k, (k + 1) % n) for k in range(n)] + [(n + k, n + (k + 1) % n) for k in range(n)], 1.0)
        M.finish(o, levels=1)
        o.data.transform(place @ Matrix.Rotation(math.radians(spin), 4, 'Y') @ Matrix.Scale(1.0 if i == 0 else 0.82, 4))
        o.data.update()
        parts.append(o)
    v, f = M.sphere((0, 0, 0), (0.008, 0.006, 0.008))
    b = M.new_object('leafclip_bead', v, f, color=lighten(gold, 0.25), bone='head')
    M.finish(b, levels=0)
    b.data.transform(place)
    b.data.update()
    parts.append(b)
    return parts


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
    shape = ctx.get('horn_shape')
    if shape == 'curl':
        return _curl_horns(ctx)
    if shape == 'dragon':
        return _dragon_horns(ctx)
    if shape == 'oni':
        return _oni_horns(ctx)
    if shape == 'crescent':
        return _crescent_horns(ctx)
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


def _oni_horns(ctx):
    """Tall oni horns (Kanna): two ivory cones that rise almost straight up from the top-front of the head,
    their tips leaning in a little, each seated in a gold ring cuff (palette 'trim', else a warm gold; not in the LOD). Taller
    than the default horns so they read above the twin-tails from the 48 deg battle camera; the halo is lifted
    to clear the tips."""
    H = ctx['H']
    col = mix(ctx['pal']['accent'], '#ffffff', 0.12)
    gold = ctx['pal'].get('trim', '#e2b552')
    ctx['halo_lift'] = max(ctx.get('halo_lift', 0.0), 0.06)
    parts = []
    for s in (1, -1):
        base = H.surf(s * 27, 60, HAIR_TOP - 0.06)
        n = H.normal(s * 27, 60)
        p1 = base + n * 0.02
        pts = [base - n * 0.012, p1, p1 + Vector((s * 0.01, 0.0, 0.036)), p1 + Vector((s * 0.01, 0.008, 0.07)),
               p1 + Vector((0.0, 0.02, 0.1))]
        v, f, r = M.tube(pts, [0.026, 0.025, 0.019, 0.011, 0.001], sides=6, tip_end=True)
        h = M.new_object(f'onihorn{s}', v, f, color=col, bone='head')
        M.crease(h, M.tip_edges(r), 1.0)
        M.finish(h, levels=1)
        parts.append(h)
        if M.LEVEL_DROP[0]:  # the LOD leaves the sub-pixel gold cuffs out
            continue
        d = (pts[2] - p1).normalized()
        v, f, r = M.tube([p1 - d * 0.006, p1 + d * 0.01], 0.029, sides=8)
        c = M.new_object(f'horncuff{s}', v, f, color=gold, bone='head')
        M.finish(c, levels=1)
        parts.append(c)
    return parts


def _curl_horns(ctx):
    """Ram horns: a tapering tube that leaves the side of the head, curls back, down and forward
    around the ear (Raika's curled horn tufts)."""
    H = ctx['H']
    # a shade darker than the accent so the curl reads against blonde hair
    col = darken(ctx['pal']['accent'], 0.18)
    parts = []
    for s in (1, -1):
        base = H.surf(s * 66, 34, HAIR_TOP - 0.04)
        n = H.normal(s * 66, 34)
        c = base + n * 0.05 + Vector((0, 0.014, -0.044))
        pts = [base - n * 0.012]
        steps = 9
        for i in range(steps + 1):
            t = i / steps
            th = math.pi * 0.55 + t * math.pi * 1.5
            r = 0.056 * (1 - 0.5 * t)
            pts.append(c + Vector((s * (0.014 + 0.04 * t), -r * math.cos(th), r * math.sin(th))))
        radii = [0.026] + [0.027 * (1 - 0.7 * i / steps) for i in range(steps)] + [0.001]
        v, f, r = M.tube(pts, radii, sides=6, tip_end=True)
        h = M.new_object(f'curlhorn{s}', v, f, color=col, bone='head')
        M.crease(h, M.tip_edges(r), 1.0)
        M.finish(h, levels=1)
        parts.append(h)
    return parts


def _dragon_horns(ctx):
    """Dragon horns: two long tapered tubes swept back from the top of the head (Seiran)."""
    H = ctx['H']
    col = mix(ctx['pal']['accent'], '#ffffff', 0.1)
    parts = []
    for s in (1, -1):
        base = H.surf(s * 38, 54, HAIR_TOP - 0.05)
        n = H.normal(s * 38, 54)
        pts = [base - n * 0.012, base + n * 0.03, base + n * 0.05 + Vector((s * 0.014, 0.05, 0.02)),
               base + n * 0.05 + Vector((s * 0.026, 0.11, 0.035)), base + n * 0.05 + Vector((s * 0.03, 0.16, 0.06))]
        v, f, r = M.tube(pts, [0.024, 0.021, 0.015, 0.009, 0.001], sides=6, tip_end=True)
        h = M.new_object(f'dragonhorn{s}', v, f, color=col, bone='head')
        M.crease(h, M.tip_edges(r), 1.0)
        M.finish(h, levels=2)
        parts.append(h)
    return parts


def _crescent_horns(ctx):
    """Crescent horns (Seiran): two slim, smooth horns rising from the top of the head, bowing outwards and
    curving back in, tips up and a little back. Colour from the palette's 'horn' key (else the accent), a
    shade deeper at the root. The halo is lifted to float above the tips."""
    H = ctx['H']
    col = ctx['pal'].get('horn', mix(ctx['pal']['accent'], '#ffffff', 0.1))
    root = darken(col, 0.16)
    ctx['halo_lift'] = max(ctx.get('halo_lift', 0.0), 0.075)
    parts = []
    for s in (1, -1):
        base = H.surf(s * 40, 52, HAIR_TOP - 0.05)
        n = H.normal(s * 40, 52)
        pts = [base - n * 0.014, base + n * 0.022, base + n * 0.03 + Vector((s * 0.03, 0.012, 0.045)),
               base + n * 0.03 + Vector((s * 0.034, 0.024, 0.088)), base + n * 0.03 + Vector((s * 0.014, 0.03, 0.12))]
        v, f, r = M.tube(pts, [0.021, 0.019, 0.015, 0.009, 0.001], sides=8, tip_end=True)
        h = M.new_object(f'crescenthorn{s}', v, f, color=col, bone='head')
        M.crease(h, M.tip_edges(r), 1.0)
        M.finish(h, levels=1)
        z0 = base.z + 0.012
        M.set_color(h, col, lambda co, _z=z0: root if co.z < _z else col)
        parts.append(h)
    return parts


def cap(ctx):
    """Peaked officer / captain cap: a crown slightly wider at the flat top, a dark band, a curved
    visor at the front and a small gold badge (Nami's white captain cap, Tsubaki's navy one)."""
    from mathutils import Matrix
    H = ctx['H']
    pal = ctx['pal']
    ctx['halo_lift'] = 0.06
    body = pal['accent']
    band_col = darken(pal['outfit'], 0.25)
    visor_col = darken(pal['outfit'], 0.35)
    el = 50
    r0x = H.R.x * (1 + HAIR_TOP) * math.cos(math.radians(el)) * 1.04
    r0y = H.R.y * (1 + HAIR_TOP) * math.cos(math.radians(el)) * 1.04
    z0 = H.c.z + H.R.z * (1 + HAIR_TOP) * math.sin(math.radians(el)) - 0.012
    base = Vector((H.c.x, H.c.y + 0.012, z0))
    tilt = Matrix.Translation(base) @ Matrix.Rotation(math.radians(-9), 4, 'X')
    sy = r0y / r0x
    parts = []
    # crown (flat top, a little wider than the band) + a puffed top disc
    v, f, r = M.lathe([(1.0, 0.0), (1.06, 0.03), (1.2, 0.062), (1.13, 0.076), (0.62, 0.082)], segments=14, close_top=True, close_bottom=True)
    v = [(x * r0x, y * r0x * sy, z) for x, y, z in v]
    o = M.new_object('cap_crown', v, f, color=body, bone='head')
    M.crease_ring(o, r[3], 0.5)
    M.finish(o, levels=2)
    o.data.transform(tilt)
    o.data.update()
    parts.append(o)
    # band
    v, f, r = M.tube([Vector((0, 0, -0.002)), Vector((0, 0, 0.026))], (r0x * 1.03, r0y * 1.03), sides=14)
    b = M.new_object('cap_band', v, f, color=band_col, bone='head')
    M.finish(b, levels=1)
    b.data.transform(tilt)
    b.data.update()
    parts.append(b)
    # visor: a curved slab in front of the band, dipping slightly
    arc = math.radians(150)
    v, f, r = M.lathe([(1.0, 0.004), (1.32, -0.012), (1.42, -0.02)], segments=8, close_top=False, close_bottom=False,
                      arc=arc, start=-math.pi / 2 - arc / 2)
    v = [(x * r0x, y * r0x * sy, z) for x, y, z in v]
    vz = M.new_object('cap_visor', v, f, color=visor_col, bone='head')
    M.finish(vz, levels=1, solidify=0.008)
    vz.data.transform(tilt)
    vz.data.update()
    parts.append(vz)
    # gold badge on the front of the crown
    v, f = M.sphere((0, -r0y * 1.12, 0.045), (0.02, 0.007, 0.017))
    g = M.new_object('cap_badge', v, f, color='#ffd45e', bone='head')
    M.finish(g, levels=1)
    g.data.transform(tilt)
    g.data.update()
    parts.append(g)
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


SILVER = '#e2deec'


def mirror_ornament(ctx):
    """Round silver mirror-disc ornament with a sunburst rim and a small lilac star in the middle (Iroha),
    on the front-outer side of her left bun (ctx['buns'] from hair 'bunsBob'; else above the left temple)."""
    H = ctx['H']
    buns = [b for b in ctx.get('buns', []) if b[0] == 1]
    if buns:
        _, bc, br = buns[0]
        out = Vector((bc.x - H.c.x, bc.y - H.c.y, bc.z - H.c.z)).normalized()
        n = (out + Vector((0, -1.1, 0.15))).normalized()
        c = bc + Vector((n.x * br[0], n.y * br[1], n.z * br[2])) * 0.92
    else:
        n = H.normal(60, 40)
        c = H.surf(60, 40, HAIR_TOP)
    R = Vector((0, 0, 1)).rotation_difference(n).to_matrix()
    place = lambda vs, lift=0.0: [tuple(c + R @ (Vector(p) + Vector((0, 0, lift)))) for p in vs]
    parts = []
    # sunburst rim: an 8-point star plate behind the disc
    pts = []
    for i in range(16):
        a = i / 16 * math.pi * 2
        rr = 0.036 if i % 2 == 0 else 0.026
        pts.append((math.cos(a) * rr, math.sin(a) * rr))
    v, f = M.plate(pts, 0.006, plane='xy')
    o = M.new_object('ornament_rays', place(v), f, color=darken(SILVER, 0.12), bone='head')
    M.finish(o, levels=1)
    parts.append(o)
    # the mirror disc
    v, f = M.sphere((0, 0, 0), (0.024, 0.024, 0.008))
    o = M.new_object('ornament_disc', place(v, 0.005), f, color=SILVER, bone='head')
    M.finish(o, levels=1)
    parts.append(o)
    # lilac star in the middle
    pts = []
    for i in range(10):
        a = math.pi / 2 + i / 10 * math.pi * 2
        rr = 0.014 if i % 2 == 0 else 0.0065
        pts.append((math.cos(a) * rr, math.sin(a) * rr))
    v, f = M.plate(pts, 0.005, plane='xy')
    o = M.new_object('ornament_star', place(v, 0.012), f, color=mix(ctx['pal'].get('halo', '#e6dcff'), '#a98be0', 0.55), bone='head')
    M.finish(o, levels=1)
    parts.append(o)
    return parts


def rose(ctx):
    """A crimson rose ornament (Ena): five cupped outer petals round a tighter inner cup and a dark bud,
    seated on the hair at her left temple (just above the braid root when the hair style left one in
    ctx['side_braid']), with two short crimson cords ending in tassels."""
    H = ctx['H']
    col = ctx['pal']['accent']
    dark = darken(col, 0.4)
    az, el = 70, 24
    c = H.surf(az, el, HAIR_TOP - 0.01)
    n = H.normal(az, el)
    t1 = n.cross(Vector((0, 0, 1))).normalized()
    t2 = n.cross(t1).normalized()
    parts = []

    def petal(name, pc, r, flat, color, levels=1):
        v, f = M.sphere(pc, (r, r, r))
        # flatten along the normal and cup the rim outward, like the flower petals
        out = []
        for p in v:
            q = Vector(p) - pc
            h = q.dot(n)
            q = q - n * h * (1 - flat)
            q = q + n * (0.35 * q.length - 0.006)
            out.append(tuple(pc + q))
        o = M.new_object(name, out, f, color=color, bone='head')
        M.finish(o, levels=levels)
        return o

    for i in range(5):
        a = i / 5 * math.pi * 2
        d = t1 * math.cos(a) + t2 * math.sin(a)
        parts.append(petal(f'rose_petal{i}', c + d * 0.025, 0.023, 0.5, col))
    parts.append(petal('rose_cup', c + n * 0.011, 0.022, 0.75, mix(col, dark, 0.35)))
    v, f = M.sphere(c + n * 0.023, (0.011, 0.011, 0.011))
    bud = M.new_object('rose_bud', v, f, color=dark, bone='head')
    M.finish(bud, levels=1)
    parts.append(bud)
    # two short cords with tassels hanging from under the rose
    for k, (dx, ln) in enumerate(((-0.008, 0.055), (0.01, 0.042))):
        top = c - t2 * 0.016 + t1 * dx - n * 0.004
        pts = [top, top + Vector((0, -0.004, -ln * 0.5)) + n * 0.006, top + Vector((0, -0.006, -ln)) + n * 0.01]
        v, f, r = M.tube(pts, 0.0035, sides=4)
        cord = M.new_object(f'rose_cord{k}', v, f, color=col, bone='head')
        M.finish(cord, levels=0)
        parts.append(cord)
        e = pts[-1]
        v, f, r = M.tube([e, e + Vector((0, 0, -0.016))], [(0.006, 0.006), (0.0085, 0.0085)], sides=6)
        tas = M.new_object(f'rose_tassel{k}', v, f, color=darken(col, 0.15), bone='head')
        M.finish(tas, levels=1)
        parts.append(tas)
    return parts


HEADSET_NAVY = '#2b275d'


def cat_headset(ctx):
    """Stage headset with cat-ear shells (Yoriko): a slim band over the hair, two shells in the headset colour with
    glowing inner panels, round ear cups with a glowing ring, and a thin mic boom from the cup on her right to beside
    the mouth with a glowing tip. The glowing bits use the halo material (palette 'headset' = shell/band colour)."""
    H, pal = ctx['H'], ctx['pal']
    dark = pal.get('headset', HEADSET_NAVY)
    c, R = H.c, H.R
    parts = []
    # cat-ear shells: flat triangular shells standing on the band, leaning back a little so the battle camera sees the
    # glowing inner panel on their front face
    for s in (1, -1):
        base = H.surf(s * 44, 54, HAIR_TOP - 0.03)
        f = Vector((s * 0.3, -1.0, 0.38)).normalized()        # the way the shell's front faces
        u = (Vector((s * 0.12, 0, 1)) - f * Vector((s * 0.12, 0, 1)).dot(f)).normalized()
        a = (-f).cross(u)
        X = Matrix((a, -f, u)).transposed()                   # plate space (x across, -y front, z up) -> head space
        for name, pts, t, dy, col in (('headset_ear', [(-0.056, 0.0), (0.056, 0.0), (s * 0.02, 0.11)], 0.026, 0.0, dark),
                                      ('headset_earglow', [(-0.034, 0.016), (0.034, 0.016), (s * 0.013, 0.08)], 0.008, -0.014, None)):
            v, fc = M.plate(pts, t, center=(0, dy, 0), plane='xz')
            v = [tuple(base + X @ Vector(q)) for q in v]
            e = M.new_object(name, v, fc, color=col or pal['accent'], bone='head')
            if col is None:
                e['material'] = 'halo'
            M.finish(e, levels=0)  # crisp flat shells, like a headset's moulded plastic
            parts.append(e)

    def at(d, lift):
        return Vector((c.x + d.x * R.x * (1 + lift), c.y + d.y * R.y * (1 + lift), c.z + d.z * R.z * (1 + lift)))

    # band: a great circle through both ears, tilted 25 deg forward so it runs under the ear shells
    tilt = math.radians(25)
    pts = []
    for t in (-80, -55, -28, 0, 28, 55, 80):
        a = math.radians(t)
        pts.append(at(Vector((math.sin(a), -math.sin(tilt) * math.cos(a), math.cos(tilt) * math.cos(a))), HAIR_TOP - 0.012))
    v, f, r = M.tube(pts, (0.013, 0.007), sides=6, up=Vector((0, -1, 0)))
    band = M.new_object('headset_band', v, f, color=dark, bone='head')
    M.finish(band, levels=1)
    parts.append(band)
    # ear cups on both sides (over the ears), each with a glowing ring and a dark centre
    cup_z = -0.07
    for s in (1, -1):
        d = Vector((s, 0.0, cup_z)).normalized()
        o = at(d, 0.17)
        n = Vector((s, 0, 0))
        for name, r0, a0, a1, col in (('headset_cup', 0.044, -0.02, 0.016, dark), ('headset_glow', 0.032, 0.012, 0.022, None),
                                      ('headset_hub', 0.017, 0.018, 0.028, dark))[:2 if M.LEVEL_DROP[0] else 3]:
            v, f, rr = M.tube([o + n * a0, o + n * a1], (r0, r0), sides=8)
            cp = M.new_object(name, v, f, color=col or dark, bone='head')
            if col is None:
                cp['material'] = 'halo'
            M.finish(cp, levels=1)
            parts.append(cp)
    # mic boom from the cup on her right, hugging the cheek, ending beside the mouth
    boom = [H.surf(-92, -9, 0.25), H.surf(-74, -22, 0.17), H.surf(-52, -32, 0.12), H.surf(-36, -36, 0.10)]
    v, f, r = M.tube(boom, 0.0055, sides=5)
    b = M.new_object('headset_mic', v, f, color=dark, bone='head')
    M.finish(b, levels=1)
    parts.append(b)
    v, f = M.sphere(tuple(boom[-1]), (0.011, 0.011, 0.011)) if not M.LEVEL_DROP[0] else M.box(tuple(boom[-1]), (0.02, 0.02, 0.02))
    tip = M.new_object('headset_mictip', v, f, color=pal['accent'], bone='head')
    tip['material'] = 'halo'
    M.finish(tip, levels=0)
    parts.append(tip)
    # the moon halo floats a little higher so it clears the ear shells
    ctx['halo_lift'] = max(ctx.get('halo_lift', 0.0), 0.08)
    return parts


ACCESSORIES = dict(ribbon=ribbon, bunnyEars=bunny_ears, catEars=cat_ears, foxEars=fox_ears, hairpin=hairpin, beret=beret, witchHat=witch_hat,
                   horns=horns, flower=flower, goggles=goggles, hood=hood, headband=headband, crown=crown, cap=cap,
                   leafClip=leaf_clip, mirrorOrnament=mirror_ornament, rose=rose, catHeadset=cat_headset)
