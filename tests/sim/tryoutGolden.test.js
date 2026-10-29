// Golden Half Day and Full Day runs (docs/specs/TRYOUT_DAY.md §20.9): Extended Day turned the length tables' arrays into
// grid functions (src/sim/tryout/plan.js), and Half and Full must play exactly as before. Frozen from the code before
// that change: the plan, the stage and every in-stage wave for 50 seeds per length and Grade, and whole bot runs (every
// calm point's hashSim, coins, score, picks, squads, cards, the open offer and the assignments). Never re-freeze these
// to make an Extended Day change pass.
import { describe, it, expect } from 'vitest';
import { buildTryoutPlan, buildTryoutStage } from '../../src/sim/tryout/index.js';
import { generateWave } from '../../src/sim/waves.js';
import { ENEMY_MAP } from '../../src/data/enemies.js';
import { hashSim } from '../../src/online/coop/simHash.js';
import { runSolo, poolFor } from '../../tools/tryoutBot.mjs';

function fnv(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const look = (id) => ENEMY_MAP[id] || null;

/** One digest over 50 seeds' plans, stages and in-stage waves. */
function planDigest(length, grade) {
  const parts = [];
  for (let seed = 1; seed <= 50; seed++) {
    const plan = buildTryoutPlan({ seed: seed * 7919, grade, length });
    const stage = buildTryoutStage(plan, { coop: seed % 2 === 0 });
    const w = [];
    for (let n = 1; n <= stage.waves; n++) w.push(fnv(JSON.stringify(generateWave(stage, n, look, { pathCount: 1, pathLengths: [40] }))));
    parts.push(fnv(JSON.stringify(plan)) + fnv(JSON.stringify(stage)) + fnv(w.join('')));
  }
  return fnv(parts.join(''));
}

/** A bot run's calm points, folded into one digest. */
function runDigest({ seed, grade, length, strength = null, maxWaves = Infinity }) {
  const calm = [];
  const { sim } = runSolo({
    seed, grade, length, maxWaves, pool: strength ? poolFor(strength) : {},
    onCalm: (s) => {
      const ty = s.tryout;
      calm.push([s.wave, hashSim(s), Math.round(s.cash), ty.score, ty.periods.length,
        JSON.stringify(ty.players.map((p) => [p.picks, p.squad, p.cards, p.offer])), JSON.stringify(ty.assign)].join('|'));
    },
  });
  return { run: fnv(calm.join('\n')), wave: sim.wave, state: sim.state, calm };
}

describe('golden Half Day and Full Day', () => {
  const PLANS = {
    'half:1': '4fc0fec5', 'half:3': '287dec2f', 'half:6': 'ad044c96', 'half:8': 'd9b2bd9d', 'half:12': '40059c3e',
    'full:1': 'f51173ac', 'full:3': '5aaee99c', 'full:6': '17f91071', 'full:8': '573965ab', 'full:12': '4a55c380',
  };
  it('plans, stages and in-stage waves (50 seeds per length and Grade)', () => {
    for (const key of Object.keys(PLANS)) {
      const [length, grade] = key.split(':');
      expect(planDigest(length, +grade), key).toBe(PLANS[key]);
    }
  }, 60000);

  const RUNS = [
    { seed: 77, grade: 1, length: 'half', run: '2b80a063', wave: 28, state: 'won' },
    { seed: 1212, grade: 12, length: 'half', strength: 'maxed', run: 'f85067ef', wave: 12, state: 'lost' },
    // (re-pinned for attack shapes S3, not an Extended Day change: this run's bot takes Yuki to Frostbite T4, whose
    // attack becomes Rising Spikes; was '9161ea1d'; wave and outcome unchanged)
    { seed: 1201, grade: 6, length: 'full', strength: 'mid', run: 'f134cb88', wave: 48, state: 'won' },
  ];
  for (const r of RUNS) {
    it(`a whole ${r.length} run (seed ${r.seed}, Grade ${r.grade}) plays exactly as before`, () => {
      const got = runDigest(r);
      expect([got.wave, got.state]).toEqual([r.wave, r.state]);
      expect(got.run).toBe(r.run);
    }, 120000);
  }
});
