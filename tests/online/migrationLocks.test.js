// The owner pastes each migration into the SQL Editor while players play. A file that changes or points
// at a live table must first take ALL of them in one quiet moment (one `lock table … nowait` statement,
// retried, before anything is created): taking them one by one, as each statement needs it, can meet a
// player's request that holds one and waits for another ("deadlock detected"). The social file set the
// pattern; this checks the files after it.
import { describe, it, expect } from 'vitest';
import { MIGRATION_FILES, migrationText } from './pgHarness.js';

/** The files that must start with the quiet moment (every file after the social one that touches a live table). */
const FILES = ['20261013000000_social.sql', '20261016000000_profile.sql', '20261017000000_player_tags.sql', '20261018000000_clan_invites.sql'];

/** Live tables a file changes or points at: foreign keys, triggers, ALTER TABLE (not the tables it creates itself). */
function touched(sql) {
  const own = new Set([...sql.matchAll(/create table if not exists public\.(\w+)/g)].map((m) => m[1]));
  const names = [
    ...sql.matchAll(/references public\.(\w+)/g),
    ...sql.matchAll(/trigger (?:if exists )?\w+ (?:[\w ]+? )?on public\.(\w+)/g),
    ...sql.matchAll(/alter table public\.(\w+)/g),
  ].map((m) => m[1]);
  return [...new Set(names)].filter((t) => !own.has(t)).sort();
}

/** The tables of the quiet-moment lock (one statement), or null. */
function quietLock(sql) {
  const m = sql.match(/lock table ([^;']+?) in access exclusive mode nowait/);
  if (m) return m[1].split(',').map((t) => t.trim().replace(/^public\./, '')).sort();
  // the social file builds its list from the tables that exist
  const list = sql.match(/from unnest\(array\[([^\]]+)\]\) t\s+where to_regclass/);
  return list ? [...list[1].matchAll(/'(\w+)'/g)].map((x) => x[1]).sort() : null;
}

describe('migrations: one quiet moment before touching live tables', () => {
  it('covers every file after the social one that touches a live table', () => {
    for (const f of MIGRATION_FILES.filter((x) => x >= '20261013000000')) {
      if (touched(migrationText(f)).length && !FILES.includes(f)) {
        // a small file that only swaps a constraint or a function may skip it: say so here when adding one
        expect(['20261015000000_social_open_friends.sql'], `${f} touches live tables: give it the quiet moment and list it in FILES`).toContain(f);
      }
    }
  });

  for (const f of FILES) {
    it(`${f}: locks every live table it touches, in one nowait statement, before anything else`, () => {
      const sql = migrationText(f);
      const locked = quietLock(sql);
      expect(locked, `${f} has no quiet-moment lock`).toBeTruthy();
      for (const t of touched(sql)) expect(locked, `${f} touches public.${t}`).toContain(t);
      const at = sql.search(/lock table |execute 'lock table '/);
      expect(at).toBeGreaterThan(sql.indexOf('begin;'));
      expect(at).toBeLessThan(sql.search(/\bcreate (table|or replace|trigger|policy|index)/));
      expect(sql.match(/lock table /g)).toHaveLength(1); // one statement: all at once, or wait and try again
      expect(sql).toMatch(/for i in 1\.\.600 loop[\s\S]*?exception when lock_not_available then\s+perform pg_sleep\(0\.05\);/);
      expect(sql).toContain('The game is busy right now, so nothing was changed. Press Run again in a minute.');
    });
  }

  it('the tables each file locks', () => {
    expect(quietLock(migrationText('20261016000000_profile.sql'))).toEqual(['profiles', 'reports']);
    expect(quietLock(migrationText('20261017000000_player_tags.sql'))).toEqual(['clan_members', 'clans', 'profiles']);
    expect(quietLock(migrationText('20261018000000_clan_invites.sql'))).toEqual(['clans', 'messages', 'profiles']);
  });
});
