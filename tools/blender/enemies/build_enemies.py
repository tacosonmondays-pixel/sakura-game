#!/usr/bin/env python3
"""Builds the enemy family GLBs with Blender (bpy 4.2), one rigged base per family.

    python3 tools/blender/enemies/build_enemies.py [family ...] [--out public/models/enemies]
                                                   [--no-anim] [--blend out.blend] [--data enemies.json]

Reads the bestiary from src/data/enemies.js (node + dump_enemies.mjs) so every GLB only
carries the props / variant pieces its family's defs use. Shares the chibi pipeline's cage,
rig, animation and GLB helpers (tools/blender/lib). Output:

  public/models/enemies/<family>.glb   mesh objects named "<vis>|<group>|<material>"
                                       vis: base | prop:<name> | var:<variant>
                                       material: body (tinted vertex colours + face atlas) | glow (unlit)
  public/models/enemies/manifest.json  { family: { file, size, vertices, animations, props, variants, height, unitScale } }
"""
import argparse
import json
import math
import os
import subprocess
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.abspath(os.path.join(HERE, '..'))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE)
sys.path.insert(0, TOOLS)

import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

from lib import mesh as M  # noqa: E402
from lib import export, rig as R  # noqa: E402
import efaces, erig, eanim, pack, parts as P  # noqa: E402
import families  # noqa: E402


def load_data(path=None):
    if path and os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    tmp = os.path.join(tempfile.gettempdir(), 'sakura_enemies.json')
    subprocess.run(['node', os.path.join(HERE, 'dump_enemies.mjs'), tmp], check=True, cwd=ROOT)
    with open(tmp) as f:
        return json.load(f)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = eanim.FPS
    sc.frame_start = 0
    sc.frame_end = 72
    sc.unit_settings.system = 'METRIC'


def make_materials(atlas_path):
    body = bpy.data.materials.new('body')
    body.use_nodes = True
    nt = body.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 0.85
    tex = nt.nodes.new('ShaderNodeTexImage')
    img = bpy.data.images.load(atlas_path)
    img.name = os.path.basename(atlas_path)
    tex.image = img
    tex.interpolation = 'Linear'
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
    try:
        body.blend_method = 'CLIP'
    except Exception:
        pass
    # NOTE: no Vertex Color node here — when a material consumes the colour attribute the
    # exporter writes COLOR_0 the way the material uses it (RGB only) and the tint-role
    # alpha is lost. The runtime replaces the materials anyway.
    glow = bpy.data.materials.new('glow')
    glow.use_nodes = True
    bsdf = glow.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Emission Strength'].default_value = 2.0
    return dict(body=body, glow=glow)


def join_parts(ctx):
    """Joins parts per (vis, group, material); base groups no variant hides collapse into
    one 'main' object so a plain enemy is a single draw call per material."""
    hideable = set()
    for v in ctx.get('variants', {}).values():
        hideable |= set(v.get('hide', []))
    buckets = {}
    for o in ctx['parts']:
        vis, group, mat = o['vis'], o['group'], o['material']
        if vis == 'base' and group not in hideable:
            group = 'main'
        buckets.setdefault((vis, group, mat), []).append(o)
    out = []
    for (vis, group, mat), objs in buckets.items():
        # three.js' GLTFLoader strips ':' '.' '/' from node names, so 'prop:x' is stored as 'prop-x'
        name = f"{vis.replace(':', '-')}|{group}|{mat}"
        j = M.join(objs, name=name)
        j.name = name
        j['vis'] = vis
        j['group'] = group
        j['material'] = mat
        out.append(j)
    return out


def max_extent(objs):
    m = 0.0
    for o in objs:
        for v in o.data.vertices:
            m = max(m, abs(v.co.x), abs(v.co.y), abs(v.co.z))
    return m


def build_family(fam, data, out_dir, animations=True, keep_blend=None):
    t0 = time.time()
    reset_scene()
    defs = [e for e in data['enemies'] if e['model']['base'] == fam or e['family'] == fam]
    props_used = set()
    variants_used = set()
    for e in defs:
        props_used |= set(e['model'].get('props') or [])
        variants_used.add(e['model'].get('variant') or 'basic')
    ctx = dict(family=fam, defs=defs, parts=[], bones=[], anchors={}, done=set(), variants={}, props_used=props_used,
               variants_used=variants_used, clips={}, height=1.0, translucent=0.0, extras={}, tiers={e['tier'] for e in defs})
    mod = families.get(fam)
    mod.build(ctx)
    missing = props_used - ctx['done'] - {o['vis'][5:] for o in ctx['parts'] if o['vis'].startswith('prop:')}
    if missing:
        print(f'[build] {fam}: props without geometry: {sorted(missing)}')
    # --- face atlas ---
    tmpdir = tempfile.mkdtemp(prefix='sakura_enemy_')
    atlas_path = os.path.join(tmpdir, f'{fam}_face.png')
    efaces.write_atlas(fam, atlas_path, cell_px=ctx.get('face_px', 128), spec=ctx.get('face_spec'))
    opt_path = os.path.join(tmpdir, f'{fam}_face_opt.png')
    efaces.write_atlas_small(atlas_path, opt_path)
    # --- UVs for parts without a face, materials ---
    mats = make_materials(atlas_path)
    for o in ctx['parts']:
        if not o.data.uv_layers:
            P.corner_uvs(o)
        export.assign_material(o, mats[o['material']])
    objs = join_parts(ctx)
    # --- scale so every coordinate fits normalised int16 ---
    ext = max_extent(objs)
    scale = min(0.5, math.floor(0.94 / max(ext, 1e-3) * 100) / 100)
    for o in objs:
        o.data.transform(Matrix.Scale(scale, 4))
        o.data.update()
    # --- armature + clips ---
    ctx['parts'] = objs
    arm = erig.build(ctx, scale=scale)
    clips = eanim.build_clips(arm, ctx, loc_scale=scale) if animations else []
    # --- export ---
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, f'{fam}.glb')
    export.export_glb(out, [arm] + objs, animations=animations)
    variants = {k: v for k, v in ctx['variants'].items()}
    extras = dict(family=fam, height=ctx['height'], unitScale=1.0 / scale, faceCells=efaces.CELLS, faceGrid=[efaces.COLS, efaces.ROWS],
                  faceCorner=[P.CORNER_UV[0], 1.0 - P.CORNER_UV[1]],
                  translucent=ctx.get('translucent', 0.0), variants=variants, props=sorted(ctx['props_used']), clips=ctx['clips'],
                  generator='tools/blender/enemies/build_enemies.py', **ctx.get('extras', {}))
    export.replace_image(out, opt_path, extras=extras)
    stats = pack.pack_glb(out)
    info = export.describe(out)
    info.update(vertices=stats['vertices'], roles=stats['alpha_roles'], props=sorted(ctx['props_used']), variants=sorted(variants_used),
                height=ctx['height'], unitScale=1.0 / scale, seconds=round(time.time() - t0, 1), objects=[o.name for o in objs])
    if keep_blend:
        bpy.ops.wm.save_as_mainfile(filepath=keep_blend)
    print(f"[build] {fam}: {info['size'] // 1024} KB, {info['vertices']} verts, {info['primitives']} prims, bones {info['bones']}, clips {info['animations']}, roles {info['roles']}, {info['seconds']}s")
    return info


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('families', nargs='*')
    ap.add_argument('--out', default=os.path.join(ROOT, 'public', 'models', 'enemies'))
    ap.add_argument('--no-anim', action='store_true')
    ap.add_argument('--blend', default=None, help='save the last built family as a .blend for inspection')
    ap.add_argument('--data', default=None, help='bestiary JSON (default: dumped from src/data/enemies.js)')
    args = ap.parse_args()
    data = load_data(args.data)
    fams = args.families or data['families']
    manifest_path = os.path.join(args.out, 'manifest.json')
    manifest = {}
    if os.path.exists(manifest_path):
        with open(manifest_path) as f:
            manifest = json.load(f)
    for fam in fams:
        if fam not in families.FAMILIES:
            print(f'[build] unknown family {fam}', file=sys.stderr)
            continue
        info = build_family(fam, data, args.out, animations=not args.no_anim, keep_blend=args.blend)
        manifest[fam] = dict(file=f'{fam}.glb', size=info['size'], vertices=info['vertices'], animations=info['animations'],
                             props=info['props'], variants=info['variants'], height=info['height'], unitScale=info['unitScale'])
    with open(manifest_path, 'w') as f:
        json.dump(dict(sorted(manifest.items())), f, indent=1)
    total = sum(v['size'] for v in manifest.values())
    print(f'[build] manifest: {len(manifest)} families, {total // 1024} KB total')


if __name__ == '__main__':
    main()
