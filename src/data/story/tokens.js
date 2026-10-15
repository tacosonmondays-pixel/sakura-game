// Story text tokens (owner: story; STORY_SPEC §1.2.5). Resolves {name:aoi}, {title:aoi}, {ult:hikari},
// {stage:1-5} and {chapter:3} from game data, so a rename in units.js (the roster merge) carries through every
// scene, lesson and toast. Pure; used by the scene player, the journal and the content test.

import { UNIT_MAP } from '../units.js';
import { STAGE_MAP, CHAPTERS } from '../stages.js';
import { TOKENS, TOKEN_RE } from './format.js';

function chapterName(chapters, n) {
  const ch = chapters.find((c) => String(c.id) === String(n));
  return ch ? ch.name : null;
}

function lookup(kind, arg, { units, stages, chapters }) {
  if (kind === 'name') return units[arg]?.name ?? null;
  if (kind === 'title') return units[arg]?.title ?? null;
  if (kind === 'ult') return units[arg]?.hero?.ult?.name ?? null;
  if (kind === 'stage') return stages[arg]?.name ?? null;
  if (kind === 'chapter') return chapterName(chapters, arg);
  return null;
}

/**
 * Problems with the tokens in a text: unknown kinds and arguments that do not resolve.
 * @returns {string[]} empty when every token resolves
 */
export function tokenProblems(text, { units = UNIT_MAP, stages = STAGE_MAP, chapters = CHAPTERS } = {}) {
  const out = [];
  for (const m of String(text).matchAll(TOKEN_RE)) {
    const [raw, kind, arg] = m;
    if (!TOKENS.includes(kind)) out.push(`unknown token ${raw}`);
    else if (lookup(kind, arg, { units, stages, chapters }) == null) out.push(`token ${raw} does not resolve`);
  }
  const stray = String(text).replace(TOKEN_RE, '');
  if (/[{}]/.test(stray)) out.push(`stray brace in "${text}"`);
  return out;
}

/**
 * Replace every token with its value from data. Unresolvable tokens fall back to something readable
 * (a capitalised id, the raw stage id, "Chapter n") so a missing unit never shows braces to a player.
 */
export function resolveText(text, { units = UNIT_MAP, stages = STAGE_MAP, chapters = CHAPTERS } = {}) {
  return String(text).replace(TOKEN_RE, (raw, kind, arg) => {
    const v = lookup(kind, arg, { units, stages, chapters });
    if (v != null) return v;
    if (kind === 'chapter') return `Chapter ${arg}`;
    if (kind === 'name' || kind === 'title' || kind === 'ult') return arg.charAt(0).toUpperCase() + arg.slice(1);
    return arg;
  });
}
