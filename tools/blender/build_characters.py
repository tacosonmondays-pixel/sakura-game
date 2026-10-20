#!/usr/bin/env python3
"""Builds the chibi character GLBs with Blender (bpy 4.2).

    python3 tools/blender/build_characters.py [unitId ...] [--out public/models/characters]
                                              [--no-anim] [--blend out.blend] [--units units.json]

Reads the roster from src/data/units.js (through node + dump_units.mjs), builds every part
from subdivided cages, paints the face atlas with PIL, rigs, animates and exports one GLB
per unit (face atlas embedded, everything else vertex-coloured).
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)

import bpy  # noqa: E402
from mathutils import Vector, Matrix  # noqa: E402

UNIT_SCALE = 0.5

from lib import mesh as M  # noqa: E402
from lib import body, face, hair, outfit, accessory, weapon, halo, rig, anim, export, optimize, extras  # noqa: E402
from lib.proportions import proportions  # noqa: E402
from lib.hair import Head  # noqa: E402
from PIL import Image  # noqa: E402

DEFAULT_PALETTE = dict(hair='#8a6a5a', hairShade='#5a4038', eyes='#4a7fd0', skin='#ffe4d6', outfit='#ffffff',
                       outfitShade='#d0d8e8', accent='#ff6f91', halo='#bfe8ff', weapon='#c0c8d8')
DEFAULT_LOOK = dict(hairStyle='bob', bangs='straight', accessory='none', outfit='sailor', weapon='staff', halo='ring',
                    eyeStyle='round', expression='smile')

# Per-unit extra parts and horn shapes (tools-only, keyed by unit id — no unit schema change). Every extra is
# joined into the vertex-coloured body mesh, so a GLB keeps exactly three primitives (lib/extras.py).
EXTRA_PARTS = dict(luna=['foxTail'], hana=['falcon', 'quiver'], ruri=['foxFamiliar'], kanna=['taikoStand'],
                   tsubaki=['mortarTube'], kohaku=['monocle'], fuu=['tailBows'], ena=['cardDealer'], seiran=['flightHeadset'])
HORN_SHAPE = dict(raika='curl', seiran='crescent', kanna='oni')

# Tools-only look / palette / body-colour overrides keyed by unit id, merged in _build_unit() over the unit's own
# look and palette and over outfit.spec(). Display only: src/data stays untouched, so the co-op sim id does not
# change. They hold the temporary cage chibis of the six returning girls, matched to their painted portraits, until
# their Meshy figures replace them. PALETTE_OVERRIDES may also set the extra colour keys a library part reads
# (legwear, trim, tie, horn, skirt, vest...). A unit without an entry builds exactly as before.
# Face at 48 deg (critic round 2): from the battle camera the curved head bends level brows and lash lines into a V,
# so all six read stern with the shared face. They share BATTLE_FACE (lib/face.py opt-ins): no brows on the resting,
# blink and attack cells (brows / attackBrows 'none', as the imported chibis keep theirs under the fringe; even
# inner-raised 'tare' brows still bent into a scowl at battle size and read worried from the front), a lash line whose
# inner end does not dip and whose outer end sits a touch low, a lighter lid shadow, thinner brows on the cheer / hurt
# cells that keep them; a chin-up of 20-22 deg and bangs ending higher; Kanna and Yoriko get round eyes (their unit
# looks say 'sharp' / 'sleepy', which glared or looked bored from above), and the girls whose brows used the dark lash
# mix get them in a hair mid tone (browTone).
# Critic round 3: with no brows the upper lash lines still bent into a V at 48 deg (inner ends dropped towards the
# nose), so the girls read stern or bored next to the imported chibis. Each eye is now turned 9 deg inner corner up
# (eyeTilt; a level lash line at 48 deg, gently drooped from the front) and the lid shadow is lighter again (0.3).
BATTLE_FACE = dict(brows='none', attackBrows='none', lidDip=0.0, lidLift=-0.08, lidShade=0.3, browWidth=0.05, eyeTilt=9)
LOOK_OVERRIDES = dict(
    # Fuu (portrait, Oct 20): milk-chocolate twintails set high with mint ribbon bows, a gold leaf clip, an open mint
    # hooded track jacket with gold piping over a white sailor blouse, a big turbine fan
    fuu=dict(accessory='leafClip', outfit='trackJacket', weapon='turbineFan',
             tailEl=36, tailAz=106, tailLen=0.82, tailR=0.044, tailOut=0.11, tailCurl=0.045,
             bangRaise=10, chinUp=20, softFace=True, **BATTLE_FACE),
    # Iroha (portrait): plum-black bob with ONE high bun on her left + a round silver ornament on it (two buns read
    # as bear ears and are not in her painting), blunt fringe, charcoal sailor top + plum scarf under a long open
    # dusky-plum cardigan, black tights, loafers
    iroha=dict(hairStyle='bunsBob', bunSides=(1,), bangs='blunt', accessory='mirrorOrnament', outfit='sailorCardigan', eyeStyle='round', **BATTLE_FACE,
               bangRaise=8, browTone=0.55, chinUp=20, chinSplit=(0.6, 0.4)),
    # Ena (portrait): dusty rose-pink layers + ONE thick braid over her left shoulder with a crimson rose and ribbon,
    # black blazer piped in crimson over a long black cardigan, crimson tie, red tartan skirt, black tights,
    # loafers; a fan of pearl holo cards in her right hand, one card + a wrist dealer and red threads on the left;
    # halo 'crescent' (the quad-band moon): the unit's shared 'moon' renders as a magenta blob on her crown at 48 deg
    ena=dict(hairStyle='sideBraid', accessory='rose', outfit='blazerCardigan', weapon='roseCards', eyeStyle='round', softFace=True,
             halo='crescent', **BATTLE_FACE, bangRaise=8,
             chinUp=20, holdPose={'upper_arm_R': (-32, 0, -16), 'forearm_R': (-52, 0, 0)}, cardLean=36, cardSplay=-14),
    # Kanna (portrait, Oct 20): high coral-rose twin-tails with gold ring cuffs, two tall ivory oni horns, crimson staff
    # track jacket zipped up (black side panels, gold piping, black shirt + ivory tie), black slacks, crimson
    # high-tops, carbon bachi with glowing tips, her festival taiko on a stand beside her (EXTRA_PARTS)
    kanna=dict(outfit='staffTrack', weapon='bachi', tailEl=42, tailAz=86, tailLen=0.95, tailR=0.046, tailOut=0.12,
               tailCurl=0.05, tailDroop=0.3, tieT=0.35, tieLen=0.008, bangRaise=12, chinUp=20, eyeStyle='round', browTone=0.55,
               **BATTLE_FACE),
    # Yoriko (portrait, Oct 20): lilac high ponytail falling on her right, blunt bangs, a navy cat-ear stage headset
    # with glowing inner ears + mic, an indigo-navy stage frock coat open over a lilac waistcoat (lilac lapels, white
    # shirt, lilac tie, gold edging, long open tails with a lilac lining), navy gloves, trousers and ankle boots, and
    # the marionette rig raised in her left hand: an X control bar, glowing threads and a tiny doll in a school uniform
    yoriko=dict(accessory='catHeadset', outfit='stageCoat', weapon='marionette', bangRaise=12, chinUp=22, eyeStyle='round',
                browTone=0.55, **BATTLE_FACE,
                halo='crescent', ponyS=-1, ponyAz=112, ponyEl=38, ponyLen=1.25, ponyR=0.05, ponyOut=0.18, ponyCurl=0.04, ponyDroop=0.4,
                sideLen=1.0, sideFlare=0.015, sideWave=0.006,
                pin=dict(upper_arm_L=(-15, -95, 0), forearm_L=(0, -40, 0))),
    # Seiran (portrait, Oct 20): long pale sky-blue waves, two pale-gold crescent horns (HORN_SHAPE), white flight
    # headset (EXTRA_PARTS), light-blue flight jacket (gold piping, buttons and shoulder boards) over a white shirt +
    # teal tie, steel-blue pleated skirt, blue-grey tights, white flight boots, white storm spear with a glowing
    # ice-cyan blade; laughing grin
    seiran=dict(outfit='flightJacket', weapon='stormSpear', expression='cheerful', eyeStyle='round', **BATTLE_FACE,
                browTone=0.55, hairLen=1.12, bangRaise=13, chinUp=22),
)
PALETTE_OVERRIDES = dict(
    # Fuu: jade eyes, mint jacket + ribbons, mint pleated skirt, pine-green leggings, white high-tops
    fuu=dict(hair='#7f5240', hairShade='#4e3128', eyes='#2fae84', outfit='#95d4b3', outfitShade='#5e9e83',
             accent='#86e0be', weapon='#f6fcf8', trim='#e2b552', legwear='#2e5c49'),
    # Iroha: a deeper lavender than the unit's #c8bfe1 (her first chibi's #b9abe0 still read as a blank grey stare at
    # battle size)
    iroha=dict(eyes='#9a86d4'),
    # Ena: a little lighter so the hair reads rose-pink under battle light; pinker eyes than the unit's lilac-grey
    ena=dict(hair='#d38c9a', hairShade='#a15b70', eyes='#de5f97'),
    # Kanna: coral hair (her portrait's hue is about +6 deg, orange of red; the first #e6727c rendered pink-red, about
    # -5 deg), amber eyes (the unit's #efc562 rendered olive), carbon sticks; tie = the twin-tail ring cuffs, trim =
    # gold piping / zip / crest / stand fittings
    kanna=dict(hair='#e8705f', hairShade='#b04a40', eyes='#ffad33', weapon='#2a2430', tie='#e2b552', trim='#e2b552'),
    # Yoriko: hair a touch pinker and lighter than the unit's #ad94cb, violet eyes (the unit's pale #c6b8f1 reads
    # grey), a deeper indigo-navy coat; vest / lapel / lining / necktie lilacs, gold trim, silver ponytail cuff (tie),
    # an orchid halo colour for every glowing bit (the runtime saturates it)
    yoriko=dict(hair='#b49ad0', hairShade='#7d64a6', eyes='#9a72d0', outfit='#3a3474', outfitShade='#28235a', accent='#c4a6ea',
                halo='#e8dcf4', vest='#9a74c0', lapel='#b597dc', lining='#8d6cbf', necktie='#c9a8ea', trim='#e3bd62',
                tie='#d9d2ea', headset='#2b275d', bar='#3a3170'),
    # Seiran: hair paler than the unit's #80b9e4 (the portrait reads almost ice-blue), teal-cyan eyes (the unit's pale
    # #c0e9f2 vanishes on the white of the eye), a lighter sky-blue jacket; horn = the crescent horns, trim = gold
    # piping / buttons / boards, skirt = the steel-blue pleats, weapon = the white spear shaft
    seiran=dict(hair='#bde0f5', hairShade='#7ba8d3', eyes='#46b4cc', outfit='#8cbce2', outfitShade='#4d78a8',
                horn='#e8cf86', trim='#e2b552', skirt='#4a79aa', weapon='#eef2f7'),
)
SPEC_OVERRIDES = dict(
    iroha=dict(cardigan='#7a4b6c', legwear='#2a2530', collar='#2c2d36', turtleneck='#2a2630'),
    ena=dict(skirt='#b8293f', tartan='#6a1626', tartanLine='#1c1418', legwear='#2e2329', cardigan='#30272e'),
    kanna=dict(legwear='#262027', shoe='#a8263b', sole='#f3b257'),
    yoriko=dict(legwear='#2d2f5e', shoe='#2a2650', sole='#1c1938', glove='#2e2a62'),
    seiran=dict(legwear='#56739a', shoe='#f2f5f9', sole='#5d7398'),
)


def load_units(path=None):
    # the dump is UTF-8 (names, titles); Windows would otherwise read it in the ANSI code page
    if path and os.path.exists(path):
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    with tempfile.TemporaryDirectory(prefix='sakura_units_') as tmpdir:
        tmp = os.path.join(tmpdir, 'units.json')
        subprocess.run(['node', os.path.join(HERE, 'dump_units.mjs'), tmp], check=True, cwd=ROOT)
        with open(tmp, encoding='utf-8') as f:
            return json.load(f)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = anim.FPS
    sc.frame_start = 0
    sc.frame_end = 72
    sc.unit_settings.system = 'METRIC'


def build_unit(unit, out_dir, animations=True, keep_blend=None, lod=False):
    # the face atlas PNGs live in a private temp folder that is removed once the GLB is written
    tmpdir = tempfile.mkdtemp(prefix='sakura_face_')
    try:
        return _build_unit(unit, out_dir, tmpdir, animations, keep_blend, lod)
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def _build_unit(unit, out_dir, tmpdir, animations, keep_blend, lod):
    t0 = time.time()
    reset_scene()
    M.LEVEL_DROP[0] = 1 if lod else 0
    uid = unit['id']
    pal = {**DEFAULT_PALETTE, **(unit.get('palette') or {}), **PALETTE_OVERRIDES.get(uid, {})}
    look = {**DEFAULT_LOOK, **(unit.get('look') or {}), **LOOK_OVERRIDES.get(uid, {})}
    adult = bool(unit.get('adult') or unit.get('kind') == 'hero')
    P = proportions(adult)
    spec = {**outfit.spec(look, pal), **SPEC_OVERRIDES.get(uid, {})}
    ctx = dict(unit=unit, pal=pal, look=look, P=P, spec=spec, parts=[], hair_bones=[], H=Head(P), adult=adult,
               weapon_kind=weapon.kind_of(look['weapon']), horn_shape=HORN_SHAPE.get(unit['id']))

    # --- face atlas ---
    atlas_path = os.path.join(tmpdir, f'{unit["id"]}_face.png')
    cell = 341 if adult else 256
    face.write_atlas({**unit, 'palette': pal, 'look': look, 'adult': adult}, atlas_path, cell_px=cell, eye_v=P['eye_v'])
    # optimised copy for the final GLB (palette PNG)
    opt_path = os.path.join(tmpdir, f'{unit["id"]}_face_opt.png')
    img = Image.open(atlas_path).convert('RGB')
    img.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(opt_path, optimize=True)

    # --- body ---
    skin = pal['skin']
    head_obj = body.head(P, skin)
    ctx['head_obj'] = head_obj
    parts = [head_obj]
    parts += body.ears(P, skin)
    parts.append(body.neck(P, skin))
    parts.append(body.torso(P, spec['top']))
    parts += body.arms(P, skin, sleeve=spec['sleeve'], sleeve_len=spec['sleeve_len'], glove=spec['glove'])
    parts += body.legs(P, skin, sock=spec['sock'], sock_len=spec['sock_len'], tights=spec['legwear'])
    parts += body.shoes(P, spec['shoe'], sole=spec['sole'])
    ctx['parts'] += parts
    hair.build(ctx)
    outfit.build(ctx)
    accessory.build(ctx)
    weapon.build(ctx)
    halo.build(ctx)
    extras.build(ctx, EXTRA_PARTS.get(unit['id'], []))

    # --- materials ---
    mats = export.make_materials(atlas_path, pal['halo'])
    for o in ctx['parts']:
        export.assign_material(o, mats[o.get('material', 'body')])
    mesh_obj = M.join(ctx['parts'], name=f'chibi_{unit["id"]}')
    rig.normalize_weights(mesh_obj)
    # everything is stored at half size so positions fit normalized int16 ([-1, 1]);
    # the runtime scales the root by extras.unitScale
    mesh_obj.data.transform(Matrix.Scale(UNIT_SCALE, 4))
    mesh_obj.data.update()

    # --- armature ---
    # dedupe hair bones by name
    seen = {}
    for hb in ctx['hair_bones']:
        seen[hb[0]] = hb
    bones = [(n, h * UNIT_SCALE, t * UNIT_SCALE, p) for n, h, t, p in rig.bone_table(P, list(seen.values()))]
    arm = rig.build_armature(bones, name=f'rig_{unit["id"]}')
    rig.bind(mesh_obj, arm)
    rig.normalize_weights(mesh_obj)
    clips = anim.build_all(arm, ctx, loc_scale=UNIT_SCALE) if animations else []

    # --- export ---
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, f'{unit["id"]}{".lod" if lod else ""}.glb')
    export.export_glb(out, [arm, mesh_obj], animations=animations)
    export.replace_image(out, opt_path, extras=dict(
        unit=unit['id'], height=P['height'], unitScale=1.0 / UNIT_SCALE, weaponKind=ctx['weapon_kind'], faceCells=face.CELLS,
        faceGrid=face.GRID, lod=lod, generator='tools/blender/build_characters.py'))
    optimize.optimize_glb(out)
    info = export.describe(out)
    if keep_blend:
        export.pack_images()  # the atlas temp folder is deleted, so the .blend keeps its own copy
        bpy.ops.wm.save_as_mainfile(filepath=keep_blend)
    info['seconds'] = round(time.time() - t0, 1)
    print(f'[build] {unit["id"]}{" (lod)" if lod else ""}: {info["size"] // 1024} KB, {info["vertices"]} verts, {info["primitives"]} prims, bones {info["bones"]}, clips {info["animations"]}, {info["seconds"]}s')
    return info


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('ids', nargs='*')
    ap.add_argument('--out', default=os.path.join(ROOT, 'public', 'models', 'characters'))
    ap.add_argument('--no-anim', action='store_true')
    ap.add_argument('--blend', default=None, help='save the last built character as a .blend for inspection')
    ap.add_argument('--units', default=None, help='units JSON (default: dumped from src/data/units.js)')
    ap.add_argument('--no-lod', action='store_true', help='skip the <id>.lod.glb (medium/low quality) build')
    ap.add_argument('--force-procedural', action='store_true', help='also rebuild units whose manifest entry is an imported Meshy model')
    args = ap.parse_args()
    units = load_units(args.units)
    ids = args.ids or [u['id'] for u in units]
    by_id = {u['id']: u for u in units}
    manifest_path = os.path.join(args.out, 'manifest.json')
    existing = {}
    if os.path.exists(manifest_path):
        with open(manifest_path) as f:
            existing = json.load(f)
    results = {}
    for uid in ids:
        if uid not in by_id:
            print(f'[build] unknown unit {uid}', file=sys.stderr)
            continue
        if existing.get(uid, {}).get('source') == 'meshy' and not args.force_procedural:
            # imported figure (tools/meshy/build_meshy_chibi.py): never overwrite it with a cage build
            print(f'[build] {uid}: kept the imported Meshy model (use --force-procedural to replace it)')
            continue
        full = build_unit(by_id[uid], args.out, animations=not args.no_anim, keep_blend=args.blend)
        lod = None if args.no_lod else build_unit(by_id[uid], args.out, animations=not args.no_anim, lod=True)
        results[uid] = (full, lod)
    manifest_path = os.path.join(args.out, 'manifest.json')
    manifest = {}
    if os.path.exists(manifest_path):
        with open(manifest_path) as f:
            manifest = json.load(f)
    for uid, (info, lod) in results.items():
        entry = dict(file=f'{uid}.glb', size=info['size'], animations=info['animations'], vertices=info['vertices'])
        if lod:
            entry.update(lod=f'{uid}.lod.glb', lodSize=lod['size'], lodVertices=lod['vertices'])
        elif uid in manifest and manifest[uid].get('lod'):
            entry.update({k: manifest[uid][k] for k in ('lod', 'lodSize', 'lodVertices') if k in manifest[uid]})
        manifest[uid] = entry
    with open(manifest_path, 'w') as f:
        json.dump(dict(sorted(manifest.items())), f, indent=1)
    total = sum(v['size'] for v in manifest.values())
    lod_total = sum(v.get('lodSize', 0) for v in manifest.values())
    print(f'[build] manifest: {len(manifest)} units, {total // 1024} KB full + {lod_total // 1024} KB lod')


if __name__ == '__main__':
    main()
