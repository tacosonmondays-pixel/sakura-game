// A girl's mark: the emblem that stamps in at the end of her recruit reveal (docs/RECRUIT_CINEMATIC.md). Drawn,
// never loaded: a rosette whose petal count and shape come from her id, in her own colours (hair and eyes), with
// her role's glyph in the middle. LR units wear the Nightglass mark instead: a navy disc, a white-gold line, the
// twin stars on an orbit and twelve starlight points. Same girl → same mark, every time.
import { GLYPHS } from '../../art/icons/glyphs.js';
import { visualSeed, createVisualRandom } from '../../render/vfx/random.js';

const n2 = (v) => Math.round(v * 100) / 100;
const esc = (s) => String(s ?? '').replace(/[^a-z0-9_-]/gi, '');

/** The shape choices a Standard / Premium mark is drawn from (by her id). */
export const MARK_SHAPES = Object.freeze(['petal', 'star', 'blade']);

/**
 * Her mark's recipe (pure; the tests read it). @param {object} unit UnitDef (id, role, palette)
 * @returns {{ points: number, shape: string, turn: number, main: string, accent: string, glyph: string, lr: boolean }}
 */
export function markRecipe(unit, { lr = false } = {}) {
  const rand = createVisualRandom(visualSeed('recruit-mark', unit?.id || 'unknown'));
  const pal = unit?.palette || {};
  return {
    points: lr ? 12 : rand.pick([5, 6, 8]),
    shape: lr ? 'star' : rand.pick(MARK_SHAPES),
    turn: lr ? 0 : n2(rand.range(-12, 12)),
    main: lr ? '#ffd27a' : safeColor(pal.hair, '#f7a3bf'),
    accent: lr ? '#cfe0ff' : safeColor(pal.eyes, '#9fdcff'),
    glyph: GLYPHS[unit?.role] ? unit.role : 'info',
    lr: !!lr,
  };
}

function safeColor(c, fallback) {
  return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(String(c || '')) ? c : fallback;
}

/** One petal / point of the rosette, pointing up from the centre (60, 60). */
function pointPath(shape, ro, ri, half) {
  const tip = 60 - ro;
  if (shape === 'petal') return `M60 ${n2(60 - ri)}C${n2(60 - half * 1.5)} ${n2(60 - ri - 8)} ${n2(60 - half)} ${n2(tip + 6)} 60 ${n2(tip)}C${n2(60 + half)} ${n2(tip + 6)} ${n2(60 + half * 1.5)} ${n2(60 - ri - 8)} 60 ${n2(60 - ri)}Z`;
  if (shape === 'blade') return `M${n2(60 - half * 0.7)} ${n2(60 - ri)}L60 ${n2(tip)}L${n2(60 + half * 0.7)} ${n2(60 - ri)}L60 ${n2(60 - ri + 6)}Z`;
  return `M${n2(60 - half)} ${n2(60 - ri)}L60 ${n2(tip)}L${n2(60 + half)} ${n2(60 - ri)}Z`;
}

let uid = 0;

/**
 * Her mark as an SVG string (viewBox 0 0 120 120).
 * @param {object} unit UnitDef
 * @param {{ lr?: boolean, label?: string }} [o]
 */
export function markSVG(unit, { lr = false, label = '' } = {}) {
  const r = markRecipe(unit, { lr });
  const id = `rcm-${esc(unit?.id)}-${++uid}`;
  const glyph = GLYPHS[r.glyph];
  const rays = [];
  for (let i = 0; i < r.points; i++) {
    const a = (360 / r.points) * i + r.turn;
    rays.push(`<path d="${pointPath(r.shape, lr ? 56 : 54, 30, lr ? 7 : 360 / r.points / 2.6)}" transform="rotate(${n2(a)} 60 60)"/>`);
  }
  // the small points between the big ones
  const minor = [];
  for (let i = 0; i < r.points; i++) {
    const a = (360 / r.points) * (i + 0.5) + r.turn;
    minor.push(`<path d="${pointPath('star', lr ? 44 : 42, 30, 4)}" transform="rotate(${n2(a)} 60 60)"/>`);
  }
  const disc = lr ? '#0e1930' : `url(#${id}-d)`;
  const line = lr ? '#ffd27a' : '#ffffff';
  let s = `<svg class="rc-mark-svg" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label.replace(/["<>&]/g, '')}">`;
  s += `<defs><radialGradient id="${id}-d" cx="50%" cy="40%" r="65%"><stop offset="0" stop-color="#ffffff" stop-opacity="0.95"/><stop offset="0.45" stop-color="${r.accent}"/><stop offset="1" stop-color="${r.main}"/></radialGradient>`;
  s += `<linearGradient id="${id}-p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="0.5" stop-color="${r.main}"/><stop offset="1" stop-color="${r.accent}"/></linearGradient>`;
  s += `<radialGradient id="${id}-s"><stop offset="0.55" stop-color="#050a1e" stop-opacity="0.55"/><stop offset="1" stop-color="#050a1e" stop-opacity="0"/></radialGradient></defs>`;
  // its soft shadow, drawn in (a gradient, not a filter: nothing to re-blur while it stamps or breathes)
  s += `<circle cx="60" cy="64" r="58" fill="url(#${id}-s)"/>`;
  s += `<g fill="url(#${id}-p)" stroke="${lr ? '#0e1930' : 'rgba(20,24,48,0.55)'}" stroke-width="1.6" stroke-linejoin="round">${rays.join('')}</g>`;
  s += `<g fill="${lr ? '#cfe0ff' : '#ffffff'}" opacity="0.85">${minor.join('')}</g>`;
  s += `<circle cx="60" cy="60" r="31" fill="${lr ? '#ffd27a' : 'rgba(20,24,48,0.6)'}"/>`;
  s += `<circle cx="60" cy="60" r="28.5" fill="${disc}"/>`;
  s += `<circle cx="60" cy="60" r="24.5" fill="none" stroke="${line}" stroke-width="1.3" stroke-dasharray="2.5 3" opacity="0.8"/>`;
  if (lr) {
    // the twin stars on their orbit (the Nightglass crest), the glyph between them
    s += `<ellipse cx="60" cy="60" rx="25" ry="10" fill="none" stroke="#ffd27a" stroke-width="1.4" transform="rotate(-20 60 60)" opacity="0.9"/>`;
    s += star4(38, 52, 6, '#ffffff') + star4(82, 68, 4.5, '#ffd27a');
  }
  const g = lr ? 1.35 : 1.6;
  const off = 60 - 12 * g;
  s += `<g transform="translate(${n2(off)} ${n2(off)}) scale(${g})" fill="none" stroke-width="${n2(2.4 / g * 1.3)}" stroke-linecap="round" stroke-linejoin="round">`;
  s += `<g color="${lr ? '#000814' : 'rgba(20,24,48,0.55)'}" stroke="currentColor" transform="translate(0.5 0.8)">${glyph}</g>`;
  s += `<g color="${lr ? '#ffd27a' : '#ffffff'}" stroke="currentColor">${glyph}</g></g>`;
  s += '</svg>';
  return s;
}

function star4(cx, cy, r, fill) {
  const k = r * 0.28;
  return `<path d="M${cx} ${cy - r}L${n2(cx + k)} ${n2(cy - k)}L${cx + r} ${cy}L${n2(cx + k)} ${n2(cy + k)}L${cx} ${cy + r}L${n2(cx - k)} ${n2(cy + k)}L${cx - r} ${cy}L${n2(cx - k)} ${n2(cy - k)}Z" fill="${fill}"/>`;
}
