// Titan Trials battles (docs/specs/ASCENSION.md §C.2, gate W4): the stage and enemy overrides, the
// real Sim's spawned HP (titan and her splitter children), escorts that never use a titan's own ids,
// and the co-op hash rule (titans.js stays out of the sim / co-op import graph).
import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { ENEMY_MAP } from '../../src/data/enemies.js';
import { MAPS } from '../../src/data/maps.js';
import { TITANS, TITAN_TIERS, titanBattle, titanPoolHp, titanFamilyIds, createTitanTracker, tierStep, stepTier, parseTitanStageId, titanStageId } from '../../src/data/titans.js';
import { simId } from '../../tools/simId.mjs';

/** Run the real Sim until the titan is on the field (no towers; lives cannot run out). */
function spawnTitan(titanId, tier, rank = 0) {
  const b = titanBattle(titanId, tier, rank);
  const sim = new Sim({ stageId: b.stage.id, difficulty: 'normal', loadout: [], seed: 11, data: { stage: b.stage, enemies: b.enemies } });
  const tr = createTitanTracker(b);
  let titan = null;
  for (let i = 0; i < 40000 && !titan; i++) {
    if (sim.state === 'prep' || sim.state === 'between') sim.startNextWave();
    sim.lives = 1e9;
    sim.update(1 / 20);
    tr.consume(sim.drainEvents(), sim);
    titan = sim.enemies.find((e) => e.id === b.titanEnemy);
  }
  return { b, sim, tr, titan };
}

describe('titan battles', () => {
  it('four titans with two families each, every family covered', () => {
    expect(TITANS.map((t) => t.id)).toEqual(['foundry', 'regent', 'daimyo', 'wyrm']);
    const fams = new Set(TITANS.flatMap((t) => t.families));
    expect([...fams].sort()).toEqual(['blade', 'charm', 'cog', 'ember', 'feather', 'rime', 'rune']);
    for (const t of TITANS) {
      expect(ENEMY_MAP[t.enemy]?.tier).toBe('boss');
      expect(MAPS.some((m) => m.id === t.mapId)).toBe(true);
    }
  });

  it('escort pools never hold one of the titan\'s own ids, and every escort exists', () => {
    for (const t of TITANS) {
      const own = new Set(titanFamilyIds(t.id));
      const b = titanBattle(t.id, 'hard');
      for (const p of b.stage.waveGen.pool) {
        expect(ENEMY_MAP[p.enemy], p.enemy).toBeTruthy();
        expect(own.has(p.enemy), `${t.id}: ${p.enemy}`).toBe(false);
      }
      // the override map holds only the titan and her splitter children
      expect(Object.keys(b.enemies).every((id) => own.has(id))).toBe(true);
    }
  });

  it('stage ids are unique and parse back; the tier ladder round-trips', () => {
    const ids = new Set();
    for (const t of TITANS) for (const tier of TITAN_TIERS) ids.add(titanBattle(t.id, tier, tier === 'mayhem' ? 2 : 0).stage.id);
    expect(ids.size).toBe(16);
    expect(parseTitanStageId(titanStageId('wyrm', 'mayhem', 3))).toEqual({ titanId: 'wyrm', tier: 'mayhem', rank: 3 });
    expect(parseTitanStageId('1-1')).toBeNull();
    for (let s = 0; s < 8; s++) expect(tierStep(stepTier(s).tier, stepTier(s).rank)).toBe(s);
  });

  it('pool HP per §C.3, Mayhem +n × 1.3ⁿ', () => {
    expect(titanPoolHp('regent', 'nightmare')).toBe(38e6);
    expect(titanPoolHp('wyrm', 'normal')).toBe(1.2e6);
    expect(Math.round(titanPoolHp('foundry', 'mayhem', 3) / 1e6)).toBe(220);
  });

  it('W4: the real Sim spawns the titan and, when she falls, her children at exactly the pool HP', () => {
    for (const t of TITANS) {
      for (const tier of ['normal', 'nightmare', 'mayhem']) {
        const rank = tier === 'mayhem' ? 2 : 0;
        const { b, sim, tr, titan } = spawnTitan(t.id, tier, rank);
        expect(titan, `${t.id} ${tier}`).toBeTruthy();
        const want = titanPoolHp(t.id, tier, rank);
        const split = b.count * b.inherit;
        expect(Math.abs(titan.maxHp * (1 + split) - want) / want).toBeLessThan(0.01);
        // she falls: her splitter children come out at inherit × her HP
        sim._killEnemy(titan, null);
        tr.consume(sim.drainEvents(), sim);
        const kids = sim.enemies.filter((e) => e.id === b.child && e.parentUid === titan.uid);
        expect(kids.length, `${t.id} children`).toBe(b.count);
        for (const k of kids) expect(Math.abs(k.maxHp - titan.maxHp * b.inherit) / k.maxHp).toBeLessThan(0.01);
        const spawned = titan.maxHp + kids.reduce((a, k) => a + k.maxHp, 0);
        expect(Math.abs(spawned - want) / want, `${t.id} ${tier} spawned pool`).toBeLessThan(0.01);
        // the tracker: the titan fell (her HP is done), her children are still up
        const r = tr.read();
        expect(r.victory).toBe(false);
        expect(Math.abs(r.share - titan.maxHp / want)).toBeLessThan(0.01);
        // the children fall: a Victory
        for (const k of kids) sim._killEnemy(k, null);
        tr.consume(sim.drainEvents(), sim);
        expect(tr.read()).toMatchObject({ victory: true, share: 1 });
      }
    }
  }, 120000);

  it('M1 changes no co-op-hashed file: titans.js is not in the sim / co-op import graph', () => {
    const { files } = simId();
    expect(files).not.toContain('src/data/titans.js');
    expect(files.some((f) => f.includes('titan'))).toBe(false);
  });

  it('titans.js imports only data the co-op hash already covers', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../../src/data/titans.js', import.meta.url), 'utf8');
    const imports = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]).sort();
    expect(imports).toEqual(['../sim/waves.js', './enemies.js', './types.js']);
  });
});
