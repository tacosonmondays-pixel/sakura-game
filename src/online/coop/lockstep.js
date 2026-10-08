// Lockstep netcode for 2-player co-op on the deterministic Sim (seeded, fixed 1/60 steps).
// Both clients run the same CoopSim; only player commands travel, each stamped with a tick a
// few frames in the future (input delay) and executed on every client at exactly that tick.
//
// Messages (any transport that delivers JSON objects; order and loss are tolerated):
//   { type: 'in', from, horizon, ack, cmds }  every heartbeat and right after a command:
//        "I will send no more commands with t <= horizon; I executed every tick < ack + 1".
//        cmds = my commands the peer has not executed yet (re-sent until acked → lossy links ok)
//   { type: 'hash', from, t, h }               state hash after tick t (every COOP.hashEvery)
//   { type: 'resync?', from }                  guest saw a hash mismatch: please send state
//   { type: 'resync', from, start, T, cmds }   host: rebuild from start, replay cmds up to T
//   { type: 'bye', from }                      leaving
// A client only runs tick T once every connected peer's horizon >= T; otherwise it stalls
// ("Waiting for ally…") and raises its own input delay a little. A peer silent for
// COOP.timeoutMs is dropped: its towers stay, its income goes to the survivor.
import { COOP } from '../../data/coop.js';
import { createCoopSim, compareCmds, isValidCmd } from './commands.js';

const MAX_CATCHUP = 12; // ticks per advance() call beyond the frame's own share
const FATAL_WINDOW_MS = 30000;

export class Lockstep {
  /**
   * @param {{ start: object, mySlot: number, send: (msg: object) => void, now?: () => number,
   *   delay?: number, hooks?: { onApplied?: Function, onResync?: Function, onDesync?: Function, onPeerGone?: Function } }} opts
   */
  constructor({ start, mySlot, send, now = () => Date.now(), delay = COOP.inputDelay, hooks = {} }) {
    this.start = start;
    this.mySlot = mySlot;
    this.sendRaw = send;
    this.now = now;
    this.delay = delay;
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
    this.peers = new Map();
    for (const p of start.players) {
      if (p.slot !== mySlot) this.peers.set(p.slot, { slot: p.slot, horizon: -1, ack: -1, lastHeard: now(), gone: false });
    }
  }

  get sim() {
    return this.coop.sim;
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

  send(msg) {
    try {
      this.sendRaw({ ...msg, from: this.mySlot });
    } catch (e) {
      // a dead transport is the same as a lossy one: heartbeats retry
      console.warn('[lockstep] send failed', e);
    }
  }

  /** Heartbeat: horizon + my not-yet-acknowledged commands. */
  beat(force = false) {
    const t = this.now();
    if (!force && t - this.lastBeat < COOP.heartbeatMs) return;
    this.lastBeat = t;
    const minAck = Math.min(...this.livePeers().map((p) => p.ack), Infinity);
    const floor = Number.isFinite(minAck) ? minAck : this.tick - 1;
    const cmds = this.log.filter((c) => c.p === this.mySlot && c.t > floor);
    this.send({ type: 'in', horizon: this.horizon(), ack: this.tick - 1, cmds });
  }

  /** Handles one message from a peer. */
  receive(msg) {
    if (!msg || msg.from === this.mySlot) return;
    const peer = this.peers.get(msg.from);
    if (!peer) return;
    if (peer.gone && msg.type !== 'bye') return;
    peer.lastHeard = this.now();
    switch (msg.type) {
      case 'in':
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
        if (Number.isInteger(msg.horizon)) peer.horizon = Math.max(peer.horizon, msg.horizon);
        if (Number.isInteger(msg.ack)) peer.ack = Math.max(peer.ack, msg.ack);
        break;
      case 'hash':
        this.peerHashes.set(msg.t, msg.h);
        this.compare(msg.t);
        break;
      case 'resync?':
        if (this.isHost) this.send({ type: 'resync', start: this.start, T: this.tick, cmds: this.log });
        break;
      case 'resync':
        if (!this.isHost && this.resyncPending) this.applyResync(msg);
        break;
      case 'bye':
        this.dropPeer(peer, 'left');
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
    const keepMine = this.log.filter((c) => c.p === this.mySlot);
    const gone = [...this.peers.values()].filter((p) => p.gone).map((p) => p.slot);
    this.coop = createCoopSim(msg.start || this.start, { mySlot: this.mySlot });
    for (const s of gone) this.coop.markGone(s);
    this.pending = new Map();
    this.known = new Set();
    this.log = [];
    for (const c of [...(msg.cmds || []), ...keepMine].filter(isValidCmd).sort(compareCmds)) this.accept(c);
    this.hashes = new Map();
    this.peerHashes = new Map();
    while (this.tick < msg.T) this.runTick({ silent: true });
    this.resyncPending = 0;
    this.resyncs++;
    this.hooks.onResync?.(this.coop);
  }

  dropPeer(peer, reason) {
    if (peer.gone) return;
    peer.gone = true;
    this.coop.markGone(peer.slot);
    this.hooks.onPeerGone?.(peer.slot, reason);
  }

  canRun(T) {
    if (this.resyncPending) return false;
    for (const p of this.livePeers()) if (T > p.horizon) return false;
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
    const t = this.now();
    for (const p of this.livePeers()) if (t - p.lastHeard > COOP.timeoutMs) this.dropPeer(p, 'timeout');
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
