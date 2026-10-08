"""Bake the Meshy base colour (emission pass, Cycles CPU) from the original mesh onto the
low-poly's new UVs. The normal and metallic-roughness maps are dropped: the game draws the
figurine with a soft toon ramp, where baked PBR detail only adds noise."""
import bpy


def bake_base(hi, lo, res, out_png, samples=4, cage=0.012, ray=0.04, threads=4):
    src = hi.active_material
    tex = [n for n in src.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image and 'normal' not in n.image.name
           and 'metallic' not in n.image.name][0].image
    ms = bpy.data.materials.new('bake_src')
    ms.use_nodes = True
    nt = ms.node_tree
    nt.nodes.clear()
    ti = nt.nodes.new('ShaderNodeTexImage')
    ti.image = tex
    ti.interpolation = 'Cubic'
    em = nt.nodes.new('ShaderNodeEmission')
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(ti.outputs['Color'], em.inputs['Color'])
    nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    hi.data.materials.clear()
    hi.data.materials.append(ms)
    img = bpy.data.images.new('base', res, res, alpha=False)
    img.colorspace_settings.name = 'sRGB'
    mt = bpy.data.materials.new('body')
    mt.use_nodes = True
    nt = mt.node_tree
    bsdf = nt.nodes['Principled BSDF']
    it = nt.nodes.new('ShaderNodeTexImage')
    it.image = img
    nt.links.new(it.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 1.0
    nt.nodes.active = it
    lo.data.materials.clear()
    lo.data.materials.append(mt)
    for o in (hi, lo):
        for m in o.modifiers:
            m.show_viewport = m.show_render = False
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.render.threads_mode = 'FIXED'
    sc.render.threads = threads
    bk = sc.render.bake
    bk.use_selected_to_active = True
    bk.cage_extrusion = cage
    bk.max_ray_distance = ray
    bk.margin = max(4, res // 64)
    bk.margin_type = 'EXTEND'
    bk.use_clear = True
    for o in bpy.data.objects:
        o.select_set(False)
    hi.select_set(True)
    lo.select_set(True)
    bpy.context.view_layer.objects.active = lo
    bpy.ops.object.bake(type='EMIT')
    img.filepath_raw = out_png
    img.file_format = 'PNG'
    img.save()
    for o in (hi, lo):
        for m in o.modifiers:
            m.show_viewport = m.show_render = True
    return img
