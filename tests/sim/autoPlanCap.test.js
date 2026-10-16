// autoPlan (the balance bot's plan) honours one final tier per path per girl type: no campaign plan ever
// asks for a second copy of a girl to buy the same path's tier 5 (it would be refused in battle).
import { describe, it, expect } from 'vitest';
import { autoPlan } from '../../src/sim/headless.js';
import { STAGES } from '../../src/data/stages.js';

const ROSTERS = [
  ['hikari', 'aoi', 'rei', 'yuki', 'kage', 'akane'], // the golden battles' formation
  ['hikari', 'shiro', 'kage', 'aoi', 'sango', 'miko', 'midori', 'momo'],
];

describe('autoPlan and the one-per-path rule', () => {
  it('no plan contains two tier-5 buys of the same girl type and path', () => {
    let finals = 0;
    for (const st of STAGES.filter((s) => s.kind === 'campaign' || !s.kind)) {
      for (const units of ROSTERS) {
        const plan = autoPlan(st.id, units);
        const girls = new Map();
        const held = new Set();
        for (const a of plan) {
          const key = `${a.x},${a.y}`;
          if (a.action === 'place') girls.set(key, { unitId: a.unitId, tiers: [0, 0, 0] });
          else if (a.action === 'upgrade') {
            const g = girls.get(key);
            expect(g, `${st.id}: upgrade of an unplaced girl`).toBeTruthy();
            g.tiers[a.path]++;
            if (g.tiers[a.path] === 5 && g.unitId !== 'hikari') {
              const k = `${g.unitId}:${a.path}`;
              expect(held.has(k), `${st.id}: second tier 5 for ${k}`).toBe(false);
              held.add(k);
              finals++;
            }
          }
        }
      }
    }
    expect(finals).toBeGreaterThan(0);
  }, 240000);
});
