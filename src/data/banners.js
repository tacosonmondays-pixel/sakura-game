// Banners (docs/specs/BANNERS.md): the gacha class of every unit, the rotation lists and the pins.
// Pure data; src/systems/banners.js reads it. Never imported by src/sim/** or the co-op files, and the
// classes never go into units.js (BANNERS §I.2: none of this changes the co-op sim id).
//
// Classes (§B):
//   standard  in the Standard banner and every gem banner's off-rate (every R and SR, and the five
//             original SSRs: Hikari, Luna, Hotaru, Kaede, Chika)
//   premium   an SSR who appears only as a Spotlight's select SSR (spark on her Spotlight day)
//   legend    an LR unit: only on her own LR Banner; never sparked, never a Select Ticket or Chosen Essence
//   event     a free-only event girl: never in any pool (EVENT_SPEC E6)
// A unit not listed here is `standard` when she is R or SR, and `premium` when she is SSR.

import { UNIT_MAP } from './units.js';

/** SSRs that are standard (every player could already pull them before banners). */
export const STANDARD_SSR = Object.freeze(['hotaru', 'kaede', 'chika', 'luna', 'hikari']);

/** Explicit classes (anything else follows the rarity rule above). */
export const UNIT_CLASS = Object.freeze({
  hikari: 'standard', luna: 'standard', hotaru: 'standard', kaede: 'standard', chika: 'standard',
  kanna: 'premium', yoriko: 'premium', seiran: 'premium', iroha: 'premium', ena: 'premium',
  tenka: 'legend',
  kohaku_tsubaki: 'legend',
  // planned (not in UNITS yet; their rows wait here so a list can name them the day they ship)
  sorano: 'premium', kogane: 'premium', norika: 'standard',
});

/** Ids a list or class row may name before the unit exists in UNITS (they are skipped until then). */
export const PLANNED = Object.freeze(['sorano', 'kogane', 'norika', 'kohaku_tsubaki']);

/**
 * The five roster-wave SSRs that were in the one-pool Recruit before banners (§A.6): sparkable on any day
 * for GRACE_DAYS game days after a save first loads banners ('gs:g1').
 */
export const GRACE_UNITS = Object.freeze(['kanna', 'yoriko', 'seiran', 'iroha', 'ena']);
export const GRACE_DAYS = 30;

/**
 * Rotation lists as versions `{ since, list }` (§A.4). `since` is a game day key ('YYYY-MM-DD'); each version
 * counts its own index from its own `since`, so the look-ahead players were shown never changes. A new
 * version's `since` must be at least 3 game days after the patch note of the release that adds it and a day
 * on which the old version's cycle ends (tests/systems/banners.test.js checks both).
 */
export const BANNER_EPOCH = '2026-11-09';

export const LISTS = Object.freeze({
  /** Student Spotlight select SSR (towers; premium and standard alternate, J12). */
  tower: [{ since: BANNER_EPOCH, list: ['iroha', 'hotaru', 'ena', 'kaede', 'chika'] }],
  /** Guardian Spotlight select SSR (heroes; Hikari is the starter and never featured). */
  hero: [{ since: BANNER_EPOCH, list: ['kanna', 'luna', 'yoriko', 'seiran'] }],
  /** SR towers, gacha-only girls first (the rate-up order). */
  srTower: [{ since: BANNER_EPOCH, list: ['akane', 'ruri', 'raika', 'miko', 'sango', 'kage', 'umeko', 'shiro', 'midori', 'suzu', 'noa', 'yuzuha', 'ouka', 'marumi', 'chigusa'] }],
  /** SR heroes (one is the Guardian Spotlight's hero SR rate-up). */
  srHero: [{ since: BANNER_EPOCH, list: ['nami'] }],
  /** LR units in the daily LR tab (after their debut weeks). */
  legend: [{ since: BANNER_EPOCH, list: ['tenka', 'kohaku_tsubaki'] }],
});

/**
 * Pins (§A.4): a debut or a featured run that wins its slot for `days` game days from the instant `start`
 * (converted with gameDay(), never written as a key: keys are named by the date a day ENDS). The rotation
 * index keeps counting underneath, so a pin never shifts later days.
 * `rate` (LR only) is the LR unit's ppm in the debut week; `sr` the three SR rate-ups; `name` the banner title;
 * `hold` keeps a brand-new LR unit off the everyday LR tab until her debut (Tenka has none: she was out first).
 */
export const PINS = Object.freeze([
  {
    slot: 'legend', unit: 'tenka', start: '2026-11-08T19:00:00-06:00', days: 7, rate: 7000,
    sr: ['miko', 'umeko', 'raika'], name: 'Physics Club Premiere', debut: true,
  },
  {
    slot: 'legend', unit: 'kohaku_tsubaki', start: '2026-11-15T19:00:00-06:00', days: 7, rate: 7000,
    sr: ['akane', 'sango', 'shiro'], name: 'Starfall Premiere', debut: true, hold: true,
  },
]);

/** SR rate-ups of an LR unit's everyday banner (after the debut; the owner may change them). */
export const LEGEND_SR = Object.freeze({
  tenka: ['miko', 'umeko', 'raika'],
  kohaku_tsubaki: ['akane', 'sango', 'shiro'],
});

/** Everyday names of the LR Banners (the debut pin's `name` wins in its week). */
export const LEGEND_NAMES = Object.freeze({
  tenka: 'Physics Club',
  kohaku_tsubaki: 'Starfall',
});

/** Rates in ppm (parts per million; every banner's weights total exactly 1,000,000). */
export const RATES = Object.freeze({
  gem: { SSR: 15000, SR: 185000, R: 800000 },
  select: 10000, // a Spotlight's or Standard's select SSR (2/3 of the SSR line)
  srUp: 30000, // each of the 3 SR rate-ups
  legend: 5000, // an LR unit on her everyday LR Banner, carved out of the 15,000 SSR line
  legendDebut: 7000, // in her debut week
  coin: { SSR: 2500, SR: 177500, R: 820000, select: 1667, srUp: 25000 },
  friend: { SSR: 3000, SR: 147000, R: 850000, select: 2000, srUp: 25000 },
});

/** The Legend Promise: the Nth pull counted on an LR unit's own LR Banners is her (§C.1). */
export const LEGEND_PROMISE = 300;

/** Display and kind colour tokens per banner kind (the recruit rail). */
export const BANNER_KINDS = Object.freeze({
  legend: { label: 'LR Banner', short: 'LR', color: '#0e1930', edge: '#ffd27a' },
  tower: { label: 'Student Spotlight', short: 'Student', color: '#ff7aa8' },
  hero: { label: 'Guardian Spotlight', short: 'Guardian', color: '#e8b04a' },
  standard: { label: 'Standard', short: 'Standard', color: '#5b8de8' },
  coin: { label: 'Coin Recruit', short: 'Coin', color: '#c9824a' },
  friend: { label: 'Friendship', short: 'Friend', color: '#56c9a0' },
});

/** Spotlight titles by select girl (a flavour line under the kind; anything missing reads "<Name>'s Spotlight"). */
export const SPOTLIGHT_TITLES = Object.freeze({
  iroha: 'A Garden of Mirrors',
  hotaru: 'Lanterns at Dusk',
  ena: 'Charms and Curses',
  kaede: 'The Duelling Club',
  chika: 'Workshop Open Day',
  kanna: 'Captain of the Guard',
  luna: 'Moonlit Study Hall',
  yoriko: 'Strings and Stages',
  seiran: 'Stormwatch',
});

/**
 * The gacha class of a unit: 'standard' | 'premium' | 'legend' | 'event', or null for an unknown id.
 * Every rule that must keep LR units out (spark, Select Ticket, Chosen Essence, the Standard pool) asks this,
 * never the rarity (LR units keep rarity 'SSR' in their data, BANNERS §C.1).
 */
export function unitClass(id) {
  const def = UNIT_MAP[id];
  if (!def) return PLANNED.includes(id) ? UNIT_CLASS[id] || null : null;
  if (def.acquisition?.type === 'event' || def.event) return 'event';
  if (UNIT_CLASS[id]) return UNIT_CLASS[id];
  return def.rarity === 'SSR' ? 'premium' : 'standard';
}

/** True for an LR unit (class 'legend'). */
export const isLegendUnit = (id) => unitClass(id) === 'legend';
