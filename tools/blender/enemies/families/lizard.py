"""Lizardfolk: a sleek scaled hunter — a proper muzzle with nostrils, a bright crest of
spines over the head and down the back, a pale belly plate and a thick tail curling out
to the side (the family owns the 'tail' prop). Props: spear, shield, crystals (basilisk)."""
from mathutils import Vector

from lib import mesh as M
import parts as P
import props
import bodies


def build(ctx):
    Pp = bodies.biped_props(height=1.0, head=0.24, bulk=1.05, hunch=0.12, legs=0.22, arms=1.0)
    A = bodies.biped(ctx, Pp, skin=(1, 1, 1), skin_role='main', cloth=None, face_window=0.25)
    c, r = A['head']
    tc, tr = Pp['torso_c'], Pp['torso_r']
    # muzzle: a wedge snout under the eyes with nostrils and a tooth
    base, n = P.surface(c, r, 0, -26, P.head_shape)
    snout = P.blob('snout', base + n * r.y * 0.22, (r.x * 0.5, r.y * 0.48, r.z * 0.26), (1, 1, 1), 'main', 'head', levels=1, group='head',
                   shape=lambda p: Vector((p.x * (1.0 - 0.25 * max(0.0, -p.y)), p.y, p.z * (1.0 - 0.3 * max(0.0, -p.y)))))
    ctx['parts'].append(snout)
    for s in (1, -1):
        ctx['parts'].append(P.blob(f'nostril_{s}', base + n * r.y * 0.66 + Vector((s * r.x * 0.14, 0, r.z * 0.06)), (0.013, 0.01, 0.01), '#3a2a2a', 'fixed', 'head', levels=0, group='head'))
    ctx['parts'].append(P.cone('tooth', base + n * r.y * 0.6 + Vector((r.x * 0.22, 0, -r.z * 0.1)), base + n * r.y * 0.6 + Vector((r.x * 0.22, 0, -r.z * 0.22)), 0.016, '#ffffff', 'fixed', 'head', sides=4, group='head'))
    # belly plate (pale), crest spines from the forehead down the back, tail
    belly = P.blob('belly', (0, -tr.y * 0.8, tc.z - tr.z * 0.05), (tr.x * 0.62, tr.y * 0.32, tr.z * 0.72), '#fff3c4', 'fixed', None, levels=1, group='torso')
    P.weight_segments(belly, [('hips', Vector((0, 0, Pp['hips_z'])), Vector((0, 0, Pp['chest_z']))), ('chest', Vector((0, 0, Pp['chest_z'])), Vector((0, 0, Pp['head_z'])))], blend=0.12)
    ctx['parts'].append(belly)
    for i in range(5):
        base, nrm = P.surface(c, r, 180 if i else 0, 82 - i * 30, P.head_shape)
        d = (nrm * 0.5 + Vector((0, 0.35, 0.8))).normalized()
        L = r.z * (0.5 if i < 3 else 0.38)
        ctx['parts'].append(P.tube(f'crest_{i}', [base - nrm * 0.03, base + d * L * 0.5, base + d * L], [(0.03, 0.07), (0.025, 0.06), (0.001, 0.001)], (1, 1, 1), 'accent', 'head', sides=5, levels=1, tip_end=True, up=Vector((0, 0, 1)), group='head'))
    for i in range(3):
        p = Vector((0, tr.y * 0.9, tc.z + tr.z * 0.6 - i * 0.12))
        ctx['parts'].append(P.cone(f'spine_{i}', p - Vector((0, 0.03, 0)), p + Vector((0, 0.09, 0.05)), 0.035, (1, 1, 1), 'accent', 'chest' if i < 2 else 'hips', sides=4, group='torso'))
    tail_pts = [Vector((0, tr.y * 0.8, Pp['hips_z'] + 0.05)), Vector((0.1, tr.y * 1.7, Pp['hips_z'] - 0.02)), Vector((0.42, tr.y * 2.2, 0.12)), Vector((0.72, tr.y * 1.9, 0.3))]
    pts = M.smooth_path(tail_pts, 9)
    tail = P.tube('tail', pts, [0.1 * (1 - 0.8 * i / 8) + 0.012 for i in range(9)], (1, 1, 1), 'main', None, sides=7, levels=1, tip_end=True, group='tail')
    P.weight_segments(tail, [('tail_1', tail_pts[0], tail_pts[1]), ('tail_2', tail_pts[1], tail_pts[3]), ('hips', Vector((0, 0, Pp['hips_z'])), Vector((0, 0, Pp['chest_z'])))], blend=0.08)
    ctx['parts'].append(tail)
    for i in range(3):
        p = pts[2 + i * 2]
        ctx['parts'].append(P.cone(f'tail_spine_{i}', p, p + Vector((0, 0, 0.09 - i * 0.02)), 0.03, (1, 1, 1), 'accent', 'tail_1' if i < 1 else 'tail_2', sides=4, group='tail'))
    ctx['bones'] += [('tail_1', tail_pts[0], tail_pts[1], 'hips'), ('tail_2', tail_pts[1], tail_pts[3], 'tail_1')]
    ctx['done'].add('tail')
    # wrist and leg wraps (hunter gear)
    hd = Pp['hand']
    for s in (1, -1):
        ctx['parts'].append(P.ring(f'wrap_{s}', (0, 0, 0), Pp['arm_r'] * 1.08, 0.02, '#5c3d2e', 'fixed', 'arm_L' if s > 0 else 'arm_R', segments=10, group='arms'))
        P.xform(ctx['parts'][-1], loc=(hd.x * s - s * 0.02, hd.y, hd.z + Pp['arm_r'] * 1.3))
    ctx['clips'] = dict(move='waddle', hit='recoil', death='topple', special='roar')
    ctx['variants'] = {}
    props.build_missing(ctx, A)
