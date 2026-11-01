"""A humanoid enemy rig fitted from per-enemy landmarks, for the batch-2 Tripo website enemies whose automatic fit
went wrong (docs/art/tripo/enemy-rigs.md).

tripolib/autorig.py assumes a T-pose: it takes the widest slice of the figure between 41 and 60 % of its height as a
horizontal arm line. The batch-2 enemies stand in an A-pose (arms 35-70 degrees below the horizontal), so that line
ran through their heads, pauldrons, banners and bellies: the bone-heat weights put the Orc's and the Oni's hanging
arms on the head bone, the Daimyo's on the thigh bones, the Colossus' and the Titan's shoulders and upper arms on the
head, and left hand and forearm bones with no vertices at all. Whatever the clips did, the arms did not move.

Here every joint comes from the enemy's profile (ENEMIES in tools/tripo/rerig_tripo_enemy.py, read off its front,
side and top views in the 1 m frame with tools/tripo/landmark_views.py): the arms follow the arm itself (shoulder,
elbow, wrist, fingertip points, so an A-pose arm gets A-pose bones), the legs their own columns, an optional tail and
banner get bone chains. Same bone names as before (root, hips, spine, chest, neck, head, shoulder / upper_arm /
forearm / hand_L / R, thigh / shin / foot / toe_L / R), so the head and back slots of src/models/glbEnemy.js (event
hats, capes) keep their bones, now on the head and chest alone.

Weights are geometric, not bone heat (the A-pose arms sit close to the bodies, and heat bled them into the torso):
  * torso: hips / spine / chest / neck / head by height, with soft ramps at each joint (the neck bone is the pivot
    the head turns about);
  * arms: the vertices inside an elliptical tube around the arm (seen from the front within each segment's radius,
    within `ry` of its depth, nothing nearer the middle than `minx`), weighted along the chain with blends across the
    elbow and wrist and into the clavicle at the root;
  * legs: below the crotch by side, along thigh / shin / foot with a blend into the hips; a `skirt` band (a coat,
    an armour skirt, rags) keeps most of its weight on the hips so it never tears between the legs;
  * a tail or banner: a region on its own chain;
  * props (a club) wholly on their hand, pinned parts wholly on one bone;
then a few Laplacian passes over the welded mesh soften the cuts (props and pins held), at most four influences."""
import math

import bpy
import numpy as np
from mathutils import Vector

from . import rerig

ARM_BONES = ('shoulder', 'upper_arm', 'forearm', 'hand')


def mirror(p):
    return (-p[0], p[1], p[2])


def arm_points(fig, side):
    """[S, E, W, T]: shoulder joint, elbow, wrist, fingertip of one arm (the right one mirrors the left unless the
    profile gives its own)."""
    arms = fig['arms']
    if side in arms:
        return [tuple(p) for p in arms[side]['pts']]
    other = 'L' if side == 'R' else 'R'
    return [mirror(p) for p in arms[other]['pts']]


def leg_points(fig, side):
    """[hip joint, knee, ankle, toe] of one leg: straight down over the middle of its foot (measured by
    rerig_tripo_enemy.fit: legs.xs / ys / toes)."""
    k = 1 if side == 'L' else -1
    lg = fig['legs']
    fx = lg['xs'][side] if 'xs' in lg else k * lg['x']
    fy = lg['ys'][side] if 'ys' in lg else lg.get('y', fig['cy'])
    toe = lg['toes'][side] if 'toes' in lg else fy - 0.08
    hz = fig['hip_z']
    return [(fx, fy, hz - 0.01), (fx, fy, lg['knee_z']), (fx, fy, lg['ankle_z']), (fx, toe, 0.02)]


def build_armature(fig, top, name='rig'):
    data = bpy.data.armatures.new(name)
    arm = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    eb = data.edit_bones
    cx, cy, hz, nz = fig.get('cx', 0.0), fig['cy'], fig['hip_z'], fig['neck_z']
    cz = fig.get('chest_z', (hz + nz) / 2)

    def bone(n, h, t, parent=None, deform=True):
        b = eb.new(n)
        b.head, b.tail = Vector(h), Vector(t)
        b.use_deform = deform
        if parent:
            b.parent = eb[parent]
        return b

    # the root on the floor between the feet: the pivot a fall topples over
    fy = sum(leg_points(fig, s)[2][1] for s in 'LR') / 2
    bone('root', (cx, fy, 0), (cx, fy, 0.08), deform=False)
    bone('hips', (cx, cy, hz), (cx, cy, hz + 0.04), 'root')
    bone('spine', (cx, cy, hz + 0.04), (cx, cy, cz), 'hips')
    bone('chest', (cx, cy, cz), (cx, cy, nz - 0.02), 'spine')
    bone('neck', (cx, cy, nz - 0.02), (cx, cy, nz + 0.02), 'chest')
    bone('head', (cx, cy, nz + 0.02), (cx, cy, top), 'neck')
    for s, k in (('L', 1), ('R', -1)):
        S, E, W, T = arm_points(fig, s)
        bone(f'shoulder_{s}', (cx + k * 0.03, S[1], S[2]), S, 'chest')
        bone(f'upper_arm_{s}', S, E, f'shoulder_{s}')
        bone(f'forearm_{s}', E, W, f'upper_arm_{s}')
        bone(f'hand_{s}', W, T, f'forearm_{s}')
        H, K, A, F = leg_points(fig, s)
        bone(f'thigh_{s}', H, K, 'hips')
        bone(f'shin_{s}', K, A, f'thigh_{s}')
        bone(f'foot_{s}', A, ((A[0] + F[0]) / 2, (A[1] + F[1]) / 2, max(0.02, A[2] * 0.5)), f'shin_{s}')
        bone(f'toe_{s}', ((A[0] + F[0]) / 2, (A[1] + F[1]) / 2, max(0.02, A[2] * 0.5)), F, f'foot_{s}')
    for ch in fig.get('chains', []):
        pts = ch['points']
        parent = ch.get('parent', 'hips')
        for i in range(len(pts) - 1):
            n = f'{ch["name"]}_{i + 1}' if len(pts) > 2 else ch['name']
            bone(n, pts[i], pts[i + 1], parent)
            parent = n
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm


def chain_names(ch):
    n = len(ch['points']) - 1
    return [f'{ch["name"]}_{i + 1}' for i in range(n)] if n > 1 else [ch['name']]


def _seg_project(P, a, b):
    a, b = np.asarray(a, float), np.asarray(b, float)
    ab = b - a
    l2 = max(ab @ ab, 1e-12)
    t = ((P - a) @ ab) / l2
    tc = np.clip(t, 0, 1)
    d = np.linalg.norm(P - (a + tc[:, None] * ab), axis=1)
    return t, tc, d, math.sqrt(l2)


def chain_distance(P, pts, radii):
    """Per vertex: the smallest distance to the chain measured against each segment's radius (d / r), the segment
    and its parameter."""
    best = np.full(len(P), np.inf)
    seg = np.zeros(len(P), int)
    tt = np.zeros(len(P))
    for k in range(len(pts) - 1):
        t, tc, d, _ = _seg_project(P, pts[k], pts[k + 1])
        q = d / radii[min(k, len(radii) - 1)]
        m = q < best
        best[m] = q[m]
        seg[m] = k
        tt[m] = t[m]
    return best, seg, tt


def arm_select(P, pts, spec, side, exclude=None, depth=True):
    """The vertices of one arm: seen from the front (x, z) within the segment radii of the arm line, beyond `minx`
    (nothing nearer the middle is arm), outside the `minus` boxes and `exclude`, and (depth=True) within `ry` of the
    arm line's own depth. A-pose arms stand clear of the body in the front view, while a sleeve or a fist is often
    deeper than it is wide, so the tube is elliptical: radius r across, ry front to back."""
    k = 1 if side == 'L' else -1
    Q = P.copy()
    Q[:, 1] = 0.0
    pts2 = [(p[0], 0.0, p[2]) for p in pts]
    q, seg, t = chain_distance(Q, pts2, spec.get('r', (0.06, 0.055, 0.065)))
    sel = (q <= 1.0) & (k * P[:, 0] > spec.get('minx', 0.0))
    for lo, hi in spec.get('minus', []):
        sel &= ~rerig._in_box(P, lo, hi)
    if exclude is not None:
        sel &= ~exclude
    if depth:
        ys = np.array([p[1] for p in pts])
        tc = np.clip(t, 0, 1)
        yline = ys[seg] + (ys[np.minimum(seg + 1, len(ys) - 1)] - ys[seg]) * tc
        sel &= np.abs(P[:, 1] - yline) < spec.get('ry', 0.16)
    return sel


def chain_weights(P, pts, cols, ncol, parent_col=None, blend=0.035, root_blend=0.04):
    """(n, ncol) weights along a polyline chain: each vertex on the segment it lies nearest to, blended half and half
    across each joint over `blend` (metres, 1 m frame), and into `parent_col` over `root_blend` at the chain's root."""
    W = np.zeros((len(P), ncol))
    best = np.full(len(P), np.inf)
    seg = np.zeros(len(P), int)
    tt = np.zeros(len(P))
    lens = []
    for k in range(len(pts) - 1):
        t, tc, d, l = _seg_project(P, pts[k], pts[k + 1])
        lens.append(l)
        m = d < best
        best[m] = d[m]
        seg[m] = k
        tt[m] = tc[m]
    for k in range(len(pts) - 1):
        own = seg == k
        l = lens[k]
        s_from = tt * l               # distance from the segment's start
        s_to = (1 - tt) * l           # to its end
        W[own, cols[k]] = 1.0
        if k > 0:
            near = own & (s_from < blend)
            f = 0.5 * (1 - s_from[near] / blend)
            W[near, cols[k - 1]] += f
            W[near, cols[k]] -= f
        elif parent_col is not None and root_blend > 0:
            near = own & (s_from < root_blend)
            f = 0.5 * (1 - s_from[near] / root_blend)
            W[near, parent_col] += f
            W[near, cols[k]] -= f
        if k < len(pts) - 2:
            near = own & (s_to < blend)
            f = 0.5 * (1 - s_to[near] / blend)
            W[near, cols[k + 1]] += f
            W[near, cols[k]] -= f
    return W


def _ramp(z, a, b):
    return np.clip((z - a) / max(b - a, 1e-6), 0, 1)


def torso_weights(P, fig, col, ncol, w=0.03):
    """hips / spine / chest / neck / head by height, soft ramps of `w` at each joint."""
    z = P[:, 2]
    hz, nz = fig['hip_z'], fig['neck_z']
    cz = fig.get('chest_z', (hz + nz) / 2)
    hw = fig.get('head_blend', w)
    up_spine = _ramp(z, hz + 0.04 - w, hz + 0.04 + w)
    up_chest = _ramp(z, cz - w, cz + w)
    up_head = _ramp(z, nz - hw, nz + hw)
    if 'head_rx' in fig:
        # shoulder plates and collars as high as the jaw stay on the chest: beside the head (|x| > head_rx) the head
        # starts only head_dz above the neck
        side = np.abs(P[:, 0] - fig.get('cx', 0.0)) > fig['head_rx']
        dz = fig.get('head_dz', 0.05)
        up_head[side] *= _ramp(z[side], nz + dz - 0.02, nz + dz)
    W = np.zeros((len(P), ncol))
    W[:, col['hips']] = 1 - up_spine
    W[:, col['spine']] = up_spine * (1 - up_chest)
    W[:, col['chest']] = up_chest * (1 - up_head)
    # the neck is the pivot the head turns about (no vertices of its own), the head everything above it
    W[:, col['head']] = up_head
    return W


def skin(ob, arm, fig):
    """Geometric weights (see the module doc). Returns a small report."""
    P = rerig.verts(ob)
    x, y, z = P.T
    names = [b.name for b in arm.data.bones if b.use_deform]
    col = {n: i for i, n in enumerate(names)}
    nc = len(names)
    W = torso_weights(P, fig, col, nc)
    report = {}
    # legs: below the crotch, by side, along the leg chain (blended into the hips at the top)
    lg = fig['legs']
    crotch = lg.get('top_z', fig['hip_z'])
    cx = fig.get('cx', 0.0)
    for s, k in (('L', 1), ('R', -1)):
        pts = leg_points(fig, s)
        sel = (z < crotch) & (k * (x - cx) > lg.get('gap', 0.0)) & (np.abs(x - cx) < lg.get('max_x', 1.0))
        cols = [col[f'{p}_{s}'] for p in ('thigh', 'shin', 'foot')]
        Wl = chain_weights(P[sel], pts[:3] + [pts[3]], cols + [col[f'toe_{s}']], nc, col['hips'],
                           blend=lg.get('blend', 0.03), root_blend=lg.get('root_blend', 0.05))
        # near the crotch the thigh shares with the hips
        top = _ramp(z[sel], crotch - lg.get('fade', 0.05), crotch)
        Wl = Wl * (1 - top)[:, None]
        Wl[:, col['hips']] += top
        sk = fig.get('skirt')
        if sk:
            band = (z[sel] > sk['z'][0]) & (z[sel] < sk['z'][1])
            if 'r' in sk:
                # only the outer shell: far from the leg's own column
                d = np.hypot(x[sel] - pts[0][0], y[sel] - pts[0][1])
                band &= d > sk['r']
            keep = sk.get('hips', 0.7)
            Wl[band] *= (1 - keep)
            Wl[band, col['hips']] += keep
        W[sel] = Wl
        report[f'leg_{s}'] = int(sel.sum())
    # arms: inside the capsule chain, beyond the torso
    for s, k in (('L', 1), ('R', -1)):
        S, E, Wr, T = arm_points(fig, s)
        spec = fig['arms'][s]
        sel = arm_select(P, [S, E, Wr, T], spec, s)
        cols = [col[f'{p}_{s}'] for p in ('upper_arm', 'forearm', 'hand')]
        Wa = chain_weights(P[sel], [S, E, Wr, T], cols, nc, col[f'shoulder_{s}'],
                           blend=spec.get('blend', 0.035), root_blend=spec.get('root_blend', 0.05))
        # the clavicle shares with the chest at the root
        sh = Wa[:, col[f'shoulder_{s}']]
        Wa[:, col['chest']] += sh * 0.4
        Wa[:, col[f'shoulder_{s}']] = sh * 0.6
        W[sel] = Wa
        report[f'arm_{s}'] = int(sel.sum())
    # bone chains (a tail, a banner): their region on their own chain
    fixed = np.zeros(len(P), bool)
    for ch in fig.get('chains', []):
        sel = rerig.region(P, ch)
        cn = chain_names(ch)
        cols = [col[n] for n in cn]
        parent = col.get(ch.get('parent', 'hips'))
        if ch.get('rigid'):
            Wc = np.zeros((sel.sum(), nc))
            Wc[:, cols[0]] = 1.0
            fixed |= sel
        else:
            Wc = chain_weights(P[sel], ch['points'], cols, nc, parent, blend=ch.get('blend', 0.05),
                               root_blend=ch.get('root_blend', 0.06))
        W[sel] = Wc
        report[f'chain_{ch["name"]}'] = int(sel.sum())
    # props wholly on their hand; pinned parts wholly on one bone
    for spec in fig.get('props', []) + fig.get('pin', []):
        sel = rerig.region(P, spec)
        W[sel] = 0.0
        W[sel, col[spec['bone']]] = 1.0
        fixed |= sel
        report[f'pin_{spec["bone"]}'] = report.get(f'pin_{spec["bone"]}', 0) + int(sel.sum())
    empty = W.sum(1) < 1e-4
    W[empty, col['chest']] = 1.0
    W = W / np.maximum(W.sum(1, keepdims=True), 1e-9)
    W = rerig.smooth_weights(ob, W, fixed, iters=fig.get('smooth', 3), k=0.5)
    for g in list(ob.vertex_groups):
        ob.vertex_groups.remove(g)
    rerig._write(ob, W, names)
    mod = ob.modifiers.new('rig', 'ARMATURE')
    mod.object = arm
    ob.parent = arm
    dom = np.argmax(W, 1)
    report['dominant'] = {n: int((dom == col[n]).sum()) for n in names if (dom == col[n]).any()}
    return report
