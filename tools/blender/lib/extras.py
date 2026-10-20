"""Per-unit extra parts (ROSTER_SPEC §4.5): a fox tail, a falcon on the shoulder, a quiver, a fox
familiar, a taiko drum at the hip, a mortar tube on the back and a monocle.

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
# Straw sun hat (Chigusa): a wide soft brim and a low rounded crown in straw, with a green band and a
# little sprout leaf. Pairs with FIGURE_OPTIONS halo_lift so her halo floats above it.
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


EXTRAS = dict(sunHat=sun_hat, foxTail=fox_tail, falcon=falcon, quiver=quiver, foxFamiliar=fox_familiar, taikoDrum=taiko_drum,
              mortarTube=mortar_tube, monocle=monocle)
