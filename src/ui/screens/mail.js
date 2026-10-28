// The Mailroom (UI M5c; docs/specs/UI_DIRECTION.md §5.10 E1, E2, E3, E6; notes/ui-m5/PLAN.md §5 M5c). Route:
// #/mail?tab=unclaimed|history. No fixed parent (src/ui/nav.js): the arrow goes back to where it was opened (the lobby,
// the Menu, the Notice, the Journal, an event page). It replaced the Mail modal; lobby/mailbox.js openMailbox() opens it.
//
// Hotaru hosts on the right (her line: the gifts waiting, one expiring, all caught up); the post-room tint behind (E6;
// the painted academy until the rooms are painted, Q5). The rail: Unclaimed · History (Q7; a red dot while a gift
// waits, never a count). The list sits under an ink plate header (E2) whose one yellow is Claim all (with its count;
// gone when nothing waits). A row: the sender's crest, the title, the letter's first line (a tap reads it all, with
// who sent it and when), the gifts as tiles (M3's item tile, untouched), the expiry countdown chip (red under 24 h:
// the gift is lost at zero) and an ink Claim. A designed empty state: "All caught up".
// Test ids kept from the modal: mail-<id>, mail-claim-<id>, mail-claim-all, mail-expiry-<id>; mail-close is the
// screen's back arrow. The model is pure: ../mailroom.js.
import '../styles/meta-a.css';
import '../styles/hubs.css';
import '../styles/v2-hubs.css';
import { h } from '../dom.js';
import { svgEl, glyph, toast } from '../components.js';
import { countdownChip, inkBtn, btnCount, kbdHint, ico, KIT_SVG, secondaryBtn } from '../kit.js';
import { rememberParams } from '../router.js';
import { store } from '../../core/store.js';
import { UNIT_MAP, UNITS } from '../../data/units.js';
import { portraitHTML } from '../../art/portraits.js';
import { mailList, claimMail, claimAllMail } from '../../systems/mail.js';
import { mailroomModel, mailHostState, MAIL_SECTIONS } from '../mailroom.js';
import { listScreen } from '../listScreen.js';
import { rewardTiles, afterClaim } from '../lobby/mailbox.js';

const LABEL = { unclaimed: 'Unclaimed', history: 'History' };
const ICON = { unclaimed: 'gift', history: 'calendar' };
const KIND_TAG = { claimed: 'Claimed', expired: 'Expired', notice: 'Notice' };

/** A girl who signs her own letters ("Hikari"), by name: her bust is the crest. */
const BY_NAME = new Map(UNITS.map((u) => [u.name, u.id]));

const dateText = (t) => {
  try {
    return new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
};

/** The sender's crest: her bust when a girl wrote it, else the academy's blossom on ink. */
function crest(l) {
  const id = BY_NAME.get(String(l.from || '').trim());
  const u = id ? UNIT_MAP[id] : null;
  return h(`span.mbx-crest${u ? '.girl' : ''}${l.kind === 'gift' ? '.gift' : ''}`, { title: l.from || 'Sakura Academy', 'aria-hidden': 'true' },
    u ? h('span.mbx-crest-art', { html: portraitHTML(u, 'bust') }) : ico(KIT_SVG.blossom, 'ui-ico.mbx-crest-ico'));
}

const sectionsFor = (model) => MAIL_SECTIONS.map((id) => ({ id, label: LABEL[id], icon: ICON[id], dot: model.dots[id], dotTitle: 'gifts to claim' }));

export function render(root, params = {}) {
  // (always Unclaimed first: with nothing waiting it says "All caught up" and offers History)
  let tab = MAIL_SECTIONS.includes(params.tab) ? params.tab : 'unclaimed';
  const model0 = mailroomModel(mailList(store.profile));

  const ls = listScreen({
    title: 'Mailroom', cls: 'mbx-screen v2h', location: 'mail', host: 'mail', state: mailHostState(model0),
    sections: sectionsFor(model0), active: tab, railLabel: 'Mail sections', headTestid: 'mail-head',
    onPick: (id) => {
      if (id === tab) return;
      tab = id;
      rememberParams('mail', { tab: id });
      ls.rail.setActive(id);
      draw();
    },
  });
  // the arrow keeps the old modal's Close test id (keys.js Esc finds it as the top bar's arrow)
  ls.el.querySelector('.topbar-back')?.setAttribute('data-testid', 'mail-close');
  root.appendChild(ls.el);
  const list = h('div.mbx-list', { 'data-testid': 'mail-list' });
  ls.list.append(list);

  let dots = JSON.stringify(model0.dots);
  const draw = () => {
    const model = mailroomModel(mailList(store.profile));
    if (JSON.stringify(model.dots) !== dots) {
      dots = JSON.stringify(model.dots);
      ls.setSections(sectionsFor(model), tab);
    }
    ls.setLines(mailHostState(model));
    const rows = model[tab];
    if (tab === 'unclaimed') {
      const all = model.gifts ? claimAllBtn(model.gifts) : null;
      ls.setHead('Unclaimed', all ? [all] : []);
    } else ls.setHead('History', []);
    list.replaceChildren(...(rows.length ? rows.map((l) => row(l)) : [empty(tab, model)]));
  };

  /** Claim all: the screen's one yellow, with its count; Space presses it on desktop (E8). */
  const claimAllBtn = (n) => h('button.btn.btn-yellow.mbx-all', { type: 'button', 'data-testid': 'mail-claim-all', 'data-primary': '', 'aria-label': `Claim all (${n})`, onclick: () => claimAll() },
    svgEl(glyph('gift'), 'btn-icon'), h('span.btn-label', 'Claim all'), btnCount(n), kbdHint('Space'));

  const row = (l) => {
    // the title and the letter's first line are one tap target: a tap reads it all (who sent it and when, too)
    const body = h('span.mbx-letter-body', l.body || l.title);
    const from = h('span.mbx-from', { hidden: true }, `From ${l.from || 'Sakura Academy'} · ${dateText(l.sentAt)}`);
    const read = h('button.mbx-read', {
      type: 'button', title: 'Tap to read the whole letter', 'aria-expanded': 'false',
      onclick: () => {
        const open = body.classList.toggle('open');
        read.setAttribute('aria-expanded', open ? 'true' : 'false');
        from.hidden = !open;
      },
    }, h('b.mbx-title', l.title), body, from);
    return h(`article.mbx-letter.k-${l.kind}`, { 'data-testid': `mail-${l.id}` },
      crest(l),
      h('div.mbx-letter-main',
        read,
        l.rewards?.length ? rewardTiles(l.rewards, { size: 44 }) : null),
      h('div.mbx-letter-side',
        // a gift's expiry is a deadline (§5.9): red under 24 h; at zero the list draws again (the row moves to History)
        l.kind === 'gift' && l.msLeft != null
          ? countdownChip(l.msLeft, { label: 'Expires', cls: 's', doneText: 'Expired', onDone: () => { if (list.isConnected) draw(); }, testid: `mail-expiry-${l.id}` })
          : null,
        l.kind === 'gift'
          ? inkBtn('Claim', { testid: `mail-claim-${l.id}`, title: `Claim "${l.title}"`, onClick: () => claimOne(l.id) })
          : h(`span.mbx-tag.${l.kind}`, KIND_TAG[l.kind] || '')));
  };

  const empty = (which, model) => (which === 'unclaimed'
    ? h('div.mbx-empty', { 'data-testid': 'mail-empty' },
      h('span.mbx-empty-crest', { 'aria-hidden': 'true' }, ico(glyph('mail'), 'ui-ico.mbx-empty-ico')),
      h('b.mbx-empty-title', 'All caught up!'),
      h('p.mbx-empty-line', 'New gifts and notices from the academy land here.'),
      model.history.length ? secondaryBtn('History', { icon: 'calendar', testid: 'mail-empty-history', onClick: () => ls.rail.querySelector('[data-testid="tab-history"]')?.click() }) : null)
    : h('div.mbx-empty', { 'data-testid': 'mail-empty' },
      h('span.mbx-empty-crest', { 'aria-hidden': 'true' }, ico(glyph('mail'), 'ui-ico.mbx-empty-ico')),
      h('b.mbx-empty-title', 'No letters yet'),
      h('p.mbx-empty-line', 'Letters you have read and gifts you have claimed stay here.')));

  const claimOne = (id) => {
    const r = claimMail(store.profile, id);
    if (!r.ok) return toast(r.error === 'expired' ? 'That letter expired.' : 'Already claimed.', 'bad');
    store.commit('mail');
    draw();
    afterClaim(r.rewards);
  };
  const claimAll = () => {
    const r = claimAllMail(store.profile);
    if (!r.ok) return;
    store.commit('mail');
    draw();
    afterClaim(r.rewards);
  };

  draw();
  // a letter that arrives while the Mailroom is open (an event's daily gift), an import, another tab
  const off = store.on('change', (e) => { if (e?.reason === 'replace' || e?.reason === 'event' || e?.reason === 'app-start') draw(); });
  return () => {
    off();
    ls.cleanup();
  };
}
