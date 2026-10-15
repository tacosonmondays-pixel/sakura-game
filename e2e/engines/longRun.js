// A long co-op freeplay run and a rejoin deep into it (spec §12, M5 + M6), engine-agnostic: two
// Lockstep clients over a seeded fake network (0–9 frame delays, out of order), a strong scripted
// team on both sides (autoPlan, then upgrades as coins allow), Auto on at 3×, to wave `wave`.
// Then the link is cut both ways for longer than the drop timeout (both play on alone), healed,
// and the host re-admits the guest: the guest rebuilds from the host's newest wave-end checkpoint
// as a background job (a time-budgeted slice per frame). Measured: the rejoin message's size, the
// checkpoint replay (ticks, CPU time, slices, longest slice, the time it takes at 60 frames a
// second), what the old way (replaying the whole run from tick 0 in one go) costs on the same
// log, and that both clients agree for `after` more waves.
// e2e/coop-longrun.mjs bundles this and runs it in Node (V8), Bun (JavaScriptCore) and Chromium.
import { Lockstep } from '../../src/online/coop/lockstep.js';
import { quantize } from '../../src/online/coop/commands.js';
import { createRng } from '../../src/core/rng.js';
import { autoPlan } from '../../src/sim/headless.js';
import { coopStage, COOP } from '../../src/data/coop.js';
import { snapshotDigest } from '../../src/sim/snapshot.js';

const A_UNITS = ['kage', 'aoi', 'akane', 'shiro', 'miko', 'chika'];
const B_UNITS = ['yuki', 'sango', 'raika', 'midori', 'suzu', 'momo'];

/** @returns {object} the run's metrics (see the bottom) */
export function runLongRun({ wave = 150, after = 10, tier = 'blossom', stageId = '1-3', seed = 515, stats = { damageMul: 40, rateMul: 2, costMul: 0.2, critChance: 0.3, critMul: 1.5 }, maxFrames = 60 * 60 * 60 * 3 } = {}) {
  const t0 = Date.now();
  const start = {
    seed,
    stageId,
    difficulty: 'normal',
    freeplay: tier,
    players: [
      { slot: 0, uid: 'host', name: 'Host', loadout: A_UNITS.map((unitId) => ({ unitId, stats })), hero: { unitId: 'hikari', stats } },
      { slot: 1, uid: 'guest', name: 'Guest', loadout: B_UNITS.map((unitId) => ({ unitId, stats })), hero: null },
    ],
  };
  const rng = createRng(13);
  const clock = { t: 0 };
  const link = [true, true];
  const queue = [];
  let frame = 0;
  let offerBytes = 0;
  const mk = (slot) => new Lockstep({
    start,
    mySlot: slot,
    now: () => clock.t,
    send: (msg) => {
      if (msg.type === 'rejoin') offerBytes = JSON.stringify(msg).length;
      if (link[slot]) queue.push({ at: frame + Math.floor(rng.next() * 10), seq: queue.length, to: 1 - slot, msg: JSON.parse(JSON.stringify(msg)) });
    },
  });
  const [A, B] = [mk(0), mk(1)];
  const clients = [A, B];
  const plan = autoPlan(stageId, [...A_UNITS, ...B_UNITS, 'hikari'], { data: { stage: coopStage(stageId, { freeplay: tier }) }, maxCopies: 8 });
  const owner = (u) => (B_UNITS.includes(u) ? 1 : 0);
  let pi = 0;
  let turn = 0;
  /** One player's orders this frame, read off her own client (as a player sees her own screen). */
  function orders() {
    if (frame === 20) A.queue('auto', [true]);
    if (frame === 21) B.queue('speed', [3]);
    if (frame === 22) A.queue('wave');
    if (frame % 30 !== 0 || frame < 30) return;
    if (pi < plan.length) {
      const a = plan[pi];
      const c = clients[owner(a.unitId)];
      if (a.action === 'place') {
        const chk = c.sim.canPlace(a.unitId, a.x, a.y);
        if (chk.ok) {
          c.queue('place', [a.unitId, ...quantize(a.x, a.y)]);
          pi++;
        } else if (chk.reason !== 'cash') pi++;
      } else {
        const t = c.sim.towerAt(a.x, a.y);
        const st = t && c.sim.upgradeStatus(t.uid, a.path);
        if (!t || c.coop.ownerOf(t.uid) !== owner(a.unitId) || (st.locked && st.reason !== 'cash')) pi++;
        else if (!st.locked) {
          c.queue('upg', [t.uid, a.path]);
          pi++;
        }
      }
      return;
    }
    // then each player keeps spending on her own girls' best path
    for (const c of clients) {
      const own = c.sim.towers.filter((t) => c.coop.isMine(t.uid) && !t.isHero);
      if (!own.length) continue;
      const t = own[turn++ % own.length];
      const path = t.tiers.indexOf(Math.max(...t.tiers));
      if (!c.sim.upgradeStatus(t.uid, path).locked) c.queue('upg', [t.uid, path]);
    }
    if (A.sim.hero && A.sim.heroUltStatus().ready) A.queue('ult');
  }
  function step() {
    frame++;
    clock.t += 1000 / 60;
    const due = queue.filter((m) => m.at <= frame).sort((a, b) => a.at - b.at || a.seq - b.seq);
    for (const m of due) {
      queue.splice(queue.indexOf(m), 1);
      clients[m.to].receive(m.msg);
    }
    for (const c of clients) {
      c.advance(1 / 60);
      c.sim.events.length = 0;
    }
  }
  const over = () => A.finished || B.finished;
  // 1. play to wave `wave`
  while (frame < maxFrames && !over() && !(A.sim.wavesCleared >= wave && B.sim.wavesCleared >= wave)) {
    orders();
    step();
  }
  const playMs = Date.now() - t0;
  const reached = Math.min(A.sim.wavesCleared, B.sim.wavesCleared);
  const out = { stage: stageId, tier, reached, ticks: A.tick, towers: A.sim.towers.length, playMs, state: A.sim.state };
  if (reached < wave || over()) return { ...out, ok: false, why: `stopped at wave ${reached} (${A.sim.state})` };
  // on into the next wave until all of it has spawned (the cut then costs a whole wave of replay)
  while (frame < maxFrames && !over() && !(A.sim.state === 'wave' && A.sim._spawnIndex >= A.sim._spawnQueue.length && A.sim.enemies.length > 0)) {
    orders();
    step();
  }
  const ckBytes = A.ck ? JSON.stringify(A.ck.snap).length : 0;
  // the battle at the cut (everything up to here is deterministic: the same in every engine)
  const cutDigest = snapshotDigest(A.coop.snapshot());
  // 2. the old way, for comparison: the whole run replayed from tick 0 in one go (what froze the page)
  let tw = Date.now();
  const whole = new Lockstep({ start, mySlot: 1, send: () => {}, now: () => 0 });
  whole.rebuild(start, A.log, A.tick);
  const wholeMs = Date.now() - tw;
  const wholeSame = whole.coop.hash() === A.coop.hash();
  // 3. a cut longer than the drop timeout, both play on alone, then the rejoin
  link[0] = false;
  link[1] = false;
  for (let f = 0; f < Math.ceil((COOP.maxTimeoutMs / 1000 + 5) * 60) && !over(); f++) step();
  const apart = A.peers.get(1).gone && B.peers.get(0).gone;
  link[0] = true;
  link[1] = true;
  let jobFrames = 0;
  let sawJob = false;
  let ckDigest = 'none'; // the checkpoint the guest restores (taken by the host while apart)
  tw = Date.now();
  for (let f = 0; f < 60 * 120 && !over(); f++) {
    step();
    if (B.job) {
      if (!sawJob && A.ck) ckDigest = `${A.ck.t}:${snapshotDigest(A.ck.snap)}`;
      sawJob = true;
      jobFrames++;
    } else if (sawJob && A.rejoins >= 1 && B.rejoins >= 1 && !A.peers.get(1).gone) break;
  }
  const rejoinWallMs = Date.now() - tw;
  const r = B.lastRebuild || {};
  // 4. both play on together for `after` waves; every hash they both computed agrees
  const from = A.tick;
  const goal = A.sim.wavesCleared + after;
  while (frame < maxFrames * 2 && !over() && !(A.sim.wavesCleared >= goal && B.sim.wavesCleared >= goal)) {
    orders();
    step();
  }
  for (let f = 0; f < 30; f++) step();
  const pairs = [A, B].flatMap((c) => c.hashPairs().filter((p) => p.t > from));
  return {
    ...out,
    ok: true,
    apart,
    rejoins: `${A.rejoins}/${B.rejoins}`,
    offerKb: Math.round(offerBytes / 1024),
    ckKb: Math.round(ckBytes / 1024),
    ckMs: Math.round(A.ckMs * 10) / 10,
    logCmds: A.log.length,
    rebuild: { kind: r.kind, restored: r.restored, from: r.from, T: r.T, ticks: r.ticks, cpuMs: r.ms, slices: r.slices, maxSliceMs: r.maxSliceMs, restoreMs: r.restoreMs },
    jobFrames,
    // one slice per 60 Hz frame (the frame loop) — what the player waits on a phone-free desktop
    at60fpsMs: Math.round(jobFrames * 1000 / 60),
    rejoinWallMs,
    wholeTicks: whole.tick,
    wholeMs,
    wholeSame,
    after: Math.min(A.sim.wavesCleared, B.sim.wavesCleared) - (goal - after),
    pairs: pairs.length,
    agree: pairs.length > 0 && pairs.every((p) => p.mine === p.theirs) && !A.desynced && !B.desynced,
    cutDigest,
    ckDigest,
    // (after the rejoin the run depends on how many frames the time-sliced rebuild took, so the
    // final state is compared between the two clients, not between engines)
    finalDigest: snapshotDigest(A.coop.snapshot()),
    totalMs: Date.now() - t0,
  };
}
