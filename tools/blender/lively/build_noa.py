"""Rollout step 1 (VERDICT §8.1): Noa variant B re-packed with the KEPT library clips only, through the §4.2
post-pass, with authored bun / ribbon spring bones and the offline flatten (PLAN §5.2 TX2) added as a second
base colour for the clean cel look.

    blender -b --factory-startup --python build_noa.py -- full|lod

Clips (from Noa's one Meshy rig R1 01a161e7-e213-71d6-9caa-b1a75a432788, paths.MESHY_CLIPS):
    idle   338 Short_Breathe_and_Look_Around
    happy  415 Happy_Sway_Standing            (between-wave mood loop)
    cheer  298 Cheer_with_Both_Hands_Up       (+ head clearance; victory falls back to it)
    hurt   178 Hit_Reaction                   (hips' horizontal travel stripped, feet pinned, cut to 1.2 s)
kept from the shipped noa.glb: attack_smash, walk, and the old idle / cheer / hurt as idle_short /
cheer_short / hurt_short (the 'Lively figures: off' fallback).

Post-pass per new clip: head x0.6 / neck x0.75; mean world head pitch to the shipped -17.3 deg; a per-frame
face guard (the head's world pitch never above -12 deg, so her face never drops under her bangs at the 48 deg
camera); head-clearance abduction; shield wrist (hand_L) locked; hips travel eased back and clamped (hurt:
stripped); feet pinned by two-bone IK on their planted frames; every clip resampled to 20 fps (pack.py strips
the static channels)."""
import json
import math
import os
import sys
import time

import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector
from mathutils.kdtree import KDTree

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from paths import NOA, MESHY_CLIPS  # noqa: E402
import rigtest_lib as L  # noqa: E402  (shared helpers of the rig test, read-only)

DETAIL = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'full'
SRC = NOA + f'src/noa.ship{".lod" if DETAIL == "lod" else ""}.glb'
MESHY = MESHY_CLIPS
OUTD = NOA + 'out/'
os.makedirs(OUTD, exist_ok=True)
TO_GAME = 1.34806
FPS_SRC = 30
FPS_OUT = 20
CLIPS = [
    ('A2_breathe_look_338.glb', 'idle', 338),
    ('A3_happy_sway_415.glb', 'happy', 415),
    ('A7b_cheer_hands_up_298.glb', 'cheer', 298),
    ('A5_hit_reaction_178.glb', 'hurt', 178),
]
HURT_LEN = 1.2       # s (PLAN §6.5 cap)
FACE_LIMIT = -12.0   # deg: the head's world pitch (negative = chin up) never above this
HURT_BODY = 0.55     # hurt: share of the hips / spine / chest rotation kept
OUT = {'detail': DETAIL, 'clips': {}, 'started': time.strftime('%Y-%m-%d %H:%M:%S')}
T0 = time.time()


def log(*a):
    print('[noa]', f'{time.time() - T0:6.1f}s', *a)
    sys.stdout.flush()


def rotq(Mx):
    m = Mx.to_3x3()
    m.normalize()
    return m.to_quaternion()


def g2b(v):
    return Vector((float(v[0]), -float(v[2]), float(v[1])))


# ------------------------------------------------------------------ retarget (as the rig test's build)
def retarget_clip(tgt, glb, out_name, bone_map, root_tgt='hips'):
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


def world_head_pitch(arm, act):
    """Per frame (integer frames f0..f1): the head's world pitch in degrees (negative = chin up)."""
    S, _ = L.sample_world(arm, act, ['head'])
    Rh = rotq(arm.matrix_world @ arm.data.bones['head'].matrix_local)
    return np.array([math.degrees((rotq(mh) @ Rh.inverted()).to_euler('XYZ').x) for mh in S['head']])


def face_guard(arm, act, limit=FACE_LIMIT, w=4):
    """Wherever the head's world pitch rises above `limit` (chin dropping: the face hides under the bangs
    from the 48 deg battle camera), add just enough chin-up there, eased over +-w frames, spread over
    spine1 25 % / chest 20 % / neck 20 % / head 35 % so she stands taller rather than craning."""
    p = world_head_pitch(arm, act)
    f0 = int(round(L.frame_range(act)[0]))
    need = np.maximum(0.0, p - limit)
    if need.max() <= 0.05:
        return dict(max_deg=0.0, frames=0)
    mx = np.array([need[max(0, i - w):i + w + 1].max() for i in range(len(need))])
    sm = np.array([mx[max(0, i - w):i + w + 1].mean() for i in range(len(mx))])
    sm *= 1.08  # a little margin: the chain does not turn the head exactly about world X
    for bone, share in (('spine1', 0.25), ('chest', 0.2), ('neck', 0.2), ('head', 0.35)):
        L.ensure_quat_track(act, arm, bone)
        cs, idx = key_index(act, bone)
        for j, a in enumerate(sm):
            f = f0 + j
            if a < 0.05 or f not in idx:
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
    return dict(max_deg=round(float(sm.max()), 1), frames=int((sm > 0.05).sum()))


CAM = Vector((0.0, -math.cos(math.radians(48)), math.sin(math.radians(48))))  # toward the 48 deg battle camera


def face_angle(arm, act):
    """Per frame: the angle (deg) between her face's forward direction and the direction to the 48 deg
    battle camera, for a girl facing the camera. The shipped idle sits at ~31 deg; past ~50 deg the bangs
    and the top of the head take over (yaw and pitch both count)."""
    S, _ = L.sample_world(arm, act, ['head'])
    Rh = rotq(arm.matrix_world @ arm.data.bones['head'].matrix_local)
    out = []
    for mh in S['head']:
        f = (rotq(mh) @ Rh.inverted()) @ Vector((0.0, -1.0, 0.0))
        out.append(math.degrees(f.angle(CAM)))
    return np.array(out)


def damp_bones(arm, act, bones, k):
    """Slerp each bone's clip rotation toward its rest pose (k = share kept)."""
    for b in bones:
        if L.bone_curves(act, b, 'rotation_quaternion'):
            L.remap_quat(act, arm, b, lambda q, k=k: Quaternion().slerp(q, k))


def strip_hips_xz(arm, act, bone='hips'):
    """hurt: the hips keep their vertical motion and rotations; their horizontal travel is removed."""
    cs = L.bone_curves(act, bone, 'location')
    if not cs:
        return 0.0
    R = arm.data.bones[bone].matrix_local.to_3x3()
    n = len(cs[0].keyframe_points)
    loc = np.array([[cs[k].keyframe_points[i].co[1] for k in range(3)] for i in range(n)])
    A = np.array([R @ Vector(v) for v in loc])
    peak = float(np.linalg.norm((A - A[0])[:, :2], axis=1).max()) * TO_GAME
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


def pin_feet(arm, act, mode='plants', lift=0.35):
    """Two-bone IK on thigh + shin so the ankles hit their targets; the foot keeps its own orientation.
    mode 'plants': each foot is locked to the mean of every planted stretch (low and slow), the offsets
    blend across the steps between; 'stance': both ankles stay where they stand on the first frame (hurt
    after its travel is stripped), lifts kept at `lift` x."""
    sc = bpy.context.scene
    L.assign(arm, act)
    f0, f1 = (int(round(x)) for x in L.frame_range(act))
    frames = list(range(f0, f1 + 1))
    pbs = arm.pose.bones
    res = {}
    plan = {}
    # pass 1: the ankles as the clip has them
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
            low = P[:, 2] < z0 + 0.012 / TO_GAME
            v = np.r_[0, np.linalg.norm(np.diff(P[:, :2], axis=0), axis=1)] * FPS_SRC * TO_GAME  # game m/s
            planted = low & (v < 0.12)
            # stretches of planted frames
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
        plan[s] = T
        res[f'{s}_max_shift_mm'] = round(float(np.linalg.norm(T - P, axis=1).max()) * TO_GAME * 1000, 1)
    # pass 2: solve and key
    keys = {}
    for b in ('thigh_L', 'shin_L', 'foot_L', 'thigh_R', 'shin_R', 'foot_R'):
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
                    q = b.rotation_quaternion.copy()
                    set_key_quat(cs, idx[f], q)
    for b in keys:
        for c in keys[b][0]:
            c.update()
    # quaternion sign continuity on the keyed bones
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
    """LINEAR keys, times scaled so the clip ends on a whole frame at fps_out (at most half a frame of
    stretch). The exporter samples every action at the scene's fps."""
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
    return dict(frames_in=int(round(n)), frames_out=int(m), duration=round(m / fps_out, 4), stretch=round(s * fps_in / fps_out, 5))


# ------------------------------------------------------------------ spring bones
def add_springs(arm, body, npz):
    D = np.load(npz)
    me = body.data
    Mb = body.matrix_world
    Ma_inv = arm.matrix_world.inverted()
    # match the npz (GLB) vertices to Blender's
    kd = KDTree(len(me.vertices))
    for i, v in enumerate(me.vertices):
        kd.insert(Mb @ v.co, i)
    kd.balance()
    gp = D['pos']
    bidx = np.empty(len(gp), np.int64)
    worst = 0.0
    for i, p in enumerate(gp):
        co, j, dist = kd.find(g2b(p))
        bidx[i] = j
        worst = max(worst, dist)
    info = dict(blender_verts=len(me.vertices), glb_verts=len(gp), match_worst=round(worst, 7))
    bpy.context.view_layer.objects.active = arm
    for o in bpy.context.view_layer.objects:
        o.select_set(o is arm)
    bpy.ops.object.mode_set(mode='EDIT')
    ebs = arm.data.edit_bones
    for n, h, t, par in zip(D['names'], D['heads'], D['tails'], D['parents']):
        eb = ebs.new(str(n))
        eb.head = Ma_inv @ g2b(h)
        eb.tail = Ma_inv @ g2b(t)
        eb.roll = 0.0
        eb.parent = ebs[str(par)]
        eb.use_connect = False
        eb.use_deform = True
    bpy.ops.object.mode_set(mode='OBJECT')
    for k, n in enumerate(D['names']):
        n = str(n)
        vg = body.vertex_groups.get(n) or body.vertex_groups.new(name=n)
        W = D['weights'][k]
        done = 0
        seen = set()
        for i in np.nonzero(W > 0.004)[0]:
            j = int(bidx[i])
            if j in seen:
                continue
            seen.add(j)
            w = float(min(1.0, W[i]))
            v = me.vertices[j]
            for g in v.groups:
                g.weight *= (1.0 - w)
            vg.add([j], w, 'REPLACE')
            done += 1
        info[n] = done
    return info


# ------------------------------------------------------------------ build
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = FPS_SRC
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=SRC)
new = [o for o in bpy.data.objects if o not in before]
for o in new:
    if o.type == 'MESH' and o.name.startswith('Icosphere'):
        bpy.data.objects.remove(o)
arm = bpy.data.objects['noa_rig']
body = bpy.data.objects['noa']
log('imported', SRC, 'arm mw identity:', arm.matrix_world == Matrix.Identity(4), 'body mw identity:', body.matrix_world == Matrix.Identity(4),
    'verts', len(body.data.vertices))
old = {a.name: a for a in bpy.data.actions}
log('shipped actions', sorted(old))
OUT['shipped'] = {}
for nm in ('idle', 'cheer', 'hurt'):
    OUT['shipped'][nm] = L.measure(arm, old[nm], TO_GAME)
    fa = face_angle(arm, old[nm])
    OUT['shipped'][nm]['face_angle_mean_max'] = [round(float(fa.mean()), 1), round(float(fa.max()), 1)]
    OUT['shipped'][nm]['world_pitch_mean_min_max'] = L.chin_pitch(arm, old[nm], 'world')
    old[nm].name = nm + '_short'
TARGET = OUT['shipped']['idle']['world_pitch_mean_min_max'][0]
OUT['world_pitch_target'] = TARGET
for a in bpy.data.actions:
    a.use_fake_user = True

# the mesh is not needed while posing: keep the depsgraph light
body.hide_viewport = True
bmap = {k: v for k, v in L.MESHY_TO_OURS.items() if v not in ('head_end', 'head_front')}
for fname, clip, lib_id in CLIPS:
    act, k_leg = retarget_clip(arm, MESHY + fname, clip, bmap, 'hips')
    info = dict(src=fname, library_id=lib_id, k_leg=round(k_leg, 4))
    info['before'] = L.measure(arm, act, TO_GAME)
    info['before']['world_pitch_mean_min_max'] = L.chin_pitch(arm, act, 'world')
    info['before']['face_angle_mean_max'] = [round(float(x), 1) for x in (face_angle(arm, act).mean(), face_angle(arm, act).max())]
    if clip == 'hurt':
        f0, f1 = L.frame_range(act)
        L.trim_action(act, int(f0), int(f0 + round(HURT_LEN * FPS_SRC)))
        info['trim'] = [0.0, HURT_LEN]
        # the hit twists and tips her whole torso (hips 23 deg): from the 48 deg camera her face turned
        # away for ~0.8 s (first capture). Keep the recoil but at a chibi size: hips / spine / chest x0.55
        damp_bones(arm, act, ['hips', 'spine', 'spine1', 'chest'], HURT_BODY)
        info['body_damp'] = HURT_BODY
    info['postpass'] = L.post_pass(act, arm, chin_sign=-1.0, target=TARGET, max_chin=22.0, damp=(0.75, 0.6), wrist_straight='hand_L')
    info['face_guard'] = face_guard(arm, act)
    info['head_clearance_deg'] = L.head_clearance(act, arm, radius_factor=0.68)
    if clip == 'hurt':
        info['hips_xz_peak_game_m'] = round(strip_hips_xz(arm, act), 3)
        info['feet'] = pin_feet(arm, act, mode='stance', lift=0.35)
    else:
        peak, kept = L.clamp_hips_xz(act, arm, 'hips', 0.15, TO_GAME)
        info['hips_xz_peak_game_m'] = round(peak, 3)
        info['hips_xz_kept_game_m'] = round(kept, 3)
        info['feet'] = pin_feet(arm, act, mode='plants')
    info['after'] = L.measure(arm, act, TO_GAME)
    p = world_head_pitch(arm, act)
    info['after']['world_pitch_mean_min_max'] = [round(float(p.mean()), 2), round(float(p.min()), 2), round(float(p.max()), 2)]
    info['after']['face_hidden_s'] = round(float((p > FACE_LIMIT + 1.5).sum()) / FPS_SRC, 3)
    fa = face_angle(arm, act)
    info['after']['face_angle_mean_max'] = [round(float(fa.mean()), 1), round(float(fa.max()), 1)]
    info['after']['face_angle_over50_s'] = round(float((fa > 50).sum()) / FPS_SRC, 3)
    OUT['clips'][clip] = info
    log(clip, json.dumps({k: info[k] for k in ('face_guard', 'head_clearance_deg', 'hips_xz_peak_game_m', 'feet')}),
        'after', json.dumps(info['after']))
arm.animation_data.action = None
body.hide_viewport = False

# resample everything to 20 fps (the shipped clips too: the exporter samples at the scene's rate)
OUT['resample'] = {}
for a in bpy.data.actions:
    OUT['resample'][a.name] = resample(a)
sc.render.fps = FPS_OUT
log('resampled', json.dumps(OUT['resample']))

OUT['springs'] = add_springs(arm, body, NOA + f'build/springs_{DETAIL}.npz')
log('springs', json.dumps(OUT['springs']))

raw = OUTD + f'noa_{DETAIL}.raw.glb'
L.export_glb(raw, [arm, body])
log('exported', raw, os.path.getsize(raw))
json.dump(OUT, open(OUTD + f'build_{DETAIL}.json', 'w'), indent=1)
log('DONE')
sys.stdout.flush()
os._exit(0)
