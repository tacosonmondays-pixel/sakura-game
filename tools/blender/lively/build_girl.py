"""Rig rollout steps 2-3 (VERDICT §8.2-8.3): Hikari, Hana, Ruri get the four shared library clips bought once on
Noa's Meshy rig R1 (01a161e7-e213-71d6-9caa-b1a75a432788), retargeted onto their SHIPPED skeletons, through the
same chibi post-pass as Noa (step 1). 0 credits.

    blender -b --factory-startup --python build_girl.py -- <hikari|hana|ruri> <full|lod> [--sheet]

Clips (paths.MESHY_CLIPS):
    idle   338 Short_Breathe_and_Look_Around
    happy  415 Happy_Sway_Standing            (between-wave mood loop)
    cheer  298 Cheer_with_Both_Hands_Up       (+ head clearance; victory falls back to it)
    hurt   178 Hit_Reaction                   (root's horizontal travel stripped, feet pinned, cut to 1.2 s)
kept from the shipped GLB: attack_*, walk, and the old idle / cheer / hurt as idle_short / cheer_short /
hurt_short (the 'Lively figures: off' fallback).

Post-pass per new clip: face bone x0.6 (neck x0.75 when the face has its own head bone); mean world face
pitch to her shipped idle's; a per-frame face guard (never more than 5.3 deg chin-down of that); head
clearance (head sphere measured from her mesh); prop wrists locked; root travel eased back and clamped
(hurt: stripped); feet pinned by two-bone IK; every clip resampled to 20 fps.

Per girl:
  hikari  58-bone owner rig: Meshy Head -> her `neck` (her face is skinned across neck + head: driving the head
          bone alone would shear it), Hips -> `root`, hands -> `wrist_*`. Sword hand: her shipped guard arm
          (idle / happy / hurt) or the clip's arm with the wrist locked (cheer); sword grip from her shipped
          idle. Hair / bangs / coat chains are left to the runtime springs (livelyRig.js).
  hana    bow + falconry glove on the LEFT hand: hand_L locked. Kaze is a separate companion (bone unweighted).
  ruri    her book hangs at her left hip (skinned to hips) under her left hand: hand_L locked and the left
          arm's swing damped so the hand stays at the book. Kon is a separate companion (bone unweighted)."""
import json
import math
import os
import sys
import time

import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from paths import GIRLS, MESHY_CLIPS  # noqa: E402
import girllib as G  # noqa: E402
from girllib import L  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
GIRL = argv[0] if argv else 'hana'
DETAIL = argv[1] if len(argv) > 1 else 'full'
SHEET = '--sheet' in argv
ROOT = GIRLS
SRC = ROOT + f'src/{GIRL}.ship{".lod" if DETAIL == "lod" else ""}.glb'
MESHY = MESHY_CLIPS
OUTD = ROOT + 'out/'
CHECK = ROOT + 'check/'
os.makedirs(OUTD, exist_ok=True)
os.makedirs(CHECK, exist_ok=True)
CLIPS = [
    ('A2_breathe_look_338.glb', 'idle', 338),
    ('A3_happy_sway_415.glb', 'happy', 415),
    ('A7b_cheer_hands_up_298.glb', 'cheer', 298),
    ('A5_hit_reaction_178.glb', 'hurt', 178),
]
HURT_LEN = 1.2
HURT_BODY = 0.55
FACE_SLACK = 5.3  # Noa: target -17.3, guard -12

BASE_MAP = {k: v for k, v in L.MESHY_TO_OURS.items() if v not in ('head_end', 'head_front')}
STD_SHARES = [('spine1', 0.25), ('chest', 0.2), ('neck', 0.2), ('head', 0.35)]
PROFILES = {
    'hikari': dict(
        arm='hikari_rig', body='hikari', root='root', face='neck', hand='wrist', neck_joint='neck',
        head_bones={'neck', 'head', 'bangs1', 'bangs2'},
        bmap={**{k: v for k, v in BASE_MAP.items() if k != 'neck'}, 'Hips': 'root', 'Head': 'neck', 'LeftHand': 'wrist_L', 'RightHand': 'wrist_R'},
        damp={'neck': 0.6}, shares=[('spine1', 0.25), ('chest', 0.2), ('neck', 0.55)],
        wrists=['wrist_R'], body_damp=['root', 'spine', 'spine1', 'chest'],
        # sword arm: the library cheer's right arm swung the blade across her face on 9 of 37 frames (front and
        # 48 deg camera, first build): her designed shipped arm poses instead, the guard (idle / happy / hurt)
        # and the shipped cheer's raised salute (blade up and out to her right); the left arm cheers
        guard=dict(side='R', bones=['shoulder_R', 'upper_arm_R', 'forearm_R', 'wrist_R'],
                   src={'idle': 'idle', 'happy': 'idle', 'hurt': 'idle', 'cheer': 'cheer'}),
        grip=['finger1_R', 'finger2_R', 'thumb1_R', 'thumb2_R', 'thumb3_R'],
        arm_damp={}),
    'hana': dict(
        arm='hana_rig', body='hana', root='hips', face='head', hand='hand', neck_joint='head',
        head_bones={'head', 'head_end', 'head_front'}, bmap=BASE_MAP,
        damp={'neck': 0.75, 'head': 0.6}, shares=STD_SHARES, wrists=['hand_L'], body_damp=['hips', 'spine', 'spine1', 'chest'],
        # bow arm: with the library arm and the wrist locked, the bow crossed her chin from the 48 deg camera in
        # the hurt (first build): her bow arm keeps its shipped pose (bow upright at her side; the shipped
        # cheer's for the cheer), the right arm and the body take the new clip
        guard=dict(side='L', bones=['shoulder_L', 'upper_arm_L', 'forearm_L', 'hand_L'],
                   src={'idle': 'idle', 'happy': 'idle', 'hurt': 'idle', 'cheer': 'cheer'}),
        grip=[], arm_damp={}),
    'ruri': dict(
        arm='ruri_rig', body='ruri', root='hips', face='head', hand='hand', neck_joint='head',
        head_bones={'head', 'head_end', 'head_front'}, bmap=BASE_MAP,
        damp={'neck': 0.75, 'head': 0.6}, shares=STD_SHARES, wrists=['hand_L'], body_damp=['hips', 'spine', 'spine1', 'chest'],
        guard=None, grip=[], arm_damp={'upper_arm_L': 0.6, 'forearm_L': 0.6}),
}
PR = PROFILES[GIRL]
OUT = {'girl': GIRL, 'detail': DETAIL, 'clips': {}, 'started': time.strftime('%Y-%m-%d %H:%M:%S')}
T0 = time.time()


def log(*a):
    print(f'[{GIRL}]', f'{time.time() - T0:6.1f}s', *a)
    sys.stdout.flush()


def read_extras(path):
    from lib import pack as P
    js, _ = P.read_glb(path)
    return js['asset'].get('extras', {})


EX = read_extras(SRC)
TO_GAME = float(EX['unitScale'])

# ------------------------------------------------------------------ import
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = G.FPS_SRC
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=SRC)
for o in [o for o in bpy.data.objects if o not in before]:
    if o.type == 'MESH' and o.name.startswith('Icosphere'):
        bpy.data.objects.remove(o)
arm = bpy.data.objects[PR['arm']]
body = bpy.data.objects[PR['body']]
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
log('imported', SRC, 'meshes', [(o.name, o.parent.name if o.parent else None, o.parent_type, o.parent_bone) for o in meshes],
    'arm mw identity', arm.matrix_world == Matrix.Identity(4))
FACE = PR['face']
HB_C, HB_R, HB_INFO = G.head_sphere(arm, body, PR['head_bones'], PR['neck_joint'])
OUT['head_sphere'] = HB_INFO
log('head sphere', HB_C[:], HB_INFO)
old = {a.name: a for a in bpy.data.actions}
log('shipped actions', sorted(old))
OUT['shipped'] = {}
for nm in ('idle', 'cheer', 'hurt'):
    OUT['shipped'][nm] = G.measure(arm, old[nm], TO_GAME, FACE, HB_C, HB_R, PR['hand'], PR['root'])
    p = G.world_pitch(arm, old[nm], FACE)
    fa = G.face_angle(arm, old[nm], FACE)
    OUT['shipped'][nm]['face_pitch_mean_min_max'] = [round(float(p.mean()), 2), round(float(p.min()), 2), round(float(p.max()), 2)]
    OUT['shipped'][nm]['face_angle_mean_max'] = [round(float(fa.mean()), 1), round(float(fa.max()), 1)]
TARGET = OUT['shipped']['idle']['face_pitch_mean_min_max'][0]
YAW_TARGET = float(G.world_yaw(arm, old['idle'], FACE).mean())
OUT['face_yaw_target'] = round(YAW_TARGET, 2)
LIMIT = TARGET + FACE_SLACK
OUT['face_pitch_target'] = TARGET
OUT['face_guard_limit'] = LIMIT
# Hikari: her shipped guard arm and sword grip (mean local rotations of her shipped idle)
GUARD_Q = {}  # (shipped source clip, bone) -> mean local rotation
if PR['guard'] or PR['grip']:
    srcs = set(PR['guard']['src'].values()) if PR['guard'] else set()
    for s in srcs | {'idle'}:
        for b in (PR['guard']['bones'] if PR['guard'] else []) + PR['grip']:
            q = G.mean_local_quat(old[s], b)
            if q is not None:
                GUARD_Q[(s, b)] = q
    log('guard / grip from the shipped clips', {f'{s}.{b}': [round(x, 3) for x in q] for (s, b), q in GUARD_Q.items()})
WRIST_Q = {w: G.mean_local_quat(old['idle'], w) for w in PR['wrists']}
WRIST_Q = {w: q for w, q in WRIST_Q.items() if q is not None}
OUT['wrist_ship'] = {w: [round(x, 3) for x in q] for w, q in WRIST_Q.items()}
for nm in ('idle', 'cheer', 'hurt'):
    old[nm].name = nm + '_short'
for a in bpy.data.actions:
    a.use_fake_user = True

for o in meshes:
    o.hide_viewport = True
for fname, clip, lib_id in CLIPS + PR.get('variants', []):
    act, k_leg = G.retarget_clip(arm, MESHY + fname, clip, PR['bmap'], PR['root'])
    info = dict(src=fname, library_id=lib_id, k_leg=round(k_leg, 4))
    info['before'] = G.measure(arm, act, TO_GAME, FACE, HB_C, HB_R, PR['hand'], PR['root'])
    p = G.world_pitch(arm, act, FACE)
    info['before']['face_pitch_mean_min_max'] = [round(float(p.mean()), 2), round(float(p.min()), 2), round(float(p.max()), 2)]
    if clip == 'hurt':
        f0, f1 = L.frame_range(act)
        L.trim_action(act, int(f0), int(f0 + round(HURT_LEN * G.FPS_SRC)))
        info['trim'] = [0.0, HURT_LEN]
        G.damp_bones(arm, act, PR['body_damp'], HURT_BODY)
        info['body_damp'] = HURT_BODY
    # held props: the wrist is locked at the grip relation her shipped idle holds it in (Hana's bow stands
    # upright along her forearm, as shipped); a bone her shipped idle never turns is locked straight
    wrists = list(PR['wrists'])
    sides = ('L', 'R')
    if PR['guard'] and clip in PR['guard']['src']:
        s = PR['guard']['src'][clip]
        for b in PR['guard']['bones']:  # a bone her shipped clip never turns is held at rest
            G.const_quat(act, arm, b, GUARD_Q.get((s, b)) or Quaternion())
        wrists = [w for w in wrists if w not in PR['guard']['bones']]
        sides = tuple(x for x in ('L', 'R') if x != PR['guard']['side'])
        info['prop_arm'] = f'{PR["guard"]["side"]}: shipped {s} arm pose (mean)'
    elif PR['guard']:
        info['prop_arm'] = 'clip, wrist straight' if clip.endswith('__wid') else 'clip, wrist held at the shipped relation'
    for w in wrists:
        q = Quaternion() if clip.endswith('__wid') else (WRIST_Q.get(w) or Quaternion())
        G.const_quat(act, arm, w, q)
    info['wrist_hold'] = {w: [round(x, 3) for x in (Quaternion() if clip.endswith('__wid') else (WRIST_Q.get(w) or Quaternion()))] for w in wrists}
    wrists = []
    for b in PR['grip']:
        if ('idle', b) in GUARD_Q:
            G.const_quat(act, arm, b, GUARD_Q[('idle', b)])
    if PR['arm_damp']:
        for b, k in PR['arm_damp'].items():
            G.damp_bones(arm, act, [b], k)
        info['arm_damp'] = PR['arm_damp']
    info['postpass'] = G.post_pass(act, arm, PR['damp'], wrists, FACE, TARGET, 22.0, PR['shares'])
    info['face_guard'] = G.face_guard(arm, act, FACE, LIMIT, PR['shares'])
    # mean face yaw back to her shipped idle's (the 338 idle stands ~13 deg turned to her right; once the head
    # is damped the hurt's face follows its body twist): after the damping, before the feet are pinned
    for _ in range(2):
        y0 = float(G.world_yaw(arm, act, FACE).mean())
        G.turn_clip(arm, act, PR['root'], YAW_TARGET - y0)
        info['yaw_turn_deg'] = round(info.get('yaw_turn_deg', 0.0) + YAW_TARGET - y0, 2)
    info['head_clearance_deg'] = G.head_clearance(act, arm, FACE, HB_C, HB_R, sides=sides, hand=PR['hand'])
    if clip == 'hurt':
        info['root_xz_peak_game_m'] = round(G.strip_xz(arm, act, PR['root'], TO_GAME), 3)
        info['feet'] = G.pin_feet(arm, act, TO_GAME, mode='stance', lift=0.35)
    else:
        peak, kept = L.clamp_hips_xz(act, arm, PR['root'], 0.15, TO_GAME)
        info['root_xz_peak_game_m'] = round(peak, 3)
        info['root_xz_kept_game_m'] = round(kept, 3)
        info['feet'] = G.pin_feet(arm, act, TO_GAME, mode='plants')
    info['after'] = G.measure(arm, act, TO_GAME, FACE, HB_C, HB_R, PR['hand'], PR['root'])
    p = G.world_pitch(arm, act, FACE)
    info['after']['face_pitch_mean_min_max'] = [round(float(p.mean()), 2), round(float(p.min()), 2), round(float(p.max()), 2)]
    info['after']['face_hidden_s'] = round(float((p > LIMIT + 1.5).sum()) / G.FPS_SRC, 3)
    fa = G.face_angle(arm, act, FACE)
    info['after']['face_angle_mean_max'] = [round(float(fa.mean()), 1), round(float(fa.max()), 1)]
    info['after']['face_angle_over50_s'] = round(float((fa > 50).sum()) / G.FPS_SRC, 3)
    yw = G.world_yaw(arm, act, FACE)
    info['after']['face_yaw_mean_min_max'] = [round(float(yw.mean()), 1), round(float(yw.min()), 1), round(float(yw.max()), 1)]
    OUT['clips'][clip] = info
    log(clip, json.dumps({k: info.get(k) for k in ('face_guard', 'head_clearance_deg', 'root_xz_peak_game_m', 'feet', 'prop_arm')}),
        'after', json.dumps(info['after']))
arm.animation_data.action = None

OUT['resample'] = {}
for a in bpy.data.actions:
    OUT['resample'][a.name] = G.resample(a)
sc.render.fps = G.FPS_OUT
log('resampled', json.dumps(OUT['resample']))
for o in meshes:
    o.hide_viewport = False


# ------------------------------------------------------------------ Hikari: does the blade ever cross her face?
def blade_check(act, sword):
    L.assign(arm, act)
    f0, f1 = (int(round(x)) for x in L.frame_range(act))
    vs = [v.co for v in sword.data.vertices]
    tip_l = max(vs, key=lambda c: c.length)
    eyes = EX['eyes']['centers']
    ec = (G.g2b(eyes[0]) + G.g2b(eyes[1])) / 2
    span = (G.g2b(eyes[0]) - G.g2b(eyes[1])).length
    face_r = span * 1.05
    Rb = arm.data.bones[FACE].matrix_local
    local = Rb.inverted() @ (arm.matrix_world.inverted() @ ec)
    cams = {'front': Vector((0, -math.cos(math.radians(8)), math.sin(math.radians(8)))), 'battle': G.CAM48}
    res = {k: [] for k in cams}
    for f in range(f0, f1 + 1):
        sc.frame_set(f)
        c = arm.matrix_world @ (arm.pose.bones[FACE].matrix @ local)
        Ms = sword.matrix_world
        a, b = Ms @ Vector((0, 0, 0)), Ms @ tip_l
        for k, d in cams.items():
            best = None
            for s in np.linspace(0, 1, 24):
                p = a.lerp(b, float(s))
                q = p - c
                inplane = q - d * q.dot(d)
                dist = inplane.length
                if best is None or dist < best[0]:
                    best = (dist, q.dot(d))
            if best[0] < face_r and best[1] > 0:
                res[k].append(f)
    return {k: dict(frames=len(v), first=v[:6]) for k, v in res.items()}, round(face_r, 4)


sword = bpy.data.objects.get('sword')
if sword is not None:
    OUT['blade'] = {}
    for a in bpy.data.actions:
        OUT['blade'][a.name], fr = blade_check(a, sword)
    OUT['blade_face_r'] = fr
    log('blade over face (frames, 20 fps)', json.dumps(OUT['blade']))
arm.animation_data.action = None

# ------------------------------------------------------------------ contact sheets (Workbench, full detail only)
if SHEET and DETAIL == 'full':
    from PIL import Image, ImageDraw
    cams = G.sheet_setup(cell=260)
    tmp = CHECK + f'_cells_{GIRL}/'
    os.makedirs(tmp, exist_ok=True)
    attack = [a.name for a in bpy.data.actions if a.name.startswith('attack')]
    extra = [a.name for a in bpy.data.actions if a.name.endswith('__wid')]
    for clip in ['idle', 'happy', 'cheer'] + extra + ['hurt', 'idle_short', 'cheer_short'] + attack:
        act = bpy.data.actions[clip]
        L.assign(arm, act)
        f0, f1 = L.frame_range(act)
        n = 8 if clip in ('idle', 'happy') else 6
        times = [f0 + (f1 - f0) * i / (n - 1) for i in range(n)]
        rows = []
        for cn, cam in cams.items():
            row = []
            for i, f in enumerate(times):
                sc.frame_set(int(math.floor(f)), subframe=f - math.floor(f))
                pth = tmp + f'{clip}_{cn}_{i}.png'
                G.render_cell(pth, cam)
                row.append(Image.open(pth).convert('RGB'))
            rows.append(row)
        w, h = rows[0][0].size
        sh = Image.new('RGB', (w * n, h * 2), (255, 255, 255))
        d = ImageDraw.Draw(sh)
        for j, row in enumerate(rows):
            for i, im in enumerate(row):
                sh.paste(im, (i * w, j * h))
                d.text((i * w + 4, j * h + 4), f'{clip} {(times[i] - f0) / G.FPS_OUT:.2f}s {list(cams)[j]}', fill=(30, 20, 40))
        sh.save(CHECK + f'{GIRL}_{clip}.png')
    arm.animation_data.action = None
    log('sheets written')

# the cheer variant with fewer blade-over-face frames is kept (ties keep the guard-relation wrist)
for a in [a for a in bpy.data.actions if a.name.endswith('__wid')]:
    base = a.name[:-5]
    bl = OUT.get('blade', {})
    n_v = sum(v['frames'] for v in bl.get(a.name, {}).values())
    n_b = sum(v['frames'] for v in bl.get(base, {}).values())
    if n_v < n_b:
        bpy.data.actions.remove(bpy.data.actions[base])
        a.name = base
        OUT['clips'][base] = OUT['clips'].pop(a.name + '__wid', OUT['clips'].get(base + '__wid'))
        OUT['clips'].pop(base + '__wid', None)
        OUT['variant_kept'] = f'{base}: wrist straight ({n_v} blade-over-face frames vs {n_b})'
    else:
        bpy.data.actions.remove(a)
        OUT['clips'].pop(base + '__wid', None)
        OUT['variant_kept'] = f'{base}: wrist at the guard relation ({n_b} blade-over-face frames vs {n_v} straight)'
    log(OUT['variant_kept'])

raw = OUTD + f'{GIRL}_{DETAIL}.raw.glb'
L.export_glb(raw, [arm] + meshes)
log('exported', raw, os.path.getsize(raw))
json.dump(OUT, open(OUTD + f'build_{GIRL}_{DETAIL}.json', 'w'), indent=1)
log('DONE')
sys.stdout.flush()
os._exit(0)
