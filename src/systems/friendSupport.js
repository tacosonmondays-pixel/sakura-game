// Friend Support on the player's side (docs/specs/BANNERS.md §E; owner: systems). Pure over the profile: which
// girl this save lends and to whom, the clamp that builds a borrowed girl inside the BORROWER's own range, the
// battle-record marker, where a Support Student may fight, and the Friend Points wallet. No server calls
// (src/online/supportClient.js), no DOM.
//
// Saves (additive, no SAVE_VERSION bump): the wallet is missions.counters 'frp:bal' (0–5,000) and "Lend my Support
// Student to: Nobody" is 'frp:off' = 1 (counters are kept word for word by older builds, so an older tab never
// turns lending back on); the chosen girl is settings.supportUnit (an older build drops it: the default girl).
import { UNIT_MAP } from '../data/units.js';
import { STAGE_MAP } from '../data/stages.js';
import { cardUnit, cleanViewedCard, snapshotToMiniProfile, CARD_GATES } from '../online/profileCard.js';
import { levelCapAt, potentialLevelCap, unitBattleStats, MAX_AWAKEN } from './progression.js';
import { isOwned } from './unlocks.js';
import { cleanShowcase } from './senseiSave.js';
import { autoShowcase } from './profileTrophies.js';
import { LR_TRIALS, isLR } from './limitBreak.js';
import { FP_WALLET_CAP, LEND, LEND_DEFAULT } from '../online/supportRules.js';

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const counters = (p) => ((p.missions ||= {}).counters ||= {});
const cnt = (p, k) => Number(p?.missions?.counters?.[k]) || 0;

/** The wallet counter and the "Nobody" mark (missions.counters). */
export const FP_KEY = 'frp:bal';
export const LEND_OFF_KEY = 'frp:off';
/** Potential a borrowed girl fights at, at most (E.1). */
export const SUPPORT_MAX_P = 3;
/** Levels above the borrower's highest girl a borrowed girl may have (E.1). */
export const SUPPORT_LEVEL_LEAD = 10;

// ---------------------------------------------------------------------------
// Lending
// ---------------------------------------------------------------------------

/** "Lend my Support Student to": 'friends' (default) | 'nobody'. */
export const supportLend = (p) => (cnt(p, LEND_OFF_KEY) >= 1 ? 'nobody' : LEND_DEFAULT);

/** Sets "Lend my Support Student to". @returns {boolean} changed */
export function setSupportLend(p, value) {
  if (!LEND.includes(value) || supportLend(p) === value) return false;
  counters(p)[LEND_OFF_KEY] = value === 'nobody' ? 1 : 0;
  return true;
}

const ownedTower = (p, id) => typeof id === 'string' && UNIT_MAP[id]?.kind === 'tower' && isOwned(p, id);

/** The girl this save lends: the chosen one, else the first tower of the showcase (picked or automatic), else the first owned tower. */
export function supportUnitId(p) {
  const pick = p?.settings?.supportUnit;
  if (ownedTower(p, pick)) return pick;
  const s = isObj(p?.sensei) ? p.sensei : {};
  const show = cleanShowcase(s.showcase, p);
  const list = show.length ? show : autoShowcase(p);
  return list.find((id) => ownedTower(p, id)) || Object.keys(p?.units || {}).find((id) => ownedTower(p, id)) || null;
}

/** Picks the Support Student (null: back to the default). @returns {boolean} changed */
export function setSupportUnit(p, unitId) {
  const v = unitId == null ? null : ownedTower(p, unitId) ? unitId : undefined;
  if (v === undefined) return false;
  p.settings ||= {};
  if ((p.settings.supportUnit ?? null) === v) return false;
  if (v == null) delete p.settings.supportUnit;
  else p.settings.supportUnit = v;
  return true;
}

/** The card unit this save publishes as its Support Student (the profile card's entry format; LR is `aw: 6`), or null. */
export function supportCardUnit(p) {
  const id = supportUnitId(p);
  return id ? cardUnit(p, id) : null;
}

// ---------------------------------------------------------------------------
// Borrowing: the clamp (E.1) and the battle entry
// ---------------------------------------------------------------------------

/** The borrower's range a borrowed girl is clamped into. */
export function borrowerRange(p) {
  const units = Object.entries(p?.units || {}).filter(([id]) => UNIT_MAP[id]);
  const level = units.reduce((mx, [, u]) => Math.max(mx, Math.floor(Number(u?.level) || 1)), 1);
  const stars = units.reduce((mx, [, u]) => Math.max(mx, Math.min(MAX_AWAKEN, Math.floor(Number(u?.awaken) || 0))), 0);
  // UR Resonance (an SSR at ★5) only when the borrower has a UR girl themselves
  const ur = units.some(([id, u]) => UNIT_MAP[id].rarity === 'SSR' && (Number(u?.awaken) || 0) >= MAX_AWAKEN);
  return { level, stars, ur };
}

/**
 * A friend's published Support Student → the girl this save may borrow: first the profile viewer's clamps (unknown
 * ids dropped, gear values capped), then the borrower's range: level ≤ their highest girl + 10 (gates follow),
 * Potential ≤ P3, ★ ≤ their highest ★ (★5 on an SSR only when they own a UR girl), never the LR form (`aw` 6 reads 5).
 * Heroes are never lent. @returns {object|null} a card entry { id, lv, bt, aw, p, g? }
 */
export function clampSupportUnit(unit, borrower) {
  const v = cleanViewedCard({ v: 1, units: [unit] }).units[0];
  if (!v || UNIT_MAP[v.id]?.kind !== 'tower') return null;
  const r = borrowerRange(borrower);
  const p = Math.min(SUPPORT_MAX_P, v.p);
  let aw = Math.min(v.aw, MAX_AWAKEN, r.stars);
  if (aw >= MAX_AWAKEN && UNIT_MAP[v.id].rarity === 'SSR' && !r.ur) aw = MAX_AWAKEN - 1;
  const bt = Math.min(CARD_GATES, v.bt);
  const cap = bt < CARD_GATES ? levelCapAt(bt, p) : potentialLevelCap(p);
  const lv = Math.max(1, Math.min(v.lv, cap, r.level + SUPPORT_LEVEL_LEAD));
  const out = { id: v.id, lv, bt, aw, p };
  if (v.g?.length) out.g = v.g;
  return out;
}

/** The mini profile the battle UI reads for a borrowed girl (her level, ★ and gear; never LR). */
export function supportMiniProfile(card) {
  return snapshotToMiniProfile(card);
}

/** The loadout entry of a borrowed (already clamped) girl: { unitId, stats }. */
export function supportLoadoutEntry(card) {
  return { unitId: card.id, stats: unitBattleStats(supportMiniProfile(card), card.id) };
}

/** A girl the borrower already brings (greyed in the Support slot). */
export const alreadyBrought = (towers, unitId) => (towers || []).includes(unitId);

/**
 * The battle record's marker (BANNERS §E.1): `{ unitId, owner, key, card }` at the record level, so Continue keeps
 * her. Returns null for anything malformed (battleSave.js cleanRecord then drops the whole record: a run with a
 * borrowed girl never continues as a normal run).
 */
export function cleanSupportMark(raw) {
  if (!isObj(raw) || typeof raw.unitId !== 'string' || !UNIT_MAP[raw.unitId] || typeof raw.owner !== 'string' || raw.owner.length > 64) return null;
  if (raw.key != null && !(typeof raw.key === 'string' && /^[0-9a-f-]{8,64}$/i.test(raw.key))) return null;
  if (!isObj(raw.card) || raw.card.id !== raw.unitId) return null;
  const card = cleanViewedCard({ v: 1, units: [raw.card] }).units[0];
  if (!card) return null;
  return { unitId: raw.unitId, owner: raw.owner, key: raw.key ?? null, card: { ...card, aw: Math.min(card.aw, MAX_AWAKEN) } };
}

// ---------------------------------------------------------------------------
// Where a Support Student may fight (E.1: campaign, Bounty and solo Freeplay in v1)
// ---------------------------------------------------------------------------

/**
 * @param {object} p profile
 * @param {object} stage STAGE_MAP entry
 * @param {{ difficulty?: string, freeplay?: string|null, coop?: boolean, clanBoss?: boolean, titan?: boolean,
 *   sandbox?: boolean, tutorial?: boolean, practice?: boolean, endless?: boolean }} [run]
 * @returns {boolean}
 */
export function supportAllowed(p, stage, run = {}) {
  const st = typeof stage === 'string' ? STAGE_MAP[stage] : stage;
  if (!st || !['campaign', 'resource'].includes(st.kind)) return false;
  if (run.coop || run.clanBoss || run.titan || run.sandbox || run.tutorial || run.practice || run.endless) return false;
  // a Limit Break trial in progress on its stand-in (8-5 Nightmare): her own girls only
  for (const [unitId, trial] of Object.entries(LR_TRIALS)) {
    if (!trial || !p?.units?.[unitId] || cnt(p, `lbt:${unitId}`) < 1 || isLR(p, unitId)) continue;
    if (trial.standIn.stageId === st.id && trial.standIn.difficulty === run.difficulty) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Friend Points wallet (client-side until the server keeps saves)
// ---------------------------------------------------------------------------

/** The wallet (0–5,000). */
export const fpWallet = (p) => Math.max(0, Math.min(FP_WALLET_CAP, cnt(p, FP_KEY)));
/** FP the wallet can still take. */
export const fpRoom = (p) => FP_WALLET_CAP - fpWallet(p);

/** Adds FP, clamped to the wallet's 5,000. @returns {number} what was added */
export function addFp(p, n) {
  const add = Math.max(0, Math.min(fpRoom(p), Math.floor(Number(n) || 0)));
  counters(p)[FP_KEY] = fpWallet(p) + add;
  return add;
}
