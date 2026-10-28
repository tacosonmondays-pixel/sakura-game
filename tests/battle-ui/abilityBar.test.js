// The ability bar's pure halves (src/ui/battle/abilityBar.js; ABILITIES_SPEC §8.1–§8.3, §8.5, UI_DIRECTION §6.6):
// slots appear on unlock in tower-bar order, copies grouped with ×N, at most one number per slot, every state
// (charging, ready, pending, active, between waves, blocked: sabotaged / cap / no income / nothing in reach), the
// globe for map scope, the aim kinds, never an ally's girl or a hero; the keys (Digit / Numpad, Shift, paused,
// typing); the co-op command arguments; a refusal line for every reason; the first-unlock toast once per id and the
// ally chip at most every 3 s.
import { describe, it, expect, afterEach } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import {
  abilityBarView, slotNumbers, slotState, abilityCommandArgs, battleKeyAction, refusalText, REFUSAL_REASONS,
  createAbilityNotes, unlockText, allyChipText, lifeText, abilityCardView, wholeSeconds, ALLY_CHIP_MS, abilityResultLine,
  slotTapPlan, aimCaster, coopCastCheck, clearPendingFor, cardSide, groupCaster, abilityReachCount, createAbilityBar,
  soloAbilityActs, coopAbilityActs,
} from '../../src/ui/battle/abilityBar.js';
import { treeKeyAction } from '../../src/ui/battle/upgradeTree.js';
import { segDistSq } from '../../src/sim/path.js';
import { FakeEl, installFakeDom } from './fakeDom.js';
import { abilityInfoView } from '../../src/ui/girlView.js';
import { DEFAULT_SETTINGS, createProfile, migrateProfile } from '../../src/systems/save.js';
import { autoAbilities } from '../../src/ui/battle/setup.js';
import { abilityPathOf, abilityDef, abilityOrigin, TRANSIENT_REFUSALS } from '../../src/sim/abilities.js';
import { STEP } from '../../src/sim/constants.js';
import { STAGE, testData } from '../sim/fixtures.js';
import { defaultData } from '../../src/sim/data.js';
import { ABILITY_TEXT, abilityAim } from '../../src/data/abilityText.js';
import { ABILITIES } from '../../src/data/abilities.js';
import { UNIT_MAP } from '../../src/data/units.js';
import { createCoopSim, isValidCmd } from '../../src/online/coop/commands.js';

/** A real battle (1-2 Normal) with plenty of coins. */
function battle(ids, { hero = 'hikari', difficulty = 'normal', stageId = '1-2' } = {}) {
  const sim = new Sim({ stageId, difficulty, loadout: ids.map((unitId) => ({ unitId })), hero: hero ? { unitId: hero } : null, seed: 11 });
  sim.cash = 1e7;
  return sim;
}
/** Places a girl at the n-th legal spot (scanning the map), for `owner`. */
function place(sim, unitId, { skip = 0, owner = 0 } = {}) {
  let n = 0;
  for (let y = 0.6; y < sim.map.height; y += 0.45) {
    for (let x = 0.6; x < sim.map.width; x += 0.45) {
      if (!sim.canPlace(unitId, x, y).ok) continue;
      if (n++ < skip) continue;
      const t = sim.placeTower(unitId, x, y, { owner });
      if (t) return t;
    }
  }
  throw new Error(`no spot for ${unitId}`);
}
/** Buys tiers 1–3 of her ⚡ path. */
function unlock(sim, t, tiers = 3) {
  const p = abilityPathOf(t.def);
  for (let i = 0; i < tiers; i++) expect(sim.upgradeTower(t.uid, p)).toBeTruthy();
  return t;
}
const ready = (t) => {
  t.abil.cd = 0;
  return t;
};
const ids = (view) => view.map((s) => s.id);
/** The sim tests' fixture map (a straight road along y 4.5), quiet, with the real girls and enemies. */
const FIXTURE = { ...STAGE, waves: 5, waveGen: { pool: [], budget: { start: 1, growth: 1 } } };
const FIXTURE_D = defaultData();

describe('abilityBarView: slots', () => {
  it('a slot appears when her ⚡ tier 3 is bought, in tower-bar order, never before', () => {
    const sim = battle(['akane', 'aoi', 'momo']);
    const aoi = place(sim, 'aoi');
    const akane = place(sim, 'akane', { skip: 6 });
    expect(abilityBarView(sim, 0)).toEqual([]);
    unlock(sim, aoi, 2);
    expect(abilityBarView(sim, 0)).toEqual([]);
    unlock(sim, aoi, 1);
    expect(ids(abilityBarView(sim, 0))).toEqual(['aoi.skyfall']);
    unlock(sim, akane);
    // the bar follows the tower bar (loadout order: Akane before Aoi), not the order they unlocked in
    expect(ids(abilityBarView(sim, 0))).toEqual(['akane.starmine', 'aoi.skyfall']);
    const s = abilityBarView(sim, 0)[1];
    expect(s).toMatchObject({ name: 'Skyfall Volley', unitId: 'aoi', key: '2', map: false, aim: null, casters: [aoi.uid], casterUid: aoi.uid });
  });

  it('copies share one slot; ×N counts the ready copies; it is the slot\'s only number', () => {
    const sim = battle(['momo', 'aoi']);
    const a1 = unlock(sim, place(sim, 'aoi'));
    const a2 = unlock(sim, place(sim, 'aoi', { skip: 8 }));
    sim.startNextWave();
    let [s] = abilityBarView(sim, 0);
    expect(s.casters).toEqual([a1.uid, a2.uid]);
    expect(s.state).toBe('charging');
    ready(a1);
    [s] = abilityBarView(sim, 0);
    expect([s.state, s.ready, s.badge, s.label]).toEqual(['ready', 1, null, null]);
    ready(a2);
    [s] = abilityBarView(sim, 0);
    expect([s.state, s.ready, s.badge, s.label]).toEqual(['ready', 2, '×2', null]);
    expect(slotNumbers(s)).toBe(1);
    expect(s.aria).toMatch(/Skyfall Volley, ready/);
  });

  it('every state, each with at most one number', () => {
    const sim = battle(['aoi', 'momo', 'rei']);
    const aoi = unlock(sim, place(sim, 'aoi'));
    const rei = unlock(sim, place(sim, 'rei', { skip: 8 }));
    const slot = (id, o) => abilityBarView(sim, 0, o).find((s) => s.id === id);
    const seen = [];
    const check = (s, state) => {
      expect(s.state, s.id).toBe(state);
      expect(slotNumbers(s), `${state} numbers`).toBeLessThanOrEqual(1);
      seen.push(state);
    };
    // between waves: grey, frozen sweep, the WAVE label (not a number)
    let s = slot('aoi.skyfall');
    check(s, 'between');
    expect(s.label).toBe('WAVE');
    expect(slotNumbers(s)).toBe(0);
    expect(s.charge).toBeCloseTo(1 - 1 / 3, 2); // a fresh ability starts with 1/3 of its cooldown left
    sim.startNextWave();
    // charging: whole seconds (35 s × 1/3 → "12s")
    s = slot('aoi.skyfall');
    check(s, 'charging');
    expect(s.label).toBe('12s');
    expect(s.label).toBe(wholeSeconds(s.secondsLeft));
    expect(slotNumbers(s)).toBe(1);
    // ready
    ready(aoi);
    check(slot('aoi.skyfall'), 'ready');
    // pending (co-op: sent, waiting for its tick)
    check(slot('aoi.skyfall', { pending: new Set(['aoi.skyfall']) }), 'pending');
    // nothing in reach: a refused tap dims the slot for a moment
    const refused = new Map([['aoi.skyfall', { reason: 'noTarget', until: 1000 }]]);
    s = slot('aoi.skyfall', { refused, now: 500 });
    check(s, 'blocked');
    expect(s.reason).toBe('noTarget');
    check(slot('aoi.skyfall', { refused, now: 2000 }), 'ready');
    // sabotaged
    aoi.disabled = 3;
    s = slot('aoi.skyfall');
    check(s, 'blocked');
    expect(s.reason).toBe('disabled');
    aoi.disabled = 0;
    // active (Rei's Hurricane Draw: a 4 s boost) — a pink drain bar, no number
    ready(rei);
    rei.abil.active = 120;
    s = slot('rei.hurricane');
    check(s, 'active');
    expect(s.label).toBeNull();
    expect(s.activeLeft).toBeCloseTo(2, 5);
    expect(s.duration).toBe(4);
    expect(new Set(seen)).toEqual(new Set(['between', 'charging', 'ready', 'pending', 'blocked', 'active']));
  });

  it('econ: twice per wave (cap) and none on Nightmare (noIncome) are blocked', () => {
    const sim = battle(['momo']);
    const momo = ready(unlock(sim, place(sim, 'momo')));
    sim.startNextWave();
    expect(abilityBarView(sim, 0)[0].state).toBe('ready');
    sim.abilUses[0] = 2;
    expect(abilityBarView(sim, 0)[0]).toMatchObject({ state: 'blocked', reason: 'cap' });
    const night = battle(['momo'], { difficulty: 'nightmare' });
    const m2 = ready(unlock(night, place(night, 'momo')));
    night.startNextWave();
    expect(night.diff.noIncome).toBe(true);
    expect(abilityBarView(night, 0)[0]).toMatchObject({ state: 'blocked', reason: 'noIncome' });
    expect(momo.abil.kind).toBe(m2.abil.kind);
  });

  it('map-wide abilities carry the globe; aimed ones say how they aim', () => {
    const sim = battle(['hotaru', 'wakaba', 'yuzuha']);
    unlock(sim, place(sim, 'hotaru'));
    unlock(sim, place(sim, 'wakaba', { skip: 6 }));
    unlock(sim, place(sim, 'yuzuha', { skip: 12 }));
    const v = abilityBarView(sim, 0);
    expect(v.map((s) => [s.id, s.map, s.aim])).toEqual([
      ['hotaru.hush', true, null],
      ['wakaba.timeOut', false, 'girl'],
      ['yuzuha.emergencyDeploy', false, 'point'],
    ]);
  });

  it('only the abilities whose cast reads an aim are aimed (Time Out! a girl, Emergency Deploy a point)', () => {
    const aimed = Object.keys(ABILITY_TEXT).filter((id) => abilityAim(id));
    expect(aimed.sort()).toEqual(['wakaba.timeOut', 'yuzuha.emergencyDeploy']);
    const all = Object.values(ABILITIES).flatMap((r) => (Array.isArray(r) ? r : [r.skill]));
    const def = (id) => all.find((d) => d.id === id);
    expect(def('wakaba.timeOut').effect.target).toBe('girl');
    expect(def('yuzuha.emergencyDeploy').effect.deploy).toBe('sentries');
  });

  it('never an ally\'s girl, never a hero (her skill lives in the hero widget)', () => {
    const sim = battle(['aoi', 'miko']);
    unlock(sim, place(sim, 'aoi'));
    unlock(sim, place(sim, 'miko', { skip: 6, owner: 1 }));
    const hero = place(sim, 'hikari', { skip: 12 });
    for (let i = 0; i < 40 && hero.level < 7; i++) {
      const st = sim.heroLevelStatus();
      if (!sim.buyHeroLevel({ level: st.level + 1, maxPrice: st.price }).ok) break;
    }
    expect(hero.abil?.id).toBe('hikari.rally');
    expect(ids(abilityBarView(sim, 0))).toEqual(['aoi.skyfall']);
    expect(ids(abilityBarView(sim, 1))).toEqual(['miko.chorus']);
  });

  it('slotState: the reason order of the sim', () => {
    expect(slotState({ reason: 'notWave' }, 0)).toBe('between');
    expect(slotState({ reason: 'cooldown' }, 0)).toBe('charging');
    expect(slotState({ reason: 'active' }, 0)).toBe('active');
    for (const r of ['disabled', 'cap', 'noIncome', 'moving']) expect(slotState({ reason: r }, 0)).toBe('blocked');
    expect(slotState({ reason: 'cooldown' }, 1)).toBe('ready');
    expect(slotState({ reason: null }, 1, { pending: true })).toBe('pending');
  });
});

describe('the hold card', () => {
  it('her live description, the cooldown, the copies sharing it, Auto and the reach ring', () => {
    const sim = battle(['aoi']);
    const a1 = unlock(sim, place(sim, 'aoi'));
    const a2 = unlock(sim, place(sim, 'aoi', { skip: 8 }));
    a2.abil.auto = true;
    const [slot] = abilityBarView(sim, 0);
    const v = abilityCardView(sim, slot);
    expect(v.name).toBe('Skyfall Volley');
    expect(v.desc).toMatch(/^Rains arrows on up to 6 enemies within [\d.]+ tiles/);
    expect(v.desc).not.toMatch(/[{}]/);
    expect(v.cooldown).toBe('Recharges in 35s of wave time');
    expect(v.sharing).toBe('2 copies of Aoi share this button');
    expect(v.auto).toBe(false); // on only when every copy is on
    a1.abil.auto = true;
    expect(abilityCardView(sim, slot).auto).toBe(true);
    expect(v.reach).toMatchObject({ x: sim.getTower(slot.casterUid).x, y: sim.getTower(slot.casterUid).y });
    expect(v.reach.r).toBeGreaterThan(0);
    expect(v.help).toMatch(/hold/i);
  });

  it('a map-wide ability draws no reach ring', () => {
    const sim = battle(['hotaru']);
    unlock(sim, place(sim, 'hotaru'));
    expect(abilityCardView(sim, abilityBarView(sim, 0)[0]).reach).toBeNull();
  });

  it('Market Day (coins, per player): no reach ring, the recharge once, no Details-only sentence on the live card', () => {
    const sim = battle(['momo']);
    const momo = unlock(sim, place(sim, 'momo'));
    sim.startNextWave();
    // it starts uncharged: the state chip counts down, the total recharge is not repeated
    let v = abilityCardView(sim, abilityBarView(sim, 0)[0]);
    expect(v.reach).toBeNull();
    expect(v.state).toMatch(/^Recharging · \d+s$/);
    expect(v.cooldown).toBeNull();
    expect(v.scope).toBe('Per player');
    expect(v.desc).not.toMatch(/uncharged/);
    expect([v.state, v.cooldown, v.desc].join(' ').match(/Recharg/g)).toHaveLength(1);
    // ready: the total shows (once), still no ring
    momo.abil.cd = 0;
    v = abilityCardView(sim, abilityBarView(sim, 0)[0]);
    expect(v.state).toBe('Ready');
    expect(v.cooldown).toMatch(/^Recharges in \d+s of wave time$/);
    expect(v.reach).toBeNull();
    // the sentence lives on in the girl page's Details sheet
    expect(abilityInfoView(UNIT_MAP.momo).desc).toMatch(/never on Nightmare\. It starts uncharged\.$/);
  });

  it('inside Ouka\'s office (Club Mentors): the recharge and the countdown are real wave seconds (M2 review)', () => {
    const sim = battle(['ouka', 'aoi']);
    const o = place(sim, 'ouka');
    for (let i = 0; i < 3; i++) expect(sim.upgradeTower(o.uid, 1)).toBeTruthy(); // Assembly 3: Club Mentors
    // Aoi on the legal spot nearest her (inside her 3.2-tile office)
    let aoi = null;
    const spots = [];
    for (let y = 0.6; y < sim.map.height; y += 0.3) for (let x = 0.6; x < sim.map.width; x += 0.3) spots.push([Math.hypot(x - o.x, y - o.y), x, y]);
    for (const [, x, y] of spots.sort((p, q) => p[0] - q[0])) if (sim.canPlace('aoi', x, y).ok && (aoi = sim.placeTower('aoi', x, y))) break;
    unlock(sim, aoi);
    expect(aoi.rules?.cdCut).toBe(0.15);
    // between waves: the card's total is 35 s / 1.15, not 35 s
    const slot = () => abilityBarView(sim, 0).find((s) => s.id === 'aoi.skyfall');
    const card = () => abilityCardView(sim, slot());
    expect(card().cooldown).toBe(`Recharges in ${wholeSeconds(35 / 1.15)} of wave time`);
    expect(card().cooldown).not.toBe('Recharges in 35s of wave time');
    sim.startNextWave();
    const s0 = slot();
    expect(s0.state).toBe('charging');
    expect(s0.secondsLeft).toBeCloseTo(35 / 3 / 1.15, 1); // a fresh ability: a third left, at the office's rate
    for (let i = 0; i < 300; i++) {
      sim._step(STEP);
      sim.drainEvents();
    }
    const s1 = slot();
    expect(s1.state).toBe('charging');
    expect(s0.secondsLeft - s1.secondsLeft).toBeCloseTo(5, 1); // 5 s of wave time takes 5 s off the label, no skips
    expect(card().state).toBe(`Recharging · ${wholeSeconds(s1.secondsLeft)}`);
  });

  it('Moon Pounce (fromOrigin): the ring is centred on Kon, where the sim picks targets, not on Ruri (M3 review)', () => {
    // the fixture map (a straight road along y 4.5): Ruri far back, so Kon runs out 2+ tiles towards the road
    const sim = new Sim({ stageId: FIXTURE.id, seed: 5, loadout: [{ unitId: 'ruri' }], data: testData({ stage: FIXTURE, units: FIXTURE_D.units, enemies: FIXTURE_D.enemies }) });
    sim.cash = 1e9;
    const t = unlock(sim, sim.placeTower('ruri', 8.5, 7.5));
    expect(abilityDef(t).id).toBe('ruri.moonPounce');
    expect(Math.hypot(t.ox - t.x, t.oy - t.y)).toBeGreaterThan(1.5);
    const v = abilityCardView(sim, abilityBarView(sim, 0)[0]);
    expect([v.reach.x, v.reach.y]).toEqual([t.ox, t.oy]);
    expect(v.reach.r).toBeCloseTo(t.eff.range + 2, 9);
    expect(abilityOrigin(t, abilityDef(t))).toEqual({ x: t.ox, y: t.oy });
    // the sim agrees: an orc inside the drawn ring but beyond Ruri's own range + 2 is the one pounced
    sim.state = 'wave';
    sim.wave = 1;
    sim._spawnQueue = [];
    let xIn = null;
    for (let x = 0; x < 16 && xIn == null; x += 0.05) {
      const dk = Math.hypot(x - v.reach.x, 4.5 - v.reach.y);
      const dr = Math.hypot(x - t.x, 4.5 - t.y);
      if (dk <= v.reach.r - 0.2 && dr > v.reach.r + 0.2) xIn = x;
    }
    expect(xIn, 'a road spot inside the ring that Ruri herself could not reach').not.toBeNull();
    const e = sim.spawnEnemy('orc_grunt', { dist: xIn + 0.5, hpMul: 50 });
    e.baseSpeed = 0;
    e.speed = 0;
    sim._step(STEP);
    sim.drainEvents();
    ready(t);
    expect(sim.castAbility(t.uid).ok).toBe(true);
    expect(sim.drainEvents().find((x) => x.type === 'ability').targets).toEqual([e.uid]);
  });

  it('an ability that looks from where she stands keeps its ring on her (abilityOrigin)', () => {
    const sim = battle(['aoi']);
    const t = unlock(sim, place(sim, 'aoi'));
    expect(abilityOrigin(t, abilityDef(t))).toEqual({ x: t.x, y: t.y });
  });

  it('an area ability charging: its ring, and the recharge only in the state chip', () => {
    const sim = battle(['aoi']);
    unlock(sim, place(sim, 'aoi'));
    sim.startNextWave();
    const v = abilityCardView(sim, abilityBarView(sim, 0)[0]);
    expect(v.state).toMatch(/^Recharging · \d+s$/);
    expect(v.cooldown).toBeNull();
    expect(v.reach?.r).toBeGreaterThan(0);
  });
});

describe('the hold card\'s side (cardSide)', () => {
  const R = { left: 504, right: 834, top: 108, bottom: 250 };
  const L = { left: 12, right: 342, top: 108, bottom: 250 };
  it('the side that covers fewer girls; the caster counts double; the bar side on a tie', () => {
    // the M1 review's 844x390 case: four girls under the right-hand card, Aoi (the caster) among them
    const pts = [{ x: 558, y: 131, uid: 1 }, { x: 542, y: 155, uid: 2 }, { x: 534, y: 174, uid: 3 }, { x: 566, y: 149, uid: 4 }, { x: 200, y: 300, uid: 5 }];
    expect(cardSide({ left: L, right: R }, pts, 1)).toBe('left');
    expect(cardSide({ left: L, right: R }, [], 1)).toBe('right');
    expect(cardSide({ left: L, right: R }, [{ x: 100, y: 120, uid: 9 }, { x: 600, y: 120, uid: 8 }], null)).toBe('right');
    // her own spot outweighs one other girl
    expect(cardSide({ left: L, right: R }, [{ x: 100, y: 120, uid: 9 }, { x: 600, y: 120, uid: 1 }], 1)).toBe('left');
    expect(cardSide({ left: L, right: R }, [{ x: 100, y: 120, uid: 1 }, { x: 600, y: 120, uid: 8 }], 1)).toBe('right');
  });
});

describe('a tap on a slot (slotTapPlan, ABILITIES_SPEC §3.3)', () => {
  /** Two copies of an aimed girl, the first recharging, the second ready, enemies on the road. */
  function copies(unitId) {
    const sim = battle([unitId, 'aoi'], { hero: null });
    const c1 = unlock(sim, place(sim, unitId));
    const c2 = unlock(sim, place(sim, unitId, { skip: 10 }));
    const aoi = place(sim, 'aoi', { skip: 20 });
    sim.startNextWave();
    for (let i = 0; i < 600; i++) sim.update(1 / 60);
    c1.abil.cd = c1.abil.cdMax;
    c2.abil.cd = 0;
    return { sim, c1, c2, aoi, isReady: (u) => !!sim.abilityStatus(u)?.ready };
  }

  for (const [unitId, id] of [['wakaba', 'wakaba.timeOut'], ['yuzuha', 'yuzuha.emergencyDeploy']]) {
    it(`${id}: the selected copy recharging hands the aim to the ready copy, and the aimed cast is not refused`, () => {
      const { sim, c1, c2, aoi, isReady } = copies(unitId);
      const slot = abilityBarView(sim, 0).find((s) => s.id === id);
      expect([slot.state, slot.ready, slot.casters]).toEqual(['ready', 1, [c1.uid, c2.uid]]);
      // her panel is open on the recharging copy (ctx.selectedUid): aim mode goes to the copy that will cast
      const plan = slotTapPlan(slot, { selectedUid: c1.uid, isReady });
      expect(plan).toEqual({ do: 'aim', uid: c2.uid });
      expect(aimCaster(slot, c1.uid, isReady)).toBe(c2.uid);
      // the aimed cast goes out group: false (aimControl): it is the ready copy's, never "Recharging"
      const near = [...sim.enemies].filter((e) => !e.dead).sort((p, q) => ((p.x - c2.x) ** 2 + (p.y - c2.y) ** 2) - ((q.x - c2.x) ** 2 + (q.y - c2.y) ** 2))[0];
      const r = sim.castAbility(plan.uid, { group: false, aim: unitId === 'wakaba' ? [aoi.x, aoi.y] : [near.x, near.y] });
      expect(r.reason).not.toBe('cooldown');
      expect(r.casterUid).toBe(c2.uid);
      if (unitId === 'wakaba') expect(r).toEqual({ ok: true, reason: null, casterUid: c2.uid });
    });
  }

  it('a ready selected copy keeps the cast; no selection or another girl selected: the slot\'s best copy', () => {
    const { sim, c1, c2, aoi, isReady } = copies('wakaba');
    let slot = abilityBarView(sim, 0)[0];
    expect(slotTapPlan(slot, { selectedUid: c2.uid, isReady })).toEqual({ do: 'aim', uid: c2.uid });
    expect(slotTapPlan(slot, { selectedUid: null, isReady })).toEqual({ do: 'aim', uid: c2.uid });
    expect(slotTapPlan(slot, { selectedUid: aoi.uid, isReady })).toEqual({ do: 'aim', uid: c2.uid });
    c1.abil.cd = 0;
    slot = abilityBarView(sim, 0)[0];
    expect(slotTapPlan(slot, { selectedUid: c1.uid, isReady })).toEqual({ do: 'aim', uid: c1.uid });
  });

  it('the same slot while it aims = the group cast with her own pick; a placement tap never fires; a key does; ended: nothing', () => {
    const { sim, c1, isReady } = copies('wakaba');
    const slot = abilityBarView(sim, 0)[0];
    expect(slotTapPlan(slot, { selectedUid: c1.uid, aimingId: slot.id, isReady })).toEqual({ do: 'cast', uid: c1.uid, group: true, cancelAim: true });
    expect(slotTapPlan(slot, { placing: true, isReady })).toEqual({ do: 'none' });
    expect(slotTapPlan(slot, { placing: true, key: true, isReady }).do).toBe('aim');
    expect(slotTapPlan(slot, { ended: true, key: true, isReady })).toEqual({ do: 'none' });
    expect(slotTapPlan(null)).toEqual({ do: 'none' });
    // no aim control (or a slot that does not aim): the group cast
    expect(slotTapPlan(slot, { canAim: false, isReady })).toMatchObject({ do: 'cast', group: true, cancelAim: false });
    const sim2 = battle(['aoi']);
    const a = ready(unlock(sim2, place(sim2, 'aoi')));
    sim2.startNextWave();
    expect(slotTapPlan(abilityBarView(sim2, 0)[0], { isReady: () => true })).toEqual({ do: 'cast', uid: a.uid, group: true, cancelAim: false });
  });
});

// ---- the group pick with none of her copies selected (ABILITIES_SPEC §3.3; M1 review r2) -------------------------

/** Legal spots for `unitId`, nearest first to the first 15 % of road 0 (where the first enemies walk). */
function spotsByRoadStart(sim, ok) {
  const pts = sim.paths[0];
  const n = Math.max(2, Math.ceil(pts.length * 0.15));
  const d = (x, y) => {
    let b = Infinity;
    for (let i = 0; i < n - 1; i++) b = Math.min(b, segDistSq(x, y, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
    return Math.sqrt(b);
  };
  const out = [];
  for (let y = 0.6; y < sim.map.height; y += 0.5) for (let x = 0.6; x < sim.map.width; x += 0.5) if (ok(x, y)) out.push({ x, y, d: d(x, y) });
  return out.sort((a, b) => a.d - b.d);
}

/**
 * Stage 1-2, Aois at tier 3 (the review's case): `fars` copies placed FIRST at the spots farthest from the road's start
 * (so the first is the slot's face when all are ready), then one by the start of the road; the wave runs until an
 * enemy is in the near one's reach and none in the far ones'. Then every copy is ready.
 */
function farAndNear({ fars = 1 } = {}) {
  const sim = battle(['aoi', 'akane'], { hero: null });
  const legal = (x, y) => sim.canPlace('aoi', x, y).ok;
  const far = [];
  for (let i = 0; i < fars; i++) {
    const s = spotsByRoadStart(sim, legal).at(-1);
    far.push(unlock(sim, sim.placeTower('aoi', s.x, s.y)));
  }
  const s = spotsByRoadStart(sim, legal)[0];
  const near = unlock(sim, sim.placeTower('aoi', s.x, s.y));
  sim.startNextWave();
  const split = () => abilityReachCount(sim, near) > 0 && far.every((t) => abilityReachCount(sim, t) === 0);
  for (let i = 0; i < 60 * 90 && !split(); i++) sim.update(1 / 60);
  expect(split()).toBe(true);
  for (const t of [...far, near]) t.abil.cd = 0;
  return { sim, far, near };
}

/** The real ability bar (createAbilityBar) over the fake DOM, with the battle context it reads. */
function domBar(sim, extra = {}) {
  const ctx = { sim, layer: new FakeEl('div'), shell: new FakeEl('div'), placement: null, aim: null, selectedUid: null, ended: false, ...extra };
  const bar = createAbilityBar(ctx);
  return { ctx, bar };
}

describe('a tap with none of her copies selected fires the ready copy with the most enemies in reach (§3.3; M1 review r2)', () => {
  let restoreDom = null;
  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
  });
  const isReadyOf = (sim) => (u) => !!sim.abilityStatus(u)?.ready;
  const countOf = (sim) => (u) => abilityReachCount(sim, sim.getTower(u));

  it('two ready Aois, the first placed out of reach: the plan names the near one; a selected copy keeps her own tap', () => {
    const { sim, far: [far], near } = farAndNear();
    const slot = abilityBarView(sim, 0).find((s) => s.id === 'aoi.skyfall');
    // the slot's face is still the first ready copy (placement order): it is not who the tap fires
    expect([slot.state, slot.badge, slot.casterUid]).toEqual(['ready', '×2', far.uid]);
    expect(abilityReachCount(sim, far)).toBe(0);
    expect(abilityReachCount(sim, near)).toBeGreaterThan(0);
    const o = { isReady: isReadyOf(sim), reachCount: countOf(sim) };
    const plan = slotTapPlan(slot, { ...o, selectedUid: null });
    expect(plan).toEqual({ do: 'cast', uid: near.uid, group: true, cancelAim: false });
    // another girl's panel open: no pick among the Aois either
    expect(slotTapPlan(slot, { ...o, selectedUid: 999 }).uid).toBe(near.uid);
    // her panel open on a copy: that copy is the player's pick, even with nothing in reach (her refusal says why)
    expect(slotTapPlan(slot, { ...o, selectedUid: far.uid }).uid).toBe(far.uid);
    // the cast the plan sends goes through (it used to be refused "Nothing in reach yet" with the far copy)
    expect(sim.castAbility(plan.uid, { group: true })).toEqual({ ok: true, reason: null, casterUid: near.uid });
  });

  it('groupCaster: ready copies only, the most enemies in reach, the lowest uid on a tie, null with none ready', () => {
    const ready = new Set([4, 7, 9]);
    const count = { 4: 1, 7: 3, 9: 3, 2: 8 };
    expect(groupCaster([2, 4, 7, 9], (u) => ready.has(u), (u) => count[u])).toBe(7);
    expect(groupCaster([9, 7, 4], (u) => ready.has(u), (u) => count[u])).toBe(7);
    expect(groupCaster([2, 4], (u) => ready.has(u), (u) => count[u])).toBe(4);
    expect(groupCaster([2], (u) => ready.has(u), (u) => count[u])).toBeNull();
    expect(groupCaster([], () => true, () => 1)).toBeNull();
  });

  it('the bar\'s count and tie rule are the sim\'s own group pick: a selected copy recharging hands the cast to the same girl', () => {
    let { sim, far, near } = farAndNear({ fars: 2 });
    const all = () => [...far, near].map((t) => t.uid);
    far[0].abil.cd = far[0].abil.cdMax;
    const pick = groupCaster(all(), isReadyOf(sim), countOf(sim));
    expect(pick).toBe(near.uid);
    expect(sim.castAbility(far[0].uid, { group: true })).toEqual({ ok: true, reason: null, casterUid: pick });
    // a tie (nothing in either far copy's reach): the lowest uid for the bar and the sim alike
    ({ sim, far, near } = farAndNear({ fars: 2 }));
    near.abil.cd = near.abil.cdMax;
    const tie = groupCaster(all(), isReadyOf(sim), countOf(sim));
    expect(tie).toBe(Math.min(far[0].uid, far[1].uid));
    expect(sim.castAbility(near.uid, { group: true })).toEqual({ ok: false, reason: 'noTarget', casterUid: tie });
  });

  it('through the bar itself, solo: a tap on the slot (or key 1) casts the in-reach copy', () => {
    restoreDom = installFakeDom();
    for (const key of [false, true]) {
      const { sim, near } = farAndNear();
      const calls = [];
      const acts = soloAbilityActs(sim);
      const { bar } = domBar(sim, { castAbility: (uid, o) => (calls.push({ uid, ...o }), acts.ability(uid, o)) });
      expect(bar.fireSlot(0, { key })).toBe(true);
      expect(calls).toEqual([{ uid: near.uid, group: true, aim: null, id: 'aoi.skyfall' }]);
      expect(near.abil.n).toBe(1);
      bar.destroy();
    }
  });

  it('through the bar in co-op: the `abil` command names the in-reach copy, and it casts on the CoopSim', () => {
    restoreDom = installFakeDom();
    const st = { seed: 5, stageId: '1-2', difficulty: 'normal', players: [{ slot: 0, uid: 'a', name: 'A', loadout: [{ unitId: 'aoi' }], hero: null }, { slot: 1, uid: 'b', name: 'B', loadout: [{ unitId: 'rei' }], hero: null }] };
    const c = createCoopSim(st, { mySlot: 0 });
    const snap = c.snapshot();
    snap.wallets = [1e6, 1e6];
    c.restore(snap);
    let s = 1;
    const cmd = (p, k, a) => c.apply({ t: c.tick, p, s: s++, k, a });
    const put = (spot) => {
      const r = cmd(0, 'place', ['aoi', Math.round(spot.x * 1024), Math.round(spot.y * 1024)]);
      expect(r.ok).toBe(true);
      for (let i = 0; i < 3; i++) expect(cmd(0, 'upg', [r.tower.uid, abilityPathOf(UNIT_MAP.aoi)]).ok).toBe(true);
      return r.tower;
    };
    const legal = (x, y) => c.sim.canPlace('aoi', x, y).ok;
    const far = put(spotsByRoadStart(c.sim, legal).at(-1));
    const near = put(spotsByRoadStart(c.sim, legal)[0]);
    expect(cmd(0, 'wave', []).ok).toBe(true);
    const split = () => abilityReachCount(c.sim, near) > 0 && abilityReachCount(c.sim, far) === 0;
    for (let i = 0; i < 6000 && !split(); i++) c.step();
    expect(split()).toBe(true);
    far.abil.cd = 0;
    near.abil.cd = 0;
    const sent = [];
    const pending = new Map();
    const ls = { job: null, mySlot: 0, queue: (k, a) => sent.push([k, a]), coop: { ownerOf: (u) => c.ownerOf(u) } };
    const acts = coopAbilityActs({ sim: c.sim, abilityPending: pending }, ls);
    const { bar } = domBar(c.sim, { coop: { mySlot: 0, isMine: (u) => c.ownerOf(u) === 0 }, abilityPending: pending, castAbility: (uid, o) => acts.ability(uid, o) });
    expect(abilityBarView(c.sim, 0)[0].casterUid).toBe(far.uid);
    bar.fireSlot(0, { key: false });
    expect(sent).toEqual([['abil', [near.uid, 1, -1, -1]]]);
    expect(pending.get('aoi.skyfall')?.uid).toBe(near.uid);
    const abil = { t: c.tick, p: 0, s: s++, k: sent[0][0], a: sent[0][1] };
    expect(isValidCmd(abil)).toBe(true);
    expect(c.apply(abil)).toEqual({ ok: true, casterUid: near.uid });
    expect(clearPendingFor(pending, abil, 0)).toEqual(['aoi.skyfall']);
    bar.destroy();
  });
});

describe('the co-op cast path (coopCastCheck, clearPendingFor)', () => {
  /** A CoopSim: player 0 has two Aois at tier 3, player 1 a Rei at tier 3, a wave running. */
  function coop() {
    const st = { seed: 5, stageId: '1-2', difficulty: 'normal', players: [{ slot: 0, uid: 'a', name: 'A', loadout: [{ unitId: 'aoi' }], hero: null }, { slot: 1, uid: 'b', name: 'B', loadout: [{ unitId: 'rei' }], hero: null }] };
    const c = createCoopSim(st, { mySlot: 0 });
    const snap = c.snapshot();
    snap.wallets = [1e6, 1e6];
    c.restore(snap);
    let s = 1;
    const cmd = (p, k, a) => c.apply({ t: c.tick, p, s: s++, k, a });
    const placed = [];
    const put = (p, unitId) => {
      for (let y = 0.6; y < c.sim.map.height; y += 0.45) {
        for (let x = 0.6; x < c.sim.map.width; x += 0.45) {
          // (this view is player 0's: her canPlace knows only her own loadout; the partner's order just tries)
          if ((p === 0 && !c.sim.canPlace(unitId, x, y).ok) || placed.some(([px, py]) => Math.hypot(px - x, py - y) < 1.5)) continue;
          const r = cmd(p, 'place', [unitId, Math.round(x * 1024), Math.round(y * 1024)]);
          if (r.ok) {
            placed.push([x, y]);
            for (let i = 0; i < 3; i++) expect(cmd(p, 'upg', [r.tower.uid, abilityPathOf(UNIT_MAP[unitId])]).ok).toBe(true);
            return r.tower;
          }
        }
      }
      throw new Error(`no spot for ${unitId}`);
    };
    const a1 = put(0, 'aoi');
    const a2 = put(0, 'aoi');
    const rei = put(1, 'rei');
    expect(cmd(0, 'wave', []).ok).toBe(true);
    // until an enemy walks into the second Aoi's reach (her volley needs a target)
    const near = () => c.sim.enemies.some((e) => !e.dead && !e.hidden && (e.x - a2.x) ** 2 + (e.y - a2.y) ** 2 <= (a2.eff.range * 0.9) ** 2);
    for (let i = 0; i < 6000 && !near(); i++) c.step();
    expect(near()).toBe(true);
    const mine = (u) => c.ownerOf(u) === 0;
    return { c, a1, a2, rei, mine };
  }

  it('one abil per ability at a time: a cast waiting for its command blocks a second; its tick releases it', () => {
    const { c, a1, a2, mine } = coop();
    const sim = c.sim;
    a1.abil.cd = a1.abil.cdMax; // the selected copy recharges
    a2.abil.cd = 0; // the other is ready
    const pending = new Map();
    // the bar's group tap on the recharging copy: the ready copy fires, so the command goes out
    expect(coopCastCheck(sim, a1.uid, { group: true, mine, pending })).toEqual({ send: true, id: 'aoi.skyfall' });
    // an aimed tap (group: false) on her alone is refused here, with the reason the toast shows
    expect(coopCastCheck(sim, a1.uid, { group: false, mine, pending })).toMatchObject({ ok: false, reason: 'cooldown', casterUid: a1.uid });
    // sent: the slot waits, and a second tap sends nothing (no second abil for a pending id)
    pending.set('aoi.skyfall', { uid: a1.uid, at: 0 });
    expect(abilityBarView(sim, 0, { pending })[0].state).toBe('pending');
    expect(coopCastCheck(sim, a1.uid, { group: true, mine, pending })).toEqual({ queued: true, id: 'aoi.skyfall' });
    expect(coopCastCheck(sim, a2.uid, { group: false, mine, pending })).toEqual({ queued: true, id: 'aoi.skyfall' });
    // the command runs (on every client): the ready copy cast
    const cast = { t: c.tick, p: 0, s: 99, k: 'abil', a: abilityCommandArgs(a1.uid, { group: true }) };
    expect(c.apply(cast)).toEqual({ ok: true, casterUid: a2.uid });
    // someone else's command or another kind releases nothing; mine does
    expect(clearPendingFor(pending, { ...cast, p: 1 }, 0)).toEqual([]);
    expect(clearPendingFor(pending, { ...cast, k: 'acast' }, 0)).toEqual([]);
    expect(clearPendingFor(pending, { ...cast, a: [a2.uid, 1, -1, -1] }, 0)).toEqual([]);
    expect(pending.size).toBe(1);
    expect(clearPendingFor(pending, cast, 0)).toEqual(['aoi.skyfall']);
    expect(pending.size).toBe(0);
    expect(abilityBarView(sim, 0, { pending })[0].state).not.toBe('pending');
    // both copies now recharge: the next tap is refused locally (no round trip)
    expect(coopCastCheck(sim, a1.uid, { group: true, mine, pending })).toMatchObject({ ok: false, reason: 'cooldown' });
  });

  it('busy (a rebuild), the partner\'s girl, a girl without an ability', () => {
    const { c, a1, rei, mine } = coop();
    a1.abil.cd = 0;
    expect(coopCastCheck(c.sim, a1.uid, { busy: true, mine })).toEqual({ ok: false, reason: 'busy' });
    expect(coopCastCheck(c.sim, rei.uid, { group: true, mine })).toEqual({ ok: false, reason: 'notYours' });
    a1.abil = null;
    expect(coopCastCheck(c.sim, a1.uid, { group: true, mine })).toEqual({ ok: false, reason: 'locked', casterUid: a1.uid });
  });
});

describe('battleKeyAction', () => {
  const k = (o) => ({ key: '', code: '', shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, repeat: false, ...o });
  it('1–9 fire slots (digit row or numpad, read from e.code); Shift arms cards', () => {
    expect(battleKeyAction(k({ key: '1', code: 'Digit1' }))).toEqual({ do: 'ability', slot: 0 });
    expect(battleKeyAction(k({ key: '9', code: 'Digit9' }))).toEqual({ do: 'ability', slot: 8 });
    expect(battleKeyAction(k({ key: '3', code: 'Numpad3' }))).toEqual({ do: 'ability', slot: 2 });
    // Shift+1 is "!" on many layouts: the code still says Digit1
    expect(battleKeyAction(k({ key: '!', code: 'Digit1', shiftKey: true }))).toEqual({ do: 'card', index: 0 });
    expect(battleKeyAction(k({ key: '&', code: 'Digit7', shiftKey: true }))).toEqual({ do: 'card', index: 6 });
    expect(battleKeyAction(k({ key: '0', code: 'Digit0' }))).toBeNull();
    expect(battleKeyAction(k({ key: '1', code: 'Digit1', repeat: true }))).toBeNull();
    // a keyboard event without codes still fires slots
    expect(battleKeyAction(k({ key: '4' }))).toEqual({ do: 'ability', slot: 3 });
  });

  it('E fires the hero skill; Q, L, Space, F and Esc keep their jobs', () => {
    expect(battleKeyAction(k({ key: 'e', code: 'KeyE' }))).toEqual({ do: 'skill' });
    expect(battleKeyAction(k({ key: 'E', code: 'KeyE', shiftKey: true }))).toEqual({ do: 'skill' });
    expect(battleKeyAction(k({ key: 'e', code: 'KeyE', repeat: true }))).toBeNull();
    expect(battleKeyAction(k({ key: 'q', code: 'KeyQ' }))).toEqual({ do: 'ult' });
    expect(battleKeyAction(k({ key: 'l', code: 'KeyL' }))).toEqual({ do: 'level' });
    expect(battleKeyAction(k({ key: ' ', code: 'Space' }))).toEqual({ do: 'wave' });
    // Space on a focused drawer control presses it, never the wave too (the M4 review)
    expect(battleKeyAction(k({ key: ' ', code: 'Space' }), { control: true })).toBeNull();
    expect(battleKeyAction(k({ key: 'f', code: 'KeyF' }), { control: true })).toEqual({ do: 'speed' });
    expect(battleKeyAction(k({ key: 'f', code: 'KeyF' }))).toEqual({ do: 'speed' });
    expect(battleKeyAction(k({ key: 'Escape', code: 'Escape' }))).toEqual({ do: 'escape' });
    // browser shortcuts stay the browser's
    expect(battleKeyAction(k({ key: '1', code: 'Digit1', ctrlKey: true }))).toBeNull();
    expect(battleKeyAction(k({ key: 'e', code: 'KeyE', metaKey: true }))).toBeNull();
  });

  it('nothing while paused (except Esc), nothing at all while typing', () => {
    expect(battleKeyAction(k({ key: '1', code: 'Digit1' }), { paused: true })).toBeNull();
    expect(battleKeyAction(k({ key: 'e', code: 'KeyE' }), { paused: true })).toBeNull();
    expect(battleKeyAction(k({ key: '!', code: 'Digit1', shiftKey: true }), { paused: true })).toBeNull();
    expect(battleKeyAction(k({ key: 'Escape' }), { paused: true })).toEqual({ do: 'escape' });
    for (const e of [k({ key: '1', code: 'Digit1' }), k({ key: 'Escape' }), k({ key: ' ' }), k({ key: 'e' })]) expect(battleKeyAction(e, { typing: true })).toBeNull();
  });

  it('behind the open upgrade tree nothing fires: the tree swallows every battle key by its code, and the battle\'s handler is blocked too (M1 review r2)', () => {
    // the review's leaks in co-op (the tree does not pause there): Shift+1 / Shift+3 armed cards, E fired the skill,
    // AZERTY's unshifted 1 ('&') and the numpad's 1 with NumLock off ('End') fired slot 1
    const leaks = [
      k({ key: '!', code: 'Digit1', shiftKey: true }), k({ key: '#', code: 'Digit3', shiftKey: true }), k({ key: 'e', code: 'KeyE' }),
      k({ key: '&', code: 'Digit1' }), k({ key: 'End', code: 'Numpad1' }), k({ key: '1', code: 'Digit1' }), k({ key: '1', code: 'Numpad1' }),
      k({ key: 'q', code: 'KeyQ' }), k({ key: 'L', code: 'KeyL', shiftKey: true }), k({ key: ' ', code: 'Space' }),
    ];
    for (const e of leaks) {
      const what = `${e.key}/${e.code}`;
      expect(battleKeyAction(e), what).not.toBeNull(); // a battle key …
      expect(treeKeyAction(e, { coop: true }), what).toBe('swallow'); // … that never gets past the tree in co-op
      expect(treeKeyAction(e, { coop: false }), what).toBe('swallow'); // … or in solo
      expect(battleKeyAction(e, { blocked: true }), what).toBeNull(); // and does nothing even if it did
    }
    // Esc is the tree's own (onEscape closes it first); T closes the tree, never while typing
    expect(battleKeyAction(k({ key: 'Escape', code: 'Escape' }), { blocked: true })).toEqual({ do: 'escape' });
    expect(treeKeyAction(k({ key: 'Escape', code: 'Escape' }), { coop: true })).toBeNull();
    expect(treeKeyAction(k({ key: 't', code: 'KeyT' }))).toBe('close');
    expect(treeKeyAction(k({ key: 'T', code: 'KeyT', shiftKey: true }), { coop: true })).toBe('close');
    expect(treeKeyAction(k({ key: 't', code: 'KeyT' }), { typing: true })).toBeNull();
    // F: solo speed waits behind the tree; co-op speed is the shared one and still goes through, as before
    expect(treeKeyAction(k({ key: 'f', code: 'KeyF' }), { coop: false })).toBe('swallow');
    expect(treeKeyAction(k({ key: 'f', code: 'KeyF' }), { coop: true })).toBeNull();
    // keys the battle does not use pass
    for (const e of [k({ key: 'a', code: 'KeyA' }), k({ key: '0', code: 'Digit0' }), k({ key: 'Tab', code: 'Tab' })]) expect(treeKeyAction(e, { coop: true })).toBeNull();
  });
});

describe('abilityCommandArgs (co-op `abil`)', () => {
  it('group 0/1, the aim quantised × 1024, −1/−1 for none; always a valid command', () => {
    expect(abilityCommandArgs(7)).toEqual([7, 0, -1, -1]);
    expect(abilityCommandArgs(7, { group: true })).toEqual([7, 1, -1, -1]);
    expect(abilityCommandArgs(12, { aim: [3.25, 4.5] })).toEqual([12, 0, 3328, 4608]);
    expect(abilityCommandArgs(12, { group: true, aim: [0.0004, 2] })).toEqual([12, 1, 0, 2048]);
    // a malformed aim is none
    for (const aim of [[NaN, 1], [1], 'x', [Infinity, 2]]) expect(abilityCommandArgs(5, { aim })).toEqual([5, 0, -1, -1]);
    for (const a of [abilityCommandArgs(7), abilityCommandArgs(7, { group: true, aim: [1.1, 9.9] })]) {
      expect(isValidCmd({ t: 0, p: 0, s: 0, k: 'abil', a })).toBe(true);
    }
  });

  it('the command casts on a co-op sim (refused notWave before the first wave, spending nothing)', () => {
    const st = { seed: 3, stageId: '1-2', difficulty: 'normal', players: [{ slot: 0, uid: 'a', name: 'A', loadout: [{ unitId: 'aoi' }], hero: null }, { slot: 1, uid: 'b', name: 'B', loadout: [{ unitId: 'rei' }], hero: null }] };
    const c = createCoopSim(st, { mySlot: 0 });
    const snap = c.snapshot();
    snap.wallets = [1e6, 1e6];
    c.restore(snap);
    let uid = null;
    for (let y = 0.6; y < c.sim.map.height && uid == null; y += 0.45) {
      for (let x = 0.6; x < c.sim.map.width && uid == null; x += 0.45) {
        if (!c.sim.canPlace('aoi', x, y).ok) continue;
        const r = c.apply({ t: 0, p: 0, s: 1, k: 'place', a: ['aoi', Math.round(x * 1024), Math.round(y * 1024)] });
        if (r.ok) uid = r.tower.uid;
      }
    }
    for (let i = 0; i < 3; i++) expect(c.apply({ t: 0, p: 0, s: 2 + i, k: 'upg', a: [uid, abilityPathOf(UNIT_MAP.aoi)] }).ok).toBe(true);
    const r = c.apply({ t: 0, p: 0, s: 9, k: 'abil', a: abilityCommandArgs(uid, { group: true }) });
    expect(r).toEqual({ ok: false, reason: 'notWave', casterUid: uid });
    expect(c.sim.getTower(uid).abil.n).toBe(0);
  });
});

describe('refusal lines', () => {
  it('one quiet line for every reason the sim (and the co-op layer) can give', () => {
    const lines = new Map(REFUSAL_REASONS.map((r) => [r, refusalText(r, { secondsLeft: 11.2, name: 'Market Day' })]));
    expect(lines.get('cooldown')).toBe('Recharging · 12s');
    expect(lines.get('active')).toBe('Already active');
    expect(lines.get('notWave')).toBe('Abilities work during waves.');
    expect(lines.get('noTarget')).toBe('Nothing in reach yet');
    expect(lines.get('cap')).toBe('Market Day: twice per wave');
    expect(lines.get('noIncome')).toBe('No coins on Nightmare');
    expect(lines.get('disabled')).toBe('She\'s sabotaged');
    expect(lines.get('moving')).toBe('She\'s moving');
    expect(lines.get('notYours')).toBe('Not yours');
    for (const [r, t] of lines) {
      expect(t, r).toBeTruthy();
      expect(t.length, r).toBeLessThanOrEqual(60);
      expect(t, r).not.toBe(refusalText('somethingElse'));
    }
    // every reason the sim names (refusal() + noTarget) has its own line
    for (const r of TRANSIENT_REFUSALS) expect(REFUSAL_REASONS).toContain(r);
    for (const r of ['ended', 'locked', 'notYours', 'notWave', 'disabled', 'moving', 'active', 'cooldown', 'cap', 'noIncome', 'noTarget']) expect(REFUSAL_REASONS).toContain(r);
    expect(refusalText('cooldown', { secondsLeft: 0.2 })).toBe('Recharging · 1s');
    expect(refusalText('locked', { unlock: 'LV 7' })).toBe('Unlocks at LV 7');
  });
});

describe('feed notes', () => {
  it('the first unlock of each ability toasts once per battle (a Continue seeds what it already has)', () => {
    const n = createAbilityNotes();
    n.seed(['akane.starmine']);
    expect(n.firstUnlock('aoi.skyfall')).toBe(true);
    expect(n.firstUnlock('aoi.skyfall')).toBe(false); // a second Aoi
    expect(n.firstUnlock('akane.starmine')).toBe(false);
    expect(n.firstUnlock(null)).toBe(false);
    // one line that points at what is on screen: her portrait in the bar (a tower girl's slot has no ⚡), the bolt
    // button by the hero's portrait
    expect(unlockText('Aoi', 'Skyfall Volley')).toBe('Skyfall Volley: tap Aoi, bottom right');
    expect(unlockText('Aoi', 'Skyfall Volley', { hover: true, key: '1' })).toBe('Skyfall Volley: press 1 or tap Aoi');
    expect(unlockText('Aoi', 'Skyfall Volley', { hover: true, key: null })).toBe('Skyfall Volley: tap Aoi, bottom right');
    expect(unlockText('Hikari', 'Morning Rally', { hero: true })).toBe('Morning Rally: tap ⚡ by Hikari');
    expect(unlockText('Hikari', 'Morning Rally', { hover: true, hero: true })).toBe('Morning Rally: press E or tap ⚡ by Hikari');
    // the longest names still fit the one-line toast (the phone feed holds about 44 characters)
    const names = Object.values(ABILITY_TEXT).map((r) => r.name);
    const girls = Object.values(UNIT_MAP).map((u) => u.name);
    const longest = (xs) => xs.reduce((a, b) => (b.length > a.length ? b : a), '');
    const worst = [unlockText(longest(girls), longest(names)), unlockText(longest(girls), longest(names), { hover: true, key: '9' })];
    for (const w of worst) expect(w.length, w).toBeLessThanOrEqual(46);
    for (const w of worst) expect(w).not.toMatch(/⚡/);
  });

  it('the ally chip at most once per 3 s', () => {
    let t = 0;
    const n = createAbilityNotes({ now: () => t });
    expect(n.allyChip()).toBe(true);
    t = 1000;
    expect(n.allyChip()).toBe(false);
    t = ALLY_CHIP_MS - 1;
    expect(n.allyChip()).toBe(false);
    t = ALLY_CHIP_MS;
    expect(n.allyChip()).toBe(true);
    t = ALLY_CHIP_MS + 2999;
    expect(n.allyChip()).toBe(false);
    expect(ALLY_CHIP_MS).toBe(3000);
    expect(allyChipText('Rin', 'Miko', 'Shrine Chorus')).toBe('Rin\'s Miko: Shrine Chorus!');
  });

  it('a life an ability brought back (A3 M3): one short good line, either player sees it', () => {
    expect(lifeText('Noa', 'First Aid Call')).toBe('Noa\'s First Aid Call: +1 life');
    expect(lifeText('Noa', 'First Aid Call', 2)).toBe('Noa\'s First Aid Call: +2 lives');
    expect(lifeText('Noa', 'First Aid Call').length).toBeLessThanOrEqual(60);
  });
});

describe('the results line', () => {
  it('the total and the girls who cast the most (copies summed); none when nothing was cast', () => {
    const names = { 1: 'Aoi', 2: 'Akane', 3: 'Aoi', 4: 'Momo', 5: 'Miko' };
    const stats = { abilitiesUsed: 14, abilityByTower: { 1: 4, 2: 5, 3: 2, 4: 2, 5: 1 } };
    expect(abilityResultLine(stats, (u) => names[u])).toBe('Abilities used: 14 · Aoi 6 · Akane 5 · Momo 2');
    expect(abilityResultLine({ abilitiesUsed: 0 }, () => 'x')).toBeNull();
    expect(abilityResultLine({}, () => 'x')).toBeNull();
  });
});

describe('Settings → Battle → Auto-cast abilities', () => {
  it('Off by default; an older save gets Off; on and off survive the cleaner; junk is repaired', () => {
    expect(DEFAULT_SETTINGS.autoCastAbilities).toBe(false);
    const p = createProfile();
    expect(p.settings.autoCastAbilities).toBe(false);
    const old = JSON.parse(JSON.stringify(p));
    delete old.settings.autoCastAbilities;
    expect(migrateProfile(old).settings.autoCastAbilities).toBe(false);
    for (const v of [true, false]) expect(migrateProfile({ ...old, settings: { ...old.settings, autoCastAbilities: v } }).settings.autoCastAbilities).toBe(v);
    for (const v of ['yes', 1, null]) expect(migrateProfile({ ...old, settings: { ...old.settings, autoCastAbilities: v } }).settings.autoCastAbilities).toBe(false);
  });

  it('a solo battle passes it as the Sim\'s autoAbilities only when on (Off builds the same Sim as before)', () => {
    expect(autoAbilities({ settings: { autoCastAbilities: true } })).toEqual({ autoAbilities: true });
    expect(autoAbilities({ settings: { autoCastAbilities: false } })).toEqual({});
    expect(autoAbilities(null)).toEqual({});
    const on = new Sim({ stageId: '1-2', difficulty: 'normal', loadout: [{ unitId: 'aoi' }], seed: 1, options: { ...autoAbilities({ settings: { autoCastAbilities: true } }) } });
    expect(on.abilityAutoDefault).toEqual([true, false]);
    on.cash = 1e7;
    const aoi = unlock(on, place(on, 'aoi'));
    expect(aoi.abil.auto).toBe(true);
  });
});
