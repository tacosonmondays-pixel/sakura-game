// Ambient life of a battlefield: weather (petals, snow, rain, embers), drifting fog banks,
// night fireflies, koi and water glints, prop glows that flicker and prop emitters
// (chimney smoke, vents, campfires, bog wisps, fountains, fireworks).
import * as THREE from 'three';
import { WATER_Y } from './terrain.js';

const TAU = Math.PI * 2;

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
    this.particles = [];
    this.mist = [];
    this.flies = [];
    this.koi = [];
    this.glows = terrain.glows;
    this.emitters = terrain.emitters.map((e) => ({ ...e, timer: this.rand() * 2 }));
    this.waterTiles = [];
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (terrain.isWater(x, y) && !terrain.isPath(x, y)) this.waterTiles.push([x, y]);
    this.fireworkTimer = 2;
    this._c = new THREE.Color();
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
    if (this.look.night && this.look.theme !== 'foundry' && this.look.theme !== 'volcano') {
      const n = Math.round(26 * this.density);
      for (let i = 0; i < n; i++) {
        this.flies.push({ x: x0 + r() * (x1 - x0), z: z0 + r() * (z1 - z0), y: 0.3 + r() * 1.0, ph: r() * TAU, sp: 0.3 + r() * 0.4 });
      }
    }
    // koi
    this.koi = [];
    if (this.terrain.ambient.has('koi') && this.waterTiles.length) {
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
    const wind = Math.sin(t * 0.3) * 0.25 + 0.35;
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
    }
    for (const k of this.koi) {
      k.ph += k.sp * dt;
      const x = k.cx + Math.cos(k.ph) * k.r;
      const z = k.cz + Math.sin(k.ph) * k.r;
      const ang = k.ph + (k.sp > 0 ? Math.PI : 0);
      this.b.groundN.push(x, WATER_Y + 0.02, z, 0.09, 0.2, R.leaf, k.color.r, k.color.g, k.color.b, 0.85, -ang);
    }
    if (this.terrain.ambient.has('sparkles') && this.waterTiles.length && this.rand() < dt * 6 * this.density) {
      const [tx, ty] = this.waterTiles[Math.floor(this.rand() * this.waterTiles.length)];
      this.fx.spawn({ batch: 'bbA', uv: R.spark, x: tx + this.rand(), y: WATER_Y + 0.1, z: ty + this.rand(), s0: 0.05, s1: 0.3, life: 0.5, color: ['#ffd1e3', '#bff0ff', '#fff3b0'][Math.floor(this.rand() * 3)], rot: this.rand() * 3 });
    }

    // prop glows
    const night = this.look.night || this.look.fog;
    const ga = night ? 0.6 : 0.32;
    for (const g of this.glows) {
      if (g.owner && !g.owner.visible) continue;
      const fl = 1 - g.flicker * (0.5 + 0.5 * Math.sin(t * 9 + g.phase) * Math.sin(t * 3.7 + g.phase * 2));
      const s = g.size * (night ? 1.1 : 0.8);
      bbA.push(g.x, g.y, g.z, s, s, R.glow, g.color.r, g.color.g, g.color.b, ga * fl);
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
        fx.spawn({ batch: 'bbN', uv: R.smoke, x: e.x, y: e.y, z: e.z, vx: 0.15, vy: 0.45, drag: 0.3, s0: 0.25, s1: 0.9, life: 2.4, color: this.look.night ? '#6a7090' : '#d8d4d0', a0: 0.55, fadeIn: 0.3, rot: r() * TAU, vrot: 0.3 });
        break;
      case 'steam':
        e.timer = 0.5;
        fx.spawn({ batch: 'bbN', uv: R.smoke, x: e.x + (r() - 0.5) * 0.2, y: e.y, z: e.z + (r() - 0.5) * 0.2, vy: 0.5, vx: 0.05, drag: 0.4, s0: 0.2, s1: 0.75, life: 1.8, color: '#ffffff', a0: 0.4, fadeIn: 0.3, rot: r() * TAU, vrot: 0.4 });
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
      default:
        e.timer = 1e9;
    }
  }

  _firework(x, z) {
    const fx = this.fx;
    const R = this.R;
    const r = this.rand;
    const cols =['#ff6b8b', '#ffd43b', '#4cc9f0', '#b197fc', '#7bd389'];
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
