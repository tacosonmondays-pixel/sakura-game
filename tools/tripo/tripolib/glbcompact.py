"""Smaller animation data for a packed GLB (pure Python: numpy only), after tools/meshy/lib/pack.py.

pack.py keeps a bone's channel in every clip once it moves in any clip, and gives every accessor its own bufferView.
On a figure with five clips and twenty animated bones that is a hundred channels, four hundred JSON entries: on the
re-rigged enemies (tools/tripo/rerig_tripo_enemy.py) the JSON chunk alone grew from 24 to 42 KB and pushed the
light (LOD) files over their 160 KB budget. Here, per clip:
  * a channel that holds the bone's rest value for the whole clip is dropped (three.js fills a bone a playing
    clip has no track for with its rest value, src/models/glbEnemy.js crossfades as before);
  * identical key-time arrays share one accessor;
  * all animation accessors live in one bufferView.
Mesh, skin and image data are copied as they are."""
import numpy as np

from .meshy import pack

ROT_TOL = 0.0012
POS_TOL = 0.0004


def _rest(node, path):
    return np.array(node.get(path, {'translation': [0, 0, 0], 'rotation': [0, 0, 0, 1], 'scale': [1, 1, 1]}[path]), np.float64)


def compact(path, rot_tol=ROT_TOL, pos_tol=POS_TOL):
    """Rewrites the GLB at `path`; returns (channels before, channels after, bytes before, bytes after)."""
    js, binc = pack.read_glb(path)
    before = len(open(path, 'rb').read())
    nodes = js['nodes']

    def raw(ai):
        a = js['accessors'][ai]
        bv = js['bufferViews'][a['bufferView']]
        n = pack.NCOMP[a['type']] * a['count'] * np.dtype(pack.CT[a['componentType']]).itemsize
        o = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
        return binc[o:o + n]

    # which accessors / bufferViews the animations use (only those are rewritten)
    anim_acc = set()
    for an in js.get('animations', []):
        for s in an['samplers']:
            anim_acc |= {s['input'], s['output']}
    n_before = sum(len(an['channels']) for an in js.get('animations', []))
    # ---- drop rest-constant channels per clip
    for an in js.get('animations', []):
        keep_ch, keep_s = [], []
        for ch in an['channels']:
            s = an['samplers'][ch['sampler']]
            node, p = nodes[ch['target']['node']], ch['target']['path']
            v = pack.read_accessor(js, binc, s['output']).astype(np.float64)
            r = _rest(node, p)
            if p == 'rotation':
                v = v / np.maximum(np.linalg.norm(v, axis=1, keepdims=True), 1e-9)
                dev = np.minimum(np.abs(v - r).max(1), np.abs(v + r).max(1)).max()
                tol = rot_tol
            else:
                dev = np.abs(v - r).max()
                tol = pos_tol
            if dev <= tol:
                continue
            keep_s.append(dict(s))
            keep_ch.append({'sampler': len(keep_s) - 1, 'target': ch['target']})
        an['channels'], an['samplers'] = keep_ch, keep_s
    n_after = sum(len(an['channels']) for an in js.get('animations', []))
    # ---- rebuild: non-animation accessors and views first (same data), then one view for the animations
    old_acc, old_views = js['accessors'], js['bufferViews']
    used_views = set()
    for i, a in enumerate(old_acc):
        if i not in anim_acc:
            used_views.add(a['bufferView'])
    for im in js.get('images', []):
        used_views.add(im['bufferView'])
    buf = bytearray()
    views, view_map = [], {}
    for i, bv in enumerate(old_views):
        if i not in used_views:
            continue
        o = bv.get('byteOffset', 0)
        data = binc[o:o + bv['byteLength']]
        buf += b'\0' * ((4 - len(buf) % 4) % 4)
        nv = {k: v for k, v in bv.items() if k not in ('byteOffset',)}
        nv['byteOffset'] = len(buf)
        buf += data
        view_map[i] = len(views)
        views.append(nv)
    accessors, acc_map = [], {}
    for i, a in enumerate(old_acc):
        if i in anim_acc:
            continue
        na = dict(a)
        na['bufferView'] = view_map[a['bufferView']]
        acc_map[i] = len(accessors)
        accessors.append(na)
    # the animation view
    buf += b'\0' * ((4 - len(buf) % 4) % 4)
    anim_start = len(buf)
    anim_view = len(views)
    seen = {}
    for an in js.get('animations', []):
        for s in an['samplers']:
            for key in ('input', 'output'):
                ai = s[key]
                data = raw(ai)
                a = old_acc[ai]
                sig = (key, a['componentType'], a['type'], a.get('normalized', False), bytes(data))
                if key == 'input' and sig in seen:
                    s[key] = seen[sig]
                    continue
                buf += b'\0' * ((4 - len(buf) % 4) % 4)
                na = {k: v for k, v in a.items() if k not in ('bufferView', 'byteOffset')}
                na['bufferView'] = anim_view
                na['byteOffset'] = len(buf) - anim_start
                buf += data
                accessors.append(na)
                s[key] = len(accessors) - 1
                if key == 'input':
                    seen[sig] = s[key]
    if len(buf) > anim_start:
        views.append({'buffer': 0, 'byteOffset': anim_start, 'byteLength': len(buf) - anim_start})
    # ---- remap the references
    for m in js['meshes']:
        for prim in m['primitives']:
            prim['attributes'] = {k: acc_map[v] for k, v in prim['attributes'].items()}
            if 'indices' in prim:
                prim['indices'] = acc_map[prim['indices']]
    for sk in js.get('skins', []):
        if 'inverseBindMatrices' in sk:
            sk['inverseBindMatrices'] = acc_map[sk['inverseBindMatrices']]
    for im in js.get('images', []):
        im['bufferView'] = view_map[im['bufferView']]
    js['accessors'], js['bufferViews'] = accessors, views
    js['buffers'] = [{'byteLength': len(buf)}]
    pack.write_glb(path, js, bytes(buf))
    after = len(open(path, 'rb').read())
    return n_before, n_after, before, after
