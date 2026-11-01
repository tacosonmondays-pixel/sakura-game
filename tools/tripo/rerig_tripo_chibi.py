"""Re-rig the Tripo website heroes from their shipped GLBs (the batch-2 autorig left them in a T-pose).

    blender -b --python-use-system-env --python tools/tripo/rerig_tripo_chibi.py -- --id luna [--preview DIR]
    (or python3.11 with the bpy 4.2 module: python3.11 tools/tripo/rerig_tripo_chibi.py --id luna)

Why: tools/tripo/tripolib/autorig.py fitted Luna's arm line to her fox tail and put her arms, staff and tail on the
head, chest and thigh bones; on Nami, Kanna and Yoriko the shoulder joints landed halfway down the arms. The clips
lowered bones that carried almost nothing, so all four stood in a T-pose, and their idle moved 3 degrees. The raw
website downloads are not in git, so this rebuilds each figure from its own shipped file (characters/<id>.glb and
<id>.lod.glb, each from itself: no second decimation), keeping its mesh, UVs and base-colour WebP byte for byte:
  1. import, drop the old rig and clips, weld the UV-seam splits, scale to 1 m (feet on z = 0, facing -Y)
  2. fit the rig from the figure's landmarks (FIGURES, measured on its front / side / top views in the 1 m frame;
     tripolib/rerig.py), tail bones where she has a tail
  3. skin: bone heat plus the figure's region rules (props wholly on their hand, the tail on the tail bones, side
     hair and twin tails off the arms)
  4. lively clips (tripolib/clips_hero.py): idle / walk / attack_<kind> / cheer / hurt
  5. GLB export, the Meshy phone packing (tools/meshy/lib/pack.py), then the shipped base-colour WebP put back
     (compat.transplant_image), manifest entry refreshed
Kogane and Norika (batch 1) keep Tripo's own rig and weights (`keep_rig`): only their clips are authored again, the
arms hanging lower and a livelier idle. The sources come from git (--from-rev, default SOURCE_REV), so running this
again never re-rigs its own output. --preview DIR renders the bind pose by dominant bone and each clip (front and
3/4) into DIR/<id>-<detail>-clips.png. Display only: no sim data changes. Notes: docs/art/tripo/model-quality.md."""
import argparse
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)

from tripolib import normalize, rerig, clips_hero, compat  # noqa: E402
from tripolib.meshy import pack  # noqa: E402

GAME_HEIGHT = 1.224
STORE_SCALE = 0.5
# the commit whose characters/<id>.glb are the batch-2 autorig builds (main at v0.1.68, before this re-rig)
SOURCE_REV = 'a3d97a38'


def _luna_tail(x, y, z):
    behind = (y > 0.005) & (z < 0.62) & ~((abs(x) < 0.14) & (z > 0.3) & (y < 0.06))
    side = (x > 0.15) & (y > -0.07) & (z < 0.62)
    return behind | side


# Landmarks in the 1 m frame (feet z = 0, facing -Y, her left +X), read off each figure's front, side and top
# views with a 0.05 grid. arm_z: the arm line; shoulder_x: the shoulder joint; hand_x: the hand tips (her left,
# her right); props: regions wholly on one hand; pin: regions wholly on one bone; tail: chain points + region.
FIGURES = {
    # the moon-fox mage: staff in her right hand, a big fox tail behind her left side
    'luna': dict(
        arm_z=0.48, shoulder_x=0.09, hand_x={'L': 0.27, 'R': 0.27}, arm_band=0.05,
        props=[dict(bone='hand_R', capsules=[((-0.185, -0.15, 0.0), (-0.30, -0.15, 0.84), 0.04)],
                    boxes=[((-0.47, -0.3, 0.58), (-0.18, 0.0, 0.93))])],
        tail=dict(points=[(0.05, 0.0, 0.18), (0.18, 0.1, 0.17), (0.3, 0.17, 0.3), (0.34, 0.2, 0.54)], rule=_luna_tail),
        attack='attack_cast',
        style=dict(prop='R', grip=(0.115, -0.06, -0.015), pole=(0.03, 0.05, -0.12), hand=(0, 18, 0), free_down=78,
                   chin=-16.0, attack='staff', tail=True),
    ),
    # the captain: trident in her left hand, long wavy hair behind the arms
    'nami': dict(
        arm_z=0.49, shoulder_x=0.1, hand_x={'L': 0.25, 'R': 0.38}, arm_band=0.045,
        props=[dict(bone='hand_L', capsules=[((0.145, 0.02), (0.31, 0.92), 0.035, (-0.12, 0.12))],
                    boxes=[((0.17, -0.12, 0.7), (0.43, 0.12, 0.98))])],
        pin=[dict(bone='head', boxes=[((0.11, 0.035, 0.3), (0.3, 0.3, 0.72)), ((-0.3, 0.035, 0.3), (-0.11, 0.3, 0.72))])],
        attack='attack_thrust',
        style=dict(prop='L', grip=(0.1, -0.07, -0.01), pole=(0.03, 0.05, -0.12), hand=(0, -12, 0), free_down=76,
                   chin=-16.0, attack='thrust'),
    ),
    # the drummer: free hands, twin tails hanging behind the arms (their own bones, so they sway and never
    # follow the arms), drum on her left hip
    'kanna': dict(
        arm_z=0.545, shoulder_x=0.1, hand_x={'L': 0.34, 'R': 0.34}, arm_band=0.045,
        chains=[dict(name=f'hair_{s}', parent='head',
                     points=[(k * 0.25, 0.08, 0.86), (k * 0.32, 0.1, 0.68), (k * 0.31, 0.12, 0.5), (k * 0.29, 0.12, 0.33)],
                     boxes=[((min(k * 0.17, k * 0.42), -0.05, 0.3), (max(k * 0.17, k * 0.42), 0.3, 0.95))],
                     minus=[((-0.4, -0.07, 0.495), (-0.1, 0.055, 0.6)), ((0.1, -0.07, 0.495), (0.4, 0.055, 0.6))])
                for s, k in (('L', 1), ('R', -1))],
        pin=[dict(bone='hips', boxes=[((0.06, -0.2, 0.29), (0.215, 0.12, 0.47))])],
        attack='attack_smash',
        style=dict(free_down=74, chin=-13.0, attack='smash'),
    ),
    # the puppeteer: the control bar in her left hand (the doll hangs under it, src/render/marionette.js)
    'yoriko': dict(
        arm_z=0.53, shoulder_x=0.1, hand_x={'L': 0.26, 'R': 0.356}, arm_band=0.045,
        props=[dict(bone='hand_L', boxes=[((0.245, -0.12, 0.43), (0.43, 0.18, 0.63))])],
        attack='attack_cast',
        style=dict(prop='L', grip=(0.12, -0.06, -0.035), pole=(0.03, 0.06, -0.12), hand=(0, 0, 0), free_down=76,
                   chin=-13.0, attack='control'),
    ),
    # batch 1 staff heroes: Tripo's own rig (arms bound well) with near-T rest arms (Norika 9, Kogane 19 degrees down)
    # that the batch-1 clips lowered only 38 degrees more, and an idle that moved 3 degrees. Every clip is authored
    # again on the same rig and weights: arms hang to about 70 degrees, the batch-1 attacks from that hang.
    'kogane': dict(keep_rig=True, replace=['idle', 'walk', 'attack', 'cheer', 'hurt'], attack='attack_wrench',
                   style=dict(free_down=46, shoulder_down=12, chin=-14.0, attack='swing', sway=0.9)),
    'norika': dict(keep_rig=True, replace=['idle', 'walk', 'attack', 'cheer', 'hurt'], attack='attack_sign',
                   style=dict(free_down=52, shoulder_down=18, chin=-20.0, attack='raise', sway=0.9)),
}


def build(fig_id, fig, detail, args):
    full = detail == 'full'
    src = os.path.join(args.src_dir, f'{fig_id}{"" if full else ".lod"}.glb')
    normalize.reset()
    arm, meshes = normalize.import_glb(src)
    assert len(meshes) == 1, f'{src}: expected one mesh, got {len(meshes)}'
    body = meshes[0]
    if fig.get('keep_rig'):
        return rebuild_clips(fig_id, fig, detail, args, arm, body)
    rerig.strip(arm, meshes)
    normalize.bake_world(None, meshes)
    normalize.scale_to(None, meshes, 1.0)
    rerig.weld(body)
    V = rerig.verts(body)
    L = rerig.landmarks(V, fig)
    arm = rerig.build_armature(L, fig, name=f'{fig_id}_rig')
    rep = rerig.skin(body, arm, L, fig)
    print(f'[rerig] {fig_id} {detail}: landmarks {json.dumps({k: (round(v, 3) if isinstance(v, float) else v) for k, v in L.items()})}')
    print(f'[rerig] {fig_id} {detail}: skin {json.dumps(rep)}')
    body.name = body.data.name = fig_id
    normalize.name_base_image([body])
    bpy.context.scene.render.fps = clips_hero.FPS
    hc = clips_hero.HeroClips(arm, fig['style'])
    hc.build(fig['attack'])
    if args.ual:
        stock_clips(hc, fig, args)
    return finish(fig_id, fig, detail, args, arm, body)


STOCK_SECONDS = {'idle': 1.5, 'walk': 1.0, 'attack': 0.6, 'cheer': 1.2, 'hurt': 0.4}


def stock_clips(hc, fig, args):
    """--ual: replace clips with retargeted stock motion (tripolib/retarget_ual.py), e.g.
    --ual-map idle=Idle_Loop,attack=Spell_Simple_Shoot (an experiment for the render-and-look comparison)."""
    from tripolib import retarget_ual
    pairs = dict(kv.split('=') for kv in args.ual_map.split(','))
    data, src_hip = retarget_ual.sample(args.ual, sorted(set(pairs.values())))
    for clip, src in pairs.items():
        name = fig['attack'] if clip == 'attack' else clip
        old = bpy.data.actions.get(name)
        if old:
            bpy.data.actions.remove(old)
        hc.stock(name, data[src], src_hip, STOCK_SECONDS[clip])
        print(f'[rerig] stock clip {name} <- {src} ({len(data[src])} frames)')
    hc.arm.animation_data.action = None


def rebuild_clips(fig_id, fig, detail, args, arm, body):
    """A figure whose Tripo rig is sound (Kogane, Norika: rigged by Tripo's own animate_rig in batch 1): keep the rig,
    weights and the clips that read well, and author the listed ones again (`replace`, e.g. their near-still idle)
    with tripolib/clips_hero.py."""
    normalize.bake_world(arm, [body])
    normalize.scale_to(arm, [body], 1.0)
    replace = set(fig['replace'])
    old = {}
    for act in list(bpy.data.actions):
        base = act.name.split('_' + arm.name)[0] if arm.name in act.name else act.name
        if base in replace or (base.startswith('attack') and 'attack' in replace):
            bpy.data.actions.remove(act)
        else:
            act.name = base
            act.use_fake_user = True
            old[base] = act
    print(f'[rerig] {fig_id} {detail}: kept clips {sorted(old)}, replacing {sorted(replace)}')
    arm.animation_data_create()
    bpy.context.scene.render.fps = clips_hero.FPS
    hc = clips_hero.HeroClips(arm, fig['style'])
    for name in sorted(replace):
        if name == 'attack':
            hc.attack(fig['attack'])
        else:
            getattr(hc, name)()
    arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
    body.name = body.data.name = fig_id
    normalize.name_base_image([body])
    return finish(fig_id, fig, detail, args, arm, body)


def finish(fig_id, fig, detail, args, arm, body):
    full = detail == 'full'
    if args.preview:
        preview(fig_id, detail, arm, body, args.preview)
        if args.preview_only:
            return None
    tmp = tempfile.mkdtemp(prefix='rerig_')
    raw = os.path.join(tmp, 'raw.glb')
    normalize.export_glb(raw, [arm, body])
    out = os.path.join(args.out, f'{fig_id}{"" if full else ".lod"}.glb')
    extras = dict(unit=fig_id, source='tripo', style='textured', height=GAME_HEIGHT,
                  unitScale=round(GAME_HEIGHT / STORE_SCALE, 5), weaponKind=fig['attack'].split('_', 1)[1],
                  lod=not full, generator='tools/tripo/rerig_tripo_chibi.py')
    packed = os.path.join(tmp, 'packed.glb')
    stats = pack.pack(raw, packed, STORE_SCALE, extras, webp_quality=90, tex_size=1024 if full else 512)
    kept = compat.transplant_image(args.shipped[detail], packed)
    shutil.copy(packed, out)
    js, _ = pack.read_glb(out)
    verts = sum(js['accessors'][p['attributes']['POSITION']]['count'] for m in js['meshes'] for p in m['primitives'])
    tri = sum(js['accessors'][p['indices']]['count'] // 3 for m in js['meshes'] for p in m['primitives'])
    info = dict(size=os.path.getsize(out), vertices=verts, triangles=tri, animations=sorted(a['name'] for a in js['animations']))
    print(f'[rerig] {fig_id} {detail}: {info["size"] // 1024} KB, {tri} tris, {verts} verts, clips {info["animations"]}, '
          f'{stats["channels"]} channels / {stats["keys"]} keys, shipped texture kept: {kept is not None}')
    return info


# ---- previews ------------------------------------------------------------------------------------------------
def preview(fig_id, detail, arm, body, out_dir):
    """Workbench renders: the bind pose by dominant bone, and three frames of each clip from the front and 3/4."""
    import colorsys
    os.makedirs(out_dir, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'
    sc.render.resolution_x = sc.render.resolution_y = 420
    if not sc.world:
        sc.world = bpy.data.worlds.new('w')
    cam = bpy.data.objects.new('pv_cam', bpy.data.cameras.new('pv_cam'))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 1.15
    views = {'front': ((0, -4, 0.5), (90, 0, 0)), 'q34': ((2.6, -2.6, 2.4), (62, 0, 45))}
    frames = []
    # weights
    col = body.data.color_attributes.new('bone', 'BYTE_COLOR', 'POINT')
    gname = {g.index: g.name for g in body.vertex_groups}
    order = {}
    for v in body.data.vertices:
        best, bw = None, -1
        for g in v.groups:
            if g.weight > bw:
                bw, best = g.weight, gname[g.group]
        order.setdefault(best, len(order))
        r, g_, b = colorsys.hsv_to_rgb((order[best] * 0.618) % 1.0, 0.7, 0.95)
        col.data[v.index].color = (r, g_, b, 1)
    body.data.color_attributes.active_color = col
    arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
    sc.display.shading.color_type = 'VERTEX'
    for vn, (loc, rot) in views.items():
        cam.location = loc
        cam.rotation_euler = [math.radians(a) for a in rot]
        p = os.path.join(out_dir, f'_w_{vn}.png')
        sc.render.filepath = p
        bpy.ops.render.render(write_still=True)
        frames.append(('weights ' + vn, p))
    sc.display.shading.color_type = 'TEXTURE'
    for act in [a for a in bpy.data.actions]:
        arm.animation_data.action = act
        lo, hi = act.frame_range
        for i, fr in enumerate((lo, lo + (hi - lo) * 0.4, lo + (hi - lo) * 0.7)):
            sc.frame_set(int(round(fr)))
            for vn, (loc, rot) in views.items():
                if vn == 'q34' and i != 1:
                    continue
                cam.location = loc
                cam.rotation_euler = [math.radians(a) for a in rot]
                p = os.path.join(out_dir, f'_{act.name}_{i}_{vn}.png')
                sc.render.filepath = p
                bpy.ops.render.render(write_still=True)
                frames.append((f'{act.name} {int(fr)} {vn}', p))
    arm.animation_data.action = None
    body.data.color_attributes.remove(col)
    try:
        from PIL import Image, ImageDraw
        cols, T = 6, 420
        rows = (len(frames) + cols - 1) // cols
        sheet = Image.new('RGB', (cols * T, rows * T), (40, 40, 40))
        for i, (label, p) in enumerate(frames):
            im = Image.open(p).convert('RGB')
            ImageDraw.Draw(im).text((4, 4), label, fill=(255, 255, 0))
            sheet.paste(im, ((i % cols) * T, (i // cols) * T))
            os.remove(p)
        sheet.save(os.path.join(out_dir, f'{fig_id}-{detail}-clips.png'))
        print(f'[rerig] preview {os.path.join(out_dir, f"{fig_id}-{detail}-clips.png")}')
    except ImportError:
        print('[rerig] preview frames left in', out_dir, '(no Pillow for the sheet)')


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument('--id', required=True, help='a figure in FIGURES (luna, nami, kanna, yoriko)')
    ap.add_argument('--out', default=os.path.join(ROOT, 'public', 'models', 'characters'))
    ap.add_argument('--preview', default=None, help='render a clip sheet into this folder')
    ap.add_argument('--preview-only', action='store_true', help='with --preview: render, write no GLB')
    ap.add_argument('--detail', default='both', choices=['both', 'full', 'lod'])
    ap.add_argument('--ual', default=None, help='experiment: the CC0 Universal Animation Library GLB (kept outside the repo)')
    ap.add_argument('--ual-map', default='idle=Idle_Loop,walk=Walk_Loop,attack=Spell_Simple_Shoot,cheer=Dance_Loop,hurt=Hit_Chest')
    ap.add_argument('--from-rev', default=SOURCE_REV,
                    help='git revision holding the batch-2 files to rebuild from (default: the last one before the re-rig); '
                         "'' = the files on disk")
    args = ap.parse_args(argv)
    fig = FIGURES[args.id]
    # the batch-2 files are the sources: taken from git (so a rebuild never re-rigs its own output) or copied
    # aside from disk, before the build overwrites them
    keep = tempfile.mkdtemp(prefix=f'rerig_src_{args.id}_')
    args.src_dir = keep
    args.shipped = {}
    for d, suffix in (('full', ''), ('lod', '.lod')):
        name = f'{args.id}{suffix}.glb'
        dst = os.path.join(keep, name)
        if args.from_rev:
            rel = f'public/models/characters/{name}'
            blob = subprocess.run(['git', '-C', ROOT, 'show', f'{args.from_rev}:{rel}'], check=True, capture_output=True).stdout
            with open(dst, 'wb') as f:
                f.write(blob)
        else:
            shutil.copy(os.path.join(args.out, name), dst)
        args.shipped[d] = dst
    infos = {}
    for d in (['full', 'lod'] if args.detail == 'both' else [args.detail]):
        infos[d] = build(args.id, fig, d, args)
    if args.preview_only or args.detail != 'both':
        return
    mpath = os.path.join(args.out, 'manifest.json')
    manifest = json.load(open(mpath))
    full, lod = infos['full'], infos['lod']
    manifest[args.id] = dict(file=f'{args.id}.glb', size=full['size'], animations=full['animations'], vertices=full['vertices'],
                             triangles=full['triangles'], source='tripo', lod=f'{args.id}.lod.glb', lodSize=lod['size'],
                             lodVertices=lod['vertices'], lodTriangles=lod['triangles'])
    with open(mpath, 'w') as f:
        json.dump(dict(sorted(manifest.items())), f, indent=1)
        f.write('\n')
    print(f'[rerig] manifest updated: {args.id}')


if __name__ == '__main__':
    main()
    sys.stdout.flush()
    os._exit(0)
