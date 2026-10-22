// The girl page's Glance facts as plain data (docs/specs/UI_DIRECTION.md §5.2, §6.2): her role's three headline
// stats for the ink strip, the trait chips, the matchup row and the hero track band. Pure (no DOM): the girl page
// (src/ui/screens/student.js), the menu hold sheet (src/ui/unitSheet.js) and later the battle drawer read the same
// numbers. tests/ui/girlView.test.js.
import { ROLES, ATTACK_TYPES, ARMOR_CLASSES, TYPE_CHART, ELEMENTS, CAPABILITIES, PLACEMENT } from '../data/types.js';
import { ROLE_SUBCLASS } from '../data/wiki.js';
import { unitBattleStats } from '../systems/progression.js';
import { resolveStats } from '../sim/mods.js';
import { fmtNum } from './format.js';
import { shownTips, isAbilityTip } from '../data/unitTips.js';
import { abilityAtTier, skillAtLevel, abilityRuns } from '../data/abilities.js';
import { abilityText, abilityValues, fillAbilityText, abilityUpgradeLine, abilityNote } from '../data/abilityText.js';

/**
 * Her ⚡ ability for the girl page (ABILITIES_SPEC §10): the Info tab's one-line chip ("⚡ Skyfall Volley · Rapid
 * Volley T3") and its Details sheet — the description with her stats on that path at the unlock tier (no gear or
 * level: the base numbers), the cooldown, how it unlocks, the tier-5 / Lv 17 upgrade, and "Comes in a later update"
 * for a kind this build does not run. Null when she has none. A girl with one ability per path (Ruri: one per familiar
 * path; she learns the one whose path she raises) gets one chip naming them all ("⚡ Moon Pounce · Star Snatch · River
 * Rush · T3") and `forms`, one entry per path for the Details sheet; everyone has `forms` (one entry for most).
 * @param {object} unit UnitDef
 */
export function abilityInfoView(unit) {
  const hero = unit?.kind === 'hero';
  if (hero) return unit?.hero?.skill ? withForms([abilityFormView(unit, -1)]) : null;
  const idx = (unit?.paths || []).map((p, i) => (p?.ability ? i : -1)).filter((i) => i >= 0);
  if (!idx.length) return null;
  const forms = idx.map((pi) => abilityFormView(unit, pi));
  if (forms.length === 1) return withForms(forms);
  const at = new Set(forms.map((f) => f.at));
  return {
    ...forms[0],
    multi: true,
    forms,
    chip: `⚡ ${forms.map((f) => f.name).join(' · ')} · ${at.size === 1 ? `T${forms[0].at}` : 'by path'}`,
    unlock: `Unlocks at tier ${[...at].join(' / ')} of the path she raises: ${forms.map((f) => `${f.pathName} → ${f.name}`).join(', ')}`,
  };
}

const withForms = (forms) => ({ ...forms[0], multi: false, forms });

/** One ⚡ entry's view (a tower's path `pi`, or a hero's skill with pi −1). */
function abilityFormView(unit, pi) {
  const hero = pi < 0;
  const entry = hero ? unit.hero.skill : unit.paths[pi].ability;
  const name = abilityText(entry.id)?.name || entry.id;
  const at = hero ? entry.unlockLevel ?? 7 : entry.unlockTier ?? 3;
  const where = hero ? `LV ${at}` : `${unit.paths[pi].name} T${at}`;
  const live = abilityRuns(entry); // the one rule (src/data/abilities.js), the same as the sim's handlerOf
  const tiersAt = (n) => [0, 1, 2].map((p) => (p === pi ? n : 0));
  const statsAt = (n) => {
    try {
      return resolveStats(unit, hero ? { heroLevel: n } : { tiers: tiersAt(n) });
    } catch {
      return unit.base || null;
    }
  };
  const fill = (template, def, stats) => {
    try {
      return fillAbilityText(template, abilityValues(def, stats));
    } catch {
      return template.replace(/\{\w+\}/g, '…');
    }
  };
  const text = abilityText(entry.id);
  const note = abilityNote(entry.id); // (Details only: never on the battle's live hold card)
  const desc = text ? `${fill(text.desc, entry, statsAt(at))}${note ? ` ${note}` : ''}` : '';
  let up = null;
  if (hero && entry.ranks?.length) {
    const lv = entry.ranks[0].level;
    try {
      up = { at: `LV ${lv}`, line: abilityUpgradeLine(entry.id, abilityValues(skillAtLevel(entry, lv), statsAt(lv))) };
    } catch {
      up = null;
    }
  } else if (!hero && entry.t5) {
    try {
      up = { at: `${unit.paths[pi].name} T5`, line: abilityUpgradeLine(entry.id, abilityValues(abilityAtTier(entry, 5), statsAt(5))) };
    } catch {
      up = null;
    }
  }
  return {
    id: entry.id,
    name,
    hero,
    path: pi,
    pathName: hero ? null : unit.paths[pi].name,
    at,
    where,
    live,
    chip: `⚡ ${name} · ${where}`,
    desc,
    cooldown: `Recharges in ${entry.cooldown}s of wave time`,
    unlock: hero ? `Unlocks at hero LV ${at}` : `Unlocks at ${unit.paths[pi].name} tier ${at}`,
    up,
    later: live ? null : 'Comes in a later update',
  };
}

/** One decimal at most, trailing ".0" dropped (11.8, 12, 0.9); large values in the short form. */
const stat1 = (v) => (Math.abs(v) >= 10000 ? fmtNum(v) : String(Math.round(v * 10) / 10));
const pctWhole = (mul) => Math.round((mul - 1) * 100);

/**
 * Which headline set a girl gets (owner, Oct 20): heroes DMG · RATE · ULT; income COINS/WAVE · RANGE · COST;
 * supports (an aura, the council hub or the team drinks) BUFF · RANGE · AFFECTS; everyone else DMG · RATE · RANGE.
 * @returns {'hero'|'income'|'support'|'shooter'}
 */
export function headlineKind(unit) {
  if (unit?.kind === 'hero' || unit?.hero) return 'hero';
  const b = unit?.base || {};
  if (b.income?.perWave) return 'income';
  if (b.aura || b.hub || b.drink) return 'support';
  return 'shooter';
}

/** What a support's buff is: "+10%" with its stat, or one word (Veil Sight, cleanse). */
function buffOf(b) {
  const a = b.aura || null;
  if (a?.dmgMul && a.dmgMul !== 1) return { value: `+${pctWhole(a.dmgMul)}%`, unit: 'DMG', title: `Allies in her aura deal +${pctWhole(a.dmgMul)}% damage` };
  if (a?.rateMul && a.rateMul !== 1) return { value: `+${pctWhole(a.rateMul)}%`, unit: 'SPD', title: `Allies in her aura attack +${pctWhole(a.rateMul)}% faster` };
  if (a?.rangeMul && a.rangeMul !== 1) return { value: `+${pctWhole(a.rangeMul)}%`, unit: 'RNG', title: `Allies in her aura reach +${pctWhole(a.rangeMul)}% farther` };
  if (a?.costCut) return { value: `−${Math.round(a.costCut * 100)}%`, unit: 'COST', title: `Upgrades in her aura cost ${Math.round(a.costCut * 100)}% less` };
  if (b.hub?.costCut) return { value: `−${Math.round(b.hub.costCut * 100)}%`, unit: 'COST', title: `Upgrades in her office cost ${Math.round(b.hub.costCut * 100)}% less` };
  if (a?.detection) return { value: 'Sight', unit: null, title: 'Allies in her aura gain Veil Sight' };
  if (a?.cleanse) return { value: 'Cleanse', unit: null, title: 'Her aura clears sabotage' };
  if (b.drink) return { value: 'Speed', unit: null, title: 'Her sports drinks speed up the girl who has dealt the most damage' };
  return { value: 'Aura', unit: null, title: 'Her aura helps the girls around her' };
}

/**
 * Her role's three headline stats, as she fights at tier 0 (level, gear, awakening and Potential: the same
 * numbers as the Base stats sheet's "Yours" column).
 * @param {object} unit UnitDef
 * @param {object} profile whose girl (the save, or a snapshot's mini profile)
 * @returns {{ key: string, label: string, value: string, unit: string|null, title: string }[]} always 3
 */
export function headlineStats(unit, profile) {
  const battle = unitBattleStats(profile, unit.id);
  const y = resolveStats(unit, { unitStats: battle });
  const b = unit.base || {};
  const dmg = { key: 'dmg', label: 'DMG', value: stat1(y.damage || 0), unit: null, title: `Damage per hit ${stat1(y.damage || 0)}` };
  const rate = { key: 'rate', label: 'RATE', value: stat1(y.rate || 0), unit: '/s', title: `${stat1(y.rate || 0)} attacks per second` };
  const range = (r, what = 'Range') => ({ key: 'range', label: 'RANGE', value: fmtNum(r || 0, 'range'), unit: null, title: `${what} ${fmtNum(r || 0, 'range', { detail: true })}` });
  switch (headlineKind(unit)) {
    case 'hero': {
      const ult = unit.hero?.ult || {};
      const at = ult.unlockLevel ?? 3;
      return [dmg, rate, { key: 'ult', label: 'ULT', value: `LV ${at}`, unit: null, title: `${ult.name || 'Her ultimate'} unlocks at hero level ${at}` }];
    }
    case 'income': {
      const per = (y.income?.perWave ?? b.income.perWave) || 0;
      const cost = Math.round((b.cost || 0) * (battle.costMul || 1));
      return [
        { key: 'coins', label: 'COINS/WAVE', value: `+${fmtNum(per)}`, unit: null, title: `+${fmtNum(per)} coins every wave` },
        range(y.range),
        { key: 'cost', label: 'COST', value: fmtNum(cost, 'money', { round: 'up' }), unit: null, title: `Deploy cost ${fmtNum(cost, 'money', { detail: true })} coins` },
      ];
    }
    case 'support': {
      const buff = buffOf(b);
      const reach = b.aura?.range || b.hub?.radius || y.range;
      const affects = b.drink ? { value: 'Top hitter', title: 'The girl in her range who has dealt the most damage' } : { value: 'Allies', title: b.hub ? 'Every girl inside her office' : 'Every girl inside her aura (never herself)' };
      return [
        { key: 'buff', label: 'BUFF', value: buff.value, unit: buff.unit, title: buff.title },
        range(reach, b.aura ? 'Aura range' : b.hub ? 'Office radius' : 'Range'),
        { key: 'affects', label: 'AFFECTS', value: affects.value, unit: null, title: affects.title },
      ];
    }
    default:
      return [dmg, rate, range(y.range)];
  }
}

/** The one sentence under her role: the shorter of her subclass line and her role's line. */
export function roleSentence(unit) {
  const a = ROLE_SUBCLASS[unit.role]?.desc || '';
  const b = ROLES[unit.role]?.desc || '';
  if (!a) return b;
  if (!b) return a;
  return a.length <= b.length ? a : b;
}

/**
 * Her role in full for Details (the Base stats sheet's Role section, §6.2 "nothing is deleted"): the subclass
 * label ("Generalist", "Frontline", "Arcane Caster") and both lines, the Glance one first.
 * @returns {{ label: string, lines: string[] }}
 */
export function roleDetails(unit) {
  const label = ROLE_SUBCLASS[unit.role]?.label || ROLES[unit.role]?.name || unit.role;
  const glance = roleSentence(unit);
  const lines = [glance, ROLE_SUBCLASS[unit.role]?.desc || '', ROLES[unit.role]?.desc || ''].filter(Boolean);
  return { label, lines: [...new Set(lines)] };
}

/**
 * The tips her Profile sheet lists. A ⚡ tip ("<path> tier 3 teaches <ability>: …") shows only when her first ⚡
 * ability runs in this build (abilityRuns): never promise a button players cannot use (the menus' shownTips rule).
 */
export { isAbilityTip };
export function profileTips(unit) {
  return shownTips(unit); // one switch for every menu: ABILITY_TIPS_SHOWN in data/unitTips.js
}

/**
 * Her traits, Glance first: the attack type, the element, the tier-0 capabilities, water placement; then the
 * capabilities her upgrades add (`later`). The Info tab shows 3 and a "+N" chip for the rest.
 * @returns {{ id: string, kind: 'attack'|'element'|'cap'|'place', key: string, name: string, desc: string, later?: boolean }[]}
 */
export function traitList(unit) {
  const out = [];
  const at = ATTACK_TYPES[unit.attackType];
  if (at) out.push({ id: `attack:${unit.attackType}`, kind: 'attack', key: unit.attackType, name: at.name, desc: at.desc || '' });
  const el = unit.element ? ELEMENTS[unit.element] : null;
  if (el) out.push({ id: `element:${unit.element}`, kind: 'element', key: unit.element, name: el.name, desc: el.desc || '' });
  for (const c of unit.capabilities || []) {
    if (c === 'water') continue; // placement, below
    out.push({ id: `cap:${c}`, kind: 'cap', key: c, name: CAPABILITIES[c]?.name || c, desc: CAPABILITIES[c]?.desc || '' });
  }
  if (unit.placement && unit.placement !== 'land') out.push({ id: `place:${unit.placement}`, kind: 'place', key: unit.placement, name: PLACEMENT[unit.placement]?.name || unit.placement, desc: PLACEMENT[unit.placement]?.desc || '' });
  for (const c of unit.pathCapabilities || []) {
    if ((unit.capabilities || []).includes(c)) continue;
    out.push({ id: `cap:${c}`, kind: 'cap', key: c, name: CAPABILITIES[c]?.name || c, desc: CAPABILITIES[c]?.desc || '', later: true });
  }
  return out;
}

/** ▲▲ / ▲ / ▼ / ▼▼ for a type multiplier (the arrow carries the meaning, not only the colour). */
export function matchArrows(mult) {
  if (mult >= 1.5) return '▲▲';
  if (mult > 1) return '▲';
  if (mult <= 0.5) return '▼▼';
  if (mult < 1) return '▼';
  return '';
}

/**
 * The matchup row: every armor class her attack type is better or worse against (even ones are left out),
 * strongest first. `mult` is for the Details table only; the row shows arrows and the armor word.
 * @returns {{ armor: string, name: string, mult: number, arrows: string, up: boolean }[]}
 */
export function matchupList(attackType) {
  const row = TYPE_CHART[attackType] || {};
  return Object.values(ARMOR_CLASSES)
    .map((c) => ({ armor: c.id, name: c.name, mult: row[c.id] ?? 1 }))
    .filter((m) => m.mult !== 1)
    .sort((a, b) => b.mult - a.mult)
    .map((m) => ({ ...m, arrows: matchArrows(m.mult), up: m.mult > 1 }));
}

/**
 * The hero track band (§6.2): her current battle level ±`radius` rows (clamped to the track); the full track sits
 * behind "Full track". Outside a battle she starts every battle at level 1.
 * @param {{ level: number }[]} levels
 * @param {{ current?: number, radius?: number }} [o]
 */
export function heroBandView(levels, { current = 1, radius = 2 } = {}) {
  const n = levels.length;
  const cur = Math.max(1, Math.min(n, Math.floor(current) || 1));
  const from = Math.max(1, cur - radius);
  const to = Math.min(n, cur + radius);
  return { current: cur, from, to, rows: levels.filter((l) => l.level >= from && l.level <= to), more: n > to - from + 1, total: n };
}
