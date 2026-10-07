"""Materials + glTF export (GLB, animations as actions, face atlas embedded as PNG)."""
import json
import os
import struct
import bpy


def make_materials(atlas_path, halo_color, halo_emit=2.0):
    """body: vertex colours; head: face atlas; halo: emissive. Returns dict name -> material."""
    mats = {}
    body = bpy.data.materials.new('body')
    body.use_nodes = True
    nt = body.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 0.8
    col = nt.nodes.new('ShaderNodeVertexColor')
    col.layer_name = 'Col'
    nt.links.new(col.outputs['Color'], bsdf.inputs['Base Color'])
    mats['body'] = body

    head = bpy.data.materials.new('head')
    head.use_nodes = True
    nt = head.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 0.8
    tex = nt.nodes.new('ShaderNodeTexImage')
    img = bpy.data.images.load(atlas_path)
    img.name = os.path.basename(atlas_path)
    tex.image = img
    tex.interpolation = 'Linear'
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    mats['head'] = head

    halo = bpy.data.materials.new('halo')
    halo.use_nodes = True
    nt = halo.node_tree
    bsdf = nt.nodes['Principled BSDF']
    from .colors import linear
    c = linear(halo_color)
    bsdf.inputs['Base Color'].default_value = (c[0], c[1], c[2], 1.0)
    bsdf.inputs['Emission Color'].default_value = (c[0], c[1], c[2], 1.0)
    bsdf.inputs['Emission Strength'].default_value = halo_emit
    mats['halo'] = halo
    return mats


def pack_images():
    """Embeds file-backed images in the open .blend (the face atlases are temp files that are
    deleted after the build), so a saved --blend still shows its textures."""
    for img in bpy.data.images:
        if img.filepath and not img.packed_file:
            try:
                img.pack()
            except RuntimeError as e:
                print(f'[export] could not pack {img.name}: {e}')


def assign_material(obj, mat):
    me = obj.data
    me.materials.clear()
    me.materials.append(mat)
    for p in me.polygons:
        p.material_index = 0


def export_glb(path, objects, animations=True):
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_normals=True,
        export_tangents=False,
        export_texcoords=True,
        export_materials='EXPORT',
        export_vertex_color='ACTIVE',
        export_all_vertex_colors=False,
        export_image_format='AUTO',
        export_animations=animations,
        export_animation_mode='ACTIONS',
        export_force_sampling=False,
        export_optimize_animation_size=True,
        export_optimize_animation_keep_anim_armature=False,
        export_optimize_animation_keep_anim_object=False,
        export_def_bones=False,
        export_skins=True,
        export_morph=False,
        export_rest_position_armature=True,
        export_anim_single_armature=True,
        export_extras=True,
    )
    for o in objects:
        o.select_set(False)
    return path


# ---------------------------------------------------------------------------
# GLB post-processing: swap the embedded (re-encoded, large) face PNG with our own
# optimised PNG and report what is inside.
# ---------------------------------------------------------------------------

def read_glb(path):
    with open(path, 'rb') as f:
        data = f.read()
    magic, version, length = struct.unpack_from('<III', data, 0)
    assert magic == 0x46546C67, 'not a GLB'
    off = 12
    js = None
    bin_chunk = b''
    while off < length:
        clen, ctype = struct.unpack_from('<II', data, off)
        off += 8
        chunk = data[off:off + clen]
        off += clen
        if ctype == 0x4E4F534A:
            js = json.loads(chunk.decode('utf-8'))
        elif ctype == 0x004E4942:
            bin_chunk = chunk
    return js, bin_chunk


def write_glb(path, js, bin_chunk):
    jbytes = json.dumps(js, separators=(',', ':')).encode('utf-8')
    jbytes += b' ' * ((4 - len(jbytes) % 4) % 4)
    bin_chunk = bin_chunk + b'\0' * ((4 - len(bin_chunk) % 4) % 4)
    total = 12 + 8 + len(jbytes) + 8 + len(bin_chunk)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(jbytes), 0x4E4F534A))
        f.write(jbytes)
        f.write(struct.pack('<II', len(bin_chunk), 0x004E4942))
        f.write(bin_chunk)


def replace_image(path, png_path, extras=None):
    """Replaces image 0 of the GLB with the given PNG bytes (rebuilds the binary chunk)."""
    js, bin_chunk = read_glb(path)
    with open(png_path, 'rb') as f:
        png = f.read()
    if not js.get('images'):
        return
    img = js['images'][0]
    bv_idx = img['bufferView']
    views = js['bufferViews']
    old = views[bv_idx]
    # rebuild buffer: copy every view except the image's, append the new PNG
    new_bin = bytearray()
    for i, v in enumerate(views):
        if i == bv_idx:
            continue
        start = v.get('byteOffset', 0)
        chunk = bin_chunk[start:start + v['byteLength']]
        pad = (4 - len(new_bin) % 4) % 4
        new_bin += b'\0' * pad
        v['byteOffset'] = len(new_bin)
        new_bin += chunk
    pad = (4 - len(new_bin) % 4) % 4
    new_bin += b'\0' * pad
    old['byteOffset'] = len(new_bin)
    old['byteLength'] = len(png)
    new_bin += png
    img['mimeType'] = 'image/png'
    js['buffers'][0]['byteLength'] = len(new_bin)
    if extras:
        js.setdefault('asset', {}).setdefault('extras', {}).update(extras)
    write_glb(path, js, bytes(new_bin))


def describe(path):
    js, bin_chunk = read_glb(path)
    anims = [a.get('name') for a in js.get('animations', [])]
    prims = sum(len(m['primitives']) for m in js.get('meshes', []))
    verts = 0
    for m in js.get('meshes', []):
        for p in m['primitives']:
            verts += js['accessors'][p['attributes']['POSITION']]['count']
    return dict(size=os.path.getsize(path), animations=anims, primitives=prims, vertices=verts,
                bones=len(js.get('skins', [{}])[0].get('joints', [])) if js.get('skins') else 0,
                materials=[m.get('name') for m in js.get('materials', [])])
