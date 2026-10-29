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
//
// Time and randomness (docs/VFX.md): every animation and effect drawn here runs on the one visual
// clock (src/render/vfx/clock.js; a hit-stop holds it, the sim never does) and draws its random
// numbers from seeded render-only streams (src/render/vfx/random.js), never from Math.random or
// the sim's rng — the same battle on the same frames gives the same picture.
//
// Hits that land (docs/VFX.md §M1), scaled by the graphics tier (src/render/vfx/feel.js FEEL):
// effect cores burn above white so the bloom catches them, a tone curve + per-theme grade end the
// high chain (no extra pass), medium gets light halo sprites instead of bloom (low none); heavy hits
// and crits hold only the struck enemy for a few frames (a local hold, picked by the hitting girl's
// impact preset: src/render/vfx/impactPresets.js, localHold.js), the global hit-stop (the visual
// clock, never the battle) is only for ult impacts and boss kills, a tinted impact frame on hero
// ults and boss kills (high), struck monsters squash and flash, blasts with cel bodies, a camera
// shake sized in screen pixels (big hits only, a shift and never a roll) and a zoom punch. Reduce
// Motion: no shake, punch, hit-stop, hold or impact frames, and softer flashes; Settings → Graphics
// → Flashes & shake off: no screen flash, impact frames, shake, punch, hit-stop or hold; Impact
// frames off: a soft tint instead. The flash guard (src/render/vfx/flashGuard.js) counts flashing
// screen area a second (world flashes too), keeps full-screen flashes to ≤ 3 a second, never white,
// and softens reddish ones.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { CameraRig, clearSlide } from './camera.js';
import { cameraGestures, cameraModeOf } from './cameraPolicy.js';
import { attachBoardInput, boardPoint } from './boardInput.js';
import { createAtlas } from './textures.js';
import { QuadBatch } from './batch.js';
import { FxSystem, bounceBlast, noteBallPop, BOUNCE_BODY } from './fx.js';
import { AmbientSystem } from './ambient.js';
import { RuleDecals } from './ruleDecals.js';
import { Actors, PATH_COLORS } from './actors.js';
import { Overlays } from './overlays.js';
import { BuffIcons } from './buffIcons.js';
import { buildTerrain, resolveScenery, ROOF_Y } from './terrain.js';
import { resolveLook, fxColor } from './themes.js';
import { clearPropCache } from './props.js';
import { clearCostumeCache } from './costumes.js';
import { createAttackFx } from './attackFx/index.js';
import { ATTACK_SPRITES } from './attackFx/sprites.js';
import { VisualClock } from './vfx/clock.js';
import { createVisualRandom, visualSeed } from './vfx/random.js';
import { FlashGuard, vignetteStep, screenShare } from './vfx/flashGuard.js';
import { HitStopDirector, hitKind } from './vfx/hitStop.js';
import { LocalHoldDirector, LOCAL_HOLD } from './vfx/localHold.js';
import { HitSource } from './vfx/hitSource.js';
import { impactClass, impactLook, mayLand } from './vfx/impactPresets.js';
import { ImpactFrames } from './vfx/impact.js';
import { GradePass, gradeFor } from './vfx/grade.js';
import { createHitFeel, momentTrauma, explodeShakes, explodeSource, abilityBlastTrauma, stepTint } from './vfx/feel.js';
import { RosterFx } from './rosterFx.js';
import { StaffFx } from './staffFx.js';
import { Companions } from './companions.js';
import { createAbilityFx } from './abilityFx.js';
import { deployFx } from './deployFx.js';
import { fmtNum } from '../ui/format.js';
import { createBlackout } from './blackout.js';
import { createTear } from './tear.js';
import { fallStyleOf, playFall } from './fallStyles.js';
import { createBarkQueue, createBarkChips } from '../ui/battle/barks.js';
import { barkUnit } from '../ui/text/barks.js';

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
/**
 * Bloom on high (docs/VFX.md §M1). Effect cores are pushed above white (HDR_ADD / HDR_GROUND: the
 * extra brightness of a fully covered additive sprite, src/render/batch.js), so the threshold can
 * sit just above the lit scene: a soft knee (THRESHOLD … THRESHOLD + KNEE) lets light fade into
 * the glow instead of popping, and the white of a lit dress or the road never blooms.
 */
const BLOOM = {
  day: { strength: 0.5, radius: 0.5, threshold: 0.96, knee: 0.4 },
  night: { strength: 0.62, radius: 0.55, threshold: 0.84, knee: 0.36 },
};
const HDR_ADD = 1.7;
const HDR_GROUND = 0.9;
/** Hit flash colours: a crit flashes gold, a hit the enemy is weak to in the attack's colour. */
const CRIT_FLASH = new THREE.Color('#ffc36b');
const WHITE_FLASH = new THREE.Color('#ffffff');
/** Camera trauma (0..1, src/render/camera.js kick) per moment. */
const TRAUMA = {
  explodeMin: 1.6, // only a volatile monster's blast this big shakes (a girl's splash never does; her big ability blasts jolt once)
  explode: 0.26, bigHit: 0.3, eliteKill: 0.28, minibossKill: 0.55, bossKill: 0.9,
  bossSpawn: 0.6, minibossSpawn: 0.42, bossPhase: 0.5, leak: 0.45, ult: 0.72, localUlt: 0.5, tier5: 0.32,
  // big moments the attack-FX layer draws (Kaede's maple storm / shockwave, Marumi's Glow Bowl
  // finale and Giant Strike): their trauma is src/render/vfx/feel.js MOMENT_TRAUMA
  artGap: 0.8, // frame seconds between two of these jolts
};
/** Bright-area share of each light sprite's square (a soft glow flashes only in its middle). */
const FLASH_FILL = { glow: 0.3, soft: 0.55, spark: 0.25, star: 0.35 };
/** Zoom punch (share of the view, seconds). */
const PUNCH = { ult: [0.07, 0.38], bossKill: [0.05, 0.32] };

let liveRenderers = 0;
/** The info panel slides in first (0.22 s); the board follows once it stands. */
const PANEL_SLIDE_DELAY_MS = 260;

/**
 * Creates the battle renderer.
 * @param {HTMLElement} container element the canvas fills (should have a size)
 * @param {import('../sim/Sim.js').Sim} sim running simulation
 * @param {{ quality?: 'high'|'medium'|'low', settings?: object, insets?: {top,right,bottom,left}, isPlacing?: () => boolean, visualSeed?: number }} [opts]
 *   settings.camera: 'locked' (default) | 'free'; isPlacing: the UI is placing a girl (the
 *   camera then holds still even in 'free' mode — a visible placement ghost counts too);
 *   visualSeed: seed of the visual random streams (default: from the map and stage)
 */
export function createBattleRenderer(container, sim, opts = {}) {
  liveRenderers++;
  const settings = opts.settings || {};
  let quality = QUALITY[opts.quality] ? opts.quality : (QUALITY[settings.quality] ? settings.quality : 'medium');
  const reduceMotion = !!settings.reduceMotion;
  // the one visual clock (hit-stop holds it, never the sim) and the seeded visual randomness
  const clock = new VisualClock({ reduceMotion });
  const vrand = createVisualRandom(opts.visualSeed ?? visualSeed('battle', sim.map?.id, sim.stage?.id));
  // hits that land: Settings → Graphics → Flashes & shake (settings.hitEffects, read live; also in
  // the pause menu): off = no screen flash, impact frames, shake, zoom punch or hit-stop
  const hitEffectsOn = () => settings.hitEffects !== false;
  // Settings → Graphics → Impact frames (settings.impactFrames, default on, read live; Reduce
  // Motion turns them off): off = an ult or a boss kill gets a soft tint instead
  const impactFramesOn = () => settings.impactFrames !== false;
  const flashGuard = new FlashGuard({ reduceMotion });
  const director = new HitStopDirector(clock, { enabled: hitEffectsOn });
  // heavy hits and crits hold only the struck enemy (a few local holds a wave, never a stutter)
  const holds = new LocalHoldDirector(clock, { enabled: hitEffectsOn, busy: () => director.busy });
  // who dealt each hit (to pick her impact preset): read-only bookkeeping of the sim's projectiles,
  // kept only while a hit can hold its enemy (hitSourceOn)
  const hitSource = new HitSource();
  let hitSourceOn = false;
  // Marumi's balls on a Spin Shot bounce: their next blast draws the smaller cloud (fx.js bounceBlast)
  const bouncing = new Set();

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
  // (the map's district, e.g. Old Town on a city map, re-dresses the theme: themes.DISTRICTS)
  const look = resolveLook(map.theme, scenery, stageLook, map);
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
    // (a low sun, e.g. dusk's keyY, comes in from nearer the horizon: longer shadows)
    key.position.set(cx + ox * Math.cos(yaw) + oz * Math.sin(yaw), look.light.keyY ?? 12, cz - ox * Math.sin(yaw) + oz * Math.cos(yaw));
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
  if (terrain.roofs) fx.liftAt = terrain.roofAt;
  const ambient = new AmbientSystem({ map, look, terrain, fx, batches, atlas });
  // (the far north's relay pads are village hearths: warm, scenery keyword 'villageHearths'; the
  // Drowned Line's vents are relief valves: steam; Vesperline's rift points are transit pads)
  const ruleDecals = sim.rule ? new RuleDecals({ sim, batches, atlas, fx, warm: scenery.keywords.includes('villageHearths'), steam: look.city?.kit === 'drowned' || scenery.keywords.includes('steamValves'), transit: look.theme === 'vesper' || scenery.keywords.includes('transitPads') }) : null;
  // blackout dimming (StageDef.look.blackout, Gate Arc): the lamps, windows and light pools go
  // dark while the map rule is active (src/render/blackout.js); never enemies, girls, road or HUD
  const blackout = createBlackout({ enabled: !!(stageLook?.blackout && sim.rule) });
  // HAMMER's tear (a hammerTear on the board, Gate Arc 3-10): it pulses while the map rule is
  // active, through the same ruleState events (src/render/tear.js); render only
  const tear = createTear({ enabled: !!terrain.tear });
  if (tear.enabled) terrain.setTear(tear.glow());
  // Brigade barks (src/ui/battle/barks.js): chips over a Brigade group as it comes on and over a
  // unit as it is beaten; the DOM chips are made on the first bark (none on other boards)
  const barks = createBarkQueue();
  let barkChips = null;
  const enemyDef = (id) => {
    try {
      return sim.data?.enemy?.(id) || null;
    } catch {
      return null;
    }
  };
  /** Offers a spawn / death event to the bark queue (only Brigade units have barks). */
  function bark(ev) {
    if (!barkUnit(ev.id)) return;
    const rect = canvas.getBoundingClientRect();
    const p = projectPx(ev.x, ev.y, 0.5, rect);
    const side = p.x < rect.width / 2 ? 'left' : 'right';
    if (barks.onEvent(ev, side) && !barkChips) barkChips = createBarkChips(fxLayer);
  }
  const actors = new Actors({ sim, scene, fx, batches, atlas, quality, terrain, costumes: stageLook?.costumes === true, skins: opts.skins });
  const overlays = new Overlays({ sim, scene, actors, terrain, batches, atlas, quality });
  // unique attack animations (purely visual; settings.attackFx === false = today's look)
  const attackFx = settings.attackFx === false ? null : createAttackFx({ sim, scene, actors, fx, batches, atlas, camera, rig, quality, reduceMotion, rand: vrand.fork('attackFx') });
  actors.fxHook = attackFx;
  // one seeded stream per layer (the ambient layer seeds its own from the map)
  fx.rand = vrand.fork('fx');
  actors.rand = vrand.fork('actors');
  const evRand = vrand.fork('events');
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
  const roster = new RosterFx({ sim, scene, fx, batches, atlas, actors, quality, camera, reduceMotion, rand: vrand.fork('roster') });
  // Iroha's bolt style reports each bolt that leaves her mirror panel, so the panel flips and glints (display only)
  if (attackFx) attackFx.ctx.mirrors = roster.mirrors;
  // a far zoom (a phone showing the whole board): the panel's cues draw up to 1.7x (42 px a tile reads as is)
  roster.mirrors.readScale = () => 42 * (rig.scale || 1 / 42);
  // companion figures (Kon, Kaze, Yoriko's doll): display actors beside their girls (src/render/companions.js)
  const companions = new Companions({ sim, scene, actors, terrain, quality, reduceMotion, fx, batches, atlas, camera });
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
  const staff = new StaffFx({ sim, scene, fx, batches, atlas, actors, quality, reduceMotion, rand: vrand.fork('staff') });
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
  // impact frames: a navy tint over the board, the toon figures (and companions) as pink silhouettes
  // over it, the additive effect batches burning on top; the normal-blend batches sit those frames out
  const impact = new ImpactFrames({
    scene, figures: () => [actors.root, companions.root],
    hide: () => [batches.groundN.mesh, batches.bbN.mesh, batches.overlay.mesh, batches.links.mesh, overlays.root],
  });
  // shake / punch / hit-stop / hold / impact / flash decisions (Reduce Motion, Hit effects, Impact
  // frames, placing, budget)
  const feel = createHitFeel({
    reduceMotion, hitEffects: hitEffectsOn, impactFrames: impactFramesOn, placing: () => placingNow(), now: () => clock.realT, tier: () => quality,
    guard: flashGuard, director, holds, rig, impact, tint: (c, a, d) => tint(c, a, d),
  });
  // world flashes (bright, short additive sprites) ask the flash guard: their screen area adds up
  const flashFill = new Map(Object.entries(FLASH_FILL).map(([k, v]) => [atlas.regions[k], v]));
  const flashGate = (size, uv, strength) => {
    const px = size / Math.max(1e-6, rig.scale);
    const share = screenShare(px, rig.viewW, rig.viewH, flashFill.get(uv) ?? 0.4);
    return flashGuard.world(share, strength, clock.realT);
  };
  fx.flashGate = flashGate;
  if (attackFx) attackFx.ctx.flashGate = flashGate;

  // ----- post-processing -------------------------------------------------------------------
  // high: scene → bloom → grade (tone curve + this theme's grade, in place of the output pass)
  let composer = null;
  let bloomPass = null;
  let gradePass = null;
  const grade = gradeFor(look);
  const setupComposer = (on) => {
    if (composer) {
      composer.dispose();
      bloomPass?.dispose();
      gradePass?.dispose();
      composer = null;
      bloomPass = null;
      gradePass = null;
    }
    if (on) {
      const size = renderer.getSize(new THREE.Vector2());
      const rt = new THREE.WebGLRenderTarget(size.x * renderer.getPixelRatio(), size.y * renderer.getPixelRatio(), { type: THREE.HalfFloatType, samples: 4 });
      composer = new EffectComposer(renderer, rt);
      composer.addPass(new RenderPass(scene, camera));
      const b = look.night ? BLOOM.night : BLOOM.day;
      bloomPass = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), b.strength, b.radius, b.threshold);
      bloomPass.highPassUniforms.smoothWidth.value = b.knee;
      composer.addPass(bloomPass);
      gradePass = new GradePass(grade);
      composer.addPass(gradePass);
    }
    // glow: bloom catches the over-white cores; without it, halo sprites fake the glow
    batches.bbA.setHdr(on ? HDR_ADD : 0);
    batches.groundA.setHdr(on ? HDR_GROUND : 0);
    fx.setGlow(quality, on);
    attackFx?.setGlow?.(quality, on);
  };

  // ----- state -----------------------------------------------------------------------------
  let insets = { top: 0, right: 0, bottom: 0, left: 0, ...(opts.insets || {}) };
  // the selected girl and the screen the info panel covers (CSS px): the view slides so her
  // range ring stays clear of the panel (keepSelectedInView)
  let selectedUid = null;
  let selectedAtMs = 0;
  let panelCover = { right: 0, bottom: 0 };
  let flash = { a: 0, decay: 3 };
  let lastArtShake = -Infinity;
  let bossVignette = 0; // spike level (boss spawn / phase), decays
  let vignetteA = 0; // drawn opacity (flashGuard.js vignetteStep)
  let disposed = false;
  const tapCbs = [];
  const longCbs = [];
  let lighting = { exposure: 1, warmth: 0, ...(settings.lighting || {}) };

  function applyQuality(q) {
    impact.cancel();
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
    hemi.intensity = baseLight.hemi * ex * blackout.hemiScale();
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

  /**
   * Draws the screen tint (no flash budget: callers go through screenFlash or an impact). With
   * `rise` (seconds) it swells in from where it is toward `strength` instead of starting at it (the
   * afterglow of impact frames: never a jump up after the dimmed frames).
   */
  function tint(color, strength, decay, rise = 0) {
    if (!(strength > 0)) return;
    if (rise > 0 && flash.a >= strength) return; // a brighter tint is already fading out: it stays
    flashEl.style.background = `radial-gradient(ellipse at center, ${color} 0%, ${color}cc 45%, ${color}55 100%)`;
    flash = rise > 0 ? { a: flash.a, from: flash.a, peak: strength, rise, up: 0, decay } : { a: Math.max(flash.a, strength), decay };
  }

  /** A full-screen flash: through the flash guard (≤ 3 a second, capped, soft with Reduce Motion). */
  const screenFlash = (color, strength, decay) => feel.flash(color, strength, decay);
  /** Camera shake (trauma 0..1, sized in screen pixels; none with Reduce Motion or while placing). */
  const shake = (trauma) => feel.shake(trauma);
  /** Zoom punch [amount, seconds] (none with Reduce Motion or while placing). */
  const punch = (p) => feel.punch(p);
  /** Impact frames + hit-stop for a hero ult or a boss kill, or a soft tint (feel.impact). */
  const impactMoment = (color) => feel.impact(color);

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

  // A constant beam's damage ticks (Kohaku's, src/sim/duo.js: `tick` hits, ten a second on everything on its line)
  // never spark or flash the enemy one by one (no strobe: the beam itself shows the hit); their damage is summed
  // per enemy and shown as one number every TICK_SUM_S (game time, so a paused battle holds it). Entries are
  // pooled: no allocation per tick.
  const TICK_SUM_S = 0.45;
  const tickSums = new Map();
  const tickFree = [];
  function tickHit(ev) {
    let e = tickSums.get(ev.uid);
    if (!e) {
      e = tickFree.pop() || { amt: 0, t: 0, crit: false, x: 0, y: 0 };
      e.amt = 0;
      e.t = clock.t; // (visual time: a paused battle, or a hit-stop, holds the sum)
      e.crit = false;
      tickSums.set(ev.uid, e);
    }
    e.amt += ev.amount || 0;
    if (ev.crit) e.crit = true;
    e.x = ev.x;
    e.y = ev.y;
  }
  function flushTickSums(numbers) {
    for (const [uid, e] of tickSums) {
      const p = actors.enemyPos(uid);
      if (p && clock.t - e.t < TICK_SUM_S) continue;
      if (fx.numbers && numbers < MAX_NUMBERS_PER_FRAME && e.amt >= 1) {
        numbers++;
        const x = p ? p.x : e.x;
        const z = p ? p.z : e.y;
        const y = p ? p.y + p.height * 0.55 : 0.35;
        fx.text(e.crit ? `${fmt(e.amt)}!` : fmt(e.amt), x, y + 0.25, z, e.crit ? '#ff9a3d' : '#e6dcff', e.crit ? 0.22 : 0.17, 0.65, 0.45);
      }
      tickSums.delete(uid);
      tickFree.push(e);
    }
    return numbers;
  }

  function handleEvents(events) {
    let numbers = 0;
    let hitFx = 0;
    let hits = 0;
    // (a beam's damage ticks are not blows: ten a second per enemy on her line would make every duo fight 'busy')
    for (let i = 0; i < events.length; i++) if (events[i].type === 'hit' && !events[i].tick) hits++;
    director.noteHits(hits); // busy fights: fewer local holds
    // which shots landed since the last frame (who hit whom): only needed while a hit can hold its
    // enemy (not on Low, with Reduce Motion or with Flashes & shake off); it starts afresh when holds
    // become possible again (the settings are read live)
    const holdable = feel.holdsPossible();
    if (holdable) {
      if (!hitSourceOn) hitSource.clear();
      hitSource.frame(sim.projectiles);
    }
    hitSourceOn = holdable;
    const squashK = feel.squash(); // by tier (none on low), half with Reduce Motion
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
      // big moments the attack-FX layer draws (Kaede's storm / shockwave, Marumi's Glow Bowl finale
      // and Giant Strike): one jolt, at least artGap apart
      const moment = momentTrauma(ev);
      if (moment > 0 && clock.frameT - lastArtShake >= TRAUMA.artGap && shake(moment)) lastArtShake = clock.frameT;
      noteBallPop(ev, bouncing); // (a ball's blast comes before its pop: the blast reads the state its last pop left)
      // the staff heroes' props observe only too
      staffSafe(() => staff.handle(ev));
      // a duo's two girls move by whose weapon fired, and cheer on her cast (observe only, src/models/duo.js)
      actors.duoEvent(ev);
      if (attackFx && fxSafe(() => attackFx.onEvent(ev, i, events))) continue;
      if (roster.handle(ev)) continue;
      if (abilityFx.handle(ev)) continue;
      switch (ev.type) {
        case 'hit': {
          if (ev.tick) {
            tickHit(ev);
            break;
          }
          // the struck monster flashes (gold on a crit, the attack's colour on a weak spot) and
          // squashes; a strong hit or a crit (the hitting girl's impact preset) also holds it for a
          // few frames — only that enemy, never the board
          const view = actors.enemies.get(ev.uid) || null;
          const weakSpot = (ev.effective ?? 1) > 1;
          let cls = 'weak';
          let unit = null;
          if (mayLand(ev, view)) {
            // who hit decides her preset; while no hold is possible only the squash depends on the
            // class, and the 'normal' preset stands in (no projectile bookkeeping)
            if (holdable) {
              const owner = hitSource.owner(events, i);
              unit = owner != null ? sim.getTower?.(owner)?.unitId ?? null : null;
            }
            cls = impactClass(ev, view, unit);
          }
          const lk = impactLook(unit, cls, weakSpot);
          const flashCol = ev.crit ? CRIT_FLASH : weakSpot ? fxCol(fxColor(null, ev.attackType, '#ffffff')) : WHITE_FLASH;
          // the flash and squash first: a hold then freezes this struck look (actors.holdEnemy)
          actors.hitFlash(ev.uid, flashCol, 1, lk.squash * squashK);
          if (holdable && view && lk.hold > 0) {
            const n = feel.hold(ev.uid, cls, lk.hold);
            if (n > 0) actors.holdEnemy(ev.uid, n, LOCAL_HOLD.jitter);
          }
          if (hitKind(ev, view) === 'big') shake(TRAUMA.bigHit);
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
              fx.slash(p.x, p.z, evRand.signed() * 1.4, col, 0.8 + Math.min(0.6, ramp * 0.05));
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
        case 'explode': {
          // a Spin Shot bounce draws a smaller body, so the Glow Bowl finale is the one big cloud
          fx.explosion(ev.x, ev.y, ev.radius, ev.volatile ? '#ff5a4a' : fxColor(ev.element, ev.attackType || 'blast'), { volatile: ev.volatile, scale: bounceBlast(events, i, bouncing) ? BOUNCE_BODY : 1 });
          // the camera shakes only for big hits: a girl's basic splash (a fireball, a shell, a ball,
          // a charged strip) never does; her big ability blast jolts once (≥ the art gap apart); a big
          // blast no girl owns (a volatile monster) still shakes
          const src = explodeSource(events, i);
          if (explodeShakes(ev, TRAUMA.explodeMin, src)) shake(TRAUMA.explode + Math.min(0.2, (ev.radius - TRAUMA.explodeMin) * 0.1));
          const jolt = abilityBlastTrauma(ev, TRAUMA.explodeMin, src);
          if (jolt > 0 && clock.frameT - lastArtShake >= TRAUMA.artGap && shake(jolt)) lastArtShake = clock.frameT;
          break;
        }
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
          // how it leaves: the shipped poof and homeward sparkle, or a Brigade unit's own fall
          // (no sparkle; the Gnat's spark spray), a Noon machine's cyan break-apart — src/render/fallStyles.js
          const def = enemyDef(ev.id);
          playFall(fx, fallStyleOf(def), p, def);
          if (ev.bounty > 0) fx.coin(p.x, p.y, p.z, ev.bounty);
          const tier = actors.enemies.get(ev.uid)?.tier ?? enemyTier(ev.id);
          if (tier === 'boss') {
            // a boss falls: hit-stop, impact frames, a big jolt and a zoom punch
            feel.hitStop('boss');
            impactMoment('#ffe6b0');
            shake(TRAUMA.bossKill);
            punch(PUNCH.bossKill);
            fx.ring(p.x, p.z, 0.3, 3.6, 0.7, '#ffe6b0');
            fx.flash(p.x, p.y + 0.6, p.z, '#fff3d6', 2.6, 0.4);
          } else if (tier === 'miniboss') {
            // a miniboss falls: its own death holds for a few frames (the board carries on)
            const n = holdable && actors.enemies.has(ev.uid) ? feel.hold(ev.uid, 'crit', LOCAL_HOLD.maxFrames) : 0;
            if (n > 0) actors.holdEnemy(ev.uid, n, LOCAL_HOLD.jitter);
            shake(TRAUMA.minibossKill);
          } else if (tier === 'elite') {
            shake(TRAUMA.eliteKill);
          }
          bark(ev);
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
            shake(TRAUMA.leak);
            screenFlash('#ff4d6d', 0.35, 3);
          }
          break;
        }
        case 'spawn': {
          bark(ev);
          const def = sim.data?.enemy?.(ev.id);
          if (def && (def.tier === 'boss' || def.tier === 'miniboss')) {
            shake(def.tier === 'boss' ? TRAUMA.bossSpawn : TRAUMA.minibossSpawn);
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
          shake(TRAUMA.bossPhase);
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
            fx.shards(m.x, m.y + 0.55, m.z, '#ffcc33', 6);
            fx.puff(m.x, m.y + 0.45, m.z, '#4a4a55', 5, 0.3, 0.35);
          }
          break;
        }
        case 'trapPlaced':
          fx.ring(ev.x, ev.y, 0.05, 0.45, 0.3, '#ffb347');
          break;
        case 'deploy': // a sentry unfolding, a net laid (Yuzuha)
          deployFx(ev, fx);
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
          if (ev.tier >= 3) fx.flash(t.x, 0.6 + fx.lift(t.x, t.y), t.y, col, 1.4 + ev.tier * 0.2, 0.3);
          if (ev.tier >= 5) {
            shake(TRAUMA.tier5);
            screenFlash(col, 0.25, 3);
          }
          break;
        }
        case 'sell': {
          const v = actors.towerView(ev.towerUid);
          if (v) {
            const m = v.model.position;
            fx.puff(m.x, m.y + 0.25, m.z, '#ffffff', 6, 0.4, 0.35);
            fx.coin(m.x, m.y + 0.15, m.z, ev.refund);
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
            fx.text(fmtNum(ev.level, 'level'), m.x, 1.15 + m.y, m.z, '#ffd84d', 0.24, 1.2, 0.5);
          }
          break;
        }
        case 'ult': {
          const col = staffSafe(() => staff.ultColor(ev)) || ULT_COLORS[ev.effect] || '#ffffff';
          // one struck enemy / the sky dragon / the plow (rosterFx, staffFx) and Hold the Line (staffFx): no
          // map-wide ring and no impact frames
          const local = ev.effect === 'strike' || ev.effect === 'runner' || ev.effect === 'barricade';
          if (local) {
            screenFlash(col, 0.45, 2.4);
            shake(TRAUMA.localUlt);
            break;
          }
          // impact frames (or a soft tint), a jolt and a zoom punch
          impactMoment(col);
          shake(TRAUMA.ult);
          punch(PUNCH.ult);
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
              batch: 'bbN', uv: atlas.regions.petal, x: evRand() * map.width, y: 3 + evRand() * 2, z: evRand() * map.height,
              vx: evRand.signed() * 0.6, vy: -0.7 - evRand() * 0.6, s0: 0.14, s1: 0.12, life: 4 + evRand() * 2,
              color: cols[i % cols.length], a0: 1, a1: 0.6, rot: evRand() * 6, vrot: evRand.signed() * 6,
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
    flushTickSums(numbers);
  }

  // ----- frame ----------------------------------------------------------------------------
  // (entrance / exit markers are drawn by the ambient layer, AmbientSystem.drawGates)
  function update(dt) {
    if (disposed) return [];
    // the panel slide runs on real time (a girl can be inspected while the game is paused)
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    clock.tick(dt, nowMs);
    const d = clock.dt; // visual time: effects, bodies, shake, shaders (0 during a hit-stop)
    const fd = clock.frameDt; // the frame's own time: board feedback (ghost, rings, buff icons)
    const time = clock.t;
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
    if (blackout.enabled) {
      for (const ev of events) blackout.handle(ev);
      if (blackout.step(d)) {
        terrain.setDim(blackout.dim);
        ambient.dim = blackout.dim;
        hemi.intensity = baseLight.hemi * THREE.MathUtils.clamp(lighting.exposure ?? 1, 0.4, 1.8) * blackout.hemiScale();
      }
    }
    if (tear.enabled) {
      for (const ev of events) tear.handle(ev);
      if (tear.step(d)) terrain.setTear(tear.glow());
      ambient.tear = tear.level;
    }
    barks.update(d);
    if (barkChips) {
      // one layout read per frame, and only while a chip is up (barkPoint writes into a reused point)
      if (barks.sides.left || barks.sides.right) barkRect = canvas.getBoundingClientRect();
      barkChips.draw(barks, barkPoint);
    }
    actors.sync(d);
    if (!compBroken) {
      try {
        companions.update(d, rig.zoom);
      } catch (err) {
        compFail(err);
      }
    }
    // the lane schedule (Gate Arc): the level crossings show this wave's lanes, or the next wave's
    // between waves (the barrier comes down before the column arrives)
    terrain.setLanes(sim.openLanes ? sim.openLanes() : null);
    terrain.update(time);
    actors.drawGround(d);
    if (attackFx) fxSafe(() => attackFx.update(d, fd));
    roster.update(d);
    staffSafe(() => staff.update(d));
    const occupied = new Set();
    for (const v of actors.towers.values()) if (v.water) for (const o of terrain.waterDecor.get(v.decorKey) || []) occupied.add(o);
    ambient.update(d, occupied);
    ruleDecals?.update(d, time);
    overlays.update(fd);
    actors.drawOverlay();
    keepSelectedInView(nowMs);
    buffIcons.update(fd, { worldPerPx: rig.scale, shortSide: Math.min(rig.viewW || 800, rig.viewH || 800) });
    // placing a girl: a shake already running stops too, and so does a free-mode reset glide
    if (placingNow()) rig.holdStill();
    // the shake and zoom punch run on frame time: the camera jolts through a hit-stop
    rig.apply(d, clock.realDt, clock.frameDt);
    fx.update(d);
    for (const b of batchList) b.end();

    // the screen tint waits out the impact frames (the ink frame is never tinted), then fades
    if (!impact.active) stepTint(flash, d);
    flashEl.style.opacity = impact.active ? '0' : flash.a.toFixed(3);
    const bossAlive = sim.enemies.some((e) => e.tier === 'boss' || e.tier === 'miniboss');
    // the red edge: a boss spawn / phase spike swells in (never a red flash; none with Flashes &
    // shake off), then the slow pulse while a boss is on the board
    bossVignette = Math.max(0, bossVignette - d * 0.8);
    const pulse = bossAlive ? 0.2 + 0.08 * Math.sin(time * 2.4) : 0;
    vignetteA = vignetteStep(vignetteA, Math.max(pulse, hitEffectsOn() ? bossVignette : 0), d);
    vignetteEl.style.opacity = (reduceMotion ? vignetteA * 0.5 : vignetteA).toFixed(3);

    renderer.info.reset();
    impact.begin();
    if (composer) composer.render(d);
    else renderer.render(scene, camera);
    if (impact.active) {
      impact.end();
      const glow = impact.active ? null : feel.takeAfterglow();
      if (glow) tint(glow.color, glow.a, glow.decay, glow.rise);
    }
    return events;
  }

  /** Enemy tier from its id (a 'death' whose view is already gone). */
  function enemyTier(id) {
    try {
      return sim.data?.enemy?.(id)?.tier || null;
    } catch {
      return null;
    }
  }

  /** Where a bark chip stands: over its unit while it walks (the chip follows it), else where it was. */
  let barkRect = null;
  const barkPt = { x: 0, y: 0, visible: false };
  function barkPoint(c) {
    const p = c.uid != null ? actors.enemyPos(c.uid) : null;
    if (p) projectInto(barkPt, p.x, p.z, p.y + (p.height || 0.5) + 0.25, barkRect);
    else projectInto(barkPt, c.x, c.z, 0.8, barkRect);
    return barkPt.visible ? barkPt : null;
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
    // the ground plane, or a rooftop's top first (Gate Arc 'U' tiles: boardInput.js boardPoint)
    const hit = terrain.roofs ? boardPoint(raycaster.ray, terrain.roofAt, ROOF_Y) : raycaster.ray.intersectPlane(plane, hitP) && { x: hitP.x, y: hitP.z };
    let x = null;
    let y = null;
    let tx = -999;
    let ty = -999;
    if (hit) {
      x = hit.x;
      y = hit.y;
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
        const s = projectPx(t.x, t.y, 0.45 + (terrain.roofAt?.(t.x, t.y) || 0), rect);
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
    return projectInto({ x: 0, y: 0, visible: false }, x, y, z, rect);
  }

  /** projectPx into a caller's point object (per-frame callers reuse one). */
  function projectInto(out, x, y, z, rect = canvas.getBoundingClientRect()) {
    tmpV.set(x, z, y).project(camera);
    out.x = (tmpV.x + 1) / 2 * rect.width;
    out.y = (1 - tmpV.y) / 2 * rect.height;
    out.visible = tmpV.z > -1 && tmpV.z < 1;
    return out;
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
    /** The gate props' feet (terrain.gates: { kind: 'spawn'|'goal', x, z, dir }; read-only): the toast feed keeps off them. */
    get gates() {
      return terrain.gates;
    },
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
    /**
     * Extra: hit-stop — holds everything drawn for up to 60 ms of frame time (the battle keeps
     * running; Reduce Motion: ignored). @returns {number} the freeze left (0 = refused)
     */
    hitStop(seconds) {
      return clock.hitStop(seconds);
    },
    /** Extra: the visual clock's state (read-only copy; e2e, captures, debugging). */
    get visualClock() {
      return clock.snapshot();
    },
    /**
     * Extra: what the hit-effect layer did (read-only copy; e2e, captures, debugging): freezes
     * granted / refused, impact frames played / refused, flashes the guard turned down, halos drawn
     * last frame, the shake (CSS px) and zoom punch on screen now, the bloom / grade in use.
     */
    get vfx() {
      return {
        tier: quality, hitEffects: hitEffectsOn(), impactFrames: impactFramesOn(), reduceMotion, glow: composer ? 'bloom' : fx.halo.cfg ? 'halo' : 'none',
        hitStops: director.granted, hitStopsRefused: director.refused, busy: director.busy,
        holds: holds.granted, holdsRefused: holds.refused,
        impacts: feel.stats.impacts, impactsRefused: feel.stats.impactsRefused, impactActive: impact.active, softTints: feel.stats.softTints,
        shakes: feel.stats.shakes, punches: feel.stats.punches,
        flashesRefused: flashGuard.refused, flashesOff: feel.stats.flashesOff, flashOpacity: Math.round(flash.a * 1000) / 1000,
        flashLoad: Math.round(flashGuard.load(clock.realT) * 1000) / 1000, worldFlashes: flashGuard.worldCount, worldFlashesDimmed: flashGuard.dimmed,
        halos: fx.halos + (attackFx?.stats().halos || 0),
        shakePx: Math.round(Math.hypot(rig.shakePx.x, rig.shakePx.y) * 100) / 100, trauma: Math.round(rig.trauma * 1000) / 1000, punchZoom: Math.round(rig.punchZoom * 10000) / 10000,
        bloom: bloomPass ? { strength: bloomPass.strength, radius: bloomPass.radius, threshold: bloomPass.threshold, knee: bloomPass.highPassUniforms.smoothWidth.value, hdr: batches.bbA.hdr } : null,
        grade: composer ? look.theme + (look.night ? '+night' : '') + (look.fog ? '+fog' : '') : null,
      };
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
    /**
     * Extra (dev tooling, allocates): the linear brightness of this frame before bloom, drawn into a
     * small float target — the share of pixels whose luminance passes each level, the 99th
     * percentile and the peak. `effects: false` leaves the effect batches out (the lit scene alone):
     * how the bloom threshold is chosen (docs/VFX.md §M1).
     */
    hdrProbe({ effects = true, levels = [0.84, 0.96, 1, 1.36, 2] } = {}) {
      const w = 320;
      const h = Math.max(1, Math.round((w * (rig.viewH || 1)) / (rig.viewW || 1)));
      const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: true });
      const hidden = [];
      if (!effects) for (const b of batchList) if (b.material.blending === THREE.CustomBlending && b.mesh.visible) { b.mesh.visible = false; hidden.push(b.mesh); }
      const prev = renderer.getRenderTarget();
      try {
        renderer.setRenderTarget(rt);
        renderer.clear();
        renderer.render(scene, camera);
        const buf = new Uint16Array(w * h * 4);
        renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf);
        const half = (u) => {
          const e = (u >> 10) & 31;
          const m = u & 1023;
          const v = e === 0 ? m * 2 ** -24 : e === 31 ? Infinity : (1 + m / 1024) * 2 ** (e - 15);
          return u & 0x8000 ? -v : v;
        };
        const lum = new Float32Array(w * h);
        for (let i = 0; i < w * h; i++) lum[i] = 0.2126 * half(buf[i * 4]) + 0.7152 * half(buf[i * 4 + 1]) + 0.0722 * half(buf[i * 4 + 2]);
        const sorted = Array.from(lum).sort((a, b) => a - b);
        const over = {};
        for (const l of levels) over[l] = Math.round((sorted.filter((v) => v > l).length / sorted.length) * 1e5) / 1e5;
        return { pixels: sorted.length, effects, over, p99: sorted[Math.floor(sorted.length * 0.99)], p999: sorted[Math.floor(sorted.length * 0.999)], max: sorted[sorted.length - 1] };
      } finally {
        renderer.setRenderTarget(prev);
        for (const m of hidden) m.visible = true;
        rt.dispose();
      }
    },

    /** Extra: Iroha's mirror panels (flips, glints, afterimages) for e2e / debug (allocates). */
    mirrorProbe() {
      return roster.mirrors.probe();
    },

    /** Extra (e2e / previews; display only): show Mirror Shift's echo on her panel for `seconds` of sim time. */
    previewMirrorShift(uid, seconds = 8) {
      roster.mirrors.previewShift(uid, seconds);
    },

    /** Extra: companion actors (Kon, Kaze, the doll) for e2e / debug (allocates). */
    companionsProbe() {
      return companions.probe();
    },

    /** Test / e2e probe: the sky dragon meshes drawn this frame ({ heads, beads, tails }). */
    rosterProbe() {
      return roster.probe();
    },

    /** Extra: the outfit (skin id) a placed girl's model wears, or null before it is drawn (e2e / debug). */
    towerSkin(uid) {
      return actors.towers.get(uid)?.model.userData.skinId ?? null;
    },
    /** Extra: a placed girl's model (e2e / debug: GLB or procedural, detail, hand props such as Tenka's coilgun). */
    towerModel(uid) {
      return actors.towers.get(uid)?.model ?? null;
    },
    /**
     * Extra: what a placed girl's figure is (e2e / debug): a duo's members, whether every part is a GLB or a
     * stand-in, her drawn facing (rad) and whether it keeps to the camera (src/render/facing.js); a duo's FX anchors
     * (world [x, y, z]: Kohaku's lens, Tsubaki's muzzle, src/models/duo.js).
     */
    towerModelInfo(uid) {
      const v = actors.towers.get(uid);
      const ud = v?.model.userData;
      if (!ud) return null;
      const at = (p) => (p ? [+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)] : null);
      return {
        duo: !!ud.duo, members: ud.memberIds || null, glb: ud.duo ? !!ud.isGlb?.() : !!ud.glb, height: ud.height ?? null,
        standIn: ud.duo ? !!ud.isStandIn?.() : !!ud.standIn, facing: v.facing, faceCam: !!v.faceCam, cameraYaw: rig.yaw,
        ...(ud.anchors ? { anchors: { lens: at(ud.anchors.lens), muzzle: at(ud.anchors.muzzle) } } : null),
      };
    },
    /** Extra: read-only info for debugging / previews. */
    get info() {
      return {
        quality, theme: look.theme, night: look.night, fog: look.fog, weather: look.weather, scenery: scenery.keywords, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, attackFx: attackFx?.stats() ?? null, blackout: blackout.enabled ? blackout.dim : null,
        district: look.district || null, ruined: look.ruined || null, tear: tear.enabled ? tear.level : null, barks: { left: barks.sides.left?.text ?? null, right: barks.sides.right?.text ?? null },
        // Gate Arc S4a: the dusk / frost looks, and each checkpoint barrier's arm ('down' while its lane is shut)
        dusk: !!look.dusk, frost: !!look.frost, barriers: terrain.barriers.map((b) => (b.target === 0 ? 'down' : 'up')),
      };
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
      impact.dispose();
      hitSource.clear();
      bouncing.clear();
      if (composer) {
        composer.dispose();
        bloomPass?.dispose();
        gradePass?.dispose();
      }
      key.shadow.map?.dispose();
      renderer.dispose();
      canvas.remove();
      barkChips?.dispose();
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

const fxColCache = new Map();
/** Cached hit-flash colour for an effect colour: half way to white (bright, but still its hue). */
function fxCol(hex) {
  let c = fxColCache.get(hex);
  if (!c) {
    c = new THREE.Color(hex).lerp(WHITE_FLASH, 0.35);
    fxColCache.set(hex, c);
  }
  return c;
}
