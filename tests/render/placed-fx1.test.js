// FX-1 placed objects and thrown props (src/render/placed/): Marumi's balls, Azami's strips, Yuzuha's
// sentries and nets, drawn as code-built models over a real Sim through the real attack-FX layer. The
// layer reads the sim and never writes to it (strict mode hands the style hooks frozen clones, and a
// sim run with the layer matches one without it).
import { describe, it, expect } from 'vitest';
import { harness, gallerySim, streamer } from './attackFxHarness.js';
import { PLATES } from '../../src/render/placed/geometry.js';
import { SENTRY } from '../../src/render/placed/fsm.js';

const DT = 1 / 30;

/** Runs `frames` frames of a gallery battle; `each(h, events)` sees every frame. */
function run(ids, builds, frames, o = {}, each = null) {
  const sim = gallerySim(ids, builds, o.seed ?? 3);
  const h = harness(sim, { strict: !!o.strict, quality: o.quality || 'high', reduceMotion: !!o.reduceMotion });
  const feed = streamer(sim, o.every ?? 0.3, o.hpMul ?? 60);
  for (let i = 0; i < frames; i++) {
    feed(DT);
    // the frame's events, looked at after the layer has drawn the frame
    const evs = h.frame(DT, o.speed ?? 1);
    if (each) each(h, evs, sim);
  }
  return { sim, h, placed: h.fxa.ctx.placed };
}

/** A digest of the sim state that matters for lockstep (positions, hp, cash, balls, traps, sentries). */
function digest(sim) {
  const r = (v) => Math.round(v * 1e6) / 1e6;
  return JSON.stringify({
    t: r(sim.time), cash: r(sim.cash), lives: sim.lives,
    e: sim.enemies.map((e) => [e.uid, r(e.x), r(e.y), r(e.hp)]),
    b: sim.towers.map((t) => [t.uid, (t.balls || []).map((b) => [b.uid, r(b.dist), b.fly ? [r(b.fly.x), r(b.fly.y)] : 0]), (t.sentries || []).map((s) => [s.uid, r(s.ttl)]), (t.nets || []).map((n) => r(n.left))]),
    tr: sim.traps.map((tr) => [tr.uid, tr.hits, r(tr.ttl)]),
  });
}

describe('Marumi: a real bowling ball, pins and STRIKE', () => {
  it('every sim ball is a ball model; new balls hop from her hand; Split Pins tumble out (strict: no sim writes)', () => {
    let balls = 0;
    let pinsEv = 0;
    let maxPins = 0;
    let hopsSeen = 0;
    let calls = 0;
    const { placed } = run(['marumi'], [[0, 3, 2]], 900, { strict: true }, (hh, evs, sim) => {
      for (const e of evs) if (e.type === 'pins') pinsEv++;
      const p = hh.fxa.ctx.placed;
      calls = Math.max(calls, hh.fxa.stats().placed.calls);
      const n = sim.towers.reduce((a, t) => a + (t.balls?.length || 0), 0);
      // one ball record per sim ball, every frame
      expect(p.balls.recs.size).toBeGreaterThanOrEqual(n);
      balls = Math.max(balls, n);
      maxPins = Math.max(maxPins, p.balls.pins.length);
      for (const r of p.balls.recs.values()) if (r.hop >= 0) hopsSeen++;
    });
    expect(balls).toBeGreaterThan(0);
    expect(placed.balls.stats.hops).toBeGreaterThan(5);
    expect(hopsSeen).toBeGreaterThan(0);
    expect(pinsEv).toBeGreaterThan(0);
    expect(maxPins).toBeGreaterThan(0);
    expect(placed.parts.has('ball') && placed.parts.has('cap') && placed.parts.has('pin')).toBe(true);
    // ball + cap (+ pins), each one instanced mesh, the ball and pins with their outlines on High
    expect(calls).toBeGreaterThanOrEqual(3);
  });

  it('a Spin Shot bounce flies a parabola (0 at both ends) and the Glow Bowl finale stands the pins and shows STRIKE!', () => {
    let maxAir = 0;
    let finales = 0;
    let stickers = 0;
    run(['marumi'], [[2, 0, 5]], 1500, {}, (hh, evs, sim) => {
      for (const e of evs) if (e.type === 'ballPop' && e.fin) finales++;
      const p = hh.fxa.ctx.placed;
      stickers = Math.max(stickers, p.balls.stickers.length);
      for (const t of sim.towers) {
        for (const bl of t.balls || []) {
          const r = p.balls.recs.get(bl.uid);
          // (a ball still on its hand-off hop adds the hop's own little arc)
          if (r && bl.fly && r.hop < 0) maxAir = Math.max(maxAir, r.h - 0.05 - 0.2);
        }
      }
    });
    expect(maxAir).toBeGreaterThan(0.2);
    expect(maxAir).toBeLessThanOrEqual(0.5 + 1e-6);
    expect(finales).toBeGreaterThan(0);
    expect(stickers).toBeGreaterThan(0);
  });

  it('a ball and its fuse cap: the cap stays upright while the ball spins under it', () => {
    let spun = 0;
    let checked = 0;
    run(['marumi'], [[0, 3, 2]], 400, {}, (hh) => {
      const p = hh.fxa.ctx.placed;
      const cap = p.parts.parts.get('cap');
      for (const r of p.balls.recs.values()) {
        if (r.cap < 0 || !cap) continue;
        const e = cap.mesh.instanceMatrix.array;
        // the cap's local up axis (matrix column 1) stays vertical
        const ux = e[r.cap * 16 + 4];
        const uy = e[r.cap * 16 + 5];
        const uz = e[r.cap * 16 + 6];
        const l = Math.hypot(ux, uy, uz);
        if (l > 1e-6) {
          expect(uy / l).toBeGreaterThan(0.99);
          checked++;
        }
        if (r.spin > 0.5) spun++;
      }
    });
    expect(checked).toBeGreaterThan(20);
    expect(spun).toBeGreaterThan(0);
  });

  it('her lob is her own ball (the shell projectile is skipped and drawn as the ball)', () => {
    // flyers only: a stream of gliders
    const sim = gallerySim(['marumi'], [[0, 0, 0]]);
    const h = harness(sim);
    let lobs = 0;
    for (let i = 0; i < 900; i++) {
      if (sim.state === 'between' || sim.state === 'prep') sim.startNextWave();
      if (i % 20 === 0 && sim.enemies.length < 20) sim.spawnEnemy('goblin_glider', { dist: 0, pathIndex: 0, hpMul: 40 });
      h.frame(DT);
      lobs = Math.max(lobs, h.fxa.ctx.placed.balls.lobs.size);
    }
    expect(lobs).toBeGreaterThan(0);
  });
});

describe('Azami: modelled spike strips', () => {
  it('each strip is 5 plates + 5 spike rows; it is tossed, unrolls, arms, bites and rolls up (strict)', () => {
    let tossed = 0;
    let bites = 0;
    let armedSpikes = 0;
    let jabbed = 0;
    const { placed } = run(['azami'], [[4, 2, 0]], 1200, { strict: true }, (hh, evs, sim) => {
      const p = hh.fxa.ctx.placed;
      for (const tr of sim.traps) {
        if (!tr.strip) continue;
        const r = p.strips.recs.get(tr.uid);
        expect(r).toBeTruthy();
        expect(r.plates.length).toBe(PLATES);
        if (tr.armed && r.s.phase !== 'fly') armedSpikes++;
        for (let i = 0; i < PLATES; i++) if (r.s.jab[i] < 0.12) jabbed++;
      }
      tossed = p.strips.stats.tossed;
      bites = p.strips.stats.bites;
    });
    expect(tossed).toBeGreaterThan(3);
    expect(bites).toBeGreaterThan(3);
    expect(armedSpikes).toBeGreaterThan(0);
    expect(jabbed).toBeGreaterThan(0);
    // a strip gone from the sim frees its slots once it has rolled up
    const live = placed.strips.recs.size;
    expect(placed.parts.parts.get('plate').live).toBe(live * PLATES);
  });

  it('Spike Rain strips drop from high (Total Lockdown)', () => {
    const { placed } = run(['azami'], [[2, 5, 0]], 1500);
    expect(placed.strips.stats.rain).toBeGreaterThan(0);
  });
});

describe('Yuzuha: fold-out sentries and Capture Nets', () => {
  it('sentries are tossed, unfold, track and fire from their barrels; they fold away (strict)', () => {
    let blended = 0;
    let shots = 0;
    let types = new Set();
    const { placed } = run(['yuzuha'], [[4, 2, 0]], 1500, { strict: true }, (hh, evs, sim) => {
      const p = hh.fxa.ctx.placed;
      for (const t of sim.towers) for (const s of t.sentries || []) {
        types.add(s.type);
        expect(p.sentries.recs.get(s.uid)).toBeTruthy();
      }
      shots = p.sentries.stats.shots;
      for (const b of hh.fxa.probe().blends) if (b.turret != null && b.blended) blended++;
    });
    expect(placed.sentries.stats.tossed).toBeGreaterThan(1);
    expect(shots).toBeGreaterThan(3);
    expect(blended).toBeGreaterThan(0);
    expect(types.size).toBeGreaterThan(0);
    for (const t of types) expect(placed.parts.has(`barrel:${t}`)).toBe(true);
  });

  it('nets arc out, open and drape; a catch wraps a bundle that pops into coins', () => {
    let catches = 0;
    let bundles = 0;
    // 2× speed: the walkers reach her net on the far turn of the gallery lane
    const { placed } = run(['yuzuha'], [[0, 2, 4]], 2400, { hpMul: 1, every: 0.25, speed: 2 }, (hh, evs) => {
      for (const e of evs) if (e.type === 'netCatch') catches++;
      bundles = Math.max(bundles, hh.fxa.ctx.placed.sentries.bundles.length);
    });
    expect(placed.sentries.stats.nets).toBeGreaterThan(0);
    expect(catches).toBeGreaterThan(0);
    expect(bundles).toBeGreaterThan(0);
  });

  it('Low graphics: static models (unfolded at once, no scan or kick)', () => {
    const { placed } = run(['yuzuha'], [[4, 2, 0]], 900, { quality: 'low' });
    expect(placed.motion()).toBe('static');
    for (const r of placed.sentries.recs.values()) {
      expect(r.yaw).toBeCloseTo(r.base, 6);
    }
    expect(placed.parts.parts.get('head')?.outlineOn).toBe(false);
    expect(SENTRY.SPLAY).toBeGreaterThan(0);
  });
});

describe('the placed layer is display only', () => {
  it('a sim run with the placed layer matches one without it (lockstep safe)', () => {
    const ids = ['marumi', 'azami', 'yuzuha'];
    const builds = [[2, 0, 5], [4, 2, 0], [0, 2, 4]];
    const a = gallerySim(ids, builds, 7);
    const b = gallerySim(ids, builds, 7);
    const h = harness(a, { strict: true });
    const fa = streamer(a, 0.3, 40);
    const fb = streamer(b, 0.3, 40);
    for (let i = 0; i < 600; i++) {
      fa(DT);
      fb(DT);
      h.frame(DT);
      b.update(DT);
      b.drainEvents();
    }
    expect(digest(a)).toBe(digest(b));
  });

  it('Reduce Motion: nothing flies (arrivals fade in place) and the shapes are all still there', () => {
    const { placed } = run(['marumi', 'azami', 'yuzuha'], [[0, 3, 2], [4, 2, 0], [4, 2, 0]], 900, { reduceMotion: true });
    expect(placed.motion()).toBe('calm');
    expect(placed.flights.thrown).toBe(0);
    expect(placed.strips.stats.strips + placed.sentries.stats.sentries).toBeGreaterThan(0);
  });

  it('draw calls: each part type is one instanced mesh (two with its outline), ≤ 30 with everything placed', () => {
    const { h } = run(['marumi', 'azami', 'yuzuha', 'marumi', 'yuzuha'], [[2, 0, 5], [4, 2, 0], [4, 2, 0], [0, 3, 2], [0, 2, 4]], 1500);
    const s = h.fxa.stats().placed;
    expect(s.calls).toBeGreaterThan(0);
    expect(s.calls).toBeLessThanOrEqual(30);
  });

  it('Wakaba: a drink toss never hides a real trap (the made-up uid bug)', () => {
    const sim = gallerySim(['wakaba', 'suzu', 'azami'], [[2, 0, 0], [2, 0, 0], [2, 0, 0]]);
    // a girl next to Wakaba to drink (the gallery booths are 4 tiles apart; her range is 2.6)
    const wk = sim.towers.find((t) => t.unitId === 'wakaba');
    let mate = null;
    for (let r = 0.8; r <= 2.2 && !mate; r += 0.2) {
      for (let a = 0; a < 6.28 && !mate; a += 0.4) mate = sim.placeTower('aoi', wk.x + Math.sin(a) * r + 1e-4, wk.y + Math.cos(a) * r + 1e-4);
    }
    expect(mate).toBeTruthy();
    const h = harness(sim);
    const feed = streamer(sim, 0.3, 60);
    let drinks = 0;
    for (let i = 0; i < 1500; i++) {
      feed(DT);
      h.frame(DT, 1, (evs) => {
        for (const e of evs) if (e.type === 'attack' && e.kind === 'drink') drinks++;
      });
      // only a seal toss of Suzu's (her own trap) may hide a trap, never a bottle
      for (const [uid] of h.fxa.ctx.toss.hiddenTraps) expect(uid).toBeGreaterThanOrEqual(0);
      for (const tr of sim.traps) if (h.fxa.trapHidden(tr.uid)) expect(tr.strip).toBeFalsy();
    }
    expect(drinks).toBeGreaterThan(0);
    expect(h.fxa.ctx.toss.hiddenTraps.has(-1)).toBe(false);
  });
});

describe('impact presets', () => {
  it("each FX-1 girl's hit spark stays inside its tier: weak ≤ 6 shapes, crit ≤ 10", async () => {
    const { impactFx, IMPACT } = await import('../../src/render/attackFx/impacts.js');
    const sim = gallerySim(['marumi'], [[0, 0, 0]]);
    const h = harness(sim);
    const ctx = h.fxa.ctx;
    for (const girl of ['marumi', 'azami', 'yuzuha', 'ruri']) {
      expect(IMPACT[girl]).toBeTruthy();
      expect(impactFx(ctx, girl, 'weak', 1, 0.3, 1)).toBeLessThanOrEqual(6);
      expect(impactFx(ctx, girl, 'crit', 1, 0.3, 1)).toBeLessThanOrEqual(10);
      expect(impactFx(ctx, girl, 'crit', 1, 0.3, 1)).toBeGreaterThan(impactFx(ctx, girl, 'weak', 1, 0.3, 1) - 1);
    }
    expect(impactFx(ctx, 'nobody', 'weak', 0, 0, 0)).toBe(0);
  });
});

describe('kills credit the girl', () => {
  it("Marumi's, Azami's and Yuzuha's kills pop in their own look (the renderer then skips the white puff)", () => {
    const ids = ['marumi', 'azami', 'yuzuha'];
    const sim = gallerySim(ids, [[0, 3, 2], [4, 2, 0], [4, 2, 0]]);
    const h = harness(sim);
    const feed = streamer(sim, 0.3, 4);
    const popped = new Map();
    for (let i = 0; i < 1200; i++) {
      feed(DT);
      h.frame(DT, 1, (evs) => {
        for (const e of evs) {
          if (e.type !== 'death') continue;
          for (const t of sim.towers) {
            if (h.fxa.killPop(e, t.uid, e.x, 0.3, e.y)) popped.set(t.unitId, (popped.get(t.unitId) || 0) + 1);
          }
        }
      });
    }
    expect(popped.get('marumi')).toBeGreaterThan(0);
    expect(popped.get('azami')).toBeGreaterThan(0);
    expect(popped.get('yuzuha')).toBeGreaterThan(0);
  });
});
