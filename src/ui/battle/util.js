// Small helpers shared by the battle UI modules (owner: battle-ui). Numbers are not formatted here: every number in
// battle goes through src/ui/format.js fmtNum (UI_DIRECTION §2, one number style; tests/battle-ui/battleNumbers.test.js).
import { h } from '../dom.js';
import { svgEl } from '../components.js';
import { uiIcon, traitIcon } from '../../art/icons.js';
import { ENEMY_MAP } from '../../data/enemies.js';
import { TRAITS } from '../../data/types.js';

/** Sets a CSS custom property on an existing element (skipped when the value is null). */
export function setVar(el, name, value) {
  if (el && value != null) el.style.setProperty(name, String(value));
  return el;
}

/**
 * What a battle that failed to build logs beside its error (controller.js `ready`): which battle it was. Plain
 * values only, so the line reads the same in a bug report as in the console.
 * @param {{ req?: object|null, params?: object, quality?: string|null, coop?: boolean }} o
 */
export function buildErrorContext({ req = null, params = {}, quality = null, coop = false } = {}) {
  return {
    stage: req?.stageId ?? params?.stage ?? null,
    difficulty: req?.difficulty ?? params?.difficulty ?? null,
    mode: params?.mode || 'standard',
    freeplay: req?.freeplay ?? null,
    endless: !!req?.endless,
    resume: !!req?.resume,
    titan: !!params?.titan,
    tutorial: params?.tutorial === '1',
    coop: !!coop,
    quality: quality || null,
  };
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

/**
 * Live rates over a sliding window of game time (the drone panel's "Dealing" and "DPS (last 5 s)"):
 * sample(time, key, value) records a running total (damage dealt so far); rate(key) is how fast it
 * grew over the last `window` seconds (null until a second of samples exists).
 */
export function createRateMeter(window = 5) {
  const series = new Map(); // key -> [[time, value], …] oldest first
  return {
    sample(time, key, value) {
      let s = series.get(key);
      if (!s) series.set(key, (s = []));
      if (s.length && time < s[s.length - 1][0]) s.length = 0; // time went back: a restore
      s.push([time, value]);
      while (s.length > 2 && s[1][0] <= time - window) s.shift();
    },
    rate(key) {
      const s = series.get(key);
      if (!s || s.length < 2) return null;
      const [t0, v0] = s[0];
      const [t1, v1] = s[s.length - 1];
      return t1 - t0 >= 1 ? Math.max(0, (v1 - v0) / (t1 - t0)) : null;
    },
    clear() {
      series.clear();
    },
  };
}
