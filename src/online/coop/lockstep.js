// Lockstep netcode for 2-player co-op on the deterministic Sim (seeded, fixed 1/60 steps).
// Both clients run the same CoopSim; only player commands travel, each stamped with a tick a
// few frames in the future (input delay) and executed on every client at exactly that tick.
//
// Messages (any transport that delivers JSON objects; order and loss are tolerated):
//   { type: 'in', from, horizon, ack, cmds, live }  every heartbeat and right after a command:
//        "I will send no more commands with t <= horizon; I executed every tick < ack + 1".
//        cmds = my commands the peer has not executed yet (re-sent until acked → lossy links ok)
//        live = my battle is running (before that the peer allows COOP.loadTimeoutMs of silence)
//   { type: 'hash', from, t, h }               state hash after tick t (every COOP.hashEvery)
//   { type: 'resync?', from }                  guest saw a hash mismatch: please send state
//   { type: 'resync', from, start, T, cmds }   host: rebuild from start, replay cmds up to T
//   { type: 'bye', from, why? }                leaving (why 'timeout': "I lost you", rejoinable)
//   { type: 'rejoin', from, ep, start, T, cmds }  host → a dropped guest that is alive again:
//                                              adopt my timeline (rebuild, replay to T)
// Every message carries `ep` (the timeline epoch, bumped by each rejoin) so packets from a
// timeline that was abandoned are ignored; 'in' also lists the slots its sender lost (`gone`).
// A client only runs tick T once every connected peer's horizon >= T; otherwise it stalls
// ("Waiting for ally…") and raises its own input delay a little. A peer silent for
// COOP.timeoutMs (COOP.loadTimeoutMs before its first packet: its battle screen is still
// loading) is dropped: its towers stay, its income goes to the survivor. If the dropped peer
// was only frozen or cut off (a phone switching apps, a long load, a network hiccup) and its
// packets arrive again, the host re-admits it: the guest rebuilds the battle from the host's
// command log (which records the drop and the return as 'gone' / 'join' markers, so both
// replay the same wallets) and both continue in lockstep. Leaving on purpose is final.
import { COOP } from '../../data/coop.js';
import { createCoopSim, compareCmds, isValidCmd } from './commands.js';

const MAX_CATCHUP = 12; // ticks per advance() call beyond the frame's own share
const FATAL_WINDOW_MS = 30000;
/** A gap this long between our own beats means THIS client was frozen (loading, GC, tab switch). */
const FREEZE_MS = 1000;
/** Host: re-send a rejoin offer this often while the guest still talks in the old timeline. */
const REJOIN_RESEND_MS = 1500;
/** Host: an offer nobody accepts within this long (one-way link) is withdrawn: play on solo… */
const OFFER_TIMEOUT_MS = 6000;
/** …and only offered again after this pause (doubling per failed offer, up to the max), so a
 *  broken link never keeps the host waiting for long. */
const REJOIN_COOLDOWN_MS = 8000;
const REJOIN_COOLDOWN_MAX_MS = 60000;
/** Guest told by a live host that it was dropped ('lost'): hold still this long for the host's
 *  rejoin offer instead of playing on alone (no divergence → no battle-screen rebuild). */
const REJOIN_WAIT_MS = 6000;
/** Drop reasons after which the peer may come back (any other — 'left', 'desync' — is final). */
const REJOINABLE = new Set(['timeout', 'lost']);
/** Marker commands ('gone' / 'join') sort before the players' own commands of their tick. */
const MARK_BASE = -1000000;

export class Lockstep {
  /**
   * @param {{ start: object, mySlot: number, send: (msg: object) => void, now?: () => number,
   *   delay?: number, heartbeatMs?: number,
   *   hooks?: { onApplied?: Function, onResync?: Function, onDesync?: Function, onPeerGone?: Function } }} opts
   *   delay / heartbeatMs: the transport's profile (local tabs 6 ticks / 50 ms, Supabase 12 / 100)
   */
  constructor({ start, mySlot, send, now = () => Date.now(), delay = COOP.inputDelay, heartbeatMs = COOP.heartbeatMs, hooks = {} }) {
    this.start = start;
    this.mySlot = mySlot;
    this.sendRaw = send;
    this.now = now;
    this.delay = delay;
    this.heartbeatMs = heartbeatMs;
    this.hooks = hooks;
    this.coop = createCoopSim(start, { mySlot });
    this.seq = 0;
    this.promised = -1;
    this.acc = 0;
    this.stalled = false;
    this.stallTicks = 0;
    this.lastBeat = -Infinity;
    this.pending = new Map(); // tick -> cmd[]
    this.known = new Set(); // `${p}:${s}`
    this.log = []; // every command ever accepted (for resync)
    this.hashes = new Map(); // t -> my hash
    this.peerHashes = new Map(); // t -> peer hash
    this.mismatches = []; // times
    this.resyncPending = 0;
    this.desynced = false;
    this.resyncs = 0;
    this.rejoins = 0;
    this.epoch = 0; // timeline id: bumped by the host each time it re-admits a dropped guest
    this.markSeq = 0;
    this.running = false; // advance() was called at least once (the battle screen is up)
    /** Last connection events (drop, rejoin, resync…) for the debug HUD and the e2e test. */
    this.trace = [];
    this.peers = new Map();
    for (const p of start.players) {
      if (p.slot !== mySlot) this.peers.set(p.slot, { slot: p.slot, horizon: -1, ack: -1, lastHeard: now(), gone: false, why: null, ready: false, jitter: 0, offer: null, offerAt: 0, offerSince: 0, rejoinAfter: 0, failedOffers: 0, goneAt: 0 });
    }
  }

  get sim() {
    return this.coop.sim;
  }

  /** Records a connection event (kept short: the last 40). */
  note(ev, extra = {}) {
    this.trace.push({ at: Math.round(this.now()), tick: this.tick, ep: this.epoch, ev, ...extra });
    if (this.trace.length > 40) this.trace.shift();
  }

  get tick() {
    return this.coop.tick;
  }

  get isHost() {
    return this.mySlot === Math.min(...this.start.players.map((p) => p.slot));
  }

  /** Effective delay in ticks (scaled by game speed so the felt lag stays ~0.1 s). */
  get delayTicks() {
    return this.delay * this.coop.speed;
  }

  /** How long `peer` may stay silent before it counts as gone. */
  timeoutFor(peer) {
    if (!peer.ready) return COOP.loadTimeoutMs;
    return Math.min(COOP.maxTimeoutMs, Math.max(COOP.timeoutMs, 3 * peer.jitter));
  }

  livePeers() {
    return [...this.peers.values()].filter((p) => !p.gone);
  }

  horizon() {
    this.promised = Math.max(this.promised, this.tick + this.delayTicks - 1);
    return this.promised;
  }

  /**
   * Issues a local command. It runs on every client at the returned cmd's tick.
   * @param {string} k kind (see commands.js KINDS)
   * @param {any[]} a args
   */
  queue(k, a = []) {
    const t = Math.max(this.tick + this.delayTicks, this.promised + 1);
    const cmd = { t, p: this.mySlot, s: this.seq++, k, a };
    this.accept(cmd);
    this.beat(true);
    return cmd;
  }

  accept(cmd) {
    const key = `${cmd.p}:${cmd.s}`;
    if (this.known.has(key)) return false;
    this.known.add(key);
    this.log.push(cmd);
    const list = this.pending.get(cmd.t) || [];
    list.push(cmd);
    this.pending.set(cmd.t, list);
    return true;
  }

  /** Records a deterministic 'gone' / 'join' marker for `slot` at the current tick (in the log, so replays see it). */
  mark(k, slot) {
    this.accept({ t: this.tick, p: slot, s: MARK_BASE + ++this.markSeq, k, a: [] });
  }

  send(msg) {
    try {
      this.sendRaw({ ...msg, from: this.mySlot, ep: this.epoch });
    } catch (e) {
      // a dead transport is the same as a lossy one: heartbeats retry
      console.warn('[lockstep] send failed', e);
    }
  }

  /**
   * Silence only counts while this client itself was running: after our own main thread was
   * blocked (battle screen loading, a long GC, a hidden tab), the peers get that time back
   * before the timeout check, so a slow load here never drops a healthy ally.
   */
  wake() {
    const t = this.now();
    if (this.lastRun != null && t - this.lastRun > FREEZE_MS) {
      const gap = t - this.lastRun;
      for (const p of this.peers.values()) {
        p.lastHeard += gap;
        // a pending rejoin offer's clock stops too (its answer may be waiting in my mailbox)
        if (p.offer) p.offerSince += gap;
      }
    }
    this.lastRun = t;
    return t;
  }

  /** Heartbeat: horizon + my not-yet-acknowledged commands. */
  beat(force = false) {
    const t = this.wake();
    if (!force && t - this.lastBeat < this.heartbeatMs) return;
    this.lastBeat = t;
    const minAck = Math.min(...this.livePeers().map((p) => p.ack), Infinity);
    const floor = Number.isFinite(minAck) ? minAck : this.tick - 1;
    const cmds = this.log.filter((c) => c.p === this.mySlot && c.t > floor);
    // live: my battle screen is up and ticking (until then the ally allows the long load timeout)
    const gone = [...this.peers.values()].filter((p) => p.gone).map((p) => p.slot);
    this.send({ type: 'in', horizon: this.horizon(), ack: this.tick - 1, cmds, live: this.running, gone });
  }

  /** Handles one message from a peer. */
  receive(msg) {
    if (!msg || msg.from === this.mySlot) return;
    const peer = this.peers.get(msg.from);
    if (!peer) return;
    const ep = Number.isInteger(msg.ep) ? msg.ep : 0;
    // the host offers a dropped guest its timeline (a newer epoch than the guest's)
    if (msg.type === 'rejoin') {
      if (!this.isHost && ep > this.epoch && !this.desynced && (!peer.gone || REJOINABLE.has(peer.why))) this.applyRejoin(peer, msg);
      return;
    }
    if (msg.type === 'bye') {
      // 'timeout' = "I stopped hearing you" (from this timeline only): both play on, and the host
      // re-admits the guest as soon as packets flow again. Any other goodbye (Leave, closing the
      // tab) is final, whatever the timeline.
      this.note('bye', { why: msg.why || null, ep });
      if (msg.why === 'timeout') {
        if (ep === this.epoch) this.dropPeer(peer, 'lost');
      } else if (peer.gone) peer.why = 'left';
      else this.dropPeer(peer, 'left');
      return;
    }
    if (peer.gone) {
      // a dropped guest is talking again (it was frozen or cut off, not gone): re-admit it
      if (msg.type === 'in' && this.isHost && REJOINABLE.has(peer.why) && !this.desynced && !this.finished && this.now() >= peer.rejoinAfter) this.rejoin(peer);
      return;
    }
    const t = this.now();
    if (ep !== this.epoch) {
      // a packet from an abandoned timeline (sent before the guest adopted my rejoin offer):
      // its promises and commands mean nothing here (and it does not count as hearing the
      // peer: an offer that never gets through is withdrawn after OFFER_TIMEOUT_MS)
      if (this.isHost && peer.offer && ep < this.epoch && t - peer.offerAt > REJOIN_RESEND_MS) this.sendOffer(peer);
      return;
    }
    // slowly decaying worst gap between this peer's packets (adaptive timeout, like TCP's RTO)
    if (peer.ready) peer.jitter = Math.max(t - peer.lastHeard, peer.jitter * 0.995);
    peer.lastHeard = t;
    switch (msg.type) {
      case 'in':
        if (Array.isArray(msg.gone) && msg.gone.includes(this.mySlot)) {
          // it lost me (one-way silence) while I still heard it: split up, then the host re-admits
          this.dropPeer(peer, 'lost');
          if (this.isHost && !this.desynced && !this.finished) this.rejoin(peer);
          break;
        }
        if (peer.offer) {
          peer.offer = null; // the guest took my rejoin offer
          peer.failedOffers = 0;
        }
        for (const c of Array.isArray(msg.cmds) ? msg.cmds : []) {
          if (!isValidCmd(c) || c.p !== msg.from) continue;
          if (this.known.has(`${c.p}:${c.s}`)) continue;
          if (c.t < this.tick) {
            // arrived after its tick already ran here: only possible after a desync
            this.accept(c);
            this.flagMismatch();
            continue;
          }
          this.accept(c);
        }
        if (msg.live) peer.ready = true;
        if (Number.isInteger(msg.horizon)) peer.horizon = Math.max(peer.horizon, msg.horizon);
        if (Number.isInteger(msg.ack)) peer.ack = Math.max(peer.ack, msg.ack);
        break;
      case 'hash':
        if (!Number.isInteger(msg.t)) break;
        this.peerHashes.set(msg.t, msg.h);
        if (this.peerHashes.size > 64) this.peerHashes.delete(this.peerHashes.keys().next().value);
        this.compare(msg.t);
        break;
      case 'resync?':
        if (this.isHost) this.send({ type: 'resync', start: this.start, T: this.tick, cmds: this.log });
        break;
      case 'resync':
        if (!this.isHost && this.resyncPending) this.applyResync(msg);
        break;
      default:
        break;
    }
  }

  compare(t) {
    if (!this.hashes.has(t) || !this.peerHashes.has(t)) return;
    if (this.hashes.get(t) !== this.peerHashes.get(t)) this.flagMismatch();
  }

  flagMismatch() {
    if (this.desynced || this.resyncPending) return;
    const t = this.now();
    this.mismatches = this.mismatches.filter((x) => t - x < FATAL_WINDOW_MS);
    this.mismatches.push(t);
    if (this.mismatches.length >= 2) {
      // a second desync shortly after a resync: the engines disagree (e.g. Math.sin), give up
      this.desynced = true;
      for (const p of this.peers.values()) this.dropPeer(p, 'desync');
      this.send({ type: 'bye' });
      this.hooks.onDesync?.('fatal');
      return;
    }
    this.hooks.onDesync?.('resync');
    if (!this.isHost) {
      this.resyncPending = t;
      this.send({ type: 'resync?' });
    }
  }

  /** Guest: rebuild the CoopSim from the host's log and fast-forward to the host's tick. */
  applyResync(msg) {
    this.note('resync', { T: msg.T });
    const keepMine = this.log.filter((c) => c.p === this.mySlot && c.s >= 0);
    this.rebuild(msg.start, [...(msg.cmds || []), ...keepMine], msg.T);
    this.resyncPending = 0;
    this.resyncs++;
    this.hooks.onResync?.(this.coop);
  }

  /** Rebuilds the CoopSim from a start message and a command log, then fast-forwards to tick T. */
  rebuild(start, cmds, T) {
    this.coop = createCoopSim(start || this.start, { mySlot: this.mySlot });
    this.pending = new Map();
    this.known = new Set();
    this.log = [];
    for (const c of cmds.filter((x) => isValidCmd(x, { markers: true })).sort(compareCmds)) this.accept(c);
    this.hashes = new Map();
    this.peerHashes = new Map();
    while (this.tick < T) this.runTick({ silent: true });
  }

  /** Host: take a dropped (but alive) guest back into this timeline from the current tick. */
  rejoin(peer) {
    this.epoch++;
    this.note('rejoin', { slot: peer.slot });
    peer.gone = false;
    peer.why = null;
    // the guest rebuilds its battle screen from my log: give it the loading allowance again
    // (COOP.loadTimeoutMs) until its packets say it is live
    peer.ready = false;
    peer.horizon = this.tick - 1; // nothing runs until the guest promises again in the new epoch
    peer.ack = this.tick - 1;
    peer.lastHeard = this.now();
    peer.jitter = 0;
    this.mark('join', peer.slot);
    this.rejoins++;
    peer.offerSince = this.now();
    this.sendOffer(peer);
    this.hooks.onPeerBack?.(peer.slot);
  }

  sendOffer(peer) {
    peer.offer = true;
    peer.offerAt = this.now();
    this.send({ type: 'rejoin', start: this.start, T: this.tick, cmds: this.log });
  }

  /**
   * Guest: adopt the host's timeline. Everything since the split is replaced by the host's
   * log (my commands the host never received are dropped: they were made in a world that no
   * longer exists), then both continue in lockstep from the host's tick.
   */
  applyRejoin(peer, msg) {
    const inPlace = this.catchUp(msg);
    this.note('adopt', { ep: msg.ep, T: msg.T, inPlace });
    if (!inPlace) this.rebuild(msg.start, msg.cmds || [], msg.T);
    this.epoch = msg.ep;
    this.promised = this.tick - 1;
    peer.gone = false;
    peer.why = null;
    peer.ready = true;
    peer.horizon = msg.T - 1;
    peer.ack = msg.T - 1;
    peer.lastHeard = this.now();
    peer.jitter = 0;
    this.mismatches = [];
    this.resyncPending = 0;
    this.rejoins++;
    if (inPlace) {
      // nothing had diverged (typically: dropped while my battle screen was still loading):
      // the same battle simply fast-forwarded, no rebuild of the battle screen needed
      this.beat(true);
    } else {
      this.running = false; // "live" again once the rebuilt battle screen runs (see rejoin())
      this.beat(true);
      this.hooks.onResync?.(this.coop);
    }
    this.hooks.onPeerBack?.(peer.slot);
  }

  /**
   * Rejoin without a rebuild when my battle never left the host's timeline: every command (and
   * marker) I executed is exactly what the host's log has before my tick, and the host is not
   * behind me. Then I only drop my not-yet-executed orders the host never got, take its log and
   * fast-forward this same CoopSim to its tick. @returns {boolean} done
   */
  catchUp(msg) {
    const G = this.tick;
    const host = (msg.cmds || []).filter((x) => isValidCmd(x, { markers: true }));
    if (!Number.isInteger(msg.T) || msg.T < G) return false;
    const key = (c) => `${c.t}|${c.p}|${c.k}|${c.s}|${JSON.stringify(c.a)}`;
    const mine = this.log.filter((c) => c.t < G).map(key).sort();
    const theirs = host.filter((c) => c.t < G).map(key).sort();
    if (mine.length !== theirs.length || mine.some((k, i) => k !== theirs[i])) return false;
    const hostKeys = new Set(host.map((c) => `${c.p}:${c.s}`));
    // my queued orders (and markers) for ticks >= G that the host never received: void
    for (const c of this.log.filter((x) => x.t >= G && !hostKeys.has(`${x.p}:${x.s}`))) {
      this.known.delete(`${c.p}:${c.s}`);
      const list = (this.pending.get(c.t) || []).filter((x) => x !== c);
      if (list.length) this.pending.set(c.t, list);
      else this.pending.delete(c.t);
    }
    this.log = this.log.filter((x) => x.t < G || hostKeys.has(`${x.p}:${x.s}`));
    for (const c of host.sort(compareCmds)) if (c.t >= G) this.accept(c);
    while (this.tick < msg.T) this.runTick({ silent: true });
    return true;
  }

  dropPeer(peer, reason) {
    if (peer.gone) return;
    peer.gone = true;
    peer.why = reason;
    peer.goneAt = this.now();
    this.note('drop', { slot: peer.slot, reason, silent: Math.round(this.now() - peer.lastHeard), ready: peer.ready });
    // an unanswered rejoin offer: wait a while before offering again (one-way links)
    if (peer.offer) {
      peer.failedOffers++;
      peer.rejoinAfter = this.now() + Math.min(REJOIN_COOLDOWN_MAX_MS, REJOIN_COOLDOWN_MS * 2 ** (peer.failedOffers - 1));
    } else peer.rejoinAfter = 0;
    peer.offer = null;
    // from the next tick on its income goes to the others (a marker, so a replay agrees)
    this.mark('gone', peer.slot);
    // tell the ally (if it can still hear us) so both sides continue solo instead of one of
    // them waiting on commands that will never be applied
    if (reason === 'timeout') this.send({ type: 'bye', why: 'timeout' });
    this.hooks.onPeerGone?.(peer.slot, reason);
  }

  canRun(T) {
    if (this.resyncPending) return false;
    for (const p of this.peers.values()) {
      if (!p.gone) {
        if (T > p.horizon) return false;
      } else if (!this.isHost && p.why === 'lost' && this.now() - p.goneAt < REJOIN_WAIT_MS) return false;
    }
    return true;
  }

  runTick({ silent = false } = {}) {
    const T = this.tick;
    const cmds = (this.pending.get(T) || []).sort(compareCmds);
    this.pending.delete(T);
    for (const c of cmds) {
      const res = this.coop.apply(c);
      if (!silent) this.hooks.onApplied?.(c, res);
    }
    this.coop.step();
    const t = this.tick;
    if (t % COOP.hashEvery === 0) {
      const h = this.coop.hash();
      this.hashes.set(t, h);
      if (this.hashes.size > 64) this.hashes.delete(this.hashes.keys().next().value);
      if (!silent) {
        this.send({ type: 'hash', t, h });
        this.compare(t);
      }
    }
  }

  /** Battle over (won/lost): ticks stop, the result is final. */
  get finished() {
    const s = this.sim.state;
    return s === 'won' || s === 'lost';
  }

  /**
   * Runs as many ticks as real time (× game speed) allows and the peers' horizons permit.
   * @param {number} dt seconds of real time since the last call
   * @returns {number} ticks executed
   */
  advance(dt) {
    if (!this.running) this.note('live');
    this.running = true;
    const t = this.wake();
    for (const p of this.livePeers()) {
      if (p.offer && t - p.offerSince > OFFER_TIMEOUT_MS) this.dropPeer(p, 'lost'); // the guest never took the offer
      else if (t - p.lastHeard > this.timeoutFor(p)) this.dropPeer(p, 'timeout');
    }
    if (this.resyncPending && t - this.resyncPending > COOP.timeoutMs) {
      this.resyncPending = 0;
      this.flagMismatch(); // counts as the second strike
    }
    this.beat();
    if (this.finished) return 0;
    this.acc = Math.min(this.acc + Math.max(0, dt) * 60 * this.coop.speed, MAX_CATCHUP + 3 * this.coop.speed);
    let ran = 0;
    this.stalled = false;
    while (this.acc >= 1) {
      if (!this.canRun(this.tick)) {
        this.stalled = true;
        this.stallTicks++;
        if (this.stallTicks % 30 === 0 && this.delay < COOP.maxInputDelay) this.delay = Math.min(COOP.maxInputDelay, this.delay + 2);
        break;
      }
      this.runTick();
      this.acc -= 1;
      ran++;
      if (this.finished) break;
    }
    if (ran) this.beat();
    return ran;
  }

  /** Last common hashes (for the e2e test / debug HUD). */
  hashPairs() {
    const out = [];
    for (const [t, h] of this.hashes) if (this.peerHashes.has(t)) out.push({ t, mine: h, theirs: this.peerHashes.get(t) });
    return out;
  }

  leave() {
    this.send({ type: 'bye' });
  }
}
