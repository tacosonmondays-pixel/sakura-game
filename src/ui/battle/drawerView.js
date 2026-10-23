// The battle drawers' view models (UI_DIRECTION M2 §6.6 and the owner's tactical pick, Oct 20: the dark ink-plate
// panel of docs/specs/ui-mock/tactical-oct14/battle-panel-844x390.webp). Pure and Node-safe: towerPanel.js draws
// what these return, and tests/battle-ui/drawerView.test.js pins the rules.
//
//   drawerStats(t, st, o)          the stat row: the role's 3 headline stats (+ PIERCE where she pierces)
//   targetView(t, st, o)           FIRST · LAST · STRONG · CLOSE (+N: PRIORITY, AIR) or Azami's strip chips
//   aimView(t, mode, o)            AUTO · SET AIM for mortar / mirror girls
//   pathRowView(def, tiers, i, st, o)  one path row: edge colour, tier line, pips, price / lock / holder / MAX
//   createBuyArm({ ms, now })      the two-tap buy: tap 1 arms (expands the row), tap 2 buys; disarms after 2.6 s
//   footerView(spent, value, o)    INVESTED n · SELL +n (two-tap confirm)
//   heroNextLine(def, level)       "Steady Guard · +1 dmg"
//   heroDrawerView(t, o)           the hero drawer: LV, XP fraction, Level up price, the Next line, the ult row
//   sectionNumbers(texts)          how many shown texts hold a number (each section ≤ SECTION_NUMBERS)
import { fmtNum } from '../format.js';
import { headlineKind } from '../girlView.js';
import { effectParts, tierTags, UPGRADE_TAGS, TRANSFORM_TAG } from '../upgradeTags.js';
import { TARGET_MODES } from '../../data/types.js';
import { pathCap } from './rules.js';

/** The upgrade paths' edge colours (VAULT_BRIEF §2.4: 1 #ff5d7a, 2 #3b8cff, 3 #9b6bff). */
export const PATH_COLORS = Object.freeze(['#ff5d7a', '#3b8cff', '#9b6bff']);
/** The four target chips always shown (owner default Q5: 4 chips + "+N"). */
export const TARGET_CHIPS = Object.freeze(['first', 'last', 'strong', 'close']);
/** The modes behind "+N" (Air only for a girl who hits flyers). */
export const TARGET_EXTRA = Object.freeze(['elite', 'air']);
/** Behaviours that pick a target (the rest have no target row). */
export const TARGETABLE = new Set(['projectile', 'beam', 'chain', 'duel', 'turret']);
/** How long tap 1 keeps a price button armed (the Sell confirm uses the same). */
export const BUY_ARM_MS = 2600;
/** At most this many numbers in one drawer section (UI_DIRECTION P3; Q6 budgets each section). */
export const SECTION_NUMBERS = 4;

const MODE_HELP = {
  first: 'Closest to the exit',
  last: 'Furthest from the exit',
  strong: 'Highest HP',
  close: 'Nearest to her',
  elite: 'Casters, siphoners, elites, bosses first',
  air: 'Flyers first, then the leader',
};

const pct = (mul) => Math.round((mul - 1) * 100);
const label = (mode) => (TARGET_MODES[mode] || mode).toUpperCase();

/** Does she pierce (the stat row's fourth cell)? Her attack passes through more than one enemy, or gear Pierce. */
export function pierces(t, st) {
  return (st?.pierce || 0) > 1 || Math.round(t?.unitStats?.pierceK || 0) > 0;
}

/** A support's buff for the BUFF cell, from her live aura or office (one number at most). */
function buffCell(st, def) {
  const a = st.aura || null;
  const hub = st.hub || null;
  const base = def?.base || {};
  if (a?.dmgMul > 1) return { value: `+${pct(a.dmgMul)}%`, unit: 'DMG', title: `Girls in her aura deal +${pct(a.dmgMul)}% damage` };
  if (a?.rateMul > 1) return { value: `+${pct(a.rateMul)}%`, unit: 'SPD', title: `Girls in her aura attack +${pct(a.rateMul)}% faster` };
  if (a?.rangeMul > 1) return { value: `+${pct(a.rangeMul)}%`, unit: 'RNG', title: `Girls in her aura reach +${pct(a.rangeMul)}% farther` };
  if (a?.costCut > 0) return { value: `−${Math.round(a.costCut * 100)}%`, unit: 'COST', title: `Upgrades in her aura cost ${Math.round(a.costCut * 100)}% less` };
  if (hub?.costCut > 0) return { value: `−${Math.round(hub.costCut * 100)}%`, unit: 'COST', title: `Upgrades in her office cost ${Math.round(hub.costCut * 100)}% less` };
  if (a?.detection) return { value: 'Sight', unit: null, title: 'Girls in her aura gain Veil Sight' };
  if (a?.cleanse) return { value: 'Cleanse', unit: null, title: 'Her aura clears sabotage' };
  if (base.drink) return { value: 'Speed', unit: null, title: 'Her sports drinks speed up the girl who has dealt the most damage' };
  if (st.brew || base.brew) return { value: 'Brew', unit: null, title: 'Her brew helps the girls she picks' };
  return { value: 'Aura', unit: null, title: 'Her aura helps the girls around her' };
}

/**
 * The drawer's stat row: caps labels over big numbers, the role's three headline stats (UI_DIRECTION §5.2 roles:
 * shooter DMG · RATE · RANGE, support BUFF · RANGE · AFFECTS, income COINS/WAVE · RANGE · COST, hero DMG · RATE · ULT)
 * plus PIERCE where she pierces. Only the first number takes the plate accent.
 * @param {object} t TowerRT (def, unitStats, isHero)
 * @param {object} st sim.towerStats(t.uid)
 * @param {{ affects?: number|null, placeCost?: number|null, ultStatus?: object|null }} [o]
 *   affects: how many girls she buffs now (sim.buffTargets length); placeCost: what one more of her costs now;
 *   ultStatus: the hero's sim.heroUltStatus() (her own hero) for the ULT cell
 * @returns {{ key: string, label: string, value: string, unit: string|null, title: string, accent: boolean }[]}
 */
export function drawerStats(t, st, { affects = null, placeCost = null, ultStatus = null } = {}) {
  const def = t.def;
  const kind = headlineKind(def);
  const range = (r, what = 'Range') => ({ key: 'range', label: 'RANGE', value: fmtNum(r || 0, 'range', { fixed: true }), unit: null, title: `${what} ${fmtNum(r || 0, 'range', { detail: true })}` });
  const hit = st.damage || st.trap?.damage || st.turret?.damage || 0;
  const dmg = { key: 'dmg', label: 'DMG', value: fmtNum(hit, 'stat'), unit: null, title: `Damage per hit ${fmtNum(hit, 'stat')}` };
  const rateNum = fmtNum(st.rate || 0, 'rate');
  const rate = { key: 'rate', label: 'RATE', value: rateNum.replace(/\/s$/, ''), unit: '/s', title: `${rateNum.replace(/\/s$/, '')} ${st.behavior === 'trap' ? 'traps' : 'attacks'} per second` };
  let cells;
  switch (kind) {
    case 'hero': {
      const ult = def.hero?.ult || {};
      const at = ult.unlockLevel ?? 3;
      const unlocked = ultStatus ? !!ultStatus.unlocked : (t.level || 1) >= at;
      const rank = st.ultRank || 1;
      cells = [dmg, rate, unlocked
        ? { key: 'ult', label: 'ULT', value: `R${rank}`, unit: null, title: `${ult.name || 'Her ultimate'}: rank ${rank}` }
        : { key: 'ult', label: 'ULT', value: fmtNum(at, 'level'), unit: null, title: `${ult.name || 'Her ultimate'} unlocks at hero level ${at}` }];
      break;
    }
    case 'income': {
      const per = st.income?.perWave || 0;
      const cost = placeCost ?? 0;
      cells = [
        { key: 'coins', label: 'COINS/WAVE', value: `+${fmtNum(per, 'money')}`, unit: null, title: `+${fmtNum(per, 'money', { detail: true })} coins every wave` },
        range(st.range),
        { key: 'cost', label: 'COST', value: fmtNum(cost, 'money', { round: 'up' }), unit: null, title: `One more ${def.name} costs ${fmtNum(cost, 'money', { detail: true, round: 'up' })} coins` },
      ];
      break;
    }
    case 'support': {
      const buff = buffCell(st, def);
      const reach = st.aura?.range || st.hub?.radius || st.range;
      const n = affects ?? 0;
      cells = [
        { key: 'buff', label: 'BUFF', value: buff.value, unit: buff.unit, title: buff.title },
        range(reach, st.aura ? 'Aura range' : st.hub ? 'Office radius' : 'Range'),
        { key: 'affects', label: 'AFFECTS', value: fmtNum(n, 'count'), unit: n === 1 ? 'GIRL' : 'GIRLS', title: `She buffs ${n} girl${n === 1 ? '' : 's'} now` },
      ];
      break;
    }
    default:
      cells = [dmg, rate, range(st.range)];
  }
  if (kind !== 'support' && kind !== 'income' && pierces(t, st)) {
    const gearPierce = Math.round(t.unitStats?.pierceK || 0);
    cells.push({ key: 'pierce', label: 'PIERCE', value: fmtNum(Math.max(1, st.pierce || 1), 'count'), unit: null, title: gearPierce > 0 ? `Pierces ${st.pierce} enemies, +${gearPierce}% chance of one more` : `Pierces ${st.pierce} enemies` });
  }
  return cells.map((c, i) => ({ ...c, accent: i === 0 }));
}

/**
 * Her target row. A targeting girl: FIRST · LAST · STRONG · CLOSE, then PRIORITY (and AIR when she hits flyers)
 * behind a "+N" chip; an extra mode in use shows filled in its place. Azami: Near exit · Spread (· Checkpoint from
 * Checkpoint tier 3) instead. Null when she picks no target.
 * @param {{ expanded?: boolean, aiming?: boolean, aimMode?: string|null }} [o]
 * @returns {null | { kind: 'target'|'strip', label: string, chips: { mode: string, label: string, on: boolean, title: string, testid?: string }[], more: number }}
 */
export function targetView(t, st, { expanded = false, aiming = false, aimMode = null } = {}) {
  if (st.behavior === 'strip') {
    const checkpoint = !!t.aim || aiming;
    const chips = [
      { mode: 'first', label: 'NEAR EXIT', on: !checkpoint && t.targetMode !== 'last', title: 'On the free road spot nearest the exit', testid: 'strip-exit' },
      { mode: 'last', label: 'SPREAD', on: !checkpoint && t.targetMode === 'last', title: 'Spread along the road', testid: 'strip-spread' },
    ];
    if (aimMode === 'checkpoint') chips.push({ mode: 'checkpoint', label: aiming ? 'TAP MAP…' : 'CHECKPOINT', on: checkpoint, title: 'Tap the road: her strips land around that point', testid: 'aim-set' });
    return { kind: 'strip', label: 'STRIPS', chips, more: 0 };
  }
  if (!TARGETABLE.has(st.behavior)) return null;
  const extras = TARGET_EXTRA.filter((m) => m !== 'air' || st.canHitAir);
  const chip = (mode) => ({ mode, label: label(mode), on: t.targetMode === mode, title: MODE_HELP[mode] || '' });
  const chips = TARGET_CHIPS.map(chip);
  if (expanded) return { kind: 'target', label: 'TARGET', chips: [...chips, ...extras.map(chip)], more: 0 };
  const inUse = extras.filter((m) => m === t.targetMode);
  return { kind: 'target', label: 'TARGET', chips: [...chips, ...inUse.map(chip)], more: extras.length - inUse.length };
}

/** The aim row of a mortar / mirror girl (an aimed hero ult too): Auto · Set aim. Null for others and Azami. */
export function aimView(t, mode, { aiming = false } = {}) {
  if (!mode || mode === 'checkpoint') return null;
  return {
    label: mode === 'mirror' ? 'MIRROR' : 'AIM',
    chips: [
      { mode: 'auto', label: 'AUTO', on: !t.aim && !aiming, title: 'She picks the spot herself', testid: 'aim-auto' },
      { mode: 'set', label: aiming ? 'TAP MAP…' : t.aim ? 'RE-AIM' : 'SET AIM', on: !!t.aim || aiming, title: 'Tap the map to aim', testid: 'aim-set' },
    ],
  };
}

/** One line for a crosspath lock (the "i" beside it gives the full reason). */
export function crosspathShort(tiers, path) {
  const others = [0, 1, 2].filter((p) => p !== path);
  if ((tiers[path] || 0) === 0 && others.filter((p) => tiers[p] > 0).length >= 2) return 'Two paths already upgraded';
  return 'Only one path can pass T2';
}

/**
 * One path row of the drawer.
 * @param {object} def UnitDef
 * @param {number[]} tiers her tiers
 * @param {number} i path index
 * @param {object} us sim.upgradeStatus(uid, i)
 * @param {{ held?: boolean, holder?: { line: string, uid: number }|null, armed?: boolean, readOnly?: boolean,
 *   ended?: boolean, wide?: boolean, desc?: string|null, mods?: object|null }} [o]
 *   held: another copy holds this path's final tier (the last pip shows it); holder: her line for "Show ›";
 *   armed: tap 1 landed (the row is expanded, the button reads "Buy · 565"); readOnly: an ally's girl;
 *   wide: 1280 (the expanded line may carry the tier's full sentence); desc: that sentence; mods: the next tier's ModSet
 * @returns {object}
 */
export function pathRowView(def, tiers, i, us, { held = false, holder = null, armed = false, readOnly = false, ended = false, wide = false, desc = null, mods = null } = {}) {
  const p = def.paths[i];
  const cur = tiers[i] || 0;
  const cap = pathCap(tiers, i);
  const n = p.tiers.length;
  const pips = p.tiers.map((_, k) => (k < cur ? 'on' : k === n - 1 && held ? 'held' : k >= cap ? 'capped' : k === cur && (!us.locked || us.reason === 'cash') ? 'next' : 'off'));
  const base = { i, name: p.name, color: PATH_COLORS[i] || PATH_COLORS[0], pips, cur, armed: false, chips: [], desc: null, price: null, priceText: null, lock: null, holder: null, readOnly };
  if (us.reason === 'max' || !us.next) {
    return { ...base, state: 'max', tierLine: `T${cur} · ${(p.tiers[cur - 1]?.name || '').toUpperCase()}`, sticker: 'MAX' };
  }
  const tierLine = `T${cur + 1} · ${us.next.name.toUpperCase()}`;
  if (us.reason === 'crosspath') return { ...base, state: 'crosspath', tierLine, lock: crosspathShort(tiers, i) };
  if (us.reason === 'onePerPath') return { ...base, state: 'final', tierLine, holder };
  const poor = us.reason === 'cash';
  const price = us.cost;
  const priceText = fmtNum(price, 'money', { round: 'up' });
  const state = ended ? 'ended' : poor ? 'poor' : 'buy';
  const view = { ...base, state, tierLine, price, priceText, armed: !!armed && !readOnly && !ended };
  if (view.armed) {
    // tap 1: the next tier's effects as up to 3 chips; the row's numbers stay ≤ SECTION_NUMBERS (tier, price, chips)
    let numbers = 2;
    for (const c of effectParts(mods || us.next.mods || {}, 3)) {
      const has = /\d/.test(c);
      if (has && numbers >= SECTION_NUMBERS) continue;
      if (has) numbers++;
      view.chips.push(c);
    }
    if (wide && desc) view.desc = desc;
    view.buyLabel = poor ? null : 'Buy';
  }
  return view;
}

/**
 * Who a tier helps, as one-word tags for the open row ("SELF", "ALLIES", "ENEMIES", "COINS", "NEW ATTACK"): the tag
 * shape without a number (UI_DIRECTION §5.1: one tag per path or card). The aura radius is in the effect chips.
 * @returns {string[]}
 */
export function rowTags(def, path, tier) {
  const out = [];
  for (const t of tierTags(def, path, tier)) {
    const label = UPGRADE_TAGS[t.id]?.label;
    if (label && !out.includes(label.toUpperCase())) out.push(label.toUpperCase());
    if (t.transform && !out.includes(TRANSFORM_TAG.label.toUpperCase())) out.push(TRANSFORM_TAG.label.toUpperCase());
  }
  return out;
}

/**
 * The two-tap buy (UI_DIRECTION M2 "two-tap buy"): tap 1 on a price (or a row) arms that row, tap 2 on the same
 * price buys; another tap elsewhere, or 2.6 s, disarms. Pure: `now` is injected.
 * @param {{ ms?: number, now?: () => number }} [o]
 */
export function createBuyArm({ ms = BUY_ARM_MS, now = () => Date.now() } = {}) {
  let armed = null; // { uid, path, at }
  const live = () => {
    if (armed && now() - armed.at >= ms) armed = null;
    return armed;
  };
  return {
    /** A tap on path `path`'s price of girl `uid`: 'arm' (tap 1) or 'buy' (tap 2 within the window). */
    tap(uid, path) {
      const a = live();
      if (a && a.uid === uid && a.path === path) {
        armed = null;
        return 'buy';
      }
      armed = { uid, path, at: now() };
      return 'arm';
    },
    /** A tap on the row body: arms it, or disarms it when it is the armed one ('arm' | 'disarm'). */
    toggle(uid, path) {
      const a = live();
      if (a && a.uid === uid && a.path === path) {
        armed = null;
        return 'disarm';
      }
      armed = { uid, path, at: now() };
      return 'arm';
    },
    /** The armed path of girl `uid`, or null. */
    armedPath(uid) {
      const a = live();
      return a && a.uid === uid ? a.path : null;
    },
    /** Milliseconds until the armed row disarms (0 when none). */
    left() {
      const a = live();
      return a ? Math.max(0, ms - (now() - a.at)) : 0;
    },
    disarm() {
      armed = null;
    },
  };
}

/** The footer: INVESTED n · SELL +n (armed: CONFIRM +n). Money rounds down (never more than she returns). */
export function footerView(spent, value, { armed = false } = {}) {
  return {
    invested: fmtNum(spent || 0, 'money'),
    sellLabel: armed ? 'CONFIRM' : 'SELL',
    sellValue: `+${fmtNum(value || 0, 'money')}`,
    armed,
  };
}

/** "Steady Guard · +1 dmg": a hero track level's name and its first effect (the hero drawer's Next line). */
export function heroNextLine(def, level) {
  const row = def?.hero?.levels?.find((l) => l.level === level);
  if (!row) return '';
  const name = String(row.desc || '').split(/[:;]/)[0].replace(/[.\s]+$/, '').trim();
  const fx = effectParts(row.mods || {}, 1)[0] || '';
  return fx && !name.includes(fx) ? `${name} · ${fx}` : name;
}

/**
 * The hero drawer's Glance (UI_DIRECTION §6.6): LV, the XP bar's fraction (no numbers on it), the Level up price,
 * one Next line, the ult row.
 * @param {object} t the hero TowerRT
 * @param {{ xp?: object|null, level?: object|null, ult?: object|null, max?: number, own?: boolean }} o
 *   xp: towerStats().xp; level: sim.heroLevelStatus() (own hero); ult: sim.heroUltStatus() (own hero)
 */
export function heroDrawerView(t, { xp = null, level = null, ult = null, max = 25, own = true } = {}) {
  const def = t.def;
  const atMax = (t.level || 1) >= max;
  const frac = !xp || xp.next == null ? 1 : Math.max(0, Math.min(1, (xp.xp - xp.current) / Math.max(1, xp.next - xp.current)));
  const u = def.hero?.ult || null;
  const unlockAt = u?.unlockLevel ?? 3;
  const unlocked = ult ? !!ult.unlocked : (t.level || 1) >= unlockAt;
  const ranks = u?.ranks || [];
  const rank = 1 + ranks.filter((r) => (t.level || 1) >= r.level).length;
  let buy = null;
  if (own && level && level.reason !== 'max' && level.reason !== 'noHero') {
    buy = { price: level.price, priceText: fmtNum(level.price, 'money', { round: 'up' }), poor: level.reason === 'cash', ended: level.reason === 'ended', level: level.level };
  }
  return {
    name: def.name,
    lv: atMax ? 'MAX' : fmtNum(t.level || 1, 'level'),
    mastery: atMax && t.mastery > 0 ? `+${Math.round(t.mastery * 100)}%` : null,
    xpFrac: frac,
    buy,
    next: atMax ? null : heroNextLine(def, (t.level || 1) + 1),
    ult: u ? { name: u.name, line: unlocked ? `Rank ${rank}` : `Unlocks at ${fmtNum(unlockAt, 'level')}`, unlocked, rank } : null,
  };
}

/**
 * The open path row's ⚡ line without the tier (the row's tier line says it): "⚡ T3 Hawk Eye — unlocks Skyfall Volley"
 * → "⚡ Unlocks Skyfall Volley"; "⚡+ T5 … — upgrades …" → "⚡ Upgrades …"; "⚡ T3 … — Drone Surge comes in a later
 * update" → "⚡ Drone Surge comes in a later update" (abilityRow.js pathAbilityTeaser's words, no number).
 */
export function shortTeaser(teaser) {
  const rest = String(teaser || '').replace(/^⚡\+?\s*T\d+\s[^—]*—\s*/, '');
  return `⚡ ${rest.charAt(0).toUpperCase()}${rest.slice(1)}`;
}

/** How many of these shown texts hold a number (the UI probe counts each element with a digit once). */
export function sectionNumbers(texts) {
  return (texts || []).filter((s) => s != null && /\d/.test(String(s))).length;
}

/** The texts each section of a girl's drawer shows (for the ≤ 4 numbers rule): header, stats, paths, footer. */
export function drawerSections({ code = '', pot = null, stats = [], rows = [], footer = null, target = null } = {}) {
  const out = {
    header: [code, pot],
    target: target ? [...target.chips.map((c) => c.label), target.more ? `+${target.more}` : null] : [],
    stats: stats.map((c) => c.value),
    footer: footer ? [footer.invested, footer.sellValue] : [],
  };
  rows.forEach((r, k) => {
    out[`path${k}`] = [r.tierLine, r.priceText, ...(r.chips || []), r.lock, r.holder?.line];
  });
  return out;
}
