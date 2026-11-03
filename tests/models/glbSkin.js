// Minimal GLB reader for the model tests (not a test file): positions (KHR_mesh_quantization dequantised), skin joints
// and weights per primitive, every node's rest world matrix and the skin's inverse bind matrices. No three.js, no
// textures. Matrices are column-major Float64Array(16), like glTF and three.
import { readFileSync } from 'node:fs';

const CT = { 5126: Float32Array, 5123: Uint16Array, 5121: Uint8Array, 5125: Uint32Array, 5122: Int16Array, 5120: Int8Array };
const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

export function mul(a, b) {
  const o = new Float64Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
}

export function xf(m, x, y, z) {
  return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
}

export function invert(a) {
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = a;
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const det = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
  return Float64Array.from([
    (a11 * b11 - a12 * b10 + a13 * b09) * det, (a02 * b10 - a01 * b11 - a03 * b09) * det, (a31 * b05 - a32 * b04 + a33 * b03) * det, (a22 * b04 - a21 * b05 - a23 * b03) * det,
    (a12 * b08 - a10 * b11 - a13 * b07) * det, (a00 * b11 - a02 * b08 + a03 * b07) * det, (a32 * b02 - a30 * b05 - a33 * b01) * det, (a20 * b05 - a22 * b02 + a23 * b01) * det,
    (a10 * b10 - a11 * b08 + a13 * b06) * det, (a01 * b08 - a00 * b10 - a03 * b06) * det, (a30 * b04 - a31 * b02 + a33 * b00) * det, (a21 * b02 - a20 * b04 - a23 * b00) * det,
    (a11 * b07 - a10 * b09 - a12 * b06) * det, (a00 * b09 - a01 * b07 + a02 * b06) * det, (a31 * b01 - a30 * b03 - a32 * b00) * det, (a20 * b03 - a21 * b01 + a22 * b00) * det,
  ]);
}

function localMatrix(n) {
  if (n.matrix) return Float64Array.from(n.matrix);
  const [x, y, z, w] = n.rotation || [0, 0, 0, 1];
  const [sx, sy, sz] = n.scale || [1, 1, 1];
  const [tx, ty, tz] = n.translation || [0, 0, 0];
  const x2 = x + x, y2 = y + y, z2 = z + z, xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
  return Float64Array.from([(1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0, (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0, (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0, tx, ty, tz, 1]);
}

/** Reads a GLB: { json, extras, bones (skin 0 joint names), boneRest(k) (rest world matrix), prims, nodeWorld(name) }. */
export function readGlbSkin(file) {
  const b = readFileSync(file);
  const jl = b.readUInt32LE(12);
  const j = JSON.parse(b.subarray(20, 20 + jl).toString('utf8'));
  const binStart = 20 + jl + 8;
  const dv = new DataView(b.buffer, b.byteOffset + binStart, b.length - binStart);
  const acc = (i) => {
    const a = j.accessors[i];
    const bv = j.bufferViews[a.bufferView];
    const n = NC[a.type];
    const T = CT[a.componentType];
    const size = T.BYTES_PER_ELEMENT;
    const off = (bv.byteOffset || 0) + (a.byteOffset || 0);
    const stride = bv.byteStride || n * size;
    const out = new Float64Array(a.count * n);
    for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) {
      const o = off + k * stride + c * size;
      let v;
      if (T === Float32Array) v = dv.getFloat32(o, true);
      else if (T === Uint16Array) v = dv.getUint16(o, true);
      else if (T === Uint8Array) v = dv.getUint8(o);
      else if (T === Int16Array) v = dv.getInt16(o, true);
      else if (T === Int8Array) v = dv.getInt8(o);
      else v = dv.getUint32(o, true);
      if (a.normalized) {
        if (T === Uint16Array) v /= 65535;
        else if (T === Uint8Array) v /= 255;
        else if (T === Int16Array) v = Math.max(-1, v / 32767);
        else if (T === Int8Array) v = Math.max(-1, v / 127);
      }
      out[k * n + c] = v;
    }
    return out;
  };
  const parent = new Map();
  (j.nodes || []).forEach((n, i) => (n.children || []).forEach((c) => parent.set(c, i)));
  const world = new Map();
  const worldOf = (i) => {
    if (world.has(i)) return world.get(i);
    const l = localMatrix(j.nodes[i]);
    const p = parent.get(i);
    const m = p == null ? l : mul(worldOf(p), l);
    world.set(i, m);
    return m;
  };
  const skin = j.skins?.[0];
  const bones = skin ? skin.joints.map((i) => j.nodes[i].name) : [];
  const ibm = skin?.inverseBindMatrices != null ? acc(skin.inverseBindMatrices) : null;
  const prims = [];
  (j.meshes || []).forEach((m, mi) => {
    const ni = j.nodes.findIndex((n) => n.mesh === mi);
    for (const p of m.primitives) {
      prims.push({
        node: j.nodes[ni]?.name, nodeWorld: worldOf(ni), skinned: p.attributes.JOINTS_0 != null,
        pos: acc(p.attributes.POSITION),
        joints: p.attributes.JOINTS_0 != null ? acc(p.attributes.JOINTS_0) : null,
        weights: p.attributes.WEIGHTS_0 != null ? acc(p.attributes.WEIGHTS_0) : null,
      });
    }
  });
  return {
    json: j,
    extras: j.asset?.extras || {},
    bones,
    /** rest (bind) world matrix of skin joint k */
    boneRest: (k) => invert(ibm.subarray(k * 16, k * 16 + 16)),
    prims,
    nodeWorld: (name) => {
      const i = j.nodes.findIndex((n) => n.name === name);
      return i < 0 ? null : worldOf(i);
    },
  };
}
