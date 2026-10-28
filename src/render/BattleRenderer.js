// Battle renderer (CONTRACTS.md §9). Draws a running Sim with three.js: themed terrain,
// chibi girls, monsters, projectiles and effects, under an angled orthographic camera. The
// camera is locked on the fitted view by default (settings.camera = 'locked'); 'free' brings
// back the touch-friendly pan / pinch / double-tap-reset controls. Placing a girl never moves
// the camera in either mode (policy: src/render/cameraPolicy.js; pointer input:
// src/render/boardInput.js).
//
//   const r = createBattleRenderer(containerEl, sim, { quality, settings, insets, isPlacing, skins });
//   (skins: { unitId: skinId } outfits to dress the girls in, from systems/skins.js formationSkins)
//   r.update(dt)  // every frame AFTER sim.update; consumes and returns sim.drainEvents()
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CameraRig, clearSlide } from './camera.js';
import { cameraGestures, cameraModeOf } from './cameraPolicy.js';
import { attachBoardInput } from './boardInput.js';
import { createAtlas } from './textures.js';
import { QuadBatch } from './batch.js';
import { FxSystem } from './fx.js';
import { AmbientSystem } from './ambient.js';
import { RuleDecals } from './ruleDecals.js';
import { Actors, PATH_COLORS } from './actors.js';
import { Overlays } from './overlays.js';
import { BuffIcons } from './buffIcons.js';
import { buildTerrain, resolveScenery } from './terrain.js';
import { resolveLook, fxColor } from './themes.js';
import { clearPropCache } from './props.js';
import { clearCostumeCache } from './costumes.js';
import { createAttackFx } from './attackFx/index.js';
import { ATTACK_SPRITES } from './attackFx/sprites.js';
import { RosterFx } from './rosterFx.js';
import { StaffFx } from './staffFx.js';
import { Companions } from './companions.js';
import { createAbilityFx } from './abilityFx.js';
import { fmtNum } from '../ui/format.js';

const QUALITY = {
  high: { pixelRatio: 2, shadows: true, bloom: true },
  medium: { pixelRatio: 1.5, shadows: false, bloom: false },
  low: { pixelRatio: 1, shadows: false, bloom: false },
};
const ULT_COLORS = { nova: '#fff3b0', timeWarp: '#c9a8ff', tide: '#8fe8ff', strike: '#f589a0', runner: '#9fd8ff' };
const STATUS_FX = {
  freeze: '#bff0ff', burn: '#ff8a4a', poison: '#7be08a', shock: '#ffe45c', stun: '#ffd84d',
  silence: '#c4a6ff', reveal: '#ffe066', shred: '#d0d6e2', mark: '#ff6b8b', vulnerable: '#9fd8ff', slow: '#8fe3ff', soak: '#4cc9f0',
  curse: '#b46cff', hex: '#d77bff', ground: '#d8c8a0', hold: '#6fcf5e',
};
const MAX_NUMBERS_PER_FRAME = 14;
const MAX_HIT_FX_PER_FRAME = 40;

let liveRenderers = 0;
/** The info panel slides in first (0.22 s); the board follows once it stands. */
const PANEL_SLIDE_DELAY_MS = 260;

/**
 * Creates the battle renderer.
 * @param {HTMLElement} container element the canvas fills (should have a size)
 * @param {import('../sim/Sim.js').Sim} sim running simulation
 * @param {{ quality?: 'high'|'medium'|'low', settings?: object, insets?: {top,right,bottom,left}, isPlacing?: () => boolean }} [opts]
 *   settings.camera: 'locked' (default) | 'free'; isPlacing: the UI is placing a girl (the
 *   camera then holds still even in 'free' mode — a visible placement ghost counts too)
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
  // stage.look (render-only StageDef field, e.g. Halloween event stages):
  //   night: 'lantern' → warm lantern-lit night; costumes: true → monsters in costumes
  const stageLook = stage?.look || null;
  const look = resolveLook(map.theme, scenery, stageLook);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(look.fog ? mixHex(look.bg, look.fogColor, 0.4) : look.bg);

  const rig = new CameraRig(map);
  const camera = rig.camera;
  let cameraMode = cameraModeOf(settings);
  rig.setLocked(cameraMode === 'locked', false);
  const isPlacing = typeof opts.isPlacing === 'function' ? opts.isPlacing : () => false;
  // how far between two sim steps this frame is (0..1): roaming drones are drawn in between
  const renderAlpha = typeof opts.renderAlpha === 'function' ? opts.renderAlpha : () => 1;

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
  const atlas = createAtlas(ATTACK_SPRITES);
  const batches = {
    groundN: new QuadBatch({ texture: atlas.texture, max: 3000, mode: 'ground', renderOrder: 2 }),
    groundA: new QuadBatch({ texture: atlas.texture, max: 1500, mode: 'ground', blending: 'additive', renderOrder: 3 }),
    bbN: new QuadBatch({ texture: atlas.texture, max: 3000, renderOrder: 20 }),
    bbA: new QuadBatch({ texture: atlas.texture, max: 4000, blending: 'additive', renderOrder: 21 }),
    overlay: new QuadBatch({ texture: atlas.texture, max: 5000, depthTest: false, renderOrder: 30 }),
    // buff links of the selected girl: on the ground plane but over the models (src/render/buffIcons.js)
    links: new QuadBatch({ texture: atlas.texture, max: 800, mode: 'ground', depthTest: false, renderOrder: 25 }),
  };
  for (const b of Object.values(batches)) scene.add(b.mesh);
  const batchList = Object.values(batches);

  let shadowsOn = false;
  const terrain = buildTerrain(map, look, scenery, { shadows: false, quality, reverse: !!sim.mode?.reverse });
  scene.add(terrain.group);
  const fx = new FxSystem({ atlas, batches, camera });
  const ambient = new AmbientSystem({ map, look, terrain, fx, batches, atlas });
  const ruleDecals = sim.rule ? new RuleDecals({ sim, batches, atlas, fx }) : null;
  const actors = new Actors({ sim, scene, fx, batches, atlas, quality, terrain, costumes: stageLook?.costumes === true, skins: opts.skins });
  const overlays = new Overlays({ sim, scene, actors, terrain, batches, atlas, quality });
  // unique attack animations (purely visual; settings.attackFx === false = today's look)
  const attackFx = settings.attackFx === false ? null : createAttackFx({ sim, scene, actors, fx, batches, atlas, camera, rig, quality, reduceMotion });
  actors.fxHook = attackFx;
  // attack FX are decoration: an FX error must never cost a frame's sim events (won / lost) —
  // on the first one the FX switch off for this battle (today's look) and it is logged once
  let fxBroken = false;
  function fxSafe(fn) {
    if (fxBroken) return false;
    try {
      return fn();
    } catch (err) {
      fxBroken = true;
      actors.fxHook = null;
      try {
        attackFx.dispose();
      } catch {
        /* already broken: leave what is drawn */
      }
      console.warn('[attack fx] disabled after an error', err);
      return false;
    }
  }
  // roster mechanics: mortar warnings, relay props, aim reticles, curse bursts, strike + dragon ults
  const roster = new RosterFx({ sim, scene, fx, batches, atlas, actors, quality });
  // companion figures (Kon, Kaze, Yoriko's doll): display actors beside their girls (src/render/companions.js)
  const companions = new Companions({ sim, scene, actors, terrain, quality, reduceMotion });
  actors.companions = companions;
  roster.companions = companions;
  // companions are decoration too: an error switches them off for this battle (the holo fox fallback stays)
  let compBroken = false;
  function compFail(err) {
    compBroken = true;
    try {
      companions.clear();
      companions.disposed = true;
    } catch {
      /* leave what is drawn */
    }
    console.warn('[companions] disabled after an error', err);
  }
  // the staff heroes: Norika's barricades, Kogane's plow and Big Yellow (src/render/staffFx.js); decoration,
  // so an error switches them off for this battle
  const staff = new StaffFx({ sim, scene, fx, batches, atlas, actors, quality, reduceMotion });
  let staffBroken = false;
  function staffSafe(fn) {
    if (staffBroken) return null;
    try {
      return fn();
    } catch (err) {
      staffBroken = true;
      try {
        staff.dispose();
      } catch {
        /* leave what is drawn */
      }
      console.warn('[staff fx] disabled after an error', err);
      return null;
    }
  }
  const buffIcons = new BuffIcons({ sim, actors, batches, atlas });
  buffIcons.setMode(settings.buffIcons);

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
  // the selected girl and the screen the info panel covers (CSS px): the view slides so her
  // range ring stays clear of the panel (keepSelectedInView)
  let selectedUid = null;
  let selectedAtMs = 0;
  let panelCover = { right: 0, bottom: 0 };
  let lastFrameMs = 0;
  let flash = { a: 0, decay: 3 };
  let bossVignette = 0;
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
    attackFx?.setQuality(q);
    ambient.setQuality(q);
    roster.setQuality(q);
    staff.setQuality(q);
    companions.setQuality(q);
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
    // placing a girl: the camera holds still, impact shakes included (the drop point stays put)
    if (!reduceMotion && !placingNow()) rig.shake(a);
  }

  /** A floating damage number in the one number style (src/ui/format.js: "2,600", "12.3k", "1.2M"; never below 1). */
  function fmt(n) {
    return fmtNum(Math.max(1, n), 'count');
  }

  // generic ability FX (src/render/abilityFx.js): casts, warning rings, shells, fizzles, unlock sparkles
  // (Moon Pounce is Kon's to draw while his figure is up; on Kaze's Swoop, Kaze's figure dives on the targets in her
  // reach and abilityFx strikes the rest from the sky: companions.js swoopTargets)
  const abilityFx = createAbilityFx({
    sim, fx, actors, colorOf: (uid) => towerColor(uid), reduceMotion, flash: screenFlash, shake,
    companionOn: (uid) => !compBroken && companions.enabled && companions.has(uid),
    companionDives: (uid) => (compBroken ? null : companions.swoopTargets(uid)),
  });

  function handleEvents(events) {
    let numbers = 0;
    let hitFx = 0;
    abilityFx.frame();
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      // companions observe only (before the FX layers that consume events)
      if (!compBroken) {
        try {
          companions.handle(ev);
        } catch (err) {
          compFail(err);
        }
      }
      // the staff heroes' props observe only too
      staffSafe(() => staff.handle(ev));
      if (attackFx && fxSafe(() => attackFx.onEvent(ev, i, events))) continue;
      if (roster.handle(ev)) continue;
      if (abilityFx.handle(ev)) continue;
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
          if (ev.kind !== 'bullet' || !ev.turretUid) actors.playAttack(ev.towerUid, ev.kind);
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
          actors.markDying(ev.uid);
          fx.death(p.x, p.y, p.z, p.size, p.color);
          if (ev.bounty > 0) fx.coin(p.x, p.y, p.z, ev.bounty);
          break;
        }
        case 'leak': {
          const p = actors.enemyPos(ev.uid);
          if (p) {
            fx.flash(p.x, 0.4, p.z, '#ff4d6d', 1.2, 0.35);
            fx.ring(p.x, p.z, 0.2, 1.1, 0.45, '#ff4d6d');
            if (fx.numbers) fx.text(`-${fmtNum(ev.lives, 'count')}`, p.x, 0.9, p.z, '#ff4d6d', 0.26, 1, 0.6);
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
          actors.playSpecial(ev.uid);
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
          actors.playSpecial(ev.uid);
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
          const x = t ? t.x : ev.x ?? (ev.tx ?? 0) + 0.5;
          const z = t ? t.y : ev.y ?? (ev.ty ?? 0) + 0.5;
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
        case 'heroMove': {
          // her view is rebuilt at the new spot by the next sync; a puff where she left and arrived
          fx.puff(ev.fromX, 0.2, ev.fromY, '#ffffff', 6, 0.4, 0.35);
          actors.dropTower?.(ev.towerUid);
          fx.puff(ev.x, 0.1, ev.y, '#ffffff', 6, 0.5, 0.35);
          fx.ring(ev.x, ev.y, 0.15, 0.75, 0.4, '#ffffff', { additive: false, uv: 'ring', a0: 0.8 });
          if (ev.downtime > 0) fx.text('…', ev.x, 1.3, ev.y, '#ffffff', 0.3, ev.downtime, 0.2);
          overlays.refreshHints();
          break;
        }
        case 'heroLevel': {
          const v = actors.towerView(ev.towerUid ?? sim.hero?.uid);
          if (v) {
            const m = v.model.position;
            fx.sparkle(m.x, m.z, '#ffd84d', { count: 16, height: 1.2 });
            fx.text(fmtNum(ev.level, 'level'), m.x, 1.2, m.z, '#ffd84d', 0.24, 1.2, 0.5);
          }
          break;
        }
        case 'ult': {
          const col = staffSafe(() => staff.ultColor(ev)) || ULT_COLORS[ev.effect] || '#ffffff';
          // one struck enemy / the sky dragon / the plow (rosterFx, staffFx) and Hold the Line (staffFx): no
          // map-wide ring or flash on everyone
          const local = ev.effect === 'strike' || ev.effect === 'runner' || ev.effect === 'barricade';
          screenFlash(col, local ? 0.45 : 0.85, local ? 2.4 : 1.8);
          shake(local ? 0.06 : 0.09);
          if (local) break;
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

  // ----- frame ----------------------------------------------------------------------------
  // (entrance / exit markers are drawn by the ambient layer, AmbientSystem.drawGates)
  function update(dt) {
    if (disposed) return [];
    const d = Math.min(0.1, Math.max(0, dt || 0));
    time += d;
    const events = sim.drainEvents();
    // begin before events/sync: quads pushed there (projectile glows, attack FX) are kept
    for (const b of batchList) b.begin();
    handleEvents(events);
    try {
      actors.alpha = renderAlpha();
    } catch {
      actors.alpha = 1;
    }
    if (ruleDecals) for (const ev of events) if (ev.type === 'rift' || ev.type === 'ruleState') ruleDecals.handle(ev);
    actors.cameraYaw = rig.yaw;
    actors.sync(d);
    if (!compBroken) {
      try {
        companions.update(d, rig.zoom);
      } catch (err) {
        compFail(err);
      }
    }
    terrain.update(time);
    actors.drawGround(d);
    if (attackFx) fxSafe(() => attackFx.update(d));
    roster.update(d);
    staffSafe(() => staff.update(d));
    const occupied = new Set();
    for (const v of actors.towers.values()) if (v.water) for (const o of terrain.waterDecor.get(v.decorKey) || []) occupied.add(o);
    ambient.update(d, occupied);
    ruleDecals?.update(d, time);
    overlays.update(d);
    actors.drawOverlay();
    // the panel slide runs on real time (a girl can be inspected while the game is paused)
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const realDt = lastFrameMs ? Math.min(0.1, Math.max(0, (nowMs - lastFrameMs) / 1000)) : 0;
    lastFrameMs = nowMs;
    keepSelectedInView(nowMs);
    buffIcons.update(d, { worldPerPx: rig.scale, shortSide: Math.min(rig.viewW || 800, rig.viewH || 800) });
    // placing a girl: a shake already running stops too, and so does a free-mode reset glide
    if (placingNow()) rig.holdStill();
    rig.apply(d, realDt);
    fx.update(d);
    for (const b of batchList) b.end();

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

  /** Pixels per tile at a world point (for tap radii). */
  function pxPerTile(x, y, rect) {
    const a = projectPx(x, y, 0, rect);
    const b = projectPx(x + 1, y, 0, rect);
    return Math.hypot(b.x - a.x, b.y - a.y) || 40;
  }

  /**
   * The roaming drone drawn nearest the tap within 22 CSS px (or 0.3 tiles, whichever is larger):
   * flying ones only, or (flying = false) any. @returns {number|null} drone uid
   */
  function pickDrone(px, py, rect, flying) {
    let best = null;
    let bestD = Infinity;
    for (const t of sim.towers) {
      if (!(t.turretSpec?.leash > 0)) continue;
      for (const d of t.turrets) {
        if (flying && !(d.tgt || d.moving)) continue;
        const at = actors.droneDrawn.get(d.uid) || { x: d.x, h: 0.62, y: d.y };
        const s = projectPx(at.x, at.y, at.h, rect);
        const r = Math.max(22, 0.3 * pxPerTile(at.x, at.y, rect));
        const dd = (s.x - px) ** 2 + (s.y - py) ** 2;
        if (dd <= r * r && dd < bestD) {
          bestD = dd;
          best = d.uid;
        }
      }
    }
    return best;
  }

  /**
   * Screen → board. Returns the continuous world point under the pointer (`x`, `y`, free
   * placement — nothing snaps), the tile under it (`tx`, `ty`, legacy), the girl whose
   * footprint or body is there, the roaming drone tapped (`droneUid`: a flying drone wins over
   * everything, a drone at home only when no girl is there) and whether the point lies inside
   * the map.
   */
  function pick(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.ray.intersectPlane(plane, hitP);
    let x = null;
    let y = null;
    let tx = -999;
    let ty = -999;
    if (hit) {
      x = hitP.x;
      y = hitP.z;
      tx = Math.floor(x);
      ty = Math.floor(y);
    }
    const inBounds = hit && x >= 0 && y >= 0 && x < map.width && y < map.height;
    let towerUid = null;
    let droneUid = pickDrone(clientX - rect.left, clientY - rect.top, rect, true);
    if (droneUid != null) return { x, y, tx, ty, towerUid: null, droneUid, inBounds };
    if (hit) {
      // exact integers would be read as a tile by the sim's legacy rule; nudge them
      const px0 = Number.isInteger(x) ? x + 1e-6 : x;
      const py0 = Number.isInteger(y) ? y + 1e-6 : y;
      towerUid = sim.towerAt(px0, py0)?.uid ?? null;
    }
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
    if (towerUid == null) droneUid = pickDrone(clientX - rect.left, clientY - rect.top, rect, false);
    return { x, y, tx, ty, towerUid, droneUid, inBounds };
  }

  function projectPx(x, y, z, rect = canvas.getBoundingClientRect()) {
    tmpV.set(x, z, y).project(camera);
    return { x: (tmpV.x + 1) / 2 * rect.width, y: (1 - tmpV.y) / 2 * rect.height, visible: tmpV.z > -1 && tmpV.z < 1 };
  }

  /**
   * Phone-sized screens: the info panel covers part of the board, often right where the girl
   * the player just tapped stands. Slide the framing (camera rig focus shift) just far enough
   * that her whole range ring is clear of the panel, or centre her in the free part when the
   * ring is bigger than it; slide back when the panel closes. Never further than the panel.
   * It starts once the panel has slid in (a quick tap-and-close never moves the board) and
   * ignores slivers (< 12 px).
   */
  function keepSelectedInView(nowMs) {
    let gx = 0;
    let gy = 0;
    const t = selectedUid != null && (panelCover.right > 0 || panelCover.bottom > 0) && nowMs - selectedAtMs >= PANEL_SLIDE_DELAY_MS ? sim.getTower?.(selectedUid) : null;
    if (t) {
      // sizes from the rig's viewport (CSS px): no layout read every frame
      const w = rig.viewW;
      const h = rig.viewH;
      const r = Math.max(0.5, t.eff?.range ?? t.stats?.range ?? 0);
      // ring extent on screen without the current slide (4 points of the ground circle)
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      for (let k = 0; k < 4; k++) {
        tmpV.set(t.x + (k === 0 ? r : k === 1 ? -r : 0), 0, t.y + (k === 2 ? r : k === 3 ? -r : 0)).project(camera);
        const px = ((tmpV.x + 1) / 2) * w + rig.focus.x;
        const py = ((1 - tmpV.y) / 2) * h + rig.focus.y;
        x0 = Math.min(x0, px);
        x1 = Math.max(x1, px);
        y0 = Math.min(y0, py);
        y1 = Math.max(y1, py);
      }
      const m = 16;
      if (panelCover.right > 0) gx = clearSlide(m, w - panelCover.right - m, x0, x1, panelCover.right);
      if (panelCover.bottom > 0) gy = clearSlide(insets.top + m, h - Math.max(panelCover.bottom, insets.bottom) - m, y0, y1, panelCover.bottom);
      if (gx < 12) gx = 0;
      if (gy < 12) gy = 0;
    }
    rig.setFocusShift(gx, gy);
  }

  function worldToScreen(x, y, z = 0) {
    const rect = canvas.getBoundingClientRect();
    const p = projectPx(x, y, z, rect);
    return { x: p.x, y: p.y, clientX: p.x + rect.left, clientY: p.y + rect.top, visible: p.visible };
  }

  // ----- input -------------------------------------------------------------------------------
  /** A girl is being placed: a placement ghost on the board, or the UI says so (opts.isPlacing). */
  function placingNow() {
    if (overlays.ghost) return true;
    try {
      return !!isPlacing();
    } catch {
      return false;
    }
  }

  /** Camera gestures allowed right now (camera mode + whether a girl is being placed). */
  function gestures() {
    return cameraGestures({ mode: cameraMode, placing: placingNow() });
  }

  // taps, long presses, pan / pinch / wheel / double-tap — each camera move asks gestures()
  const input = attachBoardInput(canvas, {
    rig,
    pick,
    gestures,
    onTap: (p) => {
      for (const cb of tapCbs) cb(p);
    },
    onLongPress: (p) => {
      for (const cb of longCbs) cb(p);
    },
  });

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
    /** Placement preview at a continuous world point (two integers = a tile centre, legacy). */
    setGhost(unitId, x, y, valid) {
      if (Number.isInteger(x) && Number.isInteger(y)) {
        x += 0.5;
        y += 0.5;
      }
      overlays.setGhost(unitId || null, x, y, valid);
    },
    /** Extra: wobble the ghost (rejected drop feedback). */
    shakeGhost() {
      overlays.shakeGhost();
    },
    /** Gate arrows for this wave (relative to the terrain's gates) and the chevrons (absolute direction). */
    setRouteFlipped(flipped, reversed = flipped) {
      ambient.setGatesReversed(flipped, reversed);
    },
    /** The selected girl, and (optionally) one of her drones (ring, tether, reticle). */
    setSelected(uid, droneUid = null) {
      if ((uid ?? null) !== selectedUid) selectedAtMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
      selectedUid = uid ?? null;
      overlays.setSelected(uid ?? null, droneUid ?? null);
      attackFx?.setSelected(uid ?? null);
      roster.setSelected(uid ?? null);
      buffIcons.setSelected(uid ?? null);
    },
    /** Flight points being picked: { uid, mode, a } (her signal ring and the points so far), or null. */
    setFlightPreview(p) {
      overlays.flightPreview = p || null;
    },
    /** Where a drone is drawn on screen (CSS px) — e2e and the attack-FX hook. */
    droneScreen(uid) {
      const at = actors.droneDrawn.get(uid);
      if (!at) return null;
      return worldToScreen(at.x, at.y, at.h);
    },
    /** Where each roaming drone is drawn this frame: uid -> { x, h, y } (world; read-only). */
    get drawnDrones() {
      return actors.droneDrawn;
    },
    /**
     * Extra: the screen the selected girl's info panel covers, in CSS px from the board's right
     * / bottom edge ({} or zeros when it is closed). The view slides so her range ring stays
     * visible beside it (also when the camera is locked) and slides back when it closes.
     */
    setPanelCover(c = {}) {
      panelCover = { right: Math.max(0, c.right || 0), bottom: Math.max(0, c.bottom || 0) };
    },
    /** Extra: game-time speed (1–3×) so attack FX (drones) keep pace with the enemies, and a wave-clear sky dragon reaches START before an Auto start. */
    setTimeScale(s) {
      attackFx?.setTimeScale(s);
      roster.setTimeScale(s);
    },
    /** Extra: buff icons over the girls — 'all' | 'selected' | 'off' (settings.buffIcons). */
    setBuffIcons(mode) {
      buffIcons.setMode(mode);
    },
    /** Extra: pick mode rings on the girls `srcUid` can brew / tune up (null ends it). */
    setBuffPick(srcUid, candidates = []) {
      buffIcons.setPick(srcUid ?? null, candidates);
    },
    /** Extra: what the buff layer drew last frame ({ rows, icons, links, pick }; e2e / debugging). */
    get buffIconStats() {
      return { ...buffIcons.stats, mode: buffIcons.mode };
    },
    /** Extra: a 1.2 s pulse ring on a girl the UI points at (the holder of a locked final tier). */
    pulseTower(uid) {
      overlays.pulseTower(uid);
    },
    /** Extra: an ability's reach ring on the map ({ x, y, r } in tiles; null hides it): the hold card, aim mode. */
    setAbilityReach(o) {
      overlays.setAbilityReach(o || null);
    },
    /** Legacy no-op: free placement shows no forbidden-zone shading (owner request). */
    showTileHints() {},
    /** Extra: show the range circle around the placement ghost (settings.showRanges). */
    setPlacementRange(on) {
      overlays.showGhostRange = on !== false;
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
    /**
     * Extra: 'locked' holds the fitted view (a moved view glides back to it); 'free' allows
     * drag-pan / pinch / wheel zoom / double-tap reset. Applies at once (settings.camera).
     */
    setCameraMode(mode) {
      const next = cameraModeOf({ camera: mode });
      if (next === cameraMode) return;
      cameraMode = next;
      rig.setLocked(next === 'locked', true);
    },
    get cameraMode() {
      return cameraMode;
    },
    /** Extra: read-only camera pose for tests / debugging (world units). */
    get cameraState() {
      const r = (v) => Math.round(v * 1e4) / 1e4;
      return {
        mode: cameraMode,
        locked: rig.locked,
        zoom: r(rig.zoom),
        pan: [r(rig.pan.x), r(rig.pan.y)],
        position: [r(camera.position.x), r(camera.position.y), r(camera.position.z)],
        target: [r(rig.target.x), r(rig.target.y), r(rig.target.z)],
        focus: [r(rig.focus.x), r(rig.focus.y)],
        focusGoal: [r(rig.focusGoal.x), r(rig.focusGoal.y)],
        isDefault: rig.isDefault,
      };
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
    /** Extra: attack-FX snapshot for previews / e2e (allocates; dev tooling only). */
    attackFxProbe() {
      return attackFx?.probe() ?? null;
    },

    /** Extra: companion actors (Kon, Kaze, the doll) for e2e / debug (allocates). */
    companionsProbe() {
      return companions.probe();
    },

    /** Extra: the outfit (skin id) a placed girl's model wears, or null before it is drawn (e2e / debug). */
    towerSkin(uid) {
      return actors.towers.get(uid)?.model.userData.skinId ?? null;
    },
    /**
     * Extra: what a placed girl's figure is (e2e / debug): a duo's members, whether every part is a GLB or a
     * stand-in, her drawn facing (rad) and whether it keeps to the camera (src/render/facing.js).
     */
    towerModelInfo(uid) {
      const v = actors.towers.get(uid);
      const ud = v?.model.userData;
      if (!ud) return null;
      return {
        duo: !!ud.duo, members: ud.memberIds || null, glb: ud.duo ? !!ud.isGlb?.() : !!ud.glb, height: ud.height ?? null,
        standIn: ud.duo ? !!ud.isStandIn?.() : !!ud.standIn, facing: v.facing, faceCam: !!v.faceCam, cameraYaw: rig.yaw,
      };
    },
    /** Extra: read-only info for debugging / previews. */
    get info() {
      return { quality, theme: look.theme, night: look.night, fog: look.fog, weather: look.weather, scenery: scenery.keywords, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, attackFx: attackFx?.stats() ?? null };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      input.dispose();
      ro?.disconnect();
      tapCbs.length = 0;
      longCbs.length = 0;
      overlays.dispose();
      attackFx?.dispose();
      roster.dispose();
      staff.dispose();
      companions.dispose();
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
      if (liveRenderers === 0) {
        clearPropCache();
        clearCostumeCache();
      }
    },
  };
}

function mixHex(a, b, t) {
  return `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`;
}
