// Story scene format (owner: story; STORY_SPEC §1.2). Builders for scene data plus the closed vocabularies
// the scene player (src/ui/story/player.js) understands. Unknown faces, motions, positions, backgrounds or
// music cues throw when the scene module is evaluated, so a typo never reaches a player.
//
// Scenes are plain frozen objects:
//   scene(id, { title, chapter, kind, trigger, bg, music, cast?, ifUnit?, ifOwned?, act?, note? }, lines)
//     act: 2 marks a Gate Arc (Act II) episode (the player's kicker names the act); note: a content note the
//     player shows on its own card before the first line ("This arc contains war and loss.")
//     ifOwned: ['ruri', 'iroha', …] the episode waits until the player OWNS any one of these girls (not merely that
//     she exists in code, which is `ifUnit`): src/systems/storyTriggers.js keeps it queued, the archive shows it
//     locked with "Needs Ruri, Iroha, Ena or Fuu". Every id must be in UNIT_MAP.
//   say(who, text, { at?, face?, fx?, name?, ifUnit?, sfx? })   who = unit id, NPC id or 'sensei'
//   narrate(text, { ifUnit? })
//   cue({ bg?, music?, sfx?, exit?, enter?, flash?, shake?, petals?, fade?, wait? })
//   choice([{ text, lines }, …])                                 flavour only: no effects field exists
//
// Text (lines, choice options and episode titles) may contain tokens that resolve from game data
// (src/data/story/tokens.js): {name:<unitId>} {title:<unitId>} {ult:<heroId>} {stage:<stageId>} {chapter:<n>}.
// `ifUnit: '<id>'` on a line or a scene drops it while UNIT_MAP has no such unit (girls not merged yet).

import { isBackgroundId } from './backgrounds.js';
import { STORY_MUSIC, STORY_SFX } from './music.js';
import { UNIT_MAP } from '../units.js';

/** Portrait slots; `off` = a voice from off-stage (plate, no portrait). */
export const POSITIONS = ['left', 'center', 'right', 'off'];
export const STAGE_POSITIONS = ['left', 'center', 'right'];

/**
 * Expressions. The stands are single drawings, so a face = a code-drawn emote glyph above her head plus a default
 * motion (src/ui/story/emotes.js). `neutral` (or no face) shows no emote — use emotes sparingly.
 */
export const FACES = {
  neutral: { glyph: null, fx: null },
  smile: { glyph: 'sparkle-small', fx: null },
  joy: { glyph: 'notes', fx: 'hop' },
  laugh: { glyph: 'hehe', fx: 'bounce' },
  surprise: { glyph: 'exclaim', fx: 'jolt' },
  question: { glyph: 'question', fx: 'tilt' },
  sweat: { glyph: 'sweat', fx: null },
  pout: { glyph: 'puff', fx: 'shake-small' },
  determined: { glyph: 'flare', fx: 'nod' },
  sad: { glyph: 'tears', fx: 'droop' },
  sleepy: { glyph: 'zz', fx: 'sway' },
  idea: { glyph: 'bulb', fx: 'hop' },
  sparkle: { glyph: 'sparkles', fx: null },
  wink: { glyph: 'star', fx: null },
  heart: { glyph: 'heart', fx: null }, // friendly cheer only, never romantic (≤ 1 per episode)
  deadpan: { glyph: 'ellipsis', fx: null },
};
export const FACE_IDS = Object.keys(FACES);

/** Portrait motions (override a face's default). */
export const FX = ['hop', 'bounce', 'jolt', 'nod', 'tilt', 'shake-small', 'droop', 'sway', 'slide-in', 'fade'];
export const FLASH = ['white', 'gold'];
export const FADES = ['in', 'out'];

export const SCENE_KINDS = ['opening', 'prologue', 'join', 'mid', 'epilogue', 'outro', 'lesson', 'event'];

/** Speakers with no portrait: narrator (no plate), sensei (plate "Sensei"), unknown (plate "???"). */
export const PLAIN_SPEAKERS = ['narrator', 'sensei', 'unknown'];
/** Enemy speakers by enemy id: plate from ENEMY_MAP[id].name in the family colour, no portrait. */
export const ENEMY_SPEAKERS = [
  'slime_prince', 'slime_frost_heir', 'slime_droplet', 'lizard_basilisk', 'ghost_hollowknight', 'orc_general', 'plant_treant',
  'goblin_machine', 'goblin_chief', 'oni_champion', 'dragon_ashwing', 'lizard_lamp_hugger',
];
export const NPCS = [...PLAIN_SPEAKERS, ...ENEMY_SPEAKERS];

/** @returns {boolean} the speaker never has a portrait */
export function isNpc(who) {
  return NPCS.includes(who);
}

export const TOKENS = ['name', 'title', 'ult', 'stage', 'chapter'];
/** Matches one token; group 1 = kind, group 2 = argument. Use with matchAll. */
export const TOKEN_RE = /\{([a-z]+):([^{}\s]+)\}/g;

/** Shape limits for phones (844×390: three lines of type in the box). The content test enforces them. */
export const LIMITS = {
  lineChars: 110, // say / narrate text, raw and resolved
  choiceChars: 44, // one choice option
  titleChars: 32, // episode title
  spokenMin: 8, // top-level say + narrate lines per episode
  spokenMax: 18,
  openingSpokenMax: 20,
  choicesPerScene: 1,
  optionsMin: 2,
  optionsMax: 3,
  repliesMax: 2, // lines inside one choice option
  portraitsMax: 4, // distinct girls with a portrait
  heartsMax: 1, // `heart` faces per episode
};

const SAY_KEYS = ['at', 'face', 'fx', 'name', 'ifUnit', 'sfx'];
const NARRATE_KEYS = ['ifUnit'];
const CUE_KEYS = ['bg', 'music', 'sfx', 'exit', 'enter', 'flash', 'shake', 'petals', 'fade', 'wait'];
const META_KEYS = ['title', 'chapter', 'kind', 'trigger', 'bg', 'music', 'cast', 'ifUnit', 'ifOwned', 'act', 'note'];
const ID_RE = /^[a-z][a-z0-9_]*$/;
const STAGE_RE = /^[0-9]+-[0-9]+$/;

function fail(msg) {
  throw new Error(`story format: ${msg}`);
}

function checkKeys(obj, allowed, what) {
  for (const k of Object.keys(obj)) if (!allowed.includes(k)) fail(`${what}: unknown field "${k}"`);
}

function checkText(text, what) {
  if (typeof text !== 'string' || !text.trim()) fail(`${what}: text must be a non-empty string`);
  if (text !== text.trim()) fail(`${what}: text has leading or trailing spaces: "${text}"`);
}

function checkId(id, what) {
  if (typeof id !== 'string' || !ID_RE.test(id)) fail(`${what}: bad id "${id}"`);
}

function clean(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out;
}

/** A spoken line. `who` is a unit id, an NPC id (see NPCS) or 'sensei'. */
export function say(who, text, opts = {}) {
  checkId(who, 'say');
  checkText(text, `say(${who})`);
  checkKeys(opts, SAY_KEYS, `say(${who})`);
  if (opts.at !== undefined && !POSITIONS.includes(opts.at)) fail(`say(${who}): unknown position "${opts.at}"`);
  if (opts.face !== undefined && !FACE_IDS.includes(opts.face)) fail(`say(${who}): unknown face "${opts.face}"`);
  if (opts.fx !== undefined && !FX.includes(opts.fx)) fail(`say(${who}): unknown fx "${opts.fx}"`);
  if (opts.name !== undefined) checkText(opts.name, `say(${who}) name`);
  if (opts.ifUnit !== undefined) checkId(opts.ifUnit, `say(${who}) ifUnit`);
  if (opts.sfx !== undefined && !STORY_SFX[opts.sfx]) fail(`say(${who}): unknown sfx "${opts.sfx}"`);
  return Object.freeze(clean({ t: 'say', who, text, ...opts }));
}

/** Narration: no plate, centred italic. */
export function narrate(text, opts = {}) {
  checkText(text, 'narrate');
  checkKeys(opts, NARRATE_KEYS, 'narrate');
  if (opts.ifUnit !== undefined) checkId(opts.ifUnit, 'narrate ifUnit');
  return Object.freeze(clean({ t: 'narrate', text, ...opts }));
}

/** A stage direction; the player runs it at once and auto-advances. */
export function cue(opts = {}) {
  checkKeys(opts, CUE_KEYS, 'cue');
  if (!Object.keys(opts).length) fail('cue: empty');
  if (opts.bg !== undefined && !isBackgroundId(opts.bg)) fail(`cue: unknown background "${opts.bg}"`);
  if (opts.music !== undefined && !STORY_MUSIC[opts.music]) fail(`cue: unknown music cue "${opts.music}"`);
  if (opts.sfx !== undefined && !STORY_SFX[opts.sfx]) fail(`cue: unknown sfx "${opts.sfx}"`);
  if (opts.exit !== undefined && opts.exit !== 'all') {
    if (!Array.isArray(opts.exit) || !opts.exit.length) fail('cue: exit must be "all" or a non-empty id list');
    opts.exit.forEach((id) => checkId(id, 'cue exit'));
  }
  if (opts.enter !== undefined) {
    if (!Array.isArray(opts.enter) || !opts.enter.length) fail('cue: enter must be a non-empty list');
    for (const e of opts.enter) {
      checkKeys(e, ['who', 'at', 'fx'], 'cue enter');
      checkId(e.who, 'cue enter');
      if (!STAGE_POSITIONS.includes(e.at)) fail(`cue enter ${e.who}: position must be left, center or right`);
      if (e.fx !== undefined && !FX.includes(e.fx)) fail(`cue enter ${e.who}: unknown fx "${e.fx}"`);
    }
  }
  if (opts.flash !== undefined && !FLASH.includes(opts.flash)) fail(`cue: flash must be one of ${FLASH.join(', ')}`);
  if (opts.fade !== undefined && !FADES.includes(opts.fade)) fail('cue: fade must be "in" or "out"');
  for (const k of ['shake', 'petals']) if (opts[k] !== undefined && opts[k] !== true) fail(`cue: ${k} must be true`);
  if (opts.wait !== undefined && !(Number.isFinite(opts.wait) && opts.wait > 0 && opts.wait <= 3000)) fail('cue: wait must be 1..3000 ms');
  const out = { t: 'cue', ...opts };
  if (out.exit && out.exit !== 'all') out.exit = Object.freeze([...out.exit]);
  if (out.enter) out.enter = Object.freeze(out.enter.map((e) => Object.freeze({ ...e })));
  return Object.freeze(out);
}

/** A flavour-only choice: 2–3 options, each with 1–2 reply lines. The chosen index is only logged. */
export function choice(options) {
  if (!Array.isArray(options) || options.length < LIMITS.optionsMin || options.length > LIMITS.optionsMax) {
    fail(`choice: needs ${LIMITS.optionsMin}–${LIMITS.optionsMax} options`);
  }
  const opts = options.map((o, i) => {
    checkKeys(o, ['text', 'lines'], `choice option ${i}`);
    checkText(o.text, `choice option ${i}`);
    if (!Array.isArray(o.lines) || !o.lines.length) fail(`choice option ${i}: needs reply lines`);
    for (const l of o.lines) {
      if (!l || (l.t !== 'say' && l.t !== 'narrate')) fail(`choice option ${i}: replies must be say() or narrate()`);
    }
    return Object.freeze({ text: o.text, lines: Object.freeze([...o.lines]) });
  });
  return Object.freeze({ t: 'choice', options: Object.freeze(opts) });
}

function checkTrigger(trigger, id) {
  if (trigger === null) return;
  if (!trigger || typeof trigger !== 'object') fail(`scene ${id}: trigger must be an object or null`);
  const keys = Object.keys(trigger);
  if (keys.length !== 1) fail(`scene ${id}: trigger needs exactly one key`);
  const [k] = keys;
  const v = trigger[k];
  if (k === 'opening') { if (v !== true) fail(`scene ${id}: opening trigger must be true`); return; }
  if (k === 'tutorial') { if (v !== 'won') fail(`scene ${id}: tutorial trigger must be "won"`); return; }
  if (k === 'before' || k === 'after') { if (!STAGE_RE.test(String(v))) fail(`scene ${id}: bad stage "${v}"`); return; }
  if (k === 'lesson') { checkId(v, `scene ${id} lesson trigger`); return; }
  fail(`scene ${id}: unknown trigger "${k}"`);
}

/** Calls fn(line, ctx) for every line, including choice replies (ctx.option = option index or -1). */
export function forEachLine(sceneOrLines, fn) {
  const lines = Array.isArray(sceneOrLines) ? sceneOrLines : sceneOrLines.lines;
  lines.forEach((line, index) => {
    fn(line, { index, option: -1 });
    if (line.t === 'choice') {
      line.options.forEach((opt, oi) => opt.lines.forEach((reply, ri) => fn(reply, { index, option: oi, reply: ri })));
    }
  });
}

/** @returns {string[]} girls who get a portrait: roster speakers with an on-stage line, plus cue entries */
export function deriveCast(lines) {
  const cast = [];
  const add = (id) => { if (!cast.includes(id)) cast.push(id); };
  forEachLine(lines, (line) => {
    if (line.ifUnit) return;
    if (line.t === 'say' && !isNpc(line.who) && line.at !== 'off') add(line.who);
    if (line.t === 'cue' && line.enter) line.enter.forEach((e) => add(e.who));
  });
  return cast;
}

/**
 * A scene. Validates meta and lines; derives `cast` (archive heads + preload) when omitted.
 * Lines are frozen; the returned scene is frozen too.
 */
export function scene(id, meta, lines) {
  if (typeof id !== 'string' || !/^[a-z0-9]+(\.[a-z0-9]+)*$/.test(id)) fail(`scene: bad id "${id}"`);
  if (!meta || typeof meta !== 'object') fail(`scene ${id}: meta required`);
  checkKeys(meta, META_KEYS, `scene ${id}`);
  checkText(meta.title, `scene ${id} title`);
  if (!Number.isInteger(meta.chapter) || meta.chapter < 0 || meta.chapter > 99) fail(`scene ${id}: chapter must be an integer`);
  if (!SCENE_KINDS.includes(meta.kind)) fail(`scene ${id}: unknown kind "${meta.kind}"`);
  checkTrigger(meta.trigger === undefined ? null : meta.trigger, id);
  if (!isBackgroundId(meta.bg)) fail(`scene ${id}: unknown background "${meta.bg}"`);
  if (meta.music !== undefined && !STORY_MUSIC[meta.music]) fail(`scene ${id}: unknown music cue "${meta.music}"`);
  if (meta.ifUnit !== undefined) checkId(meta.ifUnit, `scene ${id} ifUnit`);
  if (meta.ifOwned !== undefined) {
    if (!Array.isArray(meta.ifOwned) || !meta.ifOwned.length) fail(`scene ${id}: ifOwned must be a non-empty list of unit ids`);
    for (const u of meta.ifOwned) {
      checkId(u, `scene ${id} ifOwned`);
      if (!UNIT_MAP[u]) fail(`scene ${id}: ifOwned names "${u}", who is not in UNIT_MAP`);
    }
    if (new Set(meta.ifOwned).size !== meta.ifOwned.length) fail(`scene ${id}: ifOwned lists a girl twice`);
  }
  if (meta.act !== undefined && meta.act !== 1 && meta.act !== 2) fail(`scene ${id}: act must be 1 or 2`);
  if (meta.note !== undefined) checkText(meta.note, `scene ${id} note`);
  if (!Array.isArray(lines) || !lines.length) fail(`scene ${id}: needs lines`);
  for (const l of lines) {
    if (!l || !['say', 'narrate', 'cue', 'choice'].includes(l.t)) fail(`scene ${id}: lines must come from say/narrate/cue/choice`);
  }
  const cast = meta.cast ? [...meta.cast] : deriveCast(lines);
  cast.forEach((c) => checkId(c, `scene ${id} cast`));
  return Object.freeze(clean({
    id,
    title: meta.title,
    chapter: meta.chapter,
    kind: meta.kind,
    trigger: meta.trigger ? Object.freeze({ ...meta.trigger }) : null,
    bg: meta.bg,
    music: meta.music,
    ifUnit: meta.ifUnit,
    ifOwned: meta.ifOwned ? Object.freeze([...meta.ifOwned]) : undefined,
    act: meta.act,
    note: meta.note,
    cast: Object.freeze(cast),
    lines: Object.freeze([...lines]),
  }));
}

/**
 * Lines that play for a given roster: drops `ifUnit` lines whose unit is missing.
 * @param {object} sc scene
 * @param {(id: string) => boolean} hasUnit
 */
export function playableLines(sc, hasUnit) {
  const keep = (l) => !l.ifUnit || hasUnit(l.ifUnit);
  return sc.lines.filter(keep).map((l) => {
    if (l.t !== 'choice') return l;
    return { ...l, options: l.options.map((o) => ({ ...o, lines: o.lines.filter(keep) })) };
  });
}

/** @returns {number} top-level say + narrate lines (choice replies and cues excluded) */
export function spokenCount(lines) {
  return lines.filter((l) => l.t === 'say' || l.t === 'narrate').length;
}

/** @returns {Array<{kind: string, arg: string, raw: string}>} the tokens in a text */
export function tokensIn(text) {
  return [...String(text).matchAll(TOKEN_RE)].map((m) => ({ kind: m[1], arg: m[2], raw: m[0] }));
}
