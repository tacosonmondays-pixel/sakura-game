// Who an upgrade helps (owner request #152): every upgrade tier is sorted into Self / Allies /
// Enemies / Coins by the keys of its mods, so the UI can say clearly whether a tier makes HER
// stronger, buffs the girls in her aura, weakens enemies, or pays coins.
//
// Pure (no DOM). Derived from the data at runtime: nothing in src/data changes, so the co-op
// sim id stays the same. A new mod key (a future roster mechanic) must be added to MOD_TAGS,
// SHORT_ORDER and ICON_RULES here; tests/ui/upgradeTags.test.js fails until it is. Path cap:
// Midori's brews and Chika's tune-up links are Allies (a few picked girls, `limited`), an
// execution shot (hpPct) is Self, aura armor pen / crit are Allies.
import { ATTACK_TYPES, ELEMENTS, STATUSES } from '../data/types.js';

/** @typedef {'self'|'allies'|'enemies'|'coins'} TagId */
/**
 * @typedef {{ id: TagId, keys: string[], radius?: number, global?: boolean, globalFor?: number,
 *   team?: boolean, transform?: boolean, discount?: number, summon?: 'drones'|'traps' }} Tag
 */

/** Tag order everywhere (chips, legend, summaries). */
export const TAG_ORDER = ['self', 'allies', 'enemies', 'coins'];

/** Chip vocabulary: word, long text, colours (text / fill / border, ≥ 4.5:1 contrast). */
export const UPGRADE_TAGS = {
  self: { id: 'self', label: 'Self', letter: 'S', long: 'Makes her own attacks stronger.', fg: '#1864ab', bg: '#e7f5ff', border: '#74c0fc' },
  allies: {
    id: 'allies', label: 'Allies', letter: 'A',
    long: 'Buffs the other girls standing inside her aura circle. Never herself. Auras of the same kind don\'t stack: each girl gets the strongest one.',
    fg: '#2b8a3e', bg: '#ebfbee', border: '#8ce99a',
  },
  enemies: { id: 'enemies', label: 'Enemies', letter: 'E', long: 'Slows, stops or weakens the enemies she hits.', fg: '#c92a2a', bg: '#fff5f5', border: '#ffa8a8' },
  coins: { id: 'coins', label: 'Coins', letter: '$', long: 'Earns coins for your wallet at the end of each wave (split between both players in co-op).', fg: '#8a4b00', bg: '#fff9db', border: '#fcc419' },
};

/** The violet "New attack" flag that rides on a Self tag. */
export const TRANSFORM_TAG = { id: 'transform', label: 'New attack', letter: '✦', long: 'Changes how she attacks (attack style, damage type or element).', fg: '#5f3dc4', bg: '#f3f0ff', border: '#b197fc' };

/**
 * Mod key → rule. 'self' | 'transform' (self + New attack) | 'drones' (self, her sentries) |
 * 'traps' (self for trap stats, enemies for trap statuses) | 'allies' (aura) | 'enemies' |
 * 'team' (enemy debuff that helps every girl) | 'status' (enemies; team for Brittle / shred /
 * mark / reveal) | 'coins'. Exported so a roster merge can extend it in one place.
 */
export const MOD_TAGS = {
  damage: 'self', damageMul: 'self', rateMul: 'self', range: 'self', projectiles: 'self', pierce: 'self', chain: 'self',
  maxTargets: 'self', splash: 'self', armorPen: 'self', projectileSpeed: 'self', canHitAir: 'self', detection: 'self',
  crit: 'self', eliteMul: 'self', bossMul: 'self', barrierMul: 'self', ramp: 'self', hpPct: 'self',
  behavior: 'transform', attackType: 'transform', element: 'transform',
  // Tenka: her lab team is her own power; a gravity well and Last Line act on the enemies
  lab: 'self', well: 'enemies', lastLine: 'enemies',
  turret: 'drones',
  trap: 'traps',
  aura: 'allies',
  // limited buffs (path cap): Midori's brews and Chika's tune-up links make a few picked girls stronger
  brew: 'limited', link: 'limited',
  status: 'status',
  silence: 'enemies', knockback: 'enemies',
  mark: 'team', reveal: 'team',
  income: 'coins',
  // roster B3: the flyer bonus and a familiar / mirror's reach are hers; a gather pulls enemies
  airMul: 'self', relay: 'self', gather: 'enemies',
  // the new girls (UNIT_GAPS §5): Azami's spike strips are her traps; Kinu's ring is her attack
  strip: 'traps', ring: 'self',
  // Wakaba's drink makes the girls she picks stronger
  drink: 'limited',
  // Ouka's office rules cover the girls around her
  hub: 'allies',
  // Chigusa's vine holds enemies; her thorn beds are her traps
  vine: 'enemies',
  // Marumi's balls are her attack
  ball: 'self',
  // Yuzuha's lane sentries are her summons
  sentry: 'drones',
  // Kaede's blade arts (cleave, crescents, storm, shockwave, maple leaves) are her attack
  blade: 'self',
  // the duo: Kohaku's beam and the prism's shards are her attack (DUO_LR §1)
  duo: 'self',
  // the staff heroes (BANNERS §D): Kogane's faster Move is hers; Norika's barricades hold the enemies
  moveCd: 'self', barricade: 'enemies',
};

/** Sub-keys understood inside the object-valued mods (anything else trips the test). */
const SUB_KEYS = {
  aura: new Set(['range', 'dmgMul', 'rateMul', 'rangeMul', 'detection', 'costCut', 'cleanse', 'armorPen', 'critChance']),
  lab: new Set(['rounds', 'power']),
  well: new Set(['every', 'time', 'radius', 'pull', 'slow', 'vuln']),
  lastLine: new Set(['radius', 'max', 'time', 'cooldown']),
  brew: new Set(['targets', 'dmgMul', 'rateMul', 'armorPen', 'critChance']),
  link: new Set(['targets', 'dmgMul', 'rateMul', 'armorPen', 'critChance', 'overclock']),
  // execution shot (path cap): % of the target's current HP, bosses, cap in shots
  hpPct: new Set(['pct', 'boss', 'cap']),
  trap: new Set(['max', 'damage', 'splash', 'status', 'triggerRadius', 'armTime']),
  // (leash / speed / build: roaming drones, the Chika rework — how far and fast they fly, build time)
  turret: new Set(['max', 'damage', 'rate', 'range', 'attackType', 'status', 'leash', 'speed', 'build']),
  income: new Set(['perWave', 'interest']),
  crit: new Set(['chance', 'mul']),
  ramp: new Set(['per', 'max']),
  mark: new Set(['bonus', 'duration']),
  relay: new Set(['reach']),
  sentry: new Set(['max', 'every', 'speed', 'ttl', 'damage', 'rate', 'range', 'burst', 'kits', 'nets', 'netBudget', 'netElite', 'netBoss']),
  ball: new Set(['travel', 'speed', 'through', 'share', 'lobMul', 'pins', 'pinDmg', 'pinPierce', 'hook', 'lob', 'pushBig', 'bounce', 'reach', 'finish']),
  vine: new Set(['every', 'hold', 'dps', 'beds', 'bedDmg', 'bedTtl', 'bloom', 'bloomPer', 'bloomIdle', 'lives', 'livesCap']),
  hub: new Set(['radius', 'costCut', 'sellMul', 'freeTiers', 'killBounty', 'cdCut', 'rateMul', 'rangeMul', 'dmgMul', 'detection', 'airGrant', 'cleanse', 'typeFloor', 'banners', 'bannerRange', 'bannerReach', 'radiusAdd', 'cutAdd']),
  drink: new Set(['splash', 'shots', 'dmg', 'rate', 'range', 'pierce', 'detection', 'cleanse', 'permanent', 'season', 'towel', 'towelDmg', 'life']),
  ring: new Set(['travel', 'turn', 'heat', 'double', 'sparks', 'scissors', 'scissorDmg', 'scissorMul', 'spiral', 'spiralPierce']),
  strip: new Set(['hits', 'ttl', 'forever', 'carry', 'boom', 'boomR', 'boomStun', 'air', 'aim', 'opening', 'lanes', 'pair', 'rain', 'rainCount']),
  duo: new Set(['beamDmg', 'beamRate', 'beamRange', 'beamPierce', 'beams', 'beamPen', 'beamAir', 'beamMul', 'rampPer', 'rampMax', 'beamSilence',
    'every', 'shards', 'shardAdd', 'shardShare', 'shardDmg', 'shardSplash', 'shardSlow', 'slowTime', 'shardShred', 'shardVuln', 'vulnTime', 'fullEvery']),
  barricade: new Set(['count', 'budget', 'budgetMul', 'rebuild', 'rebuildCut', 'held', 'reveal', 'bounce', 'breakSlow', 'releaseSlow', 'miniHalf', 'detour', 'oneWay', 'lineAdd']),
  blade: new Set(['every', 'radius', 'share', 'targets', 'crescents', 'cLen', 'cWidth', 'cShare', 'cTargets', 'storm', 'sShare', 'sTargets', 'wave', 'wWidth', 'wShare', 'wTargets', 'maple', 'mShare', 'mTargets', 'shareMul']),
};

/** Status types that make enemies easier for EVERY girl to hit or hurt. */
const TEAM_STATUS = new Set(['vulnerable', 'shred', 'mark', 'reveal']);
/** Strongest-first order for the tier icon of a status tier. */
const STATUS_STRENGTH = ['stun', 'freeze', 'curse', 'hex', 'ground', 'vulnerable', 'shred', 'mark', 'slow', 'silence', 'reveal', 'burn', 'poison', 'shock', 'soak'];

/**
 * Tier notes where a tier's authored text and the battle disagree (keyed unit.path.tier, 0-based).
 * (Chika's Tesla Tower had one until her rework: its text now says her drones keep flying.)
 */
export const TIER_NOTES = {};

const present = (v) => v != null && v !== false && !(typeof v === 'number' && v === 0) && !(Array.isArray(v) && v.length === 0);
const round1 = (v) => String(Math.round(v * 10) / 10);
const pct = (mul) => `${Math.round((mul - 1) * 100)}%`;

/** "2.6 tiles" / "4 tiles". */
export function tilesText(r, { unit = true } = {}) {
  return `${round1(r)}${unit ? (Math.abs(r - 1) < 1e-9 ? ' tile' : ' tiles') : ''}`;
}

/**
 * Keys in a ModSet that this module does not know (the merge tripwire). Object-valued mods
 * report unknown sub-keys as "key.sub", status lists unknown types as "status:type".
 * @param {object} mods
 * @returns {string[]}
 */
export function unknownModKeys(mods = {}) {
  const out = [];
  for (const [k, v] of Object.entries(mods || {})) {
    if (!(k in MOD_TAGS)) {
      out.push(k);
      continue;
    }
    if (SUB_KEYS[k] && v && typeof v === 'object' && !Array.isArray(v)) {
      for (const s of Object.keys(v)) if (!SUB_KEYS[k].has(s)) out.push(`${k}.${s}`);
    }
    const lists = k === 'status' ? v : k === 'trap' ? v?.status : null;
    for (const s of Array.isArray(lists) ? lists : []) if (!STATUSES[s?.type]) out.push(`status:${s?.type}`);
  }
  return out;
}

/**
 * Tags for one ModSet (a tier, an awakening passive or a hero level), in TAG_ORDER.
 * @param {object} mods
 * @param {{ radius?: number, reach?: number }} [opts] aura radius to report on an Allies tag; her
 *   attack range (a brew reaches the girls in her range, a tune-up link those in her aura)
 * @returns {Tag[]}
 */
export function modsTags(mods = {}, { radius = 0, reach = 0 } = {}) {
  const by = {};
  const tag = (id) => (by[id] ||= { id, keys: [] });
  for (const [k, v] of Object.entries(mods || {})) {
    if (!present(v)) continue;
    const rule = MOD_TAGS[k] || 'self'; // unknown key: harmless fallback (the test fails on it)
    switch (rule) {
      case 'self': tag('self').keys.push(k); break;
      case 'transform': { const t = tag('self'); t.keys.push(k); t.transform = true; break; }
      case 'drones': { const t = tag('self'); t.keys.push(k); t.summon = 'drones'; break; }
      case 'traps': {
        const stats = Object.keys(v || {}).filter((s) => s !== 'status' && present(v[s]));
        if (stats.length) {
          const t = tag('self');
          t.keys.push(k);
          t.summon = 'traps';
        }
        if (present(v?.status)) {
          const t = tag('enemies');
          t.keys.push(`${k}.status`);
          if (v.status.some((s) => TEAM_STATUS.has(s.type))) t.team = true;
        }
        break;
      }
      case 'allies': {
        const t = tag('allies');
        t.keys.push(k);
        if (radius > 0) t.radius = radius;
        else if (v?.range) t.radius = v.range;
        if (v?.costCut) t.discount = (t.discount || 0) + v.costCut;
        break;
      }
      case 'limited': {
        // a brew (her range) or a tune-up link (her aura): a few picked girls, not everyone in reach
        const t = tag('allies');
        t.keys.push(k);
        t.limited = true;
        const r = k === 'link' ? radius || reach : reach || radius;
        if (r > 0) t.radius = Math.max(t.radius || 0, r);
        break;
      }
      case 'status': {
        const t = tag('enemies');
        t.keys.push(k);
        if (v.some((s) => TEAM_STATUS.has(s.type))) t.team = true;
        break;
      }
      case 'enemies': tag('enemies').keys.push(k); break;
      case 'team': { const t = tag('enemies'); t.keys.push(k); t.team = true; break; }
      case 'coins': tag('coins').keys.push(k); break;
      default: tag('self').keys.push(k);
    }
  }
  return TAG_ORDER.filter((id) => by[id]).map((id) => by[id]);
}

/**
 * Her aura radius once she owns `tier` tiers of `path`: the largest of her base aura, every aura
 * range in that path up to the tier, and (in battle) her live aura. Auras only ever grow.
 * @param {object} unit UnitDef
 * @param {number} path 0..2
 * @param {number} tier 1..5 (tiers owned in that path, this one included)
 * @param {{ current?: number }} [opts]
 */
export function auraRadius(unit, path, tier, { current = 0 } = {}) {
  // (Ouka's office radius counts as her aura: her rules cover the girls inside it)
  let r = Math.max(unit?.base?.aura?.range ?? 0, unit?.base?.hub?.radius ?? 0, current || 0);
  const tiers = unit?.paths?.[path]?.tiers || [];
  for (let k = 0; k < Math.min(tier, tiers.length); k++) r = Math.max(r, tiers[k]?.mods?.aura?.range ?? 0, tiers[k]?.mods?.hub?.radius ?? 0);
  return r;
}

/**
 * Her attack range once she owns `tier` tiers of `path` (base + that path's flat range), the reach
 * of a brew.
 */
export function rangeAt(unit, path, tier) {
  let r = unit?.base?.range ?? 0;
  const tiers = unit?.paths?.[path]?.tiers || [];
  for (let k = 0; k < Math.min(tier, tiers.length); k++) r += tiers[k]?.mods?.range ?? 0;
  return r;
}

/**
 * Tags of one tier (1-based), with the aura radius she would have once it is bought.
 * @returns {Tag[]}
 */
export function tierTags(unit, path, tier, { current = 0 } = {}) {
  const def = unit?.paths?.[path]?.tiers?.[tier - 1];
  if (!def) return [];
  return modsTags(def.mods, { radius: auraRadius(unit, path, tier, { current }), reach: rangeAt(unit, path, tier) });
}

/** Tags of her awakening passive (her base aura radius for an aura passive). */
export function passiveTags(unit) {
  const mods = unit?.awakenPassive?.mods || {};
  return modsTags(mods, { radius: Math.max(unit?.base?.aura?.range ?? 0, mods.aura?.range ?? 0) });
}

/**
 * Tags of a hero ultimate (reads ult.effect): damage / status / slow / push → Enemies, reveal →
 * Enemies (helps all), any …Buff key → Allies (whole team, herself included).
 * @param {object} ult
 * @returns {Tag[]}
 */
export function ultTags(ult) {
  const e = ult?.effect || {};
  const by = {};
  const tag = (id) => (by[id] ||= { id, keys: [] });
  for (const [k, v] of Object.entries(e)) {
    if (!present(v)) continue;
    // (budget / held: Hold the Line's barricades and the extra damage held enemies take; push: Kogane's plow)
    if (k === 'damage' || k === 'slow' || k === 'pushback' || k === 'status' || k === 'budget' || k === 'held' || k === 'push') {
      const t = tag('enemies');
      t.keys.push(k);
      if (k === 'status' && Array.isArray(v) && v.some((s) => TEAM_STATUS.has(s.type))) t.team = true;
    } else if (k === 'reveal' || k === 'mark') {
      const t = tag('enemies');
      t.keys.push(k);
      t.team = true;
    } else if (/Buff$/.test(k)) {
      const t = tag('allies');
      t.keys.push(k);
      t.global = true;
      if (e.buffDuration) t.globalFor = e.buffDuration;
    }
  }
  return TAG_ORDER.filter((id) => by[id]).map((id) => by[id]);
}

// ---------------------------------------------------------------------------
// One-line effect + tier icon
// ---------------------------------------------------------------------------

const BEHAVIOR_SHORT = { projectile: 'Projectiles', pulse: 'Area pulse', duel: 'Duel', beam: 'Beam', chain: 'Chain', trap: 'Traps', turret: 'Sentries', mortar: 'Aimed shells', none: 'Support' };

/** Short status phrase: "Slow 30%", "Freeze 1s", "Brittle +20%"… (chance as a suffix). */
export function statusShort(s) {
  if (!s) return '';
  let core;
  switch (s.type) {
    case 'slow': core = `Slow ${Math.round((s.amount || 0) * 100)}%`; break;
    case 'freeze': core = `Freeze ${round1(s.duration || 0)}s`; break;
    case 'stun': core = `Stun ${round1(s.duration || 0)}s`; break;
    case 'burn': core = `Burn ${round1(s.dps || 0)}/s`; break;
    case 'poison': core = `Poison ${round1(s.dps || 0)}/s`; break;
    case 'shock': core = 'Shock'; break;
    case 'soak': core = 'Soak'; break;
    case 'vulnerable': core = `Brittle +${Math.round((s.bonus || 0) * 100)}%`; break;
    case 'shred': core = `Shred −${round1(s.amount || 0)} armor`; break;
    case 'mark': core = `Mark +${Math.round((s.bonus || 0) * 100)}%`; break;
    case 'silence': core = `Silence ${round1(s.duration || 0)}s`; break;
    case 'reveal': core = `Reveal ${round1(s.duration || 0)}s`; break;
    case 'ground': core = `Ground ${round1(s.duration || 0)}s`; break;
    case 'curse': core = `Curse ${Math.round((s.burstMul || 0) * 100)}%`; break;
    case 'hex': core = `Hex ${round1((s.pct || 0) * 100)}%/s`; break;
    default: core = STATUSES[s.type]?.name || s.type;
  }
  return s.chance != null && s.chance < 1 ? `${core} (${Math.round(s.chance * 100)}%)` : core;
}

const strongest = (list) => [...list].sort((a, b) => STATUS_STRENGTH.indexOf(a.type) - STATUS_STRENGTH.indexOf(b.type))[0];

function auraShort(a) {
  if (a.dmgMul) return `Allies +${pct(a.dmgMul)} dmg`;
  if (a.rateMul) return `Allies +${pct(a.rateMul)} speed`;
  if (a.armorPen) return `Allies ignore ${round1(a.armorPen)} armor`;
  if (a.critChance) return `Allies +${Math.round(a.critChance * 100)}% crit`;
  if (a.rangeMul) return `Allies +${pct(a.rangeMul)} range`;
  if (a.detection) return 'Allies Veil Sight';
  if (a.costCut) return `Allies −${Math.round(a.costCut * 100)}% cost`;
  if (a.cleanse) return 'Allies cleanse';
  return a.range ? `Aura ${tilesText(a.range)}` : 'Aura';
}

/** "Brews 2 girls" / "Brew +15% dmg" / "Tune-up 1 girl" (a limited buff tier). */
function limitedShort(l, word) {
  if (l.targets) return `${word === 'Brew' ? 'Brews' : 'Tune-up'} ${l.targets} ${l.targets === 1 ? 'girl' : 'girls'}`;
  if (l.dmgMul && l.dmgMul !== 1) return `${word} +${pct(l.dmgMul)} dmg`;
  if (l.rateMul && l.rateMul !== 1) return `${word} +${pct(l.rateMul)} speed`;
  if (l.armorPen) return `${word} pen +${round1(l.armorPen)}`;
  if (l.overclock) return 'Overclock';
  return word;
}

function trapShort(t) {
  if (present(t.status)) return `Traps: ${statusShort(strongest(t.status))}`;
  if (t.damage) return `Traps +${round1(t.damage)} dmg`;
  if (t.max) return `+${t.max} ${t.max === 1 ? 'trap' : 'traps'}`;
  if (t.splash) return 'Bigger traps';
  return 'Traps';
}

function turretShort(t) {
  if (t.max) return `+${t.max} ${t.max === 1 ? 'drone' : 'drones'}`;
  if (t.damage) return `Drones +${round1(t.damage)} dmg`;
  if (t.rate && t.rate !== 1) return `Drones +${pct(t.rate)} speed`;
  if (t.range) return `Drones +${round1(t.range)} range`;
  return 'Drones';
}

/**
 * Priority order of the one-line effect (and the tier icon): what changes her job first, then
 * team effects, control, utility, then plain numbers. Each entry: [key, phrase(mods)].
 */
const SHORT_ORDER = [
  ['behavior', (m) => `Becomes ${BEHAVIOR_SHORT[m.behavior] || m.behavior}`],
  ['attackType', (m) => `${ATTACK_TYPES[m.attackType]?.name || m.attackType} attacks`],
  ['element', (m) => `${ELEMENTS[m.element]?.name || m.element} element`],
  ['lab', (m) => (m.lab.rounds ? (m.lab.rounds > 1 ? 'Lab team joins again' : 'Lab team joins') : `Lab weapons ×${round1(m.lab.power || 1)}`)],
  ['well', (m) => (m.well.every ? `Gravity well every ${round1(m.well.every)}s` : `Wells ${round1(m.well.time || 0)}s${m.well.vuln ? `, +${Math.round(m.well.vuln * 100)}% dmg taken` : ''}`)],
  ['lastLine', (m) => `Last Line: up to ${m.lastLine.max} enemies`],
  ['aura', (m) => auraShort(m.aura)],
  ['brew', (m) => limitedShort(m.brew, 'Brew')],
  ['link', (m) => limitedShort(m.link, 'Tune-up')],
  ['turret', (m) => turretShort(m.turret)],
  ['trap', (m) => trapShort(m.trap)],
  ['status', (m) => statusShort(strongest(m.status))],
  ['mark', (m) => `Mark +${Math.round((m.mark.bonus || 0) * 100)}%`],
  ['reveal', (m) => `Reveal ${round1(m.reveal)}s`],
  ['silence', (m) => `Silence ${round1(m.silence)}s`],
  ['knockback', (m) => `Push back ${round1(m.knockback)}`],
  ['gather', () => 'Pulls the wave together'],
  ['airMul', (m) => `×${round1(m.airMul)} vs flyers`],
  ['relay', (m) => `Reach +${round1(m.relay.reach || 0)}`],
  ['income', (m) => (m.income.perWave ? `+${m.income.perWave} coins/wave` : `+${Math.round((m.income.interest || 0) * 100)}% interest`)],
  ['canHitAir', () => 'Hits flyers'],
  ['detection', () => 'Veil Sight'],
  ['damage', (m) => `+${round1(m.damage)} dmg`],
  ['damageMul', (m) => `+${pct(m.damageMul)} dmg`],
  ['crit', (m) => `${Math.round((m.crit.chance || 0) * 100)}% crits ×${round1(m.crit.mul || 1.5)}`],
  ['splash', (m) => `+${round1(m.splash)} splash`],
  ['chain', (m) => `+${m.chain} ${m.chain === 1 ? 'jump' : 'jumps'}`],
  ['pierce', (m) => `+${m.pierce} pierce`],
  ['projectiles', (m) => `+${m.projectiles} ${m.projectiles === 1 ? 'shot' : 'shots'}`],
  ['maxTargets', (m) => `+${m.maxTargets} ${m.maxTargets === 1 ? 'target' : 'targets'}`],
  ['armorPen', (m) => `Ignores ${round1(m.armorPen)} armor`],
  ['hpPct', (m) => `Takes ${round1((m.hpPct.pct || 0) * 100)}% HP a shot`],
  ['eliteMul', (m) => `+${pct(m.eliteMul)} vs elites`],
  ['bossMul', (m) => `+${pct(m.bossMul)} vs bosses`],
  ['barrierMul', (m) => `+${pct(m.barrierMul)} vs barriers`],
  ['ramp', (m) => `Ramp +${Math.round((m.ramp.per || 0) * 100)}%/hit`],
  ['rateMul', (m) => (m.rateMul >= 2 ? `×${round1(m.rateMul)} speed` : `+${pct(m.rateMul)} speed`)],
  ['range', (m) => `+${round1(m.range)} range`],
  ['projectileSpeed', () => 'Faster shots'],
];
export const SHORT_KEYS = SHORT_ORDER.map(([k]) => k);
/**
 * Icon priority: like the one-line order, but plain damage comes last so a row of tiers gets
 * varied icons (a sword only when damage is all the tier does).
 */
const ICON_ORDER = [
  'behavior', 'attackType', 'element', 'aura', 'brew', 'link', 'turret', 'trap', 'status', 'mark', 'reveal', 'silence', 'knockback', 'gather', 'income',
  'airMul', 'relay',
  'canHitAir', 'detection', 'crit', 'splash', 'chain', 'pierce', 'projectiles', 'maxTargets', 'armorPen', 'hpPct', 'eliteMul', 'bossMul',
  'barrierMul', 'ramp', 'rateMul', 'range', 'projectileSpeed', 'damageMul', 'damage',
  'lab', 'well', 'lastLine', // Tenka (a tier with only these keys shows their icon)
];
const SHORT_MAX = 34;

/**
 * One-line effect for a tier cell: the two most important changes ("Allies +10% dmg · Silence
 * 0.6s"), or just the first when both don't fit in 34 characters. Never empty.
 * @param {object} mods
 * @returns {string}
 */
export function shortEffect(mods = {}) {
  const parts = [];
  for (const [k, fn] of SHORT_ORDER) {
    if (!present(mods?.[k])) continue;
    if (k === 'damageMul' && mods.damageMul === 1) continue;
    parts.push(fn(mods));
    if (parts.length === 2) break;
  }
  if (!parts.length) {
    const other = Object.keys(mods || {}).find((k) => present(mods[k]));
    return other ? other : 'No change';
  }
  const two = parts.join(' · ');
  if (two.length <= SHORT_MAX) return two;
  return parts[0].length <= SHORT_MAX ? parts[0] : `${parts[0].slice(0, SHORT_MAX - 1)}…`;
}

/**
 * A tier's effects as short chip phrases, most important first ("+5 dmg", "+25% dmg", "+4 pierce"): the
 * same words as shortEffect(), whole (never cut), at most `max` of them (the tier panel shows 3, §6.1).
 * @param {object} mods
 * @param {number} [max]
 * @returns {string[]}
 */
export function effectParts(mods = {}, max = 3) {
  const parts = [];
  for (const [k, fn] of SHORT_ORDER) {
    if (parts.length >= max) break;
    if (!present(mods?.[k])) continue;
    if ((k === 'damageMul' || k === 'rateMul') && mods[k] === 1) continue;
    parts.push(fn(mods));
  }
  return parts;
}

/** Icon rule per primary key → { set, key } for the view (ui / cap / status / attack / element). */
const ICON_RULES = {
  element: (m) => ({ set: 'element', key: m.element }),
  attackType: (m) => ({ set: 'attack', key: m.attackType }),
  behavior: () => ({ set: 'ui', key: 'sparkle' }),
  lab: () => ({ set: 'cap', key: 'buff' }),
  well: () => ({ set: 'status', key: 'slow' }),
  lastLine: () => ({ set: 'cap', key: 'trap' }),
  aura: (m) => {
    const keys = Object.keys(m.aura || {}).filter((k) => k !== 'range' && present(m.aura[k]));
    if (keys.length === 1 && keys[0] === 'cleanse') return { set: 'cap', key: 'cleanse' };
    if (keys.length === 1 && keys[0] === 'detection') return { set: 'cap', key: 'detection' };
    return { set: 'cap', key: 'buff' };
  },
  brew: () => ({ set: 'cap', key: 'buff' }),
  link: () => ({ set: 'cap', key: 'buff' }),
  turret: () => ({ set: 'cap', key: 'summon' }),
  trap: () => ({ set: 'cap', key: 'trap' }),
  status: (m) => ({ set: 'status', key: strongest(m.status).type }),
  mark: () => ({ set: 'status', key: 'mark' }),
  reveal: () => ({ set: 'cap', key: 'reveal' }),
  silence: () => ({ set: 'cap', key: 'silence' }),
  knockback: () => ({ set: 'cap', key: 'stun' }),
  gather: () => ({ set: 'cap', key: 'slow' }),
  airMul: () => ({ set: 'cap', key: 'antiAir' }),
  relay: () => ({ set: 'cap', key: 'summon' }),
  income: () => ({ set: 'cap', key: 'income' }),
  canHitAir: () => ({ set: 'cap', key: 'antiAir' }),
  detection: () => ({ set: 'cap', key: 'detection' }),
  crit: () => ({ set: 'ui', key: 'star' }),
  splash: () => ({ set: 'attack', key: 'blast' }),
  chain: () => ({ set: 'element', key: 'lightning' }),
  pierce: () => ({ set: 'attack', key: 'pierce' }),
  projectiles: () => ({ set: 'ui', key: 'plus' }),
  maxTargets: () => ({ set: 'ui', key: 'plus' }),
  armorPen: () => ({ set: 'cap', key: 'armorPen' }),
  hpPct: () => ({ set: 'ui', key: 'trophy' }),
  eliteMul: () => ({ set: 'ui', key: 'trophy' }),
  bossMul: () => ({ set: 'ui', key: 'trophy' }),
  barrierMul: () => ({ set: 'cap', key: 'barrierBreak' }),
  ramp: () => ({ set: 'ui', key: 'upgrade' }),
  rateMul: () => ({ set: 'ui', key: 'ff' }),
  range: () => ({ set: 'ui', key: 'target' }),
  projectileSpeed: () => ({ set: 'ui', key: 'ff2' }),
  damageMul: () => ({ set: 'ui', key: 'sword' }),
  damage: () => ({ set: 'ui', key: 'sword' }),
};
export const ICON_KEYS = Object.keys(ICON_RULES);

/**
 * Round tier icon for the tree: the first key of the tier in ICON_ORDER.
 * @param {object} mods
 * @returns {{ set: 'ui'|'cap'|'status'|'attack'|'element', key: string }}
 */
export function tierIcon(mods = {}) {
  for (const k of ICON_ORDER) {
    if (present(mods?.[k]) && ICON_RULES[k]) return ICON_RULES[k](mods);
  }
  return { set: 'ui', key: 'upgrade' };
}

/**
 * Per-path tally: [{ id, count, team, radius, transform }] (most frequent first, zero counts
 * dropped). team = Enemies tiers that help all girls; radius = largest aura on the path.
 */
export function pathSummary(unit, path) {
  const acc = {};
  const tiers = unit?.paths?.[path]?.tiers || [];
  tiers.forEach((_, i) => {
    for (const t of tierTags(unit, path, i + 1)) {
      const a = (acc[t.id] ||= { id: t.id, count: 0, team: 0, radius: 0, transform: 0 });
      a.count++;
      if (t.team) a.team++;
      if (t.transform) a.transform++;
      if (t.radius) a.radius = Math.max(a.radius, t.radius);
    }
  });
  return Object.values(acc).sort((a, b) => b.count - a.count || TAG_ORDER.indexOf(a.id) - TAG_ORDER.indexOf(b.id));
}

/**
 * Chip text, or the long sentence for details / legends / titles.
 * @param {Tag} tag
 * @param {{ long?: boolean, compact?: boolean, tight?: boolean }} [opts] compact: "Allies · 2.6" (xs
 *   chips); tight: also plain "Enemies" for a team debuff (narrow tree cells)
 */
export function tagText(tag, { long = false, compact = false, tight = false } = {}) {
  const info = UPGRADE_TAGS[tag?.id] || UPGRADE_TAGS.self;
  if (!long) {
    if (tag.id === 'allies' && tag.global) return tight ? `${info.label} · all` : `${info.label} · whole team`;
    if (tag.id === 'allies' && tag.radius) return `${info.label} · ${tilesText(tag.radius, { unit: !compact && !tight })}`;
    // tight (tree cells): the word only; "helps all" lives in the title, detail and path summary
    if (tag.id === 'enemies' && tag.team && !tight) return `${info.label} · helps all`;
    return info.label;
  }
  switch (tag.id) {
    case 'self':
      if (tag.summon === 'drones') return 'Makes her drones stronger — they fight for her, so this is her own power.';
      if (tag.summon === 'traps') return 'Makes her traps stronger — they are part of her own attack.';
      return info.long;
    case 'allies': {
      if (tag.global) return `Every girl on the field, herself included${tag.globalFor ? `, for ${round1(tag.globalFor)}s` : ''}.`;
      const where = tag.radius ? ` (${tilesText(tag.radius)})` : '';
      // a brew / tune-up (path cap): a few picked girls, strong, on top of the auras
      const auraKeys = (tag.keys || []).filter((k) => k !== 'brew' && k !== 'link');
      if (tag.limited && !auraKeys.length) {
        return `Brews or tunes up a few girls within reach${where}: the strongest by herself, or the one you pick. Never herself. Much stronger than an aura, and it adds on top of auras.`;
      }
      let s = `Buffs the other girls standing inside her aura circle${where}. Never herself. Auras of the same kind don't stack: each girl gets the strongest one.`;
      if (tag.limited) s += ' Her tune-up also links a few picked girls for a much stronger boost.';
      if (tag.discount) {
        const p = `${Math.round(tag.discount * 100)}%`;
        s += ` Girls in her aura pay ${p} less for upgrades, and new girls placed inside it cost ${p} less too. She doesn't discount herself.`;
      }
      return s;
    }
    case 'enemies':
      return tag.team
        ? 'Marked, Brittle, shredded or revealed enemies are easier for EVERY girl to hit and hurt. It is a debuff on enemies, not an aura.'
        : info.long;
    default:
      return info.long;
  }
}

/** Optional note for a tier (0-based path, 1-based tier). */
export function tierNote(unit, path, tier) {
  return TIER_NOTES[`${unit?.id}.${path}.${tier - 1}`] || null;
}

// ---------------------------------------------------------------------------
// Stacking auras: the running total in the tier text
// ---------------------------------------------------------------------------

/**
 * Girls whose aura tiers each multiply the ones before (HANDOFF §10: Umeko's tooltips undersold her, since
 * "+15% damage" on Festival of Plums reads as the total while it is ×1.15 on top of the earlier tiers). Their tier
 * text gets the path's running total. The battle numbers are unchanged; this is text only.
 */
export const STACKED_AURA = new Set(['umeko']);
const AURA_MULS = [['dmgMul', 'damage'], ['rateMul', 'attack speed'], ['rangeMul', 'range']];
const pctUp = (mul) => Math.round((mul - 1) * 100 + 1e-9);

/**
 * Her aura multipliers from one path once she owns `tier` tiers of it (src/sim/mods.js multiplies them), and how
 * many of those tiers carry one.
 * @returns {{ dmgMul: number, rateMul: number, rangeMul: number, tiers: number }}
 */
export function auraTotals(unit, path, tier) {
  const out = { dmgMul: 1, rateMul: 1, rangeMul: 1, tiers: 0 };
  const tiers = unit?.paths?.[path]?.tiers || [];
  for (let k = 0; k < Math.min(tier, tiers.length); k++) {
    const a = tiers[k]?.mods?.aura;
    if (!a) continue;
    let any = false;
    for (const [key] of AURA_MULS) {
      if (typeof a[key] === 'number' && a[key] !== 1) {
        out[key] *= a[key];
        any = true;
      }
    }
    if (any) out.tiers++;
  }
  return out;
}

/**
 * "Her tiers multiply: +27% damage, +27% attack speed in all." for a tier that adds aura multipliers on top of an
 * earlier tier's (STACKED_AURA girls only); null otherwise. It never says "stack": the battle card's rule line right
 * below it says auras of the same kind from different girls don't stack.
 */
export function stackedAuraLine(unit, path, tier) {
  if (!STACKED_AURA.has(unit?.id)) return null;
  const own = unit?.paths?.[path]?.tiers?.[tier - 1]?.mods?.aura;
  if (!own || !AURA_MULS.some(([key]) => typeof own[key] === 'number' && own[key] !== 1)) return null;
  const t = auraTotals(unit, path, tier);
  if (t.tiers < 2) return null;
  const parts = AURA_MULS.filter(([key]) => pctUp(t[key]) !== 0).map(([key, word]) => `+${pctUp(t[key])}% ${word}`);
  return parts.length ? `Her tiers multiply: ${parts.join(', ')} in all.` : null;
}

/** A tier's text as the menus and the battle show it: her authored words, plus a stacking aura's running total. */
export function tierDesc(unit, path, tier) {
  const desc = unit?.paths?.[path]?.tiers?.[tier - 1]?.desc || '';
  const line = stackedAuraLine(unit, path, tier);
  return line ? `${desc} ${line}` : desc;
}
