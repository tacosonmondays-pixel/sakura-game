"""Actions authored as a handful of keyframes (24 fps, bezier interpolation -> exported as
cubic splines, so clips stay tiny). Poses are written in armature space (world axes) and
converted to each bone's local space.

Clips: idle (personality per expression + halo float), walk, attack_<kind> with
anticipation -> strike -> recovery, cheer, victory, hurt, pickup (wriggle).
"""
import math
import bpy
from mathutils import Vector, Quaternion, Euler

from .rig import world_rot_to_local

FPS = 24
D = math.radians


class Poser:
    def __init__(self, arm_obj, loc_scale=1.0):
        self.arm = arm_obj
        self.loc_scale = loc_scale
        self.names = [b.name for b in arm_obj.data.bones]
        self.ad = arm_obj.animation_data or arm_obj.animation_data_create()
        self.action = None

    def begin(self, name, loop=True):
        self.action = bpy.data.actions.new(name)
        self.action.use_fake_user = True
        self.ad.action = self.action
        self.loop = loop
        self.touched = set()
        return self.action

    def key(self, frame, pose, loc=None, scale=None):
        """pose: {bone: (rx, ry, rz) degrees about world X (pitch: + = nod forward),
        Y (roll), Z (yaw)} applied in Z, X, Y order. loc: {bone: (x, y, z)} offsets in
        armature space (root/hips/halo). scale: {bone: s}."""
        used = set(pose.keys()) | set((loc or {}).keys()) | set((scale or {}).keys())
        for name in self.names:
            pb = self.arm.pose.bones.get(name)
            if pb is None:
                continue
            r = pose.get(name)
            if r is not None or name in self.touched:
                rx, ry, rz = r if r is not None else (0, 0, 0)
                q = Euler((D(rx), D(ry), D(rz)), 'ZXY').to_quaternion()
                pb.rotation_quaternion = world_rot_to_local(self.arm, name, q)
                pb.keyframe_insert('rotation_quaternion', frame=frame)
            l = (loc or {}).get(name)
            if l is not None or (name in self.touched and name in self._loc_bones):
                v = Vector(l) * self.loc_scale if l is not None else Vector((0, 0, 0))
                bone = self.arm.data.bones[name]
                M = bone.matrix_local.to_3x3().inverted()
                pb.location = M @ v
                pb.keyframe_insert('location', frame=frame)
                self._loc_bones.add(name)
            s = (scale or {}).get(name)
            if s is not None or (name in self.touched and name in self._scale_bones):
                sv = s if s is not None else 1.0
                pb.scale = (sv, sv, sv) if not isinstance(sv, (tuple, list)) else sv
                pb.keyframe_insert('scale', frame=frame)
                self._scale_bones.add(name)
        self.touched |= used

    _loc_bones = set()
    _scale_bones = set()

    def end(self, last_frame):
        self.action.frame_range = (0, last_frame)
        for fc in self.action.fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = 'BEZIER'
                kp.handle_left_type = 'AUTO_CLAMPED'
                kp.handle_right_type = 'AUTO_CLAMPED'
            if self.loop:
                fc.modifiers.new('CYCLES')
        # stash into an NLA track so the exporter sees every action
        track = self.ad.nla_tracks.new()
        track.name = self.action.name
        track.strips.new(self.action.name, 0, self.action)
        self.ad.action = None
        self._loc_bones = set()
        self._scale_bones = set()
        self.touched = set()
        return self.action


# ---------------------------------------------------------------------------

def rest_hold(poser, weapon_kind):
    """Weapon-ready stance mixed into idle/attack (degrees)."""
    if weapon_kind == 'bow':
        return {'upper_arm_L': (-70, 0, 20), 'forearm_L': (-10, 0, 0), 'upper_arm_R': (-60, 0, -10), 'forearm_R': (-40, 0, -30)}
    if weapon_kind in ('rifle', 'cannon'):
        return {'upper_arm_R': (-55, 0, 10), 'forearm_R': (-25, 0, 0), 'upper_arm_L': (-70, 0, -35), 'forearm_L': (-20, 0, -20), 'head': (0, 0, -6)}
    if weapon_kind == 'cast':
        return {'upper_arm_R': (-12, 0, 0), 'forearm_R': (-20, 0, 0)}
    if weapon_kind in ('slash', 'thrust'):
        return {'upper_arm_R': (-8, 0, 6), 'forearm_R': (-10, 0, 0)}
    return {}


def merge(*poses):
    out = {}
    for p in poses:
        for k, v in p.items():
            a = out.get(k, (0, 0, 0))
            out[k] = (a[0] + v[0], a[1] + v[1], a[2] + v[2])
    return out


def build_all(arm_obj, ctx, loc_scale=1.0):
    poser = Poser(arm_obj, loc_scale=loc_scale)
    kind = ctx['weapon_kind']
    expr = ctx['look'].get('expression', 'smile')
    hold = rest_hold(poser, kind)
    has_tails = {b.name for b in arm_obj.data.bones}
    tails = [b for b in ('tail_L', 'tail_R', 'hair_back') if b in has_tails]
    idle(poser, hold, expr, tails)
    walk(poser, hold, tails)
    ATTACKS.get(kind, attack_cast)(poser, hold, tails)
    cheer(poser, tails)
    victory(poser, kind, tails)
    hurt(poser, tails)
    pickup(poser, tails)
    bpy.context.scene.frame_set(0)
    for pb in arm_obj.pose.bones:
        pb.rotation_quaternion = Quaternion((1, 0, 0, 0))
        pb.location = Vector((0, 0, 0))
        pb.scale = Vector((1, 1, 1))
    return [a.name for a in bpy.data.actions]


def _tail_sway(tails, amt, phase=0.0):
    return {t: (amt * math.cos(phase), 0, amt * 0.5 * math.sin(phase)) for t in tails}


def idle(poser, hold, expr, tails):
    poser.begin('idle', loop=True)
    L = 72  # 3 s loop
    # personality presets
    if expr == 'cheerful':
        bob, sway, tilt = 0.012, 8, 6
    elif expr == 'smug':
        bob, sway, tilt = 0.004, 3, -8
    elif expr == 'shy':
        bob, sway, tilt = 0.004, 2, 6
    elif expr == 'determined':
        bob, sway, tilt = 0.006, 2, 0
    elif expr == 'calm':
        bob, sway, tilt = 0.005, 4, 3
    else:
        bob, sway, tilt = 0.007, 4, 4
    base = {'chest': (2, 0, 0), 'head': (2, 0, tilt), 'upper_arm_L': (0, 0, 6), 'upper_arm_R': (0, 0, -6)}
    if expr == 'smug':
        base = merge(base, {'upper_arm_L': (-20, 0, 40), 'forearm_L': (-60, 0, -40), 'hips': (0, 0, 0), 'spine': (0, 3, 0)})
    if expr == 'shy':
        base = merge(base, {'upper_arm_L': (-30, 0, -8), 'forearm_L': (-70, 0, -20), 'upper_arm_R': (-30, 0, 8), 'forearm_R': (-70, 0, 20), 'head': (6, 0, 0)})
    if expr == 'determined':
        base = merge(base, {'chest': (4, 0, 0), 'upper_arm_L': (-10, 0, 10)})
    for i, f in enumerate((0, L // 4, L // 2, 3 * L // 4, L)):
        ph = i / 4 * math.pi * 2
        p = merge(base, hold, {
            'chest': (1.5 * math.sin(ph), 0, 0),
            'spine': (0, 0, sway * 0.3 * math.sin(ph)),
            'head': (1.5 * math.sin(ph + 1), 0, 2 * math.sin(ph * 0.5)),
            'upper_arm_L': (0, 0, 2 * math.sin(ph)),
            'upper_arm_R': (0, 0, -2 * math.sin(ph)),
            'halo': (0, 0, 0),
        }, _tail_sway(tails, 3, ph))
        loc = {'hips': (0, 0, bob * math.sin(ph)), 'halo': (0, 0, 0.012 * math.sin(ph + 0.8))}
        scale = {'chest': 1.0 + 0.025 * math.sin(ph)}
        poser.key(f, p, loc=loc, scale=scale)
    poser.end(L)


def walk(poser, hold, tails):
    poser.begin('walk', loop=True)
    L = 20
    for i, f in enumerate((0, 5, 10, 15, 20)):
        ph = i / 4 * math.pi * 2
        s = math.sin(ph)
        c = math.cos(ph)
        p = merge({
            'thigh_L': (-38 * s, 0, 0), 'thigh_R': (38 * s, 0, 0),
            'shin_L': (max(0, 40 * -c), 0, 0), 'shin_R': (max(0, 40 * c), 0, 0),
            'upper_arm_L': (30 * s, 0, 8), 'upper_arm_R': (-30 * s, 0, -8),
            'chest': (6, 0, 0), 'head': (-3, 0, 0), 'spine': (0, 0, 4 * s),
        }, _tail_sway(tails, 6, ph + 1))
        loc = {'hips': (0, 0, 0.012 * abs(c)), 'halo': (0, 0, 0.006 * abs(c))}
        poser.key(f, p, loc=loc)
    poser.end(L)


def _attack(poser, name, frames, poses, locs, tails, hold):
    poser.begin(name, loop=False)
    for f, p, l in zip(frames, poses, locs):
        poser.key(f, merge(hold, p, _tail_sway(tails, 2)), loc=l)
    poser.end(frames[-1])


def attack_slash(poser, hold, tails):
    hold = {}
    frames = [0, 7, 11, 15, 24]
    poses = [
        {'upper_arm_R': (-8, 0, 6)},
        {'upper_arm_R': (-150, 0, 20), 'forearm_R': (-30, 0, 0), 'chest': (-4, 0, 30), 'head': (0, 0, 10), 'upper_arm_L': (-20, 0, 25)},
        {'upper_arm_R': (40, 0, -30), 'forearm_R': (0, 0, 0), 'chest': (10, 0, -35), 'head': (6, 0, -8), 'upper_arm_L': (20, 0, 20), 'thigh_L': (-25, 0, 0), 'thigh_R': (12, 0, 0)},
        {'upper_arm_R': (45, 0, -35), 'chest': (8, 0, -30), 'head': (4, 0, -6), 'thigh_L': (-20, 0, 0), 'thigh_R': (10, 0, 0)},
        {'upper_arm_R': (-8, 0, 6)},
    ]
    locs = [{'hips': (0, 0, 0)}, {'hips': (0, 0.02, 0.004)}, {'hips': (0, -0.05, -0.012)}, {'hips': (0, -0.04, -0.01)}, {'hips': (0, 0, 0)}]
    _attack(poser, 'attack_slash', frames, poses, locs, tails, hold)


def attack_thrust(poser, hold, tails):
    frames = [0, 7, 10, 14, 22]
    poses = [
        {'upper_arm_R': (-8, 0, 6)},
        {'upper_arm_R': (-40, 0, 30), 'forearm_R': (-70, 0, 0), 'chest': (-3, 0, 25), 'upper_arm_L': (-30, 0, 20)},
        {'upper_arm_R': (-95, 0, -10), 'forearm_R': (0, 0, 0), 'chest': (8, 0, -25), 'head': (4, 0, 0), 'upper_arm_L': (30, 0, 30), 'thigh_L': (-30, 0, 0), 'thigh_R': (15, 0, 0)},
        {'upper_arm_R': (-90, 0, -8), 'chest': (6, 0, -22), 'thigh_L': (-25, 0, 0), 'thigh_R': (12, 0, 0)},
        {'upper_arm_R': (-8, 0, 6)},
    ]
    locs = [{'hips': (0, 0, 0)}, {'hips': (0, 0.02, 0)}, {'hips': (0, -0.07, -0.015)}, {'hips': (0, -0.06, -0.012)}, {'hips': (0, 0, 0)}]
    _attack(poser, 'attack_thrust', frames, poses, locs, tails, {})


def attack_bow(poser, hold, tails):
    frames = [0, 8, 11, 14, 22]
    poses = [
        hold,
        merge(hold, {'upper_arm_R': (-10, 0, -20), 'forearm_R': (0, 0, -40), 'chest': (0, 0, 8), 'head': (0, 0, 4)}),
        merge(hold, {'upper_arm_R': (5, 0, 10), 'forearm_R': (0, 0, 10), 'chest': (0, 0, -4), 'upper_arm_L': (-6, 0, 0)}),
        merge(hold, {'upper_arm_R': (0, 0, 0), 'chest': (0, 0, -2)}),
        hold,
    ]
    locs = [{'hips': (0, 0, 0)}, {'hips': (0, 0.012, 0)}, {'hips': (0, -0.015, 0)}, {'hips': (0, -0.008, 0)}, {'hips': (0, 0, 0)}]
    _attack(poser, 'attack_bow', frames, poses, locs, tails, {})


def attack_rifle(poser, hold, tails):
    frames = [0, 6, 8, 12, 20]
    poses = [hold, merge(hold, {'chest': (-2, 0, 0), 'head': (-2, 0, -6)}), merge(hold, {'chest': (-8, 0, 0), 'upper_arm_R': (12, 0, 0), 'upper_arm_L': (10, 0, 0), 'head': (-5, 0, -6)}),
             merge(hold, {'chest': (-3, 0, 0)}), hold]
    locs = [{'hips': (0, 0, 0)}, {'hips': (0, 0, 0)}, {'hips': (0, 0.03, -0.006)}, {'hips': (0, 0.01, 0)}, {'hips': (0, 0, 0)}]
    _attack(poser, 'attack_rifle', frames, poses, locs, tails, {})


def attack_cannon(poser, hold, tails):
    frames = [0, 7, 9, 14, 24]
    poses = [hold, merge(hold, {'chest': (6, 0, 0), 'head': (4, 0, 0)}), merge(hold, {'chest': (-14, 0, 0), 'upper_arm_R': (18, 0, 0), 'upper_arm_L': (14, 0, 0), 'head': (-8, 0, 0), 'thigh_L': (-15, 0, 0)}),
             merge(hold, {'chest': (-5, 0, 0)}), hold]
    locs = [{'hips': (0, 0, 0)}, {'hips': (0, -0.01, -0.01)}, {'hips': (0, 0.06, -0.012)}, {'hips': (0, 0.02, 0)}, {'hips': (0, 0, 0)}]
    _attack(poser, 'attack_cannon', frames, poses, locs, tails, {})


def attack_cast(poser, hold, tails):
    frames = [0, 8, 12, 16, 26]
    poses = [
        hold,
        merge(hold, {'upper_arm_R': (-40, 0, 25), 'forearm_R': (-80, 0, 0), 'chest': (-4, 0, 12), 'head': (-4, 0, 6), 'upper_arm_L': (-20, 0, 25)}),
        {'upper_arm_R': (-120, 0, -10), 'forearm_R': (-10, 0, 0), 'chest': (6, 0, -12), 'head': (3, 0, -4), 'upper_arm_L': (-30, 0, 35), 'forearm_L': (-30, 0, 0), 'thigh_L': (-15, 0, 0)},
        {'upper_arm_R': (-110, 0, -8), 'forearm_R': (-8, 0, 0), 'chest': (4, 0, -8), 'upper_arm_L': (-25, 0, 30)},
        hold,
    ]
    locs = [{'hips': (0, 0, 0), 'halo': (0, 0, 0)}, {'hips': (0, 0.01, -0.01), 'halo': (0, 0, 0.01)}, {'hips': (0, -0.03, 0.01), 'halo': (0, 0, 0.03)}, {'hips': (0, -0.02, 0.005), 'halo': (0, 0, 0.02)}, {'hips': (0, 0, 0), 'halo': (0, 0, 0)}]
    _attack(poser, 'attack_cast', frames, poses, locs, tails, {})


def attack_throw(poser, hold, tails):
    frames = [0, 7, 10, 14, 22]
    poses = [
        {},
        {'upper_arm_R': (-160, 0, 15), 'forearm_R': (-40, 0, 0), 'chest': (-4, 0, 28), 'head': (0, 0, 10), 'upper_arm_L': (-40, 0, 20)},
        {'upper_arm_R': (-80, 0, -20), 'forearm_R': (0, 0, 0), 'chest': (10, 0, -30), 'head': (5, 0, -6), 'upper_arm_L': (25, 0, 15), 'thigh_L': (-25, 0, 0), 'thigh_R': (12, 0, 0)},
        {'upper_arm_R': (-60, 0, -15), 'chest': (6, 0, -22), 'thigh_L': (-20, 0, 0), 'thigh_R': (10, 0, 0)},
        {},
    ]
    locs = [{'hips': (0, 0, 0)}, {'hips': (0, 0.02, 0)}, {'hips': (0, -0.05, -0.01)}, {'hips': (0, -0.04, -0.008)}, {'hips': (0, 0, 0)}]
    _attack(poser, 'attack_throw', frames, poses, locs, tails, {})


def attack_smash(poser, hold, tails):
    frames = [0, 8, 11, 15, 24]
    poses = [
        {},
        {'upper_arm_R': (-170, 0, 0), 'forearm_R': (-20, 0, 0), 'upper_arm_L': (-160, 0, 0), 'chest': (-10, 0, 0), 'head': (-8, 0, 0)},
        {'upper_arm_R': (-20, 0, -15), 'forearm_R': (0, 0, 0), 'upper_arm_L': (-20, 0, 15), 'chest': (20, 0, 0), 'head': (10, 0, 0), 'thigh_L': (-20, 0, 0), 'thigh_R': (-20, 0, 0), 'shin_L': (30, 0, 0), 'shin_R': (30, 0, 0)},
        {'upper_arm_R': (-25, 0, -12), 'upper_arm_L': (-25, 0, 12), 'chest': (15, 0, 0), 'head': (8, 0, 0), 'thigh_L': (-12, 0, 0), 'thigh_R': (-12, 0, 0), 'shin_L': (20, 0, 0), 'shin_R': (20, 0, 0)},
        {},
    ]
    locs = [{'hips': (0, 0, 0)}, {'hips': (0, 0.01, 0.01)}, {'hips': (0, -0.03, -0.03)}, {'hips': (0, -0.02, -0.02)}, {'hips': (0, 0, 0)}]
    _attack(poser, 'attack_smash', frames, poses, locs, tails, {})


def attack_sweep(poser, hold, tails):
    frames = [0, 7, 11, 15, 24]
    poses = [
        {},
        {'upper_arm_R': (-60, 0, 60), 'forearm_R': (-30, 0, 0), 'chest': (0, 0, 30), 'head': (0, 0, 12)},
        {'upper_arm_R': (-70, 0, -70), 'forearm_R': (0, 0, 0), 'chest': (4, 0, -35), 'head': (2, 0, -10), 'upper_arm_L': (-20, 0, 20), 'thigh_L': (-15, 0, 0)},
        {'upper_arm_R': (-65, 0, -60), 'chest': (3, 0, -28), 'head': (2, 0, -8)},
        {},
    ]
    locs = [{'hips': (0, 0, 0)}, {'hips': (0, 0.01, 0)}, {'hips': (0, -0.02, -0.006)}, {'hips': (0, -0.015, -0.004)}, {'hips': (0, 0, 0)}]
    _attack(poser, 'attack_sweep', frames, poses, locs, tails, {})


ATTACKS = dict(slash=attack_slash, thrust=attack_thrust, bow=attack_bow, rifle=attack_rifle, cannon=attack_cannon, cast=attack_cast,
               throw=attack_throw, smash=attack_smash, sweep=attack_sweep)


def cheer(poser, tails):
    poser.begin('cheer', loop=True)
    L = 20
    for i, f in enumerate((0, 5, 10, 15, 20)):
        ph = i / 4 * math.pi * 2
        hop = max(0.0, math.sin(ph))
        p = merge({
            'upper_arm_L': (-165 + 10 * math.sin(ph), 0, 25 + 10 * math.sin(ph)), 'upper_arm_R': (-165 - 10 * math.sin(ph), 0, -25 - 10 * math.sin(ph)),
            'forearm_L': (-10, 0, 0), 'forearm_R': (-10, 0, 0),
            'head': (-6, 0, 8 * math.sin(ph)), 'chest': (-4, 0, 0),
            'thigh_L': (-25 * hop, 0, 0), 'thigh_R': (-15 * hop, 0, 0), 'shin_L': (35 * hop, 0, 0), 'shin_R': (25 * hop, 0, 0),
        }, _tail_sway(tails, 8, ph))
        loc = {'root': (0, 0, 0.06 * hop), 'halo': (0, 0, 0.02 * hop)}
        poser.key(f, p, loc=loc)
    poser.end(L)


def victory(poser, kind, tails):
    poser.begin('victory', loop=True)
    L = 48
    if kind in ('slash', 'thrust', 'smash', 'sweep'):
        arm = {'upper_arm_R': (-175, 0, -15), 'forearm_R': (-5, 0, 0), 'upper_arm_L': (-20, 0, 40), 'forearm_L': (-70, 0, -35)}
    elif kind in ('bow', 'rifle', 'cannon'):
        arm = {'upper_arm_R': (-150, 0, -25), 'forearm_R': (-20, 0, 0), 'upper_arm_L': (-30, 0, 40), 'forearm_L': (-40, 0, 0)}
    else:
        arm = {'upper_arm_R': (-160, 0, -30), 'forearm_R': (-10, 0, 0), 'upper_arm_L': (-160, 0, 30), 'forearm_L': (-10, 0, 0)}
    for i, f in enumerate((0, L // 2, L)):
        ph = i / 2 * math.pi * 2
        p = merge(arm, {'head': (-8, 0, 12 + 2 * math.sin(ph)), 'chest': (-6, 0, 6), 'spine': (0, 4, 0), 'thigh_L': (-10, 0, 10), 'shin_L': (15, 0, 0)}, _tail_sway(tails, 4, ph))
        loc = {'hips': (0, 0, 0.004 * math.sin(ph)), 'halo': (0, 0, 0.02 + 0.01 * math.sin(ph))}
        poser.key(f, p, loc=loc)
    poser.end(L)


def hurt(poser, tails):
    poser.begin('hurt', loop=True)
    L = 36
    for i, f in enumerate((0, L // 2, L)):
        ph = i / 2 * math.pi * 2
        p = merge({'head': (28, 0, 8 * math.sin(ph)), 'chest': (16, 0, 0), 'spine': (6, 0, 3 * math.sin(ph)), 'upper_arm_L': (-10, 0, -4), 'upper_arm_R': (-10, 0, 4),
                   'forearm_L': (-15, 0, 0), 'forearm_R': (-15, 0, 0), 'thigh_L': (-6, 0, 0), 'thigh_R': (-6, 0, 0), 'shin_L': (10, 0, 0), 'shin_R': (10, 0, 0)}, _tail_sway(tails, 2, ph))
        loc = {'hips': (0, 0, -0.02), 'halo': (0, 0, -0.03)}
        poser.key(f, p, loc=loc)
    poser.end(L)


def pickup(poser, tails):
    poser.begin('pickup', loop=True)
    L = 16
    for i, f in enumerate((0, 4, 8, 12, 16)):
        ph = i / 4 * math.pi * 2
        s = math.sin(ph)
        p = merge({'thigh_L': (-30 + 35 * s, 0, 0), 'thigh_R': (-30 - 35 * s, 0, 0), 'shin_L': (40 + 10 * s, 0, 0), 'shin_R': (40 - 10 * s, 0, 0),
                   'upper_arm_L': (-60 + 30 * s, 0, 40), 'upper_arm_R': (-60 - 30 * s, 0, -40), 'forearm_L': (-40, 0, -20), 'forearm_R': (-40, 0, 20),
                   'head': (-4, 0, 10 * s), 'chest': (-6, 0, 0), 'spine': (0, 10 * s, 6 * s)}, _tail_sway(tails, 10, ph))
        loc = {'root': (0.01 * s, 0, 0.0), 'halo': (0.008 * s, 0, 0.01)}
        poser.key(f, p, loc=loc)
    poser.end(L)
