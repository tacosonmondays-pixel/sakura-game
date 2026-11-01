"""Re-rig the batch-2 humanoid enemies from their shipped GLBs (the batch-2 autorig left their arms on the head,
shoulder or thigh bones, and some arm bones with no vertices at all).

    blender -b --python-use-system-env --python tools/tripo/rerig_tripo_enemy.py -- --id orc_grunt [--preview DIR]
    blender -b --python-use-system-env --python tools/tripo/rerig_tripo_enemy.py -- --id all

Why: tools/tripo/tripolib/autorig.py takes the widest slice of a figure as a horizontal (T-pose) arm line. These
figures stand in an A-pose, so the line ran through their heads and shoulder plates (Orc, Oni, Bonewalker, Goblin,
Skink, Colossus, Titan) or their banner (the Daimyo, whose arms ended up on the thigh bones): the clips moved bones
that carried nothing, and the enemies walked with stiff arms out. The raw website downloads are not in git, so this
rebuilds each enemy from its own shipped files (enemies/tripo/<id>.glb and, for the family enemies, <id>.lod.glb, each
from itself: no second decimation), keeping its mesh, UVs and base-colour WebP byte for byte:
  1. import, drop the old rig and clips, weld the UV-seam splits, 1 m frame (feet on z = 0, facing -Y)
  2. fit the rig to the enemy's landmarks (ENEMIES, read off tools/tripo/landmark_views.py sheets; the arm joints'
     depth and the elbow / wrist centring refined from the arm's own vertices; the feet measured)
  3. geometric weights (tripolib/rerig_enemy.py): torso by height, arms along their capsule chains, legs by side,
     skirts mostly on the hips, tails and banners on their chains, props on their hands
  4. clips (tripolib/clips_brute.py): move / idle / hit / death / special
  5. GLB export, the phone packing (tools/meshy/lib/pack.py), the shipped base-colour WebP put back
     (compat.transplant_image), manifest entry refreshed (enemies/tripo/manifest.json)
The sources come from git (--from-rev, default SOURCE_REV), so running this again never re-rigs its own output.
--preview DIR renders the rest pose by dominant bone (front, side) and a few frames of each clip. Display only: no
sim data changes. Notes: docs/art/tripo/enemy-rigs.md."""
import argparse
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile

import bpy
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)

from tripolib import normalize, rerig, rerig_enemy, clips_brute, compat, glbcompact, face  # noqa: E402
from tripolib.meshy import pack  # noqa: E402

STORE_SCALE = 0.5
# the commit whose enemies/tripo/<id>.glb are the batch-2 autorig builds (fix/model-quality, before this re-rig)
SOURCE_REV = '8150319b'
OUT = os.path.join(ROOT, 'public', 'models', 'enemies', 'tripo')


def _lizard_tail(x, y, z):
    return (y > -0.175) & (z < 0.36)


# Landmarks in the 1 m frame (feet on z = 0, facing -Y, its left +X), read off front / side / top views
# (tools/tripo/landmark_views.py, 0.05 grid). cx / cy: the torso's middle; hip_z / chest_z / neck_z: the spine joints
# (head_rx / head_dz: beside the head the head starts head_dz higher, so shoulder plates stay on the chest).
# arms.L.pts: shoulder joint, elbow, wrist, fingertip (the right arm mirrors the left about cx unless given); r: the
# arm's radius seen from the front per segment (upper arm, forearm, hand), ry: its half depth; minx: nothing nearer
# the middle is arm; minus: boxes that are never arm. The arm points' depth (and the elbow / wrist centring) is
# refined from the vertices (fit). legs: the feet are measured; knee / ankle heights here, top_z the crotch.
# skirt: the band that stays mostly on the hips. props: regions wholly on a hand (a club, its fist); pin: wholly on
# one bone; chains: a tail or banner on its own bone chain. style: tripolib/clips_brute.py (build, special, weapon,
# grip, hang: the arms' target angle below the horizontal, chin, lean, stride, swing).
ENEMIES = {
    # a big green lump with a club in its right hand, arms hanging at 55-70 degrees, set back from its belly
    'orc_grunt': dict(
        cx=0.04, cy=0.07, hip_z=0.26, chest_z=0.45, neck_z=0.655, head_rx=0.17, head_dz=0.07,
        arms={'L': dict(pts=[(0.22, 0.1, 0.62), (0.33, 0.1, 0.49), (0.40, 0.1, 0.41), (0.43, 0.1, 0.29)],
                        r=(0.07, 0.065, 0.065), ry=0.13, minx=0.17),
              'R': dict(pts=[(-0.15, 0.1, 0.62), (-0.25, 0.08, 0.49), (-0.31, 0.06, 0.41), (-0.34, 0.05, 0.30)],
                        r=(0.07, 0.065, 0.065), ry=0.13, minx=0.12)},
        legs=dict(knee_z=0.15, ankle_z=0.06, top_z=0.22),
        skirt=dict(z=(0.16, 0.32), hips=0.7, r=0.07),
        props=[dict(bone='hand_R', capsules=[((-0.30, 0.08, 0.265), (-0.455, -0.265, 0.6), 0.07)]),
               dict(bone='hand_R', capsules=[((-0.33, 0.08, 0.35), (-0.33, 0.08, 0.35), 0.06)])],
        style=dict(build='heavy', special='thump', weapon='R', grip=(-20, 0, 0), hang={'L': 62, 'R': 64}, chin=-8, stride=22, swing=22),
    ),
    # the red oni with its club held upright in its left hand
    'oni_brute': dict(
        cx=0.0, cy=0.02, hip_z=0.27, chest_z=0.4, neck_z=0.56, head_rx=0.2, head_dz=0.05,
        arms={'L': dict(pts=[(0.22, 0.06, 0.5), (0.31, -0.02, 0.43), (0.36, -0.09, 0.40), (0.40, -0.14, 0.34)],
                        r=(0.085, 0.075, 0.075), ry=0.13, minx=0.17),
              'R': dict(pts=[(-0.22, 0.03, 0.5), (-0.34, 0.03, 0.42), (-0.43, 0.03, 0.36), (-0.495, 0.03, 0.31)],
                        r=(0.085, 0.075, 0.07), ry=0.13, minx=0.17)},
        legs=dict(knee_z=0.12, ankle_z=0.05, top_z=0.2),
        skirt=dict(z=(0.17, 0.33), hips=0.75, r=0.07),
        props=[dict(bone='hand_L', capsules=[((0.375, -0.09, 0.24), (0.385, -0.15, 0.6), 0.05),
                                             ((0.385, -0.15, 0.55), (0.39, -0.18, 0.97), 0.1)]),
               dict(bone='hand_L', capsules=[((0.385, -0.1, 0.39), (0.385, -0.1, 0.39), 0.065)])],
        # (review r2 F1: the club arm hangs lower and the club leans out, so its head clears his cheek; the pound hoists
        # it out and back over his shoulder, not up past his face)
        style=dict(build='heavy', special='pound', weapon='L', hang={'L': 76, 'R': 60}, grip=(0, 22, 0), chin=-8, stride=22,
                   swing=20, pound_lift=-25, pound_out=70, pound_aim_out=0.4),
    ),
    # the samurai demon lord: short legs under an armour skirt, a parade banner on its back
    'fp_hyakki_daimyo': dict(
        cx=0.0, cy=-0.045, hip_z=0.17, chest_z=0.3, neck_z=0.43, head_rx=0.135, head_dz=0.08,
        arms={'L': dict(pts=[(0.13, -0.03, 0.41), (0.22, -0.03, 0.33), (0.29, -0.03, 0.27), (0.345, -0.03, 0.22)],
                        r=(0.065, 0.05, 0.045), ry=0.12, minx=0.11)},
        legs=dict(knee_z=0.08, ankle_z=0.035, top_z=0.12),
        skirt=dict(z=(0.07, 0.35), hips=0.8, r=0.05),
        chains=[dict(name='banner', parent='chest', points=[(-0.05, 0.12, 0.44), (-0.07, 0.12, 0.72), (-0.09, 0.12, 1.0)],
                     boxes=[((-0.4, 0.098, 0.44), (0.4, 0.3, 1.01)), ((-0.4, -0.3, 0.685), (0.4, 0.3, 1.01)),
                            ((-0.28, 0.08, 0.37), (-0.11, 0.26, 0.54))])],
        # (review r2 F4: the arms fling up and out to the sides in a V, not forward overhead: the overhead reach dragged a
        # sleeve across his belly)
        style=dict(build='boss', special='banner', hang={'L': 55, 'R': 55}, chin=-10, lean=-9, stride=18, swing=18,
                   banner_up=20, banner_out=95),
    ),
    # the little green runner: thin arms, big ears, a scarf
    'goblin_runner': dict(
        cx=0.0, cy=-0.01, hip_z=0.36, chest_z=0.48, neck_z=0.625, head_blend=0.02,
        # geometric eyes over its painted ones (add_eyes): the painted eyes were flat black ovals with soft edges, and
        # the hull outline showed through the creases round them as dark rims: hollow, creepy (owner, Nov 1)
        # (dark 0.3: the painted eyes' soft halo counts, so the new eyes cover it; round 0.7: a little rounder than the
        # painted slits, friendlier; the band keeps the grin below out)
        # top 0.12: the eye reaches a little higher, so from the battle camera's height no painted socket shows above it
        eyes=dict(z=(0.75, 0.9), max_x=0.2, dark=0.35, grow=1.16, round=0.72, top=0.24, lift=0.0028, bulge=0.003,
                  # (review r2 F2: its wide toothy grin, measured off the texture, becomes a small smile)
                  mouth=dict(z=0.7, lower=(0.68, 3.0), upper=(0.718, 2.0), half=0.128, margin=0.013, smile=(0.03, 0.026))),
        arms={'L': dict(pts=[(0.095, -0.02, 0.578), (0.25, -0.02, 0.48), (0.35, -0.02, 0.415), (0.41, -0.02, 0.376)],
                        r=(0.032, 0.03, 0.04), ry=0.06, minx=0.085, minus=[((0.05, -0.1, 0.36), (0.14, 0.12, 0.535))])},
        legs=dict(knee_z=0.2, ankle_z=0.06, top_z=0.33),
        # (review r2 F2: the arms hang low at its sides in idle and flinch forward in a hit, never out level)
        style=dict(build='runner', special='pounce', hang={'L': 76, 'R': 76}, chin=-10, stride=34, swing=36,
                   hit_raise=0, hit_fwd=20),
    ),
    # the bone walker: skull, rag poncho over the shoulders, arms out in front when it walks
    'ghoul_bonewalker': dict(
        cx=0.0, cy=0.0, hip_z=0.33, chest_z=0.48, neck_z=0.665, head_rx=0.2, head_dz=0.05, head_blend=0.02,
        arms={'L': dict(pts=[(0.17, 0.0, 0.61), (0.34, 0.0, 0.54), (0.44, 0.0, 0.49), (0.52, 0.0, 0.45)],
                        r=(0.045, 0.045, 0.06), ry=0.1, minx=0.15)},
        legs=dict(knee_z=0.17, ankle_z=0.05, top_z=0.27),
        skirt=dict(z=(0.17, 0.5), hips=0.75, r=0.05),
        style=dict(build='shamble', special='spook', hang={'L': 55, 'R': 55}, chin=-8, stride=20, swing=10),
    ),
    # the reed skink: big head, short arms, a long tail curling to its right
    'lizard_skink': dict(
        cx=0.0, cy=-0.26, hip_z=0.3, chest_z=0.45, neck_z=0.66, head_blend=0.04,
        arms={'L': dict(pts=[(0.13, -0.27, 0.54), (0.25, -0.27, 0.47), (0.35, -0.27, 0.41), (0.415, -0.27, 0.37)],
                        r=(0.06, 0.05, 0.05), ry=0.08, minx=0.11)},
        legs=dict(knee_z=0.17, ankle_z=0.05, top_z=0.25, foot_mask=lambda x, y, z: y < -0.17),
        chains=[dict(name='tail', parent='hips',
                     points=[(0.0, -0.17, 0.28), (0.0, 0.02, 0.19), (-0.04, 0.2, 0.12), (-0.15, 0.35, 0.07), (-0.39, 0.465, 0.04)],
                     rule=_lizard_tail, blend=0.05, root_blend=0.07)],
        style=dict(build='waddle', special='whip', hang={'L': 58, 'R': 58}, chin=-10, stride=22, swing=14, tail_swing=12),
    ),
    # the Iron Colossus: a furnace body with crystal pauldrons (on the clavicles), big fists
    'iron_colossus': dict(
        cx=0.0, cy=0.0, hip_z=0.44, chest_z=0.62, neck_z=0.885, head_rx=0.13, head_dz=0.03, head_blend=0.015,
        arms={'L': dict(pts=[(0.29, -0.03, 0.68), (0.38, -0.05, 0.55), (0.45, -0.07, 0.43), (0.49, -0.08, 0.30)],
                        r=(0.095, 0.105, 0.1), ry=0.15, minx=0.22, minus=[((0.18, -0.3, 0.665), (0.6, 0.3, 1.0))])},
        legs=dict(knee_z=0.22, ankle_z=0.07, top_z=0.4),
        pin=[dict(bone='shoulder_L', boxes=[((0.18, -0.3, 0.665), (0.6, 0.3, 1.0))]),
             dict(bone='shoulder_R', boxes=[((-0.6, -0.3, 0.665), (-0.18, 0.3, 1.0))])],
        style=dict(build='robot', special='slam', hang={'L': 64, 'R': 64}, chin=-6, stride=16, swing=14, elbow=10),
    ),
    # the Foundry Titan: chimneys on its back (chest), pauldrons on the clavicles, big fists
    'fp_foundry_titan': dict(
        cx=0.0, cy=0.0, hip_z=0.37, chest_z=0.55, neck_z=0.765, head_rx=0.125, head_dz=0.03, head_blend=0.015,
        arms={'L': dict(pts=[(0.30, -0.05, 0.62), (0.37, -0.07, 0.48), (0.42, -0.09, 0.37), (0.45, -0.1, 0.23)],
                        r=(0.1, 0.115, 0.1), ry=0.16, minx=0.23, minus=[((0.22, -0.3, 0.615), (0.6, 0.3, 1.0))])},
        legs=dict(knee_z=0.2, ankle_z=0.07, top_z=0.33),
        pin=[dict(bone='shoulder_L', boxes=[((0.22, -0.3, 0.615), (0.6, 0.3, 1.0))]),
             dict(bone='shoulder_R', boxes=[((-0.6, -0.3, 0.615), (-0.22, 0.3, 1.0))]),
             dict(bone='chest', boxes=[((-0.2, 0.08, 0.78), (0.2, 0.3, 1.01))])],
        style=dict(build='robot', special='slam', hang={'L': 64, 'R': 64}, chin=-6, stride=16, swing=14, elbow=10),
    ),
}
# the family enemies ship a light file too (glbEnemy TRIPO_ENEMY_LODS); the bosses and titans keep one file
LOD_IDS = {'orc_grunt', 'oni_brute', 'goblin_runner', 'ghoul_bonewalker', 'lizard_skink'}


def fit(V, fig):
    """Fills in the measured parts of a profile: the right arm (mirrored about cx), the arm points' depth and the
    elbow / wrist centred on the arm's own vertices, the feet. Returns a copy."""
    f = dict(fig)
    cx = f.get('cx', 0.0)
    arms = {}
    for side in ('L', 'R'):
        spec = dict(f['arms'].get(side) or f['arms']['L' if side == 'R' else 'R'])
        if side not in f['arms']:
            spec['pts'] = [(2 * cx - p[0], p[1], p[2]) for p in spec['pts']]
            spec['minus'] = [((2 * cx - hi[0], lo[1], lo[2]), (2 * cx - lo[0], hi[1], hi[2])) for lo, hi in spec.get('minus', [])]
            if 'minx' in spec:
                spec['minx'] = spec['minx'] - 2 * cx
        arms[side] = spec
    f['arms'] = arms
    x, y, z = V.T
    excl = np.zeros(len(V), bool)
    for spec in f.get('props', []) + f.get('pin', []) + f.get('chains', []):
        excl |= rerig.region(V, spec)
    for side, k in (('L', 1), ('R', -1)):
        spec = arms[side]
        pts = [np.array(p, float) for p in spec['pts']]
        radii = spec.get('r', (0.06, 0.055, 0.065))
        # the arm seen from the front (any depth, props and pinned parts left out): each joint's depth is the middle
        # of the arm's vertices around it; the elbow and wrist move halfway to the middle of the arm there too (the
        # shoulder is read off the views: the torso next to it would pull it in)
        sel = rerig_enemy.arm_select(V, pts, spec, side, exclude=excl, depth=False)
        new = []
        for j, p in enumerate(pts):
            d = np.linalg.norm(V[:, [0, 2]] - p[[0, 2]], axis=1)
            near = sel & (d < radii[min(max(j - 1, 0), 2)] * 1.2)
            if near.sum() < 6:
                new.append(p)
                continue
            lo, hi = np.percentile(V[near], 5, axis=0), np.percentile(V[near], 95, axis=0)
            c = (lo + hi) / 2
            if 0 < j < len(pts) - 1:
                new.append(np.array((0.5 * (p[0] + c[0]), c[1], 0.5 * (p[2] + c[2]))))
            else:
                new.append(np.array((p[0], c[1], p[2])))
        pts = new
        spec['pts'] = [tuple(round(float(v), 4) for v in p) for p in pts]
        print(f'[enemy-rig] arm {side}: ' + ' '.join(f'({p[0]:+.3f},{p[1]:+.3f},{p[2]:.3f})' for p in spec['pts']))
    # the feet: the middle of each foot's footprint (z < 0.06), the toe at its front
    lg = dict(f['legs'])
    mask = lg.pop('foot_mask', None)
    feet = z < 0.06
    if mask is not None:
        feet &= mask(x, y, z)
    for side, k in (('L', 1), ('R', -1)):
        q = feet & (k * (x - cx) > 0.005)
        lg.setdefault('xs', {})[side] = float((x[q].min() + x[q].max()) / 2)
        lg.setdefault('ys', {})[side] = float((y[q].min() + y[q].max()) / 2)
        lg.setdefault('toes', {})[side] = float(y[q].min() + 0.02)
    lg['x'] = (lg['xs']['L'] - lg['xs']['R']) / 2
    f['legs'] = lg
    print(f'[enemy-rig] feet: ' + ' '.join(f'{s} ({lg["xs"][s]:+.3f},{lg["ys"][s]:+.3f}) toe {lg["toes"][s]:+.3f}' for s in 'LR'))
    return f


def add_eyes(eid, body, spec, full):
    """Geometric eyes (and, with spec['mouth'], a softer mouth) over a figure's painted ones (docs/art/tripo/slime-goblin-faces.md): each painted eye is found
    from its dark texels (tripolib.face.find_painted_eyes), and covered by a dark glossy oval a little bigger than it
    (so its soft edge cannot peek out) with two white highlights, shrink-wrapped onto the face a few millimetres out,
    wholly on the head bone, in the 'face' material: glbEnemy.js draws it crisp at any zoom and never outlines it.
    Joined into the body after its material, so the body stays primitive 0. Returns the eyes' sizes (1 m frame)."""
    img = bpy.data.images.get('base')
    eyes = face.find_painted_eyes(body, img, *spec['z'], max_x=spec.get('max_x', 0.25), dark=spec.get('dark', 0.1))
    assert len(eyes) == 2, f'{eid}: found {len(eyes)} painted eyes, expected 2'
    parts = face.FaceParts(body)
    segs = 36 if full else 22
    rings = (0.45, 0.75, 1.0) if full else (0.55, 1.0)
    colour = face.glossy_eye()
    white = face.linear('#ffffff')
    grow, lift, bulge = spec.get('grow', 1.15), spec.get('lift', 0.003), spec.get('bulge', 0.003)
    sizes = []
    for e in eyes:
        fr = face.FaceParts.frame(e['centre'], e['normal'])
        a, b, off = face.ellipse_of(e, fr)
        rx, ry = a * grow, b * grow
        rx = max(rx, ry * spec.get('round', 0.0))
        top = spec.get('top', 0.0) * ry
        ry += top / 2
        off = (off[0], off[1] + top / 2)
        sizes.append(dict(side=e['side'], centre=[round(x, 4) for x in e['centre'] + fr[1] * off[0] + fr[2] * off[1]],
                          rx=round(rx, 4), ry=round(ry, 4)))
        # laid over the socket (its rim no longer hides an edge from the battle camera's height)
        rim = parts.ellipse(fr, rx, ry, colour, lift=lift, group='head', segs=segs, rings=rings, bulge=bulge, at=off,
                            bridge=True)
        # the highlights on the eye's dome: up-left big, down-right small (both eyes the same way)
        r0 = min(rx, ry)
        for (hx, hy, hr, hs) in ((-0.34, 0.38, 0.46, segs // 2), (0.36, -0.44, 0.2, max(10, segs // 3))):
            parts.ellipse(fr, r0 * hr, r0 * hr, white, lift=lift + bulge * (1 - hx * hx - hy * hy) + 0.0018, group='head',
                          segs=hs, rings=(1.0,), at=(off[0] + hx * rx, off[1] + hy * ry), bridge=rim)
    m = spec.get('mouth')
    if m:
        # a wide painted grin softened to a small smile: the grin's band (from the profile: its lower and upper edges,
        # z = a + b x^2 in the 1 m frame) covered by a skin patch (colours and shading of the skin just round it), and a
        # small open smile with a tongue drawn on that, in the middle; all on the head bone, like the eyes
        parts.use_texture(img)
        probe = face.FaceParts.frame(Vector((0.0, -0.4, m['z'])), Vector((0.0, -1.0, 0.0)))
        d = parts.depth(probe, 0.0, 0.0)
        fr = face.FaceParts.frame(Vector((0.0, -0.4 + d, m['z'])), Vector((0.0, -1.0, 0.0)))
        (la, lb), (ua, ub) = m['lower'], m['upper']
        rim = parts.band(fr, m['half'], lambda x: la - m['z'] + lb * x * x, lambda x: ua - m['z'] + ub * x * x,
                         lift=0.0012, group='head', cols=28 if full else 16, rows=4, margin=m.get('margin', 0.012))
        w, dd = m['smile']
        top = m.get('smile_top', 0.006)
        n_arc = 18 if full else 12
        pts = [(w * math.cos(math.pi * k / n_arc), top - dd * math.sin(math.pi * k / n_arc)) for k in range(n_arc + 1)]
        pts += [(-w + 2 * w * k / 6, top - 0.004 * math.sin(math.pi * k / 6)) for k in range(1, 6)]
        parts.polygon(fr, pts, face.linear('#5c2036'), lift=0.0024, group='head', bridge=rim)
        parts.ellipse(fr, w * 0.52, dd * 0.33, face.linear('#ff8aa5'), lift=0.0034, group='head', segs=14 if full else 10,
                      rings=(1.0,), at=(0.0, top - dd * 0.66), bridge=rim)
    ob = parts.to_object('face')
    for o in bpy.data.objects:
        o.select_set(o in (body, ob))
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    print(f'[enemy-rig] {eid} {"full" if full else "lod"}: eyes {json.dumps(sizes)}{" and a small smile" if m else ""}')
    return sizes


def build(eid, fig, detail, args):
    full = detail == 'full'
    src = args.shipped[detail]
    normalize.reset()
    arm, meshes = normalize.import_glb(src)
    assert len(meshes) == 1, f'{src}: expected one mesh, got {len(meshes)}'
    body = meshes[0]
    rerig.strip(arm, meshes)
    normalize.bake_world(None, meshes)
    lo, hi = normalize.bounds(meshes)
    s = 1.0 / (hi.z - lo.z)
    normalize.bake_world(None, meshes, normalize.Matrix.Scale(s, 4) @ normalize.Matrix.Translation((0, 0, -lo.z)))
    rerig.weld(body)
    V = rerig.verts(body)
    f = fit(V, fig)
    arm = rerig_enemy.build_armature(f, float(V[:, 2].max()), name=f'{eid}_rig')
    rep = rerig_enemy.skin(body, arm, f)
    print(f'[enemy-rig] {eid} {detail}: skin {json.dumps(rep)}')
    body.name = body.data.name = eid
    normalize.name_base_image([body])
    if fig.get('eyes'):
        add_eyes(eid, body, fig['eyes'], full)
    bpy.context.scene.render.fps = clips_brute.FPS
    style = dict(f['style'])
    if style.get('weapon') and f.get('props'):
        # the weapon's rest axis (its first capsule's bottom to its last capsule's top), for the specials' aim
        caps = f['props'][0]['capsules']
        a, b = np.array(caps[0][0], float), np.array(caps[-1][1], float)
        style['weapon_axis'] = tuple(float(v) for v in (b - a))
    clips_brute.BruteClips(arm, style).build()
    if args.preview:
        preview(eid, detail, arm, body, args.preview)
        if args.preview_only:
            return None
    tmp = tempfile.mkdtemp(prefix='rerig_enemy_')
    raw = os.path.join(tmp, 'raw.glb')
    normalize.export_glb(raw, [arm, body])
    face.strip_colors(raw)
    out = os.path.join(args.out, f'{eid}{"" if full else ".lod"}.glb')
    old = pack.read_glb(src)[0]['asset'].get('extras', {})
    extras = dict(id=eid, source='tripo', style='textured', kind='humanoid', height=old.get('height', 1.0), lod=not full,
                  unitScale=round(1 / STORE_SCALE, 5), generator='tools/tripo/rerig_tripo_enemy.py')
    if full:
        extras.pop('lod')
    packed = os.path.join(tmp, 'packed.glb')
    stats = pack.pack(raw, packed, STORE_SCALE, extras, webp_quality=88, tex_size=None)
    kept = compat.transplant_image(src, packed)
    # per-clip rest-constant channels dropped, one view for the animation data (the LOD budgets)
    ch0, ch1, _, _ = glbcompact.compact(packed)
    shutil.copy(packed, out)
    js, _ = pack.read_glb(out)
    verts = sum(js['accessors'][p['attributes']['POSITION']]['count'] for m in js['meshes'] for p in m['primitives'])
    tri = sum(js['accessors'][p['indices']]['count'] // 3 for m in js['meshes'] for p in m['primitives'])
    info = dict(size=os.path.getsize(out), vertices=verts, triangles=tri, animations=sorted(a['name'] for a in js['animations']))
    print(f'[enemy-rig] {eid} {detail}: {info["size"] // 1024} KB, {tri} tris, {verts} verts, clips {info["animations"]}, '
          f'{ch1} channels (of {ch0}) / {stats["keys"]} keys, shipped texture kept: {kept is not None}')
    return info


# ---- previews ------------------------------------------------------------------------------------------------
def preview(eid, detail, arm, body, out_dir):
    """Workbench renders: the rest pose by dominant bone (front, side) and three frames of each clip (front, 3/4)."""
    import colorsys
    os.makedirs(out_dir, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'
    sc.render.resolution_x = sc.render.resolution_y = 360
    if not sc.world:
        sc.world = bpy.data.worlds.new('w')
    cam = bpy.data.objects.new('pv_cam', bpy.data.cameras.new('pv_cam'))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 1.25
    views = {'front': ((0, -4, 0.5), (90, 0, 0)), 'side': ((4, 0, 0.5), (90, 0, 90)), 'q34': ((2.6, -2.6, 2.6), (58, 0, 45))}
    frames = []
    col = body.data.color_attributes.new('bone', 'BYTE_COLOR', 'POINT')
    gname = {g.index: g.name for g in body.vertex_groups}
    order = {}
    for v in body.data.vertices:
        best, bw = None, -1
        for g in v.groups:
            if g.weight > bw:
                bw, best = g.weight, gname[g.group]
        order.setdefault(best, len(order))
        r, g_, b = colorsys.hsv_to_rgb((order[best] * 0.618) % 1.0, 0.7, 0.95)
        col.data[v.index].color = (r, g_, b, 1)
    body.data.color_attributes.active_color = col
    arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
    sc.display.shading.color_type = 'VERTEX'
    for vn in ('front', 'side'):
        loc, rot = views[vn]
        cam.location = loc
        cam.rotation_euler = [math.radians(a) for a in rot]
        p = os.path.join(out_dir, f'_w_{vn}.png')
        sc.render.filepath = p
        bpy.ops.render.render(write_still=True)
        frames.append(('weights ' + vn, p))
    sc.display.shading.color_type = 'TEXTURE'
    for act in [a for a in bpy.data.actions]:
        arm.animation_data.action = act
        lo, hi = act.frame_range
        for i, fr in enumerate((lo, lo + (hi - lo) * 0.4, lo + (hi - lo) * 0.7)):
            sc.frame_set(int(round(fr)))
            for vn in ('front', 'q34'):
                if vn == 'q34' and i != 1:
                    continue
                loc, rot = views[vn]
                cam.location = loc
                cam.rotation_euler = [math.radians(a) for a in rot]
                p = os.path.join(out_dir, f'_{act.name}_{i}_{vn}.png')
                sc.render.filepath = p
                bpy.ops.render.render(write_still=True)
                frames.append((f'{act.name} {int(fr)} {vn}', p))
    arm.animation_data.action = None
    body.data.color_attributes.remove(col)
    try:
        from PIL import Image, ImageDraw
        cols, T = 6, 360
        rows = (len(frames) + cols - 1) // cols
        sheet = Image.new('RGB', (cols * T, rows * T), (40, 40, 40))
        for i, (label, p) in enumerate(frames):
            im = Image.open(p).convert('RGB')
            ImageDraw.Draw(im).text((4, 4), label, fill=(255, 255, 0))
            sheet.paste(im, ((i % cols) * T, (i // cols) * T))
            os.remove(p)
        out = os.path.join(out_dir, f'{eid}-{detail}-rig.png')
        sheet.save(out)
        print(f'[enemy-rig] preview {out}')
    except ImportError:
        print('[enemy-rig] preview frames left in', out_dir, '(no Pillow for the sheet)')


def run(eid, args):
    fig = ENEMIES[eid]
    keep = tempfile.mkdtemp(prefix=f'rerig_src_{eid}_')
    args.shipped = {}
    details = ['full', 'lod'] if eid in LOD_IDS else ['full']
    for d in details:
        name = f'{eid}{"" if d == "full" else ".lod"}.glb'
        dst = os.path.join(keep, name)
        if args.from_rev:
            rel = f'public/models/enemies/tripo/{name}'
            blob = subprocess.run(['git', '-C', ROOT, 'show', f'{args.from_rev}:{rel}'], check=True, capture_output=True).stdout
            with open(dst, 'wb') as fh:
                fh.write(blob)
        else:
            shutil.copy(os.path.join(args.out, name), dst)
        args.shipped[d] = dst
    want = details if args.detail == 'both' else [d for d in details if d == args.detail]
    infos = {d: build(eid, fig, d, args) for d in want}
    if args.preview_only or set(want) != set(details):
        return
    mpath = os.path.join(args.out, 'manifest.json')
    manifest = json.load(open(mpath))
    entry = manifest[eid]
    full = infos['full']
    entry.update(size=full['size'], triangles=full['triangles'], vertices=full['vertices'], animations=full['animations'])
    if 'lod' in infos:
        lod = infos['lod']
        entry.update(lodSize=lod['size'], lodTriangles=lod['triangles'], lodVertices=lod['vertices'])
    with open(mpath, 'w') as fh:
        json.dump(dict(sorted(manifest.items())), fh, indent=1)
        fh.write('\n')
    print(f'[enemy-rig] manifest updated: {eid}')


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument('--id', required=True, help="an enemy in ENEMIES, or 'all'")
    ap.add_argument('--out', default=OUT)
    ap.add_argument('--preview', default=None, help='render a rig / clip sheet into this folder')
    ap.add_argument('--preview-only', action='store_true', help='with --preview: render, write no GLB')
    ap.add_argument('--detail', default='both', choices=['both', 'full', 'lod'])
    ap.add_argument('--from-rev', default=SOURCE_REV,
                    help="git revision holding the batch-2 files to rebuild from; '' = the files on disk")
    args = ap.parse_args(argv)
    for eid in (list(ENEMIES) if args.id == 'all' else args.id.split(',')):
        run(eid, args)


if __name__ == '__main__':
    main()
    sys.stdout.flush()
    os._exit(0)
