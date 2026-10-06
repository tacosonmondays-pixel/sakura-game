"""GLB packing for enemies (KHR_mesh_quantization): positions int16, normals int8, colours
uint8 RGBA (the alpha carries the tint role: 0 = family colour, 0.5 = accent, 1 = literal),
UVs uint16 (body material only), joints/weights bytes, 16-bit indices. Reuses the chibi
pipeline's reader/writer (tools/blender/lib/optimize.py)."""
import numpy as np

from lib.export import read_glb, write_glb
from lib.optimize import read_accessor, Writer, quantize, CODE


def pack_glb(path, out=None, uv_materials=('body',)):
    js, bin_chunk = read_glb(path)
    W = Writer()
    new_accessors = []
    acc_map = {}

    def copy_accessor(idx, target=None):
        if idx in acc_map:
            return acc_map[idx]
        acc = dict(js['accessors'][idx])
        arr = read_accessor(js, bin_chunk, idx)
        if arr.dtype == np.uint32 and acc['type'] == 'SCALAR' and arr.max() < 65535:
            arr = arr.astype(np.uint16)
            acc['componentType'] = CODE[np.uint16]
        view = W.add(arr, target=target)
        acc['bufferView'] = view
        acc.pop('byteOffset', None)
        new_accessors.append(acc)
        acc_map[idx] = len(new_accessors) - 1
        return acc_map[idx]

    def add_attr(arr, dtype, normalized, type_, stride, minmax=False):
        q = quantize(arr, dtype, normalized)
        view = W.add(q, stride=stride, target=34962)
        acc = {'bufferView': view, 'componentType': CODE[dtype], 'count': int(q.shape[0]), 'type': type_}
        if normalized:
            acc['normalized'] = True
        if minmax:
            acc['min'] = [int(x) for x in q.min(axis=0)]
            acc['max'] = [int(x) for x in q.max(axis=0)]
        new_accessors.append(acc)
        return len(new_accessors) - 1

    materials = js.get('materials', [])
    stats = dict(vertices=0, alpha_roles=set())
    for mesh in js['meshes']:
        for prim in mesh['primitives']:
            attrs = prim['attributes']
            mat = materials[prim['material']]['name'] if 'material' in prim else ''
            new_attrs = {}
            pos = read_accessor(js, bin_chunk, attrs['POSITION']).astype(np.float32)
            if np.abs(pos).max() >= 1.0:
                raise ValueError(f'{path}: positions exceed [-1,1] ({np.abs(pos).max():.3f}), lower the unit scale')
            stats['vertices'] += int(pos.shape[0])
            new_attrs['POSITION'] = add_attr(pos, np.int16, True, 'VEC3', 8, minmax=True)
            if 'NORMAL' in attrs:
                nrm = read_accessor(js, bin_chunk, attrs['NORMAL']).astype(np.float32)
                new_attrs['NORMAL'] = add_attr(nrm, np.int8, True, 'VEC3', 4)
            if 'TEXCOORD_0' in attrs and mat in uv_materials:
                uv = np.clip(read_accessor(js, bin_chunk, attrs['TEXCOORD_0']).astype(np.float32), 0.0, 1.0)
                # parts without a face sit entirely on the transparent atlas corner: drop the
                # attribute, the runtime adds a constant one back (asset.extras.faceCorner)
                if np.any(np.abs(uv - uv[0]) > 1e-4):
                    new_attrs['TEXCOORD_0'] = add_attr(uv, np.uint16, True, 'VEC2', 4)
            if 'COLOR_0' in attrs:
                col = read_accessor(js, bin_chunk, attrs['COLOR_0'])
                if col.dtype == np.uint16:
                    col = col.astype(np.float32) / 65535.0
                elif col.dtype == np.uint8:
                    col = col.astype(np.float32) / 255.0
                col = col.astype(np.float32)
                if col.shape[1] == 3:
                    col = np.concatenate([col, np.ones((col.shape[0], 1), np.float32)], axis=1)
                for a in np.unique(np.round(col[:, 3] * 2) / 2):
                    stats['alpha_roles'].add(float(a))
                new_attrs['COLOR_0'] = add_attr(col, np.uint8, True, 'VEC4', 4)
            if 'JOINTS_0' in attrs:
                j = read_accessor(js, bin_chunk, attrs['JOINTS_0'])
                dtype = np.uint8 if j.max() < 256 else np.uint16
                new_attrs['JOINTS_0'] = add_attr(j.astype(dtype), dtype, False, 'VEC4', 4 if dtype is np.uint8 else 8)
            if 'WEIGHTS_0' in attrs:
                w = read_accessor(js, bin_chunk, attrs['WEIGHTS_0']).astype(np.float32)
                s = w.sum(axis=1, keepdims=True)
                s[s == 0] = 1
                new_attrs['WEIGHTS_0'] = add_attr(w / s, np.uint8, True, 'VEC4', 4)
            prim['attributes'] = new_attrs
            if 'indices' in prim:
                prim['indices'] = copy_accessor(prim['indices'], target=34963)
    for skin in js.get('skins', []):
        if 'inverseBindMatrices' in skin:
            skin['inverseBindMatrices'] = copy_accessor(skin['inverseBindMatrices'])
    for anim in js.get('animations', []):
        for s in anim['samplers']:
            s['input'] = copy_accessor(s['input'])
            s['output'] = copy_accessor(s['output'])
    for img in js.get('images', []):
        bv = js['bufferViews'][img['bufferView']]
        start = bv.get('byteOffset', 0)
        img['bufferView'] = W.add_raw(bin_chunk[start:start + bv['byteLength']])
    js['accessors'] = new_accessors
    js['bufferViews'] = W.views
    js['buffers'] = [{'byteLength': len(W.buf)}]
    used = set(js.get('extensionsUsed', []))
    used.add('KHR_mesh_quantization')
    js['extensionsUsed'] = sorted(used)
    req = set(js.get('extensionsRequired', []))
    req.add('KHR_mesh_quantization')
    js['extensionsRequired'] = sorted(req)
    write_glb(out or path, js, bytes(W.buf))
    stats['alpha_roles'] = sorted(stats['alpha_roles'])
    return stats
