// Tenka's Joint Research (T2, src/sim/lab.js; GAPS 5.10, P-13): at Joint Research (tier 3) and again at
// Unified Theory (tier 5) her owner's girls in her range join her lab team (they leave the field to help her
// research and are back after the battle). Who joins (own girls only, never heroes or another Tenka, uid
// order, no refund), how they leave (exactly like a sale: the final tier, brews, projectiles, traps and
// strips, sentries, balls), the five class weapons and their √(coins) scaling, the economy weapon's wave
// income (owner-credited, never with noIncome), selling her (70% of her own coins), and restores: a co-op
// checkpoint re-derives her stats and plays on identically, and a restore never absorbs.
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { UNITS as FX, ENEMIES, STAGE, testData } from './fixtures.js';
import { UNIT_MAP } from '../../src/data/units.js';
import { towerResolvedStats } from '../../src/sim/towers.js';
import { labStrength, labMods, labClassOf, emptyLab, LAB_CLASSES } from '../../src/sim/lab.js';
import {
  LAB_REF_COINS, LAB_FRAG_TICKS, LAB_FRAG_MUL, LAB_FRAG_SPLASH, LAB_FIELD_RANGE, LAB_ECON_SHARE, LAB_BOLTS_MAX, LAB_AURA_MAX,
} from '../../src/sim/constants.js';
import { rederiveStats } from '../../src/online/coop/lockstep.js';
import { hashSim } from '../../src/online/coop/simHash.js';
import { BATTLE } from '../../src/data/types.js';

const LAB = 0;
const RAILS = 1;
const SING = 2;
// a fixture brewer (Midori's limited buff on the fixture archer): one girl in her range at ×1.5
const brewer = { ...FX.archer, id: 'brewer', name: 'brewer', role: 'alchemist', base: { ...FX.archer.base, brew: { targets: 1, dmgMul: 1.5 } } };
const XU = {
  ...FX, tenka: UNIT_MAP.tenka, brewer, azami: UNIT_MAP.azami, yuzuha: UNIT_MAP.yuzuha, marumi: UNIT_MAP.marumi, chigusa: UNIT_MAP.chigusa,
};
const QUIET = { ...STAGE, waves: 5, waveGen: { pool: [], budget: { start: 1, growth: 1 } } };
const TEAM = ['tenka', 'archer', 'bomber', 'trapper', 'chime', 'banker', 'brewer', 'azami', 'yuzuha', 'marumi'];
// the test map's road runs along y = 4.5; Tenka stands at AT (range 3.4, 4.0 from Long Rails)
const AT = [8.5, 3.4];

const simArgs = ({ seed = 5, difficulty = 'normal', hero = null } = {}) => ({
  stageId: QUIET.id, difficulty, seed, hero: hero ? { unitId: hero } : null,
  loadout: TEAM.map((unitId) => ({ unitId })),
  data: testData({ stage: QUIET, units: XU, enemies: ENEMIES }),
});
function mk(o = {}) {
  const sim = new Sim(simArgs(o));
  sim.cash = 1e9;
  return sim;
}
const place = (sim, id, x, y, o) => {
  const t = sim.placeTower(id, x, y, o);
  expect(t, `${id} at ${x}, ${y}`).toBeTruthy();
  return t;
};
/** Tenka at AT, her highest path first (the crosspath rule lets one path past tier 2). */
function tenkaAt(sim, tiers = [0, 0, 0], o) {
  const t = place(sim, 'tenka', ...AT, o);
  for (const p of [0, 1, 2].sort((a, b) => tiers[b] - tiers[a])) for (let i = 0; i < tiers[p]; i++) expect(sim.upgradeTower(t.uid, p)).toBe(true);
  return t;
}
const up = (sim, t, path, n = 1) => { for (let i = 0; i < n; i++) expect(sim.upgradeTower(t.uid, path)).toBe(true); };
function wave(sim) {
  sim.state = 'wave';
  sim.wave = Math.max(1, sim.wave);
  sim._spawnQueue = [];
  sim._spawnIndex = 0;
}
/** An enemy standing still on the road at path distance x + 1 (it stands at x + 0.5). */
function park(sim, id, x, o = {}) {
  const e = sim.spawnEnemy(id, { dist: x + 1, ...o });
  e.baseSpeed = 0;
  e.speed = 0;
  return e;
}
const steps = (sim, n) => { for (let i = 0; i < n; i++) sim.update(1 / 60); };
const ofType = (evs, type) => evs.filter((x) => x.type === type);

describe('who joins her lab team', () => {
  test('Joint Research: her own girls in her range join in uid order, for no coins back; heroes, another Tenka and girls out of range stay', () => {
    const sim = mk({ hero: 'heroine' });
    const t = tenkaAt(sim, [2, 0, 0]);
    const hero = place(sim, 'heroine', 9.5, 2.4);
    const b = place(sim, 'bomber', 8.5, 2.4);
    const a = place(sim, 'archer', 9.5, 3.4);
    const other = place(sim, 'tenka', 6.5, 3.4); // another Tenka, 2 tiles away
    const far = place(sim, 'archer', 13.5, 3.4); // 5 tiles: out of her 4
    expect(t.eff.range).toBeCloseTo(4, 9);
    const cash = sim.cash;
    const cost = sim.upgradeStatus(t.uid, LAB).cost;
    sim.drainEvents();
    up(sim, t, LAB);
    // no refund: only the tier's price left her wallet
    expect(sim.cash).toBe(cash - cost);
    for (const g of [a, b]) {
      expect(sim.towers.includes(g)).toBe(false);
      expect(sim.getTower(g.uid)).toBe(null);
      expect(g.removed).toBe(true);
    }
    for (const g of [hero, other, far]) expect(sim.towers.includes(g)).toBe(true);
    expect(t.lab).toEqual({
      rounds: 1,
      members: { dps: 1, frag: 1, control: 0, support: 0, economy: 0 },
      coins: { dps: a.spent, frag: b.spent, control: 0, support: 0, economy: 0 },
      income: 0,
      uids: [b.uid, a.uid],
    });
    const evs = sim.drainEvents();
    // the upgrade, then the lab team (no sale: nobody was sold)
    expect(evs.map((x) => x.type).filter((k) => k === 'upgrade' || k === 'labJoin' || k === 'sell')).toEqual(['upgrade', 'labJoin']);
    expect(ofType(evs, 'labJoin')).toEqual([{
      type: 'labJoin', towerUid: t.uid, owner: 0, round: 1, uids: [b.uid, a.uid], members: { dps: 1, frag: 1, control: 0, support: 0, economy: 0 },
    }]);
    expect(sim.stats.labJoined).toBe(2);
    // Grand Lab adds no round: nobody else joins (no labJoin; her record keeps the same team)
    const late = place(sim, 'archer', 9.5, 5.6);
    up(sim, t, LAB);
    expect(ofType(sim.drainEvents(), 'labJoin')).toEqual([]);
    expect(t.lab.uids).toEqual([b.uid, a.uid]);
    expect(sim.towers.includes(late)).toBe(true);
    // the other Tenka never absorbs her (or anyone) without a lab tier of her own
    expect(other.lab).toBeUndefined();
  });

  test('a co-op partner\'s girls never join, even standing next to her', () => {
    const sim = mk();
    const t = tenkaAt(sim, [2, 0, 0], { owner: 1 });
    const mine = place(sim, 'archer', 9.5, 3.4, { owner: 1 });
    const theirs = place(sim, 'archer', 7.5, 3.4, { owner: 0 });
    const theirsB = place(sim, 'bomber', 8.5, 2.4, { owner: 0 });
    up(sim, t, LAB);
    expect(sim.towers.includes(theirs) && sim.towers.includes(theirsB)).toBe(true);
    expect(t.lab.uids).toEqual([mine.uid]);
  });

  test('nobody in range: the round is still spent, the record is empty and she fights as before', () => {
    const sim = mk();
    const t = tenkaAt(sim, [3, 0, 0]);
    expect(ofType(sim.drainEvents(), 'labJoin').map((x) => x.uids)).toEqual([[]]);
    expect(t.lab).toEqual({ ...emptyLab(), rounds: 1 });
    expect(JSON.stringify(t.stats)).toBe(JSON.stringify(towerResolvedStats({ ...t, lab: undefined })));
  });

  test('Unified Theory (tier 5) absorbs a second time; Grand Lab (tier 4) does not', () => {
    const sim = mk();
    const t = tenkaAt(sim, [2, 0, 0]);
    const a = place(sim, 'archer', 9.5, 3.4);
    up(sim, t, LAB);
    const c = place(sim, 'chime', 7.5, 3.4);
    up(sim, t, LAB); // Grand Lab
    expect(sim.towers.includes(c)).toBe(true);
    expect(t.lab.rounds).toBe(1);
    sim.drainEvents();
    up(sim, t, LAB); // Unified Theory
    expect(ofType(sim.drainEvents(), 'labJoin')).toMatchObject([{ round: 2, uids: [c.uid] }]);
    expect(sim.towers.includes(c)).toBe(false);
    expect(t.lab.rounds).toBe(2);
    expect(t.lab.uids).toEqual([a.uid, c.uid]);
    expect(t.lab.members).toMatchObject({ dps: 1, support: 1 });
    expect(t.stats.lab).toEqual({ rounds: 2, power: 3 });
  });

  test('every class: the role\'s category, a tower whose category is not one of the five counts as dps', () => {
    expect(['archer', 'bomber', 'trapper', 'chime', 'banker', 'beamer', 'priest', 'engineer'].map((id) => labClassOf(XU[id])))
      .toEqual(['dps', 'frag', 'control', 'support', 'economy', 'dps', 'control', 'support']);
    expect(LAB_CLASSES).toEqual(['dps', 'frag', 'control', 'support', 'economy']);
    expect(labClassOf(UNIT_MAP.momo)).toBe('economy');
    expect(labClassOf(UNIT_MAP.miko)).toBe('support');
  });
});

describe('a girl who joins leaves the field like a sale', () => {
  test('the final tier she held is free: another copy of hers can buy it now', () => {
    const sim = mk();
    const t = tenkaAt(sim, [2, 0, 0]);
    const holder = place(sim, 'archer', 9.5, 3.4);
    up(sim, holder, 0, 5);
    const copy = place(sim, 'archer', 13.5, 3.4);
    up(sim, copy, 0, 4);
    expect(sim.upgradeStatus(copy.uid, 0)).toMatchObject({ locked: true, reason: 'onePerPath', holder: holder.uid });
    up(sim, t, LAB);
    expect(sim.towers.includes(holder)).toBe(false);
    expect(sim.upgradeStatus(copy.uid, 0)).toMatchObject({ locked: false, reason: null });
    up(sim, copy, 0);
    expect(copy.tiers[0]).toBe(5);
  });

  test('her brews end: the girl she brewed loses it on the next step', () => {
    const sim = mk();
    const t = tenkaAt(sim, [2, 0, 0]);
    const br = place(sim, 'brewer', 11.5, 3.4); // 3 tiles from Tenka
    const a = place(sim, 'archer', 13.5, 3.4); // 2 from the brewer, 5 from Tenka
    const dmg = a.eff.damage;
    expect(sim.setBuffPick(br.uid, a.uid).ok).toBe(true); // (else she would brew Tenka, the bigger hitter)
    steps(sim, 2);
    expect(a.limIn?.brew).toBe(br.uid);
    expect(a.eff.damage).toBeCloseTo(dmg * 1.5, 9);
    up(sim, t, LAB);
    expect(sim.towers.includes(br)).toBe(false);
    steps(sim, 1);
    expect(a.limIn.brew).toBe(-1);
    expect(a.eff.damage).toBeCloseTo(dmg, 9);
  });

  test('her projectiles in flight fizzle and credit her nothing more', () => {
    const sim = mk();
    const t = tenkaAt(sim, [2, 0, 0]);
    const a = place(sim, 'archer', 9.5, 3.4);
    wave(sim);
    park(sim, 'tank', 11.5);
    let n = 0;
    while (!sim.projectiles.some((p) => p.owner === a) && n++ < 120) sim.update(1 / 60);
    expect(sim.projectiles.some((p) => p.owner === a)).toBe(true);
    const dealt = a.damageDealt;
    up(sim, t, LAB);
    steps(sim, 1);
    expect(sim.projectiles.some((p) => p.owner === a)).toBe(false);
    steps(sim, 60);
    expect(a.damageDealt).toBe(dealt);
  });

  test('her traps, spike strips, sentries and balls go with her', () => {
    const sim = mk();
    const t = tenkaAt(sim, [2, 0, 0]);
    const tr = place(sim, 'trapper', 8.5, 2.4);
    const az = place(sim, 'azami', 9.5, 2.4);
    const yz = place(sim, 'yuzuha', 7.5, 5.6);
    const mb = place(sim, 'marumi', 9.5, 5.6);
    wave(sim);
    for (let x = 6; x <= 11; x++) park(sim, 'tank', x);
    const has = () => sim.traps.some((x) => x.ownerUid === tr.uid) && sim.traps.some((x) => x.ownerUid === az.uid && x.strip)
      && yz.sentries?.length > 0 && mb.balls?.length > 0;
    let n = 0;
    while (!has() && n++ < 60 * 30) sim.update(1 / 60);
    expect([sim.traps.some((x) => x.ownerUid === tr.uid), sim.traps.some((x) => x.ownerUid === az.uid), yz.sentries?.length > 0, mb.balls?.length > 0]).toEqual([true, true, true, true]);
    up(sim, t, LAB);
    const gone = [tr, az, yz, mb];
    expect(t.lab.uids).toEqual(gone.map((g) => g.uid).sort((x, y) => x - y));
    expect(sim.traps.some((x) => gone.some((g) => g.uid === x.ownerUid))).toBe(false);
    expect(t.lab.members).toMatchObject({ control: 2, support: 1 });
    sim.drainEvents();
    const dealt = gone.map((g) => g.damageDealt);
    steps(sim, 300);
    // nothing of theirs acts again: no trap, strip, sentry or ball of theirs, no damage credited
    const evs = sim.drainEvents();
    expect(evs.some((x) => gone.some((g) => g.uid === (x.ownerUid ?? x.towerUid)))).toBe(false);
    expect(gone.map((g) => g.damageDealt)).toEqual(dealt);
    expect(sim.traps.some((x) => gone.some((g) => g.uid === x.ownerUid))).toBe(false);
  });
});

describe('the lab weapons', () => {
  test('√(coins) scaling: power × √(coins / LAB_REF_COINS) per class; four 200-coin girls lend what one 800-coin girl does', () => {
    const lab = emptyLab();
    expect(labStrength(lab, 'dps', 3)).toBe(0);
    lab.members.dps = 1;
    lab.coins.dps = LAB_REF_COINS;
    expect(labStrength(lab, 'dps', 1)).toBe(1);
    lab.coins.dps = 4 * LAB_REF_COINS;
    expect(labStrength(lab, 'dps', 1.5)).toBe(3);
    expect(labStrength(lab, 'frag', 1.5)).toBe(0);
    // the weapons' ModSet: +2 bolts × k (at most LAB_BOLTS_MAX), a +15% × k aura of 3 (at most +LAB_AURA_MAX)
    expect(labMods(lab, 1)).toEqual({ projectiles: 4 });
    lab.coins.dps = 100 * LAB_REF_COINS;
    expect(labMods(lab, 3).projectiles).toBe(LAB_BOLTS_MAX);
    lab.members.support = 1;
    lab.coins.support = LAB_REF_COINS;
    expect(labMods(lab, 1).aura).toEqual({ range: 3, dmgMul: 1.15 });
    expect(labMods(lab, 10).aura.dmgMul).toBe(1 + LAB_AURA_MAX);
    expect(labMods(emptyLab(), 3)).toBe(null);

    const four = mk();
    const t4 = tenkaAt(four, [2, 0, 0]);
    for (const [x, y] of [[9.5, 3.4], [7.5, 3.4], [9.5, 2.4], [8.5, 2.4]]) place(four, 'archer', x, y);
    up(four, t4, LAB);
    const one = mk();
    const t1 = tenkaAt(one, [2, 0, 0]);
    const a = place(one, 'archer', 9.5, 3.4);
    up(one, a, 0, 3); // 200 + 100 + 200 + 600 = 1100 coins
    up(one, a, 1, 1); // + 100: 1200
    expect(a.spent).toBe(1200);
    four.towers.length; // (four × 200 = 800)
    expect(t4.lab.coins.dps).toBe(800);
    expect(t4.lab.members.dps).toBe(4);
    up(one, t1, LAB);
    expect(t1.lab.coins.dps).toBe(1200);
    // projectiles: 1 + round(2 × √(coins / 2000)): 800 → 1 + 1.26 → 2; 1200 → 1 + 1.55 → 3
    expect(t4.eff.projectiles).toBe(1 + Math.round(2 * Math.sqrt(800 / LAB_REF_COINS)));
    expect(t1.eff.projectiles).toBe(1 + Math.round(2 * Math.sqrt(1200 / LAB_REF_COINS)));
    expect([t4.eff.projectiles, t1.eff.projectiles]).toEqual([2, 3]);
  });

  test('dps: her extra coil bolts hit harder than her own alone (Grand Lab and Unified Theory multiply them)', () => {
    const plain = mk();
    const p = tenkaAt(plain, [3, 0, 0]); // nobody joined
    const lab = mk();
    const t = tenkaAt(lab, [2, 0, 0]);
    const a = place(lab, 'archer', 9.5, 3.4);
    up(lab, a, 0, 4); // 200 + 2900 = 3100 coins
    up(lab, t, LAB);
    const k = Math.sqrt(3100 / LAB_REF_COINS);
    expect(t.eff.projectiles).toBe(1 + Math.round(2 * k));
    up(lab, t, LAB); // Grand Lab ×1.5
    expect(t.eff.projectiles).toBe(1 + Math.round(2 * 1.5 * k));
    for (const s of [plain, lab]) {
      wave(s);
      park(s, 'tank', 8.5);
    }
    steps(plain, 120);
    steps(lab, 120);
    // (Grand Lab's +30 damage on top; the bolts are what this pins: × projectiles on one target)
    expect(t.damageDealt / p.damageDealt).toBeGreaterThan(t.eff.projectiles * 0.9 * (t.eff.damage / p.eff.damage));
  });

  test('support: a damage aura around her (radius 3) for the girls placed after, never on herself', () => {
    const sim = mk();
    const t = tenkaAt(sim, [2, 0, 0]);
    const c = place(sim, 'chime', 9.5, 3.4);
    up(sim, t, LAB);
    const k = Math.sqrt(c.spent / LAB_REF_COINS);
    expect(t.stats.aura).toMatchObject({ range: 3, dmgMul: 1 + 0.15 * k });
    expect(t.buff.dmgMul).toBe(1);
    const near = place(sim, 'archer', 10.5, 3.4); // 2 tiles
    const out = place(sim, 'archer', 12.5, 3.4); // 4 tiles
    steps(sim, 1);
    expect(near.buff.dmgMul).toBeCloseTo(1 + 0.15 * k, 12);
    expect(out.buff.dmgMul).toBe(1);
  });

  test('frag: a plasma grenade every 2 s at her best target, a blast of 1.2 tiles of her bolt damage × 6 × k', () => {
    const sim = mk();
    const t = tenkaAt(sim, [2, 0, 0]);
    const b = place(sim, 'bomber', 9.5, 3.4);
    up(sim, t, LAB);
    const k = Math.sqrt(b.spent / LAB_REF_COINS);
    expect(t.labAtk).toMatchObject({ frag: k, slow: 0 });
    wave(sim);
    park(sim, 'tank', 8.5);
    const far = park(sim, 'tank', 11.2); // the leader, inside her range
    sim.drainEvents();
    const frags = [];
    for (let i = 0; i < LAB_FRAG_TICKS * 3; i++) {
      sim.update(1 / 60);
      for (const x of sim.drainEvents()) if (x.type === 'labFrag') frags.push([i, x.x, x.y, x.radius]);
    }
    // the first at once, then every 120 ticks, on the leader (her targeting: first)
    expect(frags.map((f) => f[0])).toEqual([0, LAB_FRAG_TICKS, 2 * LAB_FRAG_TICKS]);
    expect(frags[0][3]).toBe(LAB_FRAG_SPLASH);
    expect([frags[0][1], frags[0][2]]).toEqual([far.x, far.y]);
  });

  test('frag blast: everything within 1.2 tiles of the target takes her bolt damage × 6 × k as a blast', () => {
    const sim = mk();
    const t = tenkaAt(sim, [2, 0, 0]);
    const b = place(sim, 'bomber', 9.5, 3.4);
    up(sim, t, LAB);
    const k = Math.sqrt(b.spent / LAB_REF_COINS);
    wave(sim);
    const lead = park(sim, 'tank', 10.5);
    const side = park(sim, 'tank', 9.6); // 0.9 behind the leader
    const out = park(sim, 'tank', 8.9); // 1.6 behind
    sim.drainEvents();
    // her own bolts held back this step (a long cooldown): only the grenade hits
    t.cooldown = 1e9;
    sim.update(1 / 60);
    const ex = ofType(sim.drainEvents(), 'explode');
    expect(ex).toContainEqual({ type: 'explode', x: lead.x, y: lead.y, radius: LAB_FRAG_SPLASH, element: null, attackType: 'blast' });
    // (blast on the fixture tank: light armour, no armour points; the chart's blast-vs-light factor applies)
    expect(lead.maxHp - lead.hp).toBeGreaterThan(t.eff.damage * LAB_FRAG_MUL * k * 0.5);
    expect(side.maxHp - side.hp).toBeCloseTo(lead.maxHp - lead.hp, 6);
    expect(out.hp).toBe(out.maxHp);
  });

  test('control: a slow field within 2 tiles of her, 20% × k (at most 50%), refreshed while they stay', () => {
    const sim = mk();
    const t = tenkaAt(sim, [2, 0, 0]);
    const g = place(sim, 'trapper', 9.5, 3.4);
    up(sim, t, LAB);
    const k = Math.sqrt(g.spent / LAB_REF_COINS);
    expect(t.labAtk.slow).toBeCloseTo(Math.min(0.5, 0.2 * k), 12);
    wave(sim);
    const inside = park(sim, 'tank', 8.5); // ~1.1 tiles from her
    const outside = park(sim, 'tank', 12); // ~4 tiles
    steps(sim, 2);
    expect(inside.statuses.slow?.amount).toBeCloseTo(t.labAtk.slow, 12);
    expect(outside.statuses.slow).toBeUndefined();
    steps(sim, 60);
    expect(inside.statuses.slow).toBeTruthy();
    expect(LAB_FIELD_RANGE).toBe(2);
  });

  test('economy: 30% of the economy girls\' income × power at every wave clear, to her owner; nothing on a noIncome difficulty', () => {
    const run = (difficulty, owner) => {
      const sim = mk({ difficulty });
      if (owner) sim.ownerCash = [0, 0];
      const t = tenkaAt(sim, [2, 0, 0], { owner });
      place(sim, 'banker', 9.5, 3.4, { owner });
      up(sim, t, LAB);
      expect(t.lab).toMatchObject({ income: 100, members: { economy: 1 } });
      wave(sim);
      const cash = sim.cash;
      sim.drainEvents();
      steps(sim, 1); // the field is empty: the wave clears
      expect(sim.state).toBe('between');
      const evs = sim.drainEvents();
      const lab = ofType(evs, 'cash').filter((x) => x.reason === 'lab');
      const bonus = ofType(evs, 'cash').filter((x) => x.reason === 'waveBonus').reduce((s, x) => s + x.amount, 0);
      return { sim, t, lab, gained: sim.cash - cash - bonus };
    };
    const solo = run('normal', 0);
    const want = Math.floor(LAB_ECON_SHARE * 100 * 1 * (solo.sim.diff.cashMul ?? 1) * solo.sim.incomeMul + 1e-9);
    expect(want).toBeGreaterThan(0);
    expect(solo.lab).toEqual([{ type: 'cash', amount: want, reason: 'lab', towerUid: solo.t.uid }]);
    expect(solo.gained).toBe(want);
    // owner-credited: player 1's Tenka pays player 1 (ownerCash), never the pooled cash
    const coop = run('normal', 1);
    expect(coop.sim.ownerCash).toEqual([0, want]);
    expect(coop.gained).toBe(0);
    // Nightmare (noIncome): no lab income
    const nm = run('nightmare', 0);
    expect(nm.sim.diff.noIncome).toBe(true);
    expect(nm.lab).toEqual([]);
    expect(nm.gained).toBe(0);
  });

  // T2 review spec-1, pinned as built: the economy weapon counts the ECONOMY girls' income (CONTRACTS §6),
  // so a non-economy girl with wave income lends her class's weapon and her income stops. Whether her income
  // should count too is the owner's call (notes/T2.md, call #1); change this test with that decision.
  test('economy counts the economy girls\' income only: a Harvest Chigusa (control) lends the slow field, and her wave income stops', () => {
    const sim = new Sim({ ...simArgs(), loadout: [...TEAM, 'chigusa'].map((unitId) => ({ unitId })) });
    sim.cash = 1e9;
    const t = tenkaAt(sim, [2, 0, 0]);
    const g = place(sim, 'chigusa', 9.5, 3.4);
    up(sim, g, 2, 2); // Harvest: Compost, Vegetable Patch (+25 coins a wave)
    expect(labClassOf(g.def)).toBe('control');
    expect(g.stats.income.perWave).toBe(25);
    const clear = () => {
      wave(sim);
      sim.drainEvents();
      steps(sim, 1); // the field is empty: the wave clears
      expect(sim.state).toBe('between');
      return ofType(sim.drainEvents(), 'cash').filter((x) => x.reason !== 'waveBonus').map((x) => [x.reason, x.towerUid]);
    };
    expect(clear()).toEqual([['income', g.uid]]);
    up(sim, t, LAB);
    expect(t.lab).toMatchObject({ members: { control: 1, economy: 0 }, income: 0, uids: [g.uid] });
    expect(t.labAtk.slow).toBeGreaterThan(0);
    expect(clear()).toEqual([]);
  });

  test('a sabotaged Tenka\'s frag and field rest, like her bolts', () => {
    const sim = mk();
    const t = tenkaAt(sim, [2, 0, 0]);
    place(sim, 'bomber', 9.5, 3.4);
    place(sim, 'trapper', 7.5, 3.4);
    up(sim, t, LAB);
    wave(sim);
    const e = park(sim, 'tank', 8.5);
    t.disabled = 5;
    sim.drainEvents();
    steps(sim, 60);
    expect(ofType(sim.drainEvents(), 'labFrag')).toEqual([]);
    expect(e.statuses.slow).toBeUndefined();
  });
});

describe('selling her, restores and determinism', () => {
  test('selling Tenka refunds 70% of her own coins; the lab team does not come back this battle', () => {
    const sim = mk();
    const t = tenkaAt(sim, [2, 0, 0]);
    const a = place(sim, 'archer', 9.5, 3.4);
    up(sim, a, 0, 4);
    up(sim, t, LAB);
    expect(t.spent).toBe(1800 + 300 + 700 + 3000);
    const n = sim.towers.length;
    const cash = sim.cash;
    expect(sim.sellTower(t.uid)).toBe(Math.floor((1800 + 300 + 700 + 3000) * BATTLE.sellRefund));
    expect(sim.cash).toBe(cash + Math.floor(5800 * BATTLE.sellRefund));
    expect(sim.towers.length).toBe(n - 1);
    expect(sim.getTower(a.uid)).toBe(null);
    expect(sim._labOn).toBe(0);
    steps(sim, 10);
  });

  test('a restore never absorbs: { restoring: true } buys the tier and nobody joins', () => {
    const sim = mk();
    const t = tenkaAt(sim, [2, 0, 0]);
    const a = place(sim, 'archer', 9.5, 3.4);
    expect(sim.upgradeTower(t.uid, LAB, { restoring: true })).toBe(true);
    expect(sim.towers.includes(a)).toBe(true);
    expect(t.lab).toBeUndefined();
    up(sim, t, LAB);
    expect(sim.upgradeTower(t.uid, LAB, { restoring: true })).toBe(true); // Unified Theory under a restore
    expect(sim.towers.includes(a)).toBe(true);
    expect(t.lab).toBeUndefined();
  });

  // T2 review saves-3: a battle save's restore replays her tiers with { restoring: true }, which never
  // absorbs, so any Sim field the absorb itself leaves behind could never come back (the save's round-trip
  // digest compares every own Sim field). Only _labOn may appear, and syncLab rebuilds it from her record.
  test('Joint Research leaves no Sim field behind but _labOn: who joined is on her record, not on the Sim', () => {
    const run = (restoring) => {
      const sim = mk();
      const t = tenkaAt(sim, [2, 0, 0]);
      for (const [id, x, y] of [['archer', 9.5, 3.4], ['banker', 8.5, 5.6]]) place(sim, id, x, y);
      expect(sim.upgradeTower(t.uid, LAB, restoring ? { restoring: true } : undefined)).toBe(true);
      up(sim, t, RAILS); // a later upgrade
      sim.startNextWave();
      steps(sim, 120);
      sim.drainEvents();
      return { sim, t };
    };
    const lab = run(false);
    const replay = run(true);
    expect(lab.t.lab.uids.length).toBe(2);
    expect(replay.t.lab).toBeUndefined();
    const k1 = Object.keys(lab.sim);
    const k2 = Object.keys(replay.sim);
    expect(k1.filter((k) => !k2.includes(k))).toEqual(['_labOn']);
    expect(k2.filter((k) => !k1.includes(k))).toEqual([]);
  });

  test('a co-op checkpoint with every weapon re-derives her stats (rederiveStats 0), never re-absorbs, and both copies play on identically through a second absorb and a sale', () => {
    const sim = mk();
    const t = tenkaAt(sim, [2, 0, 0]);
    for (const [id, x, y] of [['archer', 9.5, 3.4], ['bomber', 7.5, 3.4], ['trapper', 9.5, 2.4], ['chime', 8.5, 2.4], ['banker', 8.5, 5.6]]) place(sim, id, x, y);
    up(sim, t, LAB);
    expect(t.lab.members).toEqual({ dps: 1, frag: 1, control: 1, support: 1, economy: 1 });
    const keep = place(sim, 'archer', 10.5, 2.4); // placed after: stays
    up(sim, t, LAB); // Grand Lab
    expect(rederiveStats(sim)).toBe(0);
    expect(JSON.stringify(towerResolvedStats(t))).toBe(JSON.stringify(t.stats));
    wave(sim);
    for (const x of [7, 8.5, 10, 11.2]) park(sim, 'tank', x);
    steps(sim, 100);
    const copy = new Sim(simArgs()).restore(JSON.parse(JSON.stringify(sim.snapshot())));
    const c = copy.getTower(t.uid);
    expect(c.lab).toEqual(t.lab);
    expect(c.labAtk).toEqual(t.labAtk);
    expect(copy._labOn).toBe(1);
    expect(rederiveStats(copy)).toBe(0);
    expect(hashSim(copy)).toBe(hashSim(sim));
    expect(copy.getTower(keep.uid)).toBeTruthy();
    const both = (n) => {
      for (let i = 0; i < n; i++) {
        sim.update(1 / 60);
        copy.update(1 / 60);
      }
    };
    both(400);
    expect(JSON.stringify(copy.snapshot())).toBe(JSON.stringify(sim.snapshot()));
    expect(rederiveStats(copy)).toBe(0);
    // then both play on through a second absorb (Unified Theory, bought mid-wave) and a mid-wave sale of
    // Tenka (UNIT_GAPS §8: her own determinism tests; T2 review determinism-2)
    for (const s of [sim, copy]) {
      wave(s);
      for (const x of [7, 10, 11.2]) {
        const e = park(s, 'tank', x);
        e.maxHp = 1e7; // the wave outlasts the sale
        e.hp = 1e7;
      }
      place(s, 'bomber', 9.5, 3.4); // placed after Grand Lab, in her range
      s.drainEvents();
    }
    both(30);
    const joins = [sim, copy].map((s) => {
      up(s, s.getTower(t.uid), LAB); // Unified Theory
      return ofType(s.drainEvents(), 'labJoin');
    });
    expect(joins[0]).toMatchObject([{ round: 2 }]);
    expect(joins[0][0].uids).toContain(keep.uid);
    expect(joins[1]).toEqual(joins[0]);
    expect(copy.getTower(t.uid).lab).toEqual(t.lab);
    expect(copy.getTower(t.uid).labAtk).toEqual(t.labAtk);
    expect(hashSim(copy)).toBe(hashSim(sim));
    both(200);
    expect(sim.state).toBe('wave');
    expect(JSON.stringify(copy.snapshot())).toBe(JSON.stringify(sim.snapshot()));
    const refund = sim.sellTower(t.uid);
    expect(refund).toBeGreaterThan(0);
    expect(copy.sellTower(t.uid)).toBe(refund);
    expect([sim._labOn, copy._labOn]).toEqual([0, 0]);
    both(200);
    expect(JSON.stringify(copy.snapshot())).toBe(JSON.stringify(sim.snapshot()));
    expect(hashSim(copy)).toBe(hashSim(sim));
    expect(rederiveStats(copy)).toBe(0);
  });

  test('two runs of the same commands are identical (uid order, ticks, no rng)', () => {
    const run = () => {
      const sim = mk({ seed: 9 });
      const t = tenkaAt(sim, [2, 0, 0]);
      for (const [id, x, y] of [['trapper', 9.5, 2.4], ['archer', 9.5, 3.4], ['bomber', 7.5, 3.4], ['chime', 8.5, 2.4]]) place(sim, id, x, y);
      up(sim, t, LAB, 3);
      sim.startNextWave();
      for (const x of [7, 8.5, 10]) park(sim, 'tank', x);
      steps(sim, 600);
      return JSON.stringify(sim.snapshot());
    };
    expect(run()).toBe(run());
  });

  test('her other paths never absorb (Rail Arms and Singularity tiers 3 and 5)', () => {
    for (const path of [RAILS, SING]) {
      const sim = mk();
      const t = tenkaAt(sim, [0, 0, 0]);
      const a = place(sim, 'archer', 9.5, 3.4);
      up(sim, t, path, 5);
      expect(sim.towers.includes(a)).toBe(true);
      expect(t.lab).toBeUndefined();
    }
  });
});
