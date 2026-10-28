// Banners (docs/specs/BANNERS.md §A): which banners are live on a game day, their pools and ppm weights,
// the spark windows and the class rules. Pure functions, no DOM. Not co-op hashed: src/sim/** and the
// co-op files never import this (§I.2).
//
// Counters (missions.counters, numbers only; older builds keep them word for word, §I.3):
//   gb:seen       forward-only game-day high-water mark (a clock set back shows the latest day already seen)
//   gs:g1         the game day this save first loaded banners (the 30-day spark grace of the five, §A.6)
//   gs:pick       the Standard banner's select SSR, as index + 1 into STANDARD_SSR (0 = the default)
//   gs:pickDay    the game day of the last pick change (once a game day)
//   gs:first      1 once the Standard banner's first 10× (the welcome SSR) has been used
//   gl:<unit>     Legend Promise: pulls on that LR unit's LR Banners since she last arrived

import { UNIT_MAP } from '../data/units.js';
import {
  STANDARD_SSR, LISTS, PINS, RATES, LEGEND_PROMISE, LEGEND_SR, LEGEND_NAMES, BANNER_KINDS, SPOTLIGHT_TITLES,
  GRACE_UNITS, GRACE_DAYS, unitClass, isLegendUnit,
} from '../data/banners.js';
import { gameDayNumber, gameDayStart, gameWeekNumber, nextDailyReset } from '../core/reset.js';

export { unitClass, isLegendUnit };

const DAY_MS = 86400000;
const TOTAL = 1000000;
export const PPM_TOTAL = TOTAL;

export const mod = (a, n) => ((a % n) + n) % n;
const counters = (p) => ((p.missions ||= {}).counters ||= {});
const cnt = (p, k) => Number(p?.missions?.counters?.[k]) || 0;
const exists = (id) => !!UNIT_MAP[id];

/** Whole days since 1970-01-01 of a game-day key. */
export function keyNumber(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}
/** The game-day key of a day number. */
export function numberKey(n) {
  const d = new Date(n * DAY_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
/** Start (ms) of game day number n, and its end (the next 7 PM Central). */
export const dayStartMs = (n) => gameDayStart(numberKey(n));
export const dayEndMs = (n) => gameDayStart(numberKey(n + 1));

// ---------------------------------------------------------------------------
// The banner day (§A.4)
// ---------------------------------------------------------------------------

let serverOffset = 0;
/** Online RPC replies that carry `serverNow` set this (offline it stays 0: the device clock). */
export function setServerOffset(ms) { serverOffset = Number.isFinite(ms) ? ms : 0; }
export const getServerOffset = () => serverOffset;

/** The banner day: the game day of now (+ server offset), never earlier than one this save has seen. */
export function bannerDay(profile, now = Date.now()) {
  return Math.max(gameDayNumber(now + serverOffset), cnt(profile, 'gb:seen'));
}

/** Record the banner day (the recruit screen opens, a pull) and the grace start; forward-only. */
export function noteBannerDay(profile, now = Date.now()) {
  const d = bannerDay(profile, now);
  const c = counters(profile);
  if (!(c['gb:seen'] >= d)) c['gb:seen'] = d;
  if (!c['gs:g1']) c['gs:g1'] = d;
  return d;
}

// ---------------------------------------------------------------------------
// Lists, versions and pins
// ---------------------------------------------------------------------------

/** The live version of a list on day d: its released ids and its index i (never negative). */
export function listAt(name, d) {
  const versions = LISTS[name] || [];
  let v = versions[0];
  for (const x of versions) if (keyNumber(x.since) <= d) v = x;
  if (!v) return { list: [], i: 0, since: d };
  const since = keyNumber(v.since);
  return { list: v.list.filter(exists), i: Math.max(0, d - since), since };
}

/** Day number a pin starts on (its start instant converted with the game-day clock). */
export const pinStartDay = (pin) => gameDayNumber(Date.parse(pin.start));

/** The pin that holds `slot` on day d, if any (only for released units). */
export function pinAt(slot, d) {
  return PINS.find((p) => p.slot === slot && exists(p.unit) && d >= pinStartDay(p) && d < pinStartDay(p) + p.days) || null;
}

/** LR units in the everyday LR rotation on day d: released, and past their debut pin if they have one. */
function legendRotation(d) {
  const { list, since } = listAt('legend', d);
  return {
    since,
    list: list.filter((id) => {
      const debut = PINS.find((p) => p.slot === 'legend' && p.unit === id && p.debut);
      return !debut || d >= pinStartDay(debut) + debut.days;
    }),
  };
}

// ---------------------------------------------------------------------------
// Pools
// ---------------------------------------------------------------------------

const ids = (pred) => Object.values(UNIT_MAP).filter(pred).map((u) => u.id);
const std = (u) => unitClass(u.id) === 'standard';

/** Standard units by rarity (optionally towers or heroes only). */
export function standardPool({ kind = null } = {}) {
  const k = (u) => !kind || u.kind === kind;
  return {
    SSR: STANDARD_SSR.filter((id) => exists(id) && k(UNIT_MAP[id])),
    SR: ids((u) => u.rarity === 'SR' && std(u) && k(u)),
    R: ids((u) => u.rarity === 'R' && std(u) && k(u)),
  };
}

/** The three SR rate-ups of a weekly banner (Standard, Coin, Friendship), by game week and offset. */
function weeklySR(w, off) {
  const { list } = listAt('srTower', 0);
  const m = list.length;
  return m ? [0, 1, 2].map((j) => list[mod(3 * w + off + j, m)]) : [];
}

// ---------------------------------------------------------------------------
// Banners
// ---------------------------------------------------------------------------

/**
 * A banner: { id, slot, kind, day, name, title, select, srUps, legend, legendRate, debut, pool, endsAt, currency }.
 * `id` includes the day, so a pull carrying a stale id is refused with 'rotated' (§A.1).
 */
function makeBanner(slot, d, o) {
  return { slot, kind: slot, day: d, id: `${slot}:${o.unitKey ? `${o.unitKey}:` : ''}${d}`, currency: 'gems', ...o };
}

/** Student Spotlight on day d (towers only). */
export function towerBanner(d) {
  const sel = listAt('tower', d);
  const sr = listAt('srTower', d);
  if (!sel.list.length) return null;
  const pin = pinAt('tower', d);
  const select = pin ? pin.unit : sel.list[mod(sel.i, sel.list.length)];
  const m = sr.list.length;
  const srUps = pin?.sr || [0, 1, 2].map((j) => sr.list[mod(3 * sr.i + j, m)]);
  const base = standardPool({ kind: 'tower' });
  return makeBanner('tower', d, {
    name: BANNER_KINDS.tower.label,
    title: pin?.name || SPOTLIGHT_TITLES[select] || `${UNIT_MAP[select].name}'s Spotlight`,
    select, srUps,
    pool: { SSR: [select, ...base.SSR.filter((x) => x !== select)], SR: base.SR, R: base.R },
    endsAt: dayEndMs(d),
  });
}

/** Guardian Spotlight on day d (a hero is the select SSR; Hikari is never featured). */
export function heroBanner(d) {
  const sel = listAt('hero', d);
  const srH = listAt('srHero', d);
  const sr = listAt('srTower', d);
  if (!sel.list.length) return null;
  const pin = pinAt('hero', d);
  const select = pin ? pin.unit : sel.list[mod(sel.i, sel.list.length)];
  const m = sr.list.length;
  const hero = srH.list.length ? [srH.list[mod(srH.i, srH.list.length)]] : [];
  const srUps = pin?.sr || [...hero, ...[6, 7, 8].slice(0, 3 - hero.length).map((o) => sr.list[mod(3 * sr.i + o, m)])];
  const all = standardPool();
  return makeBanner('hero', d, {
    name: BANNER_KINDS.hero.label,
    title: pin?.name || SPOTLIGHT_TITLES[select] || `${UNIT_MAP[select].name}'s Spotlight`,
    select, srUps,
    pool: { SSR: [select, ...standardPool({ kind: 'hero' }).SSR.filter((x) => x !== select)], SR: all.SR, R: standardPool({ kind: 'tower' }).R },
    endsAt: dayEndMs(d),
  });
}

/** The LR Banner on day d: a debut pin, else the everyday rotation of released LR units; null when none. */
export function legendBanner(d) {
  const pin = pinAt('legend', d);
  let unit = pin?.unit || null;
  if (!unit) {
    const rot = legendRotation(d);
    if (!rot.list.length) return null;
    unit = rot.list[mod(d - rot.since, rot.list.length)];
  }
  const all = standardPool();
  const debut = !!pin?.debut;
  const endsAt = pin ? dayEndMs(pinStartDay(pin) + pin.days - 1) : dayEndMs(d);
  return makeBanner('legend', d, {
    unitKey: unit,
    name: `${BANNER_KINDS.legend.label} · ${UNIT_MAP[unit].name}`,
    title: pin?.name || LEGEND_NAMES[unit] || UNIT_MAP[unit].name,
    select: unit, legend: unit, debut,
    legendRate: pin?.rate || (debut ? RATES.legendDebut : RATES.legend),
    srUps: pin?.sr || LEGEND_SR[unit] || [],
    pool: { SSR: [unit, ...all.SSR], SR: all.SR, R: all.R },
    endsAt,
  });
}

/** The Standard banner (permanent): standard units only; the player's own select SSR; weekly SR rate-ups. */
export function standardBanner(d, profile = null) {
  const pool = standardPool();
  const pick = profile ? standardPick(profile) : pool.SSR[0];
  const w = gameWeekNumber(dayStartMs(d) + 1);
  return makeBanner('standard', d, {
    name: BANNER_KINDS.standard.label,
    title: 'Open Enrollment',
    select: pick, srUps: weeklySR(w, 0),
    pool: { SSR: [pick, ...pool.SSR.filter((x) => x !== pick)], SR: pool.SR, R: pool.R },
    endsAt: null,
    firstTen: profile ? !cnt(profile, 'gs:first') : true,
  });
}

/** The player's Standard select SSR (default: the first standard SSR). */
export function standardPick(profile) {
  const n = cnt(profile, 'gs:pick');
  const list = STANDARD_SSR.filter(exists);
  return list[n - 1] || list[0];
}

/** Change the Standard select SSR (once a game day). @returns {{ok, error?: 'notStandard'|'today'}} */
export function setStandardPick(profile, unitId, now = Date.now()) {
  const list = STANDARD_SSR.filter(exists);
  const i = list.indexOf(unitId);
  if (i < 0) return { ok: false, error: 'notStandard' };
  if (standardPick(profile) === unitId) return { ok: true };
  const d = bannerDay(profile, now);
  const c = counters(profile);
  if (c['gs:pickDay'] && c['gs:pickDay'] >= d) return { ok: false, error: 'today' };
  c['gs:pick'] = i + 1;
  c['gs:pickDay'] = d;
  return { ok: true };
}
/** Can the Standard pick be changed today? */
export const canChangePick = (profile, now = Date.now()) => !(cnt(profile, 'gs:pickDay') >= bannerDay(profile, now));

/** Every live gem banner today, in rail order: LR, Student, Guardian, Standard. */
export function activeBanners(profile, now = Date.now()) {
  const d = bannerDay(profile, now);
  return [legendBanner(d), towerBanner(d), heroBanner(d), standardBanner(d, profile)].filter(Boolean);
}

/** The live banner with this id, or null if it rotated away. */
export function liveBanner(profile, id, now = Date.now()) {
  return activeBanners(profile, now).find((b) => b.id === id) || null;
}

/** The live banner of a slot ('legend'|'tower'|'hero'|'standard'). */
export function bannerOfSlot(profile, slot, now = Date.now()) {
  return activeBanners(profile, now).find((b) => b.slot === slot) || null;
}

/** The next `n` days' select girls of a slot (the look-ahead: "Next: tomorrow X · then Y"). */
export function lookAhead(slot, d, n = 2) {
  const make = { tower: towerBanner, hero: heroBanner, legend: legendBanner }[slot];
  if (!make) return [];
  const out = [];
  for (let k = 1; k <= n; k++) {
    const b = make(d + k);
    if (b) out.push({ day: d + k, select: b.select, debut: !!b.debut, title: b.title });
  }
  return out;
}

/** Upcoming LR debuts within `within` days (the "Coming <date> · save gems" notice). */
export function upcomingDebuts(d, within = 7) {
  return PINS.filter((p) => p.debut && exists(p.unit)).map((p) => ({ ...p, startDay: pinStartDay(p) }))
    .filter((p) => p.startDay > d && p.startDay - d <= within);
}

// ---------------------------------------------------------------------------
// Weights (ppm)
// ---------------------------------------------------------------------------

/** Split `total` ppm evenly over ids; the remainder goes to the last (so a table totals exactly). */
function share(total, list, rarity, out, tag = null) {
  if (!list.length || total <= 0) return;
  const each = Math.floor(total / list.length);
  list.forEach((id, k) => out.push({ unitId: id, rarity, ppm: k === list.length - 1 ? total - each * (list.length - 1) : each, tag }));
}

/**
 * A banner's weights: [{ unitId, rarity: 'SSR'|'SR'|'R', ppm, tag: 'select'|'legend'|'up'|null }], totalling
 * exactly 1,000,000. LR units sit in the SSR line (their data rarity is SSR).
 */
export function bannerWeights(b) {
  const r = b.rates || RATES.gem;
  const out = [];
  const [first, ...others] = b.pool.SSR;
  if (b.legend) {
    const lr = b.legendRate;
    out.push({ unitId: b.legend, rarity: 'SSR', ppm: lr, tag: 'legend' });
    share(r.SSR - lr, others, 'SSR', out);
  } else {
    const sel = b.rates ? b.rates.select : RATES.select;
    out.push({ unitId: first, rarity: 'SSR', ppm: others.length ? sel : r.SSR, tag: 'select' });
    share(r.SSR - sel, others, 'SSR', out);
  }
  const up = b.rates ? b.rates.srUp : RATES.srUp;
  const ups = b.srUps.filter((id) => b.pool.SR.includes(id));
  for (const id of ups) out.push({ unitId: id, rarity: 'SR', ppm: up, tag: 'up' });
  share(r.SR - up * ups.length, b.pool.SR.filter((id) => !ups.includes(id)), 'SR', out);
  share(r.R, b.pool.R, 'R', out);
  return out;
}

/**
 * Draw one entry. `group` limits the draw to one rarity line ('SSR' for pity, 'SR' for the 10× lift), weighted
 * as in the table. The last entry is the else case, so a roll near 1 still returns a unit.
 */
export function drawWeighted(table, rng, group = null) {
  const rows = group ? table.filter((e) => e.rarity === group) : table;
  const total = rows.reduce((a, e) => a + e.ppm, 0);
  let x = Math.floor(rng.next() * total);
  for (const e of rows) {
    if (x < e.ppm) return e;
    x -= e.ppm;
  }
  return rows[rows.length - 1];
}

/** The rates page of a banner: per-unit lines (%), rarity lines and the guarantees. */
export function bannerRates(b) {
  const w = bannerWeights(b);
  const pct = (ppm) => ppm / 10000;
  const line = (rar) => w.filter((e) => e.rarity === rar).reduce((a, e) => a + e.ppm, 0);
  return {
    banner: b,
    lines: { SSR: pct(line('SSR')), SR: pct(line('SR')), R: pct(line('R')) },
    units: w.map((e) => ({ ...e, pct: pct(e.ppm) })),
    legendShare: b.legend ? b.legendRate / line('SSR') : 0,
    promise: b.legend ? LEGEND_PROMISE : null,
  };
}

// ---------------------------------------------------------------------------
// Spark, Select Ticket and Chosen Essence (§A.1, enforced in the systems)
// ---------------------------------------------------------------------------

/** Premium spark window: her Spotlight day, or her day and the 2 after once her list has more than 6 girls. */
function inSpotlightWindow(unitId, d) {
  const def = UNIT_MAP[unitId];
  if (!def) return false;
  const slot = def.kind === 'hero' ? 'hero' : 'tower';
  const make = slot === 'hero' ? heroBanner : towerBanner;
  const { list } = listAt(slot, d);
  const span = list.length > 6 ? 3 : 1;
  for (let k = 0; k < span; k++) if (make(d - k)?.select === unitId) return true;
  return false;
}

/** Days until a premium girl's next Spotlight (0 = today), or null when none within 60 days. */
export function daysToSpotlight(unitId, d) {
  const def = UNIT_MAP[unitId];
  if (!def) return null;
  const make = def.kind === 'hero' ? heroBanner : towerBanner;
  for (let k = 0; k <= 60; k++) if (make(d + k)?.select === unitId) return k;
  return null;
}

/** Inside the 30-day grace of the five roster-wave SSRs (§A.6)? */
export function inGrace(profile, unitId, d) {
  if (!GRACE_UNITS.includes(unitId)) return false;
  const start = cnt(profile, 'gs:g1') || d;
  return d - start < GRACE_DAYS;
}

/**
 * May this SSR be sparked right now? @returns {{ ok: boolean, error?: 'notSSR'|'legend'|'event'|'window', days?: number|null }}
 * Standard SSRs: any day. Premium: her spark window (or the grace). LR and event girls: never.
 */
export function sparkRule(profile, unitId, now = Date.now()) {
  const def = UNIT_MAP[unitId];
  if (!def || def.rarity !== 'SSR') return { ok: false, error: 'notSSR' };
  const cls = unitClass(unitId);
  if (cls === 'legend') return { ok: false, error: 'legend' };
  if (cls === 'event') return { ok: false, error: 'event' };
  if (cls === 'standard') return { ok: true };
  const d = bannerDay(profile, now);
  if (inSpotlightWindow(unitId, d) || inGrace(profile, unitId, d)) return { ok: true };
  return { ok: false, error: 'window', days: daysToSpotlight(unitId, d) };
}

/** May an SSR Select Ticket pick her? Standard and premium SSRs; never an LR unit or an event girl. */
export function selectTicketAllowed(unitId) {
  const def = UNIT_MAP[unitId];
  const cls = unitClass(unitId);
  return !!def && def.rarity === 'SSR' && (cls === 'standard' || cls === 'premium');
}

/** SSRs a Select Ticket may pick, in roster order. */
export const selectTicketPool = () => Object.values(UNIT_MAP).filter((u) => selectTicketAllowed(u.id)).map((u) => u.id);

/** SSRs that may ever be sparked (standard + premium), in roster order (the spark dialog and the Mall rows). */
export const sparkPool = selectTicketPool;

/** Chosen SSR Essence (Moonpearls): any owned standard SSR, a premium SSR in her spark window; never LR (J14). */
export function chosenEssenceAllowed(profile, unitId, now = Date.now()) {
  const def = UNIT_MAP[unitId];
  if (!def) return false;
  const cls = unitClass(unitId);
  if (cls === 'legend' || cls === 'event') return false;
  if (def.rarity !== 'SSR' || cls === 'standard') return true;
  return sparkRule(profile, unitId, now).ok;
}

// ---------------------------------------------------------------------------
// Legend Promise
// ---------------------------------------------------------------------------

export const promiseKey = (unitId) => `gl:${unitId}`;
/** Pulls counted toward her Legend Promise. */
export const promiseCount = (profile, unitId) => cnt(profile, promiseKey(unitId));
export { LEGEND_PROMISE };

/** Time to the next banner switch (the daily 7 PM reset, or a debut's end). */
export function bannerEndsIn(b, now = Date.now()) {
  return b?.endsAt ? Math.max(0, b.endsAt - now) : null;
}
export { nextDailyReset };
