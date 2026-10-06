"""Beasts: one chunky quadruped body with a variant head — wolf (snout, tall ears, mane
prop), boar (round snout, tusks, bristle ridge), bear (big round head, round ears)."""
from mathutils import Vector

import parts as P
import props
import bodies


def build(ctx):
    Pp = bodies.quad_props(height=0.9, length=0.95, head=0.24)
    A = bodies.quad(ctx, Pp, fur=(1, 1, 1), fur_role='main', belly=(1, 1, 1), belly_role='accent', tail_r=0.07, paws=None)
    hc, hr = A['head']
    ctx['done'].add('tail')
    ctx['variants'] = {}
    ctx['clips'] = dict(move='gallop', hit='recoil', death='collapse', special='roar')
    # the base head is the wolf; boar and bear replace it
    wolf(ctx, A)
    if 'boar' in ctx['variants_used']:
        boar(ctx, A)
    if 'bear' in ctx['variants_used']:
        bear(ctx, A)
    # the mane is on the wolves (drawn as a ruff around the neck)
    props.build_missing(ctx, A)


def wolf(ctx, A):
    bodies.snout(ctx, A, color=(1, 1, 1), role='main', size=1.0, nose='#2a2224', drop=0.3)
    bodies.ears(ctx, A, kind='tall', color=(1, 1, 1), role='main', inner=None, size=0.9, az=40, el=55)
    for o in ctx['parts'][-4:]:
        o['group'] = 'head'
    # cheek fluff
    hc, hr = A['head']
    for s in (1, -1):
        p, n = P.surface(hc, hr, s * 70, -20, P.head_shape)
        ctx['parts'].append(P.tube(f'cheek_{s}', [p - n * 0.03, p + n * 0.05 + Vector((s * 0.02, 0.03, -0.02)), p + n * 0.12 + Vector((s * 0.04, 0.08, -0.05))], [(0.07, 0.05), (0.06, 0.04), (0.001, 0.001)], (0.9, 0.9, 0.9), 'main', 'head', sides=5, levels=1, tip_end=True, group='head'))


def boar(ctx, A):
    V = 'var:boar'
    ctx['variants']['boar'] = dict(hide=['head'])
    hc, hr = A['head']
    hr2 = Vector((hr.x * 1.1, hr.y * 1.05, hr.z * 1.0))
    head = P.head('boar_head', hc, hr2, (1, 1, 1), 'main', 'head', levels=2, shape=P.head_shape, vis=V, group='boarhead')
    ctx['parts'].append(head)
    A2 = dict(A, head=(hc, hr2))
    sn = bodies.snout(ctx, A2, color=(1, 1, 1), role='accent', size=1.15, nose='#ffb3c1', drop=0.35)
    tk = bodies.tusks(ctx, A2, size=1.0, spread=0.5)
    er = bodies.ears(ctx, A2, kind='pointy', color=(1, 1, 1), role='main', inner=None, size=0.75, az=60, el=45)
    for o in sn + tk + er:
        o['vis'] = V
        o['group'] = 'boarhead'
    # bristle ridge along the back
    for i in range(5):
        p = Vector((0, -0.2 + i * 0.13, 0.72 - abs(i - 2) * 0.03))
        ctx['parts'].append(P.cone(f'bristle_{i}', p - Vector((0, 0, 0.04)), p + Vector((0, 0.03, 0.1)), 0.035, (1, 1, 1), 'accent', 'body', sides=4, vis=V, group='boarhead'))
    ctx['done'].add('tusks')


def bear(ctx, A):
    V = 'var:bear'
    ctx['variants']['bear'] = dict(hide=['head'])
    hc, hr = A['head']
    hc2 = hc + Vector((0, 0.03, 0.05))
    hr2 = Vector((hr.x * 1.3, hr.y * 1.25, hr.z * 1.25))
    head = P.head('bear_head', hc2, hr2, (1, 1, 1), 'main', 'head', levels=2, shape=P.head_shape, vis=V, group='bearhead')
    ctx['parts'].append(head)
    A2 = dict(A, head=(hc2, hr2))
    sn = bodies.snout(ctx, A2, color=(1, 1, 1), role='accent', size=0.9, nose='#2a2224', drop=0.25)
    er = bodies.ears(ctx, A2, kind='round', color=(1, 1, 1), role='main', inner=(1, 1, 1), size=1.0, az=55, el=55)
    for o in sn + er:
        o['vis'] = V
        o['group'] = 'bearhead'
        if o['part'].startswith('earin'):
            P.paint(o, (1, 1, 1), 'accent')
