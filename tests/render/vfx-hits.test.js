// Finishing the VFX update (docs/VFX.md "Hits that land", "Blasts", "Flash safety"): local holds
// of the struck enemy (a few a wave, never the board), per-girl weak / strong / crit impact
// presets, working out who dealt a hit, the flash guard counting flashing screen AREA a second
// (many small flashes add up), blast bodies drawn as alpha cel shapes with only an additive core,
// and Marumi's camera jolts settled (her Glow Bowl finale and Giant Strike jolt once; her ordinary
// blasts never shake). Everything here changes only what is drawn.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { VisualClock } from '../../src/render/vfx/clock.js';
import { HitStopDirector, BIG_SHARE } from '../../src/render/vfx/hitStop.js';
import { LocalHoldDirector, LOCAL_HOLD } from '../../src/render/vfx/localHold.js';
import { HitSource } from '../../src/render/vfx/hitSource.js';
import { presetFor, impactClass, impactLook, mayLand, GIRL_WEIGHT, WEIGHT, FRAME } from '../../src/render/vfx/impactPresets.js';
import {
  FlashGuard, AREA_BUDGET, WORLD_BUDGET, WORLD_DIM, FLASH_WINDOW, FAINT, MAX_FLASH, IMPACT_COST, SOFT_AREA,
  AreaMeter, isWorldFlash, screenShare, WORLD_FLASH,
} from '../../src/render/vfx/flashGuard.js';
import { createHitFeel, momentTrauma, explodeShakes, MOMENT_TRAUMA } from '../../src/render/vfx/feel.js';
import { Actors } from '../../src/render/actors.js';
import { QuadBatch } from '../../src/render/batch.js';
import { FxSystem, BLAST } from '../../src/render/fx.js';
import { createContext } from '../../src/render/attackFx/context.js';
import { createVisualRandom } from '../../src/render/vfx/random.js';
import { UNITS } from '../../src/data/units.js';
import { Sim } from '../../src/sim/Sim.js';
import { autoPlan } from '../../src/sim/headless.js';
import { harness, gallerySim, streamer } from './attackFxHarness.js';

const F = 1 / 60;

describe('local holds: freeze the struck, not the world', () => {
  const setup = (o = {}) => {
    const clock = new VisualClock({ reduceMotion: !!o.reduceMotion });
    let on = o.enabled ?? true;
    let busy = !!o.busy;
    const holds = new LocalHoldDirector(clock, { enabled: () => on, busy: () => busy });
    clock.tick(F);
    return { clock, holds, set: (v) => { on = v; }, setBusy: (v) => { busy = v; } };
  };

  it('holds 2-4 frames (capped at 4), never touching the visual clock', () => {
    const { clock, holds } = setup();
    expect(holds.request(1, 2)).toBeCloseTo(2 * FRAME, 9);
    expect(holds.request(2, 9)).toBeCloseTo(LOCAL_HOLD.maxFrames * FRAME, 9);
    expect(LOCAL_HOLD.maxFrames).toBe(4);
    expect(holds.request(3, 0)).toBe(0);
    expect(clock.freezeLeft).toBe(0); // the board never holds
  });

  it('a few a second at most, fewer in a busy fight, ≤ 2 a frame, and the same enemy waits its gap', () => {
    const { clock, holds, setBusy } = setup();
    expect(holds.request(1, 3)).toBeGreaterThan(0);
    expect(holds.request(2, 3)).toBeGreaterThan(0);
    expect(holds.request(3, 3)).toBe(0); // per frame
    clock.tick(F);
    expect(holds.request(1, 3)).toBe(0); // same enemy, too soon
    let n = 2;
    for (let f = 0; f < 55; f++) {
      clock.tick(F);
      if (holds.request(10 + f, 3) > 0) n++;
    }
    expect(n).toBeLessThanOrEqual(LOCAL_HOLD.perSecond); // inside one second
    for (let f = 0; f < 70; f++) clock.tick(F);
    setBusy(true);
    let b = 0;
    for (let f = 0; f < 59; f++) {
      clock.tick(F);
      if (holds.request(200 + f, 3) > 0) b++;
    }
    expect(b).toBeLessThanOrEqual(LOCAL_HOLD.busyPerSecond);
    expect(b).toBeGreaterThan(0);
  });

  it('none with Reduce Motion or Flashes & shake off (read live)', () => {
    const rm = setup({ reduceMotion: true });
    expect(rm.holds.request(1, 4)).toBe(0);
    const off = setup({ enabled: false });
    expect(off.holds.request(1, 4)).toBe(0);
    off.set(true);
    expect(off.holds.request(1, 4)).toBeGreaterThan(0);
  });

  it('the held enemy keeps its look (place, pose, squash) with a tiny jitter, then catches up; others carry on', () => {
    const view = (uid, x) => ({ uid, x, z: 2, y: 0, facing: 0, holdLeft: 0, model: { position: new THREE.Vector3(x, 0, 2) } });
    const a = view(1, 3);
    const b = view(2, 5);
    const host = { enemies: new Map([[1, a], [2, b]]) };
    expect(Actors.prototype.holdEnemy.call(host, 1, 3 * F, LOCAL_HOLD.jitter)).toBe(true);
    expect(Actors.prototype.holdEnemy.call(host, 99, 3 * F)).toBe(false);
    expect(b.holdLeft).toBe(0);
    const xs = [];
    let held = 0;
    for (let f = 0; f < 6; f++) {
      if (a.holdLeft > 0 && Actors.prototype._hold.call(host, a, F)) {
        held++;
        xs.push(a.model.position.x);
      }
    }
    expect(held).toBeGreaterThanOrEqual(2);
    expect(held).toBeLessThanOrEqual(3);
    for (const x of xs) expect(Math.abs(x - 3)).toBeLessThanOrEqual(LOCAL_HOLD.jitter + 1e-9);
    expect(new Set(xs.map((x) => Math.sign(x - 3))).size).toBe(2); // it jitters side to side
    expect(a.holdLeft).toBe(0);
    // the actors module holds live enemies and death clips the same way
    const src = readFileSync('src/render/actors.js', 'utf8');
    expect(src).toMatch(/_updateEnemy\(v, e, dt\) \{\s*const m = v\.model;\s*if \(v\.holdLeft > 0 && this\._hold\(v, dt\)\) return;/);
    expect(src).toMatch(/if \(v\.holdLeft > 0 && this\._hold\(v, dt\)\) continue;/);
  });
});

describe('impact presets: weak / strong / crit per girl', () => {
  it('every girl has a preset; a crit holds longest, a strong hit holds 2-4 frames, a weak hit never holds', () => {
    for (const u of UNITS) {
      expect(GIRL_WEIGHT[u.id], `${u.id} has a weight class`).toBeTruthy();
      const p = presetFor(u.id);
      expect(p.weak.hold).toBe(0);
      if (p.weight === 'none') continue;
      expect(p.strong.hold).toBeGreaterThanOrEqual(2);
      expect(p.crit.hold).toBeGreaterThanOrEqual(p.strong.hold);
      expect(p.crit.hold).toBeLessThanOrEqual(LOCAL_HOLD.maxFrames);
      expect(p.crit.squash).toBeGreaterThanOrEqual(p.strong.squash);
      expect(p.strong.squash).toBeGreaterThan(p.weak.squash);
    }
    expect(Object.keys(GIRL_WEIGHT).length).toBe(UNITS.length);
  });

  it('heavy hitters land strong from a smaller share; light ones only on heavy enemies; crits on heavy enemies are crits; no-damage girls never hold', () => {
    const trash = { maxHp: 1000, tier: null };
    const elite = { maxHp: 1000, tier: 'elite' };
    const hit = (amount, crit = false) => ({ amount, crit });
    // an ordinary enemy: only a real blow holds
    expect(impactClass(hit(400), trash, 'marumi')).toBe('strong');
    expect(impactClass(hit(300), trash, 'marumi')).toBe('weak');
    expect(impactClass(hit(400), trash, 'aoi')).toBe('weak');
    expect(impactClass(hit(800), trash, 'aoi')).toBe('strong');
    expect(impactClass(hit(950), trash, 'kage')).toBe('weak'); // a stream of small hits never holds on trash
    expect(impactClass(hit(10, true), trash, 'kage')).toBe('weak'); // a small crit is a small hit
    expect(impactClass(hit(400, true), trash, 'kage')).toBe('crit');
    // a heavy enemy: a smaller share holds, and every crit does
    expect(impactClass(hit(70), elite, 'marumi')).toBe('strong');
    expect(impactClass(hit(70), elite, 'aoi')).toBe('weak');
    expect(impactClass(hit(120), elite, 'aoi')).toBe('strong');
    expect(impactClass(hit(120), elite, 'kage')).toBe('weak');
    expect(impactClass(hit(200), elite, 'kage')).toBe('strong');
    expect(impactClass(hit(1, true), elite, 'kage')).toBe('crit');
    expect(impactClass(hit(500, true), elite, 'wakaba')).toBe('weak');
    expect(impactClass(hit(800), trash, null)).toBe('strong'); // unknown hitter: the normal preset
    expect(impactLook('marumi', 'strong').hold).toBe(WEIGHT.heavy.strong);
    expect(impactLook('kage', 'crit').hold).toBe(WEIGHT.light.crit);
    expect(impactLook('aoi', 'weak', true).squash).toBeGreaterThan(impactLook('aoi', 'weak').squash);
    expect(impactLook('aoi', 'weak').hold).toBe(0);
    // the cheap pre-check never skips a hit that could land hard
    expect(mayLand(hit(1, true), elite)).toBe(true);
    expect(mayLand(hit(50), elite)).toBe(false);
    expect(mayLand(hit(70), elite)).toBe(true);
    expect(mayLand(hit(290), trash)).toBe(false);
    expect(mayLand(hit(310), trash)).toBe(true);
    expect(mayLand(hit(1, true), null)).toBe(false);
    expect(BIG_SHARE).toBeGreaterThan(WEIGHT.heavy.heavyShare);
  });

  it('a real battle gets a few local holds a wave, not zero, and never more than a few a second', () => {
    const ids = ['marumi', 'aoi', 'kage', 'sango', 'hotaru', 'kinu'];
    const plan = autoPlan('2-1', ids);
    const sim = new Sim({ stageId: '2-1', seed: 7, loadout: ids.map((unitId) => ({ unitId })), options: { autoStart: false } });
    const pending = plan.slice();
    // the plan as a player would afford it (headless.js executeAction): wait for the coins
    const act = (a) => {
      if (a.action === 'place') {
        const chk = sim.canPlace(a.unitId, a.x, a.y);
        if (chk.ok) return sim.placeTower(a.unitId, a.x, a.y) ? 'done' : 'fail';
        return chk.reason === 'cash' ? 'wait' : 'fail';
      }
      if (a.action === 'upgrade') {
        const t = a.uid != null ? sim.getTower(a.uid) : sim.towerAt(a.x ?? a.tx, a.y ?? a.ty);
        if (!t) return 'fail';
        const st = sim.upgradeStatus(t.uid, a.path ?? 0);
        if (!st.locked) return sim.upgradeTower(t.uid, a.path ?? 0) ? 'done' : 'fail';
        return st.reason === 'cash' ? 'wait' : 'fail';
      }
      return 'fail';
    };
    const clock = new VisualClock();
    const director = new HitStopDirector(clock);
    const holds = new LocalHoldDirector(clock, { busy: () => director.busy });
    const feel = createHitFeel({
      reduceMotion: false, hitEffects: () => true, placing: () => false, now: () => clock.realT, tier: () => 'high',
      guard: new FlashGuard(), director, holds, impact: { active: false, start() {} }, rig: { kick() {}, punch() {} }, tint() {},
    });
    const source = new HitSource();
    let views = new Map();
    const perWave = new Map();
    const byGirl = {};
    let held = 0;
    let credited = 0;
    let candidates = 0;
    for (let f = 0; f < 60 * 60 * 10 && sim.wave <= 10 && sim.state !== 'won' && sim.state !== 'lost'; f++) {
      while (pending.length && (pending[0].at ?? 1) <= sim.wave + 1) {
        if (act(pending[0]) === 'wait') break;
        pending.shift();
      }
      if (sim.state === 'prep' || sim.state === 'between') sim.startNextWave();
      sim.update(F);
      clock.tick(F);
      const events = sim.drainEvents();
      let hits = 0;
      for (const ev of events) if (ev.type === 'hit') hits++;
      director.noteHits(hits);
      source.frame(sim.projectiles);
      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        if (ev.type !== 'hit') continue;
        const view = views.get(ev.uid) || null;
        if (!mayLand(ev, view)) continue;
        candidates++;
        const owner = source.owner(events, i);
        const unit = owner != null ? sim.getTower(owner)?.unitId ?? null : null;
        if (unit) credited++;
        const cls = impactClass(ev, view, unit);
        const lk = impactLook(unit, cls);
        if (lk.hold > 0 && feel.hold(ev.uid, cls, lk.hold) > 0) {
          held++;
          perWave.set(sim.wave, (perWave.get(sim.wave) || 0) + 1);
          byGirl[unit || '?'] = (byGirl[unit || '?'] || 0) + 1;
        }
      }
      // what the renderer's enemy views know next frame (max HP, tier)
      views = new Map(sim.enemies.map((e) => [e.uid, { maxHp: e.maxHp, tier: e.tier || e.def?.tier || null }]));
    }
    const waves = [...perWave.keys()].length;
    expect(waves).toBeGreaterThanOrEqual(4);
    const avg = held / Math.max(1, sim.wave);
    expect(avg).toBeGreaterThanOrEqual(1); // a few a wave…
    expect(held / Math.max(1, clock.frameT)).toBeLessThanOrEqual(LOCAL_HOLD.perSecond); // …never a stutter
    expect(credited / Math.max(1, candidates)).toBeGreaterThan(0.6); // most hard hits are credited to the girl who dealt them
    expect(byGirl.marumi || 0).toBeGreaterThan(0); // the heavy hitter lands strong hits
  }, 120000);
});

describe('who dealt a hit (hit source)', () => {
  it('a shot that landed, an instant attack after its hits, a girl\'s own blast, a shell, a projectile\'s splash', () => {
    const s = new HitSource();
    const arrow = { uid: 50, ownerUid: 7, target: { uid: 3 }, x: 4, y: 4 };
    const shell = { uid: 51, ownerUid: 8, target: { uid: 9 }, x: 10, y: 10 };
    s.frame([arrow, shell]);
    s.frame([]); // both landed since the last frame
    const evs = [
      { type: 'hit', uid: 3 }, // arrow 50 (girl 7)
      { type: 'hit', uid: 4 }, { type: 'status', uid: 4 }, { type: 'pulse', towerUid: 11 }, { type: 'attack', towerUid: 11, kind: 'pulse' },
      { type: 'hit', uid: 5 }, { type: 'death', uid: 5 }, { type: 'explode', towerUid: 12, x: 1, y: 1 }, { type: 'ballPop', towerUid: 12 },
      { type: 'hit', uid: 6 }, { type: 'explode', x: 2, y: 2 }, { type: 'shellLand', towerUid: 13 },
      { type: 'hit', uid: 9 }, // shell projectile's target (girl 8)
      { type: 'hit', uid: 20 }, { type: 'explode', x: 10.3, y: 9.8 }, // splash next to where shell 51 was last seen
      { type: 'hit', uid: 21 }, { type: 'attack', towerUid: 14, kind: 'slash' },
      { type: 'hit', uid: 22 }, { type: 'attack', towerUid: 15, kind: 'arrow' }, // a shot being fired: not who hit
      { type: 'hit', uid: 23 }, { type: 'trapTriggered', ownerUid: 16, strip: true },
    ];
    const at = (uid) => s.owner(evs, evs.findIndex((e) => e.type === 'hit' && e.uid === uid));
    expect(at(3)).toBe(7);
    expect(at(4)).toBe(11);
    expect(at(5)).toBe(12);
    expect(at(6)).toBe(13);
    expect(at(9)).toBe(8);
    expect(at(20)).toBe(8);
    expect(at(21)).toBe(14);
    expect(at(22)).toBe(null);
    expect(at(23)).toBe(16);
    // the next frame those shots are no longer "just landed"
    s.frame([]);
    expect(s.owner([{ type: 'hit', uid: 3 }], 0)).toBe(null);
  });
});

describe('flash guard: flashing screen area a second', () => {
  it('many small flashes add up: the counted area in any second stays within the budget, the rest are drawn dim', () => {
    const g = new FlashGuard();
    const rand = createVisualRandom(5);
    const log = []; // [t, area counted]
    let dim = 0;
    let t = 0;
    for (let i = 0; i < 4000; i++) {
      t += rand() * 0.004; // ~500 small flashes a second
      const area = 0.004 + rand() * 0.01;
      const k = g.world(area, 1, t);
      if (k === 1) log.push([t, area]);
      else {
        expect(k).toBe(WORLD_DIM);
        dim++;
      }
    }
    expect(dim).toBeGreaterThan(0);
    let worst = 0;
    for (let i = 0; i < log.length; i++) {
      let s = 0;
      for (let j = i; j < log.length && log[j][0] < log[i][0] + FLASH_WINDOW; j++) s += log[j][1];
      worst = Math.max(worst, s);
    }
    expect(worst).toBeLessThanOrEqual(WORLD_BUDGET + 1e-9);
    expect(worst).toBeGreaterThan(WORLD_BUDGET * 0.8); // and they are not dimmed early
  });

  it('a full-screen flash counts one screen; world flashes leave room for the big moments, and fill the rest', () => {
    const g = new FlashGuard();
    for (let i = 0; i < 400; i++) g.world(0.01, 1, i * 0.002); // two screens' worth of small flashes in 0.8 s
    expect(g.load(0.8)).toBeCloseTo(WORLD_BUDGET, 6);
    expect(g.flash(0.4, 0.81)).toBe(0.4); // a screen flash still gets through…
    expect(g.flash(0.4, 0.82)).toBeLessThanOrEqual(FAINT); // …but the second-worth of area is now spent
    expect(g.impact(0.83)).toBe(false);
    expect(g.load(0.83)).toBeLessThanOrEqual(AREA_BUDGET + 1e-9);
    // a quiet second later the impact frame has its room again
    expect(g.impact(2)).toBe(true);
    expect(g.load(2)).toBe(IMPACT_COST);
  });

  it('with Reduce Motion the area budgets are halved; dim flashes never count', () => {
    const g = new FlashGuard({ reduceMotion: true });
    expect(g.areaBudget).toBeCloseTo(AREA_BUDGET * SOFT_AREA, 9);
    expect(g.worldBudget).toBeCloseTo(WORLD_BUDGET * SOFT_AREA, 9);
    let counted = 0;
    for (let i = 0; i < 300; i++) if (g.world(0.01, 1, i * 0.001) === 1) counted += 0.01;
    expect(counted).toBeLessThanOrEqual(WORLD_BUDGET * SOFT_AREA + 1e-9);
    expect(g.load(0.3)).toBeCloseTo(counted, 9);
  });

  it('the area meter never undercounts a sliding second', () => {
    const m = new AreaMeter();
    m.add(0.01, 1);
    expect(m.sum(1.0)).toBe(1); // still inside the second
    expect(m.sum(1.2)).toBe(0);
    m.add(5, 0.5);
    m.add(5.5, 0.25);
    expect(m.sum(5.9)).toBeCloseTo(0.75, 9);
    expect(m.sum(60)).toBe(0);
  });

  it('which sprites are world flashes, and how much screen they cover', () => {
    expect(isWorldFlash(0.2, 0.5)).toBe(true);
    expect(isWorldFlash(0.6, 2)).toBe(false); // a lingering glow
    expect(isWorldFlash(0.1, 0.1)).toBe(false); // a small spark
    expect(screenShare(0, 844, 390)).toBe(0);
    expect(screenShare(100, 844, 390, 1)).toBeCloseTo((Math.PI * 2500) / (844 * 390), 9);
    expect(screenShare(1e5, 844, 390)).toBe(1);
  });

  it('FX particles and attack-FX quads that are world flashes ask the guard, and are dimmed when it says so', () => {
    const atlas = { texture: new THREE.Texture(), regions: { glow: [0, 0, 1, 1], soft: [0, 0, 1, 1], smoke: [0, 0, 1, 1], shadow: [0, 0, 1, 1], ring: [0, 0, 1, 1], ringThick: [0, 0, 1, 1], shard: [0, 0, 1, 1], spark: [0, 0, 1, 1], star: [0, 0, 1, 1], dot: [0, 0, 1, 1] }, glyph: () => [0, 0, 1, 1], glyphAspect: 0.7 };
    const mk = (o) => new QuadBatch({ texture: atlas.texture, max: 4000, ...o });
    const batches = { groundN: mk({ mode: 'ground' }), groundA: mk({ mode: 'ground', blending: 'additive' }), bbN: mk({}), bbA: mk({ blending: 'additive' }), overlay: mk({ depthTest: false }) };
    const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
    const fx = new FxSystem({ atlas, batches, camera, rand: createVisualRandom(1) });
    const asked = [];
    fx.flashGate = (size, uv, a) => {
      asked.push(size);
      return WORLD_DIM;
    };
    fx.flash(0, 0.4, 0, '#ffffff', 1, 0.2); // a flash
    fx.spawn({ batch: 'bbA', uv: atlas.regions.glow, x: 0, y: 0, z: 0, s0: 0.1, life: 0.2 }); // too small
    fx.spawn({ batch: 'bbA', uv: atlas.regions.glow, x: 0, y: 0, z: 0, s0: 1, life: 1 }); // lingering
    fx.spawn({ batch: 'bbN', uv: atlas.regions.smoke, x: 0, y: 0, z: 0, s0: 1, life: 0.2 }); // not additive
    expect(asked).toEqual([1.4]);
    expect(fx.parts[0].a0).toBeCloseTo(WORLD_DIM, 9);
    expect(fx.parts[1].a0).toBe(1);
    const ctx = createContext({ sim: {}, actors: {}, fx, batches, atlas, camera, rig: null, quality: 'high' });
    const asked2 = [];
    ctx.flashGate = (size) => {
      asked2.push(size);
      return WORLD_DIM;
    };
    ctx.beginFrame();
    const p = ctx.spr(batches.bbA, ctx.CORE, atlas.regions.glow, 0, 0.3, 0, 0.6, 0.8, 0.12, ctx.col('#ffffff'), 1);
    ctx.spr(batches.bbN, ctx.CORE, atlas.regions.glow, 0, 0.3, 0, 0.6, 0.8, 0.12, ctx.col('#ffffff'), 1);
    expect(asked2).toEqual([0.8]);
    expect(p.a0).toBeCloseTo(WORLD_DIM, 9);
    expect(WORLD_FLASH.life).toBeLessThanOrEqual(0.35);
    expect(MAX_FLASH).toBeLessThan(0.6);
  });
});

describe('blasts: cel bodies, an additive core only', () => {
  const setup = () => {
    const names = ['glow', 'soft', 'smoke', 'shadow', 'ring', 'ringThick', 'ringSoft', 'shard', 'spark', 'star', 'dot', 'celPuff'];
    const regions = {};
    names.forEach((n, i) => { regions[n] = [i / 16, 0, (i + 1) / 16, 1]; });
    const atlas = { texture: new THREE.Texture(), regions, glyph: () => regions.dot, glyphAspect: 0.7 };
    const mk = (o) => new QuadBatch({ texture: atlas.texture, max: 4000, ...o });
    const batches = { groundN: mk({ mode: 'ground' }), groundA: mk({ mode: 'ground', blending: 'additive' }), bbN: mk({}), bbA: mk({ blending: 'additive' }), overlay: mk({ depthTest: false }) };
    const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
    const fx = new FxSystem({ atlas, batches, camera, rand: createVisualRandom(9) });
    fx.setQuality('high');
    return { fx, regions };
  };

  it('the body, the lit puff, the fire puffs and the ring are alpha-blended cel shapes; the only additive part is a small core', () => {
    const { fx, regions } = setup();
    const r = 1.2;
    fx.explosion(5, 5, r, '#ffb347');
    const add = fx.parts.filter((p) => p.batch === 'bbA' || p.batch === 'groundA');
    expect(add.length).toBe(1);
    expect(add[0].uv).toBe(regions.glow);
    expect(Math.max(add[0].s0, add[0].s1)).toBeLessThanOrEqual(r * BLAST.core.s1 + 1e-9);
    expect(add[0].life).toBeLessThanOrEqual(0.15);
    const cel = fx.parts.filter((p) => p.uv === regions.celPuff);
    expect(cel.length).toBeGreaterThanOrEqual(4);
    for (const p of cel) expect(p.batch).toBe('bbN');
    const body = cel.reduce((a, b) => (Math.max(b.s0, b.s1) > Math.max(a.s0, a.s1) ? b : a));
    expect(body.s1 / body.s0).toBeCloseTo(1.25, 6); // it swells 1 → 1.25
    // the body holds its shape, then fades (a drawn shape, not a mist)
    const ring = fx.parts.find((p) => p.uv === regions.ringThick);
    expect(ring.batch).toBe('groundN');
    // the body keeps the blast's colour (tinted cel greys), the core stays the hot white-gold
    expect(new THREE.Color(body.r, body.gc, body.bc).getHexString()).toBe(new THREE.Color('#ffb347').getHexString());
  });

  it('Marumi\'s ball pops: hard alpha rings, a small additive core flash', () => {
    const sim = gallerySim(['marumi'], [[2, 0, 5]]);
    const h = harness(sim, { strict: true });
    const feed = streamer(sim, 0.25, 400);
    let pops = 0;
    for (let i = 0; i < 900 && pops < 3; i++) {
      feed(1 / 30);
      h.frame(1 / 30, 1, (evs) => { for (const e of evs) if (e.type === 'ballPop') pops++; });
    }
    expect(pops).toBeGreaterThan(0);
    const live = h.fxa.ctx.pool.live;
    const rings = live.filter((p) => p.B === h.batches.groundN || p.B === h.batches.groundA);
    for (const p of rings) expect(p.B).toBe(h.batches.groundN);
  }, 60000);
});

describe('Marumi\'s jolts, settled: the Glow Bowl finale and Giant Strike jolt once; her ordinary blasts never shake', () => {
  it('which events jolt', () => {
    expect(momentTrauma({ type: 'ballPop', fin: true })).toBe(MOMENT_TRAUMA.finale);
    expect(momentTrauma({ type: 'ballPop', fin: false })).toBe(0);
    expect(momentTrauma({ type: 'runner', kind: 'giantBall' })).toBe(MOMENT_TRAUMA.giantStrike);
    expect(momentTrauma({ type: 'runner', kind: 'dragon' })).toBe(0);
    expect(momentTrauma({ type: 'bladeArt', storm: 1 })).toBe(MOMENT_TRAUMA.bladeArt);
    expect(momentTrauma({ type: 'hit' })).toBe(0);
    // an explosion one of her balls set off never shakes, however big; other big blasts do
    expect(explodeShakes({ radius: 2.4, towerUid: 5 }, 1.6)).toBe(false);
    expect(explodeShakes({ radius: 2.4 }, 1.6)).toBe(true);
    expect(explodeShakes({ radius: 1.2 }, 1.6)).toBe(false);
  });

  it('at T5 (Glow Bowl) the finale really fires in a battle, and gets exactly one jolt per finale, ≥ 0.8 s apart', () => {
    const sim = gallerySim(['marumi'], [[2, 0, 5]]);
    const feed = streamer(sim, 0.12, 4000);
    const kicks = [];
    const clock = new VisualClock();
    const feel = createHitFeel({
      reduceMotion: false, hitEffects: () => true, placing: () => false, now: () => clock.realT, tier: () => 'high',
      guard: new FlashGuard(), director: new HitStopDirector(clock), impact: { active: false, start() {} },
      rig: { kick: (t) => kicks.push([clock.frameT, t]), punch() {} }, tint() {},
    });
    let fins = 0;
    let pops = 0;
    let explodes = 0;
    let last = -Infinity;
    for (let f = 0; f < 60 * 90 && fins < 2; f++) {
      feed(F);
      sim.update(F);
      clock.tick(F);
      for (const ev of sim.drainEvents()) {
        if (ev.type === 'ballPop') {
          pops++;
          if (ev.fin) fins++;
        }
        if (ev.type === 'explode' && ev.towerUid != null) {
          explodes++;
          expect(explodeShakes(ev, 1.6)).toBe(false);
        }
        const m = momentTrauma(ev);
        if (m > 0 && clock.frameT - last >= 0.8 && feel.shake(m)) last = clock.frameT;
      }
    }
    expect(fins).toBeGreaterThan(0);
    expect(pops).toBeGreaterThan(fins * 8); // the finale comes after the 8th bounce
    expect(explodes).toBeGreaterThan(0);
    // a jolt for the finale, none for the ordinary blasts (two finales inside 0.8 s share one)
    expect(kicks.length).toBeGreaterThanOrEqual(1);
    expect(kicks.length).toBeLessThanOrEqual(fins);
    for (const [, t] of kicks) expect(t).toBeCloseTo(MOMENT_TRAUMA.finale, 9);
    for (let i = 1; i < kicks.length; i++) expect(kicks[i][0] - kicks[i - 1][0]).toBeGreaterThanOrEqual(0.8 - 1e-9);
  }, 120000);

  it('the docs say what the code does', () => {
    const doc = readFileSync('docs/VFX.md', 'utf8');
    expect(doc).not.toMatch(/Marumi's blasts included/);
    expect(doc).toMatch(/Marumi's ordinary blasts never shake/);
  });
});
