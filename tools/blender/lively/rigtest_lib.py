"""Shared helpers for the Noa rig test (Blender 5.2, bpy). Used by build_noa.py and girllib.py.

* actions: slotted-action fcurve access, rename bone paths, assign an action to an armature
* clip post-pass: chin-up, chibi head damping, straight shield wrist, hips XZ clamp
* measurements: per-bone motion range, foot slide, hand-to-head distance
* export: glTF export with the pipeline's settings, then pack.py (int16 / WebP, half-scale storage)"""
import math
import os
import sys

import bpy
import numpy as np
from bpy_extras import anim_utils
from mathutils import Matrix, Quaternion, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paths import PYLIBS, MESHY_TOOLS  # noqa: E402
for p in [x for x in (PYLIBS, MESHY_TOOLS) if x]:
    if p not in sys.path:
        sys.path.insert(0, p)

# Meshy humanoid (rig + animation library) -> the shipped Noa skeleton's names
MESHY_TO_OURS = {
    'Hips': 'hips', 'Spine02': 'spine', 'Spine01': 'spine1', 'Spine': 'chest', 'neck': 'neck', 'Head': 'head',
    'head_end': 'head_end', 'headfront': 'head_front',
    'LeftShoulder': 'shoulder_L', 'LeftArm': 'upper_arm_L', 'LeftForeArm': 'forearm_L', 'LeftHand': 'hand_L',
    'RightShoulder': 'shoulder_R', 'RightArm': 'upper_arm_R', 'RightForeArm': 'forearm_R', 'RightHand': 'hand_R',
    'LeftUpLeg': 'thigh_L', 'LeftLeg': 'shin_L', 'LeftFoot': 'foot_L', 'LeftToeBase': 'toe_L',
    'RightUpLeg': 'thigh_R', 'RightLeg': 'shin_R', 'RightFoot': 'foot_R', 'RightToeBase': 'toe_R',
}

# clip files (paths.MESHY_CLIPS) -> game clip names
CLIPS = [
    ('A2_breathe_look_338.glb', 'idle'),       # 7.8 s, breathes and looks round, stays front-on
    ('A1b_idle9_249.glb', 'idle_short'),       # 249 Idle_9 = the idle the shipped clip already uses (2 s)
    ('A3_happy_sway_415.glb', 'happy'),        # (0 Idle was rejected: side-on, slouched, head turns 90 deg)
    ('A4_shield_push_left_220.glb', 'attack_smash'),
    ('A5_hit_reaction_178.glb', 'hurt'),
    ('A6_dumbfounded_333.glb', 'dizzy'),
    ('A7b_cheer_hands_up_298.glb', 'cheer'),  # swap: 27 Big_Heart_Gesture puts a hand through her head
    ('A8_hop_arms_raised_417.glb', 'deploy'),
    ('R1_walk_armature.glb', 'walk'),
    ('R1_run_armature.glb', 'run'),
]
# one-shots trimmed around their key moment (seconds before / after; the game crossfades in and out)
TRIM = {'attack_smash': ('contact', 0.22, 0.45)}
LOOPS = {'idle', 'idle_short', 'happy', 'dizzy', 'walk', 'run'}


# ---------------------------------------------------------------- actions
def fcurves(act):
    out = []
    for slot in act.slots:
        cb = anim_utils.action_get_channelbag_for_slot(act, slot)
        if cb:
            out.extend(cb.fcurves)
    return out


def groups(act):
    out = []
    for slot in act.slots:
        cb = anim_utils.action_get_channelbag_for_slot(act, slot)
        if cb:
            out.extend(cb.groups)
    return out


def assign(arm, act):
    arm.animation_data_create()
    arm.animation_data.action = act
    if arm.animation_data.action_slot is None and len(act.slots):
        arm.animation_data.action_slot = act.slots[0]


def rename_paths(act, mapping):
    for fc in fcurves(act):
        dp = fc.data_path
        if dp.startswith('pose.bones["'):
            b = dp[12:dp.index('"]')]
            if b in mapping:
                fc.data_path = dp.replace(f'pose.bones["{b}"]', f'pose.bones["{mapping[b]}"]', 1)
    for g in groups(act):
        if g.name in mapping:
            g.name = mapping[g.name]


def bone_curves(act, bone, prop):
    path = f'pose.bones["{bone}"].{prop}'
    cs = {fc.array_index: fc for fc in fcurves(act) if fc.data_path == path}
    return [cs[i] for i in sorted(cs)] if cs else None


def frame_range(act):
    fr = [fc.range() for fc in fcurves(act)]
    return min(r[0] for r in fr), max(r[1] for r in fr)


# ---------------------------------------------------------------- post-pass
def _rest_rot(arm, bone):
    m = arm.data.bones[bone].matrix_local.to_3x3()
    m.normalize()
    return m.to_quaternion()


def remap_quat(act, arm, bone, fn):
    """Apply fn(q) -> q to every key of a bone's quaternion curves (keys share frames)."""
    cs = bone_curves(act, bone, 'rotation_quaternion')
    if not cs:
        return False
    n = len(cs[0].keyframe_points)
    if any(len(c.keyframe_points) != n for c in cs):
        raise RuntimeError(f'{act.name}/{bone}: quaternion keys not aligned')
    prev = None
    for i in range(n):
        q = Quaternion([cs[k].keyframe_points[i].co[1] for k in range(4)])
        q2 = fn(q)
        q2.normalize()
        if prev is not None and q2.dot(prev) < 0:
            q2.negate()
        prev = q2
        for k in range(4):
            kp = cs[k].keyframe_points[i]
            kp.co[1] = q2[k]
            kp.handle_left[1] = q2[k]
            kp.handle_right[1] = q2[k]
    for c in cs:
        c.update()
    return True


def ensure_quat_track(act, arm, bone):
    """A bone with no rotation curves in a clip (the hand_L case) gets two identity keys."""
    if bone_curves(act, bone, 'rotation_quaternion'):
        return
    f0, f1 = frame_range(act)
    slot = act.slots[0]
    cb = anim_utils.action_ensure_channelbag_for_slot(act, slot)
    for k, v in enumerate((1.0, 0.0, 0.0, 0.0)):
        fc = cb.fcurves.new(f'pose.bones["{bone}"].rotation_quaternion', index=k)
        fc.keyframe_points.insert(f0, v)
        fc.keyframe_points.insert(f1, v)


def chin_quat(arm, bone, pitch_deg):
    """World-axis pitch (about +X) expressed as a pre-rotation of the bone's pose basis."""
    R = _rest_rot(arm, bone)
    Cw = Quaternion(Vector((1, 0, 0)), math.radians(pitch_deg))
    return R.inverted() @ Cw @ R


def _rotq(Mx):
    m = Mx.to_3x3()
    m.normalize()
    return m.to_quaternion()


def chin_pitch(arm, act, mode='world'):
    """(mean, min, max) head pitch in degrees about world X over the clip (negative = chin up for a figure facing
    -Y). mode 'world': the head's own delta from its rest orientation (what the battle camera sees);
    'rel': the head relative to the chest."""
    S, _ = sample_world(arm, act, ['chest', 'head'])
    Rc = _rotq(arm.matrix_world @ arm.data.bones['chest'].matrix_local)
    Rh = _rotq(arm.matrix_world @ arm.data.bones['head'].matrix_local)
    vals = []
    for mc, mh in zip(S['chest'], S['head']):
        Dh = _rotq(mh) @ Rh.inverted()
        rel = Dh if mode == 'world' else (_rotq(mc) @ Rc.inverted()).inverted() @ Dh
        vals.append(math.degrees(rel.to_euler('XYZ').x))
    return round(sum(vals) / len(vals), 2), round(min(vals), 2), round(max(vals), 2)


def post_pass(act, arm, chin_sign=-1.0, target=-5.0, max_chin=13.0, damp=(0.75, 0.6), wrist_straight='hand_L'):
    """1. neck / head: damp the clip's own rotation (slerp toward rest; adult mocap swings a 44 % head too far)
    2. straight shield wrist
    3. chin-up: the shipped clips carry a 13 deg chin-up so the eyes clear the bangs at the 48 deg camera. What the
       camera sees is the head's WORLD pitch (library mocap often leans the chest forward), so the added pitch is
       whatever brings the clip's mean world head pitch to `target` (the shipped idle's), between 0 and max_chin,
       split 40 / 60 neck / head."""
    info = {}
    for bone, d in (('neck', damp[0]), ('head', damp[1])):
        ensure_quat_track(act, arm, bone)
        remap_quat(act, arm, bone, lambda q, d=d: Quaternion().slerp(q, d))
        info[bone + '_damp'] = d
    if wrist_straight:
        ensure_quat_track(act, arm, wrist_straight)
        remap_quat(act, arm, wrist_straight, lambda q: Quaternion())
        info['wrist'] = wrist_straight
    mean0 = chin_pitch(arm, act)[0]
    want = target - mean0  # degrees in the measured sign convention
    add = max(-max_chin, min(0.0, want)) if chin_sign < 0 else min(max_chin, max(0.0, want))
    # spread over the spine so she stands taller instead of craning her neck back
    for bone, share in (('spine1', 0.25), ('chest', 0.2), ('neck', 0.2), ('head', 0.35)):
        ensure_quat_track(act, arm, bone)
        C = chin_quat(arm, bone, add * share)
        remap_quat(act, arm, bone, lambda q, C=C: C @ q)
    info['pitch_before_chin'] = mean0
    info['chin_added_deg'] = round(add, 2)
    return info


def trim_action(act, f_start, f_end):
    """Keep keys in [f_start, f_end] (integer frames), shifted to start at 0."""
    for fc in fcurves(act):
        kps = fc.keyframe_points
        for i in range(len(kps) - 1, -1, -1):
            f = kps[i].co[0]
            if f < f_start - 1e-4 or f > f_end + 1e-4:
                kps.remove(kps[i], fast=True)
        for kp in kps:
            kp.co[0] -= f_start
            kp.handle_left[0] -= f_start
            kp.handle_right[0] -= f_start
        fc.update()


def contact_frame(arm, act, hand='hand_L'):
    """Frame (action frame) of the hand's greatest forward reach (-Y) relative to the hips."""
    sc = bpy.context.scene
    assign(arm, act)
    f0, f1 = (int(round(x)) for x in frame_range(act))
    best, bf = -1e9, f0
    for f in range(f0, f1 + 1):
        sc.frame_set(f)
        h = (arm.matrix_world @ arm.pose.bones[hand].matrix).translation
        p = (arm.matrix_world @ arm.pose.bones['hips'].matrix).translation
        fwd = -(h.y - p.y)
        if fwd > best:
            best, bf = fwd, f
    return bf, f0, f1


def apply_trim(act, arm, clip, fps=30):
    if clip not in TRIM:
        return None
    _key, before, after = TRIM[clip]
    cf, f0, f1 = contact_frame(arm, act)
    a = max(f0, cf - int(round(before * fps)))
    b = min(f1, cf + int(round(after * fps)))
    trim_action(act, a, b)
    return dict(contact_src_s=round((cf - f0) / fps, 3), kept_src_s=[round((a - f0) / fps, 3), round((b - f0) / fps, 3)],
                contact=round((cf - a) / fps, 3), duration=round((b - a) / fps, 3))


def clamp_hips_xz(act, arm, bone, max_m, unit):
    """Keep a tower on its tile: the root-motion bone's horizontal travel (armature space, from frame 0) is
    eased back so the clip ends where it started (smoothstep ramp over the clip), then soft-clamped to max_m
    game metres. Vertical hops stay. unit = game metres per armature unit. Returns (peak before, peak after)."""
    cs = bone_curves(act, bone, 'location')
    if not cs:
        return 0.0, 0.0
    R = arm.data.bones[bone].matrix_local.to_3x3()
    n = len(cs[0].keyframe_points)
    loc = np.array([[cs[k].keyframe_points[i].co[1] for k in range(3)] for i in range(n)])
    arm_sp = np.array([R @ Vector(v) for v in loc])  # bone-local offset -> armature axes
    d = arm_sp - arm_sp[0]
    horiz = np.linalg.norm(d[:, :2], axis=1) * unit
    peak = float(horiz.max())
    s = np.linspace(0, 1, n)
    ramp = s * s * (3 - 2 * s)
    d2 = d.copy()
    d2[:, :2] = d[:, :2] - d[-1, :2] * ramp[:, None]
    h2 = np.linalg.norm(d2[:, :2], axis=1) * unit
    k = np.minimum(1.0, max_m / np.maximum(h2, 1e-9))
    new = arm_sp.copy()
    new[:, 0] = arm_sp[0, 0] + d2[:, 0] * k
    new[:, 1] = arm_sp[0, 1] + d2[:, 1] * k
    after = float((np.linalg.norm((new - arm_sp[0])[:, :2], axis=1) * unit).max())
    if peak <= 0.005:
        return peak, peak
    Ri = R.inverted()
    for i in range(n):
        v = Ri @ Vector(new[i])
        for c in range(3):
            kp = cs[c].keyframe_points[i]
            kp.co[1] = v[c]
            kp.handle_left[1] = v[c]
            kp.handle_right[1] = v[c]
    for c in cs:
        c.update()
    return peak, after


def head_clearance(act, arm, radius_factor=0.62, margin=0.0, max_deg=50.0):
    """Adult mocap raises hands where a 44 % chibi head is: where a wrist comes inside a sphere round the head
    (centre midway head -> head_end, radius radius_factor x head length) the upper arm is abducted in the frontal
    plane (about world Y, through the shoulder) just enough to clear it; the angle is widened and smoothed over
    +-4 frames so it eases in and out. Returns {side: max degrees}."""
    sc = bpy.context.scene
    assign(arm, act)
    f0, f1 = (int(round(x)) for x in frame_range(act))
    frames = list(range(f0, f1 + 1))
    hl = (arm.data.bones['head_end'].head_local - arm.data.bones['head'].head_local).length
    R = radius_factor * hl + margin
    res = {}
    for side, sgn in (('L', 1.0), ('R', -1.0)):
        ua, hand = f'upper_arm_{side}', f'hand_{side}'
        th = []
        for f in frames:
            sc.frame_set(f)
            pb = arm.pose.bones
            c = (pb['head'].head + pb['head_end'].head) / 2
            p = pb[ua].head
            v = pb[hand].head - p
            need = 0.0
            if (p + v - c).length < R:
                need = max_deg
                for k in range(1, int(max_deg / 1.5) + 1):
                    a = math.radians(1.5 * k) * sgn
                    q = Quaternion(Vector((0, 1, 0)), a)
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
        cs = bone_curves(act, ua, 'rotation_quaternion')
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
            M2 = Matrix.Translation(piv) @ Rw @ Matrix.Translation(-piv) @ Mx
            pb.matrix = M2
            bpy.context.view_layer.update()
            new_q[idx[f]] = pb.rotation_quaternion.copy()
        for i, q in new_q.items():
            for k in range(4):
                kp = cs[k].keyframe_points[i]
                kp.co[1] = q[k]
                kp.handle_left[1] = q[k]
                kp.handle_right[1] = q[k]
        for c in cs:
            c.update()
        res[side] = round(float(sm.max()), 1)
    return res


# ---------------------------------------------------------------- measurements
def sample_world(arm, act, bones, step=1):
    """{bone: [(t, Matrix world)...]} by evaluating the action frame by frame."""
    sc = bpy.context.scene
    assign(arm, act)
    f0, f1 = frame_range(act)
    out = {b: [] for b in bones}
    f = f0
    while f <= f1 + 1e-6:
        sc.frame_set(int(math.floor(f)), subframe=f - math.floor(f))
        for b in bones:
            out[b].append(arm.matrix_world @ arm.pose.bones[b].matrix)
        f += step
    return out, (f1 - f0) / sc.render.fps


def rot_range_deg(mats):
    q0 = mats[0].to_quaternion()
    return max(math.degrees(q0.rotation_difference(m.to_quaternion()).angle) for m in mats)


def measure(arm, act, scale_to_game):
    """Motion ranges (deg, relative to the clip's first frame), foot slide while planted and the
    closest hand-to-head distance, in game units (figure 1.224 tall)."""
    bones = ['hips', 'spine1', 'chest', 'neck', 'head', 'upper_arm_L', 'upper_arm_R', 'hand_L', 'hand_R',
             'foot_L', 'foot_R', 'head_end']
    S, dur = sample_world(arm, act, bones)
    rng = {b: round(rot_range_deg(S[b]), 1) for b in ('hips', 'spine1', 'chest', 'neck', 'head', 'upper_arm_L', 'upper_arm_R')}
    slide = {}
    for f in ('foot_L', 'foot_R'):
        P = np.array([m.translation[:] for m in S[f]])
        low = P[:, 2] < P[:, 2].min() + 0.01 / scale_to_game  # planted: within 1 cm (game) of its lowest
        if low.sum() > 1:
            Q = P[low][:, :2]
            slide[f] = round(float(np.linalg.norm(Q - Q.mean(0), axis=1).max()) * scale_to_game * 1000, 1)  # mm
    for b in rng:
        rng[b] = round(min(rng[b], 360 - rng[b]), 1)
    head_c = [(S['head'][i].translation + S['head_end'][i].translation) / 2 for i in range(len(S['head']))]
    head_r = (S['head_end'][0].translation - S['head'][0].translation).length / 2
    hand_min = min(min((S[h][i].translation - head_c[i]).length for i in range(len(head_c))) for h in ('hand_L', 'hand_R'))
    hips_y = np.array([m.translation[2] for m in S['hips']])
    return dict(duration=round(dur, 3), range_deg=rng, foot_slide_mm=slide,
                hand_to_head_over_radius=round(hand_min / head_r, 2),
                hips_rise_mm=round(float(hips_y.max() - hips_y[0]) * scale_to_game * 1000, 1))


# ---------------------------------------------------------------- export + pack
def export_glb(path, objs):
    for o in bpy.data.objects:
        o.select_set(o in objs)
    for o in objs:
        if o.type == 'ARMATURE':
            if o.animation_data:
                o.animation_data.action = None
            for pb in o.pose.bones:
                pb.rotation_quaternion = (1, 0, 0, 0)
                pb.location = (0, 0, 0)
                pb.scale = (1, 1, 1)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True, export_animations=True,
        export_animation_mode='ACTIONS', export_force_sampling=True, export_frame_step=1,
        export_optimize_animation_size=True, export_anim_single_armature=True, export_reset_pose_bones=True,
        export_skins=True, export_all_influences=False, export_morph=False, export_normals=True,
        export_tangents=False, export_texcoords=True, export_image_format='AUTO', export_yup=True,
        export_apply=False, export_extras=False, export_def_bones=False, export_current_frame=False)


def pack(raw, out, extras, store_scale=0.5, tex_size=1024):
    from lib import pack as P  # tools/meshy/lib/pack.py
    return P.pack(raw, out, store_scale, extras, webp_quality=90, tex_size=tex_size)
