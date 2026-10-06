"""Slime: a fat glossy jelly drop with a painted face. Mimic props (helmet, crystals,
flower, ember fuse, pearl, bubble rings, treasure chest, crown + cape, spear) toggle per
variant; the colour comes from def.color at runtime (tint role 'main')."""
import math
from mathutils import Vector

from lib import mesh as M
import parts as P
import props
from erig import blob_bones

H = 0.82  # enemy-space height of the base blob


def drop_shape(p):
    """Unit sphere cage -> fat drop: flat heavy bottom, round cheeks, soft tip at the top-back."""
    q = Vector(p)
    if q.z < 0:
        q.z *= 0.72
        q.x *= 1.0 + 0.1 * (-q.z)
        q.y *= 1.0 + 0.1 * (-q.z)
    else:
        k = 1.0 - 0.22 * q.z ** 2
        q.x *= k
        q.y *= k
        q.y += 0.18 * q.z ** 2
        q.z *= 1.08
    if q.y < 0:
        q.y *= 1.04
    return q


def build(ctx):
    c = Vector((0, 0, 0.4))
    R = Vector((0.5, 0.46, 0.42))
    ctx['height'] = H
    ctx['bones'] = blob_bones(H, top=0.58)
    jelly = P.head('jelly', c, R, (1, 1, 1), 'main', 'body', levels=3, shape=drop_shape, face_box=(R.x * 0.9, 0.1, 0.72), window=0.28)
    # heavier colour at the bottom (shade of the family colour), softer at the top
    P.paint(jelly, (1, 1, 1), 'main', fn=lambda co: ((0.78 + 0.22 * min(1.0, max(0.0, co.z / 0.5)),) * 3, 'main'))
    P.weight_segments(jelly, [('body', Vector((0, 0, 0.02)), Vector((0, 0, 0.45))), ('top', Vector((0, 0, 0.45)), Vector((0, 0, H)))], blend=0.3)
    ctx['parts'].append(jelly)
    # glossy highlights (unlit), lying on the jelly surface at the upper left of the face
    ctx['parts'].append(P.gloss_on('gloss_big', c, R, -38, 42, 0.07, 'top', shape=drop_shape))
    ctx['parts'].append(P.gloss_on('gloss_small', c, R, -12, 58, 0.03, 'top', shape=drop_shape, stretch=1.2))
    A = dict(head=(c, R), bone_head='top', top=Vector((0, 0.05, H - 0.02)), back=Vector((0, 0.3, 0.55)), bone_back='top',
             hand_R=Vector((-0.42, -0.05, 0.3)), bone_hand_R='body', hand_L=Vector((0.42, -0.05, 0.3)), bone_hand_L='body',
             chest=Vector((0, -0.4, 0.3)), bone_chest='body', body_r=0.5, neck=Vector((0, 0, 0.5)), s=0.9)
    ctx['anchors'] = A
    ctx['clips'] = dict(move='hop', hit='squash', death='splat', special='cast')
    ctx['translucent'] = 0.9
    ctx['variants'] = {}
    # --- variant pieces ---
    if 'rainbow' in ctx['variants_used']:
        for i in range(3):
            a = i * 2.1 + 0.4
            p = Vector((math.cos(a) * 0.48, math.sin(a) * 0.42 + 0.05, 0.07 + (i % 2) * 0.04))
            ctx['parts'].append(P.blob('prism_drop', p, (0.1, 0.1, 0.09), (1, 1, 1), 'accent', 'body', levels=1, shape=drop_shape, vis='var:rainbow'))
        for i in range(2):
            ctx['parts'].append(P.gloss('prism_gloss', Vector((math.cos(i * 2.1 + 0.4) * 0.48 - 0.03, math.sin(i * 2.1 + 0.4) * 0.42 - 0.03, 0.12)), (0.022, 0.015, 0.012), 'body', vis='var:rainbow'))
    if 'chest' in ctx['variants_used']:
        chest_parts(ctx)
        ctx['done'].add('shell')  # the 'shell' prop IS the chest variant
    # crown sits a bit lower on a blob; cape hangs from the back of the top
    if 'crown' in ctx['props_used']:
        ctx['parts'] += props.crown(ctx, A, size=1.15)
        ctx['done'].add('crown')
    if 'cape' in ctx['props_used']:
        ctx['parts'] += props.cape(ctx, dict(A, back=Vector((0, 0.36, 0.62)), bone_back='top', s=1.1), length=0.5)
        ctx['done'].add('cape')
    if 'ember' in ctx['props_used']:
        top = A['top']
        fuse = P.tube('fuse', [top + Vector((0, 0, -0.03)), top + Vector((0.03, -0.01, 0.08)), top + Vector((0.1, -0.02, 0.13))], [0.022, 0.02, 0.016], '#5c3d2e', 'fixed', 'top', sides=5, levels=1, vis='prop:ember')
        spark = P.blob('fuse_spark', top + Vector((0.12, -0.02, 0.15)), (0.05, 0.05, 0.05), '#ffd166', 'fixed', 'top', levels=1, material='glow', vis='prop:ember')
        spark2 = P.blob('fuse_spark2', top + Vector((0.16, -0.03, 0.2)), (0.028, 0.028, 0.028), '#ff6b35', 'fixed', 'top', levels=1, material='glow', vis='prop:ember')
        ctx['parts'] += [fuse, spark, spark2]
        ctx['done'].add('ember')
    if 'crystals' in ctx['props_used']:
        ctx['parts'] += props.crystals(ctx, A, at=Vector((0, 0.12, 0.66)), n=5, size=0.13, bone='top')
        ctx['done'].add('crystals')
    if 'flower' in ctx['props_used']:
        ctx['parts'] += props.flower(ctx, A, at=Vector((0.17, -0.08, 0.74)), bone='top', size=1.3, petal='#ff5d8f', role='fixed')
        vine = P.tube('vine', M.smooth_path([Vector((-0.46, -0.15, 0.2)), Vector((-0.32, -0.36, 0.38)), Vector((0.0, -0.42, 0.5)), Vector((0.3, -0.3, 0.45))], 10), [0.018] * 10, '#2f9e44', 'fixed', 'body', sides=5, levels=1, vis='prop:flower')
        ctx['parts'].append(vine)
        for i, t in enumerate((0.25, 0.65)):
            p = M.smooth_path([Vector((-0.46, -0.15, 0.2)), Vector((-0.32, -0.36, 0.38)), Vector((0.0, -0.42, 0.5)), Vector((0.3, -0.3, 0.45))], 10)[int(t * 9)]
            ctx['parts'].append(P.tube('vine_leaf', [p, p + Vector((0.04, -0.04, 0.06)), p + Vector((0.07, -0.06, 0.11))], [(0.03, 0.01), (0.035, 0.01), (0.001, 0.001)], '#51cf66', 'fixed', 'body', sides=5, levels=1, tip_end=True, vis='prop:flower'))
        ctx['done'].add('flower')
    props.build_missing(ctx, A)


def chest_parts(ctx):
    """Mimic: a festival prize chest wrapped round the lower jelly, lid tipped open behind."""
    gold, wood = '#f2c14e', '#8a5a3c'
    body = P.box('chest_body', (0, 0.0, 0.17), (0.86, 0.66, 0.3), wood, 'fixed', 'body', levels=2, crease=0.9, vis='var:chest')
    P.paint(body, wood, 'fixed', fn=lambda co: ((gold if (abs(co.x) > 0.36 or co.z < 0.05) else wood), 'fixed'))
    lid = P.box('chest_lid', (0, 0, 0), (0.88, 0.66, 0.14), wood, 'fixed', 'top', levels=2, crease=0.9, vis='var:chest')
    P.paint(lid, wood, 'fixed', fn=lambda co: ((gold if abs(co.x) > 0.37 else wood), 'fixed'))
    P.xform(lid, rot=P.rot_x(-50), loc=(0, 0.26, 0.8))
    lock = P.box('chest_lock', (0, -0.34, 0.2), (0.1, 0.04, 0.12), gold, 'fixed', 'body', levels=1, crease=0.6, vis='var:chest')
    ctx['parts'] += [body, lid, lock]
    for i in range(-2, 3):
        ctx['parts'].append(P.cone('chest_tooth', Vector((i * 0.15, -0.3, 0.33)), Vector((i * 0.15, -0.31, 0.42)), 0.035, '#ffffff', 'fixed', 'body', sides=4, vis='var:chest'))
