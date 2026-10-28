// Co-op freeplay at the command layer: start.freeplay builds the Sim, the 'end' Finish vote,
// and the compatibility bump (protocol 3: old and new builds refuse to pair).
import { describe, it, expect } from 'vitest';
import { createCoopSim, isValidCmd, KINDS } from '../../src/online/coop/commands.js';
import { coopVersion, sameVersion, COOP_PROTOCOL } from '../../src/online/coop/version.js';
import { FREEPLAY } from '../../src/data/freeplay.js';

const start = (freeplay) => ({
  seed: 77,
  stageId: '1-3',
  difficulty: 'normal',
  ...(freeplay === undefined ? {} : { freeplay }),
  players: [
    { slot: 0, uid: 'host', name: 'Host', loadout: [{ unitId: 'aoi' }], hero: { unitId: 'hikari' } },
    { slot: 1, uid: 'guest', name: 'Guest', loadout: [{ unitId: 'rei' }], hero: null },
  ],
});

let seq = 0;
const cmd = (p, k, a = [], t = 0) => ({ t, p, s: seq++, k, a });

/** Pretends the goal wave was just cleared. */
function atGoal(c) {
  c.sim.wave = c.sim.totalWaves;
  c.sim.wavesCleared = c.sim.totalWaves;
  c.sim.state = 'between';
}

describe('start.freeplay', () => {
  it('builds a freeplay Sim only for a real tier', () => {
    const c = createCoopSim(start('crimson'));
    expect(c.sim.freeplay).toBe(true);
    expect(c.sim.stage.freeplay).toBe(FREEPLAY.crimson);
    expect(c.sim.totalWaves).toBe(15);
    for (const off of [undefined, null, false, true, '', 'nightmare', 'toString', { id: 'blossom' }]) {
      const p = createCoopSim(start(off));
      expect(p.sim.freeplay, String(off)).toBe(false);
      expect(p.sim.stage.freeplay).toBeUndefined();
    }
  });

  it('two clients built from the same start agree (same waves past the goal)', () => {
    const a = createCoopSim(start('tempest'), { mySlot: 0 });
    const b = createCoopSim(start('tempest'), { mySlot: 1 });
    for (const w of [16, 40, 200]) expect(a.sim.waveInfo(w)).toEqual(b.sim.waveInfo(w));
    expect(a.hash()).toBe(b.hash());
  });
});

describe("the 'end' Finish vote", () => {
  it('is a command kind with a boolean argument', () => {
    expect(KINDS).toContain('end');
    expect(isValidCmd(cmd(0, 'end', [true]))).toBe(true);
    const c = createCoopSim(start('blossom'));
    atGoal(c);
    expect(c.apply(cmd(0, 'end', ['yes']))).toEqual({ ok: false, reason: 'invalid' });
    expect(c.apply(cmd(0, 'end', []))).toEqual({ ok: false, reason: 'invalid' });
    expect(c.endVotes()).toEqual([false, false]);
  });

  it('is a no-op before the goal and outside freeplay', () => {
    const c = createCoopSim(start('blossom'));
    c.sim.wave = 14;
    c.sim.wavesCleared = 14;
    c.sim.state = 'between';
    expect(c.apply(cmd(0, 'end', [true]))).toEqual({ ok: false, reason: 'notYet' });
    expect(c.apply(cmd(1, 'end', [true]))).toEqual({ ok: false, reason: 'notYet' });
    expect(c.endVotes()).toEqual([false, false]);
    expect(c.sim.state).toBe('between');
    const plain = createCoopSim(start());
    atGoal(plain);
    expect(plain.apply(cmd(0, 'end', [true])).ok).toBe(false);
  });

  it('ends the run once both vote (won, finished); a vote can be taken back', () => {
    const c = createCoopSim(start('blossom'));
    atGoal(c);
    expect(c.apply(cmd(0, 'end', [true])).ok).toBe(true);
    expect(c.sim.state).toBe('between');
    expect(c.endVotes()).toEqual([true, false]);
    expect(c.apply(cmd(0, 'end', [false])).ok).toBe(true);
    expect(c.apply(cmd(1, 'end', [true])).ok).toBe(true);
    expect(c.sim.state).toBe('between');
    expect(c.apply(cmd(0, 'end', [true])).ok).toBe(true);
    expect(c.sim.state).toBe('won');
    expect(c.sim.finished).toBe(true);
    expect(c.sim.result()).toMatchObject({ won: true, finished: true, freeplay: 'blossom', goalReached: true });
    // nothing more after the end
    expect(c.apply(cmd(1, 'end', [false]))).toEqual({ ok: false, reason: 'notYet' });
  });

  it('the one left can finish alone: a gone player does not block, in either order', () => {
    const a = createCoopSim(start('crimson'));
    atGoal(a);
    a.apply({ t: 0, p: 1, s: 0, k: 'gone', a: [] });
    expect(a.apply(cmd(0, 'end', [true])).ok).toBe(true);
    expect(a.sim.finished).toBe(true);

    const b = createCoopSim(start('crimson'));
    atGoal(b);
    expect(b.apply(cmd(0, 'end', [true])).ok).toBe(true);
    expect(b.sim.finished).toBe(false);
    b.apply({ t: 0, p: 1, s: 0, k: 'gone', a: [] }); // the guest drops: the host's vote is enough
    expect(b.sim.finished).toBe(true);

    // ...but a player who comes back has to agree again
    const c = createCoopSim(start('crimson'));
    atGoal(c);
    c.apply({ t: 0, p: 1, s: 0, k: 'gone', a: [] });
    c.apply({ t: 0, p: 1, s: 1, k: 'join', a: [] });
    expect(c.apply(cmd(0, 'end', [true])).ok).toBe(true);
    expect(c.sim.finished).toBe(false);
  });
});

describe('compatibility', () => {
  it('protocol 9 (the ultimates; v0.1.41 was 8, v0.1.40 7, v0.1.39 6, Potential v3 5, battle train C 4, freeplay 3): protocol-2 to -8 builds are refused, and the battle data hash covers the freeplay table', () => {
    expect(COOP_PROTOCOL).toBe(9);
    const v = coopVersion();
    expect(v.proto).toBe(9);
    expect(sameVersion(v, { ...v, proto: 8 })).toBe(false);
    expect(sameVersion({ ...v, proto: 8 }, v)).toBe(false);
    expect(sameVersion(v, { ...v, proto: 7 })).toBe(false);
    expect(sameVersion(v, { ...v, proto: 6 })).toBe(false);
    expect(sameVersion({ ...v, proto: 6 }, v)).toBe(false);
    expect(sameVersion(v, { ...v, proto: 5 })).toBe(false);
    expect(sameVersion({ ...v, proto: 5 }, v)).toBe(false);
    expect(sameVersion(v, { ...v, proto: 4 })).toBe(false);
    expect(sameVersion(v, { ...v, proto: 3 })).toBe(false);
    expect(sameVersion(v, { ...v, proto: 2 })).toBe(false);
    expect(sameVersion({ ...v, proto: 2 }, v)).toBe(false);
    expect(sameVersion(v, { ...v })).toBe(true);
  });
});

// Battle modes in co-op (docs/specs/CODEX_MODES.md §6.4, §10 "Co-op" (j)).
describe('co-op battle modes: the start message', () => {
  const base = (extra) => ({ ...start(undefined), stageId: '6-3', ...extra });
  it('a start without mode is Standard; only `mode` is read (rule, modeDef, ruleGoal, autoGeometry are ignored)', () => {
    expect(createCoopSim(base({})).sim.mode.id).toBe('standard');
    const a = createCoopSim(base({ mode: 'ironclad' }));
    const b = createCoopSim(base({ mode: 'ironclad', rule: null, modeDef: { armorByChapter: [9, 9, 9, 9, 9, 9, 9, 9, 9] }, ruleGoal: 1, autoGeometry: true }));
    expect(a.sim.mode.id).toBe('ironclad');
    expect(b.sim.rule.id).toBe('forge_vents');
    for (let i = 0; i < 60 * 40; i++) {
      if (a.sim.state !== 'wave') { a.sim.startNextWave(); b.sim.startNextWave(); }
      a.step();
      b.step();
    }
    expect(b.hash()).toBe(a.hash());
  });

  it('start.freeplay + start.mode = rush builds a Standard sim', () => {
    const c = createCoopSim({ ...start('blossom'), mode: 'rush' });
    expect(c.sim.freeplay).toBe(true);
    expect(c.sim.mode.id).toBe('standard');
  });

  it('two clients on 4-2 Reverse Route (Rear Ambush) and 6-3 Ironclad (vents) give equal hashes for 10 waves', () => {
    for (const [stageId, mode] of [['4-2', 'reverse'], ['6-3', 'ironclad']]) {
      const st = { ...start(undefined), stageId, mode, difficulty: 'easy' };
      const A = createCoopSim(st);
      const B = createCoopSim(JSON.parse(JSON.stringify(st)));
      let n = 0;
      while (A.sim.wave <= 10 && A.sim.state !== 'lost' && n++ < 60 * 60 * 20) {
        if (A.sim.state === 'prep' || A.sim.state === 'between') { A.sim.startNextWave(); B.sim.startNextWave(); }
        A.step();
        B.step();
        if (n % 600 === 0) expect(B.hash(), `${stageId} tick ${n}`).toBe(A.hash());
      }
      expect(A.sim.wave).toBeGreaterThan(3);
      expect(B.hash()).toBe(A.hash());
    }
  });
});
