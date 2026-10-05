// Battle actors: girls (towers + hero), monsters, drones and projectiles kept in sync with
// the Sim by uid, plus their ground shadows, tier rings, HP bars, status icons, oni field
// rings, trap runes and teleport warnings.
import * as THREE from 'three';
import { buildChibi, buildEnemy, disposeObject } from '../models/index.js';
import { GeoBuilder, lerpAngle } from './geo.js';
import { FIELD_COLORS, fxColor } from './themes.js';
import { WATER_Y, PATH_H } from './terrain.js';

const TAU = Math.PI * 2;
/** Girls and monsters are drawn a bit larger than their tile for readability on phones. */
const TOWER_SCALE = 1.22;
const HERO_SCALE = 1.36;
const ENEMY_SCALE = 1.12;

const STATUS_ICONS = {
  burn: ['st_burn', '#ff8a4a'], poison: ['st_poison', '#7be08a'], freeze: ['st_freeze', '#bff0ff'], slow: ['st_slow', '#8fe3ff'],
  shock: ['st_shock', '#ffe45c'], stun: ['st_stun', '#ffd84d'], shred: ['st_shred', '#d0d6e2'], mark: ['st_mark', '#ff6b8b'],
  vulnerable: ['st_mark', '#9fd8ff'], silence: ['st_silence', '#c4a6ff'], reveal: ['st_reveal', '#ffe066'], soak: ['st_soak', '#4cc9f0'],
};
const STATUS_ORDER = ['freeze', 'stun', 'shock', 'burn', 'poison', 'slow', 'shred', 'mark', 'vulnerable', 'silence', 'reveal', 'soak'];
const TIER_RING = [null, null, null, '#6fb8ff', '#c08bff', '#ffd84d'];
const PATH_COLORS = ['#ff6b8b', '#4cc9f0', '#ffd43b'];
const WHITE = new THREE.Color('#ffffff');
const colorCache = new Map();
/** Cached THREE.Color for a hex string (hot paths). */
function cachedColor(hex) {
  let c = colorCache.get(hex);
  if (!c) {
    c = new THREE.Color(hex);
    colorCache.set(hex, c);
  }
  return c;
}

export { PATH_COLORS };

// ---------------------------------------------------------------------------
// Projectile geometry
// ---------------------------------------------------------------------------

function projectileGeometries() {
  const g = {};
  const b = () => new GeoBuilder({ flat: false });
  g.arrow = b()
    .cyl(0.012, 0.012, 0.42, 4, { rx: Math.PI / 2, z: -0.21, color: '#c49a6a' })
    .cone(0.035, 0.1, 5, { rx: Math.PI / 2, z: 0.2, color: '#e8eef8' })
    .box(0.07, 0.02, 0.1, { z: -0.2, y: -0.01, color: '#ffffff' })
    .finish();
  g.bullet = b().sphere(0.05, 8, 6, { sz: 2.2, color: '#ffffff' }).finish();
  g.shell = b().sphere(0.1, 10, 8, { color: '#4a4f5a' }).torus(0.1, 0.02, 4, 10, { color: '#ffcc33' }).finish();
  g.fireball = b().sphere(0.13, 10, 8, { color: '#ffd08a' }).finish();
  g.shuriken = (() => {
    const s = new THREE.Shape();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const r = i % 2 === 0 ? 0.13 : 0.04;
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false });
    geo.rotateX(Math.PI / 2);
    return b().add(geo, { color: '#d8e0ee' }).finish();
  })();
  g.orb = b().sphere(0.09, 10, 8, { color: '#ffffff' }).finish();
  g.needle = b().cone(0.025, 0.32, 5, { rx: Math.PI / 2, z: -0.08, color: '#ffffff' }).finish();
  g.flask = b()
    .sphere(0.08, 8, 6, { color: '#7be08a' })
    .cyl(0.03, 0.03, 0.08, 6, { y: 0.06, color: '#e8f4ff' })
    .finish();
  g.bolt = b().add(new THREE.OctahedronGeometry(0.08, 0), { sz: 2.8, color: '#ffffff' }).finish();
  g.spark = b().add(new THREE.OctahedronGeometry(0.07, 0), { color: '#ffffff' }).finish();
  return g;
}

const GLOW_KINDS = { orb: 0.42, fireball: 0.6, bolt: 0.45, spark: 0.5, bullet: 0.22, needle: 0.2 };
const SPIN_KINDS = { shuriken: 18, flask: 9, shell: 4 };
const TINT_KINDS = { orb: true, bolt: true, spark: true, bullet: true, needle: true, fireball: true };

// ---------------------------------------------------------------------------

export class Actors {
  /**
   * @param {{ sim, scene: THREE.Scene, fx, batches, atlas, quality: string, terrain }} o
   */
  constructor({ sim, scene, fx, batches, atlas, quality, terrain }) {
    this.sim = sim;
    this.scene = scene;
    this.fx = fx;
    this.b = batches;
    this.R = atlas.regions;
    this.quality = quality;
    this.terrain = terrain;
    this.towers = new Map(); // uid → view
    this.enemies = new Map();
    this.root = new THREE.Group();
    this.root.name = 'actors';
    scene.add(this.root);
    this.time = 0;
    this.shadows = false;
    this.selectedUid = null;
    this.teleports = new Map();
    this.victory = false;
    this._c = new THREE.Color();
    this._statusColors = {};
    for (const [k, [, hex]] of Object.entries(STATUS_ICONS)) this._statusColors[k] = new THREE.Color(hex);

    // projectiles
    this.projGeo = projectileGeometries();
    this.projMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    this.proj = {};
    for (const [kind, geo] of Object.entries(this.projGeo)) {
      const mesh = new THREE.InstancedMesh(geo, this.projMat, 256);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.setColorAt(0, new THREE.Color('#ffffff'));
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.name = `proj:${kind}`;
      this.root.add(mesh);
      this.proj[kind] = mesh;
    }
    this.projPrev = new Map();

    // drones (engineer turrets)
    const dg = new GeoBuilder({ flat: false })
      .sphere(0.11, 10, 8, { sy: 0.8, color: '#e8eef8' })
      .torus(0.15, 0.022, 4, 14, { rx: Math.PI / 2, color: '#ffcc33' })
      .sphere(0.04, 8, 6, { z: 0.09, color: '#4cc9f0' })
      .box(0.02, 0.08, 0.02, { y: 0.07, color: '#5a606b' })
      .finish();
    this.droneGeo = dg;
    this.droneMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.drones = new THREE.InstancedMesh(dg, this.droneMat, 64);
    this.drones.count = 0;
    this.drones.frustumCulled = false;
    this.root.add(this.drones);

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3(1, 1, 1);
  }

  setQuality(q) {
    if (q === this.quality) return;
    this.quality = q;
    // rebuild every model at the new detail level
    for (const v of this.towers.values()) this._disposeView(v);
    for (const v of this.enemies.values()) this._disposeView(v);
    this.towers.clear();
    this.enemies.clear();
  }

  setShadows(on) {
    this.shadows = on;
    for (const v of [...this.towers.values(), ...this.enemies.values()]) {
      v.model.traverse((o) => {
        if (o.isMesh && !o.userData.isOutline) o.castShadow = on;
      });
    }
  }

  _disposeView(v) {
    this.root.remove(v.model);
    v.model.userData.dispose?.();
    disposeObject(v.model);
  }

  // -------------------------------------------------------------------------
  // Sync
  // -------------------------------------------------------------------------

  /** Creates/removes/moves models to match the sim. */
  sync(dt) {
    this.time += dt;
    const sim = this.sim;
    const seen = new Set();
    for (const t of sim.towers) {
      seen.add(t.uid);
      let v = this.towers.get(t.uid);
      if (!v) v = this._createTower(t);
      this._updateTower(v, t, dt);
    }
    for (const [uid, v] of this.towers) {
      if (!seen.has(uid)) {
        this._disposeView(v);
        this.towers.delete(uid);
        this.releaseDecor(v.decorKey);
      }
    }
    seen.clear();
    for (const e of sim.enemies) {
      if (e.dead) continue;
      seen.add(e.uid);
      let v = this.enemies.get(e.uid);
      if (!v) v = this._createEnemy(e);
      this._updateEnemy(v, e, dt);
    }
    for (const [uid, v] of this.enemies) {
      if (!seen.has(uid)) {
        this._disposeView(v);
        this.enemies.delete(uid);
        this.teleports.delete(uid);
      }
    }
    this._syncProjectiles(dt);
    this._syncDrones();
  }

  _createTower(t) {
    const model = buildChibi(t.def, { quality: this.quality });
    model.traverse((o) => {
      if (o.isMesh && !o.userData.isOutline) o.castShadow = this.shadows;
    });
    const water = this.terrain.isWater(t.tx, t.ty);
    const v = {
      uid: t.uid, model, facing: t.facing || 0, pop: 0, water, hero: t.isHero, state: 'idle',
      scale: t.isHero ? HERO_SCALE : TOWER_SCALE, ripple: Math.random() * 3,
    };
    model.position.set(t.x, water ? WATER_Y + 0.03 : 0.05, t.y);
    model.rotation.y = v.facing;
    model.scale.setScalar(0.01);
    this.root.add(model);
    this.towers.set(t.uid, v);
    // hide floating set pieces (boats, piers) under water girls
    const decor = this.terrain.waterDecor.get(`${t.tx},${t.ty}`);
    if (decor) for (const o of decor) o.visible = false;
    v.decorKey = `${t.tx},${t.ty}`;
    return v;
  }

  _updateTower(v, t, dt) {
    const m = v.model;
    v.pop = Math.min(1, v.pop + dt * 3.2);
    const k = v.pop;
    const elastic = k >= 1 ? 1 : 1 - Math.cos(k * Math.PI * 2.5) * Math.exp(-k * 5) * (1 - k);
    m.scale.setScalar(v.scale * Math.max(0.01, elastic));
    v.facing = lerpAngle(v.facing, t.facing || 0, Math.min(1, dt * 12));
    m.rotation.y = v.facing;
    if (v.water) m.position.y = WATER_Y + 0.05 + Math.sin(this.time * 2 + v.ripple) * 0.02;
    let state = 'idle';
    if (this.victory) state = 'victory';
    else if (t.disabled > 0) state = 'disabled';
    v.state = state;
    m.userData.animate?.(this.time, dt, state);
  }

  /** Called on 'sell' / removal to restore hidden water decor. */
  releaseDecor(key) {
    const decor = this.terrain.waterDecor.get(key);
    if (decor) for (const o of decor) o.visible = true;
  }

  _createEnemy(e) {
    const model = buildEnemy(e.def, { quality: this.quality });
    model.traverse((o) => {
      if (o.isMesh && !o.userData.isOutline && !o.userData.fx) o.castShadow = this.shadows;
    });
    const v = {
      uid: e.uid, model, x: e.x, z: e.y, y: e.alt || 0, facing: e.facing || 0, statusKey: '', boss: e.tier === 'boss' || e.tier === 'miniboss',
      height: (model.userData.height || 0.6 * (e.def.size || 1)) * ENEMY_SCALE, size: e.def.size || 1, color: e.def.color || '#ffffff', spawnT: 0,
      bob: (e.uid * 1.37) % TAU, airborne: !!e.airborne, veiled: null, phasing: null, barrier: -1,
    };
    model.position.set(e.x, v.y, e.y);
    model.rotation.y = v.facing;
    this.root.add(model);
    this.enemies.set(e.uid, v);
    return v;
  }

  _updateEnemy(v, e, dt) {
    const m = v.model;
    const dx = e.x - v.x;
    const dz = e.y - v.z;
    if (dx * dx + dz * dz > 1.5) {
      v.x = e.x;
      v.z = e.y;
    } else {
      const k = Math.min(1, dt * 22);
      v.x += dx * k;
      v.z += dz * k;
    }
    v.airborne = !!e.airborne;
    // ground walkers stand on the raised path / bridge decks
    const tx = Math.floor(v.x);
    const tz = Math.floor(v.z);
    const ground = this.terrain.isPath(tx, tz) ? PATH_H : 0;
    const alt = (e.alt || 0) + ground;
    v.y += (alt - v.y) * Math.min(1, dt * 8);
    const bob = v.airborne ? Math.sin(this.time * 3 + v.bob) * 0.07 : 0;
    m.position.set(v.x, v.y + bob, v.z);
    v.facing = lerpAngle(v.facing, e.facing || 0, Math.min(1, dt * 10));
    m.rotation.y = v.facing;
    v.spawnT = Math.min(1, v.spawnT + dt * 4);
    m.scale.setScalar((0.4 + 0.6 * v.spawnT) * ENEMY_SCALE);
    const ud = m.userData;
    const veiled = !!(e.veiled && !e.revealed);
    if (veiled !== v.veiled) {
      v.veiled = veiled;
      ud.setVeiled?.(veiled);
    }
    if (!!e.phasing !== v.phasing) {
      v.phasing = !!e.phasing;
      ud.setPhasing?.(v.phasing);
    }
    const bar = e.maxBarrier > 0 ? Math.max(0, e.barrier) / e.maxBarrier : 0;
    if (Math.abs(bar - v.barrier) > 0.01) {
      v.barrier = bar;
      ud.setBarrier?.(bar);
    }
    let key = '';
    for (const s in e.statuses) key += `${s},`;
    if (key !== v.statusKey) {
      v.statusKey = key;
      ud.setStatus?.(e.statuses);
    }
    const immobile = e.statuses.freeze || e.statuses.stun || e.statuses.shock;
    ud.animate?.(this.time, dt, { moving: !immobile, speed: e.speed || 1 });
  }

  /** Enemy view position (for effects), or null. */
  enemyPos(uid) {
    const v = this.enemies.get(uid);
    if (!v) return null;
    return { x: v.x, y: v.y, z: v.z, height: v.height, size: v.size, color: v.color, airborne: v.airborne };
  }

  towerView(uid) {
    return this.towers.get(uid) || null;
  }

  hitFlash(uid) {
    this.enemies.get(uid)?.model.userData.hitFlash?.();
  }

  playAttack(uid) {
    this.towers.get(uid)?.model.userData.playAttack?.();
  }

  setHighlight(uid, on) {
    this.towers.get(uid)?.model.userData.setHighlight?.(on);
  }

  // -------------------------------------------------------------------------
  // Projectiles & drones
  // -------------------------------------------------------------------------

  _syncProjectiles(dt) {
    const counts = {};
    for (const k in this.proj) counts[k] = 0;
    const prev = this.projPrev;
    const alive = new Set();
    const m = this._m;
    const col = this._c;
    for (const p of this.sim.projectiles) {
      const kind = this.proj[p.kind] ? p.kind : 'arrow';
      const mesh = this.proj[kind];
      const i = counts[kind];
      if (i >= mesh.instanceMatrix.count) continue;
      counts[kind] = i + 1;
      alive.add(p.uid);
      const z = p.z ?? 0.55;
      const last = prev.get(p.uid);
      let pitch = 0;
      if (last !== undefined && dt > 0) {
        const vz = (z - last) / dt;
        const hv = Math.hypot(p.vx || 0, p.vy || 0) || 1;
        pitch = -Math.atan2(vz, hv);
      }
      prev.set(p.uid, z);
      const yaw = Math.atan2(p.vx || 0, p.vy || 1);
      const spin = SPIN_KINDS[kind] ? this.time * SPIN_KINDS[kind] + p.uid : 0;
      this._e.set(pitch, yaw, kind === 'shuriken' ? 0 : spin, 'YXZ');
      if (kind === 'shuriken') this._e.set(0, spin, 0);
      this._q.setFromEuler(this._e);
      this._p.set(p.x, z, p.y);
      this._s.setScalar(kind === 'fireball' ? 1 + 0.15 * Math.sin(this.time * 20 + p.uid) : 1);
      m.compose(this._p, this._q, this._s);
      mesh.setMatrixAt(i, m);
      const fc = cachedColor(fxColor(p.element, p.attackType, '#ffffff'));
      col.copy(TINT_KINDS[kind] ? fc : WHITE);
      if (kind === 'bolt' || kind === 'spark' || kind === 'bullet') col.lerp(WHITE, 0.35);
      mesh.setColorAt(i, col);
      const glow = GLOW_KINDS[kind];
      if (glow) this.b.bbA.push(p.x, z, p.y, glow, glow, this.R.glow, fc.r, fc.g, fc.b, 0.85);
      if (kind === 'fireball' && Math.random() < dt * 30) {
        this.fx.spawn({ batch: 'bbA', uv: this.R.glow, x: p.x, y: z, z: p.y, vy: 0.3, s0: 0.22, s1: 0.04, life: 0.3, color: '#ff8a3d' });
      }
      if (kind === 'shell' && Math.random() < dt * 20) {
        this.fx.spawn({ batch: 'bbN', uv: this.R.smoke, x: p.x, y: z, z: p.y, vy: 0.2, s0: 0.1, s1: 0.3, life: 0.5, color: '#d8d4d0', a0: 0.5 });
      }
      if (kind === 'flask' && Math.random() < dt * 15) {
        this.fx.spawn({ batch: 'bbA', uv: this.R.bubble, x: p.x, y: z, z: p.y, vy: 0.2, s0: 0.08, s1: 0.02, life: 0.4, color: '#7be08a' });
      }
    }
    for (const k in this.proj) {
      const mesh = this.proj[k];
      mesh.count = counts[k];
      if (counts[k]) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    }
    if (prev.size > alive.size) for (const uid of prev.keys()) if (!alive.has(uid)) prev.delete(uid);
  }

  _syncDrones() {
    let n = 0;
    const m = this._m;
    for (const t of this.sim.towers) {
      for (const tu of t.turrets || []) {
        if (n >= 64) break;
        const y = 0.62 + Math.sin(this.time * 4 + tu.uid) * 0.05;
        this._e.set(0, tu.facing || 0, 0);
        this._q.setFromEuler(this._e);
        this._p.set(tu.x, y, tu.y);
        this._s.setScalar(1);
        m.compose(this._p, this._q, this._s);
        this.drones.setMatrixAt(n++, m);
      }
    }
    this.drones.count = n;
    if (n) this.drones.instanceMatrix.needsUpdate = true;
  }

  // -------------------------------------------------------------------------
  // Ground + overlay drawing (per frame, after sync)
  // -------------------------------------------------------------------------

  drawGround(dt) {
    const R = this.R;
    const gN = this.b.groundN;
    const gA = this.b.groundA;
    const t = this.time;
    const sim = this.sim;
    // fields first (below everything else)
    for (const f of sim.fields) {
      const c = this._c.set(f.silenced ? '#8a8fa0' : FIELD_COLORS[f.kind] || '#ffffff');
      const d = f.radius * 2;
      gN.push(f.x, 0.04, f.y, d, d, R.disc, c.r, c.g, c.b, f.silenced ? 0.12 : 0.22);
      gN.push(f.x, 0.045, f.y, d, d, f.silenced ? R.ringDashed : R.ring, c.r, c.g, c.b, f.silenced ? 0.6 : 0.85, t * (f.silenced ? 0.2 : 0.6));
      if (!f.silenced) {
        const pulse = (t * 0.7 + f.uid * 0.13) % 1;
        gA.push(f.x, 0.05, f.y, d * pulse, d * pulse, R.ringSoft, c.r, c.g, c.b, 0.5 * (1 - pulse));
      }
    }
    // traps
    for (const tr of sim.traps) {
      const armed = tr.armed;
      const c = this._c.set(armed ? '#ffb347' : '#8a8fa0');
      const s = armed ? 0.62 : 0.45;
      gN.push(tr.x, 0.07, tr.y, s, s, R.rune, c.r, c.g, c.b, armed ? 0.95 : 0.55, t * 0.8 + tr.uid);
      if (armed) gA.push(tr.x, 0.075, tr.y, s * 1.1, s * 1.1, R.glow, c.r, c.g, c.b, 0.35 + 0.2 * Math.sin(t * 5 + tr.uid));
    }
    // teleport warnings
    for (const [uid, w] of this.teleports) {
      w.t += dt;
      if (w.t > 3) {
        this.teleports.delete(uid);
        continue;
      }
      const pulse = 0.5 + 0.5 * Math.sin(t * 12);
      gA.push(w.x, 0.08, w.y, 0.9, 0.9, R.ringThick, 0.78, 0.45, 1, 0.5 + 0.5 * pulse, t * 2);
      gN.push(w.x, 0.07, w.y, 0.8, 0.8, R.disc, 0.6, 0.3, 0.9, 0.3);
      this.b.overlay.push(w.x, 0.75 + pulse * 0.08, w.y, 0.3, 0.3, R.warn, 0.85, 0.6, 1, 1);
    }
    // tower shadows + tier rings + water ripples
    for (const tw of sim.towers) {
      const v = this.towers.get(tw.uid);
      if (!v) continue;
      const y = v.water ? WATER_Y + 0.03 : 0.065;
      if (v.water) {
        const ph = (t * 0.6 + v.ripple) % 1;
        gN.push(tw.x, y, tw.y, 0.5 + ph * 0.7, 0.5 + ph * 0.7, R.ring, 1, 1, 1, 0.6 * (1 - ph));
        gN.push(tw.x, y, tw.y, 0.62, 0.62, R.disc, 0.85, 0.97, 1, 0.45);
      }
      gN.push(tw.x, y + 0.002, tw.y, 0.62, 0.62, R.shadow, 0.05, 0.05, 0.12, 0.38);
      const maxTier = Math.max(...tw.tiers);
      const ring = tw.isHero ? '#ffd84d' : TIER_RING[maxTier];
      if (ring) {
        const c = this._c.set(ring);
        gA.push(tw.x, y + 0.004, tw.y, 0.86, 0.86, R.ring, c.r, c.g, c.b, 0.7 + 0.25 * Math.sin(t * 3 + tw.uid));
        if (maxTier >= 5 && Math.random() < 0.05) {
          this.fx.spawn({ batch: 'bbA', uv: R.star, x: tw.x + (Math.random() - 0.5) * 0.6, y: 0.2, z: tw.y + (Math.random() - 0.5) * 0.6, vy: 0.8, s0: 0.12, s1: 0.02, life: 0.8, color: ring });
        }
      }
      if (tw.buffed) {
        gA.push(tw.x, y + 0.003, tw.y, 0.7, 0.7, R.ring, 1, 0.55, 0.8, 0.45 + 0.2 * Math.sin(t * 4 + tw.uid));
      }
      if (tw.disabled > 0) {
        // dizzy stars + soot
        for (let i = 0; i < 3; i++) {
          const a = t * 4 + (i / 3) * TAU;
          this.b.bbA.push(tw.x + Math.cos(a) * 0.22, 1.05, tw.y + Math.sin(a) * 0.22, 0.13, 0.13, R.star, 1, 0.85, 0.3, 0.9);
        }
        if (Math.random() < 0.08) this.fx.spawn({ batch: 'bbN', uv: R.smoke, x: tw.x, y: 0.7, z: tw.y, vy: 0.5, s0: 0.15, s1: 0.45, life: 0.9, color: '#4a4a55', a0: 0.5 });
      }
    }
    // enemy shadows + boss aura
    for (const v of this.enemies.values()) {
      const s = 0.3 + 0.28 * v.size;
      const air = v.airborne;
      gN.push(v.x, 0.06, v.z, air ? s * 0.8 : s, air ? s * 0.8 : s, R.shadow, 0.05, 0.04, 0.1, air ? 0.22 : 0.4);
      if (v.boss) {
        const ph = (t * 0.8) % 1;
        gA.push(v.x, 0.07, v.z, s * (1.6 + ph), s * (1.6 + ph), R.ringSoft, 1, 0.25, 0.3, 0.6 * (1 - ph));
        gN.push(v.x, 0.065, v.z, s * 1.8, s * 1.8, R.disc, 0.6, 0.1, 0.18, 0.18);
      }
    }
    // drone shadows
    for (const tw of sim.towers) for (const tu of tw.turrets || []) gN.push(tu.x, 0.06, tu.y, 0.3, 0.3, R.shadow, 0.05, 0.05, 0.1, 0.3);
  }

  /** HP bars + status icons (overlay batch). */
  drawOverlay() {
    const ov = this.b.overlay;
    const R = this.R;
    for (const e of this.sim.enemies) {
      if (e.dead) continue;
      const v = this.enemies.get(e.uid);
      if (!v) continue;
      const hpFrac = e.maxHp > 0 ? Math.max(0, e.hp / e.maxHp) : 0;
      const hasBarrier = e.maxBarrier > 0 && e.barrier > 0;
      let icons = 0;
      for (const s in e.statuses) if (STATUS_ICONS[s]) icons++;
      const important = e.tier !== 'normal';
      if (hpFrac > 0.999 && !hasBarrier && !important && !icons) continue;
      const big = e.tier === 'boss' ? 1.5 : e.tier === 'miniboss' ? 1.15 : 1;
      const bw = Math.min(1.5, (0.42 + 0.12 * v.size) * big);
      const bh = e.tier === 'normal' ? 0.07 : 0.095;
      const x = v.x;
      const z = v.z;
      const y = v.y + v.height * (0.4 + 0.6 * v.spawnT) + 0.2;
      const veiledA = v.veiled ? 0.55 : 1;
      if (hpFrac <= 0.999 || hasBarrier || important) {
        ov.push(x, y, z, bw + 0.04, bh + 0.035, R.white, 0.07, 0.09, 0.18, 0.78 * veiledA);
        const c = this._c;
        if (hpFrac > 0.5) c.setRGB(0.32, 0.86, 0.36);
        else if (hpFrac > 0.25) c.setRGB(1, 0.78, 0.2);
        else c.setRGB(1, 0.3, 0.33);
        if (e.tier === 'boss' || e.tier === 'miniboss') c.setRGB(1, 0.32, 0.42);
        const fw = bw * hpFrac;
        ov.push(x, y, z, fw, bh, R.white, c.r, c.g, c.b, veiledA, 0, -(bw - fw) / 2, 0);
        // gloss line
        ov.push(x, y, z, fw, bh * 0.3, R.white, 1, 1, 1, 0.28 * veiledA, 0, -(bw - fw) / 2, bh * 0.22);
        if (e.maxBarrier > 0) {
          const bf = Math.max(0, e.barrier / e.maxBarrier);
          const oy = bh * 0.5 + 0.045;
          ov.push(x, y, z, bw + 0.04, 0.06, R.white, 0.07, 0.09, 0.18, 0.7 * veiledA, 0, 0, oy);
          if (bf > 0) ov.push(x, y, z, bw * bf, 0.04, R.white, 0.55, 0.85, 1, veiledA, 0, -(bw - bw * bf) / 2, oy);
        }
        if (important) {
          const sc = e.tier === 'elite' ? [0.8, 0.85, 1] : [1, 0.82, 0.3];
          ov.push(x, y, z, 0.17, 0.17, R.star, sc[0], sc[1], sc[2], veiledA, 0, -bw / 2 - 0.1, 0);
        }
      }
      if (icons) {
        const n = Math.min(4, icons);
        const sz = 0.15;
        let i = 0;
        const oy = (hasBarrier || e.maxBarrier > 0 ? 0.17 : 0.12) + (hpFrac > 0.999 && !important ? -0.12 : 0);
        for (const s of STATUS_ORDER) {
          if (!e.statuses[s] || i >= n) continue;
          const [icon] = STATUS_ICONS[s];
          const c = this._statusColors[s];
          ov.push(x, y, z, sz, sz, R[icon], c.r, c.g, c.b, veiledA, 0, (i - (n - 1) / 2) * (sz + 0.02), oy);
          i++;
        }
      }
    }
  }

  dispose() {
    for (const v of this.towers.values()) this._disposeView(v);
    for (const v of this.enemies.values()) this._disposeView(v);
    this.towers.clear();
    this.enemies.clear();
    for (const g of Object.values(this.projGeo)) g.dispose();
    this.projMat.dispose();
    for (const mesh of Object.values(this.proj)) mesh.dispose();
    this.droneGeo.dispose();
    this.droneMat.dispose();
    this.drones.dispose();
    this.scene.remove(this.root);
  }
}
