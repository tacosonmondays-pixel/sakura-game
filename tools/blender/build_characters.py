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
from lib import body, face, hair, outfit, accessory, weapon, halo, rig, anim, export, optimize  # noqa: E402
from lib.proportions import proportions  # noqa: E402
from lib.hair import Head  # noqa: E402
from PIL import Image  # noqa: E402

DEFAULT_PALETTE = dict(hair='#8a6a5a', hairShade='#5a4038', eyes='#4a7fd0', skin='#ffe4d6', outfit='#ffffff',
                       outfitShade='#d0d8e8', accent='#ff6f91', halo='#bfe8ff', weapon='#c0c8d8')
DEFAULT_LOOK = dict(hairStyle='bob', bangs='straight', accessory='none', outfit='sailor', weapon='staff', halo='ring',
                    eyeStyle='round', expression='smile')


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
    pal = {**DEFAULT_PALETTE, **(unit.get('palette') or {})}
    look = {**DEFAULT_LOOK, **(unit.get('look') or {})}
    adult = bool(unit.get('adult') or unit.get('kind') == 'hero')
    P = proportions(adult)
    spec = outfit.spec(look, pal)
    ctx = dict(unit=unit, pal=pal, look=look, P=P, spec=spec, parts=[], hair_bones=[], H=Head(P), adult=adult,
               weapon_kind=weapon.kind_of(look['weapon']))

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
    args = ap.parse_args()
    units = load_units(args.units)
    ids = args.ids or [u['id'] for u in units]
    by_id = {u['id']: u for u in units}
    results = {}
    for uid in ids:
        if uid not in by_id:
            print(f'[build] unknown unit {uid}', file=sys.stderr)
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
