"""Plant: bog flora on root legs. Each variant is its own little body on the shared roots:
sprout (bulb + two leaves), pod (spotted seed pod), root (thornroot trunk), mossling (mossy
ball), treant (trunk with a canopy and branch arms). Props: leaves, flower, thorns, moss,
mushroom (the family draws thorns on the thornroot)."""
import math
from mathutils import Vector

from lib import mesh as M
import parts as P
import props
from erig import blob_bones


def build(ctx):
    H = 1.0
    ctx['height'] = H
    bones = blob_bones(H, top=0.6)
    bones += [('arm_L', Vector((0.22, 0, 0.62)), Vector((0.5, -0.05, 0.85)), 'top'), ('arm_R', Vector((-0.22, 0, 0.62)), Vector((-0.5, -0.05, 0.85)), 'top')]
    ctx['bones'] = bones
    # shared root legs
    for i in range(4):
        a = i / 4 * math.pi * 2 + 0.5
        pts = [Vector((0, 0, 0.14)), Vector((math.sin(a) * 0.22, math.cos(a) * 0.2, 0.06)), Vector((math.sin(a) * 0.36, math.cos(a) * 0.33, 0.0))]
        ctx['parts'].append(P.tube(f'root_{i}', M.smooth_path(pts, 6), [0.07, 0.065, 0.06, 0.05, 0.04, 0.001], '#6b4226', 'fixed', 'body', sides=6, levels=1, tip_end=True, group='roots'))
    c = Vector((0, 0, 0.56))
    R = Vector((0.36, 0.34, 0.34))
    A = dict(head=(c, R), bone_head='top', top=Vector((0, 0, 0.92)), back=Vector((0, 0.28, 0.66)), bone_back='top',
             hand_R=Vector((-0.5, -0.08, 0.6)), bone_hand_R='arm_R', hand_L=Vector((0.5, -0.08, 0.6)), bone_hand_L='arm_L',
             chest=Vector((0, -0.32, 0.5)), bone_chest='body', chest_w=0.3, neck=Vector((0, 0, 0.4)), neck_r=0.3, body_r=0.36, s=1.0)
    ctx['anchors'] = A
    ctx['variants'] = {}
    ctx['clips'] = dict(move='sway', hit='squash', death='wilt', special='cast')
    used = ctx['variants_used']
    if 'sprout' in used:
        sprout(ctx, A)
    if 'pod' in used:
        pod(ctx, A)
    if 'root' in used:
        thornroot(ctx, A)
    if 'mossling' in used:
        mossling(ctx, A)
    if 'treant' in used:
        treant(ctx, A)
    props.build_missing(ctx, A)


def body_blob(ctx, name, V, c, R, levels=2, shape=P.head_shape, window=0.25, extra=None):
    o = P.head(name, c, R, (1, 1, 1), 'main', None, levels=levels, shape=shape, window=window, vis=V, group='plantbody',
               face_box=(R.x * 0.9, c.z - R.z * 0.72, c.z + R.z * 0.72))
    P.weight_segments(o, [('body', Vector((0, 0, 0.1)), Vector((0, 0, c.z))), ('top', Vector((0, 0, c.z)), Vector((0, 0, c.z + R.z)))], blend=0.25)
    ctx['parts'].append(o)
    return o


def sprout(ctx, A):
    V = 'var:sprout'
    ctx['variants']['sprout'] = dict(hide=[], move='hop')
    c, R = Vector((0, 0, 0.42)), Vector((0.3, 0.28, 0.28))
    body_blob(ctx, 'sprout_body', V, c, R)
    stem = P.tube('sprout_stem', [c + Vector((0, 0, R.z * 0.9)), c + Vector((0.01, 0, R.z * 0.9 + 0.16))], [0.03, 0.025], '#3f8f4b', 'fixed', 'top', sides=5, levels=1, vis=V, group='plantbody')
    ctx['parts'].append(stem)
    top = c + Vector((0.01, 0, R.z * 0.9 + 0.16))
    for s in (1, -1):
        pts = [top, top + Vector((s * 0.1, -0.01, 0.07)), top + Vector((s * 0.24, -0.03, 0.09))]
        ctx['parts'].append(P.tube(f'sprout_leaf_{s}', pts, [(0.03, 0.012), (0.07, 0.014), (0.001, 0.001)], (1, 1, 1), 'accent', 'top', sides=6, levels=1, tip_end=True, up=Vector((0, -1, 0)), vis=V, group='plantbody'))
    ctx['done'].add('leaves')


def pod(ctx, A):
    V = 'var:pod'
    ctx['variants']['pod'] = dict(hide=[], move='hop')
    c, R = Vector((0, 0, 0.5)), Vector((0.4, 0.37, 0.4))
    o = body_blob(ctx, 'pod_body', V, c, R, shape=lambda p: P.head_shape(Vector((p.x, p.y, p.z * (1.12 if p.z > 0 else 1.0)))))
    P.paint(o, (1, 1, 1), 'main', fn=lambda co: (((0.82, 0.82, 0.82), 'main') if math.sin(math.atan2(co.x, co.y) * 6 + co.z * 9) > 0.55 else ((1, 1, 1), 'main')))
    for i in range(4):
        a = i * 1.6
        ctx['parts'].append(P.blob(f'pod_seed_{i}', Vector((math.cos(a) * R.x * 0.95, math.sin(a) * R.y * 0.9, c.z + math.sin(i) * 0.12)), (0.07, 0.07, 0.07), (1, 1, 1), 'accent', 'body', levels=1, vis=V, group='plantbody'))
    ctx['parts'].append(P.tube('pod_stalk', [c + Vector((0, 0, R.z * 0.95)), c + Vector((0.02, 0, R.z * 0.95 + 0.1))], [0.08, 0.05], '#3f8f4b', 'fixed', 'top', sides=6, levels=1, vis=V, group='plantbody'))


def thornroot(ctx, A):
    V = 'var:root'
    ctx['variants']['root'] = dict(hide=[])
    trunk = P.lathe('trunk', [(0.001, 0.98), (0.2, 0.95), (0.27, 0.72), (0.3, 0.45), (0.36, 0.16), (0.001, 0.12)], (1, 1, 1), 'main', None, segments=12, center=(0, 0, 0), levels=1, vis=V, group='plantbody')
    P.paint(trunk, (1, 1, 1), 'main', fn=lambda co: ((1, 1, 1), 'main') if co.z < 0.65 else ((1, 1, 1), 'accent'))
    P.face_uvs(trunk, Vector((0, 0, 0.62)), Vector((0.28, 0.26, 0.28)), window=0.3, box=(0.26, 0.4, 0.84))
    P.weight_segments(trunk, [('body', Vector((0, 0, 0.1)), Vector((0, 0, 0.6))), ('top', Vector((0, 0, 0.6)), Vector((0, 0, 1.0)))], blend=0.25)
    ctx['parts'].append(trunk)
    for i in range(9):
        a = i * 2.4
        z = 0.25 + (i % 4) * 0.16
        d = Vector((math.sin(a), math.cos(a), 0.3)).normalized()
        p = Vector((d.x * 0.28, d.y * 0.27, z))
        ctx['parts'].append(P.cone(f'thorn_{i}', p - d * 0.03, p + d * 0.13, 0.035, (1, 1, 1), 'accent', 'body' if z < 0.6 else 'top', sides=4, vis=V, group='plantbody'))
    for i in range(3):
        a = i * 2.1
        ctx['parts'].append(P.tube(f'twig_{i}', [Vector((0, 0, 0.9)), Vector((math.cos(a) * 0.12, math.sin(a) * 0.12, 1.0)), Vector((math.cos(a) * 0.3, math.sin(a) * 0.3, 1.06))], [(0.05, 0.02), (0.05, 0.02), (0.001, 0.001)], '#5fc46a', 'fixed', 'top', sides=5, levels=1, tip_end=True, up=Vector((0, 0, 1)), vis=V, group='plantbody'))
    ctx['done'].add('thorns')


def mossling(ctx, A):
    V = 'var:mossling'
    ctx['variants']['mossling'] = dict(hide=[], move='hop')
    c, R = Vector((0, 0, 0.46)), Vector((0.38, 0.35, 0.34))
    o = body_blob(ctx, 'moss_body', V, c, R, shape=lambda p: P.head_shape(p, flat=0.1))
    P.paint(o, (1, 1, 1), 'main', fn=lambda co: (((0.8, 0.8, 0.8), 'main') if math.sin(co.x * 30 + co.z * 20) * math.cos(co.y * 25) > 0.6 else ((1, 1, 1), 'main')))
    for i in range(4):
        a = i * 1.57 + 0.3
        p, n = P.surface(c, R, math.degrees(a) + 90, 35 + (i % 2) * 20)
        ctx['parts'].append(P.blob(f'moss_tuft_{i}', p, (0.09, 0.07, 0.05), (1, 1, 1), 'accent', 'top', levels=1, vis=V, group='plantbody'))


def treant(ctx, A):
    V = 'var:treant'
    ctx['variants']['treant'] = dict(hide=[])
    trunk = P.lathe('treant_trunk', [(0.001, 0.9), (0.2, 0.88), (0.24, 0.6), (0.3, 0.3), (0.4, 0.14), (0.001, 0.12)], '#7a5230', 'fixed', None, segments=12, center=(0, 0, 0), levels=1, vis=V, group='plantbody')
    P.face_uvs(trunk, Vector((0, 0, 0.56)), Vector((0.26, 0.24, 0.28)), window=0.3, box=(0.24, 0.34, 0.78))
    P.weight_segments(trunk, [('body', Vector((0, 0, 0.1)), Vector((0, 0, 0.6))), ('top', Vector((0, 0, 0.6)), Vector((0, 0, 1.0)))], blend=0.25)
    ctx['parts'].append(trunk)
    for i in range(6):
        a = i * 1.05
        ctx['parts'].append(P.blob(f'canopy_{i}', Vector((math.cos(a) * 0.24, math.sin(a) * 0.22, 0.98 + (i % 2) * 0.08)), (0.23, 0.22, 0.2), (1 - (i % 3) * 0.12,) * 3, 'main', 'top', levels=1, vis=V, group='plantbody'))
    ctx['parts'].append(P.blob('canopy_top', Vector((0, 0, 1.14)), (0.26, 0.25, 0.22), (1, 1, 1), 'main', 'top', levels=1, vis=V, group='plantbody'))
    for s in (1, -1):
        b = 'arm_L' if s > 0 else 'arm_R'
        pts = [Vector((s * 0.2, 0, 0.62)), Vector((s * 0.42, -0.04, 0.8)), Vector((s * 0.56, -0.08, 1.0))]
        ctx['parts'].append(P.tube(f'branch_{s}', M.smooth_path(pts, 6), [0.06, 0.055, 0.05, 0.04, 0.03, 0.001], '#7a5230', 'fixed', b, sides=6, levels=1, tip_end=True, vis=V, group='plantbody'))
        ctx['parts'].append(P.blob(f'branch_leaf_{s}', pts[-1] + Vector((s * 0.02, -0.02, 0.04)), (0.09, 0.08, 0.07), (1, 1, 1), 'main', b, levels=1, vis=V, group='plantbody'))
    ctx['height'] = 1.3
