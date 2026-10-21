"""Outfits per look.outfit: colours for the shared body parts + extra cages (collars, ribbons,
skirts, sleeves, armour plates, hoods, aprons...). Everything stays wholesome and readable
at game distance: one big silhouette feature per outfit."""
import math
from mathutils import Vector

from . import mesh as M
from .colors import mix, darken, lighten

WHITE = '#f7f7fb'
APRON_CREAM = '#f7f0dc'
NAVY = '#2f3a5c'
SOCK = '#f4f4f8'
LOAFER = '#4a3238'
BOOT = '#3b3340'
SNEAKER = '#f3f4f2'
GOLD = '#e2b552'
SHIRT_BLACK = '#211b21'
SILVER_TRIM = '#c9c6d6'
STAGE_GOLD = '#e3bd62'


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
        # dress in the outfit colour under a cream apron (accent is free for goggles/hairpins)
        S.update(top=main, sleeve=main, sleeve_len=0.4, skirt=main, skirt_len=1.1, sock=SOCK, sock_len=0.5, shoe='#5a3a3a')
    elif o == 'jumpsuit':
        S.update(top=main, sleeve=main, sleeve_len=1.0, skirt=None, legwear=main, sock=None, shoe=darken(shade, 0.3), glove=shade)
    elif o == 'robe':
        S.update(top=main, sleeve=main, sleeve_len=1.0, skirt=main, skirt_len=1.4, sock=None, legwear=None, shoe=darken(shade, 0.3))
    elif o == 'trackJacket':
        # open track jacket in the outfit colour (the white blouse panel is painted by the builder), a skirt a
        # shade deeper, full-length leggings (palette 'legwear') and white high-tops on accent soles
        S.update(top=main, sleeve=main, sleeve_len=1.0, skirt=mix(main, shade, 0.6), skirt_len=0.9,
                 legwear=pal.get('legwear', darken(shade, 0.45)), sock=None, shoe=SNEAKER, sole=acc)
    elif o == 'staffTrack':
        # zipped staff track jacket in the outfit colour (panels/collar/belt are added by the outfit), full-length
        # slacks (palette 'legwear', else the shade a touch darker), high-tops in the outfit colour on gold soles
        S.update(top=main, sleeve=main, sleeve_len=1.0, skirt=None, legwear=pal.get('legwear', darken(shade, 0.15)), sock=None,
                 shoe=main, sole=lighten(pal.get('trim', GOLD), 0.1))
    elif o == 'sailorCardigan':
        # dark sailor top + skirt in the outfit colour under a long open cardigan (dusky accent), dark tights, loafers
        cardi = mix(acc, main, 0.3)
        S.update(top=main, sleeve=cardi, sleeve_len=1.0, skirt=main, skirt_len=1.0, legwear=darken(main, 0.45), sock=None,
                 shoe='#2a2329', sole=darken('#2a2329', 0.35), cardigan=cardi, collar=mix(shade, main, 0.35), trim=SILVER_TRIM)
    elif o == 'blazerCardigan':
        # blazer in the outfit colour over a long cardigan, accent tartan skirt, dark tights, black loafers
        S.update(top=main, sleeve=main, sleeve_len=0.92, skirt=acc, skirt_len=0.8, legwear=mix(shade, '#3a2830', 0.4), sock=None,
                 shoe='#221a20', sole=darken('#221a20', 0.4), cardigan=lighten(main, 0.06), trim=acc, buttons='#d8b25a',
                 tartan=darken(acc, 0.45), tartanLine='#1c1418')
    elif o == 'stageCoat':
        # stage-cut frock coat over a waistcoat (the vest / lapels / tails are added by the outfit): long sleeves,
        # full-length trousers (palette 'legwear', else the shade a touch darker), ankle boots, optional gloves
        boot = pal.get('boot', BOOT)
        S.update(top=main, sleeve=main, sleeve_len=1.0, skirt=None, legwear=pal.get('legwear', darken(shade, 0.15)), sock=None,
                 shoe=boot, sole=darken(boot, 0.35), glove=pal.get('glove'))
    elif o == 'flightJacket':
        # hip-length flight jacket in the outfit colour (the torso shows down to the hem, the skirt starts there),
        # long sleeves, pleated skirt (palette 'skirt', else the shade), tights (palette 'legwear') and white boots
        S.update(top=main, sleeve=main, sleeve_len=0.92, skirt=pal.get('skirt', shade), skirt_len=0.95,
                 legwear=pal.get('legwear', darken(shade, 0.1)), sock=None, shoe=WHITE, sole=darken(shade, 0.1))
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


def skirt(P, color, length=1.0, flare=1.35, pleats=True, top_z=None, bone='hips', shade=None, segments=16, waistband=None, stripe=None):
    """Pleated flared skirt (lathe + solidify). `stripe` (hex) paints a crisp piping line just above the hem
    (three extra profile rings near the hem keep its edges sharp after subdivision)."""
    zt = top_z if top_z is not None else P['waist_z'] + 0.005
    hip_w = P['torso_w'][2] / 2
    hip_d = P['torso_d'][2] / 2
    L = (zt - P['knee'].z + 0.02) * length
    zb = zt - L
    prof = [(1.0, 0.0), (1.08, -0.25 * L), (1.22, -0.6 * L), (flare, -L)]
    SW = 0.011  # stripe width
    if stripe:
        def r_at(dz):
            r0, z0 = 1.22, -0.6 * L
            return r0 + (flare - r0) * (dz - z0) / (-L - z0)
        prof = prof[:3] + [(r_at(-L + f * SW), -L + f * SW) for f in (3.2, 2.3, 0.9)] + [(flare, -L)]
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
    if stripe:
        M.set_color(o, color, lambda co: stripe if zb + 0.85 * SW - 0.001 < co.z < zb + 2.3 * SW + 0.001 else color)
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


def bow(center, color, size=0.04, bone='chest', tails=True, flat=False, rot_z=0.0, tail_levels=2, knot_levels=1):
    """Ribbon bow: two loops + knot (+ tails). Lower tail/knot levels keep extra bows within the size budget."""
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
    M.finish(k, levels=knot_levels)
    parts.append(k)
    if tails:
        for s in (1, -1):
            pts = [Vector((cx, cy, cz - size * 0.1)), Vector((cx + s * size * 0.45, cy - size * 0.15, cz - size * 0.9)), Vector((cx + s * size * 0.75, cy - size * 0.1, cz - size * 1.7))]
            v, f, r = M.tube(pts, [(size * 0.25, size * 0.08), (size * 0.3, size * 0.07), (size * 0.001, size * 0.001)], sides=6, tip_end=True, up=Vector((0, -1, 0)))
            t = M.new_object('bow_tail', v, f, color=color, bone=bone)
            M.crease(t, M.tip_edges(r), 1.0)
            M.finish(t, levels=tail_levels)
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


def _part(ctx, name):
    for o in ctx['parts']:
        if o.get('part') == name:
            return o
    return None


def _trim_line(pts, color, y, r=0.0035):
    """Thin piping line (e.g. a sailor-collar stripe) along 2D (x, z) points on the plane at depth y."""
    v, f, rr = M.tube([Vector((x, y, z)) for x, z in pts], (r, r * 0.6), sides=4, up=Vector((0, -1 if y < 0 else 1, 0)))
    o = M.new_object('trim', v, f, color=color, bone='chest')
    M.finish(o, levels=1)
    return o


def cardigan(ctx, P, color, rib, buttons=None, open_w=(0.03, 0.052), hem=0.55, gap_deg=24):
    """Long open cardigan over the top: recolours the torso (the shirt shows in a V that narrows to the
    waist, with a rib band on both edges), a peplum shell open at the front that hangs over the skirt
    to `hem` of the skirt length, and small buttons down her right front edge."""
    zw, zt = P['waist_z'], P['torso_top']
    def opening(z):
        t = max(0.0, min(1.0, (z - zw) / (zt - zw)))
        return open_w[0] + (open_w[1] - open_w[0]) * t * t
    torso = _part(ctx, 'torso')
    top = ctx['spec']['top']
    if torso is not None:
        def col(co):
            if co.y < 0:
                ow = opening(co.z)
                ax = abs(co.x)
                if ax < ow:
                    return top
                if ax < ow + 0.012:
                    return rib
            return color
        M.set_color(torso, color, col)
    parts = []
    # peplum: front-open lathe from just above the skirt waistband, flaring over the pleats
    hip_w = P['torso_w'][2] / 2
    hip_d = P['torso_d'][2] / 2
    z0 = zw + 0.026
    L = (zw + 0.005 - P['knee'].z + 0.02) * hem
    gap = math.radians(gap_deg)
    prof = [(1.11, 0.0), (1.18, -0.45 * L), (1.33, -L - 0.026)]
    v, f, rings = M.lathe(prof, segments=14, close_top=False, close_bottom=False, center=(0, 0, z0),
                          arc=2 * math.pi - 2 * gap, start=1.5 * math.pi + gap, scale_xy=(hip_w * 1.03, hip_d * 1.1))
    pep = M.new_object('cardigan_hem', v, f, color=color, bone='hips')
    M.crease_ring(pep, rings[-1], 0.6)
    M.finish(pep, levels=1, solidify=0.01)
    zb = z0 - L - 0.026
    def hcol(co):
        if co.z < zb + 0.014:
            return rib
        a = math.atan2(co.y, co.x) % (2 * math.pi)
        if abs(a - 1.5 * math.pi) < gap + 0.16:
            return rib
        return color
    M.set_color(pep, color, hcol)
    parts.append(pep)
    if buttons and torso is not None:
        front = [v.co for v in torso.data.vertices if v.co.y < 0]
        for k, z in enumerate((zw + 0.025, zw + 0.06, zw + 0.095)):
            x = -(opening(z) + 0.006)
            near = [co.y for co in front if abs(co.x - x) < 0.012 and abs(co.z - z) < 0.012] or [-P['torso_d'][1] / 2]
            v, f = M.sphere((x, min(near) - 0.002, z), (0.0075, 0.005, 0.0075))
            b = M.new_object('cardigan_button', v, f, color=buttons, bone='spine' if z < (P['torso_bottom'] + P['torso_top']) / 2 else 'chest')
            M.finish(b, levels=1)
            parts.append(b)
    return parts


def outfit_sailor_cardigan(ctx, P, pal, S):
    """Iroha: charcoal sailor top with a dark collar piped in silver, a plum scarf bow, a pleated skirt
    with a silver hem line, a black turtleneck, and a long open dusky-plum cardigan with rib cuffs."""
    cardi = S.get('cardigan') or mix(pal['accent'], pal['outfit'], 0.3)
    rib = darken(cardi, 0.2)
    trim = S.get('trim', SILVER_TRIM)
    collar = S.get('collar') or pal['outfitShade']
    neck = _part(ctx, 'neck')
    if neck is not None:
        M.set_color(neck, S.get('turtleneck', '#2a2630'))
    parts = sailor_collar(P, collar, trim)
    z = P['torso_top'] - 0.01
    w = P['torso_w'][0] / 2 * 1.25
    d = P['torso_d'][0] / 2
    # the piping points are (x, drop below the collar line z): add z, else the lines sit at her feet
    parts.append(_trim_line([(w * 0.84, z - 0.066), (w * 0.4, z - 0.078), (0, z - 0.082), (-w * 0.4, z - 0.078), (-w * 0.84, z - 0.066)], trim, d * 0.95 + 0.009))
    for s in (1, -1):
        parts.append(_trim_line([(s * w * 0.62, z - 0.02), (s * w * 0.32, z - 0.045), (s * 0.022, z - 0.066)], trim, -d * 0.98 - 0.009))
    parts += bow((0, -d * 1.08, P['torso_top'] - 0.07), pal['accent'], size=0.034)
    parts += skirt(P, S['skirt'], length=S.get('skirt_len', 1.0), stripe=trim, waistband=S['skirt'])
    parts += sleeve_cuffs(P, rib, where=0.9, r_mul=1.22)
    parts += cardigan(ctx, P, cardi, rib, buttons=trim)
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
    parts = puff_sleeves(P, pal['outfit'])
    parts += skirt(P, pal['outfit'], length=1.05, flare=1.4, pleats=False, shade=pal['outfitShade'])
    parts += apron(P, APRON_CREAM)
    parts += bow((0, P['torso_d'][2] / 2 * 1.1, P['waist_z'] + 0.01), APRON_CREAM, size=0.04)
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


def _torso_bvh(torso):
    from mathutils.bvhtree import BVHTree
    me = torso.data
    return BVHTree.FromPolygons([v.co.copy() for v in me.vertices], [tuple(p.vertices) for p in me.polygons])


def _front_point(bvh, x, z, lift=0.0):
    """Point on a body part's front surface at (x, z), pushed `lift` out along the surface normal."""
    hit, nrm, _i, _d = bvh.ray_cast(Vector((x, -1.0, z)), Vector((0, 1, 0)))
    if hit is None:
        return Vector((x, -0.07, z))
    return hit + nrm.normalized() * lift


def _torso_bones(P):
    zb, zt = P['torso_bottom'], P['torso_top']
    hips_top = zb + 0.06
    mid = (zb + zt) / 2
    return [('hips', Vector((0, 0, zb)), Vector((0, 0, hips_top))), ('spine', Vector((0, 0, hips_top)), Vector((0, 0, mid))),
            ('chest', Vector((0, 0, mid)), Vector((0, 0, zt)))]


def outfit_track_jacket(ctx, P, pal, S):
    """Open hooded track jacket over a white sailor blouse: the torso is repainted with a white front panel,
    gold piping runs down both zip edges and the outer sleeves, a pale sailor collar and a white scarf bow sit
    in the opening, the hood rests down behind the neck, a small gold crest on the left chest; a pleated
    skirt over the full-length leggings (spec) and white high-top collars above the sneakers."""
    H = ctx['H']
    main, shade = pal['outfit'], pal['outfitShade']
    trim = pal.get('trim', GOLD)
    torso = next(o for o in ctx['parts'] if o.get('part') == 'torso')
    wz, zt = P['waist_z'], P['torso_top']

    def half_open(z):
        t = max(0.0, min(1.0, (z - wz) / (zt - wz)))
        return 0.034 + 0.016 * (1.0 - t)  # the opening widens a little towards the hem

    M.set_color(torso, main, lambda co: WHITE if (co.y < 0 and abs(co.x) < half_open(co.z) and co.z > wz - 0.01) else main)
    bvh = _torso_bvh(torso)
    bones = _torso_bones(P)
    parts = []
    # jacket hem over the skirt top: an open-front flared band (back and sides) with a ribbed shade band
    hip_w, hip_d = P['torso_w'][2] / 2, P['torso_d'][2] / 2
    open_a = math.radians(32)
    hem_top, hem_prof = wz + 0.024, [(1.0, 0.0), (1.12, -0.034), (1.22, -0.064)]
    hem_sx, hem_sy = hip_w * 1.07, hip_d * 1.16
    v, f, r = M.lathe(hem_prof, segments=8, close_top=False, close_bottom=False, center=(0, 0, hem_top), arc=2 * math.pi - 2 * open_a,
                      start=-math.pi / 2 + open_a, scale_xy=(hem_sx, hem_sy))
    hem = M.new_object('jacket_hem', v, f, color=main)
    M.weight_by_bones(hem, bones, blend=0.05)
    M.crease_ring(hem, r[-1], 0.6)
    M.finish(hem, levels=1, solidify=0.008)
    hem_bot = hem_top + hem_prof[-1][1]
    M.set_color(hem, main, lambda co: shade if co.z < hem_bot + 0.011 else main)
    parts.append(hem)

    def hem_edge(s, rr, dz):
        a = -math.pi / 2 + open_a
        return Vector((s * math.cos(a) * rr * hem_sx, math.sin(a) * rr * hem_sy - 0.003, hem_top + dz))

    # gold piping down both zip edges, from the collar along the opening and down the hem's front edges
    for s in (1, -1):
        zs = [zt - 0.022 - (zt - 0.022 - (wz + 0.012)) * k / 5 for k in range(6)]
        pts = [_front_point(bvh, s * half_open(z), z, lift=0.002) for z in zs]
        pts += [hem_edge(s, rr, dz) for rr, dz in hem_prof]
        v, f, r = M.tube(pts, 0.0048, sides=4, roll=math.pi / 4)
        o = M.new_object(f'piping{s}', v, f, color=trim)
        M.weight_by_bones(o, bones, blend=0.05)
        M.finish(o, levels=0)
        parts.append(o)
    # gold stripe down the outer sleeves (same bones and blend as the arm tubes)
    for side, s in (('L', 1), ('R', -1)):
        sh = Vector((P['shoulder'].x * s, P['shoulder'].y, P['shoulder'].z))
        el = Vector((P['elbow'].x * s, P['elbow'].y, P['elbow'].z))
        wr = Vector((P['wrist'].x * s, P['wrist'].y, P['wrist'].z))
        outv = Vector((s, 0, 0))
        r0, r1 = P['upper_arm_r'], P['forearm_r']
        pts = [sh + Vector((0, 0, 0.004)) + outv * r0 * 1.12, sh.lerp(el, 0.5) + outv * r0 * 1.12, el + outv * (r0 + r1) * 0.56,
               el.lerp(wr, 0.5) + outv * r1 * 1.12, wr.lerp(el, 0.12) + outv * r1 * 1.1]
        v, f, r = M.tube(pts, 0.004, sides=4, roll=math.pi / 4)
        o = M.new_object(f'sleevestripe_{side}', v, f, color=trim)
        M.weight_by_bones(o, [(f'upper_arm_{side}', sh, el), (f'forearm_{side}', el, wr)], blend=0.03)
        M.finish(o, levels=0)
        parts.append(o)
    parts += sleeve_cuffs(P, shade, where=0.92, r_mul=1.2)
    # pale sailor collar in the opening + white scarf bow
    d = P['torso_d'][0] / 2
    collar = mix(pal['accent'], WHITE, 0.55)
    for s in (1, -1):
        pts = [(s * 0.004, 0.0), (s * 0.046, 0.004), (s * 0.034, -0.03), (s * 0.006, -0.058)]
        v, f = M.plate(pts, 0.01, center=(0, -d * 0.99, zt - 0.006), plane='xz')
        c = M.new_object(f'sailorcollar{s}', v, f, color=collar, bone='chest')
        M.finish(c, levels=1)
        parts.append(c)
    parts += bow((0, -d * 1.1, zt - 0.06), WHITE, size=0.03, tail_levels=1, knot_levels=0)
    # hood down (a smaller shell than the hoodie's) + a small gold crest on the left chest
    hd = hood(P, H.c, H.R, main)[0]
    hc = Vector((0, H.c.y + H.R.y * 0.62, P['torso_top'] - 0.012))
    for vtx in hd.data.vertices:
        q = vtx.co - Vector((0, H.c.y + H.R.y * 0.55, P['torso_top'] - 0.02))
        vtx.co = hc + Vector((q.x * 0.72, q.y * 0.85, q.z * 0.8))
    hd.data.update()
    parts.append(hd)
    cp = _front_point(bvh, 0.056, zt - 0.075, lift=0.003)
    v, f = M.sphere(cp, (0.015, 0.006, 0.017))
    e = M.new_object('crest', v, f, color=trim, bone='chest')
    M.finish(e, levels=0)
    parts.append(e)
    # pleated skirt (a shade deeper than the jacket, darker hem line)
    parts += skirt(P, S['skirt'], length=S['skirt_len'], flare=1.38, pleats=True, shade=darken(S['skirt'], 0.18), waistband=S['skirt'])
    # high-top collars over the leggings, with an accent band at the top
    acc = pal['accent']
    for side, s in (('L', 1), ('R', -1)):
        a = Vector((P['ankle'].x * s, P['ankle'].y, P['ankle'].z))
        top = a.z + 0.042
        v, f, r = M.tube([a - Vector((0, 0, 0.024)), a + Vector((0, 0, 0.01)), Vector((a.x, a.y, top))],
                         [P['shin_r'] * 1.22, P['shin_r'] * 1.2, P['shin_r'] * 1.26], sides=8)
        o = M.new_object(f'hightop_{side}', v, f, color=S['shoe'], bone=f'shin_{side}')
        M.finish(o, levels=1)
        M.set_color(o, S['shoe'], lambda co, _t=top: acc if co.z > _t - 0.009 else S['shoe'])
        parts.append(o)
    return parts


def _girth(obj, z, tol=0.012):
    """Half width (x) and half depth (y) of a body part's vertices around height z."""
    xs = [abs(v.co.x) for v in obj.data.vertices if abs(v.co.z - z) < tol]
    ys = [abs(v.co.y) for v in obj.data.vertices if abs(v.co.z - z) < tol]
    return (max(xs) if xs else 0.08), (max(ys) if ys else 0.06)


def _ring_band(name, z0, z1, rx, ry, color, bones, sides=12):
    v, f, r = M.tube([Vector((0, 0, z0)), Vector((0, 0, z1))], (rx, ry), sides=sides)
    o = M.new_object(name, v, f, color=color)
    M.weight_by_bones(o, bones, blend=0.05)
    M.finish(o, levels=1)
    return o


def outfit_staff_track(ctx, P, pal, S):
    """Staff track suit (Kanna): a crimson track jacket zipped up to an open stand collar, black side panels
    edged with gold piping, a gold zip and a small gold crest on the left chest, a black shirt V with an ivory
    tie at the neck, a ribbed hem over a black belt with a gold buckle, black cuffs; full-length slacks
    (spec legwear) with a crimson side stripe and a straight hem over crimson high-top collars."""
    main, shade = pal['outfit'], pal['outfitShade']
    trim = pal.get('trim', GOLD)
    panel = mix(shade, SHIRT_BLACK, 0.5)
    slacks = S['legwear'] or panel
    tie_col = pal.get('accent', WHITE)
    torso = next(o for o in ctx['parts'] if o.get('part') == 'torso')
    zb, wz, zt = P['torso_bottom'], P['waist_z'], P['torso_top']
    hem_z = zb + 0.064  # the jacket reaches the hips, as in her portrait
    belt_z = hem_z - 0.018
    v_bot = zt - 0.072
    # half width of the torso per height (for the side panels and the seams)
    table = [(z, _girth(torso, z)[0]) for z in [zb + k * 0.01 for k in range(int((zt - zb) / 0.01) + 1)]]

    def half_w(z):
        best = min(table, key=lambda t: abs(t[0] - z))
        return best[1]

    seam = 0.66  # fraction of the half width where the black side panels start
    arm_z = P['shoulder_z'] - 0.03

    def col(co):
        if co.z < hem_z - 0.004:
            return slacks
        if co.y < 0 and co.z > v_bot and abs(co.x) < (co.z - v_bot) * 0.62 + 0.003:
            return SHIRT_BLACK
        if co.z < arm_z and abs(co.x) > half_w(co.z) * seam:
            return panel
        return main

    M.set_color(torso, main, col)
    bvh = _torso_bvh(torso)
    hips_top = zb + 0.06
    mid = (zb + zt) / 2
    tb = [('hips', Vector((0, 0, zb)), Vector((0, 0, hips_top))), ('spine', Vector((0, 0, hips_top)), Vector((0, 0, mid))),
          ('chest', Vector((0, 0, mid)), Vector((0, 0, zt)))]
    parts = []

    def line(name, pts, color, radius):
        v, f, r = M.tube(pts, radius, sides=4, roll=math.pi / 4)
        o = M.new_object(name, v, f, color=color)
        M.weight_by_bones(o, tb, blend=0.05)
        M.finish(o, levels=0)
        parts.append(o)

    # gold zip from the bottom of the V to the hem, and gold piping along both panel seams
    zs = [v_bot - (v_bot - hem_z - 0.004) * k / 5 for k in range(6)]
    line('zip', [_front_point(bvh, 0.0, z, 0.0018) for z in zs], trim, 0.0036)
    for s in (1, -1):
        zs = [arm_z - (arm_z - hem_z - 0.004) * k / 5 for k in range(6)]
        line(f'seam{s}', [_front_point(bvh, s * half_w(z) * seam, z, 0.0016) for z in zs], trim, 0.003)
    # small gold crest on the left chest
    cp = _front_point(bvh, 0.044, zt - 0.075, 0.003)
    v, f = M.sphere(cp, (0.0135, 0.005, 0.0135))
    e = M.new_object('crest', v, f, color=trim, bone='chest')
    M.finish(e, levels=0)
    parts.append(e)
    # open stand collar around the neck base (crimson, gold top edge), open at the front over the black shirt V
    gx, gy = _girth(torso, zt - 0.012, tol=0.01)
    rx, ry = max(gx, P['neck_r'] * 1.4) * 1.06, max(gy, P['neck_r'] * 1.4) * 1.1
    open_a = math.radians(34)
    top = 0.034
    v, f, r = M.lathe([(1.0, 0.0), (1.0, top * 0.5), (0.97, top)], segments=10, close_top=False, close_bottom=False,
                      center=(0, 0.004, zt - 0.016), arc=2 * math.pi - 2 * open_a, start=-math.pi / 2 + open_a, scale_xy=(rx, ry))
    c = M.new_object('standcollar', v, f, color=main, bone='chest')
    M.finish(c, levels=1, solidify=0.007)
    ctop = zt - 0.016 + top
    M.set_color(c, main, lambda co: trim if co.z > ctop - 0.006 else main)
    parts.append(c)
    # black shirt collar points + a short ivory tie that disappears into the zipped jacket
    parts += shirt_collar(P, SHIRT_BLACK)
    tp = _front_point(bvh, 0.0, zt - 0.02, 0.006)
    v, f = M.plate([(-0.0105, 0), (0.0105, 0), (0.014, -0.036), (0, -0.05), (-0.014, -0.036)], 0.008, center=(0, tp.y, zt - 0.018), plane='xz')
    t = M.new_object('tie', v, f, color=tie_col, bone='chest')
    M.finish(t, levels=1)
    parts.append(t)
    # ribbed hem band (a shade deeper than the jacket) over a black belt with a gold buckle
    hx, hy = _girth(torso, hem_z)
    parts.append(_ring_band('jacket_hem', hem_z - 0.006, hem_z + 0.012, hx * 1.06, hy * 1.09, darken(main, 0.28), tb))
    bx, by = _girth(torso, belt_z)
    parts.append(_ring_band('belt', belt_z - 0.01, belt_z + 0.008, bx * 1.04, by * 1.07, '#17121a', tb))
    v, f = M.box((0, -by * 1.07 - 0.004, belt_z - 0.001), (0.026, 0.01, 0.022))
    b = M.new_object('buckle', v, f, color=trim, bone='hips')
    M.finish(b, levels=1)
    parts.append(b)
    # black cuffs
    parts += sleeve_cuffs(P, panel, where=0.92, r_mul=1.2)
    # slacks: crimson side stripe down the outer leg, a straight hem over crimson high-top collars
    for side, s in (('L', 1), ('R', -1)):
        hip = Vector((P['hip'].x * s, P['hip'].y, P['hip'].z))
        knee = Vector((P['knee'].x * s, P['knee'].y, P['knee'].z))
        ankle = Vector((P['ankle'].x * s, P['ankle'].y, P['ankle'].z))
        lb = [(f'thigh_{side}', hip, knee), (f'shin_{side}', knee, ankle)]
        outv = Vector((s, 0, 0))
        r0, r1 = P['thigh_r'], P['shin_r']
        pts = [hip + Vector((0, 0, 0.03)) + outv * r0 * 0.98, hip.lerp(knee, 0.5) + outv * r0 * 1.04, knee + outv * (r0 + r1) * 0.53,
               knee.lerp(ankle, 0.5) + outv * r1 * 1.06, ankle + Vector((0, 0, 0.05)) + outv * r1 * 1.1]
        if not M.LEVEL_DROP[0]:  # sub-pixel at medium/low quality: the LOD leaves the stripe out
            v, f, r = M.tube(pts, 0.0045, sides=4, roll=math.pi / 4)
            o = M.new_object(f'legstripe_{side}', v, f, color=lighten(main, 0.12))
            M.weight_by_bones(o, lb, blend=0.03)
            M.finish(o, levels=0)
            parts.append(o)
        if not M.LEVEL_DROP[0]:  # the flared hem is sub-pixel at medium/low quality too
            v, f, r = M.tube([ankle + Vector((0, 0, 0.078)), ankle + Vector((0, 0, 0.05)), ankle + Vector((0, 0, 0.032))],
                             [r1 * 1.02, r1 * 1.13, r1 * 1.2], sides=8)
            o = M.new_object(f'trouserhem_{side}', v, f, color=slacks, bone=f'shin_{side}')
            M.finish(o, levels=1)
            parts.append(o)
        ctop = ankle.z + 0.03
        v, f, r = M.tube([ankle - Vector((0, 0, 0.024)), ankle + Vector((0, 0, 0.004)), Vector((ankle.x, ankle.y, ctop))],
                         [r1 * 1.22, r1 * 1.22, r1 * 1.26], sides=8)
        o = M.new_object(f'hightop_{side}', v, f, color=S['shoe'], bone=f'shin_{side}')
        M.finish(o, levels=1)
        parts.append(o)
    return parts


def tartan_skirt(P, base, band, line, length=0.92, flare=1.35, top_z=None, segments=16, stripes=8, waistband=None):
    """Pleated tartan skirt: the shared lathe skirt with more profile rings, painted with vertex colours. Dark
    `band` stripes run down the inner pleat folds; two `band` rows cross them, and thin `line` rows mark the
    crossings and the hem, so it reads as a plaid at chibi size."""
    zt = top_z if top_z is not None else P['waist_z'] + 0.005
    hip_w = P['torso_w'][2] / 2
    hip_d = P['torso_d'][2] / 2
    L = (zt - P['knee'].z + 0.02) * length
    zb = zt - L
    fz = (0.0, -0.15, -0.3, -0.52, -0.76, -0.9, -1.0)
    def rad(f):
        # same flare curve as skirt(): 1.0 at the waist, 1.08 at a quarter, 1.22 at 60 %, `flare` at the hem
        pts = [(0.0, 1.0), (-0.25, 1.08), (-0.6, 1.22), (-1.0, flare)]
        for (z0, r0), (z1, r1) in zip(pts, pts[1:]):
            if z1 <= f <= z0:
                return r0 + (r1 - r0) * (f - z0) / (z1 - z0)
        return flare
    verts, rings = [], []
    for f in fz:
        ring = []
        for k in range(segments):
            a = 2 * math.pi * k / segments
            p = 1.0 + (0.045 if (k % 2 and f < -0.03) else 0.0)
            ring.append(len(verts))
            verts.append((math.cos(a) * hip_w * rad(f) * p * 1.02, math.sin(a) * hip_d * rad(f) * p * 1.08, zt + f * L))
        rings.append(ring)
    faces = []
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        for k in range(segments):
            faces.append((a[k], a[(k + 1) % segments], b[(k + 1) % segments], b[k]))
    faces.append(tuple(reversed(rings[0])))
    faces = M._orient(verts, faces, center=Vector((0, 0, (zt + zb) / 2)))
    o = M.new_object('skirt', verts, faces, color=base, bone='hips')
    M.crease_ring(o, rings[-1], 0.7)
    M.finish(o, levels=1, solidify=0.012)
    cols = segments * 2  # columns after one subdivision level
    rows = (zt - 0.3 * L, zt - 0.76 * L)

    def col(co):
        a = math.atan2(co.y, co.x) % (2 * math.pi)
        k = int(round(a / (2 * math.pi) * cols)) % cols
        vert = k % (cols // stripes) == 0
        hz = co.z < zb + 0.011
        row = any(abs(co.z - r) < L * 0.05 for r in rows)
        if hz or (vert and row):
            return line
        if vert or row:
            return band
        return base
    M.set_color(o, base, col)
    parts = [o]
    if waistband:
        v, f, r = M.tube([Vector((0, 0, zt - 0.004)), Vector((0, 0, zt + 0.018))], (hip_w * 1.06, hip_d * 1.1), sides=12)
        w = M.new_object('waistband', v, f, color=waistband, bone='hips')
        M.finish(w, levels=1)
        parts.append(w)
    return parts


def open_hem(P, name, color, edge, z0, length, prof, gap_deg, segments=14, bone='hips', edge_w=0.16, hem_w=0.013):
    """A hanging garment hem that is open at the front (blazer skirt, long cardigan): a part-lathe from z0 down
    `length`, its profile `prof` [(radius factor, fraction of length)], with `edge`-coloured front edges and hem."""
    hip_w = P['torso_w'][2] / 2
    hip_d = P['torso_d'][2] / 2
    gap = math.radians(gap_deg)
    pr = [(r, -f * length) for r, f in prof]
    v, f, rings = M.lathe(pr, segments=segments, close_top=False, close_bottom=False, center=(0, 0, z0),
                          arc=2 * math.pi - 2 * gap, start=1.5 * math.pi + gap, scale_xy=(hip_w * 1.03, hip_d * 1.1))
    o = M.new_object(name, v, f, color=color, bone=bone)
    M.crease_ring(o, rings[-1], 0.6)
    M.finish(o, levels=1, solidify=0.01)
    zb = z0 - length

    def col(co):
        if co.z < zb + hem_w:
            return edge
        a = math.atan2(co.y, co.x) % (2 * math.pi)
        if abs(a - 1.5 * math.pi) < gap + edge_w:
            return edge
        return color
    M.set_color(o, color, col)
    return o


def outfit_blazer_cardigan(ctx, P, pal, S):
    """Ena: a violet-black blazer piped in the accent (lapels, cuffs, hip hem), gold buttons and a crimson rose pin,
    over a white shirt and a long accent tie; under it a long open black cardigan that hangs past the skirt (the
    coat-like flare of her portrait); an accent tartan pleated skirt; tights and loafers come from the spec."""
    acc = pal['accent']
    blazer = pal['outfit']
    trim = S.get('trim') or acc
    gold = S.get('buttons') or '#d8b25a'
    cardi = S.get('cardigan') or lighten(blazer, 0.06)
    d = P['torso_d'][0] / 2
    zt = P['torso_top']
    zw = P['waist_z']
    parts = shirt_collar(P, WHITE)
    # white shirt in the V of the blazer, under the lapels
    v, f = M.plate([(-0.034, 0.0), (0.034, 0.0), (0.0, -0.1)], 0.01, center=(0, -d * 0.97, zt - 0.008), plane='xz')
    sh = M.new_object('shirt_v', v, f, color=WHITE, bone='chest')
    M.finish(sh, levels=1)
    parts.append(sh)
    # long tie (knot + blade) in the accent
    v, f = M.plate([(-0.011, 0), (0.011, 0), (0.009, -0.016), (-0.009, -0.016)], 0.012, center=(0, -d * 1.03, zt - 0.014), plane='xz')
    k = M.new_object('tie_knot', v, f, color=darken(acc, 0.12), bone='chest')
    M.finish(k, levels=1)
    parts.append(k)
    v, f = M.plate([(-0.009, 0), (0.009, 0), (0.016, -0.062), (0, -0.078), (-0.016, -0.062)], 0.01, center=(0, -d * 1.03, zt - 0.03), plane='xz')
    t = M.new_object('tie', v, f, color=acc, bone='chest')
    M.finish(t, levels=1)
    parts.append(t)
    # lapels: black plates along the V edges on a slightly larger accent plate (the piping)
    for s in (1, -1):
        pts = [(s * 0.03, 0.002), (s * 0.068, 0.006), (s * 0.052, -0.04), (s * 0.014, -0.098), (s * 0.006, -0.092)]
        cx = sum(p[0] for p in pts) / len(pts)
        cz = sum(p[1] for p in pts) / len(pts)
        big = [(cx + (x - cx) * 1.16, cz + (z - cz) * 1.1) for x, z in pts]
        v, f = M.plate(big, 0.008, center=(0, -d * 0.98 - 0.002, zt - 0.012), plane='xz')
        pip = M.new_object(f'lapel_pipe{s}', v, f, color=trim, bone='chest')
        M.finish(pip, levels=1)
        parts.append(pip)
        v, f = M.plate(pts, 0.008, center=(0, -d * 0.98 - 0.006, zt - 0.012), plane='xz')
        lp = M.new_object(f'lapel{s}', v, f, color=darken(blazer, 0.12), bone='chest')
        M.finish(lp, levels=1)
        parts.append(lp)
    # crimson rose pin on her left lapel
    v, f = M.sphere((0.044, -d * 0.98 - 0.014, zt - 0.03), (0.009, 0.006, 0.009))
    pin = M.new_object('lapel_rose', v, f, color=acc, bone='chest')
    M.finish(pin, levels=1)
    parts.append(pin)
    # gold buttons, double-breasted, where the blazer closes below the V
    torso = _part(ctx, 'torso')
    front = [vv.co for vv in torso.data.vertices if vv.co.y < 0] if torso is not None else []
    for z in (zt - 0.112, zt - 0.142):
        for x in (-0.024, 0.024):
            near = [co.y for co in front if abs(co.x - x) < 0.014 and abs(co.z - z) < 0.014] or [-P['torso_d'][1] / 2]
            v, f = M.sphere((x, min(near) - 0.003, z), (0.0075, 0.0045, 0.0075))
            b = M.new_object('blazer_button', v, f, color=gold, bone='chest' if z > (P['torso_bottom'] + zt) / 2 else 'spine')
            M.finish(b, levels=0)
            parts.append(b)
    # cuffs piped in the accent
    parts += sleeve_cuffs(P, trim, where=0.9, r_mul=1.18)
    # long open cardigan (under the blazer, past the skirt) and the blazer's short flared skirt over the hips
    knee = P['knee'].z
    parts.append(open_hem(P, 'cardigan', cardi, trim, zw + 0.012, zw + 0.012 - knee - 0.004,
                          [(1.12, 0.0), (1.3, 0.4), (1.5, 0.78), (1.6, 1.0)], gap_deg=44, edge_w=0.12, hem_w=0.016))
    parts.append(open_hem(P, 'blazer_hem', blazer, trim, zw + 0.03, 0.068, [(1.14, 0.0), (1.22, 0.55), (1.34, 1.0)], gap_deg=16, edge_w=0.14))
    # tartan pleated skirt in the accent
    parts += tartan_skirt(P, S['skirt'], S.get('tartan') or darken(acc, 0.45), S.get('tartanLine') or '#1c1418',
                          length=S.get('skirt_len', 0.92), waistband=darken(S['skirt'], 0.3))
    return parts


def _normal_color(obj, fn):
    """Per-vertex colour from fn(co, normal) -> hex (after the modifiers are applied)."""
    from .colors import linear
    me = obj.data
    attr = me.color_attributes.get(M.COLOR_ATTR)
    for i, v in enumerate(me.vertices):
        c = linear(fn(v.co, v.normal))
        attr.data[i].color = (c[0], c[1], c[2], 1.0)


def _coat_tails(P, main, lining, trim, zt, zb, r_top, r_hip, r_hem, open_top=14, open_hem=40, back_drop=0.0, segments=14):
    """Frock-coat tails: an open-fronted flared shell from the waist to mid-calf (the front gap widens towards the
    hem), navy outside, lilac lining inside (by normal), a gold hem band and gold front edges."""
    z_hip = P['hip'].z
    r_mid = ((r_hip[0] + r_hem[0]) / 2 * 1.02, (r_hip[1] + r_hem[1]) / 2 * 1.02)
    prof = [(zt, r_top, 0.0), (z_hip + 0.01, r_hip, 0.3), (zb + (z_hip - zb) * 0.45, r_mid, 0.7), (zb + 0.022, (r_hem[0] * 0.99, r_hem[1] * 0.99), 0.95),
            (zb, r_hem, 1.0)]
    verts, rings = [], []
    front = -math.pi / 2
    for z, (rx, ry), t in prof:
        g = math.radians(open_top + (open_hem - open_top) * t)
        ring = []
        for k in range(segments + 1):
            a = front + g + (2 * math.pi - 2 * g) * k / segments
            back = (1 - math.cos(a - front)) / 2  # 0 at the front edges, 1 at the back
            ring.append(len(verts))
            verts.append((math.cos(a) * rx, math.sin(a) * ry, z - back_drop * back * t))
        rings.append(ring)
    faces = []
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        for k in range(segments):
            faces.append((a[k], a[k + 1], b[k + 1], b[k]))
    faces = M._orient(verts, faces, center=Vector((0, 0, (zt + zb) / 2)))
    o = M.new_object('coat_tails', verts, faces, color=main, bone='hips')
    M.crease(o, [(rings[-1][k], rings[-1][k + 1]) for k in range(segments)], 0.7)
    M.finish(o, levels=1, solidify=0.012)

    def col(co, n):
        rad = Vector((co.x, co.y, 0))
        if rad.length > 1e-6 and n.dot(rad.normalized()) < -0.2:
            return lining
        a = math.atan2(co.y, co.x)
        da = abs(((a - front + math.pi) % (2 * math.pi)) - math.pi)  # angle from the front
        tz = max(0.0, min(1.0, (zt - co.z) / max(1e-6, zt - zb)))
        g = math.radians(open_top + (open_hem - open_top) * tz)
        if co.z < zb + 0.016 + back_drop * (1 - math.cos(da)) / 2 * 0.9:
            return trim
        if da < g + math.radians(7):
            return trim
        return main
    _normal_color(o, col)
    return o


def _front_sheet(name, bvh, xz, color, bones, lift=0.004, cols=4, rows=6):
    """A thin single-sided panel hugging a body part's front, for crisp colour shapes (vertex colours on the 32-around
    torso would blur): xz(u, t) -> (x, z) maps the unit square to the panel; each point is ray-cast onto the front."""
    verts, grid = [], []
    for i in range(rows + 1):
        row = []
        for j in range(cols + 1):
            x, z = xz(j / cols, i / rows)
            hit, nrm, _i, _d = bvh.ray_cast(Vector((x, -1.0, z)), Vector((0, 1, 0)))
            p = (hit + nrm.normalized() * lift) if hit is not None else Vector((x, -0.07, z))
            row.append(len(verts))
            verts.append(tuple(p))
        grid.append(row)
    faces = []
    for i in range(rows):
        for j in range(cols):
            f = (grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j])
            p0, p1, p2 = (Vector(verts[k]) for k in f[:3])
            faces.append(f if (p1 - p0).cross(p2 - p0).y < 0 else tuple(reversed(f)))
    o = M.new_object(name, verts, faces, color=color)
    M.weight_by_bones(o, bones, blend=0.05)
    M.finish(o, levels=0)
    return o


def _stage_cuffs(P, color, trim, where=0.86):
    """Wide turned-back cuffs with a thin gold ring at the top edge."""
    parts = []
    for side, s in (('L', 1), ('R', -1)):
        sh = Vector((P['shoulder'].x * s, P['shoulder'].y, P['shoulder'].z))
        el = Vector((P['elbow'].x * s, P['elbow'].y, P['elbow'].z))
        wr = Vector((P['wrist'].x * s, P['wrist'].y, P['wrist'].z))
        p = sh.lerp(wr, where)
        d = (wr - sh).normalized()
        for name, a0, a1, rm, c in (('stagecuff', -0.018, 0.026, 1.3, color), ('stagecuff_trim', -0.024, -0.016, 1.36, trim))[:1 if M.LEVEL_DROP[0] else 2]:
            v, f, r = M.tube([p + d * a0, p + d * a1], P['forearm_r'] * rm, sides=8)
            o = M.new_object(f'{name}_{side}', v, f, color=c)
            M.weight_by_bones(o, [(f'upper_arm_{side}', sh, el), (f'forearm_{side}', el, wr)])
            M.finish(o, levels=1)
            parts.append(o)
    return parts


def outfit_stage_coat(ctx, P, pal, S):
    """Stage-cut faculty frock coat (Yoriko): an indigo-navy coat open over a lilac waistcoat (palette 'vest') with lilac
    lapels (palette 'lapel'), a white shirt collar and a lilac necktie (palette 'necktie'), gold edging down the front
    (palette 'trim'), long open-fronted tails to mid-calf with a lilac lining (palette 'lining') and a gold hem, wide
    lilac cuffs with a gold ring; full-length trousers (spec legwear) over ankle boots with a short shaft."""
    from mathutils.bvhtree import BVHTree
    main, shade = pal['outfit'], pal['outfitShade']
    trim = pal.get('trim', STAGE_GOLD)
    vest = pal.get('vest', pal['accent'])
    lapel = pal.get('lapel', lighten(vest, 0.15))
    lining = pal.get('lining', mix(vest, shade, 0.2))
    necktie = pal.get('necktie', lighten(vest, 0.25))
    trousers = S['legwear'] or darken(shade, 0.15)
    torso = next(o for o in ctx['parts'] if o.get('part') == 'torso')
    zb, wz, zt = P['torso_bottom'], P['waist_z'], P['torso_top']
    v_bot = zt - 0.07          # bottom of the shirt V
    hem = zb + 0.05            # the waistcoat's pointed hem (centre)

    def open_w(z):
        # half width of the coat's front opening: wide at the collar, closed to a narrow V at the waist button,
        # opening again below the waist where the tails part
        if z >= wz:
            return 0.026 + (z - wz) / (zt - wz) * 0.026
        return 0.026 + (wz - z) * 0.55

    def shirt_w(z):
        return max(0.0, (z - v_bot) * 0.4) + 0.004

    # the torso stays coat-coloured; trousers show in the opening below the waistcoat (the panels below cover the rest)
    M.set_color(torso, main, lambda co: trousers if co.y < 0 and co.z < hem + 0.01 and abs(co.x) < open_w(co.z) else main)
    me = torso.data
    bvh = BVHTree.FromPolygons([v.co.copy() for v in me.vertices], [tuple(p.vertices) for p in me.polygons])
    hips_top = zb + 0.06
    mid = (zb + zt) / 2
    tb = [('hips', Vector((0, 0, zb)), Vector((0, 0, hips_top))), ('spine', Vector((0, 0, hips_top)), Vector((0, 0, mid))),
          ('chest', Vector((0, 0, mid)), Vector((0, 0, zt)))]
    parts = []

    def front_pt(x, z, lift):
        hit, nrm, _i, _d = bvh.ray_cast(Vector((x, -1.0, z)), Vector((0, 1, 0)))
        if hit is None:
            return Vector((x, -0.07, z))
        return hit + nrm.normalized() * lift

    def line(name, pts, color, radius):
        v, f, r = M.tube(pts, radius, sides=4, roll=math.pi / 4)
        o = M.new_object(name, v, f, color=color)
        M.weight_by_bones(o, tb, blend=0.05)
        M.finish(o, levels=0)
        parts.append(o)

    # crisp front panels: white shirt V, lilac waistcoat halves (pointed hem), lilac lapels
    lod = bool(M.LEVEL_DROP[0])
    z_top = zt - 0.008
    parts.append(_front_sheet('shirt_v', bvh, lambda u, t: ((u * 2 - 1) * shirt_w(z_top + (v_bot - z_top) * t), z_top + (v_bot - z_top) * t),
                              WHITE, tb, lift=0.003, cols=2, rows=2 if lod else 3))
    for s in (1, -1):
        def vest_xz(u, t, s=s):
            z = z_top - 0.002 + (hem - z_top + 0.002) * t
            x = s * (shirt_w(z) * (1 - u) * (1 if z > v_bot else 0) + open_w(z) * u) if z > v_bot else s * open_w(z) * u
            return x, z + (abs(x) * 0.45 if t >= 1 else 0.0)
        parts.append(_front_sheet(f'vest{s}', bvh, vest_xz, vest, tb, lift=0.004, cols=2 if lod else 3, rows=4 if lod else 7))

        def lapel_xz(u, t, s=s):
            z = zt - 0.006 + (wz + 0.012 - zt + 0.006) * t
            return s * (open_w(z) + 0.022 * u), z
        parts.append(_front_sheet(f'lapel{s}', bvh, lapel_xz, lapel, tb, lift=0.0045, cols=1, rows=3 if lod else 5))
    # gold edging along the lapels' outer edge, down the coat fronts to the waist
    for s in (1, -1):
        zs = [zt - 0.012 - (zt - 0.012 - (wz + 0.012)) * k / 5 for k in range(6)]
        line(f'coat_edge{s}', [front_pt(s * (open_w(z) + 0.022), z, 0.0045) for z in zs], trim, 0.0034)
    # a single gold button where the coat closes at the waist (sub-pixel in the LOD, left out there)
    if not M.LEVEL_DROP[0]:
        bp = front_pt(0.0, wz + 0.004, 0.007)
        v, f = M.sphere(tuple(bp), (0.009, 0.005, 0.009))
        btn = M.new_object('coat_button', v, f, color=trim, bone='spine')
        M.finish(btn, levels=0)
        parts.append(btn)
    # white shirt collar points + lilac necktie
    parts += shirt_collar(P, WHITE)
    tp = front_pt(0.0, zt - 0.02, 0.006)
    v, f = M.plate([(-0.011, 0), (0.011, 0), (0.014, -0.04), (0, -0.054), (-0.014, -0.04)], 0.008, center=(0, tp.y, zt - 0.016), plane='xz')
    t = M.new_object('necktie', v, f, color=necktie, bone='chest')
    M.finish(t, levels=1)
    parts.append(t)
    # long tails from the waist to mid-calf, open at the front, lilac lining, gold hem
    hip_w, hip_d = P['torso_w'][2] / 2, P['torso_d'][2] / 2
    waist_w, waist_d = P['torso_w'][1] / 2, P['torso_d'][1] / 2
    zt_t = wz + 0.004
    zb_t = P['knee'].z - (P['knee'].z - P['ankle'].z) * 0.45
    parts.append(_coat_tails(P, main, lining, trim, zt_t, zb_t, (waist_w * 1.12, waist_d * 1.16), (hip_w * 1.16, hip_d * 1.2),
                             (hip_w * 1.42, hip_d * 1.45)))
    # wide lilac cuffs with a gold ring
    parts += _stage_cuffs(P, lapel, trim)
    # ankle boots: a short shaft over the trouser hem (the LOD keeps the plain shoes)
    for side, s in (() if M.LEVEL_DROP[0] else (('L', 1), ('R', -1))):
        ankle = Vector((P['ankle'].x * s, P['ankle'].y, P['ankle'].z))
        r1 = P['shin_r']
        v, f, r = M.tube([ankle - Vector((0, 0, 0.024)), ankle + Vector((0, 0, 0.006)), ankle + Vector((0, 0, 0.034))],
                         [r1 * 1.2, r1 * 1.2, r1 * 1.24], sides=8)
        o = M.new_object(f'bootshaft_{side}', v, f, color=S['shoe'], bone=f'shin_{side}')
        M.finish(o, levels=1)
        parts.append(o)
    return parts


def outfit_flight_jacket(ctx, P, pal, S):
    """Aerial-patrol flight jacket (Seiran): a fitted hip-length jacket in the outfit colour, closed with gold
    buttons and edged in gold piping (lapels, hem), a white shirt V with a white collar and a tie (accent), gold
    shoulder boards with two stripes (outfit shade), a small gold bolt pin on the left chest, darker cuffs; a
    pleated skirt starting under the jacket hem; tall white flight boots with a shade top band and a strap with
    a gold buckle (over the spec tights)."""
    main, shade = pal['outfit'], pal['outfitShade']
    trim = pal.get('trim', GOLD)
    torso = next(o for o in ctx['parts'] if o.get('part') == 'torso')
    zb, wz, zt = P['torso_bottom'], P['waist_z'], P['torso_top']
    d = P['torso_d'][0] / 2
    hem_z = zb + 0.042  # the jacket reaches the hips, the skirt starts under it
    v_bot = zt - 0.085  # bottom of the white shirt V
    lapel = lighten(main, 0.1)

    def col(co):
        if co.y < 0 and co.z > v_bot and abs(co.x) < (co.z - v_bot) * 0.62 + 0.004:
            return WHITE
        return main

    M.set_color(torso, main, col)
    parts = []
    # skirt under the jacket hem, and a gold-piped hem band over its top
    parts += skirt(P, S['skirt'], length=S['skirt_len'], flare=1.32, pleats=True, top_z=hem_z + 0.006, segments=18)
    hw, hd = P['torso_w'][2] / 2, P['torso_d'][2] / 2
    v, f, r = M.tube([Vector((0, 0, hem_z - 0.006)), Vector((0, 0, hem_z + 0.004)), Vector((0, 0, hem_z + 0.016))],
                     [(hw * 1.1, hd * 1.15), (hw * 1.08, hd * 1.13), (hw * 1.02, hd * 1.06)], sides=12)
    h = M.new_object('jacket_hem', v, f, color=main, bone='hips')
    M.finish(h, levels=1)
    M.set_color(h, main, lambda co: trim if co.z < hem_z - 0.001 else main)
    parts.append(h)
    # shirt collar points + tie in the V
    parts += shirt_collar(P, WHITE)
    parts += tie(P, pal['accent'])
    # lapels: two plates along the V with a gold piping line on their outer edge
    z = zt - 0.012
    for s in (1, -1):
        pts = [(s * 0.016, 0.0), (s * 0.062, 0.0), (s * 0.044, -0.05), (s * 0.014, -0.082)]
        v, f = M.plate(pts, 0.01, center=(0, -d * 0.99, z), plane='xz')
        l = M.new_object(f'jlapel{s}', v, f, color=lapel, bone='chest')
        M.finish(l, levels=1)
        parts.append(l)
        if not M.LEVEL_DROP[0]:  # sub-pixel at medium/low quality
            edge = [Vector((s * 0.06, -d * 1.04, z - 0.002)), Vector((s * 0.043, -d * 1.07, z - 0.05)), Vector((s * 0.016, -d * 1.08, z - 0.082))]
            v, f, r = M.tube(edge, 0.0028, sides=4, roll=math.pi / 4)
            e = M.new_object(f'jpiping{s}', v, f, color=trim, bone='chest')
            M.finish(e, levels=0)
            parts.append(e)
    # gold buttons down the closed front, below the V
    for i, bz in enumerate((v_bot - 0.012, v_bot - 0.052, v_bot - 0.092)):
        if bz < hem_z + 0.02:
            break
        v, f = M.sphere((0.0, -P['torso_d'][1] / 2 * 1.12 - 0.002, bz), (0.0075, 0.005, 0.0075))
        bt = M.new_object(f'jbutton{i}', v, f, color=trim, bone='chest' if bz > (zb + zt) / 2 else 'spine')
        M.finish(bt, levels=0)
        parts.append(bt)
    # small gold bolt pin on the left chest
    bolt = [(-0.008, 0.016), (0.006, 0.016), (0.0, 0.004), (0.009, 0.004), (-0.006, -0.018), (-0.001, -0.003), (-0.01, -0.003)]
    v, f = M.plate(bolt, 0.004, center=(0.05, -d * 1.08, zt - 0.06), plane='xz')
    pin = M.new_object('jbolt', v, f, color=trim, bone='chest')
    M.finish(pin, levels=0)
    parts.append(pin)
    # gold shoulder boards (flat, stiff, no fringe) with two stripes in the outfit shade at the outer end
    for side, s in (('L', 1), ('R', -1)):
        sz = P['shoulder_z'] + 0.053  # resting on top of the shoulder, clear of the arm's top
        x0, x1 = 0.052, P['shoulder_x'] + 0.04
        v, f = M.box((s * (x0 + x1) / 2, 0.002, sz), (x1 - x0, 0.056, 0.011))
        bd = M.new_object(f'board_{side}', v, f, color=trim, bone=f'shoulder_{side}')
        M.finish(bd, levels=1)
        parts.append(bd)
        for k in range(0 if M.LEVEL_DROP[0] else 2):  # the stripes are sub-pixel at medium/low quality
            sx = x1 - 0.012 - k * 0.012
            v, f = M.box((s * sx, 0.002, sz + 0.0055), (0.0055, 0.054, 0.004))
            st = M.new_object(f'board_stripe_{side}{k}', v, f, color=shade, bone=f'shoulder_{side}')
            M.finish(st, levels=0)
            parts.append(st)
    # cuffs a shade deeper than the jacket
    parts += sleeve_cuffs(P, darken(main, 0.18), where=0.9, r_mul=1.22)
    # tall white flight boots over the tights: a shaft up to below the knee, a top band and a strap in the
    # outfit shade with a gold buckle on the outside
    boot = S['shoe']
    for side, s in (('L', 1), ('R', -1)):
        knee = Vector((P['knee'].x * s, P['knee'].y, P['knee'].z))
        ankle = Vector((P['ankle'].x * s, P['ankle'].y, P['ankle'].z))
        r1 = P['shin_r']
        top = knee.z - 0.022
        pts = [ankle - Vector((0, 0, 0.026)), ankle + Vector((0, 0, 0.01)), Vector((ankle.x, ankle.y, (ankle.z + top) / 2)), Vector((knee.x, knee.y, top))]
        v, f, r = M.tube(pts, [r1 * 1.24, r1 * 1.16, r1 * 1.14, r1 * 1.24], sides=8)
        bt = M.new_object(f'boot_{side}', v, f, color=boot, bone=f'shin_{side}')
        M.crease_ring(bt, r[-1], 0.6)
        M.finish(bt, levels=1)
        M.set_color(bt, boot, lambda co, _t=top: shade if co.z > _t - 0.014 else boot)
        parts.append(bt)
        sz = ankle.z + 0.038
        v, f, r = M.tube([Vector((ankle.x, ankle.y, sz - 0.007)), Vector((ankle.x, ankle.y, sz + 0.007))], r1 * 1.22, sides=8)
        sp = M.new_object(f'boot_strap_{side}', v, f, color=shade, bone=f'shin_{side}')
        M.finish(sp, levels=0)
        parts.append(sp)
        v, f = M.box((ankle.x + s * r1 * 1.24, ankle.y, sz), (0.006, 0.016, 0.014))
        bk = M.new_object(f'boot_buckle_{side}', v, f, color=trim, bone=f'shin_{side}')
        M.finish(bk, levels=0)
        parts.append(bk)
    return parts


OUTFITS = dict(sailor=outfit_sailor, blazer=outfit_blazer, miko=outfit_miko, kimono=outfit_kimono, hoodie=outfit_hoodie, dress=outfit_dress,
               armor=outfit_armor, coat=outfit_coat, apron=outfit_apron, jumpsuit=outfit_jumpsuit, robe=outfit_robe,
               trackJacket=outfit_track_jacket, staffTrack=outfit_staff_track, sailorCardigan=outfit_sailor_cardigan,
               blazerCardigan=outfit_blazer_cardigan, stageCoat=outfit_stage_coat, flightJacket=outfit_flight_jacket)
