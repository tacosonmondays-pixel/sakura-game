// Claiming achievements (docs/specs/ACHIEVEMENTS.md §5.3): three levels — items only → the rewards modal; a Plain or
// Shiny ribbon and/or a title → the modal gets a hero strip; a special ribbon → the full-screen fanfare first. Claim
// all → one commit, the fanfare for its specials, then one modal with NEW HONOR RIBBONS / NEW TITLES / REWARDS and
// Later · Open N gear boxes · OK. Also the small info sheets of a ribbon or title chip, and the Titles sheet.

import { h } from '../../dom.js';
import { modal, toast, svgEl } from '../../components.js';
import { uiIcon } from '../../../art/icons.js';
import { navigate, hasRoute } from '../../router.js';
import { store } from '../../../core/store.js';
import { createRng } from '../../../core/rng.js';
import { ACHIEVEMENT_MAP } from '../../../data/achievements.js';
import { HONOR_MAP, TITLE_MAP, HONOR_CLASSES, HONOR_EFFECTS, EFFECT_LINES } from '../../../data/honors.js';
import { claimAchievement, claimAllAchievements, achievementList } from '../../../systems/missions.js';
import { ownedRibbons, ownedTitles, titleGroups, markTitlesSeen, titlesFromText } from '../../../systems/honors.js';
import { openGearBox } from '../../../systems/gear.js';
import { itemCount } from '../../../systems/inventory.js';
import { featureStage } from '../../../systems/story.js';
import { ribbonArt, titlePlate, revealShiny, liveHonors } from '../../honorFx.js';
import { showRewardsModal, tile, gearTile } from '../stage.js';
import { boxSummary, SUMMARY_ABOVE } from '../../gearSummary.js';
import { showSpecialFanfare } from './fanfare.js';
import { recentHonors } from './case.js';

let busy = false;
const CLS_ORDER = { special: 0, shiny: 1, plain: 2 };
const isSpecial = (id) => HONOR_MAP[id]?.class === 'special';

/** "Equip" a new title: opens Edit Profile → Title when the Sensei Profile is in this build. */
function equipButton(id) {
  if (!hasRoute('profile')) return null;
  return h('button.ach-equip', { 'data-testid': `ach-equip-${id}`, onclick: () => { document.querySelectorAll('.modal-overlay').forEach((o) => o.remove()); navigate('profile', { edit: 'title', title: id }); } }, 'Equip');
}

/** The Claim-all modal's strips. */
export function rewardsExtra({ honors = [], titles = [], rewards = [] } = {}) {
  const el = h('div.ach-extra');
  if (honors.length) {
    const sorted = [...honors].sort((a, b) => CLS_ORDER[HONOR_MAP[a].class] - CLS_ORDER[HONOR_MAP[b].class] || HONOR_MAP[a].no - HONOR_MAP[b].no);
    const cards = sorted.slice(0, 8).map((id) => {
      const hh = HONOR_MAP[id];
      const art = ribbonArt(id, 64, { prio: 2 });
      if (hh.class === 'shiny') requestAnimationFrame(() => revealShiny(art));
      return h(`div.ach-newrib.${hh.class}`, { 'data-testid': `ach-new-ribbon-${id}` }, art, h('b', hh.name.replace(/ Ribbon$/, '')), h(`span.ach-cls.${hh.class}`, HONOR_CLASSES[hh.class]));
    });
    el.appendChild(h('div.ach-strip', { 'data-testid': 'ach-strip-ribbons' },
      h('div.ach-strip-k', `New Honor Ribbons · ${honors.length}`),
      h('div.ach-strip-row', cards, sorted.length > 8 ? h('div.ach-newrib.more', `+${sorted.length - 8}`) : null)));
  }
  if (titles.length) {
    const sorted = [...titles].sort((a, b) => ['prism', 'gold', 'standard'].indexOf(TITLE_MAP[a].plate) - ['prism', 'gold', 'standard'].indexOf(TITLE_MAP[b].plate));
    el.appendChild(h('div.ach-strip', { 'data-testid': 'ach-strip-titles' },
      h('div.ach-strip-k', `New Titles · ${titles.length}`),
      h('div.ach-strip-row.titles', sorted.map((id) => h('span.ach-newtitle', titlePlate(id), equipButton(id))))));
  }
  if (rewards.length) {
    el.appendChild(h('div.ach-strip', { 'data-testid': 'ach-strip-rewards' },
      h('div.ach-strip-k', 'Rewards'),
      h('div.ach-strip-row.rewards', rewards.map((r) => tile(r.id, r.count, { size: 56, showName: true })))));
  }
  return el;
}

/** The hero strip of a single claim with a Plain/Shiny ribbon and/or a title (pops in once; still under Reduce Motion). */
function heroStrip(id) {
  const a = ACHIEVEMENT_MAP[id];
  const honor = a.honor ? HONOR_MAP[id] : null;
  const title = a.title ? TITLE_MAP[id] : null;
  if (!honor && !title) return null;
  const art = honor ? ribbonArt(id, 96, { prio: 3 }) : null;
  if (honor?.class === 'shiny') requestAnimationFrame(() => revealShiny(art));
  return h('div.ach-hero', { 'data-testid': 'ach-hero' },
    art ? h('div.ach-hero-rib', art) : null,
    h('div.ach-hero-text',
      honor ? h('div', h('span.ach-micro', 'New Honor Ribbon'), h('b', honor.name), h(`span.ach-cls.${honor.class}`, HONOR_CLASSES[honor.class])) : null,
      title ? h('div.ach-hero-title', h('span.ach-micro', 'New title'), titlePlate(id), equipButton(id)) : null));
}

/** Gear boxes granted by a claim: { gearbox_rare: 2, … }. */
const boxesIn = (rewards) => Object.fromEntries(rewards.filter((r) => r.id.startsWith('gearbox_')).map((r) => [r.id, r.count]));

/**
 * "Open N gear boxes": opens what the claim granted (capped by what is owned), one call per rarity, one commit.
 * Above 12 pieces it shows the summary.
 */
export function openClaimedBoxes(granted, { onDone = null } = {}) {
  const p = store.profile;
  const gear = [];
  const rng = createRng((Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0);
  let full = false;
  for (const [id, n] of Object.entries(granted)) {
    const k = Math.min(n, itemCount(p, id));
    if (k <= 0) continue;
    const r = openGearBox(p, id, rng, k);
    if (r.ok) gear.push(...r.gear);
    // the gear bag's limit (or one tap's limit) stopped it: the rest stay in the backpack
    if (!r.ok ? r.error === 'bagFull' : r.opened < k) full = true;
  }
  if (!gear.length) {
    toast(full ? 'Your gear bag is full. Salvage some gear first; the boxes stay in your backpack.' : 'No gear boxes left to open.', 'info');
    return;
  }
  if (full) toast('Some boxes stay in your backpack: the gear bag is full, or that was the most one tap opens.', 'info', 4200);
  store.commit('gearbox-open');
  const seeAll = (close) => { close(); navigate('backpack', { tab: 'equipment' }); };
  let m;
  const body = gear.length > SUMMARY_ABOVE
    ? boxSummary(gear)
    : h('div.ach-gear-grid', gear.map((g) => h('div.item-tile-wrap', gearTile(g, { size: 60 }), h('div.item-tile-name', g.name))));
  m = modal({ title: `${gear.length} pieces of gear`, body, wide: true, cls: 'ach-modal', actions: [{ label: 'See all in Equipment', onClick: seeAll }, { label: 'Nice!', kind: 'yellow', testid: 'ach-gear-ok' }], onClose: onDone });
  return m;
}

function claimActions(granted, onDone) {
  const n = Object.values(granted).reduce((a, b) => a + b, 0);
  const actions = [{ label: 'Later', testid: 'ach-later' }];
  if (n) actions.push({ label: `Open ${n} gear box${n === 1 ? '' : 'es'}`, kind: 'primary', testid: 'ach-open-boxes', onClick: (close) => { close(); openClaimedBoxes(granted, { onDone }); } });
  actions.push({ label: 'OK', kind: 'yellow', testid: 'ach-ok' });
  return actions;
}

const NOTE = 'Gear boxes wait in Backpack → Equipment until you open them.';

/** Claim one row. */
export async function claimOne(id, { onDone = null } = {}) {
  if (busy) return;
  const p = store.profile;
  const r = claimAchievement(p, id);
  if (!r.ok) {
    if (r.error === 'locked') toast(`Claim this after stage ${featureStage(r.feature) || '2-1'}.`, 'info');
    return;
  }
  busy = true;
  if (HONOR_MAP[id]) recentHonors.add(id);
  const special = isSpecial(id) && !!ACHIEVEMENT_MAP[id].honor;
  store.commit(special ? 'achievements-special' : 'achievements');
  onDone?.();
  try {
    if (special) await showSpecialFanfare([id]);
    const granted = boxesIn(r.rewards);
    const hero = heroStrip(id);
    const m = showRewardsModal({
      title: ACHIEVEMENT_MAP[id].name,
      rewards: r.rewards,
      note: Object.keys(granted).length ? NOTE : null,
      extra: hero,
      actions: Object.keys(granted).length ? claimActions(granted, onDone) : [{ label: 'OK', kind: 'yellow', testid: 'ach-ok' }],
    });
    m.el.classList.add('ach-modal');
    if (hero) liveHonors(m.el, { budget: 1, ignoreOverlays: true });
  } finally {
    busy = false;
  }
}

/** Claim all: one commit and one modal per tap (deterministic order; repeats until nothing is left). */
export async function claimAll({ onDone = null } = {}) {
  if (busy) return;
  const p = store.profile;
  const r = claimAllAchievements(p);
  if (!r.ok) return;
  busy = true;
  for (const id of r.honors) recentHonors.add(id);
  const specials = r.honors.filter(isSpecial);
  store.commit(specials.length ? 'achievements-special' : 'achievements');
  onDone?.();
  try {
    if (specials.length) await showSpecialFanfare(specials);
    const granted = boxesIn(r.rewards);
    const m = modal({
      title: `Achievement rewards · ${r.ids.length} claimed`,
      body: h('div.ma-rewards-modal', Object.keys(granted).length ? h('p.muted.ach-note', NOTE) : null, rewardsExtra({ honors: r.honors, titles: r.titles, rewards: r.rewards })),
      actions: claimActions(granted, onDone),
      wide: true,
    });
    m.el.classList.add('ma-pop');
    m.el.classList.add('ach-modal', 'ach-claimall');
    m.el.dataset.testid = 'ach-claimall-modal';
    liveHonors(m.el, { budget: 3, ignoreOverlays: true });
  } finally {
    busy = false;
  }
}

/** Tapping a ribbon chip: a small sheet with the 160 px ribbon, its class and effect. */
export function ribbonInfo(id) {
  const hh = HONOR_MAP[id];
  const a = ACHIEVEMENT_MAP[id];
  if (!hh || !a) return;
  const owned = ownedRibbons(store.profile).includes(id);
  const stage = h('div.ach-sheet-stage', ribbonArt(id, 160, { prio: 5 }));
  const body = h('div.ach-sheet',
    stage,
    h('div.ach-sheet-text',
      h('div.ach-sheet-k', `HR-${String(hh.no).padStart(2, '0')} · `, h(`span.ach-cls.${hh.class}`, HONOR_CLASSES[hh.class]), owned ? h('span.ach-owned', '✓ Earned') : null),
      h('h3', hh.name),
      h('p', 'From ', h('b', a.name), ` · ${a.desc}`),
      hh.effect ? h('p.ach-sheet-fx', h('span.ach-micro', 'Effect'), `${HONOR_EFFECTS[hh.effect]}: ${EFFECT_LINES[hh.effect]}`) : h('p.muted', hh.class === 'shiny' ? 'Shiny: a foil ribbon that catches the light.' : 'An Honor Ribbon for your collection.')));
  const m = modal({ title: 'Honor Ribbon', body, cls: 'ach-modal.ach-sheet-modal', actions: [{ label: 'OK', kind: 'yellow' }] });
  liveHonors(m.el, { budget: 1, ignoreOverlays: true });
}

/** Tapping a title chip. */
export function titleInfo(id) {
  const t = TITLE_MAP[id];
  if (!t) return;
  const owned = ownedTitles(store.profile).includes(id);
  const a = ACHIEVEMENT_MAP[id];
  const plateName = { prism: 'Prism · the rarest plate', gold: 'Gold plate', standard: 'Standard plate' }[t.plate];
  modal({
    title: 'Title',
    cls: 'ach-modal',
    body: h('div.ach-titleinfo', titlePlate(id, { live: true }), h('p.muted', plateName), h('p', a ? [h('b', a.name), ` · ${a.desc}`] : t.source),
      h('p.ach-titleinfo-note', owned ? '✓ You have this title. It shows under your name on your Sensei Profile.' : titlesFromText([id]))),
    actions: [{ label: 'OK', kind: 'yellow' }],
  });
}

/** The Titles sheet (header chip): every live title by plate, owned first, with a "How:" line; marks titles seen. */
export function titlesSheet({ onClose = null } = {}) {
  const p = store.profile;
  const groups = titleGroups(p);
  const total = groups.reduce((n, g) => n + g.total, 0);
  const owned = groups.reduce((n, g) => n + g.owned, 0);
  const body = h('div.ach-titles', { 'data-testid': 'ach-titles-sheet' },
    h('p.ach-titles-sub', `${owned} / ${total} earned · ${titlesFromText(groups.flatMap((g) => g.titles.map((t) => t.id)))}`),
    groups.map((g) => h('section.ach-titles-group',
      h(`div.ach-titles-k.${g.plate}`, g.label, h('b', `${g.owned} / ${g.total}`)),
      h('div.ach-titles-row', g.titles.map((t) => h(`div.ach-titles-item${t.owned ? '' : '.locked'}`, { title: t.how },
        titlePlate(t.id, { small: true, locked: !t.owned }),
        t.owned ? null : svgEl(uiIcon('lock'), 'ach-titles-lock'),
        h('small', t.owned ? t.source : `How: ${t.how}`)))))));
  if (markTitlesSeen(p)) store.commit('titles-seen', { quiet: true });
  modal({ title: 'Titles', body, wide: true, cls: 'ach-modal', actions: [{ label: 'OK', kind: 'yellow' }], onClose });
}

/** Ids met but locked behind a feature gate (for "Claim after stage 2-1" notes). */
export function lockedIds(profile = store.profile) {
  return achievementList(profile).filter((a) => a.locked).map((a) => a.id);
}

