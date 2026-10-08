// Mailbox (Blue Archive style) and the Beta Tester Thank-You celebration.
//   openMailbox()        letters newest first: sender, title, message, reward tiles, expiry,
//                        Claim / Claim all (src/systems/mail.js)
//   maybeShowBetaGift()  once per session in the lobby while the beta gift is unclaimed: a
//                        celebratory modal with the message and the rewards, Claim / Later
import { h, clear } from '../dom.js';
import { modal, svgEl, glyph, button, itemTile, toast } from '../components.js';
import { store } from '../../core/store.js';
import { formatNumber } from '../../core/util.js';
import { getItem } from '../../data/items.js';
import { ITEM_RARITIES } from '../../data/types.js';
import { UNIT_MAP } from '../../data/units.js';
import { portraitHTML } from '../../art/portraits.js';
import { lobbyArtUrl } from '../../data/lobbyArt.js';
import { mailList, claimMail, claimAllMail, pendingBetaGift, BETA_GIFT_ID } from '../../systems/mail.js';
import { itemCount } from '../../systems/inventory.js';
// static (not lazy): right after "Claim gifts" the SSR picker offer must appear at once — a lazy
// chunk on a slow connection made the tap look like it did nothing
import { offerSelectTicket } from '../selectTicket.js';

const SHOWN_KEY = 'sakura-beta-gift-shown';

/** 300000 → "300K" so big counts fit a small tile. */
export function compactCount(n) {
  if (n >= 1e6) return `${+(n / 1e6).toFixed(1)}M`;
  if (n >= 1e4) return `${+(n / 1e3).toFixed(1)}K`;
  return formatNumber(n);
}

function tile(id, count, size = 54) {
  const wrap = itemTile(id, count, { size, showName: false });
  wrap.style.setProperty('--rarity', ITEM_RARITIES[getItem(id)?.rarity]?.color || '#9aa5b1');
  const c = wrap.querySelector('.item-count');
  if (c && count != null) c.textContent = `×${compactCount(count)}`;
  return wrap;
}

const dateText = (t) => {
  try {
    return new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
};

/** Rewards as tiles: the headline items first, the material bundle folded into one chip. */
function rewardTiles(rewards, { fold = true, size = 54 } = {}) {
  const head = rewards.filter((r) => !fold || !/^mat_|^book_/.test(r.id));
  const mats = fold ? rewards.filter((r) => /^mat_|^book_/.test(r.id)) : [];
  return h('div.mbx-rewards',
    head.map((r) => tile(r.id, r.count, size)),
    mats.length ? h('div.mbx-bundle', { title: mats.map((r) => `${getItem(r.id)?.name} ×${r.count}`).join(', ') },
      h('div.mbx-bundle-icons', mats.filter((r) => /_superRare$|_mythic$/.test(r.id)).slice(0, 4).map((r) => tile(r.id, null, Math.round(size * 0.62)))),
      h('span', h('b', `${mats.length} kinds`), h('small', `${formatNumber(mats.reduce((a, r) => a + r.count, 0))} materials & books`))) : null,
  );
}

/** Mail modal: list of letters + Claim all. */
export function openMailbox() {
  const list = h('div.mbx-list');
  const footer = h('div.mbx-foot');
  const m = modal({ title: 'Mail', wide: true, cls: 'mbx-modal', body: h('div.mbx', list, footer), actions: [{ label: 'Close', kind: 'ghost', testid: 'mail-close' }] });
  const paint = () => {
    const letters = mailList(store.profile);
    clear(list);
    clear(footer);
    if (!letters.length) {
      list.appendChild(h('div.mbx-empty', svgEl(glyph('mail'), 'mbx-empty-ico'), h('p', 'No mail yet, Sensei. Gifts and notices from the academy arrive here.')));
      return;
    }
    for (const l of letters) {
      list.appendChild(h(`article.mbx-letter${l.claimable ? '.new' : ''}${l.claimed ? '.claimed' : ''}`, { 'data-testid': `mail-${l.id}` },
        h('div.mbx-letter-ico', svgEl(glyph(l.claimable ? 'gift' : 'mail'), 'mbx-ico')),
        h('div.mbx-letter-main',
          h('div.mbx-letter-head', h('b', l.title), h('span.muted', `${l.from} · ${dateText(l.sentAt)}`)),
          h('p.mbx-letter-body', l.body),
          rewardTiles(l.rewards),
        ),
        h('div.mbx-letter-side',
          h('span.mbx-expiry', l.expired ? 'Expired' : l.expiresAt ? `Until ${dateText(l.expiresAt)}` : 'No expiry'),
          l.claimable
            ? button('Claim', { kind: 'yellow', small: true, testid: `mail-claim-${l.id}`, onClick: () => claimOne(l.id) })
            : h('span.mbx-claimed', l.claimed ? 'Claimed' : ''),
        ),
      ));
    }
    const n = letters.filter((l) => l.claimable).length;
    footer.append(h('span.muted', n ? `${n} letter${n === 1 ? '' : 's'} with gifts` : 'All gifts claimed'),
      button('Claim all', { kind: n ? 'yellow' : 'ghost', testid: 'mail-claim-all', disabled: !n, onClick: claimAll }));
  };
  const claimOne = (id) => {
    const r = claimMail(store.profile, id);
    if (!r.ok) return toast(r.error === 'expired' ? 'That letter expired.' : 'Already claimed.', 'bad');
    store.commit('mail');
    paint();
    afterClaim(r.rewards);
  };
  const claimAll = () => {
    const r = claimAllMail(store.profile);
    if (!r.ok) return;
    store.commit('mail');
    paint();
    afterClaim(r.rewards);
  };
  paint();
  return m;
}

/**
 * After a claim: a toast — or, when the gifts include an SSR Select Ticket, one dialog that says
 * both ("Gifts received! … choose your SSR now?") so a toast never sits on top of its title.
 */
function afterClaim(rewards) {
  const received = `Received ${rewards.length} kind${rewards.length === 1 ? '' : 's'} of gifts — check your Backpack!`;
  if (rewards.some((r) => r.id === 'ticket_ssr_select') && itemCount(store.profile, 'ticket_ssr_select') > 0) {
    Promise.resolve(offerSelectTicket({ lead: received })).catch(() => toast(received, 'good', 2600));
    return;
  }
  toast(received, 'good', 2600);
}

/** Show the beta celebration once per session while its gift is unclaimed. */
export function maybeShowBetaGift() {
  const letter = pendingBetaGift(store.profile);
  if (!letter) return null;
  try {
    if (sessionStorage.getItem(SHOWN_KEY) === '1') return null;
    sessionStorage.setItem(SHOWN_KEY, '1');
  } catch {
    /* no session storage: show it */
  }
  return showBetaGiftModal(letter);
}

/** The celebratory "Thank you, beta Sensei!" modal. */
export function showBetaGiftModal(letter = pendingBetaGift(store.profile)) {
  if (!letter) return null;
  const girls = ['aoi', 'hikari', 'luna'].filter((id) => UNIT_MAP[id]);
  const body = h('div.bg-gift',
    h('div.bg-gift-art', { 'aria-hidden': 'true' },
      h('img.bg-gift-paint', { src: lobbyArtUrl('thumbs/academy.webp'), alt: '', decoding: 'async' }),
      h('div.bg-gift-girls', girls.map((id, i) => h(`span.bg-gift-girl.g${i}`, { html: portraitHTML(UNIT_MAP[id], 'cutS', { eager: true }) }))),
      h('div.bg-gift-ribbon', h('span', 'BETA TESTER')),
      Array.from({ length: 10 }, (_, i) => h(`i.bg-gift-confetti.c${i}`)),
    ),
    h('div.bg-gift-text',
      h('h2.bg-gift-title', letter.title),
      h('p.bg-gift-msg', letter.body),
      rewardTiles(letter.rewards, { size: 52 }),
    ),
  );
  const m = modal({
    title: '',
    body,
    cls: 'bg-gift-modal',
    wide: true,
    actions: [
      { label: 'Later', kind: 'ghost', testid: 'beta-gift-later' },
      {
        label: 'Claim gifts', kind: 'yellow', icon: 'gift', testid: 'beta-gift-claim',
        onClick: (close) => {
          const r = claimMail(store.profile, BETA_GIFT_ID);
          close();
          if (!r.ok) return;
          store.commit('mail');
          afterClaim(r.rewards);
        },
      },
    ],
  });
  return m;
}
