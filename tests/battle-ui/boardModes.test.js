// One board-tap mode at a time (ABILITIES_SPEC §8.1: "a placement tap never fires an ability"), on the real aim and
// placement controllers (src/ui/battle/aimControl.js, placement.js) over a small fake DOM (the repo has no DOM
// library): arming a card or starting a pick ends an ability aim (and Set aim); an ability aim ends placement; a board
// tap while a card is armed goes to the placement, never to the ability; aim mode rings the candidates and the reach
// of the copy that will really cast.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { abilityPathOf } from '../../src/sim/abilities.js';
import { createAimControl, abilityTapAction, abilityAimText, aimCandidates } from '../../src/ui/battle/aimControl.js';
import { createPlacement, clearBoardModes } from '../../src/ui/battle/placement.js';

// ---- a fake DOM: enough for dom.js h(), the aim banner and the placement hint ----------------------------------
class FakeNode {}
class FakeText extends FakeNode {
  constructor(t) {
    super();
    this.textContent = String(t);
  }
}
class FakeEl extends FakeNode {
  constructor(tag) {
    super();
    this.tagName = String(tag).toUpperCase();
    this.attrs = {};
    this.dataset = {};
    this.style = { setProperty() {} };
    this.children = [];
    this.hidden = false;
    this.listeners = {};
    this._text = '';
    const cls = new Set();
    this.classList = {
      add: (...c) => c.forEach((x) => cls.add(x)),
      remove: (...c) => c.forEach((x) => cls.delete(x)),
      toggle: (c, on) => {
        const v = on === undefined ? !cls.has(c) : !!on;
        if (v) cls.add(c);
        else cls.delete(c);
        return v;
      },
      contains: (c) => cls.has(c),
    };
  }
  set textContent(t) {
    this._text = String(t);
    this.children = [];
  }
  get textContent() {
    return this._text + this.children.map((c) => c.textContent || '').join('');
  }
  set innerHTML(v) {
    this._html = v;
  }
  setAttribute(k, v) {
    this.attrs[k] = v;
  }
  getAttribute(k) {
    return this.attrs[k];
  }
  addEventListener(type, fn) {
    (this.listeners[type] ||= []).push(fn);
  }
  appendChild(c) {
    this.children.push(c);
    return c;
  }
  append(...c) {
    this.children.push(...c);
  }
  replaceChildren(...c) {
    this.children = c;
  }
  remove() {}
}

const saved = {};
beforeEach(() => {
  for (const k of ['document', 'Node']) saved[k] = globalThis[k];
  globalThis.Node = FakeNode;
  globalThis.document = { createElement: (t) => new FakeEl(t), createTextNode: (t) => new FakeText(t) };
});
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) globalThis[k] = v;
});

/** A real battle (1-2 Normal), Wakaba (Time Out!: girl aim) and Yuzuha (Emergency Deploy: point aim) at tier 3. */
function stage() {
  const sim = new Sim({ stageId: '1-2', difficulty: 'normal', loadout: ['wakaba', 'yuzuha', 'aoi', 'akane'].map((unitId) => ({ unitId })), hero: null, seed: 3 });
  sim.cash = 1e7;
  let n = 0;
  const place = (unitId, skip) => {
    for (let y = 0.6; y < sim.map.height; y += 0.45) {
      for (let x = 0.6; x < sim.map.width; x += 0.45) {
        if (!sim.canPlace(unitId, x, y).ok || n++ < skip) continue;
        const t = sim.placeTower(unitId, x, y);
        if (t) return t;
      }
    }
    throw new Error(`no spot for ${unitId}`);
  };
  const wak = place('wakaba', 0);
  const wak2 = place('wakaba', 10);
  const yuz = place('yuzuha', 20);
  const aoi = place('aoi', 30);
  for (const t of [wak, wak2, yuz]) for (let i = 0; i < 3; i++) sim.upgradeTower(t.uid, abilityPathOf(t.def));
  sim.startNextWave();
  for (const t of [wak, wak2, yuz]) t.abil.cd = 0;
  // a free spot for Akane, away from everyone
  let free = null;
  for (let y = 0.6; y < sim.map.height && !free; y += 0.45) for (let x = 0.6; x < sim.map.width && !free; x += 0.45) if (sim.canPlace('akane', x, y).ok) free = { x, y };
  return { sim, wak, wak2, yuz, aoi, free };
}

/** The battle context the two controllers read, with spies for what they ask of the renderer, shell and battle. */
function context(sim) {
  const log = { casts: [], ring: [], pick: [], placed: [], picking: false, shell: new Set() };
  const ctx = {
    sim,
    settings: {},
    layer: new FakeEl('div'),
    shell: { classList: { add: (c) => log.shell.add(c), remove: (c) => log.shell.delete(c) } },
    feed: { push() {} },
    renderer: {
      setBuffPick: (uid, cands) => log.pick.push(uid == null ? null : { uid, cands }),
      setAbilityReach: (o) => log.ring.push(o),
      setGhost() {},
      setPlacementRange() {},
    },
    select() {},
    bump() {},
    onPlaced: (t) => log.placed.push(t.unitId),
    castAbility: (uid, o) => log.casts.push({ uid, ...o }),
    cancelPick: () => {
      log.picking = false;
    },
  };
  ctx.aim = createAimControl(ctx);
  ctx.placement = createPlacement(ctx);
  return { ctx, log };
}

describe('board-tap modes never stack', () => {
  it('arming a card ends an ability aim: the next board tap places the girl, the ability never fires', () => {
    const { sim, yuz, free } = stage();
    const { ctx, log } = context(sim);
    ctx.aim.startAbility({ uid: yuz.uid, id: 'yuzuha.emergencyDeploy', kind: 'point', name: 'Emergency Deploy' });
    expect(ctx.aim.abilityId).toBe('yuzuha.emergencyDeploy');
    expect(log.shell.has('bt-picking')).toBe(true);
    // a card tap (or Shift+N) arms Akane
    expect(ctx.placement.start('akane')).toBe(true);
    expect(ctx.aim.abilityId).toBeNull();
    expect(ctx.aim.active).toBe(false);
    expect(log.shell.has('bt-picking')).toBe(false);
    expect(log.ring.at(-1)).toBeNull(); // her reach ring is gone
    // the board tap, in the controller's order (aim, flight, placement): the placement takes it
    const p = { inBounds: true, x: free.x, y: free.y, towerUid: null };
    const consumed = ctx.aim.handleTap(p) || ctx.placement.handleTap(p);
    expect(consumed).toBe(true);
    expect(log.casts).toEqual([]);
    expect(log.placed).toEqual(['akane']);
    expect(sim.towers.some((t) => t.unitId === 'akane')).toBe(true);
    expect(yuz.abil.n).toBe(0);
  });

  it('girl mode too (Time Out!): arming a card ends it, so the placement tap is not swallowed as a cancel', () => {
    const { sim, wak, free } = stage();
    const { ctx, log } = context(sim);
    ctx.aim.startAbility({ uid: wak.uid, id: 'wakaba.timeOut', kind: 'girl', name: 'Time Out!' });
    expect(ctx.placement.start('akane')).toBe(true);
    expect(log.pick.at(-1)).toBeNull(); // the candidates' rings are gone
    const p = { inBounds: true, x: free.x, y: free.y, towerUid: null };
    expect(ctx.aim.handleTap(p) || ctx.placement.handleTap(p)).toBe(true);
    expect(log.placed).toEqual(['akane']);
    expect(log.casts).toEqual([]);
  });

  it('an ability aim ends placement; Move mode, a pick and Set aim end an ability aim (clearBoardModes)', () => {
    const { sim, wak } = stage();
    const { ctx } = context(sim);
    ctx.placement.start('akane');
    ctx.aim.startAbility({ uid: wak.uid, id: 'wakaba.timeOut', kind: 'girl', name: 'Time Out!' });
    expect(ctx.placement.unitId).toBeNull();
    expect(ctx.aim.abilityId).toBe('wakaba.timeOut');
    // what placement.begin / startMove and the controller's startPick call
    let picks = 0;
    let flights = 0;
    ctx.cancelPick = () => picks++;
    ctx.flight = { active: true, cancel: () => flights++ };
    clearBoardModes(ctx);
    expect(ctx.aim.active).toBe(false);
    expect([picks, flights]).toEqual([1, 1]);
  });

  it('a board tap during an aim with a card somehow armed is the placement\'s (abilityTapAction "pass")', () => {
    const { sim, wak, yuz, aoi } = stage();
    const at = { inBounds: true, x: 3, y: 3, towerUid: null };
    expect(abilityTapAction({ uid: yuz.uid, kind: 'point' }, at, { placing: true, caster: yuz })).toEqual({ do: 'pass' });
    expect(abilityTapAction({ uid: wak.uid, kind: 'girl' }, { ...at, towerUid: aoi.uid }, { placing: true, caster: wak, tapped: aoi })).toEqual({ do: 'pass' });
    // without a card: the casts and cancels as before
    expect(abilityTapAction({ uid: yuz.uid, kind: 'point' }, at, { caster: yuz })).toEqual({ do: 'cast', aim: [3, 3] });
    expect(abilityTapAction({ uid: yuz.uid, kind: 'point' }, { inBounds: false, x: null }, { caster: yuz })).toEqual({ do: 'outside' });
    expect(abilityTapAction({ uid: wak.uid, kind: 'girl' }, at, { caster: wak, tapped: aoi })).toEqual({ do: 'cast', aim: [aoi.x, aoi.y] });
    expect(abilityTapAction({ uid: wak.uid, kind: 'girl' }, at, { caster: wak, tapped: null })).toEqual({ do: 'cancel' });
    expect(abilityTapAction({ uid: wak.uid, kind: 'girl' }, at, { caster: wak, tapped: wak })).toEqual({ do: 'cancel' });
    expect(abilityTapAction({ uid: wak.uid, kind: 'girl' }, at, { caster: null })).toEqual({ do: 'gone' });
    // and through the controller: the aim ends and the tap is passed on
    const { ctx, log } = context(sim);
    ctx.aim.startAbility({ uid: yuz.uid, id: 'yuzuha.emergencyDeploy', kind: 'point', name: 'Emergency Deploy' });
    ctx.placement = { unitId: 'akane' }; // (a card armed without going through placement.begin)
    expect(ctx.aim.handleTap(at)).toBe(false);
    expect(ctx.aim.active).toBe(false);
    expect(log.casts).toEqual([]);
  });
});

describe('aim mode follows the copy that casts', () => {
  it('girl mode rings every other girl around the caster it was given; point mode her reach', () => {
    const { sim, wak, wak2, yuz } = stage();
    const { ctx, log } = context(sim);
    ctx.aim.startAbility({ uid: wak2.uid, id: 'wakaba.timeOut', kind: 'girl', name: 'Time Out!' });
    expect(log.pick.at(-1)).toEqual({ uid: wak2.uid, cands: aimCandidates(sim, wak2.uid) });
    expect(log.pick.at(-1).cands).toContain(wak.uid);
    expect(log.pick.at(-1).cands).not.toContain(wak2.uid);
    // the girl tap casts for that copy, aimed (group: false)
    const aoi = sim.towers.find((t) => t.unitId === 'aoi');
    expect(ctx.aim.handleTap({ inBounds: true, x: aoi.x, y: aoi.y, towerUid: aoi.uid })).toBe(true);
    expect(log.casts).toEqual([{ uid: wak2.uid, group: false, aim: [aoi.x, aoi.y], id: 'wakaba.timeOut' }]);
    ctx.aim.startAbility({ uid: yuz.uid, id: 'yuzuha.emergencyDeploy', kind: 'point', name: 'Emergency Deploy' });
    expect(log.ring.at(-1)).toMatchObject({ x: yuz.x, y: yuz.y });
    expect(log.ring.at(-1).r).toBeGreaterThan(0);
  });

  it('the banner names what to tap again: her portrait (bar) or FIRE (panel), never a ⚡', () => {
    expect(abilityAimText('girl', 'Wakaba', 'Time Out!')).toBe('Tap the girl Wakaba should coach — or tap her portrait again for her pick');
    expect(abilityAimText('point', 'Yuzuha', 'Emergency Deploy', { from: 'panel' })).toBe('Tap the road for the sentries — or tap FIRE again');
    for (const k of ['girl', 'point', 'other']) for (const from of ['bar', 'panel']) expect(abilityAimText(k, 'A', 'B', { from })).not.toMatch(/⚡/);
  });
});
