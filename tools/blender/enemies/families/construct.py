"""Construct: clockwork and crystal machines. Base = the automaton (boxy torso with a glowing
core, visor head, piston arms, stubby legs). Variants: cogling (a little wind-up ball on
legs), beetle (crystal dome shell over the back), sentry/warden/colossus use props
(helmet, gears, crystals, shield, chimney)."""
import math
from mathutils import Vector

from lib import mesh as M
import parts as P
import props
import bodies


def block_shape(p):
    q = Vector(p)
    for k in ('x', 'y', 'z'):
        v = getattr(q, k)
        setattr(q, k, math.copysign(min(1.0, abs(v) * 1.25), v) if abs(v) > 0.5 else v)
    return q


def build(ctx):
    Pp = bodies.biped_props(height=1.0, head=0.2, bulk=1.3, hunch=0.0, legs=0.2, arms=1.0)
    Pp['head_c'].z -= 0.02
    A = bodies.biped(ctx, Pp, skin=(1, 1, 1), skin_role='main', cloth=(0.75, 0.75, 0.75), cloth_role='main', hands=False, feet=False,
                     levels=1, head_levels=1, face_window=0.3)
    tc, tr = Pp['torso_c'], Pp['torso_r']
    c, r = A['head']
    # swap the soft blobs for riveted rounded boxes (machines are blocky)
    for o in [o for o in ctx['parts'] if o['part'] in ('head', 'torso')]:
        ctx['parts'].remove(o)
        M.remove(o)
    head = P.box('head', (c.x, c.y, c.z), (r.x * 2.3, r.y * 2.0, r.z * 1.7), (1, 1, 1), 'main', 'head', levels=2, crease=0.45, group='head')
    P.face_uvs(head, c, Vector((r.x * 1.15, r.y, r.z * 0.85)), window=0.3, box=(r.x * 1.1, c.z - r.z * 0.8, c.z + r.z * 0.8))
    ctx['parts'].append(head)
    torso = P.box('torso', (tc.x, tc.y, tc.z), (tr.x * 2.0, tr.y * 1.9, tr.z * 2.0), (1, 1, 1), 'main', None, levels=2, crease=0.4, group='torso')
    P.paint(torso, (1, 1, 1), 'main', fn=lambda co: (((0.72, 0.72, 0.72), 'main') if co.z < Pp['belt_z'] else ((1, 1, 1), 'main')))
    P.weight_segments(torso, [('hips', Vector((0, 0, Pp['hips_z'])), Vector((0, 0, Pp['chest_z']))), ('chest', Vector((0, 0, Pp['chest_z'])), Vector((0, 0, Pp['head_z'])))], blend=0.12)
    ctx['parts'].append(torso)
    for s in (1, -1):
        ctx['parts'].append(P.box(f'shoulder_{s}', (Pp['shoulder'].x * s * 1.1, Pp['shoulder'].y, Pp['shoulder'].z + 0.04), (0.16, 0.16, 0.1), '#4a5160', 'fixed', 'chest', levels=1, crease=0.7, group='torso'))
        for zz in (tc.z + tr.z * 0.55, tc.z - tr.z * 0.2):
            ctx['parts'].append(P.blob(f'rivet_{s}', (s * tr.x * 0.8, -tr.y * 0.98, zz), (0.02, 0.012, 0.02), '#e0b64a', 'fixed', 'chest', levels=0, group='torso'))
    # core gem in the chest + plate seams
    ctx['parts'].append(P.blob('core', (0, -tr.y * 0.98, tc.z + tr.z * 0.1), (0.09, 0.05, 0.11), (1, 1, 1), 'accent', 'chest', levels=1, material='glow', group='torso'))
    ctx['parts'].append(P.ring('core_ring', (0, 0, 0), 0.11, 0.02, '#e0b64a', 'fixed', 'chest', segments=12, axis='y', group='torso'))
    P.xform(ctx['parts'][-1], loc=(0, -tr.y * 0.98, tc.z + tr.z * 0.1))
    ctx['parts'].append(P.box('waist', (0, 0, Pp['hips_z'] + 0.02), (tr.x * 1.3, tr.y * 1.1, 0.08), '#4a5160', 'fixed', 'hips', levels=1, crease=0.8, group='torso'))
    # antenna light on the head
    top = A['top']
    ctx['parts'].append(P.tube('antenna', [top + Vector((0, 0, -0.02)), top + Vector((0, 0, 0.1))], [0.015, 0.012], '#4a5160', 'fixed', 'head', sides=5, levels=0, group='head'))
    ctx['parts'].append(P.blob('antenna_light', top + Vector((0, 0, 0.12)), (0.03, 0.03, 0.03), '#ff6b6b', 'fixed', 'head', levels=1, material='glow', group='head'))
    # piston fists + block feet
    hd, ft = Pp['hand'], Pp['foot']
    for s in (1, -1):
        b = 'arm_L' if s > 0 else 'arm_R'
        ctx['parts'].append(P.box(f'fist_{s}', (hd.x * s + s * 0.03, hd.y, hd.z - 0.03), (Pp['arm_r'] * 2.6, Pp['arm_r'] * 2.4, Pp['arm_r'] * 2.8), (0.8, 0.8, 0.8), 'main', b, levels=2, crease=0.5, group='arms'))
        ctx['parts'].append(P.ring(f'arm_ring_{s}', (0, 0, 0), Pp['arm_r'] * 1.15, 0.02, '#e0b64a', 'fixed', b, segments=10, group='arms'))
        P.xform(ctx['parts'][-1], loc=(hd.x * s - s * 0.03, hd.y, hd.z + Pp['arm_r'] * 1.6))
        lb = 'leg_L' if s > 0 else 'leg_R'
        fs = Pp['foot_size']
        ctx['parts'].append(P.box(f'foot_{s}', (ft.x * s, ft.y - fs.y * 0.15, fs.z * 0.45), (fs.x * 2.2, fs.y * 2.0, fs.z * 1.0), '#4a5160', 'fixed', lb, levels=1, crease=0.8, group='legs'))
    ctx['clips'] = dict(move='stomp', hit='recoil', death='collapse', special='roar')
    ctx['variants'] = {}
    ctx['anchors']['s'] = 1.1
    if 'cogling' in ctx['variants_used']:
        cogling(ctx, A, Pp)
    if 'beetle' in ctx['variants_used']:
        beetle(ctx, A, Pp)
        ctx['done'].add('shell')  # the 'shell' prop IS the beetle dome
    props.build_missing(ctx, A)


def cogling(ctx, A, Pp):
    """A wind-up ball on two stick legs: hides the whole automaton."""
    ctx['variants']['cogling'] = dict(hide=['head', 'torso', 'arms', 'legs'])
    V = 'var:cogling'
    hc = Vector((0, 0, 0.6))
    hr = Vector((0.36, 0.34, 0.34))
    ball = P.head('cog_body', hc, hr, (1, 1, 1), 'main', 'chest', levels=2, shape=P.head_shape, face_box=(hr.x * 0.85, hc.z - hr.z * 0.5, hc.z + hr.z * 0.6), vis=V, group='cogling')
    ctx['parts'].append(ball)
    ctx['parts'].append(P.ring('cog_band', (0, 0, hc.z), hr.x * 1.0, 0.025, '#e0b64a', 'fixed', 'chest', segments=16, vis=V, group='cogling'))
    P.xform(ctx['parts'][-1], scale=(1.0, hr.y / hr.x, 1.0))
    key = P.plate('wind_key', props._gear_pts(0.1, n=4, inner=0.5), 0.03, center=(0, 0, 0), plane='xy', color='#e0b64a', role='fixed', bone='chest', levels=0, crease=1.0, vis=V, group='cogling')
    P.xform(key, rot=P.rot_x(90), loc=(0, hr.y + 0.08, hc.z + 0.05))
    ctx['parts'].append(key)
    ctx['parts'].append(P.tube('key_shaft', [Vector((0, hr.y * 0.9, hc.z + 0.05)), Vector((0, hr.y + 0.08, hc.z + 0.05))], [0.02, 0.02], '#4a5160', 'fixed', 'chest', sides=6, levels=0, vis=V, group='cogling'))
    for s in (1, -1):
        lb = 'leg_L' if s > 0 else 'leg_R'
        ctx['parts'].append(P.tube(f'cog_leg_{s}', [Vector((s * 0.14, 0, 0.32)), Vector((s * 0.15, 0, 0.08))], [0.035, 0.03], '#4a5160', 'fixed', lb, sides=6, levels=0, vis=V, group='cogling'))
        ctx['parts'].append(P.box(f'cog_foot_{s}', (s * 0.15, -0.03, 0.05), (0.14, 0.2, 0.08), '#e0b64a', 'fixed', lb, levels=1, crease=0.7, vis=V, group='cogling'))
        ctx['parts'].append(P.blob(f'cog_bolt_{s}', (s * hr.x * 0.95, 0, hc.z + 0.05), (0.05, 0.05, 0.05), '#4a5160', 'fixed', 'chest', levels=1, vis=V, group='cogling'))
    ctx['parts'].append(P.tube('cog_antenna', [hc + Vector((0, 0, hr.z - 0.02)), hc + Vector((0, 0, hr.z + 0.1))], [0.014, 0.012], '#4a5160', 'fixed', 'head', sides=5, levels=0, vis=V, group='cogling'))
    ctx['parts'].append(P.blob('cog_light', hc + Vector((0, 0, hr.z + 0.12)), (0.03, 0.03, 0.03), '#ff6b6b', 'fixed', 'head', levels=1, material='glow', vis=V, group='cogling'))


def beetle(ctx, A, Pp):
    """Shellback: a quartz dome over the back and shoulders."""
    ctx['variants']['beetle'] = dict(hide=[])
    V = 'var:beetle'
    tc, tr = Pp['torso_c'], Pp['torso_r']
    dome = P.lathe('dome', [(0.001, 0.26), (tr.x * 0.9, 0.22), (tr.x * 1.45, 0.08), (tr.x * 1.55, -0.1), (tr.x * 1.4, -0.2)], '#a5f3fc', 'fixed', 'chest', segments=14, center=(0, tr.y * 0.35, tc.z + tr.z * 0.5), levels=2, close_bottom=False, scale_xy=(1.0, tr.y / tr.x * 1.3), vis=V, group='torso')
    P.paint(dome, '#a5f3fc', 'fixed', fn=lambda co: (('#e0fbff' if co.z > tc.z + tr.z * 0.65 else '#8fe3f5'), 'fixed'))
    ctx['parts'].append(dome)
    ctx['parts'].append(P.gloss('dome_gloss', (-tr.x * 0.5, tr.y * 0.1, tc.z + tr.z * 0.68), (0.07, 0.04, 0.03), 'chest', rot=P.rot_x(-30) @ P.rot_z(20), vis=V, group='torso'))
