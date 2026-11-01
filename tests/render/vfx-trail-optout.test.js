// The styled projectile ribbon (src/render/vfx/trails.js) never doubles a style's own trail, and no shot loses its only
// trail (docs/VFX.md, projectile trails): each girl alone in a real gallery battle (node, no WebGL; her booth is beside
// the first lane), four builds, on the tiers that draw ribbons. A shot whose view() leaves anything
// behind it (a line or a quad behind the shot, a sprite left where it was) has a trail of its own, so it must be skipped
// or set `ownTrail`; a shot that sets `ownTrail` must draw one. Every girl whose style draws her shots in view() must
// reach these checks (or have every shot skipped), so the test cannot quietly shrink. Display only.
import { describe, it, expect } from 'vitest';
import { harness, gallerySim, streamer } from './attackFxHarness.js';
import { ORDER } from './attackFxOrder.js';
import { STYLE_BY_UNIT } from '../../src/render/attackFx/registry.js';

const BUILDS = { base: [0, 0, 0], p0: [5, 2, 0], p1: [0, 5, 2], p2: [2, 0, 5] };
/** How far behind the shot (along its flight, tiles) a drawn line end or quad counts as its trail. */
const BEHIND = 0.12;
/**
 * A view that skips every shot it is given (`v.skip = true` before any branch, and `skip` set nowhere else) draws no
 * shot mesh, so no ribbon either.
 */
function alwaysSkips(view) {
  const src = view.toString();
  const body = src.split('{').slice(1).join('{');
  return (src.match(/\.skip\s*=/g) || []).length === 1 && /\bv\.skip = true;/.test(body.split(/\b(?:if|return|for|while|switch)\b/)[0]);
}
/** Girls with a view() whose shots never fly in today's game (nothing for the test to reach). */
const KNOWN_GAPS = {
  hikari: 'her view draws only for a projectile attack, and her attack is a pulse at every hero level: her T5 lance branch cannot run today',
};
/** Frames a girl's battle runs (Yuzuha's sentries, set from about 5 s, first see an enemy at about 33 s). */
const framesFor = (id) => (id === 'yuzuha' ? 1200 : 360);

/**
 * Runs a gallery battle and records, for every shot's view, what the style drew while it ran.
 * @returns {{ girls: Map<string, {views:number, skipped:number, own:number, flagged:number, flaggedBare:number, doubled:number, sample:string|null}>,
 *   kinds: Map<string, {flagged:number, bare:number}> }} per girl, and per girl, shot kind and shooter (`id:kind[@turret]`)
 */
function probe(ids, build, { frames = 360, speed = 2, quality = 'high' } = {}) {
  const sim = gallerySim(ids, ids.map(() => build), 3);
  const feed = streamer(sim);
  const h = harness(sim, { quality });
  const ctx = h.fxa.ctx;
  let rec = null;
  const wrap = (name, at) => {
    const f = ctx[name];
    ctx[name] = function (...a) {
      if (rec) rec.push(at(a));
      return f.apply(this, a);
    };
  };
  // [kind, points as x, y (ground plane)]
  wrap('line', (a) => ['line', a[2], a[4], a[5], a[7]]);
  wrap('quad', (a) => ['quad', a[2], a[4]]);
  wrap('quadRGB', (a) => ['quad', a[2], a[4]]);
  wrap('spr', (a) => ['spr', a[3], a[5]]);
  wrap('part', (a) => ['spr', a[2], a[4]]);
  const out = new Map();
  // the bare check runs per girl, shot kind and shooter (a sentry's or drone's shots apart): a wrong flag on one kind of
  // shot cannot pass beside a rightly flagged kind
  const kinds = new Map(); // `${id}:${kind}[@turret]` → { flagged, bare }
  const list = Object.values(h.batches);
  const dt = 1 / 60;
  for (let f = 0; f < frames; f++) {
    feed(dt * speed);
    sim.update(dt * speed);
    h.fxa.setTimeScale(speed);
    const events = sim.drainEvents();
    for (const b of list) b.begin();
    for (let i = 0; i < events.length; i++) h.fxa.onEvent(events[i], i, events);
    h.actors.sync();
    for (const p of sim.projectiles) {
      rec = [];
      const v = h.fxa.projectile(p, dt);
      const drawn = rec;
      rec = null;
      if (!v) continue;
      const id = `${p.owner?.unitId ?? '?'}`;
      let s = out.get(id);
      if (!s) out.set(id, (s = { views: 0, skipped: 0, own: 0, flagged: 0, flaggedBare: 0, doubled: 0, sample: null }));
      if (v.skip) {
        s.skipped++;
        continue;
      }
      s.views++;
      // the shot's own trail: anything left behind it this frame
      const vl = Math.hypot(p.vx || 0, p.vy || 0);
      const ux = vl > 1e-6 ? p.vx / vl : 0;
      const uy = vl > 1e-6 ? p.vy / vl : 0;
      const behind = (x, y) => vl > 1e-6 && (x - v.x) * ux + (y - v.y) * uy < -BEHIND;
      let own = false;
      for (const d of drawn) {
        if (d[0] === 'spr') own = true;
        else if (d[0] === 'line') own ||= behind(d[1], d[2]) || behind(d[3], d[4]);
        else own ||= behind(d[1], d[2]);
      }
      if (own) s.own++;
      if (v.ownTrail) {
        s.flagged++;
        if (!own) s.flaggedBare++;
        const key = `${id}:${p.kind}${p.turretUid != null ? '@turret' : ''}`;
        const k = kinds.get(key) || { flagged: 0, bare: 0 };
        k.flagged++;
        if (!own) k.bare++;
        kinds.set(key, k);
      } else if (own) {
        s.doubled++;
        s.sample ||= `${p.kind}: ${drawn.map((d) => d[0]).join(',')}`;
      }
    }
    h.fxa.update(dt);
    h.fx.update(dt);
    for (const b of list) b.end();
  }
  return { girls: out, kinds };
}

describe('the styled ribbon and the styles\' own trails', { timeout: 600000 }, () => {
  it('a shot that draws its own trail sets ownTrail (or is skipped); a shot that sets it draws one', () => {
    const doubled = [];
    const bare = new Map();
    const reached = new Map(); // id → { views, skipped } over every build and tier
    // one girl per battle: her booth (the first) is beside the first lane
    const groups = ORDER.map((id) => [id]);
    for (const quality of ['high', 'medium']) {
      for (const [b, build] of Object.entries(BUILDS)) {
        const name = `${b} ${quality}`;
        for (const ids of groups) {
          const { girls, kinds } = probe(ids, build, { quality, frames: framesFor(ids[0]) });
          for (const [id, s] of girls) {
            const r = reached.get(id) || { views: 0, skipped: 0 };
            r.views += s.views;
            r.skipped += s.skipped;
            reached.set(id, r);
            if (s.doubled) doubled.push(`${id} ${name}: ${s.doubled}/${s.views} shots (${s.sample})`);
          }
          // a kind of shot that is flagged but never draws a trail of its own on this build lost its only trail
          for (const [key, k] of kinds) {
            const g = bare.get(key) || { flagged: 0, bare: 0, builds: [] };
            g.flagged += k.flagged;
            g.bare += k.bare;
            if (k.flagged && k.bare === k.flagged) g.builds.push(name);
            bare.set(key, g);
          }
        }
      }
    }
    console.log('[trail opt-out]', JSON.stringify({ doubled, bare: [...bare].filter(([, b]) => b.builds.length) }, null, 1));
    expect(doubled).toEqual([]);
    expect([...bare].filter(([, b]) => b.builds.length).map(([id, b]) => `${id}: ${b.builds.join(',')}`)).toEqual([]);
    // coverage: every girl whose style draws her shots in view() reached the checks (a view that skips every shot it is
    // given cannot double a ribbon, and the known gaps are named above)
    const withView = ORDER.filter((id) => typeof STYLE_BY_UNIT[id]?.view === 'function');
    expect(withView.filter((id) => alwaysSkips(STYLE_BY_UNIT[id].view)).sort()).toEqual(['chigusa', 'ena', 'fuu', 'kinu', 'miko', 'momo']);
    // …and what ran agrees: their shots fly and every one of them is skipped (Kinu's never fly here)
    for (const id of ['chigusa', 'ena', 'fuu', 'miko', 'momo']) {
      expect(reached.get(id)?.views, id).toBe(0);
      expect(reached.get(id)?.skipped, id).toBeGreaterThan(0);
    }
    const missed = withView.filter((id) => !KNOWN_GAPS[id] && !alwaysSkips(STYLE_BY_UNIT[id].view) && !(reached.get(id)?.views > 0));
    expect(missed).toEqual([]);
    // (and the checks really ran on the girls that draw a trail of their own: the cases the earlier reviews found)
    for (const id of ['aoi', 'hana', 'kage', 'marumi', 'ruri', 'yoriko', 'iroha', 'yuki', 'nami', 'akane', 'yuzuha']) expect(reached.get(id)?.views, id).toBeGreaterThan(0);
  });
});
