"""Orc: a wide, heavy brute — huge round belly, tiny legs, big fists, tusks and a jutting
brow. Soldiers add helmet / axe / tower shield props, the General a cape, sword and shield."""
from mathutils import Vector

import parts as P
import props
import bodies


def build(ctx):
    Pp = bodies.biped_props(height=1.0, head=0.25, bulk=1.35, hunch=0.05, legs=0.17, arms=1.1)
    A = bodies.biped(ctx, Pp, skin=(1, 1, 1), skin_role='main', cloth=(1, 1, 1), cloth_role='accent', shoes='#4a3728')
    c, r = A['head']
    bodies.tusks(ctx, A, size=1.1)
    bodies.ears(ctx, A, kind='pointy', color=(1, 1, 1), role='main', inner=None, size=0.6, az=85, el=10)
    # heavy brow ridge + little topknot
    base, n = P.surface(c, r, 0, 32, P.head_shape)
    ctx['parts'].append(P.blob('brow', base + n * 0.01, (r.x * 0.72, r.y * 0.16, r.z * 0.12), (0.9, 0.9, 0.9), 'main', 'head', levels=1, group='head'))
    top = A['top']
    ctx['parts'].append(P.tube('topknot', [top + Vector((0, 0.04, -0.02)), top + Vector((0, 0.06, 0.08)), top + Vector((0, 0.12, 0.13))], [0.05, 0.04, 0.001], '#2b2d42', 'fixed', 'head', sides=6, levels=1, tip_end=True, group='head'))
    # belt with a skull buckle, wrist wraps
    tc, tr = Pp['torso_c'], Pp['torso_r']
    ctx['parts'].append(P.ring('belt', (0, 0, Pp['belt_z']), tr.x * 1.0, 0.035, '#4a3728', 'fixed', 'hips', segments=14, levels=1, group='torso'))
    P.xform(ctx['parts'][-1], scale=(1.0, tr.y / tr.x, 1.0))
    ctx['parts'].append(P.blob('buckle', (0, -tr.y * 0.98, Pp['belt_z']), (0.06, 0.03, 0.06), '#e0b64a', 'fixed', 'hips', levels=1, group='torso'))
    hd = Pp['hand']
    for s in (1, -1):
        ctx['parts'].append(P.ring(f'wrap_{s}', (0, 0, 0), Pp['arm_r'] * 1.05, 0.02, '#4a3728', 'fixed', 'arm_L' if s > 0 else 'arm_R', segments=10, group='arms'))
        P.xform(ctx['parts'][-1], loc=(hd.x * s - s * 0.02, hd.y, hd.z + Pp['arm_r'] * 1.2))
    # shoulder plates for the armored looks
    if ctx['props_used'] & {'helmet', 'towerShield'}:
        for s in (1, -1):
            o = P.blob('pauldron', (Pp['shoulder'].x * s * 1.05, Pp['shoulder'].y, Pp['shoulder'].z + 0.03), (0.12, 0.11, 0.08), '#b4bcc8', 'fixed', 'arm_L' if s > 0 else 'arm_R', levels=1, vis='prop:helmet', group='arms')
            ctx['parts'].append(o)
    ctx['clips'] = dict(move='stomp', hit='recoil', death='topple', special='roar')
    ctx['variants'] = {}
    ctx['anchors']['s'] = 1.15
    ctx['anchors']['boss'] = 'miniboss' in ctx['tiers']
    props.build_missing(ctx, A)
