"""Bake the Meshy maps from the original mesh onto the low-poly's new UVs (Cycles CPU,
selected-to-active):

* base colour (emission pass of the 4k Meshy base colour)
* metal / roughness (emission pass of Meshy's packed map, kept as G = roughness, B = metal):
  the gold trims, stars and buttons are metallic and catch the environment map the game gives
  her ("look B" of the lighting study); without it the gold reads brown
* tangent-space normals (the full-detail model only): the 90k-triangle surface plus Meshy's own
  normal map, so the decimated mesh keeps its hair strands, braid and coat embossing in close-ups

The low-poly gets a Principled material wired the way the glTF exporter recognises
(base colour, Separate Color -> metallic / roughness, Normal Map)."""
import os

import bpy


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
    for k, img in imgs.items():
        img.filepath_raw = os.path.join(out_dir, f'{k}.png')
        img.file_format = 'PNG'
        img.save()
    for o in (hi, lo):
        for m in o.modifiers:
            m.show_viewport = m.show_render = True
    return imgs
