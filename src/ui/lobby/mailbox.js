// Mail (academy style) and the Beta Tester Thank-You celebration.
//   openMailbox()        opens the Mailroom (#/mail, src/ui/screens/mail.js; UI M5c: a full screen with the rail
//                        Unclaimed · History, it replaced the Mail modal). Every door keeps calling this.
//   rewardTiles(), afterClaim()  a letter's gifts as tiles, and what a claim says (the Mailroom and the beta gift)
//   maybeShowBetaGift()  once per session in the lobby while the beta gift is unclaimed: a
//                        celebratory modal with the message and the rewards, Claim / Later
import '../styles/hubs.css';
import { h } from '../dom.js';
import { modal, itemTile, toast } from '../components.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { formatNumber } from '../../core/util.js';
import { getItem } from '../../data/items.js';
import { ITEM_RARITIES } from '../../data/types.js';
import { UNIT_MAP } from '../../data/units.js';
import { portraitHTML } from '../../art/portraits.js';
import { lobbyArtUrl } from '../../data/lobbyArt.js';
import { claimMail, pendingBetaGift, BETA_GIFT_ID } from '../../systems/mail.js';
import { itemCount } from '../../systems/inventory.js';
// static (not lazy): right after "Claim gifts" the SSR picker offer must appear at once — a lazy
// chunk on a slow connection made the tap look like it did nothing
import { offerSelectTicket } from '../selectTicket.js';
import { HONOR_REWARD_PREFIX } from '../../systems/profileHonors.js';
import { HONOR_MAP } from '../../data/honors.js';

const SHOWN_KEY = 'sakura-beta-gift-shown';

const isHonor = (id) => id.startsWith(HONOR_REWARD_PREFIX);

/** An Honor Ribbon gift ('honor:<achId>'): the ribbon itself (its art loads with the ribbon module) and its name. */
function honorTile(id, size) {
  const achId = id.slice(HONOR_REWARD_PREFIX.length);
  const name = HONOR_MAP[achId]?.name || 'Honor Ribbon';
  const art = h('span.mbx-honor-art', { style: { '--s': `${size}px` } });
  import('../honorFx.js').then(({ ribbonArt }) => art.replaceChildren(ribbonArt(achId, size, { title: name }))).catch(() => {});
  return h('span.mbx-honor', { title: name, 'data-testid': `mail-honor-${achId}` },
    art, h('small', name));
}

function tile(id, count, size = 54) {
  if (isHonor(id)) return honorTile(id, size);
  const wrap = itemTile(id, count, { size, showName: false });
  wrap.style.setProperty('--rarity', ITEM_RARITIES[getItem(id)?.rarity]?.color || '#9aa5b1');
  return wrap; // the tile's own count is already short (300000 → "x300K"), so big counts fit a small tile
}

/** Rewards as tiles: the headline items first, the material bundle folded into one chip. */
export function rewardTiles(rewards, { fold = true, size = 54 } = {}) {
  const head = rewards.filter((r) => !fold || !/^mat_|^book_/.test(r.id));
  const mats = fold ? rewards.filter((r) => /^mat_|^book_/.test(r.id)) : [];
  return h('div.mbx-rewards',
    head.map((r) => tile(r.id, r.count, size)),
    mats.length ? h('div.mbx-bundle', { title: mats.map((r) => `${getItem(r.id)?.name} ×${r.count}`).join(', ') },
      h('div.mbx-bundle-icons', mats.filter((r) => /_superRare$|_mythic$/.test(r.id)).slice(0, 4).map((r) => tile(r.id, null, Math.round(size * 0.62)))),
      h('span', h('b', `${mats.length} kinds`), h('small', `${formatNumber(mats.reduce((a, r) => a + r.count, 0))} materials & books`))) : null,
  );
}

/**
 * Opens the Mailroom (UI M5c: #/mail, a full screen; it replaced the Mail modal). The lobby's Mail button, the Menu's
 * Mail item, the Notice, the Journal and the event page all come here. Its back arrow returns to where it was opened.
 * @param {{ tab?: 'unclaimed'|'history' }} [o]
 */
export function openMailbox({ tab = null } = {}) {
  navigate('mail', tab ? { tab } : {});
}

/**
 * After a claim: a toast — or, when the gifts include an SSR Select Ticket, one dialog that says
 * both ("Gifts received! … choose your SSR now?") so a toast never sits on top of its title.
 */
export function afterClaim(rewards) {
  const ribbons = rewards.filter((r) => isHonor(r.id)).map((r) => HONOR_MAP[r.id.slice(HONOR_REWARD_PREFIX.length)]?.name || 'Honor Ribbon');
  const items = rewards.length - ribbons.length;
  const ribbonLine = ribbons.length ? `${ribbons.join(' and ')} added to your Honor Ribbon Case!` : '';
  const itemLine = items ? `Received ${items} kind${items === 1 ? '' : 's'} of gifts — check your Backpack!` : '';
  const received = [ribbonLine, itemLine].filter(Boolean).join(' ');
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
