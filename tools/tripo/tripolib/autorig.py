"""A biped rig for an unrigged chibi (a Tripo website download), fitted from the mesh itself.

The figure must already face -Y (Blender), feet on z = 0, 1 m tall, arms out (T- or wide A-pose). Landmarks come
from the vertices: the arm line is the height where the figure is widest (between 42 and 60 % of it), the hands its widest points, the shoulders
where the arm's vertical thickness turns into the torso's, the feet the centroids of the lowest vertices on each
side; the hips sit at 0.55 of the shoulder height (the chibi ratio of the Tripo biped rigs of batch 1). The bones get
the readable names of tripolib/rig.py (root, hips, spine, chest, neck, head, shoulder/upper_arm/forearm/hand_L/R,
thigh/shin/foot/toe_L/R), so tripolib/clips_staff.py and clips_enemy.py animate it like a renamed Tripo rig.
Weights: Blender's automatic (bone heat) weights; any vertex left without a weight goes to its nearest bone."""
import bpy
import numpy as np
from mathutils import Vector


def _verts(ob):
    m = ob.matrix_world
    return np.array([tuple(m @ v.co) for v in ob.data.vertices], dtype=np.float64)


def landmarks(V, arm_z_fixed=None):
    x, y, z = V[:, 0], V[:, 1], V[:, 2]
    top = z.max()
    # the arm line: the widest slice between 42 % and 60 % of the height (the T-posed arms of a chibi; lower down
    # twin tails, tails and skirts are wide too, higher up ears and staff heads)
    best, arm_z = -1.0, 0.5
    for zz in np.arange(0.41, 0.6, 0.01):
        s = (z > zz) & (z < zz + 0.02)
        if s.sum() < 10:
            continue
        w = np.abs(x[s]).max()
        if w > best:
            best, arm_z = w, zz + 0.01
    if arm_z_fixed is not None:
        arm_z = arm_z_fixed
        s = (z > arm_z - 0.02) & (z < arm_z + 0.02)
        best = np.abs(x[s]).max()
    hand_x = best
    # the shoulder: going inward from the hand, the first x where the body is tall (torso), not a thin arm
    band = (z > arm_z - 0.2) & (z < arm_z + 0.2)
    shoulder_x = max(0.05, hand_x * 0.3)
    for xx in np.arange(hand_x - 0.03, 0.03, -0.005):
        col = band & (np.abs(np.abs(x) - xx) < 0.008)
        if col.sum() < 5:
            continue
        if z[col].max() - z[col].min() > 0.22:
            shoulder_x = xx
            break
    shoulder_x = float(np.clip(shoulder_x, 0.05, hand_x * 0.6))
    torso = band & (np.abs(x) < shoulder_x)
    cy = float(np.median(y[torso])) if torso.sum() else 0.0
    feet = z < 0.05
    fl = feet & (x > 0.005)
    fr = feet & (x < -0.005)
    foot_x = float((np.median(x[fl]) - np.median(x[fr])) / 2) if fl.sum() and fr.sum() else 0.05
    foot_y = float(np.median(y[feet])) if feet.sum() else cy
    arm_z = float(arm_z)
    hip_z = arm_z * 0.55
    return dict(top=float(top), arm_z=arm_z, hand_x=float(hand_x), shoulder_x=shoulder_x, cy=cy,
                foot_x=float(np.clip(foot_x, 0.025, 0.12)), foot_y=foot_y, hip_z=hip_z)


def build_armature(L, name='rig'):
    data = bpy.data.armatures.new(name)
    arm = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    eb = data.edit_bones
    cy, hz, az = L['cy'], L['hip_z'], L['arm_z']

    def bone(n, h, t, parent=None, deform=True):
        b = eb.new(n)
        b.head, b.tail = Vector(h), Vector(t)
        b.use_deform = deform
        if parent:
            b.parent = eb[parent]
        return b

    bone('root', (0, cy, 0), (0, cy, 0.08), deform=False)
    bone('hips', (0, cy, hz), (0, cy, hz + 0.04), 'root')
    bone('spine', (0, cy, hz + 0.04), (0, cy, (hz + az) / 2), 'hips')
    bone('chest', (0, cy, (hz + az) / 2), (0, cy, az + 0.01), 'spine')
    bone('neck', (0, cy, az + 0.01), (0, cy, az + 0.05), 'chest')
    bone('head', (0, cy, az + 0.05), (0, cy, L['top']), 'neck')
    for s, k in (('L', 1), ('R', -1)):
        sx, hx = L['shoulder_x'], L['hand_x']
        elbow = sx + (hx - sx) * 0.48
        wrist = hx - min(0.05, (hx - sx) * 0.18)
        bone(f'shoulder_{s}', (k * 0.02, cy, az), (k * sx, cy, az), 'chest')
        bone(f'upper_arm_{s}', (k * sx, cy, az), (k * elbow, cy, az), f'shoulder_{s}')
        bone(f'forearm_{s}', (k * elbow, cy, az), (k * wrist, cy, az), f'upper_arm_{s}')
        bone(f'hand_{s}', (k * wrist, cy, az), (k * hx, cy, az), f'forearm_{s}')
        fx, fy = L['foot_x'], L['foot_y']
        bone(f'thigh_{s}', (k * fx, cy, hz - 0.01), (k * fx, cy, hz * 0.5), 'hips')
        bone(f'shin_{s}', (k * fx, cy, hz * 0.5), (k * fx, fy, 0.05), f'thigh_{s}')
        bone(f'foot_{s}', (k * fx, fy, 0.05), (k * fx, fy - 0.05, 0.02), f'shin_{s}')
        bone(f'toe_{s}', (k * fx, fy - 0.05, 0.02), (k * fx, fy - 0.08, 0.02), f'foot_{s}')
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm


def _nearest_fill(ob, arm):
    """Vertices without any weight (bone heat failed on their island) go to their nearest deforming bone."""
    segs = [(b.name, arm.matrix_world @ b.head_local, arm.matrix_world @ b.tail_local) for b in arm.data.bones if b.use_deform]
    groups = {g.name: g for g in ob.vertex_groups}
    for n, _, _ in segs:
        if n not in groups:
            groups[n] = ob.vertex_groups.new(name=n)
    mw = ob.matrix_world
    filled = 0
    for v in ob.data.vertices:
        if any(g.weight > 1e-4 for g in v.groups):
            continue
        p = mw @ v.co
        best, bn = 1e9, None
        for n, a, b in segs:
            ab = b - a
            t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
            d = (a + ab * t - p).length
            if d < best:
                best, bn = d, n
        groups[bn].add([v.index], 1.0, 'REPLACE')
        filled += 1
    return filled


ARM_BONES = ('shoulder', 'upper_arm', 'forearm', 'hand')


def _keep_arms_on_arms(ob, L, band=0.07):
    """Bone heat also gives the arms hair and twin tails hanging beside them. In the T-pose an arm is a thin
    horizontal tube: arm weight on a vertex further than `band` above or below the arm line moves to the head
    (outside the shoulders: hair) or the chest."""
    vg = {g.index: g.name for g in ob.vertex_groups}
    head, chest = ob.vertex_groups['head'], ob.vertex_groups['chest']
    mw = ob.matrix_world
    moved = 0
    for v in ob.data.vertices:
        p = mw @ v.co
        if abs(p.z - L['arm_z']) <= band:
            continue
        w = 0.0
        for g in v.groups:
            n = vg[g.group]
            if n.rsplit('_', 1)[0] in ARM_BONES and g.weight > 0:
                w += g.weight
                ob.vertex_groups[n].remove([v.index])
        if w > 0:
            (head if abs(p.x) > L['shoulder_x'] * 0.8 or p.z > L['arm_z'] else chest).add([v.index], w, 'ADD')
            moved += 1
    return moved


def rig(ob, arm_z=None):
    """Fits a rig to mesh `ob` (facing -Y, feet on z = 0, 1 m tall) and skins it. Returns (armature, landmarks).
    `arm_z` overrides the measured arm line (a figure whose hair is as wide as its arms)."""
    L = landmarks(_verts(ob), arm_z)
    arm = build_armature(L)
    for o in bpy.data.objects:
        o.select_set(False)
    ob.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    L['filled'] = _nearest_fill(ob, arm)
    L['moved'] = _keep_arms_on_arms(ob, L)
    return arm, L
