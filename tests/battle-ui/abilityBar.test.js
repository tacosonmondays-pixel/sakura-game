// The ability bar's pure halves (src/ui/battle/abilityBar.js; ABILITIES_SPEC §8.1–§8.3, §8.5, UI_DIRECTION §6.6):
// slots appear on unlock in tower-bar order, copies grouped with ×N, at most one number per slot, every state
// (charging, ready, pending, active, between waves, blocked: sabotaged / cap / no income / nothing in reach), the
// globe for map scope, the aim kinds, never an ally's girl or a hero; the keys (Digit / Numpad, Shift, paused,
// typing); the co-op command arguments; a refusal line for every reason; the first-unlock toast once per id and the
// ally chip at most every 3 s.
import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import {
  abilityBarView, slotNumbers, slotState, abilityCommandArgs, battleKeyAction, refusalText, REFUSAL_REASONS,
  createAbilityNotes, unlockText, allyChipText, abilityCardView, wholeSeconds, ALLY_CHIP_MS, abilityResultLine,
} from '../../src/ui/battle/abilityBar.js';
import { DEFAULT_SETTINGS, createProfile, migrateProfile } from '../../src/systems/save.js';
import { autoAbilities } from '../../src/ui/battle/setup.js';
import { abilityPathOf, TRANSIENT_REFUSALS } from '../../src/sim/abilities.js';
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
    expect(unlockText('Aoi', 'Skyfall Volley')).toBe('Aoi learned Skyfall Volley! Tap ⚡ to fire it.');
    expect(unlockText('Aoi', 'Skyfall Volley', { hover: true, key: '1' })).toBe('Aoi learned Skyfall Volley! Tap ⚡ or press 1 to fire it.');
    expect(unlockText('Hikari', 'Morning Rally', { hover: true, hero: true })).toBe('Hikari learned Morning Rally! Tap ⚡ by her portrait or press E to use it.');
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
