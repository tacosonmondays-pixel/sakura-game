// SSR Select Ticket (Beta Tester Thank-You gift): pick ANY SSR student. New girls join the
// academy; owned girls convert into Star Fragments like any duplicate. Opened from the item's
// "Use" button (Backpack / item info) and right after the beta gift is claimed.
import { h } from './dom.js';
import { modal, toast, confirmDialog } from './components.js';
import { navigate } from './router.js';
import { store } from '../core/store.js';
import { UNIT_MAP } from '../data/units.js';
import { UNIT_RARITIES, ROLES } from '../data/types.js';
import { portraitHTML } from '../art/portraits.js';
import { POOL, redeemSelectTicket, SSR_SELECT_TICKET } from '../systems/gacha.js';
import { itemCount } from '../systems/inventory.js';

/** After a claim: "Choose your SSR now?" */
export async function offerSelectTicket() {
  if (itemCount(store.profile, SSR_SELECT_TICKET) <= 0) return;
  const ok = await confirmDialog('You received an SSR Select Ticket! Choose any SSR student you like — you can also do it later from the Backpack.', { title: 'SSR Select Ticket', ok: 'Choose now', cancel: 'Later', okKind: 'yellow' });
  if (ok) openSelectTicket();
}

/** The picker: every SSR girl as a tall drawn card. */
export function openSelectTicket() {
  const profile = store.profile;
  const have = itemCount(profile, SSR_SELECT_TICKET);
  if (have <= 0) {
    toast('You have no SSR Select Ticket.', 'info');
    return null;
  }
  const grid = h('div.sst-grid');
  const m = modal({
    title: 'SSR Select Ticket',
    wide: true,
    cls: 'sst-modal',
    body: h('div.sst', h('p.muted', `Choose any SSR student (tickets: ${have}). Already in your academy? She converts into ${UNIT_RARITIES.SSR.fragmentsOnDupe} Star Fragments.`), grid),
    actions: [{ label: 'Cancel', kind: 'ghost' }],
  });
  for (const id of POOL.SSR) {
    const u = UNIT_MAP[id];
    const owned = !!profile.units[id];
    grid.appendChild(h(`button.sst-cell${owned ? '.owned' : ''}`, {
      'data-testid': `sst-${id}`,
      onclick: async () => {
        const ok = await confirmDialog(owned ? `${u.name} is already in your academy: the ticket becomes ${UNIT_RARITIES.SSR.fragmentsOnDupe} Star Fragments. Use it?` : `Recruit ${u.name}, ${u.title}?`, { title: 'Use SSR Select Ticket', ok: owned ? 'Convert' : `Choose ${u.name}`, okKind: 'yellow' });
        if (!ok) return;
        const r = redeemSelectTicket(store.profile, id);
        if (!r.ok) return toast(r.error === 'noTicket' ? 'You have no SSR Select Ticket.' : 'That student cannot be chosen.', 'bad');
        store.commit('select-ticket');
        store.saveNow?.();
        m.close();
        showJoined(u, r);
      },
    },
    h('span.sst-art', { html: portraitHTML(u, 'card') }),
    h('span.sst-rarity', 'SSR'),
    owned ? h('span.sst-owned', 'Owned') : null,
    h('span.sst-name', h('b', u.name), h('small', ROLES[u.role]?.name || u.title)),
    ));
  }
  return m;
}

function showJoined(u, r) {
  modal({
    title: '',
    cls: 'sst-joined-modal',
    body: h('div.sst-joined',
      h('div.sst-joined-art', { html: portraitHTML(u, 'full', { eager: true }) }),
      h('div.sst-joined-text',
        h('span.sst-joined-kicker', 'SSR'),
        h('b.sst-joined-name', u.name),
        h('span.sst-joined-title', u.title),
        h('p', r.isNew ? `${u.name} joined the academy!` : `${u.name} was already here — +${r.fragments} Star Fragments.`),
        u.quote ? h('q', u.quote) : null,
      ),
    ),
    actions: [
      { label: 'OK', kind: 'ghost' },
      { label: 'View student', kind: 'yellow', testid: 'sst-view', onClick: (c) => { c(); navigate('student', { id: u.id }); } },
    ],
  });
}

