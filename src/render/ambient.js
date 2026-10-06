// Ambient life of a battlefield: weather (petals, snow, rain, embers), drifting fog banks,
// cloud shadows, wind gusts that move the foliage, butterflies and birds by day, fireflies
// and lantern light pools by night, koi + fish ripples in ponds, snow sparkle, prop glows
// that flicker, prop emitters (chimney smoke, vents, campfires, bog wisps, fountains,
// fireworks) and the bouncing arrows + glowing discs at the spawn / goal gates.
import * as THREE from 'three';
import { WATER_Y, PATH_H } from './terrain.js';

const TAU = Math.PI * 2;
const BUTTERFLY_COLORS = ['#ffffff', '#ffe066', '#9fd8ff', '#ffb3cf', '#c4a6ff', '#ffa94d'];

export class AmbientSystem {
  /**
   * @param {{ map, look, terrain, fx: import('./fx.js').FxSystem, batches, atlas }} o
   */
  constructor({ map, look, terrain, fx, batches, atlas }) {
    this.map = map;
    this.look = look;
    this.terrain = terrain;
    this.fx = fx;
    this.b = batches;
    this.R = atlas.regions;
    this.time = 0;
    this.density = 1;
    this.enabled = true;
    this.rand = Math.random;
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
    this.gates = terrain.gates || [];
    /** BattleRenderer skips its legacy chevrons when the ambient layer draws the gates. */
    this.drawsGates = true;
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
    this._gateColors = new Map();
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
      const pinks = feathers ? ['#ffffff', '#f4f0ff'] : ['#ffc2d8', '#ffb3cf', '#ffd6e6', '#ff9ec4'];
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
    // fog banks
    this.mist = [];
    if (this.look.fog) {
      const n = Math.max(5, Math.round(11 * this.density));
      for (let i = 0; i < n; i++) {
        this.mist.push({ x: x0 + r() * (x1 - x0), z: z0 + r() * (z1 - z0), y: 0.25 + r() * 0.5, s: 3 + r() * 3.5, v: 0.12 + r() * 0.15, ph: r() * TAU, rot: r() * TAU });
      }
    }
    // fireflies at night (not in hot / industrial places)
    this.flies = [];
    if (this.look.night && this.life.fireflies !== false && this.look.theme !== 'foundry' && this.look.theme !== 'volcano') {
      const n = Math.round(26 * this.density);
      for (let i = 0; i < n; i++) {
        this.flies.push({ x: x0 + r() * (x1 - x0), z: z0 + r() * (z1 - z0), y: 0.3 + r() * 1.0, ph: r() * TAU, sp: 0.3 + r() * 0.4 });
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
          bbA.push(p.x, p.y, p.z, p.s, p.s, R.glow, 1, 0.45, 0.12, fl * Math.min(1, (3.2 - p.y)));
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
      for (const f of this.flies) {
        const x = f.x + Math.sin(t * f.sp + f.ph) * 0.8;
        const z = f.z + Math.cos(t * f.sp * 0.7 + f.ph) * 0.8;
        const y = f.y + Math.sin(t * 1.7 + f.ph) * 0.2;
        const a = Math.max(0, Math.sin(t * 1.3 + f.ph * 3));
        bbA.push(x, y, z, 0.16, 0.16, R.glow, 0.8, 1, 0.45, a);
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
    const ga = night ? 0.6 : 0.32;
    for (const g of this.glows) {
      if (g.owner && !g.owner.visible) continue;
      const fl = 1 - g.flicker * (0.5 + 0.5 * Math.sin(t * 9 + g.phase) * Math.sin(t * 3.7 + g.phase * 2));
      const s = g.size * (night ? 1.1 : 0.8);
      bbA.push(g.x, g.y, g.z, s, s, R.glow, g.color.r, g.color.g, g.color.b, ga * fl);
      if (night && g.y < 1.6 && g.size >= 0.4) gA.push(g.x, 0.02, g.z, s * 2.2, s * 2.2, R.soft, g.color.r, g.color.g, g.color.b, 0.16 * fl);
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
      const [dx, dz] = g.dir;
      const rot = Math.atan2(-dz, dx);
      const spawn = g.kind === 'spawn';
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
      gN.push(ax, y, az, 0.78, 0.78, R.arrow, col.r, col.g, col.b, fadeA);
      // second, smaller arrow half a cycle behind
      const slide2 = ((t * 0.9 + 0.5) % 1);
      const along2 = spawn ? 0.9 + slide2 * 1.1 : 0.2 + slide2 * 1.1;
      const hop2 = Math.abs(Math.sin(t * 3.4 + 1.6 + (spawn ? 0 : 1)));
      gN.push(g.x + dx * along2, PATH_H + 0.1 + hop2 * 0.18, g.z + dz * along2, 0.6, 0.6, R.arrow, col.r, col.g, col.b, Math.sin(slide2 * Math.PI) * 0.85);
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
    this.flocks.push({ x: fromLeft ? x0 - 3 : x1 + 3, z: z0 + 1 + r() * (z1 - z0 - 2), y: 2.6 + r() * 0.8, vx, vz, members, c: new THREE.Color(this.look.night ? '#1d2b4f' : '#3a4a6a') });
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
        fx.spawn({ batch: 'bbA', uv: R.glow, x: e.x + (r() - 0.5) * 0.25, y: e.y, z: e.z + (r() - 0.5) * 0.25, vx: (r() - 0.5) * 0.3, vy: 0.8 + r() * 0.8, drag: 0.5, s0: 0.08, s1: 0.02, life: 1.2, color: r() > 0.5 ? '#ff7a33' : '#ffc46b' });
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
