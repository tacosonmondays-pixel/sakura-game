"""Import a Meshy character GLB and make the game mesh: weld the seam-split vertices, keep the
original as the bake source ('hi'), decimate a copy ('lo') with the face protected, smooth
normals and give it fresh xatlas UVs (the face gets extra texel density).

Meshy's own UVs are thousands of tiny islands: downscaled, their borders bleed into each other
and the mip levels a battle-size character samples turn into colour noise. Re-unwrapping the
low-poly mesh into larger charts and baking the 4k base colour onto it fixes that."""
import math
import sys

import bmesh
import bpy
import numpy as np

# face window (Blender axes: -Y is the front, Z up) of the owner's chibi at its native 1.7 height
FACE_BOX = dict(zmin=0.95, zmax=1.36, xmax=0.27, ymax=-0.22)


def import_source(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    for o in list(bpy.data.objects):
        if o.type == 'MESH' and o.name.startswith('Icosphere'):  # importer's bone display shape
            bpy.data.objects.remove(o)
    arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
    hi = max([o for o in bpy.data.objects if o.type == 'MESH'], key=lambda o: len(o.data.vertices))
    hi.name = 'hi'
    return arm, hi


def weld(ob, dist=1e-6):
    """Meshy splits the mesh at every UV seam with float-noise positions."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=dist)
    bm.to_mesh(ob.data)
    bm.free()


def in_face(co):
    b = FACE_BOX
    return (co[..., 2] > b['zmin']) & (co[..., 2] < b['zmax']) & (np.abs(co[..., 0]) < b['xmax']) & (co[..., 1] < b['ymax'])


def make_lowpoly(hi, target_tris, face_weight=0.35):
    weld(hi)
    lo = hi.copy()
    lo.data = hi.data.copy()
    lo.name = lo.data.name = 'lo'
    bpy.context.scene.collection.objects.link(lo)
    # Blender's collapse decimator reads the group as "how freely may this vertex collapse"
    co = np.array([v.co[:] for v in lo.data.vertices])
    w = np.ones(len(co))
    w[in_face(co)] = face_weight
    w[(co[:, 2] > 0.80) & (co[:, 2] < 0.93) & (np.abs(co[:, 0]) < 0.15) & (co[:, 1] < -0.1)] = 0.5  # neck bow
    vg = lo.vertex_groups.new(name='protect')
    for i, x in enumerate(w):
        vg.add([i], float(x), 'REPLACE')
    for o in bpy.data.objects:
        o.select_set(False)
    lo.select_set(True)
    bpy.context.view_layer.objects.active = lo
    ntri = sum(len(p.vertices) - 2 for p in lo.data.polygons)
    m = lo.modifiers.new('dec', 'DECIMATE')
    m.decimate_type = 'COLLAPSE'
    m.ratio = target_tris / ntri
    m.vertex_group = 'protect'
    m.vertex_group_factor = 1.0
    m.use_collapse_triangulate = True
    while lo.modifiers.find('dec') > 0:
        bpy.ops.object.modifier_move_up(modifier='dec')
    bpy.ops.object.modifier_apply(modifier='dec')
    lo.vertex_groups.remove(lo.vertex_groups['protect'])
    bpy.ops.mesh.customdata_custom_splitnormals_clear()
    lo.data.validate(verbose=False, clean_customdata=False)
    for p in lo.data.polygons:
        p.use_smooth = True
    return lo


def unwrap_xatlas(lo, face_scale=2.0, max_cost=2.0, resolution=2048, padding=6):
    """Fresh UVs: xatlas charts, the face parametrised at face_scale x so it gets face_scale^2 texels."""
    import xatlas  # pip install xatlas (see tools/meshy/README section in docs/MODELS.md)
    me = lo.data
    assert all(len(p.vertices) == 3 for p in me.polygons)
    V = np.array([v.co[:] for v in me.vertices], dtype=np.float32)
    F = np.array([p.vertices[:] for p in me.polygons], dtype=np.uint32)
    isface = in_face(V[F].mean(1))
    atlas = xatlas.Atlas()
    parts = [np.nonzero(~isface)[0], np.nonzero(isface)[0]]
    for k, fi in enumerate(parts):
        atlas.add_mesh(V * (face_scale if k == 1 else 1.0), F[fi])
    co = xatlas.ChartOptions()
    co.max_cost = max_cost
    co.normal_seam_weight = 4.0
    po = xatlas.PackOptions()
    po.resolution = resolution
    po.padding = padding
    po.bilinear = True
    po.rotate_charts = True
    atlas.generate(co, po)
    while len(me.uv_layers):
        me.uv_layers.remove(me.uv_layers[0])
    me.uv_layers.new(name='UVMap')
    uv = me.uv_layers[0].data
    for k, fi in enumerate(parts):
        _vmap, idx, uvs = atlas[k]
        for t, f in enumerate(fi):
            poly = me.polygons[int(f)]
            for c in range(3):
                uv[poly.loop_start + c].uv = uvs[idx[t][c]]
    return dict(charts=atlas.chart_count, utilization=round(float(atlas.utilization), 3), face_tris=int(isface.sum()))
