// The local adapter (two browser tabs = two players) driven in Node: a shared in-memory
// localStorage, one sessionStorage per "tab" and a fake BroadcastChannel hub. Then two co-op
// sessions over it go lobby → ready → start → lockstep battle with both players placing a
// girl, and their state hashes must match.
import { describe, it, expect, vi } from 'vitest';
import { createLocalAdapter } from '../../src/online/adapters/local.js';
import { openSession } from '../../src/online/coop/session.js';
import { quantize } from '../../src/online/coop/commands.js';
import { COOP } from '../../src/data/coop.js';
import { coopLoadout } from '../../src/online/coop/loadout.js';
import { supplyGrant, SUPPLY_MAX } from '../../src/online/supply.js';
import { createProfile } from '../../src/systems/save.js';
import { itemCount } from '../../src/systems/inventory.js';

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

/** BroadcastChannel stand-in: delivers to every other open instance with the same name. */
function bcHub() {
  const open = new Set();
  const queue = [];
  class FakeBC {
    constructor(name) {
      this.name = name;
      this.onmessage = null;
      open.add(this);
    }
    postMessage(data) {
      const copy = JSON.parse(JSON.stringify(data));
      for (const other of open) if (other !== this && other.name === this.name) queue.push(() => other.onmessage?.({ data: copy }));
    }
    close() {
      open.delete(this);
    }
  }
  return {
    BC: FakeBC,
    /** Delivers everything queued so far (and what those deliveries post in turn). */
    flush(max = 1000) {
      let n = 0;
      while (queue.length && n++ < max) queue.shift()();
    },
  };
}

async function twoTabs() {
  const hub = bcHub();
  const storage = memoryStorage();
  const tabA = createLocalAdapter({ storage, session: memoryStorage(), BC: hub.BC });
  const tabB = createLocalAdapter({ storage, session: memoryStorage(), BC: hub.BC });
  await tabA.init();
  await tabB.init();
  await tabA.signIn({ name: 'Aiko', level: 20, avatar: 'aoi' });
  await tabB.signIn({ name: 'Bea', level: 7, avatar: 'rei' });
  return { hub, tabA, tabB };
}

describe('local adapter (two tabs of one browser)', () => {
  it('gives each tab its own player and delivers chat live to the other tab', async () => {
    const { hub, tabA, tabB } = await twoTabs();
    expect(tabA.uid).not.toBe(tabB.uid);
    const got = [];
    const off = tabB.subscribe('global', (m) => got.push(m));
    await tabA.send('global', 'hello from A');
    hub.flush();
    expect(got.map((m) => [m.name, m.body])).toEqual([['Aiko', 'hello from A']]);
    await expect(tabA.send('global', 'too fast')).rejects.toMatchObject({ code: 'rate_limited' });
    off();
    expect((await tabB.history('global')).map((m) => m.body)).toEqual(['hello from A']);
  });

  it('clans: A founds, B finds and joins, both see two members; the dev code opens the sandbox clan', async () => {
    const { hub, tabA, tabB } = await twoTabs();
    const changes = vi.fn();
    const clan = await tabA.createClan({ name: 'Petal Squad', tag: 'PS', emblem: 'gems', joinMode: 'open' });
    tabA.subscribeClan(clan.id, changes);
    const found = await tabB.listClans({ query: 'petal' });
    expect(found.map((c) => c.tag)).toEqual(['PS']);
    await tabB.joinClan(found[0].id);
    hub.flush();
    expect(changes).toHaveBeenCalled();
    expect((await tabA.members(clan.id)).map((m) => m.name).sort()).toEqual(['Aiko', 'Bea']);
    expect((await tabB.myClan()).clan.memberCount).toBe(2);
    await tabB.leaveClan();
    const dev = await tabB.joinByCode('ROSIE777');
    expect(dev.isDev).toBe(true);
    expect((await tabA.listClans()).some((c) => c.isDev)).toBe(false);
  });

  it('co-op rooms: presence and messages between tabs', async () => {
    const { hub, tabA, tabB } = await twoTabs();
    const seenA = [];
    const presA = [];
    const roomA = tabA.openRoom('ABCDE', { meta: { name: 'Aiko' }, onMessage: (m) => seenA.push(m), onPresence: (p) => presA.push(p) });
    const roomB = tabB.openRoom('ABCDE', { meta: { name: 'Bea' }, onMessage: () => {}, onPresence: () => {} });
    const other = tabB.openRoom('ZZZZZ', { onMessage: () => {}, onPresence: () => {} });
    hub.flush();
    expect(roomA.peers().map((p) => p.name)).toEqual(['Bea']);
    expect(presA.at(-1).map((p) => p.uid)).toEqual([tabB.uid]);
    roomB.send({ type: 'ping' });
    other.send({ type: 'wrong-room' });
    hub.flush();
    expect(seenA).toEqual([{ type: 'ping' }]);
    expect(roomA.net).toEqual({ heartbeatMs: COOP.heartbeatMs, inputDelay: COOP.inputDelay });
    roomB.close();
    hub.flush();
    expect(roomA.peers()).toEqual([]);
    roomA.close();
    other.close();
  });

  it('a whole co-op handshake + battle over the local transport stays in sync', async () => {
    const { hub, tabA, tabB } = await twoTabs();
    const clock = { t: 1_000_000 };
    const timers = { setInterval: () => 0, clearInterval: () => {} }; // the test drives everything
    const loadout = (ids) => ids.map((unitId) => ({ unitId, stats: { costMul: 0.5 } }));
    const host = openSession({
      code: 'ROOM1', isHost: true, backend: tabA, stageId: '1-2', difficulty: 'normal', timers, now: () => clock.t,
      me: { uid: tabA.uid, name: 'Aiko', level: 20, avatar: 'aoi', loadout: loadout(['aoi', 'rei']), hero: { unitId: 'hikari', stats: {} } },
    });
    // two sessions in one process (two tabs): the second must not close the first
    const guest = openSession({
      code: 'ROOM1', isHost: false, backend: tabB, timers, now: () => clock.t, exclusive: false,
      me: { uid: tabB.uid, name: 'Bea', level: 7, avatar: 'rei', loadout: loadout(['yuki', 'rei']), hero: null },
    });
    hub.flush();
    expect(host.peer?.name).toBe('Bea');
    expect(guest.peer?.name).toBe('Aiko');
    expect(guest.stageId).toBe('1-2');
    expect(host.canStart).toBe(false);
    guest.setReady(true);
    hub.flush();
    expect(host.canStart).toBe(true);
    expect(host.startBattle(4242)).toBe(true);
    hub.flush();
    expect(guest.phase).toBe('battle');
    const [A, B] = [host.lockstep, guest.lockstep];
    expect(A.start).toEqual(B.start);
    expect(A.sim.towers.length).toBe(0);

    const spot = (ls, unitId, taken = []) => {
      for (let y = 0.6; y < ls.sim.map.height; y += 0.3) {
        for (let x = 0.6; x < ls.sim.map.width; x += 0.3) {
          if (!ls.sim.placementReason(unitId, x, y) && taken.every(([tx, ty]) => Math.hypot(tx - x, ty - y) > 1.2)) return [x, y];
        }
      }
      return null;
    };
    const a = spot(A, 'aoi');
    const b = spot(B, 'yuki', [a]);
    A.queue('place', ['aoi', ...quantize(...a)]);
    B.queue('place', ['yuki', ...quantize(...b)]);
    A.queue('wave');
    for (let f = 0; f < 60 * 8; f++) {
      clock.t += 1000 / 60;
      A.advance(1 / 60);
      B.advance(1 / 60);
      hub.flush();
    }
    expect(A.sim.towers.map((t) => t.unitId).sort()).toEqual(['aoi', 'yuki']);
    expect(B.sim.towers.map((t) => t.unitId).sort()).toEqual(['aoi', 'yuki']);
    expect(A.coop.ownerOf(A.sim.towers.find((t) => t.unitId === 'yuki').uid)).toBe(1);
    const pairs = A.hashPairs();
    expect(pairs.length).toBeGreaterThan(2);
    for (const p of pairs) expect(p.mine).toBe(p.theirs);
    expect(A.tick).toBeGreaterThan(400);
    expect(A.sim.state).toBe('wave');
    guest.close();
    hub.flush();
    host.close();
  });
});

describe('co-op loadout and the Supply Bot', () => {
  it('host brings the hero + 5 girls, the guest 6 girls and no hero', () => {
    const p = createProfile();
    for (const id of ['aoi', 'rei', 'yuki', 'momo', 'akane', 'kage', 'sango']) p.units[id] ||= { level: 1, stars: 1, awaken: 0, gear: {} };
    p.formation = { hero: 'hikari', towers: ['aoi', 'rei', 'yuki', 'momo', 'akane', 'kage', 'sango'] };
    const host = coopLoadout(p, true);
    const guest = coopLoadout(p, false);
    expect(host.hero?.unitId).toBe('hikari');
    expect(host.loadout.map((e) => e.unitId)).toHaveLength(COOP.towersPerPlayer);
    expect(guest.hero).toBe(null);
    expect(guest.loadout).toHaveLength(COOP.towersPerPlayer + 1);
    expect(guest.loadout[0].stats).toBeTruthy();
  });

  it('grants any item or currency in any quantity, and refuses nonsense', () => {
    const p = createProfile();
    const gems = itemCount(p, 'gems');
    expect(supplyGrant(p, 'gems', 5000)).toEqual([{ id: 'gems', count: 5000 }]);
    expect(itemCount(p, 'gems')).toBe(gems + 5000);
    expect(supplyGrant(p, 'ticket_recruit', '12')[0].count).toBe(12);
    expect(supplyGrant(p, 'gems', 1e15)[0].count).toBe(SUPPLY_MAX);
    expect(supplyGrant(p, 'gems', 0)).toBe(null);
    expect(supplyGrant(p, 'not_an_item', 5)).toBe(null);
  });
});
