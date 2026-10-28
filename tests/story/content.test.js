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
/** Act 2 (Hilltop After Dark) is "quiet, not grim" (STORY.md §15): even the Arc 1 war words stay out of it. */
const isQuietAct = (sc) => /^g2\./.test(sc.id);
/**
 * Act 3 (The Bell Festival) is the turn, and every loss in it is told by absence only (STEP3_BUILD_PLAN decision 13,
 * STORY.md §14): no body, wound or blood words, and not even the Arc 1 death words. Ms. Hazuki is a name that gets no
 * answer; the old oni is an empty place at a cold brazier. Act 4 (The Checkpoint) keeps the same rule (STEP4_BUILD_PLAN
 * §6): a fallen trooper is "down" or an empty helmet, and the General "doesn't come back". So does Act 5 (The Drowned
 * Line, STEP5_BUILD_PLAN §6): the Register says "the reservoir, tonight", never how, and Toki is simply not there.
 */
const isAbsenceAct = (sc) => /^g[345]\./.test(sc.id);
const ABSENCE_BANNED = [
  'body', 'bodies', 'corpse', 'corpses', 'wound', 'wounds', 'wounded', 'bleed', 'bleeding', 'bled', 'blood', 'bloody',
  'injury', 'injuries', 'injured', 'bone', 'bones', 'gore', 'burns', 'scar', 'scars', 'grave', 'funeral', 'killed', 'kill',
  'die', 'died', 'dies', 'dying', 'dead', 'death', 'deaths', 'casualty', 'casualties',
];

/**
 * Main episodes of each Gate Arc act (the rest are side scenes); Hikari speaks in every one, in person or on Channel 9
 * (STORY.md §11). Kept here because every Arc 1 episode is kind `event`.
 */
const ARC1_MAIN = {
  g1: ['g1.pro', 'g1.mahiru', 'g1.yuzuha', 'g1.mid', 'g1.boss', 'g1.epi'],
  g2: ['g2.pro', 'g2.mid', 'g2.boiler', 'g2.boss', 'g2.after', 'g2.epi'],
  g3: ['g3.pro', 'g3.mid', 'g3.hammer', 'g3.boss', 'g3.after', 'g3.epi'],
  // Act 4 has no `mid`: Azami's join carries the parley, so the join is a main episode (STORY.md §11)
  g4: ['g4.pro', 'g4.azami', 'g4.cross', 'g4.boss', 'g4.after', 'g4.epi'],
  // Act 5 has no join (no free girl in Act 5, STEP5_BUILD_PLAN decision 11); Hikari is on Channel 9 in g5.raid
  g5: ['g5.pro', 'g5.mid', 'g5.raid', 'g5.boss', 'g5.after', 'g5.epi'],
};

/**
 * Planned girls who speak as story NPCs (`unknown` + a `{name:id}` plate) before their unit exists. Their token falls
 * back to the capitalised id (tokens.js resolveText), and follows the unit's name once it lands. Kohaku and Tsubaki
 * (from g5.mid) are story-only until the Kohaku & Tsubaki duo unit (STORY.md §8.7, §13).
 */
const NPC_FIRST = ['kohaku', 'tsubaki'];
/**
 * Act 5's plain-plate speakers: the Last Watch (Evening survivors) and Kohaku. None of them is a unit in Act 5. Tenka
 * speaks as herself (her unit and portrait shipped with the ultimates, v0.1.57); she still never joins in the story.
 */
const G5_PLATES = ['Toki', '{name:tsubaki}', '{name:kohaku}'];
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
    // new girls' joins (Azami 2-2, Yuzuha 4-2, Wakaba 6-5) + the Gate Arc's Act 1 (seven episodes, g1.*) and Act 2
    // (eleven episodes, g2.*) and Act 3 (nine episodes, g3.*) and Act 4 (seven episodes, g4.*) and Act 5 (nine
    // episodes, g5.*)
    expect(SCENE_LIST.length).toBe(75);
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

  it('Act II of chapter 2 (Hilltop After Dark): an opener before 2-6, a boss intro before 2-10, a closer after 2-10, six main scenes', () => {
    const g2 = SCENE_LIST.filter((s) => s.id.startsWith('g2.'));
    expect(g2.map((s) => s.id)).toEqual([
      'g2.pro', 'g2.kohaku', 'g2.thirtyone', 'g2.lunch', 'g2.mid', 'g2.boiler', 'g2.class', 'g2.roof', 'g2.boss', 'g2.after',
      'g2.epi',
    ]);
    for (const s of g2) expect([s.chapter, s.act, s.kind, storyRewardFor(s.kind)], s.id).toEqual([2, 2, 'event', []]);
    const triggers = Object.fromEntries(g2.map((s) => [s.id, s.trigger]));
    expect(triggers).toEqual({
      'g2.pro': { before: '2-6' },
      'g2.kohaku': { after: '2-6' },
      'g2.thirtyone': { after: '2-6' },
      'g2.lunch': { after: '2-7' },
      'g2.mid': { before: '2-8' },
      'g2.boiler': { after: '2-8' },
      'g2.class': { after: '2-9' },
      'g2.roof': { after: '2-9' },
      'g2.boss': { before: '2-10' },
      'g2.after': { after: '2-10' },
      'g2.epi': { after: '2-10' },
    });
    expect(ARC1_MAIN.g2).toHaveLength(6);
    for (const id of ARC1_MAIN.g2) expect(sceneById(id), id).toBeTruthy();
    // chapter 2's Act II files right after chapter 2's own episodes, before chapter 3
    const ids = SCENE_LIST.map((s) => s.id);
    expect(ids.indexOf('g2.pro')).toBe(ids.indexOf('ch2.epi') + 1);
    expect(ids.indexOf('ch3.pro')).toBe(ids.indexOf('g2.epi') + 1);
    expect(sceneById('g2.boss').lines.some((l) => l.t === 'say' && l.who === 'lizard_lamp_hugger')).toBe(true);
    expect(ENEMY_SPEAKERS).toContain('lizard_lamp_hugger');
  });

  it('Act II of chapter 3 (The Bell Festival): an opener before 3-6, a boss intro before 3-10, a closer after 3-10, six main scenes', () => {
    const g3 = SCENE_LIST.filter((s) => s.id.startsWith('g3.'));
    expect(g3.map((s) => s.id)).toEqual([
      'g3.pro', 'g3.iroha', 'g3.mid', 'g3.hammer', 'g3.noa', 'g3.boss', 'g3.after', 'g3.fuu', 'g3.epi',
    ]);
    for (const s of g3) expect([s.chapter, s.act, s.kind, storyRewardFor(s.kind)], s.id).toEqual([3, 2, 'event', []]);
    const triggers = Object.fromEntries(g3.map((s) => [s.id, s.trigger]));
    expect(triggers).toEqual({
      'g3.pro': { before: '3-6' },
      'g3.iroha': { after: '3-7' },
      'g3.mid': { before: '3-8' },
      'g3.hammer': { after: '3-8' },
      'g3.noa': { after: '3-9' },
      'g3.boss': { before: '3-10' },
      'g3.after': { after: '3-10' },
      'g3.fuu': { after: '3-10' },
      'g3.epi': { after: '3-10' },
    });
    expect(ARC1_MAIN.g3).toHaveLength(6);
    for (const id of ARC1_MAIN.g3) expect(sceneById(id).ifOwned, `${id} is a main episode`).toBeUndefined();
    // chapter 3's Act II files right after chapter 3's own episodes, before chapter 4; the act closes on the morning
    const ids = SCENE_LIST.map((s) => s.id);
    expect(ids.indexOf('g3.pro')).toBe(ids.indexOf('ch3.epi') + 1);
    expect(ids.indexOf('ch4.pro')).toBe(ids.indexOf('g3.epi') + 1);
    expect(sceneById('g3.boss').lines.some((l) => l.t === 'say' && l.who === 'ghost_ashen_warden')).toBe(true);
    expect(ENEMY_SPEAKERS).toContain('ghost_ashen_warden');
    // titles stay clear of the reserved upgrade-step name (tests/data/potential.test.js)
    for (const s of g3) expect(s.title.toLowerCase(), s.id).not.toContain('roll call');
  });

  it('Act II of chapter 4 (The Checkpoint): an opener before 4-6, Azami\'s join after 4-7, a boss intro before 4-10, a closer after 4-10', () => {
    const g4 = SCENE_LIST.filter((s) => s.id.startsWith('g4.'));
    expect(g4.map((s) => s.id)).toEqual(['g4.pro', 'g4.azami', 'g4.cross', 'g4.logs', 'g4.boss', 'g4.after', 'g4.epi']);
    for (const s of g4) expect([s.chapter, s.act, s.kind, storyRewardFor(s.kind)], s.id).toEqual([4, 2, 'event', []]);
    const triggers = Object.fromEntries(g4.map((s) => [s.id, s.trigger]));
    expect(triggers).toEqual({
      'g4.pro': { before: '4-6' },
      'g4.azami': { after: '4-7' },
      'g4.cross': { after: '4-8' },
      'g4.logs': { after: '4-8' },
      'g4.boss': { before: '4-10' },
      'g4.after': { after: '4-10' },
      'g4.epi': { after: '4-10' },
    });
    // six cutscenes, the join included (the owner's rule); g4.logs is the side scene, and nothing waits for ownership
    expect(ARC1_MAIN.g4).toHaveLength(6);
    for (const s of g4) expect(s.ifOwned, s.id).toBeUndefined();
    // chapter 4's Act II files right after chapter 4's own episodes, before chapter 5; the crossing plays before the logs
    const ids = SCENE_LIST.map((s) => s.id);
    expect(ids.indexOf('g4.pro')).toBe(ids.indexOf('ch4.epi') + 1);
    expect(ids.indexOf('ch5.pro')).toBe(ids.indexOf('g4.epi') + 1);
    expect(ids.indexOf('g4.logs')).toBe(ids.indexOf('g4.cross') + 1);
    expect(sceneById('g4.boss').lines.some((l) => l.t === 'say' && l.who === 'orc_frost_vanguard')).toBe(true);
    expect(ENEMY_SPEAKERS).toContain('orc_frost_vanguard');
    for (const s of g4) expect(s.title.toLowerCase(), s.id).not.toContain('roll call');
    // no Act 4 title repeats another archive title (ch2.azami already ships "No Running on My Road")
    const titles = SCENE_LIST.map((s) => s.title.toLowerCase());
    for (const s of g4) expect(titles.filter((t) => t === s.title.toLowerCase()), s.id).toHaveLength(1);
  });

  it('Act II of chapter 5 (The Drowned Line): six main episodes and three side scenes, no join, in play order', () => {
    const g5 = SCENE_LIST.filter((s) => s.id.startsWith('g5.'));
    expect(g5.map((s) => s.id)).toEqual([
      'g5.pro', 'g5.embers', 'g5.mid', 'g5.raid', 'g5.whiteboard', 'g5.boss', 'g5.after', 'g5.epi', 'g5.board',
    ]);
    for (const s of g5) expect([s.chapter, s.act, s.kind, storyRewardFor(s.kind)], s.id).toEqual([5, 2, 'event', []]);
    const triggers = Object.fromEntries(g5.map((s) => [s.id, s.trigger]));
    expect(triggers).toEqual({
      'g5.pro': { before: '5-6' },
      'g5.embers': { after: '5-7' },
      'g5.mid': { before: '5-8' },
      'g5.raid': { after: '5-8' },
      'g5.whiteboard': { after: '5-9' },
      'g5.boss': { before: '5-10' },
      'g5.after': { after: '5-10' },
      'g5.epi': { after: '5-10' },
      'g5.board': { after: '5-10' },
    });
    // six cutscenes and no join: the spec's join slots are 1-7, 4-7 and 7-7 only, so 5-7 recruits nobody
    expect(ARC1_MAIN.g5).toHaveLength(6);
    for (const s of g5) expect([s.ifOwned, s.ifUnit], s.id).toEqual([undefined, undefined]);
    expect(freeUnlocksByStage()['5-7']).toBeUndefined();
    // chapter 5's Act II files right after chapter 5's own episodes, before chapter 6; the three after-5-10 scenes in order
    const ids = SCENE_LIST.map((s) => s.id);
    expect(ids.indexOf('g5.pro')).toBe(ids.indexOf('ch5.epi') + 1);
    expect(ids.indexOf('ch6.pro')).toBe(ids.indexOf('g5.board') + 1);
    expect(scenesWithTrigger('after', '5-10').map((s) => s.id)).toEqual(['g5.after', 'g5.epi', 'g5.board']);
    // titles: none repeats another archive title, none carries the reserved upgrade-step name
    const titles = SCENE_LIST.map((s) => s.title.toLowerCase());
    for (const s of g5) {
      expect(s.title.toLowerCase(), s.id).not.toContain('roll call');
      expect(titles.filter((t) => t === s.title.toLowerCase()), s.id).toHaveLength(1);
    }
  });

  it('nobody joins in Act 5: Tenka, Tsubaki and Toki are story characters with plates, never units or recruits', () => {
    const g5 = ALL.filter((s) => s.id.startsWith('g5.'));
    for (const sc of g5) {
      for (const l of sayLines(sc.lines)) {
        if (G5_PLATES.includes(l.name)) expect(l.who, `${sc.id}: ${l.name} speaks as unknown`).toBe('unknown');
        expect(['toki', 'tsubaki', 'kohaku', 'mori', 'mahiru', 'kagari'], sc.id).not.toContain(l.who);
      }
      // no portrait for any of them: the only stands in Act 5 are girls the player already has
      for (const c of sc.cast) expect(['hikari', 'luna', 'kage', 'midori', 'azami', 'tenka'], `${sc.id} cast ${c}`).toContain(c);
      for (const { where, text } of textsOf(sc)) {
        expect(/\b(joins?|joined|joining|recruits?|recruited|new member)\b/i.test(text), `${sc.id} ${where}: "${text}"`).toBe(false);
      }
    }
    // the Last Watch first speak when they walk out of the Noon Gate (g5.mid)
    const firstSpeaks = (name) => g5.find((sc) => sayLines(sc.lines).some((l) => l.name === name || (name === 'tenka' && l.who === 'tenka')))?.id;
    for (const name of ['tenka', 'Toki', '{name:tsubaki}']) expect(firstSpeaks(name), name).toBe('g5.mid');
  });

  it('Azami joins the line after 4-7 in g4.azami: a meeting or a reunion reads the same, and it carries the parley', () => {
    const join = sceneById('g4.azami');
    const text = textsOf(join).map((t) => t.text).join(' ');
    expect(text).toContain('{name:azami}');
    expect(join.cast).toContain('azami');
    expect(join.ifUnit).toBeUndefined();
    // old saves already own her (the 2-2 legacy grant): nothing in the scene says she is new, or that she came back
    expect(/\b(nice to meet|new recruit|first time|welcome back|came back|long time)\b/i.test(text)).toBe(false);
    expect(text).toContain('No running in the halls — or on my road.');
    expect(text).toContain('Probably cheese before bed.');
    expect(text).toContain('fist to brow, then an open hand');
    expect(text).toContain('My mother asked the winter. The winter did not answer.');
    expect(text).toContain("We're not the winter.");
    // the same words, in one breath, from both sides of the barrier
    const both = sayLines(join.lines).filter((l) => l.text === 'Not one step further. There are children behind me.');
    expect(both.map((l) => l.name || l.who)).toEqual(['azami', 'Kagari']);
  });

  it('Hikari speaks in every main Gate Arc episode, in person or on Channel 9', () => {
    for (const ids of Object.values(ARC1_MAIN)) {
      for (const id of ids) expect(sayLines(sceneById(id).lines).some((l) => l.who === 'hikari'), `${id}: Hikari speaks`).toBe(true);
    }
    // g2.boiler is Mahiru's secret: Hikari is only a voice on the radio there
    const boiler = sayLines(sceneById('g2.boiler').lines).filter((l) => l.who === 'hikari');
    expect(boiler.length).toBeGreaterThan(0);
    for (const l of boiler) expect(l.at, 'Hikari on Channel 9').toBe('off');
  });

  it('only the side scenes wait for a girl the player owns (g2.class; g3.iroha, g3.noa, g3.fuu; none in Acts 4 and 5)', () => {
    const gated = ALL.filter((s) => s.ifOwned);
    expect(gated.map((s) => [s.id, [...s.ifOwned]])).toEqual([
      ['g2.class', ['ruri', 'iroha', 'ena', 'fuu']],
      ['g3.iroha', ['iroha']],
      ['g3.noa', ['noa']],
      ['g3.fuu', ['fuu']],
    ]);
    // a gated side scene is about its girl: she has a portrait in it
    for (const s of gated.filter((x) => x.ifOwned.length === 1)) expect(s.cast, s.id).toContain(s.ifOwned[0]);
    for (const s of gated) {
      for (const id of s.ifOwned) expect(UNIT_MAP[id], `${s.id} ifOwned ${id}`).toBeTruthy();
      expect(s.ifUnit, `${s.id}: ifOwned replaces a scene-level ifUnit`).toBeUndefined();
      expect(Object.isFrozen(s.ifOwned)).toBe(true);
    }
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
        const problems = tokenProblems(text).filter((p) => !(cond && !hasUnit(cond) && p.includes(`:${cond}}`))
          && !NPC_FIRST.some((id) => !hasUnit(id) && p.includes(`{name:${id}}`)));
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

  it('content lint: no banned words, no ages (the war words only in Arc 1 episodes, never in quiet Act 2)', () => {
    const banned = new RegExp(`\\b(${BANNED.join('|')})\\b`, 'i');
    const arc0 = new RegExp(`\\b(${BANNED_ARC0.join('|')})\\b`, 'i');
    // the scope: every gN.* episode is Arc 1 (Acts 1 to 5 so far), nothing else is
    expect(ALL.filter(isArc1).map((s) => s.id.split('.')[0]).filter((v, i, a) => a.indexOf(v) === i)).toEqual(['g1', 'g2', 'g3', 'g4', 'g5']);
    for (const sc of ALL) {
      for (const { where, text } of textsOf(sc)) {
        expect(text.match(banned)?.[0] ?? null, `${sc.id} ${where}: "${text}"`).toBeNull();
        if (!isArc1(sc) || isQuietAct(sc)) expect(text.match(arc0)?.[0] ?? null, `${sc.id} ${where}: "${text}"`).toBeNull();
        expect(AGE_RE.test(text), `${sc.id} ${where}: age in "${text}"`).toBe(false);
      }
    }
  });

  it('loss by absence in Act 3: no body, wound, blood or death words anywhere in g3; Ms. Hazuki gets no answer', () => {
    const absence = new RegExp(`\\b(${ABSENCE_BANNED.join('|')})\\b`, 'i');
    const g3 = ALL.filter((s) => s.id.startsWith('g3.'));
    expect(g3.length).toBe(9);
    for (const sc of g3) {
      for (const { where, text } of textsOf(sc)) expect(text.match(absence)?.[0] ?? null, `${sc.id} ${where}: "${text}"`).toBeNull();
    }
    // her fate is a name with no answer, a register read by Sensei and a lunch on her desk; nothing more is said
    const has = (id, needle) => textsOf(sceneById(id)).some((t) => t.text.includes(needle));
    expect(has('g3.after', 'She does not answer.')).toBe(true);
    expect(has('g3.epi', 'Present.')).toBe(true);
    expect(has('g3.epi', 'lunch on the empty desk')).toBe(true);
    // the old oni is an empty place at the brazier
    expect(has('g3.epi', 'It is empty.')).toBe(true);
    // the small winged one from g2.boiler does not appear in Act 3
    for (const sc of g3) for (const { text } of textsOf(sc)) expect(/winged|scarf/i.test(text), sc.id).toBe(false);
  });

  it('loss by absence in Act 4: no body, wound, blood or death words anywhere in g4; a helmet, a quiet channel, a bridge', () => {
    const absence = new RegExp(`\\b(${ABSENCE_BANNED.join('|')})\\b`, 'i');
    const g4 = ALL.filter((s) => s.id.startsWith('g4.'));
    expect(g4.length).toBe(7);
    expect(g4.every(isAbsenceAct)).toBe(true);
    for (const sc of g4) {
      for (const { where, text } of textsOf(sc)) expect(text.match(absence)?.[0] ?? null, `${sc.id} ${where}: "${text}"`).toBeNull();
    }
    const has = (id, needle) => textsOf(sceneById(id)).some((t) => t.text.includes(needle));
    // the fallen trooper is an empty helmet in the snow; first light has nowhere to send him
    expect(has('g4.cross', 'a white visor helmet')).toBe(true);
    expect(has('g4.cross', 'He was already home.')).toBe(true);
    // the squad's losses are a quiet channel and a roll with silences in it
    expect(has('g4.after', 'Half the channel is quiet.')).toBe(true);
    expect(has('g4.epi', 'Not every name answers.')).toBe(true);
    // the General doesn't come back, and nobody is shown falling
    expect(has('g4.after', "The General doesn't come back.")).toBe(true);
    expect(has('g4.after', 'Nobody bows back.')).toBe(true);
    // the trooper who apologises has no name (a plain plate), and is carried across
    const sorry = sayLines(sceneById('g4.after').lines).find((l) => l.text.includes('Sorry about the guns.'));
    expect([sorry.who, sorry.name]).toEqual(['unknown', 'Trooper']);
    expect(has('g4.after', "I'm sorry about mine.")).toBe(true);
  });

  it('loss by absence in Act 5: no body, wound, blood or death words in g5; the Register says "tonight", never how', () => {
    const absence = new RegExp(`\\b(${ABSENCE_BANNED.join('|')})\\b`, 'i');
    // never how: nobody drowns on screen, and nobody "vanishes", "fades away" or is "gone for good"
    const how = /\b(drown\w*|gone for good|vanish\w*|fades? away|faded|unwoven|erased)\b/i;
    const g5 = ALL.filter((s) => s.id.startsWith('g5.'));
    expect(g5.length).toBe(9);
    expect(g5.every(isAbsenceAct)).toBe(true);
    for (const sc of g5) {
      for (const { where, text } of textsOf(sc)) {
        expect(text.match(absence)?.[0] ?? null, `${sc.id} ${where}: "${text}"`).toBeNull();
        expect(text.match(how)?.[0] ?? null, `${sc.id} ${where}: "${text}"`).toBeNull();
      }
    }
    const has = (id, needle) => textsOf(sceneById(id)).some((t) => t.text.includes(needle));
    // the entry is a name, a place and a time
    expect(has('g5.boss', '"Lt. Mori. The reservoir. Tonight."')).toBe(true);
    expect(has('g5.after', 'Then we unwrite it.')).toBe(true);
    // Mori comes out of the water alive, joking about his boots
    expect(has('g5.after', 'They come up with Lt. Mori between them, coughing')).toBe(true);
    expect(sayLines(sceneById('g5.after').lines).some((l) => l.name === 'Lt. Mori' && l.text.includes('boots'))).toBe(true);
    // the small sleeping thing is an empty pipe, a scarf and a label
    expect(has('g5.raid', 'On the warmest pipe there is only the grey knitted scarf')).toBe(true);
    // two cups, not three; then a third, for the one Sensei remembers
    expect(has('g5.epi', 'There were always two of us.')).toBe(true);
    expect(has('g5.epi', 'Two cups. She does not reach for a third.')).toBe(true);
    expect(has('g5.epi', '{name:tenka} takes a third cup down from the shelf')).toBe(true);
  });

  it('Toki is not there between one line and the next: she never speaks again, and only Sensei notices', () => {
    const after = sceneById('g5.after');
    const { lines } = after;
    const last = lines.map((l) => l.t === 'say' && l.name === 'Toki').lastIndexOf(true);
    expect(last).toBeGreaterThan(0);
    expect(lines[last].text).toContain('You promised.');
    // she is whistling her four notes beside Tenka just before it
    expect(lines.slice(0, last).some((l) => l.t === 'narrate' && /\bToki\b.*whistling four notes/.test(l.text))).toBe(true);
    // no fade, no exit, no word for it: the very next line is Tenka's, then Sensei looks, and nobody else does
    const rest = lines.slice(last + 1);
    expect(rest[0]).toMatchObject({ t: 'say', who: 'tenka' });
    const restText = textsOf({ title: '', lines: rest }).map((t) => t.text);
    for (const t of restText) expect(/\bToki\b/.test(t), `g5.after after her last line: "${t}"`).toBe(false);
    expect(restText).toContain('Sensei looks at the causeway beside {name:tenka}. There is nobody there. Only the fog, the rail and the water.');
    expect(restText.some((t) => t.startsWith('Nobody else looks round.'))).toBe(true);
    // nowhere later in Act 5: no line and no plate of hers; only Sensei's telling in g5.epi says her name
    const later = SCENE_LIST.slice(SCENE_LIST.indexOf(after) + 1).filter((s) => s.id.startsWith('g5.'));
    expect(later.map((s) => s.id)).toEqual(['g5.epi', 'g5.board']);
    for (const sc of later) {
      expect(sayLines(sc.lines).some((l) => l.name === 'Toki'), sc.id).toBe(false);
      for (const t of textsOf(sc).filter((x) => /\bToki\b/.test(x.text))) expect([sc.id, t.line?.t], t.text).toEqual(['g5.epi', 'narrate']);
    }
    expect(textsOf(sceneById('g5.epi')).some((t) => t.text.startsWith('So Sensei tells them. About a small runner called Toki'))).toBe(true);
    // the tune and the promise are planted when she walks out of the gate
    expect(textsOf(sceneById('g5.mid')).some((t) => t.text === "I made that up. Senpai, promise you won't forget it?")).toBe(true);
  });

  it('the mystery holds in Act 5: no dragon or egg, "specimen" only on the crate label, no Vesperline before the Register', () => {
    const g5 = SCENE_LIST.filter((s) => s.id.startsWith('g5.'));
    const species = /\b(dragons?|wyverns?|wyrms?|drakes?|hatchlings?|eggs?|chicks?|matriarch|lizard|reptile)\b/i;
    const specimen = [];
    const wings = [];
    for (const sc of g5) {
      for (const { where, text } of textsOf(sc)) {
        expect(text.match(species)?.[0] ?? null, `${sc.id} ${where}: "${text}"`).toBeNull();
        if (/specimen/i.test(text) && where !== 'title') specimen.push([sc.id, text]);
        if (/\b(wings?|winged)\b/i.test(text)) wings.push([sc.id, text]);
      }
      // the only enemy who speaks in Act 5 is Wobble (the Reservoir Willow does not speak)
      for (const l of sayLines(sc.lines)) if (ENEMY_SPEAKERS.includes(l.who)) expect([l.who, l.name], sc.id).toEqual(['slime_droplet', 'Wobble']);
    }
    expect(specimen).toEqual([['g5.raid', 'On the floor lies a torn crate label, stencilled in Brigade amber: GRB · SPECIMEN 0.']]);
    // "grey wings" is as far as Hikari goes
    expect(wings).toEqual([['g5.epi', 'Grey wings. Follows warm things. …I made someone a promise about that little one.']]);
    // no "Vesperline" or "future" before the slate is read in g5.boss
    const reveal = g5.findIndex((s) => s.id === 'g5.boss');
    for (const sc of g5.slice(0, reveal)) {
      for (const { where, text } of textsOf(sc)) expect(/vesperline|future/i.test(text), `${sc.id} ${where}: "${text}"`).toBe(false);
    }
    const boss = textsOf(sceneById('g5.boss')).map((t) => t.text).join(' ');
    expect(boss).toContain('Vesperline.');
    expect(boss).toContain('Four hundred lived because a student held the door.');
    expect(boss).toContain('"Prior life: Itomachi."');
    expect(boss).toContain("No prior life. No thread. You're not in here at all.");
  });

  it("Kage's Door Girl list names every girl in Shelter 3 but one: never Mahiru", () => {
    const board = textsOf(sceneById('g5.board'));
    const text = board.map((t) => t.text).join(' ');
    expect(text).toContain('WHO IS THE DOOR GIRL?');
    expect(text).toContain('I will take that as a compliment.');
    const list = board.find((t) => t.text.startsWith('A long list in red:'));
    for (const id of ['azami', 'yuzuha', 'aoi', 'kohaku', 'kinu']) expect(list.text).toContain(`{name:${id}}`);
    // the board, the list and the detective never name her (she only brings the tea)
    for (const t of board) {
      if (t.line?.who === 'kage' || t === list || /DOOR GIRL|Suspect Board|register/.test(t.text)) expect(/mahiru/i.test(t.text), `g5.board: "${t.text}"`).toBe(false);
    }
  });

  it('Kagari speaks in full formal sentences: never a contraction', () => {
    const kagari = ALL.flatMap((sc) => sayLines(sc.lines).filter((l) => l.name === 'Kagari').map((l) => [sc.id, l.text]));
    expect(kagari.length).toBeGreaterThanOrEqual(5);
    for (const [id, text] of kagari) expect(/\b\w+['’](t|s|re|ll|ve|d|m)\b/i.test(text), `${id}: "${text}"`).toBe(false);
  });

  it('the mystery holds in Act 4: the thing calling over the north is never named, and the small winged one stays away', () => {
    const g4 = ALL.filter((s) => s.id.startsWith('g4.'));
    const species = /\b(dragons?|wyverns?|wyrms?|drakes?|hatchlings?|eggs?|chicks?|birds?|bats?|matriarch|specimen|lizard|reptile|winged|scarf)\b/i;
    for (const sc of g4) {
      for (const { where, text } of textsOf(sc)) expect(text.match(species)?.[0] ?? null, `${sc.id} ${where}: "${text}"`).toBeNull();
      // the only enemies who speak are the Frost Vanguard and the Orc General
      for (const l of sayLines(sc.lines)) if (ENEMY_SPEAKERS.includes(l.who)) expect(['orc_frost_vanguard', 'orc_general'], sc.id).toContain(l.who);
    }
    const cross = textsOf(sceneById('g4.cross')).map((t) => t.text).join(' ');
    expect(cross).toContain('something vast crosses the sky');
    expect(cross).toContain("Kaze won't fly. Something big is calling.");
    // Hana's line is an off-stage cameo: it plays once she exists, and the scene stands without it
    const hana = sayLines(sceneById('g4.cross').lines).find((l) => l.who === 'hana');
    expect([hana.ifUnit, hana.at]).toEqual(['hana', 'off']);
  });

  it('the mystery holds: no "dragon" or "Matriarch" before the oni tell Momo (ch7.epi)', () => {
    const reveal = SCENE_LIST.findIndex((s) => s.id === 'ch7.epi');
    const early = [...SCENE_LIST.slice(0, reveal), ...LESSON_SCENES];
    for (const sc of early) {
      for (const { where, text } of textsOf(sc)) expect(/dragon|matriarch/i.test(text), `${sc.id} ${where}`).toBe(false);
    }
  });

  it('the mystery holds in Act 2: the small winged sleeper is never named as a species and never speaks', () => {
    const g2 = SCENE_LIST.filter((s) => s.id.startsWith('g2.'));
    expect(g2.length).toBe(11);
    // STORY.md §3 / §9.2 clue 8: only "a small grey winged thing" until Act 7, never a species
    const species = /\b(dragons?|wyverns?|wyrms?|drakes?|hatchlings?|eggs?|chicks?|birds?|bats?|matriarch|specimen|lizard|reptile)\b/i;
    for (const { where, text } of textsOf(sceneById('g2.boiler'))) expect(text.match(species)?.[0] ?? null, `g2.boiler ${where}`).toBeNull();
    for (const sc of g2) {
      for (const { where, text } of textsOf(sc)) {
        expect(/dragon|matriarch|hatchling|wyvern|specimen/i.test(text), `${sc.id} ${where}: "${text}"`).toBe(false);
      }
      // it never speaks: every enemy line in Act 2 is a lizard at the lamp or Wobble
      for (const l of sayLines(sc.lines)) if (ENEMY_SPEAKERS.includes(l.who)) expect(['lizard_lamp_hugger', 'slime_droplet'], sc.id).toContain(l.who);
    }
    expect(textsOf(sceneById('g2.boiler')).some((t) => t.text.includes('small grey winged thing'))).toBe(true);
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
    // Gate Arc Act 2 (STORY.md §9.2 clues 5-10)
    expect(has('g2.kohaku', 'the most boring object in the city')).toBe(true);
    expect(has('g2.mid', 'This is Commander Yūhi. Vesperline holds.')).toBe(true);
    expect(has('g2.mid', 'The dawn is never late.')).toBe(true);
    expect(has('g2.mid', "someone who's never scared")).toBe(true);
    expect(has('g2.boiler', 'I said it was for a cat.')).toBe(true);
    expect(has('g2.boiler', 'It follows warm things.')).toBe(true);
    expect(has('g2.after', 'Prior: Itomachi, Noon')).toBe(true);
    expect(has('g2.after', 'First light')).toBe(true);
    expect(has('g2.epi', 'small Captain')).toBe(true);
    expect(has('g2.pro', 'Forty-two stitches.')).toBe(true);
    expect(has('g2.boss', 'Lamp. Mine. Handsome.')).toBe(true);
    // Gate Arc Act 3 (STORY.md §11, Act 3)
    expect(has('g3.pro', "Now we're even.")).toBe(true);
    expect(has('g3.mid', 'The tide says… wait. It has never said wait like that.')).toBe(true);
    expect(has('g3.mid', 'Little ones. Warm hands. Hold on.')).toBe(true);
    expect(has('g3.mid', "They're not angry. They're freezing.")).toBe(true);
    expect(has('g3.hammer', 'Protocol HAMMER. Saturate the gate zone.')).toBe(true);
    expect(has('g3.hammer', 'there are people on both shores!')).toBe(true);
    expect(has('g3.hammer', 'black-violet')).toBe(true);
    expect(has('g3.hammer', "Mahiru's still at the stalls.")).toBe(true);
    expect(has('g3.hammer', "Those drones are HAMMER's eyes. Ground them.")).toBe(true);
    expect(has('g3.boss', 'Halt. The shrine… fell.')).toBe(true);
    expect(has('g3.boss', "It isn't lonely. It's grieving.")).toBe(true);
    expect(has('g3.boss', "We'll keep the watch.")).toBe(true);
    expect(has('g3.after', 'First light')).toBe(true);
    expect(has('g3.after', 'Why would she come back for me?')).toBe(true);
    expect(has('g3.epi', 'Hazuki-sensei.')).toBe(true);
    expect(has('g3.epi', 'We came for warmth. You answered with fire.')).toBe(true);
    // Gate Arc Act 4 (STORY.md §11, Act 4; clues 14 and 15)
    expect(has('g4.pro', 'Citation: standing on public infrastructure.')).toBe(true);
    expect(has('g4.pro', "It's a very good booth.")).toBe(true);
    expect(has('g4.pro', 'WHO OPENED THE GATES?')).toBe(true);
    expect(has('g4.azami', 'All my life I have dreamed of snow')).toBe(true);
    expect(has('g4.azami', "It is the bow of the Ember's keepers.")).toBe(true);
    expect(has('g4.cross', 'First light')).toBe(true);
    expect(has('g4.cross', "The wolves' readings went back through the seam. His… just stopped.")).toBe(true);
    expect(has('g4.cross', 'I wrote his van a ticket on Tuesday.')).toBe(true);
    expect(has('g4.cross', 'Hold back wherever you can. Anyone who runs, let them run.')).toBe(true);
    expect(has('g4.cross', "Then it's mine. Not yours.")).toBe(true);
    expect(has('g4.logs', 'Somebody should tell her to sleep.')).toBe(true);
    expect(has('g4.boss', 'NO. MORE. GUNS.')).toBe(true);
    expect(has('g4.boss', "Then let us through, and we'll take them home.")).toBe(true);
    expect(has('g4.after', 'HONOUR!')).toBe(true);
    expect(has('g4.after', 'Protocol HAMMER.')).toBe(true);
    expect(has('g4.epi', 'HAMMER MAKES GATES??')).toBe(true);
    expect(has('g4.epi', "the General's helmet")).toBe(true);
    expect(has('g4.epi', 'Citation: Commander Kuroe.')).toBe(true);
    // Gate Arc Act 5 (STORY.md §11, Act 5; clues 16-20 and the mid-arc reveal)
    expect(has('g5.pro', "Lost already, little dawn? You're a long way from the moon.")).toBe(true);
    expect(has('g5.pro', 'rice balls')).toBe(true);
    expect(has('g5.pro', 'Channel 9. Keep it open.')).toBe(true);
    expect(has('g5.pro', 'I dream of a city burning at noon. And a door.')).toBe(true);
    expect(has('g5.pro', 'She says nothing more.')).toBe(true);
    expect(has('g5.embers', 'You bring back what your guns did not take. Why?')).toBe(true);
    expect(has('g5.embers', "Because they're cold.")).toBe(true);
    expect(has('g5.mid', "You're upstream of us, that's all. This lake is ours, later.")).toBe(true);
    expect(has('g5.mid', "They followed us. They don't know the city's gone.")).toBe(true);
    expect(has('g5.mid', '{name:tsubaki} goes white')).toBe(true);
    expect(has('g5.raid', 'GRB · SPECIMEN 0')).toBe(true);
    expect(has('g5.raid', "Mahiru? Hold on. We're coming up.")).toBe(true);
    expect(has('g5.raid', 'She taps twice over her heart.')).toBe(true);
    expect(has('g5.whiteboard', 'seventy percent!')).toBe(true);
    expect(has('g5.whiteboard', 'Seventy-three point one.')).toBe(true);
    expect(has('g5.after', 'First light')).toBe(true);
    expect(has('g5.epi', 'Stand with me means tell me. Always.')).toBe(true);
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
