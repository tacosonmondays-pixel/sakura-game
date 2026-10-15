import { describe, it, expect } from 'vitest';
import {
  levelFromXp, xpForLevel, weekKey, bossFor, rewardTier, can, validateClan, validateName, CLAN_BOSSES, LOCAL_DEV_CODE, msToWeekReset, agoText,
  autoName, validMessageMeta, bossAllowance, bossMaxHp, BOSS_FULL_RUN_SECONDS, BOSS_MIN_SECONDS,
} from '../../src/online/clanRules.js';
import { STAGE_MAP } from '../../src/data/stages.js';
import { ENEMY_MAP } from '../../src/data/enemies.js';
import { getItem } from '../../src/data/items.js';
import { BOSS_REWARDS } from '../../src/online/clanRules.js';

describe('clan rules', () => {
  it('turns XP into levels', () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(xpForLevel(1) - 1).level).toBe(1);
    expect(levelFromXp(xpForLevel(1)).level).toBe(2);
    expect(levelFromXp(xpForLevel(1) + xpForLevel(2)).level).toBe(3);
    expect(levelFromXp(1e9).level).toBe(20);
    expect(levelFromXp(1e9).pct).toBe(1);
  });

  it('computes ISO week keys (Monday start, UTC)', () => {
    expect(weekKey(new Date('2026-10-07T12:00:00Z'))).toBe('2026-W41');
    expect(weekKey(new Date('2026-01-01T00:00:00Z'))).toBe('2026-W01');
    expect(weekKey(new Date('2027-01-01T00:00:00Z'))).toBe('2026-W53');
    expect(weekKey(new Date('2024-12-30T00:00:00Z'))).toBe('2025-W01');
    expect(weekKey(new Date('2026-10-11T23:59:59Z'))).toBe('2026-W41');
    expect(weekKey(new Date('2026-10-12T00:00:00Z'))).toBe('2026-W42');
    const ms = msToWeekReset(Date.parse('2026-10-11T23:00:00Z'));
    expect(ms).toBe(3600000);
  });

  it('rotates weekly bosses over real Total Assault stages', () => {
    for (const b of CLAN_BOSSES) {
      expect(STAGE_MAP[b.stageId]?.kind).toBe('boss');
      expect(ENEMY_MAP[b.enemyId]).toBeTruthy();
    }
    expect(bossFor('2026-W41').id).not.toBe(bossFor('2026-W42').id);
    expect(bossFor('2026-W41', 3).maxHp).toBeGreaterThan(bossFor('2026-W41', 1).maxHp);
  });

  it('reward tiers and items are real', () => {
    expect(rewardTier(0, 0, true)).toBe(null);
    expect(rewardTier(5, 100, false)).toBe('C');
    expect(rewardTier(1, 100, true)).toBe('S');
    expect(rewardTier(3, 100, true)).toBe('A');
    expect(rewardTier(9, 100, true)).toBe('B');
    for (const list of Object.values(BOSS_REWARDS)) for (const r of list) expect(getItem(r.id), r.id).toBeTruthy();
  });

  it('role permissions', () => {
    expect(can('leader', 'setRole')).toBe(true);
    expect(can('officer', 'setRole')).toBe(false);
    expect(can('officer', 'answer')).toBe(true);
    expect(can('member', 'answer')).toBe(false);
    expect(can('officer', 'kick', 'member')).toBe(true);
    expect(can('officer', 'kick', 'officer')).toBe(false);
    expect(can('leader', 'kick', 'officer')).toBe(true);
    expect(can(null, 'invite')).toBe(false);
  });

  it('validates names and tags', () => {
    expect(validateClan({ name: 'Petal Guard', tag: 'PTL' })).toBe(null);
    expect(validateClan({ name: 'P', tag: 'PTL' })).toMatch(/3–20/);
    expect(validateClan({ name: 'Petal Guard', tag: 'p-t' })).toMatch(/Tags/);
    expect(validateName('Mika')).toBe(null);
    expect(validateName('M')).toMatch(/2–16/);
    expect(validateName('<b>hey</b>')).toBeTruthy();
    // no impersonation: reserved names (any case / spacing) and invisible or bidi characters
    for (const bad of ['System', 'Supply Bot', 'supply-bot', 'ADMIN', 'Sakura Dev Lab', 'Aiko\u202Eevil', 'Ai\u200Bko', 'Ai\u00ADko']) {
      expect(validateName(bad), bad).toBeTruthy();
    }
    expect(validateName('桜ミカ')).toBe(null);
    expect(autoName('local-9f3ce79a')).toMatch(/^Sensei\d{4}$/);
    expect(autoName('local-9f3ce79a')).toBe(autoName('local-9f3ce79a'));
    expect(validateName(autoName('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'))).toBe(null);
    // the offline test backend's code only: the live code is set by the owner in the database
    expect(LOCAL_DEV_CODE).toBe('LOCAL-DEV-LAB');
    expect(agoText(Date.now() - 3 * 3600 * 1000)).toBe('3 h ago');
  });

  it('bounds chat meta: nothing on text, a tiny room/stage object on invites', () => {
    expect(validMessageMeta('text', null)).toBe(true);
    expect(validMessageMeta('text', { room: 'ABCDE' })).toBe(false);
    expect(validMessageMeta('invite', { room: 'ABCDE', stage: '1-1' })).toBe(true);
    expect(validMessageMeta('invite', { room: 'ABCDE' })).toBe(true);
    expect(validMessageMeta('invite', { room: 'ABCDE', pad: 'x' })).toBe(false);
    expect(validMessageMeta('invite', { room: 'abcde' })).toBe(false);
    expect(validMessageMeta('invite', { room: 'ABCDE', stage: 'x'.repeat(17) })).toBe(false);
    expect(validMessageMeta('invite', null)).toBe(false);
  });

  it('clan boss: what one battle may count grows with its length, up to the boss cap', () => {
    for (const b of CLAN_BOSSES) {
      expect(bossAllowance(b.id, BOSS_MIN_SECONDS - 0.1)).toBe(0);
      expect(bossAllowance(b.id, BOSS_FULL_RUN_SECONDS / 2)).toBe(Math.floor(b.hitCap / 2));
      expect(bossAllowance(b.id, 3600)).toBe(b.hitCap);
      // the weekly pool takes ~3 capped hits per member (at least 2 members' worth)
      expect(bossMaxHp(1, 1, b.id)).toBe(b.hitCap * 6);
      expect(bossMaxHp(1, 10, b.id)).toBe(b.hitCap * 30);
      expect(bossMaxHp(2, 10, b.id)).toBe(Math.round(b.hitCap * 30 * 1.2));
    }
  });
});
