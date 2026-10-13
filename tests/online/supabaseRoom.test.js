// The Supabase co-op room channel (adapters/supabase.js openRoom) against a scriptable fake of
// supabase-js: no presence, messages flushed the moment the channel joins, status reports, and
// self-healing (realtime-js's own rejoin, a fresh channel after CLOSED or when stuck, backoff,
// Retry). Fake timers; no network.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const UID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const net = { channels: [], listed: [], rpc: [], answers: {}, connected: true };

function fakeChannel(name, opts) {
  const ch = { name, opts, listeners: [], sent: [], state: 'closed', cb: null, removed: false, tracked: 0 };
  Object.assign(ch, {
    on(type, filter, cb) {
      ch.listeners.push({ type, filter, cb });
      return ch;
    },
    subscribe(cb) {
      ch.cb = cb;
      ch.state = 'joining';
      return ch;
    },
    /** the server's side of things: drives the status callback */
    emit(status) {
      ch.state = status === 'SUBSCRIBED' ? 'joined' : status === 'CLOSED' ? 'closed' : 'errored';
      ch.cb?.(status, status === 'CHANNEL_ERROR' ? new Error('channel_crash') : undefined);
    },
    deliver(msg, uid = 'bbbb') {
      for (const l of ch.listeners) if (l.type === 'broadcast') l.cb({ payload: { uid, msg } });
    },
    track: async () => {
      ch.tracked++;
      return 'ok';
    },
    send: (m) => {
      ch.sent.push(m.payload.msg);
      return Promise.resolve('ok');
    },
  });
  net.channels.push(ch);
  return ch;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { user: { id: UID } } }, error: null }),
      signInAnonymously: async () => ({ data: { user: { id: UID } }, error: null }),
    },
    from: () => {
      const p = new Proxy({}, { get: (_, k) => (k === 'then' ? (ok) => ok({ data: null, error: null }) : () => p) });
      return p;
    },
    rpc: (fn, args) => {
      net.rpc.push({ fn, args });
      return Promise.resolve({ data: net.answers[fn] ?? null, error: null });
    },
    // like realtime-js: a topic it still lists is handed back, and removing a channel forgets
    // every channel of that topic
    channel: (name, opts) => net.listed.find((c) => c.name === name) || (net.listed.push(fakeChannel(name, opts)), net.listed.at(-1)),
    getChannels: () => net.listed.map((c) => ({ ...c, topic: `realtime:${c.name}` })).map((x, i) => Object.assign(net.listed[i], { topic: x.topic })),
    removeChannel: (ch) => {
      ch.removed = true;
      net.listed = net.listed.filter((c) => c.name !== ch.name);
      ch.emit('CLOSED'); // realtime-js reports CLOSED to the subscriber as it leaves
      return Promise.resolve('ok');
    },
    realtime: { isConnected: () => net.connected },
  }),
}));

let mod;
let adapter;
beforeEach(async () => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0.5); // backoff jitter ×1.0
  net.channels.length = 0;
  net.listed = [];
  net.rpc.length = 0;
  net.connected = true;
  net.answers = { open_room: { code: 'K7Q2Z', secret: 'S1', host: true }, join_room: { code: 'K7Q2Z', secret: 'S1', host: false } };
  mod = await import('../../src/online/adapters/supabase.js');
  adapter = mod.createSupabaseAdapter({ url: 'https://example.supabase.co', key: 'public-anon-key' });
  await adapter.init();
  await adapter.signIn({ name: 'Aiko' });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const settle = () => vi.advanceTimersByTimeAsync(0);

async function openGuest(extra = {}) {
  const ev = { status: [], msgs: [], errors: [] };
  const room = adapter.openRoom('K7Q2Z', {
    host: false,
    onMessage: (m, uid) => ev.msgs.push([m, uid]),
    onStatus: (s, info) => ev.status.push([s, info?.rejoin ?? info?.reason ?? null]),
    onError: (e) => ev.errors.push(e.code),
    ...extra,
  });
  await settle();
  return { room, ev, ch: () => net.channels.at(-1) };
}

describe('supabase co-op room channel', () => {
  it('broadcast only (no presence, never track); queued messages go out the moment it joins', async () => {
    const { room, ev, ch } = await openGuest();
    expect(net.rpc.map((r) => r.fn)).toEqual(['join_room']);
    expect(ch().name).toBe('coop:K7Q2Z:S1');
    expect(ch().opts).toEqual({ config: { broadcast: { self: false, ack: false } } });
    expect(ch().listeners.map((l) => l.type)).toEqual(['broadcast']);
    expect(room.status).toBe('connecting');
    expect(room.connected).toBe(false);
    // before the join: a hello is dropped (state, re-sent on join), heartbeats keep only the newest
    expect(room.send({ type: 'hello' }, { drop: true })).toBe(false);
    room.send({ type: 'ls', m: { type: 'in', horizon: 1 } }, { latest: 'ls-in' });
    room.send({ type: 'ls', m: { type: 'in', horizon: 2 } }, { latest: 'ls-in' });
    room.send({ type: 'leave' });
    ch().emit('SUBSCRIBED');
    expect(ch().sent).toEqual([{ type: 'ls', m: { type: 'in', horizon: 2 } }, { type: 'leave' }]);
    expect(ev.status).toEqual([['connected', false]]);
    expect(room.connected).toBe(true);
    expect(room.send({ type: 'hello' }, { drop: true })).toBe(true);
    ch().deliver({ type: 'hello', player: { uid: 'bbbb' } });
    expect(ev.msgs).toEqual([[{ type: 'hello', player: { uid: 'bbbb' } }, 'bbbb']]);
    expect(ch().tracked).toBe(0);
    room.close();
  });

  it('a channel error: reports reconnecting, realtime-js rejoins the same channel, then "connected (rejoin)"', async () => {
    const { room, ev, ch } = await openGuest();
    const first = ch();
    first.emit('SUBSCRIBED');
    first.emit('CHANNEL_ERROR');
    expect(ev.status.at(-1)).toEqual(['reconnecting', 'CHANNEL_ERROR']);
    expect(room.connected).toBe(false);
    room.send({ type: 'start', start: 1 }, { latest: 'start' });
    room.send({ type: 'start', start: 2 }, { latest: 'start' });
    await vi.advanceTimersByTimeAsync(1000);
    first.emit('SUBSCRIBED'); // phoenix's rejoin timer brought it back
    expect(ev.status.at(-1)).toEqual(['connected', true]);
    expect(first.sent.at(-1)).toEqual({ type: 'start', start: 2 });
    expect(first.sent.filter((m) => m.type === 'start')).toHaveLength(1);
    expect(net.channels).toHaveLength(1); // no new channel
    expect(net.rpc).toHaveLength(1); // and no new seat
    room.close();
  });

  it('a closed channel is replaced by a fresh one (same secret) after a backoff', async () => {
    const { room, ev, ch } = await openGuest();
    const first = ch();
    first.emit('SUBSCRIBED');
    first.emit('CLOSED');
    expect(ev.status.at(-1)).toEqual(['reconnecting', 'closed']);
    await vi.advanceTimersByTimeAsync(700);
    expect(net.channels).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(600); // 1 s ± 20%
    expect(net.channels).toHaveLength(2);
    const second = ch();
    expect(second.name).toBe('coop:K7Q2Z:S1');
    await settle();
    expect(first.removed).toBe(true);
    second.emit('SUBSCRIBED');
    expect(ev.status.at(-1)).toEqual(['connected', true]);
    // the old channel's late events change nothing
    first.emit('CHANNEL_ERROR');
    expect(ev.status.at(-1)).toEqual(['connected', true]);
    expect(net.rpc).toHaveLength(1);
    room.close();
  });

  it('a channel that never joins is replaced after ROOM_STUCK_MS, with a growing backoff', async () => {
    const { room, ev } = await openGuest();
    expect(net.channels).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(mod.ROOM_STUCK_MS + 1300);
    expect(net.channels).toHaveLength(2);
    expect(room.status).toBe('connecting'); // never joined yet: still "connecting", nothing new to report
    expect(ev.status).toEqual([]);
    await vi.advanceTimersByTimeAsync(mod.ROOM_STUCK_MS + 1500);
    expect(net.channels).toHaveLength(2); // the second pause is ~2 s
    await vi.advanceTimersByTimeAsync(1000);
    expect(net.channels).toHaveLength(3);
    // the socket itself is down: wait for realtime-js to reconnect it instead of churning channels
    net.connected = false;
    await vi.advanceTimersByTimeAsync(3 * mod.ROOM_STUCK_MS);
    expect(net.channels).toHaveLength(3);
    net.connected = true;
    net.channels.at(-1).emit('SUBSCRIBED');
    expect(ev.status.at(-1)).toEqual(['connected', false]);
    room.close();
  });

  it('a rejoin loop (error, back, error…) never stacks timers or channels', async () => {
    const { room, ev, ch } = await openGuest();
    const c0 = ch();
    for (let i = 0; i < 10; i++) {
      c0.emit('SUBSCRIBED');
      await vi.advanceTimersByTimeAsync(5000);
      c0.emit('CHANNEL_ERROR');
      await vi.advanceTimersByTimeAsync(1000);
    }
    c0.emit('SUBSCRIBED');
    expect(net.channels).toHaveLength(1);
    expect(ev.status.filter(([s]) => s === 'connected')).toHaveLength(11);
    room.close();
  });

  it('Retry takes the seat again on a fresh channel; a room that is gone says so', async () => {
    const { room, ev, ch } = await openGuest();
    ch().emit('SUBSCRIBED');
    await room.reconnect();
    expect(net.rpc.map((r) => r.fn)).toEqual(['join_room', 'join_room']);
    expect(net.channels).toHaveLength(2);
    ch().emit('SUBSCRIBED');
    expect(ev.status.at(-1)).toEqual(['connected', true]);
    net.answers.join_room = { error: 'not_found' };
    await room.reconnect();
    expect(ev.errors).toEqual(['not_found']);
    expect(net.channels).toHaveLength(2);
    room.close();
  });

  it('a wrong code: not_found, and no channel at all', async () => {
    net.answers.join_room = { error: 'not_found' };
    const { ev } = await openGuest();
    expect(ev.errors).toEqual(['not_found']);
    expect(net.channels).toHaveLength(0);
  });

  it('close: leaves the channel and frees the seat, then stays quiet', async () => {
    const { room, ev, ch } = await openGuest();
    const c0 = ch();
    c0.emit('SUBSCRIBED');
    room.close();
    await settle();
    expect(c0.removed).toBe(true);
    expect(net.rpc.map((r) => r.fn)).toEqual(['join_room', 'leave_room']);
    const n = ev.status.length;
    await vi.advanceTimersByTimeAsync(60000);
    expect(ev.status).toHaveLength(n);
    expect(net.channels).toHaveLength(1);
    expect(room.send({ type: 'hello' })).toBe(false);
  });
});
