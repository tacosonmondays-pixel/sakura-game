// A co-op room: lobby handshake (who is here, which stage, ready checks), then the start
// message that both clients turn into the same Lockstep battle. One session at a time; the
// battle screen picks it up with getSession().
//
// Room messages (over backend.openRoom(code), i.e. Realtime broadcast or BroadcastChannel; the
// host registers the code and one guest takes the seat, see open_room / join_room):
//   { type: 'hello', player, v, sees, room? }
//                                    my name / level / avatar / loadout / ready; v = coopVersion()
//                                    (two different builds never pair up); sees = the uid of the
//                                    player I see (or null); the host adds room = its stage choice
//   { type: 'room', stageId, difficulty }   host's stage choice (at once; hellos repeat it)
//   { type: 'ready', uid, ready }    (at once; hellos repeat it)
//   { type: 'full', uid }            host → a third player: this room already has two
//   { type: 'start', start }         host → guest: seed, stage, both players' loadouts, version
//                                    (re-sent until the guest's first lockstep packet arrives)
//   { type: 'ls', m }                lockstep traffic during the battle
//   { type: 'leave', uid }
//
// The lobby handshake heals itself. Broadcast is lossy (a message sent while the other side is
// not subscribed yet, or while a channel reconnects, is simply gone), so nothing is said only
// once: hellos are state, not events. Each side says hello right after every (re)join, repeats
// it every second until the other side's hello shows it sees us ("sees"), answers any hello that
// does not see it yet, and afterwards keeps a slow hello every 3 s, which also carries the ready
// flag and the stage, so a lost 'ready' or 'room' message fixes itself. An ally silent for 10 s
// (while our own link is up) has left. No Realtime presence: see adapters/supabase.js openRoom.
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

/** Lobby timing (ms). Exported for the tests. */
export const LOBBY = Object.freeze({
  /** how often the session checks its clocks */
  tickMs: 250,
  /** hello while the two sides do not see each other yet */
  helloMs: 1000,
  /** the host alone in its room (the guest's own beacon finds it; this is a backstop) */
  idleHelloMs: 2000,
  /** paired: a keepalive hello (ready flag + stage ride along) */
  keepaliveMs: 3000,
  /** answer a hello that does not see me yet at most this often */
  answerMs: 400,
  /** a mismatched player (another build) is told so at most this often */
  mismatchAnswerMs: 5000,
  /** an ally silent this long while my own link is up has left the lobby */
  peerSilentMs: 10000,
  /** guest without a host (or anyone without a link) this long: "can't find…" + Retry */
  findMs: 15000,
  /** the host re-sends the start message until the guest's first lockstep packet arrives */
  startResendMs: 700,
});

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
    mismatch: null, // { uid, name, theirs }: the other player's version differs from mine (no pairing)
    peerGone: false,
    /** my link to the room: 'connecting' (never joined yet) | 'connected' | 'reconnecting' */
    link: 'connecting',
    /** null, or why the lobby is stuck after LOBBY.findMs: 'server' (no link) | 'host' (guest: no host) */
    stuck: null,
    on: emitter.on,
    emit: emitter.emit,
  };
  const changed = () => emitter.emit('change', s);
  let guestHeard = false;
  let room = null;

  const version = coopVersion();
  const t0 = now();
  let searchSince = t0; // since when the guest has been looking for its host (or anyone for a link)
  let connectedAt = 0; // when my link last came up
  let lastHelloAt = -Infinity;
  let lastAnswerAt = -Infinity;
  let lastStartAt = -Infinity;
  let lastFullAt = -Infinity;
  let peerHeard = 0; // last message from the paired ally
  let peerSeesMe = false; // the ally's last hello said it sees me
  const mismatchTold = new Map(); // uid → when I last answered its mismatched hello

  const send = (msg, opts) => room?.send(msg, opts);
  function hello() {
    if (!room || s.phase !== 'lobby') return;
    lastHelloAt = now();
    const msg = { type: 'hello', player: { ...s.me, host: isHost }, v: version, sees: s.peer?.uid ?? null };
    if (isHost) msg.room = { stageId: s.stageId, difficulty: s.difficulty };
    // a hello is state: one sent while the link is down is pointless (every rejoin says hello)
    send(msg, { drop: true });
  }

  function onStatus(state) {
    if (s.phase === 'closed') return;
    s.link = state;
    if (state === 'connected') {
      connectedAt = now();
      if (s.stuck === 'server') {
        // the link took a while: the host gets the full search time from now on
        s.stuck = null;
        searchSince = now();
      }
      hello(); // after every (re)join: whatever we said while the channel was down is lost
    }
    changed();
  }

  room = backend.openRoom(code, {
    host: isHost,
    meta: { name: me.name, host: isHost },
    onError: (e) => roomError(e),
    onMessage: (msg, from) => handle(msg, from),
    onStatus,
  });
  const net = room.net || { heartbeatMs: COOP.heartbeatMs, inputDelay: COOP.inputDelay };
  // adapters without status reports (or the local one, which is up at once) count as connected
  s.link = room.status || 'connected';
  if (s.link === 'connected') connectedAt = t0;
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
    s.stuck = null;
    changed();
  }

  /** The ally left ('leave' message) or went silent in the lobby ('silent': it may come back). */
  function peerLeft(why = 'left') {
    if (s.phase === 'lobby') {
      s.peer = null;
      peerSeesMe = false;
      searchSince = now();
      if (!isHost && why === 'left') s.me.ready = false;
    } else if (s.lockstep) {
      const p = [...s.lockstep.peers.values()][0];
      // leaving on purpose is final, even after a lost connection (no rejoin then)
      if (p?.gone) p.why = 'left';
      else if (p) s.lockstep.dropPeer(p, 'left');
    }
    changed();
  }

  function onHello(msg) {
    const p = msg.player || {};
    if (!p.uid || p.uid === s.me.uid) return;
    const t = now();
    if (!sameVersion(msg.v, version)) {
      // a cached older (or newer) build: lockstep would desync every time — never pair
      s.mismatch = { uid: p.uid, name: p.name || 'Your ally', theirs: msg.v || null };
      if (s.peer?.uid === p.uid) {
        s.peer = null;
        peerSeesMe = false;
      }
      if (t - (mismatchTold.get(p.uid) ?? -Infinity) >= LOBBY.mismatchAnswerMs) {
        mismatchTold.set(p.uid, t);
        hello(); // so the other side sees the mismatch too
      }
      changed();
      return;
    }
    // the same player again, now on my version (they reloaded): the mismatch is over
    if (s.mismatch && (!s.mismatch.uid || s.mismatch.uid === p.uid)) s.mismatch = null;
    if (s.peer && s.peer.uid !== p.uid) {
      // a third player: rooms hold two
      if (isHost && t - lastFullAt >= 2000) {
        lastFullAt = t;
        send({ type: 'full', uid: p.uid });
      }
      return;
    }
    if (isHost ? p.host : !p.host) return; // a host pairs with a guest, a guest with the host
    const isNew = !s.peer;
    s.peer = { uid: p.uid, name: p.name, level: p.level, avatar: p.avatar, loadout: p.loadout || [], hero: p.hero || null, ready: !!p.ready, host: !!p.host };
    peerHeard = t;
    peerSeesMe = msg.sees === s.me.uid;
    if (!isHost && msg.room?.stageId) {
      s.stageId = msg.room.stageId;
      s.difficulty = msg.room.difficulty || s.difficulty;
    }
    if (isNew) s.stuck = null;
    // tell them I see them: at once for a new ally, and to any hello that does not see me yet
    if (isNew || (!peerSeesMe && t - lastAnswerAt >= LOBBY.answerMs)) {
      lastAnswerAt = t;
      hello();
    }
    changed();
  }

  function handle(msg, from) {
    if (!msg || typeof msg !== 'object') return;
    if (s.peer && from && from === s.peer.uid) peerHeard = now();
    switch (msg.type) {
      case 'hello':
        if (s.phase === 'lobby') onHello(msg);
        break;
      case 'full':
        if (msg.uid === s.me.uid && !s.peer) {
          s.full = true;
          s.stuck = null;
          changed();
        }
        break;
      case 'room':
        if (isHost || s.phase !== 'lobby') return;
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

  /** The lobby's clock: beacon / keepalive hellos, silent allies, "can't find the host". */
  function lobbyTick(t) {
    if (s.error || s.full) return;
    const up = s.link === 'connected' && room?.connected !== false;
    if (s.peer && up && t - Math.max(peerHeard, connectedAt) > LOBBY.peerSilentMs) peerLeft('silent');
    if (!s.stuck && !s.peer && t - searchSince > LOBBY.findMs) {
      if (s.link !== 'connected') s.stuck = 'server';
      else if (!isHost && !s.mismatch) s.stuck = 'host';
      if (s.stuck) changed();
    }
    if (!up) return;
    let every = LOBBY.helloMs;
    if (s.mismatch) every = LOBBY.keepaliveMs;
    else if (s.peer && peerSeesMe) every = LOBBY.keepaliveMs;
    else if (isHost && !s.peer) every = LOBBY.idleHelloMs;
    if (t - lastHelloAt >= every) hello();
  }

  const beacon = timers.setInterval(() => {
    const t = now();
    if (s.phase === 'lobby') lobbyTick(t);
    else if (s.phase === 'battle' && isHost && !guestHeard && s.start && !s.lockstep?.peers.get(1)?.gone && t - lastStartAt >= LOBBY.startResendMs) {
      lastStartAt = t;
      send({ type: 'start', start: s.start }, { latest: 'start' });
    }
  }, LOBBY.tickMs);

  let pump = 0;
  function begin(start) {
    s.start = start;
    s.phase = 'battle';
    s.stuck = null;
    const mySlot = start.players.find((p) => p.uid === s.me.uid)?.slot ?? (isHost ? 0 : 1);
    s.lockstep = new Lockstep({
      start,
      mySlot,
      now,
      delay: net.inputDelay,
      heartbeatMs: net.heartbeatMs,
      keepaliveMs: net.keepaliveMs ?? net.heartbeatMs,
      // while the channel is down only the newest heartbeat is worth keeping (each one carries
      // the horizon, every unacknowledged command and the last hashes)
      send: (m) => send({ type: 'ls', m }, m?.type === 'in' ? { latest: 'ls-in' } : undefined),
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
      const t = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const dt = (t - last) / 1000;
      last = t;
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
      send({ type: 'room', stageId: stage, difficulty: diff }, { latest: 'room' });
      changed();
    },
    setReady(ready) {
      s.me.ready = !!ready;
      send({ type: 'ready', uid: s.me.uid, ready: s.me.ready }, { latest: 'ready' });
      changed();
    },
    /** Lobby "Retry": a fresh channel (and seat), and the search clock starts again. */
    retry() {
      if (s.phase !== 'lobby' || s.error) return;
      s.stuck = null;
      searchSince = now();
      room.reconnect?.();
      hello();
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
      lastStartAt = now();
      send({ type: 'start', start }, { latest: 'start' });
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
        send({ type: 'leave', uid: s.me.uid });
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

  // live getters (Object.assign above would freeze a getter into its first value); the room
  // itself stays out of enumeration (tests and the e2e reach it as session.room)
  Object.defineProperty(s, 'canStart', {
    get: () => isHost && s.phase === 'lobby' && !!s.peer && s.peer.ready,
    enumerable: true,
  });
  Object.defineProperty(s, 'room', { get: () => room, enumerable: false });
  /** Both sides see each other (the ally's last hello named me). */
  Object.defineProperty(s, 'paired', { get: () => !!s.peer && peerSeesMe, enumerable: true });

  current = s;
  if (typeof window !== 'undefined') window.__coop = s;
  return s;
}
