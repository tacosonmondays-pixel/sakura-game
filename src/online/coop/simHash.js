// FNV-1a hash over the quantized, gameplay-relevant state of a co-op battle. Both clients
// compare it every COOP.hashEvery ticks to detect a desync.
import { LAB_CLASSES } from '../../sim/lab.js';

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** Streaming 32-bit FNV-1a over integers. */
export function createHasher() {
  let h = FNV_OFFSET;
  return {
    int(v) {
      let x = Math.round(Number(v) || 0) | 0;
      for (let i = 0; i < 4; i++) {
        h ^= x & 0xff;
        h = Math.imul(h, FNV_PRIME) >>> 0;
        x >>>= 8;
      }
      return this;
    },
    str(s) {
      const t = String(s ?? '');
      for (let i = 0; i < t.length; i++) {
        h ^= t.charCodeAt(i) & 0xff;
        h = Math.imul(h, FNV_PRIME) >>> 0;
      }
      return this;
    },
    get value() {
      return h >>> 0;
    },
  };
}

/**
 * @param {import('../../sim/Sim.js').Sim} sim
 * @param {{ tick: number, wallets: number[] }} extra
 * @returns {number} unsigned 32-bit hash
 */
export function hashSim(sim, { tick = 0, wallets = [] } = {}) {
  const h = createHasher();
  h.int(tick).int(sim.wave).int(sim.lives).str(sim.state).int(sim._uid);
  for (const w of wallets) h.int(w);
  h.int(sim.enemies.length);
  for (const e of sim.enemies) {
    h.int(e.uid).int(e.x * 256).int(e.y * 256).int(e.hp * 16);
    // freeplay HP passes 2^27 (where hp × 16 wraps in 32 bits): hash the high part too (an exact
    // division by 2^28; never taken below it, so campaign hashes are unchanged)
    if (e.hp >= 134217728) h.int(Math.floor(e.hp / 268435456));
  }
  h.int(sim.towers.length);
  for (const t of sim.towers) {
    h.int(t.uid).int(t.tiers[0]).int(t.tiers[1]).int(t.tiers[2]).int(t.x * 1024).int(t.y * 1024).str(t.targetMode);
    // heroes only (battles without one keep their digest): a level / XP difference shows at once
    if (t.isHero) h.int(t.level).int(t.xp * 16);
    // drones (and the wing's flight mode) only for girls that have some: battles without drones
    // keep their digests (docs/specs/LANDING_PLAN.md S8)
    if (t.turrets.length) {
      h.int(t.turrets.length);
      for (const d of t.turrets) h.int(d.uid).int(d.x * 256).int(d.y * 256);
      if (t.flight) h.str(t.flight.mode).int(t.flight.cx * 256).int(t.flight.cy * 256);
    }
    // her ⚡ ability only once it was cast or switched to Auto (integers: charge points, ticks): a battle
    // that never casts keeps its digest (modesGolden pins bot battles with tier-3 girls)
    const a = t.abil;
    if (a && (a.n > 0 || a.auto)) h.int(a.cd).int(a.active).int(a.auto ? 1 : 0).int(a.n);
    // Tenka's lab team (src/sim/lab.js) only on a girl who has one (battles without a lab keep their digest):
    // rounds, the member count and who joined, members and coins per class, the economy weapon's income and
    // interest rates (in 1/10000), and her grenade / field timers (ticks)
    const lab = t.lab;
    if (lab) {
      h.int(lab.rounds).int(lab.uids.length);
      for (const u of lab.uids) h.int(u);
      for (const k of LAB_CLASSES) h.int(lab.members[k]).int(lab.coins[k]);
      h.int(lab.income);
      const ir = lab.interest;
      h.int(ir ? ir.length : 0);
      if (ir) for (const v of ir) h.int(v * 10000);
      const la = t.labAtk;
      if (la) h.int(la.fragCd).int(la.fieldCd);
    }
    // Tenka's well and Last Line timers (src/sim/zones.js), only on a girl who has one of them (ticks)
    if (t.wellCd != null || t.lastLineCd != null) h.int(t.wellCd ?? -1).int(t.lastLineCd ?? -1);
    // attack shapes S1 (src/sim/wheels.js), only on a girl who has them this wave: the Pinwheel arm index and
    // each Petal Halo piece's memory ([uid, step] pairs); battles without them keep their digest
    if (t.spinK != null) h.int(t.spinK);
    const hh = t.haloHits;
    if (hh) {
      h.int(hh.length);
      for (const l of hh) {
        h.int(l.length);
        for (let i = 0; i < l.length; i++) h.int(l[i]);
      }
    }
    // attack shapes S2 (src/sim/channel.js, src/sim/held.js), only on a girl with a held channel open this wave:
    // every integer of t.ch and its re-hit memory; battles without one keep their digest
    const ch = t.ch;
    if (ch) {
      h.int(ch.uid).int(ch.k).int(ch.lock).int(ch.tick).int(ch.grace).int(ch.src).int(ch.trick).int(ch.px).int(ch.c).int(ch.ph).int(ch.pass).int(ch.n);
      h.int(ch.hits.length);
      for (let i = 0; i < ch.hits.length; i++) h.int(ch.hits[i]);
    }
    // attack shapes S3 (src/sim/vines.js, src/sim/ground.js), each list only while it holds something this wave:
    // Bramble Road vines (and her vine timer), spike rows and quake rings with their re-hit memories (integers; a
    // vine's root and length in 1/256 tiles); battles without them keep their digest
    const vs = t.vines;
    if (vs && vs.length) {
      h.int(vs.length).int(t.vineCd ?? -1);
      for (const v of vs) h.int(v.uid).int(v.pathIndex).int(v.root * 256).int(v.len * 256).int(v.age).int(v.life).int(v.held);
    }
    const rows = t.spikeRows;
    if (rows && rows.length) {
      h.int(rows.length);
      for (const r of rows) {
        h.int(r.uid).int(r.age).int(r.next).int(r.n).int(r.lead).int(r.hit.length);
        for (let i = 0; i < r.hit.length; i++) h.int(r.hit[i]);
      }
    }
    const qs = t.quakes;
    if (qs && qs.length) {
      h.int(qs.length);
      for (const q of qs) {
        h.int(q.uid).int(q.wait).int(q.g).int(q.i).int(q.skip).int(q.hit.length);
        for (let i = 0; i < q.hit.length; i++) h.int(q.hit[i]);
      }
    }
  }
  // open zones (wells, Last Line), only while there is one: a battle without zones keeps its digest
  const zs = sim.zones;
  if (zs && zs.length) {
    h.int(zs.length);
    for (const z of zs) h.int(z.uid).int(z.src).str(z.kind).int(z.x * 256).int(z.y * 256).int(z.left).int(z.eaten).int(z.next);
  }
  // attack shapes S4 (src/sim/links.js), each only while there is one: Spirit Tether groups (uid, owner, steps left,
  // members in tie order) and this step's share budget, and the Homecoming Throw's fans in the air (leg, cuts, spot,
  // way flown, hit list); battles without them keep their digest
  const tg = sim.tethers;
  if (tg && tg.length) {
    h.int(tg.length).int(sim._shareBudget);
    for (const g of tg) {
      h.int(g.uid).int(g.owner.uid).int(g.left).int(g.m.length);
      for (let i = 0; i < g.m.length; i++) h.int(g.m[i].uid);
    }
  }
  let fans = 0;
  for (const p of sim.projectiles) if (p.ret && !p.dead) fans++;
  if (fans) {
    h.int(fans);
    for (const p of sim.projectiles) {
      if (!p.ret || p.dead) continue;
      h.int(p.uid).int(p.ret.leg).int(p.ret.n).int(p.x * 256).int(p.y * 256).int(p.travel * 256).int(p.hits.length);
    }
  }
  // Kage's shadow doubles (src/sim/deploys.js), only while one stands: a battle without them keeps its digest
  const dp = sim.deployables;
  if (dp && dp.length) {
    h.int(dp.length);
    for (const d of dp) h.int(d.uid).int(d.ownerUid).int(d.x * 256).int(d.y * 256).int(d.left);
  }
  // the rest of the ability state, each part only while it holds something (src/sim/abilities.js)
  if (sim.abilGroups?.size) {
    h.int(sim.abilGroups.size);
    for (const k of [...sim.abilGroups.keys()].sort()) h.str(k).int(sim.abilGroups.get(k).cd);
  }
  const rallies = sim._rallies;
  const queue = sim._abilQueue;
  if (rallies?.length || queue?.length) {
    h.int(rallies.length);
    for (const r of rallies) {
      h.int(r.src).int(r.left).int(r.to ?? -1);
      // a rally that brings lives back: its kill counter and the lives it gave (only on such a rally: Noa's)
      if (r.life) h.int(r.life.kills).int(r.life.given);
    }
    h.int(queue.length);
    for (const it of queue) h.int(it.src).int(it.left);
  }
  const ad = sim.abilityAutoDefault;
  if (ad && (ad[0] || ad[1])) h.int(ad[0] ? 1 : 0).int(ad[1] ? 1 : 0);
  const uses = sim.abilUses;
  if (uses && (uses[0] || uses[1])) h.int(uses[0]).int(uses[1]);
  // a Tryout Day run (only in one: every other battle keeps its digest): the run state a desync would show in
  // first (offers, cards, credits, counters, seat holders, score; docs/specs/TRYOUT_DAY.md §14.4)
  const ty = sim.tryout;
  if (ty) {
    h.int(ty.period).int(ty.started).int(ty.score).int(ty.periodScore).int(ty.moves).int(ty.heartsAdded).int(sim.maxLives);
    for (const v of ty.seats.holder) h.int(v ?? -1);
    // Grade 8+: the period's affix (only in a run that has them, so a lower Grade's digest is as it was)
    if (ty.affixes?.[ty.period]) h.str(ty.affixes[ty.period]);
    for (const c of ty.ctr) h.int(c.spent).int(c.placed).int(c.upgrades).int(c.sells).int(c.ults);
    for (const p of ty.players) {
      h.str(p.win || '-').int(p.winTicks).int(p.seq).int(p.erasers).int(p.passes).int(p.bank).int(p.cleared).int(p.lr).str(p.squad.join(','));
      for (const c of p.cards) h.str(c.id).int(c.r).str(c.unit || '');
      if (p.offer) for (const c of p.offer.cards) h.str(c.girl || c.id).int(c.r ?? -1).str(c.unit || '');
    }
  }
  return h.value;
}
