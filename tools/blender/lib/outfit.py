"""Outfits per look.outfit: colours for the shared body parts + extra cages (collars, ribbons,
skirts, sleeves, armour plates, hoods, aprons...). Everything stays wholesome and readable
at game distance: one big silhouette feature per outfit."""
import math
from mathutils import Vector

from . import mesh as M
from .colors import mix, darken, lighten

WHITE = '#f7f7fb'
NAVY = '#2f3a5c'
SOCK = '#f4f4f8'
LOAFER = '#4a3238'
BOOT = '#3b3340'


def spec(look, pal):
    """Per-outfit colour plan for the body parts."""
    o = look.get('outfit', 'sailor')
    main, shade, acc = pal['outfit'], pal['outfitShade'], pal['accent']
    S = dict(top=main, sleeve=main, sleeve_len=0.45, legwear=None, sock=SOCK, sock_len=0.42, shoe=LOAFER, sole=darken(LOAFER, 0.3), glove=None, skirt=acc, skirt_len=1.0)
    if o == 'sailor':
        S.update(top=WHITE if _light(main) else main, skirt=acc if not _light(acc) else shade, sleeve=WHITE if _light(main) else main)
    elif o == 'blazer':
        S.update(top=main, sleeve=main, sleeve_len=0.9, skirt=shade, sock_len=0.6)
    elif o == 'miko':
        S.update(top=WHITE, sleeve=WHITE, sleeve_len=1.0, skirt='#d9304a', skirt_len=1.35, sock=WHITE, sock_len=0.9, shoe='#6b4a3a')
    elif o == 'kimono':
        S.update(top=main, sleeve=main, sleeve_len=1.0, skirt=main, skirt_len=1.3, sock=WHITE, sock_len=0.5, shoe='#5a3d33')
    elif o == 'hoodie':
        S.update(top=main, sleeve=main, sleeve_len=1.0, skirt=shade, skirt_len=0.6, sock=None, shoe=acc, sole=WHITE)
    elif o == 'dress':
        S.update(top=main, sleeve=main, sleeve_len=0.3, skirt=main, skirt_len=1.15, sock=SOCK, sock_len=0.5, shoe=darken(acc, 0.35))
    elif o == 'armor':
        S.update(top=main, sleeve=main, sleeve_len=0.35, skirt=shade if not _light(shade) else acc, skirt_len=1.0, legwear=None, sock=WHITE, sock_len=0.75, shoe=darken(acc, 0.25), glove=mix(WHITE, acc, 0.2))
    elif o == 'coat':
        S.update(top=main, sleeve=main, sleeve_len=1.0, skirt=main, skirt_len=1.25, legwear=darken(shade, 0.4), sock=None, shoe=BOOT)
    elif o == 'apron':
        S.update(top=acc, sleeve=acc, sleeve_len=0.4, skirt=acc, skirt_len=1.1, sock=SOCK, sock_len=0.5, shoe='#5a3a3a')
    elif o == 'jumpsuit':
        S.update(top=main, sleeve=main, sleeve_len=1.0, skirt=None, legwear=main, sock=None, shoe=darken(shade, 0.3), glove=shade)
    elif o == 'robe':
        S.update(top=main, sleeve=main, sleeve_len=1.0, skirt=main, skirt_len=1.4, sock=None, legwear=None, shoe=darken(shade, 0.3))
    return S


def _light(hexcol):
    h = hexcol.lstrip('#')
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return (r * 0.3 + g * 0.59 + b * 0.11) > 190


# ---------------------------------------------------------------------------

def build(ctx):
    P = ctx['P']
    look = ctx['look']
    pal = ctx['pal']
    S = ctx['spec']
    o = look.get('outfit', 'sailor')
    parts = []
    fn = OUTFITS.get(o, outfit_sailor)
    parts += fn(ctx, P, pal, S)
    ctx['parts'] += parts
    return parts


def skirt(P, color, length=1.0, flare=1.35, pleats=True, top_z=None, bone='hips', shade=None, segments=16, waistband=None):
    """Pleated flared skirt (lathe + solidify)."""
    zt = top_z if top_z is not None else P['waist_z'] + 0.005
    hip_w = P['torso_w'][2] / 2
    hip_d = P['torso_d'][2] / 2
    L = (zt - P['knee'].z + 0.02) * length
    zb = zt - L
    prof = [(1.0, 0.0), (1.08, -0.25 * L), (1.22, -0.6 * L), (flare, -L)]
    verts = []
    rings = []
    for r, dz in prof:
        ring = []
        for k in range(segments):
            a = 2 * math.pi * k / segments
            p = 1.0 + (0.045 if (pleats and k % 2 and dz < -0.01) else 0.0)
            ring.append(len(verts))
            verts.append((math.cos(a) * hip_w * r * p * 1.02, math.sin(a) * hip_d * r * p * 1.08, zt + dz))
        rings.append(ring)
    faces = []
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        for k in range(segments):
            faces.append((a[k], a[(k + 1) % segments], b[(k + 1) % segments], b[k]))
    faces.append(tuple(reversed(rings[0])))
    faces = M._orient(verts, faces, center=Vector((0, 0, (zt + zb) / 2)))
    o = M.new_object('skirt', verts, faces, color=color, bone=bone)
    M.crease_ring(o, rings[-1], 0.7)
    M.finish(o, levels=1, solidify=0.012)
    if shade:
        M.set_color(o, color, lambda co: shade if co.z < zb + 0.012 else color)
    parts = [o]
    if waistband:
        v, f, r = M.tube([Vector((0, 0, zt - 0.004)), Vector((0, 0, zt + 0.018))], (hip_w * 1.06, hip_d * 1.1), sides=12)
        w = M.new_object('waistband', v, f, color=waistband, bone='hips')
        M.finish(w, levels=1)
        parts.append(w)
    return parts


def sailor_collar(P, color, trim):
    z = P['torso_top'] - 0.01
    w = P['torso_w'][0] / 2 * 1.25
    d = P['torso_d'][0] / 2
    # back flap
    pts = [(-w, -0.0), (w, 0.0), (w * 0.9, -0.085), (0, -0.1), (-w * 0.9, -0.085)]
    v, f = M.plate(pts, 0.012, center=(0, d * 0.95, z), plane='xz')
    back = M.new_object('collar_back', v, f, color=color, bone='chest')
    M.finish(back, levels=1)
    # front V: two strips meeting at the chest
    parts = [back]
    for s in (1, -1):
        pts = [(0, 0), (s * w * 0.9, 0.0), (s * w * 0.55, -0.03), (s * 0.012, -0.075)]
        v, f = M.plate(pts, 0.012, center=(0, -d * 0.98, z), plane='xz')
        fr = M.new_object(f'collar_f{s}', v, f, color=color, bone='chest')
        M.finish(fr, levels=1)
        parts.append(fr)
    return parts


def bow(center, color, size=0.04, bone='chest', tails=True, flat=False, rot_z=0.0):
    """Ribbon bow: two loops + knot (+ tails)."""
    cx, cy, cz = center
    parts = []
    for s in (1, -1):
        v, f = M.sphere((cx + s * size * 0.75, cy, cz), (size * 0.75, size * 0.32 if flat else size * 0.45, size * 0.5))
        v = [(x, y, z + (0.0 if abs(x - cx) < size * 0.4 else size * 0.1)) for x, y, z in v]
        lo = M.new_object('bow_loop', v, f, color=color, bone=bone)
        M.finish(lo, levels=1)
        parts.append(lo)
    v, f = M.sphere((cx, cy - size * 0.1, cz), (size * 0.3, size * 0.3, size * 0.3))
    k = M.new_object('bow_knot', v, f, color=darken(color, 0.25), bone=bone)
    M.finish(k, levels=1)
    parts.append(k)
    if tails:
        for s in (1, -1):
            pts = [Vector((cx, cy, cz - size * 0.1)), Vector((cx + s * size * 0.45, cy - size * 0.15, cz - size * 0.9)), Vector((cx + s * size * 0.75, cy - size * 0.1, cz - size * 1.7))]
            v, f, r = M.tube(pts, [(size * 0.25, size * 0.08), (size * 0.3, size * 0.07), (size * 0.001, size * 0.001)], sides=6, tip_end=True, up=Vector((0, -1, 0)))
            t = M.new_object('bow_tail', v, f, color=color, bone=bone)
            M.crease(t, M.tip_edges(r), 1.0)
            M.finish(t, levels=2)
            parts.append(t)
    return parts


def sleeve_cuffs(P, color, where=0.5, r_mul=1.25):
    parts = []
    for side, s in (('L', 1), ('R', -1)):
        sh = Vector((P['shoulder'].x * s, P['shoulder'].y, P['shoulder'].z))
        el = Vector((P['elbow'].x * s, P['elbow'].y, P['elbow'].z))
        wr = Vector((P['wrist'].x * s, P['wrist'].y, P['wrist'].z))
        p = sh.lerp(wr, where)
        d = (wr - sh).normalized()
        v, f, r = M.tube([p - d * 0.012, p + d * 0.012], P['forearm_r'] * r_mul, sides=8)
        c = M.new_object(f'cuff_{side}', v, f, color=color)
        M.weight_by_bones(c, [(f'upper_arm_{side}', sh, el), (f'forearm_{side}', el, wr)])
        M.finish(c, levels=1)
        parts.append(c)
    return parts


def puff_sleeves(P, color):
    parts = []
    for side, s in (('L', 1), ('R', -1)):
        sh = Vector((P['shoulder'].x * s, P['shoulder'].y, P['shoulder'].z))
        v, f = M.sphere(sh + Vector((s * 0.012, 0, -0.01)), (0.052, 0.05, 0.055))
        p = M.new_object(f'puff_{side}', v, f, color=color, bone=f'upper_arm_{side}')
        M.finish(p, levels=1)
        parts.append(p)
    return parts


def wide_sleeves(P, color, inner=None):
    """Kimono / miko / robe sleeves: big soft tubes hanging from the elbows."""
    parts = []
    for side, s in (('L', 1), ('R', -1)):
        sh = Vector((P['shoulder'].x * s, P['shoulder'].y, P['shoulder'].z))
        el = Vector((P['elbow'].x * s, P['elbow'].y, P['elbow'].z))
        wr = Vector((P['wrist'].x * s, P['wrist'].y, P['wrist'].z))
        pts = [sh + Vector((0, 0, 0.01)), sh.lerp(el, 0.5), el + Vector((s * 0.008, 0.0, 0)), wr + Vector((s * 0.006, 0.008, 0.01)), wr + Vector((s * 0.004, 0.012, -0.05))]
        radii = [(0.040, 0.040), (0.042, 0.042), (0.046, 0.050), (0.046, 0.058), (0.042, 0.052)]
        v, f, r = M.tube(pts, radii, sides=8)
        o = M.new_object(f'wsleeve_{side}', v, f, color=color)
        M.weight_by_bones(o, [(f'upper_arm_{side}', sh, el), (f'forearm_{side}', el, wr)], blend=0.04)
        M.crease_ring(o, r[-1], 0.5)
        M.finish(o, levels=1)
        if inner:
            M.set_color(o, color, lambda co, _wr=wr: inner if co.z < _wr.z - 0.02 else color)
        parts.append(o)
    return parts


def belt(P, color, buckle=None, z=None):
    z = z if z is not None else P['waist_z'] + 0.01
    w = P['torso_w'][1] / 2 * 1.06
    d = P['torso_d'][1] / 2 * 1.08
    v, f, r = M.tube([Vector((0, 0, z - 0.012)), Vector((0, 0, z + 0.012))], (w, d), sides=12)
    o = M.new_object('belt', v, f, color=color, bone='spine')
    M.finish(o, levels=1)
    parts = [o]
    if buckle:
        v, f = M.box((0, -d - 0.006, z), (0.03, 0.012, 0.028))
        b = M.new_object('buckle', v, f, color=buckle, bone='spine')
        M.finish(b, levels=1)
        parts.append(b)
    return parts


def shirt_collar(P, color):
    z = P['torso_top'] - 0.005
    d = P['torso_d'][0] / 2
    parts = []
    for s in (1, -1):
        pts = [(0, 0.0), (s * 0.05, 0.012), (s * 0.055, -0.02), (s * 0.012, -0.045)]
        v, f = M.plate(pts, 0.01, center=(0, -d * 0.95, z), plane='xz')
        c = M.new_object(f'shirtcollar{s}', v, f, color=color, bone='chest')
        M.finish(c, levels=1)
        parts.append(c)
    return parts


def tie(P, color):
    z = P['torso_top'] - 0.02
    d = P['torso_d'][0] / 2
    pts = [(-0.012, 0), (0.012, 0), (0.016, -0.05), (0, -0.065), (-0.016, -0.05)]
    v, f = M.plate(pts, 0.012, center=(0, -d * 1.02, z), plane='xz')
    t = M.new_object('tie', v, f, color=color, bone='chest')
    M.finish(t, levels=1)
    return [t]


def chest_plate(P, color, trim):
    """Breastplate: a rounded shell over the upper torso + shoulder pauldrons."""
    zt = P['torso_top'] - 0.005
    zb = P['waist_z'] + 0.01
    w = P['torso_w'][0] / 2
    d = P['torso_d'][0] / 2
    v, f, r = M.tube([Vector((0, 0, zb)), Vector((0, 0, (zb + zt) / 2)), Vector((0, -0.004, zt))], [(w * 0.98, d * 1.05), (w * 1.1, d * 1.15), (w * 1.0, d * 1.0)], sides=10)
    o = M.new_object('chestplate', v, f, color=color, bone='chest')
    M.crease_ring(o, r[0], 0.6)
    M.finish(o, levels=2)
    parts = [o]
    # trim band at the bottom
    v, f, r = M.tube([Vector((0, 0, zb - 0.004)), Vector((0, 0, zb + 0.012))], (w * 1.12, d * 1.2), sides=10)
    t = M.new_object('plate_trim', v, f, color=trim, bone='spine')
    M.finish(t, levels=1)
    parts.append(t)
    # pauldrons
    for side, s in (('L', 1), ('R', -1)):
        sh = Vector((P['shoulder'].x * s, P['shoulder'].y, P['shoulder'].z))
        v, f = M.sphere(sh + Vector((s * 0.02, 0, 0.008)), (0.052, 0.05, 0.045))
        p = M.new_object(f'pauldron_{side}', v, f, color=mix(color, '#cfd6e6', 0.45), bone=f'shoulder_{side}')
        M.finish(p, levels=1)
        parts.append(p)
        v, f = M.sphere(sh + Vector((s * 0.02, 0, 0.018)), (0.034, 0.032, 0.028))
        q = M.new_object(f'pauldron2_{side}', v, f, color=trim, bone=f'shoulder_{side}')
        M.finish(q, levels=1)
        parts.append(q)
    # chest emblem
    v, f = M.sphere((0, -d * 1.14, zt - 0.05), (0.016, 0.008, 0.016))
    e = M.new_object('emblem', v, f, color=trim, bone='chest')
    M.finish(e, levels=1)
    parts.append(e)
    return parts


def cape(P, color, length=1.0, shade=None):
    zt = P['torso_top'] - 0.01
    L = (zt - P['knee'].z) * length
    d = P['torso_d'][0] / 2
    w = P['torso_w'][0] / 2
    pts = [Vector((0, d * 0.9, zt)), Vector((0, d * 1.05, zt - L * 0.3)), Vector((0, d * 1.25, zt - L * 0.7)), Vector((0, d * 1.3, zt - L))]
    radii = [(w * 1.1, 0.012), (w * 1.25, 0.012), (w * 1.5, 0.012), (w * 1.6, 0.012)]
    v, f, r = M.tube(pts, radii, sides=8, up=Vector((0, 1, 0)))
    o = M.new_object('cape', v, f, color=color, bone='chest')
    M.crease_ring(o, r[-1], 0.5)
    M.finish(o, levels=1)
    if shade:
        M.set_color(o, color, lambda co: shade if co.y < d * 1.0 else color)
    return [o]


def hood(P, H_c, H_r, color, up=False):
    """Hood resting on the back of the neck/shoulders (down) — a soft shell behind the head."""
    c = Vector((0, H_c.y + H_r.y * 0.55, P['torso_top'] - 0.02))
    v, f = M.sphere(c, (H_r.x * 0.95, H_r.y * 0.55, 0.075))
    o = M.new_object('hood', v, f, color=color, bone='chest')
    M.finish(o, levels=1)
    return [o]


def apron(P, color, trim=None):
    zt = P['torso_top'] - 0.03
    zb = P['waist_z']
    d = P['torso_d'][0] / 2
    w = P['torso_w'][1] / 2
    pts = [(-w * 0.55, 0), (w * 0.55, 0), (w * 0.62, -(zt - zb)), (-w * 0.62, -(zt - zb))]
    v, f = M.plate(pts, 0.012, center=(0, -d * 1.05, zt), plane='xz')
    bib = M.new_object('apron_bib', v, f, color=color, bone='chest')
    M.finish(bib, levels=1)
    parts = [bib]
    # apron skirt: front half-lathe
    L = (zb - P['knee'].z) * 1.0
    hw = P['torso_w'][2] / 2
    hd = P['torso_d'][2] / 2
    v, f, r = M.lathe([(1.0, 0), (1.15, -L * 0.5), (1.3, -L)], segments=8, close_top=False, close_bottom=False, center=(0, 0, zb + 0.01), arc=math.pi, start=math.pi, scale_xy=(hw * 1.06, hd * 1.12))
    sk = M.new_object('apron_skirt', v, f, color=color, bone='hips')
    M.finish(sk, levels=2, solidify=0.01)
    parts.append(sk)
    return parts


def pockets(P, color):
    z = P['waist_z'] - 0.02
    d = P['torso_d'][2] / 2
    w = P['torso_w'][2] / 2
    v, f = M.box((0, -d * 1.02, z), (w * 1.1, 0.02, 0.04))
    o = M.new_object('pocket', v, f, color=color, bone='hips')
    M.finish(o, levels=1)
    return [o]


def obi(P, color, knot=None):
    z = P['waist_z'] + 0.01
    w = P['torso_w'][1] / 2 * 1.16
    d = P['torso_d'][1] / 2 * 1.2
    v, f, r = M.tube([Vector((0, 0, z - 0.035)), Vector((0, 0, z + 0.035))], (w, d), sides=12)
    o = M.new_object('obi', v, f, color=color, bone='spine')
    M.crease_ring(o, r[0], 0.8)
    M.crease_ring(o, r[-1], 0.8)
    M.finish(o, levels=1)
    parts = [o]
    v, f = M.box((0, d + 0.025, z), (0.08, 0.04, 0.055))
    k = M.new_object('obi_knot', v, f, color=knot or darken(color, 0.2), bone='spine')
    M.finish(k, levels=2)
    parts.append(k)
    return parts


# ---------------------------------------------------------------------------
# Outfit assemblies
# ---------------------------------------------------------------------------

def outfit_sailor(ctx, P, pal, S):
    collar = pal['accent'] if not _light(pal['accent']) else pal['outfitShade']
    parts = sailor_collar(P, collar, WHITE)
    parts += bow((0, -P['torso_d'][0] / 2 * 1.06, P['torso_top'] - 0.065), pal['accent'] if pal['accent'] != collar else '#e8485f', size=0.034)
    parts += skirt(P, S['skirt'], length=1.0, waistband=S['skirt'])
    parts += sleeve_cuffs(P, collar, where=0.5)
    return parts


def outfit_blazer(ctx, P, pal, S):
    parts = shirt_collar(P, WHITE)
    parts += tie(P, pal['accent'])
    parts += skirt(P, S['skirt'], length=0.95, waistband=darken(S['skirt'], 0.2))
    parts += sleeve_cuffs(P, lighten(pal['outfit'], 0.25), where=0.92, r_mul=1.2)
    # lapels
    d = P['torso_d'][0] / 2
    z = P['torso_top'] - 0.015
    for s in (1, -1):
        pts = [(s * 0.012, 0), (s * 0.055, 0.0), (s * 0.03, -0.07), (s * 0.012, -0.09)]
        v, f = M.plate(pts, 0.012, center=(0, -d * 0.98, z), plane='xz')
        l = M.new_object(f'lapel{s}', v, f, color=darken(pal['outfit'], 0.22), bone='chest')
        M.finish(l, levels=1)
        parts.append(l)
    return parts


def outfit_miko(ctx, P, pal, S):
    parts = wide_sleeves(P, WHITE, inner='#d9304a')
    parts += skirt(P, '#d9304a', length=1.32, flare=1.25, pleats=True, top_z=P['waist_z'] + 0.02, waistband='#d9304a')
    parts += bow((0, -P['torso_d'][0] / 2 * 1.08, P['torso_top'] - 0.07), '#d9304a', size=0.03)
    d = P['torso_d'][0] / 2
    for s in (1, -1):
        pts = [(0, 0), (s * 0.05, 0.0), (s * 0.05, -0.03), (s * 0.008, -0.09)]
        v, f = M.plate(pts, 0.012, center=(0, -d * 0.98, P['torso_top'] - 0.01), plane='xz')
        c = M.new_object(f'mikocollar{s}', v, f, color='#d9304a', bone='chest')
        M.finish(c, levels=1)
        parts.append(c)
    return parts


def outfit_kimono(ctx, P, pal, S):
    parts = wide_sleeves(P, pal['outfit'], inner=pal['accent'])
    parts += skirt(P, pal['outfit'], length=1.3, flare=1.15, pleats=False, top_z=P['waist_z'] + 0.02, shade=pal['outfitShade'])
    parts += obi(P, pal['accent'])
    d = P['torso_d'][0] / 2
    for s in (1, -1):
        pts = [(0, 0), (s * 0.05, 0.0), (s * 0.05, -0.03), (s * 0.005, -0.1)]
        v, f = M.plate(pts, 0.012, center=(0, -d * 0.98, P['torso_top'] - 0.01), plane='xz')
        c = M.new_object(f'kimcollar{s}', v, f, color=WHITE, bone='chest')
        M.finish(c, levels=1)
        parts.append(c)
    return parts


def outfit_hoodie(ctx, P, pal, S):
    H = ctx['H']
    parts = hood(P, H.c, H.R, pal['outfit'])
    parts += pockets(P, darken(pal['outfit'], 0.15))
    parts += skirt(P, pal['outfitShade'], length=0.55, flare=1.05, pleats=False)
    # drawstrings
    d = P['torso_d'][0] / 2
    for s in (1, -1):
        v, f, r = M.tube([Vector((s * 0.02, -d * 1.02, P['torso_top'] - 0.02)), Vector((s * 0.025, -d * 1.05, P['torso_top'] - 0.08))], 0.005, sides=6)
        o = M.new_object(f'string{s}', v, f, color=WHITE, bone='chest')
        M.finish(o, levels=1)
        parts.append(o)
    return parts


def outfit_dress(ctx, P, pal, S):
    parts = puff_sleeves(P, pal['outfit'])
    parts += skirt(P, pal['outfit'], length=1.15, flare=1.45, pleats=False, shade=pal['outfitShade'], waistband=pal['accent'])
    parts += bow((0, -P['torso_d'][0] / 2 * 1.08, P['torso_top'] - 0.05), pal['accent'], size=0.03)
    d = P['torso_d'][0] / 2
    pts = [(-0.05, 0), (0.05, 0), (0.06, -0.02), (0, -0.05), (-0.06, -0.02)]
    v, f = M.plate(pts, 0.01, center=(0, -d * 0.99, P['torso_top'] - 0.005), plane='xz')
    c = M.new_object('dresscollar', v, f, color=WHITE, bone='chest')
    M.finish(c, levels=1)
    parts.append(c)
    return parts


def outfit_armor(ctx, P, pal, S):
    trim = pal['accent']
    parts = chest_plate(P, lighten(pal['outfit'], 0.05), trim)
    parts += skirt(P, S['skirt'], length=1.05, flare=1.3, pleats=True, waistband=trim)
    parts += cape(P, mix(pal['outfit'], pal['accent'], 0.15), length=0.95, shade=pal['outfitShade'])
    return parts


def outfit_coat(ctx, P, pal, S):
    parts = skirt(P, pal['outfit'], length=1.25, flare=1.3, pleats=False, shade=pal['outfitShade'])
    parts += belt(P, darken(pal['outfitShade'], 0.3), buckle=pal['accent'])
    parts += shirt_collar(P, lighten(pal['outfit'], 0.3))
    parts += sleeve_cuffs(P, pal['accent'], where=0.92, r_mul=1.2)
    d = P['torso_d'][0] / 2
    for s in (1, -1):
        pts = [(s * 0.01, 0), (s * 0.06, 0.0), (s * 0.035, -0.08), (s * 0.01, -0.1)]
        v, f = M.plate(pts, 0.012, center=(0, -d * 0.98, P['torso_top'] - 0.012), plane='xz')
        l = M.new_object(f'coatlapel{s}', v, f, color=pal['outfitShade'], bone='chest')
        M.finish(l, levels=1)
        parts.append(l)
    return parts


def outfit_apron(ctx, P, pal, S):
    parts = puff_sleeves(P, pal['accent'])
    parts += skirt(P, pal['accent'], length=1.05, flare=1.4, pleats=False, shade=darken(pal['accent'], 0.2))
    parts += apron(P, WHITE)
    parts += bow((0, P['torso_d'][2] / 2 * 1.1, P['waist_z'] + 0.01), WHITE, size=0.04)
    return parts


def outfit_jumpsuit(ctx, P, pal, S):
    parts = belt(P, pal['outfitShade'], buckle=pal['accent'])
    parts += pockets(P, pal['outfitShade'])
    parts += sleeve_cuffs(P, pal['outfitShade'], where=0.92, r_mul=1.25)
    d = P['torso_d'][0] / 2
    pts = [(-0.045, 0), (0.045, 0), (0.05, -0.03), (0, -0.045), (-0.05, -0.03)]
    v, f = M.plate(pts, 0.012, center=(0, -d * 0.99, P['torso_top'] - 0.008), plane='xz')
    c = M.new_object('jscollar', v, f, color=pal['outfitShade'], bone='chest')
    M.finish(c, levels=1)
    parts.append(c)
    # knee pads
    for side, s in (('L', 1), ('R', -1)):
        k = Vector((P['knee'].x * s, P['knee'].y - P['shin_r'] * 0.6, P['knee'].z))
        v, f = M.sphere(k, (P['shin_r'] * 0.9, P['shin_r'] * 0.6, 0.03))
        o = M.new_object(f'kneepad_{side}', v, f, color=pal['outfitShade'], bone=f'shin_{side}')
        M.finish(o, levels=1)
        parts.append(o)
    return parts


def outfit_robe(ctx, P, pal, S):
    parts = wide_sleeves(P, pal['outfit'], inner=pal['accent'])
    parts += skirt(P, pal['outfit'], length=1.42, flare=1.3, pleats=False, top_z=P['waist_z'] + 0.03, shade=pal['outfitShade'])
    parts += belt(P, pal['accent'], z=P['waist_z'] + 0.025)
    H = ctx['H']
    parts += hood(P, H.c, H.R, pal['outfitShade'])
    v, f = M.sphere((0, -P['torso_d'][0] / 2 * 1.1, P['torso_top'] - 0.04), (0.016, 0.01, 0.016))
    g = M.new_object('robe_gem', v, f, color=pal['accent'], bone='chest')
    M.finish(g, levels=1)
    parts.append(g)
    return parts


OUTFITS = dict(sailor=outfit_sailor, blazer=outfit_blazer, miko=outfit_miko, kimono=outfit_kimono, hoodie=outfit_hoodie, dress=outfit_dress,
               armor=outfit_armor, coat=outfit_coat, apron=outfit_apron, jumpsuit=outfit_jumpsuit, robe=outfit_robe)
