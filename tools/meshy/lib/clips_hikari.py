"""Hikari's game clips on the owner's Meshy rig + her jewelled sword.

idle / walk keep the retargeted Meshy-library motion (raw_idle / raw_walk actions made by
retarget.py) for the torso, head and free arm; the sword arm (and the legs while she bounces or
hops) is solved with 2-bone IK so the blade path is designed: it stays beside or below her face
from the front and from the 48 deg battle camera. attack_slash, cheer and hurt are authored here.
All poses are world-axis rotations on top of the rest pose (posekit), keyed on every frame."""
import math

import bpy
from mathutils import Matrix, Quaternion, Vector

from .posekit import Rig, Q, E, rotq, smooth, lerp, two_bone, signed_angle
from .sword import build_sword

CLIPS = ('idle', 'walk', 'attack_slash', 'cheer', 'hurt')


def build(arm, raw_fps=24, fps=30):
    """Adds the sword (parented to hand_R) and the game actions; removes the raw_* actions."""
    FPS = fps
    sc = bpy.context.scene
    sc.render.fps = FPS
    rig = Rig(arm)
    V = Vector

    # ---------------------------------------------------------------- sword
    # parent in the rest pose: matrix_world below is solved against the *evaluated* bone
    if arm.animation_data:
        arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0); pb.scale = (1, 1, 1)
    sc.frame_set(0)
    bpy.context.view_layer.update()
    wr = rig.head['wrist_R']; hand_c = V((-0.362, -0.196, 0.548))
    handv = (hand_c - wr).normalized()
    fwd = V((0.18, -1.0, -0.15)).normalized()
    B_REST = (fwd - handv * fwd.dot(handv)).normalized()   # blade leaves the fist on the thumb side
    sw = build_sword(1.0, 'sword')
    yax = B_REST; xax = handv.cross(yax).normalized(); zax = xax.cross(yax).normalized()
    rot = Matrix((xax, yax, zax)).transposed()
    GRIP = hand_c + B_REST * 0.004
    sw.matrix_world = Matrix.Translation(GRIP) @ rot.to_4x4()
    sw.parent = arm; sw.parent_type = 'BONE'; sw.parent_bone = 'hand_R'
    sw.matrix_world = Matrix.Translation(GRIP) @ rot.to_4x4()
    bpy.context.view_layer.update()
    print('sword tris', sum(len(p.vertices) - 2 for p in sw.data.polygons), 'B_REST', B_REST)

    # ---------------------------------------------------------------- raw clip samplers (world deltas -> local)
    def sample_raw(name):
        act = bpy.data.actions[name]; arm.animation_data.action = act
        f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
        frames = []
        for f in range(f0, f1 + 1):
            sc.frame_set(f)
            D = {n: rotq(arm.pose.bones[n].matrix) @ rig.Rq[n].inverted() for n in rig.order}
            L = {}
            for n in rig.order:
                p = rig.parent[n]
                L[n] = D[n] if p is None else D[p].inverted() @ D[n]
            rt = arm.pose.bones['root'].matrix.translation - rig.head['root']
            frames.append((L, rt))
        arm.animation_data.action = None
        return frames, (f1 - f0) / raw_fps

    def raw_at(frames, u, bones):
        """u in [0,1) over the clip; returns (L subset, root_t)."""
        x = u * (len(frames) - 1); i = int(math.floor(x)); i2 = min(i + 1, len(frames) - 1); t = x - i
        La, ra = frames[i]; Lb, rb = frames[i2]
        return {n: La[n].slerp(Lb[n], t) for n in bones}, ra.lerp(rb, t)

    def looped(frames, blend=0.18):
        """Cross-fade the tail into the head so the clip loops cleanly."""
        n = len(frames); k = max(1, int(n * blend)); out = list(frames)
        for j in range(k):
            w = smooth((j + 1) / (k + 1))
            La, ra = frames[n - k + j]; Lb, rb = frames[j]
            out[n - k + j] = ({b: La[b].slerp(Lb[b], w) for b in La}, ra.lerp(rb, w))
        out[-1] = frames[0]
        return out

    raw_idle, raw_idle_len = sample_raw('raw_idle')
    raw_walk, raw_walk_len = sample_raw('raw_walk')
    raw_idle = looped(raw_idle); raw_walk = looped(raw_walk, 0.10)
    print('raw lengths', raw_idle_len, raw_walk_len)

    TORSO = ['root', 'spine', 'spine1', 'chest', 'neck', 'head']
    ARM_L = ['shoulder_L', 'upper_arm_L', 'forearm_L', 'wrist_L']
    ARM_R = ['shoulder_R', 'upper_arm_R', 'forearm_R', 'wrist_R']
    LEGS = ['thigh_L', 'shin_L', 'foot_L', 'toe_L', 'thigh_R', 'shin_R', 'foot_R', 'toe_R']

    # ---------------------------------------------------------------- IK helpers
    LEN = {}
    for s in 'LR':
        LEN['arm' + s] = ((rig.head['forearm_' + s] - rig.head['upper_arm_' + s]).length, (rig.head['wrist_' + s] - rig.head['forearm_' + s]).length)
        LEN['leg' + s] = ((rig.head['shin_' + s] - rig.head['thigh_' + s]).length, (rig.head['foot_' + s] - rig.head['shin_' + s]).length)

    def arm_ik(M, D, ov, s, T, pole, blade=None, wrist_max=55.0, twist_up=0.35):
        ua, fa, wr_ = 'upper_arm_' + s, 'forearm_' + s, 'wrist_' + s
        S = M[ua].translation
        L1, L2 = LEN['arm' + s]
        Ep, Tp = two_bone(S, L1, L2, T, pole)
        Dua = (rig.head[fa] - rig.head[ua]).rotation_difference(Ep - S)
        Dfa = (rig.head[wr_] - rig.head[fa]).rotation_difference(Tp - Ep)
        Dwr = Dfa
        if blade is not None:
            ax = (Tp - Ep).normalized()
            phi = signed_angle(Dfa @ B_REST, blade, ax)
            phi = max(-math.radians(100), min(math.radians(100), phi))
            Dfa = Quaternion(ax, phi) @ Dfa
            Dua = Quaternion((Ep - S).normalized(), phi * twist_up) @ Dua
            now = Dfa @ B_REST
            res = now.rotation_difference(blade)
            ang = min(res.angle, math.radians(wrist_max))
            Dwr = Quaternion(res.axis, ang) @ Dfa if res.angle > 1e-5 else Dfa
        else:
            Dwr = Dfa
        ov[ua] = Dua; ov[fa] = Dfa; ov[wr_] = Dwr

    def leg_ik(M, ov, s, T, foot_rot=None):
        th, sh, ft = 'thigh_' + s, 'shin_' + s, 'foot_' + s
        S = M[th].translation
        L1, L2 = LEN['leg' + s]
        pole = S + V((0.04 if s == 'L' else -0.04, -0.6, -0.15))
        Ep, Tp = two_bone(S, L1, L2, T, pole)
        ov[th] = (rig.head[sh] - rig.head[th]).rotation_difference(Ep - S)
        ov[sh] = (rig.head[ft] - rig.head[sh]).rotation_difference(Tp - Ep)
        ov[ft] = foot_rot or Quaternion()

    def pose(L, root_t, arms=None, legs=True, foot_lift=(0.0, 0.0), foot_shift=None):
        """Two-pass solve: FK for everything, then IK arms/legs on the posed torso."""
        M, D = rig.solve(L, root_t)
        ov = {}
        if legs:
            for i, s in enumerate('LR'):
                T = rig.head['foot_' + s] + V((0, 0, foot_lift[i]))
                if foot_shift: T = T + foot_shift[i]
                leg_ik(M, ov, s, T)
        for s, spec in (arms or {}).items():
            arm_ik(M, D, ov, s, **spec)
        return rig.solve(L, root_t, ov)

    # ---------------------------------------------------------------- secondary motion
    def hair(L, t, amp=1.0, speed=1.0, phase=0.0, sway=0.0):
        w = 2 * math.pi * speed
        a = math.sin(w * t + phase); b = math.sin(w * t + phase - 0.9)
        L['hair_back1'] = E(x=-2.5 * amp * a + sway * 0.4); L['hair_back2'] = E(x=-2.0 * amp * b)
        L['hair_L1'] = E(y=-2.2 * amp * a, x=-1.2 * amp * b); L['hair_L2'] = E(y=-1.8 * amp * b)
        L['hair_R1'] = E(y=2.2 * amp * a, x=-1.2 * amp * b); L['hair_R2'] = E(y=1.8 * amp * b)
        L['bangs1'] = E(x=0.8 * amp * b)
        L['coat_L1'] = E(y=-1.5 * amp * b); L['coat_R1'] = E(y=1.5 * amp * b); L['coat_back1'] = E(x=-1.5 * amp * b)

    # ---------------------------------------------------------------- grip (sword hand fingers curl round the handle)
    CURL = 70.0
    def grip(L):
        L['finger1_R'] = Q(B_REST, CURL); L['finger2_R'] = Q(B_REST, CURL * 0.8)
        L['thumb1_R'] = Q(B_REST, CURL * 0.35); L['thumb2_R'] = Q(B_REST, CURL * 0.45); L['thumb3_R'] = Q(B_REST, CURL * 0.3)

    # ---------------------------------------------------------------- lean back for the battle camera
    # The battle camera looks down at ~48 deg and her long bangs then cover the top of the eyes;
    # a small chin-up + lean back in every clip keeps the painted eyes readable from above.
    LEAN_SPINE, LEAN_NECK = -3.0, -7.0
    def lean(L):
        L['spine'] = E(x=LEAN_SPINE) @ L.get('spine', Quaternion())
        L['neck'] = E(x=LEAN_NECK) @ L.get('neck', Quaternion())

    # ---------------------------------------------------------------- shared poses
    GUARD_T = V((-0.300, -0.262, 0.605)); GUARD_B = V((0.60, -0.52, -0.62)).normalized()
    POLE_R = lambda M: M['upper_arm_R'].translation + V((-0.30, 0.28, -0.25))
    POLE_L = lambda M: M['upper_arm_L'].translation + V((0.30, 0.28, -0.25))
    ARM_L_ABDUCT = E(y=-9.0)   # free left arm a little away from the coat

    def keyframes(name, n_frames, fn, loop=True):
        act = bpy.data.actions.new(name); act.use_fake_user = True
        arm.animation_data.action = act
        for f in range(n_frames + 1):
            t = f / FPS
            M, D = fn(t)
            rig.key(M, f)
        arm.animation_data.action = None
        return act

    def catmull(keys, t):
        """keys: [(time, Vector)] -> Catmull-Rom position at t (clamped)."""
        if t <= keys[0][0]: return keys[0][1].copy()
        if t >= keys[-1][0]: return keys[-1][1].copy()
        for i in range(len(keys) - 1):
            if keys[i][0] <= t <= keys[i + 1][0]: break
        t0, p1 = keys[i]; t1, p2 = keys[i + 1]
        p0 = keys[i - 1][1] if i > 0 else p1 + (p1 - p2) * 0.0
        p3 = keys[i + 2][1] if i + 2 < len(keys) else p2
        u = (t - t0) / (t1 - t0)
        return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u)

    def scalar_keys(keys, t):
        if t <= keys[0][0]: return keys[0][1]
        if t >= keys[-1][0]: return keys[-1][1]
        for i in range(len(keys) - 1):
            if keys[i][0] <= t <= keys[i + 1][0]:
                u = smooth((t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]))
                return lerp(keys[i][1], keys[i + 1][1], u)

    # ---------------------------------------------------------------- idle (1.5 s, two soft bounces)
    IDLE_T = 1.5
    def idle_pose(t, bounce_amp=0.026):
        # two soft knee-bounces per loop on top of the library idle's breathing and sway
        u = (t / IDLE_T) % 1.0
        Lr, rt = raw_at(raw_idle, u, TORSO + ARM_L)
        L = dict(Lr)
        L['root'] = Quaternion()
        dip = 0.5 - 0.5 * math.cos(2 * math.pi * 2 * u)
        bz = -bounce_amp * dip
        root_t = V((rt.x * 0.5, rt.y * 0.5, bz))
        L['chest'] = L['chest'] @ E(x=1.2 * math.sin(2 * math.pi * 2 * u - 0.6))
        L['neck'] = L['neck'] @ E(x=1.6 * math.sin(2 * math.pi * 2 * u - 1.3))
        L['upper_arm_L'] = E(y=-3.0 * dip) @ ARM_L_ABDUCT @ L['upper_arm_L']
        grip(L); lean(L); hair(L, t, amp=1.0, speed=2 / IDLE_T, phase=0.0)
        M0, D0 = rig.solve(L, root_t)
        T = GUARD_T + V((0, 0, bz * 0.6)) + (M0['chest'].translation - rig.head['chest']) * 0.6
        return pose(L, root_t, arms={'R': dict(T=T, pole=POLE_R(M0), blade=GUARD_B)})
    keyframes('idle', int(IDLE_T * FPS), idle_pose)

    # ---------------------------------------------------------------- walk (raw Meshy walk, sword held low)
    WALK_T = round(raw_walk_len, 3)
    def walk_pose(t):
        u = (t / WALK_T) % 1.0
        Lr, rt = raw_at(raw_walk, u, TORSO + ARM_L + LEGS)
        L = dict(Lr)
        L['upper_arm_L'] = E(y=-14.0) @ L['upper_arm_L']
        root_t = V((0.0, 0.0, rt.z))
        grip(L); lean(L); hair(L, t, amp=1.6, speed=2 / WALK_T, phase=0.4, sway=3.0)
        M0, D0 = rig.solve(L, root_t)
        swing = math.sin(2 * math.pi * u)
        T = GUARD_T + V((0.0, -0.035 * swing, 0.01 * abs(swing))) + (M0['chest'].translation - rig.head['chest'])
        M, D = rig.solve(L, root_t)
        ov = {}
        arm_ik(M, D, ov, 'R', T, POLE_R(M0), blade=(GUARD_B + V((0, -0.15 * swing, 0))).normalized())
        return rig.solve(L, root_t, ov)
    keyframes('walk', int(round(WALK_T * FPS)), walk_pose)

    # ---------------------------------------------------------------- attack_slash (0.6 s)
    # Wind-up out to her right and BACK (blade up behind the line of her face, so it never crosses
    # the face from any side or the 48 deg camera), then a wide descending sweep round her right
    # side to the front and across to her left, kept below the chin while the blade is in front.
    ATK_T = 0.6
    A_T = [(0.00, GUARD_T), (0.07, V((-0.40, -0.14, 0.72))), (0.15, V((-0.37, 0.05, 0.82))),
           (0.20, V((-0.38, -0.12, 0.80))), (0.24, V((-0.20, -0.38, 0.72))), (0.28, V((0.02, -0.40, 0.64))),
           (0.34, V((0.12, -0.32, 0.60))), (0.42, V((0.11, -0.31, 0.59))), (0.60, GUARD_T)]
    A_B = [(0.00, GUARD_B), (0.07, V((-0.88, 0.10, 0.46))), (0.15, V((-0.42, 0.80, 0.42))),
           (0.20, V((-0.92, -0.05, 0.10))), (0.24, V((-0.45, -0.85, -0.12))), (0.28, V((0.50, -0.80, -0.30))),
           (0.34, V((0.92, -0.22, -0.32))), (0.42, V((0.88, -0.27, -0.38))), (0.60, GUARD_B)]
    A_YAW = [(0.0, 0.0), (0.15, -18.0), (0.30, 24.0), (0.42, 18.0), (0.60, 0.0)]
    A_LEAN = [(0.0, 0.0), (0.15, -3.0), (0.27, 8.0), (0.40, 6.0), (0.60, 0.0)]
    A_DIP = [(0.0, 0.0), (0.15, 0.006), (0.27, -0.022), (0.42, -0.016), (0.60, 0.0)]
    A_TL = [(0.00, None), (0.15, V((0.27, -0.33, 0.72))), (0.27, V((0.37, -0.02, 0.63))), (0.45, V((0.36, -0.06, 0.62))), (0.60, None)]
    def attack_pose(t):
        Lr, rt = raw_at(raw_idle, 0.0, TORSO + ARM_L)
        L = dict(Lr); L['root'] = Quaternion()
        L['upper_arm_L'] = ARM_L_ABDUCT @ L['upper_arm_L']
        yaw = scalar_keys(A_YAW, t); fl = scalar_keys(A_LEAN, t)
        L['spine'] = E(z=yaw * 0.35, x=fl * 0.5) @ L['spine']
        L['chest'] = E(z=yaw * 0.65, x=fl * 0.5) @ L['chest']
        L['neck'] = E(z=-yaw * 0.55, x=-fl * 0.6) @ L['neck']
        root_t = V((0, 0, scalar_keys(A_DIP, t)))
        grip(L); lean(L); hair(L, t, amp=1.3, speed=1 / ATK_T, phase=1.0, sway=-fl * 0.6)
        M0, D0 = rig.solve(L, root_t)
        off = M0['chest'].translation - rig.head['chest']
        T = catmull(A_T, t) + off * 0.8
        B = catmull(A_B, t).normalized()
        arms = {'R': dict(T=T, pole=POLE_R(M0) + V((0, 0, 0.12 if 0.1 < t < 0.3 else 0)), blade=B)}
        # left arm counter-balance (IK only inside the swing; FK idle pose at both ends)
        w = 0.0 if t <= 0.05 or t >= 0.58 else smooth(min((t - 0.05) / 0.08, (0.58 - t) / 0.14, 1.0))
        if w > 0:
            M1, D1 = pose(L, root_t, arms=arms)
            rest_hand = M1['wrist_L'].translation
            tl = [(k, v if v is not None else rest_hand) for k, v in A_TL]
            TL = rest_hand.lerp(catmull(tl, t) + off * 0.8, w)
            arms['L'] = dict(T=TL, pole=POLE_L(M0))
        return pose(L, root_t, arms=arms)
    keyframes('attack_slash', int(round(ATK_T * FPS)), attack_pose, loop=False)

    # ---------------------------------------------------------------- cheer (1.2 s loop: pump + hop)
    CH_T = 1.2
    C_Z = [(0.0, 0.0), (0.22, -0.026), (0.48, 0.052), (0.66, 0.052), (0.86, -0.022), (1.2, 0.0)]
    def cheer_pose(t):
        u = (t / CH_T) % 1.0
        Lr, rt = raw_at(raw_idle, 0.0, TORSO)
        L = dict(Lr); L['root'] = Quaternion()
        z = scalar_keys(C_Z, t)
        air = max(0.0, z)
        root_t = V((0, 0, z))
        pump = 0.5 - 0.5 * math.cos(2 * math.pi * u)        # 0 at loop ends, 1 mid-hop
        L['chest'] = E(x=-4.0 - 2.0 * pump) @ L['chest']
        L['neck'] = E(x=-3.0 * pump, y=5.0 * math.sin(2 * math.pi * u)) @ L['neck']
        grip(L); lean(L); hair(L, t, amp=2.2, speed=1 / CH_T, phase=2.0, sway=-6 * pump)
        M0, D0 = rig.solve(L, root_t)
        off = M0['chest'].translation - rig.head['chest']
        lift = 0.05 * pump
        TR = V((-0.36, -0.25, 0.98 + lift)) + off
        TL = V((0.36, -0.25, 0.98 + lift)) + off
        BR = V((-0.55, -0.12, 1.0)).normalized()
        return pose(L, root_t, arms={'R': dict(T=TR, pole=TR + V((-0.3, 0.35, -0.5)), blade=BR),
                                     'L': dict(T=TL, pole=TL + V((0.3, 0.35, -0.5)))},
                    foot_lift=(air, air))
    keyframes('cheer', int(CH_T * FPS), cheer_pose)

    # ---------------------------------------------------------------- hurt (0.4 s flinch)
    HURT_T = 0.4
    def hurt_pose(t):
        k = smooth(t / 0.07) if t < 0.07 else 1.0 - smooth((t - 0.07) / (HURT_T - 0.07))
        Lr, rt = raw_at(raw_idle, 0.0, TORSO + ARM_L)
        L = dict(Lr); L['root'] = Quaternion()
        L['upper_arm_L'] = E(y=-9.0 - 22.0 * k) @ L['upper_arm_L']
        L['spine'] = E(x=-6.0 * k, z=5.0 * k) @ L['spine']
        L['chest'] = E(x=-8.0 * k) @ L['chest']
        L['neck'] = E(x=-6.0 * k, y=7.0 * k) @ L['neck']
        root_t = V((0, 0.022 * k, -0.012 * k))
        grip(L); lean(L); hair(L, t, amp=1.0 + 2.0 * k, speed=1 / HURT_T, phase=0.5)
        M0, D0 = rig.solve(L, root_t)
        off = M0['chest'].translation - rig.head['chest']
        T = GUARD_T.lerp(V((-0.36, -0.20, 0.70)), k) + off * 0.7
        B = GUARD_B.lerp(V((0.2, -0.6, -0.8)), k).normalized()
        return pose(L, root_t, arms={'R': dict(T=T, pole=POLE_R(M0), blade=B)})
    keyframes('hurt', int(round(HURT_T * FPS)), hurt_pose, loop=False)


    for a in [a for a in bpy.data.actions if a.name.startswith('raw_')]:
        bpy.data.actions.remove(a)
    arm.animation_data.action = None
    return sw
