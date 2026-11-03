// Co-op input lag: two real Lockstep clients (src/online/coop/lockstep.js) over a simulated
// network, measuring how long each order takes from the tap to the frame that shows it.
//   node --import ./tools/simLoader.mjs tools/coopLatency.mjs [--fps 60] [--secs 120] [--json]
// For every RTT / jitter row it plays a scripted battle in which both players give orders
// (place, upg, sell, abil, aim), once "busy" (an order every 2–4 s) and once "after a pause"
// (an order every 12–15 s, past the Supabase idle saver's 10 s), and reports per action:
//   own  = tap → the frame that shows it on my screen (the command's tick ran here, +1 frame)
//   ally = tap → the frame that shows it on my partner's screen
//   stall = share of frames a client waited for its partner ("Waiting for ally…"), and the input
//   delay the adaptive rule ended on.
// RTT is the round trip between the two players (Supabase Realtime relays every message through
// its server, so it is the client→server→client time; one way = RTT / 2), jitter an extra
// uniform 0..J ms per message; messages from one sender stay in order (one websocket).
// `--net live|<json>` picks the net settings (default: COOP_NET.supabase as shipped); `--nudge 800` has the
// player select the girl / arm the card (Lockstep.nudge, COOP 15) that long before each order.
import { Lockstep } from '../src/online/coop/lockstep.js';
import { createCoopSim, quantize, abilArgs } from '../src/online/coop/commands.js';
import { COOP_NET } from '../src/data/coop.js';
import { createRng } from '../src/core/rng.js';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const FPS = Number(arg('fps', 60));
const SECS = Number(arg('secs', 150));
const JSON_OUT = process.argv.includes('--json');
const NET_ARG = arg('net', 'live');
// the UI's Lockstep.nudge() (selecting the girl, arming her card) this long before each order; 0 = none
const NUDGE_MS = Number(arg('nudge', 0));
const NET = NET_ARG === 'live' ? COOP_NET.supabase : { ...COOP_NET.supabase, ...JSON.parse(NET_ARG) };

const CHEAP = { costMul: 0.5 };
const START = {
  seed: 4242,
  stageId: '1-3',
  difficulty: 'normal',
  players: [
    { slot: 0, uid: 'host', name: 'Host', loadout: [{ unitId: 'aoi', stats: CHEAP }, { unitId: 'rei', stats: CHEAP }], hero: { unitId: 'hikari', stats: CHEAP } },
    { slot: 1, uid: 'guest', name: 'Guest', loadout: [{ unitId: 'yuki', stats: CHEAP }, { unitId: 'rei', stats: CHEAP }], hero: null },
  ],
};

function spotsFor(unitId, n) {
  const c = createCoopSim(START);
  const out = [];
  for (let y = 0.55; y < c.sim.map.height && out.length < n; y += 0.45) {
    for (let x = 0.55; x < c.sim.map.width && out.length < n; x += 0.45) {
      if (!c.sim.placementReason(unitId, x, y) && !out.some(([a, b]) => Math.hypot(a - x, b - y) < 1.6)) out.push([x, y]);
    }
  }
  return out;
}

function run({ rtt, jitter, gapMs, seed = 1 }) {
  const rng = createRng(seed * 7919 + rtt * 31 + jitter);
  const clock = { t: 0 };
  const inbox = []; // { at, to, msg }
  const lastAt = [0, 0]; // in-order delivery per sender
  const issued = new Map(); // `${p}:${s}` -> { k, at, own, ally }
  const mk = (slot) => new Lockstep({
    start: START,
    mySlot: slot,
    now: () => clock.t,
    delay: NET.inputDelay,
    heartbeatMs: NET.heartbeatMs,
    keepaliveMs: NET.keepaliveMs,
    idleAfterMs: NET.idleAfterMs,
    idleLeadTicks: NET.idleLeadTicks,
    idleKeepaliveMs: NET.idleKeepaliveMs,
    hooks: {
      onApplied: (c) => {
        const r = issued.get(`${c.p}:${c.s}`);
        if (!r) return;
        // shown by the frame being drawn now (advance runs before the renderer in the same rAF)
        const shown = clock.t + 1000 / FPS;
        if (c.p === slot) r.own = shown - r.at;
        else r.ally = shown - r.at;
      },
    },
    send: (msg) => {
      const d = rtt / 2 + rng.next() * jitter;
      const at = Math.max(lastAt[slot], clock.t + d);
      lastAt[slot] = at;
      inbox.push({ at, to: 1 - slot, msg: JSON.parse(JSON.stringify(msg)) });
    },
  });
  const C = [mk(0), mk(1)];
  const spots = [spotsFor('aoi', 6), spotsFor('yuki', 6)];
  const units = ['aoi', 'yuki'];
  const mine = [null, null]; // uid of each player's placed girl
  const nextAt = [800, 1300];
  const plan = ['place', 'upg', 'aim', 'abil', 'upg', 'sell'];
  const step = [0, 0];
  let spotI = [0, 0];
  const frameMs = 1000 / FPS;
  let frames = 0;
  const stalledFrames = [0, 0];
  let nextPump = 250;
  let waveQueued = false;
  for (let t = 0; t < SECS * 1000; t += frameMs) {
    clock.t = t;
    for (let i = inbox.length - 1; i >= 0; i--) if (inbox[i].at <= t) C[inbox[i].to].receive(inbox.splice(i, 1)[0].msg);
    // session pump (every heartbeatMs between frames: a beat)
    if (t >= nextPump) {
      nextPump += NET.heartbeatMs;
      C.forEach((c) => c.beat());
    }
    for (let p = 0; p < 2; p++) {
      const c = C[p];
      if (!waveQueued && p === 0 && t > 500) {
        waveQueued = true;
        c.queue('wave', []);
        c.queue('auto', [true]);
      }
      if (NUDGE_MS > 0 && t >= nextAt[p] - NUDGE_MS && c.nudge) c.nudge();
      if (t < nextAt[p]) continue;
      if (mine[p] == null) {
        const tw = c.sim.towers.find((x) => c.coop.ownerOf(x.uid) === p && !x.def.hero);
        if (tw) mine[p] = tw.uid;
      }
      let k = plan[step[p] % plan.length];
      if (k !== 'place' && mine[p] == null) k = 'place';
      if (k === 'place' && mine[p] != null) k = 'upg';
      let a;
      if (k === 'place') {
        const s = spots[p][spotI[p]++ % spots[p].length];
        a = [units[p], ...quantize(s[0], s[1])];
      } else if (k === 'upg') a = [mine[p], step[p] % 2];
      else if (k === 'aim') a = [mine[p], ...quantize(5, 5)];
      else if (k === 'abil') a = abilArgs(mine[p], {});
      else a = [mine[p]];
      const cmd = c.queue(k, a);
      if (cmd) issued.set(`${cmd.p}:${cmd.s}`, { k, p, at: t, own: null, ally: null });
      if (k === 'sell') mine[p] = null;
      step[p]++;
      nextAt[p] = t + gapMs[0] + rng.next() * (gapMs[1] - gapMs[0]);
    }
    C.forEach((c, p) => {
      c.advance(frameMs / 1000);
      if (c.stalled) stalledFrames[p]++;
    });
    frames++;
  }
  const by = {};
  for (const r of issued.values()) {
    if (r.own == null || r.ally == null) continue;
    (by[r.k] ||= []).push(r);
  }
  const hashOk = C[0].hashPairs().every((x) => x.mine === x.theirs) && C[1].hashPairs().every((x) => x.mine === x.theirs);
  return { by, stall: stalledFrames.map((n) => n / frames), delay: C.map((c) => c.delay), sent: C.map((c) => c.sent), hashOk, ticks: C.map((c) => c.tick) };
}

const pct = (xs, q) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN;
};

const ROWS = [
  { rtt: 0, jitter: 0 },
  { rtt: 50, jitter: 10 },
  { rtt: 100, jitter: 30 },
  { rtt: 200, jitter: 60 },
  { rtt: 200, jitter: 200 },
  { rtt: 300, jitter: 300 },
];
const MODES = [
  { name: 'busy', gapMs: [2000, 4000] },
  { name: 'after a pause', gapMs: [12000, 15000] },
];
const out = [];
for (const m of MODES) {
  for (const row of ROWS) {
    const r = run({ ...row, gapMs: m.gapMs });
    const all = Object.values(r.by).flat();
    const line = {
      mode: m.name, rtt: row.rtt, jitter: row.jitter,
      ownMed: Math.round(pct(all.map((x) => x.own), 0.5)), ownP90: Math.round(pct(all.map((x) => x.own), 0.9)),
      allyMed: Math.round(pct(all.map((x) => x.ally), 0.5)), allyP90: Math.round(pct(all.map((x) => x.ally), 0.9)),
      perKind: Object.fromEntries(Object.entries(r.by).map(([k, xs]) => [k, Math.round(pct(xs.map((x) => x.own), 0.5))])),
      stall: r.stall.map((x) => `${(x * 100).toFixed(1)}%`).join('/'), delay: r.delay.join('/'),
      msgsPerSec: ((r.sent[0] + r.sent[1]) / 2 / SECS).toFixed(1), n: all.length, hashOk: r.hashOk,
    };
    out.push(line);
  }
}
if (JSON_OUT) console.log(JSON.stringify({ net: NET, fps: FPS, secs: SECS, rows: out }, null, 1));
else {
  console.log(`net ${JSON.stringify(NET)}  fps ${FPS}  ${SECS}s per row  nudge ${NUDGE_MS} ms`);
  console.log('mode           RTT  jit | own med  p90 | ally med  p90 | per action (own med)                       | stall h/g     | delay | msg/s | n  | hash');
  for (const l of out) {
    const kinds = Object.entries(l.perKind).map(([k, v]) => `${k} ${v}`).join(' ');
    console.log(`${l.mode.padEnd(14)} ${String(l.rtt).padStart(4)} ${String(l.jitter).padStart(4)} | ${String(l.ownMed).padStart(7)} ${String(l.ownP90).padStart(4)} | ${String(l.allyMed).padStart(8)} ${String(l.allyP90).padStart(4)} | ${kinds.padEnd(42)} | ${l.stall.padEnd(13)} | ${l.delay.padEnd(5)} | ${l.msgsPerSec.padStart(5)} | ${String(l.n).padStart(2)} | ${l.hashOk ? 'ok' : 'MISMATCH'}`);
  }
}
