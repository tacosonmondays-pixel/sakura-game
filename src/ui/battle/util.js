// Small helpers shared by the battle UI modules (owner: battle-ui).
import { h } from '../dom.js';
import { svgEl } from '../components.js';
import { uiIcon, traitIcon } from '../../art/icons.js';
import { ENEMY_MAP } from '../../data/enemies.js';
import { TRAITS } from '../../data/types.js';

/** Sets a CSS custom property (h() ignores `--x` keys in style objects). */
export function setVar(el, name, value) {
  if (el && value != null) el.style.setProperty(name, String(value));
  return el;
}

/** Compact number: 1234 -> "1,234", 12500 -> "12.5k" (only above 100k). */
export function fmtCoins(n) {
  const v = Math.floor(n || 0);
  if (v >= 100000) return `${(v / 1000).toFixed(v >= 1e6 ? 0 : 1).replace(/\.0$/, '')}k`;
  return v.toLocaleString('en-US');
}

/** Short decimal formatting for stats (1 → "1", 1.25 → "1.25", 0.333 → "0.33"). */
export function fmtNum(n, digits = 2) {
  if (n == null || !Number.isFinite(n)) return '–';
  const f = Number(n.toFixed(digits));
  return String(f);
}

export function fmtTime(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
}

/** UI icon element. */
export function icon(name, cls = 'bt-ico') {
  return svgEl(uiIcon(name), cls);
}

/** Trait badge element with title for long-press / hover. */
export function traitBadge(key, cls = 'bt-trait') {
  const el = svgEl(traitIcon(key), cls);
  el.title = TRAITS[key] ? `${TRAITS[key].name}: ${TRAITS[key].desc}` : key;
  return el;
}

export function enemyDef(id) {
  return ENEMY_MAP[id] || null;
}

/**
 * Tiny enemy token: a coloured blob with eyes in the enemy's palette, shaped by tier.
 * Used in the scout strip, boss bar and rewards (no dedicated enemy icons exist).
 */
export function enemyToken(id, { size = 30 } = {}) {
  const e = enemyDef(id);
  const c = e?.color || '#9aa5b1';
  const a = e?.accent || '#ffffff';
  const tier = e?.tier || 'normal';
  const crown = tier === 'boss' || tier === 'miniboss'
    ? `<path d="M10 9 L13 3 L16 8 L20 2 L24 8 L27 3 L30 9 Z" fill="#ffd23f" stroke="#a87b00" stroke-width="1"/>`
    : tier === 'elite' ? '<path d="M14 8 L20 3 L26 8" fill="none" stroke="#ff4d6d" stroke-width="2.4" stroke-linecap="round"/>' : '';
  const svg = `<svg viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true">
    ${crown}
    <path d="M6 34 C4 20 12 9 20 9 C28 9 36 20 34 34 Z" fill="${c}" stroke="rgba(20,30,50,0.55)" stroke-width="1.6"/>
    <path d="M11 18 C13 13 17 11 21 11" fill="none" stroke="${a}" stroke-width="2.4" stroke-linecap="round" opacity="0.8"/>
    <ellipse cx="15" cy="24" rx="2.6" ry="3.4" fill="#1f2a44"/><ellipse cx="25" cy="24" rx="2.6" ry="3.4" fill="#1f2a44"/>
    <circle cx="15.8" cy="22.8" r="0.9" fill="#fff"/><circle cx="25.8" cy="22.8" r="0.9" fill="#fff"/>
  </svg>`;
  return svgEl(svg, 'bt-enemy-token');
}

/** Element factory shortcut re-export so modules only import from here. */
export { h };

/** Throttle helper keyed by string: returns true when `key` was not fired within `ms`. */
export function createThrottle() {
  const last = new Map();
  return (key, ms) => {
    const now = performance.now();
    const prev = last.get(key) || -Infinity;
    if (now - prev < ms) return false;
    last.set(key, now);
    return true;
  };
}
