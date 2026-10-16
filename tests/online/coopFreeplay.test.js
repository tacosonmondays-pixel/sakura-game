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
  it('protocol 4 (freeplay was 3): older builds are refused, and the battle data hash covers the freeplay table', () => {
    expect(COOP_PROTOCOL).toBe(4);
    const v = coopVersion();
    expect(v.proto).toBe(4);
    expect(sameVersion(v, { ...v, proto: 3 })).toBe(false);
    expect(sameVersion(v, { ...v, proto: 2 })).toBe(false);
    expect(sameVersion({ ...v, proto: 2 }, v)).toBe(false);
    expect(sameVersion(v, { ...v })).toBe(true);
  });
});
