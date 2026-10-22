// Battle audio: the music state machine (wave → intensity, minibosses, boss takeover, results) and the
// per-frame SFX mapping fed with a real sim event stream.
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { initialBattleMusic, battleMusicStep, battleSfx, attachBattleAudio } from '../../src/audio/battle.js';
import { Sim } from '../../src/sim/Sim.js';
import { autoPlan } from '../../src/sim/headless.js';
import { hasRealData } from '../../src/sim/data.js';

const sprite = JSON.parse(readFileSync(new URL('../../public/audio/sfx/sprite.json', import.meta.url), 'utf8'));

function run(events, info = {}, theme = 'sakura') {
  let s = initialBattleMusic({ theme });
  const out = [];
  for (const ev of events) {
    const r = battleMusicStep(s, ev, info);
    s = r.state;
    out.push(r.actions);
  }
  return { state: s, actions: out };
}

describe('battle music state machine', () => {
  test('mount plays the family track, base only', () => {
    const { actions } = run([{ type: 'mount' }], {}, 'lake');
    expect(actions[0]).toEqual([{ do: 'play', track: 'battle_moonlit', stems: { base: 1, intensity: 0 }, transition: 'bar' }]);
  });
  test('wave start: no sting (silent), intensity fades in on the next beat; wave end calms down after 2 s', () => {
    const { state, actions } = run([{ type: 'mount' }, { type: 'waveStart', wave: 1 }, { type: 'waveEnd', wave: 1 }]);
    expect(actions[1].some((a) => a.do === 'stinger')).toBe(false);
    expect(actions[1]).toContainEqual({ do: 'stems', levels: { intensity: 1 }, quantize: 'beat', fadeBars: 1 });
    expect(actions[2]).toEqual([{ do: 'stems', levels: { intensity: 0 }, quantize: 'bar', fadeBars: 2, delay: 2, tag: 'calm' }]);
    expect(state.phase).toBe('between');
  });
  test('auto-start: the next wave cancels the pending calm-down and keeps intensity', () => {
    const { actions } = run([{ type: 'mount' }, { type: 'waveStart', wave: 1 }, { type: 'waveEnd', wave: 1 }, { type: 'waveStart', wave: 2 }]);
    expect(actions[3][0]).toEqual({ do: 'cancel', tag: 'calm' });
    expect(actions[3].some((a) => a.do === 'stems' && a.levels.intensity === 1)).toBe(true);
  });
  test('final wave starts silently too (no sting)', () => {
    let s = initialBattleMusic({});
    const r = battleMusicStep(s, { type: 'waveStart', wave: 20 }, { final: true });
    expect(r.actions.some((a) => a.do === 'stinger')).toBe(false);
  });
  test('miniboss: sting with a deep duck, intensity held until it dies', () => {
    const tierOf = (id) => ({ prince: 'miniboss', slime: 'normal' })[id];
    const { state, actions } = run([
      { type: 'mount' }, { type: 'spawn', uid: 5, id: 'prince' }, { type: 'waveEnd', wave: 1 }, { type: 'death', uid: 5, id: 'prince' },
    ], { tierOf });
    expect(actions[1]).toContainEqual({ do: 'stinger', id: 'miniboss', duck: -10 });
    expect(actions[1]).toContainEqual({ do: 'stems', levels: { intensity: 1 }, quantize: 'beat', fadeBars: 1 });
    expect(actions[2]).toEqual([]);                    // wave over but the miniboss lives: stay intense
    expect(actions[3]).toEqual([{ do: 'stems', levels: { intensity: 0 }, quantize: 'bar', fadeBars: 2 }]);
    expect(state.minis).toEqual([]);
  });
  test('boss takeover, phase 2 intensity, back to the family track after the boss falls', () => {
    const tierOf = () => 'boss';
    const { state, actions } = run([
      { type: 'mount' }, { type: 'waveStart', wave: 50 }, { type: 'spawn', uid: 9, id: 'grave_lych' }, { type: 'bossPhase', uid: 9 },
      { type: 'waveEnd', wave: 50 }, { type: 'death', uid: 9, id: 'grave_lych' },
    ], { tierOf });
    expect(actions[2]).toContainEqual({ do: 'boss', track: 'boss' });
    expect(actions[3]).toEqual([{ do: 'stems', levels: { intensity: 1 }, quantize: 'bar', fadeBars: 1 }]);
    expect(actions[4]).toEqual([]);                    // no calm-down while the boss track plays
    expect(actions[5]).toEqual([{ do: 'play', track: 'battle_blossom', stems: { base: 1, intensity: 0 }, transition: 'bar' }]);
    expect(state.boss).toBe(null);
  });
  test('the final boss gets the final track', () => {
    const r = battleMusicStep(initialBattleMusic({}), { type: 'spawn', uid: 1, id: 'dragon_ashwing' }, { tierOf: () => 'boss' });
    expect(r.actions).toContainEqual({ do: 'boss', track: 'final' });
  });
  test('victory / defeat: jingle chained into the results loop; nothing after the end', () => {
    const won = run([{ type: 'mount' }, { type: 'won' }, { type: 'waveStart', wave: 3 }]);
    expect(won.actions[1]).toContainEqual({ do: 'jingle', id: 'victory', then: 'results_win' });
    expect(won.actions[2]).toEqual([]);
    const lost = run([{ type: 'mount' }, { type: 'lost' }]);
    expect(lost.actions[1]).toContainEqual({ do: 'jingle', id: 'defeat', then: 'results_lose' });
  });
  test('co-op freeplay: the goal plays the victory sting without ending the music; the crossing a riser', () => {
    const { state, actions } = run([{ type: 'mount' }, { type: 'waveEnd', wave: 15 }, { type: 'goal', wave: 15 }, { type: 'waveStart', wave: 16 }]);
    expect(actions[2]).toEqual([{ do: 'stinger', id: 'victory', duck: -10 }]);
    expect(state.ended).toBe(false);
    expect(actions[3]).toContainEqual({ do: 'stems', levels: { intensity: 1 }, quantize: 'beat', fadeBars: 1 });
    const cross = battleMusicStep(initialBattleMusic({}), { type: 'waveStart', wave: 16 }, { crossing: true });
    expect(cross.actions).toContainEqual({ do: 'stinger', id: 'final_wave', duck: -6 });
  });
  test('pause ducks and muffles, resume restores (idempotent)', () => {
    const { actions } = run([{ type: 'pause' }, { type: 'pause' }, { type: 'resume' }, { type: 'resume' }]);
    expect(actions[0]).toEqual([{ do: 'duck', tag: 'pause', db: -8, lpf: 1200 }]);
    expect(actions[1]).toEqual([]);
    expect(actions[2]).toEqual([{ do: 'unduck', tag: 'pause' }]);
    expect(actions[3]).toEqual([]);
  });
});

describe('battle SFX mapping', () => {
  test('per-frame caps: ≤ 3 fire sounds (one per kind), ≤ 2 hits, ≤ 2 deaths', () => {
    const evts = [];
    for (let i = 0; i < 40; i++) evts.push({ type: 'attack', kind: ['arrow', 'bullet', 'orb', 'bolt'][i % 4], towerUid: i });
    for (let i = 0; i < 30; i++) evts.push({ type: 'hit', attackType: 'pierce', amount: i, x: i });
    evts.push({ type: 'hit', attackType: 'slash', crit: true, x: 3 });
    for (let i = 0; i < 12; i++) evts.push({ type: 'death', id: 'x', x: i });
    evts.push({ type: 'leak', id: 'x' }, { type: 'waveEnd' });
    const out = battleSfx(evts, { enemyDef: () => ({ tier: 'normal' }) });
    const n = (p) => out.filter((s) => p.test(s.id)).length;
    expect(n(/^fire\./)).toBe(3);
    expect(new Set(out.filter((s) => /^fire\./.test(s.id)).map((s) => s.id)).size).toBe(3);
    expect(n(/^hit\./)).toBe(2);
    expect(out.some((s) => s.id === 'hit.crit')).toBe(true);     // crits win the hit slots
    expect(n(/^en\.death/)).toBe(2);
    expect(out.some((s) => s.id === 'bt.leak')).toBe(true);      // flow sounds are never capped
    expect(out.some((s) => s.id === 'bt.waveClear')).toBe(true);
  });
  test('pan follows map position; turret shots are quieter; slash ramps', () => {
    const [a] = battleSfx([{ type: 'hit', attackType: 'holy', x: 20 }], { mapWidth: 20 });
    expect(a.pan).toBeCloseTo(0.5);
    const [b] = battleSfx([{ type: 'attack', kind: 'bullet', towerUid: 1, turretUid: 3 }], { towerX: () => 0, mapWidth: 20 });
    expect(b).toMatchObject({ id: 'fire.bullet', gain: -4, pan: -0.5 });
    const [c] = battleSfx([{ type: 'attack', kind: 'slash', ramp: 5 }], {});
    expect(c.rate).toBeCloseTo(1.15);
  });

  test.skipIf(!hasRealData())('a real sim event stream maps only to sprite ids, within caps', () => {
    const sim = new Sim({ stageId: '1-1', difficulty: 'easy', seed: 3, loadout: [{ unitId: 'hikari' }, { unitId: 'aoi' }, { unitId: 'rei' }], hero: null });
    for (const a of autoPlan('1-1', ['hikari', 'aoi', 'rei']).slice(0, 6)) sim.placeTower(a.unitId, a.x, a.y);
    const seen = new Set();
    let frames = 0;
    let maxFire = 0;
    for (let i = 0; i < 2400 && sim.state !== 'won' && sim.state !== 'lost'; i++) {
      if (sim.state === 'prep' || sim.state === 'between') sim.startNextWave();
      sim.update(1 / 20);
      const evts = sim.drainEvents();
      const out = battleSfx(evts, { mapWidth: sim.map.width, towerX: (u) => sim.getTower(u)?.x, enemyDef: (id) => sim.data.enemy(id), isHero: (u) => !!sim.getTower(u)?.isHero });
      maxFire = Math.max(maxFire, out.filter((s) => /^(fire|atk)\./.test(s.id)).length);
      for (const s of out) seen.add(s.id);
      frames++;
    }
    expect(frames).toBeGreaterThan(100);
    expect(seen.size).toBeGreaterThan(4);
    expect(maxFire).toBeLessThanOrEqual(3);
    for (const id of seen) expect(sprite.sounds[id], id).toBeTruthy();
  }, 60000);
});

describe('attachBattleAudio (Node, no engine)', () => {
  test('is inert without an audio engine and restores wrapped actions', () => {
    const calls = [];
    const ctx = { sim: { map: { theme: 'foundry', width: 20 }, data: { enemy: () => null } }, speed: 1, paused: false,
      openPause() { calls.push('open'); }, closePause() { calls.push('close'); }, feed: { push: () => calls.push('feed') } };
    const orig = ctx.openPause;
    const a = attachBattleAudio(ctx);
    expect(a.state().track).toBe('battle_ironclock');
    ctx.openPause();
    a.events([{ type: 'waveStart', wave: 1 }, { type: 'attack', kind: 'arrow' }]);
    expect(a.state().phase).toBe('wave');
    a.destroy();
    expect(ctx.openPause).toBe(orig);
    expect(calls).toEqual(['open']);
  });
});

describe('ability cues (ABILITIES_SPEC §8.5)', () => {
  test('a cast maps by kind to an existing sprite; at most two a frame', async () => {
    const { ABILITY_SFX } = await import('../../src/audio/battle.js');
    for (const [kind, s] of Object.entries(ABILITY_SFX)) expect(sprite.sounds[s.id], `${kind} → ${s.id}`).toBeTruthy();
    const evs = ['strike', 'burst', 'rally', 'econ'].map((kind, i) => ({ type: 'ability', kind, towerUid: i, x: 3 }));
    const out = battleSfx(evs, { mapWidth: 20 });
    expect(out.length).toBe(2);
    for (const o of out) expect(Object.values(ABILITY_SFX).map((s) => s.id)).toContain(o.id);
    expect(battleSfx([{ type: 'ability', kind: 'move' }], {})).toEqual([]);
  });

  test('the ready chime: your own only, at most one per 1.5 s', async () => {
    const { ABILITY_READY_MS, resetAbilityReadyThrottle } = await import('../../src/audio/battle.js');
    resetAbilityReadyThrottle();
    let t = 1000;
    const info = { now: () => t, isMine: (ev) => ev.towerUid !== 9 };
    const ready = (towerUid) => battleSfx([{ type: 'abilityReady', towerUid, id: 'x' }], info);
    expect(ready(9)).toEqual([]); // the ally's
    const first = ready(1);
    expect(first.length).toBe(1);
    expect(sprite.sounds[first[0].id]).toBeTruthy();
    t += ABILITY_READY_MS - 1;
    expect(ready(2)).toEqual([]);
    t += 1;
    expect(ready(2).length).toBe(1);
  });
});
