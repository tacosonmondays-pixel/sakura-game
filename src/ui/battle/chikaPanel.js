// The selected-girl panel's drone-owner sections (Chika: docs/specs/CHIKA_REWORK.md §7 and §16):
// a split bar (her own damage vs her drones'), the wing's flight-mode row, a tab row
// Upgrades · Overall · Chika · Drones, the drone list and a drone card (◀ ▶ ‹). Shown only for
// girls whose drones roam (towerStats().turret.leash > 0); everyone else keeps today's panel.
// The tab, the drone shown and where ‹ returns to live here (not in the DOM), so a re-render
// (an upgrade, a new drone, the wave state) never snaps the view back.
import { h, fmtCoins, fmtNum, icon, enemyDef } from './util.js';
import { droneName } from '../../data/droneNames.js';
import { FLIGHT_PURSUIT_RATE_MUL } from '../../sim/constants.js';

export const DRONE_TABS = ['upgrades', 'overall', 'chika', 'drones'];
const FLIGHT = [
  ['hover', 'Hover', 'Around her'],
  ['hold', 'Hold', 'At a point you tap'],
  ['patrol', 'Patrol', 'Between two points you tap'],
  ['pursuit', 'Pursuit', 'Anywhere: her Target\'s #1'],
];
const STATE_TEXT = { hunting: 'Hunting', returning: 'Flying home', home: 'Home', jammed: 'Jammed', stalled: 'Stalled' };

/** Does this girl get the drone tabs? */
export function hasDroneTabs(st) {
  return !!st?.turret && st.turret.leash > 0;
}

/** One drone's paper DPS, and the full wing's (her flight mode can change the fire rate). */
export function wingNumbers(st) {
  const tu = st.turret;
  const each = tu.damage * tu.rate * (tu.flight === 'pursuit' ? FLIGHT_PURSUIT_RATE_MUL : 1);
  return { each, wing: each * tu.max, building: tu.active < tu.max };
}

/**
 * @param {object} ctx battle context (sim, act, select, selectDrone, flight, coop, rates)
 * @param {{ rerender(): void }} hooks
 */
export function createDronePanel(ctx, { rerender }) {
  const { sim } = ctx;
  const lastTab = new Map(); // girl uid -> the tab she reopens on (this battle only)
  let uid = null;
  let tab = 'overall';
  let droneUid = null;
  let cardFrom = null; // the tab ‹ returns to
  let live = [];
  let toTop = false; // a tab or card change shows the new content from the top

  function open(towerUid, { drone = null } = {}) {
    uid = towerUid;
    tab = lastTab.get(towerUid) || 'overall';
    droneUid = drone ?? null;
    cardFrom = droneUid != null ? tab : null;
  }

  /** The field selection moved to another drone of the same girl (a tap on the board). */
  function showDrone(d, from = tab) {
    droneUid = d;
    cardFrom = from;
    toTop = true;
    ctx.selectDrone?.(d);
    rerender();
  }

  function setTab(k) {
    tab = k;
    lastTab.set(uid, k);
    droneUid = null;
    toTop = true;
    ctx.selectDrone?.(null);
    rerender();
  }

  function back() {
    droneUid = null;
    tab = cardFrom || 'drones';
    lastTab.set(uid, tab);
    toTop = true;
    ctx.selectDrone?.(null);
    rerender();
  }

  function signature(t) {
    const fl = sim.flightInfo(t.uid);
    const pick = ctx.flight?.pickingFor?.(t.uid) || '';
    return `${tab}|${droneUid ?? ''}|${t.turrets.length}|${fl?.mode}|${fl?.a?.join(',')}|${fl?.b?.join(',')}|${pick}`;
  }

  // ---- split bar: how much of her damage is hers, how much her drones'
  function splitBar(t) {
    const her = h('span.bt-dr-split-her');
    const fill = h('span.bt-dr-split-fill');
    const wing = h('span.bt-dr-split-wing');
    live.push(() => {
      const all = t.damageDealt || 0;
      if (all < 1) {
        her.textContent = `${t.def.name} —`;
        wing.textContent = 'Drones —';
        fill.style.width = '0%';
        return;
      }
      const p = Math.round(((all - t.droneDmg) / all) * 100);
      her.textContent = `${t.def.name} ${p}%`;
      wing.textContent = `Drones ${100 - p}%`;
      fill.style.width = `${p}%`;
    });
    return h('div.bt-dr-split', { 'data-testid': 'split-bar', title: `Damage split: ${t.def.name}'s own shots vs her drones` },
      her, h('span.bt-dr-split-bar', fill), wing);
  }

  // ---- flight row: Hover · Hold · Patrol · Pursuit (owner only)
  function flightRow(t, mine) {
    const fl = sim.flightInfo(t.uid);
    const picking = ctx.flight?.pickingFor?.(t.uid) || null;
    const seg = h('div.bt-seg.bt-dr-flight-seg', FLIGHT.map(([k, name, help]) => h(
      `button.bt-seg-btn${fl.mode === k ? '.on' : ''}${picking === k ? '.picking' : ''}`,
      {
        'data-testid': `flight-${k}`,
        'data-mode': k,
        title: help,
        disabled: !mine,
        onclick: () => ctx.flight?.choose(t.uid, k),
      },
      name,
    )));
    let hint;
    if (picking) {
      const which = picking === 'patrol' ? (ctx.flight.pickStep() === 0 ? 'the first patrol point' : 'the second patrol point') : 'the hold point';
      hint = h('div.bt-dr-hint.bt-dr-picking', { 'data-testid': 'flight-picking' }, `Tap the map: ${which} (inside the dashed ring)`,
        h('button.bt-dr-link', { 'data-testid': 'flight-cancel', onclick: () => ctx.flight.cancel() }, 'Cancel'));
    } else {
      const tu = sim.towerStats(t.uid).turret;
      const text = {
        hover: `Drones fly up to ${fmtNum(tu.leash, 2)} tiles around her`,
        hold: `Drones guard your point · tap Hold to move it`,
        patrol: `Drones fly between your two points · tap Patrol to redraw`,
        pursuit: `Drones chase her Target's #1 anywhere${FLIGHT_PURSUIT_RATE_MUL < 1 ? ` (fire ×${FLIGHT_PURSUIT_RATE_MUL})` : ''}`,
      }[fl.mode];
      hint = h('div.bt-dr-hint', { 'data-testid': 'flight-hint' }, mine ? text : `${text} · only her owner changes it`);
    }
    return h('div.bt-dr-flight', { 'data-testid': 'flight-row' },
      h('div.bt-target', h('span.bt-section-label', icon('teleport', 'bt-ico-sm'), 'Flight'), seg), hint);
  }

  // ---- tab row
  function tabRow(t, affordable) {
    const names = { upgrades: 'Upgrades', overall: 'Overall', chika: t.def.name, drones: `Drones ${t.turrets.length}` };
    const cur = droneUid != null ? 'drones' : tab;
    return h('div.bt-dr-tabs', { role: 'tablist' }, DRONE_TABS.map((k) => h(
      `button.bt-dr-tab${cur === k ? '.on' : ''}`,
      { role: 'tab', 'aria-selected': cur === k ? 'true' : 'false', 'data-testid': `tab-${k}`, onclick: () => setTab(k) },
      names[k],
      k === 'upgrades' && affordable ? h('span.bt-dr-coin', { title: 'An upgrade is affordable' }) : null,
    )));
  }

  const cell = (label, value, cls = '') => h(`div.bt-stat-cell${cls}`, h('span', label), typeof value === 'string' || typeof value === 'number' ? h('b', String(value)) : value);
  // live cells: fn(ds) runs every frame with this frame's droneStats
  const liveB = (fn) => {
    const b = h('b');
    live.push((ds) => {
      b.textContent = fn(ds);
    });
    return b;
  };
  const rateText = (key) => {
    const r = ctx.rates?.rate(key);
    return r == null ? '—' : fmtNum(r, 1);
  };

  function overallTab(t, st, cells) {
    const { wing, building } = wingNumbers(st);
    const tu = st.turret;
    // today's grid (her damage, rate, range, crit, aura, …) between the totals and the drone lines
    const fly = tu.flight === 'pursuit' ? 'Whole map' : `${fmtNum(tu.leash, 2)} tiles (+${fmtNum(tu.range, 1)} gun)`;
    return h('div', { 'data-testid': 'stats-overall' }, h('div.bt-stats-grid',
      cell('DPS', `${fmtNum(st.own.dps + wing, 1)}${building ? ` (full wing of ${tu.max})` : ''}`, '.bt-stat-main.bt-stat-wide2'),
      cell('Dealing', liveB(() => rateText(`t${t.uid}`)), '.bt-stat-wide2'),
      cells.rest,
      cell('Drones fly', fly, '.bt-stat-wide2'),
      cell('Flight', { hover: 'Hover', hold: 'Hold', patrol: 'Patrol', pursuit: 'Pursuit' }[tu.flight] || tu.flight, '.bt-stat-wide2'),
      cell('Drones', `${tu.active}/${tu.max} · ${fmtNum(tu.damage, 1)} dmg × ${fmtNum(tu.rate, 2)}/s each`, '.bt-stat-wide'),
    ), cells.caps);
  }

  function chikaTab(t, st, cells) {
    const rows = [
      cell('DPS', fmtNum(st.own.dps, 1), '.bt-stat-main'),
      cell('Damage', fmtNum(st.damage, 1)),
      cell('Attacks/s', fmtNum(st.rate, 2)),
      cell('Range', fmtNum(st.range, 1)),
    ];
    if (st.chain > 0) rows.push(cell('Jumps', st.chain));
    if (st.armorPen > 0) rows.push(cell('Armor pen', fmtNum(st.armorPen, 1)));
    rows.push(
      cell('Dealt', liveB(() => fmtCoins((t.damageDealt || 0) - (t.droneDmg || 0)))),
      cell('Kills', liveB(() => fmtCoins((t.kills || 0) - (t.droneKills || 0)))),
      cell('Share', liveB(() => (t.damageDealt >= 1 ? `${Math.round(((t.damageDealt - t.droneDmg) / t.damageDealt) * 100)}%` : '—'))),
      cell('Dealing', liveB(() => {
        const all = ctx.rates?.rate(`t${t.uid}`);
        const dr = ctx.rates?.rate(`d${t.uid}`);
        return all == null || dr == null ? '—' : fmtNum(Math.max(0, all - dr), 1);
      })),
    );
    if (cells.aura) rows.push(cells.aura);
    const behaviour = st.behavior === 'chain' ? 'Her Tesla coil chains lightning on its own.' : 'Her wrench bolt fires on its own. Tesla Engineering turns it into a lightning coil.';
    return h('div', { 'data-testid': 'stats-chika' }, h('div.bt-stats-grid', rows), cells.ownCaps, h('p.bt-dr-note', behaviour));
  }

  function dronesTab(t, st) {
    const tu = st.turret;
    const { wing, building } = wingNumbers(st);
    const flying = liveB(() => {
      const s = sim.towerStats(t.uid).turret;
      if (s.active >= s.max) return `${s.active}/${s.max}`;
      return sim.state === 'wave' ? `${s.active}/${s.max} · next in ${fmtNum(s.nextIn, 1)} s` : `${s.active}/${s.max} · builds during waves (every ${fmtNum(s.build, 1)} s)`;
    });
    const grid = h('div.bt-stats-grid',
      cell('Wing DPS', `${fmtNum(wing, 1)}${building ? ` (full wing of ${tu.max})` : ''}`, '.bt-stat-main.bt-stat-wide2'),
      cell('Flying', flying, '.bt-stat-wide2'),
      cell('Damage each', fmtNum(tu.damage, 1)),
      cell('Fire rate', `${fmtNum(tu.rate * (tu.flight === 'pursuit' ? FLIGHT_PURSUIT_RATE_MUL : 1), 2)}/s`),
      cell('Gun', fmtNum(tu.range, 1)),
      cell('Speed', `${fmtNum(tu.speed, 1)} t/s`),
      cell('Fly up to', tu.flight === 'pursuit' ? 'Whole map' : `${fmtNum(tu.leash, 2)} tiles`, '.bt-stat-wide2'),
      cell('Dealt', liveB(() => fmtCoins(t.droneDmg || 0))),
      cell('Kills', liveB(() => fmtCoins(t.droneKills || 0))),
      cell('Shots', liveB(() => fmtCoins(t.droneShots || 0)), '.bt-stat-wide2'),
    );
    const focus = t.targetMode === 'strong' || t.targetMode === 'elite';
    const hint = h('p.bt-dr-note', focus ? `Target ${t.targetMode === 'strong' ? 'Strong' : 'Elite'}: the wing focuses one target` : 'Target First / Last / Close: drones spread out');
    const ds = sim.droneStats(t.uid);
    const rows = ds.map((d) => {
      const dot = h('span.bt-dr-dot');
      const dmg = h('b.bt-dr-row-dmg');
      const kills = h('span.bt-dr-row-kills');
      const top = h('span.bt-dr-top', 'Top');
      live.push((all) => {
        const cur = all.find((x) => x.uid === d.uid);
        if (!cur) return;
        dot.dataset.state = cur.state;
        dmg.textContent = fmtCoins(cur.dmg);
        kills.textContent = `${cur.kills} kills`;
        const best = Math.max(...all.map((x) => x.dmg));
        top.hidden = !(best > 0 && cur.dmg === best);
      });
      return h('button.bt-dr-row', { 'data-testid': `drone-row-${d.n}`, onclick: () => showDrone(d.uid, 'drones') },
        dot, h('span.bt-dr-row-name', droneName(d.n)), top, kills, dmg);
    });
    return h('div', { 'data-testid': 'stats-drones' },
      h('div.bt-dr-list', { 'data-testid': 'drone-list' }, rows.length ? rows : h('p.bt-dr-note', sim.state === 'wave' ? 'Her first drone is on its way.' : 'Drones are built during waves.')),
      grid, hint);
  }

  function droneCard(t, st) {
    const ds = sim.droneStats(t.uid);
    const i = ds.findIndex((d) => d.uid === droneUid);
    if (i < 0) {
      droneUid = null;
      return null;
    }
    const d = ds[i];
    const step = (k) => showDrone(ds[(i + k + ds.length) % ds.length].uid, cardFrom);
    const owner = ctx.coop && !ctx.coop.isMine(t.uid) ? `${ctx.coop.ownerName(t.uid)}'s ${t.def.name} · drone` : `${ordinalName(t)}'s drone`;
    const stateEl = h('div.bt-dr-state', { 'data-testid': 'drone-state' });
    const dot = h('span.bt-dr-dot');
    const stateText = h('span');
    stateEl.append(dot, stateText);
    live.push((all) => {
      const cur = all.find((x) => x.uid === d.uid);
      if (!cur) return;
      dot.dataset.state = cur.state;
      let s = STATE_TEXT[cur.state] || cur.state;
      if (cur.state === 'hunting' && cur.targetId) s += ` · ${enemyDef(cur.targetId)?.name || cur.targetId}`;
      if (cur.state === 'jammed') s += ` (${fmtNum(cur.jam, 1)} s)`;
      if (cur.state === 'stalled') s += ` (${t.def.name} is sabotaged)`;
      stateText.textContent = s;
    });
    const tu = st.turret;
    const one = (fn) => liveB((all) => {
      const cur = all.find((x) => x.uid === d.uid);
      return cur ? fn(cur) : '—';
    });
    const share = liveB(() => {
      const r = ctx.rates?.rate(`u${d.uid}`);
      const w = ctx.rates?.rate(`d${t.uid}`);
      return r == null ? '—' : `${fmtNum(r, 1)}${w ? ` · ${Math.round((r / w) * 100)}% of the wing` : ''}`;
    });
    return h('div.bt-dr-card', { 'data-testid': 'drone-card' },
      h('div.bt-dr-card-head',
        h('button.bt-dr-back', { 'data-testid': 'drone-back', title: 'Back', onclick: back }, '‹ ', cardFrom && cardFrom !== 'drones' ? tabLabel(t, cardFrom) : 'Drones'),
        h('b.bt-dr-card-name', { 'data-testid': 'drone-name' }, droneName(d.n)),
        h('span.bt-dr-steps',
          h('button.bt-dr-step', { 'data-testid': 'drone-prev', title: 'Previous drone', onclick: () => step(-1) }, '◀'),
          h('button.bt-dr-step', { 'data-testid': 'drone-next', title: 'Next drone', onclick: () => step(1) }, '▶'))),
      h('div.bt-dr-owner', `${owner} · built wave ${d.born || 1}`),
      stateEl,
      h('div.bt-stats-grid',
        cell('Damage dealt', one((c) => fmtCoins(c.dmg)), '.bt-stat-wide2'),
        cell('Kills', one((c) => fmtCoins(c.kills))),
        cell('Shots', one((c) => fmtCoins(c.shots))),
        cell('DPS (last 5 s)', share, '.bt-stat-wide'),
        cell('Damage/shot', fmtNum(tu.damage, 1)),
        cell('Fire', `${fmtNum(tu.rate * (tu.flight === 'pursuit' ? FLIGHT_PURSUIT_RATE_MUL : 1), 2)}/s`),
        cell('Gun', fmtNum(tu.range, 1)),
        cell('Speed', `${fmtNum(tu.speed, 1)} t/s`)),
      h('p.bt-dr-note', `Drones belong to ${t.def.name} — upgrade her in the Upgrades tab.`));
  }

  function tabLabel(t, k) {
    return { upgrades: 'Upgrades', overall: 'Overall', chika: t.def.name, drones: 'Drones' }[k] || 'Back';
  }

  /** "Chika", or "Chika (2nd)" when the board holds more than one of her. */
  function ordinalName(t) {
    const same = sim.towers.filter((x) => x.unitId === t.unitId);
    if (same.length < 2) return t.def.name;
    const n = same.indexOf(t) + 1;
    const suf = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
    return `${t.def.name} (${n}${suf})`;
  }

  /**
   * Builds the sections for girl `t`. `parts` come from the panel: the upgrade paths, today's
   * stat cells (without DPS and the drone line), the Aura cell and the capability chips.
   */
  function sections(t, st, parts, { mine, affordable }) {
    live = [];
    let content;
    if (droneUid != null) content = droneCard(t, st);
    if (!content) {
      if (tab === 'upgrades') content = h('div', { 'data-testid': 'tab-upgrades-body' }, parts.paths);
      else if (tab === 'chika') content = chikaTab(t, st, parts);
      else if (tab === 'drones') content = dronesTab(t, st);
      else content = overallTab(t, st, parts);
    }
    const top = toTop;
    toTop = false;
    return {
      toTop: top,
      split: splitBar(t),
      flight: flightRow(t, mine),
      tabs: tabRow(t, affordable),
      content: h('div.bt-dr-body', content),
    };
  }

  function updateLive() {
    if (!live.length || uid == null) return;
    const ds = sim.droneStats(uid);
    for (const fn of live) fn(ds);
  }

  return {
    open,
    signature,
    sections,
    updateLive,
    showDrone,
    get tab() {
      return droneUid != null ? 'drone' : tab;
    },
    get droneUid() {
      return droneUid;
    },
    /** The girl was deselected or sold. */
    close() {
      uid = null;
      droneUid = null;
      live = [];
    },
  };
}

/**
 * Feeds the live rate meter every 0.25 s of game time: each drone owner's total damage (`t<uid>`),
 * her drones' (`d<uid>`) and every drone's (`u<drone uid>`), so rates are ready when a panel opens.
 */
export function sampleDroneRates(sim, rates) {
  if (!rates) return;
  if (rates.last != null && sim.time >= rates.last && sim.time - rates.last < 0.25) return;
  rates.last = sim.time;
  for (const t of sim.towers) {
    if (!(t.turretSpec?.leash > 0)) continue;
    rates.sample(sim.time, `t${t.uid}`, t.damageDealt);
    rates.sample(sim.time, `d${t.uid}`, t.droneDmg);
    for (const d of t.turrets) rates.sample(sim.time, `u${d.uid}`, d.dmg);
  }
}
