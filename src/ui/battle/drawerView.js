// The battle drawers' view models (UI_DIRECTION M2 §6.6 and the owner's tactical pick, Oct 20: the dark ink-plate
// panel of docs/specs/ui-mock/tactical-oct14/battle-panel-844x390.webp). Pure and Node-safe: towerPanel.js draws
// what these return, and tests/battle-ui/drawerView.test.js pins the rules.
//
//   hitDamage(st)                  the damage one hit really deals (a trapper's: her trap's)
//   drawerStats(t, st, o)          the stat row: the role's 3 headline stats (+ PIERCE where she pierces)
//   gearPierce(t, st)              her gear Pierce % where it adds targets (shots, beams, drones, Kaede's blade), else 0
//   targetView(t, st, o)           FIRST · LAST · STRONG · CLOSE (+N: PRIORITY, AIR) or Azami's strip chips
//   aimView(t, mode, o)            AUTO · SET AIM for mortar girls; AUTO · PLACE · 1…5 for Iroha's mirrors
//   pathRowView(def, tiers, i, st, o)  one path row: edge colour, tier line, pips, price / lock / holder / MAX
//   createBuyArm({ ms, now })      the two-tap buy: tap 1 arms (expands the row), tap 2 buys; disarms after 2.6 s
//   footerView(spent, value, o)    INVESTED n · SELL +n (two-tap confirm)
//   heroNextLine(def, level)       "Steady Guard · +1 dmg"
//   heroDrawerView(t, o)           the hero drawer: LV, XP fraction, Level up price, the Next line, the ult row
//   allyNoteText(owner, o)         the ally note (a girl's or a hero's): the full sentence at 1280, one short line on a phone
//   holderParts(line)              "Held by Aoi 5-0-0" and " · top right" (a phone's holder line drops the place to stay one line)
//   contentBelow(port, bottoms)    how far the body's content reaches below the fold (the scroll cue's rule)
//   rowAir(spare, heights, tap)    a phone's spare room shared out to its chip rows' bands (each up to the dense tap size)
import { fmtNum } from '../format.js';
import { headlineKind, buffOf } from '../girlView.js';
import { effectParts, tierTags, UPGRADE_TAGS, TRANSFORM_TAG } from '../upgradeTags.js';
import { TARGET_MODES } from '../../data/types.js';
import { pathCap } from './rules.js';

/** The upgrade paths' edge colours (VAULT_BRIEF §2.4: 1 #ff5d7a, 2 #3b8cff, 3 #9b6bff). */
export const PATH_COLORS = Object.freeze(['#ff5d7a', '#3b8cff', '#9b6bff']);
/** The four target chips always shown (owner default Q5: 4 chips + an overflow chip, "⋯"). */
export const TARGET_CHIPS = Object.freeze(['first', 'last', 'strong', 'close']);
/** The modes behind the overflow chip "⋯" (Air only for a girl who hits flyers). */
export const TARGET_EXTRA = Object.freeze(['elite', 'air']);
/**
 * Behaviours that pick a target (the rest have no target row). The attack shapes: a Blossom Wheel aims her toss coins
 * by target mode, a held stream or sweep locks her enemy by it, a Rising Spikes row rises under it (src/sim/wheels.js,
 * held.js, ground.js), a Homecoming Throw's fans fly at her targets (links.js); a Pinwheel Stream does
 * not (its arms take the first enemy they find), so 'spin' has none.
 */
export const TARGETABLE = new Set(['projectile', 'beam', 'chain', 'duel', 'turret', 'wheel', 'stream', 'sweep', 'spikes', 'return']);
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

const label = (mode) => (TARGET_MODES[mode] || mode).toUpperCase();

/** Behaviours whose hits come from what she lays on the road: the trap's damage is the hit, never her base damage. */
const TRAPPERS = new Set(['trap', 'strip']);

/**
 * The damage one of her hits really deals: a trapper's (Suzu's traps, Azami's strips) is her trap's (the sim's
 * towerStats().trap.damage, which her paths raise; her `damage` stays at the base value); anyone else's is her
 * attack's, or her drones' when she has no attack of her own.
 */
export function hitDamage(st) {
  if (TRAPPERS.has(st?.behavior)) return st.trap?.damage ?? st.damage ?? 0;
  return st?.damage || st?.turret?.damage || 0;
}

/**
 * Her gear Pierce in % where it gives her extra targets (towers.js shotPierce, bladeArts, drones): a shot without splash,
 * a beam, her drones, Kaede's blade, a wheel's or spin's shots, a spike row's spikes. 0 for traps, strips, a duel without a blade, blasts, pulses, held shapes and chains:
 * there it widens the blast (mods.js applyGearReach), adds pulse hits or a held stream's / sweep's victims (src/sim/held.js)
 * or one more jump, never a pierced enemy.
 */
export function gearPierce(t, st) {
  const k = Math.round(t?.unitStats?.pierceK || 0);
  const b = st?.behavior;
  // (the attack shapes: a Blossom Wheel's and a Pinwheel Stream's shots pierce more, a Rising Spikes row grows a spike per 100 %,
  // a Homecoming Throw's fans cut more each way)
  const extra = b === 'beam' || b === 'turret' || !!st?.turret || (b === 'projectile' && !(st.splash > 0)) || (b === 'duel' && !!t?.eff?.blade)
    || b === 'wheel' || b === 'spin' || b === 'spikes' || b === 'return';
  return k > 0 && extra ? k : 0;
}

/** Does she pierce (the stat row's fourth cell)? Her attack passes through more than one enemy, or gear Pierce does. */
export function pierces(t, st) {
  return (st?.pierce || 0) > 1 || gearPierce(t, st) > 0;
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
  const hit = hitDamage(st);
  const dmg = { key: 'dmg', label: 'DMG', value: fmtNum(hit, 'stat'), unit: null, title: `${TRAPPERS.has(st.behavior) ? 'Damage per trap hit' : 'Damage per hit'} ${fmtNum(hit, 'stat')}` };
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
      // (her live aura or office: the girl page's BUFF cell, girlView.buffOf)
      const buff = buffOf({ aura: st.aura, hub: st.hub, drink: def.base?.drink });
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
    const n = Math.max(1, st.pierce || 1);
    const gear = gearPierce(t, st);
    const title = `Pierces ${n} ${n === 1 ? 'enemy' : 'enemies'}${gear > 0 ? `, +${gear}% chance of one more` : ''}`;
    cells.push({ key: 'pierce', label: 'PIERCE', value: fmtNum(n, 'count'), unit: null, title });
  }
  return cells.map((c, i) => ({ ...c, accent: i === 0 }));
}

/**
 * Her target row. A targeting girl: FIRST · LAST · STRONG · CLOSE, then PRIORITY (and AIR when she hits flyers)
 * behind the "⋯" chip; an extra mode in use shows filled in its place. Azami: Near exit · Spread (· Checkpoint from
 * Checkpoint tier 3) instead. Null when she picks no target.
 * @param {{ expanded?: boolean, aiming?: boolean, aimMode?: string|null }} [o]
 * @returns {null | { kind: 'target'|'strip', label: string, chips: { mode: string, label: string, on: boolean, title: string, testid?: string }[], more: number, moreNames: string[] }}
 *   more / moreNames: how many modes, and which ("Priority", "Air"), wait behind the overflow chip
 */
export function targetView(t, st, { expanded = false, aiming = false, aimMode = null } = {}) {
  if (st.behavior === 'strip') {
    const checkpoint = !!t.aim || aiming;
    const chips = [
      { mode: 'first', label: 'NEAR EXIT', on: !checkpoint && t.targetMode !== 'last', title: 'On the free road spot nearest the exit', testid: 'strip-exit' },
      { mode: 'last', label: 'SPREAD', on: !checkpoint && t.targetMode === 'last', title: 'Spread along the road', testid: 'strip-spread' },
    ];
    if (aimMode === 'checkpoint') chips.push({ mode: 'checkpoint', label: aiming ? 'TAP MAP…' : 'CHECKPOINT', on: checkpoint, title: 'Tap the road: her strips land around that point', testid: 'aim-set' });
    return { kind: 'strip', label: 'STRIPS', chips, more: 0, moreNames: [] };
  }
  if (!TARGETABLE.has(st.behavior)) return null;
  const extras = TARGET_EXTRA.filter((m) => m !== 'air' || st.canHitAir);
  const chip = (mode) => ({ mode, label: label(mode), on: t.targetMode === mode, title: MODE_HELP[mode] || '' });
  const chips = TARGET_CHIPS.map(chip);
  if (expanded) return { kind: 'target', label: 'TARGET', chips: [...chips, ...extras.map(chip)], more: 0, moreNames: [] };
  const inUse = extras.filter((m) => m === t.targetMode);
  const hidden = extras.filter((m) => m !== t.targetMode);
  return { kind: 'target', label: 'TARGET', chips: [...chips, ...inUse.map(chip)], more: hidden.length, moreNames: hidden.map((m) => TARGET_MODES[m] || m) };
}

/**
 * The aim row of a mortar / mirror girl (an aimed hero ult too): Auto · Set aim. Null for others and Azami. Iroha's
 * mirror network (docs/specs/IROHA_MIRRORS.md §8): AUTO · PLACE (each tap places the next mirror) and one numbered chip
 * per mirror (a tap re-places that one; `placed` when her player set it), with the count ("3/3 · 2 placed").
 * `slot`: the mirror being placed now (-1: none).
 */
export function aimView(t, mode, { aiming = false, slot = -1 } = {}) {
  if (!mode || mode === 'checkpoint') return null;
  if (mode === 'mirror' && t.mirrors) {
    const n = t.mirrors.length;
    const placed = t.mirrors.map((_, k) => !!t.mirrorAim?.[k]);
    const count = placed.filter(Boolean).length;
    return {
      label: 'MIRRORS',
      count: `${n} · ${count ? `${count} placed` : 'auto'}`,
      chips: [
        { mode: 'auto', label: 'AUTO', on: !count && !aiming, title: 'She spreads her mirrors along the road herself', testid: 'aim-auto' },
        { mode: 'set', label: aiming && slot >= 0 ? 'TAP MAP…' : 'PLACE', on: aiming, title: 'Tap the map once for each mirror, in order', testid: 'aim-set' },
      ],
      slots: placed.map((p, k) => ({
        k, label: String(k + 1), on: aiming && slot === k, placed: p, testid: `mirror-chip-${k}`,
        title: `Mirror ${k + 1}${p ? ' (placed)' : ' (auto)'}: tap, then tap the map`,
      })),
    };
  }
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
    if (wide && desc) {
      // 1280: the tier's full sentence in place of the chips (UI_DIRECTION §6.6; one line holds its numbers)
      view.desc = desc;
    } else {
      // tap 1: the next tier's effects as up to 3 chips; the row's numbers stay ≤ SECTION_NUMBERS (tier, price, chips)
      let numbers = 2;
      for (const c of effectParts(mods || us.next.mods || {}, 3)) {
        const has = /\d/.test(c);
        if (has && numbers >= SECTION_NUMBERS) continue;
        if (has) numbers++;
        view.chips.push(c);
      }
    }
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
 * @param {{ xp?: object|null, level?: object|null, ult?: object|null, ultRank?: number, max?: number, own?: boolean }} o
 *   xp: towerStats().xp; level: sim.heroLevelStatus() (own hero); ult: sim.heroUltStatus() (own hero);
 *   ultRank: towerStats().ultRank (the sim's, hero.js ultRank)
 */
export function heroDrawerView(t, { xp = null, level = null, ult = null, ultRank = 1, max = 25, own = true } = {}) {
  const def = t.def;
  const atMax = (t.level || 1) >= max;
  const frac = !xp || xp.next == null ? 1 : Math.max(0, Math.min(1, (xp.xp - xp.current) / Math.max(1, xp.next - xp.current)));
  const u = def.hero?.ult || null;
  const unlockAt = u?.unlockLevel ?? 3;
  const unlocked = ult ? !!ult.unlocked : (t.level || 1) >= unlockAt;
  const rank = ultRank || 1;
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
 * `compact` (a phone's one-line open row): "⚡ Drone Surge · later update".
 */
export function shortTeaser(teaser, { compact = false } = {}) {
  let rest = String(teaser || '').replace(/^⚡\+?\s*T\d+\s[^—]*—\s*/, '');
  if (compact) rest = rest.replace(/ comes in a later update$/, ' · later update');
  return `⚡ ${rest.charAt(0).toUpperCase()}${rest.slice(1)}`;
}

/**
 * The ally note on a co-op partner's girl (UI_DIRECTION §5.5: a lock and one line with the reason). On a phone it is one
 * short line that names her owner once ("Bea's girl · view only", the tree's ally chip), so a 16-character name still
 * fits beside the lock and her three path rows stay in view under it (the M4 re-review); the full sentence is its title.
 * @param {string} owner her owner's name
 * @param {{ wide?: boolean, hero?: boolean }} [o] wide: 1280 (the full sentence in the note); hero: an ally's hero
 * @returns {{ text: string, title: string }}
 */
export function allyNoteText(owner, { wide = true, hero = false } = {}) {
  const title = hero ? `${owner}'s hero — only ${owner} can level her up, retarget or move her.` : `${owner}'s girl — only ${owner} can upgrade, retarget or sell her.`;
  return { text: wide ? title : `${owner}'s ${hero ? 'hero' : 'girl'} · view only`, title };
}

/**
 * A final tier another copy holds: her holder line ("Held by Aoi 5-0-0 · top right", rules.finalHolderLine) as the girl
 * and her place on the map. A phone shows the line beside the lock on ONE line: when "· bottom right" would wrap it, the
 * place steps away, whole (Show › still selects her and pulses her on the map; the button's title keeps the place).
 * @param {string} line
 * @returns {{ who: string, where: string }} where: "" when the line names no place
 */
export function holderParts(line) {
  const s = String(line || '');
  const at = s.lastIndexOf(' · ');
  return at > 0 ? { who: s.slice(0, at), where: s.slice(at) } : { who: s, where: '' };
}

/**
 * A row cut by at most this much (its hairline) counts as in view: the scroll cue's fade over it would only dim it.
 * e2e/lib/uiProbe.mjs drawerPathsInView uses the same rule.
 */
export const SCROLL_CUE_PX = 2;

/**
 * How far the drawer body's content reaches below what is in view, in px (0 or less: all of it shows). It measures the
 * body's children against the bottom of its scroll port, never scrollHeight: the invisible ::after hit areas that poke
 * out under the last row's "i" or price count in scrollHeight but are not content (the M4 re-review: the cue's fade and
 * ▾ covered a third row that was fully in view).
 * @param {number} portBottom the scroll port's bottom edge (its rect's top + clientTop + clientHeight)
 * @param {number[]} childBottoms the body's children's getBoundingClientRect().bottom (a hidden child reads 0)
 */
export function contentBelow(portBottom, childBottoms) {
  let low = -Infinity;
  for (const b of childBottoms || []) if (Number.isFinite(b) && b > low) low = b;
  return low === -Infinity ? 0 : low - portBottom;
}

/**
 * Phones: the room the drawer has to spare under its last path row, shared out to its chip rows (target, strips, aim,
 * pick, Flight) as air above and below their chips, so each row's band (which holds its chips' hit areas, clipped to it)
 * grows towards the dense tap size (the M4 review, round r2: the chips' hit areas reached over the stat row's labels).
 * Equal air for every row that has not reached the tap size, in whole pixels; never more than the room there is.
 * @param {number} spare px between the body's last content and the fold (0 or less: none)
 * @param {number[]} heights each chip row's height with no air
 * @param {number} tap the dense tap size (px)
 * @returns {number[]} each row's air, per side (px)
 */
export function rowAir(spare, heights, tap) {
  const hs = heights || [];
  const out = hs.map(() => 0);
  const caps = hs.map((h) => Math.max(0, Math.floor((tap - h) / 2)));
  let left = Number.isFinite(spare) ? Math.floor(spare) : 0;
  for (;;) {
    const open = out.map((_, i) => i).filter((i) => out[i] < caps[i]);
    const step = open.length ? Math.floor(left / (2 * open.length)) : 0;
    if (step < 1) break;
    for (const i of open) {
      const add = Math.min(step, caps[i] - out[i]);
      out[i] += add;
      left -= 2 * add;
    }
  }
  return out;
}
