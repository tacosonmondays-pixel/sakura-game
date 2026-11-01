"""A biped rig fitted from per-figure landmarks, for the Tripo website figures whose automatic fit went wrong.

tripolib/autorig.py measures the arm line as the widest slice of the figure and the shoulder as the first tall
column inward from the hand. On Luna the widest slice is her fox tail (her hands were put on the tail tips and
her whole arms, staff and tail were left on the head, chest and thigh bones: she stood in a T-pose whatever the
clips did); on Nami, Kanna and Yoriko the hair and coats beside the arms made the shoulder joint land halfway
down the arm, so only the forearms moved. Here every landmark comes from the figure's profile (FIGURES in
tools/tripo/rerig_tripo_chibi.py, measured on its front, side and top views in the 1 m frame) and only the
hands are refined from the vertices. The rig has the same bone names as before (so the clips, Yoriko's doll on
hand_L and the tests keep working) and the same hierarchy as a standard humanoid (MIXAMO_NAMES maps it), plus
optional tail bones.

Weights: Blender's bone heat on the welded mesh, then region rules per figure:
  * props (a staff, a trident, a control bar) go wholly to their hand, so they stay in the grip;
  * arm weights only inside the arm tube (|z - arm_z| <= band), elsewhere they move to the head (above) or the
    chest (below: side locks, coat panels);
  * tail weights only inside the tail region, and the tail region only on tail bones and the hips;
  * pinned regions (twin tails, a drum on the hip) wholly on one bone;
  * vertices left unweighted go to their nearest bone; a few Laplacian passes soften the cuts (props and pinned
    parts held fixed); at most four influences, normalised."""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Vector

# the game's bone names -> the standard humanoid (Mixamo) names, for retargeting stock clips later in Blender
MIXAMO_NAMES = {
    'hips': 'Hips', 'spine': 'Spine', 'chest': 'Spine2', 'neck': 'Neck', 'head': 'Head',
    'shoulder_L': 'LeftShoulder', 'upper_arm_L': 'LeftArm', 'forearm_L': 'LeftForeArm', 'hand_L': 'LeftHand',
    'shoulder_R': 'RightShoulder', 'upper_arm_R': 'RightArm', 'forearm_R': 'RightForeArm', 'hand_R': 'RightHand',
    'thigh_L': 'LeftUpLeg', 'shin_L': 'LeftLeg', 'foot_L': 'LeftFoot', 'toe_L': 'LeftToeBase',
    'thigh_R': 'RightUpLeg', 'shin_R': 'RightLeg', 'foot_R': 'RightFoot', 'toe_R': 'RightToeBase',
}

ARM_PARTS = ('upper_arm', 'forearm', 'hand')


def verts(ob):
    m = ob.matrix_world
    return np.array([tuple(m @ v.co) for v in ob.data.vertices], dtype=np.float64)


def strip(arm, meshes):
    """Drops the old rig: armature, vertex groups, armature modifiers, parenting and every action. The mesh keeps
    its bind-pose shape (the shipped vertices are the rest pose)."""
    for m in meshes:
        mw = m.matrix_world.copy()
        m.parent = None
        m.matrix_world = mw
        for mod in list(m.modifiers):
            m.modifiers.remove(mod)
        m.vertex_groups.clear()
    if arm:
        bpy.data.objects.remove(arm)
    for a in list(bpy.data.actions):
        bpy.data.actions.remove(a)


def weld(ob, dist=1e-5):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=dist)
    bm.to_mesh(ob.data)
    bm.free()


def _in_capsule(P, a, b, r):
    a, b = np.array(a, float), np.array(b, float)
    ab = b - a
    t = np.clip(((P - a) @ ab) / max(ab @ ab, 1e-12), 0, 1)
    d = np.linalg.norm(P - (a + t[:, None] * ab), axis=1)
    return d <= r


def _in_box(P, lo, hi):
    lo, hi = np.array(lo, float), np.array(hi, float)
    return np.all((P >= lo) & (P <= hi), axis=1)


def region(P, spec):
    """Vertices inside a region spec: {'capsules': [(a, b, r)] (3D points, or (x, z) points with an optional 4th
    item (y_lo, y_hi): a capsule seen from the front), 'boxes': [(lo, hi)], 'minus': [(lo, hi)],
    'rule': fn(x, y, z) -> bool array}."""
    sel = np.zeros(len(P), bool)
    for cap in spec.get('capsules', []):
        a, b, r = cap[:3]
        if len(a) == 2:
            ylo, yhi = cap[3] if len(cap) > 3 else (-1.0, 1.0)
            sel |= _in_capsule(P[:, [0, 2]], a, b, r) & (P[:, 1] >= ylo) & (P[:, 1] <= yhi)
        else:
            sel |= _in_capsule(P, a, b, r)
    for lo, hi in spec.get('boxes', []):
        sel |= _in_box(P, lo, hi)
    if spec.get('rule'):
        sel |= spec['rule'](P[:, 0], P[:, 1], P[:, 2])
    for lo, hi in spec.get('minus', []):
        sel &= ~_in_box(P, lo, hi)
    return sel


def landmarks(V, fig):
    """Rig landmarks in the 1 m frame from the figure profile; the hands are refined from the vertices of the
    arm tube (unless the profile pins them)."""
    x, y, z = V.T
    az = fig['arm_z']
    sx = fig['shoulder_x']
    torso = (np.abs(x) < sx * 0.8) & (z > az - 0.2) & (z < az)
    cy = float(fig.get('cy', np.median(y[torso]) if torso.sum() else 0.0))
    band = (np.abs(z - az) < fig.get('arm_band', 0.05))
    hands = {}
    for side, k in (('L', 1), ('R', -1)):
        pinned = fig.get('hand_x', {}).get(side)
        if pinned:
            hands[side] = pinned
            continue
        arm = band & (k * x > sx) & (np.abs(y - fig.get('arm_y', cy)) < 0.07)
        for spec in fig.get('props', []):
            arm &= ~region(V, spec)
        hands[side] = float(np.percentile(k * x[arm], 99.5)) if arm.sum() > 20 else 0.3
    feet = z < 0.05
    fl, fr = feet & (x > 0.005), feet & (x < -0.005)
    foot_x = float((np.median(x[fl]) - np.median(x[fr])) / 2) if fl.sum() and fr.sum() else 0.05
    foot_y = float(np.median(y[feet])) if feet.sum() else cy
    return dict(top=float(z.max()), arm_z=az, arm_y=float(fig.get('arm_y', cy)), shoulder_x=sx, hand_x=hands, cy=cy,
                hip_z=fig.get('hip_z', az * 0.55), foot_x=float(np.clip(foot_x, 0.025, 0.12)), foot_y=foot_y,
                neck_z=fig.get('neck_z', az + 0.03))


def build_armature(L, fig, name='rig'):
    data = bpy.data.armatures.new(name)
    arm = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    eb = data.edit_bones
    cy, hz, az, ay, nz = L['cy'], L['hip_z'], L['arm_z'], L['arm_y'], L['neck_z']

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
    bone('chest', (0, cy, (hz + az) / 2), (0, cy, nz - 0.005), 'spine')
    bone('neck', (0, cy, nz - 0.005), (0, cy, nz + 0.035), 'chest')
    bone('head', (0, cy, nz + 0.035), (0, cy, L['top']), 'neck')
    for s, k in (('L', 1), ('R', -1)):
        sx, hx = L['shoulder_x'], L['hand_x'][s]
        reach = hx - sx
        elbow = sx + reach * fig.get('elbow', 0.5)
        wrist = hx - reach * fig.get('hand_len', 0.22)
        bone(f'shoulder_{s}', (k * 0.025, cy, az - 0.01), (k * sx, ay, az), 'chest')
        bone(f'upper_arm_{s}', (k * sx, ay, az), (k * elbow, ay, az), f'shoulder_{s}')
        bone(f'forearm_{s}', (k * elbow, ay, az), (k * wrist, ay, az), f'upper_arm_{s}')
        bone(f'hand_{s}', (k * wrist, ay, az), (k * hx, ay, az), f'forearm_{s}')
        fx, fy = L['foot_x'], L['foot_y']
        bone(f'thigh_{s}', (k * fx, cy, hz - 0.01), (k * fx, cy, hz * 0.5), 'hips')
        bone(f'shin_{s}', (k * fx, cy, hz * 0.5), (k * fx, fy, 0.05), f'thigh_{s}')
        bone(f'foot_{s}', (k * fx, fy, 0.05), (k * fx, fy - 0.05, 0.02), f'shin_{s}')
        bone(f'toe_{s}', (k * fx, fy - 0.05, 0.02), (k * fx, fy - 0.08, 0.02), f'foot_{s}')
    tail = fig.get('tail')
    if tail:
        pts = tail['points']
        parent = 'hips'
        for i in range(len(pts) - 1):
            bone(f'tail_{i + 1}', pts[i], pts[i + 1], parent)
            parent = f'tail_{i + 1}'
    for ch in fig.get('chains', []):
        # hair chains (twin tails): bone heat sorts their vertices from the arms', the clips sway them
        pts = ch['points']
        parent = ch.get('parent', 'head')
        for i in range(len(pts) - 1):
            bone(f'{ch["name"]}_{i + 1}', pts[i], pts[i + 1], parent)
            parent = f'{ch["name"]}_{i + 1}'
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm


def _weights(ob):
    """(n, groups) dense weight matrix and the group names."""
    names = [g.name for g in ob.vertex_groups]
    W = np.zeros((len(ob.data.vertices), len(names)))
    for v in ob.data.vertices:
        for g in v.groups:
            W[v.index, g.group] = g.weight
    return W, names


def _write(ob, W, names, limit=4):
    """Keeps the `limit` largest weights per vertex, normalises them and writes them back."""
    W = W.copy()
    if W.shape[1] > limit:
        cut = np.argsort(-W, axis=1)[:, limit:]
        np.put_along_axis(W, cut, 0.0, axis=1)
    s = W.sum(1, keepdims=True)
    W = np.where(s > 1e-9, W / np.maximum(s, 1e-9), W)
    for g in list(ob.vertex_groups):
        ob.vertex_groups.remove(g)
    groups = [ob.vertex_groups.new(name=n) for n in names]
    for j, g in enumerate(groups):
        idx = np.nonzero(W[:, j] > 1e-4)[0]
        for i in idx:
            g.add([int(i)], float(W[i, j]), 'REPLACE')


def _nearest(P, segs):
    """Index of the nearest bone segment for each point."""
    best = np.full(len(P), 1e9)
    out = np.zeros(len(P), int)
    for j, (a, b) in enumerate(segs):
        ab = b - a
        t = np.clip(((P - a) @ ab) / max(ab @ ab, 1e-12), 0, 1)
        d = np.linalg.norm(P - (a + t[:, None] * ab), axis=1)
        m = d < best
        best[m] = d[m]
        out[m] = j
    return out, best


def smooth_weights(ob, W, fixed, iters=4, k=0.5):
    """Laplacian smoothing of the weight rows over the mesh edges; `fixed` rows never change and still pull on
    their neighbours (a prop's grip stays rigid, the cuff next to it blends)."""
    if iters <= 0:
        return W
    e = np.array([tuple(ed.vertices) for ed in ob.data.edges], dtype=np.int64)
    if not len(e):
        return W
    n = len(W)
    deg = np.bincount(e.ravel(), minlength=n).astype(float)
    free = ~fixed & (deg > 0)
    for _ in range(iters):
        acc = np.zeros_like(W)
        np.add.at(acc, e[:, 0], W[e[:, 1]])
        np.add.at(acc, e[:, 1], W[e[:, 0]])
        avg = acc / np.maximum(deg, 1)[:, None]
        W[free] = (1 - k) * W[free] + k * avg[free]
    return W


def skin(ob, arm, L, fig):
    """Bone heat, then the figure's region rules (see the module doc). Returns a small report."""
    for o in bpy.data.objects:
        o.select_set(False)
    ob.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    P = verts(ob)
    W, names = _weights(ob)
    deform = [b.name for b in arm.data.bones if b.use_deform]
    for n in deform:
        if n not in names:
            names.append(n)
            W = np.concatenate([W, np.zeros((len(W), 1))], 1)
    col = {n: i for i, n in enumerate(names)}
    mw = arm.matrix_world
    seg = {b.name: (np.array(mw @ b.head_local), np.array(mw @ b.tail_local)) for b in arm.data.bones if b.use_deform}
    report = {}
    # unweighted (bone heat failed on that island): nearest bone
    empty = W.sum(1) < 1e-4
    if empty.any():
        idx, _ = _nearest(P[empty], [seg[n] for n in deform])
        W[np.nonzero(empty)[0], [col[deform[i]] for i in idx]] = 1.0
    report['filled'] = int(empty.sum())
    arm_cols = [col[n] for n in names if n.rsplit('_', 1)[0] in ARM_PARTS]
    tail_cols = [col[n] for n in names if n.startswith('tail_')]
    x, y, z = P.T
    # arm weights only inside the arm tube; above it they go to the head (hair), below it to the chest (side
    # locks, coat panels)
    band = fig.get('arm_band', 0.05) + 0.02
    out_tube = np.abs(z - L['arm_z']) > band
    moved = W[:, arm_cols].sum(1) * out_tube
    to_head = out_tube & (z > L['arm_z'])
    W[:, col['head']] += moved * to_head
    W[:, col['chest']] += moved * (out_tube & ~to_head)
    W[np.ix_(out_tube, arm_cols)] = 0.0
    report['arm_moved'] = int((moved > 0).sum())
    # tail: tail bones only in the tail region, and the region only on tail bones (+ a little hips at the root)
    if tail_cols:
        tsel = region(P, fig['tail'])
        W[np.ix_(~tsel, tail_cols)] = 0.0
        tn = [n for n in names if n.startswith('tail_')]
        idx, d = _nearest(P[tsel], [seg[n] for n in tn])
        Wt = np.zeros((tsel.sum(), len(names)))
        # blend toward the neighbouring tail bone near each joint (smooth bend), hips at the root
        for k, n in enumerate(tn):
            a, b = seg[n]
            ab = b - a
            t = np.clip(((P[tsel] - a) @ ab) / max(ab @ ab, 1e-12), 0, 1)
            own = idx == k
            Wt[own, col[n]] = 1.0
            if k > 0:
                near = own & (t < 0.25)
                f = 0.5 * (1 - t[near] / 0.25)
                Wt[near, col[tn[k - 1]]] += f
                Wt[near, col[n]] -= f
            else:
                near = own & (t < 0.2)
                f = 0.6 * (1 - t[near] / 0.2)
                Wt[near, col['hips']] += f
                Wt[near, col[n]] -= f
        W[tsel] = Wt
        report['tail'] = int(tsel.sum())
    # hair chains: their bones only inside their region; inside it only the chain and its parent (no arm weights)
    for ch in fig.get('chains', []):
        cc = [col[n] for n in names if n.startswith(ch['name'] + '_')]
        sel = region(P, ch)
        W[np.ix_(~sel, cc)] = 0.0
        keep = cc + [col[ch.get('parent', 'head')]]
        drop = [j for j in range(len(names)) if j not in keep]
        lost = W[np.ix_(sel, drop)].sum(1)
        W[np.ix_(sel, drop)] = 0.0
        W[sel, col[ch.get('parent', 'head')]] += lost
        report[f'chain_{ch["name"]}'] = int(sel.sum())
    # props: wholly on their hand
    for spec in fig.get('props', []):
        sel = region(P, spec)
        W[sel] = 0.0
        W[sel, col[spec['bone']]] = 1.0
        report[f'prop_{spec["bone"]}'] = int(sel.sum())
    # extra hard rules: {'bone': name, region...} (e.g. a drum on the hips)
    for spec in fig.get('pin', []):
        sel = region(P, spec)
        W[sel] = 0.0
        W[sel, col[spec['bone']]] = 1.0
        report[f'pin_{spec["bone"]}'] = int(sel.sum())
    empty = W.sum(1) < 1e-4
    if empty.any():
        idx, _ = _nearest(P[empty], [seg[n] for n in deform])
        W[np.nonzero(empty)[0], [col[deform[i]] for i in idx]] = 1.0
    # soften the cuts the region rules made (arm tube, tail edge): a few Laplacian passes over the mesh edges,
    # props and pinned parts held fixed so they stay rigid
    fixed = np.zeros(len(P), bool)
    for spec in fig.get('props', []) + fig.get('pin', []):
        fixed |= region(P, spec)
    W = smooth_weights(ob, W, fixed, iters=fig.get('smooth', 4))
    _write(ob, W, names)
    dom = np.argmax(W, 1)
    report['dominant'] = {n: int((dom == col[n]).sum()) for n in names if (dom == col[n]).any()}
    return report
