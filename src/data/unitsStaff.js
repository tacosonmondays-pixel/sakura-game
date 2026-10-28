// The academy-staff heroes of the banners wave (docs/specs/BANNERS.md §D; owner: units): Kogane, the
// Facilities Crew Chief (SSR hero, premium), and Norika, the Traffic Safety Officer (SR hero, standard).
// Both are adults by rule and test, re-cast from the old tower designs (UNIT_GAPS §5.11, §5.12) as academy
// staff in work uniforms; they keep their names, colours and props. Appended to UNITS by one line in
// src/data/units.js.
//
// Their battle mechanics: Kogane's Move recharge key (`moveCd`, src/sim/hero.js) and her Clear the Road plow
// (the `runner` ult with `push`, src/sim/runners.js); Norika's barricades and Hold the Line (src/sim/barricades.js).
// Their skills live with everyone else's (src/data/abilities.js numbers, src/data/abilityText.js words).

import { HERO_TRACKS } from './heroTracks.js';
import { stats, GACHA_ONLY } from './unitKit.js';

const KOGANE = {
  id: 'kogane',
  name: 'Kogane',
  title: 'Facilities Crew Chief',
  kind: 'hero',
  rarity: 'SSR',
  adult: true,
  role: 'pilot',
  attackType: 'pierce',
  element: null,
  placement: 'land',
  materialFamily: 'blade',
  capabilities: ['armorPen'],
  pathCapabilities: ['antiAir', 'detection', 'stun', 'barrierBreak', 'armorShred'],
  acquisition: GACHA_ONLY,
  palette: {
    hair: '#7a5232', hairShade: '#55371f', eyes: '#e0a43a', skin: '#fbe2cf',
    outfit: '#f2c230', outfitShade: '#2c3a5e', accent: '#ff8fb0', halo: '#ffd27a', weapon: '#5d6470',
  },
  look: {
    hairStyle: 'short', bangs: 'messy', accessory: 'hardhat', outfit: 'jumpsuit', weapon: 'wrench',
    halo: 'gear', eyeStyle: 'round', expression: 'cheerful',
  },
  bio: 'The academy\'s facilities crew chief, an adult staff member in a safety-yellow work jacket with reflective tape over a navy staff polo, cargo work trousers and steel-toe boots, with a hard hat (sakura sticker included) and goggles over short messy brown hair. She keeps every path on campus clear, and when monsters block one, Big Yellow, her little two-legged construction walker, clears it too.',
  personality: 'Easygoing, practical and in love with big machines; fixes anything on campus before lunch and waves at every student from the cockpit.',
  quote: 'Leave it to Big Yellow!',
  tips: [
    'Her rivets ignore armor, and every level of her drill path ignores more.',
    'Clear the Road plows back up the road from her aim point and pushes enemies back (minibosses and bosses take the damage only).',
    'Move her often: her Treads level and her awakening make the Move recharge faster.',
  ],
  base: stats({
    cost: 0, damage: 6, rate: 1.1, range: 2.8, projectileSpeed: 16, armorPen: 1, canHitAir: false,
  }),
  paths: [],
  awakenPassive: {
    name: 'Reinforced Frame',
    desc: '+8% damage; Move recharges 3s faster.',
    mods: { damageMul: 1.08, moveCd: 3 },
  },
  hero: {
    levels: HERO_TRACKS.kogane.levels,
    pathKeys: HERO_TRACKS.kogane.pathKeys,
    ult: {
      name: 'Clear the Road',
      desc: 'Big Yellow plows the road clear. She drives onto the road at her aim point (or the busiest road\'s exit end) and plows 8 tiles back up it in 2.5s: each enemy it touches takes 120 damage and is pushed back 2 tiles (minibosses and bosses take the damage only).',
      unlockLevel: 3,
      cooldown: 70,
      effect: {
        // a runner (src/sim/runners.js) with `push`: tiles each enemy it strikes is pushed back (not bosses;
        // minibosses `pushMini`)
        type: 'runner', runner: 'plow', center: 'aim', length: 8, time: 2.5, damage: 120, segments: 2, gap: 0.6, attackType: 'pierce',
        push: 2, pushMini: 0,
      },
      ranks: HERO_TRACKS.kogane.ultRanks,
    },
  },
};

const NORIKA = {
  id: 'norika',
  name: 'Norika',
  title: 'Traffic Safety Officer',
  kind: 'hero',
  rarity: 'SR',
  adult: true,
  role: 'blocker',
  attackType: 'blast',
  element: null,
  placement: 'land',
  materialFamily: 'rime',
  capabilities: [],
  pathCapabilities: ['antiAir', 'detection', 'slow'],
  acquisition: GACHA_ONLY,
  palette: {
    hair: '#4a3428', hairShade: '#2e1f18', eyes: '#4f86c6', skin: '#fde6d8',
    outfit: '#26345e', outfitShade: '#151d38', accent: '#d8f23a', halo: '#fff3a8', weapon: '#e0453c',
  },
  look: {
    hairStyle: 'twintails', bangs: 'straight', accessory: 'cap', outfit: 'sash', weapon: 'sign',
    halo: 'ring', eyeStyle: 'sharp', expression: 'determined',
  },
  bio: 'The academy\'s traffic safety officer, an adult staff member in a navy staff blazer under a reflective high-visibility sash, white gloves, a yellow safety cap, navy slacks and rain boots, with a whistle on a lanyard, two low tied tails and a round STOP paddle. She walks every student across the road and blows her whistle at everything, pigeons included. Monsters are no exception.',
  personality: 'Serious about patrol duty, endlessly patient with students and not at all patient with anything that ignores a crossing.',
  quote: 'Stop! Wait for the whistle.',
  tips: [
    'She sets a barricade on the road in her range: walkers stop at it until they break it; flyers pass over and blinkers hop it.',
    'Move her to re-site her barricades. Hold the Line drops extra barricades where you aim.',
    'Her STOP waves splash and push back a little; they reach flyers from Lv 6.',
  ],
  base: stats({
    cost: 0, damage: 4, rate: 0.8, range: 2.2, splash: 0.8, knockback: 0.15, projectileSpeed: 10, canHitAir: false,
    // her barricades (src/sim/barricades.js): how many, the hold budget each, seconds to rebuild one
    barricade: { count: 1, budget: 120, rebuild: 3 },
  }),
  paths: [],
  awakenPassive: {
    name: 'Safety First',
    desc: '+6% damage; barricade budget +20%.',
    mods: { damageMul: 1.06, barricade: { budgetMul: 1.2 } },
  },
  hero: {
    levels: HERO_TRACKS.norika.levels,
    pathKeys: HERO_TRACKS.norika.pathKeys,
    ult: {
      name: 'Hold the Line',
      desc: 'Norika closes the road. Two temporary barricades go up at her aim point (or ahead of the lead walker in her range): a 400 hold budget each for 12s, and held enemies take +10% damage. Bosses and minibosses walk through them.',
      unlockLevel: 3,
      cooldown: 60,
      effect: { type: 'barricade', center: 'aim', count: 2, budget: 400, duration: 12, held: 0.1, mini: false },
      ranks: HERO_TRACKS.norika.ultRanks,
    },
  },
};

/** The staff heroes, in roster order. */
export const STAFF_UNITS = [KOGANE, NORIKA];
