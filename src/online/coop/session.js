// A co-op room: lobby handshake (who is here, which stage, ready checks), then the start
// message that both clients turn into the same Lockstep battle. One session at a time; the
// battle screen picks it up with getSession().
//
// Room messages (over backend.openRoom(code), i.e. Realtime broadcast or BroadcastChannel; the
// host registers the code and one guest takes the seat, see open_room / join_room):
//   { type: 'hello', player, v }     my name / level / avatar / loadout (sent on every new peer);
//                                    v = coopVersion(): two different builds never pair up
//   { type: 'room', stageId, difficulty }   host's stage choice
//   { type: 'ready', uid, ready }
//   { type: 'full', uid }            host → a third player: this room already has two
//   { type: 'start', start }         host → guest: seed, stage, both players' loadouts, version
//                                    (re-sent until the guest's first lockstep packet arrives)
//   { type: 'ls', m }                lockstep traffic during the battle
//   { type: 'leave', uid }
import { createEmitter } from '../../core/events.js';
import { COOP } from '../../data/coop.js';
import { Lockstep } from './lockstep.js';
import { coopVersion, sameVersion } from './version.js';
import { toOnlineError } from '../errors.js';
import { formatRetry } from '../limits.js';

let current = null;

/** The active co-op session (lobby or battle), or null. */
export function getSession() {
  return current;
}

/** Random room code without look-alike characters. */
export function makeRoomCode(rand = Math.random) {
  let s = '';
  for (let i = 0; i < COOP.codeLength; i++) s += COOP.codeAlphabet[Math.floor(rand() * COOP.codeAlphabet.length)];
  return s;
}

/**
 * The Lockstep a battle route should run: only for #/battle?coop=<CODE> while that room's
 * session is in its battle. Solo battles (no coop param, no session) always get null.
 * @param {{ coop?: string }} params route params
 * @param {object|null} session getSession()
 * @returns {import('./lockstep.js').Lockstep|null}
 */
export function battleLockstep(params, session) {
  if (!params?.coop || !session || session.code !== params.coop) return null;
  return session.lockstep || null;
}

export function normalizeCode(code) {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

const LOBBY_BEACON_MS = 1500;
const START_RESEND_MS = 700;

/**
 * @param {{ code: string, isHost: boolean, backend: object, me: object, stageId?: string, difficulty?: string,
 *   timers?: { setInterval: Function, clearInterval: Function }, now?: () => number }} opts
 *   me = { uid, name, level, avatar, loadout: [{unitId, stats}], hero: {unitId, stats}|null }
 *   timers / now: injectable for tests (default: the real timers and Date.now)
 *   exclusive: close the previous session first (one room at a time; tests open two)
 */
export function openSession({ code, isHost, backend, me, stageId = '1-1', difficulty = 'normal', timers = globalThis, now = () => Date.now(), exclusive = true }) {
  if (current && exclusive) current.close();
  const emitter = createEmitter();
  const s = {
    code,
    isHost,
    me: { ...me, ready: isHost },
    peer: null,
    full: false,
    stageId,
    difficulty,
    phase: 'lobby',
    start: null,
    lockstep: null,
    error: null, // { code, text } when the room could not be opened / joined
    mismatch: null, // the other player's version when it differs from mine (no pairing)
    peerGone: false,
    on: emitter.on,
    emit: emitter.emit,
  };
  const changed = () => emitter.emit('change', s);
  let guestHeard = false;

  const version = coopVersion();
  const hello = () => room.send({ type: 'hello', player: { ...s.me, host: isHost }, v: version });
  const room = backend.openRoom(code, {
    host: isHost,
    meta: { name: me.name, host: isHost },
    onError: (e) => roomError(e),
    onMessage: (msg) => handle(msg),
    onPresence: (list) => {
      // lobby only: in battle a presence blip (reconnecting socket) must not drop the ally;
      // there the lockstep's silence timeout (COOP.timeoutMs) and the explicit 'leave' / 'bye' decide
      if (s.phase !== 'lobby') return;
      if (s.peer && !list.some((p) => p.uid === s.peer.uid)) peerLeft();
      else if (!s.peer && list.length) hello();
    },
  });
  const net = room.net || { heartbeatMs: COOP.heartbeatMs, inputDelay: COOP.inputDelay };
  hello();

  /** The server refused this room (open_room / join_room): explain it in the lobby. */
  function roomError(e) {
    const err = toOnlineError(e);
    if (err.code === 'full') s.full = true;
    else {
      const text = {
        not_found: 'No room uses that code. Check it, or ask your ally for a new one.',
        name_taken: 'That room code is already in use. Create a new room.',
        rate_limited: `Too many rooms — try again in ${formatRetry(err.retryMs)}.`,
        offline: 'The co-op server cannot be reached right now.',
      }[err.code] || 'This room could not be opened.';
      s.error = { code: err.code, text };
    }
    changed();
  }
  const mismatchTold = new Set();
  function peerLeft() {
    if (s.phase === 'lobby') {
      s.peer = null;
      if (!isHost) s.me.ready = false;
    } else if (s.lockstep) {
      const p = [...s.lockstep.peers.values()][0];
      // leaving on purpose is final, even after a lost connection (no rejoin then)
      if (p?.gone) p.why = 'left';
      else if (p) s.lockstep.dropPeer(p, 'left');
    }
    changed();
  }

  function handle(msg) {
    if (!msg || typeof msg !== 'object') return;
    switch (msg.type) {
      case 'hello': {
        const p = msg.player || {};
        if (!p.uid || p.uid === s.me.uid) return;
        if (!sameVersion(msg.v, version)) {
          // a cached older (or newer) build: lockstep would desync every time — never pair
          s.mismatch = { name: p.name || 'Your ally', theirs: msg.v || null };
          if (!mismatchTold.has(p.uid)) {
            mismatchTold.add(p.uid);
            hello(); // so the other side sees the mismatch too
          }
          changed();
          return;
        }
        if (s.peer && s.peer.uid !== p.uid) {
          // a third player: rooms hold two
          if (isHost) room.send({ type: 'full', uid: p.uid });
          return;
        }
        if (!isHost && !p.host && !s.peer) return; // two guests never pair up
        const isNew = !s.peer;
        s.peer = { uid: p.uid, name: p.name, level: p.level, avatar: p.avatar, loadout: p.loadout || [], hero: p.hero || null, ready: !!p.ready, host: !!p.host };
        if (isNew) hello();
        if (isHost) room.send({ type: 'room', stageId: s.stageId, difficulty: s.difficulty });
        changed();
        break;
      }
      case 'full':
        if (msg.uid === s.me.uid && !s.peer) {
          s.full = true;
          changed();
        }
        break;
      case 'room':
        if (isHost) return;
        s.stageId = msg.stageId;
        s.difficulty = msg.difficulty;
        changed();
        break;
      case 'ready':
        if (s.peer && msg.uid === s.peer.uid) {
          s.peer.ready = !!msg.ready;
          changed();
        }
        break;
      case 'start':
        if (isHost || s.phase !== 'lobby' || !msg.start) return;
        if (!msg.start.players?.some((p) => p.uid === s.me.uid)) return;
        if (!sameVersion(msg.start.v, version)) return;
        begin(msg.start);
        break;
      case 'ls':
        if (isHost) guestHeard = true;
        s.lockstep?.receive(msg.m);
        break;
      case 'leave':
        if (s.peer && msg.uid === s.peer.uid) peerLeft();
        break;
      default:
        break;
    }
  }

  // lobby beacon: a lost hello (lossy broadcast) is repeated until both sides see each other;
  // the host also repeats the start message until the guest's first lockstep packet arrives
  const beacon = timers.setInterval(() => {
    if (s.phase === 'lobby' && !s.peer && !s.full && !s.error && !s.mismatch) hello();
    if (s.phase === 'battle' && isHost && !guestHeard && s.start && !s.lockstep?.peers.get(1)?.gone) room.send({ type: 'start', start: s.start });
  }, isHost ? START_RESEND_MS : LOBBY_BEACON_MS);

  let pump = 0;
  function begin(start) {
    s.start = start;
    s.phase = 'battle';
    const mySlot = start.players.find((p) => p.uid === s.me.uid)?.slot ?? (isHost ? 0 : 1);
    s.lockstep = new Lockstep({
      start,
      mySlot,
      now,
      delay: net.inputDelay,
      heartbeatMs: net.heartbeatMs,
      keepaliveMs: net.keepaliveMs ?? net.heartbeatMs,
      send: (m) => room.send({ type: 'ls', m }),
      hooks: {
        onPeerGone: (slot, reason) => {
          s.peerGone = reason || true;
          emitter.emit('peerGone', reason);
          changed();
        },
        onPeerBack: (slot) => {
          s.peerGone = false;
          emitter.emit('peerBack', slot);
          changed();
        },
        onDesync: (kind) => emitter.emit('desync', kind),
        onResync: () => emitter.emit('resync'),
        onApplied: (cmd, res) => emitter.emit('applied', { cmd, res }),
      },
    });
    // Heartbeats keep flowing while the battle screen loads. A hidden tab gets no animation
    // frames, so this timer also advances the battle there (browsers slow it to ~1/s, which
    // the ally sees as short "Waiting for ally…" pauses instead of a disconnect).
    let last = typeof performance !== 'undefined' ? performance.now() : Date.now();
    pump = timers.setInterval(() => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const dt = (now - last) / 1000;
      last = now;
      if (!s.lockstep) return;
      if (typeof document !== 'undefined' && document.hidden) s.lockstep.advance(Math.min(dt, 1));
      else s.lockstep.beat();
    }, net.heartbeatMs);
    emitter.emit('start', s);
    changed();
  }

  Object.assign(s, {
    net,
    setStage(stage, diff) {
      if (!isHost || s.phase !== 'lobby') return;
      s.stageId = stage;
      s.difficulty = diff;
      room.send({ type: 'room', stageId: stage, difficulty: diff });
      changed();
    },
    setReady(ready) {
      s.me.ready = !!ready;
      room.send({ type: 'ready', uid: s.me.uid, ready: s.me.ready });
      changed();
    },
    /** Host: send the start message and begin. */
    startBattle(seed = (Math.random() * 2 ** 31) >>> 0) {
      if (!s.canStart) return false;
      const start = {
        v: version,
        seed,
        stageId: s.stageId,
        difficulty: s.difficulty,
        players: [
          { slot: 0, uid: s.me.uid, name: s.me.name, loadout: s.me.loadout, hero: s.me.hero || null, color: COOP.colors[0] },
          { slot: 1, uid: s.peer.uid, name: s.peer.name, loadout: s.peer.loadout, hero: null, color: COOP.colors[1] },
        ],
      };
      room.send({ type: 'start', start });
      begin(start);
      return true;
    },
    /** Player info by slot (names / colours for the HUD). */
    player(slot) {
      return s.start?.players.find((p) => p.slot === slot) || null;
    },
    close() {
      if (s.phase === 'closed') return;
      timers.clearInterval(pump);
      timers.clearInterval(beacon);
      try {
        s.lockstep?.leave();
        room.send({ type: 'leave', uid: s.me.uid });
        room.close();
      } catch (e) {
        console.warn('[coop] close failed', e);
      }
      s.phase = 'closed';
      changed();
      if (current === s) current = null;
      if (typeof window !== 'undefined' && window.__coop === s) delete window.__coop;
    },
  });

  // closing or reloading the tab says goodbye right away (the ally does not wait for a timeout)
  const onPageHide = () => s.close();
  globalThis.addEventListener?.('pagehide', onPageHide);
  const close0 = s.close;
  s.close = () => {
    globalThis.removeEventListener?.('pagehide', onPageHide);
    close0();
  };

  // a live getter (Object.assign above would freeze a getter into its first value)
  Object.defineProperty(s, 'canStart', {
    get: () => isHost && s.phase === 'lobby' && !!s.peer && s.peer.ready,
    enumerable: true,
  });

  current = s;
  if (typeof window !== 'undefined') window.__coop = s;
  return s;
}
