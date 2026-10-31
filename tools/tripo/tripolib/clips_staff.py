"""Game clips for the Tripo staff heroes (Kogane, Norika) on Tripo's biped rig after renaming.

Authored with tools/meshy/lib/posekit.py: every pose is world-axis rotations on top of the rest
pose (figure facing -Y, Z up, her left +X). Sign rules for world-axis deltas (E(x, y, z) degrees):
  x > 0 tips an up-pointing bone forward (spine, head nod) and swings a down-pointing one back
  y > 0 tips an up-pointing bone to her left; lowers her left arm from the T/A rest, raises the right
  z > 0 turns her to her left
Tripo rests the arms near a T-pose, so every clip starts from ARMS_DOWN. Clips are in place (no root
motion) at 30 fps; lengths match tests/models/glb.test.js (idle 1.5, walk 1.0, attack 0.6, cheer 1.2,
hurt 0.4 s)."""
import math

import bpy
from mathutils import Quaternion, Vector

from .meshy import posekit

Rig, E, smooth = posekit.Rig, posekit.E, posekit.smooth

FPS = 30
TAU = 2 * math.pi


def _q(*eulers):
    """Composes world-axis rotations, first argument applied first."""
    q = Quaternion()
    for e in eulers:
        q = E(*e) @ q
    return q


class Clips:
    def __init__(self, arm, arms_down=38.0, chin=-8.0, height=1.0, attack='swing'):
        self.arm = arm
        self.rig = Rig(arm)
        self.down = arms_down
        self.chin = chin
        self.h = height
        self.attack = attack

    def pose(self, spine=(0, 0, 0), chest=(0, 0, 0), head=(0, 0, 0), arm_l=(), arm_r=(), fore_l=(0, 0, 0),
             fore_r=(0, 0, 0), thigh_l=(0, 0, 0), thigh_r=(0, 0, 0), shin_l=(0, 0, 0), shin_r=(0, 0, 0),
             foot_l=(0, 0, 0), foot_r=(0, 0, 0), lift=0.0, shift=(0.0, 0.0)):
        L = {
            'spine': _q(spine), 'chest': _q(chest), 'head': _q((self.chin, 0, 0), head),
            'upper_arm_L': _q((0, self.down, 0), *arm_l), 'upper_arm_R': _q((0, -self.down, 0), *arm_r),
            'forearm_L': _q(fore_l), 'forearm_R': _q(fore_r),
            'thigh_L': _q(thigh_l), 'thigh_R': _q(thigh_r), 'shin_L': _q(shin_l), 'shin_R': _q(shin_r),
            'foot_L': _q(foot_l), 'foot_R': _q(foot_r),
        }
        return L, Vector((shift[0] * self.h, shift[1] * self.h, lift * self.h))

    def _clip(self, name, frames, fn):
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        if not self.arm.animation_data:
            self.arm.animation_data_create()
        self.arm.animation_data.action = act
        for f in range(frames + 1):
            L, t = fn(f / frames)
            M, _ = self.rig.solve(L, root_t=t)
            self.rig.key(M, f)
        for fc in act.fcurves:
            for k in fc.keyframe_points:
                k.interpolation = 'LINEAR'
        return act

    def idle(self):
        def f(t):
            s = math.sin(TAU * t)
            return self.pose(spine=(1.5 * s, 0, 0), head=(-2 * math.sin(TAU * t + 0.6), 1.2 * s, 0),
                             arm_l=[(0, 3 * s, 0)], arm_r=[(0, -3 * s, 0)], lift=0.004 * (1 - math.cos(TAU * t)) / 2)
        return self._clip('idle', 45, f)

    def walk(self):
        def f(t):
            p = TAU * t
            s, c = math.sin(p), math.cos(p)
            return self.pose(
                spine=(4, 0, 5 * s), head=(-2, 0, -4 * s),
                arm_l=[(22 * s, 0, 0)], arm_r=[(-22 * s, 0, 0)], fore_l=(-12, 0, 0), fore_r=(-12, 0, 0),
                thigh_l=(-26 * s, 0, 0), thigh_r=(26 * s, 0, 0),
                shin_l=(30 * max(0.0, c), 0, 0), shin_r=(30 * max(0.0, -c), 0, 0),
                lift=0.014 * abs(math.sin(p)))
        return self._clip('walk', 30, f)

    def attack_clip(self, name):
        def f(t):
            if self.attack == 'raise':  # Norika: the STOP paddle raised and pushed out at the road
                up = smooth(t / 0.3) * (1 - smooth((t - 0.7) / 0.3))
                push = math.sin(math.pi * min(1.0, max(0.0, (t - 0.2) / 0.45)))
                return self.pose(spine=(-4 * up + 6 * push, 0, 10 * up), head=(-4 * up, 0, 6 * up),
                                 arm_r=[(-95 * up - 15 * push, 0, 0)], fore_r=(-20 * up + 15 * push, 0, 0),
                                 arm_l=[(0, -18 * up, 0)], lift=0.01 * push)
            # Kogane: wind the wrench up and back, bring it down in front, recover
            if t < 0.3:
                k = smooth(t / 0.3)
                a, sp, fo = -150 * k, -8 * k, -30 * k
            elif t < 0.5:
                k = smooth((t - 0.3) / 0.2)
                a, sp, fo = -150 + 120 * k, -8 + 18 * k, -30 + 25 * k
            else:
                k = smooth((t - 0.5) / 0.5)
                a, sp, fo = -30 * (1 - k), 10 * (1 - k), -5 * (1 - k)
            return self.pose(spine=(sp, 0, -8 * (a / -150)), head=(-sp * 0.5, 0, 0), arm_r=[(a, 0, 0)],
                             fore_r=(fo, 0, 0), arm_l=[(15 * (a / -150), 0, 0)])
        return self._clip(name, 18, f)

    def cheer(self):
        def f(t):
            hop = max(0.0, math.sin(TAU * t)) if t < 1.0 else 0.0
            up = smooth(t / 0.2) * (1 - smooth((t - 0.85) / 0.15))
            wave = 14 * math.sin(2 * TAU * t)
            return self.pose(spine=(-4 * up, 0, 0), head=(-8 * up, 5 * math.sin(TAU * t), 0),
                             arm_l=[(0, -(self.down + 55) * up + wave * up, 0), (-20 * up, 0, 0)],
                             arm_r=[(0, (self.down + 55) * up + wave * up, 0), (-20 * up, 0, 0)],
                             fore_l=(0, -30 * up, 0), fore_r=(0, 30 * up, 0),
                             shin_l=(10 * hop, 0, 0), shin_r=(10 * hop, 0, 0), lift=0.05 * hop)
        return self._clip('cheer', 36, f)

    def hurt(self):
        def f(t):
            k = math.sin(math.pi * min(1.0, t / 0.9))
            return self.pose(spine=(-12 * k, 0, 0), chest=(-6 * k, 0, 0), head=(-10 * k, 6 * k, 0),
                             arm_l=[(0, -20 * k, 0)], arm_r=[(0, 20 * k, 0)], shift=(0, 0.012 * k))
        return self._clip('hurt', 12, f)

    def build(self, attack_name):
        acts = [self.idle(), self.walk(), self.attack_clip(attack_name), self.cheer(), self.hurt()]
        self.arm.animation_data.action = None
        for pb in self.arm.pose.bones:
            pb.rotation_mode = 'QUATERNION'
            pb.rotation_quaternion = (1, 0, 0, 0)
            pb.location = (0, 0, 0)
        return acts
