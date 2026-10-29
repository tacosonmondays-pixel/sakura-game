// A sentry's 'deploy' event reaches the renderer as 'deploy' (its kit rides as sentryType: a payload field named
// `type` overwrote the event's type, so the deploy pop never played) and src/render/deployFx.js draws it.
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { defaultData } from '../../src/sim/data.js';
import { addSentry, edgeSpots } from '../../src/sim/sentries.js';
import { deployFx, DEPLOY_COLOR } from '../../src/render/deployFx.js';
import { MAP, STAGE, ENEMIES } from '../sim/fixtures.js';

const units = defaultData().units;

function yuzuha() {
  const sim = new Sim({ stageId: STAGE.id, loadout: [{ unitId: 'yuzuha' }], seed: 7, data: { stage: STAGE, map: MAP, units, enemies: ENEMIES } });
  sim.cash = 1e9;
  const t = sim.placeTower('yuzuha', 9.5, 6.2);
  expect(t, 'placed').toBeTruthy();
  sim.drainEvents();
  return { sim, t };
}

function fakeFx() {
  const calls = [];
  return { calls, ring: (...a) => calls.push(['ring', ...a]), puff: (...a) => calls.push(['puff', ...a]) };
}

describe('deploy events', () => {
  test('a sentry set on the road arrives as a deploy event with her kit as sentryType', () => {
    const { sim, t } = yuzuha();
    const spot = edgeSpots(sim, t.x, t.y, t.eff.range)[0];
    const s = addSentry(sim, t, spot.x, spot.y);
    const evs = sim.drainEvents().filter((e) => e.kind === 'sentry');
    expect(evs).toHaveLength(1);
    expect(evs[0].type).toBe('deploy');
    expect(evs[0].sentryType).toBe(s.type);
    expect(typeof evs[0].sentryType).toBe('string'); // ('plain' at base; Specialist Kits: net, flak, heavy)
  });

  test('the deploy FX play on its spot: a safety-orange ring and a puff', () => {
    const { sim, t } = yuzuha();
    const spot = edgeSpots(sim, t.x, t.y, t.eff.range)[0];
    addSentry(sim, t, spot.x, spot.y);
    const fx = fakeFx();
    for (const ev of sim.drainEvents()) if (ev.type === 'deploy') deployFx(ev, fx);
    const ring = fx.calls.find((c) => c[0] === 'ring');
    expect(ring, 'a ring').toBeTruthy();
    expect(ring.slice(1, 3)).toEqual([spot.x, spot.y]);
    expect(ring[6]).toBe(DEPLOY_COLOR);
    expect(fx.calls.some((c) => c[0] === 'puff')).toBe(true);
  });

  test('nothing to draw without a spot', () => {
    expect(deployFx({ type: 'deploy' }, fakeFx())).toBe(false);
  });
});
