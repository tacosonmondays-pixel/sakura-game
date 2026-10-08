// A co-op room: lobby handshake (who is here, which stage, ready checks), then the start
// message that both clients turn into the same Lockstep battle. One session at a time; the
// battle screen picks it up with getSession().
//
// Room messages (over backend.openRoom(code), i.e. Realtime broadcast or BroadcastChannel):
//   { type: 'hello', player }        my name / level / avatar / loadout (sent on every new peer)
//   { type: 'room', stageId, difficulty }   host's stage choice
//   { type: 'ready', uid, ready }
//   { type: 'start', start }         host → everyone: seed, stage, both players' loadouts
//   { type: 'ls', m }                lockstep traffic during the battle
//   { type: 'leave', uid }
import { createEmitter } from '../../core/events.js';
import { COOP } from '../../data/coop.js';
import { Lockstep } from './lockstep.js';

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

export function normalizeCode(code) {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

/**
 * @param {{ code: string, isHost: boolean, backend: object, me: object, stageId?: string, difficulty?: string }} opts
 *   me = { uid, name, level, avatar, loadout: [{unitId, stats}], hero: {unitId, stats}|null }
 */
export function openSession({ code, isHost, backend, me, stageId = '1-1', difficulty = 'normal' }) {
  if (current) current.close();
  const emitter = createEmitter();
  const s = {
    code,
    isHost,
    me: { ...me, ready: isHost },
    peer: null,
    stageId,
    difficulty,
    phase: 'lobby',
    start: null,
    lockstep: null,
    error: null,
    peerGone: false,
    on: emitter.on,
    emit: emitter.emit,
  };
  const changed = () => emitter.emit('change', s);

  const hello = () => room.send({ type: 'hello', player: { ...s.me, host: isHost } });
  const room = backend.openRoom(code, {
    meta: { name: me.name, host: isHost },
    onMessage: (msg) => handle(msg),
    onPresence: (list) => {
      const peer = list[0];
      if (peer && (!s.peer || s.peer.uid !== peer.uid)) hello();
      if (!peer && s.peer) {
        if (s.phase === 'lobby') {
          s.peer = null;
          if (!isHost) s.me.ready = false;
        } else if (s.lockstep && !s.peerGone) {
          const p = [...s.lockstep.peers.values()][0];
          if (p) s.lockstep.dropPeer(p, 'left');
        }
        changed();
      }
    },
  });
  hello();

  function handle(msg) {
    if (!msg || typeof msg !== 'object') return;
    switch (msg.type) {
      case 'hello': {
        const p = msg.player || {};
        if (!p.uid || p.uid === s.me.uid) return;
        if (s.peer && s.peer.uid !== p.uid) return; // room is full (2 players)
        const isNew = !s.peer;
        s.peer = { uid: p.uid, name: p.name, level: p.level, avatar: p.avatar, loadout: p.loadout || [], hero: p.hero || null, ready: !!p.ready, host: !!p.host };
        if (isNew) hello();
        if (isHost) room.send({ type: 'room', stageId: s.stageId, difficulty: s.difficulty });
        changed();
        break;
      }
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
        begin(msg.start);
        break;
      case 'ls':
        s.lockstep?.receive(msg.m);
        break;
      case 'leave':
        if (s.peer && msg.uid === s.peer.uid) {
          if (s.phase === 'lobby') s.peer = null;
          else if (s.lockstep) {
            const p = [...s.lockstep.peers.values()][0];
            if (p) s.lockstep.dropPeer(p, 'left');
          }
          changed();
        }
        break;
      default:
        break;
    }
  }

  let pump = 0;
  function begin(start) {
    s.start = start;
    s.phase = 'battle';
    const mySlot = start.players.find((p) => p.uid === s.me.uid)?.slot ?? (isHost ? 0 : 1);
    s.lockstep = new Lockstep({
      start,
      mySlot,
      send: (m) => room.send({ type: 'ls', m }),
      hooks: {
        onPeerGone: (slot, reason) => {
          s.peerGone = reason || true;
          emitter.emit('peerGone', reason);
          changed();
        },
        onDesync: (kind) => emitter.emit('desync', kind),
        onResync: () => emitter.emit('resync'),
        onApplied: (cmd, res) => emitter.emit('applied', { cmd, res }),
      },
    });
    // heartbeats keep flowing while the battle screen loads; a hidden tab keeps ticking slowly
    let last = performance.now();
    pump = setInterval(() => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      if (!s.lockstep) return;
      if (typeof document !== 'undefined' && document.hidden) s.lockstep.advance(Math.min(dt, 1));
      else s.lockstep.beat();
    }, COOP.heartbeatMs);
    emitter.emit('start', s);
    changed();
  }

  Object.assign(s, {
    setStage(stage, diff) {
      if (!isHost) return;
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
    get canStart() {
      return isHost && s.phase === 'lobby' && !!s.peer && s.peer.ready;
    },
    /** Host: send the start message and begin. */
    startBattle(seed = (Math.random() * 2 ** 31) >>> 0) {
      if (!s.canStart) return false;
      const start = {
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
      clearInterval(pump);
      try {
        s.lockstep?.leave();
        room.send({ type: 'leave', uid: s.me.uid });
        room.close();
      } catch (e) {
        console.warn('[coop] close failed', e);
      }
      s.phase = 'closed';
      if (current === s) current = null;
      if (typeof window !== 'undefined' && window.__coop === s) delete window.__coop;
    },
  });

  current = s;
  if (typeof window !== 'undefined') window.__coop = s;
  return s;
}
