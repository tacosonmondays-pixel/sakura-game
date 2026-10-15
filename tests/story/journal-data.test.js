// Captain's Journal data, tutorial coach copy and journal strings (STORY_SPEC §2.3, §3; BIBLE §8.2).
// Pure data checks; the journal logic (unlocking, claiming, the welcome-mail rule) is tested with
// src/systems/story.js.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import {
  LESSONS, LESSON_IDS, LESSON_MAP, FEATURE_GATES, WELCOME_MAIL, JOURNAL_TEXT,
} from '../../src/data/story/lessons.js';
import { COACH_STEPS, COACH_STEP_IDS, TUTORIAL_TEXT } from '../../src/data/story/tutorial.js';
import { SCENES } from '../../src/data/story/index.js';
import { LIMITS } from '../../src/data/story/format.js';
import { resolveText, tokenProblems } from '../../src/data/story/tokens.js';
import { UNITS, UNIT_MAP } from '../../src/data/units.js';
import { CAMPAIGN_IDS, STAGE_MAP } from '../../src/data/stages.js';
import { ITEMS } from '../../src/data/items.js';
import { LOBBY_ICON_NAMES } from '../../src/art/lobbyIcons.js';
import { UI_ICON_NAMES } from '../../src/art/icons.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROUTES = [...readFileSync(join(ROOT, 'src', 'main.js'), 'utf8').matchAll(/registerRoute\('([a-z]+)'/g)].map((m) => m[1]);
const STUDENT_TABS = ['info', 'level', 'awaken', 'gear', 'tree'];
const NAMES = [...new Set([...UNITS.map((u) => u.name), 'Kanna', 'Yoriko', 'Seiran', 'Fuu', 'Hana', 'Ruri', 'Noa', 'Tsubaki', 'Kohaku', 'Iroha', 'Ena'])];
const BARE = new RegExp(`\\b(${NAMES.join('|')})\\b`, 'i');
const BANNED = /\b(date|dating|kiss|crush|flirt|romance|romantic|sexy|bikini|swimsuit|lingerie|boyfriend|girlfriend|marry|wife|husband|blush|breast|thigh|waifu)\b/i;

function lintText(text, where) {
  expect(tokenProblems(text), `${where}: ${text}`).toEqual([]);
  expect(text.replace(/\{[a-z]+:[^{}\s]+\}/g, '').match(BARE)?.[0] ?? null, `${where}: bare name in "${text}"`).toBeNull();
  expect(BANNED.test(text), `${where}: banned word in "${text}"`).toBe(false);
  expect(text, `${where}`).toBe(text.trim());
  expect(text).not.toMatch(/ {2}/);
}

const stageIndex = (l) => (l.unlock.tutorial ? -1 : CAMPAIGN_IDS.indexOf(l.unlock.stage));

describe("Captain's Journal lessons", () => {
  it('has the 12 lessons in order, with unique ids mapped from the old game', () => {
    expect(LESSONS).toHaveLength(12);
    expect(LESSON_IDS).toEqual(['home', 'bestiary', 'formation', 'recruit', 'levelup', 'paths', 'bounty', 'gear', 'commissions', 'challenge', 'awaken', 'assault']);
    expect(new Set(LESSON_IDS).size).toBe(12);
    expect(new Set(LESSONS.map((l) => l.oldId)).size).toBe(12);
    for (const l of LESSONS) expect(LESSON_MAP[l.id]).toBe(l);
  });

  it('unlocks on the tutorial or a campaign stage, never earlier than the lesson before it', () => {
    expect(LESSONS[0].unlock).toEqual({ tutorial: true });
    for (let i = 0; i < LESSONS.length; i++) {
      const l = LESSONS[i];
      if (!l.unlock.tutorial) expect(STAGE_MAP[l.unlock.stage]?.kind, `${l.id} unlock`).toBe('campaign');
      if (i > 0) expect(stageIndex(l), `${l.id} order`).toBeGreaterThanOrEqual(stageIndex(LESSONS[i - 1]));
    }
    // the existing stage gates the journal teaches (Bounty 1-5, Challenge 2-5, Total Assault 5-5)
    expect(LESSON_MAP.bounty.unlock.stage).toBe('1-5');
    expect(LESSON_MAP.challenge.unlock.stage).toBe('2-5');
    expect(LESSON_MAP.assault.unlock.stage).toBe('5-5');
    expect(LESSON_MAP.recruit.unlock.stage).toBe('1-3');
  });

  it('"Show me" goes to a registered route with valid params', () => {
    for (const l of LESSONS) {
      expect(ROUTES, `${l.id} route`).toContain(l.action.route);
      expect(l.action.label).toBeTruthy();
      if (l.action.route === 'student') {
        expect(l.action.params.id === '@secretary' || !!UNIT_MAP[l.action.params.id], `${l.id} student id`).toBe(true);
        expect(STUDENT_TABS).toContain(l.action.params.tab);
      }
    }
  });

  it('rewards are real items, small, and the 10× ticket only comes by mail', () => {
    let gems = 0;
    for (const l of LESSONS) {
      expect(l.rewards.length, l.id).toBeGreaterThan(0);
      for (const r of l.rewards) {
        expect(ITEMS[r.id], `${l.id}: ${r.id}`).toBeTruthy();
        expect(Number.isInteger(r.count) && r.count > 0).toBe(true);
        if (r.id === 'gems') { expect(r.count).toBeLessThanOrEqual(100); gems += r.count; }
      }
    }
    expect(gems).toBeLessThanOrEqual(600);
    const ten = LESSONS.filter((l) => l.rewards.some((r) => r.id === 'ticket_recruit10'));
    expect(ten.map((l) => l.id)).toEqual(['recruit']);
    expect(LESSON_MAP.recruit.via).toBe('mail');
    expect(WELCOME_MAIL.id).toBe('story-welcome-10pull');
    expect(WELCOME_MAIL.rewards).toEqual([{ id: 'ticket_recruit10', count: 1 }]);
    expect(LESSON_MAP.recruit.rewards).toEqual(WELCOME_MAIL.rewards);
  });

  it('feature gates match their lessons (Equipment at 2-1, Awakening at 3-2)', () => {
    expect(Object.keys(FEATURE_GATES).sort()).toEqual(['awaken', 'gear']);
    for (const [feature, gate] of Object.entries(FEATURE_GATES)) {
      expect(LESSON_MAP[gate.lesson].unlock.stage, feature).toBe(gate.stage);
      expect(LESSON_MAP[gate.lesson].gate).toBe(feature);
    }
    expect(LESSONS.filter((l) => l.gate).map((l) => l.id).sort()).toEqual(['awaken', 'gear']);
    expect(LESSON_MAP.recruit.gate).toBeNull(); // Recruit is never gated (beta-gift tickets must stay usable)
  });

  it('icons exist and mini-scenes point back at their lesson', () => {
    for (const l of LESSONS) {
      expect([...LOBBY_ICON_NAMES, ...UI_ICON_NAMES], `${l.id} icon`).toContain(l.icon);
      if (l.scene) {
        expect(SCENES[l.scene], `${l.id} scene`).toBeTruthy();
        expect(SCENES[l.scene].trigger).toEqual({ lesson: l.id });
      }
    }
  });

  it("text is Hikari's: short paragraphs, tokens resolve, no bare names, lint-clean", () => {
    for (const l of LESSONS) {
      expect(l.title.length, `${l.id} title`).toBeLessThanOrEqual(40);
      lintText(l.title, `${l.id} title`);
      expect(l.body.length, `${l.id} paragraphs`).toBeGreaterThanOrEqual(1);
      expect(l.body.length, `${l.id} paragraphs`).toBeLessThanOrEqual(3);
      for (const p of l.body) {
        expect(p.length, `${l.id}: "${p}"`).toBeLessThanOrEqual(120);
        lintText(p, l.id);
      }
    }
    expect(LESSON_MAP.formation.body.join(' ')).toContain('{name:yuki}');
  });
});

describe('tutorial coach copy', () => {
  it('has every coach step in order', () => {
    expect(COACH_STEP_IDS).toEqual(['place', 'start', 'hero', 'upgrade', 'speed', 'ult', 'free', 'lost']);
  });

  it(`bubbles fit a phone (≤ ${LIMITS.lineChars} characters), resolve, and spend one ♡ in total`, () => {
    let hearts = 0;
    for (const s of COACH_STEPS) {
      for (const text of [s.title, s.body]) {
        expect(text.length, `${s.id}: "${text}"`).toBeLessThanOrEqual(LIMITS.lineChars);
        expect(resolveText(text).length).toBeLessThanOrEqual(LIMITS.lineChars);
        lintText(text, `coach ${s.id}`);
        hearts += (text.match(/♡/g) || []).length;
      }
    }
    expect(hearts).toBe(1);
    expect(resolveText(COACH_STEPS.find((s) => s.id === 'ult').body)).toContain(UNIT_MAP.hikari.hero.ult.name);
    for (const [k, text] of Object.entries(TUTORIAL_TEXT)) {
      expect(text.length, k).toBeLessThanOrEqual(LIMITS.lineChars);
      lintText(text, `tutorial ${k}`);
    }
  });
});

describe('journal strings and the welcome mail', () => {
  it('resolve through the token helper with no bare names', () => {
    const strings = {
      ...Object.fromEntries(Object.entries(JOURNAL_TEXT).filter(([, v]) => typeof v === 'string')),
      requirement: JOURNAL_TEXT.requirement('2-1'),
      toastOne: JOURNAL_TEXT.toastOne(LESSON_MAP.gear.title),
      toastMany: JOURNAL_TEXT.toastMany(2),
      legacyAnnounce: JOURNAL_TEXT.legacyAnnounce(12),
      lockGear: JOURNAL_TEXT.lockText('gear'),
      lockAwaken: JOURNAL_TEXT.lockText('awaken'),
      lockButton: JOURNAL_TEXT.lockButton('3-2'),
      mailFrom: WELCOME_MAIL.from,
      mailTitle: WELCOME_MAIL.title,
      mailBody: WELCOME_MAIL.body,
    };
    for (const [k, text] of Object.entries(strings)) lintText(text, k);
    expect(resolveText(strings.lockGear)).toBe(`Equipment unlocks after 2-1 ${STAGE_MAP['2-1'].name} — Hikari will teach you!`);
    expect(resolveText(strings.toastOne)).toBe('Hikari has a new lesson ♡ — Dress for the adventure');
    expect(resolveText(WELCOME_MAIL.from)).toBe('Hikari');
  });
});
