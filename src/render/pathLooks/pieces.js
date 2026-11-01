// Path-look pieces: loads public/models/pathlooks/<unit>_p<path>.glb (tools/blender/pathlooks/build_path_looks.py) once
// per file and hands out shared geometry (display only).
//
// Draw calls (review r1, MEDIUM-1): a piece is ONE mesh: its `_body` and `_glow` parts are merged into one geometry
// with a per-vertex glow flag (`aGlow`), drawn by one toon material that turns flagged vertices unlit. And a girl's
// static pieces (no spin / bob) are merged into ONE skinned mesh on her own skeleton: every piece vertex rigidly
// weighted to its socket bone, so the merge follows every clip exactly as a socketed piece would. A girl therefore
// costs 1 draw call for all her static pieces + 1 per animated piece, and one more of each for the outline hull on
// medium / high. Merged geometries are cached per (model asset, detail, piece set) and shared by every instance.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { gradientMap } from '../../models/toon.js';
import { baseUrl, assetExt, canLoadCharacters } from '../../models/glbChibi.js';

/** Hull push (figure units): a little thinner than the figures' line, so small pieces keep their colour. */
const OUTLINE_W = 0.0075;
/** Glow parts are drawn a touch above their own colour (they used to be unlit and un-tone-mapped). */
const GLOW_GAIN = '1.18';

const files = new Map(); // file -> { status: 'loading'|'ready'|'failed', pieces: Map<name, piece>, promise }
const merged = new Map(); // cache key -> { geometry, hull, triangles }
let loader = null;
let mats = null;

export function pieceUrl(file) {
  return `${baseUrl()}models/pathlooks/${file}.glb${assetExt()}`;
}

/** The one piece material: the chibis' toon ramp on vertex colours; vertices flagged `aGlow` are drawn unlit. */
function pieceMaterial() {
  const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradientMap(3) });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aGlow;\nvarying float vGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGlow;')
      .replace('#include <opaque_fragment>', `outgoingLight = mix(outgoingLight, diffuseColor.rgb * ${GLOW_GAIN}, vGlow);\n#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'pathLookPiece';
  m.userData.shared = true;
  return m;
}

export function materials() {
  if (mats) return mats;
  const outline = new THREE.MeshBasicMaterial({ color: '#3a2e44', side: THREE.BackSide });
  outline.userData.shared = true;
  mats = { piece: pieceMaterial(), outline };
  return mats;
}

/** Reads a (quantized, maybe indexed) part into flat float arrays. */
function readPart(geo, local, glow) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position;
  const n = g.attributes.normal;
  const c = g.attributes.color;
  const nm = new THREE.Matrix3().getNormalMatrix(local);
  const v = new THREE.Vector3();
  const count = p.count;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    v.set(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(local);
    pos.set([v.x, v.y, v.z], i * 3);
    v.set(n.getX(i), n.getY(i), n.getZ(i)).applyMatrix3(nm).normalize();
    nor.set([v.x, v.y, v.z], i * 3);
    if (c) col.set([c.getX(i), c.getY(i), c.getZ(i)], i * 3);
    else col.fill(1, i * 3, i * 3 + 3);
  }
  if (g !== geo) g.dispose();
  return { pos, nor, col, glow: glow ? 1 : 0, count };
}

/** One piece's data: every part flattened, plus its outline hull (body parts only). */
function prepare(gltf) {
  const pieces = new Map();
  gltf.scene.updateMatrixWorld(true);
  for (const root of gltf.scene.children) {
    const parts = [];
    const rootInv = root.matrixWorld.clone().invert();
    root.traverse((o) => {
      if (!o.isMesh) return;
      const local = o.matrixWorld.clone().premultiply(rootInv);
      parts.push(readPart(o.geometry, local, o.name.endsWith('_glow')));
      o.geometry.dispose();
    });
    const count = parts.reduce((s, x) => s + x.count, 0);
    const hullCount = parts.reduce((s, x) => s + (x.glow ? 0 : x.count), 0);
    const pos = new Float32Array(count * 3);
    const nor = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const glow = new Float32Array(count);
    const hull = new Float32Array(hullCount * 3);
    let k = 0;
    let h = 0;
    for (const x of parts) {
      pos.set(x.pos, k * 3);
      nor.set(x.nor, k * 3);
      col.set(x.col, k * 3);
      glow.fill(x.glow, k, k + x.count);
      if (!x.glow) {
        for (let i = 0; i < x.count * 3; i++) hull[h * 3 + i] = x.pos[i] + x.nor[i] * OUTLINE_W;
        h += x.count;
      }
      k += x.count;
    }
    const piece = { name: root.name, pos, nor, col, glow, hull, count, hullCount, triangles: count / 3, geometry: null, hullGeometry: null };
    // standalone geometry (an animated piece is its own mesh)
    piece.geometry = mergeGeometry([{ piece, m: null }], null);
    piece.hullGeometry = hullCount ? buildHull([{ piece, m: null }]) : null;
    pieces.set(root.name, piece);
  }
  return pieces;
}

/**
 * One geometry from pieces placed by matrices (m null = as authored). With `skin` ({ indices: [bone index per entry] })
 * every vertex is rigidly weighted to its entry's bone.
 */
function mergeGeometry(entries, skin) {
  const count = entries.reduce((s, e) => s + e.piece.count, 0);
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const glow = new Float32Array(count);
  const si = skin ? new Uint16Array(count * 4) : null;
  const sw = skin ? new Float32Array(count * 4) : null;
  const v = new THREE.Vector3();
  let k = 0;
  entries.forEach((e, idx) => {
    const p = e.piece;
    const nm = e.m ? new THREE.Matrix3().getNormalMatrix(e.m) : null;
    for (let i = 0; i < p.count; i++) {
      v.fromArray(p.pos, i * 3);
      if (e.m) v.applyMatrix4(e.m);
      v.toArray(pos, (k + i) * 3);
      v.fromArray(p.nor, i * 3);
      if (nm) v.applyMatrix3(nm).normalize();
      v.toArray(nor, (k + i) * 3);
    }
    col.set(p.col, k * 3);
    glow.set(p.glow, k);
    if (skin) {
      for (let i = 0; i < p.count; i++) {
        si[(k + i) * 4] = skin.indices[idx];
        sw[(k + i) * 4] = 1;
      }
    }
    k += p.count;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aGlow', new THREE.BufferAttribute(glow, 1));
  if (skin) {
    g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  }
  g.userData.shared = true;
  return g;
}

function buildHull(entries, skin = null) {
  const count = entries.reduce((s, e) => s + e.piece.hullCount, 0);
  if (!count) return null;
  const pos = new Float32Array(count * 3);
  const si = skin ? new Uint16Array(count * 4) : null;
  const sw = skin ? new Float32Array(count * 4) : null;
  const v = new THREE.Vector3();
  let k = 0;
  entries.forEach((e, idx) => {
    const p = e.piece;
    for (let i = 0; i < p.hullCount; i++) {
      v.fromArray(p.hull, i * 3);
      if (e.m) v.applyMatrix4(e.m);
      v.toArray(pos, (k + i) * 3);
      if (skin) {
        si[(k + i) * 4] = skin.indices[idx];
        sw[(k + i) * 4] = 1;
      }
    }
    k += p.hullCount;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (skin) {
    g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  }
  g.userData.shared = true;
  return g;
}

/** Starts loading a pieces file (idempotent). Resolves true when ready. */
export function loadPieces(file) {
  let f = files.get(file);
  if (f) return f.promise;
  f = { status: 'loading', pieces: null, promise: null };
  files.set(file, f);
  if (!canLoadCharacters()) {
    f.status = 'failed';
    f.promise = Promise.resolve(false);
    return f.promise;
  }
  loader ??= new GLTFLoader();
  f.promise = loader.loadAsync(pieceUrl(file)).then((gltf) => {
    f.pieces = prepare(gltf);
    f.status = 'ready';
    return true;
  }).catch((e) => {
    console.warn(`[pathLooks] ${file} unavailable`, e?.message || e);
    f.status = 'failed';
    return false;
  });
  return f.promise;
}

/** A loaded piece's shared data, or null (not loaded yet / missing). */
export function getPiece(file, name) {
  const f = files.get(file);
  return f?.status === 'ready' ? f.pieces.get(name) || null : null;
}

export function fileStatus(file) {
  return files.get(file)?.status || 'none';
}

/**
 * One animated piece as its own mesh (+ hull on medium / high).
 * @returns {THREE.Group} userData.meshes, userData.triangles
 */
export function instancePiece(piece, { quality = 'high', shadows = false } = {}) {
  const m = materials();
  const g = new THREE.Group();
  g.name = `pathLook:${piece.name}`;
  const mesh = new THREE.Mesh(piece.geometry, m.piece);
  mesh.frustumCulled = false;
  mesh.castShadow = shadows;
  g.add(mesh);
  let meshes = 1;
  let triangles = piece.triangles;
  if (piece.hullGeometry && quality !== 'low') {
    const hull = new THREE.Mesh(piece.hullGeometry, m.outline);
    hull.frustumCulled = false;
    hull.userData.isOutline = true;
    g.add(hull);
    meshes++;
    triangles += piece.hullCount / 3;
  }
  g.userData.meshes = meshes;
  g.userData.triangles = Math.round(triangles);
  return g;
}

/**
 * A girl's static pieces as ONE skinned mesh on her own skeleton (+ one skinned hull on medium / high).
 * @param {string} key cache key: model asset + detail + piece set (the geometry only depends on those)
 * @param {Array<{ piece, bone: THREE.Bone, local: THREE.Matrix4 }>} entries local: the piece's frame in its bone's
 *   space (what a holder under that bone would carry)
 * @param {THREE.SkinnedMesh} body her body mesh (skeleton + bind matrix)
 * @returns {THREE.Group|null}
 */
export function mergedPieces(key, entries, body, { quality = 'high', shadows = false } = {}) {
  const skel = body?.skeleton;
  if (!skel || !entries.length) return null;
  let c = merged.get(key);
  if (!c) {
    // vertex = bindMatrix⁻¹ · boneInverse⁻¹ · local · p, so that skinning (bone.matrixWorld · boneInverse · bindMatrix)
    // lands it at bone.matrixWorld · local · p: exactly where a holder under that bone would put it
    const bindInv = body.bindMatrix.clone().invert();
    const placed = [];
    const indices = [];
    for (const e of entries) {
      const bi = skel.bones.indexOf(e.bone);
      if (bi < 0) continue;
      const m = bindInv.clone().multiply(skel.boneInverses[bi].clone().invert()).multiply(e.local);
      placed.push({ piece: e.piece, m });
      indices.push(bi);
    }
    if (!placed.length) return null;
    const skin = { indices };
    c = {
      geometry: mergeGeometry(placed, skin), hull: buildHull(placed, skin),
      triangles: placed.reduce((s, e) => s + e.piece.triangles, 0), hullTriangles: placed.reduce((s, e) => s + e.piece.hullCount / 3, 0),
    };
    merged.set(key, c);
  }
  const m = materials();
  const g = new THREE.Group();
  g.name = 'pathLook:merged';
  const mesh = new THREE.SkinnedMesh(c.geometry, m.piece);
  mesh.bind(skel, body.bindMatrix);
  mesh.frustumCulled = false;
  mesh.castShadow = shadows;
  g.add(mesh);
  let meshes = 1;
  let triangles = c.triangles;
  if (c.hull && quality !== 'low') {
    const hull = new THREE.SkinnedMesh(c.hull, m.outline);
    hull.bind(skel, body.bindMatrix);
    hull.frustumCulled = false;
    hull.userData.isOutline = true;
    g.add(hull);
    meshes++;
    triangles += c.hullTriangles;
  }
  g.userData.meshes = meshes;
  g.userData.triangles = Math.round(triangles);
  return g;
}

/** Frees the shared pieces (the last battle renderer disposed). */
export function clearPieceCache() {
  for (const f of files.values()) {
    if (f.status !== 'ready') continue;
    for (const p of f.pieces.values()) { p.geometry.dispose(); p.hullGeometry?.dispose(); }
  }
  for (const c of merged.values()) { c.geometry.dispose(); c.hull?.dispose(); }
  files.clear();
  merged.clear();
  if (mats) for (const x of Object.values(mats)) x.dispose();
  mats = null;
}
