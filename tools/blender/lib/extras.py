"""Per-unit extra parts (ROSTER_SPEC §4.5): a fox tail, a falcon on the shoulder, a quiver, a fox
familiar, a taiko drum at the hip, a mortar tube on the back, a monocle and ribbon bows on twintail ties.

They are plain vertex-coloured cages like every other part, so `build_characters.py` joins them into
the single `body` mesh (the GLB keeps exactly three primitives: head, body, halo) and weights each one
to an existing bone (hips / chest / head). Which girl gets which extra is a tools-only table in
`build_characters.py` (`EXTRA_PARTS`), keyed by unit id, so the unit schema does not change."""
import math
from mathutils import Vector, Matrix

from . import mesh as M
from .colors import mix, darken, lighten

WHITE = '#f8f6f2'
BEAK = '#e8b64a'
EYE = '#2a2033'


def build(ctx, names):
    parts = []
    for n in names:
        fn = EXTRAS.get(n)
        if fn:
            parts += fn(ctx)
    ctx['parts'] += parts
    return parts


def _obj(name, vf, color, bone, levels=1, tip_rings=None, solidify=0.0):
    v, f = vf[0], vf[1]
    o = M.new_object(name, v, f, color=color, bone=bone)
    if tip_rings is not None:
        M.crease(o, M.tip_edges(tip_rings), 1.0)
    M.finish(o, levels=levels, solidify=solidify)
    return o


# ---------------------------------------------------------------------------
# Fox tail (Luna): a big fluffy tapered tube from the small of the back, curling up to one side,
# in the hair colour with a pale tip.
# ---------------------------------------------------------------------------

def fox_tail(ctx):
    P = ctx['P']
    pal = ctx['pal']
    tz = P['torso_bottom']
    back = P['torso_d'][2] * 0.5
    pts = [Vector((0.0, back * 0.55, tz + 0.03)), Vector((0.03, back + 0.07, tz - 0.01)), Vector((0.09, back + 0.15, tz + 0.04)),
           Vector((0.13, back + 0.18, tz + 0.14)), Vector((0.12, back + 0.15, tz + 0.25)), Vector((0.08, back + 0.1, tz + 0.31))]
    radii = [(0.03, 0.03), (0.055, 0.05), (0.075, 0.068), (0.078, 0.07), (0.055, 0.05), (0.001, 0.001)]
    v, f, r = M.tube(pts, radii, sides=8, tip_end=True)
    hair = pal['hair']
    tip = lighten(pal['hair'], 0.82)
    tip_z = tz + 0.2

    def col(co):
        t = max(0.0, min(1.0, (co.z - tip_z) / 0.05))
        return mix(hair, tip, t)

    o = M.new_object('fox_tail', v, f, color=hair, bone='hips')
    M.crease(o, M.tip_edges(r), 0.6)
    M.finish(o, levels=2)
    M.set_color(o, hair, fn=col)
    return [o]


# ---------------------------------------------------------------------------
# Falcon (Hana): a small white bird perched on the left shoulder, facing forward.
# ---------------------------------------------------------------------------

def _bird_or_fox(ctx, side, build_fn):
    P = ctx['P']
    s = 1 if side == 'L' else -1
    # out at the edge of the shoulder (and a touch forward) so the pet clears the side hair
    perch = Vector((s * (P['shoulder_x'] + 0.1), -0.02, P['shoulder_z'] + 0.005))
    return build_fn(perch, s, ctx)


def falcon(ctx):
    def make(c, s, ctx):
        parts = []
        body = M.sphere(c + Vector((0, 0.006, 0.03)), (0.032, 0.042, 0.04))
        parts.append(_obj('falcon_body', body, WHITE, 'chest'))
        head = M.sphere(c + Vector((0, -0.016, 0.08)), (0.027, 0.027, 0.026))
        parts.append(_obj('falcon_head', head, WHITE, 'chest'))
        # hooked beak
        v, f, r = M.tube([c + Vector((0, -0.038, 0.08)), c + Vector((0, -0.052, 0.074)), c + Vector((0, -0.056, 0.062))], [0.009, 0.006, 0.001], sides=5, tip_end=True)
        parts.append(_obj('falcon_beak', (v, f), BEAK, 'chest', tip_rings=r))
        # eyes
        for e in (1, -1):
            parts.append(_obj('falcon_eye', M.sphere(c + Vector((e * 0.016, -0.035, 0.088)), (0.005, 0.004, 0.005)), EYE, 'chest', levels=0))
        # folded wings with grey tips, swept back
        for w in (1, -1):
            v, f, r = M.tube([c + Vector((w * 0.03, -0.01, 0.05)), c + Vector((w * 0.034, 0.03, 0.03)), c + Vector((w * 0.026, 0.07, 0.012))], [(0.012, 0.024), (0.011, 0.02), (0.001, 0.001)], sides=6, tip_end=True, up=Vector((1, 0, 0)))
            parts.append(_obj('falcon_wing', (v, f), '#d9dde6', 'chest', tip_rings=r))
        # tail fan
        v, f, r = M.tube([c + Vector((0, 0.04, 0.02)), c + Vector((0, 0.08, 0.0))], [(0.018, 0.006), (0.022, 0.004)], sides=4)
        parts.append(_obj('falcon_tail', (v, f), '#c9ced8', 'chest'))
        return parts
    return _bird_or_fox(ctx, 'L', make)


# ---------------------------------------------------------------------------
# Quiver (Hana): a leather tube across the back with fletched arrow ends.
# ---------------------------------------------------------------------------

def quiver(ctx):
    P = ctx['P']
    pal = ctx['pal']
    tz, top = P['torso_bottom'], P['torso_top']
    back = P['torso_d'][0] * 0.5 + 0.03
    # steep diagonal so the fletching peeks out past the braid, over the right shoulder
    a = Vector((0.08, back, tz + 0.03))
    b = Vector((-0.16, back + 0.03, top + 0.08))
    leather = darken(pal['weapon'], 0.1)
    v, f, r = M.tube([a, a.lerp(b, 0.5), b], [0.03, 0.032, 0.033], sides=8)
    parts = [_obj('quiver', (v, f), leather, 'chest')]
    v, f, r = M.tube([b - (b - a).normalized() * 0.015, b + (b - a).normalized() * 0.004], 0.037, sides=8)
    parts.append(_obj('quiver_rim', (v, f), darken(leather, 0.35), 'chest'))
    d = (b - a).normalized()
    for k, off in enumerate((Vector((0.012, 0, 0)), Vector((-0.012, 0.004, 0.004)), Vector((0, -0.01, 0.0)))):
        p0 = b + off
        v, f, rr = M.tube([p0, p0 + d * 0.045, p0 + d * 0.06], [(0.012, 0.003), (0.012, 0.003), (0.001, 0.001)], sides=4, tip_end=True, up=Vector((0, 1, 0)))
        parts.append(_obj('fletch', (v, f), WHITE if k != 1 else pal['accent'], 'chest', tip_rings=rr, levels=0))
    return parts


# ---------------------------------------------------------------------------
# Fox familiar (Ruri): a tiny white fox spirit sitting on the right shoulder.
# ---------------------------------------------------------------------------

def fox_familiar(ctx):
    def make(c, s, ctx):
        parts = []
        parts.append(_obj('kon_body', M.sphere(c + Vector((0, 0.004, 0.032)), (0.03, 0.034, 0.036)), WHITE, 'chest'))
        h = c + Vector((0, -0.012, 0.08))
        parts.append(_obj('kon_head', M.sphere(h, (0.03, 0.027, 0.025)), WHITE, 'chest'))
        # snout
        v, f, r = M.tube([h + Vector((0, -0.02, -0.006)), h + Vector((0, -0.042, -0.01))], [0.013, 0.004], sides=6)
        parts.append(_obj('kon_snout', (v, f), WHITE, 'chest'))
        parts.append(_obj('kon_nose', M.sphere(h + Vector((0, -0.044, -0.009)), (0.004, 0.004, 0.004)), EYE, 'chest', levels=0))
        for e in (1, -1):
            parts.append(_obj('kon_eye', M.sphere(h + Vector((e * 0.013, -0.022, 0.006)), (0.004, 0.003, 0.005)), EYE, 'chest', levels=0))
            v, f, r = M.tube([h + Vector((e * 0.016, 0.0, 0.014)), h + Vector((e * 0.022, 0.002, 0.034)), h + Vector((e * 0.026, 0.004, 0.05))], [(0.011, 0.005), (0.008, 0.004), (0.001, 0.001)], sides=5, tip_end=True)
            parts.append(_obj('kon_ear', (v, f), WHITE, 'chest', tip_rings=r))
            parts.append(_obj('kon_ear_in', M.sphere(h + Vector((e * 0.02, -0.004, 0.028)), (0.004, 0.002, 0.008)), '#ffb7c9', 'chest', levels=0))
        # big tail curling up behind
        v, f, r = M.tube([c + Vector((0, 0.03, 0.02)), c + Vector((-s * 0.02, 0.06, 0.04)), c + Vector((-s * 0.03, 0.065, 0.08)), c + Vector((-s * 0.02, 0.05, 0.11))], [0.012, 0.022, 0.02, 0.001], sides=6, tip_end=True)
        tail = M.new_object('kon_tail', v, f, color=WHITE, bone='chest')
        M.crease(tail, M.tip_edges(r), 0.6)
        M.finish(tail, levels=1)
        M.set_color(tail, WHITE, fn=lambda co: mix(WHITE, '#9fd6ff', max(0.0, min(1.0, (co.z - (c.z + 0.085)) / 0.02))))
        parts.append(tail)
        return parts
    return _bird_or_fox(ctx, 'R', make)


# ---------------------------------------------------------------------------
# Taiko drum (Kanna): a small barrel drum slung at the left hip, heads facing sideways.
# ---------------------------------------------------------------------------

def taiko_drum(ctx):
    P = ctx['P']
    pal = ctx['pal']
    tz = P['torso_bottom']
    hw = P['torso_w'][2] * 0.5
    c = Vector((hw + 0.1, -0.035, tz - 0.05))
    wood = '#9a3b2c'
    hide = '#f3e9d2'
    # barrel along X: lathe around Z, then rotate onto X
    prof = [(0.062, -0.055), (0.074, -0.036), (0.079, 0.0), (0.074, 0.036), (0.062, 0.055)]
    v, f, r = M.lathe(prof, segments=12, close_top=True, close_bottom=True)
    rot = Matrix.Rotation(math.radians(90), 4, 'Y')
    v = [tuple(c + (rot @ Vector(p))) for p in v]
    body = _obj('taiko', (v, f), wood, 'hips')
    parts = [body]
    for sgn in (1, -1):
        v, f, r = M.lathe([(0.064, 0.0), (0.064, 0.006)], segments=12, close_top=True, close_bottom=True, center=(0, 0, sgn * 0.057))
        v = [tuple(c + (rot @ Vector(p))) for p in v]
        parts.append(_obj('taiko_head', (v, f), hide, 'hips'))
        # gold studs ring
        for k in range(6):
            a = k / 6 * math.pi * 2
            p = Vector((math.cos(a) * 0.068, math.sin(a) * 0.068, sgn * 0.049))
            parts.append(_obj('taiko_stud', M.sphere(tuple(c + (rot @ p)), (0.006, 0.006, 0.006)), '#e9c46a', 'hips', levels=0))
    # strap up to the waist
    v, f, r = M.tube([c + Vector((-0.03, 0.0, 0.07)), Vector((hw * 0.6, -0.02, tz + 0.12))], (0.012, 0.004), sides=4, up=Vector((0, -1, 0)))
    parts.append(_obj('taiko_strap', (v, f), darken(pal['outfitShade'], 0.2), 'hips'))
    return parts


# ---------------------------------------------------------------------------
# Mortar tube (Tsubaki): a star-studded brass tube strapped diagonally across the back.
# ---------------------------------------------------------------------------

def mortar_tube(ctx):
    P = ctx['P']
    pal = ctx['pal']
    tz, top = P['torso_bottom'], P['torso_top']
    back = P['torso_d'][0] * 0.5 + 0.035
    # long enough that both ends clear her long hair: the muzzle rises beside her head
    a = Vector((-0.15, back + 0.01, tz - 0.04))
    b = Vector((0.26, back + 0.05, top + 0.19))
    brass = pal['weapon']
    v, f, r = M.tube([a, a.lerp(b, 0.5), b], [0.034, 0.036, 0.038], sides=10)
    o = M.new_object('mortar', v, f, color=brass, bone='chest')
    M.crease_ring(o, r[-1], 0.9)
    M.finish(o, levels=1)
    parts = [o]
    d = (b - a).normalized()
    for t, col in ((0.18, pal['accent']), (0.82, pal['accent'])):
        p = a.lerp(b, t)
        v, f, r = M.tube([p - d * 0.012, p + d * 0.012], 0.042, sides=10)
        parts.append(_obj('mortar_band', (v, f), col, 'chest'))
    v, f, r = M.tube([b - d * 0.004, b + d * 0.004], 0.03, sides=10)
    parts.append(_obj('mortar_muzzle', (v, f), '#2b2733', 'chest'))
    # little gold stars along the tube (studs facing out of the back)
    for t in (0.35, 0.5, 0.65):
        p = a.lerp(b, t) + Vector((0, 0.036, 0))
        parts.append(_obj('mortar_star', M.sphere(p, (0.009, 0.006, 0.009)), '#ffd45e', 'chest', levels=0))
    # strap across the chest
    v, f, r = M.tube([Vector((0.09, back - 0.02, tz + 0.03)), Vector((0.03, -P['torso_d'][0] * 0.5 - 0.005, (tz + top) / 2)), Vector((-0.09, back - 0.03, top - 0.005))], (0.012, 0.004), sides=4, up=Vector((0, -1, 0)))
    parts.append(_obj('mortar_strap', (v, f), darken(pal['outfitShade'], 0.25), 'chest'))
    return parts


# ---------------------------------------------------------------------------
# Monocle (Kohaku): a gold ring over the right eye with a short chain to the ear.
# ---------------------------------------------------------------------------

def monocle(ctx):
    P = ctx['P']
    hc, R = P['head_center'], P['head_radii']
    lo = hc.z - R.z
    ez = lo + P['eye_v'] * (2 * R.z)
    ex = -(0.205 if not P['adult'] else 0.195) * (2 * R.x)
    # the face plane sits a little behind the ellipsoid front at the eye; float the ring just in front
    dx, dz = ex / R.x, (ez - hc.z) / R.z
    ey = hc.y - R.y * math.sqrt(max(0.0, 1 - dx * dx - dz * dz)) - 0.018
    c = Vector((ex, ey, ez))
    pts = []
    n = 14
    for i in range(n + 1):
        a = i / n * math.pi * 2
        pts.append(c + Vector((math.cos(a) * 0.05, 0.0, math.sin(a) * 0.052)))
    v, f, r = M.tube(pts, (0.0055, 0.0045), sides=5, cap_start=True, cap_end=True, up=Vector((0, -1, 0)))
    parts = [_obj('monocle', (v, f), '#e9c46a', 'head')]
    # chain hanging down to the side
    ch = [c + Vector((-0.045, 0.005, -0.02)), c + Vector((-0.06, 0.03, -0.07)), c + Vector((-0.07, 0.07, -0.08))]
    v, f, r = M.tube(ch, 0.0025, sides=4)
    parts.append(_obj('monocle_chain', (v, f), '#d9b34a', 'head', levels=0))
    return parts


# ---------------------------------------------------------------------------
# Tail bows (Fuu): a ribbon bow on each twintail tie, in the accent colour. hair.style_twintails records the
# tie points in ctx['tail_ties']; the bow faces mostly forward (turned a little outwards) so it reads from
# the front and from the 48 deg battle camera. Weighted to the head like the ties themselves.
# ---------------------------------------------------------------------------

def tail_bows(ctx):
    from .outfit import bow
    col = ctx['pal'].get('ribbon', ctx['pal']['accent'])
    parts = []
    for s, tie, n, r in ctx.get('tail_ties', []):
        face = Vector((n.x * 0.75, -0.9, 0.0)).normalized()
        theta = math.atan2(face.x, -face.y)
        place = Matrix.Translation(tie + Vector((n.x, n.y, 0)).normalized() * r * 0.35 + face * r * 0.9 + Vector((0, 0, 0.012))) @ Matrix.Rotation(theta, 4, 'Z')
        for o in bow((0, 0, 0), col, size=0.042, bone='head', tails=True, tail_levels=1, knot_levels=0):
            o.data.transform(place)
            o.data.update()
            parts.append(o)
    return parts


# ---------------------------------------------------------------------------
# Festival taiko on a stand (Kanna's portrait): a big red-brown barrel drum at her front-left on a black
# X-stand, its ivory head tilted up towards the 48 deg battle camera and turned a little towards her, gold
# studs round the front rim, a flat gold sakura crest on the head and a black amplifier collar with glowing
# vents (halo material). It stands on the ground beside her, so it is weighted to the root bone: the clips
# move her body but leave the drum where it is.
# ---------------------------------------------------------------------------

def _flower(r_in, r_out, lobes=5, per=5, phase=math.pi / 2):
    """Outline of a flat flower: `lobes` round petals, `per` points each, starting on a petal tip."""
    pts = []
    n = lobes * per
    for k in range(n):
        a = phase + k / n * math.pi * 2
        w = abs(math.cos(lobes * (a - phase) / 2)) ** 0.8
        r = r_in + (r_out - r_in) * w
        pts.append((math.cos(a) * r, math.sin(a) * r))
    return pts


def _slab(points2d, z, t):
    """Thin flat slab of a CCW outline in the local xy plane, centred on height z, wound explicitly (top face +z):
    M.plate's winding check can flip a concave outline such as a flower."""
    n = len(points2d)
    verts = [(a, b, z - t / 2) for a, b in points2d] + [(a, b, z + t / 2) for a, b in points2d]
    faces = [tuple(reversed(range(n))), tuple(range(n, 2 * n))]
    faces += [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    return verts, faces


def taiko_stand(ctx):
    pal = ctx['pal']
    gold = pal.get('trim', '#e9c24a')
    wood, hide, rim, black = '#9c3a22', '#f6ead0', '#e2cda0', '#231c22'
    lod = M.LEVEL_DROP[0] > 0                  # the LOD (medium/low quality) drops the sub-pixel studs, feet and the back rim
    seg = 10 if lod else 14
    R, hl = 0.124, 0.088                       # barrel radius at the heads, half length
    C = Vector((0.318, -0.232, 0.215))         # front-left of her, clear of her left hand and stick in every clip
    tilt, yaw = math.radians(40), math.radians(-16)
    X = Matrix.Translation(C) @ Matrix.Rotation(yaw, 4, 'Z') @ Matrix.Rotation(tilt, 4, 'X')
    Y = Matrix.Translation(C) @ Matrix.Rotation(yaw, 4, 'Z')

    def put(vf, M4):
        v, f = vf[0], vf[1]
        return [tuple(M4 @ Vector(p)) for p in v], f

    def dot(name, p, size, color, M4=X):
        return _obj(name, put(M.box(p, size), M4), color, 'root', levels=0)

    parts = []
    v, f, r = M.lathe([(R * 0.98, -hl), (R * 1.08, -hl * 0.5), (R * 1.12, 0.0), (R * 1.08, hl * 0.5), (R * 0.98, hl)], segments=seg)
    parts.append(_obj('taiko_barrel', put((v, f), X), wood, 'root'))
    for sgn in (1, -1):
        # the back head and rim face away from the battle camera: no subdivision there, and no back rim in the LOD
        lv = 1 if sgn > 0 else 0
        v, f, r = M.lathe([(R * 0.99, 0.0), (R * 0.99, 0.008)], segments=seg, center=(0, 0, sgn * (hl - 0.002) - (0.008 if sgn < 0 else 0.0)))
        parts.append(_obj('taiko_head', put((v, f), X), hide, 'root', levels=lv))
        if sgn > 0 or not lod:
            v, f, r = M.tube([Vector((0, 0, sgn * (hl - 0.014))), Vector((0, 0, sgn * (hl + 0.002)))], R * 1.03, sides=seg)
            parts.append(_obj('taiko_rim', put((v, f), X), rim, 'root', levels=lv))
    # gold studs round the front rim (the back one is hidden from the battle camera)
    for k in range(0 if lod else 12):
        a = k / 12 * math.pi * 2
        parts.append(dot('taiko_stud', (math.cos(a) * R * 1.06, math.sin(a) * R * 1.06, hl - 0.024), (0.011, 0.011, 0.011), gold))
    # crest on the front head (the Drum Club sakura): one flat five-petal gold flower round a small pale-gold centre
    top = hl + 0.008
    v, f = _slab(_flower(0.016, 0.05), top, 0.003)
    parts.append(_obj('taiko_crest', put((v, f), X), gold, 'root', levels=0))
    v, f = _slab(_flower(0.008, 0.011, lobes=5, per=1), top + 0.002, 0.003)
    parts.append(_obj('taiko_crest', put((v, f), X), mix(gold, hide, 0.55), 'root', levels=0))
    # amplifier collar round the middle with four glowing vents
    v, f, r = M.tube([Vector((0, 0, -0.021)), Vector((0, 0, 0.021))], R * 1.15, sides=seg)
    parts.append(_obj('taiko_amp', put((v, f), X), black, 'root'))
    for k in range(4):
        a = math.pi * (0.25 + k * 0.5)
        g = dot('taiko_vent', (math.cos(a) * R * 1.17, math.sin(a) * R * 1.17, 0.0), (0.024, 0.024, 0.024), pal['halo'])
        g['material'] = 'halo'
        parts.append(g)
    # X-stand: a pair of crossed black legs under each side of the barrel, gold feet
    fz = -C.z + 0.006
    for sx in (-1, 1):
        x = sx * R * 0.8
        for (y0, y1, z1) in ((-0.108, 0.06, 0.0), (0.108, -0.06, -0.014)):
            a, b = Vector((x, y0, fz)), Vector((x, y1, z1))
            v, f, r = M.tube([a, b], 0.0105, sides=4, roll=math.pi / 4)
            parts.append(_obj('taiko_leg', put((v, f), Y), black, 'root', levels=0))
            if not lod:
                parts.append(dot('taiko_foot', a + Vector((0, 0, 0.005)), (0.026, 0.026, 0.017), gold, Y))
    v, f, r = M.tube([Vector((-R * 0.8, 0.078, fz + 0.036)), Vector((R * 0.8, 0.078, fz + 0.036))], 0.009, sides=4, roll=math.pi / 4)
    parts.append(_obj('taiko_rail', put((v, f), Y), black, 'root', levels=0))
    return parts


# ---------------------------------------------------------------------------
# Card dealer (Ena): the wrist launcher from her bio, a black cuff with silver rims and a glowing crimson slit on
# her left wrist, plus a crimson thread wound round each wrist (her red threads of fate).
# ---------------------------------------------------------------------------

def card_dealer(ctx):
    P = ctx['P']
    pal = ctx['pal']
    red = pal['accent']
    parts = []
    for side, s in (('L', 1), ('R', -1)):
        el = Vector((P['elbow'].x * s, P['elbow'].y, P['elbow'].z))
        wr = Vector((P['wrist'].x * s, P['wrist'].y, P['wrist'].z))
        d = (wr - el).normalized()
        r = P['forearm_r']
        bones = [(f'forearm_{side}', el, wr)]
        if side == 'L':
            c = el.lerp(wr, 0.72)
            v, f, rings = M.tube([c - d * 0.02, c + d * 0.02], r * 1.42, sides=8)
            parts.append(_obj('dealer', (v, f), '#25222a', f'forearm_{side}'))
            for e in (-1, 1):
                v, f, rings = M.tube([c + d * (e * 0.019 - 0.003), c + d * (e * 0.019 + 0.003)], r * 1.5, sides=8)
                parts.append(_obj('dealer_rim', (v, f), '#bfbcc8', f'forearm_{side}'))
            # the slit on the outer face, where the cards come out
            o = Vector((s, -0.35, 0.25)).normalized()
            v, f = M.box(c + o * r * 1.42, (0.012, 0.012, 0.03))
            parts.append(_obj('dealer_slit', (v, f), mix(red, '#ff5a70', 0.4), f'forearm_{side}', levels=0))
        # the thread: a thin crimson ring just below the cuff
        p = el.lerp(wr, 0.97)
        v, f, rings = M.tube([p - d * 0.003, p + d * 0.003], r * 1.08, sides=8)
        parts.append(_obj('thread', (v, f), red, f'forearm_{side}', levels=0))
    return parts


# ---------------------------------------------------------------------------
# Flight headset (Seiran): a white ear cup with a gold rim and a teal light over her left ear, a small swept
# white fin rising from it, and a dark mic boom curving to the corner of her mouth. The band runs behind the
# head under the hair (not modelled, so it never fights the horns). Weighted to the head.
# ---------------------------------------------------------------------------

def flight_headset(ctx):
    from .hair import HAIR_TOP
    H, pal, P = ctx['H'], ctx['pal'], ctx['P']
    gold = pal.get('trim', '#e2b552')
    shell = '#f4f6fa'
    dark = '#566075'
    light = mix(pal['accent'], '#bff4ff', 0.35)
    c = H.surf(88, -4, HAIR_TOP + 0.05)  # out past the side locks so the cup shows from the front
    n = H.normal(88, -4)
    parts = []
    # ear cup: a short fat disc along the side normal, a gold rim ring and a glowing-teal dot on the outside
    v, f, r = M.tube([c - n * 0.012, c + n * 0.012, c + n * 0.02], [(0.038, 0.044), (0.038, 0.044), (0.026, 0.03)], sides=10)
    parts.append(_obj('headset_cup', (v, f), shell, 'head', levels=1))
    v, f, r = M.tube([c + n * 0.002, c + n * 0.014], [(0.041, 0.047), (0.041, 0.047)], sides=10)
    parts.append(_obj('headset_rim', (v, f), gold, 'head', levels=0))
    if not M.LEVEL_DROP[0]:  # sub-pixel at medium/low quality
        v, f = M.sphere(c + n * 0.024, (0.008, 0.008, 0.008))
        parts.append(_obj('headset_light', (v, f), light, 'head', levels=0))
    # a small white fin swept up and back from the cup (her headset's antenna)
    fin = [c + n * 0.008 + Vector((0, 0.008, 0.03)), c + n * 0.008 + Vector((0, 0.022, 0.066)), c + n * 0.006 + Vector((0, 0.04, 0.1))]
    v, f, r = M.tube(fin, [(0.004, 0.011), (0.003, 0.008), (0.001, 0.001)], sides=4, tip_end=True, up=n)
    parts.append(_obj('headset_fin', (v, f), shell, 'head', levels=1, tip_rings=r))
    # mic boom from the front of the cup round the cheek to the corner of her mouth
    hc, R = P['head_center'], P['head_radii']
    # a short boom: from the cup forward round the jaw, ending beside the cheek (not across the face)
    mouth = Vector((0.132, hc.y - R.y * 0.9, hc.z - R.z * 0.64))
    boom = [c + n * 0.004 + Vector((0, -0.03, -0.016)), Vector((c.x * 0.84, hc.y - R.y * 0.58, hc.z - R.z * 0.52)), mouth]
    v, f, r = M.tube(boom, 0.0036, sides=5)
    parts.append(_obj('headset_boom', (v, f), dark, 'head', levels=1))
    v, f = M.sphere(mouth, (0.0095, 0.008, 0.008))
    parts.append(_obj('headset_mic', (v, f), dark, 'head', levels=1))
    return parts


# ---------------------------------------------------------------------------
# Straw sun hat (Chigusa): a wide soft brim and a low rounded crown in straw, with a green band and a
# little sprout leaf. Pairs with LOOK_OVERRIDES haloLift (ctx halo_lift) so her halo floats above it.
# ---------------------------------------------------------------------------

def sun_hat(ctx):
    from .accessory import HAIR_TOP
    H = ctx['H']
    straw = '#e8c872'
    top = H.surf(0, 90, HAIR_TOP - 0.02)
    base = Vector((top.x, top.y + 0.012, top.z - 0.03))
    v, f, r = M.lathe([(H.R.x * 1.55, -0.012), (H.R.x * 1.25, 0.0), (H.R.x * 0.95, 0.012)], segments=16, close_top=True, close_bottom=True,
                      center=(base.x, base.y, base.z), scale_xy=(1.0, 1.05))
    parts = [_obj('sunhat_brim', (v, f), straw, 'head', levels=2)]
    v, f = M.sphere((base.x, base.y, base.z + 0.01), (H.R.x * 0.9, H.R.y * 0.92, 0.07))
    v = [(x, y, z if z >= base.z + 0.01 else base.z + 0.01) for x, y, z in v]
    parts.append(_obj('sunhat_crown', (v, f), straw, 'head', levels=1))
    v, f, r = M.tube([base + Vector((0, 0, 0.008)), base + Vector((0, 0, 0.026))], (H.R.x * 0.92, H.R.y * 0.95), sides=12)
    parts.append(_obj('sunhat_band', (v, f), '#5f8f3a', 'head', levels=1))
    leaf = base + Vector((H.R.x * 0.7, -H.R.y * 0.5, 0.03))
    v, f = M.sphere(leaf, (0.03, 0.012, 0.018))
    parts.append(_obj('sunhat_leaf', (v, f), '#6fcf5e', 'head', levels=1))
    return parts


EXTRAS = dict(sunHat=sun_hat, tailBows=tail_bows, taikoStand=taiko_stand, cardDealer=card_dealer, flightHeadset=flight_headset, foxTail=fox_tail,
              falcon=falcon, quiver=quiver, foxFamiliar=fox_familiar, taikoDrum=taiko_drum, mortarTube=mortar_tube, monocle=monocle)
