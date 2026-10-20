// Inventory helpers + "where to get" sources (owner: systems). See CONTRACTS.md §5.
//
// Cost / reward lists are [{ id, count }]. 'coins' and 'gems' live in profile.currencies,
// 'recruitPoints' in profile.gacha; everything else in profile.items.

import { getItem, ITEMS } from '../data/items.js';
import { STAGES } from '../data/stages.js';
import { SHOP_OFFERS, SHOP_TABS } from '../data/shop.js';
import { DAILY_MISSIONS, WEEKLY_MISSIONS, LOGIN_REWARDS, ACHIEVEMENTS } from '../data/missions.js';
import { achievementLive } from '../data/achievements.js';
import { DIFFICULTIES, DIFFICULTY_ORDER, ITEM_RARITIES, MATERIAL_FAMILIES } from '../data/types.js';
import { mirrorItem } from './ascensionSave.js';

/** Merge duplicate ids and drop non-positive counts. */
export function normalizeList(list) {
  const map = new Map();
  for (const e of list || []) {
    if (!e || typeof e.id !== 'string') continue;
    const n = Math.floor(Number(e.count) || 0);
    if (n <= 0) continue;
    map.set(e.id, (map.get(e.id) || 0) + n);
  }
  return [...map].map(([id, count]) => ({ id, count }));
}

/**
 * Owned amount of an item or pseudo-currency.
 * @param {object} profile
 * @param {string} id
 * @returns {number}
 */
export function itemCount(profile, id) {
  if (id === 'coins' || id === 'gems') return profile.currencies?.[id] || 0;
  if (id === 'recruitPoints') return profile.gacha?.recruitPoints || 0;
  return profile.items?.[id] || 0;
}

function setCount(profile, id, value) {
  const v = Math.max(0, Math.floor(value));
  if (id === 'coins' || id === 'gems') profile.currencies[id] = v;
  else if (id === 'recruitPoints') profile.gacha.recruitPoints = v;
  else if (v > 0) profile.items[id] = v;
  else delete profile.items[id];
  // Ascension's 16 items: a copy in missions.counters that an older build keeps (ascensionSave.js)
  mirrorItem(profile, id, v);
}

/**
 * Add rewards to the profile. Gems also count toward stats.gemsEarned.
 * @param {object} profile
 * @param {{id:string,count:number}[]} rewards
 * @returns {{id:string,count:number}[]} the normalized list that was added
 */
export function addItems(profile, rewards) {
  const list = normalizeList(rewards);
  for (const { id, count } of list) {
    setCount(profile, id, itemCount(profile, id) + count);
    if (id === 'gems' && profile.stats) profile.stats.gemsEarned = (profile.stats.gemsEarned || 0) + count;
  }
  return list;
}

/**
 * @returns {{id:string,need:number,have:number}[]} costs the profile cannot cover
 */
export function missingItems(profile, costs) {
  return normalizeList(costs)
    .map(({ id, count }) => ({ id, need: count, have: itemCount(profile, id) }))
    .filter((m) => m.have < m.need);
}

/** @returns {boolean} true when every cost is covered */
export function hasItems(profile, costs) {
  return missingItems(profile, costs).length === 0;
}

/**
 * Remove costs atomically: either everything is paid or nothing changes.
 * @returns {boolean}
 */
export function consumeItems(profile, costs) {
  if (!hasItems(profile, costs)) return false;
  for (const { id, count } of normalizeList(costs)) setCount(profile, id, itemCount(profile, id) - count);
  return true;
}

// ---------------------------------------------------------------------------
// Item sources ("Where to get" + Teleport)
// ---------------------------------------------------------------------------

const KIND_LABEL = { campaign: 'Mission', resource: 'Bounty', boss: 'Total Assault', challenge: 'Tactical Challenge' };
const KIND_ROUTE = { resource: 'bounty', boss: 'assault', challenge: 'challenge' };
const pct = (p) => `${Math.round(p * 1000) / 10}%`;
const diffIndex = (d) => (d ? DIFFICULTY_ORDER.indexOf(d) : 0);

/** Chance of at least one drop and expected count per run at a difficulty. */
function stageItemOdds(stage, itemId, difficulty) {
  let none = 1;
  let expected = 0;
  for (const d of stage.drops) {
    if (d.item !== itemId || diffIndex(d.difficulty) > diffIndex(difficulty)) continue;
    none *= 1 - d.chance;
    expected += d.chance * (d.min + d.max) / 2;
  }
  return { chance: 1 - none, expected };
}

let SOURCE_INDEX = null;

function buildSourceIndex() {
  const index = {};
  const push = (id, src) => (index[id] ||= []).push(src);

  // Stages: one row per stage, describing the easiest difficulty it drops on and the best odds.
  STAGES.forEach((stage, order) => {
    const ids = [...new Set(stage.drops.map((d) => d.item))];
    for (const id of ids) {
      const minDiff = DIFFICULTY_ORDER.find((d) => stageItemOdds(stage, id, d).chance > 0);
      const best = stageItemOdds(stage, id, 'nightmare');
      const first = stageItemOdds(stage, id, minDiff);
      const prefix = stage.kind === 'campaign' ? `${KIND_LABEL.campaign} ${stage.id}` : KIND_LABEL[stage.kind];
      const notes = [minDiff === 'easy' ? pct(first.chance) : `${DIFFICULTIES[minDiff].name}+ ${pct(first.chance)}`];
      if (best.chance > first.chance + 1e-9) notes.push(`up to ${pct(best.chance)} on harder difficulties`);
      push(id, {
        kind: 'stage',
        label: `${prefix} · ${stage.name}`,
        stageId: stage.id,
        route: 'stage',
        params: { id: stage.id },
        note: notes.join(' · '),
        chance: Math.round(best.chance * 1000) / 1000,
        minDifficulty: minDiff,
        expected: Math.round(best.expected * 100) / 100,
        order,
        stageKind: stage.kind,
        hub: KIND_ROUTE[stage.kind] || 'campaign',
      });
    }
  });

  // Mall offers.
  for (const offer of SHOP_OFFERS) {
    if (!offer.item) continue;
    const tab = SHOP_TABS.find((t) => t.id === offer.tab);
    const priceName = getItem(offer.currency)?.name || (offer.currency === 'recruitPoints' ? 'Recruit Points' : offer.currency);
    const limit = offer.resets ? ` · ${offer.stock}/${offer.resets === 'never' ? 'account' : offer.resets === 'daily' ? 'day' : 'week'}` : '';
    push(offer.item, {
      kind: 'shop',
      label: `Mall · ${tab.name}`,
      route: 'mall',
      params: { tab: offer.tab },
      note: `${offer.count > 1 ? `×${offer.count} for ` : ''}${offer.price.toLocaleString('en-US')} ${priceName}${limit}`,
      offerId: offer.id,
    });
  }

  // Commissions, login, achievements.
  const rewardSource = (list, label, note, route = 'commissions', params = {}) => {
    const seen = new Set();
    for (const entry of list) for (const r of entry.rewards) if (!seen.has(r.id)) {
      seen.add(r.id);
      push(r.id, { kind: 'mission', label: typeof label === 'function' ? label(r) : label, route, params, note: typeof note === 'function' ? note(entry, r) : note });
    }
  };
  rewardSource(DAILY_MISSIONS, 'Daily Commissions', (m, r) => `${m.name}: ×${r.count} per day`, 'commissions', { tab: 'daily' });
  rewardSource(WEEKLY_MISSIONS, 'Weekly Commissions', (m, r) => `${m.name}: ×${r.count} per week`, 'commissions', { tab: 'weekly' });
  rewardSource(LOGIN_REWARDS, 'Login Calendar', (d, r) => `Day ${d.day}: ×${r.count}`, 'commissions', { tab: 'login' });
  // achievements: one row per item, "Achievements (n)" = how many live achievements grant it
  const liveAch = ACHIEVEMENTS.filter((a) => achievementLive(a)).sort((a, b) => !!a.hidden - !!b.hidden); // secrets never named
  const achGrants = {};
  for (const a of liveAch) for (const id of new Set(a.rewards.map((r) => r.id))) achGrants[id] = (achGrants[id] || 0) + 1;
  rewardSource(liveAch, (r) => `Achievements (${achGrants[r.id]})`, (a, r) => `${a.hidden ? 'A secret achievement' : a.name}: ×${r.count} (one-time)`, 'commissions', { tab: 'achievements' });

  // Special sources not in any table.
  // Ascension (docs/specs/ASCENSION.md): duplicates give Essence now; the titans pay the rest
  const TITANS_SRC = (note) => ({ kind: 'other', label: 'Titan Trials', route: 'titans', params: {}, note });
  push('star_fragment', TITANS_SRC('Every titan fight pays fragments; Normal first clears pay 20'));
  // Akashic Tomes pay the levels above 60 (Potential v3 §4.4): besides Library Courtyard III on
  // Nightmare, the Bounty Exchange, the Titan shelf and the Memento Exchange (all in the tables above)
  push('book_legendary', { kind: 'other', label: 'Freeplay caches', route: 'campaign', params: {}, note: 'One per freeplay cache (every 25 freeplay waves), up to 2 a week, solo and co-op together' });
  push('book_legendary', TITANS_SRC('Nightmare 20% · Mayhem 30% per fight'));
  for (const f of Object.keys(MATERIAL_FAMILIES)) {
    push(`mat_${f}_zenith`, TITANS_SRC('Victory Chest: Nightmare 20% · Mayhem 50%+; the titans that drop this family'));
    push(`mat_${f}_legendary`, TITANS_SRC('From Hard up; the titans that drop this family'));
    push(`mat_${f}_mythic`, TITANS_SRC('From Hard up; the titans that drop this family'));
  }
  push('crown_rainbow_shard', TITANS_SRC('Victory Chest from Hard · first clears; 10 shards fuse into a Rainbow Crown'));
  push('crown_rainbow', TITANS_SRC('10 Rainbow Crown Shards fuse into one · Mayhem first clear · rare whole crown from Mayhem'));
  push('crown_rainbow', { kind: 'other', label: 'Rainbow Crown Shards', route: 'backpack', params: { tab: 'awakening' }, note: '10 shards fuse on their own' });
  push('kindred_r', TITANS_SRC('Normal first clears: 2 per titan'));
  push('kindred_sr', TITANS_SRC('Hard first clears: 1 per titan'));
  push('kindred_shard_ssr', TITANS_SRC('Mayhem Victory Chest 4%'));
  push('kindred_ssr', { kind: 'other', label: 'Kindred Shards (SSR)', route: 'backpack', params: { tab: 'awakening' }, note: '10 shards fuse on their own' });
  push('gearbox_rainbow', TITANS_SRC('Mayhem Victory Chest 4% (Rainbow Meter: one by the 40th Mayhem win) · Nightmare 0.5%'));
  push('memento', { kind: 'other', label: 'Spare duplicates', route: 'recruit', params: {}, note: 'A copy past her Essence cap: R ×2 · SR ×6' });
  push('moonpearl', { kind: 'other', label: 'Spare duplicates', route: 'recruit', params: {}, note: 'A copy past her Essence cap: SR ×1 · SSR ×10' });
  push('token_boss', TITANS_SRC('Every fight; the Titan of the Week pays +50%'));
  for (const r of Object.keys(ITEM_RARITIES)) {
    push(`gearbox_${r}`, { kind: 'other', label: 'Bounty · Gear arena', route: 'bounty', params: {}, note: 'Gear boxes open into real gear the moment they drop.' });
  }
  push('ticket_ssr_select', { kind: 'other', label: 'Mail · Beta Tester Thank-You', route: 'lobby', params: {}, note: 'One per account created on or before Nov 7, 2026' });
  // rainbow UR gear and the Academy Clubs (gear-awaken §6, gear-stats §C.4): never sold for gems
  push('seed_rainbow', { kind: 'other', label: 'First rainbow gift', route: 'backpack', params: { tab: 'equipment' }, note: 'One Seed the first time a gold piece reaches +10' });
  push('seed_rainbow', { kind: 'other', label: 'Freeplay · Ashwing Matriarch', route: 'campaign', params: {}, note: 'One Seed per freeplay tier, the first time she is defeated' });
  push('needle_star', { kind: 'other', label: 'Freeplay caches', route: 'campaign', params: {}, note: 'The first freeplay cache of each week holds one' });
  push('needle_star', { kind: 'other', label: 'Freeplay · Reached wave 150', route: 'campaign', params: {}, note: 'Two Needles per freeplay tier, once' });
  push('needle_star', { kind: 'other', label: 'Take back / salvage', route: 'backpack', params: { tab: 'equipment' }, note: 'Taking back a stitch or salvaging the piece returns its Needles' });
  push('club_band', { kind: 'other', label: 'Welcome gift', route: 'backpack', params: { tab: 'equipment' }, note: '9 Armbands with your first Mythic or better piece' });
  push('coins', { kind: 'other', label: 'Gear salvage', route: 'backpack', params: { tab: 'equipment' }, note: 'Salvaging gear refunds coins.' });
  push('dice_reroll', { kind: 'other', label: 'Gear salvage', route: 'backpack', params: { tab: 'equipment' }, note: 'Super Rare or better gear salvages into Fortune Dice.' });

  // Sort: stages by best chance × expected (then easier difficulty and earlier stages for equal odds),
  // then shop, then missions, then other.
  const kindRank = { stage: 0, shop: 1, mission: 2, other: 3 };
  for (const list of Object.values(index)) {
    list.sort((a, b) => kindRank[a.kind] - kindRank[b.kind]
      || (b.chance ?? 0) - (a.chance ?? 0)
      || (b.expected ?? 0) - (a.expected ?? 0)
      || diffIndex(a.minDifficulty) - diffIndex(b.minDifficulty)
      || (a.order ?? 0) - (b.order ?? 0));
  }
  return index;
}

/**
 * Where an item can be obtained, best sources first. Stage sources carry `stageId`
 * (UI "Teleport" → stage prep), other sources carry `route` + `params`.
 * @param {string} itemId
 * @returns {{ label: string, stageId?: string, route?: string, params?: object, note: string, chance?: number, kind: string }[]}
 */
export function itemSources(itemId) {
  if (!SOURCE_INDEX) SOURCE_INDEX = buildSourceIndex();
  if (!ITEMS[itemId]) return [];
  return (SOURCE_INDEX[itemId] || []).map((s) => ({ ...s, params: { ...(s.params || {}) } }));
}

/**
 * Best stage to farm an item right now (unlocked check is optional).
 * @param {string} itemId
 * @param {(stageId:string)=>boolean} [isUnlocked]
 * @returns {object|null} source with stageId
 */
export function bestStageFor(itemId, isUnlocked = () => true) {
  return itemSources(itemId).find((s) => s.stageId && isUnlocked(s.stageId)) || null;
}
