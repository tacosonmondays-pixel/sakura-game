// #/chat?tab=global|clan — full-screen chat with the player's online card on the side.
import { h, screen, tabs as tabBar, svgEl, button, glyph } from '../components.js';
import { navigate } from '../router.js';
import { createChatPanel } from '../online/chatPanel.js';
import { ensureOnline, onlinePill, avatar, levelChip, askName, storedName, PEOPLE_GLYPH } from '../online/common.js';
import { store } from '../../core/store.js';
import { profileCard } from '../../online/identity.js';
import { getBackend } from '../../online/backend.js';

export function render(root, params = {}) {
  const { el, body } = screen('Chat', { cls: 'ol-screen' });
  root.append(el);
  const side = h('aside.ol-side');
  const main = h('div.ol-main');
  body.append(h('div.ol-layout', main, side));
  let panel = null;
  let destroyed = false;
  // the layout is there at once (also behind the first-time name prompt); the chat fills in
  // once the account is ready
  main.append(h('section.panel.ol-chat-wait', h('div.ol-connecting', h('i.ol-spinner'), h('p.muted', 'Connecting to chat…'))));
  paintSide(null);

  (async () => {
    let clan = null;
    try {
      const backend = await ensureOnline();
      clan = (await backend.myClan())?.clan || null;
    } catch {
      /* the panel shows the error */
    }
    if (destroyed) return;
    main.replaceChildren();
    const tab = params.tab === 'clan' && clan ? 'clan' : 'global';
    const items = [{ id: 'global', label: 'Global' }];
    if (clan) items.push({ id: 'clan', label: `[${clan.tag}] ${clan.name}` });
    panel = createChatPanel({ channel: tab === 'clan' ? `clan:${clan.id}` : 'global' });
    main.append(tabBar(items, tab, (id) => {
      panel.setChannel(id === 'clan' ? `clan:${clan.id}` : 'global');
      navigate('chat', { tab: id }, { replace: true });
    }), panel.el);
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
        onlinePill(),
        button('Change name', { kind: 'ghost', small: true, testid: 'chat-rename', onClick: async () => { await askName({ title: 'Change name', current: storedName() }); nameEl.textContent = shownName(); } })),
      h('section.panel.ol-side-links',
        h('button.ol-link', { onclick: () => navigate('clan'), 'data-testid': 'chat-to-clan' }, svgEl(PEOPLE_GLYPH, 'ol-link-ico'), h('span', clan ? `Clan · ${clan.name}` : 'Find a clan')),
        h('button.ol-link', { onclick: () => navigate('coop'), 'data-testid': 'chat-to-coop' }, svgEl(glyph('sword'), 'ol-link-ico'), h('span', 'Co-op battle'))),
      h('p.muted.ol-rules', 'Be kind. Chat is limited to one message every 2 seconds and 20 per minute.'),
    );
  }

  return () => {
    destroyed = true;
    panel?.destroy();
  };
}
