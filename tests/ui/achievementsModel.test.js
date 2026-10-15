// The Achievements tab's rows (src/ui/screens/achievements/model.js; spec §5.1): one row per series at its lowest
// unclaimed step, 116 defs → 69 rows (24 series + 45 single), the section order, and the category counts.
import { describe, it, expect } from 'vitest';
import { createProfile } from '../../src/systems/save.js';
import { achievementList } from '../../src/systems/missions.js';
import { buildRows, sections, sortRows, categoryStats, visibleCategories, badgeText, rowState } from '../../src/ui/screens/achievements/model.js';

describe('achievement rows', () => {
  it('116 defs → 69 rows: 24 series rows + 45 single rows', () => {
    const rows = buildRows(achievementList(createProfile()));
    expect(rows).toHaveLength(69);
    expect(rows.filter((r) => r.steps)).toHaveLength(24);
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
    expect(stats.all.total).toBe(116);
    expect([stats.campaign.total, stats.assault.total, stats.battle.total, stats.freeplay.total, stats.together.total, stats.students.total,
      stats.gear.total, stats.bestiary.total, stats.academy.total, stats.secret.total]).toEqual([24, 15, 9, 7, 4, 20, 9, 10, 12, 6]);
    expect(visibleCategories(list).map((c) => c.id)).not.toContain('codex');
    expect([badgeText(3), badgeText(12)]).toEqual(['3', '9+']);
  });
});
