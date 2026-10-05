// Immediate-mode instanced quad batches. Every frame: begin(), push quads, end().
// 'billboard' quads face the camera (offsets in view space — exact for the orthographic
// battle camera); 'ground' quads lie flat on the XZ plane. One draw call per batch.
import * as THREE from 'three';

const VERT_BILLBOARD = /* glsl */`
attribute vec4 iPos;   // x y z rot
attribute vec4 iSize;  // w h offsetX offsetY (view units)
attribute vec4 iUv;    // u0 v0 u1 v1
attribute vec4 iCol;   // rgba
varying vec2 vUv;
varying vec4 vCol;
void main() {
  vec4 mv = modelViewMatrix * vec4(iPos.xyz, 1.0);
  vec2 p = position.xy * iSize.xy;
  float c = cos(iPos.w);
  float s = sin(iPos.w);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + iSize.zw;
  mv.xy += p;
  gl_Position = projectionMatrix * mv;
  vUv = mix(iUv.xy, iUv.zw, uv);
  vCol = iCol;
}`;

const VERT_GROUND = /* glsl */`
attribute vec4 iPos;
attribute vec4 iSize;
attribute vec4 iUv;
attribute vec4 iCol;
varying vec2 vUv;
varying vec4 vCol;
void main() {
  vec2 p = position.xy * iSize.xy;
  float c = cos(iPos.w);
  float s = sin(iPos.w);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + iSize.zw;
  vec3 wp = iPos.xyz + vec3(p.x, 0.0, -p.y);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(wp, 1.0);
  vUv = mix(iUv.xy, iUv.zw, uv);
  vCol = iCol;
}`;

const FRAG = /* glsl */`
uniform sampler2D map;
uniform float premul;
varying vec2 vUv;
varying vec4 vCol;
void main() {
  vec4 t = texture2D(map, vUv);
  vec4 c = t * vCol;
  if (c.a < 0.004) discard;
  gl_FragColor = vec4(c.rgb * mix(1.0, c.a, premul), c.a);
  #include <colorspace_fragment>
}`;

export class QuadBatch {
  /**
   * @param {{ texture: THREE.Texture, max?: number, mode?: 'billboard'|'ground',
   *   blending?: 'normal'|'additive', depthTest?: boolean, renderOrder?: number }} o
   */
  constructor({ texture, max = 2048, mode = 'billboard', blending = 'normal', depthTest = true, renderOrder = 10 }) {
    this.max = max;
    this.count = 0;
    const geo = new THREE.InstancedBufferGeometry();
    const plane = new THREE.PlaneGeometry(1, 1);
    geo.index = plane.index;
    geo.setAttribute('position', plane.attributes.position);
    geo.setAttribute('uv', plane.attributes.uv);
    this.pos = new Float32Array(max * 4);
    this.size = new Float32Array(max * 4);
    this.uv = new Float32Array(max * 4);
    this.col = new Float32Array(max * 4);
    this.aPos = new THREE.InstancedBufferAttribute(this.pos, 4).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.InstancedBufferAttribute(this.size, 4).setUsage(THREE.DynamicDrawUsage);
    this.aUv = new THREE.InstancedBufferAttribute(this.uv, 4).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.InstancedBufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iPos', this.aPos);
    geo.setAttribute('iSize', this.aSize);
    geo.setAttribute('iUv', this.aUv);
    geo.setAttribute('iCol', this.aCol);
    geo.instanceCount = 0;
    this.geometry = geo;
    const additive = blending === 'additive';
    this.material = new THREE.ShaderMaterial({
      uniforms: { map: { value: texture }, premul: { value: additive ? 1 : 0 } },
      vertexShader: mode === 'ground' ? VERT_GROUND : VERT_BILLBOARD,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      depthTest,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      toneMapped: false,
    });
    if (additive) {
      // premultiplied: src * 1 + dst * 1
      this.material.blending = THREE.CustomBlending;
      this.material.blendSrc = THREE.OneFactor;
      this.material.blendDst = THREE.OneFactor;
      this.material.blendEquation = THREE.AddEquation;
    }
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = renderOrder;
    this._col = new THREE.Color();
  }

  begin() {
    this.count = 0;
  }

  /**
   * Pushes one quad.
   * @param {number} x @param {number} y @param {number} z world centre
   * @param {number} w @param {number} h size (world units)
   * @param {number[]} uv atlas region [u0,v0,u1,v1]
   * @param {number} r @param {number} g @param {number} b @param {number} a colour (linear 0-1)
   * @param {number} [rot] rotation (radians, in view plane / around Y for ground)
   * @param {number} [ox] @param {number} [oy] offset after rotation (view units)
   * @returns {boolean} false when full
   */
  push(x, y, z, w, h, uv, r, g, b, a, rot = 0, ox = 0, oy = 0) {
    if (this.count >= this.max || a <= 0.003) return false;
    const i = this.count * 4;
    this.pos[i] = x;
    this.pos[i + 1] = y;
    this.pos[i + 2] = z;
    this.pos[i + 3] = rot;
    this.size[i] = w;
    this.size[i + 1] = h;
    this.size[i + 2] = ox;
    this.size[i + 3] = oy;
    this.uv[i] = uv[0];
    this.uv[i + 1] = uv[1];
    this.uv[i + 2] = uv[2];
    this.uv[i + 3] = uv[3];
    this.col[i] = r;
    this.col[i + 1] = g;
    this.col[i + 2] = b;
    this.col[i + 3] = a;
    this.count++;
    return true;
  }

  /** push() with a THREE.Color. */
  pushC(x, y, z, w, h, uv, color, a, rot = 0, ox = 0, oy = 0) {
    return this.push(x, y, z, w, h, uv, color.r, color.g, color.b, a, rot, ox, oy);
  }

  end() {
    const n = this.count;
    this.geometry.instanceCount = n;
    for (const attr of [this.aPos, this.aSize, this.aUv, this.aCol]) {
      attr.clearUpdateRanges();
      if (n > 0) attr.addUpdateRange(0, n * 4);
      attr.needsUpdate = n > 0;
    }
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
