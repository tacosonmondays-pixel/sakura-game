"""Fae: a tiny festival spirit in a petal dress with big butterfly wings (the family owns
'wings' with wing bones), antennae and a pale face. Variants: sprite, mirage (translucent),
illusionist (mirror), sylph, queen (tiara)."""
import math
from mathutils import Vector

from lib import mesh as M
import parts as P
import props
import bodies
import erig


def build(ctx):
    Pp = bodies.biped_props(height=1.0, head=0.25, bulk=0.75, hunch=0.0, legs=0.2, arms=0.9)
    A = bodies.biped(ctx, Pp, skin='#ffe9dc', skin_role='fixed', cloth=None, hands=True, feet=False, shoes=None)
    c, r = A['head']
    tc, tr = Pp['torso_c'], Pp['torso_r']
    # petal dress (main colour) flaring from the chest, accent hem; feet hidden by the dress
    dress = P.lathe('dress', [(tr.x * 0.7, 0.0), (tr.x * 1.0, -0.12), (tr.x * 1.45, -0.3), (tr.x * 1.3, -0.34), (0.001, -0.33)], (1, 1, 1), 'main', 'hips', segments=14, center=(0, 0, tc.z + tr.z * 0.3), levels=1, close_top=False, scale_xy=(1.0, tr.y / tr.x), group='torso')
    P.paint(dress, (1, 1, 1), 'main', fn=lambda co: (((1, 1, 1), 'accent') if co.z < tc.z + tr.z * 0.3 - 0.25 else ((1, 1, 1), 'main')))
    ctx['parts'].append(dress)
    # hair cap + antennae with glowing tips
    cap = P.blob('hair', c + Vector((0, r.y * 0.12, r.z * 0.1)), (r.x * 1.1, r.y * 1.05, r.z * 1.08), (1, 1, 1), 'accent', 'head', levels=2, group='head',
                 shape=lambda p: Vector((p.x, p.y, p.z)) if p.y > -0.2 or p.z > 0.45 else Vector((p.x, -0.2 + (p.y + 0.2) * 0.1, p.z)))
    ctx['parts'].append(cap)
    for s in (1, -1):
        base, n = P.surface(c, r, s * 25, 80, P.head_shape)
        pts = [base, base + Vector((s * 0.03, 0.0, 0.1)), base + Vector((s * 0.07, -0.04, 0.17))]
        ctx['parts'].append(P.tube(f'antenna_{s}', pts, [0.012, 0.01, 0.008], (1, 1, 1), 'accent', 'head', sides=5, levels=1, group='head'))
        ctx['parts'].append(P.blob(f'antenna_tip_{s}', pts[-1] + Vector((0, 0, 0.012)), (0.028, 0.028, 0.028), '#fff3bf', 'fixed', 'head', levels=1, material='glow', group='head'))
    bodies.ears(ctx, A, kind='pointy', color='#ffe9dc', role='fixed', size=0.6, az=85, el=18)
    # butterfly wings on wing bones
    ctx['bones'] += erig.wing_bones(tc.z + tr.z * 0.4, 0.55, root_y=tr.y * 0.8, parent='chest')
    wings(ctx, tc, tr)
    ctx['done'].add('wings')
    ctx['clips'] = dict(move='flutter', hit='recoil', death='poof', special='cast')
    ctx['variants'] = {'mirage': dict(hide=[], opacity=0.55)}
    ctx['anchors']['s'] = 0.9
    props.build_missing(ctx, A)


def wings(ctx, tc, tr):
    z = tc.z + tr.z * 0.4
    y = tr.y * 0.85
    for s in (1, -1):
        b = 'wing_L' if s > 0 else 'wing_R'
        for k, (dz, sz) in enumerate(((0.12, 1.0), (-0.12, 0.72))):
            pts = [(0.0, 0.0), (s * 0.22 * sz, (dz + 0.28) * sz), (s * 0.52 * sz, (dz + 0.3) * sz), (s * 0.6 * sz, (dz + 0.08) * sz), (s * 0.45 * sz, (dz - 0.12) * sz), (s * 0.15 * sz, (dz - 0.06) * sz)]
            w = P.plate(f'wing_{s}{k}', pts, 0.012, center=(0, 0, 0), plane='xz', color=(1, 1, 1), role='accent', bone=b, levels=1, crease=0.9, group='wings')
            P.paint(w, (1, 1, 1), 'accent', fn=lambda co, _s=s: (('#ffffff', 'fixed') if abs(co.x) < 0.2 else ((1, 1, 1), 'accent')))
            P.xform(w, rot=P.rot_x(-12) @ P.rot_z(s * 10), loc=(s * 0.08, y, z))
            ctx['parts'].append(w)
            spot = P.blob(f'wing_spot_{s}{k}', (s * 0.36 * sz, y - 0.01, z + (dz + 0.08) * sz), (0.05 * sz, 0.012, 0.05 * sz), '#fff3bf', 'fixed', b, levels=0, material='glow', group='wings')
            ctx['parts'].append(spot)
