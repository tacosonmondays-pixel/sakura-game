// The Unit Sheet's Build tab (docs/specs/PROFILE.md §1.6): a girl's growth, her 3 gear pieces with
// every stat, the gear totals and her battle stats, from any profile — the live save, or a mini
// profile built from someone's showcase snapshot (src/online/profileCard.js). Gear names are never
// shown, so your own girl and someone else's read the same. Battle stats are computed here, on the
// viewer's client.
import './styles/unit-build.css';
import { h, svgEl, stars } from './components.js';
import { GEAR_SLOTS, ITEM_RARITIES } from '../data/types.js';
import { GEAR_STAT_DEFS, statName } from '../data/gearStats.js';
import { levelCap, unitBattleStats, unitPower, MAX_BREAKTHROUGH, MAX_AWAKEN } from '../systems/progression.js';
import { gearStatTotals, gearLines, isUrLook } from '../systems/gear.js';
import { potentialLevel, MAX_POTENTIAL } from '../systems/potential.js';
import { gearIcon, uiIcon } from '../art/icons.js';
import { displayRarity, urBadge } from './rarity.js';

const fmt = (n) => Math.round(n).toLocaleString('en-US');
const r1 = (v) => Math.round(v * 10) / 10;

/** '+24.2%' for a fraction stat, '+2' for a flat one. */
export function statText(stat, value) {
  return GEAR_STAT_DEFS[stat]?.pct ? `+${r1(value * 100).toFixed(1)}%` : `+${r1(value)}`;
}

const pctDelta = (mul) => {
  const d = Math.round((mul - 1) * 100);
  return d === 0 ? '' : `${d > 0 ? '+' : '−'}${Math.abs(d)}%`;
};

/**
 * Everything the tab shows, as plain data (tests/ui/unitBuild.test.js).
 * @param {object} unit UnitDef
 * @param {object} prof a profile ({ units, gear }) that has this girl
 */
export function buildModel(unit, prof) {
  const st = prof?.units?.[unit.id];
  if (!st) return null;
  const gear = Object.keys(GEAR_SLOTS).map((slot) => {
    const g = st.gear?.[slot] && prof.gear?.[st.gear[slot]];
    if (!g || g.slot !== slot) return { slot, slotName: GEAR_SLOTS[slot].name, empty: true };
    const L = gearLines(g);
    return {
      slot, slotName: GEAR_SLOTS[slot].name, rarity: g.rarity, ur: isUrLook(g), club: g.club || null, rarityName: isUrLook(g) ? 'UR' : ITEM_RARITIES[g.rarity]?.name || g.rarity, color: ITEM_RARITIES[g.rarity]?.color || '#9aa5b1', level: g.level || 0,
      main: { name: statName(g.main.stat), text: statText(g.main.stat, L.main.value) },
      subs: L.subs.map((s) => ({ name: statName(s.stat), text: statText(s.stat, s.value), ups: Math.max(0, s.upgrades || 0), tuned: s.tuned || 0 })),
    };
  });
  const totals = Object.entries(gearStatTotals(prof, unit.id)).filter(([, v]) => v > 0).map(([stat, v]) => ({ name: statName(stat), text: statText(stat, v) }));
  const s = unitBattleStats(prof, unit.id);
  const b = unit.base;
  const critMul = (b.crit?.mul || 1.5) * s.critMul;
  const stats = [
    b.damage ? { label: 'Damage', value: fmt(b.damage * s.damageMul), delta: pctDelta(s.damageMul) } : null,
    b.rate ? { label: 'Attack speed', value: `${(b.rate * s.rateMul).toFixed(2)}/s`, delta: pctDelta(s.rateMul) } : null,
    { label: 'Range', value: (b.range * s.rangeMul).toFixed(1), delta: pctDelta(s.rangeMul) },
    { label: 'Crit', value: `${Math.round(((b.crit?.chance || 0) + s.critChance) * 100)}%`, delta: `×${critMul.toFixed(2)} dmg` },
    { label: 'Cost', value: fmt(b.cost * s.costMul), delta: pctDelta(s.costMul) },
  ].filter(Boolean);
  return {
    level: st.level || 1,
    cap: levelCap(st),
    breakthrough: st.breakthrough || 0,
    awaken: st.awaken || 0,
    ur: displayRarity(unit, prof) === 'UR',
    potential: potentialLevel(st),
    power: unitPower(prof, unit.id),
    gear,
    equipped: gear.filter((g) => !g.empty).length,
    totals,
    stats,
  };
}

function tile(key, ...body) {
  return h('div.ub-g', h('span.ub-k', ...[].concat(key)), ...body);
}

function gearCard(g, emptyText) {
  if (g.empty) {
    return h('div.ub-gc.empty', { 'data-testid': 'build-gear-empty' },
      h('div.ub-gc-head', h('span.ub-gc-ico', svgEl(gearIcon(g.slot, 'common'))), h('span.ub-gc-slot', g.slotName)),
      h('p.ub-gc-none', emptyText || `No ${g.slotName.toLowerCase()} equipped`));
  }
  const el = h('div.ub-gc', { 'data-testid': 'build-gear', 'data-slot': g.slot },
    h('div.ub-gc-head',
      h('span.ub-gc-ico', svgEl(gearIcon(g.slot, g.rarity, { ur: g.ur }))),
      h('span.ub-gc-slot', g.slotName, h('span.ub-gc-rar', g.rarityName), h('span.ub-gc-lv', `+${g.level}`))),
    h('div.ub-gc-main', h('span', g.main.name), h('b', g.main.text)),
    g.subs.length ? h('ul.ub-gc-subs', g.subs.map((s) => h('li', h('span', s.name), h('b', s.text), s.ups ? h('em', { title: `Upgraded ${s.ups}×` }, '▲'.repeat(s.ups)) : null))) : null);
  el.style.setProperty('--rarity', g.color);
  return el;
}

/**
 * The Build tab body.
 * @param {object} unit UnitDef
 * @param {object} prof profile with this girl
 * @param {{ snapshotOwner?: string|null, gearText?: string|null }} [o] snapshotOwner = the owner's
 *   name (someone else's build: adds the "Shared from …" footnote); gearText replaces "No charm equipped"
 */
export function buildTab(unit, prof, { snapshotOwner = null, gearText = null } = {}) {
  const m = buildModel(unit, prof);
  if (!m) return h('div.ub', h('p.us-hint', 'No build to show.'));
  const pips = h('div.ub-pips', Array.from({ length: MAX_BREAKTHROUGH }, (_, i) => h(`i${i < m.breakthrough ? '.on' : ''}`)));
  const track = h('div.ub-pot-track', Array.from({ length: MAX_POTENTIAL }, (_, i) => h(`i${i < m.potential ? '.on' : ''}${i === MAX_POTENTIAL - 1 ? '.sig' : ''}`)));
  return h('div.ub', { 'data-testid': 'unit-build' },
    h('section.ub-sec',
      h('div.ub-sec-t', 'Growth'),
      h('div.ub-growth',
        tile('Breakthrough · Level', h('b', String(m.level), h('small', ` / ${m.cap}`)), pips),
        tile(['Awakening', m.ur ? urBadge() : null], stars(m.awaken, MAX_AWAKEN), h('span.ub-sub', m.awaken >= MAX_AWAKEN ? 'Fully awakened' : `★${m.awaken} of ${MAX_AWAKEN}`)),
        tile('Potential', h('b', `P${m.potential}`, h('small', ` / ${MAX_POTENTIAL}`)), track),
        tile('Power', h('b', { 'data-testid': 'build-power' }, fmt(m.power)), h('span.ub-sub', 'Before in-battle upgrades')))),
    h('section.ub-sec',
      h('div.ub-sec-t', 'Equipment', h('small', `${m.equipped} / 3 equipped`)),
      h('div.ub-gear', m.gear.map((g) => gearCard(g, gearText)))),
    m.totals.length ? h('section.ub-sec', h('div.ub-sec-t', 'Gear totals'), h('div.ub-tot', m.totals.map((t) => h('span', t.name, h('b', t.text))))) : null,
    h('section.ub-sec',
      h('div.ub-sec-t', 'Battle stats', h('small', 'before in-battle upgrades')),
      h('div.ub-stats', m.stats.map((s) => h('div.ub-st', h('span', s.label), h('b', s.value), s.delta ? h('em', s.delta) : null)))),
    snapshotOwner ? h('div.ub-foot', svgEl(uiIcon('info'), 'ub-foot-ico'), `Shared from ${snapshotOwner}'s game · numbers are what their game reported`) : null);
}
