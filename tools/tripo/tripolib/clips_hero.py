"""Lively game clips for the Tripo heroes (Luna, Nami, Kanna, Yoriko re-rigged by tripolib/rerig.py; Kogane and
Norika on Tripo's own rig).

The shipped batch-2 clips swung the arms 3 degrees in idle on rigs whose arms did not deform: the figures stood
still in a T-pose. These clips are authored for a figure that rests in a T-pose with its hands at the arm line:
  * the free arm hangs down (`free_down` degrees from the T) with a soft elbow and swings a little;
  * the arm that holds a prop (a staff, a trident, a control bar) is placed by two-bone IK: its hand goes to a
    grip point (an offset from the shoulder joint, carried by the chest) and the hand keeps the prop upright
    (the hand's world rotation is the chest's, plus a small tilt), so a staff stays planted beside her instead
    of swinging into the ground;
  * idle breathes and sways (chest, head tilt and nod on offset phases), the free arm and the tail follow late;
  * walk, cheer, hurt and the attack move the whole figure; the attack per style:
      staff   raise the staff overhead and bring it down toward the road (Luna's moonbeam cast)
      thrust  lean in and jab the prop forward (Nami's trident)
      smash   both arms up and down on the drum (Kanna)
      control flick the control bar up and forward, the free hand points (Yoriko)
      swing   the wrench wound up and brought down in front (Kogane), raise: the STOP paddle up and out (Norika)
World-axis rotations on top of the rest pose (tools/meshy/lib/posekit.py): x > 0 tips an up-pointing bone forward,
y > 0 rolls toward her left (lowers her left arm from the T), z > 0 turns her to her left. In place (no root
motion) at 30 fps; lengths fit tests/models/glb.test.js (idle 1.5, walk 1.0, attack 0.6, cheer 1.2, hurt 0.4 s)."""
import math

import bpy
from mathutils import Quaternion, Vector

from .meshy import posekit
from .compat import linear

E, smooth, two_bone = posekit.E, posekit.smooth, posekit.two_bone

FPS = 30
TAU = 2 * math.pi


def _q(*eulers):
    """Composes world-axis rotations, first argument applied first."""
    q = Quaternion()
    for e in eulers:
        q = E(*e) @ q
    return q


class HeroClips:
    """style: dict(prop=None|'L'|'R', grip=(x, y, z) offset of the prop hand from its shoulder joint (her side's
    sign is applied to x), pole=(x, y, z) elbow hint offset, hand=(x, y, z) hand tilt (degrees, world axes),
    free_down=degrees (both arms, from the rest arms), shoulder_down=degrees (clavicles too, for a rig whose clavicles
    carry the top of the sleeve), chin=degrees (negative = chin up, for the 48-degree battle camera),
    attack='staff'|'thrust'|'smash'|'control'|'swing'|'raise', sway=idle sway scale)."""

    def __init__(self, arm, style):
        self.arm = arm
        self.rig = posekit.Rig(arm)
        self.s = dict(prop=None, grip=(0.1, -0.1, -0.02), pole=(0.0, 0.05, -0.15), hand=(0, 0, 0), free_down=72.0,
                      shoulder_down=0.0, chin=-6.0, attack='staff', tail=False, sway=1.0)
        self.s.update(style)
        bones = arm.data.bones
        self.tails = [b.name for b in bones if b.name.startswith('tail_')]
        self.hair = [b.name for b in bones if b.name.startswith('hair_')]
        self.len = {}
        for side in ('L', 'R'):
            ua, fa, hd = (bones[f'{p}_{side}'] for p in ('upper_arm', 'forearm', 'hand'))
            self.len[side] = ((ua.tail_local - ua.head_local).length, (hd.head_local - fa.head_local).length)

    # ---- pose building ---------------------------------------------------------------------------------------
    def pose(self, spine=(0, 0, 0), chest=(0, 0, 0), neck=(0, 0, 0), head=(0, 0, 0), arm=None, fore=None, hand=None,
             thigh_l=(0, 0, 0), thigh_r=(0, 0, 0), shin_l=(0, 0, 0), shin_r=(0, 0, 0), foot_l=(0, 0, 0),
             foot_r=(0, 0, 0), tail=(0, 0, 0), hair=(0, 0, 0), lift=0.0, grip=None, hand_tilt=None):
        """arm / fore / hand: {'L': [eulers...], 'R': [...]} on top of the hang (the prop arm ignores them and uses
        `grip` (offset from its rest grip, chest frame) and `hand_tilt` instead). Returns (L, root_t, prop_ik)."""
        arm, fore, hand = arm or {}, fore or {}, hand or {}
        down = self.s['free_down']
        L = {'spine': _q(spine), 'chest': _q(chest), 'neck': _q(neck), 'head': _q((self.s['chin'], 0, 0), head),
             'thigh_L': _q(thigh_l), 'thigh_R': _q(thigh_r), 'shin_L': _q(shin_l), 'shin_R': _q(shin_r),
             'foot_L': _q(foot_l), 'foot_R': _q(foot_r)}
        sd = self.s['shoulder_down']
        if sd:
            # a rig whose clavicles carry the top of the sleeve (Tripo's own): drop them too, so the arm hangs
            L['shoulder_L'] = _q((0, sd, 0))
            L['shoulder_R'] = _q((0, -sd, 0))
        for side, k in (('L', 1), ('R', -1)):
            # hang: down from the T, a little forward, soft elbow bent forward
            L[f'upper_arm_{side}'] = _q((0, k * down, 0), (-6, 0, 0), *arm.get(side, []))
            L[f'forearm_{side}'] = _q((-14, 0, 0), *fore.get(side, []))
            L[f'hand_{side}'] = _q(*hand.get(side, [])) if hand.get(side) else Quaternion()
        for i, n in enumerate(self.tails):
            # each segment adds a little more of the same bend, so the tail curls (gently: a big fox tail folds
            # onto itself into a ball when three segments each bend 20 degrees and more)
            L[n] = _q(tuple(v * (1.0 + 0.15 * i) for v in tail))
        for n in self.hair:
            # twin tails: the same sway on both, a little more down the chain (x: back / forth, y: side)
            i = int(n.rsplit('_', 1)[1]) - 1
            L[n] = _q(tuple(v * (0.6 + 0.4 * i) for v in hair))
        ik = None
        if self.s['prop']:
            side = self.s['prop']
            k = 1 if side == 'L' else -1
            g = Vector(self.s['grip']) + Vector(grip or (0, 0, 0))
            g.x *= k
            p = Vector(self.s['pole'])
            p.x *= k
            ik = (side, g, p, _q(self.s['hand'], *(hand_tilt or [])))
        return L, Vector((0, 0, lift)), ik

    def _solve(self, L, t, ik, override=None):
        override = dict(override or {})
        M, D = self.rig.solve(L, root_t=t, override=override)
        if not ik:
            return M
        side, g, pole, tilt = ik
        ua, fa, hd = f'upper_arm_{side}', f'forearm_{side}', f'hand_{side}'
        S = M[ua].translation.copy()
        Dc = D['chest']
        T = S + Dc @ g
        l1, l2 = self.len[side]
        elbow, Tc = two_bone(S, l1, l2, T, S + Dc @ pole)
        R = self.rig.R
        rest_u = (R[fa].translation - R[ua].translation).normalized()
        rest_f = (R[hd].translation - R[fa].translation).normalized()
        qu = rest_u.rotation_difference((elbow - S).normalized())
        qf = rest_f.rotation_difference((Tc - elbow).normalized())
        override.update({ua: qu, fa: qf, hd: Dc @ tilt})
        M, _ = self.rig.solve(L, root_t=t, override=override)
        return M

    def _clip(self, name, frames, fn):
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        if not self.arm.animation_data:
            self.arm.animation_data_create()
        self.arm.animation_data.action = act
        for f in range(frames + 1):
            L, t, ik = fn(f / frames)
            self.rig.key(self._solve(L, t, ik), f)
        linear(act)
        return act

    # ---- clips -----------------------------------------------------------------------------------------------
    def idle(self):
        sw = self.s['sway']

        def f(t):
            p = TAU * t
            breath = (1 - math.cos(p)) / 2           # 0..1..0 once per loop
            s1, s2 = math.sin(p), math.sin(p + 1.2)
            return self.pose(
                spine=(1.0 * s1, 2.5 * sw * math.sin(p + 0.4), 3 * sw * s1), chest=(-2.5 * breath, 0, 0),
                head=(-2 * breath, 5 * sw * s2, -3 * sw * s1),
                arm={'L': [(6 * s2, -5 * breath, 0)], 'R': [(-6 * s2, 5 * breath, 0)]},
                fore={'L': [(-8 * breath, 0, 0)], 'R': [(-8 * breath, 0, 0)]},
                tail=(3 * math.sin(p + 0.5), 0, 8 * math.sin(p + 0.8)), hair=(3 * math.sin(p + 1.6), 3 * sw * math.sin(p + 2.0), 0),
                grip=(0, 0, 0.012 * breath), hand_tilt=[(0, 3 * s1, 0)], lift=0.006 * breath)
        return self._clip('idle', 45, f)

    def walk(self):
        def f(t):
            p = TAU * t
            s, c = math.sin(p), math.cos(p)
            return self.pose(
                spine=(5, 0, 6 * s), chest=(0, 2 * s, 0), head=(-3, 2 * math.sin(2 * p), -5 * s),
                arm={'L': [(28 * s, 0, 0)], 'R': [(-28 * s, 0, 0)]}, fore={'L': [(-14, 0, 0)], 'R': [(-14, 0, 0)]},
                thigh_l=(-28 * s, 0, 0), thigh_r=(28 * s, 0, 0),
                shin_l=(34 * max(0.0, c), 0, 0), shin_r=(34 * max(0.0, -c), 0, 0),
                tail=(4 * math.sin(2 * p), 0, 9 * math.sin(p + 0.6)), hair=(6 * math.sin(2 * p + 1.0), 4 * math.sin(p + 1.2), 0),
                grip=(0, -0.02 * s, 0.015 * abs(s)), hand_tilt=[(6 * s, 0, 0)],
                lift=0.02 * abs(math.sin(p)))
        return self._clip('walk', 30, f)

    def attack(self, name):
        style = self.s['attack']

        def f(t):
            wind = smooth(t / 0.3)                   # wind-up
            hit = smooth((t - 0.3) / 0.15)           # strike
            back = smooth((t - 0.55) / 0.45)         # recover
            k = wind * (1 - back)
            h = hit * (1 - back)
            if style == 'staff':
                # staff high overhead, then swept down and forward at the road; the free hand flings out
                return self.pose(spine=(-8 * wind + 12 * h, 0, 10 * k), chest=(-5 * wind + 5 * h, 0, 0),
                                 head=(-8 * wind + 2 * h, 0, 5 * k),
                                 arm={'L': [(0, -45 * k, 0), (-30 * k, 0, 0)]}, fore={'L': [(-25 * k, 0, 0)]},
                                 grip=(-0.03 * k, -0.05 * k - 0.1 * h, 0.3 * wind - 0.16 * h),
                                 hand_tilt=[(35 * h, 0, 0), (0, -10 * k, 0)],
                                 tail=(6 * k, 0, 9 * h), lift=0.04 * (wind - h) * (1 - back))
            if style == 'thrust':
                # draw the trident back and up, then jab it forward at the road
                return self.pose(spine=(-5 * wind + 12 * h, 0, -10 * k), chest=(0, 0, -6 * k + 4 * h),
                                 head=(-4 * wind + 2 * h, 0, -4 * k),
                                 arm={'L': [(-20 * k, 0, 0)], 'R': [(-20 * k, 0, 0)]},
                                 grip=(0.0, 0.06 * wind - 0.2 * h, 0.06 * wind + 0.02 * h), hand_tilt=[(-15 * wind + 75 * h, 0, 0)],
                                 thigh_l=(-12 * h, 0, 0), thigh_r=(8 * h, 0, 0), lift=0.01 * h)
            if style == 'smash':
                # both arms up, then down on the drum
                a = -150 * wind + 120 * h
                return self.pose(spine=(-8 * wind + 12 * h, 0, 0), chest=(-4 * wind + 4 * h, 0, 0),
                                 head=(-6 * wind + 2 * h, 0, 0),
                                 arm={'L': [(a * (1 - back), 0, 0)], 'R': [(a * (1 - back), 0, 0)]},
                                 fore={'L': [(-30 * k, 0, 0)], 'R': [(-30 * k, 0, 0)]}, hair=(8 * wind - 14 * h, 0, 0),
                                 lift=0.03 * wind * (1 - h))
            if style == 'raise':
                # Norika: the STOP paddle raised and pushed out at the road (batch-1 clip, from the hang)
                up = smooth(t / 0.3) * (1 - smooth((t - 0.7) / 0.3))
                push = math.sin(math.pi * min(1.0, max(0.0, (t - 0.2) / 0.45)))
                return self.pose(spine=(-4 * up + 6 * push, 0, 10 * up), head=(-4 * up, 0, 6 * up),
                                 arm={'R': [(-105 * up - 15 * push, 0, 0)], 'L': [(0, -10 * up, 0)]},
                                 fore={'R': [(16 * up - 15 * push, 0, 0)]}, lift=0.01 * push)
            if style == 'swing':
                # Kogane: the wrench wound up and back, brought down in front, recover (batch-1 clip, from the hang)
                if t < 0.3:
                    q = smooth(t / 0.3)
                    a, sp, fo = -150 * q, -8 * q, -30 * q
                elif t < 0.5:
                    q = smooth((t - 0.3) / 0.2)
                    a, sp, fo = -150 + 120 * q, -8 + 18 * q, -30 + 25 * q
                else:
                    q = smooth((t - 0.5) / 0.5)
                    a, sp, fo = -30 * (1 - q), 10 * (1 - q), -5 * (1 - q)
                return self.pose(spine=(sp, 0, -8 * (a / -150)), head=(-sp * 0.5, 0, 0), arm={'R': [(a, 0, 0)], 'L': [(15 * (a / -150), 0, 0)]},
                                 fore={'R': [(fo, 0, 0)]})
            # control: flick the bar up and forward, the free hand points at the road
            return self.pose(spine=(-4 * wind + 7 * h, 0, 10 * k), chest=(0, 0, 4 * k), head=(-5 * wind, 0, 6 * k),
                             arm={'R': [(-70 * k, 0, 0), (0, -30 * k, 0)]}, fore={'R': [(20 * k, 0, 0)]},
                             grip=(0.0, -0.05 * k - 0.05 * h, 0.12 * wind - 0.08 * h), hand_tilt=[(-30 * h + 20 * wind * (1 - h), 0, 0)],
                             lift=0.015 * h)
        return self._clip(name, 18, f)

    def cheer(self):
        def f(t):
            hop = max(0.0, math.sin(TAU * t))
            up = smooth(t / 0.2) * (1 - smooth((t - 0.85) / 0.15))
            wave = 12 * math.sin(2 * TAU * t)
            # the free arms swing up in front of her (about X, from the hang) and wave a little outward overhead:
            # a raise out to the sides would pass through the T-pose the figure rests in
            return self.pose(spine=(-5 * up, 0, 6 * math.sin(TAU * t)), head=(-10 * up, 6 * math.sin(TAU * t), 0),
                             arm={'L': [(-125 * up, 0, 0), (0, -(12 + wave) * up, 0)],
                                  'R': [(-125 * up, 0, 0), (0, (12 + wave) * up, 0)]},
                             fore={'L': [(-20 * up, 0, 0)], 'R': [(-20 * up, 0, 0)]},
                             shin_l=(14 * hop, 0, 0), shin_r=(14 * hop, 0, 0), tail=(5 * up, 0, 9 * math.sin(2 * TAU * t)),
                             hair=(-10 * hop, 6 * math.sin(2 * TAU * t), 0),
                             grip=(0.0, -0.03 * up, 0.16 * up + 0.03 * hop), hand_tilt=[(0, 10 * math.sin(2 * TAU * t), 0)],
                             lift=0.06 * hop)
        return self._clip('cheer', 36, f)

    def hurt(self):
        def f(t):
            k = math.sin(math.pi * min(1.0, t / 0.9))
            return self.pose(spine=(-14 * k, 0, 0), chest=(-6 * k, 0, 0), head=(-12 * k, 8 * k, 0),
                             arm={'L': [(0, -22 * k, 0), (-10 * k, 0, 0)], 'R': [(0, 22 * k, 0), (-10 * k, 0, 0)]},
                             fore={'L': [(-20 * k, 0, 0)], 'R': [(-20 * k, 0, 0)]}, tail=(-7 * k, 0, 0), hair=(10 * k, 0, 0),
                             grip=(0.0, 0.03 * k, 0.02 * k), hand_tilt=[(12 * k, 0, 0)])
        return self._clip('hurt', 12, f)

    def stock(self, name, frames, src_hip, seconds):
        """A clip from sampled stock motion (tripolib/retarget_ual.py: per frame, world deltas from a T-pose and the
        pelvis offset), resampled to `seconds`: the mapped bones take the deltas as absolute overrides (the head
        keeps her chin-up), the pelvis offset is scaled to her hips, the prop arm keeps its IK grip."""
        n = max(2, int(round(seconds * FPS)))
        hip = self.rig.head['hips'].z
        k = hip / max(src_hip, 1e-6)
        side = self.s['prop']
        skip = {f'{p}_{side}' for p in ('upper_arm', 'forearm', 'hand')} if side else set()
        chin = _q((self.s['chin'], 0, 0))
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        if not self.arm.animation_data:
            self.arm.animation_data_create()
        self.arm.animation_data.action = act
        for f in range(n + 1):
            x = f / n * (len(frames) - 1)
            i = min(int(x), len(frames) - 2)
            a = x - i
            (d0, o0), (d1, o1) = frames[i], frames[i + 1]
            ov = {b: d0[b].slerp(d1[b], a) for b in d0 if b in self.rig.R and b not in skip}
            if 'head' in ov:
                ov['head'] = ov['head'] @ chin
            off = o0.lerp(o1, a) * k
            L, _, ik = self.pose()
            self.rig.key(self._solve(L, Vector((off.x, off.y, off.z)), ik, override=ov), f)
        linear(act)
        return act

    def build(self, attack_name):
        acts = [self.idle(), self.walk(), self.attack(attack_name), self.cheer(), self.hurt()]
        self.arm.animation_data.action = None
        for pb in self.arm.pose.bones:
            pb.rotation_mode = 'QUATERNION'
            pb.rotation_quaternion = (1, 0, 0, 0)
            pb.location = (0, 0, 0)
        return acts
