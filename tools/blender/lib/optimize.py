"""GLB attribute quantisation (KHR_mesh_quantization): positions int16, normals int8,
colours/joints/weights unsigned bytes, UVs uint16, 16-bit indices. Also drops UVs from
untextured primitives and vertex colours from the textured head. Roughly halves the file
and is read natively by three.js' GLTFLoader."""
import struct
import numpy as np

from .export import read_glb, write_glb

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
CODE = {np.int8: 5120, np.uint8: 5121, np.int16: 5122, np.uint16: 5123, np.uint32: 5125, np.float32: 5126}


def read_accessor(js, bin_chunk, idx):
    acc = js['accessors'][idx]
    bv = js['bufferViews'][acc['bufferView']]
    dtype = CT[acc['componentType']]
    n = NCOMP[acc['type']]
    count = acc['count']
    start = bv.get('byteOffset', 0) + acc.get('byteOffset', 0)
    stride = bv.get('byteStride', 0)
    item = np.dtype(dtype).itemsize * n
    if stride and stride != item:
        out = np.empty((count, n), dtype=dtype)
        for i in range(count):
            out[i] = np.frombuffer(bin_chunk, dtype=dtype, count=n, offset=start + i * stride)
        return out
    return np.frombuffer(bin_chunk, dtype=dtype, count=count * n, offset=start).reshape(count, n).copy()


class Writer:
    def __init__(self):
        self.buf = bytearray()
        self.views = []

    def add(self, arr, stride=None, target=None):
        pad = (4 - len(self.buf) % 4) % 4
        self.buf += b'\0' * pad
        off = len(self.buf)
        data = arr.tobytes()
        if stride:
            # pad each element to the stride
            n, c = arr.shape
            item = arr.dtype.itemsize * c
            if item != stride:
                rows = np.zeros((n, stride), dtype=np.uint8)
                raw = np.frombuffer(data, dtype=np.uint8).reshape(n, item)
                rows[:, :item] = raw
                data = rows.tobytes()
        self.buf += data
        view = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data)}
        if stride:
            view['byteStride'] = stride
        if target:
            view['target'] = target
        self.views.append(view)
        return len(self.views) - 1

    def add_raw(self, data):
        pad = (4 - len(self.buf) % 4) % 4
        self.buf += b'\0' * pad
        off = len(self.buf)
        self.buf += data
        self.views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(data)})
        return len(self.views) - 1


def quantize(arr, dtype, normalized):
    if not normalized:
        return arr.astype(dtype)
    if dtype is np.int16:
        return np.clip(np.round(arr * 32767.0), -32767, 32767).astype(np.int16)
    if dtype is np.int8:
        return np.clip(np.round(arr * 127.0), -127, 127).astype(np.int8)
    if dtype is np.uint8:
        return np.clip(np.round(arr * 255.0), 0, 255).astype(np.uint8)
    if dtype is np.uint16:
        return np.clip(np.round(arr * 65535.0), 0, 65535).astype(np.uint16)
    return arr.astype(dtype)


def optimize_glb(path, out=None):
    js, bin_chunk = read_glb(path)
    W = Writer()
    new_accessors = []
    acc_map = {}  # old accessor idx -> new idx (for non-attribute accessors reused as-is)

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
    for mesh in js['meshes']:
        for prim in mesh['primitives']:
            attrs = prim['attributes']
            mat = materials[prim['material']]['name'] if 'material' in prim else ''
            new_attrs = {}
            pos = read_accessor(js, bin_chunk, attrs['POSITION']).astype(np.float32)
            if np.abs(pos).max() >= 1.0:
                raise ValueError(f'{path}: positions exceed [-1,1], cannot quantize to normalized int16')
            new_attrs['POSITION'] = add_attr(pos, np.int16, True, 'VEC3', 8, minmax=True)
            if 'NORMAL' in attrs:
                nrm = read_accessor(js, bin_chunk, attrs['NORMAL']).astype(np.float32)
                new_attrs['NORMAL'] = add_attr(nrm, np.int8, True, 'VEC3', 4)
            if 'TEXCOORD_0' in attrs and mat == 'head':
                uv = read_accessor(js, bin_chunk, attrs['TEXCOORD_0']).astype(np.float32)
                uv = np.clip(uv, 0.0, 1.0)
                new_attrs['TEXCOORD_0'] = add_attr(uv, np.uint16, True, 'VEC2', 4)
            if 'COLOR_0' in attrs and mat != 'head':
                col = read_accessor(js, bin_chunk, attrs['COLOR_0'])
                acc = js['accessors'][attrs['COLOR_0']]
                if col.dtype == np.uint16:
                    col = col.astype(np.float32) / 65535.0
                elif col.dtype == np.uint8:
                    col = col.astype(np.float32) / 255.0
                if col.shape[1] == 3:
                    col = np.concatenate([col, np.ones((col.shape[0], 1), np.float32)], axis=1)
                new_attrs['COLOR_0'] = add_attr(col.astype(np.float32), np.uint8, True, 'VEC4', 4)
            if 'JOINTS_0' in attrs:
                j = read_accessor(js, bin_chunk, attrs['JOINTS_0'])
                dtype = np.uint8 if j.max() < 256 else np.uint16
                new_attrs['JOINTS_0'] = add_attr(j.astype(np.float32) if False else j.astype(dtype), dtype, False, 'VEC4', 4 if dtype is np.uint8 else 8)
            if 'WEIGHTS_0' in attrs:
                w = read_accessor(js, bin_chunk, attrs['WEIGHTS_0']).astype(np.float32)
                s = w.sum(axis=1, keepdims=True)
                s[s == 0] = 1
                w = w / s
                new_attrs['WEIGHTS_0'] = add_attr(w, np.uint8, True, 'VEC4', 4)
            prim['attributes'] = new_attrs
            if 'indices' in prim:
                prim['indices'] = copy_accessor(prim['indices'], target=34963)

    # skins (inverse bind matrices), animations: copy
    for skin in js.get('skins', []):
        if 'inverseBindMatrices' in skin:
            skin['inverseBindMatrices'] = copy_accessor(skin['inverseBindMatrices'])
    for anim in js.get('animations', []):
        for s in anim['samplers']:
            s['input'] = copy_accessor(s['input'])
            s['output'] = copy_accessor(s['output'])
    # images
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
    return out or path
