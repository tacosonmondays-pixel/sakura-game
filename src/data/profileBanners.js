// More Sensei Profile banners (docs/specs/PROFILE_BANNERS.md): 20 banners with ids 'pb:<slug>', appended to
// BANNERS in ./profileArt.js. Plain data, no side effects; kept in its own file so other cosmetics branches merge
// cleanly. The server's card rules already accept any 'kind:slug' banner id (valid_profile_card, BANNER_RE), so no
// SQL paste is needed; an older build shows an unknown id as the default banner.
//
// Art: `file` is a painted place of the game's own (public/art/lobby/…), drawn like the other banners; `svg` names a
// procedural pattern in src/ui/profile/pbArt.js. `slot` marks a banner whose picture can later be replaced by an
// owner-made illustration (prompts in docs/specs/PROFILE_BANNERS.md §5); its current art stays until then. `lock`
// replaces the picker's generated lock line where that would be too long.
//
// Unlocks (src/systems/profileBanners.js) are read from what the save already holds, so a player who qualifies
// has the banner at once and nothing is granted or stored:
//   ach     an achievement claimed (missions.achievements[id] === true)
//   event   any operation of that limited event cleared (its stage progress)
//   lr      any LR unit past Limit Break (the 'lr:<unit>' marks)
//   season  logged in during that season (the 'pbs:<season>' mark, set at the daily rollover; Central time)
//
// Order is the picker's order (after the 14 older banners). Append only: an id is never renamed or reused.

const story = (slug) => ({ file: `story/${slug}.webp`, thumb: `story/thumbs/${slug}.webp` });

/** @type {ReadonlyArray<{ id: string, kind: 'pb', name: string, group: string, unlock: object, file?: string, thumb?: string, svg?: string, pos?: string, slot?: boolean }>} */
export const PB_BANNERS = Object.freeze([
  // School life
  { id: 'pb:blossom_court', name: 'Blossom Court', group: 'school', ...story('blossom-court'), unlock: { ach: 'a_gold_1' } },
  { id: 'pb:blossom_dusk', name: 'Blossom Court at Dusk', group: 'school', ...story('blossom-court-sunset'), unlock: { ach: 'a_gold_20' } },
  { id: 'pb:library_garden', name: 'Library Garden', group: 'school', ...story('library-garden'), unlock: { ach: 'a_story_1' } },
  { id: 'pb:common_room', name: 'Common Room', group: 'school', ...story('common-room'), unlock: { ach: 'a_login_30' } },
  { id: 'pb:workshop', name: 'Workshop Bench', group: 'school', ...story('workshop'), unlock: { ach: 'a_leg_plus10' } },
  // Sakura and medals
  { id: 'pb:sakura_sanctuary', name: 'Sakura Sanctuary', group: 'sakura', ...story('sakura-sanctuary'), unlock: { ach: 'a_sakura_10' } },
  { id: 'pb:petal_storm', name: 'Petal Storm', group: 'sakura', svg: 'petalStorm', slot: true, unlock: { ach: 'a_kills_100k' } },
  // Chapters (the Gate Arc's city)
  { id: 'pb:station_plaza', name: 'Station Plaza', group: 'chapters', ...story('station-plaza'), lock: 'Clear Chapter 1 · Act II', unlock: { ach: 'a_ch1_act2' } },
  { id: 'pb:gate_after_dark', name: 'Gate After Dark', group: 'chapters', ...story('academy-gate-night'), lock: 'Clear Chapter 2 · Act II', unlock: { ach: 'a_ch2_act2' } },
  // Freeplay milestones
  { id: 'pb:moon_pier', name: 'Moon Pier', group: 'freeplay', ...story('moon-pier'), unlock: { ach: 'a_fp_50' } },
  { id: 'pb:summit_nest', name: 'Summit Nest', group: 'freeplay', ...story('summit-nest'), unlock: { ach: 'a_fp_200' } },
  { id: 'pb:beacon_gate', name: 'Beacon Gate', group: 'freeplay', ...story('beacon-gate'), unlock: { ach: 'a_fp_bosses_4' } },
  // LR collection
  { id: 'pb:nightglass', name: 'Nightglass Sky', group: 'lr', svg: 'nightglass', slot: true, unlock: { lr: true } },
  // Co-op and clans
  { id: 'pb:festival_street', name: 'Festival Street', group: 'together', ...story('festival-street'), unlock: { ach: 'a_coop_10' } },
  // Secrets
  { id: 'pb:shrine_bell', name: 'Shrine Bell', group: 'secret', ...story('shrine-bell'), unlock: { ach: 'a_close_call' } },
  // Events
  { id: 'pb:pumpkin_night', name: 'Pumpkin Lantern Night', group: 'event', file: 'halloween.webp', thumb: 'halloween.webp', pos: '50% 62%', unlock: { event: 'halloween-2026' } },
  // Seasons
  { id: 'pb:spring_petals', name: 'Spring Petals', group: 'season', svg: 'spring', slot: true, unlock: { season: 'spring' } },
  { id: 'pb:summer_fireworks', name: 'Summer Fireworks', group: 'season', svg: 'summer', slot: true, unlock: { season: 'summer' } },
  { id: 'pb:autumn_leaves', name: 'Autumn Leaves', group: 'season', svg: 'autumn', slot: true, unlock: { season: 'autumn' } },
  { id: 'pb:first_snow', name: 'First Snow', group: 'season', svg: 'winter', slot: true, unlock: { season: 'winter' } },
].map((b) => Object.freeze({ kind: 'pb', ...b })));

/** Seasons by month of the game day (Central time): Dec–Feb winter, Mar–May spring, Jun–Aug summer, Sep–Nov autumn. */
export const SEASON_OF_MONTH = Object.freeze(['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter']);
export const SEASON_NAMES = Object.freeze({ spring: 'spring (March–May)', summer: 'summer (June–August)', autumn: 'autumn (September–November)', winter: 'winter (December–February)' });
