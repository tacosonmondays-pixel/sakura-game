// SSR Select Ticket (Beta Tester Thank-You gift): pick ANY SSR student. New girls join the
// academy; owned girls count as a duplicate (1 Essence of her, or a spare past her hold cap). Opened from the item's
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
import { isUR, urBadge, applyUrFrame } from './rarity.js';
import { MAX_POTENTIAL, potentialLevel, potentialNext, dupePastMaxPay } from '../systems/potential.js';
import { essenceBalance, essenceCap } from '../systems/essence.js';
import { spareText } from './potential.js';

/**
 * After a claim: "Choose your SSR now?"
 * @param {{ lead?: string }} [opts] lead: first line (e.g. "Received 35 kinds of gifts…")
 */
export async function offerSelectTicket({ lead = '' } = {}) {
  if (itemCount(store.profile, SSR_SELECT_TICKET) <= 0) return;
  const text = `${lead ? `${lead} ` : ''}Your gifts include an SSR Select Ticket: choose any SSR student you like — now, or later from the Backpack.`;
  const ok = await confirmDialog(text, { title: lead ? 'Gifts received!' : 'SSR Select Ticket', ok: 'Choose now', cancel: 'Later', okKind: 'yellow' });
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
    body: h('div.sst', h('p.muted', `Choose any SSR student (tickets: ${have}). Already in your academy? She gains 1 Essence for her next Potential step (past her Essence cap: ${dupePastMaxPay({ rarity: 'SSR' })}).`), grid),
    actions: [{ label: 'Cancel', kind: 'ghost' }],
  });
  for (const id of POOL.SSR) {
    const u = UNIT_MAP[id];
    const owned = !!profile.units[id];
    const cell = h(`button.sst-cell${owned ? '.owned' : ''}`, {
      'data-testid': `sst-${id}`,
      onclick: async () => {
        const st = store.profile.units[id];
        const p = owned ? potentialLevel(st) : 0;
        const full = owned && essenceBalance(store.profile, id) >= essenceCap(st);
        const text = !owned ? `Recruit ${u.name}, ${u.title}?`
          : full ? `${u.name} holds all the Essence she can: the ticket becomes ${dupePastMaxPay(u)}. Use it?`
            : `${u.name} is already in your academy: she gains 1 Essence (for P${p + 1}: ${potentialNext(u, st)?.brief || ''}). Use it?`;
        const ok = await confirmDialog(text, { title: 'Use SSR Select Ticket', ok: !owned ? `Choose ${u.name}` : full ? 'Convert' : 'Use ticket', okKind: 'yellow' });
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
    // the ticket recruits an SSR; a girl you already ascended keeps her UR frame here
    isUR(u, profile) ? h('span.sst-rarity.sst-ur', urBadge()) : h('span.sst-rarity', 'SSR'),
    owned ? h('span.sst-owned', 'Owned') : null,
    h('span.sst-name', h('b', u.name), h('small', ROLES[u.role]?.name || u.title)),
    );
    applyUrFrame(cell, u, profile);
    grid.appendChild(cell);
  }
  return m;
}

/** "P2 ready: ✦ Firefly Lamps" after a duplicate gave her the Essence for it. */
function stepLine(u, r) {
  if (r.isNew || !r.readyStep) return null;
  const info = potentialNext(u, store.profile.units[u.id]);
  if (!info) return null;
  return h('div.sst-joined-step', { 'data-testid': 'sst-joined-step' },
    h('b', `P${info.step} ready: ${info.brief}`),
    h('span', 'Raise her Potential on her Info tab.'));
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
        h('p', { 'data-testid': 'sst-joined-text' }, r.isNew ? `${u.name} joined the academy!`
          : r.essence ? `${u.name} was already here — ${u.name}'s Essence +1${r.readyStep ? ` · P${r.readyStep} ready!` : '.'}`
            : `${u.name} holds all her Essence — spare → ${spareText(r.spare)}.`),
        // the step she just reached (the "Potential up!" card's content, inside this card)
        stepLine(u, r),
        u.quote ? h('q', u.quote) : null,
      ),
    ),
    actions: [
      { label: 'OK', kind: 'ghost', testid: 'sst-ok' },
      { label: 'View student', kind: 'yellow', testid: 'sst-view', onClick: (c) => { c(); navigate('student', { id: u.id }); } },
    ],
  });
}

