// The Achievements tab's rows (src/ui/screens/achievements/model.js; spec §5.1): one row per series at its lowest
// unclaimed step, 143 live defs → 89 rows (28 series + 61 single), the section order, and the category counts.
import { describe, it, expect } from 'vitest';
import { createProfile } from '../../src/systems/save.js';
import { achievementList, claimAllAchievements, claimAllCount } from '../../src/systems/missions.js';
import { buildRows, sections, sortRows, categoryStats, visibleCategories, badgeText, rowState, groups, rowReward, rowProgress, readyRowCounts, PROGRESS_FIRST } from '../../src/ui/screens/achievements/model.js';
import { veteran } from '../fixtures/veterans.js';

describe('achievement rows', () => {
  it('143 defs → 89 rows: 28 series rows + 61 single rows (launch 116 → 69, + the donation series, + Codex 11 → 8, + the Act II series a_ch1_act2 → a_ch2_act2, + Tryout Day 12 → 10)', () => {
    const rows = buildRows(achievementList(createProfile()));
    expect(rows).toHaveLength(89);
    expect(rows.filter((r) => r.steps)).toHaveLength(28);
    expect(rows.filter((r) => r.cat === 'codex')).toHaveLength(8);
    expect(rows.filter((r) => r.cat === 'tryout')).toHaveLength(10);
  });

  it('a series shows its lowest unclaimed step and advances in place', () => {
    const p = createProfile();
    p.story.legacy = true; // a veteran: the box rows are open
    p.missions.counters.login = 31;
    let row = buildRows(achievementList(p)).find((r) => r.series === 'login');
    expect([row.id, row.step, row.state]).toEqual(['a_login_7', 0, 'ready']);
    p.missions.achievements.a_login_7 = true;
    row = buildRows(achievementList(p)).find((r) => r.series === 'login');
    expect([row.id, row.step, row.state]).toEqual(['a_login_30', 1, 'ready']);
    for (const id of ['a_login_30', 'a_login_100', 'a_login_365']) p.missions.achievements[id] = true;
    row = buildRows(achievementList(p)).find((r) => r.series === 'login');
    expect([row.id, row.state, row.seriesDone]).toEqual(['a_login_365', 'done', true]);
  });

  it('sort: ready (specials first) → locked → in progress by % → secrets → completed', () => {
    const r = (id, state, extra = {}) => ({ id, state, progress: 0, goal: 1, ...extra });
    const sorted = sortRows([r('done', 'done'), r('sec', 'secret'), r('p10', 'progress', { progress: 1, goal: 10 }), r('p90', 'progress', { progress: 9, goal: 10 }),
      r('lock', 'locked'), r('plain', 'ready', { honor: { cls: 'plain' } }), r('sp', 'ready', { honor: { cls: 'special' } })]);
    expect(sorted.map((x) => x.id)).toEqual(['sp', 'plain', 'lock', 'p90', 'p10', 'sec', 'done']);
    const s = sections(sorted);
    expect([s.ready.length, s.progress.length, s.done.length]).toEqual([2, 4, 1]);
  });

  it('row states, category counts and badges', () => {
    expect(rowState({ claimed: true })).toBe('done');
    expect(rowState({ claimable: true })).toBe('ready');
    expect(rowState({ met: true, locked: 'gear' })).toBe('locked');
    expect(rowState({ hidden: true, met: false })).toBe('secret');
    const list = achievementList(createProfile());
    const stats = categoryStats(list);
    expect(stats.all.total).toBe(143);
    expect([stats.campaign.total, stats.assault.total, stats.battle.total, stats.freeplay.total, stats.together.total, stats.students.total,
      stats.gear.total, stats.bestiary.total, stats.academy.total, stats.secret.total, stats.codex.total, stats.tryout.total]).toEqual([26, 15, 9, 7, 6, 20, 9, 10, 12, 6, 11, 12]);
    expect(visibleCategories(list).map((c) => c.id).at(-1)).toBe('tryout');
    expect([badgeText(3), badgeText(12)]).toEqual(['3', '9+']);
  });
});

// UI M5b (docs/specs/UI_DIRECTION.md §6.5): the condensed list
describe('achievement groups and rows (§6.5)', () => {
  const r = (id, state, extra = {}) => ({ id, state, progress: 0, goal: 10, rewards: [], ...extra });

  it('groups: Ready first, then In progress (the closest first, the rest behind "Show N more"), then Done collapsed', () => {
    const rows = [
      r('d1', 'done'), r('p1', 'progress', { progress: 1 }), r('rd', 'ready'), r('d2', 'done'),
      ...Array.from({ length: 14 }, (_, i) => r(`p${i + 2}`, 'progress', { progress: i % 10 })),
      r('lk', 'locked'), r('sc', 'secret'),
    ];
    const g = groups(rows);
    expect(g.ready.map((x) => x.id)).toEqual(['rd']);
    expect(g.progress).toHaveLength(PROGRESS_FIRST);
    expect(g.progress[0].id).toBe('lk'); // met but gated sits at the top of In progress
    expect(g.progressMore).toBe(17 - PROGRESS_FIRST);
    expect(g.done).toEqual([]); // collapsed
    expect(g.doneCount).toBe(2);
    const open = groups(rows, { progressAll: true, doneOpen: true });
    expect(open.progress).toHaveLength(17);
    expect(open.progressMore).toBe(0);
    expect(open.done.map((x) => x.id)).toEqual(['d1', 'd2']);
    // in progress: closest first
    const pcts = open.progress.filter((x) => x.state === 'progress').map((x) => x.progress / x.goal);
    expect([...pcts].sort((a, b) => b - a)).toEqual(pcts);
  });

  it('one reward per row: gems before boxes before items, the ribbon and the title only count in the stack', () => {
    expect(rowReward({ rewards: [{ id: 'gearbox_mythic', count: 1 }, { id: 'gems', count: 200 }], honor: { cls: 'plain' }, title: { text: 'X' } }))
      .toEqual({ kind: 'item', id: 'gems', amount: 200, more: 3 });
    expect(rowReward({ rewards: [{ id: 'gearbox_mythic', count: 1 }] })).toEqual({ kind: 'item', id: 'gearbox_mythic', amount: null, more: 0 }); // never "×1"
    expect(rowReward({ id: 'a_x', rewards: [], honor: { cls: 'special' }, title: { text: 'T' } })).toEqual({ kind: 'honor', id: 'a_x', amount: null, more: 1 });
    expect(rowReward({ id: 'a_y', rewards: [], title: { text: 'T' } })).toEqual({ kind: 'title', id: 'a_y', amount: null, more: 0 });
  });

  it('progress: a met row shows no bar and no "1/1" (the mock; the M5b review); nothing before the first step; n/m while under way', () => {
    expect(rowProgress(r('a', 'ready', { progress: 1, goal: 1 }))).toBe(null);
    expect(rowProgress(r('a2', 'locked', { progress: 5, goal: 5 }))).toBe(null);
    expect(rowProgress(r('b', 'progress', { progress: 0, goal: 100 }))).toEqual({ pct: 0, text: null });
    expect(rowProgress(r('c', 'progress', { progress: 412, goal: 1000 }))).toEqual({ pct: 0.412, text: '412/1,000' });
    expect(rowProgress(r('d', 'progress', { progress: 12349, goal: 50000 })).text).toBe('12.3k/50k');
    expect(rowProgress(r('e', 'secret'))).toBe(null);
    expect(rowProgress(r('f', 'done'))).toBe(null);
  });

  it('on real saves no row shows "×1" or "1/1", and every reward cell has one picture', () => {
    for (const p of [createProfile(), veteran('mid'), veteran('late')]) {
      const rows = buildRows(achievementList(p));
      for (const row of rows) {
        const rw = rowReward(row);
        expect(rw.amount === null || rw.amount > 1, row.id).toBe(true);
        const pr = rowProgress(row);
        if (pr?.text) expect(pr.text, row.id).not.toMatch(/^(\d[\d,.]*k?)\/\1$/); // never "n/n"
      }
      const g = groups(rows);
      const order = [...g.ready, ...g.progress].map((x) => x.state);
      const firstNotReady = order.findIndex((s) => s !== 'ready');
      expect(firstNotReady === -1 || order.slice(firstNotReady).every((s) => s !== 'ready')).toBe(true);
    }
  });
});

// The UI M5b review: one unit everywhere (rows ready), and Claim all claims the picked category only
describe('ready counts and the scoped Claim all', () => {
  it('readyRowCounts: the Ready header of each category, and All is their sum', () => {
    for (const p of [createProfile(), veteran('mid'), veteran('late')]) {
      const list = achievementList(p);
      const ready = readyRowCounts(list);
      for (const c of visibleCategories(list)) {
        const inCat = c.id === 'all' ? list : list.filter((a) => a.cat === c.id);
        expect(ready[c.id] || 0, c.id).toBe(groups(buildRows(inCat)).ready.length);
      }
      expect(ready.all).toBe(visibleCategories(list).filter((c) => c.id !== 'all').reduce((n, c) => n + (ready[c.id] || 0), 0));
    }
  });

  it('a late save: a series with three tiers ready is one row (the counts the review found apart now agree)', () => {
    const list = achievementList(veteran('late'));
    const ready = readyRowCounts(list);
    expect(ready.all).toBeGreaterThan(0);
    expect(categoryStats(list).all.ready).toBeGreaterThanOrEqual(ready.all); // tiers ≥ rows
  });

  it('Claim all in a category claims only that category; null or "all" claims everything', () => {
    const p = veteran('late');
    const list = achievementList(p);
    const cat = visibleCategories(list).find((c) => c.id !== 'all' && list.some((a) => a.cat === c.id && a.claimable)).id;
    const before = new Set(list.filter((a) => a.claimable && a.cat !== cat).map((a) => a.id));
    expect(claimAllCount(p, { cat })).toBeGreaterThan(0);
    const r = claimAllAchievements(p, { cat });
    expect(r.ok).toBe(true);
    expect(r.ids.every((id) => list.find((a) => a.id === id)?.cat === cat)).toBe(true);
    const after = achievementList(p);
    expect(after.filter((a) => a.cat === cat && a.claimable)).toHaveLength(0);
    for (const id of before) expect(after.find((a) => a.id === id).claimable, id).toBe(true); // the others wait
    const all = claimAllAchievements(p, { cat: 'all' });
    expect(all.ok).toBe(true);
    expect(achievementList(p).some((a) => a.claimable)).toBe(false);
  });
});
