// Hotaru (pulse holy). Signature "Firefly swarm": fireflies drift and blink around her lantern;
// on each pulse one firefly streaks to every enemy the pulse really hit and bursts there, then
// a new one gathers next to her. A faint ring marks the pulse radius.
//   P0 Lantern Light: more fireflies; T5 gold fireflies with bigger bursts
//   P1 Silent Prayer: a purple hush ripple when her silence lands
//   P2 Guiding Lights: T2+ a firefly hovers over each ally inside her aura (max 6)
import { lookAt } from '../flair.js';
import { Swarm } from '../patterns/motes.js';
import { ripple, flash, sparks } from '../patterns/bursts.js';
import { victims } from './util.js';
import { CORE, MOTE } from '../context.js';

const FLY = '#e8ff8a';
const GOLD = '#ffd95a';

function burst(ctx, i, x, h, y, data) {
  const c = ctx.col(data.gold ? GOLD : FLY);
  flash(ctx, x, h, y, data.gold ? 0.6 : 0.42, c, 0.14);
  sparks(ctx, x, h, y, data.gold ? 4 : 2, c, 1.3);
}

export const hotaru = {
  id: 'hotaru',

  init() {
    return { swarm: new Swarm(16), gold: false };
  },

  onPulse(ev, tw, t, ctx, i, events) {
    const v = victims(ctx, events, i, ev.x, ev.y, ev.radius, ev.attackType, t.eff?.maxTargets || 8);
    const sw = tw.data.swarm;
    for (let k = 0; k < v.n; k++) {
      if (!sw.launch(ctx, v.uids[k], 0.06)) {
        // no idle firefly left: a direct flash on the victim keeps the hit readable
        const e = ctx.enemy(v.uids[k]);
        if (e) flash(ctx, e.x, ctx.enemyH(e), e.z, 0.4, ctx.col(FLY), 0.12);
      }
    }
    if (ctx.cap('sweep')) ripple(ctx, ev.x, ev.y, ev.radius * 0.7, ev.radius, 0.35, ctx.col('#fff59d'), 0, 'ringSoft', true, 0.14);
    return true;
  },

  onStatus(ev, tw, t, ctx) {
    if (ev.status !== 'silence' || lookAt(tw.look, 1) < 1) return;
    const e = ctx.enemy(ev.uid);
    if (e) ripple(ctx, e.x, e.z, 0.1, 0.6, 0.35, ctx.col('#b48cff'), 0, 'ringSoft', true, 0.8);
  },

  update(gdt, tw, t, ctx) {
    const lk = tw.look;
    const d = tw.data;
    const p0 = lookAt(lk, 0);
    d.gold = p0 >= 5;
    let n = 8 + 2 * lk.accent[0] + (p0 >= 3 ? p0 - 2 : 0);
    if (ctx.quality === 'medium') n = Math.round(n * 0.65);
    if (ctx.quality === 'low') n = 4;
    const sw = d.swarm;
    sw.setCount(Math.min(16, n));
    const R = t.eff?.range || 2.6;
    sw.update(ctx, gdt, t.x, t.y, R, 0.75, burst, d);
    sw.draw(ctx, ctx.R.glow, ctx.col(d.gold ? GOLD : FLY), 0.15, true, ctx.col('#d8ff7a'));
    // lantern glow at her feet
    ctx.quad(ctx.b.groundA, CORE, t.x, 0.07, t.y, 0.9, 0.9, ctx.R.glow, ctx.col('#fff59d'), 0.3 + 0.05 * Math.sin(ctx.time * 3));
    // guiding lights over allies inside her aura
    const aura = t.stats?.aura?.range || 0;
    if (aura > 0 && (lookAt(lk, 2) >= 2 || lk.accent[2] >= 2) && ctx.quality !== 'low') {
      const towers = ctx.sim.towers;
      let k = 0;
      for (let j = 0; j < towers.length && k < 6; j++) {
        const a = towers[j];
        if (a.uid === t.uid) continue;
        if ((a.x - t.x) ** 2 + (a.y - t.y) ** 2 > aura * aura) continue;
        k++;
        const b = 0.5 + 0.5 * Math.sin(ctx.time * 2.6 + j);
        ctx.quad(ctx.b.bbA, MOTE, a.x, 1.35 + 0.06 * Math.sin(ctx.time * 2 + j), a.y, 0.12, 0.12, ctx.R.glow, ctx.col(lookAt(lk, 2) >= 5 ? GOLD : FLY), 0.6 + 0.4 * b);
      }
    }
  },
};
