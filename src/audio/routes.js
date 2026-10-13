// Pure tables: route → music, map theme → battle family, boss → track, preload graph (docs/AUDIO.md §3.4, §3.6).
// Track ids are the design ids; tracks that are not rendered yet resolve to stand-ins via the manifest.

export const MENU_ROUTES = ['students', 'student', 'formation', 'backpack', 'bestiary', 'wiki', 'commissions', 'rewards'];
export const MAP_ROUTES = ['missions', 'campaign', 'bounty', 'assault', 'challenge', 'coop'];

/** Map theme (src/data/maps.js) → battle family track. */
export const THEME_FAMILY = {
  sakura: 'blossom',
  arena: 'blossom',
  lake: 'moonlit',
  snow: 'moonlit',
  night: 'moonlit',
  shrine: 'lantern',
  marsh: 'lantern',
  mountain: 'ironclock',
  foundry: 'ironclock',
  festival: 'matsuri',
  volcano: 'matsuri',
};
export const FAMILIES = ['blossom', 'moonlit', 'lantern', 'ironclock', 'matsuri'];

/** Boss enemy id → boss track; minibosses get a stinger only. */
export const BOSS_TRACK = { dragon_ashwing: 'final', grave_lych: 'boss', iron_colossus: 'boss' };

export function familyForTheme(theme) {
  return THEME_FAMILY[theme] || 'blossom';
}

export function battleTrack(theme) {
  return `battle_${familyForTheme(theme)}`;
}

export function waveSting(theme, final = false) {
  return final ? 'final_wave' : `wave_${familyForTheme(theme)}`;
}

export function bossTrackFor(enemyId) {
  return BOSS_TRACK[enemyId] || 'boss';
}

/**
 * What the music should do on a route.
 * @returns {{ track: string, stems: object } | { keep: true, fallback?: object } | { battle: true }}
 */
export function musicForRoute(name) {
  switch (name) {
    case 'title':
      return { track: 'title', stems: { full: 1 } };
    case 'lobby':
      return { track: 'homeroom', stems: { base: 1, melody: 1 } };
    case 'settings':
    case 'soundtest':
      return { keep: true, fallback: { track: 'homeroom', stems: { base: 1, melody: 0 } } };
    case 'stage':
      return { track: 'march', stems: { base: 1, prep: 1 } };
    case 'recruit':
      return { track: 'wishing', stems: { base: 1, riser: 0 } };
    case 'mall':
      return { track: 'mall', stems: { full: 1 } };
    case 'battle':
      return { battle: true };
    default:
      if (MENU_ROUTES.includes(name)) return { track: 'homeroom', stems: { base: 1, melody: 0 } };
      if (MAP_ROUTES.includes(name)) return { track: 'march', stems: { base: 1, prep: 0 } };
      return { keep: true };
  }
}

/** Next likely tracks per route (fetch bytes early; `decode` = also decode). */
export function preloadFor(name) {
  switch (name) {
    case 'title':
      return [{ track: 'homeroom', decode: true }];
    case 'lobby':
      return [{ track: 'march' }, { track: 'wishing' }];
    case 'recruit':
      return [{ track: 'gacha_r', decode: true }, { track: 'gacha_sr', decode: true }, { track: 'gacha_ssr', decode: true }, { track: 'new_student' }];
    default:
      if (MAP_ROUTES.includes(name)) return [{ track: 'battle_blossom' }];
      return [];
  }
}

/** Battle preloads once the stage is known (stage prep / battle mount). */
export function battlePreloads(theme, { hasBoss = false, bossId = null } = {}) {
  const out = [
    { track: battleTrack(theme), decode: true },
    { track: waveSting(theme), decode: true },
    { track: 'final_wave', decode: true },
    { track: 'victory', decode: true },
    { track: 'defeat', decode: true },
    { track: 'results_win' },
    { track: 'results_lose' },
  ];
  if (hasBoss) out.push({ track: bossTrackFor(bossId) }, { track: 'boss_warning', decode: true });
  return out;
}
