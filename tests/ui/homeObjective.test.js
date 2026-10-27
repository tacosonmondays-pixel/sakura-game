// [ui-ink] UI v2 V2: the home's objective (src/ui/lobbyTray.js homeObjective; notes/ui-v2/UI_V2_DIRECTION.md 12.1, the
// build plan's C12): the home's one yellow, its play tile. First match wins: a saved battle > today's login gift >
// commissions to claim > an event phase that asks for the player > the next story stage > medals. The play tile
// carries the old hooks of the jobs it took over (lobby-continue, login-claim). And the home's source keeps its hooks.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { homeObjective, OBJECTIVE_ORDER, eventAsks, multiplayerLabel } from '../../src/ui/lobbyTray.js';

const HOUR = 3600e3;
const ALL = {
  save: { name: 'Grave Lych', mode: 'Total Assault', wave: 4 },
  login: { ready: true, day: 3 },
  commissions: { count: 2 },
  event: { name: 'Pumpkin Lantern Night', phase: 'exchange', msLeft: 30 * HOUR },
  next: { id: '4-4', name: 'Howl of the Alpha' },
  chapter: { id: 4, name: 'Ironhold Pass' },
};
const without = (...keys) => Object.fromEntries(Object.entries(ALL).filter(([k]) => !keys.includes(k)));

describe('the home objective', () => {
  it('tries its sources in the designed order', () => {
    expect([...OBJECTIVE_ORDER]).toEqual(['continue', 'login', 'commissions', 'event', 'stage', 'medals']);
  });

  it('first match wins, all the way down the order', () => {
    expect(homeObjective(ALL).kind).toBe('continue');
    expect(homeObjective(without('save')).kind).toBe('login');
    expect(homeObjective(without('save', 'login')).kind).toBe('commissions');
    expect(homeObjective(without('save', 'login', 'commissions')).kind).toBe('event');
    expect(homeObjective(without('save', 'login', 'commissions', 'event')).kind).toBe('stage');
    expect(homeObjective(without('save', 'login', 'commissions', 'event', 'next')).kind).toBe('medals');
    expect(homeObjective({}).kind).toBe('medals');
  });

  it('the saved battle: its name, mode and wave; the play tile keeps the old Continue chip\'s hook', () => {
    const o = homeObjective(ALL);
    expect(o).toMatchObject({ kicker: 'Continue', text: 'Grave Lych · Total Assault · Wave 4', testid: 'lobby-continue' });
    expect(homeObjective({ save: { name: '1-1 Petal Path' } }).text).toBe('1-1 Petal Path');
  });

  it('the login gift: its day, and the play tile keeps the tray\'s hook (login-claim); a claimed gift is skipped', () => {
    expect(homeObjective(without('save'))).toMatchObject({ kicker: 'Daily gift', text: 'Claim your login gift: day 3', testid: 'login-claim' });
    expect(homeObjective({ ...without('save'), login: { ready: false, day: 3 } }).kind).toBe('commissions');
  });

  it('commissions: the count to collect; achievements alone say so; zero is skipped', () => {
    const base = without('save', 'login');
    expect(homeObjective(base).text).toBe('Collect 2 commissions');
    expect(homeObjective({ ...base, commissions: { count: 1 } }).text).toBe('Collect 1 commission');
    expect(homeObjective({ ...base, commissions: { count: 3, achOnly: true } }).text).toBe('Collect 3 achievements');
    expect(homeObjective({ ...base, commissions: { count: 0 } }).kind).toBe('event');
    expect(homeObjective(base).testid).toBeNull();
  });

  it('an event phase asks for the player: its exchange is open, or its last day; otherwise it is the news card\'s', () => {
    expect(eventAsks({ phase: 'exchange', msLeft: 80 * HOUR })).toBe(true);
    expect(eventAsks({ phase: 'active', msLeft: 20 * HOUR })).toBe(true);
    expect(eventAsks({ phase: 'active', msLeft: 30 * HOUR })).toBe(false);
    expect(eventAsks({ phase: 'upcoming', msLeft: 2 * HOUR })).toBe(false);
    expect(eventAsks({ phase: 'ended' })).toBe(false);
    expect(eventAsks(null)).toBe(false);
    const base = without('save', 'login', 'commissions');
    expect(homeObjective(base).text).toBe('Pumpkin Lantern Night: exchange open');
    expect(homeObjective({ ...base, event: { name: 'Pumpkin Lantern Night', phase: 'active', msLeft: 5 * HOUR } }).text).toBe('Last day: Pumpkin Lantern Night');
    expect(homeObjective({ ...base, event: { name: 'Pumpkin Lantern Night', phase: 'active', msLeft: 240 * HOUR } }).kind).toBe('stage');
  });

  it('the next story stage, as the mock-up writes it, then the medals of the last chapter', () => {
    expect(homeObjective(without('save', 'login', 'commissions', 'event'))).toMatchObject({ kicker: 'Next', text: 'Clear 4-4 Howl of the Alpha' });
    expect(homeObjective({ chapter: { id: 8, name: 'Ashwing Peaks' } }).text).toBe('Chase medals in Ch.8');
  });

  it('every objective is one line of words with at most one number in it (the home\'s budget of 10)', () => {
    const states = [ALL, without('save'), without('save', 'login'), without('save', 'login', 'commissions'), without('save', 'login', 'commissions', 'event'), {}];
    for (const s of states) {
      const o = homeObjective(s);
      expect(o.text.length, o.text).toBeLessThanOrEqual(44);
      expect((o.text.match(/\d+(?:-\d+)?/g) || []).length, o.text).toBeLessThanOrEqual(1);
    }
  });
});

describe('the Multiplayer row', () => {
  it('says the open invites in its accessible name', () => {
    expect(multiplayerLabel(0)).toBe('Multiplayer');
    expect(multiplayerLabel(1)).toBe('Multiplayer, 1 open invite');
    expect(multiplayerLabel(3)).toBe('Multiplayer, 3 open invites');
  });
});

describe('the home\'s source (C12: the hooks stay, the folded parts go)', () => {
  // (home layout B: Clan, hide the UI and the background moved into the menu sheet, whose rows and head hold them)
  const src = readFileSync('src/ui/screens/lobby.js', 'utf8') + readFileSync('src/ui/lobby/menuSheet.js', 'utf8');
  it('keeps the hooks the e2e use, on the elements that do those jobs now', () => {
    for (const id of ['tile-mission', 'dock-students', 'dock-recruit', 'dock-commissions', 'dock-clan', 'dock-mall', 'lobby-multiplayer', 'lobby-multiplayer-count',
      'lobby-objective', 'lobby-news', 'lobby-chapter', 'top-mail', 'top-menu', 'account-level', 'tickets', 'coins', 'gems', 'lobby-hide', 'lobby-bg', 'lobby-restore', 'campaign-open']) {
      expect(src, id).toContain(`'${id}'`);
    }
  });
  it('the tray, the stickers, the Assault shortcut, the clock and the secretary chevrons are gone', () => {
    for (const id of ['lobby-tray', 'lobby-sticker', 'shortcut-assault', 'shortcut-tasks', 'lobby-clock', 'secretary-prev', 'secretary-next', 'menuTabModal']) expect(src, id).not.toContain(id);
  });
  it('the menu is the side sheet; the Notice row keeps the tray\'s hook', () => {
    expect(src).toContain('openMenuSheet');
    expect(readFileSync('src/ui/lobby/menuSheet.js', 'utf8')).toContain("testid: 'shortcut-notice'");
  });
});
