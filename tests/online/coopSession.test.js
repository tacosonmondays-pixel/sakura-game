// The co-op lobby handshake (src/online/coop/session.js) over a fake room transport with a
// controllable network: latency, links that go down and come back, a "mute" link (the client
// believes it is joined but nothing it sends gets out: what a hung Realtime presence track did
// on some Supabase nodes), single lost messages. Simulated time throughout.
import { describe, it, expect } from 'vitest';
import { openSession, LOBBY } from '../../src/online/coop/session.js';
import { coopVersion } from '../../src/online/coop/version.js';
import { openSocialSession } from '../../src/online/coop/socialRoom.js';
import { createCoopSim, quantize } from '../../src/online/coop/commands.js';
import { clampStart } from '../../src/online/coop/statLimits.js';

function world({ latency = 60 } = {}) {
  const clock = { t: 1_000_000 };
  const intervals = new Map();
  let nextId = 1;
  const timers = {
    setInterval: (fn, ms) => {
      const id = nextId++;
      intervals.set(id, { fn, ms, due: clock.t + ms });
      return id;
    },
    clearInterval: (id) => intervals.delete(id),
  };
  const wire = [];
  const later = [];
  const rooms = [];
  const W = {
    clock,
    timers,
    rooms,
    latency,
    /** (msg, fromRoom, toRoom) => true drops that one delivery */
    lose: () => false,
    /** codes the "server" refuses: code → error code */
    refuse: {},
    /** what a fresh channel does (default: nothing changes) */
    onReconnect: () => {},
    now: () => clock.t,
    transmit(from, msg) {
      if (from.mute) return;
      for (const to of rooms) {
        if (to === from || to.code !== from.code || to.closed) continue;
        if (W.lose(msg, from, to)) continue;
        wire.push({ at: clock.t + W.latency, from, to, msg: JSON.parse(JSON.stringify(msg)) });
      }
    },
    backend(uid) {
      return {
        uid,
        openRoom(code, handlers) {
          const r = {
            uid, code, handlers, up: false, closed: false, mute: false, deaf: false, outbox: [], log: [], reconnects: 0, reconnectLog: [], status: 'connecting',
            net: { heartbeatMs: 250, inputDelay: 30, keepaliveMs: 1000 },
            get connected() {
              return r.up && !r.closed;
            },
            send(msg, { latest = null, drop = false } = {}) {
              if (r.closed) return false;
              r.log.push({ at: clock.t, msg, up: r.up });
              if (!r.up) {
                if (drop) return false;
                if (latest) r.outbox = r.outbox.filter((o) => o.key !== latest);
                r.outbox.push({ key: latest, msg });
                return false;
              }
              W.transmit(r, msg);
              return true;
            },
            reconnect(opts = {}) {
              r.reconnects++;
              r.reconnectLog.push({ at: clock.t, ...opts });
              W.onReconnect(r, opts);
            },
            close(opts = {}) {
              r.closed = true;
              r.closeOpts = opts;
            },
          };
          rooms.push(r);
          if (W.refuse[code]) later.push(() => handlers.onError(Object.assign(new Error(W.refuse[code]), { code: W.refuse[code] })));
          return r;
        },
      };
    },
    /** the channel is (re)joined: queued messages go out, the session hears 'connected' */
    connect(r) {
      const rejoin = r.everUp === true;
      r.up = true;
      r.everUp = true;
      r.status = 'connected';
      const q = r.outbox;
      r.outbox = [];
      for (const o of q) W.transmit(r, o.msg);
      r.handlers.onStatus?.('connected', { rejoin });
    },
    disconnect(r) {
      r.up = false;
      r.status = 'reconnecting';
      r.handlers.onStatus?.('reconnecting', { reason: 'CHANNEL_ERROR' });
    },
    step(ms) {
      const end = clock.t + ms;
      while (clock.t < end) {
        clock.t = Math.min(end, clock.t + 10);
        while (later.length) later.shift()();
        for (let i = 0; i < wire.length;) {
          const w = wire[i];
          if (w.at > clock.t) {
            i++;
            continue;
          }
          wire.splice(i, 1);
          // a channel that is not joined (or a deaf one) never hears it: broadcast is not stored
          if (w.to.up && !w.to.closed && !w.to.deaf) w.to.handlers.onMessage(w.msg, w.from.uid);
        }
        for (const it of [...intervals.values()]) {
          if (it.due <= clock.t) {
            it.due += it.ms;
            it.fn();
          }
        }
      }
    },
    /** steps until cond() holds; the time it took (ms) or null after max */
    until(cond, max = 30000) {
      const t0 = clock.t;
      while (!cond() && clock.t - t0 < max) W.step(10);
      return cond() ? clock.t - t0 : null;
    },
  };
  return W;
}

const meOf = (uid, name, units) => ({ uid, name, level: 5, avatar: 'aoi', loadout: units.map((unitId) => ({ unitId, stats: { costMul: 0.5 } })), hero: null });
const HOST = 'host-uid';
const GUEST = 'guest-uid';

function open(W, isHost, extra = {}, social = null) {
  const uid = isHost ? HOST : GUEST;
  const opts = {
    code: 'ROOM1', isHost, backend: W.backend(uid), timers: W.timers, now: W.now, exclusive: false, stageId: '1-2',
    me: meOf(uid, isHost ? 'Aiko' : 'Bea', isHost ? ['aoi', 'rei'] : ['yuki', 'rei']),
    ...extra,
  };
  return social ? openSocialSession(opts, social) : openSession(opts);
}
const hellos = (s) => s.room.log.filter((e) => e.msg.type === 'hello' && e.up).length;

describe('co-op lobby handshake', () => {
  it('pairs in well under 3 s on a normal link, both ways, and says so in the hello', () => {
    const W = world();
    const host = open(W, true);
    expect(host.link).toBe('connecting');
    W.step(300);
    W.connect(host.room);
    expect(host.link).toBe('connected');
    W.step(2000);
    const guest = open(W, false);
    W.step(400); // the guest's channel takes 0.4 s to join
    W.connect(guest.room);
    const ms = W.until(() => host.paired && guest.paired);
    expect(ms).not.toBe(null);
    expect(ms).toBeLessThan(1000);
    expect(host.peer.name).toBe('Bea');
    expect(guest.peer.name).toBe('Aiko');
    expect(guest.stageId).toBe('1-2'); // the host's hello carries its stage choice
    const last = guest.room.log.filter((e) => e.msg.type === 'hello').at(-1).msg;
    expect(last.sees).toBe(HOST);
    expect(last.v).toEqual(coopVersion());
    host.close();
    guest.close();
  });

  it('[social] never pairs with a player I blocked (their hellos are ignored); someone else still can', () => {
    const W = world();
    const blocked = new Set([GUEST]);
    const host = open(W, true, {}, { isBlocked: (uid) => blocked.has(uid) });
    W.connect(host.room);
    const guest = open(W, false);
    W.connect(guest.room);
    W.step(8000);
    expect(host.peer).toBe(null); // the blocked guest's hellos never make it an ally
    expect(host.paired).toBe(false);
    expect(guest.paired).toBe(false);
    guest.close();
    // another player takes the seat at once
    const other = openSession({
      code: 'ROOM1', isHost: false, backend: W.backend('other-uid'), timers: W.timers, now: W.now, exclusive: false,
      me: meOf('other-uid', 'Cleo', ['yuki']),
    });
    W.connect(other.room);
    expect(W.until(() => host.paired && other.paired)).not.toBe(null);
    expect(host.peer.name).toBe('Cleo');
    host.close();
    other.close();
  });

  it('[social] session.seated turns on (with a \'seated\' event) once the server registers the seat', () => {
    const W = world();
    const host = open(W, true, {}, {});
    const seen = [];
    host.on('seated', (s) => seen.push(s.seated));
    let changes = 0;
    host.on('change', () => changes++);
    expect(host.seated).toBe(false);
    W.connect(host.room);
    expect(host.seated).toBe(false);
    host.room.handlers.onSeated({ code: 'ROOM1', host: true }); // what open_room answering does
    expect(host.seated).toBe(true);
    expect(seen).toEqual([true]);
    expect(changes).toBeGreaterThan(0);
    host.close();
    // an adapter that answers before openSession returns: seated from the start
    const fast = { uid: GUEST, openRoom: (code, handlers) => { handlers.onSeated({ code, host: false }); return W.backend(GUEST).openRoom(code, handlers); } };
    const guest = openSocialSession({ code: 'ROOM2', isHost: false, backend: fast, timers: W.timers, now: W.now, exclusive: false, me: meOf(GUEST, 'Bea', ['yuki']) });
    expect(guest.seated).toBe(true);
    guest.close();
    // the plain session knows nothing about seats (that lives outside the co-op compatibility id)
    const plain = open(W, true);
    expect(plain.seated).toBe(undefined);
    plain.close();
  });

  it('a mute host (its messages never get out) is found as soon as its link works again', () => {
    const W = world();
    const host = open(W, true);
    W.connect(host.room);
    host.room.mute = true; // joined as far as the client knows, but the server forwards nothing
    const guest = open(W, false);
    W.connect(guest.room);
    W.step(5000);
    expect(host.peer?.name).toBe('Bea'); // the host hears the guest…
    expect(guest.peer).toBe(null); // …but the guest never hears the host
    expect(host.paired).toBe(false);
    host.room.mute = false;
    // the guest keeps beaconing until it sees the host, the host answers every hello that does
    // not see it yet: paired within about one beacon interval
    const ms = W.until(() => guest.paired && host.paired);
    expect(ms).not.toBe(null);
    expect(ms).toBeLessThanOrEqual(LOBBY.helloMs + 2 * W.latency + LOBBY.tickMs);
    host.close();
    guest.close();
  });

  it('one lost answer does not strand the guest', () => {
    const W = world();
    let lost = 0;
    W.lose = (msg, from) => from.uid === HOST && msg.type === 'hello' && lost++ === 0;
    const host = open(W, true);
    W.connect(host.room);
    W.step(5000); // the host is alone: its idle beacon is lost once, then nobody hears it
    lost = 0;
    const guest = open(W, false);
    W.connect(guest.room);
    const ms = W.until(() => guest.paired && host.paired);
    expect(lost).toBeGreaterThanOrEqual(1);
    expect(ms).not.toBe(null);
    expect(ms).toBeLessThan(3000);
    host.close();
    guest.close();
  });

  it('every (re)join says hello at once, and a reconnect keeps the pair and the ready flag', () => {
    const W = world();
    const host = open(W, true);
    const guest = open(W, false);
    W.connect(host.room);
    W.connect(guest.room);
    W.until(() => host.paired && guest.paired);
    guest.setReady(true);
    W.until(() => host.canStart);
    // the guest's channel drops; nothing it sends gets out meanwhile
    W.disconnect(guest.room);
    expect(guest.link).toBe('reconnecting');
    W.step(4000);
    expect(host.peer).not.toBe(null); // 4 s of silence is not a departure
    const before = guest.room.log.length;
    W.connect(guest.room);
    expect(guest.link).toBe('connected');
    const sent = guest.room.log.slice(before).map((e) => e.msg.type);
    expect(sent).toContain('hello'); // right at the rejoin, not on the next beacon
    W.step(500);
    expect(host.peer.ready).toBe(true);
    expect(host.canStart).toBe(true);
    expect(guest.me.ready).toBe(true);
    host.close();
    guest.close();
  });

  it('a lost "ready" fixes itself with the next keepalive hello', () => {
    const W = world();
    W.lose = (msg) => msg.type === 'ready';
    const host = open(W, true);
    const guest = open(W, false);
    W.connect(host.room);
    W.connect(guest.room);
    W.until(() => host.paired && guest.paired);
    guest.setReady(true);
    const ms = W.until(() => host.canStart);
    expect(ms).not.toBe(null);
    expect(ms).toBeLessThanOrEqual(LOBBY.keepaliveMs + LOBBY.tickMs + W.latency + 20);
    host.close();
    guest.close();
  });

  it('an ally silent for peerSilentMs has left — but not while my own link is down', () => {
    const W = world();
    const host = open(W, true);
    const guest = open(W, false);
    W.connect(host.room);
    W.connect(guest.room);
    W.until(() => host.paired && guest.paired);
    // the host's own channel is down for 15 s: the guest's silence is not the guest's fault
    W.disconnect(host.room);
    W.step(15000);
    expect(host.peer?.uid).toBe(GUEST);
    W.connect(host.room);
    W.step(1000);
    expect(host.peer?.uid).toBe(GUEST);
    expect(host.paired).toBe(true);
    // now the guest's tab dies without a goodbye
    guest.room.closed = true;
    const ms = W.until(() => !host.peer, LOBBY.peerSilentMs + 5000);
    expect(ms).toBeGreaterThanOrEqual(LOBBY.peerSilentMs - LOBBY.keepaliveMs);
    expect(ms).toBeLessThanOrEqual(LOBBY.peerSilentMs + LOBBY.tickMs);
    expect(host.canStart).toBe(false);
    // the host is told who vanished (the lobby offers a new room)
    expect(host.lastPeer).toEqual({ name: 'Bea', why: 'silent' });
    host.close();
  });

  it('a version mismatch clears when the same player says hello again on my version', () => {
    const W = world();
    const host = open(W, true);
    W.connect(host.room);
    // a cached old build of the guest
    const old = W.backend(GUEST).openRoom('ROOM1', { onMessage: () => {} });
    W.connect(old);
    old.send({ type: 'hello', player: { uid: GUEST, name: 'Bea', ready: true }, v: { proto: 1, build: 'old', data: '00000000' } });
    W.step(200);
    expect(host.mismatch).toMatchObject({ uid: GUEST, name: 'Bea' });
    expect(host.peer).toBe(null);
    // Bea reloads: the new page (same account) speaks my version
    old.closed = true;
    const guest = open(W, false);
    W.connect(guest.room);
    const ms = W.until(() => host.paired && guest.paired);
    expect(ms).not.toBe(null);
    expect(host.mismatch).toBe(null);
    host.close();
    guest.close();
  });

  it('a guest that cannot find the host says so after ~15 s; Retry reconnects and starts the clock again', () => {
    const W = world();
    const guest = open(W, false);
    W.step(LOBBY.findMs + 500);
    expect(guest.stuck).toBe('server'); // never even joined the room channel
    W.connect(guest.room);
    expect(guest.stuck).toBe(null);
    W.step(LOBBY.findMs - 1000);
    expect(guest.stuck).toBe(null);
    W.step(2000);
    expect(guest.stuck).toBe('host');
    guest.retry();
    expect(guest.room.reconnects).toBe(1);
    expect(guest.stuck).toBe(null);
    // the host shows up after all
    const host = open(W, true);
    W.connect(host.room);
    expect(W.until(() => guest.paired && host.paired, 3000)).not.toBe(null);
    expect(guest.stuck).toBe(null);
    host.close();
    guest.close();
  });

  it('a code with a typo is refused as not_found (the screen says "No room uses that code")', () => {
    const W = world();
    W.refuse.TYP0S = 'not_found';
    const guest = openSession({ code: 'TYP0S', isHost: false, backend: W.backend(GUEST), timers: W.timers, now: W.now, exclusive: false, me: meOf(GUEST, 'Bea', ['yuki']) });
    W.step(100);
    expect(guest.error?.code).toBe('not_found');
    W.step(LOBBY.findMs + 1000);
    expect(guest.stuck).toBe(null); // the error says it all
    guest.close();
  });

  it('keeps the lobby cheap: a keepalive every 8 s once paired, a slow beacon for a host waiting alone', () => {
    const W = world();
    const host = open(W, true);
    W.connect(host.room);
    W.step(60000);
    const alone = hellos(host);
    // 4 s apart for the first 15 s, then every 20 s
    expect(alone).toBeGreaterThanOrEqual(5);
    expect(alone).toBeLessThanOrEqual(8);
    const guest = open(W, false);
    W.connect(guest.room);
    W.until(() => host.paired && guest.paired);
    const [h0, g0] = [hellos(host), hellos(guest)];
    W.step(60000);
    expect(hellos(host) - h0).toBeLessThanOrEqual(9);
    expect(hellos(guest) - g0).toBeLessThanOrEqual(9);
    expect(host.paired && guest.paired).toBe(true);
    host.close();
    guest.close();
  });

  it('one-way link, guest side: the guest hears the host but is never heard — it gets a fresh channel and they pair', () => {
    const W = world();
    // a fresh channel lands on a good node: the mute is gone
    W.onReconnect = (r) => {
      r.mute = false;
    };
    const host = open(W, true);
    W.connect(host.room);
    const guest = open(W, false);
    guest.room.mute = true; // what the guest sends never gets out
    W.connect(guest.room);
    // the host's own beacon reaches the guest (its answers cannot: it never hears the guest)
    expect(W.until(() => guest.peer, 10000)).not.toBe(null);
    const sawAt = W.clock.t;
    expect(guest.peer.name).toBe('Aiko'); // the guest sees the host…
    W.step(2000);
    expect(guest.paired).toBe(false); // …but the host does not see the guest
    expect(host.peer).toBe(null);
    // the guest cannot be "ready" for a host that cannot hear it, and the host cannot start
    expect(host.canStart).toBe(false);
    const ms = W.until(() => guest.paired && host.paired, 20000);
    expect(ms).not.toBe(null);
    expect(guest.room.reconnects).toBe(1);
    expect(guest.room.reconnectLog[0]).toMatchObject({ seat: false, socket: false, reason: 'one-way' });
    // detected after oneWayMs of hearing the host without being heard, paired soon after
    expect(guest.room.reconnectLog[0].at - sawAt).toBeGreaterThanOrEqual(LOBBY.oneWayMs - LOBBY.tickMs);
    expect(guest.room.reconnectLog[0].at - sawAt).toBeLessThanOrEqual(LOBBY.oneWayMs + LOBBY.tickMs);
    expect(W.clock.t - guest.room.reconnectLog[0].at).toBeLessThan(2000);
    expect(host.room.reconnects).toBe(0); // the side that hears fine does nothing
    host.close();
    guest.close();
  });

  it('one-way link, host side: the host hears the guest but is never heard — it heals itself, backing off and then replacing the socket', () => {
    const W = world();
    let healAt = 3; // only the third fresh connection works
    W.onReconnect = (r) => {
      if (--healAt === 0) r.mute = false;
    };
    const host = open(W, true);
    W.connect(host.room);
    host.room.mute = true;
    const guest = open(W, false);
    W.connect(guest.room);
    W.step(1000);
    expect(host.peer?.name).toBe('Bea');
    expect(host.paired).toBe(false);
    const ms = W.until(() => guest.paired && host.paired, 120000);
    expect(ms).not.toBe(null);
    const log = host.room.reconnectLog;
    expect(log).toHaveLength(3);
    expect(log.map((e) => e.socket)).toEqual([false, true, true]); // from the 2nd try on: a fresh socket
    expect(log.every((e) => e.seat === false)).toBe(true); // never re-takes the seat (join_room is rate-limited)
    // 7 s, then 14 s, then 28 s apart
    expect(log[1].at - log[0].at).toBeGreaterThanOrEqual(2 * LOBBY.oneWayMs - LOBBY.tickMs);
    expect(log[2].at - log[1].at).toBeGreaterThanOrEqual(4 * LOBBY.oneWayMs - LOBBY.tickMs);
    // once paired, the next one-way episode starts again at oneWayMs
    host.close();
    guest.close();
  });

  it('a version-mismatch banner goes when that player leaves or goes quiet, so "can\'t find the host" + Retry can show', () => {
    const W = world();
    const guest = open(W, false);
    W.connect(guest.room);
    // a host on another build says hello…
    const old = W.backend(HOST).openRoom('ROOM1', { onMessage: () => {} });
    W.connect(old);
    old.send({ type: 'hello', player: { uid: HOST, name: 'Aiko', host: true }, v: { proto: 1, build: 'old', data: '00000000' } });
    W.step(500);
    expect(guest.mismatch).toMatchObject({ uid: HOST });
    // …then leaves (reloads into a new room): the banner goes, the search starts over
    old.send({ type: 'leave', uid: HOST });
    W.step(200);
    expect(guest.mismatch).toBe(null);
    W.step(LOBBY.findMs + 500);
    expect(guest.stuck).toBe('host');
    // the same without a goodbye: quiet for mismatchSilentMs
    guest.retry();
    old.send({ type: 'hello', player: { uid: HOST, name: 'Aiko', host: true }, v: { proto: 1, build: 'old', data: '00000000' } });
    W.step(500);
    expect(guest.mismatch).not.toBe(null);
    old.closed = true;
    W.step(LOBBY.mismatchSilentMs + 500);
    expect(guest.mismatch).toBe(null);
    W.step(LOBBY.findMs + 500);
    expect(guest.stuck).toBe('host');
    guest.close();
  });

  it('lobby traffic per hour: stuck guest, host alone, paired, hidden, mismatched — and an untouched lobby closes after 30 min', () => {
    const HOUR = 3600000;
    const per = (s, fn) => {
      const n0 = hellos(s);
      fn();
      return hellos(s) - n0;
    };
    // a guest whose host never answers: fast for 15 s, then every 20 s (was 1/s forever)
    {
      const W = world();
      const guest = open(W, false);
      W.connect(guest.room);
      const n = per(guest, () => W.step(LOBBY.idleCloseMs - 1000));
      expect(guest.stuck).toBe('host');
      expect(n).toBeLessThanOrEqual(15 + Math.ceil((LOBBY.idleCloseMs - 15000) / LOBBY.slowHelloMs) + 1);
      // nobody touched it for 30 min: it closes, says goodbye, frees the seat, and goes quiet
      W.step(2000);
      expect(guest.error?.code).toBe('idle');
      expect(guest.room.closed).toBe(true);
      expect(guest.room.log.at(-1).msg.type).toBe('leave');
      const n1 = guest.room.log.length;
      W.step(60000);
      expect(guest.room.log.length).toBe(n1);
      guest.close();
    }
    // a paired lobby: one keepalive per side every 8 s (≈450 an hour, was 1200); hidden: every 20 s
    {
      const W = world();
      const doc = { hidden: false, listeners: [], addEventListener(t, f) { this.listeners.push(f); }, removeEventListener() {} };
      const host = open(W, true, { doc });
      const guest = open(W, false);
      W.connect(host.room);
      W.connect(guest.room);
      W.until(() => host.paired && guest.paired);
      const ready = () => guest.setReady(!guest.me.ready); // somebody touches the lobby now and then
      let paired = 0;
      for (let i = 0; i < 4; i++) {
        paired += per(host, () => W.step(10 * 60000));
        ready();
      }
      expect(paired / (40 * 60000) * HOUR).toBeLessThanOrEqual(HOUR / LOBBY.keepaliveMs + 10);
      doc.hidden = true;
      let hiddenN = 0;
      for (let i = 0; i < 2; i++) {
        hiddenN += per(host, () => W.step(10 * 60000));
        ready();
      }
      expect(hiddenN / (20 * 60000) * HOUR).toBeLessThanOrEqual(HOUR / LOBBY.hiddenHelloMs + 10);
      expect(host.paired && guest.paired).toBe(true); // a hidden tab still keeps the pair
      // back on the tab: hello at once
      const before = hellos(host);
      doc.hidden = false;
      doc.listeners.forEach((f) => f());
      expect(hellos(host)).toBe(before + 1);
      host.close();
      guest.close();
    }
    // a mismatch on screen: a slow beacon (every 20 s, plus rate-limited answers)
    {
      const W = world();
      const host = open(W, true);
      W.connect(host.room);
      const old = W.backend(GUEST).openRoom('ROOM1', { onMessage: () => {} });
      W.connect(old);
      const say = () => old.send({ type: 'hello', player: { uid: GUEST, name: 'Bea' }, v: { proto: 1, build: 'old', data: '00000000' } });
      say();
      const n = per(host, () => {
        for (let i = 0; i < 30; i++) {
          W.step(20000); // the old build says hello every 20 s
          say();
        }
      });
      expect(host.mismatch).not.toBe(null);
      expect(n).toBeLessThanOrEqual(2 * 30 + 2); // ≈ one beacon + one answer per 20 s (was every 3 s)
      host.close();
    }
  });

  it('a third player is told the room is full; the pair is untouched', () => {
    const W = world();
    const host = open(W, true);
    const guest = open(W, false);
    W.connect(host.room);
    W.connect(guest.room);
    W.until(() => host.paired && guest.paired);
    const third = openSession({ code: 'ROOM1', isHost: false, backend: W.backend('third-uid'), timers: W.timers, now: W.now, exclusive: false, me: meOf('third-uid', 'Chi', ['yuki']) });
    W.connect(third.room);
    expect(W.until(() => third.full, 3000)).not.toBe(null);
    expect(host.peer.uid).toBe(GUEST);
    expect(third.peer).toBe(null);
    for (const s of [host, guest, third]) s.close();
  });

  it('battle: the start message is re-sent until the guest answers, and lobby hellos stop', () => {
    const W = world();
    let starts = 0;
    W.lose = (msg) => msg.type === 'start' && starts++ < 2; // the first two start messages are lost
    const host = open(W, true);
    const guest = open(W, false);
    W.connect(host.room);
    W.connect(guest.room);
    W.until(() => host.paired && guest.paired);
    guest.setReady(true);
    W.until(() => host.canStart);
    expect(host.startBattle(77)).toBe(true);
    const ms = W.until(() => guest.phase === 'battle', 5000);
    expect(ms).not.toBe(null);
    expect(starts).toBeGreaterThanOrEqual(3);
    expect(guest.lockstep.start).toEqual(host.lockstep.start);
    const [h0, g0] = [hellos(host), hellos(guest)];
    W.step(5000);
    expect(hellos(host)).toBe(h0);
    expect(hellos(guest)).toBe(g0);
    host.close();
    guest.close();
  });
});

describe('co-op lobby: each player\'s Auto-cast abilities setting rides in the start message', () => {
  it('the guest\'s autoAbil (her hello) and the host\'s (his own) reach both battles; off is left out', () => {
    for (const [hostOn, guestOn] of [[false, true], [true, false], [false, false]]) {
      const W = world();
      const host = open(W, true, { me: { ...meOf(HOST, 'Aiko', ['aoi', 'rei']), ...(hostOn ? { autoAbil: true } : null) } });
      const guest = open(W, false, { me: { ...meOf(GUEST, 'Bea', ['yuki', 'rei']), autoAbil: guestOn } });
      W.connect(host.room);
      W.connect(guest.room);
      W.until(() => host.paired && guest.paired);
      expect(host.peer.autoAbil).toBe(guestOn);
      guest.setReady(true);
      W.until(() => host.canStart);
      expect(host.startBattle(77)).toBe(true);
      expect(W.until(() => guest.phase === 'battle', 5000)).not.toBe(null);
      const players = host.lockstep.start.players;
      expect(players.map((p) => p.autoAbil)).toEqual([hostOn ? true : undefined, guestOn ? true : undefined]);
      expect(guest.lockstep.start).toEqual(host.lockstep.start);
      for (const s of [host, guest]) expect(s.lockstep.sim.abilityAutoDefault).toEqual([hostOn, guestOn]);
      expect(guest.lockstep.coop.hash()).toBe(host.lockstep.coop.hash());
      host.close();
      guest.close();
    }
  });
});

describe('co-op lobby: the start message is clamped on both clients (statLimits.js)', () => {
  it('a guest whose hello carries absurd stats fights at the clamp; both build the same battle', () => {
    const W = world();
    const host = open(W, true);
    const cheat = { damageMul: 1000, rateMul: 99, costMul: 0.001, level: 1e9, potential: 99, awakenPassive: true };
    const guest = open(W, false, { me: { uid: GUEST, name: 'Bea', level: 5, avatar: 'aoi', loadout: [{ unitId: 'yuki', stats: cheat }, { unitId: 'rei', stats: { potential: 6, level: 85 } }], hero: null } });
    W.connect(host.room);
    W.connect(guest.room);
    W.until(() => host.paired && guest.paired);
    guest.setReady(true);
    W.until(() => host.canStart);
    expect(host.startBattle(4242)).toBe(true);
    expect(W.until(() => guest.phase === 'battle', 5000)).not.toBe(null);
    expect(guest.lockstep.start).toEqual(host.lockstep.start);
    const g = host.lockstep.start.players.find((p) => p.uid === GUEST);
    expect(g.loadout[0].stats).toEqual({ damageMul: 40, rateMul: 12, costMul: 0.5, level: 99, potential: 6, awakenPassive: true });
    // an honest L85 P6 girl passes through as she is
    expect(g.loadout[1].stats).toEqual({ potential: 6, level: 85 });
    expect(guest.lockstep.coop.hash()).toBe(host.lockstep.coop.hash());
    host.close();
    guest.close();
  });

  it('a resync from a hand-edited host fights at the clamp too: its start is clamped again and its checkpoint stats re-derived', () => {
    const W = world();
    const host = open(W, true);
    const guest = open(W, false);
    W.connect(host.room);
    W.connect(guest.room);
    W.until(() => host.paired && guest.paired);
    guest.setReady(true);
    W.until(() => host.canStart);
    expect(host.startBattle(4242)).toBe(true);
    expect(W.until(() => guest.phase === 'battle', 5000)).not.toBe(null);
    // the hand-edited host's own battle: its first girl at damageMul 1000, placed, a few seconds in
    const hostile = JSON.parse(JSON.stringify(host.lockstep.start));
    const hp = hostile.players.find((p) => p.slot === 0);
    hp.loadout[0].stats = { ...hp.loadout[0].stats, damageMul: 1000, rateMul: 99 };
    const unitId = hp.loadout[0].unitId;
    const C = createCoopSim(hostile, { mySlot: 0 });
    let spot = null;
    for (let y = 0.55; y < C.sim.map.height && !spot; y += 0.35) {
      for (let x = 0.55; x < C.sim.map.width && !spot; x += 0.35) if (!C.sim.placementReason(unitId, x, y)) spot = quantize(x, y);
    }
    const cmds = [{ t: 0, p: 0, s: 0, k: 'place', a: [unitId, ...spot] }, { t: 1, p: 0, s: 1, k: 'wave', a: [] }];
    for (const c of cmds) {
      while (C.tick < c.t) C.step();
      expect(C.apply(c).ok).toBe(true);
    }
    for (let i = 0; i < 120; i++) C.step();
    const cheat = C.sim.towers[0];
    expect(cheat.unitStats.damageMul).toBe(1000);
    // the guest rebuilds from that start and that checkpoint (applyResync, as a 'resync' message does)
    const ls = guest.lockstep;
    ls.applyResync({ start: hostile, T: C.tick + 30, w: C.sim.wave, cmds, ck: { t: C.tick, snap: C.snapshot() } });
    while (ls.job) ls.runJob(Infinity);
    const t = ls.coop.sim.getTower(cheat.uid);
    expect(t.unitStats).toMatchObject({ damageMul: 40, rateMul: 12 });
    // her stats and effective stats come from the clamped entry, not from the checkpoint's numbers
    const honest = createCoopSim(clampStart(hostile), { mySlot: 1 });
    for (const c of cmds) {
      while (honest.tick < c.t) honest.step();
      honest.apply(c);
    }
    const h = honest.sim.towers[0];
    expect(t.stats.damage).toBe(h.stats.damage);
    expect(t.stats.rate).toBe(h.stats.rate);
    // (the gear update's rows: damageMul ≤ 40, GEAR_UPDATE.md §10.2)
    expect(t.stats.damage).toBeLessThan(cheat.stats.damage / 20);
    expect(t.eff.damage).toBeLessThan(cheat.eff.damage / 20);
    host.close();
    guest.close();
  });

  it('a resync whose checkpoint keeps her stats honest but edits her effective stats is rebuilt too', () => {
    const W = world();
    const host = open(W, true);
    const guest = open(W, false);
    W.connect(host.room);
    W.connect(guest.room);
    W.until(() => host.paired && guest.paired);
    guest.setReady(true);
    W.until(() => host.canStart);
    expect(host.startBattle(4243)).toBe(true);
    expect(W.until(() => guest.phase === 'battle', 5000)).not.toBe(null);
    const start = host.lockstep.start;
    const unitId = start.players.find((p) => p.slot === 0).loadout[0].unitId;
    const C = createCoopSim(start, { mySlot: 0 });
    let spot = null;
    for (let y = 0.55; y < C.sim.map.height && !spot; y += 0.35) {
      for (let x = 0.55; x < C.sim.map.width && !spot; x += 0.35) if (!C.sim.placementReason(unitId, x, y)) spot = quantize(x, y);
    }
    const cmds = [{ t: 0, p: 0, s: 0, k: 'place', a: [unitId, ...spot] }, { t: 1, p: 0, s: 1, k: 'wave', a: [] }];
    for (const c of cmds) {
      while (C.tick < c.t) C.step();
      expect(C.apply(c).ok).toBe(true);
    }
    for (let i = 0; i < 120; i++) C.step();
    const honestEff = C.sim.towers[0].eff.damage;
    // the hand-edited checkpoint: her stats as her loadout gives them, her effective damage × 1000
    C.sim.towers[0].eff = { ...C.sim.towers[0].eff, damage: honestEff * 1000, rate: C.sim.towers[0].eff.rate * 99 };
    const ls = guest.lockstep;
    ls.applyResync({ start, T: C.tick + 30, w: C.sim.wave, cmds, ck: { t: C.tick, snap: C.snapshot() } });
    while (ls.job) ls.runJob(Infinity);
    const t = ls.coop.sim.getTower(C.sim.towers[0].uid);
    expect(t.eff.damage).toBe(honestEff);
    expect(t.eff.rate).toBeLessThan(C.sim.towers[0].eff.rate / 50);
    host.close();
    guest.close();
  });
});

// "When you lose and go back to coop make it so the room stays and you can rejoin the room"
// (owner, Oct 14). Each battle runs to its end the way the game ends one: both clients' battle
// screens advance their own lockstep (Nightmare: one life, no girls placed, so the first enemy
// through ends it), so both reach the same result at the same tick.
describe('co-op rematch: back to the room after a battle', () => {
  /** Host + guest paired in room ROOM1 (stage 1-1, Nightmare) and in a battle. */
  function battleRoom(W, seed = 77) {
    const host = open(W, true, { stageId: '1-1', difficulty: 'nightmare' });
    const guest = open(W, false);
    W.connect(host.room);
    W.connect(guest.room);
    W.until(() => host.paired && guest.paired);
    guest.setReady(true);
    W.until(() => host.canStart);
    expect(host.startBattle(seed)).toBe(true);
    expect(W.until(() => guest.phase === 'battle', 5000)).not.toBe(null);
    return { host, guest };
  }
  /** Both battle screens running (a frame every 16 ms) until `until()` holds. */
  function play(W, sessions, until, max = 120000) {
    const t0 = W.clock.t;
    while (!until() && W.clock.t - t0 < max) {
      W.step(16);
      for (const s of sessions) if (s.phase === 'battle' && s.lockstep && !s.lockstep.finished) s.lockstep.advance(0.016);
    }
    return until();
  }
  /** The host starts the wave at 3× and both play until the battle is over on both screens. */
  function fightToEnd(W, host, guest) {
    host.lockstep.queue('speed', [3]);
    host.lockstep.queue('wave');
    expect(play(W, [host, guest], () => host.lockstep.finished && guest.lockstep.finished)).toBe(true);
    expect(host.lockstep.sim.state).toBe('lost');
    expect(guest.lockstep.tick).toBe(host.lockstep.tick);
    expect(guest.lockstep.coop.hash()).toBe(host.lockstep.coop.hash());
  }
  const lsSent = (s) => s.room.log.filter((e) => e.msg.type === 'ls' && e.up).length;

  for (const first of ['host', 'guest']) {
    it(`both go back to the room (${first} first) and pair again with no code typed; Ready again, then a fresh battle 2`, () => {
      const W = world();
      const { host, guest } = battleRoom(W);
      const rooms = [host.room, guest.room];
      fightToEnd(W, host, guest);
      const [a, b] = first === 'host' ? [host, guest] : [guest, host];
      const told = [];
      b.on('ally', (where) => told.push(where));
      expect(a.backToLobby()).toBe(true);
      expect(a.phase).toBe('lobby');
      expect(a.returning).toMatchObject({ uid: b.me.uid, name: b.me.name, inRoom: false });
      W.step(500);
      // the one still on its results screen hears it: its lockstep stops waiting for the ally
      expect(b.lockstep.peers.get(a.isHost ? 0 : 1)).toMatchObject({ gone: true, why: 'lobby' });
      expect(told).toEqual(['room']);
      // a while on the results screen: the one in the lobby keeps waiting (no alarm, no "gone")
      W.step(60000);
      expect(a.returning).toMatchObject({ uid: b.me.uid, inRoom: false });
      expect(a.lastPeer).toBe(null);
      expect(a.stuck).toBe(null);
      expect(b.backToLobby()).toBe(true);
      expect(b.returning).toMatchObject({ uid: a.me.uid, inRoom: true });
      expect(W.until(() => host.paired && guest.paired, 3000)).not.toBe(null);
      // same room, same channel: nothing reconnected, nothing retyped
      expect([host.room, guest.room]).toEqual(rooms);
      expect(host.room.reconnects + guest.room.reconnects).toBe(0);
      expect(host.code).toBe('ROOM1');
      expect(guest.code).toBe('ROOM1');
      expect(host.returning).toBe(null);
      expect(guest.returning).toBe(null);
      // the guest taps Ready again: Start stays locked until then
      expect(guest.me.ready).toBe(false);
      W.step(2000);
      expect(host.peer.ready).toBe(false);
      expect(host.canStart).toBe(false);
      expect(host.startBattle(99)).toBe(false);
      guest.setReady(true);
      expect(W.until(() => host.canStart, 3000)).not.toBe(null);
      expect(host.lockstep).toBe(null); // battle 1's lockstep went with it
      expect(host.startBattle(99)).toBe(true);
      expect(W.until(() => guest.phase === 'battle', 5000)).not.toBe(null);
      // battle 2: a fresh lockstep on both, nothing carried over from battle 1
      for (const s of [host, guest]) {
        expect(s.lockstep.start.seed).toBe(99);
        expect(s.lockstep.tick).toBe(0);
        expect(s.lockstep.epoch).toBe(0);
        expect(s.lockstep.log).toEqual([]);
        expect([...s.lockstep.peers.values()].every((p) => !p.gone && p.why === null)).toBe(true);
        expect(s.peerGone).toBe(false);
        expect(s.returning).toBe(null);
        expect(s.lastPeer).toBe(null);
      }
      expect(guest.lockstep.start).toEqual(host.lockstep.start);
      expect(play(W, [host, guest], () => host.lockstep.tick > 500 && guest.lockstep.tick > 500)).toBe(true);
      const pairs = host.lockstep.hashPairs();
      expect(pairs.length).toBeGreaterThan(2);
      for (const p of [...pairs, ...guest.lockstep.hashPairs()]) expect(p.mine).toBe(p.theirs);
      host.close();
      guest.close();
    });
  }

  it('battle 2\'s start is re-sent until the guest answers, even when the host came back first and the guest\'s results screen kept beating', () => {
    const W = world();
    const { host, guest } = battleRoom(W);
    fightToEnd(W, host, guest);
    expect(host.backToLobby()).toBe(true);
    W.step(4000); // the guest reads its results: its lockstep still beats into the room
    expect(guest.phase).toBe('battle');
    expect(guest.backToLobby()).toBe(true);
    W.until(() => host.paired && guest.paired);
    guest.setReady(true);
    W.until(() => host.canStart);
    let starts = 0;
    W.lose = (msg) => msg.type === 'start' && starts++ === 0; // battle 2's first start is lost
    expect(host.startBattle(5)).toBe(true);
    expect(W.until(() => guest.phase === 'battle', 5000)).not.toBe(null);
    expect(starts).toBeGreaterThanOrEqual(2);
    expect(guest.lockstep.start.seed).toBe(5);
    host.close();
    guest.close();
  });

  it('the host goes Home from the results: the guest sees the host left (no long wait, no alarm), and pairs again when the host reopens the room', () => {
    const W = world();
    const { host, guest } = battleRoom(W);
    fightToEnd(W, host, guest);
    const told = [];
    guest.on('ally', (where) => told.push(where));
    host.close(); // Home / Leave room on the results
    expect(host.room.closeOpts).toEqual({ keep: true }); // a host keeps its room registered
    W.step(500);
    expect(told).toEqual(['left']);
    expect(guest.lockstep.peers.get(0)).toMatchObject({ gone: true, why: 'left' });
    expect(guest.backToLobby()).toBe(true);
    expect(guest.lastPeer).toEqual({ name: 'Aiko', why: 'left' });
    expect(guest.returning).toBe(null);
    W.step(LOBBY.findMs * 3);
    expect(guest.stuck).toBe(null); // the room stays: nothing to retry
    // "Your last room" → Rejoin: the host opens the same room again and they pair up
    const again = open(W, true, { stageId: '1-1' });
    W.connect(again.room);
    expect(W.until(() => again.paired && guest.paired, 5000)).not.toBe(null);
    expect(guest.lastPeer).toBe(null);
    again.close();
    guest.close();
  });

  it('the guest goes Home from the results: the host sees its ally left, whether it is still on its results or back in the room', () => {
    // host still on its results screen
    {
      const W = world();
      const { host, guest } = battleRoom(W);
      fightToEnd(W, host, guest);
      guest.close();
      expect(guest.room.closeOpts).toEqual({ keep: true }); // (a guest frees its seat all the same)
      W.step(500);
      expect(host.lockstep.peers.get(1)).toMatchObject({ gone: true, why: 'left' });
      expect(host.backToLobby()).toBe(true);
      expect(host.lastPeer).toEqual({ name: 'Bea', why: 'left' });
      expect(host.returning).toBe(null);
      host.close();
    }
    // host back in the room first, waiting for the guest
    {
      const W = world();
      const { host, guest } = battleRoom(W);
      fightToEnd(W, host, guest);
      host.backToLobby();
      W.step(3000);
      expect(host.returning).toMatchObject({ name: 'Bea', inRoom: false });
      guest.close();
      W.step(500);
      expect(host.returning).toBe(null);
      expect(host.lastPeer).toEqual({ name: 'Bea', why: 'left' });
      host.close();
    }
  });

  it('a "lobby" message drops the lockstep peer with reason "lobby" and nothing else', () => {
    const W = world();
    const { host, guest } = battleRoom(W);
    fightToEnd(W, host, guest);
    const gone = [];
    host.on('peerGone', (why) => gone.push(why));
    guest.backToLobby();
    W.step(500);
    expect(gone).toEqual(['lobby']);
    expect(host.peerGone).toBe('lobby');
    expect(host.lockstep.peers.get(1)).toMatchObject({ gone: true, why: 'lobby' });
    // its stale beats, its hellos and its lobby goodbye do not touch the host's finished battle
    W.step(5000);
    expect(host.phase).toBe('battle');
    expect(host.lockstep.rejoins).toBe(0);
    expect(host.lastPeer).toBe(null);
    host.close();
    guest.close();
  });

  it('the guest\'s "can\'t find the host" waits while the host is on its battle screen, and shows peerSilentMs + findMs after the host goes quiet', () => {
    const W = world();
    const { host, guest } = battleRoom(W);
    fightToEnd(W, host, guest);
    guest.backToLobby();
    W.step(3 * 60000); // the host lingers on its results: it keeps saying so (a slow beat)
    expect(guest.stuck).toBe(null);
    expect(guest.returning).toMatchObject({ name: 'Aiko', inRoom: false });
    // the host's tab dies on the results screen (no goodbye)
    host.room.closed = true;
    const quiet = W.clock.t;
    expect(W.until(() => guest.lastPeer?.why === 'silent', LOBBY.peerSilentMs + 1000)).not.toBe(null);
    expect(guest.returning).toBe(null);
    expect(W.until(() => guest.stuck === 'host', LOBBY.findMs + 1000)).not.toBe(null);
    expect(W.clock.t - quiet).toBeLessThanOrEqual(LOBBY.peerSilentMs + LOBBY.findMs + 2 * LOBBY.tickMs);
    guest.close();
  });

  it('a guest whose host is already back in the room but cannot be heard gets the alarm after the usual findMs', () => {
    const W = world();
    const { host, guest } = battleRoom(W);
    fightToEnd(W, host, guest);
    host.backToLobby();
    W.step(500);
    guest.room.deaf = true; // from now on the guest hears nothing
    guest.backToLobby();
    expect(guest.returning).toMatchObject({ inRoom: true });
    const ms = W.until(() => guest.stuck === 'host', LOBBY.findMs + 2000);
    expect(ms).not.toBe(null);
    expect(ms).toBeLessThanOrEqual(LOBBY.findMs + LOBBY.tickMs);
    host.close();
    guest.close();
  });

  it('the host waiting for an ally who went quiet on its results screen says so after peerSilentMs', () => {
    const W = world();
    const { host, guest } = battleRoom(W);
    fightToEnd(W, host, guest);
    host.backToLobby();
    W.step(2 * 60000);
    expect(host.returning).toMatchObject({ name: 'Bea', inRoom: false });
    guest.room.closed = true; // the guest's phone killed the tab: no goodbye
    expect(W.until(() => host.lastPeer?.why === 'silent', LOBBY.peerSilentMs + 1000)).not.toBe(null);
    expect(host.lastPeer).toEqual({ name: 'Bea', why: 'silent' });
    expect(host.returning).toBe(null);
    host.close();
  });

  it('after a fatal desync the ally still counts as in the room: back in the lobby, the other waits for it', () => {
    const W = world();
    const { host, guest } = battleRoom(W);
    play(W, [host, guest], () => host.lockstep.tick > 300 && guest.lockstep.tick > 300);
    // the host's hash check failed twice (only the verdict: neither battle is touched)
    host.lockstep.flagMismatch();
    host.lockstep.flagMismatch();
    expect(host.lockstep.desynced).toBe(true);
    W.step(500);
    expect(guest.lockstep.peers.get(0)).toMatchObject({ gone: true, why: 'desync' });
    host.lockstep.queue('wave');
    guest.lockstep.queue('wave');
    expect(play(W, [host, guest], () => host.lockstep.finished && guest.lockstep.finished)).toBe(true);
    expect(guest.backToLobby()).toBe(true);
    expect(guest.lastPeer).toBe(null);
    expect(guest.returning).toMatchObject({ name: 'Aiko', inRoom: false });
    W.step(LOBBY.findMs * 2);
    expect(guest.stuck).toBe(null);
    host.backToLobby();
    expect(W.until(() => host.paired && guest.paired, 3000)).not.toBe(null);
    host.close();
    guest.close();
  });

  it('a finished battle beats only every restBeatMs once both are at the end, and not at all once the ally left the room', () => {
    const W = world();
    const { host, guest } = battleRoom(W);
    fightToEnd(W, host, guest);
    W.step(3000);
    const n0 = lsSent(guest);
    W.step(80000);
    const n = lsSent(guest) - n0;
    // was a keepalive every second (keepaliveMs 1000 here): ~80
    expect(n).toBeGreaterThanOrEqual(Math.floor(80000 / LOBBY.restBeatMs) - 1);
    expect(n).toBeLessThanOrEqual(Math.ceil(80000 / LOBBY.restBeatMs) + 1);
    host.close();
    W.step(500);
    const n1 = lsSent(guest);
    W.step(60000);
    expect(lsSent(guest)).toBe(n1);
    guest.close();
  });

  it('backToLobby is only for a battle: false in the lobby and once closed', () => {
    const W = world();
    const host = open(W, true);
    W.connect(host.room);
    expect(host.backToLobby()).toBe(false);
    expect(host.phase).toBe('lobby');
    expect(host.room.log.some((e) => e.msg.type === 'lobby')).toBe(false);
    host.close();
    expect(host.backToLobby()).toBe(false);
    expect(host.phase).toBe('closed');
  });

  it('New room gives the code up; idle closing too', () => {
    const W = world();
    const host = open(W, true);
    W.connect(host.room);
    host.close({ keepRoom: false });
    expect(host.room.closeOpts).toEqual({ keep: false });
    const idle = open(W, true);
    W.connect(idle.room);
    W.step(LOBBY.idleCloseMs + 1000);
    expect(idle.error?.code).toBe('idle');
    expect(idle.room.closeOpts).toEqual({});
    idle.close();
  });
});

// Co-op freeplay (owner, Oct 14: "can you add freeplay stages too to coop?"): a room setting next to
// the difficulty — off or a tier — that the host picks, the guest agrees to with Ready, rides in
// hello / room / start, survives "Back to the room", and a run one player left plays on.
describe('co-op freeplay: the room setting', () => {
  const lastMsg = (s, type) => s.room.log.filter((e) => e.msg.type === type).at(-1)?.msg;
  const sent = (s, type) => s.room.log.filter((e) => e.msg.type === type && e.up).length;
  /** The given sessions' battle screens run (a frame every 16 ms) until `until()` holds. */
  function play(W, sessions, until, max = 120000) {
    const t0 = W.clock.t;
    while (!until() && W.clock.t - t0 < max) {
      W.step(16);
      for (const s of sessions) if (s.phase === 'battle' && s.lockstep && !s.lockstep.finished) s.lockstep.advance(0.016);
    }
    return until();
  }
  function paired(W, hostExtra = {}) {
    const host = open(W, true, hostExtra);
    const guest = open(W, false);
    W.connect(host.room);
    W.connect(guest.room);
    expect(W.until(() => host.paired && guest.paired)).not.toBe(null);
    return { host, guest };
  }
  function startTogether(W, host, guest, seed) {
    guest.setReady(true);
    expect(W.until(() => host.canStart, 3000)).not.toBe(null);
    expect(host.startBattle(seed)).toBe(true);
    expect(W.until(() => guest.phase === 'battle', 5000)).not.toBe(null);
  }

  it("the host's setting rides in hello, room and start; the guest takes it from each, and both build that battle", () => {
    const W = world();
    const host = open(W, true, { freeplay: 'tempest' });
    const guest = open(W, false);
    expect(host.freeplay).toBe('tempest');
    expect(guest.freeplay).toBe(null);
    W.connect(host.room);
    W.connect(guest.room);
    W.until(() => host.paired && guest.paired);
    expect(guest.freeplay).toBe('tempest'); // from the host's hello
    expect(lastMsg(host, 'hello').room).toEqual({ stageId: '1-2', difficulty: 'normal', freeplay: 'tempest', mode: 'standard' });
    expect(lastMsg(guest, 'hello').freeplay).toBe('tempest'); // what the guest's Ready would agree to
    // a change goes out at once
    host.setStage('1-3', 'hard', 'crimson');
    expect(lastMsg(host, 'room')).toEqual({ type: 'room', stageId: '1-3', difficulty: 'hard', freeplay: 'crimson', mode: 'standard' });
    W.step(200);
    expect([guest.stageId, guest.difficulty, guest.freeplay]).toEqual(['1-3', 'hard', 'crimson']);
    // left out it stays; anything that is not a tier is off
    host.setStage('1-1', 'normal');
    W.step(200);
    expect(guest.freeplay).toBe('crimson');
    for (const off of [null, 'toString', 'nightmare', true, { id: 'blossom' }]) {
      host.setStage('1-1', 'normal', off);
      expect(host.freeplay, String(off)).toBe(null);
    }
    W.step(200);
    expect(guest.freeplay).toBe(null);
    // a lost room message: the host's next keepalive hello carries the setting
    W.lose = (msg) => msg.type === 'room';
    host.setStage('1-1', 'normal', 'blossom');
    expect(W.until(() => guest.freeplay === 'blossom', LOBBY.keepaliveMs + 1000)).not.toBe(null);
    W.lose = () => false;
    startTogether(W, host, guest, 31);
    expect(host.lockstep.start.freeplay).toBe('blossom');
    expect(guest.lockstep.start).toEqual(host.lockstep.start);
    for (const s of [host, guest]) {
      expect(s.lockstep.sim.freeplay).toBe(true);
      expect(s.lockstep.sim.stage.freeplay.id).toBe('blossom');
      expect(s.lockstep.sim.totalWaves).toBe(12);
    }
    host.close();
    guest.close();
  });

  it("Ready is consent: a changed setting takes the guest's Ready back, and a Ready from before the change never starts the battle", () => {
    const W = world();
    const { host, guest } = paired(W);
    guest.setReady(true);
    W.until(() => host.canStart);
    // a stage change alone keeps the Ready (as before freeplay)
    host.setStage('1-3', 'normal');
    W.step(500);
    expect(guest.me.ready).toBe(true);
    expect(host.canStart).toBe(true);
    // the host turns freeplay on: Start locks at once, before any message has crossed
    host.setStage('1-3', 'normal', 'crimson');
    expect(host.canStart).toBe(false);
    expect(host.startBattle(5)).toBe(false);
    W.step(500);
    expect(guest.freeplay).toBe('crimson');
    expect(guest.me.ready).toBe(false);
    expect(host.peer.ready).toBe(false);
    guest.setReady(true);
    expect(W.until(() => host.canStart, 3000)).not.toBe(null);
    expect(host.peer.freeplay).toBe('crimson');
    // the race: the change does not reach the guest, whose keepalive hellos still say "ready" —
    // for Crimson Moon. That never counts for Tempest, until the guest saw Tempest and readied again
    W.lose = (msg) => msg.type === 'room';
    host.setStage('1-3', 'normal', 'tempest');
    let startable = false;
    const ms = W.until(() => {
      startable ||= host.canStart;
      return guest.freeplay === 'tempest';
    }, LOBBY.keepaliveMs * 2);
    expect(ms).not.toBe(null);
    expect(lastMsg(guest, 'hello').freeplay).toBe('crimson'); // (its keepalive hellos said ready, for crimson)
    W.step(1000);
    expect(startable || host.canStart).toBe(false);
    expect(guest.me.ready).toBe(false);
    W.lose = () => false;
    startTogether(W, host, guest, 6);
    expect(guest.lockstep.start.freeplay).toBe('tempest');
    host.close();
    guest.close();
  });

  it('protocol 13: a hello or a start message from a protocol-12 build (v0.1.60) is refused (the version banner)', () => {
    const W = world();
    const { host, guest } = paired(W, { freeplay: 'tempest' });
    const v = coopVersion();
    expect(v.proto).toBe(13);
    const old = { ...v, proto: 12, label: '0.1.60' };
    host.room.handlers.onMessage({ type: 'hello', player: { ...meOf('old-uid', 'Chi', ['aoi']), ready: true, host: false }, v: old, sees: null }, 'old-uid');
    expect(host.mismatch).toMatchObject({ uid: 'old-uid', theirs: { proto: 12, label: '0.1.60' } });
    expect(host.peer.uid).toBe(GUEST);
    // a start message from an old host never becomes a battle
    const players = [{ slot: 0, uid: HOST, name: 'Aiko', loadout: [], hero: null }, { slot: 1, uid: GUEST, name: 'Bea', loadout: [], hero: null }];
    guest.room.handlers.onMessage({ type: 'start', start: { v: old, seed: 1, stageId: '1-1', difficulty: 'normal', freeplay: 'tempest', players } }, HOST);
    expect(guest.phase).toBe('lobby');
    expect(guest.lockstep).toBe(null);
    host.close();
    guest.close();
  });

  it('"Back to the room" keeps the setting on both; the next battle starts with it again (and Off is a normal battle)', () => {
    const W = world();
    const { host, guest } = paired(W, { stageId: '1-1', difficulty: 'nightmare', freeplay: 'tempest' });
    startTogether(W, host, guest, 77);
    // nobody deploys on Nightmare: the first enemy through ends it (long before the goal)
    host.lockstep.queue('speed', [3]);
    host.lockstep.queue('wave');
    expect(play(W, [host, guest], () => host.lockstep.finished && guest.lockstep.finished)).toBe(true);
    expect(host.lockstep.sim.result()).toMatchObject({ won: false, freeplay: 'tempest', goalReached: false });
    expect(host.backToLobby()).toBe(true);
    W.step(1000);
    expect(guest.backToLobby()).toBe(true);
    expect(W.until(() => host.paired && guest.paired, 3000)).not.toBe(null);
    for (const s of [host, guest]) expect([s.stageId, s.difficulty, s.freeplay]).toEqual(['1-1', 'nightmare', 'tempest']);
    startTogether(W, host, guest, 78);
    expect(guest.lockstep.start).toMatchObject({ seed: 78, freeplay: 'tempest' });
    expect(guest.lockstep.sim.freeplay).toBe(true);
    // battle 3 with freeplay off: a plain co-op battle
    host.lockstep.queue('speed', [3]);
    host.lockstep.queue('wave');
    expect(play(W, [host, guest], () => host.lockstep.finished && guest.lockstep.finished)).toBe(true);
    host.backToLobby();
    guest.backToLobby();
    W.until(() => host.paired && guest.paired, 3000);
    host.setStage('1-1', 'nightmare', null);
    W.step(500);
    startTogether(W, host, guest, 79);
    expect(guest.lockstep.start.freeplay).toBe(null);
    for (const s of [host, guest]) expect(s.lockstep.sim.freeplay).toBe(false);
    host.close();
    guest.close();
  });

  it('a freeplay run one player leaves for the room plays on: the other hears how far it is, the one left finishes alone, then they pair again', () => {
    const W = world();
    const { host, guest } = paired(W, { stageId: '1-1', freeplay: 'blossom' });
    startTogether(W, host, guest, 90);
    // (both screens jump to the cleared goal the same way before any tick: no need to play 12
    // waves here — the lockstep tests do that)
    const goal = host.lockstep.sim.totalWaves;
    for (const s of [host, guest]) Object.assign(s.lockstep.sim, { wave: goal, wavesCleared: goal, state: 'between' });
    expect(play(W, [host, guest], () => host.lockstep.tick > 300 && guest.lockstep.tick > 300)).toBe(true);
    expect(guest.lockstep.coop.hash()).toBe(host.lockstep.coop.hash());
    // the guest goes back to the room while the run goes on
    expect(guest.backToLobby()).toBe(true);
    expect(guest.returning).toMatchObject({ uid: HOST, inRoom: false, fighting: null });
    const ls0 = sent(host, 'ls');
    expect(play(W, [host], () => !!guest.returning?.fighting, 3000)).toBe(true);
    expect(host.lockstep.peers.get(1)).toMatchObject({ gone: true, why: 'lobby' });
    expect(guest.returning.fighting).toEqual({ wave: goal, goal });
    // the host plays on alone for longer than peerSilentMs: no lockstep beats nobody needs, a
    // beacon every fightingMs, and the guest keeps waiting for it (no "lost contact")
    const f0 = sent(host, 'fighting');
    play(W, [host], () => false, 40000);
    expect(sent(host, 'ls')).toBe(ls0);
    expect(sent(host, 'fighting') - f0).toBeGreaterThanOrEqual(Math.floor(40000 / LOBBY.fightingMs) - 1);
    expect(sent(host, 'fighting') - f0).toBeLessThanOrEqual(Math.ceil(40000 / LOBBY.fightingMs) + 1);
    expect(guest.returning).toMatchObject({ uid: HOST, inRoom: false });
    expect(guest.lastPeer).toBe(null);
    expect(guest.stuck).toBe(null);
    // the next freeplay wave: the beacon says so
    host.lockstep.queue('wave');
    expect(play(W, [host], () => guest.returning?.fighting?.wave === goal + 1, LOBBY.fightingMs + 2000)).toBe(true);
    // the one left votes Finish: enough on her own (the guest's drop is a marker in the log)
    host.lockstep.queue('end', [true]);
    expect(play(W, [host], () => host.lockstep.finished, 3000)).toBe(true);
    expect(host.lockstep.sim.result()).toMatchObject({ won: true, finished: true, freeplay: 'blossom', goal, goalReached: true });
    W.step(1000);
    expect(guest.returning).toMatchObject({ uid: HOST, inRoom: false, fighting: null }); // her results screen now
    const f1 = sent(host, 'fighting');
    W.step(30000);
    expect(sent(host, 'fighting')).toBe(f1); // (none after the last one)
    expect(guest.returning).not.toBe(null); // its rest beats keep the guest waiting
    // back in the room: they pair again, same setting, and go again
    expect(host.backToLobby()).toBe(true);
    expect(W.until(() => host.paired && guest.paired, 3000)).not.toBe(null);
    expect([host.freeplay, guest.freeplay]).toEqual(['blossom', 'blossom']);
    startTogether(W, host, guest, 91);
    expect(guest.lockstep.start.freeplay).toBe('blossom');
    host.close();
    guest.close();
  });

  it('waiting in the room for longer than idleCloseMs while the ally\'s run goes on: its beacons keep the room open', () => {
    const W = world();
    const { host, guest } = paired(W, { stageId: '1-1', freeplay: 'blossom' });
    startTogether(W, host, guest, 92);
    const goal = host.lockstep.sim.totalWaves;
    for (const s of [host, guest]) Object.assign(s.lockstep.sim, { wave: goal, wavesCleared: goal, state: 'between' });
    expect(play(W, [host, guest], () => host.lockstep.tick > 300 && guest.lockstep.tick > 300)).toBe(true);
    expect(guest.backToLobby()).toBe(true);
    expect(play(W, [host], () => !!guest.returning?.fighting, 3000)).toBe(true);
    let left = false;
    host.on('ally', (where) => { if (where === 'left') left = true; });
    // (only the clock moves on the host's battle: it sits between waves, its beacon keeps coming)
    const t0 = W.clock.t;
    while (W.clock.t - t0 < LOBBY.idleCloseMs + 10 * 60000) play(W, [host], () => false, 60000);
    expect(guest.error).toBe(null);
    expect(guest.room.closed).toBe(false);
    expect(guest.returning).toMatchObject({ uid: HOST, inRoom: false, fighting: { wave: goal, goal } });
    expect(left).toBe(false);
    // the run ends: from its last beacon on the usual idle clock runs again
    host.lockstep.queue('end', [true]);
    expect(play(W, [host], () => host.lockstep.finished, 3000)).toBe(true);
    W.step(LOBBY.idleCloseMs + 60000);
    expect(guest.error).toMatchObject({ code: 'idle' });
    host.close();
    guest.close();
  });

  it("a lost 'lobby' message is said again while the ally's battle still beats: no 12 s stall, its beats stop, the beacon starts", () => {
    const W = world();
    const { host, guest } = paired(W, { stageId: '1-1', freeplay: 'blossom' });
    startTogether(W, host, guest, 93);
    const goal = host.lockstep.sim.totalWaves;
    for (const s of [host, guest]) Object.assign(s.lockstep.sim, { wave: goal, wavesCleared: goal, state: 'between' });
    expect(play(W, [host, guest], () => host.lockstep.tick > 300 && guest.lockstep.tick > 300)).toBe(true);
    W.lose = (msg) => msg.type === 'lobby';
    expect(guest.backToLobby()).toBe(true);
    W.lose = () => false;
    const t0 = W.clock.t;
    expect(play(W, [host], () => host.lockstep.peers.get(1).gone, 10000)).toBe(true);
    expect(W.clock.t - t0).toBeLessThan(LOBBY.lobbyEchoMs + 2000);
    expect(host.lockstep.peers.get(1).why).toBe('lobby');
    expect(sent(guest, 'lobby')).toBe(2); // the lost one and one repeat
    expect(play(W, [host], () => !!guest.returning?.fighting, 3000)).toBe(true);
    const ls0 = sent(host, 'ls');
    const tick0 = host.lockstep.tick;
    play(W, [host], () => false, 30000);
    expect(sent(host, 'ls')).toBe(ls0);
    expect(host.lockstep.tick - tick0).toBeGreaterThan(30 * 60 * 0.95);
    expect(sent(guest, 'lobby')).toBe(2);
    host.close();
    guest.close();
  });
});

// Battle modes (docs/specs/CODEX_MODES.md §6.4): the mode travels like freeplay — room, hello,
// ready and start — and a guest's Ready is consent to it; freeplay runs in Standard.
describe('co-op battle modes: the room setting', () => {
  const lastMsg = (s, type) => s.room.log.filter((e) => e.msg.type === type).at(-1)?.msg;
  function paired(W, hostExtra = {}) {
    const host = open(W, true, hostExtra);
    const guest = open(W, false);
    W.connect(host.room);
    W.connect(guest.room);
    expect(W.until(() => host.paired && guest.paired)).not.toBe(null);
    return { host, guest };
  }

  it('the mode rides in hello, room, ready and start; a changed mode clears Ready; both build that battle', () => {
    const W = world();
    const { host, guest } = paired(W, { mode: 'rush' });
    expect(host.mode).toBe('rush');
    expect(guest.mode).toBe('rush');
    expect(lastMsg(host, 'hello').room.mode).toBe('rush');
    guest.setReady(true);
    expect(W.until(() => host.canStart, 3000)).not.toBe(null);
    expect(lastMsg(guest, 'ready').mode).toBe('rush');
    host.setStage(host.stageId, host.difficulty, null, 'ironclad');
    expect(host.canStart).toBe(false);
    W.step(500);
    expect(guest.mode).toBe('ironclad');
    expect(guest.me.ready).toBe(false);
    guest.setReady(true);
    expect(W.until(() => host.canStart, 3000)).not.toBe(null);
    expect(host.startBattle(9)).toBe(true);
    expect(W.until(() => guest.phase === 'battle', 5000)).not.toBe(null);
    expect(guest.lockstep.start.mode).toBe('ironclad');
    for (const s of [host, guest]) expect(s.lockstep.sim.mode.id).toBe('ironclad');
    host.close();
    guest.close();
  });

  it('(i) setStage resets the mode to Standard on a stage the host has not cleared, and with Freeplay on', () => {
    const W = world();
    const host = open(W, true, { stageId: '1-2', mode: 'rush', modesUnlocked: (id) => id === '1-2' });
    expect(host.mode).toBe('rush');
    host.setStage('1-3', 'normal', null, 'rush');
    expect(host.mode).toBe('standard');
    host.setStage('1-2', 'normal', null, 'reverse');
    expect(host.mode).toBe('reverse');
    host.setStage('1-2', 'normal', 'tempest', 'reverse');
    expect(host.mode).toBe('standard');
    expect(lastMsg(host, 'room')).toMatchObject({ freeplay: 'tempest', mode: 'standard' });
    host.setStage('1-2', 'normal', null, 'nope');
    expect(host.mode).toBe('standard');
    host.close();
  });
});
