// Buff visibility (pure, no DOM): what the icon row over a girl shows, the rim tint of every source
// girl, and the text of the panel's "Buffed by" / "Buffing" sections. Reads the Sim's read-only
// buff API (sim.buffSources / buffTargets / aurasCovering, src/sim/buffs.js); decides nothing.
// The renderer (src/render/buffIcons.js) and the tower panel share it.

/** Buff keys in the order their icons are drawn (one icon per key). */
export const BUFF_KEYS = ['dmg', 'rate', 'pen', 'crit', 'range', 'det', 'cost', 'cleanse'];

/** Atlas sprite of each key's glyph (src/render/textures.js). */
export const BUFF_ICON = {
  dmg: 'bf_dmg', rate: 'bf_rate', pen: 'bf_pen', crit: 'bf_crit', range: 'bf_range', det: 'bf_det', cost: 'bf_cost', cleanse: 'bf_cleanse',
};

/** Badge sprite of a limited / special source kind (top-right of the icon). */
export const BUFF_BADGE = { brew: 'bfb_brew', link: 'bfb_link', overclock: 'bfb_oc', ult: 'bfb_ult', map: 'bfb_map' };

/** What each key means, for the panel ("+43 % damage"). */
export const BUFF_LABEL = {
  dmg: 'damage', rate: 'attack speed', pen: 'armor pen', crit: 'crit chance', range: 'range', det: 'Veil Sight', cost: 'cheaper upgrades', cleanse: 'cleanse',
};

/** Limited sources (a few girls, strong, on top of auras). */
export const LIMITED_KINDS = new Set(['brew', 'link', 'overclock']);

/** The dark plate under every icon. */
export const PLATE = '#141a2e';

/**
 * Rim tint of each source girl (spec §4.2): bright enough on the plate (≥ 3:1). A girl not listed
 * falls back to her hair colour, lightened until it reads on the plate.
 */
export const SOURCE_TINT = {
  midori: '#69db7c', chika: '#ffb703', miko: '#ff6b6b', umeko: '#c77dff', hotaru: '#c0eb75', momo: '#ff8fab',
  shiro: '#dee2e6', hikari: '#ffd84d', luna: '#b197fc', nami: '#4cc9f0',
};
/** The map rule's tint (and an ultimate whose hero is unknown). */
export const MAP_TINT = '#adb5bd';

const hexRgb = (hex) => {
  const n = parseInt(String(hex).replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (rgb) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
function luminance(hex) {
  const [r, g, b] = hexRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** WCAG contrast ratio of two colours. */
export function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
/** Lightens a colour toward white until it reaches `min`:1 on the plate. */
export function readableOnPlate(hex, min = 3) {
  let rgb = hexRgb(hex);
  for (let i = 0; i < 20 && contrast(toHex(rgb), PLATE) < min; i++) rgb = rgb.map((v) => v + (255 - v) * 0.2);
  return toHex(rgb);
}

/** Rim tint of a source girl (by unit id; her def for the hair fallback). */
export function tintOf(unitId, def = null) {
  if (unitId && SOURCE_TINT[unitId]) return SOURCE_TINT[unitId];
  if (def?.palette?.hair) return readableOnPlate(def.palette.hair);
  return MAP_TINT;
}

/**
 * The icon row of one girl from her buffSources rows: one entry per key (BUFF_KEYS order) with the
 * rim tint (the limited source's when there is one), a second tint when an aura and a limited
 * source both give the key (a 2-segment rim), the badge of the strongest kind and whether it
 * pulses (overclock).
 * @param {{ key: string, kind: string, unitId: string|null }[]} rows sim.buffSources(uid)
 * @param {(unitId: string) => object|null} [defOf]
 * @returns {{ key: string, icon: string, tint: string, tint2: string|null, limited: boolean, badge: string|null, pulse: boolean, kinds: string[] }[]}
 */
export function iconRow(rows, defOf = () => null) {
  const out = [];
  for (const key of BUFF_KEYS) {
    const mine = rows.filter((r) => r.key === key);
    if (!mine.length) continue;
    const lim = mine.find((r) => LIMITED_KINDS.has(r.kind));
    const aura = mine.find((r) => r.kind === 'aura');
    const special = mine.find((r) => r.kind === 'ult' || r.kind === 'map');
    const main = lim || aura || special;
    const tintFor = (r) => (r.kind === 'map' ? MAP_TINT : tintOf(r.unitId, r.unitId ? defOf(r.unitId) : null));
    const other = lim ? aura || special : aura && special ? special : null;
    out.push({
      key,
      icon: BUFF_ICON[key],
      tint: tintFor(main),
      tint2: other ? tintFor(other) : null,
      limited: !!lim,
      badge: lim ? BUFF_BADGE[lim.kind] : special && !aura ? BUFF_BADGE[special.kind] : null,
      pulse: lim?.kind === 'overclock',
      kinds: [...new Set(mine.map((r) => r.kind))],
    });
  }
  return out;
}

/** Most icons in a row; more collapse into a "+N" chip. */
export const MAX_ICONS = 4;

/** Icon size in CSS px for a viewport: 13 px at a short side ≤ 400, 16 px at ≥ 700, linear between. */
export function iconPx(shortSide) {
  if (!(shortSide > 400)) return 13;
  if (shortSide >= 700) return 16;
  return 13 + (3 * (shortSide - 400)) / 300;
}

/** "+43 %", "+4", "−10 %", "" (flags) — a buff amount for the panel. */
export function fmtBuffValue(key, value) {
  if (value === true || key === 'det' || key === 'cleanse') return '';
  if (key === 'pen') return `+${Math.round(value * 10) / 10}`;
  if (key === 'cost') return `−${Math.round(value * 100)} %`;
  return `+${Math.round(value * 100)} %`;
}

/** "+43 % damage", "Veil Sight" — one key of one source. */
export function buffText(key, value) {
  const v = fmtBuffValue(key, value);
  return v ? `${v} ${BUFF_LABEL[key]}` : BUFF_LABEL[key];
}

/** "aura", "brew 5 s", "tune-up link", "overclock 4 s", "ultimate 3 s", "map rule". */
export function kindLabel(kind, left = null) {
  const s = left != null && left > 0 ? ` ${Math.ceil(left)} s` : '';
  switch (kind) {
    case 'brew': return `brew${s}`;
    case 'link': return 'tune-up link';
    case 'overclock': return `overclock${s}`;
    case 'ult': return `ultimate${s}`;
    case 'map': return 'map rule';
    default: return 'aura';
  }
}

/**
 * The "Buffed by" rows: one per source girl (limited sources first, then auras, the ultimate and
 * the map rule), each with her keys and amounts.
 * @returns {{ src: number, unitId: string|null, kind: string, left: number|null, limited: boolean, texts: string[], keys: string[] }[]}
 */
export function buffedByRows(rows) {
  const by = new Map();
  for (const r of rows) {
    const id = `${r.kind === 'aura' ? 'aura' : r.kind}:${r.src}`;
    let g = by.get(id);
    if (!g) by.set(id, (g = { src: r.src, unitId: r.unitId, kind: r.kind, left: r.left, limited: LIMITED_KINDS.has(r.kind), texts: [], keys: [] }));
    g.keys.push(r.key);
    g.texts.push(buffText(r.key, r.value));
  }
  const rank = (g) => (g.limited ? 0 : g.kind === 'aura' ? 1 : g.kind === 'ult' ? 2 : 3);
  return [...by.values()].sort((a, b) => rank(a) - rank(b));
}

/**
 * Footer under "Buffed by" when auras lost: "2 weaker auras here don't stack."
 * @param {{ won: string[] }[]} covering sim.aurasCovering(uid)
 */
export function weakerAurasText(covering) {
  const n = covering.filter((a) => !a.won.length).length;
  return n > 0 ? `${n} weaker aura${n === 1 ? '' : 's'} here ${n === 1 ? "doesn't" : "don't"} stack.` : '';
}

/** "+29 % damage, +12 armor pen" — what a brew / tune-up gives each girl (her stats.brew / stats.link). */
export function limitedText(l) {
  if (!l) return '';
  const bits = [];
  if (l.dmgMul > 1) bits.push(buffText('dmg', l.dmgMul - 1));
  if (l.rateMul > 1) bits.push(buffText('rate', l.rateMul - 1));
  if (l.armorPen > 0) bits.push(buffText('pen', l.armorPen));
  if (l.critChance > 0) bits.push(buffText('crit', l.critChance));
  return bits.join(', ');
}

/** What a limited source does to her pick, for the toast ("Midori will brew Shiro first."). */
export function pickText(src, target) {
  const verb = src.stats?.brew ? 'brew' : 'tune up';
  return `${src.def?.name || 'She'} will ${verb} ${target.def?.name || 'her'} first.`;
}

/** Refused picks, by reason (setBuffPick / the co-op pick command). */
export const PICK_REFUSED = {
  range: 'Out of her reach — pick a girl inside her range.',
  self: 'She cannot pick herself.',
  notYours: "Only her owner can pick for her.",
  gone: 'That girl is gone.',
  noBuff: 'She has no brew or tune-up yet.',
  invalid: 'That is not a girl.',
};

/** The three settings of the icons (settings.buffIcons). */
export const BUFF_ICON_MODES = ['all', 'selected', 'off'];
export const DEFAULT_BUFF_ICONS = 'all';
