// Stage prep's Support slot (docs/specs/BANNERS.md §E.1): friends' Support Students, online first, each clamped to
// this save's range before it is shown; "FP paid today" marked; a girl the formation already brings greyed. The
// pick joins the next New game as an extra card (src/ui/battle/setup.js SUPPORT_SLOT_MODE). Campaign, Bounty and
// solo Freeplay only (systems/friendSupport.js supportAllowed). The list is cached 5 minutes; Refresh asks again.
import '../styles/support.css';
import { h, panel, button, unitCard, toast } from '../components.js';
import { store } from '../../core/store.js';
import { UNIT_MAP } from '../../data/units.js';
import { supportAllowed, clampSupportUnit, supportMiniProfile, borrowerRange, SUPPORT_MAX_P, SUPPORT_LEVEL_LEAD } from '../../systems/friendSupport.js';
import { errorText } from '../../online/errors.js';
import { supportPick, setSupportPick } from '../battle/supportPick.js';
import { wentOnline } from '../online/common.js';

/** The pick for this stage's New game (null when there is none or the stage takes no Support Student). */
export function supportParam(stage, state) {
  const pick = supportPick();
  if (!pick || !supportAllowed(store.profile, stage, { difficulty: state.difficulty })) return null;
  return pick.owner;
}

/**
 * @param {object} stage
 * @param {{ difficulty: string }} state
 * @returns {HTMLElement|null}
 */
export function supportPanel(stage, state) {
  const profile = store.profile;
  if (!supportAllowed(profile, stage, { difficulty: state.difficulty })) return null;
  const body = h('div.sp-body', { 'data-testid': 'support-slot' });
  const note = (text, testid = 'support-note') => body.replaceChildren(h('p.muted.sp-note', { 'data-testid': testid }, text));
  const range = borrowerRange(profile);
  const foot = h('p.muted.sp-foot', `A friend's girl joins as an extra card, at your range (up to Lv ${range.level + SUPPORT_LEVEL_LEAD}, P${SUPPORT_MAX_P}). Support runs pay drops, missions, Easy and Normal clears and Friend Points; never Hard or Nightmare medals, ribbons or bests.`);
  const el = panel('Friend Support', body, foot);
  el.classList.add('sp-panel');
  if (!wentOnline()) {
    note('Go online (chat, clans or co-op) to borrow a friend\'s Support Student.');
    return el;
  }
  note('Checking…');
  let list = null;
  const towers = new Set(profile.formation?.towers || []);

  const paint = () => {
    const pick = supportPick();
    const rows = (list || []).map((c) => ({ c, card: clampSupportUnit(c.unit, profile) })).filter((x) => x.card && UNIT_MAP[x.card.id]);
    if (pick && !rows.some((x) => x.c.userId === pick.owner && x.card.id === pick.unitId)) setSupportPick(null);
    const refresh = button('Refresh', { kind: 'ghost', small: true, icon: 'refresh', testid: 'support-refresh', onClick: () => load(true) });
    if (!rows.length) {
      body.replaceChildren(h('div.sp-head', h('span.muted', 'No friend lends a Support Student yet. Add friends from chat or co-op.'), refresh));
      return;
    }
    const grid = h('div.sp-grid');
    for (const { c, card } of rows) {
      const brought = towers.has(card.id);
      const on = !brought && pick?.owner === c.userId;
      const tile = h(`button.sp-cand${on ? '.on' : ''}${brought ? '.brought' : ''}`, {
        type: 'button', disabled: brought, 'data-testid': `support-${c.userId}`, 'aria-pressed': on ? 'true' : 'false',
        title: brought ? `${UNIT_MAP[card.id].name} is already in your formation` : `${UNIT_MAP[card.id].name} · from ${c.name}`,
        onclick: () => {
          setSupportPick(on ? null : { owner: c.userId, unitId: card.id, unit: c.unit, name: c.name });
          paint();
        },
      },
      unitCard(card.id, { variant: 'square', level: card.lv, profile: supportMiniProfile(card) }),
      h('span.sp-friend', c.online ? h('i.sp-online', { title: 'Online' }) : null, c.name),
      brought ? h('span.sp-tag.sp-tag-brought', 'In formation') : c.paidToday ? h('span.sp-tag', 'FP paid today') : h('span.sp-tag.sp-tag-fp', '+10 FP'));
      grid.appendChild(tile);
    }
    const chosen = supportPick();
    body.replaceChildren(
      h('div.sp-head', h('span.sp-pick', { 'data-testid': 'support-picked' }, chosen ? `${UNIT_MAP[chosen.unitId].name} from ${chosen.name} joins your next battle` : 'Tap a friend\'s girl to bring her along'), refresh),
      grid,
    );
  };

  async function load(force = false) {
    try {
      const { supportClient } = await import('../../online/supportClient.js');
      const sc = await supportClient();
      const st = await sc.status();
      if (st !== 'ready') {
        note(st === 'needs_update' ? 'Friend Support needs the latest server update — everything else works as usual.' : 'Friend Support is offline right now.');
        return;
      }
      if (!force && sc.cachedCandidates()) list = sc.cachedCandidates();
      else {
        if (force) note('Checking…');
        list = await sc.candidates({ force });
      }
      paint();
    } catch (e) {
      if (force) toast(errorText(e), 'bad');
      note(errorText(e));
    }
  }
  load(false);
  return el;
}
