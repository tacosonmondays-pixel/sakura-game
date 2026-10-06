"""Ghost: a lantern-light spirit — a round head melting into a wavy sheet, two stubby
arms, hollow glowing eyes. Props: candle, hood, chains, lantern, helmet, sword, mask, crown."""
import math
from mathutils import Vector

from lib import mesh as M
import parts as P
import props
from erig import blob_bones

H = 1.0


def build(ctx):
    ctx['height'] = H
    bones = blob_bones(H, top=0.5)
    bones += [('arm_L', Vector((0.3, -0.05, 0.55)), Vector((0.55, -0.15, 0.45)), 'top'), ('arm_R', Vector((-0.3, -0.05, 0.55)), Vector((-0.55, -0.15, 0.45)), 'top')]
    ctx['bones'] = bones
    c = Vector((0, 0, 0.66))
    R = Vector((0.36, 0.34, 0.34))
    # head + sheet as one lathe-like blob: round top, flaring wavy hem
    prof = [(0.001, 1.0), (0.2, 0.985), (0.33, 0.9), (0.37, 0.75), (0.36, 0.6), (0.33, 0.45), (0.3, 0.3), (0.34, 0.16), (0.4, 0.06), (0.001, 0.04)]
    body = P.lathe('sheet', prof, (1, 1, 1), 'main', None, segments=20, center=(0, 0, 0), levels=1, group='main')
    me = body.data
    for v in me.vertices:
        if v.co.z < 0.4:
            a = math.atan2(v.co.y, v.co.x)
            k = 1 + math.sin(a * 5) * 0.16 * (0.4 - v.co.z) * 2.5
            v.co.x *= k
            v.co.y = v.co.y * k + (0.4 - v.co.z) * 0.2
        if v.co.z < 0.55:
            # darker, more accent towards the hem
            pass
    me.update()
    P.paint(body, (1, 1, 1), 'main', fn=lambda co: ((1, 1, 1), 'main') if co.z > 0.45 else (((0.85, 0.85, 0.85), 'main') if co.z > 0.25 else ((1, 1, 1), 'accent')))
    P.face_uvs(body, c, R, window=0.25, box=(R.x * 0.95, c.z - R.z * 0.75, c.z + R.z * 0.75))
    P.weight_segments(body, [('body', Vector((0, 0, 0.02)), Vector((0, 0, 0.5))), ('top', Vector((0, 0, 0.5)), Vector((0, 0, H)))], blend=0.3)
    ctx['parts'].append(body)
    # stubby arms
    for s in (1, -1):
        b = 'arm_L' if s > 0 else 'arm_R'
        a0 = Vector((s * 0.3, -0.05, 0.55))
        a1 = Vector((s * 0.55, -0.16, 0.44))
        ctx['parts'].append(P.tube(f'arm_{s}', [a0 - Vector((s * 0.05, 0, 0)), a0.lerp(a1, 0.5), a1], [0.09, 0.08, 0.07], (1, 1, 1), 'main', b, sides=7, levels=1, group='arms'))
        ctx['parts'].append(P.blob(f'hand_{s}', a1 + Vector((s * 0.03, -0.02, -0.01)), (0.09, 0.08, 0.08), (1, 1, 1), 'main', b, levels=1, group='arms'))
    # gloss on the head, little wisp flame on top
    ctx['parts'].append(P.gloss_on('gloss', c, R, -35, 40, 0.05, 'top'))
    A = dict(head=(c, R), bone_head='top', top=Vector((0, 0, 0.99)), back=Vector((0, 0.3, 0.6)), bone_back='top',
             hand_R=Vector((-0.57, -0.18, 0.43)), bone_hand_R='arm_R', hand_L=Vector((0.57, -0.18, 0.43)), bone_hand_L='arm_L',
             chest=Vector((0, -0.33, 0.4)), bone_chest='body', chest_w=0.3, neck=Vector((0, 0, 0.4)), neck_r=0.3, body_r=0.36, s=1.0,
             boss='elite' in ctx['tiers'])
    ctx['anchors'] = A
    ctx['clips'] = dict(move='float', hit='squash', death='poof', special='cast')
    ctx['translucent'] = 0.86
    ctx['variants'] = {}
    props.build_missing(ctx, A)
