"""Phone packing for an exported Meshy character GLB (pure Python: numpy + Pillow, no bpy).

* uniform rescale of the whole asset (positions, node / inverse-bind / animation translations)
  so positions fit normalised int16 (KHR_mesh_quantization); the runtime scales the root back by
  asset.extras.unitScale
* attributes: int16 positions, int8 normals, uint16 UVs, uint8 colours / joints / weights
* animation: channels that never leave the rest pose in any clip are dropped (all clips agree, so
  crossfades cannot leave a bone stranded), redundant linear keys removed, rotations stored as
  normalised int16
* textures (base colour, metal/roughness, normals) re-encoded as WebP (EXT_texture_webp, read
  natively by three.js)"""
import io
import json
import struct

import numpy as np
from PIL import Image

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
CODE = {np.int8: 5120, np.uint8: 5121, np.int16: 5122, np.uint16: 5123, np.uint32: 5125, np.float32: 5126}


def read_glb(path):
    data = open(path, 'rb').read()
    magic, _ver, length = struct.unpack_from('<III', data, 0)
    assert magic == 0x46546C67, 'not a GLB'
    off, js, binc = 12, None, b''
    while off < length:
        clen, ctype = struct.unpack_from('<II', data, off)
        chunk = data[off + 8:off + 8 + clen]
        off += 8 + clen
        if ctype == 0x4E4F534A:
            js = json.loads(chunk)
        elif ctype == 0x004E4942:
            binc = chunk
    return js, binc


def write_glb(path, js, binc):
    jb = json.dumps(js, separators=(',', ':')).encode()
    jb += b' ' * ((4 - len(jb) % 4) % 4)
    binc = binc + b'\0' * ((4 - len(binc) % 4) % 4)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(jb) + 8 + len(binc)))
        f.write(struct.pack('<II', len(jb), 0x4E4F534A))
        f.write(jb)
        f.write(struct.pack('<II', len(binc), 0x004E4942))
        f.write(binc)


def read_accessor(js, binc, idx):
    acc = js['accessors'][idx]
    bv = js['bufferViews'][acc['bufferView']]
    dt = CT[acc['componentType']]
    n = NCOMP[acc['type']]
    start = bv.get('byteOffset', 0) + acc.get('byteOffset', 0)
    stride = bv.get('byteStride', 0)
    item = np.dtype(dt).itemsize * n
    if stride and stride != item:
        raw = np.frombuffer(binc, dtype=np.uint8, count=stride * acc['count'], offset=start).reshape(acc['count'], stride)
        arr = np.frombuffer(raw[:, :item].tobytes(), dtype=dt).reshape(acc['count'], n)
    else:
        arr = np.frombuffer(binc, dtype=dt, count=acc['count'] * n, offset=start).reshape(acc['count'], n)
    arr = arr.astype(np.float32) if dt is not np.float32 and acc.get('normalized') else arr.copy()
    if acc.get('normalized'):
        arr = arr / float(np.iinfo(dt).max)
    return arr


class Writer:
    def __init__(self):
        self.buf = bytearray()
        self.views = []
        self.accessors = []

    def view(self, data, stride=None, target=None):
        self.buf += b'\0' * ((4 - len(self.buf) % 4) % 4)
        v = {'buffer': 0, 'byteOffset': len(self.buf), 'byteLength': len(data)}
        if stride:
            v['byteStride'] = stride
        if target:
            v['target'] = target
        self.buf += data
        self.views.append(v)
        return len(self.views) - 1

    def accessor(self, arr, dtype, normalized=False, type_=None, stride=None, target=None, minmax=False):
        a = np.asarray(arr)
        if a.ndim == 1:
            a = a[:, None]
        if normalized:
            mx = np.iinfo(dtype).max
            lo = np.iinfo(dtype).min if np.iinfo(dtype).min < 0 else 0
            q = np.clip(np.round(a * mx), -mx if lo < 0 else 0, mx).astype(dtype)
        else:
            q = a.astype(dtype)
        n, c = q.shape
        data = q.tobytes()
        item = q.dtype.itemsize * c
        st = None
        if target == 34962 and item % 4:  # vertex attributes: elements aligned to 4 bytes
            st = item + (4 - item % 4)
            rows = np.zeros((n, st), np.uint8)
            rows[:, :item] = np.frombuffer(data, np.uint8).reshape(n, item)
            data = rows.tobytes()
        acc = {'bufferView': self.view(data, st, target),
               'componentType': CODE[dtype], 'count': int(n), 'type': type_ or {1: 'SCALAR', 2: 'VEC2', 3: 'VEC3', 4: 'VEC4', 16: 'MAT4'}[c]}
        if normalized:
            acc['normalized'] = True
        if minmax:  # stored component values (three.js rescales normalised bounds itself)
            cast = float if dtype is np.float32 else int
            acc['min'] = [cast(x) for x in q.min(0)]
            acc['max'] = [cast(x) for x in q.max(0)]
        self.accessors.append(acc)
        return len(self.accessors) - 1


def _reduce_keys(times, vals, tol, is_rot):
    """Greedy removal of keys reproduced by linear interpolation of their neighbours."""
    n = len(times)
    if n <= 2:
        return times, vals
    keep = [0]
    for i in range(1, n - 1):
        a = keep[-1]
        t = (times[i] - times[a]) / (times[i + 1] - times[a])
        p = vals[a] + (vals[i + 1] - vals[a]) * t
        if is_rot:
            p = p / np.linalg.norm(p)
            v = vals[i] if np.dot(vals[i], p) >= 0 else -vals[i]
        else:
            v = vals[i]
        if np.abs(p - v).max() > tol:
            keep.append(i)
    keep.append(n - 1)
    return times[keep], vals[keep]


def pack(src, dst, scale, extras, webp_quality=90, tex_size=None, rot_tol=0.0012, pos_tol=0.0004):
    js, binc = read_glb(src)
    W = Writer()
    nodes = js['nodes']
    # ---- rescale nodes + inverse binds
    for nd in nodes:
        if 'translation' in nd:
            nd['translation'] = [float(x) * scale for x in nd['translation']]
    for skin in js.get('skins', []):
        ibm = read_accessor(js, binc, skin['inverseBindMatrices']).reshape(-1, 16).astype(np.float64)
        ibm[:, 12:15] *= scale  # column-major: translation in elements 12..14
        skin['inverseBindMatrices'] = W.accessor(ibm.astype(np.float32), np.float32, type_='MAT4')
    # ---- meshes
    mats = js.get('materials', [])
    for mesh in js['meshes']:
        for prim in mesh['primitives']:
            at = prim['attributes']
            out = {}
            pos = read_accessor(js, binc, at['POSITION']).astype(np.float64) * scale
            assert np.abs(pos).max() < 1.0, 'positions must fit [-1,1] after scaling'
            out['POSITION'] = W.accessor(pos, np.int16, True, 'VEC3', target=34962, minmax=True)
            if 'NORMAL' in at:
                nrm = read_accessor(js, binc, at['NORMAL'])
                out['NORMAL'] = W.accessor(nrm, np.int8, True, 'VEC3', target=34962)
            if 'TEXCOORD_0' in at and mats[prim['material']].get('pbrMetallicRoughness', {}).get('baseColorTexture'):
                uv = np.clip(read_accessor(js, binc, at['TEXCOORD_0']), 0, 1)
                out['TEXCOORD_0'] = W.accessor(uv, np.uint16, True, 'VEC2', target=34962)
            if 'COLOR_0' in at:
                col = read_accessor(js, binc, at['COLOR_0'])
                if col.shape[1] == 3:
                    col = np.concatenate([col, np.ones((len(col), 1), np.float32)], 1)
                out['COLOR_0'] = W.accessor(col, np.uint8, True, 'VEC4', target=34962)
            if 'JOINTS_0' in at:
                j = read_accessor(js, binc, at['JOINTS_0'])
                out['JOINTS_0'] = W.accessor(j, np.uint8, False, 'VEC4', target=34962)
            if 'WEIGHTS_0' in at:
                w = read_accessor(js, binc, at['WEIGHTS_0']).astype(np.float64)
                w /= np.maximum(w.sum(1, keepdims=True), 1e-9)
                q = np.round(w * 255).astype(np.int32)
                q[np.arange(len(q)), q.argmax(1)] += 255 - q.sum(1)  # exact 255 sums
                out['WEIGHTS_0'] = W.accessor(q / 255.0, np.uint8, True, 'VEC4', target=34962)
            prim['attributes'] = out
            idx = read_accessor(js, binc, prim['indices']).ravel()
            prim['indices'] = W.accessor(idx, np.uint16 if idx.max() < 65535 else np.uint32, target=34963)
    # ---- animations: drop channels that stay at rest in every clip, reduce keys, int16 rotations
    def rest(node, path):
        nd = nodes[node]
        return np.array(nd.get(path, {'translation': [0, 0, 0], 'rotation': [0, 0, 0, 1], 'scale': [1, 1, 1]}[path]), np.float64)
    data = {}
    moving = set()
    for ai, anim in enumerate(js.get('animations', [])):
        for ch in anim['channels']:
            s = anim['samplers'][ch['sampler']]
            key = (ch['target']['node'], ch['target']['path'])
            t = read_accessor(js, binc, s['input']).ravel().astype(np.float64)
            v = read_accessor(js, binc, s['output']).astype(np.float64)
            if key[1] == 'translation':
                v = v * scale
            data[(ai, key)] = (t, v, s.get('interpolation', 'LINEAR'))
            r = rest(*key)
            tol = rot_tol if key[1] == 'rotation' else pos_tol
            if key[1] == 'rotation':
                dev = np.minimum(np.abs(v - r).max(1), np.abs(v + r).max(1)).max()
            else:
                dev = np.abs(v - r).max()
            if dev > tol:
                moving.add(key)
    stats = {'channels': 0, 'keys': 0}
    for ai, anim in enumerate(js.get('animations', [])):
        chans, samps = [], []
        for ch in anim['channels']:
            key = (ch['target']['node'], ch['target']['path'])
            if key not in moving:
                continue
            t, v, interp = data[(ai, key)]
            if key[1] == 'rotation':
                v = v / np.linalg.norm(v, axis=1, keepdims=True)
                for i in range(1, len(v)):  # keep hemisphere continuity for lerp checks
                    if np.dot(v[i], v[i - 1]) < 0:
                        v[i] = -v[i]
            if interp == 'LINEAR':
                t, v = _reduce_keys(t, v, rot_tol if key[1] == 'rotation' else pos_tol, key[1] == 'rotation')
            ia = W.accessor(t.astype(np.float32), np.float32, type_='SCALAR', minmax=True)
            if key[1] == 'rotation':
                oa = W.accessor(v, np.int16, True, 'VEC4')
            else:
                oa = W.accessor(v.astype(np.float32), np.float32, type_='VEC3')
            samps.append({'input': ia, 'output': oa, 'interpolation': interp})
            chans.append({'sampler': len(samps) - 1, 'target': ch['target']})
            stats['channels'] += 1
            stats['keys'] += len(t)
        anim['channels'], anim['samplers'] = chans, samps
    # ---- images -> WebP
    for img in js.get('images', []):
        bv = js['bufferViews'][img['bufferView']]
        raw = binc[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]
        im = Image.open(io.BytesIO(raw)).convert('RGB')
        if tex_size and img.get('name') == 'base' and im.size[0] != tex_size:
            im = im.resize((tex_size, tex_size), Image.LANCZOS)
        b = io.BytesIO()
        # normals: higher quality, lossy blocks show as facets under the key light
        im.save(b, 'WEBP', quality=max(webp_quality, 94) if img.get('name') == 'normal' else webp_quality, method=6)
        img['bufferView'] = W.view(b.getvalue())
        img['mimeType'] = 'image/webp'
        img.pop('uri', None)
    for tex in js.get('textures', []):
        if 'source' in tex:
            tex['extensions'] = {'EXT_texture_webp': {'source': tex.pop('source')}}
    for m in mats:
        pbr = m.setdefault('pbrMetallicRoughness', {})
        # a metal/roughness map carries the real values; otherwise a plain matte surface
        pbr['metallicFactor'] = 1.0 if pbr.get('metallicRoughnessTexture') else 0.0
        pbr['roughnessFactor'] = 1.0
        m.pop('extras', None)
    js['accessors'] = W.accessors
    js['bufferViews'] = W.views
    js['buffers'] = [{'byteLength': len(W.buf)}]
    used = set(js.get('extensionsUsed', [])) | {'KHR_mesh_quantization'}
    req = set(js.get('extensionsRequired', [])) | {'KHR_mesh_quantization'}
    if js.get('images'):
        used.add('EXT_texture_webp')
        req.add('EXT_texture_webp')
    js['extensionsUsed'] = sorted(used)
    js['extensionsRequired'] = sorted(req)
    js['asset']['extras'] = extras
    write_glb(dst, js, bytes(W.buf))
    return stats
