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
            uid, code, handlers, up: false, closed: false, mute: false, deaf: false, outbox: [], log: [], reconnects: 0, status: 'connecting',
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
            reconnect() {
              r.reconnects++;
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

  it('a mute host (its messages never get out) is found as soon as its link works again — no reconnect needed', () => {
    const W = world();
    const host = open(W, true);
    W.connect(host.room);
    host.room.mute = true; // joined as far as the client knows, but the server forwards nothing
    const guest = open(W, false);
    W.connect(guest.room);
    W.step(8000);
    expect(host.peer?.name).toBe('Bea'); // the host hears the guest…
    expect(guest.peer).toBe(null); // …but the guest never hears the host
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

  it('an ally silent for 10 s has left — but not while my own link is down', () => {
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
    const ms = W.until(() => !host.peer, 20000);
    expect(ms).toBeGreaterThanOrEqual(LOBBY.peerSilentMs - LOBBY.keepaliveMs);
    expect(ms).toBeLessThanOrEqual(LOBBY.peerSilentMs + LOBBY.tickMs);
    expect(host.canStart).toBe(false);
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

  it('a code with a typo still says "No room uses that code"', () => {
    const W = world();
    W.refuse.TYP0S = 'not_found';
    const guest = openSession({ code: 'TYP0S', isHost: false, backend: W.backend(GUEST), timers: W.timers, now: W.now, exclusive: false, me: meOf(GUEST, 'Bea', ['yuki']) });
    W.step(100);
    expect(guest.error?.code).toBe('not_found');
    expect(guest.error.text).toMatch(/^No room uses that code/);
    W.step(LOBBY.findMs + 1000);
    expect(guest.stuck).toBe(null); // the error says it all
    guest.close();
  });

  it('keeps the lobby cheap: ~1 hello per 3 s once paired, one per 2 s for a host waiting alone', () => {
    const W = world();
    const host = open(W, true);
    W.connect(host.room);
    W.step(60000);
    const alone = hellos(host);
    expect(alone).toBeGreaterThanOrEqual(25);
    expect(alone).toBeLessThanOrEqual(32);
    const guest = open(W, false);
    W.connect(guest.room);
    W.until(() => host.paired && guest.paired);
    const [h0, g0] = [hellos(host), hellos(guest)];
    W.step(60000);
    expect(hellos(host) - h0).toBeLessThanOrEqual(22);
    expect(hellos(guest) - g0).toBeLessThanOrEqual(22);
    expect(host.paired && guest.paired).toBe(true);
    host.close();
    guest.close();
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
