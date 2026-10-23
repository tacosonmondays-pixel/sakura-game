"""Rig rollout steps 2-3 (VERDICT §8.2-8.3): shared Blender helpers for Hikari / Hana / Ruri.
Generalised from build_noa.py (Noa, step 1): any face bone, any root-motion bone,
any wrist lock list, a head sphere measured from the mesh (Hikari has no head_end bone).
Imports rigtest_lib.py (slotted-action helpers)."""
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rigtest_lib as L  # noqa: E402

FPS_SRC = 30
FPS_OUT = 20
CAM48 = Vector((0.0, -math.cos(math.radians(48)), math.sin(math.radians(48))))  # toward the 48 deg battle camera


def rotq(Mx):
    m = Mx.to_3x3()
    m.normalize()
    return m.to_quaternion()


def g2b(v):
    return Vector((float(v[0]), -float(v[2]), float(v[1])))


# ------------------------------------------------------------------ retarget (as noa/build/build_noa.py)
def retarget_clip(tgt, glb, out_name, bone_map, root_tgt='hips'):
    """World-space rest-delta retarget of a Meshy-library clip GLB onto `tgt` (one key per source frame).
    bone_map: Meshy name -> target name. The root-motion bone gets the source hips' translation x k_leg."""
    before = set(bpy.data.objects)
    acts_before = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=glb)
    new = [o for o in bpy.data.objects if o not in before]
    src = [o for o in new if o.type == 'ARMATURE'][0]
    for o in new:
        if o is not src:
            bpy.data.objects.remove(o)
    act = [a for a in bpy.data.actions if a not in acts_before][0]
    for a in [a for a in bpy.data.actions if a not in acts_before and a is not act]:
        bpy.data.actions.remove(a)
    L.assign(src, act)
    sc = bpy.context.scene

    def rest_w(arm, n):
        return arm.matrix_world @ arm.data.bones[n].matrix_local
    order = []

    def walk(b):
        order.append(b.name)
        for c in b.children:
            walk(c)
    for b in tgt.data.bones:
        if b.parent is None:
            walk(b)
    R = {n: tgt.data.bones[n].matrix_local.copy() for n in order}
    inv = {v: k for k, v in bone_map.items()}
    k_leg = ((rest_w(tgt, 'thigh_L').translation.z - rest_w(tgt, 'foot_L').translation.z)
             / (rest_w(src, 'LeftUpLeg').translation.z - rest_w(src, 'LeftFoot').translation.z))
    src_root_rest = rest_w(src, inv[root_tgt]).translation.copy()
    f0, f1 = (int(round(x)) for x in L.frame_range(act))
    out = bpy.data.actions.new(out_name)
    out.use_fake_user = True
    tgt.animation_data_create()
    tgt.animation_data.action = out
    for pb in tgt.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    for f in range(f0, f1 + 1):
        sc.frame_set(f)
        Mx = {}
        for n in order:
            p = tgt.data.bones[n].parent
            base = R[n].copy() if p is None else Mx[p.name] @ (R[p.name].inverted() @ R[n])
            Mt = base
            if n in inv:
                s = inv[n]
                D = rotq(src.matrix_world @ src.pose.bones[s].matrix) @ rotq(rest_w(src, s)).inverted()
                Mt = (D @ rotq(R[n])).to_matrix().to_4x4()
                Mt.translation = base.translation
                if n == root_tgt:
                    dp = (src.matrix_world @ src.pose.bones[s].matrix).translation - src_root_rest
                    Mt.translation = base.translation + dp * k_leg
            Mx[n] = Mt
            if n in inv:
                basis = R[n].inverted() @ Mt if p is None else (R[p.name].inverted() @ R[n]).inverted() @ Mx[p.name].inverted() @ Mt
                pb = tgt.pose.bones[n]
                pb.rotation_quaternion = basis.to_quaternion()
                pb.keyframe_insert('rotation_quaternion', frame=f - f0, group=n)
                if n == root_tgt:
                    pb.location = basis.translation
                    pb.keyframe_insert('location', frame=f - f0, group=n)
    tgt.animation_data.action = None
    for pb in tgt.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
    bpy.data.objects.remove(src)
    bpy.data.actions.remove(act)
    return out, k_leg


# ------------------------------------------------------------------ per-key helpers
def key_index(act, bone):
    cs = L.bone_curves(act, bone, 'rotation_quaternion')
    return cs, {int(round(kp.co[0])): i for i, kp in enumerate(cs[0].keyframe_points)}


def set_key_quat(cs, i, q):
    for k in range(4):
        kp = cs[k].keyframe_points[i]
        kp.co[1] = q[k]
        kp.handle_left[1] = q[k]
        kp.handle_right[1] = q[k]


def const_quat(act, arm, bone, q):
    """Every key of a bone's rotation = q (a track is made when the clip has none)."""
    L.ensure_quat_track(act, arm, bone)
    L.remap_quat(act, arm, bone, lambda _q, q=q: q.copy())


def mean_local_quat(act, bone):
    """The normalised mean of a bone's local rotation keys in an action (None when it has no track)."""
    cs = L.bone_curves(act, bone, 'rotation_quaternion')
    if not cs:
        return None
    n = len(cs[0].keyframe_points)
    qs = [Quaternion([cs[k].keyframe_points[i].co[1] for k in range(4)]) for i in range(n)]
    ref = qs[0]
    acc = np.zeros(4)
    for q in qs:  # (numpy: mathutils' Vector.normalize leaves a 4D vector's 4th component untouched)
        v = np.array(q[:]) if q.dot(ref) >= 0 else -np.array(q[:])
        acc += v
    acc /= np.linalg.norm(acc)
    return Quaternion(acc.tolist())


# ------------------------------------------------------------------ face / head
def world_pitch(arm, act, bone):
    """Per integer frame: the face bone's world pitch in degrees (negative = chin up) away from its rest."""
    S, _ = L.sample_world(arm, act, [bone])
    Rh = rotq(arm.matrix_world @ arm.data.bones[bone].matrix_local)
    return np.array([math.degrees((rotq(mh) @ Rh.inverted()).to_euler('XYZ').x) for mh in S[bone]])


def face_angle(arm, act, bone):
    """Per frame: angle (deg) between her face's forward direction and the direction to the 48 deg camera."""
    S, _ = L.sample_world(arm, act, [bone])
    Rh = rotq(arm.matrix_world @ arm.data.bones[bone].matrix_local)
    out = []
    for mh in S[bone]:
        f = (rotq(mh) @ Rh.inverted()) @ Vector((0.0, -1.0, 0.0))
        out.append(math.degrees(f.angle(CAM48)))
    return np.array(out)


def chin_quat(arm, bone, pitch_deg):
    return L.chin_quat(arm, bone, pitch_deg)


def add_pitch(act, arm, shares, sm, f0):
    """Adds the per-frame chin-up `sm` (deg, positive = more chin-up) spread over `shares`."""
    for bone, share in shares:
        L.ensure_quat_track(act, arm, bone)
        cs, idx = key_index(act, bone)
        for j, a in enumerate(sm):
            f = f0 + j
            if abs(a) < 0.05 or f not in idx:
                continue
            i = idx[f]
            q = Quaternion([cs[k].keyframe_points[i].co[1] for k in range(4)])
            q2 = L.chin_quat(arm, bone, -a * share) @ q
            q2.normalize()
            if q2.dot(q) < 0:
                q2.negate()
            set_key_quat(cs, i, q2)
        for c in cs:
            c.update()


def face_guard(arm, act, bone, limit, shares, w=4):
    """Wherever the face bone's world pitch rises above `limit` (the chin drops: the face hides under the
    bangs from the 48 deg camera), add just enough chin-up there, eased over +-w frames, over `shares`."""
    p = world_pitch(arm, act, bone)
    f0 = int(round(L.frame_range(act)[0]))
    need = np.maximum(0.0, p - limit)
    if need.max() <= 0.05:
        return dict(max_deg=0.0, frames=0)
    mx = np.array([need[max(0, i - w):i + w + 1].max() for i in range(len(need))])
    sm = np.array([mx[max(0, i - w):i + w + 1].mean() for i in range(len(mx))]) * 1.08
    add_pitch(act, arm, shares, sm, f0)
    return dict(max_deg=round(float(sm.max()), 1), frames=int((sm > 0.05).sum()))


def post_pass(act, arm, damp, wrists, face_bone, target, max_chin, shares):
    """1. damp the head / neck (slerp toward rest; adult mocap swings a 44 % head too far)
    2. wrists locked straight (held props)
    3. chin-up: whatever brings the clip's mean world face pitch to `target` (the shipped idle's), between 0
       and max_chin, spread over `shares` (she stands taller rather than craning)."""
    info = {}
    for bone, d in damp.items():
        L.ensure_quat_track(act, arm, bone)
        L.remap_quat(act, arm, bone, lambda q, d=d: Quaternion().slerp(q, d))
        info[bone + '_damp'] = d
    for wr in wrists:
        L.ensure_quat_track(act, arm, wr)
        L.remap_quat(act, arm, wr, lambda q: Quaternion())
    info['wrists'] = list(wrists)
    mean0 = float(world_pitch(arm, act, face_bone).mean())
    add = max(-max_chin, min(0.0, target - mean0))
    for bone, share in shares:
        L.ensure_quat_track(act, arm, bone)
        C = L.chin_quat(arm, bone, add * share)
        L.remap_quat(act, arm, bone, lambda q, C=C: C @ q)
    info['pitch_before_chin'] = round(mean0, 2)
    info['chin_added_deg'] = round(add, 2)
    return info


def chain_pitch(arm, act, bones):
    """{bone: mean world pitch in degrees (negative = leaning back / chin up) away from its rest} over a clip."""
    S, _ = L.sample_world(arm, act, bones)
    out = {}
    for b in bones:
        Rb = rotq(arm.matrix_world @ arm.data.bones[b].matrix_local)
        out[b] = float(np.mean([math.degrees((rotq(m) @ Rb.inverted()).to_euler('XYZ').x) for m in S[b]]))
    return out


def posture(arm, act, bones, targets, max_deg=30.0):
    """The library mocap stands with an adult slouch (the 338 idle: her lower spine ~19 deg forward, the chest and
    neck tipped with it). The face bone's world pitch alone (post_pass) does not see it, but the 48 deg camera does:
    her torso foreshortens, her head comes forward and down, and a face skinned partly to the neck tips with it.
    Each bone in `bones` (parent first) gets a constant world-axis pitch that brings its mean world pitch over the
    clip to targets[bone] (her shipped clip's), at most max_deg: she stands like her shipped chibi while all of the
    clip's own motion stays. Returns {bone: [mean before, deg added]}."""
    out = {}
    for b in bones:
        if b not in targets:
            continue
        m = chain_pitch(arm, act, [b])[b]
        d = max(-max_deg, min(max_deg, targets[b] - m))
        if abs(d) < 0.05:
            continue
        L.ensure_quat_track(act, arm, b)
        C = L.chin_quat(arm, b, d)
        L.remap_quat(act, arm, b, lambda q, C=C: C @ q)
        out[b] = [round(m, 2), round(d, 2)]
    return out


def world_yaw(arm, act, bone):
    """Per frame: the bone's world yaw (deg) away from its rest, + = toward her right (as seen from the front)."""
    S, _ = L.sample_world(arm, act, [bone])
    R0 = rotq(arm.matrix_world @ arm.data.bones[bone].matrix_local)
    out = []
    for m in S[bone]:
        f = (rotq(m) @ R0.inverted()) @ Vector((0.0, -1.0, 0.0))
        out.append(math.degrees(math.atan2(-f.x, -f.y)))
    return np.array(out)


def turn_clip(arm, act, root, delta_deg):
    """Turns the whole clip about the vertical axis through the root-motion bone by delta_deg of yaw (same sign
    as world_yaw). The library's 338 idle stands ~13 deg turned to her right (her face's mean yaw; the shipped
    idle -5): at the battle camera a girl facing a monster to her side then shows only her hair (first battle
    capture), so every clip's mean face yaw is brought back to her shipped idle's."""
    a = -math.radians(delta_deg)  # world_yaw = -angle about +Z
    R = arm.data.bones[root].matrix_local.to_3x3()
    R.normalize()
    Rq = R.to_quaternion()
    Q = Rq.inverted() @ Quaternion(Vector((0, 0, 1)), a) @ Rq
    L.ensure_quat_track(act, arm, root)
    L.remap_quat(act, arm, root, lambda q, Q=Q: Q @ q)
    # the root's travel turns with it (armature space -> the same turn about the vertical)
    cs = L.bone_curves(act, root, 'location')
    if cs:
        Rz = Quaternion(Vector((0, 0, 1)), a)
        n = len(cs[0].keyframe_points)
        loc = [Vector([cs[k].keyframe_points[i].co[1] for k in range(3)]) for i in range(n)]
        v0 = R @ loc[0]
        for i in range(n):
            v = R @ loc[i]
            v2 = R.inverted() @ (v0 + Rz @ (v - v0))
            for c in range(3):
                kp = cs[c].keyframe_points[i]
                kp.co[1] = v2[c]
                kp.handle_left[1] = v2[c]
                kp.handle_right[1] = v2[c]
        for c in cs:
            c.update()


def damp_bones(arm, act, bones, k):
    for b in bones:
        if L.bone_curves(act, b, 'rotation_quaternion'):
            L.remap_quat(act, arm, b, lambda q, k=k: Quaternion().slerp(q, k))


def head_sphere(arm, body, bones, neck_bone, factor=0.95):
    """The head as a sphere, measured on the rest mesh: vertices mostly weighted to the head bones and above
    the neck joint. Returns (centre in the face bone's rest frame -> callable per pose, radius, info)."""
    me = body.data
    gi = {g.index: g.name for g in body.vertex_groups}
    Mb = body.matrix_world
    nz = (arm.matrix_world @ arm.data.bones[neck_bone].head_local).z
    pts = []
    for v in me.vertices:
        w = sum(g.weight for g in v.groups if gi.get(g.group) in bones)
        if w >= 0.5:
            p = Mb @ v.co
            if p.z > nz + 0.01:
                pts.append(p[:])
    P = np.array(pts)
    lo, hi = P.min(0), P.max(0)
    c = Vector(((lo + hi) / 2).tolist())
    c.x = 0.0
    r = 0.5 * max(hi[0] - lo[0], hi[2] - lo[2]) * factor
    return c, float(r), dict(verts=len(P), lo=[round(float(x), 4) for x in lo], hi=[round(float(x), 4) for x in hi], r=round(float(r), 4))


def head_clearance(act, arm, face_bone, c_rest, R, sides=('L', 'R'), max_deg=50.0, hand='hand'):
    """Where a wrist comes inside the head sphere (centre c_rest carried by the face bone), the upper arm is
    abducted in the frontal plane just enough to clear it, eased over +-4 frames. Returns {side: max deg}."""
    sc = bpy.context.scene
    L.assign(arm, act)
    f0, f1 = (int(round(x)) for x in L.frame_range(act))
    frames = list(range(f0, f1 + 1))
    Rb = arm.data.bones[face_bone].matrix_local
    local_c = Rb.inverted() @ (arm.matrix_world.inverted() @ c_rest)
    res = {}
    for side, sgn in (('L', 1.0), ('R', -1.0)):
        if side not in sides:
            continue
        ua, hd = f'upper_arm_{side}', f'{hand}_{side}'
        th = []
        for f in frames:
            sc.frame_set(f)
            pb = arm.pose.bones
            c = pb[face_bone].matrix @ local_c
            p = pb[ua].head
            v = pb[hd].head - p
            need = 0.0
            if (p + v - c).length < R:
                need = max_deg
                for k in range(1, int(max_deg / 1.5) + 1):
                    q = Quaternion(Vector((0, 1, 0)), math.radians(1.5 * k) * sgn)
                    if (p + q @ v - c).length >= R:
                        need = 1.5 * k
                        break
            th.append(need)
        th = np.array(th)
        if th.max() <= 0:
            res[side] = 0.0
            continue
        w = 4
        mx = np.array([th[max(0, i - w):i + w + 1].max() for i in range(len(th))])
        sm = np.array([mx[max(0, i - w):i + w + 1].mean() for i in range(len(mx))])
        L.ensure_quat_track(act, arm, ua)
        cs = L.bone_curves(act, ua, 'rotation_quaternion')
        idx = {int(round(kp.co[0])): i for i, kp in enumerate(cs[0].keyframe_points)}
        new_q = {}
        for f, a in zip(frames, sm):
            if a < 0.3 or f not in idx:
                continue
            sc.frame_set(f)
            pb = arm.pose.bones[ua]
            Mx = pb.matrix.copy()
            piv = Mx.translation.copy()
            Rw = Quaternion(Vector((0, 1, 0)), math.radians(a) * sgn).to_matrix().to_4x4()
            pb.matrix = Matrix.Translation(piv) @ Rw @ Matrix.Translation(-piv) @ Mx
            bpy.context.view_layer.update()
            new_q[idx[f]] = pb.rotation_quaternion.copy()
        for i, q in new_q.items():
            set_key_quat(cs, i, q)
        for c in cs:
            c.update()
        res[side] = round(float(sm.max()), 1)
    return res


# ------------------------------------------------------------------ hips / feet
def strip_xz(arm, act, bone, to_game):
    """The root-motion bone keeps its vertical motion and rotations; its horizontal travel is removed."""
    cs = L.bone_curves(act, bone, 'location')
    if not cs:
        return 0.0
    R = arm.data.bones[bone].matrix_local.to_3x3()
    n = len(cs[0].keyframe_points)
    loc = np.array([[cs[k].keyframe_points[i].co[1] for k in range(3)] for i in range(n)])
    A = np.array([R @ Vector(v) for v in loc])
    peak = float(np.linalg.norm((A - A[0])[:, :2], axis=1).max()) * to_game
    A[:, 0] = A[0, 0]
    A[:, 1] = A[0, 1]
    Ri = R.inverted()
    for i in range(n):
        v = Ri @ Vector(A[i])
        for c in range(3):
            kp = cs[c].keyframe_points[i]
            kp.co[1] = v[c]
            kp.handle_left[1] = v[c]
            kp.handle_right[1] = v[c]
    for c in cs:
        c.update()
    return peak


def root_height(arm, act, root):
    """Mean height (armature units) of the root-motion bone over a clip."""
    S, _ = L.sample_world(arm, act, [root])
    return float(np.mean([m.translation.z for m in S[root]]))


def stance_raise(arm, act, root, want, reach=0.99):
    """The library idles stand on bent knees (an adult's relaxed stance; the chibi's shipped clips stand straight):
    the root-motion bone rises by `want` (armature units, at most what keeps every ankle within `reach` of its
    leg's length at every frame), and pin_feet(drop=...) then keeps the feet on the ground, which straightens the
    knees. Returns the rise applied."""
    if want <= 1e-5:
        return 0.0
    names = [f'{b}_{s}' for s in 'LR' for b in ('thigh', 'shin', 'foot')]
    S, _ = L.sample_world(arm, act, names)
    lim = want
    for s in 'LR':
        for th, sh, ft in zip(S[f'thigh_{s}'], S[f'shin_{s}'], S[f'foot_{s}']):
            h, k, a = th.translation, sh.translation, ft.translation
            lr = reach * ((k - h).length + (a - k).length)
            d = h - a
            # |d + t z|^2 = lr^2 -> the largest t >= 0
            b = d.z
            disc = b * b - (d.length_squared - lr * lr)
            lim = min(lim, max(0.0, -b + math.sqrt(max(0.0, disc))))
    cs = L.bone_curves(act, root, 'location')
    if not cs or lim <= 1e-5:
        return 0.0
    R = arm.data.bones[root].matrix_local.to_3x3()
    R.normalize()
    dv = R.inverted() @ Vector((0.0, 0.0, lim))
    for c in range(3):
        for kp in cs[c].keyframe_points:
            kp.co[1] += dv[c]
            kp.handle_left[1] += dv[c]
            kp.handle_right[1] += dv[c]
        cs[c].update()
    return lim


def pin_feet(arm, act, to_game, mode='plants', lift=0.35, drop=0.0):
    """Two-bone IK on thigh + shin so the ankles hit their targets; the foot keeps its own orientation.
    'plants': each foot locked to the mean of each planted stretch (low and slow), offsets blended between;
    'stance': both ankles stay where they stand on the first frame, lifts kept at `lift` x.
    drop: the targets sit this much lower (armature units: the root rose by it in stance_raise)."""
    sc = bpy.context.scene
    L.assign(arm, act)
    f0, f1 = (int(round(x)) for x in L.frame_range(act))
    frames = list(range(f0, f1 + 1))
    pbs = arm.pose.bones
    res = {}
    plan = {}
    A = {s: [] for s in 'LR'}
    for f in frames:
        sc.frame_set(f)
        for s in 'LR':
            A[s].append(pbs[f'foot_{s}'].head.copy())
    for s in 'LR':
        P = np.array([v[:] for v in A[s]])
        T = P.copy()
        if mode == 'stance':
            z0 = P[:, 2].min()
            T[:, 0] = P[0, 0]
            T[:, 1] = P[0, 1]
            T[:, 2] = P[0, 2] + lift * (P[:, 2] - z0) - lift * (P[0, 2] - z0)
            T[:, 2] = np.maximum(T[:, 2], P[0, 2])
        else:
            z0 = P[:, 2].min()
            low = P[:, 2] < z0 + 0.012 / to_game
            v = np.r_[0, np.linalg.norm(np.diff(P[:, :2], axis=0), axis=1)] * FPS_SRC * to_game
            planted = low & (v < 0.12)
            segs = []
            i = 0
            while i < len(frames):
                if planted[i]:
                    j = i
                    while j + 1 < len(frames) and planted[j + 1]:
                        j += 1
                    if j - i >= 2:
                        segs.append((i, j))
                    i = j + 1
                else:
                    i += 1
            off = np.full((len(frames), 2), np.nan)
            for a, b in segs:
                mean = P[a:b + 1, :2].mean(0)
                off[a:b + 1] = mean - P[a:b + 1, :2]
            if segs:
                idx = np.arange(len(frames))
                ok = ~np.isnan(off[:, 0])
                for c in range(2):
                    off[:, c] = np.interp(idx, idx[ok], off[ok, c])
                T[:, :2] = P[:, :2] + off
            res[f'{s}_segments'] = len(segs)
        res[f'{s}_max_shift_mm'] = round(float(np.linalg.norm(T - P, axis=1).max()) * to_game * 1000, 1)
        T[:, 2] -= drop
        plan[s] = T
    keys = {}
    for b in ('thigh_L', 'shin_L', 'foot_L', 'thigh_R', 'shin_R', 'foot_R'):
        L.ensure_quat_track(act, arm, b)
        keys[b] = key_index(act, b)
    for j, f in enumerate(frames):
        sc.frame_set(f)
        for s in 'LR':
            th, sh, ft = pbs[f'thigh_{s}'], pbs[f'shin_{s}'], pbs[f'foot_{s}']
            Mf = ft.matrix.copy()
            hip = th.head.copy()
            knee = sh.head.copy()
            ank = ft.head.copy()
            tgt = Vector(plan[s][j])
            if (tgt - ank).length < 1e-6:
                continue
            l1 = (knee - hip).length
            l2 = (ank - knee).length
            dv = tgt - hip
            d = min(max(dv.length, abs(l1 - l2) + 1e-4), (l1 + l2) * 0.9995)
            u = dv.normalized()
            pole = (knee - hip) - u * (knee - hip).dot(u)
            if pole.length < 1e-6:
                pole = Vector((0, -1, 0)) - u * Vector((0, -1, 0)).dot(u)
            p = pole.normalized()
            cosA = max(-1.0, min(1.0, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)))
            K = hip + u * (l1 * cosA) + p * (l1 * math.sqrt(max(0.0, 1 - cosA * cosA)))
            Tc = hip + u * d
            R1 = (knee - hip).rotation_difference(K - hip).to_matrix().to_4x4()
            th.matrix = Matrix.Translation(hip) @ R1 @ Matrix.Translation(-hip) @ th.matrix
            bpy.context.view_layer.update()
            k2 = sh.head.copy()
            a2 = ft.head.copy()
            R2 = (a2 - k2).rotation_difference(Tc - k2).to_matrix().to_4x4()
            sh.matrix = Matrix.Translation(k2) @ R2 @ Matrix.Translation(-k2) @ sh.matrix
            bpy.context.view_layer.update()
            Mf2 = Mf.copy()
            Mf2.translation = ft.head.copy()
            ft.matrix = Mf2
            bpy.context.view_layer.update()
            for b in (th, sh, ft):
                cs, idx = keys[b.name]
                if f in idx:
                    set_key_quat(cs, idx[f], b.rotation_quaternion.copy())
    for b in keys:
        for c in keys[b][0]:
            c.update()
    for b in keys:
        cs, _ = keys[b]
        prev = None
        for i in range(len(cs[0].keyframe_points)):
            q = Quaternion([cs[k].keyframe_points[i].co[1] for k in range(4)])
            if prev is not None and q.dot(prev) < 0:
                q.negate()
                set_key_quat(cs, i, q)
            prev = q
        for c in cs:
            c.update()
    return res


def resample(act, fps_in=FPS_SRC, fps_out=FPS_OUT):
    """LINEAR keys, times scaled so the clip ends on a whole frame at fps_out."""
    f0, f1 = L.frame_range(act)
    n = f1 - f0
    m = max(1, round(n * fps_out / fps_in))
    s = m / n if n > 0 else 1.0
    for fc in L.fcurves(act):
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'
            kp.co[0] = f0 + (kp.co[0] - f0) * s
            kp.handle_left[0] = f0 + (kp.handle_left[0] - f0) * s
            kp.handle_right[0] = f0 + (kp.handle_right[0] - f0) * s
        fc.update()
    return dict(frames_in=int(round(n)), frames_out=int(m), duration=round(m / fps_out, 4))


# ------------------------------------------------------------------ measurements
def measure(arm, act, to_game, face_bone, c_rest, r_head, hand='hand', root='hips'):
    """Motion ranges (deg from the first frame), foot slide while planted (game mm), the closest hand to the
    head sphere (in radii), the root's rise (game mm)."""
    bones = [root, 'spine1', 'chest', 'neck', face_bone, 'upper_arm_L', 'upper_arm_R', f'{hand}_L', f'{hand}_R', 'foot_L', 'foot_R']
    bones = list(dict.fromkeys(bones))
    S, dur = L.sample_world(arm, act, bones)
    rng = {}
    for b in (root, 'spine1', 'chest', 'neck', face_bone, 'upper_arm_L', 'upper_arm_R'):
        q0 = S[b][0].to_quaternion()
        a = max(math.degrees(q0.rotation_difference(m.to_quaternion()).angle) for m in S[b])
        rng[b] = round(min(a, 360 - a), 1)
    slide = {}
    for f in ('foot_L', 'foot_R'):
        P = np.array([m.translation[:] for m in S[f]])
        low = P[:, 2] < P[:, 2].min() + 0.01 / to_game
        if low.sum() > 1:
            Q = P[low][:, :2]
            slide[f] = round(float(np.linalg.norm(Q - Q.mean(0), axis=1).max()) * to_game * 1000, 1)
    Rb = arm.data.bones[face_bone].matrix_local
    local_c = Rb.inverted() @ (arm.matrix_world.inverted() @ c_rest)
    hand_min = 1e9
    for i in range(len(S[face_bone])):
        c = S[face_bone][i] @ local_c
        for h in (f'{hand}_L', f'{hand}_R'):
            hand_min = min(hand_min, (S[h][i].translation - c).length)
    hz = np.array([m.translation[2] for m in S[root]])
    return dict(duration=round(dur, 3), range_deg=rng, foot_slide_mm=slide, hand_to_head_over_radius=round(hand_min / r_head, 2),
                root_rise_mm=round(float(hz.max() - hz[0]) * to_game * 1000, 1))


# ------------------------------------------------------------------ Workbench contact sheets (look before the browser)
def sheet_setup(cell=300, height=0.85):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sh = sc.display.shading
    sh.light = 'STUDIO'
    sh.color_type = 'TEXTURE'
    sh.show_cavity = False
    sh.show_object_outline = True
    sc.display.render_aa = '8'
    sc.render.resolution_x = cell
    sc.render.resolution_y = int(cell * 1.15)
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    sc.render.image_settings.file_format = 'PNG'
    sc.view_settings.view_transform = 'Standard'
    w = bpy.data.worlds.new('sheet') if not sc.world else sc.world
    w.color = (0.80, 0.86, 0.82)
    sc.world = w
    cams = {}
    for name, elev in (('front', 8.0), ('battle', 48.0)):
        cd = bpy.data.cameras.new(name)
        cd.type = 'ORTHO'
        cd.ortho_scale = height * 1.22
        co = bpy.data.objects.new('cam_' + name, cd)
        sc.collection.objects.link(co)
        tgt = Vector((0, 0, height * 0.5))
        d = Vector((0.0, -math.cos(math.radians(elev)), math.sin(math.radians(elev))))
        co.location = tgt + d * 4.0
        co.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
        cams[name] = co
    return cams


def render_cell(path, cam):
    sc = bpy.context.scene
    sc.camera = cam
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
