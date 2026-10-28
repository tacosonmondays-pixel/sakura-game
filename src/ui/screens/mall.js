// Mall (owner: meta-a). Route: #/mall?tab=general
// Tabs from shopTabs(): General (coins), Gem Shop, Recruit Exchange (spark + fragments),
// Boss Exchange (Assault Tokens, with the Titan shelf), Bounty Exchange (Bounty Tokens) and the Memento
// Exchange (Mementos and Moonpearls, docs/specs/ASCENSION.md §A.5). Offers show the item tile, price,
// stock and reset period; buying asks for a quantity when more than one fits. "Choose family" rows
// share one card with family chips (pre-picked for the girl whose next gate needs it).
// UI M5c (docs/specs/UI_DIRECTION.md §5.5, §5.10 E1-E3, E6; notes/ui-m5/PLAN.md §5 M5c): a list screen. The six shops
// in the left rail (Q6: one word each, the tab-<id> test ids kept), Midori hosts on the right (the shop-counter tint
// behind), the shelves under an ink plate header with the shop's name, its restock countdown chip and, for a token
// shop, its wallet ONCE (coins and gems live in the top bar: ../mallView.js); the shop's sentence behind "i" (a bottom
// sheet). Every buy is a cost button (§5.5: an ink plate, the currency and the price in the plate accent; dimmed with
// a lock when it is short), so the yellow pills are gone. The offer tiles (M3's) and the buy and quantity windows are unchanged.
import '../styles/meta-a.css';
import '../styles/hubs.css';
import { h, clear, svgEl, modal, toast, button } from '../components.js';
import { countdownChip, iconBtn, ico } from '../kit.js';
import { msToLocalMidnight, msToLocalWeekEnd } from '../countdown.js';
import { nextWeeklyReset } from '../../core/reset.js';
import { navigate, rememberParams } from '../router.js';
import { walletsFor } from '../wallets.js';
import { listScreen } from '../listScreen.js';
import { openSheet } from '../sheet.js';
import { railTabs, walletChips, restockKind, RESTOCK_LABEL, mallHostState, stockLine, onGameWeek } from '../mallView.js';
import { store } from '../../core/store.js';
import { formatNumber } from '../../core/util.js';
import { UNIT_MAP } from '../../data/units.js';
import { getItem } from '../../data/items.js';
import { ITEM_RARITIES, UNIT_RARITIES } from '../../data/types.js';
import { portraitHTML } from '../../art/portraits.js';
import { currencyIcon, uiIcon } from '../../art/icons.js';
import { shopTabs, buyOffer, currencyBalance } from '../../systems/shop.js';
import { tile, card, showRewardsModal, cssVar } from './stage.js';
import { applyUrFrame, isUR } from '../rarity.js';
import { MAX_POTENTIAL, potentialLevel, potentialNext, dupePastMaxPay } from '../../systems/potential.js';
import { MATERIAL_FAMILIES } from '../../data/types.js';
import { itemIcon } from '../../art/icons.js';
import { spareText } from '../potential.js';
import { nextGateNeed, neededFor } from '../../systems/titans.js';

/** Her offer portrait wears the rainbow UR frame once she is fully awakened (display only). */
function urFramed(el, unitId) {
  applyUrFrame(el, unitId, store.profile);
  return el;
}

const CURRENCY_NAME = { coins: 'Coins', gems: 'Gems', recruitPoints: 'Recruit Points', token_boss: 'Assault Tokens', token_bounty: 'Bounty Tokens', memento: 'Mementos', moonpearl: 'Moonpearls' };
const SECTION_NAME = { titan: 'Titan shelf' }; // [ui-m5] (its restock chip says "Weekly")
const CURRENCY_ROUTE = {
  token_boss: { route: 'assault', label: 'Total Assault' },
  token_bounty: { route: 'bounty', label: 'Bounty' },
  recruitPoints: { route: 'recruit', label: 'Recruit' },
  gems: { route: 'commissions', label: 'Commissions' },
  coins: { route: 'bounty', label: 'Coin Bounty' },
  memento: { route: 'recruit', label: 'Recruit' },
  moonpearl: { route: 'recruit', label: 'Recruit' },
};

/** The family a "choose family" card shows first, per group (the next gate's family, else the first). */
const famPick = {};

function curIcon(currency, cls = 'ma-cur-icon') {
  return svgEl(currency === 'memento' || currency === 'moonpearl' ? itemIcon(currency, { px: 22 }) : currencyIcon(currency), cls);
}

/** The restock chip's time left for a kind (mallView.js restockKind). */
const restockMs = (kind) => (kind === 'daily' ? msToLocalMidnight() : kind === 'weekly' ? msToLocalWeekEnd() : kind === 'game' ? nextWeeklyReset() - Date.now() : null);

/**
 * A token shop's wallet, once (P7): one chip in the plate header with each of its balances; a tap goes where the
 * tokens are earned. The test ids of the old balance panel stay (mall-balance, mall-balance-<currency>).
 */
function walletChip(tab) {
  const wallets = walletChips(tab);
  if (!wallets.length) return null;
  const go = CURRENCY_ROUTE[wallets[0].currency];
  const names = wallets.map((w) => `${formatNumber(w.balance)} ${CURRENCY_NAME[w.currency] || w.currency}`).join(', ');
  return h('button.ma-wallet', {
    type: 'button', 'data-testid': 'mall-wallet', title: go ? `${names}. Earn more in ${go.label}` : names, 'aria-label': go ? `${names}. Earn more in ${go.label}` : names,
    onclick: go ? () => navigate(go.route) : null,
  }, wallets.map((w) => h('span.ma-wallet-one', curIcon(w.currency, 'ma-wallet-icon'),
    // (the first wallet keeps the old balance's test id)
    h('span.num.ma-wallet-val', { 'data-testid': w === wallets[0] ? 'mall-balance' : `mall-balance-${w.currency}` }, formatNumber(w.balance)))));
}

/** "i": the shop's sentence in a bottom sheet (P1: the Tap layer is a sheet, as Happening Now's "?"; toasts stay for
 * feedback), so it never covers the header it explains and stays until it is closed. */
function shopInfo(tab) {
  openSheet({ title: tab.name, testid: 'mall-info-sheet', body: h('div.hn-sheet', h('p', tab.desc)) });
}

export function render(root, params = {}) {
  const all = shopTabs(store.profile);
  let active = all.some((t) => t.id === params.tab) ? params.tab : all[0].id;
  const first = all.find((t) => t.id === active);
  const ls = listScreen({
    title: 'Mall', cls: 'ma-mall-screen', location: 'mall', host: 'mall', state: mallHostState(restockMs(restockKind(first))),
    sections: railTabs(all), active, railLabel: 'Shops', headTestid: 'mall-head',
    onPick: (id) => {
      if (id === active) return;
      active = id;
      rememberParams('mall', { tab: id });
      ls.rail.setActive(id);
      draw();
      ls.list.scrollTop = 0;
    },
  });
  const el = ls.el;
  root.appendChild(el);
  const content = h('div.ma-mall-content');
  ls.list.append(content);

  const draw = () => {
    clear(content);
    const tab = shopTabs(store.profile).find((t) => t.id === active);
    // [ui-ink] the top bar shows the active shop's own currency (src/ui/wallets.js, UI v2 Q3)
    el.querySelector('.topbar .cur-pills')?.setWallets?.(walletsFor('mall', { tab: active }));
    // E2: the shop's name, its restock chip (a recurring cycle: never red; at zero the shelves restock and redraw),
    // its wallet once (token shops only) and its sentence behind "i"
    const kind = restockKind(tab);
    const ms = restockMs(kind);
    ls.setLines(mallHostState(ms));
    ls.setHead(tab.name, [
      kind ? countdownChip(ms, { label: RESTOCK_LABEL[kind], cls: 's', urgent: false, doneText: 'Restocked!', onDone: () => { if (el.isConnected) draw(); }, testid: 'mall-restock' }) : null,
      walletChip(tab),
      iconBtn('info', { label: `About the ${tab.name}`, cls: 'ma-mall-info', testid: 'mall-info', onClick: () => shopInfo(tab) }),
    ]);
    // one card per "choose family" group; a section header before the Titan shelf
    const items = [];
    const groups = new Map();
    for (const o of tab.offers) {
      if (!o.group) items.push(o);
      else if (!groups.has(o.group)) {
        groups.set(o.group, [o]);
        items.push({ group: o.group, section: o.section, offers: groups.get(o.group) });
      } else groups.get(o.group).push(o);
    }
    const bySection = new Map();
    for (const it of items) {
      const k = it.section || '';
      if (!bySection.has(k)) bySection.set(k, []);
      bySection.get(k).push(it);
    }
    let i = 0;
    for (const [sec, list] of bySection) {
      // a game-week shelf inside a shop (the Titan shelf) carries its own restock chip on its title
      if (sec) {
        content.appendChild(h('h4.ma-shelf-title', { 'data-testid': `shelf-${sec}` }, h('span', SECTION_NAME[sec] || sec),
          list.some((it) => onGameWeek(it.offers?.[0] || it)) ? countdownChip(nextWeeklyReset() - Date.now(), { label: 'Weekly', cls: 's', urgent: false, doneText: 'Restocked!', onDone: () => { if (el.isConnected) draw(); }, testid: 'mall-restock-shelf' }) : null));
      }
      const grid = h('div.ma-offers');
      for (const it of list) {
        const elOffer = it.group ? groupCard(it, () => draw(), kind) : offerCard(it, () => draw(), kind);
        elOffer.style.animationDelay = `${Math.min(i++, 12) * 25}ms`;
        grid.appendChild(elOffer);
      }
      content.appendChild(grid);
    }
    if (!tab.offers.length) content.appendChild(h('div.ma-offers', h('div.ma-empty-state', svgEl(uiIcon('mall')), h('p', 'Nothing on the shelves right now.'))));
  };
  draw();
  const off = store.on('change', (e) => { if (e?.reason === 'replace') draw(); });
  return () => {
    off();
    ls.cleanup();
  };
}

/** Her next step as "P5 ✦ Maple Gale" (a stat step: "P2 +4% damage"), or '' at P6. */
function nextStepText(unitId) {
  const n = potentialNext(UNIT_MAP[unitId], store.profile.units[unitId]);
  return n ? `P${n.step} ${n.brief}` : '';
}

/** Recruit Exchange stock line: a spark of an owned girl is a duplicate (1 Essence for her next step). */
function unitStockText(o) {
  if (!o.owned) return 'Spark';
  return potentialLevel(store.profile.units[o.unitId]) >= MAX_POTENTIAL ? `P${MAX_POTENTIAL} → Moonpearls` : `Owned → +1 Essence (${nextStepText(o.unitId)})`;
}

/** "Choose family" card: one tile, family chips, the shared weekly stock. */
function groupCard(g, redraw, shopKind = null) {
  const need = nextGateNeed(store.profile);
  const fams = g.offers.map((o) => o.family);
  if (!famPick[g.group] || !fams.includes(famPick[g.group])) famPick[g.group] = fams.includes(need?.family) ? need.family : fams[0];
  const o = g.offers.find((x) => x.family === famPick[g.group]) || g.offers[0];
  const card = offerCard(o, redraw, shopKind);
  card.classList.add('fam');
  const chips = h('div.ma-fam-chips', { 'data-testid': `fam-${g.group}` }, g.offers.map((x) => h(`button.ma-fam-chip${x.family === o.family ? '.on' : ''}`, {
    title: MATERIAL_FAMILIES[x.family]?.name || x.family,
    'data-testid': `fam-${g.group}-${x.family}`,
    onclick: (e) => { e.stopPropagation(); famPick[g.group] = x.family; redraw(); },
  }, svgEl(itemIcon(x.item), 'ma-fam-ico'))));
  card.insertBefore(chips, card.querySelector('.ma-offer-stock'));
  return card;
}

/** An offer: its tile (M3's), name, stock line and cost button. `shopKind`: the shop's restock cycle (mallView.js). */
function offerCard(o, redraw, shopKind = null) {
  const isUnit = !!o.unitId;
  const item = o.item ? getItem(o.item) : o.chosenEssence ? getItem('kindred_ssr') : null;
  const name = isUnit ? UNIT_MAP[o.unitId]?.name : o.chosenEssence ? 'Chosen SSR Essence' : item?.name || o.item;
  // [ui-m5] the cycle is the plate header's chip; an unlimited row says nothing (P7)
  const stockText = stockLine(o, shopKind) || (isUnit ? unitStockText(o) : null);
  // "Needed for" tag: the girl whose next gate takes this item ("Kage · Gate 9")
  const needTag = o.item && !isUnit ? neededFor(store.profile, o.item) : null;
  const el = h(
    `div.ma-offer${o.soldOut ? '.sold' : ''}${o.highlight ? '.hot' : ''}${isUnit ? '.unit' : ''}`,
    { 'data-offer': o.id },
    o.highlight
      // a fully awakened SSR she already owns shows as UR here too, like the spark grid (display only)
      ? (isUnit && isUR(o.unitId, store.profile) ? h('span.ma-offer-ribbon.is-ur', h('span.ur-text', 'UR')) : h('span.ma-offer-ribbon', isUnit ? 'SSR' : 'Hot'))
      : null,
    h('div.ma-offer-art',
      isUnit
        // her plain drawn bust (one SSR / UR ribbon + one name on the offer — no card overlay doubling them)
        ? urFramed(h('button.ma-offer-portrait', { title: `${name} — view profile`, style: { '--rarity': UNIT_RARITIES[UNIT_MAP[o.unitId]?.rarity]?.color || '#ff7ad9' }, onclick: () => navigate('student', { id: o.unitId }), html: portraitHTML(UNIT_MAP[o.unitId], 'thumb') }), o.unitId)
        : tile(o.item || 'kindred_ssr', o.count > 1 ? o.count : null, { size: 72 }),
    ),
    h('div.ma-offer-name', name),
    // (the gate and its number never part on a narrow card: "Gate 1", not "Gate" over "1")
    needTag ? h('div.ma-offer-need', { 'data-testid': `need-${o.id}` }, `Needed: ${String(needTag).replace(/ (\d+)$/, ' $1')}`) : null,
    h('div.ma-offer-stock', stockText || ''),
    costButton(o, () => (o.chosenEssence ? pickChosen(o, redraw) : startBuy(o, redraw))),
  );
  if (item) cssVar(el, '--rc', ITEM_RARITIES[item.rarity]?.color || '#9aa5b1');
  return el;
}

/**
 * The cost button (§5.5; UI M5c): an ink plate with the currency and the price in the plate accent, exact (money is
 * exact up to 999,999, §2). Short of the price: the price dims and a small lock shows (never opacity); a tap still
 * says what is missing and where to earn it. Sold out or blocked: the button is off and says so.
 */
function costButton(o, onBuy) {
  const off = o.soldOut || o.blocked;
  const label = o.soldOut ? 'Sold out' : null;
  return h(`button.ui-cost.dense.ma-cost${!off && !o.affordable ? '.poor' : ''}`, {
    type: 'button', disabled: off, 'data-testid': `buy-${o.id}`,
    'aria-label': label || `Buy for ${formatNumber(o.price)} ${CURRENCY_NAME[o.currency] || o.currency}${o.affordable ? '' : ' (not enough)'}`,
    onclick: onBuy,
  }, label
    ? h('span.ui-cost-lbl', label)
    : h('span', curIcon(o.currency, 'ma-cost-icon'), h('span.num', formatNumber(o.price)), !o.affordable && !off ? ico('lock', 'ui-ico.ma-cost-lock') : null));
}

function maxQty(o) {
  const balance = currencyBalance(store.profile, o.currency);
  const byFunds = Math.floor(balance / o.price);
  const byStock = o.remaining != null ? o.remaining : 99;
  return Math.max(0, Math.min(byFunds, byStock, 99));
}

function startBuy(o, redraw) {
  if (o.soldOut) return;
  const max = maxQty(o);
  if (max < 1) {
    const need = o.price - currencyBalance(store.profile, o.currency);
    const go = CURRENCY_ROUTE[o.currency];
    modal({
      title: 'Not enough',
      body: h('div', h('div.ma-spend-line.short', curIcon(o.currency, 'ma-pay-icon'), h('b', formatNumber(currencyBalance(store.profile, o.currency))), ` / ${formatNumber(o.price)}`), h('p', `You need ${formatNumber(need)} more ${CURRENCY_NAME[o.currency] || o.currency}.`)),
      actions: [{ label: 'Close', kind: 'ghost' }, go ? { label: `Go to ${go.label}`, kind: 'yellow', onClick: (c) => { c(); navigate(go.route); } } : null].filter(Boolean),
    });
    return;
  }
  let qty = 1;
  const isUnit = !!o.unitId;
  const item = o.item ? getItem(o.item) : null;
  const qtyVal = h('b.ma-qty-val', '1');
  const total = h('span.ma-qty-total');
  const after = h('div.muted');
  const update = () => {
    qtyVal.textContent = String(qty);
    total.textContent = formatNumber(o.price * qty);
    after.textContent = `Balance ${formatNumber(currencyBalance(store.profile, o.currency))} → ${formatNumber(currencyBalance(store.profile, o.currency) - o.price * qty)} · you receive ×${formatNumber(o.count * qty)}`;
  };
  const step = (d) => { qty = Math.max(1, Math.min(max, qty + d)); update(); };
  const body = h('div.ma-buy',
    h('div.ma-buy-head',
      isUnit ? card(o.unitId, { variant: 'square' }) : tile(o.item, o.count > 1 ? o.count : null, { size: 72 }),
      h('div', h('b', isUnit ? UNIT_MAP[o.unitId].name : item?.name), h('p.muted', isUnit ? (o.owned ? (potentialLevel(store.profile.units[o.unitId]) >= MAX_POTENTIAL ? `Already at P${MAX_POTENTIAL} — gives ${dupePastMaxPay(UNIT_MAP[o.unitId])}.` : `Already in your club — +1 Essence (${nextStepText(o.unitId)}).`) : 'Joins your club immediately.') : item?.desc || '')),
    ),
    max > 1 && !isUnit
      ? h('div.ma-qty',
        h('button.ma-qty-btn', { onclick: () => step(-10), title: '−10' }, '«'),
        h('button.ma-qty-btn', { onclick: () => step(-1), title: '−1' }, svgEl(uiIcon('minus'))),
        qtyVal,
        h('button.ma-qty-btn', { onclick: () => step(1), title: '+1', 'data-testid': 'qty-plus' }, svgEl(uiIcon('plus'))),
        h('button.ma-qty-btn', { onclick: () => { qty = max; update(); }, title: 'Max' }, 'Max'),
      )
      : null,
    h('div.ma-spend-line', curIcon(o.currency, 'ma-pay-icon'), total),
    after,
  );
  update();
  modal({
    title: isUnit ? 'Spark exchange' : 'Purchase',
    body,
    actions: [
      { label: 'Cancel', kind: 'ghost' },
      {
        label: 'Buy',
        kind: 'yellow',
        testid: 'buy-confirm',
        onClick: (c) => {
          const r = buyOffer(store.profile, o.id, qty);
          c();
          if (!r.ok) {
            toast({ soldOut: 'Sold out', funds: 'Not enough currency', qty: 'Invalid amount' }[r.error] || 'Purchase failed', 'bad');
            return;
          }
          store.commit('shop');
          redraw();
          if (r.unit) {
            const u = UNIT_MAP[r.unit.unitId];
            showRewardsModal({ title: r.unit.isNew ? `${u.name} joined!` : `${u.name} — duplicate`, rewards: r.rewards, extra: h('div.ma-buy-unit', card(r.unit.unitId, { variant: 'tall' })), note: r.unit.isNew ? 'Find her in Students.' : r.unit.essence ? `${u.name}'s Essence +1${r.unit.readyStep ? ` · P${r.unit.readyStep} ready!` : '.'}` : `Spare → ${spareText(r.unit.spare)}.` });
          } else {
            showRewardsModal({ title: 'Purchased', rewards: r.rewards });
            for (const f of r.fused || []) toast(f.id === 'crown_rainbow' ? 'A Rainbow Crown! Gate 9 or 10 can open.' : `${getItem(f.id)?.name} fused!`, 'good', 4200);
          }
        },
      },
    ],
  });
}

/** Chosen SSR Essence: pick which owned SSR gets 1 Essence (greyed at her hold cap). */
function pickChosen(o, redraw) {
  if (o.soldOut || o.blocked) return;
  if (!o.affordable) {
    toast(`You need ${formatNumber(o.price)} Moonpearls.`, 'bad');
    return;
  }
  const m = modal({
    title: 'Chosen SSR Essence',
    wide: true,
    body: h('div',
      h('p.muted', `1 Essence for the SSR you pick (${formatNumber(o.price)} Moonpearls).`),
      h('div.ma-spark-grid', (o.targets || []).map((id) => h('div.ma-spark-cell',
        card(id, { variant: 'tall' }),
        h('div.ma-spark-meta', h('b', UNIT_MAP[id].name), h('span.muted', nextStepText(id))),
        button('Choose', {
          kind: 'yellow', small: true, testid: `chosen-${id}`,
          onClick: () => {
            const r = buyOffer(store.profile, o.id, 1, new Date(), { unitId: id });
            m.close();
            if (!r.ok) {
              toast('That did not work. Try again.', 'bad');
              return;
            }
            store.commit('shop');
            redraw();
            toast(`${UNIT_MAP[id].name}'s Essence +1 (holds ${r.essence.held}/${r.essence.cap}).`, 'good', 3200);
          },
        }))))),
    actions: [{ label: 'Cancel', kind: 'ghost' }],
  });
}
