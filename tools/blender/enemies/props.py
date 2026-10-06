"""Shared enemy props (EnemyDef.model.props vocabulary), built as separate cage parts
tagged vis='prop:<name>' so the runtime toggles them per variant.

Each builder takes (ctx, A) where A are the family's anchors (enemy space, Z up, facing -Y):
  A['head']   (center Vector, radii Vector)      A['bone_head']
  A['top']    point on top of the head           A['back']  point on the upper back   A['bone_back']
  A['hand_R'] / A['hand_L']  hand centres        A['bone_hand_R'] / A['bone_hand_L']
  A['chest']  front-of-chest point               A['bone_chest']
  A['neck']   neck centre (scarf)                A['s']  prop size factor
Families build their own version of a prop by adding its name to ctx['done'].
"""
import math
from mathutils import Vector, Matrix

from lib import mesh as M
from lib.colors import mix, darken, lighten
import parts as P

GOLD = '#ffd45e'
GOLD_DARK = '#c9962b'
METAL = '#b4bcc8'
METAL_DARK = '#6c7482'
WOOD = '#8a5a3c'
BONE = '#f4ecd8'
GLOW_WARM = '#ffd166'


def _s(A):
    return A.get('s', 1.0)


def _head(A):
    c, r = A['head']
    return Vector(c), Vector(r)


def helmet(ctx, A):
    c, r = _head(A)
    b = A['bone_head']
    rr = r.x * 1.1
    # the rim sits above the eye line (eye_v ≈ 0.5-0.56 of the face box) so the painted
    # eyes stay visible under the brim; the cap is squashed so it still hugs the cranium
    z0 = c.z + r.z * 0.36
    cap = P.lathe('helmet', [(0.001, r.z * 0.8), (rr * 0.55, r.z * 0.73), (rr * 0.9, r.z * 0.46), (rr * 1.02, r.z * 0.14), (rr * 1.0, 0.0)],
                  METAL, 'fixed', b, segments=12, center=(c.x, c.y, z0), levels=1, vis='prop:helmet', scale_xy=(1.0, r.y / r.x))
    rim = P.ring('helmet_rim', (c.x, c.y, z0 + 0.005), rr * 0.98, 0.022 * _s(A), METAL_DARK, 'fixed', b, segments=14, vis='prop:helmet')
    P.xform(rim, scale=(1.0, r.y / r.x, 1.0))
    nose = P.box('helmet_nose', (c.x, c.y - r.y * 1.0, z0 - r.z * 0.2), (0.06 * _s(A), 0.04, r.z * 0.46), METAL_DARK, 'fixed', b, levels=1, crease=0.6, vis='prop:helmet')
    out = [cap, rim, nose]
    if A.get('boss'):
        for s in (1, -1):
            base = Vector((c.x + s * rr * 0.75, c.y, z0 + r.z * 0.45))
            out.append(P.tube('helmet_horn', [base, base + Vector((s * 0.09, 0, 0.08)), base + Vector((s * 0.15, -0.02, 0.2))], [0.045, 0.03, 0.001], BONE, 'fixed', b, sides=6, levels=1, tip_end=True, vis='prop:helmet'))
    return out


def hood(ctx, A):
    c, r = _head(A)
    b = A['bone_head']

    def shape(p):
        q = Vector(p)
        if q.y < -0.15:
            q.y = -0.15 + (q.y + 0.15) * 0.25
        return q
    o = P.blob('hood', (c.x, c.y + r.y * 0.1, c.z + r.z * 0.06), (r.x * 1.22, r.y * 1.2, r.z * 1.22), '#ffffff', 'accent', b, levels=1, shape=shape, vis='prop:hood')
    P.paint(o, (0.55, 0.55, 0.55), 'accent')
    tip = P.tube('hood_tip', [Vector((c.x, c.y + r.y * 0.8, c.z + r.z * 1.0)), Vector((c.x, c.y + r.y * 1.1, c.z + r.z * 1.25)), Vector((c.x, c.y + r.y * 1.5, c.z + r.z * 1.3))],
                 [r.x * 0.45, r.x * 0.25, 0.001], (0.55, 0.55, 0.55), 'accent', b, sides=6, levels=1, tip_end=True, vis='prop:hood')
    return [o, tip]


def crown(ctx, A, name='crown', color=GOLD, spikes=5, size=1.0):
    c, r = _head(A)
    b = A['bone_head']
    top = Vector(A['top'])
    rr = r.x * 0.55 * size
    base = Vector((top.x, top.y + r.y * 0.05, top.z - r.z * 0.06))
    ringo = P.lathe(f'{name}_ring', [(rr * 0.88, 0.0), (rr, 0.01), (rr * 1.02, 0.05), (rr * 0.98, 0.065)], color, 'fixed', b, segments=12, center=tuple(base), levels=1, vis=f'prop:{name}')
    out = [ringo]
    for i in range(spikes):
        a = i / spikes * math.pi * 2 + math.pi / 2
        p = base + Vector((math.cos(a) * rr * 0.95, math.sin(a) * rr * 0.9, 0.06))
        out.append(P.tube(f'{name}_spike', [p, p + Vector((0, 0, 0.06 * size)), p + Vector((0, 0, 0.11 * size))], [0.024 * size, 0.018 * size, 0.001], color, 'fixed', b, sides=5, levels=0, tip_end=True, vis=f'prop:{name}'))
    gem = P.blob(f'{name}_gem', base + Vector((0, -rr * 0.95, 0.035)), (0.022 * size, 0.014 * size, 0.022 * size), '#ff5f8f', 'fixed', b, levels=1, vis=f'prop:{name}')
    out.append(gem)
    return out


def tiara(ctx, A):
    return crown(ctx, A, name='tiara', color='#fff3c4', spikes=3, size=0.75)


def horns(ctx, A, color=BONE, size=1.0):
    c, r = _head(A)
    b = A['bone_head']
    out = []
    for s in (1, -1):
        base = Vector((c.x + s * r.x * 0.55, c.y - r.y * 0.05, c.z + r.z * 0.78))
        pts = [base, base + Vector((s * 0.05, 0.0, 0.1)) * size, base + Vector((s * 0.1, -0.03, 0.2)) * size, base + Vector((s * 0.17, -0.07, 0.27)) * size]
        out.append(P.tube('horn', pts, [0.06 * size, 0.05 * size, 0.03 * size, 0.001], color, 'fixed', b, sides=7, levels=2, tip_end=True, vis='prop:horns'))
    return out


def mask(ctx, A):
    """Festival half-mask pushed up on the forehead (keeps the painted face visible)."""
    c, r = _head(A)
    b = A['bone_head']
    center = Vector((c.x, c.y - r.y * 0.78, c.z + r.z * 0.72))
    o = P.blob('mask', (0, 0, 0), (r.x * 0.62, r.y * 0.18, r.z * 0.45), '#f8f0e3', 'fixed', b, levels=1, vis='prop:mask')
    P.xform(o, rot=P.rot_x(-35), loc=center)
    out = [o]
    for s in (1, -1):
        e = P.blob('mask_eye', (0, 0, 0), (r.x * 0.14, r.y * 0.06, r.z * 0.08), '#ff3b5c', 'fixed', b, levels=1, material='glow', vis='prop:mask')
        P.xform(e, rot=P.rot_x(-35), loc=center + Vector((s * r.x * 0.26, -r.y * 0.16, r.z * 0.1)))
        out.append(e)
        h = P.cone('mask_horn', center + Vector((s * r.x * 0.3, r.y * 0.05, r.z * 0.32)), center + Vector((s * r.x * 0.42, r.y * 0.02, r.z * 0.62)), r.x * 0.07, GOLD, 'fixed', b, sides=5, vis='prop:mask')
        out.append(h)
    return out


def goggles(ctx, A):
    c, r = _head(A)
    b = A['bone_head']
    z = c.z + r.z * 0.62
    strap = P.ring('goggle_strap', (c.x, c.y, z), r.x * 1.0, 0.022 * _s(A), '#4a3728', 'fixed', b, segments=14, vis='prop:goggles')
    P.xform(strap, scale=(1.0, r.y / r.x * 1.02, 1.0))
    out = [strap]
    for s in (1, -1):
        p = Vector((c.x + s * r.x * 0.38, c.y - r.y * 0.9, z + r.z * 0.05))
        cup = P.lathe('goggle_cup', [(0.001, 0.0), (0.06 * _s(A), 0.0), (0.065 * _s(A), 0.05), (0.05 * _s(A), 0.06)], '#4a3728', 'fixed', b, segments=10, center=(0, 0, 0), levels=0, vis='prop:goggles')
        P.xform(cup, rot=P.rot_x(-100), loc=p)
        lens = P.blob('goggle_lens', (0, 0, 0), (0.045 * _s(A), 0.02, 0.045 * _s(A)), '#8fe3ff', 'fixed', b, levels=0, material='glow', vis='prop:goggles')
        P.xform(lens, rot=P.rot_x(-10), loc=p + Vector((0, -0.045, 0.01)))
        out += [cup, lens]
    return out


def scarf(ctx, A):
    n = Vector(A['neck'])
    b = A.get('bone_chest', A['bone_head'])
    rr = A.get('neck_r', 0.16)
    o = P.ring('scarf', tuple(n), rr, 0.05 * _s(A), (1, 1, 1), 'accent', b, segments=12, levels=1, vis='prop:scarf')
    tail = P.tube('scarf_tail', [n + Vector((rr * 0.3, rr * 0.9, 0)), n + Vector((rr * 0.5, rr * 1.4, -0.1 * _s(A))), n + Vector((rr * 0.8, rr * 1.6, -0.28 * _s(A)))],
                  [(0.05 * _s(A), 0.02), (0.06 * _s(A), 0.02), (0.001, 0.001)], (1, 1, 1), 'accent', b, sides=6, levels=1, tip_end=True, vis='prop:scarf')
    return [o, tail]


def cape(ctx, A, length=None):
    back = Vector(A['back'])
    b = A['bone_back']
    s = _s(A)
    w = 0.32 * s
    L = length or 0.5 * s
    pts = [(-w, 0.0), (w, 0.0), (w * 1.35, -L * 0.6), (w * 1.5, -L), (-w * 1.5, -L), (-w * 1.35, -L * 0.6)]
    v, f = M.plate(pts, 0.025, center=(0, 0, 0), plane='xz')
    # curve the plate around the back and let it flare away from the body towards the hem
    v = [(x, y + 0.06 * (x / w) ** 2 + 0.22 * (z / L) ** 2 * s, z) for x, y, z in v]
    o = P.part('cape', v, f, (0.9, 0.9, 0.9), 'accent', b, vis='prop:cape')
    M.crease(o, [(0, 1), (6, 7)], 0.7)
    M.finish(o, levels=2)
    P.xform(o, loc=back + Vector((0, 0.02, 0)))
    knot = P.blob('cape_knot', back + Vector((0, -0.01, 0.0)), (w * 1.05, 0.04, 0.04), GOLD, 'fixed', b, levels=1, vis='prop:cape')
    return [o, knot]


def mane(ctx, A):
    c, r = _head(A)
    b = A['bone_head']
    out = []
    n = 9
    for i in range(n):
        a = -math.pi * 0.75 + i / (n - 1) * math.pi * 1.5
        base = Vector((c.x + math.sin(a) * r.x * 0.95, c.y - math.cos(a) * r.y * 0.25 + r.y * 0.3, c.z - r.z * 0.1 + abs(math.cos(a)) * r.z * 0.1))
        d = Vector((math.sin(a), 0.6 - math.cos(a) * 0.3, -0.5)).normalized()
        out.append(P.tube('mane_tuft', [base, base + d * 0.08 * _s(A), base + d * 0.17 * _s(A)], [0.05 * _s(A), 0.04 * _s(A), 0.001], (0.9, 0.9, 0.9), 'accent', b, sides=5, levels=0, tip_end=True, vis='prop:mane'))
    return out


def shield(ctx, A):
    h = Vector(A['hand_L'])
    b = A['bone_hand_L']
    s = _s(A)
    rr = 0.19 * s
    disc = P.lathe('shield', [(0.001, 0.045 * s), (rr * 0.5, 0.035 * s), (rr * 0.92, 0.012 * s), (rr, 0.0), (rr * 0.92, -0.01 * s), (0.001, -0.012 * s)], METAL, 'fixed', b, segments=12, center=(0, 0, 0), levels=1, vis='prop:shield')
    rim = P.ring('shield_rim', (0, 0, 0.005), rr * 0.97, 0.022 * s, GOLD, 'fixed', b, segments=14, vis='prop:shield')
    boss = P.blob('shield_boss', (0, 0, 0.05 * s), (0.05 * s, 0.05 * s, 0.03 * s), GOLD, 'fixed', b, levels=0, vis='prop:shield')
    out = [disc, rim, boss]
    for o in out:
        P.xform(o, rot=P.rot_x(-90), loc=h + Vector((-0.02 * s, -0.08 * s, 0.02)))
    return out


def tower_shield(ctx, A):
    h = Vector(A['hand_L'])
    b = A['bone_hand_L']
    s = _s(A)
    w, hh = 0.2 * s, 0.33 * s
    pts = [(-w, -hh), (w, -hh), (w * 1.05, hh * 0.4), (0.0, hh * 1.2), (-w * 1.05, hh * 0.4)]
    plate = P.plate('tower_shield', pts, 0.05 * s, center=(0, 0, 0), plane='xz', color=(1, 1, 1), role='accent', bone=b, levels=1, crease=0.8, vis='prop:towerShield')
    inner = P.plate('tower_shield_inner', [(x * 0.72, y * 0.72) for x, y in pts], 0.06 * s, center=(0, 0, 0), plane='xz', color=METAL, role='fixed', bone=b, levels=1, crease=0.8, vis='prop:towerShield')
    rivet = P.blob('tower_shield_boss', (0, -0.04 * s, 0.0), (0.045 * s, 0.03 * s, 0.045 * s), GOLD, 'fixed', b, levels=1, vis='prop:towerShield')
    out = [plate, inner, rivet]
    for o in out:
        P.xform(o, loc=h + Vector((0.0, -0.1 * s, 0.02 * s)))
    return out


def _grip(A, kind='R'):
    h = Vector(A[f'hand_{kind}'])
    return h, A[f'bone_hand_{kind}']


def club(ctx, A):
    h, b = _grip(A)
    s = _s(A)
    axis = Vector((0.15, -0.25, 1.0)).normalized()
    pts = [h - axis * 0.12 * s, h + axis * 0.12 * s, h + axis * 0.32 * s, h + axis * 0.46 * s]
    o = P.tube('club', pts, [0.03 * s, 0.035 * s, 0.075 * s, 0.07 * s], WOOD, 'fixed', b, sides=8, levels=1, vis='prop:club')
    out = [o]
    for i in range(5):
        a = i * 1.3
        p = h + axis * (0.3 + (i % 3) * 0.06) * s
        d = (Vector((math.cos(a), math.sin(a), 0)) - axis * 0.1).normalized()
        out.append(P.cone('club_spike', p + d * 0.05 * s, p + d * 0.12 * s, 0.022 * s, METAL, 'fixed', b, sides=4, vis='prop:club'))
    return out


def axe(ctx, A):
    h, b = _grip(A)
    s = _s(A)
    axis = Vector((0.15, -0.2, 1.0)).normalized()
    handle = P.tube('axe_handle', [h - axis * 0.15 * s, h + axis * 0.4 * s], [0.025 * s, 0.022 * s], WOOD, 'fixed', b, sides=6, levels=1, vis='prop:axe')
    top = h + axis * 0.32 * s
    pts = [(0.0, -0.11 * s), (0.06 * s, -0.13 * s), (0.17 * s, -0.06 * s), (0.2 * s, 0.03 * s), (0.17 * s, 0.11 * s), (0.06 * s, 0.14 * s), (0.0, 0.11 * s)]
    blade = P.plate('axe_blade', pts, 0.03 * s, center=(0, 0, 0), plane='xz', color=METAL, role='fixed', bone=b, levels=2, crease=0.9, vis='prop:axe')
    P.xform(blade, rot=P.rot_z(15), loc=top + Vector((0.02 * s, 0, 0)))
    return [handle, blade]


def spear(ctx, A):
    h, b = _grip(A)
    s = _s(A)
    axis = Vector((0.08, -0.35, 1.0)).normalized()
    shaft = P.tube('spear_shaft', [h - axis * 0.35 * s, h + axis * 0.5 * s], [0.02 * s, 0.018 * s], WOOD, 'fixed', b, sides=6, levels=1, vis='prop:spear')
    tip = P.tube('spear_tip', [h + axis * 0.48 * s, h + axis * 0.56 * s, h + axis * 0.7 * s], [0.03 * s, 0.045 * s, 0.001], METAL, 'fixed', b, sides=4, levels=1, tip_end=True, vis='prop:spear')
    band = P.ring('spear_band', (0, 0, 0), 0.03 * s, 0.012 * s, GOLD, 'fixed', b, segments=8, vis='prop:spear')
    P.xform(band, rot=Matrix.Rotation(math.atan2(-axis.y, axis.z), 4, 'X'), loc=h + axis * 0.46 * s)
    return [shaft, tip, band]


def sword(ctx, A):
    h, b = _grip(A)
    s = _s(A)
    axis = Vector((0.2, -0.3, 1.0)).normalized()
    grip = P.tube('sword_grip', [h - axis * 0.08 * s, h + axis * 0.05 * s], [0.022 * s, 0.022 * s], '#4a3050', 'fixed', b, sides=6, levels=1, vis='prop:sword')
    guard = P.box('sword_guard', tuple(h + axis * 0.06 * s), (0.14 * s, 0.03 * s, 0.03 * s), GOLD, 'fixed', b, levels=1, vis='prop:sword')
    L = 0.42 * s
    pts = [(-0.035 * s, 0.0), (0.035 * s, 0.0), (0.035 * s, L * 0.8), (0.0, L), (-0.035 * s, L * 0.8)]
    blade = P.plate('sword_blade', pts, 0.016 * s, center=(0, 0, 0), plane='xz', color=METAL, role='fixed', bone=b, levels=2, crease=1.0, vis='prop:sword')
    rot = Vector((0, 0, 1)).rotation_difference(axis).to_matrix().to_4x4()
    P.xform(blade, rot=rot, loc=h + axis * 0.08 * s)
    return [grip, guard, blade]


def staff(ctx, A):
    h, b = _grip(A)
    s = _s(A)
    top = h + Vector((0.0, -0.02, 0.5 * s))
    rod = P.tube('staff_rod', [h - Vector((0, 0, 0.35 * s)), top], [0.022 * s, 0.02 * s], '#4a3a60', 'fixed', b, sides=6, levels=1, vis='prop:staff')
    orb = P.blob('staff_orb', top + Vector((0, 0, 0.06 * s)), (0.06 * s, 0.06 * s, 0.06 * s), (1, 1, 1), 'accent', b, levels=1, material='glow', vis='prop:staff')
    ringo = P.ring('staff_ring', tuple(top + Vector((0, 0, 0.06 * s))), 0.085 * s, 0.014 * s, GOLD, 'fixed', b, segments=12, axis='y', vis='prop:staff')
    return [rod, orb, ringo]


def lantern(ctx, A):
    h, b = _grip(A)
    s = _s(A)
    c = h + Vector((0, -0.03 * s, -0.1 * s))
    body = P.box('lantern', tuple(c), (0.1 * s, 0.1 * s, 0.14 * s), '#3a3f4a', 'fixed', b, levels=2, crease=0.8, vis='prop:lantern')
    glow = P.blob('lantern_glow', c, (0.065 * s, 0.065 * s, 0.075 * s), '#b8f2e6', 'fixed', b, levels=1, material='glow', vis='prop:lantern')
    handle = P.tube('lantern_handle', [c + Vector((-0.05 * s, 0, 0.08 * s)), c + Vector((0, 0, 0.13 * s)), c + Vector((0.05 * s, 0, 0.08 * s))], [0.008, 0.008, 0.008], GOLD, 'fixed', b, sides=5, levels=1, vis='prop:lantern')
    return [body, glow, handle]


def bomb(ctx, A):
    h, b = _grip(A)
    s = _s(A)
    c = h + Vector((0, -0.05 * s, 0.1 * s))
    ball = P.blob('bomb', c, (0.13 * s, 0.13 * s, 0.13 * s), '#2b2d42', 'fixed', b, levels=1, vis='prop:bomb')
    fuse = P.tube('bomb_fuse', [c + Vector((0, 0, 0.12 * s)), c + Vector((0.02 * s, 0, 0.19 * s)), c + Vector((0.06 * s, -0.01, 0.23 * s))], [0.012, 0.012, 0.01], '#c9a27e', 'fixed', b, sides=5, levels=1, vis='prop:bomb')
    spark = P.blob('bomb_spark', c + Vector((0.07 * s, -0.01, 0.25 * s)), (0.035 * s, 0.035 * s, 0.035 * s), GLOW_WARM, 'fixed', b, levels=0, material='glow', vis='prop:bomb')
    band = P.ring('bomb_band', tuple(c), 0.125 * s, 0.012 * s, '#8d99ae', 'fixed', b, segments=12, vis='prop:bomb')
    return [ball, fuse, spark, band]


def smoke_pot(ctx, A):
    h, b = _grip(A, 'L')
    s = _s(A)
    c = h + Vector((0, -0.03 * s, 0.0))
    pot = P.lathe('smokepot', [(0.001, -0.06 * s), (0.06 * s, -0.05 * s), (0.075 * s, 0.0), (0.05 * s, 0.05 * s), (0.055 * s, 0.065 * s), (0.001, 0.07 * s)], '#5c3d2e', 'fixed', b, segments=10, center=tuple(c), levels=1, vis='prop:smokePot')
    out = [pot]
    for i in range(3):
        out.append(P.blob('smoke', c + Vector((0.02 * i * s, -0.01, (0.1 + i * 0.07) * s)), ((0.045 + i * 0.015) * s,) * 3, '#dfe3e8', 'fixed', b, levels=0, vis='prop:smokePot'))
    return out


def backpack(ctx, A):
    back = Vector(A['back'])
    b = A['bone_back']
    s = _s(A)
    c = back + Vector((0, 0.1 * s, -0.08 * s))
    pack = P.box('backpack', tuple(c), (0.24 * s, 0.16 * s, 0.26 * s), WOOD, 'fixed', b, levels=2, crease=0.5, vis='prop:backpack')
    flap = P.box('backpack_flap', tuple(c + Vector((0, 0.0, 0.12 * s))), (0.25 * s, 0.17 * s, 0.07 * s), darken(WOOD, 0.25), 'fixed', b, levels=2, crease=0.6, vis='prop:backpack')
    knob = P.blob('backpack_knob', c + Vector((0.08 * s, 0.09 * s, 0.1 * s)), (0.03 * s,) * 3, GOLD, 'fixed', b, levels=1, vis='prop:backpack')
    return [pack, flap, knob]


def wrench(ctx, A):
    h, b = _grip(A)
    s = _s(A)
    axis = Vector((0.4, -0.3, 1.0)).normalized()
    rod = P.tube('wrench_rod', [h - axis * 0.1 * s, h + axis * 0.26 * s], [(0.03 * s, 0.018 * s), (0.028 * s, 0.016 * s)], METAL, 'fixed', b, sides=4, levels=1, vis='prop:wrench')
    head = h + axis * 0.3 * s
    pts = [(-0.07 * s, -0.04 * s), (0.07 * s, -0.04 * s), (0.07 * s, 0.03 * s), (0.03 * s, 0.03 * s), (0.03 * s, 0.09 * s), (-0.03 * s, 0.09 * s), (-0.03 * s, 0.03 * s), (-0.07 * s, 0.03 * s)]
    jaw = P.plate('wrench_head', pts, 0.03 * s, center=(0, 0, 0), plane='xz', color=METAL, role='fixed', bone=b, levels=2, crease=0.8, vis='prop:wrench')
    rot = Vector((0, 0, 1)).rotation_difference(axis).to_matrix().to_4x4()
    P.xform(jaw, rot=rot, loc=head)
    return [rod, jaw]


def drum(ctx, A):
    c = Vector(A['chest'])
    b = A['bone_chest']
    s = _s(A)
    rr = 0.2 * s
    center = c + Vector((0, -rr * 0.6, -0.02))
    body = P.lathe('drum', [(0.001, -0.11 * s), (rr, -0.11 * s), (rr * 1.02, -0.09 * s), (rr * 1.02, 0.09 * s), (rr, 0.11 * s), (0.001, 0.11 * s)], '#a0522d', 'fixed', b, segments=14, center=(0, 0, 0), levels=1, crease_rings=(1, 4), vis='prop:drum')
    skin = P.lathe('drum_skin', [(0.001, 0.0), (rr * 0.96, 0.0), (rr * 0.96, 0.025 * s), (0.001, 0.025 * s)], '#fff3e0', 'fixed', b, segments=14, center=(0, 0, 0.1 * s), levels=1, vis='prop:drum')
    out = [body, skin]
    for o in out:
        P.xform(o, rot=P.rot_x(90), loc=center)
    for side in ('L', 'R'):
        h, hb = _grip(A, side)
        out.append(P.tube('drum_stick', [h, h + Vector((0, -0.2 * s, 0.1 * s))], [0.016 * s, 0.014 * s], WOOD, 'fixed', hb, sides=5, levels=1, vis='prop:drum'))
        out.append(P.blob('drum_stick_tip', h + Vector((0, -0.21 * s, 0.105 * s)), (0.025 * s,) * 3, '#fff3e0', 'fixed', hb, levels=0, vis='prop:drum'))
    return out


def fan(ctx, A):
    h, b = _grip(A)
    s = _s(A)
    pts = [(0, 0)]
    for i in range(9):
        a = math.radians(20 + 140 * i / 8)
        pts.append((math.cos(a) * 0.19 * s, math.sin(a) * 0.19 * s))
    f = P.plate('fan', pts, 0.012 * s, center=(0, 0, 0), plane='xz', color=(1, 1, 1), role='accent', bone=b, levels=1, crease=0.9, vis='prop:fan')
    P.xform(f, rot=P.rot_y(-25) @ P.rot_x(-15), loc=h + Vector((0.02 * s, -0.08 * s, 0.03 * s)))
    handle = P.tube('fan_handle', [h - Vector((0, 0, 0.06 * s)), h + Vector((0.01 * s, -0.03 * s, 0.03 * s))], [0.016 * s, 0.014 * s], '#4a3050', 'fixed', b, sides=5, levels=1, vis='prop:fan')
    return [f, handle]


def mirror(ctx, A):
    h, b = _grip(A)
    s = _s(A)
    c = h + Vector((0, -0.05 * s, 0.2 * s))
    frame = P.lathe('mirror_frame', [(0.001, -0.015 * s), (0.11 * s, -0.012 * s), (0.12 * s, 0.0), (0.11 * s, 0.015 * s), (0.001, 0.012 * s)], GOLD, 'fixed', b, segments=14, center=(0, 0, 0), levels=1, vis='prop:mirror')
    glass = P.blob('mirror_glass', (0, 0, 0.012 * s), (0.09 * s, 0.09 * s, 0.01 * s), '#e3fafc', 'fixed', b, levels=1, material='glow', vis='prop:mirror')
    out = [frame, glass]
    for o in out:
        P.xform(o, rot=P.rot_x(-80), loc=c)
    out.append(P.tube('mirror_handle', [h - Vector((0, 0, 0.05 * s)), c - Vector((0, 0, 0.1 * s))], [0.016 * s, 0.014 * s], GOLD, 'fixed', b, sides=6, levels=1, vis='prop:mirror'))
    return out


def chains(ctx, A):
    c = Vector(A['chest'])
    b = A['bone_chest']
    s = _s(A)
    w = A.get('chest_w', 0.22) * s
    pts = [c + Vector((-w, 0.0, 0.05 * s)), c + Vector((-w * 0.4, -0.05 * s, -0.08 * s)), c + Vector((w * 0.4, -0.06 * s, -0.12 * s)), c + Vector((w, -0.01, 0.02 * s))]
    chain = P.tube('chain', M.smooth_path(pts, 10), [0.02 * s] * 10, '#7c8594', 'fixed', b, sides=5, levels=1, vis='prop:chains')
    out = [chain]
    for i, t in enumerate((0.2, 0.5, 0.8)):
        p = M.smooth_path(pts, 10)[int(t * 9)]
        out.append(P.ring('chain_link', tuple(p), 0.03 * s, 0.01 * s, '#9aa3b2', 'fixed', b, segments=8, axis='y' if i % 2 else 'x', vis='prop:chains'))
    lock = P.box('chain_lock', tuple(c + Vector((0.0, -0.08 * s, -0.14 * s))), (0.08 * s, 0.05 * s, 0.09 * s), '#4a5160', 'fixed', b, levels=1, crease=0.7, vis='prop:chains')
    return out + [lock]


def candle(ctx, A):
    top = Vector(A['top'])
    b = A['bone_head']
    s = _s(A)
    wax = P.tube('candle', [top + Vector((0, 0, -0.02)), top + Vector((0, 0, 0.12 * s))], [0.04 * s, 0.038 * s], '#fff9db', 'fixed', b, sides=8, levels=1, vis='prop:candle')
    drip = P.blob('candle_drip', top + Vector((0.03 * s, -0.02, 0.1 * s)), (0.02 * s, 0.015 * s, 0.03 * s), '#fff3bf', 'fixed', b, levels=1, vis='prop:candle')
    flame = P.tube('candle_flame', [top + Vector((0, 0, 0.12 * s)), top + Vector((0, 0, 0.17 * s)), top + Vector((0.01 * s, 0, 0.24 * s))], [0.03 * s, 0.028 * s, 0.001], GLOW_WARM, 'fixed', b, sides=6, levels=1, tip_end=True, material='glow', vis='prop:candle')
    return [wax, drip, flame]


def _gear_pts(r, n=8, inner=0.78):
    pts = []
    for i in range(n * 2):
        a = i / (n * 2) * math.pi * 2
        rr = r if i % 2 == 0 else r * inner
        pts += [(math.cos(a - 0.12) * rr, math.sin(a - 0.12) * rr), (math.cos(a + 0.12) * rr, math.sin(a + 0.12) * rr)]
    return pts


def gears(ctx, A):
    back = Vector(A['back'])
    b = A['bone_back']
    s = _s(A)
    out = []
    for i, (dx, dz, r) in enumerate(((0.1, 0.02, 0.11), (-0.09, -0.06, 0.08))):
        g = P.plate('gear', _gear_pts(r * s), 0.03 * s, center=(0, 0, 0), plane='xy', color=GOLD if i == 0 else METAL, role='fixed', bone=b, levels=0, crease=1.0, vis='prop:gears')
        P.xform(g, rot=P.rot_x(90) @ P.rot_z(i * 20), loc=back + Vector((dx * s, 0.08 * s, dz * s)))
        out.append(g)
        axle = P.blob('gear_axle', back + Vector((dx * s, 0.1 * s, dz * s)), (0.028 * s, 0.02 * s, 0.028 * s), '#4a5160', 'fixed', b, levels=0, vis='prop:gears')
        out.append(axle)
    return out


def chimney(ctx, A):
    back = Vector(A['back'])
    b = A['bone_back']
    s = _s(A)
    base = back + Vector((-0.12 * s, 0.06 * s, 0.0))
    pipe = P.tube('chimney', [base, base + Vector((0, 0, 0.3 * s))], [0.06 * s, 0.05 * s], '#4a5160', 'fixed', b, sides=8, levels=1, vis='prop:chimney')
    lip = P.ring('chimney_lip', tuple(base + Vector((0, 0, 0.3 * s))), 0.055 * s, 0.016 * s, '#2f3540', 'fixed', b, segments=10, vis='prop:chimney')
    out = [pipe, lip]
    for i in range(3):
        out.append(P.blob('chimney_smoke', base + Vector((-0.02 * i * s, 0.01 * i * s, (0.36 + i * 0.08) * s)), ((0.05 + i * 0.015) * s,) * 3, '#e9ecef', 'fixed', b, levels=0, vis='prop:chimney'))
    return out


def cannon(ctx, A):
    back = Vector(A['back'])
    b = A['bone_back']
    s = _s(A)
    base = back + Vector((0.16 * s, 0.0, 0.06 * s))
    barrel = P.tube('cannon', [base + Vector((0, 0.1 * s, 0)), base + Vector((0, -0.2 * s, 0.05 * s)), base + Vector((0, -0.32 * s, 0.08 * s))], [0.07 * s, 0.065 * s, 0.075 * s], '#2f3540', 'fixed', b, sides=10, levels=1, vis='prop:cannon')
    muzzle = P.ring('cannon_muzzle', (0, 0, 0), 0.07 * s, 0.02 * s, GOLD, 'fixed', b, segments=10, axis='y', vis='prop:cannon')
    P.xform(muzzle, rot=P.rot_x(-15), loc=base + Vector((0, -0.32 * s, 0.08 * s)))
    mount = P.blob('cannon_mount', base + Vector((0, 0.05 * s, -0.02 * s)), (0.09 * s, 0.08 * s, 0.07 * s), METAL_DARK, 'fixed', b, levels=1, vis='prop:cannon')
    return [barrel, muzzle, mount]


def crystals(ctx, A, name='crystals', at=None, n=5, size=None, bone=None, color='#a5f3fc'):
    base = Vector(at if at is not None else A['back'])
    b = bone or A['bone_back']
    s = size or 0.16 * _s(A)
    out = []
    for i in range(n):
        a = i / n * math.pi * 2 + 0.7 * i
        h = s * (1.0 + (i % 3) * 0.35)
        d = Vector((math.cos(a) * 0.45, math.sin(a) * 0.3, 1.0)).normalized()
        p = base + Vector((math.cos(a) * s * 0.6, math.sin(a) * s * 0.4, 0))
        c0 = mix(color, '#ffffff', 0.15)
        o = P.tube(f'{name}_shard', [p - d * h * 0.15, p + d * h * 0.55, p + d * h], [s * 0.33, s * 0.3, 0.001], c0, 'fixed', b, sides=5, levels=1, tip_end=True, vis=f'prop:{name}')
        P.paint(o, c0, 'fixed', fn=lambda co, _p=p, _h=h, _c=color: (mix(_c, '#ffffff', min(1.0, max(0.0, (co.z - _p.z) / _h)) * 0.75), 'fixed'))
        out.append(o)
    return out


def leaves(ctx, A):
    top = Vector(A['top'])
    b = A['bone_head']
    s = _s(A)
    out = []
    for side in (1, -1):
        pts = [top + Vector((side * 0.02 * s, 0, -0.01)), top + Vector((side * 0.1 * s, -0.01, 0.07 * s)), top + Vector((side * 0.2 * s, -0.03, 0.1 * s))]
        out.append(P.tube('leaf', pts, [(0.03 * s, 0.012 * s), (0.06 * s, 0.014 * s), (0.001, 0.001)], '#5fc46a', 'fixed', b, sides=6, levels=1, tip_end=True, up=Vector((0, -1, 0)), vis='prop:leaves'))
    stem = P.tube('leaf_stem', [top + Vector((0, 0, -0.02)), top + Vector((0, 0, 0.05 * s))], [0.016 * s, 0.012 * s], '#3f8f4b', 'fixed', b, sides=5, levels=1, vis='prop:leaves')
    return out + [stem]


def flower(ctx, A, at=None, bone=None, size=1.0, petal=(1, 1, 1), role='accent'):
    c, r = _head(A)
    center = Vector(at if at is not None else Vector((c.x + r.x * 0.62, c.y - r.y * 0.55, c.z + r.z * 0.62)))
    b = bone or A['bone_head']
    n = (center - c).normalized() if at is None else Vector((0, 0, 1))
    t1 = n.cross(Vector((0, 0, 1))).normalized() if abs(n.z) < 0.95 else Vector((1, 0, 0))
    t2 = n.cross(t1).normalized()
    out = []
    s = 0.045 * _s(A) * size
    for i in range(5):
        a = i / 5 * math.pi * 2
        d = t1 * math.cos(a) + t2 * math.sin(a)
        p = center + d * s * 1.15
        o = P.blob('petal', p, (s * 0.95, s * 0.95, s * 0.95), petal, role, b, levels=0, vis='prop:flower')
        P.xform(o, loc=-p)
        P.xform(o, scale=(1, 1, 1))
        # squash the petal along the flower normal, stretch along its radial direction
        mat = Matrix.Identity(4)
        mat = Matrix.Translation(p) @ (Matrix.Scale(0.5, 4, n) @ Matrix.Scale(1.25, 4, d))
        o.data.transform(mat)
        o.data.update()
        out.append(o)
    out.append(P.blob('flower_center', center + n * s * 0.35, (s * 0.6, s * 0.6, s * 0.5), GLOW_WARM, 'fixed', b, levels=1, vis='prop:flower'))
    return out


def thorns(ctx, A):
    c = Vector(A.get('chest', A['back']))
    b = A['bone_chest']
    s = _s(A)
    out = []
    rr = A.get('body_r', 0.3)
    for i in range(10):
        a = i * 2.4
        z = c.z - 0.2 * s + (i % 4) * 0.12 * s
        d = Vector((math.sin(a), math.cos(a), 0.25)).normalized()
        p = Vector((d.x * rr * 0.9, d.y * rr * 0.9, z))
        out.append(P.cone('thorn', p, p + d * 0.1 * s, 0.03 * s, (1, 1, 1), 'accent', b, sides=4, vis='prop:thorns'))
    return out


def moss(ctx, A):
    c, r = _head(A)
    b = A['bone_head']
    bb = A['bone_back']
    s = _s(A)
    out = []
    spots = [(Vector((c.x - r.x * 0.5, c.y - r.y * 0.1, c.z + r.z * 0.75)), b), (Vector((c.x + r.x * 0.45, c.y + r.y * 0.3, c.z + r.z * 0.8)), b),
             (Vector(A['back']) + Vector((0.12 * s, -0.02, 0.02)), bb), (Vector(A['back']) + Vector((-0.1 * s, -0.02, -0.08 * s)), bb)]
    for i, (p, bone) in enumerate(spots):
        out.append(P.blob('moss', p, (0.09 * s, 0.07 * s, 0.045 * s), '#6fb24f' if i % 2 else '#8bc34a', 'fixed', bone, levels=0, vis='prop:moss'))
    return out


def mushroom(ctx, A):
    c, r = _head(A)
    b = A['bone_head']
    s = _s(A)
    p = Vector((c.x + r.x * 0.35, c.y + r.y * 0.1, c.z + r.z * 0.85))
    stem = P.tube('mushroom_stem', [p, p + Vector((0.02, 0, 0.1 * s))], [0.035 * s, 0.03 * s], '#fff3e0', 'fixed', b, sides=6, levels=1, vis='prop:mushroom')
    cap = P.lathe('mushroom_cap', [(0.001, 0.0), (0.1 * s, 0.0), (0.1 * s, 0.025 * s), (0.07 * s, 0.07 * s), (0.001, 0.09 * s)], '#e03131', 'fixed', b, segments=10, center=tuple(p + Vector((0.02, 0, 0.08 * s))), levels=1, vis='prop:mushroom')
    out = [stem, cap]
    for i in range(3):
        a = i * 2.1
        out.append(P.blob('mushroom_spot', p + Vector((0.02 + math.cos(a) * 0.055 * s, math.sin(a) * 0.055 * s, (0.13 + 0.01 * i) * s)), (0.02 * s, 0.02 * s, 0.01 * s), '#ffffff', 'fixed', b, levels=1, vis='prop:mushroom'))
    return out


def bubble(ctx, A):
    c = Vector(A.get('chest', A['back']))
    b = A['bone_chest']
    s = _s(A)
    rr = A.get('body_r', 0.4) * 1.08
    r1 = P.ring('bubble_ring', (c.x, c.y, c.z), rr, 0.02 * s, '#e7f5ff', 'fixed', b, segments=20, vis='prop:bubble')
    P.xform(r1, loc=-c)
    P.xform(r1, rot=P.rot_x(18) @ P.rot_y(10), loc=c)
    r2 = P.ring('bubble_ring', (0, 0, 0), rr * 0.98, 0.016 * s, '#d0ebff', 'fixed', b, segments=20, vis='prop:bubble')
    P.xform(r2, rot=P.rot_x(-25) @ P.rot_y(-30), loc=c)
    out = [r1, r2]
    for i in range(3):
        out.append(P.blob('bubble', c + Vector(((0.3 - i * 0.12) * s, -0.1 * s, (0.4 + i * 0.1) * s)), ((0.04 + i * 0.015) * s,) * 3, '#eef8ff', 'fixed', A['bone_head'], levels=0, material='glow', vis='prop:bubble'))
    return out


def pearl(ctx, A):
    top = Vector(A['top'])
    b = A['bone_head']
    s = _s(A)
    shell_ = P.lathe('pearl_shell', [(0.001, 0.0), (0.09 * s, 0.0), (0.1 * s, 0.02 * s), (0.06 * s, 0.035 * s), (0.001, 0.03 * s)], '#ffd6e7', 'fixed', b, segments=10, center=tuple(top + Vector((0, 0, -0.02))), levels=1, vis='prop:pearl')
    pearl_ = P.blob('pearl', top + Vector((0, 0, 0.065 * s)), (0.055 * s,) * 3, '#fff9f0', 'fixed', b, levels=1, vis='prop:pearl')
    shine = P.gloss('pearl_shine', top + Vector((-0.02 * s, -0.03 * s, 0.09 * s)), (0.016 * s, 0.01 * s, 0.01 * s), b, vis='prop:pearl')
    return [shell_, pearl_, shine]


def sparkle(ctx, A):
    c, r = _head(A)
    b = A['bone_head']
    s = _s(A)
    out = []
    for i in range(3):
        a = i * 2.2 + 0.5
        p = Vector((c.x + math.cos(a) * r.x * 1.45, c.y + math.sin(a) * r.y * 0.9 - r.y * 0.2, c.z + r.z * (0.35 + i * 0.3)))
        pts = []
        for k in range(8):
            ang = k / 8 * math.pi * 2 - math.pi / 2
            rr = 0.045 * s if k % 2 == 0 else 0.016 * s
            pts.append((math.cos(ang) * rr, math.sin(ang) * rr))
        o = P.plate('sparkle', pts, 0.012 * s, center=(0, 0, 0), plane='xz', color='#fff3bf', role='fixed', bone=b, levels=0, crease=1.0, material='glow', vis='prop:sparkle')
        P.xform(o, rot=P.rot_y(i * 30), loc=p)
        out.append(o)
    return out


def ember(ctx, A):
    c = Vector(A.get('chest', A['back']))
    b = A['bone_chest']
    s = _s(A)
    rr = A.get('body_r', 0.35)
    out = []
    for i in range(5):
        a = i * 1.7
        p = Vector((math.cos(a) * rr * 1.05, math.sin(a) * rr * 0.9, c.z - 0.15 * s + i * 0.1 * s))
        out.append(P.blob('ember', p, ((0.03 + (i % 2) * 0.012) * s,) * 3, '#ff922b' if i % 2 else '#ffd43b', 'fixed', b, levels=0, material='glow', vis='prop:ember'))
    return out


def glider(ctx, A):
    back = Vector(A['back'])
    b = A['bone_back']
    s = _s(A)
    bar = P.tube('glider_bar', [back + Vector((-0.55 * s, 0.06 * s, 0.1 * s)), back + Vector((0.55 * s, 0.06 * s, 0.1 * s))], [0.014 * s, 0.014 * s], WOOD, 'fixed', b, sides=5, levels=0, vis='prop:glider')
    out = [bar]
    for side in (1, -1):
        pts = [(0.0, 0.0), (side * 0.55 * s, 0.1 * s), (side * 0.5 * s, -0.12 * s), (side * 0.15 * s, -0.08 * s)]
        wing = P.plate('glider_wing', pts, 0.012 * s, center=(0, 0, 0), plane='xz', color='#fff3e0', role='fixed', bone=b, levels=1, crease=0.8, vis='prop:glider')
        P.paint(wing, '#fff3e0', 'fixed', fn=lambda co, _s=s: (('#ff8c42' if abs(co.x) > 0.3 * _s else '#fff3e0'), 'fixed'))
        P.xform(wing, rot=P.rot_x(-20), loc=back + Vector((0, 0.08 * s, 0.1 * s)))
        out.append(wing)
    strut = P.tube('glider_strut', [back + Vector((0, 0.02, 0)), back + Vector((0, 0.08 * s, 0.1 * s))], [0.012 * s, 0.012 * s], WOOD, 'fixed', b, sides=5, levels=0, vis='prop:glider')
    return out + [strut]


def bones(ctx, A):
    c = Vector(A['chest'])
    b = A['bone_chest']
    s = _s(A)
    w = A.get('chest_w', 0.2) * s
    out = []
    for i in range(3):
        z = c.z + 0.06 * s - i * 0.07 * s
        rr = w * (0.95 - i * 0.12)
        prof_pts = [Vector((-rr, c.y - 0.02, z)), Vector((-rr * 0.6, c.y - 0.1 * s, z - 0.02)), Vector((0, c.y - 0.13 * s, z - 0.03)), Vector((rr * 0.6, c.y - 0.1 * s, z - 0.02)), Vector((rr, c.y - 0.02, z))]
        out.append(P.tube('rib', M.smooth_path(prof_pts, 8), [0.018 * s] * 8, BONE, 'fixed', b, sides=5, levels=0, vis='prop:bones'))
    return out


BUILDERS = dict(
    helmet=helmet, hood=hood, crown=crown, tiara=tiara, horns=horns, mask=mask, goggles=goggles, scarf=scarf, cape=cape,
    mane=mane, shield=shield, towerShield=tower_shield, club=club, axe=axe, spear=spear, sword=sword, staff=staff,
    lantern=lantern, bomb=bomb, smokePot=smoke_pot, backpack=backpack, wrench=wrench, drum=drum, fan=fan, mirror=mirror,
    chains=chains, candle=candle, gears=gears, chimney=chimney, cannon=cannon, crystals=crystals, leaves=leaves,
    flower=flower, thorns=thorns, moss=moss, mushroom=mushroom, bubble=bubble, pearl=pearl, sparkle=sparkle, ember=ember,
    glider=glider, bones=bones,
)


def build_missing(ctx, A):
    """Builds every prop the family's defs use that the family did not build itself."""
    out = []
    for name in sorted(ctx['props_used']):
        if name in ctx['done']:
            continue
        fn = BUILDERS.get(name)
        if not fn:
            print(f"[build] {ctx['family']}: no builder for prop '{name}'")
            continue
        parts = fn(ctx, A)
        ctx['parts'] += parts
        ctx['done'].add(name)
        out += parts
    return out
