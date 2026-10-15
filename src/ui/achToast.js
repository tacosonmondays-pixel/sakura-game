// The achievement unlock toast (docs/specs/ACHIEVEMENTS.md §5.2). After each commit, the rows that became claimable
// since the last check (achievementsReady) are queued. Never during a battle (they wait for the next screen; the
// result sheet has its own "★ n achievements ready ›" line), never on app start or update day: the first check only
// sets the baseline. One toast at a time, 3.2 s; more coalesce into "+N more". Tapping opens the tab on that row.

import './styles/honors.css';
import './styles/achievements.css';
import { h } from './dom.js';
import { toast, svgEl } from './components.js';
import { navigate, currentRoute } from './router.js';
import { achievementsReady, readyAchievementIds } from '../systems/missions.js';
import { ACHIEVEMENT_MAP, ACHIEVEMENT_CATEGORIES } from '../data/achievements.js';
import { HONOR_MAP, TITLE_MAP } from '../data/honors.js';
import { getItem } from '../data/items.js';
import { uiIcon } from '../art/icons.js';
import { ribbonArt } from './honorFx.js';
import { formatNumber } from '../core/util.js';

/** Screens that hold toasts back: a battle (and its result sheet), a story scene, the title. */
const HOLD = new Set(['battle', 'scene', 'title']);
const TOAST_MS = 3200;
/** Commits that never toast (a whole new profile, or nothing achievement-related). */
const QUIET = new Set(['replace', 'app-start', 'settings', 'honors-seen', 'titles-seen']);

let baseline = null; // Set of ready ids already announced (or present at the first check)
let pending = [];
let showing = false;
let storeRef = null;

/** The reward line: "💎 50 · Ornate Gear Box · Honor Ribbon · Title". */
export function rewardLine(a) {
  const parts = a.rewards.map((r) => (r.id === 'gems' ? `💎 ${formatNumber(r.count)}` : `${getItem(r.id)?.name || r.id}${r.count > 1 ? ` ×${r.count}` : ''}`));
  if (HONOR_MAP[a.id]) parts.push('Honor Ribbon');
  if (TITLE_MAP[a.id]) parts.push('Title');
  return parts.join(' · ');
}

function card(id, more) {
  const a = ACHIEVEMENT_MAP[id];
  const hr = HONOR_MAP[id];
  const special = hr?.class === 'special';
  const secret = !!a.hidden;
  const cat = ACHIEVEMENT_CATEGORIES.find((c) => c.id === a.cat);
  const tile = h('span.ach-cattile', svgEl(uiIcon(cat?.icon || 'trophy'), 'ach-cattile-ico'));
  tile.style.setProperty('--cc', cat?.color || '#2b7fff');
  const el = h(`button.ach-toast${special ? '.special' : ''}${secret ? '.secret' : ''}`, {
    'data-testid': 'ach-toast',
    'data-id': id,
    onclick: () => navigate('commissions', { tab: 'achievements', highlight: id }),
  },
  h('span.ach-toast-ico', hr ? ribbonArt(id, 44, { still: true }) : tile),
  h('span.ach-toast-text',
    h('span.ach-toast-k', secret ? 'Secret found!' : 'Achievement complete', special ? h('em', ' · Special ribbon') : null),
    h('span.ach-toast-name', a.name),
    h('span.ach-toast-rew', rewardLine(a))),
  h('span.ach-toast-go', 'Claim ›'),
  more ? h('span.ach-toast-more', `+${more} more`) : null);
  return el;
}

function flush() {
  if (showing || !pending.length) return;
  if (HOLD.has(currentRoute().name)) return;
  const [first, ...rest] = pending;
  pending = [];
  showing = true;
  toast(card(first, rest.length), 'ach', TOAST_MS);
  setTimeout(() => {
    showing = false;
    flush();
  }, TOAST_MS + 450);
}

/** Queue toasts for these newly ready ids (shown when the current screen allows). */
export function queueAchievementToasts(ids) {
  for (const id of ids) if (ACHIEVEMENT_MAP[id] && !pending.includes(id)) pending.push(id);
  flush();
}

/** Show what is queued if the current screen allows it (call on a screen change). */
export function flushAchievementToasts() {
  check();
  flush();
}

/** Compare the ready rows with the baseline; the first call only sets it. */
function check() {
  if (!storeRef || HOLD.has(currentRoute().name)) return;
  let ready;
  try {
    ready = readyAchievementIds(storeRef.profile);
  } catch (e) {
    console.warn('[achievements] ready check failed', e);
    return;
  }
  if (!baseline) {
    baseline = new Set(ready);
    return;
  }
  const fresh = achievementsReady([...baseline], ready);
  for (const id of ready) baseline.add(id);
  if (fresh.length) queueAchievementToasts(fresh);
}

/**
 * Rows that became ready since the last announced check, without consuming them (the battle result sheet's line).
 * @returns {string[]}
 */
export function newlyReadyIds() {
  if (!storeRef || !baseline) return [];
  try {
    return achievementsReady([...baseline], readyAchievementIds(storeRef.profile));
  } catch {
    return [];
  }
}

/** Wire the toasts to the store and the router (once, at boot). The first check is the baseline. */
export function installAchievementToasts(store) {
  if (storeRef) return;
  storeRef = store;
  check();
  store.on('change', (e) => {
    const reason = e?.reason || 'change';
    if (reason === 'replace') {
      baseline = null;
      pending = [];
      check();
      return;
    }
    if (QUIET.has(reason)) return;
    check();
  });
  window.addEventListener('hashchange', () => setTimeout(() => {
    check();
    flush();
  }, 400));
}

/** Tests: forget the baseline and the queue. */
export function resetAchievementToasts() {
  baseline = null;
  pending = [];
  showing = false;
  storeRef = null;
}
