// The styled projectile ribbon (src/render/vfx/trails.js) never doubles a style's own trail, and no shot loses its only
// trail (docs/VFX.md, projectile trails): each girl alone in a real gallery battle (node, no WebGL; her booth is beside
// the first lane, so her shots fly), four builds, on the tiers that draw ribbons. A shot whose view() leaves anything
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
/** A view that skips every shot it is given (`v.skip = true` before any branch) draws no shot mesh, so no ribbon either. */
function alwaysSkips(view) {
  const body = view.toString().split('{').slice(1).join('{');
  return /\bv\.skip = true;/.test(body.split(/\b(?:if|return|for|while|switch)\b/)[0]);
}
/** Girls with a view() whose shots the gallery cannot field (the test cannot reach them; check them by hand). */
const KNOWN_GAPS = {
  hikari: 'her T5 lances need hero levels the gallery cannot give',
  yuzuha: 'her sentry shots need sentries the gallery never deploys',
};

/**
 * Runs a gallery battle and records, for every shot's view, what the style drew while it ran.
 * @returns {Map<string, {views:number, own:number, flagged:number, flaggedBare:number, doubled:number, sample:string|null}>}
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
      } else if (own) {
        s.doubled++;
        s.sample ||= `${p.kind}: ${drawn.map((d) => d[0]).join(',')}`;
      }
    }
    h.fxa.update(dt);
    h.fx.update(dt);
    for (const b of list) b.end();
  }
  return out;
}

describe('the styled ribbon and the styles\' own trails', { timeout: 600000 }, () => {
  it('a shot that draws its own trail sets ownTrail (or is skipped); a shot that sets it draws one', () => {
    const doubled = [];
    const bare = new Map();
    const reached = new Map(); // id → { views, skipped } over every build and tier
    // one girl per battle: her booth (the first) is beside the first lane, so her shots meet the enemies
    const groups = ORDER.map((id) => [id]);
    for (const quality of ['high', 'medium']) {
      for (const [b, build] of Object.entries(BUILDS)) {
        const name = `${b} ${quality}`;
        for (const ids of groups) {
          for (const [id, s] of probe(ids, build, { quality })) {
            const r = reached.get(id) || { views: 0, skipped: 0 };
            r.views += s.views;
            r.skipped += s.skipped;
            reached.set(id, r);
            if (s.doubled) doubled.push(`${id} ${name}: ${s.doubled}/${s.views} shots (${s.sample})`);
            // a girl whose flagged shots never draw a trail of their own on this build lost her only trail
            const g = bare.get(id) || { flagged: 0, bare: 0, builds: [] };
            g.flagged += s.flagged;
            g.bare += s.flaggedBare;
            if (s.flagged && s.flaggedBare === s.flagged) g.builds.push(name);
            bare.set(id, g);
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
    const missed = withView.filter((id) => !KNOWN_GAPS[id] && !alwaysSkips(STYLE_BY_UNIT[id].view) && !(reached.get(id)?.views > 0));
    expect(missed).toEqual([]);
    // (and the checks really ran on the girls that draw a trail of their own: the cases the earlier reviews found)
    for (const id of ['aoi', 'hana', 'kage', 'marumi', 'ruri', 'yoriko', 'iroha', 'yuki', 'nami', 'akane']) expect(reached.get(id)?.views, id).toBeGreaterThan(0);
  });
});
