// The co-op lobby handshake (src/online/coop/session.js) over a fake room transport with a
// controllable network: latency, links that go down and come back, a "mute" link (the client
// believes it is joined but nothing it sends gets out: what a hung Realtime presence track did
// on some Supabase nodes), single lost messages. Simulated time throughout.
import { describe, it, expect } from 'vitest';
import { openSession, LOBBY } from '../../src/online/coop/session.js';
import { coopVersion } from '../../src/online/coop/version.js';

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
            close() {
              r.closed = true;
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

function open(W, isHost, extra = {}) {
  const uid = isHost ? HOST : GUEST;
  const s = openSession({
    code: 'ROOM1', isHost, backend: W.backend(uid), timers: W.timers, now: W.now, exclusive: false, stageId: '1-2',
    me: meOf(uid, isHost ? 'Aiko' : 'Bea', isHost ? ['aoi', 'rei'] : ['yuki', 'rei']),
    ...extra,
  });
  return s;
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
