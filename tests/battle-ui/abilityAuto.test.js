// The Auto switches and the hero skill button (ABILITIES_SPEC §8.2, §8.4; owner #53: Auto is off by default; the hero
// skill unlocks at Lv 7), from the control to the sim (M1 review r2, M1-logic-3):
//   - Settings → Auto-cast abilities from the pause menu: saved in the profile, and applied at once — solo through
//     setAbilityAutoAll(0) (every girl of mine and the ones that unlock later), co-op as the `acast` [0, on] command;
//   - her panel row's Auto switch: one girl — solo straight away, co-op `acast` [uid, on]; an ally's girl has none;
//   - the hero skill button's look: none, later, locked "LV 7", charging (a ring, no number), ready, between, active.
// The DOM halves (the pause menu, the panel row) run over the small fake DOM in tests/battle-ui/fakeDom.js.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { abilityPathOf } from '../../src/sim/abilities.js';
import { soloAbilityActs, coopAbilityActs, abilityAutoControls } from '../../src/ui/battle/abilityBar.js';
import { skillButtonView } from '../../src/ui/battle/heroWidget.js';
import { createAbilityRow } from '../../src/ui/battle/abilityRow.js';
import { createPauseMenu } from '../../src/ui/battle/pauseMenu.js';
import { createCoopSim, isValidCmd } from '../../src/online/coop/commands.js';
import { createProfile } from '../../src/systems/save.js';
import { store } from '../../src/core/store.js';
import { UNIT_MAP } from '../../src/data/units.js';
import { FakeEl, byTestId, installFakeDom } from './fakeDom.js';

let restoreDom = null;
afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  vi.restoreAllMocks();
});

/** A solo battle (1-2 Normal): Aoi and Rei at tier 3 of their ⚡ paths, Akane placed but without one yet. */
function solo() {
  const sim = new Sim({ stageId: '1-2', difficulty: 'normal', loadout: ['aoi', 'rei', 'akane'].map((unitId) => ({ unitId })), hero: { unitId: 'hikari' }, seed: 7 });
  sim.cash = 1e7;
  let n = 0;
  const place = (unitId) => {
    for (let y = 0.6; y < sim.map.height; y += 0.45) {
      for (let x = 0.6; x < sim.map.width; x += 0.45) {
        if (!sim.canPlace(unitId, x, y).ok || n++ % 7) continue;
        const t = sim.placeTower(unitId, x, y);
        if (t) return t;
      }
    }
    throw new Error(`no spot for ${unitId}`);
  };
  const up = (t, k = 3) => {
    for (let i = 0; i < k; i++) expect(sim.upgradeTower(t.uid, abilityPathOf(t.def))).toBeTruthy();
    return t;
  };
  const aoi = up(place('aoi'));
  const rei = up(place('rei'));
  const akane = place('akane');
  return { sim, aoi, rei, akane, up };
}

/** A co-op battle on player 0's view: her Aoi at tier 3, the partner's Rei at tier 3. */
function coop() {
  const st = { seed: 5, stageId: '1-2', difficulty: 'normal', players: [{ slot: 0, uid: 'a', name: 'A', loadout: [{ unitId: 'aoi' }], hero: null }, { slot: 1, uid: 'b', name: 'B', loadout: [{ unitId: 'rei' }], hero: null }] };
  const c = createCoopSim(st, { mySlot: 0 });
  const snap = c.snapshot();
  snap.wallets = [1e6, 1e6];
  c.restore(snap);
  let s = 1;
  const apply = (p, k, a) => c.apply({ t: c.tick, p, s: s++, k, a });
  const taken = [];
  const put = (p, unitId) => {
    for (let y = 0.6; y < c.sim.map.height; y += 0.45) {
      for (let x = 0.6; x < c.sim.map.width; x += 0.45) {
        if ((p === 0 && !c.sim.canPlace(unitId, x, y).ok) || taken.some(([px, py]) => Math.hypot(px - x, py - y) < 1.5)) continue;
        const r = apply(p, 'place', [unitId, Math.round(x * 1024), Math.round(y * 1024)]);
        if (!r.ok) continue;
        taken.push([x, y]);
        for (let i = 0; i < 3; i++) expect(apply(p, 'upg', [r.tower.uid, abilityPathOf(UNIT_MAP[unitId])]).ok).toBe(true);
        return r.tower;
      }
    }
    throw new Error(`no spot for ${unitId}`);
  };
  const aoi = put(0, 'aoi');
  const rei = put(1, 'rei');
  const sent = [];
  const ls = { job: null, mySlot: 0, queue: (k, a) => sent.push({ k, a }), coop: { ownerOf: (u) => c.ownerOf(u) } };
  // what the lockstep does with my queued commands: they run on this view (and the partner's) at their tick
  const flush = () => sent.splice(0).map(({ k, a }) => {
    expect(isValidCmd({ t: c.tick, p: 0, s, k, a })).toBe(true);
    return apply(0, k, a);
  });
  return { c, sim: c.sim, aoi, rei, sent, ls, flush };
}

/** A fake profile store for abilityAutoControls (the controller passes the real one). */
const fakeStore = () => ({ profile: { settings: { autoCastAbilities: false } }, commits: [], commit(what) { this.commits.push(what); } });

describe('Settings → Auto-cast abilities (ctx.setAutoAbilities)', () => {
  it('solo: the setting is saved, and every girl of mine — and the ones that unlock later — switch at once', () => {
    const { sim, aoi, rei, akane, up } = solo();
    const st = fakeStore();
    let refreshed = 0;
    const ctx = { act: soloAbilityActs(sim) };
    Object.assign(ctx, abilityAutoControls(ctx, { store: st, refresh: () => refreshed++ }));
    expect([aoi.abil.auto, rei.abil.auto, sim.abilityAutoDefault[0]]).toEqual([false, false, false]);
    ctx.setAutoAbilities(true);
    expect(st.profile.settings.autoCastAbilities).toBe(true);
    expect(st.commits).toEqual(['settings']);
    expect(sim.abilityAutoDefault[0]).toBe(true);
    expect([aoi.abil.auto, rei.abil.auto]).toEqual([true, true]);
    expect(refreshed).toBe(1);
    // a girl who learns hers later starts with Auto on
    up(akane);
    expect(akane.abil?.auto).toBe(true);
    ctx.setAutoAbilities(false);
    expect([st.profile.settings.autoCastAbilities, sim.abilityAutoDefault[0], aoi.abil.auto, rei.abil.auto, akane.abil.auto]).toEqual([false, false, false, false, false]);
    expect(st.commits).toEqual(['settings', 'settings']);
  });

  it('solo: one slot\'s copies or one girl (ctx.setAbilityAuto) switch only those; a cast and a switch mark battle-save progress', () => {
    const { sim, aoi, rei } = solo();
    let marks = 0;
    const ctx = { act: soloAbilityActs(sim, { mark: () => marks++ }) };
    Object.assign(ctx, abilityAutoControls(ctx, { store: fakeStore() }));
    ctx.setAbilityAuto([aoi.uid], true);
    expect([aoi.abil.auto, rei.abil.auto, sim.abilityAutoDefault[0]]).toEqual([true, false, false]);
    expect(marks).toBe(1);
    expect(ctx.act.abilityAuto(999, true)).toBe(false); // no such girl: nothing to mark
    expect(marks).toBe(1);
    // a cast between waves is refused and marks nothing
    expect(ctx.act.ability(aoi.uid, { group: true })).toMatchObject({ ok: false, reason: 'notWave' });
    expect(marks).toBe(1);
  });

  it('co-op: the setting is saved and goes out as `acast` [0, on]; when it runs, every girl of mine switches, never the partner\'s', () => {
    const { sim, aoi, rei, sent, ls, flush } = coop();
    const st = fakeStore();
    const ctx = { act: coopAbilityActs({ sim, abilityPending: new Map() }, ls) };
    Object.assign(ctx, abilityAutoControls(ctx, { store: st }));
    ctx.setAutoAbilities(true);
    expect(st.profile.settings.autoCastAbilities).toBe(true);
    expect(st.commits).toEqual(['settings']);
    expect(sent).toEqual([{ k: 'acast', a: [0, 1] }]);
    // nothing changes on this view before the command's tick (lockstep)
    expect(aoi.abil.auto).toBe(false);
    expect(flush()).toEqual([{ ok: true }]);
    expect([sim.abilityAutoDefault[0], aoi.abil.auto, sim.abilityAutoDefault[1], rei.abil.auto]).toEqual([true, true, false, false]);
    // a rebuild in progress (ls.job): nothing is sent, the setting is still saved for the next battle
    ls.job = {};
    ctx.setAutoAbilities(false);
    expect(sent).toEqual([]);
    expect(st.profile.settings.autoCastAbilities).toBe(false);
  });

  it('co-op: one girl\'s switch is `acast` [uid, on]; the partner\'s girl sends nothing', () => {
    const { aoi, rei, sim, sent, ls, flush } = coop();
    const ctx = { act: coopAbilityActs({ sim, abilityPending: new Map() }, ls) };
    Object.assign(ctx, abilityAutoControls(ctx, { store: fakeStore() }));
    ctx.setAbilityAuto([aoi.uid, rei.uid], true);
    expect(sent).toEqual([{ k: 'acast', a: [aoi.uid, 1] }]);
    expect(flush()).toEqual([{ ok: true }]);
    expect([aoi.abil.auto, rei.abil.auto, sim.abilityAutoDefault[0]]).toEqual([true, false, false]);
  });
});

describe('the controls themselves (fake DOM)', () => {
  it('the pause menu\'s Auto-cast row calls ctx.setAutoAbilities with the new value, and it reaches the sim', () => {
    restoreDom = installFakeDom();
    store.replace(createProfile());
    const commit = vi.spyOn(store, 'commit').mockImplementation(() => {});
    const { sim, aoi, rei } = solo();
    const ctx = {
      sim, layer: new FakeEl('div'), stage: { kind: 'campaign', id: '1-2', name: 'Stage' }, coop: null, modes: null, renderer: { setQuality() {} },
      act: soloAbilityActs(sim), closePause() {}, setAutoStart() {},
    };
    const calls = [];
    const controls = abilityAutoControls(ctx, { store });
    ctx.setAutoAbilities = (on) => {
      calls.push(on);
      controls.setAutoAbilities(on);
    };
    const pause = createPauseMenu(ctx);
    pause.show();
    const row = byTestId(pause.el, 'set-autocast');
    expect(row?.getAttribute('aria-pressed')).toBe('false');
    row.click();
    expect(calls).toEqual([true]);
    expect(store.profile.settings.autoCastAbilities).toBe(true);
    expect(commit).toHaveBeenCalledWith('settings');
    expect([sim.abilityAutoDefault[0], aoi.abil.auto, rei.abil.auto]).toEqual([true, true, true]);
    // the menu redraws with the row on; a second press turns it off again
    const again = byTestId(pause.el, 'set-autocast');
    expect(again.getAttribute('aria-pressed')).toBe('true');
    again.click();
    expect(calls).toEqual([true, false]);
    expect([store.profile.settings.autoCastAbilities, aoi.abil.auto]).toEqual([false, false]);
  });

  it('her panel row\'s Auto switch: solo switches her; co-op sends `acast` [uid, on]; an ally\'s girl has no switch', () => {
    restoreDom = installFakeDom();
    // solo
    {
      const { sim, aoi, rei } = solo();
      const ctx = { sim, act: soloAbilityActs(sim) };
      Object.assign(ctx, abilityAutoControls(ctx, { store: fakeStore() }));
      const row = createAbilityRow(ctx);
      expect(row.update(aoi)).toBeTruthy();
      const sw = byTestId(row.el, 'ability-row-auto');
      expect([sw.hidden, sw.getAttribute('aria-checked')]).toEqual([false, 'false']);
      sw.click();
      expect([aoi.abil.auto, rei.abil.auto]).toEqual([true, false]);
      expect(sw.getAttribute('aria-checked')).toBe('true');
      sw.click();
      expect(aoi.abil.auto).toBe(false);
    }
    // co-op
    const { c, sim, aoi, rei, sent, ls, flush } = coop();
    const ctx = { sim, coop: { mySlot: 0, isMine: (u) => c.ownerOf(u) === 0 }, act: coopAbilityActs({ sim, abilityPending: new Map() }, ls) };
    Object.assign(ctx, abilityAutoControls(ctx, { store: fakeStore() }));
    const row = createAbilityRow(ctx);
    row.update(aoi);
    byTestId(row.el, 'ability-row-auto').click();
    expect(sent).toEqual([{ k: 'acast', a: [aoi.uid, 1] }]);
    expect(flush()).toEqual([{ ok: true }]);
    expect(aoi.abil.auto).toBe(true);
    // the partner's Rei: read only, the switch hidden and dead
    row.update(rei);
    const sw = byTestId(row.el, 'ability-row-auto');
    expect(sw.hidden).toBe(true);
    sw.click();
    expect(sent).toEqual([]);
    expect(rei.abil.auto).toBe(false);
  });
});

describe('the hero skill button (heroWidget skillButtonView)', () => {
  const base = { id: 'hikari.rally', unlocked: true, later: false, unlockLevel: 7, ready: false, reason: null, charge: 0, cooldownLeft: 0 };
  it('none without a skill; LV 7 while locked; then a ring with no number', () => {
    expect(skillButtonView(null)).toEqual({ hidden: true, state: 'none', p: 1, label: '', title: '', aria: '' });
    expect(skillButtonView({ ...base, unlocked: false })).toMatchObject({ hidden: false, state: 'locked', p: 1, label: 'LV 7', title: 'Morning Rally unlocks at hero LV 7' });
    const charging = skillButtonView({ ...base, reason: 'cooldown', charge: 0.25, cooldownLeft: 30.2 });
    expect(charging).toMatchObject({ hidden: false, state: 'charging', label: '' });
    expect(charging.p).toBeCloseTo(0.75, 9);
    expect(charging.title).toBe('Morning Rally — recharging · 31s');
    expect(skillButtonView({ ...base, ready: true, charge: 1 })).toMatchObject({ state: 'ready', p: 0, label: '', title: 'Morning Rally — ready! (E)' });
    expect(skillButtonView({ ...base, reason: 'notWave', charge: 1 })).toMatchObject({ state: 'between', p: 0, label: '', title: 'Morning Rally — charges during waves' });
    expect(skillButtonView({ ...base, reason: 'active', charge: 0 })).toMatchObject({ state: 'active', label: '' });
    expect(skillButtonView({ ...base, reason: 'disabled', charge: 0.5 })).toMatchObject({ state: 'blocked', label: '' });
    expect(skillButtonView({ ...base, later: true })).toMatchObject({ hidden: true, state: 'later' });
  });

  it('a real Hikari: locked below Lv 7, charging in a wave once she reaches it, then ready', () => {
    const { sim } = solo();
    let hero = null;
    for (let y = 0.6; y < sim.map.height && !hero; y += 0.45) for (let x = 0.6; x < sim.map.width && !hero; x += 0.45) if (sim.canPlace('hikari', x, y).ok) hero = sim.placeTower('hikari', x, y);
    expect(hero).toBeTruthy();
    expect(skillButtonView(sim.abilityStatus(hero.uid))).toMatchObject({ state: 'locked', label: 'LV 7' });
    for (let i = 0; i < 40 && sim.hero.level < 7; i++) {
      const st = sim.heroLevelStatus();
      if (!sim.buyHeroLevel({ level: st.level + 1, maxPrice: st.price }).ok) break;
    }
    expect(sim.hero.level).toBeGreaterThanOrEqual(7);
    expect(skillButtonView(sim.abilityStatus(hero.uid)).state).toBe('between');
    sim.startNextWave();
    sim.update(1 / 60);
    const v = skillButtonView(sim.abilityStatus(hero.uid));
    expect(v.state).toBe('charging');
    expect(v.label).toBe('');
    expect(v.p).toBeGreaterThan(0);
    hero.abil.cd = 0;
    expect(skillButtonView(sim.abilityStatus(hero.uid))).toMatchObject({ state: 'ready', p: 0 });
  });
});
