// The look of a selected (tapped) girl in battle: she keeps her own colours. Her own colour is
// lifted a little (a self-lit term of her own albedo, so hue and saturation stay as painted) and
// a soft white rim light runs along her silhouette. The selection ring under her says which girl
// is selected; this only makes her stand out a touch.
//
// One look for all three kinds of girl: the procedural chibis (chibi.js), the Blender GLB girls
// (glbChibi.js, toon) and the painted figurines (figurine.js, PBR). Replaces the blue emissive
// wash ('#4d6dff' × 0.35) that turned Chika's brown hair and orange suit purple / lavender.
import * as THREE from 'three';
import { gradientMap } from './toon.js';

export const SELECT_HIGHLIGHT = Object.freeze({
  /** The material's emissive: neutral white (the shader multiplies it by her own colour). */
  emissive: '#ffffff',
  /** emissiveIntensity: she gains `glow` × her own albedo as light of her own (≈ +15 % brighter). */
  glow: 0.15,
  /**
   * Rim light along her silhouette: colour, strength, and where it starts: it fades in from
   * 1 − N·V = rimStart (N·V < 0.4) to full strength at the silhouette, so the steep battle camera
   * (48° pitch: her front and top face it at N·V ≈ 0.67-0.74) leaves her body untouched.
   */
  rimColor: '#ffffff',
  rim: 0.35,
  rimStart: 0.6,
});

// shared by every highlight material (one place to tune, no per-material copies)
const uniforms = {
  selRimColor: { value: new THREE.Color(SELECT_HIGHLIGHT.rimColor) },
  selRim: { value: SELECT_HIGHLIGHT.rim },
  selRimStart: { value: SELECT_HIGHLIGHT.rimStart },
};

/** GLSL inserted after <emissivemap_fragment>: emissive × her colour + the rim. */
export const SELECT_FRAGMENT = /* glsl */ `
	// selection highlight: her own colour a little brighter (hue kept) + a soft light rim
	totalEmissiveRadiance *= diffuseColor.rgb;
	{
		vec3 selView = isOrthographic ? vec3( 0.0, 0.0, 1.0 ) : normalize( vViewPosition );
		float selEdge = smoothstep( selRimStart, 1.0, 1.0 - saturate( dot( normal, selView ) ) );
		totalEmissiveRadiance += selRimColor * ( selRim * selEdge );
	}`;

/** Program cache key part of the highlight patch (every highlight material runs the same code). */
export const SELECT_PROGRAM_KEY = 'select-hl';

/**
 * Patches a lit material's shader (inside onBeforeCompile) with the selection highlight. The
 * material itself carries emissive SELECT_HIGHLIGHT.emissive × glow.
 */
export function patchSelectShader(shader) {
  Object.assign(shader.uniforms, uniforms);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform vec3 selRimColor;\nuniform float selRim;\nuniform float selRimStart;')
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>${SELECT_FRAGMENT}`);
}

/** Gives a (non-shared) lit material the selection look in place; returns it. */
export function applySelectHighlight(m) {
  m.emissive.set(SELECT_HIGHLIGHT.emissive);
  m.emissiveIntensity = SELECT_HIGHLIGHT.glow;
  m.onBeforeCompile = patchSelectShader;
  m.customProgramCacheKey = () => SELECT_PROGRAM_KEY;
  m.userData.selectHighlight = true;
  return m;
}

/**
 * A highlighted copy of a per-instance lit material (a GLB girl's face): same maps, the selection
 * look. Not shared: the instance that made it disposes it.
 */
export function selectTwin(material) {
  return applySelectHighlight(material.clone());
}

const toonCache = new Map();

/**
 * The selected look of the shared vertex-colour toon body (procedural chibis, GLB girls).
 * Cached and shared (userData.shared): never dispose it.
 */
export function selectToonMaterial({ vertexColors = true } = {}) {
  const key = String(!!vertexColors);
  let m = toonCache.get(key);
  if (!m) {
    m = applySelectHighlight(new THREE.MeshToonMaterial({ color: '#ffffff', vertexColors: !!vertexColors, gradientMap: gradientMap(3) }));
    m.userData.shared = true;
    toonCache.set(key, m);
  }
  return m;
}
