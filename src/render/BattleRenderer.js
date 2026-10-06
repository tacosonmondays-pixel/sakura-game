// Battle renderer (CONTRACTS.md §9). Draws a running Sim with three.js: themed terrain,
// chibi girls, monsters, projectiles and effects, under an angled orthographic camera with
// touch-friendly pan / pinch / double-tap-reset controls.
//
//   const r = createBattleRenderer(containerEl, sim, { quality, settings, insets });
//   r.update(dt)  // every frame AFTER sim.update; consumes and returns sim.drainEvents()
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CameraRig } from './camera.js';
import { createAtlas } from './textures.js';
import { QuadBatch } from './batch.js';
import { FxSystem } from './fx.js';
import { AmbientSystem } from './ambient.js';
import { Actors, PATH_COLORS } from './actors.js';
import { Overlays } from './overlays.js';
import { buildTerrain, resolveScenery, PATH_H } from './terrain.js';
import { resolveLook, fxColor } from './themes.js';
import { clearPropCache } from './props.js';

const QUALITY = {
  high: { pixelRatio: 2, shadows: true, bloom: true },
  medium: { pixelRatio: 1.5, shadows: false, bloom: false },
  low: { pixelRatio: 1, shadows: false, bloom: false },
};
const ULT_COLORS = { nova: '#fff3b0', timeWarp: '#c9a8ff', tide: '#8fe8ff' };
const STATUS_FX = {
  freeze: '#bff0ff', burn: '#ff8a4a', poison: '#7be08a', shock: '#ffe45c', stun: '#ffd84d',
  silence: '#c4a6ff', reveal: '#ffe066', shred: '#d0d6e2', mark: '#ff6b8b', vulnerable: '#9fd8ff', slow: '#8fe3ff', soak: '#4cc9f0',
};
const MAX_NUMBERS_PER_FRAME = 14;
const MAX_HIT_FX_PER_FRAME = 40;

let liveRenderers = 0;

/**
 * Creates the battle renderer.
 * @param {HTMLElement} container element the canvas fills (should have a size)
 * @param {import('../sim/Sim.js').Sim} sim running simulation
 * @param {{ quality?: 'high'|'medium'|'low', settings?: object, insets?: {top,right,bottom,left} }} [opts]
 */
export function createBattleRenderer(container, sim, opts = {}) {
  liveRenderers++;
  const settings = opts.settings || {};
  let quality = QUALITY[opts.quality] ? opts.quality : (QUALITY[settings.quality] ? settings.quality : 'medium');
  const reduceMotion = !!settings.reduceMotion;

  // ----- renderer -----------------------------------------------------------------------
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.info.autoReset = false; // the composer renders several passes per frame
  const canvas = renderer.domElement;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.touchAction = 'none';
  canvas.style.userSelect = 'none';
  canvas.style.webkitUserSelect = 'none';
  canvas.style.webkitTapHighlightColor = 'transparent';
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  container.appendChild(canvas);

  // DOM layer for screen flashes / boss vignette (pointer-events: none)
  const fxLayer = document.createElement('div');
  fxLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;';
  const flashEl = document.createElement('div');
  flashEl.style.cssText = 'position:absolute;inset:0;opacity:0;mix-blend-mode:screen;';
  const vignetteEl = document.createElement('div');
  vignetteEl.style.cssText = 'position:absolute;inset:0;opacity:0;background:radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(220,30,70,0.55) 100%);';
  const shadeEl = document.createElement('div');
  shadeEl.style.cssText = 'position:absolute;inset:0;background:radial-gradient(ellipse 75% 70% at 50% 50%, rgba(0,0,0,0) 60%, rgba(10,16,40,0.28) 100%);';
  fxLayer.append(shadeEl, vignetteEl, flashEl);
  container.appendChild(fxLayer);

  // ----- scene + look ---------------------------------------------------------------------
  const map = sim.map;
  const stage = sim.stage || null;
  const familyOf = (id) => {
    try {
      return sim.data?.enemy?.(id)?.family || null;
    } catch {
      return null;
    }
  };
  const scenery = resolveScenery(stage, familyOf);
  const look = resolveLook(map.theme, scenery);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(look.fog ? mixHex(look.bg, look.fogColor, 0.4) : look.bg);

  const rig = new CameraRig(map);
  const camera = rig.camera;

  if (look.fog) scene.fog = new THREE.Fog(look.fogColor, rig.dist - 1, rig.dist + 40);

  // lights
  const hemi = new THREE.HemisphereLight(look.light.sky, look.light.ground, look.light.hemi);
  const key = new THREE.DirectionalLight(look.light.key, look.light.keyI);
  const fill = new THREE.DirectionalLight(look.light.fill, look.light.fillI);
  key.target.position.set(map.width / 2, 0, map.height / 2);
  scene.add(hemi, key, key.target, fill);
  const baseLight = { hemi: look.light.hemi, key: look.light.keyI, fill: look.light.fillI, keyColor: new THREE.Color(look.light.key) };
  const placeLights = () => {
    const cx = map.width / 2;
    const cz = map.height / 2;
    const yaw = rig.yaw;
    const ox = -6;
    const oz = 7;
    key.position.set(cx + ox * Math.cos(yaw) + oz * Math.sin(yaw), 12, cz - ox * Math.sin(yaw) + oz * Math.cos(yaw));
    fill.position.set(cx - (ox * Math.cos(yaw) + oz * Math.sin(yaw)), 6, cz + ox * Math.sin(yaw) - oz * Math.cos(yaw));
    const r = Math.hypot(map.width, map.height) / 2 + 2;
    const sc = key.shadow.camera;
    sc.left = -r;
    sc.right = r;
    sc.top = r;
    sc.bottom = -r;
    sc.near = 1;
    sc.far = 40;
    sc.updateProjectionMatrix();
  };
  key.shadow.bias = -0.0008;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 3;

  // ----- batches + systems ------------------------------------------------------------
  const atlas = createAtlas();
  const batches = {
    groundN: new QuadBatch({ texture: atlas.texture, max: 3000, mode: 'ground', renderOrder: 2 }),
    groundA: new QuadBatch({ texture: atlas.texture, max: 1500, mode: 'ground', blending: 'additive', renderOrder: 3 }),
    bbN: new QuadBatch({ texture: atlas.texture, max: 3000, renderOrder: 20 }),
    bbA: new QuadBatch({ texture: atlas.texture, max: 4000, blending: 'additive', renderOrder: 21 }),
    overlay: new QuadBatch({ texture: atlas.texture, max: 5000, depthTest: false, renderOrder: 30 }),
  };
  for (const b of Object.values(batches)) scene.add(b.mesh);

  let shadowsOn = false;
  const terrain = buildTerrain(map, look, scenery, { shadows: false, quality });
  scene.add(terrain.group);
  const fx = new FxSystem({ atlas, batches, camera });
  const ambient = new AmbientSystem({ map, look, terrain, fx, batches, atlas });
  const actors = new Actors({ sim, scene, fx, batches, atlas, quality, terrain });
  const overlays = new Overlays({ sim, scene, actors, terrain, batches, atlas, quality });

  // ----- post-processing -------------------------------------------------------------------
  let composer = null;
  let bloomPass = null;
  const setupComposer = (on) => {
    if (composer) {
      composer.dispose();
      bloomPass?.dispose();
      composer = null;
      bloomPass = null;
    }
    if (!on) return;
    const size = renderer.getSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x * renderer.getPixelRatio(), size.y * renderer.getPixelRatio(), { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), look.night ? 0.55 : 0.3, 0.42, look.night ? 0.84 : 0.95);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
  };

  // ----- state -----------------------------------------------------------------------------
  let time = 0;
  let insets = { top: 0, right: 0, bottom: 0, left: 0, ...(opts.insets || {}) };
  let flash = { a: 0, decay: 3 };
  let bossVignette = 0;
  let waveGlow = 1;
  let disposed = false;
  const tapCbs = [];
  const longCbs = [];
  let lighting = { exposure: 1, warmth: 0, ...(settings.lighting || {}) };

  function applyQuality(q) {
    quality = q;
    const preset = QUALITY[q];
    const dpr = window.devicePixelRatio || 1;
    renderer.setPixelRatio(Math.min(dpr, preset.pixelRatio));
    const wantShadows = q === 'low' ? false : (typeof settings.shadows === 'boolean' ? settings.shadows && q === 'high' : preset.shadows);
    shadowsOn = wantShadows;
    renderer.shadowMap.enabled = wantShadows;
    key.castShadow = wantShadows;
    if (wantShadows) {
      key.shadow.mapSize.set(2048, 2048);
      key.shadow.map?.dispose();
      key.shadow.map = null;
    }
    terrain.setShadows(wantShadows);
    actors.setShadows(wantShadows);
    scene.traverse((o) => {
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) m.needsUpdate = true;
      }
    });
    const wantBloom = q === 'high' && (typeof settings.bloom === 'boolean' ? settings.bloom : preset.bloom);
    fx.setQuality(q);
    ambient.setQuality(q);
    actors.setQuality(q);
    overlays.setQuality(q);
    resize();
    setupComposer(wantBloom);
  }

  function applyLighting() {
    const ex = THREE.MathUtils.clamp(lighting.exposure ?? 1, 0.4, 1.8);
    const w = THREE.MathUtils.clamp(lighting.warmth ?? 0, -1, 1);
    hemi.intensity = baseLight.hemi * ex;
    key.intensity = baseLight.key * ex;
    fill.intensity = baseLight.fill * ex;
    key.color.copy(baseLight.keyColor).lerp(new THREE.Color(w >= 0 ? '#ffc890' : '#b8d0ff'), Math.abs(w) * 0.45);
  }

  function resize() {
    if (disposed) return;
    const w = Math.max(1, container.clientWidth || canvas.clientWidth || 1);
    const h = Math.max(1, container.clientHeight || canvas.clientHeight || 1);
    renderer.setSize(w, h, false);
    rig.setViewport(w, h, insets);
    placeLights();
    if (composer) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
    }
  }

  // ----- events → effects -------------------------------------------------------------
  function towerColor(uid) {
    const t = sim.getTower ? sim.getTower(uid) : sim.towers.find((x) => x.uid === uid);
    const s = t?.eff || t?.stats || t?.def?.base || {};
    return fxColor(s.element ?? t?.def?.element, s.attackType ?? t?.def?.attackType, '#ffffff');
  }

  function screenFlash(color, strength = 0.75, decay = 2.5) {
    if (reduceMotion) strength *= 0.35;
    flashEl.style.background = `radial-gradient(ellipse at center, ${color} 0%, ${color}cc 45%, ${color}55 100%)`;
    flash = { a: Math.max(flash.a, strength), decay };
  }

  function shake(a) {
    if (!reduceMotion) rig.shake(a);
  }

  function fmt(n) {
    if (n >= 100000) return `${Math.round(n / 1000)}K`;
    if (n >= 10000) return `${(n / 1000).toFixed(1).replace('.0', '')}K`;
    return String(Math.max(1, Math.round(n)));
  }

  function handleEvents(events) {
    let numbers = 0;
    let hitFx = 0;
    for (const ev of events) {
      switch (ev.type) {
        case 'hit': {
          actors.hitFlash(ev.uid);
          if (hitFx++ > MAX_HIT_FX_PER_FRAME) break;
          const p = actors.enemyPos(ev.uid);
          const x = p ? p.x : ev.x;
          const z = p ? p.z : ev.y;
          const y = p ? p.y + p.height * 0.55 : 0.35;
          const col = fxColor(null, ev.attackType, '#ffffff');
          fx.hit(x, y, z, col, { crit: ev.crit, strong: ev.effective > 1 });
          if (fx.numbers && numbers < MAX_NUMBERS_PER_FRAME && ev.amount >= 1) {
            numbers++;
            const eff = ev.effective ?? 1;
            let color = '#ffffff';
            let size = 0.17;
            if (ev.crit) { color = '#ff9a3d'; size = 0.25; }
            else if (eff > 1) { color = col; size = 0.2; }
            else if (eff < 1) { color = '#aab3c5'; size = 0.14; }
            fx.text(ev.crit ? `${fmt(ev.amount)}!` : fmt(ev.amount), x, y + 0.25, z, color, size, 0.65, 0.45);
          }
          break;
        }
        case 'attack': {
          const v = actors.towerView(ev.towerUid);
          if (ev.kind !== 'bullet' || !ev.turretUid) actors.playAttack(ev.towerUid);
          if (!v) break;
          const m = v.model.position;
          if (ev.kind === 'slash') {
            const p = actors.enemyPos(ev.targetUid);
            if (p) {
              const ramp = ev.ramp || 0;
              const col = towerColor(ev.towerUid);
              fx.slash(p.x, p.z, (Math.random() - 0.5) * 1.4, col, 0.8 + Math.min(0.6, ramp * 0.05));
              if (ramp >= 6) fx.flash(p.x, p.y + 0.4, p.z, col, 0.5, 0.12);
            }
          } else if (ev.kind === 'trap' || ev.kind === 'build') {
            fx.sparkle(m.x, m.z, '#ffd84d', { count: 5, height: 0.6, ring: false });
          } else if (ev.kind !== 'pulse' && ev.kind !== 'beam' && ev.kind !== 'chain') {
            // muzzle flash toward facing
            const f = v.facing;
            fx.flash(m.x + Math.sin(f) * 0.3, m.y + 0.5, m.z + Math.cos(f) * 0.3, towerColor(ev.towerUid), 0.35, 0.09);
          }
          break;
        }
        case 'explode':
          fx.explosion(ev.x, ev.y, ev.radius, ev.volatile ? '#ff5a4a' : fxColor(ev.element, ev.attackType || 'blast'), { volatile: ev.volatile });
          if (ev.radius >= 1.4) shake(0.035 + Math.min(0.05, ev.radius * 0.012));
          break;
        case 'pulse':
          fx.pulse(ev.x, ev.y, ev.radius, fxColor(ev.element, ev.attackType));
          break;
        case 'beam':
          fx.beam(ev.from, ev.to, ev.width || 0.15, ev.color || '#ffffff');
          break;
        case 'chain':
          fx.chain(ev.points || [], fxColor(ev.element || 'lightning', 'mystic'));
          break;
        case 'death': {
          const p = actors.enemyPos(ev.uid) || { x: ev.x, y: 0, z: ev.y, size: 1, color: '#ffffff' };
          fx.death(p.x, p.y, p.z, p.size, p.color);
          if (ev.bounty > 0) fx.coin(p.x, p.y, p.z, ev.bounty);
          break;
        }
        case 'leak': {
          const p = actors.enemyPos(ev.uid);
          if (p) {
            fx.flash(p.x, 0.4, p.z, '#ff4d6d', 1.2, 0.35);
            fx.ring(p.x, p.z, 0.2, 1.1, 0.45, '#ff4d6d');
            if (fx.numbers) fx.text(`-${ev.lives}`, p.x, 0.9, p.z, '#ff4d6d', 0.26, 1, 0.6);
          }
          if (ev.lives >= 5) {
            shake(0.06);
            screenFlash('#ff4d6d', 0.35, 3);
          }
          break;
        }
        case 'spawn': {
          const def = sim.data?.enemy?.(ev.id);
          if (def && (def.tier === 'boss' || def.tier === 'miniboss')) {
            shake(def.tier === 'boss' ? 0.12 : 0.07);
            fx.ring(ev.x, ev.y, 0.3, 2.4, 0.8, '#ff4d6d');
            fx.puff(ev.x, 0.3, ev.y, '#5a3a5a', 12, 0.8, 0.8);
            bossVignette = Math.max(bossVignette, 1.2);
          }
          break;
        }
        case 'bossPhase': {
          const p = actors.enemyPos(ev.uid);
          if (p) {
            fx.ring(p.x, p.z, 0.4, 3.2, 0.7, '#ff4d6d');
            fx.flash(p.x, p.y + 0.8, p.z, '#ffd0d8', 2.2, 0.35);
          }
          shake(0.1);
          screenFlash('#ff6b8b', 0.4, 2.2);
          bossVignette = 1.4;
          break;
        }
        case 'status': {
          const p = actors.enemyPos(ev.uid);
          const col = STATUS_FX[ev.status];
          if (!p || !col) break;
          const y = p.y + p.height * 0.6;
          if (ev.status === 'freeze') fx.shards(p.x, y, p.z, col, 5);
          else if (ev.status === 'reveal' || ev.status === 'silence' || ev.status === 'mark') fx.ring(p.x, p.z, 0.1, 0.55, 0.35, col);
          else fx.flash(p.x, y, p.z, col, 0.45, 0.2);
          break;
        }
        case 'blink': {
          fx.puff(ev.fromX, 0.3, ev.fromY, '#b48cff', 6, 0.3, 0.35);
          fx.flash(ev.x, 0.4, ev.y, '#c9a8ff', 0.9, 0.25);
          fx.ring(ev.x, ev.y, 0.1, 0.7, 0.35, '#b48cff');
          actors.teleports.delete(ev.uid);
          break;
        }
        case 'teleportWarn':
          actors.teleports.set(ev.uid, { x: ev.x, y: ev.y, t: 0 });
          break;
        case 'blinkInterrupted': {
          const w = actors.teleports.get(ev.uid);
          if (w) fx.shards(w.x, 0.3, w.y, '#c9a8ff', 5);
          actors.teleports.delete(ev.uid);
          break;
        }
        case 'split': {
          const p = actors.enemyPos(ev.uid);
          if (p) fx.puff(p.x, 0.2, p.z, p.color, 5, 0.3, 0.3);
          break;
        }
        case 'phase': {
          const p = actors.enemyPos(ev.uid);
          if (p) fx.ring(p.x, p.z, 0.2, 0.9, 0.4, ev.on ? '#9fb4ff' : '#ffe066');
          break;
        }
        case 'barrierBreak': {
          const p = actors.enemyPos(ev.uid);
          if (p) {
            fx.shards(p.x, p.y + p.height * 0.5, p.z, '#9ec5ff', 10);
            fx.flash(p.x, p.y + p.height * 0.5, p.z, '#bfe0ff', 1.1, 0.2);
          }
          break;
        }
        case 'shellBreak': {
          const p = actors.enemyPos(ev.uid);
          if (p) fx.shards(p.x, p.y + p.height * 0.5, p.z, '#bff6ff', 12);
          break;
        }
        case 'sabotage': {
          const v = actors.towerView(ev.towerUid);
          if (v) {
            const m = v.model.position;
            fx.shards(m.x, 0.6, m.z, '#ffcc33', 6);
            fx.puff(m.x, 0.5, m.z, '#4a4a55', 5, 0.3, 0.35);
          }
          break;
        }
        case 'trapPlaced':
          fx.ring(ev.x, ev.y, 0.05, 0.45, 0.3, '#ffb347');
          break;
        case 'trapTriggered':
          fx.flash(ev.x, 0.2, ev.y, '#ffb347', 0.9, 0.18);
          fx.ring(ev.x, ev.y, 0.1, 0.9, 0.3, '#ffb347');
          break;
        case 'place': {
          const t = sim.getTower ? sim.getTower(ev.towerUid) : null;
          const x = t ? t.x : (ev.tx ?? 0) + 0.5;
          const z = t ? t.y : (ev.ty ?? 0) + 0.5;
          fx.puff(x, 0.1, z, '#ffffff', 6, 0.5, 0.35);
          fx.ring(x, z, 0.15, 0.75, 0.4, '#ffffff', { additive: false, uv: 'ring', a0: 0.8 });
          overlays.refreshHints();
          break;
        }
        case 'upgrade': {
          const t = sim.getTower ? sim.getTower(ev.towerUid) : null;
          if (!t) break;
          const col = PATH_COLORS[ev.path] || '#ffd84d';
          fx.sparkle(t.x, t.y, col, { count: 10 + ev.tier * 4, height: 0.8 + ev.tier * 0.2 });
          if (ev.tier >= 3) fx.flash(t.x, 0.6, t.y, col, 1.4 + ev.tier * 0.2, 0.3);
          if (ev.tier >= 5) {
            shake(0.05);
            screenFlash(col, 0.25, 3);
          }
          break;
        }
        case 'sell': {
          const v = actors.towerView(ev.towerUid);
          if (v) {
            const m = v.model.position;
            fx.puff(m.x, 0.3, m.z, '#ffffff', 6, 0.4, 0.35);
            fx.coin(m.x, 0.2, m.z, ev.refund);
          }
          overlays.refreshHints();
          break;
        }
        case 'heroLevel': {
          const v = actors.towerView(ev.towerUid ?? sim.hero?.uid);
          if (v) {
            const m = v.model.position;
            fx.sparkle(m.x, m.z, '#ffd84d', { count: 16, height: 1.2 });
            fx.text(`LV${ev.level}`, m.x, 1.2, m.z, '#ffd84d', 0.24, 1.2, 0.5);
          }
          break;
        }
        case 'ult': {
          const col = ULT_COLORS[ev.effect] || '#ffffff';
          screenFlash(col, 0.85, 1.8);
          shake(0.09);
          const x = ev.x ?? map.width / 2;
          const z = ev.y ?? map.height / 2;
          fx.ring(x, z, 0.3, Math.max(map.width, map.height) * 0.7, 1.1, col);
          fx.ring(x, z, 0.2, 3, 0.6, '#ffffff');
          fx.sparkle(x, z, col, { count: 30, height: 2 });
          let n = 0;
          for (const e of sim.enemies) {
            if (n++ > 30) break;
            const p = actors.enemyPos(e.uid);
            if (!p) continue;
            if (ev.effect === 'tide') fx.puff(p.x, 0.2, p.z, '#bff0ff', 3, 0.3, 0.3);
            else fx.flash(p.x, p.y + 0.6, p.z, col, 1.2, 0.5);
          }
          break;
        }
        case 'waveStart':
          waveGlow = 2.2;
          break;
        case 'won': {
          actors.victory = true;
          const cols = ['#ff6b8b', '#ffd43b', '#4cc9f0', '#b197fc', '#7bd389', '#ffffff'];
          for (let i = 0; i < 160; i++) {
            fx.spawn({
              batch: 'bbN', uv: atlas.regions.petal, x: Math.random() * map.width, y: 3 + Math.random() * 2, z: Math.random() * map.height,
              vx: (Math.random() - 0.5) * 0.6, vy: -0.7 - Math.random() * 0.6, s0: 0.14, s1: 0.12, life: 4 + Math.random() * 2,
              color: cols[i % cols.length], a0: 1, a1: 0.6, rot: Math.random() * 6, vrot: (Math.random() - 0.5) * 6,
            });
          }
          screenFlash('#fff3b0', 0.4, 1.5);
          break;
        }
        case 'lost':
          screenFlash('#5a5f78', 0.5, 0.8);
          break;
        default:
          break;
      }
    }
  }

  // ----- entrance / exit arrows ---------------------------------------------------------
  function drawGates() {
    if (ambient.drawsGates) return; // terrain-v2: the ambient layer draws gate arches, arrows and discs
    const R = atlas.regions;
    const gN = batches.groundN;
    const gA = batches.groundA;
    const prep = sim.state === 'prep' || sim.state === 'between';
    const boost = Math.min(1.6, (prep ? 1.25 : 0.8) * (waveGlow > 1 ? waveGlow : 1));
    const draw = (gate, color, outward) => {
      const [dx, dz] = gate.dir;
      const cx = gate.tx + 0.5;
      const cz = gate.ty + 0.5;
      const rot = Math.atan2(-dz, dx);
      for (let k = 0; k < 3; k++) {
        const f = (time * 0.7 + k / 3) % 1;
        const off = outward ? f * 1.6 - 0.2 : -1.8 + f * 1.6;
        const a = Math.sin(f * Math.PI) * 0.95 * boost;
        gA.push(cx + dx * off, PATH_H + 0.02, cz + dz * off, 0.72, 0.72, R.chevron, color.r, color.g, color.b, Math.min(1, a), rot);
      }
      // marker one tile outside the board: a swirling portal for spawns, a bobbing heart for exits
      const ox = cx + (outward ? dx : -dx) * 1.15;
      const oz = cz + (outward ? dz : -dz) * 1.15;
      if (outward) {
        gN.push(ox, PATH_H + 0.015, oz, 0.95, 0.95, R.disc, color.r, color.g, color.b, 0.35);
        batches.bbN.push(ox, 0.62 + Math.sin(time * 3) * 0.06, oz, 0.42, 0.42, R.heart, 1, 0.55, 0.68, 1);
      } else {
        gN.push(ox, PATH_H + 0.015, oz, 1.0, 1.0, R.disc, 0.35, 0.12, 0.45, 0.55);
        gA.push(ox, PATH_H + 0.02, oz, 0.95, 0.95, R.rune, 0.85, 0.4, 1, 0.75 * Math.min(1, boost), time * 1.4);
        gA.push(ox, PATH_H + 0.025, oz, 0.6, 0.6, R.ringThick, color.r, color.g, color.b, 0.5, -time * 2);
        if (Math.random() < 0.12 * fx.density) {
          fx.spawn({ batch: 'bbA', uv: R.glow, x: ox + (Math.random() - 0.5) * 0.6, y: 0.1, z: oz + (Math.random() - 0.5) * 0.6, vy: 0.6, s0: 0.14, s1: 0.03, life: 0.9, color: '#c48cff' });
        }
      }
    };
    const red = new THREE.Color('#ff5d73');
    const blue = new THREE.Color('#4cc9f0');
    for (const g of terrain.entrances) draw(g, red, false);
    for (const g of terrain.exits) draw(g, blue, true);
  }

  // ----- frame ----------------------------------------------------------------------------
  function update(dt) {
    if (disposed) return [];
    const d = Math.min(0.1, Math.max(0, dt || 0));
    time += d;
    const events = sim.drainEvents();
    handleEvents(events);
    actors.sync(d);
    for (const b of Object.values(batches)) b.begin();
    terrain.update(time);
    actors.drawGround(d);
    drawGates();
    const occupied = new Set();
    for (const v of actors.towers.values()) if (v.water) for (const o of terrain.waterDecor.get(v.decorKey) || []) occupied.add(o);
    ambient.update(d, occupied);
    overlays.update(d);
    actors.drawOverlay();
    rig.apply(d);
    fx.update(d);
    for (const b of Object.values(batches)) b.end();

    waveGlow = Math.max(1, waveGlow - d * 0.8);
    flash.a = Math.max(0, flash.a - d * flash.decay);
    flashEl.style.opacity = flash.a.toFixed(3);
    const bossAlive = sim.enemies.some((e) => e.tier === 'boss' || e.tier === 'miniboss');
    bossVignette = Math.max(bossAlive ? 0.2 + 0.08 * Math.sin(time * 2.4) : 0, bossVignette - d * 0.8);
    vignetteEl.style.opacity = (reduceMotion ? bossVignette * 0.5 : bossVignette).toFixed(3);

    renderer.info.reset();
    if (composer) composer.render(d);
    else renderer.render(scene, camera);
    return events;
  }

  // ----- picking -------------------------------------------------------------------------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hitP = new THREE.Vector3();
  const tmpV = new THREE.Vector3();

  function pick(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.ray.intersectPlane(plane, hitP);
    let tx = -999;
    let ty = -999;
    if (hit) {
      tx = Math.floor(hitP.x);
      ty = Math.floor(hitP.z);
    }
    const inBounds = tx >= 0 && ty >= 0 && tx < map.width && ty < map.height;
    let towerUid = inBounds ? sim.towerAt(tx, ty)?.uid ?? null : null;
    if (towerUid == null) {
      // tapping a girl's body (she stands up, so her head projects onto the tile behind)
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const radius = 0.38 / rig.scale;
      let best = radius * radius;
      for (const t of sim.towers) {
        const s = projectPx(t.x, t.y, 0.45, rect);
        const dd = (s.x - px) ** 2 + (s.y - py) ** 2;
        if (dd < best) {
          best = dd;
          towerUid = t.uid;
        }
      }
    }
    return { tx, ty, towerUid, inBounds, x: hit ? hitP.x : null, y: hit ? hitP.z : null };
  }

  function projectPx(x, y, z, rect = canvas.getBoundingClientRect()) {
    tmpV.set(x, z, y).project(camera);
    return { x: (tmpV.x + 1) / 2 * rect.width, y: (1 - tmpV.y) / 2 * rect.height, visible: tmpV.z > -1 && tmpV.z < 1 };
  }

  function worldToScreen(x, y, z = 0) {
    const rect = canvas.getBoundingClientRect();
    const p = projectPx(x, y, z, rect);
    return { x: p.x, y: p.y, clientX: p.x + rect.left, clientY: p.y + rect.top, visible: p.visible };
  }

  // ----- input -------------------------------------------------------------------------------
  const pointers = new Map();
  let gesture = null; // { moved, longFired, timer, t0, x0, y0 }
  let pinch = null;
  let lastTap = null;

  function local(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    canvas.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      const g = { moved: false, longFired: false, t0: performance.now(), x0: e.clientX, y0: e.clientY, timer: 0 };
      g.timer = setTimeout(() => {
        if (gesture !== g || g.moved || pointers.size !== 1) return;
        g.longFired = true;
        const p = pick(g.x0, g.y0);
        for (const cb of longCbs) cb({ ...p, clientX: g.x0, clientY: g.y0 });
      }, 520);
      gesture = g;
    } else if (pointers.size === 2) {
      if (gesture) {
        clearTimeout(gesture.timer);
        gesture.moved = true;
      }
      const [a, b] = [...pointers.values()];
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    }
  }

  function onMove(e) {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (pointers.size >= 2 && pinch) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const rect = canvas.getBoundingClientRect();
      if (pinch.dist > 0) rig.zoomAt(dist / pinch.dist, mx - rect.left, my - rect.top);
      rig.panBy(mx - pinch.mx, my - pinch.my);
      pinch = { dist, mx, my };
      return;
    }
    const g = gesture;
    if (!g) return;
    if (!g.moved && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > 9) {
      g.moved = true;
      clearTimeout(g.timer);
    }
    if (g.moved && !g.longFired) rig.panBy(dx, dy);
  }

  function onUp(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    const g = gesture;
    if (pointers.size > 0 || !g) return;
    gesture = null;
    clearTimeout(g.timer);
    if (e.type === 'pointercancel' || g.moved || g.longFired) return;
    if (performance.now() - g.t0 > 600) return;
    const p = pick(e.clientX, e.clientY);
    const now = performance.now();
    if (lastTap && now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30 && p.towerUid == null && !overlays.ghost) {
      lastTap = null;
      if (!rig.isDefault) rig.reset(true);
    } else {
      lastTap = { t: now, x: e.clientX, y: e.clientY };
    }
    for (const cb of tapCbs) cb({ ...p, clientX: e.clientX, clientY: e.clientY });
  }

  function onWheel(e) {
    e.preventDefault();
    const p = local(e);
    rig.zoomAt(Math.exp(-e.deltaY * 0.0015), p.x, p.y);
  }

  function onContext(e) {
    e.preventDefault();
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', onContext);

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
  ro?.observe(container);

  applyLighting();
  applyQuality(quality);
  rig.apply(0);

  // ----- public API ----------------------------------------------------------------------
  return {
    canvas,
    update,
    resize,
    pick,
    worldToScreen,
    setGhost(unitId, tx, ty, valid) {
      overlays.setGhost(unitId || null, tx, ty, valid);
    },
    setSelected(uid) {
      overlays.setSelected(uid ?? null);
    },
    showTileHints(unitId) {
      overlays.showTileHints(unitId || null);
    },
    setQuality(q) {
      if (QUALITY[q] && q !== quality) applyQuality(q);
    },
    setLighting(l = {}) {
      lighting = { ...lighting, ...l };
      applyLighting();
    },
    resetCamera() {
      rig.reset(true);
    },
    onTap(cb) {
      if (typeof cb === 'function') tapCbs.push(cb);
      return () => tapCbs.splice(tapCbs.indexOf(cb) >>> 0, 1);
    },
    onLongPress(cb) {
      if (typeof cb === 'function') longCbs.push(cb);
      return () => longCbs.splice(longCbs.indexOf(cb) >>> 0, 1);
    },
    /** Extra: reserve screen space for HUD bars so the map is framed inside them (CSS px). */
    setInsets(next = {}) {
      insets = { ...insets, ...next };
      resize();
    },
    /** Extra: read-only info for debugging / previews. */
    get info() {
      return { quality, theme: look.theme, night: look.night, fog: look.fog, weather: look.weather, scenery: scenery.keywords, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContext);
      ro?.disconnect();
      if (gesture) clearTimeout(gesture.timer);
      tapCbs.length = 0;
      longCbs.length = 0;
      overlays.dispose();
      actors.dispose();
      terrain.dispose();
      for (const b of Object.values(batches)) {
        scene.remove(b.mesh);
        b.dispose();
      }
      atlas.texture.dispose();
      if (composer) {
        composer.dispose();
        bloomPass?.dispose();
      }
      key.shadow.map?.dispose();
      renderer.dispose();
      canvas.remove();
      fxLayer.remove();
      liveRenderers = Math.max(0, liveRenderers - 1);
      if (liveRenderers === 0) clearPropCache();
    },
  };
}

function mixHex(a, b, t) {
  return `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`;
}
