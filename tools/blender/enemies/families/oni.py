"""Oni: a stocky festival demon — red skin, two horns, wild dark hair, a tiger-stripe
loincloth and fangs. Props: club, fan, mask, flower, drum, cape; the Champion has both."""
import math
from mathutils import Vector

import parts as P
import props
import bodies


def build(ctx):
    Pp = bodies.biped_props(height=1.0, head=0.26, bulk=1.2, hunch=0.0, legs=0.19, arms=1.05)
    A = bodies.biped(ctx, Pp, skin=(1, 1, 1), skin_role='main', cloth=None, shoes=None)
    c, r = A['head']
    # tiger-stripe loincloth: alternating black / accent bands around the hips
    tc, tr = Pp['torso_c'], Pp['torso_r']
    cloth = P.lathe('loincloth', [(tr.x * 0.98, 0.0), (tr.x * 1.06, -0.06), (tr.x * 1.1, -0.14), (tr.x * 0.9, -0.2), (0.001, -0.2)], (1, 1, 1), 'accent', 'hips', segments=16, center=(0, 0, Pp['belt_z'] + 0.02), levels=1, close_top=False, scale_xy=(1.0, tr.y / tr.x), group='torso')
    P.paint(cloth, (1, 1, 1), 'accent', fn=lambda co: (('#2b2d42', 'fixed') if math.sin(math.atan2(co.x, co.y) * 7) > 0.3 else ((1, 1, 1), 'accent')))
    ctx['parts'].append(cloth)
    ctx['parts'].append(P.ring('belt', (0, 0, Pp['belt_z'] + 0.02), tr.x * 1.0, 0.03, '#e0b64a', 'fixed', 'hips', segments=14, group='torso'))
    P.xform(ctx['parts'][-1], scale=(1.0, tr.y / tr.x, 1.0))
    # horns (the family owns this prop) + wild hair
    horns = props.horns(ctx, A, color='#fff3c4', size=1.0)
    for o in horns:
        o['vis'] = 'base'
    ctx['parts'] += horns
    ctx['done'].add('horns')
    bodies.hair_tuft(ctx, A, color='#2b2d42', n=5, size=1.0)
    bodies.ears(ctx, A, kind='pointy', color=(1, 1, 1), role='main', size=0.55, az=88, el=12)
    # fangs from the lower lip (geometry so they read from the side too)
    for s in (1, -1):
        base, n = P.surface(c, r, s * 10, -40, P.head_shape)
        ctx['parts'].append(P.tube(f'fang_{s}', [base - n * 0.01, base + n * 0.02 + Vector((0, 0, 0.03)), base + n * 0.03 + Vector((0, 0, 0.065))], [0.02, 0.016, 0.001], '#ffffff', 'fixed', 'head', sides=5, levels=1, tip_end=True, group='head'))
    # wrist and ankle cuffs
    hd = Pp['hand']
    for s in (1, -1):
        ctx['parts'].append(P.ring(f'cuff_{s}', (0, 0, 0), Pp['arm_r'] * 1.1, 0.022, '#e0b64a', 'fixed', 'arm_L' if s > 0 else 'arm_R', segments=10, group='arms'))
        P.xform(ctx['parts'][-1], loc=(hd.x * s - s * 0.02, hd.y, hd.z + Pp['arm_r'] * 1.3))
    ctx['clips'] = dict(move='stomp', hit='recoil', death='topple', special='cast')
    ctx['variants'] = {}
    ctx['anchors']['s'] = 1.1
    props.build_missing(ctx, A)
