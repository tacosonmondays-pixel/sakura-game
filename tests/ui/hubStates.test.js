// UI M5b: what each hub tells its host girl (src/ui/hubStates.js → src/ui/hostLines.js linesFor), walked over real
// saves: a new player, a veteran, and the moments that change the line (a login gift claimed, the week's last day).
import { describe, it, expect } from 'vitest';
import { createProfile } from '../../src/systems/save.js';
import { claimLogin } from '../../src/systems/missions.js';
import { linesFor, lineOk, lineKind } from '../../src/ui/hostLines.js';
import { missionsState, commissionsState, loginState, bountyState, assaultState, titansState } from '../../src/ui/hubStates.js';
import { veteran } from '../fixtures/veterans.js';

const first = (screen, state) => linesFor(screen, state)[0];
const allFit = (screen, state) => linesFor(screen, state).every((l) => lineOk(l, lineKind(screen)));

describe('hub host states', () => {
  it('Missions: the next stage first, then Titan Trials and the week\'s double drops once they are open', () => {
    const fresh = createProfile();
    const s0 = missionsState(fresh);
    expect(s0.titansOpen).toBe(false);
    expect(s0.doubleDrop).toBe(null);
    expect(first('missions', s0)).toMatch(/^Next up: 1-1 /);
    const late = veteran('late');
    const s1 = missionsState(late);
    expect(s1.titansOpen).toBe(true);
    expect(typeof s1.doubleDrop).toBe('string');
    const lines = linesFor('missions', s1);
    expect(lines).toContain('Titan Trials are open this week!');
    expect(lines).toContain(`Double drops in ${s1.doubleDrop}!`);
    expect(allFit('missions', s0) && allFit('missions', s1)).toBe(true);
  });

  it('Commissions: today\'s login gift on a new day; the claims ready; never "all done" while something waits', () => {
    const p = createProfile();
    const s = commissionsState(p);
    expect(s.loginReady).toBe(true);
    expect(s.allDone).toBe(false);
    expect(linesFor('commissions', s)).toContain('Today\'s login gift is waiting!');
    expect(linesFor('commissions', s)).not.toContain('All done today. Nice work!');
    expect(linesFor('commissions', { ...s, ready: 3 })[0]).toBe('3 commissions are ready!');
    expect(allFit('commissions', s)).toBe(true);
  });

  it('Login (Attendance): the gift waits, then the day is stamped', () => {
    const p = createProfile();
    const before = loginState(p);
    expect(before).toEqual({ claimable: true, day: 0 });
    expect(first('login', before)).toBe('Today\'s login gift is waiting!');
    expect(claimLogin(p).ok).toBe(true);
    const after = loginState(p);
    expect(after).toEqual({ claimable: false, day: 1 });
    expect(first('login', after)).toBe('Day 1 stamped. See you tomorrow!');
    expect(linesFor('login', after)).not.toContain('Today\'s login gift is waiting!');
  });

  it('Bounty: "last call" only on the week\'s last day', () => {
    // local time: Sunday 22:00 is two hours before the Monday reset; Wednesday noon is days away
    const sunday = new Date(2026, 9, 25, 22, 0).getTime();
    const wednesday = new Date(2026, 9, 28, 12, 0).getTime();
    expect(bountyState({ now: sunday }).endsSoon).toBe(true);
    expect(first('bounty', bountyState({ now: sunday }))).toBe('Double drops end soon. Last call!');
    expect(bountyState({ now: wednesday }).endsSoon).toBe(false);
    expect(linesFor('bounty', bountyState({ now: wednesday }))).not.toContain('Double drops end soon. Last call!');
  });

  it('Total Assault: locked for a new player, an invitation once the first boss is open', () => {
    expect(assaultState(createProfile())).toEqual({ locked: true });
    expect(first('assault', assaultState(createProfile()))).toBe('Clear more stages first, Sensei!');
    const open = assaultState(veteran('late'));
    expect(open.locked).toBe(false);
    expect(first('assault', open)).toBe('Bosses drop crowns. Shall we try?');
  });

  it('Titan Trials: locked, then the week\'s keys', () => {
    expect(titansState(createProfile())).toEqual({ locked: true });
    const p = veteran('late');
    const s = titansState(p, { now: new Date(2026, 9, 28, 12, 0).getTime() });
    expect(s.locked).toBe(false);
    expect(s.keys).toBeGreaterThan(1);
    expect(s.newWeek).toBe(true);
    expect(first('titans', s)).toBe(`${s.keys} Trial Keys this week. Ready?`);
    expect(linesFor('titans', s)).toContain('A new titan stands this week!');
    expect(first('titans', { locked: false, keys: 0, newWeek: false })).toBe('No keys left. More next week!');
  });
});
