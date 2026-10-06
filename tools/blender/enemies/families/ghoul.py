"""Ghoul: a hunched marsh dead thing — long dangling arms with claws, a ragged shawl,
glowing eyes. Variants: skeleton (bones prop, pale colour), shambler (moss), leech (chains),
skulker (hood), priest (staff, hood, candle), lych (boss: robe instead of legs, crown, cape)."""
from mathutils import Vector

import parts as P
import props
import bodies


def build(ctx):
    Pp = bodies.biped_props(height=1.0, head=0.24, bulk=0.9, hunch=0.35, legs=0.2, arms=1.45)
    A = bodies.biped(ctx, Pp, skin=(1, 1, 1), skin_role='main', cloth=(0.5, 0.5, 0.5), cloth_role='accent', hands=False, shoes=None)
    c, r = A['head']
    hd = Pp['hand']
    # claws instead of mitten hands
    for s in (1, -1):
        base = Vector((hd.x * s, hd.y, hd.z))
        b = 'arm_L' if s > 0 else 'arm_R'
        ctx['parts'].append(P.blob(f'palm_{s}', base + Vector((s * 0.02, -0.01, -0.02)), (Pp['arm_r'] * 1.25, Pp['arm_r'] * 1.1, Pp['arm_r'] * 1.2), (1, 1, 1), 'main', b, levels=1, group='arms'))
        for k in (-1, 0, 1):
            p = base + Vector((s * 0.03 + k * 0.035, -0.02, -0.05))
            ctx['parts'].append(P.tube(f'claw_{s}{k}', [p, p + Vector((0, -0.02, -0.06)), p + Vector((0, -0.03, -0.12))], [0.02, 0.016, 0.001], '#f1f3f5', 'fixed', b, sides=5, levels=1, tip_end=True, group='arms'))
    # ragged shawl over the shoulders
    tc, tr = Pp['torso_c'], Pp['torso_r']
    shawl = P.lathe('shawl', [(0.001, 0.08), (tr.x * 0.7, 0.07), (tr.x * 1.15, -0.02), (tr.x * 1.3, -0.16), (tr.x * 1.05, -0.2)], (0.55, 0.55, 0.55), 'accent', 'chest', segments=9, center=(0, 0.02, Pp['head_z'] - 0.02), levels=1, close_bottom=False, scale_xy=(1.0, tr.y / tr.x * 1.1), group='torso')
    ctx['parts'].append(shawl)
    # pointy ears, sunken cheeks hint (darker lower face)
    bodies.ears(ctx, A, kind='pointy', color=(1, 1, 1), role='main', size=0.7, az=82, el=16)
    ctx['clips'] = dict(move='shamble', hit='recoil', death='topple', special='siphon')
    ctx['variants'] = {}
    ctx['anchors']['s'] = 1.0
    if 'lych' in ctx['variants_used']:
        lych(ctx, A, Pp)
    props.build_missing(ctx, A)


def lych(ctx, A, Pp):
    """Grave Lych: a floating robe replaces the legs, bone hands, tall collar."""
    ctx['variants']['lych'] = dict(hide=['legs'], move='float')
    V = 'var:lych'
    tc, tr = Pp['torso_c'], Pp['torso_r']
    robe = P.lathe('robe', [(tr.x * 0.9, 0.0), (tr.x * 1.05, -0.12), (tr.x * 1.25, -0.26), (tr.x * 1.1, -0.36), (0.001, -0.33)], (0.6, 0.6, 0.6), 'accent', 'hips', segments=14, center=(0, 0, Pp['belt_z'] + 0.02), levels=1, close_top=False, scale_xy=(1.0, tr.y / tr.x), vis=V, group='lych')
    ctx['parts'].append(robe)
    ctx['parts'].append(P.ring('robe_hem', (0, 0, Pp['belt_z'] - 0.3), tr.x * 1.12, 0.025, '#e0b64a', 'fixed', 'hips', segments=14, vis=V, group='lych'))
    P.xform(ctx['parts'][-1], scale=(1.0, tr.y / tr.x, 1.0))
    collar = P.lathe('collar', [(tr.x * 0.6, 0.0), (tr.x * 0.9, 0.08), (tr.x * 1.0, 0.18), (tr.x * 0.75, 0.2)], (0.5, 0.5, 0.5), 'accent', 'chest', segments=10, center=(0, 0.03, Pp['head_z'] - 0.06), levels=1, close_bottom=False, close_top=False, scale_xy=(1.0, tr.y / tr.x), vis=V, group='lych')
    ctx['parts'].append(collar)
    for i in range(3):
        ctx['parts'].append(P.blob(f'soul_{i}', Vector((0.25 - i * 0.25, -tr.y * 1.2, tc.z + 0.1 + (i % 2) * 0.15)), (0.03, 0.03, 0.03), '#80ffdb', 'fixed', 'chest', levels=0, material='glow', vis=V, group='lych'))
