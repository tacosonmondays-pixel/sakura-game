// Figurine shading of imported, painted figures (src/models/figurine.js): seam-welded outline
// normals, the CPU-built studio environment and the shader patches (which silently stop working
// if a three.js update renames the chunks they hook into).
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  addOutlineNormals, studioEnvironment, figurineMaterial, figurineOutlineMaterial, outlineBeforeRender, OUTLINE_MIN_PX,
} from '../../src/models/figurine.js';

function fakeShader(material) {
  const lib = material.isMeshStandardMaterial ? THREE.ShaderLib.standard : THREE.ShaderLib.basic;
  const shader = { uniforms: {}, vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader };
  material.onBeforeCompile(shader);
  return shader;
}

describe('figurine shading', () => {
  it('averages outline normals over UV-seam copies of a vertex and skips folded copies', () => {
    const geo = new THREE.BufferGeometry();
    // vertices 0/1 share a position (UV seam), 2 shares it too but faces the other way (fold)
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0], 3));
    const s = Math.SQRT1_2;
    geo.setAttribute('normal', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, -s, -s, 0, 0, 0, 1], 3));
    addOutlineNormals(geo);
    const on = geo.attributes.outlineNormal;
    expect(on.getX(0)).toBeCloseTo(s, 5);
    expect(on.getY(0)).toBeCloseTo(s, 5);
    expect(on.getX(1)).toBeCloseTo(s, 5);
    expect(on.getY(1)).toBeCloseTo(s, 5);
    // the folded copy keeps a valid (non-zero) normal of its own side
    expect(Math.hypot(on.getX(2), on.getY(2), on.getZ(2))).toBeCloseTo(1, 5);
    expect(on.getZ(3)).toBeCloseTo(1, 5);
  });

  it('builds one shared equirectangular studio environment without a renderer', () => {
    const env = studioEnvironment();
    expect(env).toBe(studioEnvironment());
    expect(env.mapping).toBe(THREE.EquirectangularReflectionMapping);
    const { data, width, height } = env.image;
    expect(data.length).toBe(width * height * 4);
    // brighter overhead than underfoot
    const row = (j) => data[(j * width + 4) * 4];
    expect(row(height - 1)).toBeGreaterThan(row(0));
  });

  it('patches her body shader: grey hemisphere bounce + her own neutral tone curve', () => {
    const map = new THREE.Texture();
    const m = figurineMaterial({ map, mrMap: new THREE.Texture(), normalMap: null });
    expect(m.envMap).toBe(studioEnvironment());
    expect(m.metalness).toBe(1);
    const sh = fakeShader(m);
    expect(sh.fragmentShader).toContain('figHemi( getHemisphereLightIrradiance');
    expect(sh.fragmentShader).toContain('figNeutral( gl_FragColor.rgb )');
    expect(sh.uniforms.figExposure.value).toBeGreaterThan(0.5);
    const plain = figurineMaterial({ map });
    expect(plain.metalness).toBe(0);
  });

  it('outline hull: welded normals, pixel floor and depth push, shared per texture and height', () => {
    const map = new THREE.Texture();
    const a = figurineOutlineMaterial(map, 0.85);
    expect(figurineOutlineMaterial(map, 0.85)).toBe(a);
    expect(a.side).toBe(THREE.BackSide);
    expect(a.map).toBe(map);
    const sh = fakeShader(a);
    expect(sh.vertexShader).toContain('normalize( outlineNormal ) * olW');
    expect(sh.vertexShader).toContain('gl_Position.z = olP.z');
    expect(sh.uniforms.outlineWidth.value).toBeCloseTo(0.0094 * 0.85, 6);
    // per draw: viewport height + pixel ratio feed the on-screen minimum width
    const renderer = { getCurrentViewport: (v) => v.set(0, 0, 1688, 780), getPixelRatio: () => 2 };
    outlineBeforeRender(renderer, null, null, null, a);
    expect(a.userData.uniforms.outlineViewH.value).toBe(780);
    expect(a.userData.uniforms.outlineMinPx.value).toBeCloseTo(OUTLINE_MIN_PX * 2, 6);
  });
});
