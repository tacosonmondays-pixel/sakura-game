// #/chat?tab=global|clan — full-screen chat with the player's online card on the side.
// [ui-v2 M8] the channels as the kit's folder tabs on the chat's panel; the side card says who you are once (the top
// bar's pill says whether you are online), then the links as kit rows.
import { h, screen, svgEl, button, glyph } from '../components.js';
import { navigate } from '../router.js';
import { createChatPanel } from '../online/chatPanel.js';
import { ensureOnline, avatar, levelChip, askName, storedName, folderTabs, PEOPLE_GLYPH } from '../online/common.js';
import { inlineLoader } from '../loading/loader.js';
import { store } from '../../core/store.js';
import { profileCard } from '../../online/identity.js';
import { getBackend } from '../../online/backend.js';
import { onlineHeadExtra } from '../online/inboxButton.js';
import { hub } from '../online/socialHub.js';

export function render(root, params = {}) {
  const { el, body } = screen('Chat', { cls: 'ol-screen', extra: onlineHeadExtra() });
  root.append(el);
  const side = h('aside.ol-side');
  const main = h('div.ol-main');
  body.append(h('div.ol-layout', main, side));
  let panel = null;
  let destroyed = false;

  // [social] Messages · 3 (hidden until the server has the social update)
  const dmLink = h('button.ol-link', { onclick: () => navigate('messages'), 'data-testid': 'chat-to-messages', hidden: !hub.ready });
  const paintDm = () => {
    dmLink.hidden = !hub.ready;
    // ([ui-v2 M8] the unread count is the top bar envelope's: said once)
    dmLink.replaceChildren(svgEl(glyph('mail'), 'ol-link-ico'), h('span', 'Messages'));
  };
  paintDm();
  const offHub = [hub.on('badges', paintDm), hub.on('status', paintDm)];

  // the layout is there at once (also behind the first-time name prompt); the chat fills in
  // once the account is ready
  main.append(h('section.panel.ol-chat-wait', h('div.ol-connecting', inlineLoader('Connecting to chat'))));
  paintSide(null);

  (async () => {
    let clan = null;
    let known = false; // (unknown after an error: the panel asks again for the recruiting cards)
    try {
      const backend = await ensureOnline();
      clan = (await backend.myClan())?.clan || null;
      known = true;
    } catch {
      /* the panel shows the error */
    }
    if (destroyed) return;
    main.replaceChildren();
    const tab = params.tab === 'clan' && clan ? 'clan' : 'global';
    const items = [{ id: 'global', label: 'Global' }];
    if (clan) items.push({ id: 'clan', label: `[${clan.tag}] ${clan.name}` });
    panel = createChatPanel({ channel: tab === 'clan' ? `clan:${clan.id}` : 'global', ...(known ? { myClanId: clan?.id || null } : {}) });
    main.append(h('section.ui-tabbed.ol-tabbed.ol-chat-tabbed', folderTabs(items, tab, (id) => {
      panel.setChannel(id === 'clan' ? `clan:${clan.id}` : 'global');
      navigate('chat', { tab: id }, { replace: true });
    }, { label: 'Chat channels' }), panel.el));
    paintSide(clan);
  })();

  function paintSide(clan) {
    const card = profileCard(store.profile);
    // no name chosen yet ("Not now"): the automatic one the server gave this account
    const shownName = () => storedName() || getBackend().user?.name || 'Sensei';
    const nameEl = h('b.ol-me-name', shownName());
    side.replaceChildren(
      h('section.panel.ol-me',
        h('div.ol-me-row', avatar(card.avatar, 56), h('div', nameEl, h('div', levelChip(card.level)))),
        button('Change name', { kind: 'ghost', small: true, testid: 'chat-rename', onClick: async () => { await askName({ title: 'Change name', current: storedName() }); nameEl.textContent = shownName(); } })),
      h('section.panel.ol-side-links',
        h('button.ol-link', { onclick: () => navigate('clan'), 'data-testid': 'chat-to-clan' }, svgEl(PEOPLE_GLYPH, 'ol-link-ico'), h('span', clan ? `Clan · ${clan.name}` : 'Find a clan')),
        h('button.ol-link', { onclick: () => navigate('coop'), 'data-testid': 'chat-to-coop' }, svgEl(glyph('sword'), 'ol-link-ico'), h('span', 'Co-op battle')),
        dmLink),
      h('p.muted.ol-rules', 'Be kind. Chat is limited to one message every 2 seconds and 20 per minute. Tap a name to message, invite, block or report.'),
    );
  }

  return () => {
    destroyed = true;
    offHub.forEach((off) => off());
    panel?.destroy();
  };
}
