// Clan → Requests: ask your clan for one material a day, donate to clanmates' requests (a daily
// cap of donation points, coins + clan XP as thanks), and collect what arrived. Everything resets
// at 7 PM Central (the server's game day; the countdown uses the server's clock).
//
// The save is local, so donations go through the escrow ledger (src/online/donateLedger.js):
// pieces leave the backpack before the server call and come back only on a DEFINITIVE refusal or
// after the server voided the key; a lost answer stays "Checking your donation…" until
// settle_donations() says what happened. Collecting saves its key first and replays it after a
// crash. Every change is written at once (store.saveNow()).
import '../styles/social.css';
import { h, button, toast, modal, confirmDialog, itemTile, svgEl, glyph } from '../components.js';
import { store } from '../../core/store.js';
import { getBackend } from '../../online/backend.js';
import { errorText, toOnlineError } from '../../online/errors.js';
import { getItem } from '../../data/items.js';
import { MATERIAL_FAMILIES } from '../../data/types.js';
import { UNIT_MAP } from '../../data/units.js';
import { itemCount } from '../../systems/inventory.js';
import { canBreakthrough } from '../../systems/progression.js';
import { formatCountdown, localResetHint, RESET } from '../../core/reset.js';
import { avatar } from './common.js';
import { needsUpdateCard } from './needsUpdate.js';
import { refreshSoon } from './socialHub.js';
import {
  DONATE_RULES, requestRule, maxDonation, rarityName, DONOR_COINS_PER_POINT, CLAN_XP_PER_POINT, DONOR_DAILY_POINTS, CLAIM_KEEP_DAYS,
} from '../../online/donateRules.js';
import {
  newKey, holdDonation, finalizeDonation, refundDonation, beginClaim, applyClaim, dropClaim, recoverLedger, ledgerState, dismissForeign,
} from '../../online/donateLedger.js';

const RARITIES = Object.keys(DONATE_RULES); // common → mythic
const inFlight = new Set(); // donation keys whose call is still running in this tab

function save(reason = 'donate') {
  store.commit(reason);
  store.saveNow();
}

/** One writer at a time across tabs of this browser (two tabs share one save). */
function ledgerLock(fn) {
  const locks = globalThis.navigator?.locks;
  return locks?.request ? locks.request('ss-social-ledger', fn) : fn();
}

const WHY = {
  request: {
    no_clan: 'Join a clan to ask for materials.',
    dev: 'Material requests are not part of the developer clan.',
    used: 'You asked today.',
    tenure: 'You can ask after a day in the clan.',
  },
  donate: {
    no_clan: 'Join a clan to donate.',
    dev: 'Donations are not part of the developer clan.',
    tenure: 'You can donate after 3 days in the clan.',
    account: 'New online accounts can donate after 7 days.',
    dev_lab: 'No donations for a week after leaving the developer clan.',
  },
};

/** Collect everything waiting for me (also without a clan). Resolves what was added. */
export async function collectDonations(backend = getBackend()) {
  return ledgerLock(async () => {
    const profile = store.profile;
    const uid = backend.uid;
    const key = beginClaim(profile, { key: newKey(), uid });
    save('collect');
    try {
      const r = await backend.claimDonations(key);
      if (r?.expired || !r?.items?.length) {
        dropClaim(profile, key);
        save('collect');
        return [];
      }
      const added = applyClaim(profile, key, r.items);
      save('collect');
      const names = r.items.map((x) => `${x.count} × ${getItem(x.item)?.name || x.item}`).join(', ');
      toast(`Collected ${names}!`, 'good', 3200);
      refreshSoon(50);
      return added;
    } catch (e) {
      // the key stays saved: the next visit replays it (the same key returns the same set)
      toast(`${errorText(e)} Your collect will finish next time.`, 'bad', 3200);
      return [];
    }
  });
}

/** Settles unfinished donations / collects of this account. Never throws. */
export async function recoverDonations(backend = getBackend()) {
  if (!backend.uid) return null;
  return ledgerLock(async () => {
    const out = await recoverLedger(store.profile, backend, { uid: backend.uid, save: () => save('donate-recover'), inFlight });
    if (out.finalized.length) toast(`Your donation went through (+${out.finalized.reduce((n, r) => n + (r.coins || 0), 0)} coins).`, 'good');
    if (out.refunded.length) toast('A donation did not go through — the items are back in your backpack.', 'info', 3200);
    if (out.claimed?.added?.length) toast('Your collected materials are in your backpack.', 'good');
    return out;
  });
}

/** "Collect donations" for players without a clan (clan browse screen). Empty until there is something. */
export function collectCard(backend = getBackend()) {
  const el = h('div', { 'data-testid': 'collect-card' });
  (async () => {
    if ((await backend.socialStatus()) !== 'ready') return;
    await recoverDonations(backend);
    let s;
    try {
      s = await backend.donationState();
    } catch {
      return;
    }
    if (!s.collectable.length) return;
    el.replaceChildren(h('section.panel.sc-collect-card',
      h('h3.panel-title', 'Donations waiting for you'),
      h('div.sc-collect', h('div.sc-tiles', s.collectable.map((c) => itemTile(c.item, c.count, { size: 48 }))),
        button('Collect', { kind: 'pink', icon: 'gift', testid: 'collect-browse', onClick: async () => { await collectDonations(backend); el.replaceChildren(); } })),
      h('small.muted', `From your last clan. Collect within ${CLAIM_KEEP_DAYS} days.`)));
  })();
  return el;
}

/** Which owned girls need `itemId` for their next breakthrough: ["Aoi needs 4", …]. */
function whoNeeds(itemId) {
  const out = [];
  for (const id of Object.keys(store.profile?.units || {})) {
    try {
      const b = canBreakthrough(store.profile, id);
      const miss = (b.missing || []).find((x) => x.id === itemId);
      if (miss) out.push({ name: UNIT_MAP[id]?.name || id, need: miss.need - (miss.have || 0) });
    } catch {
      /* not owned / maxed */
    }
  }
  return out.sort((a, b) => b.need - a.need);
}

/**
 * @param {{ backend?: object, onBadge?: (n: number) => void }} opts
 * @returns {{ el: HTMLElement, refresh: () => void, destroy: () => void }}
 */
export function createDonatePanel({ backend = getBackend(), onBadge = null } = {}) {
  const el = h('div.sc-don', { 'data-testid': 'donate-panel' }, h('div.ol-connecting', h('i.ol-spinner'), h('p.muted', 'Loading requests…')));
  let alive = true;
  let s = null;
  let offset = 0; // server clock − device clock
  let tick = 0;
  let gen = 0;
  const serverNow = () => Date.now() + offset;

  async function refresh() {
    const my = ++gen;
    const st = await backend.socialStatus();
    if (!alive || my !== gen) return;
    if (st !== 'ready') {
      el.replaceChildren(st === 'offline' ? h('div.ol-empty', h('b', 'Requests are offline'), h('p.muted', 'Cannot reach the game server right now.'))
        : needsUpdateCard({ what: 'Clan requests', onReady: () => refresh() }));
      return;
    }
    try {
      s = await backend.donationState();
    } catch (e) {
      if (alive && my === gen) el.replaceChildren(h('div.ol-empty', h('b', 'Requests could not be loaded'), h('p.muted', errorText(e))));
      return;
    }
    if (!alive || my !== gen) return;
    offset = (s.serverNow || Date.now()) - Date.now();
    paint();
  }

  function pointsLeft() {
    // donations still waiting for the server count against today's points too
    const pend = ledgerState(store.profile, backend.uid).pendingItems.reduce((n, e) => n + e.count * (requestRule(e.item)?.points || 0), 0);
    return Math.max(0, s.cap - s.donatedToday - pend);
  }

  function paint() {
    const led = ledgerState(store.profile, backend.uid);
    const helpable = s.requests.filter((r) => canHelp(r) > 0).length;
    onBadge?.(helpable + s.collectable.length);
    el.replaceChildren(...[
      ledgerBanner(led),
      h('div.sc-don-cols',
        mineCard(),
        h('section.panel.sc-don-list', { 'data-testid': 'donate-requests' },
          h('h3.panel-title', 'Clanmates\' requests'),
          requestsList())),
      footer(),
    ].filter(Boolean));
  }

  function ledgerBanner(led) {
    if (led.pending) {
      const tries = Math.max(...led.pendingItems.map((e) => e.tries), 0);
      return h('div.ol-banner.warn.ol-banner-row', { 'data-testid': 'donate-pending' },
        h('span', `Checking your donation of ${led.pendingItems.map((e) => `${e.count} × ${getItem(e.item)?.name || e.item}`).join(', ')}…`),
        tries >= 2 ? button('Retry', { kind: 'yellow', small: true, icon: 'refresh', onClick: () => recoverDonations(backend).then(refresh) }) : null);
    }
    if (led.foreign) {
      return h('div.ol-banner.ol-banner-row', h('span', 'A donation made with another online account on this device could not be confirmed here.'),
        button('Dismiss', { kind: 'ghost', small: true, onClick: () => { dismissForeign(store.profile, backend.uid); save('donate'); paint(); } }));
    }
    if (led.claimPending) return h('div.ol-banner', 'Finishing your last collect…');
    return null;
  }

  function closesIn() {
    return formatCountdown(s.nextReset - serverNow());
  }

  function mineCard() {
    const r = s.myRequest;
    const parts = [];
    if (r) {
      const rule = requestRule(r.item);
      const pct = Math.round((r.received / r.wanted) * 100);
      parts.push(h('div.sc-my-req', { 'data-testid': 'my-request' },
        itemTile(r.item, null, { size: 56 }),
        h('div.sc-my-req-info',
          h('b', `${r.wanted} × ${getItem(r.item)?.name || r.item}`),
          h('div.sc-bar', h('i', { style: { width: `${pct}%` } }), h('span', { 'data-testid': 'my-request-progress' }, `${r.received}/${r.wanted}`)),
          h('small.muted', r.status === 'filled' ? 'Filled — thank your clanmates!' : r.status === 'cancelled' ? 'You cancelled today\'s request.' : `${rarityName(rule?.rarity)} · closes in ${closesIn()}`),
          r.donors.length ? h('small.sc-donors', `From ${r.donors.join(', ')}`) : null),
        r.status === 'open' && r.open ? button('Cancel', {
          kind: 'ghost', small: true, testid: 'my-request-cancel',
          onClick: async () => {
            if (!(await confirmDialog('Cancel today\'s request? You can\'t ask again until the next reset.', { title: 'Cancel request', ok: 'Cancel request', cancel: 'Keep it', danger: true }))) return;
            try {
              await backend.cancelMaterialRequest();
              refresh();
            } catch (e) {
              toast(errorText(e), 'bad');
            }
          },
        }) : null));
      parts.push(h('small.muted.sc-next', `Next request in ${closesIn()}.`));
    } else if (s.canRequest) {
      parts.push(h('p.muted', 'Ask your clan for one material a day. Clanmates donate from their own backpacks.'),
        button('Ask for materials', { kind: 'yellow', icon: 'plus', testid: 'donate-ask', onClick: () => openPicker() }));
    } else {
      let why = WHY.request[s.requestWhy] || '';
      if (s.requestWhy === 'tenure' && s.requestReadyAt) why = `You can ask after a day in the clan (in ${formatCountdown(s.requestReadyAt - serverNow())}).`;
      parts.push(h('p.muted', { 'data-testid': 'donate-ask-why' }, why));
    }
    if (s.collectable.length) {
      parts.push(h('div.sc-collect', { 'data-testid': 'donate-collectable' },
        h('div.sc-tiles', s.collectable.map((c) => itemTile(c.item, c.count, { size: 48 }))),
        button(`Collect ${s.collectable.reduce((n, c) => n + c.count, 0)}`, {
          kind: 'pink', icon: 'gift', testid: 'donate-collect',
          onClick: async (ev) => {
            const btn = ev?.currentTarget;
            if (btn) btn.disabled = true;
            const added = await collectDonations(backend);
            if (added.length) burst();
            refresh();
          },
        })));
      parts.push(h('small.muted', `Donations wait ${CLAIM_KEEP_DAYS} days for you, even if you leave the clan.`));
    }
    return h('section.panel.sc-don-mine', h('h3.panel-title', 'My request'), ...parts);
  }

  function burst() {
    const b = h('div.sc-burst', svgEl(glyph('sparkle'), 'sc-burst-ico'));
    el.append(b);
    setTimeout(() => b.remove(), 900);
  }

  /** How many I could give to `r` right now (0 = nothing). */
  function canHelp(r) {
    if (!s.canDonate || !r.open) return 0;
    const rule = requestRule(r.item);
    const pendingHere = ledgerState(store.profile, backend.uid).pendingItems.length ? (store.profile.social?.escrow || []).filter((e) => e.requestId === r.id).reduce((n, e) => n + e.count, 0) : 0;
    return maxDonation({ rule, remaining: r.wanted - r.received - pendingHere, given: r.myGiven + pendingHere, have: itemCount(store.profile, r.item), pointsLeft: pointsLeft() });
  }

  function requestsList() {
    if (!s.requests.length) return h('div.ol-empty.sc-empty', h('b', 'No open requests'), h('p.muted', 'When clanmates ask for materials, they show up here.'));
    const left = pointsLeft();
    const rows = s.requests.map((r) => ({ r, n: canHelp(r) }))
      .sort((a, b) => (b.n > 0) - (a.n > 0) || a.r.received / a.r.wanted - b.r.received / b.r.wanted || a.r.createdAt - b.r.createdAt);
    return h('div.sc-req-list', rows.map(({ r, n }) => {
      const rule = requestRule(r.item);
      const have = itemCount(store.profile, r.item);
      let why = '';
      if (!s.canDonate) why = WHY.donate[s.donateWhy] || '';
      else if (!have) why = 'You have none.';
      else if (r.myGiven >= rule.perDonor) why = 'You gave the most you can to this one.';
      else if (left < rule.points) why = `Daily limit reached — resets at ${RESET.label}.`;
      const pct = Math.round((r.received / r.wanted) * 100);
      return h('article.sc-req-card', { 'data-testid': 'donate-request', 'data-request': r.id },
        avatar(r.avatar, 34),
        h('div.sc-req-info',
          h('div.sc-req-who', h('b', r.name), h('small.muted', `asks for ${r.wanted} × ${getItem(r.item)?.name || r.item}`)),
          h('div.sc-bar.small', h('i', { style: { width: `${pct}%` } }), h('span', `${r.received}/${r.wanted}`)),
          h('small.muted', `You have ${have}${r.myGiven ? ` · you gave ${r.myGiven}` : ''} · ${rule.points} pt each`)),
        itemTile(r.item, null, { size: 44 }),
        h('div.sc-req-acts',
          n >= 1 ? button('+1', { kind: 'yellow', small: true, testid: 'donate-one', onClick: () => donate(r, 1) }) : null,
          n > 1 ? button(`+${n}`, { kind: 'pink', small: true, testid: 'donate-max', onClick: () => donate(r, n) }) : null,
          n < 1 && why ? h('small.sc-req-why', { 'data-testid': 'donate-why' }, why) : null));
    }));
  }

  function footer() {
    const reset = h('span', { 'data-testid': 'donate-reset' });
    const paintReset = () => {
      const hint = localResetHint();
      reset.textContent = `resets in ${closesIn()} (${RESET.label}${hint ? ` · ${hint}` : ''})`;
    };
    paintReset();
    clearInterval(tick);
    tick = setInterval(() => (alive ? paintReset() : clearInterval(tick)), 30000);
    return h('footer.sc-don-foot', { 'data-testid': 'donate-foot' },
      h('b', { 'data-testid': 'donate-today' }, `Donated today: ${s.donatedToday} / ${s.cap || DONOR_DAILY_POINTS} points`),
      h('span', `+${DONOR_COINS_PER_POINT} coins and +${CLAN_XP_PER_POINT} clan XP per point`),
      reset);
  }

  async function donate(r, n) {
    const profile = store.profile;
    const uid = backend.uid;
    const key = newKey();
    await ledgerLock(async () => {
      if (!holdDonation(profile, { key, uid, requestId: r.id, item: r.item, count: n })) {
        toast('You don\'t have enough of that.', 'info');
        return;
      }
      save('donate');
      inFlight.add(key);
      paint();
      try {
        const res = await backend.donate(r.id, n, key);
        if (res.voided) {
          refundDonation(profile, key);
          save('donate');
          toast('That donation did not go through — the items are back.', 'info');
        } else {
          finalizeDonation(profile, key, { coins: res.reward?.coins });
          save('donate');
          toast(`Thank you! ${n} × ${getItem(r.item)?.name || r.item} sent · +${res.reward?.coins || 0} coins`, 'good', 2800);
        }
      } catch (e) {
        const err = toOnlineError(e);
        if (err.definitive) {
          // the server (or the client before any request) refused: nothing was applied
          refundDonation(profile, key);
          save('donate');
          toast(errorText(err), 'bad', 3200);
        } else {
          // the answer was lost: keep the escrow; settle_donations() decides later
          toast('Checking your donation… the connection dropped.', 'info', 3200);
        }
      } finally {
        inFlight.delete(key);
      }
    });
    refreshSoon(50);
    refresh();
  }

  // ---- ask: pick a material ----------------------------------------------------------------
  function openPicker() {
    const families = Object.keys(MATERIAL_FAMILIES);
    let fam = families[0];
    let rar = 'rare';
    const famRow = h('div.sc-fam-row');
    const rarRow = h('div.ol-seg.sc-rar-row');
    const detail = h('div.sc-pick-detail');
    const okBtn = { el: null };
    const paint2 = () => {
      famRow.replaceChildren(...families.map((f) => h(`div.sc-fam${f === fam ? '.on' : ''}`, { role: 'button', tabindex: 0, 'data-testid': `pick-fam-${f}`, title: MATERIAL_FAMILIES[f].name, onclick: () => { fam = f; paint2(); } },
        itemTile(`mat_${f}_rare`, null, { size: 40, onClick: () => { fam = f; paint2(); } }), h('small', MATERIAL_FAMILIES[f].name))));
      rarRow.replaceChildren(...RARITIES.map((r) => h(`button.ol-seg-btn${r === rar ? '.on' : ''}`, { type: 'button', 'data-testid': `pick-rar-${r}`, onclick: () => { rar = r; paint2(); } }, rarityName(r))));
      const id = `mat_${fam}_${rar}`;
      const rule = requestRule(id);
      const lock = lockReason(rule);
      const needs = whoNeeds(id).slice(0, 3);
      detail.replaceChildren(
        itemTile(id, null, { size: 64 }),
        h('div.sc-pick-info',
          h('b', `${rule.size} × ${rule.name}`),
          h('small.muted', `You have ${itemCount(store.profile, id)} · up to ${rule.perDonor} from each clanmate`),
          needs.length ? h('small.sc-needs', needs.map((x) => `${x.name} needs ${x.need}`).join(' · ')) : null,
          lock ? h('small.sc-lock', { 'data-testid': 'pick-lock' }, lock) : null));
      if (okBtn.el) okBtn.el.disabled = !!lock;
    };
    function lockReason(rule) {
      if (rule.established && !s.mythicOpen) return 'Mythic requests open when your clan is 14 days old with 5 members of 3+ days.';
      if (rule.weeklyMax && (s.weekly?.[rule.rarity] || 0) >= rule.weeklyMax) return `You asked for ${rarityName(rule.rarity).toLowerCase()} materials ${rule.weeklyMax} times this week.`;
      return '';
    }
    paint2();
    const m = modal({
      title: 'Ask for materials',
      wide: true,
      cls: 'sc-pick-modal',
      body: h('div.sc-pick', famRow, rarRow, detail, h('p.muted.sc-small', `One request per day (resets at ${RESET.label}). Legendary materials can't be requested.`)),
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        { label: 'Ask my clan', kind: 'yellow', testid: 'pick-ok', onClick: (close) => ask(`mat_${fam}_${rar}`, close) },
      ],
    });
    okBtn.el = m.el.querySelector('[data-testid="pick-ok"]');
    paint2();
  }

  async function ask(itemId, close) {
    const rule = requestRule(itemId);
    const left = s.nextReset - serverNow();
    const soon = left < 2 * 3600000 ? ` This request closes at ${RESET.label} (in ${formatCountdown(left)}).` : '';
    if (!(await confirmDialog(`Ask your clan for ${rule.size} × ${rule.name}? You can ask once a day.${soon}`, { title: 'Ask your clan', ok: 'Ask', okKind: 'yellow' }))) return;
    try {
      await backend.requestMaterials(itemId);
      close();
      toast('Request posted in your clan!', 'good');
      refresh();
    } catch (e) {
      toast(errorText(e), 'bad', 3200);
    }
  }

  recoverDonations(backend).finally(() => refresh());
  return {
    el,
    refresh,
    destroy() {
      alive = false;
      clearInterval(tick);
    },
  };
}
