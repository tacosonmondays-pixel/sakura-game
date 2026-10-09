"""Bake the Meshy maps from the original mesh onto the low-poly's new UVs (Cycles CPU,
selected-to-active):

* base colour (emission pass of the 4k Meshy base colour)
* metal / roughness (emission pass of Meshy's packed map, kept as G = roughness, B = metal):
  the gold trims, stars and buttons are metallic and catch the environment map the game gives
  her ("look B" of the lighting study); without it the gold reads brown
* tangent-space normals (the full-detail model only): the 90k-triangle surface plus Meshy's own
  normal map, so the decimated mesh keeps its hair strands, braid and coat embossing in close-ups;
  then flattened to (128, 128, 255) over her skin and painted face (eyes, brows, mouth), where the
  sculpt's tiny creases and mottling read as dirt on a Nendoroid face (flat_skin_normals)

The low-poly gets a Principled material wired the way the glTF exporter recognises
(base colour, Separate Color -> metallic / roughness, Normal Map)."""
import os

import bpy
import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def _src_images(hi):
    imgs = [n.image for n in hi.active_material.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image]
    pick = lambda pred: next((i for i in imgs if pred(i.name.lower())), None)  # noqa: E731
    base = pick(lambda n: 'normal' not in n and 'metal' not in n and 'rough' not in n)
    mr = pick(lambda n: 'metal' in n or 'rough' in n)
    return base, mr


def _emission_material(name, image, non_color):
    ms = bpy.data.materials.new(name)
    ms.use_nodes = True
    nt = ms.node_tree
    nt.nodes.clear()
    ti = nt.nodes.new('ShaderNodeTexImage')
    ti.image = image
    ti.interpolation = 'Cubic'
    if non_color:
        image.colorspace_settings.name = 'Non-Color'
    em = nt.nodes.new('ShaderNodeEmission')
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(ti.outputs['Color'], em.inputs['Color'])
    nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    return ms


def _setup(samples, threads):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.render.threads_mode = 'FIXED'
    sc.render.threads = threads


def _bake(hi, lo, bake_type, image, cage, ray, **kw):
    bk = bpy.context.scene.render.bake
    bk.use_selected_to_active = True
    bk.cage_extrusion = cage
    bk.max_ray_distance = ray
    bk.margin = max(4, image.size[0] // 64)
    bk.margin_type = 'EXTEND'
    bk.use_clear = True
    if bake_type == 'NORMAL':
        bk.normal_space = 'TANGENT'
    for o in bpy.data.objects:
        o.select_set(False)
    hi.select_set(True)
    lo.select_set(True)
    bpy.context.view_layer.objects.active = lo
    lo.active_material.node_tree.nodes.active = kw['node']
    bpy.ops.object.bake(type=bake_type)


def bake_maps(hi, lo, out_dir, base_res, mr_res=1024, normal_res=1024, samples=4, cage=0.012, ray=0.04, threads=4):
    """Bakes base (sRGB), mr and normal (non-colour; normal_res=0 skips it) and gives `lo`
    its export material. Returns {name: image}."""
    _setup(samples, threads)
    src_base, src_mr = _src_images(hi)
    hi_mat = hi.active_material
    for o in (hi, lo):
        for m in o.modifiers:
            m.show_viewport = m.show_render = False
    # ---- the export material on the low-poly
    imgs = {'base': bpy.data.images.new('base', base_res, base_res, alpha=False)}
    imgs['base'].colorspace_settings.name = 'sRGB'
    if src_mr is not None and mr_res:
        imgs['mr'] = bpy.data.images.new('mr', mr_res, mr_res, alpha=False)
        imgs['mr'].colorspace_settings.name = 'Non-Color'
    if normal_res:
        imgs['normal'] = bpy.data.images.new('normal', normal_res, normal_res, alpha=False)
        imgs['normal'].colorspace_settings.name = 'Non-Color'
    mt = bpy.data.materials.new('body')
    mt.use_nodes = True
    nt = mt.node_tree
    bsdf = nt.nodes['Principled BSDF']
    nodes = {}
    for k, img in imgs.items():
        n = nt.nodes.new('ShaderNodeTexImage')
        n.image = img
        nodes[k] = n
    nt.links.new(nodes['base'].outputs['Color'], bsdf.inputs['Base Color'])
    if 'mr' in nodes:
        sep = nt.nodes.new('ShaderNodeSeparateColor')
        nt.links.new(nodes['mr'].outputs['Color'], sep.inputs['Color'])
        nt.links.new(sep.outputs['Blue'], bsdf.inputs['Metallic'])
        nt.links.new(sep.outputs['Green'], bsdf.inputs['Roughness'])
    else:
        bsdf.inputs['Roughness'].default_value = 0.45
    if 'normal' in nodes:
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nt.links.new(nodes['normal'].outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    lo.data.materials.clear()
    lo.data.materials.append(mt)
    # ---- emission bakes from the original textures
    for key, src, non_color in (('base', src_base, False), ('mr', src_mr, True)):
        if key not in imgs:
            continue
        hi.data.materials.clear()
        hi.data.materials.append(_emission_material(f'bake_{key}', src, non_color))
        _bake(hi, lo, 'EMIT', imgs[key], cage, ray, node=nodes[key])
    # ---- normals: the original surface with Meshy's own normal map
    if 'normal' in imgs:
        hi.data.materials.clear()
        hi.data.materials.append(hi_mat)
        _bake(hi, lo, 'NORMAL', imgs['normal'], cage, ray, node=nodes['normal'])
    if 'normal' in imgs:
        flat_skin_normals(lo, imgs['base'], imgs['normal'], out_dir)
    for k, img in imgs.items():
        img.filepath_raw = os.path.join(out_dir, f'{k}.png')
        img.file_format = 'PNG'
        img.save()
    for o in (hi, lo):
        for m in o.modifiers:
            m.show_viewport = m.show_render = True
    return imgs


def skin_mask(rgb, face_tris):
    """Where her normal map should be flat: skin-coloured texels anywhere (face, neck, thighs) plus
    every non-hair texel inside the face charts (eyes, lashes, brows, mouth, blush), grown 2 px
    and feathered. `rgb`: (H, W, 3) uint8 base colour at the normal map's size; `face_tris`:
    (N, 3, 2) pixel coordinates of the face triangles in the same array space. Returns float 0..1."""
    h, w = rgb.shape[:2]
    r, g, b = (rgb[..., i].astype(np.int16) for i in range(3))
    # skin / blush, not the cream shading of the white coat (r ~ g ~ b) nor gold (b far below g)
    skin = (r > 200) & (g > 160) & (b > 135) & (r - g >= 10) & (r - b >= 25) & (r - b < 85) & (g - b >= 0) & (g - b < 36)
    hair = (r > 185) & (r - g > 45) & (b > g)
    # skin outside the face only as real patches (neck, thighs): an opening drops specks < 5 px
    skin = Image.fromarray(skin.astype(np.uint8) * 255, 'L').filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5))
    face = Image.new('L', (w, h), 0)
    dr = ImageDraw.Draw(face)
    for t in face_tris:
        dr.polygon([(float(x), float(y)) for x, y in t], fill=255)
    face = np.asarray(face.filter(ImageFilter.MaxFilter(5))) > 0  # include the bake margin round the chart
    m = ((np.asarray(skin) > 0) | (face & ~hair)).astype(np.uint8) * 255
    im = Image.fromarray(m, 'L').filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(7))  # drop specks, grow 2 px
    im = im.filter(ImageFilter.GaussianBlur(1.2))
    return np.asarray(im).astype(np.float32) / 255.0


def flatten_normals(nrm, mask):
    """nrm: (H, W, 3) floats 0..1 (tangent space); blends toward +Z by mask and renormalises."""
    v = nrm * 2.0 - 1.0
    v = v * (1.0 - mask[..., None]) + np.array([0.0, 0.0, 1.0]) * mask[..., None]
    v /= np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), 1e-6)
    return v * 0.5 + 0.5


def flat_skin_normals(lo, base_img, normal_img, out_dir=None):
    from .lowpoly import in_face
    nw, nh = normal_img.size
    bw, bh = base_img.size
    base = np.empty(bw * bh * 4, np.float32)
    base_img.pixels.foreach_get(base)
    base = (base.reshape(bh, bw, 4)[..., :3] * 255 + 0.5).astype(np.uint8)  # byte image: sRGB values
    if (bw, bh) != (nw, nh):
        base = np.asarray(Image.fromarray(base, 'RGB').resize((nw, nh), Image.BOX))
    me = lo.data
    uv = me.uv_layers.active.data
    co = np.array([v.co[:] for v in me.vertices])
    tris = []
    for p in me.polygons:
        if in_face(co[list(p.vertices)].mean(0)):
            tris.append([(uv[p.loop_start + c].uv[0] * nw, uv[p.loop_start + c].uv[1] * nh) for c in range(3)])
    mask = skin_mask(base, np.array(tris, dtype=np.float32).reshape(-1, 3, 2))
    px = np.empty(nw * nh * 4, np.float32)
    normal_img.pixels.foreach_get(px)
    px = px.reshape(nh, nw, 4)
    px[..., :3] = flatten_normals(px[..., :3], mask)
    normal_img.pixels.foreach_set(px.ravel())
    normal_img.update()
    if out_dir:
        Image.fromarray((mask[::-1] * 255).astype(np.uint8), 'L').save(os.path.join(out_dir, 'normal_flat_mask.png'))
    print(f'[meshy] flat skin normals: {len(tris)} face tris, {float((mask > 0.5).mean()) * 100:.1f}% of the normal map')
    return mask
