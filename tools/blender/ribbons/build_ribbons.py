#!/usr/bin/env python3
"""Bakes the Honor Ribbons in the 3D-flat look of the item icons (EEVEE, emission-only toon + ink hulls).

    blender --background --factory-startup --python-use-system-env --python tools/blender/ribbons/build_ribbons.py -- \
        [ids ...] [--out public/art/honors] [--scratch DIR] [--pylibs DIR] [--sheet PNG] [--blend debug.blend]
    python3 tools/blender/ribbons/build_ribbons.py [same arguments]     # bpy module (tools/blender/requirements.txt)

The shapes are the ribbon's own art (src/art/honors.js): node dump_ribbons.mjs writes every ribbon's class silhouette
as polygons in the 64-unit art box, its colourway and its emblem rasterised from the game's SVG. This script stands
the silhouette up in 3D with the item rig's materials and light (tools/blender/items/rig.py): folded tails, a pleated
rosette whose pleats catch the light one by one, a second pleat ring and a foil dome on shiny and special ribbons, a
star halo behind the specials, the emblem printed on the dome with a soft emboss, and the ink hulls. The camera looks
straight at the art box, so a baked ribbon sits exactly where its SVG did and the CSS effect masks (honorMasks) still
fit it. The render covers the box plus PAD units a side (the ink reaches past it); the game draws the picture with the
same overflow (src/ui/styles/honors.css .rb-bake).

Outputs <id>-256.webp (detail, fanfare) and <id>-128.webp (grid, rows, toasts) into --out and rewrites
src/art/honorArt.js (content hashes for ?v=). Display only: nothing here reaches the save or the sim.
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
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
ITEMS = os.path.join(HERE, '..', 'items')
sys.path.insert(0, ITEMS)                     # rig.py, parts.py, post.py
sys.path.insert(1, os.path.dirname(HERE))     # tools/blender (lib/colors.py)

PAD = 2.0          # art-box units rendered past each side (64 + 2 * PAD = 68)
SIZE = 272         # render px: 4 px per art unit
CX, CY = 32.0, 27.0
INK = '#1d1a3a'
WEBP = dict(quality=90, alpha_quality=100, method=6)
OUT_PX = (256, 128)   # of the 68-unit box


def _args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser(description='Bake the 3D-flat Honor Ribbons.')
    ap.add_argument('ids', nargs='*', help='achievement ids (default: every ribbon)')
    ap.add_argument('--out', default=os.path.join(ROOT, 'public', 'art', 'honors'))
    ap.add_argument('--manifest', default=os.path.join(ROOT, 'src', 'art', 'honorArt.js'))
    ap.add_argument('--scratch', default=os.environ.get('RIBBONS_SCRATCH') or os.path.join(tempfile.gettempdir(), 'ribbon-art'))
    ap.add_argument('--data', default=None, help='ribbons.json from dump_ribbons.mjs (default: run node)')
    ap.add_argument('--node', default=os.environ.get('NODE', 'node'))
    ap.add_argument('--pylibs', default=os.environ.get('ITEMS_PYLIBS'), help='extra site folder (Pillow for Blender)')
    ap.add_argument('--samples', type=int, default=32)
    ap.add_argument('--sheet', default=None, help='contact sheet PNG of everything built')
    ap.add_argument('--blend', default=None)
    return ap.parse_args(argv)


# ---------------------------------------------------------------------------
# Colours
# ---------------------------------------------------------------------------

def _rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def mix(a, b, t):
    a, b = _rgb(a), _rgb(b)
    return '#%02x%02x%02x' % tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def ink(c):
    return mix(c, INK, 0.38)


# ---------------------------------------------------------------------------
# Geometry (art units → world: x right, z up, the viewer at -Y; one art unit = 1/32)
# ---------------------------------------------------------------------------

U = 1.0 / 32.0


def w2(x, y):
    return ((x - 32.0) * U, (32.0 - y) * U)


def build(row, sil, emblem_png):
    import bmesh
    import bpy
    import parts
    import rig
    from mathutils import Vector

    c = row['c']
    pl, pd, d1, d2, t1, t2, acc = c[:7]
    in2 = c[7] if len(c) > 7 else '#ffffff'
    cls = row['cls']
    objs = []

    def keep(o):
        objs.append(o)
        return o

    # ---- the star halo behind a special (a thin plate at the back) ----
    if sil['aura']:
        au = row['aura'] or '#ffffff'
        o = parts.slab([w2(*p) for p in sil['aura']], 0.05, bevel=0.012, seg=2, name='aura')
        parts.xf(o, loc=(0, 0.16, 0))
        rig.style(o, au, mix(au, '#ffffff', 0.7), mix(au, pd, 0.32), ink(pd), steps=(0.40, 0.70, 0.03), line=2.0, rim=0.4)
        keep(o)

    # ---- tails: each folded along its length, the left half toward the light ----
    for i, t in enumerate(sil['tails']):
        pts = [w2(*p) for p in t]
        o = parts.slab(pts, 0.06, bevel=0.012, seg=2, name='tail%d' % i)
        xs = [p[0] for p in pts]
        xc = (min(xs) + max(xs)) / 2
        me = o.data
        for v in me.vertices:
            # a crease down the middle: both halves lean back from it (a pressed silk tail)
            v.co.y += abs(v.co.x - xc) * 0.55 + 0.10 - (v.co.z + 1.0) * 0.03
        me.update()
        rig.style(o, t1, mix(t1, '#ffffff', 0.45), mix(t1, t2, 0.62), ink(t2), deep=t2, steps=(0.30, 0.74, 0.03),
                  line=2.2, rim=0.5, smooth=False)
        keep(o)

    def pleats(outline, r_in, depth, y0, ridge, name, base, light, shadow, line):
        n = len(outline)
        ang = [math.atan2(-(p[1] - CY), p[0] - CX) for p in outline]
        outer = [w2(*p) for p in outline]
        cx, cz = w2(CX, CY)
        inner = [(cx + math.cos(a) * r_in * U, cz + math.sin(a) * r_in * U) for a in ang]
        o = parts.ring_slab(outer, inner, depth, name=name)
        parts.xf(o, loc=(0, y0, 0))
        rmax = max(math.hypot(p[0] - CX, p[1] - CY) for p in outline)
        me = o.data
        for v in me.vertices:
            if v.co.y > y0:      # the back stays flat
                continue
            r = math.hypot(v.co.x - cx, v.co.z - cz) / U
            if r > rmax - 0.6:   # a pleat's point comes toward the viewer, its valley stays back
                v.co.y -= ridge
            elif r > r_in + 0.5:
                v.co.y -= ridge * 0.15
            else:
                v.co.y -= ridge * 0.55
        me.update()
        rig.style(o, base, light, shadow, ink(pd), steps=(0.46, 0.66, 0.02), line=line, rim=0.35, smooth=False)
        return keep(o)

    disc = sil['disc']
    pleats(sil['outer'], disc - 1.5, 0.05, 0.06, 0.09, 'pleats', pl, mix(pl, '#ffffff', 0.5), mix(pl, pd, 0.42), 2.4)
    if sil['inner']:
        pleats(sil['inner'], disc - 1.5, 0.04, 0.0, 0.07, 'pleats2', in2, mix(in2, '#ffffff', 0.6), mix(in2, pd, 0.30), 1.8)

    # ---- the dome (the medal face) and its thin white rim ----
    dx, dz = w2(CX, CY)
    dome_h = 0.10 if cls == 'plain' else 0.13
    o = parts.sphere(disc * U, segs=64, rings=24, name='dome', scale=(1.0, dome_h / (disc * U), 1.0))
    parts.xf(o, loc=(dx, -0.06, dz))
    foil = cls != 'plain'
    rig.style(o, mix(d1, d2, 0.35), mix(d1, '#ffffff', 0.55), d2, ink(pd), deep=mix(d2, pd, 0.5), steps=(0.22, 0.78, 0.03),
              spec=0.9 if foil else 0.0, spec_at=0.985, sheen=0.55 if cls == 'special' else (0.3 if foil else 0.0),
              sheen_at=-0.46, line=2.4, rim=0.6, smooth=True)
    keep(o)
    rr = (disc - 2.6) * U
    z_ring = -0.06 - dome_h * math.sqrt(max(0.0, 1 - (rr / (disc * U)) ** 2)) - 0.004
    o = parts.torus(rr, 0.42 * U, n=72, m=8, name='rim')
    parts.xf(o, rot=(90, 0, 0), loc=(dx, z_ring, dz))
    rig.style(o, '#ffffff', '#ffffff', mix('#ffffff', d2, 0.35), ink(pd), steps=(0.2, 0.7, 0.03), line=0.0, smooth=True)
    keep(o)

    # ---- the emblem, printed on the dome (a decal in front of it; the game's own SVG, embossed in post) ----
    sc = disc * 1.32 / 24.0
    half = (12.0 + PAD_EMBLEM) * sc * U
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    y = -0.06 - dome_h - 0.01
    vs = [bm.verts.new((dx - half, y, dz - half)), bm.verts.new((dx + half, y, dz - half)),
          bm.verts.new((dx + half, y, dz + half)), bm.verts.new((dx - half, y, dz + half))]
    f = bm.faces.new(vs)
    for loop, (u, v) in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        loop[uv].uv = (u, v)
    me = bpy.data.meshes.new('emblem')
    bm.to_mesh(me)
    bm.free()
    em = bpy.data.objects.new('emblem', me)
    bpy.context.scene.collection.objects.link(em)
    me.materials.append(decal_material(emblem_png))
    return objs


PAD_EMBLEM = 2.0


def decal_material(path):
    import bpy
    mat = bpy.data.materials.new('Emblem')
    mat.use_nodes = True
    for attr, val in (('surface_render_method', 'BLENDED'), ('blend_method', 'BLEND')):
        if hasattr(mat, attr):
            try:
                setattr(mat, attr, val)
            except (TypeError, AttributeError):
                pass
    t = mat.node_tree
    for n in list(t.nodes):
        t.nodes.remove(n)
    tex = t.nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(path)
    tex.interpolation = 'Cubic'
    tex.extension = 'CLIP'
    emi = t.nodes.new('ShaderNodeEmission')
    tr = t.nodes.new('ShaderNodeBsdfTransparent')
    mx = t.nodes.new('ShaderNodeMixShader')
    out = t.nodes.new('ShaderNodeOutputMaterial')
    t.links.new(tex.outputs['Color'], emi.inputs['Color'])
    t.links.new(tex.outputs['Alpha'], mx.inputs['Fac'])
    t.links.new(tr.outputs[0], mx.inputs[1])
    t.links.new(emi.outputs[0], mx.inputs[2])
    t.links.new(mx.outputs[0], out.inputs['Surface'])
    return mat


# ---------------------------------------------------------------------------
# Emblem prep (Pillow): the white emblem gets a thin outline in the ribbon's dark tone and a soft emboss shadow
# ---------------------------------------------------------------------------

def prep_emblem(src, dst, dark):
    from PIL import Image, ImageFilter, ImageChops
    im = Image.open(src).convert('RGBA')
    px = im.size[0]
    a = im.getchannel('A')
    # emblem art units → texture px: (24 + 2 PAD) units over px
    unit = px / (24.0 + 2 * PAD_EMBLEM)
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    # emboss: the shape pressed into the dome, down and to the right
    off = max(1, round(unit * 0.55))
    sh = Image.new('L', im.size, 0)
    sh.paste(a, (off, off))
    sh = sh.filter(ImageFilter.GaussianBlur(unit * 0.35)).point(lambda v: int(v * 0.42))
    out = Image.alpha_composite(out, _solid(im.size, dark, sh))
    # outline: the alpha grown by ~0.45 art units, in the dark tone
    grow = a.filter(ImageFilter.MaxFilter(_odd(unit * 0.9))).filter(ImageFilter.GaussianBlur(unit * 0.12))
    ring = ImageChops.subtract(grow, a)
    out = Image.alpha_composite(out, _solid(im.size, dark, ring.point(lambda v: int(v * 0.8))))
    out = Image.alpha_composite(out, im)
    out.save(dst)
    return dst


def _odd(v):
    n = max(3, int(round(v)))
    return n if n % 2 else n + 1


def _solid(size, hexcol, alpha):
    from PIL import Image
    s = Image.new('RGBA', size, _rgb(hexcol) + (255,))
    s.putalpha(alpha)
    return s


# ---------------------------------------------------------------------------
# Post
# ---------------------------------------------------------------------------

def finish(raw, row, out_dir, png_dir):
    from PIL import Image
    import post
    im = Image.open(raw).convert('RGBA')
    if row['cls'] != 'plain':          # a crisp glint on the foil dome, upper left (item post's star)
        k = SIZE / 256.0
        gx = (CX - 7.6 + PAD) * 4.0
        gy = (CY - 7.0 + PAD) * 4.0
        im = post.add_glints(im, [(gx, gy, 9.0 * k, (253, 254, 254))])
        if row['cls'] == 'special':
            im = post.add_glints(im, [((CX + 9.5 + PAD) * 4.0, (CY + 8.5 + PAD) * 4.0, 5.5 * k, (253, 254, 254))])
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(png_dir, exist_ok=True)
    im.save(os.path.join(png_dir, row['id'] + '.png'))
    rep = {'id': row['id']}
    for px in OUT_PX:
        p = os.path.join(out_dir, '%s-%d.webp' % (row['id'], px))
        im.convert('RGBa').resize((px, px), Image.LANCZOS).convert('RGBA').save(p, 'WEBP', **WEBP)
        rep['bytes%d' % px] = os.path.getsize(p)
    return rep


MANIFEST_HEAD = """// Generated by tools/blender/ribbons/build_ribbons.py. Do not edit by hand.
// Baked 3D-flat Honor Ribbons in public/art/honors/: <id>-256.webp and <id>-128.webp for every ribbon below (the
// 64-unit art box plus HONOR_ART_PAD units a side, so a picture sits exactly where the ribbon's SVG does). Keys are
// the achievement ids that grant them; values are content hashes for cache busting (?v=).
"""


def write_manifest(art_dir, js_path):
    import hashlib
    files = sorted(os.listdir(art_dir)) if os.path.isdir(art_dir) else []
    ids = sorted({f[:-len('-256.webp')] for f in files if f.endswith('-256.webp')})
    out = {}
    for k in ids:
        h = hashlib.sha1()
        for px in OUT_PX:
            p = os.path.join(art_dir, '%s-%d.webp' % (k, px))
            with open(p, 'rb') as f:
                h.update(f.read())
        out[k] = h.hexdigest()[:8]
    js = MANIFEST_HEAD + 'export const HONOR_ART_PAD = %g;\n\n' % PAD + 'export const HONOR_BAKED = Object.freeze({\n' + \
        ''.join("  %s: '%s',\n" % (k, v) for k, v in out.items()) + '});\n'
    with open(js_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)
    total = sum(os.path.getsize(os.path.join(art_dir, f)) for f in files if f.endswith('.webp'))
    return len(out), total


def sheet(rows, png_dir, path, cols=8, cell=150):
    from PIL import Image, ImageDraw
    n = len(rows)
    r = (n + cols - 1) // cols
    im = Image.new('RGBA', (cols * cell, r * (cell + 22) + 10), (246, 247, 252, 255))
    d = ImageDraw.Draw(im)
    for i, row in enumerate(rows):
        x, y = (i % cols) * cell, (i // cols) * (cell + 22) + 6
        p = os.path.join(png_dir, row['id'] + '.png')
        if os.path.exists(p):
            a = Image.open(p).convert('RGBA').resize((cell - 10, cell - 10), Image.LANCZOS)
            im.alpha_composite(a, (x + 5, y))
        d.text((x + 6, y + cell - 6), '%d %s' % (row['no'], row['name'][:20]), fill=(40, 44, 70, 255))
    im.save(path)


def main():
    a = _args()
    if a.pylibs:
        sys.path.append(a.pylibs)
    os.makedirs(a.scratch, exist_ok=True)
    data_path = a.data
    emblem_dir = os.path.join(a.scratch, 'emblems')
    if not data_path:
        data_path = os.path.join(a.scratch, 'ribbons.json')
        subprocess.run([a.node, os.path.join(HERE, 'dump_ribbons.mjs'), data_path, emblem_dir], check=True, cwd=ROOT)
    with open(data_path, encoding='utf-8') as f:
        data = json.load(f)
    rows = data['rows']
    if a.ids:
        want = set(a.ids)
        unknown = want - {r['id'] for r in rows}
        if unknown:
            raise SystemExit('unknown ribbons: ' + ', '.join(sorted(unknown)))
        rows = [r for r in rows if r['id'] in want]

    import bpy
    import rig
    cam = rig.setup_scene(a.samples)
    sc = bpy.context.scene
    sc.render.resolution_x = sc.render.resolution_y = SIZE
    cam.data.ortho_scale = (64.0 + 2 * PAD) * U
    cam.location = (0.0, -rig.CAM_DIST, 0.0)
    ppu = SIZE / cam.data.ortho_scale
    raw_dir = os.path.join(a.scratch, 'raw')
    png_dir = os.path.join(a.scratch, 'png')
    prep_dir = os.path.join(a.scratch, 'emblems-prep')
    for d in (raw_dir, png_dir, prep_dir):
        os.makedirs(d, exist_ok=True)
    t0 = time.time()
    reports = []
    for row in rows:
        t1 = time.time()
        rig.clear_item()
        for m in list(bpy.data.materials):
            if m.name.startswith('Emblem'):
                bpy.data.materials.remove(m)
        for img in list(bpy.data.images):
            if img.users == 0:
                bpy.data.images.remove(img)
        png = prep_emblem(os.path.join(emblem_dir, row['id'] + '.png'), os.path.join(prep_dir, row['id'] + '.png'), ink(row['c'][1]))
        objs = build(row, data['silhouettes'][row['cls']], png)
        rig.pose_steps(objs, 'standing')
        rig.add_hulls(objs, ppu)
        raw = rig.render(os.path.join(raw_dir, row['id'] + '.png'))
        rep = finish(raw, row, a.out, png_dir)
        reports.append(rep)
        print('[ribbons] %2d %-18s %-8s %5.1f KB %4.1f KB  %.1fs' % (row['no'], row['id'], row['cls'], rep['bytes256'] / 1024,
              rep['bytes128'] / 1024, time.time() - t1), flush=True)
    if a.blend:
        bpy.ops.wm.save_as_mainfile(filepath=a.blend, copy=True)
    n, total = write_manifest(a.out, a.manifest)
    print('[ribbons] manifest: %d ribbons, %.1f KB of WebP in %s' % (n, total / 1024, a.out))
    if a.sheet:
        sheet(rows, png_dir, a.sheet)
        print('[ribbons] sheet: ' + a.sheet)
    print('[ribbons] %d ribbons in %.1fs' % (len(rows), time.time() - t0))


if __name__ == '__main__':
    main()
