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
import { presetFor, impactClass, impactLook, mayLand, GIRL_WEIGHT, WEIGHT } from '../../src/render/vfx/impactPresets.js';
import {
  FlashGuard, AREA_BUDGET, WORLD_BUDGET, WORLD_DIM, FLASH_WINDOW, FAINT, MAX_FLASH, IMPACT_COST, SOFT_AREA,
  AreaMeter, isWorldFlash, screenShare, WORLD_FLASH,
} from '../../src/render/vfx/flashGuard.js';
import {
  createHitFeel, momentTrauma, explodeShakes, explodeSource, abilityBlastTrauma, MOMENT_TRAUMA, AFTERGLOW, stepTint, FEEL,
} from '../../src/render/vfx/feel.js';
import { ImpactFrames } from '../../src/render/vfx/impact.js';
import { impactMaterial } from '../../src/models/toon.js';
import { buildEnemy, disposeObject } from '../../src/models/index.js';
import { Actors } from '../../src/render/actors.js';
import { QuadBatch } from '../../src/render/batch.js';
import { FxSystem, BLAST, BOUNCE_BODY, bounceBlast, noteBallPop } from '../../src/render/fx.js';
import { PATH_H } from '../../src/render/terrain.js';
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

  it('holds 2-4 rendered frames (capped at 4), never touching the visual clock', () => {
    const { clock, holds } = setup();
    expect(holds.request(1, 2)).toBe(2);
    expect(holds.request(2, 9)).toBe(LOCAL_HOLD.maxFrames);
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

  // a stand-in host for the Actors methods (no scene): views with a fake model that records its look
  const fakeModel = (x) => {
    const calls = [];
    return {
      position: new THREE.Vector3(x, 0, 2),
      scale: new THREE.Vector3(1, 1, 1),
      userData: { animate: (t, dt, o) => calls.push({ dt, moving: o.moving }) },
      calls,
    };
  };
  const host = (views) => Object.assign(Object.create(Actors.prototype), { enemies: new Map(views.map((v) => [v.uid, v])), time: 1 });
  const view = (uid, x) => ({ uid, x, z: 2, y: 0, facing: 0, holdLeft: 0, spawnT: 1, sqA: 0, sqT: 1, model: fakeModel(x) });

  it('a hold lasts exactly its frames, counted in rendered frames: the same at 60 fps and on a 30 fps phone', () => {
    for (const dt of [1 / 60, 1 / 30]) {
      for (const n of [2, 3, 4]) {
        const a = view(1, 3);
        const b = view(2, 5);
        const h = host([a, b]);
        expect(h.holdEnemy(1, n, LOCAL_HOLD.jitter)).toBe(true);
        expect(h.holdEnemy(99, n)).toBe(false);
        expect(b.holdLeft).toBe(0);
        const xs = [];
        let held = 0;
        for (let f = 0; f < 8; f++) {
          if (a.holdLeft > 0 && h._hold(a, dt, true)) {
            held++;
            xs.push(a.model.position.x);
          }
        }
        expect(held, `${n} frames at ${Math.round(1 / dt)} fps`).toBe(n);
        for (const x of xs) expect(Math.abs(x - 3)).toBeLessThanOrEqual(LOCAL_HOLD.jitter + 1e-9);
        expect(new Set(xs.map((x) => Math.sign(x - 3))).size).toBe(2); // it jitters side to side, frame by frame
        expect(a.holdLeft).toBe(0);
      }
    }
  });

  it('a frame drawn with the visual clock stopped (a global hit-stop, a pause) does not use up the hold', () => {
    const a = view(1, 3);
    const h = host([a]);
    h.holdEnemy(1, 2);
    let held = 0;
    for (const dt of [0, 0, F, 0, F, F, F]) if (a.holdLeft > 0 && h._hold(a, dt, true)) held++;
    expect(held).toBe(5); // 3 frozen frames + the 2 frames of the hold
  });

  it('the first held frame already shows the hit: the model is animated with dt 0 (flash at full, no fade) and the squash at its deepest', () => {
    const a = view(1, 3);
    const h = host([a]);
    a.sqA = 0.8; // hitFlash just set the squash (sqT 0)
    a.sqT = 0;
    a.anim = { moving: true, speed: 1 };
    h.holdEnemy(1, 3);
    h._hold(a, F, true);
    expect(a.model.calls).toEqual([{ dt: 0, moving: true }]);
    expect(a.model.scale.y).toBeLessThan(1.12 * 0.85); // squashed down…
    expect(a.model.scale.x).toBeGreaterThan(1.12); // …and out
    const sy = a.model.scale.y;
    h._hold(a, F, true);
    h._hold(a, F, true);
    expect(a.model.calls.length).toBe(1); // then frozen: no more animation while held
    expect(a.model.scale.y).toBe(sy);
    expect(a.sqT).toBe(0); // the wobble starts from the hit once the hold ends
    // a death clip holds its flash too, but not a squash (its clip owns its scale)
    const d = view(2, 6);
    d.sqA = 0.8;
    d.sqT = 0;
    const hd = host([d]);
    hd.holdEnemy(2, 2);
    hd._hold(d, F);
    expect(d.model.calls).toEqual([{ dt: 0, moving: false }]);
    expect(d.model.scale.y).toBe(1);
    // the actors module holds live enemies and death clips the same way
    const src = readFileSync('src/render/actors.js', 'utf8');
    expect(src).toMatch(/_updateEnemy\(v, e, dt\) \{\s*const m = v\.model;\s*if \(v\.holdLeft > 0 && this\._hold\(v, dt, true\)\) return;/);
    expect(src).toMatch(/if \(v\.holdLeft > 0 && this\._hold\(v, dt\)\) continue;/);
  });

  it('a real monster, struck and held as the renderer does it: every held frame shows the flash and the squash, at 60 and 30 fps', () => {
    const def = { id: 'goblin_runner', family: 'goblin', tier: 'normal', size: 1, color: '#7bd389', accent: '#3fa35b', traits: {}, model: { base: 'goblin', variant: 'basic', props: [] } };
    const lookOf = (m) => {
      let em = 0;
      m.traverse((o) => {
        const mat = o.isMesh && !o.userData.isOutline ? o.material : null;
        if (mat && !Array.isArray(mat) && mat.emissive) em = Math.max(em, mat.emissive.r, mat.emissive.g, mat.emissive.b);
      });
      return { em, sy: m.scale.y };
    };
    for (const dt of [1 / 60, 1 / 30]) {
      const model = buildEnemy(def, { quality: 'low' });
      const v = {
        uid: 1, model, x: 4, z: 4, y: 0, facing: 0, statusKey: '', spawnT: 1, size: 1, sqA: 0, sqT: 1, holdLeft: 0,
        veiled: null, phasing: null, barrier: -1, maxHp: 100, height: 0.6,
      };
      const h = Object.assign(Object.create(Actors.prototype), {
        enemies: new Map([[1, v]]), time: 0, casters: new Set(), terrain: { isPath: () => true },
      });
      const e = { uid: 1, x: 4, y: 4, facing: 0, speed: 1, maxHp: 100, statuses: {}, maxBarrier: 0, barrier: 0 };
      const step = () => {
        h.time += dt;
        e.x += dt * 0.8; // the walker keeps walking in the sim
        h._updateEnemy(v, e, dt);
        return lookOf(model);
      };
      for (let f = 0; f < 6; f++) step();
      const before = lookOf(model);
      expect(before.em).toBe(0);
      // the hit (events run before the sync): flash + squash, then the hold
      h.hitFlash(1, new THREE.Color('#ffffff'), 1, 1);
      expect(h.holdEnemy(1, 3, LOCAL_HOLD.jitter)).toBe(true);
      const held = [step(), step(), step()];
      for (const lk of held) {
        expect(lk.em, `held frame at ${Math.round(1 / dt)} fps`).toBeGreaterThan(0.8); // the hit flash is drawn on the hit frame itself
        expect(lk.sy).toBeLessThan(before.sy * 0.85); // squashed, not the pre-hit base
      }
      expect(held[1]).toEqual(held[0]); // frozen while held
      const after = step();
      expect(v.holdLeft).toBe(0);
      expect(after.em).toBeLessThan(held[0].em); // then the flash fades and the wobble runs
      expect(after.sy).not.toBe(held[0].sy);
      disposeObject(model);
    }
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
      { type: 'hit', uid: 24 }, { type: 'attack', towerUid: 17, kind: 'bullet', targetUid: 24 }, // a hitscan shot (Shiro): no projectile, the attack follows its hit
      { type: 'hit', uid: 25 }, { type: 'attack', towerUid: 18, kind: 'bullet', targetUid: 26 }, // someone's shot at another enemy: not who hit
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
    expect(at(24)).toBe(17);
    expect(at(25)).toBe(null);
    // the next frame those shots are no longer "just landed"
    s.frame([]);
    expect(s.owner([{ type: 'hit', uid: 3 }], 0)).toBe(null);
  });

  it('a hitscan girl (Shiro: no projectile in flight) is credited with her hits in a real battle', () => {
    const sim = gallerySim(['shiro'], [[4, 2, 0]]);
    const feed = streamer(sim, 0.4, 40);
    const s = new HitSource();
    const shiro = sim.towers[0].uid;
    let hits = 0;
    let credited = 0;
    for (let f = 0; f < 60 * 50; f++) {
      feed(F);
      sim.update(F);
      const events = sim.drainEvents();
      s.frame(sim.projectiles);
      for (let i = 0; i < events.length; i++) {
        if (events[i].type !== 'hit') continue;
        hits++;
        if (s.owner(events, i) === shiro) credited++;
      }
    }
    expect(hits).toBeGreaterThan(10);
    expect(credited / hits).toBeGreaterThan(0.8);
  });

  it('nothing grows per frame: 1,000 frames of shots coming and going reuse the same few records', () => {
    const s = new HitSource();
    const rand = createVisualRandom(11);
    let live = [];
    let uid = 1;
    let peak = 0;
    let landed = 0;
    for (let f = 0; f < 1000; f++) {
      const keep = live.filter(() => rand() > 0.2); // a fifth of the shots land each frame
      const lost = live.length - keep.length;
      while (keep.length < 40 + Math.round(rand() * 60)) keep.push({ uid: uid++, ownerUid: 7, x: rand() * 20, y: rand() * 20, hits: [] });
      for (const p of keep) if (rand() < 0.05) p.hits.push(1000 + f); // pins piercing walkers
      live = keep;
      peak = Math.max(peak, live.length);
      s.frame(live);
      expect(s.gone.length).toBe(f === 0 ? 0 : lost);
      landed += s.gone.length;
      expect(s.live.size).toBe(live.length); // only the shots in flight are tracked
      expect(s.live.size + s.pool.length).toBe(s.made); // every record is either in use or spare
    }
    expect(landed).toBeGreaterThan(5000);
    expect(s.made).toBeLessThanOrEqual(peak + 100); // records are reused, not made per shot or per frame
    expect(uid).toBeGreaterThan(s.made * 10);
    s.clear();
    expect(s.live.size).toBe(0);
    expect(s.pool.length).toBe(s.made);
    // the header no longer claims what the code doesn't do
    const src = readFileSync('src/render/vfx/hitSource.js', 'utf8');
    expect(src).not.toMatch(/for \(const \[/);
    expect(src).toMatch(/forEach\(this\._sweep\)/);
  });

  it('skipped while no hit can hold its enemy (Low, Reduce Motion, Flashes & shake off), back as soon as one can', () => {
    const make = (o) => {
      const clock = new VisualClock({ reduceMotion: !!o.reduceMotion });
      const director = new HitStopDirector(clock);
      let on = o.hitEffects ?? true;
      const feel = createHitFeel({
        reduceMotion: !!o.reduceMotion, hitEffects: () => on, placing: () => false, now: () => clock.realT, tier: () => o.tier || 'high',
        guard: new FlashGuard(), director, holds: new LocalHoldDirector(clock, { enabled: () => on }), impact: { active: false, start() {} },
        rig: { kick() {}, punch() {} }, tint() {},
      });
      return { feel, set: (v) => { on = v; } };
    };
    expect(make({}).feel.holdsPossible()).toBe(true);
    expect(make({ tier: 'medium' }).feel.holdsPossible()).toBe(true);
    expect(make({ tier: 'low' }).feel.holdsPossible()).toBe(false);
    expect(FEEL.low.hold.size).toBe(0);
    expect(make({ reduceMotion: true }).feel.holdsPossible()).toBe(false);
    const off = make({ hitEffects: false });
    expect(off.feel.holdsPossible()).toBe(false);
    off.set(true); // read live (the pause menu)
    expect(off.feel.holdsPossible()).toBe(true);
    // the renderer asks before any bookkeeping, and starts afresh when holds come back
    const src = readFileSync('src/render/BattleRenderer.js', 'utf8');
    expect(src).toMatch(/const holdable = feel\.holdsPossible\(\);\s*if \(holdable\) \{\s*if \(!hitSourceOn\) hitSource\.clear\(\);\s*hitSource\.frame\(sim\.projectiles\);\s*\}/);
    expect(src).toMatch(/if \(holdable\) \{\s*const owner = hitSource\.owner\(events, i\);/);
    // the holds (frame + owner) and the kill credit (FX-1), which asks it only while holds are possible
    // (otherwise its own event scan, killSource, never framed)
    expect(src.match(/hitSource\.(frame|owner)\(/g).length).toBe(3);
    expect(src).toMatch(/\(holdable \? hitSource\.owner\(events, j\) : null\)/);
    expect(src).not.toMatch(/killSource\.frame\(/);
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

  it('the body is a see-through shape around the hit: ≤ 1.2 r, ≤ 0.8 opacity, fading from about a third of its life', () => {
    const { fx, regions } = setup();
    for (const r of [1.2, 2.3]) {
      fx.clear();
      fx.explosion(5, 5, r, '#ff8a4a');
      const cel = fx.parts.filter((p) => p.uv === regions.celPuff && p.lift > 0);
      expect(cel.length).toBe(2); // the body and the lit puff
      for (const p of cel) {
        expect(Math.max(p.s0, p.s1)).toBeLessThanOrEqual(1.2 * r + 1e-9);
        expect(p.a0).toBeLessThanOrEqual(0.8);
        expect(p.hold).toBeLessThanOrEqual(0.36);
      }
      // the fire puffs are see-through too, and fewer on a big blast
      const fire = fx.parts.filter((p) => p.uv === regions.celPuff && !p.lift);
      expect(fire.length).toBeLessThanOrEqual(BLAST.fire.max);
      for (const p of fire) {
        expect(p.a0).toBeLessThan(1);
        expect(Math.hypot(p.x - 5, p.z - 5)).toBeGreaterThanOrEqual(0.25 * r - 1e-9); // burst out round the walker, not over it
      }
      // the core stays small and quick however big the blast
      const core = fx.parts.find((p) => p.batch === 'bbA');
      expect(Math.max(core.s0, core.s1)).toBeLessThanOrEqual(BLAST.core.max * BLAST.core.s1 + 1e-9);
      expect(core.life).toBeLessThanOrEqual(0.1);
    }
    // its opacity over its life: full (0.8) for the first ~35 %, then down to 0
    fx.clear();
    fx.explosion(5, 5, 1.2, '#ff8a4a');
    const b = fx.parts.find((p) => p.uv === regions.celPuff && p.lift === 0.5);
    const alphaAt = (k) => {
      const f = new FxSystem({ atlas: fx.atlas, batches: fx.b, camera: fx.camera });
      f.parts.push({ ...b, t: 0 });
      for (const B of Object.values(fx.b)) B.begin();
      f.update(k * b.life);
      return fx.b.bbN.col[3];
    };
    expect(alphaAt(0.2)).toBeCloseTo(0.8, 6);
    expect(alphaAt(0.7)).toBeLessThan(0.45);
  });

  it('seated on the ground: anchored on the blast spot and drawn upward from it, so nothing dips under the road (no flat cut); the struck walker\'s body stands in front of it, its legs in the smoke', () => {
    const { regions, fx: f0 } = setup();
    // the battle camera: orthographic, looking down 48° (src/render/camera.js PITCH)
    const cam = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
    const pitch = THREE.MathUtils.degToRad(48);
    cam.position.set(5, 30 * Math.sin(pitch), 5 + 30 * Math.cos(pitch));
    cam.lookAt(5, 0, 5);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    const fx = new FxSystem({ atlas: f0.atlas, batches: f0.b, camera: cam, rand: createVisualRandom(9) });
    fx.setQuality('high');
    fx.explosion(5, 5, 2.3, '#ff8a4a');
    const body = fx.parts.find((p) => p.uv === regions.celPuff && p.lift === 0.5);
    const lit = fx.parts.find((p) => p.uv === regions.celPuff && p.lift > 0.5);
    const ndc = (v) => v.clone().project(cam);
    const spot = ndc(new THREE.Vector3(5, 0.07, 5));
    for (const p of [body, lit]) {
      // the anchor is drawn exactly on the blast spot (moved only in depth)…
      const a = ndc(new THREE.Vector3(p.x, p.y, p.z));
      expect(a.x).toBeCloseTo(spot.x, 9);
      expect(a.y).toBeCloseTo(spot.y, 9);
      expect(p.y).toBeGreaterThan(PATH_H); // …above the road
      expect(Math.abs(p.rot)).toBeLessThanOrEqual(0.25); // nearly upright (lit side up)
    }
    // pushed with a view-space lift of (at least) half its height: its bottom edge is the anchor
    for (const B of Object.values(fx.b)) B.begin();
    fx.update(0.05);
    const bb = fx.b.bbN;
    let found = 0;
    for (let i = 0; i < bb.count; i++) {
      const k = i * 4;
      if (bb.size[k + 3] > 0) {
        found++;
        expect(bb.size[k + 3]).toBeGreaterThanOrEqual(bb.size[k + 1] / 2 - 1e-9);
      }
    }
    expect(found).toBe(2);
    // its lowest world point is the anchor and its top is higher still: never under the ground
    const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    const bottom = new THREE.Vector3(body.x, body.y, body.z);
    const top = bottom.clone().addScaledVector(up, body.s1);
    expect(Math.min(bottom.y, top.y)).toBeGreaterThan(PATH_H);
    // a walker standing on the spot: body and head nearer the camera than the cloud's plane (drawn
    // over it), the lowest part of the legs behind it (in the smoke)
    const viewZ = (v) => v.clone().applyMatrix4(cam.matrixWorldInverse).z;
    const plane = viewZ(bottom);
    for (const y of [0.3, 0.45, 0.6]) expect(viewZ(new THREE.Vector3(5, y, 5))).toBeGreaterThan(plane);
    expect(viewZ(new THREE.Vector3(5, 0.1, 5))).toBeLessThan(plane);
  });

  it('a Spin Shot bounce draws a smaller cloud (BOUNCE_BODY), the ring still shows the real reach', () => {
    const { fx, regions } = setup();
    fx.explosion(5, 5, 1.2, '#ff8a4a');
    const big = fx.parts.filter((p) => p.lift === 0.5)[0];
    const ringBig = fx.parts.find((p) => p.uv === regions.ringThick);
    fx.clear();
    fx.explosion(5, 5, 1.2, '#ff8a4a', { scale: BOUNCE_BODY });
    const small = fx.parts.filter((p) => p.lift === 0.5)[0];
    const ringSmall = fx.parts.find((p) => p.uv === regions.ringThick);
    expect(small.s1 / big.s1).toBeCloseTo(BOUNCE_BODY, 6);
    expect(BOUNCE_BODY).toBeLessThanOrEqual(0.6);
    expect(ringSmall.s1).toBe(ringBig.s1);
    // which blasts are bounces: the ball's previous pop sent it on to a next walker
    const bouncing = new Set();
    const evs = (pop) => [{ type: 'hit' }, { type: 'explode', towerUid: 4, x: 1, y: 1 }, { type: 'hit' }, pop];
    const pop = (o) => ({ type: 'ballPop', towerUid: 4, uid: 7, n: 1, fin: false, tx: null, ty: null, ...o });
    expect(bounceBlast(evs(pop({})), 1, bouncing)).toBe(false); // the ball's first hit
    noteBallPop(pop({ tx: 3, ty: 3 }), bouncing); // …which sends it on (Spin Shot)
    expect(bounceBlast(evs(pop({ n: 2 })), 1, bouncing)).toBe(true); // the bounce lands
    expect(bounceBlast(evs(pop({ n: 9, fin: true })), 1, bouncing)).toBe(false); // the Glow Bowl finale
    expect(bounceBlast(evs(pop({ uid: 8, n: 3 })), 1, bouncing)).toBe(false); // another ball (a Wrecking Ball blast: n ≥ 2 from the walkers it bowled through)
    expect(bounceBlast(evs(pop({ towerUid: 5, n: 2 })), 1, bouncing)).toBe(false); // someone else's ball
    expect(bounceBlast([{ type: 'explode', x: 1, y: 1, radius: 2 }], 0, bouncing)).toBe(false); // not a ball
    noteBallPop(pop({ n: 9, fin: true }), bouncing);
    expect(bouncing.size).toBe(0); // the finale ends the chain
    noteBallPop(pop({ tx: 3, ty: 3 }), bouncing);
    noteBallPop({ type: 'ballEnd', towerUid: 4, uid: 7 }, bouncing);
    expect(bouncing.size).toBe(0); // and so does the ball's end
  });

  it('Wrecking Ball (4-2-0) blasts are never drawn as bounces: every one of her blasts gets the full cloud', () => {
    const sim = gallerySim(['marumi'], [[4, 2, 0]]);
    const feed = streamer(sim, 0.2, 40);
    const bouncing = new Set();
    let blasts = 0;
    let multi = 0;
    for (let f = 0; f < 60 * 30; f++) {
      feed(F);
      sim.update(F);
      const events = sim.drainEvents();
      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        noteBallPop(ev, bouncing);
        if (ev.type !== 'explode' || ev.towerUid == null) continue;
        blasts++;
        if ((events.slice(i + 1).find((e) => e.type === 'ballPop')?.n || 0) >= 2) multi++;
        expect(bounceBlast(events, i, bouncing)).toBe(false);
      }
    }
    expect(blasts).toBeGreaterThan(3);
    expect(multi).toBeGreaterThan(0); // her ball bowled through walkers before the blast (n ≥ 2): not a bounce
  }, 120000);

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
    // who set a blast off: her ball (towerUid), a volatile monster, an ability shell, else a girl's splash
    const ball = { type: 'explode', x: 1, y: 1, radius: 2.4, towerUid: 5 };
    const splash = { type: 'explode', x: 2, y: 2, radius: 2.3 }; // Akane's fireball, Sango's shell, a charged strip
    const boom = { type: 'explode', x: 3, y: 3, radius: 1.8, volatile: true };
    const shell = { type: 'explode', x: 4, y: 4, radius: 2 };
    const evs = [{ type: 'hit', uid: 1 }, ball, { type: 'hit', uid: 2 }, splash, boom, { type: 'abilityShell', towerUid: 9, x: 4, y: 4, radius: 2 }, shell];
    const src = (ev) => explodeSource(evs, evs.indexOf(ev));
    expect([src(ball), src(splash), src(boom), src(shell)]).toEqual(['girl', 'girl', 'enemy', 'ability']);
    // a girl's blast never shakes on its own, however big; a big blast no girl owns does
    expect(explodeShakes(ball, 1.6, src(ball))).toBe(false);
    expect(explodeShakes(splash, 1.6, src(splash))).toBe(false);
    expect(explodeShakes(shell, 1.6, src(shell))).toBe(false);
    expect(explodeShakes(boom, 1.6, src(boom))).toBe(true);
    expect(explodeShakes({ ...boom, radius: 1.2 }, 1.6, 'enemy')).toBe(false);
    // her big ability blast jolts once instead (the renderer keeps them ≥ the art gap apart)
    expect(abilityBlastTrauma(shell, 1.6, src(shell))).toBe(MOMENT_TRAUMA.abilityBlast);
    expect(abilityBlastTrauma({ ...shell, radius: 1 }, 1.6, 'ability')).toBe(0);
    expect(abilityBlastTrauma(splash, 1.6, src(splash))).toBe(0);
    expect(MOMENT_TRAUMA.abilityBlast).toBeLessThan(0.3); // tiny (tier 4: big hits only)
  });

  it('a splash girl\'s basic attack never shakes the camera (Akane\'s fireball, Sango\'s cannon): 0 shakes from their blasts in a battle', () => {
    for (const [id, build] of [['akane', [4, 2, 0]], ['sango', [4, 2, 0]]]) {
      const sim = gallerySim([id], [build]);
      const feed = streamer(sim, 0.3, 40);
      const clock = new VisualClock();
      const kicks = [];
      const feel = createHitFeel({
        reduceMotion: false, hitEffects: () => true, placing: () => false, now: () => clock.realT, tier: () => 'high',
        guard: new FlashGuard(), director: new HitStopDirector(clock), impact: { active: false, start() {} },
        rig: { kick: (t) => kicks.push(t), punch() {} }, tint() {},
      });
      let blasts = 0;
      let big = 0;
      for (let f = 0; f < 60 * 20; f++) {
        feed(F);
        sim.update(F);
        clock.tick(F);
        const events = sim.drainEvents();
        for (let i = 0; i < events.length; i++) {
          const ev = events[i];
          if (ev.type !== 'explode') continue;
          blasts++;
          if (ev.radius >= 1.6) big++;
          // the renderer's rule (BattleRenderer 'explode')
          const s = explodeSource(events, i);
          if (explodeShakes(ev, 1.6, s)) feel.shake(0.26);
        }
      }
      expect(blasts, id).toBeGreaterThan(5);
      if (id === 'akane') expect(big).toBeGreaterThan(5); // her fireball is a big blast (radius 2.3)…
      expect(kicks, id).toEqual([]); // …and still never shakes
    }
    // and the renderer's explode case goes through exactly that rule
    const r = readFileSync('src/render/BattleRenderer.js', 'utf8');
    expect(r).toMatch(/const src = explodeSource\(events, i\);\s*if \(explodeShakes\(ev, TRAUMA\.explodeMin, src\)\)/);
  }, 120000);

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
    let bounces = 0;
    let finBlasts = 0;
    let last = -Infinity;
    const bouncing = new Set();
    for (let f = 0; f < 60 * 90 && fins < 2; f++) {
      feed(F);
      sim.update(F);
      clock.tick(F);
      const events = sim.drainEvents();
      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        noteBallPop(ev, bouncing);
        if (ev.type === 'ballPop') {
          pops++;
          if (ev.fin) fins++;
        }
        if (ev.type === 'explode' && ev.towerUid != null) {
          explodes++;
          expect(explodeShakes(ev, 1.6, explodeSource(events, i))).toBe(false);
          // a Spin Shot bounce draws the smaller body; the finale never does
          const pop = events.slice(i + 1).find((e) => e.type === 'ballPop');
          if (bounceBlast(events, i, bouncing)) {
            bounces++;
            expect(pop.fin).toBe(false);
            expect(pop.n).toBeGreaterThanOrEqual(2);
          }
          if (pop?.fin) {
            finBlasts++;
            expect(bounceBlast(events, i, bouncing)).toBe(false);
          }
        }
        const m = momentTrauma(ev);
        if (m > 0 && clock.frameT - last >= 0.8 && feel.shake(m)) last = clock.frameT;
      }
    }
    expect(fins).toBeGreaterThan(0);
    expect(pops).toBeGreaterThan(fins * 8); // the finale comes after the 8th bounce
    expect(explodes).toBeGreaterThan(0);
    expect(bounces).toBeGreaterThan(fins * 6); // most of her blasts are bounces: small bodies…
    expect(finBlasts).toBeGreaterThan(0); // …and each finale is the one big cloud
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
    expect(doc).toMatch(/a girl's basic splash never shakes/i);
  });
});

describe('after the impact frames: the board comes back to its own brightness, no overshoot', () => {
  const make = (color = '#c9a8ff') => {
    const clock = new VisualClock();
    clock.tick(F);
    const feel = createHitFeel({
      reduceMotion: false, hitEffects: () => true, placing: () => false, now: () => clock.realT, tier: () => 'high',
      guard: new FlashGuard(), director: new HitStopDirector(clock), impact: { active: false, start() {} },
      rig: { kick() {}, punch() {} }, tint() {},
    });
    expect(feel.impact(color)).toBe(true);
    return feel.takeAfterglow();
  };

  it('the afterglow is faint and swells in from nothing over ~150 ms (the DOM tint never jumps up after the dimmed frames)', () => {
    const glow = make();
    expect(glow.a).toBeLessThanOrEqual(0.1);
    expect(glow.rise).toBeGreaterThanOrEqual(0.15);
    expect(make('#ff2030').a).toBeLessThanOrEqual(AFTERGLOW.red);
    // the renderer's tint layer, frame by frame at 60 fps and on a 30 fps phone: it starts at 0
    for (const dt of [1 / 60, 1 / 30]) {
      const f = { a: 0, from: 0, peak: glow.a, rise: glow.rise, up: 0, decay: glow.decay };
      const seen = [];
      for (let i = 0; i < Math.round(1 / dt); i++) seen.push(stepTint(f, dt).a);
      expect(seen[0]).toBeLessThanOrEqual(glow.a * dt / glow.rise + 1e-9); // the first frame after the impact: next to nothing
      for (let i = 1; i < seen.length; i++) expect(seen[i] - seen[i - 1]).toBeLessThanOrEqual(glow.a * dt / glow.rise + 1e-9);
      expect(Math.max(...seen)).toBeCloseTo(glow.a, 9); // its peak, never more
      expect(seen[seen.length - 1]).toBeLessThan(glow.a); // then it fades
    }
    // a frozen frame (the impact's hit-stop) holds it where it is
    const f = { a: 0, from: 0, peak: 0.1, rise: 0.15, up: 0, decay: 1.2 };
    stepTint(f, 0);
    expect(f.a).toBe(0);
    // an ordinary tint still starts at its strength and fades
    const g = { a: 0.4, decay: 2 };
    expect(stepTint(g, 0.1).a).toBeCloseTo(0.2, 9);
    // the renderer hands the rise to the tint
    const src = readFileSync('src/render/BattleRenderer.js', 'utf8');
    expect(src).toMatch(/if \(glow\) tint\(glow\.color, glow\.a, glow\.decay, glow\.rise\);/);
    expect(src).toMatch(/if \(!impact\.active\) stepTint\(flash, d\);/);
  });
});

describe('impact frames: see-through monster bodies become silhouettes too (no dark discs)', () => {
  const slime = { id: 'slime_green', family: 'slime', tier: 'normal', size: 1, color: '#7bd389', accent: '#3fa35b', traits: {}, model: { base: 'slime', variant: 'green', props: [] } };
  const run = (model, scene) => {
    const imp = new ImpactFrames({ scene, figures: () => [model] });
    imp.start('#ffe6b0');
    imp.begin();
    return imp;
  };

  it('a slime\'s jelly body is drawn as the pink silhouette, its outline stays as a rim; everything comes back after', () => {
    const scene = new THREE.Scene();
    const model = buildEnemy(slime, { quality: 'high' });
    scene.add(model);
    model.userData.animate(0, 0.016, { moving: true });
    const bodies = [];
    const outlines = [];
    model.traverse((o) => {
      if (!o.isMesh) return;
      if (o.userData.isOutline) outlines.push(o);
      else if (o.userData.body) bodies.push([o, o.material]);
    });
    expect(bodies.length).toBeGreaterThan(0);
    expect(outlines.length).toBeGreaterThan(0);
    expect(bodies.some(([, m]) => m.transparent && m.opacity < 1)).toBe(true); // a see-through jelly look
    const imp = run(model, scene);
    for (const [o] of bodies) {
      expect(o.visible).toBe(true);
      expect(o.material).toBe(impactMaterial()); // a silhouette, not hidden
    }
    for (const o of outlines) if (bodies.some(([b]) => b.geometry === o.geometry)) expect(o.visible).toBe(true); // a rim round it
    imp.end();
    imp.end();
    expect(imp.active).toBe(false);
    for (const [o, m] of bodies) expect(o.material).toBe(m);
    disposeObject(model);
  });

  it('a veiled body (faint) stays hidden, and so does its outline hull: never a dark disc where it was', () => {
    const scene = new THREE.Scene();
    const model = buildEnemy(slime, { quality: 'high' });
    scene.add(model);
    model.userData.setVeiled(true);
    model.userData.animate(0, 0.016, { moving: true });
    const imp = run(model, scene);
    model.traverse((o) => {
      if (!o.isMesh) return;
      if (o.userData.body) expect(o.visible).toBe(false);
      if (o.userData.isOutline) expect(o.visible).toBe(false);
    });
    imp.cancel();
    disposeObject(model);
  });

  it('any see-through part that is hidden takes its outline hull with it', () => {
    const scene = new THREE.Scene();
    const root = new THREE.Group();
    const geo = new THREE.SphereGeometry();
    const part = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5 }));
    const outlineMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide });
    outlineMat.userData.outline = true;
    const hull = new THREE.Mesh(geo, outlineMat);
    hull.userData.isOutline = true;
    const solid = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshToonMaterial());
    const solidHull = new THREE.Mesh(solid.geometry, outlineMat);
    solidHull.userData.isOutline = true;
    root.add(part, hull, solid, solidHull);
    scene.add(root);
    const imp = run(root, scene);
    expect(part.visible).toBe(false);
    expect(hull.visible).toBe(false);
    expect(solid.material).toBe(impactMaterial());
    expect(solidHull.visible).toBe(true);
    imp.end();
    imp.end();
    expect(part.visible && hull.visible).toBe(true);
  });
});
