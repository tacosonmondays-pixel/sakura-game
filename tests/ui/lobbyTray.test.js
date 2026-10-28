// UI M5d: the lobby's fold (src/ui/lobbyTray.js): Notice · Tasks · Login gift in one tray with their old test ids and
// no Buy gems (Q11: the gem pill's "+" does the same); one badge each (a red dot to claim or read wins over n/m, n/m
// hidden at 0); the sticker stack (Q12) holds at most two running things the lobby does not already show; the
// Multiplayer button's girls (Momo + Sango, owner #108) and its accessible name; and the lobby's own source keeps the
// 12-number budget's pieces in check (the Campaign label no longer repeats the chapter's progress).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { TRAY, trayItems, lobbyStickers, MULTIPLAYER_GIRLS, multiplayerLabel, STICKERS_MAX, LOBBY_NUMBERS_MAX } from '../../src/ui/lobbyTray.js';
import { UNIT_MAP } from '../../src/data/units.js';
import { canHost } from '../../src/ui/hosts.js';

describe('the lobby tray', () => {
  it('holds Notice, Tasks and Login gift, in that order, with the test ids of the shortcuts it replaced; no Buy gems', () => {
    expect(TRAY.map((t) => [t.id, t.label, t.testid])).toEqual([
      ['notice', 'Notice', 'shortcut-notice'], ['tasks', 'Tasks', 'shortcut-tasks'], ['gift', 'Login gift', 'login-claim'],
    ]);
    expect(TRAY.some((t) => /gem/i.test(t.label) || t.testid === 'shortcut-gems')).toBe(false);
  });

  it('nothing to claim: no badge at all (n/m is hidden at 0)', () => {
    const items = trayItems({ tasksDone: 0, tasksTotal: 6 });
    expect(items.map((i) => i.badge)).toEqual([null, null, null]);
    expect(items.some((i) => i.ready)).toBe(false);
  });

  it('progress shows as n/m on Tasks; a commission to claim turns it into the red dot (one badge each, P7)', () => {
    expect(trayItems({ tasksDone: 2, tasksTotal: 6 }).find((i) => i.id === 'tasks').badge).toEqual({ kind: 'prog', text: '2/6' });
    expect(trayItems({ tasksDone: 2, tasksTotal: 6, tasksClaim: true }).find((i) => i.id === 'tasks').badge).toEqual({ kind: 'dot' });
  });

  it('an unread notice and today\'s login gift wear the red dot; the gift also glows (ready)', () => {
    const items = trayItems({ noticeUnread: true, loginReady: true });
    expect(items.find((i) => i.id === 'notice').badge).toEqual({ kind: 'dot' });
    const gift = items.find((i) => i.id === 'gift');
    expect(gift.badge).toEqual({ kind: 'dot' });
    expect(gift.ready).toBe(true);
  });
});

describe('the lobby sticker stack (Q12)', () => {
  it('at most two stickers, each opening Happening Now', () => {
    const all = lobbyStickers({ limitedOnCard: true, bountyOpen: true, dropMul: 2, titansOpen: true });
    expect(all.length).toBeLessThanOrEqual(STICKERS_MAX);
    expect(STICKERS_MAX).toBe(2);
    for (const s of all) expect(s.go).toEqual({ name: 'rewards', params: { tab: 'now' } });
    expect(all.map((s) => s.text)).toEqual(['Titans open!', '2× drops']);
  });

  it('the double drops only while a limited event holds the EVENT card (the card shows them otherwise: once, P7)', () => {
    expect(lobbyStickers({ limitedOnCard: false, bountyOpen: true, titansOpen: false })).toEqual([]);
    expect(lobbyStickers({ limitedOnCard: true, bountyOpen: false, titansOpen: false })).toEqual([]);
    expect(lobbyStickers({ limitedOnCard: true, bountyOpen: true, dropMul: 3 }).map((s) => s.text)).toEqual(['3× drops']);
  });

  it('a new player (nothing open yet) sees no stickers', () => {
    expect(lobbyStickers()).toEqual([]);
  });
});

describe('the lobby\'s Multiplayer button', () => {
  it('Momo and Sango (owner #108): students with finished art', () => {
    expect([...MULTIPLAYER_GIRLS]).toEqual(['momo', 'sango']);
    for (const id of MULTIPLAYER_GIRLS) {
      expect(UNIT_MAP[id], id).toBeTruthy();
      expect(canHost(id), id).toBe(true);
    }
  });

  it('says the open invites in its accessible name', () => {
    expect(multiplayerLabel(0)).toBe('Multiplayer');
    expect(multiplayerLabel(1)).toBe('Multiplayer, 1 open invite');
    expect(multiplayerLabel(3)).toBe('Multiplayer, 3 open invites');
  });

  it('the lobby source: the tray, the Multiplayer button and its count, no Buy gems, Campaign without its "n/m"', () => {
    const src = readFileSync('src/ui/screens/lobby.js', 'utf8');
    expect(src).toContain("'data-testid': 'lobby-multiplayer'");
    expect(src).toContain("'lobby-multiplayer-count'");
    expect(src).toContain("'data-testid': 'shortcut-assault'");
    expect(src).not.toContain('shortcut-gems');
    expect(src).not.toMatch(/prog\.cleared\}\/\$\{prog\.total/);
    expect(LOBBY_NUMBERS_MAX).toBe(12);
  });
});
