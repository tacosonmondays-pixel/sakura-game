// Path-look pieces: loads public/models/pathlooks/<unit>_p<path>.glb (tools/blender/pathlooks/build_path_looks.py) once
// per file and hands out instances that share geometry and materials (display only).
//
// Materials are shared by every piece of every girl: `body` meshes use the chibis' own toon material (vertex colours;
// the same program and ramp as the figures), `glow` meshes one unlit vertex-colour material, and the outline hull one
// back-face colour. A piece is one or two meshes, plus one hull on medium/high: no textures, no extra programs.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { toonMaterial } from '../../models/toon.js';
import { baseUrl, assetExt, canLoadCharacters } from '../../models/glbChibi.js';

/** Hull push (figure units): a little thinner than the figures' line, so small pieces keep their colour. */
const OUTLINE_W = 0.0075;

const files = new Map(); // file -> { status: 'loading'|'ready'|'failed', pieces: Map<name, piece>, promise }
let loader = null;
let mats = null;

export function pieceUrl(file) {
  return `${baseUrl()}models/pathlooks/${file}.glb${assetExt()}`;
}

function materials() {
  if (mats) return mats;
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const outline = new THREE.MeshBasicMaterial({ color: '#3a2e44', side: THREE.BackSide });
  for (const m of [glow, outline]) m.userData.shared = true;
  mats = { body: toonMaterial({ vertexColors: true }), glow, outline };
  return mats;
}

/** Inverted hull of a (quantized) piece geometry: positions pushed out along the normals, float32. */
function hullGeometry(geo) {
  const p = geo.attributes.position;
  const n = geo.attributes.normal;
  const out = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    out[i * 3] = p.getX(i) + n.getX(i) * OUTLINE_W;
    out[i * 3 + 1] = p.getY(i) + n.getY(i) * OUTLINE_W;
    out[i * 3 + 2] = p.getZ(i) + n.getZ(i) * OUTLINE_W;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(out, 3));
  if (geo.index) g.setIndex(geo.index);
  g.userData.shared = true;
  return g;
}

function prepare(gltf) {
  const pieces = new Map();
  gltf.scene.updateMatrixWorld(true);
  for (const root of gltf.scene.children) {
    const parts = [];
    let triangles = 0;
    root.traverse((o) => {
      if (!o.isMesh) return;
      const kind = o.name.endsWith('_glow') ? 'glow' : 'body';
      const geometry = o.geometry;
      geometry.userData.shared = true;
      geometry.computeBoundingSphere();
      const tris = (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
      triangles += tris;
      // the mesh's own transform inside the piece (identity from the builder, kept in case)
      const local = o.matrixWorld.clone().premultiply(root.matrixWorld.clone().invert());
      parts.push({ kind, geometry, hull: kind === 'body' ? hullGeometry(geometry) : null, local, tris });
    });
    pieces.set(root.name, { name: root.name, parts, triangles });
  }
  return pieces;
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
 * A new instance of a piece (shared geometry + materials).
 * @param {object} piece from getPiece
 * @param {{ quality?: string, shadows?: boolean }} [o]
 * @returns {THREE.Group} with userData.triangles, userData.meshes
 */
export function instancePiece(piece, { quality = 'high', shadows = false } = {}) {
  const m = materials();
  const g = new THREE.Group();
  g.name = `pathLook:${piece.name}`;
  let meshes = 0;
  let triangles = 0;
  for (const part of piece.parts) {
    const mesh = new THREE.Mesh(part.geometry, part.kind === 'glow' ? m.glow : m.body);
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(part.local);
    mesh.frustumCulled = false;
    mesh.castShadow = shadows && part.kind === 'body';
    if (part.kind === 'glow') mesh.userData.fx = true;
    g.add(mesh);
    meshes++;
    triangles += part.tris;
    if (part.hull && quality !== 'low') {
      const hull = new THREE.Mesh(part.hull, m.outline);
      hull.matrixAutoUpdate = false;
      hull.matrix.copy(part.local);
      hull.frustumCulled = false;
      hull.userData.isOutline = true;
      g.add(hull);
      meshes++;
      triangles += part.tris;
    }
  }
  g.userData.meshes = meshes;
  g.userData.triangles = Math.round(triangles);
  return g;
}

/** Frees the shared pieces (the last battle renderer disposed). */
export function clearPieceCache() {
  for (const f of files.values()) {
    if (f.status !== 'ready') continue;
    for (const p of f.pieces.values()) for (const part of p.parts) { part.geometry.dispose(); part.hull?.dispose(); }
  }
  files.clear();
  if (mats) {
    mats.glow.dispose();
    mats.outline.dispose();
  }
  mats = null;
}
