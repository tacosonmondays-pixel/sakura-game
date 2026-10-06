"""Dragon: a chunky wyvern — fat body, long neck with a wedge head, bat wings on wing
bones (the 'wings' prop), tail (family), horns (family), four stubby legs. The drake has no
wings and walks; the Matriarch adds a crown and embers."""
import math
from mathutils import Vector

from lib import mesh as M
import parts as P
import props
import bodies
import erig


def build(ctx):
    Pp = bodies.quad_props(height=1.0, length=1.0, head=0.2)
    Pp['head_c'] = Vector((0, -0.62, 0.92))
    Pp['head'] = Vector((0, -0.42, 0.68))
    Pp['head_top'] = Vector((0, -0.66, 1.1))
    Pp['tail'] = [Vector((0, 0.5, 0.5)), Vector((0, 0.85, 0.5)), Vector((0.1, 1.15, 0.6)), Vector((0.2, 1.35, 0.78))]
    A = bodies.quad(ctx, Pp, fur=(1, 1, 1), fur_role='main', belly='#fff3c4', belly_role='fixed', tail_r=0.1, head_shape=lambda p: P.head_shape(p, flat=0.06, cheek=0.02, chin=0.0), face_box=None)
    hc, hr = A['head']
    bc, br = Pp['body_c'], Pp['body_r']
    # neck from the chest to the head
    neck = P.tube('neck', M.smooth_path([Vector((0, -br.y * 0.7, bc.z + 0.05)), Vector((0, -0.52, 0.72)), hc + Vector((0, 0.05, -0.1))], 6), [0.16, 0.15, 0.14, 0.13, 0.12, 0.12], (1, 1, 1), 'main', None, sides=8, levels=1, group='head')
    P.weight_segments(neck, [('body', Vector((0, br.y * 0.4, bc.z)), Vector((0, -br.y * 0.4, bc.z))), ('head', Pp['head'], Pp['head_top'])], blend=0.12)
    ctx['parts'].append(neck)
    # snout + nostrils, horns, back spikes, tail fin
    bodies.snout(ctx, A, color=(1, 1, 1), role='main', size=1.05, nose=None, drop=0.2)
    for s in (1, -1):
        p, n = P.surface(hc, hr, s * 16, -18, P.head_shape)
        ctx['parts'].append(P.blob(f'nostril_{s}', p + n * 0.1, (0.014, 0.012, 0.011), '#3a2a2a', 'fixed', 'head', levels=0, group='head'))
    horns = props.horns(ctx, dict(A, head=(hc, hr)), color='#fff3c4', size=0.9)
    for o in horns:
        o['vis'] = 'base'
        o['group'] = 'head'
    ctx['parts'] += horns
    ctx['done'].add('horns')
    for i in range(5):
        p = Vector((0, -0.25 + i * 0.16, bc.z + br.z * 0.9 - abs(i - 2) * 0.02))
        ctx['parts'].append(P.cone(f'spike_{i}', p - Vector((0, 0, 0.04)), p + Vector((0, 0.03, 0.11)), 0.04, (1, 1, 1), 'accent', 'body', sides=4, group='torso'))
    tail_end = Pp['tail'][-1]
    fin = P.plate('tail_fin', [(0, -0.06), (0.1, -0.14), (0.14, 0.0), (0.1, 0.14), (0, 0.06)], 0.015, center=(0, 0, 0), plane='yz', color=(1, 1, 1), role='accent', bone='tail_3', levels=1, crease=0.9, group='tail')
    P.xform(fin, loc=tail_end + Vector((0.02, 0.04, 0.02)))
    ctx['parts'].append(fin)
    # wings (prop) on wing bones
    ctx['bones'] += erig.wing_bones(bc.z + br.z * 0.55, 0.9, root_y=0.0, parent='body')
    if 'wings' in ctx['props_used']:
        wings(ctx, bc, br)
        ctx['done'].add('wings')
    ctx['done'].add('tail')
    ctx['clips'] = dict(move='fly', hit='recoil', death='collapse', special='roar', extra={'walk': 'gallop'})
    ctx['variants'] = {'drake': dict(hide=[], move='walk')}
    ctx['anchors']['s'] = 1.2
    ctx['anchors']['top'] = Vector((hc.x, hc.y - 0.02, hc.z + hr.z * 0.95))
    props.build_missing(ctx, A)


def wings(ctx, bc, br):
    """Bat wings: an arm bone up and back from the shoulder, three fingers fanning from the
    wrist, and a scalloped membrane stretched between them (swept back so they read as
    wings from the front and the side)."""
    z = bc.z + br.z * 0.55
    sweep = 28
    for s in (1, -1):
        b = 'wing_L' if s > 0 else 'wing_R'
        root = Vector((s * 0.12, 0.0, z))
        wrist = Vector((s * 0.46, 0.0, 0.24))
        fingers = [Vector((s * 1.0, 0.0, 0.34)), Vector((s * 0.94, 0.0, 0.0)), Vector((s * 0.68, 0.0, -0.26))]
        scallops = [Vector((s * 0.8, 0.0, 0.12)), Vector((s * 0.64, 0.0, -0.1)), Vector((s * 0.3, 0.0, -0.1))]
        # swept back (tips towards +Y) and laid back 45 deg so the membrane reads from the
        # angled game camera as well as from the front
        rot = P.rot_z(s * sweep) @ P.rot_x(45)
        parts = []
        arm = [Vector((0, 0, 0)), wrist * 0.5 + Vector((0, 0, 0.05)), wrist]
        parts.append(P.tube(f'wing_arm_{s}', M.smooth_path(arm, 5), [0.06, 0.055, 0.05, 0.045, 0.045], (0.85, 0.85, 0.85), 'main', b, sides=6, levels=1, vis='prop:wings', group='wings'))
        # membrane polygon: root -> wrist -> finger1 -> scallop -> finger2 -> scallop -> finger3 -> scallop -> body
        poly = [(0.0, 0.0), (wrist.x, wrist.z), (fingers[0].x, fingers[0].z), (scallops[0].x, scallops[0].z), (fingers[1].x, fingers[1].z),
                (scallops[1].x, scallops[1].z), (fingers[2].x, fingers[2].z), (scallops[2].x, scallops[2].z), (s * 0.08, -0.12)]
        mem = P.plate(f'wing_mem_{s}', poly, 0.016, center=(0, 0, 0), plane='xz', color=(1, 1, 1), role='accent', bone=b, levels=1, crease=0.8, vis='prop:wings', group='wings')
        parts.append(mem)
        for k, f in enumerate(fingers):
            parts.append(P.tube(f'wing_finger_{s}{k}', [wrist, wrist.lerp(f, 0.5), f], [0.032, 0.026, 0.001], (0.85, 0.85, 0.85), 'main', b, sides=5, levels=1, tip_end=True, vis='prop:wings', group='wings'))
        parts.append(P.blob(f'wing_claw_{s}', wrist + Vector((s * 0.02, -0.02, 0.05)), (0.03, 0.025, 0.04), '#fff3c4', 'fixed', b, levels=1, vis='prop:wings', group='wings'))
        for o in parts:
            P.xform(o, rot=rot, loc=root)
        ctx['parts'] += parts
