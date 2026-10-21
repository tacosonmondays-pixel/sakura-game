#!/usr/bin/env python3
"""Builds the three companion figures with Blender (bpy 4.2), in the girls' cage style.

    python3 tools/blender/companions/build_companions.py [kon kaze doll] [--out public/models/companions]
                                                         [--no-lod] [--blend out.blend]

  kon   Ruri's little holographic white fox (projected by her tablet to the lane edge)
  kaze  the white falcon drone Hana built in the robotics lab (rides on her left shoulder)
  doll  Yoriko's little drone marionette in a tiny school uniform, steered by glowing threads

Same method and libraries as the girls (tools/blender/lib): quad cages + Catmull-Clark, creased tips,
a painted face atlas on the head, vertex colours, an emissive glow material, a tiny armature, clips
authored with the girls' Poser, KHR_mesh_quantization packing. Materials keep the girls' names, so the
girls' runtime look (toon ramp, inverted-hull outline, unlit glow) applies as is:
  body  vertex colours        head  face atlas (2 x 2 cells: idle, blink, attack, happy)        halo  glow

The contract a later Meshy version must keep (docs/MODELS.md "Companions"):
  files    public/models/companions/<id>.glb + <id>.lod.glb, entry in manifest.json
  clips    idle, move, attack, appear (exact names)
  space    feet / talons at y = 0 on the origin, facing +Z, true game size x asset.extras.unitScale,
           asset.extras.height = standing height in metres at game scale
  home     manifest <id>.home = { owner, offset, follow }: where the figure stands relative to its girl
"""
import argparse
import json
import math
import os
import shutil
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.abspath(os.path.join(HERE, '..'))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, TOOLS)
sys.path.insert(0, os.path.join(TOOLS, 'enemies'))

import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

from lib import mesh as M, rig as R, export, optimize, face as F  # noqa: E402
from lib.anim import Poser, FPS  # noqa: E402
from lib.colors import mix, srgb  # noqa: E402
import efaces as EF  # noqa: E402  (tools/blender/enemies: the glossy round eye and arc strokes)

CLIPS = ['idle', 'move', 'attack', 'appear']
FACE_CELLS = ['idle', 'blink', 'attack', 'happy']
FACE_GRID = 2
GENERATOR = 'tools/blender/companions/build_companions.py'

# Where each companion lives next to its girl (glTF axes at game scale: +X = the girl's left, +Y up,
# +Z = her front; metres from her root in her bind pose). `follow` names the girl's bone whose motion the
# figure rides (its offset from that bone's bind position is kept), None = stays on the ground.
# Measured on the shipped GLBs with previews/companions.html?view=measure (Ruri / Hana: 1.224 m Meshy
# figures, Yoriko: the 0.98 m Blender figure with her bar hand held up in every clip).
HOMES = {
    'kon': dict(owner='ruri', offset=[0.24, 0.0, 0.18], follow=None,
                note="at Ruri's feet, front-left of her, facing the same way"),
    'kaze': dict(owner='hana', offset=[0.235, 0.56, 0.035], follow='shoulder_L',
                 note="perched on Hana's left shoulder (talons on the shoulder top)"),
    'doll': dict(owner='yoriko', offset=[0.264, 0.192, 0.125], follow='hand_L',
                 note="hangs in front of Yoriko's raised left hand; the thread tops (bone 'bar') meet her control bar"),
}


# ---------------------------------------------------------------------------
# Scene + cage helpers
# ---------------------------------------------------------------------------

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = FPS
    sc.frame_start = 0
    sc.frame_end = 48
    sc.unit_settings.system = 'METRIC'


def V(x, y, z):
    return Vector((x, y, z))


def part(name, vf, color, bone, levels=1, material='body', tips=None, crease=1.0, fn=None, min_levels=0):
    """A finished cage part on one bone. vf = (verts, faces[, rings]); tips = creased edge pairs."""
    o = M.new_object(name, vf[0], vf[1], color=color, bone=bone)
    if tips:
        M.crease(o, tips, crease)
    M.finish(o, levels=levels, min_levels=min_levels)
    if fn:
        M.set_color(o, color, fn=fn)
    o['material'] = material
    return o


def blob(name, center, radii, color, bone, levels=2, material='body', rot=None, fn=None):
    o = M.new_object(name, *M.sphere((0, 0, 0), radii), color=color, bone=bone)
    M.finish(o, levels=levels)
    M.transform(o, rot=rot, loc=center)
    if fn:
        M.set_color(o, color, fn=fn)
    o['material'] = material
    return o


def tube(name, path, radii, color, bone, sides=6, levels=1, tip=False, up=None, material='body', fn=None, crease=1.0):
    v, f, r = M.tube([Vector(p) for p in path], radii, sides=sides, tip_end=tip, up=up)
    return part(name, (v, f), color, bone, levels=levels, material=material, tips=M.tip_edges(r) if tip else None, crease=crease, fn=fn)


def ring(name, center, r, thick, color, bone, height=None, segments=12, levels=0, material='halo', rot=None):
    """A flat band ring (lathe of a small rectangle) around +Z, then rotated / moved."""
    h = thick if height is None else height
    prof = [(r - thick, -h / 2), (r + thick, -h / 2), (r + thick, h / 2), (r - thick, h / 2)]
    v, f, rings = M.lathe(prof, segments=segments, close_top=True, close_bottom=True)
    o = M.new_object(name, v, f, color=color, bone=bone)
    M.finish(o, levels=levels)
    M.transform(o, rot=rot, loc=center)
    o['material'] = material
    return o


def face_head(name, center, radii, bone, shape=None, levels=2):
    """A head blob with the girls' planar front-projection face UVs (one atlas cell, back -> background)."""
    verts, faces = M.sphere((0, 0, 0), (1, 1, 1), inflate=1.0)
    out = []
    for v in verts:
        p = Vector(v)
        if shape:
            p = shape(p)
        out.append((center[0] + p.x * radii[0] * M.INFLATE_SPHERE, center[1] + p.y * radii[1] * M.INFLATE_SPHERE,
                    center[2] + p.z * radii[2] * M.INFLATE_SPHERE))
    o = M.new_object(name, out, faces, color='#ffffff', bone=bone)
    M.finish(o, levels=levels, min_levels=1)
    face_uvs(o)
    o['material'] = 'head'
    return o


def face_uvs(obj, front=-0.12):
    """The girls' planar front projection (u across the head, v chin -> top) on the polygons that face the front;
    every other polygon collapses onto a background texel, so the eyes never wrap round a hairless head."""
    me = obj.data
    uv = me.uv_layers.get('UVMap') or me.uv_layers.new(name='UVMap')
    lo, hi = M.bounds(obj)
    cx, w, h = (lo.x + hi.x) / 2, hi.x - lo.x, hi.z - lo.z
    for poly in me.polygons:
        facing = poly.normal.y < front
        for li in poly.loop_indices:
            v = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = (0.5 + (v.x - cx) / w, (v.z - lo.z) / h) if facing else (0.03, 0.03)
    me.update()


def chibi_face_shape(flat=0.14, cheek=0.08, chin=0.08):
    def shape(p):
        q = Vector(p)
        front = max(0.0, -p.y)
        lower = max(0.0, -p.z)
        q.y += flat * front * (1.0 - 0.5 * abs(p.x)) * (1.0 - 0.6 * abs(p.z))
        q.x *= 1.0 + cheek * front * lower * abs(p.x)
        if p.z < 0:
            q.x *= 1.0 - chin * lower * (0.4 + 0.6 * front)
        if p.z > 0:
            q.z *= 1.0 + 0.04 * p.z
        return q
    return shape


def weights(obj, bones):
    """Smooth two-segment weights over named bones (the girls' weight_by_bones)."""
    M.weight_by_bones(obj, [(n, h, t) for n, h, t in bones], blend=0.02)
    return obj


def bone_seg(table, *names):
    by = {b[0]: b for b in table}
    return [(n, by[n][1], by[n][2]) for n in names]


def mirror_bones(table):
    """Adds the _R twin (x mirrored) of every _L bone (parents renamed too)."""
    out = list(table)
    for n, h, t, p in table:
        if n.endswith('_L'):
            pr = p[:-2] + '_R' if p and p.endswith('_L') else p
            out.append((n[:-2] + '_R', V(-h.x, h.y, h.z), V(-t.x, t.y, t.z), pr))
    return out


def _swap_side(name):
    return name[:-2] + ('_R' if name.endswith('_L') else '_L') if name.endswith(('_L', '_R')) else name


def mirrored(o):
    """Mirrored copy across X with its bone groups renamed _L <-> _R. (lib.mesh.mirror_x adds the _R groups next to
    the _L ones the copied mesh already carries in Blender 4, so a mirrored part would follow both bones 50/50.)"""
    me = o.data.copy()
    me.transform(Matrix.Diagonal((-1, 1, 1, 1)))
    me.flip_normals()
    me.update()
    m = bpy.data.objects.new(o.name + '_m', me)
    bpy.context.scene.collection.objects.link(m)
    for vg in o.vertex_groups:
        if not m.vertex_groups.get(vg.name):
            m.vertex_groups.new(name=vg.name)
    for v in me.vertices:
        for g in v.groups:
            m.vertex_groups[o.vertex_groups[g.group].name].add([v.index], g.weight, 'REPLACE')
    for vg in m.vertex_groups:
        vg.name = vg.name + '__tmp'
    for vg in m.vertex_groups:
        vg.name = _swap_side(vg.name[:-5])
    m['material'] = o.get('material', 'body')
    return m


# ---------------------------------------------------------------------------
# Face atlas (2 x 2 cells: idle, blink, attack, happy), background = the head colour
# ---------------------------------------------------------------------------

def _rgb(h):
    return tuple(int(round(c * 255)) for c in srgb(h))


def paint_cell(px, spec, cell):
    S = px * F.SS
    img = Image.new('RGBA', (S, S), _rgb(spec['skin']) + (255,))
    cy_f = 1.0 - spec['eye_v']
    if spec.get('blush') and cell != 'attack':
        F.blush(img, S, cy_f + spec.get('blush_dy', 0.15), spec.get('blush_dx', 0.32), strong=cell == 'happy', skin=spec['skin'])
    ew, eh = spec['eye_w'] * S, spec['eye_h'] * S
    lash = spec['lash']
    F._cur_skin[0] = spec['skin']
    for side in (-1, 1):
        cx, cy = (0.5 + side * spec['eye_dx']) * S, cy_f * S
        d = ImageDraw.Draw(img)
        if cell == 'blink':
            EF.arc_eye(d, cx, cy + eh * 0.12, ew * 0.9, lash, 'down')
        elif cell == 'happy':
            EF.arc_eye(d, cx, cy + eh * 0.05, ew * 0.9, lash, 'up')
        elif spec['eyes'] == 'girl':
            F.eye(img, cx, cy, ew, eh, side, spec['iris'], lash, 'round', False, focus=cell == 'attack', gentle=True)
        else:
            EF.eye_glossy(img, cx, cy, ew, eh, side, spec, style='sharp' if cell == 'attack' else 'round')
    d = ImageDraw.Draw(img)
    mouth = spec.get('mouth')
    if mouth:
        kind = {'happy': 'cheer', 'attack': 'determined'}.get(cell, mouth)
        F.mouth(d, S, 0.5, cy_f + spec.get('mouth_dy', 0.2), kind, mix(lash, '#b03a4a', 0.5), False)
    return img.resize((px, px), Image.LANCZOS)


def write_atlas(spec, path, cell_px):
    atlas = Image.new('RGB', (cell_px * FACE_GRID, cell_px * FACE_GRID))
    for i, name in enumerate(FACE_CELLS):
        atlas.paste(paint_cell(cell_px, spec, name).convert('RGB'), ((i % FACE_GRID) * cell_px, (i // FACE_GRID) * cell_px))
    atlas.save(path)
    opt = path.replace('.png', '_opt.png')
    atlas.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(opt, optimize=True)
    return opt


# ---------------------------------------------------------------------------
# Wing / pose maths: poses are (pitch, roll, yaw) degrees about the armature axes (lib/anim.Poser)
# ---------------------------------------------------------------------------

def euler_of(mat3):
    e = mat3.to_quaternion().to_euler('ZXY')
    return (math.degrees(e.x), math.degrees(e.y), math.degrees(e.z))


def frame_of(d, n):
    d = d.normalized()
    n = (n - d * n.dot(d)).normalized()
    b = n.cross(d)
    return Matrix((d, b, n)).transposed()  # columns d, b, n


def rot_between(d0, n0, d1, n1):
    """Rotation taking the frame (direction d0, normal n0) onto (d1, n1)."""
    return frame_of(d1, n1) @ frame_of(d0, n0).transposed()


def mirror_pose(r):
    return (r[0], -r[1], -r[2])


def both(pose, bone, r):
    """Sets bone_L = r and bone_R = the mirrored rotation."""
    pose[f'{bone}_L'] = r
    pose[f'{bone}_R'] = mirror_pose(r)
    return pose


# ---------------------------------------------------------------------------
# Kon: the holographic white fox (Ruri)
# ---------------------------------------------------------------------------

KON = dict(white='#f2f8ff', shade='#dceafb', paw='#d2e6fb', tip='#a6dbff', nose='#28324f', glow='#8fd8ff', iris='#2aa6ea',
           lash='#1f2d4f')


def kon_bones():
    B = [
        ('root', V(0, 0, 0), V(0, 0, 0.02), None),
        ('base', V(0, 0, 0.002), V(0, 0, 0.012), 'root'),
        ('hips', V(0, 0.012, 0.012), V(0, 0.004, 0.052), 'root'),
        ('chest', V(0, 0.004, 0.052), V(0, -0.004, 0.072), 'hips'),
        ('head', V(0, -0.006, 0.070), V(0, -0.010, 0.140), 'chest'),
        ('ear_L', V(0.024, -0.006, 0.124), V(0.038, -0.002, 0.168), 'head'),
        ('fleg_L', V(0.014, -0.016, 0.048), V(0.015, -0.024, 0.004), 'chest'),
        ('hleg_L', V(0.026, 0.018, 0.030), V(0.030, -0.004, 0.004), 'hips'),
        ('tail1', V(0, 0.040, 0.020), V(0.020, 0.070, 0.030), 'hips'),
        ('tail2', V(0.020, 0.070, 0.030), V(0.036, 0.082, 0.062), 'tail1'),
        ('tail3', V(0.036, 0.082, 0.062), V(0.030, 0.072, 0.100), 'tail2'),
    ]
    return mirror_bones(B)


def build_kon():
    c = KON
    B = kon_bones()
    parts = []
    H = V(0, -0.012, 0.100)

    def fox_shape(p):
        q = Vector(p)
        front = max(0.0, -p.y)
        lower = max(0.0, -p.z)
        q.y += 0.12 * front * (1.0 - 0.5 * abs(p.x)) * (1.0 - 0.5 * abs(p.z))
        q.x *= 1.0 + 0.16 * lower * abs(p.x)  # fluffy cheeks
        if p.z > 0:
            q.x *= 1.0 - 0.06 * p.z
        return q

    parts.append(face_head('kon_head', H, (0.048, 0.042, 0.040), 'head', fox_shape))
    # muzzle + nose (the painted eyes sit above it)
    parts.append(tube('kon_snout', [H + V(0, -0.028, -0.015), H + V(0, -0.050, -0.021)], [(0.017, 0.013), (0.008, 0.007)], c['white'], 'head', sides=6))
    parts.append(blob('kon_nose', H + V(0, -0.054, -0.018), (0.0058, 0.0042, 0.0046), c['nose'], 'head', levels=1))
    # cheek tufts (fox silhouette) and ears with glowing insides
    for s in (1, -1):
        ct = tube('kon_cheek', [H + V(s * 0.036, -0.010, -0.016), H + V(s * 0.058, -0.004, -0.030)], [(0.012, 0.009), (0.001, 0.001)],
                  c['white'], 'head', sides=5, tip=True, up=V(0, -1, 0))
        parts.append(ct)
    ear_base, ear_mid, ear_tip = H + V(0.024, 0.004, 0.026), H + V(0.033, 0.006, 0.050), H + V(0.040, 0.008, 0.074)
    ear = tube('kon_ear', [ear_base, ear_mid, ear_tip], [(0.019, 0.008), (0.013, 0.006), (0.001, 0.001)], c['white'], 'ear_L', sides=6,
               tip=True, up=V(0, -1, 0), fn=lambda co: mix(c['white'], c['tip'], max(0.0, min(1.0, (co.z - 0.150) / 0.024))))
    inner = tube('kon_ear_in', [ear_base + V(0, -0.006, 0.006), ear_mid + V(0, -0.0055, 0.0), ear_tip + V(0, -0.002, -0.012)],
                 [(0.010, 0.002), (0.007, 0.002), (0.001, 0.001)], c['glow'], 'ear_L', sides=5, tip=True, up=V(0, -1, 0), material='halo', levels=0)
    parts += [ear, inner, mirrored(ear), mirrored(inner)]
    # body (sitting pear) + chest fluff + glowing collar with a tag
    body = blob('kon_body', V(0, 0.010, 0.040), (0.030, 0.032, 0.038), c['white'], 'hips',
                fn=lambda co: mix(c['white'], c['shade'], max(0.0, min(1.0, (co.y - 0.010) / 0.03))))
    parts.append(weights(body, bone_seg(B, 'hips', 'chest')))
    parts.append(tube('kon_fluff', [V(0, -0.016, 0.064), V(0, -0.028, 0.046), V(0, -0.030, 0.030)], [(0.016, 0.010), (0.011, 0.007), (0.001, 0.001)],
                      c['white'], 'chest', sides=6, tip=True, up=V(0, -1, 0)))
    parts.append(ring('kon_collar', V(0, -0.004, 0.064), 0.023, 0.0028, c['glow'], 'chest', height=0.004, segments=10,
                      rot=Matrix.Rotation(math.radians(-18), 4, 'X')))
    parts.append(blob('kon_tag', V(0, -0.028, 0.057), (0.0055, 0.0030, 0.0055), c['glow'], 'chest', levels=1, material='halo'))
    # legs: front legs with paws and glowing cuffs, haunches with hind paws
    leg = tube('kon_leg', [V(0.014, -0.016, 0.046), V(0.015, -0.022, 0.012)], [0.0088, 0.0080], c['white'], 'fleg_L', sides=6)
    paw = blob('kon_paw', V(0.015, -0.026, 0.008), (0.0110, 0.0130, 0.0080), c['paw'], 'fleg_L', levels=1)
    cuff = ring('kon_cuff', V(0.015, -0.022, 0.017), 0.0090, 0.0018, c['glow'], 'fleg_L', height=0.003, segments=8)
    haunch = blob('kon_haunch', V(0.026, 0.018, 0.024), (0.015, 0.022, 0.020), c['white'], 'hleg_L', levels=1,
                  fn=lambda co: mix(c['white'], c['shade'], max(0.0, min(1.0, (co.y - 0.012) / 0.025))))
    hpaw = blob('kon_hpaw', V(0.030, -0.006, 0.006), (0.0090, 0.0140, 0.0060), c['paw'], 'hleg_L', levels=1)
    for o in (leg, paw, cuff, haunch, hpaw):
        parts += [o, mirrored(o)]
    # big tail curling up behind, fading to pale blue, with a glowing tip
    tail_path = [V(0, 0.040, 0.020), V(0.020, 0.070, 0.030), V(0.036, 0.082, 0.062), V(0.030, 0.072, 0.100), V(0.018, 0.060, 0.118)]
    tail = tube('kon_tail', tail_path, [0.010, 0.021, 0.025, 0.019, 0.001], c['white'], 'tail1', sides=6, tip=True, crease=0.6,
                fn=lambda co: mix(c['white'], c['tip'], max(0.0, min(1.0, (co.z - 0.050) / 0.06))))
    parts.append(weights(tail, bone_seg(B, 'tail1', 'tail2', 'tail3')))
    parts.append(tube('kon_tailtip', [V(0.031, 0.073, 0.098), V(0.024, 0.066, 0.112), V(0.015, 0.057, 0.124)], [(0.012, 0.010), (0.008, 0.007), (0.001, 0.001)],
                      c['glow'], 'tail3', sides=6, tip=True, material='halo', crease=0.6))
    # the projector pad he stands on: a thin glowing hex ring on the ground (bone 'base')
    parts.append(ring('kon_pad', V(0, 0.012, 0.0016), 0.074, 0.0026, c['glow'], 'base', height=0.0024, segments=6))
    face = dict(skin=c['white'], eyes='glossy', iris=c['iris'], sclera='#ffffff', lash=c['lash'], pupil='round', eye_v=0.52, eye_dx=0.22,
                eye_w=0.25, eye_h=0.31, blush=True, blush_dy=0.17, blush_dx=0.36, mouth=None, sparkle=False)
    extras = dict(holo=dict(opacity=0.88, scanlines=True, tint=c['glow']),
                  note='hologram: the runtime may draw body + head a little translucent with a glow rim; the pad is bone base')
    return dict(parts=parts, bones=B, glow=c['glow'], face=face, extras=extras, clips=kon_clips)


def kon_clips(p):
    sit = {'hips': (0, 0, 0), 'chest': (0, 0, 0), 'head': (0, 0, 0)}
    # idle: sits, breathes, looks about, flicks an ear, swishes the tail (2 s loop)
    p.begin('idle', loop=True)
    keys = [(0, 2, 4, 0, 10, -6, 0), (12, -1, -3, 6, -8, 8, 0), (24, 2, 0, -5, 12, -10, 0), (30, 1, 0, -5, 8, -6, 18),
            (33, 1, 0, -5, 6, -4, 0), (36, 2, 2, -6, -6, 6, 0), (48, 2, 4, 0, 10, -6, 0)]
    for f, ch, hp, hr, t1, t2, ear in keys:
        pose = dict(sit, chest=(ch, 0, 0), head=(hp, hr, 0), tail1=(0, 0, t1), tail2=(0, 0, t2), tail3=(0, 0, t2 * 0.6))
        pose['ear_L'] = (0, -ear, 0)
        pose['ear_R'] = (0, 0, 0)
        p.key(f, pose, loc={'hips': (0, 0, 0.0015 if f in (12, 36) else 0.0)})
    p.end(48)
    # move: a bounding run, leaning forward, legs paddling, tail streaming (0.5 s loop)
    p.begin('move', loop=True)
    for f, fl, bl, up, t in ((0, -50, 40, 0.014, 8), (3, -10, 10, 0.008, 0), (6, 35, -45, 0.0, -8), (9, -5, 0, 0.006, 0), (12, -50, 40, 0.014, 8)):
        pose = {'hips': (34, 0, 0), 'chest': (4, 0, 0), 'head': (-44, 0, 0), 'tail1': (-24, 0, t), 'tail2': (-10, 0, -t), 'tail3': (-6, 0, -t)}
        both(pose, 'fleg', (fl, 0, 0))
        both(pose, 'hleg', (bl, 0, 0))
        both(pose, 'ear', (-22, 0, 0))
        p.key(f, pose, loc={'hips': (0, 0, up)})
    p.end(12)
    # attack: crouch, pounce forward, land, a small yip, hop back (0.83 s)
    p.begin('attack', loop=False)
    seq = [
        (0, 0, 0, 0, 0, 0, 0, (0, 0, 0)),
        (4, -12, 8, -10, 0, -22, 0, (0, 0.006, -0.004)),
        (8, 40, -25, -70, 50, -30, -30, (0, -0.07, 0.05)),
        (11, 28, -10, -20, 30, -18, -10, (0, -0.12, 0.0)),
        (14, -6, -28, 0, 0, 10, 15, (0, -0.12, 0.0)),
        (17, -10, -10, -20, 20, -10, 0, (0, -0.06, 0.025)),
        (20, 0, 0, 0, 0, 0, 0, (0, 0, 0)),
    ]
    for f, hip, head, fl, bl, ear, wag, loc in seq:
        pose = {'hips': (hip, 0, 0), 'chest': (0, 0, 0), 'head': (head, 0, 0), 'tail1': (-12 if f == 8 else 0, 0, wag), 'tail2': (0, 0, -wag * 0.6),
                'tail3': (0, 0, 0)}
        both(pose, 'fleg', (fl, 0, 0))
        both(pose, 'hleg', (bl, 0, 0))
        both(pose, 'ear', (ear, 0, 0))
        p.key(f, pose, loc={'hips': loc}, scale={'head': 1.08 if f == 14 else 1.0})
    p.end(20)
    # appear: the pad lights, he is projected up as a thin beam, pops to size and yips (0.5 s)
    p.begin('appear', loop=False)
    for f, pad, sc, head, ear in ((0, 0.05, (0.12, 1.5, 0.12), 0, 0), (3, 1.15, (0.3, 1.35, 0.3), 0, 0), (6, 1.0, (1.15, 0.86, 1.15), 0, -15),
                                  (8, 1.0, (0.95, 1.07, 0.95), -18, 12), (10, 1.0, (1.0, 1.0, 1.0), -22, 10), (12, 1.0, (1.0, 1.0, 1.0), 0, 0)):
        pose = {'hips': (0, 0, 0), 'head': (head, 0, 0)}
        both(pose, 'ear', (ear, 0, 0))
        p.key(f, pose, scale={'base': pad, 'hips': sc})
    p.end(12)


# ---------------------------------------------------------------------------
# Kaze: the white falcon drone (Hana)
# ---------------------------------------------------------------------------

KAZE = dict(white='#f5f7fa', panel='#d3d9e2', grey='#b9c1cd', dark='#475061', joint='#3a404c', beak='#e8b84a', talon='#d6ae48',
            olive='#798d5b', glow='#7ff0cf', iris='#18a58f', lash='#253040')
WING_S, WING_E, WING_T = V(0.030, -0.002, 0.090), V(0.076, 0.008, 0.096), V(0.130, 0.024, 0.090)


def kaze_bones():
    B = [
        ('root', V(0, 0, 0), V(0, 0, 0.02), None),
        ('body', V(0, 0.006, 0.030), V(0, -0.004, 0.094), 'root'),
        ('head', V(0, -0.006, 0.094), V(0, -0.012, 0.150), 'body'),
        ('wing_L', WING_S, WING_E, 'body'),
        ('wingtip_L', WING_E, WING_T, 'wing_L'),
        ('tail', V(0, 0.026, 0.044), V(0, 0.078, 0.014), 'body'),
        ('leg_L', V(0.012, 0.004, 0.034), V(0.012, -0.004, 0.004), 'body'),
    ]
    return mirror_bones(B)


def build_kaze():
    c = KAZE
    B = kaze_bones()
    parts = []
    tilt = Matrix.Rotation(math.radians(-16), 4, 'X')
    body = blob('kaze_body', V(0, 0.008, 0.066), (0.029, 0.033, 0.040), c['white'], 'body', rot=tilt,
                fn=lambda co: mix(c['white'], c['panel'], max(0.0, min(1.0, (co.y - 0.004) / 0.03))))
    parts.append(body)
    parts.append(blob('kaze_core', V(0, -0.027, 0.060), (0.0068, 0.0030, 0.0068), c['glow'], 'body', levels=1, material='halo'))
    parts.append(ring('kaze_band', V(0, -0.002, 0.092), 0.020, 0.0030, c['olive'], 'body', height=0.006, segments=10, material='body',
                      rot=Matrix.Rotation(math.radians(-14), 4, 'X')))
    H = V(0, -0.010, 0.116)
    parts.append(face_head('kaze_head', H, (0.031, 0.029, 0.029), 'head', chibi_face_shape(flat=0.10, cheek=0.04, chin=0.10)))
    parts.append(tube('kaze_beak', [H + V(0, -0.025, -0.004), H + V(0, -0.038, -0.009), H + V(0, -0.041, -0.019)],
                      [(0.0085, 0.0075), (0.0055, 0.005), (0.001, 0.001)], c['beak'], 'head', sides=6, tip=True))
    for s in (1, -1):
        parts.append(blob('kaze_sensor', H + V(s * 0.029, 0.002, 0.004), (0.0030, 0.0042, 0.0042), c['glow'], 'head', levels=1, material='halo'))
    # wings, modelled spread (rest pose); the clips fold them for perching
    wl = []
    wl.append(tube('kaze_wing', [WING_S, WING_E], [(0.026, 0.0055), (0.024, 0.0050)], c['white'], 'wing_L', sides=6, up=V(0, 0, 1),
                   fn=lambda co: mix(c['white'], c['panel'], max(0.0, min(1.0, (co.y - 0.006) / 0.016)))))
    wl.append(tube('kaze_hand', [WING_E - V(0.004, 0, 0), WING_E.lerp(WING_T, 0.55), WING_T], [(0.024, 0.0048), (0.019, 0.004), (0.001, 0.001)],
                   c['white'], 'wingtip_L', sides=6, tip=True, up=V(0, 0, 1),
                   fn=lambda co: mix(c['white'], c['dark'], max(0.0, min(1.0, (co.x - 0.092) / 0.032)))))
    for k, t in enumerate((0.25, 0.55, 0.85)):
        a = WING_E.lerp(WING_T, t) + V(0, 0.012, -0.001)
        wl.append(tube('kaze_feather', [a, a + V(0.010, 0.020, -0.002), a + V(0.013, 0.032, -0.003)], [(0.0060, 0.0022), (0.0045, 0.0018), (0.001, 0.001)],
                       c['dark'] if k else c['grey'], 'wingtip_L', sides=4, tip=True, up=V(0, 0, 1), levels=1))
    wl.append(tube('kaze_stripe', [WING_S + V(0.010, -0.010, 0.0045), WING_E + V(0.0, -0.006, 0.0045)], [(0.0034, 0.0012), (0.003, 0.0012)],
                   c['glow'], 'wing_L', sides=4, up=V(0, 0, 1), material='halo', levels=0))
    for o in wl:
        parts += [o, mirrored(o)]
    tail = tube('kaze_tail', [V(0, 0.026, 0.044), V(0, 0.056, 0.026), V(0, 0.078, 0.014)], [(0.012, 0.0045), (0.019, 0.0040), (0.021, 0.0030)],
                c['grey'], 'tail', sides=6, up=V(0, 0, 1), fn=lambda co: mix(c['grey'], c['dark'], max(0.0, min(1.0, (co.y - 0.060) / 0.014))))
    parts.append(tail)
    leg = tube('kaze_leg', [V(0.012, 0.004, 0.036), V(0.012, -0.002, 0.010)], [0.0052, 0.0045], c['joint'], 'leg_L', sides=6)
    foot = blob('kaze_talon', V(0.012, -0.008, 0.0048), (0.0085, 0.0115, 0.0042), c['talon'], 'leg_L', levels=1)
    parts += [leg, foot, mirrored(leg), mirrored(foot)]
    face = dict(skin=c['white'], eyes='glossy', iris=c['iris'], sclera='#ffffff', lash=c['lash'], pupil='round', eye_v=0.55, eye_dx=0.21,
                eye_w=0.26, eye_h=0.31, blush=True, blush_dy=0.15, blush_dx=0.36, mouth=None)
    # modelled at 0.146 m; shown 1.35x so he reads beside Hana's big chibi head (about 0.2 m perched)
    return dict(parts=parts, bones=B, glow=c['glow'], face=face, extras={}, clips=kaze_clips, scale=1.35)


def _wing_rot(fold=0.0, flap=0.0, sweep=0.0):
    """Left wing rotation (degrees triple). fold 1 = folded along the body (perched); flap > 0 = tip down;
    sweep > 0 = swept back."""
    d0 = (WING_E - WING_S).normalized()
    n0 = V(0, 0, 1)
    spread = Matrix.Rotation(math.radians(sweep), 3, 'Z')
    spread = Matrix.Rotation(math.radians(flap), 3, 'Y') @ spread
    if fold <= 0:
        return euler_of(spread)
    # folded: the span runs back and down along the body side, trailing edge (and the dark primaries) down
    folded = rot_between(d0, n0, V(0.10, 1.0, -0.55), V(-1.0, 0.0, 0.0))
    q = spread.to_quaternion().slerp(folded.to_quaternion(), min(1.0, fold))
    return euler_of(q.to_matrix())


FOLD = _wing_rot(fold=1.0)


def kaze_clips(p):
    def perch(body=(0, 0, 0), head=(0, 0, 0), tail=(0, 0, 0), ruffle=0.0):
        pose = {'body': body, 'head': head, 'tail': tail}
        r = _wing_rot(fold=1.0 - ruffle)
        both(pose, 'wing', r)
        both(pose, 'wingtip', (0, 0, 0))
        both(pose, 'leg', (0, 0, 0))
        return pose

    def fly(flap, tip, body=58, head=-48, sweep=0.0, legs=70, tail=-12):
        pose = {'body': (body, 0, 0), 'head': (head, 0, 0), 'tail': (tail, 0, 0)}
        both(pose, 'wing', _wing_rot(flap=flap, sweep=sweep))
        both(pose, 'wingtip', (0, tip, 0))
        both(pose, 'leg', (legs, 0, 0))
        return pose

    # idle: perched, breathing, looking around, a tail flick and a wing ruffle (2 s loop)
    p.begin('idle', loop=True)
    for f, b, h, t, rf in ((0, (2, 0, 0), (0, 0, 0), (0, 0, 0), 0), (8, (0, 0, 0), (0, 0, 30), (0, 0, 0), 0), (16, (3, 0, 0), (-6, 10, 30), (0, 0, 0), 0),
                           (20, (2, 0, 0), (0, 0, 0), (0, 0, 0), 0.12), (24, (0, 0, 0), (0, 0, 0), (-10, 0, 0), 0), (28, (1, 0, 0), (0, 0, 0), (0, 0, 0), 0),
                           (34, (2, 0, 0), (-4, -8, -26), (0, 0, 0), 0), (42, (0, 0, 0), (0, 0, -24), (0, 0, 0), 0), (48, (2, 0, 0), (0, 0, 0), (0, 0, 0), 0)):
        p.key(f, perch(b, h, t, rf))
    p.end(48)
    # move: flapping flight, body level, legs tucked (0.5 s loop)
    p.begin('move', loop=True)
    for f, flap, tip, up, sw in ((0, -42, -14, 0.030, 4), (3, -5, -18, 0.026, 0), (6, 34, 10, 0.020, -8), (9, 5, 16, 0.024, -2), (12, -42, -14, 0.030, 4)):
        p.key(f, fly(flap, tip, sweep=sw), loc={'body': (0, 0, up)})
    p.end(12)
    # attack: rise, wings tucked into a dive, talons forward with a flare, climb back (0.83 s)
    p.begin('attack', loop=False)
    seq = [
        (0, fly(-10, 0), (0, 0, 0.026)),
        (3, fly(-50, -10, body=38, head=-30), (0, 0.02, 0.06)),
        (7, fly(-12, -4, body=100, head=-70, sweep=70, legs=40, tail=0), (0, -0.10, 0.012)),
        (10, fly(-62, -20, body=24, head=-26, sweep=-6, legs=-75, tail=-25), (0, -0.16, -0.010)),
        (14, fly(30, 10, body=56, head=-46, legs=40), (0, -0.10, 0.040)),
        (20, fly(-10, 0), (0, 0, 0.026)),
    ]
    for f, pose, loc in seq:
        p.key(f, pose, loc={'body': loc})
    p.end(20)
    # appear: flies in from above, flares and lands, folds the wings (0.67 s)
    p.begin('appear', loop=False)
    seq = [
        (0, fly(-45, -12, body=50, head=-40), (0, 0.06, 0.22), 0.35),
        (4, fly(35, 10, body=40, head=-34), (0, 0.03, 0.12), 1.0),
        (8, fly(-60, -18, body=8, head=-6, legs=-30, tail=-20), (0, 0.01, 0.03), 1.0),
        (11, fly(-22, -6, body=4, head=0, legs=0, tail=-6), (0, 0, 0), 1.0),
        (16, perch(), (0, 0, 0), 1.0),
    ]
    for f, pose, loc, sc in seq:
        p.key(f, pose, loc={'body': loc}, scale={'root': sc})
    p.end(16)


# ---------------------------------------------------------------------------
# The drone marionette (Yoriko): a tiny doll in a school uniform on three glowing threads
# ---------------------------------------------------------------------------

DOLL = dict(skin='#fde8de', hair='#b49ad0', hairShade='#7d64a6', iris='#9a72d0', white='#f6f2f8', collar='#7d64a6', stripe='#e9e2f6',
            skirt='#2f2a62', sock='#f4f1f8', shoe='#6a4636', glow='#dab8ff', lash='#3b2d55')
BAR_Z = 0.50


def doll_bones():
    B = [
        ('root', V(0, 0, 0), V(0, 0, 0.02), None),
        ('hips', V(0, 0, 0.105), V(0, 0, 0.135), 'root'),
        ('chest', V(0, 0, 0.135), V(0, 0, 0.172), 'hips'),
        ('head', V(0, 0, 0.172), V(0, 0, 0.292), 'chest'),
        ('arm_L', V(0.031, 0, 0.165), V(0.076, -0.006, 0.122), 'chest'),
        ('leg_L', V(0.014, 0, 0.100), V(0.016, -0.002, 0.012), 'hips'),
        ('bar', V(0, 0.01, BAR_Z), V(0, 0.01, BAR_Z + 0.03), 'root'),
    ]
    return mirror_bones(B)


def build_doll():
    c = DOLL
    B = doll_bones()
    parts = []
    H = V(0, 0.0, 0.230)
    parts.append(face_head('doll_head', H, (0.062, 0.057, 0.060), 'head', chibi_face_shape(flat=0.16, cheek=0.09, chin=0.10)))
    # lilac bob: crown cap set back from the face, side locks, a blunt fringe, a glowing hair clip
    shade = lambda co: mix(c['hair'], c['hairShade'], max(0.0, min(1.0, (0.215 - co.z) / 0.06)))  # noqa: E731
    parts.append(blob('doll_cap', H + V(0, 0.008, 0.020), (0.067, 0.062, 0.054), c['hair'], 'head', fn=shade))
    parts.append(blob('doll_back', H + V(0, 0.026, -0.024), (0.063, 0.040, 0.050), c['hair'], 'head', levels=1, fn=shade))
    side = blob('doll_side', H + V(0.053, -0.006, -0.026), (0.022, 0.034, 0.046), c['hair'], 'head', levels=1, fn=shade,
                rot=Matrix.Rotation(math.radians(-6), 4, 'Y'))
    parts += [side, mirrored(side)]
    v, f = M.box((0, 0, 0), (0.112, 0.015, 0.040))
    fringe = M.new_object('doll_fringe', v, f, color=c['hair'], bone='head')
    M.crease(fringe, [(0, 1), (4, 5)], 0.6)
    M.finish(fringe, levels=2)
    # bend the slab round the forehead
    for vt in fringe.data.vertices:
        vt.co.y += 9.0 * vt.co.x * vt.co.x
    M.transform(fringe, rot=Matrix.Rotation(math.radians(-24), 4, 'X'), loc=H + V(0, -0.049, 0.031))
    fringe['material'] = 'body'
    parts.append(fringe)
    parts.append(blob('doll_clip', H + V(0.040, -0.044, 0.040), (0.0075, 0.0040, 0.0075), c['glow'], 'head', levels=1, material='halo'))
    # sailor top + collar, glowing bow, pleated navy skirt
    top = blob('doll_top', V(0, 0.0, 0.145), (0.034, 0.029, 0.036), c['white'], 'chest')
    parts.append(weights(top, bone_seg(B, 'hips', 'chest')))
    parts.append(ring('doll_collar', V(0, 0.004, 0.171), 0.032, 0.0055, c['collar'], 'chest', height=0.006, segments=12, material='body',
                      rot=Matrix.Rotation(math.radians(14), 4, 'X')))
    parts.append(ring('doll_stripe', V(0, 0.004, 0.1745), 0.033, 0.0016, c['stripe'], 'chest', height=0.0026, segments=12, material='body',
                      rot=Matrix.Rotation(math.radians(14), 4, 'X')))
    for s in (1, -1):
        parts.append(blob('doll_bow', V(s * 0.009, -0.030, 0.158), (0.0085, 0.0045, 0.0062), c['glow'], 'chest', levels=1, material='halo',
                          rot=Matrix.Rotation(math.radians(s * 20), 4, 'Y')))
    parts.append(blob('doll_knot', V(0, -0.031, 0.158), (0.0045, 0.004, 0.0045), c['glow'], 'chest', levels=1, material='halo'))
    prof = [(0.028, 0.124), (0.036, 0.110), (0.050, 0.086), (0.060, 0.070)]
    v, f, rings = M.lathe(prof, segments=16, close_top=True, close_bottom=True)
    v = [(x * (1.10 if k % 2 and z < 0.09 else 1.0), y * (1.10 if k % 2 and z < 0.09 else 1.0), z) for k, (x, y, z) in zip([i % 16 for i in range(len(v))], v)]
    parts.append(part('doll_skirt', (v, f), c['skirt'], 'hips', levels=1))
    # arms held out by the threads, glowing wrist joints (a drone marionette), white sleeves + hands
    sh, hd = V(0.030, 0, 0.166), V(0.073, -0.006, 0.126)
    arm = tube('doll_arm', [sh, sh.lerp(hd, 0.5), hd], [0.0110, 0.0100, 0.0092], c['white'], 'arm_L', sides=6)
    hand = blob('doll_hand', hd + V(0.004, -0.001, -0.004), (0.0105, 0.0095, 0.0105), c['skin'], 'arm_L', levels=1)
    wrist = ring('doll_wrist', sh.lerp(hd, 0.86), 0.0098, 0.0018, c['glow'], 'arm_L', height=0.003, segments=8,
                 rot=Vector((0, 0, 1)).rotation_difference(hd - sh).to_matrix().to_4x4())
    parts += [arm, hand, wrist, mirrored(arm), mirrored(hand), mirrored(wrist)]
    # legs: a little skin above white knee socks, brown shoes
    leg = tube('doll_leg', [V(0.014, 0, 0.104), V(0.015, -0.001, 0.060), V(0.016, -0.002, 0.020)], [0.0110, 0.0100, 0.0092], c['sock'], 'leg_L', sides=6,
               fn=lambda co: c['skin'] if co.z > 0.082 else c['sock'])
    shoe = blob('doll_shoe', V(0.016, -0.006, 0.011), (0.0118, 0.0165, 0.0105), c['shoe'], 'leg_L', levels=1)
    parts += [leg, shoe, mirrored(leg), mirrored(shoe)]
    # three glowing threads up to the control bar (bone 'bar': the runtime may pin it to Yoriko's bar)
    for name, bone, lo, hi in (('thread_L', 'arm_L', hd + V(0.004, -0.001, 0.004), V(0.050, 0.004, BAR_Z)),
                               ('thread_R', 'arm_R', V(-hd.x - 0.004, hd.y - 0.001, hd.z + 0.004), V(-0.050, 0.016, BAR_Z)),
                               ('thread_H', 'head', H + V(0, 0.006, 0.064), V(0, 0.010, BAR_Z + 0.006))):
        v, f, rr = M.tube([lo, hi], 0.0016, sides=3)
        o = M.new_object(name, v, f, color=c['glow'])
        gb = o.vertex_groups.new(name=bone)
        gt = o.vertex_groups.new(name='bar')
        gb.add(rr[0], 1.0, 'REPLACE')
        gt.add(rr[1], 1.0, 'REPLACE')
        o['material'] = 'halo'
        parts.append(o)
    face = dict(skin=c['skin'], eyes='girl', iris=c['iris'], lash=c['lash'], eye_v=0.40, eye_dx=0.205, eye_w=0.28, eye_h=0.27, blush=True,
                blush_dy=0.12, blush_dx=0.33, mouth='smile', mouth_dy=0.19)
    extras = dict(threads=dict(bone='bar', bones=['arm_L', 'arm_R', 'head'],
                               note="thread tops ride bone 'bar'; set its world position to Yoriko's control bar to keep them attached"))
    return dict(parts=parts, bones=B, glow=c['glow'], face=face, extras=extras, clips=doll_clips, height_exclude=('thread',))


def doll_clips(p):
    def pose_of(hips=(0, 0, 0), chest=(0, 0, 0), head=(0, 0, 0), arm=(0, -15, 0), arm_r=None, leg_l=(0, 0, 0), leg_r=(0, 0, 0)):
        pose = {'hips': hips, 'chest': chest, 'head': head, 'arm_L': arm, 'arm_R': arm_r if arm_r is not None else mirror_pose(arm),
                'leg_L': leg_l, 'leg_R': leg_r}
        return pose

    # idle: dangles and bobs on the threads, legs swinging, arms lifted and lowered (2 s loop)
    p.begin('idle', loop=True)
    for f, z, roll, ll, lr, a, hr in ((0, 0.0, 4, 10, -8, -14, 4), (12, 0.010, 0, 0, 0, -30, 0), (24, 0.0, -4, -10, 8, -14, -5),
                                      (36, 0.008, 0, 0, 0, -28, 0), (48, 0.0, 4, 10, -8, -14, 4)):
        p.key(f, pose_of(hips=(0, roll, 0), head=(-4, hr, 0), arm=(0, a, 0), leg_l=(ll, 0, 0), leg_r=(lr, 0, 0)), loc={'hips': (0, 0, z)})
    p.end(48)
    # move: floats forward, leaning in, legs trailing, arms swept back (1 s loop)
    p.begin('move', loop=True)
    for f, z, ll, lr in ((0, 0.004, 22, 38), (12, 0.014, 38, 22), (24, 0.004, 22, 38)):
        p.key(f, pose_of(hips=(18, 0, 0), head=(-14, 0, 0), arm=(0, -22, 30), leg_l=(ll, 0, 0), leg_r=(lr, 0, 0)), loc={'hips': (0, 0, z)})
    p.end(24)
    # attack: pulled back on the threads, dashes forward with a chop of the right arm and a kick, swings home (0.67 s)
    p.begin('attack', loop=False)
    seq = [
        (0, (0, 0, 0), (0, 4, 0), (0, -14, 0), None, (0, 0, 0), (0, 0, 0), (0, 0, 0)),
        (3, (-16, 0, 0), (-6, 0, 0), (0, -40, 0), (0, 75, -10), (-20, 0, 0), (10, 0, 0), (0, 0.035, 0.02)),
        (6, (32, 0, 0), (-18, 0, 0), (0, -10, 45), (0, 25, 80), (45, 0, 0), (-30, 0, 0), (0, -0.16, 0.0)),
        (9, (26, 0, 0), (-12, 0, 0), (0, -10, 40), (0, 10, 70), (40, 0, 0), (-20, 0, 0), (0, -0.18, 0.004)),
        (12, (6, 0, 0), (-4, 0, 0), (0, -20, 10), (0, 20, 10), (10, 0, 0), (0, 0, 0), (0, -0.06, 0.012)),
        (16, (0, 0, 0), (0, 4, 0), (0, -14, 0), None, (0, 0, 0), (0, 0, 0), (0, 0, 0)),
    ]
    for f, hips, head, arm, arm_r, ll, lr, loc in seq:
        p.key(f, pose_of(hips=hips, head=head, arm=arm, arm_r=arm_r, leg_l=ll, leg_r=lr), loc={'hips': loc})
    p.end(16)
    # appear: drops in on the threads, the strings catch, a little bounce (0.5 s)
    p.begin('appear', loop=False)
    for f, z, sc, a, ll in ((0, 0.20, 0.2, -10, 0), (5, -0.03, 1.1, -60, -25), (8, 0.015, 0.97, -35, 10), (12, 0.0, 1.0, -14, 0)):
        p.key(f, pose_of(head=(-4, 0, 0), arm=(0, a, 0), leg_l=(ll, 0, 0), leg_r=(-ll * 0.6, 0, 0)), loc={'hips': (0, 0, z)}, scale={'hips': sc})
    p.end(12)


BUILDERS = dict(kon=build_kon, kaze=build_kaze, doll=build_doll)


# ---------------------------------------------------------------------------
# Build one figure (full or LOD)
# ---------------------------------------------------------------------------

def build(cid, out_dir, lod=False, keep_blend=None):
    tmpdir = tempfile.mkdtemp(prefix='sakura_comp_')
    try:
        return _build(cid, out_dir, tmpdir, lod, keep_blend)
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def _build(cid, out_dir, tmpdir, lod, keep_blend):
    t0 = time.time()
    reset_scene()
    M.LEVEL_DROP[0] = 1 if lod else 0
    spec = BUILDERS[cid]()
    parts = spec['parts']
    excl = spec.get('height_exclude', ())
    height = max(max((o.matrix_world @ v.co).z for v in o.data.vertices) for o in parts
                 if o.get('material', 'body') != 'halo' and not any(e in o.name for e in excl))
    atlas = write_atlas(spec['face'], os.path.join(tmpdir, f'{cid}_face.png'), 64 if lod else 128)
    mats = export.make_materials(atlas, spec['glow'])
    for o in parts:
        export.assign_material(o, mats[o.get('material', 'body')])
    mesh_obj = M.join(parts, name=f'companion_{cid}')
    k = spec.get('scale', 1.0)  # whole-figure scale (mesh, bones and clip offsets)
    height *= k
    mesh_obj.data.transform(Matrix.Scale(k, 4))
    mesh_obj.data.update()
    arm = R.build_armature([(n, h * k, t * k, par) for n, h, t, par in spec['bones']], name=f'rig_{cid}')
    R.bind(mesh_obj, arm)
    R.normalize_weights(mesh_obj)
    poser = Poser(arm, loc_scale=k)
    spec['clips'](poser)
    bpy.context.scene.frame_set(0)
    for pb in arm.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, f'{cid}{".lod" if lod else ""}.glb')
    export.export_glb(out, [arm, mesh_obj], animations=True)
    home = HOMES[cid]
    extras = dict(companion=cid, owner=home['owner'], height=round(height, 4), unitScale=1.0, faceCells=FACE_CELLS, faceGrid=FACE_GRID,
                  clips=CLIPS, home=dict(offset=home['offset'], follow=home['follow']), lod=lod, generator=GENERATOR, **spec['extras'])
    export.replace_image(out, atlas, extras=extras)
    optimize.optimize_glb(out)
    info = export.describe(out)
    info['height'] = round(height, 4)
    if keep_blend:
        export.pack_images()
        bpy.ops.wm.save_as_mainfile(filepath=keep_blend)
    info['seconds'] = round(time.time() - t0, 1)
    print(f"[build] {cid}{' (lod)' if lod else ''}: {info['size']} B, {info['vertices']} verts, {info['primitives']} prims, bones {info['bones']}, "
          f"clips {info['animations']}, height {info['height']}, {info['seconds']}s")
    return info


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('ids', nargs='*')
    ap.add_argument('--out', default=os.path.join(ROOT, 'public', 'models', 'companions'))
    ap.add_argument('--no-lod', action='store_true')
    ap.add_argument('--blend', default=None, help='save the last full build as a .blend for inspection')
    args = ap.parse_args()
    ids = args.ids or list(BUILDERS)
    manifest_path = os.path.join(args.out, 'manifest.json')
    manifest = {}
    if os.path.exists(manifest_path):
        with open(manifest_path) as f:
            manifest = json.load(f)
    for cid in ids:
        if cid not in BUILDERS:
            print(f'[build] unknown companion {cid}', file=sys.stderr)
            continue
        if manifest.get(cid, {}).get('source') == 'meshy':
            print(f'[build] {cid}: kept the imported Meshy model')
            continue
        full = build(cid, args.out, lod=False, keep_blend=args.blend)
        entry = dict(manifest.get(cid, {}))
        entry.update(file=f'{cid}.glb', bytes=full['size'], vertices=full['vertices'], clips=full['animations'], height=full['height'],
                     owner=HOMES[cid]['owner'], home=dict(offset=HOMES[cid]['offset'], follow=HOMES[cid]['follow'], note=HOMES[cid]['note']),
                     source='blender')
        if not args.no_lod:
            lod = build(cid, args.out, lod=True)
            entry.update(lod=f'{cid}.lod.glb', lodBytes=lod['size'], lodVertices=lod['vertices'])
        manifest[cid] = entry
        with open(manifest_path, 'w') as f:
            json.dump(dict(sorted(manifest.items())), f, indent=1)
    print(f'[build] manifest: {len(manifest)} companions, {sum(v["bytes"] + v.get("lodBytes", 0) for v in manifest.values())} B')


if __name__ == '__main__':
    main()
