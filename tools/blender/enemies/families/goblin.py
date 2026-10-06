"""Goblin: a scrawny-cute runner with a huge head, enormous pointy ears, a long nose and a
loincloth. Variants: scout (base), tinker (backpack / wrench / bomb props), chief (crown +
club), machine (the Goblin Machine: a copper boiler mech with a goblin pilot, replaces the body)."""
import math
from mathutils import Vector

from lib import mesh as M
import parts as P
import props
import bodies


def build(ctx):
    Pp = bodies.biped_props(height=1.0, head=0.27, bulk=0.9, hunch=0.1, legs=0.2)
    A = bodies.biped(ctx, Pp, skin=(1, 1, 1), skin_role='main', cloth=(1, 1, 1), cloth_role='accent', shoes=None)
    c, r = A['head']
    bodies.ears(ctx, A, kind='pointy', color=(1, 1, 1), role='main', inner='#ffb3c1', size=1.25, az=75, el=20)
    # long nose
    base, n = P.surface(c, r, 0, -8, P.head_shape)
    ctx['parts'].append(P.tube('nose', [base - n * 0.02, base + n * r.y * 0.3, base + n * r.y * 0.55 + Vector((0, 0, -0.02))], [r.x * 0.14, r.x * 0.12, 0.001], (0.92, 0.92, 0.92), 'main', 'head', sides=6, levels=1, tip_end=True, group='head'))
    # loincloth flap
    ctx['parts'].append(P.plate('loincloth', [(-0.09, 0.0), (0.09, 0.0), (0.11, -0.16), (0.0, -0.2), (-0.11, -0.16)], 0.03, center=(0, 0, 0), plane='xz', color=(1, 1, 1), role='accent', bone='hips', levels=2, crease=0.6, group='torso'))
    P.xform(ctx['parts'][-1], loc=(0, -Pp['torso_r'].y * 0.92, Pp['belt_z'] + 0.02))
    ctx['clips'] = dict(move='run', hit='recoil', death='topple', special='cast')
    ctx['variants'] = {}
    if 'machine' in ctx['variants_used']:
        machine(ctx, A)
    props.build_missing(ctx, A)


def machine(ctx, A):
    """The Goblin Machine: a riveted copper boiler (the family colour) on stomping iron legs,
    a shoulder cannon, a chimney, big side gears and a goblin pilot peeking out of the top
    hatch. Hides the whole base goblin."""
    ctx['variants']['machine'] = dict(hide=['head', 'torso', 'arms', 'legs'])
    V = 'var:machine'
    iron, dark, brass = '#7d8795', '#3d4452', '#e0b64a'
    bz = 0.62
    boiler = P.box('boiler', (0, 0.0, bz), (0.74, 0.6, 0.52), (1, 1, 1), 'main', 'chest', levels=2, crease=0.35, vis=V, group='machine')
    ctx['parts'].append(boiler)
    for z in (bz - 0.18, bz + 0.18):
        band = P.ring('boiler_band', (0, 0, z), 0.4, 0.028, brass, 'fixed', 'chest', segments=16, levels=0, vis=V, group='machine')
        P.xform(band, scale=(1.0, 0.82, 1.0))
        ctx['parts'].append(band)
    # front plate with rivets and the furnace window
    ctx['parts'].append(P.box('front_plate', (0, -0.31, bz - 0.02), (0.5, 0.08, 0.34), dark, 'fixed', 'chest', levels=1, crease=0.8, vis=V, group='machine'))
    for i in range(5):
        for zz in (bz + 0.1, bz - 0.14):
            ctx['parts'].append(P.blob('rivet', (-0.18 + i * 0.09, -0.355, zz), (0.02, 0.012, 0.02), brass, 'fixed', 'chest', levels=0, vis=V, group='machine'))
    ctx['parts'].append(P.blob('furnace_glow', (0, -0.36, bz - 0.02), (0.11, 0.025, 0.08), '#ff8c42', 'fixed', 'chest', levels=1, material='glow', vis=V, group='machine'))
    ctx['parts'].append(P.ring('furnace_ring', (0, 0, 0), 0.12, 0.018, brass, 'fixed', 'chest', segments=12, axis='y', vis=V, group='machine'))
    P.xform(ctx['parts'][-1], loc=(0, -0.36, bz - 0.02))
    # top hatch + pilot
    hz = bz + 0.26
    ctx['parts'].append(P.lathe('hatch', [(0.001, 0.0), (0.2, 0.0), (0.22, 0.06), (0.19, 0.08), (0.001, 0.08)], dark, 'fixed', 'chest', segments=12, center=(0, 0.04, hz), levels=1, vis=V, group='machine'))
    ctx['parts'].append(P.ring('hatch_rim', (0, 0.04, hz + 0.08), 0.2, 0.022, brass, 'fixed', 'chest', segments=14, vis=V, group='machine'))
    hc = Vector((0, 0.04, hz + 0.22))
    hr = Vector((0.17, 0.16, 0.17))
    ctx['parts'].append(P.head('pilot_head', hc, hr, (1, 1, 1), 'main', 'head', levels=2, shape=P.head_shape, vis=V, group='machine'))
    for o in bodies.ears(ctx, dict(A, head=(hc, hr)), kind='pointy', color=(1, 1, 1), role='main', inner='#ffb3c1', size=1.2, az=75, el=20):
        o['vis'] = V
        o['group'] = 'machine'
    ctx['parts'].append(P.tube('pilot_nose', [hc + Vector((0, -hr.y * 0.9, -0.01)), hc + Vector((0, -hr.y * 1.4, -0.03))], [0.04, 0.001], (0.92, 0.92, 0.92), 'main', 'head', sides=6, levels=1, tip_end=True, vis=V, group='machine'))
    for s in (1, -1):
        ctx['parts'].append(P.blob('pilot_goggle', hc + Vector((s * 0.07, -hr.y * 0.6, hr.z * 0.62)), (0.045, 0.02, 0.04), '#4a3728', 'fixed', 'head', levels=0, vis=V, group='machine'))
        ctx['parts'].append(P.blob('pilot_lens', hc + Vector((s * 0.07, -hr.y * 0.74, hr.z * 0.62)), (0.03, 0.015, 0.028), '#9be7ff', 'fixed', 'head', levels=0, material='glow', vis=V, group='machine'))
    # iron legs with big flat feet, claw arms
    for side, s in (('L', 1), ('R', -1)):
        lb = f'leg_{side}'
        ctx['parts'].append(P.box(f'mech_leg_{side}', (s * 0.27, 0.0, 0.2), (0.17, 0.17, 0.32), iron, 'fixed', lb, levels=1, crease=0.6, vis=V, group='machine'))
        ctx['parts'].append(P.box(f'mech_foot_{side}', (s * 0.27, -0.05, 0.05), (0.28, 0.38, 0.1), dark, 'fixed', lb, levels=1, crease=0.8, vis=V, group='machine'))
        ctx['parts'].append(P.blob(f'mech_knee_{side}', (s * 0.27, -0.06, 0.36), (0.1, 0.1, 0.1), brass, 'fixed', lb, levels=0, vis=V, group='machine'))
        ab = f'arm_{side}'
        a0 = Vector((s * 0.42, -0.06, bz + 0.1))
        a1 = Vector((s * 0.58, -0.34, bz - 0.14))
        ctx['parts'].append(P.tube(f'mech_arm_{side}', [a0, a0.lerp(a1, 0.5), a1], [0.06, 0.05, 0.05], iron, 'fixed', ab, sides=6, levels=1, vis=V, group='machine'))
        ctx['parts'].append(P.blob(f'mech_shoulder_{side}', a0, (0.09, 0.09, 0.09), brass, 'fixed', ab, levels=1, vis=V, group='machine'))
        for k in (-1, 1):
            ctx['parts'].append(P.tube(f'claw_{side}', [a1, a1 + Vector((k * 0.05, -0.08, 0)), a1 + Vector((k * 0.02, -0.17, -0.02))], [0.035, 0.03, 0.001], dark, 'fixed', ab, sides=5, levels=1, tip_end=True, vis=V, group='machine'))
    # side gears (brass), a chimney behind the hatch, a cannon on the right shoulder
    for s in (1, -1):
        g = P.plate('side_gear', props._gear_pts(0.15, n=8, inner=0.78), 0.04, center=(0, 0, 0), plane='yz', color=brass if s > 0 else iron, role='fixed', bone='chest', levels=0, crease=1.0, vis=V, group='machine')
        P.xform(g, rot=P.rot_x(s * 20), loc=(s * 0.4, 0.08, bz + 0.02))
        ctx['parts'].append(g)
        ctx['parts'].append(P.blob('gear_axle', (s * 0.43, 0.08, bz + 0.02), (0.02, 0.035, 0.035), dark, 'fixed', 'chest', levels=0, vis=V, group='machine'))
    ctx['done'].add('gears')
    base = Vector((-0.2, 0.2, bz + 0.2))
    ctx['parts'].append(P.tube('chimney', [base, base + Vector((0, 0, 0.3))], [0.065, 0.055], dark, 'fixed', 'chest', sides=8, levels=1, vis=V, group='machine'))
    ctx['parts'].append(P.ring('chimney_lip', tuple(base + Vector((0, 0, 0.3))), 0.06, 0.018, brass, 'fixed', 'chest', segments=10, vis=V, group='machine'))
    for i in range(3):
        ctx['parts'].append(P.blob('chimney_smoke', base + Vector((-0.03 * i, 0.02 * i, 0.38 + i * 0.09)), ((0.055 + i * 0.018),) * 3, '#eef1f4', 'fixed', 'chest', levels=0, vis=V, group='machine'))
    ctx['done'].add('chimney')
    cb = Vector((0.3, 0.05, bz + 0.3))
    ctx['parts'].append(P.tube('cannon', [cb + Vector((0, 0.12, 0)), cb + Vector((0, -0.2, 0.04)), cb + Vector((0, -0.34, 0.06))], [0.075, 0.07, 0.08], dark, 'fixed', 'chest', sides=10, levels=1, vis=V, group='machine'))
    muzzle = P.ring('cannon_muzzle', (0, 0, 0), 0.075, 0.02, brass, 'fixed', 'chest', segments=10, axis='y', vis=V, group='machine')
    P.xform(muzzle, rot=P.rot_x(-8), loc=cb + Vector((0, -0.34, 0.06)))
    ctx['parts'].append(muzzle)
    ctx['parts'].append(P.blob('cannon_mount', cb + Vector((0, 0.08, -0.05)), (0.1, 0.09, 0.08), iron, 'fixed', 'chest', levels=1, vis=V, group='machine'))
    ctx['done'].add('cannon')
