// Shared stage for the VFX lab pages (dev only; nothing in src/ imports this file and the game build has no previews/
// input). A small battle-like patch: a fixture board on one of our own map looks (the real terrain painter, road
// ribbon and ground textures from src/render/terrain.js), the battle's lights, its angled orthographic camera
// (src/render/camera.js: portrait turns the board 90° like the battle), the sprite batches and atlas the effects push
// into, and on high the battle's chain (scene → bloom → grade). A real chibi can stand on it for scale.
//
// Every frame is stepped by hand (`step(dt, fn)`), never by requestAnimationFrame, so a lab still is the same picture
// on every run: same board, same seeds, same 1/60 s steps.
//
//   const stage = await createLabStage({ canvas, width: 844, height: 390, quality: 'high', girl: 'nami' });
//   stage.step(1 / 60, () => fx.update(1 / 60));   // batches begun before fn, ended after it
//   stage.render();
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { LINE } from '../src/core/track.js';
import { defineMap } from '../src/data/maps.js';
import { UNIT_MAP } from '../src/data/units.js';
import { CameraRig } from '../src/render/camera.js';
import { buildTerrain, resolveScenery } from '../src/render/terrain.js';
import { resolveLook } from '../src/render/themes.js';
import { createAtlas } from '../src/render/textures.js';
import { QuadBatch } from '../src/render/batch.js';
import { ATTACK_SPRITES } from '../src/render/attackFx/sprites.js';
import { GradePass, gradeFor } from '../src/render/vfx/grade.js';
import { preloadModels, buildChibi } from '../src/models/index.js';

const L = LINE;

/**
 * The lab patch (12 × 7 tiles, never in MAPS or STAGES): a road along the middle, a pond in one corner, a tree at the
 * edge. Its id seeds the painter, so the ground is the same picture every run.
 */
export function labBoard(theme = 'lake') {
  return defineMap({
    id: `fixture_vfx_lab_${theme}`,
    name: 'VFX Lab Patch',
    theme,
    tier: 'beginner',
    rows: [
      '............',
      '..........T.',
      '............',
      '............',
      '............',
      '.........~~.',
      '........~~~.',
    ],
    paths: [[[-1, 3.5], L, [13, 3.5]]],
    crossings: 'flat',
    decor: [],
    desc: 'VFX lab fixture (previews only).',
    concept: 'fixture vfx lab',
  });
}

// the battle's bloom on a day board and its over-white boost of the additive batches (src/render/BattleRenderer.js
// BLOOM.day, HDR_ADD, HDR_GROUND): copied, so the lab's high tier draws what the battle's does
const BLOOM_DAY = { strength: 0.5, radius: 0.5, threshold: 0.96, knee: 0.4 };
const HDR_ADD = 1.7;
const HDR_GROUND = 0.9;

/**
 * @param {{ canvas: HTMLCanvasElement, width: number, height: number, quality?: 'high'|'medium'|'low', theme?: string,
 *   girl?: string|null, girlAt?: [number, number], bloom?: boolean, zoom?: number, focus?: [number, number]|null }} o
 */
export async function createLabStage({ canvas, width, height, quality = 'high', theme = 'lake', girl = null, girlAt = [6.9, 2.35], bloom = quality === 'high', zoom = 1, focus = null }) {
  const map = labBoard(theme);
  const scenery = resolveScenery({}, () => null);
  const look = resolveLook(map.theme, scenery, null, map);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.info.autoReset = false;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(look.bg);
  const rig = new CameraRig(map);
  rig.setViewport(width, height, { top: 0, right: 0, bottom: 0, left: 0 });
  if (zoom > 1 && focus) {
    // a close-up round a board point (dev only; the board stills use the fitted framing)
    const p = new THREE.Vector3(focus[0], 0, focus[1]).project(rig.camera);
    rig.zoomAt(zoom, ((p.x + 1) / 2) * width, ((1 - p.y) / 2) * height);
  }
  rig.apply(0);
  const camera = rig.camera;

  // the battle's lights (BattleRenderer: hemisphere, key, fill)
  const hemi = new THREE.HemisphereLight(look.light.sky, look.light.ground, look.light.hemi);
  const key = new THREE.DirectionalLight(look.light.key, look.light.keyI);
  const fill = new THREE.DirectionalLight(look.light.fill, look.light.fillI);
  key.target.position.set(map.width / 2, 0, map.height / 2);
  const cx = map.width / 2;
  const cz = map.height / 2;
  const yaw = rig.yaw;
  key.position.set(cx - 6 * Math.cos(yaw) + 7 * Math.sin(yaw), look.light.keyY ?? 12, cz + 6 * Math.sin(yaw) + 7 * Math.cos(yaw));
  fill.position.set(cx + 6 * Math.cos(yaw) - 7 * Math.sin(yaw), 6, cz - 6 * Math.sin(yaw) - 7 * Math.cos(yaw));
  scene.add(hemi, key, key.target, fill);

  const terrain = buildTerrain(map, look, scenery, { quality, shadows: false });
  scene.add(terrain.group);
  terrain.update(1.25);

  const atlas = createAtlas(ATTACK_SPRITES);
  const batches = {
    groundN: new QuadBatch({ texture: atlas.texture, max: 3000, mode: 'ground', renderOrder: 2 }),
    groundA: new QuadBatch({ texture: atlas.texture, max: 1500, mode: 'ground', blending: 'additive', renderOrder: 3 }),
    bbN: new QuadBatch({ texture: atlas.texture, max: 3000, renderOrder: 20 }),
    bbA: new QuadBatch({ texture: atlas.texture, max: 4000, blending: 'additive', renderOrder: 21 }),
  };
  for (const b of Object.values(batches)) scene.add(b.mesh);

  let figure = null;
  if (girl && UNIT_MAP[girl]) {
    try {
      await preloadModels([girl], { detail: quality === 'high' ? 'full' : 'lod' });
    } catch {
      // (offline: the procedural chibi stands in)
    }
    figure = buildChibi(UNIT_MAP[girl], { quality });
    figure.position.set(girlAt[0], 0, girlAt[1]);
    figure.rotation.y = 0.35;
    scene.add(figure);
    figure.userData.animate?.(1.0, 0, 'idle');
  }

  let composer = null;
  if (quality === 'high' && bloom) {
    const rt = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    const bp = new UnrealBloomPass(new THREE.Vector2(width, height), BLOOM_DAY.strength, BLOOM_DAY.radius, BLOOM_DAY.threshold);
    bp.highPassUniforms.smoothWidth.value = BLOOM_DAY.knee;
    composer.addPass(bp);
    composer.addPass(new GradePass(gradeFor(look)));
  }
  batches.bbA.setHdr(composer ? HDR_ADD : 0);
  batches.groundA.setHdr(composer ? HDR_GROUND : 0);

  const list = Object.values(batches);
  return {
    renderer, scene, camera, rig, map, look, atlas, batches, figure, quality, glow: !!composer,
    /** One visual step: the batches are begun before `fn` and ended after it (as the battle frames them). */
    step(dt, fn) {
      for (const b of list) b.begin();
      fn?.(dt);
      for (const b of list) b.end();
    },
    render() {
      renderer.info.reset();
      if (composer) composer.render(1 / 60);
      else renderer.render(scene, camera);
      return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
    },
    /** Draw calls of the scene alone, one plain render (no composer passes): the effect's own calls are what it adds. */
    calls() {
      renderer.info.reset();
      renderer.render(scene, camera);
      return renderer.info.render.calls;
    },
    /** Screen px of a board point (the lab's labels and the board's crops). */
    toScreen(x, y, z) {
      const p = new THREE.Vector3(x, y, z).project(camera);
      return [((p.x + 1) / 2) * width, ((1 - p.y) / 2) * height];
    },
  };
}
