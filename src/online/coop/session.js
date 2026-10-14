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
// does not see it yet, and afterwards keeps a slow keepalive hello (LOBBY.keepaliveMs), which
// also carries the ready flag and the stage, so a lost 'ready' or 'room' message fixes itself.
// An ally silent for LOBBY.peerSilentMs (while our own link is up) has left.
// A one-way link (I hear my ally, but its hellos never show it hears me) gets a fresh channel
// after LOBBY.oneWayMs, then a fresh socket, with a backoff; the lobby shows "Connecting to
// <name>…" and keeps Ready / Start locked until both sides see each other ("paired").
// Realtime bills every message (free plan ~66k a day for the whole project), so a lobby that
// waits long, a mismatched or hidden one beacons slowly, and a lobby nobody touches for
// LOBBY.idleCloseMs closes. No Realtime presence: see adapters/supabase.js openRoom.
import { createEmitter } from '../../core/events.js';
import { COOP, COOP_NET } from '../../data/coop.js';
import { Lockstep } from './lockstep.js';
import { coopVersion, sameVersion } from './version.js';

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
  /** hello while the two sides do not see each other yet (the first findMs of a search) */
  helloMs: 1000,
  /** the host alone in its room, early on (the guest's own beacon finds it; this is a backstop) */
  idleHelloMs: 4000,
  /** paired: a keepalive hello (ready flag + stage ride along) */
  keepaliveMs: 8000,
  /** a search older than findMs (stuck, or a host waiting long), or a version mismatch on
   *  screen: a slow beacon (every rejoin and every Retry still says hello at once) */
  slowHelloMs: 20000,
  /** a hidden tab hellos at most this often (below peerSilentMs, so a short app switch keeps
   *  the pair; becoming visible again says hello at once) */
  hiddenHelloMs: 20000,
  /** answer a hello that does not see me yet at most this often */
  answerMs: 400,
  /** a mismatched player (another build) is told so at most this often */
  mismatchAnswerMs: 5000,
  /** an ally silent this long while my own link is up has left the lobby (leaving and closing
   *  the tab say goodbye, so this only catches crashes and lost connections) */
  peerSilentMs: 25000,
  /** a mismatched player not heard from this long is gone (its banner goes, the search restarts) */
  mismatchSilentMs: 45000,
  /** guest without a host (or anyone without a link) this long: "can't find…" + Retry */
  findMs: 15000,
  /** my ally is here but its hellos have not shown it hears me for this long: my link is
   *  one-way, get a fresh channel (then a fresh socket), backing off ×2 up to oneWayMaxMs */
  oneWayMs: 7000,
  oneWayMaxMs: 60000,
  /** a lobby with no ally joining / leaving, no ready, stage or Retry this long closes */
  idleCloseMs: 30 * 60000,
  /** the host re-sends the start message until the guest's first lockstep packet arrives */
  startResendMs: 700,
});

/**
 * @param {{ code: string, isHost: boolean, backend: object, me: object, stageId?: string, difficulty?: string,
 *   timers?: { setInterval: Function, clearInterval: Function }, now?: () => number }} opts
 *   me = { uid, name, level, avatar, loadout: [{unitId, stats}], hero: {unitId, stats}|null }
 *   timers / now: injectable for tests (default: the real timers and Date.now)
 *   doc: the document whose visibility slows the beacon (tests pass a fake; none in Node)
 *   exclusive: close the previous session first (one room at a time; tests open two)
 */
export function openSession({ code, isHost, backend, me, stageId = '1-1', difficulty = 'normal', timers = globalThis, now = () => Date.now(), doc = globalThis.document, exclusive = true }) {
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
    error: null, // { code, retryMs } when the room could not be opened / joined, or closed ('idle')
    mismatch: null, // { uid, name, theirs }: the other player's version differs from mine (no pairing)
    /** host: the ally who was here and left / went silent ({ name, why }), until someone pairs */
    lastPeer: null,
    peerGone: false,
    // [social] the server registered my seat (open_room / join_room answered): a DM co-op invite
    // for this room can be sent now (send_coop_invite checks the room exists and is mine)
    seated: false,
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
  let mismatchHeard = 0; // last hello from the mismatched player
  let oneWaySince = 0; // since when my ally is here without seeing me (0: not now)
  let oneWayTries = 0; // fresh channels / sockets asked for since we last were paired
  let lastActivity = t0; // ally joined / left, either Ready, stage, Retry (an untouched lobby closes)
  const hidden = () => doc?.hidden === true;

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
    onSeated: () => {
      s.seated = true;
      emitter.emit('seated', s);
      changed();
    },
    onMessage: (msg, from) => handle(msg, from),
    onStatus,
    // the page is going away: an adapter that sees this before its socket closes (Supabase)
    // lets the goodbye ('leave' / the lockstep 'bye') still get out
    onUnload: () => s.close(),
  });
  const net = room.net || COOP_NET.local;
  // adapters without status reports (or the local one, which is up at once) count as connected
  s.link = room.status || 'connected';
  if (s.link === 'connected') connectedAt = t0;
  hello();

  /**
   * The server refused this room (open_room / join_room): the lobby explains it (the screen
   * words it from the code; adapters hand over normalized errors: { code, retryMs }).
   */
  function roomError(e) {
    const errCode = typeof e?.code === 'string' ? e.code : 'invalid';
    if (errCode === 'full') s.full = true;
    else s.error = { code: errCode, retryMs: Number(e?.retryMs) || 0 };
    s.stuck = null;
    changed();
  }

  /** Nobody touched this lobby for LOBBY.idleCloseMs: say goodbye, free the seat, explain. */
  function closeIdle() {
    timers.clearInterval(beacon);
    s.error = { code: 'idle', retryMs: 0, minutes: Math.round(LOBBY.idleCloseMs / 60000) };
    s.stuck = null;
    try {
      send({ type: 'leave', uid: s.me.uid });
      room.close();
    } catch (e) {
      console.warn('[coop] idle close failed', e);
    }
    changed();
  }

  function clearMismatch() {
    s.mismatch = null;
    searchSince = now(); // the search (and its "can't find" clock) starts over
    lastHelloAt = -Infinity;
  }

  /** The ally left ('leave' message) or went silent in the lobby ('silent': it may come back). */
  function peerLeft(why = 'left') {
    if (s.phase === 'lobby') {
      if (s.peer) s.lastPeer = { name: s.peer.name || 'Your ally', why };
      s.peer = null;
      peerSeesMe = false;
      oneWaySince = 0;
      searchSince = now();
      lastActivity = now();
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
      if (!s.mismatch || s.mismatch.uid !== p.uid) lastActivity = t;
      s.mismatch = { uid: p.uid, name: p.name || 'Your ally', theirs: msg.v || null, mine: version };
      mismatchHeard = t;
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
    if (s.mismatch && (!s.mismatch.uid || s.mismatch.uid === p.uid)) clearMismatch();
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
    if (!isNew && s.peer.ready !== !!p.ready) lastActivity = t; // my ally toggled Ready
    s.peer = { uid: p.uid, name: p.name, level: p.level, avatar: p.avatar, loadout: p.loadout || [], hero: p.hero || null, ready: !!p.ready, host: !!p.host };
    peerHeard = t;
    peerSeesMe = msg.sees === s.me.uid;
    if (peerSeesMe) {
      oneWaySince = 0;
      oneWayTries = 0;
      s.lastPeer = null;
    }
    if (!isHost && msg.room?.stageId) {
      s.stageId = msg.room.stageId;
      s.difficulty = msg.room.difficulty || s.difficulty;
    }
    if (isNew) {
      s.stuck = null;
      searchSince = t; // a fresh handshake: hello fast until it completes
      lastActivity = t;
    }
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
        lastActivity = now();
        changed();
        break;
      case 'ready':
        if (s.peer && msg.uid === s.peer.uid) {
          if (s.peer.ready !== !!msg.ready) lastActivity = now();
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
        else if (s.mismatch && msg.uid === s.mismatch.uid && s.phase === 'lobby') {
          // the player on the other build left (or reloads into a fresh room): stop pointing at them
          clearMismatch();
          changed();
        }
        break;
      default:
        break;
    }
  }

  /**
   * How often to say hello now. Realtime bills every message, so only a fresh handshake is
   * fast; a long search, a mismatch on screen and a hidden tab beacon slowly (every (re)join,
   * Retry and return to the tab still says hello at once, and hellos that do not see me yet
   * are answered at once).
   */
  function helloEvery(t) {
    let every;
    if (s.mismatch) every = LOBBY.slowHelloMs;
    else if (s.peer && peerSeesMe) every = LOBBY.keepaliveMs;
    else if (t - searchSince >= LOBBY.findMs) every = LOBBY.slowHelloMs;
    else every = isHost && !s.peer ? LOBBY.idleHelloMs : LOBBY.helloMs;
    return hidden() ? Math.max(every, LOBBY.hiddenHelloMs) : every;
  }

  /**
   * I hear my ally, but its hellos have not shown for oneWayMs that it hears me: what I send
   * does not get out (a mute channel on a bad server node, a socket that died while the phone
   * slept…). Ask the adapter for a fresh channel, from the second try on a fresh socket too,
   * backing off so a link that stays broken does not churn.
   */
  function checkOneWay(t) {
    if (!s.peer || peerSeesMe) {
      oneWaySince = 0;
      return;
    }
    if (!oneWaySince) oneWaySince = t;
    const wait = Math.min(LOBBY.oneWayMaxMs, LOBBY.oneWayMs * 2 ** oneWayTries);
    if (t - oneWaySince < wait) return;
    oneWayTries++;
    oneWaySince = t;
    searchSince = t; // hello fast again once the fresh link is up
    try {
      Promise.resolve(room.reconnect?.({ seat: false, socket: oneWayTries >= 2, reason: 'one-way' })).catch((e) => console.warn('[coop] reconnect failed', e));
    } catch (e) {
      console.warn('[coop] reconnect failed', e);
    }
  }

  /** The lobby's clock: beacon / keepalive hellos, silent allies, "can't find the host". */
  function lobbyTick(t) {
    if (s.error || s.full) return;
    if (t - lastActivity > LOBBY.idleCloseMs) {
      closeIdle();
      return;
    }
    const up = s.link === 'connected' && room?.connected !== false;
    if (s.peer && up && t - Math.max(peerHeard, connectedAt) > LOBBY.peerSilentMs) peerLeft('silent');
    if (s.mismatch && up && t - Math.max(mismatchHeard, connectedAt) > LOBBY.mismatchSilentMs) {
      clearMismatch();
      changed();
    }
    if (!s.stuck && !s.peer && t - searchSince > LOBBY.findMs) {
      if (s.link !== 'connected') s.stuck = 'server';
      else if (!isHost && !s.mismatch) s.stuck = 'host';
      if (s.stuck) changed();
    }
    if (!up) return;
    checkOneWay(t);
    if (t - lastHelloAt >= helloEvery(t)) hello();
  }

  // back on the tab: say hello at once (a hidden tab beacons slowly, an iPhone not at all)
  const onVisibility = () => {
    if (s.phase === 'lobby' && !hidden() && !s.error && !s.full) hello();
  };
  doc?.addEventListener?.('visibilitychange', onVisibility);

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
      lastActivity = now();
      send({ type: 'room', stageId: stage, difficulty: diff }, { latest: 'room' });
      changed();
    },
    setReady(ready) {
      s.me.ready = !!ready;
      lastActivity = now();
      send({ type: 'ready', uid: s.me.uid, ready: s.me.ready }, { latest: 'ready' });
      changed();
    },
    /** Lobby "Retry": the seat again, on a fresh socket and channel; the search clock restarts. */
    retry() {
      if (s.phase !== 'lobby' || s.error) return;
      s.stuck = null;
      searchSince = now();
      lastActivity = now();
      oneWayTries = 0;
      oneWaySince = 0;
      Promise.resolve(room.reconnect?.({ seat: true, socket: true, reason: 'retry' })).catch((e) => console.warn('[coop] retry failed', e));
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

  // closing or reloading the tab says goodbye right away (the ally does not wait for a timeout);
  // the Supabase adapter calls onUnload even earlier, before realtime-js closes its socket
  const onPageHide = () => s.close();
  globalThis.addEventListener?.('pagehide', onPageHide);
  const close0 = s.close;
  s.close = () => {
    globalThis.removeEventListener?.('pagehide', onPageHide);
    doc?.removeEventListener?.('visibilitychange', onVisibility);
    close0();
  };

  // live getters (Object.assign above would freeze a getter into its first value); the room
  // itself stays out of enumeration (tests and the e2e reach it as session.room)
  Object.defineProperty(s, 'canStart', {
    // only once both sides see each other: a guest the host hears but who cannot hear the
    // host would never get the start message
    get: () => isHost && s.phase === 'lobby' && !!s.peer && peerSeesMe && s.peer.ready,
    enumerable: true,
  });
  Object.defineProperty(s, 'room', { get: () => room, enumerable: false });
  /** Both sides see each other (the ally's last hello named me). */
  Object.defineProperty(s, 'paired', { get: () => !!s.peer && peerSeesMe, enumerable: true });

  current = s;
  if (typeof window !== 'undefined') window.__coop = s;
  return s;
}
