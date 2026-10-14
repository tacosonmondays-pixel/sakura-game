// Lockstep netcode for 2-player co-op on the deterministic Sim (seeded, fixed 1/60 steps).
// Both clients run the same CoopSim; only player commands travel, each stamped with a tick a
// few frames in the future (input delay) and executed on every client at exactly that tick.
//
// Messages (any transport that delivers JSON objects; order and loss are tolerated):
//   { type: 'in', from, horizon, ack, cmds, live, hs }  right after a command, and otherwise
//        only as often as the peer needs it (see beat()):
//        "I will send no more commands with t <= horizon; I executed every tick < ack + 1".
//        cmds = my commands the peer has not executed yet (re-sent until acked → lossy links ok)
//        live = my battle is running (before that the peer allows COOP.loadTimeoutMs of silence)
//        hs   = my last state hashes [[t, h], …] (one every COOP.hashEvery ticks; the last two
//               ride along on every beat, so a lost packet costs nothing)
//   { type: 'resync?', from }                  guest saw a hash mismatch: please send state
//   { type: 'resync', from, start, T, w, cmds, ck }  host: rebuild from start (or from the
//                                              checkpoint ck), replay cmds up to tick T (wave w)
//   { type: 'bye', from, why? }                leaving (why 'timeout': "I lost you", rejoinable;
//                                              'desync': "our battles disagree", final)
//   { type: 'rejoin', from, ep, start, T, w, cmds, ck }  host → a dropped guest that is alive
//                                              again: adopt my timeline (rebuild, replay to T)
//   { type: 'busy', from, at, of, w }          I am rebuilding (at of `of` ticks replayed, wave w):
//                                              my timeout clock stops, my offer is taken
//   { type: 'part', from, id, i, n, d }        part i of n of a message too big for the transport
//                                              (d = a slice of its JSON; see maxMessageBytes)
// Every message carries `ep` (the timeline epoch, bumped by each rejoin) so packets from a
// timeline that was abandoned are ignored; 'in' also lists the slots its sender lost (`gone`).
// A client only runs tick T once every connected peer's horizon >= T; otherwise it stalls
// ("Waiting for ally…") and raises its own input delay a little (and lowers it again after
// DELAY_RELAX_MS without a stall). A peer silent for
// COOP.timeoutMs (COOP.loadTimeoutMs before its first packet: its battle screen is still
// loading) is dropped: its towers stay, its income goes to the survivor. If the dropped peer
// was only frozen or cut off (a phone switching apps, a long load, a network hiccup) and its
// packets arrive again, the host re-admits it: the guest rebuilds the battle from the host's
// command log (which records the drop and the return as 'gone' / 'join' markers, so both
// replay the same wallets) and both continue in lockstep. Leaving on purpose is final.
//
// Long runs (co-op freeplay goes on for an hour and more):
//   - Checkpoints: at every wave end the host keeps a snapshot of the whole battle (CoopSim
//     snapshot, src/sim/snapshot.js). A resync or rejoin carries the newest one, so the guest
//     restores it and replays only the commands since — one wave, not the whole run.
//   - Rebuilds never freeze the page: a resync, a rejoin and a catch-up are a background job
//     that replays a slice of ticks per advance() call (JOB_BUDGET_MS of real time) while the old
//     battle stays on screen ("Re-syncing… wave 123/150"); 'busy' beats keep the ally waiting
//     instead of timing out. rebuild() still does it in one go (tests, tools).
//   - The idle saver (Supabase rooms): see COOP_NET in src/data/coop.js.
import { COOP } from '../../data/coop.js';
import { createCoopSim, compareCmds, isValidCmd } from './commands.js';

const MAX_CATCHUP = 12; // ticks per advance() call beyond the frame's own share
const FATAL_WINDOW_MS = 30000;
/** A gap this long between our own beats means THIS client was frozen (loading, GC, tab switch). */
const FREEZE_MS = 1000;
/** Host: re-send a rejoin offer this often while the guest still talks in the old timeline
 *  (plus RESEND_PER_PART_MS for every part of a big offer still on its way). */
const REJOIN_RESEND_MS = 1500;
const RESEND_PER_PART_MS = 400;
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
/** No stall for this long (real time): the adaptive input delay steps back toward its base
 *  (half the excess per step), so one hiccup does not slow every later order for the whole
 *  battle. Safe at any time: promises (horizon) never shrink and queue() schedules after them. */
export const DELAY_RELAX_MS = 10000;
/** A rebuild replays this long per advance() call (real time) before giving the page back… */
export const JOB_BUDGET_MS = 10;
/** …but at least this many ticks, so a page starved of time still gets there. */
const JOB_MIN_TICKS = 30;
/** 'busy' beats while rebuilding. */
const BUSY_BEAT_MS = 1000;
/** A peer that said it is rebuilding gets this long without a packet until its rebuilt battle
 *  screen is live again (a phone reloading the battle screen can block its page for seconds;
 *  under software WebGL on a loaded machine, measured 15–35 s). */
export const REBUILD_TIMEOUT_MS = 60000;
/** A rejoin fast-forwards the guest's own battle in place (no battle-screen rebuild) unless
 *  restoring the host's checkpoint replays clearly less: in place when the gap is at most this
 *  many ticks or no longer than the replay from the checkpoint. */
const INPLACE_MAX_TICKS = 3600;
/** Guest: ask for the resync again while it has not arrived; give up (second strike) after the
 *  long timeout without any part of it arriving. */
const RESYNC_RETRY_MS = 4000;
/** Host: answer resync requests at most this often (each answer can be big). */
const RESYNC_ANSWER_MS = 2000;
/** Multipart messages: the most parts accepted, and how long an incomplete one is kept. */
const MAX_PARTS = 400;
const PART_TTL_MS = 30000;
/** Messages that may be big (a command log, a checkpoint): split when over maxMessageBytes. */
const BIG = new Set(['resync', 'rejoin']);

const realNow = typeof performance !== 'undefined' && typeof performance.now === 'function' ? () => performance.now() : () => Date.now();
const cmdKey = (c) => `${c.p}:${c.s}`;

export class Lockstep {
  /**
   * @param {{ start: object, mySlot: number, send: (msg: object) => void, now?: () => number,
   *   delay?: number, heartbeatMs?: number, keepaliveMs?: number, maxDelay?: number,
   *   idleAfterMs?: number, idleLeadTicks?: number, idleKeepaliveMs?: number, maxMessageBytes?: number,
   *   hooks?: { onApplied?: Function, onResync?: Function, onDesync?: Function, onPeerGone?: Function, onPeerBack?: Function } }} opts
   *   delay / heartbeatMs / keepaliveMs: the transport's profile — local tabs 6 ticks / every
   *   50 ms; Supabase 30 ticks / at most every 250 ms, and only once a second while nothing
   *   changes (Realtime bills every message). maxDelay: the adaptive delay's ceiling (3×).
   *   idle*: the idle saver (0 = off); maxMessageBytes: split bigger messages (COOP_NET).
   */
  constructor({
    start, mySlot, send, now = () => Date.now(), delay = COOP.inputDelay, heartbeatMs = COOP.heartbeatMs, keepaliveMs = heartbeatMs, maxDelay = delay * 3,
    idleAfterMs = 0, idleLeadTicks = 0, idleKeepaliveMs = 0, maxMessageBytes = Infinity, hooks = {},
  }) {
    this.start = start;
    this.mySlot = mySlot;
    this.sendRaw = send;
    this.now = now;
    this.delay = delay;
    this.baseDelay = delay;
    this.maxDelay = Math.max(delay, maxDelay);
    this.lastStallAt = -Infinity; // real time of the last stall / delay change (adaptive delay)
    this.heartbeatMs = heartbeatMs;
    this.keepaliveMs = Math.max(heartbeatMs, keepaliveMs);
    this.idleAfterMs = idleAfterMs > 0 ? idleAfterMs : 0;
    this.idleLeadTicks = Math.max(0, idleLeadTicks || 0);
    this.idleKeepaliveMs = Math.max(this.keepaliveMs, idleKeepaliveMs || 0);
    this.maxBytes = maxMessageBytes > 0 ? maxMessageBytes : Infinity;
    this.lastQueued = now(); // real time of my last order (the idle saver)
    this.sentHorizon = -1; // what my last beat said: horizon, newest hash tick, live flag
    this.sentHash = -1;
    this.sentLive = false;
    this.hashOut = []; // my last hashes [[t, h]] for the next beats
    this.sent = 0; // packets sent (the HUD / tests watch the message budget)
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
    this.lastResyncAsk = -Infinity;
    this.lastResyncAnswer = -Infinity;
    this.desynced = false;
    this.resyncs = 0;
    this.rejoins = 0;
    this.epoch = 0; // timeline id: bumped by the host each time it re-admits a dropped guest
    this.markSeq = 0;
    this.running = false; // advance() was called at least once (the battle screen is up)
    /** Host: the newest wave-end checkpoint { t, wave, snap } (resyncs and rejoins start there). */
    this.ck = null;
    this.ckOff = false; // a snapshot failed once: rebuilds replay from tick 0 instead
    this.ckMs = 0; // what the last checkpoint cost (ms)
    /** A rebuild / catch-up in progress (see startRebuild); null when the battle runs live. */
    this.job = null;
    this.lastBusy = -Infinity;
    this.deferredMarks = []; // drop / return markers that happened during a rebuild
    /** The last finished rebuild: { kind, from, T, ticks, ms, slices, maxSliceMs, restoreMs, restored }. */
    this.lastRebuild = null;
    this.parts = new Map(); // `${from}:${id}` -> { n, got, d[], at } (multipart messages)
    this.partSeq = 0;
    /** Last connection events (drop, rejoin, resync…) for the debug HUD and the e2e test. */
    this.trace = [];
    this.peers = new Map();
    for (const p of start.players) {
      if (p.slot !== mySlot) this.peers.set(p.slot, { slot: p.slot, horizon: -1, ack: -1, lastHeard: now(), gone: false, why: null, ready: false, jitter: 0, offer: null, offerAt: 0, offerSince: 0, offerParts: 1, rejoinAfter: 0, failedOffers: 0, goneAt: 0, busy: null, rebuilt: false });
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

  /** The idle saver is on: I gave no order for idleAfterMs. */
  get idle() {
    return this.idleAfterMs > 0 && this.now() - this.lastQueued >= this.idleAfterMs;
  }

  /** How far ahead of my tick my horizon reaches (ticks). */
  get lead() {
    return this.idle ? Math.max(this.delayTicks, this.idleLeadTicks * this.coop.speed) : this.delayTicks;
  }

  /**
   * While a rebuild runs: what it is and how far it got (the "Re-syncing… wave 12/150" overlay).
   * @returns {null|{ kind: string, done: number, total: number, wave: number, target: number|null }}
   */
  get rebuilding() {
    const j = this.job;
    return j ? { kind: j.kind, done: j.done, total: Math.max(1, j.T - j.from), wave: j.coop.sim.wave, target: j.w ?? null } : null;
  }

  /** How long `peer` may stay silent before it counts as gone. */
  timeoutFor(peer) {
    // not live: still loading its battle screen (or, after a rebuild, reloading it)
    if (!peer.ready) return peer.rebuilt ? REBUILD_TIMEOUT_MS : COOP.loadTimeoutMs;
    return Math.min(COOP.maxTimeoutMs, Math.max(COOP.timeoutMs, 3 * peer.jitter));
  }

  livePeers() {
    return [...this.peers.values()].filter((p) => !p.gone);
  }

  horizon() {
    this.promised = Math.max(this.promised, this.tick + this.lead - 1);
    return this.promised;
  }

  /**
   * Issues a local command. It runs on every client at the returned cmd's tick (null while a
   * rebuild runs: the battle on screen is not the one being played).
   * @param {string} k kind (see commands.js KINDS)
   * @param {any[]} a args
   */
  queue(k, a = []) {
    if (this.job) return null;
    this.lastQueued = this.now();
    const t = Math.max(this.tick + this.delayTicks, this.promised + 1);
    const cmd = { t, p: this.mySlot, s: this.seq++, k, a };
    this.accept(cmd);
    this.beat(true);
    return cmd;
  }

  accept(cmd) {
    const key = cmdKey(cmd);
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
    // during a rebuild the battle being replayed is the host's past: the marker lands when it is done
    if (this.job) this.deferredMarks.push([k, slot]);
    else this.accept({ t: this.tick, p: slot, s: MARK_BASE + ++this.markSeq, k, a: [] });
  }

  send(msg) {
    const full = { ...msg, from: this.mySlot, ep: this.epoch };
    try {
      if (Number.isFinite(this.maxBytes) && BIG.has(msg.type)) {
        const text = JSON.stringify(full);
        if (text.length > this.maxBytes) {
          const n = Math.ceil(text.length / this.maxBytes);
          const id = ++this.partSeq;
          for (let i = 0; i < n; i++) {
            this.sent++;
            this.sendRaw({ type: 'part', id, i, n, d: text.slice(i * this.maxBytes, (i + 1) * this.maxBytes), from: this.mySlot, ep: this.epoch });
          }
          return n;
        }
      }
      this.sent++;
      this.sendRaw(full);
    } catch (e) {
      // a dead transport is the same as a lossy one: heartbeats retry
      console.warn('[lockstep] send failed', e);
    }
    return 1;
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

  /**
   * Heartbeat: horizon + my not-yet-acknowledged commands + my last hashes. Sent at once after a
   * command (queue → force), otherwise at most every heartbeatMs, and then only when it says
   * something the peer needs: a horizon that moved half a lead on (the peer runs out of
   * promised ticks one lead after my last beat), commands still unacknowledged, a new hash, or
   * a ready/live change. Silence is filled by a keepalive every keepaliveMs (the drop timeout
   * is seconds). On the local transport keepaliveMs = heartbeatMs, i.e. every 50 ms as before.
   * Idle (Supabase): the horizon reaches a second ahead, a new hash waits for the next horizon
   * beat and the keepalive is every idleKeepaliveMs. While rebuilding: a 'busy' beat instead.
   */
  beat(force = false) {
    const t = this.wake();
    if (this.job) {
      this.beatBusy(t, force);
      return;
    }
    const since = t - this.lastBeat;
    if (!force && since < this.heartbeatMs) return;
    const minAck = Math.min(...this.livePeers().map((p) => p.ack), Infinity);
    const floor = Number.isFinite(minAck) ? minAck : this.tick - 1;
    const cmds = this.log.filter((c) => c.p === this.mySlot && c.t > floor);
    const idle = this.idle;
    const horizon = this.horizon();
    if (!force && since < (idle ? this.idleKeepaliveMs : this.keepaliveMs)) {
      const moved = horizon - this.sentHorizon >= Math.max(1, Math.floor(this.lead / 2));
      const fresh = !idle && this.hashOut.length && this.hashOut[this.hashOut.length - 1][0] > this.sentHash;
      const live = this.running !== this.sentLive;
      if (!moved && !cmds.length && !fresh && !live) return;
    }
    this.lastBeat = t;
    this.sentHorizon = horizon;
    this.sentHash = this.hashOut.length ? this.hashOut[this.hashOut.length - 1][0] : -1;
    this.sentLive = this.running;
    // live: my battle screen is up and ticking (until then the ally allows the long load timeout)
    const gone = [...this.peers.values()].filter((p) => p.gone).map((p) => p.slot);
    this.send({ type: 'in', horizon, ack: this.tick - 1, cmds, live: this.running, gone, hs: this.hashOut.slice(-2) });
  }

  /** While rebuilding: "still here, rebuilding (at / of ticks)" once a second (and at the start). */
  beatBusy(t, force = false) {
    if (!force && t - this.lastBusy < BUSY_BEAT_MS) return;
    this.lastBusy = t;
    const j = this.job;
    this.send({ type: 'busy', at: j.done, of: Math.max(1, j.T - j.from), w: j.coop.sim.wave });
  }

  /** Handles one message from a peer. */
  receive(msg) {
    if (!msg || msg.from === this.mySlot) return;
    const peer = this.peers.get(msg.from);
    if (!peer) return;
    const ep = Number.isInteger(msg.ep) ? msg.ep : 0;
    if (msg.type === 'part') {
      this.receivePart(msg);
      return;
    }
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
      } else if (msg.why === 'desync') {
        // its battle gave up on ours: final like leaving, but it did not leave
        if (!peer.gone) this.dropPeer(peer, 'desync');
        else if (REJOINABLE.has(peer.why)) peer.why = 'desync';
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
      if (this.isHost && peer.offer && ep < this.epoch && t - peer.offerAt > REJOIN_RESEND_MS + RESEND_PER_PART_MS * (peer.offerParts - 1)) this.sendOffer(peer);
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
        peer.busy = null;
        if (msg.live) {
          peer.ready = true;
          peer.rebuilt = false;
        }
        if (Number.isInteger(msg.horizon)) peer.horizon = Math.max(peer.horizon, msg.horizon);
        if (Number.isInteger(msg.ack)) peer.ack = Math.max(peer.ack, msg.ack);
        // while rebuilding, its commands and hashes wait: the battle they belong to is not built
        // yet (unacknowledged commands come again with its next beats; hashes ride on every beat)
        if (this.job) break;
        for (const c of Array.isArray(msg.cmds) ? msg.cmds : []) {
          if (!isValidCmd(c) || c.p !== msg.from) continue;
          if (this.known.has(cmdKey(c))) continue;
          if (c.t < this.tick) {
            // arrived after its tick already ran here: only possible after a desync
            this.accept(c);
            this.flagMismatch();
            continue;
          }
          this.accept(c);
        }
        for (const pair of Array.isArray(msg.hs) ? msg.hs.slice(-4) : []) {
          if (Array.isArray(pair) && Number.isInteger(pair[0]) && !this.peerHashes.has(pair[0])) this.peerHash(pair[0], pair[1]);
        }
        break;
      case 'busy':
        // the guest is rebuilding its battle (it took my rejoin offer / my resync)
        if (peer.offer) {
          peer.offer = null;
          peer.failedOffers = 0;
        }
        peer.busy = { at: Number(msg.at) || 0, of: Math.max(1, Number(msg.of) || 1), w: Number.isInteger(msg.w) ? msg.w : null, t };
        // its battle screen reloads once the rebuild is done: a long allowance until it is live
        peer.ready = false;
        peer.rebuilt = true;
        break;
      case 'resync?':
        if (this.isHost && t - this.lastResyncAnswer >= RESYNC_ANSWER_MS) {
          this.lastResyncAnswer = t;
          this.send({ type: 'resync', start: this.start, T: this.tick, w: this.sim.wave, cmds: this.log, ck: this.checkpointMsg() });
        }
        break;
      case 'resync':
        if (!this.isHost && this.resyncPending && !this.job) this.applyResync(msg);
        break;
      default:
        break;
    }
  }

  /** A part of a big message: kept until all its parts are in, then handled as the whole. */
  receivePart(msg) {
    const t = this.now();
    for (const [k, a] of this.parts) if (t - a.at > PART_TTL_MS) this.parts.delete(k);
    const key = `${msg.from}:${msg.id}`;
    let a = this.parts.get(key);
    if (!a) {
      if (!Number.isInteger(msg.n) || msg.n < 1 || msg.n > MAX_PARTS) return;
      a = { n: msg.n, got: 0, d: new Array(msg.n).fill(null), at: t };
      this.parts.set(key, a);
    }
    if (!Number.isInteger(msg.i) || msg.i < 0 || msg.i >= a.n || a.d[msg.i] !== null || typeof msg.d !== 'string') return;
    a.d[msg.i] = msg.d;
    a.got++;
    a.at = t;
    if (this.resyncPending) this.resyncPending = t; // the resync is on its way
    if (a.got < a.n) return;
    this.parts.delete(key);
    let whole = null;
    try {
      whole = JSON.parse(a.d.join(''));
    } catch {
      return;
    }
    if (whole && whole.type !== 'part' && whole.from === msg.from) this.receive(whole);
  }

  peerHash(t, h) {
    this.peerHashes.set(t, h);
    if (this.peerHashes.size > 64) this.peerHashes.delete(this.peerHashes.keys().next().value);
    this.compare(t);
  }

  compare(t) {
    if (!this.hashes.has(t) || !this.peerHashes.has(t)) return;
    if (this.hashes.get(t) !== this.peerHashes.get(t)) this.flagMismatch();
  }

  flagMismatch() {
    if (this.desynced || this.resyncPending || this.job) return;
    const t = this.now();
    this.mismatches = this.mismatches.filter((x) => t - x < FATAL_WINDOW_MS);
    this.mismatches.push(t);
    if (this.mismatches.length >= 2) {
      // a second desync shortly after a resync: the engines disagree (e.g. Math.sin), give up
      this.desynced = true;
      for (const p of this.peers.values()) this.dropPeer(p, 'desync');
      this.send({ type: 'bye', why: 'desync' });
      this.hooks.onDesync?.('fatal');
      return;
    }
    this.hooks.onDesync?.('resync');
    if (!this.isHost) {
      this.resyncPending = t;
      this.lastResyncAsk = t;
      this.send({ type: 'resync?' });
    }
  }

  /** Host: the newest checkpoint as it travels in a resync / rejoin (null: replay from tick 0). */
  checkpointMsg() {
    return this.ck ? { t: this.ck.t, snap: this.ck.snap } : null;
  }

  /** Host: keeps a snapshot of the battle as it is now (called at wave ends). */
  checkpoint() {
    const t0 = realNow();
    try {
      this.ck = { t: this.tick, wave: this.sim.wavesCleared, snap: this.coop.snapshot() };
      this.ckMs = realNow() - t0;
    } catch (e) {
      // a battle the snapshot cannot store: rebuilds replay from tick 0 (slow, but right)
      this.ckOff = true;
      this.ck = null;
      console.warn('[lockstep] checkpoint failed; rebuilds replay from the start', e);
    }
  }

  /** Guest: rebuild the CoopSim from the host's checkpoint and log, then catch up to the host's tick. */
  applyResync(msg) {
    this.note('resync', { T: msg.T, ck: msg.ck?.t ?? null });
    const keepMine = this.log.filter((c) => c.p === this.mySlot && c.s >= 0);
    this.resyncPending = 0;
    this.startRebuild('resync', msg.start, [...(Array.isArray(msg.cmds) ? msg.cmds : []), ...keepMine], msg.T, msg.ck, msg.w, () => {
      this.resyncs++;
      this.running = false; // "live" again once the rebuilt battle screen runs
      this.beat(true);
      this.hooks.onResync?.(this.coop);
    });
  }

  /**
   * Rebuilds the CoopSim from a start message and a command log, then fast-forwards to tick T —
   * in one go (tests, tools). From checkpoint `ck` ({ t, snap }) when given: only the commands
   * from ck.t on are replayed.
   */
  rebuild(start, cmds, T, ck = null) {
    this.startRebuild('rebuild', start, cmds, T, ck, null, null, { quiet: true });
    while (this.job) this.runJob(Infinity);
  }

  /**
   * Starts rebuilding the battle as a background job: a fresh CoopSim from `start`, restored
   * from the checkpoint `ck` when there is one (else from tick 0), with the command log `cmds`,
   * replayed up to tick T a slice per advance() call. The battle on screen stays as it is (frozen,
   * "Re-syncing…") until the new one has caught up; then it is swapped in and onDone runs.
   */
  startRebuild(kind, start, cmds, T, ck, w, onDone, { quiet = false } = {}) {
    const t0 = realNow();
    const target = Number.isInteger(T) && T >= 0 ? T : 0;
    let coop = createCoopSim(start || this.start, { mySlot: this.mySlot });
    let from = 0;
    if (ck && ck.snap && Number.isInteger(ck.t) && ck.t >= 0 && ck.t <= target) {
      try {
        coop.restore(ck.snap);
        from = ck.t;
      } catch (e) {
        console.warn('[lockstep] the checkpoint did not restore; replaying from the start', e);
        coop = createCoopSim(start || this.start, { mySlot: this.mySlot });
      }
    }
    const restoreMs = realNow() - t0; // (building the CoopSim + restoring the checkpoint: one block)
    const job = {
      kind, coop, T: target, from, w: Number.isInteger(w) ? w : null, onDone, inPlace: false,
      log: [], known: new Set(), pending: new Map(), hashes: new Map(), done: 0, t0, slices: 0, maxSlice: 0, restoreMs,
    };
    for (const c of cmds.filter((x) => isValidCmd(x, { markers: true })).sort(compareCmds)) {
      const key = cmdKey(c);
      if (job.known.has(key)) continue;
      job.known.add(key);
      job.log.push(c);
      // (commands before the checkpoint are already in its state)
      if (c.t >= from) {
        const list = job.pending.get(c.t) || [];
        list.push(c);
        job.pending.set(c.t, list);
      }
    }
    this.job = job;
    this.note('rebuild', { kind, from, T: target });
    if (!quiet) this.beatBusy(this.now(), true);
  }

  /**
   * Rejoin without a rebuild when my battle never left the host's timeline: every command (and
   * marker) I executed is exactly what the host's log has before my tick, and the host is not
   * behind me. Then I only drop my not-yet-executed orders the host never got, take its log and
   * fast-forward this same CoopSim to its tick (a background job too). @returns {boolean} started
   */
  startCatchUp(msg, onDone) {
    const G = this.tick;
    const host = (Array.isArray(msg.cmds) ? msg.cmds : []).filter((x) => isValidCmd(x, { markers: true }));
    if (!Number.isInteger(msg.T) || msg.T < G) return false;
    const key = (c) => `${c.t}|${c.p}|${c.k}|${c.s}|${JSON.stringify(c.a)}`;
    const mine = this.log.filter((c) => c.t < G).map(key).sort();
    const theirs = host.filter((c) => c.t < G).map(key).sort();
    if (mine.length !== theirs.length || mine.some((k, i) => k !== theirs[i])) return false;
    const hostKeys = new Set(host.map(cmdKey));
    // my queued orders (and markers) for ticks >= G that the host never received: void
    for (const c of this.log.filter((x) => x.t >= G && !hostKeys.has(cmdKey(x)))) {
      this.known.delete(cmdKey(c));
      const list = (this.pending.get(c.t) || []).filter((x) => x !== c);
      if (list.length) this.pending.set(c.t, list);
      else this.pending.delete(c.t);
    }
    this.log = this.log.filter((x) => x.t < G || hostKeys.has(cmdKey(x)));
    for (const c of host.sort(compareCmds)) if (c.t >= G) this.accept(c);
    this.job = {
      kind: 'catchup', coop: this.coop, T: msg.T, from: G, w: Number.isInteger(msg.w) ? msg.w : null, onDone, inPlace: true,
      log: this.log, known: this.known, pending: this.pending, hashes: this.hashes, done: 0, t0: realNow(), slices: 0, maxSlice: 0, restoreMs: 0,
    };
    this.note('rebuild', { kind: 'catchup', from: G, T: msg.T });
    this.beatBusy(this.now(), true);
    return true;
  }

  /** One slice of the rebuild: replays ticks until the time budget is spent; done → swapped in. */
  runJob(budgetMs = JOB_BUDGET_MS) {
    const job = this.job;
    if (!job) return;
    const t0 = realNow();
    let n = 0;
    while (job.coop.tick < job.T) {
      this.replayTick(job);
      n++;
      if (n >= JOB_MIN_TICKS && (n & 15) === 0 && realNow() - t0 >= budgetMs) break;
    }
    job.done += n;
    job.slices++;
    job.maxSlice = Math.max(job.maxSlice, realNow() - t0);
    if (job.coop.tick >= job.T) this.finishJob();
    else this.beatBusy(this.now());
  }

  replayTick(job) {
    const T = job.coop.tick;
    const cmds = job.pending.get(T);
    if (cmds) {
      job.pending.delete(T);
      for (const c of cmds.sort(compareCmds)) job.coop.apply(c);
    }
    job.coop.step();
    const t = job.coop.tick;
    if (t % COOP.hashEvery === 0) {
      job.hashes.set(t, job.coop.hash());
      if (job.hashes.size > 64) job.hashes.delete(job.hashes.keys().next().value);
    }
  }

  finishJob() {
    const job = this.job;
    this.job = null;
    if (!job.inPlace) {
      this.coop = job.coop;
      this.log = job.log;
      this.known = job.known;
      this.pending = job.pending;
      this.hashes = job.hashes;
      this.peerHashes = new Map();
      this.hashOut = [];
      this.sentHash = -1;
    }
    this.lastRebuild = {
      kind: job.kind, from: job.from, T: job.T, ticks: job.T - job.from, ms: Math.round(realNow() - job.t0), slices: job.slices,
      maxSliceMs: Math.round(job.maxSlice), restoreMs: Math.round(job.restoreMs), restored: job.from > 0 && !job.inPlace,
    };
    this.note('rebuilt', this.lastRebuild);
    for (const [k, slot] of this.deferredMarks.splice(0)) this.mark(k, slot);
    job.onDone?.();
  }

  /** Host: take a dropped (but alive) guest back into this timeline from the current tick. */
  rejoin(peer) {
    this.epoch++;
    this.note('rejoin', { slot: peer.slot, ck: this.ck?.t ?? null });
    peer.gone = false;
    peer.why = null;
    // the guest rebuilds its battle screen from my log: give it the loading allowance again
    // (COOP.loadTimeoutMs) until its packets say it is live
    peer.ready = false;
    peer.busy = null;
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
    peer.offerParts = this.send({ type: 'rejoin', start: this.start, T: this.tick, w: this.sim.wave, cmds: this.log, ck: this.checkpointMsg() });
  }

  /**
   * Guest: adopt the host's timeline. Everything since the split is replaced by the host's
   * log (my commands the host never received are dropped: they were made in a world that no
   * longer exists), then both continue in lockstep from the host's tick. When my battle never
   * left the host's timeline it just fast-forwards in place (no battle-screen rebuild), unless
   * restoring the host's checkpoint is clearly shorter; else it is rebuilt from that checkpoint.
   */
  applyRejoin(peer, msg) {
    const G = this.tick;
    const ck = msg.ck && Number.isInteger(msg.ck.t) && msg.ck.t <= msg.T ? msg.ck : null;
    const near = !ck || msg.T - G <= Math.max(INPLACE_MAX_TICKS, msg.T - ck.t);
    this.job = null; // (a newer offer replaces a rebuild still running)
    this.deferredMarks = [];
    this.epoch = msg.ep;
    this.mismatches = [];
    this.resyncPending = 0;
    peer.gone = false;
    peer.why = null;
    peer.ready = true;
    peer.horizon = msg.T - 1;
    peer.ack = msg.T - 1;
    peer.lastHeard = this.now();
    peer.jitter = 0;
    let inPlace = false;
    const done = () => {
      this.promised = this.tick - 1;
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
    };
    inPlace = near && this.startCatchUp(msg, done);
    this.note('adopt', { ep: msg.ep, T: msg.T, inPlace, ck: ck?.t ?? null });
    if (!inPlace) this.startRebuild('rejoin', msg.start, Array.isArray(msg.cmds) ? msg.cmds : [], msg.T, ck, msg.w, done);
  }

  dropPeer(peer, reason) {
    if (peer.gone) return;
    peer.gone = true;
    peer.why = reason;
    peer.goneAt = this.now();
    peer.busy = null;
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
    if (this.resyncPending || this.job) return false;
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
        // rides along on the next beats (no packet of its own)
        this.hashOut.push([t, h]);
        if (this.hashOut.length > 2) this.hashOut.shift();
        this.compare(t);
      }
    }
    // a wave just ended: the host keeps the battle as it is now (resyncs and rejoins start there)
    const sim = this.coop.sim;
    if (this.isHost && !this.ckOff && sim.state === 'between' && sim.wavesCleared > (this.ck?.wave ?? 0)) this.checkpoint();
  }

  /** Battle over (won/lost): ticks stop, the result is final. */
  get finished() {
    const s = this.sim.state;
    return s === 'won' || s === 'lost';
  }

  /** Drops peers that have been silent too long (or never took my rejoin offer). */
  checkPeers(t) {
    for (const p of this.livePeers()) {
      if (p.offer && t - p.offerSince > OFFER_TIMEOUT_MS) this.dropPeer(p, 'lost'); // the guest never took the offer
      else if (t - p.lastHeard > this.timeoutFor(p)) this.dropPeer(p, 'timeout');
    }
  }

  /**
   * Runs as many ticks as real time (× game speed) allows and the peers' horizons permit. While a
   * rebuild runs it replays a slice of it instead (budgetMs of real time: the frame loop's
   * default keeps the page responsive; a hidden tab can afford more).
   * @param {number} dt seconds of real time since the last call
   * @param {{ budgetMs?: number }} [opts]
   * @returns {number} ticks executed (0 while rebuilding)
   */
  advance(dt, { budgetMs = JOB_BUDGET_MS } = {}) {
    if (this.job) {
      this.checkPeers(this.wake());
      if (this.job) this.runJob(budgetMs);
      return 0;
    }
    if (!this.running) this.note('live');
    this.running = true;
    const t = this.wake();
    this.checkPeers(t);
    if (this.resyncPending) {
      if (t - this.resyncPending > COOP.loadTimeoutMs) {
        this.resyncPending = 0;
        this.flagMismatch(); // counts as the second strike
      } else if (t - this.lastResyncAsk >= RESYNC_RETRY_MS) {
        this.lastResyncAsk = t; // (lost on the way, or the host was busy: ask again)
        this.send({ type: 'resync?' });
      }
    }
    this.beat();
    if (this.finished) return 0;
    this.acc = Math.min(this.acc + Math.max(0, dt) * 60 * this.coop.speed, MAX_CATCHUP + 3 * this.coop.speed);
    let ran = 0;
    this.stalled = false;
    while (this.acc >= 1) {
      if (!this.canRun(this.tick)) {
        this.stalled = true;
        // (waiting on an ally who is rebuilding its battle is not lag: the input delay stays)
        if (this.livePeers().some((p) => p.busy)) break;
        this.stallTicks++;
        this.lastStallAt = t;
        if (this.stallTicks % 30 === 0 && this.delay < this.maxDelay) this.delay = Math.min(this.maxDelay, this.delay + Math.max(2, Math.round(this.delay / 3)));
        break;
      }
      this.runTick();
      this.acc -= 1;
      ran++;
      if (this.finished) break;
    }
    this.relaxDelay(t);
    if (ran) this.beat();
    return ran;
  }

  /** A quiet spell (no stall for DELAY_RELAX_MS): step the input delay back toward its base. */
  relaxDelay(t) {
    if (this.stalled || this.delay <= this.baseDelay || t - this.lastStallAt < DELAY_RELAX_MS) return;
    this.delay = Math.max(this.baseDelay, this.delay - Math.max(2, Math.round((this.delay - this.baseDelay) / 2)));
    this.lastStallAt = t; // the next step after another quiet spell
    this.note('delay', { delay: this.delay });
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
