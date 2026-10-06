"""Enemy clips authored with the chibi pipeline's Poser (tools/blender/lib/anim.py):
a few keyframes at 24 fps in armature space, bezier -> CUBICSPLINE in the GLB.

Every family ships: move (loop), idle (loop, subtle), hit (one-shot), death (one-shot),
special (one-shot: cast / siphon / blink wind-up / roar). The family picks a style per
clip in ctx['clips'] = dict(move='hop', hit='squash', death='splat', special='cast').

Conventions: poses are {bone: (pitch, roll, yaw)} degrees — pitch + = nod forward (the
enemy faces -Y); loc offsets are in enemy space (x, y, z) before scaling; scale tuples are
in bone space (sideways, along the bone, sideways).
"""
import math
import bpy
from mathutils import Vector, Quaternion

from lib.anim import Poser, merge

FPS = 24


def sq(s_side, s_up):
    """Bone-space scale for a vertical bone: (side, up, side)."""
    return (s_side, s_up, s_side)


def build_clips(arm, ctx, loc_scale=1.0):
    poser = Poser(arm, loc_scale=loc_scale)
    spec = ctx['clips']
    names = {b.name for b in arm.data.bones}
    ctx['_bones'] = names
    MOVES[spec.get('move', 'waddle')](poser, ctx)
    for name, style in (spec.get('extra') or {}).items():
        MOVES[style](poser, ctx)
        poser.action.name = name
        track = poser.ad.nla_tracks[-1]
        track.name = name
        for strip in track.strips:
            strip.name = name
    idle(poser, ctx)
    HITS[spec.get('hit', 'recoil')](poser, ctx)
    DEATHS[spec.get('death', 'topple')](poser, ctx)
    SPECIALS[spec.get('special', 'cast')](poser, ctx)
    bpy.context.scene.frame_set(0)
    for pb in arm.pose.bones:
        pb.rotation_quaternion = Quaternion((1, 0, 0, 0))
        pb.location = Vector((0, 0, 0))
        pb.scale = Vector((1, 1, 1))
    return [a.name for a in bpy.data.actions]


def has(ctx, *bones):
    return all(b in ctx['_bones'] for b in bones)


def legs4(ph, amp=35):
    s = math.sin(ph)
    return {'leg_FL': (amp * s, 0, 0), 'leg_BR': (amp * s, 0, 0), 'leg_FR': (-amp * s, 0, 0), 'leg_BL': (-amp * s, 0, 0)}


def tail_sway(ctx, amt, ph):
    out = {}
    for i in range(1, 5):
        n = f'tail_{i}'
        if n in ctx['_bones']:
            out[n] = (0, 0, amt * math.sin(ph - i * 0.9))
    return out


def wings(ctx, up, ph=None):
    """Wing roll: up > 0 raises both wings (mirrored)."""
    if 'wing_L' not in ctx['_bones']:
        return {}
    a = up if ph is None else up * math.sin(ph)
    return {'wing_L': (0, -a, 0), 'wing_R': (0, a, 0)}


# ---------------------------------------------------------------------------
# Move loops
# ---------------------------------------------------------------------------

def move_hop(poser, ctx):
    """Slime / pod / sprout: squash on landing, stretch in the air, a little hop."""
    poser.begin('move', loop=True)
    L = 18
    h = ctx.get('height', 1.0)
    keys = [
        (0, sq(1.12, 0.84), 0.0, (3, 0, 0)),
        (4, sq(0.94, 1.14), 0.10 * h, (-6, 0, 0)),
        (8, sq(0.98, 1.05), 0.16 * h, (-3, 0, 0)),
        (12, sq(0.95, 1.1), 0.08 * h, (4, 0, 0)),
        (15, sq(1.16, 0.8), 0.0, (6, 0, 0)),
        (18, sq(1.12, 0.84), 0.0, (3, 0, 0)),
    ]
    for f, s, z, lean in keys:
        pose = {'body': lean, 'top': (lean[0] * 1.6, 0, 0)}
        pose.update(wings(ctx, 25, f / L * math.pi * 4))
        poser.key(f, pose, loc={'root': (0, 0, z)}, scale={'body': s})
    poser.end(L)


def move_waddle(poser, ctx, L=16, leg=40, arm=30, bob=0.02, fast=False):
    """Stubby biped run: big leg swings, counter-swinging arms, head bob, hips sway."""
    poser.begin('move', loop=True)
    for i, f in enumerate((0, L // 4, L // 2, 3 * L // 4, L)):
        ph = i / 4 * math.pi * 2
        s, c = math.sin(ph), math.cos(ph)
        pose = {
            'leg_L': (leg * s, 0, 0), 'leg_R': (-leg * s, 0, 0),
            'arm_L': (-arm * s, 0, 8), 'arm_R': (arm * s, 0, -8),
            'chest': (8 if fast else 4, 0, 6 * s), 'hips': (0, 4 * s, 0),
            'head': (-4 + 3 * abs(c), 0, -4 * s),
        }
        pose.update(tail_sway(ctx, 18, ph))
        pose.update(wings(ctx, 20, ph * 2))
        poser.key(f, pose, loc={'root': (0, 0, bob * abs(c) * ctx.get('height', 1.0))})
    poser.end(L)


def move_run(poser, ctx):
    move_waddle(poser, ctx, L=12, leg=50, arm=45, bob=0.03, fast=True)


def move_stomp(poser, ctx):
    """Heavy biped: slow steps, strong body lurch, arms held wide."""
    poser.begin('move', loop=True)
    L = 28
    for i, f in enumerate((0, L // 4, L // 2, 3 * L // 4, L)):
        ph = i / 4 * math.pi * 2
        s, c = math.sin(ph), math.cos(ph)
        pose = {
            'leg_L': (28 * s, 0, 0), 'leg_R': (-28 * s, 0, 0),
            'arm_L': (-14 * s, 0, 14), 'arm_R': (14 * s, 0, -14),
            'chest': (5, 9 * s, 5 * s), 'hips': (0, -6 * s, 0),
            'head': (2, 0, -5 * s),
        }
        pose.update(tail_sway(ctx, 14, ph))
        poser.key(f, pose, loc={'root': (0, 0, 0.025 * abs(c) * ctx.get('height', 1.0))})
    poser.end(L)


def move_shamble(poser, ctx):
    """Ghoul: hunched, arms dangling forward, uneven steps."""
    poser.begin('move', loop=True)
    L = 24
    for i, f in enumerate((0, L // 4, L // 2, 3 * L // 4, L)):
        ph = i / 4 * math.pi * 2
        s, c = math.sin(ph), math.cos(ph)
        pose = {
            'leg_L': (30 * s, 0, 0), 'leg_R': (-30 * s, 0, 0),
            'arm_L': (-70 + 10 * s, 0, 10), 'arm_R': (-75 - 10 * s, 0, -10),
            'chest': (22 + 3 * s, 7 * s, 0), 'hips': (0, -4 * s, 0),
            'head': (-12 + 5 * c, 0, 8 * s),
        }
        poser.key(f, pose, loc={'root': (0, 0, 0.015 * abs(c))})
    poser.end(L)


def move_float(poser, ctx):
    """Ghost / lych / fae: hover bob, slow sway, trailing bottom."""
    poser.begin('move', loop=True)
    L = 48
    h = ctx.get('height', 1.0)
    for i, f in enumerate((0, L // 4, L // 2, 3 * L // 4, L)):
        ph = i / 4 * math.pi * 2
        s, c = math.sin(ph), math.cos(ph)
        pose = {'body': (6 * s, 5 * c, 0), 'top': (4 * s, 0, 0), 'chest': (4 * s, 6 * c, 0), 'head': (-5 * s, 0, 4 * c),
                'arm_L': (-20 + 8 * s, 0, 15), 'arm_R': (-20 - 8 * s, 0, -15), 'hips': (0, 0, 0)}
        pose.update(wings(ctx, 30, ph * 3))
        pose.update(tail_sway(ctx, 10, ph))
        poser.key(f, pose, loc={'root': (0, 0, 0.06 * h * s)})
    poser.end(L)


def move_flutter(poser, ctx):
    """Fae: fast wing beats, bouncy hover, legs tucked."""
    poser.begin('move', loop=True)
    L = 16
    for i, f in enumerate((0, 4, 8, 12, 16)):
        ph = i / 4 * math.pi * 2
        s = math.sin(ph)
        pose = {'chest': (6 * s, 0, 0), 'head': (-6 * s, 0, 5 * math.cos(ph)), 'arm_L': (-20, 0, 20 + 10 * s), 'arm_R': (-20, 0, -20 - 10 * s),
                'leg_L': (-20 + 8 * s, 0, 0), 'leg_R': (-20 - 8 * s, 0, 0)}
        pose.update(wings(ctx, 45, ph * 2))
        poser.key(f, pose, loc={'root': (0, 0, 0.05 * s)})
    poser.end(L)


def move_gallop(poser, ctx):
    """Beast: bounding gallop, body rocks, tail whips."""
    poser.begin('move', loop=True)
    L = 16
    for i, f in enumerate((0, 4, 8, 12, 16)):
        ph = i / 4 * math.pi * 2
        s, c = math.sin(ph), math.cos(ph)
        pose = {'body': (-10 * s, 0, 0), 'head': (12 * s, 0, 0)}
        pose.update({'leg_FL': (40 * s, 0, 0), 'leg_FR': (40 * s, 0, 0), 'leg_BL': (-40 * s, 0, 0), 'leg_BR': (-40 * s, 0, 0)})
        pose.update(tail_sway(ctx, 15, ph))
        pose['tail_1'] = (25 * c, 0, 0) if 'tail_1' in ctx['_bones'] else (0, 0, 0)
        poser.key(f, pose, loc={'root': (0, 0, 0.05 * max(0.0, s) * ctx.get('height', 1.0))})
    poser.end(L)


def move_fly(poser, ctx):
    """Dragon / wyvern: slow powerful wing beats, body rises on the downstroke."""
    poser.begin('move', loop=True)
    L = 30
    h = ctx.get('height', 1.0)
    for i, f in enumerate((0, L // 4, L // 2, 3 * L // 4, L)):
        ph = i / 4 * math.pi * 2
        s, c = math.sin(ph), math.cos(ph)
        pose = {'body': (-6 + 4 * c, 0, 0), 'head': (6 - 4 * c, 0, 3 * s)}
        pose.update(wings(ctx, 50, ph))
        pose.update(tail_sway(ctx, 12, ph))
        pose.update({'leg_FL': (-30, 0, 0), 'leg_FR': (-30, 0, 0), 'leg_BL': (20 + 6 * c, 0, 0), 'leg_BR': (20 + 6 * c, 0, 0)})
        poser.key(f, pose, loc={'root': (0, 0, 0.05 * h * c)})
    poser.end(L)


def move_sway(poser, ctx):
    """Plant: rooted shuffle, stem sways, flower nods."""
    poser.begin('move', loop=True)
    L = 32
    for i, f in enumerate((0, L // 4, L // 2, 3 * L // 4, L)):
        ph = i / 4 * math.pi * 2
        s, c = math.sin(ph), math.cos(ph)
        pose = {'body': (4 * s, 8 * c, 0), 'top': (10 * s, 0, 12 * c), 'arm_L': (0, 0, 10 * s), 'arm_R': (0, 0, 10 * s)}
        poser.key(f, pose, loc={'root': (0, 0, 0.03 * abs(s))}, scale={'body': sq(1 - 0.03 * s, 1 + 0.04 * s)})
    poser.end(L)


MOVES = dict(hop=move_hop, waddle=move_waddle, run=move_run, stomp=move_stomp, shamble=move_shamble, float=move_float,
             flutter=move_flutter, gallop=move_gallop, fly=move_fly, sway=move_sway)


# ---------------------------------------------------------------------------
# Idle (bestiary viewer, stunned pose base)
# ---------------------------------------------------------------------------

def idle(poser, ctx):
    poser.begin('idle', loop=True)
    L = 60
    for i, f in enumerate((0, L // 4, L // 2, 3 * L // 4, L)):
        ph = i / 4 * math.pi * 2
        s = math.sin(ph)
        pose = {'body': (2 * s, 0, 0), 'top': (3 * s, 0, 2 * math.cos(ph)), 'chest': (2 * s, 0, 0), 'head': (2 * s, 0, 3 * math.cos(ph)),
                'arm_L': (0, 0, 3 * s), 'arm_R': (0, 0, -3 * s)}
        pose.update(wings(ctx, 12, ph * 2))
        pose.update(tail_sway(ctx, 8, ph))
        poser.key(f, pose, loc={'root': (0, 0, 0.012 * s * ctx.get('height', 1.0))}, scale={'body': sq(1 + 0.02 * s, 1 - 0.02 * s)})
    poser.end(L)


# ---------------------------------------------------------------------------
# Hit reactions
# ---------------------------------------------------------------------------

def hit_squash(poser, ctx):
    poser.begin('hit', loop=False)
    poser.key(0, {'body': (0, 0, 0)}, scale={'body': sq(1, 1)})
    poser.key(3, {'body': (-12, 0, 0), 'top': (-18, 0, 0)}, loc={'root': (0, 0.06, 0)}, scale={'body': sq(1.25, 0.72)})
    poser.key(8, {'body': (5, 0, 0), 'top': (8, 0, 0)}, loc={'root': (0, 0.02, 0)}, scale={'body': sq(0.95, 1.1)})
    poser.key(12, {'body': (0, 0, 0), 'top': (0, 0, 0)}, loc={'root': (0, 0, 0)}, scale={'body': sq(1, 1)})
    poser.end(12)


def hit_recoil(poser, ctx):
    poser.begin('hit', loop=False)
    poser.key(0, {})
    poser.key(3, {'chest': (-18, 0, 10), 'head': (-25, 0, 12), 'hips': (-6, 0, 0), 'arm_L': (-40, 0, 30), 'arm_R': (-40, 0, -30), 'body': (-15, 0, 0)}, loc={'root': (0, 0.07 * ctx.get('height', 1.0), 0)})
    poser.key(7, {'chest': (6, 0, -4), 'head': (8, 0, -5), 'arm_L': (10, 0, 10), 'arm_R': (10, 0, -10), 'body': (5, 0, 0)}, loc={'root': (0, 0.02, 0)})
    poser.key(11, {}, loc={'root': (0, 0, 0)})
    poser.end(11)


HITS = dict(squash=hit_squash, recoil=hit_recoil)


# ---------------------------------------------------------------------------
# Deaths
# ---------------------------------------------------------------------------

def death_splat(poser, ctx):
    """Blob: pops up, then splats flat and melts into the ground."""
    poser.begin('death', loop=False)
    poser.key(0, {}, scale={'body': sq(1, 1)})
    poser.key(4, {'top': (-20, 0, 0)}, loc={'root': (0, 0, 0.12 * ctx.get('height', 1.0))}, scale={'body': sq(0.85, 1.25)})
    poser.key(9, {'top': (25, 0, 0)}, loc={'root': (0, 0, 0)}, scale={'body': sq(1.55, 0.3)})
    poser.key(16, {'top': (25, 0, 0)}, loc={'root': (0, 0, -0.02)}, scale={'body': sq(1.7, 0.08), 'top': 0.2})
    poser.end(16)


def death_topple(poser, ctx):
    """Biped: knocked onto its back, legs kick once, sinks a little."""
    poser.begin('death', loop=False)
    poser.key(0, {})
    poser.key(4, {'chest': (-25, 0, 0), 'head': (-30, 0, 0), 'arm_L': (-120, 0, 40), 'arm_R': (-120, 0, -40), 'hips': (-20, 0, 0)}, loc={'root': (0, 0.08, 0.06)})
    poser.key(10, {'hips': (-88, 0, 0), 'chest': (-10, 0, 0), 'head': (-10, 0, 0), 'arm_L': (-100, 0, 60), 'arm_R': (-100, 0, -60), 'leg_L': (-60, 0, 0), 'leg_R': (-40, 0, 0)}, loc={'root': (0, 0.18 * ctx.get('height', 1.0), 0.02)})
    poser.key(14, {'hips': (-92, 0, 0), 'chest': (-5, 0, 0), 'head': (-6, 0, 0), 'arm_L': (-95, 0, 70), 'arm_R': (-95, 0, -70), 'leg_L': (-30, 0, 0), 'leg_R': (-60, 0, 0)}, loc={'root': (0, 0.2 * ctx.get('height', 1.0), 0.0)})
    poser.key(20, {'hips': (-92, 0, 0), 'chest': (-5, 0, 0), 'head': (-8, 0, 0), 'arm_L': (-90, 0, 70), 'arm_R': (-90, 0, -70), 'leg_L': (-45, 0, 0), 'leg_R': (-45, 0, 0)}, loc={'root': (0, 0.2 * ctx.get('height', 1.0), -0.03)})
    poser.end(20)


def death_poof(poser, ctx):
    """Ghost / fae: spirals up, shrinks away."""
    poser.begin('death', loop=False)
    poser.key(0, {}, scale={'root': 1.0})
    poser.key(5, {'body': (-20, 0, 60), 'chest': (-20, 0, 60), 'head': (-15, 0, 0), 'top': (-10, 0, 0)}, loc={'root': (0, 0, 0.1)}, scale={'root': 1.1})
    poser.key(12, {'body': (-30, 0, 200), 'chest': (-30, 0, 200), 'top': (-20, 0, 0)}, loc={'root': (0, 0, 0.35 * ctx.get('height', 1.0))}, scale={'root': 0.55})
    poser.key(16, {'body': (-30, 0, 320), 'chest': (-30, 0, 320)}, loc={'root': (0, 0, 0.55 * ctx.get('height', 1.0))}, scale={'root': 0.02})
    poser.end(16)


def death_collapse(poser, ctx):
    """Construct / quadruped: legs give way, body drops and tilts."""
    poser.begin('death', loop=False)
    poser.key(0, {})
    poser.key(4, {'body': (-10, 0, 0), 'chest': (-10, 0, 0), 'head': (-15, 0, 10), 'leg_FL': (30, 0, 0), 'leg_FR': (-30, 0, 0), 'leg_L': (20, 0, 0), 'leg_R': (-20, 0, 0)}, loc={'root': (0, 0, 0.05)})
    poser.key(12, {'body': (12, 14, 0), 'chest': (10, 12, 0), 'hips': (0, 10, 0), 'head': (25, 0, 20), 'leg_FL': (-60, 0, 0), 'leg_FR': (60, 0, 0), 'leg_BL': (60, 0, 0), 'leg_BR': (-60, 0, 0), 'leg_L': (-70, 0, 0), 'leg_R': (70, 0, 0), 'arm_L': (-30, 0, 50), 'arm_R': (-30, 0, -50)}, loc={'root': (0, 0, -0.18 * ctx.get('height', 1.0))})
    poser.key(18, {'body': (14, 16, 0), 'chest': (12, 14, 0), 'hips': (0, 12, 0), 'head': (30, 0, 22), 'leg_FL': (-65, 0, 0), 'leg_FR': (65, 0, 0), 'leg_BL': (65, 0, 0), 'leg_BR': (-65, 0, 0), 'leg_L': (-75, 0, 0), 'leg_R': (75, 0, 0), 'arm_L': (-30, 0, 55), 'arm_R': (-30, 0, -55)}, loc={'root': (0, 0, -0.22 * ctx.get('height', 1.0))})
    poser.end(18)


def death_wilt(poser, ctx):
    """Plant: droops, folds over and shrinks."""
    poser.begin('death', loop=False)
    poser.key(0, {})
    poser.key(5, {'body': (-15, 0, 0), 'top': (-30, 0, 0), 'arm_L': (0, 0, 30), 'arm_R': (0, 0, -30)}, scale={'body': sq(1.1, 0.95)})
    poser.key(14, {'body': (45, 0, 0), 'top': (70, 0, 0), 'arm_L': (0, 0, -20), 'arm_R': (0, 0, 20)}, loc={'root': (0, 0, -0.1)}, scale={'body': sq(1.15, 0.55), 'top': 0.6})
    poser.key(18, {'body': (55, 0, 0), 'top': (80, 0, 0)}, loc={'root': (0, 0, -0.14)}, scale={'body': sq(1.2, 0.4), 'top': 0.4})
    poser.end(18)


DEATHS = dict(splat=death_splat, topple=death_topple, poof=death_poof, collapse=death_collapse, wilt=death_wilt)


# ---------------------------------------------------------------------------
# Specials
# ---------------------------------------------------------------------------

def special_cast(poser, ctx):
    """Field cast / summon: wind up low, then throw everything up, hold, settle."""
    poser.begin('special', loop=False)
    poser.key(0, {})
    poser.key(6, {'chest': (14, 0, 0), 'head': (12, 0, 0), 'arm_L': (20, 0, 10), 'arm_R': (20, 0, -10), 'body': (8, 0, 0), 'top': (10, 0, 0), 'leg_L': (-10, 0, 0), 'leg_R': (-10, 0, 0)}, scale={'body': sq(1.1, 0.9)})
    poser.key(11, {'chest': (-14, 0, 0), 'head': (-18, 0, 0), 'arm_L': (-160, 0, 30), 'arm_R': (-160, 0, -30), 'body': (-8, 0, 0), 'top': (-14, 0, 0)}, loc={'root': (0, 0, 0.08 * ctx.get('height', 1.0))}, scale={'body': sq(0.92, 1.18)})
    poser.key(22, {'chest': (-10, 0, 0), 'head': (-14, 0, 0), 'arm_L': (-150, 0, 40), 'arm_R': (-150, 0, -40), 'body': (-6, 0, 0), 'top': (-10, 0, 0)}, loc={'root': (0, 0, 0.06 * ctx.get('height', 1.0))}, scale={'body': sq(0.95, 1.12)})
    poser.key(30, {}, loc={'root': (0, 0, 0)}, scale={'body': sq(1, 1)})
    poser.end(30)


def special_siphon(poser, ctx):
    """Ghoul siphon: arms spread wide, leans back, head rolls, pulsing chest."""
    poser.begin('special', loop=False)
    poser.key(0, {})
    poser.key(6, {'chest': (-20, 0, 0), 'head': (-30, 0, 15), 'arm_L': (-80, 0, 70), 'arm_R': (-80, 0, -70), 'hips': (-5, 0, 0)}, scale={'chest': 1.08})
    poser.key(14, {'chest': (-24, 0, 0), 'head': (-34, 0, -15), 'arm_L': (-85, 0, 80), 'arm_R': (-85, 0, -80), 'hips': (-6, 0, 0)}, scale={'chest': 1.14})
    poser.key(22, {'chest': (-18, 0, 0), 'head': (-28, 0, 10), 'arm_L': (-80, 0, 70), 'arm_R': (-80, 0, -70)}, scale={'chest': 1.06})
    poser.key(30, {}, scale={'chest': 1.0})
    poser.end(30)


def special_blink(poser, ctx):
    """Blink wind-up: crouch, spin up, vanish-stretch."""
    poser.begin('special', loop=False)
    poser.key(0, {})
    poser.key(6, {'chest': (25, 0, 0), 'head': (-10, 0, 0), 'hips': (10, 0, 0), 'arm_L': (-30, 0, 20), 'arm_R': (-30, 0, -20), 'leg_L': (-20, 0, 0), 'leg_R': (-20, 0, 0), 'body': (10, 0, 0)}, loc={'root': (0, 0, -0.08 * ctx.get('height', 1.0))}, scale={'body': sq(1.1, 0.85)})
    poser.key(12, {'chest': (10, 0, 120), 'head': (-5, 0, 60), 'hips': (0, 0, 120), 'arm_L': (-60, 0, 40), 'arm_R': (-60, 0, -40), 'body': (0, 0, 160)}, loc={'root': (0, 0, 0.05)}, scale={'body': sq(0.9, 1.2)})
    poser.key(18, {'chest': (0, 0, 360), 'hips': (0, 0, 360), 'body': (0, 0, 360)}, loc={'root': (0, 0, 0.15 * ctx.get('height', 1.0))}, scale={'body': sq(0.7, 1.45)})
    poser.key(24, {}, loc={'root': (0, 0, 0)}, scale={'body': sq(1, 1)})
    poser.end(24)


def special_roar(poser, ctx):
    """Boss roar / charge wind-up: rear back, chest out, head up, wings flare."""
    poser.begin('special', loop=False)
    poser.key(0, {})
    p1 = {'chest': (-20, 0, 0), 'head': (-30, 0, 0), 'body': (-25, 0, 0), 'arm_L': (-60, 0, 50), 'arm_R': (-60, 0, -50), 'leg_FL': (-50, 0, 0), 'leg_FR': (-50, 0, 0), 'top': (-10, 0, 0)}
    p1.update(wings(ctx, 70))
    poser.key(8, p1, loc={'root': (0, 0.05, 0.05 * ctx.get('height', 1.0))})
    p2 = dict(p1)
    p2.update({'head': (-34, 0, 6), 'chest': (-22, 0, 0)})
    p2.update(wings(ctx, 60))
    poser.key(18, p2, loc={'root': (0, 0.05, 0.05 * ctx.get('height', 1.0))})
    poser.key(28, {}, loc={'root': (0, 0, 0)})
    poser.end(28)


SPECIALS = dict(cast=special_cast, siphon=special_siphon, blink=special_blink, roar=special_roar)
