// A co-op room: lobby handshake (who is here, which stage, ready checks), then the start
// message that both clients turn into the same Lockstep battle. One session at a time; the
// battle screen picks it up with getSession().
//
// Room messages (over backend.openRoom(code), i.e. Realtime broadcast or BroadcastChannel; the
// host registers the code and one guest takes the seat, see open_room / join_room):
//   { type: 'hello', player, v, sees, room?, freeplay? }
//                                    my name / level / avatar / loadout / ready; v = coopVersion()
//                                    (two different builds never pair up); sees = the uid of the
//                                    player I see (or null); the host adds room = its stage choice
//                                    { stageId, difficulty, freeplay }, the guest adds freeplay =
//                                    the freeplay setting it sees (what its Ready agrees to)
//   { type: 'room', stageId, difficulty, freeplay }   host's choice (at once; hellos repeat it)
//   { type: 'ready', uid, ready, freeplay }   (at once; hellos repeat it)
//   { type: 'full', uid }            host → a third player: this room already has two
//   { type: 'start', start }         host → guest: seed, stage, difficulty, freeplay, both
//                                    players' loadouts, version (re-sent until the guest's first
//                                    lockstep packet arrives)
//   { type: 'ls', m }                lockstep traffic during the battle
//   { type: 'lobby', uid }           "I am back in the room's lobby" (the room, its code and the
//                                    seats stay: see backToLobby), mostly after the battle ended;
//                                    in freeplay also while the ally plays on
//   { type: 'fighting', uid, wave, goal, over }   my battle runs on while my ally is back in the
//                                    room (a freeplay run): how far I am, every
//                                    LOBBY.fightingMs; over = it just ended (results screen)
//   { type: 'leave', uid }           I left the room (Leave, Home, closing the tab)
//
// Freeplay (co-op past the stage's last wave, src/data/freeplay.js) is a room setting next to the
// difficulty: off (null) or a tier id. The host picks it (setStage), it rides in room, hello and
// start, and both clients build their battle from start, so they always agree. The guest's Ready
// is its consent: a changed setting clears the guest's Ready, and the host can only start once
// the guest's Ready was given for the setting the host has now (a stale "ready" never counts).
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
import { freeplayTier } from '../../data/freeplay.js';
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
  /** the battle is over on my screen and my ally has caught up (or is back in the room): a
   *  lockstep beat only this often, which just tells a lobby waiting for me that I am still here */
  restBeatMs: 8000,
  /** my battle runs on while my ally is back in the room (freeplay): a 'fighting' beacon this
   *  often instead of lockstep beats (nobody runs that battle with me any more) */
  fightingMs: 10000,
});

/**
 * @param {{ code: string, isHost: boolean, backend: object, me: object, stageId?: string, difficulty?: string,
 *   freeplay?: string|null, timers?: { setInterval: Function, clearInterval: Function }, now?: () => number }} opts
 *   me = { uid, name, level, avatar, loadout: [{unitId, stats}], hero: {unitId, stats}|null }
 *   freeplay: the host's freeplay setting (a FREEPLAY_TIERS id, or null: off); a guest adopts the host's
 *   timers / now: injectable for tests (default: the real timers and Date.now)
 *   doc: the document whose visibility slows the beacon (tests pass a fake; none in Node)
 *   exclusive: close the previous session first (one room at a time; tests open two)
 */
export function openSession({ code, isHost, backend, me, stageId = '1-1', difficulty = 'normal', freeplay = null, timers = globalThis, now = () => Date.now(), doc = globalThis.document, exclusive = true }) {
  if (current && exclusive) current.close();
  const emitter = createEmitter();
  const s = {
    code,
    isHost,
    me: { ...me, ready: isHost },
    /** the ally: { uid, name, level, avatar, loadout, hero, ready, host, freeplay } (freeplay: the
     *  setting the guest's last hello / ready was for, see canStart) */
    peer: null,
    full: false,
    stageId,
    difficulty,
    /** co-op freeplay past the stage's last wave: null (off) or a tier id (the host's choice) */
    freeplay: freeplayTier(freeplay),
    phase: 'lobby',
    start: null,
    lockstep: null,
    error: null, // { code, retryMs } when the room could not be opened / joined, or closed ('idle')
    mismatch: null, // { uid, name, theirs }: the other player's version differs from mine (no pairing)
    /** the ally who was here and left / went silent ({ name, why }), until someone pairs */
    lastPeer: null,
    /** back in the room after a battle: the ally from that battle ({ uid, name, inRoom, fighting }),
     *  until they pair again, leave, or go quiet for LOBBY.peerSilentMs. inRoom: they are back in
     *  the room too (else still on their battle screen: the results, or a battle that runs on);
     *  fighting: { wave, goal } while that battle runs on (a freeplay run I left), else null */
    returning: null,
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
  let mismatchHeard = 0; // last hello from the mismatched player
  let oneWaySince = 0; // since when my ally is here without seeing me (0: not now)
  let oneWayTries = 0; // fresh channels / sockets asked for since we last were paired
  let lastActivity = t0; // ally joined / left, either Ready, stage, Retry (an untouched lobby closes)
  let returningHeard = 0; // last message from the ally of the last battle (s.returning)
  // this battle's ally: back in the room ('lobby'), or left the room for good ('leave'); only a
  // room 'leave' means gone for good (a lockstep goodbye also comes after a desync)
  let allyInRoom = false;
  let allyLeft = false;
  let restSince = 0; // the battle is over on my screen since (0: not yet)
  let lastRestBeat = -Infinity;
  let lastFightingAt = -Infinity; // my last 'fighting' beacon (-Infinity: none in this battle)
  let fightingOver = false; // its last one said my battle is over: no more
  const hidden = () => doc?.hidden === true;
  /** The other player of the battle that runs (or just ran) here. */
  const isAlly = (uid) => !!uid && uid !== s.me.uid && !!s.start?.players.some((p) => p.uid === uid);

  const send = (msg, opts) => room?.send(msg, opts);
  function hello() {
    if (!room || s.phase !== 'lobby') return;
    lastHelloAt = now();
    const msg = { type: 'hello', player: { ...s.me, host: isHost }, v: version, sees: s.peer?.uid ?? null };
    if (isHost) msg.room = { stageId: s.stageId, difficulty: s.difficulty, freeplay: s.freeplay };
    else msg.freeplay = s.freeplay; // what my ready flag agrees to
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
      room.close(); // a host's room is gone for good here (the code is free again)
    } catch (e) {
      console.warn('[coop] idle close failed', e);
    }
    changed();
  }

  /**
   * Guest: the host's freeplay setting (from its hello or room message). Ready is consent to it,
   * so a changed setting takes my Ready back (I tap it again for the new one).
   */
  function adoptFreeplay(value) {
    const fp = freeplayTier(value);
    if (fp === s.freeplay) return;
    s.freeplay = fp;
    lastActivity = now();
    if (s.me.ready) {
      s.me.ready = false;
      send({ type: 'ready', uid: s.me.uid, ready: false, freeplay: s.freeplay }, { latest: 'ready' });
    }
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
      if (!isHost && why === 'left') {
        s.me.ready = false;
        if (s.stuck === 'host') s.stuck = null; // the host left: nothing to retry (see lobbyTick)
      }
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
    // freeplay: the setting a guest's ready flag was given for (see canStart)
    s.peer = { uid: p.uid, name: p.name, level: p.level, avatar: p.avatar, loadout: p.loadout || [], hero: p.hero || null, ready: !!p.ready, host: !!p.host, freeplay: freeplayTier(msg.freeplay) };
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
      adoptFreeplay(msg.room.freeplay);
    }
    if (isNew) {
      s.stuck = null;
      s.returning = null; // the ally from the last battle is back (or someone new took the seat)
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
    // the ally of the last battle is still there (its battle or results screen keeps talking)
    if (s.returning && from && from === s.returning.uid) returningHeard = now();
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
        adoptFreeplay(msg.freeplay);
        lastActivity = now();
        changed();
        break;
      case 'ready':
        if (s.peer && msg.uid === s.peer.uid) {
          if (s.peer.ready !== !!msg.ready) lastActivity = now();
          s.peer.ready = !!msg.ready;
          s.peer.freeplay = freeplayTier(msg.freeplay);
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
        // lockstep traffic only means something to a running battle: an ally still on its
        // results screen keeps beating into the room after I went back to the lobby (and such
        // a beat must not count as the guest's answer to the next battle's start)
        if (s.phase !== 'battle' || !s.lockstep) break;
        if (isHost) guestHeard = true;
        s.lockstep.receive(msg.m);
        break;
      case 'leave':
        if (s.phase === 'battle' && isAlly(msg.uid)) {
          // my ally left the room (Leave / Home / closed the tab), not just this battle
          allyLeft = true;
          peerLeft();
          emitter.emit('ally', 'left');
        } else if (s.peer && msg.uid === s.peer.uid) peerLeft();
        else if (s.returning && msg.uid === s.returning.uid && s.phase === 'lobby') {
          // the ally from the last battle went home instead of back to the room
          s.lastPeer = { name: s.returning.name, why: 'left' };
          s.returning = null;
          searchSince = now();
          lastActivity = now();
          if (!isHost && s.stuck === 'host') s.stuck = null;
          changed();
        } else if (s.mismatch && msg.uid === s.mismatch.uid && s.phase === 'lobby') {
          // the player on the other build left (or reloads into a fresh room): stop pointing at them
          clearMismatch();
          changed();
        }
        break;
      case 'lobby':
        // my ally is back in the room after the battle: its lockstep stopped, so stop waiting on
        // it (the battle is over on its screen; mine finishes on its own if it is not yet)
        if (s.phase === 'battle' && isAlly(msg.uid) && !allyInRoom) {
          allyInRoom = true;
          const p = s.lockstep && [...s.lockstep.peers.values()][0];
          if (p && !p.gone) s.lockstep.dropPeer(p, 'lobby');
          else if (p && p.why !== 'left') p.why = 'lobby'; // dropped before: no rejoin offer now
          emitter.emit('ally', 'room');
          changed();
        }
        break;
      case 'fighting':
        // back in the room while my ally's battle runs on (freeplay): "Rin is still fighting — wave 87"
        if (s.phase === 'lobby' && s.returning && msg.uid === s.returning.uid && !s.returning.inRoom) {
          const ok = Number.isInteger(msg.wave) && msg.wave >= 0 && Number.isInteger(msg.goal) && msg.goal >= 0;
          s.returning.fighting = ok && !msg.over ? { wave: msg.wave, goal: msg.goal } : null;
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
    if (s.returning && !s.peer && up && t - Math.max(returningHeard, connectedAt) > LOBBY.peerSilentMs) {
      // the ally of the last battle went quiet (its tab closed without a goodbye, the phone
      // slept, the connection dropped): like any ally gone silent, it may still come back
      s.lastPeer = { name: s.returning.name, why: 'silent' };
      s.returning = null;
      searchSince = t;
      changed();
    }
    if (s.mismatch && up && t - Math.max(mismatchHeard, connectedAt) > LOBBY.mismatchSilentMs) {
      clearMismatch();
      changed();
    }
    if (!s.stuck && !s.peer && t - searchSince > LOBBY.findMs) {
      if (s.link !== 'connected') s.stuck = 'server';
      // no alarm while the host is still on its battle screen (it keeps saying so) or left the
      // room (the room stays: they pair up again here when the host is back)
      else if (!isHost && !s.mismatch && !(s.returning && !s.returning.inRoom) && s.lastPeer?.why !== 'left') s.stuck = 'host';
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

  /** The battle's clock: the start message until the guest answers; the 'fighting' beacon. */
  function battleTick(t) {
    if (isHost && !guestHeard && s.start && !s.lockstep?.peers.get(1)?.gone && t - lastStartAt >= LOBBY.startResendMs) {
      lastStartAt = t;
      send({ type: 'start', start: s.start }, { latest: 'start' });
    }
    // my ally went back to the room while my battle runs on (a freeplay run they left): tell it
    // how far I am every LOBBY.fightingMs, and once more when my battle ends
    const ls = s.lockstep;
    if (!ls || !allyInRoom || allyLeft || fightingOver) return;
    const over = ls.finished;
    if (over ? lastFightingAt === -Infinity : t - lastFightingAt < LOBBY.fightingMs) return;
    lastFightingAt = t;
    fightingOver = over;
    send({ type: 'fighting', uid: s.me.uid, wave: ls.sim.wave, goal: ls.sim.totalWaves, over }, { latest: 'fighting' });
  }

  const beacon = timers.setInterval(() => {
    const t = now();
    if (s.phase === 'lobby') lobbyTick(t);
    else if (s.phase === 'battle') battleTick(t);
  }, LOBBY.tickMs);

  /**
   * The battle is over on my screen (results). My ally needs my beats until it has run to the
   * end too; after that (or once it is back in the room) one every LOBBY.restBeatMs only tells
   * a lobby that waits for me that I am still here, and none once my ally left the room.
   */
  function restBeat() {
    const ls = s.lockstep;
    const t = now();
    if (!restSince) {
      restSince = t;
      lastRestBeat = t;
      ls.beat(true); // my last horizon and ack, at once
      return;
    }
    const behind = [...ls.peers.values()].some((p) => !p.gone && p.ack < ls.tick - 1 && t - p.lastHeard < COOP.timeoutMs);
    if (behind) {
      ls.beat();
      return;
    }
    if (allyLeft || t - lastRestBeat < LOBBY.restBeatMs) return;
    lastRestBeat = t;
    ls.beat(true);
  }

  let pump = 0;
  function begin(start) {
    s.start = start;
    s.phase = 'battle';
    s.stuck = null;
    // the room as this battle was started (a guest that missed the host's last room message
    // has it now, and "Back to the room" shows the same setting again)
    if (start.stageId) s.stageId = start.stageId;
    if (start.difficulty) s.difficulty = start.difficulty;
    s.freeplay = freeplayTier(start.freeplay);
    // a fresh battle (also after "Back to the room"): nothing from the last one carries over
    guestHeard = false;
    allyInRoom = false;
    allyLeft = false;
    restSince = 0;
    lastRestBeat = -Infinity;
    lastFightingAt = -Infinity;
    fightingOver = false;
    const mySlot = start.players.find((p) => p.uid === s.me.uid)?.slot ?? (isHost ? 0 : 1);
    s.lockstep = new Lockstep({
      start,
      mySlot,
      now,
      delay: net.inputDelay,
      heartbeatMs: net.heartbeatMs,
      keepaliveMs: net.keepaliveMs ?? net.heartbeatMs,
      // while the channel is down only the newest heartbeat is worth keeping (each one carries
      // the horizon, every unacknowledged command and the last hashes). Once my ally is back in
      // the room while my battle runs on (a freeplay run they left), nobody runs this battle with
      // me any more: its beats stop (the 'fighting' beacon says I am still here; a finished
      // battle's rest beats still go out, see restBeat)
      send: (m) => {
        if (allyInRoom && m?.type === 'in' && s.lockstep && !s.lockstep.finished) return;
        send({ type: 'ls', m }, m?.type === 'in' ? { latest: 'ls-in' } : undefined);
      },
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
      if (s.lockstep.finished) restBeat();
      else if (typeof document !== 'undefined' && document.hidden) s.lockstep.advance(Math.min(dt, 1));
      else s.lockstep.beat();
    }, net.heartbeatMs);
    emitter.emit('start', s);
    changed();
  }

  Object.assign(s, {
    net,
    /**
     * Host: the room's stage, difficulty and freeplay setting (a FREEPLAY_TIERS id or null: off;
     * left out = unchanged). A changed freeplay setting needs the guest's Ready again.
     */
    setStage(stage, diff, freeplay = s.freeplay) {
      if (!isHost || s.phase !== 'lobby') return;
      s.stageId = stage;
      s.difficulty = diff;
      s.freeplay = freeplayTier(freeplay);
      lastActivity = now();
      send({ type: 'room', stageId: stage, difficulty: diff, freeplay: s.freeplay }, { latest: 'room' });
      changed();
    },
    setReady(ready) {
      s.me.ready = !!ready;
      lastActivity = now();
      // the freeplay setting this Ready is for (the host starts only when it is still its own)
      send({ type: 'ready', uid: s.me.uid, ready: s.me.ready, freeplay: s.freeplay }, { latest: 'ready' });
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
        freeplay: s.freeplay, // null: a normal battle (createCoopSim)
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
    /**
     * The battle is over: back to this room's lobby on the same channel, so the room, its code
     * and the seats stay and the two of you can go again (owner: "make it so the room stays").
     * The ally is told ('lobby'), pairs again with a fresh handshake when it comes back too, and
     * the guest taps Ready again. False when there is no battle to come back from.
     */
    backToLobby() {
      if (s.phase !== 'battle') return false;
      timers.clearInterval(pump);
      pump = 0;
      const t = now();
      const ally = s.start?.players.find((p) => p.uid !== s.me.uid) || null;
      send({ type: 'lobby', uid: s.me.uid });
      s.phase = 'lobby';
      s.start = null;
      s.lockstep = null;
      s.peerGone = false;
      s.peer = null;
      s.stuck = null;
      s.me.ready = isHost;
      if (ally && allyLeft) {
        // they left the room (Leave / Home / closed the tab): nobody to wait for
        s.lastPeer = { name: ally.name || 'Your ally', why: 'left' };
        s.returning = null;
      } else {
        // back in the room already, or still on their battle screen (the results, or a battle
        // that runs on after a split): wait for them while they keep saying they are there
        // (fighting: { wave, goal } while their battle runs on, from their 'fighting' beacon)
        s.lastPeer = null;
        s.returning = ally ? { uid: ally.uid, name: ally.name || 'Your ally', inRoom: allyInRoom, fighting: null } : null;
      }
      returningHeard = t;
      allyInRoom = false;
      allyLeft = false;
      restSince = 0;
      peerSeesMe = false;
      oneWaySince = 0;
      oneWayTries = 0;
      guestHeard = false;
      lastStartAt = -Infinity;
      searchSince = t;
      lastActivity = t;
      hello();
      changed();
      return true;
    },
    /** Player info by slot (names / colours for the HUD). */
    player(slot) {
      return s.start?.players.find((p) => p.slot === slot) || null;
    },
    /**
     * Leave the room: goodbye to the ally, the seat freed. A host's room itself stays registered
     * (keepRoom), so opening it again ("Your last room", a reload) gets the same channel back and
     * an ally still waiting in it pairs up at once; keepRoom: false (New room) gives the code up.
     */
    close({ keepRoom = true } = {}) {
      if (s.phase === 'closed') return;
      timers.clearInterval(pump);
      timers.clearInterval(beacon);
      try {
        s.lockstep?.leave();
        send({ type: 'leave', uid: s.me.uid });
        room.close({ keep: keepRoom });
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
  s.close = (opts) => {
    globalThis.removeEventListener?.('pagehide', onPageHide);
    doc?.removeEventListener?.('visibilitychange', onVisibility);
    close0(opts);
  };

  // live getters (Object.assign above would freeze a getter into its first value); the room
  // itself stays out of enumeration (tests and the e2e reach it as session.room)
  Object.defineProperty(s, 'canStart', {
    // only once both sides see each other: a guest the host hears but who cannot hear the
    // host would never get the start message; and only with the guest's Ready given for the
    // freeplay setting the room has now (not one from before the host changed it)
    get: () => isHost && s.phase === 'lobby' && !!s.peer && peerSeesMe && s.peer.ready && s.peer.freeplay === s.freeplay,
    enumerable: true,
  });
  Object.defineProperty(s, 'room', { get: () => room, enumerable: false });
  /** Both sides see each other (the ally's last hello named me). */
  Object.defineProperty(s, 'paired', { get: () => !!s.peer && peerSeesMe, enumerable: true });

  current = s;
  if (typeof window !== 'undefined') window.__coop = s;
  return s;
}
