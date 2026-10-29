// Kohaku's constant beam keeps the flash beam's DPS (src/sim/duo.js; the bench tools/duoBeam.mjs). OLD holds the
// bench's numbers recorded on the flash beam (b5c272e8, one flash every beamTicks(rate) steps), with the same
// rows: her beam alone (Tsubaki's shells held), the bench's strong preset without crits (a few dozen flashes are
// too few for a fair crit average), every Prism Corridor tier. A bench line per row is printed.
//   boss:  a boss walking through her reach, healed (one target at a time)
//   held:  the same boss parked in her reach from her first beam (Resonant Light's climb included)
//   crowd: a stream of grunts (pierce and the extra beams)
//   armor: an armoured boss with a crystal shell walking through (flat armour, the shell's cap)
// The walk-through rows run a little under the old numbers: the flash beam fired its first flash the moment a
// target came into reach (on average half a flash more per pass than the time it spent there), a constant beam
// deals exactly the time it holds. Held and crowd rows stay within 3 %, walk-throughs within 6 %.
import { describe, test, expect } from 'vitest';
import { duoBeamDps } from '../../tools/duoBeam.mjs';
import { POWER } from '../../src/data/balance.js';

const OLD = {
  c0: { boss: 5.76, held: 20.17, crowd: 82.92, armor: 5.16 },
  c1: { boss: 5.76, held: 20.17, crowd: 103.65, armor: 5.16 },
  c2: { boss: 6.4, held: 20.17, crowd: 103.65, armor: 5.74 },
  c3: { boss: 7.07, held: 22.27, crowd: 205.44, armor: 6.4 },
  c4: { boss: 10.56, held: 35.31, crowd: 218.17, armor: 8.52 },
  c5: { boss: 45.44, held: 151.68, crowd: 2919.8, armor: 9 },
};
const TOL = { boss: 0.06, held: 0.03, crowd: 0.03, armor: 0.06 };

describe('Kohaku\'s constant beam: DPS parity with the flash beam at every Prism Corridor tier', () => {
  for (const build of Object.keys(OLD)) {
    test(`${build}: every target within its tolerance`, () => {
      const lines = [];
      for (const target of Object.keys(TOL)) {
        const r = duoBeamDps({ build, target });
        // (× her balance round 5 damage row, src/data/balance.js: it reaches her beam too, her boss row does not. On the
        // armoured boss a hit is flat armour off, then capped by the crystal shell, so that row lands between the old
        // number and the old number × her row)
        const row = POWER.kohaku_tsubaki?.dmg ?? 1;
        const old = target === 'armor' ? OLD[build][target] : +(OLD[build][target] * row).toFixed(2);
        const d = r.dps / old - 1;
        lines.push(`${build} (${r.tiers}) ${target.padEnd(5)} old ${old} → new ${r.dps} dps (${d >= 0 ? '+' : ''}${(d * 100).toFixed(1)}%)`);
        if (target === 'armor') {
          expect(r.dps, `${build} armor: ${old} → ${r.dps}`).toBeGreaterThan(old * (1 - TOL.armor));
          expect(r.dps, `${build} armor: ${old} → ${r.dps}`).toBeLessThan(old * row * (1 + TOL.armor));
        } else expect(Math.abs(d), `${build} ${target}: ${old} → ${r.dps}`).toBeLessThan(TOL[target]);
      }
      console.log(lines.join('\n'));
    }, 60000);
  }

  test('the main path never touches her beam: Starfall tier 2 (Quick Reload) beams like Prism Corridor 2 alone', () => {
    for (const target of ['held', 'crowd']) expect(duoBeamDps({ build: 's2', target }).dps).toBe(duoBeamDps({ build: 'c2', target }).dps);
  }, 60000);
});
