"""Enemy clips (move, idle, hit, death, special) for the re-rigged batch-2 humanoid enemies (tripolib/rerig_enemy.py),
the names and lengths src/models/glbEnemy.js asks for: move 1.0 s loop, idle 1.5 s loop, hit 0.3 s, death 0.8 s,
special 0.6 s (tests/models/tripo.test.js CLIP_CAP), in place at 30 fps.

The rigs rest in the figures' own A-pose (arms 35-70 degrees below the horizontal), so arms are set by a target
hang angle (`hang`: degrees below the horizontal, per side) and every pose is world-axis rotations on top of that
(tools/meshy/lib/posekit.py): x > 0 tips an up-pointing bone forward and swings a down-pointing one back,
y > 0 rolls toward its left (lowers its left arm, raises its right), z > 0 turns it to its left.

Builds (`build`): how the body moves
  heavy   a rolling stomp (Orc, Oni): wide waddle, body roll over the planted foot, a bob, arms swinging
  boss    the same, slower and prouder (the Daimyo), the banner swaying behind
  robot   a machine stomp (Colossus, Titan): a heavy step, a jolt as the foot lands, fists swinging low
  runner  a scamper (Goblin): leaning forward, knees high, elbows bent and pumping, two bounces a loop
  shamble a rattling shuffle (Bonewalker): arms out in front, head wobbling, the rags swinging
  waddle  a lizard waddle (Skink): body roll, tail swinging side to side, little arm paddles
Specials (`special`), all ending where they start so they can loop while a field is projected:
  thump   a club held forward and up (the Orc): swung up until it stands upright, a roar and a free-fist pump,
          then thumped down in front with a stomp
  pound   a club held upright (the Oni): hoisted high, leaning back over the shoulder, then pounded down butt-first
          with a stomp (a chop would need the grip to turn past the forearm: the wrist would crumple)
  banner  both arms flung up in a war cry, the banner waving (the Daimyo raising the parade banner)
  pounce  crouch, hop with arms up, land (Goblin's blink wind-up)
  spook   arms up and out, hands drooping, a head-rattling "boo" (Bonewalker)
  whip    crouch and a tail whip from side to side, arms up (Skink)
  slam    both fists raised (the clavicles and their pauldrons lift too) and pounded down in front (Colossus, Titan)
A weapon hand undoes the hang's roll (the club stays as the figure holds it) and takes the profile's `grip` tilt;
`aim` points the weapon along a world direction where a special needs it. Death: the knees buckle and it topples
backwards onto its back, arms flopping up (no gore: the battle shrinks and fades it, src/render/actors.js). Chins
sit a little up (`chin`, the Daimyo also leans back: `lean`) so the faces read from the 48-degree battle camera."""
import math

import bpy
from mathutils import Quaternion, Vector

from .meshy import posekit
from .compat import linear

E, smooth = posekit.E, posekit.smooth

FPS = 30
TAU = 2 * math.pi


def _q(*eulers):
    """Composes world-axis rotations, first argument applied first."""
    q = Quaternion()
    for e in eulers:
        q = E(*e) @ q
    return q


def bump(t, a, b):
    """0 -> 1 -> 0 over [a, b] (smooth)."""
    if t <= a or t >= b:
        return 0.0
    return math.sin(math.pi * (t - a) / (b - a))


class BruteClips:
    """style: dict(build, special, hang={'L': deg, 'R': deg} (target angle below the horizontal), weapon=None|'L'|'R',
    chin=deg (negative = chin up), elbow=deg (soft bend), fwd=deg (arms a little forward), stride=deg, swing=deg,
    scale=1 (motion size))."""

    def __init__(self, arm, style):
        self.arm = arm
        self.rig = posekit.Rig(arm)
        self.s = dict(build='heavy', special='slam', hang={}, weapon=None, chin=-8.0, elbow=12.0, fwd=6.0,
                      stride=20.0, swing=16.0, scale=1.0, tail_swing=10.0, lean=0.0)
        self.s.update(style)
        bones = arm.data.bones
        self.tails = sorted(b.name for b in bones if b.name.startswith('tail'))
        self.banner = sorted(b.name for b in bones if b.name.startswith('banner'))
        self.rest_down = {}
        self.down = {}
        for side, k in (('L', 1), ('R', -1)):
            ua, hd = bones[f'upper_arm_{side}'], bones[f'hand_{side}']
            d = hd.tail_local - ua.head_local
            a0 = math.degrees(math.atan2(-d.z, math.hypot(d.x, d.y)))
            self.rest_down[side] = a0
            self.down[side] = self.s['hang'].get(side, a0) - a0
        top = max((b.tail_local.z for b in bones), default=1.0)
        self.h = 1.0 if top < 2 else top

    # ---- pose building ---------------------------------------------------------------------------------------
    def pose(self, spine=(0, 0, 0), chest=(0, 0, 0), neck=(0, 0, 0), head=(0, 0, 0), arm=None, fore=None, hand=None,
             shoulder=None, thigh_l=(0, 0, 0), thigh_r=(0, 0, 0), shin_l=(0, 0, 0), shin_r=(0, 0, 0), foot_l=(0, 0, 0),
             foot_r=(0, 0, 0), tail=(0, 0, 0), banner=(0, 0, 0), hips=(0, 0, 0), root=(0, 0, 0), lift=0.0,
             shift=(0.0, 0.0)):
        """arm / fore / hand / shoulder: {'L': [eulers...], 'R': [...]} on top of the hang. Returns (L, root_t)."""
        arm, fore, hand, shoulder = arm or {}, fore or {}, hand or {}, shoulder or {}
        L = {'root': _q(root), 'hips': _q(hips), 'spine': _q((self.s['lean'], 0, 0), spine), 'chest': _q(chest), 'neck': _q(neck),
             'head': _q((self.s['chin'], 0, 0), head),
             'thigh_L': _q(thigh_l), 'thigh_R': _q(thigh_r), 'shin_L': _q(shin_l), 'shin_R': _q(shin_r),
             'foot_L': _q(foot_l), 'foot_R': _q(foot_r)}
        for side, k in (('L', 1), ('R', -1)):
            L[f'shoulder_{side}'] = _q(*shoulder.get(side, []))
            L[f'upper_arm_{side}'] = _q((0, k * self.down[side], 0), (-self.s['fwd'], 0, 0), *arm.get(side, []))
            L[f'forearm_{side}'] = _q((-self.s['elbow'], 0, 0), *fore.get(side, []))
            if side == self.s['weapon']:
                # the weapon hand undoes the hang's roll (a club held upright stays upright when the arm comes down
                # from the A-pose) and takes the profile's grip tilt
                L[f'hand_{side}'] = _q((0, -k * self.down[side], 0), tuple(self.s.get('grip', (0, 0, 0))),
                                       *hand.get(side, []))
            else:
                L[f'hand_{side}'] = _q(*hand.get(side, []))
        for i, n in enumerate(self.tails):
            # each segment adds a little more of the same bend, so the tail curves
            L[n] = _q(tuple(v * (0.7 + 0.3 * i) for v in tail))
        for i, n in enumerate(self.banner):
            L[n] = _q(tuple(v * (1.0 + 0.5 * i) for v in banner))
        return L, Vector((shift[0] * self.h, shift[1] * self.h, lift * self.h))

    def aim(self, L, direction, blend=1.0):
        """Points the weapon (its rest axis: style weapon_axis) along a world `direction` (blended in by `blend`):
        a swing reads by where the club points, so the specials set that and let the wrist follow."""
        L['__aim'] = (Vector(direction).normalized(), blend)
        return L

    def _solve(self, L, t):
        aim = L.pop('__aim', None)
        M, D = self.rig.solve(L, root_t=t)
        if not aim or aim[1] <= 1e-4:
            return M
        direction, blend = aim
        hand = f'hand_{self.s["weapon"]}'
        rest = Vector(self.s['weapon_axis']).normalized()
        now = (D[hand] @ rest).normalized()
        want = now.slerp(direction, min(1.0, blend)) if now.dot(direction) > -0.999 else direction
        D_aim = now.rotation_difference(want) @ D[hand]
        M, _ = self.rig.solve(L, root_t=t, override={hand: D_aim})
        return M

    def _clip(self, name, frames, fn):
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        if not self.arm.animation_data:
            self.arm.animation_data_create()
        self.arm.animation_data.action = act
        for f in range(frames + 1):
            L, t = fn(f / frames)
            self.rig.key(self._solve(L, t), f)
        linear(act)
        return act

    def _w(self):
        """Which side carries the weapon (its arm swings less, the weapon must not dig into the road)."""
        return self.s['weapon']

    # ---- clips -----------------------------------------------------------------------------------------------
    def move(self):
        b = self.s['build']
        S = self.s['scale']
        st, sw = self.s['stride'] * S, self.s['swing'] * S
        wpn = self._w()

        def f(t):
            p = TAU * t
            s, c = math.sin(p), math.cos(p)
            arm_k = {'L': 1.0, 'R': 1.0}
            if wpn:
                arm_k[wpn] = 0.45
            if b == 'runner':
                # a scamper: leaning in, knees high, elbows bent and pumping, two bounces a loop
                return self.pose(
                    spine=(14, 0, 6 * s), chest=(2, 3 * s, 0), head=(-22, 0, -5 * s),
                    arm={'L': [(36 * s, 0, 0)], 'R': [(-36 * s, 0, 0)]},
                    fore={'L': [(-55 + 15 * s, 0, 0)], 'R': [(-55 - 15 * s, 0, 0)]},
                    thigh_l=(-st * s - 8, 0, 0), thigh_r=(st * s - 8, 0, 0),
                    shin_l=(46 * max(0.0, c), 0, 0), shin_r=(46 * max(0.0, -c), 0, 0),
                    foot_l=(-10 * max(0.0, c), 0, 0), foot_r=(-10 * max(0.0, -c), 0, 0),
                    lift=0.03 * abs(s), shift=(0.0, -0.01))
            if b == 'shamble':
                # arms held out in front, a rattling shuffle, the head wobbling
                wob = math.sin(2 * p + 0.7)
                return self.pose(
                    spine=(6, 4 * s, 7 * s), chest=(0, 3 * s, 0), head=(-6, 7 * wob, -6 * s), neck=(0, 3 * wob, 0),
                    arm={'L': [(-55 + 10 * s, 0, 0), (0, -8 * math.sin(p + 1), 0)],
                         'R': [(-55 - 10 * s, 0, 0), (0, 8 * math.sin(p + 2), 0)]},
                    fore={'L': [(-10 - 12 * math.sin(p + 0.5), 0, 0)], 'R': [(-10 + 12 * math.sin(p + 0.5), 0, 0)]},
                    hand={'L': [(25 + 15 * math.sin(2 * p), 0, 0)], 'R': [(25 + 15 * math.sin(2 * p + 1), 0, 0)]},
                    thigh_l=(-st * s, 0, 0), thigh_r=(st * s, 0, 0),
                    shin_l=(28 * max(0.0, c), 0, 0), shin_r=(28 * max(0.0, -c), 0, 0),
                    hips=(0, 4 * s, 0), lift=0.012 * abs(s), shift=(0.006 * s, 0.0))
            if b == 'waddle':
                # body rolls over the planted foot, tail swings the other way, little arm paddles
                return self.pose(
                    hips=(0, 7 * s, 4 * s), spine=(4, -3 * s, 3 * s), head=(-4, -4 * s, -6 * s),
                    arm={'L': [(sw * s, 0, 0)], 'R': [(-sw * s, 0, 0)]},
                    fore={'L': [(-12 - 10 * max(0.0, s), 0, 0)], 'R': [(-12 - 10 * max(0.0, -s), 0, 0)]},
                    thigh_l=(-st * s, 0, 0), thigh_r=(st * s, 0, 0),
                    shin_l=(32 * max(0.0, c), 0, 0), shin_r=(32 * max(0.0, -c), 0, 0),
                    tail=(2 * math.sin(2 * p), 0, -self.s['tail_swing'] * math.sin(p + 0.8)),
                    lift=0.014 * abs(s), shift=(0.01 * s, 0.0))
            # heavy / boss / robot: a rolling stomp
            land = max(0.0, -math.cos(2 * p))           # 1 at each foot strike
            jolt = 0.0
            if b == 'robot':
                jolt = math.exp(-((t * 2) % 1.0) * 9.0)  # a jolt that dies away after each strike
            roll = (5.0 if b != 'robot' else 3.0) * S
            return self.pose(
                hips=(0, roll * s, 4 * s * S), spine=(5 + 2 * jolt, -roll * 0.5 * s, 4 * s * S),
                chest=(-1.5 * land, 0, 2 * s), head=(-3 + 2 * land, -2 * s, -4 * s * S),
                arm={'L': [(sw * arm_k['L'] * s, 0, 0), (0, -4 * land, 0)],
                     'R': [(-sw * arm_k['R'] * s, 0, 0), (0, 4 * land, 0)]},
                fore={'L': [(-6 * (1 + s) * arm_k['L'], 0, 0)], 'R': [(-6 * (1 - s) * arm_k['R'], 0, 0)]},
                thigh_l=(-st * s, 0, 0), thigh_r=(st * s, 0, 0),
                shin_l=(30 * S * max(0.0, c), 0, 0), shin_r=(30 * S * max(0.0, -c), 0, 0),
                foot_l=(-8 * max(0.0, c), 0, 0), foot_r=(-8 * max(0.0, -c), 0, 0),
                tail=(0, 0, -6 * s), banner=(4 * math.sin(2 * p + 0.6), 0, 3 * math.sin(p + 0.9)),
                lift=(0.014 * abs(s) - 0.008 * jolt) * S, shift=(0.008 * s * S, 0.0))
        return self._clip('move', 30, f)

    def idle(self):
        b = self.s['build']

        def f(t):
            p = TAU * t
            breath = (1 - math.cos(p)) / 2
            s1, s2 = math.sin(p), math.sin(p + 1.3)
            arm = {'L': [(4 * s2, -4 * breath, 0)], 'R': [(-4 * s2, 4 * breath, 0)]}
            if b == 'shamble':
                arm = {'L': [(-40 + 6 * s2, -4 * breath, 0)], 'R': [(-40 - 6 * s2, 4 * breath, 0)]}
            return self.pose(
                spine=(1.5 * s1, 1.5 * math.sin(p + 0.4), 2.5 * s1), chest=(-3 * breath, 0, 0),
                head=(-2 * breath, 4 * s2, -3 * s1),
                shoulder={'L': [(0, -3 * breath, 0)], 'R': [(0, 3 * breath, 0)]},
                arm=arm, fore={'L': [(-8 * breath, 0, 0)], 'R': [(-8 * breath, 0, 0)]},
                tail=(2 * math.sin(p + 0.5), 0, 8 * math.sin(p + 0.8)),
                banner=(3 * math.sin(p + 0.7), 2 * math.sin(p + 1.9), 0),
                lift=0.004 * breath)
        return self._clip('idle', 45, f)

    def hit(self):
        # hit_raise: how far the arms lift out to the sides (degrees); hit_fwd: how far they flinch forward
        hr, hf = self.s.get('hit_raise', 16.0), self.s.get('hit_fwd', 12.0)

        def f(t):
            k = math.sin(math.pi * t) * (1 - 0.3 * t)
            return self.pose(spine=(-12 * k, 0, 4 * k), chest=(-6 * k, 0, 0), head=(-10 * k, 6 * k, 0),
                             arm={'L': [(0, -hr * k, 0), (-hf * k, 0, 0)], 'R': [(0, hr * k, 0), (-hf * k, 0, 0)]},
                             fore={'L': [(-14 * k, 0, 0)], 'R': [(-14 * k, 0, 0)]},
                             thigh_l=(-6 * k, 0, 0), shin_l=(8 * k, 0, 0),
                             tail=(-6 * k, 0, 8 * k), banner=(-8 * k, 0, 0), shift=(0, 0.025 * k))
        return self._clip('hit', 9, f)

    def death(self):
        def f(t):
            buckle = smooth(t / 0.3) * (1 - smooth((t - 0.45) / 0.3))   # knees give, then straighten as it falls
            fall = smooth((t - 0.15) / 0.6)                                # topple backwards
            flop = bump(t, 0.25, 1.4)
            L, tr = self.pose(spine=(8 * buckle - 6 * fall, 0, 0), head=(6 * buckle - 10 * fall, 8 * fall, 0),
                              arm={'L': [(-40 * flop, -20 * fall, 0)], 'R': [(-40 * flop, 20 * fall, 0)]},
                              fore={'L': [(-20 * flop, 0, 0)], 'R': [(-20 * flop, 0, 0)]},
                              thigh_l=(-30 * buckle - 25 * fall, 0, 0), thigh_r=(-30 * buckle - 10 * fall, 0, 0),
                              shin_l=(45 * buckle + 10 * fall, 0, 0), shin_r=(45 * buckle + 20 * fall, 0, 0),
                              tail=(0, 0, 10 * fall), banner=(45 * fall, 0, 0),
                              lift=-0.06 * buckle)
            L['root'] = _q((-82 * fall, 0, 0))
            return L, tr + Vector((0, 0.16 * fall * self.h, 0.02 * fall * self.h))
        return self._clip('death', 24, f)

    def special(self):
        sp = self.s['special']
        # pound: how far forward (negative: back over the shoulder) and out to the side the club arm hoists; banner: how
        # far up (forward) and out to the sides the arms fling
        pl, po = self.s.get('pound_lift', 65.0), self.s.get('pound_out', 48.0)
        pa = self.s.get('pound_aim_out', 0.05)      # the club's outward lean while aimed (x per unit up)
        bu, bo = self.s.get('banner_up', 110.0), self.s.get('banner_out', 20.0)
        wpn = self._w() or 'R'
        free = 'L' if wpn == 'R' else 'R'
        kf = 1 if free == 'L' else -1

        kw = 1 if wpn == 'L' else -1

        def f(t):
            if sp == 'pound':
                # a club held upright in a fist (the Oni): hoisted high, still upright, with a roar and the free fist
                # pumping, then pounded down butt-first beside it with a stomp. The club is kept upright (aim), so the
                # wrist turns no more than the arm does (a chop would need the grip to swing past the forearm)
                up = smooth(t / 0.3)
                down = smooth((t - 0.4) / 0.12)
                back = smooth((t - 0.66) / 0.34)
                raise_ = up * (1 - down)
                hit = down * (1 - back)
                pump = bump(t, 0.1, 0.5)
                L, tr = self.pose(spine=(-8 * raise_ + 12 * hit, 0, kw * 6 * raise_), chest=(-5 * raise_ + 4 * hit, 0, 0),
                                  head=(-10 * raise_ - 14 * hit, 0, 0),
                                  shoulder={wpn: [(0, -kw * 14 * raise_, 0)]},
                                  arm={wpn: [(-pl * raise_ + 12 * hit, -kw * po * raise_, 0)],
                                       free: [(-30 * pump, -kf * 50 * pump, 0)]},
                                  fore={wpn: [(-15 * raise_, 0, 0)], free: [(-35 * pump, 0, 0)]},
                                  thigh_l=(-16 * hit, 0, 0), thigh_r=(10 * hit, 0, 0), shin_r=(14 * hit, 0, 0),
                                  lift=0.03 * raise_ - 0.025 * hit)
                # half aimed while hoisted (the club leans back over the shoulder, the wrist turns half as far)
                return self.aim(L, (kw * pa, -0.08 - 0.25 * hit, 1.0), (1 - back) * (1 - 0.55 * raise_)), tr
            if sp == 'thump':
                # a club held forward and up (the Orc): swung up until it stands upright, a roar with the free fist
                # pumping, then thumped down in front with a stomp
                up = smooth(t / 0.3)
                down = smooth((t - 0.42) / 0.12)
                back = smooth((t - 0.66) / 0.34)
                raise_ = up * (1 - down)
                hit = down * (1 - back)
                pump = bump(t, 0.12, 0.48)
                return self.pose(spine=(-8 * raise_ + 12 * hit, 0, kw * 6 * raise_), chest=(-6 * raise_ + 4 * hit, 0, 0),
                                 head=(-10 * raise_ - 16 * hit, 0, 0),
                                 arm={wpn: [(-75 * raise_ + 30 * hit, -kw * 8 * raise_, 0)],
                                      free: [(-30 * pump, -kf * 50 * pump, 0)]},
                                 fore={wpn: [(-15 * raise_, 0, 0)], free: [(-35 * pump, 0, 0)]},
                                 hand={wpn: [(15 * raise_ + 25 * hit, 0, 0)]},
                                 thigh_l=(-16 * hit, 0, 0), thigh_r=(10 * hit, 0, 0), shin_r=(14 * hit, 0, 0),
                                 lift=0.02 * raise_ - 0.025 * hit)
            if sp == 'banner':
                up = smooth(t / 0.3) * (1 - smooth((t - 0.75) / 0.25))
                wave = math.sin(TAU * t * 1.5)
                return self.pose(spine=(-8 * up, 0, 0), chest=(-5 * up, 0, 0), head=(-2 * up, 0, 0),
                                 arm={'L': [(-bu * up, -bo * up, 0)], 'R': [(-bu * up, bo * up, 0)]},
                                 fore={'L': [(-20 * up, 0, 0)], 'R': [(-20 * up, 0, 0)]},
                                 banner=(10 * up * wave, 0, 6 * up * wave), lift=0.02 * up)
            if sp == 'pounce':
                crouch = bump(t, 0.0, 0.4)
                hop = bump(t, 0.3, 0.8)
                land = bump(t, 0.75, 1.0)
                return self.pose(spine=(18 * crouch - 6 * hop + 10 * land, 0, 0), head=(-10 * crouch - 6 * hop, 0, 0),
                                 arm={'L': [(30 * crouch - 140 * hop, -30 * hop, 0)], 'R': [(30 * crouch - 140 * hop, 30 * hop, 0)]},
                                 fore={'L': [(-30 * crouch, 0, 0)], 'R': [(-30 * crouch, 0, 0)]},
                                 thigh_l=(-45 * (crouch + land), 0, 0), thigh_r=(-45 * (crouch + land), 0, 0),
                                 shin_l=(70 * (crouch + land), 0, 0), shin_r=(70 * (crouch + land), 0, 0),
                                 foot_l=(-25 * (crouch + land), 0, 0), foot_r=(-25 * (crouch + land), 0, 0),
                                 lift=-0.06 * (crouch + land) + 0.1 * hop)
            if sp == 'spook':
                up = smooth(t / 0.25) * (1 - smooth((t - 0.7) / 0.3))
                rattle = math.sin(TAU * t * 4)
                return self.pose(spine=(3 * up, 0, 3 * rattle * up), head=(-14 * up, 10 * rattle * up, 0),
                                 neck=(0, 4 * rattle * up, 0),
                                 arm={'L': [(-75 * up, -50 * up, 0)], 'R': [(-75 * up, 50 * up, 0)]},
                                 fore={'L': [(-10 * up, 0, 0)], 'R': [(-10 * up, 0, 0)]},
                                 hand={'L': [(60 * up, 0, 0)], 'R': [(60 * up, 0, 0)]}, lift=0.015 * up)
            if sp == 'whip':
                crouch = bump(t, 0.0, 1.0)
                whip = math.sin(TAU * t) * smooth(t / 0.15) * (1 - smooth((t - 0.85) / 0.15))
                return self.pose(hips=(0, 0, 14 * whip), spine=(10 * crouch, 0, -8 * whip), head=(-8 * crouch, 0, 8 * whip),
                                 arm={'L': [(-70 * crouch, -20 * crouch, 0)], 'R': [(-70 * crouch, 20 * crouch, 0)]},
                                 fore={'L': [(-40 * crouch, 0, 0)], 'R': [(-40 * crouch, 0, 0)]},
                                 thigh_l=(-25 * crouch, 0, 0), thigh_r=(-25 * crouch, 0, 0),
                                 shin_l=(40 * crouch, 0, 0), shin_r=(40 * crouch, 0, 0),
                                 tail=(8 * crouch, 0, -22 * whip), lift=-0.03 * crouch)
            # slam: both fists up (the clavicles lift with them, so pauldrons ride up), then pounded down in front
            up = smooth(t / 0.35)
            down = smooth((t - 0.35) / 0.15)
            back = smooth((t - 0.65) / 0.35)
            raise_ = up * (1 - down)
            hit = down * (1 - back)
            a = -135 * raise_ - 70 * hit
            return self.pose(spine=(-8 * raise_ + 14 * hit, 0, 0), chest=(-4 * raise_ + 6 * hit, 0, 0),
                             head=(-6 * raise_ - 10 * hit, 0, 0),
                             shoulder={'L': [(-10 * raise_, -22 * raise_, 0)], 'R': [(-10 * raise_, 22 * raise_, 0)]},
                             arm={'L': [(a, -12 * raise_, 0)], 'R': [(a, 12 * raise_, 0)]},
                             fore={'L': [(-35 * raise_, 0, 0)], 'R': [(-35 * raise_, 0, 0)]},
                             thigh_l=(-20 * hit, 0, 0), thigh_r=(-20 * hit, 0, 0),
                             shin_l=(30 * hit, 0, 0), shin_r=(30 * hit, 0, 0), banner=(-10 * raise_ + 10 * hit, 0, 0),
                             lift=0.02 * raise_ - 0.03 * hit)
        return self._clip('special', 18, f)

    def build(self):
        acts = [self.move(), self.idle(), self.hit(), self.death(), self.special()]
        self.arm.animation_data.action = None
        for pb in self.arm.pose.bones:
            pb.rotation_mode = 'QUATERNION'
            pb.rotation_quaternion = (1, 0, 0, 0)
            pb.location = (0, 0, 0)
        return acts
