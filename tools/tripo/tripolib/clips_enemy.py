"""Enemy clips (move, idle, hit, death, special) for the Tripo Brigade, at 30 fps, in place.

* humanoid (Tripo biped rig, renamed): a march, a breathing idle, a flinch, a topple backwards that ends
  lying down (no gore: the fall style fades them, src/render/fallStyles.js), and a brace (special)
* rigid (a drone, a vehicle, a blob): the whole mesh hangs off one `body` bone under a floor `root`;
  hover = bob and tilt, vehicle = engine rumble, rock and a sideways breakdown lean, blob = a squashy hop
  (a slime, a sprout) and a flatten-out for its poof
Lengths: move 1.0 s loop, idle 1.5 s loop, hit 0.3 s, death 0.8 s, special 0.6 s."""
import math

import bpy
from mathutils import Euler, Quaternion, Vector

from .meshy import posekit
from .clips_staff import Clips, TAU, _q

smooth = posekit.smooth


def _action(arm, name):
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    if not arm.animation_data:
        arm.animation_data_create()
    arm.animation_data.action = act
    return act


def _linear(act):
    for fc in act.fcurves:
        for k in fc.keyframe_points:
            k.interpolation = 'LINEAR'


class HumanoidClips(Clips):
    """Brigade troopers: T-pose rest, so the arms come down further than the heroes'."""

    def __init__(self, arm, shield=False):
        super().__init__(arm, arms_down=62.0, chin=0.0)
        self.shield = shield

    def _arms(self, k=1.0):
        return dict(arm_l=[], fore_l=(0, 0, 0))

    def pose(self, **kw):
        L, t = super().pose(**kw)
        if self.shield:
            # the riot shield hangs off the right hand: that arm stays near its T rest (lowering it would tip
            # the shield flat) and turns forward, so the shield stands in front of the trooper
            L['upper_arm_R'] = _q((0, -12, 0), (0, 0, 62))
            L['forearm_R'] = _q((0, 0, 0))
        return L, t

    def build(self):
        def move(t):
            p = TAU * t
            s, c = math.sin(p), math.cos(p)
            a = self._arms()
            return self.pose(spine=(6, 0, 4 * s), head=(-4, 0, -3 * s),
                             arm_l=a['arm_l'] or [(18 * s, 0, 0)], arm_r=[(-18 * s, 0, 0)], fore_l=a['fore_l'],
                             thigh_l=(-24 * s, 0, 0), thigh_r=(24 * s, 0, 0),
                             shin_l=(28 * max(0.0, c), 0, 0), shin_r=(28 * max(0.0, -c), 0, 0),
                             lift=0.012 * abs(s))

        def idle(t):
            s = math.sin(TAU * t)
            a = self._arms()
            return self.pose(spine=(1.5 * s, 0, 0), head=(-1.5 * s, 2 * s, 0), arm_l=a['arm_l'] or [(0, 3 * s, 0)],
                             fore_l=a['fore_l'], arm_r=[(0, -3 * s, 0)], lift=0.004 * (1 - math.cos(TAU * t)) / 2)

        def hit(t):
            k = math.sin(math.pi * t)
            a = self._arms()
            return self.pose(spine=(-14 * k, 0, 0), head=(-10 * k, 0, 0), arm_l=a['arm_l'] or [(0, -15 * k, 0)],
                             fore_l=a['fore_l'], arm_r=[(0, 15 * k, 0)], shift=(0, 0.02 * k))

        def special(t):
            k = smooth(t / 0.3) * (1 - smooth((t - 0.75) / 0.25))
            a = self._arms(1 + 0.4 * k)
            return self.pose(spine=(10 * k, 0, 0), head=(-8 * k, 0, 0), arm_l=a['arm_l'] or [(-30 * k, 0, 0)],
                             fore_l=a['fore_l'], arm_r=[(-30 * k, 0, 0)], thigh_l=(-18 * k, 0, 0),
                             thigh_r=(14 * k, 0, 0), shin_r=(20 * k, 0, 0), lift=-0.02 * k)

        def death(t):
            k = smooth(t / 0.75)
            L, tr = self.pose(spine=(-10 * k, 0, 0), head=(-12 * k, 0, 0), arm_l=[(0, -40 * k, 0)], arm_r=[(0, 40 * k, 0)],
                              thigh_l=(-25 * k, 0, 0), thigh_r=(-10 * k, 0, 0))
            L['root'] = _q((-85 * k, 0, 0))  # topple backwards over the heels
            return L, tr + Vector((0, 0.18 * k * self.h, 0))

        acts = [self._clip('move', 30, move), self._clip('idle', 45, idle), self._clip('hit', 9, hit),
                self._clip('death', 24, death), self._clip('special', 18, special)]
        self._rest()
        return acts

    def _rest(self):
        self.arm.animation_data.action = None
        for pb in self.arm.pose.bones:
            pb.rotation_mode = 'QUATERNION'
            pb.rotation_quaternion = (1, 0, 0, 0)
            pb.location = (0, 0, 0)


def rigid_rig(meshes, height):
    """A floor `root` and one `body` bone at mid height carrying the whole mesh."""
    arm_data = bpy.data.armatures.new('rig')
    arm = bpy.data.objects.new('rig', arm_data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    r = arm_data.edit_bones.new('root'); r.head = (0, 0, 0); r.tail = (0, 0, height * 0.2)
    b = arm_data.edit_bones.new('body'); b.head = (0, 0, height * 0.35); b.tail = (0, 0, height * 0.7); b.parent = r
    bpy.ops.object.mode_set(mode='OBJECT')
    for ob in meshes:
        g = ob.vertex_groups.new(name='body')
        g.add(list(range(len(ob.data.vertices))), 1.0, 'REPLACE')
        ob.parent = arm
        mod = ob.modifiers.new('rig', 'ARMATURE')
        mod.object = arm
    return arm


def rigid_clips(arm, style, height):
    """style 'hover' (drone) or 'vehicle'; keys the body bone (rotation, location) per frame."""
    pb = arm.pose.bones['body']
    pb.rotation_mode = 'QUATERNION'
    h = height

    def clip(name, frames, fn):
        act = _action(arm, name)
        for f in range(frames + 1):
            rot, loc = fn(f / frames)
            pb.rotation_quaternion = Euler([math.radians(v) for v in rot], 'XYZ').to_quaternion()
            pb.location = Vector(loc) * h
            pb.keyframe_insert('rotation_quaternion', frame=f, group='body')
            pb.keyframe_insert('location', frame=f, group='body')
        _linear(act)
        return act

    # pose-bone space of `body`: bone Y = world Z (up), bone Z = world -Y (front): a rotation about
    # bone X pitches the nose (+ = nose down), about bone Y yaws, about bone Z rolls; location (x, up, back)
    if style == 'blob':
        # a hopping blob (slime, sprout): squash on landing, stretch in the air (body bone scale, pose space: Y up)
        def hop(t, h=0.07, squash=0.12):
            up = max(0.0, math.sin(TAU * t))
            k = 1 - squash * max(0.0, -math.sin(TAU * t))
            return up * h, (1 / math.sqrt(k), k + 0.06 * up, 1 / math.sqrt(k))
        def sclip(name, frames, fn):
            act = _action(arm, name)
            for f in range(frames + 1):
                rot, loc, scl = fn(f / frames)
                pb.rotation_quaternion = Euler([math.radians(v) for v in rot], 'XYZ').to_quaternion()
                pb.location = Vector(loc) * h
                pb.scale = scl
                for k in ('rotation_quaternion', 'location', 'scale'):
                    pb.keyframe_insert(k, frame=f, group='body')
            _linear(act)
            return act
        acts = [
            sclip('move', 30, lambda t: ((6 * math.sin(TAU * t), 0, 0), (0, hop(t)[0], 0), hop(t)[1])),
            sclip('idle', 45, lambda t: ((0, 0, 0), (0, 0, 0), (1 + 0.03 * math.sin(TAU * t), 1 - 0.04 * math.sin(TAU * t), 1 + 0.03 * math.sin(TAU * t)))),
            sclip('hit', 9, lambda t: ((-8 * math.sin(math.pi * t), 0, 0), (0, 0, 0.03 * math.sin(math.pi * t)), (1 + 0.15 * math.sin(math.pi * t), 1 - 0.18 * math.sin(math.pi * t), 1 + 0.15 * math.sin(math.pi * t)))),
            sclip('death', 24, lambda t: ((0, 0, 0), (0, 0, 0), (1 + 0.5 * smooth(t), max(0.05, 1 - 0.95 * smooth(t)), 1 + 0.5 * smooth(t)))),
            sclip('special', 18, lambda t: ((0, 360 * smooth(t), 0), (0, 0.12 * math.sin(math.pi * t), 0), (1, 1, 1))),
        ]
        arm.animation_data.action = None
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)
        return acts
    if style == 'hover':
        acts = [
            clip('move', 30, lambda t: ((14 + 3 * math.sin(TAU * t), 0, 4 * math.sin(TAU * t)), (0, 0.05 * math.sin(2 * TAU * t), 0))),
            clip('idle', 45, lambda t: ((3 * math.sin(TAU * t), 0, 3 * math.cos(TAU * t)), (0, 0.04 * math.sin(TAU * t), 0))),
            clip('hit', 9, lambda t: ((-18 * math.sin(math.pi * t), 0, 10 * math.sin(math.pi * t)), (0, 0, 0.06 * math.sin(math.pi * t)))),
            clip('death', 24, lambda t: ((40 * smooth(t), 540 * smooth(t), 25 * smooth(t)), (0, -0.3 * smooth(t), 0))),
            clip('special', 18, lambda t: ((0, 360 * smooth(t), 0), (0, 0.08 * math.sin(math.pi * t), 0))),
        ]
    else:
        acts = [
            clip('move', 30, lambda t: ((1.5 * math.sin(2 * TAU * t), 0, 1.2 * math.sin(TAU * t)), (0, 0.012 * abs(math.sin(2 * TAU * t)), 0))),
            clip('idle', 45, lambda t: ((0, 0, 0.6 * math.sin(3 * TAU * t)), (0, 0.004 * math.sin(6 * TAU * t), 0))),
            clip('hit', 9, lambda t: ((-5 * math.sin(math.pi * t), 0, 3 * math.sin(2 * math.pi * t)), (0, 0.01 * math.sin(math.pi * t), 0.02 * math.sin(math.pi * t)))),
            clip('death', 24, lambda t: ((6 * smooth(t), 0, 22 * smooth(t)), (0, -0.06 * smooth(t), 0))),
            clip('special', 18, lambda t: ((-6 * math.sin(math.pi * t), 0, 0), (0, 0.06 * math.sin(math.pi * t), 0))),
        ]
    arm.animation_data.action = None
    pb.rotation_quaternion = (1, 0, 0, 0)
    pb.location = (0, 0, 0)
    return acts
