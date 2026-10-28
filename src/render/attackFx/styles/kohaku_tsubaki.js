// Kohaku & Tsubaki (the duo · star shells + prism beam). Tsubaki's volley keeps the generic look (her muzzle flash;
// the shards land as small warning rings and blasts like any shell) until the duo's FX pass (DUO_LR §4 "Art").
//
// Kohaku's constant beam (src/sim/duo.js): drawn every frame from the sim's own holds (t.prismBeams: the enemy
// each beam holds and how long), never from an event and never written to. One beam per hold, from her prism to
// the enemy and on along the pierced line to her reach: a soft outer glow, a white core and a faint tail, with a
// gentle 1.1 Hz swell (none under reduced motion: a steady beam) instead of the old flash's flicker. It brightens
// a touch as Resonant Light climbs (a steady change, not a strobe). At Grand Spectrum the beams take the prism's
// colours. A beam fades in over ~0.1 s on a lock and fades out over ~0.15 s where it last was when its enemy dies
// or leaves her reach, so it ends cleanly between the sim's damage ticks.
// Draw cost: four camera-facing quads per beam and one on her prism, in the shared batch (no meshes, no allocation per frame:
// the per-beam display records are made once in init and reused).
import { genericAttack } from './generic.js';
import { CORE } from '../context.js';
import { prismRamp } from '../../../sim/duo.js';
import { DUO_SPREAD } from '../../../models/duo.js';

const MAX_BEAMS = 6;
const FADE_IN = 0.08; // game seconds
const FADE_OUT = 0.15;
const SWELL_HZ = 1.1;
const SWELL = 0.1;
const LILAC = '#c9a8ff';
// Grand Spectrum (3+ beams): one prism colour per beam
const SPECTRUM = ['#c9a8ff', '#8fd8ff', '#ffd27a', '#ff9ad5', '#9dffc4', '#ffffff'];

function rec() {
  return { a: 0, uid: -1, ax: 0, ah: 0, ay: 0, bx: 0, bh: 0, by: 0, ex: 0, ey: 0, k: 0, w: 0 };
}

/** Is a hold's enemy still drawn and in her reach? (sim objects read only) */
function liveHold(b, t, spec, ctx) {
  const e = b?.e;
  if (!e || e.dead || t.disabled > 0) return null;
  const dx = e.x - t.ox;
  const dy = e.y - t.oy;
  const r = spec.range + 0.25;
  if (dx * dx + dy * dy > r * r) return null;
  return ctx.enemy(e.uid);
}

export const kohaku_tsubaki = {
  id: 'kohaku_tsubaki',

  init() {
    const beams = [];
    for (let i = 0; i < MAX_BEAMS; i++) beams.push(rec());
    return { beams, on: 0 };
  },

  onAttack(ev, tw, t, ctx) {
    genericAttack(ev, tw, t, ctx);
  },

  update(gdt, tw, t, ctx) {
    const d = tw.data;
    const spec = t.beamSpec;
    const holds = t.prismBeams;
    if (!d || !spec) return;
    const v = ctx.tower(t.uid);
    if (!v) return;
    const m = v.model.position;
    const sc = v.model.scale?.x ?? (v.scale || 1.22);
    // her prism: Kohaku stands on the left of the pair (src/models/duo.js keeps the pair across the screen)
    const px = m.x - DUO_SPREAD * sc;
    const ph = m.y + 0.5 * sc;
    const pz = m.z;
    const many = spec.projectiles >= 3;
    const swellT = ctx.time * SWELL_HZ * Math.PI * 2;
    const tick = t.beamTickSpec;
    const B = ctx.b.bbA;
    const R = ctx.R;
    let on = 0;
    let prismA = 0;
    for (let i = 0; i < MAX_BEAMS; i++) {
      const r = d.beams[i];
      const b = holds && i < holds.length ? holds[i] : null;
      const ev = b && i < spec.projectiles ? liveHold(b, t, spec, ctx) : null;
      if (ev) {
        if (r.uid !== b.e.uid) {
          // a new lock: the beam fades in on its new enemy
          r.uid = b.e.uid;
          r.a = 0;
        }
        r.a = Math.min(1, r.a + gdt / FADE_IN);
        r.ax = px;
        r.ah = ph;
        r.ay = pz;
        r.bx = ev.x;
        r.bh = ctx.enemyH(ev);
        r.by = ev.z;
        // the pierced line runs on to her reach
        const dx = r.bx - px;
        const dy = r.by - pz;
        const len = Math.sqrt(dx * dx + dy * dy) || 1e-6;
        const reach = Math.max(len, spec.range);
        r.ex = px + (dx / len) * reach;
        r.ey = pz + (dy / len) * reach;
        r.k = spec.ramp && tick ? (prismRamp(spec, tick, b.held) - 1) / spec.ramp.max : 0;
      } else if (r.a > 0) {
        // its enemy died or left: fade out where it was
        r.a = Math.max(0, r.a - gdt / FADE_OUT);
        if (r.a === 0) r.uid = -1;
      }
      if (r.a <= 0.01) continue;
      on++;
      const swell = ctx.reduceMotion ? 0 : SWELL * Math.sin(swellT + i * 1.9);
      const c = ctx.col(many ? SPECTRUM[i % SPECTRUM.length] : LILAC);
      const white = ctx.col('#ffffff');
      const w = (0.18 + 0.035 * Math.min(6, spec.pierce)) * (1 + 0.25 * r.k) * (1 + swell);
      r.w = w;
      const a = r.a * (0.62 + 0.18 * r.k) * (1 + swell * 0.5);
      // outer glow, white core, the faint tail past the enemy and a soft glow on the impact
      ctx.line(B, CORE, r.ax, r.ah, r.ay, r.bx, r.bh, r.by, w, c, a);
      ctx.line(B, CORE, r.ax, r.ah, r.ay, r.bx, r.bh, r.by, w * 0.32, white, r.a * 0.85);
      if (r.ex !== r.bx || r.ey !== r.by) ctx.line(B, CORE, r.bx, r.bh, r.by, r.ex, r.bh * 0.85, r.ey, w * 0.7, c, a * 0.32);
      const g = 0.32 * (1 + 0.3 * r.k) * (1 + swell);
      ctx.quad(B, CORE, r.bx, r.bh, r.by, g, g, R.glow, c, r.a * 0.75);
      if (r.a > prismA) prismA = r.a;
    }
    // one soft glow on her prism, however many beams leave it (several stacked would bloom to white)
    if (prismA > 0.01) ctx.quad(B, CORE, px, ph, pz, 0.28, 0.28, R.glow, ctx.col(LILAC), prismA * 0.6);
    d.on = on;
  },

  /** e2e / test readout (allocates; dev tooling only): the beams drawn this frame (beam, fade, enemy uid, ramp, width). */
  probe(tw) {
    const beams = [];
    (tw.data?.beams || []).forEach((r, i) => {
      if (r.a > 0.01) beams.push({ i, a: r.a, uid: r.uid, k: r.k, w: r.w });
    });
    return { beams };
  },

  onRemove(tw) {
    if (tw.data) for (const r of tw.data.beams) {
      r.a = 0;
      r.uid = -1;
    }
  },
};
