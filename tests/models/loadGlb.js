// Loads a shipped GLB through three's own GLTFLoader in node (not a test file itself): the images are left out (node
// has no WebP decoder; the materials keep their names and everything else is the file as the game parses it: skins,
// clips, primitives, the face). For tests that drive the real runtime (AnimationMixer, glbEnemy.instantiateEnemy).
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** The GLB's JSON and BIN chunks. */
function chunks(file) {
  const buf = readFileSync(file);
  let off = 12;
  let json = null;
  let bin = null;
  while (off < buf.length) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    off += 8;
    if (type === 0x4e4f534a) json = JSON.parse(buf.subarray(off, off + len).toString('utf8'));
    else if (type === 0x004e4942) bin = buf.subarray(off, off + len);
    off += len;
  }
  return { json, bin };
}

/** A GLB as an ArrayBuffer, rebuilt from its JSON and BIN. */
function glb(json, bin) {
  const enc = new TextEncoder().encode(JSON.stringify(json));
  const jsonLen = Math.ceil(enc.length / 4) * 4;
  const binLen = Math.ceil(bin.length / 4) * 4;
  const out = new Uint8Array(12 + 8 + jsonLen + 8 + binLen);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, out.length, true);
  dv.setUint32(12, jsonLen, true);
  dv.setUint32(16, 0x4e4f534a, true);
  out.set(enc, 20);
  out.fill(0x20, 20 + enc.length, 20 + jsonLen);
  dv.setUint32(20 + jsonLen, binLen, true);
  dv.setUint32(24 + jsonLen, 0x004e4942, true);
  out.set(bin, 28 + jsonLen);
  return out.buffer;
}

/** Parses a shipped GLB with GLTFLoader, its images left out. Resolves the gltf ({ scene, animations, parser }). */
export function loadGlb(file) {
  const { json, bin } = chunks(file);
  for (const m of json.materials || []) {
    const pbr = m.pbrMetallicRoughness;
    if (pbr) {
      delete pbr.baseColorTexture;
      delete pbr.metallicRoughnessTexture;
    }
    delete m.normalTexture;
    delete m.emissiveTexture;
    delete m.occlusionTexture;
  }
  delete json.images;
  delete json.textures;
  delete json.samplers;
  for (const k of ['extensionsUsed', 'extensionsRequired']) {
    if (json[k]) json[k] = json[k].filter((e) => e !== 'EXT_texture_webp');
  }
  return new Promise((resolve, reject) => new GLTFLoader().parse(glb(json, bin), '', resolve, reject));
}
