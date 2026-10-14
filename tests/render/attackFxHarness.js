// Node harness for attack-FX tests: the real attack-FX layer over a real Sim, with stand-ins for
// the WebGL parts (atlas regions, actor views) — no DOM, no WebGL.
import * as THREE from 'three';
import { QuadBatch } from '../../src/render/batch.js';
import { FxSystem } from '../../src/render/fx.js';
import { createAttackFx } from '../../src/render/attackFx/index.js';
import { Sim } from '../../src/sim/Sim.js';
import { UNIT_MAP } from '../../src/data/units.js';
import { STAGE_MAP } from '../../src/data/stages.js';
import { buildMapTracks } from '../../src/core/track.js';

const UV = [0, 0, 1, 1];

export function fakeAtlas() {
  const regions = new Proxy({}, { get: () => UV });
  return { texture: new THREE.Texture(), regions, glyph: () => UV, glyphAspect: 0.7 };
}

/** Actor views kept in sync with the sim (what attackFx reads from actors). */
export class FakeActors {
  constructor(sim) {
    this.sim = sim;
    this.enemies = new Map();
    this.towers = new Map();
    this.root = new THREE.Group();
    this.droneGeo = new THREE.BoxGeometry(0.2, 0.1, 0.2);
    this.droneMat = new THREE.MeshBasicMaterial();
    this.clips = 0;
  }

  playAttack() {
    this.clips++;
  }

  sync() {
    const seen = new Set();
    for (const t of this.sim.towers) {
      seen.add(t.uid);
      let v = this.towers.get(t.uid);
      if (!v) {
        v = { uid: t.uid, model: { position: { x: t.x, y: 0.05, z: t.y } }, facing: t.facing || 0, scale: t.isHero ? 1.36 : 1.22 };
        this.towers.set(t.uid, v);
      }
      v.facing = t.facing || 0;
    }
    for (const uid of [...this.towers.keys()]) if (!seen.has(uid)) this.towers.delete(uid);
    seen.clear();
    for (const e of this.sim.enemies) {
      if (e.dead) continue;
      seen.add(e.uid);
      let v = this.enemies.get(e.uid);
      if (!v) {
        v = { uid: e.uid, x: e.x, z: e.y, y: 0, height: 0.6, facing: 0, hidden: false };
        this.enemies.set(e.uid, v);
      }
      v.x = e.x;
      v.z = e.y;
      v.y = e.alt || 0;
      v.facing = e.facing || 0;
      v.hidden = !!e.hidden;
    }
    for (const uid of [...this.enemies.keys()]) if (!seen.has(uid)) this.enemies.delete(uid);
  }
}

/**
 * Builds the attack-FX layer over a sim. Returns { fxa, actors, fx, batches, frame(dt, speed) }.
 * frame() follows BattleRenderer.update's order (begin → events → sync/projectiles → update).
 */
export function harness(sim, { quality = 'high', strict = false, reduceMotion = false } = {}) {
  const atlas = fakeAtlas();
  const mk = (o) => new QuadBatch({ texture: atlas.texture, max: 6000, ...o });
  const batches = { groundN: mk({ mode: 'ground' }), groundA: mk({ mode: 'ground', blending: 'additive' }), bbN: mk({}), bbA: mk({ blending: 'additive' }), overlay: mk({ depthTest: false }) };
  const camera = new THREE.OrthographicCamera(-10, 10, 6, -6, 0.1, 100);
  camera.position.set(10, 30, 30);
  camera.lookAt(10, 0, 8);
  camera.updateMatrixWorld();
  const fx = new FxSystem({ atlas, batches, camera });
  fx.setQuality(quality);
  const actors = new FakeActors(sim);
  const fxa = createAttackFx({ sim, scene: new THREE.Scene(), actors, fx, batches, atlas, camera, rig: { scale: 1 / 42 }, quality, reduceMotion, strict });
  const list = Object.values(batches);
  const stats = { events: 0, handled: 0, projViews: 0 };
  function frame(dt, speed = 1, onEvents = null) {
    if (speed > 0) sim.update(dt * speed);
    fxa.setTimeScale(speed);
    const events = sim.drainEvents();
    if (onEvents) onEvents(events);
    for (const b of list) b.begin();
    for (let i = 0; i < events.length; i++) {
      stats.events++;
      if (fxa.onEvent(events[i], i, events)) stats.handled++;
    }
    actors.sync();
    for (const p of sim.projectiles) if (fxa.projectile(p, dt)) stats.projViews++;
    fxa.update(dt);
    fx.update(dt);
    for (const b of list) b.end();
    return events;
  }
  return { fxa, actors, fx, batches, frame, stats };
}

/** The preview's gallery map (one serpentine lane, booths between the runs). */
export function galleryData(ponds = []) {
  const W = 30;
  const H = 17;
  const rows = [];
  for (let y = 0; y < H; y++) {
    let r = '';
    for (let x = 0; x < W; x++) r += ponds.some(([px, py]) => Math.abs(x + 0.5 - px) <= 1.1 && Math.abs(y + 0.5 - py) <= 0.6) ? '~' : '.';
    rows.push(r);
  }
  const L = '-';
  const paths = [[
    [-1, 2.5], L, [26.6, 2.5], [28.4, 3.3], [28.7, 4.5], [28.4, 5.7], [26.6, 6.5], L, [3.4, 6.5], [1.6, 7.3], [1.3, 8.5], [1.6, 9.7], [3.4, 10.5],
    L, [26.6, 10.5], [28.4, 11.3], [28.7, 12.5], [28.4, 13.7], [26.6, 14.5], L, [-1, 14.5],
  ]];
  const { tracks, crossings } = buildMapTracks(paths, 'bridge');
  const map = {
    id: 'fx_gallery', name: 'Attack Gallery', theme: 'sakura', tier: 'beginner', width: W, height: H, rows, tracks, crossings,
    paths: tracks.map((t) => t.points.map(([x, y]) => [x - 0.5, y - 0.5])), decor: [],
  };
  const stage = { ...STAGE_MAP['1-1'], id: 'fx-gallery', mapId: 'fx_gallery', waves: 999, lives: 1e6, startCash: 1e9 };
  const units = {};
  for (const id of Object.keys(UNIT_MAP)) if (UNIT_MAP[id].kind === 'hero') units[id] = { ...UNIT_MAP[id], kind: 'tower' };
  return { map, stage, units };
}

/** Places `ids` on the gallery map with builds ([a,b,c] each) and returns the Sim. */
export function boothOf(i) {
  return [3 + ((Math.floor(i / 3) * 4.3) % 25), [4.5, 8.5, 12.5][i % 3]];
}

export function gallerySim(ids, builds, seed = 3) {
  const ponds = ids.map((id, i) => (UNIT_MAP[id].placement === 'water' ? boothOf(i) : null)).filter(Boolean);
  const data = galleryData(ponds);
  const sim = new Sim({ stageId: 'fx-gallery', seed, loadout: Object.keys(UNIT_MAP).map((unitId) => ({ unitId })), options: { autoStart: true }, data });
  sim.cash = 1e9;
  sim.lives = 1e9;
  sim.placedIds = [];
  ids.forEach((id, i) => {
    const [x, row] = boothOf(i);
    let t = null;
    for (let r = 0; r <= 1.6 && !t; r += 0.2) {
      for (let a = 0; a < 6.28 && !t; a += 0.5) t = sim.placeTower(id, x + Math.sin(a) * r + 1e-4, row + Math.cos(a) * r + 1e-4);
    }
    if (!t) return;
    sim.placedIds.push(id);
    const tiers = builds[i] || [0, 0, 0];
    const order = [0, 1, 2].sort((p, q) => tiers[q] - tiers[p]);
    for (const p of order) for (let k = 0; k < tiers[p]; k++) sim.upgradeTower(t.uid, p);
  });
  sim.startNextWave();
  return sim;
}

/** Keeps enemies streaming (3 ground : 1 air) — call every frame with the game dt. */
export function streamer(sim, every = 0.45) {
  let t = 0;
  let n = 0;
  const ground = ['slime_green', 'goblin_runner', 'slime_pearl'];
  const air = ['goblin_glider', 'slime_bubble'];
  return (gdt) => {
    if (sim.state === 'between' || sim.state === 'prep') sim.startNextWave();
    t -= gdt;
    while (t <= 0) {
      t += every;
      const id = n % 4 === 3 ? air[(n >> 2) % 2] : ground[n % 3];
      n++;
      if (sim.enemies.length < 60) sim.spawnEnemy(id, { dist: 0, pathIndex: 0, hpMul: 40 });
    }
  };
}
