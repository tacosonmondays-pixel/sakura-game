// Ambient life of a battlefield: weather (petals, snow, rain, embers), drifting fog banks,
// cloud shadows, wind gusts that move the foliage, butterflies and birds by day, fireflies
// and lantern light pools by night, koi + fish ripples in ponds, snow sparkle, prop glows
// that flicker, prop emitters (chimney smoke, vents, campfires, bog wisps, fountains,
// fireworks) and the bouncing arrows + glowing discs at the spawn / goal gates. On the campus:
// the searchlights' beams sweeping the lake (terrain.searchlights, ground quads: 0 draw calls) and
// fireflies over the reeds. `dim` (blackout dimming, src/render/blackout.js) scales the prop glows,
// light pools and beams; the gates' glows (`keep`) and the fireflies stay.
// The burning look (Gate Arc S3a, look.ruined): ash falling with a few amber embers (weather 'ash'),
// smoke columns rising from the skirt that fade out within 2 tiles of height (emitter
// 'smokeColumn'), amber embers over the fires, scorch marks on the ground. HAMMER's tear: its glow
// sprites and crackling sparks ('tearSparks') follow `tear` (src/render/tear.js: 0 rest … 1 pulse).
// Gate Arc S4a: snow blowing out of the highway bores ('snowGust', one reused spawn description) and
// the far north's vast shadow crossing the board once a minute (terrain ambient 'vastShadow').
// Gate Arc S5a: water dripping off the Drowned Line's tunnel mouths and vent shafts with a ripple where
// it lands ('drip'), the steam valves' columns ('steamColumn'), the red emergency lamps pulsing (glows
// with `pulse`: slow by day, quick and strong while a blackout dims everything else; they keep their
// light), the reservoir's search boats sweeping their beams (terrain.searchlights, as the campus's),
// fireflies over the reservoir at night (terrain ambient 'fireflies'). All on reused spawn descriptions.
// Gate Arc S6a (Vesperline): dark snow falling out of the Vesper Gate ('darkSnow', one reused description), a
// cold aurora over the back skirt (terrain ambient 'aurora': a few soft additive bands, built once), frost haze
// creeping low over the board (terrain ambient 'frostHaze': pale wisps, built per density); the holo signs'
// flicker is their sprites' own (vesperProps.js). Snow is the shipped weather.
import * as THREE from 'three';
import { WATER_Y, PATH_H } from './terrain.js';
import { createVisualRandom, visualSeed } from './vfx/random.js';
import { SMOKE_PUFF } from './city/ruinProps.js';
import { GROUND } from './fx.js';

const TAU = Math.PI * 2;

/**
 * Vesperline's cold aurora (Gate Arc S6a, terrain ambient 'aurora'): soft additive bands high over the back skirt
 * (fx across the board's width, z behind its far edge), teal, green and violet, swaying slowly. Five quads.
 */
export const AURORA = Object.freeze({
  bands: Object.freeze([
    { fx: 0.15, y: 3.4, z: -4.6, w: 7.5, h: 1.3, rot: 0.08, color: '#5fe8d0', a: 0.16 },
    { fx: 0.4, y: 3.8, z: -5.2, w: 8.5, h: 1.1, rot: -0.05, color: '#7fe9a8', a: 0.14 },
    { fx: 0.62, y: 3.5, z: -4.8, w: 7.0, h: 1.4, rot: 0.06, color: '#9a7fff', a: 0.15 },
    { fx: 0.85, y: 3.9, z: -5.4, w: 8.0, h: 1.0, rot: -0.07, color: '#5fd6ea', a: 0.13 },
    { fx: 0.5, y: 4.3, z: -6.0, w: 12, h: 0.9, rot: 0, color: '#b9a8ff', a: 0.1 },
  ]),
});
const BUTTERFLY_COLORS = ['#ffffff', '#ffe066', '#9fd8ff', '#ffb3cf', '#c4a6ff', '#ffa94d'];

export class AmbientSystem {
  /**
   * @param {{ map, look, terrain, fx: import('./fx.js').FxSystem, batches, atlas, rand?: () => number }} o
   *   rand: the renderer's seeded visual random stream for this layer (default: seeded by the map)
   */
  constructor({ map, look, terrain, fx, batches, atlas, rand = null }) {
    this.map = map;
    this.look = look;
    this.terrain = terrain;
    this.fx = fx;
    this.b = batches;
    this.R = atlas.regions;
    this.time = 0;
    this.density = 1;
    this.enabled = true;
    // seeded render-only randomness (src/render/vfx/random.js): the same map gives the same weather
    this.rand = rand || createVisualRandom(visualSeed('ambient', map.id));
    this.vol = { x0: -2, x1: map.width + 2, z0: -2, z1: map.height + 2 };
    this.weather = look.weather || null;
    this.life = look.life || {};
    this.particles = [];
    this.mist = [];
    this.flies = [];
    this.koi = [];
    this.butterflies = [];
    this.clouds = [];
    this.flocks = [];
    this.glows = terrain.glows;
    this.searchlights = terrain.searchlights || [];
    /** Blackout dim level (1 = lit; the battle renderer eases it while a blackout rule is active). */
    this.dim = 1;
    /** The tear's pulse level (0 at rest … 1 while the rule pulses; src/render/tear.js). */
    this.tear = 0;
    // embers: the burning look's amber (never an oni's red), else the shipped orange
    this._ember = look.emberColor ? new THREE.Color(look.emberColor) : new THREE.Color().setRGB(1, 0.45, 0.12);
    this._beam = new THREE.Color('#eaf2ff');
    this.gates = terrain.gates || [];
    this.marks = terrain.marks || [];
    this.emitters = terrain.emitters.map((e) => ({ ...e, timer: this.rand() * 2 }));
    this.waterTiles = terrain.waterTiles || [];
    if (!terrain.waterTiles) {
      for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (terrain.isWater(x, y) && !terrain.isPath(x, y)) this.waterTiles.push([x, y]);
    }
    this.fireworkTimer = 2;
    this.birdTimer = 4 + this.rand() * 6;
    this.rippleTimer = 1;
    this.gust = { t: 3 + this.rand() * 4, phase: 99, strength: 1, value: 0 };
    this._c = new THREE.Color();
    // the far north's vast shadow (terrain ambient 'vastShadow', Gate Arc 4-9): something huge
    // passing high over the valley once a minute, as a cloud shadow would (never shown, never named)
    this.vastShadow = this.terrain.ambient?.has?.('vastShadow') ? { period: 60, cross: 14, t0: 20 } : null;
    /** one reused spawn description for the snow gusts out of the highway bores (no allocation per puff) */
    this._gust = { batch: 'bbN', uv: this.R.snow, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: -0.15, drag: 0.6, s0: 0.07, s1: 0.04, life: 1.6, color: new THREE.Color('#ffffff'), a0: 0.85, a1: 0, rot: 0, vrot: 1.5 };
    // reused spawn descriptions for the Drowned Line: a falling drop, its ripple (fading in as the drop
    // lands), a puff of a steam valve's column
    this._drop = { batch: 'bbN', uv: this.R.dot, x: 0, y: 0, z: 0, vx: 0, vy: -0.2, vz: 0, g: -6, s0: 0.05, s1: 0.04, life: 0.3, color: new THREE.Color('#d6ecf4'), a0: 0.9, a1: 0.7 };
    this._ripple = { batch: 'groundN', uv: this.R.ring, x: 0, y: 0, z: 0, s0: 0.06, s1: 0.7, life: 0.9, color: new THREE.Color('#e8f4f8'), a0: 0.45, a1: 0, fadeIn: 0.28, flags: GROUND };
    this._column = { batch: 'bbN', uv: this.R.smoke, x: 0, y: 0, z: 0, vx: 0, vy: 0.95, vz: 0, drag: 0.35, s0: 0.24, s1: 0.95, life: 1.6, color: new THREE.Color('#f2f6f8'), a0: 0.55, a1: 0, fadeIn: 0.2, rot: 0, vrot: 0.4 };
    // Vesperline: a flake of the Vesper Gate's dark snow (reused); the aurora's bands (built once)
    this._darkSnow = { batch: 'bbN', uv: this.R.snow, x: 0, y: 0, z: 0, vx: 0, vy: -0.3, vz: 0, g: -0.05, drag: 0.4, s0: 0.08, s1: 0.06, life: 2.2, color: new THREE.Color('#2a2140'), a0: 0.95, a1: 0, rot: 0, vrot: 1.2 };
    this.aurora = this.terrain.ambient?.has?.('aurora') ? AURORA.bands.map((b, i) => ({ ...b, x: map.width * b.fx, color: new THREE.Color(b.color), ph: i * 1.7 })) : [];
    this._gateColors = new Map();
    /** a wave walks the other way than the terrain's gates show (Rear Ambush's even waves) */
    this.gatesReversed = false;
    /** the road's travel direction against the map's tracks (Reverse Route XOR an ambush wave) */
    this.chevronsReversed = false;
    this.build();
  }

  setQuality(q) {
    const d = q === 'high' ? 1 : q === 'medium' ? 0.6 : 0.25;
    if (d !== this.density) {
      this.density = d;
      this.build();
    }
  }

  build() {
    const { x0, x1, z0, z1 } = this.vol;
    const area = (x1 - x0) * (z1 - z0);
    const r = this.rand;
    this.particles = [];
    const w = this.weather;
    const count = (base) => Math.round(base * this.density * area / 300);
    if (w === 'petals' || this.terrain.ambient.has('feathers')) {
      const feathers = w !== 'petals';
      // (the city mixes paper litter into the petals: look.weatherColors)
      const pinks = feathers ? ['#ffffff', '#f4f0ff'] : (this.look.weatherColors || ['#ffc2d8', '#ffb3cf', '#ffd6e6', '#ff9ec4']);
      for (let i = 0; i < count(80); i++) {
        this.particles.push({
          kind: 'petal', x: x0 + r() * (x1 - x0), y: r() * 4, z: z0 + r() * (z1 - z0), vy: -(0.3 + r() * 0.25),
          ph: r() * TAU, rot: r() * TAU, vrot: (r() - 0.5) * 3, s: 0.09 + r() * 0.06, color: new THREE.Color(pinks[i % pinks.length]),
        });
      }
    }
    if (w === 'snow') {
      for (let i = 0; i < count(140); i++) {
        this.particles.push({ kind: 'snow', x: x0 + r() * (x1 - x0), y: r() * 4, z: z0 + r() * (z1 - z0), vy: -(0.45 + r() * 0.35), ph: r() * TAU, s: 0.05 + r() * 0.06 });
      }
    }
    if (w === 'rain') {
      for (let i = 0; i < count(170); i++) {
        this.particles.push({ kind: 'rain', x: x0 + r() * (x1 - x0), y: r() * 5, z: z0 + r() * (z1 - z0), vy: -(8 + r() * 3), s: 0.3 + r() * 0.2 });
      }
    }
    if (w === 'embers') {
      for (let i = 0; i < count(50); i++) {
        this.particles.push({ kind: 'ember', x: x0 + r() * (x1 - x0), y: r() * 3, z: z0 + r() * (z1 - z0), vy: 0.25 + r() * 0.35, ph: r() * TAU, s: 0.04 + r() * 0.05 });
      }
    }
    if (w === 'ash') {
      // ash drifting down over the burning city, and a few amber embers rising through it
      for (let i = 0; i < count(90); i++) {
        this.particles.push({ kind: 'ash', x: x0 + r() * (x1 - x0), y: r() * 4, z: z0 + r() * (z1 - z0), vy: -(0.18 + r() * 0.16), ph: r() * TAU, s: 0.04 + r() * 0.04, k: 0.75 + r() * 0.3 });
      }
      for (let i = 0; i < count(18); i++) {
        this.particles.push({ kind: 'ember', x: x0 + r() * (x1 - x0), y: r() * 3, z: z0 + r() * (z1 - z0), vy: 0.25 + r() * 0.35, ph: r() * TAU, s: 0.035 + r() * 0.035 });
      }
    }
    // fog banks
    this.mist = [];
    if (this.look.fog) {
      const n = Math.max(5, Math.round(11 * this.density));
      for (let i = 0; i < n; i++) {
        this.mist.push({ x: x0 + r() * (x1 - x0), z: z0 + r() * (z1 - z0), y: 0.25 + r() * 0.5, s: 3 + r() * 3.5, v: 0.12 + r() * 0.15, ph: r() * TAU, rot: r() * TAU });
      }
    }
    // frost haze creeping low over the board (Vesperline, terrain ambient 'frostHaze')
    this.haze = [];
    if (this.terrain.ambient?.has?.('frostHaze')) {
      const n = Math.max(4, Math.round(10 * this.density));
      for (let i = 0; i < n; i++) {
        this.haze.push({ x: x0 + r() * (x1 - x0), z: z0 + 1 + r() * (z1 - z0 - 2), y: 0.12 + r() * 0.18, s: 1.6 + r() * 1.8, v: 0.08 + r() * 0.1, ph: r() * TAU, rot: r() * TAU });
      }
    }
    // fireflies at night (not in hot / industrial places)
    this.flies = [];
    this.flyColor = this.look.fireflyColor ? new THREE.Color(this.look.fireflyColor) : new THREE.Color(0.8, 1, 0.45);
    if (this.look.night && this.life.fireflies !== false && (this.look.lantern || (this.look.theme !== 'foundry' && this.look.theme !== 'volcano'))) {
      const n = Math.round(26 * this.density);
      for (let i = 0; i < n; i++) {
        this.flies.push({ x: x0 + r() * (x1 - x0), z: z0 + r() * (z1 - z0), y: 0.3 + r() * 1.0, ph: r() * TAU, sp: 0.3 + r() * 0.4 });
      }
      // the `fireflies` keyword (the campus lakeshore): more of them, low over the water's edge
      if (this.terrain.ambient.has('fireflies') && this.waterTiles.length) {
        for (let i = 0; i < Math.round(18 * this.density); i++) {
          const [tx, ty] = this.waterTiles[Math.floor(r() * this.waterTiles.length)];
          this.flies.push({ x: tx + r(), z: ty + r(), y: 0.15 + r() * 0.5, ph: r() * TAU, sp: 0.2 + r() * 0.3 });
        }
      }
    }
    // butterflies by day on living ground
    this.butterflies = [];
    if (this.life.butterflies && !this.look.night) {
      const n = Math.round((4 + area / 70) * this.density);
      for (let i = 0; i < n; i++) {
        this.butterflies.push({
          x: x0 + 1 + r() * (x1 - x0 - 2), z: z0 + 1 + r() * (z1 - z0 - 2), y: 0.35 + r() * 0.5, h: r() * TAU, turn: 0,
          sp: 0.5 + r() * 0.5, ph: r() * TAU, s: 0.12 + r() * 0.06, color: new THREE.Color(BUTTERFLY_COLORS[i % BUTTERFLY_COLORS.length]),
        });
      }
    }
    // cloud shadows by day
    this.clouds = [];
    if (this.life.clouds && !this.look.night && !this.look.fog) {
      const n = Math.max(2, Math.round(3 * this.density));
      for (let i = 0; i < n; i++) {
        this.clouds.push({ x: x0 + r() * (x1 - x0), z: z0 + r() * (z1 - z0), w: 6 + r() * 5, h: 4 + r() * 3, rot: r() * TAU, v: 0.25 + r() * 0.15, a: 0.07 + r() * 0.05 });
      }
    }
    // koi
    this.koi = [];
    if ((this.terrain.ambient.has('koi') || this.life.koi) && this.waterTiles.length >= 4) {
      const n = Math.min(8, Math.max(3, Math.round(this.waterTiles.length / 8)));
      for (let i = 0; i < n; i++) {
        const [tx, ty] = this.waterTiles[Math.floor(r() * this.waterTiles.length)];
        this.koi.push({ cx: tx + 0.5, cz: ty + 0.5, r: 0.25 + r() * 0.2, ph: r() * TAU, sp: (0.6 + r() * 0.5) * (r() > 0.5 ? 1 : -1), color: new THREE.Color(['#ff8a3d', '#ffffff', '#ff5a4a', '#ffd43b'][i % 4]) });
      }
    }
    if (this.terrain.waterMaterial) this.terrain.waterMaterial.uniforms.uMoon.value = this.terrain.ambient.has('moon') && this.look.night ? 1 : 0;
  }

  update(dt, occupiedWater) {
    this.time += dt;
    const t = this.time;
    const R = this.R;
    const { x0, x1, z0, z1 } = this.vol;
    const bbN = this.b.bbN;
    const bbA = this.b.bbA;
    const gN = this.b.groundN;
    const gA = this.b.groundA;

    // ----- wind gusts (drive the foliage shader + push the petals) -----------------------
    const gu = this.gust;
    gu.t -= dt;
    if (gu.t <= 0) {
      gu.t = 5 + this.rand() * 6;
      gu.phase = 0;
      gu.strength = 0.6 + this.rand() * 0.6;
    }
    gu.phase += dt;
    const env = gu.phase < 2.4 ? Math.sin((gu.phase / 2.4) * Math.PI) : 0;
    gu.value = env * env * gu.strength;
    this.terrain.setWind?.(this.enabled ? gu.value : 0);
    const wind = Math.sin(t * 0.3) * 0.25 + 0.35 + gu.value * 1.2;

    if (this.enabled) {
      for (const p of this.particles) {
        p.y += p.vy * dt;
        if (p.kind === 'petal') {
          p.x += (wind + Math.sin(t * 1.3 + p.ph) * 0.3) * dt;
          p.z += Math.cos(t * 0.9 + p.ph) * 0.15 * dt;
          p.rot += p.vrot * dt;
          if (p.y < 0.02) this._respawnTop(p, 3.8);
          const flip = 0.35 + 0.65 * Math.abs(Math.sin(t * 2 + p.ph));
          bbN.push(p.x, p.y, p.z, p.s * flip, p.s, R.petal, p.color.r, p.color.g, p.color.b, 0.95, p.rot);
        } else if (p.kind === 'snow') {
          p.x += (Math.sin(t * 0.8 + p.ph) * 0.2 + wind * 0.3) * dt;
          if (p.y < 0.02) this._respawnTop(p, 4);
          bbN.push(p.x, p.y, p.z, p.s, p.s, R.snow, 1, 1, 1, 0.9);
        } else if (p.kind === 'rain') {
          p.x += 1.2 * dt;
          if (p.y < 0.02) {
            if (this.rand() < 0.25 * this.density) this.fx.ring(p.x, p.z, 0.02, 0.12, 0.3, '#dfefff', { additive: false, uv: 'ring', y: 0.07, a0: 0.5 });
            this._respawnTop(p, 5);
          }
          bbN.push(p.x, p.y, p.z, 0.025, p.s, R.rain, 0.85, 0.9, 1, 0.55, 0.12);
        } else if (p.kind === 'ember') {
          p.x += (Math.sin(t * 1.7 + p.ph) * 0.3 + wind * 0.2) * dt;
          if (p.y > 3.2) {
            p.y = 0;
            p.x = x0 + this.rand() * (x1 - x0);
            p.z = z0 + this.rand() * (z1 - z0);
          }
          const fl = 0.55 + 0.45 * Math.sin(t * 7 + p.ph);
          const ec = this._ember;
          bbA.push(p.x, p.y, p.z, p.s, p.s, R.glow, ec.r, ec.g, ec.b, fl * Math.min(1, (3.2 - p.y)));
        } else if (p.kind === 'ash') {
          p.x += (Math.sin(t * 0.6 + p.ph) * 0.18 + wind * 0.2) * dt;
          p.z += Math.cos(t * 0.5 + p.ph) * 0.08 * dt;
          if (p.y < 0.02) this._respawnTop(p, 4);
          bbN.push(p.x, p.y, p.z, p.s, p.s * 0.8, R.snow, 0.6 * p.k, 0.58 * p.k, 0.56 * p.k, 0.8, t * 0.5 + p.ph);
        }
        if (p.x > x1) p.x = x0;
        if (p.x < x0) p.x = x1;
      }
      for (const m of this.mist) {
        m.x += m.v * dt;
        if (m.x - m.s > x1) m.x = x0 - m.s;
        const a = 0.075 + 0.035 * Math.sin(t * 0.4 + m.ph);
        const c = this._c.set(this.look.fogColor || '#e8eef4');
        bbN.push(m.x, m.y, m.z, m.s * 1.6, m.s, R.smoke, c.r, c.g, c.b, a, m.rot);
      }
      for (const hz of this.haze) {
        hz.x += hz.v * dt;
        if (hz.x - hz.s > x1) hz.x = x0 - hz.s;
        const a = 0.07 + 0.04 * Math.sin(t * 0.5 + hz.ph);
        bbN.push(hz.x, hz.y, hz.z, hz.s * 1.8, hz.s * 0.7, R.smoke, 0.88, 0.93, 0.98, a, hz.rot);
      }
      // the cold aurora over the back skirt: soft bands swaying slowly, never over the board
      for (const au of this.aurora) {
        const sway = Math.sin(t * 0.13 + au.ph);
        const a = au.a * (0.65 + 0.35 * Math.sin(t * 0.21 + au.ph * 2));
        const c = au.color;
        bbA.push(au.x + sway * 0.8, au.y + Math.sin(t * 0.17 + au.ph) * 0.15, au.z, au.w, au.h, R.soft, c.r, c.g, c.b, a, au.rot + sway * 0.05);
      }
      // (lantern nights: warm orange lantern sparks drifting a little higher)
      const fc = this.flyColor;
      for (const f of this.flies) {
        const x = f.x + Math.sin(t * f.sp + f.ph) * 0.8;
        const z = f.z + Math.cos(t * f.sp * 0.7 + f.ph) * 0.8;
        const y = f.y + Math.sin(t * 1.7 + f.ph) * 0.2;
        const a = Math.max(0, Math.sin(t * 1.3 + f.ph * 3));
        bbA.push(x, y, z, 0.16, 0.16, R.glow, fc.r, fc.g, fc.b, a);
      }
      // the vast shadow: one long soft dark shape crossing the board from west to east, once a minute
      if (this.vastShadow) {
        const vs = this.vastShadow;
        const k = ((t + vs.t0) % vs.period) / vs.cross;
        if (k < 1) {
          const span = x1 - x0 + 16;
          const x = x0 - 8 + span * k;
          const z = (z0 + z1) / 2 + Math.sin(k * 3) * 1.2;
          const a = 0.2 * Math.sin(k * Math.PI);
          gN.push(x, 0.016, z, 13, 6.5, R.smoke, 0.02, 0.03, 0.08, a, 0.25);
          gN.push(x - 3.5, 0.017, z + 1.4, 7, 3.2, R.smoke, 0.02, 0.03, 0.08, a * 0.8, -0.4);
          gN.push(x + 3.2, 0.017, z - 1.6, 7, 3.0, R.smoke, 0.02, 0.03, 0.08, a * 0.8, 0.6);
        }
      }
      // cloud shadows drifting across the board
      for (const c of this.clouds) {
        c.x += c.v * dt;
        if (c.x - c.w / 2 > x1 + 2) {
          c.x = x0 - c.w / 2 - 2;
          c.z = z0 + this.rand() * (z1 - z0);
        }
        gN.push(c.x, 0.015, c.z, c.w, c.h, R.smoke, 0.02, 0.04, 0.12, c.a, c.rot);
      }
      // butterflies: wandering flutter, flapping wings
      for (const bf of this.butterflies) {
        bf.turn += (this.rand() - 0.5) * 6 * dt;
        bf.turn *= 0.96;
        bf.h += bf.turn * dt + Math.sin(t * 0.7 + bf.ph) * 0.4 * dt;
        bf.x += Math.cos(bf.h) * bf.sp * dt;
        bf.z += Math.sin(bf.h) * bf.sp * dt;
        if (bf.x < x0 + 0.5 || bf.x > x1 - 0.5) bf.h = Math.PI - bf.h;
        if (bf.z < z0 + 0.5 || bf.z > z1 - 0.5) bf.h = -bf.h;
        bf.x = Math.max(x0 + 0.5, Math.min(x1 - 0.5, bf.x));
        bf.z = Math.max(z0 + 0.5, Math.min(z1 - 0.5, bf.z));
        const y = bf.y + Math.sin(t * 2.3 + bf.ph) * 0.12 + Math.sin(t * 9 + bf.ph) * 0.03;
        const flap = 0.3 + 0.7 * Math.abs(Math.cos(t * 16 + bf.ph));
        bbN.push(bf.x, y, bf.z, bf.s * flap, bf.s, R.butterfly, bf.color.r, bf.color.g, bf.color.b, 1, Math.sin(t * 3 + bf.ph) * 0.3);
        gN.push(bf.x, 0.02, bf.z, bf.s * 0.6, bf.s * 0.4, R.shadow, 0.05, 0.05, 0.1, 0.22);
      }
      // birds crossing in small flocks
      if (this.life.birds && !this.look.night) {
        this.birdTimer -= dt;
        if (this.birdTimer <= 0) {
          this.birdTimer = 14 + this.rand() * 16;
          this._spawnFlock();
        }
      }
      for (let i = this.flocks.length - 1; i >= 0; i--) {
        const fl = this.flocks[i];
        fl.x += fl.vx * dt;
        fl.z += fl.vz * dt;
        if (fl.x < x0 - 4 || fl.x > x1 + 4 || fl.z < z0 - 4 || fl.z > z1 + 4) {
          this.flocks.splice(i, 1);
          continue;
        }
        const rot = Math.atan2(-fl.vz, fl.vx);
        for (const m of fl.members) {
          const flap = 0.35 + 0.65 * Math.abs(Math.sin(t * 11 + m.ph));
          bbN.push(fl.x + m.ox, fl.y + Math.sin(t * 2 + m.ph) * 0.1, fl.z + m.oz, 0.3, 0.16 * flap, R.bird, fl.c.r, fl.c.g, fl.c.b, 0.9, rot * 0.15);
          gN.push(fl.x + m.ox + 0.6, 0.02, fl.z + m.oz + 0.3, 0.28, 0.12, R.shadow, 0.05, 0.05, 0.1, 0.12);
        }
      }
    }

    // koi, fish ripples and water sparkles
    for (const k of this.koi) {
      k.ph += k.sp * dt;
      const x = k.cx + Math.cos(k.ph) * k.r;
      const z = k.cz + Math.sin(k.ph) * k.r;
      const ang = k.ph + (k.sp > 0 ? Math.PI / 2 : -Math.PI / 2);
      gN.push(x, WATER_Y + 0.02, z, 0.26, 0.13, R.koi, k.color.r, k.color.g, k.color.b, 0.8, -ang);
    }
    if (this.waterTiles.length && this.enabled) {
      this.rippleTimer -= dt;
      if (this.rippleTimer <= 0) {
        this.rippleTimer = (0.6 + this.rand() * 1.2) / Math.max(0.3, this.density);
        const [tx, ty] = this.waterTiles[Math.floor(this.rand() * this.waterTiles.length)];
        const x = tx + 0.2 + this.rand() * 0.6;
        const z = ty + 0.2 + this.rand() * 0.6;
        this.fx.ring(x, z, 0.04, 0.55, 1.1, '#ffffff', { additive: false, uv: 'ring', y: WATER_Y + 0.02, a0: 0.4 });
        this.fx.ring(x, z, 0.02, 0.3, 0.7, '#ffffff', { additive: false, uv: 'ring', y: WATER_Y + 0.02, a0: 0.3 });
      }
    }
    if (this.terrain.ambient.has('sparkles') && this.waterTiles.length && this.rand() < dt * 6 * this.density) {
      const [tx, ty] = this.waterTiles[Math.floor(this.rand() * this.waterTiles.length)];
      this.fx.spawn({ batch: 'bbA', uv: R.spark, x: tx + this.rand(), y: WATER_Y + 0.1, z: ty + this.rand(), s0: 0.05, s1: 0.3, life: 0.5, color: ['#ffd1e3', '#bff0ff', '#fff3b0'][Math.floor(this.rand() * 3)], rot: this.rand() * 3 });
    }
    // snow sparkle on the ground
    if (this.life.sparkle && this.enabled) {
      const n = dt * 10 * this.density;
      for (let i = 0; i < n || this.rand() < n - Math.floor(n); i++) {
        if (i >= n + 1) break;
        const x = x0 + this.rand() * (x1 - x0);
        const z = z0 + this.rand() * (z1 - z0);
        if (this.terrain.isWater(Math.floor(x), Math.floor(z))) continue;
        this.fx.spawn({ batch: 'bbA', uv: R.spark, x, y: 0.06, z, s0: 0.04, s1: 0.2, life: 0.45, color: this.rand() > 0.5 ? '#ffffff' : '#dff0ff', rot: this.rand() * 3, a0: 0.9 });
      }
    }

    // prop glows (+ warm light pools on the ground at night)
    const night = this.look.night || this.look.fog;
    // dusk (stage.look.dusk): the lamps are on, between day and night, with their pools on the road
    const dusk = !night && !!this.look.dusk;
    const ga = night ? 0.6 : dusk ? 0.5 : 0.32;
    for (const g of this.glows) {
      if (g.owner && !g.owner.visible) continue;
      // a traffic signal: the lit lamp steps through its colours (city kit)
      if (g.cycle) g.color = this._cycleColor(g.cycle, t + (g.phase || 0));
      let fl = (1 - g.flicker * (0.5 + 0.5 * Math.sin(t * 9 + g.phase) * Math.sin(t * 3.7 + g.phase * 2))) * (g.keep ? 1 : this.dim);
      let s = g.size * (night ? 1.1 : dusk ? 1.0 : 0.8);
      // a red emergency lamp (the Drowned Line): a slow pulse, quick and strong in a blackout
      if (g.pulse) {
        const dark = this.dim < 1;
        fl *= dark ? 0.55 + 0.45 * Math.sin(t * 4.2 + g.phase) : 0.82 + 0.18 * Math.sin(t * 1.6 + g.phase);
        if (dark) s *= 1.25;
      }
      // the tear's glow swells while the rule pulses
      if (g.tear) {
        s *= 0.75 + 0.55 * this.tear;
        fl *= 0.6 + 0.5 * this.tear;
      }
      bbA.push(g.x, g.y, g.z, s, s, R.glow, g.color.r, g.color.g, g.color.b, ga * fl);
      if ((night || dusk) && g.y < 1.6 && g.size >= 0.4) gA.push(g.x, 0.02, g.z, s * 2.2, s * 2.2, R.soft, g.color.r, g.color.g, g.color.b, (night ? 0.16 : 0.12) * fl);
    }

    // searchlights (the campus): a soft beam across the water and the bright spot it sweeps
    if (night) {
      const c = this._beam;
      for (const sl of this.searchlights) {
        const u = 0.5 - 0.5 * Math.cos((t / sl.period) * TAU + sl.phase);
        const a = sl.a0 + (sl.a1 - sl.a0) * u;
        const dx = Math.sin(a);
        const dz = Math.cos(a);
        const rot = Math.atan2(-dz, dx);
        const k = this.dim;
        gA.push(sl.x + dx * sl.reach * 0.5, WATER_Y + 0.03, sl.z + dz * sl.reach * 0.5, sl.reach * 1.05, 0.8, R.soft, c.r, c.g, c.b, 0.3 * k, rot);
        gA.push(sl.x + dx * sl.reach, WATER_Y + 0.035, sl.z + dz * sl.reach, 2.1, 1.6, R.soft, c.r, c.g, c.b, 0.75 * k, rot);
      }
    }

    // emitters
    for (const e of this.emitters) {
      if (e.owner && !e.owner.visible) continue;
      if (occupiedWater && e.owner && occupiedWater.has(e.owner)) continue;
      e.timer -= dt * this.density;
      if (e.timer > 0) continue;
      this._emit(e);
    }

    // festival fireworks (any stage with firework posts)
    if (this.emitters.some((e) => e.kind === 'firework')) {
      this.fireworkTimer -= dt;
      if (this.fireworkTimer <= 0) {
        this.fireworkTimer = 2.5 + this.rand() * 3;
        const posts = this.emitters.filter((e) => e.kind === 'firework');
        const p = posts[Math.floor(this.rand() * posts.length)];
        this._firework(p.x, p.z);
      }
    }

    this.drawGates(t);
    this.drawMarks(t);
  }

  /** Painted ground marks: glowing rune circles under junctions, travel chevrons at flat junctions. */
  drawMarks(t) {
    if (!this.marks.length) return;
    const R = this.R;
    const gN = this.b.groundN;
    const gA = this.b.groundA;
    const c = this._c;
    for (const m of this.marks) {
      if (m.kind === 'rune') {
        c.set(m.color);
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.6);
        const D = m.r * 2;
        gN.push(m.x, PATH_H + 0.018, m.z, D * 1.04, D * 1.04, R.disc, 0.12, 0.06, 0.22, 0.32);
        gA.push(m.x, PATH_H + 0.026, m.z, D, D, R.rune, c.r, c.g, c.b, 0.5 + 0.25 * pulse, t * 0.18);
        gA.push(m.x, PATH_H + 0.03, m.z, D * 0.62, D * 0.62, R.rune, c.r, c.g, c.b, 0.3 + 0.2 * (1 - pulse), -t * 0.3);
        gA.push(m.x, PATH_H + 0.032, m.z, D * 1.12, D * 1.12, R.ringSoft, c.r, c.g, c.b, 0.18 + 0.12 * pulse);
      } else if (m.kind === 'zebra' || m.kind === 'stopLine' || m.kind === 'junctionBox') {
        // city crossings: white paint on the road (the quad's u runs across the road)
        const big = m.kind === 'junctionBox';
        const w = big ? 1.0 : m.kind === 'zebra' ? 0.86 : 0.86;
        const h = big ? 1.0 : m.kind === 'zebra' ? 0.34 : 0.06;
        gN.push(m.x, PATH_H + (big ? 0.014 : 0.018), m.z, w, h, R[m.kind], 0.96, 0.95, 0.92, big ? 0.55 : 0.88, m.rot);
      } else if (m.kind === 'cracks') {
        // the Petal Gate's cracks in the road: dark seams with a slow violet glow inside
        c.set(m.color);
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.4 + m.x);
        gN.push(m.x, PATH_H + 0.016, m.z, 1.5, 1.5, R.cracks, 0.12, 0.08, 0.16, 0.8, m.rot);
        gA.push(m.x, PATH_H + 0.022, m.z, 1.42, 1.42, R.cracks, c.r, c.g, c.b, 0.3 + 0.3 * pulse, m.rot);
      } else if (m.kind === 'scorch') {
        // the burning look: a burnt blotch on the ground (never on the road: ruinProps.burningLayer)
        gN.push(m.x, 0.02, m.z, 1.15, 1.15, R.scorch, 0.012, 0.01, 0.01, 0.72, m.rot);
      } else if (m.kind === 'chevron') {
        // a soft pulse runs along the road in its travel direction
        const rv = this.chevronsReversed;
        const k = 0.5 + 0.5 * Math.sin(t * 3.2 - (rv ? -m.d : m.d) * 2.4);
        const rot = rv ? m.rot + Math.PI : m.rot;
        gN.push(m.x, PATH_H + 0.016, m.z, 0.5, 0.5, R.chevron, 0.08, 0.1, 0.2, 0.22, rot);
        gN.push(m.x, PATH_H + 0.022, m.z, 0.44, 0.44, R.chevron, 1, 0.97, 0.88, 0.42 + 0.3 * k, rot);
      }
    }
  }

  /** Turns the gate arrows (relative to the terrain's gates) and the junction chevrons (absolute). */
  setGatesReversed(gates, chevrons = gates) {
    this.gatesReversed = !!gates;
    this.chevronsReversed = !!chevrons;
  }

  /** Bouncing arrows + glowing discs at every spawn / goal gate (cute, readable from afar). */
  drawGates(t) {
    const R = this.R;
    const gN = this.b.groundN;
    const gA = this.b.groundA;
    for (const g of this.gates) {
      let col = this._gateColors.get(g.color);
      if (!col) {
        col = new THREE.Color(g.color);
        this._gateColors.set(g.color, col);
      }
      const flip = this.gatesReversed;
      const dx = flip ? -g.dir[0] : g.dir[0];
      const dz = flip ? -g.dir[1] : g.dir[1];
      // ground quads turn by rot about +y with the texture's +u (the arrow tip) along
      // (cos rot, -sin rot) in xz: this points the tip along the road's travel direction
      const rot = Math.atan2(-dz, dx);
      const spawn = (g.kind === 'spawn') !== flip;
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.2 + (spawn ? 0 : 1.5));
      // glowing disc under the gate
      if (spawn) {
        gN.push(g.x, PATH_H + 0.016, g.z, 1.05, 1.05, R.disc, 0.3, 0.1, 0.4, 0.55);
        gA.push(g.x, PATH_H + 0.02, g.z, 0.95, 0.95, R.rune, col.r, col.g, col.b, 0.55 + 0.25 * pulse, t * 1.2);
        gA.push(g.x, PATH_H + 0.024, g.z, 0.62, 0.62, R.ringThick, col.r, col.g, col.b, 0.45, -t * 2);
      } else {
        gN.push(g.x, PATH_H + 0.016, g.z, 1.05, 1.05, R.disc, col.r, col.g, col.b, 0.35);
        const k = (t * 0.8) % 1;
        gA.push(g.x, PATH_H + 0.02, g.z, 0.5 + k * 1.1, 0.5 + k * 1.1, R.ringSoft, col.r, col.g, col.b, (1 - k) * 0.5);
      }
      // a chunky arrow hopping along the road: into the board at spawns, out of it at goals
      const hop = Math.abs(Math.sin(t * 3.4 + (spawn ? 0 : 1)));
      const slide = ((t * 0.9) % 1);
      const along = spawn ? 0.9 + slide * 1.1 : 0.2 + slide * 1.1;
      const ax = g.x + dx * along;
      const az = g.z + dz * along;
      const fadeA = Math.sin(slide * Math.PI);
      const y = PATH_H + 0.12 + hop * 0.22;
      gN.push(ax, 0.045, az, 0.62, 0.62, R.shadow, 0.05, 0.05, 0.12, 0.3 * (1 - hop * 0.5) * fadeA);
      gN.push(ax, y, az, 0.78, 0.78, R.arrow, col.r, col.g, col.b, fadeA, rot);
      // second, smaller arrow half a cycle behind
      const slide2 = ((t * 0.9 + 0.5) % 1);
      const along2 = spawn ? 0.9 + slide2 * 1.1 : 0.2 + slide2 * 1.1;
      const hop2 = Math.abs(Math.sin(t * 3.4 + 1.6 + (spawn ? 0 : 1)));
      gN.push(g.x + dx * along2, PATH_H + 0.1 + hop2 * 0.18, g.z + dz * along2, 0.6, 0.6, R.arrow, col.r, col.g, col.b, Math.sin(slide2 * Math.PI) * 0.85, rot);
    }
  }

  _spawnFlock() {
    const { x0, x1, z0, z1 } = this.vol;
    const r = this.rand;
    const fromLeft = r() > 0.5;
    const vx = (fromLeft ? 1 : -1) * (2.2 + r() * 1.2);
    const vz = (r() - 0.5) * 1.4;
    const members = [];
    const n = 3 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) members.push({ ox: -i * 0.42 * Math.sign(vx) + (r() - 0.5) * 0.2, oz: (i % 2 ? 1 : -1) * i * 0.3, ph: r() * TAU });
    // the city's birds are pigeons: grey, flying low over the roofs
    const city = !!this.look.city;
    const y = city ? 1.7 + r() * 0.4 : 2.6 + r() * 0.8;
    const col = this.look.night ? '#1d2b4f' : city ? '#7d828c' : '#3a4a6a';
    this.flocks.push({ x: fromLeft ? x0 - 3 : x1 + 3, z: z0 + 1 + r() * (z1 - z0 - 2), y, vx, vz, members, c: new THREE.Color(col) });
  }

  /** The colour a cycling glow shows at time t ({ colors, period }, colours cached). */
  _cycleColor(cy, t) {
    if (!cy._c) cy._c = cy.colors.map((h) => new THREE.Color(h));
    const k = Math.floor(((t % cy.period) / cy.period) * cy._c.length) % cy._c.length;
    return cy._c[k];
  }

  _respawnTop(p, h) {
    const { x0, x1, z0, z1 } = this.vol;
    p.y = h + this.rand() * 0.5;
    p.x = x0 + this.rand() * (x1 - x0);
    p.z = z0 + this.rand() * (z1 - z0);
  }

  _emit(e) {
    const fx = this.fx;
    const R = this.R;
    const r = this.rand;
    switch (e.kind) {
      case 'smoke':
        e.timer = 0.45;
        fx.spawn({ batch: 'bbN', uv: R.smoke, x: e.x, y: e.y, z: e.z, vx: 0.15 + this.gust.value * 0.4, vy: 0.45, drag: 0.3, s0: 0.25, s1: 0.9, life: 2.4, color: this.look.night ? '#6a7090' : '#d8d4d0', a0: 0.55, fadeIn: 0.3, rot: r() * TAU, vrot: 0.3 });
        break;
      case 'steam':
        e.timer = 0.5;
        fx.spawn({ batch: 'bbN', uv: R.smoke, x: e.x + (r() - 0.5) * 0.2, y: e.y, z: e.z + (r() - 0.5) * 0.2, vy: 0.5, vx: 0.05 + this.gust.value * 0.3, drag: 0.4, s0: 0.2, s1: 0.75, life: 1.8, color: '#ffffff', a0: 0.4, fadeIn: 0.3, rot: r() * TAU, vrot: 0.4 });
        break;
      case 'incense':
        e.timer = 0.35;
        fx.spawn({ batch: 'bbN', uv: R.soft, x: e.x, y: e.y, z: e.z, vy: 0.3, vx: 0.06, s0: 0.05, s1: 0.3, life: 2.2, color: '#d6d0e8', a0: 0.5, fadeIn: 0.4 });
        break;
      case 'embers':
        e.timer = 0.18;
        fx.spawn({ batch: 'bbA', uv: R.glow, x: e.x + (r() - 0.5) * 0.25, y: e.y, z: e.z + (r() - 0.5) * 0.25, vx: (r() - 0.5) * 0.3, vy: 0.8 + r() * 0.8, drag: 0.5, s0: 0.08, s1: 0.02, life: 1.2, color: e.color ? (r() > 0.5 ? e.color : '#ffd27a') : r() > 0.5 ? '#ff7a33' : '#ffc46b' });
        break;
      case 'smokeColumn':
        // the burning city's smoke from the skirt: dark puffs widening as they rise, gone within
        // 2 tiles of height (vy · life with the drag stays under 2), leaning away from the board
        e.timer = 0.32;
        fx.spawn({ batch: 'bbN', uv: R.smoke, x: e.x + (r() - 0.5) * 0.3, y: SMOKE_PUFF.y, z: e.z + (r() - 0.5) * 0.3, vx: 0.08 + this.gust.value * 0.15, vy: SMOKE_PUFF.vy, vz: -0.06, drag: SMOKE_PUFF.drag, s0: 0.45, s1: 1.5, life: SMOKE_PUFF.life, color: r() > 0.5 ? '#3b3638' : '#4a4446', a0: 0.6, a1: 0, fadeIn: 0.35, rot: r() * TAU, vrot: 0.25 });
        break;
      case 'tearSparks':
        // sparks crackling off the tear: a few at rest, a burst while the rule pulses
        e.timer = 0.5 / (0.35 + this.tear * 1.6);
        {
          const a = r() * TAU;
          const rad = (e.r || 0.6) * (0.2 + r() * 0.8);
          fx.spawn({ batch: 'bbA', uv: R.spark, x: e.x + Math.cos(a) * rad * 0.35, y: e.y + Math.sin(a) * rad, z: e.z, vx: Math.cos(a) * 0.6, vy: Math.sin(a) * 0.6 - 0.2, drag: 1.4, s0: 0.12, s1: 0.03, life: 0.45, color: e.color || '#c9a2ff', rot: r() * TAU, vrot: 6 });
        }
        break;
      case 'wisp':
        e.timer = 0.6;
        fx.spawn({ batch: 'bbA', uv: R.glow, x: e.x + (r() - 0.5) * 0.4, y: e.y, z: e.z + (r() - 0.5) * 0.4, vx: (r() - 0.5) * 0.2, vy: 0.25, drag: 0.2, s0: 0.12, s1: 0.04, life: 1.6, color: e.color || '#b8ff9a' });
        break;
      case 'sparkle':
        e.timer = 0.9 + r();
        fx.spawn({ batch: 'bbA', uv: R.spark, x: e.x + (r() - 0.5) * 0.3, y: e.y + r() * 0.3, z: e.z + (r() - 0.5) * 0.3, s0: 0.05, s1: 0.3, life: 0.5, color: e.color || '#bff0ff', rot: r() * 3 });
        break;
      case 'fountain':
        e.timer = 0.08;
        {
          const a = r() * TAU;
          fx.spawn({ batch: 'bbN', uv: R.dot, x: e.x, y: e.y, z: e.z, vx: Math.cos(a) * 0.5, vy: 1.4 + r() * 0.4, vz: Math.sin(a) * 0.5, g: -5, s0: 0.05, s1: 0.03, life: 0.6, color: '#bff0ff', a0: 0.9, a1: 0.5 });
        }
        break;
      case 'portal':
        // purple motes swirling up inside the spawn arch
        e.timer = 0.22;
        {
          const a = r() * TAU;
          const rad = 0.15 + r() * 0.3;
          fx.spawn({ batch: 'bbA', uv: R.glow, x: e.x + Math.cos(a) * rad, y: e.y, z: e.z + Math.sin(a) * rad, vy: 0.5 + r() * 0.4, vx: -Math.sin(a) * 0.25, vz: Math.cos(a) * 0.25, drag: 0.6, s0: 0.14, s1: 0.03, life: 1.1, color: e.color || '#c48cff' });
        }
        break;
      case 'debris':
        // the Petal Gate: dark shards of street drifting slowly into the rift
        e.timer = 0.16;
        {
          const a = r() * TAU;
          const rad = (e.r || 0.6) * (1.3 + r() * 0.5);
          const ox = Math.cos(a) * rad;
          const oy = Math.sin(a) * rad * 0.8;
          fx.spawn({ batch: 'bbN', uv: R.dot, x: e.x + ox * 0.7, y: Math.max(0.1, e.y + oy), z: e.z + ox * 0.5, vx: -ox * 0.7, vy: -oy * 0.7, vz: -ox * 0.35, drag: 0.4, s0: 0.07 + r() * 0.05, s1: 0.02, life: 1.3, color: r() > 0.4 ? '#3b3346' : '#5a5066', a0: 0.9, a1: 0.4, rot: r() * TAU, vrot: 2 });
        }
        break;
      case 'riftPetals':
        // petals spilling out of the rift (the Morning's sakura, through the gate)
        e.timer = 0.3;
        {
          const a = r() * TAU;
          fx.spawn({ batch: 'bbN', uv: R.petal, x: e.x + Math.cos(a) * 0.3, y: e.y + Math.sin(a) * 0.3, z: e.z, vx: Math.cos(a) * 0.5 + this.gust.value * 0.4, vy: 0.1 + Math.sin(a) * 0.3, vz: 0.35 + r() * 0.3, g: -0.6, drag: 0.6, s0: 0.12, s1: 0.09, life: 1.8, color: ['#ffc2d8', '#ffb3cf', '#ff9ec4'][Math.floor(r() * 3)], a0: 0.95, a1: 0, rot: r() * TAU, vrot: (r() - 0.5) * 6 });
        }
        break;
      case 'frost':
        // frost motes breathing out of the rift (the Night's cold rides through the Merge)
        e.timer = 0.35;
        {
          const a = r() * TAU;
          const rad = (e.r || 0.6) * r();
          fx.spawn({ batch: 'bbA', uv: R.glow, x: e.x + Math.cos(a) * rad, y: e.y + Math.sin(a) * rad, z: e.z, vx: (r() - 0.5) * 0.2, vy: -0.12, vz: 0.2 + r() * 0.2, drag: 0.3, s0: 0.08, s1: 0.03, life: 1.6, color: '#d8f2ff' });
        }
        break;
      case 'snowGust':
        // snow blowing out of a highway bore along the road (Gate Arc 4-8): one reused description
        e.timer = 0.12;
        {
          const P = this._gust;
          const sp = 0.9 + r() * 0.7;
          const side = (r() - 0.5) * 0.8;
          P.x = e.x - (e.dz || 0) * side;
          P.y = e.y + r() * 0.3;
          P.z = e.z + (e.dx || 0) * side;
          P.vx = (e.dx || 0) * sp + (r() - 0.5) * 0.2 + this.gust.value * 0.3;
          P.vy = 0.05 + r() * 0.15;
          P.vz = (e.dz || 0) * sp + (r() - 0.5) * 0.2;
          P.s0 = 0.05 + r() * 0.05;
          P.rot = r() * TAU;
          fx.spawn(P);
        }
        break;
      case 'drip':
        // water dripping off a tunnel mouth or a vent shaft (the Drowned Line), a ripple where it lands
        e.timer = 0.9 + r() * 1.4;
        {
          const D = this._drop;
          D.x = e.x + (r() - 0.5) * 0.12;
          D.y = e.y;
          D.z = e.z + (r() - 0.5) * 0.06;
          fx.spawn(D);
          const P = this._ripple;
          P.x = D.x;
          P.y = PATH_H + 0.02;
          P.z = D.z;
          fx.spawn(P);
        }
        break;
      case 'steamColumn':
        // a steam valve's column: big pale puffs climbing a tile and a half, leaning with the wind
        e.timer = 0.22;
        {
          const C = this._column;
          C.x = e.x + (r() - 0.5) * 0.1;
          C.y = e.y;
          C.z = e.z + (r() - 0.5) * 0.1;
          C.vx = 0.06 + this.gust.value * 0.3;
          C.rot = r() * TAU;
          fx.spawn(C);
        }
        break;
      case 'darkSnow':
        // the Vesper Gate's dark snow: violet-black flakes drifting out of the disc onto the road
        e.timer = 0.14;
        {
          const P = this._darkSnow;
          const a = r() * TAU;
          const rad = (e.r || 0.6) * r();
          P.x = e.x + Math.cos(a) * rad;
          P.y = e.y + Math.sin(a) * rad * 0.6;
          P.z = e.z + (r() - 0.2) * 0.3;
          P.vx = (r() - 0.5) * 0.3 + this.gust.value * 0.2;
          P.vz = 0.15 + r() * 0.25;
          P.s0 = 0.06 + r() * 0.05;
          P.rot = r() * TAU;
          fx.spawn(P);
        }
        break;
      case 'goal':
        // little hearts floating up from the goal gate
        e.timer = 1.1 + r() * 0.6;
        fx.spawn({ batch: 'bbN', uv: R.heart, x: e.x + (r() - 0.5) * 0.5, y: e.y + 0.2, z: e.z + (r() - 0.5) * 0.3, vy: 0.45, vx: (r() - 0.5) * 0.2, s0: 0.14, s1: 0.22, life: 1.6, color: e.color || '#ff7aa2', a0: 1, a1: 0, fadeIn: 0.2 });
        break;
      default:
        e.timer = 1e9;
    }
  }

  _firework(x, z) {
    const fx = this.fx;
    const R = this.R;
    const r = this.rand;
    const cols = ['#ff6b8b', '#ffd43b', '#4cc9f0', '#b197fc', '#7bd389'];
    const col = cols[Math.floor(r() * cols.length)];
    const hx = x + (r() - 0.5) * 2;
    const hz = z - 1 - r();
    const hy = 3 + r() * 1.2;
    fx.flash(hx, hy, hz, col, 1.4, 0.3);
    const k = fx.n(26);
    for (let i = 0; i < k; i++) {
      const a = (i / k) * TAU;
      const b = (r() - 0.5) * 1.2;
      const sp = 1.6 + r() * 0.5;
      fx.spawn({ batch: 'bbA', uv: R.glow, x: hx, y: hy, z: hz, vx: Math.cos(a) * sp, vy: Math.sin(b) * sp + 0.5, vz: Math.sin(a) * sp * 0.6, g: -1.4, drag: 1.2, s0: 0.14, s1: 0.04, life: 1.1 + r() * 0.4, color: col });
    }
  }
}
