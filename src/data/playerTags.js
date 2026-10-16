// Player tags (owner request, 2026-10-15): DEV for the game's team, ALPHA / BETA for the testers.
// The server's public.player_tags table is the only source of who has which tag
// (supabase/migrations/20261017000000_player_tags.sql); this file is the client's vocabulary for
// them: chip text, the words screen readers say, the title each tag unlocks and the
// missions.counters mark a player's own save keeps once it learned the tag.

/** Chip order everywhere: DEV beats ALPHA beats BETA (a tight place shows only the first). */
export const TAG_KINDS = Object.freeze(['dev', 'alpha', 'beta']);

/** kind → { chip: the text on the chip, label: aria-label / tooltip, title: TITLES id, mark: missions.counters key } */
export const TAG_INFO = Object.freeze({
  dev: Object.freeze({ chip: 'DEV', label: 'Developer', title: 'tag_dev', mark: 'tag:dev' }),
  alpha: Object.freeze({ chip: 'ALPHA', label: 'Alpha Tester', title: 'tag_alpha', mark: 'tag:alpha' }),
  beta: Object.freeze({ chip: 'BETA', label: 'Beta Tester', title: 'tag_beta', mark: 'tag:beta' }),
});

/**
 * The three tag titles (src/data/honors.js puts them in TITLES). Owned only while the save holds
 * the tag's mark; listed only when owned; never counted in an "out of N" for anyone else.
 */
export const TAG_TITLE_ROWS = Object.freeze([
  Object.freeze({ id: 'tag_dev', tag: 'dev', name: 'Developer', plate: 'prism', how: 'On the Sakura Sentinels team.' }),
  Object.freeze({ id: 'tag_alpha', tag: 'alpha', name: 'Alpha Tester', plate: 'prism', how: 'Played Sakura Sentinels during the alpha.' }),
  Object.freeze({ id: 'tag_beta', tag: 'beta', name: 'Beta Tester', plate: 'gold', how: 'Joined Sakura Sentinels during the beta.' }),
]);

/** title id → tag kind ('tag_dev' → 'dev'), for the tag titles only. */
export const TAG_OF_TITLE = Object.freeze(Object.fromEntries(TAG_TITLE_ROWS.map((t) => [t.id, t.tag])));

/** Is this title id one of the tag titles? */
export const isTagTitle = (id) => typeof id === 'string' && Object.prototype.hasOwnProperty.call(TAG_OF_TITLE, id);

/** The tag kinds a save's missions.counters marks hold (its own tags, as it last learned them). */
export function markedTags(p) {
  const c = p?.missions?.counters;
  if (c == null || typeof c !== 'object') return [];
  return TAG_KINDS.filter((k) => Number(c[TAG_INFO[k].mark]) > 0);
}
