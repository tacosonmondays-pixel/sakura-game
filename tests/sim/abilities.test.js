// Activated abilities in the sim (src/sim/abilities.js; ABILITIES_SPEC §3–§6, BUILD_PLAN §3.8): unlock and
// the first charge, charging only in waves, every refusal (none spends the cooldown), each A1 kind
// (strike, burst, boost, rally, debuff, econ), the CC guard, the wave-end and sale clean-up, group casts,
// map-scope cooldowns per player, auto-cast (each `when`), Skill Haste, owner-credited coins, and determinism.
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { UNITS, ENEMIES, STAGE, testData, run } from './fixtures.js';
import { STEP, KNOCKBACK_RESIST, CC_RESIST, ABILITY_SCATTER, DOT_PCT_BOSS_MUL } from '../../src/sim/constants.js';
import { ABILITY_RULES } from '../../src/data/abilities.js';
import { typeMultiplier } from '../../src/data/types.js';
import { refreshEffective, towerResolvedStats } from '../../src/sim/towers.js';
import { abilityDef, abilityPathOf, chargeRate, densestPoint, abilitySpec, autoWants, ABILITY_KINDS_LIVE } from '../../src/sim/abilities.js';
import { autoPlan } from '../../src/sim/headless.js';
import { samplePath } from '../../src/sim/path.js';
import { defaultData } from '../../src/sim/data.js';
import { xpToReach, gainHeroXp } from '../../src/sim/hero.js';
import { snapshotDigest } from '../../src/sim/snapshot.js';
import { rederiveStats } from '../../src/online/coop/lockstep.js';

const S = {
  stun: (d) => ({ type: 'stun', duration: d }),
  freeze: (d) => ({ type: 'freeze', duration: d }),
  slow: (a, d) => ({ type: 'slow', amount: a, duration: d }),
  silence: (d) => ({ type: 'silence', duration: d }),
  reveal: (d) => ({ type: 'reveal', duration: d }),
  mark: (b, d) => ({ type: 'mark', bonus: b, duration: d }),
};
const flat = (id) => ({ id, name: id, focus: id, tiers: [1, 2, 3, 4, 5].map((k) => ({ name: `${id}${k}`, cost: 100, desc: id, mods: {} })) });
/** A fixture girl with her ⚡ ability on path `p` (flat tiers: her stats never change with them). */
function girl(id, from, ability, extra = {}, p = 0) {
  const u = UNITS[from];
  const paths = [flat(`${id}A`), flat(`${id}B`), flat(`${id}C`)];
  paths[p] = { ...paths[p], ability: { path: paths[p].id, unlockTier: 3, scope: 'local', duration: 0, ...ability } };
  return { ...u, ...extra, id, name: id, paths, base: { ...u.base, ...(extra.base || {}) } };
}

const XU = {
  ...UNITS,
  volley: girl('volley', 'archer', {
    id: 'volley.rain', kind: 'strike', cooldown: 30,
    effect: { pick: 'mode', count: 3, reachMul: 1.5, dmgMul: 4, status: [S.stun(0.5)] },
    auto: { when: 'enemies', min: 3, orElite: true },
    t5: { cooldown: 20, effect: { count: 5, dmgMul: 6 } },
  }),
  spinner: girl('spinner', 'archer', {
    id: 'spinner.spin', kind: 'boost', cooldown: 30, duration: 4,
    effect: { mods: { rateMul: 2, range: 0.5, maxTargets: 99 } }, auto: { when: 'enemies', min: 1 },
  }),
  cheer: girl('cheer', 'archer', {
    id: 'cheer.chorus', kind: 'rally', cooldown: 40, duration: 5,
    effect: { radius: 3, dmgMul: 1.3, rateMul: 1.2 }, auto: { when: 'enemies', min: 2 },
  }),
  cheer2: girl('cheer2', 'archer', {
    id: 'cheer2.song', kind: 'rally', cooldown: 40, duration: 5,
    effect: { radius: 3, dmgMul: 1.1, rateMul: 1.4, cleanse: true, ward: true }, auto: { when: 'enemies', min: 2 },
  }),
  mortar: girl('mortar', 'bomber', {
    id: 'mortar.shell', kind: 'burst', cooldown: 40,
    effect: { at: 'densest', reachMul: 1.5, radius: 1.2, dmgMul: 3, knockback: 0.5, status: [S.stun(0.5)] },
    auto: { when: 'enemies', min: 3 },
  }, { base: { canHitAir: true } }),
  barrage: girl('barrage', 'bomber', {
    id: 'barrage.fire', kind: 'burst', cooldown: 40, duration: 2,
    effect: { at: 'densest', reachMul: 1.5, shells: 4, delay: 0.5, every: 0.25, radius: 1, dmgMul: 2 },
    auto: { when: 'enemies', min: 3 },
  }),
  frost: girl('frost', 'archer', {
    id: 'frost.whiteout', kind: 'burst', cooldown: 40,
    effect: { at: 'self', radiusMul: 1, status: [S.freeze(2), S.slow(0.4, 5)] }, auto: { when: 'enemies', min: 4 },
  }, { element: 'frost', base: { element: 'frost' } }),
  hush: girl('hush', 'archer', {
    id: 'hush.prayer', kind: 'debuff', scope: 'map', cooldown: 45, duration: 3,
    effect: { pick: 'all', status: [S.silence(3), S.reveal(6)], casterStatus: [S.stun(1)] }, auto: { when: 'caster', orVeiled: true },
  }),
  marker: girl('marker', 'archer', {
    id: 'marker.brand', kind: 'debuff', scope: 'map', cooldown: 30, duration: 8,
    effect: { pick: 'strong', count: 2, status: [S.mark(0.2, 8)] }, auto: { when: 'enemies', min: 5, orElite: true },
  }),
  verdict: girl('verdict', 'archer', {
    id: 'verdict.round', kind: 'strike', scope: 'map', cooldown: 45, duration: 1,
    effect: { pick: 'priority', count: 2, reach: 'map', delay: 1, dmgMul: 5, armorPen: 99 }, auto: { when: 'elite', orCaster: true },
  }),
  market: girl('market', 'banker', {
    id: 'market.day', kind: 'econ', scope: 'player', cooldown: 45,
    effect: { coins: 100 }, auto: { when: 'ready' }, t5: { cooldown: 40, effect: { coins: 400 } },
  }),
  catalyst: girl('catalyst', 'archer', {
    id: 'catalyst.burst', kind: 'strike', cooldown: 30,
    effect: { pick: 'poisoned', reachMul: 1.5, poisonMul: 2, splash: 0.8, splashShare: 0.5 }, auto: { when: 'poisoned', min: 2 },
  }, { base: { status: [{ type: 'poison', dps: 5, duration: 6 }] } }),
  lunger: girl('lunger', 'duelist', {
    id: 'lunger.flash', kind: 'strike', cooldown: 25,
    effect: { pick: 'mode', count: 1, reachMul: 2.5, hits: 5, dmgMul: 1, fullRamp: true, keepRamp: true }, auto: { when: 'enemies', min: 3, orElite: true },
  }),
  later: girl('later', 'archer', {
    id: 'later.doubles', kind: 'deploy', cooldown: 40, duration: 8, effect: { deploy: 'double', count: 2, spacing: 1.5, dmgMul: 0.6 }, auto: { when: 'enemies', min: 4 },
  }),
  zero: girl('zero', 'archer', {
    id: 'zero.now', kind: 'strike', unlockTier: 0, cooldown: 30, effect: { pick: 'mode', count: 1, reachMul: 1, dmgMul: 2 }, auto: { when: 'enemies', min: 1 },
  }),
  // Lantern Flare's shape: a map debuff on veiled enemies with a rally rider on the girls in her own aura
  // (an aura without Veil Sight or reach, so the rider's are the only ones)
  lantern: girl('lantern', 'chime', {
    id: 'lantern.flare', kind: 'debuff', scope: 'map', cooldown: 40, duration: 8,
    effect: { pick: 'veiled', status: [S.reveal(8)], rally: { inAura: true, rangeMul: 1.15, detection: true } },
    auto: { when: 'veiled' },
  }, { base: { aura: { range: 3, dmgMul: 1.1 } } }),
  // a salvo whose later shells re-aim at the densest crowd when they fire (Tidebreaker T5's shape)
  salvo: girl('salvo', 'bomber', {
    id: 'salvo.fire', kind: 'burst', cooldown: 40, duration: 1.25,
    effect: { at: 'densest', reachMul: 2, shells: 3, every: 0.5, radius: 1, dmgMul: 1, reaim: true },
    auto: { when: 'enemies', min: 5 },
  }),
  // Catalyst T5's shape: her poison spreads to the neighbours of each burst
  catalyst5: girl('catalyst5', 'archer', {
    id: 'catalyst5.burst', kind: 'strike', cooldown: 25,
    effect: { pick: 'poisoned', reachMul: 1.5, poisonMul: 2.5, splash: 0.8, splashShare: 0.5, spreadPoison: 3 },
    auto: { when: 'poisoned', min: 4 },
  }, { base: { status: [{ type: 'poison', dps: 5, duration: 6 }] } }),
  // a cleanse without a ward: only the cast itself clears sabotage
  cheer3: girl('cheer3', 'archer', {
    id: 'cheer3.call', kind: 'rally', cooldown: 40, duration: 5,
    effect: { radius: 3, rateMul: 1.1, cleanse: true }, auto: { when: 'enemies', min: 2 },
  }),
  // the leak rules: `orLeak` beside a crowd count, and `leak` alone (its default share, 0.7)
  sentry: girl('sentry', 'archer', {
    id: 'sentry.shot', kind: 'strike', cooldown: 30,
    effect: { pick: 'mode', count: 1, reachMul: 1, dmgMul: 1 }, auto: { when: 'enemies', min: 6, orLeak: 0.7 },
  }),
  warden: girl('warden', 'archer', {
    id: 'warden.shot', kind: 'strike', cooldown: 30,
    effect: { pick: 'mode', count: 1, reachMul: 1, dmgMul: 1 }, auto: { when: 'leak' },
  }),
  sage: {
    ...UNITS.warper, id: 'sage', name: 'sage',
    hero: {
      ...UNITS.warper.hero,
      skill: {
        unlockLevel: 7, id: 'sage.net', kind: 'burst', scope: 'local', cooldown: 25, duration: 0,
        effect: { at: 'densest', reachMul: 1, radius: 1.6, status: [S.freeze(1.2)] }, auto: { when: 'enemies', min: 2 },
        ranks: [{ level: 17, cooldown: 20, effect: { radius: 2 } }],
      },
    },
  },
};
const XE = {
  ...ENEMIES,
  frostward: { ...ENEMIES.tank, id: 'frostward', ward: undefined, traits: { ward: 'frost' } },
  mini: { ...ENEMIES.tank, id: 'mini', tier: 'miniboss' },
};
const QUIET = { ...STAGE, waves: 5, waveGen: { pool: [], budget: { start: 1, growth: 1 } } };
const TOWERS = Object.keys(XU).filter((id) => XU[id].kind === 'tower');

/** Spots beside the path (centre line y 4.5) on the 16 × 9 test map. */
const AT = { a: [8.5, 3.4], b: [10.5, 3.4], c: [8.5, 5.6], d: [10.5, 5.6], e: [12.5, 5.6], f: [6.5, 3.4], far: [1.5, 7.5] };

function mk({ difficulty = 'normal', options = {}, hero = null, stats = null, seed = 5 } = {}) {
  const sim = new Sim({
    stageId: QUIET.id, difficulty, seed, options,
    loadout: TOWERS.map((unitId) => ({ unitId, stats: stats?.[unitId] })),
    hero: hero ? { unitId: hero, stats: stats?.[hero] } : null,
    data: testData({ stage: QUIET, units: XU, enemies: XE }),
  });
  sim.cash = 1e9;
  return sim;
}
const place = (sim, id, at) => {
  const t = sim.placeTower(id, ...AT[at]);
  expect(t, `${id} at ${at}`).toBeTruthy();
  return t;
};
/** Buys tiers on one path. */
const up = (sim, t, path, n) => {
  for (let i = 0; i < n; i++) expect(sim.upgradeTower(t.uid, path), `${t.unitId} path ${path}`).toBe(true);
  return t;
};
const unlocked = (sim, id, at, tiers = 3) => up(sim, place(sim, id, at), 0, tiers);
/** A wave with nothing scheduled, held open by a parked tank far back on the road. */
function wave(sim) {
  sim.state = 'wave';
  sim.wave = Math.max(1, sim.wave);
  sim._spawnQueue = [];
  sim._spawnIndex = 0;
  park(sim, 'tank', 0.2);
}
function park(sim, id, dist) {
  const e = sim.spawnEnemy(id, { dist });
  e.baseSpeed = 0;
  e.speed = 0;
  return e;
}
const events = (sim, type) => sim.drainEvents().filter((e) => e.type === type);
const eff = (t) => JSON.parse(JSON.stringify(t.eff));

describe('unlock, upgrade and the first charge', () => {
  test('tier 3 of the ⚡ path unlocks it (an event) with 1/3 of the cooldown left; tiers 1–2 do not', () => {
    const sim = mk();
    const t = place(sim, 'volley', 'a');
    up(sim, t, 0, 2);
    expect(t.abil).toBeUndefined();
    expect(t.abilMods).toBeUndefined();
    sim.drainEvents();
    up(sim, t, 0, 1);
    const cdMax = 30 * ABILITY_RULES.ticksPerSecond * ABILITY_RULES.chargePerTick;
    expect(t.abil).toEqual({ id: 'volley.rain', kind: 'strike', scope: 'local', cdMax, cd: Math.round(cdMax / 3), rate: 100, active: 0, auto: false, t5: false, n: 0 });
    expect(t.abilMods).toBeNull();
    expect(events(sim, 'abilityUnlock')).toEqual([{ type: 'abilityUnlock', towerUid: t.uid, id: 'volley.rain', kind: 'strike', owner: 0 }]);
    expect(sim._abilOn).toBe(1);
  });

  test('another path to tier 3 never unlocks it, and a girl without a ⚡ path never carries the fields', () => {
    const sim = mk();
    const t = up(sim, place(sim, 'volley', 'a'), 1, 3);
    expect(t.abil).toBeUndefined();
    const plain = up(sim, place(sim, 'archer', 'b'), 0, 3);
    expect('abil' in plain).toBe(false);
    expect(sim.abilityStatus(plain.uid)).toBeNull();
  });

  test('tier 5 merges the upgrade; the cooldown left becomes min(left, new full)', () => {
    const sim = mk();
    const t = unlocked(sim, 'volley', 'a');
    t.abil.cd = t.abil.cdMax; // as if just cast
    up(sim, t, 0, 1);
    expect(t.abil.t5).toBe(false);
    sim.drainEvents();
    up(sim, t, 0, 1);
    expect(t.abil.cdMax).toBe(20 * 6000);
    expect(t.abil.cd).toBe(20 * 6000);
    expect(t.abil.t5).toBe(true);
    expect(abilityDef(t).effect).toMatchObject({ count: 5, dmgMul: 6, reachMul: 1.5 });
    expect(events(sim, 'abilityUpgrade')).toHaveLength(1);
  });

  test('an econ ability starts empty; a fixture girl unlocking at tier 0 has hers on placement', () => {
    const sim = mk();
    const m = unlocked(sim, 'market', 'far');
    expect(m.abil.cd).toBe(m.abil.cdMax);
    const z = place(sim, 'zero', 'b');
    expect(z.abil.cd).toBe(Math.round(z.abil.cdMax / 3));
  });

  test('a deploy ability (A4) stays locked: the teaser says it comes later', () => {
    const sim = mk();
    const t = unlocked(sim, 'later', 'a');
    expect(t.abil).toBeUndefined();
    expect(ABILITY_KINDS_LIVE).not.toContain('deploy');
    expect(sim.abilityStatus(t.uid)).toMatchObject({ id: 'later.doubles', unlocked: false, later: true, reason: 'locked', unlockTier: 3 });
  });

  test('a hero learns her skill at Lv 7 and ranks it up at Lv 17', () => {
    const sim = mk({ hero: 'sage' });
    const h = place(sim, 'sage', 'c');
    expect(h.abil).toBeUndefined();
    expect(sim.abilityStatus(h.uid)).toMatchObject({ unlocked: false, unlockLevel: 7, unlockTier: null });
    // a level-up (inside the step in battle) refreshes her, which syncs the skill
    gainHeroXp(sim, h, xpToReach(h.def.hero, 7), 'restore');
    expect(h.level).toBe(7);
    expect(h.abil).toMatchObject({ id: 'sage.net', kind: 'burst', cdMax: 25 * 6000, cd: Math.round(25 * 6000 / 3), t5: false });
    gainHeroXp(sim, h, xpToReach(h.def.hero, 17) - h.xp, 'restore');
    expect(h.level).toBe(17);
    expect(h.abil).toMatchObject({ cdMax: 20 * 6000, t5: true });
    expect(abilityDef(h).effect.radius).toBe(2);
    expect(sim.abilitySlots(0)).toEqual([]); // a hero's skill lives in the hero widget, not the bar
  });
});

describe('charging', () => {
  test('cooldowns charge only while a wave runs (frozen before and between waves)', () => {
    const sim = mk();
    const t = unlocked(sim, 'volley', 'a');
    const cd0 = t.abil.cd;
    run(sim, 1);
    expect(t.abil.cd).toBe(cd0);
    wave(sim);
    run(sim, 1);
    expect(t.abil.cd).toBe(cd0 - 60 * 100);
    // the wave ends: frozen again
    for (const e of sim.enemies) e.dead = true;
    run(sim, 0.1);
    expect(sim.state).toBe('between');
    const cd1 = t.abil.cd;
    run(sim, 2);
    expect(t.abil.cd).toBe(cd1);
  });

  test('a cooldown reaching 0 emits abilityReady once', () => {
    const sim = mk();
    const t = unlocked(sim, 'volley', 'a');
    wave(sim);
    t.abil.cd = 250;
    sim.drainEvents();
    run(sim, 0.1);
    expect(t.abil.cd).toBe(0);
    expect(events(sim, 'abilityReady')).toEqual([{ type: 'abilityReady', towerUid: t.uid, id: 'volley.rain' }]);
  });

  test('Skill Haste (gear ultHaste) speeds abilities at half rate, capped; rallies and debuffs never', () => {
    const at = (h, kind) => chargeRate({ unitStats: { ultHaste: h } }, kind);
    expect(at(0, 'strike')).toBe(100);
    expect(at(0.2, 'strike')).toBe(111);
    expect(at(0.5, 'burst')).toBe(133);
    expect(at(0.9, 'boost')).toBe(133);
    expect(at(0.5, 'rally')).toBe(100);
    expect(at(0.5, 'debuff')).toBe(100);
    const sim = mk({ stats: { volley: { ultHaste: 0.2 } } });
    const t = unlocked(sim, 'volley', 'a');
    expect(t.abil.rate).toBe(111);
    wave(sim);
    const cd0 = t.abil.cd;
    run(sim, 1);
    expect(t.abil.cd).toBe(cd0 - 60 * 111);
  });
});

describe('casting and refusals (a refusal never spends the cooldown)', () => {
  test('every reason, in order', () => {
    const sim = mk();
    const t = unlocked(sim, 'volley', 'a');
    const plain = place(sim, 'volley', 'b');
    expect(sim.castAbility(plain.uid).reason).toBe('locked');
    expect(sim.castAbility(999).reason).toBe('locked');
    t.disabled = 2; // sabotaged between waves: notWave still comes first
    expect(sim.castAbility(t.uid).reason).toBe('notWave');
    t.disabled = 0;
    wave(sim);
    expect(sim.castAbility(t.uid, { owner: 1 }).reason).toBe('notYours');
    t.abil.cd = 0;
    t.disabled = 2;
    expect(sim.castAbility(t.uid).reason).toBe('disabled');
    t.disabled = 0;
    t.moveLock = 1;
    expect(sim.castAbility(t.uid).reason).toBe('moving');
    t.moveLock = 0;
    // nothing in reach: noTarget, the cooldown untouched
    expect(sim.castAbility(t.uid)).toEqual({ ok: false, reason: 'noTarget', casterUid: t.uid });
    expect(t.abil.cd).toBe(0);
    park(sim, 'tank', 9);
    run(sim, STEP); // (targets come from the step's enemy grid)
    expect(sim.castAbility(t.uid)).toEqual({ ok: true, reason: null, casterUid: t.uid });
    expect(t.abil.cd).toBe(t.abil.cdMax);
    expect(t.abil.n).toBe(1);
    expect(sim.castAbility(t.uid).reason).toBe('cooldown');
    sim.state = 'won';
    expect(sim.castAbility(t.uid).reason).toBe('ended');
  });

  test('a lasting effect refuses a recast with `active`', () => {
    const sim = mk();
    const t = unlocked(sim, 'spinner', 'a');
    wave(sim);
    park(sim, 'tank', 9);
    run(sim, STEP);
    t.abil.cd = 0;
    expect(sim.castAbility(t.uid).ok).toBe(true);
    t.abil.cd = 0;
    expect(sim.castAbility(t.uid).reason).toBe('active');
  });

  test('econ: 2 casts per player per wave (cap), none on Nightmare (noIncome)', () => {
    const sim = mk();
    const m = unlocked(sim, 'market', 'far');
    wave(sim);
    for (let i = 0; i < 2; i++) {
      m.abil.cd = 0;
      expect(sim.castAbility(m.uid).ok).toBe(true);
    }
    m.abil.cd = 0;
    expect(sim.castAbility(m.uid).reason).toBe('cap');
    sim.startNextWave(); // (between waves only: the state machine refuses mid-wave)
    sim.state = 'between';
    expect(sim.startNextWave()).toBe(true);
    park(sim, 'tank', 0.2);
    expect(sim.abilUses).toEqual([0, 0]);
    expect(sim.castAbility(m.uid).ok).toBe(true);
    const nm = mk({ difficulty: 'nightmare' });
    const n = unlocked(nm, 'market', 'far');
    wave(nm);
    n.abil.cd = 0;
    expect(nm.castAbility(n.uid).reason).toBe('noIncome');
    expect(n.abil.cd).toBe(0);
  });

  test('the sim API and towerStats show the state (the teaser while locked)', () => {
    const sim = mk();
    const t = place(sim, 'volley', 'a');
    expect(sim.towerStats(t.uid).ability).toMatchObject({ id: 'volley.rain', unlocked: false, unlockTier: 3, path: 0, cooldown: 30 });
    up(sim, t, 0, 3);
    expect(sim.towerStats(t.uid).ability).toMatchObject({ unlocked: true, ready: false, reason: 'notWave', cooldown: 30, cooldownLeft: 10, auto: false, uses: 0 });
    wave(sim);
    t.abil.cd = 0;
    expect(sim.abilityStatus(t.uid)).toMatchObject({ ready: true, reason: null, cooldownLeft: 0, charge: 1 });
  });
});

describe('strike', () => {
  test('hits `count` enemies picked by her target mode within reachMul × range: dmgMul × her hit, a certain stun', () => {
    const sim = mk();
    const t = unlocked(sim, 'volley', 'a');
    wave(sim);
    const es = [7, 8, 9, 10, 11].map((d) => park(sim, 'tank', d));
    t.abil.cd = 0;
    run(sim, STEP); // the grid holds the parked enemies
    const hp = es.map((e) => e.hp);
    expect(sim.castAbility(t.uid).ok).toBe(true);
    const hit = 4 * t.eff.damage * typeMultiplier('pierce', 'light');
    const lost = es.map((e, i) => hp[i] - e.hp);
    // First: the three furthest along
    expect(lost).toEqual([0, 0, hit, hit, hit]);
    for (const e of es.slice(2)) expect(e.statuses.stun?.left).toBeCloseTo(0.5, 9);
    expect(es[0].statuses.stun).toBeUndefined();
    const ev = sim.drainEvents().find((e) => e.type === 'ability');
    expect(ev).toMatchObject({ towerUid: t.uid, id: 'volley.rain', kind: 'strike', auto: false, targets: [es[4].uid, es[3].uid, es[2].uid] });
    // her target mode (Last) picks the others
    t.abil.cd = 0;
    sim.setTargetMode(t.uid, 'last');
    const hp2 = es.map((e) => e.hp);
    sim.castAbility(t.uid);
    expect(es.map((e, i) => hp2[i] - e.hp)).toEqual([hit, hit, hit, 0, 0]);
  });

  test('tier 5 strikes more enemies harder', () => {
    const sim = mk();
    const t = unlocked(sim, 'volley', 'a', 5);
    wave(sim);
    const es = [6, 7, 8, 9, 10, 11].map((d) => park(sim, 'tank', d));
    run(sim, STEP);
    t.abil.cd = 0;
    const hp = es.map((e) => e.hp);
    sim.castAbility(t.uid);
    const hit = 6 * t.eff.damage * typeMultiplier('pierce', 'light');
    expect(es.map((e, i) => hp[i] - e.hp).filter((x) => x > 0)).toEqual([hit, hit, hit, hit, hit]);
  });

  test('a map strike with a telegraph: reticles now, shots 1 s later in Priority order, seeing veiled enemies', () => {
    const sim = mk();
    const t = unlocked(sim, 'verdict', 'far');
    wave(sim);
    const elite = park(sim, 'elite', 3);
    elite.veiled = true; // her own arrows cannot see it; a map ability has Veil Sight
    const orc = park(sim, 'orc', 12);
    const boss = park(sim, 'boss', 5); // outside her own range
    run(sim, STEP);
    expect(t.eff.detection).toBe(false);
    t.abil.cd = 0;
    const hp = [elite.hp, boss.hp, orc.hp];
    expect(sim.castAbility(t.uid).ok).toBe(true);
    expect(sim._abilQueue.map((q) => q.target.uid)).toEqual([boss.uid, elite.uid]);
    const evs = sim.drainEvents();
    expect(evs.find((e) => e.type === 'abilityWarn')).toMatchObject({ delay: 1, targets: [boss.uid, elite.uid] });
    // a map-wide reach shows no ring: radius 0, never Infinity (JSON would turn that into null)
    const ev = evs.find((e) => e.type === 'ability');
    expect(ev.radius).toBe(0);
    expect(JSON.parse(JSON.stringify(ev)).radius).toBe(0);
    expect([elite.hp, boss.hp, orc.hp]).toEqual(hp);
    run(sim, 59 * STEP);
    expect(boss.hp).toBe(hp[1]);
    run(sim, STEP);
    expect(sim._abilQueue).toEqual([]);
    expect(hp[1] - boss.hp).toBeCloseTo(5 * t.eff.damage * typeMultiplier('pierce', 'scaled'), 9);
    expect(hp[0] - elite.hp).toBeCloseTo(5 * t.eff.damage * typeMultiplier('pierce', 'light'), 9);
    // one that died in the meantime fizzles
    t.abil.cd = 0;
    sim.abilGroups.clear();
    t.abil.active = 0;
    sim.castAbility(t.uid);
    for (const q of sim._abilQueue) q.target.dead = true;
    sim.drainEvents();
    run(sim, 61 * STEP);
    expect(events(sim, 'abilityFizzle').length).toBeGreaterThan(0);
  });

  test('Verdict ignores armor (armorPen 99): an armored pick takes exactly dmgMul × her hit × the type chart', () => {
    const sim = mk();
    const t = unlocked(sim, 'verdict', 'far');
    wave(sim);
    const orc = park(sim, 'orc', 12); // armor 3, outside her own range; Priority's first pick here
    run(sim, STEP);
    expect(orc.armor).toBe(3);
    expect(t.eff.armorPen).toBe(0);
    t.abil.cd = 0;
    const hp = orc.hp;
    expect(sim.castAbility(t.uid).ok).toBe(true);
    expect(sim._abilQueue[0].target).toBe(orc);
    run(sim, 60 * STEP);
    expect(hp - orc.hp).toBeCloseTo(5 * t.eff.damage * typeMultiplier('pierce', 'heavy'), 9);
  });

  test('Catalyst: each poisoned enemy takes its remaining poison at once (× poisonMul), neighbours half, the poison ends', () => {
    const sim = mk();
    const t = unlocked(sim, 'catalyst', 'a');
    wave(sim);
    const a = park(sim, 'tank', 9);
    const b = park(sim, 'tank', 9.5);
    const c = park(sim, 'tank', 12); // in reach, not poisoned, far from both
    run(sim, STEP);
    a.statuses.poison = { type: 'poison', dps: 5, duration: 6, left: 4, sourceUid: t.uid, attackType: 'pierce' };
    t.abil.cd = 0;
    const hp = [a.hp, b.hp, c.hp];
    expect(sim.castAbility(t.uid).ok).toBe(true);
    expect(a.statuses.poison).toBeUndefined();
    expect(hp[0] - a.hp).toBeCloseTo(5 * 4 * 2, 9);
    expect(hp[1] - b.hp).toBeCloseTo(5 * 4 * 2 * 0.5, 9);
    expect(c.hp).toBe(hp[2]);
    // nobody poisoned: noTarget
    t.abil.cd = 0;
    expect(sim.castAbility(t.uid).reason).toBe('noTarget');
  });

  test('Catalyst T5 spreads her poison onto the neighbours of each burst', () => {
    const sim = mk();
    const t = unlocked(sim, 'catalyst5', 'a');
    wave(sim);
    const a = park(sim, 'tank', 9);
    const b = park(sim, 'tank', 9.5); // within the 0.8 splash of a
    run(sim, STEP);
    a.statuses.poison = { type: 'poison', dps: 5, duration: 6, left: 4, sourceUid: t.uid, attackType: 'pierce' };
    expect(b.statuses.poison).toBeUndefined();
    t.abil.cd = 0;
    const hp = [a.hp, b.hp];
    expect(sim.castAbility(t.uid).ok).toBe(true);
    expect(hp[0] - a.hp).toBeCloseTo(5 * 4 * 2.5, 9);
    expect(hp[1] - b.hp).toBeCloseTo(5 * 4 * 2.5 * 0.5, 9);
    expect(a.statuses.poison).toBeUndefined();
    // her own poison (5 a second) for spreadPoison seconds
    expect(b.statuses.poison).toMatchObject({ type: 'poison', dps: 5, duration: 3, left: 3, sourceUid: t.uid });
  });

  test('Catalyst on a share-of-max-HP poison: × DOT_PCT_BOSS_MUL on a boss, the full share on anyone else', () => {
    const sim = mk();
    const t = unlocked(sim, 'catalyst', 'a');
    wave(sim);
    const boss = park(sim, 'boss', 9);
    const grunt = park(sim, 'tank', 12); // beyond the splash of the boss
    run(sim, STEP);
    for (const e of [boss, grunt]) e.statuses.poison = { type: 'poison', dps: 0, pct: 0.01, duration: 6, left: 4, sourceUid: t.uid, attackType: 'pierce' };
    t.abil.cd = 0;
    const hp = [boss.hp, grunt.hp];
    expect(sim.castAbility(t.uid).ok).toBe(true);
    expect(DOT_PCT_BOSS_MUL).toBe(0.1);
    expect(hp[0] - boss.hp).toBeCloseTo(0.01 * boss.maxHp * DOT_PCT_BOSS_MUL * 4 * 2, 6);
    expect(hp[1] - grunt.hp).toBeCloseTo(0.01 * grunt.maxHp * 4 * 2, 6);
  });

  test('Flash Lunge: 5 strikes at full ramp, and her focus stays on the enemy at full ramp', () => {
    const sim = mk();
    const t = unlocked(sim, 'lunger', 'a');
    wave(sim);
    const e = park(sim, 'tank', 9.5);
    run(sim, STEP);
    t.abil.cd = 0;
    const hp = e.hp;
    sim.castAbility(t.uid);
    const ramp = t.eff.ramp;
    expect(hp - e.hp).toBeCloseTo(5 * t.eff.damage * (1 + ramp.max) * typeMultiplier('slash', 'light'), 6);
    expect(t.rampTarget).toBe(e);
    expect(t.rampStacks).toBe(Math.ceil(ramp.max / ramp.per));
  });
});

describe('burst', () => {
  test('lands on the densest crowd in reach: dmgMul × hit, knockback by KNOCKBACK_RESIST, a stun', () => {
    const sim = mk();
    const t = unlocked(sim, 'mortar', 'a');
    wave(sim);
    const lone = park(sim, 'tank', 6);
    const crowd = [9, 9.3, 9.6].map((d) => park(sim, 'tank', d));
    const boss = park(sim, 'boss', 9.45);
    run(sim, STEP);
    const p = densestPoint(sim, t.x, t.y, 1.5 * t.eff.range, abilitySpec(t, abilityDef(t)), 1.2);
    expect(p.n).toBe(4);
    t.abil.cd = 0;
    const before = [...crowd, boss, lone].map((e) => [e.hp, e.dist]);
    expect(sim.castAbility(t.uid).ok).toBe(true);
    const hit = 3 * t.eff.damage * typeMultiplier('blast', 'light');
    crowd.forEach((e, i) => {
      expect(before[i][0] - e.hp).toBeCloseTo(hit, 9);
      expect(before[i][1] - e.dist).toBeCloseTo(0.5 * KNOCKBACK_RESIST.normal, 9);
      expect(e.statuses.stun.left).toBeCloseTo(0.5, 9);
    });
    expect(boss.dist).toBe(before[3][1]); // bosses stand firm
    expect(boss.statuses.stun.left).toBeCloseTo(0.5 * CC_RESIST.boss, 9);
    expect([lone.hp, lone.dist]).toEqual(before[4]);
  });

  test('a barrage queues its shells: warning rings, then one every 0.25 s from 0.5 s', () => {
    const sim = mk();
    const t = unlocked(sim, 'barrage', 'a');
    wave(sim);
    for (const d of [9, 9.3, 9.6]) park(sim, 'tank', d);
    run(sim, STEP);
    t.abil.cd = 0;
    sim.drainEvents();
    const p = densestPoint(sim, t.x, t.y, 1.5 * t.eff.range, abilitySpec(t, abilityDef(t)), 1);
    expect(sim.castAbility(t.uid).ok).toBe(true);
    expect(sim._abilQueue.map((q) => q.left)).toEqual([30, 45, 60, 75]);
    // each shell on the cast point plus its fixed scatter offset
    const spots = ABILITY_SCATTER.slice(0, 4).map(([dx, dy]) => [p.x + dx, p.y + dy]);
    expect(sim._abilQueue.map((q) => [q.x, q.y])).toEqual(spots);
    expect(new Set(spots.map(String)).size).toBe(4);
    expect(events(sim, 'abilityWarn')).toHaveLength(1);
    const shellsBy = (s) => {
      run(sim, s);
      return events(sim, 'abilityShell').length;
    };
    expect(shellsBy(29 * STEP)).toBe(0);
    expect(shellsBy(STEP)).toBe(1);
    expect(shellsBy(45 * STEP)).toBe(3);
    expect(sim._abilQueue).toEqual([]);
  });

  test('a re-aiming salvo: the first shell at once, each later one on the densest crowd when it fires, else a fizzle', () => {
    const sim = mk();
    const t = unlocked(sim, 'salvo', 'a');
    wave(sim);
    const first = [9, 9.3, 9.6].map((d) => park(sim, 'tank', d));
    run(sim, STEP);
    t.abil.cd = 0;
    sim.drainEvents();
    const spec = abilitySpec(t, abilityDef(t));
    const reach = 2 * t.eff.range;
    const p0 = densestPoint(sim, t.x, t.y, reach, spec, 1);
    expect(sim.castAbility(t.uid).ok).toBe(true);
    expect(events(sim, 'abilityShell').map((e) => [e.x, e.y, e.hits])).toEqual([[p0.x, p0.y, 3]]);
    expect(sim._abilQueue.map((q) => [q.left, q.reaim])).toEqual([[30, true], [60, true]]);
    // the crowd is gone and another stands further on: the next shell finds it
    for (const e of first) e.dead = true;
    const second = [12, 12.3].map((d) => park(sim, 'tank', d));
    run(sim, 30 * STEP);
    const p1 = densestPoint(sim, t.x, t.y, reach, spec, 1);
    expect(p1.n).toBe(2);
    expect(Math.abs(p1.x - p0.x)).toBeGreaterThan(2);
    expect(events(sim, 'abilityShell').map((e) => [e.x, e.y, e.hits])).toEqual([[p1.x, p1.y, 2]]);
    // nothing left in reach: the last shell fizzles
    for (const e of second) e.dead = true;
    run(sim, 30 * STEP);
    const evs = sim.drainEvents();
    expect(evs.filter((e) => e.type === 'abilityShell')).toEqual([]);
    expect(evs.filter((e) => e.type === 'abilityFizzle')).toEqual([{ type: 'abilityFizzle', towerUid: t.uid, id: 'salvo.fire', uid: -1 }]);
    expect(sim._abilQueue).toEqual([]);
  });

  test('densest-crowd ties go to the smaller `remaining` (further along the road), then the lower uid', () => {
    const sim = mk();
    const t = unlocked(sim, 'mortar', 'a');
    wave(sim);
    const back = park(sim, 'tank', 7);
    const front = park(sim, 'tank', 10);
    run(sim, STEP);
    const spec = abilitySpec(t, abilityDef(t));
    const scan = () => densestPoint(sim, t.x, t.y, 1.5 * t.eff.range, spec, 0.3);
    expect(front.remaining).toBeLessThan(back.remaining);
    expect(scan()).toEqual({ x: front.x, y: front.y, n: 1 });
    back.remaining = front.remaining;
    expect(back.uid).toBeLessThan(front.uid);
    expect(scan()).toEqual({ x: back.x, y: back.y, n: 1 });
  });

  test('the densest-crowd scan weighs only the first densestCap eligible enemies, in grid order', () => {
    const sim = mk();
    const t = unlocked(sim, 'mortar', 'a');
    wave(sim);
    const cap = ABILITY_RULES.densestCap;
    // a long thin line on the left (grid cells come first), then a tight crowd further right
    for (let i = 0; i < cap; i++) park(sim, 'tank', 0.5 + 0.15 * i);
    const crowd = Array.from({ length: 20 }, () => park(sim, 'tank', 14.5));
    run(sim, STEP);
    const p = densestPoint(sim, 8, 4.5, 20, abilitySpec(t, abilityDef(t)), 0.3);
    expect(p.n).toBeLessThan(crowd.length);
    expect(p.x).toBeLessThan(crowd[0].x - 4);
    // the crowd alone (the line gone) is found
    for (const e of sim.enemies) if (!crowd.includes(e)) e.dead = true;
    sim.grid.rebuild(sim.enemies);
    expect(densestPoint(sim, 8, 4.5, 20, abilitySpec(t, abilityDef(t)), 0.3)).toMatchObject({ x: crowd[0].x, y: crowd[0].y, n: 20 });
  });

  test('a frost burst on her own spot: frozen and slowed, a frost ward immune', () => {
    const sim = mk();
    const t = unlocked(sim, 'frost', 'a');
    wave(sim);
    const e = park(sim, 'tank', 9);
    const w = park(sim, 'frostward', 9.2);
    const out = park(sim, 'tank', 15); // outside her range
    run(sim, STEP);
    t.abil.cd = 0;
    expect(sim.castAbility(t.uid).ok).toBe(true);
    expect(e.statuses.freeze.left).toBeCloseTo(2, 9);
    expect(e.statuses.slow.amount).toBeCloseTo(0.4, 9);
    expect(w.statuses.freeze).toBeUndefined();
    expect(out.statuses.freeze).toBeUndefined();
  });
});

describe('the CC guard on minibosses and bosses', () => {
  test('after an ability stun lands, ability freezes and stuns skip the boss for 4 s; normal enemies are never guarded', () => {
    const sim = mk();
    const t = unlocked(sim, 'mortar', 'a');
    wave(sim);
    const boss = park(sim, 'boss', 9);
    const grunt = park(sim, 'tank', 9.2);
    run(sim, STEP);
    const cast = () => {
      t.abil.cd = 0;
      expect(sim.castAbility(t.uid).ok).toBe(true);
    };
    cast();
    expect(boss.statuses.stun).toBeTruthy();
    expect(boss.abilCc).toBe(Math.round(sim.time / STEP) + ABILITY_RULES.ccGuardTicks);
    expect('abilCc' in grunt).toBe(false);
    run(sim, 0.5); // both stuns run out
    cast();
    expect(boss.statuses.stun).toBeUndefined();
    expect(grunt.statuses.stun).toBeTruthy();
    run(sim, 4);
    cast();
    expect(boss.statuses.stun).toBeTruthy();
  });

  test('a miniboss is guarded the same way', () => {
    const sim = mk();
    const t = unlocked(sim, 'mortar', 'a');
    wave(sim);
    const mini = park(sim, 'mini', 9);
    run(sim, STEP);
    const cast = () => {
      t.abil.cd = 0;
      expect(sim.castAbility(t.uid).ok).toBe(true);
    };
    cast();
    expect(mini.statuses.stun?.left).toBeCloseTo(0.5 * CC_RESIST.miniboss, 9);
    expect(mini.abilCc).toBe(Math.round(sim.time / STEP) + ABILITY_RULES.ccGuardTicks);
    run(sim, 0.5);
    expect(mini.statuses.stun).toBeUndefined();
    cast();
    expect(mini.statuses.stun).toBeUndefined();
    run(sim, 4);
    cast();
    expect(mini.statuses.stun).toBeTruthy();
  });

  test('ability freezes are guarded too: the second within 4 s skips the boss (its slow still lands), the third lands', () => {
    const sim = mk();
    const t = unlocked(sim, 'frost', 'a');
    wave(sim);
    const boss = park(sim, 'boss', 9);
    run(sim, STEP);
    const cast = () => {
      t.abil.cd = 0;
      expect(sim.castAbility(t.uid).ok).toBe(true);
    };
    cast();
    expect(boss.statuses.freeze?.left).toBeCloseTo(2 * CC_RESIST.boss, 9);
    const guardEnd = Math.round(sim.time / STEP) + ABILITY_RULES.ccGuardTicks;
    expect(boss.abilCc).toBe(guardEnd);
    run(sim, 1);
    expect(boss.statuses.freeze).toBeUndefined();
    delete boss.statuses.slow;
    cast();
    expect(boss.statuses.freeze).toBeUndefined();
    expect(boss.statuses.slow).toBeTruthy();
    expect(boss.abilCc).toBe(guardEnd); // a skipped freeze starts no new guard
    run(sim, 3.5);
    cast();
    expect(boss.statuses.freeze?.left).toBeCloseTo(2 * CC_RESIST.boss, 9);
  });
});

describe('boost', () => {
  test('raises her stats while it runs and gives them back exactly (deep-equal eff)', () => {
    const sim = mk();
    const t = unlocked(sim, 'spinner', 'a');
    wave(sim);
    park(sim, 'tank', 9);
    run(sim, STEP);
    const before = eff(t);
    t.abil.cd = 0;
    expect(sim.castAbility(t.uid).ok).toBe(true);
    expect(t.abilMods).toBe(abilityDef(t).effect.mods);
    expect(t.eff.rate).toBeCloseTo(before.rate * 2, 9);
    expect(t.eff.range).toBeCloseTo(before.range + 0.5, 9);
    expect(t.eff.maxTargets).toBe(before.maxTargets + 99);
    expect(towerResolvedStats(t)).toEqual(t.stats); // the co-op checkpoint check sees the boost too
    expect(t.abil.active).toBe(240);
    sim.drainEvents();
    run(sim, 4);
    expect(t.abil.active).toBe(0);
    expect(t.abilMods).toBeNull();
    expect(eff(t)).toEqual(before);
    expect(events(sim, 'abilityEnd')).toEqual([{ type: 'abilityEnd', towerUid: t.uid, id: 'spinner.spin' }]);
  });
});

describe('rally', () => {
  test('both players\' girls in the radius, never the caster; strongest per key; multiplies with an aura', () => {
    const sim = mk();
    const c1 = unlocked(sim, 'cheer', 'a');
    const c2 = unlocked(sim, 'cheer2', 'c');
    const g = place(sim, 'archer', 'b');
    const ally = place(sim, 'archer', 'd');
    ally.owner = 1;
    const chime = place(sim, 'chime', 'e');
    const lone = place(sim, 'archer', 'far'); // outside both rallies' 3 tiles (and the chime's aura)
    wave(sim);
    run(sim, STEP);
    const auraDmg = g.buff.dmgMul;
    c1.abil.cd = 0;
    expect(sim.castAbility(c1.uid).ok).toBe(true);
    expect(g.buff.dmgMul).toBeCloseTo(auraDmg * 1.3, 9);
    expect(ally.buff.dmgMul).toBeGreaterThanOrEqual(1.3 - 1e-9);
    expect(c1.buff.dmgMul).toBe(1); // no self-buff (no aura reaches her)
    expect(g.buffBy.rally).toBe(c1.uid);
    expect(sim.buffSources(g.uid).filter((r) => r.kind === 'rally').map((r) => r.key)).toEqual(['dmg', 'rate']);
    c2.abil.cd = 0;
    expect(sim.castAbility(c2.uid).ok).toBe(true);
    // strongest per key: damage from cheer (1.3), speed from cheer2 (1.4); cheer2's ward cleanses
    expect(g.buff.dmgMul).toBeCloseTo(auraDmg * 1.3, 9);
    expect(g.buff.rateMul).toBeCloseTo((chime.stats.aura.rateMul) * 1.4, 9);
    expect(g.buff.cleanse).toBe(true);
    expect(sim._isCleansed(g)).toBe(true);
    // the UI rows name each key's winner (never a product); buffBy.rally stays the first rally that reaches her
    const rows = sim.buffSources(g.uid).filter((r) => r.kind === 'rally')
      .map((r) => [r.key, typeof r.value === 'number' ? +r.value.toFixed(9) : r.value, r.src]);
    expect(rows).toEqual([['dmg', 0.3, c1.uid], ['rate', 0.4, c2.uid], ['cleanse', true, c2.uid]]);
    expect(g.buffBy.rally).toBe(c1.uid);
    expect([lone.buff.dmgMul, lone.buff.rateMul, lone.buff.cleanse, lone.buffBy.rally]).toEqual([1, 1, false, -1]);
    run(sim, 5);
    expect(sim._rallies).toEqual([]);
    expect(g.buff.dmgMul).toBeCloseTo(auraDmg, 9);
    expect(g.buffBy.rally).toBe(-1);
  });

  test('a cleanse clears sabotage at once; no girl in the radius is noTarget', () => {
    const sim = mk();
    const c = unlocked(sim, 'cheer2', 'a');
    wave(sim);
    c.abil.cd = 0;
    expect(sim.castAbility(c.uid).reason).toBe('noTarget');
    const g = place(sim, 'archer', 'b');
    g.disabled = 3;
    expect(sim.castAbility(c.uid).ok).toBe(true);
    expect(g.disabled).toBe(0);
  });

  test('a cleanse without a ward clears sabotage at the cast itself, and blocks nothing after', () => {
    const sim = mk();
    const c = unlocked(sim, 'cheer3', 'a');
    const g = place(sim, 'archer', 'b');
    wave(sim);
    g.disabled = 3;
    c.abil.cd = 0;
    expect(sim.castAbility(c.uid).ok).toBe(true);
    expect(g.disabled).toBe(0);
    expect(g.buff.rateMul).toBeCloseTo(1.1, 9);
    expect(g.buff.cleanse).toBe(false);
    expect(sim._isCleansed(g)).toBe(false);
  });
});

describe('debuff', () => {
  test('map-wide: every enemy outside the tunnels, veiled ones too; casters also stunned', () => {
    const sim = mk();
    const t = unlocked(sim, 'hush', 'far');
    wave(sim);
    const v = park(sim, 'veil', 3);
    const s = park(sim, 'summoner', 11);
    const hid = park(sim, 'tank', 6);
    run(sim, STEP);
    hid.hidden = true; // in a tunnel
    t.abil.cd = 0;
    expect(sim.castAbility(t.uid).ok).toBe(true);
    expect(v.statuses.silence).toBeTruthy();
    expect(v.revealed).toBe(true);
    expect(s.statuses.stun?.left).toBeCloseTo(1, 9);
    expect(v.statuses.stun).toBeUndefined();
    expect(hid.statuses.silence).toBeUndefined();
    expect(t.abil.active).toBe(180);
  });

  test('the strongest N enemies on the map are marked', () => {
    const sim = mk();
    const t = unlocked(sim, 'marker', 'far');
    wave(sim);
    const small = park(sim, 'slime', 4);
    const elite = park(sim, 'elite', 5);
    const boss = park(sim, 'boss', 6);
    run(sim, STEP);
    t.abil.cd = 0;
    sim.castAbility(t.uid);
    expect(boss.statuses.mark?.bonus).toBe(0.2);
    expect(elite.statuses.mark?.bonus).toBe(0.2);
    expect(small.statuses.mark).toBeUndefined();
  });

  test('Lantern Flare: only veiled enemies are revealed; its rider gives the girls in her aura ×1.15 reach and Veil Sight for `duration`', () => {
    const sim = mk();
    const t = unlocked(sim, 'lantern', 'a');
    const inside = place(sim, 'archer', 'b'); // 2 tiles away: in her 3-tile aura
    const outside = place(sim, 'archer', 'e'); // 4.6 tiles away
    wave(sim);
    const v = park(sim, 'veil', 9);
    const plain = park(sim, 'tank', 10);
    run(sim, STEP);
    const range = [inside.eff.range, outside.eff.range];
    expect([inside.eff.detection, outside.eff.detection]).toEqual([false, false]);
    t.abil.cd = 0;
    sim.drainEvents();
    expect(sim.castAbility(t.uid).ok).toBe(true);
    expect(v.statuses.reveal?.left).toBe(8);
    expect(v.revealed).toBe(true);
    expect(plain.statuses.reveal).toBeUndefined();
    expect(events(sim, 'ability')[0]).toMatchObject({ targets: [v.uid], radius: 0 });
    expect(inside.eff.range).toBeCloseTo(range[0] * 1.15, 9);
    expect(inside.eff.detection).toBe(true);
    expect(inside.buffBy.rally).toBe(t.uid);
    expect(outside.eff.range).toBe(range[1]);
    expect(outside.eff.detection).toBe(false);
    expect(outside.buffBy.rally).toBe(-1);
    // it lasts exactly `duration` (8 s = 480 steps)
    run(sim, 8 - STEP);
    expect(sim._rallies).toHaveLength(1);
    run(sim, STEP);
    expect(sim._rallies).toEqual([]);
    expect(inside.eff.range).toBeCloseTo(range[0], 9);
    expect(inside.eff.detection).toBe(false);
    // nothing veiled: noTarget
    t.abil.cd = 0;
    sim.abilGroups.clear();
    t.abil.active = 0;
    v.dead = true;
    expect(sim.castAbility(t.uid).reason).toBe('noTarget');
  });

  test('map scope: one cooldown per player for that ability, shared by her copies', () => {
    const sim = mk();
    const a = unlocked(sim, 'hush', 'far');
    const b = unlocked(sim, 'hush', 'f');
    const c = unlocked(sim, 'hush', 'e');
    c.owner = 1;
    wave(sim);
    park(sim, 'slime', 4);
    for (const t of [a, b, c]) t.abil.cd = 0;
    expect(sim.castAbility(a.uid).ok).toBe(true);
    expect(sim.abilGroups.get('0|hush.prayer')).toEqual({ cd: a.abil.cdMax, cdMax: a.abil.cdMax, rate: 100 });
    expect(sim.castAbility(b.uid).reason).toBe('cooldown');
    expect(sim.abilityStatus(b.uid).cooldownLeft).toBe(45);
    expect(sim.castAbility(c.uid).ok).toBe(true); // the other player's own
    run(sim, 45);
    expect(sim.abilGroups.size).toBe(0);
    expect(sim.castAbility(b.uid).ok).toBe(true);
  });
});

describe('econ and owner-credited coins', () => {
  test('coins now × the difficulty coin rate × the mode income rate (Half Income halves them)', () => {
    const run1 = (opts) => {
      const sim = mk(opts);
      const m = unlocked(sim, 'market', 'far');
      wave(sim);
      m.abil.cd = 0;
      const cash = sim.cash;
      const earned = sim.stats.cashEarned;
      sim.drainEvents();
      sim.castAbility(m.uid);
      expect(sim.stats.cashEarned - earned).toBe(sim.cash - cash);
      expect(events(sim, 'cash')[0]).toMatchObject({ reason: 'ability', towerUid: m.uid, owner: 0 });
      return sim.cash - cash;
    };
    expect(run1()).toBe(100);
    expect(run1({ difficulty: 'easy' })).toBe(110);
    expect(run1({ options: { mode: 'frugal' } })).toBe(50);
  });

  test('co-op: the coins go to the caster\'s owner (ownerCash), never into the pooled cash', () => {
    const sim = mk();
    sim.ownerCash = [0, 0];
    const m = unlocked(sim, 'market', 'far');
    m.owner = 1;
    wave(sim);
    m.abil.cd = 0;
    const cash = sim.cash;
    expect(sim.castAbility(m.uid, { owner: 1 }).ok).toBe(true);
    expect(sim.cash).toBe(cash);
    expect(sim.ownerCash).toEqual([0, 100]);
    expect(sim.abilUses).toEqual([0, 1]);
    expect(sim._gainCashFor(0, 12.7)).toBe(12);
    expect(sim.ownerCash).toEqual([12, 100]);
  });

  test('tier 5 pays more', () => {
    const sim = mk();
    const m = unlocked(sim, 'market', 'far', 5);
    wave(sim);
    m.abil.cd = 0;
    const cash = sim.cash;
    sim.castAbility(m.uid);
    expect(sim.cash - cash).toBe(400);
  });
});

describe('wave end and selling', () => {
  test('the wave clear ends every lasting effect at once: the calm point is clean for checkpoints and saves', () => {
    const sim = mk();
    const s = unlocked(sim, 'spinner', 'a');
    const c = unlocked(sim, 'cheer', 'c');
    const b = unlocked(sim, 'barrage', 'b');
    const g = place(sim, 'archer', 'd');
    wave(sim);
    for (const d of [9, 9.3, 9.6]) park(sim, 'tank', d);
    run(sim, STEP);
    for (const t of [s, c, b]) {
      t.abil.cd = 0;
      expect(sim.castAbility(t.uid).ok, t.unitId).toBe(true);
    }
    expect(s.abilMods).toBeTruthy();
    expect(sim._rallies.length).toBe(1);
    expect(sim._abilQueue.length).toBeGreaterThan(0);
    for (const e of sim.enemies) e.dead = true;
    run(sim, STEP);
    expect(sim.state).toBe('between');
    expect(s.abilMods).toBeNull();
    expect(sim._rallies).toEqual([]);
    expect(sim._abilQueue).toEqual([]);
    for (const t of [s, c, b]) expect(t.abil.active, t.unitId).toBe(0);
    for (const t of sim.towers) {
      const copy = { ...t };
      refreshEffective(copy, sim.globalRateMul);
      expect(JSON.stringify(copy.eff), t.unitId).toBe(JSON.stringify(t.eff));
      expect(towerResolvedStats(t)).toEqual(t.stats);
    }
    expect(g.buff.dmgMul).toBe(1);
    expect(rederiveStats(sim)).toBe(0);
  });

  test('selling a girl mid-effect ends her rally and her queued shells at once', () => {
    const sim = mk();
    const c = unlocked(sim, 'cheer', 'a');
    const b = unlocked(sim, 'barrage', 'c');
    const g = place(sim, 'archer', 'b');
    wave(sim);
    for (const d of [9, 9.3, 9.6]) park(sim, 'tank', d);
    run(sim, STEP);
    c.abil.cd = 0;
    b.abil.cd = 0;
    sim.castAbility(c.uid);
    sim.castAbility(b.uid);
    expect(g.buff.dmgMul).toBeCloseTo(1.3, 9);
    expect(sim._abilOn).toBe(2);
    sim.sellTower(c.uid);
    expect(g.buff.dmgMul).toBe(1);
    sim.sellTower(b.uid);
    expect(sim._abilQueue).toEqual([]);
    expect(sim._rallies).toEqual([]);
    expect(sim._abilOn).toBe(0);
  });
});

describe('group casts (copies share one button)', () => {
  test('the selected copy if ready; else her player\'s ready copy with the most enemies in reach; ties to the lower uid', () => {
    const sim = mk();
    const a = unlocked(sim, 'volley', 'a');
    const b = unlocked(sim, 'volley', 'far');
    const c = unlocked(sim, 'volley', 'e');
    const other = unlocked(sim, 'volley', 'b');
    other.owner = 1;
    wave(sim);
    for (const d of [12, 12.5, 13]) park(sim, 'tank', d);
    run(sim, STEP);
    for (const t of [a, b, c, other]) t.abil.cd = 0;
    expect(sim.castAbility(a.uid, { group: true }).casterUid).toBe(a.uid);
    // a spent: the copy that sees more enemies (c sees the three, b only the parked tank) fires, never
    // the other player's
    expect(sim.castAbility(a.uid, { group: true }).casterUid).toBe(c.uid);
    expect(sim.castAbility(a.uid, { group: true })).toEqual({ ok: true, reason: null, casterUid: b.uid });
    // every copy spent: the selected one's reason
    expect(sim.castAbility(a.uid, { group: true })).toEqual({ ok: false, reason: 'cooldown', casterUid: a.uid });
    expect(other.abil.cd).toBe(0);
    // a tie goes to the lower uid
    b.abil.cd = 0;
    c.abil.cd = 0;
    for (const e of sim.enemies) e.dead = true;
    sim.grid.rebuild(sim.enemies);
    expect(sim.castAbility(a.uid, { group: true })).toEqual({ ok: false, reason: 'noTarget', casterUid: b.uid });
  });

  test('a group cast from a still-locked copy fires her player\'s ready copy; `locked` only when no copy has the ability', () => {
    const sim = mk();
    const low = up(sim, place(sim, 'volley', 'a'), 0, 2); // tier 2: locked
    const ready = unlocked(sim, 'volley', 'e');
    wave(sim);
    park(sim, 'tank', 12);
    run(sim, STEP);
    ready.abil.cd = 0;
    expect(low.abil).toBeUndefined();
    expect(sim.castAbility(low.uid)).toEqual({ ok: false, reason: 'locked', casterUid: null }); // alone: locked
    expect(sim.castAbility(low.uid, { group: true, owner: 1 }).reason).toBe('notYours');
    expect(sim.castAbility(low.uid, { group: true, owner: 0 })).toEqual({ ok: true, reason: null, casterUid: ready.uid });
    // no copy ready: the refusal of her first copy that has the ability
    expect(sim.castAbility(low.uid, { group: true })).toEqual({ ok: false, reason: 'cooldown', casterUid: ready.uid });
    // the other player's copy never stands in: with no copy of her own that has it, locked
    const sim2 = mk();
    const lone = up(sim2, place(sim2, 'volley', 'a'), 0, 2);
    const theirs = unlocked(sim2, 'volley', 'e');
    theirs.owner = 1;
    wave(sim2);
    park(sim2, 'tank', 12);
    run(sim2, STEP);
    theirs.abil.cd = 0;
    expect(sim2.castAbility(lone.uid, { group: true })).toEqual({ ok: false, reason: 'locked', casterUid: null });
    expect(theirs.abil.n).toBe(0);
  });
});

describe('auto-cast', () => {
  test('default Off; on, a girl fires when her rule holds, on her staggered step', () => {
    const sim = mk();
    const t = unlocked(sim, 'volley', 'a');
    wave(sim);
    for (const d of [8, 9, 10]) park(sim, 'tank', d);
    t.abil.cd = 0;
    run(sim, 1);
    expect(t.abil.n).toBe(0);
    expect(sim.setAbilityAuto(t.uid, true)).toEqual({ ok: true, reason: null });
    sim.drainEvents();
    let castAt = -1;
    for (let i = 0; i < 12 && castAt < 0; i++) {
      run(sim, STEP);
      if (sim.drainEvents().some((e) => e.type === 'ability' && e.auto)) castAt = Math.round(sim.time / STEP);
    }
    expect(castAt).toBeGreaterThan(0);
    expect((castAt + t.uid) % ABILITY_RULES.autoEvery).toBe(0);
    expect(t.abil.n).toBe(1);
  });

  test('it waits for its rule (enemies ≥ min, or an elite) and skips a sabotaged girl', () => {
    const sim = mk({ options: { autoAbilities: true } });
    const t = unlocked(sim, 'volley', 'a');
    expect(t.abil.auto).toBe(true); // the setting is the default for every unlock
    wave(sim);
    park(sim, 'tank', 9);
    t.abil.cd = 0;
    run(sim, 0.5);
    expect(t.abil.n).toBe(0); // 1 of 3
    const e = park(sim, 'elite', 9.5);
    e.baseSpeed = 0;
    t.disabled = 5;
    run(sim, 0.5);
    expect(t.abil.n).toBe(0);
    t.disabled = 0;
    run(sim, 0.5);
    expect(t.abil.n).toBe(1);
  });

  test('econ fires as soon as it is ready; the poisoned rule counts poisoned enemies', () => {
    const sim = mk({ options: { autoAbilities: true } });
    const m = unlocked(sim, 'market', 'far');
    const cat = unlocked(sim, 'catalyst', 'a');
    wave(sim);
    const a = park(sim, 'tank', 9);
    const b = park(sim, 'tank', 9.4);
    m.abil.cd = 100;
    cat.abil.cd = 0;
    run(sim, 0.2);
    expect(m.abil.n).toBe(1);
    // her own bolts poison only her First pick (b): one poisoned enemy is not enough, two are
    run(sim, 1);
    expect(b.statuses.poison).toBeTruthy();
    expect(a.statuses.poison).toBeUndefined();
    expect(cat.abil.n).toBe(0);
    a.statuses.poison = { type: 'poison', dps: 5, duration: 6, left: 6, sourceUid: cat.uid, attackType: 'pierce' };
    run(sim, 0.2);
    expect(cat.abil.n).toBe(1);
  });

  test('setAbilityAutoAll sets every girl of that player and the default for later unlocks', () => {
    const sim = mk();
    const a = unlocked(sim, 'volley', 'a');
    const b = unlocked(sim, 'spinner', 'b');
    b.owner = 1;
    expect(sim.setAbilityAutoAll(0, true)).toEqual({ ok: true, reason: null, n: 1 });
    expect([a.abil.auto, b.abil.auto]).toEqual([true, false]);
    expect(sim.abilityAutoDefault).toEqual([true, false]);
    const c = unlocked(sim, 'mortar', 'c');
    expect(c.abil.auto).toBe(true);
    expect(sim.abilitySlots(0).map((s) => s.id)).toEqual(['volley.rain', 'mortar.shell']);
  });
});

describe('auto-cast rules (each `when`, checked on the girl\'s staggered step)', () => {
  const autoSim = () => mk({ options: { autoAbilities: true } });
  /** Two auto checks for every girl. */
  const checks = (sim) => run(sim, 2 * ABILITY_RULES.autoEvery * STEP);

  test('the pool: a local ability counts only enemies it can hit, a map one none in the tunnels; a rally any in its radius', () => {
    // Skyfall-shaped (enemies ≥ 3, no Veil Sight): one plain enemy and two veiled ones are 1 of 3
    const sim = autoSim();
    const t = unlocked(sim, 'volley', 'a');
    wave(sim);
    t.abil.cd = 0;
    park(sim, 'tank', 9);
    const vs0 = [9.3, 9.6].map((d) => park(sim, 'veil', d));
    checks(sim);
    expect(vs0.map((e) => e.revealed)).toEqual([false, false]);
    expect(t.eff.detection).toBe(false);
    expect(t.abil.n).toBe(0);
    for (const v of vs0) v.statuses.reveal = { type: 'reveal', duration: 60, left: 60 };
    checks(sim);
    expect(t.abil.n).toBe(1);
    // a map ability (Verdict: an elite) never counts an enemy inside a tunnel
    const sim1 = mk();
    const vd = unlocked(sim1, 'verdict', 'far');
    wave(sim1);
    park(sim1, 'tank', 8);
    const elite = park(sim1, 'elite', 11);
    run(sim1, STEP);
    expect(autoWants(sim1, vd, abilityDef(vd))).toBe(true);
    elite.hidden = true;
    expect(autoWants(sim1, vd, abilityDef(vd))).toBe(false);
    // a rally counts the enemies in its radius whether or not she could hit them
    const sim2 = autoSim();
    const c = unlocked(sim2, 'cheer', 'a');
    place(sim2, 'archer', 'b');
    wave(sim2);
    c.abil.cd = 0;
    const vs = [9, 9.4].map((d) => park(sim2, 'veil', d));
    checks(sim2);
    expect(vs.map((e) => e.revealed)).toEqual([false, false]);
    expect(c.eff.detection).toBe(false);
    expect(c.abil.n).toBe(1);
  });

  test('veiled: a veiled enemy that is not revealed; a revealed one does not count', () => {
    const sim = autoSim();
    const t = unlocked(sim, 'lantern', 'a');
    wave(sim);
    t.abil.cd = 0;
    const v = park(sim, 'veil', 9);
    v.statuses.reveal = { type: 'reveal', duration: 60, left: 60 };
    checks(sim);
    expect(v.revealed).toBe(true);
    expect(t.abil.n).toBe(0);
    delete v.statuses.reveal;
    checks(sim);
    expect(t.abil.n).toBe(1);
    expect(v.revealed).toBe(true); // her flare
  });

  test('leak: an enemy in reach past the share of the path (`leak`: 0.7 by default; `orLeak` beside a crowd count)', () => {
    for (const id of ['warden', 'sentry']) {
      const sim = autoSim();
      const t = unlocked(sim, id, 'e');
      wave(sim);
      t.abil.cd = 0;
      const len = sim.pathData[0].length;
      const near = park(sim, 'tank', 0.6 * len);
      checks(sim);
      expect(t.abil.n, id).toBe(0);
      const past = park(sim, 'tank', 0.75 * len);
      for (const e of [near, past]) expect((e.x - t.x) ** 2 + (e.y - t.y) ** 2, id).toBeLessThan(t.eff.range ** 2);
      checks(sim);
      expect(t.abil.n, id).toBe(1);
    }
  });

  test('caster (Hush: or a veiled enemy) and elite (Verdict: or a caster)', () => {
    const cases = [
      ['hush', 'summoner'], ['hush', 'veil'],
      ['verdict', 'elite'], ['verdict', 'boss'], ['verdict', 'summoner'],
    ];
    for (const [id, enemy] of cases) {
      const sim = autoSim();
      const t = unlocked(sim, id, 'far');
      wave(sim);
      t.abil.cd = 0;
      park(sim, 'tank', 8); // a plain enemy is never enough
      checks(sim);
      expect(t.abil.n, `${id} before ${enemy}`).toBe(0);
      park(sim, enemy, 11);
      checks(sim);
      expect(t.abil.n, `${id} with ${enemy}`).toBe(1);
    }
    // Verdict's rule has no orVeiled: a veiled enemy alone never fires her
    const sim = autoSim();
    const t = unlocked(sim, 'verdict', 'far');
    wave(sim);
    t.abil.cd = 0;
    park(sim, 'veil', 11);
    checks(sim);
    expect(t.abil.n).toBe(0);
  });
});

describe('determinism', () => {
  /** A busy fixture battle: every kind on Auto through real waves. */
  function battle(seed) {
    const stage = { ...STAGE, id: 'test-1', waves: 6, startCash: 1e9, waveGen: { ...STAGE.waveGen, pool: [{ enemy: 'orc', weight: 1, from: 1 }, { enemy: 'slime', weight: 2, from: 1 }], budget: { start: 60, growth: 1.25 }, spacing: 0.35 } };
    // every girl crits half her own hits (rng draws), so a cast that rolled a crit would show
    const sim = new Sim({
      stageId: stage.id, seed, options: { autoAbilities: true },
      loadout: TOWERS.map((unitId) => ({ unitId, stats: { critChance: 0.5 } })), data: testData({ stage, units: XU, enemies: XE }),
    });
    sim.cash = 1e9;
    for (const [id, at] of [['volley', 'a'], ['mortar', 'b'], ['spinner', 'c'], ['cheer', 'd'], ['hush', 'far'], ['market', 'e'], ['barrage', 'f']]) {
      const t = sim.placeTower(id, ...AT[at]);
      for (let i = 0; i < 3; i++) sim.upgradeTower(t.uid, 0);
    }
    let casts = 0;
    let crits = 0;
    let draws = 0;
    const radii = new Set();
    const next = sim.rng.next.bind(sim.rng);
    while (sim.state !== 'won' && sim.state !== 'lost' && sim.time < 600) {
      if (sim.state !== 'wave') sim.startNextWave();
      sim.update(0.25);
      for (const e of sim.drainEvents()) {
        if (e.type === 'ability') {
          casts++;
          radii.add(Number.isFinite(e.radius));
        } else if (e.type === 'hit' && e.crit) crits++;
      }
    }
    // no rng draw inside a cast (of every kind on the field)
    sim.state = 'wave';
    park(sim, 'tank', 9);
    run(sim, STEP);
    sim.rng.next = () => {
      draws++;
      return next();
    };
    for (const t of sim.towers) {
      t.abil.cd = 0;
      t.abil.active = 0;
    }
    sim.abilGroups.clear();
    sim.abilUses.fill(0);
    for (const t of sim.towers) {
      expect(t.eff.critChance, t.unitId).toBe(0.5);
      expect(sim.castAbility(t.uid).ok, t.unitId).toBe(true);
    }
    sim.rng.next = next;
    return { digest: snapshotDigest(sim.snapshot()), casts, crits, draws, radii: [...radii], used: sim.result().stats.abilitiesUsed };
  }

  test('the same battle twice is the same battle, and casts draw no random numbers (no crit roll)', () => {
    const a = battle(11);
    const b = battle(11);
    expect(a.casts).toBeGreaterThan(5);
    expect(a.crits).toBeGreaterThan(0); // her own hits do roll
    expect(a.used).toBe(a.casts + 7);
    expect(a).toEqual(b);
    expect(a.draws).toBe(0);
    expect(a.radii).toEqual([true]); // every event radius is a finite number
  });

  test('a battle without casts keeps its result() keys (abilitiesUsed / abilityByTower only after one)', () => {
    const sim = mk();
    unlocked(sim, 'volley', 'a');
    expect(sim.result().stats).not.toHaveProperty('abilitiesUsed');
    expect(sim.result().stats).not.toHaveProperty('abilityByTower');
  });
});

describe('the real girls (src/data/abilities.js through the sim)', () => {
  /** A real stage with nothing scheduled; the girl on her best spot, her ⚡ path at `tier`. */
  function real(unitId, tier = 3, { difficulty = 'normal', stageId = '4-5' } = {}) {
    const sim = new Sim({ stageId, difficulty, loadout: [{ unitId }], seed: 9, options: {} });
    sim.cash = 1e9;
    const spot = autoPlan(stageId, [unitId]).find((a) => a.action === 'place');
    const t = sim.placeTower(unitId, spot.x, spot.y);
    const p = abilityPathOf(t.def);
    for (let i = 0; i < tier; i++) sim.upgradeTower(t.uid, p);
    sim.state = 'wave';
    sim.wave = 1;
    sim._spawnQueue = [];
    const samples = sim.pathData.flatMap((q) => samplePath(q, 0.25)).filter((s) => !s.hidden && s.pathIndex === 0);
    const near = samples.reduce((b, s) => {
      const d = (s.x - t.x) * (s.x - t.x) + (s.y - t.y) * (s.y - t.y);
      return d < b.d ? { d, s } : b;
    }, { d: Infinity }).s;
    const spawn = (id, k) => {
      const e = sim.spawnEnemy(id, { pathIndex: 0, dist: near.d + 0.2 * (k - 3), hpMul: 1e4 });
      e.baseSpeed = 0;
      return e;
    };
    return { sim, t, spawn };
  }

  test('every girl but the three deploy ones (A4) learns hers at tier 3 of her ⚡ path; every hero at Lv 7', () => {
    const live = [];
    const later = [];
    for (const u of Object.values(defaultData().units)) {
      const sim = new Sim({ stageId: '1-1', loadout: u.kind === 'hero' ? [] : [{ unitId: u.id }], hero: u.kind === 'hero' ? { unitId: u.id } : null, seed: 1 });
      sim.cash = 1e9;
      const spot = autoPlan('1-1', [u.id]).find((a) => a.action === 'place');
      const t = sim.placeTower(u.id, spot.x, spot.y);
      if (u.kind === 'hero') gainHeroXp(sim, t, xpToReach(u.hero, 7), 'restore');
      else for (let i = 0; i < 3; i++) sim.upgradeTower(t.uid, abilityPathOf(u));
      (t.abil ? live : later).push(u.id);
      if (!t.abil) expect(sim.abilityStatus(t.uid)).toMatchObject({ unlocked: false, later: true });
    }
    expect(later.sort()).toEqual(['chika', 'kage', 'suzu']);
    expect(live.length).toBe(16);
  });

  test('Aoi, Skyfall Volley: 6 arrows, 6× her hit, a certain 0.5 s pin', () => {
    const { sim, t, spawn } = real('aoi');
    const es = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => spawn('slime_green', k));
    run(sim, STEP);
    t.abil.cd = 0;
    const hp = es.map((e) => e.hp);
    expect(sim.castAbility(t.uid).ok).toBe(true);
    const lost = es.map((e, i) => hp[i] - e.hp).filter((x) => x > 0);
    expect(lost).toHaveLength(6);
    for (const x of lost) expect(x).toBeCloseTo(6 * t.eff.damage * typeMultiplier(t.eff.attackType, 'light'), 6);
    expect(es.filter((e) => e.statuses.stun?.left === 0.5)).toHaveLength(6);
  });

  test('Rei, Hurricane Draw: 4 s at ×2.5 speed with +0.6 reach, then her stats come back exactly', () => {
    const { sim, t, spawn } = real('rei');
    spawn('orc_grunt', 3);
    run(sim, STEP);
    const before = eff(t);
    t.abil.cd = 0;
    expect(sim.castAbility(t.uid).ok).toBe(true);
    expect(t.eff.rate).toBeCloseTo(before.rate * 2.5, 9);
    expect(t.eff.range).toBeGreaterThan(before.range + 0.5);
    run(sim, 4);
    expect(eff(t)).toEqual(before);
  });

  test('Momo, Market Day: +100 coins on Normal (2 a wave), none on Nightmare', () => {
    const n = real('momo', 3, { stageId: '1-1' });
    n.t.abil.cd = 0;
    const cash = n.sim.cash;
    expect(n.sim.castAbility(n.t.uid).ok).toBe(true);
    expect(n.sim.cash - cash).toBe(100);
    const nm = real('momo', 3, { stageId: '1-1', difficulty: 'nightmare' });
    nm.t.abil.cd = 0;
    expect(nm.sim.castAbility(nm.t.uid).reason).toBe('noIncome');
  });

  test('Hotaru, Firefly Hush: every enemy on the map silenced and revealed, one cooldown per player', () => {
    const { sim, t, spawn } = real('hotaru');
    const es = [0, 1, 2].map((k) => spawn('slime_violet', k));
    run(sim, STEP);
    t.abil.cd = 0;
    expect(sim.castAbility(t.uid).ok).toBe(true);
    for (const e of es) {
      expect(e.statuses.silence?.left).toBe(3);
      expect(e.revealed).toBe(true);
    }
    expect(sim.abilGroups.has('0|hotaru.hush')).toBe(true);
  });
});
