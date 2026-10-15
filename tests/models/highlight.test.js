// Selection highlight (src/models/highlight.js): a tapped girl keeps her own colours. Before, a
// blue emissive wash ('#4d6dff' × 0.35) turned Chika's brown hair and orange suit purple /
// lavender. Now: neutral emissive × her own albedo (≈ +15 %, hue and saturation unchanged) and a
// soft white rim, the same on the procedural chibis, the GLB toon girls and the painted figurines.
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { SELECT_HIGHLIGHT, SELECT_PROGRAM_KEY, selectToonMaterial, selectTwin } from '../../src/models/highlight.js';
import { toonMaterial } from '../../src/models/toon.js';
import { figurineMaterial, EYE_MODES } from '../../src/models/figurine.js';
import { instantiateCharacter, FACE_CELLS } from '../../src/models/glbChibi.js';
import { buildChibi, disposeObject } from '../../src/models/index.js';
import { getUnit } from '../../src/data/units.js';

function fakeShader(material) {
  const lib = material.isMeshStandardMaterial ? THREE.ShaderLib.standard : material.isMeshToonMaterial ? THREE.ShaderLib.toon : THREE.ShaderLib.basic;
  const shader = { uniforms: {}, vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader };
  material.onBeforeCompile(shader);
  return shader;
}

const isNeutral = (c) => Math.abs(c.r - c.g) < 1e-6 && Math.abs(c.g - c.b) < 1e-6;
const RIM_CODE = 'totalEmissiveRadiance += selRimColor * ( selRim * selEdge )';
const LIFT_CODE = 'totalEmissiveRadiance *= diffuseColor.rgb';

// CPU model of the lit colour: albedo × irradiance + emissive (linear), then sRGB, then HSV
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const linHex = (h) => [1, 3, 5].map((i) => toLin(parseInt(h.slice(i, i + 2), 16) / 255));
function hsv(rgb) {
  const [r, g, b] = rgb.map((c) => toSrgb(Math.min(1, c)));
  const mx = Math.max(r, g, b);
  const d = mx - Math.min(r, g, b);
  let h = 0;
  if (d > 0) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: mx ? d / mx : 0, v: mx };
}
const dHue = (a, b) => ((b - a + 540) % 360) - 180;

/** A loaded-asset stand-in for glbChibi.instantiateCharacter (no GLTF needed). */
function fakeAsset({ textured = false } = {}) {
  const scene = new THREE.Group();
  const geo = () => {
    const g = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count * 3).fill(0.7), 3));
    return g;
  };
  const mesh = (name, extra = {}) => {
    const m = new THREE.Mesh(geo(), new THREE.MeshStandardMaterial({ name, ...extra }));
    scene.add(m);
    return m;
  };
  const common = { id: 'fake', detail: 'full', scene, clips: {}, haloColor: new THREE.Color('#bfe8ff'), haloLine: '#335577', extras: {}, unitScale: 1, cells: FACE_CELLS, grid: 3, outlineTint: undefined, materials: {} };
  if (textured) {
    const map = new THREE.Texture();
    mesh('body', { map });
    const eyes = { centers: [[-0.08, 0.58, 0.16], [0.08, 0.58, 0.16]], radii: [[0.05, 0.04], [0.05, 0.04]] };
    return { ...common, faceTexture: null, height: 1.2, textured: true, bodyMaps: { map }, eyes };
  }
  const face = new THREE.Texture();
  mesh('head', { map: face });
  mesh('body');
  mesh('halo');
  return { ...common, faceTexture: face, height: 0.9, textured: false, bodyMaps: null, eyes: null };
}

describe('selection highlight', () => {
  it('is neutral and gentle: white emissive at a small intensity, a soft white rim', () => {
    expect(isNeutral(new THREE.Color(SELECT_HIGHLIGHT.emissive))).toBe(true);
    expect(isNeutral(new THREE.Color(SELECT_HIGHLIGHT.rimColor))).toBe(true);
    expect(SELECT_HIGHLIGHT.glow).toBeGreaterThanOrEqual(0.08);
    expect(SELECT_HIGHLIGHT.glow).toBeLessThanOrEqual(0.25);
    expect(SELECT_HIGHLIGHT.rim).toBeGreaterThan(0);
    expect(SELECT_HIGHLIGHT.rim).toBeLessThanOrEqual(0.5);
    // the rim stays on her silhouette: nothing where she faces the 48° battle camera (N·V ≥ 0.4)
    expect(SELECT_HIGHLIGHT.rimStart).toBeGreaterThanOrEqual(0.6);
    expect(SELECT_HIGHLIGHT.rimStart).toBeLessThan(0.9);
  });

  // regression guard for "she looks like a different girl when tapped"
  it('keeps her hue: a selected colour is the same hue, a little brighter (the old blue wash was not)', () => {
    const oldWash = new THREE.Color('#4d6dff'); // linear components
    const colours = { 'Chika hair': '#7a5040', 'Chika suit': '#f0a020', 'Hikari hair': '#fc99b1', 'Aoi hair': '#4a6fd0', navy: '#1d2540' };
    for (const [name, hex] of Object.entries(colours)) {
      const a = linHex(hex);
      for (const irr of [0.55, 0.8]) { // toon shadow / lit bands under the battle lights
        const plain = hsv(a.map((c) => c * irr));
        const sel = hsv(a.map((c) => c * irr + SELECT_HIGHLIGHT.glow * c));
        expect(Math.abs(dHue(plain.h, sel.h)), `${name} @${irr} hue`).toBeLessThan(0.5);
        expect(Math.abs(sel.s - plain.s), `${name} @${irr} saturation`).toBeLessThan(0.02);
        expect(sel.v / plain.v, `${name} @${irr} brighter`).toBeGreaterThan(1.04);
        expect(sel.v / plain.v, `${name} @${irr} not washed out`).toBeLessThan(1.2);
        // the rim at her silhouette adds white light: lighter there, still her hue family
        const edge = hsv(a.map((c) => c * irr + SELECT_HIGHLIGHT.glow * c + SELECT_HIGHLIGHT.rim));
        expect(Math.abs(dHue(plain.h, edge.h)), `${name} @${irr} rim hue`).toBeLessThan(12);
      }
    }
    // the check would have caught the blue wash on Chika's brown hair and orange suit
    for (const hex of ['#7a5040', '#f0a020']) {
      const a = linHex(hex);
      const plain = hsv(a.map((c) => c * 0.8));
      const washed = hsv(a.map((c, i) => c * 0.8 + 0.35 * [oldWash.r, oldWash.g, oldWash.b][i]));
      expect(Math.abs(dHue(plain.h, washed.h))).toBeGreaterThan(30);
    }
  });

  it('toon bodies: one cached, shared highlight material per vertex-colour mode; the plain toon is untouched', () => {
    const hl = selectToonMaterial({ vertexColors: true });
    expect(selectToonMaterial({ vertexColors: true })).toBe(hl);
    expect(selectToonMaterial({ vertexColors: false })).not.toBe(hl);
    expect(hl.userData.shared).toBe(true);
    expect(hl.vertexColors).toBe(true);
    expect(isNeutral(hl.emissive)).toBe(true);
    expect(hl.emissiveIntensity).toBe(SELECT_HIGHLIGHT.glow);
    expect(hl.color.getHex()).toBe(0xffffff);
    expect(hl.gradientMap).toBe(toonMaterial().gradientMap);
    const sh = fakeShader(hl);
    expect(sh.fragmentShader).toContain(LIFT_CODE);
    expect(sh.fragmentShader).toContain(RIM_CODE);
    expect(sh.fragmentShader.indexOf(LIFT_CODE)).toBeGreaterThan(sh.fragmentShader.indexOf('#include <emissivemap_fragment>'));
    expect(sh.uniforms.selRim.value).toBe(SELECT_HIGHLIGHT.rim);
    expect(hl.customProgramCacheKey()).toBe(SELECT_PROGRAM_KEY);
    // the shared plain toon body: no emissive, no patch
    const plain = toonMaterial();
    expect(plain.emissive.getHex()).toBe(0);
    expect(plain.customProgramCacheKey()).not.toBe(SELECT_PROGRAM_KEY);
    // a highlighted twin of a per-instance material (a GLB girl's face) keeps its maps
    const face = new THREE.MeshToonMaterial({ map: new THREE.Texture(), color: '#ffffff' });
    const twin = selectTwin(face);
    expect(twin).not.toBe(face);
    expect(twin.map).toBe(face.map);
    expect(twin.userData.shared).toBeFalsy();
    expect(isNeutral(twin.emissive) && twin.emissiveIntensity === SELECT_HIGHLIGHT.glow).toBe(true);
    expect(face.emissive.getHex()).toBe(0);
    expect(fakeShader(twin).fragmentShader).toContain(RIM_CODE);
  });

  it('figurine: rim + lift only in highlight materials, one program for all highlighted eye states', () => {
    const map = new THREE.Texture();
    const eyes = { centers: [[-0.084, 0.58, 0.16], [0.083, 0.58, 0.16]], radii: [[0.048, 0.043], [0.048, 0.043]] };
    const plain = figurineMaterial({ map }, { eyes, eyeMode: EYE_MODES.open });
    const hlOpen = figurineMaterial({ map }, { eyes, eyeMode: EYE_MODES.open, highlight: true });
    const hlHurt = figurineMaterial({ map }, { eyes, eyeMode: EYE_MODES.hurt, highlight: true });
    expect(plain.emissive.getHex()).toBe(0);
    expect(plain.emissiveIntensity).toBe(0);
    expect(isNeutral(hlOpen.emissive)).toBe(true);
    expect(hlOpen.emissiveIntensity).toBe(SELECT_HIGHLIGHT.glow);
    const shPlain = fakeShader(plain);
    const shHl = fakeShader(hlHurt);
    expect(shPlain.fragmentShader).not.toContain(RIM_CODE);
    expect(shPlain.fragmentShader).not.toContain(LIFT_CODE);
    expect(shHl.fragmentShader).toContain(RIM_CODE);
    expect(shHl.fragmentShader).toContain(LIFT_CODE);
    // her own patches stay in both (tone curve, closed eyes)
    for (const sh of [shPlain, shHl]) {
      expect(sh.fragmentShader).toContain('figNeutral( gl_FragColor.rgb )');
      expect(sh.fragmentShader).toContain('figCloseEyes(');
    }
    expect(shHl.uniforms.figEyeMode.value).toBe(EYE_MODES.hurt);
    expect(hlOpen.customProgramCacheKey()).toBe(hlHurt.customProgramCacheKey());
    expect(hlOpen.customProgramCacheKey()).not.toBe(plain.customProgramCacheKey());
    expect(hlOpen.customProgramCacheKey()).toContain(SELECT_PROGRAM_KEY);
  });

  it('procedural chibi: swaps to the shared highlight and back; dispose leaves the shared one alone', () => {
    const g = buildChibi(getUnit('chika'), { quality: 'medium' });
    const body = g.getObjectByName('body');
    const plain = body.material;
    g.userData.setHighlight(true);
    expect(body.material).toBe(selectToonMaterial({ vertexColors: true }));
    g.userData.setHighlight(false);
    expect(body.material).toBe(plain);
    g.userData.setHighlight(true);
    const spy = vi.spyOn(body.material, 'dispose');
    disposeObject(g);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('GLB toon girl: body and face highlighted together, back to her own materials, shared one survives dispose', () => {
    const g = instantiateCharacter(fakeAsset(), getUnit('chika'), { quality: 'low' });
    const body = g.getObjectByName('body');
    const head = g.getObjectByName('head');
    const halo = g.getObjectByName('halo');
    const plainBody = body.material;
    const plainHead = head.material;
    const haloMat = halo.material;
    expect(plainBody).toBe(toonMaterial({ vertexColors: true }));
    g.userData.setHighlight(true);
    expect(body.material).toBe(selectToonMaterial({ vertexColors: true }));
    expect(head.material).not.toBe(plainHead);
    expect(head.material.map).toBe(plainHead.map);
    expect(isNeutral(head.material.emissive)).toBe(true);
    expect(halo.material).toBe(haloMat); // the unlit halo stays as it is
    const headHl = head.material;
    g.userData.setHighlight(false);
    expect(body.material).toBe(plainBody);
    expect(head.material).toBe(plainHead);
    g.userData.setHighlight(true);
    expect(head.material).toBe(headHl); // one twin per instance, made once
    const shared = vi.spyOn(body.material, 'dispose');
    const own = [vi.spyOn(headHl, 'dispose'), vi.spyOn(plainHead, 'dispose')];
    disposeObject(g);
    expect(shared).not.toHaveBeenCalled();
    for (const s of own) expect(s).toHaveBeenCalled();
    shared.mockRestore();
  });

  it('painted figurine instance: the highlight follows her eye states and comes off again', () => {
    const asset = fakeAsset({ textured: true });
    const g = instantiateCharacter(asset, getUnit('hikari'), { quality: 'low' });
    const body = g.getObjectByName('body');
    const plain = body.material;
    g.userData.setHighlight(true);
    const hl = body.material;
    expect(hl).toBe(asset.materials['hl|0']);
    expect(isNeutral(hl.emissive)).toBe(true);
    // a happy face (^ ^) while selected: still the highlight, now with closed eyes
    g.userData.setExpression('happy');
    g.userData.animate(0.1, 0.016, 'idle');
    expect(body.material).toBe(asset.materials[`hl|${EYE_MODES.happy}`]);
    expect(body.material.customProgramCacheKey()).toBe(hl.customProgramCacheKey());
    g.userData.setExpression(null);
    g.userData.animate(0.2, 0.016, 'idle');
    g.userData.setHighlight(false);
    expect(body.material).toBe(plain);
    disposeObject(g);
  });
});
