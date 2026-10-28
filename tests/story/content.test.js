// Story content validation (STORY_SPEC §6 T-content-1..6, docs/story/BIBLE.md §9). Every scene under
// src/data/story/scenes is checked against game data and the phone-sized shape limits, so a typo, a renamed
// girl or an over-long line fails here instead of on a player's screen.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import {
  SCENES, SCENE_LIST, LESSON_SCENES, sceneById, scenesWithTrigger, chapterScenes, sceneAvailable,
} from '../../src/data/story/index.js';
import {
  LIMITS, NPCS, ENEMY_SPEAKERS, PLAIN_SPEAKERS, FACE_IDS, isNpc, forEachLine, playableLines, spokenCount, tokensIn,
} from '../../src/data/story/format.js';
import {
  BACKGROUNDS, stageOfBackground, isBackgroundId, isCgBackground, CHAPTER_FALLBACK_BG, STAGE_PLACE, SPARE_BACKGROUNDS,
} from '../../src/data/story/backgrounds.js';
import { STORY_MUSIC, STORY_SFX } from '../../src/data/story/music.js';
import { STORY_REWARDS, storyRewardFor } from '../../src/data/story/lessons.js';
import { resolveText, tokenProblems } from '../../src/data/story/tokens.js';
import { UNITS, UNIT_MAP, freeUnlocksByStage } from '../../src/data/units.js';
import { ENEMY_MAP } from '../../src/data/enemies.js';
import { STAGE_MAP, CHAPTERS, stageOrderKey } from '../../src/data/stages.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORTRAITS = join(ROOT, 'public', 'art', 'portraits');
const LOBBY_ART = join(ROOT, 'public', 'art', 'lobby');

const ALL = Object.values(SCENES);
const hasUnit = (id) => !!UNIT_MAP[id];
const available = ALL.filter((s) => sceneAvailable(s, hasUnit));

/** The eleven girls the roster merge adds later; their names must be tokens too (BIBLE §5.6). */
const FUTURE_NAMES = ['Kanna', 'Yoriko', 'Seiran', 'Fuu', 'Hana', 'Ruri', 'Noa', 'Tsubaki', 'Kohaku', 'Iroha', 'Ena'];
const ROSTER_NAMES = [...new Set([...UNITS.map((u) => u.name), ...FUTURE_NAMES])];

/** STORY_SPEC §4.5 / BIBLE §9.1: whole words, case-insensitive. Banned in every scene. */
const BANNED = [
  'date', 'dates', 'dating', 'kiss', 'kissed', 'crush', 'flirt', 'flirting', 'romance', 'romantic', 'sexy', 'bikini',
  'swimsuit', 'lingerie', 'boyfriend', 'girlfriend', 'marry', 'married', 'wife', 'husband', 'blush', 'blushes',
  'breast', 'thigh', 'thighs', 'waifu',
  // no gore, ever
  'blood', 'bloody',
];
/**
 * Arc 0 (the shipped chapters): monsters "poof", "pop" or "go home", and nobody is ever hurt for good. Arc 1 (the Gate
 * Arc's `gN.*` episodes) is a war with losses and may name them (STORY.md §18), though it prefers absence.
 */
const BANNED_ARC0 = ['kill', 'killed', 'kills', 'die', 'dies', 'died', 'dying', 'dead', 'death'];
const isArc1 = (sc) => /^g[0-9]+\./.test(sc.id);
const AGE_RE = /\b(\d+\s*(years?|yrs?)\s*old|aged?\s+\d+)\b/i;

/** Every string a player can read in a scene: lines, replies, choice options, title and plate overrides. */
function textsOf(sc) {
  const out = [{ where: 'title', text: sc.title }];
  forEachLine(sc, (l, ctx) => {
    const where = ctx.option >= 0 ? `line ${ctx.index} option ${ctx.option}` : `line ${ctx.index}`;
    if (l.text) out.push({ where, text: l.text, line: l });
    if (l.name) out.push({ where: `${where} plate`, text: l.name, line: l });
    if (l.t === 'choice') l.options.forEach((o, i) => out.push({ where: `line ${ctx.index} choice ${i}`, text: o.text, choice: true }));
  });
  return out;
}

/** Lines with their effective unit condition (line or scene `ifUnit`). */
function ifUnitOf(sc, line) {
  return line?.ifUnit || sc.ifUnit || null;
}

function stripTokens(text) {
  return String(text).replace(/\{[a-z]+:[^{}\s]+\}/g, '');
}

function sayLines(lines) {
  const out = [];
  forEachLine(lines, (l) => { if (l.t === 'say') out.push(l); });
  return out;
}

/** Walks the stage like the player does; returns blocking problems (STORY_SPEC §1.2.1). */
function blockingProblems(sc) {
  const problems = [];
  const stage = new Map();
  let bg = sc.bg;
  const slotOf = (who) => [...stage.entries()].find(([, w]) => w === who)?.[0];
  const place = (who, at, where) => {
    const occupant = stage.get(at);
    if (occupant && occupant !== who) problems.push(`${where}: ${who} enters ${at} over ${occupant} (exit her first)`);
    const old = slotOf(who);
    if (old) stage.delete(old);
    stage.set(at, who);
  };
  const lines = playableLines(sc, () => true);
  lines.forEach((line, i) => {
    const where = `${sc.id} line ${i}`;
    if (line.t === 'cue') {
      if (line.bg) bg = line.bg;
      if (line.exit === 'all') stage.clear();
      else if (line.exit) {
        for (const id of line.exit) {
          const s = slotOf(id);
          if (!s) problems.push(`${where}: exit ${id}, who is not on stage`);
          else stage.delete(s);
        }
      }
      if (line.enter) for (const e of line.enter) place(e.who, e.at, where);
      return;
    }
    if (line.t === 'say' && !isNpc(line.who)) {
      if (line.ifUnit && line.at !== 'off') problems.push(`${where}: ifUnit cameo ${line.who} must speak off-stage`);
      if (line.at && line.at !== 'off') place(line.who, line.at, where);
      else if (line.at !== 'off' && !slotOf(line.who) && !isCgBackground(bg)) {
        problems.push(`${where}: ${line.who} speaks without a slot (give her an \`at\` or a cue enter)`);
      }
    }
    if (line.t === 'choice') {
      line.options.forEach((o, oi) => o.lines.forEach((r) => {
        if (r.t !== 'say' || isNpc(r.who)) return;
        if (r.at && r.at !== 'off') problems.push(`${where} option ${oi}: replies must not move portraits`);
        else if (r.at !== 'off' && !slotOf(r.who) && !isCgBackground(bg)) problems.push(`${where} option ${oi}: ${r.who} is not on stage`);
      }));
    }
  });
  return problems;
}

describe('story registry', () => {
  it('has unique ids, every archive episode and the lesson mini-scenes', () => {
    expect(new Set(ALL.map((s) => s.id)).size).toBe(ALL.length);
    expect(SCENE_LIST.length + LESSON_SCENES.length).toBe(ALL.length);
    // 27 bible episodes + the two roster joins (Noa 6-2, Hana 7-5) that wait for feature/roster + the
    // new girls' joins (Azami 2-2, Yuzuha 4-2, Wakaba 6-5) + the Gate Arc's Act 1 (seven episodes, g1.*)
    expect(SCENE_LIST.length).toBe(39);
    expect(LESSON_SCENES.map((s) => s.id)).toEqual(['lesson.home', 'lesson.recruit', 'lesson.gear']);
    expect(sceneById('opening').trigger).toEqual({ opening: true });
    expect(sceneById('tut.outro').trigger).toEqual({ tutorial: 'won' });
    expect(sceneById('nope')).toBeNull();
    expect(scenesWithTrigger('after', '1-5').map((s) => s.id)).toEqual(['ch1.epi']);
    expect(scenesWithTrigger('opening').map((s) => s.id)).toEqual(['opening']);
  });

  it('every chapter has a prologue, a boss intro before X-5 and an epilogue after X-5 (T-content-5)', () => {
    for (const ch of CHAPTERS) {
      const eps = chapterScenes(ch.id);
      const finale = ch.stages[ch.stages.length - 1];
      expect(eps.some((s) => s.kind === 'mid' && s.trigger?.before === finale), `ch${ch.id} mid`).toBe(true);
      expect(eps.some((s) => s.kind === 'epilogue' && s.trigger?.after === finale), `ch${ch.id} epilogue`).toBe(true);
      if (ch.id === 1) expect(sceneById('opening')).toBeTruthy(); // chapter 1's prologue is the opening
      else expect(eps.some((s) => s.kind === 'prologue' && s.trigger?.before === ch.stages[0]), `ch${ch.id} prologue`).toBe(true);
    }
    expect(scenesWithTrigger('after', '1-2').map((s) => s.kind)).toContain('join');
    expect(scenesWithTrigger('after', '3-2').map((s) => s.kind)).toContain('join');
  });

  it('Act II of chapter 1 (Rush Hour): an opener before 1-6, a boss intro before 1-10, a closer after 1-10; all event, act 2', () => {
    const g1 = SCENE_LIST.filter((s) => s.id.startsWith('g1.'));
    expect(g1.map((s) => s.id)).toEqual(['g1.pro', 'g1.mahiru', 'g1.yuzuha', 'g1.mid', 'g1.poster', 'g1.boss', 'g1.epi']);
    for (const s of g1) expect([s.chapter, s.act, s.kind, storyRewardFor(s.kind)], s.id).toEqual([1, 2, 'event', []]);
    expect(sceneById('g1.pro').trigger).toEqual({ before: '1-6' });
    expect(sceneById('g1.boss').trigger).toEqual({ before: '1-10' });
    expect(sceneById('g1.epi').trigger).toEqual({ after: '1-10' });
    for (const s of SCENE_LIST) if (!s.id.startsWith('g')) expect(s.act, s.id).toBeUndefined();
  });

  it('exactly one content note, on the arc\'s first episode', () => {
    const noted = ALL.filter((s) => s.note);
    expect(noted.map((s) => [s.id, s.note])).toEqual([['g1.pro', 'This arc contains war and loss.']]);
  });

  it('archive order follows play order (chapter, act, stage), and chapters match their trigger stages', () => {
    const pos = (s) => {
      const t = s.trigger || {};
      const stage = t.before || t.after;
      if (!stage) return -1;
      return stageOrderKey(stage) * 2 + (t.after ? 1 : 0);
    };
    const order = SCENE_LIST.map(pos);
    for (let i = 1; i < order.length; i++) expect(order[i], SCENE_LIST[i].id).toBeGreaterThanOrEqual(order[i - 1]);
    for (const s of ALL) {
      const t = s.trigger || {};
      const stage = t.before || t.after;
      if (!stage) continue;
      expect(STAGE_MAP[stage]?.kind, `${s.id} trigger ${stage}`).toBe('campaign');
      expect(STAGE_MAP[stage].chapter, `${s.id} chapter`).toBe(s.chapter);
    }
  });

  it('every free girl joins in the text right after the stage that recruits her', () => {
    for (const [stage, ids] of Object.entries(freeUnlocksByStage())) {
      const after = scenesWithTrigger('after', stage).filter((s) => sceneAvailable(s, hasUnit));
      expect(after.length, `a scene after ${stage}`).toBeGreaterThan(0);
      const text = after.flatMap((s) => textsOf(s).map((t) => t.text)).join(' ');
      for (const id of ids) {
        expect(text, `${id} is introduced after ${stage}`).toContain(`{name:${id}}`);
        expect(after.some((s) => s.cast.includes(id)), `${id} has a portrait after ${stage}`).toBe(true);
      }
    }
  });

  it('scenes waiting for the roster merge are hidden until their girl exists', () => {
    const waiting = ALL.filter((s) => s.ifUnit);
    expect(waiting.map((s) => s.id).sort()).toEqual(['ch6.noa', 'ch7.hana']);
    for (const s of waiting) {
      expect(sceneAvailable(s, () => false)).toBe(false);
      expect(sceneAvailable(s, (id) => id === s.ifUnit)).toBe(true);
      expect(s.kind).toBe('join');
    }
  });
});

describe('story speakers, backgrounds and music (T-content-1, T-content-2)', () => {
  it('every speaker is a roster girl, an enemy NPC or a plain speaker', () => {
    for (const id of ENEMY_SPEAKERS) expect(ENEMY_MAP[id], `enemy speaker ${id}`).toBeTruthy();
    for (const sc of ALL) {
      forEachLine(sc, (l) => {
        if (l.t !== 'say') return;
        const cond = ifUnitOf(sc, l);
        if (cond && !hasUnit(cond)) return; // lands with feature/roster
        if (PLAIN_SPEAKERS.includes(l.who)) return;
        if (NPCS.includes(l.who)) { expect(ENEMY_MAP[l.who], `${sc.id}: ${l.who}`).toBeTruthy(); return; }
        expect(UNIT_MAP[l.who], `${sc.id}: unknown speaker ${l.who}`).toBeTruthy();
      });
      for (const c of sc.cast) if (!sc.ifUnit || hasUnit(sc.ifUnit)) expect(UNIT_MAP[c], `${sc.id} cast ${c}`).toBeTruthy();
    }
  });

  it('ifUnit cameos name girls the roster merge will add, and say nothing a player needs', () => {
    const future = FUTURE_NAMES.map((n) => n.toLowerCase());
    for (const sc of ALL) {
      forEachLine(sc, (l) => {
        if (!l.ifUnit) return;
        expect(future, `${sc.id}: ifUnit ${l.ifUnit}`).toContain(l.ifUnit);
        expect(l.who, `${sc.id}: an ifUnit line is spoken by its girl`).toBe(l.ifUnit);
      });
      if (sc.ifUnit) expect(future).toContain(sc.ifUnit);
    }
  });

  it('every background, stage still, music cue and sound exists', () => {
    for (const sc of ALL) {
      const bgs = [sc.bg];
      const music = sc.music ? [sc.music] : [];
      const sfx = [];
      forEachLine(sc, (l) => {
        if (l.bg) bgs.push(l.bg);
        if (l.music) music.push(l.music);
        if (l.sfx) sfx.push(l.sfx);
      });
      for (const bg of bgs) {
        expect(isBackgroundId(bg), `${sc.id}: ${bg}`).toBe(true);
        const stage = stageOfBackground(bg);
        if (stage) expect(STAGE_MAP[stage]?.kind, `${sc.id}: ${bg}`).toBe('campaign');
      }
      for (const m of music) expect(STORY_MUSIC[m], `${sc.id}: music ${m}`).toBeTruthy();
      for (const s of sfx) expect(STORY_SFX[s], `${sc.id}: sfx ${s}`).toBeTruthy();
    }
    for (const [id, bg] of Object.entries(BACKGROUNDS)) {
      if (bg.file) expect(existsSync(join(LOBBY_ART, bg.file)), `${id} file`).toBe(true);
      if (bg.thumb) expect(existsSync(join(LOBBY_ART, bg.thumb)), `${id} thumb`).toBe(true);
    }
    for (let ch = 0; ch <= CHAPTERS.length; ch++) expect(BACKGROUNDS[CHAPTER_FALLBACK_BG[ch]]?.kind, `fallback ${ch}`).toBe('paint');
  });

  it('every girl with a portrait has her drawn stand and thumb (no new art)', () => {
    for (const sc of available) {
      for (const id of sc.cast) {
        expect(existsSync(join(PORTRAITS, `${id}-cut.webp`)), `${sc.id}: ${id}-cut.webp`).toBe(true);
        expect(existsSync(join(PORTRAITS, `${id}-thumb.webp`)), `${sc.id}: ${id}-thumb.webp`).toBe(true);
      }
    }
  });

  it('backgrounds vary: no chapter uses a single background for every episode', () => {
    for (const ch of CHAPTERS) {
      const bgs = new Set();
      for (const sc of chapterScenes(ch.id)) {
        bgs.add(sc.bg);
        forEachLine(sc, (l) => { if (l.bg) bgs.add(l.bg); });
      }
      expect(bgs.size, `chapter ${ch.id} backgrounds`).toBeGreaterThanOrEqual(3);
    }
    const used = new Set();
    for (const sc of ALL) { used.add(sc.bg); forEachLine(sc, (l) => { if (l.bg) used.add(l.bg); }); }
    // a background is used by a scene, a stage's place or a chapter fallback, or is a listed spare (and then unused)
    const reached = new Set([...used, ...Object.values(STAGE_PLACE), ...Object.values(CHAPTER_FALLBACK_BG)]);
    for (const id of Object.keys(BACKGROUNDS)) {
      expect(reached.has(id) || SPARE_BACKGROUNDS.includes(id), `background ${id} is used or listed as a spare`).toBe(true);
    }
    for (const id of SPARE_BACKGROUNDS) {
      expect(BACKGROUNDS[id], `spare ${id} exists`).toBeTruthy();
      expect(reached.has(id), `spare ${id} is in use: take it off SPARE_BACKGROUNDS`).toBe(false);
    }
  });
});

describe('story text (T-content-3, T-content-4)', () => {
  it('tokens resolve and no roster name is written bare', () => {
    const nameRe = new RegExp(`\\b(${ROSTER_NAMES.join('|')})\\b`, 'i');
    for (const sc of ALL) {
      for (const { where, text, line } of textsOf(sc)) {
        const cond = ifUnitOf(sc, line);
        const problems = tokenProblems(text).filter((p) => !(cond && !hasUnit(cond) && p.includes(`:${cond}}`)));
        expect(problems, `${sc.id} ${where}: ${text}`).toEqual([]);
        for (const t of tokensIn(text)) expect(['name', 'title', 'ult', 'stage', 'chapter']).toContain(t.kind);
        const bare = stripTokens(text).match(nameRe);
        expect(bare?.[0] ?? null, `${sc.id} ${where}: bare name in "${text}"`).toBeNull();
      }
    }
  });

  it(`lines fit a phone: ≤ ${LIMITS.lineChars} characters (raw and resolved), choices ≤ ${LIMITS.choiceChars}`, () => {
    for (const sc of ALL) {
      expect(sc.title.length, `${sc.id} title`).toBeLessThanOrEqual(LIMITS.titleChars);
      for (const { where, text, choice: isChoice } of textsOf(sc)) {
        const cap = isChoice ? LIMITS.choiceChars : LIMITS.lineChars;
        expect(text.trim().length, `${sc.id} ${where}: empty`).toBeGreaterThan(0);
        expect(text.length, `${sc.id} ${where}: "${text}"`).toBeLessThanOrEqual(cap);
        expect(resolveText(text).length, `${sc.id} ${where} (resolved)`).toBeLessThanOrEqual(cap);
        expect(text, `${sc.id} ${where}: double spaces`).not.toMatch(/ {2}/);
      }
    }
  });

  it('content lint: no banned words, no ages (the war words only in Arc 1 episodes)', () => {
    const banned = new RegExp(`\\b(${BANNED.join('|')})\\b`, 'i');
    const arc0 = new RegExp(`\\b(${BANNED_ARC0.join('|')})\\b`, 'i');
    for (const sc of ALL) {
      for (const { where, text } of textsOf(sc)) {
        expect(text.match(banned)?.[0] ?? null, `${sc.id} ${where}: "${text}"`).toBeNull();
        if (!isArc1(sc)) expect(text.match(arc0)?.[0] ?? null, `${sc.id} ${where}: "${text}"`).toBeNull();
        expect(AGE_RE.test(text), `${sc.id} ${where}: age in "${text}"`).toBe(false);
      }
    }
  });

  it('the mystery holds: no "dragon" or "Matriarch" before the oni tell Momo (ch7.epi)', () => {
    const reveal = SCENE_LIST.findIndex((s) => s.id === 'ch7.epi');
    const early = [...SCENE_LIST.slice(0, reveal), ...LESSON_SCENES];
    for (const sc of early) {
      for (const { where, text } of textsOf(sc)) expect(/dragon|matriarch/i.test(text), `${sc.id} ${where}`).toBe(false);
    }
  });

  it('every clue from the bible lands in its episode', () => {
    const has = (id, needle) => textsOf(sceneById(id)).some((t) => t.text.includes(needle));
    expect(has('opening', 'wardstones')).toBe(true);
    expect(has('tut.outro', "fountain's glow is low")).toBe(true);
    expect(has('ch1.mid', 'Throne. Warm.')).toBe(true);
    expect(has('ch1.epi', 'leaned north')).toBe(true);
    expect(has('ch2.epi', "Two's a pattern")).toBe(true);
    expect(has('ch3.umeko', 'The heart keeps what it loves warm.')).toBe(true);
    expect(has('ch3.epi', 'four degrees north')).toBe(true);
    expect(has('ch4.mid', 'Big sleeper wakes up')).toBe(true);
    expect(has('ch5.pro', 'Something much, much older')).toBe(true);
    expect(has('ch5.mid', 'where is the warmth going?')).toBe(true);
    expect(has('ch5.epi', 'Ashwing Peaks')).toBe(true);
    expect(has('ch7.epi', 'Ashwing Matriarch woke')).toBe(true);
    expect(has('ch8.mid', 'writing instructions')).toBe(true);
    expect(has('ch8.epi', 'keeping her eggs warm since the fountain')).toBe(true);
    expect(has('ch8.epi', 'Sensei: CLEARED')).toBe(true);
    for (let ch = 1; ch <= 8; ch++) expect(has(`ch${ch}.epi`, 'First light'), `ch${ch}.epi relights its stone`).toBe(true);
  });
});

describe('story shape (T-content-3)', () => {
  it(`episodes run ${LIMITS.spokenMin}–${LIMITS.spokenMax} spoken lines (opening ≤ ${LIMITS.openingSpokenMax}), with and without cameos`, () => {
    for (const sc of ALL) {
      const max = sc.kind === 'opening' ? LIMITS.openingSpokenMax : LIMITS.spokenMax;
      for (const roster of [() => true, () => false]) {
        const n = spokenCount(playableLines(sc, (id) => (sc.ifUnit === id ? true : roster(id))));
        expect(n, `${sc.id} spoken lines`).toBeGreaterThanOrEqual(LIMITS.spokenMin);
        expect(n, `${sc.id} spoken lines`).toBeLessThanOrEqual(max);
      }
    }
  });

  it('at most one choice, 2–3 options, 1–2 replies, ≤ 4 portraits, ≤ 3 on stage', () => {
    for (const sc of ALL) {
      const choices = sc.lines.filter((l) => l.t === 'choice');
      expect(choices.length, `${sc.id} choices`).toBeLessThanOrEqual(LIMITS.choicesPerScene);
      for (const c of choices) {
        expect(c.options.length).toBeGreaterThanOrEqual(LIMITS.optionsMin);
        expect(c.options.length).toBeLessThanOrEqual(LIMITS.optionsMax);
        for (const o of c.options) {
          expect(Object.keys(o).sort(), `${sc.id}: choices are flavour only`).toEqual(['lines', 'text']);
          expect(o.lines.length).toBeGreaterThanOrEqual(1);
          expect(o.lines.length).toBeLessThanOrEqual(LIMITS.repliesMax);
        }
      }
      expect(sc.cast.length, `${sc.id} portraits: ${sc.cast.join(', ')}`).toBeLessThanOrEqual(LIMITS.portraitsMax);
      expect(blockingProblems(sc)).toEqual([]);
    }
  });

  it('emotes are sparing: ≤ half of the spoken lines, ≤ 1 heart, ≤ 1 ♡ and ≤ 1 "hehe" from Hikari', () => {
    for (const sc of ALL) {
      const says = sayLines(playableLines(sc, () => true));
      for (const l of says) if (l.face) expect(FACE_IDS).toContain(l.face);
      const emotes = says.filter((l) => l.face && l.face !== 'neutral').length;
      expect(emotes, `${sc.id}: ${emotes} emotes on ${says.length} lines`).toBeLessThanOrEqual(Math.ceil(says.length / 2));
      expect(says.filter((l) => l.face === 'heart').length, `${sc.id} hearts`).toBeLessThanOrEqual(LIMITS.heartsMax);
      const hikari = says.filter((l) => l.who === 'hikari').map((l) => l.text).join(' ');
      expect((hikari.match(/♡/g) || []).length, `${sc.id} ♡`).toBeLessThanOrEqual(1);
      expect((hikari.match(/\bhehe\b/gi) || []).length, `${sc.id} hehe`).toBeLessThanOrEqual(1);
    }
  });

  it('every episode opens with narration or Hikari, and Hikari speaks in it', () => {
    for (const sc of ALL) {
      const first = sc.lines.find((l) => l.t !== 'cue');
      expect(first.t === 'narrate' || (first.t === 'say' && first.who === 'hikari'), `${sc.id} opens`).toBe(true);
      expect(sayLines(sc.lines).some((l) => l.who === 'hikari'), `${sc.id}: Hikari speaks`).toBe(true);
    }
  });

  it('first-read rewards stay small (≈ 20 gems per chapter episode, none for opening, outro or lessons)', () => {
    let gems = 0;
    for (const sc of SCENE_LIST) gems += storyRewardFor(sc.kind).filter((r) => r.id === 'gems').reduce((a, r) => a + r.count, 0);
    expect(gems).toBeGreaterThan(0);
    expect(gems).toBeLessThanOrEqual(600);
    expect(storyRewardFor('opening')).toEqual([]);
    expect(storyRewardFor('outro')).toEqual([]);
    expect(storyRewardFor('lesson')).toEqual([]);
    for (const kind of Object.keys(STORY_REWARDS)) for (const r of STORY_REWARDS[kind]) expect(r.count).toBeLessThanOrEqual(20);
  });
});

describe('story bundle hygiene (T-bundle-1)', () => {
  it('nothing in src/systems imports the scene chunk; the journal data file imports nothing', () => {
    const sys = join(ROOT, 'src', 'systems');
    for (const f of readdirSync(sys).filter((n) => n.endsWith('.js'))) {
      const src = readFileSync(join(sys, f), 'utf8');
      expect(/data\/story\/(index|scenes)/.test(src), `src/systems/${f}`).toBe(false);
    }
    const lessons = readFileSync(join(ROOT, 'src', 'data', 'story', 'lessons.js'), 'utf8');
    expect(/^\s*import\s/m.test(lessons)).toBe(false);
  });
});
