"""Rotation-key clean-up for exported GLBs (numpy only, no bpy: it runs on any written GLB).

Blender's glTF exporter writes each rotation key as the bone's rest rotation times its pose. Near a 180-degree rest
(legs, hair tails) neighbouring keys come out as q and -q: the same rotation, but three.js interpolates CUBICSPLINE
rotations component by component (GLTFCubicSplineQuaternionInterpolant) and only normalises afterwards, so between such
keys the bone swings through a near-zero quaternion, a one-frame flip of the limb. Some exported tangents also do not
follow their key's sign.

fix_glb_quaternion_signs(path) rewrites every rotation sampler in place (same accessors, same byte size):
  * keys are made sign-continuous (a key whose dot with the one before is negative is negated);
  * every CUBICSPLINE key gets Catmull-Rom tangents (in = out, per second, non-uniform times): cyclic across the
    loop seam for looping clips whose first and last keys are the same rotation, flat at both ends of the one-shot
    clips (attack_*, a companion's appear) and of any track that does not close.
LINEAR / STEP rotation samplers only get the sign pass. Translation and scale channels are untouched.
"""
import json
import struct

import numpy as np

# the girls' and companions' one-shot clips (src/models/glbChibi.js GlbAnimator plays attack* and appear with LoopOnce);
# everything else loops. 'death' is kept for figures that carry one. Before running this on the enemies, add 'hit' and
# 'special' too (glbEnemy.js plays them once).
ONE_SHOT_PREFIXES = ('attack', 'appear', 'death')


def is_one_shot(name):
    return any((name or '').startswith(p) for p in ONE_SHOT_PREFIXES)


def _read_glb(path):
    with open(path, 'rb') as f:
        data = f.read()
    magic, _version, length = struct.unpack_from('<III', data, 0)
    if magic != 0x46546C67:
        raise ValueError(f'{path}: not a GLB')
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


def _write_glb(path, js, bin_chunk):
    jbytes = json.dumps(js, separators=(',', ':')).encode('utf-8')
    jbytes += b' ' * ((4 - len(jbytes) % 4) % 4)
    bin_chunk = bytes(bin_chunk) + b'\0' * ((4 - len(bin_chunk) % 4) % 4)
    total = 12 + 8 + len(jbytes) + 8 + len(bin_chunk)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(jbytes), 0x4E4F534A))
        f.write(jbytes)
        f.write(struct.pack('<II', len(bin_chunk), 0x004E4942))
        f.write(bin_chunk)


def _float_view(js, buf, idx, ncomp):
    """A writable float32 (count, ncomp) view of a tightly packed float accessor inside buf."""
    acc = js['accessors'][idx]
    if acc['componentType'] != 5126 or acc.get('normalized'):
        raise ValueError(f'accessor {idx}: expected plain float32, got {acc["componentType"]}')
    bv = js['bufferViews'][acc['bufferView']]
    stride = bv.get('byteStride', 0)
    if stride and stride != 4 * ncomp:
        raise ValueError(f'accessor {idx}: interleaved animation data is not supported')
    start = bv.get('byteOffset', 0) + acc.get('byteOffset', 0)
    return np.frombuffer(buf, dtype=np.float32, count=acc['count'] * ncomp, offset=start).reshape(acc['count'], ncomp)


def _sign_continuous(vals):
    """Negates keys in place so each key's dot with the previous one is >= 0. Returns the per-key sign applied."""
    signs = np.ones(len(vals), dtype=np.float32)
    for k in range(1, len(vals)):
        if float(np.dot(vals[k], vals[k - 1])) < 0.0:
            vals[k] *= -1.0
            signs[k] = -1.0
    return signs


def catmull_rom_tangents(times, vals, cyclic):
    """Per-second tangents for sign-continuous keys `vals` (n, 4) at `times` (n,).

    cyclic: the track closes (its last key is its first rotation) and wraps; the end tangents then look across the seam
    (the last key's neighbour after the seam is the second key, the first key's neighbour before it is the second-last).
    Otherwise both end tangents are zero (flat), so a one-shot clip eases into its first and last poses."""
    n = len(vals)
    tan = np.zeros_like(vals)
    if n < 2:
        return tan
    for k in range(1, n - 1):
        dt = float(times[k + 1] - times[k - 1])
        if dt > 0:
            tan[k] = (vals[k + 1] - vals[k - 1]) / dt
    if cyclic and n >= 3:
        # the last key is the first rotation, possibly with the opposite sign after the sign pass
        s = 1.0 if float(np.dot(vals[-1], vals[0])) >= 0.0 else -1.0
        dt = float((times[1] - times[0]) + (times[-1] - times[-2]))
        if dt > 0:
            tan[0] = (vals[1] - s * vals[-2]) / dt
            tan[-1] = s * tan[0]
    return tan


def _closes(times, vals, duration, tol=1e-3):
    """True when the track runs the whole loop and its last key is the same rotation as its first."""
    if len(vals) < 3 or abs(float(times[0])) > tol or abs(float(times[-1]) - duration) > tol:
        return False
    return abs(abs(float(np.dot(vals[0], vals[-1]))) - 1.0) < 1e-4


def fix_glb_quaternion_signs(path, out=None, one_shot=is_one_shot):
    """Rewrites the rotation keys of every clip in the GLB at `path` (see the module docstring). In place unless `out`
    is given; the file keeps its byte size. Returns a summary dict (keys negated, tracks, tracks given cyclic tangents)."""
    js, bin_chunk = _read_glb(path)
    buf = bytearray(bin_chunk)
    done = {}  # output accessor -> clip name that already rewrote it (accessors may be shared)
    stats = dict(tracks=0, negated=0, cyclic=0, cubic=0)
    for anim in js.get('animations', []):
        name = anim.get('name', '')
        samplers = anim['samplers']
        # the clip's length as three sees it (the last key over all its tracks)
        duration = max((js['accessors'][s['input']]['max'][0] for s in samplers), default=0.0)
        loops = not one_shot(name)
        for ch in anim['channels']:
            if ch['target'].get('path') != 'rotation':
                continue
            s = samplers[ch['sampler']]
            if s['output'] in done:
                continue
            done[s['output']] = name
            times = _float_view(js, buf, s['input'], 1)[:, 0]
            n = len(times)
            interp = s.get('interpolation', 'LINEAR')
            stats['tracks'] += 1
            if interp == 'CUBICSPLINE':
                data = _float_view(js, buf, s['output'], 4).reshape(n, 3, 4)
                vals = data[:, 1].copy()
                signs = _sign_continuous(vals)
                cyclic = loops and _closes(times, vals, duration)
                tan = catmull_rom_tangents(times, vals, cyclic)
                data[:, 0] = tan
                data[:, 1] = vals
                data[:, 2] = tan
                stats['cubic'] += 1
                stats['cyclic'] += int(cyclic)
            else:
                vals = _float_view(js, buf, s['output'], 4)
                signs = _sign_continuous(vals)
            stats['negated'] += int((signs < 0).sum())
    _write_glb(out or path, js, buf)
    return stats


if __name__ == '__main__':
    import sys
    for p in sys.argv[1:]:
        print(p, fix_glb_quaternion_signs(p))
