// Sakura Sentinels — Codex (legacy) kits of the 19 shared girls (owner: units). See ROSTER_SPEC §4.4b.
//
// The old Codex game had one flat trait line and three linear upgrades per girl. Their numbers are a
// different scale and do not come back (docs/merge/combat.md §2.3); their *identity* does:
//   * `trait`    — the old one-line kit summary, shown as a small "Codex kit" line on the student Info tab
//                  and in the wiki's "Codex Kits" article.
//   * `title`    — the old title (only Hikari's differs: the Codex called her just "Dawnblade").
//   * `upgrades` — the three old upgrade names, in Codex order. Heroes levelled automatically and had none.
// The current (School) upgrade paths keep their own names: the owner (2026-10-13) moved the Codex upgrade
// names to a separate Fantasy kit (a Fantasy <-> School toggle built after the balance merge), so they live
// only here for now.
// Kaede, Suzu and Chika came from the Codex expansion, whose generic upgrades ("Field training",
// "Specialist", "Masterwork") had no identity; their names are the expansion's battle specialisations.
// Plain data, no side effects; kept out of the UnitDef so the unit schema test stays unchanged.

/** @typedef {{ title: string, trait: string, upgrades: string[] }} LegacyKit */

/** @type {Object<string, LegacyKit>} unit id -> Codex kit */
export const LEGACY = {
  hikari: { title: 'Dawnblade', trait: 'Levels up automatically', upgrades: [] },
  luna: { title: 'Moonfox Oracle', trait: '3 arcane targets · armor piercing · levels automatically', upgrades: [] },
  nami: { title: 'Tide Admiral', trait: 'Land + water · 2 targets · veil sight', upgrades: [] },
  aoi: {
    title: 'Wind Ranger', trait: 'Fast single-target attacks',
    upgrades: ['Feather Arrows', 'Windrunner', 'Emerald Tempest'],
  },
  rei: {
    title: 'Sakura Samurai', trait: 'Hits every enemy in her reach',
    upgrades: ['Honed Edge', 'Petal Dance', 'Thousand Cuts'],
  },
  yuki: {
    title: 'Frost Mage', trait: '50% slow · 2 seconds',
    upgrades: ['Deep Chill', 'Winter Veil', 'Absolute Zero'],
  },
  momo: {
    title: 'Starlight Idol', trait: '+65 coins per completed wave',
    upgrades: ['Opening Act', 'Encore', 'Superstar'],
  },
  akane: {
    title: 'Flame Witch', trait: 'Splash damage + burning',
    upgrades: ['Cinder Spark', 'Wildfire', 'Phoenix Heart'],
  },
  sango: {
    title: 'Coral Corsair', trait: 'Physical splash · shreds armor · land + water',
    upgrades: ['Reef Powder', 'Coral Broadside', 'Pearlstorm Barrage'],
  },
  kage: {
    title: 'Shadow Ninja', trait: 'Hits up to 3 enemies',
    upgrades: ['Twin Shadows', 'Night Blossom', 'Shadowstorm'],
  },
  umeko: {
    title: 'Pearl Warden', trait: 'Land + water · reveal aura · damage buff',
    upgrades: ['Pearl Lantern', 'Tidal Sanctuary', 'Ocean\'s Blessing'],
  },
  shiro: {
    title: 'Moon Sniper', trait: 'Long range · armor piercing',
    upgrades: ['Silver Bullet', 'Eagle Eye', 'Lunar Eclipse'],
  },
  midori: {
    title: 'Potion Alchemist', trait: 'Poison splash · bypasses armor',
    upgrades: ['Potent Brew', 'Emerald Elixir', 'Forbidden Formula'],
  },
  suzu: {
    title: 'Bell Trapper', trait: 'Stockpiles up to five bell traps · small holy explosions',
    upgrades: ['Firework Bells', 'Binding Bells', 'Spirit Seals'],
  },
  raika: {
    title: 'Storm Caller', trait: 'Chain lightning · 3 targets',
    upgrades: ['Static Charge', 'Thunder Chorus', 'Divine Storm'],
  },
  miko: {
    title: 'Shrine Keeper', trait: '+25% damage · +15% attack speed',
    upgrades: ['Sacred Bell', 'Spirit Blessing', 'Celestial Shrine'],
  },
  hotaru: {
    title: 'Lantern Keeper', trait: 'Holy area pulse · 20% slow for 1 second',
    upgrades: ['Firefly Song', 'Guiding Light', 'Thousand Lanterns'],
  },
  kaede: {
    title: 'Crimson Fencer', trait: 'Focus on one target builds up to +60% damage',
    upgrades: ['Crimson Focus', 'Needle Point', 'Riposte'],
  },
  chika: {
    title: 'Clockwork Mechanic', trait: 'Two clockwork sentries attack independently',
    upgrades: ['Twin Workshops', 'Heavy Machinery', 'Survey Drones'],
  },
};

/** Unit ids that carry a Codex kit (the 19 shared girls), in roster order. */
export const LEGACY_IDS = Object.keys(LEGACY);

/**
 * The Codex kit of a girl, or null for girls who were never in the Codex (the expansion newcomers).
 * @param {string} unitId
 * @returns {LegacyKit|null}
 */
export function legacyKit(unitId) {
  return LEGACY[unitId] || null;
}
