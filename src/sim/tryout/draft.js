// Tryout Day's Before Class draft (docs/specs/TRYOUT_DAY.md §5): a pure function of the seed, the slot, the redraw and
// the girls a player owns, so co-op can check each player's three against their own six (src/online/coop/commands.js).
import { TRYOUT, TRYOUT_STUDENTS } from '../../data/tryout.js';
import { UNIT_MAP } from '../../data/units.js';
import { ROLES } from '../../data/types.js';
import { stream } from './plan.js';

const category = (id) => ROLES[UNIT_MAP[id]?.role]?.category;
const isStriker = (id) => category(id) === 'dps' || category(id) === 'frag';
const hitsAir = (id) => !!UNIT_MAP[id]?.base?.canHitAir;
const isCtrlSup = (id) => category(id) === 'control' || category(id) === 'support';

/**
 * Before Class's six (§5): 2 strikers, 1 girl who hits flyers at tier 0, 1 Control or Support girl; 4 of the 6
 * are the player's own when they own at least 4 students. Seeded (`draft:<slot>:<redraw>`).
 * @param {(id: string) => boolean} owned
 * @returns {string[]}
 */
export function draftOf(owned, seed, slot = 0, redraw = 0) {
  const rng = stream(seed, `draft:${slot}:${redraw}`);
  const all = TRYOUT_STUDENTS.filter((id) => UNIT_MAP[id]);
  const mine = all.filter(owned);
  const wantOwned = mine.length >= TRYOUT.squad.draftOwned ? TRYOUT.squad.draftOwned : mine.length;
  const out = [];
  const take = (list) => {
    const free = list.filter((id) => !out.includes(id));
    if (!free.length) return false;
    out.push(free[Math.floor(rng.next() * free.length)]);
    return true;
  };
  const ownedLeft = () => wantOwned - out.filter(owned).length;
  const from = (test) => {
    // an owned girl while the owned quota lasts, else anyone
    if (ownedLeft() > 0 && take(mine.filter(test))) return;
    take(all.filter(test));
  };
  for (let i = 0; i < TRYOUT.draftNeeds.strikers; i++) from(isStriker);
  for (let i = 0; i < TRYOUT.draftNeeds.antiAir; i++) if (!out.some(hitsAir)) from(hitsAir);
  for (let i = 0; i < TRYOUT.draftNeeds.controlSupport; i++) if (!out.some(isCtrlSup)) from(isCtrlSup);
  while (out.length < TRYOUT.squad.draft) {
    if (ownedLeft() > 0 && take(mine)) continue;
    if (!take(all.filter((id) => !owned(id)))) take(all);
  }
  return out;
}

/**
 * A co-op player's squad (§11): their three when every one is in their own six (either draw: one free Redraw),
 * else the first three of their six. Owned = in their frozen pool (frozenPool keeps owned students only).
 */
export function checkedDraft(draft, pool, seed, slot) {
  const owned = (id) => !!pool && Object.prototype.hasOwnProperty.call(pool, id);
  const six = draftOf(owned, seed, slot, 0);
  const list = Array.isArray(draft) ? draft.filter((id) => typeof id === 'string').slice(0, TRYOUT.squad.start) : [];
  if (list.length === TRYOUT.squad.start && new Set(list).size === list.length) {
    for (let r = 0; r <= TRYOUT.squad.redraws; r++) {
      const draw = r === 0 ? six : draftOf(owned, seed, slot, r);
      if (list.every((id) => draw.includes(id))) return list;
    }
  }
  return six.slice(0, TRYOUT.squad.start);
}
