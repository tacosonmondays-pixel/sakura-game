// The club lab hub (docs/specs/BANNERS.md §G, UI_DIRECTION E3): a left rail with two sections,
// "Workbench" (timed crafts: start, leave, come back) and "Craft Room" (the instant family-material
// combine and swap, exactly as before: each material opens the same Craft Room sheet as its Backpack info).
// Route: #/workbench?tab=bench|craft
import '../styles/meta-b.css';
import '../styles/workbench.css';
import { h, clear, screen, svgEl, button, itemTile, toast, confirmDialog } from '../components.js';
import { rail, fillIn } from '../kit.js';
import { store } from '../../core/store.js';
import { fmtNum } from '../format.js';
import { formatCountdown, nextWeeklyReset } from '../../core/reset.js';
import { ITEMS, getItem } from '../../data/items.js';
import { MATERIAL_FAMILIES, ITEM_RARITIES } from '../../data/types.js';
import { WB_RECIPES, WB_THIRD_SLOT_STAGE, WB_MAX_SLOTS } from '../../data/workbench.js';
import { itemIcon } from '../../art/icons.js';
import { itemCount } from '../../systems/inventory.js';
import { craftInfo } from '../../systems/craft.js';
import {
  WB_FAMILIES, workbenchState, startPreview, startCraft, cancelCraft, collectCraft, touchWorkbench, recipeCosts, inputItem,
} from '../../systems/workbench.js';
import { rememberParams } from '../router.js';

const CLOCK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.6"/><path d="M12 7.4V12l3.2 2"/></svg>';
const REASON = {
  slot: 'No free slot', busy: 'That slot is busy', missing: 'Not enough materials or coins', weekly: 'Weekly limit reached',
  offWeek: 'Back next week', family: 'Pick a family', recipe: 'Unknown recipe', ready: 'It is ready: collect it',
};

/** The family picked for the next craft (kept while the game is open). */
const pick = { family: null, slot: null };

/** "Fortune Dice ×2" */
const outName = (r) => r.out.map((o) => `${ITEMS[o.id]?.name || o.id}${o.count > 1 ? ` ×${o.count}` : ''}`).join(' + ');
const hoursText = (r) => `${r.hours}h`;

/** The countdown chip (UI_DIRECTION §5.9): a plate pill, clock + "2h 14m"; red under an hour. */
function countdownChip(ms, testid = null) {
  return h(`span.wb-cd${ms < 3600000 ? '.soon' : ''}`, { 'data-testid': testid, 'aria-label': `${formatCountdown(ms)} left` }, svgEl(CLOCK_SVG, 'wb-cd-ico'), h('span.wb-cd-t', formatCountdown(ms)));
}

/** The family with the most material on hand (the first pick). */
function richestFamily(profile) {
  let best = WB_FAMILIES[0];
  let most = -1;
  for (const f of WB_FAMILIES) {
    let n = 0;
    for (const it of Object.values(ITEMS)) if (it.category === 'material' && it.family === f) n += itemCount(profile, it.id);
    if (n > most) { most = n; best = f; }
  }
  return best;
}

export function render(root, params = {}) {
  const { el, body } = screen('Club Lab', { cls: 'mb-screen wb-screen' });
  root.appendChild(el);
  let tab = params.tab === 'craft' ? 'craft' : 'bench';
  pick.family ||= richestFamily(store.profile);
  // opening the Workbench is a Workbench action: re-anchor after a clock rollback, mark it seen
  const seenBefore = store.profile.missions?.counters?.['wb:seen'];
  if (touchWorkbench(store.profile, Date.now()) || store.profile.missions.counters['wb:seen'] !== seenBefore) store.commit('workbench-open');

  const content = h('div.wb-content');
  const railEl = rail([
    { id: 'bench', label: 'Workbench', icon: 'upgrade' },
    { id: 'craft', label: 'Craft Room', icon: 'refresh' },
  ], tab, (id) => {
    tab = id;
    railEl.setActive(id);
    rememberParams('workbench', { tab: id });
    draw();
  }, { testidPrefix: 'wb-tab-', label: 'Club Lab sections', cls: 'wb-rail' });
  body.append(h('div.wb-wrap', railEl, content));

  let chips = []; // [{ el, end }] live countdowns
  let wasReady = 0;

  const draw = () => {
    chips = [];
    clear(content);
    if (tab === 'craft') drawCraftRoom(content, draw);
    else drawBench(content);
  };

  const act = (fn, okText) => {
    const r = fn();
    if (!r.ok) {
      toast(REASON[r.reason] || 'Cannot do that right now.', 'bad');
      draw();
      return r;
    }
    store.commit('workbench');
    if (okText) toast(okText(r), 'good');
    draw();
    return r;
  };

  function drawBench(host) {
    const now = Date.now();
    const profile = store.profile;
    const st = workbenchState(profile, now);
    wasReady = st.ready;
    const free = st.slots.filter((s) => s.open && s.empty);
    if (pick.slot && !free.some((s) => s.slot === pick.slot)) pick.slot = null;
    const target = pick.slot || free[0]?.slot || null;

    // --- slots ---
    const slotsEl = h('div.wb-slots', { 'data-testid': 'wb-slots', style: { '--n': WB_MAX_SLOTS } });
    for (const s of st.slots) slotsEl.append(slotCard(s, target));
    if (st.slotCount < WB_MAX_SLOTS) {
      slotsEl.append(h('div.wb-slot.locked', { 'data-testid': 'wb-slot-locked' },
        h('div.wb-slot-head', h('b', `Slot ${WB_MAX_SLOTS}`)),
        h('p.wb-slot-note', `Opens after you clear ${WB_THIRD_SLOT_STAGE}.`)));
    }

    // --- recipes ---
    const fam = pick.family;
    const famRow = h('div.wb-fams', { role: 'radiogroup', 'aria-label': 'Material family' },
      h('span.wb-fams-lbl', 'Family'),
      WB_FAMILIES.map((f) => h(`button.wb-fam${f === fam ? '.on' : ''}`, {
        type: 'button', role: 'radio', 'aria-checked': f === fam ? 'true' : 'false', title: MATERIAL_FAMILIES[f].name,
        'data-testid': `wb-fam-${f}`, style: { '--fam': MATERIAL_FAMILIES[f].color },
        onclick: () => { pick.family = f; draw(); },
      }, svgEl(itemIcon(inputItem(f, 'rare'), { px: 28 }), 'wb-fam-ico'))),
      h('span.wb-fams-name', MATERIAL_FAMILIES[fam].name));

    const list = h('div.wb-recipes', { 'data-testid': 'wb-recipes' });
    for (const row of st.recipes) list.append(recipeRow(row, target));

    host.append(
      h('div.wb-head',
        h('div.wb-head-text', h('h3.wb-title', 'Workbench'), h('p.wb-sub', 'Start a craft, leave, come back. Cancel refunds everything.')),
        h('div.wb-reset', 'Weekly limits reset in ', countdownChip(nextWeeklyReset(now) - now, 'wb-week-reset'))),
      slotsEl,
      h('section.wb-panel', famRow, list),
    );
  }

  function slotCard(s, target) {
    const head = (extra = null) => h('div.wb-slot-head', h('b', `Slot ${s.slot}`), extra);
    if (s.empty) {
      const on = s.slot === target;
      return h(`button.wb-slot.empty${on ? '.target' : ''}`, { type: 'button', 'data-testid': `wb-slot-${s.slot}`, 'aria-pressed': on ? 'true' : 'false', onclick: () => { pick.slot = s.slot; draw(); } },
        head(), h('p.wb-slot-note', on ? 'Pick a recipe below' : 'Empty · tap to use'));
    }
    if (!s.known) {
      return h('div.wb-slot.unknown', { 'data-testid': `wb-slot-${s.slot}` }, head(),
        h('p.wb-slot-note', 'Update to collect'),
        h('p.wb-slot-hint', 'A newer version of the game made this craft. Update the game to collect it.'));
    }
    const out = s.recipe.out[0];
    const tile = itemTile(out.id, out.count, { size: 52 });
    const dur = Math.max(1, s.end - s.start);
    if (s.ready) {
      return h('div.wb-slot.ready', { 'data-testid': `wb-slot-${s.slot}` },
        head(h('span.wb-ready-tag', 'Ready!')),
        h('div.wb-slot-body', tile, h('div.wb-slot-text', h('b', outName(s.recipe)), h('span.wb-slot-fam', MATERIAL_FAMILIES[s.family].name))),
        button('Collect', { kind: 'yellow', small: true, testid: `wb-collect-${s.slot}`, onClick: () => act(() => collectCraft(store.profile, s.slot, Date.now()), (r) => `Collected ${outName(r.recipe)}`) }));
    }
    const cd = countdownChip(s.left, `wb-cd-${s.slot}`);
    const bar = h('i.wb-bar-fill', { style: { width: `${Math.round((100 * (dur - s.left)) / dur)}%` } });
    chips.push({ el: cd, bar, end: s.end, start: s.start });
    return h('div.wb-slot.running', { 'data-testid': `wb-slot-${s.slot}` },
      head(cd),
      h('div.wb-slot-body', tile, h('div.wb-slot-text', h('b', outName(s.recipe)), h('span.wb-slot-fam', MATERIAL_FAMILIES[s.family].name))),
      h('div.wb-bar', bar),
      button('Cancel', {
        kind: 'ghost', small: true, testid: `wb-cancel-${s.slot}`,
        onClick: async () => {
          if (!(await confirmDialog(`Cancel ${outName(s.recipe)}? You get back every material and coin.`, { title: 'Cancel craft', ok: 'Cancel craft', cancel: 'Keep crafting' }))) return;
          act(() => cancelCraft(store.profile, s.slot, Date.now()), () => 'Craft cancelled: everything refunded');
        },
      }));
  }

  function recipeRow({ recipe, left, off }, target) {
    const profile = store.profile;
    const costs = recipeCosts(recipe, pick.family);
    const p = target ? startPreview(profile, target, recipe.id, pick.family, Date.now()) : { ok: false, reason: 'slot' };
    const out = recipe.out[0];
    const capText = off ? 'Back next week' : `${left}/${recipe.cap} left this week`;
    return h(`div.wb-recipe${p.ok ? '.can' : ''}`, { 'data-testid': `wb-recipe-${recipe.id}` },
      h('span.wb-recipe-tile', itemTile(out.id, out.count, { size: 48 })),
      h('div.wb-recipe-text',
        h('b', outName(recipe)),
        h('span.wb-recipe-meta', h('span.wb-time', svgEl(CLOCK_SVG, 'wb-time-ico'), hoursText(recipe)), h(`span.wb-cap${left <= 0 ? '.out' : ''}`, capText))),
      h('div.wb-costs', costs.map(({ id, count }) => {
        const have = itemCount(profile, id);
        const ok = have >= count;
        return h(`span.wb-cost${ok ? '' : '.short'}`, { title: getItem(id)?.name || id },
          svgEl(itemIcon(id, { px: 24 }), 'wb-cost-ico'),
          h('span.wb-cost-n', h('b', fmtNum(have, 'count')), `/${fmtNum(count, 'count', { round: 'up' })}`));
      })),
      button(p.ok ? 'Start' : (REASON[p.reason] && p.reason !== 'missing' && p.reason !== 'slot' ? REASON[p.reason] : 'Start'), {
        kind: p.ok ? 'yellow' : 'ghost', small: true, disabled: !p.ok, testid: `wb-start-${recipe.id}`,
        title: p.ok ? `Start in slot ${target}` : REASON[p.reason] || '',
        onClick: () => act(() => startCraft(store.profile, target, recipe.id, pick.family, Date.now()), (r) => `Started ${outName(r.recipe)} · ready in ${formatCountdown(r.recipe.ms)}`),
      }));
  }

  draw();
  // live countdowns: the chips tick; a craft that finishes redraws its slot
  const timer = setInterval(() => {
    if (tab !== 'bench') return;
    const now = Date.now();
    let done = false;
    for (const c of chips) {
      const left = c.end - now;
      if (left <= 0) { done = true; continue; }
      fillIn(c.el, svgEl(CLOCK_SVG, 'wb-cd-ico'), h('span.wb-cd-t', formatCountdown(left)));
      c.el.classList.toggle('soon', left < 3600000);
      c.el.setAttribute('aria-label', `${formatCountdown(left)} left`);
      c.bar.style.width = `${Math.round((100 * (now - c.start)) / Math.max(1, c.end - c.start))}%`;
    }
    if (done || workbenchState(store.profile, now).ready !== wasReady) draw();
  }, 5000);
  const off = store.on('change', (e) => { if (e?.reason === 'replace') draw(); });
  const cleanup = () => { clearInterval(timer); off(); };
  cleanup.stop = () => clearInterval(timer);
  return cleanup;
}

/** The Craft Room section: every owned family material by family; a tap opens the Craft Room sheet. */
function drawCraftRoom(host, redraw) {
  const profile = store.profile;
  const groups = WB_FAMILIES.map((f) => ({
    f,
    ids: Object.values(ITEMS).filter((it) => it.category === 'material' && it.family === f && craftInfo(it.id) && itemCount(profile, it.id) > 0)
      .sort((a, b) => a.sort - b.sort).map((it) => it.id),
  })).filter((g) => g.ids.length);
  host.append(h('div.wb-head',
    h('div.wb-head-text', h('h3.wb-title', 'Craft Room'), h('p.wb-sub', 'Instant: combine 3 into 1 of the next tier, or swap 2 into another family, for coins. Tap a material.'))));
  if (!groups.length) {
    host.append(h('section.wb-panel', h('p.wb-empty', 'No family materials yet. Bounty and Titan Trials drop them.')));
    return;
  }
  host.append(h('section.wb-panel.wb-craft', { 'data-testid': 'wb-craft-room' }, groups.map((g) => h('div.wb-craft-group', { style: { '--fam': MATERIAL_FAMILIES[g.f].color } },
    h('div.wb-craft-name', MATERIAL_FAMILIES[g.f].name),
    h('div.wb-craft-tiles', g.ids.map((id) => {
      const t = itemTile(id, itemCount(profile, id), {
        size: 52,
        onClick: () => import('../craftRoom.js').then((mod) => mod.openCraftRoom(id, redraw)),
      });
      const color = ITEM_RARITIES[ITEMS[id].rarity]?.color;
      if (color) t.style.setProperty('--rarity', color);
      t.dataset.testid = `wb-craft-${id}`;
      return t;
    }))))));
}
