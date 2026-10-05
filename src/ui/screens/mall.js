// Mall (owner: meta-a). Route: #/mall?tab=general
// Tabs from shopTabs(): General (coins), Gem Shop, Recruit Exchange (spark + fragments),
// Boss Exchange (Assault Tokens), Bounty Exchange (Bounty Tokens). Offers show the item
// tile, price, stock and reset period; buying asks for a quantity when more than one fits.
import '../styles/meta-a.css';
import { h, clear, screen, svgEl, modal, toast, button, tabs } from '../components.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { formatNumber } from '../../core/util.js';
import { UNIT_MAP } from '../../data/units.js';
import { getItem } from '../../data/items.js';
import { ITEM_RARITIES } from '../../data/types.js';
import { currencyIcon, uiIcon } from '../../art/icons.js';
import { shopTabs, buyOffer, currencyBalance } from '../../systems/shop.js';
import { tile, card, showRewardsModal, cssVar, rememberParams } from './stage.js';

const CURRENCY_NAME = { coins: 'Coins', gems: 'Gems', recruitPoints: 'Recruit Points', token_boss: 'Assault Tokens', token_bounty: 'Bounty Tokens' };
const RESET_LABEL = { daily: 'Daily', weekly: 'Weekly', never: 'Once' };
const CURRENCY_ROUTE = {
  token_boss: { route: 'assault', label: 'Total Assault' },
  token_bounty: { route: 'bounty', label: 'Bounty' },
  recruitPoints: { route: 'recruit', label: 'Recruit' },
  gems: { route: 'commissions', label: 'Commissions' },
  coins: { route: 'bounty', label: 'Coin Bounty' },
};

function curIcon(currency, cls = 'ma-cur-icon') {
  return svgEl(currencyIcon(currency), cls);
}

export function render(root, params = {}) {
  const { el, body } = screen('Mall', { cls: 'ma-mall-screen' });
  root.appendChild(el);
  const all = shopTabs(store.profile);
  let active = all.some((t) => t.id === params.tab) ? params.tab : all[0].id;

  const tabBar = tabs(all.map((t) => ({ id: t.id, label: t.name })), active, (id) => {
    active = id;
    rememberParams('mall', { tab: id });
    draw();
  });
  tabBar.classList.add('ma-tabs');
  const content = h('div.ma-mall-content.ma-tab-body');
  body.append(h('div.ma-wrap', tabBar, content));

  const draw = () => {
    clear(content);
    const tab = shopTabs(store.profile).find((t) => t.id === active);
    const go = CURRENCY_ROUTE[tab.currency];
    content.appendChild(h('div.ma-mall-head',
      h('div.ma-mall-desc', h('h3.ma-section-title', tab.name), h('p.muted', tab.desc)),
      h('div.ma-balance', curIcon(tab.currency, 'ma-balance-icon'), h('div', h('div.ma-balance-val', { 'data-testid': 'mall-balance' }, formatNumber(tab.balance)), h('div.muted', CURRENCY_NAME[tab.currency] || tab.currency)),
        go ? h('button.ma-balance-go', { onclick: () => navigate(go.route), title: `Earn more in ${go.label}` }, svgEl(uiIcon('plus'), 'ma-inline-icon')) : null),
    ));
    const grid = h('div.ma-offers');
    tab.offers.forEach((o, i) => {
      const elOffer = offerCard(o, () => draw());
      elOffer.style.animationDelay = `${Math.min(i, 12) * 25}ms`;
      grid.appendChild(elOffer);
    });
    if (!tab.offers.length) grid.appendChild(h('div.ma-empty-state', svgEl(uiIcon('mall')), h('p', 'Nothing on the shelves right now.')));
    content.appendChild(grid);
    content.appendChild(h('p.muted.ma-hint', 'Daily stock restocks at midnight; weekly stock on Monday.'));
  };
  draw();
  const off = store.on('change', (e) => { if (e?.reason === 'replace') draw(); });
  return () => off();
}

function offerCard(o, redraw) {
  const isUnit = !!o.unitId;
  const item = o.item ? getItem(o.item) : null;
  const name = isUnit ? UNIT_MAP[o.unitId]?.name : item?.name || o.item;
  const stockText = o.stock != null ? `${RESET_LABEL[o.resets] || ''} ${o.remaining}/${o.stock}` : isUnit ? (o.owned ? 'Owned → fragments' : 'Spark') : 'Unlimited';
  const el = h(
    `div.ma-offer${o.soldOut ? '.sold' : ''}${o.highlight ? '.hot' : ''}${isUnit ? '.unit' : ''}`,
    { 'data-offer': o.id },
    o.highlight ? h('span.ma-offer-ribbon', isUnit ? 'SSR' : 'Hot') : null,
    h('div.ma-offer-art',
      isUnit
        ? card(o.unitId, { variant: 'square', owned: true, onClick: () => navigate('student', { id: o.unitId }) })
        : tile(o.item, o.count > 1 ? o.count : null, { size: 72 }),
    ),
    h('div.ma-offer-name', name),
    h('div.ma-offer-stock', stockText),
    h(`button.ma-offer-buy${o.affordable ? '' : '.short'}`,
      { disabled: o.soldOut, onclick: () => startBuy(o, redraw), 'data-testid': `buy-${o.id}` },
      o.soldOut ? h('span', 'Sold out') : [curIcon(o.currency), h('span', formatNumber(o.price))]),
  );
  if (item) cssVar(el, '--rc', ITEM_RARITIES[item.rarity]?.color || '#9aa5b1');
  return el;
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
      h('div', h('b', isUnit ? UNIT_MAP[o.unitId].name : item?.name), h('p.muted', isUnit ? (o.owned ? 'Already in your club — converts into Star Fragments.' : 'Joins your club immediately.') : item?.desc || '')),
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
            showRewardsModal({ title: r.unit.isNew ? `${u.name} joined!` : `${u.name} — duplicate`, rewards: r.rewards, extra: h('div.ma-buy-unit', card(r.unit.unitId, { variant: 'tall' })), note: r.unit.isNew ? 'Find her in Students.' : 'Converted into Star Fragments.' });
          } else {
            showRewardsModal({ title: 'Purchased', rewards: r.rewards });
          }
        },
      },
    ],
  });
}
